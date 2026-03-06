// Employee Portal Types

import type { User } from "@supabase/supabase-js";

/** Authenticated employee session state */
export interface EmployeeSession {
  user: User;
  onboardingComplete: boolean;
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
