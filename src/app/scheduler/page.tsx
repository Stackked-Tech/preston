"use client";

import { ThemeProvider } from "@/lib/theme";
import PasswordGate from "@/components/PasswordGate";
import SchedulerDashboard from "@/components/scheduler/SchedulerDashboard";

export default function SchedulerPage() {
  return (
    <ThemeProvider>
      <PasswordGate>
        <SchedulerDashboard />
      </PasswordGate>
    </ThemeProvider>
  );
}
