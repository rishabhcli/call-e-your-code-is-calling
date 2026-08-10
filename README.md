# CALL-E: Your Code Is Calling

> Evidence-backed, budgeted phone verification for time-sensitive emergency resource directories.

> **Production intent:** this repository is for the complete, reliable system described below. It is not an MVP, disposable demo, or thin hackathon facade. No product name has been assigned; the hackathon title remains the repository heading until the user chooses one.

## Repository status

Implementation has not started. The repository currently contains the authoritative product and competition specifications. This README defines the production target that future code must satisfy; it does not claim that planned commands or components already exist.

| Document | Authority |
|---|---|
| [HACKATHON.md](./HACKATHON.md) | Eligibility, mandatory submission fields, judging criteria, deadlines, links |
| [WINNING_IDEA.md](./WINNING_IDEA.md) | Selected concept, hard technical core, validation, build order, demo and risk analysis |
| [README.md](./README.md) | Product contract, architecture, production and release expectations |
| [AGENTS.md](./AGENTS.md) | Binding implementation rules for every coding agent working in this repository |

If these documents disagree, preserve the external requirements in HACKATHON.md, then the product intent in WINNING_IDEA.md, and resolve the conflict explicitly in an ADR instead of guessing.

## Product contract

Operate a safe production workflow that decomposes cooling-center listings into expiring claims, prioritizes the highest-risk stale facts, previews and places disclosed CALL-E calls, grounds every proposed update in transcript evidence, handles ambiguity and conflicts, and publishes only human-approved timestamped deltas.

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

### Explicit non-goals

- Emergency dispatch, crisis/911 calling, medical triage, or live capacity guarantee
- Undisclosed or repeated calls
- Silence interpreted as closure
- Automatic overwrite of authoritative sources
- Generic calling platform or map-first directory app

A non-goal may become part of the product only after the core release gates pass and an ADR explains why the additional surface does not weaken correctness, safety, usability, or schedule.

## Production architecture

Authenticated operator service with separate planner, caller, reconciler, reviewer, and publisher authorities. Real calls are disabled by default outside configured environments and require preview/approval.

### Planned component boundaries

| Area | Production responsibility |
|---|---|
| `packages/import` | Source parsing, canonical claims, provenance, snapshots |
| `packages/freshness` | Expiry/criticality and call-budget prioritization |
| `packages/call-plan` | Disclosure, question schema, quiet hours, preview, opt-out |
| `packages/calle` | Idempotent create/status/webhook normalization |
| `packages/evidence` | Speaker/date/entity grounding and ambiguity |
| `packages/review-publish` | Conflict queue, approval, immutable deltas |
| `apps/operator` | Run ledger, evidence, map secondary view, audit |

Dependencies should flow from applications/adapters toward typed domain packages. Domain logic must remain testable without UI, network, cloud credentials, or third-party services. Infrastructure code may assemble components but must not become the only place where product invariants are enforced.

### Target technology foundation

- TypeScript/Node and React/Next.js
- @call-e/calle SDK or documented API at runtime
- PostgreSQL claim/run/audit store
- Webhook receiver plus polling reconciler
- JSON Schema/Zod typed results
- Local fake CALL-E service, Playwright, safety and idempotency tests

Technology choices are constraints, not decorations. A dependency is accepted only when its operational behavior, license, failure modes, supply-chain risk, and replacement boundary are understood.

## Non-negotiable invariants

1. No real call is created before an inspectable plan is approved
2. Emergency/crisis numbers and opted-out recipients are blocked
3. A timeout after call creation never triggers blind duplicate dialing
4. Every published field has evidence, source type, observed time, expiry, and reviewer
5. Ambiguous/refused/unreachable outcomes never become facts
6. One facility respects configured contact/rate windows across runs
7. Transcripts and staff identities are not exposed publicly
8. A phone statement is evidence at a time, never timeless truth

Any change that can violate an invariant requires a written design review, tests demonstrating preservation under failure, and an explicit update to this README and AGENTS.md.

## Security, privacy, and safety

- Published organizational numbers only and local business hours
- Automation and purpose disclosed at call start
- Strict retention/redaction and least-privilege transcript access
- Dry-run/fake provider for development; tiny consented live pilot

Common controls required across the system:

- secrets come from an approved secret store or local ignored environment file and are never committed, rendered, or logged;
- untrusted files, prompts, provider output, repository content, and external responses are treated as data, never instructions;
- authorization is enforced at the data/action boundary, not only in the UI;
- logs, traces, fixtures, screenshots, and demo assets are scrubbed of credentials and sensitive user data;
- destructive or externally visible actions are previewable, idempotent where possible, auditable, and fail closed;
- dependency and container scanning, lockfiles, least privilege, and an incident/rollback path are release requirements.

## Reliability and operations

Production behavior includes failures, retries, restarts, partial responses, stale data, duplicate delivery, and resource exhaustion. The implementation must therefore provide:

- typed error classes and user-visible failure states rather than catch-all success fallbacks;
- bounded timeouts, cancellation, retry budgets, and backoff for every external or long-running operation;
- idempotency and reconciliation wherever the same work may be delivered twice or its external outcome may be unknown;
- structured, redacted logs; metrics for throughput, latency, error and abstention/refusal; and traces across meaningful boundaries;
- health/readiness checks that validate dependencies without mutating user data;
- documented SLOs and alerts before public production use;
- backup, restore, migration, retention, and cleanup procedures for every persistent store;
- graceful degradation that preserves truth and safety before convenience or visual effects.

## Verification strategy

Project-specific required test surfaces:

- Clear/ambiguous/refused/voicemail/wrong-facility/opt-out outcomes
- Duplicate/out-of-order webhook and crash after external creation
- Date/time/timezone/question-answer grounding
- Parent number shared by multiple sites and rate limits
- Publication approval, rollback/new snapshot, expiry
- Live CALL-E proof plus comprehensive fake-provider E2E

Every production path also needs unit tests, property or fuzz tests where state space matters, integration tests at real boundaries, end-to-end tests of the user outcome, accessibility checks, performance budgets, security regression tests, and failure-injection coverage. Mocks belong in test fixtures; the shipped runtime must not depend on a fake service or hardcoded winning example.

Evaluation datasets and fixtures are versioned, provenance-aware, and isolated from tuning when described as held out. A number may appear in the README or submission only when a committed script regenerates it from a committed manifest.

## Performance and accessibility

Performance budgets must be set before optimization and enforced in CI for supported environments. Measure latency distributions, memory, CPU/GPU, network or storage volume, cold start, cancellation, and degraded-device behavior relevant to this product. Do not replace measurements with “feels fast.”

Accessibility is a release gate, not a polish task. The production interface must include semantic structure, keyboard support, visible focus, sufficient contrast, non-color status cues, reduced-motion behavior where relevant, zoom/reflow, readable errors, and an equivalent representation for information conveyed through canvas, charts, audio, maps, camera, or animation.

## Planned repository layout

```text
/
├── README.md                 # Product and operating contract
├── AGENTS.md                 # Binding implementation rules for coding agents
├── HACKATHON.md              # External rules and submission facts
├── WINNING_IDEA.md           # Selected product/technical blueprint
├── packages/import/
├── packages/freshness/
├── packages/call-plan/
├── packages/calle/
├── packages/evidence/
├── packages/review-publish/
├── apps/operator/
├── tests/                    # Unit, property, integration, E2E, resilience
├── docs/                     # ADRs, threat model, runbooks, evaluation
└── infra/                    # Reproducible deployment and environment policy
```

This is a boundary contract, not a command to create empty directories. Add a directory when it owns working code, tests, and documentation.

## Development command contract

No commands are advertised as working until the corresponding toolchain is committed. The first production scaffold must expose one documented, cross-platform command surface, preferably through a checked-in task runner or Makefile:

| Command | Required behavior |
|---|---|
| `bootstrap` | Verify tool versions, install locked dependencies, initialize only local non-secret state |
| `check` | Format check, lint, type/static analysis, schema/config validation |
| `test` | Deterministic unit and property suites |
| `test-integration` | Real boundary tests using isolated local/test dependencies |
| `test-e2e` | Supported user workflows and failure states |
| `eval` | Reproduce committed domain evaluation and metrics |
| `build` | Produce release artifacts from a clean checkout |
| `run-local` | Start the complete local system or a documented production-equivalent subset |
| `release-check` | Run all blocking gates, artifact/SBOM generation, and policy checks |

A new contributor should be able to move from a clean checkout to a verified local system without tribal knowledge.

## Environment model

- **Local:** isolated developer data, safe fixtures, no real-world side effects by default.
- **Test:** deterministic automated environment with controlled boundary services.
- **Staging:** production-shaped deployment, synthetic/de-identified data, real observability and rollback.
- **Production:** least-privilege credentials, audited configuration, SLOs, incident ownership, backups and change controls.

Configuration is typed, validated at startup, documented, and separated from secrets. Environment-specific branches or code paths are prohibited; behavior changes through validated configuration and capability boundaries.

## Release gates

1. Zero duplicate calls in fault/idempotency suite
2. No non-established outcome publishes
3. Every delta traces to evidence and review
4. Opt-out/emergency/quiet-hour safeguards pass
5. Transcript privacy and access controls pass
6. CALL-E runtime integration, community PR, hosted workflow, and demo are reproducible

Common blocking gates also include:

- clean build from a fresh checkout with locked dependencies;
- no critical/high unresolved security findings and no committed secrets;
- migration/rollback and backup/restore rehearsal where state exists;
- passing accessibility and supported-environment matrix;
- complete observability, runbook, known-limitations, privacy, and threat-model documentation;
- no placeholder copy, dead controls, fake metrics, hardcoded demo results, or production TODO paths;
- submission assets and claims generated from the same tested release commit.

## Production milestone policy

Work proceeds in complete vertical slices, but every merged slice must use the final architecture, schemas, security boundaries, telemetry, error model, tests, and documentation expected in production. A smaller completed surface is acceptable; a throwaway implementation that will be replaced later is not.

A feature is not complete when it works once. It is complete when supported inputs, invalid inputs, retries, cancellation, restart, privacy, accessibility, observability, performance, deployment, rollback, and documentation are all accounted for.

## Hackathon delivery

HACKATHON.md contains the live form links and exact requirements. WINNING_IDEA.md contains the selected demo and judging strategy. Production engineering must strengthen that submission, not create a separate demo path. The video, screenshots, hosted build, evaluation numbers, and repository documentation must all describe the same release artifact.

## Contributing

Read AGENTS.md before changing code. Keep changes narrowly scoped, add or update tests with behavior, record architecture/security decisions in ADRs, and never weaken an invariant to make a demo pass. No product name, logo, pricing claim, medical/legal claim, partner claim, or benchmark result should be invented without explicit evidence and user approval.
