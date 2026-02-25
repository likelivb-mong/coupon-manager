import { useState } from "react";
import CouponIssuePanel from "../components/CouponIssuePanel";
import CouponScanPanel from "../components/CouponScanPanel";
import CouponVerifyPanel from "../components/CouponVerifyPanel";
import CompletedListPage from "../components/CompletedListPage";
import SmsTemplatesPage from "../components/SmsTemplatesPage";

type View = "manager" | "completed" | "smsTemplates";

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
  if (view === "smsTemplates") {
    return <SmsTemplatesPage onBack={() => setView("manager")} />;
  }

  return (
    <div style={{ display: "grid", gap: 16, padding: 16 }}>
      {profile.role === "admin" && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setView("completed")}
            style={{ fontSize: 12, padding: "6px 10px", borderRadius: 8, border: "1px solid #555" }}
          >
            처리 완료 내역 보기
          </button>
          <button
            type="button"
            onClick={() => setView("smsTemplates")}
            style={{ fontSize: 12, padding: "6px 10px", borderRadius: 8, border: "1px solid #555" }}
          >
            SMS 템플릿 설정
          </button>
        </div>
      )}
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
