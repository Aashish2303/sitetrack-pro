"use client";
import { useRouteFilter } from "@/lib/use-route-form";
import { usePathname, useParams, useRouter } from "next/navigation";
import { useRouteForm } from "@/lib/use-route-form";
import Link from "next/link";
import {workingHours} from "@/lib/calculations.mjs";
import { today } from "@/lib/date";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { canSeeFinance, TRADES } from "@/lib/roles";
import type { LabourCategoryView, LabourEntry, Profile, ProjectView } from "@/lib/types";

type CategoryRow = {
  id?: string;
  trade: string;
  skill: "Skilled" | "Unskilled" | "Semi-Skilled";
  male_count: string;
  female_count: string;
  wage: string;
};

const emptyCategoryRow = (): CategoryRow => ({ trade: TRADES[0], skill: "Unskilled", male_count: "", female_count: "", wage: "" });

function nowHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}


export default function LabourPage() {
  const supabase = useMemo(() => createClient(), []);
  const routeParams = useParams<{id?:string}>(), routePath = usePathname(), router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [projects, setProjects] = useState<ProjectView[]>([]);
  const [filterProject, setFilterProject] = useRouteFilter("project", "all");
  const [filterDate, setFilterDate] = useRouteFilter("date", "");
  const [entries, setEntries] = useState<LabourEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [categoriesByEntry, setCategoriesByEntry] = useState<Record<string, LabourCategoryView[]>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useRouteForm("/labour");

  const [form, setForm] = useState({
    project_id: "",
    date: today(),
    subcontractor: "",
    site_incharge: "",
    shift: "Day" as "Day" | "Night",
    in_time: "",
    out_time: "",
    remarks: "",
  });
  const [catRows, setCatRows] = useState<CategoryRow[]>([emptyCategoryRow()]);

  useEffect(() => { const refresh = () => { loadEntries(); }; window.addEventListener("st:refresh", refresh); return () => window.removeEventListener("st:refresh", refresh); });

  async function loadProjects() {
    const { data } = await supabase.from("projects_view").select("*").order("created_at", { ascending: false });
    const list = (data as ProjectView[]) || [];
    setProjects(list);
    if (list.length && !form.project_id) setForm((f) => ({ ...f, project_id: list[0].id }));
  }

  async function loadEntries() {
    let q = supabase.from("labour_entries").select("*").order("date", { ascending: false }).order("created_at", { ascending: false });
    if (filterProject !== "all") q = q.eq("project_id", filterProject);
    if (filterDate) q = q.eq("date", filterDate);
    const { data } = await q;
    const list = (data as LabourEntry[]) || [];
    setEntries(list);

    if (list.length) {
      const { data: cats } = await supabase
        .from("labour_categories_view")
        .select("*")
        .in("labour_entry_id", list.map((e) => e.id));
      const grouped: Record<string, LabourCategoryView[]> = {};
      (cats as LabourCategoryView[] | null || []).forEach((c) => {
        if (!grouped[c.labour_entry_id]) grouped[c.labour_entry_id] = [];
        grouped[c.labour_entry_id].push(c);
      });
      setCategoriesByEntry(grouped);
    } else {
      setCategoriesByEntry({});
    }
    setLoaded(true);
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
    loadEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterProject, filterDate]);

  const finance = canSeeFinance(profile?.role);
  const projectName = (id: string) => projects.find((p) => p.id === id)?.name || "—";

  function resetForm() {
    setForm({
      project_id: projects[0]?.id || "",
      date: today(),
      subcontractor: "",
      site_incharge: "",
      shift: "Day",
      in_time: "",
      out_time: "",
      remarks: "",
    });
    setCatRows([emptyCategoryRow()]);
    setEditingId(null);
  }

  function startEdit(entry: LabourEntry) {
    setForm({
      project_id: entry.project_id,
      date: entry.date,
      subcontractor: entry.subcontractor || "",
      site_incharge: entry.site_incharge || "",
      shift: entry.shift,
      in_time: entry.in_time || "",
      out_time: entry.out_time || "",
      remarks: entry.remarks || "",
    });
    const cats = categoriesByEntry[entry.id] || [];
    setCatRows(
      cats.length
        ? cats.map((c) => ({
            id: c.id,
            trade: c.trade,
            skill: c.skill as CategoryRow["skill"],
            male_count: String(c.male_count ?? ""),
            female_count: String(c.female_count ?? ""),
            wage: c.wage != null ? String(c.wage) : "",
          }))
        : [emptyCategoryRow()]
    );
    setEditingId(entry.id);
    if (routePath !== `/labour/${entry.id}/edit`) router.push(`/labour/${entry.id}/edit`);
  }

  useEffect(() => {
    if (!routePath.endsWith('/edit') || !routeParams.id) return;
    const entry = entries.find(e => e.id === routeParams.id);
    if (entry && loaded) startEdit(entry);
  }, [routePath, routeParams.id, entries, categoriesByEntry, loaded]);

  async function save() {
    if (!form.project_id) return;
    const hours = workingHours(form.in_time, form.out_time);

    const payload = {
      project_id: form.project_id,
      date: form.date,
      subcontractor: form.subcontractor || null,
      site_incharge: form.site_incharge || null,
      shift: form.shift,
      in_time: form.in_time || null,
      out_time: form.out_time || null,
      hours,
      remarks: form.remarks || null,
      created_by: profile?.id || null,
    };

    const validRows = catRows.filter(r => r.trade && (Number(r.male_count) > 0 || Number(r.female_count) > 0));
    if (!validRows.length) return window.dispatchEvent(new CustomEvent('st:notice', {detail:{message:'Add at least one worker.',error:true}}));
    const {error} = await supabase.rpc('save_labour', {p_id:editingId, p_header:payload, p_rows:validRows.map(r=>({...r,male_count:Number(r.male_count||0),female_count:Number(r.female_count||0),wage:finance?Number(r.wage||0):null}))});
    if(error) throw error;

    resetForm();
    setAdding(false);
    loadEntries();
  }

  function updateCatRow(i: number, field: keyof CategoryRow, value: string) {
    const rows = [...catRows];
    (rows[i] as any)[field] = value;
    setCatRows(rows);
  }

  // Aggregate stats across filtered entries
  const allCats = entries.flatMap((e) => categoriesByEntry[e.id] || []);
  const totalMale = allCats.reduce((s, c) => s + (c.male_count || 0), 0);
  const totalFemale = allCats.reduce((s, c) => s + (c.female_count || 0), 0);
  const totalWorkers = totalMale + totalFemale;
  const totalCost = allCats.reduce((s, c) => s + (c.row_cost || 0), 0);

  const byTrade: Record<string, { workers: number; cost: number }> = {};
  allCats.forEach((c) => {
    if (!byTrade[c.trade]) byTrade[c.trade] = { workers: 0, cost: 0 };
    byTrade[c.trade].workers += (c.male_count || 0) + (c.female_count || 0);
    byTrade[c.trade].cost += c.row_cost || 0;
  });

  async function exportExcel() {
    const XLSX = await import("xlsx");
    const rows: any[] = [];
    entries.forEach((e) => {
      const cats = categoriesByEntry[e.id] || [];
      if (cats.length === 0) {
        rows.push({
          Date: e.date,
          Project: projectName(e.project_id),
          Subcontractor: e.subcontractor,
          Shift: e.shift,
          InTime: e.in_time,
          OutTime: e.out_time,
          Hours: e.hours,
          Trade: "",
          Skill: "",
          Male: "",
          Female: "",
          ...(finance ? { Wage: "", RowCost: "" } : {}),
        });
      } else {
        cats.forEach((c) => {
          rows.push({
            Date: e.date,
            Project: projectName(e.project_id),
            Subcontractor: e.subcontractor,
            Shift: e.shift,
            InTime: e.in_time,
            OutTime: e.out_time,
            Hours: e.hours,
            Trade: c.trade,
            Skill: c.skill,
            Male: c.male_count,
            Female: c.female_count,
            ...(finance ? { Wage: c.wage, RowCost: c.row_cost } : {}),
          });
        });
      }
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Labour");
    XLSX.writeFile(wb, "labour-export.xlsx");
  }

  if (routePath.endsWith('/edit')) {
    if (!loaded) return <div className="empty" role="status">Loading attendance…</div>;
    if (!entries.some(e => e.id === routeParams.id)) return <div className="card empty"><p>Attendance entry not found or outside the selected filters.</p><Link className="btn btn-ghost" href="/labour">All labour entries</Link></div>;
    if (editingId !== routeParams.id) return <div className="empty" role="status">Opening attendance editor…</div>;
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800 }}>Labour Register</h1>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <select className="input" style={{ width: 200 }} value={filterProject} onChange={(e) => setFilterProject(e.target.value)}>
            <option value="all">All projects</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <input className="input" style={{ width: 150 }} type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} />
          <button className="btn btn-ghost" onClick={exportExcel}><i className="ti ti-file-spreadsheet" /> Export Excel</button>
          <button
            className="btn btn-acc"
            onClick={() => {
              if (adding) { resetForm(); setAdding(false); } else { resetForm(); setAdding(true); }
            }}
          >
            <i className="ti ti-plus" /> {editingId ? "Edit Entry" : "Add Entry"}
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 14, marginBottom: 20 }}>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 11, color: "var(--t3)", fontWeight: 700, marginBottom: 8 }}>TOTAL WORKERS</div>
          <div style={{ fontSize: 24, fontWeight: 800 }}>{totalWorkers}</div>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 11, color: "var(--t3)", fontWeight: 700, marginBottom: 8 }}>MALE</div>
          <div style={{ fontSize: 24, fontWeight: 800 }}>{totalMale}</div>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 11, color: "var(--t3)", fontWeight: 700, marginBottom: 8 }}>FEMALE</div>
          <div style={{ fontSize: 24, fontWeight: 800 }}>{totalFemale}</div>
        </div>
        {finance && (
          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: 11, color: "var(--t3)", fontWeight: 700, marginBottom: 8 }}>TOTAL LABOUR COST</div>
            <div style={{ fontSize: 24, fontWeight: 800 }}>₹{totalCost.toLocaleString("en-IN")}</div>
          </div>
        )}
      </div>

      {Object.keys(byTrade).length > 0 && (
        <div className="card" style={{ padding: 14, marginBottom: 20 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Breakdown by Trade</h3>
          <table className="dt">
            <thead>
              <tr><th>Trade</th><th>Total Workers</th>{finance && <th>Total Cost</th>}</tr>
            </thead>
            <tbody>
              {Object.entries(byTrade).map(([trade, v]) => (
                <tr key={trade}>
                  <td>{trade}</td>
                  <td><div style={{display:"flex",gap:12,alignItems:"center"}}><div className="mini-bar"><span style={{width:`${100*v.workers/Math.max(totalWorkers,1)}%`}}/></div>{v.workers}</div></td>
                  {finance && <td>₹{v.cost.toLocaleString("en-IN")}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {finance && <div className="card" style={{padding:18,marginBottom:20}}><h3 style={{fontSize:14,fontWeight:600}}>Labour cost by subcontractor</h3>{Array.from(new Set(entries.map(e=>e.subcontractor||'Unassigned'))).map(name=>{const matching=entries.filter(e=>(e.subcontractor||'Unassigned')===name);const cost=matching.reduce((s,e)=>s+(categoriesByEntry[e.id]||[]).reduce((a,c)=>a+Number(c.row_cost||0),0),0);return <div key={name} style={{display:'flex',justifyContent:'space-between',padding:'10px 0',borderTop:'1px solid var(--br)'}}><span>{name}</span><strong>₹{cost.toLocaleString('en-IN')}</strong></div>})}</div>}
      {adding && (
        <div className="card fadeIn" style={{ padding: 18, marginBottom: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10, marginBottom: 14 }}>
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
              <label style={{ fontSize: 11, color: "var(--t3)" }}>Subcontractor</label>
              <input className="input" value={form.subcontractor} onChange={(e) => setForm({ ...form, subcontractor: e.target.value })} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--t3)" }}>Site Incharge</label>
              <input className="input" value={form.site_incharge} onChange={(e) => setForm({ ...form, site_incharge: e.target.value })} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--t3)" }}>Shift</label>
              <select className="input" value={form.shift} onChange={(e) => setForm({ ...form, shift: e.target.value as "Day" | "Night" })}>
                <option>Day</option>
                <option>Night</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--t3)" }}>In Time</label>
              <div style={{ display: "flex", gap: 6 }}>
                <input className="input" type="time" placeholder="HH:MM" value={form.in_time} onChange={(e) => setForm({ ...form, in_time: e.target.value })} />
                <button type="button" className="btn btn-ghost" onClick={() => setForm({ ...form, in_time: nowHHMM() })}>Now</button>
              </div>
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--t3)" }}>Out Time</label>
              <div style={{ display: "flex", gap: 6 }}>
                <input className="input" type="time" placeholder="HH:MM" value={form.out_time} onChange={(e) => setForm({ ...form, out_time: e.target.value })} />
                <button type="button" className="btn btn-ghost" onClick={() => setForm({ ...form, out_time: nowHHMM() })}>Now</button>
              </div>
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--t3)" }}>Hours (auto)</label>
              <input className="input" value={workingHours(form.in_time, form.out_time) ?? ""} disabled readOnly />
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, color: "var(--t3)" }}>Remarks</label>
            <input className="input" value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} />
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <label style={{ fontSize: 12, color: "var(--t2)", fontWeight: 600 }}>Labour Categories</label>
            <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setCatRows([...catRows, emptyCategoryRow()])}>+ Add Category</button>
          </div>
          {catRows.map((row, i) => (
            <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6, flexWrap: "wrap", alignItems: "center" }}>
              <select className="input" style={{ width: 140 }} value={row.trade} onChange={(e) => updateCatRow(i, "trade", e.target.value)}>
                {TRADES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <select className="input" style={{ width: 130 }} value={row.skill} onChange={(e) => updateCatRow(i, "skill", e.target.value)}>
                <option>Skilled</option>
                <option>Semi-Skilled</option>
                <option>Unskilled</option>
              </select>
              <input className="input" style={{ width: 90 }} type="number" placeholder="Male" value={row.male_count} onChange={(e) => updateCatRow(i, "male_count", e.target.value)} />
              <input className="input" style={{ width: 90 }} type="number" placeholder="Female" value={row.female_count} onChange={(e) => updateCatRow(i, "female_count", e.target.value)} />
              {finance && (
                <input className="input" style={{ width: 100 }} type="number" placeholder="Wage/worker" value={row.wage} onChange={(e) => updateCatRow(i, "wage", e.target.value)} />
              )}
              <button type="button" className="btn btn-ghost" onClick={() => setCatRows(catRows.filter((_, j) => j !== i))}>
                <i className="ti ti-trash" /> Remove Category
              </button>
            </div>
          ))}

          <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
            <button className="btn btn-acc" onClick={save}>Save</button>
            <button className="btn btn-ghost" onClick={() => { resetForm(); setAdding(false); }}>Cancel</button>
          </div>
        </div>
      )}

      <div className="table-wrap card">
        <table className="dt">
          <thead>
            <tr>
              <th>Date</th><th>Project</th><th>Subcontractor</th><th>Shift</th><th>In</th><th>Out</th><th>Hours</th>
              <th>Trades</th><th>Workers</th>{finance && <th>Cost</th>}<th>Site Incharge</th><th></th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => {
              const cats = categoriesByEntry[e.id] || [];
              const workers = cats.reduce((s, c) => s + (c.male_count || 0) + (c.female_count || 0), 0);
              const cost = cats.reduce((s, c) => s + (c.row_cost || 0), 0);
              return (
                <tr key={e.id}>
                  <td>{e.date}</td>
                  <td>{projectName(e.project_id)}</td>
                  <td>{e.subcontractor || "—"}</td>
                  <td>{e.shift}</td>
                  <td>{e.in_time || "—"}</td>
                  <td>{e.out_time || "—"}</td>
                  <td>{e.hours ?? "—"}</td>
                  <td>{cats.map((c) => c.trade).join(", ") || "—"}</td>
                  <td>{workers}</td>
                  {finance && <td>₹{cost.toLocaleString("en-IN")}</td>}
                  <td>{e.site_incharge || "—"}</td>
                  <td><button disabled={e.date!==today() && !["md","admin"].includes(profile?.role||"")} title={e.date!==today()?"Historical entries require management access":"Edit same-day attendance"} className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => startEdit(e)}>Edit</button></td>
                </tr>
              );
            })}
            {entries.length === 0 && (
              <tr><td colSpan={finance ? 12 : 11} style={{ textAlign: "center", color: "var(--t3)", padding: 24 }}>No entries yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
