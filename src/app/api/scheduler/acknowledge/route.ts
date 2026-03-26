import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(req: NextRequest) {
  try {
    const { taskId, subToken } = await req.json();

    if (!taskId || !subToken) {
      return NextResponse.json({ error: "taskId and subToken are required" }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify token is valid and get sub
    const { data: tokenData, error: tokenErr } = await supabase
      .from("cs_sub_tokens")
      .select("sub_id, expires_at")
      .eq("token", subToken)
      .single();

    if (tokenErr || !tokenData) {
      return NextResponse.json({ error: "Invalid token" }, { status: 403 });
    }

    // Check expiry
    if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
      return NextResponse.json({ error: "Token expired" }, { status: 403 });
    }

    // Verify task is assigned to this sub
    const { data: task, error: taskErr } = await supabase
      .from("cs_tasks")
      .select("id, sub_id")
      .eq("id", taskId)
      .eq("sub_id", tokenData.sub_id)
      .single();

    if (taskErr || !task) {
      return NextResponse.json({ error: "Task not found or not assigned to you" }, { status: 404 });
    }

    // Set acknowledged
    const { error: updateErr } = await supabase
      .from("cs_tasks")
      .update({ acknowledged_at: new Date().toISOString() })
      .eq("id", taskId);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, acknowledged_at: new Date().toISOString() });
  } catch (err) {
    console.error("Acknowledge error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
