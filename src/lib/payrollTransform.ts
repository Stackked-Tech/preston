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
  purchase_time?: string;
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
// NAME RESOLUTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a name resolver that handles Phorest middle initials.
 * E.g., "Dustin G Goodson" → "Dustin Goodson" if "Dustin Goodson" is in staffConfig.
 */
export function createStaffNameResolver(
  staffNames: string[]
): (rawName: string) => string | null {
  const exactSet = new Set(staffNames);

  const normalizedMap = new Map<string, string>();
  for (const displayName of staffNames) {
    const parts = displayName.split(" ");
    if (parts.length >= 2) {
      const key = `${parts[0].toLowerCase()} ${parts[parts.length - 1].toLowerCase()}`;
      if (normalizedMap.has(key)) {
        normalizedMap.set(key, ""); // ambiguous
      } else {
        normalizedMap.set(key, displayName);
      }
    }
  }

  const cache = new Map<string, string>();

  return (rawName: string): string | null => {
    if (exactSet.has(rawName)) return rawName;
    if (cache.has(rawName)) return cache.get(rawName)!;
    const parts = rawName.split(" ");
    if (parts.length >= 2) {
      const key = `${parts[0].toLowerCase()} ${parts[parts.length - 1].toLowerCase()}`;
      const match = normalizedMap.get(key);
      if (match) {
        cache.set(rawName, match);
        return match;
      }
    }
    return null;
  };
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

  // Build normalized name lookup: "firstname lastname" → display_name
  // Handles Phorest middle initials (e.g. "Dustin G Goodson" → "Dustin Goodson")
  const normalizedNameMap = new Map<string, string>();
  for (const displayName of Object.keys(staffConfig)) {
    const parts = displayName.split(" ");
    if (parts.length >= 2) {
      const key = `${parts[0].toLowerCase()} ${parts[parts.length - 1].toLowerCase()}`;
      // Only use if unambiguous (no two staff share first+last)
      if (normalizedNameMap.has(key)) {
        normalizedNameMap.set(key, ""); // mark ambiguous
      } else {
        normalizedNameMap.set(key, displayName);
      }
    }
  }
  const resolvedNameCache = new Map<string, string>();

  function resolveStaffName(rawName: string): string | null {
    // Exact match
    if (rawName in staffData) return rawName;
    // Check cache
    if (resolvedNameCache.has(rawName)) return resolvedNameCache.get(rawName)!;
    // Fuzzy: first word of first name + last name
    const parts = rawName.split(" ");
    if (parts.length >= 2) {
      const key = `${parts[0].toLowerCase()} ${parts[parts.length - 1].toLowerCase()}`;
      const match = normalizedNameMap.get(key);
      if (match) {
        resolvedNameCache.set(rawName, match);
        warnings.push(`Staff name "${rawName}" in CSV matched to "${match}" (middle initial ignored)`);
        return match;
      }
    }
    return null;
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

  // Track new-guest service candidates: clientKey → { staffName, unitPrice, purchaseTime }[]
  const newGuestCandidates = new Map<string, { staffName: string; unitPrice: number; purchaseTime: string }[]>();

  for (const row of parsed.data) {
    const staffFirst = (row.staff_first_name || "").trim();
    const staffLast = (row.staff_last_name || "").trim();
    const rawStaffName = `${staffFirst} ${staffLast}`;
    const itemType = (row.item_type || "").trim();
    const transactionId = (row.transaction_id || "").trim();
    const purchasedDate = parseDate(row.purchased_date);

    const staffName = resolveStaffName(rawStaffName) || rawStaffName;
    const isKnownStaff = staffName in staffData;

    // ── Product Sales (wk1/wk2) ──
    // Includes Employee Sale products (they also appear in Employee Purchases as a deduction)
    if (itemType === "PRODUCT" && isKnownStaff && purchasedDate) {
      const total = parseFloat(row.total_amount || "0") || 0;
      if (purchasedDate <= week1End) {
        staffData[staffName].productWk1 += total;
      } else {
        staffData[staffName].productWk2 += total;
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

    // ── New Guests (collect candidates — resolve after loop) ──
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
        const purchaseTime = (row.purchase_time || "99:99:99").trim();
        const clientKey = `${(row.client_first_name || "").trim()} ${(row.client_last_name || "").trim()}|${clientFirstVisit}`;

        if (!newGuestCandidates.has(clientKey)) {
          newGuestCandidates.set(clientKey, []);
        }
        newGuestCandidates.get(clientKey)!.push({ staffName, unitPrice, purchaseTime });
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
      if (codes && isKnownStaff) {
        if (codes.has("CC")) staffData[staffName].creditCardAmount += gross;
        if (codes.has("GC")) staffData[staffName].creditCardAmount += gross;
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

  // ── Resolve new-guest candidates: credit only the earliest stylist per client ──
  for (const [clientKey, candidates] of newGuestCandidates) {
    // Sort by purchase_time ascending, then staff name for deterministic tie-breaking
    candidates.sort((a, b) => {
      const timeCmp = a.purchaseTime.localeCompare(b.purchaseTime);
      if (timeCmp !== 0) return timeCmp;
      return a.staffName.localeCompare(b.staffName);
    });

    // The earliest stylist gets ALL the new-guest credit for this client
    const winner = candidates[0].staffName;
    const totalUnitPrice = candidates
      .filter((c) => c.staffName === winner)
      .reduce((sum, c) => sum + c.unitPrice, 0);

    if (staffData[winner]) {
      staffData[winner].newGuests += totalUnitPrice;
    }

    // Warn if multiple stylists had the exact same timestamp
    const uniqueStylists = new Set(candidates.map((c) => c.staffName));
    if (uniqueStylists.size > 1) {
      const [clientName] = clientKey.split("|");
      const tiedStylists = candidates.filter((c) => c.purchaseTime === candidates[0].purchaseTime).map((c) => c.staffName);
      if (new Set(tiedStylists).size > 1) {
        warnings.push(
          `New guest "${clientName}" had same timestamp for ${[...new Set(tiedStylists)].join(" & ")} — credited ${winner} (alphabetical tie-break)`
        );
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
    d.employeePurchases = -Math.round(d.employeePurchases * 100) / 100;
    d.creditCardAmount = Math.round(d.creditCardAmount * 100) / 100;
    d.colorCharges = Math.round(d.colorCharges * 100) / 100;
  }

  // Remove staff with all-zero data (no activity in this period)
  const activeStaffOrder = staffOrder.filter((name) => {
    const d = staffData[name];
    if (!d) return false;
    return (
      d.productWk1 !== 0 ||
      d.productWk2 !== 0 ||
      d.contractorService !== 0 ||
      d.associatePay !== 0 ||
      d.tips !== 0 ||
      d.newGuests !== 0 ||
      d.employeePurchases !== 0 ||
      d.creditCardAmount !== 0 ||
      d.colorCharges !== 0
    );
  });
  for (const name of staffOrder) {
    if (!activeStaffOrder.includes(name)) {
      delete staffData[name];
    }
  }

  return {
    branchId: branch.branchId,
    branchName: branch.name,
    abbreviation: branch.abbreviation,
    staffData,
    staffOrder: activeStaffOrder,
    warnings,
  };
}
