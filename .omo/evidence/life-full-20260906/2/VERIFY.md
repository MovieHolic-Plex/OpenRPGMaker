# Task2 AdversarialVerify - repair re-verification

## Verdict: confirmed

- Status: **confirmed**; acceptance verdict **0**.
- Mandatory fixes / blockers: **0**. Prior B1 is resolved, not waived.
- This artifact supersedes the previous needs-fix verdict at `5c528ca3`.
- Verified HEAD: `f1024a2202ab6205591af630aeb53b0bc3445669`.
- HEAD tree: `20ff00cebb72c149653294bd0320453706783403`.
- Worktree: `/home/main/z-project/rpg-zzu-life-full-p2`.
- Verifier task: `st_01a073c3`; parent/root: `01a0727b-398a-7481-b557-b198013542c1`.
- Verification date: 2026-09-06 (workstation local date).
- Scope: task2 Save5 boundary and bounded B1 consumer repair only. Task3+ are NOT implemented or approved as completed by this verdict. Task2 no longer blocks beginning task3; later dependency gates still apply.

## Provenance and review boundary

Read the full plan Scope and task2/task26 contracts at `/home/main/.herdr/worktrees/rpg-zzu/wish-html/.omo/plans/life-systems-full-implementation.md`, task2 producer SUMMARY, previous VERIFY, repair SUMMARY and actual four-file diff, actual tests, public probes, and parent autosave code. CLAUDE.md was ignored.

- Save5 implementation: `573a418e01c9eb97dda0df033c21e2d5985b0102`.
- Phase1 baseline: `87de73785d1c309bbbe975636414f70bbc73a4b9`; `git merge-base --is-ancestor 87de7378 HEAD` exited 0.
- Integrated B1 repair: `f1024a2202ab6205591af630aeb53b0bc3445669`, immediate parent `5c528ca36fae77bf7d089ba77b6c726b3c9ec257`.
- Isolated repair source: `bf7c089b`. `git diff bf7c089b f1024a22 -- scripts/verify-gate-transfer.cjs scripts/capture-uiux-evidence.cjs scripts/playtest-driver2.cjs test/lifeSaveConsumers.test.ts` is empty: integrated content matches the producer's four approved files exactly.
- `git diff 5c528ca3 HEAD -- src` is empty. Repair changes only three scripts and adds one 129-line test; no product code, existing tests, or legacy fixture was deleted or weakened.
- The prior test-only save completion fixes remain ancestors. Current combined execution includes their seven player-save tests rather than relying on their historical status.

## B1 resolved: actual extracted observation and cleanup

`verify-gate-transfer.cjs:78-97` now subscribes to the existing exact-key signal before slot input, checks `written`, disposes in finally, reads `oprn:save-slot:v5:1`, parses JSON, requires numeric schema 5, and invokes the real public `readSaveSlot` for full session validation. Missing/invalid save now throws instead of merely logging a boolean. The touched post-save 900ms delay was removed; other historical playthrough delays are unchanged and are not accepted as verification evidence.

`verify-gate-transfer.cjs:15-18`, `capture-uiux-evidence.cjs:18-21`, and `playtest-driver2.cjs:78-81` clear both default manual families for slots 1..3. Custom namespaces, autosaves, preferences, and out-of-range slots remain untouched. The driver's touched initializer no longer swallows storage errors.

`test/lifeSaveConsumers.test.ts:14-27,42-50,63-128` AST-extracts the tracked observation callback and each tracked cleanup loop. Fixtures use real `createSaveSnapshot` / `saveToSlot` output; only browser import transport is transpiled for Node, with the actual save module returned. There is no substituted writer/parser/predicate. The 15 tests exercise current-only success, legacy-only and other-namespace rejection, malformed/incomplete/session-invalid payloads, numeric old/future and string versions, original-byte stability, and both-family cleanup with unrelated keys retained.

Fresh public SSR execution independently produced these assertion-backed results:

```json
{"actualSaveKind":"present","actualSaveVersion":5,"scriptReportsSaved":true}
{"file":"verify-gate-transfer.cjs","newSaveSurvivesCleanup":false,"legacyManualRemoved":true,"customNamespaceAndAutosavesPreserved":true}
{"file":"capture-uiux-evidence.cjs","newSaveSurvivesCleanup":false,"legacyManualRemoved":true,"customNamespaceAndAutosavesPreserved":true}
{"file":"playtest-driver2.cjs","newSaveSurvivesCleanup":false,"legacyManualRemoved":true,"customNamespaceAndAutosavesPreserved":true}
```

The real Chromium probe executes the AST-extracted click function and complete arm/action/wait/dispose/observe/fail block against native localStorage and actual Vite browser imports of the writer/parser. Success asserts pre-action subscription, Save5 bytes, hook deletion, and setter restoration. An unrelated write followed by a controlled timeout rejects; a missing button rejects and cancels; both restore the setter and remove the hook. Time is controlled only to exercise timeout itself, not to make a gameplay assertion pass by timing luck.

This minimal browser button invokes the real writer; it does not inject a successful result or replace the codec. Its scope is the repaired consumer integration, NOT a full gate-transfer adventure or earned quest outcome. The player-shell tests retain actual controller/codec integration while substituting Phaser/audio boot; a fixture quest switch is input, not proof of gameplay acquisition. No runtime-injected gameplay outcome is counted as success.

## Retained Save5 core

| Obligation | Current code and evidence |
| --- | --- |
| Project4 / independent Save5 | `src/project/types/base.ts:642` retains `SCHEMA_VERSION = 4 as const`; `saveSlots.ts:110,123,301` defines and uses `SAVE_SCHEMA_VERSION = 5`. Fresh version tests assert writer output, Project.version, independent constant, and unchanged live session even without life packages. |
| New keys, namespaces, old raw bytes | `saveSlots.ts:251-291,431-438,462-475` isolates manual/autosave v5 keys, preserves trimmed namespaces, and writes only current keys. Fresh tests and probe check exact pretty-printed legacy bytes including newline before/after migration and save, in default and custom namespaces. |
| Absent-only fallback; corrupt current never falls back | Manual and auto readers use `getItem(new) ?? getItem(legacy)` and distinguish null from empty string. Fresh cases cover empty, malformed, null, missing fields, future version, separate namespace, and distinct new versus old progress. |
| Read4/5 and reject unsupported versions | `saveSlots.ts:762-775` accepts exactly numeric 4/5 and emits an in-memory Save5 snapshot; tests reject 3, 6, 999, and string 5 without rewriting bytes. |
| Real old parser rejects5 | Complete `test/fixtures/life-full/saveSlots.phase1.ts` was compared byte-for-byte to `git show 87de7378:src/player/saveSlots.ts`, not a recreated predicate. Both git blobs are `d47f58197b24f781635cde0a2152a5bde0c3f689`; SHA256 `cad009384fac8632f23c9538ad0863acc4d806872e97223eb25a905a00c76703`. Fresh test invokes its actual reader on actual writer bytes and gets Unsupported save schema. |
| Quota and live ownership | `lifeSaveVersion.test.ts:119-142` keeps real writer/codec and faults only Storage.setItem. Manual/auto failure retains old bytes, absent or existing new bytes, and live state. Original keys themselves are retained; no backup-copy write can destroy the source. |
| Upstream custom equipment | `saveSlotValidation.ts:17-25` retains all-slot validation; `saveSlots.ts:454-459` retains missing custom-slot load blocker. Validation file is unchanged from phase1; the only production diff is the reviewed Save5 codec boundary, not equipment removal. Prior VERIFY's 10/10 equipment execution is historical corroboration, not claimed freshly rerun in this bounded repair review. |
| Autosave construction policy | Read actual phase1 `autosave.ts` via git show and current file; diff is empty. `performAutosave:51-56` constructs outside try; storage failure warns/returns null, construction failure throws. `maybeAutosave:88-91` updates debounce only after success. Fresh public probe causes a real DataCloneError, preserving disk and checkpoint, then successfully retries; fresh tests verify debounce retry. Later reconciliation must retain explicit failure; reconciliation itself belongs to task4 and is not claimed present. |
| Checkpoints | `checkpoints.ts:5-29` is unchanged memory-only WeakMap storage, with construction before map replacement. There is no existing checkpoint disk namespace to migrate. Fresh tests/probe confirm Save5 checkpoint, independent restore, unchanged live session, and prior checkpoint preservation on construction failure. Adding disk keys here would alter the upstream lifetime contract. |

## Fresh independent verification on current HEAD

All commands below ran from `/home/main/z-project/rpg-zzu-life-full-p2`. Each listed runnable command exited 0 in this verification session. The combined test command ran once, with no retry or skipped failure.

```sh
npm test -- test/lifeSaveConsumers.test.ts test/lifeSaveVersion.test.ts test/autosave.test.ts test/p0SessionPersistence.test.ts test/p1SessionPersistence.test.ts test/p2SessionPersistence.test.ts test/playerOpenSaveMenu.test.ts
```

**7 files / 72 tests passed; 0 failures, 0 skips.** Start 07:51:04; duration 36.76s. Counts: consumers15 + version18 + autosave16 + P0 9 + P1 3 + P2 4 + player-save7. This includes every specifically requested core target together with consumer and playerOpenSaveMenu, not a substitute test selection.

```sh
node .omo/evidence/life-full-20260906/2/public-probe.mjs
node /home/main/z-project/rpg-zzu-life-full-save-consumers/.omo/evidence/life-full-20260906/26/public-probe.mjs
node /home/main/z-project/rpg-zzu-life-full-save-consumers/.omo/evidence/life-full-20260906/26/browser-probe.mjs
node --check scripts/verify-gate-transfer.cjs
node --check scripts/capture-uiux-evidence.cjs
node --check scripts/playtest-driver2.cjs
```

The external repair probe files use process.cwd() for script extraction and Vite root, so these executions tested the integrated target, not the isolated producer source. Read their executable assertions before running; inspected actual JSON results, not merely printed PASS or producer self-report. Core probe confirms Project4 roundtrip, in-memory Save4->5, gold27 resume/new gold81 readback, both namespace families, corrupt current rejection, and actual clone-error policy. Repair probes confirm B1 behavior and bounded native browser cleanup as detailed above. All windows/storage/Vite servers/browser were closed by their finally blocks and the commands exited.

Fresh all-severity LSP diagnostics on each of the three repaired CJS scripts and `test/lifeSaveConsumers.test.ts`: **No diagnostics found** on all four. `git diff --check` exited 0. No full suite, build, gates, remote write, or expensive unrelated historical playthrough was launched.

## RED/GREEN chronology and integrity

Read and parsed producer historical logs rather than trusting SUMMARY alone:

- Core `2/red.txt`: 06:54:26, 11 failed / 7 passed; observed real version4 writer, old parser acceptance, corrupt-key fallback, old-byte replacement and checkpoint4 failures. Recorded command exit1.
- Core intermediate `green-first-test-fixture-error.txt`: 06:55:25, 1 failed / 49 passed, wrong Project field (`undefined` versus4). Current test checks actual `project.version`; expected version policy was not relaxed.
- Core `green.txt`: 06:57:59, 50 passed, recorded exit0. Save completion follow-up `save-signal-order-green.txt`: 07:26:17, 7 passed; current test awaits written completion before restoration assertion.
- Repair `26/red-tests.log`: 07:40:54, 15 failed /15; actual observation false on real current save, incorrect success via legacy key for invalid current payloads, and all three cleanup loops leave current bytes. `red-probe.log` parses to the same defect, with EXIT=0 meaning successful defect reproduction, not acceptance.
- Repair `26/green-tests.log`: 07:43:56, 33 passed; `green-probe.log` and `browser-probe.log` contain machine-parseable assertion-backed results with EXIT=0.
- Retained browser extraction failure log has TypeError before browser execution, EXIT=1. The corrected evidence extractor selects the outer await page.evaluate rather than nested arm call. No product/test assertion was weakened to absorb that harness error.

Historical RED chronology is log evidence, not a pre-edit run witnessed by this child or an independent RED commit. The previous independent B1 refusal matches its defect evidence. Current GREEN and both repaired integration surfaces were independently executed above. Repair's git diff adds tests without modifying/deleting existing tests; no new sleep/polling, skip, prose-pinning assertion, or mocked target integration was introduced.

## Artifact hygiene and final decision

Target git status was empty at entry and again after commands; HEAD stayed `f1024a2202ab6205591af630aeb53b0bc3445669`. This verifier writes only this VERIFY.md using an apply_patch shell function backed by GNU patch (standalone apply_patch is unavailable). No product edits, commits, PR, merge, or downstream task implementation occurred.

**Final decision: confirmed, verdict0, mandatory fixes0.** B1 is resolved on the stated actual ancestor commit. This is unconditional task2 approval, not approval of future tasks or final full-project shipping. Task3+ remain work to perform after this confirmation.
