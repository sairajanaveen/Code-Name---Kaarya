# Kaarya Freemium Launch Plan

Prepared: 2026-08-28. Prices approved by the owner: Pro INR 2,999/month; Team INR 9,999/month. Implementation is underway; this is not an activated billing plan or a production-readiness certification.

## 1. Starting Point

The current release is on [GitHub main](https://github.com/sairajanaveen/Code-Name---Kaarya/pull/4) and [the production site](https://code-name-kaarya.vercel.app/).

Live checks passed for Google login, the one-click example, weak-input rejection, a real Gemini draft, a targeted refinement, reviewed saving, private history, stakeholder status updates, and email/WhatsApp copy feedback. One short synthetic draft took 1.3 seconds and its refinement took 1.2 seconds. These are individual observations, not latency guarantees or load-test results.

Resend accepted one test email to the workspace owner's address. Inbox arrival is not yet verified. Notion publishing failed; do not describe a configured token as a verified integration. Teams and Slack are currently shown as unconfigured. Microphone accuracy, long-transcript model quality, full browser-based two-account isolation, and traffic capacity remain unverified. The 61 automated regression tests and production build passed. Database transaction and ownership tests passed using rollback-only verification.

Google sign-in creates the authenticated identity and saved meetings are scoped by `created_by`. The repository already contains `user_profiles`, `organizations`, and `organization_members` schema scaffolding. A visible profile, automatic profile synchronization, plan entitlements, and billing are not yet a complete product flow. Extend these existing structures instead of introducing a second profile system.

## 2. Positioning And Initial Audience

Proposed positioning: **Kaarya turns meeting commitments into owned, trackable progress before the next meeting.**

The practical reason to choose it is less manual follow-through: capture a conversation, approve evidence-backed actions, obtain owner updates, and return to the next meeting with the unresolved decisions already identified.

### Why Pay For Kaarya Instead Of ChatGPT?

For a one-off summary, ChatGPT may be sufficient. Kaarya should not claim superior intelligence or that ChatGPT cannot remember context, integrate with tools, or assist with follow-ups. [OpenAI documents meeting follow-up and preparation workflows](https://learn.chatgpt.com/use-cases?category=integrations&task_type=workflow). Compare the operational work a customer must configure, coordinate, and verify, not a fictional capability gap.

**The buying reason: stop being the person who copies the answer into a tracker, chases every owner, reconciles replies, and reconstructs the next agenda.** Kaarya's paid value must be a reliable, ready-made accountability workflow. It can complement ChatGPT instead of replacing it.

| Customer job | Kaarya's intended advantage | Release status |
| --- | --- | --- |
| Turn notes into commitments | Reviewed rows with evidence, owner, date, and status | Working core |
| Get stakeholder updates | Task-specific update links, with changes reflected in the workspace | Working core; expiry/revocation pending |
| Find the current state | Private retained history and current task records | Working core; visible profile/usage in this build |
| Prepare the next review | Source-linked briefs from unresolved commitments and fresh stakeholder updates | Planned |
| Follow up professionally | Approved owner-specific reminders with delivery tracking and quiet hours | Planned; direct reviewed email implemented |

An agency example: the account manager approves a client's commitment; the owner updates the task; the next review highlights the missing approval instead of repeating last week's discussion. Sell reduced coordination and fewer dropped commitments, not a more human-sounding summary. Validate willingness to pay INR 2,999 with pilot users; a higher price does not prove demand.

### AI Provider Decision

Keep the deployed Gemini 2.5 Flash primary for now and retain the configurable OpenAI fallback. It passed limited live draft/refinement checks, but no controlled comparison proves it is the best model. Verify paid API data-processing terms for confidential content. Sarvam remains the speech layer, not an obligatory extra translation call for text.

The existing OpenAI adapter targets GPT-4.1 mini, which supports structured output according to its [model documentation](https://developers.openai.com/api/docs/models/gpt-4.1-mini). Treat it as an evaluation candidate, not an automatic second opinion on every meeting. A second model can repeat the same error. Keep schema, evidence, date, and owner checks in application code, with user review before sharing.

Before changing defaults, run identical consented/synthetic examples through each candidate. Measure unsupported actions/owners/dates, missed commitments, correction preservation, prep-question usefulness, p50/p95 latency, errors, and total tokens including fallback. Cover long transcripts and English, Hindi, Telugu, Tamil, Kannada, and code-mixed input. Require a workload-specific improvement, not just a generic benchmark. No provider switch or successful OpenAI live test is implied here.

Start with a narrow pilot: Indian agencies and small operating teams running recurring client/project reviews. Include a small NGO cohort to test field-team and multilingual needs, without claiming one workflow already fits every NGO and MSME. Select initial customers for recurring accountability pain, not just meeting volume.

Summaries, action extraction, chat over meetings, and integrations are not unique. [Otter supports action tracking and completion](https://help.otter.ai/hc/en-us/articles/25983095114519-Action-Items-Overview); [Fireflies supports cross-meeting and connected-app questions](https://guide.fireflies.ai/articles/1512776728-global-askfred-get-answers-from-past-meetings-and-web-searches). Do not market these as absent from competitors.

### A Defensible Product Direction

- Maintain a traceable chain: source quote -> approved commitment -> owner acceptance -> status/evidence update -> next-meeting question. Owner acceptance and completion evidence still need implementation.
- Make participation lightweight for external clients, vendors, and volunteers. A stakeholder should not need to buy a seat just to update an assigned task.
- Prepare role-specific briefs from permitted historical meetings and current task states, with dates and source links. Do not silently reuse outdated decisions.
- Specialize in Indian-language/code-mixed follow-through and practical team terminology. Validate this with consented examples; language support alone is not a moat.
- Build a permissioned evaluation set of anonymized or synthetic corrections: invented owners, missed commitments, ambiguous deadlines, duplicate tasks, and weak prep questions. Never train across customers' private meetings by default.
- Build distribution and implementation expertise around a few repeatable workflows. A better prompt or private repository is not a durable moat, and no feature can be guaranteed uncopyable.

The long-term advantage must be reliable workflow adoption and measurable outcomes. Customers retain export/deletion rights; lock-in through withheld data is not the strategy.

## 3. Homepage And Profile UX

Keep the workspace as the first screen, not a long marketing landing page. Keep the dark identity, improve contrast, spacing, typography, and purposeful motion. Use restrained green for completion, amber for pending decisions, and red only for actionable errors. Avoid decorative dashboard clutter.

### First Visit

Show the Kaarya name prominently, one notes input, a clear create-draft action, and a working example. Keep Google sign-in visible. Explain authentication only when private processing is requested, preserve the user's notes across login, and return them to the same task. Supporting controls remain secondary: short voice note and text import.

Keep Pricing and Security reachable in navigation. Pricing belongs on a dedicated page and in Account, not as an obstructive modal over the first task. Do not advertise integrations or plan features that have not passed acceptance tests.

### Returning User

The first viewport should contain a compact greeting, a new-meeting action, the next relevant meeting or commitment, and three factual counters: actions needing attention, upcoming due dates, and recent completions. Show no invented sample statistics in a real account. Place recent meetings below these controls, with a useful empty state for a new account.

Navigation: Workspace, Meetings, Tasks, and an avatar menu containing Profile, Usage & billing, Integrations, and Privacy. Use a compact mobile navigation pattern. The main workflow stays capture -> review -> share.

### Profile

Show name/avatar from Google, verified email, optional organization/role, language preference, timezone, current plan, daily/monthly usage, and retained-meeting count. Company and role should be optional, not another compulsory signup form.

Create or repair the profile idempotently after a verified login; backfill existing identities without changing ownership of legacy meetings. Keep billing permissions and organization roles server-controlled, not writable through user metadata. Follow [Supabase's user-data pattern](https://supabase.com/docs/guides/auth/managing-user-data) and test profile-creation failures so a broken trigger does not break sign-up.

Historical records with no verified owner require a deliberate migration. Never assign all old records to the next person who logs in.

## 4. Reward Real Progress

Aim for satisfaction and clarity, not an addictive login loop.

| Moment | Feedback | Evidence required |
| --- | --- | --- |
| Return to the workspace | Show what changed since the previous visit | Actual task/update events |
| Owner accepts a commitment | Brief check animation and updated acceptance count | Explicit owner acceptance |
| Task is completed | Small completion animation and an undo path | Persisted status change |
| Preparation is complete | A compact readiness check, with missing items listed | Agenda, ownership, unresolved blockers, and current updates |
| Weekly review | Show closed commitments and remaining blockers | Dated activity records with stated denominators |

Do not award points merely for logging in, punish missed-day streaks, rank employees publicly, or claim fabricated hours saved. No random rewards, forced sound, or repeated confetti. Respect reduced-motion preferences, keyboard navigation, contrast, and screen readers. Keep ordinary transitions approximately 120-220 ms and never delay the primary action for animation.

Keep the current action-completeness metric separate from meeting productivity. Later metrics can show owner-acceptance rate, on-time closure rate, unresolved-action age, repeat blockers, and prep completion. Show sample size and period; do not combine these into an unexplained AI score or penalize somebody for a blocker they do not control.

## 5. Freemium Rules

Requested free entitlement: **one successfully generated meeting draft per day and up to five retained meetings per account.** There is no hidden additional monthly meeting cap in this proposal.

- Reset the free daily allowance at 00:00 Asia/Kolkata for the initial India launch. Display the exact reset time. Changing a profile timezone must not create extra allowance.
- Count one validated draft, including a valid no-action result, whether or not it is saved. Empty inputs, provider failures, and the static example do not consume the daily allowance. Deleting a meeting does not restore the day's generation allowance.
- Use server-side, transactional reservations before calling AI. Two tabs must not produce two free meetings or exceed five retained records. Release failed reservations; make retries idempotent.
- Check storage capacity before expensive processing. Five retained meetings means five records including archived meetings, their tasks, source material, and retained AI memory; hiding a meeting in Archive must not evade the cap.
- At capacity, offer export and deliberate deletion, or upgrade. Do not silently remove the oldest meeting. Explain the effects on tasks, shared links, and historical preparation before deletion.
- Manual edits, task status updates, and reading/exporting existing records remain free. AI refinements: one per meeting and one per day on Free; two per meeting and 80 per month on Pro. These are bounded separately from new-meeting quotas to prevent bypass through manually created records.
- Enforce plan input limits and budget limits on the server, not only by disabling buttons. Disclose transcript-size, refinement, audio, and sending limits before checkout. Benchmark the maximum permitted input, not just a short example, before finalizing those limits.
- On downgrade, preserve existing records for reading/export. Block new records while above the new cap; never make a surprise deletion or payment to retain basic access.
- Keep abuse controls separate from commercial entitlements: verified identities, rate limits, bot protection, bounded jobs, and per-provider spending alerts. Do not claim one Google account guarantees one human.

Five-meeting storage does not bound monthly inference cost: a free user can export/delete and process up to one meeting every day. Free adoption must be budgeted, not assumed free to operate.

## 6. Proposed Pricing

These are monthly INR price hypotheses, exclusive of applicable taxes. Do not publish them as purchasable until the corresponding features and billing gates pass. Start monthly; avoid lifetime deals or annual commitments before retention, costs, refunds, and cancellation are understood.

| Plan | Proposed price | Generation allowance | Retained meetings | Intended value |
| --- | --- | --- | --- | --- |
| Free | INR 0 | 1/day | 5/account | Experience the full capture/review/task-update loop |
| Pro | INR 2,999/month | 40/month, no commercial daily cap | 500/account | Flexible daily use and longer history; approved nudges and historical prep are future releases |
| Team | INR 9,999/month | 200/month pooled | 2,000/workspace | Planned: 5 organizer seats, shared accountability, permissions, role-specific preparation |

Stakeholders updating their own assigned tasks do not consume organizer seats or meeting credits. Team quotas are pooled, not multiplied by the number of members. Team must remain a planned offering until workspace isolation, roles, and invitations actually work. A free personal workspace and paid organization workspace must have explicit ownership/billing boundaries.

All plans keep basic security, accurate review, export, and manual task updates. Charge for higher capacity and coordinated follow-through, not for safe handling of data. NGO discounts should be a bounded, verified pilot offer with the same cost checks, not a permanently unlimited tier.

Do not bundle unlimited long audio recordings. The current implementation only supports short voice notes; full meeting recording/transcription needs a separate reliable pipeline and minute-based pricing or a priced add-on. Do not sell that capability before it exists.

## 7. Unit Economics And The 70% Target

The target should be **at least 70% gross margin after service-delivery costs**, not a promise of 70% take-home profit. Development, acquisition, administration, legal/accounting work, taxes, and founder compensation still affect net profit. Revenue calculations should exclude taxes collected on behalf of government and account for refunds.

Current published cost anchors, checked 2026-08-28:

| Component | Published pricing relevant to the plan |
| --- | --- |
| [Gemini 2.5 Flash](https://ai.google.dev/gemini-api/docs/pricing) | USD 0.30 per million text input tokens; USD 2.50 per million output tokens |
| [Sarvam speech-to-text](https://www.sarvam.ai/api-pricing) | INR 30/hour; batch with diarization INR 45/hour |
| [Razorpay](https://razorpay.com/pricing/) | Standard advertised processing fee 2% + GST; confirm the actual subscription/payment-method agreement |
| [Vercel Pro](https://vercel.com/pricing) | Starts at USD 20/month; usage overages can apply |
| [Supabase Pro](https://supabase.com/pricing) | Starts at USD 25/month for the documented baseline |
| [Resend Pro](https://resend.com/pricing) | USD 20/month for 50,000 emails, with additional-volume charges |

A budgeting exchange rate of INR 95/USD is an explicit planning assumption, not a quoted live rate. The three baseline platform plans total USD 65, approximately INR 6,175 at that assumption, before applicable taxes and overages. Use INR 6,500 only as a preliminary fixed-cost budget, not a guaranteed bill.

Example AI calculation: 30,000 total input tokens plus 4,500 total output tokens across a draft and its corrections costs USD 0.02025, approximately INR 1.92 at the assumed rate. This is not the cost of every meeting. Long/code-mixed transcripts, corrections, retries, optional fallback, and audio can increase it significantly. Do not route all customers through a second validator automatically.

For an illustrative text-only model, budget INR 2.50 per paid meeting, INR 0.90 per free short-note meeting, INR 20 per paid account for support, and a 3% payment reserve. These are assumptions to validate with actual provider usage, not measured production averages. The free allowance assumes bounded short input and one correction; the paid allowance is not a worst-case bound for repeatedly processing 100,000-character transcripts.

| Scenario | Revenue/month | Modelled delivery costs | Modelled gross margin |
| --- | --- | --- | --- |
| 25 Pro customers; 600 free users averaging 8 meetings/month | INR 74,975 | INR 16,069 | 78.6% |
| 100 Pro customers; same free usage | INR 299,900 | INR 31,817 | 89.4% |
| 100 Pro customers; 600 free users using 30 meetings/month | INR 299,900 | INR 43,697 | 85.4% |

Assumptions: every Pro customer uses all 40 meetings; INR 6,500 fixed platform cost; no long audio; no extra infrastructure or unbudgeted support. These scenarios demonstrate why a price alone cannot guarantee the margin.

Operating rule: measure tokens, model, corrections, retries, speech minutes, email volume, storage, egress, and direct support by account and cohort. Track free-tier subsidy separately. Price/allowance approval requires the permitted-input stress case and realistic conversion cohorts to fit the budget. If they do not, adjust the offering before selling it.

Initially admit a controlled free pilot with a published signup/waitlist policy. Do not secretly withdraw promised daily allowances after users join. Raise spend alerts well before the monthly budget is exhausted; preserve paid-service capacity. Avoid unconditional model retries and recomputing unchanged historical briefs.

## 8. Razorpay Integration

The owner's registration is in progress. No charges, plan activation, credential rotation, or paid infrastructure upgrades are authorized by this planning document.

Implement test mode first:

1. The authenticated backend selects a server-owned plan ID and amount. The browser cannot set the price, assign itself Pro, or choose another user's billing account.
2. Create the subscription/order server-side and open Razorpay Checkout. Keep secrets server-only. Hosted checkout should handle payment details; Kaarya should not store card data.
3. Validate the checkout result on the server. Do not unlock the plan merely because the browser displays success or a payment is only authorized.
4. Validate webhooks against the raw request body and the webhook signing secret, deduplicate events, and reconcile verified provider state. Razorpay documents signature checking, duplicate event IDs, and non-guaranteed ordering in its [webhook validation guidance](https://razorpay.com/docs/webhooks/validate-test/?locale=en-US).
5. Persist billing events and entitlement changes atomically. Distinguish incomplete, active, payment-failed, cancelled-at-period-end, expired, and refunded states. Repeated or old events must not grant duplicate credits or overwrite newer entitlement state.
6. Provide plan/usage, renewal date, receipt/invoice access, cancellation, payment recovery, and clear refund/support policies in Account. Reconcile pending transactions when a webhook is delayed.

Test success, abandonment, failure, late verification, duplicate/out-of-order events, renewal, cancellation, refunds, and a forged request before live mode. Publish accurate business/contact, privacy, terms, refund/cancellation, and tax information; confirm legal/tax requirements with the appropriate adviser.

Suggested additions to the existing backend: server-owned plan definitions; subscriptions; verified billing events with a unique provider event ID; atomic usage reservations/ledger; and provider-cost events. Extend `user_profiles` and existing organization tables rather than duplicating them. Per-user commercial quotas replace, but do not remove, the existing hourly abuse limits.

## 9. Security Must Be Demonstrable

Do not promise that data is completely safe, end-to-end encrypted, India-only, SOC 2 certified, or never used for training unless that exact claim is verified for Kaarya and every enabled path. Infrastructure-provider certifications are not Kaarya's certification.

Important: [Gemini's pricing page](https://ai.google.dev/gemini-api/docs/pricing) distinguishes free-tier data use from paid-tier data use. For confidential business content, verify paid API billing and applicable data-processing terms; do not assume a paid Kaarya subscription changes Google's API tier automatically. Apply the same subprocessor review to transcription, email, and integrations.

Required controls before full launch:

- Verified owner checks on every read/write/export/delivery route and database RLS; separate organization permissions and invitations before selling Team.
- Server-only privileged keys, log redaction, private storage, short-lived signed file URLs, and secret rotation procedures.
- Explicit recording permission; clear disclosure of where notes are sent; no automatic external publishing before review.
- Revocable, scoped, expiring stakeholder access for sensitive work. Current bearer links need a lifecycle and revocation design; possession of a link grants task access.
- Export and deletion covering source files, derived data, search indexes, drafts, and shared links. Document backup retention separately from active deletion.
- Backup/restore rehearsal, incident contact and response process, administrative access controls, and payment-webhook verification.
- A factual security page distinguishing configured, verified, and unavailable integrations. Successful configuration is not evidence of successful delivery.

The current Vercel account is on Hobby. [Vercel limits Hobby to personal non-commercial use](https://vercel.com/pricing). Move to a suitable commercial plan or hosting provider before commercial launch, with the owner's explicit approval for the spend.

## 10. Build Order And Launch Gates

### Release A: Trustworthy Core And Visible Account

Complete profile synchronization and profile/usage UI; preserve intake through authentication; improve the restrained home layout; expose meeting history clearly; finish Notion diagnosis or remove the unverified publish promise; verify the test inbox and sender domain. Add export/delete and stakeholder-link lifecycle before confidential pilots expand. Update the acceptance report with actual results.

### Release B: Enforced Free Tier And Measured Costs

Implement transactional daily allowance, five-record capacity, idempotency, recoverable failed jobs, input/refinement limits, and provider usage metering. Make full-capacity and reset-time states helpful and precise. Test simultaneous requests, retries, expired sessions, deletion, and old records. Keep prices informational until costs and billing are ready.

### Release C: Pro Billing

Add the pricing page and Account billing, integrate Razorpay in test mode, verify all payment states, approve the commercial hosting budget and data-processing terms, then enable live checkout for the validated Pro offering. Do not sell planned Team or recording features as already available.

### Release D: Accountability Differentiation And Team

Add owner acceptance, completion evidence, source-linked historical briefs, approved two-day nudge drafts with quiet hours, useful progress feedback, workspace roles, and customer-owned integrations. Every nudge needs consent, a delivery state, and an opt-out; copying text is not delivery. Enable the Team price only after tenant isolation and role tests pass.

### Launch Acceptance

- Two independent accounts cannot read, edit, export, email, publish, or infer each other's private meetings; equivalent organization-role tests pass for Team.
- Exactly one Free generation can win concurrent requests per day; exactly five retained records are allowed; failures and idempotent retries do not steal credits.
- The permitted maximum input, ambiguous dates, no commitments, multilingual notes, and corrections pass quality review without invented owners or deadlines.
- Owner updates, stale-edit protection, delivery failures, and authorized deletion/revocation work end to end.
- Real email reaches the intended test inbox; Notion and any advertised channels work against actual test destinations.
- Razorpay cannot be spoofed from the browser; duplicate and delayed events do not create duplicate entitlements or charges.
- Mobile/desktop keyboard and screen-reader journeys pass, including reduced motion, error recovery, slow connections, login return, and a full free tier.
- An approved staged load test measures p50/p95 draft time, failure rate, queue behavior, provider limits, and database contention. A single 1.3-second example is not the target service-level guarantee.
- Actual cohort service-delivery costs support the approved margin target, including free users, maximum allowed input, failed attempts, and support.

Suggested pilot success measures: time to first approved action, percentage of approved tasks accepted by owners, on-time closure rate, preparation completion, repeat meeting usage, correction rate, support incidents, and cost per retained paying workspace. Prefer these to raw signup or login-streak counts.

## Decision Summary

Keep the simple workspace and make it visibly personal. Honour one free meeting/day and five retained meetings with clear boundaries. Use the approved INR 2,999 Pro and INR 9,999 Team prices, with monthly allowances unchanged. Validate demand and actual costs. Build delight from follow-through and launch a controlled pilot before claiming full commercial readiness.
