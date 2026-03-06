import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const from = formData.get("From") as string;
    const body = formData.get("Body") as string;
    const messageSid = formData.get("MessageSid") as string;

    if (!from || !body) {
      return new NextResponse(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        { headers: { "Content-Type": "text/xml" } }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Find contact by phone number
    let { data: contact } = await supabase
      .from("pc_contacts")
      .select("*")
      .eq("phone_number", from)
      .single();

    // Auto-create contact if unknown number
    if (!contact) {
      const { data: newContact } = await supabase
        .from("pc_contacts")
        .insert({
          name: from,
          phone_number: from,
          is_active: true,
          tags: ["unknown"],
        })
        .select()
        .single();
      contact = newContact;
    }

    if (!contact) {
      return new NextResponse(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        { headers: { "Content-Type": "text/xml" } }
      );
    }

    // Store inbound message
    await supabase.from("pc_messages").insert({
      contact_id: contact.id,
      direction: "inbound",
      body,
      status: "received",
      twilio_sid: messageSid,
    });

    // Update contact's last message and increment unread count
    await supabase
      .from("pc_contacts")
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: body.substring(0, 100),
        unread_count: (contact.unread_count || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", contact.id);

    // Return empty TwiML (no auto-reply)
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { headers: { "Content-Type": "text/xml" } }
    );
  } catch (err) {
    console.error("Webhook error:", err);
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { headers: { "Content-Type": "text/xml" } }
    );
  }
}
