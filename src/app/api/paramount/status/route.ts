import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Twilio delivery status webhook
// Configure your Twilio number's Status Callback URL to point here
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const messageSid = formData.get("MessageSid") as string;
    const messageStatus = formData.get("MessageStatus") as string;

    if (!messageSid || !messageStatus) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // Map Twilio status to our status values
    const statusMap: Record<string, string> = {
      queued: "queued",
      sent: "sent",
      delivered: "delivered",
      undelivered: "undelivered",
      failed: "failed",
    };

    const status = statusMap[messageStatus];
    if (!status) {
      // Ignore statuses we don't track (e.g. "sending", "accepted")
      return NextResponse.json({ ok: true });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Update message status by twilio_sid
    await supabase
      .from("pc_messages")
      .update({ status })
      .eq("twilio_sid", messageSid);

    // Also update broadcast recipient status if applicable
    const { data: message } = await supabase
      .from("pc_messages")
      .select("id")
      .eq("twilio_sid", messageSid)
      .single();

    if (message) {
      await supabase
        .from("pc_broadcast_recipients")
        .update({ status })
        .eq("message_id", message.id);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Status webhook error:", err);
    return NextResponse.json({ ok: true });
  }
}
