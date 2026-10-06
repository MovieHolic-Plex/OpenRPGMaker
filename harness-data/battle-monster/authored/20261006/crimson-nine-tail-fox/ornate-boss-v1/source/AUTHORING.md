# 홍련 구미호 — ornate-boss-v1

## Native source

- Native cell: **96 × 96**, 18 opaque palette colors, `.` transparent. All 18 delivered pxgrids contain complete literal ASCII rows.
- `poses/`: idle_a, idle_b, idle_c, windup, move, attack, recover, hit, dead.
- `actions/`: skill_a, skill_b, skill_c, poison_a, poison_b, stun_a, stun_b, sleep_a, sleep_b.
- Idle_a ink bounds: **x 3–81, y 11–92** (79 × 82). Actual paw contour reaches y92. Every delivered frame retains a transparent outer border and stays above or on y92.
- The native64 human reference was viewed only to study dark outlines, upper-left lighting, and relative size. No reference pixels were extracted, resized, or traced.

## Selected anatomy and materials

Original ivory quadruped with two uneven triangular ears, a long right-facing muzzle, narrow gold/jade eye, substantial ruff and four differently shaded legs. The rear fan uses nine separately authored curved crimson tails with ivory terminal planes. Burgundy shadows describe red fur; broad cream and dusty mauve planes describe white fur. A gold-edged jade neck seal carries folded vermilion silk. Small shoulder lotus embers and the mouth-driven fire establish the species magic.

The first idle was decoded and inspected at native 1x and nearest 4x before other poses. Two hidden tail terminals were redrawn; the distant foreleg gained a shoulder connection. Subsequent explicit edits closed disconnected collar straps, removed internal neck seams, redrew contact wrists, and kept hit silk and feet above the baseline. Independent review prompted additional curved tail planes in the gathered/folded fans, relocation of hidden terminal caps, removal of a detached stun toe fragment, and a clearer shoulder ember on ivory fur.

Windup compresses the neck and folds the knees; move extends the barrel and pushes the hind hock; attack opens a toothed jaw and reaches with two connected forelegs. Recover raises the chest and bends the foreknee. Hit drops the head and buckles the hindquarters. Dead flattens barrel, neck and head, closes the eye, lays paws along the ground and slackens the collar.

Magic has three separately authored phases: a gold lip core with three burning tail terminals; a mouth-connected curved flame with a pale core and torn tongues; and two separated cooling embers with a closing jaw. Poison lowers the head and strains the eyelids while jade bubbles change positions. Stun loosens the jaw and wrists, with small changing gold stars. Sleep curls the barrel, tucks the paws, folds the ears and keeps the eyes closed in both breathing states.

## Authorship and inspection

`author.py` contains literal selected blocks and explicit coordinate/color patches; its helpers only serialize rows, overlay chosen pixels, and decode PNGs. No procedural silhouettes, gradients, tracing, whole-frame transforms, image generation, or synthesized poses were used. Diagnostic enlargements use nearest-neighbor rendering only. `render_previews.py` uses the same fixed palette for GIF indexing without color quantization.

`progress/idle.png` and `idle-4x.png` are the first-pose preview, updated to the final idle. `progress/contact-sheet.png` shows all18 final sources in order. Individual native and 4x PNGs and eight animation groups are provided in `progress/`.

## Remaining visual limits

- Gathered and folded fans were revised after independent review to expose their ivory termini. Their overlapping lower crimson stems remain more densely packed than the full idle fan.
- The large tail fan dominates the silhouette. The white torso and gold ornament are more restrained than the fire fan.
- Nine physical poses provide a coarse dash rather than a smooth long animation. Preview timings and contact anchors are art guidance only; no runtime damage, projectile or audio synchronization has been verified.
- This is a candidate for human judgment. No user acceptance, installation or gameplay approval is claimed.
