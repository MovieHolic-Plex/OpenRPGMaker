tilesetId `jp_city` · 그림 `public/assets/jp-city/jp-city-chipset.png`(텍스처 `tex_jp_city`, **20040칸**, 16px 칸, 한 줄 **96칸** — 번호 n 의 칸은 열 n%96, 행 n÷96(내림), 픽셀 좌표 (열×16, 행×16), 모두 0 기준). 계열 `oprn-jp` — 다른 칩셋 칸 번호와 섞지 않는다.

# 일본 도시 · 숲 정상/오류·자동 좌표 검사·층 정정

## 검사 `checkJpForest(map, tileset)` (`src/editor/jpCity/forestPainter.ts`)
구조와 층만 본다 — **보기 좋은지·수종이 맞는지는 판정하지 않는다**(시각 판정은 그림을 직접 보거나 3/4 관문 판정자가 한다). 칸 좌표는 0 기준.
| 코드 | 뜻 |
|---|---|
| `FOREST_TILE_ON_LAYER1` | 나무·그늘 덧칸이 1층에 있다(잘못된 레이어 — 1층은 숲 바닥만) |
| `FOREST_ROOT_OFF_FOREST` | 줄기 열의 밑동 칸이 숲 바닥이 아닌 칸에 있다(잘린 뿌리 — 숲 밖에 선 나무) |
| `FOREST_OVER_FOREIGN` | 나무 조각 밑 1층이 잔디·숲 바닥이 아니다(길·물·건물 위로 넘친 수관) |
| `FOREST_TRUNK_MISSING` | 밑동 바로 위 칸은 있는데 밑동 칸이 비었다(빠진 줄기) |
| `FOREST_APRON_OFF_LAWN` | 둘레 그늘 덧칸 밑이 그늘용 잔디가 아니다 |

## 변조 실험(정답 예제를 한 곳씩 망가뜨려 검사) — `jp-img-forest-mutations`
| 장면 | 변조 | 검출(코드·좌표·층·칸) |
|---|---|---|
| `mut-layer` | (2,4) 4층 칸 19913 을 1층으로 옮김 | `FOREST_TILE_ON_LAYER1` (2,4) 1층 칸 19913 |
| `mut-trunk` | (5,6) 밑동 칸의 2~4층을 지움 | `FOREST_TRUNK_MISSING` (5,5) 3층 칸 19966 |
| `mut-road` | (3,0) 숲 밖 잔디를 길 3232 로 바꿈(그 위 수관 칸은 그대로) | `FOREST_OVER_FOREIGN` (3,0) 4층 칸 19775 |
정상 장면은 모두 0건: `ex` 0건, `grove` 0건, `thin` 0건, `road` 0건, `kits` 0건, `shrine` 0건, `street` 0건.
키트 격자(`kits`)도 0건이다 — 구조는 틀리지 않았지만 숲이 아니다(줄 맞춘 가로수). 이것은 검사가 못 잡는 «보기» 오류라서 그림(`jp-img-forest-kits-vs-forest`)으로 가른다.

## 정상/오류 그림
- 키트 격자 vs 숲: `jp-img-forest-kits-vs-forest`.
- 2줄 띠·길 사이: `jp-img-forest-thin-road` — 길 칸은 건너뛰고(`skipped`), 수관이 길 위로 안 넘친다.
- 저장 전 실패: `paint_jp_forest` 는 맵 사본에 칠하고 성공해야 반영한다 — 숲이 될 잔디 칸이 0이면 오류(`no-forest-cells`)로 멈추고 맵은 그대로다. jp_city 가 아닌 맵은 `wrong-tileset`, 숲 칸이 없는 옛 시트는 `forest-not-baked`.

## 층 설명 정정(전 → 후)
- 숲 밖 둘레 그늘 덧칸(예 `19577`)의 tileMeta 는 `defaultLayer: upper`·설명 «투명 덧그림: 붓은 위층»이지만, 엔진 composer 는 이 칸을 **2층**(priority `lower`, 사람 밑)에 둔다.
  조수가 이 칸을 손으로 다룰 일은 없다 — composer 가 놓고 지운다. 판단 근거는 tileMeta 가 아니라 이 문서의 층 표다.
- 나무 조각 tileMeta `defaultLayer: upper`(passage `star`)는 엔진과 같다(2~4층, 사람 위).
