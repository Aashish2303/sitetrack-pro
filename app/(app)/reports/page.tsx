"use client";
import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { createClient } from "@/lib/supabase/client";
import { canSeeFinance } from "@/lib/roles";
import type {
  BoqItemView,
  DprEntry,
  DwrEntry,
  Issue,
  LabourCategoryView,
  LabourEntry,
  Material,
  MaterialTransaction,
  Profile,
  ProjectView,
  WorkStatus,
} from "@/lib/types";

const WORK_STATUSES: WorkStatus[] = ["Completed", "Partial", "Delayed - Carry Forward", "Cancelled", "Not Started"];
const ISSUE_STATUSES = ["Open", "In Progress", "Resolved", "Closed"];
const ISSUE_PRIORITIES = ["Low", "Medium", "High", "Critical"];

type WorkSummary = { total: number; byStatus: Record<string, number> };
type ProgressSummary = { overallPct: number; green: number; amber: number; red: number; itemCount: number };
type LabourSummary = { totalWorkers: number; male: number; female: number; totalCost: number | null };
type IssuesSummary = { byStatus: Record<string, number>; byPriority: Record<string, number> };
type MaterialRow = { name: string; unit: string; stock: number };

export default function ReportsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [projects, setProjects] = useState<ProjectView[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const [workSummary, setWorkSummary] = useState<WorkSummary | null>(null);
  const [progressSummary, setProgressSummary] = useState<ProgressSummary | null>(null);
  const [labourSummary, setLabourSummary] = useState<LabourSummary | null>(null);
  const [issuesSummary, setIssuesSummary] = useState<IssuesSummary | null>(null);
  const [materialRows, setMaterialRows] = useState<MaterialRow[]>([]);

  const finance = canSeeFinance(profile?.role);

  async function loadProjects() {
    const { data } = await supabase.from("projects_view").select("*").order("created_at", { ascending: false });
    setProjects((data as ProjectView[]) || []);
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

  async function loadAll() {
    setLoading(true);

    // ---- Work Summary (dwr_entries + dpr_entries) ----
    try {
      let dwrQ = supabase.from("dwr_entries").select("*");
      let dprQ = supabase.from("dpr_entries").select("*");
      if (selectedProject !== "all") {
        dwrQ = dwrQ.eq("project_id", selectedProject);
        dprQ = dprQ.eq("project_id", selectedProject);
      }
      if (fromDate) { dwrQ = dwrQ.gte("date", fromDate); dprQ = dprQ.gte("date", fromDate); }
      if (toDate) { dwrQ = dwrQ.lte("date", toDate); dprQ = dprQ.lte("date", toDate); }
      const [{ data: dwrData }, { data: dprData }] = await Promise.all([dwrQ, dprQ]);
      const dwr = (dwrData as DwrEntry[]) || [];
      const dpr = (dprData as DprEntry[]) || [];
      const byStatus: Record<string, number> = {};
      WORK_STATUSES.forEach((s) => (byStatus[s] = 0));
      [...dwr, ...dpr].forEach((e) => {
        if (e.work_status && byStatus[e.work_status] !== undefined) byStatus[e.work_status]++;
      });
      setWorkSummary({ total: dwr.length + dpr.length, byStatus });
    } catch {
      setWorkSummary(null);
    }

    // ---- Progress Summary (boq_items_view) ----
    try {
      let bq = supabase.from("boq_items_view").select("*");
      if (selectedProject !== "all") bq = bq.eq("project_id", selectedProject);
      const { data } = await bq;
      const items = (data as BoqItemView[]) || [];
      const sumBoq = items.reduce((a, i) => a + Number(i.boq_qty || 0), 0);
      const sumDone = items.reduce((a, i) => a + Number(i.cum_done || 0), 0);
      const overallPct = sumBoq > 0 ? (sumDone / sumBoq) * 100 : 0;
      let green = 0, amber = 0, red = 0;
      items.forEach((i) => {
        const p = Number(i.progress_pct || 0);
        if (p >= 80) green++;
        else if (p >= 50) amber++;
        else red++;
      });
      setProgressSummary({ overallPct, green, amber, red, itemCount: items.length });
    } catch {
      setProgressSummary(null);
    }

    // ---- Labour Summary ----
    try {
      let leQ = supabase.from("labour_entries").select("*");
      if (selectedProject !== "all") leQ = leQ.eq("project_id", selectedProject);
      if (fromDate) leQ = leQ.gte("date", fromDate);
      if (toDate) leQ = leQ.lte("date", toDate);
      const { data: leData } = await leQ;
      const entries = (leData as LabourEntry[]) || [];
      const ids = entries.map((e) => e.id);
      let male = 0, female = 0, totalCost = 0;
      if (ids.length) {
        const { data: catData } = await supabase.from("labour_categories_view").select("*").in("labour_entry_id", ids);
        const cats = (catData as LabourCategoryView[]) || [];
        cats.forEach((c) => {
          male += Number(c.male_count || 0);
          female += Number(c.female_count || 0);
          totalCost += Number(c.row_cost || 0);
        });
      }
      setLabourSummary({ totalWorkers: male + female, male, female, totalCost: finance ? totalCost : null });
    } catch {
      setLabourSummary(null);
    }

    // ---- Issues Summary ----
    try {
      let iq = supabase.from("issues").select("*");
      if (selectedProject !== "all") iq = iq.eq("project_id", selectedProject);
      if (fromDate) iq = iq.gte("date", fromDate);
      if (toDate) iq = iq.lte("date", toDate);
      const { data } = await iq;
      const issues = (data as Issue[]) || [];
      const byStatus: Record<string, number> = {};
      ISSUE_STATUSES.forEach((s) => (byStatus[s] = 0));
      const byPriority: Record<string, number> = {};
      ISSUE_PRIORITIES.forEach((p) => (byPriority[p] = 0));
      issues.forEach((i) => {
        if (byStatus[i.status] !== undefined) byStatus[i.status]++;
        if (byPriority[i.priority] !== undefined) byPriority[i.priority]++;
      });
      setIssuesSummary({ byStatus, byPriority });
    } catch {
      setIssuesSummary(null);
    }

    // ---- Material Summary ----
    try {
      let mtq = supabase.from("material_transactions").select("*");
      if (selectedProject !== "all") mtq = mtq.eq("project_id", selectedProject);
      if (fromDate) mtq = mtq.gte("date", fromDate);
      if (toDate) mtq = mtq.lte("date", toDate);
      const { data: mtData } = await mtq;
      const inRangeTxns = (mtData as MaterialTransaction[]) || [];
      const materialIds = Array.from(new Set(inRangeTxns.map((t) => t.material_id)));
      if (materialIds.length) {
        const { data: matData } = await supabase.from("materials").select("*").in("id", materialIds);
        const materials = (matData as Material[]) || [];

        // Current stock reflects ALL transactions for this material (optionally scoped to the
        // selected project), not just ones inside the date range — the date range only decides
        // which materials are "active" enough to show.
        let allTxQ = supabase.from("material_transactions").select("*").in("material_id", materialIds);
        if (selectedProject !== "all") allTxQ = allTxQ.eq("project_id", selectedProject);
        const { data: allTxData } = await allTxQ;
        const allTx = (allTxData as MaterialTransaction[]) || [];

        const rows: MaterialRow[] = materials.map((m) => {
          const txns = allTx.filter((t) => t.material_id === m.id);
          const inward = txns.filter((t) => t.type === "Inward").reduce((a, t) => a + Number(t.quantity || 0), 0);
          const consumed = txns.filter((t) => t.type === "Consumption").reduce((a, t) => a + Number(t.quantity || 0), 0);
          return { name: m.name, unit: m.unit, stock: Number(m.opening_stock || 0) + inward - consumed };
        });
        setMaterialRows(rows.sort((a, b) => a.name.localeCompare(b.name)));
      } else {
        setMaterialRows([]);
      }
    } catch {
      setMaterialRows([]);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProject, fromDate, toDate, profile]);

  const projectLabel = selectedProject === "all" ? "All Projects" : projects.find((p) => p.id === selectedProject)?.name || "—";

  function exportExcel() {
    const wb = XLSX.utils.book_new();

    const workRows = workSummary
      ? [{ "Total Entries": workSummary.total }, ...WORK_STATUSES.map((s) => ({ Status: s, Count: workSummary.byStatus[s] }))]
      : [];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(workRows), "Work Summary");

    const progressRows = progressSummary
      ? [
          { Metric: "Overall Progress %", Value: progressSummary.overallPct.toFixed(1) },
          { Metric: "Items >=80% (Green)", Value: progressSummary.green },
          { Metric: "Items 50-79% (Amber)", Value: progressSummary.amber },
          { Metric: "Items <50% (Red)", Value: progressSummary.red },
        ]
      : [];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(progressRows), "Progress Summary");

    const labourRows = labourSummary
      ? [
          { Metric: "Total Workers", Value: labourSummary.totalWorkers },
          { Metric: "Male", Value: labourSummary.male },
          { Metric: "Female", Value: labourSummary.female },
          ...(labourSummary.totalCost != null ? [{ Metric: "Total Labour Cost", Value: labourSummary.totalCost }] : []),
        ]
      : [];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(labourRows), "Labour Summary");

    const issuesRows = issuesSummary
      ? [
          ...ISSUE_STATUSES.map((s) => ({ Section: "Status", Key: s, Count: issuesSummary.byStatus[s] })),
          ...ISSUE_PRIORITIES.map((p) => ({ Section: "Priority", Key: p, Count: issuesSummary.byPriority[p] })),
        ]
      : [];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(issuesRows), "Issues Summary");

    const materialSheetRows = materialRows.map((m) => ({ Material: m.name, Unit: m.unit, "Current Stock": m.stock }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(materialSheetRows), "Material Summary");

    XLSX.writeFile(wb, "qms-report.xlsx");
  }

  function exportPdf() {
    const doc = new jsPDF();
    let first = true;

    function sectionTitle(title: string) {
      if (!first) doc.addPage();
      first = false;
      doc.setFontSize(14);
      doc.text(title, 14, 16);
      doc.setFontSize(10);
      doc.text(`Project: ${projectLabel}  |  Range: ${fromDate || "—"} to ${toDate || "—"}`, 14, 22);
    }

    sectionTitle("Work Summary");
    autoTable(doc, {
      startY: 28,
      head: [["Status", "Count"]],
      body: workSummary ? WORK_STATUSES.map((s) => [s, String(workSummary.byStatus[s])]) : [["No data", ""]],
    });

    sectionTitle("Progress Summary");
    autoTable(doc, {
      startY: 28,
      head: [["Metric", "Value"]],
      body: progressSummary
        ? [
            ["Overall Progress %", progressSummary.overallPct.toFixed(1)],
            ["Items >=80% (Green)", String(progressSummary.green)],
            ["Items 50-79% (Amber)", String(progressSummary.amber)],
            ["Items <50% (Red)", String(progressSummary.red)],
          ]
        : [["No data", ""]],
    });

    sectionTitle("Labour Summary");
    autoTable(doc, {
      startY: 28,
      head: [["Metric", "Value"]],
      body: labourSummary
        ? [
            ["Total Workers", String(labourSummary.totalWorkers)],
            ["Male", String(labourSummary.male)],
            ["Female", String(labourSummary.female)],
            ...(labourSummary.totalCost != null ? [["Total Labour Cost", "₹" + labourSummary.totalCost.toLocaleString("en-IN")]] : []),
          ]
        : [["No data", ""]],
    });

    sectionTitle("Issues Summary");
    autoTable(doc, {
      startY: 28,
      head: [["Category", "Key", "Count"]],
      body: issuesSummary
        ? [
            ...ISSUE_STATUSES.map((s) => ["Status", s, String(issuesSummary.byStatus[s])]),
            ...ISSUE_PRIORITIES.map((p) => ["Priority", p, String(issuesSummary.byPriority[p])]),
          ]
        : [["No data", "", ""]],
    });

    sectionTitle("Material Summary");
    autoTable(doc, {
      startY: 28,
      head: [["Material", "Unit", "Current Stock"]],
      body: materialRows.length ? materialRows.map((m) => [m.name, m.unit, String(m.stock)]) : [["No data", "", ""]],
    });

    doc.save("qms-report.pdf");
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800 }}>QMS Reports</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-ghost" onClick={exportExcel}>
            <i className="ti ti-file-spreadsheet" /> Export to Excel
          </button>
          <button className="btn btn-ghost" onClick={exportPdf}>
            <i className="ti ti-file-type-pdf" /> Export to PDF
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: 14, marginBottom: 20, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div>
          <label style={{ fontSize: 11, color: "var(--t3)" }}>Project</label>
          <select className="input" style={{ width: 220 }} value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)}>
            <option value="all">All projects</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 11, color: "var(--t3)" }}>From</label>
          <input className="input" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        </div>
        <div>
          <label style={{ fontSize: 11, color: "var(--t3)" }}>To</label>
          <input className="input" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </div>
        {(fromDate || toDate) && (
          <button className="btn btn-ghost" onClick={() => { setFromDate(""); setToDate(""); }}>Clear Dates</button>
        )}
        {loading && <span style={{ fontSize: 12, color: "var(--t3)" }}>Loading…</span>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(340px,1fr))", gap: 14 }}>
        {/* Work Summary */}
        <div className="card" style={{ padding: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Work Summary</h3>
          {workSummary ? (
            <>
              <div style={{ fontSize: 12, color: "var(--t2)", marginBottom: 8 }}>Total entries: <b style={{ color: "var(--t1)" }}>{workSummary.total}</b></div>
              <table className="dt">
                <thead><tr><th>Status</th><th>Count</th></tr></thead>
                <tbody>
                  {WORK_STATUSES.map((s) => (
                    <tr key={s}><td>{s}</td><td>{workSummary.byStatus[s]}</td></tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <div style={{ color: "var(--t3)", fontSize: 12 }}>No data available.</div>
          )}
        </div>

        {/* Progress Summary */}
        <div className="card" style={{ padding: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Progress Summary</h3>
          {progressSummary ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <div style={{ flex: 1, background: "var(--s2)", borderRadius: 6, height: 8, overflow: "hidden" }}>
                  <div
                    style={{
                      width: `${Math.min(100, progressSummary.overallPct)}%`,
                      height: "100%",
                      background: progressSummary.overallPct >= 80 ? "var(--gr)" : progressSummary.overallPct >= 50 ? "var(--yl)" : "var(--rd)",
                    }}
                  />
                </div>
                <span style={{ fontSize: 12, fontWeight: 700 }}>{progressSummary.overallPct.toFixed(1)}%</span>
              </div>
              <table className="dt">
                <thead><tr><th>Bucket</th><th>Items</th></tr></thead>
                <tbody>
                  <tr><td style={{ color: "var(--gr)" }}>≥80% Complete</td><td>{progressSummary.green}</td></tr>
                  <tr><td style={{ color: "var(--yl)" }}>50–79% Complete</td><td>{progressSummary.amber}</td></tr>
                  <tr><td style={{ color: "var(--rd)" }}>&lt;50% Complete</td><td>{progressSummary.red}</td></tr>
                </tbody>
              </table>
            </>
          ) : (
            <div style={{ color: "var(--t3)", fontSize: 12 }}>No data available.</div>
          )}
        </div>

        {/* Labour Summary */}
        <div className="card" style={{ padding: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Labour Summary</h3>
          {labourSummary ? (
            <table className="dt">
              <tbody>
                <tr><td>Total Workers</td><td>{labourSummary.totalWorkers}</td></tr>
                <tr><td>Male</td><td>{labourSummary.male}</td></tr>
                <tr><td>Female</td><td>{labourSummary.female}</td></tr>
                {labourSummary.totalCost != null && (
                  <tr><td>Total Labour Cost</td><td>₹{labourSummary.totalCost.toLocaleString("en-IN")}</td></tr>
                )}
              </tbody>
            </table>
          ) : (
            <div style={{ color: "var(--t3)", fontSize: 12 }}>No data available.</div>
          )}
        </div>

        {/* Issues Summary */}
        <div className="card" style={{ padding: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Issues Summary</h3>
          {issuesSummary ? (
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
              <table className="dt" style={{ flex: 1, minWidth: 140 }}>
                <thead><tr><th>Status</th><th>Count</th></tr></thead>
                <tbody>
                  {ISSUE_STATUSES.map((s) => <tr key={s}><td>{s}</td><td>{issuesSummary.byStatus[s]}</td></tr>)}
                </tbody>
              </table>
              <table className="dt" style={{ flex: 1, minWidth: 140 }}>
                <thead><tr><th>Priority</th><th>Count</th></tr></thead>
                <tbody>
                  {ISSUE_PRIORITIES.map((p) => <tr key={p}><td>{p}</td><td>{issuesSummary.byPriority[p]}</td></tr>)}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ color: "var(--t3)", fontSize: 12 }}>No data available.</div>
          )}
        </div>

        {/* Material Summary */}
        <div className="card" style={{ padding: 16, gridColumn: "1 / -1" }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Material Summary</h3>
          <div className="table-wrap">
            <table className="dt">
              <thead><tr><th>Material</th><th>Unit</th><th>Current Stock</th></tr></thead>
              <tbody>
                {materialRows.map((m) => (
                  <tr key={m.name}><td>{m.name}</td><td>{m.unit}</td><td>{m.stock}</td></tr>
                ))}
                {materialRows.length === 0 && (
                  <tr><td colSpan={3} style={{ textAlign: "center", color: "var(--t3)", padding: 20 }}>No material activity in this range.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
