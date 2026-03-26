"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { useSubPortalTasks } from "@/lib/schedulerHooks";
import type { CSSub, CSSubToken } from "@/types/scheduler";

interface SubPortalProps {
  token: string;
}

export default function SubPortal({ token }: SubPortalProps) {
  const [sub, setSub] = useState<CSSub | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSub() {
      if (!isSupabaseConfigured) { setError("System not configured"); setLoading(false); return; }
      try {
        const { data, error: err } = await supabase
          .from("cs_sub_tokens")
          .select("*, sub:cs_subs(*)")
          .eq("token", token)
          .single();
        if (err || !data) { setError("Invalid or expired link"); return; }
        const tokenData = data as CSSubToken & { sub: CSSub };
        if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) { setError("This link has expired"); return; }
        setSub(tokenData.sub);
      } catch { setError("Something went wrong"); }
      finally { setLoading(false); }
    }
    loadSub();
  }, [token]);

  const { tasks, loading: tasksLoading, fetchTasks } = useSubPortalTasks(sub?.id || null);

  const handleAcknowledge = useCallback((taskId: string) => {
    fetchTasks();
  }, [fetchTasks]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0a0a0a" }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-xl border-2 border-[#d4af37]/30 border-t-[#d4af37] animate-spin" />
          <p className="text-sm font-sans" style={{ color: "#6b7280" }}>Loading your schedule...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0a0a0a" }}>
        <div className="text-center max-w-sm px-6">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6" style={{ background: "rgba(239, 68, 68, 0.08)" }}>
            <span className="text-4xl">🔒</span>
          </div>
          <h2 className="text-lg font-serif font-semibold mb-2" style={{ color: "#ffffff" }}>Access Denied</h2>
          <p className="text-sm font-sans" style={{ color: "#9ca3af" }}>{error}</p>
          <p className="text-xs font-sans mt-4" style={{ color: "#6b7280" }}>Contact your project manager for a new link.</p>
        </div>
      </div>
    );
  }

  const upcomingTasks = tasks.filter((t) => new Date(t.start_date + "T12:00:00") >= new Date());
  const currentTasks = tasks.filter((t) => {
    const start = new Date(t.start_date + "T12:00:00");
    const end = new Date(t.end_date + "T12:00:00");
    const now = new Date();
    return start <= now && end >= now;
  });

  return (
    <div className="min-h-screen" style={{ background: "#0a0a0a" }}>
      {/* ─── Header ─── */}
      <header className="px-6 py-6 border-b" style={{ borderColor: "#1a1a1a" }}>
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <Image src="/wh-logo-circle-bw.png" alt="WHB" width={36} height={36} className="object-contain rounded-full" style={{ filter: "invert(1)" }} />
            <p className="text-[10px] font-sans tracking-[2px] uppercase m-0" style={{ color: "#6b7280" }}>
              WHB Companies — Subcontractor Portal
            </p>
          </div>
          <h1 className="text-2xl font-serif font-semibold m-0" style={{ color: "#ffffff" }}>
            {sub?.name}
          </h1>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-xs font-sans px-2.5 py-1 rounded-full" style={{ background: "rgba(212, 175, 55, 0.12)", color: "#d4af37" }}>
              {sub?.trade}
            </span>
            {sub?.company && <span className="text-xs font-sans" style={{ color: "#6b7280" }}>{sub.company}</span>}
          </div>
        </div>
      </header>

      <main className="px-6 py-8 max-w-2xl mx-auto">
        {/* ─── Quick stats ─── */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          {[
            { label: "Total Tasks", value: tasks.length, color: "#d4af37" },
            { label: "In Progress", value: currentTasks.length, color: "#3b82f6" },
            { label: "Upcoming", value: upcomingTasks.length, color: "#22c55e" },
          ].map((stat) => (
            <div key={stat.label} className="px-4 py-3.5 rounded-xl border" style={{ borderColor: "#1a1a1a", background: "#111111" }}>
              <p className="text-[10px] font-sans uppercase tracking-wider m-0" style={{ color: "#6b7280" }}>{stat.label}</p>
              <p className="text-2xl font-sans font-bold m-0 mt-1" style={{ color: stat.color }}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* ─── Section: Currently Active ─── */}
        {currentTasks.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#3b82f6" }} />
              <h2 className="text-xs font-sans font-semibold uppercase tracking-[2px] m-0" style={{ color: "#3b82f6" }}>
                Active Now
              </h2>
            </div>
            <div className="space-y-3">
              {currentTasks.map((task) => (
                <TaskCard key={task.id} task={task} highlight token={token} onAcknowledge={handleAcknowledge} />
              ))}
            </div>
          </div>
        )}

        {/* ─── Section: All Tasks ─── */}
        <div>
          <h2 className="text-xs font-sans font-semibold uppercase tracking-[2px] mb-4 m-0" style={{ color: "#d4af37" }}>
            Your Schedule
          </h2>

          {tasksLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 rounded-xl animate-pulse" style={{ background: "#111111" }} />
              ))}
            </div>
          ) : tasks.length === 0 ? (
            <div className="flex flex-col items-center py-12">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: "rgba(107, 114, 128, 0.08)" }}>
                <span className="text-3xl">📋</span>
              </div>
              <p className="text-sm font-sans" style={{ color: "#9ca3af" }}>No tasks assigned to you yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => (
                <TaskCard key={task.id} task={task} token={token} onAcknowledge={handleAcknowledge} />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* ─── Footer ─── */}
      <footer className="px-6 py-6 border-t mt-8" style={{ borderColor: "#1a1a1a" }}>
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <p className="text-[10px] font-sans m-0" style={{ color: "#6b7280" }}>
            Questions? Reply to your notification text or contact your project manager.
          </p>
          <p className="text-[10px] font-sans m-0" style={{ color: "#6b7280", opacity: 0.5 }}>
            WHB Companies
          </p>
        </div>
      </footer>
    </div>
  );
}

// ─── Task card component ─────────────────────────────

function TaskCard({ task, highlight, token, onAcknowledge }: {
  task: { id: string; name: string; start_date: string; end_date: string; duration_days: number; status: string; notes: string | null; project_name: string; project_address: string; acknowledged_at?: string | null };
  highlight?: boolean;
  token: string;
  onAcknowledge: (taskId: string) => void;
}) {
  const [acking, setAcking] = useState(false);
  const isAcked = !!task.acknowledged_at;
  const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
    pending: { bg: "rgba(107, 114, 128, 0.12)", text: "#9ca3af", label: "Pending" },
    in_progress: { bg: "rgba(59, 130, 246, 0.12)", text: "#3b82f6", label: "In Progress" },
    delayed: { bg: "rgba(239, 68, 68, 0.12)", text: "#ef4444", label: "Delayed" },
    completed: { bg: "rgba(34, 197, 94, 0.12)", text: "#22c55e", label: "Completed" },
  };
  const sc = statusConfig[task.status] || statusConfig.pending;

  return (
    <div
      className="p-5 rounded-xl border transition-all duration-200"
      style={{
        background: "#111111",
        borderColor: highlight ? "rgba(59, 130, 246, 0.25)" : "#1a1a1a",
        boxShadow: highlight ? "0 0 20px rgba(59, 130, 246, 0.05)" : "none",
      }}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-sm font-sans font-semibold m-0" style={{ color: "#ffffff" }}>{task.name}</p>
          <p className="text-xs font-sans mt-1 m-0 flex items-center gap-1" style={{ color: "#6b7280" }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            {task.project_name}{task.project_address ? ` — ${task.project_address}` : ""}
          </p>
        </div>
        <span className="text-[9px] font-sans font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider" style={{ background: sc.bg, color: sc.text }}>
          {sc.label}
        </span>
      </div>

      <div className="flex items-center gap-6">
        <div>
          <p className="text-[9px] font-sans uppercase tracking-wider m-0" style={{ color: "#6b7280" }}>Start</p>
          <p className="text-sm font-sans font-medium m-0 mt-0.5" style={{ color: "#d4af37" }}>
            {new Date(task.start_date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
          </p>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="1.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
        <div>
          <p className="text-[9px] font-sans uppercase tracking-wider m-0" style={{ color: "#6b7280" }}>End</p>
          <p className="text-sm font-sans font-medium m-0 mt-0.5" style={{ color: "#d4af37" }}>
            {new Date(task.end_date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
          </p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-[9px] font-sans uppercase tracking-wider m-0" style={{ color: "#6b7280" }}>Duration</p>
          <p className="text-sm font-sans font-medium m-0 mt-0.5" style={{ color: "#ffffff" }}>
            {task.duration_days} day{task.duration_days !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {task.notes && (
        <p className="text-xs font-sans mt-3 px-3 py-2 rounded-lg m-0" style={{ background: "#0a0a0a", color: "#9ca3af", borderLeft: "2px solid #d4af37" }}>
          {task.notes}
        </p>
      )}

      {/* Acknowledge button */}
      <div className="mt-4 pt-3 border-t" style={{ borderColor: "#1a1a1a" }}>
        {isAcked ? (
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: "#22c55e" }}>✓</span>
            <span className="text-xs font-sans" style={{ color: "#22c55e" }}>
              Acknowledged {new Date(task.acknowledged_at!).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
            </span>
          </div>
        ) : (
          <button
            onClick={async () => {
              setAcking(true);
              try {
                const res = await fetch("/api/scheduler/acknowledge", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ taskId: task.id, subToken: token }),
                });
                if (res.ok) onAcknowledge(task.id);
              } catch (err) {
                console.error("Acknowledge failed:", err);
              } finally {
                setAcking(false);
              }
            }}
            disabled={acking}
            className="w-full py-2 rounded-lg text-xs font-sans font-semibold uppercase tracking-wider transition-all duration-200"
            style={{
              background: acking ? "#1a1a1a" : "rgba(212, 175, 55, 0.12)",
              color: "#d4af37",
              border: "1px solid rgba(212, 175, 55, 0.2)",
            }}
          >
            {acking ? "Acknowledging..." : "✓ Acknowledge Schedule"}
          </button>
        )}
      </div>
    </div>
  );
}
