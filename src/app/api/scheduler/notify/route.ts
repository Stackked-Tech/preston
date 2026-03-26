import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const twilioSid = process.env.TWILIO_ACCOUNT_SID!;
const twilioToken = process.env.TWILIO_AUTH_TOKEN!;
// Use a dedicated scheduler number if set, otherwise fall back to main
const twilioNumber = process.env.TWILIO_CS_PHONE_NUMBER || process.env.TWILIO_PHONE_NUMBER!;

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

export async function POST(req: NextRequest) {
  try {
    const { projectId, projectName, subId, changes } = (await req.json()) as NotifyRequest;

    if (!projectId || !subId || !changes?.length) {
      return NextResponse.json({ error: "projectId, subId, and changes are required" }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get sub info
    const { data: sub, error: subErr } = await supabase.from("cs_subs").select("*").eq("id", subId).single();
    if (subErr || !sub) {
      return NextResponse.json({ error: "Subcontractor not found" }, { status: 404 });
    }

    // Build notification message
    const changeLines = changes.map(
      (c) => `• ${c.taskName}: ${formatDate(c.oldStart)}–${formatDate(c.oldEnd)} → ${formatDate(c.newStart)}–${formatDate(c.newEnd)}`
    );
    const message = `WHB Schedule Update — ${projectName}\n\nHi ${sub.name}, the following schedule changes affect your work:\n\n${changeLines.join("\n")}\n\nPlease plan accordingly. Questions? Reply to this message.`;

    // Send SMS via Twilio
    let status: "sent" | "failed" = "sent";
    try {
      const twilioResponse = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: "Basic " + Buffer.from(`${twilioSid}:${twilioToken}`).toString("base64"),
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            To: sub.phone,
            From: twilioNumber,
            Body: message,
          }),
        }
      );
      if (!twilioResponse.ok) {
        status = "failed";
      }
    } catch {
      status = "failed";
    }

    // Log notification
    await supabase.from("cs_notifications").insert({
      project_id: projectId,
      sub_id: subId,
      task_id: changes.length === 1 ? changes[0].taskId : null,
      channel: "sms",
      message,
      status,
      sent_at: new Date().toISOString(),
    });

    return NextResponse.json({ status, message: status === "sent" ? "Notification sent" : "Failed to send" });
  } catch (err) {
    console.error("Scheduler notify error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
