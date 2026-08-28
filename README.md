# Kaarya

Kaarya turns meeting notes into reviewed actions: capture, review, then share. Supabase stores private meeting history, Gemini extracts structured drafts, OpenAI is an optional fallback, and Resend sends approved email directly.

**Before deploying this release, follow [Freemium Release](docs/freemium-release.md). Apply both the focus-flow and freemium database migrations first.**

## Local Setup

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm dev
```

Configure `.env.local` using the variable names in `.env.example`; never commit real secrets. Without credentials, only the explicitly labelled example can be explored. Missing services never return fabricated meeting data or successful deliveries.

## Required Production Setup

1. For a new project, run `supabase/schema.sql`. For both new and existing projects, run the complete contents of `supabase/upgrade-focus-flow.sql`, then `supabase/upgrade-freemium.sql`, before deploying this app. Existing ownership is never reassigned.
2. Configure Supabase Google OAuth and the production redirect URL; configure the Supabase URL, publishable/anon key and server-only service-role key.
3. Configure the chosen primary AI provider and optional OpenAI fallback. Sarvam is used for short voice-note transcription, not an extra translation call on every text input.
4. Configure Resend and a verified sender domain. Email acceptance is not proof of inbox delivery.
5. Configure optional Notion, Teams and Slack destinations. These are deployment-level connections, not per-customer OAuth connections.
6. Test the live acceptance checklist with two separate test accounts before inviting clients.

## Main Routes

- `POST /api/meetings/submit`: authenticated extraction with atomic plan reservations and progress; retains a private draft without publishing. Send a stable UUID `request_id` when retrying the same payload.
- `GET/PATCH /api/account`: profile synchronization, editable personal details, server-owned plan and usage.
- `GET/DELETE /api/meetings/[id]`: private JSON export or confirmed deletion. Deletion requires `x-kaarya-confirm-delete` equal to the meeting ID.
- `POST /api/refine`: applies a correction with the original source, `meeting_id` and stable `request_id`, subject to refinement allowances.
- `POST /api/meetings/save`: atomically stores reviewed output, stable task links and a revision number.
- `POST /api/audio/transcribe`: authenticated transcription of a consented voice note, up to 30 seconds.
- `GET /api/dashboard/meetings`: recent meetings belonging to the signed-in user.
- `GET /api/dashboard/tasks?meeting_id=...`: current tasks and revision of an owned meeting.
- `POST /api/messages/send`: sends or schedules an approved email through Resend.
- `POST /api/meetings/publish`: explicitly publishes the saved review to a configured destination.
- `GET/PATCH /api/tasks/[token]`: limited stakeholder task access via an unguessable update link.

## V1 Product Rule

Supabase is the source of truth. A generated draft is retained privately but is not an approved review. A copied message is not a sent nudge; provider acceptance is not inbox delivery. Notion changes do not currently sync back automatically. Stakeholder links update Kaarya directly.

Free: one successful generation per India-calendar day, five retained meetings, 20,000 input characters, one refinement per meeting and per day. Pro is priced at INR 2,999/month; Team at INR 9,999/month. Checkout is disabled pending Razorpay integration and payment acceptance testing. No browser setting can grant a paid plan.
