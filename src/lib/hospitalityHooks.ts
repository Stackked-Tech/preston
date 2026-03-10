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
  HMRequestStatus,
  HMRequestInsert,
  HMRequestPhoto,
  HMRequestWithDetails,
  HMPriority,
  HMTaskStatus,
  HMTaskWithDetails,
  HMTaskNote,
  HMTaskPhoto,
  HMTaskTimeLog,
  HMTaskMaterial,
  HMPhotoType,
  HMRecurringTask,
  HMRecurringTaskInsert,
  HMTask,
  HMRequest,
  HMUrgency,
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

// ─── Property by QR Code ────────────────────────────

export function usePropertyByQrCode(qrCodeId: string | null) {
  const [property, setProperty] = useState<HMProperty | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!qrCodeId) {
      setProperty(null);
      setLoading(false);
      return;
    }
    if (!isSupabaseConfigured) {
      setError("Supabase not configured");
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const { data, error: err } = await supabase
          .from("hm_properties")
          .select("*")
          .eq("qr_code_id", qrCodeId)
          .single();
        if (err) throw err;
        if (!cancelled) {
          setProperty(data as HMProperty);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to fetch property"
          );
          setProperty(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [qrCodeId]);

  return { property, loading, error };
}

// ─── Requests ───────────────────────────────────────

export function useRequests(propertyIds?: string[], status?: HMRequestStatus) {
  const [requests, setRequests] = useState<HMRequestWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setError("Supabase not configured");
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      let query = supabase
        .from("hm_requests")
        .select(
          "*, property:hm_properties(id, name), category:hm_categories(id, label), requester_type:hm_requester_types(id, label), reviewer:hm_users(id, name)"
        )
        .order("created_at", { ascending: false });
      if (propertyIds && propertyIds.length > 0) {
        query = query.in("property_id", propertyIds);
      }
      if (status) {
        query = query.eq("status", status);
      }
      const { data, error: err } = await query;
      if (err) throw err;
      setRequests((data || []) as HMRequestWithDetails[]);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch requests"
      );
    } finally {
      setLoading(false);
    }
  }, [propertyIds, status]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  return { requests, loading, error, refetch: fetchRequests };
}

// ─── Request Photos ─────────────────────────────────

export function useRequestPhotos(requestId: string | null) {
  const [photos, setPhotos] = useState<HMRequestPhoto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!requestId) {
      setPhotos([]);
      setLoading(false);
      return;
    }
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from("hm_request_photos")
          .select("*")
          .eq("request_id", requestId)
          .order("created_at", { ascending: true });
        if (error) throw error;
        if (!cancelled) setPhotos((data || []) as HMRequestPhoto[]);
      } catch {
        if (!cancelled) setPhotos([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [requestId]);

  return { photos, loading };
}

// ─── Submit Request ─────────────────────────────────

export function useSubmitRequest() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitRequest = useCallback(
    async (request: HMRequestInsert, photos: File[]) => {
      if (!isSupabaseConfigured) throw new Error("Supabase not configured");

      try {
        setSubmitting(true);
        setError(null);

        // 1. Insert the request
        const { data: newRequest, error: insertErr } = await supabase
          .from("hm_requests")
          .insert(request)
          .select()
          .single();
        if (insertErr) throw insertErr;
        const requestId = (newRequest as { id: string }).id;

        // 2. Upload photos and insert photo records
        for (const file of photos) {
          const storagePath = `requests/${requestId}/${file.name}`;
          const { error: uploadErr } = await supabase.storage
            .from("hospitality")
            .upload(storagePath, file);
          if (uploadErr) throw uploadErr;

          const { error: photoInsertErr } = await supabase
            .from("hm_request_photos")
            .insert({ request_id: requestId, storage_path: storagePath });
          if (photoInsertErr) throw photoInsertErr;
        }

        return newRequest;
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Failed to submit request";
        setError(msg);
        throw err;
      } finally {
        setSubmitting(false);
      }
    },
    []
  );

  return { submitRequest, submitting, error };
}

// ─── Review Request ─────────────────────────────────

const URGENCY_TO_PRIORITY: Record<HMUrgency, HMPriority> = {
  routine: "medium",
  urgent: "high",
  emergency: "critical",
};

export function useReviewRequest() {
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const approveRequest = useCallback(
    async (requestId: string, assignTo?: string) => {
      if (!isSupabaseConfigured) throw new Error("Supabase not configured");
      try {
        setProcessing(true);
        setError(null);

        // Get the request to read urgency, property_id, description
        const { data: req, error: fetchErr } = await supabase
          .from("hm_requests")
          .select("*")
          .eq("id", requestId)
          .single();
        if (fetchErr) throw fetchErr;
        const request = req as HMRequest;

        // Update request status
        const { error: updateErr } = await supabase
          .from("hm_requests")
          .update({
            status: "approved" as HMRequestStatus,
            reviewed_at: new Date().toISOString(),
            ...(assignTo ? { reviewed_by: assignTo } : {}),
          })
          .eq("id", requestId);
        if (updateErr) throw updateErr;

        // Create task
        const priority = URGENCY_TO_PRIORITY[request.urgency];
        const { data: newTask, error: taskErr } = await supabase
          .from("hm_tasks")
          .insert({
            property_id: request.property_id,
            request_id: requestId,
            description: request.description,
            priority,
            status: "new" as HMTaskStatus,
            ...(assignTo ? { assigned_to: assignTo } : {}),
          })
          .select()
          .single();
        if (taskErr) throw taskErr;
        return newTask as HMTask;
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Failed to approve request";
        setError(msg);
        throw err;
      } finally {
        setProcessing(false);
      }
    },
    []
  );

  const approveWithEdits = useCallback(
    async (
      requestId: string,
      edits: {
        priority: HMPriority;
        due_date?: string;
        assigned_to?: string;
        manager_notes?: string;
        reviewed_by?: string;
      }
    ) => {
      if (!isSupabaseConfigured) throw new Error("Supabase not configured");
      try {
        setProcessing(true);
        setError(null);

        // Get the request
        const { data: req, error: fetchErr } = await supabase
          .from("hm_requests")
          .select("*")
          .eq("id", requestId)
          .single();
        if (fetchErr) throw fetchErr;
        const request = req as HMRequest;

        // Update request status
        const { error: updateErr } = await supabase
          .from("hm_requests")
          .update({
            status: "approved" as HMRequestStatus,
            manager_notes: edits.manager_notes || null,
            reviewed_by: edits.reviewed_by || null,
            reviewed_at: new Date().toISOString(),
          })
          .eq("id", requestId);
        if (updateErr) throw updateErr;

        // Create task with edited values
        const { data: newTask, error: taskErr } = await supabase
          .from("hm_tasks")
          .insert({
            property_id: request.property_id,
            request_id: requestId,
            description: request.description,
            priority: edits.priority,
            status: "new" as HMTaskStatus,
            due_date: edits.due_date || null,
            assigned_to: edits.assigned_to || null,
          })
          .select()
          .single();
        if (taskErr) throw taskErr;
        return newTask as HMTask;
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : "Failed to approve request with edits";
        setError(msg);
        throw err;
      } finally {
        setProcessing(false);
      }
    },
    []
  );

  const rejectRequest = useCallback(
    async (requestId: string, notes: string, reviewedBy: string) => {
      if (!isSupabaseConfigured) throw new Error("Supabase not configured");
      try {
        setProcessing(true);
        setError(null);

        const { error: updateErr } = await supabase
          .from("hm_requests")
          .update({
            status: "rejected" as HMRequestStatus,
            manager_notes: notes,
            reviewed_by: reviewedBy,
            reviewed_at: new Date().toISOString(),
          })
          .eq("id", requestId);
        if (updateErr) throw updateErr;
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Failed to reject request";
        setError(msg);
        throw err;
      } finally {
        setProcessing(false);
      }
    },
    []
  );

  return { approveRequest, approveWithEdits, rejectRequest, processing, error };
}

// ─── Tasks ──────────────────────────────────────────

const PRIORITY_RANK: Record<HMPriority, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

export function useTasks(filters?: {
  assignedTo?: string;
  status?: HMTaskStatus;
  propertyId?: string;
}) {
  const [tasks, setTasks] = useState<HMTaskWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setError("Supabase not configured");
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      let query = supabase
        .from("hm_tasks")
        .select(
          "*, property:hm_properties(id, name), assigned_user:hm_users(id, name), request:hm_requests(id, description, urgency)"
        )
        .order("due_date", { ascending: true, nullsFirst: false });

      if (filters?.assignedTo) {
        query = query.eq("assigned_to", filters.assignedTo);
      }
      if (filters?.status) {
        query = query.eq("status", filters.status);
      }
      if (filters?.propertyId) {
        query = query.eq("property_id", filters.propertyId);
      }

      const { data, error: err } = await query;
      if (err) throw err;

      // Sort by priority desc (critical first), then due_date asc
      const sorted = ((data || []) as HMTaskWithDetails[]).sort((a, b) => {
        const prioA = PRIORITY_RANK[a.priority] || 0;
        const prioB = PRIORITY_RANK[b.priority] || 0;
        if (prioB !== prioA) return prioB - prioA;
        // due_date asc — nulls last
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return a.due_date.localeCompare(b.due_date);
      });

      setTasks(sorted);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch tasks"
      );
    } finally {
      setLoading(false);
    }
  }, [filters?.assignedTo, filters?.status, filters?.propertyId]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  return { tasks, loading, error, refetch: fetchTasks };
}

// ─── Task Detail ────────────────────────────────────

export function useTaskDetail(taskId: string | null) {
  const [task, setTask] = useState<HMTaskWithDetails | null>(null);
  const [notes, setNotes] = useState<(HMTaskNote & { user?: { id: string; name: string } | null })[]>([]);
  const [photos, setPhotos] = useState<HMTaskPhoto[]>([]);
  const [timeLogs, setTimeLogs] = useState<HMTaskTimeLog[]>([]);
  const [materials, setMaterials] = useState<HMTaskMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTaskDetail = useCallback(async () => {
    if (!taskId) {
      setTask(null);
      setNotes([]);
      setPhotos([]);
      setTimeLogs([]);
      setMaterials([]);
      setLoading(false);
      return;
    }
    if (!isSupabaseConfigured) {
      setError("Supabase not configured");
      setLoading(false);
      return;
    }
    try {
      setLoading(true);

      const [taskRes, notesRes, photosRes, timeLogsRes, materialsRes] =
        await Promise.all([
          supabase
            .from("hm_tasks")
            .select(
              "*, property:hm_properties(*), assigned_user:hm_users(id, name, phone), request:hm_requests(*, requester_type:hm_requester_types(label), category:hm_categories(label))"
            )
            .eq("id", taskId)
            .single(),
          supabase
            .from("hm_task_notes")
            .select("*, user:hm_users(id, name)")
            .eq("task_id", taskId)
            .order("created_at", { ascending: false }),
          supabase
            .from("hm_task_photos")
            .select("*")
            .eq("task_id", taskId)
            .order("created_at", { ascending: true }),
          supabase
            .from("hm_task_time_logs")
            .select("*")
            .eq("task_id", taskId)
            .order("started_at", { ascending: false }),
          supabase
            .from("hm_task_materials")
            .select("*")
            .eq("task_id", taskId)
            .order("created_at", { ascending: true }),
        ]);

      if (taskRes.error) throw taskRes.error;

      setTask(taskRes.data as HMTaskWithDetails);
      setNotes((notesRes.data || []) as (HMTaskNote & { user?: { id: string; name: string } | null })[]);
      setPhotos((photosRes.data || []) as HMTaskPhoto[]);
      setTimeLogs((timeLogsRes.data || []) as HMTaskTimeLog[]);
      setMaterials((materialsRes.data || []) as HMTaskMaterial[]);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch task detail"
      );
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    fetchTaskDetail();
  }, [fetchTaskDetail]);

  return { task, notes, photos, timeLogs, materials, loading, error, refetch: fetchTaskDetail };
}

// ─── Task Actions ───────────────────────────────────

export function useTaskActions(taskId: string) {
  const updateStatus = useCallback(
    async (status: HMTaskStatus) => {
      const updates: Record<string, unknown> = { status };
      if (status === "completed") {
        updates.completed_at = new Date().toISOString();
      }
      const { error } = await supabase
        .from("hm_tasks")
        .update(updates)
        .eq("id", taskId);
      if (error) throw error;
    },
    [taskId]
  );

  const addNote = useCallback(
    async (userId: string, note: string) => {
      const { data, error } = await supabase
        .from("hm_task_notes")
        .insert({ task_id: taskId, user_id: userId, note })
        .select()
        .single();
      if (error) throw error;
      return data as HMTaskNote;
    },
    [taskId]
  );

  const addPhoto = useCallback(
    async (userId: string, file: File, photoType: HMPhotoType) => {
      const storagePath = `tasks/${taskId}/${photoType}/${file.name}`;
      const { error: uploadErr } = await supabase.storage
        .from("hospitality")
        .upload(storagePath, file);
      if (uploadErr) throw uploadErr;

      const { data, error } = await supabase
        .from("hm_task_photos")
        .insert({
          task_id: taskId,
          user_id: userId,
          storage_path: storagePath,
          photo_type: photoType,
        })
        .select()
        .single();
      if (error) throw error;
      return data as HMTaskPhoto;
    },
    [taskId]
  );

  const startTimer = useCallback(
    async (userId: string) => {
      const { data, error } = await supabase
        .from("hm_task_time_logs")
        .insert({
          task_id: taskId,
          user_id: userId,
          started_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (error) throw error;
      return data as HMTaskTimeLog;
    },
    [taskId]
  );

  const stopTimer = useCallback(async (timeLogId: string) => {
    // Get the time log to calculate duration
    const { data: log, error: fetchErr } = await supabase
      .from("hm_task_time_logs")
      .select("started_at")
      .eq("id", timeLogId)
      .single();
    if (fetchErr) throw fetchErr;

    const endedAt = new Date();
    const startedAt = new Date((log as { started_at: string }).started_at);
    const durationMinutes = Math.round(
      (endedAt.getTime() - startedAt.getTime()) / 60000
    );

    const { error } = await supabase
      .from("hm_task_time_logs")
      .update({
        ended_at: endedAt.toISOString(),
        duration_minutes: durationMinutes,
      })
      .eq("id", timeLogId);
    if (error) throw error;
  }, []);

  const addTimeEntry = useCallback(
    async (
      userId: string,
      entry: { started_at: string; ended_at: string; notes?: string }
    ) => {
      const startedAt = new Date(entry.started_at);
      const endedAt = new Date(entry.ended_at);
      const durationMinutes = Math.round(
        (endedAt.getTime() - startedAt.getTime()) / 60000
      );

      const { data, error } = await supabase
        .from("hm_task_time_logs")
        .insert({
          task_id: taskId,
          user_id: userId,
          started_at: entry.started_at,
          ended_at: entry.ended_at,
          duration_minutes: durationMinutes,
          notes: entry.notes || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as HMTaskTimeLog;
    },
    [taskId]
  );

  const addMaterial = useCallback(
    async (
      material: Omit<HMTaskMaterial, "id" | "task_id" | "created_at">
    ) => {
      const { data, error } = await supabase
        .from("hm_task_materials")
        .insert({ ...material, task_id: taskId })
        .select()
        .single();
      if (error) throw error;
      return data as HMTaskMaterial;
    },
    [taskId]
  );

  const removeMaterial = useCallback(async (materialId: string) => {
    const { error } = await supabase
      .from("hm_task_materials")
      .delete()
      .eq("id", materialId);
    if (error) throw error;
  }, []);

  const updateTask = useCallback(
    async (updates: { priority?: HMPriority; due_date?: string | null; assigned_to?: string | null; title?: string }) => {
      const { error } = await supabase
        .from("hm_tasks")
        .update(updates)
        .eq("id", taskId);
      if (error) throw error;
    },
    [taskId]
  );

  return {
    updateStatus,
    updateTask,
    addNote,
    addPhoto,
    startTimer,
    stopTimer,
    addTimeEntry,
    addMaterial,
    removeMaterial,
  };
}

// ─── Recurring Tasks ────────────────────────────────

export function useRecurringTasks() {
  const [recurringTasks, setRecurringTasks] = useState<HMRecurringTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRecurringTasks = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setError("Supabase not configured");
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const { data, error: err } = await supabase
        .from("hm_recurring_tasks")
        .select(
          "*, property:hm_properties(id, name), category:hm_categories(id, label)"
        )
        .order("next_due_date", { ascending: true });
      if (err) throw err;
      setRecurringTasks((data || []) as HMRecurringTask[]);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to fetch recurring tasks"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecurringTasks();
  }, [fetchRecurringTasks]);

  const addRecurringTask = async (
    task: HMRecurringTaskInsert
  ): Promise<HMRecurringTask> => {
    const { data, error } = await supabase
      .from("hm_recurring_tasks")
      .insert(task)
      .select(
        "*, property:hm_properties(id, name), category:hm_categories(id, label)"
      )
      .single();
    if (error) throw error;
    const newTask = data as HMRecurringTask;
    setRecurringTasks((prev) =>
      [...prev, newTask].sort((a, b) =>
        a.next_due_date.localeCompare(b.next_due_date)
      )
    );
    return newTask;
  };

  const updateRecurringTask = async (
    id: string,
    updates: Partial<HMRecurringTaskInsert>
  ): Promise<HMRecurringTask> => {
    const { data, error } = await supabase
      .from("hm_recurring_tasks")
      .update(updates)
      .eq("id", id)
      .select(
        "*, property:hm_properties(id, name), category:hm_categories(id, label)"
      )
      .single();
    if (error) throw error;
    const updated = data as HMRecurringTask;
    setRecurringTasks((prev) =>
      prev
        .map((t) => (t.id === id ? updated : t))
        .sort((a, b) => a.next_due_date.localeCompare(b.next_due_date))
    );
    return updated;
  };

  const toggleRecurringTaskActive = async (
    id: string,
    is_active: boolean
  ): Promise<void> => {
    const { error } = await supabase
      .from("hm_recurring_tasks")
      .update({ is_active })
      .eq("id", id);
    if (error) throw error;
    setRecurringTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, is_active } : t))
    );
  };

  return {
    recurringTasks,
    loading,
    error,
    refetch: fetchRecurringTasks,
    addRecurringTask,
    updateRecurringTask,
    toggleRecurringTaskActive,
  };
}
