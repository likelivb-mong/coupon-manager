import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type SmsTemplate = {
  id: string;
  name: string;
  type: string;
  content: string;
  is_default: boolean;
  updated_at: string;
};

const PLACEHOLDERS = [
  "{{couponCode}}",
  "{{discountLabel}}",
  "{{headcountLabel}}",
  "{{issuedBranch}}",
  "{{customerPhone}}",
  "{{verifiedBranch}}",
  "{{verifiedAt}}",
];

export default function SmsTemplatesPage({ onBack }: { onBack: () => void }) {
  const [list, setList] = useState<SmsTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<"issue" | "verify">("issue");
  const [newContent, setNewContent] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setErr(null);
    const { data, error } = await supabase
      .from("sms_templates")
      .select("id, name, type, content, is_default, updated_at")
      .order("type")
      .order("is_default", { ascending: false });
    if (error) {
      setErr(error.message);
      setList([]);
    } else {
      setList((data ?? []) as SmsTemplate[]);
    }
    setLoading(false);
  }

  async function setDefault(id: string, type: string) {
    setSaving(true);
    setErr(null);
    try {
      await supabase.from("sms_templates").update({ is_default: false }).eq("type", type);
      await supabase.from("sms_templates").update({ is_default: true, updated_at: new Date().toISOString() }).eq("id", id);
      await load();
    } catch (e: any) {
      setErr(e?.message ?? "저장 실패");
    }
    setSaving(false);
  }

  async function saveContent() {
    if (!editingId) return;
    setSaving(true);
    setErr(null);
    try {
      await supabase.from("sms_templates").update({ content: editContent, updated_at: new Date().toISOString() }).eq("id", editingId);
      setEditingId(null);
      await load();
    } catch (e: any) {
      setErr(e?.message ?? "저장 실패");
    }
    setSaving(false);
  }

  async function addTemplate() {
    if (!newName.trim() || !newContent.trim()) return;
    setAdding(true);
    setErr(null);
    try {
      await supabase.from("sms_templates").insert({
        name: newName.trim(),
        type: newType,
        content: newContent.trim(),
        is_default: list.filter((t) => t.type === newType).length === 0,
      });
      setNewName("");
      setNewContent("");
      await load();
    } catch (e: any) {
      setErr(e?.message ?? "추가 실패");
    }
    setAdding(false);
  }

  const issueTemplates = list.filter((t) => t.type === "issue");
  const verifyTemplates = list.filter((t) => t.type === "verify");

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>SMS 템플릿 설정</h2>
        <button type="button" onClick={onBack}>
          ← 쿠폰 관리로
        </button>
      </div>

      <p style={{ fontSize: 12, opacity: 0.8, marginBottom: 16 }}>
        발행/사용완료 시 고객에게 보낼 문자 내용을 수정할 수 있습니다. 사용할 템플릿은 타입별로 하나씩 "기본으로 사용"으로 지정하세요.
      </p>

      <div style={{ marginBottom: 8, fontSize: 11, opacity: 0.8 }}>
        치환문구: {PLACEHOLDERS.join(", ")}
      </div>

      {loading && <p>불러오는 중...</p>}
      {err && <p style={{ color: "tomato" }}>{err}</p>}

      <div style={{ display: "grid", gap: 24 }}>
        <section>
          <h3 style={{ marginBottom: 8 }}>발행 안내 (issue)</h3>
          {issueTemplates.map((t) => (
            <div
              key={t.id}
              style={{
                border: "1px solid #444",
                borderRadius: 12,
                padding: 12,
                marginBottom: 8,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                <strong>{t.name}</strong>
                <span style={{ fontSize: 12 }}>
                  {t.is_default ? (
                    <span style={{ color: "var(--color-success, #34c759)" }}>기본 사용 중</span>
                  ) : (
                    <button type="button" disabled={saving} onClick={() => setDefault(t.id, t.type)} style={{ fontSize: 12 }}>
                      기본으로 사용
                    </button>
                  )}
                </span>
              </div>
              {editingId === t.id ? (
                <div style={{ marginTop: 8 }}>
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={5}
                    style={{ width: "100%", padding: 8, fontSize: 13 }}
                  />
                  <div style={{ marginTop: 8 }}>
                    <button type="button" onClick={saveContent} disabled={saving}>
                      저장
                    </button>
                    <button type="button" onClick={() => { setEditingId(null); setEditContent(""); }} style={{ marginLeft: 8 }}>
                      취소
                    </button>
                  </div>
                </div>
              ) : (
                <pre style={{ marginTop: 8, whiteSpace: "pre-wrap", fontSize: 12, opacity: 0.9 }}>{t.content}</pre>
              )}
              {editingId !== t.id && (
                <button type="button" onClick={() => { setEditingId(t.id); setEditContent(t.content); }} style={{ marginTop: 4, fontSize: 12 }}>
                  수정
                </button>
              )}
            </div>
          ))}
        </section>

        <section>
          <h3 style={{ marginBottom: 8 }}>사용 완료 안내 (verify)</h3>
          {verifyTemplates.map((t) => (
            <div
              key={t.id}
              style={{
                border: "1px solid #444",
                borderRadius: 12,
                padding: 12,
                marginBottom: 8,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                <strong>{t.name}</strong>
                <span style={{ fontSize: 12 }}>
                  {t.is_default ? (
                    <span style={{ color: "var(--color-success, #34c759)" }}>기본 사용 중</span>
                  ) : (
                    <button type="button" disabled={saving} onClick={() => setDefault(t.id, t.type)} style={{ fontSize: 12 }}>
                      기본으로 사용
                    </button>
                  )}
                </span>
              </div>
              {editingId === t.id ? (
                <div style={{ marginTop: 8 }}>
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={5}
                    style={{ width: "100%", padding: 8, fontSize: 13 }}
                  />
                  <div style={{ marginTop: 8 }}>
                    <button type="button" onClick={saveContent} disabled={saving}>
                      저장
                    </button>
                    <button type="button" onClick={() => { setEditingId(null); setEditContent(""); }} style={{ marginLeft: 8 }}>
                      취소
                    </button>
                  </div>
                </div>
              ) : (
                <pre style={{ marginTop: 8, whiteSpace: "pre-wrap", fontSize: 12, opacity: 0.9 }}>{t.content}</pre>
              )}
              {editingId !== t.id && (
                <button type="button" onClick={() => { setEditingId(t.id); setEditContent(t.content); }} style={{ marginTop: 4, fontSize: 12 }}>
                  수정
                </button>
              )}
            </div>
          ))}
        </section>

        <section>
          <h3 style={{ marginBottom: 8 }}>새 템플릿 추가</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 480 }}>
            <label>
              이름
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="예: 발행 안내 (이벤트용)" style={{ marginLeft: 8, width: 280 }} />
            </label>
            <label>
              타입
              <select value={newType} onChange={(e) => setNewType(e.target.value as "issue" | "verify")} style={{ marginLeft: 8 }}>
                <option value="issue">발행 안내 (issue)</option>
                <option value="verify">사용 완료 안내 (verify)</option>
              </select>
            </label>
            <label>
              내용 (치환문구 사용 가능)
              <textarea value={newContent} onChange={(e) => setNewContent(e.target.value)} rows={4} style={{ display: "block", marginTop: 4, width: "100%", padding: 8 }} placeholder="[쿠폰] 코드: {{couponCode}} ..." />
            </label>
            <button type="button" onClick={addTemplate} disabled={adding || !newName.trim() || !newContent.trim()}>
              {adding ? "추가 중..." : "추가"}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
