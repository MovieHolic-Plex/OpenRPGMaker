# Emerald inspired native monster atlases

Seven **original coordinate-authored** derivatives of OPRN monster-kit. Original atlases remain available. No Emerald/pret game pixels are included, and no global bitmap color filter is used. This implements a coherent art direction inspired by the GBA field grammar; it is not a copy of Emerald maps or Gen3 mechanics.

## Source and repeatable publication

- Native functions: `src/harnesses/tileset-authoring/recipes/emerald_monster.py`.
- Explicit material ramps: `harness-data/tileset-authoring/emerald-monster-*/seed.json` (inherits corresponding original native seed recursively).
- Current project-owned assembly source: `source-references.json`, exported read-only from the October 4 canonical project. Contains all seven complete dictionary/kit/example documents, exact arrays, and static reference image pointers. New grammar introductions are the seven `assembly-*.md` files.
- Regenerate: `python3 scripts/content/prepare-emerald-monster.py`. Uses native source enumeration before drawing changes, not a pixel filter. Writes only public assets, generated reference/index JSON and the local preservation manifest. It does not access a database.
- Focused data check: `npx tsx scripts/qa/emerald-tile-preservation.mts`. Checks exact structural definitions, PNG bounds, asset/frame registration, both new/existing project registration, author category preservation and deliberate empty references. This is not a game runtime or full project gate.

## Stable geometry

`emerald_monster_{overworld,wild,coast,climate,rooms,dungeon,gyms}` use `tex_` followed by the ID. All are 16px/16 columns. Counts: 2192/2048/2528/2560/1136/1920/2144. Definitions deep-clone corresponding `createMonsterKitTileset` values; passability, priorities, terrain, home-layer metadata, groups, animation slots, structure kits, ledges and slide rules are unchanged.

Ship bow frame slots are reserved by the original native enumeration even when calm ripples make a water sliver visually constant. Samples are rendered from exact current full lower/upper arrays. The inherited error reference images retain original colors and explicitly say so: their purpose is unchanged structural collision diagnosis. No new runtime/canonical persistence verification is claimed.

## Palette and shape choices

Quiet mint meadow patches, broad leaf clusters and common top-left shade direction; four phases of short horizontal water ripples; wider staggered roof courses and slim ridge with distant/front planes. Snow, sand, ash, lava, blue-gray labs and four league themes retain their own materials. Pool tiles keep submerged north/west walls; sea/river banks, forest overlap, upper caps, lower trunks, ledges and stairs retain original geometry. Native source seed selection is fixed rather than comparing the new ramps against Scarloxy pixel colors.

## Limits

Existing native FRLG/RSE mixed assembly grammar and original campaign gym designs remain. Some gray/league furniture and snow/volcanic details reuse existing native drawings. Error pairs are inherited structural diagnostics, not newly authored gameplay scenarios. Exact events/doors/runtime play and canonical save/reload belong to integration QA.

Original OPRN coordinate recipes remain governed by the repository license. Existing Scarloxy study reference assets retain their own CC BY 4.0 attribution; their pixels are not cut into these new atlases. Do not distribute cached pret reference maps/pixels.
