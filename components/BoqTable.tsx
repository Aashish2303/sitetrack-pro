"use client";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { canSeeFinance, UNITS } from "@/lib/roles";
import type { BoqItemView, Profile } from "@/lib/types";

function progressColor(pct: number) {
  if (pct >= 80) return "var(--gr)";
  if (pct >= 50) return "var(--yl)";
  return "var(--rd)";
}

function BoqRow({r,finance,updateField}:{r:BoqItemView;finance:boolean;updateField:(id:string,field:string,value:string)=>Promise<void>}){
    return (
      <tr>
        <td>
          <input
            className="input"
            defaultValue={r.item}
            onBlur={(e) => e.target.value !== r.item && updateField(r.id, "item", e.target.value)}
            style={{ minWidth: 180 }}
          />
        </td>
        <td>
          <select aria-label="Unit" className="input" value={r.unit} onChange={e=>updateField(r.id,"unit",e.target.value)} style={{width:90}}>{Array.from(new Set([r.unit,...UNITS])).map(u=><option key={u}>{u}</option>)}</select>
        </td>
        <td>
          <input
            className="input"
            type="number"
            defaultValue={r.boq_qty}
            onBlur={(e) => Number(e.target.value) !== r.boq_qty && updateField(r.id, "boq_qty", e.target.value)}
            style={{ width: 90 }}
          />
        </td>
        <td>
          <input
            className="input"
            type="number"
            defaultValue={r.cum_done}
            onBlur={(e) => Number(e.target.value) !== r.cum_done && updateField(r.id, "cum_done", e.target.value)}
            style={{ width: 90 }}
          />
        </td>
        <td>{r.balance}</td>
        {finance && (
          <td>
            <input
              className="input"
              type="number"
              defaultValue={r.rate ?? 0}
              onBlur={(e) => Number(e.target.value) !== r.rate && updateField(r.id, "rate", e.target.value)}
              style={{ width: 90 }}
            />
          </td>
        )}
        {finance && <td>{r.boq_value != null ? "₹" + r.boq_value.toLocaleString("en-IN") : "—"}</td>}
        {finance && <td>{r.done_value != null ? "₹" + r.done_value.toLocaleString("en-IN") : "—"}</td>}
        <td>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 60, height: 7, background: "var(--s2)", borderRadius: 4, overflow: "hidden" }}>
              <div style={{ width: `${r.progress_pct}%`, height: "100%", background: progressColor(r.progress_pct) }} />
            </div>
            <span style={{ fontSize: 11, color: progressColor(r.progress_pct) }}>{r.progress_pct}%</span>
          </div>
        </td>
      </tr>
    );
  }


export default function BoqTable({ projectId }: { projectId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<BoqItemView[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ item: "", unit: "Cum", boq_qty: "", rate: "", is_extra: false });

  async function load() {
    const { data } = await supabase
      .from("boq_items_view")
      .select("*")
      .eq("project_id", projectId)
      .order("is_extra", { ascending: true });
    setRows((data as BoqItemView[]) || []);
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
  }, [projectId]);

  useEffect(()=>{window.addEventListener('st:refresh',load);return()=>window.removeEventListener('st:refresh',load)});
  const finance = canSeeFinance(profile?.role);

  async function addItem() {
    if (!form.item || !form.boq_qty) return;
    await supabase.from("boq_items").insert({
      project_id: projectId,
      item: form.item,
      unit: form.unit,
      boq_qty: Number(form.boq_qty),
      rate: Number(form.rate || 0),
      is_extra: form.is_extra,
    });
    setForm({ item: "", unit: "Cum", boq_qty: "", rate: "", is_extra: false });
    setAdding(false);
    load();
  }

  async function updateField(id: string, field: string, value: string) {
    await supabase.from("boq_items").update({ [field]: field === "item" || field === "unit" ? value : Number(value) }).eq("id", id);
    load();
  }

  const mainItems = rows.filter((r) => !r.is_extra);
  const extraItems = rows.filter((r) => r.is_extra);


  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700 }}>Bill of Quantities</h3>
        <button className="btn btn-acc" onClick={() => setAdding(!adding)}>
          <i className="ti ti-plus" /> Add Item
        </button>
      </div>

      {adding && (
        <div className="card" style={{ padding: 14, marginBottom: 14, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div>
            <label style={{ fontSize: 11, color: "var(--t3)" }}>Item</label>
            <input className="input" value={form.item} onChange={(e) => setForm({ ...form, item: e.target.value })} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "var(--t3)" }}>Unit</label>
            <select className="input" style={{width:90}} value={form.unit} onChange={e=>setForm({...form,unit:e.target.value})}>{UNITS.map(u=><option key={u}>{u}</option>)}</select>
          </div>
          <div>
            <label style={{ fontSize: 11, color: "var(--t3)" }}>Quantity</label>
            <input className="input" style={{ width: 100 }} type="number" value={form.boq_qty} onChange={(e) => setForm({ ...form, boq_qty: e.target.value })} />
          </div>
          {finance && (
            <div>
              <label style={{ fontSize: 11, color: "var(--t3)" }}>Rate</label>
              <input className="input" style={{ width: 100 }} type="number" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} />
            </div>
          )}
          <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
            <input type="checkbox" checked={form.is_extra} onChange={(e) => setForm({ ...form, is_extra: e.target.checked })} />
            Extra / variation item
          </label>
          <button className="btn btn-acc" onClick={addItem}>Save</button>
        </div>
      )}

      <div className="table-wrap card">
        <table className="dt">
          <thead>
            <tr>
              <th>Item</th><th>Unit</th><th>BOQ Qty</th><th>Done Qty</th><th>Balance</th>
              {finance && <th>Rate</th>}
              {finance && <th>BOQ Value</th>}
              {finance && <th>Done Value</th>}
              <th>Progress</th>
            </tr>
          </thead>
          <tbody>
            {mainItems.map((r) => <BoqRow key={r.id+JSON.stringify(r)} r={r} finance={finance} updateField={updateField} />)}
            {extraItems.length > 0 && (
              <tr>
                <td colSpan={finance ? 9 : 6} style={{ color: "var(--acc)", fontWeight: 700, fontSize: 11 }}>
                  <i className="ti ti-star" /> EXTRA / VARIATION ITEMS
                </td>
              </tr>
            )}
            {extraItems.map((r) => <BoqRow key={r.id+JSON.stringify(r)} r={r} finance={finance} updateField={updateField} />)}
            {rows.length === 0 && (
              <tr><td colSpan={9} style={{ textAlign: "center", color: "var(--t3)", padding: 24 }}>No BOQ items yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
