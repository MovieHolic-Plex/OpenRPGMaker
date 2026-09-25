> 저장소 전환 안내(2026-09-21): 아래 옛 원격 DB·설정·명령은 과거 기록이다. 현재 저장·이관 지침은 [프로젝트 저장 전환](storage-retirement.md)과 AGENTS를 따른다.

# Object, space and place catalog UI

## 목록은 축소 그림만 그린다 (2026-09-24)

자료집의 장소·지역·타일·오브젝트·세계 목록은 맵을 컴파일하거나 칩셋 시트를 통째로 붙이지 않는다.

- 검토된 장소와 지역 사례는 `public/assets/catalog-thumbs/` 의 긴 변 256px 그림을 쓴다. 원본은 상세에서만 연다.
- 칩셋 목록 줄은 `catalog-thumbs/sheets/` 의 32×40 크롭이다. 다시 만들 때는 `scripts/content/build-catalog-thumbs.py`.
  이 스크립트는 `public/assets/reviewed-places` 파일과 호스트 공용 SQLite `previews` 의 data URL을 같은 256px 썸네일로 넣는다. 새솔마을처럼 원본 PNG 파일이 없는 장소도 목록은 그 썸네일을 연다.
- 장소·지역·세계 스테이지(맵 컴파일, 칸 격자)는 「상세」를 열었을 때만 붙는다. 오브젝트 카드는 그 물건의 칸만 나중에 굽는다.

## Concept and selection contract (2026-09-12)

`spatialStage.ts` shows a short, persistent explanation above the object, space
and place stages, including while creating a draft:

- **Object / 오브젝트:** reusable graphic and prop, including a whole building
  exterior (건물 외형). A tall image is not an interior floor definition.
- **Space / 공간:** a usable room, floor or yard, with surfaces, object slots and
  ports. Library cards expose interior/outdoor environment and dimensions.
- **Place / 장소:** composition of spaces or other places, with ports, connections
  and optional direct exterior graphic. Cards count direct space/place slots;
  the inspector separately reports composition, direct exterior, ports and links.
  These are authored design facts, not a promise that a compiled playable map exists.

Legacy `villageTemplates` cards retain their `house-template/house-shape` identity
and places routing. They are explicitly labelled **건물 외형 · 호환 도안**, with
an inspector note that visible stories do not create rooms or stair connections.
Village presets retain their separate settlement-region route.

Raw structure-kit object cards remain available when no canonical ObjectDesign
has the same `(tilesetId, kitId)`. A registered graphic instead shows its canonical
object card once. This does not merge distinct canonical designs sharing a graphic.

## Building exterior selection

`spatialPlaceExterior.ts`, re-exported through `spatialPlaceControls.ts`, provides
an ObjectDesign picker. It copies the selected object's **SpatialGraphic pair**
into `PlaceDesign.exterior`; it does not create an object child or copy chips,
anchors, rooms or connections. Subsequent changes to the object's chosen graphic
are not followed. The tile-kit reference itself still resolves through the usual
live/frozen compilation rules; no new asset or identity schema is introduced.

An unmatched existing graphic remains visible as a direct reference. The advanced
manual fields submit the tileset/kit pair together: entering the first field no
longer deletes an absent exterior and rerenders away the input. Partial pairs stay
local with a validation message. Selecting no direct exterior clears only that field.
An exterior placed as an object inside an outdoor space remains separate, so the
inspector labels its fact **직접 지정한 외형** rather than claiming no exterior exists.
All changes use `mutateWorkingPlace` and the detached preview/apply controller.

## Facility levels

The editor consumes the shared `project/spatial/facilityLevels.ts` policy:
levels 1–4 for facility members, and level 0 only for an outdoor space. `nestChild`
checks the source library; placed-level edits check the child's frozen library.
The child picker starts outdoor spaces on level 0 (labelled 지상), indoor facility
spaces and nested facility places on level 1. The inspector uses that same outdoor distinction for its minimum and the shared
maximum for its upper bound. Parent schema/reference validation owns this policy;
UI bounds alone never authorize a new floor range.

## Verification

Focused suites: `spatialPlaceActions`, `spatialPlacePlacedUi`, `spatialCatalog`.
They cover first exterior selection without live-store mutation, atomic manual
entry, fourth-floor acceptance/fifth-floor rejection, outdoor yard versus indoor
room at level zero, and canonical/raw graphic deduplication.

Browser replay: `node scripts/capture-spatial-kinds.mjs <base> <fixture-json> <out>`.
Use a serialized `placeCompilerFixture(7)` from
`test/support/spatialPlaceCompilerFixture.ts`. The harness blocks all non-origin
requests, enters a blank editor session, installs only this contract fixture,
selects the three canonical kinds and checks the exterior selection changes the
detached draft while leaving the live place unchanged. It never activates or
saves a remote project. Local evidence: `output/evidence/spatial-kinds-0912/`.
This is editor UI evidence; authored building publication and runtime navigation
require their own remote-save/reload and dedicated player QA evidence.

## Shared objects (2026-09-17)

자료집 → 맵 → 오브젝트 exposes the default source as **공용 오브젝트**, and authored objects as **내 오브젝트**. Other spatial tabs keep their existing labels. The shared source includes the restored **실내 확장 · Tibo** tileset (357 kits); its rail entry narrows the list to this pack. Assets and registration metadata ship in the repository and are seeded by defaultAssets for both new and loaded projects. Existing kit IDs, multi-tile dimensions and collision data are preserved. Shared objects use the existing copy-to-edit and placement flows. Source sheets, rejected iterations and recovery project snapshots are not shipped as library entries.


## 2026-09-18 — rejected interior catalog reset and style-first mockup

User authorized the audited indoor removal list. Removed 29 indoor-only reviewed roots and 12 indoor children from 11 mixed roots; retained those eleven exterior roots and all outdoor/dungeon designs. Removed the corresponding raster section kits and previews, cleared the 19 default facility registrations, and removed three cabin reference snapshots. Individual Tibo objects and tiles remain available. Worktree and live 9888 catalog were updated together. Historical author/export scripts and evidence are not active catalog seeds; do not rerun them to restore rejected designs.

Live SQLite project `c779e278-8cec-4da4-9c2f-df423460b60d`: revision 50 → 51, twelve house interior maps removed through the authenticated host save service with expected SHA. Door graphics were retained with their old transfer/animation command sequences cleared. Four outdoor maps remain. Backup and load-after-save evidence: `output/evidence/interior-removal-executed/host-proof.json` in the ab8d worktree.

Shared LegacyDb archive `oprn-shared-tibo-places-20260918`: removed 36 interior maps, their occurrences and source spaces, and the imported default interior place definitions; retained eleven exterior maps plus the blank start map and all 847 object definitions. Graph refresh/deletion releases ownership but deliberately retains map data, so the cleanup explicitly removes the approved orphaned interior maps and tree entries after graph operations. Saved with CAS and reloaded.

`public/places-mockup.html` is a standalone interaction mockup, not the production database panel. Primary hierarchy: tileset art style → outdoor/indoor/dungeon → purpose; Tibo is a compatible material extension within EasyRPG. Shared originals remain global; project placement creates copies. Mockup includes retained example previews, indoor empty state, search, purpose filter, detail pane, and create dialog, with no DB mutations. Live preview: `/places-mockup.html`.

Ship source archive `rpg-zzu-ship-20260913` was also CAS-saved/reloaded: three cabin maps/source spaces/snapshot children and their links removed, all four deck/harbor tile rasters preserved. Backup receipt remains historical evidence.

2026-09-18 mockup revision: art style remains the primary scope; category tabs now use 마을·도시 / 자연 / 건물·시설 / 던전·유적 / 이동수단. Independent environment filter uses 실외 / 건물 내부 / 지하 / 수중; purpose is a separate filter. Creation inherits category/environment and accepts comma-separated purpose tags. Custom categories can be added in mockup memory. No production panel or DB changes.


## 2026-09-18 — production place classification browser

`spatialPlaceClassification.ts` owns the independent style/category/environment/purpose view. `spatialPlaceLibraryControls.ts` supplies category tabs, searchable style/environment/purpose filters, and custom category creation in the actual Places gallery. Filtered-out selections are replaced with a visible card for preview; composition workspaces and instance editing continue using existing paths. `spatialPlaceLibrary.css` follows database theme colors and gives the card gallery 60% of the body.

New-place authoring records classification using existing persisted design tags: `그림체:`, `장소유형:`, `공간형태:`, `용도:`. Both standalone spaces and building containers retain the tags through the normal draft/save flow; no schema version change. User tags take precedence over compatibility inference for older designs. Metadata-less designs use underlying tileset, existing kind and conservative name hints, with unknowns exposed as 미분류. A new category is session-only until a design bearing that category is saved. Builtin catalogs remain shared; existing project-owned draft persistence is unchanged. Do not label project-owned drafts as globally published.

Category and environment are not generator shape enums: a dungeon can be outdoor; an underground facility can use the indoor structural generator. Browser evidence in `output/evidence/place-classification/` uses a read-only bridge; no project rows were modified for this UI change. Packaged builds were run; tests/gates/typecheck were not requested or run.

## 2026-09-21 — 강변 숲마을 기본 장소

`reviewedPlaceCatalog.ts`는 `riverVillagePlace.ts`의 「강변 숲마을」
(`place_river_forest_village`)을 공용 장소 맨 앞에 포함한다. 분류는 EasyRPG / 마을·도시 /
실외 / 주거·마을 꾸밈 기준이다. 기존 공용 장소와 같은 미리보기·복사·컴파일 경로를 사용한다.
`reviewedPlaces/riverVillage.json`은 LegacyDb `river-village-live-20260921-414a`의 승인된
78×44 실외 타일을 보관한다. 이벤트 문은 복사 가능한 정적 문 타일로 표현한다.
이 도안에는 NPC·실내·이동 이벤트가 없으며, 원본 프로젝트의 이벤트와 내부 맵은 보존한다.
미리보기 PNG는 `public/assets/reviewed-places/place_river_forest_village.png`이다.

`project/defaults/riverVillageStyle.ts`가 장소 이름·ID·기본 형태·칩셋·꾸밈 지침을 공유한다.
`withVillageMorphologyDefault`와 `prepareVillageDefaultTileset`이 실제 생성 기본값에 사용하고,
`villageDesignContext` 및 `author_village` 도구 설명이 같은 기준을 조수에 전달한다.
예제 집 8채를 요청 수량으로 강제하지 않는다. 명시한 테마·설계서·기존 맵·선택 범위가 우선이다.
중앙 강·양안 길과 주택·숲마을 나무 세트·기본 울타리 없음의 실제 시공은 마을 빌더가 담당한다.

재현: `node scripts/qa/river-village-place.mjs` (워크트리 서버 9839).
장소 복사 후 실제 `preview_spatial_build` → `apply_spatial_build` → 프로젝트 IO를 거쳐
전용 원격 행 `river-village-place-20260921-414a`에 publication RPC로 저장·재조회한다.
canonical spatial 프로젝트는 일반 projects upsert가 거부되므로 `publish_spatial_project`를
사용하며 업데이트는 읽은 서버 SHA로 CAS한다. 기존 원본 프로젝트 행은 수정하지 않는다.

등록 중 드러난 복사본 편집 문제도 수정했다. 자식 없는 직접 외형 장소는
`defaultComposition`이 외형 section 킷의 실제 크기를 사용한다(종전 40×30 고정은
78×44 마을을 잘랐다). 복합 캔버스는 하위 셀마다 `tileBackingTile`의 기존 받침 정책을
함께 그려 나무 아래가 투명 격자로 보이지 않게 한다. 맵 타일·통행 데이터는 바꾸지 않는다.

## 2026-09-22 — 기본 방 종류 카드 7종을 갤러리에서 제거

데이터베이스 → 장소(및 공간) 탭의 「침실·서재·식당/홀·주방·창고·선술집·복도」 카드는
저장된 설계가 아니라 `BUILTIN_INTERIOR_ROOM_KINDS`(코드 폴백 문법)가 카드로 렌더링된 것이었다.
사용자는 이를 "오브젝트 하나 딸린 빈 장소"로 오독했고, 지우는 방법도 없었다.

변경: `spatialCatalog.ts`의 `spaceCards()`가 기본 7종 카드를 만들지 않는다. 갤러리 공간 카드는
① 타일셋에 저작된 `interiorRoomKinds`(호환 방 규칙, source: own)와 ② 라이브러리 `spaces`
설계(source: own)만 남는다. 장소 탭 합침(`places: () => [...placeCards(), ...spaceCards()]`)도
`places: placeCards`로 분리해 방 종류 문법이 장소 탭에 다시 섞이지 않게 했다.

문법 자체는 남아 있다. `roomKindOf`·`renderRoomKindThumb`·`INTERIOR_ROOM_THEME_CATALOG`는
타일셋 「공간 종류」 저작(`tilesetSpacesTab`)과 실내 방 생성 파이프라인의 폴백으로 계속 쓰인다.
삭제한 것은 갤러리 노출뿐이다. 레일 검색 키에서도 spatialPlaces의 "공간·tilesetSpaces" 토큰을
빼서 공간 편집(장소 편집) 탭으로 유도한다.

검증: `npx tsc -p tsconfig.app.json --noEmit` 초록, `test/spatialCatalog.test.ts`(16)·
`spatialLegacyEditing`·`spatialSpaceMemberUi`·`spatialNavigation.routes` 35건 통과.

## 2026-09-22 — 장소 이미지 누락 복구

- `spatialCardThumbs.ts`는 다른 화면에 붙어 있는 캐시 DOM을 옮기지 않는다. 장소 목록과
  구성 요소 선택기가 같은 카드를 표시할 때 각각 그림을 유지한다. 분리된 정상 그림만
  재사용하며, 로드에 실패한 이미지/캔버스는 다음 렌더에서 다시 만든다. 캔버스를
  `cloneNode`하면 픽셀과 비동기 로드 핸들러가 사라지므로 복제로 우회하지 않는다.
- `kitRender.ts`는 실패한 아틀라스를 이미지 캐시에서 제거하고 캔버스에
  `data-preview-state`를 남긴다. 한 번 실패한 Image의 load 이벤트를 영원히 기다리지 않는다.
- `house-shape` 호환 장소는 `housePreviewMap`의 실제 외형 시공 결과를 카드와 스테이지에
  사용한다. 실내 시설 꾸러미 조회로 보내면 존재하지 않는 시설 오류가 난다.
- 공용 장소 카탈로그의 지연 import를 기다리는 모든 화면에 완료를 알린다. 최초 요청의
  콜백 하나만 보관하면 로딩 중 선택·화면 전환 뒤 새 화면이 빈 채로 남는다.
  import 실패도 빈 캔버스 대신 오류를 표시한다.

브라우저 확인: `node scripts/qa/place-preview-recovery.mjs <워크트리 URL>`.
공용 장소 전부 스크롤·이미지 디코드, 동일 카드 두 화면, 외형 도안 카드/스테이지,
동시 카탈로그 로딩과 이미지 실패 후 캐시 복구를 확인한다. 결과는
`output/evidence/place-previews/proof.json`, 화면은 `all-places-scrolled.png`.
저장 없는 최소 fixture를 사용하며 프로젝트 호스트/정본 콘텐츠를 수정하지 않는다.


### 2026-09-24 — bundled fallback for all 31 interiors

The same 31 shared root IDs and their 33 floor rasters are also included in `reviewedPlaces/catalog.json` and `reviewedPlaceIndex.ts`, with real map previews under `public/assets/reviewed-places/shared_*.png`. This makes the reviewed set available in new projects even on the released catalog path that does not load the host-wide SQLite extension. Dynamic shared enumeration deduplicates by these same IDs. The three-floor inn is one root with three floor children; all original lower/upper tile arrays are retained.

## 공용 장소 웹 배포 계약 (2026-09-24)

검수된 Tibo 실내 31종은 기본 카탈로그에 포함한다. 추가 공용 장소는 `loadSharedContent()`가 호스트의 `/__oprn/shared-content`에서 프로젝트 ID 없이 읽어 `installSharedReviewedPlaces()`에 설치한다. 웹 호스트와 Vite가 같은 SQLite 읽기 경로를 제공하며, 갤러리는 정적 상수 대신 `reviewedPlaceIndex()`를 사용한다. 썸네일도 호스트 공용 미리보기를 우선 사용한다. 프로젝트 소유 복사본은 변경하지 않는다.

등록 완료는 DB 저장만으로 판정하지 않는다. 해당 변경을 main에 병합하고, main의 커밋으로 빌드한 배포 파일에서 공용 로더와 장소 31종을 확인한 뒤 실제 hostProject URL의 자료집 → 맵 → 장소에서 재확인한다. 미커밋 파일로 빌드한 결과는 다음 배포에서 사라질 수 있다.

## 호스트 전용 장소의 목록 썸네일 (2026-09-24)

`spatialGallery.ts`의 경량 목록 경로도 `sharedPlacePreview(id)`를 먼저 조회한다. 상세 패널만 공용 그림을 지원하면 호스트 SQLite에 추가한 장소가 목록에는 잡혀도 그림은 404가 된다. 파일 경로 fallback은 기본 카탈로그에만 사용한다. 프로젝트에 복사된 장소(`authored-map_*`)는 같은 이름의 `shared_` 공용 미리보기를 붙인다. 직접 칠한 장소는 `public/assets/reviewed-places/<id>.png`를 쓴다. 신규 생활 실내5종을 기본 카탈로그에도 포함하고 사용자 프로젝트 및 별도 신규 프로젝트에서 목록·이미지를 재조회한다.

## RPG 판타지 장소 70곳 공용 DB 등록 (2026-09-25)

`scripts/content/publish-rpg-places-shared-library.mjs` 가 RPG 실내 34·RPG 던전 25·판타지 장소 11을 호스트 공용 SQLite 라이브러리
`oprn-rpg-fantasy-places-20260925` 한 개로 올린다. 원본은 각 파이프라인의 정본 저장 재오픈본(`output/evidence/<pipeline>/reloaded.json`).
번들 타일셋은 `shared_rpg_*` 사본으로 싣는다 — 그림은 이식(tileGrafts)·색 키를 구운 업로드 아틀라스, 맵마다 `raster_rpg_<id>` 구획 키트,
AI 참고문서는 파이프라인 분류만(던전 재칠 넷은 `referenceSourceTilesetId` 로 돌 사본의 문서를 공유). 올리기 전에 70장 모두를 원래 타일셋과
공용 사본으로 그려 픽셀이 같아야만 게시한다. 증명은 `tiledata/rpg-places/shared-library-proof.json`. 같은 장소가 번들 「완성 장소 사례」 카드로도
보이는 것은 검수 실내 31종과 같은 이중 경로다. 맵을 다시 고치면 파이프라인 저장 → 이 스크립트를 다시 돌린다(같은 id 에 비교 교환으로 덮는다).
