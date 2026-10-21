"use client";
import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/client";
import { VENDOR_CATEGORIES } from "@/lib/roles";
import type { Profile, Vendor } from "@/lib/types";

const MAX_FILE_BYTES = 3 * 1024 * 1024;

export default function VendorDbPage() {
  const supabase = useMemo(() => createClient(), []);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    vendor_name: "",
    company_name: "",
    mobile: "",
    alt_contact: "",
    category: VENDOR_CATEGORIES[0],
    location: "",
    material_type: "",
    remarks: "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Vendor>>({});

  async function loadVendors() {
    try {
      const { data, error } = await supabase.from("vendors").select("*").order("vendor_name", { ascending: true });
      if (error) {
        setVendors([]);
        return;
      }
      setVendors((data as Vendor[]) || []);
    } catch {
      setVendors([]);
    }
  }

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (auth.user) {
        const { data: p } = await supabase.from("profiles").select("*").eq("id", auth.user.id).single();
        setProfile(p as Profile);
      }
      loadVendors();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] || null;
    setFileError("");
    if (f && f.size > MAX_FILE_BYTES) {
      setFileError("File too large — max 3MB.");
      setFile(null);
      return;
    }
    setFile(f);
  }

  async function addVendor() {
    if (!form.vendor_name || fileError) return;
    setSaving(true);
    try {
      let visiting_card_url: string | null = null;
      if (file) {
        const { data, error } = await supabase.storage.from("visiting-cards").upload(`${crypto.randomUUID()}-${file.name}`, file);
        if (!error && data) visiting_card_url = data.path;
      }
      await supabase.from("vendors").insert({
        vendor_name: form.vendor_name,
        company_name: form.company_name || null,
        mobile: form.mobile || null,
        alt_contact: form.alt_contact || null,
        category: form.category || null,
        location: form.location || null,
        material_type: form.material_type || null,
        remarks: form.remarks || null,
        visiting_card_url,
        created_by: profile?.id || null,
      });
      setForm({ vendor_name: "", company_name: "", mobile: "", alt_contact: "", category: VENDOR_CATEGORIES[0], location: "", material_type: "", remarks: "" });
      setFile(null);
      setAdding(false);
      loadVendors();
    } finally {
      setSaving(false);
    }
  }

  function startEdit(v: Vendor) {
    setEditingId(v.id);
    setEditForm({ ...v });
  }

  async function saveEdit() {
    if (!editingId) return;
    const { id, visiting_card_url, ...rest } = editForm as Vendor;
    await supabase.from("vendors").update(rest).eq("id", editingId);
    setEditingId(null);
    setEditForm({});
    loadVendors();
  }

  async function deleteVendor(id: string) {
    if (!window.confirm("Delete this vendor? This cannot be undone.")) return;
    await supabase.from("vendors").delete().eq("id", id);
    loadVendors();
  }

  async function viewCard(path: string) {
    const { data, error } = await supabase.storage.from("visiting-cards").createSignedUrl(path, 3600);
    if (!error && data?.signedUrl) window.open(data.signedUrl, "_blank");
  }

  const filtered = vendors.filter((v) => {
    if (categoryFilter !== "all" && v.category !== categoryFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (v.vendor_name || "").toLowerCase().includes(q) ||
      (v.company_name || "").toLowerCase().includes(q) ||
      (v.mobile || "").toLowerCase().includes(q) ||
      (v.material_type || "").toLowerCase().includes(q)
    );
  });

  function exportExcel() {
    const rows = filtered.map((v) => ({
      "Vendor Name": v.vendor_name,
      "Company Name": v.company_name || "",
      Mobile: v.mobile || "",
      "Alt Contact": v.alt_contact || "",
      Category: v.category || "",
      Location: v.location || "",
      "Material Type": v.material_type || "",
      Remarks: v.remarks || "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Vendors");
    XLSX.writeFile(wb, "vendor-directory.xlsx");
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800 }}>Vendor Directory</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-ghost" onClick={exportExcel}><i className="ti ti-file-spreadsheet" /> Export to Excel</button>
          <button className="btn btn-acc" onClick={() => setAdding(!adding)}><i className="ti ti-plus" /> Add Vendor</button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <input className="input" style={{ maxWidth: 320 }} placeholder="Search by name, company, mobile or material..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="input" style={{ width: 200 }} value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          <option value="all">All categories</option>
          {VENDOR_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {adding && (
        <div className="card fadeIn" style={{ padding: 18, marginBottom: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10, marginBottom: 14 }}>
            <div>
              <label style={{ fontSize: 11, color: "var(--t3)" }}>Vendor Name</label>
              <input className="input" value={form.vendor_name} onChange={(e) => setForm({ ...form, vendor_name: e.target.value })} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--t3)" }}>Company Name</label>
              <input className="input" value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--t3)" }}>Mobile</label>
              <input className="input" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--t3)" }}>Alt Contact</label>
              <input className="input" value={form.alt_contact} onChange={(e) => setForm({ ...form, alt_contact: e.target.value })} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--t3)" }}>Category</label>
              <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {VENDOR_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--t3)" }}>Location</label>
              <input className="input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--t3)" }}>Material Type</label>
              <input className="input" value={form.material_type} onChange={(e) => setForm({ ...form, material_type: e.target.value })} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--t3)" }}>Visiting Card (max 3MB)</label>
              <input className="input" type="file" accept="image/*,.pdf" onChange={onFileChange} />
              {fileError && <div style={{ color: "var(--rd)", fontSize: 11, marginTop: 4 }}>{fileError}</div>}
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, color: "var(--t3)" }}>Remarks</label>
            <input className="input" value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-acc" onClick={addVendor} disabled={saving}>{saving ? "Saving..." : "Save"}</button>
            <button className="btn btn-ghost" onClick={() => setAdding(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="table-wrap card">
        <table className="dt">
          <thead>
            <tr>
              <th>Vendor</th><th>Company</th><th>Mobile</th><th>Alt Contact</th><th>Category</th>
              <th>Location</th><th>Material Type</th><th>Remarks</th><th>Card</th><th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((v) => {
              const editing = editingId === v.id;
              return (
                <tr key={v.id}>
                  {editing ? (
                    <>
                      <td><input className="input" value={editForm.vendor_name || ""} onChange={(e) => setEditForm({ ...editForm, vendor_name: e.target.value })} /></td>
                      <td><input className="input" value={editForm.company_name || ""} onChange={(e) => setEditForm({ ...editForm, company_name: e.target.value })} /></td>
                      <td><input className="input" value={editForm.mobile || ""} onChange={(e) => setEditForm({ ...editForm, mobile: e.target.value })} /></td>
                      <td><input className="input" value={editForm.alt_contact || ""} onChange={(e) => setEditForm({ ...editForm, alt_contact: e.target.value })} /></td>
                      <td>
                        <select className="input" value={editForm.category || ""} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}>
                          {VENDOR_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </td>
                      <td><input className="input" value={editForm.location || ""} onChange={(e) => setEditForm({ ...editForm, location: e.target.value })} /></td>
                      <td><input className="input" value={editForm.material_type || ""} onChange={(e) => setEditForm({ ...editForm, material_type: e.target.value })} /></td>
                      <td><input className="input" value={editForm.remarks || ""} onChange={(e) => setEditForm({ ...editForm, remarks: e.target.value })} /></td>
                      <td>{v.visiting_card_url ? <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={() => viewCard(v.visiting_card_url!)}>View Card</button> : "—"}</td>
                      <td style={{ display: "flex", gap: 6 }}>
                        <button className="btn btn-acc" style={{ fontSize: 11 }} onClick={saveEdit}>Save</button>
                        <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={() => { setEditingId(null); setEditForm({}); }}>Cancel</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td>{v.vendor_name}</td>
                      <td>{v.company_name || "—"}</td>
                      <td>{v.mobile ? <a href={`tel:${v.mobile}`} style={{ color: "var(--acc)" }}>{v.mobile}</a> : "—"}</td>
                      <td>{v.alt_contact || "—"}</td>
                      <td>{v.category || "—"}</td>
                      <td>{v.location || "—"}</td>
                      <td>{v.material_type || "—"}</td>
                      <td>{v.remarks || "—"}</td>
                      <td>{v.visiting_card_url ? <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={() => viewCard(v.visiting_card_url!)}>View Card</button> : "—"}</td>
                      <td style={{ display: "flex", gap: 6 }}>
                        <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={() => startEdit(v)}><i className="ti ti-edit" /></button>
                        <button className="btn btn-ghost" style={{ fontSize: 11, color: "var(--rd)" }} onClick={() => deleteVendor(v.id)}><i className="ti ti-trash" /></button>
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={10} style={{ textAlign: "center", color: "var(--t3)", padding: 24 }}>No vendors.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
