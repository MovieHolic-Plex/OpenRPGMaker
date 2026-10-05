# Guardian post and earthen jar — artwork review

Status: **18 poses baked and visually inspected; candidates for director review**.
This is a bounded art delivery, not an integration or user approval record.

## Construction and measured contract

Each sprite is a native 192×192 RGBA sheet with nine 64×64 cells, ordered
`idle_a,idle_b,idle_c / windup,move,attack / recover,hit,dead`.
Portraits are the exact unscaled idle cells. Source grids are literal 64×64
ASCII; the baker assigns each symbol's RGBA value directly. The PNGs use
only alpha 0 and 255, have transparent cell borders, and use at most 18
opaque colors. All occupied cells end at y60, including all six idle frames.

| Candidate | Idle occupied box | Sheet opaque colors | Unique native frames | Motion |
|---|---|---:|---:|---|
| jangseung-spirit | 24×46, `(21,15)-(45,61)` exclusive | 14 | 9 | stomp |
| earthen-jar-fiend | 33×31, `(17,30)-(50,61)` exclusive | 12 | 9 | hop |

Exact per-frame boxes and SHA256 hashes are in `result.json`. Attack reaches
extend beyond the idle widths; the native cells themselves remain 64×64.

## Drawn pose differences

| Pose | Guardian post | Earthen jar |
|---|---|---|
| idle_a | Crooked cut crown, projecting near nose, branch arms, rope and splayed roots | Open dark rim, unequal eye glints, raised short arms, red cloth accent |
| idle_b | Near branch lifts; brow and curled root toe change | Far elbow drops; near arm remains raised; near toe folds |
| idle_c | Far branch lifts, near branch lowers, carved jaw opens | Far eye squints; near elbow drops toward the body |
| windup | Crown and upper trunk twist back; elbow folds; front root curls | Lid seals, eyes narrow below the rim, body squashes, elbows tuck |
| move | Back root lifts, front root extends, branches counterbalance | Lid/rim tilt, body leans, arms oppose, front clay toe extends |
| attack | Head leans right and near branch extends into a blunt wooden fist | Mouth opens tall above a broad lower jaw lid; near arm punches right |
| recover | Upper trunk remains forward, branches sag, roots flatten | Lid settles unevenly and open arm tips hang down |
| hit | Crown recoils left, arms fling up, a dark/light fracture opens | Lid hinges away, body recoils left, ceramic cracks spread |
| dead | Broken face timber and rope-bound stump become separate masses | Pot flattens into a collapsed rim/body, with a separate tipped lid |

These poses contain newly drawn native rows and limb/root/rim silhouettes.
They are not whole-sprite offsets, tint variants, or resized copies.

## Actual inspection and fixes

1. Read the current art contract and refinement review. Viewed the refined
   dokkaebi/ghost comparison and the Actor1 original 24×32 reference.
2. Baked both idle candidates first. Saved `phase: idle-ready` in
   `progress.json` before authoring the remaining eight poses. Opened the
   1×/3× `review/idle-lineup.png` with `view_image` and reported the checkpoint.
3. Viewed the existing shipped forest capture to judge the muted warm colors
   against its greens and ochre ground. The review green swatch is only a
   contrast probe; it is not runtime evidence for these new enemies.
4. Viewed both first pose contact sheets and both transparent sprite sheets.
   Preserved the first contact sheets under `review/first-pose-draft/`.
5. **Specific defects found:** equal jar eye glints made the idle look frontal;
   the guardian trunk had overly uninterrupted vertical planes. Reduced the
   far jar glint and extended its near lip; added short, deliberately placed
   bark cuts to the guardian's existing gray-brown/red-brown planes.
6. The jar's first raised attack lip read like a small beak or third branch.
   Redrew it as a broad horizontal ceramic lower jaw with a thick shaded
   underside, retaining the squat pottery body and distinct punching arm.
7. Viewed the corrected idle lineup, both corrected contact sheets and the
   final transparent 192×192 sheets. Reopened the jar contact sheet and PNG
   after the lower jaw correction. Completion in `progress.json` is bound
   to these inspected PNG hashes.

## Concrete remaining limitations

- **Guardian:** the cheek/nose establishes the right-facing turn more clearly
  than the brow. The long central cut still dominates the trunk at 1×. Hit and
  windup share a backward crown lean; their branch and fracture differences
  need suitable playback timing. Defeat leaves the face chunk partially
  upright rather than showing an intermediate falling frame.
- **Jar:** right-facing idle direction is shallower than the guardian's;
  the near lip, unequal glints and raised near arm carry that cue. The enlarged
  attack cavity is deliberately dark and can read as a short black neck.
  The lower jaw is broad after correction, but its contact timing remains
  unjudged. The small cloth accent and dark stub toes are less clear at 1×.
- Both pose sets share the brief's y60 baseline. The jar move drawing has a
  stepped foot contact; the actual hop elevation is the integration motion's
  job. These sheets have not been played in a battle or assessed for contact
  alignment, hit timing, runtime scale, or final ground contrast.

## Handoff

The two `sprites/*.png` and two `portraits/*.png` files are ready for director
integration review. Source, palette, baker and measurements accompany them.
No IDs, stats, actions, actor/tile assets, game project, public registration,
SQLite or remote database was changed. Root owns integration and selection.
