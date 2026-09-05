# Integration recovery, 2026-09-06

## Scope

The user requested integration of eligible outstanding work, verification,
production build, push, and restart of the service on port 9888.

The shared checkout at `/home/main/z-project/rpg-zzu` contains ongoing work
from other sessions. Its source files, index, and branch are not modified by
this integration. The integration checkout is
`/home/main/z-project/rpg-zzu-integration-recovery-0906`.

Initial integration base: `0182722b`, containing PRs #601, #602, #604, and #606,
which were missing from the previously served local `32ef1bcd` build.

## Intake decisions

| PR | Intake decision | Evidence |
| --- | --- | --- |
| #603 | Await owner approval; recheck before push | Draft; PR body explicitly requires final approval before merge |
| #605 | Integrate and verify | Ready PR; inventory and custom equipment slots; generated wiki index conflict |
| #607 | Integrate and verify | Ready PR; world document workspace; generated wiki index conflict |
| #608 | Hold known regressions; recheck before push | Draft; PR body identifies village postprocessing, manual-house start, and empty-argument regressions being repaired |
| #609 | Await owner approval; recheck before push | Draft; final approval explicitly pending; head continues to change |
| #610 | Await owner approval; recheck before push | PR body explicitly says final gates and approval are pending despite non-draft status |
| #611 | Integrate and verify | Ready PR; facility composition and interaction access |

At the final intake refresh, upstream `2e51a022` added PR #603. Include it
and preserve both its party-hierarchy contract and the inventory contract in
the DESIGN.md conflict. PR #609 became non-draft, but its body still requires
final approval and GitHub has no approval record; do not infer approval from
the draft flag. Newly opened #612 and #613 likewise explicitly await final
approval, so retain them as pending owner work. No review comments are posted.

The intermediate full gate and build were stopped when upstream #603 arrived;
their partial outputs are not final-tree pass evidence. Run final-tree checks
after integrating that CSS update.

GitHub conflict labels alone do not justify holding a PR. Generated
`openwiki/INDEX.md` conflicts are resolved by regenerating the index from the
combined documentation rather than choosing either side.

## Verification

Results are recorded here after commands complete. Pending commands are not
passing evidence. Existing repository gate failures must be distinguished
from integration regressions without weakening tests or changing baselines.

The first PR #605 integration typecheck failed with TS2554 at
`databaseInventoryCatalog.ts:121`. PR #602 introduced the required
`playbackOwner` argument to `recordForm`, while #605's new caller passed only
three arguments. The integration passes the existing retained `host`, matching
the existing `renderRecordTab` call. No optional argument or type suppression
was introduced.

The original `0182722b` checkout reproduces all three sidebar failures:
`databaseSidebarKeyboard.test.ts` has two order failures and
`databaseSidebarNav.test.ts` has one count failure (40 actual versus 38
expected). The integration removes the standalone equipment tab, resulting
in the same two-entry discrepancy (39 actual versus 37 expected).
Both runs use `--maxWorkers=2`. The baseline run exits 1 with 3 failed and
8 passed assertions. No sidebar test was disabled or weakened.

PR #605 corrected integration:

- `npm run typecheck:app`: exit 0.
- Nine focused test files: 70 passed, 3 pre-existing sidebar failures; exit 1.
- `CATALOG_QA_URL=http://127.0.0.1:29861 PLAYWRIGHT_MODULE=@playwright/test node scripts/qa/inventory-catalog.mjs`:
  exit 0, 312 initial catalog records, no page errors.
- Both item/equipment panes have no horizontal overflow at 1024, 1280, and
  1440 widths. Search, keyboard, gallery, guarded CRUD, custom-slot editing,
  reference protection, and opening the AI item dialog passed.
- Fresh artifacts: `output/evidence/inventory-catalog/measurements.json`
  and its PNGs.
- The image reader did not deliver pixels to the current model. Browser
  interaction and geometry are verified; independent aesthetic approval is
  not claimed.

PR #607 integration:

- Generated wiki index conflict resolved by regeneration.
- Combined `database.ts` retains both the unified inventory routing and
  the world overview label.
- `npm run typecheck:app`: exit 0.
- Twelve world-domain test files: 116 passed, exit 0.
- Browser save/reopen/navigation/search/lock/deletion and narrow-width
  document/list access scenarios both passed, with retries disabled.
  Fresh screenshots are under `verify-shots/world-authoring-fixes/`.

PR #611 integration:

- `npm run typecheck:app`: exit 0.
- Six focused facility/concept tests: 110 passed, exit 0.
- `vite-node scripts/qa-facility-quality.mts integration`: exit 0.
- All eight changed facilities have zero placement/walkability warnings.
  The unchanged inn fixture retains its existing unconnected stair warning.
- Fresh map artifacts and manifest:
  `output/evidence/facility-quality/integration/`.

Upstream PR #603 integration:

- DESIGN.md retains both inventory and party-hierarchy contracts.
- `npm run gates:css`: exit 0; budget regressions 0, graph orphans 0,
  protected live classes retained.
- Direct Firefox checks of actors/classes/skills at 1024x768, 1280x800,
  and 1440x900: all nine screens have no document overflow and their
  inspectors remain inside the modal.
- Fresh screenshots:
  `output/evidence/inventory-catalog/party-{actors,classes,skills}-{1024,1280,1440}.png`.
- Repeated the complete inventory-catalog browser scenario after the upstream
  CSS change: exit 0, 312 records, all geometry and interaction checks passed.

## Final build and real surfaces

- Final `npm run build`: exit 0, including app typecheck, editor, player SDK,
  and standalone player. Main entry: `main-dgqJy37W.js`; CSS:
  `main-CztPE0ln.css`.
- Direct Firefox access to the built editor on port 29862 opened inventory,
  world overview, codex, enemies, and animations with zero page errors.
  Evidence: `output/evidence/inventory-catalog/production-*.png`.
- Built export-player custom equipment scenario: all six beats passed,
  no runtime errors, exit 0. Evidence:
  `verify-shots/runtime-qa/integration-equipment/`.
- Built facility Chromium run: all eight state assertions passed, but the
  last facility suffered `ERR_NETWORK_CHANGED` resource failures. That run
  is retained as exit 1, not relabeled as a pass.
- `FACILITY_QA_FIREFOX=1` selects a direct Firefox replay of the same assertions
  and writes to `player-firefox/`, preserving the original Chromium evidence.
  It does not proxy requests or change product code.
- Clean upstream full `npm run gates` exceeded the 30-minute watcher limit.
  This is not evidence of whole-suite success. Separate upstream surface
  comparison and focused domain results remain the relevant evidence.
- Separate `npm run gates:surface` on integration and clean `0182722b`:
  both exit 1 with 6 failures and 107 passes in the same five files.
  Failure names, assertion messages, and expected/received diff lines are
  exactly equal, including changeFace/showPicture AI controls, monster
  species defaults, M2 image queues, and portal/NPC graphics metadata.
  The two PR #605 equipment snapshot updates introduce no extra difference.
- Firefox facility replay: exit 0, eight of eight beats passed, no runtime
  errors. Final report:
  `output/evidence/facility-quality/integration/player-firefox/SUMMARY.md`.

## Last upstream delta: PR #609

The final fetch found upstream `35b651bb`, which had actually merged #609.
It is now included, unlike the earlier approval-pending intake state.
Only the generated wiki index conflicted and was regenerated. New #614 and
#615 are explicitly unfinished Draft PRs; they remain unmerged.

- Seven animation regression files: 38 passed, exit 0.
- Latest `npm run build && npm run gates:css`: exit 0.
- First direct Firefox UX run reached editing after passing geometry,
  graphic selection/clear, playback and keyboard checks, then failed reading
  X=0 instead of 23 from a raw `import('/src/project/store.ts')`.
- The long-lived development server had loaded the live store with a `?t=`
  HMR suffix. Direct reproduction proved UI X=23 survives adding a cell;
  importing that actual loaded module URL returns X=23 and two cells,
  while the unsuffixed test import creates a different store returning X=0.
  Restart the QA server without HMR and rerun the unmodified assertions.
  No product fix or test expectation relaxation is justified by this failure.
- Clean-server original Firefox UX scenario: 1 passed, exit 0, retries 0.
  This covers all three viewport sizes, graph selection/cancel/clear,
  keyboard playback, frame-cell editing and 14px working stepper icons.
  The source test and assertions were not changed.

## Rollout decision

Final gate reviewer approved product candidate
`cfd88c99ab37eb56bdbe6e851cc66ba2814dce99`, including upstream #609.
The final built editor additionally passed direct Firefox playback stop,
graphic-picker cancel, and X=23 retention across adding a second cell.

At the final fetch, the candidate contains all upstream main commits.
Mergeable reviewed PRs #605, #607 and #611 are included; upstream #601,
#602, #603, #604, #606 and #609 are also included.
PRs #608, #610, #612 and #613 still explicitly await completion/owner approval.
#614 and #615 remain unfinished Drafts. New Drafts #616 (growth trees) and
#617 (concept-bundle map authoring) arrived during this integration and are
reported separately, not represented as shipped.

No whole-suite success is claimed: the pristine run reached its 30-minute
limit, and intermediate integration runs were stopped when the source target
changed through upstream merges. Domain, CSS, exact surface-baseline
comparison, full production build and real-surface evidence are recorded above.
