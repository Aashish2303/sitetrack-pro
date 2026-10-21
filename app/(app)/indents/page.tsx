"use client";
import { today } from "@/lib/date";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { UNITS, SIZES, CATEGORY_OF_WORK } from "@/lib/roles";
import type { Profile, Project, Indent, IndentItem } from "@/lib/types";

type DraftItem = { material_name: string; quantity: string; unit: string; size: string; category: string };

const STATUS_COLOR: Record<string, string> = {
  "Pending Quotation": "var(--pu)",
  "MD Review": "var(--acc)",
  "Approved": "var(--gr)",
  "Rejected": "var(--rd)",
};

function emptyItem(): DraftItem {
  return { material_name: "", quantity: "", unit: UNITS[0], size: "", category: "" };
}

export default function IndentsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [indents, setIndents] = useState<Indent[]>([]);
  const [itemCounts, setItemCounts] = useState<Record<string, number>>({});
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);

  const [filterProject, setFilterProject] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const [form, setForm] = useState({
    project_id: "",
    date: today(),
    urgency: "Normal",
    engineer: "",
    notes: "",
    note_for_approval: "",
  });
  const [items, setItems] = useState<DraftItem[]>([emptyItem()]);

  useEffect(() => { const refresh = () => { load(); }; window.addEventListener("st:refresh", refresh); return () => window.removeEventListener("st:refresh", refresh); });

  async function load() {
    const { data: projData } = await supabase.from("projects_view").select("*").order("name", { ascending: true });
    setProjects((projData as Project[]) || []);

    const { data: indentData } = await supabase.from("indents").select("*").order("created_at", { ascending: false });
    setIndents((indentData as Indent[]) || []);

    const { data: itemData } = await supabase.from("indent_items").select("indent_id");
    const counts: Record<string, number> = {};
    ((itemData as { indent_id: string }[]) || []).forEach((row) => {
      counts[row.indent_id] = (counts[row.indent_id] || 0) + 1;
    });
    setItemCounts(counts);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function projectName(id: string) {
    return projects.find((p) => p.id === id)?.name || "—";
  }

  function updateItem(i: number, field: keyof DraftItem, value: string) {
    const next = [...items];
    next[i] = { ...next[i], [field]: value };
    setItems(next);
  }

  async function createIndent() {
    if (!form.project_id || !form.engineer) return;
    const validItems = items.filter((it) => it.material_name && it.quantity);
    if (validItems.length === 0) return;
    setSaving(true);
    try {
      const {error} = await supabase.rpc('create_indent',{p_header:form,p_items:validItems.map(it=>({...it,quantity:Number(it.quantity)}))});
      if(error) throw error;
      setItems([emptyItem()]);
      setForm(f=>({...f,notes:'',note_for_approval:''}));
      setAdding(false);
      load();
    } finally {
      setSaving(false);
    }
  }

  const filtered = indents.filter((ind) => {
    if (filterProject !== "all" && ind.project_id !== filterProject) return false;
    if (filterStatus !== "all" && ind.status !== filterStatus) return false;
    return true;
  });

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800 }}>Material Indents</h1>
        <button className="btn btn-acc" onClick={() => setAdding(!adding)}>
          <i className="ti ti-plus" /> New Indent
        </button>
      </div>

      {adding && (
        <div className="card fadeIn" style={{ padding: 18, marginBottom: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10, marginBottom: 14 }}>
            <div>
              <label style={{ fontSize: 11, color: "var(--t3)" }}>Project</label>
              <select className="input" value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })}>
                <option value="">Select project</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--t3)" }}>Date</label>
              <input className="input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--t3)" }}>Urgency</label>
              <select className="input" value={form.urgency} onChange={(e) => setForm({ ...form, urgency: e.target.value })}>
                <option>Normal</option>
                <option>Urgent</option>
                <option>Critical</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--t3)" }}>Engineer</label>
              <input className="input" value={form.engineer} onChange={(e) => setForm({ ...form, engineer: e.target.value })} />
            </div>
          </div>

          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 11, color: "var(--t3)" }}>Notes</label>
            <textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, color: "var(--t3)" }}>Note for Approval (to MD)</label>
            <textarea className="input" rows={2} value={form.note_for_approval} onChange={(e) => setForm({ ...form, note_for_approval: e.target.value })} />
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <label style={{ fontSize: 12, color: "var(--t2)", fontWeight: 600 }}>Items ({items.length})</label>
            <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setItems([...items, emptyItem()])}>
              <i className="ti ti-plus" /> Add Item
            </button>
          </div>

          <div className="table-wrap" style={{ marginBottom: 14 }}>
            <table className="dt">
              <thead>
                <tr>
                  <th>Material</th><th>Qty</th><th>Unit</th><th>Size</th><th>Category</th><th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={i}>
                    <td><input className="input" style={{ minWidth: 160 }} value={it.material_name} onChange={(e) => updateItem(i, "material_name", e.target.value)} /></td>
                    <td><input className="input" style={{ width: 90 }} type="number" value={it.quantity} onChange={(e) => updateItem(i, "quantity", e.target.value)} /></td>
                    <td>
                      <select className="input" style={{ width: 90 }} value={it.unit} onChange={(e) => updateItem(i, "unit", e.target.value)}>
                        {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </td>
                    <td>
                      <select className="input" style={{ width: 110 }} value={it.size} onChange={(e) => updateItem(i, "size", e.target.value)}>
                        <option value="">—</option>
                        {SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td>
                      <select className="input" style={{ width: 150 }} value={it.category} onChange={(e) => updateItem(i, "category", e.target.value)}>
                        <option value="">—</option>
                        {CATEGORY_OF_WORK.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </td>
                    <td>
                      <button className="btn btn-ghost" onClick={() => setItems(items.filter((_, j) => j !== i))} disabled={items.length === 1}>
                        <i className="ti ti-trash" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-acc" onClick={createIndent} disabled={saving}>{saving ? "Saving..." : "Create Indent"}</button>
            <button className="btn btn-ghost" onClick={() => setAdding(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        <select className="input" style={{ width: 220 }} value={filterProject} onChange={(e) => setFilterProject(e.target.value)}>
          <option value="all">All projects</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select className="input" style={{ width: 200 }} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="all">All statuses</option>
          <option>Pending Quotation</option>
          <option>MD Review</option>
          <option>Approved</option>
          <option>Rejected</option>
        </select>
      </div>

      <div className="table-wrap card">
        <table className="dt">
          <thead>
            <tr>
              <th>Date</th><th>Project</th><th>Engineer</th><th>Items</th><th>Status</th><th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((ind) => (
              <tr key={ind.id}>
                <td>{ind.date}</td>
                <td>{projectName(ind.project_id)}</td>
                <td>{ind.engineer || "—"}</td>
                <td>{itemCounts[ind.id] || 0}</td>
                <td>
                  <span className="badge" style={{ background: `${STATUS_COLOR[ind.status]}22`, color: STATUS_COLOR[ind.status] }}>
                    {ind.status}
                  </span>
                </td>
                <td>
                  <Link href={`/indents/${ind.id}`} className="btn btn-ghost" style={{ fontSize: 12, textDecoration: "none", display: "inline-block" }}>
                    View
                  </Link>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--t3)", padding: 24 }}>No indents yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
