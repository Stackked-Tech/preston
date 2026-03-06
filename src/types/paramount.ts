// ═══════════════════════════════════════════════════
// Paramount Communications Types
// ═══════════════════════════════════════════════════

export interface PCContact {
  id: string;
  name: string;
  phone_number: string;
  email: string | null;
  notes: string | null;
  tags: string[];
  is_active: boolean;
  unread_count: number;
  last_message_at: string | null;
  last_message_preview: string | null;
  created_at: string;
  updated_at: string;
}

export type PCContactInsert = Omit<PCContact, "id" | "created_at" | "updated_at" | "last_message_at" | "last_message_preview" | "unread_count"> & { unread_count?: number };

export interface PCMessage {
  id: string;
  contact_id: string;
  direction: "inbound" | "outbound";
  body: string;
  status: "queued" | "sent" | "delivered" | "undelivered" | "failed" | "received";
  twilio_sid: string | null;
  created_at: string;
}

export interface PCBroadcast {
  id: string;
  name: string | null;
  body: string;
  recipient_count: number;
  sent_at: string;
  created_at: string;
}

export interface PCBroadcastRecipient {
  id: string;
  broadcast_id: string;
  contact_id: string;
  message_id: string | null;
  status: "pending" | "sent" | "delivered" | "failed";
  created_at: string;
}

export interface PCScheduledMessage {
  id: string;
  contact_id: string;
  body: string;
  scheduled_at: string;
  status: "pending" | "sent" | "cancelled" | "failed";
  message_id: string | null;
  created_at: string;
}

export interface PCMessageSearchResult extends PCMessage {
  contact_name: string;
  contact_phone: string;
}

export interface PCBroadcastWithStats extends PCBroadcast {
  delivered_count: number;
  failed_count: number;
}
