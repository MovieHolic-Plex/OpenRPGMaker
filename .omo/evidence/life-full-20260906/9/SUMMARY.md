# Task9 - maker game-clock deadlines

## Outcome and source identity

Implemented the scoped maker-clock feature. Natural minutes, authored time commands,
set-time, sleep/day transition and save restoration now synchronize through the existing
maker and clock authorities. Frozen inputs/outputs/duration/timeBasis and original-clock
recovery cancellation remain intact. No schema/session fields or generalized life/time
framework were added.

- Task: `st_01a07654`; parent/root: `01a0727b-398a-7481-b557-b198013542c1`.
- Worktree: `/home/main/z-project/rpg-zzu-life-full-maker-clock`.
- Branch: `agent/life-full-maker-clock`.
- Source base/HEAD throughout validation: `e33c93afbd1b0d8824f273c62d234d66c8802323`.
- Base tree: `bb854c6938045c387d94ddd7f69aec02acb50868`.
- Verified code tree: `53a223c074a220d88535ef5b707e4a8e47647679` (base plus exactly
  seven owned source/test files, with base evidence unchanged). `source.json` records
  each SHA256. The containing implementation commit adds these same blobs and this evidence;
  its commit identity is supplied in the task handoff, rather than a self-referential hash.
- Read task4 confirmed VERIFY (zero mandatory fixes; `b7b02d97` is an actual ancestor),
  corrected Phase2 review, canonical AGENTS/OpenWiki routing/runtime/time/schema/testing
  guidance, and programming TypeScript references. No CLAUDE.md was read.

## Changes and verified contracts

- `dayTransition.ts`: minute advancement reconciles at the prior clock, advances all crossed
  days and residual minutes, then synchronizes makers before committing. Zero minutes returns
  without replacing time, inventory or maker owners. New `setTimeWithMakers` performs the same
  draft boundary without inventing day transitions. Invalid live dates fail closed.
- `makers.ts`: small shared `syncMakersToGameTime` adapter reuses `absoluteGameMinutes` and
  `advanceMakers`; disabled makers still bypass absolute-minute calculation. Existing start,
  advance and collection contracts remain the authorities.
- `playSceneTime.ts`: actual `updateGameTime` treats a frame's completed minutes as one
  transaction. Menu-open elapsed frames do not accumulate. Forced sleep preserves the prior
  completed fixed-step hook time and restores a completed prefix on refusal. Authored multi-day
  commands restore the complete session after a later hook/stage failure. Set-time uses the
  shared atomic path and reports failure rather than committing only a clock.
- `saveSlots.ts`: restore uses the shared adapter after reconciliation. A present malformed
  maker-dependent saved clock is refused before lossy projection; frozen-contract original
  absolute-minute overflow is also refused. Omitted legacy clocks remain supported. The wire
  parser does not infer a default time basis for legacy jobs. Save5 keys/version and Project4
  are unchanged. Writers remain non-mutating and do not advance compatible jobs.
- `sceneTestRunner.ts`: ordinary minutes/set-time use the same authorities; failed multi-day
  operations roll back their session prefix. Starting exactly at day end no longer discards
  requested residual minutes. Existing runner-specific day-end hook policy remains.

`makerClockIntegration.test.ts` has28 cases. Actual `updateGameTime` is exercised at
29,000ms +999ms +1ms, at a2,430,000ms multi-day delta with a residual deadline, while a real
Happy DOM menu element is present, on invalid dates, on a later energy failure, and on actual
forced-sleep success/refusal. Forced-sleep completion/refusal signals are prearmed with1000ms
bounded failure deadlines; no fixed sleeps, polling or timing retries are used. Calendar tests
include40-day winter/year rollover. Other cases cover command29+1, backward set/load ready,
full-inventory multi-output refusal, duplicate collection, definition edits, legacy normal
collection versus unproven cancellation, saved-clock rejection, recovery capacity, and a
second-day hook failure after the first day completed.

The only edits to an existing test are the two overflow fixtures in
`p0RuntimeIntegration.test.ts`: year`1e300` becomes`Number.MAX_SAFE_INTEGER`. The original
assertions and both maker-disabled/ maker-enabled controls remain. The former input is itself
an invalid date under the approved fail-closed clock contract; the replacement is structurally
valid but still overflows absolute maker minutes. Thus it continues to prove disabled bypass
versus atomic maker-stage refusal without relying on invalid-date normalization. The original
values and diff remain in command receipts. No test was deleted, weakened, baseline-updated,
or marked skip.

## Exact commands, exits and RED/GREEN chronology

Every heavy invocation used this wrapper from the named worktree:

```sh
node .omo/evidence/life-full-20260906/9/run.mjs LABEL SECONDS COMMAND [ARGS]
```

It executes and captures the actual child exit from:

```sh
flock --timeout 900 /tmp/rpg-zzu-life-full-qa-01a0727b.lock \
  timeout --signal=TERM --kill-after=15s SECONDSs COMMAND [ARGS]
```

Commands were serial under that lock, with300s for focused tests/diagnostics/typecheck/probes
and600s for build. Each `LABEL.json` stores the exact argv, cwd, start/end, exit, source HEAD/tree
and tracked diff. `raw-logs.json` maps every raw log to its lossless `.log.gz`, byte count and
SHA256; gzip roundtrip equality was checked before removing only the uncompressed duplicate.
Raw failures and warnings are preserved. Label names are not verdicts.

| Label | Command after wrapper | Exit and observation |
| --- | --- | --- |
| red | `npm test -- test/makerClockIntegration.test.ts` |1;17failed: missing DOM test environment. Harness failure, not behavioral RED. |
| seam-red | same |1;14failed/3passed before any production edit. Actual clock remained processing at30; set-time/residual deadlines missed; zero-minute owners replaced; invalid dates normalized; large-frame prefix escaped; changed-clock jobs were not reconciled. One failure was an incorrect Storage argument in the test, separately corrected. |
| initial-green | same |0;17passed after implementation and Storage fixture correction. |
| diagnostics-initial | `node .omo/evidence/life-full-20260906/9/diagnostics.mjs` |1;two readonly-delete test diagnostics. Fixed by reconstructing legacy fixture records; no suppression. |
| public | `node .omo/evidence/life-full-20260906/9/clock-paths.mjs` |1;wrong defaults module path, no exercised paths. |
| public-green | same |1;missing Happy DOM Node global in renderer setup, no completed paths. |
| public-final | same |0;five paths asserted, but unrelated default HMR24678 port warning. Not the final isolated probe. |
| green | focused17-file command below |0;234passed on the earlier revision. |
| public-isolated / diagnostics / typecheck / build | probe / diagnostic / `npm run typecheck:app` / `npm run build` |all0 on that earlier revision; HMR disabled in the probe. |
| runner-boundary-red | `npm test -- test/makerClockIntegration.test.ts -t 'retains runner command minutes'` |1;actual runner ended at06:00 instead of06:30 after set26:00.25other cases excluded by the diagnostic name filter, not skipped in source. |
| force-policy-red | `npm test -- test/makerClockIntegration.test.ts -t 'preserves forced sleep hook clock'` |1;rate1 hook saw25:30 rather than existing-policy25:59; rate30 passed. This caught an intermediate aggregation regression, corrected before delivery. |
| final-green | focused17-file command below |**0;17files/237passed/0failed/0skipped**, including28 new cases, single final-revision pass. |
| final-diagnostics | `node .omo/evidence/life-full-20260906/9/diagnostics.mjs` |**0;all7 changed TS paths, zero syntactic/semantic diagnostics**, before typecheck/build. |
| final-typecheck | `npm run typecheck:app` |**0**. |
| final-build | `npm run build` |**0**;app tsc/editor, player/SDK and standalone completed within600s. |
| final-public | `node .omo/evidence/life-full-20260906/9/clock-paths.mjs` |**0**;actual final-source public module/DOM/Storage assertions, HMR disabled. |

Exact final focused command:

```sh
npm test -- test/makerClockIntegration.test.ts test/p0Makers.test.ts test/p0RuntimeIntegration.test.ts test/p0DayTransitionSceneFailure.test.ts test/p0TransitionControlFlow.test.ts test/p0LifeLedgerUi.test.ts test/p0SessionPersistence.test.ts test/timeSystem.test.ts test/customSeasonSave.test.ts test/lifeRecovery.test.ts test/lifeRecoveryPersistence.test.ts test/lifeSaveVersion.test.ts test/p1DayTransitionIntegration.test.ts test/p1WeatherDayTransition.test.ts test/p2DayTransition.test.ts test/p2SpatialPersistence.test.ts test/autosave.test.ts
```

Also executed exit0: `node --check` on all three evidence `.mjs` files and `git diff --check`.
Final build retains existing circular-record-picker, mixed-import, optional-proxy-key,
runtime-resolved-asset and large-chunk warnings. None was hidden or fixed outside scope.

## Public path evidence and limits

`clock-paths.mjs` imports the real exported-player store shim, clock, maker, ledger model/DOM
renderer, save codec and runner modules. It starts each maker by clicking the real rendered
ledger action; the callback spends3 input units. Camera completion and scene render endpoints
are the only scene substitutes. No clock, maker, recovery, storage or clone authority is mocked.

`clock-paths.json` asserts and records five paths: natural29->30 (plus600,000ms menu pause),
command29+1, set29->30->backward0, winter40 sleep, and real writer->Storage->reader->apply of
a historical processing save at its deadline. Each preserves the frozen promise, becomes ready
without auto-payout, refuses full-inventory collection atomically, pays output2+bonus1 exactly
once, and refuses the duplicate with the complete state unchanged. Natural/command/set/sleep
also collect through the rendered ledger callback. Repeated rendering is explicitly non-mutating.
The actual runner is additionally exercised for30 natural game minutes; its maker-job journey
is **not** claimed by this probe. The unit/related suites cover its command/day callers.

This is **real public-module and Happy DOM action evidence, not native Phaser/player.html
keyboard gameplay, image QA, or a complete51-feature journey**. No native browser was launched,
no editor-play path was used, and no remote project/content was written. Dedicated player and
full authoring/remote journeys remain tasks18/19. Provisioned port33617 was inspected at entry
and cleanup and had no listener; no unverified server URL is claimed. The final module server
is middleware-only with HMR disabled. The prior HMR-port warning and both public setup failures
remain archived rather than counted as clean executions.

Full13k gates were not rerun: the parent owns phase comparison. The corrected Phase2 review
explicitly retained two1200-second whole-gate timeouts (exit124, no current full Vitest report),
unknown whole-suite regression status, and six existing surface failures. Task9 focused green
and build success do not remove those limits or imply F1..F4 approval.

## Scope, wiki proposal and cleanup

Only the five assigned production files, the new maker-clock test, the two clock fixture values
in the related existing test, and this task9 evidence are delivered. No farming/fishing/forage/XP,
tool/field-input implementation, housing/ledger UI, shared wiki/INDEX/root-state, dependency,
baseline, schema or session-field edits. No scope conflict required another lane's files.

`WIKI-PROPOSAL.md` supplies exact minimal replacement/addition text for the parent's serial
runtime-sessions/runtime-project-schema/testing integration. No prose-pinning tests were added.

`cleanup.json`: both builds' task-owned `dist` was removed only after confirming it was absent
at entry, not symlinked and entirely untracked. Task9 SSR cache is absent; every Happy DOM window,
Storage and Vite instance closed in finally. No Node/Bun process remains with this worktree cwd,
port33617 is free, and tracked/shared caches were untouched. No installs, push/PR/merge/amend,
remote writes, destructive git or shared cleanup occurred. The task-owned logs remain losslessly
archived. The final handoff verifies the committed worktree is clean.
