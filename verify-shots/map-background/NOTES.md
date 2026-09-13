# 맵 배경(패럴랙스) 렌더 증거 — 2026-09-14

`map.background` 는 저작만 되고 **그리는 코드가 없었다**(빈 칸은 플레이 카메라의 검정 배경이었다).
이 변경이 그 소비자를 붙인 결과다. 샷은 전부 출하 플레이어(`player.html`)를 띄우는 런타임 QA
하네스로 찍었다 — 편집기 셸을 통과하지 않는다.

## 재현

```bash
node scripts/qa/runtime/map-background-fixture.mjs --out /tmp/mb-on.json
node scripts/qa/runtime/map-background-fixture.mjs --out /tmp/mb-off.json --no-background
node scripts/qa/runtime/map-background-fixture.mjs --out /tmp/mb-zoom.json --zoom 0.5
node scripts/qa/runtime/map-background-fixture.mjs --out /tmp/mb-cmd.json --no-background \
  --override-id easyrpg-backdrop-sky1

node scripts/runtime-qa.mjs --scenario map-background --project /tmp/mb-off.json \
  --out verify-shots/runtime-qa/map-background-control
node scripts/runtime-qa.mjs --scenario map-background --out verify-shots/runtime-qa/map-background
node scripts/runtime-qa.mjs --scenario map-background --project /tmp/mb-zoom.json \
  --out verify-shots/runtime-qa/map-background-zoom
node scripts/runtime-qa.mjs --scenario map-background --project /tmp/mb-cmd.json \
  --out verify-shots/runtime-qa/map-background-command

node scripts/qa/runtime/map-background-diff.mjs verify-shots/runtime-qa/map-background-control \
  verify-shots/runtime-qa/map-background verify-shots/runtime-qa/map-background-zoom
```

픽스처는 시작 맵 위쪽 6행을 비워 하늘 띠를 만든다 — 그 띠에 무엇이 그려지는지가 곧 판정이다.

| 샷 | 무엇을 보이는가 |
|---|---|
| `01-control-no-background.png` | 대조군. 배경 저작 없음 → 띠가 **검정**(플레이 카메라 배경색 #000) |
| `02-background-on.png` | 같은 타일 배치 + `map.background.imageId = easyrpg-backdrop-sky1` → 하늘 |
| `03-scroll-60-frames.png` | 정확히 60프레임 뒤(프레임 제어 일시정지 상태에서 촬영) — 배경이 저작한 속도만큼 이동 |
| `04-zoom-0.5-edge-coverage.png` | 카메라 배율 0.5. 화면 고정 배경이 뷰포트를 정확히 덮는다(보정 없으면 가장자리에 검은 띠) |
| `05-command-only.png` | `map.background` 없이 이벤트 명령 「먼 배경 변경」(m2-069)만으로 하늘이 뜬다 |

## 픽셀 실측 (`map-background-diff.mjs`)

```
skyBand.controlMeanRgb              [4, 3, 2]        ← 대조군: 검정
skyBand.backgroundMeanRgb           [32, 96, 200]    ← 배경: 하늘
skyBandDiffControlVsBackground      0.9773
tileBandDiffControlVsBackground     0.0000           ← 타일이 깔린 띠는 두 런이 완전히 같다
                                                        (= 배경이 타일을 덮지 않는다. 절벽 뒤에만 보인다)
skyBandDiffBeforeAfterScroll        0.3457
skyBandShift.shift                  -387 px (논리 129px, 프레임당 2.0~2.1px)
zoomEdgeBlackRatio                  0                ← 배율 0.5 에서 가장자리 검은 픽셀 0
```

저작한 `scrollX` 는 2px/프레임이고 60프레임 × 17ms ≈ 1.02초이므로 기대 이동은 약 367px 다.
실측 387px 는 Phaser `TimeStep` 이 그 구간에 61~63 프레임을 돌리기 때문이다(프레임당 2.0~2.1px).

`skyBandShift` 는 띠의 **세로 합 프로파일** 상관으로 잰다 — 하늘은 대부분 단색이라 한 행만 보면
상관이 잡음에 끌려 아무 값이나 최소가 된다(실측: 같은 샷에서 −246px 과 −900px 이 둘 다 나왔다).

## 편집기 표면

`verify-shots/editor-map-bg-preview/background-tab.png` — 맵 속성 「맵 배경」 탭의 미리보기.
캔버스는 배경을 그리지 않는다(빈 칸 체커가 "바닥 없음" 신호라 덮지 않는다, 2026-08-27 결정).
그래서 고른 그림을 확인할 자리는 이 탭 하나이고, `scripts/capture-map-background-preview.mjs` 가
실제 브라우저에서 픽커 → 미리보기 로드(`naturalWidth 640`)까지 확인한다.
