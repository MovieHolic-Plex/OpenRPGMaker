# 물버들 마을 · Slates 32px / 50×50

Supabase `rpg-zzu-slates32-38e6`, map `slates_village_50`.
Root CAS save, reload equality and maps/tilesets mirror equality: `persistence.json`.
Local SQLite `output/slates32-project`, revision 6: `local-persistence.json`.
Existing five maps and their tilesets are unchanged; village is the new start map.

13 buildings, 67 trees, well plaza, 5 market counters, two 2-cell-wide bridges,
three flower beds and a waterwheel. 2500 lower / 2500 upper slots, 32px map/atlas.
The dedicated atlas contains 1232 original slots and 88 source-rectangle placement variants.
The house stamps and original learned source catalog are included in project tileset data.

Editor screenshot and map export use `reloaded-project.json`.
Engine `canMove` flood from (22,24): 1839 cells; all 22 named approach targets reachable.
Water blocked, all bridge tiles passable. Arrays and tile ranges valid.
This is a static tile-connectivity audit; no NPC/event interactions are authored.
Runtime uses dedicated player.html / export shim, not the editor play route.
Player at (22,24), sprite feet (720,800); editor/runtime page errors: 0.

즉시 확인:
- `map.png`: actual editor full-map PNG export, 3200×3200.
- `editor.png`: real editor, six-map list and 50×50 village selected.
- `runtime.png`: dedicated runtime with player in plaza.

AI reference: `openwiki/slates-village-authoring.md` and its durable PNG plates.
No gates / vitest / full typecheck executed, per session instructions.
No NPC dialogues, interior transfers, crop gameplay or waterwheel animation yet.
