# Pixel Art World — user-imported static XP autotiles

Canonical metadata: `autotiles.json`. Run
`node scripts/content/prepare-pixel-art-world-autotiles.mjs` to generate
`src/assets/pixelArtWorldAutotiles.json`. The generator never fetches or bundles art.
Only exact SHA-256 bytes and decoded 96×128 dimensions qualify for the learned rules.
Original images and generated evidence remain outside git; all project reference images
are generated from the PNG supplied by that project's user.

Author sources checked 2026-09-24:
- [Indoor autotiles](https://yms.main.jp/dotartworld/page3/autotiles02.html): Wall A01/A02/D01.
- [Outdoor autotiles](https://yms.main.jp/dotartworld/page3/autotiles01.html): AsphaltRoad01, Concrete01, Roof01.
- [Library](https://yms.main.jp/dotartworld/page2/tile-library01.html): the wall autotile describes the empty/ceiling region, not the front-facing wall.
- [Terms](https://yms.main.jp/dotartworld/page1/rule.html): modifying is allowed, source/modified-material redistribution is prohibited; distributed games credit Pixel Art World / ドット絵世界.

## Coordinates and placement

The source is six columns by eight rows of **16px quarters**, producing **32px tiles**.
It is not an ordinary twelve-tile sheet. `xpAutotileQuarters(mask)` is the machine contract.

For NW/NE/SW/SE destination quarters use dx=(0,16,0,16), dy=(0,0,16,16):
- Isolated (no cardinal neighbors): source (dx,dy), the source's dedicated top-left tile.
- Both incident cardinal neighbors connect, diagonal missing: source (64+dx,dy).
- Otherwise source x=(horizontal connected ? 32+dx : right ? 80 : 0),
  y=(vertical connected ? 64+dy : bottom ? 112 : 32).
- Copy 16×16 exactly, preserving source alpha; do not scale, mirror, rotate or color-key.

Masks use engine N=1,E=2,S=4,W=8,NE=16,SE=32,SW=64,NW=128. A diagonal only matters
when its two incident cardinal neighbors connect. This yields 47 canonical masks,
including convex/concave corners, isolated cell, straight single-width runs and their
caps, L/T/cross junctions. Map boundaries are disconnected.

## Import and runtime contract

Import to an existing uploaded custom 32px atlas without grafts, transparent-color
processing or shared references. The UI offers eligible targets; metadata appends after
a full atlas row. Previous pixel slots and IDs do not move. New variants use a complete
256-key `AutotileGroup` with `neighborhood:8`, tile metadata and a searchable tile group.
Rows are padded with blocked, unclassified empty slots outside group membership.

The existing editor lower-layer shaper picks the baked variant. Editor and player render
ordinary uploaded 32px frames; no XP-specific runtime renderer is required. All three
walls and Roof01 are lower/solid; asphalt/concrete are lower/passable. Source opacity,
layer and collision are independent. Front walls, doors, characters, transitions and
building height still need their own tiles/events. Roof02's author example uses an upper
layer, so it is deliberately **not** in this lower-only live-shaping catalog.

Prepare all pixels, metadata and three MD/three actual PNG reference attachments before
one snapshot/store mutation. Abort on modal close, project/target switch, concurrent
changes to the target definition or its base asset. An already-written but unreferenced
content-addressed asset is left to normal repository cleanup. Duplicate imports into the
same target are refused. Previous resources remain because other tilesets may share them.

## Reference evidence and limits

Each imported category includes source pixels, the 47-variant atlas, and a 32px normal/error
comparison. The full specimen lower/upper arrays and dictionary list every 16px source
rectangle, destination quarter and absolute project tile ID. Mutations demonstrate an
incorrect outer corner, a removed thin-run cell and a lower-to-upper mistake.
`validateXpAutotileExample` checks that fixed specimen's arrays/shape, not an arbitrary
room's aesthetics, pathfinding, event execution or AI success rate.

Developer observation (isolated browser fixture, no canonical project write): all six exact sources
were prepared in the browser and their definitions accepted by the normal tileset validator
after JSON serialization. Actual compositions, A01 hash rejection and catalog surface were observed. Evidence is gitignored under
`output/paw-autotiles/`. No test/gate/typecheck command was run. A project save/reload is
still required before claiming a particular user's game content is installed.
