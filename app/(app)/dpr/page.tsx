"use client";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CATEGORY_OF_WORK } from "@/lib/roles";
import type { BoqItemView, DprEntry, Profile, ProjectView, WorkStatus } from "@/lib/types";

const WORK_STATUSES: WorkStatus[] = ["Completed", "Partial", "Delayed - Carry Forward", "Cancelled", "Not Started"];
const CAN_ADD_ROLES = ["engineer", "qms", "admin"];

export default function DprPage() {
  const supabase = useMemo(() => createClient(), []);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [projects, setProjects] = useState<ProjectView[]>([]);
  const [filterProject, setFilterProject] = useState<string>("all");
  const [filterDate, setFilterDate] = useState<string>("");
  const [rows, setRows] = useState<DprEntry[]>([]);
  const [boqItems, setBoqItems] = useState<BoqItemView[]>([]);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    project_id: "",
    boq_item_id: "",
    date: new Date().toISOString().slice(0, 10),
    description: "",
    location_block: "",
    category: CATEGORY_OF_WORK[0],
    pct_done: "",
    qty_done: "",
    subcontractor: "",
    engineer: "",
    site_incharge: "",
    work_status: "Completed" as WorkStatus,
    reason: "",
  });

  async function loadProjects() {
    const { data } = await supabase.from("projects_view").select("*").order("created_at", { ascending: false });
    const list = (data as ProjectView[]) || [];
    setProjects(list);
    if (list.length && !form.project_id) setForm((f) => ({ ...f, project_id: list[0].id }));
  }

  async function loadRows() {
    let q = supabase.from("dpr_entries").select("*").order("date", { ascending: false }).order("created_at", { ascending: false });
    if (filterProject !== "all") q = q.eq("project_id", filterProject);
    if (filterDate) q = q.eq("date", filterDate);
    const { data } = await q;
    setRows((data as DprEntry[]) || []);
  }

  async function loadBoqItems(projectId: string) {
    if (!projectId) { setBoqItems([]); return; }
    const { data } = await supabase.from("boq_items_view").select("*").eq("project_id", projectId);
    setBoqItems((data as BoqItemView[]) || []);
  }

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (auth.user) {
        const { data: p } = await supabase.from("profiles").select("*").eq("id", auth.user.id).single();
        setProfile(p as Profile);
      }
      loadProjects();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterProject, filterDate]);

  useEffect(() => {
    loadBoqItems(form.project_id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.project_id]);

  const canAdd = !!profile && CAN_ADD_ROLES.includes(profile.role);
  const projectName = (id: string) => projects.find((p) => p.id === id)?.name || "—";

  async function save() {
    if (!form.project_id || !form.description) return;
    const carry_forward = form.work_status === "Delayed - Carry Forward";
    await supabase.from("dpr_entries").insert({
      project_id: form.project_id,
      boq_item_id: form.boq_item_id || null,
      date: form.date,
      description: form.description,
      location_block: form.location_block || null,
      category: form.category,
      pct_done: form.pct_done ? Number(form.pct_done) : null,
      qty_done: form.qty_done ? Number(form.qty_done) : null,
      subcontractor: form.subcontractor || null,
      engineer: form.engineer || null,
      site_incharge: form.site_incharge || null,
      work_status: form.work_status,
      carry_forward,
      reason: form.reason || null,
      created_by: profile?.id || null,
    });
    setForm((f) => ({ ...f, description: "", location_block: "", pct_done: "", qty_done: "", reason: "", boq_item_id: "" }));
    setAdding(false);
    loadRows();
    loadBoqItems(form.project_id);
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800 }}>Daily Progress Report (DPR)</h1>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <select className="input" style={{ width: 200 }} value={filterProject} onChange={(e) => setFilterProject(e.target.value)}>
            <option value="all">All projects</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <input className="input" style={{ width: 150 }} type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} />
          {canAdd && (
            <button className="btn btn-acc" onClick={() => setAdding(!adding)}>
              <i className="ti ti-plus" /> Add Entry
            </button>
          )}
        </div>
      </div>

      {adding && canAdd && (
        <div className="card fadeIn" style={{ padding: 18, marginBottom: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10, marginBottom: 14 }}>
            <div>
              <label style={{ fontSize: 11, color: "var(--t3)" }}>Project</label>
              <select className="input" value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value, boq_item_id: "" })}>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--t3)" }}>Date</label>
              <input className="input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div style={{ gridColumn: "span 2" }}>
              <label style={{ fontSize: 11, color: "var(--t3)" }}>BOQ Item</label>
              <select className="input" value={form.boq_item_id} onChange={(e) => setForm({ ...form, boq_item_id: e.target.value })}>
                <option value="">— None / not linked —</option>
                {boqItems.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.item} (done {b.cum_done} / total {b.boq_qty} {b.unit})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--t3)" }}>Location / Block</label>
              <input className="input" value={form.location_block} onChange={(e) => setForm({ ...form, location_block: e.target.value })} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--t3)" }}>Category</label>
              <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {CATEGORY_OF_WORK.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--t3)" }}>% Done (this entry)</label>
              <input className="input" type="number" value={form.pct_done} onChange={(e) => setForm({ ...form, pct_done: e.target.value })} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--t3)" }}>Qty Done (this entry)</label>
              <input className="input" type="number" value={form.qty_done} onChange={(e) => setForm({ ...form, qty_done: e.target.value })} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--t3)" }}>Subcontractor</label>
              <input className="input" value={form.subcontractor} onChange={(e) => setForm({ ...form, subcontractor: e.target.value })} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--t3)" }}>Engineer</label>
              <input className="input" value={form.engineer} onChange={(e) => setForm({ ...form, engineer: e.target.value })} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--t3)" }}>Site Incharge</label>
              <input className="input" value={form.site_incharge} onChange={(e) => setForm({ ...form, site_incharge: e.target.value })} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--t3)" }}>Work Status</label>
              <select className="input" value={form.work_status} onChange={(e) => setForm({ ...form, work_status: e.target.value as WorkStatus })}>
                {WORK_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 11, color: "var(--t3)" }}>Description</label>
            <input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, color: "var(--t3)" }}>Reason (delay/carry-forward, etc.)</label>
            <input className="input" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-acc" onClick={save}>Save</button>
            <button className="btn btn-ghost" onClick={() => setAdding(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="table-wrap card">
        <table className="dt">
          <thead>
            <tr>
              <th>#</th><th>Date</th><th>Project</th><th>Description</th><th>Category</th>
              <th>% Done</th><th>Qty Done</th><th>Status</th><th>Carry Forward</th><th>Engineer</th><th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id} style={r.work_status === "Delayed - Carry Forward" ? { borderLeft: "3px solid var(--yl)", background: "rgba(251,191,36,0.06)" } : undefined}>
                <td>{i + 1}</td>
                <td>{r.date}</td>
                <td>{projectName(r.project_id)}</td>
                <td>{r.description}</td>
                <td>{r.category || "—"}</td>
                <td>{r.pct_done != null ? `${r.pct_done}%` : "—"}</td>
                <td>{r.qty_done ?? "—"}</td>
                <td>{r.work_status}</td>
                <td>{r.carry_forward ? "Yes" : "No"}</td>
                <td>{r.engineer || "—"}</td>
                <td>{r.reason || "—"}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={11} style={{ textAlign: "center", color: "var(--t3)", padding: 24 }}>No entries yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
