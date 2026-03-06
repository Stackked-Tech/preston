# Payout Suite: Rounding & Posting Period Format — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix Posting Period format and add ROUND() to all Excel formulas for NetSuite compatibility.

**Architecture:** Two edits in `src/lib/payrollExcel.ts` — one formatting change (Posting Period string), one formula change (ROUND wrapper on all formula cells).

**Tech Stack:** ExcelJS, Next.js, TypeScript

---

## Task 1: Format Posting Period as `MAR-26`

**Files:**
- Modify: `src/lib/payrollExcel.ts:260-262`

**Step 1: Add month abbreviation array and format the posting period**

Replace the Date object write (line 260-262) with a formatted string. The source `payPeriod.postingPeriod` is `"2026-03-01"`. Parse month index and year, format as `"MAR-26"`.

Add this array near the top of the file (after the import block, before `generatePayrollExcel`):

```typescript
const MONTH_ABBREVS = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];
```

Then replace:

```typescript
// AB: Posting Period
wsRow.getCell(28).value = new Date(
  payPeriod.postingPeriod + "T12:00:00"
);
```

With:

```typescript
// AB: Posting Period — format as "MAR-26" for NetSuite
const [ppYear, ppMonth] = payPeriod.postingPeriod.split("-");
wsRow.getCell(28).value = `${MONTH_ABBREVS[parseInt(ppMonth, 10) - 1]}-${ppYear.slice(2)}`;
```

**Step 2: Verify build**

Run: `npm run build`
Expected: Clean build, no type errors.

**Step 3: Commit**

```bash
git add src/lib/payrollExcel.ts
git commit -m "fix: format Posting Period as MAR-26 for NetSuite"
```

---

## Task 2: Wrap all Excel formulas with ROUND(..., 2)

**Files:**
- Modify: `src/lib/payrollExcel.ts` (lines 178-188, 192, 206, 222, 230, 252, 305-306, 318-319)

**Step 1: Update each formula cell**

Replace every formula string with its ROUND-wrapped version. Here are the exact before/after for each:

**Col F (line ~179):** Booth Rent Rebate wk1
```
Before: `IF(E${row}>250,0.2,IF(E${row}>149,0.15,IF(E${row}>49,0.1,0)))*E${row}`
After:  `ROUND(IF(E${row}>250,0.2,IF(E${row}>149,0.15,IF(E${row}>49,0.1,0)))*E${row},2)`
```

**Col H (line ~187):** Booth Rent Rebate wk2
```
Before: `IF(G${row}>250,0.2,IF(G${row}>149,0.15,IF(G${row}>49,0.1,0)))*G${row}`
After:  `ROUND(IF(G${row}>250,0.2,IF(G${row}>149,0.15,IF(G${row}>49,0.1,0)))*G${row},2)`
```

**Col I (line ~192):** Rebate Total
```
Before: `F${row}+H${row}`
After:  `ROUND(F${row}+H${row},2)`
```

**Col M (line ~206):** Total Earned
```
Before: `SUM(I${row}+J${row}+K${row}+L${row})`
After:  `ROUND(SUM(I${row}+J${row}+K${row}+L${row}),2)`
```

**Col R (line ~222):** CC Charges 3%
```
Before: `0.03*(-Q${row})`
After:  `ROUND(0.03*(-Q${row}),2)`
```

**Col T (line ~230):** Finders Fee 20%
```
Before: `0.2*(-S${row})`
After:  `ROUND(0.2*(-S${row}),2)`
```

**Col Z (line ~252):** Total Check
```
Before: `M${row}+(N${row}+O${row}+P${row}+R${row}+T${row}+U${row}+V${row}+W${row}+X${row}+Y${row})`
After:  `ROUND(M${row}+(N${row}+O${row}+P${row}+R${row}+T${row}+U${row}+V${row}+W${row}+X${row}+Y${row}),2)`
```

**Footer Total Payroll (line ~306):**
```
Before: `SUM(Z4:Z${lastDataRow})`
After:  `ROUND(SUM(Z4:Z${lastDataRow}),2)`
```

**Footer Total ACH (line ~319):**
```
Before: `Z${footerR1}+Z${footerR2}`
After:  `ROUND(Z${footerR1}+Z${footerR2},2)`
```

**Step 2: Verify build**

Run: `npm run build`
Expected: Clean build, no type errors.

**Step 3: Commit**

```bash
git add src/lib/payrollExcel.ts
git commit -m "fix: wrap all Excel formulas with ROUND(...,2) for NetSuite"
```
