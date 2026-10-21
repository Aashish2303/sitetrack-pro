"use client";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { UNITS } from "@/lib/roles";
import type { Material, MaterialTransaction, Profile, ProjectView } from "@/lib/types";

type TxType = "Inward" | "Consumption";

export default function MaterialsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [tab, setTab] = useState<"master" | "stock">("master");
  const [profile, setProfile] = useState<Profile | null>(null);

  const [materials, setMaterials] = useState<Material[]>([]);
  const [transactions, setTransactions] = useState<MaterialTransaction[]>([]);
  const [projects, setProjects] = useState<ProjectView[]>([]);

  const [addingMaterial, setAddingMaterial] = useState(false);
  const [materialForm, setMaterialForm] = useState({ name: "", unit: UNITS[0], category: "", opening_stock: "" });

  const [selectedProject, setSelectedProject] = useState<string>("all");
  const [addingTx, setAddingTx] = useState(false);
  const [txForm, setTxForm] = useState({
    project_id: "",
    material_id: "",
    date: new Date().toISOString().slice(0, 10),
    type: "Inward" as TxType,
    quantity: "",
    reference: "",
    remarks: "",
  });

  async function loadMaterials() {
    const { data } = await supabase.from("materials").select("*").order("name", { ascending: true });
    setMaterials((data as Material[]) || []);
  }

  async function loadTransactions() {
    const { data } = await supabase.from("material_transactions").select("*").order("date", { ascending: false }).order("created_at", { ascending: false });
    setTransactions((data as MaterialTransaction[]) || []);
  }

  async function loadProjects() {
    const { data } = await supabase.from("projects_view").select("*").order("created_at", { ascending: false });
    const list = (data as ProjectView[]) || [];
    setProjects(list);
    if (list.length) {
      setTxForm((f) => (f.project_id ? f : { ...f, project_id: list[0].id }));
    }
  }

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (auth.user) {
        const { data: p } = await supabase.from("profiles").select("*").eq("id", auth.user.id).single();
        setProfile(p as Profile);
      }
      loadMaterials();
      loadTransactions();
      loadProjects();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (materials.length && !txForm.material_id) {
      setTxForm((f) => ({ ...f, material_id: materials[0].id }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [materials]);

  // Compute current stock per material: opening_stock + inward - consumption, across all projects.
  const stockByMaterial = useMemo(() => {
    const map: Record<string, number> = {};
    for (const m of materials) map[m.id] = m.opening_stock;
    for (const t of transactions) {
      if (!(t.material_id in map)) continue;
      if (t.type === "Inward") map[t.material_id] += Number(t.quantity);
      else map[t.material_id] -= Number(t.quantity);
    }
    return map;
  }, [materials, transactions]);

  function isLowStock(m: Material) {
    const current = stockByMaterial[m.id] ?? m.opening_stock;
    if (current <= 0) return "critical";
    if (m.opening_stock > 0 && current < m.opening_stock * 0.1) return "low";
    return null;
  }

  async function addMaterial() {
    if (!materialForm.name) return;
    await supabase.from("materials").insert({
      name: materialForm.name,
      unit: materialForm.unit,
      category: materialForm.category || null,
      opening_stock: Number(materialForm.opening_stock || 0),
    });
    setMaterialForm({ name: "", unit: UNITS[0], category: "", opening_stock: "" });
    setAddingMaterial(false);
    loadMaterials();
  }

  async function addTransaction() {
    if (!txForm.project_id || !txForm.material_id || !txForm.quantity) return;
    await supabase.from("material_transactions").insert({
      project_id: txForm.project_id,
      material_id: txForm.material_id,
      date: txForm.date,
      type: txForm.type,
      quantity: Number(txForm.quantity),
      reference: txForm.reference || null,
      remarks: txForm.remarks || null,
    });
    setTxForm((f) => ({ ...f, quantity: "", reference: "", remarks: "" }));
    setAddingTx(false);
    loadTransactions();
  }

  const materialName = (id: string) => materials.find((m) => m.id === id)?.name || "—";
  const materialUnit = (id: string) => materials.find((m) => m.id === id)?.unit || "";
  const projectName = (id: string) => projects.find((p) => p.id === id)?.name || "—";

  const filteredTx = transactions.filter((t) => selectedProject === "all" || t.project_id === selectedProject);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800 }}>Materials &amp; Stock</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button className={`btn ${tab === "master" ? "btn-acc" : "btn-ghost"}`} onClick={() => setTab("master")}>Master</button>
          <button className={`btn ${tab === "stock" ? "btn-acc" : "btn-ghost"}`} onClick={() => setTab("stock")}>Stock / Transactions</button>
        </div>
      </div>

      {tab === "master" && (
        <div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
            <button className="btn btn-acc" onClick={() => setAddingMaterial(!addingMaterial)}>
              <i className="ti ti-plus" /> Add Material
            </button>
          </div>

          {addingMaterial && (
            <div className="card fadeIn" style={{ padding: 18, marginBottom: 20 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10, marginBottom: 14 }}>
                <div>
                  <label style={{ fontSize: 11, color: "var(--t3)" }}>Name</label>
                  <input className="input" value={materialForm.name} onChange={(e) => setMaterialForm({ ...materialForm, name: e.target.value })} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "var(--t3)" }}>Unit</label>
                  <select className="input" value={materialForm.unit} onChange={(e) => setMaterialForm({ ...materialForm, unit: e.target.value })}>
                    {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "var(--t3)" }}>Category</label>
                  <input className="input" value={materialForm.category} onChange={(e) => setMaterialForm({ ...materialForm, category: e.target.value })} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "var(--t3)" }}>Opening Stock</label>
                  <input className="input" type="number" value={materialForm.opening_stock} onChange={(e) => setMaterialForm({ ...materialForm, opening_stock: e.target.value })} />
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-acc" onClick={addMaterial}>Save</button>
                <button className="btn btn-ghost" onClick={() => setAddingMaterial(false)}>Cancel</button>
              </div>
            </div>
          )}

          <div className="table-wrap card">
            <table className="dt">
              <thead>
                <tr>
                  <th>Name</th><th>Unit</th><th>Category</th><th>Opening Stock</th><th>Current Stock</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {materials.map((m) => {
                  const current = stockByMaterial[m.id] ?? m.opening_stock;
                  const low = isLowStock(m);
                  return (
                    <tr key={m.id}>
                      <td>{m.name}</td>
                      <td>{m.unit}</td>
                      <td>{m.category || "—"}</td>
                      <td>{m.opening_stock}</td>
                      <td>{current}</td>
                      <td>
                        {low === "critical" && (
                          <span className="badge" style={{ background: "rgba(239,68,68,0.15)", color: "var(--rd)" }}>Out of Stock</span>
                        )}
                        {low === "low" && (
                          <span className="badge" style={{ background: "rgba(251,191,36,0.15)", color: "var(--yl)" }}>Low Stock</span>
                        )}
                        {!low && (
                          <span className="badge" style={{ background: "rgba(16,185,129,0.15)", color: "var(--gr)" }}>OK</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {materials.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--t3)", padding: 24 }}>No materials yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "stock" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 8 }}>
            <select className="input" style={{ width: 240 }} value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)}>
              <option value="all">All projects</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <button className="btn btn-acc" onClick={() => setAddingTx(!addingTx)} disabled={materials.length === 0 || projects.length === 0}>
              <i className="ti ti-plus" /> Add Transaction
            </button>
          </div>

          {materials.length === 0 && (
            <div style={{ color: "var(--t3)", marginBottom: 12 }}>Add a material in the Master tab first.</div>
          )}

          {addingTx && (
            <div className="card fadeIn" style={{ padding: 18, marginBottom: 20 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10, marginBottom: 14 }}>
                <div>
                  <label style={{ fontSize: 11, color: "var(--t3)" }}>Project</label>
                  <select className="input" value={txForm.project_id} onChange={(e) => setTxForm({ ...txForm, project_id: e.target.value })}>
                    {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "var(--t3)" }}>Material</label>
                  <select className="input" value={txForm.material_id} onChange={(e) => setTxForm({ ...txForm, material_id: e.target.value })}>
                    {materials.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.unit})</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "var(--t3)" }}>Date</label>
                  <input className="input" type="date" value={txForm.date} onChange={(e) => setTxForm({ ...txForm, date: e.target.value })} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "var(--t3)" }}>Type</label>
                  <select className="input" value={txForm.type} onChange={(e) => setTxForm({ ...txForm, type: e.target.value as TxType })}>
                    <option value="Inward">Inward</option>
                    <option value="Consumption">Consumption</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "var(--t3)" }}>Quantity</label>
                  <input className="input" type="number" value={txForm.quantity} onChange={(e) => setTxForm({ ...txForm, quantity: e.target.value })} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "var(--t3)" }}>Reference</label>
                  <input className="input" value={txForm.reference} onChange={(e) => setTxForm({ ...txForm, reference: e.target.value })} />
                </div>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, color: "var(--t3)" }}>Remarks</label>
                <input className="input" value={txForm.remarks} onChange={(e) => setTxForm({ ...txForm, remarks: e.target.value })} />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-acc" onClick={addTransaction}>Save</button>
                <button className="btn btn-ghost" onClick={() => setAddingTx(false)}>Cancel</button>
              </div>
            </div>
          )}

          <div className="table-wrap card">
            <table className="dt">
              <thead>
                <tr>
                  <th>Date</th><th>Project</th><th>Material</th><th>Type</th><th>Quantity</th><th>Reference</th><th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {filteredTx.map((t) => (
                  <tr key={t.id}>
                    <td>{t.date}</td>
                    <td>{projectName(t.project_id)}</td>
                    <td>{materialName(t.material_id)}</td>
                    <td>
                      <span className="badge" style={{ background: t.type === "Inward" ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)", color: t.type === "Inward" ? "var(--gr)" : "var(--rd)" }}>
                        {t.type}
                      </span>
                    </td>
                    <td>{t.quantity} {materialUnit(t.material_id)}</td>
                    <td>{t.reference || "—"}</td>
                    <td>{t.remarks || "—"}</td>
                  </tr>
                ))}
                {filteredTx.length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign: "center", color: "var(--t3)", padding: 24 }}>No transactions yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
