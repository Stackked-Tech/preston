"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase, isSupabaseConfigured } from "./supabase";
import type { User } from "@supabase/supabase-js";

export function useEmployeeAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [employeeStatus, setEmployeeStatus] = useState<string | null>(null);
  const [signingToken, setSigningToken] = useState<string | null>(null);

  const fetchEmployeeStatus = useCallback(async (email: string) => {
    const { data } = await supabase
      .from("ea_staff")
      .select("status, onboarding_signing_token")
      .eq("email", email)
      .in("status", ["active", "onboarding"])
      .limit(1)
      .single();
    if (data) {
      setEmployeeStatus(data.status);
      setSigningToken(data.onboarding_signing_token);
    } else {
      setEmployeeStatus("active");
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u?.email) {
        await fetchEmployeeStatus(u.email);
      }
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u?.email) {
        await fetchEmployeeStatus(u.email);
      } else {
        setEmployeeStatus(null);
        setSigningToken(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchEmployeeStatus]);

  const login = useCallback(
    async (email: string, password: string): Promise<string | null> => {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) return error.message;
      return null;
    },
    []
  );

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setEmployeeStatus(null);
    setSigningToken(null);
  }, []);

  const needsOnboarding = employeeStatus === "onboarding" && signingToken != null;
  const onboardingComplete = employeeStatus === "active";

  return {
    user,
    loading,
    onboardingComplete,
    needsOnboarding,
    signingToken,
    employeeStatus,
    login,
    logout,
  };
}
