# Application status and next-agent handoff

> **Current state:** not yet in production.
>
> **Application baseline audited:** `a4da97327bbda9fa308bccf884e5bee00da85c21`
> on 2026-08-10. Documentation and Tier 0 verification repairs after that
> baseline do not add an operator workflow or enable real calls.
>
> This file is the current-state companion to the append-only
> [`PROGRESS.md`](./PROGRESS.md) journal. Update this file when the implementation
> changes; append the commands and evidence for the change to `PROGRESS.md`.

## How to use this file

Start here after reading the authoritative documents in the order required by
[`AGENTS.md`](./AGENTS.md): `HACKATHON.md`, `WINNING_IDEA.md`, `README.md`,
`AGENTS.md`, then `GOAL.md`.

Status terms in this document are deliberately strict:

- **Verified:** the named behavior exists and its stated check passed for the
  audited baseline.
- **Partial:** a useful production-shaped boundary exists, but the end-to-end
  behavior or required failure coverage does not.
- **Not implemented:** no supported product behavior exists for that surface.
- **Failing gate:** a required verification surface is red, so the tier cannot
  be treated as exited.
- **Verification pending:** local behavior is green, but a required committed or
  remote proof has not completed yet.
- **External prerequisite:** work needs a credential, provider decision,
  consent record, or third-party action. It does not block unrelated local work.

Do not turn these labels into percentages. The tiers and production conditions
in `GOAL.md` are conjunctive; a percentage would imply precision the repository
cannot regenerate.

## Executive status

The repository has a substantial **Tier 0 foundation** and several early typed
domain boundaries. The exact toolchain, repository-isolated runtime, semantic
health checks, dependency policy, architecture rules, local fake-provider
boundary, and readiness-only operator UI exist. A stable local `pnpm verify-all`
run passed all current format, lint, type, architecture, dependency, audit, unit,
build, lifecycle, semantic-health, integration, and Chromium E2E steps on
2026-08-10. This proves the local foundation only; it does not prove the product
workflow or production conditions.

The application workflow does **not** yet exist end to end. There is no directory
upload/import pipeline, application data schema, persistent call-plan approval,
CALL-E REST adapter, webhook/poll reconciler, transcript grounding engine,
conflict queue, authenticated review flow, immutable snapshot publisher, hosted
environment, live pilot, or submission artifact.

Tier 0 remains **in progress** until the repaired revision passes both
`pnpm verify:clean-checkout` and GitHub Actions on `main`. The preceding
[GitHub Actions run 31402729203](https://github.com/rishabhcli/call-e-your-code-is-calling/actions/runs/31402729203)
failed because `actions/setup-node` tried to locate pnpm before the next step
activated the pinned pnpm binary; the workflow now disables that premature
automatic cache. The earlier semantic-health timeout occurred while tracked
documentation changed after `dev:up`, which intentionally changed the source
revision expected by every readiness document. A stable-source rerun passed.

## End-goal ladder

| Goal tier                             | Current status           | What exists                                                                                                                                                                                                                                                 | Exit-blocking gap                                                                                                                                                                 |
| ------------------------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **0 — Executable foundation**         | **Verification pending** | Exact Node/pnpm contract, frozen lockfile, CI workflow, strict checks, boundary enforcement, isolated ports/processes/Compose, semantic health, ADRs, dependency register, local fake provider, unit/integration/E2E harnesses; local `verify-all` is green | The repaired committed revision still needs a green clean-checkout run and a green `main` Actions run linked from the journal                                                     |
| **1 — Machine-enforced invariants**   | **Partial**              | Schemas and narrow tests cover temporal claims, approved plan construction, safety refusals, idempotency-key derivation, established-only publication candidates, and public projection without transcript excerpts                                         | All eight invariants still lack complete property/fault/observability/database enforcement; see the invariant audit below                                                         |
| **2 — Hard technical core**           | **Partial**              | Initial claim, priority, call-plan, external-call-state, evidence, and public-delta types                                                                                                                                                                   | No complete importer, budget optimizer, provider adapter/reconciler, grounding validator, conflict workflow, persistence, or run ledger                                           |
| **3 — Adapters and trust boundaries** | **Partial**              | Zod runtime configuration, bounded local HTTP services, dependency boundary rules, test-only fake provider, foundation threat model                                                                                                                         | No real directory parser, provider contract fixture/adapter, webhook boundary, file quarantine, authentication, or per-boundary threat analysis                                   |
| **4 — First vertical slice**          | **Not implemented**      | Readiness-only UI and services                                                                                                                                                                                                                              | The eight-step canonical operator workflow cannot be performed                                                                                                                    |
| **5 — Refusal and abstention**        | **Partial**              | `compileApprovedCallPlan` refuses several unsafe drafts; publication schema excludes non-established evidence                                                                                                                                               | Refusals are not connected to persistent state, provider invocation, review UI, public unknown states, cancellation, or recovery                                                  |
| **6 — Complete ownership areas**      | **Not implemented**      | Every planned package directory exists with an initial narrow boundary                                                                                                                                                                                      | None of the six packages or the operator app is a complete production surface                                                                                                     |
| **7 — Verification lattice**          | **Partial**              | 12 unit tests, 8 integration tests, 2 Chromium E2E smoke tests, strict format/lint/type/boundary/dependency checks                                                                                                                                          | Property/fuzz, provider contract, domain E2E, evaluation, authorization/privacy, accessibility, performance, resilience, mutation, and coverage gates are absent                  |
| **8 — Evaluation and regeneration**   | **Not implemented**      | Verification commands emit transient local summaries                                                                                                                                                                                                        | No immutable manifests, held-out corpus, metric regeneration, byte-identical delta reproduction, or committed evidence artifacts                                                  |
| **9 — Performance and chaos**         | **Not implemented**      | Initial HTTP/database/collector limits exist                                                                                                                                                                                                                | No declared product budgets, load-to-failure result, chaos matrix, lifecycle crash-point sweep, or enforced performance gate                                                      |
| **10 — Security and supply chain**    | **Partial**              | Exact dependency/image pins, advisory check, dependency register, log redaction list, foundation threat model                                                                                                                                               | No authentication/authorization model, webhook authenticity implementation, transcript access controls, SBOM/release manifest, malicious-input matrix, or complete privacy review |
| **11 — Operational readiness**        | **Partial**              | Typed startup config, live/readiness distinction, local structured logs, PostgreSQL readiness migration, local OpenTelemetry canary                                                                                                                         | No production telemetry destination/dashboard, SLOs, alerts/runbooks, backup/restore drill, deployment/rollback, emergency disable, retention, or incident process                |
| **12 — Production cutover**           | **Not implemented**      | None                                                                                                                                                                                                                                                        | Every production condition in `GOAL.md` section 5 remains unmet                                                                                                                   |
| **13 — Submission**                   | **Not implemented**      | Hackathon requirements and selected demo narrative are documented                                                                                                                                                                                           | No product name, hosted workflow, community PR, public demo video, screenshots, Devpost content, or final submission                                                              |

## Current implementation by ownership area

### `packages/import` — partial schema boundary

**Present**

- Runtime-validated canonical claims with provenance, criticality, observed time,
  and expiry.
- Nine modeled claim kinds: activation status, closing time, address,
  wheelchair accessibility, water, charging, pet policy, overnight operation,
  and phone.
- Rejection of expired-at-observation claims and unmodeled claim kinds.

**Missing before this area is supported**

- CSV/JSON/PDF ingestion, size limits, source fetch policy, quarantine, and
  actionable parse errors.
- Facility and source-directory schemas, source snapshots, record-to-claim
  decomposition, stable versioning, migrations, rollback, and retention.
- Property/fuzz and fixture-driven parser tests.

### `packages/freshness` — partial calculation boundary

**Present**

- Versioned, inspectable `priority-v1` formula for one already-canonical claim.
- Runtime bounds for caller-supplied priority features.

**Missing before this area is supported**

- Freshness/expiry policy by claim type, staleness calculation, and event context.
- Ranking and selection under a hard call budget, question grouping, parent-number
  grouping, deterministic tie-breaking, early stopping, overrides, and persisted
  rationale.
- Correctness oracle, baselines/ablations, property tests, and evaluation data.

### `packages/call-plan` — partial compile-time safety boundary

**Present**

- Typed draft, approval, and approved-plan contracts.
- Refusal codes for unpublished organizational numbers, emergency/crisis targets,
  opt-outs, quiet hours, facility rate windows, invalid input, and expired approval.
- Bounded questions, attempts, disclosure length, E.164 syntax, and contact window.

**Missing before this area is supported**

- A digest computed from the exact plan and cryptographically compared with the
  approval rather than accepted as an input string.
- Authoritative emergency/crisis classification and persistent opt-out/contact
  history across runs and shared parent numbers.
- Database authority, atomic approval transition, preview UI, audit event,
  cancellation, property/fault tests, and production alert/runbook.

### `packages/calle` — interface only

**Present**

- Stable SHA-256 idempotency-key derivation from an approved plan.
- Tagged external call states, including a mandatory reconciliation state for an
  unknown external outcome.
- A gateway interface that requires cancellation signals.

**Missing before this area is supported**

- The documented CALL-E REST adapter, pinned OpenAPI fixture, request/response
  schemas, credential boundary, timeouts, retry classification, and provider
  error mapping.
- Persist-before-create operation records, atomic state transitions, replay of the
  exact request body, canonical GET reconciliation, webhook normalization and
  deduplication, polling, restart recovery, and crash/fault tests.
- A real CALL-E runtime proof. The local fake server never dials a phone.

### `packages/evidence` — schemas only

**Present**

- Established and non-established field-evidence schemas.
- Established evidence requires source type, timestamp, expiry, and at least one
  speaker/date/entity-confirmed span.

**Missing before this area is supported**

- Any grounding implementation or test suite.
- Question/answer alignment, entity/date/time/timezone resolution, speaker
  validation, voicemail policy, contradiction detection, confidence calibration,
  abstention logic, redaction pipeline, and labeled transcript corpus.

### `packages/review-publish` — in-memory projection boundary only

**Present**

- Publication candidates accept only established evidence with an approved review.
- Public deltas retain reviewer, temporal validity, source type, and evidence span
  IDs while omitting the redacted transcript excerpt.

**Missing before this area is supported**

- Persistent conflict/review queue, reviewer authorization, stale-evidence checks,
  atomic approval, immutable snapshots/deltas, rollback-by-new-snapshot, concurrent
  review handling, exports, and public feed.
- Database constraints and fault/property/E2E tests proving non-established or
  superseded evidence cannot publish.

### `apps/operator` and local infrastructure — foundation only

**Present**

- A server-rendered page showing live API/worker readiness and an explicit
  “not yet in production / real calls disabled” limitation.
- Dependency-aware `/livez` and `/readyz` surfaces, typed configuration, bounded
  database pools/HTTP timeouts, structured Pino logs, and loopback-only runtime.
- Real local PostgreSQL and OpenTelemetry Collector services, an end-to-end
  telemetry health canary, and a readiness-only database migration.
- Four fake-provider fixtures: changed hours, refusal, no answer, and ambiguity.

**Missing before this area is supported**

- Authentication and separate planner/caller/reconciler/reviewer/publisher
  authorization.
- Import, priority, preview, approval, run, evidence, review, conflict, audit,
  publication, and recovery interfaces.
- Application tables and migrations; the database currently records only the
  readiness migration version.
- Designed loading/empty/partial/stale/offline/permission/cancel/failure/recovery
  states, accessibility audit, responsive workflow, and performance budgets.
- The remaining fake-provider matrix, including wrong facility, voicemail, IVR,
  duplicate/out-of-order webhook, partial audio, delayed events, and crash after
  create.

## Domain invariant audit

| Invariant                                                          | Present defense                                                                                         | Why it remains partial                                                                                             | Next proof required                                                                                                       |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| **I1. No call before inspectable approval**                        | The caller gateway accepts `ApprovedCallPlan`; the compiler requires an approval object                 | Approval digest is not bound to the draft; no persistent/atomic authority or provider caller exists                | Compute/verify the exact plan digest, persist approval and operation atomically, then property/fault-test bypass attempts |
| **I2. Emergency/crisis and opted-out recipients blocked**          | Compiler refuses boolean-marked emergency targets and non-null opt-out timestamps                       | Flags are caller-supplied and there is no authoritative classification or cross-run opt-out store                  | Add authoritative recipient policy and persistent facility/parent-number enforcement with refusal tests                   |
| **I3. No blind duplicate after uncertain create**                  | Stable key derivation and `unknown_external_outcome` type exist                                         | No persist-before-create operation, adapter, reconciler, or crash recovery exists                                  | Implement the operation state machine and inject timeout/crash/duplicate/out-of-order faults                              |
| **I4. Every published field has evidence, time, expiry, reviewer** | Publication schema requires established evidence and approved reviewer; public delta carries the fields | No database constraint, authorization, immutable snapshot store, or transaction exists                             | Add persistence constraints and transactional publication/restart tests                                                   |
| **I5. Non-established outcomes never become facts**                | Publication candidate schema rejects ambiguous/refused/unreachable/not-asked evidence                   | No normalizer, review queue, public unknown representation, or whole-path E2E test exists                          | Implement outcome routing and prove each disposition through publication refusal                                          |
| **I6. Contact/rate windows hold across runs**                      | Compiler checks a supplied last-contact time and local window                                           | The value is not read atomically from authoritative storage; shared parent numbers are unmodeled                   | Add persistent contact authority and concurrent-run/property tests                                                        |
| **I7. Transcripts/staff identities stay private**                  | Public delta projects evidence IDs rather than excerpts; Pino has structural secret paths               | No transcript store, access-control layer, staff-identity redaction, export policy, or authorization matrix exists | Define retention/access/redaction model before transcript ingestion, then attack it with privacy tests                    |
| **I8. Phone statement is temporal evidence**                       | Claim/evidence/public-delta schemas require observed and expiry timestamps                              | No temporal persistence queries, expiry transition, stale UI, or public feed exists                                | Make timeless persistence unrepresentable and test expiry/review/public rendering across date boundaries                  |

No invariant yet has all five artifacts required by `GOAL.md` Tier 1: machine
encoding, property test, fault scenario, boundary behavior, and production
alert/runbook.

## Verification snapshot

### Verified during this audit

Commands used the required Node 24.19.0 and pnpm 11.20.0:

```text
pnpm dev:preflight  # passed
pnpm dev:up         # passed
pnpm dev:health     # operator, API, fake CALL-E, worker, test harness,
                    # PostgreSQL query, and OpenTelemetry canary passed
pnpm test           # 7 files, 12 tests passed
pnpm dev:down       # stopped only validated repository-owned resources
pnpm verify-all     # all current checks passed, including 8 integration tests
                    # and 2 Chromium E2E smoke tests
```

The full local verification passed with 12 unit tests, 8 integration tests, and
2 Chromium E2E smoke tests. `pnpm test:e2e` also proved that its repository-owned
services are removed after the standalone test command. Test counts describe
inventory only; they are not a coverage or correctness claim.

### Not currently proven

- The repaired committed revision does not yet have a green
  `pnpm verify:clean-checkout` result recorded in this handoff.
- The repaired workflow does not yet have a green `main` Actions run; the last
  completed run is the historical setup failure linked above.
- `evidence/` contains policy documentation only; it contains no committed,
  regenerable result artifact yet.
- Coverage, mutation, property/fuzz, accessibility, security authorization,
  performance, chaos, and domain evaluation evidence do not exist.

## Ordered work queue for the next agent

Follow `GOAL.md` section 10.1. Based on this audit, the queue starts here:

1. **Finish Tier 0 verification.** Run `pnpm verify:clean-checkout` at the
   committed repair revision, push, and confirm the resulting `main` Actions run
   is green. Append the exact run URL and commands to `PROGRESS.md`, then refresh
   this file. If either fails, that failure remains the first work item.
2. **Complete Tier 1 before broad feature work.** For each invariant above, add
   the missing machine authority, property test, fault case, boundary behavior,
   and observable alert/runbook link. Start with I1 and I3 because they guard a
   real-world side effect and duplicate dialing.
3. **Build the persistent call-operation slice.** Add the PostgreSQL schema and
   migrations for source snapshot, facility, plan, approval, call operation,
   attempt, and audit ownership. Bind the exact preview digest to approval and
   persist the idempotency operation before any provider request. Document
   forward/backward migration and rollback in an ADR.
4. **Implement the documented CALL-E adapter behind `packages/calle`.** Pin the
   provider contract fixture, validate provider output, use bounded deadlines,
   replay only the exact idempotent request after transport uncertainty, and
   reconcile canonically. Keep live mode structurally impossible in local/test.
5. **Expand the fake provider and prove recovery.** Add webhook/poll delivery,
   duplicate/out-of-order/delayed events, wrong facility, voicemail, IVR,
   malformed output, and crash-after-create scenarios before a live proof.
6. **Run the concept kill test with a controlled consenting endpoint.** This is
   an external-prerequisite step only when a CALL-E credential and written
   consent are actually needed. Record raw sanitized evidence; do not call a
   public resource during development.

Do not build the map, submission visuals, or a generic calling surface while the
Tier 0 gate or any side-effect invariant is red.

## External prerequisites and non-blocking decisions

- `@call-e/calle@0.6.0` had no declared license in the 2026-08-09 review. ADR-0002
  selects the documented REST API, so SDK license clarification does not block
  current adapter work.
- A live pilot needs CALL-E credentials, provider terms/use-case confirmation,
  and written consent from controlled recipients. None is needed for the next
  local persistence, adapter-contract, fake-provider, and invariant work.
- No product name has been assigned. Continue using descriptive component names.

## Update checklist

When implementation changes:

1. Re-audit the affected package, invariant, goal tier, support-matrix row, threat
   boundary, and README claim.
2. Replace current-state statements in this file; do not preserve stale status for
   history.
3. Append historical commands/evidence/risks/rollback/next work to `PROGRESS.md`.
4. Link committed evidence or a CI run for every new “Verified” label.
5. Keep unsupported and partially supported behavior explicit where an operator
   would act on it.
