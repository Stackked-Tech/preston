import PasswordGate from "@/components/PasswordGate";
import HospitalityAdmin from "@/components/hospitality/HospitalityAdmin";

export const metadata = {
  title: "Hospitality Admin | WHB Command Center",
};

export default function HospitalityAdminPage() {
  return (
    <PasswordGate>
      <HospitalityAdmin />
    </PasswordGate>
  );
}
