import type { Metadata } from "next";
import Dashboard from "@/components/employee-portal/Dashboard";

export const metadata: Metadata = {
  title: "Dashboard | Employee Portal",
};

export default function EmployeeDashboardRoute() {
  return <Dashboard />;
}
