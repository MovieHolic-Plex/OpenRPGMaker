# Visual QA - Verdict: GOOD

## Evidence

- Browser path: Chrome via Playwright opened `http://127.0.0.1:5173/?freshProject=1`, clicked `toolbar-database`, then clicked all 20 database top tabs by `data-testid`.
- RED screenshots: `01-actors.png` through `20-variables.png`.
- GREEN screenshots: `green-01-actors.png` through `green-20-variables.png`.
- State dumps: `red-layout-metrics.json`, `green-layout-metrics.json`, `console.json`.
- Regression: `npx playwright test test/e2e/rm2k3-database-tabs-layout.spec.ts --project=chromium` passed.
- Typecheck: `npm run typecheck` passed.

## Findings

- RED: tab switching moved the modal shell itself. `red-layout-metrics.json` recorded `db-body` Y positions ranging from 67 to 120, with manual/status rows disappearing on some tabs.
- GREEN: all tabs keep `modalBodyScrollTop` at 0. Top shell coordinates now stay within 1px: most tabs use `tabsY=52`, `manualY=78`, `statusY=98`, `bodyY=119`; class/enemy/troop tabs use the same frame within the accepted 1px border rounding tolerance.
- The fix keeps per-tab content layouts scrollable inside `.db-body` while preventing tab-specific styles from moving the shared modal chrome.

## Must Fix

- None.
