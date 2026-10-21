"use client";
import { usePathname, useParams, useRouter } from "next/navigation";
import { useRouteForm } from "@/lib/use-route-form";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { canSeeFinance } from "@/lib/roles";
import type { Profile, ProjectView } from "@/lib/types";

type DraftBoq = { item: string; unit: string; boq_qty: string; rate: string };

export default function ProjectsPage() {
  const supabase = useMemo(() => createClient(), []);
  const routeParams = useParams<{id?:string}>(), routePath = usePathname(), router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [projects, setProjects] = useState<ProjectView[]>([]);
  const [editing,setEditing]=useState<string|null>(null);
  const [adding, setAdding] = useRouteForm("/projects");
  const [form, setForm] = useState({ name: "", location: "", client_name: "", value: "", start_date: "", end_date: "", status: "Active" });
  const [draftBoq, setDraftBoq] = useState<DraftBoq[]>([]);

  useEffect(() => { const refresh = () => { load(); }; window.addEventListener("st:refresh", refresh); return () => window.removeEventListener("st:refresh", refresh); });

  async function load() {
    const { data } = await supabase.from("projects_view").select("*").order("created_at", { ascending: false });
    setProjects((data as ProjectView[]) || []);
  }

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (auth.user) {
        const { data: p } = await supabase.from("profiles").select("*").eq("id", auth.user.id).single();
        setProfile(p as Profile);
      }
      load();
    })();
  }, [supabase]);

  useEffect(() => {
    if (!routePath.endsWith('/edit') || !routeParams.id) return;
    const p = projects.find(p => p.id === routeParams.id);
    if (!p) return;
    setEditing(p.id);
    setForm({name:p.name,location:p.location||'',client_name:p.client_name||'',value:String(p.value||0),start_date:p.start_date||'',end_date:p.end_date||'',status:p.status});
    setDraftBoq([]);
  }, [projects, routeParams.id, routePath]);

  const finance = canSeeFinance(profile?.role);

  async function createProject() {
    if (!form.name) return;
    const payload = {
        name: form.name,
        location: form.location,
        client_name: form.client_name,
        ...(finance ? {value:Number(form.value || 0)} : {}),
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        status: form.status,
      };
    const result = editing
      ? await supabase.from('projects').update(payload).eq('id',editing).select('id').single()
      : await supabase.from('projects').insert(payload).select('id').single();
    const {data,error}=result;
    if (error || !data) return;

    const rows = draftBoq
      .filter((b) => b.item && b.boq_qty)
      .map((b) => ({ project_id: data.id, item: b.item, unit: b.unit || "Nos", boq_qty: Number(b.boq_qty), rate: Number(b.rate || 0) }));
    if (rows.length) await supabase.from("boq_items").insert(rows);

    setForm({ name: "", location: "", client_name: "", value: "", start_date: "", end_date: "", status: "Active" });
    setDraftBoq([]);
    setEditing(null);
    setAdding(false);
    load();
  }

  async function setStatus(id: string, status: string) {
    await supabase.from("projects").update({ status }).eq("id", id);
    load();
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800 }}>Projects</h1>
        <button className="btn btn-acc" onClick={() => {setEditing(null);setForm({name:"",location:"",client_name:"",value:"",start_date:"",end_date:"",status:"Active"});setAdding(!adding)}}><i className="ti ti-plus" /> Add Project</button>
      </div>

      {adding && (
        <div className="card fadeIn" style={{ padding: 18, marginBottom: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10, marginBottom: 14 }}>
            <div><label style={{ fontSize: 11, color: "var(--t3)" }}>Project Name</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><label style={{ fontSize: 11, color: "var(--t3)" }}>Location</label><input className="input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
            <div><label style={{ fontSize: 11, color: "var(--t3)" }}>Client Name</label><input className="input" value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} /></div>
            {finance && <div><label style={{ fontSize: 11, color: "var(--t3)" }}>Project Value</label><input className="input" type="number" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} /></div>}
            <div><label style={{ fontSize: 11, color: "var(--t3)" }}>Start Date</label><input className="input" type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
            <div><label style={{ fontSize: 11, color: "var(--t3)" }}>Target End Date</label><input className="input" type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
            <div>
              <label style={{ fontSize: 11, color: "var(--t3)" }}>Status</label>
              <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option>Active</option><option>On Hold</option><option>Completed</option>
              </select>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <label style={{ fontSize: 12, color: "var(--t2)", fontWeight: 600 }}>Initial BOQ items (optional)</label>
            <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setDraftBoq([...draftBoq, { item: "", unit: "Cum", boq_qty: "", rate: "" }])}>+ Add row</button>
          </div>
          {draftBoq.map((b, i) => (
            <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
              <input className="input" placeholder="Item" value={b.item} onChange={(e) => { const d = [...draftBoq]; d[i].item = e.target.value; setDraftBoq(d); }} />
              <input className="input" style={{ width: 80 }} placeholder="Unit" value={b.unit} onChange={(e) => { const d = [...draftBoq]; d[i].unit = e.target.value; setDraftBoq(d); }} />
              <input className="input" style={{ width: 100 }} placeholder="Qty" type="number" value={b.boq_qty} onChange={(e) => { const d = [...draftBoq]; d[i].boq_qty = e.target.value; setDraftBoq(d); }} />
              {finance && <input className="input" style={{ width: 100 }} placeholder="Rate" type="number" value={b.rate} onChange={(e) => { const d = [...draftBoq]; d[i].rate = e.target.value; setDraftBoq(d); }} />}
              <button className="btn btn-ghost" onClick={() => setDraftBoq(draftBoq.filter((_, j) => j !== i))}><i className="ti ti-trash" /></button>
            </div>
          ))}

          <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
            <button className="btn btn-acc" onClick={createProject}>{editing?"Save project":"Create Project"}</button>
            <button className="btn btn-ghost" onClick={() => setAdding(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 14 }}>
        {projects.map((p) => (
          <div key={p.id} className="card" style={{ padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <Link href={`/projects/${p.id}`} style={{ fontWeight: 700, color: "var(--t1)", textDecoration: "none" }}>{p.name}</Link>
              <select className="input" style={{ width: "auto", padding: "2px 8px", fontSize: 11 }} value={p.status} onChange={(e) => setStatus(p.id, e.target.value)}>
                <option>Active</option><option>On Hold</option><option>Completed</option>
              </select>
            </div>
            <div style={{ fontSize: 12, color: "var(--t3)", marginBottom: 2 }}>{p.client_name} · {p.location}</div>
            {finance && <div style={{ fontSize: 12, color: "var(--t2)", marginBottom: 10 }}>Value: ₹{Number(p.value || 0).toLocaleString("en-IN")}</div>}
            <div style={{ background: "var(--s2)", borderRadius: 6, height: 8, overflow: "hidden" }}>
              <div style={{ width: `${p.progress_pct}%`, height: "100%", background: p.progress_pct >= 80 ? "var(--gr)" : p.progress_pct >= 50 ? "var(--yl)" : "var(--rd)" }} />
            </div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:12}}><span style={{fontSize:11,color:'var(--t3)'}}>{p.progress_pct}% complete</span><button className="btn btn-ghost" onClick={()=>{setEditing(p.id);setForm({name:p.name,location:p.location||'',client_name:p.client_name||'',value:String(p.value||0),start_date:p.start_date||'',end_date:p.end_date||'',status:p.status});setDraftBoq([]);router.push(`/projects/${p.id}/edit`);window.scrollTo({top:0,behavior:'smooth'})}}>Edit project</button></div>
          </div>
        ))}
        {projects.length === 0 && <div style={{ color: "var(--t3)" }}>No projects yet — add your first one.</div>}
      </div>
    </div>
  );
}
