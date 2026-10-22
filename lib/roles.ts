export type Role = "md" | "engineer" | "sales" | "qms" | "accounts" | "admin";

export const ROLE_META: Record<Role, { label: string; color: string; icon: string }> = {
  md: { label: "Managing Director", color: "#ef4444", icon: "ti-crown" },
  engineer: { label: "Site Engineer", color: "#3b82f6", icon: "ti-helmet" },
  sales: { label: "Sales / Procurement", color: "#a78bfa", icon: "ti-truck-delivery" },
  qms: { label: "QMS / Quality", color: "#10b981", icon: "ti-shield-check" },
  accounts: { label: "Accounts / Finance", color: "#fbbf24", icon: "ti-report-money" },
  admin: { label: "Administrator", color: "#fb923c", icon: "ti-settings" },
};

export const FINANCE_ROLES: Role[] = ["md", "qms", "accounts", "admin"];
export const canSeeFinance = (role: Role | null | undefined) =>
  !!role && FINANCE_ROLES.includes(role);

export type NavItem = {
  id: string;
  href: string;
  label: string;
  icon: string;
  roles: Role[] | "all";
  group: "Main" | "Site Management" | "Finance & QMS";
};

export const NAV_ITEMS: NavItem[] = [
  { id: "today", href: "/today", label: "Today", icon: "ti-bolt", roles: "all", group: "Main" },
  { id: "projects", href: "/projects", label: "Projects", icon: "ti-building-skyscraper", roles: "all", group: "Main" },
  { id: "dwr", href: "/dwr", label: "Daily Work (DWR)", icon: "ti-clipboard", roles: "all", group: "Site Management" },
  { id: "dpr", href: "/dpr", label: "Progress (DPR)", icon: "ti-trending-up", roles: "all", group: "Site Management" },
  { id: "boq", href: "/boq", label: "BOQ", icon: "ti-list-numbers", roles: "all", group: "Site Management" },
  { id: "materials", href: "/materials", label: "Materials", icon: "ti-cube", roles: "all", group: "Site Management" },
  { id: "indents", href: "/indents", label: "Material Indents", icon: "ti-package", roles: "all", group: "Site Management" },
  { id: "labour", href: "/labour", label: "Labour", icon: "ti-users", roles: "all", group: "Site Management" },
  { id: "issues", href: "/issues", label: "Issues", icon: "ti-alert-triangle", roles: "all", group: "Site Management" },
  { id: "orders", href: "/orders", label: "Material Orders", icon: "ti-truck", roles: "all", group: "Finance & QMS" },
  { id: "subcon", href: "/subcon", label: "Subcon Ledger", icon: "ti-address-book", roles: ["md", "qms", "accounts", "admin"], group: "Finance & QMS" },
  { id: "vendorledger", href: "/vendorledger", label: "Vendor Ledger", icon: "ti-receipt", roles: ["md", "qms", "accounts", "admin"], group: "Finance & QMS" },
  { id: "vendordb", href: "/vendordb", label: "Vendor Directory", icon: "ti-address-book", roles: ["md", "sales", "admin"], group: "Finance & QMS" },
  { id: "reports", href: "/reports", label: "QMS Reports", icon: "ti-file-report", roles: "all", group: "Finance & QMS" },
  { id: "admin", href: "/admin", label: "Administration", icon: "ti-shield-lock", roles: ["admin"], group: "Finance & QMS" },
];

export function navForRole(role: Role | null | undefined): NavItem[] {
  if (!role) return [];
  return NAV_ITEMS.filter((n) => n.roles === "all" || n.roles.includes(role));
}

export const CATEGORY_OF_WORK = [
  "Masonry", "Painting", "Centering/Shuttering", "Plumbing", "Electrical",
  "Carpentry", "RCC/Concrete", "Flooring/Tiling", "Plastering", "Waterproofing",
  "Steel/Reinforcement", "Finishing", "Earthwork", "Other",
];

export const UNITS = ["Cum", "Sqm", "Rmt", "MT", "Bag", "Nos", "LS", "Litre", "Kg", "mm", "inches", "feet", "sqft", "Rft", "Ton", "Set", "Pair", "Sft", "Cft", "angular"];

export const SIZES = ['1"', '1.5"', '2"', '3"', '4"', '5"', '6"', "8mm", "10mm", "12mm", "16mm", "20mm", "25mm", "32mm", "M6-M16", "Custom"];

export const TRADES = ["Mason", "Carpenter", "Bar Bender", "Plumber", "Electrician", "Painter", "Helper", "Supervisor", "Driver", "Operator"];

export const VENDOR_CATEGORIES = ["Cement", "Steel/TMT", "Sand/Aggregate", "Bricks/Blocks", "Electrical", "Plumbing", "Paint", "Hardware", "Tiles/Marble", "Wood/Ply", "Glass", "Sanitary", "Tools", "Other"];
