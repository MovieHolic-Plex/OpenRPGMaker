# Composable field HUD — implementation and browser evidence

The database now authors HUD elements, rather than selecting colors for one fixed layout. Presets include farming, survival, party, action and minimal layouts; legacy remains selectable. Up to 24 elements can be added, duplicated, reordered, dragged or moved with arrow keys. Each has a data source, representation, anchor/offset, size, panel/color and visibility condition. Configuration uses the existing project history and persistence boundary.

Sources: actor HP/MP, farming energy, actual action stamina, gold, variables (including variable maxima), timers, inventory, weather and map name. Party cards use actual actor portraits/vitals; status elements read actor states and a selected timer. Custom images use the existing picture resource picker and asset resolver. Food slots show inventory quantities; this does not introduce a Valheim-style consumed-food effect system. Runtime remains keyboard-only; pointer editing is confined to the database preview.

## Verification

- `node scripts/qa/runtime/field-hud.probe.mjs`: 7 profiles × 3 beats = 21 passed, no runtime errors. Dedicated `player.html`/export store shim, not editor Test Play.
- Actual guard input consumes stamina; owned food counts match the displayed slots. Variable 72 → 24 updates the custom ring and 0 hides it. Menu hides HUD. 320×240 captures stay inside the viewport. HUD settings survive serialization/deserialization; duplicate IDs, invalid bounds and unsupported enum values are rejected.
- Player at the lower map edge moves the toolbar above the play area without covering calendar, money or vitals. The edge case starts a new real session at that position; debug teleport changes session coordinates without reliably relocating the visible sprite and is not used as visual evidence.
- `HUD_EDITOR_URL=http://127.0.0.1:9829 node scripts/qa/field-hud-editor.probe.mjs`: actual controls exercise add/duplicate/delete, variable binding, drag, keyboard movement, preview isolation and roundtrip. No browser exceptions. The temporary UI-only project deliberately has persistence disabled; no remote game content was authored.
- No local full typecheck, gates or vitest invocation, per session instructions. Normal PR CI is separate.

## Screenshots — visually inspected

These are real runtime screenshots of a QA copy of the existing project, with time/energy/tool/food inputs enabled. No operational project or game content was overwritten.

- [Farming](../.superpowers/sdd/qa-shots/hud-composer/farm.png): date/money, conditional vertical HP, energy, full toolbar.
- [Survival](../.superpowers/sdd/qa-shots/hud-composer/survival.png): top slots, supplies/health, stamina during guard.
- [Party](../.superpowers/sdd/qa-shots/hud-composer/party.png): portraits and independent member health.
- [Avoid player](../.superpowers/sdd/qa-shots/hud-composer/avoid-player.png): relocated toolbar leaves fixed panels clear.
- [Database composer](../.superpowers/sdd/qa-shots/hud-composer/editor.png): actual editing surface; map snapshot and simulated combat preview are labeled.

Arbitrary user layouts can intentionally overlap. Automatic avoidance applies to opted-in elements; this is not a global constraint solver for every legacy overlay. Existing objective/minimap systems are not converted into editable HUD elements in this change.
