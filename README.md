# SiteTrack Pro

Construction operations for Aashish Infra Projects: fourteen modules covering projects, daily work, progress, BOQ, stock, indents and approvals, labour, issues, deliveries, ledgers, directory and reporting.

This update uses the **existing** `Aashish2303/sitetrack-pro` repository, Vercel project and Supabase database. It does not create a new repository or project.

## Run locally

```sh
npm ci
cp .env.example .env.local
# Set the existing Supabase URL and publishable/anon key in .env.local.
npm run dev
```

```sh
npm run typecheck
npm test
npm run test:database
npm run build
```

Next.js 14, React, TypeScript, Supabase Auth/PostgreSQL/private storage, Vercel, Excel and PDF exports. Package versions are pinned in the lockfile.

## Release status

**Production database migration is pending approval.** This branch is a review build. Do not promote it before the migration and live acceptance checks. Existing live records were preserved. See [release instructions](docs/RELEASE.md) for exact changes, validation, and rollout order.

The PRD says seven roles but names six. Six role types are implemented; the existing seven accounts include two engineers. Sensitive finance fields are intended for MD, QMS, accounts and admin. Sales sees quotation pricing needed for procurement.

See the [module walkthrough](docs/WALKTHROUGH.md) and SQL files under `supabase/`. Credentials are not stored in frontend code or this documentation.
