import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const twilioSid = process.env.TWILIO_ACCOUNT_SID!;
const twilioToken = process.env.TWILIO_AUTH_TOKEN!;
const twilioNumber = process.env.TWILIO_PHONE_NUMBER!;

// Cron endpoint: sends all due scheduled messages
// Call via Vercel Cron or external scheduler every 1 minute
// Protect with CRON_SECRET env var
export async function GET(req: NextRequest) {
  // Verify cron secret
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && secret !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find due messages
    const { data: due, error: fetchErr } = await supabase
      .from("pc_scheduled_messages")
      .select("*, pc_contacts(phone_number)")
      .eq("status", "pending")
      .lte("scheduled_at", new Date().toISOString())
      .limit(50);

    if (fetchErr || !due?.length) {
      return NextResponse.json({ sent: 0 });
    }

    let sentCount = 0;

    for (const scheduled of due) {
      const phoneNumber = (
        scheduled.pc_contacts as { phone_number: string } | null
      )?.phone_number;

      if (!phoneNumber) {
        await supabase
          .from("pc_scheduled_messages")
          .update({ status: "failed" })
          .eq("id", scheduled.id);
        continue;
      }

      // Derive status callback URL from request
      const url = new URL(req.url);
      const statusCallback = `${url.origin}/api/paramount/status`;

      // Send via Twilio
      const twilioResponse = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization:
              "Basic " +
              Buffer.from(`${twilioSid}:${twilioToken}`).toString("base64"),
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            To: phoneNumber,
            From: twilioNumber,
            Body: scheduled.body,
            StatusCallback: statusCallback,
          }),
        }
      );

      const twilioData = await twilioResponse.json();

      if (twilioData.sid) {
        // Store as regular message
        const { data: message } = await supabase
          .from("pc_messages")
          .insert({
            contact_id: scheduled.contact_id,
            direction: "outbound",
            body: scheduled.body,
            status: "sent",
            twilio_sid: twilioData.sid,
          })
          .select()
          .single();

        // Update scheduled message
        await supabase
          .from("pc_scheduled_messages")
          .update({ status: "sent", message_id: message?.id || null })
          .eq("id", scheduled.id);

        // Update contact's last message
        await supabase
          .from("pc_contacts")
          .update({
            last_message_at: new Date().toISOString(),
            last_message_preview: scheduled.body.substring(0, 100),
            updated_at: new Date().toISOString(),
          })
          .eq("id", scheduled.contact_id);

        sentCount++;
      } else {
        await supabase
          .from("pc_scheduled_messages")
          .update({ status: "failed" })
          .eq("id", scheduled.id);
      }
    }

    return NextResponse.json({ sent: sentCount, total: due.length });
  } catch (err) {
    console.error("Send scheduled error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
