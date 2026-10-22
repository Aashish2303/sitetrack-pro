import type { Role } from "./roles";

export type Profile = {
  id: string;
  username: string;
  name: string;
  role: Role;
  avatar: string;
  is_active?: boolean;
};

export type Project = {
  id: string;
  name: string;
  location: string | null;
  client_name: string | null;
  value: number;
  start_date: string | null;
  end_date: string | null;
  status: "Active" | "On Hold" | "Completed";
  created_at: string;
};

export type ProjectView = Project & {
  total_boq_qty: number;
  total_done_qty: number;
  progress_pct: number;
};

export type BoqItem = {
  id: string;
  project_id: string;
  item: string;
  unit: string;
  boq_qty: number;
  cum_done: number;
  rate: number;
  is_extra: boolean;
};

export type BoqItemView = Omit<BoqItem, "rate"> & {
  balance: number;
  progress_pct: number;
  rate: number | null;
  boq_value: number | null;
  done_value: number | null;
};

export type Indent = {
  id: string;
  project_id: string;
  date: string;
  urgency: string | null;
  engineer: string | null;
  notes: string | null;
  note_for_approval: string | null;
  status: "Pending Quotation" | "MD Review" | "Approved" | "Rejected";
  po_number: string | null;
  wo_number: string | null;
  approved_idx: number | null;
  created_at: string;
};

export type IndentItem = {
  id: string;
  indent_id: string;
  material_name: string;
  quantity: number;
  unit: string;
  size: string | null;
  category: string | null;
  item_status: "Pending" | "Approved" | "Rejected" | "On Hold";
};

export type IndentQuotationView = {
  id: string;
  indent_id: string;
  vendor_name: string;
  delivery_time: string | null;
  notes: string | null;
  attached_file_url: string | null;
  attached_file_name: string | null;
  rate: number | null;
  total: number | null;
};

export type IndentQuotation = {
  id: string;
  indent_id: string;
  vendor_name: string;
  rate: number;
  total: number;
  delivery_time: string | null;
  notes: string | null;
  attached_file_url: string | null;
  attached_file_name: string | null;
  uploaded_by: string | null;
  created_at: string;
};

export type LabourEntry = {
  id: string;
  project_id: string;
  date: string;
  subcontractor: string | null;
  site_incharge: string | null;
  shift: "Day" | "Night";
  in_time: string | null;
  out_time: string | null;
  hours: number | null;
  remarks: string | null;
};

export type LabourCategoryView = {
  id: string;
  labour_entry_id: string;
  trade: string;
  skill: string;
  male_count: number;
  female_count: number;
  wage: number | null;
  row_cost: number | null;
};

export type Vendor = {
  id: string;
  vendor_name: string;
  company_name: string | null;
  mobile: string | null;
  alt_contact: string | null;
  category: string | null;
  location: string | null;
  material_type: string | null;
  remarks: string | null;
  visiting_card_url: string | null;
};

export type WorkStatus = "Completed" | "Partial" | "Delayed - Carry Forward" | "Cancelled" | "Not Started";

export type DwrEntry = {
  id: string;
  project_id: string;
  date: string;
  description: string | null;
  location_block: string | null;
  quantity: number | null;
  category: string | null;
  subcontractor: string | null;
  engineer: string | null;
  site_incharge: string | null;
  work_status: WorkStatus;
  carry_forward: boolean;
  remarks: string | null;
  created_by: string | null;
  created_at: string;
};

export type DprEntry = {
  id: string;
  project_id: string;
  boq_item_id: string | null;
  date: string;
  description: string | null;
  location_block: string | null;
  category: string | null;
  pct_done: number | null;
  qty_done: number | null;
  subcontractor: string | null;
  engineer: string | null;
  site_incharge: string | null;
  work_status: WorkStatus;
  carry_forward: boolean;
  reason: string | null;
  created_by: string | null;
  created_at: string;
};

export type Issue = {
  id: string;
  project_id: string;
  date: string;
  title: string;
  description: string | null;
  category: string | null;
  priority: "Low" | "Medium" | "High" | "Critical";
  raised_by: string | null;
  assigned_to: string | null;
  status: "Open" | "In Progress" | "Resolved" | "Closed";
  resolution: string | null;
  photo_url: string | null;
  created_at: string;
};

export type MaterialOrderView = {
  id: string;
  project_id: string;
  vendor: string;
  material: string;
  date: string;
  po_number: string | null;
  ordered_qty: number;
  unit: string;
  pay_status: string;
  remarks: string | null;
  received_qty: number;
  pending_qty: number;
  billing_status: string;
  rate: number | null;
};

export type Material = {
  id: string;
  name: string;
  unit: string;
  category: string | null;
  opening_stock: number;
  created_at: string;
};

export type MaterialTransaction = {
  id: string;
  project_id: string;
  material_id: string;
  date: string;
  type: "Inward" | "Consumption";
  quantity: number;
  reference: string | null;
  remarks: string | null;
  created_at: string;
};

export type MaterialOrder = {
  id: string;
  project_id: string;
  vendor: string;
  material: string;
  date: string;
  po_number: string | null;
  ordered_qty: number;
  unit: string;
  rate: number;
  pay_status: "Pending" | "Partial" | "Paid";
  remarks: string | null;
  created_by: string | null;
  created_at: string;
};

export type MaterialOrderDelivery = {
  id: string;
  order_id: string;
  date: string;
  delivered_qty: number;
  dc_number: string | null;
  created_at: string;
};

export type SubconLedgerType = "Work Order" | "Running Bill" | "Final Bill" | "Advance" | "Retention Release" | "Deduction";

export type SubconLedgerEntry = {
  id: string;
  project_id: string;
  subcontractor: string;
  date: string;
  type: SubconLedgerType;
  description: string | null;
  wo_po_number: string | null;
  work_order_amount: number;
  invoice_amount: number;
  amount_paid: number;
  remarks: string | null;
  created_by: string | null;
  created_at: string;
};

export type VendorLedgerType = "Purchase" | "Advance" | "Return" | "Debit Note" | "Credit Note";

export type VendorLedgerEntry = {
  id: string;
  project_id: string;
  vendor: string;
  date: string;
  type: VendorLedgerType;
  description: string | null;
  po_number: string | null;
  po_amount: number;
  invoice_amount: number;
  amount_paid: number;
  remarks: string | null;
  created_by: string | null;
  created_at: string;
};
