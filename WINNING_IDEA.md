# CALL-E: Your Code Is Calling: Winning Idea Dossier

> **Status:** One idea selected; no product name assigned; implementation is
> underway and real calls remain disabled. See
> [`APPLICATION_STATUS.md`](./APPLICATION_STATUS.md) for current engineering state.
> **Deadline:** September 14, 2026 at 8:45 AM PT.
> **Primary prize target:** Most Practical Use Case.
> **Ground truth:** [`HACKATHON.md`](./HACKATHON.md) is authoritative for rules and submission fields.

## Final decision

Build an evidence-backed phone verification workflow for emergency resource directories, demonstrated on cooling centers and heat-relief shelters. It ingests a published directory, identifies facts most likely to harm someone if stale, prioritizes a bounded set of calls, uses CALL-E to ask each facility a short disclosed set of questions, grounds every field in transcript evidence, routes contradictions or uncertainty to review, and publishes a time-stamped delta instead of silently overwriting the source.

No project name is proposed. “Emergency resource directory verifier” is a functional description only.

## One-line version

A city PDF says a cooling center is open; this calls the center, checks the facts that matter today, and will say “unknown” rather than send someone to a locked door.

## Why phone is load-bearing

Emergency and community-resource information fails in a specific gap:

- the city, county, nonprofit, or 211 directory publishes a list;
- facilities change hours, entrances, capacity, pet rules, accessibility, or activation status;
- small operators update a voicemail greeting or tell callers, but do not update every directory;
- a person in heat, smoke, outage, or displacement follows the stale listing.

The latest operational fact often exists only behind a phone number. A search API cannot retrieve it. A generic voice bot that “calls places” is not enough; the product is the policy that decides what to verify, how to represent uncertainty, when to retry, and how to keep a phone answer from becoming an overconfident public claim.

## Why this can win

The CALL-E rubric rejects generic “AI that makes phone calls.” This idea is:

- **specific:** cooling-center and heat-relief directory freshness;
- **practical:** prevents wasted, risky trips caused by stale operational facts;
- **reusable:** the verification engine and schema can support shelters, food sites, public-health clinics, and outage resources without changing the safety model;
- **technically non-trivial:** batch orchestration, call budgeting, typed evidence, temporal freshness, conflict handling, retries, webhook idempotency, and auditability;
- **demonstrable:** one published listing changes on screen only after a real CALL-E result provides evidence.

It also fits the community repository as a focused runnable app and reusable workflow pattern, not a marketing page.

### Ideas deliberately rejected

- **Appointment booking:** the canonical voice-agent demo and already well served.
- **Restaurant reservation caller:** low impact and overrepresented.
- **Lead qualification:** obvious business use, little originality.
- **Pharmacy stock locator:** valuable but pharmacies may not disclose stock, controlled substances create risk, and false negatives can affect care.
- **Insurance/prior authorization caller:** requires private identifiers and domain access unavailable for a safe hackathon demo.
- **Debt collection or landlord negotiation:** power imbalance and legal risk.
- **Emergency dispatch automation:** dangerous and out of scope; the system never calls emergency numbers.
- **Single listing verification:** CALL-E's community repo already contains a `verify-by-phone` skill. The selected idea is a bounded, multi-source, temporal workflow with prioritization, evidence quorum, contradictions, and publication controls.
- **IVR graph crawler:** highly novel but CALL-E's public contract does not clearly guarantee outbound DTMF control; the project must not depend on an undocumented capability.

## Specific users and job

### Primary operator

A city resilience team, county public-health office, 211 partner, mutual-aid group, or local newsroom maintaining a public heat-resource page.

### Beneficiary

A resident deciding where to go for air conditioning, water, charging, accessible indoor space, or overnight heat relief. The product is not their emergency service; it improves the operator's directory.

### Operator job

“Before and during a heat event, tell me which operational facts in this directory are fresh, which changed, which remain unknown, and what phone evidence supports each update, without repeatedly bothering facilities or fabricating certainty.”

## Scope boundary

### Demonstration scope

- One source directory containing 10-20 cooling or heat-relief sites.
- At most six structured fields per site:
  - currently activated/open status;
  - today's closing time;
  - address/entrance confirmation;
  - wheelchair-accessible entrance status;
  - whether water and charging are available;
  - one locally important field such as pets or overnight operation.
- A hard call budget, initially the 20 free CALL-E calls.
- Calls only to published non-emergency business/resource numbers.
- One call per site per freshness window unless a human authorizes a conflict follow-up.
- Evidence-backed draft changes requiring publication approval.

### Non-goals

1. No 911, emergency dispatch, crisis lines, or medical triage.
2. No promise of real-time capacity.
3. No automated routing of people to facilities.
4. No scraping personal phone numbers.
5. No undisclosed calls.
6. No repeated calls after opt-out or refusal.
7. No inference that silence means closed.
8. No public claim from voicemail alone unless the field is explicitly the facility's published voicemail statement and labeled as such.
9. No voice cloning or impersonation.
10. No automatic overwriting of an authoritative government source.
11. No general call-center platform.

## Operator experience

### 1. Import

Upload CSV/JSON or paste a directory URL. The importer shows the exact extracted claims and source timestamp. The operator chooses event context, freshness window, quiet hours, call budget, and fields.

### 2. Prioritize

The app ranks candidate facts using:

```text
priority = criticality
         × staleness
         × source uncertainty
         × recent change likelihood
         × expected downstream use
         / expected call cost
```

A stale closing time during an active heat alert ranks above a static mailing address. The rank is inspectable and overrideable.

### 3. Preview

Before any side effect, the app shows:

- facility name and masked phone number;
- exact disclosure and questions;
- fields requested;
- maximum attempts;
- allowed call window;
- stop conditions;
- result schema;
- what happens on refusal, voicemail, ambiguity, and conflict.

The operator confirms a batch. Dry-run is the default.

### 4. Call

CALL-E creates and executes one-recipient call tasks with stable idempotency keys. The caller identifies itself as an automated assistant verifying the published heat-resource listing, states the organization/operator name configured for the demo, keeps the call short, and offers an opt-out.

### 5. Review

Results land as field-level claims:

```text
field: closing_time
value: 18:00 local
status: established | ambiguous | refused | not_asked | unreachable
confidence: provider score + local evidence checks
evidence: transcript span(s)
source: live person | voicemail | automated menu
observed_at: timestamp
expires_at: timestamp
```

The UI highlights changed facts, contradictions, and unsupported extractions. It does not summarize an entire call into one green check.

### 6. Publish

The operator accepts, edits, or rejects each delta. Export options:

- human-readable change report;
- CSV/JSON patch;
- static public status page;
- signed snapshot with source and timestamps;
- list of unresolved facilities requiring manual follow-up.

The original source remains visible beside the proposed update.

## Architecture

```text
Directory import
      |
      v
Claim store + freshness policy
      |
      v
Priority/call-budget planner
      |
      v
Human preview + batch confirmation
      |
      v
CALL-E SDK/API at runtime
 create calls + recipient result schema
      |
      +----> CALL-E managed phone call
      |
      v
Webhook receiver / polling fallback
      |
      v
Idempotent result normalizer
      |
      v
Transcript-evidence validator
      |
   +--+------------------+
   |                     |
   v                     v
conflict/retry queue    reviewable directory delta
   |                     |
   +-----------> human publication gate
```

### Selected stack

- TypeScript, Next.js, and React.
- Node backend with `@call-e/calle` SDK or documented API.
- PostgreSQL for claims, runs, recipients, call attempts, and audit events.
- Webhook endpoint plus polling reconciliation.
- JSON Schema/Zod validation.
- MapLibre only as a secondary geographic view; the evidence ledger is primary.
- Playwright and local fake CALL-E server for end-to-end tests without real calls.
- A committed synthetic directory and controlled test-call harness.

## CALL-E integration

CALL-E must be imported and called at runtime, not mentioned in documentation only.

For each recipient:

```text
create call task
  task: disclosed verification goal + bounded questions
  recipient: published E.164 number and region
  recipient_result_schema: typed field dispositions
  metadata: workflow_run_id, facility_id, schema_version
  webhook_url: result endpoint
  idempotency_key: hash(run, facility, question_set, freshness_window)
```

Use CALL-E's structured results, completion confidence, evidence, transcript, activity, voicemail/hold/transfer handling, batch support, and call governance. The local system remains responsible for whether extracted facts are sufficiently evidenced and whether a change may be published.

## Hard technical core

### 1. Claims, not rows

A directory row is decomposed into independently versioned claims. Each claim stores value, provenance, observation time, expiry policy, evidence, and disposition. “Facility verified” is forbidden because one call may establish hours but not accessibility.

### 2. Call-budget optimization

The free account begins with 20 calls, so the demo should treat scarcity as a product constraint. The planner selects calls maximizing expected risk reduction under budget. It groups questions per site, avoids low-value recency checks, and stops early when remaining candidates cannot exceed a priority threshold.

The algorithm can begin greedily but must publish its features and choice. A later improvement may estimate answer probability and call duration from prior attempts.

### 3. Evidence grounding

A structured value is accepted only if at least one transcript span entails it and the span belongs to the correct speaker/source. Local checks enforce:

- facility identity was confirmed;
- question and response refer to the correct date;
- time has an unambiguous timezone/local-day interpretation;
- yes/no answers are not attached to the wrong question after interruption;
- voicemail evidence is labeled separately;
- no value is invented from the task prompt;
- provider confidence below threshold routes to ambiguity.

For the hackathon, field evidence can be validated with a constrained language model or deterministic matching, but every result retains the source span for human inspection.

### 4. Contradiction state machine

A new phone result may conflict with the published source, another call, or itself. It transitions to one of:

```text
CONFIRMED_UNCHANGED
PROPOSED_CHANGE
AMBIGUOUS
CONTRADICTED
REFUSED
UNREACHABLE
OPTED_OUT
STALE_AGAIN
```

A contradiction never triggers an automatic second call to the same facility. It enters review; a human can authorize one follow-up or select another official source.

### 5. Temporal validity

Facts expire differently:

- activation status: hours;
- today's closing time: end of local day;
- accessibility entrance: weeks unless contradicted;
- phone number/address: months;
- capacity: minutes and therefore not claimed as durable.

The public output displays “checked at,” “source type,” and “valid through” rather than a timeless green check.

### 6. Idempotency and uncertain outcomes

A timeout after call creation may mean the call exists. Never blindly create another. Persist the idempotency key before invoking CALL-E, reconcile by call/run ID, and distinguish:

- plan failed before dial;
- call scheduled;
- in progress;
- completed;
- provider terminal failure;
- local webhook failure;
- unknown external outcome.

Unknown external outcomes halt retries until reconciled.

### 7. Safe publication

Updates are immutable proposals. Publishing creates a new snapshot, preserves the previous one, records reviewer identity, and links each field to evidence. Withdrawal creates another snapshot; it does not erase history. Public pages never expose full transcripts, staff names, or phone numbers beyond already-public directory values.

## Safety and ethics

- Use published organizational numbers only.
- Call during local business hours.
- Disclose automation and purpose at the start.
- Keep questions short and operational.
- Do not pretend to be a resident, official, journalist, or emergency worker.
- Honor refusal and opt-out permanently for the event.
- Rate-limit by organization and parent phone system.
- Never call emergency or crisis lines.
- Do not collect personal names unless volunteered; discard them from public output.
- Redact transcripts and limit retention.
- No silent recording claim beyond CALL-E's documented service behavior; follow applicable consent rules.
- Dry-run and controlled test numbers cover most development.
- Real calls require an operator preview and confirmation.
- A facility's phone statement is evidence, not a guarantee. Public language must retain timestamp and source.

## Test strategy

### Local fake-call matrix

Simulate:

1. clear unchanged answer;
2. clear changed hours;
3. wrong facility reached;
4. voicemail with current hours;
5. voicemail with no date;
6. refusal;
7. opt-out;
8. busy/no answer;
9. ambiguous “usually” response;
10. interrupted question/answer alignment;
11. conflicting staff answers;
12. webhook delivered twice;
13. webhook delayed after poll completion;
14. local crash after external call creation;
15. date rollover and DST boundary;
16. parent organization sharing one number.

### Live proof plan

Use controlled phone endpoints or consenting participants for repeated development calls. Reserve a very small number of real public-resource calls for the final verification, during business hours, with disclosure and no repeated contact. Publish counts and outcomes, including failures.

### Success metrics

- 100% duplicate webhook/idempotency tests produce one attempt/result.
- 0 ambiguous or unreachable calls become confirmed facts.
- Every proposed change has at least one inspectable evidence span.
- Every public claim has timestamp and expiry.
- Opt-out blocks all later plans.
- At least one real CALL-E call completes end to end in the demo environment.
- Reviewers can accept/reject a field without reading the full transcript.

## First 48-hour kill test

The risky assumption is that CALL-E's structured result and transcript evidence can support field-level public claims without the local layer turning into an ungrounded summarizer.

Build:

1. a synthetic five-site directory;
2. one result schema with open status, closing time, and accessibility;
3. a local fake provider for all failure cases;
4. one controlled real CALL-E call to a consenting number acting as a facility;
5. webhook/poll reconciliation;
6. evidence-span display;
7. one changed claim entering human review;
8. one ambiguous answer correctly abstaining.

Kill or narrow if the platform result lacks usable evidence, if dates/times cannot be grounded reliably, if call outcomes cannot be reconciled idempotently, or if the demo needs a human to pretend every extraction is correct.

## Build order

### August 9-11: platform proof

SDK/API call from backend, controlled number, structured result, transcript/evidence capture, masked logs.

### August 12-14: claim model

Directory importer, field provenance, expiry, state machine, synthetic fixtures.

### August 15-17: safe call planning

Preview, disclosures, schemas, call windows, budgets, opt-out, stable idempotency.

### August 18-20: result pipeline

Webhook, polling fallback, deduplication, evidence validator, ambiguity/refusal handling.

### August 21-23: review and publication

Field-level diff, reviewer gate, immutable snapshots, JSON/CSV/static export.

### August 24-26: prioritization

Criticality/staleness ranking, budget-aware selection, early stopping, inspectable rationale.

### August 27-29: conflict workflow

Contradictions, human-authorized follow-up, source comparison, expiry refresh.

### August 30-September 1: interface

Evidence ledger, secondary map, timeline, accessibility, mobile operator view.

### September 2-4: safety testing

Quiet hours, rate limits, parent-number grouping, opt-outs, crash and duplicate events.

### September 5-7: live pilot

Small, disclosed, bounded sample; record every answer/refusal/unreachable result honestly.

### September 8: feature freeze

No new domains or fields. Finalize the cooling-center narrative.

### September 9-10: community contribution

Package runnable app/skill, safety docs, fake-call tests, setup, cancellation, and open PR to `CALLE-AI/awesome-phone-call-agents` in the correct contribution area.

### September 11: submission assets

Architecture diagram, screenshots, Devpost copy, public PR URL, CALL-E account email field.

### September 12: record

Public ~3-minute YouTube/Vimeo video with a real CALL-E run and coherent result.

### September 13

Clean-profile test, PR validation, hosted demo, final submission review.

### September 14 before 6:00 AM PT

Submit with nearly three hours of buffer.

## Demo storyboard, about 3 minutes

- **0:00-0:15:** Show a city cooling-center PDF with a listing highlighted: open until 8 PM, wheelchair entrance, water.
- **0:15-0:32:** Import it. The app decomposes the row into dated claims and ranks its stale closing time as high priority.
- **0:32-0:48:** Preview the exact disclosed call, questions, budget, stop rules, and result schema. Confirm one call.
- **0:48-1:20:** CALL-E runs against the controlled/consenting demo facility. Show live activity and that CALL-E is actually invoked at runtime.
- **1:20-1:42, winning moment:** Result arrives: today it closes at 6, one entrance changed, water confirmed. The old row does not silently turn green; three field-level states update with evidence spans and expiry.
- **1:42-2:02:** A second prerecorded fixture says “usually” and contradicts itself. The system marks it ambiguous and refuses publication.
- **2:02-2:22:** Operator approves two grounded deltas. Static directory snapshot updates with checked-at/source labels.
- **2:22-2:40:** Show call-budget planner skipping low-value calls, opt-out enforcement, and duplicate webhook test.
- **2:40-2:55:** Open the public GitHub PR in `awesome-phone-call-agents`, architecture, and fake-call safety tests.
- **2:55-3:00:** Close: “A phone answer is not truth forever. It is evidence with a timestamp.”

## Rubric map

### Real World Impact

- Identifies a specific failure: stale operational facts in heat-resource directories.
- Phone calls reach facts not reliably published online.
- Prevents wasted or risky trips without claiming to be an emergency service.
- Produces a workflow operators can use after the event.

### Quality of the Idea

- The contribution is not generic calling; it is freshness, prioritization, evidence, uncertainty, and publication policy.
- Bounded schema and specific domain make it reusable without being vague.
- Extends beyond an existing single-verification pattern through temporal batch orchestration and conflict handling.

### Technical Implementation

- CALL-E imported and called at runtime.
- Structured schemas, evidence, webhooks, polling, idempotency, call budgeting, state machine, and immutable snapshots.
- Fake provider and failure matrix make it safe and reproducible.
- Working hosted operator experience and PR contribution.

### Product Experience & Demo

- One coherent flow from stale listing to bounded call to reviewable update.
- Clear preview before real-world side effects.
- Field-level evidence and honest unknown states.
- Three-minute video includes a real platform call and visible outcome.

## Submission requirements

- Open a PR to `https://github.com/CALLE-AI/awesome-phone-call-agents` in the correct contribution area, likely a TypeScript app plus reusable safety/reference material.
- Provide the PR URL on Devpost.
- Public ~3-minute YouTube/Vimeo video.
- CALL-E account email in the required field.
- Optional hosted application URL.
- Public repository with setup, dry run, credentials, side effects, cancellation, safety, and test instructions.
- Devpost name remains blank until explicitly selected.
- Elevator pitch under 200 characters.
- 3:2 thumbnail: stale row -> live call -> evidence-backed delta.
- Gallery: import, preview, live run, evidence review, ambiguity, public snapshot, architecture, PR.

## Repository ownership plan

The early concept sketch has been reconciled with the production ownership
contract in `README.md` and `AGENTS.md`. Use these names; do not recreate the
superseded `apps/web`, `server/`, or split `claims` package layout.

```text
/
├── README.md
├── APPLICATION_STATUS.md
├── apps/
│   └── operator/
├── packages/
│   ├── import/
│   ├── freshness/
│   ├── call-plan/
│   ├── calle/
│   ├── evidence/
│   └── review-publish/
├── tests/
│   ├── fake-calle/
│   ├── fixtures/
│   ├── integration/
│   └── e2e/
├── docs/
├── adr/
├── evidence/
├── scripts/
└── infra/
```

[`APPLICATION_STATUS.md`](./APPLICATION_STATUS.md) distinguishes directories
that contain a narrow foundation boundary from ownership areas that are actually
supported end to end.

## What would make this lose anyway

1. **It looks like a map plus a voice API.** Lead with claim lifecycle, evidence, uncertainty, and call scarcity.
2. **It overstates a phone answer.** Every fact needs source type, timestamp, expiry, and review.
3. **The demo uses only mocks.** At least one real CALL-E runtime call must complete.
4. **Real calls bother facilities.** Use controlled numbers for development and a tiny disclosed pilot.
5. **Ambiguous calls become data.** Abstention is a feature judges must see.
6. **It duplicates `verify-by-phone`.** The contribution must visibly add multi-site prioritization, temporal claims, conflict resolution, publication, and budget optimization.
7. **A crash sends duplicate calls.** Idempotency and uncertain-outcome reconciliation are non-negotiable.
8. **The user cannot inspect what will be said.** Preview precedes every real batch.
9. **The problem sounds hypothetical.** Use a real public directory and truthfully report the bounded pilot's outcomes, including no-answer and refusal.
10. **The PR is opened late or in the wrong area.** Validate contribution structure before the final week.

The winning version is useful precisely because it refuses to convert every phone call into certainty.
