# 일본 도시 — 정상/오류 · 자동 좌표 검증 · 층 정정 (총괄)

tilesetId `jp_city` · 그림 `public/assets/jp-city/jp-city-chipset.png`(텍스처 `tex_jp_city`, **11361칸**, 16px 칸, 시트 768×3792px, 한 줄 **48칸** — 번호 n 의 칸은 열 n%48, 행 n÷48(내림), 픽셀 좌표 (열×16, 행×16), 모두 0 기준). 계열 `oprn-jp` — 버들항(`oprn-atlas`)·현대 도시(`modern_city`, `oprn-modern`)·조선·숲마을·EasyRPG 칩셋의 칸 번호와 섞지 않는다.

이 용도는 다른 용도(오토타일·건물 조립 도구·도로 키트·상가 키트)에 흩어진 **정상/오류 나란한 그림과 맵 좌표 검증**을 한곳에서 찾는 지도다.
각 용도 문서에 정상 그림·오류 그림·변조 좌표가 이미 들어 있다 — 아래 표의 문서·그림 이름으로 찾아 읽는다. 이 용도 자체에는 변조 좌표 전체표(`jp-err-scenarios`)와 층 설명 정정(`jp-err-layer-correction`)이 있다.

## 검사의 정체
- 검사는 사람이 쓴 규칙이 아니라 **엔진 함수의 판정**이다: 오토타일은 `autotileVariantForCell`(이웃으로 고르는 칸), 층은 `tileLayerPolicy().home`, 통행은 `isPassable`·`passabilityOf`, 그림 순서는 `mapUpperTileDepth`, 건물은 `checkJpCityStructure`(조립기).
- 오류 그림은 정상 입력에서 **한 가지만 일부러 틀리게 바꾼** 실제 맵(`tiledata/jp-city/refs/engine_dump.mts` 가 실제 도구를 호출해 만든 결과)이고, 빨강 테두리가 검사가 짚은 칸이다. 좌표는 맵 칸 0 기준 (x,y).
- 건물 조립 도구(`build_jp_city_building`)는 틀린 입력이면 **맵을 바꾸지 않고** 코드와 좌표로 거부한다(변조 11건 전부 「맵 불변」). 낱칸 도구(`paint_tiles`·`stamp_layer_block`·`stamp_object`)는 막지 않고 사후 검사로만 잡는다.

## 코드 → 용도·문서·그림 지도
| 코드 | 뜻 | 실험 | 문서 | 오류 그림 | 고치는 법(레이어 정정 포함) |
|---|---|---|---|---|---|
| `autotile-stale` | 오토타일 멤버 칸이 이웃과 안 맞는다(재계산 안 됨) | 오토타일 17세트(세트마다 1건) | `jp-at-<세트>`·`jp-at-usage` | `jp-img-at-<세트>-err`(왼쪽) | 몸통 칸을 `paint_tiles` 로 다시 칠한다 |
| `wrong-layer` | 오토타일 칸이 칠하는 층이 아닌 층에 있다 | 오토타일 17세트(세트마다 1건) | `jp-at-<세트>`·`jp-at-usage` | `jp-img-at-<세트>-err`(오른쪽) | 지우고 맞는 층에 `paint_tiles` 로 칠한다 |
| `NO_DOOR` | 문 없음 | 건물 B1 | `jp-bld-errors` | `jp-img-err-bld-b1` | 표의 「고치는 법」(`jp-bld-errors`) |
| `TOO_NARROW` | 너무 좁음(w=2) | 건물 B2 | `jp-bld-errors` | `jp-img-err-bld-b2` | 표의 「고치는 법」(`jp-bld-errors`) |
| `ROOF_ORDER` | 지붕 없음 | 건물 B3 | `jp-bld-errors` | `jp-img-err-bld-b3` | 표의 「고치는 법」(`jp-bld-errors`) |
| `ROOF_ORDER` | 지붕 자리에 1층 띠 | 건물 B4 | `jp-bld-errors` | `jp-img-err-bld-b4` | 표의 「고치는 법」(`jp-bld-errors`) |
| `FLOOR_PAIR` | 층 자리에 1줄 띠 | 건물 B5 | `jp-bld-errors` | `jp-img-err-bld-b5` | 표의 「고치는 법」(`jp-bld-errors`) |
| `UNKNOWN_PART` | 모르는 1층 종류 | 건물 B6 | `jp-bld-errors` | `jp-img-err-bld-b6` | 표의 「고치는 법」(`jp-bld-errors`) |
| `DECO_CLASH` | 부착물이 창을 가림 | 건물 B7 | `jp-bld-errors` | `jp-img-err-bld-b7` | 표의 「고치는 법」(`jp-bld-errors`) |
| `DOOR_BLOCKED` | 문 앞 접근칸이 물 | 건물 B8 | `jp-bld-errors` | `jp-img-err-bld-b8` | 표의 「고치는 법」(`jp-bld-errors`) |
| `DOOR_BLOCKED` | 문 앞이 물웅덩이로 고립 | 건물 B9 | `jp-bld-errors` | `jp-img-err-bld-b9` | 표의 「고치는 법」(`jp-bld-errors`) |
| `DOOR_BLOCKED` | L자 본채 문이 별채에 가려짐 | 건물 B10 | `jp-bld-errors` | `jp-img-err-bld-b10` | 표의 「고치는 법」(`jp-bld-errors`) |
| `DOOR_BLOCKED`, `OUT_OF_MAP` | 건물이 맵 밖으로 | 건물 B11 | `jp-bld-errors` | `jp-img-err-bld-b11` | 표의 「고치는 법」(`jp-bld-errors`) |
| `road-gap` | 직선 반복 도로 줄이 끊김 | 도로 키트 | `jp-road-assembly` | `jp-img-err-road-gap` | 간격을 키트 폭으로 맞춘다 |
| `arm-misaligned` | 키트 팔이 같은 줄에 안 선다 | 도로 키트 | `jp-road-assembly` | `jp-img-err-road-shift` | 팔 오프셋 공식 위치로 옮긴다 |
| `overlay-in-base-layer` | 투명 표시 칸이 1층에 있다 | 도로 키트 | `jp-road-assembly` | `jp-img-err-road-mark-layer` | 3층으로 옮긴다(`stamp_object`) |
| `door-access-blocked` | 문 앞 접근칸이 막혔다 | 상가 키트 | `jp-shop-rules` | `jp-img-err-shop-door-access` | 소품을 접근칸 밖으로 옮긴다 |
| `back-over-front` | 뒷건물이 앞건물을 덮었다 | 상가 키트 | `jp-shop-rules` | `jp-img-err-shop-order` | 뒷줄 먼저·앞줄 나중 순서로 찍는다 |
| `building-in-lower-layer` | 건물 칸이 1층에 있다 | 상가 키트 | `jp-shop-rules` | `jp-img-err-shop-layer` | 3층으로 옮기고 1층은 땅으로 |

## 검사 범위 (과대 주장 금지)
| 보는 것 | 보지 않는 것 |
|---|---|
| 칸 번호·층·이웃 재계산 일치·막힘/걸음·문 앞 접근칸 도달·그림 순서·키트 팔 좌표 | 이벤트 실행(문 이동·대화)·움직이는 NPC·신호와 차량 흐름 |
| 건물 띠 순서·층 쌍·문 위치·부착물 겹침(조립기) | 색 조화·밀도·「좋아 보이는가」 같은 미적 품질 |
| 번들 안 키트·부품 id 와 좌표 | 이 문서를 읽는 낮은 성능 모델이 맞게 깔 확률(측정하지 않았다) |
검사 통과는 「구조·층·통행이 맞다」는 뜻일 뿐이다. 이 문서 묶음은 저장소의 전체 시험(`vitest`·게이트)을 돌린 결과가 아니다.

## 읽는 순서
`jp-err-overview`(이 문서) → 해당 용도의 문서(위 표) → 변조 좌표 전체표 `jp-err-scenarios` → 층 설명 정정 `jp-err-layer-correction`.
