"use client";
import { today } from "@/lib/date";
import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { canSeeFinance, UNITS } from "@/lib/roles";
import type { MaterialOrderDelivery, MaterialOrderView, Profile, ProjectView } from "@/lib/types";

export default function OrdersPage() {
  const supabase = useMemo(() => createClient(), []);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [projects, setProjects] = useState<ProjectView[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const [orders, setOrders] = useState<MaterialOrderView[]>([]);
  const [deliveries, setDeliveries] = useState<Record<string, MaterialOrderDelivery[]>>({});
  const [expanded, setExpanded] = useState<string | null>(null);

  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    project_id: "",
    vendor: "",
    material: "",
    date: today(),
    po_number: "",
    ordered_qty: "",
    unit: UNITS[0],
    rate: "",
    remarks: "",
  });

  const [deliveryForm, setDeliveryForm] = useState({ date: today(), delivered_qty: "", dc_number: "" });

  const finance = canSeeFinance(profile?.role);

  useEffect(() => { const refresh = () => { loadOrders(); }; window.addEventListener("st:refresh", refresh); return () => window.removeEventListener("st:refresh", refresh); });

  async function loadProjects() {
    const { data } = await supabase.from("projects_view").select("*").order("created_at", { ascending: false });
    const list = (data as ProjectView[]) || [];
    setProjects(list);
    if (list.length) setForm((f) => (f.project_id ? f : { ...f, project_id: list[0].id }));
  }

  async function loadOrders() {
    let q = supabase.from("material_orders_view").select("*").order("date", { ascending: false });
    if (selectedProject !== "all") q = q.eq("project_id", selectedProject);
    const { data } = await q;
    setOrders((data as MaterialOrderView[]) || []);
  }

  async function loadDeliveries(orderId: string) {
    const { data } = await supabase.from("material_order_deliveries").select("*").eq("order_id", orderId).order("date", { ascending: false });
    setDeliveries((d) => ({ ...d, [orderId]: (data as MaterialOrderDelivery[]) || [] }));
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
    loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProject]);

  const projectName = (id: string) => projects.find((p) => p.id === id)?.name || "—";

  async function createOrder() {
    if (!form.project_id || !form.vendor || !form.material || !form.ordered_qty) return;
    await supabase.from("material_orders").insert({
      project_id: form.project_id,
      vendor: form.vendor,
      material: form.material,
      date: form.date,
      po_number: form.po_number || null,
      ordered_qty: Number(form.ordered_qty),
      unit: form.unit,
      rate: finance ? Number(form.rate || 0) : 0,
      pay_status: "Pending",
      remarks: form.remarks || null,
      created_by: profile?.id || null,
    });
    setForm((f) => ({ ...f, vendor: "", material: "", po_number: "", ordered_qty: "", rate: "", remarks: "" }));
    setAdding(false);
    loadOrders();
  }

  async function setPayStatus(id: string, pay_status: string) {
    await supabase.from("material_orders").update({ pay_status }).eq("id", id);
    loadOrders();
  }

  function toggleExpand(order: MaterialOrderView) {
    if (expanded === order.id) {
      setExpanded(null);
      return;
    }
    setExpanded(order.id);
    setDeliveryForm({ date: today(), delivered_qty: "", dc_number: "" });
    if (!deliveries[order.id]) loadDeliveries(order.id);
  }

  async function addDelivery(order: MaterialOrderView) {
    if (!deliveryForm.delivered_qty) return;
    if (order.pending_qty <= 0) return; // guard: no over-delivery
    const qty = Number(deliveryForm.delivered_qty);
    if(qty<=0 || qty>order.pending_qty) return window.dispatchEvent(new CustomEvent('st:notice',{detail:{message:'Enter a positive quantity within the pending balance.',error:true}}));
    await supabase.from("material_order_deliveries").insert({
      order_id: order.id,
      date: deliveryForm.date,
      delivered_qty: qty,
      dc_number: deliveryForm.dc_number || null,
    });
    setDeliveryForm({ date: today(), delivered_qty: "", dc_number: "" });
    await loadDeliveries(order.id);
    await loadOrders();
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800 }}>Material Orders</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <select className="input" style={{ width: 220 }} value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)}>
            <option value="all">All projects</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button className="btn btn-acc" onClick={() => setAdding(!adding)} disabled={projects.length === 0}>
            <i className="ti ti-plus" /> New Order
          </button>
        </div>
      </div>

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
              <label style={{ fontSize: 11, color: "var(--t3)" }}>Vendor</label>
              <input className="input" value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--t3)" }}>Material</label>
              <input className="input" value={form.material} onChange={(e) => setForm({ ...form, material: e.target.value })} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--t3)" }}>Date</label>
              <input className="input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--t3)" }}>PO Number</label>
              <input className="input" value={form.po_number} onChange={(e) => setForm({ ...form, po_number: e.target.value })} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--t3)" }}>Ordered Qty</label>
              <input className="input" type="number" value={form.ordered_qty} onChange={(e) => setForm({ ...form, ordered_qty: e.target.value })} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--t3)" }}>Unit</label>
              <select className="input" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
                {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            {finance && (
              <div>
                <label style={{ fontSize: 11, color: "var(--t3)" }}>Rate</label>
                <input className="input" type="number" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} />
              </div>
            )}
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, color: "var(--t3)" }}>Remarks</label>
            <input className="input" value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-acc" onClick={createOrder}>Save</button>
            <button className="btn btn-ghost" onClick={() => setAdding(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="table-wrap card">
        <table className="dt">
          <thead>
            <tr>
              <th>Project</th><th>Vendor</th><th>Material</th><th>PO No.</th>
              <th>Ordered Qty</th><th>Received Qty</th><th>Pending Qty</th>
              <th>Received %</th><th>Billing Status</th><th>Pay Status</th>
              {finance && <th>Rate</th>}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <React.Fragment key={o.id}>
                <tr>
                  <td>{projectName(o.project_id)}</td>
                  <td>{o.vendor}</td>
                  <td>{o.material}</td>
                  <td>{o.po_number || "—"}</td>
                  <td>{o.ordered_qty} {o.unit}</td>
                  <td>{o.received_qty} {o.unit}</td>
                  <td>{o.pending_qty} {o.unit}</td>
                  <td>{(100 * o.received_qty / o.ordered_qty).toFixed(1)}%</td><td>
                    <span className="badge" style={{ background: o.billing_status === "Complete" ? "rgba(16,185,129,0.15)" : "rgba(251,191,36,0.15)", color: o.billing_status === "Complete" ? "var(--gr)" : "var(--yl)" }}>
                      {o.billing_status}
                    </span>
                  </td>
                  <td>
                    <select className="input" style={{ width: "auto", padding: "2px 8px", fontSize: 11 }} value={o.pay_status} onChange={(e) => setPayStatus(o.id, e.target.value)}>
                      <option>Pending</option><option>Partial</option><option>Paid</option>
                    </select>
                  </td>
                  {finance && <td>{o.rate != null ? "₹" + o.rate.toLocaleString("en-IN") : "—"}</td>}
                  <td>
                    <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={() => toggleExpand(o)}>
                      {expanded === o.id ? "Hide" : "Deliveries"}
                    </button>
                  </td>
                </tr>
                {expanded === o.id && (
                  <tr>
                    <td colSpan={finance ? 10 : 9} style={{ background: "var(--s2)" }}>
                      <div style={{ padding: 12 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: "var(--t2)" }}>Delivery History</div>
                        <table className="dt" style={{ marginBottom: 12 }}>
                          <thead>
                            <tr><th>Date</th><th>Delivered Qty</th><th>DC Number</th></tr>
                          </thead>
                          <tbody>
                            {(deliveries[o.id] || []).map((d) => (
                              <tr key={d.id}>
                                <td>{d.date}</td>
                                <td>{d.delivered_qty} {o.unit}</td>
                                <td>{d.dc_number || "—"}</td>
                              </tr>
                            ))}
                            {(deliveries[o.id] || []).length === 0 && (
                              <tr><td colSpan={3} style={{ textAlign: "center", color: "var(--t3)", padding: 12 }}>No deliveries recorded yet.</td></tr>
                            )}
                          </tbody>
                        </table>

                        {o.pending_qty <= 0 ? (
                          <div style={{ color: "var(--gr)", fontWeight: 600, fontSize: 13 }}>
                            <i className="ti ti-circle-check" /> Order fully delivered ✓
                          </div>
                        ) : (
                          <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
                            <div>
                              <label style={{ fontSize: 11, color: "var(--t3)" }}>Date</label>
                              <input className="input" type="date" value={deliveryForm.date} onChange={(e) => setDeliveryForm({ ...deliveryForm, date: e.target.value })} />
                            </div>
                            <div>
                              <label style={{ fontSize: 11, color: "var(--t3)" }}>Delivered Qty (max {o.pending_qty})</label>
                              <input className="input" type="number" style={{ width: 120 }} value={deliveryForm.delivered_qty} onChange={(e) => setDeliveryForm({ ...deliveryForm, delivered_qty: e.target.value })} />
                            </div>
                            <div>
                              <label style={{ fontSize: 11, color: "var(--t3)" }}>DC Number</label>
                              <input className="input" value={deliveryForm.dc_number} onChange={(e) => setDeliveryForm({ ...deliveryForm, dc_number: e.target.value })} />
                            </div>
                            <button className="btn btn-acc" onClick={() => addDelivery(o)}>Record Delivery</button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
            {orders.length === 0 && (
              <tr><td colSpan={finance ? 10 : 9} style={{ textAlign: "center", color: "var(--t3)", padding: 24 }}>No orders yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
