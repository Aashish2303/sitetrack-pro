"use client";
import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/client";
import { canSeeFinance } from "@/lib/roles";
import type { Profile, Project, Indent, IndentItem, IndentQuotationView } from "@/lib/types";

const STATUS_COLOR: Record<string, string> = {
  "Pending Quotation": "var(--pu)",
  "MD Review": "var(--acc)",
  "Approved": "var(--gr)",
  "Rejected": "var(--rd)",
};

const ITEM_STATUS_COLOR: Record<string, string> = {
  Pending: "var(--t3)",
  Approved: "var(--gr)",
  Rejected: "var(--rd)",
  "On Hold": "var(--yl)",
};

const MAX_FILE_BYTES = 5 * 1024 * 1024;

function StatusBadge({ status, colorMap }: { status: string; colorMap: Record<string, string> }) {
  const c = colorMap[status] || "var(--t3)";
  return (
    <span className="badge" style={{ background: `${c}22`, color: c }}>
      {status}
    </span>
  );
}

export default function IndentDetailPage({ params }: { params: { id: string } }) {
  const supabase = useMemo(() => createClient(), []);
  const indentId = params.id;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [indent, setIndent] = useState<Indent | null>(null);
  const [items, setItems] = useState<IndentItem[]>([]);
  const [quotations, setQuotations] = useState<IndentQuotationView[]>([]);
  const [chosenIdx, setChosenIdx] = useState<number | null>(null);
  const [fileError, setFileError] = useState("");
  const [savingQuote, setSavingQuote] = useState(false);
  const [quoteForm, setQuoteForm] = useState({ vendor_name: "", rate: "", total: "", delivery_time: "", notes: "" });
  const [quoteFile, setQuoteFile] = useState<File | null>(null);

  async function loadAll() {
    const { data: ind } = await supabase.from("indents").select("*").eq("id", indentId).single();
    setIndent(ind as Indent);
    if (ind) {
      const { data: proj } = await supabase.from("projects").select("*").eq("id", (ind as Indent).project_id).single();
      setProject(proj as Project);
    }
    const { data: its } = await supabase.from("indent_items").select("*").eq("indent_id", indentId).order("material_name", { ascending: true });
    setItems((its as IndentItem[]) || []);
    const { data: qs } = await supabase.from("indent_quotations_view").select("*").eq("indent_id", indentId).order("created_at", { ascending: true });
    setQuotations((qs as IndentQuotationView[]) || []);
  }

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (auth.user) {
        const { data: p } = await supabase.from("profiles").select("*").eq("id", auth.user.id).single();
        setProfile(p as Profile);
      }
      await loadAll();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indentId]);

  const finance = canSeeFinance(profile?.role);
  const role = profile?.role;
  const canHold = role === "md" || role === "qms" || role === "admin";
  const canQuote = role === "sales" || role === "admin";
  const canReviewMd = (role === "md" || role === "admin") && !!indent && (indent.status === "MD Review" || indent.status === "Approved" || indent.status === "Rejected");

  const activeItems = items.filter((it) => it.item_status !== "On Hold" && it.item_status !== "Rejected");
  const activeQty = activeItems.reduce((sum, it) => sum + Number(it.quantity || 0), 0);

  async function toggleHold(item: IndentItem) {
    const next = item.item_status === "On Hold" ? "Pending" : "On Hold";
    await supabase.from("indent_items").update({ item_status: next }).eq("id", item.id);
    loadAll();
  }

  function onRateChange(rate: string) {
    const r = Number(rate) || 0;
    setQuoteForm((f) => ({ ...f, rate, total: String(Math.round(r * activeQty * 100) / 100) }));
  }

  async function submitQuotation() {
    if (!quoteForm.vendor_name || !quoteForm.rate) return;
    if (quoteFile && quoteFile.size > MAX_FILE_BYTES) {
      setFileError("File must be 5MB or smaller.");
      return;
    }
    setFileError("");
    setSavingQuote(true);
    try {
      let attached_file_url: string | null = null;
      let attached_file_name: string | null = null;
      if (quoteFile) {
        const path = `${indentId}/${crypto.randomUUID()}-${quoteFile.name}`;
        const { data: upload, error: upErr } = await supabase.storage.from("quotations").upload(path, quoteFile);
        if (upErr) {
          setFileError("File upload failed: " + upErr.message);
          setSavingQuote(false);
          return;
        }
        attached_file_url = upload?.path || path;
        attached_file_name = quoteFile.name;
      }

      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase.from("indent_quotations").insert({
        indent_id: indentId,
        vendor_name: quoteForm.vendor_name,
        rate: Number(quoteForm.rate),
        total: Number(quoteForm.total || 0),
        delivery_time: quoteForm.delivery_time || null,
        notes: quoteForm.notes || null,
        attached_file_url,
        attached_file_name,
        uploaded_by: auth.user?.id || null,
      });
      if (error) return;

      if (quotations.length + 1 >= 2 && indent?.status === "Pending Quotation") {
        await supabase.from("indents").update({ status: "MD Review" }).eq("id", indentId);
      }

      setQuoteForm({ vendor_name: "", rate: "", total: "", delivery_time: "", notes: "" });
      setQuoteFile(null);
      loadAll();
    } finally {
      setSavingQuote(false);
    }
  }

  async function viewFile(path: string | null) {
    if (!path) return;
    const { data, error } = await supabase.storage.from("quotations").createSignedUrl(path, 3600);
    if (!error && data?.signedUrl) window.open(data.signedUrl, "_blank");
  }

  const minTotal = quotations.reduce((min, q) => {
    if (q.total == null) return min;
    return min == null || q.total < min ? q.total : min;
  }, null as number | null);

  async function approveChosen() {
    if (chosenIdx == null) return;
    const now = Date.now().toString().slice(-6);
    await supabase.from("indents").update({
      status: "Approved",
      approved_idx: chosenIdx,
      po_number: `PO-${now}`,
      wo_number: `WO-${now}`,
    }).eq("id", indentId);
    loadAll();
  }

  async function rejectAll() {
    await supabase.from("indents").update({ status: "Rejected" }).eq("id", indentId);
    loadAll();
  }

  function downloadIndentExcel() {
    const rows = items.map((it) => ({
      Material: it.material_name,
      Qty: it.quantity,
      Unit: it.unit,
      Size: it.size || "",
      Category: it.category || "",
      Status: it.item_status,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Indent Items");
    XLSX.writeFile(wb, `indent-${indentId}.xlsx`);
  }

  function downloadPoWoExcel() {
    if (!indent || indent.approved_idx == null) return;
    const approvedQuote = quotations[indent.approved_idx];
    const header = [{
      "PO Number": indent.po_number || "",
      "WO Number": indent.wo_number || "",
      Vendor: approvedQuote?.vendor_name || "",
      "Delivery Time": approvedQuote?.delivery_time || "",
      "Approved By": profile?.name || "",
    }];
    const itemRows = items.map((it) => {
      const base: Record<string, unknown> = {
        Material: it.material_name,
        Qty: it.quantity,
        Unit: it.unit,
      };
      if (finance) {
        base["Rate"] = approvedQuote?.rate ?? "";
      }
      return base;
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(header), "PO-WO Summary");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(itemRows), "Items");
    XLSX.writeFile(wb, `po-wo-${indentId}.xlsx`);
  }

  if (!indent) return null;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>Indent — {project?.name || "—"}</h1>
          <p style={{ color: "var(--t3)", fontSize: 13 }}>
            {indent.date} · Engineer: {indent.engineer || "—"} · Urgency: {indent.urgency || "Normal"}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <StatusBadge status={indent.status} colorMap={STATUS_COLOR} />
          <button className="btn btn-ghost" onClick={downloadIndentExcel}><i className="ti ti-download" /> Download Indent (Excel)</button>
          {indent.status === "Approved" && (role === "sales" || role === "md" || role === "admin") && (
            <button className="btn btn-acc" onClick={downloadPoWoExcel}><i className="ti ti-download" /> Download PO &amp; WO (Excel)</button>
          )}
        </div>
      </div>

      <div className="card" style={{ padding: 16, marginBottom: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12 }}>
          <div><div style={{ fontSize: 11, color: "var(--t3)" }}>NOTES</div><div style={{ fontSize: 13 }}>{indent.notes || "—"}</div></div>
          <div><div style={{ fontSize: 11, color: "var(--t3)" }}>NOTE FOR APPROVAL</div><div style={{ fontSize: 13 }}>{indent.note_for_approval || "—"}</div></div>
          {indent.status === "Approved" && (
            <>
              <div><div style={{ fontSize: 11, color: "var(--t3)" }}>PO NUMBER</div><div style={{ fontSize: 13, fontWeight: 700, color: "var(--gr)" }}>{indent.po_number}</div></div>
              <div><div style={{ fontSize: 11, color: "var(--t3)" }}>WO NUMBER</div><div style={{ fontSize: 13, fontWeight: 700, color: "var(--gr)" }}>{indent.wo_number}</div></div>
            </>
          )}
        </div>
      </div>

      <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Items</h3>
      <div className="table-wrap card" style={{ marginBottom: 24 }}>
        <table className="dt">
          <thead>
            <tr>
              <th>Material</th><th>Qty</th><th>Unit</th><th>Size</th><th>Category</th><th>Status</th>
              {canHold && <th></th>}
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id} style={it.item_status === "On Hold" ? { opacity: 0.5, textDecoration: "line-through" } : undefined}>
                <td>{it.material_name}</td>
                <td>{it.quantity}</td>
                <td>{it.unit}</td>
                <td>{it.size || "—"}</td>
                <td>{it.category || "—"}</td>
                <td><StatusBadge status={it.item_status} colorMap={ITEM_STATUS_COLOR} /></td>
                {canHold && (
                  <td>
                    <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={() => toggleHold(it)}>
                      {it.item_status === "On Hold" ? "Release" : "Hold"}
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={canHold ? 7 : 6} style={{ textAlign: "center", color: "var(--t3)", padding: 24 }}>No items.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Quotations</h3>

      {canQuote && (
        <div className="card" style={{ padding: 16, marginBottom: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10, marginBottom: 10 }}>
            <div><label style={{ fontSize: 11, color: "var(--t3)" }}>Vendor Name</label><input className="input" value={quoteForm.vendor_name} onChange={(e) => setQuoteForm({ ...quoteForm, vendor_name: e.target.value })} /></div>
            <div><label style={{ fontSize: 11, color: "var(--t3)" }}>Rate (per unit)</label><input className="input" type="number" value={quoteForm.rate} onChange={(e) => onRateChange(e.target.value)} /></div>
            <div><label style={{ fontSize: 11, color: "var(--t3)" }}>Total (editable, suggested = rate × active qty)</label><input className="input" type="number" value={quoteForm.total} onChange={(e) => setQuoteForm({ ...quoteForm, total: e.target.value })} /></div>
            <div><label style={{ fontSize: 11, color: "var(--t3)" }}>Delivery Time</label><input className="input" value={quoteForm.delivery_time} onChange={(e) => setQuoteForm({ ...quoteForm, delivery_time: e.target.value })} /></div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 11, color: "var(--t3)" }}>Notes</label>
            <textarea className="input" rows={2} value={quoteForm.notes} onChange={(e) => setQuoteForm({ ...quoteForm, notes: e.target.value })} />
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 11, color: "var(--t3)" }}>Attach Quotation (PDF / Excel / image, max 5MB)</label>
            <input
              type="file"
              accept=".pdf,.xls,.xlsx,.csv,image/*"
              onChange={(e) => {
                const f = e.target.files?.[0] || null;
                setFileError(f && f.size > MAX_FILE_BYTES ? "File must be 5MB or smaller." : "");
                setQuoteFile(f);
              }}
            />
            {fileError && <div style={{ color: "var(--rd)", fontSize: 12, marginTop: 4 }}>{fileError}</div>}
          </div>
          <button className="btn btn-acc" onClick={submitQuotation} disabled={savingQuote || !!fileError}>
            {savingQuote ? "Saving..." : "Add Quotation"}
          </button>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 14, marginBottom: 24 }}>
        {quotations.map((q) => (
          <div key={q.id} className="card" style={{ padding: 14 }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>{q.vendor_name}</div>
            <div style={{ fontSize: 12, color: "var(--t3)", marginBottom: 2 }}>Rate: {q.rate != null ? "₹" + q.rate.toLocaleString("en-IN") : "—"}</div>
            <div style={{ fontSize: 12, color: "var(--t3)", marginBottom: 2 }}>Total: {q.total != null ? "₹" + q.total.toLocaleString("en-IN") : "—"}</div>
            <div style={{ fontSize: 12, color: "var(--t3)", marginBottom: 2 }}>Delivery: {q.delivery_time || "—"}</div>
            <div style={{ fontSize: 12, color: "var(--t3)", marginBottom: 8 }}>{q.notes || ""}</div>
            {q.attached_file_url && (
              <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => viewFile(q.attached_file_url)}>
                <i className="ti ti-file" /> View File
              </button>
            )}
          </div>
        ))}
        {quotations.length === 0 && <div style={{ color: "var(--t3)" }}>No quotations submitted yet.</div>}
      </div>

      {canReviewMd && (
        <div className="card" style={{ padding: 16, marginBottom: 24 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>MD Review &amp; Approval</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14, marginBottom: 14 }}>
            {quotations.map((q, idx) => (
              <div
                key={q.id}
                className="card"
                style={{
                  padding: 14,
                  border: chosenIdx === idx ? "2px solid var(--acc)" : "1px solid var(--br)",
                  position: "relative",
                }}
              >
                {q.total != null && minTotal != null && q.total === minTotal && (
                  <span className="badge" style={{ background: "var(--gr)22", color: "var(--gr)", position: "absolute", top: 10, right: 10 }}>
                    LOWEST
                  </span>
                )}
                <div style={{ fontWeight: 700, marginBottom: 4 }}>{q.vendor_name}</div>
                <div style={{ fontSize: 12, color: "var(--t3)" }}>Rate: {q.rate != null ? "₹" + q.rate.toLocaleString("en-IN") : "—"}</div>
                <div style={{ fontSize: 12, color: "var(--t3)" }}>Total: {q.total != null ? "₹" + q.total.toLocaleString("en-IN") : "—"}</div>
                <div style={{ fontSize: 12, color: "var(--t3)", marginBottom: 10 }}>Delivery: {q.delivery_time || "—"}</div>
                <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
                  <input type="radio" name="chosenQuote" checked={chosenIdx === idx} onChange={() => setChosenIdx(idx)} />
                  Choose this vendor
                </label>
              </div>
            ))}
            {quotations.length === 0 && <div style={{ color: "var(--t3)" }}>No quotations to review yet.</div>}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-acc" onClick={approveChosen} disabled={chosenIdx == null || indent.status === "Approved" || indent.status === "Rejected"}>
              Approve
            </button>
            <button className="btn btn-ghost" onClick={rejectAll} disabled={indent.status === "Approved" || indent.status === "Rejected"}>
              Reject All
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
