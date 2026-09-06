# NPC behavior gate review - first delta re-review

- recommendation: **APPROVE**
- blockers: **[]**
- goalId: `npc-behavior`
- reviewer task: `st_01a076b8`, sole replacement for completed reviewer `st_01a0766c`
- date: 2026-09-06
- scope: B1/B2 corrections and concrete regressions from that delta; code readiness, not publication completion
- reviewRoot: `/home/main/.herdr/worktrees/rpg-zzu/worktree-clear-stone-e8b2-npc-behavior-review-r2`
- reviewed HEAD: `b27258ba27dbdf2509902051f539cfc988d31b00`
- prior snapshot: `d5efc923f87ba661111dd7e39f829c2b2b24bb30`
- mainRoot: `/home/main/.herdr/worktrees/rpg-zzu/worktree-clear-stone-e8b2`
- evidenceRoot: `/home/main/.herdr/worktrees/rpg-zzu/worktree-clear-stone-e8b2/output/evidence/npc-behavior`
- prior report: `mainRoot/.omo/evidence/npc-behavior/REVIEW-1.md` (read first; remains preserved)
- placement: `omo-agent-toolkit ulw-loop status --json` returned `ULW_LOOP_PLAN_MISSING` for this child session. This is the required fallback `mainRoot/.omo/evidence/npc-behavior-gate-review.md`; no plan was created.

## originalIntent

Complete audited cross-map pursuit and Pokemon-style sight -> input lock -> actual NPC approach -> actual battle, with honest authoring/persistence, browser evidence, and adversarial approval before commits/PR. No merge, deployment, or remote game-content changes. Existing projects and normal interpreter/ownership behavior must remain compatible.

## desiredOutcome

Legacy parallel battles must actually start and await their result, not disappear at admission or run through inactive conditions. An admitted trainer list may finish across its own authored page/transfer changes, but cannot continue stale commands or award completion after an unrelated replacement map, including a new object with the same ID. Ownership cleanup must not unlock a replacement owner.

## userOutcomeReview

**B1 APPROVE; B2 APPROVE. No criterion-linked delta regression found.** The revised admission logic reaches the shared battle path for a properly authored legacy root trigger, honors root conditions, and rejects inactive paged events. Map ownership now tracks object identity; authored-transfer permission is scoped to the transfer command and cleared in finally. External map reset cancels the old detector and hides its captured dialogue only while that lease remains the owner. Positive self-switch, different-map transfer, and same-map transfer continuation still pass.

This verdict is supported by fresh execution against the locked R2 modules, not executor counts alone. The stored browser traces also contain the exact five changed production source modules and substantive real-player evidence for the four added scenarios. Previously accepted C1/C3 and unrelated baseline debt were not reopened. Publication and temporary-tree cleanup remain explicitly outside this gate.

## Criterion-linked disposition

| Prior blocker / criterion | Verdict | Concrete evidence |
| --- | --- | --- |
| B1 / C4, legacy compatibility aspect of C3 | **APPROVE** | `src/player/scheduledBattle.ts:24-36` normalizes missing page IDs to `legacy`, retains process/session/trigger checks, checks actual map identity, evaluates pageless root conditions, and rejects inactive nonempty page lists. `playSceneMapRuntime.ts:557-567` applies the corresponding active-event admission rule. Fresh permanent test execution: false root condition yields no battle; true yields one battle; continuation waits; victory resumes and clears the switch; no repeat. |
| B1 admission boundaries / C4 | **APPROVE** | Fresh inactive-paged test proves no root side effect or battle. Three additional in-memory probes directly invoke pending validation after a queued legacy battle loses its root condition, becomes an inactive paged event, or acquires a same-ID replacement map. All reject admission and remove the old process. |
| B2 / C2 and C4 | **APPROVE** | `foregroundControl.ts:18-35` owns the actual map and limits temporary transfer permission to the explicit target. `npcDetectionEncounter.ts:49-65,120-124` cancels an unrelated reset; `playSceneInterpreter.ts:200-214,383-391` uses owner currentness and expires transfer permission in finally. Fresh permanent tests pass for same-ID and different-ID external replacement after deferred dialogue, without stale flag or completion. |
| B2 positive continuation / C4 | **APPROVE** | Fresh permanent tests retain original-page completion after self-switch, own different-map transfer, and own same-map transfer. They retain the actual transfer/landing/reset modules and adapt rendering/load setup. The different-map browser case separately uses actual `loadMap` and shipping player runtime. |
| Late ownership/result regressions / C2 and C4 | **APPROVE** | Existing replacement session/process/page and battle-lifecycle tests pass. An additional started-battle probe replaces the map with a new object of the same ID, awaits the complete scheduled lease-release chain, and confirms no result/continuation write or input restoration. A direct real-lease probe confirms only the destination is temporarily permitted, a same-ID replacement is rejected after finish, and stale finish/release cannot replace or unlock a newer owner. |

All source paths in the table are relative to reviewRoot. No remaining blocker exists, so there is no unresolved violatedCriterion/evidencePointer entry.

## Fresh executable verification

### Permanent regressions: 34 passed, 4 files, zero excluded

Executed a new Node/Vitest process rooted explicitly at reviewRoot. No imports came from the removed old review directory. Renderer/UI adapters remain the existing fixture boundaries; scheduler, detector, runtime-view selection, interpreter, transfer, reset, and ownership modules are real.

```js
import { startVitest } from 'vitest/node';
import path from 'node:path';
const root = '/home/main/.herdr/worktrees/rpg-zzu/worktree-clear-stone-e8b2-npc-behavior-review-r2';
const files = [
  'test/npcScheduledBattle.test.ts',
  'test/npcEncounterOwnershipBoundaries.test.ts',
  'test/npcEncounterBoundaries.test.ts',
  'test/npcBattleLifecycle.test.ts',
];
const ctx = await startVitest('test', files,
  { root, config: false, watch: false, maxWorkers: 1,
    fileParallelism: false, cache: false },
  { configFile: false, resolve: { alias: { '@': path.join(root, 'src') } },
    test: { environment: 'happy-dom', include: files, testTimeout: 10000 } });
await ctx.close();
```

Executed through `node --input-type=module` from mainRoot. Exit 0; Vitest 3.2.4; start 21:37:21; duration 29.91 seconds. File results: scheduler 11, ownership 12, encounter boundaries 7, battle lifecycle 4. This bounded review deliberately disables repository config and caches, and is not represented as the stock gate command.

Fixture fidelity was read directly: the deleted `activeRuntimeEvents` override is no longer present; the typed `PlayScene` proxy delegates to `PlayScene.activeRuntimeEvents` -> production `playSceneMapRuntime.activeRuntimeEvents`. Legacy tests explicitly set `event.trigger = { kind: 'parallel' }` as well as moving commands and removing pages. The helper's page trigger is not mistaken for the root trigger.

### Additional read-only delta probes: 5 passed

A second fresh Vitest process used the same options, selecting `test/npcScheduledBattle.test.ts`, with `testNamePattern: 'delta probe:'`. A Vite pre-transform appended the following tests in memory only. The existing 11 tests were excluded by this explicit name filter, not deleted or represented as rerun passes; they passed in the preceding full-file run.

```ts
it.each(['condition', 'inactivePage', 'sameIdMap'] as const)(
  'delta probe: queued legacy battle rejects %s before admission', async kind => {
    const f = setup();
    f.event.trigger = { kind: 'parallel' };
    f.event.condition = { kind: 'switch', switchId: 'sw_0001', value: true };
    f.scene.session.switches.sw_0001 = true;
    f.event.commands = f.page.commands;
    delete f.event.pages;
    const held = required(claimForeground(f.scene));
    updateParallelEvents(f.scene, 0);
    expect(f.battle).not.toHaveBeenCalled();
    expect(f.scene.parallelProcesses.size).toBe(1);
    if (kind === 'condition') f.scene.session.switches.sw_0001 = false;
    if (kind === 'inactivePage') {
      f.event.pages = [f.page];
      f.page.conditions = [{ kind: 'switch', switchId: 'never', value: true }];
    }
    if (kind === 'sameIdMap') f.scene.map = structuredClone(f.map);
    held.release(false);
    f.scene.running = false;
    f.scene.setInputEnabled(true);
    const { resumeScheduledBattle } = await import('@/player/scheduledBattle');
    const [key, process] = required([...f.scene.parallelProcesses.entries()][0]);
    const consume = vi.fn();
    resumeScheduledBattle(f.scene, key, process, consume);
    expect(f.battle).not.toHaveBeenCalled();
    expect(consume).not.toHaveBeenCalled();
    expect(f.scene.parallelProcesses.size).toBe(0);
  });
it('delta probe: started battle rejects same-ID new map without applying result', async () => {
  const f = setup();
  updateParallelEvents(f.scene, 0);
  expect(f.battle).toHaveBeenCalledTimes(1);
  const released = nextLeaseRelease(required(foregroundOwner(f.scene)));
  f.scene.map = structuredClone(f.map);
  f.scene.session.battleResult = 'escape';
  f.battleResult.resolve('victory');
  await bounded(released);
  expect(f.scene.session.battleResult).toBe('escape');
  expect(f.scene.session.flags.encounterComplete).not.toBe(true);
  expect(f.scene.running).toBe(true);
  expect(f.scene.inputEnabled).toBe(false);
});
it('delta probe: authored permission expires and cannot rebind a replacement owner', async () => {
  const f = setup();
  const owner = required(claimForeground(f.scene));
  const original = f.scene.map;
  const finish = required(owner.beginAuthoredTransfer('destination'));
  f.scene.map = { ...structuredClone(original), id: 'other' };
  expect(owner.current()).toBe(false);
  f.scene.map = { ...structuredClone(original), id: 'destination' };
  expect(owner.current()).toBe(true);
  finish();
  expect(owner.current()).toBe(true);
  f.scene.map = structuredClone(f.scene.map);
  expect(owner.current()).toBe(false);
  f.scene.running = false;
  f.scene.inputEnabled = true;
  const replacement = required(claimForeground(f.scene));
  finish();
  owner.release();
  expect(foregroundOwner(f.scene)).toBe(replacement);
  expect(replacement.current()).toBe(true);
  expect(f.scene.running).toBe(true);
  expect(f.scene.inputEnabled).toBe(false);
});
```

Transform wiring was `plugins: [{ name: 'readonly-delta-probes', enforce: 'pre', transform(code, id) { if (id === path.join(root, file)) return code + extra; } }]`. Exit 0; start 21:39:40; duration 14.81 seconds; 5 passed / 11 explicitly filtered. No fixed sleeps, success polling, test-file writes, or assertion weakening.

## Browser artifact audit and manual QA matrix

Parsed all three actual report JSON files and action JSONL files. Each report's actions exactly equals its JSONL sequence. All report-referenced PNGs exist; all 14 case trace ZIPs exist and are nonempty. All reported case errors, browser errors, blocked requests, and invariant failures are empty. Inspected the actual runner, fixture delta, battle controls, event subscriptions, route transport, cleanup, and scenario assertions rather than inferring approval from those counts.

| Surface / adversarial case | Observed artifact evidence |
| --- | --- |
| Legacy parallel battle | `trainer/legacy-parallel-battle-states.json`: 11 state changes; starts with commands 0 and no battle, reaches actorCommand -> targetSelect -> resolved/result victory, ends commands 1, victory true, battleResult victory, input enabled, running false. No pageId on the legacy runtime view. Actual action/Enter path and attack/target/result confirmation appear in actions and runner. |
| Inactive paged parallel | `trainer/inactive-paged-parallel-states.json`: 22 state changes across real up/down movement. Commands remain 0; battle absent; running false. Root commands cannot execute merely because no page is active. |
| External-map cancellation | `trainer/external-map-states.json`: 51 state changes, real trainer approach, then replacement map with commands 0, no completion, input enabled and running false. Trace contains the old dialogue DOM and the lifecycle `__oprnDebug.teleport` call. Runner arms dialogue and replacement-state signals before actions, then performs actual movement and Enter without executing stale continuation. `playSceneTestHooks` delegates different-map replacement to actual `loadMap`; this is lifecycle setup, not purported door-crossing proof. |
| Own authored transfer | `trainer/authored-transfer-states.json`: 63 state changes; finishes on arrival map with commands 1, original trainer/page completion true, running false, input enabled; actual subsequent rightward movement succeeds. |
| Prior trainer flows | Current report retains all seven prior scenarios as passed: behind, wall, front, two trainers, manual-first, blocked approach, paged parallel battle. The direct runtime tests and delta trace source audit complement these execution receipts; this reviewer did not rerun the browser. |
| Pursuit regression | Current `pursuit/pursuit-states.json`: 364 state changes; arrival/search/reacquisition and final visible contact remain present. Final caught state is in reacquisition, with no hiding and the single pursuer adjacent. No C1 blocker reopened. |
| Editor | Existing two-size Apply/reopen report remains passed, with original editor scope unchanged by production delta. C3 visual authoring acceptance is carried forward, not re-certified aesthetically. |

### Browser source provenance

Report metadata still names dirty main HEAD `d4e6164f`; that alone would not establish R2 provenance. Independently read `.network` records from each of the four new trainer trace ZIPs and the final pursuit trace, fetched their stored response bodies by `_sha1`, decoded inline source maps (including their charset parameter), and compared `sourcesContent` to locked R2 files.

**All five delta production modules match exactly in each of those five traces; zero mismatches or missing modules:** `foregroundControl.ts`, `npcDetectionEncounter.ts`, `playSceneInterpreter.ts`, `playSceneMapRuntime.ts`, `scheduledBattle.ts`. An initial narrower source-map regex found no maps; it was corrected rather than treating zero comparisons as provenance success.

The relay forwards owned Vite bytes through Playwright's request context with `maxRetries: 0`; only the project fixture response is supplied. Real engine/interpreter/battle behavior is not stubbed. External/DB/unexpected writes and all failed-request assertions remain enforced. Cleanup receipts contain listener/observer/signal cleanup, trace stop, context/browser/server closure, and exclusive-bind release: trainer 44893, pursuit 46197, editor 43435. These are inspected receipts, not newly launched browser or live-port checks.

## Executor evidence checked, not blindly adopted

- `red-review-blockers.log`: three expected failures, legacy start plus external-map same/different ID stale writes.
- `red-legacy-condition.log`: false root condition incorrectly started a battle before that correction.
- `red-inactive-page.log`: inactive page incorrectly executed a root command before that correction.
- `green-rereview-final.log`: inspected complete 172-pass / 13-file output, including 117 NPC tests and existing interpreter/movement/map identity regressions. This is stored executor output; this reviewer freshly ran the 34+5 checks documented above.
- `build-rereview-final.log`: inspected full app typecheck/build -> export player SDK -> standalone completion. Artifact `f7904f3e9149564c`, source prefix `deb89fda24daa4da`; warnings remain visible. No build rerun by this reviewer.
- Byte-compared all 12 delta files between mainRoot and reviewRoot: no mismatch. Confirmed locked HEAD and clean review-tree status before and after execution; `git diff --check d5efc923` is clean.
- Read main `ACCEPTANCE.md` and the full notepad. Acceptance text is stale at 112 tests/seven trainer cases/review pending, and the notepad ends in candidate preparation. Neither was treated as the authoritative current result; named final logs/reports/traces above are the current evidence.

## Direct remove-ai-slops and programming review

Loaded and consulted `/home/main/.claude/skills/remove-ai-slops/SKILL.md`, its `references/slop-categories.md`, `/home/main/.claude/skills/programming/SKILL.md`, `references/philosophy.md`, and `references/typescript/README.md`. Applied their review criteria directly over the full 12-file delta, changed production modules and tests, fixture delegation, and QA runner. This is a review, not authorization to refactor baseline modules.

| Criterion coverage | Direct finding |
| --- | --- |
| Excessive/useless tests | Added tests distinguish meaningful legacy condition/page and external same/different identity boundaries; positive same-map transfer protects the permitted behavior. No blocking excess. |
| Deletion-only / tests merely verifying removal | None. Negative tests assert runtime side effects/admission, not absence of a source symbol; fixture override deletion is not pinned by source-text tests. |
| Tautological / prose-pinning tests | None added. Assertions cover battle invocation, awaited continuation, state mutation, completion, and input ownership. Wiki copy has no wording test. |
| Implementation-mirroring tests / false confidence | Removing the duplicated active-event filter improves fidelity. Unit fixture battle UI is intentionally deferred rather than a real DOM battle; trace evidence separately proves the real surface. Permanent external-map tests observe lease release that can occur synchronously at reset, so that signal alone is not proof of the full detector finally chain; currentness tracing, browser stale-input exercise, and separate complete scheduled-finally probes provide the complementary evidence. |
| Async correctness | Signals precede dialogue/battle actions; bounded timeouts reject missing signals. Game-frame stepping is deterministic advancement, not wall-clock sleeping. Transfer permission is ended in finally; session/map/token checks prevent late result application or replacement-owner release. |
| Unnecessary extraction / abstraction | No new module or speculative framework. Existing lease owns a concrete transfer transaction; no redundant parser or normalization layer was introduced. |
| Parsing / normalization | Legacy sentinel normalization aligns the scheduler's existing contract. Runtime conditions are re-evaluated at selection and after an asynchronous queue boundary, where state can change; this is necessary validation, not redundant ingress parsing. |
| Defensive checks / errors / type escapes | No new type suppression, unchecked cast, dependency, silent catch, test skip directive, or error filtering. The nullable lease/finish checks support existing nested/no-owner caller contracts. |
| Duplication / complexity / comments / dead code | Admission predicates have necessary corresponding selection/pending checks; no new helper is justified merely to shorten them. Transfer lifetime and dialogue ownership are localized. No delta dead-code blocker; generated index changes are nonblocking documentation noise. |
| Performance | No speculative cache, extraction, or normalization pass was added. No performance regression established by this delta; no benchmark claim. |
| Size / maintenance burden | Approximate nonblank/non-comment-only counts: foreground 46, detector 167, scheduled battle 55, interpreter 699, map runtime 616, QA runner 705, QA fixture 136, test fixture 166, ownership test 101, scheduler test 129. Existing oversized interpreter/map-runtime/runner modules remain maintenance debt. The narrow requested fixes do not justify unrelated splits in this locked re-review. |
| Scope drift | No schema/editor behavior, package/lockfile, DB content, global baseline/floor, or unrelated source changes in the delta. No criterion-linked scope drift. |

### Prior code-review report perspective coverage

Confirmed `mainRoot/.omo/evidence/npc-behavior/REVIEW-1.md` explicitly records both skills and a direct table covering excessive/useless, deletion-only, tautological, implementation-mirroring, async determinism, extraction, parsing/normalization, suppression, complexity/size, and scope. It also openly states that no separate executor code-review report was supplied. This first review report is the available prior code-review artifact; its perspective coverage is confirmed, not substituted for the direct delta pass above. No separate R2 executor skill-review report was supplied, and none is required to manufacture a second panel for this sole-reviewer task.

## Exact evidence gaps and nonblocking notes

1. No fresh broad suite, build, browser execution, DB access, commit, push, or publication was performed by this reviewer, as instructed. Stored final build/browser outputs were inspected and source provenance reproduced; changed-source LSP clearance remains an executor claim, not a fresh reviewer diagnostic result.
2. The independent final whole-project gate on exact R2 was described as running. Its final outcome was not supplied to this reviewer and is **not approved or represented as green** here. The lead retains its explicit obligation to validate that result before publication. Previously accepted unrelated baseline debt is not reopened by this bounded B1/B2 verdict.
3. The prior stock gate was not green (14,317 pass / 230 fail / 15 pending, per prior reviewed evidence); the accepted bounded comparison was 393/38 baseline versus 505/the same 38 corrected, with 17 full-run-only flags not reproduced. Those historical baseline assertions are carried forward from REVIEW-1, not independently rerun or expanded in this turn.
4. `ACCEPTANCE.md` and notepad prose lag the final delta evidence. Use this verdict and the explicitly named final logs/traces, not their stale pending/count text.
5. Attempting to read `trainer/external-map-before-external-map.png` returned `Current model does not support images`. PNG existence was verified, and trace DOM/behavior was inspected; no independent pixel or aesthetic review is claimed. Previously accepted editor visual scope remains unchanged.
6. Permanent legacy/ownership fixtures adapt UI/rendering; same-map own-transfer coverage is focused integration, not a separate real-browser same-map scenario. The browser independently proves actual different-map load/continuation and real visible-dialogue cancellation. No named success criterion requires every identity permutation to be repeated in the browser.
7. Existing module-size debt, stale evidence prose, build warnings, and absent separate executor skill-review prose are notes, not criterion-linked blockers.

## Checked artifact paths

Relative paths below use the roots defined at the top of this report.

- All 12 delta files: `openwiki/INDEX.md`, `openwiki/horror-authoring.md`, `scripts/qa/npc-behavior-fixture.mjs`, `scripts/qa/npc-behavior.mjs`, `src/player/foregroundControl.ts`, `src/player/npcDetectionEncounter.ts`, `src/player/playSceneInterpreter.ts`, `src/player/playSceneMapRuntime.ts`, `src/player/scheduledBattle.ts`, `test/fixtures/npcEncounterPipeline.ts`, `test/npcEncounterOwnershipBoundaries.test.ts`, `test/npcScheduledBattle.test.ts`.
- Neighboring flow definitions in `src/player/PlayScene.ts`, `playSceneSchedulers.ts`, `playSceneMapCommands.ts`, `playSceneTestHooks.ts`, `dialogue.ts`, and `src/project/runtimeEventState.ts`.
- `mainRoot/.omo/evidence/npc-behavior/REVIEW-1.md`, `mainRoot/.omo/evidence/npc-behavior/ACCEPTANCE.md`, prior fallback report header, and `/tmp/ulw-20260906-161742.wGQ2Nm.md`.
- Under evidenceRoot: `red-review-blockers.log`, `red-legacy-condition.log`, `red-inactive-page.log`, `green-rereview-final.log`, `build-rereview-final.log`.
- All `trainer`, `pursuit`, and `editor` `report.json` and `actions.jsonl`; existence/size of all report screenshots and all case trace ZIPs.
- Detailed histories and trace source payloads: `trainer/{legacy-parallel-battle,inactive-paged-parallel,external-map,authored-transfer}-{states.json,trace.zip}` and `pursuit/pursuit-{states.json,trace.zip}`. External-map trace DOM/action records additionally inspected.
- Skill documents listed in the direct-review section.

## Gate conclusion

**APPROVE the B1/B2 delta at b27258ba27dbdf2509902051f539cfc988d31b00.** Both reproduced prior blockers are resolved, and no concrete criterion-linked regression from their correction was found. This is code-readiness approval, not a claim of green global gates or completed PR/publication. The locked review tree stayed clean. This gate report is the reviewer's only authored artifact; the prior rejection remains preserved at REVIEW-1.md.
