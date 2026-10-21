"use client";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { canSeeFinance } from "@/lib/roles";
import BoqTable from "@/components/BoqTable";
import type { Profile, ProjectView } from "@/lib/types";

export default function ProjectDetail({ params }: { params: { id: string } }) {
  const supabase = useMemo(() => createClient(), []);
  const [project, setProject] = useState<ProjectView | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (auth.user) {
        const { data: p } = await supabase.from("profiles").select("*").eq("id", auth.user.id).single();
        setProfile(p as Profile);
      }
      const { data } = await supabase.from("projects_view").select("*").eq("id", params.id).single();
      setProject(data as ProjectView);
    })();
  }, [supabase, params.id]);

  if (!project) return null;
  const finance = canSeeFinance(profile?.role);

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>{project.name}</h1>
      <p style={{ color: "var(--t3)", fontSize: 13, marginBottom: 18 }}>
        {project.client_name} · {project.location} · {project.status}
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 14, marginBottom: 24 }}>
        <div className="card" style={{ padding: 14 }}><div style={{ fontSize: 11, color: "var(--t3)" }}>PROGRESS</div><div style={{ fontSize: 22, fontWeight: 800 }}>{project.progress_pct}%</div></div>
        {finance && <div className="card" style={{ padding: 14 }}><div style={{ fontSize: 11, color: "var(--t3)" }}>PROJECT VALUE</div><div style={{ fontSize: 22, fontWeight: 800 }}>₹{Number(project.value || 0).toLocaleString("en-IN")}</div></div>}
        <div className="card" style={{ padding: 14 }}><div style={{ fontSize: 11, color: "var(--t3)" }}>START</div><div style={{ fontSize: 15, fontWeight: 700 }}>{project.start_date || "—"}</div></div>
        <div className="card" style={{ padding: 14 }}><div style={{ fontSize: 11, color: "var(--t3)" }}>TARGET END</div><div style={{ fontSize: 15, fontWeight: 700 }}>{project.end_date || "—"}</div></div>
      </div>

      <BoqTable projectId={project.id} />
    </div>
  );
}
