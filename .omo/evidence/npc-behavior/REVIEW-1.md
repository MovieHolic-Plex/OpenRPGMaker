# NPC behavior publication-readiness gate review

- recommendation: **REJECT**
- goalId: `npc-behavior`
- reviewer task: `st_01a0766c` (`omo-senpi-gate-reviewer`)
- review date: 2026-09-06
- reviewRoot: `/home/main/.herdr/worktrees/rpg-zzu/worktree-clear-stone-e8b2-npc-behavior-review`
- evidenceRoot: `/home/main/.herdr/worktrees/rpg-zzu/worktree-clear-stone-e8b2/output/evidence/npc-behavior`
- reviewed HEAD: `d5efc923f87ba661111dd7e39f829c2b2b24bb30`
- comparison base: `49067218aebf889d98c2dc05be08231787483427`
- report placement: fallback `.omo/evidence/npc-behavior-gate-review.md`; `omo-agent-toolkit ulw-loop status --json` returned `ULW_LOOP_PLAN_MISSING` for this child session. No plan or attempt directory was created.

## originalIntent

Repair the audited Ao-Oni-style pursuit deficiencies, add Pokemon-style trainer detection followed by an actual approach and battle, make optional authoring controls honest and persistent, and provide adversarial review plus real-browser evidence before publication. This is engine/editor work, not permission to edit remote game content or introduce a new engine framework.

## desiredOutcome

A creator can author and reopen explicit sensing/pursuit policies; a player experiences continuous, collision-respecting pursuit and one owned trainer encounter with real movement and real battle results. Existing projects retain their legacy contracts. Transfers, cancellation, and replacement runtime contexts must not let stale commands change the new context or mismanage input ownership. Commit/PR publication and temporary review-tree removal are explicitly deferred until approval and are not blockers here.

## userOutcomeReview

The captured primary pursuit, trainer, and editor flows are substantive and generally support the intended outcome. The evidence is not merely screenshots of an overlay: it includes actual input, intermediate sprite positions, battle command/target/result states, command sentinels, and Apply/reopen assertions. However, two focused executions expose remaining C4 failures that the supplied tests do not cover. A legacy parallel event loses its battle entirely. A trainer list awaiting dialogue continues to mutate state after an unrelated map replacement, despite the transfer-continuation exemption being for its own authored transfer. Publication readiness is therefore not established.

## blockers

### B1 - Legacy parallel events drop battleProcessing without starting a battle

- violatedCriterion: **C4** - parallel battle reaches and awaits the real battle/result branches; **C3** legacy compatibility is also affected.
- evidencePointer: `reviewRoot/src/player/scheduledBattle.ts:25-35`, especially line 30; `reviewRoot/src/player/playSceneSchedulers.ts:75-77`; `reviewRoot/src/project/runtimeEventState.ts:107-121`; executable reproduction in this report, test `gate reproduction: legacy parallel battle reaches the shared battle path`.
- Observation: the scheduler represents a pageless event with `process.pageId = "legacy"`. The runtime view correctly represents its missing page as `view.pageId === undefined`. The new scheduled-battle validity check compares those values directly. It deletes the process before claiming foreground or invoking the real battle path.
- Reproduction: use the existing `encounterHarness('parallel')`, move its authored battle commands onto `event.commands`, remove `event.pages`, and call the real `updateParallelEvents(scene, 0)`. This is a supported legacy shape; event pages remain optional at the project-shape boundary (`src/project/io/shapeEventFields.ts:277-279`).
- Expected: one `scene.playBattle` invocation with the interpreter held for its result.
- Actual: **`expected "spy" to be called 1 times, but got 0 times`**.
- Independent narrow admission probe also compared paged and pageless events through actual runtime-view/foreground/scheduled-battle modules: paged `battleCalls=1, resumes=1`; pageless `battleCalls=0, resumes=0, processRetained=false`.
- Required correction: preserve the scheduler's legacy page sentinel consistently when validating the pending event; retain the active-trigger and process-identity checks. Add behavior coverage through the real scheduler for the legacy command-list path, including result continuation.

### B2 - An unrelated map replacement does not invalidate an admitted trainer list

- violatedCriterion: **C4** - admitted command lists survive their **own authored** page/map changes, while canceled/stale work must not affect a replacement runtime context; **C2** late ownership/cancellation safety is also implicated.
- evidencePointer: `reviewRoot/src/player/npcDetectionEncounter.ts:58-59,71-73,112-115`; `reviewRoot/src/player/playSceneInterpreter.ts:200-211`; `reviewRoot/src/player/foregroundControl.ts:23,28-33`; executable reproduction in this report, test `gate reproduction: external map replacement invalidates an awaiting trainer list`.
- Observation: the controller unconditionally exempts the `commands` phase from map-reset cancellation. `commandsCurrent` checks token/session identity but not the map owned by that token, and the command runner's currentness predicate also omits that map check. Consequently an external map reset is treated like an authorized authored transfer even though no transfer command ran.
- Reproduction: let the real detector approach the player and enter a list containing `text` followed by `setFlag(staleTrainerMutation, true)`. Keep only the dialogue UI unresolved. Replace the active map in the same session and execute the real `resetMapRuntime`, then drive a frame and resolve the old dialogue. Await the old lease's complete release chain.
- Expected: the old list does not execute the flag command or complete the old encounter after the unrelated replacement.
- Actual: **`expected true not to be true // Object.is equality`** for `session.flags.staleTrainerMutation`.
- The remaining completion assertion in that probe was not reached after the first failing assertion; this report does not claim that assertion independently failed. Source inspection shows that normal-completion eligibility also uses the same map-blind predicate.
- Related static consequence: the lease still owns its original map ID and refuses to restore input on release after this replacement. The reproduction intentionally asserts the stale mutation, not that additional consequence.
- Required correction: distinguish an explicit transfer owned by the admitted command list from an unrelated map replacement. Keep the own-transfer/page-change continuation contract, but invalidate other map replacements before resuming the old list.

## Executed focused reproduction

No test or production file was edited. A Vite transform appended the following two tests **in memory** to the existing ownership-boundary test module. All runtime detector, scheduler, interpreter, map-reset, and movement modules remain the actual modules used by the existing fixture. The battle UI adapter and deferred dialogue are the fixture/UI boundaries, not replacement ownership or interpreter implementations.

Executed from `/home/main/.herdr/worktrees/rpg-zzu/worktree-clear-stone-e8b2`:

```bash
node --input-type=module <<'JS'
import { startVitest } from 'vitest/node';
import path from 'node:path';
const root = path.resolve('../worktree-clear-stone-e8b2-npc-behavior-review');
const extra = `
it('gate reproduction: legacy parallel battle reaches the shared battle path', () => {
  const f = harness = encounterHarness('parallel');
  f.event.commands = f.page.commands;
  delete f.event.pages;
  updateParallelEvents(f.scene, 0);
  expect(f.battle).toHaveBeenCalledTimes(1);
});
it('gate reproduction: external map replacement invalidates an awaiting trainer list', async () => {
  const f = harness = encounterHarness();
  let show; const shown = new Promise<void>(resolve => { show = resolve; });
  let answer; const answered = new Promise<void>(resolve => { answer = resolve; });
  const dialogue = f.scene.game.registry.get('dialogue');
  vi.spyOn(dialogue, 'showText').mockImplementation(() => { show(); return answered; });
  f.page.commands = [
    {kind:'text',body:'gate signal'},
    {kind:'setFlag',flag:'staleTrainerMutation',value:true}
  ];
  await f.frames(120); await bounded(shown);
  const owner = required(foregroundOwner(f.scene));
  const released = nextLeaseRelease(owner);
  const replacement = {...structuredClone(f.map),id:'external_replacement',events:[]};
  f.project.maps[replacement.id] = replacement;
  f.scene.map = replacement;
  f.scene.session.currentMapId = replacement.id;
  resetMapRuntime(f.scene);
  await f.frame();
  answer(); await bounded(released);
  expect(f.scene.session.flags.staleTrainerMutation).not.toBe(true);
  expect(f.scene.session.detectionEncounterCompletions?.trainer?.trainer_page).not.toBe(true);
});
`;
const ctx = await startVitest('test',
  ['test/npcEncounterOwnershipBoundaries.test.ts'],
  {root, config:false, watch:false, maxWorkers:1, fileParallelism:false,
   testNamePattern:'gate reproduction', cache:false, silent:false},
  {configFile:false, resolve:{alias:{'@':path.join(root,'src')}},
   plugins:[{name:'readonly-gate-probes', enforce:'pre', transform(code,id) {
     if (id === path.join(root,'test/npcEncounterOwnershipBoundaries.test.ts'))
       return code + extra;
   }}],
   test:{environment:'happy-dom', include:['test/npcEncounterOwnershipBoundaries.test.ts'],
         testTimeout:10000}});
await ctx.close();
JS
```

Result: exit **1**, Vitest 3.2.4, **2 failed**, 9 existing tests excluded by the focused name filter, duration 8.54 seconds. The existing nine tests were not deleted, modified, or represented as rerun passes. Reported virtual test locations were lines 96 and 114 of the transformed module; those are not on-disk source locations. The exact production locations are listed above.

The async probe subscribes to dialogue entry and final lease release before the relevant actions, uses explicit game-frame advancement, and bounds awaited signals with the existing fixture helper. It does not use sleeps or success polling.

An earlier standalone admission-only probe had an incomplete post-admission interpreter adapter and errored after printing its observations. It was not treated as a passing integration test. The corrected admission probe and the actual Vitest integration reproduction above independently establish B1. No product code was changed to accommodate either probe.

## Criterion mapping and representative flows

| Criterion | Review result | Directly checked behavior and evidence |
| --- | --- | --- |
| C1 | No blocking finding | Traced visible acquisition -> LOS loss/search clock -> source-door admission -> cadence/current phase -> projected runtime landing -> unseen local search -> hiding expiry -> reacquisition/contact. `horrorRuntime`, `pursuitDoors`, `pursuitNavigation`, autonomous updates, transfer landing, save parsing and restoration all inspected. Tests include footprint/passRows, spatial/event blockers, unloaded-position isolation, blocked landing remainder, saved trail/search, lastSeen/persistent and hiding/safe zones. Post-identity-fix pursuit browser history has 629 states and the actual contact sentinel. |
| C2 | Blocked by B2's lifecycle boundary | Traced fixed/moving sensing before input, runtime-facing forward ray and LOS supercover, synchronous foreground claim, emote, pathfinding to legal adjacency, real interpreter admission, completion receipts, manual-first completion, suppression/rearm, and late release. Real trainer cases cover behind/wall/front/two trainers/manual-first/blocked approach/parallel battle. The unrelated-map-after-dialogue boundary was absent from those cases and fails the added probe. |
| C3 | No separate authoring blocker; legacy runtime issue B1 | Inspected optional fields, strict validators, page normalization, defaults only on new chase selection, invalid auto/parallel/object combinations, clearing existing invalid detection, own-property receipt handling, save/project roundtrip, and actual editor controls. Apply/reopen assertions are in the real browser runner at both viewports. Shell baseline changes add the detector fieldset/checkbox in five variants without removing controls or changing a floor. |
| C4 | **FAIL: B1, B2** | Traced scheduled battle queue -> foreground claim -> actual `playBattle` -> result branches -> lease cleanup; normal battle cancellation/session checks and opt-in interpreter transfer continuation inspected. Existing paged-battle and own-authored-transfer cases are meaningful but do not cover B1/B2. |
| C5 | Evidence supports the primary flows; readiness fails on C4 | No dependency/manifests or remote-content changes in the diff. QA fixture is memory-only, blocks external/unexpected writes, retains request errors, and uses the existing persistence-off editor seam. Cleanup receipts exist. Full-gate failure is disclosed rather than suppressed. Publication and temporary review-tree cleanup remain deferred as requested. |

### Added autorun hypothesis: not established as a blocker

Question: can `claimForeground` reject `inputEnabled=false` after `fireAutoTriggers` has consumed a started key while `scene.running=false`?

The hypothetical state would indeed be rejected, but the inspected production startup/transfer callers do not establish that state:

- `src/player/PlayScene.ts:114-115` initializes input enabled and running false.
- `PlayScene.create():245-293` sets up the map/player, then schedules autoruns after dialogue readiness.
- `src/player/player.ts:403-406` installs the real dialogue registry value; neither this startup path nor `exportAppModeShim.startPlayGame` introduces an input-disabled idle window.
- Production input-disable sites in the interpreter, foreground lease, field-spawn battle, and random encounter set `running=true` before disabling input.
- `PlayScene.applySession():535-542` restores `running=false` and input enabled synchronously before loading the replacement map.
- Normal interpreter transfer retains its running owner through `transferTo`; destination `fireAutoTriggers` skips a running scene without consuming the key (`playSceneMapRuntime.ts:705-708,718-720`). Normal release re-enables input before refreshing runtime surfaces, which then retries autoruns.

No startup/transfer blocker is asserted from manually manufacturing the proposed boolean combination. The reviewed source establishes no legitimate caller window for it. This is distinct from B2's reproduced external-map lifecycle failure.

## Evidence audit

### Identity and controlled test comparison

- Reproduced locked HEAD and a clean review-tree `git status --short` before and after the focused test. `git diff --check 49067218` was clean.
- Compared the bytes of every changed source/test/QA-script file between the review tree and the current main workspace: **no mismatches**. An ordinary tracked-only main diff misleadingly lists untracked delivered files as absent; the byte comparison includes them and is the relevant comparison.
- Independently parsed the complete native JSON files, not truncated gate stdout:
  - `base-new-failures.json`: 45 files, 431 tests, 393 pass / 38 fail.
  - `current-new-failures.json`: 54 files, 543 tests, 505 pass / 38 fail.
  - Main `.omo/gates-vitest-report.json`: 1,614 files, 14,562 tests, 14,317 pass / 230 fail / 15 pending.
- Recomputed failing assertion identities and normalized first-line failure messages: **no new assertion and no changed message** in the stored bounded comparison. No baseline file is missing from that current comparison.
- Independently verified `git diff 49067218 be70a63 -- src` and the selected baseline test files are empty. The starting-source-equivalent comparison is supported, not merely asserted.
- The current JSON explicitly contains all nine scoped NPC/horror files with 112 passed tests. Those are stored executor results, not a claim that this reviewer reran all 112.
- The 17 full-run-only flags remain unreproduced in the bounded comparison, as recorded in `gate-comparison.json`. This does not make the entire stock suite green.
- Read `green-shell-surface.log`: 22 passed; read the actual baseline diff, which adds controls instead of lowering the expected surface.
- Read `build-identity-final.log`: app/export-player/standalone build completion, SDK artifact `03f9bc1f4c66e43d`, source prefix `bf46e540e0a99554`. Existing asset-resolution and chunk-size warnings remain visible. No broad gates or build were rerun by this reviewer.

### Browser artifacts, chronology, and source provenance

- Parsed all three scenario reports and all their action JSONL files; report actions and JSONL actions match exactly. Every screenshot referenced by those reports exists; all ten scenario trace ZIP files exist and are nonempty.
- Read the real runner and fixture. Only the fixture project response is supplied; relay uses the owned Vite responses with `maxRetries:0`. Real engine/interpreter/battle/editor behavior is not stubbed by the browser runner.
- Parsed the complete pursuit and seven trainer histories: pursuit 629 states; behind 22, wall 22, front 73, two-trainers 76, manual-first 17, blocked-approach 28, parallel-battle 11. Positive trainer histories include actorCommand -> targetSelect -> resolved, victory sentinel, and restored input. Counts alone were not used for acceptance; phases and end-state values were inspected against assertions.
- Audited trace network response source maps against the locked source, reading embedded `sourcesContent`:
  - Post-fix pursuit trace: **25 changed source modules match exactly**, including `runtimeMap.ts` and `playSceneMapRuntime.ts`; no mismatch.
  - Front trainer trace: **24 changed source modules match exactly**; only `runtimeMap.ts` and `playSceneMapRuntime.ts` differ, consistent with its documented pre-identity-fix execution. The trainer/detector/interpreter/battle code itself matches.
  - Editor 1024 trace: **13 changed source modules match exactly**, including all changed editor controls/normalizer; no mismatch.
- Report metadata says dirty source at `d4e6164f`; the embedded-source comparisons provide stronger provenance than that metadata alone. The earlier trainer run is not falsely described as a full post-identity-fix browser rerun.
- Each report contains observer/render listener/signal cleanup, trace stop, context/browser/server closure, and exclusive-bind port release receipts. Verified reported ports: pursuit 35835, trainer 36423, editor 43435. These are inspected execution receipts, not a new live port probe by this reviewer.

## Direct remove-ai-slops and programming pass

Loaded and consulted:

- `/home/main/.claude/skills/remove-ai-slops/SKILL.md`
- `/home/main/.claude/skills/remove-ai-slops/references/slop-categories.md`
- `/home/main/.claude/skills/programming/SKILL.md`
- `/home/main/.claude/skills/programming/references/philosophy.md`
- `/home/main/.claude/skills/programming/references/typescript/README.md`

Applied these perspectives directly to the production diff, both test fixtures, all added NPC test files, modified footprint tests, QA scripts, and shell baseline. No cleanup edits were made.

| Check | Finding |
| --- | --- |
| Excessive/useless tests | No blocking excess found. Parameterized timing, terrain, page/session/owner, validator, and legacy cases exercise materially different behavior. Some fixture policy aliases duplicate newly available production types and are minor maintenance debt. |
| Deletion-only/removal-verification tests | No new test is only a source-text assertion that a symbol/overlay was removed. Negative overlay assertions accompany positive battle invocation, result, and command-continuation assertions. |
| Tautological tests | Timing tests assert arrival at deadline minus one and at the deadline, not just equality between two helpers computing the same answer. Save tests traverse JSON parsing/restoration. No prose-pinning test was added. |
| Implementation-mirroring/false confidence | Fixtures use actual runtime movement, interpreter, scheduler, page resolution, and save seams. Battle DOM lifecycle tests intentionally adapt transitions/UI and have separate real-browser battle evidence. The missing pageless-event and external-map-after-admission variants are the concrete false-confidence gaps exposed by B1/B2, not a reason to reject unrelated tests. |
| Async determinism | Added tests drive game frames and use deferred signals with bounded deadlines; the final lease-release tests observe the complete finally chain. Browser assertions subscribe before actions and inspect render/DOM state. No fixed wall-clock sleep was found in the added NPC test files or browser runner. |
| Unnecessary extraction | `commandBattle` has the actual foreground/scheduled callers; runtime-map projection shares loaded/unloaded override semantics; pursuit navigation/door modules separate concrete responsibilities; the foreground lease is a concrete ownership seam. No speculative framework or dependency was introduced. |
| Parsing/normalization | New validators are at project/save boundaries. Optional omissions remain optional; runtime-map projection does not invent defaults. Own-property completion handling addresses authored string IDs. No unnecessary text parsing/normalization was added to production. |
| Error suppression | New async boundary catches log errors and expose runtime errors while preserving cancellation/lease cleanup. Gate failure output is retained. No type/lint/test suppressions or deleted failing assertions were found in the diff. |
| Complexity/size/style | Lifecycle predicates need the concrete correctness repair in B2, not a stylistic rewrite. Existing large scene/editor/save/schema modules remain large. Approximate nonblank/non-comment-only counts above 250 include eventPages 502, pageProps 1335, PlayScene 572, playSceneAutonomous 280, playSceneInterpreter 695, playSceneMapRuntime 612, playSceneMovement 611, playSceneSchedulers 401, saveSlots 1089, shapeEventFields 361, session 676, types/events 522. These existing module-size issues and compact multi-statement formatting are maintenance notes, not criterion-linked blockers or a request for broad refactoring. |
| Scope | Diff has no package/dependency or DB content change. Generated wiki-index churn reaches unrelated index entries but does not modify those underlying features; nonblocking generated-document noise. |

### Prior code-review report coverage

No current NPC code-review report with explicit `remove-ai-slops`/`programming` and overfit-category coverage was supplied or found in the referenced NPC evidence directory. `ACCEPTANCE.md` says adversarial review is pending; the notepad records executor self-review and boundary fixes, not a separate complete skill-perspective review report. The root `review.md` is an unrelated August battle review and was not used as NPC approval evidence.

Thus prior-report skill coverage **cannot be confirmed**. This is an exact evidence gap, not an additional blocker: this task explicitly has one reviewer, and the direct code/skill-perspective checks above are performed by that reviewer in this artifact. No extra review process or unrelated report is being demanded as a publication condition.

## Exact evidence gaps and nonblocking notes

1. The supplied tests/browser matrix did not exercise B1 or B2. The focused reproduction in this report closes the diagnostic gap with failures, not acceptance.
2. The image tool returned `Current model does not support images` for the editor-1024 reopened image and front battle image. No direct aesthetic or pixel-readability inspection is claimed. Trace DOM includes the selected `정면 직선` label at both editor sizes, and actual control/application/reopen assertions ran, but this reviewer cannot independently certify visual clipping from those omitted image attachments.
3. Both editor `*-states.json` histories are empty arrays: the history collector records player postrender state, which is absent on this editor surface. Actual editor evidence lives in the action log and Playwright trace DOM/evaluation records. Calling those files substantive editor state histories would be inaccurate, but the required Apply/reopen execution has separate evidence.
4. The full suite is not green. The stored bounded base/current comparison supports no new failures in the examined flagged files, not a proof that all 230 full-run failures are individually understood. The 17 nonreproducing full-run flags remain explicitly uncertain.
5. Changed-TS LSP clearance is reported by the executor/notepad; this reviewer did not independently rerun all LSP diagnostics. The stored build/typecheck evidence was inspected. JSON was parsed natively; no JSON language server or new dependency was installed.
6. Browser cleanup receipts were audited, not regenerated. Final publication and temporary worktree cleanup remain outside this readiness gate, as requested.
7. Unrelated baseline failures, generated-index noise, existing large modules, and alternative architectural choices are not blockers.

## Checked artifact paths

All source paths above are relative to `reviewRoot`; all short evidence paths below are relative to `evidenceRoot` unless stated otherwise.

- Full locked diff (`git diff 49067218`) for the 51 changed files, including all changed production/editor/project files, all added/modified test files, QA scripts, four wiki files, and the shell surface baseline. Inspected neighboring runtime page resolution, pathfinding, movement commands, footprint, DOM, startup, map reset, and player export startup files for flow integration.
- Main `/home/main/.herdr/worktrees/rpg-zzu/worktree-clear-stone-e8b2/.omo/evidence/npc-behavior/ACCEPTANCE.md`.
- Notepad `/tmp/ulw-20260906-161742.wGQ2Nm.md` (planning, criteria, execution evidence and self-review entries).
- Main `openwiki/horror-authoring.md` as current documentation context, including live-map/array identity clarification.
- `gate-comparison.json`, `base-new-failures.json`, `current-new-failures.json`, and main `.omo/gates-vitest-report.json`.
- `green-encounter-compatibility.log`, `green-shell-surface.log`, `gates-final.log`, `build-identity-final.log`.
- `pursuit/report.json`, `pursuit/actions.jsonl`, `pursuit/pursuit-states.json`, `pursuit/pursuit-trace.zip`; existence checked for every screenshot named in the report.
- `trainer/report.json`, `trainer/actions.jsonl`, and each of `behind`, `wall`, `front`, `two-trainers`, `manual-first`, `blocked-approach`, `parallel-battle` `*-states.json` and `*-trace.zip`; front trace source provenance directly inspected. Every report-referenced screenshot exists; `front-actual-battle.png` image read was attempted but omitted by the channel.
- `editor/report.json`, `editor/actions.jsonl`, `editor/editor-1024-states.json`, `editor/editor-1440-states.json`, both editor trace ZIPs and their DOM/action records; source provenance directly inspected for 1024. Every report-referenced screenshot exists; `editor-1024-reopened.png` image read was attempted but omitted by the channel.
- The skill documents listed in the direct-pass section.

## Gate conclusion

**REJECT for B1 and B2.** The primary behavior and evidence are substantial, and unrelated baseline failures are not being used to expand scope. Fix the two reproduced C4 boundary defects and demonstrate their affected flows without weakening the existing assertions. This review made no source, test-file, DB, commit, push, or publication changes; this report is its only authored file.
