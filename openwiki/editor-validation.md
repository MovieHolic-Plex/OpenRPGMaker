# Editor Validation Expectations

Wiki verification, Playwright evidence, and focused test guidance for editor changes.

## Validation Expectations


- Wiki-only edits should pass `npm run openwiki:verify`.
- Event and database UI repairs should have focused Playwright evidence. Task 10 added separate event and database stabilization specs under `test/e2e/`: the event spec covers event delete confirmation and shop branch persistence, and the database spec covers Database dirty discard, command-reference delete blocking, Common Event nested command editing, troop battle-event page switching, and enemy action switch picker behavior.
- For future editor workflow changes, run the smallest focused Vitest or Playwright path that proves the touched surface, then record the exact command and pass/fail excerpt under task evidence.
- For event-command parity changes, include focused tests for the support table, command-list/picker badge metadata, `projectLint` warning output, and write-tool `ToolResult.issues` propagation. `projectLint` reports non-full map/common/troop-event runtime support as warning code `runtime-support:<commandKind>`; `upsert_event` and `upsert_common_event` summaries also report the unsupported-command count.

