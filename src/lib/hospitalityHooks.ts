"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase, isSupabaseConfigured } from "./supabase";
import type {
  HMProperty,
  HMPropertyInsert,
  HMRequesterType,
  HMRequesterTypeInsert,
  HMCategory,
  HMCategoryInsert,
  HMUser,
  HMUserInsert,
  HMUserProperty,
} from "@/types/hospitality";

// ─── Phone number helpers ────────────────────────────

export function normalizePhone(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (input.startsWith("+")) return input;
  return `+${digits}`;
}

// ─── Properties ──────────────────────────────────────

export function useProperties() {
  const [properties, setProperties] = useState<HMProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProperties = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setError("Supabase not configured");
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const { data, error: err } = await supabase
        .from("hm_properties")
        .select("*")
        .order("name", { ascending: true });
      if (err) throw err;
      setProperties((data || []) as HMProperty[]);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch properties"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProperties();
  }, [fetchProperties]);

  const addProperty = async (
    property: HMPropertyInsert
  ): Promise<HMProperty> => {
    const { data, error } = await supabase
      .from("hm_properties")
      .insert(property)
      .select()
      .single();
    if (error) throw error;
    const newProperty = data as HMProperty;
    setProperties((prev) => [...prev, newProperty].sort((a, b) => a.name.localeCompare(b.name)));
    return newProperty;
  };

  const updateProperty = async (
    id: string,
    updates: Partial<HMPropertyInsert>
  ): Promise<HMProperty> => {
    const { data, error } = await supabase
      .from("hm_properties")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    const updated = data as HMProperty;
    setProperties((prev) =>
      prev
        .map((p) => (p.id === id ? updated : p))
        .sort((a, b) => a.name.localeCompare(b.name))
    );
    return updated;
  };

  const togglePropertyActive = async (
    id: string,
    is_active: boolean
  ): Promise<void> => {
    const { error } = await supabase
      .from("hm_properties")
      .update({ is_active })
      .eq("id", id);
    if (error) throw error;
    setProperties((prev) =>
      prev.map((p) => (p.id === id ? { ...p, is_active } : p))
    );
  };

  return {
    properties,
    loading,
    error,
    refetch: fetchProperties,
    addProperty,
    updateProperty,
    togglePropertyActive,
  };
}

// ─── Requester Types ─────────────────────────────────

export function useRequesterTypes() {
  const [requesterTypes, setRequesterTypes] = useState<HMRequesterType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRequesterTypes = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setError("Supabase not configured");
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const { data, error: err } = await supabase
        .from("hm_requester_types")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (err) throw err;
      setRequesterTypes((data || []) as HMRequesterType[]);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch requester types"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequesterTypes();
  }, [fetchRequesterTypes]);

  const addRequesterType = async (
    rt: HMRequesterTypeInsert
  ): Promise<HMRequesterType> => {
    const { data, error } = await supabase
      .from("hm_requester_types")
      .insert(rt)
      .select()
      .single();
    if (error) throw error;
    const newRT = data as HMRequesterType;
    setRequesterTypes((prev) =>
      [...prev, newRT].sort((a, b) => a.sort_order - b.sort_order)
    );
    return newRT;
  };

  const updateRequesterType = async (
    id: string,
    updates: Partial<HMRequesterTypeInsert>
  ): Promise<HMRequesterType> => {
    const { data, error } = await supabase
      .from("hm_requester_types")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    const updated = data as HMRequesterType;
    setRequesterTypes((prev) =>
      prev
        .map((rt) => (rt.id === id ? updated : rt))
        .sort((a, b) => a.sort_order - b.sort_order)
    );
    return updated;
  };

  const toggleRequesterTypeActive = async (
    id: string,
    is_active: boolean
  ): Promise<void> => {
    const { error } = await supabase
      .from("hm_requester_types")
      .update({ is_active })
      .eq("id", id);
    if (error) throw error;
    if (!is_active) {
      setRequesterTypes((prev) => prev.filter((rt) => rt.id !== id));
    } else {
      setRequesterTypes((prev) =>
        prev.map((rt) => (rt.id === id ? { ...rt, is_active } : rt))
      );
    }
  };

  return {
    requesterTypes,
    loading,
    error,
    refetch: fetchRequesterTypes,
    addRequesterType,
    updateRequesterType,
    toggleRequesterTypeActive,
  };
}

// ─── Categories ──────────────────────────────────────

export function useCategories() {
  const [categories, setCategories] = useState<HMCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCategories = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setError("Supabase not configured");
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const { data, error: err } = await supabase
        .from("hm_categories")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (err) throw err;
      setCategories((data || []) as HMCategory[]);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch categories"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const addCategory = async (
    category: HMCategoryInsert
  ): Promise<HMCategory> => {
    const { data, error } = await supabase
      .from("hm_categories")
      .insert(category)
      .select()
      .single();
    if (error) throw error;
    const newCat = data as HMCategory;
    setCategories((prev) =>
      [...prev, newCat].sort((a, b) => a.sort_order - b.sort_order)
    );
    return newCat;
  };

  const updateCategory = async (
    id: string,
    updates: Partial<HMCategoryInsert>
  ): Promise<HMCategory> => {
    const { data, error } = await supabase
      .from("hm_categories")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    const updated = data as HMCategory;
    setCategories((prev) =>
      prev
        .map((c) => (c.id === id ? updated : c))
        .sort((a, b) => a.sort_order - b.sort_order)
    );
    return updated;
  };

  const toggleCategoryActive = async (
    id: string,
    is_active: boolean
  ): Promise<void> => {
    const { error } = await supabase
      .from("hm_categories")
      .update({ is_active })
      .eq("id", id);
    if (error) throw error;
    if (!is_active) {
      setCategories((prev) => prev.filter((c) => c.id !== id));
    } else {
      setCategories((prev) =>
        prev.map((c) => (c.id === id ? { ...c, is_active } : c))
      );
    }
  };

  return {
    categories,
    loading,
    error,
    refetch: fetchCategories,
    addCategory,
    updateCategory,
    toggleCategoryActive,
  };
}

// ─── Users ───────────────────────────────────────────

export function useHMUsers(role?: "manager" | "staff") {
  const [users, setUsers] = useState<HMUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setError("Supabase not configured");
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      let query = supabase
        .from("hm_users")
        .select("*")
        .order("name", { ascending: true });
      if (role) {
        query = query.eq("role", role);
      }
      const { data, error: err } = await query;
      if (err) throw err;
      setUsers((data || []) as HMUser[]);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch users"
      );
    } finally {
      setLoading(false);
    }
  }, [role]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const addUser = async (user: HMUserInsert): Promise<HMUser> => {
    const { data, error } = await supabase
      .from("hm_users")
      .insert(user)
      .select()
      .single();
    if (error) throw error;
    const newUser = data as HMUser;
    setUsers((prev) =>
      [...prev, newUser].sort((a, b) => a.name.localeCompare(b.name))
    );
    return newUser;
  };

  const updateUser = async (
    id: string,
    updates: Partial<HMUserInsert>
  ): Promise<HMUser> => {
    const { data, error } = await supabase
      .from("hm_users")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    const updated = data as HMUser;
    setUsers((prev) =>
      prev
        .map((u) => (u.id === id ? updated : u))
        .sort((a, b) => a.name.localeCompare(b.name))
    );
    return updated;
  };

  const toggleUserActive = async (
    id: string,
    is_active: boolean
  ): Promise<void> => {
    const { error } = await supabase
      .from("hm_users")
      .update({ is_active })
      .eq("id", id);
    if (error) throw error;
    setUsers((prev) =>
      prev.map((u) => (u.id === id ? { ...u, is_active } : u))
    );
  };

  return {
    users,
    loading,
    error,
    refetch: fetchUsers,
    addUser,
    updateUser,
    toggleUserActive,
  };
}

// ─── User Properties ─────────────────────────────────

export interface HMUserPropertyWithDetails extends HMUserProperty {
  property: { id: string; name: string } | null;
}

export function useUserProperties(userId?: string) {
  const [userProperties, setUserProperties] = useState<HMUserPropertyWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUserProperties = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setError("Supabase not configured");
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      let query = supabase
        .from("hm_user_properties")
        .select("*, property:hm_properties(id, name)");
      if (userId) {
        query = query.eq("user_id", userId);
      }
      const { data, error: err } = await query;
      if (err) throw err;
      setUserProperties((data || []) as HMUserPropertyWithDetails[]);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch user properties"
      );
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchUserProperties();
  }, [fetchUserProperties]);

  const assignProperty = async (
    assignUserId: string,
    propertyId: string
  ): Promise<HMUserProperty> => {
    const { data, error } = await supabase
      .from("hm_user_properties")
      .insert({ user_id: assignUserId, property_id: propertyId })
      .select("*, property:hm_properties(id, name)")
      .single();
    if (error) throw error;
    const newUP = data as HMUserPropertyWithDetails;
    setUserProperties((prev) => [...prev, newUP]);
    return newUP;
  };

  const unassignProperty = async (id: string): Promise<void> => {
    const { error } = await supabase
      .from("hm_user_properties")
      .delete()
      .eq("id", id);
    if (error) throw error;
    setUserProperties((prev) => prev.filter((up) => up.id !== id));
  };

  return {
    userProperties,
    loading,
    error,
    refetch: fetchUserProperties,
    assignProperty,
    unassignProperty,
  };
}
