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

export type EAStaffStatus = 'active' | 'onboarding' | 'inactive' | 'terminated';

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
  email: string | null;
  status: EAStaffStatus;
  supabase_auth_uid: string | null;
  onboarding_template_id: string | null;
  onboarding_envelope_id: string | null;
  onboarding_signing_token: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export type EAStaffInsert = Omit<EAStaff, "id" | "created_at" | "status" | "supabase_auth_uid" | "onboarding_template_id" | "onboarding_envelope_id" | "onboarding_signing_token"> & {
  status?: EAStaffStatus;
  supabase_auth_uid?: string | null;
  onboarding_template_id?: string | null;
  onboarding_envelope_id?: string | null;
  onboarding_signing_token?: string | null;
};
export type EAStaffUpdate = Partial<Omit<EAStaff, "id" | "created_at" | "branch_id">>;

export interface OnboardEmployeeRequest {
  display_name: string;
  email: string;
  branch_id: string;
  template_id: string;
  target_first: string;
  target_last: string;
  station_lease: number;
  financial_services: number;
  phorest_fee: number;
  refreshment: number;
  associate_pay?: number;
  supervisor?: string;
}

export interface EANameOverride {
  id: string;
  branch_id: string;
  phorest_name: string;
  staff_display_name: string;
}

export type EANameOverrideInsert = Omit<EANameOverride, "id">;
