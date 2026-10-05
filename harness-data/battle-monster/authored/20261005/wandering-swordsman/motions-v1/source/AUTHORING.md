# Wandering swordsman — original native pixel candidate

## Scope and authorship

The source directory was empty on entry. This is a complete original candidate responding to “follow the silhouette and action brief,” rather than a modification of an existing grid. All 18 final frames are full, literal 64 × 64 ASCII palette-index rows. Every contour, cloth plane, skin cluster, weapon section and effect cluster was selected explicitly at native coordinates. Blank padding and pixel-for-pixel preview rendering were the only serialization helpers.

The shared palette contains 18 opaque colors. `.` is transparent and is absent from the palette. The final art has transparent outer margins; ink stops at y=60 or above, and idle_a soles land at y=60. Coordinates in these notes are zero-based.

## Identity and explicit changes

- Drew a clean-shaven adult face with a projecting right-facing nose, small dark eye and warm skin planes. The black half-tied hair has a small crown knot and a long loose back section. Hair highlights use restrained cool gray clusters.
- Drew a pale blue-gray long dopo with a bright overlapping collar, broad light sleeve planes and darker underarm and right-side folds. Long skirts separate around the stepping legs. The teal waist tie remains visible across poses.
- Kept the sword and dark scabbard as separate materials. The single cutting edge is a continuous pale line against a blue steel back; fittings are muted gold. Idle uses a long descending blade and an opposite-hand scabbard angled back.
- Authored idle_b/c by locally redrawing collar, upper sleeve, fingers, sash and hem folds. The head and ground anchors stay stable.
- Windup draws the blade up from the braced scabbard. Move leans forward with a wide leading foot. Attack extends the foreground sleeve and hand into a horizontal rightward cut. Recover lowers the wrist and blade. Hit folds the torso backward with a dropped sword. Dead was drawn independently as a body lying on its side.
- Reworked the actual native wrist, tang and forearm clusters in move, attack and skill_b so the extended blades meet the hands. Added small joining steel clusters at the lowered wrists in recover, hit and poison.
- Skill_a crouches and aims the tip low behind the body. Its backwards blade was redrawn with explicit shallow descending rows so it leaves the left scabbard hand readable. Skill_b raises the cutting arm into a silver-blue crescent connected through the steel blade. Its central bulge was redrawn into a smoother bowed edge. Skill_c places the visible blade between the right grip and the left scabbard mouth, with foreground fingers wrapping that mouth and short broken afterglow fragments.
- Poison uses a compressed torso, downward face, a mouth-covering sleeve in a and a stomach-clutching hand in b. Purple hollow bubbles change both position and size; the clothing is not recolored.
- Stun has dropped shoulders, limp arms, a near-vertical lowered sword and gold/white stars in two different arrangements. Local head, neck, arm and fold clusters change between cels.
- Sleep sits low with pooled robe skirts, visibly closed eyes and a nearly grounded blade. The second cel redraws chest, collar, sleeves, fingers and a short breath wisp; neither frame contains letters.

## Visual review and remaining problems

The two native contact sheets were viewed at their original pixel resolution. They use row-major order matching the source names in TIMING.md. No tests or gates were run. These are review candidates, with no user approval recorded.

Remaining visual limitations:

- The 64-pixel cell compresses the extended horizontal sword relative to the descending idle sword. The blade remains inside the transparent right margin.
- Dark hair, scabbard and the deepest robe outline can merge on a dark background at native size, especially during preparation and sheathing.
- Three skill cels give a deliberate held preparation, sudden crescent contact and short recovery; the crescent appears abruptly rather than through additional growth cels.
- The seated sleep breathing changes and individual scabbard fingers are subtle at native resolution. Poison’s bubble movement and stun’s stars read more strongly.

`poses-native.png` and `actions-native.png` are unscaled static inspection sheets, not sprite-sheet replacements. `idle-native.png` is the current unscaled transparent idle_a preview.
