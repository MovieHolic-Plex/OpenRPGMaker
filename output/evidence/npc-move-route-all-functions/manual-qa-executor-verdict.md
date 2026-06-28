# Manual QA Executor Verdict

Verdict: PASS
Confidence: High
Date: 2026-06-28

## surfaceEvidence

| scenario id | criterion reference | surface | exact invocation | verdict | artifactRefs |
|---|---|---|---|---|---|
| S1 | V1 live app reachable | HTTP app root | `curl.exe -i http://127.0.0.1:5173/` | PASS | A1 |
| S2 | V2 move route popup has 42 command buttons and 43 rows after adding all commands | Browser UI, Playwright Chromium | `npx.cmd playwright test test/e2e/rm2k3-event-commands.spec.ts -g "move event route editor persists route steps"` | PASS | A2, A3, A4 |
| S3 | V2 Korean move route popup labels and no broken layout | Browser screenshot artifact | OS image viewer inspection of `ui-style-scope-move-route-dialog-final.png` | PASS | A3, A4 |
| S4 | V3 NPC movement works in play mode with multiple unique positions | Runtime state JSON and screenshots | JSON inspection of `runtime-route-summary.json` and `qa-runtime-route-analysis.json`; OS image viewer inspection of runtime screenshots | PASS | A5, A6, A7, A8 |
| S5 | V4 final event editor desktop layout repaired; movement type/speed visible above footer | Browser screenshot artifact | OS image viewer inspection of `ui-style-scope-event-editor-fixed-final.png` and JSON metrics inspection | PASS | A9, A10 |
| S6 | V5 supporting green regression suite | CLI transcript artifacts | Existing log inspection: typecheck, Vitest runtime migration, Playwright event route, Playwright command route, build | PASS | A11, A12, A13, A14, A15 |

## adversarialCases

| scenario id | criterion reference | adversarial class | expected behavior | verdict | artifactRefs |
|---|---|---|---|---|---|
| A-C1 | V2 command completeness | All route command buttons inserted into one route | 42 buttons add 42 commands, producing 43 rows including `$>` root | PASS | A2, A4 |
| A-C2 | V2 long route list layout | Overflow route list after all commands | Dialog remains usable; command list scrolls instead of breaking layout | PASS | A3, A4 |
| A-C3 | V2 CJK UI integrity | Korean labels in dense RM2K-style popup | Labels render as Korean text without visible clipping/overlap in screenshot | PASS | A3 |
| A-C4 | V3 runtime movement validity | NPC should not remain stationary through route playback | Runtime captures show 14 unique coordinates and 14 changed transitions across 16 frames | PASS | A5, A6, A7, A8 |
| A-C5 | V4 footer regression | Movement controls should not be hidden by footer | Metrics report movement type and speed above footer; screenshot confirms visibility | PASS | A9, A10 |

## artifactRefs

| id | kind | description | path |
|---|---|---|---|
| A1 | HTTP transcript | Fresh live app reachability result with `200 OK` and Korean HTML shell | `output/evidence/npc-move-route-all-functions/manual-qa-curl-root.txt` |
| A2 | Playwright transcript | Fresh focused Chromium rerun of move route editor persistence scenario, 1 passed | `output/evidence/npc-move-route-all-functions/manual-qa-rerun-playwright-route-editor.txt` |
| A3 | Screenshot | Final Korean move route dialog showing buttons and route list | `output/evidence/npc-move-route-all-functions/ui-style-scope-move-route-dialog-final.png` |
| A4 | JSON metrics | Move route dialog metrics: `buttonCount: 42`, `rowCount: 43`, `listScrolls: true` | `output/evidence/npc-move-route-all-functions/ui-style-scope-move-route-dialog-final-metrics.json` |
| A5 | Runtime JSON summary | Runtime state series for captured NPC positions | `output/evidence/npc-move-route-all-functions/runtime-route-summary.json` |
| A6 | Runtime analysis JSON | `uniqueCoordinateCount: 14`, `changedTransitionCount: 14`, `routeMoveCount: 42` | `output/evidence/npc-move-route-all-functions/qa-runtime-route-analysis.json` |
| A7 | Screenshot | First runtime moving NPC capture | `output/evidence/npc-move-route-all-functions/ui-fixed-runtime-moving-01.png` |
| A8 | Screenshot | Later runtime moving NPC capture with changed NPC position | `output/evidence/npc-move-route-all-functions/ui-fixed-runtime-moving-16.png` |
| A9 | Screenshot | Final event editor desktop layout with movement controls above footer | `output/evidence/npc-move-route-all-functions/ui-style-scope-event-editor-fixed-final.png` |
| A10 | JSON metrics | Event editor layout metrics: movement type/speed above footer true | `output/evidence/npc-move-route-all-functions/ui-style-scope-event-editor-fixed-final-metrics.json` |
| A11 | CLI transcript | TypeScript check after final event editor fix | `output/evidence/npc-move-route-all-functions/typecheck-after-final-event-editor-fix.txt` |
| A12 | CLI transcript | Vitest runtime migration after final event editor fix | `output/evidence/npc-move-route-all-functions/green-vitest-runtime-migration-after-final-event-editor-fix.txt` |
| A13 | CLI transcript | Playwright event route after style scope fix | `output/evidence/npc-move-route-all-functions/green-playwright-event-route-after-style-scope-fix.txt` |
| A14 | CLI transcript | Playwright command route after final event editor fix | `output/evidence/npc-move-route-all-functions/green-playwright-command-route-after-final-event-editor-fix.txt` |
| A15 | CLI transcript | Build after final event editor fix | `output/evidence/npc-move-route-all-functions/build-after-final-event-editor-fix.txt` |

## test_results

- Live HTTP root: PASS, returned `HTTP/1.1 200 OK`.
- Focused Playwright route editor rerun: PASS, `1 passed`.
- Existing full command-route Playwright log: PASS, `7 passed`.
- Existing event-route Playwright log: PASS, `2 passed`.
- Runtime route analysis: PASS, 14 unique NPC coordinates and 42 route moves.
- Event editor layout metrics: PASS, movement type and speed above footer.

## blocking_issues

None.
