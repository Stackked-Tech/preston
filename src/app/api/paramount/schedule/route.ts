import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Create a scheduled message
export async function POST(req: NextRequest) {
  try {
    const { contactId, body, scheduledAt } = await req.json();

    if (!contactId || !body?.trim() || !scheduledAt) {
      return NextResponse.json(
        { error: "contactId, body, and scheduledAt are required" },
        { status: 400 }
      );
    }

    const scheduled = new Date(scheduledAt);
    if (scheduled <= new Date()) {
      return NextResponse.json(
        { error: "Scheduled time must be in the future" },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase
      .from("pc_scheduled_messages")
      .insert({
        contact_id: contactId,
        body: body.trim(),
        scheduled_at: scheduled.toISOString(),
        status: "pending",
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ scheduled: data });
  } catch (err) {
    console.error("Schedule error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Cancel a scheduled message
export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { error } = await supabase
      .from("pc_scheduled_messages")
      .update({ status: "cancelled" })
      .eq("id", id)
      .eq("status", "pending");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Cancel schedule error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
