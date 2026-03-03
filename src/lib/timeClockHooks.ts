"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase, isSupabaseConfigured } from "./supabase";
import type {
  TCCompany,
  TCCompanyInsert,
  TCEmployee,
  TCEmployeeInsert,
  TCTimeEntry,
  TCLocationSettings,
  TCJob,
} from "@/types/timeclock";

// ─── Companies ──────────────────────────────────────────

export function useCompanies() {
  const [companies, setCompanies] = useState<TCCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCompanies = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setError("Supabase not configured");
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const { data, error: err } = await supabase
        .from("tc_companies")
        .select("*")
        .order("name", { ascending: true });
      if (err) throw err;
      setCompanies((data || []) as TCCompany[]);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch companies");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  const addCompany = async (name: string): Promise<TCCompany> => {
    const insert: TCCompanyInsert = { name, is_active: true };
    const { data, error } = await supabase
      .from("tc_companies")
      .insert(insert)
      .select()
      .single();
    if (error) throw error;
    const created = data as TCCompany;
    setCompanies((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
    return created;
  };

  const toggleActive = async (id: string, isActive: boolean): Promise<void> => {
    const { error } = await supabase
      .from("tc_companies")
      .update({ is_active: isActive })
      .eq("id", id);
    if (error) throw error;
    setCompanies((prev) =>
      prev.map((c) => (c.id === id ? { ...c, is_active: isActive } : c))
    );
  };

  const activeCompanies = companies.filter((c) => c.is_active);

  return { companies, activeCompanies, loading, error, refetch: fetchCompanies, addCompany, toggleActive };
}

// ─── Employees ───────────────────────────────────────────

export function useEmployees() {
  const [employees, setEmployees] = useState<TCEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEmployees = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setError("Supabase not configured");
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const { data, error: err } = await supabase
        .from("tc_employees")
        .select("*")
        .order("employee_number", { ascending: true });
      if (err) throw err;
      setEmployees((data || []) as TCEmployee[]);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch employees");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const addEmployee = async (
    firstName: string,
    lastName: string,
    companyId: string,
    billableRate: number
  ): Promise<TCEmployee> => {
    // Auto-generate employee number: MAX + 1, starting at 1001
    const { data: maxRow } = await supabase
      .from("tc_employees")
      .select("employee_number")
      .order("employee_number", { ascending: false })
      .limit(1);

    const maxNum = maxRow && maxRow.length > 0 ? parseInt(maxRow[0].employee_number, 10) : 1000;
    const nextNum = (isNaN(maxNum) ? 1000 : maxNum) + 1;

    const insert: TCEmployeeInsert = {
      employee_number: String(nextNum),
      first_name: firstName,
      last_name: lastName,
      is_active: true,
      company_id: companyId,
      billable_rate: billableRate,
    };

    const { data, error } = await supabase
      .from("tc_employees")
      .insert(insert)
      .select()
      .single();

    if (error) throw error;
    const created = data as TCEmployee;
    setEmployees((prev) => [...prev, created]);
    return created;
  };

  const updateEmployee = async (
    id: string,
    updates: { billable_rate?: number; company_id?: string }
  ): Promise<void> => {
    const { error } = await supabase
      .from("tc_employees")
      .update(updates)
      .eq("id", id);
    if (error) throw error;
    setEmployees((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...updates } : e))
    );
  };

  const toggleActive = async (id: string, isActive: boolean): Promise<void> => {
    const { error } = await supabase
      .from("tc_employees")
      .update({ is_active: isActive })
      .eq("id", id);
    if (error) throw error;
    setEmployees((prev) =>
      prev.map((e) => (e.id === id ? { ...e, is_active: isActive } : e))
    );
  };

  const findByNumber = (num: string): TCEmployee | undefined => {
    return employees.find((e) => e.employee_number === num && e.is_active);
  };

  return { employees, loading, error, refetch: fetchEmployees, addEmployee, updateEmployee, toggleActive, findByNumber };
}

// ─── Jobs ────────────────────────────────────────────────

export function useJobs() {
  const [jobs, setJobs] = useState<TCJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setError("Supabase not configured");
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const { data, error: err } = await supabase
        .from("tc_jobs")
        .select("*")
        .order("name", { ascending: true });
      if (err) throw err;
      setJobs((data || []) as TCJob[]);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch jobs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const addJob = async (name: string, companyId: string): Promise<TCJob> => {
    const { data, error } = await supabase
      .from("tc_jobs")
      .insert({ name, is_active: true, company_id: companyId })
      .select()
      .single();
    if (error) throw error;
    const created = data as TCJob;
    setJobs((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
    return created;
  };

  const toggleActive = async (id: string, isActive: boolean): Promise<void> => {
    const { error } = await supabase
      .from("tc_jobs")
      .update({ is_active: isActive })
      .eq("id", id);
    if (error) throw error;
    setJobs((prev) =>
      prev.map((j) => (j.id === id ? { ...j, is_active: isActive } : j))
    );
  };

  const updateJob = async (id: string, updates: { company_id?: string }): Promise<void> => {
    const { error } = await supabase
      .from("tc_jobs")
      .update(updates)
      .eq("id", id);
    if (error) throw error;
    setJobs((prev) =>
      prev.map((j) => (j.id === id ? { ...j, ...updates } : j))
    );
  };

  const getJobsByCompany = (companyId: string): TCJob[] => {
    return jobs.filter((j) => j.company_id === companyId && j.is_active);
  };

  const activeJobs = jobs.filter((j) => j.is_active);

  return { jobs, activeJobs, loading, error, refetch: fetchJobs, addJob, updateJob, toggleActive, getJobsByCompany };
}

// ─── Time Entries ────────────────────────────────────────

export function useTimeEntries() {
  const [entries, setEntries] = useState<TCTimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEntries = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setError("Supabase not configured");
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const { data, error: err } = await supabase
        .from("tc_time_entries")
        .select("*")
        .order("clock_in", { ascending: false });
      if (err) throw err;
      setEntries((data || []) as TCTimeEntry[]);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch time entries");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const getOpenEntry = (employeeId: string): TCTimeEntry | undefined => {
    return entries.find((e) => e.employee_id === employeeId && !e.clock_out);
  };

  const clockIn = async (employeeId: string, jobId?: string): Promise<TCTimeEntry> => {
    const insert: Record<string, string> = { employee_id: employeeId, clock_in: new Date().toISOString() };
    if (jobId) insert.job_id = jobId;
    const { data, error } = await supabase
      .from("tc_time_entries")
      .insert(insert)
      .select()
      .single();
    if (error) throw error;
    const created = data as TCTimeEntry;
    setEntries((prev) => [created, ...prev]);
    return created;
  };

  const clockOut = async (entryId: string): Promise<void> => {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("tc_time_entries")
      .update({ clock_out: now })
      .eq("id", entryId);
    if (error) throw error;
    setEntries((prev) =>
      prev.map((e) => (e.id === entryId ? { ...e, clock_out: now } : e))
    );
  };

  const updateEntry = async (entryId: string, updates: { clock_out?: string; notes?: string }): Promise<void> => {
    const { error } = await supabase
      .from("tc_time_entries")
      .update(updates)
      .eq("id", entryId);
    if (error) throw error;
    setEntries((prev) =>
      prev.map((e) => (e.id === entryId ? { ...e, ...updates } : e))
    );
  };

  const approveEntry = async (entryId: string, approvedBy: string): Promise<void> => {
    const now = new Date().toISOString();
    const updates = { approval_status: "approved" as const, approved_by: approvedBy, approved_at: now };
    const { error } = await supabase
      .from("tc_time_entries")
      .update(updates)
      .eq("id", entryId);
    if (error) throw error;
    setEntries((prev) =>
      prev.map((e) => (e.id === entryId ? { ...e, ...updates } : e))
    );
  };

  const flagEntry = async (entryId: string, flagNote: string): Promise<void> => {
    const updates = { approval_status: "flagged" as const, flag_note: flagNote };
    const { error } = await supabase
      .from("tc_time_entries")
      .update(updates)
      .eq("id", entryId);
    if (error) throw error;
    setEntries((prev) =>
      prev.map((e) => (e.id === entryId ? { ...e, ...updates } : e))
    );
  };

  const bulkApprove = async (entryIds: string[], approvedBy: string): Promise<void> => {
    const now = new Date().toISOString();
    const updates = { approval_status: "approved" as const, approved_by: approvedBy, approved_at: now };
    const { error } = await supabase
      .from("tc_time_entries")
      .update(updates)
      .in("id", entryIds);
    if (error) throw error;
    setEntries((prev) =>
      prev.map((e) => (entryIds.includes(e.id) ? { ...e, ...updates } : e))
    );
  };

  const batchClockIn = async (
    employeeIds: string[],
    jobId: string,
    clockIn: string,
    clockOut: string
  ): Promise<void> => {
    const inserts = employeeIds.map((employeeId) => ({
      employee_id: employeeId,
      job_id: jobId,
      clock_in: clockIn,
      clock_out: clockOut,
      approval_status: "pending" as const,
    }));
    const { data, error } = await supabase
      .from("tc_time_entries")
      .insert(inserts)
      .select();
    if (error) throw error;
    const created = (data || []) as TCTimeEntry[];
    setEntries((prev) => [...created, ...prev]);
  };

  return {
    entries,
    loading,
    error,
    refetch: fetchEntries,
    getOpenEntry,
    clockIn,
    clockOut,
    updateEntry,
    approveEntry,
    flagEntry,
    bulkApprove,
    batchClockIn,
  };
}

// ─── Settings ────────────────────────────────────────────

export function useTimeClockSettings() {
  const [location, setLocation] = useState<TCLocationSettings>({ name: "R Alexander Barn", lat: null, lng: null, radius_meters: null });
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    if (!isSupabaseConfigured) { setLoading(false); return; }
    try {
      setLoading(true);
      const { data } = await supabase.from("tc_settings").select("*");
      if (data) {
        for (const row of data) {
          if (row.setting_key === "location") setLocation(row.setting_value as unknown as TCLocationSettings);
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateLocation = async (settings: TCLocationSettings): Promise<void> => {
    const { error } = await supabase
      .from("tc_settings")
      .update({ setting_value: settings as unknown as Record<string, unknown>, updated_at: new Date().toISOString() })
      .eq("setting_key", "location");
    if (error) throw error;
    setLocation(settings);
  };

  return { location, loading, refetch: fetchSettings, updateLocation };
}

// ─── Reports ─────────────────────────────────────────────

export function useTimeClockReports(
  employees: TCEmployee[],
  entries: TCTimeEntry[],
  jobs?: TCJob[]
) {
  const getHours = (entry: TCTimeEntry): number => {
    const start = new Date(entry.clock_in).getTime();
    const end = entry.clock_out ? new Date(entry.clock_out).getTime() : Date.now();
    return (end - start) / (1000 * 60 * 60);
  };

  const isStale = (entry: TCTimeEntry): boolean => {
    if (entry.clock_out) return false;
    return getHours(entry) > 12;
  };

  const getDailyEntries = (date: Date) => {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    return entries
      .filter((e) => {
        const clockIn = new Date(e.clock_in);
        return clockIn >= dayStart && clockIn <= dayEnd;
      })
      .map((entry) => {
        const employee = employees.find((emp) => emp.id === entry.employee_id);
        if (!employee) return null;
        const hours = getHours(entry);
        const job = entry.job_id && jobs ? jobs.find((j) => j.id === entry.job_id) : null;

        return {
          employee,
          entry,
          hours,
          isStale: isStale(entry),
          jobName: job ? job.name : null,
        };
      })
      .filter(Boolean) as Array<{
        employee: TCEmployee;
        entry: TCTimeEntry;
        hours: number;
        isStale: boolean;
        jobName: string | null;
      }>;
  };

  const getWeekRange = (date: Date): { start: Date; end: Date } => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday start
    const start = new Date(d.setDate(diff));
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  };

  const getWeeklySummary = (weekStart: Date) => {
    const { start, end } = getWeekRange(weekStart);

    const activeEmployees = employees.filter((e) => e.is_active);

    return activeEmployees.map((employee) => {
      const empEntries = entries.filter((e) => {
        const ci = new Date(e.clock_in);
        return e.employee_id === employee.id && ci >= start && ci <= end;
      });

      const dailyHours: number[] = [];

      for (let i = 0; i < 7; i++) {
        const dayDate = new Date(start);
        dayDate.setDate(dayDate.getDate() + i);
        const dayStart = new Date(dayDate);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(dayDate);
        dayEnd.setHours(23, 59, 59, 999);

        const dayEntries = empEntries.filter((e) => {
          const ci = new Date(e.clock_in);
          return ci >= dayStart && ci <= dayEnd;
        });

        const dayTotal = dayEntries.reduce((sum, e) => sum + getHours(e), 0);
        dailyHours.push(Math.round(dayTotal * 100) / 100);
      }

      const weeklyTotal = dailyHours.reduce((s, h) => s + h, 0);

      return {
        employee,
        dailyHours,
        weeklyTotal: Math.round(weeklyTotal * 100) / 100,
      };
    });
  };

  const getMonthlySummary = (year: number, month: number) => {
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0, 23, 59, 59, 999);

    const activeEmployees = employees.filter((e) => e.is_active);

    // Find all weeks that overlap this month
    const weeks: { start: Date; end: Date }[] = [];
    const d = new Date(monthStart);
    // Move to first Monday on or before month start
    const day = d.getDay();
    d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));

    while (d <= monthEnd) {
      const wStart = new Date(d);
      const wEnd = new Date(d);
      wEnd.setDate(wEnd.getDate() + 6);
      wEnd.setHours(23, 59, 59, 999);
      weeks.push({ start: wStart, end: wEnd });
      d.setDate(d.getDate() + 7);
    }

    return activeEmployees.map((employee) => {
      const weeklyHours = weeks.map(({ start, end }) => {
        const empEntries = entries.filter((e) => {
          const ci = new Date(e.clock_in);
          return e.employee_id === employee.id && ci >= start && ci <= end;
        });
        const total = empEntries.reduce((sum, e) => sum + getHours(e), 0);
        return Math.round(total * 100) / 100;
      });

      return {
        employee,
        weeklyHours,
        monthlyTotal: Math.round(weeklyHours.reduce((s, h) => s + h, 0) * 100) / 100,
      };
    });
  };

  return { getHours, isStale, getDailyEntries, getWeekRange, getWeeklySummary, getMonthlySummary };
}
