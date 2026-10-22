"use client";
import { useRouteFilter } from "@/lib/use-route-form";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import BoqTable from "@/components/BoqTable";
import type { ProjectView } from "@/lib/types";

export default function BoqPage() {
  const supabase = useMemo(() => createClient(), []);
  const [projects, setProjects] = useState<ProjectView[]>([]);
  const [selected, setSelected] = useRouteFilter("project", "all");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("projects_view").select("*").order("created_at", { ascending: false });
      setProjects((data as ProjectView[]) || []);
      if (data && data.length) setSelected(data[0].id);
    })();
  }, [supabase]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800 }}>BOQ Tracker</h1>
        <select className="input" style={{ width: 240 }} value={selected} onChange={(e) => setSelected(e.target.value)}>
          <option value="all">All projects</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {selected === "all"
        ? projects.map((p) => (
            <div key={p.id} style={{ marginBottom: 28 }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, color: "var(--t2)" }}>{p.name}</h2>
              <BoqTable projectId={p.id} />
            </div>
          ))
        : <BoqTable projectId={selected} />}
    </div>
  );
}
