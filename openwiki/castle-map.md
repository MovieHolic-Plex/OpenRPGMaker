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
