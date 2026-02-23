export interface TCCompany {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export type TCCompanyInsert = Omit<TCCompany, "id" | "created_at">;

export interface TCEmployee {
  id: string;
  employee_number: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  company_id: string | null;
  billable_rate: number;
  created_at: string;
}

export type TCEmployeeInsert = Omit<TCEmployee, "id" | "created_at">;
export type TCEmployeeUpdate = Partial<Omit<TCEmployee, "id" | "created_at">>;

export interface TCJob {
  id: string;
  name: string;
  is_active: boolean;
  company_id: string | null;
  created_at: string;
}

export type TCJobInsert = Omit<TCJob, "id" | "created_at">;

export interface TCTimeEntry {
  id: string;
  employee_id: string;
  job_id: string | null;
  clock_in: string;
  clock_out: string | null;
  notes: string;
  approval_status: "pending" | "approved" | "flagged";
  approved_by: string | null;
  approved_at: string | null;
  flag_note: string | null;
  created_at: string;
}

export type TCTimeEntryInsert = Omit<TCTimeEntry, "id" | "created_at">;
export type TCTimeEntryUpdate = Partial<Omit<TCTimeEntry, "id" | "created_at">>;

export interface TCSetting {
  id: string;
  setting_key: string;
  setting_value: Record<string, unknown>;
  updated_at: string;
}

export interface TCLocationSettings {
  name: string;
  lat: number | null;
  lng: number | null;
  radius_meters: number | null;
}

export interface TCDailyEntry {
  employee: TCEmployee;
  entry: TCTimeEntry;
  hours: number;
  isStale: boolean;
  jobName: string | null;
}

export interface TCWeeklySummary {
  employee: TCEmployee;
  dailyHours: number[];
  weeklyTotal: number;
}

export interface TCMonthlySummary {
  employee: TCEmployee;
  weeklyHours: number[];
  monthlyTotal: number;
}
