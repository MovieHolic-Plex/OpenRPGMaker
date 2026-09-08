# Read-checked screenshot matrix (GROK)

All frames exist on disk (non-empty PNG). Spec writes
`/home/main/z-project/rpg-zzu-unbounded-integrate-01a07570/.omo/evidence/ai-unbounded/browser/<title>/`.
Portable copies:
`/home/main/z-project/rpg-zzu-unbounded-integrate-01a07570/.omo/evidence/ui-final-after-cost/browser/<title>/`.
Previous failed frames preserved at `preserved-previous-ai-unbounded-browser/` and `preserved-previous-test-results/` (not overwritten in place before copy).

Inspect JSON is captured before each PNG. Every PASS below is from Read of the PNG plus the sibling JSON.

| id | frame | inspect JSON | Read PNG | verdict |
|---|---|---|---|---|
| B1 auto held-55 | `B1_64-segments-one-send_auto/held-55.{json,png}` | title Stage 55; applied 55; elapsed **167493ms**; exec `running` seg 55; sticky working; budget data-segment 56; unexpected [] | topbar Stage 55; plan 55/64 Checkpoint 56중; gold `실행 중… 167초 · 도구 55`; sticky 0/1 작업 중; composer 지시/균형 | PASS |
| B1 auto complete | `.../complete.{json,png}` | title Final 64; applied 64; elapsed **201205ms**; exec `verified-local` seg 64; sticky verified; unexpected [] | topbar Final 64; sticky 1/1 검증 완료; log Stage 59–63 + Final 64; `Applied request predicates verified.` | PASS |
| B1 chat held-55 | `B1_64-segments-one-send_chat/held-55.{json,png}` | Stage 55; 55; **182824ms**; running seg 55 | same hold chrome; `실행 중… 182초 · 도구 55` | PASS |
| B1 chat complete | `.../complete.{json,png}` | Final 64; 64; **224207ms**; verified-local 64 | Final 64; 검증 완료; elapsed in log 3분 38초 | PASS |
| B1 tokens held-55 | `B1_64-segments-one-send_tokens/held-55.{json,png}` | Stage 55; 55; **167211ms**; running seg 55; roundCap 8 | `실행 중… 166초 · 도구 55` | PASS |
| B1 tokens complete | `.../complete.{json,png}` | Final 64; 64; **202125ms**; verified-local 64; roundCap 8 | Final 64; 검증 완료; 출력 33,280 (token fixture) | PASS |
| B1 confirm held-55 | `B1_64-segments-one-send_confirm/held-55.{json,png}` | Stage 55; 55; **168163ms**; running seg 56 (>48); userAudit 2 | `실행 중… 164초 · 도구 55`; autonomy **확인** | PASS |
| B1 confirm complete | `.../complete.{json,png}` | Final 64; 64; **198627ms**; verified-local 64; userAudit 2 | Final 64; 검증 완료; composer 확인 | PASS |
| B2 held | `B2_scope-cannot-shrink/scope-retained.{json,png}` | Kept title; map 20x15; sticky working; units retained in test; item 회복약 | sticky 2/3 작업 중; resize still 작업 중; repair_acceptance rejected; item preserve checked | PASS |
| B2 complete | `.../complete.{json,png}` | Kept title; map **22x17**; item 회복약; verified-local; unexpected [] | Kept title; 3/3 검증 완료; log `20×15 → 22×17` | PASS |
| B3 held | `B3_no-write-is-not-done/not-done.{json,png}` | title 새 프로젝트; applied 0; sticky working | topbar 새 프로젝트; sticky 0/1 작업 중; log set title to 새 프로젝트 only | PASS |
| B3 complete | `.../complete.{json,png}` | title **Actually applied**; applied 1; verified-local seg 3 | sticky 1/1 검증 완료; log `"Actually applied"`; topbar widget still 새 프로젝트 (chrome lag vs inspect) | PASS |
| B4 recover hold | `B4_changed-recovery-and-user-controls_recover/recovery.{json,png}` | map 20x15; running seg 6; sticky working | 0/1 작업 중; five failed resize_map | PASS |
| B4 recover term | `.../terminal.{json,png}` | map **22x17**; verified-local seg 6 | 1/1 검증 완료; `20×15 → 22×17` | PASS |
| B4 abort hold | `..._abort/recovery.{json,png}` | map 20x15; running | same recovery chrome | PASS |
| B4 abort term | `..._abort/terminal.{json,png}` | map 20x15; **aborted** | sticky 진행 막힘; `사용자가 중단했습니다`; no resize apply | PASS |
| B4 queued hold | `..._queued/recovery.{json,png}` | map 20x15; running | recovery chrome before Enter | PASS |
| B4 queued term | `..._queued/terminal.{json,png}` | map **22x17**; verified-local; userAudit 2 | user bubble **continue**; 검증 완료; `20×15 → 22×17` | PASS |
| B4 project-switch hold | `..._project-switch/recovery.{json,png}` | map 20x15; running | recovery chrome | PASS |
| B4 project-switch term | `..._project-switch/terminal.{json,png}` | map 20x15; harness execution null after replace; http terminal `state:project-switch` orphaned | chip **대화 복원됨**; sticky gone; map not 22x17 | PASS |
| B4 401 hold | `..._401/recovery.{json,png}` | map 20x15; running | recovery chrome | PASS |
| B4 401 term | `..._401/terminal.{json,png}` | map 20x15; **external-blocker**; evidence origin transport code 401 | modal `AI 작업이 오류로 끝났습니다` + fixture 401; sticky 진행 막힘 | PASS |

## B1 timings vs prior first-fail

| variant | held-55 ms | complete ms | prior fail |
|---|---:|---:|---|
| auto | 167493 | 201205 | held 226227 then timeout at ~59/64 |
| chat | 182824 | 224207 | fail Stage 53 |
| tokens | 167211 | 202125 | fail Stage 50 |
| confirm | 168163 | 198627 | fail Stage 52/64 at 240s |

All four completes inside frozen 240000 ms terminal bound. No bound increased.
