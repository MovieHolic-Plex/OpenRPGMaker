# Editor Validation Expectations

Wiki verification, Playwright evidence, and focused test guidance for editor changes.

## Validation Expectations


- Wiki-only edits should pass `npm run openwiki:verify`.
- Event and database UI repairs should have focused Playwright evidence. Task 10 added separate event and database stabilization specs under `test/e2e/`: the event spec covers event delete confirmation and shop branch persistence, and the database spec covers Database dirty discard, command-reference delete blocking, Common Event nested command editing, troop battle-event page switching, and enemy action switch picker behavior.
- For future editor workflow changes, run the smallest focused Vitest or Playwright path that proves the touched surface, then record the exact command and pass/fail excerpt under task evidence.
- For event-command parity changes, include focused tests for the support table, command-list/picker badge metadata, `projectLint` warning output, and write-tool `ToolResult.issues` propagation. `projectLint` reports non-full map/common/troop-event runtime support as warning code `runtime-support:<commandKind>`; `upsert_event` and `upsert_common_event` summaries also report the unsupported-command count.



- Safe tilemap harness changes should cover detached session serialization, checkpoint capture, room-only reroll preservation, lock enforcement, direct no-AI start, bidirectional transfer reachability, stale-base rejection, fresh review of replacement candidates, one guarded full/partial apply, one full-project undo, read-only NPC/time metrics, and the region review timeline/issues/blocker UI. Focused command: `npm test -- test/tilemapHarnessOverhaul.test.ts test/pendingRegionApply.test.ts test/roomHarnessEngine.test.ts test/regionTaskModalEnhancements.test.ts --pool=threads --maxWorkers=1 --no-file-parallelism --reporter=verbose`; also run `npm run typecheck:app`.


- All repository Vitest entry points run through `scripts/run-vitest.mjs` with `--configLoader bundle`. On Windows, the wrapper resolves the Vitest CLI and root to an uppercase drive letter before spawning Node. This avoids Vitest issue [#10692](https://github.com/vitest-dev/vitest/issues/10692), where lowercase `c:` CLI URLs and uppercase `C:` Vite URLs can load two runtime copies and fail before collection with `suite.config`/`current suite` errors. `scripts/verify-gates.mjs` uses the same wrapper and rejects a report with `numTotalTests === 0`; do not replace this with a pool pin, alias, externalization, or cache workaround without proving focused collection and `npm run gates -- --json` from an isolated worktree.
