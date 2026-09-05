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
