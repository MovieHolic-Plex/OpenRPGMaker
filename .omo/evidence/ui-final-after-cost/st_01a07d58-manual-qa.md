# manualQa — st_01a07d58 UI final after B1 cost guard (GROK)

No ulw-loop plan (`ULW_LOOP_PLAN_MISSING`). Artifacts: `/home/main/z-project/rpg-zzu-unbounded-integrate-01a07570/.omo/evidence/ui-final-after-cost/`.
Worktree `fix/ai-unbounded-execution-main` HEAD `87a87017b16b6c6038c2e35791318e39d984cd3f` plus frozen uncommitted 12-file UI delta. 9841 pid 2252417 not touched. Full11 one no-retry invocation **exit 0** — GREEN for this lane (not repo-gate).

Exact surface: Chromium editor `http://127.0.0.1:19844/?blankProject=1&aiBridge=0`.
Exact invocation:

```
cd /home/main/z-project/rpg-zzu-unbounded-integrate-01a07570
DEV_SERVER_PORT=19844 \
VITE_CACHE_DIR=/home/main/z-project/rpg-zzu-unbounded-integrate-01a07570/.omo/evidence/ui-final-after-cost/vite-cache \
E2E_RETRIES=0 DEV_SERVER_NO_TLS=1 \
PLAYWRIGHT_JSON_OUTPUT_FILE=/home/main/z-project/rpg-zzu-unbounded-integrate-01a07570/.omo/evidence/ui-final-after-cost/full11-machine.json \
npx playwright test test/e2e/ai-unbounded-execution.spec.ts \
  --project=chromium --workers=1 --trace off --max-failures=1 \
  --reporter=list --reporter=json
```

Machine stats: expected 11, unexpected 0, flaky 0, skipped 0; duration 1036459.802 ms; sha256 `f32a8136a8de312d31704561cdfbcc29a2000cddad419961adca62af8aea67d0`.

Frame roots (reconciled): spec writes `.omo/evidence/ai-unbounded/browser/` (absolute `/home/main/z-project/rpg-zzu-unbounded-integrate-01a07570/.omo/evidence/ai-unbounded/browser`). Portable copies under this attempt dir `browser/`. Previous failed run copied to `preserved-previous-ai-unbounded-browser/` and `preserved-previous-test-results/` before the fresh run.

## surfaceEvidence

| scenario | criterion | surface | exact invocation | verdict | artifactRefs |
|---|---|---|---|---|---|
| B1-auto | held55>48 then Final64 | Chromium `http://127.0.0.1:19844/?blankProject=1&aiBridge=0` | command above; title `B1 64-segments-one-send auto`; send via `ai-input`+`ai-send` | PASS | A-full11-json, A-full11-log, A-b1-auto-held, A-b1-auto-complete, A-frames |
| B1-chat | same | same | title `B1 64-segments-one-send chat` | PASS | A-full11-json, A-b1-chat-held, A-b1-chat-complete, A-frames |
| B1-tokens | same | same | title `B1 64-segments-one-send tokens` | PASS | A-full11-json, A-b1-tokens-held, A-b1-tokens-complete, A-frames |
| B1-confirm | held55>48 then Final64; confirm second ordinary Do `continue` | same | title `B1 64-segments-one-send confirm`; idle `send("continue")` after preview | PASS | A-full11-json, A-b1-confirm-held, A-b1-confirm-complete, A-frames |
| B2 | both outcomes; scope cannot shrink | same | title `B2 scope-cannot-shrink` | PASS | A-b2-held, A-b2-complete, A-frames |
| B3 | applied-state completion; no-write is not done | same | title `B3 no-write-is-not-done` | PASS | A-b3-held, A-b3-complete, A-frames |
| B4-recover | recover → verified-local 22x17 | same | title `B4 changed-recovery-and-user-controls recover` | PASS | A-b4-recover-rec, A-b4-recover-term, A-frames |
| B4-abort | abort → aborted, map unchanged | same | `ai-abort` click | PASS | A-b4-abort-rec, A-b4-abort-term, A-frames |
| B4-queued | busy Enter `continue` while Send disabled; appliedCalls 0 then resume 22x17 | same | `ai-input` fill `continue` + `press("Enter")` | PASS | A-b4-queued-rec, A-b4-queued-term, A-frames |
| B4-project-switch | `store.replaceProject` → `project-switch` | same | title `… project-switch` | PASS | A-b4-ps-rec, A-b4-ps-term, A-frames |
| B4-401 | fixture 401 → `external-blocker` | same | writer index 6 `{status:401}` | PASS | A-b4-401-rec, A-b4-401-term, A-frames |

## adversarialCases

| scenario | criterion | class | expected behavior | verdict | artifactRefs |
|---|---|---|---|---|---|
| ADV-bypass | no private runner/session write; real ai-input/ai-send; queued is Enter | control bypass | first send is `ai-send`; B4 queued Enter; inspect reads `__oprnAiHarness`; rest/v1 empty | PASS | A-e2e-src, A-b4-queued-term |
| ADV-enum | RequestExecution vs RunOutcome | enum conflation | B2/B4 JSON `execution.state` is `verified-local`/`aborted`/`external-blocker`/`project-switch` not RunOutcome enums | PASS | A-b2-complete, A-b4-abort-term, A-b4-401-term, A-b4-ps-term |
| ADV-sleep | no waitForTimeout / deadline increase vs frozen | timing cheat | harness timeouts still 120/240/15/15000; 300000 test timeout unchanged; `--max-failures=1` only | PASS | A-e2e-src, A-full11-log |
| ADV-auth | fixture 401 blocker | authz | B4-401 terminal `external-blocker` + transport 401 evidence; no live provider | PASS | A-b4-401-term |
| ADV-persist | blankProject local-only; rest intercepted | remote write | boot throws if remote persistence enabled; `/rest/v1/` would be unexpected; all captures `unexpected: []` | PASS | A-e2e-src, A-b2-complete, A-timings |
| ADV-xss | untrusted HTML | injection | not_applicable — this lane did not add a new untrusted HTML renderer; budget text is session numeric fields | — | — |
| ADV-b1-throughput | 64 segments inside frozen 240s | core stall | Final 64 / terminal activity within 240s for all four variants | PASS | A-b1-auto-complete, A-b1-chat-complete, A-b1-tokens-complete, A-b1-confirm-complete, A-timings |

No generic security PASS. Exercised fixtures only.

## Binary screenshot findings (Read)

- B1 auto held-55: Stage 55, 55/64, sticky 작업 중, still sending. Budget chip `실행 중… 167초 · 도구 55`.
- B1 auto complete: topbar Final 64, sticky 1/1 검증 완료, log Final 64, predicates verified. appliedElapsedMs 201205.
- B1 chat held/complete: 182초 hold, Final 64 at 224207ms.
- B1 tokens: hold 166초; complete output tokens 33,280; roundCap 8.
- B1 confirm: autonomy 확인; hold 164초 · 도구 55; Final 64 at 198627ms; two user audits.
- B2 complete: title Kept title, sticky 3/3 검증 완료, resize 20x15→22x17, item 회복약 preserved.
- B3 held: title 새 프로젝트, sticky 작업 중 (no-write not done). Complete: inspect title Actually applied, sticky 검증 완료; topbar widget still 새 프로젝트 in PNG (chrome lag vs inspect).
- B4 recover terminal: 검증 완료, map 22x17.
- B4 abort terminal: 진행 막힘, `사용자가 중단했습니다`, map unchanged.
- B4 queued terminal: user bubble `continue`, 검증 완료, 20x15→22x17.
- B4 project-switch terminal: http `execution.state=project-switch` orphaned; PNG chip `대화 복원됨`, sticky gone, map not 22x17. Not a boot failure.
- B4 401 terminal: modal fixture 401 / invalid_api_key; sticky 진행 막힘; JSON `external-blocker` transport 401.

## Checks / exits

| check | exit |
|---|---|
| pre-run 12 UI hashes vs `11-source-hashes.txt` | match |
| `npm run typecheck:app` | 0 |
| `npm run build` (app+player+standalone+archive) | 0 (warnings retained) |
| full11 playwright | **0** (11 passed / 0 failed) |
| post-run 12 UI hashes | match |
| 19844 after cleanup | unbound |
| 9841 | pid 2252417 untouched |

## Changed files (uncommitted, frozen; not edited this lane)

`src/editor/panels/aiChatPanel.ts`, `aiChatRenderers.ts`, `aiTurnRunner.ts`; `openwiki/editor-observability.md`; `test/fakeDom.ts`, `aiBusyQueue.test.ts`, `aiTurnRunnerRetirement.test.ts`, `e2e/ai-unbounded-execution.spec.ts`, `aiOutcomePresentation.test.ts`, `aiBlockedContinue.test.ts`, `aiContinueUserAction.test.ts`, `requiredOutcomeFixture.ts`.

HEAD already contains the one-line `hasChecks()` guard. No commit/push/unlock. Vite cache under this evidence dir removed. 19844 not listening.

## artifactRefs

Base: `/home/main/z-project/rpg-zzu-unbounded-integrate-01a07570/.omo/evidence/ui-final-after-cost/`

| id | kind | description | path |
|---|---|---|---|
| A-full11-json | json | original machine result (preserved copy identical) | full11-machine.json |
| A-full11-orig | json | frozen copy of machine result | full11-machine.original.json |
| A-full11-log | log | list reporter stdout/stderr | 03-full11.log |
| A-full11-cmd | log | exact command + start metadata | 03-full11.cmd.txt |
| A-full11-exit | log | playwright exit 0 | 03-full11.exit |
| A-frames | doc | Read-checked screenshot matrix | FRAME-MATRIX.md |
| A-timings | json | compact inspect facts for all 22 captures | 05-frame-timings.json |
| A-handoff | doc | frozen UI handoff | HANDOFF.md |
| A-typecheck | log | app typecheck | 01-typecheck-app.log |
| A-build | log | full npm run build | 02-build.log |
| A-cleanup | log | vite-cache removal + ports | 04-cleanup.txt |
| A-hashes | log | final source hashes | 00-source-hashes-final.txt |
| A-b1-auto-held | json+png | B1 auto hold 55 | browser/B1_64-segments-one-send_auto/held-55.json |
| A-b1-auto-complete | json+png | B1 auto Final 64 | browser/B1_64-segments-one-send_auto/complete.json |
| A-b1-chat-held | json+png | B1 chat hold 55 | browser/B1_64-segments-one-send_chat/held-55.json |
| A-b1-chat-complete | json+png | B1 chat Final 64 | browser/B1_64-segments-one-send_chat/complete.json |
| A-b1-tokens-held | json+png | B1 tokens hold 55 | browser/B1_64-segments-one-send_tokens/held-55.json |
| A-b1-tokens-complete | json+png | B1 tokens Final 64 | browser/B1_64-segments-one-send_tokens/complete.json |
| A-b1-confirm-held | json+png | B1 confirm hold 55 | browser/B1_64-segments-one-send_confirm/held-55.json |
| A-b1-confirm-complete | json+png | B1 confirm Final 64 | browser/B1_64-segments-one-send_confirm/complete.json |
| A-b2-held | json+png | B2 scope retained | browser/B2_scope-cannot-shrink/scope-retained.json |
| A-b2-complete | json+png | B2 complete 22x17 | browser/B2_scope-cannot-shrink/complete.json |
| A-b3-held | json+png | B3 not-done | browser/B3_no-write-is-not-done/not-done.json |
| A-b3-complete | json+png | B3 applied | browser/B3_no-write-is-not-done/complete.json |
| A-b4-recover-rec | json+png | B4 recover hold | browser/B4_changed-recovery-and-user-controls_recover/recovery.json |
| A-b4-recover-term | json+png | B4 recover terminal | browser/B4_changed-recovery-and-user-controls_recover/terminal.json |
| A-b4-abort-rec | json+png | B4 abort hold | browser/B4_changed-recovery-and-user-controls_abort/recovery.json |
| A-b4-abort-term | json+png | B4 abort terminal | browser/B4_changed-recovery-and-user-controls_abort/terminal.json |
| A-b4-queued-rec | json+png | B4 queued hold | browser/B4_changed-recovery-and-user-controls_queued/recovery.json |
| A-b4-queued-term | json+png | B4 queued terminal after Enter | browser/B4_changed-recovery-and-user-controls_queued/terminal.json |
| A-b4-ps-rec | json+png | B4 project-switch hold | browser/B4_changed-recovery-and-user-controls_project-switch/recovery.json |
| A-b4-ps-term | json+png | B4 project-switch terminal | browser/B4_changed-recovery-and-user-controls_project-switch/terminal.json |
| A-b4-401-rec | json+png | B4 401 hold | browser/B4_changed-recovery-and-user-controls_401/recovery.json |
| A-b4-401-term | json+png | B4 401 external-blocker | browser/B4_changed-recovery-and-user-controls_401/terminal.json |
| A-e2e-src | source | frozen harness (hash unchanged) | ../../test/e2e/ai-unbounded-execution.spec.ts |
| A-preserved | dir | previous failed spec frames | preserved-previous-ai-unbounded-browser/ |
