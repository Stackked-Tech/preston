import { NextRequest, NextResponse } from "next/server";
import {
  createCsvExportJob,
  pollCsvExportJob,
  downloadCsv,
} from "@/lib/phorestClient";
import { processCSV, createStaffNameResolver } from "@/lib/payrollTransform";
import { fetchStaffTips } from "@/lib/phorestLookerClient";
import { generatePayrollExcel } from "@/lib/payrollExcel";
import {
  fetchBranchConfigs,
  computePayPeriodConfig,
  branchSlug,
} from "@/lib/payrollConfig";
import { parseColorChargesCSV } from "@/lib/colorChargesParser";
import { supabase } from "@/lib/supabase";

export const maxDuration = 300; // 5 min for Vercel Pro

export async function POST(request: NextRequest) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const { branchId, startDate, endDate, colorChargesCsv } = body;

    if (!branchId || !startDate || !endDate) {
      return NextResponse.json(
        { error: "branchId, startDate, and endDate are required" },
        { status: 400 }
      );
    }

    // Validate date format
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

    // Get branch config from DB
    const allBranches = await fetchBranchConfigs();
    const branch = allBranches.find((b) => b.branchId === branchId);
    if (!branch) {
      return NextResponse.json(
        { error: `Unknown branch: ${branchId}` },
        { status: 400 }
      );
    }

    if (!branch || Object.keys(branch.staffConfig).length === 0) {
      return NextResponse.json(
        {
          error: `Branch "${branch.name}" is not yet configured with staff data`,
          branchName: branch.name,
          configured: false,
        },
        { status: 422 }
      );
    }

    // Compute pay period config
    const payPeriod = computePayPeriodConfig(
      startDate,
      endDate,
      branch.subsidiaryId,
      branch.account
    );

    // 1. Create CSV export job
    const job = await createCsvExportJob(branchId, startDate, endDate);

    // 2. Poll until done
    const completedJob = await pollCsvExportJob(branchId, job.jobId);

    if (completedJob.jobStatus === "FAILED") {
      return NextResponse.json(
        {
          error: `Phorest export job failed: ${completedJob.failureReason || "Unknown reason"}`,
        },
        { status: 502 }
      );
    }

    if (!completedJob.tempCsvExternalUrl) {
      return NextResponse.json(
        { error: "No download URL in completed job" },
        { status: 502 }
      );
    }

    // 3. Download CSV
    const csvText = await downloadCsv(completedJob.tempCsvExternalUrl);

    // 4. Transform CSV data
    const results = processCSV(
      csvText,
      branch,
      startDate,
      endDate,
      payPeriod.week1End
    );

    // 4b. Apply color charges if CSV provided
    if (colorChargesCsv && typeof colorChargesCsv === "string") {
      const colorResult = parseColorChargesCSV(colorChargesCsv, branch);
      for (const [staffName, amount] of Object.entries(colorResult.charges)) {
        if (results.staffData[staffName]) {
          results.staffData[staffName].colorCharges = amount;
        }
      }
      results.warnings.push(...colorResult.warnings);
    }

    // 4c. Overlay tips from Supabase cache (populated by GitHub Action)
    // If no cache exists, trigger GitHub Action and poll until tips arrive.
    let tipsSource: "looker" | "supabase-cache" | "csv-gc-fallback" =
      "csv-gc-fallback";
    const resolveName = createStaffNameResolver(
      Object.keys(branch.staffConfig)
    );

    // Helper: read cached tips from Supabase
    async function readCachedTips() {
      const { data } = await supabase
        .from("ps_looker_tips")
        .select("staff_name, paid_to_salon")
        .eq("branch_id", branchId)
        .eq("start_date", startDate)
        .eq("end_date", endDate);
      return data && data.length > 0 ? data : null;
    }

    // Helper: apply tip rows to staffData
    function applyTips(
      tipRows: { staff_name: string; paid_to_salon: number }[]
    ) {
      for (const name of Object.keys(results.staffData)) {
        results.staffData[name].tips = 0;
      }
      for (const row of tipRows) {
        const cleanName = row.staff_name.replace(/\s+/g, " ").trim();
        const resolved = resolveName(cleanName) || cleanName;
        if (results.staffData[resolved]) {
          results.staffData[resolved].tips =
            Math.round(row.paid_to_salon * 100) / 100;
        }
      }
    }

    // Check cache first
    let cachedTips = await readCachedTips();

    if (cachedTips) {
      applyTips(cachedTips);
      tipsSource = "supabase-cache";
    } else {
      // No cache — trigger GitHub Action in the background (don't block payroll)
      const ghToken = process.env.GITHUB_PAT;
      if (ghToken) {
        try {
          const dispatchRes = await fetch(
            "https://api.github.com/repos/Stackked-Tech/preston/actions/workflows/fetch-looker-tips.yml/dispatches",
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${ghToken}`,
                Accept: "application/vnd.github.v3+json",
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                ref: "main",
                inputs: { branchId, startDate, endDate },
              }),
            }
          );

          if (dispatchRes.ok) {
            results.warnings.push(
              "Tips are being fetched in the background — re-run payroll in ~60s to include tips, or enter them manually."
            );
          } else {
            results.warnings.push(
              `Tips fetch trigger failed (HTTP ${dispatchRes.status}) — enter tips manually.`
            );
          }
        } catch (err) {
          results.warnings.push(
            `Tips fetch error: ${err instanceof Error ? err.message : "Unknown"} — enter tips manually.`
          );
        }
      } else {
        // No GITHUB_PAT — try live Looker as fallback (works locally)
        try {
          const lookerTips = await fetchStaffTips({
            branchId,
            branchName: branch.name,
            startDate,
            endDate,
          });

          for (const name of Object.keys(results.staffData)) {
            results.staffData[name].tips = 0;
          }
          for (const [lookerName, paidToSalon] of lookerTips) {
            const resolved = resolveName(lookerName) || lookerName;
            if (results.staffData[resolved]) {
              results.staffData[resolved].tips =
                Math.round(paidToSalon * 100) / 100;
            }
          }
          tipsSource = "looker";
          if (lookerTips.size === 0) {
            results.warnings.push(
              "No tips found — enter manually."
            );
          }
        } catch (err) {
          results.warnings.push(
            `Tips unavailable — enter manually. (${err instanceof Error ? err.message : "Unknown"})`
          );
        }
      }
    }

    // 5. Generate Excel
    const excelBuffer = await generatePayrollExcel(results, branch, payPeriod);
    const excelBase64 = excelBuffer.toString("base64");

    // 6. Upload to Supabase storage (non-blocking — failure is a warning)
    let filePath: string | null = null;
    let storageWarning: string | null = null;
    try {
      const now = new Date();
      const timestamp = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const slug = branchSlug(branchId, allBranches);
      filePath = `${slug}/run-${timestamp}_period-${startDate}_to_${endDate}_pay-${payPeriod.payDate}.xlsx`;

      const { error: uploadError } = await supabase.storage
        .from("payroll")
        .upload(filePath, excelBuffer, {
          contentType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          upsert: false,
        });

      if (uploadError) {
        storageWarning = `Storage upload failed: ${uploadError.message}`;
        filePath = null;
      }
    } catch (uploadErr) {
      storageWarning = `Storage upload error: ${uploadErr instanceof Error ? uploadErr.message : "Unknown"}`;
      filePath = null;
    }

    // Merge storage warning into warnings if present
    const allWarnings = [...results.warnings];
    if (storageWarning) allWarnings.push(storageWarning);

    return NextResponse.json({
      branchId: branch.branchId,
      branchName: branch.name,
      abbreviation: branch.abbreviation,
      payPeriod: payPeriod.payPeriodLabel,
      payDate: payPeriod.payDate,
      staffData: results.staffData,
      staffOrder: results.staffOrder,
      staffConfig: branch.staffConfig,
      warnings: allWarnings,
      excelBase64,
      filePath,
      tipsSource,
      totalRows: completedJob.totalRows,
      subsidiaryId: payPeriod.subsidiaryId,
      account: payPeriod.account,
      postingPeriod: payPeriod.postingPeriod,
    });
  } catch (error) {
    console.error("Payroll processing error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to process payroll",
      },
      { status: 500 }
    );
  }
}
