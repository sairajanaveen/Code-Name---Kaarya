# Light Workspace And Long Transcripts

## Release Status

Implemented locally. Production deployment and production database migration are separate, approval-gated steps. No live model-quality, load, OAuth, inbox-delivery or native WhatsApp-app acceptance result is implied by unit tests.

## Product Decisions

- The public experience is a light, single-purpose notes workspace with a complete editable example. Login adds private history and usage; it does not turn the public homepage into an admin dashboard.
- Output means summary, topic-by-topic minutes, decisions, blockers, open questions, action items and next-meeting preparation. A short input is not padded; a substantive discussion is not reduced to a teaser.
- Rough wording, mixed languages and irregular caption files are acceptable. Meaningless input is rejected. Unverified suggestions become confirmation questions, not invented commitments or assignments.
- The reason to choose Kaarya is the workflow around the model: reviewed source-linked actions, owners, dates, stakeholder update links and private meeting history. A larger text box or a different model alone is not a defensible advantage.
- Keep Gemini as configured, with the existing optional OpenAI fallback on provider/schema failure. Do not advertise superior accuracy or switch providers without comparing the same consented test set.
- Pro remains INR 2,999/month and Team INR 9,999/month. Free remains one successful meeting per India-calendar day and five retained meetings. Checkout remains disabled pending payment integration.

## Input And Processing

The 20,000/100,000-character plan gates are removed. All plans accept up to **8 MiB of UTF-8 transcript text**, with no line-count cap, through paste or TXT, Markdown, VTT and SRT import. This is 8,388,608 bytes, not a promise of unlimited input or an identical token count in every language.

Inputs up to 40,000 JavaScript characters use the existing streamed API path. Larger inputs use private, resumable jobs:

1. Validate the manifest and authenticate the account.
2. Upload bounded parts with a SHA-256 integrity check. Existing parts are immutable and retry-safe.
3. Parse captions where possible; retain meaningful irregular captions intact with a warning.
4. Reserve one meeting allowance before inference. Split the complete text into bounded sections with overlap.
5. Process and checkpoint one section per request. Resume skips completed sections.
6. Merge all returned sections, retain conflicting assignments for review, validate the report and finish the reservation atomically.
7. Keep the original source in the owned meeting; remove completed temporary upload/section copies.

Pause stops the browser from requesting the next section. A section already running may finish and checkpoint. Closing the page does not schedule a background worker; the user resumes from the workspace. A job expires after 24 hours. Expired temporary rows are deleted at the account's next job creation, or by operator maintenance, not by an automatic timer currently.

Each section has at most three processing attempts. Only one unfinished job per account is allowed. Hourly job/part/step throttles remain, as do plan usage limits. These controls protect costs and retries; they are not substitutes for measured load testing.

There is no silent transcript truncation. Extremely large generated reports still have explicit storage/response guards: 2,000 rows per structured collection and a 2.5 MB generated result. Reaching a guard stops completion and retains the unfinished job for recovery; it does not label a partial report successful. Long or dense transcripts can take minutes, not a guaranteed 90 seconds.

Exact quote checks catch missing/paraphrased source quotes, not every semantic error. They do not prove that an owner, deadline, summary or decision is correct. Cross-section synthesis currently uses overlap and deterministic merging, not an additional global reasoning pass. Review remains necessary, especially when a decision is reversed much later in a transcript.

## Required Deployment Order

1. Back up the production database using the workspace's approved backup/export process.
2. For an existing freemium installation, run the **complete SQL contents** of `supabase/upgrade-long-transcripts.sql` in Supabase SQL Editor. A filename is not SQL. This adds private job tables/RPCs and updates existing quota/save functions. Do not delete the existing tables or meeting data.
3. For a new database, run `schema.sql`, `upgrade-focus-flow.sql`, `upgrade-freemium.sql`, then `upgrade-long-transcripts.sql`, in that order.
4. Build and test the exact release commit. Publish only the changed source, tests and documentation, never local logs, transcripts, keys, node_modules or .next.
5. Deploy a Vercel preview. Verify with two test accounts before promoting production.

No new environment variable is required. Existing Supabase, AI and optional Resend configuration still applies. The public Supabase key is for the browser; the service-role key and AI keys must remain server-only.

Do not deploy the new frontend before its SQL migration. Do not drop the new tables to roll back application code. Older application versions may not understand the new minutes fields; preserve/export new reports and test a rollback before relying on it.

## Sharing

- WhatsApp uses the official `wa.me` share URL with encoded text. The device chooses the installed app, web experience or chooser. Kaarya cannot force an unavailable native app to open.
- Email offers a recipient field, editable message, Gmail compose, Outlook web compose and the default mail app. These are compose handoffs, not OAuth mailbox connections. Kaarya does not read the inbox or send through the user's account automatically.
- Long messages use full-copy plus a blank compose window. The report is not shortened to fit a URL. HTML clipboard content and the formatted HTML download contain real tables; compose-link bodies are plain text.
- App links and browser clipboard behavior vary. Keep manual copy/download available. The existing Resend action is separate and appears only when configured; provider acceptance does not prove delivery.
- Teams and Notion controls are deferred from this core workflow. Existing backend routes are not a claim of per-user integration or bidirectional synchronization.

## Verification

Local automated suite: 148 passing tests at the initial release checkpoint, covering captions, Unicode, 8 MiB input boundaries, final-section retention, conflicting owners, schema/quote validation, safe sharing URLs, identity separation, idempotent uploads, leases, retry limits, cancellation, SQL migration behavior and source-preserving saves.

Browser checks completed on desktop (1440 x 900) and mobile (390 x 844): light homepage, example, full minutes, editing, recipient validation, current draft in compose URLs, and no horizontal page/control clipping. A complete live acceptance pass is still required after deployment.

The optimized-build browser check also passed: a 1,945,058-byte, 5,001-line synthetic transcript imports with its final commitment intact; action 26 survives page changes and appears in email; clipboard output contains both plain text and a real HTML table; a 54,000-character compose draft uses a blank-link fallback without shortening the editable message.

Google sign-in uses a local IndexedDB handoff for large drafts. The record is removed when next read, and only restored within 30 minutes; closing the browser is not an immediate local-data deletion mechanism.

Production acceptance checklist:

1. Google sign-in creates/opens the correct private profile. A second account cannot read the first account's meetings, jobs, source exports or task data.
2. Submit consented short notes, a long VTT transcript and a code-mixed transcript. Confirm commitments at the start, middle and end, plus final decisions that reverse earlier proposals.
3. Pause/resume after a completed section. Refresh during an upload. Retry a failed section. Verify one allowance, one meeting, no duplicate tasks and no automatic delivery.
4. Edit minutes and actions, save, reopen history, refine, compare changes and export the full original source. Check stale-review conflicts rather than overwrites.
5. Open WhatsApp and Gmail/Outlook on a real phone and desktop. Paste the formatted report into Word/email. Approve a test Resend send and inspect delivery logs and the actual inbox.
6. Measure median and p95 latency, input/output tokens, cost per meeting, failure/retry rate and cross-account concurrency. Set provider budget alerts before opening traffic. No 70% margin claim is validated yet.

For model selection, compare current Gemini and configured OpenAI on the same consented fixtures: concise commitments, noisy VTT, English/Hindi/Telugu/Tamil/Kannada, non-actionable discussion, contradictory dates, prompt injection inside notes, and long discussions. Score human-reviewed action precision/recall, topic/decision coverage, owner/date correctness, unsupported claims, editing effort, latency and cost. A schema-valid response alone is not a quality score.

## Reference Notes

The inspected [Clever Humanizer](https://cleverhumanizer.ai/) inspired the simple input/result workflow, not copied branding.

[ChatGPT's file documentation](https://help.openai.com/en/articles/8555545-file-uploads-with-chatgpt-and-gpts) describes separate file-size and document-token limits. These are not the same as a pasted chat window's limit. [Gemini's long-context guidance](https://ai.google.dev/gemini-api/docs/long-context) likewise does not imply unlimited reliable processing. Do not market unverified parity with every chat product.

Sharing references: [WhatsApp click-to-chat](https://faq.whatsapp.com/5913398998672934), [mailto URI specification](https://www.rfc-editor.org/info/rfc6068/), and [Gmail sending API](https://developers.google.com/workspace/gmail/api/guides/sending). A Gmail compose URL is not the authenticated Gmail sending API.
