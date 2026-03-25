import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { createStaffNameResolver } from "@/lib/payrollTransform";
import { fetchBranchConfigs } from "@/lib/payrollConfig";

/**
 * Lightweight endpoint for the client to poll while waiting for
 * the GitHub Action to populate cached tips. Returns tips keyed
 * by display name (same name resolution as the payroll route).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const branchId = searchParams.get("branchId");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  if (!branchId || !startDate || !endDate) {
    return NextResponse.json({ ready: false });
  }

  const { data } = await supabase
    .from("ps_looker_tips")
    .select("staff_name, paid_to_salon")
    .eq("branch_id", branchId)
    .eq("start_date", startDate)
    .eq("end_date", endDate);

  if (!data || data.length === 0) {
    return NextResponse.json({ ready: false });
  }

  // Resolve Looker names → display names (same logic as payroll route)
  const allBranches = await fetchBranchConfigs();
  const branch = allBranches.find((b) => b.branchId === branchId);
  if (!branch) {
    return NextResponse.json({ ready: true, tips: {} });
  }

  const resolveName = createStaffNameResolver(
    Object.keys(branch.staffConfig)
  );

  const tipsByDisplayName: Record<string, number> = {};
  for (const row of data) {
    const cleanName = row.staff_name.replace(/\s+/g, " ").trim();
    const resolved = resolveName(cleanName) || cleanName;
    tipsByDisplayName[resolved] = Math.round(row.paid_to_salon * 100) / 100;
  }

  return NextResponse.json({ ready: true, tips: tipsByDisplayName });
}
