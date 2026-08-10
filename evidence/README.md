# Regenerable evidence

Only regenerable artifacts belong here. Each artifact must identify its committed command, input manifest, deterministic seed (or `not-randomized`), and the exact claim it supports. Transient runtime logs remain under the ignored `.dev/logs/` directory until a sanitizing evidence command promotes a reviewed artifact.

Current foundation generation and verification commands:

- `pnpm dependency:check`
- `pnpm verify-all`
- `pnpm verify:clean-checkout`

These commands currently write transient summaries under ignored `.dev/` paths;
they do not by themselves create a committed evidence artifact. A reviewed
promotion command must allowlist fields, remove sensitive runtime data, name the
exact commit/input/seed, and reproduce the same claim before an artifact is added
here.

The repository is **not yet in production**. At the implementation baseline
audited in `APPLICATION_STATUS.md`, this directory contains policy only and no
committed result artifact.
