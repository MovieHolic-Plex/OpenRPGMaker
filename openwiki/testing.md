# Testing

Use the lightest command that proves the change.

## Agent validation rule

Pick validation based on the touched boundary:

- Type-only or low-risk helper changes: run `npm run typecheck` plus a focused unit test if one exists.
- Project schema, migration, persistence, defaults, or references: run focused Vitest coverage for the changed path and include save/load or migration evidence.
- Cluster-rule changes should include a focused validator test plus a commit-gate proof: a hard rule must still produce a `projectLint` error, `commitChangeset` must return `ok:true` for cluster-rule-only hard violations, and the fixed map should return `ok:true` without cluster-rule issues.
- Editor UI/workflow changes: run focused tests and drive the browser/editor surface with Playwright or an equivalent browser check.
- Runtime/player/battle changes: run focused unit tests plus the smallest e2e or browser scenario that proves the behavior in play mode.
- Wiki-only changes: run `npm run openwiki:verify`.

- `npm test` runs the Vitest unit suite.
- Vitest uses a 15 second per-test timeout in `vitest.config.ts`; several headless walkthrough/autosave tests can exceed the default 5 seconds during full-suite parallel runs even when they pass focused.
- `npm run typecheck` verifies TypeScript only.
- `npm run build` must pass before merge-ready work.
- `playwright` / `npm run test:e2e` covers browser `test/e2e` flows.
- `vitest` is for focused unit tests and fast iteration.
- Tileset intelligence UI changes should include focused Vitest coverage for review queue ordering/state transitions, correction save metadata and undo, locked AI-write preservation, mock re-audit candidate flow, and palette preset CRUD before running the full suite.
- `npm run perf:bench` runs the Node headless performance budget harness and writes JSON evidence under `evidence/perf/`.
- The perf benchmark measures data-pipeline paint latency, edit render diff planning, undo snapshot bytes, and deserialize+validate load time; it intentionally excludes Phaser render.
- Do not add the perf benchmark as a CI gate unless the budget policy changes, because local timing is machine-dependent.
- For focused selection, run a single file, pattern, or test name instead of the full suite.
- House-harness door/interior changes should cover `test/houseKit.test.ts`, `test/villageBuilder.test.ts`, interpreter command coverage, and `test/e2e/village-house-interior-transfer.spec.ts` for the play-mode action transfer round trip.

Evidence expectations:
- Record the exact command run.
- Capture pass/fail output or a short log excerpt.
- For UI/e2e work, include the tested route and scenario.
- If a test is skipped or flaky, say why and what remains unverified.
