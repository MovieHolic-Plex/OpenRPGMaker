# 일본 도시 — 건물 조립 · 정상/오류 · 자동 좌표 검증

tilesetId `jp_city` · 그림 `public/assets/jp-city/jp-city-chipset.png`(텍스처 `tex_jp_city`, **3747칸**, 16px 칸, 시트 768×1264px, 한 줄 **48칸** — 번호 n 의 칸은 열 n%48, 행 n÷48(내림), 픽셀 좌표 (열×16, 행×16), 모두 0 기준). 계열 `oprn-jp` — 버들항(`oprn-atlas`)·현대 도시(`modern_city`, `oprn-modern`)·조선·숲마을·EasyRPG 칩셋의 칸 번호와 섞지 않는다.

`build_jp_city_building` 은 일부러 틀린 입력을 **정확한 코드와 맵 좌표로 거부**하고(맵 불변), 정상 입력은 짓는다. 아래는 실제 도구를 호출한 결과다(`engine_dump.mts`, 시험판 맵 건물 폭+4 × 높이+5, 사각형 (2,1) 시작 — 좌표는 맵 칸 0 기준).
저장 전에 실패하면 **부분 배치가 남지 않는다**: 도구는 복제본에 찍어 엔진 통행으로 다시 검사한 뒤에만 반영한다(변조 11건 모두 「맵 불변」 확인, 아래 표).

## 오류 코드와 고치는 법
| 코드 | 뜻 | 고치는 법 |
|---|---|---|
| `TOO_NARROW` | 폭이 최소(3칸)·문 폭·셋백·별채보다 좁다 | 폭을 늘린다(최소 3, 문 폭·셋백 들임 후 윗층 폭·별채 폭 ≤ 본채−2 도 확인) |
| `ROOF_ORDER` | 맨 위가 지붕 띠가 아니거나, 처마가 1층 바로 위가 아니다(지붕·처마 자리에 엉뚱한 띠) | 맨 위에 `roof.*`(또는 `head`)를 둔다. 처마 `eave` 는 1층 바로 위 처마 띠로, 지붕 자리에 1층 띠를 넣지 않는다 |
| `FLOOR_PAIR` | 한 층이 위·아래 2줄 한 쌍으로 채워지지 않았다 | 층 자리에는 위·아래 2줄 한 쌍인 층 띠(`fl.*`)만 넣는다(`terrace`·지붕 띠 금지) |
| `NO_DOOR` | 문이 없다(door.type none/null 포함) | `door` 를 주거나 생략한다(`type:"none"`·null 금지) |
| `DOOR_NOT_BOTTOM` | 문이 건물 맨 아래 줄에 있지 않다(길에서 닿을 수 없다) | (조립 결과 손상 검사 전용 — 입력으로는 만들 수 없다) |
| `DOOR_BLOCKED` | 문 앞 접근칸(문 바로 아래 한 줄)이 맵 밖이거나 걸을 수 없거나 고립됐다 / 본채 문이 별채에 가려졌다 | 문 앞 접근칸(문 바로 아래 한 줄)에서 걸을 수 있는 보도·도로를 6칸 이상 이어 깐다. 본채 문이 별채에 가리지 않게 `door.col` 을 옮긴다 |
| `DECO_CLASH` | 부착물이 창 위에 얹히거나, 부착물끼리 같은 칸을 덮거나, 한 칸에 위층 칸이 3장 이상 겹친다 | 간판·차양·실외기 등은 민벽(`blank`)·창 없는 칸에 얹고, 같은 칸에 부착물 둘을 겹치지 않는다 |
| `UNKNOWN_PART` | 사전에 없는 부품 id(층 종류·벽·변형·지붕·처마·1층·문·부착물·마당) | `list_jp_city_building_parts` 로 실제 id 를 확인한다 |
| `DOOR_OUT_OF_RANGE` | 문 열이 건물 밖이다 | `door.col` 을 0~(폭−문 폭) 안으로 |
| `DECO_OUT_OF_RANGE` | 부착물이 건물 사각형 밖이거나 없는 층을 가리킨다 | `decos[].col`·`floor`·`row` 를 건물 사각형 안·있는 층으로 |
| `OUT_OF_MAP` | 건물 사각형이 맵 밖으로 나간다 | 건물 발을 옮겨 사각형 전체가 맵 안에 들게 한다 |
| `BAD_INPUT` | 숫자·필드 형식이 틀렸다 | 숫자·필드 형식을 고친다(`floor` 는 문자열 "0"…) |
| `SHADOW_OMITTED` | (경고) L자 별채 그림자는 칸 번호로 그릴 수 없어 생략 | (경고) L자 별채 그림자 생략 — 조치 없음 |

## 변조 실험 (정상/오류 나란한 그림은 `jp-img-err-bld-<번호>`)
정상 입력은 편의점 6칸(3층, shiro, 지붕 `roof.ac.tank`, 문 auto 열 2)이다(B10 은 L자 정상판). 좌표는 오류 칸의 맵 좌표.
| 번호 | 변조 | 방법 | 기대 코드 | 도구 결과 | 맵 불변 | 검출 코드@맵 좌표 | 그림 |
|---|---|---|---|---|---|---|---|
| B1 | 문 없음 | door.type 을 none 으로 | `NO_DOOR` | 거부 `NO_DOOR` | 예 | `NO_DOOR`@(2,1) | `jp-img-err-bld-b1` |
| B2 | 너무 좁음(w=2) | 폭 w 를 2 로 줄임 | `TOO_NARROW` | 거부 `TOO_NARROW` | 예 | `TOO_NARROW`@(2,1) | `jp-img-err-bld-b2` |
| B3 | 지붕 없음 | roof 를 뺌 | `ROOF_ORDER` | 거부 `ROOF_ORDER` | 예 | `ROOF_ORDER`@(2,1) | `jp-img-err-bld-b3` |
| B4 | 지붕 자리에 1층 띠 | roof 에 gr.izakaya(1층 띠)를 넣음 | `ROOF_ORDER` | 거부 `ROOF_ORDER` | 예 | `ROOF_ORDER`@(2,1) | `jp-img-err-bld-b4` |
| B5 | 층 자리에 1줄 띠 | floorPlan 의 층 하나를 terrace(한 줄 띠)로 | `FLOOR_PAIR` | 거부 `FLOOR_PAIR` | 예 | `FLOOR_PAIR`@(2,1) | `jp-img-err-bld-b5` |
| B6 | 모르는 1층 종류 | ground 에 사전에 없는 id | `UNKNOWN_PART` | 거부 `UNKNOWN_PART` | 예 | `UNKNOWN_PART`@(2,1) | `jp-img-err-bld-b6` |
| B7 | 부착물이 창을 가림 | 쌍창(pairs) 층 창 위에 가로 간판 sign_h.aka 를 얹음 | `DECO_CLASH` | 거부 `DECO_CLASH` | 예 | `DECO_CLASH`@(3,3) | `jp-img-err-bld-b7` |
| B8 | 문 앞 접근칸이 물 | 문 바로 아래 접근칸 두 칸의 1층을 물(막힘)로 | `DOOR_BLOCKED` | 거부 `DOOR_BLOCKED` | 예 | `DOOR_BLOCKED`@(4,12), `DOOR_BLOCKED`@(5,12) | `jp-img-err-bld-b8` |
| B9 | 문 앞이 물웅덩이로 고립 | 접근칸 두 칸만 보도로 남기고 둘레를 전부 물로(이어진 칸 6개 미만) | `DOOR_BLOCKED` | 거부 `DOOR_BLOCKED` | 예 | `DOOR_BLOCKED`@(4,12), `DOOR_BLOCKED`@(5,12) | `jp-img-err-bld-b9` |
| B10 | L자 본채 문이 별채에 가려짐 | 본채 문 열을 별채가 서는 열(3)로 | `DOOR_BLOCKED` | 거부 `DOOR_BLOCKED` | 예 | `DOOR_BLOCKED`@(5,11), `DOOR_BLOCKED`@(5,12) | `jp-img-err-bld-b10` |
| B11 | 건물이 맵 밖으로 | 건물 발을 맵 가장자리 밖으로(x=맵 폭-3) | `OUT_OF_MAP` | 거부 `OUT_OF_MAP` | 예 | `OUT_OF_MAP`@(7,11), `DOOR_BLOCKED`@(10,12) | `jp-img-err-bld-b11` |

## 조립 결과를 직접 손상 (입력으로는 못 만드는 코드)
`checkJpCityStructure` 를 조립 결과에 직접 손상을 가해 돌렸다. 좌표는 건물 사각형 안 (열, 행).
| 손상 | 검출 |
|---|---|
| 층 띠 아랫줄 오른쪽 끝 칸을 비움 | `FLOOR_PAIR@(5,3)` |
| 문 칸을 윗층(행 2)으로 | `DOOR_NOT_BOTTOM@(3,2)` |
| 문 칸 목록 비움 | `NO_DOOR@(0,0)` |

## 검사 범위 (과대 주장 금지)
- 보는 것: 띠 순서·층 쌍·문 유무와 위치·부착물의 창 위 얹힘과 겹침·사전에 없는 id·맵 안 여부·문 앞 접근칸의 통행과 도달(≥6칸)·막힘 칸이 엔진에서 실제로 막히는지.
- **보지 않는 것**: 문 이동 이벤트 실행·움직이는 NPC·미적 품질(색 조화·밀도)·이 문서를 읽는 낮은 성능 모델이 맞게 지을 확률. 검사 통과는 「구조와 통행이 맞다」는 뜻일 뿐이다.
- 회귀 시험 스크립트 `node scripts/content/jp-city/tamper_builder.mjs`(조립기 32건 + 도구 10건)는 이 문서를 만들 때 전부 통과했다.

## 레이어 정정 조건 (건물)
건물·부착물 칸은 **3층(`upperTiles`)·4층(`upperOverlayTiles`)** 에만 둔다(홈 레이어 위층). 1층에 두면 아래 땅이 없어 검게 보이고 그림 순서가 어긋난다 — 상가 용도의 오류 코드 `building-in-lower-layer`(용도 「상가 키트·문·소품」). 1층(`lowerTiles`)에는 땅(마당·주차장·보도)만 둔다.
