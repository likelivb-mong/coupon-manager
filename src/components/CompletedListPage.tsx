import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Props = { onBack: () => void };

type Row = {
  coupon_code: string;
  status: string;
  issued_branch_code: string;
  verified_branch_code: string | null;
  issued_at: string;
  verified_at: string | null;
  customer_phone: string | null;
  discount_type: string | null;
  discount_custom_text: string | null;
  headcount_type: string | null;
  headcount_custom_text: string | null;
};

const TABS = [
  { key: "ALL", label: "전체" },
  { key: "BRANCH", label: "지점별" },
] as const;

export default function CompletedListPage({ onBack }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [branchFilter, setBranchFilter] = useState<string>("ALL");
  const [tab, setTab] = useState<"ALL" | "BRANCH">("ALL");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [phoneQuery, setPhoneQuery] = useState("");
  const [showFullPhone, setShowFullPhone] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setErr(null);
      const { data, error } = await supabase
        .from("coupons")
        .select(
          "coupon_code,status,issued_branch_code,verified_branch_code,issued_at,verified_at,customer_phone,discount_type,discount_custom_text,headcount_type,headcount_custom_text"
        )
        .order("issued_at", { ascending: false })
        .limit(200);

      if (error) {
        setErr(error.message);
        setRows([]);
      } else {
        setRows((data ?? []) as Row[]);
      }
      setLoading(false);
    }

    load();
  }, []);

  const baseFiltered =
    tab === "ALL" || branchFilter === "ALL"
      ? rows
      : rows.filter((r) => r.verified_branch_code === branchFilter || r.issued_branch_code === branchFilter);

  const phoneDigits = phoneQuery.replace(/\D/g, "");

  const filtered =
    phoneDigits.length === 0
      ? baseFiltered
      : baseFiltered.filter((r) => (r.customer_phone ?? "").replace(/\D/g, "").includes(phoneDigits));

  const pageSize = 15;
  const maxPage = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice(0, page * pageSize);

  function statusLabel(status: string) {
    switch (status) {
      case "ISSUED":
        return "발행";
      case "VERIFIED":
        return "사용완료";
      case "VOID":
        return "무효";
      default:
        return status;
    }
  }

  function formatPhone(phone: string | null, full: boolean) {
    if (!phone) return "-";
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 4) return phone;
    if (full) {
      // 간단 포맷: 01012345678 -> 010-1234-5678
      if (digits.length === 11) {
        return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
      }
      if (digits.length === 10) {
        return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
      }
      return digits;
    }
    // 마스킹: 010-****-5678 형태
    if (digits.length >= 7) {
      return `${digits.slice(0, 3)}-****-${digits.slice(-4)}`;
    }
    return `${"*".repeat(Math.max(0, digits.length - 2))}${digits.slice(-2)}`;
  }

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>처리 완료 내역</h2>
        <button onClick={onBack}>← 쿠폰 발행/인증 화면으로</button>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: "6px 12px",
              borderRadius: 999,
              border: "1px solid #555",
              background: tab === t.key ? "#555" : "transparent",
              color: tab === t.key ? "#fff" : "#ddd",
              cursor: "pointer",
            }}
          >
            {t.label}
          </button>
        ))}

        {tab === "BRANCH" && (
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            style={{ marginLeft: 8, padding: "4px 8px" }}
          >
            <option value="ALL">전체 지점</option>
            <option value="GDXC">GDXC</option>
            <option value="GDXR">GDXR</option>
            <option value="NWXC">NWXC</option>
            <option value="GNXC">GNXC</option>
            <option value="SWXC">SWXC</option>
          </select>
        )}
      </div>

      <div style={{ marginBottom: 10, display: "flex", gap: 8, alignItems: "center" }}>
        <label>
          전화번호 검색&nbsp;
          <input
            value={phoneQuery}
            onChange={(e) => {
              setPage(1);
              setPhoneQuery(e.target.value);
            }}
            placeholder="숫자만 입력"
          />
        </label>
        <button
          type="button"
          onClick={() => setPage(1)}
          style={{ fontSize: 12, padding: "4px 10px" }}
        >
          검색 초기화
        </button>
        <button
          type="button"
          onClick={() => setShowFullPhone((v) => !v)}
          style={{ fontSize: 12, padding: "4px 10px", marginLeft: "auto" }}
        >
          {showFullPhone ? "전화번호 마스킹" : "전화번호 전체 보기(관리자)"}
        </button>
      </div>

      {loading && <p>불러오는 중...</p>}
      {err && <p style={{ color: "tomato" }}>{err}</p>}

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr>
            <th style={th}>쿠폰코드</th>
            <th style={th}>상태</th>
            <th style={th}>발행지점 → 인증지점</th>
            <th style={th}>발행시간 / 인증시간</th>
            <th style={th}>할인가 / 인원수</th>
            <th style={th}>전화번호</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((r) => (
            <tr key={r.coupon_code}>
              <td style={td}>{r.coupon_code}</td>
              <td style={td}>{statusLabel(r.status)}</td>
              <td style={td}>
                {r.issued_branch_code} → {r.verified_branch_code ?? "-"}
              </td>
              <td style={td}>
                <div>{r.issued_at ? new Date(r.issued_at).toLocaleString() : "-"}</div>
                <div style={{ opacity: 0.7, fontSize: 12 }}>
                  {r.verified_at ? new Date(r.verified_at).toLocaleString() : "미사용"}
                </div>
              </td>
              <td style={td}>
                <div>
                  {r.discount_type === "CUSTOM" ? r.discount_custom_text : r.discount_type ?? "-"}
                </div>
                <div style={{ opacity: 0.7, fontSize: 12 }}>
                  {r.headcount_type === "CUSTOM" ? r.headcount_custom_text : r.headcount_type ?? "-"}
                </div>
              </td>
              <td style={td}>{formatPhone(r.customer_phone, showFullPhone)}</td>
            </tr>
          ))}
          {!loading && filtered.length === 0 && (
            <tr>
              <td style={td} colSpan={6}>
                내역이 없습니다.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {maxPage > 1 && (
        <div style={{ marginTop: 12, display: "flex", gap: 6, flexWrap: "wrap" }}>
          {Array.from({ length: maxPage }).map((_, idx) => {
            const n = idx + 1;
            return (
              <button
                key={n}
                type="button"
                onClick={() => setPage(n)}
                style={{
                  padding: "4px 10px",
                  fontSize: 12,
                  background: n === page ? "#555" : "transparent",
                  border: "1px solid #555",
                }}
              >
                {n}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

const th: React.CSSProperties = {
  borderBottom: "1px solid #444",
  padding: "6px 8px",
  textAlign: "left",
  whiteSpace: "nowrap",
};

const td: React.CSSProperties = {
  borderBottom: "1px solid #333",
  padding: "6px 8px",
  whiteSpace: "nowrap",
};

