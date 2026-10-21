# SiteTrack Pro

Construction-site management platform for **AASHISH INFRA PROJECTS, Hyderabad** — projects, BOQ tracking, daily work/progress reports, material indents & orders, labour register, subcontractor & vendor ledgers, issue tracking, and QMS reporting, with role-based access and backend-enforced finance visibility.

## Stack

- **Next.js 14** (App Router, TypeScript, Tailwind CSS)
- **Supabase** — Postgres database, Auth, Storage
- **Vercel** — hosting/deployment
- `xlsx` for Excel export, `jspdf` + `jspdf-autotable` for PDF export

## Repository

- GitHub: `Aashish2303/sitetrack-pro`
- Live URL: see the Vercel project dashboard (production alias is pinned once the current deployment goes live)

## Local setup

```bash
npm install
cp .env.example .env.local   # fill in your Supabase project URL + anon key
npm run dev
```

Required environment variables (also set as Vercel Production/Preview/Development env vars):

```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
```

## Database

Schema, RLS policies, and masked views (for hiding financial columns from non-finance roles at the database level) live in the Supabase project migrations. Run `npm run build` / `tsc --noEmit` locally before pushing — both are verified clean as of the latest commit.

## Roles & demo logins

Seven roles, each with their own nav and, for non-finance roles, backend-masked financial columns (rate/value/cost fields come back null via SQL views + RLS, not just hidden in the UI):

| Username     | Role                   | Password   | Sees finance data? |
|--------------|------------------------|------------|---------------------|
| `md`         | Managing Director      | `md123`    | ✅ |
| `engineer1`  | Site Engineer          | `eng123`   | ❌ |
| `engineer2`  | Site Engineer          | `eng456`   | ❌ |
| `sales`      | Sales / Procurement    | `sales123` | ❌ |
| `qms`        | QMS / Quality          | `qms123`   | ✅ |
| `accounts`   | Accounts / Finance     | `acct123`  | ✅ |
| `admin`      | Administrator          | `admin123` | ✅ |

Demo accounts map `username` → `username@sitetrack.local` for Supabase Auth.

## Modules

1. Today (dashboard)
2. Projects
3. BOQ Tracker
4. Daily Work Report (DWR)
5. Daily Progress Report (DPR)
6. Materials & Stock
7. Material Indents (quotations, MD approval, PO/WO generation)
8. Labour Register
9. Issues
10. Material Orders
11. Subcontractor Ledger
12. Material Vendor Ledger
13. Vendor Directory
14. QMS Reports (Excel + PDF export)

## Deployment

Vercel project `sitetrack-pro` is git-linked to this repository's `master` branch — every push to `master` triggers a new production build automatically.
