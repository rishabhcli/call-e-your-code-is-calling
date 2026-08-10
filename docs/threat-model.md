# Foundation threat analysis

- **Scope:** Tier 0 local and CI runtime, package-install and build-cache boundaries, Next.js operator health surface, API/worker readiness, fake CALL-E test service, PostgreSQL migration, OpenTelemetry ingest, and lifecycle control.
- **Status:** not yet in production; real calls, directory uploads, provider credentials, webhooks, authentication, review, and publication are not enabled.
- **Review date:** 2026-08-10
- **Implementation cross-check:** [`APPLICATION_STATUS.md`](../APPLICATION_STATUS.md)
  records which later product boundaries are still absent. This threat model must
  be expanded before any of them is enabled.

## Assets and trust boundaries

| Boundary                          | Untrusted input or authority                              | Asset at risk                                    | Structural control                                                                                                                      | Failure behavior                                                        |
| --------------------------------- | --------------------------------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| pnpm registry and install scripts | Package metadata/tarballs/transitives                     | Developer/CI machine, release integrity          | Exact manifests + lockfile, strict peers/engines, reviewed direct register, CI clean install                                            | Install fails; no fallback registry or unlocked resolution              |
| Docker registry and images        | Image manifests/layers                                    | Host daemon, persistent database                 | Exact stable tags + multiarch digests, minimal official images, project namespace                                                       | Pull/start fails closed                                                 |
| GitHub Actions build cache        | Prior Next.js compiler cache entries                      | CI integrity, build time                         | Commit-pinned action; cache is limited to `.next/cache`; build preparation rejects links/non-directories and regenerates release output | Cache miss/corruption may fail the build; no cached release is trusted  |
| Lifecycle CLI                     | Port holders, stale/reused PID files, concurrent commands | Other repository sessions/processes              | Atomic repository lock, PID start signature + command + process-group validation, Compose labels/container IDs                          | Refuses action; never kills an unverified process/container             |
| Host network                      | Any local process can bind/call loopback                  | Service availability and fake-provider integrity | Exclusive 4150-4159 block, 127.0.0.1 only, semantic readiness, foreign-holder refusal                                                   | Preflight/health nonzero with exact holder/check                        |
| Runtime environment               | Malformed/missing configuration                           | Provider side effects, data destination          | Zod startup schema; production forbids fake/loopback provider and requires explicit HTTPS live base URL                                 | Process refuses startup; no degraded fallback                           |
| PostgreSQL                        | Local client queries and persistent volume                | Claims/run/audit state (future)                  | Exact role/database, bounded pools/timeouts, schema-version readiness, namespaced persistent volume                                     | Readiness 503; process remains live for diagnosis                       |
| OTLP/HTTP                         | Arbitrary local telemetry payloads                        | Memory/disk, sensitive data                      | Loopback only, 192 MiB memory limiter, batch bounds, no public debug/profiling endpoints                                                | Collector drops/fails; product correctness does not depend on telemetry |
| Operator/API/worker HTTP          | Malformed methods/paths/headers                           | Event loop, logs, readiness truth                | Bounded headers/request timeouts, narrow routes, no-store/nosniff, safe error codes, structural log redaction                           | 404/4xx/503; never optimistic readiness                                 |
| Fake CALL-E service               | Test request bodies/scenario IDs/idempotency keys         | Accidental dialing claims, resource usage        | Test-directory ownership, local/test-only schema, 64 KiB body limit, E.164/schema validation, bounded corpus, no network dialer         | 4xx/409; production config cannot construct the service                 |

## Threats and mitigations

1. **Cross-repository denial of service:** broad kill/container prune and framework-default ports are absent. `dev:down` acts only on verified process groups and exact Compose project containers. An integration test holds a foreign sentinel and proves refusal without termination.
2. **PID reuse or forged ownership metadata:** metadata binds PID, process group, OS start signature, command marker, and project. Any mismatch is a hard refusal.
3. **Socket-only false green:** readiness requires service/status JSON; PostgreSQL authenticates and checks migration state; OpenTelemetry ingests a unique canary and finds it in the export pipeline.
4. **Fake provider reachable in production:** production configuration rejects fake mode and `FAKE_CALLE_URL`; the fake executable accepts only local/test modes and is not part of application package exports.
5. **Credential/transcript leakage:** no provider credential or transcript store exists in Tier 0. Pino structurally redacts credential paths, health documents contain stable codes, and public-delta types contain evidence IDs but no transcript excerpt/staff identity.
6. **Resource exhaustion:** HTTP timeouts, fake body limits, bounded pools, the collector memory limiter, bounded readiness deadlines, and scenario limits establish initial ceilings. Load-to-failure remains Tier 9 work and is not claimed here.
7. **Supply-chain compromise:** exact pins, one frozen lockfile, image/action digests, warning-zero CI, dependency review, and clean-checkout verification reduce drift. The CI build cache contains compiler acceleration data only; the release build and every gate are rerun. SBOM/advisory gates remain Tier 10 work.

## Explicit residual risk

- No authenticated user action exists yet; adding one requires a new threat-model pass before implementation.
- Current CALL-E webhooks are unsigned; ADR-0002 requires canonical API re-fetch and transactional deduplication before any sensitive transition.
- Local PostgreSQL uses a documented non-secret development password and loopback binding. It must never be reused in staging/production.
- Real provider terms, consent, SDK licence, API quotas, retention, and use-case permission remain unverified external facts. No real call is enabled.

## Mandatory next review triggers

Perform and commit a threat-model update before adding any of the following:

- directory file upload, URL import, PDF/CSV/JSON parser, archive, or remote fetch;
- CALL-E credential, REST request, webhook receiver, polling reconciler, or live
  provider mode;
- transcript/evidence persistence, staff-identity processing, or model-assisted
  grounding;
- operator authentication, role/authority separation, public delta feed, export,
  or hosted endpoint;
- application data migration, backup/restore, deployment, rollback, or
  emergency-disable authority.

Each update must name size/time/concurrency limits, authentication and
authorization, failure behavior, retention, observability without sensitive
content, cancellation/reconciliation, and the tests that attack the boundary.
