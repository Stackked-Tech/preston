import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const twilioSid = process.env.TWILIO_ACCOUNT_SID!;
const twilioToken = process.env.TWILIO_AUTH_TOKEN!;
const twilioNumber = process.env.TWILIO_PHONE_NUMBER!;

export async function POST(req: NextRequest) {
  try {
    const { contactId, body } = await req.json();

    if (!contactId || !body?.trim()) {
      return NextResponse.json(
        { error: "contactId and body are required" },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get contact
    const { data: contact, error: contactErr } = await supabase
      .from("pc_contacts")
      .select("id, phone_number, name")
      .eq("id", contactId)
      .single();

    if (contactErr || !contact) {
      return NextResponse.json(
        { error: "Contact not found" },
        { status: 404 }
      );
    }

    // Derive status callback URL from request
    const url = new URL(req.url);
    const statusCallback = `${url.origin}/api/paramount/status`;

    // Send via Twilio REST API
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
          To: contact.phone_number,
          From: twilioNumber,
          Body: body.trim(),
          StatusCallback: statusCallback,
        }),
      }
    );

    const twilioData = await twilioResponse.json();

    if (!twilioResponse.ok) {
      return NextResponse.json(
        { error: twilioData.message || "Failed to send SMS" },
        { status: 500 }
      );
    }

    // Store message
    const { data: message, error: msgErr } = await supabase
      .from("pc_messages")
      .insert({
        contact_id: contactId,
        direction: "outbound",
        body: body.trim(),
        status: "sent",
        twilio_sid: twilioData.sid,
      })
      .select()
      .single();

    if (msgErr) {
      return NextResponse.json({ error: msgErr.message }, { status: 500 });
    }

    // Update contact's last message
    await supabase
      .from("pc_contacts")
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: body.trim().substring(0, 100),
        updated_at: new Date().toISOString(),
      })
      .eq("id", contactId);

    return NextResponse.json({ message });
  } catch (err) {
    console.error("Send SMS error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
