# Before-mode UX audit: NEEDS WORK

Read-only executable QA by st_01a07387. No production source edits or remote project writes. The lead owns the retained server.

## Verdict and score /100

Scores are engineering UX judgments supported by browser actions and measured DOM geometry, not an independent visual-design certification.

| Rubric | Weight | Beginner | Standard | Expert |
|---|---:|---:|---:|---:|
| Real tile selection, painting, undo and retained state | 30 | 28 | 30 | 30 |
| Discoverability and repeated painting workflow | 25 | 12 | 19 | 17 |
| Accessibility and control targets | 20 | 13 | 12 | 12 |
| Canvas budget and supported narrow layout | 15 | 13 | 10 | 9 |
| Meaningful mode differentiation | 10 | 7 | 6 | 3 |
| **Total** | **100** | **73** | **77** | **71** |

All modes can paint. Beginner interrupts the palette workflow and hides undo; expert gives up canvas width without a materially stronger tile-work surface. Approve the bounded redesign, not a paint-engine rewrite.

## Actual execution coverage

- 1024x768: full **beginner -> standard -> expert -> beginner** round-trip completed. In every state: physical palette click selected tile 7; a physical map click changed one lower tile from 240 to 7; upper tiles were unchanged; Ctrl+Z restored the exact complete map object. Another physical stroke was retained, and every subsequent mode switch preserved the map exactly.
- Narrow paint cells, in order: indices 64, 63, 65, 66. Paint client coordinates: (372,319), (456,319), (530,319), (436,319).
- 1280x800: all three modes selected, painted and exactly undid successfully. All three mode transitions retained state; returned beginner geometry and palette were captured. Its final paint result was **inconclusive**, because the first harness read the asynchronously refreshed hidden export mirror immediately after the store event. The narrow run corrected the oracle to read the live store, and passed the full cycle. Do not report an editor paint failure from that initial harness artifact.
- Search in every narrow mode retained focus and the insertion caret: fill `7`, Home, type `1` -> value `17`, caret 1. Palette ArrowRight moved focus from tile 7 to tile 10; keyboard Enter activation worked.
- Full-image screenshots: 16 narrow screenshots and 14 desktop screenshots, plus exploratory/failure captures. File signatures and requested dimensions checked. See naming below.

## Concrete findings and bounded fixes

### 1. Beginner selection destroys the working palette (high)

Every physical click on `basic-tile-7` returned selectedTile=7 and `basic-tile-grid` no longer visible. Repeated material changes require reopening the tile flyout. The existing pin is only a 26x24 icon control (`basic-flyout-pin`, title `열어두기(고정)`), so persistence is an extra discovery task rather than the natural paint flow.

Owner chain: `tilePalette.ts` -> `basicLeftRail.ts` / `basicRailFlyout.ts` -> `basicTilePalette.ts` shared grid. Preserve shared tile selection/layer rules rather than inventing a second palette.

**Fix:** persistent labeled beginner palette with visible selected tile and search; keep Maps as a flyout. The proposed 288px panel is reasonable provided narrow canvas/palette hit-testing is retained. At 1024px it necessarily trades about 216px of the current 952px canvas width for persistent materials; do not claim it increases raw canvas area.

Evidence: `1024-0-beginner-palette.png`, `1280-0-beginner-palette.png`, `combined-action-log.json` palette-click entries. Palette screenshots show the explicitly reopened palette, not a false claim that it survived selection.

### 2. Beginner hides the recovery action (high)

Visible-control enumeration contains **no undo button** in initial or returned beginner. Ctrl+Z works, but the equivalent `oprn-tool-undo` is visible in standard/expert (28x28). Beginner is therefore the mode most dependent on prior shortcut knowledge after a mistake.

**Fix:** put a labeled undo button beside daily beginner paint tools, invoking the existing history action. Do not fork history.

### 3. Expert tile workflow is mostly standard plus 20px (medium)

Measured left widths: standard 300px, expert 320px at both viewport sizes. Both expose the same `oprn-tool-overflow` (28x28), shared tile grid, search and undo. Source `editorUiMode.ts` gives both technical layer terms and dense canvas chrome; expert mainly changes topbar tool exposure/event jargon, not the tested tile task.

**Fix:** retain standard daily tools; expert should surface a bounded set of genuine advanced actions (inspector/rules/history) directly, using existing owners, rather than duplicating the same overflow. This is a recommendation, not a claim that those advanced workflows were executed here.

### 4. Narrow topbar pushes controls offscreen after local-fixture save error (medium, fixture-conditioned)

At 1024px in standard, AI settings starts x=1018.84, width 32, so its center misses the viewport; fullscreen starts x=1052.84. Expert: x=1030.72 and x=1064.72 respectively. Both fail center hit-test. Captures were taken after painting causes this intentionally local-only fixture to show the expanded save-error chrome, so this finding is conditional on that error state, not an assertion that normal online save always overflows.

**Fix:** constrain the save-error cluster / move its detail to a bounded popover without removing error feedback; ensure trailing actions remain inside 1024px. Keep this separate from the core palette redesign if scope is tight.

Evidence: `1024-1-standard-default.png/.json`, `1024-2-expert-default.png/.json`.

### 5. Small palette utility targets and unlabeled canvas (medium)

Standard/expert measured tile-reveal height 18.39px, tileset-name height 17.19px, auto-connect 40x22, map row menu 20x20. The Phaser canvas has no role, aria-label or tabindex in all modes. Palette buttons are keyboard navigable, but the painting surface does not offer a labeled focus entry in DOM. This is **not** a full WCAG audit and no screen reader was run.

**Fix:** raise utility targets to at least 24px; retain tooltips and keyboard grid. Give the map surface a useful accessible name/focus strategy only with existing keyboard ownership preserved; do not casually add global key handling.

## Canvas comparison

Raw canvas rectangles include areas potentially occluded by assistant/flyouts; these are not unoccluded map-area claims. Initial beginner assistant was open, then collapsed through `ai-collapse` for paint comparisons; subsequent mode captures retain that collapse preference.

| Viewport | Beginner | Standard | Expert |
|---|---|---|---|
| 1280x800 | 1208x677 (79.9% viewport) | 974x677 (64.4%) | 954x677 (63.1%) |
| 1024x768 | 952x645 (78.1%) | 718x645 (58.9%) | 698x645 (57.2%) |

Returned beginner restored the exact 72px rail and original canvas start x=72: no retained wide-panel geometry regression. Standard/expert canvas starts x=306/x=326. The fixture has one map, so the measured 93px map-list viewport is not evidence of multi-map clipping.

## Evidence and replay

- `combined-action-log.json`: both attempts, preserving the desktop inconclusive final paint explicitly.
- `action-log.json`: final successful narrow run, no uncaught page errors. For incremental retained-cell counts use `combined-action-log.json` or console `audit.log`; the original action-log retained arrays share a mutable reference and display final accumulated indices.
- `audit.log`: completed narrow run and console/network receipts.
- `audit-initial-attempt.log`: desktop mode/paint/undo and the initial mirror-oracle failure.
- `network-failure.log`: Chromium `ERR_NETWORK_CHANGED` during direct Vite module imports, leading to a boot timeout. Not a production source import bug.
- `{1024|1280}-{0|1|2|3}-{beginner|standard|expert}-{default|palette|painted|undone}.png`: actual surface captures. Desktop step 3 has default/palette only.
- Matching default/palette JSON: exact geometry, control labels, focusability, hit tests and clipping candidates.
- `browser-cleanup.json`: browser closed; user browser never used.
- `audit.mjs`: reusable bootstrap and real-input audit. Run `QA_NARROW_ONLY=1 node output/evidence/mode-ux-before/audit.mjs` for the completed bounded scenario. Default runs both sizes and overwrites evidence; copy or change output path before after-proof.

Working QA URL: **http://127.0.0.1:29887/?blankProject=1** (map URL sync appends `&map=map_blank_start`).

Bootstrap: independent Chromium context; localStorage `oprn:editor-ui-mode=beginner`, `oprn:coachmarks-basic-v1=1`, `oprn:standard-welcome-seen=1`. Wait for `.phaser-container canvas`, then the actual scene readiness hook. Do not interpret `edit-canvas` host visibility alone as Phaser readiness.

Selectors:
- Mode switch: `workspace-panels-button` then `workspace-ui-mode-beginner|standard|expert`.
- Tools: `tool-paint`, `layer-lower`, `oprn-tool-undo` (not present in beginner before).
- Beginner palette: `basic-rail-toggle-tiles`, `basic-tile-grid`, `basic-tile-7`, `basic-tile-search`, `basic-flyout-close`, `basic-flyout-pin`.
- Standard/expert: `chipset-tile-7`, `tile-search-input`, `oprn-tool-overflow`.
- Canvas: `.phaser-container canvas`; geometry read hook `window.__oprnEditWorldToClient(worldX,worldY)` and `__oprnEditCamera()`.
- Read-only exact state: dynamic import `/src/project/store.ts` -> `store.getCurrent()`, `/src/editor/editorState.ts` -> `editorState.get()`. Subscribe to store before click/undo, await bounded event, read authoritative state. `project-export-json` is useful for inspection but can lag an immediate mutation.

The final bootstrap proxies local GETs through Node fetch to avoid Chromium network-change failures, while rendering and clicking remain real Chromium. Non-GET/HEAD/OPTIONS requests are blocked; the final log records nine blocked requests, including activity telemetry. No remote project write was allowed. Vite HMR websocket local-network restrictions remain a harness limitation; this does not affect the captured unchanged-source pass.

## Limits and ownership

The image tool explicitly reports this model cannot view image contents. Screenshots were captured and PNG signatures/dimensions validated, but compositing quality, aesthetics and CJK raster-level precision need the lead's visual review; no independent oracle tool was available in this child. Therefore this is a functional/geometry-backed **NEEDS WORK**, not a pixel-level visual PASS.

Production source remains untouched by this QA child. All own browser resources are closed. The lead explicitly accepted server ownership: `/tmp/mode-ux-st01a07387-server-29887.pid` and `/tmp/mode-ux-st01a07387-server-29887.log`. Leave that server running. The unrelated server on 9841 and existing user Chrome on 9222 were untouched.
