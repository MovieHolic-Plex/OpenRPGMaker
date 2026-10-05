# 청운 검희 — original native pixel candidate

- 64×64 literal ASCII grids: 9 base poses and 9 action/status poses. Shared palette has 18 exact RGB colors; `.` is transparent. All ink stays within x1…62/y1…60; idle soles touch y60.
- Original identity: high black ponytail with a navy tie, clear forehead, short turquoise crossover jacket, slim rose-red sash, long split side panels, slate trousers and two separate small dark shoes. The rear hip scabbard stays compact.
- References were observed for adult SD proportions, restrained eyes, layered cloth and weapon vocabulary. No reference pixels were extracted. Only `source/` was written.
- Face clusters were chosen per pose: two separate brows, small rightward pupils, warm nose/chin planes. Hit/poison narrow the lids; stun opens the mouth; sleeping/fallen eyelids are closed.
- Light comes from upper left. Teal cloth uses broad shoulder/sleeve planes and directional folds; trousers have broad lighter thigh planes; hair has connected slate highlights; steel has a narrow bright edge.
- Idle breathing changes sleeve, shoulder and side-panel clusters. Windup draws the blade from the waist. Move/attack widen the stance, trail the ponytail and pull the panels behind the hip. Recover bends the front knee and lowers the blade. Hit opens the chest and recoils. Dead has an independently drawn horizontal body, bent knee and resting sword.
- Skill preparation gathers at the shoulder-held sword tip; contact releases two unequal thin branches from the real tip; recovery lowers the blade and leaves individually drawn separated remnants.
- Poison alternates an abdomen clutch with a mouth-covering cough and moved bubbles. Stun has slack arms, open mouth and two separately placed stars. Sleep alternates a deeper nod, shoulder breath and changed knee/panel clusters, with closed eyes and a lowered sword.
- Inspection corrections: redrew the move/attack/recover cheek and jaw rows to remove excessive tilt; joined the move grip to the blade; assigned every lowered blade row its own position to remove unintended bends; replaced heavy blade borders with three-tone steel clusters.
- `author_pixels.py` records chosen literal runs/row replacements. Helpers only write those pixels or decode them. `inspect_pixels.py` creates inspection images and checks file dimensions/palette/margins; no project tests/gates were run.
- Saved evidence: `progress/idle.png` native checkpoint, `progress/face.png` nearest 8× face checkpoint, per-frame native PNGs and `progress/contact-sheet.png` with native + nearest 4× views.

## Remaining visual limits

The compact sleeve/grip reads most clearly when enlarged. The contact gust approaches x62 and has little room for a longer forward trail. Animation continuity and in-game contrast still need the independent reviewer and harness GIF review; this candidate has no user approval or installation.
