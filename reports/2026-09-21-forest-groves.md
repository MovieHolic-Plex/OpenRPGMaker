# Village groves use the winding cliff-village assembly

Forest Harmony village generation now builds connected dark canopies with the approved
three-row southern trunks from 「굽이숲 절벽마을」. General, compact, morphology and terrain
forest stages share one painter; individual yard/orchard trees retain their saved assemblies.

The painter uses a deterministic smooth field sampled in 2×3 blocks. It reserves the complete
root footprint before shaping the canopy, and removes unsupported protrusions before any
write. Roads, houses, yards, water reservations, protected cells, existing stacks and the
requested area remain placement constraints. Density controls the candidate coverage;
reserved space and complete-cap repairs can reduce the final amount.

47 approved reference canopy variants are appended through tile grafts under a separate
`forest_harmony_grove_47` group. Slots are allocated after both the current count and any
existing graft destination. Original pixels, locked metadata and authored autotile groups
remain unchanged. The original atlas and frozen reference maps are not modified. The source
reference atlas joins the bundled reference registry, including preload/export dependencies;
the DOM graft resolver now accepts registered reference sources as well.

`authorVillageScope` permits precisely this deterministic extension of the target tileset.
Forest metrics resolve canopy IDs from the actual group; continuous canopy area is reported
separately from complete individual 2×2 trees.

## Browser observations

`scripts/qa/capture-forest-groves.mjs`, Chromium against the worktree server, seed 7:

| Draft | Houses / reachable doors | Road components | Canopy cells |
| --- | --- | --- | --- |
| General 50×50 | 2 / 2 | 1 | 996 |
| Green + hills 74×52 | 4 / 4 | 1 | 432 |
| Compact 80×72 | 4 / 4 | 1 | 2,226 |
| Explicit combined-town 50×50 | 2 / 2 | 1 | 0 (legacy trees retained) |

All four authoring calls returned success with structural QA successful. Browser page errors: 0.
The actual graft bake was awaited before rendering (480×1392 for Forest Harmony). Original
terrain/priority/passability/metadata slots matched their baseline, and serialize→deserialize
preserved all maps and forest grafts.

Evidence: `.omo/evidence/forest-groves/{village,hills,compact}.png` and `observations.json`.
These are isolated in-memory code observations with REST writes disabled, not authored live
project content or Supabase-save evidence. No existing user map was changed.

`test/forestGroves.test.ts` records append-only/idempotence, complete roots, scoped writes,
through-route protection, collision and serialization contracts. Per repository session rules,
Vitest, gates and full typecheck were not run. Changed TypeScript syntax and `git diff --check`
were checked. No claim is made about the full regression suite or exported-player browser QA.
