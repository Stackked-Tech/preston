import type { TCEmployee, TCTimeEntry } from "@/types/timeclock";

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
  dailyEntries: Array<{ employee: TCEmployee; entry: TCTimeEntry; hours: number }>,
  date: Date
) {
  const Papa = (await import("papaparse")).default;

  const rows = dailyEntries.map(({ employee, entry, hours }) => ({
    "Employee #": employee.employee_number,
    "Name": `${employee.first_name} ${employee.last_name}`,
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
      "Employee #": employee.employee_number,
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
      "Employee #": employee.employee_number,
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

function downloadCSV(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
