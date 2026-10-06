# Approved field kit — native game adoption

Completed: true. Canonical project fca4b134-ed34-4365-9021-450c7ee24894,
revision35. Official host9888 backed by
`/home/main/.local/share/oprn/web-workspace/.oprn-projects/649482df-81ca-4af9-806b-2613f7d7bebb`.
Fresh service load matches the prepared document, with all6asset byte hashes verified.

## Actual player checks

- Genuine predecessor slot: map/position, gold, party, box, instances and inventory preserved.
- Snow-cat NPCs: native24×32 cells, scale1, four-direction moving frames and solid collision.
- Native dialogue, party6slots, monster summary and bag rendered.
- Native medicine: HP1→20, potion5→4 (private QA HP deficit).
- Native shop purchase: gold1600→1520, capture orb10→11.
- Native slot2 save and reload: gold1520, orb11, potion4 retained.
- Menus keep the same live BGM element and advancing time, with no additional looping play.
- Town/route resources and cursor/confirm/cancel cues observed in real runtime playback.
- Separate derived slot changes only the first monster species to snow cat; the real save
  loader resolves the new follower sheet at24×32/scale1. No user saves were changed.
- No browser page errors, failed media responses or editor shell in the exported player.
- Published player.html/player.js/project.json hashes match the inspected candidate.

## Immediate visual review

01-field.png, 02-monster-dialogue.png, 03-menu.png, 04-party.png, 06-bag.png,
08-shop.png, 10-frost.png, 11-narrow.png, 12-species-follower.png.

## Limits and provenance

This adopts one approved monster species, two BGM arrangements, three cues and Emerald
field UI styling. It does not replace other monster/NPC art or alter the opening.
Audio playback and continuity were instrumented; musical quality was human-approved,
not claimed as agent listening. Full suites/typecheck/gates were not run.
Player build succeeded. Original approved image pixels were compared losslessly.

The save committed, then its final asset read lost a socket. We did not retry the save.
A fresh read and the read-only recovery script verified the stored document and all6assets.
Probe development found input timing and cursor-selection mistakes; final report.json
is the successful native-keyboard run, including correct selection with autosave present.

## Reuse

- scripts/content/prepare-approved-field-kit.mjs verifies immutable Allow receipts,
  packs losslessly, validates placement and prepares a detached canonical patch.
- scripts/content/monster-expedition-store.mjs owns backup/CAS/save/fresh-read.
- scripts/content/verify-approved-field-kit.mjs verifies read-only recovery and asset bytes.
- scripts/qa/runtime/field-kit-native.probe.mjs exercises the shipping player privately.

Game: http://mdc-server:18301/monster-expedition/player.html?build=field-kit-20261005
