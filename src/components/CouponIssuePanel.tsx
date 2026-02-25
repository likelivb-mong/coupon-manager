import { useMemo, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { supabase } from "../lib/supabase";
import { BRANCH_CODES, BRANCH_PASSWORDS, generateCouponCode8 } from "../utils/couponUtils";
import type { BranchCode } from "../utils/couponUtils";

type CouponRow = {
  coupon_code: string;
  issued_branch_code: string;
  issued_at: string;
  status: string;
  customer_phone?: string | null;
  discount_type?: string | null;
  discount_custom_text?: string | null;
  headcount_type?: string | null;
  headcount_custom_text?: string | null;
};

export default function CouponIssuePanel({
  branchFromProfile,
  role,
}: {
  branchFromProfile?: string;
  role?: string;
}) {
  const initialBranch: BranchCode =
    (branchFromProfile && BRANCH_CODES.includes(branchFromProfile as BranchCode)
      ? (branchFromProfile as BranchCode)
      : "GDXC");
  const [branch, setBranch] = useState<BranchCode>(initialBranch);
  const [pw, setPw] = useState("");
  const [phone, setPhone] = useState("");
  const [discountType, setDiscountType] = useState<string>("");
  const [discountCustom, setDiscountCustom] = useState("");
  const [headcountType, setHeadcountType] = useState<string>("");
  const [headcountCustom, setHeadcountCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<CouponRow | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const pwOk = useMemo(() => pw === BRANCH_PASSWORDS[branch], [pw, branch]);
  const isAdmin = role === "admin";

  async function logEvent(couponCode: string, eventType: string, meta: any = {}) {
    await supabase.from("coupon_events").insert({
      coupon_code: couponCode,
      event_type: eventType,
      branch_code: branch,
      meta,
    });
  }

  async function createCoupon() {
    setErr(null);
    setCreated(null);

    if (!pwOk) {
      setErr("지점 비밀번호가 올바르지 않습니다.");
      return;
    }

    const normalizedPhone = phone.replace(/\D/g, "");
    if (!normalizedPhone) {
      setErr("고객 전화번호를 입력하세요.");
      return;
    }

    if (!discountType) {
      setErr("할인 종류를 선택하세요.");
      return;
    }

    if (discountType === "CUSTOM" && !discountCustom.trim()) {
      setErr("기타 할인 내용을 입력하세요.");
      return;
    }

    if (!headcountType) {
      setErr("인원수를 선택하세요.");
      return;
    }

    if (headcountType === "CUSTOM" && !headcountCustom.trim()) {
      setErr("기타 인원수 내용을 입력하세요.");
      return;
    }

    setBusy(true);
    try {
      let lastError: any = null;

      for (let attempt = 0; attempt < 3; attempt++) {
        const code = generateCouponCode8();
        const { data, error } = await supabase
          .from("coupons")
          .insert({
            coupon_code: code,
            customer_phone: normalizedPhone,
            discount_type: discountType,
            discount_custom_text: discountType === "CUSTOM" ? discountCustom.trim() : null,
            headcount_type: headcountType,
            headcount_custom_text: headcountType === "CUSTOM" ? headcountCustom.trim() : null,
            issued_branch_code: branch,
            status: "ISSUED",
          })
          .select(
            "coupon_code,issued_branch_code,issued_at,status,customer_phone,discount_type,discount_custom_text,headcount_type,headcount_custom_text"
          )
          .single();

        if (!error && data) {
          setCreated(data as CouponRow);
          await logEvent(code, "ISSUE", { issuedBranch: branch });
          lastError = null;
          break;
        }
        lastError = error;
      }

      if (lastError) throw lastError;
    } catch (e: any) {
      setErr(e?.message ?? "쿠폰 생성 중 오류");
    } finally {
      setBusy(false);
      setPw("");
    }
  }

  function copyCode() {
    if (!created) return;
    navigator.clipboard.writeText(created.coupon_code);
  }

  return (
    <div className="panel">
      <h2 style={{ margin: 0, marginBottom: 12 }}>쿠폰 발행 (Issue)</h2>

      <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
        <label>
          지점코드&nbsp;
          <select
            value={branch}
            onChange={isAdmin ? (e) => setBranch(e.target.value as BranchCode) : undefined}
            disabled={!isAdmin}
          >
            {BRANCH_CODES.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </label>

        <label>
          지점 비번(5자리)&nbsp;
          <input
            value={pw}
            onChange={(e) => setPw(e.target.value.replace(/\D/g, "").slice(0, 5))}
            inputMode="numeric"
            placeholder="#####"
          />
        </label>

        <label>
          고객 전화번호&nbsp;
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="tel"
            placeholder="010-1234-5678"
          />
        </label>

        <label>
          할인가&nbsp;
          <select value={discountType} onChange={(e) => setDiscountType(e.target.value)}>
            <option value="">선택</option>
            <option value="-2000">2,000원</option>
            <option value="-3000">3,000원</option>
            <option value="-5000">5,000원</option>
            <option value="-10000">10,000원</option>
            <option value="FREE">무료 입장</option>
            <option value="CUSTOM">기타(직접 입력)</option>
          </select>
        </label>

        {discountType === "CUSTOM" && (
          <input
            style={{ minWidth: 160 }}
            value={discountCustom}
            onChange={(e) => setDiscountCustom(e.target.value)}
            placeholder="예: 굿즈 증정, 30% 할인"
          />
        )}

        <label>
          인원수&nbsp;
          <select value={headcountType} onChange={(e) => setHeadcountType(e.target.value)}>
            <option value="">선택</option>
            <option value="1">1인</option>
            <option value="2">2인</option>
            <option value="3">3인</option>
            <option value="4">4인</option>
            <option value="5">5인</option>
            <option value="6">6인</option>
            <option value="TEAM_ALL">팀 전체</option>
            <option value="CUSTOM">기타(직접 입력)</option>
          </select>
        </label>

        {headcountType === "CUSTOM" && (
          <input
            style={{ minWidth: 160 }}
            value={headcountCustom}
            onChange={(e) => setHeadcountCustom(e.target.value)}
            placeholder="예: 최대 8인, 가족 단위"
          />
        )}

        <button disabled={busy} onClick={createCoupon}>
          {busy ? "생성중..." : "쿠폰 생성"}
        </button>
      </div>

      {err && <p style={{ marginTop: 12, color: "tomato" }}>{err}</p>}

      {created && (
        <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
          <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 12, opacity: 0.8 }}>발행 지점</div>
              <div style={{ fontSize: 18, fontWeight: 800 }}>{created.issued_branch_code}</div>
            </div>

            <div>
              <div style={{ fontSize: 12, opacity: 0.8 }}>쿠폰 코드</div>
              <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: 2 }}>{created.coupon_code}</div>
            </div>

            <button onClick={copyCode}>코드 복사</button>
          </div>

          <div style={{ display: "flex", gap: 24, flexWrap: "wrap", fontSize: 14 }}>
            <div>
              <div style={{ fontSize: 11, opacity: 0.7 }}>고객 전화번호</div>
              <div>{created.customer_phone ?? "-"}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, opacity: 0.7 }}>할인</div>
              <div>
                {created.discount_type === "CUSTOM"
                  ? created.discount_custom_text
                  : created.discount_type ?? "-"}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, opacity: 0.7 }}>인원수</div>
              <div>
                {created.headcount_type === "CUSTOM"
                  ? created.headcount_custom_text
                  : created.headcount_type ?? "-"}
              </div>
            </div>
          </div>

          <div style={{ padding: 12, border: "1px solid #444", borderRadius: 12, width: "fit-content" }}>
            <QRCodeCanvas value={created.coupon_code} size={180} />
            <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>QR 스캔하면 코드 자동입력</div>
          </div>
        </div>
      )}
    </div>
  );
}
