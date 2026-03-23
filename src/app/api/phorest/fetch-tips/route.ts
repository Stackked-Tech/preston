import { NextRequest, NextResponse } from "next/server";

/**
 * Triggers the GitHub Action to fetch Looker tips and store in Supabase.
 * POST body: { branchId, startDate, endDate }
 */
export async function POST(request: NextRequest) {
  const token = process.env.GITHUB_PAT;
  if (!token) {
    return NextResponse.json(
      { error: "GITHUB_PAT not configured" },
      { status: 500 }
    );
  }

  try {
    const { branchId, startDate, endDate } = await request.json();
    if (!branchId || !startDate || !endDate) {
      return NextResponse.json(
        { error: "Missing branchId, startDate, or endDate" },
        { status: 400 }
      );
    }

    // Trigger the workflow via GitHub API
    const res = await fetch(
      "https://api.github.com/repos/Stackked-Tech/preston/actions/workflows/fetch-looker-tips.yml/dispatches",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ref: "main",
          inputs: {
            branchId,
            startDate,
            endDate,
          },
        }),
      }
    );

    if (!res.ok) {
      const body = await res.text();
      return NextResponse.json(
        { error: `GitHub API error: ${res.status} — ${body}` },
        { status: 502 }
      );
    }

    return NextResponse.json({
      status: "triggered",
      message: "Tips fetch started. Results will appear in ~30-60 seconds.",
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
