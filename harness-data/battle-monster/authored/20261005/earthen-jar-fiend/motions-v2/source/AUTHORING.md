# Earthen jar fiend — additional motion authoring

This is an authored review candidate. No user approval is claimed.

## Scope and method

Added nine complete literal ASCII palette-index canvases in `actions/`.
The existing `palette.json` and all nine files in `poses/` were left
byte-for-byte intact; their SHA-256 values matched the values read before
authoring. No repository, brief, ledger, game store, or other candidate was
written. No tests, gates, installation, or publication were run.

Each action has 64 literal rows of 64 symbols, a transparent border, and
lowest ink at y=60. Coordinates here are zero-based. All colors come from
the existing thirteen-color palette. Blank canvas initialization and
transparent trailing-row formatting were the only automatic source
operations. Silhouettes, lid angles, limb bends, ceramic shading, cracks,
glaze chips, and effect clusters were explicitly authored as pixel rows.
No body was produced by a whole-frame transform or interpolation.

The reference retains a rounded earthen vessel, black cavity, yellow eyes,
short limbs, removable brown lid, upper-left light, and dark right wall.
The additional frames keep those material cues and the foot line. No
weapon was added: the defensive prop is the jar's own lid.

## Explicit frame changes

| Frame | Character and effect changes |
| --- | --- |
| `skill_a` | Lid lifted to y=26–31. Both arms bend upward from the shoulders, with explicit grips at the lid corners. The black cavity opens below the lid; two yellow eyes remain inside it. Left grip pixels at (24,31) and (25,31) and the right grip at (41,31) connect the hands to the lid. |
| `skill_b` | Lid lowered to y=34–39 and seated across the opening. Hands press its sides at y=38–42; eyes and cavity are concealed. Manually stepped pale-gold protective brackets at x=17–21 and x=46–49 wrap the body, with three small glints above the rim. Feet stay planted; this is self-defense. |
| `skill_c` | Lid returns to its resting height, cavity and eyes reopen, arms relax below the shoulders, and only two isolated gold flecks remain at y=52. This recovery has its own eye, arm, rim, and body rows. |
| `poison_a` | Uneven lowered eyelids, sagging rim, drooping short arms, and a red-brown seep at the right mouth corner. Closed toxic bubbles occupy x=19–24/y=22–25 and x=48–52/y=38–42; a smaller left bubble sits below the first. |
| `poison_b` | Lid sinks further, the eye levels and arm folds change, and the crack/glaze clusters are reauthored. The upper-left bubble bursts into isolated flecks; a larger dark red bubble grows at x=48–54/y=27–32 and another appears at x=13–16/y=47–50. No palette tint substitutes for posture. |
| `stun_a` | Lid slips diagonally upward on the right, uneven eyes sit in the exposed cavity, and both arms hang low against a shortened, slumped body. A large authored gold star sits at x=20–28/y=22–27 and a smaller star at x=46–52/y=30–34. |
| `stun_b` | Lid rocks to a different angle while the head opening, shoulders, eyes, arms, and crack bends change explicitly. Large and small stars change positions to the left and upper right, with separately drawn pointed clusters. |
| `sleep_a` | Low, rounded exhale posture, resting lid at y=37–41, two closed eyelid curves at y=42–43, hands resting near the lower body, and fixed feet. Small neutral breath puffs beside the mouth replace any letter-like curl. |
| `sleep_b` | Inhale changes the shoulder width, belly edge, highlight cluster, hand folds, and closed-eye band while keeping feet fixed. A differently shaped breath puff dissipates higher at y=33–37. There are no letters, sleep glyphs, or open yellow eye dots. |

The lower stun torso was explicitly shortened and its lower rows redrawn
to meet y=60. Sleep belly, hand, glaze, and foot rows were similarly
redrawn to keep the rounded low silhouette above that line. These were
local silhouette revisions, not translations of complete frames.

## Visual inspection and remaining problems

All nine frames were viewed at native size and enlarged on checker,
dark, and light backgrounds using in-memory previews. Inspection images
were not written into this source delivery. The final lid grip and breath
puff edits are literal source pixels.

- The locked palette has no green or violet. Poison relies on red-brown
  bubbles, seep, uneven eyes, and sick posture; at native size its bubbles
  may initially read as spoiled contents rather than a generic poison icon.
- Closed eyelids and neutral breath puffs are deliberately small. Their
  contrast is weaker on a light backdrop than the gold stun stars.
- Three skill cels give a stepped lid closure. The 160 ms peak shows the
  sealed opening and protection clearly, but smooth motion has not been
  established by watching a generated GIF or an actual battle.
- The preserved core frames still have their original taller body and
  reddish glaze patch. This action-only pass does not revise that reference.

Timing below documents the existing harness playback contract. No GIF,
runtime integration, independent review verdict, or human choice was
created by this authoring pass.
