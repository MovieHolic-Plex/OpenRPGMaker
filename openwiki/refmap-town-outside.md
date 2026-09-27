# REFMAP「町の外観」— MV 프리셋과 공용 DB 장소 3곳

REFMAP(https://refmap-l.blog.jp/) 의 MV/MZ 타일셋 「Town Outside」 7장(A1·A2·A3·A4·B·C·D2)으로 깐 맵 3장을
에디터 모델 그대로 공용 DB 에 올린다. 약관은 게임 제작 무료·가공 그림 배포 가능·**무가공 재배포와 판매 금지**라
원본 그림은 저장소·번들에 넣지 않는다. 저장소에는 시트 이름·sha256·칸 좌표·사람 말 이름뿐이다.

## 어디에 무엇이 있나

| 무엇 | 위치 |
|---|---|
| 원본 시트(사용자가 받은 로컬 사본) | `~/.local/share/oprn/refmap-downloads/_packs/refmap-town-outside/*.png` |
| 깔아 본 맵 3장(JSON + 그때 그린 PNG) | `~/.local/share/oprn/refmap-downloads/_maps/{village,forest,water}.{json,png}` |
| 프리셋(오토타일 종류 이름·물체 42개·까는 법 MD) | `src/project/rpgmakerMv/packs/refmapTownOutside.ts` → `MV_PACK_PRESETS` |
| 게시 스크립트 | `scripts/content/refmap/publish-refmap-places.mts` (bun) |
| 게시 증거(그림 없음) | `tiledata/refmap/shared-library-proof.json` |

맵 JSON 형식: `auto[0|1]` = MZ 1·2층 오토타일 `[x,y,시트,종류]`, `stamps[0|1]` = 3·4층 `[x,y,[[시트,열,행]…]]`,
`px` = 칸에 맞지 않는 물체 `[시트,열,행,폭,높이,px,py]`.

## 게시

```bash
bun scripts/content/refmap/publish-refmap-places.mts --dry   # 변환·대조만
bun scripts/content/refmap/publish-refmap-places.mts         # 공용 SQLite 에 게시
```

- 라이브러리 `refmap-town-exterior-local`(`projectDefaults: true`), 타일셋 `shared_refmap_town_outside`(MV 64열 합본, 48px, 6144칸),
  그림 `shared_refmap_town_outside_atlas`.
- 장소 3곳: `shared_refmap_{village,forest,water}` → 층 장소 `shared_floor_refmap_*` → 구획 킷 `raster_refmap_*`.
  층 장소의 `maps` 기록은 MZ 4층을 그대로 담는다(1층 `lowerTiles` · 2층 `lowerOverlayTiles` · 3층 `upperTiles` · 4층 `upperOverlayTiles`).
  구획 킷은 두 줄만 담으므로 2층을 1층 위에, 4층을 3층 위에 덮어 쓴다.
- 오브젝트: 프리셋 소품 킷 42개(`learnedFrom: "pack-preset"`) + 마을·물가 맵에서 떼어 낸 집 킷 7개(`shared_refmap_house_*`).
  집은 2층 지붕·벽(A3) 덩이 + 그 위 3·4층 칸이다. 지붕 위 굴뚝 한 줄까지 넣는다.
- 게시 전 `~/.local/share/oprn/backups/shared-content-before-refmap-*.sqlite` 사본, 게시 후 다시 읽은 본문 = 게시본, 다른 라이브러리 해시 불변을 확인한다.

## 변환 규칙과 함정

- **오토타일 모양은 이웃으로 다시 계산한다.** 맵 밖은 같은 재료(MV). **A1 물은 폭포 칸도 이어진 물로 센다** — 안 그러면 폭포 위아래
  연못에 둑이 그려진다(RPG Maker 와 같다). 이 규칙으로 물가 맵이 원본과 맞는다.
- **`px` 물체(가로등)는 가장 가까운 칸으로 붙인다.** 원본은 17px 위에 그려 있다 — DB 로 다시 그리면 마을 6개·물가 1개 가로등 둘레만 다르다
  (마을 14,205px · 물가 2,350px, 나머지 0). 숲은 원본과 픽셀 동일.
- **그림은 PIL 로 무손실 재압축한다.** pngjs 는 합본을 15MB 로 쓴다. PIL `optimize` 로 4MB. 라이브러리 26.5MB → 9.1MB.
  `projectDefaults` 라이브러리는 모든 프로젝트에 실리므로 줄인다.
- **오브젝트 탭에 뜨려면 `projectDefaults: true`.** `ensureSharedContent` 가 그 라이브러리의 `shared_*` 타일셋·그림만 프로젝트에 넣고,
  오브젝트 탭(`spatialCatalog.objectCards`)은 프로젝트 타일셋의 구조 킷만 본다. 장소 탭은 projectDefaults 없이도 뜬다.
- **MV 팩 킷 썸네일에는 받침을 깔지 않는다**(`kitThumbBackgroundTile`). 받침 번호는 실내 칩셋 바닥(`VR.FLOOR`)인데 MV 합본에선 A1 물이라
  빈 칸마다 물이 비쳤다.
- 큰 합본(3072×4608)이라 장소를 맵에 놓은 직후 Phaser 가 그림을 싣는 30초가량 `__MISSING tile_*` 경고가 쏟아진다. 실린 뒤엔 멎고 맵은 제대로 그려진다.

## 확인 (2026-09-27)

- 공용 DB 만 읽어(타일셋 그림 + 4층 맵) 다시 그리면 숲 0px, 마을·물가는 가로등 둘레만 다름.
- 편집기 자료집 → 맵 → 장소 「REFMAP」 검색 3곳, 오브젝트 「REFMAP」 검색 10개(집 7 + 장소 구획 3), 「큰 활엽수」 등 프리셋 소품.
- 장소 「맵에 놓기」 → 42×30 맵이 생기고 Phaser 가 우물·가판·통·길을 원본대로 그린다.

## 세트 8개 더 (2026-09-27)

받아 둔 MV/MZ 타일셋 글(`_catalog/assets.csv`)을 세트 8개로 묶어 같은 방식으로 올렸다. 세트마다 라이브러리 `<세트>-local`
(`projectDefaults`), 타일셋 `shared_<세트>`, 완성 맵 2장(장소), 프리셋 물체(오브젝트), 2층 A3 덩이에서 떼어 낸 집 킷.

| 세트 | 원본 글 | 시트 | 맵 |
|---|---|---|---|
| `refmap-snow` 설원 마을 | 雪マップ | A1 A2 A3 A4 B C D | 설원 마을 · 설산 숲길 |
| `refmap-interior` 실내 + 마녀의 방 | 内装用データ + 魔女の部屋 | A1 A2 A4 B C(마녀) A5 | 여관 1층 · 마녀의 집 |
| `refmap-dungeon-extra` 던전 칩 추가 | 中間データ ダンジョンチップ追加 | A1 A2 A4 B | 바위 동굴 · 폐광 층 |
| `refmap-south-island` 남쪽 섬 | 南の島 | A1 A2 A4 B A5 | 야자수 해변 · 정글 언덕 |
| `refmap-volcano` 화산 | 火山タイルまとめ | A1 A2 A4 B A5 | 용암 동굴 · 화산 기슭 |
| `refmap-crayon` 크레용풍 | クレヨン風マップデータ | A1 A2 A3 B A5 | 들판 마을 · 숲 |
| `refmap-photo` 사진 가공 | 写真加工タイルセット | A2 A4 B | 들판 · 숲길 |
| `refmap-mz-ground` MZ 지면 | 地面タイル(MZ) | A1 A2×3 | 풀밭→눈밭 필드 · 호숫가 들판 |

- **슬롯은 크기로 정한다.** 글 안 라벨이 틀린 경우가 있다(768×768 인데 「A5」, 384×768 인데 「B」). 768×768 = B~E, 384×768 = A5, 768×576 은 순서(01=A1, 02=A2).
  마녀의 방은 B 한 장뿐이라 실내 세트의 C 시트로 붙였다. 写真加工地面(384×144)은 세트가 아니라 뺐다.
- 흐름: `_work/<세트>/sheets.json`(prep) → 에이전트가 그림을 보고 `preset.json`·`maps/*.json` 작성
  → `bun scripts/content/refmap/set-tool.mts check|render <세트>` → `gen-presets.mts`(저장소 `packs/refmapSets.json`, 그림 없음)
  → `publish-sets.mts [--dry] [세트…]`. 증거 `tiledata/refmap/<세트>-proof.json`.
- 공용 DB 만 읽어 다시 그린 16장은 게시 전 그림과 픽셀 동일(0px). 8개 라이브러리 합 약 50MB 가 모든 프로젝트에 실린다.
- 약점: MZ 지면 두 장은 물체가 없어 네모진 풀 얼룩이 드러나고, 화산 기슭은 성기다.

### 세트 맵 기술 (maps/*.json)

`{ id, name, note, tags, usage, w, h, entry?, ops[] }`. ops 는 순서대로 칠한다.
- `{layer:1|2, mat, rect:[x,y,w,h] | cells:[[x,y]…]}` — mat = 재료 이름(preset autotiles/flats 의 name) 또는 `{sheet,kind}` · `{sheet,cell:[열,행]}`.
- `{layer:1|2, rows:["..TT", …], legend:{T:재료}, at:[x,y]}` — `.`·공백은 건너뛴다.
- `{obj:"<물체 id>", at:[x,y], layer?:3|4}` — 투명 칸은 찍지 않고, 3층이 차 있으면 4층.
- `{tile:{sheet,x,y,w?,h?}, at, layer?}` · `{erase:1|2|3|4, rect}`.
- 1층 = 바닥 오토타일·A5 평타일, 2층 = 겹침 오토타일·A3 지붕/벽, 3·4층 = 물체. 오토타일 모양은 이웃으로 계산(맵 밖 = 같은 재료, A1 물은 폭포와 이어짐).
