# idle_a eye repair

Scope: five explicitly authored ASCII palette cells in the existing idle_a.
Coordinates are zero-based, with x increasing right and y increasing down.
The permitted rectangle is [27,16,34,21]; its right and bottom bounds are exclusive.

Reference study: the original sprite preview includes the native 1x sprite and
its enlarged view; own-original-face-8x.png shows the original face at nearest
8x. The original dark eyes and warm dark bridge pixel read as a joined socket.
The face outline, nose, jaw, hair, robe, hands and sword are retained.

## Exact changed row fragments

Each fragment covers x=27 through x=33 inclusive in poses/idle_a.pxgrid.

| Pose | y | Before | After |
| --- | --- | --- | --- |
| idle_a | 17 | `sSLLLLL` | `sSLSLLS` |
| idle_a | 18 | `sSLEsEL` | `sSLELWE` |

## Explicit cell decisions

| Coordinate (x,y) | Before | After | Purpose |
| --- | --- | --- | --- |
| (30,17) | L | S | Subtle warm upper lid directly above the far pupil. |
| (33,17) | L | S | Matching warm upper lid directly above the near pupil. |
| (31,18) | s | L | Clear skin-colored separation over the existing nose. |
| (32,18) | E | W | One light sclera pixel on the left of the near pupil. |
| (33,18) | L | E | Single near pupil at the forward/right end of that eye. |

The far pupil remains E at (30,18). Both pupils share y=18. The far eye
uses one dark pixel; the near eye uses W,E from left to right. Its rightward
pupil and the compact far pupil are intended to read as a shared forward/right
gaze. Each lid touches its pupil, with a light skin gap between the eyes.
The nose shading at (31,19) is unchanged.

## Preservation and remaining limits

Only the five cells listed above were patched in the existing grid; its other
bytes, all other existing poses, and palette.json were left untouched.
No TIMING.md was edited or created. No previews, references, poses or palette
colors were created. No generated images, tracing, rasterized shapes,
resampling, frame transformations or synthesized shading were used.

The tiny face limits expression and gaze precision. The far eye has no separate
sclera; the near eye has one light pixel, which may still read strongly at 1x.
The upper lids use existing skin tone S to avoid a heavy dark brow. Their
subtlety and the differing near/far eye widths still require user visual review.
This repair covers idle_a only; no animation or closed-eye states were authored.
The unchanged robe, anatomy, hands and weapon may retain earlier visual issues.

No tests or gates were run. No edited preview was rendered, and no in-game
battle verification or user approval is claimed.
