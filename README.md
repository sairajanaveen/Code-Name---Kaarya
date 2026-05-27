# Kaarya

Kaarya turns meeting conversations into accountable execution: intake from website or Tally, orchestration through Make, Supabase as the source of truth, Sarvam AI for Indian-language handling, structured action extraction, and delivery through dashboard, email, Notion, Teams, and Slack.

## Local Setup

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local` and fill the services you want enabled. The app runs with demo dashboard data when credentials are missing.

## Required Production Setup

1. Run `supabase/schema.sql` in Supabase SQL editor.
2. Create the `meeting-assets` Supabase Storage bucket.
3. Add a Make custom webhook URL as `MAKE_WEBHOOK_URL`.
4. Add `SARVAM_API_KEY` for Indian-language speech, translation, and transliteration.
5. Add `GEMINI_API_KEY`, `STRUCTURED_LLM_PROVIDER=gemini`, and `STRUCTURED_LLM_MODEL=gemini-2.5-flash` for strict action item extraction.
6. Add Notion, Teams, Slack, and email webhook credentials as needed.
7. Configure the five Make scenarios in `docs/make-scenarios.md`.

## Main Routes

- `POST /api/meetings/submit`: validates website intake, stores the meeting, triggers Make, runs structured extraction, and publishes configured channels.
- `POST /api/audio/upload`: accepts browser microphone audio as base64 JSON and stores it in Supabase Storage.
- `GET /api/dashboard/meetings`: returns meeting records or demo data.
- `GET /api/dashboard/tasks`: returns action items and meeting prep questions or demo data.

## V1 Product Rule

The dashboard is the source of truth. Notion, email, Teams, and Slack are delivery and collaboration surfaces.
