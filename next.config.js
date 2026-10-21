/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async redirects() {
    const legacy = {
      dashboard: 'today', projects: 'projects', add_project: 'projects/new',
      daily_works: 'dwr', add_daily_work: 'dwr/new',
      daily_progress: 'dpr', add_daily_progress: 'dpr/new', boq_tracker: 'boq',
      materials: 'materials', add_material: 'materials/new', stocks: 'materials/stock',
      indents: 'indents', add_indent: 'indents/new',
      labour_trackers: 'labour', add_labour_tracker: 'labour/new',
      issues: 'issues', add_issue: 'issues/new', orders: 'orders', add_order: 'orders/new',
      vendors: 'vendordb', add_vendor: 'vendordb/new', qms: 'reports',
      subcontractor_ledger: 'subcon', add_subcontractor_ledger: 'subcon/new',
      vendor_ledger: 'vendorledger', add_vendor_ledger: 'vendorledger/new',
    };
    return [{source:'/dashboard',destination:'/today',permanent:false}, ...Object.entries(legacy).map(([old, dest])=>({source:`/user/${old}`,destination:`/${dest}`,permanent:false}))];
  },
  async headers() {
    return [{source:'/:path*',headers:[
      {key:'X-Content-Type-Options',value:'nosniff'},
      {key:'X-Frame-Options',value:'DENY'},
      {key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},
      {key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=()'},
      {key:'Strict-Transport-Security',value:'max-age=31536000'},
      {key:'Content-Security-Policy',value:"frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'; upgrade-insecure-requests"},
    ]}];
  },
};
module.exports = nextConfig;
