import type { TCEmployee, TCTimeEntry, TCCompany, TCJob } from "@/types/timeclock";

function getHours(entry: TCTimeEntry): number {
  const start = new Date(entry.clock_in).getTime();
  const end = entry.clock_out ? new Date(entry.clock_out).getTime() : Date.now();
  return (end - start) / (1000 * 60 * 60);
}

function formatTime(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

export async function exportDailyCSV(
  dailyEntries: Array<{ employee: TCEmployee; entry: TCTimeEntry; hours: number; jobName: string | null }>,
  date: Date
) {
  const Papa = (await import("papaparse")).default;

  const rows = dailyEntries.map(({ employee, entry, hours, jobName }) => ({
    "Resource #": employee.employee_number,
    "Name": `${employee.first_name} ${employee.last_name}`,
    "Job": jobName || "",
    "Clock In": formatTime(entry.clock_in),
    "Clock Out": formatTime(entry.clock_out),
    "Hours": hours.toFixed(2),
    "Notes": entry.notes || "",
  }));

  const csv = Papa.unparse(rows);
  downloadCSV(csv, `timeclock-daily-${date.toISOString().slice(0, 10)}.csv`);
}

export async function exportWeeklyCSV(
  weeklySummary: Array<{
    employee: TCEmployee;
    dailyHours: number[];
    weeklyTotal: number;
  }>,
  weekStart: Date
) {
  const Papa = (await import("papaparse")).default;
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const rows = weeklySummary.map(({ employee, dailyHours, weeklyTotal }) => {
    const row: Record<string, string> = {
      "Resource #": employee.employee_number,
      "Name": `${employee.first_name} ${employee.last_name}`,
    };
    days.forEach((day, i) => {
      row[day] = dailyHours[i] > 0 ? dailyHours[i].toFixed(2) : "-";
    });
    row["Weekly Total"] = weeklyTotal.toFixed(2);
    return row;
  });

  const csv = Papa.unparse(rows);
  downloadCSV(csv, `timeclock-weekly-${weekStart.toISOString().slice(0, 10)}.csv`);
}

export async function exportMonthlyCSV(
  monthlySummary: Array<{
    employee: TCEmployee;
    weeklyHours: number[];
    monthlyTotal: number;
  }>,
  year: number,
  month: number
) {
  const Papa = (await import("papaparse")).default;

  const rows = monthlySummary.map(({ employee, weeklyHours, monthlyTotal }) => {
    const row: Record<string, string> = {
      "Resource #": employee.employee_number,
      "Name": `${employee.first_name} ${employee.last_name}`,
    };
    weeklyHours.forEach((h, i) => {
      row[`Week ${i + 1}`] = h > 0 ? h.toFixed(2) : "-";
    });
    row["Monthly Total"] = monthlyTotal.toFixed(2);
    return row;
  });

  const csv = Papa.unparse(rows);
  const monthName = new Date(year, month).toLocaleString("default", { month: "long" }).toLowerCase();
  downloadCSV(csv, `timeclock-monthly-${monthName}-${year}.csv`);
}

export async function exportApprovedCSV(
  entries: TCTimeEntry[],
  employees: TCEmployee[],
  companies: TCCompany[],
  jobs: TCJob[],
  dateRange: { start: Date; end: Date }
) {
  const Papa = (await import("papaparse")).default;

  const approved = entries.filter((e) => {
    const ci = new Date(e.clock_in);
    return e.approval_status === "approved" && ci >= dateRange.start && ci <= dateRange.end;
  });

  const rows = approved.map((entry) => {
    const emp = employees.find((e) => e.id === entry.employee_id);
    const company = emp ? companies.find((c) => c.id === emp.company_id) : null;
    const job = entry.job_id ? jobs.find((j) => j.id === entry.job_id) : null;
    const hours = entry.clock_out
      ? (new Date(entry.clock_out).getTime() - new Date(entry.clock_in).getTime()) / (1000 * 60 * 60)
      : 0;
    const rate = emp?.billable_rate || 0;

    return {
      "Company": company?.name || "",
      "Resource #": emp?.employee_number || "",
      "Contractor Name": emp ? `${emp.first_name} ${emp.last_name}` : "",
      "Job": job?.name || "",
      "Date": new Date(entry.clock_in).toLocaleDateString(),
      "Clock In": new Date(entry.clock_in).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      "Clock Out": entry.clock_out ? new Date(entry.clock_out).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "",
      "Hours": hours.toFixed(2),
      "Billable Rate": rate.toFixed(2),
      "Total": (hours * rate).toFixed(2),
      "Approved By": entry.approved_by || "",
      "Approved At": entry.approved_at ? new Date(entry.approved_at).toLocaleString() : "",
    };
  });

  const csv = Papa.unparse(rows);
  const dateStr = dateRange.start.toISOString().slice(0, 10);
  downloadCSV(csv, `approved-time-entries-${dateStr}.csv`);
}

function downloadCSV(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
