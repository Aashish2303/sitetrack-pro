"use client";
import { today } from "@/lib/date";
import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CATEGORY_OF_WORK } from "@/lib/roles";
import type { Issue, Profile, ProjectView } from "@/lib/types";

const PRIORITIES: Issue["priority"][] = ["Low", "Medium", "High", "Critical"];
const STATUSES: Issue["status"][] = ["Open", "In Progress", "Resolved", "Closed"];

function priorityColor(p: Issue["priority"]) {
  if (p === "Critical") return "var(--rd)";
  if (p === "High") return "var(--acc)";
  if (p === "Medium") return "var(--yl)";
  return "var(--t3)";
}

export default function IssuesPage() {
  const supabase = useMemo(() => createClient(), []);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [projects, setProjects] = useState<ProjectView[]>([]);
  const [filterProject, setFilterProject] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [rows, setRows] = useState<Issue[]>([]);
  const [adding, setAdding] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    project_id: "",
    date: today(),
    title: "",
    description: "",
    category: CATEGORY_OF_WORK[0],
    priority: "Medium" as Issue["priority"],
    raised_by: "",
    assigned_to: "",
  });

  useEffect(() => { const refresh = () => { loadRows(); }; window.addEventListener("st:refresh", refresh); return () => window.removeEventListener("st:refresh", refresh); });

  async function loadProjects() {
    const { data } = await supabase.from("projects_view").select("*").order("created_at", { ascending: false });
    const list = (data as ProjectView[]) || [];
    setProjects(list);
    if (list.length && !form.project_id) setForm((f) => ({ ...f, project_id: list[0].id }));
  }

  async function loadRows() {
    let q = supabase.from("issues").select("*").order("date", { ascending: false }).order("created_at", { ascending: false });
    if (filterProject !== "all") q = q.eq("project_id", filterProject);
    if (filterStatus !== "all") q = q.eq("status", filterStatus);
    const { data } = await q;
    setRows((data as Issue[]) || []);
  }

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (auth.user) {
        const { data: p } = await supabase.from("profiles").select("*").eq("id", auth.user.id).single();
        setProfile(p as Profile);
        setForm((f) => ({ ...f, raised_by: f.raised_by || (p as Profile)?.name || "" }));
      }
      loadProjects();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterProject, filterStatus]);

  const projectName = (id: string) => projects.find((p) => p.id === id)?.name || "—";

  const counts: Record<string, number> = { Open: 0, "In Progress": 0, Resolved: 0, Closed: 0 };
  rows.forEach((r) => { counts[r.status] = (counts[r.status] || 0) + 1; });

  async function save() {
    if (!form.project_id || !form.title) return;
    let photoPath: string | null = null;
    const file = fileRef.current?.files?.[0];
    if (file) {
      setUploading(true);
      const path = `${crypto.randomUUID()}-${file.name}`;
      const { error } = await supabase.storage.from("issue-photos").upload(path, file);
      if (!error) photoPath = path;
      setUploading(false);
    }

    await supabase.from("issues").insert({
      project_id: form.project_id,
      date: form.date,
      title: form.title,
      description: form.description || null,
      category: form.category || null,
      priority: form.priority,
      raised_by: form.raised_by || profile?.name || null,
      assigned_to: form.assigned_to || null,
      status: "Open",
      photo_url: photoPath,
    });

    setForm((f) => ({ ...f, title: "", description: "", assigned_to: "" }));
    if (fileRef.current) fileRef.current.value = "";
    setAdding(false);
    loadRows();
  }

  async function updateField(id: string, field: string, value: string) {
    await supabase.from("issues").update({ [field]: value }).eq("id", id);
    loadRows();
  }

  async function viewPhoto(path: string | null) {
    if (!path) return;
    const { data } = await supabase.storage.from("issue-photos").createSignedUrl(path, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800 }}>Issues</h1>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <select className="input" style={{ width: 200 }} value={filterProject} onChange={(e) => setFilterProject(e.target.value)}>
            <option value="all">All projects</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select className="input" style={{ width: 160 }} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="all">All statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <button className="btn btn-acc" onClick={() => setAdding(!adding)}>
            <i className="ti ti-plus" /> Raise Issue
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        {STATUSES.map((s) => (
          <div key={s} className="badge" style={{ background: "var(--s2)", color: "var(--t2)", padding: "6px 12px", fontSize: 12 }}>
            {s}: <b style={{ color: "var(--t1)" }}>{counts[s] || 0}</b>
          </div>
        ))}
      </div>

      {adding && (
        <div className="card fadeIn" style={{ padding: 18, marginBottom: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10, marginBottom: 14 }}>
            <div>
              <label style={{ fontSize: 11, color: "var(--t3)" }}>Project</label>
              <select className="input" value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })}>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--t3)" }}>Date</label>
              <input className="input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--t3)" }}>Category</label>
              <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {CATEGORY_OF_WORK.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--t3)" }}>Priority</label>
              <select className="input" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as Issue["priority"] })}>
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--t3)" }}>Raised By</label>
              <input className="input" value={form.raised_by} onChange={(e) => setForm({ ...form, raised_by: e.target.value })} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--t3)" }}>Assigned To</label>
              <input className="input" value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })} />
            </div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 11, color: "var(--t3)" }}>Title</label>
            <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 11, color: "var(--t3)" }}>Description</label>
            <input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, color: "var(--t3)" }}>Photo (optional)</label>
            <input ref={fileRef} className="input" type="file" accept="image/*" />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-acc" onClick={save} disabled={uploading}>{uploading ? "Uploading..." : "Save"}</button>
            <button className="btn btn-ghost" onClick={() => setAdding(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="table-wrap card">
        <table className="dt">
          <thead>
            <tr>
              <th>Date</th><th>Project</th><th>Title</th><th>Category</th><th>Priority</th>
              <th>Raised By</th><th>Assigned To</th><th>Status</th><th>Resolution</th><th>Photo</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.date}</td>
                <td>{projectName(r.project_id)}</td>
                <td>{r.title}</td>
                <td>{r.category || "—"}</td>
                <td><span style={{ color: priorityColor(r.priority), fontWeight: 700 }}>{r.priority}</span></td>
                <td>{r.raised_by || "—"}</td>
                <td>
                  <input
                    className="input"
                    defaultValue={r.assigned_to || ""}
                    onBlur={(e) => e.target.value !== (r.assigned_to || "") && updateField(r.id, "assigned_to", e.target.value)}
                    style={{ width: 120 }}
                  />
                </td>
                <td>
                  <select className="input" style={{ width: 130 }} value={r.status} onChange={(e) => updateField(r.id, "status", e.target.value)}>
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td>
                  <input
                    className="input"
                    defaultValue={r.resolution || ""}
                    onBlur={(e) => e.target.value !== (r.resolution || "") && updateField(r.id, "resolution", e.target.value)}
                    style={{ width: 160 }}
                  />
                </td>
                <td>
                  {r.photo_url ? (
                    <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => viewPhoto(r.photo_url)}>
                      <i className="ti ti-photo" /> View
                    </button>
                  ) : "—"}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={10} style={{ textAlign: "center", color: "var(--t3)", padding: 24 }}>No entries yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
