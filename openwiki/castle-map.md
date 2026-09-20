# Castle map harness (성채)

Gold reference: remote project map `map_castle_keep` (“성채”), hand-authored layout observed 2026-07.

## Goal

Build outdoor castle maps from **three structure modules** plus path/courtyard rules—not freehand random stone tiles.

## Modules (Combined Town)

| Harness id | Tiles | Layer | Role |
|---|---|---|---|
| `harness-combined-town-castle-roof-deck` | **18,19,20 / 48,49,50 / 78,79,80 / 108,109,110** | lower solid | Battlement / roof deck rectangle |
| `harness-combined-town-castle-wall-face` | **21 / 51\* / 81** | lower solid | Curtain & keep face (vertical strip) |
| `harness-combined-town-castle-round-tower` | cap **24\|25** upper, neck **138\|139**, body **140\|141\***, windows **142\|143**, base **54\|55** upper | mixed | 2-wide courtyard landmark |
| (existing) `castle-windows` | 28 / 58 / 88 | upper stack | Optional wall windows |
| (existing) sand/dirt autotile | path | lower passable | Gate approach |

\* mid tiles stretch.

## Observed layout recipe (`map_castle_keep` 48×40)

1. **Grass base** everywhere (passable courtyard).
2. **Outer roof deck** — north battlement band (~y4–5) spanning the keep width; also roof slabs over NW/NE corner masses and the **south curtain top** (~y26–28).
3. **Wall face under decks**
   - North/keep faces: columns **21 → 51\* → 81** (height 2–3).
   - South curtain: often **51\* → 81** under the south roof edge (roof replaces “top” row).
4. **South gate gap** — leave **x≈22–25** open through the south curtain; paint **sand** strip north into courtyard and south as approach road.
5. **Courtyard** — keep **grass only** inside the walls. Do **not** fill the yard with roof tiles (they are solid and block NPCs).
6. **Round tower** — 2-wide landmark in the courtyard (gold at **(18–19, 18–24)**):
   - y cap: upper 24\|25 over grass
   - y neck: lower 138\|139
   - y body: 140\|141 (repeat)
   - y window: **142\|143** (one row in the body)
   - y base: upper 54\|55 over grass
7. **Keep (본채)** — northern roof rectangle + wall face on its south edge; optional props on wall feet.

## Do / don’t

- **Do** assemble from modules; stretch only mid tiles (19, 109, 51, 140\|141, roof fills 49/79/50/80).
- **Do** cut a gate before painting the south wall closed.
- **Don’t** put roof-deck tiles in the walkable courtyard.
- **Don’t** treat round-tower body as upper; only cap/base are upper (transparent).
- **Don’t** confuse house stone walls (246+) with this castle set—the gold map uses **18–110 + 21/51/81 + 138–143** only for structure.

## Build tool

- **`build_castle`** (`src/editor/tools/castleBuilder.ts` + `src/editor/castleKit.ts`)
  - Deterministic stamp: roof perimeter frame → keep roof+wall face → south curtain with gate gap → round tower → sand approach (`paint_road`) → optional gate/lord NPCs.
  - Args: `mapId?` / new map `name|id|width|height`, `bounds?`, `wallHeight`, `gateWidth`, `roundTower`, `roundTowerHeight`, `path`, `npcs`, `seed`.
  - Min area **28×24**, default **48×40**. Example: `{ name: "성채2", id: "map_castle_keep_2", seed: 20260710 }`.
  - Gold hand map remains `map_castle_keep`; tool-built sibling: `map_castle_keep_2` (성채2).

## Code owners

- Vision labels / solid / confirmed: `src/project/defaults/chipsetMapping.ts`
- Harness groups: `src/project/tilesetHarness/combinedTownGroups.ts`
- Harness apply + prompt recipe: `src/project/tilesetHarness/combinedTown.ts`
- Stamp: `src/editor/castleKit.ts`, tool: `src/editor/tools/castleBuilder.ts`
- Observe gold: `scripts/observe-castle-keep.mts`
- Build 성채2: `scripts/build-castle-2.mts`
- Older procedural painter (not gold): `scripts/build-castle-map.mts`

## Validation

- Labels: tiles 18–21, 48–51, 54–55, 78–81, 108–110, 138–143 show Korean names via `tileDisplayLabelForIndex`.
- Harness: Combined Town tileset includes the three `castle-*` groups after `ensureTilesetHarnesses`.
- Map smoke: courtyard grass passable; walls/roofs solid; path through gate; round tower 2-wide grammar.

## Screenshot reference is not tile-assembly evidence (2026-09-19)

`map_castle_reference_20260919` and `map_castle_reference_95_20260919` use
`opengameart_castle_reference`: the supplied screenshot cut into 16px cells.
The image is 2239×2235; extending the right edge by 1px and bottom by 5px
makes a 2240×2240 sheet. A 100% comparison with that same screenshot only
proves this reconstruction, **not** correct use of the original Castle2 atlas.
Do not use it as a successful map-authoring or tile-learning benchmark.

`map_castle_reference_saved_20260919` is the separately saved copy requested
by the user. Preserve it and the reference maps. The old 80×64 prototype
`map_castle_editable_20260919` contains incorrect isolated fragments; it is
not a construction reference either.

## Second castle: assembled courtyard map (2026-09-19 correction)

`map_castle_keep_3` is now **성채 · 쌍문 안뜰성**, 128×120 cells. Its castle uses
the original 512×512 PNG; the harbor follow-up extends that atlas (below).
The rejected 96×72 block
layout has been replaced. Composition: four capped corner towers, continuous
side walks, short masonry facades beneath roof decks, north/south gatehouses,
a central hall, fountain court, west market, east clock-tree garden, and an
east bridge that reaches the opposite bank. The exterior ring is split into a
north gate approach, west market lane, east moat-bank landing, and south rest
plaza so the castle has circulation spaces instead of an unstructured grass
margin. These are editable tile arrays; there is no reference screenshot
texture in this map.

### Harbor and nature follow-up (2026-09-20)

The example screenshot combines several packs. Boats/docks/sacks are Daniel
Eddeland's `farming_fishing.png`, **not Castle2 tiles**. Vegetation/rocks come
from Hyptosis batches 1 and 3. The source pages are linked in
`public/assets/castle-surroundings/CREDITS.txt`; the combined atlas is CC-BY-SA
3.0, and web exports using it include that credit notice.

`scripts/pack-castle-surroundings.py` packs 17 measured objects into a 512×944
atlas. Indices 0–1023 are byte-identical Castle2 pixels. The large tree is
assembled from separate crown/trunk/root modules, overlapping at the crown;
copying their whole bounding box picks up a wall/path and an atlas separator.
`manifest.json` records rectangles, source hashes and the tree assembly.

`scripts/lib/castle-surroundings.mts` installs project-owned uploaded tileset
`castle_courtyard_harbor` with its PNG embedded in the saved project, plus 17
reusable complete-object stamps. It dresses only `map_castle_keep_3`: two
opposed rowboats, cargo and fishing docks, sacks/firewood, vegetable crates,
corn/tomato beds, trees/shrubs, rocks, bank grasses, falls and wall vines.
Transparent overlays retain their underlying terrain. Saved reference maps
and the globally bundled `opengameart_castle` definition remain separate.

### NPC and activity pass

`scripts/lib/castle-life.mts` adds nine fixed action events to the same map:
seven named people (harbor master, sailor, vendor, customer, garden keeper,
south-gate guard, traveler) plus a harbor cat and garden dog. Their graphics
use the bundled people and animal charsets, and each has a short interaction
line. The events are grouped into harbor, market, garden and south-gate life
zones so the player sees activity beside the boats, stalls, clock tree and gate.
The canonical save was reloaded after this pass; the player QA capture confirms
the sprites render on top of the authored tiles.

Browser evidence must show painted pixels, not just `pageErrors: []`: a
captured empty canvas is a failure even when the application catches errors.

Code:
- `scripts/lib/castle-courtyard.mts`: actual assembly and complete prop rectangles.
- `scripts/build-second-castle.mts`: preview by default; `--apply` publishes with
  expected SHA, syncs spatial mirrors, reloads, checks exact map equality, and
  confirms every other map (including saved reference copies) is unchanged.
- `scripts/render-castle-map.py`: independently renders original atlas indices;
  rejects screenshot tilesets, invalid indices and unbacked transparent pixels.
- `scripts/capture-courtyard-castle.mjs`: opens the exported/reloaded project in
  the real editor and captures the complete map at 1x. Browser injection is
  only for viewing; the publication script owns real Supabase persistence.

### Measured Castle2 assembly rules

Coordinates below are **16px atlas cells**, not 32px source-tile numbers.

| Part | Source rectangle `(x,y,w,h)` | Assembly constraint |
|---|---|---|
| Seamless grass | `(0,22,2,2)` | 32px source tile 176; 193/194 include dirt edges and stripe when repeated |
| Roof deck | `(12,0,8,6)` | Retain 2-cell edges; repeat only the 2-cell center; preserve transparency under merlons |
| Paved terrace | `(12,20,6,6)` | Nine-slice, not repeated corner tile 198 |
| Wall | x=0..1, y=6 / 8..9 / 10 | Top course once, middle courses, foundation once; never fill the whole frontage with tile 48 |
| Main arch | `(6,6,6,6)` | All six rows/columns; dark entrance backing x=28..29, y=14..17 under the transparent opening |
| Small door | `(4,7,2,4)` | Full arch plus threshold, not source tile 66 alone |
| Blue banner | `(14,14,2,5)` | Hanger, cloth and bottom tips are one object |
| Fountain | `(18,24,4,4)` | Preserve complete basin |
| Clock tree | `(24,20,6,8)` | Exclude local x=4..5/y=0..1: those cells belong to the neighbouring bench |
| Statue | `(22,27,2,5)` | Head, body and plinth; source 235 alone is only the middle |
| Bench | `(28,19,4,3)` | Complete back, seat and feet |
| Market stall | `(0,18,4,4)` | Awning **and** counter below |
| Lamp | `(31,22,1,6)` | Head through base |
| Well | `(28,28,4,4)` | Entire winch and stone ring |

32px source 208 is shoreline, **not crops**; 188 is part of the clock tree;
215/216 are bench parts, **not a dock**; 233 is a decorated container, **not a
boat**. The earlier `castle-ref-*` prototype kits and `castle-reference:`
spatial catalog contain those misidentifications. Do not treat their names
or `confidence: high` metadata as verified. This new map uses the measured
rectangles above directly. No player/runtime claim is made by editor captures.

## GPL reference bridge removal (2026-09-21)

At the user's request, the reference composite's lower-right Irukard bridge
was removed from the bundled atlas. Cells `(102,107,30,28)` were replaced with
existing water cells `(110,96,2,2)`; both parapets, deck, arch and piers are gone.
Outside pixels are unchanged. The old 100% comparison results above describe
historical evidence, not this edited image. Updated credits retain the other
CC BY/CC BY-SA authors and identify the modification.

`scripts/remove-castle-reference-bridge.mjs` previews remapped copies of all
three reference boards and `--apply` uses the existing revision-checked legacy
publication RPC. On 2026-09-21 that RPC repeatedly returned PostgreSQL 57014
(statement timeout), so remote persistence is NOT complete. The pending project
and local pixel proof are in `/tmp/castle-bridge-removal/`. The hosted SQLite
workspace and its four child projects were inspected read-only; none contained
these castle maps. No unrelated SQLite project was changed or overwritten.
The separately authored courtyard castle and its NPCs are unchanged.

## Reusable original-atlas study (2026-09-21)

`src/project/defaults/castleMeasuredParts.ts` is the shared coordinate catalog:
14 measured terrain/complete-object rectangles. `castleStructureKits.ts` now
builds `castle-measured-*` kits from this catalog, replacing the misleading
prototype names in **new default tilesets**. Existing persisted kits are not
silently migrated. Unknown pixels are labelled “미분류 · 조립 전 확인”.

Corrected collision: all 36 paving cells `(12,20,6,6)` are lower/passable.
Previously they were solid, making apparently paved NPC approaches unusable.
Roofs, wall faces and props remain solid; transparent pixels alone do not imply
walkability. Empty upper cells defer to their lower substrate. Drawing a gate
is not authoring a usable entrance: the study deliberately keeps its gate shut.

Reproduction:
- `node_modules/.bin/vite-node scripts/build-castle-study.mts` writes the 48×40
  “시계나무 성관” project and measured placement/route evidence to
  `output/castle-study/`. It uses only original Castle2 pixels, not screenshot
  reconstruction, surrounding packs or the removed reference bridge.
- Roof/paving stretch keeps the 2-cell outer border once and repeats the inner
  2×2 texture. Complete props are stamped intact; the clock-tree rectangle
  excludes its neighbour's bench. The eastern bank is straight; this does not
  establish a grammar for concave banks, stairs or multilevel navigation.
- The builder searches paths using engine `canMove`, excluding NPC-occupied
  cells. Three routes total 64 steps: spawn → merchant → garden visitor → gate.
- `scripts/capture-castle-study.mjs` opens the **SQLite re-export** in the
  dedicated `player.html` harness. It walks those routes without teleporting,
  interacts with both NPCs and checks a sustained upward input cannot enter
  the closed gate. Review `output/castle-study/runtime/SUMMARY.md` first.

Saved as an independent SQLite project at
`/home/main/.local/share/oprn/castle-tile-study-20260921`, project ID
`337715d3-1e6f-497c-a23a-665b9b9d31a9`, revision 1. Re-exported maps and tileset
match the authored source. The atlas is an uploaded project asset so this
project does not depend on the editor bundle already containing Castle2.
This folder is separate from the hosted workspace; it is not automatically
selected in the currently open editor. Existing user projects were untouched.

To also satisfy this repository's legacy remote-content requirement, the small
project was saved/reloaded unchanged under Supabase ID
`castle-tile-study-20260921`. SQLite is the working copy; this remote copy does
not switch the application back to Supabase. Evidence: `save-proof.json` in
`output/castle-study/`. No general test suite or typecheck was run.

This is evidence for these measured parts and routes, not mastery of all atlas
pixels or proof that the earlier large castle has correct passability.

## Grand river fortress city (2026-09-21)

User-requested large follow-up: `scripts/build-grand-castle.mts` authors
`grand-river-fortress` (160×144). The previous `castle-study` map and its original
tileset are copied unchanged into a separate project. The build does not touch
any older user project or the screenshot reference boards.

Nine districts: south gate/causeway, market, barracks, drill court, cargo harbor,
offset inner gate, royal fountain square, asymmetric keep/watchtower, clock-tree
garden. South/east/inner gates are actual gaps through fortifications; the keep
entrance remains closed. No interiors or boat travel are authored. Three boats,
two piers and six NPCs provide harbor/city activity without using the removed
GPL reference bridge.

Assembly details:
- Ground uses a 2×2-cell terrain/paving mask. Adjacent roads merge into one
  paving surface, retaining rims only at the union boundary.
- Measured Castle2 roof/facade/door/prop rectangles and the existing credited
  harbor/nature atlas are used. No screenshot pixels or generated art.
- Overlapping transparent props use `upperTileStacks`; replacing upper cells
  outright would erase the masonry behind a tree or banner. Gate construction
  explicitly clears its own wall rectangle before adding the arch. The final
  project bakes unique upper-stack recipes into appended atlas cells because
  the currently hosted editor omits some stacked overlays. Original atlas
  indices stay intact; appended cells copy top-tile collision metadata. See
  `output/grand-castle/composite-recipes.json` for the exact reconstruction.
- Piers stretch their four inner source columns and retain end posts once.
  Only their two central plank rows are traversable. Their upper O flags
  override underlying water; edge cells, boats and open water remain solid.
  This override is confined to the project's harbor tileset.
- Engine-collision BFS excludes NPC cells and proves all six front positions
  reachable; nine authored route segments total 361 steps. The runtime adds
  one step to the pier edge and one step back to verify water blocking.

Persistence and opening:
- SQLite folder: `/home/main/.local/share/oprn/web-workspace/.oprn-projects/castle-fortress-city-20260921`
- SQLite project ID: `b4706a77-9a38-4dcc-a89d-36244da53967`
- Hosted editor: `http://mdc-server:9888/?hostProject=castle-fortress-city-20260921&map=grand-river-fortress`
- Legacy-required Supabase copy: `castle-fortress-city-20260921`; save/reload
  equality recorded in `output/grand-castle/save-proof.json`. Dock correction
  uses an expected-SHA-filtered update of this new row only.
- Atlas is embedded as an uploaded asset. Credits accompany the SQLite folder
  and `output/grand-castle/CREDITS.txt` (existing CC BY / CC BY-SA provenance).

Evidence tools: `scripts/capture-grand-castle.mjs` walks the SQLite re-export
through dedicated `player.html`, including five full NPC dialogues and the pier
edge. `scripts/capture-grand-castle-editor.mjs` opens the actual hosted SQLite
project, without injecting a fixture. `scripts/render-castle-map.py` renders
full tile placement separately; its PNG does not contain NPC sprites.
Read `output/grand-castle/runtime/SUMMARY.md` before individual runtime shots.
General gates/vitest/typecheck were not run.

## Visual-style rejection and reference study (2026-09-21)

The user explicitly rejected `grand-river-fortress` as very different in feel
from the supplied castle map. Its successful storage, movement and parts
assembly are NOT visual acceptance. Before authoring another castle, read
[성채 참고 맵의 구도·조립·생활감 학습](castle-reference-art-direction.md).
It records 16 paired observation regions, composition/material differences,
unknown asset correspondences and concrete review questions. Main corrections:
foreground/mid-lower keep mass, a large eastern river and actual relief, connected
courts/wings, brighter varied vegetation, and contextual asymmetric prop groups.
The comparison viewer is generated by `scripts/analyze-castle-reference.mjs`;
its image excerpts are study evidence, never a game tileset source.

## Reference revision and durable tile study (2026-09-21)

Current `grand-river-fortress` was revised after the rejection above.
Canonical next-agent entry: [`tiledata/castle-tiles-rpgs/README.md`](../tiledata/castle-tiles-rpgs/README.md).
It includes the original, rejected and revised layouts, 16-region analysis,
measured Castle2/harbor/new-part coordinates, assembly rules and remaining visual differences.
`scripts/revise-reference-castle.mts` reads a pre-revision project export and
replaces this map only, retaining `castle-study`. SQLite revision8 and the
expected-SHA Supabase save both reloaded successfully; see tiledata persistence proof.
The current layout has a mid-lower keep, bare-tree rear courtyard, broad eastern
river and compact two-boat landing. Olive grass, simplified banks and sparse
vegetation still differ from the reference; do not call it a visual match.
Runtime evidence: `output/castle-reference-revision/runtime/SUMMARY.md`,
19 beats /0 failures; hosted editor evidence in the neighboring `editor/` directory.
