# SiteTrack Pro release

This branch upgrades the existing Vercel `sitetrack-pro` project and existing Supabase project. It does not create a repository or a hosting project.

## Current release status

Frontend changes build successfully. Database changes are prepared and validated in an isolated PostgreSQL engine. They have **not** been applied to production: automatic approval review blocked the broad access-policy replacement. Do not merge this branch or promote its preview until the database migration is approved and its live checks pass. The preview is a review build; new quotation/approval and labour mutation RPCs need the migration.

## Database changes to review

1. `supabase/migrations/20261021_access_and_integrity.sql` replaces broad signed-in access with membership and module rules, protects financial columns from direct REST reads, blocks role self-escalation, validates BOQ and deliveries, and configures private attachment access.
2. `supabase/complete-workflows.sql` adds quotation line pricing, approval attribution, atomic indent/quotation/approval and labour functions, server-calculated attendance hours, and a change audit log.

The scripts retain project, BOQ, labour, vendor and other business rows. They change permissions and add columns/tables/functions. Run both scripts in order in one transaction after approval. Record preflight row counts and save existing schema/policies. Run the integration checks against the staging database before promotion.

## Release checks

- All seven existing accounts authenticate. The PRD defines six distinct roles: MD, engineer, procurement, QMS, accounts and admin. Engineer1 and engineer2 share the engineer role.
- Engineer and sales responses mask project values, BOQ rates/values, wages and order rates. Sales can read quotation prices for procurement. Verify both masked views and raw-table requests.
- Engineer cannot change their role, read ledgers, submit quotations, approve indents or release held items through a direct API request.
- Full workflow: engineer creates a multi-item indent; QMS holds one item; sales submits two item-priced quotations with a file; MD selects a vendor; approved items get PO/WO; held items remain excluded.
- Labour: overnight attendance computes correctly; engineer edits counts without erasing hidden wages; removed categories are removed; totals reconcile.
- Deliveries: 40 + 60 against an order of 100 completes it; 40 + 70 is rejected by the database.
- DPR updates its linked BOQ and caps done quantity; exports reflect active screen filters.
- Check mobile layout at 390 px and desktop at 1440 px. Confirm no page-level horizontal overflow and usable navigation.

## Existing workbook

The uploaded workbook's BOQs sheet contains 35 line items and preserves its original Sft/Cft units. The existing database also contains 35 BOQ records. No automatic second import was performed. The workbook's other sheet contains PO/tax financial records, so it must not be treated as additional BOQ work items.

## Build and deployment

Use Node 22 or 24, `npm ci`, `npm run typecheck`, `npm test`, `npm run build`. Required variables are listed in `.env.example`. Put the Supabase publishable/anon key in the frontend; never expose a service-role key. Create a Vercel preview on the existing project from this branch. After database approval and live acceptance checks, merge into the existing `master` branch, which triggers its production deployment.

## Accounts

Existing usernames and passwords are preserved. Do not commit passwords to source, docs, screenshots or logs. Login accepts username (mapped to the existing internal account email) or email. User provisioning and password reset use the existing Supabase administrator dashboard. End users cannot assign their own role.

## Routing and legacy audit update

Addressable create/edit forms, stock routes, query filters, protected deep links, refreshed-cookie redirects, server membership checks and error/loading pages are included. See `LEGACY-AUDIT.md` for observed legacy contracts and remaining parity gaps, and `SECURITY.md` for encryption details and unresolved production access controls. The short review alias must remain clearly identified as a review build.
