# NPC Move Route Final QA Matrix

Date: 2026-06-28

## Browser Evidence

- PASS: Event editor desktop layout restored after style scope regression.
  - Screenshot: ui-style-scope-event-editor-fixed-final.png
  - Metrics: ui-style-scope-event-editor-fixed-final-metrics.json
  - Evidence: window 1476x936, movement type and movement speed above footer, settingsScrolls=false.
- PASS: Korean Move Route popup opens from 이동 유형=사용자 지정.
  - Screenshot: ui-style-scope-move-route-dialog-final.png
  - Metrics: ui-style-scope-move-route-dialog-final-metrics.json
  - Evidence: 42 command buttons, 43 command-list rows after adding all commands, list scrolls internally.
- PASS: Event command route body remains usable.
  - Screenshot: ui-style-scope-command-route-body.png
  - Metrics: ui-style-scope-command-route-metrics.json
- PASS: Runtime NPC movement captured across many frames.
  - Screenshots: ui-fixed-runtime-moving-01.png through ui-fixed-runtime-moving-16.png
  - Metrics: runtime-route-summary.json, qa-runtime-route-analysis.json

## Automated Verification

- PASS: npm run typecheck
  - Log: typecheck-after-final-event-editor-fix.txt
- PASS: vitest runtime/migration suite
  - Log: green-vitest-runtime-migration-after-final-event-editor-fix.txt
  - Result: 2 files, 33 tests passed.
- PASS: Playwright event pages suite
  - Log: green-playwright-event-route-after-style-scope-fix.txt
  - Result: 2 tests passed.
- PASS: Playwright event commands suite
  - Log: green-playwright-command-route-after-final-event-editor-fix.txt
  - Result: 7 tests passed.
- PASS: npm run build
  - Log: build-after-final-event-editor-fix.txt

## Notes

- One transient full-file Playwright run failed at picker close timing; the single failing route test passed immediately afterward, and the full event-commands suite passed on rerun. Final green log is green-playwright-command-route-after-final-event-editor-fix.txt.
- The working tree contains unrelated pre-existing edits. Review and gate evidence is bounded by bounded-diff-manifest-after-final-event-editor-fix.json.
