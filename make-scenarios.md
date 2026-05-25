# Kaarya Make Scenario Setup

## Scenario 1: Intake
- Trigger: custom webhook for `/api/meetings/submit` and Tally webhooks.
- Validate required fields: meeting name, date, email, transcript/audio/attachment.
- Store raw transcript or file URL in Supabase.
- Create or update `meetings` record with `status=intake_received`.
- Trigger Scenario 2 with the meeting id.

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
