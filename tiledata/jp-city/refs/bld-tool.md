# 일본 도시 — 건물 조립 도구 `build_jp_city_building` 사용법

tilesetId `jp_city` · 그림 `public/assets/jp-city/jp-city-chipset.png`(텍스처 `tex_jp_city`, **3747칸**, 16px 칸, 시트 768×1264px, 한 줄 **48칸** — 번호 n 의 칸은 열 n%48, 행 n÷48(내림), 픽셀 좌표 (열×16, 행×16), 모두 0 기준). 계열 `oprn-jp` — 버들항(`oprn-atlas`)·현대 도시(`modern_city`, `oprn-modern`)·조선·숲마을·EasyRPG 칩셋의 칸 번호와 섞지 않는다.

가변 폭·층수 **상가 건물**(상가·아파트·사무소·마치야·L자 별채)을 **부품 사전 + 순수 조립기 + 맵 도구**로 짓는다. 건물을 낱칸으로 칠하지 않는다. **오류가 하나라도 있으면 맵을 한 칸도 바꾸지 않는다**(복제본에 찍어 엔진 통행으로 다시 확인한 뒤에만 반영). jp_city 맵에서만 동작한다.
관련 도구: `list_jp_city_building_parts`(읽기 — 부품 사전·`example` 로 완성 예제 입력). 코드: `src/editor/tools/jpCityTools.ts` · 조립기 `src/editor/jpCity/builder.ts` · 사전 `src/assets/jpCityBuildingSpec.json`.

## 좌표 (원점·방향)
- `x`,`y` = 건물 **발 = 왼쪽 아래 칸**(0 기준 맵 좌표). 사각형은 `(x, y-높이+1)`~`(x+w-1, y)` — 위로 자란다.
- 문 칸 = 건물 맨 아래 줄(막힘). **문 앞 접근칸 = 문 바로 아래 한 줄**(`y+1`, 건물 사각형 바깥) — 걸을 수 있는 보도·도로여야 한다.
- 높이는 `띠 줄 수의 합`이다: 지붕(또는 옥상 간판) + 윗층 N×2 + (처마) + 1층 3줄 + (셋백이면 테라스 1줄). 예제 22개 전부 도구 결과의 높이와 일치(아래 표 + 각 예제).

## 실행 순서 (반드시)
1. `list_jp_city_building_parts` 로 id 를 확인한다(인자 없음 = 층 종류·벽·1층·지붕·문 목록, `query` = 부착물 검색, `example` = 완성 예제 입력). id 를 지어내지 않는다 — 사전은 이 용도의 「부품 사전」 문서에 칸 배열째 있다.
2. **문 앞 바닥을 먼저 깐다**: 문 아래 접근칸에서 걸을 수 있는 칸이 6개 이상 이어져야 한다(보도·도로). 바닥이 없으면 `DOOR_BLOCKED`.
3. **뒷줄 건물(발 y 가 작은 쪽)을 앞줄보다 먼저** 짓는다. 겹치는 두 건물은 나중에 찍은 쪽이 위에 그려진다.
4. `build_jp_city_building` 을 부른다. 성공하면 `rect`·`doors`·`access`·`solidCells`·`warnings` 를 돌려준다. 실패하면 코드·좌표·고칠 방법만 오고 맵은 그대로다.
5. 문 이동 이벤트는 **도구가 만들지 않는다**. 이벤트는 문 칸(`data.doors`), 길은 접근칸(`data.access`)에서 끝낸다 — 문 그림·문 앞 접근칸·출입구·상호작용(이벤트)은 서로 다른 것이다.

## 입력 스키마 (`additionalProperties:false`, 자유 키 객체 없음)
```json
{"mapId":"<jp_city 맵 id, 생략하면 지금 보는 맵>","x":4,"y":12,"w":6,
 "floors":3,"floorKind":"pairs","wall":"shiro",
 "floorPlan":[{"kind":"ribbon","wall":"conc","variants":[0,1]}],
 "ground":"gr.konbini.0","groundVariants":[0],
 "door":{"type":"auto","col":2},
 "roof":"roof.ac.tank","head":"roofsign.aka","eave":"eave.slate",
 "setback":{"upper":2,"ins":1},
 "decos":[{"deco":"pipe","col":5,"floor":"0","row":0,"cols":["kii","aka"]}],
 "wing":{"w":4,"ground":"gr.glass.kii","roof":"roof.plain.plain","door":{"type":"cafe","col":1},"side":"L","depth":2,"yard":"lot"}}
```
| 필드 | 뜻 | 규칙 |
|---|---|---|
| `x`,`y`,`w`,`ground` | 필수. 발 칸·폭·1층 종류 | `w` 최소 3(왼쪽 끝 1 + 오른쪽 끝 2). 1층 종류는 `gr.` 를 생략해도 된다(`shop` 은 같은 뜻의 별칭) |
| `floors`/`floorKind`/`wall` | 윗층 수(숫자)·모든 층의 띠 종류·기본 벽 | 한 층 = 위·아래 2줄. 기본 띠 `pairs`, 기본 벽 `kinari` |
| `floorPlan` | 층별 지정(**위에서 아래 순서**, `[0]` 이 맨 위 층) | 주면 `floors`·`floorKind`·`wall` 대신. 항목 = `kind`·`wall`·`variants`(몸통 변형 번호 목록, 모듈마다 돌려 쓴다)·`band`(띠 id 직접 지정, 보통 안 쓴다) |
| `door` | 문 종류와 왼쪽 열 `col`(0 기준) | 생략하면 1층 종류의 기본 문을 **오른쪽 끝**에. `type:"none"`/null = 문 없음 → `NO_DOOR` |
| `roof` / `head` / `eave` | 지붕 띠·옥상 간판 띠(지붕 자리를 대신)·처마 띠(1층 바로 위) | 맨 위는 지붕 띠(`roof.*`) 또는 옥상 간판(`roofsign.*`)이어야 한다 |
| `setback` | `upper` 번호 층보다 위는 양쪽 `ins` 칸 안으로 들인다 | `w - 2×ins ≥ 3`. 들이는 층 아래에 테라스 띠(`terrace`) 1줄이 낀다 |
| `decos[]` | 부착물(간판·차양·실외기·비상계단 …) | `deco`(id)·`col`(건물 왼쪽 끝 기준 열)·`floor`(**문자열** "0"(맨 위 윗층)·"1"… / `ground` / `head`)·`row`(띠 안에서 아래로 내릴 줄 수)·`cols`(`vstack.{{c}}` 의 색 목록) |
| `wing` | L자: 본채 + 앞으로 튀어나온 별채 | `w`·`ground` 필수. `side` L/R(기본 L)·`depth`(기본 2, 1~12)·`yard`(본채 앞 남는 땅: `lot` 주차장 기본 또는 거리 칸 이름). 별채 폭 ≤ 본채 폭 − 2 |

## 조립 규칙 (띠 문법 — `Kit` 의 TS 이식, Python 원본과 칸 배열·화소 일치를 증명)
- **띠 한 장**(폭 `nb`): 왼쪽 끝 `L` 1칸 + 몸통 모듈 `⌊(nb-3)/modw⌋` 번 반복(모듈마다 `variants` 를 돌려 쓴다) + 남는 칸은 채움 `F` + 오른쪽 끝 `R0`·`R1` 2칸. `modw` 가 2 인 띠(베란다·발코니·옥상 간판·1층 대부분)는 홀수 남는 칸을 `F` 가 메운다. 띠의 칸 배열 전체는 「부품 사전」 문서.
- **위에서 아래**: 지붕(또는 옥상 간판) → 윗층들(각 2줄) → (처마) → 1층(3줄). 셋백이면 위쪽 층만 안으로 들이고 사이에 `terrace`.
- **문**(`door.*` 2×3, 마치야 3×3)은 부착물로 1층 위에 얹는다. 문 칸은 막힘(맨 아래 두 줄), 접근칸 = 문 바로 아래 한 줄. 문 그림은 **고정** 조각(늘어나지 않는다), 띠 몸통·층 수는 **반복**.
- **L자**: 본채 + `wing`. 본채 앞 남는 땅은 `lot`(주차장) 또는 거리 칸. 별채 오른쪽 5px 그림자는 칸 번호로 못 그려 **생략**하고 경고 `SHADOW_OMITTED`.
- **층 배정**: 에디터 위층은 3층(`upperTiles`)·4층(`upperOverlayTiles`) 둘뿐 — 한 칸에 `[띠 + 부착물 하나]`까지 얹는다. 위 칸이 온전히 불투명하면 밑 칸은 버린다(화면은 같다). 그래도 위층 칸이 3장 넘으면 `DECO_CLASH`.
- **통행은 칸 번호가 정한다**(막힘 칸 = 위층 + 통행 불가). 도구는 찍은 뒤 엔진 `isPassable` 로 ① 막힘 칸이 실제로 막혔는지 ② 문 앞 접근칸에서 걸어갈 수 있는 칸이 **6개 이상** 이어지는지 다시 검사하고, 아니면 맵을 되돌린다.

## 응답 예 (실제 도구 결과)
정상(`konbini_block`, 맵 10×16, 발 (2,11)):
> 일본 도시 건물 6×11칸을 (2,1)~(7,11) 에 지었다(m) — 문 (4,11) (5,11), 문 앞 접근칸 (4,12) (5,12) 에서 6칸 이상 이어짐 확인, 막힘 칸 12개 엔진 통행과 일치

거부(`L_flats_lot`):
> 건물을 짓지 않았다 — 오류 1건: DECO_CLASH(3,10) 별채: 부착물 plate.mark.sora 이(가) 0번 층 창 위에 얹힌다(열 1) — 간판·차양·실외기·빨래·광고는 민벽(blank)이나 창이 없는 칸에만 붙는다

## 높이 = 띠 줄 수의 합 (예제 25, 도구 결과의 사각형 높이와 대조)
| 예제 | 띠(위→아래)(줄 수) | 줄 수 합 | 도구 결과 높이 |
|---|---|---|---|
| izakaya_tower | roofsign.aka(4) + fl.balcony.kinari(2) + fl.balcony.kinari(2) + fl.balcony.kinari(2) + fl.pairs.kinari(2) + fl.pairs.kinari(2) + gr.izakaya(3) | 17 | 17 |
| konbini_block | roof.ac.tank(2) + fl.curtain.kinari(2) + fl.curtain.kinari(2) + fl.ribbon.hodo(2) + gr.konbini.0(3) | 11 | 11 |
| garage_flats | roof.plain.plain(2) + fl.balcony.shiro(2) + fl.balcony.shiro(2) + fl.balcony.shiro(2) + fl.balcony.shiro(2) + fl.balcony.shiro(2) + fl.balcony.shiro(2) + gr.garage(3) | 17 | 17 |
| shutter_office | roof.plain.tank(2) + fl.ribbon.conc(2) + fl.pairs.conc(2) + fl.blank.conc(2) + fl.pairs.conc(2) + gr.shutter.sora(3) | 13 | 13 |
| setback_shop | roof.plain.tank(2) + fl.pairs.kinari(2) + fl.ribbon.kinari(2) + terrace(1) + fl.ribbon.kinari(2) + fl.balcony.kinari(2) + fl.balcony.kinari(2) + gr.glass.kii(3) | 16 | 16 |
| narrow_shutter | roof.plain.plain(2) + fl.pairs.shiro(2) + fl.pairs.shiro(2) + fl.pairs.shiro(2) + gr.shutter.aka(3) | 11 | 11 |
| wide_konbini | roofsign.sora(4) + fl.curtain.kinari(2) + fl.ribbon.kinari(2) + fl.pairs.kinari(2) + gr.konbini.1(3) | 13 | 13 |
| izakaya_alt | roof.ac.plain(2) + fl.tile.kinari(2) + fl.tile.kinari(2) + fl.tile.kinari(2) + gr.izakaya(3) | 11 | 11 |
| garage_tall | roofsign.kii(4) + fl.blank.hodo(2) + fl.blank.hodo(2) + fl.pairs.hodo(2) + gr.garage(3) | 13 | 13 |
| big_setback | roof.plain.tank(2) + fl.ribbon.shiro(2) + terrace(1) + fl.balcony.hodo(2) + fl.balcony.hodo(2) + fl.tile.kinari(2) + gr.glass.sora(3) | 14 | 14 |
| machiya_izakaya | roof.hip.slate(2) + fl.koushi.kinari(2) + fl.koushi.kinari(2) + eave.slate(1) + gr.machiya(3) | 10 | 10 |
| sushi_bar | roof.hip.slate(2) + fl.pairs.shiro(2) + eave.slate(1) + gr.machiya(3) | 8 | 8 |
| ramen_tower | roofsign.aka(4) + fl.ribbon.conc(2) + fl.pairs.conc(2) + fl.balcony.conc(2) + gr.shutter.aka(3) | 13 | 13 |
| bento_corner | roof.plain.tank(2) + fl.pairs.kinari(2) + fl.pairs.kinari(2) + gr.konbini.1(3) | 9 | 9 |
| sento_front | roof.hip.slate(2) + fl.tile.kinari(2) + fl.koushi.shiro(2) + eave.slate(1) + gr.machiya(3) | 10 | 10 |
| danchi_flats | roof.plain.tank(2) + fl.balcony.hodo(2) + fl.balcony.hodo(2) + fl.balcony.hodo(2) + fl.balcony.hodo(2) + gr.garage(3) | 13 | 13 |
| bar_row | roofsign.sora(4) + fl.pairs.kinari(2) + fl.pairs.kinari(2) + gr.izakaya(3) | 11 | 11 |
| office_shutter | roof.plain.tank(2) + fl.ribbon.shiro(2) + fl.pairs.shiro(2) + fl.pairs.shiro(2) + gr.shutter.kii(3) | 11 | 11 |
| mansion_veranda | roof.stair.cyl(2) + fl.veranda.shiro(2) + fl.veranda.shiro(2) + fl.veranda.shiro(2) + fl.veranda.shiro(2) + fl.veranda.shiro(2) + gr.garage(3) | 15 | 15 |
| office_slide | roof.ac.cyl(2) + fl.slide.kinari(2) + fl.slide.kinari(2) + fl.slide.kinari(2) + gr.shutter.kii(3) | 11 | 11 |
| mixed_tenant | roof.stair.plain(2) + fl.slide.conc(2) + fl.slide.conc(2) + fl.pairs.conc(2) + fl.veranda.conc(2) + gr.konbini.0(3) | 13 | 13 |
| slim_tower | roofsign.kii(4) + fl.slide.hodo(2) + fl.slide.hodo(2) + fl.slide.hodo(2) + gr.glass.sora(3) | 13 | 13 |
| L_office_cafe | roof.plain.tank(2) + fl.ribbon.shiro(2) + fl.pairs.shiro(2) + fl.pairs.shiro(2) + gr.shutter.sora(3) | 11 | 13 |
| L_machiya_annex | roof.hip.slate(2) + fl.koushi.kinari(2) + fl.koushi.kinari(2) + eave.slate(1) + gr.machiya(3) | 10 | 12 |
| L_flats_lot | roof.stair.cyl(2) + fl.veranda.conc(2) + fl.veranda.conc(2) + fl.veranda.conc(2) + fl.veranda.conc(2) + gr.garage(3) | 13 | 16 |
(L자 3종은 본채+별채 합성이라 별채가 더 튀어나온 만큼 높이가 다르다.)

## 한계 (정직하게)
- 한 칸에 투명 부착물 둘 + 띠(위층 3장)는 에디터 위층이 둘뿐이라 못 짓는다 → `DECO_CLASH`. 완성 예제 중 **3개가 이 도구로 거부된다**: `machiya_izakaya`, `L_machiya_annex`, `L_flats_lot`(각 예제의 오류 코드·좌표는 「완성 예제」 문서). 원본 렌더는 겹쳐 그리지만 에디터 층 한계로 못 짓는다.
- L자 별채의 그림자 5px 는 생략. 별채가 본채 앞 줄을 덮는 칸은 엔진 통행 기준(밑 본채 막힘 칸이 먼저 막는다).
- 층고 3칸·마치야 용마루·같은 높이 L자 지붕 병합 등은 이번 부품에 없다.
- **검사 범위**: 구조(띠 순서·층 쌍·문·부착물 충돌)와 통행(막힘 칸·접근칸 도달). 이벤트 실행·미적 품질·낮은 성능 모델의 성공률은 검사하지 않는다.
- 주택가·역·공원·신사용 건물 부품은 **후속 추가 자리**(지금 없음).
