# Joseon folklore correction — candidate review

Status: **candidate-awaiting-user-visual-steering**. These are three static idle proposals, not accepted pack art.

## Actual references examined

- Shipped `current-battle.png` and `current-village.png` from the director's `output/jf-art-20261005` directory.
- The three existing 64×64 portrait PNGs, opened individually with the image viewer before drawing.
- Original `public/assets/easyrpg/charset/Actor1.png`, opened directly. The review sheet uses the first actor's middle idle frame in the right-facing direction: source crop `(24,64)-(48,96)`, exactly 24×32. Only its original background color was made transparent. No Actor1 pixels were traced into new artwork.

## Construction

Native literal ASCII rows, one symbol per pixel. `source/*.pxgrid` contains exactly 64 rows of 64 symbols. `source/*.palette.json` maps symbols to opaque colors; `.` maps to RGBA `(0,0,0,0)`. `bake.py` assigns every pixel directly through Pillow's pixel access. No drawing primitives, image generation, gradients, tracing, random texture, or resampling of candidate art.

Shared deepest outline colors: `#292831`, `#3e343a`, `#1b222b`. Warm muted fur/straw and cool subdued ghost fabric, with highlights on the upper left. All candidate alpha values are 0 or 255. The comparison sheet alone enlarges references and candidates with integer nearest-neighbor 3× scaling.

| Candidate | Opaque silhouette | Opaque colors | Construction details |
| --- | --- | --- | --- |
| wild-boar | 42×32 | 14 | Heavy arched back, raised near shoulder, tucked rear leg, short foreleg, ivory tusk against red-brown muzzle. |
| straw-dokkaebi | 41×41, including club | 17 | 14–15 px head, irregular single horn, shaded far cheek, thick arms, straw shoulder coat, red-brown sash, bent spread legs. |
| maiden-ghost | 29×45 | 14 | 13 px head cap, partly concealed face, long blue-black hair, loose white sleeves with two hands, broad chima and two barely visible foot tips. |

## Actual image inspection and one revision

Viewed the first `review-sheet.png`, then saved that drawing in `revision-1/`. The first dokkaebi looked too frontal and had long straight legs; the ghost had overly repetitive diagonal folds. The boar fur also read as concentric ridges.

One revision shortened and bent the dokkaebi legs, shaded the far cheek and shifted the brow/eye/nose relationship toward the right; broke the boar's fur into less continuous clusters; and exposed the ghost's second hand while changing the sleeve and hem silhouettes. The final comparison sheet was viewed again with the image tool at original resolution.

## Specific remaining limitations

- **Boar:** the tucked far hind leg blends into the belly at 1×. The large shoulder highlight and back fur bands still read more sculpted than shaggy. The tusk is small; its visibility on pale battle ground needs context review.
- **Dokkaebi:** the face turn remains shallow. Straw marks on the coat still form some diagonal repeats and may read as a woven poncho instead of loose hanging bundles. The skin and coat are close in value, so the shoulder boundary is weakest at 1×.
- **Ghost:** fingers are only two to three pixels and do not separate clearly at 1×. The chima's main folds remain regular; its right shadow is a strong dark stripe. The expression is restrained and may need a clearer eye/hair gesture after user steering.
- The Actor1 reference is a 24×32 walking frame, whereas these are larger enemy idle cells. This sheet shows physical scale, not proof of battle-renderer placement or final art compatibility.
- The director's replacement foliage/ground was not available for comparison. Final color compatibility and runtime readability remain open.
- No animation or other monsters were produced; no candidate was installed or saved to the canonical project.

## Reproduce

From this output directory, run `python bake.py` to bake the final `.pxgrid` sources and comparison sheet. To regenerate the final ASCII grids from the literal authored rows, run `python source/refine_rows.py` first. `source/author_rows.py` and `revision-1/` preserve the initial draft; running the initial author script explicitly restores that draft, not the revised candidate.
