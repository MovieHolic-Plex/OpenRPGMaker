# Pixel Art World — user-imported XP autotiles

`autotiles.json` is metadata only. Generate the app catalog with
`node scripts/content/prepare-pixel-art-world-autotiles.mjs`.
No source or derived artwork is bundled, downloaded by the importer, or committed.
User-supplied PNGs must match the exact SHA-256 and decoded dimensions.

## Scope and identity

The directly linked catalog contains **136 unique static 96×128 XP files** and
**4 unique animated 384×128 XP files**. These cover 175 direct URL rows: aliases
are recorded per SHA rather than imported again under different filenames.
The other 12 direct autotile files use VX/MV or mixed layouts and are **not** XP.
Existing six IDs, hashes, semantics, sorted 47-mask IDs and static atlas spacing remain stable.
A previously imported atlas is never rewritten or migrated by this expansion.

Primary sources checked 2026-09-24:

- [Outdoor XP](https://yms.main.jp/dotartworld/page3/autotiles01.html): terrain,
  roofs, water and the animated Ditch section. The author warns that complex
  Saku railing shapes can disconnect and that VX requires different source arrangements.
- [Indoor XP](https://yms.main.jp/dotartworld/page3/autotiles02.html): floors,
  carpets, curtains, wall/ceiling boundaries, platforms and doorway backdrops.
- [Library](https://yms.main.jp/dotartworld/page2/tile-library01.html): ceiling
  boundaries are distinct from front-facing walls.
- [Terms](https://yms.main.jp/dotartworld/page1/rule.html): source/modified-material
  redistribution is prohibited; distributed games credit Pixel Art World / ドット絵世界.
- [mkxp XP geometry](https://github.com/Ancurio/mkxp/blob/master/src/autotiles.cpp)
  and [frame rendering](https://github.com/Ancurio/mkxp/blob/master/src/tilemap.cpp):
  primary implementation used to cross-check quarter coordinates and horizontal 96px frames.
  Its code is not copied into the importer.

## Coordinates and compatibility

Each source frame is six columns × eight rows of **16px quarters**, producing
**32px tiles**. It is not an ordinary twelve-tile sheet. The new importer uses
`xpFullAutotileQuarters(mask)` (`quarterLayout: xp-full-edge-v1`).

For NW/NE/SW/SE quarters, dx=(0,16,0,16), dy=(0,0,16,16):

- Isolated: (dx,dy), the dedicated top-left preview tile.
- Both incident cardinal neighbors connect but the diagonal is absent:
  (64+dx,dy), the inner corner.
- Otherwise choose the full exterior 32px edge. For the left half:
  x=0 if west is absent, else 64 if east is absent, else 32.
  For the right half: x=80 if east is absent, else 16 if west is absent, else 48.
- For the top half: y=32 if north is absent, else 96 if south is absent, else 64.
  For the bottom half: y=112 if south is absent, else 48 if north is absent, else 80.
- Add `96 * temporalFrame` to source x. Copy 16×16 without scaling, mirroring,
  rotation or color-key changes. Preserve source alpha.

An edge can occupy **both halves** of a tile. Treating all edges as 16px strips
removes the upper half of Saku's south railing. That defect was observed in actual
source/composition PNGs during this expansion and corrected in the new resolver.
The historical `xpAutotileQuarters` helper is retained unchanged for already-authored
city/school generators; it is not the new importer contract. IDs stay stable even
when a newly imported atlas uses the corrected pixels. Existing saved pixels are untouched.

Masks: N=1,E=2,S=4,W=8,NE=16,SE=32,SW=64,NW=128. A diagonal matters only when
both adjacent cardinals connect. The sorted list has 47 masks. Boundaries are disconnected.
The isolated preview is intentionally used instead of reconstructing the outer four corners.

## Semantics and authoring

There are 98 lower autoshaping families (94 static plus four animated water families)
and 42 manual-mask families (39 upper, one lower platform and two lower stair runners). Geometry compatibility is
not a claim that every shape is artistically suitable for every material.

Each entry records `surface`, `role`, `passage`, `defaultLayer`, `underlay`,
`placement`, `shapePolicy`, source-alpha masks and restrictions explicitly.
`terrainTag:0` is neutral: no implicit poison, swim, encounter or height effect.
Walls/roofs, fences, furniture and water are blocked. Floors, paths, grass, rugs and
platforms are passable by default; authors can change game collision separately.

- Transparent terrain overlays preserve lower ground; opaque ground variants use lower.
- Curtains, windows and ivy require wall backing; Roof02 and Saku require roof backing.
- Doorway backdrops are not animated doors or working entrances; default collision is blocked.
- Base editing materials require composition over a chosen material, not standalone placement.
- Saku, curtains, door backgrounds, windows, kotatsu and the podium use rectangles only,
  minimum 2×2. Thin runs, holes and branches are not approved for those materials.
- Upper families and rectangle-only podiums have no automatic shaping group. Use the
  reference's 256-mask dictionary and complete arrays. Upper brush autoshaping is not implemented.

## Atlas and animation contract

Append to an uploaded custom 32px atlas with no grafts, transparent-color processing
or shared reference owner. Previous slots do not move. Align to the next row.
`xpAutotileAtlasLayout` keeps each temporal strip within one row, padding as needed.
Static layout remains `offset + maskIndex`. Animation needs at least four columns.

Ditch01–04 contain four horizontal 96×128 frames. Bake every mask in all four frames,
then register 47 `{baseTile,frames:4,fps:3}` `animationStrips`. `variantMap` selects the
base frame; all 188 frame slots belong to the same autotile family for neighbor detection.
The tile group lists 47 base tiles. Padding is blocked and outside group membership.
3fps is an editor default, **not an author-specified speed**. Ditch01 repeats its second
frame as its fourth; retain 0→1→2→3 rather than deduplicating it.
`registerUploadedTilesetFrames` and `uploadedTilesetAnimationName` are the existing
editor/player contract. No PAW-specific runtime renderer is added.

Preparation creates pixels, metadata and references before one snapshot/store mutation.
Project lineage, repository target, target definition and base-asset signatures guard
all asynchronous stages. Modal cancellation/concurrent changes abort registration.
A storage write already completed may leave an unreferenced asset for normal cleanup.
Duplicate pack/category imports into the same target are refused, including byte-identical aliases.
The normal 32-reference-category limit still applies per target; split large collections
across atlases instead of claiming all 140 fit a single target's reference limit.

## Generated reference material and evidence

Every imported family has three MD documents and three actual PNG attachments:
source, 47 variants for each frame, and normal/error comparison. Documents contain
all source-quarter rectangles, absolute destination IDs, all 256 masks, aliases,
full lower/upper sample arrays, wrong-corner/missing-cell/wrong-layer arrays and error coordinates.
Blob families demonstrate thin runs, isolated cells, holes and junctions. Rectangle-only
families demonstrate a rectangle rather than advertising unsupported silhouettes.

The optional fifth argument of `preparePixelArtWorldAutotile` is
`{ referenceBackingTile: number, referenceBackingLabel?: string }`.
`createPixelArtWorldAutotileReferences` takes the same options as its last argument,
after the base image/tileset pair. The selected ID must be an integer inside the
existing target atlas, resolve to lower through `tileLayerHome`, and contain only
opaque pixels. Invalid IDs, upper tiles and partially transparent tiles are rejected.
The same selected tile fills the complete sample lower array, normal/error PNGs and
MD descriptions; labels describe the choice without claiming gameplay suitability.

Without options, the first opaque lower tile remains a **diagnostic fallback**, not
an endorsed backing. If none exists, the sample remains incomplete. Mixed atlases
must choose per-family backing: Pool01/02 need deliberate basin material because their
centers have alpha152/102; wall decorations need native wall backing, and Roof02/Saku
need opaque roof backing. The category's default world floor is not sufficient.

GroundBase01 contains an opaque cyan editing area and transparent center. Its category,
read-first document and comparison explicitly say **editing template**, not completed
normal terrain. A ground underlay does not remove that placeholder. Keep it outside
finished demonstration scenes unless the intended template composition is separately
specified; do not recolor/erase source pixels implicitly.

`validateXpAutotilePlacementExample` compares exact sample arrays, not arbitrary scene
traversal, event execution, aesthetics or AI success rates.

Private observation artifacts: `output/paw-xp-expansion/`. All 140 exact local PNGs were
processed through the normal preparation/shape/reference validators. Native compositions
were viewed in four contact sheets. The four Ditch atlases were played with Phaser and the
shipped uploaded-atlas registration functions, observing all four frame IDs per strip.
7-column targets exercised row padding; layout records also include 4/5/8/13 columns.
No gates, tests, typecheck or canonical/shared DB writes were run. Installation into a
particular user's project still requires the supervisor's save/reload and player observation.

## Shared local installation

`xp-library-layout.json` partitions all 140 SHA identities into eight 16-column atlases.
Slots 0–8 are explicit opaque source backing crops; 9–15 are blocked padding.
`prepare-pixel-art-world-xp-library.mjs` uses the normal browser importer, then creates
139 compact 4×3 material assembly specimens with full arrays and actual PNGs.
GroundBase01 remains documented as an editing template and has no object stamp.
Carpet08ST/09ST are visually classified as directional stair runners, not closed rugs:
manual lower placement, rectangle only, open north/south ends connect to matching
Carpet08/09 landings. This is an inference from the artwork, not an author-stated use.

`publish-pixel-art-world-xp-library.mjs` checks the exact prepared library receipt,
losslessly compresses reference attachments and publishes `pixel-art-world-xp-local`
through the shared SQLite API with CAS/history/reload. It preserves other libraries.
`install-pixel-art-world-shared-host.mjs` copies the same definitions/assets to the
running canonical host with backup, CAS and reload; existing maps are unchanged.
Material specimens are objects, not completed places/regions. Actual spatial examples
using this expanded palette still need authored layouts, movement and visual review.
