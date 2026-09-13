# Interior redesign — 2026-09-13

The previous catalog forced 101 spaces into rectangular envelopes with cream walls; 12 complete floors repeated a left/right two-room partition. `registerDiverseInteriorCatalog` replaces those saved designs while preserving their IDs and the user's 34 tile annotations.

- 101 interiors updated in Supabase project `rpg-zzu-house-template-gallery`, then loaded again and compared canonically (`supabase-proof.json`). All eight existing interior maps refreshed through their three owning place occurrences.
- 89 individual rooms now use six nonrectangular footprints. 12 complete floors use 2 rooms (4 designs), 3 rooms (6), or 4 rooms (2), with offset room envelopes and connecting doors. The `rect` on those 12 records denotes the containing bounding box, not a filled rectangular floor.
- 23 distinct dimensions, 3 wall materials and 7 base floor materials. Individual rooms within a floor may use different materials.
- Restored program-specific tables, added storage/decor appropriate to facilities, kept beds in sleeping rooms and cabinets/stoves against supported walls. Upper floors no longer repeat a kitchen by default.
- Fixed automatic and explicit wall placement to recognize stone/gold faces as well as cream. Added schema/tool/inspector support for mirrored elbows, south bays, side-wall recesses and cross-shaped rooms.

## Validation

- Native compilation of all 101 designs at seed 7: zero failed builds, missing objects, isolated passable cells or hard cluster errors (`audit.json`). Earlier default-seed pass also had zero errors; later furniture refinements were rechecked through all saved houses and 8 reviewed previews.
- Spatial schema/compiler/interior layout contracts: 101 tests passed. Updated vocabulary/layout contracts: 18 tests passed, including both retinted wall materials and per-room shape/floor save/load.
- Separate `npm run gates -- --only typecheck`: no errors, exit 0.
- Native player QA: Firefox 3-floor house 18/18 beats; 4-floor house 24/24 beats. Visits every authored room, goes upstairs and returns downstairs. First Chromium attempt hit a startup wait timeout under concurrent test load; all subsequent movement beats passed. Firefox rerun passed startup too.
- All 38 planned room/transfer walking steps verified with actual `canMove` rules; destinations now derive from authored rooms rather than an obsolete fixed bedroom coordinate.
- Rich comparison of all 101 designs: `output/interior-redesign/index.html`; native render sheets under `output/evidence/interior-catalog-review/complete`. This is a design preview at seed 7, not a claim that every catalog item has an instantiated map.

No runtime passage/priority or user-authored tile descriptions were overwritten. Catalog updates are project-local; the new shape/material support is in the editor engine.
- Editor browser check loaded the saved map with remote persistence enabled and compared it against the reloaded project; no browser errors. The database space view displays the new floor geometry. Multi-room floors show a composed-footprint label instead of an incorrect active rectangular-shape button.

## Full repository gate and regression comparison

`npm run gates` completed: tests 23,100 passed / 637 failed across 204 failing files; CSS and all 10 surface axes passed. The older saved baseline flagged 33 test files, plus an unused import caught before its removal. Final separate typecheck passed with zero errors.

All 33 flagged test files were rerun with four workers against both a clean archive of pre-change HEAD and the final worktree. Both produced exactly 298 passed / 33 failed (8 failing files), with identical failing cases and first-line messages; no newly failing cases were found (`gate-comparison.json`). The remaining 25 flagged files passed on both reruns. This does not claim the repository-wide suite is green. The original full run was under concurrent suite load.
