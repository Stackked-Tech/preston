-- Signed to Sealed — Template Documents & Fields Migration
-- Run this in the Supabase SQL Editor

-- Template documents table (PDFs stored with templates)
CREATE TABLE sts_template_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES sts_templates(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER DEFAULT 0,
  page_count INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Template fields table (pre-placed fields on template documents)
CREATE TABLE sts_template_fields (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES sts_templates(id) ON DELETE CASCADE,
  template_document_id UUID NOT NULL REFERENCES sts_template_documents(id) ON DELETE CASCADE,
  role_name TEXT NOT NULL,
  field_type TEXT NOT NULL DEFAULT 'signature' CHECK (field_type IN ('signature','initials','date_signed','text','checkbox','dropdown')),
  fill_mode TEXT NOT NULL DEFAULT 'recipient' CHECK (fill_mode IN ('sender','recipient')),
  label TEXT DEFAULT '',
  page_number INTEGER NOT NULL DEFAULT 1,
  x_position NUMERIC NOT NULL DEFAULT 0,
  y_position NUMERIC NOT NULL DEFAULT 0,
  width NUMERIC NOT NULL DEFAULT 20,
  height NUMERIC NOT NULL DEFAULT 5,
  is_required BOOLEAN DEFAULT true,
  dropdown_options JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Add fill_mode to sts_fields for envelopes created from templates
ALTER TABLE sts_fields ADD COLUMN IF NOT EXISTS fill_mode TEXT DEFAULT 'recipient' CHECK (fill_mode IN ('sender','recipient'));
-- Add label to sts_fields for sender-fill fields
ALTER TABLE sts_fields ADD COLUMN IF NOT EXISTS label TEXT DEFAULT '';

-- Indexes
CREATE INDEX idx_sts_template_documents_template ON sts_template_documents(template_id);
CREATE INDEX idx_sts_template_fields_template ON sts_template_fields(template_id);
CREATE INDEX idx_sts_template_fields_document ON sts_template_fields(template_document_id);

-- Enable RLS
ALTER TABLE sts_template_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE sts_template_fields ENABLE ROW LEVEL SECURITY;

-- Allow all operations (matching existing app pattern)
CREATE POLICY "Allow all on sts_template_documents" ON sts_template_documents FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on sts_template_fields" ON sts_template_fields FOR ALL USING (true) WITH CHECK (true);
