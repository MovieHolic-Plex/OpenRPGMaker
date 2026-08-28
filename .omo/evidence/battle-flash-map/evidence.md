# 전투 플래시가 뒤의 맵을 드러내던 회귀 — 실측 증거

감독자가 직접 측정했다. 취소된 하위 노드가 남긴 서술 파일(`red-capture.md`,
`green-capture.md`, `verify.md`)은 감독자가 재현하지 않은 내용이라 삭제했다.
아래 수치는 모두 이 디렉터리의 로그 원본에서 나온다.

## 무엇이 잘못됐나

`src/player/battleJuice.ts:81-100` 의 `flashBattleField` 는 `.battle-scene` 루트에
`battle-flash-hit` / `battle-flash-critical` 를 붙였고, `06-damage-flash-targeting.css` 가
그 클래스로 **루트의 `background-color` 를 알파 색으로 애니메이션**했다. 루트의 불투명
검정 배경(`01-scene-base.css`: `background: #000`)이 전투 중에도 맵 Phaser 캔버스를 가리는
유일한 수단인데, 그 배경 자체가 반투명해지니 맵이 그대로 보였다. 셰이크(`battle-screen-shake`)
는 같은 루트를 `translate` 해서 640x480 배경을 밀어냈고, 밀린 가장자리로도 맵이 샜다.

## RED 실측 (기준선 CSS)

| 경로 | 측정 | 값 |
| --- | --- | --- |
| `battle-flash-hit` (battle-v3) | 루트 `background-color` 최소 알파 | **0.216** (`red/probe-flash.txt`) |
| `battle-flash-hit` (30x30 마을 맵) | 루트 최소 알파 / 첫 프레임 | **0.055** / `rgba(255,255,255,0.35)` (`red/probe-village.txt`) |
| `battle-screen-shake` | 루트 transform translate | **-5.06px, 3.37px** (동 파일) |
| 스펙 | `test/runtime/battle-flash-map.spec.ts` | **2 failed** (`red-spec-run.txt`) |

시각 증거: `hit-flash-gutter-red-vs-green.png` (4배 확대, 위=RED / 아래=GREEN). RED 에서는
필드와 HUD 사이 4px 거터와 HUD 패널 사이 틈으로 마을 타일(자갈·잔디·울타리)이 드러난다.
전체 프레임은 `red/shots-village/red-02-hit-flash.png` 대비
`green/shots-village/green-02-hit-flash.png`.

## 수정

- `06-damage-flash-targeting.css`: 루트 배경을 건드리던 `.battle-flash-hit` /
  `.battle-flash-critical` 규칙과 두 키프레임을 삭제했다. 플래시 색은 이미
  `15-juice-capture-fx.css` 의 `.battle-field::after` 자식 오버레이가 그린다.
- `04-anim-damage-layers.css` + `06-...css`: 셰이크를 `.battle-scene.battle-screen-shake
  .battle-field` 로 옮기고 키프레임을 `battle-field-shake` 로 바꿨다. 필드 자식만 움직이므로
  가장자리에는 루트의 검정 배경이 남는다. 루트에 걸던 시절 필요했던
  `scale(var(--battle-stage-scale))` 곱셈도 함께 사라졌다.
- 클래스 이름(`battle-flash-*`, `battle-screen-shake`)은 `battleJuice.ts` /
  `battleAnimationDom.ts` 계약이라 그대로 유지했다. TS 변경 없음.

## GREEN 실측 (수정 후, 같은 프로브)

- 루트 최소 알파 = **1**, 첫 프레임 `rgb(0, 0, 0)`, transform 은 세 경로 모두
  `matrix(0.5, 0, 0, 0.5, 0, 0)` 고정 (`green/probe-flash.txt`, `green/probe-village.txt`).
- 플래시는 살아 있다 — `.battle-field::after` 오버레이 알파 > 0 을 스펙이 함께 판정한다.
- 스펙 **2 passed** (`green-spec-run.txt`).

## 게이트

- `npm run gates:css` — 예산 회귀 0건(hexLiterals 1922 동일), graph gate 신규 0건.
- `npm run qa:runtime:gate` — 4 passed (신규 2 + smoke/dialogue 2). (`gates-css-runtime.txt`)
- `npx vitest run test/battleRm2003PixelGrid.test.ts test/battleAnimationEffectStyle.test.ts`
  — 16 passed. `npm run typecheck` 의 잔여 오류 6건은 `test/workPlan.test.ts` /
  `vite.config.ts` 기준선 오류로 이 변경과 무관하다. (`gates-run.txt`)
