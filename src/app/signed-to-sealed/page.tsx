import SignedToSealed from "@/components/signed-to-sealed/SignedToSealed";
import PasswordGate from "@/components/PasswordGate";

export default function SignedToSealedPage() {
  return (
    <PasswordGate>
      <SignedToSealed />
    </PasswordGate>
  );
}
