# Manual QA Matrix - Route Quality Refactor

Status: PASS pending external review
Generated: 2026-06-29T00:57:24.0020279+09:00

| Area | Evidence | Result |
| --- | --- | --- |
| Event editor desktop layout | ui-style-scope-event-editor-fixed-final.png / metrics | PASS |
| Korean move route dialog | ui-style-scope-move-route-dialog-final.png / metrics 42 buttons, 43 rows | PASS |
| Event command move route body | ui-style-scope-command-route-body.png / command-route metrics | PASS |
| Runtime autonomous NPC movement | runtime-route-summary.json, qa-runtime-route-analysis.json, moving screenshots 01/08/16 | PASS |
| TypeScript typecheck | typecheck-after-route-quality-refactor.txt | PASS |
| Runtime route unit coverage | green-vitest-after-route-quality-refactor.txt, 33 tests | PASS |
| Focused route browser E2E | green-playwright-focused-after-route-quality-refactor.txt, 1 test | PASS |
| Event pages regression E2E | green-playwright-event-pages-after-route-quality-refactor.txt, 2 tests | PASS |
| Event commands regression E2E | green-playwright-event-commands-after-route-quality-refactor.txt, 7 tests | PASS |
| Production build | build-after-route-quality-refactor.txt | PASS |
| Code smell scan | route-quality-slop-scan-after-refactor.json | PASS |
| Bounded diff artifact | bounded-diff-after-route-quality-refactor.patch includes 25 / 25 manifest files | PASS |
