# Hero v4 hostile review

**PASS:85/100.** Meets the unchanged85 threshold, every axis minimum and zero critical failures. No rubric change or exception.

Reviewer:hero_hostile_review; author:root.
Rubric SHA256:`2cf097d80cc9d8f17110fcebd21b7493b7320bc101596126cebd5cff66dcd5ec`.
Sheet SHA256:`08569511118bae2d0c6f3d4bcb3a2b405e33f9353a6b2b7f53d7f61773300599`.
GIF SHA256:`c9ca9fb1accecd0b6d380deaf3feb0371fb0c13b3c1ee8d593e73e9abfcb11c9`.

## Evidence

All12native poses and4decoded GIF frames inspected at native/4x. Four140ms frames, loop0(infinite), frames1/3 identical. Full decoded-frame sequence and12-pose sheet were reviewed; browser playback was not claimed. Paths/SHA and per-frame hashes/bboxes are in v4-review.json.

## Scores

|Axis|Score/max|
|---|---:|
|silhouette|16/20|
|anatomy|16/20|
|walking|17/20|
|pixelCraft|13/15|
|identity|14/15|
|directionContinuity|4/5|
|loop|5/5|

## Findings

**silhouette**: Compact coherent human is readable at native size; narrower crown and visible shoulder/sleeve contours avoid the old mushroom/pole effect. Vest/shorts still have a fairly rectangular silhouette, limiting expression rather than readability.

**anatomy**: Jaw/neck/shoulder transitions and side nose are legible; sleeves now attach visibly to skin forearms/hands, and knees/feet remain connected to hips. Small limb lengths remain compressed but no attachment or extra-limb ambiguity requires repair.

**walking**: Up/down poses now exchange a stable planted leg and a folded raised foot rather than simply splaying two straight columns. Opposed sleeve/forearm/hand shifts read at native size. Profiles retain coherent separated shoes and alternating contact. Motion is restrained and somewhat stylized but meaningfully articulated in all directions.

**pixelCraft**: Cap underside is now divided into temple hair and a directional bill, highlights form useful clusters, and sleeve/hand contacts are cleaner. Some close navy tones add little volume and the torso remains a simple color block; these are polish limitations, not noisy or broken pixel construction.

**identity**: Red cap, blue vest and gold-red pack form one consistent recognizable costume through front/back/sides. Side bill and nose clarify cap orientation; pack placement and attachment remain coherent. Back pack volume is relatively flat, but its shape/straps/palette are unmistakable.

**directionContinuity**: All four directions preserve proportions, palette and costume placement; front/back/profile meanings are clear. Front/back head shading is simpler than profile depth, leaving modest turning-volume polish.

**loop**: Complete four-frame140ms cycle has coherent1px step bob, identical idle1/3, stable costume/head shapes, alternating grounded/raised feet, and no unexplained phase or final-to-first seam visible in the full decoded-frame sequence.

## Remaining limitations; no required blockers
- Torso/shorts silhouette remains fairly rectangular.
- Back pack has readable attachment and identity but limited shaded depth.
- Some close navy shades add little volume; front/back head shading is simpler than profiles.

The previous material defects were repaired: planted/folded leg distinction, opposed attached wrist/sleeve action, separated profile shoes, profile cap hair/bill distinction, and readable jaw/nose. These actual changes support the scores. Approval is specific to the reviewed hashes; it is not evidence of canonical registration or runtime/browser verification.

## Reinspection of corrected prepared package

Observation package SHA256:`d5d0aafb21a2f368e34fb6006522b998a0b2508afd03a59ba8f930cc25e731d3`.

Reopened both prepared native/decoded contacts directly. The enlarged/native overlap is removed; all12poses and all4decodedframes remain visible at native/4x. Latest package source/GIF hashes match prior independently approved artwork; evidence contact hashes remain those directly viewed during this reinspection. Retain85/100 with the same reasons and nonblocking limitations. Browser playback remains unclaimed by this critic. Prepared evidence hashes:

- `/tmp/pokemon-hero-refine/v4/quality/native-contact.png` — `5228d31fdaf31c439741e8716e8aa9f9d20c542e6367eea5c7fdce1a7b517c4a`
- `/tmp/pokemon-hero-refine/v4/quality/decoded-gif-contact.png` — `b4439a9ac4f83e2b946b42560dff733476683cd84f6720d3a96b793cc072b265`
