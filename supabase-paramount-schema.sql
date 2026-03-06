-- ═══════════════════════════════════════════════════
-- Paramount Communications — SMS Portal
-- Tables use pc_ prefix
-- ═══════════════════════════════════════════════════

-- Contacts
CREATE TABLE pc_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone_number TEXT NOT NULL UNIQUE,
  email TEXT,
  notes TEXT,
  tags TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  unread_count INTEGER DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messages
CREATE TABLE pc_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES pc_contacts(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  body TEXT NOT NULL,
  status TEXT DEFAULT 'sent' CHECK (status IN ('queued', 'sent', 'delivered', 'undelivered', 'failed', 'received')),
  twilio_sid TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Broadcasts (bulk messages)
CREATE TABLE pc_broadcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  body TEXT NOT NULL,
  recipient_count INTEGER DEFAULT 0,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Broadcast recipients
CREATE TABLE pc_broadcast_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcast_id UUID NOT NULL REFERENCES pc_broadcasts(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES pc_contacts(id) ON DELETE CASCADE,
  message_id UUID REFERENCES pc_messages(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_pc_messages_contact ON pc_messages(contact_id, created_at DESC);
CREATE INDEX idx_pc_messages_created ON pc_messages(created_at DESC);
CREATE INDEX idx_pc_contacts_phone ON pc_contacts(phone_number);
CREATE INDEX idx_pc_contacts_last_msg ON pc_contacts(last_message_at DESC NULLS LAST);
CREATE INDEX idx_pc_broadcast_recipients ON pc_broadcast_recipients(broadcast_id);

-- RLS policies (permissive, matching project pattern)
ALTER TABLE pc_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE pc_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE pc_broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE pc_broadcast_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on pc_contacts" ON pc_contacts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on pc_messages" ON pc_messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on pc_broadcasts" ON pc_broadcasts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on pc_broadcast_recipients" ON pc_broadcast_recipients FOR ALL USING (true) WITH CHECK (true);

-- Scheduled messages
CREATE TABLE pc_scheduled_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES pc_contacts(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'cancelled', 'failed')),
  message_id UUID REFERENCES pc_messages(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pc_scheduled_pending ON pc_scheduled_messages(scheduled_at) WHERE status = 'pending';
CREATE INDEX idx_pc_scheduled_contact ON pc_scheduled_messages(contact_id) WHERE status = 'pending';

-- Full-text search index on messages
CREATE INDEX idx_pc_messages_body_search ON pc_messages USING gin(to_tsvector('english', body));

ALTER TABLE pc_scheduled_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on pc_scheduled_messages" ON pc_scheduled_messages FOR ALL USING (true) WITH CHECK (true);

-- Enable realtime for messages and contacts
ALTER PUBLICATION supabase_realtime ADD TABLE pc_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE pc_contacts;
