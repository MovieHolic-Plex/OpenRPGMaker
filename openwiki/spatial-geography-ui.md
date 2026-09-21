# Region and world visual authoring

Task16 owns the geography canvases. It does not replace the compiler
contract in `spatial-geography-compiler.md`, the shared shell/stage, or
catalog publication.

## Public modules

- `src/editor/panels/spatialRegionsTab.ts`
- `src/editor/panels/spatialWorldsTab.ts`
- Geography-only helpers: `spatialGeographyDraft.ts`,
  `spatialGeographyGeometry.ts`, `spatialGeographyCommands.ts`,
  `spatialGeographyCanvas.ts`, `spatialGeographyInspector.ts`,
  `spatialGeographyRaster.ts`, `spatialGeographyTools.ts`
- Styles: `src/styles/database/spatial-geography.css` (Database Studio
  tokens only; cream wash on the board, no new theme)

This worktree wires `renderSpatialRegionsCanvas` /
`renderSpatialWorldsCanvas` and geography chrome into `spatialStage.ts`,
imports `spatial-geography.css` from `src/styles/index.css`, and uses
`openSpatialDestination` for child drill so `setSpatialTab` does not
drop breadcrumbs. `bindSpatialAuthoringControllerFactory` stays the
database.ts binding. Six selectable shipped region examples remain
task18; they are not completed here.

## Settlement regions (2026-09-12)

Villages are regions, not places. `villagePresets` records surface as
`regionKind: "settlement"` cards in the regions gallery; `villageTemplates`
(house shapes) stay in places. The legacy `villages` database route selects the
regions tab with `regionKindFilter: "settlement"` and mounts the old
`renderVillageTab` inside a `.spatial-legacy-host` on the regions stage; the
canonical regions rail clears both. A preset card's inspector exposes
「정주지 지역 만들기」 (`createSettlementRegion`), which writes a real
`RegionDesign` with `settlement { presetId, seed }` into
`library.regions`. The region inspector shows the source preset and an editable
seed. Preview and compile both stamp the actual village — see
[the compiler contract](spatial-geography-compiler.md#settlement-regions-2026-09-12).

Legacy projects without a `spatialAuthoring` document cannot create
geography: `upsertGeography` would silently no-op, so 「추가」 and
「정주지 지역 만들기」 bail early via `spatialDocumentPresent` and
surface an activation-required message. The stage toolbar now exposes a
「공간 설계 활성화」 action on exactly those projects — `domainChrome` in
`spatialStage.ts` overlays `activate` on every spatial tab (not just
regions/worlds) while the document is missing, wiring it to
`activateSpatialDocument`, which calls `store.activateSpatialAuthoring()`
and guards re-entry through `geographyChromeState.activating`. Activation
errors are project-scoped: a failure message is cleared once a canonical
document exists, and the overlay surfaces it on whichever tab the user is
viewing. The store
still enforces remote persistence, a clean working copy and legacy-baseline
conversion; the button only surfaces that path instead of leaving the
message dead-ended. Browser QA for this surface needs a canonical project;
when the dev DB lacks the spatial CAS
migration (`migration-required` on publish), seed a converted project
through the `__OPRN_E2E_PROJECT__` dev hook — build it with
`convertLegacySpatialSnapshot(serialize(project))`, never by editing raw
JSON by hand.

## Catalog read-only rendering (2026-09-12)

Region/world gallery cards without a library draft render from the shipped
catalog, not from an empty stage: `catalogRegionDesign` / `catalogWorldDesign`
in `catalogSeed.ts` rebuild the `RegionDesign`/`WorldDesign` from
`geographyCatalog.ts`, and the canvas/inspector show read-only facts plus a
「추가」 hint. Preview stays disabled until `hasAuthoringDraft()`.

Two traps fixed while wiring thumbnails:

- **Catalog materials are not compiler materials.** The catalog reuses the
  space-catalog slot names (`groundAlt`, `cliff`, `path`) but
  `geographyTerrain` only knows the world-chipset vocabulary (ground/water +
  `WORLD_TERRAIN_BLOCKS` keys). `catalogSeed` translates via
  `WORLD_TERRAIN_MATERIAL` (`groundAlt→forest`, `cliff→mountain`, `path→dirt`)
  so every shipped region compiles for preview.
- **Private atlases live in the preview clone only.** `geographyTerrain` can
  retarget a map to a `world_structures_*` atlas that exists only inside the
  cloned preview project. `renderGeographyThumb` therefore resolves
  `map.tilesetId` against `preview.project`, not the live project — otherwise
  the card silently falls back.

## Authoring rules

Edits go through the project-scoped detached draft. Preview and apply
are explicit. Undo/redo are controller methods. There are no live store
writes from the canvas and no reconstructed draft handles.

- Source cards patch the reusable library. Placed cards patch the frozen
  occurrence snapshot only.
- Region children and route vertices are integer overview coordinates.
  Child-local ports stay on the child design/map.
- Region routes are authored orthogonal polylines. Endpoints must match
  the positioned children. An invalid move or route is rejected before
  apply; it does not erase obstacles.
- Occurrence delete/refresh first try `externalConnections: "reject"`.
  When the preview rejects with `external-connection`, the request is
  armed as `geographyChromeState.pendingExternal` and the 「확인」 button
  retries once with `remove` — the failure is never a dead end. The
  `SpatialOperationError` code reaches the UI through `detail` on the
  controller result (`src/editor/spatial/actions.ts`).
- World connections have no path-point field. The canvas draws the
  compiler's horizontal-then-vertical crossing from the two child
  positions. Entry is an explicit selector, not containment.
- Terrain paint clones the project, runs `geographyTerrain` plus
  `paintGeographyRoute` (bridges/stairs/dirt), then `drawMapTileLayers`
  on the real World/private structure atlas. The live project is not
  mutated. Unsupported materials reject.
- Opening a child uses `setDatabaseActiveTab` then `patchSpatialSession`
  with an explicit breadcrumb. `setSpatialTab` is not used for drill-down
  because it clears Back state. `restoreGeographyParent` pops the session
  and restores the database tab. Unit tests prove session/database routing;
  they do not fabricate a places canvas. Parent still needs `spatialStage`
  Back to call `restoreGeographyParent`; `setDatabaseActiveTab` currently
  calls `setSpatialTab`.
- Placed child moves update occurrence x/y only through
  `findOccurrenceChildId` / `parentSlot`. Shared sources do not alias siblings.
- Invalid route/structure paint returns a typed preview error. Failed
  terrain (unsupported material, mountain primitive) has no map. Failed
  routes keep terrain only, never a partial bridge. Unknown errors still
  throw. Chromium proof loads `renderGeographyRaster` through Vite.

## Fixtures

`test/support/spatialGeographyRecipes.ts` remains the task10 contract
set. The six region recipes and two worlds are selectable in unit tests.
They are not the task18 catalog or task19 published samples.

## Proof

```sh
flock /home/main/z-project/rpg-zzu/.omo/ulw-execute/tile-to-world/validation.lock \
  npm test -- test/spatialGeographyActions.test.ts --maxWorkers=1 --no-file-parallelism
```

Integrated browser acceptance is pending parent stage wiring.

The small-village preset exposes saved exterior candidates, the exact count of 2+ storey facades
(including landmarks), clustering and reference dimensions in the settlement design studio.
Object inspectors author `exteriorStories` separately from actual interior spaces. Optional fields
preserve legacy designs. [Small-village contract](small-village-generation.md).

Settlement preset cards open their selected design through 「마을 설계서 편집」. The design studio
uses the full stage width instead of nesting its list/preview inside gallery and inspector rails;
「지역 목록으로」 restores the canonical region gallery. New settlement regions use the saved
reference size and a plaza entry derived from the shared pure plaza geometry.

## Completed map references (2026-09-13)

The regions gallery includes a read-only **완성 맵 사례** card for the authored
43×45 walled settlement (`walled-settlement-43x45`). It appears under defaults
and the settlement filter even in legacy projects. This is a reference catalog,
not a procedural `RegionDesign`, occurrence, or village generation preset.

- Catalog/lessons: `src/project/regionReferences.ts`.
- Frozen map and source tileset passage/priority/terrain:
  `src/project/regionReferences/walled-settlement.json`.
- Preview: `public/assets/region-references/walled-settlement.png`, captured from
  that map in the editor; `regionReferenceView.ts` renders the same asset in the
  card and stage. Inspector lists the actual authoring decisions and limitations.
- `SpatialGalleryCard.regionReferenceId` routes reference cards before generic
  geography rendering. Reference selection exposes no activation, mutation, or
  build actions; ordinary region design actions remain available on other cards.
- The source map remains in project `rpg-zzu-reference-houses-20260913-6890`.
  Its fixed reference copy was saved and reloaded from Supabase project
  `rpg-zzu-region-reference-walled-settlement-v1`; map and tileset metadata were
  compared with the bundled snapshot. The catalog is bundled so later AI sessions
  in other projects can find the example without access to the authoring session.
- This change adds one curated example, not a general “register current map” UI.
  To revise it, preserve a new remote snapshot, update raster/preview/lessons
  together, bump the catalog revision, and verify the row reconstruction test.

Verification: `test/regionReferences.test.ts`; browser evidence and remote receipt
are under `docs/evidence/region-reference/`. Runtime behavior is unchanged; the
example currently contains no interior connections or interactive well event.

### Castle town reference (2026-09-13)

`castle-town-100x100` adds the user-finalized 100×100 castle city alongside
the original settlement. The source is `rpg-zzu-castle-town-100-20260913-6890`;
its frozen Supabase copy is `rpg-zzu-region-reference-castle-town-v1`.
`src/project/regionReferences/castle-town.json` and
`public/assets/region-references/castle-town.png` are derived from that reloaded
copy, including the user's road, entrance, garden and roof edits. AI paginated
reads select the snapshot by reference ID; the two references must never share
the same raster implicitly. `test/regionReferences.test.ts` reconstructs both
rasters and verifies their own passage metadata and gallery discovery.
This is an exterior reference, without palace floor interiors; runtime evidence
from before the user's last edits is not a validation of this frozen revision.

### Lake village and extracted places (2026-09-13)

`lake-village-60x60` is the accepted mixed-tree lake village, frozen from
`rpg-zzu-lake-village-60-20260913-6890` into Supabase project
`rpg-zzu-region-reference-lake-village-v1`. Its reloaded map and tileset are
bundled as `regionReferences/lake-village.json`; preview is captured from the
frozen project. Source content is left untouched.

`PLACE_REFERENCES` exposes three read-only crops in the Places gallery:
`lake-pier-workyard`, `lake-well-rest`, and `lake-cottage-garden`. These are
completed placement examples, not facility generation presets. Crops retain
source map coordinates in catalog metadata, return local-sized paginated raster
rows through `read_region_reference`, and use the same frozen tileset metadata.
The tool list and AI reference context expose both region and place references.
Place stage/chrome route references before ordinary facility selection; activation,
apply and build controls remain absent. The lake snapshot holds the remote
source for all three crops; no independent mutable crop projects are created.

Validation: `test/regionReferences.test.ts` checks lake raster, exact crop rows,
place gallery discovery, preview routing and absence of apply. Browser proof:
`output/evidence/region-reference/*-gallery.png`, `lake-regions-desktop.png`;
remote reload receipt: `lake-persistence.json` in the same directory.

### 석교 공간 저작 자료 (2026-09-15)

`docs/authored/stonebridge/`에는 원격 프로젝트
`rpg-zzu-castle-canal-reference-20260913-6890`에서 재로드한 최종 맵·칩셋과
`seokgyo-*` 오브젝트 25개, 공간 8개, 장소 5개의 선택적 스냅샷이 있다.
이는 해당 프로젝트의 실제 canonical library이며 전역 기본 설계 자동 설치가 아니다.
성곽 외부 계단 금지, 연속된 3층 외벽, 본관 6칸·양익 4칸 평지붕 규칙 및
컴파일·통행 검증 범위는 동 디렉터리 README와 receipt를 참조한다.

## 기존 완성 맵을 지역에 연결

`regionMapLinks.ts`는 지역 루트 occurrence의 **단일 projection binding**이 실제 맵 전체
범위를 가리키는 경우에만 연결된 완성 맵으로 판정한다. 이름이나 provenance에서 map ID를
추측하지 않는다. 라이브러리 카드에는 같은 revision의 유일한 배치만 연결하고, 여러 배치가
있으면 각 「배치된 곳」 카드에서 선택한다. 부분 범위·owned binding은 기존 편집 경로를 유지한다.

`spatialCatalogHierarchy.ts`가 카드에 `regionMapId`를 제공하면 지역 탭은 생성 미리보기 대신
`regionMapView.ts`에서 실제 저장 맵을 공통 `drawMapTileLayers`로 그린다. 「맵 열기」는 현재 맵과
카메라를 이동하고 DB 모달의 정상 닫기 경로를 사용한다. 연결된 카드는 복합 설계 작업실이나
재생성 액션으로 보내지 않는다. projection은 타일/이벤트 삭제 권한이나 생성 템플릿이 아니다.

검증: `test/spatialRegionMapLinks.test.ts` (IO 보존·중복 배치·revision 불일치·부분 범위/삭제 맵),
`test/spatialCatalog.test.ts`; 실제 저장 프로젝트 UI는 `scripts/qa/emerald-region-editor.mjs --saved`.


## Shared forest regions and village trails (2026-09-21)

Three fixed, project-independent region snapshots are registered in
`src/project/regionReferences.ts`: `gubisup-80x72` (terrain),
`small-forest-village-80x72` and `forest-cliff-village-80x72` (settlements).
The original forest and small village remain frozen; the cliff village is a
separate source map, not an overwrite of the earlier shared reference.

The region inspector offers a portable `.oprn.json` download containing its
map, tileset, binary-alpha atlas, autotile metadata and collision. Its filename
uses the selected region name. Preview frames explicitly constrain images to
the panel; do not reintroduce unstyled class names that let a native-size image
overflow the inspector. Shared region cards respect `regionKind` in filtering.

The cliff village has five houses, 4–5 tile high cliffs, a spring, and two narrow
forest trails. Trails clear the canopy envelope, rebuild complete southern
trunk end caps from the accepted 2-column/3-row grammar, then paint the native
road autotile. Small roadside clusters avoid house fronts and stairs. The
snapshot has 2,796 canopy cells; dark canopy interiors are intentional. All
1,950 walkable cells and the five door approaches connect. Autotile checks use
`connectTileIds` (roads also join stairs), not just `memberTileIds`.

Source project: `oprn-hill-forest-harmony-20260918-a4e1`.
Frozen project: `oprn-region-forest-cliff-village-v1`.
Local editor flush/reload and Supabase compare-and-swap/reload receipts are in
`.omo/evidence/forest-village-trails`. No unrelated map or asset was changed by
the trail pass. The shipped region atlas contains the 11 reviewed unfake props;
PNG outputs, metrics and the Astra review are in
`public/assets/generated/forest-harmony/village-unfake-v1`. The rejected village
clay oven is excluded. This does not ban unrelated indoor oven/cauldron assets.

These are exterior layout references, not playable adventures: house interiors,
NPC events, inter-map transfers, flowing water and waterfall animation are not
implemented by these snapshots. Keep snapshot revisions immutable.

## 승인된 강변 숲마을 공용 지역 (2026-09-21)

`REGION_REFERENCES`의 `river-forest-village-78x44` / **강변 숲마을**은
프로젝트와 무관한 「지역 → 기본 설계」 항목이다. 장소 카탈로그로 옮기지 않는다.
기존 세 지역의 순서(특히 호수마을 부분 사례가 참조하는 2번 인덱스)를 유지하며 뒤에 추가한다.

사용자가 승인한 `original-grove-trunks-20260921-76a3-1789965905810`을 재조회해
`oprn-region-river-forest-village-v1`에 불변 스냅샷으로 저장했다. 타일을 재생성하거나
수정하지 않는다. 원래 굽이숲 몸통·뿌리, 굽은 경계, 강·다리·집 8채·생활 소품을 보존한다.
다운로드에는 외부 마을과 연결된 실내 9개, 출입·주민 이벤트, 칩셋과 graft를 모두 포함한다.
지역 행 조회는 `regionReferences/river-forest-village.json`, 미리보기·다운로드·합성된
칩셋 미리보기는 `public/assets/region-references/river-forest-village*`가 제공한다.

발행: `scripts/content/publish-river-forest-region.mjs` (기존 v1 덮어쓰기 금지).
브라우저 관측: `scripts/qa/capture-shared-river-forest-region.mjs`.
저장 재조회·실제 지역 카드·다운로드·전체 행 조회 근거:
`reports/2026-09-21-shared-river-forest-region.md`.
