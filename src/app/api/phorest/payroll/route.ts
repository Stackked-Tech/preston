import { NextRequest, NextResponse } from "next/server";
import {
  createCsvExportJob,
  pollCsvExportJob,
  downloadCsv,
} from "@/lib/phorestClient";
import { processCSV } from "@/lib/payrollTransform";
import { generatePayrollExcel } from "@/lib/payrollExcel";
import {
  fetchBranchConfigs,
  computePayPeriodConfig,
  branchSlug,
} from "@/lib/payrollConfig";
import { parseColorChargesCSV } from "@/lib/colorChargesParser";
import { supabase } from "@/lib/supabase";

export const maxDuration = 300; // 5 min for Vercel (Pro plan)

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

    // 5. Generate Excel
    const excelBuffer = await generatePayrollExcel(results, branch, payPeriod);
    const excelBase64 = excelBuffer.toString("base64");

    // 6. Upload to Supabase storage (non-blocking — failure is a warning)
    let filePath: string | null = null;
    let storageWarning: string | null = null;
    try {
      const now = new Date();
      const timestamp = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const slug = branchSlug(branchId);
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
      totalRows: completedJob.totalRows,
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
