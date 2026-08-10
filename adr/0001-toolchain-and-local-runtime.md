# ADR-0001: Pinned TypeScript workspace and isolated local runtime

- **Status:** accepted
- **Date:** 2026-08-09
- **Decision owners:** repository maintainers
- **Reversal trigger:** a supported dependency, deployment platform, or measured operational constraint makes this stack unable to preserve the domain invariants.

## Context

The repository must implement the TypeScript/Node, React/Next.js, PostgreSQL, CALL-E adapter, and OpenTelemetry direction in `AGENTS.md`. Sixteen repositories share this Mac, loopback interface, Docker daemon, and process table. Framework defaults, shared profiles, broad process shutdown, unpinned tools, and socket-only health checks would create false evidence and could destroy work outside this repository.

The repository also needs a clean-checkout command surface before domain features exist. The foundation cannot be empty scaffolding: the packages added with this ADR contain the initial typed temporal claim, call-plan, idempotency, evidence, and public-delta boundaries, while the local services expose accurate capabilities and limitations.

## Options considered

1. **Pinned pnpm workspace, Node 24 LTS, Next.js, host Node processes, namespaced Compose infrastructure.** Enforces ownership boundaries and uses real PostgreSQL/OpenTelemetry services while retaining exact PID/container cleanup.
2. **Single Next.js application.** Smaller initially, but collapses planner/caller/reviewer authority and makes domain-to-framework imports hard to prevent.
3. **All services in Docker Compose.** Reproducible, but significantly slower for inner-loop TypeScript work and still requires careful process/container ownership.
4. **Local Homebrew PostgreSQL and collector.** Avoids containers but depends on machine-global service state and versions, violating clean-checkout reproducibility and sibling isolation.
5. **Bun or npm workspaces.** pnpm's strict linking, workspace protocol, lockfile, and supply-chain controls better enforce package ownership.

## Decision

- Pin Node `24.19.0` (Node 24 LTS Krypton) and pnpm `11.20.0` exactly. CI uses the same `.node-version`; bootstrap and lifecycle commands refuse every other version rather than claiming an untested range.
- Pin all JavaScript dependencies exactly in `package.json` files and commit one `pnpm-lock.yaml`.
- Use TypeScript 6.0.3 rather than registry-latest TypeScript 7 because the current typescript-eslint programmatic integration supports `<6.1` and TS7's ecosystem migration is not yet complete.
- Use strict compiler flags, warning-zero typed ESLint, Prettier checking, project-owned Vitest/Playwright configuration, and dependency-cruiser rules that fail domain-to-application/framework imports and cycles.
- Use one operator Next.js application plus independent API and worker processes. Each process has `/livez` and dependency-aware `/readyz`; the operator health endpoint is not ready if its API is not ready.
- Run PostgreSQL 18.4 and the core OpenTelemetry Collector 0.158.0 from digest-pinned images. Every Compose invocation uses project `call-e-your-code-is-calling`; volumes, networks, database, role, containers, ports, logs, profiles, caches, and PIDs use repository-specific names.
- Bind host services to `127.0.0.1` and ports 4150-4159 only. Port 4157 is allocated to OTLP/HTTP ingest so health can prove an end-to-end collector canary rather than merely an open socket.
- Keep the fake CALL-E service under `tests/`; its runtime schema rejects staging/production, and production configuration rejects fake mode and loopback provider URLs.
- Record process group start signatures and container IDs/Compose labels. Shutdown signals only verified owned process groups and exact project containers, preserving the PostgreSQL volume by default.
- Cache only `apps/operator/.next/cache` in CI, keyed by the runner OS, lockfile, and operator sources. Build preparation retains a real cache directory but deletes every other stale `.next` artifact; release output is always regenerated and is never restored from the cache.

## Consequences

- Clean verification requires exact Node 24.19.0, exact pnpm 11.20.0, Docker, lsof, and Git; `pnpm bootstrap` provisions the pinned Playwright Chromium binary into the repository-local cache.
- Digest-pinned images and exact dependency pins require an explicit reviewed upgrade instead of silently receiving patches.
- PostgreSQL state persists across `dev:down`; destructive cleanup requires a separate future, explicit data lifecycle command.
- The collector's 0.x contract requires a config test and regular upgrade review. It exposes no profiler, zPages, Jaeger, Zipkin, or Prometheus listener.
- Next.js contributes server/client and native SWC/Sharp supply-chain surface. It is contained in the operator application and prohibited from domain packages.
- CI cache restore/save adds a digest-pinned GitHub Action and remote storage/transfer, but does not make cached output authoritative: formatting, types, boundaries, tests, and the release build still run on every revision.
- TypeScript 7 migration remains a reviewed follow-up, not an automatic upgrade.

## Verification and reversal

`pnpm verify-all` checks formatting, lint, types, architecture, meaningful tests, release build, semantic local readiness, integration failure cases, and browser behavior. `pnpm verify:clean-checkout` repeats it from a detached exact-commit worktree. To reverse this ADR, replace the relevant workspace/runtime boundary behind the same commands, retain the port/ownership safety contract, migrate persistent state forward and back, and demonstrate equal or stronger invariant enforcement.
