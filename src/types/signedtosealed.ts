// ─── Signed to Sealed Types ──────────────────────────────

export type EnvelopeStatus = 'draft' | 'sent' | 'in_progress' | 'completed' | 'voided';
export type RecipientRole = 'signer' | 'cc' | 'in_person';
export type RecipientStatus = 'pending' | 'viewed' | 'signed' | 'declined';
export type FieldType = 'signature' | 'initials' | 'date_signed' | 'text' | 'checkbox' | 'dropdown';
export type SignatureType = 'signature' | 'initials';
export type SignatureMethod = 'draw' | 'type' | 'upload';

// ─── Envelopes ───────────────────────────────────────────

export interface STSEnvelope {
  id: string;
  title: string;
  message: string;
  status: EnvelopeStatus;
  created_by: string;
  sent_at: string | null;
  completed_at: string | null;
  voided_at: string | null;
  void_reason: string | null;
  created_at: string;
  updated_at: string;
}

export type STSEnvelopeInsert = Omit<STSEnvelope, 'id' | 'created_at' | 'updated_at' | 'sent_at' | 'completed_at' | 'voided_at' | 'void_reason'>;
export type STSEnvelopeUpdate = Partial<Omit<STSEnvelope, 'id' | 'created_at'>>;

// ─── Documents ───────────────────────────────────────────

export interface STSDocument {
  id: string;
  envelope_id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  page_count: number;
  sort_order: number;
  created_at: string;
}

export type STSDocumentInsert = Omit<STSDocument, 'id' | 'created_at'>;

// ─── Recipients ──────────────────────────────────────────

export interface STSRecipient {
  id: string;
  envelope_id: string;
  name: string;
  email: string;
  role: RecipientRole;
  signing_order: number;
  status: RecipientStatus;
  color_hex: string;
  access_token: string;
  viewed_at: string | null;
  signed_at: string | null;
  created_at: string;
  updated_at: string;
}

export type STSRecipientInsert = Omit<STSRecipient, 'id' | 'created_at' | 'updated_at' | 'access_token' | 'viewed_at' | 'signed_at'>;
export type STSRecipientUpdate = Partial<Omit<STSRecipient, 'id' | 'created_at' | 'access_token'>>;

// ─── Fields ──────────────────────────────────────────────

export interface STSField {
  id: string;
  envelope_id: string;
  document_id: string;
  recipient_id: string;
  field_type: FieldType;
  page_number: number;
  x_position: number;
  y_position: number;
  width: number;
  height: number;
  is_required: boolean;
  dropdown_options: string[];
  field_value: string | null;
  created_at: string;
}

export type STSFieldInsert = Omit<STSField, 'id' | 'created_at' | 'field_value'>;
export type STSFieldUpdate = Partial<Omit<STSField, 'id' | 'created_at'>>;

// ─── Signatures ──────────────────────────────────────────

export interface STSSignature {
  id: string;
  name: string;
  type: SignatureType;
  method: SignatureMethod;
  data_url: string;
  font_family: string | null;
  is_default: boolean;
  created_at: string;
}

export type STSSignatureInsert = Omit<STSSignature, 'id' | 'created_at'>;

// ─── Audit Log ───────────────────────────────────────────

export interface STSAuditEntry {
  id: string;
  envelope_id: string;
  event_type: string;
  actor_name: string;
  actor_email: string;
  recipient_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export type STSAuditInsert = Omit<STSAuditEntry, 'id' | 'created_at'>;

// ─── Templates ───────────────────────────────────────────

export interface STSTemplate {
  id: string;
  name: string;
  description: string;
  envelope_config: STSTemplateConfig;
  created_at: string;
  updated_at: string;
}

export interface STSTemplateConfig {
  title?: string;
  message?: string;
  roles?: { name: string; role: RecipientRole; signing_order: number }[];
  fields?: Omit<STSFieldInsert, 'envelope_id' | 'document_id' | 'recipient_id'>[];
}

export type STSTemplateInsert = Omit<STSTemplate, 'id' | 'created_at' | 'updated_at'>;
export type STSTemplateUpdate = Partial<Omit<STSTemplate, 'id' | 'created_at'>>;

// ─── Composite Types ─────────────────────────────────────

export interface STSEnvelopeDetail extends STSEnvelope {
  documents: STSDocument[];
  recipients: STSRecipient[];
  fields: STSField[];
}

export type STSView = 'dashboard' | 'create' | 'detail' | 'signing' | 'templates';

// ─── Constants ───────────────────────────────────────────

export const RECIPIENT_COLORS = [
  '#3b82f6', // blue
  '#ef4444', // red
  '#10b981', // green
  '#f59e0b', // amber
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
];

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  signature: 'Signature',
  initials: 'Initials',
  date_signed: 'Date Signed',
  text: 'Text',
  checkbox: 'Checkbox',
  dropdown: 'Dropdown',
};

export const STATUS_LABELS: Record<EnvelopeStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  in_progress: 'In Progress',
  completed: 'Completed',
  voided: 'Voided',
};
