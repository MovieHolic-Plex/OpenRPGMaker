# Skill: browser-verify

> **Status:** 현행 운영 문서. 참조 스크립트(`browser-verify-genre-presets.mts`)·포트(9999) 실재 확인됨 (2026-07-21).

Browser verification for RPG ZZU. Opens Chromium against the Vite app, exercises a named flow, and saves screenshots + `manifest.json` under `output/evidence/`.

## When to use

- Prove a UI flow works end-to-end (welcome, genre presets, editor boot, AI dock).
- Collect visual evidence packs (e.g. 50+ screenshots for genre preset runs).

## Prerequisites

1. `npm run dev` → `http://127.0.0.1:9999/` (**HTTP only**, not HTTPS)
2. Playwright Chromium available (`npx playwright install chromium` if needed)

## Commands

```bash
# Genre preset pipeline evidence (target >= 50 PNGs)
npm run browser-verify:genre

# or
npx tsx scripts/browser-verify-genre-presets.mts
```

Custom base URL (PowerShell):

```powershell
$env:BASE_URL="http://127.0.0.1:9999"; npm run browser-verify:genre
```

## Output layout

```
output/evidence/genre-presets/
  manifest.json
  shared/                 # free-text, skip, slideshow
  monster-collect/        # chip pipeline
  partner-raise/
  farm-life/
  adventure-jrpg/
```

## Conventions

- Clear `localStorage["rpg-zzu:editor-welcome-dismissed"]` before welcome flows.
- Use `?forceWelcome=1` so Playwright `navigator.webdriver` does not suppress the welcome overlay (`isAutomationBootContext` override).
- Prefer `data-testid` (`editor-welcome`, `editor-welcome-chip-*`, `app-modal-confirm`, `ai-input`).
- Do not set `blankProject` / e2e project inject when testing welcome.
- Exit 0 only when at least 50 successful screenshots exist.
- Confirm modal must sit above welcome (`.app-modal-overlay` z-index > 240).

## Related code

- Welcome UI: `src/editor/editorWelcome.ts`
- Genre templates: `src/editor/welcomeGenrePresets.ts`
- Boot pipeline: `src/app/mode.ts`, `src/editor/aiBootIntent.ts`
- Script: `scripts/browser-verify-genre-presets.mts`
