# Legacy enemy retirement: humanoids and bosses

Run from the repository root:

```sh
python3 scripts/asset-gen/pixel-enemy/retirement/humanoid/run.py
```

`species.json` preserves the supplied resource identifiers and Korean subject descriptions. `art.py` draws original pixel geometry directly on its final 48, 64 or 96 pixel grid using the existing `Pen`, capped-stroke, and cleanup helpers. No image source, tracing, filtering, downsampling, or bitmap-generated art is used. The imported beast ellipse helper is available for editable geometry; no existing enemy script or helper is modified. Artwork attribution: original OPRN Studio procedural pixel artwork, authored for this replacement batch.

`catalog.json` maps all 27 stable resource IDs to new 3×3 sheets. Each sheet orders `idle_a`, `idle_b`, `idle_c`, `windup`, `move`, `attack`, `recover`, `hit`, `dead`. All living subjects face right. Lit planes and contour highlights are upper left. Grounded feet sit at cell minus four; flying creatures retain intentional clearance above that baseline. Death collapses the geometry onto the baseline.

## Designs and articulation

- Zombie: exposed ribs, torn brown garment, clawing arms; elbows and knees flex separately.
- Orc: pointed ears, tusks, leather studs, double axe; two hands converge on raised/swept weapon goals.
- Goblin: low crouch, hooked nose, short leather torso, spiked club. Ogre: a separate 96px broad giant, large fists, longer limbs, oversized head and club.
- Kobold: projecting reptile muzzle and independently swishing tail; curved pickaxe swings.
- Kappa: plated turtle shell, yellow beak, water dish and individual straw skirt strands.
- Mage: pointed hood, long ragged robe, purple gem staff and magic above its free hand.
- Fallen knight: reclined and bent asymmetrical legs, grounded supporting hand, scratched dark plates, torn cape and feather plume.
- Harpy: female profile and brown hair, leather breast armor, serrated feather wings, articulated bird talons. Imp: red horned head, bat wing membranes, studded wrist bands, lifted leg and brown waistcloth.
- Fallen angel: silver hair, dark armor, large black feather wing, red sword guard; wing joints and leading leg change during sword strike.
- Leaf, lightning and water spirits retain the supplied generic JRPG enemy anatomy. Leaf hood and woody branches, blue/yellow zigzag lower body, and fish fins/tail articulate independently. These are **not** collectible-species starter/front/back sets.
- Salamanders: orange skin with black spotting, four legs, teeth and tail; flame variant has taller dorsal spines. Limbs extend under attack and coil under windup.
- Centaur: copper armored human torso, brown four-legged horse body, swishing horse tail and long spear. Spear thrust and equine strides articulate separately.
- Griffin: white eagle brow and beak, feather wings, lion quarters and tufted tail; wing/tail/legs flex. Roc: brown raptor and golden neck ruff, paired grasping talons. Phoenix: orange-red feathers, flaming crown and multiple long flame tail streamers.
- Whelp: small compact gold body, short neck and small wings. Cliff dragon: horizontal yellow-green body, extended muzzle, four legs as the metadata requests. Red dragon: deep bulky torso, tall neck, large horns. Blue dragon: long bent serpentine neck, thin body, swept wing and blue plates. Gray dragon: heavy pale overlapping scale plates and broad torso, **not** skeletal anatomy.
- Each dragon has independently flexing neck, jaw, wing rays, tail and four clawed limbs; smoke is opaque palette geometry (pale green, purple or white by subject).
- Hydra: three separate horned heads on separate jointed neck paths, dark green scales and ochre belly; head phases differ, and all three survive in the collapsed pose.
- Behemoth: dark brown shaggy quadruped, large horns, dorsal spikes, broad clawed feet; jaw gape and limb stance change independently.

## Review and limits

`verify-shots/legacy-monsters/humanoid/` contains every species' full 2× nine-pose board and 2× animation GIF, three complete pose contact boards, idle contact board, validation and reviewed hash manifests. Numerical checks cover cell bounds, 9 unique frames, ≤16 opaque colors, binary alpha, lossless PNG reload, and each decoded GIF frame plus exact timing (4,380ms). Every pose was visually inspected; clipping in weapons, wing tips and feet was corrected before the final review.

Profiles deliberately overlap near/far limbs and wings, as side-view pixel art does. Idle motion is controlled joint motion rather than broad action. Small elemental death poses dissipate into leaves/sparks/water instead of preserving limbs. No collection/front/back sprite or species harness work is included. Runtime resolver and legacy asset retirement integration belong to the parent batch.
