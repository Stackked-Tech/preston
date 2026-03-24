/**
 * Payout Suite — Branch & Staff Configuration
 *
 * Interfaces, pay-period helpers, and DB-backed config loader.
 * All staff/branch data now lives in Supabase (ea_branches, ea_staff, ea_name_overrides).
 */

import { supabase } from "./supabase";

export interface StaffMember {
  targetFirst: string;
  targetLast: string;
  internalId: number;
  stationLease: number;
  financialServices: number;
  phorestFee: number;
  refreshment: number;
  associatePay?: number | null;
  supervisor?: string | null;
}

export interface BranchConfig {
  branchId: string;
  name: string;
  abbreviation: string;
  subsidiaryId: number;
  account: number;
  staffConfig: Record<string, StaffMember>;
  staffOrder: string[];
  employeePurchaseNameMap: Record<string, string>;
}

export interface PayPeriodConfig {
  periodStart: string; // YYYY-MM-DD
  periodEnd: string;
  week1End: string;
  payDate: string;
  postingPeriod: string;
  payPeriodLabel: string;
  subsidiaryId: number;
  account: number;
}

// New guest qualifying client sources
export const NEW_GUEST_SOURCES = new Set([
  "Call In ---New Guest",
  "Online Booking ---New Guest",
  "Walk In --New Guest",
]);

/**
 * Compute pay date: the Thursday following the period end.
 */
export function computePayDate(periodEnd: string): string {
  const d = new Date(periodEnd + "T12:00:00");
  // Advance to next Thursday (day 4)
  do {
    d.setDate(d.getDate() + 1);
  } while (d.getDay() !== 4);
  return d.toISOString().split("T")[0];
}

/**
 * Compute all derived pay period values from start/end dates.
 */
export function computePayPeriodConfig(
  periodStart: string,
  periodEnd: string,
  subsidiaryId: number,
  account: number
): PayPeriodConfig {
  // Week 1 ends on the first Saturday on or after start date
  const start = new Date(periodStart + "T12:00:00");
  const d = new Date(start);
  while (d.getDay() !== 6) {
    // 6 = Saturday
    d.setDate(d.getDate() + 1);
  }
  const week1End = d.toISOString().split("T")[0];

  // Posting period = 1st of the month
  const postingPeriod = periodStart.slice(0, 7) + "-01";

  // Pay period label
  const startDate = new Date(periodStart + "T12:00:00");
  const endDate = new Date(periodEnd + "T12:00:00");
  const payPeriodLabel = `${startDate.getMonth() + 1}/${startDate.getDate()}-${endDate.getDate()}/${endDate.getFullYear()}`;

  const payDate = computePayDate(periodEnd);

  return {
    periodStart,
    periodEnd,
    week1End,
    payDate,
    postingPeriod,
    payPeriodLabel,
    subsidiaryId,
    account,
  };
}

/** Convert branch name to URL-safe slug for storage paths */
export function branchSlug(branchId: string, branches?: BranchConfig[]): string {
  const branch = branches?.find((b) => b.branchId === branchId);
  if (!branch) return branchId;
  return branch.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// ═══════════════════════════════════════════════════════════════════════════════
// DB-BACKED CONFIG (compatibility layer — same BranchConfig[] shape)
// ═══════════════════════════════════════════════════════════════════════════════

export async function fetchBranchConfigs(): Promise<BranchConfig[]> {
  const [branchRes, staffRes, overrideRes] = await Promise.all([
    supabase.from("ea_branches").select("*").order("display_order"),
    supabase.from("ea_staff").select("*").eq("is_active", true).order("sort_order"),
    supabase.from("ea_name_overrides").select("*"),
  ]);

  if (branchRes.error) throw branchRes.error;
  if (staffRes.error) throw staffRes.error;
  if (overrideRes.error) throw overrideRes.error;

  const branches = branchRes.data || [];
  const allStaff = staffRes.data || [];
  const allOverrides = overrideRes.data || [];

  return branches.map((b) => {
    const branchStaff = allStaff.filter((s) => s.branch_id === b.branch_id);
    const branchOverrides = allOverrides.filter((o) => o.branch_id === b.branch_id);

    const staffConfig: Record<string, StaffMember> = {};
    const staffOrder: string[] = [];

    for (const s of branchStaff) {
      staffConfig[s.display_name] = {
        targetFirst: s.target_first,
        targetLast: s.target_last,
        internalId: s.internal_id,
        stationLease: Number(s.station_lease),
        financialServices: Number(s.financial_services),
        phorestFee: Number(s.phorest_fee),
        refreshment: Number(s.refreshment),
        associatePay: s.associate_pay != null ? Number(s.associate_pay) : null,
        supervisor: s.supervisor,
      };
      staffOrder.push(s.display_name);
    }

    const employeePurchaseNameMap: Record<string, string> = {};
    for (const o of branchOverrides) {
      employeePurchaseNameMap[o.phorest_name] = o.staff_display_name;
    }

    return {
      branchId: b.branch_id,
      name: b.name,
      abbreviation: b.abbreviation,
      subsidiaryId: b.subsidiary_id,
      account: b.account,
      staffConfig,
      staffOrder,
      employeePurchaseNameMap,
    };
  });
}
