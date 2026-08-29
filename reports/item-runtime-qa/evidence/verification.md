# 아이템 런타임 QA — 독립 재검증 (verifier)

- 검증 시각: 2026-08-30 02:09~02:14 (+0900)
- 워크트리: `/home/main/.herdr/worktrees/rpg-zzu/item-item-qa-report` (브랜치 `agent/item-qa-report`, HEAD `6d179f86`)
- 검증자는 코드·시나리오·리포트를 고치지 않았다. 이 파일만 새로 만들었다.
- 모든 실행은 detached(`setsid nohup`)로 돌렸고(호스트 포화로 인한 SIGTERM 회피), 종료 코드는 로그에 기록된 실측값이다.

> 중요 — 검증 대상 상태: 아래 결과는 **HEAD + 커밋되지 않은 워킹트리 변경 4건** 기준이다.
> `git status --short` 실측:
> ```
>  M scripts/lib/runtimeQaRun.mjs
>  M scripts/qa/runtime/item-battle.scenario.mjs
>  M scripts/qa/runtime/item-menu.scenario.mjs
>  M vite.player-qa.config.ts
> ```
> `vite.player-qa.config.ts` 의 미커밋 변경(`server.watch: null`)이 없으면 현재 호스트에서는 시나리오가
> 전부 기동 실패한다 — 02:01 이전 첫 배치에서 6개 전부 `EXIT=1`, 로그에
> `Error: ENOSPC: System limit for number of file watchers reached, watch '.../vite.player.config.ts'`.
> 당시 실측 호스트 inotify 사용량 `4,192,849 / 4,194,304`(codegraph MCP 2개가 약 3.94M 점유).
> 즉 이 4건이 커밋되지 않은 채로는 HEAD 만으로 동일 결과를 재현할 수 없다.

## 1) 시나리오별 재실행 (2차 배치, 파일 해시 고정 확인)

각 시나리오 실행 직전/직후 `scripts/runtime-qa.mjs`, `scripts/lib/runtimeQaRun.mjs`,
`scripts/lib/runtimeQa.mjs`, `vite.player-qa.config.ts`, 해당 `*.scenario.mjs`,
`reports/item-runtime-qa/index.html` 의 sha256 을 찍었다 — 실행 중 변경(drift) 없음.

| 시나리오 | 실행한 명령 | 실측 종료 코드 | SUMMARY.md 게이트 줄 | 샷 수(PNG) |
|---|---|---|---|---|
| item-menu | `npm run qa:runtime -- --scenario item-menu` | `EXIT[item-menu]=0` | `- 게이트: 통과 (비트 9개 중 0개 실패)` | 6 |
| item-battle | `npm run qa:runtime -- --scenario item-battle` | `EXIT[item-battle]=0` | `- 게이트: 통과 (비트 10개 중 0개 실패)` | 6 |
| item-equipment | `npm run qa:runtime -- --scenario item-equipment` | `EXIT[item-equipment]=0` | `- 게이트: 통과 (비트 6개 중 0개 실패)` | 2 |
| smoke | `npm run qa:runtime -- --scenario smoke` | `EXIT[smoke]=0` | `- 게이트: 통과 (비트 4개 중 0개 실패)` | 4 |
| dialogue | `npm run qa:runtime -- --scenario dialogue` | `EXIT[dialogue]=0` | `- 게이트: 통과 (비트 3개 중 0개 실패)` | 1 |
| battle | `npm run qa:runtime -- --scenario battle` | `EXIT[battle]=0` | `- 게이트: 통과 (비트 5개 중 0개 실패)` | 2 |

러너 로그 원문(`/tmp/omo-item-qa-run2.log`, PRE/POST 해시 줄 제외):

```
===== BEGIN item-menu 2026-08-30T02:09:45+09:00 =====
EXIT[item-menu]=0
===== BEGIN item-battle 2026-08-30T02:09:54+09:00 =====
EXIT[item-battle]=0
===== BEGIN item-equipment 2026-08-30T02:10:41+09:00 =====
EXIT[item-equipment]=0
===== BEGIN smoke 2026-08-30T02:11:23+09:00 =====
EXIT[smoke]=0
===== BEGIN dialogue 2026-08-30T02:11:30+09:00 =====
EXIT[dialogue]=0
===== BEGIN battle 2026-08-30T02:12:06+09:00 =====
EXIT[battle]=0
ALLDONE
RUNNER_EXIT=0
```

6개 시나리오 모두 `게이트: 통과`, `열어야 할 샷: 0개`, `런타임 에러: 없음`.
샷은 `verify-shots/runtime-qa/<id>/` (git-ignored, 매 실행 시 초기화)에 남았고 전부 비영바이트다.

참고(동시성): 첫 배치(02:01)와 2차 배치(02:09) 사이에 다른 에이전트가 같은 워크트리의
`scripts/qa/runtime/item-battle.scenario.mjs` 를 02:03:19 에 수정했다. 그래서 위 표는 **2차 배치**
결과만 싣는다 — 표의 모든 수치는 현재 디스크 내용(해시 고정 확인)으로 실행한 값이다.

## 2) 런타임 게이트

```
$ npm run qa:runtime:gate      # playwright test --config playwright.runtime.config.ts
...
  ✓  10 [chromium] › test/runtime/smoke.spec.ts:20:3 › 런타임 게이트: smoke (6.9s)
  ✓  11 [chromium] › test/runtime/smoke.spec.ts:20:3 › 런타임 게이트: dialogue (35.7s)

  11 passed (2.4m)
EXIT=0
```

실측 종료 코드 **0**, 11/11 통과, 실패·재시도 없음.

## 3) 리포트 정합성

- `reports/item-runtime-qa/index.html` (sha256 `ae9ec409…c3980`) 의 `<img src>` — 태그 20개, 유일 경로 18개.
- 18개 전부 실제 파일로 해석되고 모두 비영바이트: 280,378 ~ 430,468 bytes.
- **누락 0개, 0바이트 0개.** `http`/`#` 이외의 다른 `href`/`src` 참조도 동일한 18개 애셋뿐이다.
- 실브라우저 렌더 재검증(chromium, file:// 로딩, 1280×900):
  `IMG_TOTAL=20 BROKEN=0`(`naturalWidth/Height` 기준), `REQ_FAILED=0`, 종료 코드 `EXIT=0`.
- 렌더 화면 스크린샷 존재:
  - `verify-shots/report-render/report-full.png` (2,968,241 bytes), `report-viewport-top.png`, `report-viewport-equip.png` — 기존 산출물
  - `verify-shots/report-render-verify/report-full.png` (2,968,241 bytes), `report-viewport-top.png` — 검증자가 독립적으로 다시 렌더한 것. 전체 페이지 PNG 가 기존 산출물과 바이트 크기까지 일치한다.

## 4) 타입체크

```
$ npx tsc --noEmit -p tsconfig.app.json
EXIT=0
```

출력 없음, 실측 종료 코드 **0** (02:05 · 02:13 두 번 실행, 둘 다 0).

## 5) 판정

**PASS** — 시나리오 6/6 종료 코드 0, 런타임 게이트 종료 코드 0(11 passed), 리포트 이미지 누락 0개(렌더 BROKEN=0), 타입체크 종료 코드 0. 단, 이 결과는 위에 적은 미커밋 변경 4건이 워킹트리에 있는 상태에서만 재현된다.

## 6) 검증 이후 보고서가 바뀐 기록 (구현자 추가, 2026-08-30 04:0x)

§3 의 수치는 **02:14 시점 보고서**를 재본 것이다. 그 뒤 커밋 `2fd89a18` 에서 아이템 재고 소모 증거
2장(`stock-before.png`, `stock-after.png`)을 보고서에 더했다. 그래서 지금 저장소에 있는 보고서는 §3 보다
이미지가 2장 많다. 헷갈리지 않게 최종 상태를 다시 실측해 남긴다.

| 항목 | §3 (02:14 기준) | 최종 (`2fd89a18`) |
|---|---|---|
| `index.html` sha256 | `ae9ec409…c3980` | `465e373b…cd521` |
| `<img>` 태그 / 유일 경로 | 20 / 18 | 22 / 20 |
| 애셋 바이트 범위 | 280,378 ~ 430,468 | 280,378 ~ 440,387 |
| 누락 · 0바이트 | 0 · 0 | 0 · 0 |
| 실브라우저 렌더 | IMG_TOTAL=20 BROKEN=0 REQ_FAILED=0 | IMG_TOTAL=22 BROKEN=0 REQ_FAILED=0 |

최종 렌더는 `/tmp/omo-render-report-final.mjs`(chromium, `file://` 로딩, 1280×900, 전체 페이지)로 돌렸고
종료 코드 0 이다. 캡처를 이 커밋에 함께 담았다.

- `verify-shots/report-render/` — 보고서 초판 캡처 3장(`report-full.png` 2,968,241 bytes 등)
- `verify-shots/report-render-verify/` — 검증자 캡처. **주의**: 이 폴더의 `report-full.png` 는 지금
  3,260,810 bytes 다. §3 에 적힌 2,968,241 bytes 와 다른데, 재고 증거를 넣은 뒤 같은 경로에 다시
  렌더해 덮어썼기 때문이다. 즉 §3 의 "바이트 크기까지 일치한다" 는 02:14 당시 두 캡처에만 해당한다.
- `verify-shots/report-render-final/` — 최종 보고서를 다시 렌더한 캡처 2장.
  `report-full.png` 3,260,810 bytes · `report-viewport-top.png` 145,852 bytes 로
  `report-render-verify/` 와 바이트까지 같다 — 같은 보고서를 두 번 렌더하면 같은 PNG 가 나온다.

병합 뒤 재확인(02:55~02:57, `/tmp/item-review-1788026151/status`): `item-menu` · `item-battle` ·
`item-care` 시나리오와 `tsc --noEmit` 모두 종료 코드 0, 게이트 전부 통과.
