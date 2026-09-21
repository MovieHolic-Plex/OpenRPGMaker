# Cream UI Retheme — Evidence Manifest (after)

Generated: 2026-08-20T01:13Z (AFTER, warm-cream palette)

## Matrix shots (todo 14, prefix `matrix-`)

| filename | surface | viewport | route / interaction | before-or-after | date |
|---|---|---|---|---|---|
| matrix-shell-1024.png | editor shell | 1024x768 | `/?freshProject=1` | after | 2026-08-20 |
| matrix-shell-1280.png | editor shell | 1280x800 | `/?freshProject=1` | after | 2026-08-20 |
| matrix-shell-1440.png | editor shell | 1440x900 | `/?freshProject=1` | after | 2026-08-20 |
| matrix-mode-beginner.png | UI mode beginner | 1440x900 | `/?freshProject=1` + localStorage `rpg-zzu:editor-ui-mode=beginner` | after | 2026-08-20 |
| matrix-mode-standard.png | UI mode standard | 1440x900 | `/?freshProject=1` + localStorage `rpg-zzu:editor-ui-mode=standard` | after | 2026-08-20 |
| matrix-mode-expert.png | UI mode expert | 1440x900 | `/?freshProject=1` + localStorage `rpg-zzu:editor-ui-mode=expert` | after | 2026-08-20 |
| matrix-welcome-1440.png | welcome overlay | 1440x900 | `/?freshProject=1&forceWelcome=1` | after | 2026-08-20 |
| matrix-welcome-1024.png | welcome overlay | 1024x768 | `/?freshProject=1&forceWelcome=1` | after | 2026-08-20 |
| matrix-entry-dbrequired.png | db-required recovery | 1440x900 | `/` (bare, no params — localStorage cleared) | after | 2026-08-20 |
| matrix-event-editor-1586.png | event editor modal | 1586x992 | `/?freshProject=1&classicCapture=2` | after | 2026-08-20 |
| matrix-event-editor-960.png | event editor modal | 960x900 | `/?freshProject=1&classicCapture=2` | after | 2026-08-20 |
| matrix-database-default.png | database modal (default/actors tab) | 1440x900 | `/?freshProject=1` + click `[data-testid=standard-more-tools]` → `[data-testid=standard-more-database]` | after | 2026-08-20 |
| matrix-database-enemies.png | database modal (enemies tab 몬스터) | 1440x900 | same as above + click `[data-testid=db-tab-enemies]` | after | 2026-08-20 |

All matrix shots: DPR 1, chromium headless, full-viewport PNG, hard navigation + networkidle + ~700ms settle per task spec. Server: `npx vite --configLoader runner --host 127.0.0.1 --port 4372 --strictPort`.

## Pre-existing evidence (todos 1–11)

| filename | surface | viewport | route / interaction | before-or-after | date |
|---|---|---|---|---|---|
| task-1-before-editor.png | editor shell | 1280x800 | `/?freshProject=1` | before | 2026-08-19 |
| task-1-before-welcome.png | welcome overlay | — | `/?freshProject=1&forceWelcome=1` | before | 2026-08-19 |
| task-1-before-database.png | database modal | — | `/?freshProject=1` + open database | before | 2026-08-19 |
| task-1-baseline.json.txt | gates baseline | — | `node scripts/verify-gates.mjs --save-baseline` | before | 2026-08-19 |
| task-1-index.md | manifest stub | — | — | before | 2026-08-19 |
| task-2-shell-cream.png | editor shell cream | 1280x800 | `/?freshProject=1` | after | 2026-08-19 |
| task-2-hover.png | hover row | — | hover list row | after | 2026-08-19 |
| task-2-contrast.txt | contrast matrix | — | `test/tokensContrast.test.ts` | after | 2026-08-19 |
| task-2-failing-first.txt | contrast iteration | — | — | after | 2026-08-19 |
| task-3-db-window.png | database window | — | open Database from topbar | after | 2026-08-19 |
| task-3-var-probe.txt | css var probe | — | getComputedStyle | after | 2026-08-19 |
| task-4-canvas.png | canvas area | — | `/?freshProject=1` .canvas-area | after | 2026-08-19 |
| task-4-evidence.md | ts chrome notes | — | — | after | 2026-08-19 |
| task-4-justify.txt | remaining hex justify | — | — | after | 2026-08-19 |
| task-5-allowlist.txt | sweep allowlist | — | event-editor family | after | 2026-08-19 |
| task-5-counts.txt | residual counts | — | — | after | 2026-08-19 |
| task-6-allowlist.txt | sweep allowlist | — | remaining editor | after | 2026-08-19 |
| task-6-counts.txt | residual counts | — | — | after | 2026-08-19 |
| task-6-panels-1280.png | panels | 1280x800 | map props + world panel | after | 2026-08-19 |
| task-7-allowlist.txt | sweep allowlist | — | database | after | 2026-08-19 |
| task-7-counts.txt | residual counts | — | — | after | 2026-08-19 |
| task-7-database-actors.png | database actors | 1280x800 | database window | after | 2026-08-19 |
| task-7-database-enemies.png | database enemies | 1280x800 | database window enemies tab | after | 2026-08-19 |
| task-7-database-tilesets.png | database tilesets | 1280x800 | database window | after | 2026-08-19 |
| task-7-error.png | error probe | — | — | after | 2026-08-19 |
| task-7-leak-probe.txt | modal leak probe | — | getComputedStyle body | after | 2026-08-19 |
| task-8-allowlist.txt | sweep allowlist | — | shell | after | 2026-08-19 |
| task-8-counts.txt | residual counts | — | — | after | 2026-08-19 |
| task-8-modes-beginner.png | beginner rail | — | `rpg-zzu:editor-ui-mode=beginner` | after | 2026-08-19 |
| task-8-modes-standard.png | standard | — | `rpg-zzu:editor-ui-mode=standard` | after | 2026-08-19 |
| task-8-modes-expert.png | expert | — | `rpg-zzu:editor-ui-mode=expert` | after | 2026-08-19 |
| task-8-playbtn.txt | play btn contrast | — | WCAG 1.4.11 | after | 2026-08-19 |
| task-9-allowlist.txt | sweep allowlist | — | components/map/resources | after | 2026-08-19 |
| task-9-counts.txt | residual counts | — | — | after | 2026-08-19 |
| task-10-welcome-1440.png | welcome | 1440x900 | `/?freshProject=1&forceWelcome=1` | after | 2026-08-19 |
| task-10-welcome-1024.png | welcome | 1024x768 | `/?freshProject=1&forceWelcome=1` | after | 2026-08-19 |
| task-10-contrast.txt | welcome contrast | — | computed styles | after | 2026-08-19 |
| task-11-coach.png | coach card | — | Beginner `rpg-zzu:coachmarks-basic-v1` cleared | after | 2026-08-19 |
| task-11-entry-cohesion.png | 3-up cohesion | — | welcome/recovery/editor | after | 2026-08-19 |
| task-11-pre-recovery-dbrequired.png | recovery before | — | `/` | before | 2026-08-19 |
| task-11-pre-recovery-loadfailure.png | recovery before | — | seeded legacyDb config + rest 401 | before | 2026-08-19 |
| task-11-recipe.txt | recovery recipes | — | both variants | after | 2026-08-19 |
| task-11-recovery-dbrequired.png | recovery after | — | `/` | after | 2026-08-19 |
| task-11-recovery-loadfailure.png | recovery after | — | seeded config | after | 2026-08-19 |
| wave2-literal-census.md | census | — | — | after | 2026-08-19 |

## Notes

- matrix-event-editor shots were opened via `classicCapture=2` (max 3 attempts, succeeded on first attempt for both viewports). Computed backgrounds verified as warm cream (`rgb(247,243,234)`).
- matrix-database-enemies.png tab is 몬스터 (`db-tab-enemies`, count 29).
- Inspected 4 PNGs live: shell-1440 shows warm cream `rgb(247,243,234)` body/topbar, welcome shows cream `rgb(247,243,234)` host (not black), db-required panel cream, database modal cream — no blank/loading, no black bars, no dark IDE.
