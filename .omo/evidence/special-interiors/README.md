# Inn and general store interiors — 2026-09-14

Two reusable places and three interior spaces were authored in `rpg-zzu-house-template-gallery` through the registered spatial tools and official Supabase save/reload path.

- Inn: 17×12 reception/common dining/kitchen/storage floor; 17×12 guest floor with three-bed dormitory, private room and stair corridor. Existing reviewed two-storey exterior/yard supplies the entrance.
- Shop: compact 15×10 sales/checkout, stock and packing floor. Bookcase stands against the wall, goods and food are supported by display tables. Its existing canvas stays larger during refresh; the authored room bounds are smaller.
- Uniform household curtains reduced from 12 source designs to 2. New facilities have a curtain only in the inn's private room (`curtains.json`). No curtain tile metadata or shared graphics were removed.
- Eight reusable facility furniture groups plus a preparation table are stored as spatial objects/section kits. Existing tile metadata, unrelated maps (17), and project start were preserved. Eight instantiated household maps were refreshed; both new places include functioning door/stair connections.
- This pass establishes facility layout and navigation. It does not add shopkeeper/receptionist NPCs or transaction/lodging event scripts.

## Validation

- Publisher asserts registration idempotence, exact unrelated-map/tile-metadata preservation, all passable floor cells connected, and zero hard cluster errors. Official save and fresh load match canonically (`supabase-proof.json`). Concurrent remote changes abort before save.
- 17 walking routes derived using actual `canMove` rules, covering both yards, each room and the inn staircase in both directions.
- Firefox editor reads the remotely saved maps and compares them exactly before screenshots; zero browser errors (`editor-proof.json`). `overview.png` uses native renders exported from that same loaded editor; `shop-editor.png` is the actual editor screenshot.
- `npm run gates -- --only typecheck`: exit 0, zero errors. No engine, unit-test or dependency code changed; the previous full-suite gate evidence remains under `.omo/evidence/interior-life/` rather than rerunning unchanged unit suites.

Reproduction: `npx tsx scripts/publish-special-interiors.mts --apply`; `npx tsx scripts/qa/interior-catalog-routes.mts output/evidence/special-interiors/reloaded-project.json special`; `node scripts/qa/special-interiors-editor.mjs`. Runtime scenarios are `special-interiors` with default inn and `QA_SPECIAL_FACILITY=shop` for the store.

Final runtime player QA: inn 13/13 beats passed; shop 8/8 passed; no runtime errors. These verify navigation; native editor screenshots were reviewed separately for layout. See the two runtime SUMMARY files.
