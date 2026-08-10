# AGENTS.md

> **Repository:** CALL-E: Your Code Is Calling
> **Product-name status:** unassigned; do not invent one.

## Scope

These instructions apply to every file and subdirectory in this repository. They are binding for coding agents, review agents, automation, and human contributors unless the user gives a more specific instruction.

## Read order and authority

Before planning or editing, read in this order:

1. `HACKATHON.md` for external requirements and deadlines.
2. `WINNING_IDEA.md` for the selected concept, technical core, validation, and scope.
3. `README.md` for the production product and operating contract.
4. This file for implementation discipline.
5. `GOAL.md` for the standing goal-mode contract: the parallel-execution and dev-server port block (§0A), what "production has occurred" means here (§5), the Tier 0-13 ladder (§6), the perpetual epoch engine (§7), the ratchet table (§8), and the work-selection algorithm (§10). `GOAL.md` governs *how long* the work runs and *in what order*; this file governs *how* it is built. Neither overrides `HACKATHON.md`.
6. `APPLICATION_STATUS.md` for the evidence-based implementation snapshot,
   invariant gaps, verification truth, and ordered next-agent handoff. Then read
   the latest `PROGRESS.md` entry, `BLOCKED.md`, and `ASSUMPTIONS.md` before
   selecting work.

Do not infer missing requirements from another hackathon repository. If two documents conflict, stop the affected implementation path, identify the exact conflict, and resolve it in an ADR or user instruction. Do not silently choose the easier interpretation.

## Mission

Operate a safe production workflow that decomposes cooling-center listings into expiring claims, prioritizes the highest-risk stale facts, previews and places disclosed CALL-E calls, grounds every proposed update in transcript evidence, handles ambiguity and conflicts, and publishes only human-approved timestamped deltas.

## Production posture: no MVP track

This repository does not permit an MVP, proof-of-concept, demo-only fork, or “make it work now, harden later” path. The target is a deployable, supportable product. Build in small vertical slices when useful, but every merged slice must already honor production boundaries.

The following are not acceptable in shipped code:

- placeholder implementations, no-op handlers, hardcoded success, fake metrics, canned model/provider results, or static hero data presented as live;
- runtime mocks, demo flags that bypass safety/correctness, or separate judging-only behavior;
- unbounded retries, swallowed exceptions, empty catch blocks, silent fallback to a different algorithm/data source, or success after partial failure;
- undocumented environment variables, secrets in source/logs, mutable global configuration, or production behavior selected by branch name;
- TODO/FIXME comments standing in for correctness, security, privacy, accessibility, migration, rollback, or test work;
- broad interfaces with unvalidated dictionaries/`any` values where a domain type or schema is possible;
- adding scope because it is visually impressive while a core invariant or release gate is still failing.

A temporary test double is allowed only inside tests and must model failure as well as success. A spike may exist on an explicitly disposable branch, but none of it is merged until rewritten to the production contract.

## Product boundaries

### Intended users

- City resilience/public-health teams and 211 partners
- Mutual-aid organizations and local newsrooms maintaining directories
- Residents relying on current cooling/heat-relief information

### Canonical workflow

1. Import and version a source directory
2. Decompose rows into claims with criticality, provenance, and expiry
3. Plan calls under budget, quiet hours, rate limits, and opt-outs
4. Preview exact disclosure/questions/schema and obtain batch approval
5. Invoke CALL-E with stable idempotency and bounded attempts
6. Normalize webhook/poll results and validate field-level evidence
7. Route changed, ambiguous, refused, unreachable, or contradictory claims
8. Require human review before publishing an immutable updated snapshot

### Out of scope until explicitly approved

- Emergency dispatch, crisis/911 calling, medical triage, or live capacity guarantee
- Undisclosed or repeated calls
- Silence interpreted as closure
- Automatic overwrite of authoritative sources
- Generic calling platform or map-first directory app

Do not create a product name, marketing identity, pricing promise, partnership claim, or new target user without explicit user approval. Use descriptive component names only.

## Domain invariants

Every change must preserve these rules:

1. No real call is created before an inspectable plan is approved
2. Emergency/crisis numbers and opted-out recipients are blocked
3. A timeout after call creation never triggers blind duplicate dialing
4. Every published field has evidence, source type, observed time, expiry, and reviewer
5. Ambiguous/refused/unreachable outcomes never become facts
6. One facility respects configured contact/rate windows across runs
7. Transcripts and staff identities are not exposed publicly
8. A phone statement is evidence at a time, never timeless truth

Treat invariant violations as defects even when the happy-path demo still works. Encode invariants in types, database constraints, protocol schemas, assertions at trust boundaries, and tests. Do not rely on comments or UI copy alone.

## Architecture and ownership

Authenticated operator service with separate planner, caller, reconciler, reviewer, and publisher authorities. Real calls are disabled by default outside configured environments and require preview/approval.

| Area | Production responsibility |
|---|---|
| `packages/import` | Source parsing, canonical claims, provenance, snapshots |
| `packages/freshness` | Expiry/criticality and call-budget prioritization |
| `packages/call-plan` | Disclosure, question schema, quiet hours, preview, opt-out |
| `packages/calle` | Idempotent create/status/webhook normalization |
| `packages/evidence` | Speaker/date/entity grounding and ambiguity |
| `packages/review-publish` | Conflict queue, approval, immutable deltas |
| `apps/operator` | Run ledger, evidence, map secondary view, audit |

Rules for boundaries:

- Domain packages may not import UI, transport, cloud SDK, or framework state.
- Adapters translate external formats into validated domain types and retain provenance.
- Applications orchestrate domain capabilities; they do not reimplement algorithms or policy.
- Persistent data has a single authoritative owner, explicit schema/version, migration, retention, and rollback story.
- External SDK/provider objects do not cross the adapter boundary.
- Cross-component communication uses typed, versioned contracts and idempotency where delivery can repeat.
- Avoid circular dependencies, catch-all `utils` modules, and business logic in controllers/components.
- New top-level components require an ADR explaining ownership, dependencies, failure model, and operational cost.

### Approved technical direction

- TypeScript/Node and React/Next.js
- @call-e/calle SDK or documented API at runtime
- PostgreSQL claim/run/audit store
- Webhook receiver plus polling reconciler
- JSON Schema/Zod typed results
- Local fake CALL-E service, Playwright, safety and idempotency tests

Do not substitute a stack merely because an agent knows it better. A change must improve the production requirements and include migration/operational analysis.

## Data, model, and algorithm rules

- Define schemas at ingestion and reject or quarantine invalid input; never let malformed data drift into domain logic.
- Retain provenance, units, timestamps/timezones, versions, and uncertainty needed to reproduce a result.
- Separate training/tuning, validation, and held-out evaluation by immutable manifest when ML/statistics are used.
- Keep deterministic baselines and ablations beside learned methods.
- Seed randomized tests/jobs and record seeds in artifacts.
- Never print a benchmark, accuracy, health, environmental, financial, or impact claim that a committed command cannot regenerate.
- Prefer explicit abstention/refusal over an invented value.
- Version algorithms, prompts, model identifiers, content packs, calibration, schemas, and policy that can change outputs.
- Treat external model/provider output as untrusted and validate it against a typed schema and deterministic rules.

Project-specific verification surfaces:

- Clear/ambiguous/refused/voicemail/wrong-facility/opt-out outcomes
- Duplicate/out-of-order webhook and crash after external creation
- Date/time/timezone/question-answer grounding
- Parent number shared by multiple sites and rate limits
- Publication approval, rollback/new snapshot, expiry
- Live CALL-E proof plus comprehensive fake-provider E2E

## Security, privacy, and safety rules

- Published organizational numbers only and local business hours
- Automation and purpose disclosed at call start
- Strict retention/redaction and least-privilege transcript access
- Dry-run/fake provider for development; tiny consented live pilot

Additionally:

- Run a threat analysis before adding a new external input, credential, file parser, network target, side effect, or public endpoint.
- Enforce authentication and authorization server-side and at data access; client checks are only UX.
- Use least-privilege service identities and short-lived credentials where available.
- Redact secrets and sensitive values structurally, not with best-effort string replacement.
- Set size, time, concurrency, memory, and rate limits at every untrusted boundary.
- Validate redirects, URLs, file types, decompression, archive contents, and callback/webhook authenticity as relevant.
- Any real-world side effect must be previewable or policy-authorized, idempotent where possible, auditable, cancellable when possible, and reconciled after uncertain outcomes.
- Security controls may fail closed; they may never silently disable themselves for a demo.

## Implementation standards

### Types and contracts

- Use the strictest practical compiler/type settings.
- Validate runtime boundaries even when compile-time types exist.
- Represent domain states with explicit enums/tagged unions; make invalid transitions unrepresentable where possible.
- Include units in type/name, and use explicit timezone-aware types for time.
- Version serialized contracts before compatibility matters, not afterward.

### Errors and cancellation

- Errors have stable codes, safe user messages, internal context, and retryability classification.
- Preserve root causes without leaking secrets.
- Propagate cancellation and deadlines across workers, network calls, model calls, and child processes.
- Cleanup is idempotent and tested after cancellation/crash.

### Concurrency and persistence

- State transitions are atomic at the authoritative store.
- At-least-once delivery is assumed unless the boundary proves otherwise.
- Use idempotency keys and reconciliation for external operations.
- Never solve a monetary, safety, or authority race with an eventually consistent cache.
- Schema migrations are forward/backward compatible over the declared rollout window and include rollback or roll-forward recovery.

### Observability

- Use structured logs, metrics, and traces with stable event names and correlation/run IDs.
- Record decisions, versions, durations, retries, refusals/abstentions, and terminal outcomes.
- Do not log raw user content, credentials, sensitive media, health data, private locations, or full third-party transcripts unless an approved encrypted retention policy requires it.
- Every alert links to a runbook and measures user impact, not merely infrastructure noise.

### Dependencies

- Pin direct and transitive dependencies with a lockfile.
- Check license, maintenance, security history, binary/native implications, and bundle/runtime cost.
- Wrap external SDKs behind adapters.
- Generate an SBOM/release manifest for deployable artifacts.

## Testing requirements

A change is incomplete until the relevant layers pass:

1. **Unit tests:** pure domain rules, parsing, transitions, math and errors.
2. **Property/fuzz tests:** serialization, state machines, geometry/signal/solver spaces, parser robustness, and invariants.
3. **Integration tests:** real database/filesystem/browser/device/cloud/provider boundary in an isolated environment.
4. **Contract tests:** schemas and adapters against recorded/versioned fixtures, including provider drift.
5. **End-to-end tests:** complete user outcome, invalid input, cancellation, retry, restart, and recovery.
6. **Evaluation:** held-out domain metrics, baselines, calibration/uncertainty and reproducible artifact.
7. **Security/privacy:** authorization, injection, secret/log redaction, malicious input, rate/size limits.
8. **Accessibility:** keyboard, screen reader semantics, focus, contrast, reduced motion and non-visual equivalents.
9. **Performance/resilience:** latency/memory/frame/bundle/job budgets, load, resource exhaustion, dependency outage and fault injection.

Do not weaken, skip, quarantine, or mark flaky a failing test to merge. Fix the cause or document a reviewed removal of an invalid test. Test the failure path with the same seriousness as success.

## User experience rules

- The primary user outcome must be reachable without developer narration.
- Loading, empty, partial, stale, offline, unsupported, permission-denied, canceled, failed, and recovered states are designed states.
- Never use a green/success state for unknown, partial, low-confidence, or unverified output.
- Accessibility and responsive behavior are implemented with the component, not after feature freeze.
- No dead controls, fake progress, optimistic success before durable completion, or hidden destructive action.
- Technical evidence and limitations must be visible where users act on the result.

## Operational readiness

Before a production deployment exists, implement and document:

- typed environment/configuration validation;
- health and readiness semantics;
- SLOs and error-budget indicators;
- redacted logs, metrics, traces and dashboards;
- backup/restore and data migration where state exists;
- deployment, rollback, and emergency-disable procedures;
- resource ownership/TTL/cleanup;
- incident severity, escalation, and post-incident evidence;
- support matrix and known limitations.

Local and test environments must make real-world side effects impossible by default. Staging is production-shaped with synthetic/de-identified data.

## Release gates

1. Zero duplicate calls in fault/idempotency suite
2. No non-established outcome publishes
3. Every delta traces to evidence and review
4. Opt-out/emergency/quiet-hour safeguards pass
5. Transcript privacy and access controls pass
6. CALL-E runtime integration, community PR, hosted workflow, and demo are reproducible

No agent may waive a gate. If a gate is impossible or invalid, produce evidence, propose a replacement with equal or stronger protection, and wait for review before changing it.

## Prohibited shortcuts

- Calling an emergency or crisis line
- Auto-publishing a provider summary without local evidence validation
- Hiding side effects behind an agent action
- Presenting a map while claim freshness/audit remains incomplete

Also prohibited: empty scaffolding presented as progress, mass-generated boilerplate without ownership, copying code from another project without license/provenance review, demo-only auth or secrets, fabricated user research, fabricated benchmark results, and screenshots that imply unimplemented functionality.

## Required agent workflow

1. **Inspect:** read all authoritative docs, repository state, tests, configs, and relevant dependencies before editing.
2. **State the slice:** define the production user outcome, boundaries touched, invariants, threats, data migrations, observability, and acceptance tests.
3. **Design:** add/update an ADR for a new architectural dependency, persistent schema, external side effect, model, security boundary, or major algorithm.
4. **Implement vertically:** domain logic, adapter, UI/API, error states, telemetry, migrations, and documentation together.
5. **Verify:** run formatting, static analysis, unit/property, integration, E2E, domain evaluation, security, accessibility, and performance checks that apply.
6. **Review:** inspect the diff for cross-project leakage, fake data, secrets, permissive fallbacks, dead code, and weakened claims.
7. **Handoff:** report behavior delivered, commands run, evidence/metrics, risks, migrations, rollback, and remaining blocked items.

Do not stop at a plan when the user asked for implementation. Do not claim completion based on compilation or a single happy-path screenshot.

## Definition of done

A task is done only when:

- the supported user outcome works end to end in the intended environment;
- domain invariants are encoded and tested;
- invalid, unsupported, low-confidence, and dependency-failure paths are correct;
- authorization, privacy, safety, accessibility and performance requirements pass;
- observability makes success and failure diagnosable without exposing sensitive data;
- migrations, deployment, rollback and cleanup are reproducible;
- documentation and architecture match the implementation;
- no placeholders, stubs, hidden demo paths, unverified claims, or production TODOs remain;
- release gates relevant to the change pass from a clean checkout.

## Commit and review hygiene

Keep commits coherent and reviewable. Never mix generated artifacts, unrelated formatting, or cross-repository changes into a feature commit. Do not rewrite public history unless explicitly instructed. Before push, verify the exact staged file list, inspect the diff, and ensure no credential or sensitive fixture is included.
