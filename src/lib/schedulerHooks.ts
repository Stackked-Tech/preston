"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase, isSupabaseConfigured } from "./supabase";
import type {
  CSProject,
  CSProjectInsert,
  CSPhase,
  CSPhaseInsert,
  CSTask,
  CSTaskInsert,
  CSSub,
  CSSubInsert,
  CSNotification,
  CSTemplate,
  CSTemplateInsert,
  CSTemplatePhase,
  CSTemplateTask,
  CSSubToken,
} from "@/types/scheduler";

// ─── Date helpers ────────────────────────────────────

export function addBusinessDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00");
  let remaining = days;
  while (remaining > 0) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) remaining--;
  }
  return d.toISOString().split("T")[0];
}

export function daysBetween(start: string, end: string): number {
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  return Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
}

export function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─── Cascading logic ─────────────────────────────────

export function cascadeTasks(
  tasks: CSTask[],
  changedTaskId: string,
  newStartDate: string,
  newEndDate: string
): CSTask[] {
  const updated = tasks.map((t) =>
    t.id === changedTaskId ? { ...t, start_date: newStartDate, end_date: newEndDate } : { ...t }
  );

  // Build dependency map: parentId -> children
  const childrenOf = new Map<string, string[]>();
  for (const t of updated) {
    if (t.dependency_id) {
      const existing = childrenOf.get(t.dependency_id) || [];
      existing.push(t.id);
      childrenOf.set(t.dependency_id, existing);
    }
  }

  // BFS cascade from changed task (with circular dependency protection)
  const queue = [changedTaskId];
  const visited = new Set<string>();
  const taskMap = new Map(updated.map((t) => [t.id, t]));

  while (queue.length > 0) {
    const parentId = queue.shift()!;
    if (visited.has(parentId)) continue; // prevent infinite loops from circular deps
    visited.add(parentId);

    const parent = taskMap.get(parentId)!;
    const children = childrenOf.get(parentId) || [];

    for (const childId of children) {
      if (visited.has(childId)) continue;
      const child = taskMap.get(childId)!;
      // Child starts the next calendar day after parent ends
      const nextDay = new Date(parent.end_date + "T12:00:00");
      nextDay.setDate(nextDay.getDate() + 1);
      const childStart = nextDay.toISOString().split("T")[0];
      const childEnd = addBusinessDays(childStart, Math.max(child.duration_days - 1, 0));

      child.start_date = childStart;
      child.end_date = childEnd;
      queue.push(childId);
    }
  }

  return Array.from(taskMap.values());
}

// ─── Projects ────────────────────────────────────────

export function useProjects() {
  const [projects, setProjects] = useState<CSProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setError("Supabase not configured");
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const { data, error: err } = await supabase
        .from("cs_projects")
        .select("*")
        .order("updated_at", { ascending: false });
      if (err) throw err;
      setProjects((data || []) as CSProject[]);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch projects");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const createProject = useCallback(async (project: CSProjectInsert) => {
    const { data, error } = await supabase.from("cs_projects").insert(project).select().single();
    if (error) throw error;
    setProjects((prev) => [data as CSProject, ...prev]);
    return data as CSProject;
  }, []);

  const updateProject = useCallback(async (id: string, updates: Partial<CSProject>) => {
    const { data, error } = await supabase
      .from("cs_projects")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    setProjects((prev) => prev.map((p) => (p.id === id ? (data as CSProject) : p)));
    return data as CSProject;
  }, []);

  const deleteProject = useCallback(async (id: string) => {
    const { error } = await supabase.from("cs_projects").delete().eq("id", id);
    if (error) throw error;
    setProjects((prev) => prev.filter((p) => p.id !== id));
  }, []);

  return { projects, loading, error, fetchProjects, createProject, updateProject, deleteProject };
}

// ─── Phases ──────────────────────────────────────────

export function usePhases(projectId: string | null) {
  const [phases, setPhases] = useState<CSPhase[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPhases = useCallback(async () => {
    if (!isSupabaseConfigured || !projectId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("cs_phases")
        .select("*")
        .eq("project_id", projectId)
        .order("sort_order");
      if (error) throw error;
      setPhases((data || []) as CSPhase[]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchPhases();
  }, [fetchPhases]);

  const createPhase = useCallback(
    async (phase: CSPhaseInsert) => {
      const { data, error } = await supabase.from("cs_phases").insert(phase).select().single();
      if (error) throw error;
      setPhases((prev) => [...prev, data as CSPhase]);
      return data as CSPhase;
    },
    []
  );

  const updatePhase = useCallback(async (id: string, updates: Partial<CSPhase>) => {
    const { data, error } = await supabase.from("cs_phases").update(updates).eq("id", id).select().single();
    if (error) throw error;
    setPhases((prev) => prev.map((p) => (p.id === id ? (data as CSPhase) : p)));
    return data as CSPhase;
  }, []);

  const deletePhase = useCallback(async (id: string) => {
    const { error } = await supabase.from("cs_phases").delete().eq("id", id);
    if (error) throw error;
    setPhases((prev) => prev.filter((p) => p.id !== id));
  }, []);

  return { phases, loading, fetchPhases, createPhase, updatePhase, deletePhase };
}

// ─── Tasks ───────────────────────────────────────────

export function useTasks(projectId: string | null) {
  const [tasks, setTasks] = useState<CSTask[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTasks = useCallback(async () => {
    if (!isSupabaseConfigured || !projectId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("cs_tasks")
        .select("*")
        .eq("project_id", projectId)
        .order("sort_order");
      if (error) throw error;
      setTasks((data || []) as CSTask[]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const createTask = useCallback(async (task: CSTaskInsert) => {
    const { data, error } = await supabase.from("cs_tasks").insert(task).select().single();
    if (error) throw error;
    setTasks((prev) => [...prev, data as CSTask]);
    return data as CSTask;
  }, []);

  const updateTask = useCallback(async (id: string, updates: Partial<CSTask>) => {
    const { data, error } = await supabase
      .from("cs_tasks")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    setTasks((prev) => prev.map((t) => (t.id === id ? (data as CSTask) : t)));
    return data as CSTask;
  }, []);

  const bulkUpdateTasks = useCallback(async (updatedTasks: CSTask[]) => {
    // Update each changed task — use allSettled to handle partial failures
    const now = new Date().toISOString();
    const results = await Promise.allSettled(
      updatedTasks.map((t) =>
        supabase
          .from("cs_tasks")
          .update({
            start_date: t.start_date,
            end_date: t.end_date,
            updated_at: now,
          })
          .eq("id", t.id)
      )
    );
    const failCount = results.filter((r) => r.status === "rejected").length;
    if (failCount > 0) console.error(`${failCount}/${updatedTasks.length} task updates failed`);
    // Update local state with successful changes
    setTasks((prev) => {
      const map = new Map(updatedTasks.map((t) => [t.id, t]));
      return prev.map((t) => map.get(t.id) || t);
    });
  }, []);

  const deleteTask = useCallback(async (id: string) => {
    const { error } = await supabase.from("cs_tasks").delete().eq("id", id);
    if (error) throw error;
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { tasks, loading, fetchTasks, createTask, updateTask, bulkUpdateTasks, deleteTask, setTasks };
}

// ─── Subs ────────────────────────────────────────────

export function useSubs() {
  const [subs, setSubs] = useState<CSSub[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSubs = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setError("Supabase not configured");
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const { data, error: err } = await supabase.from("cs_subs").select("*").order("name");
      if (err) throw err;
      setSubs((data || []) as CSSub[]);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch subs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubs();
  }, [fetchSubs]);

  const createSub = useCallback(async (sub: CSSubInsert) => {
    const { data, error } = await supabase.from("cs_subs").insert(sub).select().single();
    if (error) throw error;
    setSubs((prev) => [...prev, data as CSSub].sort((a, b) => a.name.localeCompare(b.name)));
    return data as CSSub;
  }, []);

  const updateSub = useCallback(async (id: string, updates: Partial<CSSub>) => {
    const { data, error } = await supabase.from("cs_subs").update(updates).eq("id", id).select().single();
    if (error) throw error;
    setSubs((prev) => prev.map((s) => (s.id === id ? (data as CSSub) : s)));
    return data as CSSub;
  }, []);

  const deleteSub = useCallback(async (id: string) => {
    const { error } = await supabase.from("cs_subs").delete().eq("id", id);
    if (error) throw error;
    setSubs((prev) => prev.filter((s) => s.id !== id));
  }, []);

  return { subs, loading, error, fetchSubs, createSub, updateSub, deleteSub };
}

// ─── Sub Tokens ──────────────────────────────────────

export function useSubTokens() {
  const generateToken = useCallback(async (subId: string): Promise<string> => {
    const token = crypto.randomUUID();
    const { error } = await supabase.from("cs_sub_tokens").insert({
      sub_id: subId,
      token,
      expires_at: null, // no expiry for now
    });
    if (error) throw error;
    return token;
  }, []);

  const getSubByToken = useCallback(async (token: string) => {
    const { data, error } = await supabase
      .from("cs_sub_tokens")
      .select("*, sub:cs_subs(*)")
      .eq("token", token)
      .single();
    if (error) return null;
    return data as CSSubToken & { sub: CSSub };
  }, []);

  return { generateToken, getSubByToken };
}

// ─── Notifications ───────────────────────────────────

export function useNotifications(projectId?: string) {
  const [notifications, setNotifications] = useState<CSNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      let query = supabase.from("cs_notifications").select("*").order("sent_at", { ascending: false }).limit(100);
      if (projectId) query = query.eq("project_id", projectId);
      const { data, error } = await query;
      if (error) throw error;
      setNotifications((data || []) as CSNotification[]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  return { notifications, loading, fetchNotifications };
}

// ─── Templates ───────────────────────────────────────

export function useTemplates() {
  const [templates, setTemplates] = useState<CSTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTemplates = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const { data, error } = await supabase.from("cs_templates").select("*").order("name");
      if (error) throw error;
      setTemplates((data || []) as CSTemplate[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const createTemplate = useCallback(async (template: CSTemplateInsert) => {
    const { data, error } = await supabase.from("cs_templates").insert(template).select().single();
    if (error) throw error;
    setTemplates((prev) => [...prev, data as CSTemplate]);
    return data as CSTemplate;
  }, []);

  const deleteTemplate = useCallback(async (id: string) => {
    const { error } = await supabase.from("cs_templates").delete().eq("id", id);
    if (error) throw error;
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const getTemplateDetail = useCallback(async (id: string) => {
    const [phasesRes, tasksRes] = await Promise.all([
      supabase.from("cs_template_phases").select("*").eq("template_id", id).order("sort_order"),
      supabase.from("cs_template_tasks").select("*").eq("template_id", id).order("sort_order"),
    ]);
    return {
      phases: (phasesRes.data || []) as CSTemplatePhase[],
      tasks: (tasksRes.data || []) as CSTemplateTask[],
    };
  }, []);

  const applyTemplate = useCallback(
    async (templateId: string, projectId: string, startDate: string) => {
      const { phases, tasks } = await getTemplateDetail(templateId);

      // Fetch subs for auto-assignment by trade
      const { data: allSubs } = await supabase.from("cs_subs").select("id, trade").order("name");
      const subsByTrade = new Map<string, string>();
      for (const s of (allSubs || [])) {
        if (!subsByTrade.has(s.trade)) subsByTrade.set(s.trade, s.id);
      }

      // Create phases
      const phaseMap = new Map<string, string>();
      for (const tp of phases) {
        const { data } = await supabase
          .from("cs_phases")
          .insert({
            project_id: projectId,
            name: tp.name,
            sort_order: tp.sort_order,
            color: tp.color,
          })
          .select()
          .single();
        if (data) phaseMap.set(tp.id, data.id);
      }

      // Create tasks with calculated dates + auto-assign subs by trade
      const taskMap = new Map<number, string>();
      for (const tt of tasks) {
        const taskStart = addBusinessDays(startDate, tt.offset_days);
        const taskEnd = addBusinessDays(taskStart, tt.duration_days - 1);
        const depId = tt.dependency_index != null ? taskMap.get(tt.dependency_index) || null : null;
        const phaseId = tt.template_phase_id ? phaseMap.get(tt.template_phase_id) || null : null;
        // Auto-assign sub by trade
        const autoSubId = tt.trade ? subsByTrade.get(tt.trade) || null : null;

        const { data } = await supabase
          .from("cs_tasks")
          .insert({
            project_id: projectId,
            phase_id: phaseId,
            name: tt.name,
            start_date: taskStart,
            end_date: taskEnd,
            duration_days: tt.duration_days,
            dependency_id: depId,
            sub_id: autoSubId,
            status: "pending",
            notes: null,
            sort_order: tt.sort_order,
          })
          .select()
          .single();
        if (data) taskMap.set(tt.sort_order, data.id);
      }
    },
    [getTemplateDetail]
  );

  return { templates, loading, fetchTemplates, createTemplate, deleteTemplate, getTemplateDetail, applyTemplate };
}

// ─── Sub Portal (read-only tasks for a sub) ──────────

export function useSubPortalTasks(subId: string | null) {
  const [tasks, setTasks] = useState<(CSTask & { project_name: string; project_address: string; acknowledged_at: string | null })[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTasks = useCallback(async () => {
    if (!isSupabaseConfigured || !subId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("cs_tasks")
        .select("*, project:cs_projects(name, address)")
        .eq("sub_id", subId)
        .in("status", ["pending", "in_progress", "delayed"])
        .order("start_date");
      if (error) throw error;
      const mapped = (data || []).map((t: Record<string, unknown>) => {
        const project = t.project as { name: string; address: string } | null;
        return {
          ...(t as unknown as CSTask),
          project_name: project?.name || "",
          project_address: project?.address || "",
        };
      });
      setTasks(mapped);
    } finally {
      setLoading(false);
    }
  }, [subId]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  return { tasks, loading, fetchTasks };
}
