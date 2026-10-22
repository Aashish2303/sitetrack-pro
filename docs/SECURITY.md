# Data protection

The managed Supabase platform documents AES-256 encryption at rest and TLS encryption in transit: <https://supabase.com/security>. Its project HTTP APIs accept HTTPS only: <https://supabase.com/docs/guides/security/tls>. This is infrastructure encryption, not end-to-end encryption or a claim that application permissions are correct.

The app connects to Supabase via HTTPS and Realtime via the client's secure WebSocket transport. It uses managed password authentication. Passwords are not saved in application business tables or source code. Only the public/anon Supabase key is included in the client; it is not a service-role key. Files are opened using short-lived signed URLs. Private-bucket access and role rules must still be enforced on the database/storage service.

The frontend release adds HSTS, content-type protection, frame restrictions, a referrer policy, restricted browser capabilities and basic CSP directives. Protected requests receive private/no-store cache headers. Sessions are verified using `getUser`; refreshed cookies are copied to redirect responses. Post-login destinations are restricted to known relative application routes.

## Unresolved release blocker

The current production database still has broad authenticated policies. Earlier direct API checks demonstrated that non-finance users could read raw financial columns, and the existing profile update grant allowed role escalation. Hiding rates in React does not fix this. The pending SQL scripts revoke raw-column access, provide masked views, restrict membership/module access and protect role changes and business writes. Automatic approval review rejected their production execution because of the migration's broad impact. No claim of production security completion should be made until these scripts are approved, applied and verified live.

Read-only security-advisor results also report executable `SECURITY DEFINER` helpers (`my_role`, `can_see_finance`), disabled leaked-password protection and an unrelated `ping_test` table with RLS and no policy. Review role helpers in the pending migration and assess password-protection availability in the Supabase plan. Do not alter or expose unrelated tables to silence advisory messages. Advisor remediation: <https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable> and <https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection>.

## Verification before production

Run the prepared database migration in an approved release window with a schema/policy snapshot. Then verify raw REST reads, protected views, role escalation, private attachment reads and every mutation for each role against the live service. Confirm no unintended data from another project is visible, test sign-in/refresh/logout and direct URLs in the deployed browser, then repeat the full indent, DPR, labour and delivery flows. The isolated database suite supplies regression coverage but cannot prove a production deployment was configured correctly.
