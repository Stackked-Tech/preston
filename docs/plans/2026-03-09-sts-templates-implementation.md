# Signed to Sealed — PDF-Backed Templates Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add PDF-backed fillable form templates to Signed to Sealed — users upload PDFs, pre-place fields with sender/recipient fill modes, save as reusable templates, and create envelopes from them with a "pull, fill, and go" flow.

**Architecture:** Extend the existing template system with two new DB tables (`sts_template_documents`, `sts_template_fields`) for storing PDFs and field placements. Templates reference roles (not people) — when used, a role mapping modal maps roles to real recipients, copies documents and fields into a new envelope. The existing `DocumentViewer` and `FieldPalette` components are reused for template field placement with minor adaptations for role-based assignment and fill mode toggling.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Supabase (PostgreSQL + Storage), Tailwind CSS 3, react-pdf/pdfjs-dist

**Design Doc:** `docs/plans/2026-03-09-sts-templates-design.md`

**No test framework configured** — verification is manual (dev server + browser).

---

## Task 1: Database Schema — New Tables

**Files:**
- Create: `supabase-sts-templates-migration.sql` (run manually in Supabase SQL Editor)
- Modify: `supabase-signedtosealed-schema.sql` (append new tables for reference)

**Step 1: Write migration SQL**

Create `supabase-sts-templates-migration.sql` at project root:

```sql
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
```

**Step 2: Append to reference schema**

Add the new table definitions to the end of `supabase-signedtosealed-schema.sql` (after the storage bucket comment) so the full schema is documented in one place.

**Step 3: Verify**

Run the migration SQL in Supabase SQL Editor. Confirm tables exist:
```sql
SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'sts_template%';
```

**Step 4: Commit**
```bash
git add supabase-sts-templates-migration.sql supabase-signedtosealed-schema.sql
git commit -m "feat(sts): add template documents and fields database tables"
```

---

## Task 2: Type Definitions

**Files:**
- Modify: `src/types/signedtosealed.ts`

**Step 1: Add new types after existing STSTemplate types**

Add after line 136 (after `STSTemplateUpdate`):

```typescript
// ─── Template Documents ─────────────────────────────────

export interface STSTemplateDocument {
  id: string;
  template_id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  page_count: number;
  sort_order: number;
  created_at: string;
}

export type STSTemplateDocumentInsert = Omit<STSTemplateDocument, 'id' | 'created_at'>;

// ─── Template Fields ────────────────────────────────────

export type FillMode = 'sender' | 'recipient';

export interface STSTemplateField {
  id: string;
  template_id: string;
  template_document_id: string;
  role_name: string;
  field_type: FieldType;
  fill_mode: FillMode;
  label: string;
  page_number: number;
  x_position: number;
  y_position: number;
  width: number;
  height: number;
  is_required: boolean;
  dropdown_options: string[];
  created_at: string;
}

export type STSTemplateFieldInsert = Omit<STSTemplateField, 'id' | 'created_at'>;
export type STSTemplateFieldUpdate = Partial<Omit<STSTemplateField, 'id' | 'created_at'>>;
```

**Step 2: Add fill_mode and label to STSField**

Update `STSField` interface (around line 67) to add:
```typescript
  fill_mode: FillMode | null;
  label: string | null;
```

Update `STSFieldInsert` to include `fill_mode` and `label` as optional:
```typescript
export type STSFieldInsert = Omit<STSField, 'id' | 'created_at' | 'field_value'> & { fill_mode?: FillMode | null; label?: string | null };
```

**Step 3: Add STSTemplateDetail composite type**

Add after the `STSEnvelopeDetail` interface:
```typescript
export interface STSTemplateDetail extends STSTemplate {
  documents: STSTemplateDocument[];
  fields: STSTemplateField[];
}
```

**Step 4: Update STSView to include new views**

Update the `STSView` type:
```typescript
export type STSView = 'dashboard' | 'create' | 'detail' | 'signing' | 'templates' | 'template-builder';
```

**Step 5: Verify** — Run `npx tsc --noEmit` to confirm types compile.

**Step 6: Commit**
```bash
git add src/types/signedtosealed.ts
git commit -m "feat(sts): add template document and field type definitions"
```

---

## Task 3: Template Hooks — Documents & Fields CRUD

**Files:**
- Modify: `src/lib/signedToSealedHooks.ts`

**Step 1: Add useTemplateDocuments hook**

Add after `useTemplates()` (around line 480), before `useSigningByToken`:

```typescript
// ─── Template Documents ─────────────────────────────────

export function useTemplateDocuments(templateId: string | null) {
  const [documents, setDocuments] = useState<STSTemplateDocument[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDocuments = useCallback(async () => {
    if (!isSupabaseConfigured || !templateId) {
      setDocuments([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("sts_template_documents")
        .select("*")
        .eq("template_id", templateId)
        .order("sort_order");
      if (error) throw toError(error);
      setDocuments((data || []) as STSTemplateDocument[]);
    } finally {
      setLoading(false);
    }
  }, [templateId]);

  useEffect(() => { fetchDocuments(); }, [fetchDocuments]);

  const uploadTemplateDocument = async (file: File, sortOrder: number): Promise<STSTemplateDocument> => {
    if (!templateId) throw new Error("No template ID");
    const filePath = `templates/${templateId}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage.from("sts-documents").upload(filePath, file);
    if (uploadError) throw toError(uploadError);

    const { data, error } = await supabase
      .from("sts_template_documents")
      .insert({ template_id: templateId, file_name: file.name, file_path: filePath, file_size: file.size, page_count: 1, sort_order: sortOrder })
      .select()
      .single();
    if (error) throw toError(error);
    const doc = data as STSTemplateDocument;
    setDocuments((prev) => [...prev, doc]);
    return doc;
  };

  const updatePageCount = async (docId: string, pageCount: number) => {
    await supabase.from("sts_template_documents").update({ page_count: pageCount }).eq("id", docId);
    setDocuments((prev) => prev.map((d) => d.id === docId ? { ...d, page_count: pageCount } : d));
  };

  const deleteTemplateDocument = async (docId: string, filePath: string) => {
    await supabase.storage.from("sts-documents").remove([filePath]);
    await supabase.from("sts_template_documents").delete().eq("id", docId);
    setDocuments((prev) => prev.filter((d) => d.id !== docId));
  };

  const getPublicUrl = (filePath: string): string => {
    const { data } = supabase.storage.from("sts-documents").getPublicUrl(filePath);
    return data.publicUrl;
  };

  return { documents, loading, refetch: fetchDocuments, uploadTemplateDocument, updatePageCount, deleteTemplateDocument, getPublicUrl };
}
```

**Step 2: Add useTemplateFields hook**

Add after `useTemplateDocuments`:

```typescript
// ─── Template Fields ────────────────────────────────────

export function useTemplateFields(templateId: string | null) {
  const [fields, setFields] = useState<STSTemplateField[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFields = useCallback(async () => {
    if (!isSupabaseConfigured || !templateId) {
      setFields([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("sts_template_fields")
        .select("*")
        .eq("template_id", templateId);
      if (error) throw toError(error);
      setFields((data || []) as STSTemplateField[]);
    } finally {
      setLoading(false);
    }
  }, [templateId]);

  useEffect(() => { fetchFields(); }, [fetchFields]);

  const addTemplateField = async (insert: STSTemplateFieldInsert): Promise<STSTemplateField> => {
    const { data, error } = await supabase
      .from("sts_template_fields")
      .insert(insert)
      .select()
      .single();
    if (error) throw toError(error);
    const field = data as STSTemplateField;
    setFields((prev) => [...prev, field]);
    return field;
  };

  const updateTemplateField = async (id: string, updates: STSTemplateFieldUpdate) => {
    const { error } = await supabase.from("sts_template_fields").update(updates).eq("id", id);
    if (error) throw toError(error);
    setFields((prev) => prev.map((f) => f.id === id ? { ...f, ...updates } : f));
  };

  const removeTemplateField = async (id: string) => {
    const { error } = await supabase.from("sts_template_fields").delete().eq("id", id);
    if (error) throw toError(error);
    setFields((prev) => prev.filter((f) => f.id !== id));
  };

  return { fields, loading, refetch: fetchFields, addTemplateField, updateTemplateField, removeTemplateField };
}
```

**Step 3: Add useTemplateDetail hook**

Add a convenience hook that fetches a single template with its documents and fields:

```typescript
export function useTemplateDetail(templateId: string | null) {
  const [template, setTemplate] = useState<STSTemplate | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDetail = useCallback(async () => {
    if (!isSupabaseConfigured || !templateId) {
      setTemplate(null);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("sts_templates")
        .select("*")
        .eq("id", templateId)
        .single();
      if (error) throw toError(error);
      setTemplate(data as STSTemplate);
    } finally {
      setLoading(false);
    }
  }, [templateId]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);

  return { template, loading, refetch: fetchDetail };
}
```

**Step 4: Add import for new types at the top of the file**

Update the import statement to include:
```typescript
import type {
  // ... existing imports ...
  STSTemplateDocument,
  STSTemplateDocumentInsert,
  STSTemplateField,
  STSTemplateFieldInsert,
  STSTemplateFieldUpdate,
  FillMode,
} from "@/types/signedtosealed";
```

**Step 5: Verify** — `npx tsc --noEmit`

**Step 6: Commit**
```bash
git add src/lib/signedToSealedHooks.ts
git commit -m "feat(sts): add template document and field CRUD hooks"
```

---

## Task 4: Template Builder Component

**Files:**
- Create: `src/components/signed-to-sealed/TemplateBuilder.tsx`

This is the full template creation/editing experience — PDF upload, role management, field placement with fill mode toggles. It reuses `DocumentViewer` and adapts `FieldPalette` for role-based assignment.

**Step 1: Create TemplateBuilder component**

Create `src/components/signed-to-sealed/TemplateBuilder.tsx`. Key structure:

- **Props:** `templateId: string | null` (null = new), `onComplete: () => void`, `onCancel: () => void`
- **State:** Steps similar to EnvelopeWizard but with 3 steps: (1) Details + Upload, (2) Roles, (3) Place Fields
- **Uses:** `useTemplates`, `useTemplateDocuments`, `useTemplateFields`, `useTemplateDetail`

The component should:

1. **Step 1 (Details + Upload):** Template name, description, default envelope title/message, PDF upload area (same pattern as EnvelopeWizard step 0 but using `uploadTemplateDocument`)
2. **Step 2 (Roles):** Role management (name, type, signing order) — reuse the same UI pattern from existing TemplateManager form
3. **Step 3 (Place Fields):** Left sidebar shows roles (instead of recipients) with their assigned colors from `RECIPIENT_COLORS`. Each role acts like a "recipient" for field placement purposes. The `DocumentViewer` renders the template PDF. Fields are dragged onto the PDF.
   - **Key difference from EnvelopeWizard:** Each field also gets:
     - A `fill_mode` toggle (sender/recipient) — small toggle button on the field overlay
     - A `label` input (for sender fields, shown when creating envelope)
   - Fields are colored by role (using `RECIPIENT_COLORS` by role index)
   - Fields use `role_name` instead of `recipient_id`

For field placement, create a "role as recipient" adapter:
```typescript
// Convert roles to pseudo-recipients for DocumentViewer compatibility
const pseudoRecipients: STSRecipient[] = roles.map((role, i) => ({
  id: role.name, // use role name as pseudo-ID
  envelope_id: "",
  name: role.name,
  email: "",
  role: role.role,
  signing_order: role.signing_order,
  status: "pending" as RecipientStatus,
  color_hex: RECIPIENT_COLORS[i % RECIPIENT_COLORS.length],
  access_token: "",
  viewed_at: null,
  signed_at: null,
  created_at: "",
  updated_at: "",
}));
```

For the field drop handler, map the pseudo recipient_id (role name) to `role_name`:
```typescript
const handleDropField = async (fieldType: FieldType, roleName: string, page: number, xPct: number, yPct: number) => {
  if (!templateId || documents.length === 0) return;
  const doc = documents[selectedDocIndex];
  if (!doc) return;
  // ... same width/height logic as EnvelopeWizard ...
  await addTemplateField({
    template_id: templateId,
    template_document_id: doc.id,
    role_name: roleName,
    field_type: fieldType,
    fill_mode: "recipient",
    label: "",
    page_number: page,
    x_position: xPct,
    y_position: yPct,
    width, height,
    is_required: true,
    dropdown_options: [],
  });
};
```

For viewing template fields in DocumentViewer, map them to STSField format:
```typescript
const fieldsAsSTSFields: STSField[] = templateFields
  .filter((f) => f.template_document_id === documents[selectedDocIndex]?.id)
  .map((f) => ({
    id: f.id,
    envelope_id: "",
    document_id: f.template_document_id,
    recipient_id: f.role_name, // maps to pseudo-recipient id
    field_type: f.field_type,
    page_number: f.page_number,
    x_position: f.x_position,
    y_position: f.y_position,
    width: f.width,
    height: f.height,
    is_required: f.is_required,
    dropdown_options: f.dropdown_options,
    field_value: null,
    fill_mode: f.fill_mode,
    label: f.label,
    created_at: f.created_at,
  }));
```

Add a fill mode toggle overlay on each field. When a field is clicked in the template builder, show a small popover with:
- Fill Mode: [Sender] [Recipient] toggle buttons
- Label: text input (visible when fill_mode = "sender")

Save changes via `updateTemplateField()`.

**Step 2: Verify** — Load `/signed-to-sealed`, navigate to Templates, click New Template, verify 3-step flow works.

**Step 3: Commit**
```bash
git add src/components/signed-to-sealed/TemplateBuilder.tsx
git commit -m "feat(sts): add TemplateBuilder component with PDF upload and field placement"
```

---

## Task 5: Update TemplateManager with Builder Integration

**Files:**
- Modify: `src/components/signed-to-sealed/TemplateManager.tsx`
- Modify: `src/components/signed-to-sealed/SignedToSealed.tsx`

**Step 1: Enhance TemplateManager**

Update `TemplateManager` to:
- Show richer template cards: document count, field count, page count (fetch from `sts_template_documents` and `sts_template_fields` via counts)
- Add "Use" button on each card that calls `onUseTemplate(templateId)`
- Add "Duplicate" button that duplicates a template (copies template record + documents + fields)
- Replace the existing inline form with navigation to TemplateBuilder (via `onEditTemplate(templateId)` and `onNewTemplate()` callbacks)

Update props:
```typescript
interface TemplateManagerProps {
  onBack: () => void;
  onNewTemplate: () => void;
  onEditTemplate: (templateId: string) => void;
  onUseTemplate: (templateId: string) => void;
}
```

Remove the inline form logic (name, description, roles editing) — that's now in TemplateBuilder.

**Step 2: Update SignedToSealed orchestrator**

Add `template-builder` view and wire up the new callbacks:
```typescript
const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);

// In view routing:
{view === "template-builder" && (
  <TemplateBuilder
    templateId={editingTemplateId}
    onComplete={() => { setEditingTemplateId(null); setView("templates"); }}
    onCancel={() => { setEditingTemplateId(null); setView("templates"); }}
  />
)}

// Update TemplateManager usage:
{view === "templates" && (
  <TemplateManager
    onBack={handleBackToDashboard}
    onNewTemplate={() => { setEditingTemplateId(null); setView("template-builder"); }}
    onEditTemplate={(id) => { setEditingTemplateId(id); setView("template-builder"); }}
    onUseTemplate={(id) => handleUseTemplate(id)}
  />
)}
```

**Step 3: Verify** — Navigate Templates → New Template opens builder. Edit button opens builder with existing template loaded.

**Step 4: Commit**
```bash
git add src/components/signed-to-sealed/TemplateManager.tsx src/components/signed-to-sealed/SignedToSealed.tsx
git commit -m "feat(sts): integrate TemplateBuilder into TemplateManager and orchestrator"
```

---

## Task 6: Template Picker Modal (Dashboard Create Flow)

**Files:**
- Create: `src/components/signed-to-sealed/TemplatePickerModal.tsx`
- Modify: `src/components/signed-to-sealed/SignedToSealed.tsx`

**Step 1: Create TemplatePickerModal**

When user clicks "+ New Envelope" on dashboard, show a modal with:
- "Blank Envelope" option (large card, top)
- Divider: "— or start from a template —"
- Grid/list of saved templates (name, description, doc count, field count)
- Each template card is clickable → triggers `onSelectTemplate(templateId)`

```typescript
interface TemplatePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBlankEnvelope: () => void;
  onSelectTemplate: (templateId: string) => void;
}
```

Uses `useTemplates()` to fetch template list. Show document/field counts by also querying template_documents and template_fields counts (or store counts in envelope_config).

**Step 2: Wire into SignedToSealed**

Replace `handleCreateNew` to show the picker modal instead of going directly to the wizard:
```typescript
const [showTemplatePicker, setShowTemplatePicker] = useState(false);

// "+ New Envelope" button → setShowTemplatePicker(true)
// Blank → old handleCreateNew behavior
// Template selected → handleUseTemplate(templateId)
```

**Step 3: Verify** — Click "+ New Envelope", see modal with blank option and template list.

**Step 4: Commit**
```bash
git add src/components/signed-to-sealed/TemplatePickerModal.tsx src/components/signed-to-sealed/SignedToSealed.tsx
git commit -m "feat(sts): add template picker modal to envelope creation flow"
```

---

## Task 7: Role Mapping Modal + Envelope Creation from Template

**Files:**
- Create: `src/components/signed-to-sealed/RoleMappingModal.tsx`
- Modify: `src/components/signed-to-sealed/SignedToSealed.tsx`
- Modify: `src/lib/signedToSealedHooks.ts`

**Step 1: Create RoleMappingModal**

When a template is selected (from picker or Templates section), show a modal:
- Title: "Create Envelope from [Template Name]"
- For each role in `envelope_config.roles[]`:
  - Role label (e.g., "Contractor")
  - Name input
  - Email input
- "Create Envelope" button

```typescript
interface RoleMappingModalProps {
  isOpen: boolean;
  template: STSTemplate;
  templateDocuments: STSTemplateDocument[];
  templateFields: STSTemplateField[];
  onClose: () => void;
  onCreate: (mappings: { roleName: string; name: string; email: string; role: RecipientRole; signing_order: number }[]) => void;
}
```

**Step 2: Add createEnvelopeFromTemplate helper**

Add to `signedToSealedHooks.ts` or as a utility function — this orchestrates:
1. Create envelope with template title & message
2. Copy template documents → envelope documents (copy files in storage)
3. Create recipients from role mappings (assign colors, tokens auto-generated)
4. Clone template fields → envelope fields (remap template_document_id → document_id, role_name → recipient_id, copy fill_mode and label)

```typescript
export async function createEnvelopeFromTemplate(
  template: STSTemplate,
  templateDocuments: STSTemplateDocument[],
  templateFields: STSTemplateField[],
  roleMappings: { roleName: string; name: string; email: string; role: RecipientRole; signing_order: number }[]
): Promise<{ envelopeId: string }> {
  // 1. Create envelope
  const { data: env, error: envError } = await supabase
    .from("sts_envelopes")
    .insert({ title: template.envelope_config.title || template.name, message: template.envelope_config.message || "", status: "draft", created_by: "" })
    .select().single();
  if (envError) throw toError(envError);

  // 2. Copy documents (copy storage files, create sts_documents records)
  const docIdMap: Record<string, string> = {}; // templateDocId → newDocId
  for (const templateDoc of templateDocuments) {
    const newPath = `${env.id}/${Date.now()}_${templateDoc.file_name}`;
    const { error: copyError } = await supabase.storage.from("sts-documents").copy(templateDoc.file_path, newPath);
    if (copyError) throw toError(copyError);

    const { data: newDoc, error: docError } = await supabase
      .from("sts_documents")
      .insert({ envelope_id: env.id, file_name: templateDoc.file_name, file_path: newPath, file_size: templateDoc.file_size, page_count: templateDoc.page_count, sort_order: templateDoc.sort_order })
      .select().single();
    if (docError) throw toError(docError);
    docIdMap[templateDoc.id] = newDoc.id;
  }

  // 3. Create recipients from mappings
  const roleToRecipientId: Record<string, string> = {};
  for (let i = 0; i < roleMappings.length; i++) {
    const mapping = roleMappings[i];
    const { data: recip, error: recipError } = await supabase
      .from("sts_recipients")
      .insert({ envelope_id: env.id, name: mapping.name, email: mapping.email, role: mapping.role, signing_order: mapping.signing_order, status: "pending", color_hex: RECIPIENT_COLORS[i % RECIPIENT_COLORS.length] })
      .select().single();
    if (recipError) throw toError(recipError);
    roleToRecipientId[mapping.roleName] = recip.id;
  }

  // 4. Clone fields
  for (const templateField of templateFields) {
    const newDocId = docIdMap[templateField.template_document_id];
    const recipientId = roleToRecipientId[templateField.role_name];
    if (!newDocId || !recipientId) continue;

    await supabase.from("sts_fields").insert({
      envelope_id: env.id,
      document_id: newDocId,
      recipient_id: recipientId,
      field_type: templateField.field_type,
      fill_mode: templateField.fill_mode,
      label: templateField.label,
      page_number: templateField.page_number,
      x_position: templateField.x_position,
      y_position: templateField.y_position,
      width: templateField.width,
      height: templateField.height,
      is_required: templateField.is_required,
      dropdown_options: templateField.dropdown_options,
    });
  }

  return { envelopeId: env.id };
}
```

**Step 3: Wire into SignedToSealed**

After role mapping modal submits:
1. Call `createEnvelopeFromTemplate()`
2. Open EnvelopeWizard with the new envelope ID, starting at step 2 (field placement)

Add `initialStep` prop to EnvelopeWizard:
```typescript
interface EnvelopeWizardProps {
  envelopeId: string | null;
  initialStep?: number; // NEW — default 0
  onComplete: (sentEnvelopeId?: string) => void;
  onCancel: () => void;
}
```

Update `useState(0)` → `useState(initialStep ?? 0)` in EnvelopeWizard.

**Step 4: Verify** — Select template → fill in role names/emails → envelope created with documents, recipients, and fields pre-placed. Wizard opens at step 2.

**Step 5: Commit**
```bash
git add src/components/signed-to-sealed/RoleMappingModal.tsx src/components/signed-to-sealed/SignedToSealed.tsx src/lib/signedToSealedHooks.ts src/components/signed-to-sealed/EnvelopeWizard.tsx
git commit -m "feat(sts): add role mapping modal and envelope creation from template"
```

---

## Task 8: Sender Field Visual Treatment

**Files:**
- Modify: `src/components/signed-to-sealed/DocumentViewer.tsx`

**Step 1: Update field overlay rendering**

In `DocumentViewer`, where fields are rendered as positioned divs, check for `fill_mode`:
- **Sender fields** (`fill_mode === 'sender'`): Gold solid border (`#d4af37`), show label text inside, editable background
- **Recipient fields** (default): Current dashed border with recipient color (no change)

The field overlay rendering logic should check:
```typescript
const isSenderField = field.fill_mode === 'sender';

// Border style
const borderStyle = isSenderField
  ? `2px solid #d4af37`
  : `2px dashed ${recipientColor}`;

// Label display
const displayLabel = isSenderField && field.label ? field.label : FIELD_TYPE_LABELS[field.field_type];
```

**Step 2: Verify** — Open an envelope created from a template. Sender fields show gold border with label. Recipient fields show normal dashed border.

**Step 3: Commit**
```bash
git add src/components/signed-to-sealed/DocumentViewer.tsx
git commit -m "feat(sts): add gold border visual treatment for sender-fill fields"
```

---

## Task 9: "Save as Template" from EnvelopeWizard

**Files:**
- Create: `src/components/signed-to-sealed/SaveAsTemplateModal.tsx`
- Modify: `src/components/signed-to-sealed/EnvelopeWizard.tsx`

**Step 1: Create SaveAsTemplateModal**

Modal with:
- Template name input (required)
- Description input (optional)
- For each recipient in the envelope: a role name input (e.g., "John Smith" → user types "Buyer")
- "Save Template" button

```typescript
interface SaveAsTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipients: STSRecipient[];
  documents: STSDocument[];
  fields: STSField[];
  title: string;
  message: string;
  onSaved: () => void;
}
```

On save:
1. Create `sts_templates` record with `envelope_config` (title, message, roles from mapped names)
2. Copy envelope documents → `templates/{templateId}/` in storage, create `sts_template_documents`
3. Clone fields → `sts_template_fields` with `recipient_id` mapped back to `role_name` (via the user's role name inputs)
4. All fields default `fill_mode: "recipient"`

**Step 2: Add button to EnvelopeWizard**

In step 2 bottom nav, add a "Save as Template" button next to "Next Step":
```typescript
<button onClick={() => setShowSaveAsTemplate(true)} className="text-xs px-3 py-1.5 rounded-md border ..." style={{ borderColor: "var(--border-color)", color: "var(--text-muted)" }}>
  Save as Template
</button>
```

**Step 3: Verify** — Create an envelope, place fields, click "Save as Template", fill in role names, save. Check Templates section shows the new template with documents and fields.

**Step 4: Commit**
```bash
git add src/components/signed-to-sealed/SaveAsTemplateModal.tsx src/components/signed-to-sealed/EnvelopeWizard.tsx
git commit -m "feat(sts): add Save as Template from envelope wizard"
```

---

## Task 10: Template Duplicate Functionality

**Files:**
- Modify: `src/lib/signedToSealedHooks.ts`
- Modify: `src/components/signed-to-sealed/TemplateManager.tsx`

**Step 1: Add duplicateTemplate function**

In hooks or as standalone utility:
```typescript
export async function duplicateTemplate(templateId: string): Promise<STSTemplate> {
  // 1. Fetch template
  const { data: template } = await supabase.from("sts_templates").select("*").eq("id", templateId).single();
  if (!template) throw new Error("Template not found");

  // 2. Create copy
  const { data: newTemplate, error } = await supabase
    .from("sts_templates")
    .insert({ name: `${template.name} (Copy)`, description: template.description, envelope_config: template.envelope_config })
    .select().single();
  if (error) throw toError(error);

  // 3. Copy documents
  const { data: docs } = await supabase.from("sts_template_documents").select("*").eq("template_id", templateId);
  const docIdMap: Record<string, string> = {};
  for (const doc of (docs || [])) {
    const newPath = `templates/${newTemplate.id}/${Date.now()}_${doc.file_name}`;
    await supabase.storage.from("sts-documents").copy(doc.file_path, newPath);
    const { data: newDoc } = await supabase
      .from("sts_template_documents")
      .insert({ template_id: newTemplate.id, file_name: doc.file_name, file_path: newPath, file_size: doc.file_size, page_count: doc.page_count, sort_order: doc.sort_order })
      .select().single();
    if (newDoc) docIdMap[doc.id] = newDoc.id;
  }

  // 4. Copy fields
  const { data: fields } = await supabase.from("sts_template_fields").select("*").eq("template_id", templateId);
  for (const field of (fields || [])) {
    const newDocId = docIdMap[field.template_document_id];
    if (!newDocId) continue;
    await supabase.from("sts_template_fields").insert({
      template_id: newTemplate.id, template_document_id: newDocId,
      role_name: field.role_name, field_type: field.field_type, fill_mode: field.fill_mode,
      label: field.label, page_number: field.page_number,
      x_position: field.x_position, y_position: field.y_position,
      width: field.width, height: field.height,
      is_required: field.is_required, dropdown_options: field.dropdown_options,
    });
  }

  return newTemplate as STSTemplate;
}
```

**Step 2: Add Duplicate button to TemplateManager**

Wire up the "Duplicate" button in template cards to call `duplicateTemplate()` and refetch.

**Step 3: Verify** — Duplicate a template, verify the copy has documents and fields.

**Step 4: Commit**
```bash
git add src/lib/signedToSealedHooks.ts src/components/signed-to-sealed/TemplateManager.tsx
git commit -m "feat(sts): add template duplication with document and field copying"
```

---

## Task Summary

| # | Task | Files | Depends On |
|---|------|-------|-----------|
| 1 | Database schema | migration SQL, schema ref | — |
| 2 | Type definitions | `signedtosealed.ts` | — |
| 3 | Template hooks | `signedToSealedHooks.ts` | 2 |
| 4 | TemplateBuilder component | new component | 2, 3 |
| 5 | TemplateManager + orchestrator update | TemplateManager, SignedToSealed | 4 |
| 6 | Template picker modal | new component, SignedToSealed | 3 |
| 7 | Role mapping + envelope from template | new modal, hooks, EnvelopeWizard | 3, 6 |
| 8 | Sender field visuals | DocumentViewer | 2 |
| 9 | Save as Template from wizard | new modal, EnvelopeWizard | 3 |
| 10 | Template duplication | hooks, TemplateManager | 3, 5 |

**Parallelizable:** Tasks 1+2 can run together. Tasks 4, 6, 8, 9 are independent once 2+3 are done.
