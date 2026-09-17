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
