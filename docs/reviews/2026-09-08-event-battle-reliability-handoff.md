# Event battle reliability implementation handoff

Branch: `agent/event-battle-reliability`.
Base: `origin/main` at `1959dec2e`; scope commit: `0fe161e7d`.
Implementation task: `st_01a07fab`. This is a candidate, not review approval.
No content DB writes, push, PR messages, PR merge or deployment were performed.

## Review P1 revision and main integration

Ultrabrain requested changes on `68c87888e`: the result-confirm callback had
already set `exiting` when a synchronous exit-transition factory or `exit()`
throw escaped, leaving its promise and foreground ownership unsettled.

Repair commit `6d45807d0` wraps only that synchronous invocation boundary and
routes it to the existing `fail` handler; asynchronous rejection retains the
same handler. `battleResultTransitionFailure.test.ts` mounts the real battle
DOM/runtime and invokes the actual callback supplied to it through a real
foreground event. The only injected fault is the transition adapter. It checks
factory throw, exit throw, async rejection, and late rejection after cancellation
or session replacement: bounded settlement, a runtime error node, no rewards,
outcome or event continuation, and DOM/audio/input/lease cleanup.

RED: two tests failed because `factory-throw` and `exit-throw` escaped the callback;
the async rejection and two stale-owner regressions already passed. GREEN before
merge: 31 tests across three suites. Logs are under
`/dev/shm/st_01a07fab-event-battle-evidence/review-p1/`.

Fetched and merged `origin/main` at `8ab349dfc21cb0c0c22a554f74a25bdeb05ab741`
without rewriting history. Only `openwiki/INDEX.md` and
`openwiki/editor-event-authoring.md` conflicted: both authoring sections were
preserved and the index regenerated. Inspected the auto-merged validator: battle
admission checks remain, alongside main's item-plus-equipment shop references.

Final merged validation: **150 tests across 14 suites passed in one run with
maxWorkers=2**, `typecheck:app` passed, changed-code diagnostics were clean, and
OpenWiki verification/index checks passed. Evidence: `focused-merged.log`,
`typecheck-merged.log`, `wiki-merged.log`, and `red.log` in the directory above.
The lead's old-candidate editor/runtime QA and build evidence remains in
`.scratch/lead-verification.md`; it is not a revised-candidate pass claim. The
obsolete full-gates run was stopped, not passed. Revised full gates/build and
ultrabrain rereview remain lead-owned. The sections below record the initial
implementation evidence and are superseded by this revision where applicable.

## Delivered boundaries

- Native command Confirm rejects empty/missing fixed references, empty effective
  troop composition and incomplete/missing variable selection. The same mounted
  draft retains preset/rule/branch edits and accepts correction. Aggregate event
  Apply/Test also rejects empty fixed composition.
- Variable selection resolves explicitly and never falls back to the stale fixed
  reference on invalid input. The actual resolved troop is validated by runtime
  construction. Existing numeric compatibility is retained, including finite
  truncation, the 1-based/zero-based lookup, numeric 0 selecting the first troop,
  and legacy ID/suffix matching. Existing trimmed string IDs remain accepted.
- Constructor and transition initialization errors restore field audio and cancel
  initialized runtime state. Foreground event failure visibly reports and stops
  without resuming branches/subsequent commands or fabricating a result. Parallel
  failure retains its stopped-process policy; cancellation remains null and cannot
  publish late state into a replacement owner/session.
- Empty monster-party mode reports why admission failed, not escape or forced
  defeat. A real starter grant permits retry. Existing random/field callers handle
  the new typed admission errors rather than introducing unhandled rejections.
- Autorun admission waits for dialogue readiness and Phaser's RUNNING state. The
  `create` event is the exact signal after `Scene.create()` returns; synchronous
  invalid-variable failure during construction is no longer lost as cancellation.
- Shipped `playSurface.css` owns the runtime-error notice. Editor-only CSS had
  left errors below the player canvas. The notice is now inside crop bounds,
  inverse-scaled, wrapped and nonmodal. Hidden-enemy setups remain legitimate.

No schema, migration, new outcome value or content authoring was introduced.
The loader's existing distinction remains: explicit empty `members` is
normalized as authoritative; legacy enemyIds-only JSON omits `members`.

## RED evidence

Full local logs are under `/dev/shm/st_01a07fab-event-battle-evidence/battle-reliability/`.
The first test-development run also found fixture/import mistakes; those are not
claimed as product regressions. The following failures occurred at behavior assertions:

| Evidence | Actual failure before repair |
| --- | --- |
| `red-corrected.log` | Invalid native Confirm called onApply and closed; aggregate empty-troop validation did not block; invalid variable values resolved victory through the stale fixed troop; foreground action/auto rejected; parallel construction changed audio; empty party resolved escape; empty composition constructed successfully; stale rejection escaped. |
| `red-callers.log` | Existing random caller emitted an unhandled BATTLE_MONSTER_PARTY_EMPTY rejection; field caller rejected instead of reporting. |
| `red-legacy-composition.log` | Empty composition with omitted legacy enemyIds produced TypeError instead of typed admission failure. |
| `red-auto-ready.log` | Autorun one-shot key count was 1 before a dialogue UI existed (expected 0). |
| `red-auto-create.log` | Autorun one-shot key was consumed while Phaser was inactive inside create (expected deferred admission). |
| `red-error-visibility.json` / `.log` | All five error notices had y=960 in a 1280x960 viewport, fully below the visible player; DOM-presence checks alone had misleadingly passed. |

## Final focused validation

- `focused-final.log`: **13 files, 144 tests passed**, one run, `--maxWorkers=4`.
  Suites: eventBattleAdmission, eventBattleFailure, battleInitializationAdmission,
  battleProcessingCommandBody, eventDraftValidator, battleRuntime,
  battleStrictRuntime, gen1MonsterLifecycle, npcScheduledBattle,
  npcBattleLifecycle, playSceneBattleCancellation, battleDefeatOutcome, battleAudio.
- `typecheck-final.log`: `npm run typecheck:app`, exit 0.
- TypeScript/JavaScript language-server checks reported no diagnostics on changed
  code/tests. CSS LSP could not run because Biome is not installed; no dependency
  was installed to hide that limitation. Actual CSS parsing/rendering and the CSS
  gate below were run instead.
- `css-final.log`: `npm run gates -- --only css`, exit 0, budget=0, graph=0,
  no regression against the repository baseline.
- `wiki-verify.log`: `npm run openwiki:verify`, no failures.
- `node --check scripts/qa/runtime/event-battle-reliability.probe.mjs`: exit 0.
- Final Firefox exported-player matrix: **11/11 passed, no page errors**, including
  real variable correction/retry. Valid starts reach the actor command menu after
  the entry transition is removed. Errors restore input, stop continuation, retain
  field BGM, and have measured bounds x=12, y=12, width=1256, height=49, alpha=1
  at 1280x960 (rather than the RED y=960). Expected console error diagnostics are
  retained in results.json, not suppressed.

Browser artifacts remain in the assigned worktree:
`verify-shots/runtime-qa/event-battle-reliability-final/{SUMMARY.md,results.json,*.png}`.
The producing agent cannot visually interpret image attachments in this runtime;
geometry/state evidence is not independent visual approval.

## Reproduce and independent acceptance

```bash
cd /dev/shm/rpg-zzu-event-battle-reliability
mkdir -p .scratch/battle-reliability
TMPDIR=$PWD/.scratch/battle-reliability QA_BROWSER=firefox \
  node scripts/qa/runtime/event-battle-reliability.probe.mjs
```

The probe owns an ephemeral player-QA server unless QA_BASE_URL is supplied;
QA_OUT_DIR and comma-separated QA_CASES are supported. Chromium's first run hit
ERR_NETWORK_CHANGED during one case; Firefox avoids that observed host issue.
The runner adds no production QA hooks and writes no content DB data.

Lead-owned remaining release work:

1. Real native editor picker/Confirm/reopen QA: empty and removed fixed troop,
   empty composition, empty/missing variable, valid variable, hidden and legacy
   composition. Set a boss preset and result branch before invalid Confirm;
   `event-command-edit-dialog` must remain, `battle-processing-warning` must be
   visible, and correction must retain those edits before save/reopen.
2. Inspect the final exported-player screenshots and repeat independent browser
   QA. The probe includes valid/invalid action, auto and parallel, empty troop,
   empty monster party, hidden enemies, legacy enemyIds and numeric 0.
3. Full baseline-comparison gates and production build, owned by the lead.
4. Ultrabrain reviews the exact candidate. Request changes return to the sole
   editor and are re-reviewed until approval. Only the lead merges PR #699.

Known retained policy: failed parallel processes do not retry every frame; they
require page/map reactivation. Action retry after correction is supported. The
numeric 0 alias is deliberately retained rather than silently breaking projects.
