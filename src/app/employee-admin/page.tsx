import PasswordGate from "@/components/PasswordGate";
import EmployeeAdmin from "@/components/EmployeeAdmin";

export const metadata = {
  title: "Employee Admin | WHB Command Center",
};

export default function EmployeeAdminPage() {
  return (
    <PasswordGate>
      <EmployeeAdmin />
    </PasswordGate>
  );
}
