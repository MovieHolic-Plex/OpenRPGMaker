# First world → first AI sentence

## Implemented flow

- First-time launcher Home and New Game show three world previews; returning authors keep their recent-project continuation.
- Selecting a world opens the first sentence and changes the background. Only explicit submission creates the launcher folder or opens the editor connection/planning flow.
- The first sentence reaches the existing handoff/interview unchanged. Editor connection/interview cancellation and launcher creation failure retain the draft.
- Game name, save location and resolution are available in a collapsed section. Existing example, blank and confirmed manual paths remain accessible.

## Actual browser evidence

Command: `node scripts/capture-first-world-arrival.mjs` with `npm run dev:worktree` on port 9813.

The script uses the real launcher entry and shared/editor components with isolated bridge, connection and save callbacks. All 10 checks completed; `browser.json` records no page errors or missing scene assets.

- Preview selection makes no create/connection call. Empty sentences cannot submit.
- Genre changes and creation failure retain the original sentence. Example and blank routes are accessible.
- Launcher session handoff carries the exact sentence, selected engine, name and AI mode.
- Editor connection decline and interview cancellation retain both draft and selection.
- Confirming a different interview genre applies the confirmed engine and preserves the original concept.
- Manual cancellation never applies; pending confirmed save blocks dismissal and does not connect AI.
- 320px layout has no horizontal overflow or controls outside the viewport. Reduced motion pauses the film; focus is visible.
- Returning authors retain the primary continue action.
- English, Japanese and Chinese chrome and example sentences are translated.

Screenshots: `01-launcher.png`, `02-first-input.png`, `03-editor-arrival.png`, `04-mobile.png`, `05-english.png`.

## Build and limits

Final `npm run build:app`: exit 0, built in 1m 52s. Existing chunk-size, mixed-import and dependency annotation warnings remain.

No local vitest, gates or full typecheck were run, following the session's AGENTS restriction. Updated unit/E2E specs and the existing Electron probe were authored but not executed. These browser callbacks make no live AI calls or canonical SQLite writes; this evidence does not establish packaged Electron behavior or save/reload correctness.
