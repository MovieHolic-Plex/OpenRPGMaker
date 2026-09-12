# Compact village from saved exterior objects

**오밀조밀 장터 마을 · 작은 집 26채** is saved in Supabase project
`rpg-zzu-house-template-gallery`, map `map_compact_market_village_20260913` (**80×80**).
The first 128×128 draft remains available as an earlier reference.

## Result

- 24 ordinary homes from 10 exterior designs, plus two landmarks: **12×12** and **14×13**.
  Ordinary houses range from **5×6 to 9×10**; 18 are low houses and six have upstairs rooms.
  Selection shows every design first, then favors small footprints with a repetition limit.
- **No log-wall chips on either layer**, no excluded house tiles 196/197/226/227/256/257.
  Every placed exterior cell matches its saved object graphic.
- 26 houses in 6,400 cells: **3.328×** the house density of the original 20-house, 128×128 draft.
- **1,664 tree cells (26%)**, **661 cells of the actual 243-family tall grass**.
  Trees are complete broadleaf/conifer atoms; grass uses connected autotile patches.
- **249 water cells**, one asymmetric lake with 26×13 bounds and recessed bays.
  Four complete market displays, one lakeside rest clearing, fences, benches and small props.
- All **26 doorway approaches + 4 market fronts + 1 lakeside entry** are reachable on
  their exact landing cells using the real movement rules. New-map lint errors: **0**.

## Persistence and execution evidence

`supabase-proof.json` records actual CAS save, a successful complete normalized readback,
and the canonical server SHA. `final-remote-check.json` independently checks that server
revision plus all authored maps, spatial content and village graphics after browser QA.
The existing 15 maps, all previous objects and spatial occurrences were preserved.
The project now has 16 maps; the new 12 compact exterior objects are saved alongside the
original 30-house catalog.

- [Native map / zoomable viewer](render/index.html) and [overview](render/map-overview.png)
  are rendered from the Supabase readback using the editor's `drawMapTileLayers`.
- [Actual editor](editor-saved-village.png), `editor-proof.json`: normal project URL,
  remote persistence enabled, exact map match, 30 prior + 12 new houses, no browser errors
  and no content writes by the read-only check.
- [Shipping-player SUMMARY](runtime/SUMMARY.md): **8/8 beats**, no runtime errors,
  **37 real steps** (13 market, 12 house approach, 12 lakeside approach). Teleports set up
  distant approach samples; whole-map destination reachability is checked separately.
  Execution beats do not constitute a separate runtime visual-quality verdict.
- [New house contact sheet](house-catalog.png), geometry and render proofs, and
  `adversarial-review.md` document the exterior and composition reviews.
- `focused-tests.log`: root-run **130/130** across nine relevant test files, including
  explicit/automatic compact sizes, log walls on either layer, landmark/repetition limits,
  water reservation, complete vegetation and exact public access.
- `gates-proof.json` records the completed repository-wide gate (508 failed tests, app
  typecheck/CSS passed, surface failures) and comparison with the prior run. It caught a
  legacy sign regression, corrected by moving role assignment before filtering houses.
  **Final checks: 161/161 in 11 files and app typecheck passed.** `post-gate-tests.log`
  includes both newly failing files; geography passed unchanged and signs passed after
  the correction. The full suite was not rerun after that one-line ordering correction.
  The repository baseline remains red; this is not a claim that every test passes.

## Boundaries

The saved houses are exterior **objects**, not automatic interior spaces. The village
stores source object/revision and access metadata, not refreshable spatial occurrences.
Real interiors, floor transitions, NPCs and shop interactions require separate authoring.

The editor's registered AI tools (`upsert_spatial_design`, `author_village`) performed the
mutations. The script supplies a candidate pool, style, count and seed; the generator picks
house repetitions and coordinates, routes roads, plants vegetation and shapes the lake.
**No LLM provider session was used to demonstrate autonomous natural-language execution.**
Water coloring follows the shared canonical renderer; this change does not add depth colors.

## Reproduction

```bash
# Refuses to overwrite this map if it is already saved in the guarded project.
npx tsx scripts/publish-compact-village.mts
npx tsx scripts/publish-compact-village.mts --apply

node scripts/capture-authored-village.mjs --project output/evidence/compact-village/reloaded-project.json --map map_compact_market_village_20260913 --out .omo/evidence/compact-village/render --base http://127.0.0.1:19841 --rect 28,29,29,25 --rect 50,57,30,23
node scripts/qa/object-village-editor.mjs http://127.0.0.1:19841 output/evidence/compact-village/reloaded-project.json .omo/evidence/compact-village
npx tsx scripts/qa/prepare-object-village-walks.mts output/evidence/compact-village/reloaded-project.json
npm run qa:runtime -- --scenario object-village --project output/evidence/compact-village/reloaded-project.json
npx tsx scripts/qa/verify-object-village-saved.mts output/evidence/compact-village/reloaded-project.json .omo/evidence/compact-village
npm run gates -- --json
```

Full project JSON remains local under `output/evidence/compact-village/`; it is not copied
into the commit. This change adds no credentials, migration or deployment.
