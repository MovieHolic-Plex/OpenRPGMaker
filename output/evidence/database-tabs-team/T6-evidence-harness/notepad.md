# T6 Evidence Harness Notepad

## Bootstrap
- Role: T6 `evidence-harness` for team `database-tabs-ontology`.
- Tier: HEAVY.
- Tier justification: the deliverable creates a reusable cross-team browser evidence contract and Playwright helper surface for all Database tabs, then feeds the leader visual QA retry loop.
- Required skills used: `browser-evidence-qa` for packet shape and browser proof, `agy-vision` for second-opinion screenshot review requirements, `visual-qa` for final GOOD/NEEDS WORK retry contract, `programming` for TypeScript helper/spec edits.
- Skipped skills: `insane-search`, because no blocked external web information is needed.

## Success Criteria
- C1: Shared packet contract exists under `output/evidence/database-tabs-team/T6-evidence-harness/` and team artifacts.
- C2: Playwright helper exposes typed routines for opening Database, switching all tabs, collecting shell metrics, capturing screenshots, writing scenario/export/state artifacts, and closing/reopening.
- C3: Packet contract requires screenshots, JSON export/state, tab metrics, agy-vision output, and `visual-qa.md`.
- C4: Leader retry loop is explicit: failed packet verdicts produce actionable retry requests and fresh evidence.
- C5: Focused Playwright proof drives all Database tabs through the helper and captures evidence.

## Scenario Declarations
- RED: `npx playwright test test/e2e/rm2k3-database-harness-proof.spec.ts --project=chromium` before helper API exists. Binary observable: Playwright fails to import the missing helper exports.
- GREEN: same command after helper API lands. Binary observable: Playwright passes and writes `scenario.json`, screenshots, `tab-metrics.json`, `project-export.json`, and `visual-qa.md`.
- Real surface: Chrome/Playwright opens `/?freshProject=1`, clicks `toolbar-database`, switches every `db-tab-*` top tab, and captures the actual `database-modal`.
- agy-vision: `agy --print-timeout 90s --print "Analyze this UI screenshot: C:\Users\hyeon\Downloads\rpg-zzu\output\evidence\database-tabs-team\T6-evidence-harness\proof\tabs\variables.png..."`. Binary observable: `agy-vision.txt` exists with screenshot-specific findings.

## Evidence Log
- RED captured: `npx playwright test test/e2e/rm2k3-database-harness-proof.spec.ts --project=chromium` failed because `./rm2k3-database-helpers` did not export `DATABASE_TAB_SPECS`.
- GREEN captured: `npx playwright test test/e2e/rm2k3-database-harness-proof.spec.ts --project=chromium` passed, 1 test in 9.9s.
- agy-vision captured: `output/evidence/database-tabs-team/T6-evidence-harness/proof/agy-vision.txt`, using `variables.png`; findings include top menu clipping, crowded tabs, large empty panel space, stretched fields/buttons, and nested group-box hierarchy.
- Correction captured: reran `npx playwright test test/e2e/rm2k3-database-harness-proof.spec.ts --project=chromium` after fixing the spec-owned `visual-qa.md`; passed 1 test in 13.5s and the regenerated `visual-qa.md` now references `proof/agy-vision.txt`.
- Layout proof captured: first parallel run timed out; immediate solo rerun `npx playwright test test/e2e/rm2k3-database-tabs-layout.spec.ts --project=chromium` passed 1 test in 10.7s.
- Typecheck captured: `npm run typecheck` passed.
- Size cleanup captured: split packet writing into `test/e2e/rm2k3-database-evidence-helpers.ts`; pure LOC now 207, 106, 20, and 46 for touched TS files.
- Gate reviewer lane inconclusive: reviewer `019f0d32-5742-7103-860d-4e93e432d5c9` stayed silent across two 180s waits; leader requested closing the loop with T6 self-review and concrete evidence instead.

## Cleanup Receipts
- No background dev server manually started by T6; Playwright reused/managed the configured Vite server.
- Refactor cleanup complete: no touched TS file exceeds 250 pure LOC.
- Pending reviewer loop closed as inconclusive per leader follow-up; not counted as approval.
