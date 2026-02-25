import PasswordGate from "@/components/PasswordGate";
import PayoutSuite from "@/components/PayoutSuite";

export const metadata = {
  title: "Payout Suite | WHB Command Center",
};

export default function PayoutSuitePage() {
  return (
    <PasswordGate>
      <PayoutSuite />
    </PasswordGate>
  );
}
