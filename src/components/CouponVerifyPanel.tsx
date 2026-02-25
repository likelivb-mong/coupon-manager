import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { BRANCH_CODES, BRANCH_PASSWORDS, isLocallyLocked, normalizeCouponCode, setLocalLock10Min } from "../utils/couponUtils";
import type { BranchCode } from "../utils/couponUtils";

type CouponRow = {
  coupon_code: string;
  issued_branch_code: string;
  issued_at: string;
  status: string;
  verified_branch_code: string | null;
  verified_at: string | null;
  verify_attempt_count: number;
  last_verify_attempt_at: string | null;
  customer_phone?: string | null;
  discount_type?: string | null;
  discount_custom_text?: string | null;
  headcount_type?: string | null;
  headcount_custom_text?: string | null;
};

function maskPhoneInline(phone: string | null | undefined) {
  if (!phone) return "-";
  const digits = phone.replace(/\D/g, "");
  if (digits.length >= 7) {
    return `${digits.slice(0, 3)}-****-${digits.slice(-4)}`;
  }
  if (digits.length <= 2) return digits;
  return `${"*".repeat(Math.max(0, digits.length - 2))}${digits.slice(-2)}`;
}

export default function CouponVerifyPanel({
  initialCouponCode = "",
  onGoCompleted,
  canViewCompleted,
  branchFromProfile,
  role,
}: {
  initialCouponCode?: string;
  onGoCompleted?: () => void;
  canViewCompleted?: boolean;
  branchFromProfile?: string;
  role?: string;
}) {
  const [couponCode, setCouponCode] = useState(normalizeCouponCode(initialCouponCode));
  const [coupon, setCoupon] = useState<CouponRow | null>(null);
  const initialBranch: BranchCode =
    (branchFromProfile && BRANCH_CODES.includes(branchFromProfile as BranchCode)
      ? (branchFromProfile as BranchCode)
      : "GDXC");
  const [branch, setBranch] = useState<BranchCode>(initialBranch);
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [showAdminPrompt, setShowAdminPrompt] = useState(false);
  const [adminInput, setAdminInput] = useState("");

  const lock = useMemo(() => isLocallyLocked(couponCode, branch), [couponCode, branch]);
  const pwOk = useMemo(() => pw === BRANCH_PASSWORDS[branch], [pw, branch]);
  const isAdmin = role === "admin";

  useEffect(() => {
    setCouponCode(normalizeCouponCode(initialCouponCode));
  }, [initialCouponCode]);

  useEffect(() => {
    if (!couponCode) {
      setCoupon(null);
      return;
    }
    fetchCoupon();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [couponCode]);

  async function fetchCoupon() {
    setErr(null);
    setMsg(null);
    setCoupon(null);

    const code = normalizeCouponCode(couponCode);
    if (!code) return;

    const { data, error } = await supabase.from("coupons").select("*").eq("coupon_code", code).maybeSingle();

    if (error) {
      setErr(error.message);
      return;
    }
    if (!data) {
      setErr("쿠폰을 찾을 수 없습니다.");
      return;
    }
    setCoupon(data as CouponRow);
  }

  async function logEvent(eventType: string, meta: any = {}) {
    if (!couponCode) return;
    await supabase.from("coupon_events").insert({
      coupon_code: normalizeCouponCode(couponCode),
      event_type: eventType,
      branch_code: branch,
      meta,
    });
  }

  async function verify() {
    setErr(null);
    setMsg(null);

    const code = normalizeCouponCode(couponCode);
    if (!code) {
      setErr("쿠폰코드를 입력하세요.");
      return;
    }

    if (lock.locked) {
      setErr(`인증 시도 제한: ${lock.remainingSec}s 후 다시 시도`);
      return;
    }

    setBusy(true);
    try {
      const { data: current, error: readErr } = await supabase.from("coupons").select("*").eq("coupon_code", code).single();
      if (readErr) throw readErr;

      const row = current as CouponRow;

      if (row.status !== "ISSUED") {
        setErr(`이미 처리된 쿠폰입니다. (status: ${row.status})`);
        return;
      }

      if (!pwOk) {
        await supabase
          .from("coupons")
          .update({
            verify_attempt_count: (row.verify_attempt_count ?? 0) + 1,
            last_verify_attempt_at: new Date().toISOString(),
          })
          .eq("coupon_code", code);

        await logEvent("VERIFY_FAIL", { reason: "WRONG_PASSWORD" });

        const nextCount = (row.verify_attempt_count ?? 0) + 1;
        if (nextCount >= 5) setLocalLock10Min(code, branch);

        setErr("지점 비밀번호가 올바르지 않습니다.");
        return;
      }

      const { error: upErr } = await supabase
        .from("coupons")
        .update({
          status: "VERIFIED",
          verified_branch_code: branch,
          verified_at: new Date().toISOString(),
        })
        .eq("coupon_code", code)
        .eq("status", "ISSUED");

      if (upErr) throw upErr;

      await logEvent("VERIFY_SUCCESS", { verifiedBranch: branch });

      setMsg("✅ 사용 처리 완료!");
      setPw("");
      setCouponCode("");
      setCoupon(null);
    } catch (e: any) {
      setErr(e?.message ?? "인증 처리 중 오류");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel">
      <h2 style={{ margin: 0, marginBottom: 12 }}>쿠폰 인증 (Verify)</h2>

      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <label>
          쿠폰코드&nbsp;
          <input value={couponCode} onChange={(e) => setCouponCode(normalizeCouponCode(e.target.value))} placeholder="8자리 코드" />
        </label>
        <button onClick={fetchCoupon}>조회</button>
      </div>

      {coupon && (
        <div style={{ marginTop: 12, padding: 12, border: "1px solid #444", borderRadius: 12 }}>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 12, opacity: 0.8 }}>발행 지점</div>
              <div style={{ fontSize: 18, fontWeight: 800 }}>{coupon.issued_branch_code}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, opacity: 0.8 }}>발행 일시</div>
              <div style={{ fontSize: 14 }}>
                {coupon.issued_at ? new Date(coupon.issued_at).toLocaleString() : "-"}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, opacity: 0.8 }}>상태</div>
              <div style={{ fontSize: 18, fontWeight: 800 }}>
                {coupon.status === "ISSUED"
                  ? "발행"
                  : coupon.status === "VERIFIED"
                  ? "사용완료"
                  : coupon.status === "VOID"
                  ? "무효"
                  : coupon.status}
              </div>
            </div>
            {coupon.verified_branch_code && (
              <div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>인증 지점</div>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{coupon.verified_branch_code}</div>
              </div>
            )}
          </div>

          <div style={{ marginTop: 12, display: "flex", gap: 24, flexWrap: "wrap", fontSize: 14 }}>
            <div>
              <div style={{ fontSize: 11, opacity: 0.7 }}>고객 전화번호</div>
              <div>{maskPhoneInline(coupon.customer_phone)}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, opacity: 0.7 }}>할인</div>
              <div>
                {coupon.discount_type === "CUSTOM"
                  ? coupon.discount_custom_text
                  : coupon.discount_type ?? "-"}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, opacity: 0.7 }}>인원수</div>
              <div>
                {coupon.headcount_type === "CUSTOM"
                  ? coupon.headcount_custom_text
                  : coupon.headcount_type ?? "-"}
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{ marginTop: 12, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <label>
          인증 지점&nbsp;
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
          지점 비번&nbsp;
          <input
            value={pw}
            onChange={(e) => setPw(e.target.value.replace(/\D/g, "").slice(0, 5))}
            inputMode="numeric"
            placeholder="#####"
          />
        </label>

        <button disabled={busy || !coupon || coupon.status !== "ISSUED"} onClick={verify}>
          {busy ? "처리중..." : lock.locked ? `잠금(${lock.remainingSec}s)` : "사용 처리"}
        </button>
      </div>

      {msg && <p style={{ marginTop: 12, color: "lime" }}>{msg}</p>}
      {err && <p style={{ marginTop: 12, color: "tomato" }}>{err}</p>}

      {canViewCompleted && (
        <div style={{ marginTop: 16 }}>
          <button
            onClick={() => setShowAdminPrompt(true)}
            style={{ fontSize: 12, padding: "6px 10px", borderRadius: 8, border: "1px solid #555" }}
          >
            처리 완료 내역 보기 (관리자)
          </button>
        </div>
      )}

      {showAdminPrompt && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
        >
          <div style={{ background: "#222", padding: 20, borderRadius: 12, minWidth: 280 }}>
            <h3 style={{ marginTop: 0, marginBottom: 12, fontSize: 16 }}>관리자 번호 입력</h3>
            <p style={{ fontSize: 12, opacity: 0.8, marginBottom: 8 }}>관리자 번호 8자리를 입력하세요.</p>
            <input
              value={adminInput}
              onChange={(e) => setAdminInput(e.target.value.replace(/\D/g, "").slice(0, 8))}
              inputMode="numeric"
              placeholder="########"
              style={{ width: "100%", padding: "6px 8px", marginBottom: 12 }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                onClick={() => {
                  setShowAdminPrompt(false);
                  setAdminInput("");
                }}
              >
                취소
              </button>
              <button
                onClick={() => {
                  if (adminInput === "86890107") {
                    setShowAdminPrompt(false);
                    setAdminInput("");
                    onGoCompleted?.();
                  } else {
                    alert("관리자 번호가 올바르지 않습니다.");
                  }
                }}
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      <p style={{ marginTop: 12, fontSize: 12, opacity: 0.8 }}>
        발행 지점(issued_branch_code) + 인증 지점(verified_branch_code) 모두 저장됩니다.
      </p>
    </div>
  );
}
