# 연못수귀 — literal native candidate

## Scope and source

This candidate contains all 18 original 96×96 palette-index frames: nine basic poses in `poses/` and nine action cels in `actions/`. Every `.pxgrid` is 96 full literal ASCII rows of 96 symbols. `.` is transparent; `palette.json` contains 18 opaque RGB colors. All authored pixels stay inside x=1…94 and y≤92. This wraith floats: her two lower water forks replace ordinary feet.

The supplied 64px swordsman was opened for visual study of the small adult face, restrained right-facing eye, cloth volume and connected hands. No reference pixels or image bytes were copied into this source. No other species was used.

`author.py` preserves the initial literal body rows and each subsequent explicit row or coordinate-span decision. Stable, unchanged literal clusters are retained when a cel is revised; moving joints, sleeves, hands, tails and effects are replaced with individually selected rows. There are no geometric drawing primitives, body transforms, pose interpolation, shading synthesis or automatic hole filling. The final independent grids are the deliverable. `render.py` only decodes them, pads diagnostic panels, enlarges diagnostics by nearest neighbor and writes indexed GIFs. `inspect.py` creates labeled face crops for examination.

## Body and material decisions

- Small mature female face with one visible near eye in rightward three-quarter view, cheek space ahead of the eye, shaded nose and restrained pink mouth. Wet black hair uses K/H with broad J/V upper-left reflections.
- Contiguous neck and overlapping white-grey hanbok collar. L/W are broad upper-left cloth planes; N/S form folded fabric and the underside of both wide sleeves.
- Thick connected teal upper arms, wrists and wet palms use T/B/C/D/E. Water has sharper pale ribbons than the cloth. The lotus-leaf waist sash is teal with a gold fastening and a small pink knot.
- Lower cloth resolves into two separate water forks. The gap between forks and air below the raised attack arm are intentional.
- `windup` collects water hands behind the waist. `move` changes shoulders, robe and both pushing water forks. `attack` extends a connected shoulder, cloth upper arm, wet forearm and broad palm with short separated digits. `recover` bends the wrist back toward the body.
- `hit` lowers the face, makes the shoulders uneven and draws a hand to the chest. `dead` is a separately authored low body with folded sleeves, closed eye, retained long hair and two exhausted water lobes at the floor.
- The skill begins with a pink lotus and pale cyan nucleus supported by a water hand. The cast splits from the palm into an upward hooked stream and a heavier downward stream. Recovery folds the arm and releases three separate tear-shaped droplets.
- Poison uses a chin-cupping hand, bent elbow, stomach-clutching hand, strained eyelid and changing pink-violet toxic bubbles. Stun has a lowered bent face, hanging arms and two stars with different locations in each cel. Sleep is a seated, folded robe with tucked water forks, empty relaxed palms and a short horizontal closed eyelid; its second cel changes the chest and lap folds for breathing.

## Corrections made after opening actual PNGs

Coordinates are native, zero based. All corrections were literal selections, not propagated image transforms.

1. `idle_a/b/c`: finished the front broad sleeve and cuff around y=35…53, then connected the wrist, palm and short fingers around x=53…60, y=51…58. Each idle has its own breathing/highlight and fork changes.
2. `attack`: restored the accidentally empty y=83 fork row at x=37…46. Redrew the palm and separated digits at x=72…90, y=30…46 to avoid a thin upright finger bar.
3. `skill_a`: connected the sleeve and flower cup with explicit wrist rows around x=55…80, y=37…44.
4. `skill_b`: moved the authored outer stream edge inward by selecting shorter literal gaps so its rightmost ink is x=94. Drew the palm-to-fork connection around x=56…75, y=40…46; the streams are part of the character component.
5. `poison_a/b`: replaced the rectangular forearm with chin fingers, a widening wrist, bent forearm and elbow in y=31…52. Removed overlong pale face overlays in y=26…29 and selected each strained eyelid separately.
6. `sleep_a/b`: removed the unintended extended pale nose blocks in y=44…48. The final eyelid is the short J cluster at x=46…48, y=45, separate from the shaded nose at the forward contour. Both final faces were reopened at 1× and 8×.
7. `stun_a/b`: redrew y=30…46 so the head bends into the front shoulder, with a lowered eye and jaw. Refinished each cel's star tips at its actual positions after these complete row replacements.

## Inspection and evidence

Opened native PNGs and the full suite on light, dark and checker backgrounds. Opened labeled face enlargements and all eight contact strips decoded from the actual GIF files. Examined sleeve-to-wrist continuity, the attack palm, neck/collar, robe belly, the water-fork gap and the closed sleep eye. Diagnostic connectivity showed one main body component in every frame; isolated bubbles, stars and recovery droplets are intentional. Connectivity was only a diagnostic and did not alter any pixel.

`previews/render-report.json` records actual source/PNG/GIF SHA-256 values and bounding boxes. All eight exported GIFs were reopened, and each decoded RGBA frame and hold matches its literal source and timing. Idle, poison, stun and sleep pairs differ in actual pixel arrays. No repository tests or gates were run.

## Remaining visual limits / review status

The poison chin cup is compact and the drooping stun fingertips have only a few pixels at native scale. The two water-stream branches use stepped ribbon contours; independent review should judge their curvature and the abrupt three-cel cast-to-droplet change. The low dead and seated sleep bodies deliberately occupy less height than the standing poses. Motion was examined through decoded GIF contact strips and native images; it has not been installed or observed in a running battle.

These files are a candidate for the harness's independent review. No independent-review verdict, model provenance, user approval or ledger decision is created here.
