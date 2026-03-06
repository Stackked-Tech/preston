import PasswordGate from "@/components/PasswordGate";
import ParamountComms from "@/components/paramount/ParamountComms";

export const metadata = {
  title: "Paramount Communications | WHB Command Center",
};

export default function ParamountPage() {
  return (
    <PasswordGate>
      <ParamountComms />
    </PasswordGate>
  );
}
