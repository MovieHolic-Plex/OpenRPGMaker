---
name: jp-city-building-authoring
description: Use when laying out a Japanese shop street (상가 거리·상점가·편의점·이자카야 골목) on the bundled 16px tileset jp_city (family oprn-jp) — ground autotiles, road/crossing kits, and buildings built one at a time with build_jp_city_building (width/floors/wall/ground/roof/door/signs), error-code fixes, layer rules for transparent overlays. 일본 상가 거리 맵을 jp_city 로 깔 때, 건물이 안 지어지거나 문 앞이 막힐 때.
---

# 일본 상가 거리 짓기 (jp_city)

칩셋은 **`jp_city` 하나**다(계열 `oprn-jp`, 16px, 시트 48칸 폭, 3728칸, modern3 팔레트 손 도트). 버들항(`oprn-atlas`)·PAW·조선·EasyRPG 와 칸 번호가 다르고 섞지 않는다.
이 문서의 원본은 저장소 `assistant-skills/jp-city-building-authoring/SKILL.md`. 편집기 조수는 같은 내용을 참고문서 6용도(`list_tileset_references({tilesetId:"jp_city"})` → `jp-start`·`jp-autotile`·`jp-building`·`jp-road`·`jp-shop`·`jp-errors`)와
도구 설명·오류 문장으로 받는다(조수 스킬 읽기 도구 `read_assistant_skill` 은 agent/atlas-policy 가 main 에 들어와야 켜진다).
도구·조립 규칙의 정본은 `openwiki/jp-city.md`, 코드는 `src/editor/jpCity/builder.ts`(순수 조립기)·`src/editor/tools/jpCityTools.ts`(도구).

## 1. 공통 원칙 (코딩 에이전트·편집기 조수)

1. **건물은 낱칸으로 칠하지 않는다.** 건물 한 채 = 띠 부품 조립(지붕 → 윗층 N → 처마? → 1층 3줄). 같은 그림이 여러 키트에 공유돼 낱칸 번호만 봐서는 무엇인지, 통행이 어떤지 알 수 없다. `build_jp_city_building` 으로 짓는다.
2. **땅 → 도로 키트 → 문 앞 보도 → 뒷줄 건물 → 앞줄 건물 → 소품 → 검사** 순서. 새 jp_city 맵은 **비어 있다**(`lowerTiles` -1 → 검게 보임). 건물 자리 밑까지 땅을 먼저 깐다.
3. **건물 사각형을 겹치지 않게 간격을 둔다 — 도구는 겹침을 거부하지 않는다.** 나중에 찍은 건물이 앞 건물의 칸을 말없이 덮어쓴다(실측 2026-10-04: 3층 편의점 6×11 을 발 y 가 9줄 차이로 둘 찍으면 둘 다 «성공»이지만 뒷건물의 문 줄이 앞건물 지붕에 덮인다).
   앞줄 발 y ≥ 뒷줄 발 y + 앞줄 높이 + 1(뒷줄 문 앞 보도 줄). 뒷줄(맵 위쪽)부터 찍고, 찍을 때마다 `show_map_region` 으로 겹침을 눈으로 본다.
4. **문 앞 접근칸(문 바로 아래 한 줄)은 걸을 수 있어야 한다**: 거기서 걸어갈 수 있는 칸이 6개 이상 이어져야 도구가 짓는다. 소품·차량·물로 막지 않는다.
5. **투명 덧그림(중앙선·차선 점선·횡단보도·점자블록)은 2층(`paint_tiles layer "2"`)에만.** 1·3층으로 요청하면 도구가 3층으로 돌려 놓고 모양을 맞추지 않는다.
6. **한 번에 한 건물, 한 번에 한 가지 고친다.** 오류가 나면 도구는 맵을 한 칸도 바꾸지 않는다(복제본에 찍어 엔진 통행으로 다시 검사한 뒤에만 반영). 오류 코드·좌표가 곧 고칠 곳이다.
7. **공간이 남으면 맵이 큰 것.** 건물 사이를 의미 없이 채우지 말고, 맵을 상가 거리 폭(보통 50×36 안팎)으로 줄인다.

## 2. 건물 하나 짓는 순서 (`build_jp_city_building`)

```
list_jp_city_building_parts()                       # 층 종류·벽·1층·지붕·문·부착물 분류·완성 예제 25 목록
list_jp_city_building_parts({example:"konbini_block"})   # 예제 입력 — mapId·x·y 만 더해 그대로 넣는다
list_jp_city_building_parts({query:"간판"})              # 부착물 73종 검색
build_jp_city_building({mapId, x, y, w, floors, floorKind, wall, ground, roof, door, decos, …})
```

- `x,y` = 건물 **발 = 왼쪽 아래 칸**. 사각형은 `(x, y-높이+1)~(x+w-1, y)`. 높이 = 지붕(보통 2줄) + 윗층×2 + 1층 3줄(+처마). 예: 3층 `roof.ac.tank` 편의점 = 6×11칸.
- 문 앞 접근칸 = `(문 열, y+1)`. 건물 아래에 **한 줄 이상** 남겨야 한다.
- 폭 최소 3. 띠 = 왼쪽 끝 1칸 + 몸통 모듈 반복 + 남는 칸 채움 + 오른쪽 끝 2칸. 층·1층·문에 `variants` 로 몸통 변형을 돌려 쓴다.
- 막힐 땐 **완성 예제를 받아 고친다.** 예제 25개 중 22개는 그대로 지어진다. `machiya_izakaya`·`L_machiya_annex`·`L_flats_lot` 셋은 에디터 층 한계(`DECO_CLASH`)로 이 도구가 거부한다 → 같은 모양의 완성 키트를
  `stamp_object({objectId:"kit:jp_city/jp-recipe-machiya-izakaya" | "jp-recipe-l-machiya-annex" | "jp-recipe-l-flats-lot", mapId, x, y})`(x,y = 키트 **왼쪽 위**)로 찍는다.
- 거리 한 줄을 채울 땐 같은 y(발 줄)에 폭+간격 2칸씩 옮겨 가며 지어 변화를 준다(편의점·이자카야·셔터 사무소·아파트·마치야 섞기). 같은 예제를 연달아 두 번 쓰지 않는다.

### 오류 코드 → 고치는 법 (도구 메시지의 「다음:」과 같다)

| 코드 | 고친다 |
|---|---|
| `DOOR_BLOCKED` | 문 앞에 `fill_region({rect:{x,y(=문 아래 줄),w,h}, material:"보도 연석", referencePurpose:"jp-start"})` 로 바닥을 깔고 **같은 인자로 다시** 부른다. 맵 밖이면 건물 y 를 줄인다. 별채가 본채 문을 가리면 `door.col` 을 옮긴다 |
| `TOO_NARROW` | `w` 를 늘린다(최소 3, 문 폭 이상, 별채 폭 ≤ 본채-2, 셋백 들임 후 윗층 폭 확인) |
| `ROOF_ORDER` | `roof`(또는 `head`)를 준다. `eave` 는 1층 바로 위에만 |
| `FLOOR_PAIR` | 층 자리에는 2줄 한 쌍 `kind`(pairs·slide·veranda·koushi·ribbon·curtain·balcony·tile·blank)만 |
| `NO_DOOR` | `door` 를 빼면(기본 문) 오른쪽 끝에 붙는다. `type:"none"` 금지 |
| `DECO_CLASH` | 간판·차양·실외기·빨래·광고는 **창 없는 칸(blank 층·1층 벽)** 에. 같은 칸에 부착물 둘 금지. 한 칸 위층 3장 겹침이면 부착물 하나를 뺀다 |
| `UNKNOWN_PART` | `list_jp_city_building_parts` 로 실제 id (`gr.` `roof.` 머리는 생략 가능, 부착물 `vstack.{c}` 는 `cols` 와 함께) |
| `DOOR_OUT_OF_RANGE` · `DECO_OUT_OF_RANGE` | `door.col`·`decos[].col` 이 0~w-1 안. `floor` 는 문자열 `"0"`(맨 위 윗층)·`"1"`… 또는 `ground`·`head` |
| `OUT_OF_MAP` | x,y 를 옮겨 사각형 전체가 맵 안에 들게 한다(건물은 위로 자란다) |
| `tileset-family-mismatch` | 맵이 jp_city 가 아니다 — 이 도구는 jp_city 맵에서만 동작한다 |
| `SHADOW_OMITTED` (경고) | L자 별채 그림자는 칸 번호로 못 그려 생략 — 조치 없음 |

## 3. 땅과 도로

- **면**(보도 연석·생활도로·잔디·자갈 참배길·판석 광장·연못·수로): `fill_region({mapId, rect, material:"<그룹 이름>", referencePurpose:"jp-start"})`. 몸통 칸만 칠하면 도구가 가장자리·모서리를 맞춘다.
- **길**(굽은 길·강): `lay_path({mapId, points:[…2개 이상], material:"생활도로", width})`. 선형 4방 세트(블록담·생울타리·철망·가드레일·선로·중앙선 …)는 `path-needs-autotile` 로 거부된다.
- **위층 4방 4종**(블록담·생울타리·철망 울타리·가드레일): `paint_tiles({layer:"3", mode:"line", from, to, tile:<몸통 칸 variantMap[15]>})`. `fill_region` 은 「면 채우기 재료가 아님」으로 거부. `stamp_layer_block` 은 3층 오토타일을 재성형하지 않는다.
- **투명 덧그림 5종**: `paint_tiles({layer:"2", mode:"line", …})`. 몸통 칸 번호는 참고문서 `jp-at-lane-center`·`jp-at-lane-dash`·`jp-at-crosswalk-ew|ns`·`jp-at-tactile` 의 사전.
- **교차로·T자·건널목·굽은 길**은 키트: `stamp_object({objectId:"kit:jp_city/jp-road-lane-x", mapId, x, y})`, x,y = 키트 왼쪽 위. 29종: `jp-road-lane-h|v`(직선 6×4·4×6, 같은 키트를 간격 두고 반복) ·
  `-t-s|w|n|e`(T자 12×8·8×12) · `-x`(십자 12×12) · `-bend-es|sw|wn|ne`(8×8) · `-end-w|n|e|s`(막다른 길) · `jp-road-trunk-h|v|x`(간선 4차선, 십자 29×29) · `jp-fumikiri-v|h(-closed)`(철도 건널목) ·
  `jp-road-sign-*`·`-signal-*`·`-mark-*`(표지·신호기·노면 표시, 1×2~3×1). 키트끼리 이어 붙이는 식과 정답 조립은 `jp-road-assembly`. **키트와 오토타일은 이음새에서 끊긴다** — 키트는 키트끼리, 오토타일은 오토타일끼리 잇는다.
- 거리 소품 142종·문 9종은 `stamp_object({objectId:"kit:jp_city/jp-prop-…"})`(용도 `jp-shop`의 소품 사전). 소품 밑동은 막힘 — 문 앞 접근칸·횡단보도 접점을 피한다.

## 4. 칠하기 전 참고문서 게이트 (편집기 조수)

`fill_region`·`lay_path`·`paint_tiles`·`place_props` 처럼 모델이 타일을 직접 고르는 도구는 **한 용도의 모든 페이지·그림을 읽은 다음 응답**에서만 칠해진다(`referencePurpose` 지정).
입구 용도 `jp-start`(문서 3·4쪽·그림 3장 — 2026-10-04 실측, 굽기마다 바뀔 수 있다)가 가장 가볍고 도구 지도와 층·통행 규칙이 거기 있다. `build_jp_city_building`·`stamp_object`·`create_map` 은 게이트 밖이다.
실패 사례(2026-10-04 헤드리스 시험): 조수가 jp-start 의 문서 하나와 그림만 읽고 `fill_region` 을 불러 거부되고, 76건짜리 `jp-autotile` 로 옮겨 다시 거부돼 땅을 끝내 못 깔았다(맵이 검게 남음). **jp-start 의 문서 3개(`jp-order`·`jp-sheet-map`·`jp-dict-groups`(2쪽))와 그림 3장을 전부** 읽고, 읽은 응답이 아니라 **다음 응답**에서 `referencePurpose:"jp-start"` 와 함께 칠한다.
`jp-autotile`(26쪽·그림 51)을 통째로 읽어야 하는 것은 아니다 — 세트 사전이 필요할 때 문서 한두 개만 따로 `read_tileset_reference` 로 읽는다.

## 5. 새 맵 시작

- 지금 보는 맵이 jp_city 가 아니면: `create_map({name, width:50, height:36, tilesetId:"jp_city"})`. 보는 맵이 **다른 계열**이면 실행기가 `tileset-family-change` 로 거부한다 →
  `ask_tileset_change({toTilesetId:"jp_city", reason})` 로 사용자에게 견본을 보이고 그 턴을 끝낸다(사용자가 승인하면 다음 요청에서 통과).
- 일본 거리에 `author_beodeul_town` 은 쓰지 않는다(버들항 전용).
- `jp_city` 에는 실내·행인·움직이는 칸이 없다. 가게 안은 다른 칩셋의 실내 맵으로, 행인은 이벤트의 캐릭터 그래픽(Actor1)으로.

## 6. 검증 (끝낸 뒤)

1. `check_reachability({mapId, from, targets})` — 시작점에서 문 앞 접근칸까지 걸어가는가.
2. `show_map_region` — **눈으로 본다**: 검은 빈칸(땅이 안 깔린 곳)·건물 겹침·지워진 윗부분이 없는가.
3. `run_lint`. 건물 지은 칸 위의 이벤트가 있으면 도구가 경고한다(옮긴다).
4. 보고에는 지은 건물 수, 실패한 코드와 고친 내용, 도달 확인 결과를 그대로 적는다. 모르는 것을 성공이라 쓰지 않는다.

## 7. 코딩 에이전트만

- 부품 사전 `src/assets/jpCityBuildingSpec.json` 은 생성물이다: `python3 scripts/content/jp-city/bake_spec.py`(굽기 `bake_jp.py` 다음). 손으로 고치지 않는다.
- 조립기 차이 시험: `node scripts/content/jp-city/diff_builder.mjs`(Python 원본 63/64 일치), 변조 시험 `node scripts/content/jp-city/tamper_builder.mjs`.
- 새 블록(주택가·역·공원·신사)은 `blocks/<이름>.py` → `bake_jp.py` `BLOCK_ORDER` 에 이름 추가 → `bake_spec.py`. 그림은 사람이 고른 것만(`npm run harness -- jp-city`).
- 도구 문장을 고치면 `jpCityTools.ts` 의 `NEXT_ACTION`·`doorBlockedFix` 가 오류 → 다음 행동 문장의 정본이다.

## 8. 편집기 조수만

- 이 칩셋의 일은 위 도구 목록으로 끝난다: `create_map`(tilesetId jp_city) · `fill_region`/`lay_path`/`paint_tiles`/`stamp_object` · `list_jp_city_building_parts`/`build_jp_city_building` ·
  `check_reachability`/`show_map_region`/`run_lint`. 도구가 안 보이면 `find_tools("jp_city")`.
- 같은 오류로 세 번 실패하면 **예제를 받아 그대로** 짓는다(`example`). 부분 성공을 지어내지 않는다.
- 사용자가 PAW 설치 칩셋을 쓰라고 한 요청은 이 칩셋이 아니다 — 요청에 칩셋이 정해지지 않았거나 일본 상가 거리를 말했을 때만 jp_city.
