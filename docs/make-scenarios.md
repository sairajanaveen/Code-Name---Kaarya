# Kaarya Make Scenario Setup

## Scenario 1: Intake
- Website trigger: `/api/meetings/submit`.
- Tally trigger: `Tally - Watch New Responses`.
- For Tally, add one HTTP module immediately after the Tally trigger:
  - Method: `POST`
  - URL: `https://code-name-kaarya.vercel.app/api/meetings/submit`
  - Body type: `Raw`
  - Content type: `JSON`
  - Body: map Tally fields into the normalized payload below.
- Validate required fields: meeting name, date, email, transcript/audio/attachment.
- Store raw transcript or file URL in Supabase.
- Create or update `meetings` record with `status=intake_received`.
- Trigger downstream publishing only after Kaarya returns success.

Recommended Tally-to-Kaarya HTTP body:

```json
{
  "source": "tally",
  "meeting_name": "{{Meeting Name}}",
  "meeting_date": "{{Meeting Date}}",
  "attendees": "{{Attendees}}",
  "agenda": "{{Agenda}}",
  "raw_notes": "{{Meeting Notes}}",
  "email": "{{Your Email}}",
  "language_hint": "auto",
  "destination_channels": ["email", "dashboard", "notion", "teams", "slack"]
}
```

Do not keep a separate Tally -> Gemini -> Gmail path for production. Tally and the website should both enter the same Kaarya API so Supabase, dashboard, AI output, and delivery stay consistent.

## Scenario 2: AI Processing
- Fetch meeting record and input assets from Supabase.
- For Indian-language audio/text, call Sarvam for speech-to-text, speech-to-text-translate, translation, or transliteration.
- Call structured-output LLM with strict JSON instructions.
- Validate the JSON shape before writing.
- Insert `action_items` and `prep_questions`.
- Update meeting status to `processed`.

## Scenario 3: Publishing
- Create Notion meeting report and task entries.
- Send plain-text email with action item table and prep questions.
- Send Teams and Slack channel updates when webhook URLs exist.
- Write delivery results to `delivery_logs`.

## Scenario 4: Two-Day Follow-Up
- Schedule: every 2 days.
- Query pending, in-progress, or blocked action items.
- Group by owner/team.
- Send concise reminders through email, Teams, and Slack.
- Increment `follow_up_count` and write `delivery_logs`.

## Scenario 5: Verification
- Schedule: daily.
- Check webhook health, Supabase insert/read, Notion test page permission, and chat webhook status.
- Alert the platform owner when any module fails.
