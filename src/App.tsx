import { useEffect, useState } from "react";
import CouponManagerPage from "./pages/CouponManagerPage";
import { supabase } from "./lib/supabase";
import LoginPanel from "./components/LoginPanel";
import "./App.css";

type Profile = {
  id: string;
  display_name: string | null;
  branch_code: string | null;
  role: string;
};

export default function App() {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      await syncUser(user);
      setInitializing(false);
    }

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      syncUser(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function syncUser(nextUser: any | null) {
    setUser(nextUser);
    if (!nextUser) {
      setProfile(null);
      return;
    }
    const { data } = await supabase.from("profiles").select("*").eq("id", nextUser.id).maybeSingle();
    setProfile((data ?? null) as Profile | null);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  const header = (
    <header className="app-header">
      <div>
        <div className="app-title">Coupon Manager</div>
        <div className="app-subtitle">지점별 발행 · QR 스캔 · 사용 인증</div>
      </div>
      {profile && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 12 }}>
          <div style={{ textAlign: "right" }}>
            <div>{profile.display_name ?? profile.branch_code ?? "사용자"}</div>
            <div style={{ opacity: 0.7 }}>
              {profile.role === "admin" ? "관리자" : `지점: ${profile.branch_code ?? "-"}`}
            </div>
          </div>
          <button type="button" onClick={handleLogout} style={{ fontSize: 12, padding: "4px 10px" }}>
            로그아웃
          </button>
        </div>
      )}
    </header>
  );

  if (initializing) {
    return (
      <div className="app-shell">
        {header}
        <main className="app-panels">
          <p>로딩 중...</p>
        </main>
      </div>
    );
  }

  if (!user || !profile) {
    return (
      <div className="app-shell">
        {header}
        <main className="app-panels">
          <LoginPanel />
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      {header}
      <main className="app-panels">
        <CouponManagerPage profile={profile} />
      </main>
    </div>
  );
}
