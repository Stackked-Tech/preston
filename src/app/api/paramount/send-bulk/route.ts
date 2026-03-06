import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const twilioSid = process.env.TWILIO_ACCOUNT_SID!;
const twilioToken = process.env.TWILIO_AUTH_TOKEN!;
const twilioNumber = process.env.TWILIO_PHONE_NUMBER!;

async function sendSMS(
  to: string,
  messageBody: string,
  statusCallback: string
) {
  const response = await fetch(
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
        To: to,
        From: twilioNumber,
        Body: messageBody,
        StatusCallback: statusCallback,
      }),
    }
  );
  return response.json();
}

export async function POST(req: NextRequest) {
  try {
    const { contactIds, body, name } = await req.json();

    if (!contactIds?.length || !body?.trim()) {
      return NextResponse.json(
        { error: "contactIds and body are required" },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get contacts
    const { data: contacts, error: contactsErr } = await supabase
      .from("pc_contacts")
      .select("id, phone_number, name")
      .in("id", contactIds);

    if (contactsErr || !contacts?.length) {
      return NextResponse.json(
        { error: "No contacts found" },
        { status: 404 }
      );
    }

    // Create broadcast record
    const { data: broadcast, error: broadcastErr } = await supabase
      .from("pc_broadcasts")
      .insert({
        name: name || `Bulk message to ${contacts.length} contacts`,
        body: body.trim(),
        recipient_count: contacts.length,
      })
      .select()
      .single();

    if (broadcastErr || !broadcast) {
      return NextResponse.json(
        { error: "Failed to create broadcast" },
        { status: 500 }
      );
    }

    // Derive status callback URL
    const url = new URL(req.url);
    const statusCallback = `${url.origin}/api/paramount/status`;

    // Send to each contact
    const results = await Promise.allSettled(
      contacts.map(async (contact) => {
        const twilioData = await sendSMS(
          contact.phone_number,
          body.trim(),
          statusCallback
        );
        const status = twilioData.sid ? "sent" : "failed";

        // Store message
        const { data: message } = await supabase
          .from("pc_messages")
          .insert({
            contact_id: contact.id,
            direction: "outbound",
            body: body.trim(),
            status,
            twilio_sid: twilioData.sid || null,
          })
          .select()
          .single();

        // Store broadcast recipient
        await supabase.from("pc_broadcast_recipients").insert({
          broadcast_id: broadcast.id,
          contact_id: contact.id,
          message_id: message?.id || null,
          status,
        });

        // Update contact's last message
        await supabase
          .from("pc_contacts")
          .update({
            last_message_at: new Date().toISOString(),
            last_message_preview: body.trim().substring(0, 100),
            updated_at: new Date().toISOString(),
          })
          .eq("id", contact.id);

        return { contactId: contact.id, status };
      })
    );

    const sent = results.filter(
      (r) => r.status === "fulfilled" && r.value.status === "sent"
    ).length;
    const failed = results.length - sent;

    return NextResponse.json({
      broadcast,
      sent,
      failed,
      total: results.length,
    });
  } catch (err) {
    console.error("Bulk send error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
