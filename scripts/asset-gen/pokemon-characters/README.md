# Native Python pixel characters

Requires Python3 and Pillow. Hero walking art now adopts the original Emerald Brendan source losslessly, explicitly requested for ≥95% reference identity. See `references/ATTRIBUTION.md`; it is not independently authored art. Other field roles and all trainer portraits remain original final-grid Python art. No image generator, resize, palette quantization or automatic pixel repair.

- `cast.py`: sixteen role records, fifteen-color palettes, explicit four-direction10×9 head rows.
- `field.py`:16×32 body, outfit, prop and three planted/swing leg poses per direction.
- `hero.py`: pinned original Brendan16×32 source cells, original phase order, right-facing flip and palette-index-zero transparency. Its foreground fidelity is measured separately from the original-costume aesthetic rubric.
- `portraits.py`: independently drawn64×64 fronts, player back and six professor eye/mouth/arm poses.
- `pixels.py`: bounded integer pixel primitives; stamp width errors stop the build.
- `build.py`:48×128 native atlases,17portraits,384×64 strip, lossless native walk GIFs and source/PNG SHA manifest.
- `prepare-review.py`: imports/checks/previews via the reusable harness. Does not approve or save a project.

```bash
python3 scripts/asset-gen/pokemon-characters/build.py --out /path/native-source
python3 scripts/asset-gen/pokemon-characters/prepare-review.py /path/native-source /path/review
node scripts/qa/runtime/pokemon-candidate-review.mjs /path/review/selection.json /path/gallery
node scripts/qa/runtime/pokemon-hand-authoring.mjs /path/review/selection.json /path/controls
```

Then root visually reviews1×/3× and records explicit review/gate/build. Shared registration checks Python hashes and source/final decoded RGBA equality for all34 candidates. The editor adapter adds transparent padding only. Official canonical save/fresh reload and actual standalone player QA are separate steps.

After changing any Python source, rebuild the manifest and import current art; do not reuse a review for changed image bytes. To change an independently authored role, edit its palette/rows and final-grid geometry. Character identity checks include field/front/back clothing and props. The hero walking fidelity result does not cover its independently drawn trainer portrait/back. Shared facial anatomy and broad front stances remain style limitations for other roles.
