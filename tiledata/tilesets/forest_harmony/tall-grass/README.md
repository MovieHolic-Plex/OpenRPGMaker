# 키큰 풀 E/F/G (숲마을 화풍, 2026-09-24)

사용자 판정: 「274번을 위시한 키큰 풀이 이상하다 — 도트적으로 뜯어고쳐야 한다. 다양한 바닥 타일이 없어서 곤란하다」.
시안 http://mdc-server:18301/tall-grass-redraw.html 에서 E/F/G 셋 다 승인, 섞는 방식은 **방향 ①: 덩이마다 한 종류**.

| 종류 | 오토타일 그룹 | 쓰는 곳 | 외딴 | 오목 | NW N NE | W 몸통 E | SW S SE |
|---|---|---|---|---|---|---|---|
| E 짙음 | `builtin_tall_grass` (옛 id 유지) | 숲 수관에 닿는 덩이 | 243 | 245 | 273 274 275 | 303 304 305 | 333 334 335 |
| F 밝음 | `builtin_tall_grass_light` | 숲·집·길에서 떨어진 트인 풀밭 | 1127 | 1157 | 1124 1125 1126 | 1154 1155 1156 | 1184 1185 1186 |
| G 짧음 | `builtin_tall_grass_short` | 집·길 3칸 안 덩이 | 1131 | 1161 | 1128 1129 1130 | 1158 1159 1160 | 1188 1189 1190 |

- 244 는 옛 블록의 미사용 칸이라 그대로 둔다.
- F/G 는 기본 시트(`public/assets/forest-harmony/chipset.png`, 2550칸)의 **빈 칸** 37~39행 14~20열에 그렸다.
  2550 아래라서 이식(2550~2759, 판타지 장소 2760칸), 설원 얼음 사본(2730~), 기후 시트의 번호 그대로 복사와 겹치지 않는다.
  같은 번호가 forest_harmony(2550/2610/2730/2760칸)와 기후 시트 넷에서 모두 맞다.
- 모든 칸: 통행 가능, 하위 레이어(priority lower, layerHome lower), terrain 0.
- 타일 그룹(AI 팔레트): `harness-combined-town-tall-grass-autotile`(E — 옛 문법은 모든 칸을 center 로 적어 채우기가 가장자리 조각을 무작위로 뿌렸다. center=304 하나, 변·모서리 역할을 바로잡음), `forest-tall-grass-light`(F), `forest-tall-grass-short`(G).

## 그림
- 생성기 `scripts/content/tiles/tall-grass-redraw.py` — 부채꼴 풀잎 포기 + 짙은 윤곽, 16px 주기, RM2K 3×4 가장자리. 바탕은 그 시트 자신의 잔디 240.
  `python3 scripts/content/tiles/tall-grass-redraw.py` 가 숲 시트 두 장(chipset.png, 같은 그림을 담은 `region-references/river-forest-village-atlas.png`)을 다시 칠하고 `src/assets/forestTallGrass.json`(번호 표)을 쓴다. 다시 돌려도 바이트가 같다.
- 옛 EasyRPG 계열 아틀라스(`forest-cliff-village-atlas.png` 등 region-references 의 절벽마을·굽이숲·유기 마을 아틀라스)는 243~335 에 **다른 그림**(점박이 잔디)이 있다. 건드리지 않는다.
- 기후 시트: `scripts/content/build-climate-chipsets.py` 가 재칠한 뒤 `tall_grass.paint_sheet(sheet, climate)` 로 그 기후의 풀 색 사다리(설원 서리 풀·사막 마른 풀·화산 재 풀·가을 단풍 풀)를 재칠된 잔디 위에 다시 그린다. 재실행해도 33칸 밖 화소는 그대로(검증함).

## 데이터
- 정의 `src/project/defaults/forestTallGrass.ts` — `ensureForestTallGrass(tileset)`: E 이름 바꿈(출하 이름일 때만), F/G 그룹·칸 메타 추가(이식이 그 칸을 쓰면 건너뜀), E 타일 그룹 문법 수리, F/G 타일 그룹 추가. 멱등.
  `ensureBundledTilesets` 가 불러올 때 부르므로 옛 저장본·옛 장소 스냅숏에서 들어온 타일셋도 새 그룹을 얻는다.
- 출하 데이터 굽기: `npx vite-node --script scripts/content/tiles/apply-tall-grass-tileset.mts` → `forestHarmonyTileset.json`, `climateVillageTilesets.json`(공유 base + 기후별 이름), `tiledata/forest-villages/diverse/catalog.json` 의 타일셋.
- 장소 스냅숏(`src/project/regionReferences/*.json`, `public/assets/region-references/*.oprn.json`)은 타일셋을 통째로 담지만 그 맵들에는 키큰 풀이 없어 다시 굽지 않았다(불러올 때 위 함수가 채운다).

## 배치 도우미
`scripts/content/lib/tall-grass.mjs` 의 `arrangeTallGrass(map, { tileset, houses, cells, seed })` — 서명은 파일 머리에.
(a) 2×2 안 되는 조각·1칸 띠 삭제 → (b) 볼록 모서리 해시로 깎기(0.7, 이웃이 2×2 를 잃지 않을 때만) → (c) 8방향 덩이마다 종류: 수관(grove·canopy_47) 1칸 안이면 E, 집(tileMeta 역할·`houses`)·길(road_47·흙길·포석) 3칸 안이면 G, 나머지 F → (d) 그 종류 variantMap 으로 칸 선택.

## 적용한 맵 (2026-09-24 main)
- `src/project/defaults/spatial/reviewedPlaces/riverVillage.json`(장소 「강변 숲마을」 place_river_forest_village): 4×10 네모 → G 한 덩이 37칸(모서리 3칸 깎음). 미리보기 `public/assets/reviewed-places/place_river_forest_village.png` 다시 그림.
  재실행: `node scripts/content/tiles/apply-tall-grass-maps.mjs`.
- 그 밖의 main 숲마을·필드·기후 맵에는 키큰 풀이 없었다. 옛 아틀라스 맵은 그림이 달라 대상 아님.

## 검증
- `node scripts/qa/capture-tall-grass-editor.mjs`(BASE=dev:worktree 주소) → `verify-shots/tall-grass/` 실제 편집기 캔버스 5장(숲·설원·사막·화산·가을) + 그룹·통행 증거.
- 비교 그림 http://mdc-server:18301/tall-grass-applied.html
