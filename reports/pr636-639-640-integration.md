# PR636 / PR639 / PR640 local integration candidate

Task: `st_01a07613`. Base: `647b000ee226b3aa22616275e1086632db724cdb`.
Locked worktree: `/home/main/z-project/rpg-zzu-sweep-editor-636-639-640`.
Branch: `agent/sweep-editor-636-639-640`.

The requested Draft/incomplete snapshots are merged, not treated as approval holds.
No later CSS inventory phases or unrelated product fixes were implemented.

## Verified increments

| PR | Requested snapshot | Local merge commit |
| --- | --- | --- |
| 636 | `e80eb71089bbfb245b688e396ed65831eedc70b3` | `f882cac597bd19281638077064ebf0a3acd12660` |
| 639 | `c52dd3443626fb983f5f5d1b42cf91ab9188ab57` | `d9b07071ba3c7de50ceed890cbbb05627c6b71ee` |
| 640 | `84bf156a11ae023b8f28954580d019f005271800` | `39059490be6c59aedde1560a5d5e3547f1306391` |

All three requested SHAs are ancestors of the candidate. Commits carry OmO attribution.
The report-only commit following these merges does not change the verified product tree.

## Conflicts and integration fixes

- PR636: only `openwiki/INDEX.md` conflicted. Regenerated it from the combined wiki;
  retained current System627 and concept-navigation617 content, plus the incoming CSS contract.
- PR639: only `DESIGN.md` conflicted. Kept both the database ownership and weighted worksheet sections.
- PR640: only `DESIGN.md` conflicted. Kept all previous sections and added walk encounters.
  Regenerated the wiki index after the documentation additions.
- No source-code conflict required a behavioral resolution.
- PR639 omitted the existing staged-state test's renamed input. Adapted that test from
  `weighted-branch-weight-0 = 3` to `weighted-branch-chance-0 = 75`, with the equivalent
  stored `75/25` distribution. The assertions still require the preceding name edit and
  the unrelated `stagedBetweenEdits` field to survive. No assertions were removed.
- PR639 changed the M2 surface but omitted the CSS live-class manifest. Refreshed only
  `weighted-branch-*` entries from the shipped CSS and supplied surface: 12 retired
  guide/legend/raw-weight classes out, 10 worksheet classes in, 18 current weighted
  classes protected. All unrelated manifest entries, metadata and gate logic remain
  unchanged. The M2 baseline/floor differ from the base only at `m2-211-weighted-branch`.

## Preserved ownership

`git diff --exit-code` against the base confirmed no changes to the current app/editor
boot owners, database navigation/System view, database sidebar geometry, latest
sidebar CSS/basic rail, map-overlay data owner, house-protection owner, tile actions,
encounter runtime or weighted-branch runtime.

The encounter drawing is added to the existing editor overlay layer after map-only
capture returns; it does not move tile/house ownership. Authoring retains the existing
`encounterTable[].conditions.region` schema, project identity/epoch, map/dimension,
encounter signature, reference and lock checks, plus one project snapshot and one
labelled mutation. Numeric runtime result indexing remains positive-row-only and
zero-based; named zero rows remain editable and persist. No automatic guides were restored.

## Verification commands and outcomes

Every Vitest invocation used this common prefix, with at most two workers:

```sh
node scripts/run-vitest.mjs run --configLoader runner \
  --config output/editor-636-639-640/vitest.config.ts --maxWorkers=2
```

The verification-only config imports `../../vitest.config`, preserves its test and
alias configuration, and sets `cacheDir` to `output/editor-636-639-640/vite-cache`.
This avoids writes through the shared `node_modules` symlink. No shared-root files,
other worktrees, remote branches, PR comments or database rows were written.

### PR636

- `npm run typecheck:app`: exit 0. The first attempt timed out at 120 seconds without
  diagnostics; the completed execution used a 600-second command deadline.
- `npm run gates:css`: exit 0 (budget, import graph, live-class contracts).
- Prefix above plus:

```text
test/databaseNumericLabelTrust.test.ts
test/databaseControlsNumberField.test.ts
test/databaseModernControls.test.ts
test/databaseStudioV2.test.ts
test/databaseRadioCustomGuard.test.ts
test/databaseSelectChevronGuard.test.ts
test/databaseSidebarCss.test.ts
test/databaseSystemStudio.test.ts
test/databaseConceptFirstNav.test.ts
```

Result: **121 passed, 1 failed; 8 files passed, 1 failed**.
Failure: `databaseRadioCustomGuard.test.ts:214`, bare input union paints radio chrome:

```text
src/styles/database/growth-tree.css:37
.database-modal-backdrop .database-modal-window .database-modal-body
.growth-studio :is(button, input, textarea, select):focus-visible
```

The offending source and guard are byte-identical to `647b000e`. Left unchanged.

### PR639

- `npm run typecheck:app`: exit 0.
- `npm run gates:css`: initially failed on the 12 retired weighted classes; after the
  scoped manifest update, exit 0. No CSS budget baseline was reset.
- Prefix above plus:

```text
test/weightedBranchUx.test.ts
test/commandEditModalPreview.test.ts
test/eventEditorStagedState.test.ts
test/interpreter.test.ts
test/m2PickerPage4.test.ts
test/m2EventCommandCatalog.test.ts
```

Initial result: **131 passed, 1 failed**, caused by the old weighted input test ID.
After the test adaptation, the final focused invocation was:

```text
test/eventEditorStagedState.test.ts
test/weightedBranchUx.test.ts
test/eventEditorM2Surface.baseline.test.ts
```

Final invocation: **43 passed, 1 failed**. Weighted UX and staged state: **33/33**.
The earlier preview/interpreter/catalog tests passed **99/99**.
The M2 suite passed 10/11; its only failure reports two unrelated existing surface deltas:

```text
m2-025-change-actor-faceset:
  + change-actor-faceset-ai-queue, change-actor-faceset-ai-queue-list
  div 132 -> 134; p 3 -> 4
m2-069-change-parallax-back:
  + change-parallax-back-ai-queue, change-parallax-back-ai-queue-list
  div 15 -> 17; p 4 -> 5
Both: + ai-image-queue, ai-image-queue-composer, ai-image-queue-empty, ai-image-queue-list
```

Those surface entries and their source owners were not changed. No weighted surface
mismatch remains. Unrelated snapshots were not regenerated to hide these failures.

### PR640 / final product tree

- `npm run typecheck:app`: exit 0.
- `npm run gates:css`: exit 0. Budget: 267 CSS files, 1619 hex literals, 723 important
  declarations, 60 undefined variables, 10 global-root files; no budget regression.
  Graph: 269/269 reachable, no new missing imports/orphans/duplicate exceptions.
- Prefix above plus:

```text
test/walkEncounterAuthoring.test.ts
test/walkEncounterModal.test.ts
test/walkEncounterOptions.test.ts
test/regionTaskMenu.test.ts
test/mapEncounterPanel.test.ts
test/actionEncounterGuard.test.ts
test/terrainEncounterScaling.test.ts
test/encounterRateGuarantee.test.ts
test/encounterInBattleGuard.test.ts
test/editSceneRender.test.ts
test/sidebarModeWorkflow.test.ts
test/sidebarFocus.test.ts
test/sidebarKeyboardNav.test.ts
test/editorMenuSidebarIa.test.ts
test/houseProtection.test.ts
test/layerRouting.m1.test.ts
```

Result: **143 passed, 1 failed; 15 files passed, 1 failed**. New encounter suites:
**24/24**. Latest sidebar workflow: **11/11**. Editor rendering: **11/11**.
House protection: **23/23**.

Failure: `layerRouting.m1.test.ts:302`, all fence tiles preserve ground:

```text
expected 243 to be 303 // Object.is equality
expect(lowerAt(map, x, 8)).toBe(TILE.DARK_GRASS)
```

The fence test, tile actions, bundled tile owner and map-overlay owner are unchanged
from the base. This is an unchanged-source baseline failure, not repaired here.
The base was not separately checked out and rerun during this bounded task.

Across distinct selected tests, taking the corrected weighted staged-state result:
**406 passed and 3 unchanged-source failures, 409 tests total**. This is not a full-suite
or all-green claim. Each increment's test run is recorded separately above.

## Diagnostics and limits

- TypeScript LSP reported no diagnostics on all changed TS source/test files checked.
- CSS LSP was unavailable (`biome` not installed). CSS gates ran instead; no dependency
  was installed and no diagnostics were suppressed.
- Full gates, build, browser sweeps, real browser layout/focus acceptance, and remote
  persistence verification were deliberately not run: parent-owned per delegation.
- Unit encounter coverage executes real store/history, serialize/deserialize and
  runtime eligibility; it is not evidence of Supabase persistence or Phaser visuals.
- Logs and the isolated runner config remain locally available in
  `output/editor-636-639-640/` (`pr636-*`, `pr639-*`, `pr640-*`).
- Incoming PR636/640 browser specs and historical PR636 evidence are merged snapshots,
  not browser evidence collected by this task.

## Best parent QA entries and selectors

Use this exact final tree with its own freshly started/frozen dev server. Assigned
`DEV_SERVER_PORT=9841` is a configuration value, not proof the port is still free;
check its listener/cwd before use. Keep `VITE_CACHE_DIR` inside this tree and block
remote mutation requests. Use local `/?blankProject=1` or `/?freshProject=1` fixtures.
The current editor-mode storage key is **`oprn:editor-ui-mode`**.

- **Numbers/animation:** `toolbar-database`, `db-tab-items`, `db-field-price`,
  `.db-number-stepper`; check one 32px border box, inner zero border/shadow, focus,
  disabled state and <=120px collapse. Animation: `db-tab-animations`,
  `.animation-detail-form`, `db-animation-sheet-preview-surface`,
  `db-animation-cell-x-0`; wheel-scroll to the lower control, preview >=280px.
  Entry: `playwright.db-css.config.ts` / `database-css-ownership.spec.ts` (1440/1024).
  **Harness limitation:** its incoming expert-mode init uses the obsolete
  `rpg-zzu:editor-ui-mode` key, so it does not prove Expert mode. The current
  `toolbar-database` is shared, so do not infer mode from button reachability.
- **Weighted:** event command `m2-211-weighted-branch` (catalog name retained),
  `command-picker-add-m2-211-weighted-branch`, `event-command-edit-dialog`,
  `weighted-branch-chance-0`, `weighted-branch-label-0`, `weighted-branch-index-*`,
  `weighted-branch-meter-*`, `weighted-branch-result-variable`,
  `weighted-branch-add-row`, `event-command-edit-ok`. Exercise 75/25 edits, zero-row
  Confirm/reopen with positive-only indices, invalid/all-zero Confirm, and IME/focus.
- **Encounters:** easiest entry `walk-encounter-list-open` ->
  `walk-encounter-select-area` -> left-drag rectangle ->
  `selection-chip-walk-encounter`. Then `walk-encounter-modal`, `walk-enemy-*`,
  `walk-encounter-frequency`, optional `walk-encounter-legacy`,
  `walk-encounter-advanced`, `walk-encounter-save`, `walk-encounter-error`.
  Reopen with `walk-encounter-edit-0`; retarget with `walk-encounter-retarget-0`;
  delete via two clicks on `walk-encounter-delete`. Undo: `oprn-tool-undo`.
  Entry: `test/e2e/walk-encounter-authoring.spec.ts` (1024x768/1280x800/1440x900).
- **Preservation QA:** beginner persistent palette and map flyout, expert direct
  utilities, no first-run automatic guides, System627 and concept617 navigation,
  and map-only screenshots without encounter outlines remain parent acceptance seams.
