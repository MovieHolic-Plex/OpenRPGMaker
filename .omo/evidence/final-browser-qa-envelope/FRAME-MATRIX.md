# Read-checked screenshot matrix (GROK) — PASS, this HEAD + B1 QA envelope only

Worktree `/home/main/z-project/rpg-zzu-unbounded-ui-01a07570`
HEAD `8441f679dd3e701ffe76b4cf2c11e0f98e8ca23f` (`agent/unbounded-final-qa-01a07570`, product clean; only `test/e2e/ai-unbounded-execution.spec.ts` QA envelope dirty).
Model `grok-4.6` / provider `xai`.

Spec writes `.omo/evidence/ai-unbounded/browser/<title>/`.
This-run portable copies: `.omo/evidence/final-browser-qa-envelope/browser/`.
Sep 7 stale captures were moved to `preserved-previous-ai-unbounded-browser/` **before** this run. They are **not** this-run proof.

QA envelope (authorized, B1 only): terminal waiter **240000 → 600000**; B1 `test.setTimeout` **660000**. File-level test timeout remains **300000**. Helper default remains **240000** for B2/B3/B4. Fixture signal 120000 / no-progress 15000 / inspect 15000 unchanged. Product execution/context/output/tool budgets unchanged.

Host loadavg at start **125.91 185.43 174.09** (context, not a gate). No idle wait.

| id | frame | inspect JSON | Read PNG | verdict |
|---|---|---|---|---|
| B1 auto held-55 | `browser/B1_64-segments-one-send_auto/held-55.{json,png}` | title Stage 55; ck 1–55; applied 55; elapsed **320091ms**; exec running seg 55; budget data-segment 56; writers 55; userAudit 1; unexpected [] | topbar Stage 55; 55/64 Checkpoint 56중; gold `실행 중… 317초 · 도구 55`; sticky 0/1 작업 중 | PASS |
| B1 auto complete | `.../complete.{json,png}` | title Final 64; ck 64 last Final 64; applied 64; elapsed **377347ms**; exec verified-local seg 64; writers 64; userAudit 1; unexpected [] | topbar Final 64; sticky 1/1 검증 완료; log Stage 59–Final 64 + 맵 검사; Applied request predicates verified | PASS |
| B1 chat held-55 | `browser/B1_64-segments-one-send_chat/held-55.{json,png}` | Stage 55; applied 55; elapsed **218664ms**; exec running seg 56; writers 55; userAudit 1 | Stage 55; 55/64; gold `218초 · 도구 55`; sticky 작업 중 | PASS |
| B1 chat complete | `.../complete.{json,png}` | Final 64; 64 ck; elapsed **255235ms**; verified-local seg 64; writers 64 | Final 64; 1/1 검증 완료; predicates verified | PASS |
| B1 tokens held-55 | `browser/B1_64-segments-one-send_tokens/held-55.{json,png}` | Stage 55; applied 55; elapsed **204069ms**; roundCap 8; writers 55 | Stage 55; 55/64; gold `203초 · 도구 55` | PASS |
| B1 tokens complete | `.../complete.{json,png}` | Final 64; elapsed **246134ms**; verified-local; roundCap 8; writers 64 | Final 64; 검증 완료; 출력 33,280 | PASS |
| B1 confirm held-55 | `browser/B1_64-segments-one-send_confirm/held-55.{json,png}` | Stage 55; applied 55; elapsed **222412ms**; userAudit 2; writers 55 | Stage 55; 55/64; gold `218초 · 도구 55`; composer 확인 | PASS |
| B1 confirm complete | `.../complete.{json,png}` | Final 64; elapsed **266675ms**; verified-local; userAudit 2; writers 64 | Final 64; 1/1 검증 완료; composer 확인 | PASS |
| B2 held | `browser/B2_scope-cannot-shrink/scope-retained.{json,png}` | title Kept title; units 3; map still 20x15; sticky working; item 회복약 | 2/3; resize still 작업 중; repair_acceptance rejected | PASS |
| B2 complete | `.../complete.{json,png}` | map 22x17; sticky verified; exec verified-local; item 회복약 | 3/3 검증 완료; 20x15→22x17 | PASS |
| B3 held | `browser/B3_no-write-is-not-done/not-done.{json,png}` | title 새 프로젝트; applied 0; sticky working | topbar 새 프로젝트; sticky 0/1 작업 중; log set "새 프로젝트" | PASS |
| B3 complete | `.../complete.{json,png}` | inspect title Actually applied; sticky verified; exec verified-local | sticky 1/1 검증 완료; log Actually applied. Topbar widget still 새 프로젝트 (chrome lag vs inspect; inspect is source of truth) | PASS |
| B4 recover hold | `browser/B4_changed-recovery-and-user-controls_recover/recovery.{json,png}` | map 20x15; sticky working; 5 failed resize_map | 0/1 작업 중; five X resize_map | PASS |
| B4 recover term | `.../terminal.{json,png}` | map 22x17; sticky verified; exec verified-local | 1/1 검증 완료; 20x15→22x17 | PASS |
| B4 abort hold | `..._abort/recovery.{json,png}` | map 20x15; sticky working | 0/1 작업 중; five X resize_map | PASS |
| B4 abort term | `..._abort/terminal.{json,png}` | map 20x15; sticky blocked; exec aborted; appliedCalls 0 | 진행 막힘; `사용자가 중단했습니다`; map unchanged | PASS |
| B4 queued hold | `..._queued/recovery.{json,png}` | map 20x15; sticky working | 0/1 작업 중 | PASS |
| B4 queued term | `..._queued/terminal.{json,png}` | http first terminal queued appliedCalls 0 acceptance blocked; resume continue verified-local map 22x17 | user bubble `continue`; 1/1 검증 완료; 20x15→22x17 | PASS |
| B4 project-switch hold | `..._project-switch/recovery.{json,png}` | map 20x15; sticky working | 0/1 작업 중 | PASS |
| B4 project-switch term | `..._project-switch/terminal.{json,png}` | map 20x15; http execution.state=project-switch; appliedCalls 0; inspect harness null after replace | chip `대화 복원됨`; sticky gone; map not 22x17 | PASS |
| B4 401 hold | `..._401/recovery.{json,png}` | map 20x15; sticky working | 0/1 작업 중 | PASS |
| B4 401 term | `..._401/terminal.{json,png}` | map 20x15; exec external-blocker; transport 401 invalid_api_key | modal fixture 401; sticky 진행 막힘 | PASS |

## B1 timings (this run; not a 240s performance claim)

| variant | held-55 ms | complete ms | playwright duration ms |
|---|---:|---:|---:|
| auto | 320091 | 377347 | 413284 |
| chat | 218664 | 255235 | 275404 |
| tokens | 204069 | 246134 | 260852 |
| confirm | 222412 | 266675 | 280366 |

Old 240s terminal waiter would have failed auto (and chat/tokens/confirm completes are also ≥240s). New 600s waiter is a failure-only guard. 15s applied-progress watchdog did not fire. All four variants reached Final 64 with exactly 64 writer calls.
