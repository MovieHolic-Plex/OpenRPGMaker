# Two original Joseon fantasy enemy candidates

This folder contains artwork for `jangseung-spirit` and `earthen-jar-fiend`.
The figures are original fantasy interpretations inspired by guardian posts
and old storage pottery; they make no precise folklore or history assertion.

## Files

- `sprites/SLUG.png`: 192×192 transparent RGBA sheet, nine native 64×64 cells.
- `portraits/SLUG.png`: unscaled 64×64 `idle_a` cell.
- `source/SLUG/POSE.pxgrid`: literal 64 lines × 64 ASCII symbols.
- `source/SLUG.palette.json`: symbol → opaque RGB mapping; `.` is transparent.
- `source/author.py`: hand drawn native row clusters that expand into the grids.
- `bake.py`: reads saved grids and assigns each output pixel directly.
- `review/idle-lineup.png`: idle checkpoint at 1× and integer nearest 3×.
- `review/SLUG-poses.png`: all nine poses at 1× and integer nearest 3×.
- `review/first-pose-draft/`: viewed first drafts before the correction pass.
- `result.json`: source/sheet hashes, frame boxes, colors and baselines.
- `progress.json`: completion and actual inspection evidence.
- `REVIEW.md`: concrete defects, correction record and remaining limitations.

Pose order is row major:
`idle_a,idle_b,idle_c / windup,move,attack / recover,hit,dead`.
Suggested motion: guardian `stomp`; jar `hop`.

## Reproduce

From this directory:

```bash
python source/author.py
python bake.py
```

The saved grids are authoritative baker inputs. Neither command draws
ellipses, polygons or vector paths, produces random texture, or rescales art.
Review enlargement alone uses integer nearest interpolation. `bake.py`
keeps `complete` only when the previously inspected sheet hashes still match.
A changed sheet returns progress to `nine-poses-baked` until it is inspected.

## Visual references and authorship

The author viewed the current refined dokkaebi/ghost idle comparison, the
original Actor1 24×32 right-facing frame, and the existing shipped forest
battle capture `verify-shots/joseon-enemy-refinement/02-refined-three.png`.
All new sprite pixels are original hand selected ASCII symbols; no reference
sprite was traced or copied. Actor1 appears only as a review size reference.
It is read from the existing refinement reference folder, with its existing
asset provenance and license. The green review swatch is a contrast probe,
not a new forest tile or an actual rendered battle.

The director owns game integration and user selection. These are art files;
the folder contains no database records or public asset registrations.
