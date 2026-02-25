/**
 * Payroll Excel Generator
 *
 * TypeScript port of phorest_to_netsuite.py generate_xlsx().
 * Generates a NetSuite-compatible XLSX using exceljs.
 */

import ExcelJS from "exceljs";
import type { BranchConfig, PayPeriodConfig } from "./payrollConfig";
import type { PayrollResults } from "./payrollTransform";

// ═══════════════════════════════════════════════════════════════════════════════
// EXCEL GENERATION
// ═══════════════════════════════════════════════════════════════════════════════

export async function generatePayrollExcel(
  results: PayrollResults,
  branch: BranchConfig,
  payPeriod: PayPeriodConfig
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Sheet1");

  const { staffConfig } = branch;
  const { staffData, staffOrder } = results;

  // ── Header Row 1 ──
  const headersR1 = [
    "",
    "",
    "",
    "",
    "Product Sales",
    "",
    "Product Sales",
    "Booth Rent",
    "(GL 7140)",
    "(GL 7150)",
    "(GL 7170)",
    "(GL 7180)",
    "Total",
    "(GL 4020)",
    "(GL 4030)",
    "(GL 4045)",
    "Credit Card Amount",
    "(GL 4040)",
    "New Guests",
    "(GL 4060)",
    "(GL 4070)",
    "(GL 4080)",
    "(GL 4090)",
    "(GL 4120)",
    "Misc. Fees",
    "Total",
    "Account",
    "Posting Period",
    "Reference #",
    "Due Date",
    "Approval Status\n(Approved/\nPending)",
    "",
  ];

  // ── Header Row 2 ──
  const headersR2 = [
    "",
    "",
    "",
    "",
    "(wk 1)",
    "Booth Rent",
    "(wk 2)",
    "Rebate (wk 2)",
    "Booth Rent",
    "Tips",
    "Contractor",
    "Associate",
    "Earned",
    "Station",
    "Financial",
    "Color",
    "",
    "Credit Card",
    "",
    "Finders",
    "Employee",
    "Phorest",
    "Refreshment",
    "Associate",
    "",
    "check",
    "",
    "",
    "",
    "",
    "",
    "",
  ];

  // ── Header Row 3 ──
  const headersR3 = [
    "Subsidiary ID",
    "Internal ID",
    "First Names",
    "Last Name",
    "",
    "Rebate (wk 1)",
    "",
    "",
    "Rebate Total",
    "",
    "Service",
    "Pay",
    "",
    "Lease",
    "Services",
    "Charges",
    "",
    "Charges 3%",
    "",
    "Fee 20%",
    "Purchases",
    "",
    "",
    "Fee",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "Pay Period",
  ];

  ws.getRow(1).values = headersR1;
  ws.getRow(2).values = headersR2;
  ws.getRow(3).values = headersR3;

  // Format pay date for Reference # column
  const payDateObj = new Date(payPeriod.payDate + "T12:00:00");
  const payDateRef = `ACH ${payDateObj.getMonth() + 1}.${payDateObj.getDate()}.${payDateObj.getFullYear()}`;

  // ── Data Rows ──
  for (let i = 0; i < staffOrder.length; i++) {
    const phorestName = staffOrder[i];
    const row = 4 + i;
    const cfg = staffConfig[phorestName];
    const data = staffData[phorestName] || {
      productWk1: 0,
      productWk2: 0,
      contractorService: 0,
      associatePay: 0,
      tips: 0,
      newGuests: 0,
      employeePurchases: 0,
      creditCardAmount: 0,
    };

    const wsRow = ws.getRow(row);

    // A: Subsidiary ID
    wsRow.getCell(1).value = payPeriod.subsidiaryId;

    // B: Internal ID
    wsRow.getCell(2).value = cfg.internalId;

    // C: First Name
    wsRow.getCell(3).value = cfg.targetFirst;

    // D: Last Name
    wsRow.getCell(4).value = cfg.targetLast;

    // E: Product Sales (wk 1)
    wsRow.getCell(5).value = data.productWk1 || null;

    // F: Booth Rent Rebate (wk 1) — FORMULA
    wsRow.getCell(6).value = {
      formula: `IF(E${row}>250,0.2,IF(E${row}>149,0.15,IF(E${row}>49,0.1,0)))*E${row}`,
    } as ExcelJS.CellFormulaValue;

    // G: Product Sales (wk 2)
    wsRow.getCell(7).value = data.productWk2 || null;

    // H: Booth Rent Rebate (wk 2) — FORMULA
    wsRow.getCell(8).value = {
      formula: `IF(G${row}>250,0.2,IF(G${row}>149,0.15,IF(G${row}>49,0.1,0)))*G${row}`,
    } as ExcelJS.CellFormulaValue;

    // I: Booth Rent Rebate Total — FORMULA
    wsRow.getCell(9).value = {
      formula: `F${row}+H${row}`,
    } as ExcelJS.CellFormulaValue;

    // J: Tips
    wsRow.getCell(10).value = data.tips || null;

    // K: Contractor Service
    wsRow.getCell(11).value = data.contractorService || null;

    // L: Associate Pay
    wsRow.getCell(12).value = data.associatePay || null;

    // M: Total Earned — FORMULA
    wsRow.getCell(13).value = {
      formula: `SUM(I${row}+J${row}+K${row}+L${row})`,
    } as ExcelJS.CellFormulaValue;

    // N: Station Lease
    wsRow.getCell(14).value = cfg.stationLease;

    // O: Financial Services
    wsRow.getCell(15).value = cfg.financialServices;

    // P: Color Charges (blank — manual entry)
    wsRow.getCell(16).value = null;

    // Q: Credit Card Amount
    wsRow.getCell(17).value = data.creditCardAmount || null;

    // R: Credit Card Charges 3% — FORMULA
    wsRow.getCell(18).value = {
      formula: `0.03*(-Q${row})`,
    } as ExcelJS.CellFormulaValue;

    // S: New Guests
    wsRow.getCell(19).value = data.newGuests || null;

    // T: Finders Fee 20% — FORMULA
    wsRow.getCell(20).value = {
      formula: `0.2*(-S${row})`,
    } as ExcelJS.CellFormulaValue;

    // U: Employee Purchases
    wsRow.getCell(21).value = data.employeePurchases
      ? -data.employeePurchases
      : null;

    // V: Phorest
    wsRow.getCell(22).value = cfg.phorestFee;

    // W: Refreshment
    wsRow.getCell(23).value = cfg.refreshment;

    // X: Associate Fee (populated on supervisor rows below)
    wsRow.getCell(24).value = null;

    // Y: Misc Fees (blank)
    wsRow.getCell(25).value = null;

    // Z: Total Check — FORMULA
    wsRow.getCell(26).value = {
      formula: `M${row}+(N${row}+O${row}+P${row}+R${row}+T${row}+U${row}+V${row}+W${row}+X${row}+Y${row})`,
    } as ExcelJS.CellFormulaValue;

    // AA: Account
    wsRow.getCell(27).value = payPeriod.account;

    // AB: Posting Period
    wsRow.getCell(28).value = new Date(
      payPeriod.postingPeriod + "T12:00:00"
    );

    // AC: Reference #
    wsRow.getCell(29).value = payDateRef;

    // AD: Due Date
    wsRow.getCell(30).value = new Date(payPeriod.payDate + "T12:00:00");

    // AE: Approval Status
    wsRow.getCell(31).value = "Approved";

    // AF: Pay Period
    wsRow.getCell(32).value = payPeriod.payPeriodLabel;
  }

  // ── Associate Fee (Col X) — populated on supervisor rows ──
  // Uses the computed associatePay from the data (not config)
  for (const [phorestName, cfg] of Object.entries(staffConfig)) {
    const { supervisor } = cfg;
    const assocPayData = staffData[phorestName]?.associatePay || 0;
    if (supervisor && assocPayData && staffConfig[supervisor]) {
      const supIdx = staffOrder.indexOf(supervisor);
      if (supIdx >= 0) {
        const supRow = 4 + supIdx;
        const existing =
          (ws.getRow(supRow).getCell(24).value as number) || 0;
        ws.getRow(supRow).getCell(24).value = existing + -assocPayData;
      }
    }
  }

  // ── Footer Rows ──
  const lastDataRow = 3 + staffOrder.length;
  const footerR1 = lastDataRow + 1;
  const footerR2 = lastDataRow + 2;
  const footerR3 = lastDataRow + 3;

  // Determine branch abbreviation for footer
  const branchAbbrev = branch.abbreviation.split(" ").pop() || "01";
  const footerLabel = `WHS ${branchAbbrev === "WHS" ? "01" : branchAbbrev.replace("WHS ", "")}`;

  ws.getRow(footerR1).getCell(3).value = footerLabel;
  ws.getRow(footerR1).getCell(25).value = "TOTAL PAYROLL:";
  ws.getRow(footerR1).getCell(26).value = {
    formula: `SUM(Z4:Z${lastDataRow})`,
  } as ExcelJS.CellFormulaValue;

  ws.getRow(footerR2).getCell(3).value = "Pay Period:";
  ws.getRow(footerR2).getCell(4).value = payPeriod.payPeriodLabel;
  ws.getRow(footerR2).getCell(25).value = "TOTAL EMP. W/DRAWL:";

  ws.getRow(footerR3).getCell(3).value = "Pay Date:";
  ws.getRow(footerR3).getCell(4).value = new Date(
    payPeriod.payDate + "T12:00:00"
  );
  ws.getRow(footerR3).getCell(25).value = "TOTAL ACH:";
  ws.getRow(footerR3).getCell(26).value = {
    formula: `Z${footerR1}+Z${footerR2}`,
  } as ExcelJS.CellFormulaValue;

  // Write to buffer
  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
