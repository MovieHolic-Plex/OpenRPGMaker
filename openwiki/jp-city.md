# 일본 도시 번들 타일셋 (jp_city)

modern3 팔레트(154색) 손 도트로 그린 일본 도시(상가·주택·역·신사) 칸을 48열 시트로 구운 번들 칩셋. 새 프로젝트가 처음부터 갖고, 기존 프로젝트는 로드할 때 심긴다.
**`modern_city`(`oprn-modern`, 도쿄풍 합성 도시 통그림 키트)와 별개 번들이다.** 칸 번호·시트·키트·팔레트 규칙이 서로 다르고 섞지 않는다.

## 식별자

| 항목 | 값 |
|---|---|
| 타일셋 id | `jp_city` |
| 텍스처 키 | `tex_jp_city` (접두 `tex_` 제거 규칙과 같아 `bundledTilesetIdForAsset` 에 분기 없음) |
| 계열 | `oprn-jp` (라벨 "일본 도시(도트)", `src/project/tilesetFamily.ts`) |
| 이름 | 일본 도시 · 상가·주택·역·신사 (도트) |
| 시트 | 16px 칸, 한 줄 48열, 높이 ≤ 4096px |
| 조립 부품·오토타일 그룹·참고문서 id 머리 | `jp-` (번들 소유) |

## 파일

- 정의 모듈 `src/project/defaults/jpCity.ts` — `createJpCityTileset`, `ensureJpCityTileset`, `ensureJpCityReferences`, `isJpCityTileset`.
- 굽기가 만드는 파일(굽기 담당 소유): `public/assets/jp-city/jp-city-chipset.png`, 시트 메타 `src/assets/jpCitySheet.json`(`count`, `tilesPerRow`), 정의 `src/assets/jpCityTileset.json`(`name`·`tileSize`·`passability`·`priority`·`terrain`·`tileMeta`·`tileGroups`·`autotileGroups`·`animationStrips`·`structureKits`), 굽기 스크립트·소스 `scripts/content/jp-city/`, 자리 키 핀·출처 `tiledata/jp-city/`.
- 참고문서 `src/assets/jpCityReferences.json` (`TilesetReferenceCategory[]`, 이미지 바이트 없음 — `/assets/jp-city-references/*.png` 경로만). 6용도 47쪽·그림 124장. `createJpCityTileset` 이 들고 태어나고 `ensureJpCityReferences` 가 기존 프로젝트에 채운다. 굽기·검증은 아래 「AI 참고문서」 절.
- 배선: `src/assets/bundled.ts`(시트 import·항목·`bundledChipsetFrameCount`), `src/assets/bundledChipsetGeometry.ts`(열 수), `src/project/defaults/defaultAssets.ts`(`ensureBundledTilesets` 기존 사본 블록·`bundledEasyRpgTilesetBase`; 새 프로젝트는 `defaultTilesets()` 가 번들 목록을 돌며 자동 포함), `src/project/tilesetFamily.ts`, `src/project/tilesetHarness/combinedTown.ts`(RM2k3 투명 칩 보정 제외), `test/bundledTilesetIdParity.test.ts`.

## 굽기 규약 (TS 가 기대하는 것)

- 칸 번호는 덧붙이기 전용(자리 키 핀: 같은 번호에서 그림만 바뀌고 새 칸은 끝에 붙는다).
- 굽기가 내놓는 조립 부품 id 와 오토타일 그룹 id 는 반드시 `jp-` 로 시작해야 한다. 아니면 갱신 때 저자 항목으로 보고 번들 것을 새로 바꾸지 못한다.
- 정의 JSON 의 필수 키는 위 목록 그대로다(`modernCityTileset.json` 과 같은 모양).

## 기존 프로젝트 갱신 규칙

`ensureJpCityTileset` (`modern_city` 규칙 복제 + 오토타일 보존 개선):

- 열 수가 같고 칸 수 <= 번들: 같은 시트의 옛 굽기 — 번들 소유 칸 표(`count`·`passability`·`priority`·`terrain`·`tileMeta`·`tileGroups`·`animationStrips`)를 새 굽기로 바꾼다. **오토타일 그룹과 조립 부품은 `jp-` 항목만 번들 것으로 바꾸고 저자가 더한 것(다른 id)은 보존한다**(`modern_city` 는 오토타일 그룹을 통째로 교체한다). 맵·저작 참고문서는 건드리지 않는다.
- 칸 수 > 번들(더 새 번들에서 저장): 줄이지 않는다.
- 열 수가 다름: 다른 시트로 보고 칸 표를 통째로 바꾼다(저자 항목 포함).
- 변경 감지 요약은 층·통행 + `tileGroups` 개수 + `jp-` 오토타일 수 + 애니메이션 수 + `jp-` 키트 수다. 저자 항목은 세지 않는다(세면 로드마다 다시 갱신한다). `tileGroups` 는 번들이 통째로 소유한다.
- `ensureJpCityReferences`: `jp-` 문서·그림만 번들 것으로 바꾸고 빠진 용도는 덧붙인다. 저자 문서·공유 포인터(`referenceSourceTilesetId`)는 건드리지 않는다.

## 행인·팔레트

- 행인 `person.*`(Actor1 프레임)은 번들에서 **제외**한다. Actor1 은 타일이 아니고 출처·라이선스가 불확실하다.
- 새 칸의 색은 modern3 팔레트(`tiledata/atlas-pick/palette/modern3.pal`) 안이어야 한다. modern4(modern_city 쪽)로 확장하지 않는다.

## 조수 정책

`src/ai/modernTilesetPolicy.ts` 는 현대·현대 일본 맵 요청에 사용자 설치 PAW 업로드 칩셋만 허용한다. `jp_city` 는 번들 이미지(`tile.image.type !== "uploaded"`)이고 id 도 `paw-`/`shared_paw_` 가 아니라 승인 시트가 될 수 없다. 이 정책은 이번에 수정하지 않았다 — 후속 단계(조립 도구 노출 때)에서 허용 목록 추가를 다룬다.

## M3 건물 조립 도구 (`build_jp_city_building`)

가변 폭·층수 상가 건물을 **부품 사전 + 순수 조립기 + 맵 도구**로 짓는다. 선례는 손 도트 실내(`src/editor/handInterior/builder.ts` · `handInteriorTools.ts` · `handInteriorSpec.json`)다.
오류가 하나라도 있으면 **맵을 한 칸도 바꾸지 않는다.**

### 파일

| 파일 | 역할 |
|---|---|
| `scripts/content/jp-city/bake_spec.py` | 부품 사전 생성기(카탈로그 + `pins.json` + `jpCityTileset.json` + 시트). 같은 입력 → 바이트 동일. `--check` 로 지금 파일이 생성 결과와 같은지만 본다 |
| `src/assets/jpCityBuildingSpec.json` | 생성물(손 편집 금지). 띠 60 · 층 종류 9 · 1층 11 · 지붕 13 · 옥상 간판 3 · 처마 2 · 부착물 73(문 9 포함) · 거리 칸 48 · 완성 예제 25 |
| `src/editor/jpCity/builder.ts` | 순수 함수 `buildJpCityBuilding(input, {world?})` — 칸·통행·접근칸·issues. 맵·타일셋 의존 없음 |
| `src/editor/tools/jpCityTools.ts` | `list_jp_city_building_parts`(읽기) · `build_jp_city_building`(쓰기). `toolRegistry.ts` 에 `withDomain(JP_CITY_TOOLS, "tile")` |
| `scripts/content/jp-city/diff_builder.{py,mjs}` | Python 원본 `Kit` 과 TS 조립기의 칸 배열 일치 증명 |
| `scripts/content/jp-city/tamper_builder.mjs` | 오류 코드별 변조 시험 |

### 부품 사전 생성법

```
python3 scripts/content/jp-city/bake_spec.py            # src/assets/jpCityBuildingSpec.json 을 다시 쓴다
python3 scripts/content/jp-city/bake_spec.py --check    # 쓰지 않고 바이트까지 같은지만 (다르면 종료 코드 1)
```

칸 번호 = jp_city 시트 번호(원본 칸 번호와 같다). 칸마다 통행이 맥락(줄)별로 다르므로 `bake_jp.raw` 와 같은 규칙을 쓴다 —
띠는 `band_row_pc`(지면 층 둘째·셋째 줄 = 막힘, 나머지 ★), 부착물은 `deco_row_pc`(문 아래 두 줄만 막힘), 거리는 `street_pc`. 기본 pc 가 아니면 `jp16/<번호>@<pc>` 복제 칸 번호를 쓴다.
생성 중에 그 칸의 정의 JSON 통행·층이 기대 pc 와 맞는지 단언한다. **새 건물 부품을 굽기에 더하면 `bake_jp.py` 다음 `bake_spec.py` 순으로 다시 돌린다.**
사전은 `lower`(아래층 칸) · `solid`(막힘 칸) · `opaque`(불투명 칸 — 위 칸이 이것이면 밑 칸은 안 보여 버린다) 번호 목록도 담는다.

### 조립 규칙 (`Kit` 의 TS 이식)

- 띠 한 장: 왼쪽 끝(L) 1칸 + 몸통 모듈 `⌊(폭-3)/modw⌋` 번 반복 + 남는 칸 채움(F) + 오른쪽 끝 2칸(R0·R1). **폭 최소 3칸**, 모듈 폭 2 인 띠(베란다·발코니·옥상 간판·1층 대부분)는 홀수 남는 칸을 채움 칸이 메운다.
- 위에서 아래로: 지붕(또는 옥상 간판) → 윗층들(각 2줄) → (처마) → 1층(3줄). 셋백이면 지붕~`upper` 층은 양쪽 `ins` 칸 들이고 사이에 `terrace` 띠.
- 문(`door.*`, 2×3·machiya 3×3)은 부착물로 1층 위에 얹는다. 문 칸은 막힘, **접근칸 = 문 바로 아래 한 줄**(건물 사각형 바깥).
- L자: 본채 + `wing`(별채, 앞으로 `depth` 칸 튀어나옴) + 본채 앞 남는 땅(`lot` 주차장 또는 거리 칸). 별채 오른쪽 5px 그림자는 칸 번호로 못 그려 **생략**하고 경고(`SHADOW_OMITTED`)한다.
- 층 배정: 에디터 위층은 3층(`upperTiles`)·4층(`upperOverlayTiles`) 둘뿐. 한 칸에 `[띠 + 부착물 하나]`까지 얹는다. 위 칸이 온전히 불투명하면 밑 칸은 버린다(렌더 동일). 그래도 위층 칸이 3장 넘으면 `DECO_CLASH`.
- 통행은 **칸 번호가 정한다**(막힘 칸 = 위층 + 통행 불가). 도구는 찍은 뒤 엔진 `isPassable` 로 막힘 칸이 실제로 막혔는지, 문 앞 접근칸에서 걸어가는 칸이 6개 이상 이어지는지 다시 검사하고 아니면 맵을 되돌린다(복제본에 찍은 뒤 반영).

### 입력 스키마 (`build_jp_city_building`)

```jsonc
{ "mapId": "…(생략 시 지금 보는 맵, jp_city 맵이어야 함)",
  "x": 4, "y": 12,                       // 건물 발 = 왼쪽 아래 칸. 사각형은 (x, y-높이+1)~(x+w-1, y)
  "w": 6,                                // 폭(칸), 최소 3
  "floors": 3, "floorKind": "pairs", "wall": "shiro",         // 윗층 수 · 띠 종류 · 기본 벽
  "floorPlan": [{ "kind": "ribbon", "wall": "conc", "variants": [0,1] }],   // 주면 위 셋 대신(위에서 아래 순서)
  "ground": "gr.konbini.0", "groundVariants": [0],            // 1층(gr. 생략 가능)
  "door": { "type": "auto", "col": 2 },                       // 생략 시 1층 기본 문을 오른쪽 끝에
  "roof": "roof.ac.tank", "head": "roofsign.aka", "eave": "eave.slate",
  "setback": { "upper": 2, "ins": 1 },
  "decos": [{ "deco": "pipe", "col": 5, "floor": "0", "row": 0, "cols": ["kii","aka"] }],   // floor: "0".. | ground | head
  "wing": { "w": 4, "ground": "gr.glass.kii", "roof": "roof.plain.plain", "door": {"type":"cafe","col":1}, "side": "L", "depth": 2, "yard": "lot" } }
```

자유 키 객체는 없다(Gemini 400 규칙) — 모든 객체가 명시 필드 + `additionalProperties:false`. `list_jp_city_building_parts` 로 id 를 찾고 `example` 로 완성 예제 입력을 받는다.

### 오류 코드

| 코드 | 뜻 | 좌표 |
|---|---|---|
| `TOO_NARROW` | 폭 < 3 · 문 폭 · 셋백 후 윗층 폭 · 별채 폭(> 본채-2) 부족 | 발 |
| `ROOF_ORDER` | 맨 위가 지붕 띠가 아님 · 지붕 없음 · 처마가 1층 바로 위가 아님 · 옥상 간판 자리에 일반 지붕 | 발 |
| `FLOOR_PAIR` | 층 자리에 2줄 한 쌍이 아닌 띠 · 층 띠의 위·아래 줄이 비었음 | 발 / 비어 있는 칸 |
| `NO_DOOR` | 문 없음(`door.type:"none"`·null) | 발 |
| `DOOR_NOT_BOTTOM` | 문이 건물 맨 아래 줄이 아님(조립 결과 손상 검사 `checkJpCityStructure` 에서만 — 입력으로는 만들 수 없다) | 문 칸 |
| `DOOR_BLOCKED` | 문 앞 접근칸이 맵 밖·걸을 수 없음·고립(이어진 칸 < 6) · 본채 문이 별채에 가려짐 | 접근칸 / 문 |
| `DECO_CLASH` | 창 위에 간판·차양·실외기·빨래·광고·무시코 얹음(`gen.lint_specs` 규칙) · 부착물끼리 같은 칸 · 한 칸에 위층 3장 | 부착물 첫 칸 / 그 칸 |
| `UNKNOWN_PART` | 사전에 없는 층 종류·벽·변형·지붕·처마·1층·문·부착물·마당 | 발(부착물은 발+열) |
| `DOOR_OUT_OF_RANGE` · `DECO_OUT_OF_RANGE` · `OUT_OF_MAP` · `BAD_INPUT` | 문·부착물이 건물 밖 / 건물이 맵 밖 / 형식 오류 | |
| `SHADOW_OMITTED` | (경고) L자 별채 그림자 생략 | 발 |

### 차이 증명·변조 시험 실행

```
node scripts/content/jp-city/diff_builder.mjs                 # Python 덤프 → TS 조립 → 칸 배열 비교 → 렌더 화소 비교
node scripts/content/jp-city/diff_builder.mjs --json OUT.json # 행별 결과 저장
node scripts/content/jp-city/tamper_builder.mjs               # 조립기 32건 + 도구 10건(실제 jp_city 맵) 변조 시험
```

`diff_builder.py` 는 정답을 부품 사전과 **독립으로** 만든다(`Kit.assemble`/`assemble_L` 결과의 칸 이름 → 원본 번호 → `pins.json` 복제 칸, 통행은 Python 의 `walk` 격자에서). 비교 대상: 칸 번호 배열 · 부착물 목록(순서까지) · `walk` · `layer` · 문 칸 · 그림자 칸 · 막힘 격자 · `gen.lint_specs` 결과. 이어서 TS 가 정한 칸 층을 시트로 합성해 `Kit.render`(그림자 제외)와 **화소**까지 비교한다.

### 알려진 한계

- 한 칸에 투명 부착물 둘 + 띠(위층 3장)는 에디터 위층이 둘뿐이라 못 짓는다 → `DECO_CLASH`. 카탈로그 예제 중 `machiya_izakaya`(간판 `board.izakaya` 가 마치야 문 위로 겹침) · `L_machiya_annex`(같은 이유) 가 걸린다. 원본은 렌더만 하므로 겹쳐 그린다.
- `L_flats_lot` 은 별채의 `plate.mark.sora` 가 창 위라 원본 `gen.lint_specs` 도 지적한다(`diff_builder` 가 TS 와 같은 결과임을 확인). 카탈로그 원본의 M0 `DECOCLASH 0` 은 `build.lint_decos` 기준이라 이 별채 검사와 범위가 다를 수 있다 — 확인하지 못했다.
- L자 별채 오른쪽 그림자 5px 는 생략(칸 번호로 못 그림).
- 별채가 본채 앞 줄을 덮는 칸은 Python `walk` 가 별채 값으로 덮어써 «통과»지만 엔진은 밑 본채 막힘 칸이 먼저 막는다 — TS 는 엔진 기준.
- jpkit 미해결(층고 3칸, 마치야 용마루·鬼瓦, 창 그림자 대칭, 같은 높이 L자 지붕 병합·隅切り)은 이번에 손대지 않았다.

### 조수 정책 (M3 변경)

위 「조수 정책」 문단은 M1 시점 기록이다. M3 에서 `src/ai/modernTilesetPolicy.ts` 를 **최소 수정**했다 — 정책 의도(사용자가 설치한 PAW 원본만 쓰고 다른 외부 현대 소재로 대체·혼합 금지)는 외부 소재를 막는 것이고, `jp_city` 는 저장소가 손 도트로 구운 번들이다.
`isBundledJpCityTileset`(텍스처 키 `tex_jp_city`) 를 추가해 ① `requestsModernMap` 은 다루는 맵이 전부 jp_city 이면 false ② `modernTilesetViolation` 은 jp_city 맵을 건너뛴다. `MODERN_TILESET_POLICY_LINE` 문구와 `modern_city` 는 그대로다(`modern_city` 도 같은 한 줄로 허용 가능하나 제안만 한다).

## AI 참고문서 (6용도 · 47쪽 · 그림 124장)

계약 `tiledata/AI-REFERENCE-CONTRACT.md` 8항목을 모두 채운 번들 소유 참고문서다. 범위는 **지금 있는 부품만**(오토타일 17세트 · `build_jp_city_building` · 도로 키트 29 · 상가 키트: 레시피 25·문 9·소품 142)이고, 주택가·역·공원·신사 구역은 그림이 없어 「후속 추가 자리」 한 줄뿐이다.

| 용도 id | 쪽 | 그림 | 내용 |
|---|---|---|---|
| `jp-start` | 3 | 3 | 읽는 순서·층과 통행·실행 순서 · 칸 번호 영역 지도·거리 칸 사전 · 그룹 사전 |
| `jp-autotile` | 18 | 51 | 사용법·도구 행렬 + 17세트 문서(마스크 사전·입력→전체 배열→그림·오류 2건) |
| `jp-building` | 11 | 42 | 도구 사용법·부품 사전·완성 예제 25(전체 배열·그림)·변조 B1~B11 |
| `jp-road` | 7 | 12 | 키트 사전 29 · 팔 오프셋 공식·정답 조립·오토타일 이음 한계 · 오류 3건 |
| `jp-shop` | 5 | 15 | 레시피·문·소품 사전(칸 번호 전체) · 문 앞 접근칸·오류 3건 |
| `jp-errors` | 3 | 1 | 코드 → 문서·그림 지도 · 변조 좌표 전체표 · 엔진 판정 대 정의 층 설명 정정(전/후) |

### 굽는 법 (한 줄)

```bash
npx --no-install tsx tiledata/jp-city/refs/engine_dump.mts    # 실제 도구·엔진 실측 → refs/engine-results.json (약 5분, 저장소 루트)
python3 scripts/content/jp-city/bake_refs.py                   # 문서·그림·번들 JSON·refs/*.md 사본·refs/check-evidence.json
```

- 문서의 칸 번호·키트 배열·오류 좌표는 **전부 실측**이다: 건물은 실제 `build_jp_city_building`(25예제 + 변조 11건, 오류 때 맵 불변 확인), 오토타일은 `paint_tiles`·`fill_region`·`lay_path`·`stamp_layer_block`, 키트는 `stamp_object`, 판정은 `isPassable`·`passabilityOf`·`tileLayerPolicy().home`·`mapUpperTileDepth`. 손으로 쓴 값 없음.
- `bake_refs.py` 는 쓰기 전에 문서의 키트 배열을 정의와 대조하고(205종), 정의에 없는 키트 id·범위 밖 칸 번호·그림 파일 부재·긴 변 820px 초과·128색 초과를 막는다. 같은 입력이면 같은 바이트(JSON·PNG 해시 두 번 실행 일치).
- 오류 코드(`autotile-stale` `wrong-layer` `road-gap` `arm-misaligned` `overlay-in-base-layer` `door-access-blocked` `back-over-front` `building-in-lower-layer`)는 문서 수준 검사 이름이다. 건물 도구 코드(`TOO_NARROW` 등)만 런타임 코드다. 검사 범위는 구조·층·통행이고 이벤트 실행·미적 품질·모델 성공률은 주장하지 않는다.
- 층 정정: 정의의 그룹 `defaultLayer` 와 엔진 홈이 다른 칸이 있다(투명 덧그림 74칸 = 그룹 lower·엔진 upper, 소품·키트 밑부분 103칸 = 그룹 upper·엔진 lower, 계단 54칸 = ★ 인데 엔진 그림 순서 아래). **엔진이 정본**이며 문서가 정정한다(타일 정의 파일은 바꾸지 않았다).
- 한계(문서에 명시): 도로 키트 칸(3616~)은 오토타일 멤버가 아니라 이음새에서 끊긴다 · 예제 3개(`machiya_izakaya` `L_machiya_annex` `L_flats_lot`)는 도구가 `DECO_CLASH` 로 거부한다 · `stamp_layer_block` 은 3층 오토타일을 재성형하지 않는다 · 투명 덧그림을 layer "1"·"3" 로 칠하면 도구가 3층으로 돌려 놓고 재성형하지 않는다.
- 주택가·역·공원·신사 구역이 들어오면 `bake_refs.py` 에 용도·문서를 덧붙이고 이 표를 갱신한다.
