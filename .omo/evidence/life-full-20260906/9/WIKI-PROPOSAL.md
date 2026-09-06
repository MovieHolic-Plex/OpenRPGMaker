# Task9 minimal wiki proposal (parent-owned serial integration)

Do not copy this proposal into shared wiki files until the parent integrates task9.
No wiki or generated INDEX file was changed by this task.

## openwiki/runtime-sessions.md

Under `## Lossless life snapshot reconciliation (2026-09-06)`, replace exactly:

> Compatible makers are synchronized at restored game time only after reconciliation; natural ticks, command clocks and UI timing remain outside this task.

with:

> Compatible makers are synchronized at restored game time only after reconciliation. Task9 also synchronizes natural game minutes, authored time advances, and set-time through the existing clock/day authorities; ledger rendering never advances jobs.

Append this short section:

## Maker clock deadlines (2026-09-06)

`syncMakersToGameTime` in `src/project/makers.ts` uses the existing authored active-day absolute-minute clock. `advanceTimeAcrossDayBoundaries` and `setTimeWithMakers` reconcile on a draft at the prior clock, change time, synchronize deadlines, and commit together. Zero-minute advances do not replace owners. Ready jobs never regress on backward set-time. Definition edits preserve frozen contracts; cancellation still uses the original time basis and never infers legacy spent inputs.

`updateGameTime` processes a frame's completed game minutes atomically, retains menu/battle/cutscene pause, and preserves the last completed fixed-step clock for forced-sleep hooks. A failed forced sleep or later authored-day stage restores the operation's session. The headless runner shares minute/set-time authorities, retains its existing day-end hook policy, and preserves residual minutes when starting exactly at day end. Regression: `test/makerClockIntegration.test.ts`.

## openwiki/runtime-project-schema.md

Append to `## Life ownership in Save5 (2026-09-06)`:

> When saved maker jobs depend on a present clock, writer/parser/apply reject malformed dates rather than dropping the clock while keeping its jobs. Frozen jobs also reject absolute-minute overflow in their original basis. Legacy omitted clocks retain the initial-clock fallback; project-free parsing does not impose the default calendar on legacy jobs. Save5/Project4 versions and key namespaces are unchanged.

## openwiki/testing.md

Append to the P0 life-runtime validation bullet:

> `test/makerClockIntegration.test.ts` exercises actual `updateGameTime`, command/set-time, sleep and the Storage codec. It covers minute29/30, multi-day residual deadlines, menu-open elapsed frames, zero-owner-identity preservation, backward-ready state, frozen promises, original-clock recovery, invalid dates, later-stage rollback and collection overflow/duplication. Task9's public ledger/clock probe is Happy DOM plus real modules with camera/render endpoints, not native player gameplay or the complete51-feature journey.
