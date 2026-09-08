# Original 19 failures: final dispositions

| # | File / assertion | Disposition | Evidence |
| --- | --- | --- | --- |
| 1 | `advisoryLintProvenance.test.ts`: pre-write provenance of automatic lint findings reports unchanged baseline defects without terminal repair of the real title-only change | verified fixture migration | `final-fixture-overlay.json` |
| 2 | `advisoryLintProvenance.test.ts`: pre-write provenance of automatic lint findings keeps adopted lint defects terminally blocking | verified fixture migration | `final-fixture-overlay.json` |
| 3 | `advisoryLintProvenance.test.ts`: pre-write provenance of automatic lint findings keeps introduced lint defects terminally blocking | verified fixture migration | `final-fixture-overlay.json` |
| 4 | `advisoryLintProvenance.test.ts`: pre-write provenance of automatic lint findings keeps different-identity lint defects terminally blocking | verified fixture migration | `final-fixture-overlay.json` |
| 5 | `advisoryLintProvenance.test.ts`: pre-write provenance of automatic lint findings keeps explicit lint defects terminally blocking | verified fixture migration | `final-fixture-overlay.json` |
| 6 | `advisoryLintProvenance.test.ts`: pre-write provenance of automatic lint findings keeps unknown lint defects terminally blocking | verified fixture migration | `final-fixture-overlay.json` |
| 7 | `aiWorkItemStall.test.ts`: 진행이 멈춘 항목은 사람에게 넘긴다 (a)(b) 같은 항목에서 연속 3번 헛되이 나가면 blocked 로 표시하고 턴을 끝낸다 — 드라이버도 멈춘다 | baseline failure retained | `baseline-d2be-stall.json` |
| 8 | `aiWorkItemStall.test.ts`: 진행이 멈춘 항목은 사람에게 넘긴다 (a-2) 같은 쓰기 툴이 같은 이유로 반복 실패하면 Ralph 신호 없이도 막힌다 | baseline failure retained | `baseline-d2be-stall.json` |
| 9 | `aiWorkItemStall.test.ts`: 진행이 멈춘 항목은 사람에게 넘긴다 (c) 사용자의 다음 메시지가 막힌 항목을 되살린다 | baseline failure retained | `baseline-d2be-stall.json` |
| 10 | `assistantAcceptanceRequestBaseline.test.ts`: per-request acceptance baselines preserves a map created in A while B changes another map | verified fixture migration | `final-fixture-overlay.json` |
| 11 | `assistantAcceptanceRequestBaseline.test.ts`: per-request acceptance baselines does not credit A's change toward a newly accepted B change promise | verified fixture migration | `final-fixture-overlay.json` |
| 12 | `assistantAcceptanceRequestBaseline.test.ts`: per-request acceptance baselines late adoption cannot baseline away B's earlier write (completed=false) | verified fixture migration | `final-fixture-overlay.json` |
| 13 | `assistantAcceptanceRequestBaseline.test.ts`: per-request acceptance baselines late adoption cannot baseline away B's earlier write (completed=true) | verified fixture migration | `final-fixture-overlay.json` |
| 14 | `assistantAcceptanceRequestBaseline.test.ts`: per-request acceptance baselines retains B's pre-write baseline across budget-driven synthetic continuation | verified fixture migration | `final-fixture-overlay.json` |
| 15 | `assistantAcceptanceRequestBaseline.test.ts`: per-request acceptance baselines retains B's baseline when a manual continuation repairs and replans an unapplied draft | verified fixture migration | `final-fixture-overlay.json` |
| 16 | `authoredSoftConfirmReviewEquality.test.ts`: direct soft-confirm route reviews the normalized values and applies them equally | verified fixture migration | `soft-confirm-green.json` |
| 17 | `authoredWorldReviewApplication.test.ts`: npc cast review apply undo preserves existing manual/locked wiki plus the new graph | verified fixture migration | `final-fixture-overlay.json` |
| 18 | `authoredWorldReviewApplication.test.ts`: a newer manual wiki document during the held review is preserved, never lost | verified fixture migration | `final-fixture-overlay.json` |
| 19 | `eventValidationNavigationContract.test.ts`: validation navigation at the rendered modal seam removes its document listener and layer immediately when the parent closes | baseline failure retained | `baseline-72f-navigation.json` |
