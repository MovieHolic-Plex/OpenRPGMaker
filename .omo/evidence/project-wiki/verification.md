# Verification and baseline comparison

## Passing feature evidence

- Focused project-wiki and adjacent contracts: **87 tests, 13 files, exit 0**.
- Field graphic validation and adjacent graphic/spawn contracts: **22 tests, 3 files, exit 0**.
- Session switching/queued-send isolation after the transport fixture update:
  **17 tests, exit 0**. The request-start event replaces guessed microtask timing.
- Final policy, wiki-read narration, cluster acceptance and cancellation
  compatibility contracts: **43 tests in 4 files, exit 0**.
- Generated tool catalog: **4 tests, exit 0** in normal verification mode.
- Real editor fresh-chat recall and concurrent manual-edit rejection:
  **1 browser scenario, exit 0**, retries disabled.
- Live OAuth extraction, correction, map exception, authoring, remote save and
  reload: passed on `qa-project-wiki-combat-20260907`.
- Exported-player contact and action combat: both passed, zero page errors.
- Full `npm run build`: exit 0. App-only rebuild after the final read-activity
  classification change also passed, with `typecheck:app` exit 0.

## Whole-repository gate is not green

`npm run gates` returned exit 1:

- typecheck: exit 0, zero errors;
- CSS: exit 0;
- Vitest: 14,306 passed, 210 failed;
- surface snapshots: existing event-editor baseline mismatches.

This full run overlapped the field-graphic RED/GREEN increment. Its recorded
projectWikiCombat failure is the captured RED, superseded by focused GREEN and
the regenerated real-game runtime proof. The raw report was not edited.

The stored gate baseline predates starting commit `49067218a`. An immutable
worktree at that exact commit was used to compare the failing-file subset,
including assertion names and diagnostic messages.

The first `/tmp` baseline lacked an ancestor-resolved `zod` package and was not
treated as valid evidence for affected files. The worktree was moved beside the
implementation tree; all uncollected files and four nested-import files were
remeasured in the same dependency environment.

The four dynamic-load files then had **24 tests and the same 2 failures on both
trees** (`databaseViewToggle` and `modeTransitions`). Dashboard/overview cases
passed on both. Transactional-project timeout cases passed in the focused
implementation rerun.

The two `aiChatObservability` failures reproduced unchanged on the starting
commit. Attempted unrelated repairs were withdrawn; the file is not in this
change. Other untouched baseline failures include image-queue/fake-DOM cases,
surface snapshots, and legacy content expectations.

Change-related model-double mismatches were corrected at the transport seam:
the extra wiki JSON request receives an empty knowledge patch for unrelated
authoring tests, while all existing behavior assertions remain. The obsolete
policy prose snapshot was replaced with exact shipped-copy equality; actual
action capabilities are tested through active tool metadata.

Detailed local reports:

- `output/evidence/project-wiki/baseline-results.json`
- `output/evidence/project-wiki/baseline-loaded-results.json`
- `output/evidence/project-wiki/baseline-nested-results.json`
- `output/evidence/project-wiki/current-nested-results.json`
- `.omo/gates-vitest-report.json`

## Self-review

The final production diff was read against the goal. Project-owned documents,
manual provenance, immutable application evidence, stale-write protection,
awaited persistence, source-aware routing, and real combat outcomes are covered.
The change remains HEAVY; it adds persistent metadata and crosses asynchronous
editor/authoring boundaries. No ulw-plan review gate was activated, so this is
self-review, not a claimed independent reviewer approval.

Owned browser contexts and player servers were closed. Port 9857 was explicitly
verified unbound after stopping the editor QA server. Domain/UI worktrees were
removed with their branches retained. The immutable baseline tree was removed
after comparison. QA project data and local evidence remain
as intentional verification artifacts, not live runtime resources.
