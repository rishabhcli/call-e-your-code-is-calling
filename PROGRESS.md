# Progress journal

This file is append-only. Each entry records the behavior changed, verification commands, regenerable evidence, risks, rollback, blockers, and the next item selected by `GOAL.md` section 10.1.

## 2026-08-09T21:30:00-07:00 — Goal re-entry and first gate audit

- **True state:** not yet in production. The repository contained specifications only; `npm run dev:preflight` failed because the task did not exist.
- **Commands:** read `HACKATHON.md`, `WINNING_IDEA.md`, `README.md`, `AGENTS.md`, and all 920 lines of `GOAL.md` in the required order; ran `npm run dev:preflight`; inspected Git status, tracked files, local tool versions, Docker availability, and ports 4150-4159.
- **Evidence:** the failing command reported `Missing script: dev:preflight`; no port in the exclusive block was listening; Docker CLI was installed but its daemon was not initially available.
- **Risk and rollback:** no runtime or external side effect occurred. Foundational additions are isolated to this repository and can be removed as one coherent change before any persistent data exists.
- **Blocked:** none. Docker Desktop launch was requested locally; the lifecycle must still fail closed if it remains unavailable.
- **Next item by section 10.1:** implement Tier 0 and the full section 0A executable/dev-server contract, then re-run `dev:preflight`, `dev:up`, and `dev:health`.

## 2026-08-10T08:38:41-07:00 — Documentation drift audit and current-state handoff

- **Behavior delivered:** added `APPLICATION_STATUS.md` as the replaceable current-state companion to this append-only journal. It audits every `GOAL.md` tier, each ownership package, all eight domain invariants, current verification truth, external prerequisites, and the ordered next-agent queue. Added `docs/README.md`; cross-linked the status/handoff from the authoritative read order; corrected stale implementation, support, assumption, evidence, repository-layout, and relative-deadline documentation without claiming production.
- **Commands:** read the authoritative documents in order; inspected tracked source, tests, migrations, runtime configuration, CI, ADRs, threat model, support/dependency/assumption registers, and recent Git history; queried the latest `main` Actions result; ran `pnpm dev:preflight`, `pnpm dev:up`, `pnpm dev:health`, `pnpm test`, `pnpm dev:down`, and `pnpm check`; inspected a later `pnpm verify-all` summary; ran Prettier on changed documentation, a local Markdown-target check, stale-status search, and `git diff --check`.
- **Evidence:** the direct lifecycle sequence passed semantic checks for operator, API, fake CALL-E, worker, test harness, PostgreSQL, and the OpenTelemetry canary; 7 unit files/12 tests passed; the full static check passed formatting, warning-zero lint, types, architecture boundaries, dependency-register coverage, and the high-severity audit. GitHub Actions run `31402729203` failed before verification because `setup-node` tried to locate pnpm before the workflow activated it. The later local full-verification summary passed its first ten steps through startup, then semantic health failed after 120,831 ms; the canary export was empty when inspected. `APPLICATION_STATUS.md` preserves the exact supported/missing boundary instead of rounding the foundation up to a product workflow.
- **Risk and rollback:** documentation only; no product behavior, external call, persistent application data, credential, or migration changed. Reverting this documentation commit restores the prior text, but would reintroduce known drift. Current-state claims are intentionally tied to baseline `a4da97327bbda9fa308bccf884e5bee00da85c21` and must be refreshed after implementation changes.
- **Blocked:** no external blocker prevents the next local work. SDK license and live-pilot consent/provider permission remain external prerequisites only for their affected paths.
- **Next item by section 10.1:** restore Tier 0 by fixing the CI pnpm activation ordering, reproducing and correcting the local semantic-health timeout, then obtaining green `verify-all`, clean-checkout, and `main` CI evidence before continuing Tier 1 invariant work.
