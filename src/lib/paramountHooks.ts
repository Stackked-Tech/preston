"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase, isSupabaseConfigured } from "./supabase";
import type {
  PCContact,
  PCContactInsert,
  PCMessage,
  PCScheduledMessage,
  PCBroadcast,
  PCBroadcastRecipient,
} from "@/types/paramount";

// ─── Phone number helpers ────────────────────────────

export function normalizePhone(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (input.startsWith("+")) return input;
  return `+${digits}`;
}

export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

// ─── Contacts ────────────────────────────────────────

export function useContacts() {
  const [contacts, setContacts] = useState<PCContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchContacts = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setError("Supabase not configured");
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const { data, error: err } = await supabase
        .from("pc_contacts")
        .select("*")
        .order("last_message_at", { ascending: false, nullsFirst: false });
      if (err) throw err;
      setContacts((data || []) as PCContact[]);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch contacts"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  // Realtime subscription for contact updates
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const channel = supabase
      .channel("pc_contacts_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pc_contacts" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setContacts((prev) => [payload.new as PCContact, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            setContacts((prev) =>
              prev
                .map((c) =>
                  c.id === (payload.new as PCContact).id
                    ? (payload.new as PCContact)
                    : c
                )
                .sort((a, b) => {
                  if (!a.last_message_at) return 1;
                  if (!b.last_message_at) return -1;
                  return (
                    new Date(b.last_message_at).getTime() -
                    new Date(a.last_message_at).getTime()
                  );
                })
            );
          } else if (payload.eventType === "DELETE") {
            setContacts((prev) =>
              prev.filter((c) => c.id !== (payload.old as { id: string }).id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const addContact = async (
    contact: PCContactInsert
  ): Promise<PCContact> => {
    const { data, error } = await supabase
      .from("pc_contacts")
      .insert({
        ...contact,
        phone_number: normalizePhone(contact.phone_number),
      })
      .select()
      .single();
    if (error) throw error;
    return data as PCContact;
  };

  const updateContact = async (
    id: string,
    updates: Partial<PCContactInsert>
  ): Promise<PCContact> => {
    const payload: Record<string, unknown> = {
      ...updates,
      updated_at: new Date().toISOString(),
    };
    if (updates.phone_number) {
      payload.phone_number = normalizePhone(updates.phone_number);
    }
    const { data, error } = await supabase
      .from("pc_contacts")
      .update(payload)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data as PCContact;
  };

  const deleteContact = async (id: string): Promise<void> => {
    const { error } = await supabase
      .from("pc_contacts")
      .delete()
      .eq("id", id);
    if (error) throw error;
  };

  return {
    contacts,
    loading,
    error,
    refetch: fetchContacts,
    addContact,
    updateContact,
    deleteContact,
  };
}

// ─── Messages ────────────────────────────────────────

export function useMessages(contactId: string | null) {
  const [messages, setMessages] = useState<PCMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchMessages = useCallback(async () => {
    if (!contactId || !isSupabaseConfigured) {
      setMessages([]);
      return;
    }
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("pc_messages")
        .select("*")
        .eq("contact_id", contactId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      setMessages((data || []) as PCMessage[]);
    } catch (err) {
      console.error("Failed to fetch messages:", err);
    } finally {
      setLoading(false);
    }
  }, [contactId]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Realtime subscription for new messages
  useEffect(() => {
    if (!contactId || !isSupabaseConfigured) return;

    // Clean up previous channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel(`pc_messages_${contactId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "pc_messages",
          filter: `contact_id=eq.${contactId}`,
        },
        (payload) => {
          const newMsg = payload.new as PCMessage;
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "pc_messages",
          filter: `contact_id=eq.${contactId}`,
        },
        (payload) => {
          const updated = payload.new as PCMessage;
          setMessages((prev) =>
            prev.map((m) => (m.id === updated.id ? updated : m))
          );
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [contactId]);

  return { messages, loading, refetch: fetchMessages };
}

// ─── Send Message ────────────────────────────────────

export function useSendMessage() {
  const [sending, setSending] = useState(false);

  const sendMessage = async (
    contactId: string,
    body: string
  ): Promise<PCMessage | null> => {
    try {
      setSending(true);
      const res = await fetch("/api/paramount/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId, body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      return data.message as PCMessage;
    } catch (err) {
      console.error("Send message failed:", err);
      throw err;
    } finally {
      setSending(false);
    }
  };

  return { sendMessage, sending };
}

// ─── Bulk Send ───────────────────────────────────────

export function useBulkSend() {
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState<{
    sent: number;
    failed: number;
    total: number;
  } | null>(null);

  const sendBulk = async (
    contactIds: string[],
    body: string,
    name?: string
  ) => {
    try {
      setSending(true);
      setProgress(null);
      const res = await fetch("/api/paramount/send-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactIds, body, name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setProgress({ sent: data.sent, failed: data.failed, total: data.total });
      return data;
    } catch (err) {
      console.error("Bulk send failed:", err);
      throw err;
    } finally {
      setSending(false);
    }
  };

  return { sendBulk, sending, progress };
}

// ─── Mark as Read ────────────────────────────────────

export async function markContactAsRead(contactId: string) {
  if (!isSupabaseConfigured) return;
  await supabase
    .from("pc_contacts")
    .update({ unread_count: 0 })
    .eq("id", contactId);
}

// ─── Scheduled Messages ──────────────────────────────

export function useScheduledMessages(contactId: string | null) {
  const [scheduled, setScheduled] = useState<PCScheduledMessage[]>([]);

  const fetchScheduled = useCallback(async () => {
    if (!contactId || !isSupabaseConfigured) {
      setScheduled([]);
      return;
    }
    const { data } = await supabase
      .from("pc_scheduled_messages")
      .select("*")
      .eq("contact_id", contactId)
      .eq("status", "pending")
      .order("scheduled_at", { ascending: true });
    setScheduled((data || []) as PCScheduledMessage[]);
  }, [contactId]);

  useEffect(() => {
    fetchScheduled();
  }, [fetchScheduled]);

  const scheduleMessage = async (
    cId: string,
    body: string,
    scheduledAt: string
  ) => {
    const res = await fetch("/api/paramount/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId: cId, body, scheduledAt }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    setScheduled((prev) => [...prev, data.scheduled as PCScheduledMessage]);
    return data.scheduled;
  };

  const cancelScheduled = async (id: string) => {
    const res = await fetch("/api/paramount/schedule", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error);
    }
    setScheduled((prev) => prev.filter((s) => s.id !== id));
  };

  return { scheduled, scheduleMessage, cancelScheduled, refetch: fetchScheduled };
}

// ─── Broadcast History ───────────────────────────────

export function useBroadcastHistory() {
  const [broadcasts, setBroadcasts] = useState<PCBroadcast[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBroadcasts = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const { data } = await supabase
        .from("pc_broadcasts")
        .select("*")
        .order("sent_at", { ascending: false });
      setBroadcasts((data || []) as PCBroadcast[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBroadcasts();
  }, [fetchBroadcasts]);

  const fetchRecipients = async (broadcastId: string) => {
    const { data } = await supabase
      .from("pc_broadcast_recipients")
      .select("*, pc_contacts(name, phone_number)")
      .eq("broadcast_id", broadcastId);
    return (data || []) as (PCBroadcastRecipient & {
      pc_contacts: { name: string; phone_number: string } | null;
    })[];
  };

  return { broadcasts, loading, refetch: fetchBroadcasts, fetchRecipients };
}

// ─── Message Search ──────────────────────────────────

export interface SearchResult {
  id: string;
  contact_id: string;
  body: string;
  direction: "inbound" | "outbound";
  created_at: string;
  pc_contacts: { name: string; phone_number: string } | null;
}

export function useMessageSearch() {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  const search = useCallback(async (query: string) => {
    if (!query.trim() || !isSupabaseConfigured) {
      setResults([]);
      return;
    }
    try {
      setSearching(true);
      const { data } = await supabase
        .from("pc_messages")
        .select("id, contact_id, body, direction, created_at, pc_contacts(name, phone_number)")
        .ilike("body", `%${query.trim()}%`)
        .order("created_at", { ascending: false })
        .limit(50);
      setResults(
        (data || []).map((row: Record<string, unknown>) => ({
          ...row,
          pc_contacts: Array.isArray(row.pc_contacts)
            ? row.pc_contacts[0] ?? null
            : row.pc_contacts ?? null,
        })) as SearchResult[]
      );
    } finally {
      setSearching(false);
    }
  }, []);

  const clearResults = useCallback(() => setResults([]), []);

  return { results, searching, search, clearResults };
}
