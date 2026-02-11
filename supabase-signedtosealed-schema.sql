-- Signed to Sealed — Document Signature Schema
-- Run this in the Supabase SQL Editor

-- Envelopes table (the core container)
CREATE TABLE sts_envelopes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  message TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','in_progress','completed','voided')),
  created_by TEXT DEFAULT '',
  sent_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  voided_at TIMESTAMPTZ,
  void_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Documents table (PDFs attached to envelopes)
CREATE TABLE sts_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  envelope_id UUID NOT NULL REFERENCES sts_envelopes(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER DEFAULT 0,
  page_count INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Recipients table
CREATE TABLE sts_recipients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  envelope_id UUID NOT NULL REFERENCES sts_envelopes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'signer' CHECK (role IN ('signer','cc','in_person')),
  signing_order INTEGER DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','viewed','signed','declined')),
  color_hex TEXT NOT NULL DEFAULT '#3b82f6',
  access_token UUID DEFAULT gen_random_uuid(),
  viewed_at TIMESTAMPTZ,
  signed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Fields table (signature/text/checkbox fields placed on documents)
CREATE TABLE sts_fields (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  envelope_id UUID NOT NULL REFERENCES sts_envelopes(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES sts_documents(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES sts_recipients(id) ON DELETE CASCADE,
  field_type TEXT NOT NULL DEFAULT 'signature' CHECK (field_type IN ('signature','initials','date_signed','text','checkbox','dropdown')),
  page_number INTEGER NOT NULL DEFAULT 1,
  x_position NUMERIC NOT NULL DEFAULT 0,
  y_position NUMERIC NOT NULL DEFAULT 0,
  width NUMERIC NOT NULL DEFAULT 20,
  height NUMERIC NOT NULL DEFAULT 5,
  is_required BOOLEAN DEFAULT true,
  dropdown_options JSONB DEFAULT '[]',
  field_value TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Signatures table (saved signature data)
CREATE TABLE sts_signatures (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'signature' CHECK (type IN ('signature','initials')),
  method TEXT NOT NULL DEFAULT 'draw' CHECK (method IN ('draw','type','upload')),
  data_url TEXT NOT NULL,
  font_family TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Audit log table
CREATE TABLE sts_audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  envelope_id UUID NOT NULL REFERENCES sts_envelopes(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  actor_name TEXT DEFAULT '',
  actor_email TEXT DEFAULT '',
  recipient_id UUID REFERENCES sts_recipients(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Templates table
CREATE TABLE sts_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  envelope_config JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Indexes
CREATE INDEX idx_sts_documents_envelope ON sts_documents(envelope_id);
CREATE INDEX idx_sts_recipients_envelope ON sts_recipients(envelope_id);
CREATE INDEX idx_sts_recipients_token ON sts_recipients(access_token);
CREATE INDEX idx_sts_fields_envelope ON sts_fields(envelope_id);
CREATE INDEX idx_sts_fields_document ON sts_fields(document_id);
CREATE INDEX idx_sts_fields_recipient ON sts_fields(recipient_id);
CREATE INDEX idx_sts_audit_envelope ON sts_audit_log(envelope_id);
CREATE INDEX idx_sts_envelopes_status ON sts_envelopes(status);

-- Enable RLS
ALTER TABLE sts_envelopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sts_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE sts_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE sts_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE sts_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE sts_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE sts_templates ENABLE ROW LEVEL SECURITY;

-- Allow all operations (matching existing app pattern - shared tablet, no per-user auth)
CREATE POLICY "Allow all on sts_envelopes" ON sts_envelopes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on sts_documents" ON sts_documents FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on sts_recipients" ON sts_recipients FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on sts_fields" ON sts_fields FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on sts_signatures" ON sts_signatures FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on sts_audit_log" ON sts_audit_log FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on sts_templates" ON sts_templates FOR ALL USING (true) WITH CHECK (true);

-- Storage bucket for uploaded PDFs
-- Run this separately if needed:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('sts-documents', 'sts-documents', true);
-- CREATE POLICY "Allow all on sts-documents" ON storage.objects FOR ALL USING (bucket_id = 'sts-documents') WITH CHECK (bucket_id = 'sts-documents');
