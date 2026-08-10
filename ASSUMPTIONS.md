# Assumptions register

Every unverified decision is recorded here with the safest interpretation and the cheapest later verification.

## A-001 — Runtime and package-manager baseline

- **Decision:** use a pinned pnpm workspace with exactly Node.js 24.19.0 and pnpm 11.20.0. Direct and transitive dependencies are locked exactly.
- **Reasoning:** the approved architecture is TypeScript/Node/Next.js, pnpm is already available locally, and a workspace makes package ownership enforceable without importing application state into domain packages.
- **Safety posture:** startup and bootstrap will reject unsupported Node or pnpm versions; no runtime will silently downgrade.
- **Cheapest verification:** run `pnpm bootstrap`, `pnpm verify-all`, and `pnpm verify:clean-checkout`, then confirm the same revision's GitHub Actions run.
- **Status:** implemented and verified locally, from an exact clean checkout, and by `main` GitHub Actions run `31407636737` at commit `a6dae52`. See `APPLICATION_STATUS.md`.

## A-002 — Development infrastructure isolation

- **Decision:** use repository-namespaced Docker Compose only for PostgreSQL and the OpenTelemetry Collector, and repository-owned process groups for the operator, API, fake CALL-E service, and worker.
- **Reasoning:** PostgreSQL and OpenTelemetry must be real services, while the process and port contract prohibits global process/container operations. Compose project `call-e-your-code-is-calling` and PID metadata under `.dev/pids/` provide the narrowest cleanup boundary.
- **Safety posture:** all host bindings are `127.0.0.1` and ports 4150-4159 only; shutdown verifies ownership before signaling a recorded process group and never uses broad process sweeps.
- **Cheapest verification:** run lifecycle tests with a foreign listener inside a reserved port, verify preflight refuses it, then verify `dev:down` leaves an unrelated sentinel process untouched.
- **Status:** implemented and covered by lifecycle integration tests for foreign-port refusal, semantic-readiness refusal, lifecycle lock ownership, and narrow shutdown. Broader crash/fault coverage remains required by later tiers.

## A-003 — OpenTelemetry ingest allocation

- **Decision:** allocate reserved port 4157 to the collector's OTLP/HTTP ingest endpoint while 4156 remains its semantic health endpoint.
- **Reasoning:** a collector that merely accepts a TCP connection is not proven useful. A separate in-block ingest port lets `dev:health` send a canary and verify that it reaches the configured local export destination.
- **Safety posture:** both host mappings bind `127.0.0.1`; no port outside 4150-4159 is allocated.
- **Cheapest verification:** run `pnpm dev:health`, which must fail if either the collector health extension or the canary pipeline fails.
- **Status:** implemented; direct health and the stable-source `pnpm verify-all` run sent and located an end-to-end canary. The earlier source-revision drift failure was reproduced by concurrent tracked edits, not by accepting a socket-only result. Production telemetry and load/resource verification remain later-tier work.

## A-004 — CALL-E adapter and unresolved SDK licence

- **Decision:** implement against the documented CALL-E v0.6 REST contract at the adapter boundary rather than embedding `@call-e/calle@0.6.0` until its redistribution/use licence is clarified.
- **Reasoning:** official npm metadata and the published tarball declare no licence and the stated source repository is inaccessible. The approved architecture permits the documented API, and a REST boundary avoids importing an unlicensed artifact while still using CALL-E at runtime.
- **Safety posture:** this does not enable real calls. The production adapter will require an explicit base URL, typed credential configuration, persisted idempotency keys, bounded deadlines, and canonical GET reconciliation before sensitive effects.
- **Cheapest verification:** obtain written SPDX/licence clarification from CALL-E and re-evaluate the official SDK behind an ADR; meanwhile pin the OpenAPI fixture hash and contract-test the REST adapter.
- **Status:** active pending external clarification; not a blocker to Tier 0 or the documented API path.
