# Task2: version and preserve life-system saves

Task2 is complete in one local atomic increment on `agent/life-full-p2`.
Only the Save5 boundary, its storage consumers, direct tests, wiki, and evidence are changed.
No task3+ life recovery implementation is claimed.

## Identity and scope

- Child task: `st_01a0738d`; parent/root: `01a0727b-398a-7481-b557-b198013542c1`.
- Worktree: `/home/main/z-project/rpg-zzu-life-full-p2`.
- Evidence: `/home/main/z-project/rpg-zzu-life-full-p2/.omo/evidence/life-full-20260906/2/`.
- Approved scope: task2 plus the full Scope section of the parent plan at `/home/main/.herdr/worktrees/rpg-zzu/wish-html/.omo/plans/life-systems-full-implementation.md`.
- Base commit: `87de73785d1c309bbbe975636414f70bbc73a4b9` (verified phase1/main integration).
- Base tree: `1b248f0fd4411ab953a2a61ade9470f5d4fcf9eb`.
- Verified code/tests/wiki tree before adding task2 evidence: `0eecfffc6839471ed9093ea1bbe55a3ecd53636e`.
- Atomic commit subject: `feat(save): version and preserve life-system saves`. Original implementation commit: `573a418e01c9eb97dda0df033c21e2d5985b0102`. The save-signal follow-up below is a separate test-only increment.
- Initial target worktree was clean; no upstream configured. Parent worktree's unrelated WISH.md was not edited or staged.
- Read AGENTS, quickstart, PROJECT_WIKI, focused runtime guidance, programming/TypeScript, debugging, git-master, and prior task1 SUMMARY.txt. No previous task2/verify SUMMARY existed. All CLAUDE.md ignored.
- Node v24.11.1; repository npm and installed dependency symlink used. No package changes. Inherited port setting was 9841; no HTTP listener was started or needed.

## Actual implementation

`src/player/saveSlots.ts` is the only production file changed (19 additions / 14 removals):

1. Independent `SAVE_SCHEMA_VERSION=5`; Project `SCHEMA_VERSION=4` and `Project.version` remain unchanged. The writer emits Save5 even without optional life packages.
2. Reader accepts exactly numeric Save4 and Save5, upgrades Save4 to Save5 in memory, and explicitly rejects Save3, unknown future versions, and string version values.
3. Manual keys are `oprn:save-slot:v5:1..3`; auto is `oprn:save-slot:v5:auto`. Existing trimmed export namespace substitutes for `oprn` exactly as before.
4. New-key absence (`null`) alone permits matching legacy-key fallback. Empty-string, broken JSON, null payload, missing fields, and future-version new keys are corrupt, never replaced with stale old progress.
5. Reads/migration write nothing. New writes never delete or overwrite legacy raw bytes. No backup-copy write is necessary: the old key itself is retained. Quota failure preserves both old raw bytes and any previous new slot, plus live progress.

The existing autosave test now explicitly constructs legacy Save4 instead of accidentally calling the new writer and labeling its output legacy. Five existing browser-test storage consumers/cleanup helpers now use the v5 key; old corrupt-slot/migration fixtures that intentionally exercise legacy fallback are retained. Full browser journeys are not claimed executed here.

### Preserved upstream contracts and clarified checkpoint scope

- `saveSlotValidation.ts` and the custom-equipment parser are untouched. The existing missing-custom-slot `snapshotLoadBlocker` remains intact; custom equipment roundtrip, malformed custom values, and deleted catalog blockers pass related tests.
- `autosave.ts` is untouched. Snapshot construction remains **outside** the storage-error catch. Construction failure throws explicitly, cannot return success, and does not advance debounce; storage failure warns and returns null. The tests characterize this before and after production edits. Future reconciliation failure must preserve this policy, not become false success.
- `checkpoints.ts` is unchanged and is a `WeakMap<PlaySession, SaveSnapshot>` authority. There is **no existing checkpoint storage key** anywhere in its call path. Introducing new disk storage would change unrelated lifetime semantics; instead checkpoints inherit Save5 through the shared writer, preserve the previous checkpoint on construction failure, and restore an independent session. Existing checkpoint non-persistence tests pass. The plan's disk-key clause is therefore inapplicable to the actual checkpoint implementation, not silently substituted with a fictitious key.
- Language-service references enumerate every production writer caller: autosave, checkpoint, and playerStatusMenuController. The initial LSP reference adapter returned declaration-only results; the recorded direct TypeScript language service provides the complete references.

## RED/GREEN and validation

Exact commands, actual exits, log paths, and results are in `commands.json`.
Commands ran from the target worktree with bounded foreground execution; no monitor tool was available and no pipeline status was used as the child exit.

| Evidence | Command / outcome | Exit |
| --- | --- | --- |
| `red.txt`, `red.json` | `npm test -- test/lifeSaveVersion.test.ts`: 11 failed / 7 passed before any production edit. Actual writer returned 4, frozen old reader accepted that output, old key was overwritten, and new corrupt-key bytes were ignored. Characterizations already passed. | 1 expected |
| `green-first-test-fixture-error.txt` | First five-file run: 49 passed / 1 failed. New test incorrectly named Project's version field `schemaVersion`; actual Project field is `version`. Corrected the new assertion only; failure retained. | 1 |
| `green.txt`, `green.json` | `npm test -- test/lifeSaveVersion.test.ts test/autosave.test.ts test/p0SessionPersistence.test.ts test/p1SessionPersistence.test.ts test/p2SessionPersistence.test.ts`: **5 files / 50 passed**, zero failed/skipped, one final run. Every requested file exists; no substitution. | 0 |
| `related.txt` | `npm test -- test/customEquipmentSlots.test.ts test/checkpointEndingRuntime.test.ts test/systemShell.test.ts test/playerOpenSaveMenu.test.ts test/p2SpatialPersistence.test.ts test/customSeasonSave.test.ts`: **6 files / 32 passed**, zero failed/skipped. | 0 |
| `diagnostics.txt` | `node .omo/evidence/life-full-20260906/2/diagnostics.mjs`: syntactic and semantic language-service diagnostics on all **9 changed TS files**, zero diagnostics; complete production references included. | 0 |
| `typecheck.txt` | `npm run typecheck:app` | 0 |
| `build.txt` | `timeout --signal=TERM --kill-after=10s 300s npm run build`: full app, player/SDK, standalone build finished within bound. | 0 |
| `version-roundtrip.txt`, `.json` | `node .omo/evidence/life-full-20260906/2/public-probe.mjs`: exact real public Vite SSR imports with happy-dom Storage; happy/failure and cleanup below. | 0 |
| `wiki.txt` | `npm run openwiki:verify`; `npm run openwiki:index -- --check` | 0 / 0 |
| `cleanup.txt` | `git diff --check` and staged diff check | 0 |

LSP directly reported no diagnostics on the tests; saveSlots fresh-diagnostic request timed out at 3000ms. This is not treated as a pass: the direct language service above checked all final TS files successfully before typecheck/build. Build output retains unresolved runtime asset URL and large-chunk warnings; no warning suppression was added.

## Actual old reader provenance

`test/fixtures/life-full/saveSlots.phase1.ts` is the **complete, byte-identical** old module from the base commit, not a recreated comparison or mock predicate. Both `git hash-object test/fixtures/life-full/saveSlots.phase1.ts` and `git rev-parse 87de7378:src/player/saveSlots.ts` yield `d47f58197b24f781635cde0a2152a5bde0c3f689`. SHA256 and production source hash are in `provenance.json`.

Its real storage reader accepts old bytes and rejects exact new writer output at its actual schema-version comparison. Unchanged validation imports remain shared: this freezes the reader module, not an entire historical application binary. No minReader field is used to claim protection. The large fixture is deliberately not refactored; doing so would invalidate the byte-identical provenance. The existing large production codec is not refactored as part of this focused version change.

## Public surface and adversarial evidence

The runnable public probe imports real `saveSlots`, `autosave`, `checkpoints`, project IO/defaults, and session APIs through Vite SSR. It does **not** claim player.html UI execution and does not mock the parser, writer, checkpoint, or session implementation.

- Happy: Project4 serialize/deserialize -> Save4 old bytes -> current reader's in-memory Save5 -> independent resumed session -> manual/auto Save5 write -> read back distinct newer gold; namespace null and runtime-qa namespace both verified. Legacy raw pretty-printed bytes including trailing newline are unchanged.
- Failure: real frozen reader rejects actual new bytes; empty/malformed/future new payloads do not use valid old progress. An actual uncloneable live value causes DataCloneError through autosave/checkpoint construction; old disk and prior checkpoint remain intact, and clean retry succeeds. No successful result or life outcome is injected.
- **cancel/resume:** related real player shell/controller DOM-keydown test proves cancellable overwrite confirmation and direct re-entry; storage probe and persistence tests prove resume. Checkpoint resumes do not mutate current live state.
- **malformed:** empty, broken JSON, JSON null, missing fields, future schema, string schema; custom equipment invalid entries fail closed.
- **stale:** newer progress 89/81 differs from legacy 17/27; new-key precedence and namespace isolation asserted. Corrupt new bytes never substitute stale legacy progress.
- **flaky:** no sleep, polling, or wall-clock wait was added to task2 tests/probe. Autosave debounce uses explicit synthetic nowMs; construction/quota failure does not consume it. Existing browser suites contain old polling/fixed-delay patterns and were not used as task2 execution evidence or broadly refactored here.
- **dirty:** target started clean, only named paths staged; parent plan/Boulder/WISH and other tasks' sources untouched.
- **misleading output:** expected RED, the intermediate fixture mistake, warnings, LSP timeout and actual child exits retained. A final successful five-file run is recorded, not invented. No whole-suite/gates/browser PASS is claimed.

## Cleanup and limits

Public probe storage cleared and windows/server closed in finally; all test and build children actually exited. Task-created dist output and temporary copied RED/GREEN logs were removed after retaining evidence. Pre-existing caches, .env.local, and shared node_modules were left alone. No HTTP port, remote DB write, dependency install, push, PR, or merge occurred.

Full gates and browser journeys remain parent-owned and **not run** here. The five updated existing browser consumers have language-service verification but no scenario-execution claim. `test/fixtures/life-full/coverage.json` is unchanged: exact 51 features + F01..F13 remain `not-run`. This task does not claim the full51 scenario or later life-reconciliation behavior is complete.

All source/wiki/test edits and evidence additions used an `apply_patch` compatibility function invoking installed GNU patch with unified diffs (`apply_patch() { patch -p1 --forward; }`); a standalone apply_patch executable was unavailable. Generated index content came from the actual index generator rendered to stdout, then applied as a patch; its check passes. Runtime logs are captured command output, not hand-edited success transcripts. The first evidence-stage diff check found trailing whitespace emitted by Vite/Vitest (exit 2); the three exact original outputs and SHA256 hashes are preserved in `raw-output.json`, while their readable .txt copies only trim line-end whitespace. The final staged check passes; no result text or exit was changed.

## DoneClaim

```json
{
  "taskId": "st_01a0738d",
  "taskNumber": 2,
  "status": "done",
  "branch": "agent/life-full-p2",
  "baseCommit": "87de73785d1c309bbbe975636414f70bbc73a4b9",
  "verifiedCodeTestsWikiTree": "0eecfffc6839471ed9093ea1bbe55a3ecd53636e",
  "commitSubject": "feat(save): version and preserve life-system saves",
  "commitLookup": "git log -1 --format=%H -- src/player/saveSlots.ts",
  "projectSchemaVersion": 4,
  "saveSchemaVersion": 5,
  "legacyReader": "byte-identical phase1 module; actual Save5 rejection proven",
  "manualAutosave": "versioned namespaces; absent-only legacy fallback; raw-byte and quota preservation proven",
  "checkpoint": "existing memory-only contract retained; shared Save5 and failure preservation proven",
  "requiredTests": { "files": 5, "passed": 50, "failed": 0, "skipped": 0 },
  "relatedTests": { "files": 6, "passed": 32, "failed": 0, "skipped": 0 },
  "diagnostics": 0,
  "typecheckExit": 0,
  "fullBuildExit": 0,
  "publicProbeExit": 0,
  "full51coverage": "not-run; unchanged",
  "remoteWrites": 0,
  "pushPrMerge": false,
  "teardown": "complete"
}
```

## Parent-requested deterministic save signal follow-up

Base: `573a418e01c9eb97dda0df033c21e2d5985b0102`. Commit subject: `test(save): await exact quest save completion`.

The changed save seam in `test/e2e/_quest-playthrough.spec.ts` no longer waits 1200ms after clicking slot 1. It awaits `page.evaluate(armSaveWriteSignal, "oprn:save-slot:v5:1")` **before** clicking, then awaits that exact observation. The test-only, browser-serializable helper wraps the actual localStorage instance setter, delegates the real write first, and completes only after a successful write of the exact key. Other keys, sessionStorage, and pre-existing bytes cannot satisfy it. A five-second failure bound returns timeout, which fails the explicit outcome assertion; this is not a sleep or polling retry. The finally block disposes the signal and restores the original setter. No production module or unrelated adventure sleep changed. The original stored `sw_quest_key` parsing and complaint/assertion are preserved verbatim.

`test/playerOpenSaveMenu.test.ts` adds three checks using the actual exported player shell, registry openSaveMenu callback, controller, and save codec (only the existing Phaser/audio boot substitutes remain). They prove the exact Save5 key and quest switch signal through Enter, timeout after unrelated storage writes, and quota failure never reporting completion plus cancellation cleanup. Existing assertions remain untouched. The timeout case uses fake time because the timeout itself is the behavior under test.

Verification:
- `npm test -- test/playerOpenSaveMenu.test.ts`: **7 passed / 0 failed / 0 skipped**, actual exit 0 (`save-signal-green.txt`).
- `timeout --signal=TERM --kill-after=5s 90s node .omo/evidence/life-full-20260906/2/save-signal-browser.mjs`: actual exit 0 (`save-signal-browser.txt`). Real Chromium evaluates the **same helper function** used by the adventure, arms it before a button click, observes the exact storage write, verifies the original quest-switch value, rejects unrelated writes/stale contents, and disposes storage/browser resources. The browser probe tests the instrumentation; the focused player test supplies the real save-entry-point integration. Neither claims the full adventure ran.
- Fresh LSP diagnostics on `test/e2e/saveWriteSignal.ts`, `test/e2e/_quest-playthrough.spec.ts`, and `test/playerOpenSaveMenu.test.ts`: no diagnostics.
- `timeout --signal=TERM --kill-after=10s 300s npm run typecheck:app`: actual exit 0 (`save-signal-typecheck.txt`). An earlier tool call hit its 120-second bound without capturing a child exit; preserved as **not a pass** in `save-signal-typecheck-timeout.txt`. Process inspection found no surviving task2 tsc and three other-worktree tsc processes during high memory/swap use; nothing outside task2 was stopped.
- `git diff --check`: exit 0. No full suite, full adventure, broad architecture pass, or new production build performed for this test-only follow-up; the previously verified production tree is unchanged.

Intermediate failures are retained, not hidden: the initial prototype hook missed happy-dom's already instance-bound setter (2 failures); qualifying window.Storage did not fix it (same 2 failures). A targeted diagnostic observed identical prototypes but a different instance method. Reading happy-dom Storage's ClassMethodBinder-backed proxy confirmed that binding behavior. The final helper uses Object.defineProperty on the instance; a real Chromium experiment also confirmed this intercepts native Storage calls. `save-signal-initial-failure.txt`, `save-signal-realm-failure.txt`, and `save-signal-diagnosis.txt` retain those results. The diagnostic name-filter excluded six tests for investigation only; the final full focused file ran all seven without skips. The temporary STORAGE_REALM console probe was removed.

Follow-up DoneClaim: exact pre-action subscription and bounded failure are implemented; original E2E progress assertion retained; real save-entry test 7/7 and Chromium helper probe pass; changed-file diagnostics/typecheck pass; temporary instrumentation is disposed; no remote writes or application-code changes; full51 remains not-run.

### Final parent-requested assertion ordering check

The stale 2/7 result was already corrected in `5c510b7840809fe90844c1a4c8ff748a435ffb65`; `save-signal-green.txt` records 7/7. The parent's additional ordering requirement is now explicit: the success test awaits `signal.completion` and asserts `written` **before** checking setter restoration. No assertion was removed or weakened. Existing beforeEach clears localStorage/sessionStorage and resets namespace/project; afterEach disposes the observation, restores real timers and mocks, tears down the player, and clears localStorage. Real writes and injected quota failure still traverse the same save controller/codec.

Fresh command: `npm test -- test/playerOpenSaveMenu.test.ts`; **7 passed / 0 failed / 0 skipped**, actual exit 0, in `save-signal-order-green.txt`. Fresh LSP on the sole changed TS file: no diagnostics. `git diff --check`: exit 0. No helper, production, checkpoint, or unrelated sleep changed. The previously successful browser probe and typecheck remain applicable to unchanged helper/production code; neither the adventure nor a broad suite was rerun. Cleanup refreshed in `cleanup.txt`. Follow-up DoneClaim remains complete with the awaited-restoration ordering proven by this final focused run.

### Supervisor-observed native Storage confirmation

The parent independently reported evaluating the current transpiled `armSaveWriteSignal` in real Chromium at a fresh localhost origin: localStorage.setItem remained a function before/after arming; arming `test-save` before native `setItem("test-save", "native-write")` completed with `written`, and the stored value was `native-write`. The parent called dispose and closed the browser and ephemeral HTTP server. This is **supervisor-observed provenance supplied in the task conversation**, not a child-executed command or an additional full-adventure claim. The child independently rechecked fresh diagnostics on all three final test files: no diagnostics. Implementation and verification commits remain `5c510b7840809fe90844c1a4c8ff748a435ffb65` and `b355c96630fa7c9c4168aee9644f701d45693376`; this final note changes evidence only.
