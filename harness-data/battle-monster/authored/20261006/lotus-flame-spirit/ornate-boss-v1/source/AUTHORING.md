# 연화 화귀 — ornate-boss-v1

## Native source

- Original Korean folklore / wuxia ceremonial flame spirit, facing right in three-quarter view. No official asset is copied.
- Eighteen distinct 96 × 96 literal ASCII grids: nine in `poses/`, nine in `actions/`.
- Shared 18-color palette. `.` means transparent and is absent from `palette.json`.
- `idle_a` ink bounds: x17–86, y8–91; 84px total height. Main sleeves occupy roughly x17–76, with wider silk streamers. This is a native large foe, not a scaled human.
- Upper-left illumination: ivory upper sleeve planes, warm skin, large red skirt planes, burgundy cloth shadows, cool dark hair, warm gold borders. The references were viewed for vocabulary and scale only.

## Anatomy and changes

A small adult face with two restrained eyes sits beneath a three-pronged gold crown and a red inset jewel. Long black hair flows behind the shoulder. A diagonal golden lapel connects the broad left sleeve, red torso, layered skirt and lower golden lotus hem. The right sleeve was widened after native inspection to give the garment a distinct broad silhouette. Long scarlet silk streamers curl beside the robe.

The lower robe becomes five unequal flame petals rather than feet. Each has selected curved tip and bright interior clusters. Their shape changes with compressed arms, the extending wrist, casting and slack status postures.

- Idle: three independently patched breath, sleeve-fold, hair and flame states; no whole-frame movement.
- Attack: sleeves gathered at the chest; forearm and waist pushed right; gold-cuffed fingers connected to a sharp long silk sleeve and a curved flame tongue; sleeve drawn back during recovery.
- Hit: head and neck pulled backward, narrowed eyes, contracted shoulder and elbows. An unwanted old sleeve remnant was removed by redrawing the selected upper rows.
- Dead: separate low collapsed silhouette with spilled hair, shut face, folded shoulder, slack fingers, robe laid sideways and dim five flame tips.
- Skill: hands cup a closed red bud with gold core; unequal ivory/red petal planes open right from the hands; two petals separate while hands and robe relax.
- Poison: bowed head and strained eyes, arms gathered across the stomach, weakened flame ends, hollow mauve ember bubbles in two states.
- Stun: slack mouth and lowered arms in long hanging sleeves, five slack flame ends, three small independently drawn gold stars in different positions.
- Sleep: bowed head, closed eyes, robe curled beneath the torso, relaxed fingers and reduced flame breathing. Jewelry follows the bowed crown contour.

## Authoring and inspection

`author.py` records directly selected native row strings and local literal pixel runs. It initializes blank canvases, reuses unchanged anatomy and serializes full rows; it does not draw vector shapes, interpolate, rescale sprites, synthesize shading or convert a reference palette. `render.py` only decodes grids and makes nearest-neighbor diagnostic views / GIFs.

`progress/idle.png` and `idle-4x.png` were saved and viewed before the other poses were authored. Subsequent motion, magic and status draft PNGs were actually viewed. Final inspection sheets, individual decoded PNGs and eight native GIF groups with nearest 8× views are in `progress/`.

Decoder diagnostics record dimensions, bounds and distinct hashes in `progress/source-dimensions.json`: all eighteen sources differ, use the shared palette, retain the transparent outer border and have lowest ink at y91 or above. These are file-contract diagnostics, not game tests or approval.

## Remaining visual limits

The crown chains and individual fingertips are tiny at native scale. Some silk streamer curves are angular. The sleeping silhouette is a compact floating curl rather than a fully horizontal recline. No in-game timing, packing, store installation or user approval is claimed. The independent reviewer could not start because the collaboration tool returned a session-thread error; `REVIEW.md` records this limitation and the author inspection separately.
