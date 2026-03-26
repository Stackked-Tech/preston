import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const twilioSid = process.env.TWILIO_ACCOUNT_SID!;
const twilioToken = process.env.TWILIO_AUTH_TOKEN!;
const twilioNumber = process.env.TWILIO_CS_PHONE_NUMBER || process.env.TWILIO_PHONE_NUMBER!;
const resendApiKey = process.env.RESEND_API_KEY;
const resendFrom = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

interface ScheduleChange {
  taskId: string;
  taskName: string;
  oldStart: string;
  oldEnd: string;
  newStart: string;
  newEnd: string;
}

interface NotifyRequest {
  projectId: string;
  projectName: string;
  subId: string;
  changes: ScheduleChange[];
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function buildSmsMessage(projectName: string, subName: string, changes: ScheduleChange[]): string {
  const changeLines = changes.map(
    (c) => `• ${c.taskName}: ${formatDate(c.oldStart)}–${formatDate(c.oldEnd)} → ${formatDate(c.newStart)}–${formatDate(c.newEnd)}`
  );
  return `WHB Schedule Update — ${projectName}\n\nHi ${subName}, the following schedule changes affect your work:\n\n${changeLines.join("\n")}\n\nPlease plan accordingly. Questions? Reply to this message.`;
}

function buildEmailHtml(projectName: string, subName: string, changes: ScheduleChange[]): string {
  const rows = changes
    .map(
      (c) => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #e5e5e5;font-size:14px;color:#333;">${c.taskName}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e5e5e5;font-size:14px;color:#999;text-decoration:line-through;">${formatDate(c.oldStart)} – ${formatDate(c.oldEnd)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e5e5e5;font-size:14px;color:#22c55e;font-weight:600;">${formatDate(c.newStart)} – ${formatDate(c.newEnd)}</td>
    </tr>`
    )
    .join("");

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
        <!-- Header -->
        <tr>
          <td style="background:#1a1a1a;padding:24px 32px;">
            <p style="margin:0;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#d4af37;">WHB Companies</p>
            <h1 style="margin:8px 0 0;font-size:20px;color:#ffffff;font-weight:600;">Schedule Update</h1>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 8px;font-size:16px;color:#333;">Hi ${subName},</p>
            <p style="margin:0 0 24px;font-size:14px;color:#666;line-height:1.5;">
              The schedule for <strong style="color:#333;">${projectName}</strong> has been updated. The following changes affect your assigned work:
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e5e5;border-radius:8px;overflow:hidden;">
              <tr style="background:#f9f9f9;">
                <th style="padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#999;border-bottom:1px solid #e5e5e5;">Task</th>
                <th style="padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#999;border-bottom:1px solid #e5e5e5;">Previous</th>
                <th style="padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#999;border-bottom:1px solid #e5e5e5;">New Dates</th>
              </tr>
              ${rows}
            </table>
            <p style="margin:24px 0 0;font-size:14px;color:#666;line-height:1.5;">
              Please plan accordingly. If you have questions, reply to this email or call your project manager.
            </p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f9f9f9;padding:16px 32px;border-top:1px solid #e5e5e5;">
            <p style="margin:0;font-size:11px;color:#999;">WHB Companies · Construction Scheduler</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function POST(req: NextRequest) {
  try {
    const { projectId, projectName, subId, changes } = (await req.json()) as NotifyRequest;

    if (!projectId || !subId || !changes?.length) {
      return NextResponse.json({ error: "projectId, subId, and changes are required" }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: sub, error: subErr } = await supabase.from("cs_subs").select("*").eq("id", subId).single();
    if (subErr || !sub) {
      return NextResponse.json({ error: "Subcontractor not found" }, { status: 404 });
    }

    const smsMessage = buildSmsMessage(projectName, sub.name, changes);
    const results: { channel: string; status: "sent" | "failed" }[] = [];

    // ─── Send SMS ────────────────────────────────────
    try {
      const twilioResponse = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: "Basic " + Buffer.from(`${twilioSid}:${twilioToken}`).toString("base64"),
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({ To: sub.phone, From: twilioNumber, Body: smsMessage }),
        }
      );
      results.push({ channel: "sms", status: twilioResponse.ok ? "sent" : "failed" });
    } catch {
      results.push({ channel: "sms", status: "failed" });
    }

    // ─── Send Email (if sub has email and Resend is configured) ───
    if (sub.email && resendApiKey) {
      try {
        const resend = new Resend(resendApiKey);
        const emailHtml = buildEmailHtml(projectName, sub.name, changes);
        await resend.emails.send({
          from: resendFrom,
          to: sub.email,
          subject: `Schedule Update — ${projectName}`,
          html: emailHtml,
        });
        results.push({ channel: "email", status: "sent" });
      } catch {
        results.push({ channel: "email", status: "failed" });
      }
    }

    // ─── Log notifications ───────────────────────────
    for (const result of results) {
      await supabase.from("cs_notifications").insert({
        project_id: projectId,
        sub_id: subId,
        task_id: changes.length === 1 ? changes[0].taskId : null,
        channel: result.channel,
        message: result.channel === "sms" ? smsMessage : `Email: Schedule Update — ${projectName}`,
        status: result.status,
        sent_at: new Date().toISOString(),
      });
    }

    const allSent = results.every((r) => r.status === "sent");
    return NextResponse.json({
      status: allSent ? "sent" : "partial",
      channels: results,
    });
  } catch (err) {
    console.error("Scheduler notify error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
