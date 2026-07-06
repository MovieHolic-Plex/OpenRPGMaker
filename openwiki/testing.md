# Testing

Use the lightest command that proves the change.

## Agent validation rule

Pick validation based on the touched boundary:

- Type-only or low-risk helper changes: run `npm run typecheck` plus a focused unit test if one exists.
- Project schema, migration, persistence, defaults, or references: run focused Vitest coverage for the changed path and include save/load or migration evidence.
- Cluster-rule changes should include a focused validator test plus a commit-gate proof: a hard rule must produce a `projectLint` error that makes `commitChangeset` return `ok:false`, while the fixed map returns `ok:true`.
- Editor UI/workflow changes: run focused tests and drive the browser/editor surface with Playwright or an equivalent browser check.
- Runtime/player/battle changes: run focused unit tests plus the smallest e2e or browser scenario that proves the behavior in play mode.
- Wiki-only changes: run `npm run openwiki:verify`.

- `npm test` runs the Vitest unit suite.
- `npm run typecheck` verifies TypeScript only.
- `npm run build` must pass before merge-ready work.
- `playwright` / `npm run test:e2e` covers browser `test/e2e` flows.
- `vitest` is for focused unit tests and fast iteration.
- For focused selection, run a single file, pattern, or test name instead of the full suite.

Evidence expectations:
- Record the exact command run.
- Capture pass/fail output or a short log excerpt.
- For UI/e2e work, include the tested route and scenario.
- If a test is skipped or flaky, say why and what remains unverified.
