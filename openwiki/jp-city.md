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
- 참고문서 `src/assets/jpCityReferences.json` (`TilesetReferenceCategory[]`, 이미지 바이트 없음 — `/assets/jp-city-references/*.png` 경로만). 15용도 145쪽·그림 267장 (2026-10-13 재굽기: 거리 시설에 하천·다리·철도·일체형 정면 143종·지붕·옥상 키트 추가, 계획 단계 철도는 「아직 연결 안 됨」 표시). `createJpCityTileset` 이 들고 태어나고 `ensureJpCityReferences` 가 기존 프로젝트에 채운다. 굽기·검증은 아래 「AI 참고문서」 절.
- 배선: `src/assets/bundled.ts`(시트 import·항목·`bundledChipsetFrameCount`), `src/assets/bundledChipsetGeometry.ts`(열 수), `src/project/defaults/defaultAssets.ts`(`ensureBundledTilesets` 기존 사본 블록·`bundledEasyRpgTilesetBase`; 새 프로젝트는 `defaultTilesets()` 가 번들 목록을 돌며 자동 포함), `src/project/tilesetFamily.ts`, `src/project/tilesetHarness/combinedTown.ts`(RM2k3 투명 칩 보정 제외), `test/bundledTilesetIdParity.test.ts`.

## 굽기 규약 (TS 가 기대하는 것)

- 칸 번호는 덧붙이기 전용(자리 키 핀: 같은 번호에서 그림만 바뀌고 새 칸은 끝에 붙는다).
- **번호가 실제로 밀린 사고(2026-10-14~18, 2026-10-20 발견):** 낡은 `pins.json` 으로 구운 PR 이 머지되며 번호가 밀렸다 — #2899 한 번에 11,329칸, 그 밖에 fbe80f3·f8a7d06·1e5a3f1·4c8c1df·ec73a64 가 128~458칸. 그 전에 게시한 장소 32곳(`public/assets/region-references/jp-city-*.oprn.json`·`src/project/regionReferences/jp-city-*.json`)이 지금 시트로 엉뚱한 칸을 그렸다(가져오기·조수 `import_region_reference` 모두). 고침: `maps/remap-refs.mjs --from 0d4f13e7c8` 가 그 장소를 만든 굽기의 핀 → 자리 키 → 지금 핀으로 번호를 옮기고 타일셋 사본을 지금 정의(칸 이름표 뺀 사본)로 바꾼다. 동네 한 장은 키트에서 뺀 칸(블록 담 등)을 써서 `town.mjs --publish` 로 다시 지었다. 그 기간에 jp_city 로 맵을 만든 **사용자 프로젝트**는 옛 번호다 — 아래 「사용자 프로젝트 복구」.
- **번호가 다른 판(지금 번호와 견줌, 커밋 시각 KST):** ① 10-09 14:50~10-14 15:38(0d4f13e~d1e786d, 덧붙이기만 한 굽기는 같은 판) ② 10-14 15:38~15:53(fbe80f3) ③ 10-14 15:53~10-18 12:00(f8a7d06) ④ 10-18 12:00~15:11(#2899 275fc20) ⑤ 10-18 15:11~15:48(1e5a3f1) ⑥ 10-18 20:28~23:47(9cba5ea; ec73a64 가 되돌림). 10-18 15:48~20:28(4c8c1df~4cce899)과 ec73a64 이후는 지금과 같은 번호다.
- **사용자 프로젝트 복구(2026-10-21) — 자동 이주는 하지 않는다.** 프로젝트는 맵을 어느 시트 판에서 그렸는지 저장하지 않는다: jp_city 타일셋 사본은 로드마다 `ensureJpCityTileset` 이 그때 번들 것으로 갈아 끼워(칸 수·표가 다르면) 남는 것은 「마지막으로 연 판」뿐이고, `meta.bootNormalization` 도 마지막 정규화 빌드일 뿐이다. 앞 판에서 그린 맵을 다음 판에서 열어 저장하면 사본은 다음 판·맵 번호는 앞 판이 된다(맵마다 다를 수 있다). 지금 번호로 그린 맵에도 모든 판 표가 「옮길 칸」을 내놓는다(실측: 대조용 파출소 맵에 판 ①~③ 이 173칸씩). 그래서 확실히 가를 수 없고 옮기지 않는다.
  대신 편집기 맵 목록 우클릭(초보 모드는 맵 상세 버튼) **「jp_city 칸 번호 복구」**(jp_city 맵에만 보인다, `src/editor/jpCityPinRepairDialog.ts`)가 「지금 그대로」와 판마다 옮긴 결과를 같은 자리로 그려 보여 주고 사람이 고른다. 적용하면 로컬 폴더는 `backups/` 사본을 먼저 만들고, 실행 취소 한 단계(`applyProjectWithHistory`)로 들어가며, `meta.oprnJpCityPinRepairs` 에 {맵·판·시각·옮긴 칸·그대로 둔 칸·옮긴 명령 수} 를 남긴다. 기록이 있는 맵은 다시 옮기지 않는다(멱등). 옮기는 것: 층 4개·칸 더미·기물 묶음(놓은 칸·밑 칸)·그 맵을 가리키는 「타일 바꾸기」 명령(맵 이벤트·공통 이벤트). jp_city 아닌 맵·고르지 않은 맵은 건드리지 않는다.
  표 `src/assets/jpCityPinEras.json`(37KB, 창을 열 때만 읽는다)은 `maps/bake-pin-eras.mjs` 가 pins.json 이력에서 굽는다 — 게시 장소를 옮긴 `remap-refs.mjs` 와 같은 `maps/pinRemap.mjs`(옛 번호 → 자리 키 → 지금 번호)를 쓴다. 지금 핀에 자리 키가 없는 칸(그 판 뒤 키트에서 빠지거나 크기가 바뀐 칸)은 그 판 시트와 **화소가 똑같은** 지금 칸이 있으면 그리로 옮기고(같은 키트 칸 우선), 없으면 그대로 두고 수를 알린다(`lost`). `--check` 로 표가 지금 pins.json·시트와 맞는지 본다(화소로 찾은 칸은 시트를 다시 그리면 달라질 수 있어 CI 에는 걸지 않았다 — 판 표 자체는 옛 핀이라 바뀌지 않는다).
  **남는 한계:** 판 ④(#2899, 3시간 남짓)의 시타마치·쇼텐가이 키트는 판 ⑤~⑥ 에서 7줄 키트로 다시 그려져 옛 칸이 시트에 없다 — 그 판 거리 맵은 467칸이 그대로 남는다(검증 거리 52×34 기준). 이 칸은 생성기로 다시 짓는 것이 맞다. 판 ①~③ 장소(파출소·찻집·학교)는 옮긴 뒤 게시 때 그림과 같았다.
  검증 도구: `qa/pin-repair-check.mts`(헤드리스: 정규화 → 후보 → 적용 → 멱등·고르지 않은 맵 불변), `qa/pin-repair-editor.capture.mjs`(패키지 빌드 + `oprn-serve` 정본 SQLite 에서 실제 창을 눌러 적용 → 자동 저장 → 새로고침 뒤 다시 찍기). 판 맵 재현은 그 커밋 워크트리에서 `bun scripts/qa/jp-street-probe.mts --style shitamachi`(그 판 편집기 도구로 짓고 그 판 시트로 그린다).
- **재발 막기:** `bake_jp.py` 는 저장소에 굽을 때 `pins.json` 이 `origin/main` 것을 그대로 품지 않으면(키가 빠졌거나 번호가 다르면) 굽기 전에 멈추고, 굽기 뒤에도 한 번 더 본다(`bake_lib.base_pin_problems`). `ci-fast` 는 main 푸시마다 `check-pins.mjs --base HEAD~1` 로 바로 앞 커밋 핀과 비교한다.
- **키트 모양이 바뀌면 새 자리 키:** 건물 키트(`blocks/buildings.py`)는 `tiledata/jp-city/buildings-shapes-v1.json`(2026-10-20 굽기 모양, 덧붙이기만)과 폭×높이가 다르면 칸 자리 키에 `@폭x높이` 를 붙인다. 옛 번호는 legacy 로 옛 그림이 남아 이미 깔린 맵의 건물이 어긋나지 않고, 새로 찍는 키트만 새 그림을 쓴다. 3/4 깊은 지붕(#3098)으로 46채가 1~2칸 높아진 굽기가 이 경로를 탄다. 코드에 박힌 키트 크기(`jpCityStreetComposer` LANDMARKS 의 `jp-bldg-koban` 6×6 → 6×7)는 굽기가 키트와 대조해 다르면 멈춘다 — 같은 PR 에서 표를 고친다.
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
- **일본 로케일 팔레트 계약**(`src/editor/jpCity/paletteContract.ts` → `bun scripts/content/jp-city/export_palette_contract.mts` → `tiledata/jp-city/palette-contract.json`): 6계열 × 재료 3~4개. 바깥 칸(실내·던전 블록 제외)은 굽기에서 퇴출 램프 색이 계약 색으로 옮겨지고, 허용 색 = modern3 ∪ 계약 색(`bake_jp.py`·`bake_inaka.py`).
  - **2026-10-20 사용자 결정: 「재료당 5단」 제한을 푼다.** 재료는 핵심 5단(`steps`, 뜻 불변 — 시간대 단 이동·퇴출 램프 짝·`jp_regions_pack` 의 단 번호) 위에 버들항식 **확장 램프** `ramp`(6~10단, 핵심 5단을 순서대로 품는다)와 **하위 램프** `subRamps`(3~10단, 같은 재료의 다른 결)를 가질 수 있다. JSON v2 의 `ramps` 가 이름 붙은 램프 전부를 펼친다: `<재료>`(핵심) · `<재료>+`(확장) · `<재료>/<하위>`. jp_city 와 시골 팩(`jp_inaka_pack`) 모두 적용.
  - 처음 넣은 것: `pine_bamboo+`(9단) · `pine_bamboo/sunleaf`(9단, 그늘 청록 → 빛 연두로 색상이 도는 버들항 숲 실측 램프, 채도 ≤ 0.49) · `pine_bamboo/culm`(대 줄기 7단) · `moss+`(7단) · `aged_cedar/bark`(나무껍질 7단) · `sakura_petal+`(벚나무 숲 9단) · `autumn_maple+`(단풍 숲 9단). 쓰는 곳: 숲 팩 `jp_forest_pack`(`openwiki/harnesses/jp-city.md` 「이어지는 숲 팩」). 새 재료 결이 필요하면 같은 자리로 더한다 — 램프 밖 낱색은 여전히 금지.
  - 검사 `validateJpPaletteContract()`(내보내기가 부르고 실패하면 JSON 을 안 쓴다): 핵심 5단 · 확장 6~10단·핵심 포함 · 하위 3~10단 · 단마다 밝기 증가 · 채도 ≤ 램프 상한 ≤ 0.50. 정규화(`nearestContractColor`)는 핵심 5단 색만 본다 — 확장 전에 구운 칸의 정규화 결과가 그대로다.

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

### 조수 연결 (2026-10-04 조사·수정) — 조수가 이 칩셋과 건물 도구를 «고르는» 길

도구(`build_jp_city_building`)는 있었지만 **조수 쪽에는 jp_city 가 어디에도 없었다**(시스템 프롬프트·의도 노트·초기 도구 노출). 정본 파일은 `src/ai/jpCityPolicy.ts`.

| 막힘(실측) | 수정 |
|---|---|
| 일본 상가 거리 요청 + 선언 `author_village` 이면 버들항 마을 노트(`beodeulTownRoute`)가 먼저 잡았다(새 프로젝트 기본 맵이 버들항) — jp_city 는 모델에 한 번도 안 나왔다 | `plainTurn.classifyPlainPiTurn` 에 jp_city 라우트를 팩 마을 다음·버들항 앞에 둔다: 대상 맵이 jp_city 이거나 **생성 요청**이 칩셋(`jp_city`·`oprn-jp`·「일본 도시 칩셋」)·일본 상가/거리를 말했을 때 → 숲마을 마을 계약을 건너뛰고 노트가 `formatJpCityNote`(`buildPiIntentNote` 의 `jpCity`)로 바뀐다. 실내·질문·NPC 의도는 제외 |
| `requestsModernMap`(PAW 전용 게이트) — 칩셋 이름을 부른 새 맵 요청은 맵이 아직 없어 jp_city 맵 예외에 안 걸렸다 | 요청이 jp_city 를 직접 부르면(`namesJpCityTileset`) 게이트가 물러선다. 「현대 일본 상가」는 설치 PAW 가 하나도 없을 때만 물러선다(PAW 가 있으면 사용자가 그쪽을 기대할 수 있다 — **제품 판단 대기**) |
| 시스템 프롬프트에 칩셋이 없다 | `buildPiAgentSystemPrompt` 에 한 줄(항상, 약 300자) + jp_city 맵이 범위에 있으면 상세 순서(땅 → 도로 키트 → 문 앞 → 뒷줄 건물 → 투명 덧그림 2층 → 검사) |
| 초기 도구 노출이 자연어 점수에만 기댔다 — 「이자카야 빌딩 세워줘」「일본풍 상점가」는 승격 0건, 「일본 상가 거리 맵」은 조립 도구만 오고 부품 조회 도구는 안 왔다 | jp 라우트면 `JP_CITY_EXPOSED_TOOLS`(조립·부품 조회·참고문서 읽기·create_map·fill_region·lay_path·paint_tiles·stamp_object·check_reachability·show_map_region·ask_tileset_change)를 첫 요청부터 노출. `capabilityEscalation` 은 build ↔ list 를 짝으로 승격 |
| 의도 선언이 마을·거리를 `author_village` 로 고르는 경향 | `INTENT_SYSTEM_PROMPT` Rules 에 한 줄 |
| 레거시 채팅 경로 | `TASK_RECIPES` 에 `jp-city`(Pi 경로는 레시피를 쓰지 않는다 — 색인 이름만; 지시는 위 시스템 프롬프트가 맡는다) |

**조수가 길을 걸으면 일어나는 일(실측, 도구 직접 호출):**
1. 보는 맵이 버들항이면 `create_map(tilesetId:"jp_city")` 는 `tileset-family-change` 로 거부되고 `ask_tileset_change` 를 가리킨다(사용자 결정 2026-09-25 — 칩셋 계열 규칙은 jp_city 도 예외가 아니다). 현재 맵이 없거나 승인된 계열이면 통과. 새 jp_city 맵은 `lowerTiles` 가 -1 로 비어 있다(검게 보임).
2. 칠하기 도구(`fill_region`·`lay_path`·`paint_tiles`)는 참고문서 게이트가 걸린다 — 용도 하나를 통째로 읽어야 하는데 jp_city 는 용도 6(jp-start 4쪽·그림 3 … jp-autotile 26쪽·그림 51)이라 **용도를 반드시 지정**해야 한다. 가장 가벼운 입구 용도 `jp-start` 를 지시문이 권한다. `build_jp_city_building`·`stamp_object`·`create_map` 은 게이트 밖이다.
3. `fill_region("보도 연석"|"생활도로"|"잔디")` · `lay_path("생활도로")` 는 동작, `중앙선` 같은 투명 덧그림은 `fill_region`/`lay_path` 가 거부(`material-not-found`·`path-needs-autotile`)하고 `paint_tiles` layer "1"·"3" 은 **조용히 3층으로 돌려 성공**한다(재성형 안 됨, 경고 없음) — 오직 layer "2" 만 정상. 이 사실은 지시문·스킬·참고문서에만 있고 도구 오류 문장에는 없다(`paint_tiles`·`fill_region` 은 이 담당 밖 파일 — **남은 일**).
4. `stamp_object(kit:jp_city/jp-road-*)` 동작(x,y = 키트 왼쪽 위). 없는 키트 id 는 목록 없이 「킷 …가 없습니다」만 준다(남은 일).
5. 예제 25개 중 22개는 `list_jp_city_building_parts({example})` 인자 그대로 지어진다. `machiya_izakaya`·`L_machiya_annex`·`L_flats_lot` 는 `DECO_CLASH` — 도구 설명이 같은 모양의 `jp-recipe-*` 키트(`stamp_object`)를 가리킨다.
6. 오류 문장에 「→ 다음: …」 꼬리(코드별 고칠 행동, `DOOR_BLOCKED` 는 문 앞 `fill_region` 인자까지)를 붙였다 — `jpCityTools.ts` 의 `NEXT_ACTION`·`doorBlockedFix`.
7. **건물 사각형이 겹쳐도 도구는 거부하지 않는다**(둘 다 «성공», 나중 것이 앞 것을 덮어쓴다). 지시문·스킬이 «발 y 를 높이+1 이상 띄우라»고 한다. 검사를 도구에 넣는 것은 `jpCity/builder.ts` 규칙(이번 담당 밖)이다.

8. **참고문서 게이트가 jp-start 를 통과시키지 못했다(헤드리스 시험 2026-10-04 에서 발견·수정).** `fill_region`/`paint_tiles` 는 선택 용도의 모든 쪽을 «읽은 증거»로 요구하는데, Pi 도구 결과는 12,000자에서 잘리고(`dataTruncated`) 잘린 쪽은 증거로 안 쳐진다. `jp-dict-groups` 첫 쪽이 JSON 15,723자라 조수가 몇 번을 다시 읽어도 거부가 같았고 땅을 못 깔았다. 모든 번들 참고문서 1,403쪽 중 61쪽(12개 타일셋: forest_harmony 계열·easyrpg_chipset_dungeon·atlas_biome_interior·jp_city 5쪽 등, 최대 15,776자)이 같은 처지다. `toolAdapter.createPiToolset` 가 `read_tileset_reference` 결과만 상한 30,000자로 보낸다(`REFERENCE_PAGE_MAX_DATA_CHARS`; 한 쪽 최대는 코드 울타리 3쪽분 약 18,000자).

**헤드리스 조수 시험(`scripts/tmp-jp-gen.mts` — `scripts/qa-game/gen.mts` 를 요청 문장·승인 계열을 받게 줄인 사본, gitignore): 「일본 상가 거리 맵 만들어 줘」, 새 프로젝트(버들항 맵), google-antigravity/gemini-3.8-flash, 계열 승인 `oprn-jp` 선적용, 판당 약 6~8분. 각 1판이라 통계가 아니다.**

| 판 | 코드 | build_jp_city_building | 땅(fill_region) | 도달 |
|---|---|---|---|---|
| C1 대조군(HEAD 그대로, 같은 승인) | main | 1회 시도 → DOOR_BLOCKED 로 포기, 이후 stamp_object 75회 | 4번 거부 → 땅 못 깜 | 검사 안 함 |
| T1 | jp 라우트·노트·노출 | 8회 중 6 성공(OUT_OF_MAP 1·DECO_CLASH 1) | 거부(76건 jp-autotile 선택) → 땅 못 깜 | 전부 도달 |
| T2 | + 읽기 목록 지시 | 11회 중 9 성공 | 6번 거부(위 8번 원인) → 땅 못 깜 | 전부 도달 |
| T3 | + 쪽 상한 수정 | 18회 중 17 성공(OUT_OF_MAP 1) | **성공**(보도·도로 2회 + paint_tiles) | 전부 도달, 렌더 확인 |

대조군도 모델이 `build_jp_city_building` 이름을 골라 jp_city 로 갔다(의도 선언이 도구 목록에서 고름) — 연결의 효과는 «고르는가»보다 «끝까지 쓰는가·땅을 까는가»에서 났다. 건물 사각형이 겹치는 판(T3 가운데)도 나왔다(위 7번).

조수 스킬 원본 `assistant-skills/jp-city-building-authoring/SKILL.md`. 편집기 안 조수가 읽는 `read_assistant_skill` 도구는 **main 에 없다**(agent/atlas-policy 브랜치 미병합, 2026-10-04 확인) — 그래서 조수는 같은 내용을 시스템 프롬프트·도구 설명·오류 문장·참고문서 `jp-*` 로 받는다. 시험 `test/jpCityAssistantWiring.test.ts`.

## 손 도트 건물 69종 + 상점가 줄 8종 (`jp-bldg-*`, 블록 `buildings`) — 2026-10-06

사용자가 Codex 하네스 그림을 반려한 뒤 Claude 가 칩셋 규약대로 직접 그린 기준 집(사용자 승인 「훨씬 낫다」)을 부품으로 나눠 조립한 일본 동네 건물 통 키트.
주택 15 · 공동주택 6 · 가게 14 · 음식점 7 · 상업 5 · 공공 5 · 공장·창고 2(분류는 `catalog.py` 의 `cat`).

### 그림 원본 (`scripts/content/jp-city/houses/`)
- `ref_house.py` — 기준 2층 집(寄棟 기와·下屋·발코니·현관 감실·블록 담 골목 장면). `modern_style_bible_proof` 의 K/Cv/hero/tree 를 쓴다.
- `house_kit.py` — 레시피 조립기 `build(r)`: 폭(칸) · 층 목록(벽 재료 siding/plaster/vboard/board/tile/panel/brick/curtain + 칸 위치 부품) · 층 사이(lean·lean_bal·belt·corridor·balcony_row·shop_band) · 지붕(hip·gable_side·gable_front·shed·flat + 확장). 확장 모듈이 `PARTS/ROOFS/JOINS` 에 등록한다. 결과 meta 의 `doors` 가 출입구 x.
- `shop_parts.py` — 간판(JIS 16px 글리프)·차양·노렌·제등·사인폴·쇼윈도·열린 가게·담배 창구·우체통·唐破風·굴뚝·入母屋·鋸屋根·맨션 발코니 줄·세로 간판·団地 계단실·편의점 띠·커튼월.
- `catalog.py` — 53종 레시피(`CATALOG[id] = (이름, 분류, 레시피)`), `render`/`sheet`/`town` 비교 그림.
- 간판 글자가 없으면 `scripts/content/jp-city/lib/glyph_tool.py <글자>` 로 `tiledata/jp-city/glyphs.json` 에 더한다(jiskan16).

### 굽기 (`blocks/buildings.py`, `BLOCK_ORDER` 넷째)
- 건물 그림을 벽 칸 + 양옆 처마 칸 1칸씩으로 잘라 16px 칸으로 나누고, 같은 화소·같은 통행 칸은 하나로 합친다(단품 53 + 줄 6 = 키트 59, 4786자리 → 고유 2363칸, 시트 3747 → 6110칸).
- 통행: 맨 아래 D줄(2, 3층 이상·큰 건물 3)의 벽 칸 `solid`, 나머지(윗층·지붕·양옆 처마 칸) `star`. 출입구 칸은 맨 아래 줄 `solid` + `entrance` 부품, 접근칸은 키트 바깥 한 줄 아래.
- 줄지어 세우기: 단품은 다음 x = x + w − 1(처마 칸 1칸 겹침)이 가장 촘촘하고, **벽 사이에 1칸 틈(골목)이 남는다**. x + w − 2 는 벽을 덮는다(참고문서 오류 `wall-overwritten`).
  칸 하나에 위층 그림이 하나뿐이라 옆 건물 처마를 화소로 겹칠 수 없다(키트 행은 `tiles`/`upperTiles` 두 층뿐).
- 벽을 맞댄 상점가는 줄 키트 `jp-bldg-row-*` 6종(`buildings.py` 의 `ROWS`): 단품 그림을 땅 줄에 맞춰 다음 건물 처마 칸이 앞 건물 마지막 벽 칸에 겹치게 화소로 합친 뒤 잘랐다(뒤 건물이 앞에 그려진다). 이음 칸만 새 칸이고 나머지는 단품 칸과 합쳐진다.
- `python3 scripts/content/jp-city/blocks/buildings.py` = selftest(팔레트·알파·칸에서 재조립 == 원본·출입구 막힘·결정성) + `tiledata/jp-city/blocks/buildings/*.png`(통행 덧그림 `-pass-x3`).
- 참고문서 용도 `jp-buildings-hand`(쓰는 법·사전·정답 조립·정상/오류). 엔진 실측은 `engine_dump.mts` 의 `bldgKits`·`bldgComps`·`bldgOverlap1`.
- `engine_dump.mts` 는 도구 레지스트리가 끌어오는 `.css` 때문에 tsx 단독으로 못 돈다(2026-10-06 main 기준) — `--import ./tiledata/jp-city/refs/css-stub.mjs` 로 돌린다(`bake_refs.py --dump` 에 반영).

### 조사 반영 (2026-10-06 둘째 판)
- **간판 가나 섞기**: 한자만 쓴 간판 23개를 やおや·さかな·お肉·フラワー·ブックス·くすり·洗たく·ラーメン·いざかや·喫茶ルナ·とこや·すし·めし処·だんご·だがし·酒のヤマ·サイクル·住まい·ヘアー·やま医院·さくら園·いちば·カラオケ 로 바꿨다(한자만이면 중국으로 읽힌다 — 조사 README 2절). 칸 번호는 덧붙이기라 옛 간판 칸도 시트에 남는다.
- **셔터 가게**: `catalog.py` 의 `_shut(src, paper, sign)` 이 가게 앞(shopopen/shopglass)을 `shop_parts.shutter`(골판 셔터, `paper` = 「テナント募集」 종이)로 바꾼 변형 `*_shut` 8종 + 빈 점포 `shop_vacant`. 셔터 가게는 **출입구가 없다**(`access` 빈 목록). 줄 키트 `row-shutter-a/b` 는 영업 가게 사이에 셔터 1~2칸을 섞은 것(빈 점포율 13.6%).
- **동네 거점**: `landmark_parts.py`(세탁기 줄·새전함·방울 줄·금줄·시계·기둥) + `coin_laundry` · `machikoba_home`(町工場, 1층 셔터+2층 주거) · `station_small`(작은 지상 역사) · `school`(3층 교사, 층 38px) · `school_gym` · `shrine_haiden`(拝殿) · `gas_office`.

### 한계
정면 하나(옆·뒷면 없음) · 간판 일본어 고정 · 마당·담·주차장은 키트 밖 · 실내는 아래 「일본 집 실내」(건물 키트와 자동 연결은 아직 없다) · 같은 줄에서 높이가 다른 지붕을 붙이면 오른쪽 처마 칸이 왼쪽 처마를 덮는다.

## 손 도트 거리 시설 60종 (블록 `street_hand`, `BLOCK_ORDER` 다섯째) — 2026-10-06

조사의 「일본」 신호를 키트로 그린 것. 그림·굽기 `scripts/content/jp-city/blocks/street_hand.py`(`@prop(id, 이름, w, h, solid, other, tags, rules)` → 키트 `jp-<id>`, 그룹 `jp:hand-marking`). 칸 6926(블록 고유 383칸).
- 전봇대 `jp-pole`(3×10, 변압기·완목·노란 지선 커버) · `jp-pole-guy` · `jp-pole-wood`(3×9). 전선 `jp-wire-5`~`jp-wire-20`(폭 L−3 × 3): **왼쪽 전봇대 키트 x + 3, 맨 위 줄 y 에 4층**. 세로 `jp-wire-v6/8/10`.
- 노면(2층 투명 덧그림, `pc=flat`): `jp-mark-edge-{n,s,w,e}`(側溝 + 路側帯 흰 선) · `-grate` · `jp-mark-line-*` · `jp-mark-30`(2×4 주황) · `jp-mark-lockplate`(코인 주차 잠금판).
- 담·문: `jp-bwall-{plain,sukashi,end-l,end-r}` · 펜스 얹은 `jp-bwallf-*`(1×2) · `jp-gatepost`(표찰·인터폰·우편함, 1×1) · `jp-gate` · `jp-carport`(4×3) · `jp-tsukigime`(月極 표지).
- **빠진 키트(2026-10-13, 3/4 관문 불합격으로 거리 키트 220종에서 제외):** `jp-bwall-{plain,sukashi,end-l,end-r}` · `jp-bwallf-{plain,end-l,end-r}` · `jp-rail-fence` · `jp-rail-signal` · `jp-tsukigime` · `jp-pole-guy`. 위 담·문·전봇대 줄의 해당 이름은 옛 기록이다 — 새 시트/타일셋/참고문서에서는 쓰지 않는다. `bake_refs.py` 소스에서는 이미 뺐고, 산출물(`jpCityReferences.json`)은 재생성 대기.
- 생활·길가: `jp-propane` · `jp-ac-unit` · `jp-pots` · `jp-monohoshi` · `jp-keijiban` · `jp-gomi-box` · `jp-jizo` · `jp-mirror2`(주황 커브미러) · `jp-hydrant-sign` · `jp-bus-stop`. 거점: `jp-torii` · `jp-gas-canopy` · `jp-school-gate`.
- `ai.role` 은 enum(`building castle fence roof terrain water wall prop`) 안이어야 한다(`bake_lib.py` 검사) — 전선·표시는 `prop`, 담·문은 `wall`.
- **층 규칙**: 전봇대·전선은 건물 앞에 서므로 4층(3층에 찍으면 건물 칸을 지운다 — 참고문서 `upper-overwritten`). 엔진 통행은 4→1층 순으로 빈칸·★ 를 건너뛰므로 4층 ★ 가 3층 막힘 칸을 풀지 않는다.

## 동네 한 장 예제 (`scripts/content/jp-city/maps/town.mjs`) — 2026-10-06

96×80칸. 선로·철망 → 역 앞 줄(交番·역 앞 상가 줄·작은 역사·편의점·코인 주차·우체국·의원) → 판석 광장·간선(횡단보도·버스·택시) → 상점가 북쪽 줄(셔터 섞인 줄 키트·입구 아치 둘)·판석 길(노보리·입간판·화분·자전거) → 銭湯·코인 세탁소·町工場·슈퍼 → 생활도로 → 주택가(블록 담·문기둥·카포트·프로판) → 생활도로 → 신사(拝殿·도리이·手水舎·참배길)·小学校(교사·체육관·운동장)·공원.
- 층: 1층 바닥 · 2층 노면 표시 · 3층 건물·소품 · 4층 전봇대·전선(+차를 밑에 둔 카포트).
- 전봇대 자리는 `poleRow` 가 고른다: 기둥 열이 덮는 건물 칸(기물 0.6) + 완목 열 ×0.3 + `0.02·(L−12)²` 을 최소로 하는 동적 계획(간격 L = 전선 키트가 있는 5~20칸, 교차로 열·다른 4층 칸 제외).
- 꾸밈 소품은 `tryPut` 으로 빈 자리에만(문·접근칸·길 제외, 실패는 건너뛰고 셈). `TOWN_DEBUG=1` 이면 건너뛴 이유를 찍는다.
- 검사(생성기 안): 문 46곳 접근칸 도달 · 막힘 칸 전부 엔진이 막음 · 3/4층 겹침 0 · 오토타일(생활도로·선로·철망) 마스크 어긋남 0 · 빈칸 창(17×13) 최댓값. `--publish` 가 장소(`jp-city-town-96x80`, `jpCityPlaceReferences.ts` + `regionReferences/jp-city-town.json` + `public/assets/region-references/jp-city-town.*`)를 쓴다. 로더 항목은 `regionReferenceSnapshots.ts`.
- 그림: `python3 scripts/content/jp-city/maps/render.py scripts/content/jp-city/maps/out/town.map.json town` → `verify-shots/jp-city/town-1x.png`·`town-x3.png`. 편집기 증거 `verify-shots/jp-city/editor-town-full.png`(새 맵에 `stamp_layer_block` 4층으로 옮겨 찍고 원본과 4층 모두 일치).

## 小学校 블록·예제 맵 (블록 `school`, `BLOCK_ORDER` 여섯째) — 2026-10-07

교정 키트 33종(`scripts/content/jp-city/blocks/school.py`): 교정 흙 A·B·C(1층)·고무 칩(遊具 밑) · 트랙 선 `jp-school-track-l`(30×15, **2층** 투명 덧그림) · 철봉·오르기 봉·운제·정글짐·타이어·골대 한 쌍·방구망·조례대·외발자전거 걸이 · 25m 수영장 `jp-pool`(29×19, 남쪽 탈의동 → 샤워 아치 → 데크, 입구 anchor 2칸) · 정문 `jp-school-gate-l`(개구부 4칸) · 창고·사육장·자전거 보관대·화단·나팔꽃·학급 밭·비오톱·등나무 그늘·百葉箱·게양대·二宮金次郎像·수돗가·ツツジ.
- 예제 맵 `scripts/content/jp-city/maps/school.mjs`(68×48): 교사·체육관·수영장 뒷줄 → 교사 앞 줄 → 서쪽 운동장(트랙·골대·남쪽 띠·방구망) → 동쪽 놀이·관찰 구역 네 줄 → 정문·둘레 철망 → 앞 생활도로(「30」 차선마다 `jp-mark-30-e`/`-w` — 키트가 側溝·흰 선 포함, 동쪽행 위 두 줄·서쪽행 아래 두 줄) → 전봇대(정문 앞·나무 줄기 앞 비움).
- 장소 `jp-city-school-68x48`(`--publish`, 관문 통과 필수). 크롭 `scripts/content/jp-city/maps/school_crops.py`.
- 축척: 교사·트랙은 압축 축척, 수영장만 실제 25m.

## 적대적 검증 관문 (`scripts/content/jp-city/gate/adversarial_gate.py`) — 2026-10-07

`run --stage S --files … --focus …` 가 `claude -p --model opus --effort medium` 검수자에게 파일·그림을 주고 「통과시키지 않을 이유」를 찾게 한다. 판정은 `tiledata/jp-city/gates/<stage>.json` 에 **파일 sha256 과 묶여** 남고, blocker·major 가 0 이어야 통과. `check --stage S` 는 판정 뒤 파일이 바뀌었으면 실패 — `kitmap.mjs --publish` 가 이것을 부른다(안 통과면 게시 거부, `SKIP_GATE=1` 은 비상구). 단계: `vehicles`(통과) · `school`(8회차 통과) · `transit`(진행 중).
- 관문 파일 목록에 공용 코드(`kitmap.mjs`)가 들어 있으면 덧붙이는 변경 하나로도 판정이 무효가 된다 — 실측: 학교 7회차 통과 뒤 kitmap 에 옵션을 더해 8회차를 다시 돌렸다. 공용 코드를 고치기 전에 관문을 먼저 끝내거나, 고친 뒤 다시 돌린다.
- 동시 실행은 Opus 3개까지(사용자 허용). 검수자가 큰 그림을 통째로 읽어도 되지만 **작업자(그림 고치는 에이전트)는 1000px 넘는 PNG 를 통째로 Read 하면 컨텍스트가 넘쳐 죽는다**(실측) — 크롭만 읽게 지시한다.

## kitmap 공용 검사기 (`scripts/content/jp-city/maps/kitmap.mjs`)

예제 맵 생성기 공용: `stamp`/`put`(발 기준)/`tryPut`(빈 자리만) · `fillL1` · `addLane`+`shapeLanes`(생활도로 오토타일) · `railLine` · `fenceLine` · `groupLine`(3층 오토타일 선, 마스크 감사) · `groupLineL2`(2층 투명 오토타일 선 — 점자 블록) · `edgeMarks`(側溝+흰 선) · `stampL2` · `poleRow`(전봇대 동적 계획) · `finish`(검사·출력) · `publish`.
- 검사: 문(entrance) 접근칸 도달 · **입구 anchor 칸 도달**(수영장·역 계단) · 막힘 칸 엔진 일치 · 겹침 0 · 오토타일 마스크 · 빈칸. `report.ok` 가 전부 묶는다.
- 빈칸(사용자 규칙 map-emptiness-gate): `bare` 에 준 **바탕 칸만** 빈칸(길·포장·고무 칩·물은 목적 있는 바닥), 1~3층만 본다(4층 전선은 공중), `emptyIgnore` 사각은 분모에서 빼고(운동장), 17×13 창 중 셀 수 111 미만은 건너뛰고 수를 `skippedWindows` 로 보고, `emptinessMax` 를 넘으면 ok=false.
- `finish({events, transit})` 로 이동 이벤트·탈것 노선을 맵에 같이 쓴다.

## 탈것 — 차·버스·노면전차·전철·지하철 (2026-10-07)

**그림**: 칩셋 칸이 아니라 따로 된 시트 `public/assets/jp-city/vehicles/<id>.png` 14종(승용 5·경차 2·택시·경트럭·박스 트럭·시내버스·노면전차·전철·지하철), 목록 `src/assets/jpCityVehicles.json`(프레임 `right/left/up/down` + `*_open`, 발자국 `foot`). 원본 `scripts/content/jp-city/vehicles/`(`SPEC.md` 규약: 발자국 아래 가장자리 정렬, 옆 = 길이 L × 2칸, 위아래 = 2 × L, 경차 L=4, 버스·전차 문은 차의 **왼쪽 면**에만 — 동쪽행 버스엔 `right_open` 이 없다(멈춰도 `right`), 3/4 윗면 띠·짙은 남색 유리). 관문 `vehicles` 통과.

**저장 모양**: `GameMap.transit = { routes: MapTransitRoute[] }` (`src/project/mapTransit.ts`). 노선 = 칸 경로(꺾이는 점) + 탈것 목록 + `loop`/`count`(순환) 또는 `headwaySec`(열린 노선, 맵 밖에서 나타나 맵 밖으로) + `speed` + `stops[{index, waitSec, name, board{mapId,x,y,dir}}]`. 경로 칸 = 머리가 지나는 칸이자 몸 폭 2칸의 위/왼쪽 칸. 좌측통행(`laneOffsetFor`): 폭 4칸 길에서 동쪽행 위 두 줄·서쪽행 아래 두 줄·남쪽행 오른쪽 두 열·북쪽행 왼쪽 두 열. 상태(위치)는 저장하지 않는다.

**시뮬레이션**(순수, `createTransitSim`/`stepTransitSim`): 열린 노선은 간격마다 시작 칸이 비었을 때 한 대, 앞차와 1칸 띄움(다른 노선 탈것 포함), 정류장에서 `waitSec` 동안 문 열기(막혀 있으면 정차 확정 안 함), 주인공 칸은 끝까지 피함. 교차로 교착은 **엇갈린 방향 탈것에만 6초** 막히면 겹쳐 지나간다(`STUCK_RELEASE_SEC`; 같은 방향 줄·버스 뒤·주인공 앞은 그대로 선다). 처음 들어올 때 90초 미리 돌린다.

**런타임**(`src/player/playSceneTransit.ts`): 1/30초 고정 걸음, 스프라이트 원점 = 발자국 왼쪽 아래, 맵 칸 크기 비율로 확대, 깊이 `characterDepth("same", y)`. `playerCanStep` 이 탈것 몸을 막고, `performAction` 이 상자보다 먼저 `tryBoardTransit`(정류장에 문 연 탈것 칸을 보고 「조사」 → `transferTo`). 테스트 훅 `window.__oprnTransit()`(노선·탈것 key·사각·프레임·막힌 초).

**조수 도구**(`src/editor/tools/transitTools.ts`, 도메인 map): `inspect_map_transit`(차도 띠·레일 줄·지하철/전철 선로 띠(1층 `jp-subway-track`, 「경로 머리 행 y=…」)·노선·120초 시험) · `set_map_transit`(auto = 1층 `jp-lane-road` 에서 맵 끝→끝 곧은 띠를 찾아 좌측통행 차 흐름, `busStops` = 버스 머리가 서는 차선 칸, `tram` = 2층 `jp-tram-rail-h/v` 레일 — 6칸 안에 나란한 두 레일이면 복선 양방향, 단선은 한 방향 / routes = 칸 경로 직접 / removeRouteIds / clear). `auto.subway:{board, stopName, centerX, vehicle}` = 1층 선로를 찾아 30칸 열차가 맵 밖에서 들어와 몸 가운데가 `centerX`(기본 맵 가운데)에 서게 한다(선로 둘이 6칸 안이면 양방향, `subway`/`tram` 만 주면 차 흐름은 안 깐다). 정류장은 모두 `at:"center"` 로 **몸 가운데 칸**을 줄 수 있다 — 조수가 머리 칸을 계산하다 정문 옆에 세우던 실측(헤드리스 시험 A: 정문 x33~36 인데 몸 x22~30) 때문. 결과 요약에 정류장마다 「서면 몸 x a~b」 를 돌려준다. 몸이 길 밖이면 거절한다 — 차·버스는 1층 생활도로(`off-road`), 지하철·전철은 1층 선로, 노면전차는 2층 레일(`off-track`; 실측: 조수가 선로 y4~5 를 y=3 으로 줬다). 정류장 몸이 60% 넘게 맵 밖이면 경고. 정류장이 차선 위가 아니면 차선 행을 알려 주며 거절. 헤드리스 조수 시험 픽스처 `scripts/content/jp-city/qa/transit-assist-fixture.mts`(노선 없는 학교·역 맵 + 새 번들 타일셋 — 헤드리스 로드는 `ensureBundledTilesets` 를 안 돈다). 띠 찾기 순수 함수 `src/project/transitAuto.ts`. `jpCityPolicy` 의 노출 도구·상세 순서 ⑤에 들어 있다.

**편집기**: 맵 설정 → 「탈것(차·버스·전차)」 칸(`renderTransitTab`) — 찾은 차도 안내, 「차 흐름 자동으로 깔기」(도구와 같은 `planMapTransit`), 「노면전차도 깔기」(레일이 있을 때), 노선 켜고 끄기·지우기, 차 간격 슬라이더. 정류장·순환선·지하철은 조수(routes)로. 증거 `verify-shots/jp-city/transit-editor/`(캡처 `scripts/content/jp-city/qa/editor-transit.capture.mjs`, netns 에서 dev 서버를 띄워 store 에 픽스처를 `replaceProject` — `isLoaded()` 전에 넣으면 늦게 끝난 새 프로젝트 불러오기가 덮는다).

**런타임 QA**: `node scripts/qa/runtime/transit.probe.mjs`(netns: `unshare -rn sh -c 'ip link set lo up; …'`). 픽스처는 `transit-fixture.mts` 가 **조수 도구 실물**로 小学校 맵에 auto + 学校前 버스 정류장을 깔고 지하철역 맵을 넣는다. 15축: 노선 도달·그려짐·동/서 흐름(막힌 차 제외)·픽셀 변화·주인공 칸 안 덮음·주인공 앞 정지·버스 정차/문/타기·다른 맵에서 치움·지하철 정차/문/타기. 증거 `verify-shots/jp-city/transit-runtime/`.

## 노면전차 거리·지하철역 블록 + さくら町駅 예제 (2026-10-07)

- `blocks/transit_street.py`(`BLOCK_ORDER` 일곱째): 레일 `jp-tram-rail-h/v`(2층)·횡단보도 겹침 레일 `jp-tram-rail-h-xwalk`·**軌道敷 포장** `jp-tram-trackbed`(-b, 1층)·안전지대 섬 `jp-tram-stop`(**두 방향 모두 각 궤도의 남쪽** — 전차 그림은 양 끝 운전대·문이 보이는 남쪽 면, 3/4 에서 정차한 전차가 궤도 북쪽 칸을 가리므로 북쪽 섬은 주인공이 사라진다: 관문 5회차 major)·導流帯 `jp-tram-stop-zebra`/`-e`(섬 상류 끝, 바닥은 軌道敷)·센터 전주 `jp-tram-pole-c`(1×6, 복선 사이 빈 행에 밑동, 키트 윗행 = 동쪽행 궤도 윗행 −3)·가선 `jp-tram-wire-h`(4층, 두 궤도 각각 윗행 **−2** — 전차 그림의 팬터그래프 끝 높이)·보행 신호기 `jp-tram-ped-signal`(빨강 켜짐, 횡단보도 양 끝 대각 한 쌍)·정지선 `jp-mark-stopline-v`·차로|軌道敷 경계선 `jp-tram-lane-line-s/-n`(기존 路側帯 `jp-mark-line-*` 과 다른 키트)·보도 승강 띠 `jp-tram-curb-stop`(サイドリザベーション 전용)·지하철 출입구 `jp-subway-entrance`. 차막이 `jp-tram-rail-end` 는 **단선 종점 전용**(관문 3회차 blocker). 보도 전주 `pole-n/s` 는 3회차에서 없앴다.
- **키 큰 기물 깊이 `foot-dy:N`**: 센터 전주·보행 신호기 칸의 tileMeta 태그. `characterDepth.ts` `tileFootRowsBelow` 가 읽어 ★ 칸도 고정 상층에 두지 않고 밑동 줄로 y 정렬한다(북쪽 전차는 기둥 뒤, 남쪽 전차는 기둥 앞 — 줄마다 정렬하면 한쪽이 틀린다, 관문 4회차 major). 블록 스크립트의 `prop(..., cell_tags=lambda cx, cy: [...])` 로 칸별 태그를 달고, 같은 그림 칸도 태그가 다르면 다른 칸으로 굽는다.
- 키트 합성 장면(`scene-street.png`)은 블록 자체 확인용이다. 참고문서 그림은 **실제 예제 맵**(`tramstreet.mjs`)을 굽는다 — 장면과 맵 배치가 어긋나 조수에게 틀린 무늬를 가르친 지적(4회차) 때문.
- `blocks/transit_station.py`(여덟째): 콘코스 바닥·흰 타일 벽·천장 보·개찰구(9칸, 통로 홀수 열)·ラチ 칸막이·매표기·역무실·계단 두 방향(anchor)·평기둥 / 승강장 바닥·뒷벽·광고·역명판·선로(1층 막힘 2줄)·승강장 끝(점자 띠 + 内方線)·번호 기둥·의자·LED·매단 역명판.
- 예제 `scripts/content/jp-city/maps/station.mjs`: 콘코스 26×14 ↔ 승강장 44×13(계단 anchor 칸 이동 이벤트), 승강장 지하철 노선 `subway-sakura-east`(맵 밖 서쪽 → 머리 x 38 에서 12초 정차 → `board` 学校前). 점자 유도 블록은 `groupLineL2("jp-tactile", …)`. 출구 계단의 지상 목적지는 환경 변수 `STATION_EXIT_MAP/X/Y`(기본 노면전차 거리의 지하철 출입구 앞 (20,10)). 승강장 소품 `jp-subway-recycle`·`jp-subway-vending`·`jp-subway-extinguisher`(뒷벽이 3층이라 4층 덧그림), 콘코스 표지 `jp-subway-sign-exit-up`(출구 계단 바로 남쪽).
- 예제 ⑤ `scripts/content/jp-city/maps/tramstreet.mjs` 노면전차 거리 48×30: 건물(뒤·틈은 자갈 뒷마당, 오피스 공개공지는 판석) · 보도 3 · 동쪽행 차로 3 · 동쪽행 궤도 2 · 가운데 띠 3(동쪽행 섬 2 · 전주 밑동 1 — 서쪽행 가선이 섬 위 승객 얼굴이 아니라 난간 줄을 지나게) · 서쪽행 궤도 2 · 서쪽행 섬/軌道敷 2 · 서쪽행 차로 3 · 보도 3(연석 쪽 줄에 가드레일·가로수·가로등, 두 줄은 걷는 줄). 생성기 안 검사(`extraLayersCheck`): 두 궤도 모든 칸에 레일, 횡단보도 4열은 끊김 없음, 두 보도가 맵 끝에서 끝까지 걸어서 이어짐, 꾸밈 건너뜀 0. 복선 판정은 「같은 축 6칸 안에 나란한 두 레일」(가운데 띠 3행까지). 서쪽행 → 동네 역 앞, 동쪽행 → 학교 앞. 타협 둘(관문 tramstreet 4회차 minor, 규칙 글에 적음): 동쪽행은 3/4 에서 문이 보이는 남쪽 면 때문에 진행 방향 오른쪽 문으로 승강, 서쪽행 가선은 투영상 동쪽행 섬 아랫줄 시설 허리를 지나간다. 콘코스 26×17 은 서·동·남 둘레 벽(`jp-subway-wall-w/-e/-s/-sw/-se`)·「↓のりば」(`jp-subway-sign-line-down`), 승강장 계단 남쪽 입구 앞 두 칸은 점형 경고 블록(`groupLineL2(..., { dots, edgeConnects:false })`), 내려가는 계단 맨 윗줄은 머리벽(막힘). 노면전차 probe 가 지상 → 콘코스 → 개찰 통로 → 승강장 → 콘코스 복귀까지 한 칸씩 걷는다(15항목 — 지상 출입구 도착 칸부터 점자 길 칸마다). 두 섬은 4칸 횡단보도 양쪽에 엇갈려 붙고, 오피스 공개공지 보도에 지하철 출입구(계단 → 콘코스). 탈것은 `planMapTransit({auto:{traffic, tram, tramStops:[…at:"center"]}})` — **2층 노면전차 레일 칸은 차도 띠에서 빠지고**(`mapRoadBands`), 나란한 폭 2~3칸 일방 차로 둘은 한 길의 양쪽(`autoTrafficRoutes` 의 `narrowDir`: 동서 길 위 차로 동쪽행·아래 차로 서쪽행). 차·버스 노선 몸이 레일 위면 `off-road`. 런타임 QA `scripts/content/jp-city/qa/tram-street.probe.mjs`(netns, 출하 player.html): 노선 4 · 차 양방향 · 레일 위 차 0 · 두 방향 전차가 각자 섬 옆 정차 · 「조사」로 타기 → 서쪽행 동네 역 앞·동쪽행 학교 앞 · 섬 위 승객 몸에 4층 가선 없음 · 출입구 계단 → 콘코스, 증거 `verify-shots/jp-city/tram-runtime/`. 관문 단계 `tramstreet`(게시용).
- 동네 한 장(`town.mjs`)도 같은 `planMapTransit` 으로 동서 길 4줄 차 흐름 + 버스 駅前·学校前(`at:"center"`). 횡단보도 키트(`jp-road-lane-crosswalk-h/v`)·「생활도로」 이름표 칸도 차도로 보므로 역 앞 횡단보도로 끊긴 간선이 한 띠다. 촬영 `scripts/content/jp-city/qa/town-transit.capture.mjs` → `verify-shots/jp-city/town-transit/`.
- 엔진 변조(`engine_dump.mts` 9절 `transit_station`): `fare-gate-bypass`(개찰 통로를 막고도 승강장 계단에 도달 — 칸막이 뺌) · `anchor-blocked`(계단 앞 의자).

## 일본 집 실내 (블록 `interior_*` 7개, `BLOCK_ORDER` 끝) — 2026-10-07

판타지 손 도트 실내(`atlas_biome_interior`)와 **같은 조립기**를 jp_city 사양으로 돌린다. 조수는 `build_hand_interior_room({tileset:"jp_city", plan, floor, wall, zones, objects, tables, goods, links})` 한 번으로 짓고,
부품은 `list_hand_interior_parts({tileset:"jp_city", room|query})`. 두 도구의 floor·wall·ceiling enum 은 두 사양 id 의 합집합이고, 고른 칩셋에 없는 id 는 조립기가 그 칩셋 목록과 함께 거부한다.
- 그림: `scripts/content/jp-city/blocks/interior_{shell,entry,washitsu,ldk,wet,bed,doors}.py` — 틀 `scripts/content/jp-city/interior/ikit.py`(`Registry`: `.floor`·`.wall`·`.ceiling`·`.obj`·`.table`·`.good`, 그림자는 modern3 램프 안에서 단 내리기라 팔레트 밖 색이 없다).
  통행: 바닥 `floor` · 벽면·천장·공허 `solidfloor` · 가구 발자국 `solid` · `walk` 칸·`flat` 종류 `flat`(2층) · 위로 솟은 칸·걸이 `star`. 키트 `jp-in-<가구 id>`(낱개 확인용).
  selftest 가 쓰임(use)·바라보는 쪽(facing)이 조수 도구 id(`parts.ts` USE_WORDS, N/S/E/W)인지 막는다 — 작업자가 「잠자기」「앉기」 같은 한국어 낱말을 넣었던 실측.
- 미리보기(굽기 전): `python3 scripts/content/jp-city/interior/preview.py ROOM.json OUT.png --x 3` — 조립 순서는 TS 와 같지만 **층 수(조각 셋 겹침·4층 찬 칸)는 보지 않는다**. 정답은 TS 도구로 짓는 `maps/interior.mjs`.
- 마루 깔기(2026-10-07): 널 마루 2종(`flooring`·`flooring-dark`)은 `R.floor(..., lay='rowShift')` → 사양 `floors[].lay` → 조립기가 줄마다 무늬를 밀어 깐다(`ikit.lay_x` = `builder.ts floorLayX`). 밝은 널은 윗줄 1px 광택만 — 통째로 밝히면 넓은 빈 바닥에서 띠로 줄 섰다. 바꾸면 `bake_jp.py` 뒤 `bake_refs.py --dump`(약 11분)로 예제 배열·그림을 다시 굽는다.
- 굽기: `bake_jp.py` 끝에서 `bake_interior_spec.py`(먼저 `interior/rooms.py` 가 예제 방 사각형 → `tiledata/jp-city/interior/rooms.json`) → `src/assets/jpInteriorSpec.json`(가구 97 · 바닥 7 · 벽면 5 · 탁자 2 · 탁상 20). 핀 8126 → 9017.
- 조립기 일반화: `builder.ts` 의 `handInteriorStructure`·`buildHandInteriorLayers` 가 사양 인자를 받고(기본 v5), `HAND_INTERIOR_SPECS = {atlas_biome_interior, jp_city}`. `isSeatId` 는 `use` 에 `sit` 이 있는 가구도 앉는 자리로 본다. `parts.ts` 의 예제 문서 id 머리는 `rooms.docPrefix`(jp = `jp-interior-ex-`).
- 예제: `tiledata/jp-city/interior/examples/{house-1f,house-2f,apartment-1k}.json`(도구 인자 + `rooms` 사각형) → `node scripts/content/jp-city/maps/interior.mjs [--publish]` 가 **조수 도구 그대로** 짓고 엔진 canMove BFS 로 이동 칸 도달까지 잰다.
  **2층 단독주택 구조(2026-10-20 개편, 10-21 격자 재배치)** — 일본 一戸建て 평면 구조를 따른다(참고 그림은 구조만 읽었고 화소는 쓰지 않았다). 1·2층이 같은 **세 띠 × 두 줄 격자**(열: 서 8 | 가운데 3 | 동 3, 줄: 북 띠 | 남 띠)를 쓴다. 1층(18×20): 북쪽 띠 = 부엌(대면식, 북쪽 복도와 트임) · 북쪽 복도(북서 귀퉁이 계단 — 북쪽 너머가 바깥이라 `stairs-into-partition` 없음, 북쪽 벽 문 → 돌출 화장실, 동쪽 미닫이 옆문 → 탈의·세면 3×3) · 남쪽 띠 = 거실·식당(부엌 동쪽 끝 2칸 트임) · 현관 복도(남쪽으로 2줄 돌출한 현관) · 욕실 3×3(탈의실 바로 아래). 2층(18×18): 같은 격자를 그대로 쌓아 **1층 바깥선 안**(화장실 위 화장실, 부엌 위 아이방, 탈의실 위 화실, 거실 위 침실, 욕실 위 서재, 1층 현관 돌출은 지붕) — 가운데 복도(북쪽 끝 계단통 — 1층 계단 바로 위) + 네 방 옆문, 출입구 없음. 계단 1층 (10,9) → 2층 (11,11), 2층 계단통 (10,8) 2×2 아랫줄 (10,10)(11,10) → 1층 (11,9).
  정본은 청사진 `src/editor/handInterior/jpHouseBlueprint.ts`(`composeJpHouse1F/2F(spec, seed)` — 씨앗으로 좌우 반전, 색 조합 3, 가구 변형 2; 방 폭은 방마다 빈 바닥 ≤30% 배열에 묶여 고정). `blueprintComposers.ts` 가 jp_city 의 `layout.program` `jp-house-1f`·`jp-house-2f`(별칭 `house-1f`·`house-2f`·`jp_house`)를 layoutCandidates 보다 먼저 가로챈다. 예제 JSON 은 씨앗 1 을 `scripts/content/jp-city/interior/gen_house_examples.mts` 로 쓴다(손으로 고치지 말 것) → `maps/interior.mjs --only house-1f,house-2f` → `interior-templates/extract.mts`(jp_house 만 옮김) → `bake_refs.py --dump`. 씨앗 검사 `qa/jp-house-blueprint.mts --seeds 1-60`(경고 0·맵 빈 바닥 ≤30%·**방마다 빈 바닥(통로 포함) ≤30%**·계단 도달·2층 출구 없음·2층이 1층 바깥선 안). 구조 참고문서 `jp-interior-house-structure` + 그림 `jp-img-interior-house-structure-{1f,2f}`(예제 맵에 방 이름·문·트임·계단 덧칠).
  **장소 다운로드(`jp-city-house-interior-21x15`)는 아직 옛 구조다** — `interior.mjs --publish` 가 전 예제 검사를 요구하는데 places4(지하 주차장 `parking-b1`·하수도 `sewer-2`·항구 창고 `harbor-warehouse-2`)가 조립기의 「탈 자리 도달」 검사에 걸려 게시가 막힌다. 그 예제를 고친 뒤 `--publish --sets 1`. `engine_dump.mts` 는 그런 다른 묶음 예제가 거부되면 직전 덤프 값을 쓰고 `interior.staleExamples` 에 남긴다(집 예제는 실패하면 멈춘다). 이름 추론(`단독주택 1층` → program house-1f)은 가구까지 준 평면을 청사진으로 바꾸지 않는다. 참고문서 굽기(2026-10-20): main 의 `bake_refs.py` 는 다른 묶음 드리프트(학교 예제 수영장 입구 도달 실패·places4 예제 거부)로 자기검사에서 멈춘다 — 이번엔 지역 팩 3종 영역(`packs`)·거리 시설 묶음(`gnd`·`regions`)만 보태고, 결과 중 `jp-interior` 분류(문서·그림)만 `src/assets/jpCityReferences.json` 에 갈아 끼웠다. 나머지 분류는 각 묶음 담당이 드리프트를 고친 뒤 전체 굽기로 갱신한다.
  **`bake_refs.py --dump` 를 막는 자기검사 전부(2026-10-21 origin/main 32ecae70e2 실측, assert 를 모두 출력으로 바꿔 끝까지 돌린 결과)**:
  ① `bake_refs.py:2182` 학교 예제 수영장 입구 (51,19)(52,19) 도달 실패 — `scripts/content/jp-city/maps/school.mjs`(+`blocks/school.py`) ·
  ② `:2183` 그 때문에 `poolKadan` 변조 미검출(→ `img_sch` 가 빈 목록으로 `min()` 크래시) ·
  ③ `:2397` 지하철역 콘코스 정상 맵에 개찰 우회 (12,14)(13,14) — `scripts/content/jp-city/maps/station.mjs` ·
  ④ `:2398` 그 때문에 `stairsBench` 변조 미검출 ·
  ⑤ `:3083` 층 정정 위층 칸 수 73≠74(`OLD_GROUP_LAYER` 노면 표시 그룹 lane-center 16·lane-dash 16·crosswalk 8·tactile 16·road-kit-marking 17) — 엔진 홈이 한 칸 바뀜 ·
  ⑥ `:3087` 실내 밖 밟는 계단(★) 74≠62 — 지역 팩(`packs`, 칸 15813~16951) 계단 12칸이 새로 늘었는데 기대값이 그대로.
  assert 가 아닌 경고: places4 예제 `parking-b1`(`cs-ramp-down` @21,12)·`sewer-2`(`ug-manhole-ladder` @20,8)·`harbor-warehouse-2`(`wh-ladder-hatch` @19,13) 탈 자리 도달 실패 → 직전 덤프 값 사용, 엔진 감사 mismatches 37.
  관문(2026-10-21): 12~15회차 지적(층 겹침·탈의실 7칸 폭·세면실 입구·방별 빈 바닥 30% 초과)을 배치로 고쳤다 — 관문 판정 방식·문서의 30% 기준은 그대로. 방마다 빈 바닥(예제·씨앗 60): 부엌 26%·거실 21%·탈의실 22%·욕실 0%·화장실 25%·아이방 25%·화실 11%·침실 25%·서재 22%. 걷는 자리를 쓰임 있는 납작 가구(키친 매트·현관 매트·깔개·놀이 매트·방석·슬리퍼·욕실 발판)로 덮고, 남는 방은 줄였다. 17회차는 「2층 계단통이 1층 계단과 행이 어긋남」(major)으로 불합격 → 2층 계단통을 1층 계단 바로 위 (10,8) 로 옮겨 **18회차 합격**(blocker·major 0). 남은 사소 3건(후속): 2층 계단통 동쪽 절반 아래가 1층 화분 (11,8), 오르내림 도착 칸이 한 열 옆(x10↔x11), 2층 복도 같은 열 화분 두 개. 결과는 `tiledata/jp-city/gates/interior.json`(파일 해시에 묶임 — 그림·문서·보고서를 바꾸면 다시 받는다).
  칩셋에 없어 대용한 것(object-gen 으로 만들 후보): 유리 장식 찬장(→ `cupboard`), 큰 거울 일체형 세면대(→ `washbasin`), 유닛 배스 욕조+샤워 패널, 신발장 위 꽃병(→ 탁상 `sh-bouquet`), 허리벽 벽면 변형, 방 사이 나무 기둥, 화장실 선반, 부엌↔거실 배식 창, 키친 매트(→ `genkan-mat`), 수건 서랍장(→ `dresser-low`), 실내 빨래 장대(→ `h2-laundry-pole`), 욕실 발판(→ `sc-sunoko`).
  짓는 순서는 조수와 같다 — 모든 층을 links 없이 → 같은 mapId·`replace:true` 로 links 넣어 다시(도구가 없는 맵으로 가는 links 를 `link-target-missing` 으로 거부). 장소 `jp-city-house-interior-21x15`(1·2층 한 다운로드 — id 는 크기가 바뀌어도 그대로 둔다) · `jp-city-apartment-1k-12x13`.
  런타임 QA `unshare -rn sh -c 'ip link set lo up; node scripts/content/jp-city/qa/interior.probe.mjs'` — 걷는 길은 `interior-fixture.mts` 가 예제 `rooms` 사각형마다 엔진 canMove BFS 로 구한다(평면을 바꿔도 손으로 고칠 것 없음).
- 평면 함정(실측): 세로 칸막이 틈은 3줄이어야 지나간다(위 두 줄이 벽면) · 칸막이 틈 앞 칸에 가구를 두면 방 하나가 통째로 막힌다 · 소파를 좌탁 바로 남쪽에 붙이면 등받이 overhang 이 좌탁 칸 3·4층을 차지해 탁상 물건이 `goods-no-layer` 로 거부된다 · 대면 카운터는 양 끝 중 하나를 통로로 남긴다.
- **방문 `door` 종류**(2026-10-07, 관문 2회차 「문 그림이 한 번도 안 쓰인다」): 가로 칸막이 1칸 틈 칸 (x,y) 에 단다 — ikit 가 틈 칸에 인방(천장 띠 비트 1|2, ★)을 붙이고, 그림 16×32 는 틈 아래 벽면 높이 두 줄(윗줄 ★ · 아랫줄 2층)에 열린 문틀·문짝. 통로를 막지 않고 발자국도 차지하지 않는다. 조립기 검사 `door-not-in-gap`(틈 좌우 `#`, 틈 위 실내, 틈 아래 두 줄 바닥, 그 양옆은 벽면/막힘). 세로 칸막이 틈에는 못 단다 — 그래서 문이 필요한 방은 복도 북쪽에 둔다. id `door-open-western`·`door-open-toilet`·`fusuma-open`, 현관문 문턱 `genkan-door`(flat, 맨 아래 출입구 틈 칸).
  **옆문 `sidedoor` 종류**(관문 3회차 「욕실·탈의실은 구조상 문을 가질 수 없다」): 세로 칸막이 3줄 틈의 통로 칸 (x,y) — 그림 16×48, 위 두 줄은 칸막이 끝 벽면 위 ★, 통로 칸 2층. 검사 `sidedoor-not-in-gap`. id `door-side-western`·`door-side-sliding`. 안 쓰는 닫힌 문 부품(`fusuma`·`shoji-door`·`toilet-door` 걸이, 열린 `shoji-open`)은 뺐다 — 핀은 남는다(빈 번호).
- 신발장은 `floor` 종류(옆벽 곁에 서게) — 현관에는 북쪽 벽이 없어서 `wall` 이면 놓을 수 없었다. 계단통은 `stairs:"down"` + 아랫줄 `walk`.
- 참고문서 용도 `jp-interior`(짓는 법·사전·바닥/벽면 칸·예제 3맵 4층 배열·정상/오류 변조 9종 — `door-not-in-gap` 포함). 엔진 실측은 `engine_dump.mts` 의 `interior`.
- 관문 단계 `interior`(`tiledata/jp-city/gates/interior.json`). 작업자 지시서 `tiledata/jp-city/interior/briefs/`.
- `interior.mjs` 는 2배 그림 `-x2.png` 도 매번 다시 만든다(관문이 보는 그림 — 예전엔 남은 옛 x2 를 관문이 보고 판정했다).
- **가구 분류**(2026-10-07): 정본은 `scripts/content/jp-city/interior/categories.py` 한 표 — 14종(현관·계단·문·창·벽걸이·부엌·다이닝·거실·화실·침실·아이방·서재·욕실·탈의실·세탁·화장실). 데코레이터의 `cat=` 는 이 표가 덮어쓴다. 블록 굽기는 「표에 없는 가구」, 사양 굽기(`bake_interior_spec.py`)는 「표에만 남은 id」에서 멈춘다. 새 가구를 그리면 표에 한 줄 더한다. 조수 `list_hand_interior_parts({tileset:"jp_city", category})` 와 편집기 오브젝트 갤러리 카드 부제(「일본 실내 · 계단」)가 이 분류를 쓴다.
- 편집기 오브젝트 갤러리: jp_city 의 `jp-` 부품은 번들 소유라 **공용 오브젝트**(`spatialCatalog.isBundledFurniturePackKit`). 카드 부제는 실내 가구는 방 분류, 나머지는 역할(건물·거리 소품·길·바닥·담·대문·학교)이다. 검색도 부제를 본다(「일본 실내」 97개).
- 계단 `stairs-up-wood(-wide)`: 폭은 칸 그대로(1칸 = 16px). 오른쪽 5px 띠에 트인 쪽 난간(옆판·단마다 난간동자·손잡이·발밑 칸 위 기둥), 왼쪽에 벽 손잡이를 그린다. 같은 자리 키로 다시 구워 칸 번호는 그대로다.
- **여러 층 장소 가져오기**: `importReferenceScene`(편집기 「맵에 놓기」·조수 `import_region_reference` 공통)은 내려받기 안에서 이동 이벤트로 (건너건너) 이어진 **같은 타일셋** 맵을 `scene.floors` 로 보고, 새 맵 모드에서 층마다 새 맵(`<mapId>:<원본 층 id>`, 맵 목록에서 첫 층 아래)을 만든다. 층 사이 이동 이벤트는 새 id 로 고쳐 includeEvents 없이도 싣는다(결과 `floorMapIds`). 타일셋이 다른 맵(숲마을 실내·동굴)은 층으로 보지 않는다. 지금 해당하는 장소는 `jp-city-house-interior-21x15` 하나다(2묶음 가게 19곳은 한 층).
- 편집기 실측 `unshare -rn sh -c 'ip link set lo up; npm run dev:worktree & …; node scripts/content/jp-city/qa/editor-place.probe.mjs http://127.0.0.1:<포트>'`. 자료집 → 맵 → 장소에서 「일본」을 검색하고 카드 → 맵에 놓기 → 1층·2층 맵과 서로 가리키는 이동 이벤트를 확인한다 → 맵 목록에서 열어 캔버스를 찍는다 → 오브젝트 「일본 실내」에서 공용과 분류 부제를 확인한다. 증거는 `verify-shots/jp-city/editor/`. dev 서버도 netns 안에서 띄운다(밖의 서버는 netns 크롬이 못 본다). blankProject 세션이라 정본 저장 증거는 아니다.
- 남은 것: 동·서 벽면 걸이 · 학교·사무실 실내 · 편집기 「새 맵 → 실내」 칩셋 선택(지금은 v5 고정).

## 일본 실내 2묶음 — 가게·공공·집 보강 + 거리 문 잇기 (2026-10-07)

- 블록 5개(`BLOCK_ORDER` 끝): `interior_konbini`(id 머리 `cv-`, 편의점·슈퍼) · `interior_food`(`fd-`, 라멘·이자카야·초밥·킷사텐) · `interior_shop`(`sh-`, 빵집·서점·약국·꽃집·채소가게·이발소) · `interior_public`(`pb-`, 목욕탕·코인세탁·파출소·의원) · `interior_home2`(`h2-`, 베란다·맨션·목조 아파트·옛집). 사양은 가구 97→220·바닥 18·벽면 11·탁자 5·탁상 44(칸 1018 추가, 시트 10041칸).
  작업자 지시서 `tiledata/jp-city/interior/briefs/common-shop.md` + 블록별(`konbini.md` 등). id 머리로 작업자끼리 겹치지 않게 했다.
- 분류 10종 추가(`interior/categories.py`): store·food·shop·sento·laundry·koban·clinic·veranda·apartment·oldhouse. **블록 안에서 `CATS.BY_ID` 를 덧붙이는 우회는 금지** — 작업자는 분류 파일을 못 고치니 감독이 통합 때 넣는다.
- 예제 19곳: `tiledata/jp-city/interior/examples/<이름>.json` + 표 `examples/places2.json`(장소 id `jp-city-<이름>-<W>x<H>`·종류·별칭·짜임). 예제마다 맵 전체가 방 하나(`rooms`), `start` = 맨 아래 줄 출입구 틈 바로 위. `interior.mjs`·`rooms.py`·`engine_dump.mts`·`bake_refs.py` 가 이 표를 읽는다. 참고문서 용도 `interior-shop`(「일본 가게·공공 실내」).
- **`preview.py` 「문제 0」 은 근거가 아니다**(실측: 첫 회차 19곳 중 7곳 도구 오류·11곳 경고). 정본 검사 `scripts/content/jp-city/qa/check-interior-examples.mts [이름…]` 이 예제를 조수 도구 그대로 지어 오류·경고를 다 보인다. preview 가 안 보던 것: 벽 가구 앞 칸 도달, 출입구에서 모든 바닥 도달(주방·뒷방 포함 — 카운터 줄 끝 틈), 탁상 물건 4층이 남쪽 가구 솟은 부분과 겹침(`goods-no-layer`), 한 줄 탁자 h=1, 옆문 자리.
- 맨션 2LDK 는 남쪽이 베란다라 출입구를 서쪽 공용 복도(맨 아래 줄 틈)로 냈다 — 실내 장소의 출입구는 언제나 **맨 아래 줄 틈**이어야 `link_jp_city_interior` 가 찾는다.
- **거리 문 잇기 `link_jp_city_interior`** (`src/editor/tools/jpCityInteriorLink.ts`, `JP_CITY_TOOLS`): `{mapId, door:{x,y}, width, place | interiorMapId, name, replace}`. 문 칸은 막혀 있어 playerTouch 가 안 일어나므로 **문 앞 접근칸(문 바로 아래)** 에 들어가는 발판, 실내 **맨 아래 줄(맵 끝)의 이어진 통행 칸 한 덩이**(1~4칸 — 덩이가 둘 이상이면 `interior-exit-ambiguous`, 5칸 이상이면 `interior-exit-too-wide`, 없으면 `no-interior-exit`; 위 줄은 출구로 치지 않는다)에 나오는 발판, 도착은 실내 틈 바로 위(이벤트·출구 칸 제외, 실내 걸음 칸 절반 이상에 닿아야 — 없으면 `no-interior-landing`)·거리 문 앞 한 줄 아래(발판 재밟기 방지). 여러 층 장소는 1층에만 잇는다. place 면 `importReferenceScene` 새 맵 모드(여러 층 포함), 실내 맵을 맵 목록에서 거리 맵 아래로 옮긴다. `create_transfer_pair` 는 막힌 문 칸을 앞 칸으로 옮기는 데다 착지 규칙이 달라 쓰지 않는다. 노출: `JP_CITY_EXPOSED_TOOLS`·`toolCapabilityIndex` jp 레시피·`capabilityEscalation` 짝(import_region_reference·read_region_reference).
- 런타임 QA `scripts/content/jp-city/qa/door-link.probe.mjs door-link-all-1.json door-link-all-2.json door-link-all-3.json`(netns, 출하 player.html): 상가 거리 예제(`maps/out/shopstreet.{map,plan}.json`)는 건물이 8채라 장소 21곳을 세 판으로 나눠, 건물 문마다 도구로 실내를 잇고 «문 앞 발판으로 한 걸음(아래가 소품이면 옆에서) → 실내 도착 칸 → (여러 층이면 계단 올라가 위층 둘러보고 내려오기) → 실내 지름 양 끝(가장 먼 칸 → 거기서 가장 먼 칸 — 안쪽 문 너머 방까지) → 출입구 밟기 → 거리 도착 칸 → 1.5초 머물러 되튕김 없음». 대조 시트 `qa/interior-sheets.py` → `verify-shots/jp-city/interior2/sheet1~4.png`(관문 `--stage interior-shop` 이 본다).
- 판정 근거는 `qa/check-interior-examples.mts`(조수 도구 그대로 짓기)다 — 작업자용 `interior/preview.py` 「문제 0」은 도구와 어긋났다(탁상 4층 충돌·벽 가구 앞칸·한 줄 탁자 h=1·옆문 자리). 관문 1회차 지적(뒷방 여섯 복사·빈 바닥·라멘 동선·자시키·조각보 나무 바닥)은 2회차에서 업종별 뒷방 가구·맵 축소·L자 카운터·4×2 다다미 단으로 고쳤다. 장소 id 의 크기 꼬리는 예제 크기를 따라간다(게시 전 맞춤). 시험 프로젝트는 쓰는 칩셋만 남긴다(빈 도구 프로젝트 135MB 그대로면 크롬이 죽는다). 증거 `verify-shots/jp-city/door-link/`.

## 지면 오토타일은 맵 밖을 같은 재료로 센다 (2026-10-20)

- 증상: 모든 jp_city 맵 둘레에 회색 톱니(맵 밖을 다른 재료로 세어 고른 가장자리 그림). 출처 `~/claude-viz/jp-inaka-countryside-1.html` F1.
- 원인: 지면 8방 7세트(`jp-sidewalk-curb`·`jp-lane-road`·`jp-lawn-dirt`·`jp-gravel-lawn`·`jp-plaza-pave`·`jp-water-pond`·`jp-water-canal`)가 `edgeConnects:false`·`outsideConnects` 없음이었다. **그리고 `rmTypeExpander.ts resolveAutotile`(`fill_region` 도구·조수·예제 구성기 경로)은 `outsideConnects` 만 읽고 `edgeConnects` 는 무시한다** — 엔진 쪽(`autotileEngine.ts` 호출자들)은 둘 중 하나면 켠다. 그래서 `edgeConnects` 하나만 고치면 `fill_region` 결과가 안 바뀐다. 둘 다 켠다(beodeul_city 와 같음, `build-beodeul-city.py` 301~306).
- 수정: `blocks/autotiles_ground.py` 에서 두 플래그를 켜고 `jpCityTileset.json` 을 굽는다. `jpCity.ts` 의 `shapeSignature` 에 플래그 지문(`edgeBits`)을 넣어 기존 프로젝트의 타일셋 사본이 갱신되게 했다. 선형 4방 10세트는 그대로(맵 끝 벽·차선이 밖으로 새지 않게). 그림·간판 글자는 안 바뀐다. jp_city_interior 는 별도 타일셋이 아니라(실내 맵도 `jp_city` id) 같이 고쳐진다.
- 이주가 필요한 이유: 맵은 변형 타일 번호를 **구워서** 저장하고 엔진은 칠하거나 도구를 쓸 때만 이웃을 다시 센다(렌더 때 재계산 없음). 타일셋 플래그만 고치면 저장된 맵 둘레 톱니가 남는다. `src/project/defaults/jpCityEdgeMigration.ts` `reshapeJpCityMapBorders` 가 `store.ts normalizeCurrentProject`(`jpCityEdgeConnect`)와 헤드리스 `normalizeHeadlessProject` 에서 돈다.
- 이주 규칙: 둘레 한 줄 칸만, **맵 밖 방향 비트만** 바꾼다(현재 그림이 뜻하는 이웃 모양 + 맵 밖 = 같은 재료 → 사전에서 다시 고름). 둘레 칸을 이웃에서 통째로 다시 세면 안 된다 — 구성기가 안쪽 칸에 "꽉 찬" 잔디를 그대로 두고 그 곁에 개울·길을 나중에 올리므로 둘레만 엄격히 세면 회색 가장자리가 새로 생긴다. 안쪽 칸·저자가 둔 다른 칸은 안 건드리고, 같은 입력엔 같은 결과(멱등)다. 공개 지역 스냅숏(`public/assets/region-references/jp-city-*.oprn.json`)은 둘레가 대부분 비그룹 칸이라 결함도 이주 변화도 없고, 생성기 출력(`maps/*.mjs`)은 다시 굽지 않는다.
- 증명: `bun scripts/qa/jp-inaka-showcase.mts --old-edge --out <dir>` 는 옛 플래그로 구성한 맵을 저장→이주 후 `<장면>.migrated.png` 를 낸다. 6장면 모두 이주본이 새 구성과 화소 단위로 같고(차이 0) 두 번째 패스는 변화 없음.

## 실제 거리 조사 (2026-10-06)

`tiledata/jp-city/research/` — 상점가·역 앞·요코초 / 주택가 생활도로·가로 시설 / 건물 유형별 치수 / 도트 게임 선례 웹 조사 4편(출처 URL)과 요약 `README.md`(축척 1칸≈0.9~1m, 「일본」 신호 우선순위·흔한 실수, 블록 구성, 현재 번들 대조, 다음 작업 순서). 새 건물·소품·거리 키트를 그리기 전에 먼저 읽는다.

## AI 참고문서 (10용도 · 61쪽 · 그림 167장)

계약 `tiledata/AI-REFERENCE-CONTRACT.md` 8항목을 모두 채운 번들 소유 참고문서다. 범위는 **지금 있는 부품만**(오토타일 17세트 · `build_jp_city_building` · 도로 키트 29 · 상가 키트: 레시피 25·문 9·소품 142 · 손 도트 건물 77 · 손 도트 거리 시설 60)이다. 공원은 전용 키트 없이 소품(나무·놀이기구·벤치)으로 짓는다.

| 용도 id | 쪽 | 그림 | 내용 |
|---|---|---|---|
| `jp-start` | 3 | 3 | 읽는 순서·층과 통행·실행 순서 · 칸 번호 영역 지도·거리 칸 사전 · 그룹 사전 |
| `jp-autotile` | 18 | 51 | 사용법·도구 행렬 + 17세트 문서(마스크 사전·입력→전체 배열→그림·오류 2건) |
| `jp-building` | 11 | 42 | 도구 사용법·부품 사전·완성 예제 25(전체 배열·그림)·변조 B1~B11 |
| `jp-road` | 7 | 12 | 키트 사전 29 · 팔 오프셋 공식·정답 조립·오토타일 이음 한계 · 오류 3건 |
| `jp-shop` | 5 | 15 | 레시피·문·소품 사전(칸 번호 전체) · 문 앞 접근칸·오류 3건 |
| `jp-buildings-hand` | 5 | 13 | 손 도트 건물 77종(단품 69·상점가 줄 8, 셔터 가게는 출입구 없음) 쓰는 법·통행·줄지어 세우기 · 분류별 사전(칸 번호 전체·도달) · 정답 조립 3(상점가 단품·주택가·벽 맞댄 줄 키트) · 오류 2(`door-access-blocked`·`wall-overwritten`) |
| `jp-street-hand` | 3 | 9 | 손 도트 거리 시설 60종: 층(전봇대·전선 4층·노면 2층)·전봇대/전선 공식(전선 x = 전봇대 x + 3)·생활도로 노면·집 앞 담 · 사전(칸 번호 전체·`layer`·`rules`) · 정답 조립 1(전체 1~4층 배열) · 오류 3(`upper-overwritten`·`pole-arm-overwritten`·`door-access-blocked`) · 엔진 실측 `engine_dump.mts` 의 `streetHand` |
| `jp-school` | 3 | 10 | 손 도트 小学校 33종: 층(트랙 선 2층)·배치 순서·빈칸 규칙 · 사전(칸 번호 전체) · 예제 맵 jp-city-school 전체 1~4층 배열 · 오류 3(`overlay-in-base-layer`·`door-access-blocked`·`anchor-blocked`) |
| `jp-transit` | 3 | 10 | 탈것 14종·노면전차·지하철: `set_map_transit` 쓰는 법·좌측통행 칸 규칙·정류장·도구 거절 코드 · 키트 사전(거리+역) · さくら町駅 콘코스·승강장 전체 배열과 지하철 노선 · 탈것 도감·실제 런타임 화면 · 오류 2(`fare-gate-bypass`·`anchor-blocked`) |
| `jp-errors` | 3 | 1 | 코드 → 문서·그림 지도 · 변조 좌표 전체표 · 엔진 판정 대 정의 층 설명 정정(전/후) |

### 굽는 법 (한 줄)

```bash
npx --no-install tsx --import ./tiledata/jp-city/refs/css-stub.mjs tiledata/jp-city/refs/engine_dump.mts    # 실제 도구·엔진 실측 → refs/engine-results.json (약 8분, 저장소 루트)
python3 scripts/content/jp-city/bake_refs.py                   # 문서·그림·번들 JSON·refs/*.md 사본·refs/check-evidence.json
```

- 문서의 칸 번호·키트 배열·오류 좌표는 **전부 실측**이다: 건물은 실제 `build_jp_city_building`(25예제 + 변조 11건, 오류 때 맵 불변 확인), 오토타일은 `paint_tiles`·`fill_region`·`lay_path`·`stamp_layer_block`, 키트는 `stamp_object`, 판정은 `isPassable`·`passabilityOf`·`tileLayerPolicy().home`·`mapUpperTileDepth`. 손으로 쓴 값 없음.
- `bake_refs.py` 는 쓰기 전에 문서의 키트 배열을 정의와 대조하고(205종), 정의에 없는 키트 id·범위 밖 칸 번호·그림 파일 부재·긴 변 820px 초과·128색 초과를 막는다. 같은 입력이면 같은 바이트(JSON·PNG 해시 두 번 실행 일치).
- 오류 코드(`autotile-stale` `wrong-layer` `road-gap` `arm-misaligned` `overlay-in-base-layer` `door-access-blocked` `back-over-front` `building-in-lower-layer`)는 문서 수준 검사 이름이다. 건물 도구 코드(`TOO_NARROW` 등)만 런타임 코드다. 검사 범위는 구조·층·통행이고 이벤트 실행·미적 품질·모델 성공률은 주장하지 않는다.
- 층 정정(2026-10-03, **정의 정정 완료**): 그룹 `defaultLayer` 와 엔진 칸 홈이 어긋난 칸이 있었다(투명 덧그림 5그룹 74칸 = 그룹 lower·엔진 upper, 소품·육교 8그룹의 아래층 칸 103개 = 그룹 upper·엔진 lower). **엔진이 정본**이다 — 엔진은 커스텀 타일셋의 칸 홈을 칸 단위(`tileLayerHome`: 잠긴 칸의 `defaultLayer`, 아니면 `priority`)로만 정하고 그룹 `defaultLayer` 는 홈 판정에 안 쓴다(칸 쪽 값은 처음부터 엔진과 일치). 그래서 굽기 `bake_lib.derive_group_layer` 가 **그룹 층을 멤버 칸 홈에서 유도**한다(전부 위 `upper`·전부 아래 `lower`·섞이면 `mixed`+`layerHome: perCell`) — 투명 덧그림 5그룹 → `upper`, 소품 7그룹(`street` `green` `gate` `shrine` `stairs` `storefront` `play`)·`underpass-footbridge` → `mixed`. 정의 검사 `group-layer-vs-tile-home` 가 일치를 굽기마다 지키고, `engine_dump.mts` 가 엔진 함수로 다시 잰다(어긋남 0). 칸 번호·시트 PNG·`pins.json`·칸 `priority`/`passability` 는 불변. **동작 변화 하나**: 위층 그룹은 `fill_region` 재료가 아니므로(`tileVocabulary.isFlatFillGroup`) 투명 덧그림 5그룹의 `fill_region`(예: `layer:"2"` 로 깔던 경로)은 이제 `material-not-found` 로 거부되고 `paint_tiles` layer "2" 만 남는다(그룹 `placementRules` 에 적어 둠). 이미 만든 프로젝트의 사본은 형태 서명이 그룹 층을 안 봐 갱신되지 않는다(새 프로젝트부터; 칠하는 결과는 칸 홈이 정하므로 같다).
- 계단 63칸(54 + 지하철역 계단 9, `star` + stair·계단·사다리 태그)은 정정 대상이 아니다 — 엔진이 일부러 캐릭터 아래로 그린다(`characterDepth.isWalkableStairTile`). 처음 어긋남으로 센 것은 덤프의 기대값 오류였고 `engine_dump.mts` 가 이 규칙을 안다.
- 한계(문서에 명시): 도로 키트 칸(3616~)은 오토타일 멤버가 아니라 이음새에서 끊긴다 · 예제 3개(`machiya_izakaya` `L_machiya_annex` `L_flats_lot`)는 도구가 `DECO_CLASH` 로 거부한다 · `stamp_layer_block` 은 3층 오토타일을 재성형하지 않는다 · 투명 덧그림을 layer "1"·"3" 로 칠하면 도구가 3층으로 돌려 놓고 재성형하지 않는다.
- 새 블록·키트 계열을 더하면 `bake_refs.py` 에 용도·문서를 덧붙이고 이 표를 갱신한다. `finalize` 가 **모든 키트가 문서에 나왔는지** 단언하므로 문서 없이 키트만 더하면 굽기가 실패한다(키트 id 접두로 계열을 가르는 정규식은 `jp-prop-` 처럼 **하이픈까지** 써야 한다 — `jp-prop` 만 쓰면 `jp-propane` 이 빠진다).

## 거리 구성기 `compose_jp_city_street` (2026-10-12)

완성 장소를 붙이면 같은 컨셉 틀이 같은 거리로 나온다(사용자 지적: 견본을 늘려도 해결이 안 된다). 구성기는 **규칙으로 거리를 짠다**.

- 정본 `src/project/jpCityStreetComposer.ts`(순수): `planJpCityStreet({mapId,width,height,seed,style,shops})` → 도구 호출 목록. 짜임 = [뒷줄 건물][보도 2][도로 3~4][보도 2][앞줄 건물][맨 아래 보도 2], 세로 골목 0~1, 횡단보도 키트(폭 4 도로만), 차 1~3, 가로등·노보리·자판기·자전거·화분·벤치. 건물은 가게 종류(`LOOKS`: 1층·층 띠·벽·지붕·간판 범위)에서 무작위 조립하고 `build_jp_city_building` 이 거절하면(`try:N` 후보 12개, 점점 단순) 다음 후보로 간다 — 첫 성공에서 멈춘다. 층 수는 남는 줄로 제한(앞줄 건물이 보도·도로를 덮지 않게). `runJpStreetPlan(plan, call)` 이 실행.
- 도구 `compose_jp_city_street`(`src/editor/tools/jpCityStreetTool.ts`, `JP_CITY_TOOLS`·`JP_CITY_EXPOSED_TOOLS`): `{mapId, seed, style: shopping|residential, shops[], replace, lotsOnly}`. 복제본에서 짠 뒤 반영, 손댄 맵은 `replace:true`. `lotsOnly:true` 는 다시 짜지 않고 남은 빈터만 채운다(아래 「빈터 쓰임 단계」). 레지스트리와 순환이라 `bindStreetToolLookup` 로 조회 함수를 꽂는다.
- 시작 흐름: jp_city 컨셉(학교·역 낱말이 아니면, `plan.composeStreet`)은 `prebuildStartTown` 이 구성기로 시작 맵을 짠다(기획 글의 가게 낱말 → `shopsFromText`, 스타일 → `streetStyleFromText`). 학교·역 낱말은 완성 장소(`placeId`) 붙이기가 남아 있다.
- 증거: `bun scripts/qa/jp-street-probe.mts --seeds 6 --out <새 폴더>`(Read 도구는 같은 경로 이미지를 캐시하니 폴더를 바꿀 것). 알려진 한계: 도로 점선·중앙선은 면 채우기 재료가 아니라 못 깐다, 횡단보도는 폭 4 도로만, 가게 간판(`decos`)은 아직 안 넣는다.
- (2026-10-12 후속) 골목은 지도를 위아래로 가로지르는 샛길(양옆 보도+가운데 도로)이라 큰길과 사거리로 이어진다. 지어진 건물마다 이름 붙은 위치(`labelStreetBuildings`, 태그 `jp-building`·종류)를 남겨 `list_map_locations` 로 어느 문이 어느 가게인지 읽고 `link_jp_city_interior` 를 맞게 잇는다(편의점 실내를 아파트 문에 잇던 문제).

## 하천 거리 (2026-10-12)
- 가로 하천: 북쪽은 정면 석축 벽(river-wall)+배수구, 물(수로+반짝임·긴 물결), 남쪽은 3단 석축(bank-lip/mid/slope)과 강변 공원(잔디+판석 길).
- 다리: 벽면 구간은 도로 아스팔트가 이어지고 물 위에만 널(bridge-lip/plank/pier). 난간 bridge-rail-v + bridge-post, 어귀 횡단보도.
- 키 큰 소품(가로등·전봇대·입간판·버스 정류장)은 건물 칸 위에 두지 않는다(clearCols). 전선은 두 전봇대 사이가 건물일 때만.
- 세로 길 중앙선은 차선 수가 짝수면 mark-center-v-l.

## 일체형 1층 정면 (2026-10-12)
- 조립기의 1층 띠와 문 부착물을 따로 그리면 문이 스티커처럼 붙어서, 문 + 1층을 한 장으로 그린 키트 `jp-sf-<종류>-<폭 3~9>-<L|R>` 를 만들었다(`blocks/shopfront_art.py`, `street_hand.py` 가 등록). 11종: konbini·izakaya·ramen·cafe·shop·bento·office·apartment·house·machiya·sento. 차고는 셔터 문이라 조립기 그림을 쓴다.
- 문은 2칸 폭·36px 높이(Actor1 24×32 + 머리 위 4px). 막힘은 아래 두 줄 전부. 폭마다 문이 왼쪽(L)·오른쪽(R).
- 거리 조립기(`runJpStreetPlan`)는 `build_jp_city_building` 이 지은 뒤 1층 3줄의 3·4층을 `stamp_layer_block`(-2)로 비우고 키트를 덮어 찍는다. 문 칸은 건물마다 미리 정한 side(`sfDoorCol`)로 조립기에 `door.col` 을 줘서 같은 자리에 둔다.
- 겹침: 계획 단계에서 소품 크기표(`PROP_SIZE`)로 건물 1층 칸·다른 소품과 겹치는 소품을 뺀다(`propRects`). 현관 소품은 한 줄짜리만 보도 첫 줄에(건물 칸 위 3층 덮어쓰기 금지). 문 앞 접근칸은 `doorX` 로 정확히 비운다.
- 미리보기: 문 옆에 Actor1 프레임을 세워 크기를 비교한다(`/tmp/sf_one.py` 같은 임시 스크립트로 `shopfront_art.draw` 호출).

## 고층·거리 소품 (2026-10-13)
- 역할 `tower`(7~13층, 폭 6~9, 일체형 정면은 office 키트 재사용). 키 큰 띠(발-윗줄 16줄 이상)의 상가 구획에서 셋 중 하나꼴로 섞고 절반은 윗부분이 들어간 계단식. 맵 높이 52 이상이면 뒷줄 띠를 높인다(`skyline`).
- 네온 세로 간판·블레이드 간판·깃발·자전거 떼·고양이는 `nearWall` 로 건물 벽 바로 옆 빈 열에만 붙인다. 나무·건물·다른 소품과 겹치면 겹침 정리가 뺀다.
- 한계: 고층 외형이 아직 단조(창 리듬만 다름), 옥상 간판·베이스 포디움 없음. 적대 QA 5.5/10.

## 조수 지침: compose 우선 (2026-10-13)

`jpCityPolicy.ts` 의 포인터·상세·노트를 «거리 한 장 = `compose_jp_city_street` 먼저, 이후 build_jp_city_building/fill_region 로 부분 보정, link_jp_city_interior 로 실내 잇기» 로 다시 썼다. 라우팅은 `describesCityStreet`(번화가·상점가·도심·시가지·주택가·downtown 등)를 jp_city 맵이 이미 있는 프로젝트에서만 허용하고 미국풍/modern_city 낱말은 제외한다. 세부는 `openwiki/editor-ai-tools.md` 「일본 도시 조수 연결」.

## 상가 띠 3/4 관문 = 조립 건물 영수증 (2026-10-13)

`jp-sf-*` 는 건물 1층 부품이라 윗면이 없다. 띠를 한 장씩 판정하지 않고 `gate_assembled.py build` 가 띠 + 위층 + 지붕(조립기 `buildJpCityBuilding` 결과를 시트 칸으로 합성)을
`tiledata/jp-city/blocks/_gate_assembled/<역할>-<L|R>-w<폭묶음>.png` 로 내면 `object-gate review --batch /tmp/jp-asm-chunk-N.jsonl`(kind structure)로 판정한다.
`gate_kinds.check_all` 은 띠 화소가 PASS 조립 그림 안에 그대로 있을 때만 통과시킨다(리포트에 `covered by assembled <표본>`). 띠를 고치면 build → review 를 다시 한다.
주의: 거리 구성기의 평지붕 건물(윗면 거의 없음)은 판정이 대부분 불합격 — 조립 표본은 roof.hip 으로 짓는다. 구성기 지붕 선택 개선은 별건.

## 빈터 쓰임 단계 `fillLotUses` (2026-10-14)

「거리·광장의 빈 땅이 거슬린다」(사용자) → 구성기 끝에 남은 대지를 «쓰임»으로 채운다. 코드 `src/project/jpCityLotUse.ts`, 호출은 `runJpStreetPlan(plan, call, view)` 끝(지도를 읽어야 하므로 `view` 를 준 호출만 — 도구·`playableSegment`·프로브).
- 남은 땅 = 건물·도로·보도·물·담이 아닌 맨 대지. 가장 큰 빈 직사각형(최대 16×10, 아래 기준)부터 크기·위치·구획으로 쓰임 하나: 코인 주차(**보도에 닿는 자리만**, 생활도로 + `jp-lot-bay` 2층 + 차 + `jp-lot-board`), 놀이터(기구를 먼저 놓고 생울타리를 그 둘레에 맞춤, 입구 2칸은 보도 쪽), 텃밭(`jp-lot-veg`), 공사장(`jp-lot-cabin` + 철망 + `jp-keijiban`·콘, 보도 쪽 대지만), 광장(판석 위 `jp-lot-fountain`|`jp-lot-clock` + 둘레 짜임 3가지 중 하나 + `jp-lot-kiosk`), 골목 틈(아래 5줄에 둘까지), 지붕 바로 뒤 띠(실외기·가스통·빨래 장대·화분).
- 건물 둘레 1칸·이미 선 소품 둘레 1칸은 비운다. 쓰임 사이 1칸 여백. 같은 씨앗이면 같은 결과.
- 멈춤: 「반경 2칸 안에 소품 없는 대지」 비율 ≤ 7%, 또는 직사각형이 바닥나거나 쓰임 수 상한. 내부 계산은 측정기 `scripts/qa/jpLotEmptiness.mts` 와 같은 분류(하천 석축·다리·노면 표시 키트는 «길·물», 소품 아님)여야 한다 — 다르면 일찍 멈춘다.
- 손댄 맵: `compose_jp_city_street({mapId, lotsOnly:true, style})` 가 다시 짜지 않고 빈터만 채운다(건물은 타일로 찾는다 — 건물·집·가게 키트 목록이 측정기와 같아야 한다).
- 생울타리·철망·블록담은 `fill_region`/`build_wall` 이 받지 않는다(위층 4방 오토타일) → 4방 비트(N1 E2 S4 W8)로 `variantMap` 칸을 골라 `stamp_layer_block` 3층으로 찍는다(`edgeLine`). **구성기 본문의 `fill(…, "생울타리"/"블록담")` 은 optional 단계라 조용히 실패했다 — 2026-10-14 수정:** `runJpStreetPlan` 이 `view` 가 있으면 그 재료의 `fill_region` 단계를 `stampEdgeRect`(`jpCityLotUse.ts`)로 3층에 4방 오토타일로 직접 찍는다(이미 위층이 있는 칸은 건드리지 않는다). `view` 없는 호출(예: NOLOT 프로브)은 옛 동작. 구성기가 이제 `composed-layout` 표식을 건물 이름표에 단다(`labelStreetBuildings`) — 거리 맵은 배치 품질 권고에서 빠진다.
- 측정: `bun scripts/qa/jp-street-probe.mts --from 3 --seeds 3 --w 64 --h 56 --style shopping` 이 `empty <seed> X%` 와 `.empty.json`(마스크)을 낸다. `NOLOT=1` 이면 이 단계 없이(비교용).
- 키트 그림 `scripts/content/jp-city/blocks/lot_art.py`(`ENABLED` 만 굽는다, `street_hand.py` 가 등록). 관문 실패로 빠진 것: `jp-lot-pay`·`jp-lot-hoarding`·`jp-lot-notice`.

## 일본 집 보강 8종 `interior_house3` — object-gen, 3/4 관문 보류 (2026-10-21)

유리 식기장·세면화장대·유닛 배스·현관 꽃병·허리벽(`cloth-wainscot`)·나무 기둥·화장실 선반·배식 창.
object-gen 흐름(시점 판정 통과 참고 그림 → Opus 손 도트 A/B → Opus 블라인드 검수 3회 → `by: opus-picker` 고르기)으로 4판까지 그렸으나
**8종 모두 최종 3/4 관문(object-gate final, Opus 적대적 VQA) 불합격 → 보류**. 그림·고른 기록은 `tiledata/jp-city/interior/house3/`,
판정 확인은 `scripts/content/jp-city/interior/house3_picks.py`(`refusal(kind=…, context='bundle')`, 해시 일치).
블록은 통과분만 등록하므로 지금은 칸 0, 분류표에서도 빠진다. `jpHouseBlueprint.ts` 는 사양(spec)에 그 조각이 있을 때만 쓰고
없으면 옛 대역(cupboard·washbasin·bathtub+shower-faucet·sh-bouquet·2칸 틈)으로 간다 — 다시 그려 관문을 받으면 굽기만으로 들어간다.
청사진 자리(2026-10-21 새 격자 c0/c1·e0/e1 기준): 허리벽 = 거실·현관 복도 벽면 · 유리 식기장 = 부엌 식기장 자리(새 배치엔 거실·서재 식기장이 없다) ·
세면화장대 = 탈의실 (e0+1,8) 2칸, 세탁기 (e0,8)·바구니 (e1,9) · 배식 창 = 거실 북벽 (a-2,12) 2칸 + 기둥 (a-3,12), 부엌↔거실 트임은 (a) 1칸 ·
현관 꽃병 = 신발장 위 · 화장실 선반 = 2층 화장실 북벽 변기 위(작은 창 대신) · **유닛 배스는 지금 들어가지 않는다** — 욕실 폭 3 의 북벽 첫 줄로 욕실 문(e0)이 들어와 3칸 덩어리를 둘 수 없다(폭 ≥ 4 일 때만).
대역 주입 시험(사양에 임시 조각을 넣고 `qa/jp-house-blueprint.mts` 씨앗 1~40)으로 경고 0·계단 도달·방 빈 바닥 ≤30% 를 확인했다.
관문 종류 판정이 흔들린 조각: 기둥(terrain↔wall_mounted), 배식 창(wall_mounted→low_furniture→terrain 모두 kind 반려), 선반(other).

## 시설 실내 6묶음 — 병원·학교 별관·IT 사옥 + 방 구성(program)·길 고르기 (2026-10-14)

- 블록 3개(`BLOCK_ORDER` 끝): `interior_hospital`(`hs-`, 병원 기물 30 + 바닥·벽면) · `interior_school2`(`sx-`, 학교 복도·교무·특별교실·옥상 보강 13) · `interior_office2`(`ox-`, 자유석·급탕실·로비 보강 13) — 관문 보류 19종을 뺀 수. 틀은 `scripts/content/jp-city/interior/inst.py`(`Inst`: ikit Registry 위에 관문 종류·`_gate/*.png`·`items.jsonl`·`kinds.json` 내보내기). 그림 엔진은 캠퍼스 `px.py`(modern3 램프).
  핀 15554 → 15876(덧붙이기만, 옛 번호 이동 0). 분류는 `interior/categories.py` 6번째 묶음(hospital-lobby·hospital-exam·hospital-ward·hospital-pharmacy·school-hall·school-staff2·school-roof2·office2·office2-common).
- 3/4 관문: `gate_kinds.py` 가 이 세 블록을 `_gate/kinds.json` 으로 함께 검사한다. 문(종류 `part`)은 `gate_rooms.py` — 예제 렌더(`verify-shots/jp-city/interior-*-1x.png`)에서 문을 화소 그대로 품은 5×5 칸 조각을 잘라 kind `structure` 로 판정받고, 그 영수증이 문을 덮는다(gate_assembled 와 같은 규칙).
  1차 판정(76점)에서 «정면 입면도·윗면 0행»이 많았다 — 윗면을 1~2px 테로만 그리면 판정자는 윗면으로 세지 않는다. 윗면은 4~6행 별개의 판으로 그린다(`box(c, …, top=5…)`).
  2026-10-14 판정(gemini-3.8-flash ×4 과반, 보정 프로필 미보정 → PASS 는 «임시통과»): 다시 그린 48조각 중 1차 23 통과, 남은 25 를 한 번만 고쳐 재검수해 8 통과. 두 번 떨어진 17조각 + 문 2종(문 품은 조립 조각도 두 번 불합격)은 **굽지 않는다** — `interior/gate_hold.py` 의 `HOLD`(사유 포함), 블록이 `I.hold()` 로 레지스트리에서 빼고 `categories.py` 도 거른다. 예제 맵은 통과한 조각으로 바꿔 끼웠다(병원 미닫이 문 → 학교 `sc-classroom-door`, 접수 키오스크·수납기 → 휠체어·화분 등). 다시 넣으려면 그림을 고쳐 `object-gate review --force` 로 새 영수증을 받은 뒤 HOLD 에서 지운다(`--force` 없이 부르면 같은 해시의 옛 영수증이 그대로 나온다).
  기계·탁자형 윗면 도우미: `inst.py` 의 `box34`(앞면보다 1px 넓은 판·뒤 모서리 둥글림·판 밑 그림자)·`slab34`(판만). 윗면 판은 앞면보다 2톤 밝게, 판 위 물건은 줄여 빈 판을 2칸 이상 남긴다 — 판이 화면·뚜껑으로 꽉 차면 정면 판으로 읽힌다.
- 예제 5맵(생성기 `interior/gen_places6_{hospital,annex}.py` → `examples/*.json`): 종합병원 1층 외래(30×19: 대기실·종합 접수·진찰실 둘·처치실·원내 약국 투약 창구·계단/엘리베이터 홀) + 2층 병동(30×22: 2인 병실 넷·간호사 대기소·복도·계단 홀) — 장소 `jp-city-hospital-1f-30x19`; 학교 특별교실동(26×16: 취주악부실·인쇄실·트로피장 복도) `jp-city-school-annex-26x16`; IT 사옥 1층 로비 + 자유석 층 `jp-city-office-tower-1f-16x11`. 표 `examples/places6-{hospital,annex}.json`, 참고문서 용도 `interior-hospital`(`jp-interior-hospital-index`).
  예제 방 사각형(`rooms`)은 겹치지 않게 — 겹치면 방 견본이 옆 방 몫까지 가져간다(간호사 대기소가 복도 3줄을 먹어 빈 바닥 5줄이 됐다).
- **방 구성(program)**: `extract.mts` 가 places3~9(지하 던전 places4 제외)도 견본·program 표로 싣는다(jp_city 견본 35 → 144). 시험 `node scripts/content/jp-city/qa/program-rooms.mjs [program…]`(조수와 같은 `build_hand_interior_room({tileset:"jp_city", floor, wall, layout:{program}})`, floor·wall 은 필수) → `verify-shots/jp-city/program/`.
  `layout.ts`: 화풍 묶음이 없는 칩셋(jp_city)에서 program 이면 **같은 예제 맵 → 같은 건물** 견본을 먼저 고른다(전에는 종류만 같으면 아무 건물 — 사무 엘리베이터 홀에 호텔 붉은 카펫, 학교 복도에 다른 건물 나무 복도). HUB·출입 순서에 학교 昇降口·로비·병원 대기실·사옥 로비를 더했다. program 으로 짠 평면에는 «참고 예제와 n% 같다» 경고를 내지 않는다(도구가 짠 것이다).
- **길 고르기**(`src/ai/jpCityPolicy.ts` `jpFacilityOf`): 만들기 요청이고 실내면 사무실·회사 → office, 병원·진료실·대기실·병동·약국·의원 → hospital, «일본»·昇降口·신발장·上履き 가 붙은 학교 낱말 → school 로 jp_city 시설 실내 노트를 붙인다. 그냥 «교실·교무실·대학교 캠퍼스·기숙사»는 캠퍼스(`campusPolicy`) 그대로, 폐병원·폐교는 던전 장소 그대로. 결정: 일본 시설이라고 밝힌 요청만 jp_city 로 — 국적 없는 학교 낱말까지 옮기면 캠퍼스 칩셋(현대 학교) 사용자가 길을 잃는다.
- 문 맞춤(`handInteriorTools.ts` `fitDoorsToPlan`): 실내끼리 잇는 계단·층 이동(대상 맵이 indoor)은 거리 출구 틈으로 옮기지 않는다 — origin 의 문 맞춤이 일본 집 계단을 출구로 끌고 가 house-2f 가 `no-exit-gap` 으로 죽었다.
- layout(program·rooms)으로 지은 맵에는 방마다 위치 이름표(`hand-layout-room` + `composed-layout`)를 단다 — 조수 배치 품질 권고(«빈 바닥 → 맵을 줄여라»)가 견본 한 벌짜리 방을 빈 방으로 보고 손으로 다시 짓게 하던 것을 막는다(`piAgentRuntime.ts` 가 composed-layout 맵을 건너뜀). 시설 노트에도 «닿지 못한 빈 바닥 0·경고 0 이면 그대로 두고 다시 짓지 말라, 다른 배치는 layout.variant» 한 줄.
- 실조수 시험(입력창 경로, `harness-data/assistant-capability/ai-configs/gemini-4-argon.json`: 모든 역할 gemini-4-argon 추론 medium): 새 기본 프로젝트에 4문장(일본 학교 교실·회사 사무실·병원 진료실과 대기실·일본 학교 신발장과 복도). 지침 개선 전 7·7·8·6(c1 은 6번 다시 지음, c4 는 «빈 바닥» 권고에 22×16 손 짓기로 줄임) → 개선 후 7·7·8·7 — 넷 다 jp_city program(school-2f·office-floor·hospital-1f, c4 는 rooms 뒤 school-1f)으로 짓고 다시 짓기 없이 경고 0. 남은 흠: 학교 2층 두 교실이 소품까지 똑같다, 사무 층 자판기 옆 곁문, 학교 1층 계단 옆 짧은 문. 실조수 시험 중에 굽기 사슬(`interiorRoomTemplates.json` 을 origin 판으로 되돌렸다 다시 뽑는다)을 같이 돌리면 «방 구성 "school-2f" 이 없다»가 난다 — 둘을 겹치지 말 것. 3.8-flash·gpt 로 잰 점수와 섞지 않는다.
- 남은 것: program 배치 후보가 병실을 옆문으로 지나가게 짜는 경우(병동 program 후보 1) · 동·서 벽면 걸이 없음 · 의사·간호사 NPC 는 Actor1 이벤트.

## 숲 — 조수 도구 `paint_jp_forest`·지역/거리 숲·참고문서 `jp-forest` (2026-10-21, PR #3058)

- 숲은 1층 숲 바닥 오토타일 `jp-forest4-bl` + 나무 composer(`src/project/defaults/treeComposer.ts`, 그림 `scripts/content/jp-city/blocks/jp_forest_r4.py`). 나무·접지 그늘 칸은 composer 가 놓는다 — 낱칸·키트로 숲을 만들지 않는다.
- **조수 입구 셋:** ① `compose_jp_region` 숲 구획(r4 가 구워졌으면 기본, `grounding` 인자; 대숲 등산로는 r3 가 없으면 옛 대숲·삼나무 키트) ② `compose_jp_city_street` 주택가 공원 구획 뒤쪽 55% 에 `parkForest` (`grove` 기본 | `dense` | `none`) + `grounding` ③ 이미 있는 맵에 `paint_jp_forest`(`src/editor/tools/jpForestTool.ts`: `rect` | `beside{x,y,w,h,side,depth}` | `besideLocation`+`side`·`depth`, `forestType` `dense|grove`, `grounding`, `seed` = grove 덩이 모양만).
- 공용 함수 `paintJpForestArea`(`src/editor/jpCity/forestPainter.ts`): 요청 칸 ∩ 잔디(2~4층에 남의 칸 없음) → dense 는 2×2 열기, grove 는 값 잡음 분위수 55% + 3×3 열기 → 1층 숲 바닥(바닥에 맞춰 잔디 위 `bl`·이끼 바닥 위 `bm`) → `composeR4Family(…, 0)`(형제 composer 를 두 번에 나눠 짠다 — 한 번씩 `composeTreesAll` 을 부르면 서로의 나무를 지웠다). **composer 씨앗은 늘 0** — 편집기 붓이 씨앗 0 으로 다시 짜므로 다른 씨앗으로 세우면 붓질 한 번에 둘레 나무가 바뀐다(지역 도구도 0 으로 바꿨다).
- **판 r7 (2026-10-21, 독립 Opus 적대 VQA 7판 끝에 전부 통과):**
  - 나무: 수관 v7.
  - 숲 바닥 그늘: `forest_r6_ground.py` 의 매끈한 물결 흔들림 + 바깥 1px 성김. 곧은 칸 모서리 그늘이 보여 r2 에서 반려됐다.
  - 이끼 바닥 형제 그룹 `jp-forest4-bm`: 바탕 칸은 지역 팩 이끼 16109.
  - 접지(땅 그늘): 늘 켜진다. 도구의 `grounding` 인자는 옛 인자라 무시한다. 접지 없는 숲은 칸 격자 사각형으로 보여 반려됐다.
  - 대숲 키트 `jp-rg-bamboo-*`: `bamboo_mass`·`bamboo_crown` 으로 다시 그렸다.
  - 같은 판의 거리 그림 보정:
    - 함석 지붕: 골이 Λ 박공을 따라 기운다.
    - 단층·창고 지붕: 4단 + 4px 골.
    - 간판 탁점: 두 2×2 점, 그림자 없음. 굵히면 だ·が·ご 가 한 덩이로 붙었다.
    - 交: 1px 틈을 지킨다(文 으로 읽혔다).
    - 역 문 높이: 간판과 겹치지 않게 잘랐다.
  - 탈것: 동쪽(right) 버스는 `right_open` 이 없다(문이 반대쪽이다). 런타임이 닫힌 프레임으로 내린다.
  - 판정 기준: `harness-data/object-gate/vqa/jp-forest-r1.*`. 허용은 사용자 위임 감독 허용이다(18323 묶음 `jp-forest-r1`).
- 구조 검사 `checkJpForest`: `FOREST_TILE_ON_LAYER1`·`FOREST_ROOT_OFF_FOREST`(줄기 열 밑칸만)·`FOREST_OVER_FOREIGN`·`FOREST_TRUNK_MISSING`·`FOREST_APRON_OFF_LAWN`. 보기 좋은지는 판정하지 않는다.
- 참고문서 용도 `jp-forest`(4쪽·그림 8장 — 접지 비교 그림은 접지가 늘 켜져 뺐다)는 **따로 굽는다** — `forest_refs_scenes.mts`(실제 도구 결과·변조 검출 JSON) → `bake_forest_refs.py` → `src/assets/jpForestReferences.json` + `public/assets/jp-city-references/forest-*.png`. `jpCity.ts` 가 `jpCityReferences.json` 뒤에 붙여 `ensureJpCityReferences` 로 기존 프로젝트에도 심는다(bake_refs.py 재굽기가 숲 문서를 지우지 않게 파일을 나눴다). 숲 칸이 구워진 시트로만 굽는다(시트 칸 수 확인).
- 실조수 시험 `scripts/qa/jp-forest-assistant-run.mts`(Pi 실행기, `argonproxy/gemini-4-argon-high` 강도 medium, 새 SQLite 폴더 저장·재로드·1배 그림 → `verify-shots/jp-forest-assistant/<label>/`).
- **옛 번호는 옛 그림을 지킨다 (2026-10-21):** 핀은 덧붙이기만이다. 같은 키로 그림만 바뀐 칸(예: #3098 깊은 지붕·차량 다시 그리기)이 옛 번호에 덮어써지면 이미 깔린 맵이 바뀐다. `bake_jp.py` 의 `Cells._frozen_key` 가 옛 시트(정의 count 미만 번호)의 화소와 새 그림(야외는 색 계약 적용 후)을 비교해 다르면 키를 `<키>@r<sha8>` 로 바꿔 새 번호를 받게 한다. 굽기 보고 `tiles.rekeyed_art`(바꾼 키 수)·`tiles.old_cells_changed`(옛 번호 중 화소가 바뀐 칸, 0 이 아니면 굽기 거절). 실측(origin/main 핀 기준 임시 굽기): 칸 19,614 · legacy 1,837 · 다시 키 344 · 옛 칸 화소 변경 0 · 핀 이동 0. 전에 적었던 「옛 칸 1,493」은 이동이 아니라 legacy(이번 굽기가 만들지 않는 번호)였고, 그중 344칸이 제자리에서 그림이 바뀌고 있었다 — 이 규칙으로 막았다.

## 거리 계단 — 육교·옆 계단·단상·벽 사다리 (블록 `street_stairs`, `BLOCK_ORDER` 끝, 2026-10-22)

- 원본 `scripts/content/jp-city/blocks/street_stairs.py` (코드 손 도트, modern3 잠긴 팔레트, 빛 왼쪽 위). 칸 20071~20129(59칸, 덧붙이기만 — 옛 핀·화소 불변).
  사용자 견본(`.herdr-web-ui/paste-…png`)은 **구조만** 읽었다(두 갈래·층계참·그레이팅). 화소·색을 따거나 커밋·게시하지 않는다.
- 키트 7: `jp-overpass-stair-e/-w`(2×8, 13단 + 2×3 층계참, 가운데 손잡이) · `jp-overpass-deck-red`(2×6 가로 반복: 북 난간·바닥 2줄·남 난간·거더·기둥·그늘) ·
  `jp-side-stair-l/-r`(3×2, 콘크리트 판 4단, 짝) · `jp-stage-platform`(2×4 가로 반복, 나무 마루 + 옹벽) · `jp-wall-ladder`(1×3, 4층 덧그림).
  초록 상판(`kokuban`)은 관문 눈이 12/12 「정면 입면」으로 막아 이번에 넣지 않았다.
- 이름·설명은 모두 «올라가는 계단/사다리 · 들어서는 쪽 · 오를 때 보는 쪽 · 도착»을 적는다. 육교와 옆 계단은 같은 맵 안의 오르내림(`leads: same`, 층 이동 이벤트 없음), 사다리는 다른 맵(옥상)으로 가는 `up`.
- 통행은 칸 방향(`dirs`)으로 굽는다(`bake_jp.py` 의 dirs 패치): 육교 계단 칸은 위·아래만, 층계참 0줄(먼 난간) 막힘, 상판 2줄은 남쪽으로 못 나간다(남 난간),
  옆 계단 0줄은 동서만·1줄(앞면) 막힘, 단상 0줄은 북쪽으로 못 나간다. 엔진 `canMove` 가 나가는 칸·들어오는 칸 양쪽 방향을 다 보므로 옆으로 새지 않는다.
- 3/4 관문: 부품(계단·상판·옆 계단·단상)은 kind `part` 이고 조립 그림 `_gate/jp-overpass-assembled-red.png`·`jp-stage-assembled.png`(kind `structure`)의 영수증이 화소 그대로 덮는다
  (`_gate/assembled.json` → `gate_rooms.EXTRA_MANIFESTS`). 육교 조립·사다리 PASS(미보정 프로필 임시통과), 단상 조립은 눈 4/12 로 REFER → Opus 적대 VQA r24(major 0) 뒤 위임 허용
  (`harness-data/object-gate/vqa/jp-street-stairs.opus-vqa-r24.json`).
- 출하 플레이어 걷기: `scripts/qa/runtime/jp-street-stairs-fixture.mts` → `jp-street-stairs.scenario.mjs`(육교 오르기·층계참 막힘·상판 건너기·내려오기·옆 막힘·옆 계단으로 단상 건너기·사다리).
