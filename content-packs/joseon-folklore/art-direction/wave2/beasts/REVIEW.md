# Wave 2 beasts — original native64 art handoff

Three original generic RM2003 enemy candidates, authored in this isolated
worktree on 2026-10-05. These are file art for root to review and integrate.
No user visual approval is claimed. No game records, data IDs, actions, stats,
tiles, actors, live storage, registration or deployment were changed.

## Files and geometry

| Slug | Sheet | Idle occupied bounds, inclusive | Idle occupied size | Opaque colors across entire sheet | Suggested motion |
|---|---|---|---|---|---|
| wild-boar | `sprites/wild-boar.png` | x6–57, y26–60 | 52×35 | 13 | dash |
| venom-toad | `sprites/venom-toad.png` | x16–50, y35–60 | 35×26 | 14 | shoot |
| mortar-rabbit | `sprites/mortar-rabbit.png` | x21–47, y16–60 | 27×45 | 14 | hop |

All sheets are **192×192 transparent RGBA**, 3×3 cells of **64×64**. Order:

```
idle_a   idle_b   idle_c
windup   move     attack
recover  hit      dead
```

All face right. Grounded idle frames reach y60; no pose extends below y60.
The toad hop occupies y30–54, deliberately clear of the ground. Each cell has
at least one transparent pixel around every image edge (the actual minimum
horizontal clearance is six pixels). Every alpha value is 0 or 255. Each
species has nine different full-frame pixel hashes. These facts are checked
in the PNG baker and recorded in `review/geometry.json`.

`portraits/<slug>.png` is a native 64×64 exact copy of `idle_a`, including its
transparent padding. The saved portraits were compared to the corresponding
sheet crop by pixel bytes.

## Checkpoint

All three `idle_a` grids were authored and baked together **before** the
action source was created. `bake.py --idle` saved `review/idle-lineup.png`
(neutral gray checker, native 1× and nearest 3×) and then wrote
`progress.json` with `phase: "idle-ready"`. The current progress file is
`phase: "complete"`, with all finished sprite, portrait and review paths.
The lineup now reflects the final idle anatomy and hand corrections.

## Native authorship and reproducibility

- `source/<slug>/<pose>.pxgrid`: exactly 64 literal ASCII rows of 64 symbols.
- `source/<slug>.palette.json`: character-to-opaque-RGB palette. `.` is
  transparent `(0,0,0,0)` and is defined by the baker.
- `source/author.py`: original literal idle anatomy row clusters, palette
  definitions and the explicit correction to the boar chest/tusk/forelegs.
- `source/actions.py`: explicit native cluster replacements for all remaining
  poses. Whole sprites are never translated, rotated or resized to make poses.
- `bake.py`: assigns each ASCII symbol directly to one RGBA pixel, packs
  unchanged 64×64 cells and saves review images. Pillow text labels and neutral
  checker backgrounds are exclusively on review canvases. Integer nearest
  enlargement is exclusively for review.

From the repository root, bake the committed full grids directly:

```bash
python content-packs/joseon-folklore/art-direction/wave2/beasts/bake.py
```

To reproduce the grids from the literal authorship clusters and replay the
checkpoint sequence, from this folder:

```bash
python source/author.py
python bake.py --idle
python source/actions.py
python bake.py
```

Requires Python 3 and Pillow. Regeneration writes only within this folder.
There are no downloaded/borrowed animal pixels, generated images, vector
assets, ellipse/polygon primitives, random texture, large source art,
downsampling or source-art resampling. The existing boar was viewed as a
critique reference; its pixels were not used in the new candidate.

## Actual visual review and resulting corrections

The author opened the existing `monsters/assets/wild-boar.png`, then the baked
idle lineup, all three 1×/3× pose boards, and all three actual transparent
192×192 sprite sheets using `view_image`. The final rabbit sheet and its
updated pose board were opened again after the final grip/tool corrections.
This is author inspection, not director/user approval or runtime QA.

### Wild boar

The rejected reference's high outline and repeated diagonal fur bands read
as a piled rock/pinecone rather than a low four-legged animal. The new body
is long and low, with a separate left haunch, a modest shoulder rise, two
small ears, a thick tapered right muzzle, a white upward tusk and four short
legs ending in split dark hooves. The main torso is approximately x8–45,
y28–51; tail, ears, muzzle and hooves enlarge the overall occupied bounds.
Slate shadows and umber planes contain only three warm bristle accents.

The first idle bake had an isolated-looking foreleg; the chest was redrawn
down to the leg roots. The running far hind leg was later extended up to
its actual hip. Windup bends the knees and drops the snout; move pushes the
rear legs back and extends a foreleg; attack opens the mouth and spreads
the stance; hit folds the ears and buckles the knee; dead uses an independently
drawn side-collapse silhouette.

**Remaining concrete defects:** the far hind hoof and far front hoof have
only a one-pixel split and low contrast against dark backgrounds. The three
idle silhouettes have small ear/snout/leg differences that may be subtle at
1×. The closed-to-open muzzle transition between move and attack is abrupt;
there are only the requested nine frames, no extra tween frames.

### Venom toad

Earthy olive back, ochre chin and thighs, a broad mouth seam, one large near
eye, angular folded hind thigh, flattened fingers and two coherent dark wart
clusters. Windup visibly expands the cheek/gular sac; hop has a new lifted
body, tucked hind limbs and stretched front arms; attack opens a dark oral
cavity while remaining at home; hit compresses the body; dead flattens it
sideways. There are **no detached projectile pixels**. Suggested motion is
`shoot`; spit should be a separate runtime effect supplied by integration.

**Remaining concrete defects:** each wart cluster is a blocky 2×2 patch, so
it can read as a square mark at 3×. The enlarged throat in windup uses a large
simple ochre plane with limited internal volume shading. The dead silhouette's
rear toes overlap its flattened flank and are less individually readable.

### Mortar rabbit

Gray/cream biped with two distinct long ears, a muted red neck cloth and
a short wooden rice-pounding log/pestle. The log has an end face and grain
seam; it has no separate oversized hammer head. Windup raises the log and
changes both arms/grips; hop bends one ear and changes the stride; attack
crouches forward with the log down/right; recovery holds it low across the
body; hit bends ears and knees; dead slumps with the log loose on the ground.

During inspection the windup's lower hand failed to reach the short log;
both hand positions and the raised log height were corrected. A leftover
vertical log fragment in move was removed so it does not form a hammer-like
second head. The final sheet was inspected after these changes.

**Remaining concrete defects:** the two raised grip clusters still meet through
their dark outlines at 1×, so their separation is clearest at 3×. The diagonal
pestle in attack has visible stair steps and a small simplified end face.
The dead pose's two ears overlap substantially, though their tips remain
distinct. The folklore clothing is an original simplified fantasy cue,
not a historically precise Joseon costume reconstruction.

## Review surfaces and scope

`review/idle-lineup.png` compares all three idles on neutral checker at 1×/3×.
`review/<slug>-poses.png` shows every pose at 1×/3× with sufficient bottom
padding to see the entire y60 contact line. These are standalone art previews.
The existing game, backgrounds, animation timing and contact effects were
not run or visually approved here. Root owns selection and integration.

No gates, Vitest, typecheck, stash, PR or push commands were run.
