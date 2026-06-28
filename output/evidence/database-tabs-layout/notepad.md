# Database Tabs Layout ULW Notepad

Tier: HEAVY. The task is browser-facing UI/UX work, the user explicitly disliked layout instability, and the requested output required browser screenshots.

Skills used:
- `ulw-loop`: evidence-led goal execution and RED/GREEN proof.
- `browser-evidence-qa`: screenshot packet, scenario JSON, visual QA.
- `frontend`: existing UI redesign route with design-system/perfection checks.
- `programming`: TypeScript E2E regression test.

Success criteria:
- All database top tabs are clicked in a real browser and captured as screenshots.
- RED evidence proves the layout shift before the fix.
- The shared database modal chrome remains stable after the fix.
- Focused typecheck and browser regression pass.

Evidence:
- Scenario: `output/evidence/database-tabs-layout/scenario.json`.
- RED: `output/evidence/database-tabs-layout/red-layout-metrics.json`; screenshots `01-actors.png` through `20-variables.png`.
- GREEN: `output/evidence/database-tabs-layout/green-layout-metrics.json`; screenshots `green-01-actors.png` through `green-20-variables.png`.
- Visual QA: `output/evidence/database-tabs-layout/visual-qa.md`.

Verification:
- RED: `npx playwright test test/e2e/rm2k3-database-tabs-layout.spec.ts --project=chromium` failed before the fix with `db-tab-classes tabs top Expected: 53 Received: 74`.
- GREEN: `npm run typecheck` passed.
- GREEN: `npx playwright test test/e2e/rm2k3-database-tabs-layout.spec.ts --project=chromium` passed.

Cleanup:
- No new long-running browser session remains open.
- Existing dev server on `127.0.0.1:5173` was reused and was not started by this task.
