# Tile brush core verification

- Parent review: `output/evidence/sidebar-brush-adversarial-20260906/REPORT.md`.
- Browser RED: `output/evidence/sidebar-brush-fixes/red/results.json` and `red-stamps/results.json`. Exact footprint9/25, sparse line2/13, no-op redo loss, picking43/lower, stale shapes/stamp reproduced.
- Browser GREEN: `output/evidence/sidebar-brush-fixes/core-green/results.json`: all8 core scenarios PASS, browser errors0, context closed. Supervisor invoked `runSidebarBrushQa({browser,baseUrl:"http://127.0.0.1:19841",outputDir:"output/evidence/sidebar-brush-fixes/core-green",scope:"core"})` from the persistent JS kernel with installed Playwright Chromium.
- The harness derives a visible tile anchor from the actual camera and records it; fixed map coordinates in the original review are not assumed to remain visible after fixture reload. Pointer actions use engine world-to-client conversion, not a duplicate camera formula.
- Supervisor: `npm test -- test/editScenePaintHistory.test.ts test/tileBrushState.test.ts test/structureKitBrushConditions.test.ts test/tilePicking.test.ts test/upperLayerBlankPick.test.ts test/editorHotkeys.test.ts test/hotkeysTextEditingFocus.test.ts test/mapEditHistoryProjectSwitch.test.ts test/editSceneHoverPreview.test.ts --maxWorkers=4 && npm run typecheck:app`: exit0,79 tests/9 files passed.
- All changed TypeScript diagnostics clean. Supervisor corrected the new test case array to a readonly literal tuple after catching TS2322.
- Child initial unit RED26 failed/17passed; shape no-op RED2failed; final owned tests49passed. Child separately proved existing layerRouting.m1 fence expectation303/actual243 also fails on unchanged source.
- No remote project writes; freshProject remote persistence false. No product artwork/content authored.
- Pixel inspection remains unavailable: Read reports the active model cannot receive images. Screenshots are retained, but no pixel-level approval is claimed.

