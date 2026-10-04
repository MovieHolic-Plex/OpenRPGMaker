# Original monster creature art

All 120 battle sprites and 60 native party icons in this directory are authored for the
별빛섬 몬스터 원정 game (original2026-10-03, anatomy refinement2026-10-04). The editable source is
`scripts/content/monster-expedition-art.py`: integer pixel polygons, lines,
rectangles and small ellipses, with 24 individually authored creature anatomies.
No source images, traced silhouettes, stock monster sprites or generated-image
outputs are used. Front and back are separately authored anatomical views.

These are project-owned original assets. No extra redistribution license is
granted here. There are no third-party creature-art attribution obligations.
Pillow is an authoring dependency, not a runtime dependency or an included art pack.

Rebuild from the repository root:

```sh
python3 scripts/content/monster-expedition-art.py
```

`catalog.json` records each PNG filename, resource ID, byte size, SHA-256 and
nontransparent bounding box. `uploaded-art.json` is the synchronous portable
upload seed; SQLite persistence externalizes its bytes through the native asset
service. `contact-sheet.png` and `starter-review.png` are developer review images,
not battle resources. The shared roster module registers the actual 120 battle sprites and 60 icons.
No per-project-only asset patch is required for fresh campaign generation.

## Native pixel contract (2026-10-04)

- Battle: transparent RGBA64×64; last opaque row61; unchanged
  `mx_art_<slug>_front` / `mx_art_<slug>_back` identities.
- Party/dex: separately drawn static RGBA32×32; last opaque row29;
  `mx_art_<slug>_icon`. These are single frames, not Emerald's two-frame icon animation.
- Integer polygon/line coordinates rasterize directly at native size. Existing
  80-unit design coordinates are projected before drawing. Stage anatomy changes
  precede rasterization; emitted battle/icon PNGs are never resized or recolored.
  Nearest-neighbor enlargement is only used by developer review sheets.
- Every resource uses family body/highlight/shadow plus accent, two accent facets,
  an ink derived from that family's shadow and ivory. Actual maximum8opaque colors;
  generator bound15plus transparency. Alpha values are exclusively0/255.
- All24families have silhouette, joint, eye/expression and material details.
  Rear views have authored shoulders, dorsal seams, horn roots, rump/tail roots,
  membrane ribs or folded wings. Front sprites are not flipped to make backs.
- `catalog.json` records dimensions, native bounding boxes and actual opaque
  palette as well as per-file SHA-256. `provenance.json` binds that catalog and
  the portable upload seed to the exact source SHA and records the format contract.

Format reference only: [Emerald graphics declarations](https://github.com/pret/pokeemerald/blob/master/src/data/graphics/pokemon.h)
register front/back/palette/icon resources separately, and
[Emerald icon OAM](https://github.com/pret/pokeemerald/blob/master/src/pokemon_icon.c)
uses32×32 and4bpp. No original game's graphics, palettes, species designs or
silhouettes are copied. Our original species palettes remain family-specific.


## Review evidence

`before-contact-sheet.png`, `before-starter-review.png`, `before-rare-review.png`
preserve the original80px baseline from git349fa573ed12322bea2f8871cc1c93758603f8e4.
The corresponding unprefixed sheets are native64px revised drawings. All9starter
family species and all6rares are enlarged without interpolation for inspection.
`icon-contact-sheet.png` includes every32px icon. `review-evidence.json` records
an independent all180resource disk/seed/catalog byte audit and unchanged species,
family, evolution-stage and120battle-resource identities. Full stats/learnset/
evolution source is untouched. These developer sheets are not registered as
runtime resources. Runtime/canonical-promotion QA belongs to campaign integration.


Astralhart title consistency follow-up: its front, rear and32px icon now depict
four grounded legs under a horizontal torso, a leaf mane, bushy tail and cream
star-tipped antlers, matching the original title stag's creature identity.
Its rear pose is independently authored facing upper right. Forest green/ivory
replace the earlier mint/pink palette for this species only.
`python3 scripts/content/monster-expedition-art.py --species astralhart` rerenders
only that species'3PNG resources and rebuilds the complete verified portable
seed/catalog/review sheets. Other177PNG resources are read and SHA-verified,
without being rewritten. Omit `--species` for a full regeneration.
`review-evidence.json` records the title reference SHA and177unchanged-byte audit.
