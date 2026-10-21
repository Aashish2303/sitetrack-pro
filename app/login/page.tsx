"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ROLE_META } from "@/lib/roles";

const DEMO_LOGINS = [
  { username: "md", role: "md" as const },
  { username: "engineer1", role: "engineer" as const },
  { username: "engineer2", role: "engineer" as const },
  { username: "sales", role: "sales" as const },
  { username: "qms", role: "qms" as const },
  { username: "accounts", role: "accounts" as const },
  { username: "admin", role: "admin" as const },
];

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function doLogin(u: string, p: string) {
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: `${u.trim().toLowerCase()}@sitetrack.local`,
      password: p,
    });
    setLoading(false);
    if (error) {
      setError("Invalid username or password.");
      return;
    }
    router.push("/today");
    router.refresh();
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "radial-gradient(circle at 20% 20%, rgba(251,146,60,0.08), transparent 50%), var(--bg)",
      }}
    >
      <div className="card fadeIn" style={{ width: 400, padding: 30 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: "linear-gradient(135deg,#fb923c,#f97316)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <i className="ti ti-building-skyscraper" style={{ fontSize: 22, color: "#fff" }} />
          </div>
          <div>
            <div style={{ fontSize: 19, fontWeight: 900 }}>SiteTrack Pro</div>
            <div style={{ fontSize: 9, color: "var(--gr)", letterSpacing: ".12em", fontWeight: 700 }}>
              CONSTRUCTION PLATFORM
            </div>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            doLogin(username, password);
          }}
        >
          <label style={{ fontSize: 12, color: "var(--t2)" }}>Username</label>
          <input
            className="input"
            style={{ marginTop: 6, marginBottom: 14 }}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g. md"
            autoFocus
          />
          <label style={{ fontSize: 12, color: "var(--t2)" }}>Password</label>
          <input
            className="input"
            style={{ marginTop: 6, marginBottom: 14 }}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && (
            <div style={{ color: "var(--rd)", fontSize: 12, marginBottom: 12 }}>{error}</div>
          )}
          <button className="btn btn-acc" style={{ width: "100%" }} disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div style={{ marginTop: 22, borderTop: "1px solid var(--br)", paddingTop: 16 }}>
          <div style={{ fontSize: 10.5, color: "var(--t3)", marginBottom: 8, letterSpacing: ".08em" }}>
            DEMO LOGINS (click to use)
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {DEMO_LOGINS.map((u) => (
              <button
                key={u.username}
                type="button"
                className="btn btn-ghost"
                style={{ fontSize: 11, textAlign: "left", display: "flex", alignItems: "center", gap: 6 }}
                onClick={() => setUsername(u.username)}
              >
                <i className={"ti " + ROLE_META[u.role].icon} style={{ color: ROLE_META[u.role].color }} />
                {u.username}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 10, color: "var(--t3)", marginTop: 8 }}>
            Passwords: md123 / eng123 / eng456 / sales123 / qms123 / acct123 / admin123
          </div>
        </div>
      </div>
    </div>
  );
}
