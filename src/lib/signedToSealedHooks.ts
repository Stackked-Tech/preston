"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase, isSupabaseConfigured } from "./supabase";
import type {
  STSEnvelope,
  STSEnvelopeInsert,
  STSEnvelopeUpdate,
  STSDocument,
  STSRecipient,
  STSRecipientInsert,
  STSRecipientUpdate,
  STSField,
  STSFieldInsert,
  STSFieldUpdate,
  STSSignature,
  STSSignatureInsert,
  STSAuditEntry,
  STSAuditInsert,
  STSTemplate,
  STSTemplateInsert,
  STSTemplateUpdate,
  STSEnvelopeDetail,
  EnvelopeStatus,
} from "@/types/signedtosealed";

// Helper to convert Supabase error objects to proper Error instances
function toError(err: unknown): Error {
  if (err instanceof Error) return err;
  if (typeof err === "object" && err !== null && "message" in err) {
    return new Error((err as { message: string }).message);
  }
  return new Error(String(err));
}

// ─── Envelopes ───────────────────────────────────────────

export function useEnvelopes() {
  const [envelopes, setEnvelopes] = useState<STSEnvelope[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEnvelopes = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setError("Supabase not configured");
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const { data, error: err } = await supabase
        .from("sts_envelopes")
        .select("*")
        .order("updated_at", { ascending: false });
      if (err) throw toError(err);
      setEnvelopes((data || []) as STSEnvelope[]);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch envelopes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEnvelopes();
  }, [fetchEnvelopes]);

  const createEnvelope = async (insert: Partial<STSEnvelopeInsert>): Promise<STSEnvelope> => {
    const { data, error } = await supabase
      .from("sts_envelopes")
      .insert({ title: insert.title || "Untitled Envelope", message: insert.message || "", status: "draft", created_by: insert.created_by || "" })
      .select()
      .single();
    if (error) throw toError(error);
    const created = data as STSEnvelope;
    setEnvelopes((prev) => [created, ...prev]);
    return created;
  };

  const updateEnvelope = async (id: string, updates: STSEnvelopeUpdate): Promise<void> => {
    const { error } = await supabase
      .from("sts_envelopes")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw toError(error);
    setEnvelopes((prev) => prev.map((e) => (e.id === id ? { ...e, ...updates, updated_at: new Date().toISOString() } : e)));
  };

  const deleteEnvelope = async (id: string): Promise<void> => {
    const { error } = await supabase
      .from("sts_envelopes")
      .delete()
      .eq("id", id);
    if (error) throw toError(error);
    setEnvelopes((prev) => prev.filter((e) => e.id !== id));
  };

  const sendEnvelope = async (id: string): Promise<void> => {
    const now = new Date().toISOString();
    await updateEnvelope(id, { status: "sent" as EnvelopeStatus, sent_at: now });
  };

  const voidEnvelope = async (id: string, reason: string): Promise<void> => {
    const now = new Date().toISOString();
    await updateEnvelope(id, { status: "voided" as EnvelopeStatus, voided_at: now, void_reason: reason });
  };

  return { envelopes, loading, error, refetch: fetchEnvelopes, createEnvelope, updateEnvelope, deleteEnvelope, sendEnvelope, voidEnvelope };
}

// ─── Envelope Detail ─────────────────────────────────────

export function useEnvelopeDetail(envelopeId: string | null) {
  const [detail, setDetail] = useState<STSEnvelopeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    if (!isSupabaseConfigured || !envelopeId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const [envRes, docsRes, recRes, fieldsRes] = await Promise.all([
        supabase.from("sts_envelopes").select("*").eq("id", envelopeId).single(),
        supabase.from("sts_documents").select("*").eq("envelope_id", envelopeId).order("sort_order"),
        supabase.from("sts_recipients").select("*").eq("envelope_id", envelopeId).order("signing_order"),
        supabase.from("sts_fields").select("*").eq("envelope_id", envelopeId),
      ]);
      if (envRes.error) throw toError(envRes.error);
      setDetail({
        ...(envRes.data as STSEnvelope),
        documents: (docsRes.data || []) as STSDocument[],
        recipients: (recRes.data || []) as STSRecipient[],
        fields: (fieldsRes.data || []) as STSField[],
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch envelope detail");
    } finally {
      setLoading(false);
    }
  }, [envelopeId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  return { detail, loading, error, refetch: fetchDetail };
}

// ─── Document Upload ─────────────────────────────────────

export function useDocumentUpload() {
  const uploadDocument = async (
    envelopeId: string,
    file: File,
    sortOrder: number
  ): Promise<STSDocument> => {
    const filePath = `${envelopeId}/${Date.now()}_${file.name}`;

    const { error: uploadErr } = await supabase.storage
      .from("sts-documents")
      .upload(filePath, file, { contentType: file.type });
    if (uploadErr) throw toError(uploadErr);

    const { data, error } = await supabase
      .from("sts_documents")
      .insert({
        envelope_id: envelopeId,
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
        page_count: 1,
        sort_order: sortOrder,
      })
      .select()
      .single();
    if (error) throw toError(error);
    return data as STSDocument;
  };

  const updatePageCount = async (docId: string, pageCount: number): Promise<void> => {
    await supabase.from("sts_documents").update({ page_count: pageCount }).eq("id", docId);
  };

  const deleteDocument = async (docId: string, filePath: string): Promise<void> => {
    await supabase.storage.from("sts-documents").remove([filePath]);
    await supabase.from("sts_documents").delete().eq("id", docId);
  };

  const getPublicUrl = (filePath: string): string => {
    const { data } = supabase.storage.from("sts-documents").getPublicUrl(filePath);
    return data.publicUrl;
  };

  return { uploadDocument, updatePageCount, deleteDocument, getPublicUrl };
}

// ─── Recipients ──────────────────────────────────────────

export function useRecipients(envelopeId: string | null) {
  const [recipients, setRecipients] = useState<STSRecipient[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRecipients = useCallback(async () => {
    if (!isSupabaseConfigured || !envelopeId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("sts_recipients")
        .select("*")
        .eq("envelope_id", envelopeId)
        .order("signing_order");
      if (error) throw toError(error);
      setRecipients((data || []) as STSRecipient[]);
    } finally {
      setLoading(false);
    }
  }, [envelopeId]);

  useEffect(() => {
    fetchRecipients();
  }, [fetchRecipients]);

  const addRecipient = async (insert: STSRecipientInsert): Promise<STSRecipient> => {
    const { data, error } = await supabase
      .from("sts_recipients")
      .insert(insert)
      .select()
      .single();
    if (error) throw toError(error);
    const created = data as STSRecipient;
    setRecipients((prev) => [...prev, created].sort((a, b) => a.signing_order - b.signing_order));
    return created;
  };

  const updateRecipient = async (id: string, updates: STSRecipientUpdate): Promise<void> => {
    const { error } = await supabase
      .from("sts_recipients")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw toError(error);
    setRecipients((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...updates } : r)).sort((a, b) => a.signing_order - b.signing_order)
    );
  };

  const removeRecipient = async (id: string): Promise<void> => {
    const { error } = await supabase.from("sts_recipients").delete().eq("id", id);
    if (error) throw toError(error);
    setRecipients((prev) => prev.filter((r) => r.id !== id));
  };

  return { recipients, loading, refetch: fetchRecipients, addRecipient, updateRecipient, removeRecipient };
}

// ─── Fields ──────────────────────────────────────────────

export function useFields(envelopeId: string | null) {
  const [fields, setFields] = useState<STSField[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFields = useCallback(async () => {
    if (!isSupabaseConfigured || !envelopeId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("sts_fields")
        .select("*")
        .eq("envelope_id", envelopeId);
      if (error) throw toError(error);
      setFields((data || []) as STSField[]);
    } finally {
      setLoading(false);
    }
  }, [envelopeId]);

  useEffect(() => {
    fetchFields();
  }, [fetchFields]);

  const addField = async (insert: STSFieldInsert): Promise<STSField> => {
    const { data, error } = await supabase
      .from("sts_fields")
      .insert(insert)
      .select()
      .single();
    if (error) throw toError(error);
    const created = data as STSField;
    setFields((prev) => [...prev, created]);
    return created;
  };

  const updateField = async (id: string, updates: STSFieldUpdate): Promise<void> => {
    const { error } = await supabase
      .from("sts_fields")
      .update(updates)
      .eq("id", id);
    if (error) throw toError(error);
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  };

  const removeField = async (id: string): Promise<void> => {
    const { error } = await supabase.from("sts_fields").delete().eq("id", id);
    if (error) throw toError(error);
    setFields((prev) => prev.filter((f) => f.id !== id));
  };

  const bulkAddFields = async (inserts: STSFieldInsert[]): Promise<STSField[]> => {
    if (inserts.length === 0) return [];
    const { data, error } = await supabase
      .from("sts_fields")
      .insert(inserts)
      .select();
    if (error) throw toError(error);
    const created = (data || []) as STSField[];
    setFields((prev) => [...prev, ...created]);
    return created;
  };

  return { fields, loading, refetch: fetchFields, addField, updateField, removeField, bulkAddFields };
}

// ─── Signatures ──────────────────────────────────────────

export function useSignatures() {
  const [signatures, setSignatures] = useState<STSSignature[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSignatures = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("sts_signatures")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw toError(error);
      setSignatures((data || []) as STSSignature[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSignatures();
  }, [fetchSignatures]);

  const saveSignature = async (insert: STSSignatureInsert): Promise<STSSignature> => {
    const { data, error } = await supabase
      .from("sts_signatures")
      .insert(insert)
      .select()
      .single();
    if (error) throw toError(error);
    const created = data as STSSignature;
    setSignatures((prev) => [created, ...prev]);
    return created;
  };

  const deleteSignature = async (id: string): Promise<void> => {
    const { error } = await supabase.from("sts_signatures").delete().eq("id", id);
    if (error) throw toError(error);
    setSignatures((prev) => prev.filter((s) => s.id !== id));
  };

  return { signatures, loading, refetch: fetchSignatures, saveSignature, deleteSignature };
}

// ─── Audit Log ───────────────────────────────────────────

export function useAuditLog(envelopeId: string | null) {
  const [entries, setEntries] = useState<STSAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEntries = useCallback(async () => {
    if (!isSupabaseConfigured || !envelopeId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("sts_audit_log")
        .select("*")
        .eq("envelope_id", envelopeId)
        .order("created_at", { ascending: true });
      if (error) throw toError(error);
      setEntries((data || []) as STSAuditEntry[]);
    } finally {
      setLoading(false);
    }
  }, [envelopeId]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const logEvent = async (insert: STSAuditInsert): Promise<void> => {
    const { data, error } = await supabase
      .from("sts_audit_log")
      .insert(insert)
      .select()
      .single();
    if (error) throw toError(error);
    setEntries((prev) => [...prev, data as STSAuditEntry]);
  };

  return { entries, loading, refetch: fetchEntries, logEvent };
}

// ─── Templates ───────────────────────────────────────────

export function useTemplates() {
  const [templates, setTemplates] = useState<STSTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTemplates = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("sts_templates")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw toError(error);
      setTemplates((data || []) as STSTemplate[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const createTemplate = async (insert: STSTemplateInsert): Promise<STSTemplate> => {
    const { data, error } = await supabase
      .from("sts_templates")
      .insert(insert)
      .select()
      .single();
    if (error) throw toError(error);
    const created = data as STSTemplate;
    setTemplates((prev) => [created, ...prev]);
    return created;
  };

  const updateTemplate = async (id: string, updates: STSTemplateUpdate): Promise<void> => {
    const { error } = await supabase
      .from("sts_templates")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw toError(error);
    setTemplates((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)));
  };

  const deleteTemplate = async (id: string): Promise<void> => {
    const { error } = await supabase.from("sts_templates").delete().eq("id", id);
    if (error) throw toError(error);
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  };

  return { templates, loading, refetch: fetchTemplates, createTemplate, updateTemplate, deleteTemplate };
}

// ─── Signing by Token ────────────────────────────────────

export function useSigningByToken(token: string | null) {
  const [recipient, setRecipient] = useState<STSRecipient | null>(null);
  const [envelope, setEnvelope] = useState<STSEnvelopeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchByToken = useCallback(async () => {
    if (!isSupabaseConfigured || !token) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const { data: recData, error: recErr } = await supabase
        .from("sts_recipients")
        .select("*")
        .eq("access_token", token)
        .single();
      if (recErr) throw new Error("Invalid or expired signing link");
      const rec = recData as STSRecipient;
      setRecipient(rec);

      const [envRes, docsRes, recipientsRes, fieldsRes] = await Promise.all([
        supabase.from("sts_envelopes").select("*").eq("id", rec.envelope_id).single(),
        supabase.from("sts_documents").select("*").eq("envelope_id", rec.envelope_id).order("sort_order"),
        supabase.from("sts_recipients").select("*").eq("envelope_id", rec.envelope_id).order("signing_order"),
        supabase.from("sts_fields").select("*").eq("envelope_id", rec.envelope_id),
      ]);
      if (envRes.error) throw toError(envRes.error);

      const env = envRes.data as STSEnvelope;
      if (env.status === "voided") throw new Error("This envelope has been voided");
      if (env.status === "completed") throw new Error("This envelope has already been completed");
      if (rec.status === "signed") throw new Error("You have already signed this document");

      setEnvelope({
        ...env,
        documents: (docsRes.data || []) as STSDocument[],
        recipients: (recipientsRes.data || []) as STSRecipient[],
        fields: (fieldsRes.data || []) as STSField[],
      });
      setError(null);

      // Mark as viewed
      if (rec.status === "pending") {
        await supabase
          .from("sts_recipients")
          .update({ status: "viewed", viewed_at: new Date().toISOString() })
          .eq("id", rec.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load signing session");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchByToken();
  }, [fetchByToken]);

  return { recipient, envelope, loading, error, refetch: fetchByToken };
}
