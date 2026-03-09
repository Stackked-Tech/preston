"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase, isSupabaseConfigured } from "./supabase";
import type {
  EABranch,
  EAStaff,
  EAStaffInsert,
  EAStaffUpdate,
  EANameOverride,
  EANameOverrideInsert,
  OnboardEmployeeRequest,
} from "@/types/employeeadmin";
import type { STSTemplate } from "@/types/signedtosealed";

// ─── Branches ─────────────────────────────────────────────

export function useBranches() {
  const [branches, setBranches] = useState<EABranch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBranches = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setError("Supabase not configured");
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const { data, error: err } = await supabase
        .from("ea_branches")
        .select("*")
        .order("display_order", { ascending: true });
      if (err) throw err;
      setBranches((data || []) as EABranch[]);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch branches");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  return { branches, loading, error };
}

// ─── Staff ────────────────────────────────────────────────

export function useStaff(branchId: string) {
  const [staff, setStaff] = useState<EAStaff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStaff = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setError("Supabase not configured");
      setLoading(false);
      return;
    }
    if (!branchId) {
      setStaff([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const { data, error: err } = await supabase
        .from("ea_staff")
        .select("*")
        .eq("branch_id", branchId)
        .order("sort_order", { ascending: true });
      if (err) throw err;
      setStaff((data || []) as EAStaff[]);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch staff");
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  const addStaff = async (insert: EAStaffInsert): Promise<EAStaff> => {
    const { data, error } = await supabase
      .from("ea_staff")
      .insert(insert)
      .select()
      .single();
    if (error) throw error;
    const created = data as EAStaff;
    setStaff((prev) => [...prev, created]);
    return created;
  };

  const updateStaff = async (id: string, updates: EAStaffUpdate): Promise<void> => {
    const { error } = await supabase
      .from("ea_staff")
      .update(updates)
      .eq("id", id);
    if (error) throw error;
    setStaff((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...updates } : s))
    );
  };

  const toggleActive = async (id: string, isActive: boolean): Promise<void> => {
    const { error } = await supabase
      .from("ea_staff")
      .update({ is_active: isActive })
      .eq("id", id);
    if (error) throw error;
    setStaff((prev) =>
      prev.map((s) => (s.id === id ? { ...s, is_active: isActive } : s))
    );
  };

  return { staff, loading, error, addStaff, updateStaff, toggleActive, refetch: fetchStaff };
}

// ─── Name Overrides ───────────────────────────────────────

export function useNameOverrides(branchId: string) {
  const [overrides, setOverrides] = useState<EANameOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOverrides = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setError("Supabase not configured");
      setLoading(false);
      return;
    }
    if (!branchId) {
      setOverrides([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const { data, error: err } = await supabase
        .from("ea_name_overrides")
        .select("*")
        .eq("branch_id", branchId)
        .order("phorest_name", { ascending: true });
      if (err) throw err;
      setOverrides((data || []) as EANameOverride[]);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch name overrides");
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  useEffect(() => {
    fetchOverrides();
  }, [fetchOverrides]);

  const addOverride = async (insert: EANameOverrideInsert): Promise<EANameOverride> => {
    const { data, error } = await supabase
      .from("ea_name_overrides")
      .insert(insert)
      .select()
      .single();
    if (error) throw error;
    const created = data as EANameOverride;
    setOverrides((prev) =>
      [...prev, created].sort((a, b) => a.phorest_name.localeCompare(b.phorest_name))
    );
    return created;
  };

  const deleteOverride = async (id: string): Promise<void> => {
    const { error } = await supabase
      .from("ea_name_overrides")
      .delete()
      .eq("id", id);
    if (error) throw error;
    setOverrides((prev) => prev.filter((o) => o.id !== id));
  };

  return { overrides, loading, error, addOverride, deleteOverride, refetch: fetchOverrides };
}

// ─── STS Templates (for onboarding) ─────────────────────

export function useTemplates() {
  const [templates, setTemplates] = useState<STSTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    supabase
      .from("sts_templates")
      .select("*")
      .order("name")
      .then(({ data }) => {
        setTemplates((data || []) as STSTemplate[]);
        setLoading(false);
      });
  }, []);

  return { templates, loading };
}

// ─── Onboard Employee ────────────────────────────────────

export async function onboardEmployee(data: OnboardEmployeeRequest): Promise<EAStaff> {
  const res = await fetch("/api/employee-admin/onboard", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const { error } = await res.json();
    throw new Error(error || "Failed to onboard employee");
  }
  const { staff } = await res.json();
  return staff as EAStaff;
}
