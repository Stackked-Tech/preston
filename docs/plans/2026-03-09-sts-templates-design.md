# Signed to Sealed — Document Templates Design

## Overview

Enhance the Signed to Sealed template system to support PDF-backed, fillable form templates. Users upload PDFs, pre-place fields (signature, text, checkbox, etc.), assign them to recipient roles, and save as reusable templates. When using a template, users map roles to real people, fill in sender fields, and send — a "pull, fill, and go" workflow.

## Data Model

### New Tables

**`sts_template_documents`** — PDFs stored with templates
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| template_id | UUID FK → sts_templates | CASCADE delete |
| file_name | text | Original filename |
| file_path | text | Storage path (`templates/{template_id}/{filename}`) |
| file_size | integer | Bytes |
| page_count | integer | Extracted via pdfjs |
| sort_order | integer | Multi-doc ordering |
| created_at | timestamptz | |

**`sts_template_fields`** — Pre-placed fields on template documents
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| template_id | UUID FK → sts_templates | CASCADE delete |
| template_document_id | UUID FK → sts_template_documents | CASCADE delete |
| role_name | text | e.g., "Contractor", "Company Rep" — links to role, not person |
| field_type | text | signature, initials, date_signed, text, checkbox, dropdown |
| fill_mode | text | "sender" or "recipient" — who fills this field |
| label | text | Display label (e.g., "Contractor Name", "Start Date") |
| page_number | integer | Which page |
| x_position | numeric | Percentage 0-100 |
| y_position | numeric | Percentage 0-100 |
| width | numeric | Percentage 0-100 |
| height | numeric | Percentage 0-100 |
| is_required | boolean | Default true |
| dropdown_options | jsonb | For dropdown fields |
| created_at | timestamptz | |

### Modified Tables

**`sts_templates`** — Add `roles` column (or keep in `envelope_config` JSONB):
- `envelope_config.roles[]` already supports `{ name, role, signing_order }` — no schema change needed
- Continue using existing JSONB structure for title, message, roles

### Modified Types

**`STSTemplateField`** — New type for template field records
**`STSField`** — Add optional `fill_mode: 'sender' | 'recipient'` to support mixed fill modes in envelopes created from templates

### Storage

Template PDFs stored in `sts-documents` bucket under `templates/{template_id}/` prefix.

## Template Creation

### Path 1: Build from Scratch (TemplateManager)

1. Click "New Template" → enter name, description
2. Upload PDF(s) → stored in `sts-documents/templates/{template_id}/`
3. Add recipient roles with name, role type (signer/cc), signing order
4. Place fields on PDF using existing DocumentViewer + FieldPalette
   - Fields assigned to **roles** (not people)
   - Each field gets a `fill_mode` toggle: sender or recipient
   - Sender fields get a label (e.g., "Contractor Name")
5. Save template

### Path 2: Save from Envelope (EnvelopeWizard)

1. After placing fields in Step 2, click "Save as Template"
2. Enter template name & description
3. Name each recipient's role (e.g., "John Smith" → "Buyer")
4. Documents and field placements copied to template tables
5. All fields default to `fill_mode: "recipient"` — editable later in TemplateManager

## Using a Template

### Quick Picker (Dashboard)

1. Click "Create Envelope" → modal: "Blank Envelope" or template list
2. Select template → role mapping form:
   - Each role shows name field + email field
   - e.g., "Contractor: [name] [email]", "Company Rep: [name] [email]"
3. Click "Create" → auto-builds envelope:
   - Creates envelope with template title & message
   - Copies template PDFs → new envelope documents
   - Creates recipients from role mappings (colors, order, roles)
   - Clones fields, re-links to new documents and recipients
   - Copies `fill_mode` to each field
4. Wizard opens at Step 2 (Field Placement):
   - Sender-fill fields: gold border, editable, highlighted for attention
   - Recipient-fill fields: normal dashed border with recipient colors
5. Fill sender fields → Step 3 Review → Send

### Templates Section

- Click "Use This Template" on any card → same role mapping modal → same flow

## Template Management

- **Template cards**: name, description, page count, field count, role count, last updated
- **Actions**: Edit, Use, Duplicate, Delete
- **Edit**: Opens full builder (PDF viewer, fields, roles)
- **Duplicate**: Creates copy for variations
- **No versioning**: Updates in place; existing envelopes unaffected (they have copied data)

## Visual Design

- **Sender fields**: Gold border (#d4af37), label displayed inside field, editable in envelope creation
- **Recipient fields**: Dashed border with recipient color, same as current behavior
- **Template cards**: Match existing dashboard card style
- **Role mapping modal**: Clean form with role name labels, name + email inputs per role

## Key Decisions

1. Fields reference **role names** in templates, **recipient IDs** in envelopes
2. Template PDFs are **copied** when creating an envelope (not referenced) — templates stay independent
3. `fill_mode` propagates from template → envelope field, enabling mixed sender/recipient fills
4. No email integration — signing links still shared manually
5. No template versioning — YAGNI
