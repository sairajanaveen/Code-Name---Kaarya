# Focus Flow Release

Release: 2026-08-27. Scope: a faster capture-to-review experience, with explicit approval before saving or sending.

## What Changed

- One required notes field. Title, date, people and outcome are grouped under optional details.
- Actions, decisions and next-meeting questions share one review surface. No new marketing landing page.
- A clearly labelled example opens a complete review in one click without authentication or a network request. Private processing and history require Google sign-in.
- Text goes directly to one structured-output model call. A single bounded OpenAI fallback is used only when the Gemini request or validation fails.
- The prompt distinguishes commitments from suggestions, leaves unknown dates/owners empty, asks for exact source quotes, and generates only specific unresolved prep questions.
- JSON shape, lengths, dates, source quotes and duplicates are checked before a draft is returned. Quote matching is not a guarantee of semantic accuracy: users still approve the result.
- Real processing stages, elapsed time, cancellation and recoverable errors replace simulated success.
- Inline edits, one-step undo, source quotes, refinement chat, clean rich-text email copy, plain WhatsApp copy and CSV export.
- Reviewed saves use stable action IDs, idempotent save IDs, optimistic revisions and a database transaction.
- Stakeholder status updates preserve source evidence and invalidate stale meeting drafts. Opening a meeting loads current tasks, not a truncated history cache.
- Direct Resend delivery and scheduling are separate from extraction. Notion, Teams and Slack remain explicit publishing actions.
- Production CSS is compiled locally; the Tailwind CDN dependency is removed. The Supabase browser SDK is loaded separately from the initial page bundle.

## Deployment Order

1. Keep the existing working deployment and Git history. Do not delete the repository or its database.
2. In Supabase, open SQL Editor and a new query. For a new database only, run the contents of `supabase/schema.sql` first. Then paste and run the **entire SQL contents** of `supabase/upgrade-focus-flow.sql`, not its filename. This release needs the new columns and three RPC functions.
3. If the SQL reports an error, stop before deploying. The migration is transactional. It was executed successfully against the Kaarya Supabase project on 2026-08-27; the rollback-only verification query in `supabase/verify-focus-flow.sql` also passed.
4. Upload the package contents at the repository root, with `package.json`, `pages`, `lib` and `supabase` at the same level. Do not upload the ZIP itself, `node_modules`, `.next` or real `.env` files. Preserve unrelated existing files. Remove the obsolete root `aiPipeline.js` if it still exists; keep the active `lib/aiPipeline.js`.
5. Keep existing Vercel environment variables. Required: Supabase URL, public anon/publishable key, server-only service-role key, chosen AI key, and production app URL. Google OAuth must be enabled in Supabase with the correct redirect allowlist.
6. Optional services: `OPENAI_API_KEY` plus `VALIDATOR_LLM_MODEL` for fallback, `SARVAM_API_KEY` for recording, `RESEND_API_KEY` and verified `EMAIL_FROM` for email, and existing Notion/Teams/Slack settings for publishing.
7. Redeploy on Vercel after the migration and configuration. First verify with test accounts and a test meeting. Do not announce the launch until the live checks below pass.

Old meetings without `created_by` are intentionally not exposed to arbitrary signed-in users. Assign historical ownership only after verifying which account owns each meeting. Do not bulk-assign customer records to whichever account logs in first.

The migration enables RLS and revokes direct anon/authenticated table access for meetings, actions, prep questions and delivery logs. Those records are served through owner-scoped API routes; server-only service-role access is retained. Existing external scripts relying on direct browser reads must be updated before rollout. This does not create organization-wide collaboration permissions.

## Tally / Make Contract Change

The website does not automatically invoke Make. Both website and Tally-shaped payloads use the same validator and extraction pipeline, but extraction now returns a **draft only**, without saving or delivering it.

For trusted server-to-server intake, configure a strong server-only `INTAKE_WEBHOOK_SECRET` and send the matching `x-kaarya-intake-key` header from the Make HTTP module. Website calls instead use the user's Supabase bearer token. Never put this secret in a Tally public field or browser bundle.

A Tally/Make caller must handle the returned draft and its review handoff explicitly. This package does not implement a Tally-to-user account mapping or automatically attach an external draft to someone's private history. Pause old auto-send routes until that review handoff is designed; do not claim both paths automatically save/send identically.

## Limits And Honest Status

- Up to 100,000 transcript characters, 24 actions and five prep questions. Oversized input is rejected, not silently cut off.
- Text imports: TXT, MD, SRT or VTT, up to 400 KB and the character limit above.
- Voice notes: up to 30 seconds and 3 MB, with consent. Long meeting recordings require a separate asynchronous transcription path and are not supported by this short-note flow.
- Per-user hourly quotas: 12 draft/refinement calls, 60 saves, 20 email requests and 10 channel-publishing requests. Task update links allow 30 updates per hour per token.
- AI request time budgets: 24 seconds for primary, 16 for the optional fallback. These are timeouts, not delivery guarantees. Long or complex input can need a retry.
- Send later accepts times from one minute to 30 days ahead. Scheduling/cancellation status must currently be managed in Resend; the app does not yet implement delivery-event webhooks or a cancellation UI.
- The history overview shows the 30 most recent meetings and a bounded recent-task overview. Opening a meeting fetches its own current tasks. Full-history pagination and historical productivity analytics are not implemented in this release.
- A copied WhatsApp draft is not an automated WhatsApp message. A configured Notion token is not proof of a working sync. Notion assignments remain plain text, and two-way status sync/customer-specific OAuth are not implemented.
- Notion publishing can partially succeed. Check the destination before retrying; retries are not yet deduplicated across Notion pages.

## Verification Performed

- 56 Node regression tests passed using mocked external services.
- Live Supabase checks passed for saved drafts, idempotent retries, owner isolation, stakeholder updates, stale revisions and direct-access restrictions. Verification records were rolled back.
- Production Next.js build passed. Initial page JavaScript was approximately 133 KB after lazy-loading browser authentication, versus 195 KB in the first implementation build. This is a local build comparison, not a competitor or real-user speed benchmark.
- Browser checks covered empty-input errors, explicit example mode, editable task owners, clean-copy feedback, preparation tabs, signed-out history, and mobile layout.
- Hindi, Telugu, Tamil, Kannada and Hindi-English test fixtures verify text/quote preservation, not real model translation or speech accuracy.
- No customer emails or external Notion tasks were created by the automated test suite.

## Live Acceptance Gates

| Check | Required result | Current status |
| --- | --- | --- |
| Database migration | Three RPC functions exist; repeat save does not duplicate tasks; stale edits and unauthorized ownership are rejected | Migration and rollback-only live verification passed |
| Two-account isolation | A cannot list, open, save, publish or email B's meeting | Mock/API checks pass; live verification required |
| Google login | Redirect returns to the production domain and preserves intake | Live verification required |
| Real AI quality | A concise meeting, long transcript, no-commitment meeting and ambiguous dates produce correctly reviewed drafts | Mock contract checks pass; live fixtures required |
| Speech | Consented microphone input transcribes accurately across required languages and browsers | Live microphone/provider checks required |
| Draft correction | Edits and refinement preserve unrelated facts and source evidence | Contract checks pass; real model review required |
| Stakeholder link | Task update appears on reopening the meeting; stale save fails | API checks pass; database/browser verification required |
| Email | Verified sender reaches an approved test inbox; provider rejection is visible; retry does not duplicate | Mock checks pass; live inbox verification required |
| Scheduling | Test email is scheduled for the intended local time and can be cancelled in provider dashboard | Mock checks pass; live scheduling required |
| Notion / Teams / Slack | Test content lands in the intended test destination with correct property types | Live verification required |
| Traffic | Measure p50/p95 latency, error rate, provider rate limits and database quota contention under an approved staged load | Not load-tested |

This is not a certification of production readiness or a claim to be faster than competitors. Measure the complete submit-to-editable-draft time on the actual deployment before making performance promises. Shared integration credentials are suitable only for a controlled workspace pilot, not isolated integrations for unrelated customer organizations.

## Reference Patterns

The flow prioritizes editable outcomes and source context over a large feature menu. Official references reviewed: [Notion meeting notes](https://www.notion.com/help/ai-meeting-notes), [Otter action items](https://help.otter.ai/hc/en-us/articles/25983095114519-Action-Items-Overview), [Gemini structured generation](https://ai.google.dev/api/generate-content), [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [Sarvam transcription](https://docs.sarvam.ai/api-reference/speech-to-text/transcribe), and [Resend scheduling](https://resend.com/docs/dashboard/emails/schedule-email).
