import type { Metadata } from "next";
import LoginPage from "@/components/employee-portal/LoginPage";

export const metadata: Metadata = {
  title: "Employee Portal | WHB Companies",
};

export default function EmployeeLoginRoute() {
  return <LoginPage />;
}
