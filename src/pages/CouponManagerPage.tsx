import { useState } from "react";
import CouponIssuePanel from "../components/CouponIssuePanel";
import CouponScanPanel from "../components/CouponScanPanel";
import CouponVerifyPanel from "../components/CouponVerifyPanel";
import CompletedListPage from "../components/CompletedListPage";

type View = "manager" | "completed";

type Profile = {
  id: string;
  display_name: string | null;
  branch_code: string | null;
  role: string;
};

export default function CouponManagerPage({ profile }: { profile: Profile }) {
  const [scanned, setScanned] = useState<string>("");
  const [view, setView] = useState<View>("manager");

  if (view === "completed") {
    return <CompletedListPage onBack={() => setView("manager")} />;
  }

  return (
    <div style={{ display: "grid", gap: 16, padding: 16 }}>
      <CouponIssuePanel branchFromProfile={profile.branch_code ?? undefined} role={profile.role} />
      <CouponScanPanel onScanned={(code) => setScanned(code)} />
      <CouponVerifyPanel
        initialCouponCode={scanned}
        onGoCompleted={profile.role === "admin" ? () => setView("completed") : undefined}
        canViewCompleted={profile.role === "admin"}
        branchFromProfile={profile.branch_code ?? undefined}
        role={profile.role}
      />
    </div>
  );
}
