/**
 * Phorest CSV → Payroll Data Transformer
 *
 * TypeScript port of phorest_to_netsuite.py process_csv().
 * Parses Phorest transaction CSV rows and computes per-staff payroll values.
 */

import Papa from "papaparse";
import type { BranchConfig, StaffMember } from "./payrollConfig";
import { NEW_GUEST_SOURCES } from "./payrollConfig";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface StaffPayrollData {
  productWk1: number;
  productWk2: number;
  contractorService: number;
  associatePay: number;
  tips: number;
  newGuests: number;
  employeePurchases: number;
  creditCardAmount: number;
  colorCharges: number;
}

export interface PayrollResults {
  branchId: string;
  branchName: string;
  abbreviation: string;
  staffData: Record<string, StaffPayrollData>;
  staffOrder: string[];
  warnings: string[];
}

interface PhorestRow {
  staff_first_name?: string;
  staff_last_name?: string;
  staff_category_name?: string;
  item_type?: string;
  transaction_id?: string;
  purchased_date?: string;
  total_amount?: string;
  unit_price?: string;
  client_source?: string;
  client_first_visit?: string;
  client_first_name?: string;
  client_last_name?: string;
  payment_type_codes?: string;
  payment_type_amounts?: string;
  payment_type_names?: string;
  phorest_tips?: string;
  gross_total_amount?: string;
  [key: string]: string | undefined;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DATE PARSING
// ═══════════════════════════════════════════════════════════════════════════════

function parseDate(dateStr: string | undefined): string | null {
  if (!dateStr || dateStr.trim() === "") return null;
  const s = dateStr.trim();

  // Try YYYY-MM-DD HH:MM:SS or YYYY-MM-DD
  const isoMatch = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) return isoMatch[1];

  // Try M/D/YYYY
  const usMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (usMatch) {
    const [, m, d, y] = usMatch;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // Try M/D/YY
  const usShortMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (usShortMatch) {
    const [, m, d, yy] = usShortMatch;
    const fullYear = parseInt(yy) > 50 ? `19${yy}` : `20${yy}`;
    return `${fullYear}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CSV PROCESSING
// ═══════════════════════════════════════════════════════════════════════════════

export function processCSV(
  csvText: string,
  branch: BranchConfig,
  periodStart: string,
  periodEnd: string,
  week1End: string
): PayrollResults {
  const { staffConfig, staffOrder, employeePurchaseNameMap } = branch;
  const warnings: string[] = [];

  // Initialize results for all configured staff
  const staffData: Record<string, StaffPayrollData> = {};
  for (const name of Object.keys(staffConfig)) {
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

  // Parse CSV
  const parsed = Papa.parse<PhorestRow>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  if (parsed.errors.length > 0) {
    warnings.push(
      `CSV parse warnings: ${parsed.errors.length} issues encountered`
    );
  }

  // Deduplication tracking
  const seenTips = new Set<string>(); // "staffName|transactionId"
  const seenES = new Set<string>(); // "clientName|transactionId"

  // Employee purchase amounts by client name (resolve to staff after)
  const empPurchasesByClient: Record<string, number> = {};

  // Build per-transaction payment code lookup (first pass)
  const txnPaymentCodes = new Map<string, Set<string>>();
  for (const row of parsed.data) {
    const tid = (row.transaction_id || "").trim();
    if (!tid || txnPaymentCodes.has(tid)) continue;
    const codes = new Set(
      (row.payment_type_codes || "")
        .trim()
        .split(";")
        .map((c) => c.trim())
        .filter(Boolean)
    );
    txnPaymentCodes.set(tid, codes);
  }

  for (const row of parsed.data) {
    const staffFirst = (row.staff_first_name || "").trim();
    const staffLast = (row.staff_last_name || "").trim();
    const staffName = `${staffFirst} ${staffLast}`;
    const itemType = (row.item_type || "").trim();
    const transactionId = (row.transaction_id || "").trim();
    const purchasedDate = parseDate(row.purchased_date);

    const isKnownStaff = staffName in staffData;

    // ── Product Sales (wk1/wk2) ──
    // Exclude employee purchases (ES payment code) — those go in Employee Purchases column
    if (itemType === "PRODUCT" && isKnownStaff && purchasedDate) {
      const paymentNames = (row.payment_type_names || "").trim();
      if (!paymentNames.includes("Employee Sale")) {
        const total = parseFloat(row.total_amount || "0") || 0;
        if (purchasedDate <= week1End) {
          staffData[staffName].productWk1 += total;
        } else {
          staffData[staffName].productWk2 += total;
        }
      }
    }

    // ── Service Totals — Col K (contractor) or Col L (associate) ──
    if (itemType === "SERVICE" && isKnownStaff) {
      const total = parseFloat(row.total_amount || "0") || 0;
      const cfg = staffConfig[staffName];
      const isAssociate = cfg.supervisor !== undefined && cfg.supervisor !== null;
      if (isAssociate) {
        staffData[staffName].associatePay += total;
      } else {
        staffData[staffName].contractorService += total;
      }
    }

    // ── Tips (only GC transactions, deduplicate by transaction_id) ──
    if (isKnownStaff && transactionId) {
      const tipKey = `${staffName}|${transactionId}`;
      if (!seenTips.has(tipKey)) {
        seenTips.add(tipKey);
        const tips = parseFloat(row.phorest_tips || "0") || 0;
        if (tips > 0) {
          const codes = (row.payment_type_codes || "")
            .trim()
            .split(";")
            .map((c) => c.trim());
          if (codes.includes("GC")) {
            staffData[staffName].tips += tips;
          }
        }
      }
    }

    // ── New Guests ──
    if (itemType === "SERVICE" && isKnownStaff) {
      const clientSource = (row.client_source || "").trim();
      const clientFirstVisit = parseDate(row.client_first_visit);
      if (
        NEW_GUEST_SOURCES.has(clientSource) &&
        clientFirstVisit &&
        clientFirstVisit >= periodStart &&
        clientFirstVisit <= periodEnd
      ) {
        const unitPrice = parseFloat(row.unit_price || "0") || 0;
        staffData[staffName].newGuests += unitPrice;
      }
    }

    // ── Credit Card Amount (Col Q) ──
    // Sum gross_total_amount for SERVICE/PRODUCT in CC and GC transactions.
    // Uses exclusive end date (purchased_date < periodEnd).
    // CC;GC split transactions count in both sums (intentional double-count).
    if (
      (itemType === "SERVICE" || itemType === "PRODUCT") &&
      purchasedDate &&
      purchasedDate >= periodStart &&
      purchasedDate < periodEnd
    ) {
      const gross = parseFloat(row.gross_total_amount || "0") || 0;
      const codes = txnPaymentCodes.get(transactionId);
      if (codes) {
        const staffKey = staffName in staffData ? staffName : null;
        if (staffKey) {
          if (codes.has("CC")) staffData[staffKey].creditCardAmount += gross;
          if (codes.has("GC")) staffData[staffKey].creditCardAmount += gross;
        }
      }
    }

    // ── Employee Purchases ──
    const paymentNames = (row.payment_type_names || "").trim();
    if (paymentNames.includes("Employee Sale") && transactionId) {
      const clientFirst = (row.client_first_name || "").trim();
      const clientLast = (row.client_last_name || "").trim();
      const clientName = `${clientFirst} ${clientLast}`;
      const esKey = `${clientName}|${transactionId}`;
      if (!seenES.has(esKey)) {
        seenES.add(esKey);
        const codes = (row.payment_type_codes || "").split(";");
        const amounts = (row.payment_type_amounts || "").split(";");
        for (let i = 0; i < codes.length; i++) {
          if (codes[i].trim() === "ES") {
            const amount = parseFloat((amounts[i] || "").trim()) || 0;
            empPurchasesByClient[clientName] =
              (empPurchasesByClient[clientName] || 0) + amount;
          }
        }
      }
    }
  }

  // ── Resolve employee purchase client names to staff names ──
  for (const [clientName, amount] of Object.entries(empPurchasesByClient)) {
    // 1) Check explicit override map
    if (employeePurchaseNameMap[clientName]) {
      const staff = employeePurchaseNameMap[clientName];
      if (staffData[staff]) {
        staffData[staff].employeePurchases += amount;
        continue;
      }
    }

    // 2) Direct match to Phorest name
    if (staffData[clientName]) {
      staffData[clientName].employeePurchases += amount;
      continue;
    }

    // 3) First-name match + client last name in target_last
    let matched = false;
    const clientParts = clientName.split(" ");
    if (clientParts.length > 0) {
      const clientFirstLower = clientParts[0].toLowerCase();
      const clientLastPart = clientParts.slice(1).join(" ").toLowerCase();
      for (const [phorestName, cfg] of Object.entries(staffConfig)) {
        const phorestFirst = phorestName.split(" ")[0].toLowerCase();
        if (
          phorestFirst === clientFirstLower &&
          clientLastPart &&
          cfg.targetLast.toLowerCase().includes(clientLastPart)
        ) {
          staffData[phorestName].employeePurchases += amount;
          matched = true;
          break;
        }
      }
    }

    if (!matched) {
      warnings.push(
        `Could not match employee purchase client '${clientName}' to any staff member (amount: $${amount.toFixed(2)})`
      );
    }
  }

  // Round all values to 2 decimal places
  for (const name of Object.keys(staffData)) {
    const d = staffData[name];
    d.productWk1 = Math.round(d.productWk1 * 100) / 100;
    d.productWk2 = Math.round(d.productWk2 * 100) / 100;
    d.contractorService = Math.round(d.contractorService * 100) / 100;
    d.associatePay = Math.round(d.associatePay * 100) / 100;
    d.tips = Math.round(d.tips * 100) / 100;
    d.newGuests = Math.round(d.newGuests * 100) / 100;
    d.employeePurchases = Math.round(d.employeePurchases * 100) / 100;
    d.creditCardAmount = Math.round(d.creditCardAmount * 100) / 100;
    d.colorCharges = Math.round(d.colorCharges * 100) / 100;
  }

  return {
    branchId: branch.branchId,
    branchName: branch.name,
    abbreviation: branch.abbreviation,
    staffData,
    staffOrder,
    warnings,
  };
}
