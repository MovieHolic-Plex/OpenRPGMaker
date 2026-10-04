# Full-window first arrival

## Correction

The previous scene had a rounded boundary, the editor constrained it to 1060px, and the launcher placed white chrome/settings outside it. The corrected scene covers the entire viewport behind the header, input and secondary routes. Only content width is constrained. The composer uses the existing cinema palette, and short desktop windows use compact spacing.

Owners provide an isolated stack: `.start-app.is-first-world` and `.editor-welcome-first-world`. The shared scene background is fixed to the viewport. Launcher example/recent/team routes remove the scene context; editor cancellation/save behavior remains in the existing owner.

## Browser evidence

Command:

```sh
FIRST_WORLD_CAPTURE_DIR=verify-shots/first-world-fullscreen node scripts/capture-first-world-arrival.mjs
```

All 11 browser checks completed with no page errors or missing scene assets. `browser.json` records the scene bounds exactly matching all four viewport edges at 320×780, 1280×720, 1440×900 and 1920×1080. Desktop 1280×720 and 1440×900 have no page scroll after the first input opens. The primary action is in view at both compact and wide sizes.

The existing checks also cover cancellation/draft retention, launcher handoff, confirmed genre change, manual save waiting, returning-author continuation, reduced motion and en/ja/zh. The script waits for all initial card images before capture. PNGs capture the actual viewport rather than stitching a full scrolling page.

Screenshots:

- `01-launcher.png`: first world choices.
- `02-first-input.png`: actual launcher, 1440×900.
- `03-editor-arrival.png`: actual editor welcome, 1440×900.
- `04-mobile.png`: current mobile viewport after choosing a world and focusing the first sentence.
- `05-english.png`: English first input.
- `06-fullscreen-wide.png`: 1920×1080.
- `07-fullscreen-compact.png`: 1280×720.

## Scope

Final `npm run build:app` on the completed change: exit 0, built in 1m 16s. `git diff --check` is clean.

The real production components run against isolated bridge/connection/save callbacks. No live AI generation or canonical SQLite writes are performed. No local vitest, gates or full typecheck were run under the session's AGENTS restriction.
