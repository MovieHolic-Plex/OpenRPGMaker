# Attack-only localized repair

Coordinates are zero-based native pixels. This repair addresses the two attack issues in the actual `critique-suite.json`. Before editing, the attached reference, `preview/suite/attack.png`, the light/dark/checker suite sheets, and native windup/move previews were visually inspected.

Only `poses/attack.pxgrid` was changed among existing files. The palette, other eight core poses, all nine existing action/status grids, and existing `AUTHORING.md` / `TIMING.md` were preserved. This separate record follows the focused instruction to preserve those existing documents. No game, repository, ledger, gates, or tests were changed or run. No human approval is claimed.

## Explicit native clusters

The author selected these literal runs individually. `.` means transparency; `w/m/v` are the existing bright steel, silver-blue plane and shaded underside; `o/h/k` are the existing outline, upper-left dark highlight and black material plane.

| Start x | y | Literal run | Purpose |
| --- | --- | --- | --- |
| 57 | 34 | `wwwwww` | Preserved bright upper edge; final point is (62,34). |
| 57 | 35 | `mmmmv.` | Silver face narrows to a shaded step at x61. |
| 57 | 36 | `vvv...` | Shaded underside ends at x59. |
| 57 | 37 | `v.....` | Last full-depth underside pixel at x57. |
| 40 | 39 | `ohko` | Sheath root directly below the preserved lower hand/mouth. |
| 41 | 40 | `ohkko` | Upper diagonal sheath plane and enclosing outline. |
| 42 | 41 | `ohkko` | Continued black body with restrained upper-left highlight. |
| 43 | 42 | `ohkko` | Diagonal continuation clear of the horizontal blade. |
| 44 | 43 | `ohko` | Narrowing lower sheath section. |
| 45 | 44 | `oko` | Black end enclosed by outline. |
| 46 | 45 | `oo` | Closed terminal cap. |

There are 40 changed pixels: 13 in the tip and 27 in the sheath. Actual changes lie within x57–62/y35–37 and x41–47/y39–45, entirely inside the two permitted rectangles. No skin, face, eyes, body, grip or guard pixels were changed. The existing sheath mouth at x41–43/y38 stays connected to the lower hand; the new segment continues below it. The horizontal steel remains connected to the unchanged grip. Transparent x63 remains clear, and no ground or canvas-edge pixel was touched.

`inspection/repair_attack.py` records the literal runs and renders the current grid. Its default invocation only renders; `--apply` writes the listed pixels. The helper performs no geometric drawing, pose synthesis, shading calculation, or whole-character transform. Exact nearest 3× enlargement is used solely for visual inspection.

## Final visual inspection

Inspected `inspection/attack-repair-review.png`: each column shows native 1× above exact nearest 3×, ordered light, dark, checker. Separate native and enlarged PNGs for each background and a transparent native `attack-repaired.png` are also saved in `inspection/`.

The blade now has a straight bright upper edge with a stepped narrowing underside, ending in one bright pixel instead of the four-pixel vertical cap. The extended sheath reads as a distinct diagonal black segment emerging from the support hand, with an outlined black face and a modest highlighted upper-left plane matching the neighboring poses.

Remaining visual limitations: the pale upper steel has low contrast on the light background; the black sheath outline, gat and shoes have low contrast on the dark background. The sheath is foreshortened within the permitted repair area. Those palette and pose constraints remain. Static previews do not establish battle animation timing or transitions. This is a completed focused repair, with no approval inferred from inspection.
