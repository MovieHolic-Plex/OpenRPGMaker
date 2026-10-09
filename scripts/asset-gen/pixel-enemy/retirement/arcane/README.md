# ARCANE legacy enemy replacement art

Original editable final-grid art for 38 starter resources plus the additional
`generated-enemy-spirit-earth` corrected resource. Resource IDs are retained in
`catalog.json`; integration/resolution/deletion is owned by the parent batch.

## Rebuild

From the repository root:

```sh
python3 scripts/asset-gen/pixel-enemy/retirement/arcane/run.py
```

Python 3 and Pillow only. `species.json` preserves the approved subject/name
metadata. `run.py` routes each species to its editable family module. All lines,
polygons, scan-converted ellipses, joint paths and shading are drawn directly on
the 48px or 64px cell. Only evidence is enlarged using nearest neighbor.
No painted images, generated rasters, traced art or downloaded assets are read.
Existing `pe_lib.Pen`, `pe_rig.cap/clean` and `beast_lib.blob/tube/bez/settle`
provide native-grid geometry and palette primitives and are not changed.

## Shapes and articulation

| Module | Subjects | Silhouette and pose decisions |
| --- | --- | --- |
| `slimes.py` | Blue/green/silver jelly, two crowned kings, cube, black mottled ooze, acid ooze | Native squash/stretch outlines; royal crowns retain red gem settings; metal uses broad reflective facets; cube retains three visible planes and changes width/height; black patches and acid lobes belong to the body. Windup compresses, move stretches, attack opens the mouth, recover uses a separate volume and dead settles into a puddle. |
| `spirits.py` | Eight ghosts/wraiths, two cloud sylphs, water undine | Right-facing skull/face and separately bending hands. White/pink ghost has a ragged broad tail; grey specter has pointed ears; wraith has dark flowing hair; banshee has hair and torn dress; wind/light/dark spirits have spread arms, high plume and split shadow tail respectively. Sylphs have lobed cloud hoods and air curls; undine has wave hair, green eyes and a crest tail. Windup lifts the front arm, attack extends the elbow, hit folds it back, dead dissolves. |
| `figures.py` | Rust sword skeletons, armored revenant, two ghouls, quadruped bone crawler | Exposed rib strips around negative spaces and a narrow spine. Floating skeleton-bone intentionally has no legs. Revenant has rusted iron shoulders/greaves, purple cloth, red eye and green blade. Ghouls show green eyes, exposed ribs and torn clothing. Crawler has four hinged legs, rib loops and a cracked forward skull. Weapons, knees, arms and jaw positions differ; dead is a collapsed bone/cloth pile. |
| `creatures.py` | Red-brown four-winged hornet, gem fox, carnivorous plant, blue S-coiled sea dragon | Hornet has three pairs of legs, four pale wing fans, striped abdomen and mandibles. Fox has four legs, cream muzzle/tail tip and red forehead diamond. Plant has thorny bent stalk, a smaller yellow-eyed stalk face, independently opening toothed jaws and slime strands. Sea dragon has a continuous S coil, rose dorsal fins, scales and opening jaw. Tail/leg/wing/stem/jaw geometry is pose-authored. |
| `objects.py` | Rune polyhedron, pumpkin, three rock golems, flying sword, scarecrow, puppet, totem, earth spirit | Dark faceted rune shards orbit a cyan/pink core. Pumpkin has carved eyes/grin and a visible wax/flame cluster. Golem feet remain planted while jointed fists raise/slam; stone/clay/crystal have moss seams, additional rock nodes and purple patches. Sword is redrawn with native vertices at nine angles and keeps golden blade runes and guard eyes. Scarecrow keeps stake, straw, patched hat, button eye, stitches and rust scythe; puppet keeps four strings, hinged wood, cracked mask, jester cloth and anatomical left-hand dagger. Totem rocks its three carved faces independently and moves its vine joints. Earth spirit has separated hovering brown joints, moss, root bridges and orange eyes. Each death is a collapsed geometry. |

## Outputs and evidence

- 39 transparent RGBA PNG sheets at `public/assets/generated/pixel-enemies/`.
- 3x3 pose order: idle_a/b/c, windup/move/attack, recover/hit/dead.
- Maximum observed opaque palette: 14 colors; binary alpha 0/255 only.
- Grounded baseline: cell minus 4; airborne species preserve whole-cell hover placement.
- `verify-shots/legacy-monsters/arcane/idle-contact.png`: every idle, same exact 2x scale.
- `pose-review-01.png` through `pose-review-07.png`: every species and every pose at 2x.
- Individual `*-poses.png` and losslessly decoded `*-cycle.gif` for detailed inspection.
- `validation.json`: bounds, palette, alpha, PNG/GIF reload and frame hashes.
- `reviewed-species.json`: final sheet hashes actually inspected on the seven boards.

The automated frame check compares both the full cell and the cropped occupied
bounds. All nine frames differ in both comparisons, preventing translation-only
duplicates. Hash distinction is accompanied by visual inspection of all boards.

## Attribution and limits

All new coordinates, silhouettes, details and poses are original for this
repository, authored from the approved fictional enemy metadata. Shared drawing
primitives come from the repository's own editable pixel-enemy toolchain. No
third-party visual asset is included; the output follows the repository's asset
licensing terms.

Idle is deliberately restrained for RM2003-sized enemies; it is a breathing,
wing/limb/tail or joint cycle, not a full walk loop. The pale wings and jelly
reflections suggest translucency with opaque palette clusters while retaining
binary alpha. The rune stone and flying sword have orbital/rotation poses in
place of biological joints. Ghost relatives share skeletal anatomy but use
species-specific tail, ear, hair, dress, arm, plume or wave structures. This
batch supplies source and sheets; the parent handles runtime comparison and
resolver integration. No project SQLite data was written and no repository
suite, typecheck or gates were run in this worktree.
