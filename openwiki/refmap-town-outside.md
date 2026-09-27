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
| `refmap-interior` 실내 + 마녀의 방 | 内装用データ + 魔女の部屋 | A1 A2 A4 B C(마녀) A5 | 여관 1층 · 마녀의 집 · 농가 · 잡화점 · 저택 서재 · 겨울 축제 집 · 성 알현실 · 성 지하 감옥 · 저택 객실동 · 연회장 (10곳) |
| `refmap-dungeon-extra` 던전 칩 추가 | 中間データ ダンジョンチップ追加 + 단품 확장 | A1 A2 A4 B + A2_Extra C | 바위 동굴 · 지하 호수 · 무너진 유적 신전 · 지하 묘지 · 빛 드는 샘 동굴 |
| `refmap-south-island` 남쪽 섬 | 南の島 + 단품 확장 | A1 A2 A4 B A5 + A2_Extra C | 야자수 해변 · 정글 언덕 · 섬 마을 · 해변 어시장 · 산호 석호 |
| `refmap-volcano` 화산 | 火山タイルまとめ | A1 A2 A4 B A5 | 용암 동굴 · 화산 기슭 |
| `refmap-crayon` 크레용풍 | クレヨン風マップデータ | A1 A2 A3 B A5 | 들판 마을 · 숲 |
| `refmap-photo` 사진 가공 | 写真加工タイルセット | A2 A4 B | 들판 · 숲길 |
| `refmap-mz-ground` MZ 지면 | 地面タイル(MZ) | A1 A2×3 | (장소 없음 — 타일셋·재료만) |

- **슬롯은 크기로 정한다.** 글 안 라벨이 틀린 경우가 있다(768×768 인데 「A5」, 384×768 인데 「B」). 768×768 = B~E, 384×768 = A5, 768×576 은 순서(01=A1, 02=A2).
  마녀의 방은 B 한 장뿐이라 실내 세트의 C 시트로 붙였다. 写真加工地面(384×144)은 세트가 아니라 뺐다.
- 흐름: `_work/<세트>/sheets.json`(prep) → 에이전트가 그림을 보고 `preset.json`·`maps/*.json` 작성
  → `bun scripts/content/refmap/set-tool.mts check|render <세트>` → `gen-presets.mts`(저장소 `packs/refmapSets.json`, 그림 없음)
  → `publish-sets.mts [--dry] [세트…]`. 증거 `tiledata/refmap/<세트>-proof.json`.
- 공용 DB 만 읽어 다시 그린 맵은 게시 전 그림과 픽셀 동일(0px). 8개 라이브러리 합 약 50MB 가 모든 프로젝트에 실린다.
- **맵은 목적으로 깐다 (2차 재작업, 2026-09-27).** 1차는 「빈 바닥 40% 이하」 같은 밀도 규칙만 줘서 잔소품을 고루 뿌린
  무목적 맵이 나왔다(폐광: 채굴 흔적 0에 잔돌 21개, 마녀의 집: 방 용도 없음·막다른 통로). 지금은 맵마다 `maps/<id>.plan.md`
  (한 줄 이야기 · 구역별 용도+앵커+곁들이 물체 · 입구→목적지 동선)를 먼저 쓰고 그대로만 깐다. 잔소품은 앵커 곁·벽 모서리에만.
  반대로 너무 비우지 않게 17×13 화면마다 의미 있는 것 2~4개, 8×6 넘는 빈 바닥 금지, 방 크기는 내용물에 맞춘다.
  검수는 축소판이 아니라 48px 원본을 구역마다 잘라(`set-tool crop`) 「이 물체가 왜 여기 있나」로 본다.
- 던전 칩 시트에는 레일·광차·광석이 없어 폐광을 그릴 수 없다 → 지하 호수로 바꿨다. MZ 지면은 물체가 없어 목적 있는 장면이
  안 되므로 장소 없이 타일셋·재료로만 게시한다(맵 기술은 `_work/refmap-mz-ground/maps-unpublished/`).
- **구조 문법 (3차 재작업, 2026-09-27).** 사용자 지적: 집이 덜 지어졌다(4칸 박공 조각 + 벽 1줄), 계단이 이상하다(북벽 가운데 Λ, 번갈이 마루 통로),
  천장 밑에 벽이 없다, 방이 전부 ㅁ자다. `lib.mts` 의 `lintStructure` 가 render·publish 경고에 「구조:」 로 잡는다 —
  A4 천장·A3 지붕 남쪽 끝 밑 벽면 없음 / 벽면 위 윗면 없음 / 벽면 1줄. 경고 0 이 합격선이다.
  작가가 직접 짠 견본 스크린샷이 `refmap-downloads/reference/`(마녀의 집 `test/2019-11-03_*組み見本`, 민가 실내 `research/2018-06-20_*`,
  집 외관 `research/2018-06-07_*`)에 있다 — 맵을 깔기 전에 연다. 실내는 ㄱ·ㄷ자 방·알코브·두꺼운 칸막이, 계단은 옆벽 따라 사선,
  집은 몸채(지붕 3~4줄 × 6~9칸) + 벽 2줄 이상 + 박공 날개·지붕창, 굴뚝은 지붕 위.
- **공간이 남으면 공간이 너무 큰 것이다 (4차, 사용자 격언).** 빈 바닥은 물체로 메우지 말고 방·맵을 줄인다.
  `set-tool space <세트>` 가 물체·가구 없는 걸을 바닥의 가장 큰 빈 직사각형을 낸다. 합격선: 짧은 변 3 이상인 빈 직사각형이
  실내 12칸·야외 20칸 이하(폭 1~2 띠는 복도·길이라 제외). 22장 모두 줄여서 통과(화산 기슭 42×30 → 25×25 등).
- **통행이 되어야 한다 (5차, 2026-09-28).** 사용자 지적: 집 안이 너무 크고, 침대가 길을 막고, 시계가 벽에 안 걸렸다. render 경고에 붙은 검사
  (`lib.mts lintPassage`, 경고 0 이 합격선, publish 는 경고가 있으면 멈춘다):
  - `통행:` — 엔진 규칙(`collision.ts passabilityOf` + 방향 통행)으로 입구에서 못 가는 바닥, 닿을 수 없는 가구, 발치로만 닿는 침대,
    키 큰 물체 몸통(윗칸)을 지나야만 닿는 바닥, 막힌 땅(물·벽·천장) 위를 걷게 만든 칸(물 위 decal·문 윗줄 누수). 물 위 2층 길·징검다리는 여울로 인정.
  - `벽걸이:` — 벽면 밖 wallmount, 벽에 안 붙은 벽 가구(선반·찬장·괘종시계·벽난로·갑옷·침대 머리).
  - `겹침:` — 큰 물체끼리 막힘 칸 겹침. 낱장 `tile` op 는 막힘(걷는 무늬는 `"pass": true`).
  - `set-tool space` 실내 합격선을 짧은 변 ≥3 빈칸 9칸으로 조였다.
  - 흐름: 고치지 않는 적대적 검수 에이전트(원본 크기 구역 crop + 엔진 통행 재계산) → 수리 → 재검수, 22장 3회 만에 전부 통과.
- **세트 확장 시트 (6차, 2026-09-28).** 세트 시트만으로 꾸밀 거리가 모자라 같은 작가의 MV 단품(`material/mv/tile-single/`)을
  `_packs/<세트>/` 의 `A2_<태그>_Extra.png`(오토타일 덩이)·`C_<태그>.png`(물체)로 모았다(로컬만, 커밋 금지). `sheets.json` 에 source 로 원본 파일명.
  던전: 유적 기둥·폐허 구멍·무덤·고목·낮은 턱·샘 / 섬: 움집(竪穴住居)·해안 얕은 물·모래·바구니 식재료·열대 나무·시장 소품. 가이드에 「꾸미기 조립법」.
  검사 추가: `set-tool check` 「같은 칸 다른 kind」, render 「막혀야 할 물체 칸이 뚫림」·「모양: 네모난 물 덩이」(수조·수로 제외).
- 굴 입구처럼 윗줄이 대지에 닿는 `door` 물체는 preset `solid` 로 윗줄을 막는다(`tilesetPreset.ts objectCellSolid` 가 door 의 solid 를 읽는다).
  창살문·벽을 판 출입구는 두 줄 다 지나간다.
- 약점: 복도가 긴 실내(여관 동쪽, 객실동, 서재 회랑), 화산 길 색이 모래와 비슷함, 사진 들판 샘이 네모에 가깝다.

### 세트 맵 기술 (maps/*.json)

`{ id, name, note, tags, usage, w, h, entry?, ops[] }`. ops 는 순서대로 칠한다.
- `{layer:1|2, mat, rect:[x,y,w,h] | cells:[[x,y]…]}` — mat = 재료 이름(preset autotiles/flats 의 name) 또는 `{sheet,kind}` · `{sheet,cell:[열,행]}`.
- `{layer:1|2, rows:["..TT", …], legend:{T:재료}, at:[x,y]}` — `.`·공백은 건너뛴다.
- `{obj:"<물체 id>", at:[x,y], layer?:3|4}` — 투명 칸은 찍지 않고, 3층이 차 있으면 4층.
- `{tile:{sheet,x,y,w?,h?}, at, layer?}` · `{erase:1|2|3|4, rect}`.
- 1층 = 바닥 오토타일·A5 평타일, 2층 = 겹침 오토타일·A3 지붕/벽, 3·4층 = 물체. 오토타일 모양은 이웃으로 계산(맵 밖 = 같은 재료, A1 물은 폭포와 이어짐).
