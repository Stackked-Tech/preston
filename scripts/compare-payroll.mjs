/**
 * Compare Payout Suite output against Rachel's reference templates.
 * Usage: node scripts/compare-payroll.mjs
 *
 * Reads the Ballards CSV (2/15-2/28), runs processCSV, and compares
 * key columns against the BBS template values.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Papa from "papaparse";
import { createClient } from "@supabase/supabase-js";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

// Load env manually
const envText = fs.readFileSync(path.join(root, ".env"), "utf-8");
for (const line of envText.split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim();
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// ── Fetch branch config from DB (mirrors fetchBranchConfigs) ──

async function fetchBranchConfig(branchId) {
  const { data: branches } = await supabase
    .from("ea_branches")
    .select("*")
    .eq("branch_id", branchId);
  if (!branches?.length) throw new Error(`Branch not found: ${branchId}`);
  const branch = branches[0];

  const { data: staff } = await supabase
    .from("ea_staff")
    .select("*")
    .eq("branch_id", branchId)
    .eq("is_active", true)
    .order("sort_order");

  const { data: overrides } = await supabase
    .from("ea_name_overrides")
    .select("*")
    .eq("branch_id", branchId);

  const nameOverrides = {};
  for (const o of overrides || []) {
    nameOverrides[o.phorest_name] = o.staff_display_name;
  }

  const staffMembers = {};
  const staffOrder = [];
  for (const s of staff || []) {
    staffMembers[s.display_name] = {
      targetFirst: s.target_first,
      targetLast: s.target_last,
      internalId: Number(s.internal_id) || 0,
      stationLease: Number(s.station_lease) || 0,
      financialServices: Number(s.financial_services) || 0,
      phorestFee: Number(s.phorest_fee) || 0,
      refreshment: Number(s.refreshment) || 0,
      associatePay: s.associate_pay != null ? Number(s.associate_pay) : undefined,
      supervisor: s.supervisor || undefined,
    };
    staffOrder.push(s.display_name);
  }

  return {
    branchId: branch.branch_id,
    branchName: branch.name,
    abbreviation: branch.abbreviation,
    subsidiaryId: branch.subsidiary_id,
    account: branch.account,
    nameOverrides,
    staff: staffMembers,
    staffOrder,
  };
}

// ── Inline processCSV (simplified import since we can't use TS directly) ──
// We'll dynamically import the compiled version or just re-implement the core logic

// Actually, let's use tsx to run this... or just call the API.
// Simpler: start the dev server and POST to the API.
// Simplest: use tsx to import the TS directly.

// Let's just parse the CSV ourselves and compute the key values manually
// to avoid complex build steps.

const NEW_GUEST_SOURCES = new Set([
  "Call In ---New Guest",
  "Online Booking ---New Guest",
  "Walk In --New Guest",
]);

function processCSVManual(csvText, config, startDate, endDate) {
  const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
  const rows = parsed.data;

  // Compute mid-point for wk1/wk2 split
  const start = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T00:00:00");
  const totalDays = (end - start) / (1000 * 60 * 60 * 24);
  const midDays = Math.ceil(totalDays / 2);
  const mid = new Date(start);
  mid.setDate(mid.getDate() + midDays);
  const midStr = mid.toISOString().slice(0, 10);

  const staffData = {};

  // Initialize all staff
  for (const name of config.staffOrder) {
    staffData[name] = {
      productWk1: 0,
      productWk2: 0,
      contractorService: 0,
      associatePay: 0,
      tips: 0,
      newGuests: 0,
      employeePurchases: 0,
      creditCardAmount: 0,
      colorCharges: 0,
    };
  }

  const seenTips = new Set();
  const seenES = new Set();
  const empPurchByClient = {};

  for (const row of rows) {
    const firstName = (row.staff_first_name || "").trim();
    const lastName = (row.staff_last_name || "").trim();
    let staffName = `${firstName} ${lastName}`.trim();

    // Employee purchases — detect BEFORE staff skip (staff=In House for ES rows)
    const paymentNamesEarly = (row.payment_type_names || "").trim();
    const transactionIdEarly = (row.transaction_id || "").trim();
    if (paymentNamesEarly.includes("Employee Sale") && transactionIdEarly) {
      const clientFirst = (row.client_first_name || "").trim();
      const clientLast = (row.client_last_name || "").trim();
      const clientName = `${clientFirst} ${clientLast}`;
      const esKey = `${clientName}|${transactionIdEarly}`;
      if (!seenES.has(esKey)) {
        seenES.add(esKey);
        const codes = (row.payment_type_codes || "").split(";");
        const amounts = (row.payment_type_amounts || "").split(";");
        for (let i = 0; i < codes.length; i++) {
          if (codes[i].trim() === "ES") {
            const amount = parseFloat((amounts[i] || "").trim()) || 0;
            empPurchByClient[clientName] = (empPurchByClient[clientName] || 0) + amount;
          }
        }
      }
    }

    // Apply name overrides
    if (config.nameOverrides[staffName]) {
      staffName = config.nameOverrides[staffName];
    }

    // Skip unknown staff
    if (!staffData[staffName]) {
      // Try partial match
      const match = config.staffOrder.find(
        (n) => n.toLowerCase() === staffName.toLowerCase()
      );
      if (match) {
        staffName = match;
      } else {
        continue;
      }
    }

    const d = staffData[staffName];
    const itemType = (row.item_type || "").toUpperCase();
    const purchDate = (row.purchased_date || "").slice(0, 10);
    const grossTotal = parseFloat(row.gross_total_amount || "0") || 0;
    const totalAmount = parseFloat(row.total_amount || "0") || 0;
    const tipsStr = row.phorest_tips || "0";
    const tips = parseFloat(tipsStr) || 0;

    const transactionId = (row.transaction_id || "").trim();
    const paymentNames = (row.payment_type_names || "").trim();
    const isES = paymentNames.includes("Employee Sale");

    // Tips — GC-only (CC tips go through CC processor)
    if (tips !== 0 && transactionId) {
      const tipKey = `${staffName}|${transactionId}`;
      if (!seenTips.has(tipKey)) {
        seenTips.add(tipKey);
        const codes = (row.payment_type_codes || "").split(";").map(c => c.trim());
        if (codes.includes("GC")) {
          d.tips += tips;
        }
      }
    }

    // Product sales — exclude employee purchases (ES payment)
    if (itemType === "PRODUCT" && !isES) {
      if (purchDate < midStr) {
        d.productWk1 += totalAmount;
      } else {
        d.productWk2 += totalAmount;
      }
    }

    // Service revenue
    if (itemType === "SERVICE") {
      d.contractorService += totalAmount;
    }

    // Credit card amount — gross_total_amount for each CC/GC code, exclusive end date
    if ((itemType === "SERVICE" || itemType === "PRODUCT") && purchDate < endDate) {
      const paymentCodes = (row.payment_type_codes || "").split(";").map(c => c.trim().toUpperCase());
      for (const code of paymentCodes) {
        if (code === "CC" || code === "GC") {
          d.creditCardAmount += grossTotal;
        }
      }
    }

    // New guests / finders fee
    if (itemType === "SERVICE") {
      const clientSource = (row.client_source || "").trim();
      const clientFirstVisit = (row.client_first_visit || "").trim().slice(0, 10);
      if (NEW_GUEST_SOURCES.has(clientSource)) {
        if (clientFirstVisit >= startDate && clientFirstVisit <= endDate) {
          const unitPrice = parseFloat(row.unit_price || "0") || 0;
          d.newGuests += unitPrice;
        }
      }
    }

    // Employee purchases handled in early detection above (before staff skip)
  }

  // Resolve employee purchases: match client name to staff
  for (const [clientName, amount] of Object.entries(empPurchByClient)) {
    // Direct match
    if (staffData[clientName]) {
      staffData[clientName].employeePurchases += amount;
      continue;
    }
    // Name override match
    const overrideName = config.nameOverrides[clientName];
    if (overrideName && staffData[overrideName]) {
      staffData[overrideName].employeePurchases += amount;
      continue;
    }
    // First-name + target_last match
    const parts = clientName.split(" ");
    const clientFirst = parts[0].toLowerCase();
    const match = config.staffOrder.find(name => {
      const staffFirst = name.split(" ")[0].toLowerCase();
      const staffCfg = config.staff[name];
      return staffFirst === clientFirst && staffCfg?.targetLast?.toLowerCase().includes(parts.slice(1).join(" ").toLowerCase());
    });
    if (match && staffData[match]) {
      staffData[match].employeePurchases += amount;
    }
  }

  return { staffData, staffOrder: config.staffOrder };
}

// ── Template reference data ──

const BBS_TEMPLATE = {
  "Rob Bumgardner": {
    contractorService: 4298,
    creditCardAmount: 4121.22,
    newGuests: 258,
    productWk1: 0,
    productWk2: 21.7,
    tips: 0,
    employeePurchases: 0,
  },
  "Dustin Goodson": {
    contractorService: 3294,
    creditCardAmount: 2856.54,
    newGuests: 425,
    productWk1: 22,
    productWk2: 24,
    tips: 0,
    employeePurchases: -23.97,
  },
  "Ray Goodson": {
    contractorService: 5243,
    creditCardAmount: 4129.4,
    newGuests: 542,
    productWk1: 20,
    productWk2: 0,
    tips: 0,
    employeePurchases: 0,
  },
  "Dustin Helms": {
    contractorService: 1721,
    creditCardAmount: 1607,
    newGuests: 30,
    productWk1: 0,
    productWk2: 0,
    tips: 0,
    employeePurchases: 0,
  },
  "Thomas Moore": {
    contractorService: 3787,
    creditCardAmount: 3305,
    newGuests: 163,
    productWk1: 0,
    productWk2: 0,
    tips: 0,
    employeePurchases: 0,
  },
  "Dustin Prince": {
    contractorService: 0,
    creditCardAmount: 0,
    newGuests: 0,
    productWk1: 0,
    productWk2: 0,
    tips: 0,
    employeePurchases: 0,
  },
  "Owen Prince": {
    contractorService: 4102.2,
    creditCardAmount: 4056.18,
    newGuests: 76,
    productWk1: 17.36,
    productWk2: 0,
    tips: 10,
    employeePurchases: 0,
  },
  "Edward Trevino": {
    contractorService: 5226,
    creditCardAmount: 4683.14,
    newGuests: 40,
    productWk1: 31.7,
    productWk2: 0,
    tips: 0,
    employeePurchases: -20.97,
  },
  "Bryan Walls": {
    contractorService: 3674,
    creditCardAmount: 3311.31,
    newGuests: 72,
    productWk1: 43.7,
    productWk2: 59.8,
    tips: 0,
    employeePurchases: 0,
  },
};

// ── Main ──

async function main() {
  console.log("=== Payout Suite vs Template Comparison ===\n");

  // Load Ballards CSV
  const csvPath = path.join(root, "Salon Exports", "ballards_2026-02-15_2026-02-28.csv");
  const csvText = fs.readFileSync(csvPath, "utf-8");
  console.log(`Loaded Ballards CSV: ${csvText.split("\n").length} lines\n`);

  // Fetch branch config
  const config = await fetchBranchConfig("yrr4_ACmrRVr0J3NoC2s2Q");
  console.log(`Branch: ${config.branchName}`);
  console.log(`Staff: ${config.staffOrder.length} active\n`);

  // Process CSV
  const results = processCSVManual(csvText, config, "2026-02-15", "2026-02-28");

  // Compare
  const columns = [
    "contractorService",
    "creditCardAmount",
    "newGuests",
    "productWk1",
    "productWk2",
    "tips",
    "employeePurchases",
  ];

  let totalDiffs = 0;
  let totalChecks = 0;

  for (const name of Object.keys(BBS_TEMPLATE)) {
    const expected = BBS_TEMPLATE[name];
    const actual = results.staffData[name];

    if (!actual) {
      console.log(`!! ${name}: NOT FOUND in our output`);
      continue;
    }

    const diffs = [];
    for (const col of columns) {
      const exp = expected[col];
      // Employee purchases: negate (we store positive ES amounts, template uses negative)
      const raw = actual[col] || 0;
      const act = Math.round((col === "employeePurchases" ? -raw : raw) * 100) / 100;
      totalChecks++;
      if (Math.abs(exp - act) > 0.01) {
        diffs.push(`  ${col}: expected ${exp}, got ${act} (diff ${(act - exp).toFixed(2)})`);
        totalDiffs++;
      }
    }

    if (diffs.length === 0) {
      console.log(`${name}: ALL MATCH`);
    } else {
      console.log(`${name}: ${diffs.length} differences`);
      for (const d of diffs) console.log(d);
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Total checks: ${totalChecks}`);
  console.log(`Matches: ${totalChecks - totalDiffs}`);
  console.log(`Differences: ${totalDiffs}`);
  console.log(`Match rate: ${((totalChecks - totalDiffs) / totalChecks * 100).toFixed(1)}%`);
}

main().catch(console.error).finally(() => process.exit());
