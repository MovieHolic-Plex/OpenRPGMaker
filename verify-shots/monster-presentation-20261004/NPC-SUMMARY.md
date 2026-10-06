# Native NPC collision / genuine old-save Continue QA

## Scope and authorization

- Actual exported game, native Chromium keyboard input only. No editor shell, teleport, injected direction, event execution, clock changes, or session fabrication.
- A private HTML **real file copy** adds only `qaInstrumentation:true` to the shipped BOOT. Immutable project, player.js and assets are referenced unchanged. Only `readState`, `readLive`, `__oprnCharacterSprites` were used, all passively. See qa-copy-receipt.json and final-r25/qa-copy-receipt.json.
- Native save transport was explicitly authorized: original `/tmp/monster-systems-20261004/native-starter/save-slot-one.json` UTF8 bytes → fresh browser context localStorage `starlight-islands-v1:save-slot:v5:1`. Genuine previously played save, not a fabricated session.
- Original file remains exactly **31,046 bytes**, SHA **f07cd4691462db7479cead6f350a0b5af696a84bf0f81b5b757d640b11cc8b0f**.
- Actual saved player position is **mx_map_lab (7,7)**. Monster caughtAt is **mx_map_lab (7,6)**. These are separate coordinates; the file was not altered to meet an expected coordinate.

## r23 artifact 4707fd336dc36a54 — native movement and collision

1. Enter New Game → Escape skips picture-book opening → native Enter clears home intro.
2. Start (10,10) → ArrowRight reaches (11,10). The fixed guide is now (9,12), so the first right step is open.
3. 20.622 seconds / 40 passive samples show all three home residents moving inside their authored routes:
   - local: x6..8, y9.
   - ambient_resident_1: x12..14, y8.
   - ambient_resident_2: x13, y11..13.
4. Native walking reaches (8,9), the local resident's next route cell. Holding the player there for **24.751 seconds / 48 samples** keeps the resident at (7,9). The other two residents continue moving, demonstrating active scene updates.
5. Native ArrowLeft three times cannot move the player from (8,9) into the solid resident at (7,9).
6. ArrowRight releases the route cell and moves the player to (9,9). Another **20.647 seconds / 40 samples** shows the resident resuming x6..8/y9 with no drift.
7. Native walking: (9,9)→(10,9)→(10,6)→(13,6)→(13,7)→(16,7)→door(16,6)→lab(7,9)→(7,6). Enter opens professor dialogue at professor(7,5).

The published local patrol interval is **1400 ms**. The blocking observation spans 17 authored interval opportunities. The passive hooks do **not** expose an actual attempt counter; this count is inferred from duration and interval, not directly observed. Earlier progress notes used the proposed 1600 ms interval; this report uses the actual export value.

## r23 genuine save Continue and actual menu

Fresh context transports the exact old save. Native title Down/Enter → save slot 1 → Enter loads lab(7,7), with no picture-book opening. Original party, full monster instance and inventory compare equal:

- One 새싹토, Lv.5, HP20/20.
- 어깨툭 and 새싹치기, each PP30/30.
- Capture orbs10, potions5.
- Dex discovered1/60, captured1.
- Bag has the two real items and no actor equipment section.
- Escape detail→party list→root and root→field work.
- No browser page errors. 19/19 focused observational checks true (checks-r23.json).

The first Enter in the party view selected the PC switch row, so photos19/20 show the empty PC view. Native Enter switched back, Down selected 새싹토, then Enter opened details. Use photo22 for actual PP evidence.

## Latest r25 artifact 7915c1ebc20e18af — bounded recheck

- Immutable export `/tmp/monster-npc-opening-20261004/final-export-repaired`.
- Source id 51a50abb8dfe23a7. Root reported canonical revision25 SHA 4811a4afff1e1a6508e810ff25ddeb2245b08b4e8f007d4e028d1d62cb288937.
- Private observation copy references the same immutable source; exported project SHA **10b303aead3f3d7cc4f349560094427113d2de17fbe405c95434f0820ae18a17**.
- New fresh context again imports the same original save, navigates native title/load slot, and loads lab(7,7) with no opening.
- Full original party/monster instances/PP/inventory preserved.
- Actual professor sprite: People1 **frame79 / characterIndex6**, world position (120,96) = tile(7,5).
- Actual rival sprite: People1 **frame31 / characterIndex2**, world position (200,96) = tile(12,5).
- Screenshot visually confirms professor and blue-haired rival are distinct.
- All72 map tile layouts and all event coordinates, triggers, collision flags, footprints and movement definitions compare equal between r23 and r25. The long collision observation was preserved, not repeated after the appearance/CSS/shop changes.
- No browser page errors. 10/10 bounded observational checks true (final-r25/checks.json).

## Immediately useful images

- 02-start-right-open.png
- 06-blocked-after-24-seconds.png and 07-solid-npc-stops-player.png
- 09-resumed-patrol-within-route.png
- 13-professor-native-dialogue.png
- 22-old-save-visible-pp30.png
- 25-old-save-clean-bag.png and 26-old-save-dex-one.png
- **final-r25/02-lab-continued-correct-professor-rival.png** — latest artifact and genuine loaded save.

## Limits and cleanup

- Private BOOT observation flag is explicitly disclosed. Opening/audio/shop/mobile behavior on pristine exports is root's separate QA scope.
- Only the home three patrols were observed live for the long collision case. Other towns were not live tested here.
- Actual blocked attempt count is not exposed; elapsed wall time/interval opportunities are the evidence.
- Long movement/collision and menu screenshots use r23; latest Continue/sprite screenshot and preservation checks use r25. Geometry and movement equality bridge this limited recheck, not a claim that every runtime behavior was rerun.
- Source and canonical stores were not edited. Original save file and source HTML hashes are unchanged (end-receipt.json).
- Own Chromium contexts/browsers and own port18570 Python server were closed. No other server was stopped.
