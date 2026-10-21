"use client";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CATEGORY_OF_WORK } from "@/lib/roles";
import type { DwrEntry, Profile, ProjectView, WorkStatus } from "@/lib/types";

const WORK_STATUSES: WorkStatus[] = ["Completed", "Partial", "Delayed - Carry Forward", "Cancelled", "Not Started"];

const CAN_ADD_ROLES = ["engineer", "qms", "admin"];

export default function DwrPage() {
  const supabase = useMemo(() => createClient(), []);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [projects, setProjects] = useState<ProjectView[]>([]);
  const [selected, setSelected] = useState<string>("all");
  const [rows, setRows] = useState<DwrEntry[]>([]);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    project_id: "",
    date: new Date().toISOString().slice(0, 10),
    description: "",
    location_block: "",
    quantity: "",
    category: CATEGORY_OF_WORK[0],
    subcontractor: "",
    engineer: "",
    site_incharge: "",
    work_status: "Completed" as WorkStatus,
    remarks: "",
  });

  async function loadProjects() {
    const { data } = await supabase.from("projects_view").select("*").order("created_at", { ascending: false });
    const list = (data as ProjectView[]) || [];
    setProjects(list);
    if (list.length && !form.project_id) setForm((f) => ({ ...f, project_id: list[0].id }));
  }

  async function loadRows() {
    let q = supabase.from("dwr_entries").select("*").order("date", { ascending: false }).order("created_at", { ascending: false });
    if (selected !== "all") q = q.eq("project_id", selected);
    const { data } = await q;
    setRows((data as DwrEntry[]) || []);
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
  }, [selected]);

  const canAdd = !!profile && CAN_ADD_ROLES.includes(profile.role);
  const projectName = (id: string) => projects.find((p) => p.id === id)?.name || "—";

  async function save() {
    if (!form.project_id || !form.description) return;
    const carry_forward = form.work_status === "Delayed - Carry Forward";
    await supabase.from("dwr_entries").insert({
      project_id: form.project_id,
      date: form.date,
      description: form.description,
      location_block: form.location_block || null,
      quantity: form.quantity ? Number(form.quantity) : null,
      category: form.category,
      subcontractor: form.subcontractor || null,
      engineer: form.engineer || null,
      site_incharge: form.site_incharge || null,
      work_status: form.work_status,
      carry_forward,
      remarks: form.remarks || null,
      created_by: profile?.id || null,
    });
    setForm((f) => ({ ...f, description: "", location_block: "", quantity: "", remarks: "" }));
    setAdding(false);
    loadRows();
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800 }}>Daily Work Report (DWR)</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <select className="input" style={{ width: 220 }} value={selected} onChange={(e) => setSelected(e.target.value)}>
            <option value="all">All projects</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
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
              <select className="input" value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })}>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--t3)" }}>Date</label>
              <input className="input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
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
              <label style={{ fontSize: 11, color: "var(--t3)" }}>Quantity</label>
              <input className="input" type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
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
            <label style={{ fontSize: 11, color: "var(--t3)" }}>Remarks</label>
            <input className="input" value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} />
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
              <th>Date</th><th>Project</th><th>Description</th><th>Location/Block</th><th>Category</th>
              <th>Qty</th><th>Subcontractor</th><th>Engineer</th><th>Site Incharge</th><th>Status</th><th>Remarks</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                style={
                  r.work_status === "Delayed - Carry Forward"
                    ? { borderLeft: "3px solid var(--yl)", background: "rgba(251,191,36,0.06)" }
                    : undefined
                }
              >
                <td>{r.date}</td>
                <td>{projectName(r.project_id)}</td>
                <td>{r.description}</td>
                <td>{r.location_block || "—"}</td>
                <td>{r.category || "—"}</td>
                <td>{r.quantity ?? "—"}</td>
                <td>{r.subcontractor || "—"}</td>
                <td>{r.engineer || "—"}</td>
                <td>{r.site_incharge || "—"}</td>
                <td>
                  <span
                    className="badge"
                    style={{
                      background: r.work_status === "Completed" ? "rgba(16,185,129,0.15)" : r.work_status === "Delayed - Carry Forward" ? "rgba(251,191,36,0.15)" : r.work_status === "Cancelled" ? "rgba(239,68,68,0.15)" : "rgba(160,168,194,0.15)",
                      color: r.work_status === "Completed" ? "var(--gr)" : r.work_status === "Delayed - Carry Forward" ? "var(--yl)" : r.work_status === "Cancelled" ? "var(--rd)" : "var(--t2)",
                    }}
                  >
                    {r.work_status}
                  </span>
                </td>
                <td>{r.remarks || "—"}</td>
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
