# Legacy SiteTrack comparison — 22 October 2026

Authenticated read-only inspection of `https://sitetrack.pro` with the administrator account. No legacy business records, passwords, quotations, approvals, payments or DNS were changed. This is a workflow and integration-surface review, not a claim that every legacy API passed mutation or penetration tests.

## Observed workflows and new routes

| Legacy screen | New route | Findings |
| --- | --- | --- |
| `/user/dashboard` | `/today` | Project progress, daily metrics, pending actions and quick links |
| `/user/projects` | `/projects` | Projects appear throughout the workspace |
| `/user/daily_works` | `/dwr`, `/dwr/new` | Work category, quantity, location, carry-forward and status; legacy also offers date-range/status filters |
| `/user/daily_progress` | `/dpr`, `/dpr/new` | Linked BOQ, quantity done, percentage, subcontractor and site incharge |
| `/user/boq_tracker` | `/boq` | Per-project BOQ, extra items and inline editing |
| Materials / Stocks | `/materials`, `/materials/stock` | Master stock and project transactions |
| `/user/indents`, `/user/add_indent` | `/indents`, `/indents/new` | Multi-item material, category, size, quantity and unit, urgency and approval note |
| `/user/indent_quotations/:id` | `/indents/:id` | Vendor quotation, editable total, delivery, notes, attachment and lowest-price comparison |
| `/user/labour_trackers` | `/labour`, `/labour/new`, `/labour/:id/edit` | Multiple trade/skill rows, male/female counts, wage, Now buttons and calculated hours |
| Issues | `/issues`, `/issues/new` | Issue lifecycle specified by the PRD |
| `/user/subcontractor_ledger` | `/subcon`, `/subcon/new` | Work-order, invoice, paid, balance and percentage-paid summaries |
| `/user/vendor_ledger` | `/vendorledger`, `/vendorledger/new` | PO, invoice, payment and balance summaries |
| `/user/orders` | `/orders`, `/orders/new` | Master order plus partial deliveries; payment and delivery status |
| `/user/vendors` | `/vendordb`, `/vendordb/new` | Category, company, contact and location; download and add routes |
| `/user/qms` | `/reports` | Project-selected consolidated BOQ and issues report with export |

The redesign retains Design System Core styling. Matching a legacy workflow does not require copying its Bootstrap/jQuery presentation or its server implementation. The current application uses Next.js and Supabase.

## Observed integration surfaces

The rendered legacy pages reference authenticated Laravel form POSTs and Ajax endpoints. Examples observed in the page's scripts:

- Work: `get_daily_works`, `daily_work_status`, `works_download_excel`.
- BOQ: `get_boq_project_details`, `get_boq_item_details`.
- Indents: `get_indents`; quotation and item detail screens; original-quotation upload.
- Orders: `get_orders`, `order_pay_status`.
- Vendors / subcontractors: `get_vendors`, `get_subcontractors`.
- Ledgers: `get_subcontractor_ledger`, `get_vendor_ledger`, separate Excel endpoints.

Names above were observed, not directly invoked to change data. Some legacy status actions are exposed as links: they were deliberately not opened during the read-only audit. The accessible `Aashish2303/SiteTrack` repository contains a Laravel scaffold with no business routes in `routes/web.php`; it cannot establish the live site's complete server contract. No legacy private database has been copied or connected to this build.

The new app uses Supabase Auth, REST views, private Storage, Realtime subscriptions and database RPCs. The new atomic quotation/approval and labour RPCs require the pending SQL release described in `RELEASE.md`. The 29 database checks run against an isolated PostgreSQL engine; they are not live-production acceptance evidence.

## Additional legacy scope to reconcile

The live navigation includes dedicated **Assign Materials**, **Return Materials**, **Subcontractors**, **Work Category**, **Units**, **Material Category**, and **Roles & Permissions** sections. These are not independent modules in PRD v1. The redesign currently provides stock transactions, free-text subcontractor fields, fixed work-category/unit options and six role keys (seven accounts), rather than those separate management screens. Full legacy parity therefore remains unfinished. Dedicated assignment/return records, shared master directories and permission administration require a separately reviewed schema/role specification.

The legacy project list also includes assigned site engineers, and the material master includes HSN codes. These have no dedicated fields in the current PRD schema and remain parity gaps.

The legacy DWR/DPR lists offer start/end dates and a status filter. The current new lists provide project and exact-date filters; QMS provides a date range. Historical numeric legacy record IDs cannot be redirected to UUID records without an explicit migration mapping.

## Routing changes delivered

- Create/edit forms and material stock have addressable routes. Refresh and browser history reopen the correct form.
- Project/date/status filters are represented in query strings where present, and retained when opening/closing entry forms.
- Login preserves valid internal deep links and refreshed session cookies; external or unknown return destinations are rejected.
- Direct module/form URLs check the persisted profile role in middleware. The server app layout independently requires a verified user and provisioned profile. Database RLS remains necessary for actual data access.
- Breadcrumb navigation, loading, retry, missing-project, access-denied and 404 views replace blank or ambiguous screens.
- Known static Laravel screen addresses redirect to canonical new routes. Unsupported legacy modules and numeric record IDs are not silently mapped to unrelated screens.

## Address and release status

`sitetrack.pro` currently uses external hosting and DNS (`dns-parking.com` nameservers). No apex-domain or DNS changes were made. A short Vercel review alias may point to this branch; it is a review build until the database release is approved and live acceptance checks pass. Domain cutover needs a release-ready deployment and the domain owner's DNS access.
