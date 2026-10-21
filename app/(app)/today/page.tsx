"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { canSeeFinance } from "@/lib/roles";
import type { Profile, ProjectView } from "@/lib/types";

function fmtMoney(n: number | null | undefined) {
  if (n == null) return "—";
  return "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

export default function TodayPage() {
  const supabase = useMemo(() => createClient(), []);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [projects, setProjects] = useState<ProjectView[]>([]);
  const [stats, setStats] = useState({ labourToday: 0, pendingIndents: 0, openIssues: 0, boqValue: 0, doneValue: 0 });

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const { data: p } = await supabase.from("profiles").select("*").eq("id", auth.user.id).single();
      setProfile(p as Profile);

      const { data: proj } = await supabase.from("projects_view").select("*").order("created_at", { ascending: false });
      setProjects((proj as ProjectView[]) || []);

      const today = new Date().toISOString().slice(0, 10);
      const { data: labour } = await supabase.from("labour_entries").select("id").eq("date", today);
      const { count: pendingIndents } = await supabase
        .from("indents").select("*", { count: "exact", head: true }).in("status", ["Pending Quotation", "MD Review"]);
      const { count: openIssues } = await supabase
        .from("issues").select("*", { count: "exact", head: true }).eq("status", "Open");
      const { data: boqRows } = await supabase.from("boq_items_view").select("boq_value, done_value");
      const boqValue = (boqRows || []).reduce((s, r: any) => s + (r.boq_value || 0), 0);
      const doneValue = (boqRows || []).reduce((s, r: any) => s + (r.done_value || 0), 0);

      setStats({
        labourToday: labour?.length || 0,
        pendingIndents: pendingIndents || 0,
        openIssues: openIssues || 0,
        boqValue,
        doneValue,
      });
    })();
  }, [supabase]);

  if (!profile) return null;
  const finance = canSeeFinance(profile.role);
  const activeProjects = projects.filter((p) => p.status === "Active");

  const cards = [
    { label: "Active Projects", value: activeProjects.length, icon: "ti-building-skyscraper", color: "var(--bl)" },
    { label: "Labour Today", value: stats.labourToday, icon: "ti-users", color: "var(--pu)" },
    { label: "Pending Indents", value: stats.pendingIndents, icon: "ti-package", color: "var(--acc)" },
    { label: "Open Issues", value: stats.openIssues, icon: "ti-alert-triangle", color: "var(--rd)" },
  ];
  if (finance) {
    cards.push({ label: "BOQ Value", value: fmtMoney(stats.boqValue) as any, icon: "ti-report-money", color: "var(--gr)" });
    cards.push({ label: "Done Value", value: fmtMoney(stats.doneValue) as any, icon: "ti-check", color: "var(--yl)" });
  }

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>
        {(() => {
          const h = new Date().getHours();
          return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
        })()}, {profile.name.split(" ")[0]}
      </h1>
      <p style={{ color: "var(--t3)", fontSize: 13, marginBottom: 22 }}>
        {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 14, marginBottom: 26 }}>
        {cards.map((c) => (
          <div key={c.label} className="card" style={{ padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <i className={"ti " + c.icon} style={{ color: c.color, fontSize: 18 }} />
              <span style={{ fontSize: 11, color: "var(--t3)", fontWeight: 700 }}>{c.label.toUpperCase()}</span>
            </div>
            <div style={{ fontSize: 24, fontWeight: 800 }}>{c.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700 }}>Active Projects</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/materials" className="btn btn-ghost" style={{ textDecoration: "none", fontSize: 12 }}>Materials</Link>
          <Link href="/indents" className="btn btn-ghost" style={{ textDecoration: "none", fontSize: 12 }}>Indents</Link>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 14 }}>
        {activeProjects.length === 0 && <div style={{ color: "var(--t3)", fontSize: 13 }}>No active projects yet.</div>}
        {activeProjects.map((p) => (
          <Link key={p.id} href={`/projects/${p.id}`} className="card" style={{ padding: 16, textDecoration: "none", color: "var(--t1)" }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>{p.name}</div>
            <div style={{ fontSize: 12, color: "var(--t3)", marginBottom: 10 }}>{p.location}</div>
            <div style={{ background: "var(--s2)", borderRadius: 6, height: 8, overflow: "hidden" }}>
              <div style={{ width: `${p.progress_pct}%`, height: "100%", background: p.progress_pct >= 80 ? "var(--gr)" : p.progress_pct >= 50 ? "var(--yl)" : "var(--rd)" }} />
            </div>
            <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 6 }}>{p.progress_pct}% complete</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
