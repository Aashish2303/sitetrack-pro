"use client";
import { today } from "@/lib/date";
import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/client";
import type { Profile, ProjectView, VendorLedgerEntry, VendorLedgerType } from "@/lib/types";

const VENDOR_LEDGER_TYPES: VendorLedgerType[] = ["Purchase", "Advance", "Return", "Debit Note", "Credit Note"];

function pct(paid: number, invoice: number) {
  if (!invoice) return 0;
  return Math.min(100, Math.max(0, (paid / invoice) * 100));
}

export default function VendorLedgerPage() {
  const supabase = useMemo(() => createClient(), []);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [projects, setProjects] = useState<ProjectView[]>([]);
  const [selected, setSelected] = useState<string>("all");
  const [rows, setRows] = useState<VendorLedgerEntry[]>([]);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    project_id: "",
    vendor: "",
    date: today(),
    type: "Purchase" as VendorLedgerType,
    description: "",
    po_number: "",
    po_amount: "",
    invoice_amount: "",
    amount_paid: "",
    remarks: "",
  });

  useEffect(() => { const refresh = () => { loadRows(); }; window.addEventListener("st:refresh", refresh); return () => window.removeEventListener("st:refresh", refresh); });

  async function loadProjects() {
    const { data } = await supabase.from("projects_view").select("*").order("created_at", { ascending: false });
    const list = (data as ProjectView[]) || [];
    setProjects(list);
    if (list.length && !form.project_id) setForm((f) => ({ ...f, project_id: list[0].id }));
  }

  async function loadRows() {
    let q = supabase.from("vendor_ledger").select("*").order("date", { ascending: false }).order("created_at", { ascending: false });
    if (selected !== "all") q = q.eq("project_id", selected);
    const { data } = await q;
    setRows((data as VendorLedgerEntry[]) || []);
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

  const projectName = (id: string) => projects.find((p) => p.id === id)?.name || "—";

  async function save() {
    if (!form.project_id || !form.vendor) return;
    await supabase.from("vendor_ledger").insert({
      project_id: form.project_id,
      vendor: form.vendor,
      date: form.date,
      type: form.type,
      description: form.description || null,
      po_number: form.po_number || null,
      po_amount: Number(form.po_amount || 0),
      invoice_amount: Number(form.invoice_amount || 0),
      amount_paid: Number(form.amount_paid || 0),
      remarks: form.remarks || null,
      created_by: profile?.id || null,
    });
    setForm((f) => ({
      ...f,
      vendor: "",
      description: "",
      po_number: "",
      po_amount: "",
      invoice_amount: "",
      amount_paid: "",
      remarks: "",
    }));
    setAdding(false);
    loadRows();
  }

  // Per-vendor summary
  const summary = useMemo(() => {
    const groups: Record<string, { po: number; invoice: number; paid: number }> = {};
    for (const r of rows) {
      const g = groups[r.vendor] || { po: 0, invoice: 0, paid: 0 };
      g.po += Number(r.po_amount || 0);
      g.invoice += Number(r.invoice_amount || 0);
      g.paid += Number(r.amount_paid || 0);
      groups[r.vendor] = g;
    }
    return Object.entries(groups)
      .map(([name, g]) => ({ name, ...g, balance: g.invoice - g.paid, paidPct: pct(g.paid, g.invoice) }))
      .sort((a, b) => b.balance - a.balance);
  }, [rows]);

  function exportExcel() {
    const data = rows.map((r) => ({
      Date: r.date,
      Project: projectName(r.project_id),
      Vendor: r.vendor,
      Type: r.type,
      Description: r.description || "",
      "PO Number": r.po_number || "",
      "PO Amount": r.po_amount,
      "Invoice Amount": r.invoice_amount,
      "Amount Paid": r.amount_paid,
      Balance: Number(r.invoice_amount || 0) - Number(r.amount_paid || 0),
      Remarks: r.remarks || "",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Vendor Ledger");
    XLSX.writeFile(wb, "vendor-ledger.xlsx");
  }

  function diffBadge(invoice: number, po: number) {
    if (!po && !invoice) return <span style={{ color: "var(--t3)" }}>—</span>;
    if (invoice > po) {
      return (
        <span className="badge" style={{ background: "rgba(239,68,68,0.15)", color: "var(--rd)" }}>
          <i className="ti ti-arrow-up" /> Overrun
        </span>
      );
    }
    if (invoice < po) {
      return (
        <span className="badge" style={{ background: "rgba(16,185,129,0.15)", color: "var(--gr)" }}>
          <i className="ti ti-arrow-down" /> Under
        </span>
      );
    }
    return <span style={{ color: "var(--t3)" }}>—</span>;
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800 }}>Material Vendor Ledger</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <select className="input" style={{ width: 220 }} value={selected} onChange={(e) => setSelected(e.target.value)}>
            <option value="all">All projects</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button className="btn btn-ghost" onClick={exportExcel}>
            <i className="ti ti-file-spreadsheet" /> Export to Excel
          </button>
          <button className="btn btn-acc" onClick={() => setAdding(!adding)}>
            <i className="ti ti-plus" /> Add Entry
          </button>
        </div>
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
              <label style={{ fontSize: 11, color: "var(--t3)" }}>Vendor</label>
              <input className="input" value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--t3)" }}>Date</label>
              <input className="input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--t3)" }}>Type</label>
              <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as VendorLedgerType })}>
                {VENDOR_LEDGER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--t3)" }}>PO Number</label>
              <input className="input" value={form.po_number} onChange={(e) => setForm({ ...form, po_number: e.target.value })} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--t3)" }}>PO Amount</label>
              <input className="input" type="number" value={form.po_amount} onChange={(e) => setForm({ ...form, po_amount: e.target.value })} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--t3)" }}>Invoice Amount</label>
              <input className="input" type="number" value={form.invoice_amount} onChange={(e) => setForm({ ...form, invoice_amount: e.target.value })} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--t3)" }}>Amount Paid</label>
              <input className="input" type="number" value={form.amount_paid} onChange={(e) => setForm({ ...form, amount_paid: e.target.value })} />
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

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 14, marginBottom: 20 }}>
        {summary.map((s) => (
          <div key={s.name} className="card" style={{ padding: 16 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>{s.name}</div>
            <div style={{ fontSize: 12, color: "var(--t3)", display: "flex", justifyContent: "space-between" }}>
              <span>PO Value</span><span style={{ color: "var(--t1)" }}>₹{s.po.toLocaleString("en-IN")}</span>
            </div>
            <div style={{ fontSize: 12, color: "var(--t3)", display: "flex", justifyContent: "space-between" }}>
              <span>Invoiced</span><span style={{ color: "var(--t1)" }}>₹{s.invoice.toLocaleString("en-IN")}</span>
            </div>
            <div style={{ fontSize: 12, color: "var(--t3)", display: "flex", justifyContent: "space-between" }}>
              <span>Paid</span><span style={{ color: "var(--t1)" }}>₹{s.paid.toLocaleString("en-IN")}</span>
            </div>
            <div style={{ fontSize: 12, color: "var(--t3)", display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span>Balance</span>
              <span style={{ color: s.balance > 0 ? "var(--rd)" : "var(--gr)", fontWeight: 700 }}>₹{s.balance.toLocaleString("en-IN")}</span>
            </div>
            <div style={{ background: "var(--s2)", borderRadius: 6, height: 8, overflow: "hidden" }}>
              <div style={{ width: `${s.paidPct}%`, height: "100%", background: s.paidPct >= 80 ? "var(--gr)" : s.paidPct >= 50 ? "var(--yl)" : "var(--rd)" }} />
            </div>
            <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 6 }}>{s.paidPct.toFixed(1)}% paid</div>
          </div>
        ))}
        {summary.length === 0 && <div style={{ color: "var(--t3)" }}>No ledger entries yet.</div>}
      </div>

      <div className="table-wrap card">
        <table className="dt">
          <thead>
            <tr>
              <th>Date</th><th>Project</th><th>Vendor</th><th>Type</th><th>Description</th>
              <th>PO No.</th><th>PO Amount</th><th>Invoice Amount</th><th>Diff</th><th>Amount Paid</th><th>Balance</th><th>Remarks</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.date}</td>
                <td>{projectName(r.project_id)}</td>
                <td>{r.vendor}</td>
                <td>{r.type}</td>
                <td>{r.description || "—"}</td>
                <td>{r.po_number || "—"}</td>
                <td>₹{Number(r.po_amount || 0).toLocaleString("en-IN")}</td>
                <td>₹{Number(r.invoice_amount || 0).toLocaleString("en-IN")}</td>
                <td>{diffBadge(Number(r.invoice_amount || 0), Number(r.po_amount || 0))}</td>
                <td>₹{Number(r.amount_paid || 0).toLocaleString("en-IN")}</td>
                <td>₹{(Number(r.invoice_amount || 0) - Number(r.amount_paid || 0)).toLocaleString("en-IN")}</td>
                <td>{r.remarks || "—"}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={12} style={{ textAlign: "center", color: "var(--t3)", padding: 24 }}>No ledger entries yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
