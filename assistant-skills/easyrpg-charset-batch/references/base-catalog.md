# EasyRPG RTP Base Catalog & 9 Unified Style, Head & Kinematics Laws

## 1. Choosing `mode`, `base`, and `hair_ref`

### Mode 0 (Recommended Default): `doll12` — Hybrid Nude-Doll Body (`Template:0..2`) + Official RTP Hair Donor (`hair_ref`)
Starts from official EasyRPG `Template.png` unclothed mannequin bodies with pre-placed RTP eyes and generates an 8-symbol Anatomical Limb-Separation Blueprint (`doll_outline.chr.txt` + `doll_outline_8x.png`: `O`=outer silhouette, `I`=arm-vs-torso/chin/leg separation creases, `S`/`s`=front/back swinging limbs), **paired with `"hair_ref"` (`hair_ref_head.chr.txt` + `hair_ref_8x.png`)** so workers sculpt genuine multi-clump RTP hair/brows/back-hair on top of zero-clutter 12-frame body kinematics:
- `Template:0` — **Standard Youth / Adult Chibi Mannequin** (`23px` tall, eyes `y=15..16` — knights, mages, townsfolk, modern/fantasy cast).
- `Template:broad` — **Broad Muscular / Dwarf Chibi Mannequin** (`23px` tall, eyes `y=15..16`, `18px` shoulders — **ALWAYS use `Template:broad` for dwarfs, blacksmiths, martial masters, heavy warriors!** Matches `Actor1` & `People4:4` 2-head chibi scale!).
- `Template:2` — **Petite / Child Chibi Mannequin** (`21px` tall, eyes `y=17..18` — apprentices, children, fairies, halflings).
- *(Warning: Do **NOT** use raw `Template:1` for normal humans or dwarfs! Raw `Template:1` is a `29px`-tall 3-head Giant/Ogre boss with eyes up at `y=9..10` — `6px` above all RM2000 characters — reserve `Template:1` exclusively for literal 2.5m Giant/Ogre monsters!)*

Recommended `"hair_ref"` Official RTP Hair Donors for `doll12`:
| Hair Archetype | `hair_ref` | Key 4-Direction Head Features |
|---|---|---|
| **Spiky / Swept Hero** | `Actor1:0` | Layered spiky crown, headband/bang clumps, dynamic `UP` spikes |
| **Bob Cut / Short Pageboy** | `Actor2:1` | 4–5 vertical bang & `UP` back-hair clumps + warm chestnut brow harmony |
| **Center/Side-Parted Blonde** | `Actor4:1` | Swept side-locks framing cheeks + golden-ochre eyebrow (`#997a41`) |
| **Tied / Bun / Ponytail** | `People1:1` | Soft bangs + cheek sidelocks + tied back-hair mass across `RIGHT/LEFT/UP` |
| **Long Flowing / Wavy Hair** | `Actor4:6` or `Actor1:1` | Full shoulder-draping locks in all 4 directions + tinted dark brow |
| **Slicked-Back / Pompadour** | `People2:4` | High swept crown + clean exposed forehead |
| **Topknot / Martial Headband** | `Actor3:3` | Compact tied crown + trailing headband knot |

### Mode A: `partedit` (`src/harnesses/charset-actor/partedit.py`)
Locks `F` (face, eyes, skin, hands) and walking leg bounce pixel-for-pixel, while allowing edits to `H+h` (hair/headgear), `T+t` (torso/shoulders/cape), `B` (pants recolor), `S` (shoes recolor), plus 4-direction anchored `gear` (`held` weapon/staff/shield, `hip` scabbard/bag, `back` boiler/pack/wings).

Supported `base` keys in `partedit.SPECS`:
- `People1:0` — Clean slim youth jacket/jeans base (note: `People1:0`'s locked `F` eyes are softer townsperson eyes; if you want vivid hero eyes, prefer `full12` mode so you can craft crisp `Actor1`/`People1:1`-grade eyes).
- `Actor3:0` — Armored helmet/hood base (**caution**: `F` eyes are `1px` narrow dark slits meant for visors/cowls; do **not** use `partedit` on `Actor3:0` if you want open expressive anime eyes — use `full12` instead).
- `Actor3:0@robot` — Special robot mask (`H` includes head skin so head becomes metal dome while `F` eye-slit stays fixed); ideal for **clockwork automatons, golems, steampunk robots** (`back` boilers/gears).
- `Actor1:6` — Long robe base; ideal for **mages, bishops, cultists, scholars**.
- `Actor3:2` — Hooded stealth base; ideal for **assassins, rangers, thieves**.
- `Actor3:3` — Martial gi base; ideal for **monks, brawlers, eastern warriors**.
- `People3:3` / `People3:4` — Noble / butler suit bases.
- `People3:7` — Armored helm soldier base.

### Mode B: `full12` (`src/harnesses/charset-actor/harness.py`)
Starts from any `Actor1~4:<0..7>` or `People1~5:<0..7>` (`out.chr.txt` copied from `base.chr.txt`) and hand-edits all 12 frames directly, verified by `harness.py check --strength strong` + `motion-check` + `views`. Use whenever face/eyewear/silhouette changes outside `partedit` masks are needed:

| Archetype / Feature | Recommended `base` | Why |
|---|---|---|
| **Glasses / Sunglasses / Visor** | `People4:1` | Already has official EasyRPG 3-row eyewear + exposed 2-row peach forehead (`y=14..15`) |
| **Pirate / Captain / Boss / Beard** | `People3:6` | Broad coat shoulders + clean open forehead (`y=13`) + facial hair structure |
| **Wide-Brim Hat / Plague Doctor / Detective** | `People2:0` | Top-hat / brimmed hat + long coat silhouette |
| **Pompadour / Slicked-Back Agent** | `People2:4` | High swept-up hair with clean exposed forehead |
| **Kimono / Shrine Maiden / Eastern Robes** | `People5:3` | Authentic wide sleeves (`kosode`) + pleated `hakama` stride |
| **Witch Hat / Pointed Mage Hat** | `Actor1:5` or `Actor1:7` | Proven wide-brim pointed hat proportions |
| **Braids / Dress / Cleric / Townsperson** | `People1:1`, `People1:3`, `Actor1:1` | Clean flared skirt/dress walk cycle |
| **Spiky-Haired Youth / Streetwear** | `People1:0` or `People1:2` | Compact 2-head-tall casual silhouette |

---

## 2. The 7 Hard-Won EasyRPG RTP Style Laws

1. **Warm Earthy Dark Anchors (Never Cold Gray/Pure Black Walls)**:
   - Official EasyRPG RTP (`Actor1`, `People1~5`) anchors crevices and soles with warm dark reddish-brown (`#290800`, `#1a0c07`, `#64150e`, `#4d2222`) and uses **selective colored outlines (sel-out)** (`#7b0818` on red gloves, `#212591` on navy tunics, `#5a2000` on hair).
   - Wrapping 100% of the sprite in `#000000` makes it look like a flat coloring-book sticker; using cold gray-blue geometric blocks makes it look like modern Pico-8/Stardew indie art.
2. **Value Weight Parity on Grass (`#4c9238`)**:
   - Never pair bright white/silver hair directly with a bright white top — at `24×32` the upper body blows out into a single glowing white blob. Always anchor light hair against a dark/saturated outfit, or dark hair against an ivory/white outfit with a high-contrast inner collar/sash.
3. **One Headgear Layer Max (`Width ≤ 16–18px`)**:
   - Stacking two bulky head items (e.g., backward cap + over-ear headphones) bloats head width past `18px` into a football-helmet silhouette. Keep head width `14–16px` (matching `Actor1`), and place secondary accessories around the **neck/collar** (e.g., neck-slung headphones, scarf, goggles on neck).
4. **Split the Torso into 2–3 Readable Planes**:
   - Within an `8px`-wide torso core (`x=8..15`), break up flat shirts/hoodies using open jacket lapels over an inner shirt, cross-straps, vests, scarves, tie/collar, or belt buckles.
5. **3-Row Eyewear / Mask Grammar**:
   - Sunglasses/glasses at `24×32` require: (a) 1–2 rows of visible peach forehead above the frame, (b) a continuous horizontal brow bar + nose bridge, (c) `3×2` smoked lenses (wider than `1×2` eyes!) with 1–2px subtle diagonal sheen, and (d) a horizontal temple arm reaching the ear in `left`/`right` profiles.
6. **True Left/Right Asymmetry**:
   - Never blindly mirror `right` to `left` when the character has an eyepatch, side-parted hair, shoulder pauldron, hip potion flask, or right-hand weapon.
7. **Zero Dithering / Zero Forbidden Chroma Key**:
   - Shade with solid 3–5 step color clusters lit from top-left (no checkerboard dithering). Keep total colors `≤ 48` and never use RGB within `±8` of `#009392` (RM2000 transparent key).
8. **Unified Hair, Eyebrow & Eye Anatomy (4-Direction Full-Head `face_check_12x.png` Check)**:
   - Hair, eyebrows, and eyes form **one integrated unit** in EasyRPG RTP — never design them in isolation:
     - **Eyebrow / Upper-Lash Color Harmony (No `#000000` Shin-chan Brows!)**: On blonde, chestnut, orange, silver, green, or lavender hair (`Actor4:1`, `Actor2:1`, `Actor2:6`, `Actor4:6`), color the `2px` brow/upper-lash row with the **hair's darkest shade (`hair_dark`, e.g., `#8a5828`/`#997a41`, `#612712`, `#2c223b`)** or `[inner 1px #290800 + outer 1px hair_dark]`. Reserve pure `#000000` `2px` for black hair or deep overhanging bangs/visors.
     - **Bangs, Sidelocks, `1px` Profile Nose & `UP` Back-Hair Clumps**: Never paint hair only inside a `12px` bald skull (swim-cap look) or inflate a smooth textureless sphere (bowling-ball/chestnut look). Use `"hair_ref"` in `doll12` mode (`People1:1` tied/bun, `Actor2:1` bob, `Actor1:0` spiky, `Actor4:1` parted, `Actor4:6` long wave) to sculpt `14–16px` layered clumps divided by dark crevices across `DOWN`, `RIGHT`, `LEFT`, **and `UP`**, keeping cheek-framing sidelocks and the `1px` profile nose protrusion.
     - **`1px` Profile Nose vs `-1px` Tucked Chin & `8px → 6px` Front Jaw Taper**: In `RIGHT`/`LEFT` profiles, **only the single eye-bottom row (`1px` tall) protrudes `+1px` forward as the nose tip**; the chin row immediately below **must step `-1px` back inward** (never extend both nose and chin `2px` tall into a protruding lantern-jaw/snout!). In `DOWN`, taper `8px` cheeks inward by `1px` per side to a `6px` rounded chin over a thin warm `#64150e` shadow rather than leaving `Template`'s thick dark choker line.
     - **4-Direction Hair-Tie `y` Alignment & Ponytail Gravity Drape**: Keep ribbons/ties/hairpins on the same `y` row across all 4 views (respecting 3D left/right side), and let side-profile ponytails/braids curve **downward (`y=9..16`)** toward the shoulders with a `1px` dark crease separating them from the skull (never float them horizontally off `y=6..7`).
     - **Front & Profile Sclera/Iris Symmetry, `2px` Nose Bridge & Rigid `+1px` Head Bob (`check_front_face_and_head_lock` Gate)**: Front `DOWN` (`0·1·2`) eyes are locked to `x=9..14` as `[x=9 sclera | x=10 iris | x=11..12 2px nose | x=13 iris | x=14 sclera]` (`mESSEm` / `WeWWeW` — never `mE..mE` crossed right eye, never `3–4px` squashed nose bridge, never `#ffffff` surgical-mask chin). `DOWN`, `RIGHT`, and `LEFT` eyes must share the exact same `y` row, and `step 0`/`step 2` heads & eyes across all 4 directions must shift rigidly `+1px` down without adding/removing skull rows.

9. **12-Frame Walk Kinematics Laws (Hands, Arms, Belly & Props)**:
   - Official RTP `base.chr.txt` already contains human-authored 12-frame kinematics (`step 0`, `idle 1`, `step 2`). **Never wipe `0` and `2` to invent new limb/belly geometry from scratch** — map new garments onto the base's motion skeleton and inspect `kinematics_check_8x.png`:
     - **Hand Continuity**: Keep `2×2` skin/glove hand clusters visible across all 3 frames in `DOWN` and `UP` (`±1px` swing + shaded back hand; never erase a hand into a sleeve stump or yank one hand `3px` up to the ribcage). In `RIGHT`/`LEFT`, maintain `[back swing → idle hip → front swing]` so the hand never teleports or disappears.
     - **Rigid Side Belly Wall**: In `RIGHT`/`LEFT`, keep the front chest/apron/tunic vertical wall at a constant `x` across `0 · 1 · 2`; only the swinging forearm/hand extends `1–2px` past the front wall on **one** of the two steps (never bulge the belly/apron itself out in `0` and `2`).
     - **Rigid Center Torso Core (`+1px` Bob Only)**: In `DOWN`, `0` and `2` drop the head + central torso (`x=9..14`) down by `+1px` relative to `1`, while buttons, buckles, and vest openings stay centered without diagonal tearing or violent side-to-side writhing between `0` and `2`.
     - **Torso-Locked Props & Active `UP` Arms**: Hip/back props (hammers, quivers, satchels) ride the exact `+1px` torso bob without jumping `2–3px`, and `UP` preserves alternating left/right arm swing rather than freezing `0 == 1 == 2`.

10. **Side-Profile 4-Point Anatomy (`RIGHT` & `LEFT` Clothed RTP Proportions)**:
    - **Ear + Sideburn + Cheek (`C` Zone)**: Preserve `[2px ear (x=9..10) + 1px sideburn (x=11) + 1–2px warm peach cheek (x=12)]` behind both side-eye rows (`x=13` sclera in `RIGHT`, mirrored in `LEFT`) so hair never crushes the face into a cyclops sliver.
    - **Vertical `1×2` Side Sclera/Iris + `+1px` Nose Tip**: Keep sclera and iris vertically aligned on identical `x` columns across both eye rows, with `1px` nose-bridge skin in front of the upper iris and `+1px` nose tip protrusion only on the lower eye row.
    - **`8–10px` Clothed Side Torso Under Chin**: Align the front chest/collar wall (`x=15` `RIGHT` / `x=8` `LEFT`) directly under the chin (`8–10px` adult torso `x=7..15`, `7–8px` child torso `x=8..15`) and keep the idle arm flush with the shoulder/coat back rather than jutting out behind the spine.
    - **`7px` Forward-Toed Boots (`6px` Child)**: Span `x=9..15` (`RIGHT`) / `x=8..14` (`LEFT`) on `y=28..29` so every character has a grounded forward-pointing shoe toe.
