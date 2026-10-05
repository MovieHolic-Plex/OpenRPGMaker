# Windup and move — focused literal weapon repair

Coordinates are zero-based native pixels. Read the current `../critique-suite.json` (suite job `a0485b26-0c88-4f91-8be4-d818dc2e4c42`, finished 2026-10-05 09:44:07 UTC), the attached reference, and the actual suite checker and individual windup/move/recover PNGs before authoring. The reference was studied visually only.

Only existing `poses/windup.pxgrid` and `poses/move.pxgrid` were changed. The palette, repaired attack, remaining sixteen pose/action grids, and existing `AUTHORING.md`, `TIMING.md`, and `REPAIR.md` retain their original bytes. The focused preservation instruction takes precedence over the general instructions to create actions and update those existing documents; all nine action grids already exist. This new record describes the repair and its remaining visual problems.

## Explicit pixel clusters

### Windup: one extraction axis

- Re-authored the front sleeve/cuff at x35–42, y34–39 to meet the raised draw hand at x42–46, y35–38. Warm `p/u/t` finger clusters wrap the dark hilt, which ends at x48 rather than becoming an exposed steel tip.
- Placed the dark `h/o` guard around x43–46, y38–39. The exposed `w/m/v` steel descends leftward from x41–43, y39, through x40–42, y40; x39–41, y41; x38–40, y42; and x37–40, y43. This is the short visible blade section between the raised hilt and sheath mouth, rather than a separate short sword pointing out of a crossing sheath.
- Authored the mouth at x37–38, y44 with the literal `hh` collar. Supporting fingers lie immediately on either side: `pu` at x35–36 and `ut` at x39–40 on that row, followed by the lower `ptp` cluster at x38–40, y45. The supporting sleeve connects back to the waist.
- Replaced the former down-right sheath with a down-left black sheath continuing the exposed steel's axis: `ohkk` body clusters run through x34–38, y46, x33–37, y47, x32–36, y48, x31–35, y49, x30–34, y50, and x29–33, y51. The end narrows through `ohkko` at x28/y52, `oko` at x28/y53 and `oo` at x28/y54. Its restrained `h` plane faces the upper-left light.
- Cleared the former crossing steel and sheath runs in the same local arm/attachment area. This changes 164 pixels, within x28–48, y34–54.

### Move: restored long steel from the existing grip

- Kept the warm fist, sleeve, short sheath, torso and forward stance. The attachment pixel at (43,38) is now `h`; immediately adjacent `wmv` begins at (44,38).
- Authored successive individual `wmmv` blade runs from x45/y37 through x46/y36, x47/y35, x48/y34 and x49/y33–32. The blade continues upward through the free right-hand space with individually specified staircase runs to x59/y19.
- Tapered the upper section to `wmv` at x60/y18–17, `wv` at x61/y16 and one `w` point at (62,15). A bright single cutting edge, silver-blue face and muted spine remain consistent with the existing palette.
- The grip-to-point displacement is approximately 30 native pixels, compared with the former approximately 11px section and idle's approximately 28px blade. This changes 85 pixels, within x43–62, y15–38. No body or stance pixels were shifted.

Every run is literal in `inspection/weapon_repair.py`; the final grids contain full literal ASCII rows. The helper copies only these chosen runs and renders them. There is no shape generation, calculated shading, tracing, resampling of source art, rotation, whole-frame displacement or interpolation. Its default invocation only renders; `--apply` writes the documented runs.

## Source inspection and previews

Read-only comparison of the original and final source showed changes in precisely these two grids. Every changed pixel lies in an authorized rectangle. The protected x0–48/y0–33 area is identical in both frames, as are every row below y55 and the palette and sixteen other grids. Both repaired canvases remain 64 rows of 64 symbols. Ink remains inside x1–62/y1–60, with transparent outer margins and unchanged soles at y60.

Inspected `inspection/weapon-repair-review.png`, showing native 1× and exact nearest 3× on light, dark and checker backgrounds. The idle and unchanged recovery columns provide weapon and anatomy context. Individual native transparent PNGs and background previews are also saved there. The new windup reads as a partially drawn sword with separated draw and support hands; the extended move steel remains attached to the original grip and reads as a long blade.

| Grid | Original SHA-256 | Repaired SHA-256 |
| --- | --- | --- |
| windup | `7bb811fdabc381c5ac987ee62a80d502e375497357294b9aa6d39432bd212d04` | `8dba2787111e8dd7b9f40e7b7056435537e10b1e01941e1d62438833a5241143` |
| move | `e21a2e4603882c9e79664f5cf752be5d2bff5a08c78f1350224010faba797d39` | `ae4c1b658264ce3d06d46ab8f48c29733fde47c645444a544dfbd1ff2ec416fb` |

## Remaining visual problems

- At 1× the supporting fingers and dark mouth remain a small, dense cluster, clearer at 3×. The sheath overlaps the robe because it now follows the actual draw axis.
- The unchanged recovery has a shorter apparent down-right blade section than idle and the repaired move. It was inspected and preserved as requested. The large changes in weapon angle between these sparse key poses remain visible.
- Steel loses contrast on the light background; black gat, sheath and shoes lose contrast on the dark background. The palette is preserved.

No tests, gates, engine playback, game-store or ledger operations were run. All writes were inside `source`. No user approval is claimed.
