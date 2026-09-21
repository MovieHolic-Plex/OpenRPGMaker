> 저장소 전환 안내(2026-09-21): 아래 옛 원격 DB·설정·명령은 과거 기록이다. 현재 저장·이관 지침은 [프로젝트 저장 전환](storage-retirement.md)과 AGENTS를 따른다.

# Object, space and place catalog UI

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
