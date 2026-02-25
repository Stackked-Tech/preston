# Phorest CSV to NetSuite Payroll Mapping Documentation

## Overview

**Source:** Phorest API transaction export CSV (one row per line item)
**Target:** NetSuite payroll import spreadsheet (one row per staff member)
**Branch:** William Henry Salon Mount Holly
**Pay Period Example:** 2/1-14/2026 (transactions dated Feb 2-14, weekends excluded)

---

## Source File Structure

### File: Phorest Transaction Export CSV

- **121 columns**, ~1,047 data rows per pay period
- Each row = one line item (a single service, product, or deposit within a transaction)
- Multiple rows share the same `transaction_id` (one client visit = multiple line items)
- Tips and payment data are **duplicated across all rows in a transaction** — must deduplicate by `transaction_id`

### Item Types

| `item_type` | Description | Typical Count |
|---|---|---|
| `SERVICE` | Hair services (cuts, color, highlights, blowouts, etc.) | ~939 |
| `PRODUCT` | Retail product sales (Redken, Pureology, etc.) | ~59 |
| `APPOINTMENT_DEPOSIT` | Pre-appointment deposits (not revenue) | ~49 |

### Purchase Types

| `purchase_type` | Description |
|---|---|
| `SALE` | Normal transaction |
| `REFUND` | Reversal (negative amounts, quantity = -1) |

### Staff Categories (from `staff_category_name`)

| Category | Role in Payroll | Pay Column |
|---|---|---|
| Level 1-5 | Contractor | Col K (Contractor Service) |
| Stylist | Associate | Col L (Associate Pay) |
| Owner | Excluded from payroll | N/A |
| Esthetician | Special handling | Col K |

### Payment Codes (from `payment_type_codes`)

| Code | Name | Description |
|---|---|---|
| `CC` | Credit | Credit card payment |
| `C` | Cash | Cash payment |
| `GC` | Gift Card | Gift card redemption |
| `AD` | Appointment Deposit | Deposit applied to transaction |
| `ES` | Employee Sale | Staff member purchasing products |
| `CH` | Cheque | Check payment |

### Key Source Columns

| Column | Used For |
|---|---|
| `staff_first_name`, `staff_last_name` | Staff identification |
| `staff_category_name` | Contractor vs Associate classification |
| `item_type` | SERVICE / PRODUCT / APPOINTMENT_DEPOSIT |
| `purchased_date` | Date of transaction (determines week 1 vs week 2) |
| `unit_price` | Pre-tax/pre-discount price (used for New Guests) |
| `total_amount` | Final line item amount (used for service totals, product sales) |
| `service_category_name` | HAIR, COLOR SERVICES, WAXING, etc. |
| `client_source` | How client was acquired (new guest detection) |
| `client_first_visit` | Date of client's first visit (new guest validation) |
| `payment_type_codes` | Semicolon-separated payment method codes per transaction |
| `payment_type_amounts` | Semicolon-separated payment amounts (parallel to codes) |
| `payment_type_names` | Semicolon-separated payment method names |
| `phorest_tips` | Tip amount for the transaction (deduplicate by transaction_id) |
| `transaction_id` | Groups line items into a single client visit |

---

## Target File Structure

### Sheet1: Payroll Summary

- **3 header rows** (rows 1-3), **1 data row per staff member** (starting row 4)
- Footer rows for TOTAL PAYROLL, TOTAL EMP. W/DRAWL, TOTAL ACH

### Week Split

The pay period is split into two weeks for product sales:
- **Week 1:** First 6 business days (e.g., Feb 2-7)
- **Week 2:** Next 6 business days (e.g., Feb 9-14)

---

## Column-by-Column Mapping

### A: Subsidiary ID
- **Value:** Always `5` (hardcoded)

### B: Internal ID
- **Value:** Static NetSuite employee ID per staff member (hardcoded)
- **Source:** Not in Phorest data — maintained in a separate lookup

### C: First Names
- **Source:** `staff_first_name`

### D: Last Name
- **Source:** `staff_last_name`

### E: Product Sales (wk 1)
- **Formula:** Sum of `total_amount` where `item_type = 'PRODUCT'` AND `purchased_date` falls in week 1
- **Grouped by:** Staff member
- **Verified:** Exact match (e.g., Danielle Baker wk1 = 122.64)

### F: Booth Rent Rebate (wk 1)
- **Formula:** Tiered percentage applied to column E:
  ```
  IF(E > 250, 0.20,
    IF(E > 149, 0.15,
      IF(E > 49, 0.10, 0))) * E
  ```
- **Note:** This is a formula in the output spreadsheet, not a flat value

### G: Product Sales (wk 2)
- **Formula:** Same as Col E but for week 2 dates
- **Verified:** Exact match (e.g., Danielle Baker wk2 = 83.07)

### H: Booth Rent Rebate (wk 2)
- **Formula:** Same tiered formula as Col F, applied to Col G

### I: Booth Rent Rebate Total (GL 7140)
- **Formula:** `= F + H`

### J: Tips (GL 7150)
- **Source:** `phorest_tips` column, **deduplicated by `transaction_id`**
- **Important:** Each line item in a transaction repeats the same tip value — only count once per transaction per staff member

### K: Contractor Service (GL 7170)
- **Formula:** Sum of `total_amount` where `item_type = 'SERVICE'` for staff with `staff_category_name` in Level 1-5 or Esthetician
- **Verified:** Exact match (e.g., Danielle Baker = 2912, Grace Deason = 4169, Lauren Simonds = 7687)

### L: Associate Pay (GL 7180)
- **Formula:** Sum of `total_amount` where `item_type = 'SERVICE'` for staff with `staff_category_name = 'Stylist'`
- **Note:** Associates are: Addison Brown, Grace Lesser, Maddie Schultz, Sierra Sharpe

### M: Total Earned
- **Formula:** `= I + J + K + L`

### N: Station Lease (GL 4020)
- **Value:** Negative fixed amount per staff member (hardcoded)
- **Typical values:** -336, -390, -320, -238, -25, 0
- **Source:** Not in Phorest data — maintained in separate config

### O: Financial Services (GL 4030)
- **Value:** Negative fixed amount per staff member (hardcoded)
- **Typical values:** -100, -50, 0

### P: Color Charges (GL 4045)
- **Value:** Negative amount representing color product cost deduction
- **Source:** TBD — derivation not yet confirmed

### Q: Credit Card Amount
- **Formula:** `SUM(gross_total_amount for CC transactions) + SUM(gross_total_amount for GC transactions)`
- **Filters:** `item_type` IN (`SERVICE`, `PRODUCT`), `purchased_date >= periodStart` AND `purchased_date < periodEnd` (exclusive — last day of pay period excluded due to CC processing cutoff)
- **Note:** Transactions paid with both CC and GC (e.g., `CC;GC`) have their line items counted in **both** sums (intentional double-count — both payment methods contributed to revenue). Voided rows are included (negative amounts self-correct).
- **Verified:** 21/21 exact match against reference spreadsheet

### R: Credit Card Charges 3% (GL 4040)
- **Formula:** `= 0.03 * (-Q)`
- **Purpose:** 3% CC processing fee deducted from stylist pay

### S: New Guests
- **Formula:** Sum of `unit_price` for line items where ALL of:
  1. `item_type = 'SERVICE'`
  2. `client_source` is `"Call In ---New Guest"` OR `"Online Booking ---New Guest"` OR `"Walk In --New Guest"`
  3. `client_first_visit` falls within the pay period date range
- **Verified:** Exact match for all tested staff (Dotson=206, Houghtaling=58, Deason=261, Parker=82, Mcclure=43, Wilson=106)
- **Note:** Both conditions (source AND first_visit date) are required. Source alone over-counts because clients retain their "new guest" source tag on subsequent visits.

### T: Finders Fee 20% (GL 4060)
- **Formula:** `= 0.2 * (-S)`

### U: Employee Purchases (GL 4070)
- **Source:** Transactions where `payment_type_names` contains `"Employee Sale"` (payment code `ES`)
- **Matching logic:** The **client name** on ES transactions identifies the employee. All ES transactions are recorded with staff = "In House" but the `client_first_name`/`client_last_name` is the actual employee.
- **Value:** Negative of the `payment_type_amounts` for the ES code, summed per employee
- **Deduplicate by:** `transaction_id`
- **Verified:** Exact match:
  - Jess Herzog: 21.58 + 21.60 = 43.18 (target: -43.18)
  - Grace Deason: 19.26 + 29.74 = 49.00 (target: -49.00)
  - Olivia Wilson (Cornette): 19.26 (target: -19.26)
  - Keleigh Ratliff: 20.82 (target: -20.82)

### V: Phorest (GL 4080)
- **Value:** Fixed fee per staff member (hardcoded)
- **Typical values:** -10 (full-time), -5 (part-time), 0

### W: Refreshment (GL 4090)
- **Value:** Fixed fee per staff member (hardcoded)
- **Typical values:** -10 (full-time), -5 (part-time), 0

### X: Associate Fee (GL 4120)
- **Value:** Negative amount charged to the supervising contractor, equal to the associate's total pay
- **Linkage:** Each associate's Col L value appears as a negative in their supervisor's Col X
- **Verified:**
  - Sierra Sharpe (Associate Pay L = 529.56) → Kristen Forehand (Associate Fee X = -529.56)
  - Addison Brown (Associate Pay L = 984.0) → Seth King (Associate Fee X = -984.0)
- **Source:** Associate-to-supervisor mapping is hardcoded/configured separately

### Y: Misc. Fees
- **Value:** Usually empty/blank

### Z: Total Check
- **Formula:** `= M + (N + O + P + R + T + U + V + W + X + Y)`
- **Note:** Col Q (Credit Card Amount) is NOT in this formula — only Col R (the 3% fee) is

### AA: Account
- **Value:** Always `111`

### AB: Posting Period
- **Value:** First day of the pay period month (e.g., `2026-02-01`)

### AC: Reference #
- **Value:** Format `"ACH {pay_date}"` (e.g., `"ACH 2.19.2026"`)

### AD: Due Date
- **Value:** Pay date (e.g., `2026-02-19`)

### AE: Approval Status
- **Value:** `"Approved"`

### AF: Pay Period
- **Value:** Format `"M/D-D/YYYY"` (e.g., `"2/1-14/2026"`)

---

## Footer Rows

| Row | Col Y Label | Col Z Value |
|---|---|---|
| 27 | TOTAL PAYROLL: | `= SUM(Z4:Z{last_staff_row})` |
| 28 | TOTAL EMP. W/DRAWL: | Manually entered amount |
| 29 | TOTAL ACH: | `= Z27 + Z28` |

---

## Additional Notes

### Transaction Deduplication
Many fields (tips, payment amounts, payment codes) are repeated on every line item within a transaction. When summing these, always deduplicate by `transaction_id` per staff member.

### Refunds
`purchase_type = 'REFUND'` rows have `quantity = -1` and negative `total_amount`. These are included in calculations (they naturally reduce totals). All observed refunds in the sample were appointment deposit reversals.

### APPOINTMENT_DEPOSIT Items
These are prepayments, not service revenue. They should be **excluded** from service totals (Col K/L) and product sales (Col E/G). They only appear in the payment flow.

### Client Source Values in Data
| Value | Meaning |
|---|---|
| `Call In ---New Guest` | New guest booked by phone |
| `Online Booking ---New Guest` | New guest booked online |
| `Walk In --New Guest` | Walk-in new guest (not used for New Guest calc) |
| `Referral--asked for stylist by name` | Referral client |
| `Online Booking-referral` | Online referral |
| `Repeat Guest` | Returning client |
| `216` | Unknown/legacy code |

### Columns Not Yet Mapped
| Column | Status |
|---|---|
| P: Color Charges (GL 4045) | Derivation not confirmed — negative amount, not raw color service revenue |
