# Monster artwork review

Current review: `candidates-v4/`,120 final CLI PNGs for the existing60 species.
Status: **installed as an optional editor pack (2026-11-22)**. The owner asked to put
them to use ("에메랄드 몬스터는 좀 알아서 .. 넣고"). All 120 PNGs are copied to
`public/assets/emerald-monster/species-v4/` and registered as bundled monster resources
`emerald-v4-<species>-<front|back>` (`src/assets/emeraldSpeciesV4Art.ts`). Campaign species
keep the monster-collect-species bundle art (user pass, round 6, 2026-10-20); this pack does
not replace it. These files remain the review record.

- `candidates-v2/`: rejected initial review baseline.
- `candidates-v3/`: intermediate revision; superseded by revision4.
- `candidates-v4/`: current review,21 regenerated species and120 re-extracted
  front/back images;112×112 transparent containers, ink no larger than64px,
  no more than16 opaque colors. Front/back body sizes fit with a shared factor.
- `monster-generation.json`, `monster-revision3-generation.json`,
  `monster-revision4-generation.json`: exact built-in imagegen prompts, sources
  and refinement history. Artwork is original generated artwork, not ripped
  Pokemon game sprites. Raw source variants are preserved under `source/`.

Pack extraction scripts use the existing species harness pixel pipeline. Native
cleanup and CLI `import --block 8` run in an isolated review sandbox. The source
atlas's real transparent gutters define crop boundaries. Current final sandbox:
`/home/main/z-project/emerald-art-v4-final-review-20261004`.

`index.json` hashes final PNG bytes; `rawSha256` is the harness's raw-input hash.
`pair-provenance.json` records source, crop boundaries, grid, fit and bounds.
The final CLI cleanup changes some draft pixels; the review displays final output.
No ledger picks or production monster writes were made.140 automatic warnings
remain visible in review; these are not a numerical quality grade.

After human selection, use the species harness pick/build path, register chosen
front/back and derived icons in the shared campaign pack, save through the actual
project host, reload media, then inspect the shipping player. Keep the existing
species IDs, moves/PP, EXP, evolutions, habitats and save namespace.
