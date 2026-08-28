# Kaarya

Kaarya turns meeting notes into complete minutes and reviewed actions: capture, review, then share. Supabase stores private meeting history, Gemini extracts structured drafts, OpenAI is an optional fallback, and Resend sends approved email directly. Gmail/Outlook and WhatsApp compose handoffs are also available.

**Before deploying this release, follow [Light Workspace And Long Transcripts](docs/long-transcripts-release.md). Apply the long-transcript migration after the focus-flow and freemium migrations.**

## Local Setup

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm dev
```

Configure `.env.local` using the variable names in `.env.example`; never commit real secrets. Without credentials, only the explicitly labelled example can be explored. Missing services never return fabricated meeting data or successful deliveries.

## Required Production Setup

1. For a new project, run `supabase/schema.sql`. Then apply `supabase/upgrade-focus-flow.sql`, `supabase/upgrade-freemium.sql`, and `supabase/upgrade-long-transcripts.sql` in order. For an existing freemium installation, only the new long-transcript migration is needed. Existing ownership is never reassigned.
2. Configure Supabase Google OAuth and the production redirect URL; configure the Supabase URL, publishable/anon key and server-only service-role key.
3. Configure the chosen primary AI provider and optional OpenAI fallback. Sarvam is used for short voice-note transcription, not an extra translation call on every text input.
4. Configure Resend and a verified sender domain. Email acceptance is not proof of inbox delivery.
5. Teams, Notion and Slack are deferred from this release's core UI. Existing backend destinations are deployment-level connections, not per-customer OAuth connections.
6. Test the live acceptance checklist with two separate test accounts before inviting clients.

## Main Routes

- `POST /api/meetings/submit`: authenticated extraction with atomic plan reservations and progress; retains a private draft without publishing. Send a stable UUID `request_id` when retrying the same payload.
- `GET/POST /api/meetings/jobs`: find or create the account's resumable long-transcript/refinement job.
- `GET/PUT/POST/DELETE /api/meetings/jobs/[id]`: inspect progress, upload an immutable part, process the next section or discard unfinished work.
- `GET /api/meetings/[id]/source?offset=0`: bounded, owner-only source export; follow `next_offset` until null.
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

VTT/SRT imports are parsed before AI extraction. The model and source-quote validator use the same text. Meaningful irregular captions are retained intact with a warning; empty captions and weak input are rejected. Original notes remain unchanged in private storage. Long transcripts are checkpointed in sections without silent truncation. All plans accept up to 8 MiB of UTF-8 text, with no line-count cap. See the release notes for report-size guards, privacy retention and operational caveats.

Supabase is the source of truth. A generated draft is retained privately but is not an approved review. A copied message is not a sent nudge; provider acceptance is not inbox delivery. Notion changes do not currently sync back automatically. Stakeholder links update Kaarya directly.

Free: one successful generation per India-calendar day, five retained meetings, one refinement per meeting and per day. Pro is priced at INR 2,999/month; Team at INR 9,999/month. Checkout is disabled pending Razorpay integration and payment acceptance testing. No browser setting can grant a paid plan.
