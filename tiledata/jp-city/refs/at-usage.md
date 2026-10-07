# 일본 도시 — 오토타일 사용법 · 도구와 층 · 정상/오류 판정

tilesetId `jp_city` · 그림 `public/assets/jp-city/jp-city-chipset.png`(텍스처 `tex_jp_city`, **10217칸**, 16px 칸, 시트 768×3408px, 한 줄 **48칸** — 번호 n 의 칸은 열 n%48, 행 n÷48(내림), 픽셀 좌표 (열×16, 행×16), 모두 0 기준). 계열 `oprn-jp` — 버들항(`oprn-atlas`)·현대 도시(`modern_city`, `oprn-modern`)·조선·숲마을·EasyRPG 칩셋의 칸 번호와 섞지 않는다.

오토타일은 「같은 세트의 칸끼리 이웃을 보고 가장자리·모서리 그림을 스스로 고르는 칸 묶음」이다. 맵에는 **몸통 칸**(8방: `variantMap[255]`, 4방: `variantMap[15]`)을 칠하면 도구가 둘레를 다시 계산해 알맞은 칸으로 바꾼다. 번호를 직접 골라 찍으면 모양이 안 맞는다.

## 이웃 비트와 칸 고르기 (엔진 `src/project/defaults/autotileEngine.ts`)
- 비트: N=1 E=2 S=4 W=8 NE=16 SE=32 SW=64 NW=128(8방), 4방은 하위 4비트만. `mask` = 이웃 칸(같은 세트의 칸) 쪽 비트의 합.
- 8방 정규화: 대각 비트는 **인접한 두 변이 모두 켜졌을 때만** 남는다(`canon`). 정의의 8방 7세트 모두 256키 전부에서 `variantMap[m] == variantMap[canon(m)]` 이고 서로 다른 `canon` 은 47개다(7세트 검증: 7/7 일치). 그래서 세트 문서의 사전은 `canon` 마스크 47개만 적는다.
- 칸 고르기: 칸의 이웃 8칸이 같은 세트 칸이면 비트 1, 아니면 0 → `mask` 를 `canon` 으로 바꿔 사전에서 칸 번호를 찾는다. 이웃으로 세는 칸(`connectTileIds`)은 **자기 세트 칸뿐**이다 — 다른 오토타일·도로 키트의 복사 칸과는 이어지지 않는다.
- 맵 밖은 이웃이 아니다(`edgeConnects:false`).

## 17세트 한눈에
| 오토타일 id | 이름(그룹 이름 = material) | 이웃 | 칸 번호 범위 | 칠하는 층 | 도구 | 문서 |
|---|---|---|---|---|---|---|
| `jp-sidewalk-curb` | 보도 연석 | 8방 | 3137~3185(49칸) | 1층(lowerTiles) | `fill_region`(면)·`lay_path`(길)·`paint_tiles` | `jp-at-sidewalk-curb` |
| `jp-lane-road` | 생활도로 | 8방 | 3186~3234(49칸) | 1층(lowerTiles) | `fill_region`(면)·`lay_path`(길)·`paint_tiles` | `jp-at-lane-road` |
| `jp-lawn-dirt` | 잔디 | 8방 | 3235~3283(49칸) | 1층(lowerTiles) | `fill_region`(면)·`lay_path`(길)·`paint_tiles` | `jp-at-lawn-dirt` |
| `jp-gravel-lawn` | 자갈 참배길 | 8방 | 3284~3332(49칸) | 1층(lowerTiles) | `fill_region`(면)·`lay_path`(길)·`paint_tiles` | `jp-at-gravel-lawn` |
| `jp-plaza-pave` | 판석 광장 | 8방 | 3333~3381(49칸) | 1층(lowerTiles) | `fill_region`(면)·`lay_path`(길)·`paint_tiles` | `jp-at-plaza-pave` |
| `jp-water-pond` | 연못 | 8방 | 3382~3430(49칸) | 1층(lowerTiles) | `fill_region`(면)·`lay_path`(길)·`paint_tiles` | `jp-at-water-pond` |
| `jp-water-canal` | 수로 | 8방 | 3431~3479(49칸) | 1층(lowerTiles) | `fill_region`(면)·`lay_path`(길)·`paint_tiles` | `jp-at-water-canal` |
| `jp-wall-block` | 블록담 | 4방 | 3480~3495(16칸) | 3층(upperTiles) | `paint_tiles`(line/cells) | `jp-at-wall-block` |
| `jp-hedge` | 생울타리 | 4방 | 3496~3511(16칸) | 3층(upperTiles) | `paint_tiles`(line/cells) | `jp-at-hedge` |
| `jp-fence-mesh` | 철망 울타리 | 4방 | 3512~3527(16칸) | 3층(upperTiles) | `paint_tiles`(line/cells) | `jp-at-fence-mesh` |
| `jp-guardrail` | 가드레일 | 4방 | 3528~3543(16칸) | 3층(upperTiles) | `paint_tiles`(line/cells) | `jp-at-guardrail` |
| `jp-rail-track` | 선로 | 4방 | 3544~3559(16칸) | 1층(lowerTiles) | `paint_tiles`(line/cells) | `jp-at-rail-track` |
| `jp-lane-center` | 중앙선 | 4방 | 3560~3575(16칸) | 2층(lowerOverlayTiles) | `paint_tiles`(line/cells) | `jp-at-lane-center` |
| `jp-lane-dash` | 차선 점선 | 4방 | 3576~3591(16칸) | 2층(lowerOverlayTiles) | `paint_tiles`(line/cells) | `jp-at-lane-dash` |
| `jp-crosswalk-ew` | 횡단보도(동서) | 4방 | 3592~3595(4칸) | 2층(lowerOverlayTiles) | `paint_tiles`(line/cells) | `jp-at-crosswalk-ew` |
| `jp-crosswalk-ns` | 횡단보도(남북) | 4방 | 3596~3599(4칸) | 2층(lowerOverlayTiles) | `paint_tiles`(line/cells) | `jp-at-crosswalk-ns` |
| `jp-tactile` | 점자블록 선 | 4방 | 3600~3615(16칸) | 2층(lowerOverlayTiles) | `paint_tiles`(line/cells) | `jp-at-tactile` |

## 도구 행렬 (실제 호출 실측 — `tiledata/jp-city/refs/engine_dump.mts`)
같은 12×8 시험판(몸통 칸을 칠한 마스크)을 도구마다 실제로 칠하고 엔진으로 검사한 결과다. 「N층에 놓임」은 도구가 그 칸을 놓은 층, 「재계산 안 됨 N칸」은 칠한 뒤에도 이웃에 맞는 칸이 아닌 칸 수다.
| 세트 | fill_region(면 채우기) | lay_path(길) | paint_tiles layer "1" | layer "2" | layer "3" |
|---|---|---|---|---|---|
| `jp-sidewalk-curb` | 정상 | 정상 | 1층에 놓임·정상 | 2층에 놓임·재계산 안 됨 9칸 | 1층에 놓임·정상 |
| `jp-lane-road` | 정상 | 정상 | 1층에 놓임·정상 | 2층에 놓임·재계산 안 됨 9칸 | 1층에 놓임·정상 |
| `jp-lawn-dirt` | 정상 | 정상 | 1층에 놓임·정상 | 2층에 놓임·재계산 안 됨 9칸 | 1층에 놓임·정상 |
| `jp-gravel-lawn` | 정상 | 정상 | 1층에 놓임·정상 | 2층에 놓임·재계산 안 됨 9칸 | 1층에 놓임·정상 |
| `jp-plaza-pave` | 정상 | 정상 | 1층에 놓임·정상 | 2층에 놓임·재계산 안 됨 9칸 | 1층에 놓임·정상 |
| `jp-water-pond` | 정상 | 정상 | 1층에 놓임·정상 | 2층에 놓임·재계산 안 됨 9칸 | 1층에 놓임·정상 |
| `jp-water-canal` | 정상 | 정상 | 1층에 놓임·정상 | 2층에 놓임·재계산 안 됨 9칸 | 1층에 놓임·정상 |
| `jp-wall-block` | 거부 `material-not-found` / layer "3": 거부 | 거부 `path-needs-autotile` | 0층에 놓임·정상 | 2층에 놓임·재계산 안 됨 9칸 | 0층에 놓임·정상 |
| `jp-hedge` | 거부 `material-not-found` / layer "3": 거부 | 거부 `path-needs-autotile` | 0층에 놓임·정상 | 2층에 놓임·재계산 안 됨 9칸 | 0층에 놓임·정상 |
| `jp-fence-mesh` | 거부 `material-not-found` / layer "3": 거부 | 거부 `path-needs-autotile` | 0층에 놓임·정상 | 2층에 놓임·재계산 안 됨 9칸 | 0층에 놓임·정상 |
| `jp-guardrail` | 거부 `material-not-found` / layer "3": 거부 | 거부 `path-needs-autotile` | 0층에 놓임·정상 | 2층에 놓임·재계산 안 됨 9칸 | 0층에 놓임·정상 |
| `jp-rail-track` | 정상 | 거부 `path-needs-autotile` | 1층에 놓임·정상 | 2층에 놓임·재계산 안 됨 9칸 | 1층에 놓임·정상 |
| `jp-lane-center` | 거부 `material-not-found` / layer "2": 거부 | 거부 `path-needs-autotile` | 3층에 놓임·재계산 안 됨 9칸 | 2층에 놓임·정상 | 3층에 놓임·재계산 안 됨 9칸 |
| `jp-lane-dash` | 거부 `material-not-found` / layer "2": 거부 | 거부 `path-needs-autotile` | 3층에 놓임·재계산 안 됨 9칸 | 2층에 놓임·정상 | 3층에 놓임·재계산 안 됨 9칸 |
| `jp-crosswalk-ew` | 거부 `material-not-found` / layer "2": 거부 | 거부 `path-needs-autotile` | 3층에 놓임·재계산 안 됨 9칸 | 2층에 놓임·정상 | 3층에 놓임·재계산 안 됨 9칸 |
| `jp-crosswalk-ns` | 거부 `material-not-found` / layer "2": 거부 | 거부 `path-needs-autotile` | 3층에 놓임·재계산 안 됨 9칸 | 2층에 놓임·정상 | 3층에 놓임·재계산 안 됨 9칸 |
| `jp-tactile` | 거부 `material-not-found` / layer "2": 거부 | 거부 `path-needs-autotile` | 3층에 놓임·재계산 안 됨 9칸 | 2층에 놓임·정상 | 3층에 놓임·재계산 안 됨 9칸 |
읽는 법과 규칙:
1. **지면 8방 7종**: 면은 `fill_region`, 굽은 길·강은 `lay_path`(경유점 2개 이상, `naturalness`·`seed`) 또는 `fill_region` 의 `path`+`width`, 낱칸은 `paint_tiles` layer "1". 전부 칠한 뒤 재계산 0칸 어긋남.
2. **위층 4방 4종(블록담·생울타리·철망·가드레일)**: `paint_tiles` layer **"3"** 의 line/cells. `fill_region` 은 「면 채우기 재료가 아님」으로 거부, `lay_path` 는 `path-needs-autotile`. **`stamp_layer_block` 은 3층 오토타일을 재성형하지 않는다**(기본 `reshape:true` 라도 1·2층만) — 번호를 그대로 찍어 어긋난다.
3. **선로**: 불투명 1층 땅 — `paint_tiles` layer "1" 의 line. `lay_path` 는 4방이라 거부.
4. **투명 덧그림 5세트(중앙선·차선 점선·횡단보도 둘·점자블록)**: **layer "2"** 로 칠한다. layer "1"·"3" 으로 요청하면 도구가 칸을 **3층으로 돌려 놓고 재성형하지 않아** 몸통 칸(십자)이 그대로 남는다(위 행렬 9칸 어긋남). `fill_region` 도 layer 를 안 주면 1층에 깔아 아래 땅이 없는 투명 칸이 검게 보이니 `layer:"2"` 를 준다.
5. **직접 번호 찍기 금지**: `stamp_layer_block` + `reshape:false`, 또는 맵 배열 직접 쓰기는 이웃을 보지 않으므로 어긋난다(세트 문서의 「오류 1」 그림).
6. **속칸 변형(`interiorVariants`)**: 8방 세트가 몸통 둘레 바깥에 갖는 깊이 변형 칸(단 0·단 1). 엔진 `shadeAutotileInterior` 의 몫인데 저장소에서 그것을 부르는 곳은 숲 윤곽 도구(`forestContour.ts`)뿐이다 — jp_city 도구 경로는 부르지 않으므로 도구가 칠한 속은 몸통 한 칸(`variantMap[255]`)이다. 손으로 속칸 변형을 심으면(완전 속칸에서) 재성형이 그 칸을 건드리지 않는다(`shapeAutotileGroupAround` 가 건너뜀).

## 키트와 이어붙이기 (한계 — 실측)
도로 키트의 도로 칸(3616~)은 오토타일 칸을 화소 그대로 **복사한 별개 칸**이라 오토타일의 멤버가 아니다(`jp-lane-road` 멤버와 겹치는 키트 칸 0개). 그래서 `jp-road-lane-h` 키트(6×4) 바로 오른쪽을 `fill_region` 으로 생활도로 칠하면 첫 칸이 **가장자리 칸 3217**(「북 열림 변」 — 이웃이 없다고 본 끝)으로 닫힌다 — 키트와 오토타일은 이음새에서 끊긴다.
키트는 키트끼리, 오토타일은 오토타일끼리 이어 칠한다(용도 「도로·교차로 키트」).

## 자동 좌표 검증 (이 용도)
검사 스크립트 `tiledata/jp-city/refs/engine_dump.mts` 는 엔진 함수 `autotileVariantForCell`·`tileLayerPolicy` 로 맵의 오토타일 멤버 칸을 훑는다.
| 코드 | 뜻 | 고치는 법 |
|---|---|---|
| `autotile-stale` | 멤버 칸이 있는 층에서 그 칸의 이웃으로 엔진이 고를 칸과 번호가 다르다(재계산 안 됨) | 몸통 칸을 `paint_tiles` 로 다시 칠한다 |
| `wrong-layer` | 멤버 칸이 그 세트의 칠하는 층이 아닌 층에 있다(세트 표 「칠하는 층」) | 칸을 지우고 맞는 층에 `paint_tiles` 로 칠한다 |
보는 범위는 **구조**(칸 번호와 층)다. 이벤트 실행·미적 품질·낮은 성능 모델이 맞게 칠할 확률은 이 검사로 주장하지 않는다. 변조 좌표는 세트 문서마다 있다.
