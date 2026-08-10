# Documentation index

This directory contains implementation-facing design and operating documents.
Repository-level contracts remain at the repository root so they are visible
before an agent or contributor changes code.

## Read first

Read these documents in the order required by [`AGENTS.md`](../AGENTS.md):

1. [`HACKATHON.md`](../HACKATHON.md) — external rules, deadline, form fields, and
   submission requirements.
2. [`WINNING_IDEA.md`](../WINNING_IDEA.md) — selected use case, technical core,
   scope, validation, and demo strategy.
3. [`README.md`](../README.md) — production product and repository contract.
4. [`AGENTS.md`](../AGENTS.md) — binding implementation and review discipline.
5. [`GOAL.md`](../GOAL.md) — tier order, production definition, verification, and
   work selection.

## Current state and handoff

| Document | Purpose | Update rule |
| --- | --- | --- |
| [`APPLICATION_STATUS.md`](../APPLICATION_STATUS.md) | Evidence-based snapshot of what exists, what is missing, invariant coverage, and the ordered work queue | Replace stale current-state claims whenever implementation changes |
| [`PROGRESS.md`](../PROGRESS.md) | Historical work journal with commands, evidence, risk, rollback, blockers, and selected next item | Append only; never rewrite history |
| [`SUPPORT_MATRIX.md`](../SUPPORT_MATRIX.md) | Honest supported/refused behavior for each runtime and product surface | Update with every support-boundary change |
| [`ASSUMPTIONS.md`](../ASSUMPTIONS.md) | Decisions made without user input and the cheapest later verification | Update status when verified, rejected, or superseded |
| [`BLOCKED.md`](../BLOCKED.md) | External blockers and exact minimal unblock requests | External blockers only; local failing work is not a blocker |
| [`evidence/README.md`](../evidence/README.md) | Rules for committed, regenerable evidence | Add artifacts only through reviewed deterministic commands |

## Architecture and security

| Document | Scope |
| --- | --- |
| [`adr/0001-toolchain-and-local-runtime.md`](../adr/0001-toolchain-and-local-runtime.md) | Pinned workspace, dependency boundaries, runtime isolation, and semantic health |
| [`adr/0002-calle-documented-api-boundary.md`](../adr/0002-calle-documented-api-boundary.md) | Documented CALL-E REST boundary pending SDK license clarity |
| [`threat-model.md`](./threat-model.md) | Tier 0 assets, trust boundaries, structural controls, and residual risk |
| [`DEPENDENCIES.md`](../DEPENDENCIES.md) | Direct/runtime/CI dependency, license, maintenance, security, binary, and cost register |

## Documentation quality rules

- Describe only behavior present in the same revision.
- Distinguish **implemented**, **verified**, **partial**, **unsupported**, and
  **not yet in production**.
- Link claims to a path plus a regenerating command or immutable external result.
- Do not publish relative deadline counts; use the exact deadline and timezone.
- Do not put secrets, private transcripts, staff identities, or sensitive fixtures
  in documentation, screenshots, logs, or evidence.
- Add an ADR before introducing a persistent schema, new external boundary,
  credential, side effect, security authority, or major algorithm.
- Update the threat model before enabling a new input, provider endpoint,
  credential, parser, webhook, authentication flow, or publication surface.
