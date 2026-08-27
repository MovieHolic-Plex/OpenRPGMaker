# 성공 기준 1-6 · 증거 대조

## 1. VISION GATE — 통과 (전제 하나는 그림과 어긋남)

`.omo/evidence/tile-reaudit/vision-probe/` 에 아이 응답 원문이 있다. 첫 줄이 `VISION: YES` 고,
타일별 설명이 픽셀과 맞는다 — 예컨대 16번을 "위아래 수평 목재 프레임 사이의 크림색 반점 회벽"
이라고 적었는데 14배로 확대하면 정확히 그것이다. 그림을 못 보는 모델은 이런 문장을 쓸 수 없다.
게이트의 목적(아이가 정말 보는지 증명)은 달성됐다.

다만 게이트가 정답으로 못박은 전제 하나는 **그림과 어긋난다**:

| 지시서 전제 | 그림 (14배·40배 직접 확인) |
|---|---|
| retro_house 12-17 = **침대** | **목조 골조 벽면**. 12-14 는 갈색 기둥·보 아래 자갈석 패널, 15-17 은 같은 골조에 크림색 반점 회벽. 둥근 아치 상단. 매트리스·베개·머리판이 한 픽셀도 없다 |

판독자 3명과 내 직접 확인이 모두 벽이라고 말한다. 그래서 12-17 은 `wall` 로 유지한다
(`목조 벽돌벽/회벽 상단 좌·중·우 보`). 265/266 인덱스 어긋남과 같은 성질의 문제다:
**그림이 최종 권위**이고, 그 원칙은 지시서에도 똑같이 적용된다.

179 는 게이트 아이가 "awning(천막)" 이라고 했는데 내 확인 결과 문장 깃발이다. 둘 다
"지붕이 아니다" 에는 동의하고, 최종 라벨은 내가 그림에서 확인한 깃발을 쓴다.

## 2. 전수 커버리지 — 통과

`scripts/verify-tile-semantics.mts`:

| 시트 | 커버리지 | 판정 |
|---|---|---|
| retro_dungeon | 478/478 | PASS |
| retro_exterior | 478/478 | PASS |
| retro_house | 478/478 | PASS |
| retro_world | 480/480 | PASS |
| ship | 464/464 | PASS |
| world | 478/478 | PASS |

`apply-tile-verdicts` 집계에 **MISSING 0** — 출하 엔트리 집합과 판정 집합이 정확히 일치한다.
샤드별 원문은 `read/<sheet>/rows-<a>-<b>-<reader>.txt`, 프래그먼트는
`.omo/evidence/tile-semantics/<sheet>/rows-<a>-<b>.json`.

## 3. 179 깃발 + 4~7행×24~29열 비건축물 — 통과

출하본(`3547c9e0`) → 재감사본 대조. 왼쪽이 그림을 못 본 모델이 쓴 것:

| idx | 출하본 (RED) | 재감사본 (GREEN) |
|---|---|---|
| 179 | "붉은 지붕 하단 처마" `roof` | 붉은 제비꼬리 깃발 상단 `decoration` |
| 209 | "원목 판 상단 타일" `floor` | 붉은 제비꼬리 깃발 하단 `decoration` |
| 145 | "나무 문 오른쪽 설계도" `door` | 거울 달린 서랍장 좌측 `furniture` |
| 146 | "나무 문 왼쪽 설계도" `door` | 거울 달린 서랍장 우측 `furniture` |
| 253 | "물" `water` | 청회색 거친 자연석 바닥 `terrain` |
| 252 | "나무 바닥" `floor` | 분홍색 거친 자연석 바닥 `terrain` |
| 259 | "나무 통" `prop` | 죽은 나뭇가지 덤불 `plant` |

렌더한 그림:
- `verified/retro_exterior/audit-179-banner.png` (20배) — 179 는 붉은 바탕·금색 문장·양측
  금색 띠의 깃발 상단이고, 209 에서 제비꼬리 V 밑단으로 끝난다. 같은 크롭에 27열 통(barrel),
  27열 6행 양동이, 28열 5행 빵이 함께 보인다 — 지시서가 말한 그 소품들이다.
- `verified/retro_exterior/audit-145-146-zoom.png` (40배) — 145/146 은 돌출 천판 + 양쪽
  각 3쌍 서랍 손잡이 + 어두운 남색 거울면. **바로 위 3행**(115/116)이 청록색 유리 12칸
  격자의 진짜 창문이라 생김새가 전혀 다르다. 그래서 창문도 문도 아니고 가구다.

4~7행 × 24~29열 24칸 최종 role: `prop` 8 · `furniture` 9 · `decoration` 5 · `window` 0 ·
그 밖의 건축물 role 0 — **24/24 전부 비건축물**.

## 4. 저자와 다른 아이가 재검증 — 통과

칸마다 독립 판독자 A/B 가 각각 그림을 보고 라벨을 썼고, 갈리면 C 를 추가로 붙였다.
다수결이 성립하려면 **서로 다른 아이 2명 이상**이 같은 물건이라고 말해야 한다 —
즉 교정된 모든 칸은 저자 아닌 관찰자의 확인을 받았다. 끝까지 갈린 칸은 고배율 크롭으로
최종 판정 아이(14+15명)를 붙였고, 그래도 안 되는 칸은 내가 직접 봤다.
원문 `read/`, 최종 판정 `adjudicated/`, 크롭 `verified/`, 칸별 이력 `corrections.md`.

## 5. 인접 표면 회귀 — 통과

- `npm run typecheck:app` → **exit 0**
- 타일 의미 테스트 범위 **90/90 통과**
- 실측 브라우저: `test/e2e/tile-semantics-corrected-labels.spec.ts` — 돌아가는 에디터
  페이지 컨텍스트에서 앱 자신의 모듈 그래프를 동적 import 해 읽는다. 표 파일을 직접
  import 하는 단위 테스트와 달리 **번들이 실제로 그 값을 서브하는지**까지 증명한다.
  - RED (출하본 되돌린 상태): `Error: 179 라벨에 "깃발" 가 있어야 한다 (실제: 붉은 지붕 하단 처마)` → 1 failed
  - GREEN (재감사본): 1 passed
  - 스크린샷 `browser-qa/corrected-labels-editor.png` (에디터 전체),
    `browser-qa/corrected-labels-panel.png` (라벨 패널)
- `palette-tiles-come-first.spec.ts` 2/2 통과 — 표가 바뀌어도 타일 팔레트가 정상 렌더된다.

## 6. PR 병합 — 통과

`base/tile-reaudit` 로 8개 PR 병합, 열린 PR 0개. origin/main 은 건드리지 않았다.

## 정리 영수증

| 대상 | 상태 |
|---|---|
| 브라우저 컨텍스트 | chrome/headless_shell 프로세스 **0개** — playwright 종료 시 함께 닫혔다 |
| playwright 산출물 | `test-results/`, `playwright-report/` **없음** (삭제) |
| 임시 스크립트 | `/tmp/dump-idx.cjs`, `/tmp/chk24.cjs`, `/tmp/reaudited-exterior.ts` 삭제 |
| dag 런 / 자식 태스크 | 진행 중 없음 |
| 작업트리 | `git status --porcelain` **0줄** |

dev server(0.0.0.0:9999)는 **일부러 살려뒀다**. playwright 설정이
`reuseExistingServer: true` 라서 내가 띄운 게 아니라 이미 돌던 걸 재사용했고,
이 저장소에는 `dev:keep:detached` 상주 supervisor 스크립트가 따로 있다.
내가 시작하지 않은 상주 프로세스를 끄는 건 사용자 작업을 끊는 일이라 건드리지 않았다.

## 미해결 (숨기지 않고 남긴다)

- **3칸** — 물건은 판독자들이 합의했지만 role 이 갈린다. `splits.txt`.
  `retro_world 296`, `ship 294`, `ship 430`. 그림만으로는 결정이 안 되고 제품 판단이 필요하다.
- **10칸** — 저신뢰라 승격 보류. `needs-human.txt`.
