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

Shared Supabase archive `oprn-shared-tibo-places-20260918`: removed 36 interior maps, their occurrences and source spaces, and the imported default interior place definitions; retained eleven exterior maps plus the blank start map and all 847 object definitions. Graph refresh/deletion releases ownership but deliberately retains map data, so the cleanup explicitly removes the approved orphaned interior maps and tree entries after graph operations. Saved with CAS and reloaded.

`public/places-mockup.html` is a standalone interaction mockup, not the production database panel. Primary hierarchy: tileset art style → outdoor/indoor/dungeon → purpose; Tibo is a compatible material extension within EasyRPG. Shared originals remain global; project placement creates copies. Mockup includes retained example previews, indoor empty state, search, purpose filter, detail pane, and create dialog, with no DB mutations. Live preview: `/places-mockup.html`.

Ship source archive `rpg-zzu-ship-20260913` was also CAS-saved/reloaded: three cabin maps/source spaces/snapshot children and their links removed, all four deck/harbor tile rasters preserved. Backup receipt remains historical evidence.

2026-09-18 mockup revision: art style remains the primary scope; category tabs now use 마을·도시 / 자연 / 건물·시설 / 던전·유적 / 이동수단. Independent environment filter uses 실외 / 건물 내부 / 지하 / 수중; purpose is a separate filter. Creation inherits category/environment and accepts comma-separated purpose tags. Custom categories can be added in mockup memory. No production panel or DB changes.


## 2026-09-18 — production place classification browser

`spatialPlaceClassification.ts` owns the independent style/category/environment/purpose view. `spatialPlaceLibraryControls.ts` supplies category tabs, searchable style/environment/purpose filters, and custom category creation in the actual Places gallery. Filtered-out selections are replaced with a visible card for preview; composition workspaces and instance editing continue using existing paths. `spatialPlaceLibrary.css` follows database theme colors and gives the card gallery 60% of the body.

New-place authoring records classification using existing persisted design tags: `그림체:`, `장소유형:`, `공간형태:`, `용도:`. Both standalone spaces and building containers retain the tags through the normal draft/save flow; no schema version change. User tags take precedence over compatibility inference for older designs. Metadata-less designs use underlying tileset, existing kind and conservative name hints, with unknowns exposed as 미분류. A new category is session-only until a design bearing that category is saved. Builtin catalogs remain shared; existing project-owned draft persistence is unchanged. Do not label project-owned drafts as globally published.

Category and environment are not generator shape enums: a dungeon can be outdoor; an underground facility can use the indoor structural generator. Browser evidence in `output/evidence/place-classification/` uses a read-only bridge; no project rows were modified for this UI change. Packaged builds were run; tests/gates/typecheck were not requested or run.
