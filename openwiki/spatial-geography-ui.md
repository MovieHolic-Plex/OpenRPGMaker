> 저장소 전환 안내(2026-09-21): 아래 옛 원격 DB·설정·명령은 과거 기록이다. 현재 저장·이관 지침은 [프로젝트 저장 전환](storage-retirement.md)과 AGENTS를 따른다.

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
database.ts binding.

## Regions gallery contract (2026-09-22)

The regions tab no longer seeds the six terrain-vocabulary dummies from
`REGION_CATALOG` (lake-country, deep-forest, harbor-coast, snow-frontier,
high-pass, ancient-ruins) as read-only "default" cards. They had no live
design, no linked map and no editable surface, so they only hid real
content. Default region cards are now only the completed-map references
from `REGION_REFERENCES` (읽기 전용 완성 맵 사례), followed by authored
`library.regions` designs and village-preset settlement recipes.

The tab shares the places-tab list-first layout. `spatialShell.ts` treats
`regions` like `places` for the gallery: purpose strip, region library
controls (`spatialRegionLibraryControls.ts` — style/origin/type/search
filters over `spatialRegionClassification.ts`), classification badges,
and a right stage that stays collapsed until 「속성」 is toggled. Region
reference cards render real map thumbnails through the place-card thumb
path (`spatialGallery.ts` routes `regionReferenceId` cards to
`renderPlaceCardThumb`). Empty-state copy points at 「추가」, 마을 설계서
and the default references. Editing an authored region still opens the
geography canvas/inspector; `REGION_CATALOG` itself remains as the
compiler/seed vocabulary for `buildSpatialCatalogLibrary` and tests.

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
  Its fixed reference copy was saved and reloaded from LegacyDb project
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
its frozen LegacyDb copy is `rpg-zzu-region-reference-castle-town-v1`.
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
`rpg-zzu-lake-village-60-20260913-6890` into LegacyDb project
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
Local editor flush/reload and LegacyDb compare-and-swap/reload receipts are in
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

과거 원격 발행 스크립트는 저장 전환에서 제거했다. 현재 참조 패키지는 보존하며, 새 로컬 프로젝트로 가져올 때는 `scripts/oprn-store.mjs import-json`을 사용한다 (기존 v1 덮어쓰기 금지).
브라우저 관측: `scripts/qa/capture-shared-river-forest-region.mjs`.
저장 재조회·실제 지역 카드·다운로드·전체 행 조회 근거:
`reports/2026-09-21-shared-river-forest-region.md`.

## 서로 다른 새 마을 3종 공용 지역 (2026-09-23)

이슬여울 원본을 변형하지 않고 별도 SQLite 프로젝트 `44d88b94-58eb-4dee-a11a-88737da7001b`에
솔바람 흩어진 산촌(80×64), 층바위 절벽마을(88×72), 갈대물굽이 포구(88×64)를 저장·재로드했다.
`diverseVillageReferences.ts`를 `REGION_REFERENCES` 끝에 추가하며 기존 네 인덱스는 유지한다.
`regionReferenceSnapshots.ts`의 전체 행 조회와 공용 PNG/다운로드가 같은 저장본을 가리킨다.
집 전체 부품·3행 숲 몸통은 재사용하되 지형·길·집 원점은 독립 설계다. 실내·NPC·문 전이는 없다.

지역 갤러리도 `is-library-only`로 속성을 접으므로, `spatial-shell-regions`의 「속성」 버튼은
장소와 마찬가지로 모든 폭에서 보여야 한다. 카드는 선택만 하고 속성은 사용자가 열도록 유지한다.
그 버튼을 숨기면 미리보기와 다운로드가 DOM에만 있고 접근할 수 없다.
읽기 전용 지역의 300px 속성 열에서는 그림/설명을 세로로 쌓는다. 공통 캔버스+280px 속성의
2열을 중첩하면 그림이 20px로 축소된다(`spatialPlaceLibrary.css`의 지역 참조 한정 규칙).
실제 카드·속성·다운로드·AI 행 일치 근거: `verify-shots/village-diversity/`.

공용 AI 자료는 forest_harmony가 소유하는 번들 `src/assets/sharedDiverseVillageReferences.json` (33 MD/22 이미지).
정확한 원본 좌표·레이어·전체 배열·반복 조립·오류 좌표는 `tiledata/forest-villages/diverse/`에 있다.
생성/배포 명령 및 정본 보존 계약은 그 디렉터리의 README를 따른다.


### 절벽 조립 교정 (2026-09-23)

‘큰 폭포 아래 마을’의 실제 상위 배열을 기준으로 세 마을을 revision2로 교정했다.
얇은 둘레 띠 대신 굽은 윗선·반복 면·같은 윤곽의 밑단을 사용하고 좌우 사선 원본231/232를 구분한다.
암벽은 upper, 계단은 lower+upper 비움이다. 높이에 맞춘 계단 양끝과 문앞 연결을 확인한다.
`src/project/defaults/forestHarmony.ts`는 `previous-reference.json`의 revision과 정확히 같은
미편집 v1만 교체한다. 사용자 수정본/공유 포인터는 보존하고 새 용도를 제공한다.
정확한 원본 배열과 픽셀 일치·8종 오류·SQLite 재로드 근거는
`tiledata/forest-villages/diverse/cliff-source.json`, `verify-shots/village-cliff-repair/`에 있다.

### 잔디 경계 개정3 (2026-09-23)

사용자 확정은 기존 바닥240 유지다. 504/505의 사선 및498/499/528/529/619의 잔디 픽셀만
그 바닥에 맞춘다. 기존 아틀라스를 덮어쓰지 않고 공용 `forest_harmony_grass_joins`
(16px·9열·9칸)을 추가했다. 생성기는 `prepare-forest-grass-joins.mjs`, 실제 치수는 bundled
기하와 defaultAssets 생성자가 공유한다. 새 프로젝트/기존 프로젝트에 등록하며 AI 문서는 forest_harmony를 공유한다.
사선은 lower+받침240, 모서리/암벽은 upper다. 상위 소품과 바닥 그림은 유지한다.
미편집 v1/v2 문서만 내용 revision 일치로 교체하고 편집본은 보존하면서 개정3을 추가한다.
세 지역 revision3, 10종 오류 예제 및 grass-backing 검사. 근거 `verify-shots/village-grass-joins/`.

### 굽은 지형·입구 개정4 (2026-09-23)

3개 공용 지역 revision4. 504–559–505를 완전한 /—\ 조립으로 만들고, 중간 충돌을 건너뛰지 않는다.
바닥240을 유지한 파생 시트는10열10칸으로 늘고, 기존9칸 정의는 저자 메타데이터를 보존하며9번559만 추가한다.
절벽의 골·돌출부와 계단 평탄부를 분리하고, 숲은 plateau 전체 제외를 없애 군집/빈터 밀도장을 적용한다.
맵 가장자리 폭3·깊이5 출입구를 도로에 연결해 모두 검사한다. 12종 오류에 마감 누락·막힌 맵 출입구가 포함된다.
공용 AI 자료는 v1/v2/v3 중 미편집 배포본만 교체하며 저자 편집본·공유 포인터는 보존한다.
연구의 적용 범위와 재현 수식은 `tiledata/forest-villages/diverse/research-layout.md`,
정본 revision10 저장/재로드 및 화면 증거는 `verify-shots/winding-villages/`.

### 생활 마당 개정5 (2026-09-23)

무작위 중앙 소품과 집 주변 산개를 제거했다. `village-household-props.mjs`는 집별 ownerId와
주거/텃밭/작업·보관/약초 묶음을 좌우 벽에서1칸 떨어진 마당에2–4개씩 배치한다.
큰 묶음→같은 용도의 좁은 묶음→배치 생략 순서이며 중앙으로 밀어내지 않는다.
완전한 묶음 접근 검증, 허수아비-채소밭 동반 조건, 마당 밖 소품 좌표 검사를 추가했다.
숲·절벽·개별 나무·길·집 배열은 그대로다. 지역 revision5 / 참고문서 v5,
33 MD·21 이미지·14종 오류. 정본 revision11 저장/재조회와 근거는 `verify-shots/household-props/`.

### 사용 목적 개정6 (2026-09-23)

‘집 옆’만으로 배치 목적을 대신하지 않는다. 집 순번 n%4의 묶음 교대를 제거했다.
prop-programs.json에 집별 role/activity/reason과 부품별 purpose/anchor/compact를 저작한다.
기존 밭 돌보기는 실제 밭, 어업 준비는 실제 부두, 목재/완제품 상자는 작업대에 연결한다.
검사에서 실제 기준 대상의 전체 타일과 거리, 소유자의 활동, 접근 가능성을 확인한다.
원형의 꽃 등 필요 없는 장식은 활동에 자동 동반하지 않는다. 활동을 바꾸는 fallback도 없다.
지역 revision6, 공용 문서 v6(33 MD/22이미지), 정본 revision12 저장/재조회.
좌표 검사15종과 활동/세탁/부두/기존 밭/작업대 변조5종의 근거: `verify-shots/prop-purpose/`.

### 공동 공간·정원 개정7 (2026-09-23)

집의 작업 소품 이외에 공동 급수·공지·길 안내·정원·환대·영역 구분을 명시한다.
`civic-programs.json`의 장소별 anchor/purpose/near를 `village-civic-props.mjs`가 완전한 부품으로 배치한다.
우물·실제 밭·부두·길·집과의 관계, 부품 사이 거리, 실제 기준 대상의 배열, 사용칸을 검사한다.
벽등만 빈 상위+하위 벽42..47을 허용하고 문 열 ±1을 피한다. 일반 소품 하위240은 유지한다.
산촌18·절벽18·포구24개 추가, 세 마을 전체25종 사용. 하위와 기존 상위 타일을 보존했다.
지역 revision7 / 공용 AI 용도 civic-v7(38 MD·25이미지·18종 오류), 정본 revision13 재오픈 전체 일치.
새/기존 프로젝트 공급과 저자 편집 보존·브라우저 근거는 `verify-shots/village-civic/` 및 `verify-shots/village-diversity/`.
이는 외관 저작이며 상점·우편·NPC 생활 이벤트·동적 조명은 추가하지 않았다.

### 계단 대지 개정8 (2026-09-23)

사용자 판정: 절벽에 높이가 없다. 원인은 모양이 아니라 **닫힘**이었다 — V자·톱니 끝을 돌아 윗단으로 걸어갈 수 있어
절벽이 둔덕이 아니라 들판의 홈으로 보였다. 참고(큰 폭포 아래 마을)는 절벽이 숲에서 숲까지 이어져 계단으로만 오른다.
- `author-diverse-villages.mjs`: 절벽 각 끝 바깥 4열을 숲 강제 칸 + 길 경로 차단(`cliffs[i].left/right:"open"`로 해제,
  `leftFrom/rightFrom`로 시작 행). 끝에서 「모든 계단을 막으면 윗단 칸에 닿지 않는다」를 단언한다.
- 검증기 `terrace-without-stairs`: 같은 판정을 열린 절벽 끝 좌표로 보고. 고장 예시는 솔바람 서쪽 끝 숲 제거(19종째).
- 윤곽: 솔바람 V자 둘→한 줄+계단3, 층바위 톱니→수평 굽이, 갈대물굽이 오른쪽 끝을 북쪽 숲까지 봉쇄+계단2.
- 문: 1×2 문 위 칸 359→329(같은 시트 바로 위 완전 검정). 문 이벤트 없이 출입구로 읽힌다. 23채.
- 소품: 기본 시트의 온전한 소품 8종을 `extra-parts.json`으로 civic 부품에 추가(벤치·술통·오크통·모닥불·이정표·장작·과일 좌판·3×2 노점).
  전망 쉼터·계단 길잡이·장터·불자리·선착장 짐터·땔감 21곳 46개. 지형이 옮겨 겹친 보존 나무는 자르지 않고 뺀다.
- 지역 revision8 / 공용 AI 용도 `diverse-villages-terrace-v8`(42 MD·26이미지·19종 오류), 정본 revision16 재오픈 전체 일치.
  미편집 civic-v7 은 `previous-reference.json` 기록으로 교체, 저자 편집본은 보존. 근거 `verify-shots/village-terrace/`.
- 후속 판정: 과일 바구니는 사과가 시트보다 큰 배율이라 제외(`extra-parts.json` oversized → 부품 목록에서 제거). 층바위 동굴 입구 삭제.

### 강과 폭포 개정9 (2026-09-23)

네 번째 지역 「두 폭포 강마을」(88×72). 북쪽 숲에서 나온 폭4 강이 한가운데를 흐르고, 숲에서 숲까지 이은 두 줄 절벽에서
폭포로 떨어져 소를 이룬 뒤 남쪽으로 빠진다. 단마다 다리 하나(3개), 절벽마다 양 강둑 계단(4개).
- 비취 대계곡(World 칩셋) 물·물가 = 숲마을 lake_47 과 같은 그림(RGB 비교; RGBA `getbbox` 는 알파만 봐서 거의 전부 「같음」으로 나온다 — 주의).
  폭포 World123·다리 World102/103 만 `tex_easyrpg_chipset_world` 에서 이식(`riverTiles`), 기존 102/103(통나무 벽) 재사용 금지.
- `author-diverse-villages.mjs`: `river{width,points,pools}` 가로 붓, 절벽 교차 열 → 윗선 물 + 면 폭포, 폭포 칸을 오토타일 이웃에 포함(둑 없음),
  맵 밖으로 나가는 강은 가장자리 둑 없음. `bridges` 는 2행, 양 끝 뭍 단언, 끝을 길에 연결, 길 칠하기에서 제외.
- 검증기 `waterfall-gap` 추가(20종). 폭포는 번들 칩셋에 애니메이션이 없어 정지 그림.
- 같은 개정: 과일 바구니는 사과 배율이 커서 부품 목록에서 제거, 층바위 동굴 삭제.
- 지역 revision9 / `diverse-villages-river-v9`(51 MD·28 이미지), 정본 revision18 재오픈 일치. 근거 `verify-shots/village-river/`.

### 컨셉 마을 3종 · 창문 개정10 (2026-09-23)

비취 대계곡 방식의 강·폭포 위에 마을마다 다른 랜드마크를 통째로 세운 지역 3개. 「지역」과 「장소」 두 곳에 모두 나온다(두 폭포 강마을도 장소에 추가).
- 종탑 언덕 교구마을(80×64): 윗단에 스테인드글라스 교회, 외곽에 울타리 친 묘지, 폭포 하나와 소.
- 여울성 나루(100×92): 맨 윗단에 작은 성(42×33) — 「왕궁이 있는 이중 성벽 도시」 내성을 x=49.5 축으로 대칭화하고 같은 열·행만 빼서 줄인 것.
  두 겹 성벽·보행로412·테두리18~20/78/80/108~110·벽면51/81·둥근 탑138~143·층층 궁. 첫 판(성벽 조각을 정면도처럼 쌓은 것)은 사용자 판정으로 폐기. 동쪽 강 폭포 둘, 다리 둘.
- 안개못 폐촌(80×64): 울타리 친 못과 섬 위 석상, 폐가 여섯(깨진 창88·벽 덩굴), 못지기 집 하나(덧문86), 외곽의 잊힌 묘지.
- 랜드마크: `tiledata/forest-villages/diverse/landmarks.json`. 건물(교회 7×9, 성 42×33)은 두 레이어 배열 통째, 마당(묘지·울타리 못)은 울타리 고리
  378/379/380·양옆408·438/439…409/410(호수마을 울타리 마당 조립) + 입구 공백 + 내용물. 영역이 하나라도 겹치면 저작 중단. 문앞·마당 입구는 길 뼈대에 연결되고 접근칸으로 검사.
- 창문 규칙: 집마다 한 종류(`houses[i][3]` = 85·86·87). 84 스테인드글라스는 교회, 88 깨진 창은 폐가 전용. 검사 `mixed-windows`, 랜드마크 막힘 `landmark-sealed`(22종).
- 칩셋 라벨: 84·86·88과 성 조각(윗면21·보행로412·테두리18~20/78/80/108~110·벽면51/81·탑138~143/24/25/54/55·궁 지붕49·정문448/478·안뜰248/276~338·화살 구멍28), 깃발179/209, 덩굴265/295가 원래 라벨·설명이 비어 있었다(이슬여울 집이 쓰던 85/87만 「창문」).
  `tile-labels.json` → 번들 `forestHarmonyTileset.json`과 저작 칩셋. 기존 프로젝트는 `ensureForestHarmonyReferences`가 비어 있는 라벨(또는 설명 없는 「창문」)만 채운다.
- 분류는 둘: `diverse-villages-trunks-v12`(52 MD·30 이미지) + `concept-villages-v3`(27 MD·3 이미지, 나무 몸통 개정). 한 분류당 문서 64개 한도(`REFERENCE_LIMITS`) 때문에 나눴다.
- 장소 카드는 `DIVERSE_VILLAGE_PLACES`(id `…-place-W×H`, `regionReferenceId`로 같은 스냅숏을 읽는다).
- 지역 revision10, 정본 revision20 재오픈 일치. 근거 `verify-shots/village-concept/`.
