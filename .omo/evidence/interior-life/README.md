# Interior life zones — 2026-09-14

The reviewed interiors had varied outer walls but sparse, unrelated furnishings. This pass authors activity assemblies and applies them to 12 complete household floors. The other 89 interior component spaces remain intact.

- 14 reusable `interior-life:*` object/section kits preserve the relationship between floor backing, major furniture and tabletop props. Their AI descriptions/rules cover use and placement. Includes a complete six-chip curtain (142/143, 172/173, 202/203), stone hearth, cooking, washing counter, reading, meals, specialist work tables, sleep, twin beds and storage.
- 12 floors: three with two rooms, six with three rooms, three with four rooms. Sizes: 14×11 (3), 14×12 (3), 15×12 (6). Shapes use offset private wings and connected common rooms. The family has two beds; upper floors use reading furniture; the farmhouse uses compact cooking furniture.
- The atlas's 22/23/52/53 basin-shaped asset keeps its existing counter metadata and is described as a washing counter. No pixel art, tile metadata, collision or priority overrides were introduced.
- `scripts/publish-interior-life.mts --apply` used official Supabase load/save authority and reloaded project `rpg-zzu-house-template-gallery`. The publisher verifies idempotence, all interior tile metadata preservation, unrelated maps and start preservation, and refuses concurrent remote edits. Eight maps refreshed; 17 unrelated maps preserved. See `supabase-proof.json`.

## Validation

- The final 12 native compiled spaces have zero missing objects, isolated passable cells or hard cluster errors (`audit.json`). A preceding full 101-space pass also had zero failures; subsequent changes were confined to these 12 and rechecked. Port cells remain excluded even from passable rug backing, because stairs must not overwrite another object's raster ownership.
- 32 actual `canMove` walking routes were generated for both saved houses. Dedicated Firefox player QA for the 4-floor house passed all 20 beats, visiting every room and returning downstairs, with no runtime errors (`runtime-summary.md`). Native renders were separately inspected; movement checks alone are not visual approval.
- Editor Firefox QA loaded the remotely saved map and compared it exactly; verified all six curtain chips, hearth and stone floor, the space inspector, and zero browser errors (`editor-proof.json`). Initial stale Vite module state was resolved by restarting this worktree's server; the final run passed.
- Comparison gallery: `output/interior-life/index.html`, all 12 before/after designs. `scripts/qa/interior-life-gallery.mjs` produces it plus the representative native render sheet (`samples.png`). Toggle was exercised in Firefox.

This is authored project data plus reproducible publication/QA scripts. No `src/`, `test/`, CSS, runtime rules or schemas changed in this pass.
