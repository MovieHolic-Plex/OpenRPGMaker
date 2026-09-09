# First-place draft fork contract

Task: st_01a08368. Tests-only correction; product sources and the staged integration are unchanged.

## Reproduced RED

`red.log`: the exact original `test/spatialPlaceActions.test.ts` ran before any correction: 14 passed, 1 failed, exit 1. The failure was line 483, `expect(named?.name).toBe("호숫가")`, receiving `undefined`.

The source trace is:

1. `spatialPlaceCommands.ts:addBlankPlace` uses `editAuthoringDraft` to insert the unsaved place and select its generated identity.
2. The inspector's name `change` event invokes `mutateWorkingPlace`, then `editAuthoringDraft`, then `editPlace`/`patchPlaceDesign`.
3. `spatialAuthoringAccess.ts:110` now calls `controller.createDraft(current.draft ?? undefined)` for each pending edit generation.
4. The original test double at `spatialPlaceActions.test.ts:135-136` ignored `from` and cloned the empty live store. The selected unsaved design therefore vanished before the rename, and `patchPlaceDesign` returned the project because that ID was absent.
5. The actual controller at `actions.ts:46-59` checks handle ownership/baseline and clones `from?.project ?? store.getCurrent()`. No product change was needed.

## Correction and real-controller evidence

Only two lines changed in the original file: the mock accepts `from` and uses the same clone source selection as the actual controller. All 15 original tests and every original assertion remain unchanged. Existing handle checks remain unchanged; this mock is not claimed to reproduce all controller lineage/staleness guards.

`test/spatialPlaceForkContract.test.ts` is an additional 71-pure-LOC happy-dom test. It binds the actual controller using the existing fixture installer, drives the actual inspector change event and public place chrome actions, and checks:

- A canonical project with an empty live place library but retained independent frozen occurrences.
- Add creates exactly one empty design with selected identity.
- Rename survives the draft fork, while the live project remains unchanged.
- Preview succeeds without publishing or creating history.
- Apply publishes the named design, preserves frozen occurrences, and round-trips canonical serialization.
- Exactly one history entry; one UI undo restores the original project and exhausts undo, and one UI redo restores the accepted project and exhausts redo.

`real-controller-before-mock-fix.log`: this case passed against unchanged product code while the original mock was still broken: 1 passed, exit 0. This is an integration scenario through the DOM/controller/history surface, not browser/full-app coverage.

## GREEN command

All Vitest executions held `/home/main/z-project/rpg-zzu/.omo/ulw-execute/tile-to-world/validation.lock`. The existing config and timeouts were unchanged (test 15000 ms; hook 90000 ms). Commands used explicit positional filenames, one worker, and no file parallelism.

```sh
flock /home/main/z-project/rpg-zzu/.omo/ulw-execute/tile-to-world/validation.lock \
  node scripts/run-vitest.mjs run \
  test/spatialPlaceActions.test.ts test/spatialPlaceForkContract.test.ts \
  --configLoader bundle --maxWorkers=1 --no-file-parallelism \
  --reporter=verbose --reporter=json \
  --outputFile.json=output/evidence/tile-to-world/combined-authoring/place-fork-contract/green.json
```

`green.log` and `green.json`: 2 files passed, 16 tests passed, exit 0 in a single combined run. RED used the original filename alone with the same worker/config options; the actual-controller pre-fix run used its filename alone.

## Diagnostics and review

LSP: new case clean; original file has five diagnostics outside the changed lines. A scoped TypeScript compiler check of the captured original file, corrected file, and new case independently confirmed the original and corrected file have identical five diagnostics (exit 1, not suppressed). See `scoped-types.log`: TS2345 at line 174 for the existing unhandled `edit-connection` variant; TS2339 at lines 353, 354, 360, 367 for existing `lastRequest` narrowing. The new case has zero diagnostics. The temporary baseline file matched the RED SHA-256 and was removed. The hidden temporary file's LSP response was empty, so it was not used as baseline proof; the compiler output is authoritative.

Architectural review:

- Responsibility: original place-action regression suite; new first-place acceptance scenario. Original file remains 456 pure LOC, unchanged in size; no unrelated split was made under the explicit narrow correction scope.
- Boundary purity: canonical serialization/deserialization parses the scenario fixture and accepted result. Frozen occurrences are retained, not deleted to make validation pass.
- Variants and escape hatches: no new tagged discrimination, casts, non-null assertions, suppressions, or skipped/weakened assertions. Existing unrelated diagnostics are recorded rather than hidden.
- Defensive layers and helpers: only genuine fixture/DOM presence checks; existing setup helpers reused; local render/action callbacks serve repeated UI invocations.
- Tests: the unchanged original assertion fails before and passes after the two-line mock correction; actual-controller evidence passed independently before the correction.
- Parameters, naming, logging: no new function exceeds three parameters; no negative names or logging/error-boundary changes.
- Cleanup/verification: no sleeps, polling, or timing-dependent assertions. Existing fixture hooks restore the store/editor state, controller/session binding, history, and timers; the added hook clears place chrome. The DOM host is detached. No process/server/container was started beyond finite validators; lock descriptors close with each command. No redundant production verification was introduced.

## Integrity and scope

`red-source-sha256.txt` and `green-source-sha256.txt` capture the test and traced source hashes. The product/fixture/config hashes are identical across RED and GREEN. `index-before.sha256` and `index-after.sha256` are equal, proving the staged integration diff was preserved. `git diff --check` for the touched tests exited 0.

No product edits, stage/commit/reset/merge/push, ledger edits, timeout changes, build, browser, database, provider, or app-wide typecheck were performed. The only temporary source was the baseline diagnostic copy, removed after the scoped check. Evidence files remain intentionally in this directory.
