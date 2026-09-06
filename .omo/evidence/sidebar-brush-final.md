# Sidebar and tile brush delivery evidence

Product verification and review are complete. Repository-wide gates remain red; the inherited failures and full-run-only timeouts are documented below rather than reported as a whole-suite pass.

## Delivered behavior

| Criterion | Observable proof | Artifact |
| --- | --- | --- |
| C1 exact brush size | 2x2 writes 4 cells; 4x4 writes 16; unit coverage includes sizes 1-4, erase, clipping and hover | output/evidence/sidebar-brush-fixes/summary.json |
| C2 continuous strokes | A sparse 13-cell stroke fills 13 cells and one undo restores it; reverse, diagonal and edge tests pass | summary.json and test/editScenePaintHistory.test.ts |
| C3 no-op history | Zero-change paint/fill/erase/shape/blocked stamp preserves redo; redo restores the prior stroke | summary.json and history/brush tests |
| C4 visible controls | Unique size controls and active tool/shape/stamp/layer in all modes; 9 viewports with canvas width at least 520px | summary.json and committed viewport PNGs |
| C5 selected representative | Picked tile 423 retains its paint ID while representative 363 stays selected under search | summary.json |
| C6 picking parity | Toolbar and right-click both select tile 85 on upper at the same composed cell; upper-empty regression retained | summary.json and test/tileBrushState.test.ts |
| C7 search feedback | Zero matches, selected-outside-filter explanation, reset and restored search focus | summary.json and C7-beginner-search.png |
| C8 source/stamp transitions | Source drag selects and places exact cells; rect/round kit selection and B/1/Paint reset pass | summary.json |
| C8 mixed layers | Upper tiles 285/286 and lower tiles 289/290 stay unchanged rather than replacing 286 with 260 | mixed-isolated/results.json |

The final summary has 13 passing scenario receipts. RED receipts remain under red/ and red-stamps/. Two later defects (source autotile rewriting and mixed-layer tree repair) were independently locked RED before correction; regression tests assert exact authored cells through the real engine. Multi-cell preservePattern bypasses automatic postprocessing; ordinary brushes and single-cell stamps retain existing behavior.

## Verification already completed

- Supervisor core regression: 79 tests across 9 files and typecheck:app, exit 0.
- Supervisor UI regression: 95 tests across 13 files and typecheck:app, exit 0.
- Supervisor final source/mixed-stamp regression: 82 tests across 5 files and typecheck:app, exit 0. These runs overlap; they are not summed as unique tests.
- Full npm run build after the final production correction: exit 0 (editor, player and standalone).
- CSS gate: exit 0, with no failures. Changed TS/JS LSP diagnostics are clean. CSS/JSON LSP is unavailable because Biome is absent; no dependency was added just for that tool.
- Existing left-sidebar-adversarial Playwright regression: 1 passed, covering all 9 mode/viewport layouts, map-list minimum height of 108px, tool reachability, roving focus and flyout dismissal.
- Browser scenario data/interaction checks: 13 PASS, empty error arrays and closed contexts. The 13 committed PNGs have valid signatures and dimensions.

## Repository-wide gate

The composite `taskset -c 0-15 npm run gates -- --json` reached its 30-minute monitor deadline without a completed test report. The full scope was then run through the script's public split interfaces, with no test exclusion or expectation changes.

- `npm run gates -- --only tests --json`: exit 1; 14,509 tests across 1,608 files, with 14,256 passing, 238 failing and 15 existing pending tests. All 74 tests in the six changed test files passed in this full run.
- The September 2 recorded baseline flagged 44 newly failing files. Two were covered by the surface comparison below. The remaining 42 files were replayed on unchanged commit d81ab7be: 306 tests passed and 45 failed, reproducing 45 current failures.
- The other 51 failed assertions were isolated on the unchanged current code. A 19-file replay passed 48 of them. The remaining three hit the 15-second cold-import deadline; paired, unchanged single-worker runs of their three files passed all 16 tests on both base and current. No timeout limit, test expectation, or baseline was changed.
- `npm run gates -- --only surface --json`: exit 1, with six failed assertions and 107 passing tests. The same command on d81ab7be had exactly the same failed test names and assertion text. These are existing event-editor AI-image-queue/species snapshot differences.
- Typecheck and CSS stages passed, as recorded above. The known layerRouting fence mismatch (expected 303, actual 243) was also reproduced on unchanged source.

Evidence: `tests-current.json`, `test-classification.json`, `surface-current.json`, `surface-baseline.json`, and `surface-comparison.json` under output/evidence/sidebar-brush-fixes. The whole suite is not green. Every new baseline flag was nevertheless accounted for by a before-change reproduction or a passing focused rerun on the unchanged current code; no reproducible new assertion failure remains.

## Independent review

Initial full code/scenario review found only C8 mixed-layer tree repair as a blocker. That case was reproduced, fixed and browser-verified. The original reviewer was evicted and could not resume; a bounded replacement delta review returned APPROVE with no blockers. Records are preserved at output/evidence/sidebar-brush-fixes/sidebar-brush-gate-review.md and sidebar-brush-delta-review.md. No pixel-level approval was claimed by either review.

## Cleanup and scope

All owned browser contexts, browsers and QA servers were closed. Port 19841 was verified empty. Both implementation worktrees and the locked review worktree were removed after preserving their changes and reports. The isolated Vite cache was deleted. No remote project writes, content delivery, deployment, PR merge, history rewrite or unrelated fixes were performed. The durable notepad is /tmp/ulw-20260906-160440.3NgH3D.md.

## Visual limitation

Read cannot deliver screenshot pixels to the available review models in this session. Actual DOM geometry, clicks, drags, keyboard behavior and map-data effects were verified; color harmony, glyph clipping and aesthetic fidelity are not certified. The screenshots are committed for an image-capable reviewer.

## Verified increments

- d6376db3 fix(editor): make tile strokes exact and preserve no-op history
- 574c9f78 fix(editor): expose brush state and preserve palette stamps
- 5a85fd68 fix(editor): preserve mixed-layer source stamps during repair
