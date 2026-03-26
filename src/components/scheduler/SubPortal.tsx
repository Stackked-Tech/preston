"use client";

import { useEffect, useState } from "react";
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
      if (!isSupabaseConfigured) {
        setError("System not configured");
        setLoading(false);
        return;
      }
      try {
        const { data, error: err } = await supabase
          .from("cs_sub_tokens")
          .select("*, sub:cs_subs(*)")
          .eq("token", token)
          .single();
        if (err || !data) {
          setError("Invalid or expired link");
          return;
        }
        const tokenData = data as CSSubToken & { sub: CSSub };
        if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
          setError("This link has expired");
          return;
        }
        setSub(tokenData.sub);
      } catch {
        setError("Something went wrong");
      } finally {
        setLoading(false);
      }
    }
    loadSub();
  }, [token]);

  const { tasks, loading: tasksLoading } = useSubPortalTasks(sub?.id || null);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0a0a0a" }}>
        <p className="text-sm font-sans" style={{ color: "#9ca3af" }}>Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0a0a0a" }}>
        <div className="text-center">
          <p className="text-4xl mb-4">🔒</p>
          <p className="text-sm font-sans" style={{ color: "#ef4444" }}>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "#0a0a0a" }}>
      {/* Header */}
      <header className="px-6 py-4 border-b" style={{ borderColor: "#1f1f1f" }}>
        <p className="text-[10px] font-sans tracking-[2px] uppercase" style={{ color: "#6b7280" }}>
          WHB Companies — Subcontractor Portal
        </p>
        <h1 className="text-lg font-serif font-semibold mt-1" style={{ color: "#ffffff" }}>
          {sub?.name} — {sub?.trade}
        </h1>
        {sub?.company && (
          <p className="text-xs font-sans" style={{ color: "#9ca3af" }}>{sub.company}</p>
        )}
      </header>

      <main className="px-6 py-6 max-w-3xl">
        <h2 className="text-sm font-sans font-semibold uppercase tracking-wider mb-4" style={{ color: "#d4af37" }}>
          Upcoming Work
        </h2>

        {tasksLoading ? (
          <p className="text-sm font-sans" style={{ color: "#9ca3af" }}>Loading schedule...</p>
        ) : tasks.length === 0 ? (
          <p className="text-sm font-sans" style={{ color: "#9ca3af" }}>No upcoming tasks assigned to you.</p>
        ) : (
          <div className="space-y-3">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="p-4 rounded-xl border"
                style={{
                  background: "#111111",
                  borderColor: task.status === "delayed" ? "#ef444440" : "#1f1f1f",
                }}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-sans font-medium" style={{ color: "#ffffff" }}>{task.name}</p>
                    <p className="text-xs font-sans mt-1" style={{ color: "#9ca3af" }}>
                      📍 {task.project_name} — {task.project_address}
                    </p>
                  </div>
                  <span
                    className="text-[10px] font-sans font-medium px-2 py-0.5 rounded-full"
                    style={{
                      background:
                        task.status === "in_progress"
                          ? "rgba(59,130,246,0.15)"
                          : task.status === "delayed"
                          ? "rgba(239,68,68,0.15)"
                          : "rgba(107,114,128,0.15)",
                      color:
                        task.status === "in_progress" ? "#3b82f6" : task.status === "delayed" ? "#ef4444" : "#9ca3af",
                    }}
                  >
                    {task.status.replace("_", " ")}
                  </span>
                </div>
                <div className="flex items-center gap-4 mt-3">
                  <div>
                    <p className="text-[10px] font-sans uppercase" style={{ color: "#6b7280" }}>Start</p>
                    <p className="text-sm font-sans font-medium" style={{ color: "#d4af37" }}>
                      {new Date(task.start_date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                    </p>
                  </div>
                  <div style={{ color: "#6b7280" }}>→</div>
                  <div>
                    <p className="text-[10px] font-sans uppercase" style={{ color: "#6b7280" }}>End</p>
                    <p className="text-sm font-sans font-medium" style={{ color: "#d4af37" }}>
                      {new Date(task.end_date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                    </p>
                  </div>
                  <div className="ml-auto text-right">
                    <p className="text-[10px] font-sans uppercase" style={{ color: "#6b7280" }}>Duration</p>
                    <p className="text-sm font-sans" style={{ color: "#ffffff" }}>{task.duration_days} days</p>
                  </div>
                </div>
                {task.notes && (
                  <p className="text-xs font-sans mt-3 p-2 rounded" style={{ background: "#0a0a0a", color: "#9ca3af" }}>
                    {task.notes}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className="px-6 py-4 border-t mt-8" style={{ borderColor: "#1f1f1f" }}>
        <p className="text-[10px] font-sans" style={{ color: "#6b7280" }}>
          Questions about your schedule? Contact your project manager or reply to your notification text.
        </p>
      </footer>
    </div>
  );
}
