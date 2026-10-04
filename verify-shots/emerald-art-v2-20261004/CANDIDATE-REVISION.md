# Candidate revision4 — user requested further revision

The user answered `후보 그림부터 더 수정`; no production monster selection.
All60 existing species IDs/data remain unchanged.21 species were regenerated or
refined; all120 front/back pairs were re-extracted and imported with the actual
integration species CLI, `--block 8`, in a fresh private review sandbox.

Inspect `candidate-contact-0.png`, especially Stormskink front/back; then the
20/40 contact sheets. These are asset inspection sheets, not game screenshots.
`board-v4-QA.json` records the actual current review URL,360px responsive layout,
60 native species controls, current/all selection, decoded images and errors0.
Private browser selection used for QA is not human approval.

Native112×112 containers, ink maximum64px, opaque palette maximum16 colors.
Final CLI candidates:120, structural errors0, warnings140. Body-size metric
sqrt(back bounding area/front bounding area) ranges0.8893906..1.0443810.
The CLI's final cleanup changes65 pre-import drafts; displayed review pixels
are the final CLI PNGs copied byte-for-byte into `candidates-v4/`.
Pack index hashes sprite bytes; the CLI receipt hash refers to raw-input bytes.
All raw-input hashes and final sprite geometry/palettes were independently read.

## Specific extraction failure fixed

The original gecko sheet front tail crosses x512 in its1024px width;187 alpha>=128
source pixels occupy that column in the final-stage row. Fixed half-sheet cropping
both clipped the front and contaminated the back with a disconnected fragment.
After built-in imagegen cleanup, actual per-row transparent gutter is atx533.
Extraction now searches this gutter and refuses a row without a clear separator.
All60 source row column cuts were re-read and found alpha<128 throughout their
row. Stormskink back has a single connected opaque component (8-neighbor).
No body pixels were hand painted, erased or substituted by the packing scripts.

## Reproduction and storage

Working directory: `/home/main/z-project/rpg-zzu-tileset-harness`.

```
node scripts/content/emerald-art-v3-pairs.mjs /home/main/z-project/rpg-zzu-tileset-harness-monster-opening-host assets/emerald-monster-v2/monster-revision4-generation.json <draft-output>
node scripts/content/emerald-art-v3-import.mjs /home/main/z-project/rpg-zzu-tileset-harness-monster-opening-host assets/emerald-monster-v2/monster-revision4-generation.json <draft-output> <fresh-review-sandbox> /home/main/z-project/emerald-art-v3-review-20261004/data/seed.json
```

Current sandbox `/home/main/z-project/emerald-art-v4-final-review-20261004`;
`candidate-v4-receipt.json` records runs, actual CLI entry, warnings and raw hashes.
Generation/refinement prompts and raw original images are stored in the asset
folder; index and pair-provenance contain sources, crop boundaries and final
sprite hashes. No picks/builds, runtime sprite adoption or canonical writes.
Shared starter seed/ledger remains isolated from candidate review.

Shared alpha/fixed-grid verifier is documented separately in
`alpha-grid-SUMMARY.md`: its connected-white fixture lost1216 opaque pixels
before the general fix, whereas the actual Glaciermane source lost0. The
actual sample must not be misreported as proof of that separate alpha bug.

No gates, Vitest or full typecheck. Human visual selection remains pending.
