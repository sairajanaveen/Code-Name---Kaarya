# Freemium Foundation Release

Date: 2026-08-28. This release does not enable payments or certify commercial readiness.

## Included

- Owner-approved monthly prices: Pro INR 2,999; Team INR 9,999. Paid checkout is visibly unavailable until Razorpay is integrated and verified.
- Profile synchronization after verified Google login, editable personal details, usage and reset-time display.
- Free allowance: one successful generation per India-calendar day; five retained meetings, including generated drafts; 20,000 input characters. A successful request consumes the allowance for the period when its reservation began.
- Free AI refinements: one per meeting and one per day. Pro definitions: 40 generations/month, 500 retained meetings, 100,000 characters, two refinements/meeting and 80/month. Pro entitlements are server-controlled and expire; there is no public upgrade endpoint. Team is not enabled in the entitlement engine.
- Atomic inference reservations, idempotent completed-result replay, failed-request release, capacity checks on direct saves, recoverable private generated drafts.
- Profile and pricing screens, recent-action counters, paginated history, JSON export and confirmed deletion.
- Successful inference usage metadata retained for cost analysis. This is not a complete cost ledger: missing provider usage and final failed calls still require provider-side reconciliation.

## Deploy In Order

1. Ensure the existing `supabase/upgrade-focus-flow.sql` migration has been applied. For a fresh project, first apply `supabase/schema.sql`.
2. Run the complete contents of `supabase/upgrade-freemium.sql`. It is repeatable and does not reassign or delete legacy meetings.
3. Deploy the application and matching locked dependencies. `@electric-sql/pglite` is a development-only dependency for PostgreSQL migration tests.
4. For legacy authenticated intake, set `INTAKE_OWNER_USER_ID` to the verified Supabase user UUID of the intended workspace owner. Never accept an owner ID or plan from Tally fields or a submitted email. Without this mapping, trusted intake fails closed.
5. Test Google login, profile persistence, generation, refresh/recovery, reviewed saving, export and deletion with a synthetic meeting. A second Free generation must fail without another model call. Use a second test account to verify isolation.

Generation now retains a private draft before explicit review. It does not create external task deliveries or send email. Surface this behavior in the privacy notice. Existing meetings continue to open without requiring a usage record. Existing unowned data is not assigned automatically.

## Limits And Caveats

- India-calendar monthly periods are a foundation only; paid renewal-period alignment must be implemented alongside Razorpay before live checkout.
- Deletion removes the meeting's active database content and cached drafts and invalidates task links. Minimal usage metadata remains. Previously sent email and external copies are not recalled; backup retention is separate.
- Deletion is blocked for legacy file attachments and known scheduled delivery logs. An operator must cancel/reconcile them first. Full external-system deletion orchestration is not implemented.
- The retained snapshot may be older than a stakeholder update; history, export and publishing must read current task rows for reviewed meetings. Generated, unreviewed meetings use their draft snapshot until saved.
- The current speech endpoint supports 30-second notes, not full recording. Audio cost enforcement is still hourly abuse limiting, not a paid minute plan.
- Notion publishing remains a known unverified integration. Email provider acceptance is not inbox confirmation. Team roles, automatic historical briefs, approved nudges, task-link expiry and Razorpay remain separate releases.
- Vercel Hobby is not a commercial hosting plan. Paid infrastructure and provider data terms need owner approval before commercial launch.

## Verification

Run `pnpm test` and `pnpm build` before publishing. Database tests execute the actual migrations in PGlite/PostgreSQL, including idempotency, allowance failures, capacity, failed leases, deletion and entitlement expiry. PGlite serializes database access: its overlapping-call test does not replace a multi-connection PostgreSQL contention/load test.

Local UI verification used a synthetic profile fixture and a 390px embedded mobile viewport; the temporary fixture was removed before release. Live authenticated verification and load testing must be reported separately from these checks.

See [Freemium Launch Plan](freemium-launch-plan.md) for positioning, AI selection, pricing assumptions and the remaining launch gates.
