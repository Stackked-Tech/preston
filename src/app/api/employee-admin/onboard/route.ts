import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { OnboardEmployeeRequest } from "@/types/employeeadmin";
import { RECIPIENT_COLORS } from "@/types/signedtosealed";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(req: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: "Server not configured for admin operations" },
        { status: 500 }
      );
    }

    const body: OnboardEmployeeRequest = await req.json();
    const {
      display_name, email, branch_id, template_id,
      target_first, target_last,
      station_lease, financial_services, phorest_fee, refreshment,
      associate_pay, supervisor,
    } = body;

    if (!display_name?.trim() || !email?.trim() || !branch_id || !template_id) {
      return NextResponse.json(
        { error: "display_name, email, branch_id, and template_id are required" },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Step 1: Invite user via Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email.trim(),
      {
        data: { onboarding_complete: false },
        redirectTo: `${req.headers.get("origin") || ""}/employee`,
      }
    );
    if (authError) {
      return NextResponse.json(
        { error: `Failed to create auth user: ${authError.message}` },
        { status: 500 }
      );
    }
    const authUid = authData.user.id;

    try {
      // Step 2: Insert ea_staff record
      const { data: staffRecord, error: staffError } = await supabase
        .from("ea_staff")
        .insert({
          branch_id,
          display_name: display_name.trim(),
          target_first: target_first.trim(),
          target_last: target_last.trim(),
          internal_id: 0,
          station_lease: station_lease || 0,
          financial_services: financial_services || 0,
          phorest_fee: phorest_fee || 0,
          refreshment: refreshment || 0,
          associate_pay: associate_pay ?? null,
          supervisor: supervisor?.trim() || null,
          email: email.trim(),
          is_active: true,
          sort_order: 0,
          status: "onboarding",
          supabase_auth_uid: authUid,
          onboarding_template_id: template_id,
        })
        .select()
        .single();
      if (staffError) throw new Error(`Failed to create staff record: ${staffError.message}`);

      // Step 3: Create STS envelope from template
      const { data: template, error: tplError } = await supabase
        .from("sts_templates")
        .select("*")
        .eq("id", template_id)
        .single();
      if (tplError) throw new Error(`Template not found: ${tplError.message}`);

      const config = template.envelope_config || {};
      const { data: envelope, error: envError } = await supabase
        .from("sts_envelopes")
        .insert({
          title: config.title || template.name || "Onboarding Document",
          message: config.message || "",
          status: "sent",
          created_by: "system",
        })
        .select()
        .single();
      if (envError) throw new Error(`Failed to create envelope: ${envError.message}`);

      // Copy template documents
      const { data: templateDocs } = await supabase
        .from("sts_template_documents")
        .select("*")
        .eq("template_id", template_id)
        .order("sort_order");

      const docIdMap: Record<string, string> = {};
      for (const tDoc of templateDocs || []) {
        const newPath = `${envelope.id}/${Date.now()}_${tDoc.file_name}`;
        const { error: copyError } = await supabase.storage
          .from("sts-documents")
          .copy(tDoc.file_path, newPath);
        if (copyError) throw new Error(`Failed to copy document: ${copyError.message}`);

        const { data: newDoc, error: docError } = await supabase
          .from("sts_documents")
          .insert({
            envelope_id: envelope.id,
            file_name: tDoc.file_name,
            file_path: newPath,
            file_size: tDoc.file_size,
            page_count: tDoc.page_count,
            sort_order: tDoc.sort_order,
          })
          .select()
          .single();
        if (docError) throw new Error(`Failed to create document record: ${docError.message}`);
        docIdMap[tDoc.id] = newDoc.id;
      }

      // Create recipient (employee is sole signer)
      const { data: recipient, error: recipError } = await supabase
        .from("sts_recipients")
        .insert({
          envelope_id: envelope.id,
          name: display_name.trim(),
          email: email.trim(),
          role: "signer",
          signing_order: 1,
          status: "pending",
          color_hex: RECIPIENT_COLORS[0],
        })
        .select()
        .single();
      if (recipError) throw new Error(`Failed to create recipient: ${recipError.message}`);

      // Clone template fields
      const { data: templateFields } = await supabase
        .from("sts_template_fields")
        .select("*")
        .eq("template_id", template_id);

      for (const tf of templateFields || []) {
        const newDocId = docIdMap[tf.template_document_id];
        if (!newDocId) continue;

        await supabase.from("sts_fields").insert({
          envelope_id: envelope.id,
          document_id: newDocId,
          recipient_id: recipient.id,
          field_type: tf.field_type,
          fill_mode: tf.fill_mode,
          label: tf.label,
          page_number: tf.page_number,
          x_position: tf.x_position,
          y_position: tf.y_position,
          width: tf.width,
          height: tf.height,
          is_required: tf.is_required,
          dropdown_options: tf.dropdown_options,
        });
      }

      // Step 4: Update ea_staff with envelope ID and signing token
      const { error: updateError } = await supabase
        .from("ea_staff")
        .update({
          onboarding_envelope_id: envelope.id,
          onboarding_signing_token: recipient.access_token,
        })
        .eq("id", staffRecord.id);
      if (updateError) throw new Error(`Failed to update staff record: ${updateError.message}`);

      // Step 5: Log audit entry
      await supabase.from("sts_audit_log").insert({
        envelope_id: envelope.id,
        event_type: "envelope_created",
        actor_name: "System",
        actor_email: "system@whbcompanies.com",
        metadata: { source: "employee_onboarding", employee_id: staffRecord.id },
      });

      return NextResponse.json({
        staff: {
          ...staffRecord,
          onboarding_envelope_id: envelope.id,
          onboarding_signing_token: recipient.access_token,
        },
      });
    } catch (innerError) {
      // Rollback: delete the auth user if any subsequent step fails
      await supabaseAdmin.auth.admin.deleteUser(authUid);
      throw innerError;
    }
  } catch (err) {
    console.error("Onboard employee error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
