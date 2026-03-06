import type { Metadata } from "next";
import OnboardingPage from "@/components/employee-portal/OnboardingPage";

export const metadata: Metadata = {
  title: "Welcome | Employee Portal",
};

export default function EmployeeOnboardingRoute() {
  return <OnboardingPage />;
}
