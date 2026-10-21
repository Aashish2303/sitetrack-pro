"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ROLE_META, navForRole } from "@/lib/roles";
import type { Profile } from "@/lib/types";

export default function Shell({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notifOpen, setNotifOpen] = useState(false);
  const [openIssues, setOpenIssues] = useState(0);
  const [pendingIndents, setPendingIndents] = useState(0);
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const { data } = await supabase.from("profiles").select("*").eq("id", auth.user.id).single();
      setProfile(data as Profile);
      setLoading(false);

      const { count: issueCount } = await supabase
        .from("issues")
        .select("*", { count: "exact", head: true })
        .eq("status", "Open");
      setOpenIssues(issueCount || 0);

      const { count: indentCount } = await supabase
        .from("indents")
        .select("*", { count: "exact", head: true })
        .in("status", ["Pending Quotation", "MD Review"]);
      setPendingIndents(indentCount || 0);
    })();
  }, [supabase]);

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  if (loading || !profile) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--t3)" }}>
        Loading…
      </div>
    );
  }

  const nav = navForRole(profile.role);
  const groups = ["Main", "Site Management", "Finance & QMS"] as const;
  const meta = ROLE_META[profile.role];

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <aside
        style={{
          width: 220,
          background: "var(--s1)",
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          position: "fixed",
          left: 0,
          top: 0,
          zIndex: 100,
          borderRight: "1px solid var(--br)",
        }}
      >
        <div style={{ padding: "18px 15px 14px", borderBottom: "1px solid var(--br)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "linear-gradient(135deg,#fb923c,#f97316)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <i className="ti ti-building-skyscraper" style={{ fontSize: 20, color: "#fff" }} />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 900, letterSpacing: "-0.02em" }}>SiteTrack Pro</div>
              <div style={{ fontSize: 8, color: "var(--gr)", letterSpacing: "0.12em", fontWeight: 700 }}>
                CONSTRUCTION PLATFORM
              </div>
            </div>
          </div>
        </div>

        <nav style={{ flex: 1, padding: "8px 0", overflowY: "auto" }}>
          {groups.map((g) => {
            const items = nav.filter((n) => n.group === g);
            if (!items.length) return null;
            return (
              <div key={g}>
                <div style={{ padding: "8px 15px 4px", fontSize: 9, fontWeight: 700, color: "var(--t3)", letterSpacing: "0.12em" }}>
                  {g.toUpperCase()}
                </div>
                {items.map((n) => {
                  const active = pathname === n.href;
                  const badge = n.id === "indents" ? pendingIndents : n.id === "issues" ? openIssues : 0;
                  return (
                    <Link
                      key={n.id}
                      href={n.href}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "10px 15px",
                        background: active ? "linear-gradient(90deg,rgba(251,146,60,0.14),transparent)" : "transparent",
                        borderLeft: active ? "3px solid var(--acc)" : "3px solid transparent",
                        color: active ? "#fff" : "var(--t2)",
                        fontSize: 13,
                        fontWeight: active ? 700 : 500,
                        textDecoration: "none",
                      }}
                    >
                      <i className={"ti " + n.icon} style={{ fontSize: 15, color: active ? "var(--acc)" : "var(--t3)" }} />
                      <span style={{ flex: 1 }}>{n.label}</span>
                      {badge > 0 && (
                        <span style={{ background: "var(--rd)", color: "#fff", borderRadius: 10, padding: "1px 7px", fontSize: 10, fontWeight: 700 }}>
                          {badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>

        <div style={{ padding: 12, borderTop: "1px solid var(--br)" }}>
          <div style={{ background: "var(--s2)", borderRadius: 10, padding: "10px 12px", display: "flex", alignItems: "center", gap: 9 }}>
            <div
              style={{
                width: 33, height: 33, borderRadius: 9,
                background: meta.color + "33", display: "flex", alignItems: "center",
                justifyContent: "center", fontWeight: 800, fontSize: 12, color: meta.color,
              }}
            >
              {profile.avatar}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {profile.name}
              </div>
              <div style={{ fontSize: 9.5, color: meta.color, fontWeight: 600 }}>{meta.label}</div>
            </div>
            <button onClick={signOut} className="btn-ghost" style={{ background: "transparent", border: "1px solid var(--br)", borderRadius: 7, padding: 6, cursor: "pointer", color: "var(--t3)" }}>
              <i className="ti ti-logout" style={{ fontSize: 13 }} />
            </button>
          </div>
        </div>
      </aside>

      <main style={{ marginLeft: 220, flex: 1, display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        <header
          style={{
            background: "var(--s1)", borderBottom: "1px solid var(--br)", padding: "11px 24px",
            display: "flex", justifyContent: "space-between", alignItems: "center",
            position: "sticky", top: 0, zIndex: 50,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                display: "flex", alignItems: "center", gap: 6, background: "rgba(16,185,129,0.08)",
                border: "1px solid rgba(16,185,129,0.25)", borderRadius: 8, padding: "5px 10px",
              }}
            >
              <div className="pulse" style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--gr)" }} />
              <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--gr)" }}>LIVE</span>
            </div>
          </div>
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setNotifOpen(!notifOpen)}
              className="btn-ghost"
              style={{ borderRadius: 9, padding: "8px 13px", fontSize: 13, display: "flex", alignItems: "center", gap: 7 }}
            >
              <i className="ti ti-bell" style={{ fontSize: 15 }} />
              Notifications
              {(openIssues + pendingIndents) > 0 && (
                <span style={{ background: "var(--rd)", color: "#fff", borderRadius: 10, padding: "2px 7px", fontSize: 10, fontWeight: 700 }}>
                  {openIssues + pendingIndents}
                </span>
              )}
            </button>
            {notifOpen && (
              <div style={{ position: "absolute", right: 0, top: 46, background: "var(--s1)", border: "1px solid var(--br)", borderRadius: 12, width: 300, zIndex: 200, boxShadow: "0 16px 48px rgba(0,0,0,.5)" }}>
                <div style={{ padding: "13px 17px", borderBottom: "1px solid var(--br)", fontWeight: 700, fontSize: 13 }}>Notifications</div>
                <Link href="/indents" onClick={() => setNotifOpen(false)} style={{ display: "block", padding: "11px 17px", borderBottom: "1px solid var(--br)", color: "var(--t1)", textDecoration: "none", fontSize: 13 }}>
                  {pendingIndents} indent(s) awaiting action
                </Link>
                <Link href="/issues" onClick={() => setNotifOpen(false)} style={{ display: "block", padding: "11px 17px", color: "var(--t1)", textDecoration: "none", fontSize: 13 }}>
                  {openIssues} open issue(s)
                </Link>
              </div>
            )}
          </div>
        </header>
        <div className="fadeIn" style={{ flex: 1, padding: "22px 24px 60px" }}>
          {children}
        </div>
      </main>
    </div>
  );
}
