# Kaarya

Kaarya turns meeting notes into reviewed actions: capture, review, then share. Supabase stores private meeting history, Gemini extracts structured drafts, OpenAI is an optional fallback, and Resend sends approved email directly.

**Before deploying this release, follow [Focus Flow Release](docs/focus-flow-release.md). It includes a required database migration and the live acceptance checklist.**

## Local Setup

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm dev
```

Configure `.env.local` using the variable names in `.env.example`; never commit real secrets. Without credentials, only the explicitly labelled example can be explored. Missing services never return fabricated meeting data or successful deliveries.

## Required Production Setup

1. For a new project, run `supabase/schema.sql`. For both new and existing projects, run the complete contents of `supabase/upgrade-focus-flow.sql` before deploying the new app.
2. Configure Supabase Google OAuth and the production redirect URL; configure the Supabase URL, publishable/anon key and server-only service-role key.
3. Configure the chosen primary AI provider and optional OpenAI fallback. Sarvam is used for short voice-note transcription, not an extra translation call on every text input.
4. Configure Resend and a verified sender domain. Email acceptance is not proof of inbox delivery.
5. Configure optional Notion, Teams and Slack destinations. These are deployment-level connections, not per-customer OAuth connections.
6. Test the live acceptance checklist with two separate test accounts before inviting clients.

## Main Routes

- `POST /api/meetings/submit`: authenticated, rate-limited extraction; streams progress and returns an unsent, unsaved draft.
- `POST /api/refine`: applies an explicit correction with the original source and current draft.
- `POST /api/meetings/save`: atomically stores reviewed output, stable task links and a revision number.
- `POST /api/audio/transcribe`: authenticated transcription of a consented voice note, up to 30 seconds.
- `GET /api/dashboard/meetings`: recent meetings belonging to the signed-in user.
- `GET /api/dashboard/tasks?meeting_id=...`: current tasks and revision of an owned meeting.
- `POST /api/messages/send`: sends or schedules an approved email through Resend.
- `POST /api/meetings/publish`: explicitly publishes the saved review to a configured destination.
- `GET/PATCH /api/tasks/[token]`: limited stakeholder task access via an unguessable update link.

## V1 Product Rule

Supabase is the source of truth. A generated draft is not a saved meeting, a copied message is not a sent nudge, and a provider accepting email is not proof that it reached the inbox. Notion changes do not currently sync back automatically; stakeholder update links update Kaarya directly.
