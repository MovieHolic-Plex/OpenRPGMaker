# Phase 2 final gate review

## Bottom line: REJECT

Phase 2 is not approved for its stacked PR at this snapshot. The recovery foundation and its corrected tests are substantially verified, but two concrete consumer-integration defects remain: expected reconciliation failures escape the current player save/load callbacks, and tracked QA save consumers still read/write or clear only the legacy key family. The red whole-project baseline is not the reason for this rejection.

Mandatory blockers: **2**. Recommendation: **Short** correction, confined to the existing error surfaces and remaining save-key consumers; no recovery redesign, baseline cleanup, new clock wiring, housing implementation, or later-phase UI is required.

## Identity, authority, and scope

- Reviewer task: `st_01a0757d`; parent/root `01a0727b-398a-7481-b557-b198013542c1`.
- Date: 2026-09-06.
- Reviewed worktree only: `/home/main/z-project/rpg-zzu-life-full-p2-review-b7f68fe2`.
- HEAD: `b7f68fe23e1e1670e0d1d4bbc329708a69256f16`.
- Tree: `28354fe57c7928181ccad11ef40a0186e05757da`.
- Phase base: `87de73785d1c309bbbe975636414f70bbc73a4b9`.
- Worktree remained detached and locked with `review:life-full-phase2`.
- Scope: tasks 2..5 and corrections 26/30/38. This is not whole-project approval, final F1..F4 approval, or permission to merge remotely.
- Read `PHASE2.md` first, then the review input, complete `EXECUTED_PLAN.md`, AGENTS, quickstart, project map, and focused runtime/schema/testing wiki sections. All CLAUDE.md files were excluded.
- Compared the complete product/test/script diff from the actual phase base and inspected relevant save, checkpoint, inventory, maker, day, player-shell, QA, and audio callers. No second reviewer was added.

The confirmed task2/3/4/5/task30 commits (`f1024a22`, `f7285316`, `b7b02d97`, `f8647454`, `6ac1eedb`) and both task30 original commits are actual ancestors. Their confirmations apply to their stated task scopes; they do not establish that every later integrated consumer is correct. Product and scripts are unchanged from the built integration `66f2cdb7`; task38 subsequently changes the hostile P1 test, and final evidence packaging updates the generated index. Current source/test execution below uses the locked final snapshot, not a moving producer tree.

## B1 - expected reconciliation refusal is not handled by the player callers

**Priority:** P2, mandatory scoped integration correction.

**Locations:**

- `src/player/playerStatusMenuController.ts:317-339`, especially line 334.
- `src/player/player.ts:480-520`, especially lines 491 and 513.
- New failure authority: `src/player/saveSlots.ts:284`, `478-654`, `1108-1116`, and `src/project/lifeStateReconciliation.ts:107-176`.

The new writer/apply contract intentionally throws `LifeReconciliationError` when a whole-draft conversion cannot fit. That is correct at the codec boundary. The manual menu still constructs the snapshot outside the storage writer's error boundary; both manual and automatic load callbacks call apply without handling the new expected exception. Consequently none of their existing failure UI paths runs.

### Exact counterexample and executed evidence

Use a real current writer snapshot for a valid Project4 with known item `raw`. Its stored session has:

```js
shippingQueue: { raw: 3 },
lifeRecovery: {
  nextSequence: 4097,
  claims: Object.fromEntries(Array.from({ length: 4096 }, (_, i) => {
    const id = `recovery:${i + 1}`;
    return [id, {
      id, sourceKind: "shippingQueue", sourceId: "raw", reason: "removed",
      items: [{ itemId: "raw", count: 1 }]
    }];
  }))
}
```

Then disable shipping in the current project. This represents a supported stored owner plus a content change, not an invalid claim count: `isLifeRecoveryState` accepts the 4096 existing claims. Both real disk readers report `present`; `snapshotLoadBlocker` returns `null`; apply correctly refuses the additional claim with `LifeReconciliationError("shippingQueue", "raw", "capacity")`.

An independent Vite/Storage probe established that boundary. A second probe AST-extracted and executed the **exact current** `loadSlot`, `loadAutosave`, and manual-menu `saveSlot` callback bodies with the real imported writer, reader, apply, and reconciliation modules. Only surrounding UI/scene endpoints recorded invocations; no codec, recovery result, or failure was substituted. The save case used a confirmed non-null prior slot, an already-confirmed overwrite selection, and whole-session equality.

Actual observations:

```json
{"caller":"loadSlot","parsedKind":"present","precheck":null,"error":{"name":"LifeReconciliationError","sourceKind":"shippingQueue","sourceId":"raw","reason":"capacity"},"renderedFailureCalls":0,"sourceAndLiveUnchanged":true}
{"caller":"loadAutosave","parsedKind":"present","precheck":null,"error":{"name":"LifeReconciliationError","sourceKind":"shippingQueue","sourceId":"raw","reason":"capacity"},"renderedFailureCalls":0,"sourceAndLiveUnchanged":true}
{"caller":"manual saveSlot","error":{"name":"LifeReconciliationError","sourceKind":"shippingQueue","sourceId":"raw","reason":"capacity"},"rejectedInputCalls":0,"renderedFailureCalls":0,"diskAndLiveUnchanged":true}
```

The caller probe exited **1**, retaining the three failed handling assertions and final assertion:

```text
AssertionError [ERR_ASSERTION]: Three current player callbacks leave expected reconciliation failures uncaught
3 !== 0
```

This does **not** allege data loss in the codec: prior disk and live state remained intact, and no restored session was applied. It identifies a missing current caller/error-surface integration. The approved save contract requires an unsuccessful save to be reported, and the existing load callback contract already promises failure guidance. An uncaught event-handler exception is not that guidance. This is separate from task16's future recovery ledger or richer day-error navigation.

**Smallest correction:** handle `LifeReconciliationError` at these three player boundaries, using the existing `rejectInput`/`renderLoad` failure surfaces. Preserve old disk/live state, never fall back to an older key after failure, do not close or replace the running session, and rethrow unrelated programming/construction exceptions. Keep the codec's typed refusal and all existing ownership assertions. Add deterministic real-shell/Storage regression coverage for a structurally valid slot whose content-dependent reconciliation fails, plus manual snapshot-construction refusal.

Native player confirmation of these new failure cases was **not reached** in this review's supplementary browser run because an earlier QA-on navigation failed during module loading. B1 rests on inspected production wiring and executed exact-callback/real-codec assertions, not a claimed native-player failure observation.

## B2 - remaining tracked current-save consumers were missed

**Priority:** P2, mandatory completion of the Save5 consumer migration.

**Locations:**

| Tracked script | Remaining incorrect boundary |
| --- | --- |
| `scripts/playtest-driver4.cjs:13,57-64` | Clears old slots; observes and rewrites `oprn:save-slot:1` after a current save |
| `scripts/playtest-driver6.cjs:15,56-60` | Same current-save observation/mutation mismatch |
| `scripts/playtest-driver3.cjs:13` | Fresh-run initializer clears only old manual keys |
| `scripts/playtest-driver5.cjs:13` | Fresh-run initializer clears only old manual keys |
| `scripts/capture-fullscreen-scale.cjs:16` | Fresh-run initializer clears only old manual keys |

These are tracked scripts, not untracked workstation debris or intentional old-reader fixtures. The first two explicitly request a fresh in-game save and then inspect/mutate its JSON to load another position. After this phase, their observer reports failure when the real writer succeeds; if old bytes coexist, they mutate a different owner from the current reader's preferred slot. All five initializers leave current manual saves behind.

The independent probe AST-extracted the actual callbacks and cleanup loops and ran them against actual writer output in Happy DOM Storage. It did not run or claim their full historical editor-play journeys. All five cleanup loops left a non-null current slot. A separate frozen-base/current comparison of each exact observer established the introduced change:

```json
{"file":"scripts/playtest-driver4.cjs","exactObserver":"() => !!localStorage.getItem(\"oprn:save-slot:1\")","frozenPhaseBaseWriter":true,"currentWriter":false,"introducedKeyRegression":true}
{"file":"scripts/playtest-driver6.cjs","exactObserver":"() => !!localStorage.getItem(\"oprn:save-slot:1\")","frozenPhaseBaseWriter":true,"currentWriter":false,"introducedKeyRegression":true}
```

Both defect-reproduction programs exited **0 because their assertions proved the defects**, not because these consumers passed the desired contract. Task26's three repaired scripts and its 15 tests work; their success does not cover these remaining callers. The missing behavior is the same key-observation/cleanup defect that previously blocked task2, not a request to modernize every old playthrough.

**Smallest correction:** migrate current-save reads and writes in drivers4/6 to the current key and parse the actual current save; make the five fresh-run initializers clear both owned manual key families without clearing other namespaces. If touching save completion waits, prearm the existing exact-key success observation rather than preserving a timing-dependent post-save wait. Extend the extracted-consumer regression to these callbacks. Do not rewrite their adventures, use them as proof of earned gameplay, or alter intentional legacy migration/corrupt-slot fixtures.

## Verified foundation and representative/edge behavior

No additional concrete scoped blocker was found in the inspected ownership primitives. The following are positively supported, with execution scope distinguished from archived supervisor evidence:

| Contract / representative case | Evidence and judgment |
| --- | --- |
| Project4 / Save5 and manual/autosave separation | Fresh version tests and independent actual old/current module + Storage probe pass. Old bytes, including formatting, remain unchanged; absent-only legacy lookup and corrupt-new refusal hold. Memory-only checkpoints inherit Save5 without invented disk keys. |
| Representative: incomplete contribution5 -> progress2 + claim3 | Fresh tests and independent writer/read/apply/repeated-save probe pass for ordinary and all three reserved IDs. Explicit collection pays3 once, leaves progress2, and does not rewind sequence. |
| Representative: frozen maker promise/cancellation | Fresh recovery/persistence tests pass original outputs after definition edits, original-clock before/at-deadline input/output selection, legacy normal completion, and unproven legacy cancellation with no guessed input refund. General clock wiring is not credited. |
| Representative: real field observation | Inspected real dispatch -> mirror -> scene-host receipt wiring and fresh seven-case suite pass acceptance, rejection, detached owners, scene-local sequence, and absence of saved counters. Archived dedicated-player supervisor receipts provide actual keyboard acceptance/rejection and QA-on evidence. |
| Edge: claim/item/sequence/raw-byte bounds | Fresh tests cover 4096/4097 claims, 64/65 distinct items, capped splits, safe sequence exhaustion, exact UTF-8 and total-byte limits, duplicate JSON keys, and whole-draft rollback. B1 is the missing consumer handling of the otherwise correct refusal. |
| Edge: removed/unknown originals and explicit-only payout | Fresh tests preserve opaque source records, reject unknown/empty-item collection without mutation, require explicit collection after definition return, and preserve originals through repeated persistence. No save/render payout. |
| Edge: completed and dormant rights | Tombstones and absent-definition unlock IDs survive; completed bundles are not refunded. Existing recovery/persistence tests and inspected supervisor public receipts cover reward non-reissue. |
| Edge: occupancy and non-resurrection | Fresh tests cover mixed malformed plots, persistent plots before spatial checks, opaque placeables, removed species, animal501 quarantine, spatial receipt retention, and hostile P1 non-resurrection. Explicit-empty and omitted-legacy distinctions are covered by retained independent task4 receipts and current source. |
| Edge: quota or later day failure | Fresh tests and independent later-energy-failure probe preserve the whole day draft. Successful in-memory receipt is not rolled back by later quota failure; prior disk remains unchanged. |
| Reserved IDs and finite FIFO | Fresh37 tests plus independent four-ID project roundtrip/persistence/payout probes preserve inventory1+claim3=4 and charge2; repeated saves retain that cursor, tail removal retains the charged oldest copy, and successful use5 depletes. |
| Audio QA capability | Fresh engine/shell/control tests pass omitted/false/true construction, public playback controls, ownership-safe revocation, and shell replacement. This review's native omitted/false runs also observed real BGM playing and cleanup; true is supported by archived supervisor native evidence, not the failed new navigation. |

The 183477-line `5/project.json` was **not claimed read line by line**. It was parsed in a kernel, hash-checked, consumed through actual `deserialize`, and started through actual `startSession`: 4387870 bytes, one map, Project4, expected energy1; SHA256 `f995e7c27d284593e5fb0101954872405b9eb7b68ffd5f5fd8e55b8181b4bbfc`. The frozen 1164-line old reader is byte-equal to `git show 87de7378:src/player/saveSlots.ts`, SHA256 `cad009384fac8632f23c9538ad0863acc4d806872e97223eb25a905a00c76703`, and its actual reader rejected current writer bytes.

## Task38 test alignment is justified, not baseline absorption

Inspected all three test-only commits `44d83f03`, `924bb8ab`, and `34c279bb`, their final diff, and the preserved RED/AFTER summary. The obsolete test passed by replacing refused animals with zero-state authored starts; that contradicts the approved preservation/non-resurrection policy.

The final test now uses real `saveSlotKey(2)`, asserts prior bytes are non-null, executes the combined failed save action, checks the exact typed exception fields, compares the complete live input, retains the exact JSON-safe original as one unpayable claim, invokes the actual unresolved collector, and compares both genuinely recreated save/read/apply cycles to the **initial** recovery/inventory/gold state. The separate invalid-weather/valid-animal writer control and existing valid/legacy controls remain. The initial wrong-key/null comparison and insufficient resave assertions are explicitly recorded and corrected. These commits do not change product/config/wiki, delete cases, skip tests, or weaken the approved policy. All nine P1 cases passed in this review's single focused run.

## Verification and authenticity

Heavy commands were serial under `flock --timeout 900 /tmp/rpg-zzu-life-full-qa-01a0727b.lock`, with fixed outer deadlines: diagnostics/tests300s, module/caller probes180s, key-comparison120s, browser600s, wiki120s. No sleeps/polling or retry-to-green was added. No full 13k suite was rerun.

### Fresh execution on the locked snapshot

- Compiler API diagnostics, before any build consideration: all **50 changed TypeScript files**, zero syntactic/semantic diagnostics. All four changed CJS/MJS scripts passed `node --check`. This is a fresh compiler-API result, not a claimed LSP-tool result.
- One execution of every changed unit-test file: **22 files / 284 tests passed, exit0**, duration86.15s. Exact command:

```sh
npm test -- test/audioEnginePlaybackControls.test.ts test/audioQaInstrumentation.test.ts test/autosave.test.ts test/debugSession.test.ts test/lifeQaObservability.test.ts test/lifeRecovery.test.ts test/lifeRecoveryPersistence.test.ts test/lifeRecoveryRecordKeys.test.ts test/lifeSaveConsumers.test.ts test/lifeSaveVersion.test.ts test/p0DayTransitionSceneFailure.test.ts test/p0RuntimeIntegration.test.ts test/p0SessionPersistence.test.ts test/p1DayTransitionIntegration.test.ts test/p1FoundationSchema.test.ts test/p2DayTransition.test.ts test/p2SpatialPersistence.test.ts test/playBootRecovery.test.ts test/playerAudioQaLifecycle.test.ts test/playerKeydownSessionGuard.test.ts test/playerOpenSaveMenu.test.ts test/playerRunControls.test.ts --maxWorkers=2 --minWorkers=1 --no-cache
```

- Independent public module/Storage/fixture/conservation/remaining-consumer probe: exit0; assertions and observations described above.
- Exact player-callback error-handling probe: **exit1, three failed expectations**, B1 above. The callbacks were extracted, not reimplemented.
- Frozen-base/current exact QA callback comparison: exit0 proving B2's true -> false observation regression.
- `npm run openwiki:index -- --check`, `npm run openwiki:verify`, and `git diff --check 87de7378..HEAD`: exit0.
- No fresh build or whole gates is claimed. Inspected the actual integrated `phase2-integration/build.json` and typecheck/gate receipts; build/app compiler exit0 applies to identical product/scripts. Existing circular-chunk, mixed-import, unresolved-runtime-asset, optional proxy-key, and large-chunk warnings are not suppressed or called fixed.

### Supplementary native browser result: explicitly partial and failed

Ran an output-isolated copy of the inspected supervisor proof against this tree's actual `player.html` / export-store shim. Preserved its assertions and 120000ms DOM / 10000ms action deadlines; added intended load-failure checks after the three original capability cases. Program SHA256: `9c37e7f32b53364d87ff342d7e8f9df0728d34b7e1ce38c6d0e3d337f508d54c`.

- Surface: `http://127.0.0.1:42979/player.html`, viewport1280x960.
- Omitted and false boots reached real scenes/menus, exposed no QA globals/mirrors/markers, emitted native BGM `playing` with pausedfalse/readyState4, and removed both audio globals/media on teardown. The false run retained a post-teardown BGM `ERR_ABORTED`.
- True navigation suffered **32 `ERR_NETWORK_CHANGED` request failures** before title readiness. Actual exit1:

```text
AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
+ actual - expected

+ 'DOM signal missing: [data-testid="title-screen"]'
- undefined
```

QA-on input assertions and the newly appended load-failure cases did not execute. This is neither a three-mode pass nor a demonstrated QA-on product defect. No rerun, network workaround, timeout escalation, or inferred precise host/network cause was used. Archived Q1 supervisor proofs remain the direct successful QA-on/native-action evidence. The separate archived editor follow-up likewise remains3pass/1loading abort, with Escape unexecuted, not green. No visual-quality or physical-audibility claim is made.

### Whole-gate comparison is credible but remains red

Independently parsed archived full reports and command receipts, not mutable latest filenames:

| Actual tree | Total | Passed | Failed | Pending | Exit |
| --- | ---: | ---: | ---: | ---: | ---: |
| Base87de7378 | 13487 | 13307 | 165 | 15 | 1 |
| Final tested34c279bb | 13669 | 13488 | 166 | 15 | 1 |

All165 shared failed assertions have matching headlines after root substitution. **160 full messages** match after that substitution alone. Inspected the remaining five complete diffs: two shifted source stack lines, one source-line-only brand scan shift, one internal runner stack-tail difference, and one timestamp inside the same local `/__oprn/edit-activity` request. The separate three-file store reports have the same nine failures, with only that local timestamp differing in one payload; this is not evidence of a new Supabase write.

The sole final-only failure is the documented dashboard `empty project renders empty states without NaN paths`: previously failed at4e2d1762, passed at66f2cdb7, and failed at34c279bb with identical production code. Its exact historical stall cause remains unproven. The earlier task28 timing attributions are not silently upgraded to causal proof.

All nine surface axes ran, with six failures across five axes matching the phase base's values. CSS passed. Read task28's recorded live validation before temporary-tree teardown; did not try to run its historical path-bound validator against removed trees.

These documented pre-existing/nondeterministic limits would permit a **scoped** phase handoff absent concrete phase defects; they do not require unrelated baseline cleanup. They cannot waive B1/B2, which are independently demonstrated and not covered by the passing changed-file suite.

The final full-report byte manifest matches SHA256 `171352124d85b283ca04a9544e48826bf2f1f80c7272b1cb02089a3d524d34ef` and4979081 bytes. Decoded and hash-validated all six whitespace-bearing raw archive entries (485/269/472/272/4593/1054 lines); no producer failure text or receipt was edited. The two unrelated private listener inventories were not treated as missing product evidence.

## Security, preservation, and cleanup

- No new remote-write path appears in the scoped product diff. No remote save/PR/push/merge request was made by this reviewer.
- Scanned all572 changed files for the three configured secret literal values, including the six decoded base64 payloads and ZIP contents: zero hits. This is a bounded literal scan, not a claim of universal secret detection.
- Verified WISH, dependencies, gate baselines, editor/product-authoring/default/io/style paths, and tracked cache files unchanged against the phase base. Task38 does not hide failures through configuration or baseline changes.
- Both tracked `.vite-cache/deps` files remain byte-identical: `_metadata.json` SHA256 `eb92c7299e3ca1a241fff3664422f1a7821a242b763935b799631990183f8edc`; `package.json` SHA256 `3ca9d4afd21425087cf31893b8f9f63c81b0b8408db5e343ca76e5f8aa26ab9a`.
- Every review SSR window/server was awaited closed; its unique temporary cache was removed. Browser/context/server cleanup ran even on the failed native probe; a single post-close connection to assigned port42979 returned ECONNREFUSED111. All `st_01a0757d-*` temporary directories were removed, including temporary screenshots/results. No producer receipt was overwritten.
- Final executable-based `/proc` check found no review-root Node/Chromium runtime. An initial textual process scan matched its own bash command and failed its bookkeeping assertion; correcting the filter to actual executables found no runtime leak. No process was killed to conceal it.
- HEAD/tree, worktree lock, tracked working tree, and index were unchanged before report creation. This file is the sole deliberate deliverable, written through `apply_patch` backed by `git apply` without staging. Parent owns worktree teardown.

## Action plan for the parent

1. Correct B1 in the existing manual-save and manual/auto-load callers; keep typed codec refusal and add the missing caller regressions.
2. Complete B2's narrow current-key read/write/cleanup migration and extend the actual extracted-consumer tests. Preserve intentional legacy fixtures and unrelated namespaces.
3. Reverify those bounded changes and present the corrected stacked Phase 2 candidate for approval before opening its PR. Do not remote-merge, claim full51 completion, or bring task9/task11/task16 implementations into these corrections.

**Final gate judgment: REJECT, two mandatory scoped blockers, at b7f68fe23e1e1670e0d1d4bbc329708a69256f16.**
