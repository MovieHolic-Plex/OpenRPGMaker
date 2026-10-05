# Native GIF timing proposal

This is a proposed exposure table for the unselected `reference-v3` candidate. All images are independent authored 64×64 cels; GIF playback introduces no intermediate images, translations or interpolation. Preview GIFs use the literal 18-colour palette plus transparent index 0 and clear the previous cel between exposures.

| Preview | Pose order and holds in milliseconds | Total |
|---|---|---:|
| Idle | idle_a 220 → idle_b 220 → idle_c 220 → idle_b 220 | 880 |
| Attack | idle_a 220 → windup 200 → move 100 → attack 120 → recover 200 → idle_a 260 | 1100 |
| Hit | idle_a 220 → hit 200 → recover 180 → idle_a 260 | 860 |
| Dead | idle_a 220 → hit 180 → dead 1000 | 1400 |
| Skill | idle_a 220 → skill_a 320 → skill_b 160 → skill_c 240 → idle_a 300 | 1240 |
| Poison | poison_a 360 → poison_b 440 | 800 |
| Stun | stun_a 300 → stun_b 340 | 640 |
| Sleep | sleep_a 620 → sleep_b 700 | 1320 |

All preview GIFs loop for inspection. In gameplay, attack/hit/skill should return to the ordinary idle loop; death should hold its final cel rather than repeat the preview. Poison/stun/sleep can loop while their respective status is active. These instructions do not modify the runtime.

## Attack beats

`windup` puts the hands together at the scabbard mouth and folds the knees. `move` opens the stance and carries the grip forward. `attack` is the horizontal contact cel, with its blade extended to the right and the hips between the two supported legs. `recover` lowers the blade diagonally before idle resumes. The suggested damage moment is the start of `attack`; no damage timing has been installed.

## Moonlight Slash anchors

Coordinates are zero-based pixel centres. They describe the literal cels, not instructions to move a template.

| Cel | Sword hand | Guard / blade root | Other hand / scabbard mouth | Mouth reference |
|---|---|---|---|---|
| skill_a, preparation | around (30,40) | brass (34,41), blue root (35,41) | around (39,42), scabbard below (41,44) | around (31,24) |
| skill_b, contact | around (45,34) | brass (49,33), blade starts (50,32) | around (26,38), scabbard follows down-left | around (33,24) |
| skill_c, recovery | around (30,41) | brass (34,42), blade remainder (32,43) | around (38,43), scabbard mouth below (40,45) | around (31,26) |

- **Preparation, 320 ms:** the sword tip is behind and low, with explicit split flame-like light on the blade. The glow is rooted at the grip/guard junction and follows the drawn blade down-left. Both hands are attached to their sleeves.
- **Contact, 160 ms:** the sword points right. The bright blade and blue edge reach the crescent near (56,33), which joins the right-side arc. The arc extends from about y16 to y48, peaks at x62 and bends back toward the forward knee. The grip remains part of the near hand; the arc does not replace the sword.
- **Recovery, 240 ms:** the scabbard hand and sword hand approach each other. Only a short silver blade section remains visible. Three separately authored fragments around (48,31), (57,38) and (54,44) break away and vanish on the next idle cel.
- **Mouth:** it is a face registration reference only. This is a sword-energy technique; there is no mouth-emitted beam, letter or symbol.

## Status holds

Poison gives the deeper knee buckle a longer exposure. Bubbles appear on different sides of the head and shoulder without recolouring the person. Stun holds the asymmetrically buckled knee slightly longer and changes the star arrangement. Sleep alternates a narrower exhale chest with a fuller inhale chest; shoulders, mouth and knees change together while the closed eyes and lowered weapon remain recognizable.

Native PNGs, `contact.png`, `dark.png`, `light.png` and all eight GIFs are in `previews/`. Actual battle playback and independent/human review remain pending.
