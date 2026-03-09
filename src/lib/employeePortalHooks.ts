"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase, isSupabaseConfigured } from "./supabase";
import type { EmployeeFeeRecord, EmployeeRecord } from "@/types/employeeportal";

export function useEmployeeFees(email: string | undefined) {
  const [fees, setFees] = useState<EmployeeFeeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFees = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setError("Supabase not configured");
      setLoading(false);
      return;
    }
    if (!email) {
      setFees([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const { data, error: err } = await supabase
        .from("ea_staff")
        .select("id, branch_id, display_name, station_lease, financial_services, phorest_fee, refreshment, associate_pay, supervisor, ea_branches(name)")
        .eq("email", email)
        .in("status", ["active", "onboarding"]);
      if (err) throw err;

      const records: EmployeeFeeRecord[] = (data || []).map((row: Record<string, unknown>) => {
        const branch = row.ea_branches as { name: string } | null;
        return {
          id: row.id as string,
          branch_id: row.branch_id as string,
          branch_name: branch?.name ?? "Unknown",
          display_name: row.display_name as string,
          station_lease: Number(row.station_lease) || 0,
          financial_services: Number(row.financial_services) || 0,
          phorest_fee: Number(row.phorest_fee) || 0,
          refreshment: Number(row.refreshment) || 0,
          associate_pay: row.associate_pay != null ? Number(row.associate_pay) : null,
          supervisor: row.supervisor as string | null,
        };
      });

      setFees(records);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch fee data");
    } finally {
      setLoading(false);
    }
  }, [email]);

  useEffect(() => {
    fetchFees();
  }, [fetchFees]);

  return { fees, loading, error };
}

export function useEmployeeRecord(email: string | undefined) {
  const [record, setRecord] = useState<EmployeeRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRecord = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setError("Supabase not configured");
      setLoading(false);
      return;
    }
    if (!email) {
      setRecord(null);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const { data, error: err } = await supabase
        .from("ea_staff")
        .select("id, branch_id, display_name, status, onboarding_envelope_id, onboarding_signing_token, ea_branches(name)")
        .eq("email", email)
        .in("status", ["active", "onboarding"])
        .limit(1)
        .single();
      if (err) throw err;
      setRecord(data as unknown as EmployeeRecord);
      setError(null);
    } catch {
      setRecord(null);
      setError(null);
    } finally {
      setLoading(false);
    }
  }, [email]);

  useEffect(() => {
    fetchRecord();
  }, [fetchRecord]);

  return { record, loading, error, refetch: fetchRecord };
}
