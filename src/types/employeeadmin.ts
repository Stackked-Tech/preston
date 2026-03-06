// Employee Administration Types
// Tables use ea_ prefix

export interface EABranch {
  id: string;
  branch_id: string;
  name: string;
  abbreviation: string;
  subsidiary_id: number;
  account: number;
  display_order: number;
  created_at: string;
}

export interface EAStaff {
  id: string;
  branch_id: string;
  display_name: string;
  target_first: string;
  target_last: string;
  internal_id: number;
  station_lease: number;
  financial_services: number;
  phorest_fee: number;
  refreshment: number;
  associate_pay: number | null;
  supervisor: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export type EAStaffInsert = Omit<EAStaff, "id" | "created_at">;
export type EAStaffUpdate = Partial<Omit<EAStaff, "id" | "created_at" | "branch_id">>;

export interface EANameOverride {
  id: string;
  branch_id: string;
  phorest_name: string;
  staff_display_name: string;
}

export type EANameOverrideInsert = Omit<EANameOverride, "id">;
