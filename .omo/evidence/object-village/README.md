# First, spacious saved-object village (superseded composition)

This is the first saved 128×128 draft: **물빛 장터 마을 · 저장된 집 20종**,
map `map_lakeside_market_village_20260912` in Supabase project
`rpg-zzu-house-template-gallery`. It uses 20 distinct exterior objects, 21 doorway
approaches, 8 market displays and 1 lakeside access. All 30 destinations are reachable.

The user rejected its oversized, sparse composition. The map is preserved as an earlier
reference; the current compact result and final checks are in `../compact-village/`.
Do not present this draft as the final visual result.

- `build-proof.json` and `supabase-proof.json`: actual registered `author_village`
  tool execution, CAS save and same-process complete reload comparison. Existing 14 maps,
  30 house objects and spatial occurrences were preserved at that publication.
- `render/index.html`, `render/map-overview.png`: native editor rendering of that readback.
- `editor-proof.json`, `editor-saved-village.png`: normal Supabase-backed editor load.
- `runtime/SUMMARY.md`: shipping `player.html`, 8/8 beats, 41 actual movement steps and
  no runtime errors. Distant routes use teleports only for setup.

A later independent whole-project normalization comparison differed only in historical,
unrelated tileset priority defaults. It did not establish a whole-project comparison pass.
The current compact publisher records the canonical server SHA; its final independent
proof compares that revision and all authored maps, spatial content and village graphics.

Reproduction: `scripts/publish-object-village.mts --apply` originally published this
new map; it rejects an already saved map. Full project JSON remains untracked under
`output/evidence/object-village/`. No LLM provider was called in this tool verification.
