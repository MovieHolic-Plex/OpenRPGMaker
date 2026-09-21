# River village implementation and live authoring — 2026-09-21

## Implemented

- `river` morphology: one connected north–south channel, bank roads, one two-tile-wide plank crossing, plots on both banks.
- Blank unbounded/new targets without an authored style default to river through the shared facade/assistant contract resolver.
- Explicit layouts, themes, presets, selection bounds and authored terrain take priority.
- River width uses project world-generation rules. Automatic map sizing budgets extra bank space; explicit sizes are preserved.
- River cells are reserved for plots, roads and vegetation, then painted after trees. Actual passability and water/bridge preservation are checked after decoration.
- Walkable combined-town plank 199 over water survives placement cleanup. Other water decoration remains invalid.

## Live evidence

Used the real `AUTHOR_VILLAGE_TOOL.run` in the Vite browser environment. This run did not invoke an LLM or replay a mock model response.
Checked Supabase connectivity before authoring. Separate script performed an upsert followed by a GET and normalized full-document comparison.
Rendered the returned database document with the native `renderHarmonyMapImages` renderer.

| Variant | Project ID | Houses / residents | Actual door reachability | Remote reload |
|---|---|---|---|---|
| No morphology or theme specified | `river-village-live-20260921-414a` | 8 / 4 | 8 / 8 | Matched |
| Earlier chipset, explicit river + forest theme | `river-village-forest-20260921-414a` | 8 / 4 | 8 / 8 | Matched |

Default example: 78×44, seed 17. Structural QA: one road component, eight connected and intact doors, zero invaded roof ridges.
Default stored SHA-256: `187e096cd8ab44febbafdf70e4026b53c29d3c0fcaf27c26dfadcf36c5873eae`.
Forest stored SHA-256: `beefdb9be27b6a6c67e88f14e7088a45df9075c2d62bbb140df9e35976d205b8`.

Artifacts:
- `/home/main/river-village-live/village-full.png`
- `/home/main/river-village-live/report.json`
- `/home/main/river-village-live/render-proof.json`
- `/home/main/river-village-live/reloaded.json`
- `/home/main/river-village-result.html` (image embedded as base64)
- `/home/main/river-village-forest-live/` (same evidence format)
- `/home/main/river-village-forest-result.html`

Reproduction: `node scripts/qa/river-village-live.mjs` or add `--forest` (authors the dedicated remote project; does not touch the user's other project rows).
The script uses the prior blank baseline artifact at `/home/main/village-contract-live/baseline.json` and the worktree Vite server on port 9839.

## Validation limits

- Changed TypeScript files: syntax transpilation successful; `git diff --check` clean.
- Added `test/villageRiver.test.ts` for channel connectivity, offset bounds, default exclusions, real bridge preservation and severed crossing rejection. Tests/gates/full typecheck were not run this turn.
- Existing water adaptation, horizontal rivers, multiple crossings, object-house/compact composition, and hills or lake/harbor combinations are not implemented for this morphology.
- Two successful authored examples do not establish every seed, count, chipset or map size. Capacity failures remain explicit failures rather than silently reducing the requested house count.

## Forest Harmony and selective fences follow-up

Default now uses `forest_harmony` / 숲마을 · 거리별 잔디. The native renderer showed that raw water tile 0
was unsuitable on this chipset, so the painter now reads the authored `forest_harmony_lake_47` group.
Road audit and river validation also use that definition. Tree stamps read authored `forest-trees:*`
preview maps including dimensions and layers; orchard and hedgerow planting use the same kit.

Current real-tool, remote-save/reload evidence (seed 17, 78×44, 8 houses):

| Variant | Fenced houses | Fence tiles | Legacy tree tiles | Reachable doors |
|---|---:|---:|---:|---:|
| Default | 0 | 0 | 0 | 8/8 |
| Two explicitly declared manors; second has fence=false | 1 | 18 | 0 | 8/8 |

Both have one road component, eight intact doors and zero invaded roof ridges. Both PNGs were visually inspected.
Manor row: `river-village-manor-20260921-414a`; saved SHA-256
`a790848762a7dde113b1654b2ee15ce0484bd7c93f5893d97aee1988af2e4f86`.
Evidence: `/home/main/river-village-manor-live/`, `/home/main/river-village-manor-result.html` (base64 image).
Reproduce with `--manor`. The prior forest-theme row was not overwritten by this follow-up.
Added default chipset/water/no-fence/legacy-tree absence and manor opt-out assertions to `test/villageRiver.test.ts`;
test suites and full typecheck were not executed.
