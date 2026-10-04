# Refined Joseon folklore enemies — user steering artwork

Status: **refined-candidate-awaiting-user-steering**. The preferred candidate proportions and palettes remain the basis. The director owns integration and actual battle capture.

## Deliverables and construction

- Three 192×192 transparent RGBA sheets under `sprites/`, with nine native 64×64 frames in row-major order: `idle_a,idle_b,idle_c / windup,move,attack / recover,hit,dead`.
- Three 64×64 transparent `idle_a` portraits under `portraits/`.
- All 27 expanded 64-line ASCII grids and the unchanged symbol palettes under `source/SLUG/`.
- `source/author.py` preserves explicit native cluster selections, offsets, replacement rows, and the contact-sheet correction pass. There are no rescale, shear, polygon, ellipse, or random texture operations.
- `bake.py` reads the saved grids and assigns every native pixel directly through Pillow pixel access. Only review images are enlarged, with integer nearest-neighbor 3× scaling.
- `review/idle-comparison.png` compares the user's preferred idle with this refinement at 1× and 3×. The three pose contact sheets show every frame at 1× and 3×, alongside the original Actor1 24×32 reference.

## What changed

**Boar:** highlight stripes are interrupted with midtone clusters, the far haunch has a distinct contour, and the tusk is a larger light cluster against the muzzle. Idle shoulder motion keeps the feet fixed. Charge frames lower the shoulder/head; running and attack legs are newly drawn; recovery and hit crouch; defeat uses a newly drawn flat fur silhouette and the original-sized head cluster.

**Dokkaebi:** far cheek and brow separation strengthen the rightward turn; straw shoulder marks become uneven hanging bundles rather than a repeated diagonal weave. Idle head/coat/club motion retains the foot baseline. Windup raises the club above the head, move steps outward, attack extends the arm and club horizontally, recover and hit lower the club, and defeat slumps with a dropped club.

**Ghost:** small transparent gaps separate fingers, the right fabric shadow is lighter and less continuous, and highlights break the repeating skirt folds. Sleeves and hair move in the idle frames while the foot tips remain fixed. Windup gathers the hands, move trails the skirt left, attack reaches right with both sleeves, recovery lowers the arms, hit throws the sleeves back, and defeat is a newly authored small muted silhouette. Defeat uses fewer opaque pixels and muted existing colors; it does not use a smooth alpha fade or sprite scaling.

## Actual visual review and correction

Viewed the preferred old comparison sheet first, then the early new idle PNG. Viewed each first pose contact sheet and saved those under `review/first-pose-draft/`.

One contact-sheet correction pass repaired torn boar shoulder joins, reconnected the dokkaebi move-frame club shaft to its hand, and blended unintended ghost waist seams. The ghost's attack arms were redrawn shorter to reduce rightward displacement. Viewed the corrected contact sheets and actual transparent 192×192 sprite PNGs; viewed the final ghost contact sheet again after shortening the reach.

## Specific remaining limitations

- **Boar:** fur still contains some broad sculpted bands. The far running leg is narrower and darker than the near legs; it may merge at small render sizes. Windup, recovery, and hit mainly differ by crouch/head position, so playback timing must help distinguish their intent.
- **Dokkaebi:** the face turn is still shallow. Some straw marks remain diagonal, and the coat still reads partly as a thick shoulder cape. The attack club has a small head; it may need stronger material contrast against the actual battle ground. The club's apparent length changes with the staged poses; the raised windup is the longest projection.
- **Ghost:** gathered/reaching hands and overlapping sleeves are difficult to separate at 1×. A dark horizontal edge under the folded sleeves remains, and the skirt retains a dominant left highlight fold. Defeat is a condensed silhouette rather than a physically continuous collapse; transition timing needs director review.
- Breathing changes are deliberately subtle. The 9-frame sheets are a pose set, not a tested continuous animation cycle.
- Extended weapons/sleeves move the occupied bounding-box center away from the torso center. The torso remains near x32; the manifest records each occupied bounding box and center honestly.
- No final rendered battle, playback speed, contact alignment, or ground contrast has been judged here. These are artwork proposals for user steering, not a blanket quality approval.

## Reproduce

From this directory: `python bake.py` bakes the saved grids, sheets, portraits, reviews, manifest, and progress file. `python source/author.py` regenerates all grids from the preserved preferred sources and explicit authored edits. In the shared archive, the read-only inputs are the parent directory's `source/`, `candidates/` and `reference/`; the director rebased only those paths.
