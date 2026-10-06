# 일본 도시 — 상가 키트·문·소품 규칙 (시점·통행·문 앞·반복/고정·배치 순서)

tilesetId `jp_city` · 그림 `public/assets/jp-city/jp-city-chipset.png`(텍스처 `tex_jp_city`, **8126칸**, 16px 칸, 시트 768×2720px, 한 줄 **48칸** — 번호 n 의 칸은 열 n%48, 행 n÷48(내림), 픽셀 좌표 (열×16, 행×16), 모두 0 기준). 계열 `oprn-jp` — 버들항(`oprn-atlas`)·현대 도시(`modern_city`, `oprn-modern`)·조선·숲마을·EasyRPG 칩셋의 칸 번호와 섞지 않는다.

## 키트 세 종류
- **레시피 25종**(`jp-recipe-*`): 건물 한 채 완성품(문·간판 부위 포함). 건물 조립 도구의 완성 예제 25개와 이름이 1:1 로 대응한다(`konbini_block` ↔ `jp-recipe-konbini-block`, L자는 `jp-recipe-l-…`). 칸 배열은 문서 「상가 레시피 사전」.
- **문 9종**(`jp-door-*`, 2×3 · 마치야 3×3): 건물 지면 층 위에 겹쳐 찍는 부착물. 문서 「문 사전」.
- **소품 142종**(`jp-prop-*`): 자판기·자전거·신호기·전봇대·나무·차량·열차·신사 문·계단·네온 등 거리 소품. 문서 「소품 사전」. 후속 추가 자리: 주택가·역·공원·신사 구역용 세트는 없다(여기 있는 건 개별 소품).
**모든 키트는 고정**(`repeatability: fixed`)이다 — 늘리거나 이어 붙이지 않는다. 가로로 늘어놓고 싶은 것(자전거 줄·볼라드 줄)은 같은 키트를 칸 간격으로 **한 번씩 따로** 찍는다.

## 3/4 시점 규칙 (그림 규약, 블록 계약 `scripts/content/jp-city/CONTRACT.md`)
- 시점: 윗면 + **남쪽 정면**(3/4). 빛은 왼쪽 위, 그림자는 오른쪽 아래. 높은 지형·건물은 남쪽 변에 앞면, 낮은 지형(물)은 북쪽 변에 앞면.
- 팔레트: modern3(154색) 안의 색만, 알파 0/255(반투명 없음), 윤곽은 램프의 어두운 단. AI 이미지·행인(Actor1)은 번들에 없다.
- 키트 칸의 위·아래 겹침(문+건물 칸)은 **겹쳐 구운 칸**(2880~3132)에 이미 반영돼 있다 — 낱칸으로 다시 겹치지 않는다.

## 통행 (엔진 판정 — 키트마다 `codes` 가 문서에 있다)
- 건물 레시피: **지면 층(1층 띠) 아래 두 줄과 문 칸은 막힘**, 그 위(윗층·처마·옥상)는 걸어 지나갈 수 있고 사람 위에 그려진다(★).
- 소품: **밑동 칸은 막힘**, 윗부분은 ★(걸음·캐릭터 위). 투명 소품도 밑동은 막는다. 바퀴·열차 아랫줄 같은 투명 아랫단은 걸을 수 있다(캐릭터 밑).
- 차량·열차는 정지 그림(움직이지 않는다) — 밑동 막힘.
- 칸 종류와 층·통행 대응표는 `jp-sheet-map`(칸의 통행 종류). 키트 `codes` 문자: `X` 막힘 · `*` 걸음 ★ · `.` 걸음 · `_` 빈 칸.

## 문 그림 · 문 앞 접근칸 · 출입구 · 상호작용 이벤트 (서로 다른 것)
| 구분 | 무엇 | 통행 | 비고 |
|---|---|---|---|
| 문 그림 | `jp-door-*` 2×3 부착물(레시피 안에는 합성 칸으로 이미 들어 있다) | 맨 아래 두 줄 막힘, 윗줄 ★ | 그림일 뿐 이동을 일으키지 않는다 |
| 출입구(입구 부위) | 키트 `parts` 의 `entrance`(문 칸 위치 dx,dy,w,h) | 막힘(문 칸) | `stamp_object` 응답이 입구 맵 좌표를 돌려준다(이벤트 자리) |
| 문 앞 접근칸 | 키트 바깥 **한 줄 아래**(`access`) | 걸을 수 있는 보도여야 한다 | 소품·차량으로 막지 않는다(막으면 `door-access-blocked`) |
| 상호작용·전이 이벤트 | 문 이동·대화 이벤트(저작자가 만든다) | - | 도구가 만들지 않는다. 이벤트는 입구 칸, 길은 입구 바로 아래 칸에서 끝낸다. **이 문서의 검사는 이벤트 실행을 보지 않는다** |

## 실행 순서 (상가 한 구역)
1. **바닥**: 보도·도로를 먼저 깐다(오토타일·도로 키트). 건물 키트의 -1 칸 아래가 비면 검게 보이고, 접근칸이 막힌다.
2. **건물**: 뒷줄(발 y 가 작은 쪽) 먼저, 앞줄 나중. 레시피는 `stamp_object({"objectId":"kit:jp_city/jp-recipe-<이름>","mapId":"<맵>","x":<왼쪽 위 x>,"y":<왼쪽 위 y>})`(키트 크기는 사전의 `w`×`h`, 발 = 왼쪽 위 + (0,h−1)). 폭·층을 바꾸려면 `build_jp_city_building`(용도 「건물 조립 도구」).
3. **문 앞 접근칸 확인**: 레시피마다 `access` 오프셋(문 아래 한 줄)에서 걸을 수 있는 칸이 6칸 이상 이어져야 한다 — 시험판(보도 위)에서는 전부 도달 7칸(아래 표).
4. **소품**: 보도·도로 위에 소품 키트를 찍는다. 접근칸·횡단보도 접점을 피한다. 소품 발밑이 막힘 칸이므로 길을 막지 않는 자리에 둔다.
5. **검사**: 용도 「정상/오류」·이 문서 끝의 변조 표(문 앞 막힘·뒷줄/앞줄 순서·건물 칸을 1층에).

## 레시피 25종의 문 앞 접근칸 도달 (시험판 맵 보도 위, 키트 왼쪽 위 (2,1), 엔진 `isPassable` BFS, 6칸이면 통과)
| 레시피 | 접근칸(키트 안 오프셋) 도달 칸 수(최대 7까지 센다) |
|---|---|
| jp-recipe-izakaya-tower | (1,17) 도달 7; (2,17) 도달 7 |
| jp-recipe-konbini-block | (2,11) 도달 7; (3,11) 도달 7 |
| jp-recipe-garage-flats | (3,17) 도달 7; (4,17) 도달 7 |
| jp-recipe-shutter-office | (0,13) 도달 7; (1,13) 도달 7 |
| jp-recipe-setback-shop | (2,16) 도달 7; (3,16) 도달 7 |
| jp-recipe-narrow-shutter | (1,11) 도달 7; (2,11) 도달 7 |
| jp-recipe-wide-konbini | (5,13) 도달 7; (6,13) 도달 7 |
| jp-recipe-izakaya-alt | (0,11) 도달 7; (1,11) 도달 7 |
| jp-recipe-garage-tall | (0,13) 도달 7; (1,13) 도달 7 |
| jp-recipe-big-setback | (4,14) 도달 7; (5,14) 도달 7 |
| jp-recipe-machiya-izakaya | (3,10) 도달 7; (4,10) 도달 7; (5,10) 도달 7 |
| jp-recipe-sushi-bar | (3,8) 도달 7; (4,8) 도달 7 |
| jp-recipe-ramen-tower | (5,13) 도달 7; (6,13) 도달 7 |
| jp-recipe-bento-corner | (3,9) 도달 7; (4,9) 도달 7 |
| jp-recipe-sento-front | (2,10) 도달 7; (3,10) 도달 7; (4,10) 도달 7 |
| jp-recipe-danchi-flats | (2,13) 도달 7; (3,13) 도달 7 |
| jp-recipe-bar-row | (2,11) 도달 7; (3,11) 도달 7 |
| jp-recipe-office-shutter | (4,11) 도달 7; (5,11) 도달 7 |
| jp-recipe-mansion-veranda | (4,15) 도달 7; (5,15) 도달 7 |
| jp-recipe-office-slide | (1,11) 도달 7; (2,11) 도달 7 |
| jp-recipe-mixed-tenant | (4,13) 도달 7; (5,13) 도달 7 |
| jp-recipe-slim-tower | (0,13) 도달 7; (1,13) 도달 7 |
| jp-recipe-l-office-cafe | (5,11) 도달 7; (6,11) 도달 7; (1,13) 도달 7; (2,13) 도달 7 |
| jp-recipe-l-machiya-annex | (4,10) 도달 7; (5,10) 도달 7; (6,10) 도달 7; (1,12) 도달 7; (2,12) 도달 7 |
| jp-recipe-l-flats-lot | (5,13) 도달 7; (6,13) 도달 7; (2,16) 도달 7; (3,16) 도달 7 |
25종 전부 모든 접근칸에서 도달 ≥ 6.

## 레시피 = 건물 조립 도구 결과? (같은 자리 화소 비교)
도구가 지은 화면과 같은 이름 레시피를 같은 자리에 `stamp_object` 로 찍은 화면을 화소 단위로 비교했다.
| 건물 조립 예제 | 레시피 키트 | 비교 |
|---|---|---|
| `izakaya_tower` | `jp-recipe-izakaya-tower` | 0/56320 화소 다름 |
| `konbini_block` | `jp-recipe-konbini-block` | 0/40960 화소 다름 |
| `garage_flats` | `jp-recipe-garage-flats` | 0/50688 화소 다름 |
| `shutter_office` | `jp-recipe-shutter-office` | 0/41472 화소 다름 |
| `setback_shop` | `jp-recipe-setback-shop` | 0/53760 화소 다름 |
| `narrow_shutter` | `jp-recipe-narrow-shutter` | 0/32768 화소 다름 |
| `wide_konbini` | `jp-recipe-wide-konbini` | 0/55296 화소 다름 |
| `izakaya_alt` | `jp-recipe-izakaya-alt` | 0/45056 화소 다름 |
| `garage_tall` | `jp-recipe-garage-tall` | 0/41472 화소 다름 |
| `big_setback` | `jp-recipe-big-setback` | 0/68096 화소 다름 |
| `machiya_izakaya` | `jp-recipe-machiya-izakaya` | 도구 거부 DECO_CLASH |
| `sushi_bar` | `jp-recipe-sushi-bar` | 0/29952 화소 다름 |
| `ramen_tower` | `jp-recipe-ramen-tower` | 0/50688 화소 다름 |
| `bento_corner` | `jp-recipe-bento-corner` | 0/32256 화소 다름 |
| `sento_front` | `jp-recipe-sento-front` | 0/42240 화소 다름 |
| `danchi_flats` | `jp-recipe-danchi-flats` | 0/46080 화소 다름 |
| `bar_row` | `jp-recipe-bar-row` | 0/36864 화소 다름 |
| `office_shutter` | `jp-recipe-office-shutter` | 0/40960 화소 다름 |
| `mansion_veranda` | `jp-recipe-mansion-veranda` | 0/56320 화소 다름 |
| `office_slide` | `jp-recipe-office-slide` | 0/36864 화소 다름 |
| `mixed_tenant` | `jp-recipe-mixed-tenant` | 0/50688 화소 다름 |
| `slim_tower` | `jp-recipe-slim-tower` | 0/36864 화소 다름 |
| `L_office_cafe` | `jp-recipe-l-office-cafe` | 228/50688 화소 다름 |
| `L_machiya_annex` | `jp-recipe-l-machiya-annex` | 도구 거부 DECO_CLASH |
| `L_flats_lot` | `jp-recipe-l-flats-lot` | 도구 거부 DECO_CLASH |
화소가 완전히 같은 예제 21개. 나머지 4개 중 `L_office_cafe` 는 별채 그림자(도구가 칸 번호로 못 그려 생략)에 해당하는 화소만 다르고, 3개(`machiya_izakaya` `L_machiya_annex` `L_flats_lot`)는 도구가 `DECO_CLASH` 로 거부해 비교 대상이 아니다.

## 정상/오류 — 자동 좌표 검증
| 코드 | 뜻 | 변조 | 맵 좌표(x,y) | 그림 |
|---|---|---|---|---|
| `door-access-blocked` | 문 앞 접근칸이 소품·차량·땅 때문에 막혔거나 걸어서 6칸 못 간다 | `jp-recipe-konbini-block`(발 아래 접근칸 (5,12)(6,12)) 위에 `jp-prop-vend-pair`(4×2)를 (4,11) 에 찍음 | (5,12), (6,12) | `jp-img-err-shop-door-access` |
| `back-over-front` | 겹치는 두 건물을 뒷줄이 나중에 찍혀 앞 건물을 덮었다 | 앞 `konbini-block`·뒤 `sushi-bar` 를 앞→뒤 순서로 찍음 | 16칸: (4,6), (5,6), (6,6), (7,6), (4,7), (5,7) … | `jp-img-err-shop-order` |
| `building-in-lower-layer` | 건물·소품 칸(홈 위층)이 1층에 있다 — 아래 땅이 사라지고 그림 순서가 어긋난다 | `stamp_layer_block` 로 건물 칸 66칸을 1층에 놓음 | 66칸(예: (3,1), (4,1), (5,1), (6,1)…), 그중 엔진에서 걸을 수 있다고 판정된 칸 54 | `jp-img-err-shop-layer` |
- 정상 대조: 변조 전 같은 맵 — `door-access-blocked` 0건(접근칸 도달 7, 7), `back-over-front`(뒷 → 앞 순서) 0건.
- **검사 범위**: 칸 번호·층·통행·접근칸 도달(구조). 이벤트 실행·움직이는 NPC·미적 품질·낮은 성능 모델이 맞게 깔 확률은 보지 않는다. 저장 전 실패하면 부분 배치가 남지 않는다는 보장은 `build_jp_city_building` 에만 있다 — `stamp_object` 는 맵 밖으로 나간 칸을 잘라 내고 경고만 한다(검사는 이 표의 코드를 사후에 훑는 방식).
**레이어 정정 조건**: 건물·소품 칸은 3층(`upperTiles`)에만, 땅은 1층에만 둔다. 건물 칸이 1층에 있으면 `building-in-lower-layer` — 3층으로 옮기고 1층은 땅(보도)으로 되돌린다. 키트를 `stamp_object` 로 통째로 찍으면 층이 지켜진다.
