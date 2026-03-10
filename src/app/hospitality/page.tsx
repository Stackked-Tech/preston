import PasswordGate from "@/components/PasswordGate";
import ManagerDashboard from "@/components/hospitality/ManagerDashboard";

export const metadata = {
  title: "Hospitality Management | WHB Command Center",
};

export default function HospitalityPage() {
  return (
    <PasswordGate>
      <ManagerDashboard />
    </PasswordGate>
  );
}
