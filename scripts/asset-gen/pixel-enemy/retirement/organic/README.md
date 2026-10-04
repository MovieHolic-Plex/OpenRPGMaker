# Original organic enemy replacement sheets

34 original JRPG sheets, including the two additional leaf-fox/fire-pup resources identified in the final retirement audit. This is general enemy art, not monster-collection front/back species art.

## Rebuild and contract

Run `python3 scripts/asset-gen/pixel-enemy/retirement/organic/run.py` from the repository. Python 3 + Pillow suffice. No network, painted image input, project store, or database is used. `species.json` preserves the existing resource IDs, Korean names, and descriptions as the drawing brief. The `oldPath` field is a provenance pointer only; generation never reads these images.

`draw.py` contains editable silhouettes, palettes, joint positions, leaf/flame shapes, horns, teeth, and surface marks. It reuses the repository's `Pen`, ellipse lighting, stroke, curve, and whole-pixel placement helpers without modifying those helpers. Every point is drawn on the final 64px cell. Sheets are 192×192 transparent RGBA, ordered:

| Row | Left | Middle | Right |
|---|---|---|---|
| 1 | idle_a | idle_b | idle_c |
| 2 | windup | move | attack |
| 3 | recover | hit | dead |

Every subject faces right. Lighting falls from upper left. Grounded feet/collapsed bodies touch row 60; airborne cells have clearance. `settle` only shifts complete final-grid frames to the floor, and does not resample. A pre-placement assertion catches source geometry touching the cell edge before a shift can hide clipped art. The palette validator measures actual opaque colors, not just dictionary entries.

## Shape and articulation inventory

Related species share anatomical rigs and change proportions/features; unrelated families have separate drawing functions.

| Species | Identifying geometry and material | Pose changes |
|---|---|---|
| crab-01 | Angular cracked stone carapace, green moss, yellow stalked eyes, two unequal pincers, eight walking legs | Pincer opening/height, leg stride, shell stance; belly-up collapse |
| spider-01 | Low purple spined abdomen, green dorsal patch, multiple red eyes, eight legs, paired fangs | Knee/foot geometry, raised forelegs, fang gap; curled legs in death |
| spider-widow | Taller dark abdomen, red hourglass patch, spines, red eye cluster, eight legs | Eight-leg rig with attack/recoil and curled collapse |
| scorpion-01 | Ochre spotted plates, eight legs, six linked tail joints and terminal sting, paired pincers | Tail arch/uncoil, pincer gape, leg stance; tail falls beside body |
| centipede-01 | Connected purple plates, 22 orange legs, red head eye, antennae, mandibles | Coil deforms at each segment, alternating feet, mandible gape; straight folded death |
| centipede-fire | More open C coil, purple spined plates and orange joints | Recover coil flex and extended bite differ from first centipede |
| ant-soldier | Red three-section body, pinched thorax, six legs, antennae, two pale mandibles | Mandibles open, front-leg reach, stride; overturned folded legs |
| beetle-horn | Blue/purple elytra seam, six legs, separate head and prothorax horns | Horn/thorax tilt, stance, walking legs; overturned shell |
| mantis-01 | Green tapered abdomen, long prothorax, triangular head, compound eyes, two serrated scythes and four walking legs | Two elbows/scythe tips have independent guard, raised windup, extension and recoil |
| wolf-01 | Narrow gray torso, long muzzle, cream ruff, pointed ears, thick tail | Four knees/feet, jaw, head and tail change; side fall |
| wolf-dire | Longer dark torso, low tail, purple eyes | Wider low lunge and crouch, bite, recoil |
| horse-01 | Tall legs and neck, brown mane, metal brow/neck armor, saddle and strap | Lifted foreleg, trot, rear/lunge, jaw; folded side fall |
| unicorn-01 | White slender horse, flowing pale mane/tail, long striped horn | Paired forelegs raised at rest, stride and lunge; horn remains on side fall |
| cat-01 | Short muzzle, orange stripes, raised tail, studded collar and front bracers | Four legs, tail curl, jaw, crouch/lunge |
| cat-shadow | Longer purple striped torso, curled raised tail, collar and bracers | Longer stride than orange cat, crouch and extended bite |
| tiger-saber | Broad orange striped torso, shoulder plate with scratch, two large hanging saber teeth | Heavy forelegs, open bite, low crouch and long lunge |
| rat-giant | Small rounded ears, bare pink tail, short legs, brown fur and red eyes | Lifted forepaws, leap stride, open jaw, lowered hit |
| goat-mountain | Compact brown torso, two curved horns, dark beard, cloven hoof shape | Lifted/collected forelegs, hoof stride, low head thrust |
| deer-forest | Thin tall legs, branching cream antlers with green moss and glowing rune strokes | Lifted foreleg, stride, bowed head, antlers follow head |
| cockatrice-01 | Red comb/wattle, brown scaled torso, hooked long tail, two clawed bird legs | One leg raised, alternate step, beak gape, tail bend |
| bat-cave | Brown fur, two ears, broad dark wing membranes and finger rays | Asymmetric up/down wing joints, open fang bite, tucked feet; folded wing collapse |
| moth-dust | Four scalloped brown wing lobes with spirals, fuzzy antennae, large black compound eye | Wing flare/fold changes all four lobes, antennae and feet shift; folded collapse |
| bird-hawk | Brown/cream feathered torso, feather rays and stepped primaries, yellow hooked beak and talons | Wing flap, raised/folded talons, dive stance; folded wings in death |
| snake-01 | Green/brown hood, visible coil/negative space, right muzzle and fangs | Hood/neck lean, coil flex, jaw gape/tongue, forward bite; flattened body |
| parasite-01 | Red/apricot segmented body, circular toothed mouth, six fleshy tentacles | Every segment centre and tentacle curve flexes with stance and bite |
| worm-sand | Brown armored segment plates, dorsal spikes and four thin mouth tentacles | Segment coil, spikes follow segments, mouth tentacle spread; straight collapse |
| fish-01 | Blue scale marks, orange belly/fins, fork tail, toothed mouth | Tail joint, side fin angle, jaw opening, banking stance; flattened side death |
| fish-piranha | Blue back with larger orange face and bulkier toothed head | Fin/tail and pronounced wide jaw bite |
| shark-land | Long blue/cream shark profile, dorsal fin/gills, four scaled clawed legs | Four leg strides, side fin, tail, jaw; collapsed side geometry |
| eel-electric | Long blue S-coil, yellow zigzag bands and lightning forks, fanged muzzle | Full body curve flexes, bands follow samples, jaw opens, lightning shifts; flattened body |
| squid-deep | Pointed purple mantle, turquoise spots, fins, yellow eye, beak and ten sucker-marked arms | Ten independently curved arms gather/thrust, beak opens, mantle breathes; mantle/arms lie horizontally |
| ape-stone | Broad faceted stone chest, orange fissures, green moss, long knuckle arms and squat legs | Fist raised, punch extended, knees bend, recoil and side collapse |
| leaf-fox | Lean green/cream fox, tapered leaf ears/tail, leaf collar and body sprouts | Forepaw lift, four-legged leap, leaf/tail sway, jaw, bowed recoil |
| fire-pup | Small round orange puppy, floppy ears, curled tail, paired cheek flames and tail flame | Forepaw lift, bark jaw, short stride/lunge, flames flicker, tail remains curled |

## Evidence and review

`verify-shots/legacy-monsters/organic/idle-contact.png` shows every idle silhouette. `all-poses-1.png` through `all-poses-5.png` show all 306 cells at exact 2× nearest scale. Per-species pose boards and 2× animated cycles are also saved there.

`validation.json` records RGBA/bounds, source-geometry margin assertions, baseline, 6–13 actual colors, all nine frame hashes, minimum pair pixel difference, lossless PNG reload and exact animated GIF pixel/timing reload. The final drawings have no duplicate cells; the smallest pair difference is 189 pixels. Related variants still visibly share an anatomical family; the validation does not claim all unrelated creatures have unique rigs.

`reviewed-species.json` records the reviewed PNG and board hashes. Every final species row, including every pose, was opened and visually inspected. Review corrections included connected centipede plates, stronger separation of far insect legs, feather-shaped hawk primaries, horn/mantle top clearance, and stroke margins at cell edges. The manifest is a recorded review snapshot, deliberately not silently renewed by generation.

## Attribution and limits

New geometry and pixel marks are original art authored for this repository. No painted monster pixels, generated bitmap tracing, source resizing, filtering, or third-party sprite extraction are included. Existing repository helper code remains under the repository's license. Names/descriptions/resource IDs are existing project metadata.

These 64px side-profile enemies intentionally simplify scale texture, suckers, eyes, teeth and individual feather barbs to pixel clusters. Far-side limbs can partially overlap at rest; strides and attacks separate them. The nine poses are key poses, not a continuous interpolated animation. Leaf fox/fire pup are generic JRPG resources and do not edit collection species defaults. Runtime comparison, resolver integration and retirement deletion are owned by the coordinating change, not this batch.
