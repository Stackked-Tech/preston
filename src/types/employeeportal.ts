// Employee Portal Types

import type { User } from "@supabase/supabase-js";

/** Authenticated employee session state */
export interface EmployeeSession {
  user: User;
  onboardingComplete: boolean;
}

/** Full employee record for onboarding routing */
export interface EmployeeRecord {
  id: string;
  branch_id: string;
  display_name: string;
  status: 'active' | 'onboarding' | 'inactive' | 'terminated';
  onboarding_envelope_id: string | null;
  onboarding_signing_token: string | null;
  ea_branches: { name: string } | null;
}

/** Fee data for a single branch assignment */
export interface EmployeeFeeRecord {
  id: string;
  branch_id: string;
  branch_name: string;
  display_name: string;
  station_lease: number;
  financial_services: number;
  phorest_fee: number;
  refreshment: number;
  associate_pay: number | null;
  supervisor: string | null;
}
