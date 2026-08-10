# Regenerable evidence

Only regenerable artifacts belong here. Each artifact must identify its committed command, input manifest, deterministic seed (or `not-randomized`), and the exact claim it supports. Transient runtime logs remain under the ignored `.dev/logs/` directory until a sanitizing evidence command promotes a reviewed artifact.

Tier 0 generation and verification commands:

- `pnpm dependency:check`
- `pnpm verify-all`
- `pnpm verify:clean-checkout`

The repository is **not yet in production**; no artifact in this directory claims otherwise.
