export interface TCEmployee {
  id: string;
  employee_number: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  created_at: string;
}

export type TCEmployeeInsert = Omit<TCEmployee, "id" | "created_at">;
export type TCEmployeeUpdate = Partial<Omit<TCEmployee, "id" | "created_at">>;

export interface TCTimeEntry {
  id: string;
  employee_id: string;
  clock_in: string;
  clock_out: string | null;
  notes: string;
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

export interface TCOvertimeSettings {
  daily_threshold: number;
  weekly_threshold: number;
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
  isOvertime: boolean;
  isStale: boolean;
}

export interface TCWeeklySummary {
  employee: TCEmployee;
  dailyHours: number[]; // Mon-Sun
  weeklyTotal: number;
  isWeeklyOvertime: boolean;
  dailyOvertimeFlags: boolean[];
}

export interface TCMonthlySummary {
  employee: TCEmployee;
  weeklyHours: number[];
  monthlyTotal: number;
}
