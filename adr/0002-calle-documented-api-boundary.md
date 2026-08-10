# ADR-0002: CALL-E documented REST API boundary pending SDK licence clarity

- **Status:** accepted with external clarification pending
- **Date:** 2026-08-09
- **Decision owners:** repository maintainers

## Context

The approved architecture permits `@call-e/calle` **or the documented API** at runtime. Official registry metadata on 2026-08-09 identifies `@call-e/calle@0.6.0` and the v0.6 OpenAPI contract, but the package declares no licence, its tarball contains no `LICENSE`, and its declared GitHub repository is inaccessible. The separate MIT-licensed integrations repository does not establish the SDK artifact's licence.

Current CALL-E webhooks are unsigned, at-least-once deliveries. They carry `CALL-E-Event-Id`, but no secret, timestamp, or signature. The provider documents create, canonical get, and event-list calls; it does not document a lookup by idempotency key, a cancellation API, webhook retry limits, or a guaranteed non-dialing sandbox.

## Options considered

1. **Pin and import the SDK despite the missing licence.** Meets the most literal SDK path but introduces an unresolved redistribution/use risk and still requires local runtime validation and a wrapper.
2. **Use the documented v0.6 REST API behind a local adapter.** Satisfies the hackathon/API requirement without embedding the unlicensed artifact; preserves complete control over deadlines, cancellation, validation, and reconciliation.
3. **Use MCP/CLI.** Appropriate for interactive agent actions, but not for the authenticated worker, transactional idempotency store, webhook reconciliation, and field-level publication workflow.

## Decision

Use a documented REST adapter. Pin the provider contract as a versioned fixture and validate every response locally. Persist the idempotency key, canonical request body, and request digest before create. On a transport-uncertain create, replay the exact body with the same key; never mint another key. Quarantine `idempotency_conflict`.

Treat every webhook as untrusted. Require a matching header/body event ID, validate size and schema, prove the call belongs to an expected local run, fetch canonical `GET /v1/calls/{id}` before any review/publication transition, compare correlation metadata, and deduplicate transactionally. Polling remains required because delivery duration and ordering are undocumented.

Real calls remain impossible in local/test configuration. Production requires an explicit HTTPS base URL, server-side credential, approved plan capability, persisted idempotency operation, and consented pilot. A `completed` call or high provider confidence never establishes a field without local transcript grounding.

## Consequences and reversal

- Provider use remains governed by CALL-E terms even without the SDK package.
- The adapter must maintain its own runtime schemas and contract fixtures.
- Written SDK licence clarification may allow a later SDK-backed implementation behind the same adapter. That change requires a dependency review, SBOM update, contract parity tests, and this ADR's safety/reconciliation semantics unchanged.
- The emergency-resource verification use case also requires written provider confirmation that this narrow, disclosed, human-reviewed use is permitted by CALL-E's service terms before a live pilot.

## Primary references checked 2026-08-09

- <https://docs.heycall-e.com/authentication>
- <https://docs.heycall-e.com/calls>
- <https://docs.heycall-e.com/webhooks>
- <https://docs.heycall-e.com/openapi/calle.openapi.yaml>
- <https://registry.npmjs.org/@call-e/calle/latest>
- <https://www.heycall-e.com/terms-of-service/>
