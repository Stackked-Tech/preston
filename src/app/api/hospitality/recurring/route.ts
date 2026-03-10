import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function advanceDate(dateStr: string, frequency: string): string {
  const date = new Date(dateStr);
  switch (frequency) {
    case "daily":
      date.setDate(date.getDate() + 1);
      break;
    case "weekly":
      date.setDate(date.getDate() + 7);
      break;
    case "biweekly":
      date.setDate(date.getDate() + 14);
      break;
    case "monthly":
      date.setMonth(date.getMonth() + 1);
      break;
    case "quarterly":
      date.setMonth(date.getMonth() + 3);
      break;
    case "yearly":
      date.setFullYear(date.getFullYear() + 1);
      break;
    default:
      date.setDate(date.getDate() + 1);
  }
  return date.toISOString().split("T")[0];
}

export async function POST(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find due recurring tasks
    const today = new Date().toISOString().split("T")[0];
    const { data: dueTasks, error: fetchErr } = await supabase
      .from("hm_recurring_tasks")
      .select("*")
      .lte("next_due_date", today)
      .eq("is_active", true);

    if (fetchErr) {
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }

    if (!dueTasks?.length) {
      return NextResponse.json({ created: 0 });
    }

    let created = 0;

    for (const recurring of dueTasks) {
      // Create task instance
      const { error: insertErr } = await supabase.from("hm_tasks").insert({
        property_id: recurring.property_id,
        recurring_task_id: recurring.id,
        title: recurring.title,
        description: recurring.description,
        priority: recurring.priority,
        assigned_to: recurring.assigned_to,
        status: "new",
        due_date: recurring.next_due_date,
      });

      if (insertErr) {
        console.error(
          `Failed to create task from recurring ${recurring.id}:`,
          insertErr
        );
        continue;
      }

      // Advance next_due_date
      const nextDate = advanceDate(
        recurring.next_due_date,
        recurring.frequency
      );

      await supabase
        .from("hm_recurring_tasks")
        .update({ next_due_date: nextDate })
        .eq("id", recurring.id);

      created++;
    }

    return NextResponse.json({ created });
  } catch (err) {
    console.error("Hospitality recurring error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
