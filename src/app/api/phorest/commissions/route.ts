import { NextRequest, NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import {
  fetchBranches,
  fetchStaff,
  fetchAppointments,
  fetchClientsBatch,
} from "@/lib/phorestClient";
import { calculateCommissions } from "@/lib/commissionCalculator";
import type { CommissionResult } from "@/types/phorest";

const CACHE_TTL_HOURS = 1;

export async function POST(request: NextRequest) {
  try {
    const { startDate, endDate, forceRefresh } = await request.json();

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "startDate and endDate are required" },
        { status: 400 }
      );
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      return NextResponse.json(
        { error: "Dates must be in YYYY-MM-DD format" },
        { status: 400 }
      );
    }

    if (startDate > endDate) {
      return NextResponse.json(
        { error: "startDate must be before endDate" },
        { status: 400 }
      );
    }

    const dateRangeKey = `${startDate}_${endDate}`;

    // Check cache (if Supabase is configured)
    if (isSupabaseConfigured && !forceRefresh) {
      const { data: cached } = await supabase
        .from("phorest_commission_cache")
        .select("results, expires_at")
        .eq("date_range_key", dateRangeKey)
        .single();

      if (cached && new Date(cached.expires_at) > new Date()) {
        return NextResponse.json(cached.results as CommissionResult);
      }
    }

    // Fetch from Phorest API
    const branches = await fetchBranches();

    const branchDataList = [];

    for (const branch of branches) {
      const [staff, appointments] = await Promise.all([
        fetchStaff(branch.branchId),
        fetchAppointments(branch.branchId, startDate, endDate),
      ]);

      branchDataList.push({ branch, staff, appointments });
    }

    // Collect unique client IDs from all appointments
    const allClientIds = new Set<string>();
    for (const { appointments } of branchDataList) {
      for (const appt of appointments) {
        if (appt.clientId) {
          allClientIds.add(appt.clientId);
        }
      }
    }

    // Batch-fetch client details
    const clients = await fetchClientsBatch(Array.from(allClientIds));

    // Calculate commissions
    const results = calculateCommissions(
      branchDataList,
      clients,
      startDate,
      endDate
    );

    // Cache results in Supabase
    if (isSupabaseConfigured) {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + CACHE_TTL_HOURS);

      await supabase.from("phorest_commission_cache").upsert(
        {
          date_range_key: dateRangeKey,
          results,
          fetched_at: new Date().toISOString(),
          expires_at: expiresAt.toISOString(),
        },
        { onConflict: "date_range_key" }
      );
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error("Commission calculation error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to calculate commissions",
      },
      { status: 500 }
    );
  }
}
