# Native Python pixel characters

Original field and trainer art authored directly on final grids. Requires Python3 and Pillow. No imported raster sources, image generator, resize, palette quantization or automatic pixel repair.

- `cast.py`: sixteen role records, fifteen-color palettes, explicit four-direction10×9 head rows.
- `field.py`:16×32 body, outfit, prop and three planted/swing leg poses per direction.
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

After changing any Python source, rebuild the manifest and import current art; do not reuse an old review. To change a role, edit its hair/outfit palette/rows and final-grid geometry. Keep the head root fixed while moving arms and feet. Character identity checks include field/front/back clothing and props. Shared facial anatomy and broad front stances remain style limitations; no claim of original Pokemon artwork equivalence.
