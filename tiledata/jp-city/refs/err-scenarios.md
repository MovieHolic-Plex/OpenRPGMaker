# 일본 도시 — 변조 실험 전체표 (좌표)

tilesetId `jp_city` · 그림 `public/assets/jp-city/jp-city-chipset.png`(텍스처 `tex_jp_city`, **10182칸**, 16px 칸, 시트 768×3408px, 한 줄 **48칸** — 번호 n 의 칸은 열 n%48, 행 n÷48(내림), 픽셀 좌표 (열×16, 행×16), 모두 0 기준). 계열 `oprn-jp` — 버들항(`oprn-atlas`)·현대 도시(`modern_city`, `oprn-modern`)·조선·숲마을·EasyRPG 칩셋의 칸 번호와 섞지 않는다.

모든 실험은 실제 도구를 호출해 만든 맵이다(`tiledata/jp-city/refs/engine_dump.mts`, 같은 입력이면 같은 결과). 좌표는 시험판 맵의 칸 0 기준 (x,y), 「N칸」은 검사가 짚은 칸 수. 오류 그림은 각 용도 문서의 이름으로 열린다.

## 오토타일 17세트 (세트마다 2건, 입력 마스크는 각 세트 문서)
| 세트 | 칠하는 층 | 오류 1 | 검출 1 | 오류 2 | 검출 2 | 그림 |
|---|---|---|---|---|---|---|
| `jp-sidewalk-curb` | 1층(lowerTiles) | 몸통 칸 3183 그대로 찍음(재계산 없이) | `autotile-stale` 41칸: (1,1) (2,1) (3,1) (4,1) (5,1) … (총 41칸) | 같은 칸을 3층에 놓음 | `wrong-layer` 43칸: (1,1) (2,1) (3,1) (4,1) (5,1) … (총 43칸) | `jp-img-at-sidewalk-curb-err` |
| `jp-lane-road` | 1층(lowerTiles) | 몸통 칸 3232 그대로 찍음(재계산 없이) | `autotile-stale` 41칸: (1,1) (2,1) (3,1) (4,1) (5,1) … (총 41칸) | 같은 칸을 3층에 놓음 | `wrong-layer` 43칸: (1,1) (2,1) (3,1) (4,1) (5,1) … (총 43칸) | `jp-img-at-lane-road-err` |
| `jp-lawn-dirt` | 1층(lowerTiles) | 몸통 칸 3281 그대로 찍음(재계산 없이) | `autotile-stale` 41칸: (1,1) (2,1) (3,1) (4,1) (5,1) … (총 41칸) | 같은 칸을 3층에 놓음 | `wrong-layer` 43칸: (1,1) (2,1) (3,1) (4,1) (5,1) … (총 43칸) | `jp-img-at-lawn-dirt-err` |
| `jp-gravel-lawn` | 1층(lowerTiles) | 몸통 칸 3330 그대로 찍음(재계산 없이) | `autotile-stale` 41칸: (1,1) (2,1) (3,1) (4,1) (5,1) … (총 41칸) | 같은 칸을 3층에 놓음 | `wrong-layer` 43칸: (1,1) (2,1) (3,1) (4,1) (5,1) … (총 43칸) | `jp-img-at-gravel-lawn-err` |
| `jp-plaza-pave` | 1층(lowerTiles) | 몸통 칸 3379 그대로 찍음(재계산 없이) | `autotile-stale` 41칸: (1,1) (2,1) (3,1) (4,1) (5,1) … (총 41칸) | 같은 칸을 3층에 놓음 | `wrong-layer` 43칸: (1,1) (2,1) (3,1) (4,1) (5,1) … (총 43칸) | `jp-img-at-plaza-pave-err` |
| `jp-water-pond` | 1층(lowerTiles) | 몸통 칸 3428 그대로 찍음(재계산 없이) | `autotile-stale` 41칸: (1,1) (2,1) (3,1) (4,1) (5,1) … (총 41칸) | 같은 칸을 3층에 놓음 | `wrong-layer` 43칸: (1,1) (2,1) (3,1) (4,1) (5,1) … (총 43칸) | `jp-img-at-water-pond-err` |
| `jp-water-canal` | 1층(lowerTiles) | 몸통 칸 3477 그대로 찍음(재계산 없이) | `autotile-stale` 41칸: (1,1) (2,1) (3,1) (4,1) (5,1) … (총 41칸) | 같은 칸을 3층에 놓음 | `wrong-layer` 43칸: (1,1) (2,1) (3,1) (4,1) (5,1) … (총 43칸) | `jp-img-at-water-canal-err` |
| `jp-wall-block` | 3층(upperTiles) | 몸통 칸 3495 그대로 찍음(재계산 없이) | `autotile-stale` 27칸: (1,1) (2,1) (3,1) (4,1) (5,1) … (총 27칸) | 같은 칸을 1층에 놓음 | `wrong-layer` 27칸: (1,1) (2,1) (3,1) (4,1) (5,1) … (총 27칸) | `jp-img-at-wall-block-err` |
| `jp-hedge` | 3층(upperTiles) | 몸통 칸 3511 그대로 찍음(재계산 없이) | `autotile-stale` 27칸: (1,1) (2,1) (3,1) (4,1) (5,1) … (총 27칸) | 같은 칸을 1층에 놓음 | `wrong-layer` 27칸: (1,1) (2,1) (3,1) (4,1) (5,1) … (총 27칸) | `jp-img-at-hedge-err` |
| `jp-fence-mesh` | 3층(upperTiles) | 몸통 칸 3527 그대로 찍음(재계산 없이) | `autotile-stale` 27칸: (1,1) (2,1) (3,1) (4,1) (5,1) … (총 27칸) | 같은 칸을 1층에 놓음 | `wrong-layer` 27칸: (1,1) (2,1) (3,1) (4,1) (5,1) … (총 27칸) | `jp-img-at-fence-mesh-err` |
| `jp-guardrail` | 3층(upperTiles) | 몸통 칸 3543 그대로 찍음(재계산 없이) | `autotile-stale` 27칸: (1,1) (2,1) (3,1) (4,1) (5,1) … (총 27칸) | 같은 칸을 1층에 놓음 | `wrong-layer` 27칸: (1,1) (2,1) (3,1) (4,1) (5,1) … (총 27칸) | `jp-img-at-guardrail-err` |
| `jp-rail-track` | 1층(lowerTiles) | 몸통 칸 3559 그대로 찍음(재계산 없이) | `autotile-stale` 27칸: (1,1) (2,1) (3,1) (4,1) (5,1) … (총 27칸) | 같은 칸을 3층에 놓음 | `wrong-layer` 27칸: (1,1) (2,1) (3,1) (4,1) (5,1) … (총 27칸) | `jp-img-at-rail-track-err` |
| `jp-lane-center` | 2층(lowerOverlayTiles) | 몸통 칸 3575 그대로 찍음(재계산 없이) | `autotile-stale` 27칸: (1,1) (2,1) (3,1) (4,1) (5,1) … (총 27칸) | 같은 칸을 1층에 놓음 | `wrong-layer` 27칸: (1,1) (2,1) (3,1) (4,1) (5,1) … (총 27칸) | `jp-img-at-lane-center-err` |
| `jp-lane-dash` | 2층(lowerOverlayTiles) | 몸통 칸 3591 그대로 찍음(재계산 없이) | `autotile-stale` 27칸: (1,1) (2,1) (3,1) (4,1) (5,1) … (총 27칸) | 같은 칸을 1층에 놓음 | `wrong-layer` 27칸: (1,1) (2,1) (3,1) (4,1) (5,1) … (총 27칸) | `jp-img-at-lane-dash-err` |
| `jp-crosswalk-ew` | 2층(lowerOverlayTiles) | 몸통 칸 3595 그대로 찍음(재계산 없이) | `autotile-stale` 4칸: (1,2) (10,2) (1,3) (10,3) | 같은 칸을 1층에 놓음 | `wrong-layer` 20칸: (1,2) (2,2) (3,2) (4,2) (5,2) … (총 20칸) | `jp-img-at-crosswalk-ew-err` |
| `jp-crosswalk-ns` | 2층(lowerOverlayTiles) | 몸통 칸 3599 그대로 찍음(재계산 없이) | `autotile-stale` 4칸: (2,1) (3,1) (2,6) (3,6) | 같은 칸을 1층에 놓음 | `wrong-layer` 12칸: (2,1) (3,1) (2,2) (3,2) (2,3) … (총 12칸) | `jp-img-at-crosswalk-ns-err` |
| `jp-tactile` | 2층(lowerOverlayTiles) | 몸통 칸 3615 그대로 찍음(재계산 없이) | `autotile-stale` 27칸: (1,1) (2,1) (3,1) (4,1) (5,1) … (총 27칸) | 같은 칸을 1층에 놓음 | `wrong-layer` 27칸: (1,1) (2,1) (3,1) (4,1) (5,1) … (총 27칸) | `jp-img-at-tactile-err` |

## 건물 조립 도구 변조 B1~B11 (실제 `build_jp_city_building`, 시험판 건물 폭+4 × 높이+5, 사각형 (2,1) 시작)
| 번호 | 변조 | 도구 결과 | 맵 | 검출 코드@맵 좌표 |
|---|---|---|---|---|
| B1 | door.type 을 none 으로 | 거부 `NO_DOOR` | 맵 불변 | `NO_DOOR`@(2,1) |
| B2 | 폭 w 를 2 로 줄임 | 거부 `TOO_NARROW` | 맵 불변 | `TOO_NARROW`@(2,1) |
| B3 | roof 를 뺌 | 거부 `ROOF_ORDER` | 맵 불변 | `ROOF_ORDER`@(2,1) |
| B4 | roof 에 gr.izakaya(1층 띠)를 넣음 | 거부 `ROOF_ORDER` | 맵 불변 | `ROOF_ORDER`@(2,1) |
| B5 | floorPlan 의 층 하나를 terrace(한 줄 띠)로 | 거부 `FLOOR_PAIR` | 맵 불변 | `FLOOR_PAIR`@(2,1) |
| B6 | ground 에 사전에 없는 id | 거부 `UNKNOWN_PART` | 맵 불변 | `UNKNOWN_PART`@(2,1) |
| B7 | 쌍창(pairs) 층 창 위에 가로 간판 sign_h.aka 를 얹음 | 거부 `DECO_CLASH` | 맵 불변 | `DECO_CLASH`@(3,3) |
| B8 | 문 바로 아래 접근칸 두 칸의 1층을 물(막힘)로 | 거부 `DOOR_BLOCKED` | 맵 불변 | `DOOR_BLOCKED`@(4,12), `DOOR_BLOCKED`@(5,12) |
| B9 | 접근칸 두 칸만 보도로 남기고 둘레를 전부 물로(이어진 칸 6개 미만) | 거부 `DOOR_BLOCKED` | 맵 불변 | `DOOR_BLOCKED`@(4,12), `DOOR_BLOCKED`@(5,12) |
| B10 | 본채 문 열을 별채가 서는 열(3)로 | 거부 `DOOR_BLOCKED` | 맵 불변 | `DOOR_BLOCKED`@(5,11), `DOOR_BLOCKED`@(5,12) |
| B11 | 건물 발을 맵 가장자리 밖으로(x=맵 폭-3) | 거부 `OUT_OF_MAP` | 맵 불변 | `OUT_OF_MAP`@(7,11), `DOOR_BLOCKED`@(10,12) |
조립 결과 직접 손상(`checkJpCityStructure`, 좌표는 건물 사각형 안 (열,행)):
| 손상 | 검출 |
|---|---|
| 층 띠 아랫줄 오른쪽 끝 칸을 비움 | `FLOOR_PAIR@(5,3)` |
| 문 칸을 윗층(행 2)으로 | `DOOR_NOT_BOTTOM@(3,2)` |
| 문 칸 목록 비움 | `NO_DOOR@(0,0)` |

## 도로·상가 변조 6건
| 코드 | 변조 | 맵 좌표(x,y) |
|---|---|---|
| `road-gap` | `lane-h` 반복 두 번째를 x=7 에(정답 x=6) | (6,0), (6,1), (6,2), (6,3) |
| `arm-misaligned` | `lane-v` 를 x=11 에(정답 x=10) | (11,8) 에서 +1열 |
| `overlay-in-base-layer` | `jp-road-mark-bike-stop` 칸을 1층에 | (2,1) |
| `door-access-blocked` | `jp-prop-vend-pair` 를 (4,11) 에 찍어 `konbini-block` 접근칸을 막음 | (5,12), (6,12) |
| `back-over-front` | 앞줄 `konbini-block` 먼저·뒷줄 `sushi-bar` 나중 | 16칸: (4,6), (5,6), (6,6), (7,6), (4,7), (5,7) … |
| `building-in-lower-layer` | `stamp_layer_block` 으로 건물 칸을 1층에 | 66칸(예: (3,1), (4,1), (5,1), (6,1)…) |

## 읽는 법
- 코드 한 줄이 짚은 칸이 곧 고칠 자리다. 고치는 법은 총괄 `jp-err-overview` 의 표.
- 「맵 불변」은 도구가 부분 배치를 남기지 않는다는 뜻이다. 낱칸 도구의 오류는 맵이 이미 바뀐 뒤 사후 검사로 보인다.
- **보는 범위**: 칸 번호·층·통행·접근칸 도달. 이벤트 실행·미적 품질·모델 성공률은 보지 않는다.
