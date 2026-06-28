# NPC Move Route Final QA Matrix After Review Blocker Fixes

Date: 2026-06-29

## Browser Evidence

- PASS: Event editor desktop layout restored after style scope regression.
  - Screenshot: ui-style-scope-event-editor-fixed-final.png
  - Metrics: ui-style-scope-event-editor-fixed-final-metrics.json
- PASS: Korean Move Route popup opens from 이동 유형=사용자 지정.
  - Screenshot: ui-style-scope-move-route-dialog-final.png
  - Metrics: ui-style-scope-move-route-dialog-final-metrics.json
  - Evidence: 42 command buttons, 43 command-list rows after adding all commands.
- PASS: Runtime NPC movement captured across many frames.
  - Screenshots: ui-fixed-runtime-moving-01.png through ui-fixed-runtime-moving-16.png
  - Metrics: runtime-route-summary.json, qa-runtime-route-analysis.json

## Review Blocker Fixes

- PASS: Bounded manifest now includes src/player/playSceneMapCommands.ts and all focused relevant route files.
  - Manifest: bounded-diff-manifest-after-review-blocker-fixes.json
- PASS: Runtime route tests split into focused files under 250 pure LOC.
  - Line counts: line-count-after-review-blocker-fixes.json
- PASS: Production event route/editor files no longer use the flagged HTML input/select type assertions.
- PASS: Move route runtime dispatch now exhaustively lists MoveCommand variants and removes the flagged nested ternary route logic.

## Automated Verification

- PASS: npm run typecheck
  - Log: typecheck-after-review-blocker-fixes.txt
- PASS: split Vitest runtime/migration suite
  - Log: green-vitest-runtime-split-after-review-blocker-fixes.txt
  - Result: 4 files, 33 tests passed.
- PASS: focused Playwright move route suite
  - Log: green-playwright-move-route-focused-after-review-blocker-fixes.txt
  - Result: 1 test passed.
- PASS: broader Playwright event pages suite
  - Log: green-playwright-event-route-after-review-blocker-fixes.txt
  - Result: 2 tests passed.
- PASS: broader Playwright event commands suite
  - Log: green-playwright-command-route-after-review-blocker-fixes.txt
  - Result: 7 tests passed.
- PASS: npm run build
  - Log: build-after-review-blocker-fixes.txt
