import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function LoginPanel() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setErr(error.message);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel" style={{ maxWidth: 420, margin: "0 auto" }}>
      <h2 style={{ marginTop: 0, marginBottom: 8 }}>로그인</h2>
      <p style={{ fontSize: 12, opacity: 0.8, marginTop: 0, marginBottom: 16 }}>
        발행/인증 기능을 사용하려면 지점 또는 관리자 계정으로 로그인하세요.
      </p>
      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
        <label>
          이메일
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="gdxc@example.com"
            required
          />
        </label>
        <label>
          비밀번호
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호"
            required
          />
        </label>
        {err && <p style={{ color: "tomato", fontSize: 12, margin: 0 }}>{err}</p>}
        <button type="submit" disabled={busy}>
          {busy ? "로그인 중..." : "로그인"}
        </button>
      </form>
    </div>
  );
}

