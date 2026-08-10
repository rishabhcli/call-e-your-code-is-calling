# Support matrix

> Current status: **not yet in production**. This matrix is intentionally conservative and each supported entry requires a regenerating command under `evidence/` before release.

| Surface                 | Supported now                                      | Refusal outside the matrix                                                                                                                | Evidence                                          |
| ----------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Repository development  | Not yet; Tier 0 executable contract is being built | Missing or invalid toolchain/configuration must fail closed                                                                               | Pending `pnpm verify-all` clean-checkout artifact |
| Real CALL-E calls       | No                                                 | Real-call capability remains disabled unless an approved, inspectable plan and production-only credential/capability boundary are present | Pending invariant and integration evidence        |
| Local fake CALL-E       | Test/development only after lifecycle verification | Production configuration must make this endpoint unreachable                                                                              | Pending contract and configuration tests          |
| Directory inputs        | None yet                                           | Unsupported inputs must be rejected or quarantined, never partially accepted                                                              | Pending Tier 3 schemas and fixtures               |
| Browsers                | None declared yet                                  | Unsupported browsers receive an honest unsupported state                                                                                  | Pending Playwright/accessibility matrix           |
| Deployment environments | None yet                                           | The repository remains accurately labeled not yet in production                                                                           | Pending Tier 12 evidence                          |
