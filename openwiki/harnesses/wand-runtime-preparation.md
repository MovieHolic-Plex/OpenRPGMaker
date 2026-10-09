# Native wandshop runtime draft

This is a separate draft authoring adapter. It does not modify the POTIONS adapter,
native art, active concepts, common catalog, or canonical project store.

`src/harnesses/super-harness/wand_runtime_prepare.py freeze` requires explicit
`--artwork-root`, `--recipes`, `--layout`, `--actors`, and a new `--out` manifest.
It freezes the four recipes, layout/runtime contract/composer, preserved north
inventory, all eight response sources, and the full current actor receipt source
graph. Every existing reference hash is checked. `pack --manifest FILE --out NEW_DIR`
reads only those frozen bytes and fails if any original changes before emission.

Run `node src/harnesses/super-harness/node/wandRuntimeDraft.mjs --packet NEW_DIR`
to write `project.oprn.json` through `createNativeSceneProject`. The library,
authoring input, PNG assets, crop/source/output hashes, draft proof and shelf binding
remain alongside it. A new approved recipe requires a new manifest and packet.
No moving latest pointer is read during preparation.

The ground remains11×12 with32px visual north overhang. Floor/wall crops are editable
tiles; other native pieces are independent sprites. Connected side shelves retain
their six distinct depth bands, and countertop children share their supporting
surface's ground row. Native northern inventory is installed from its explicit
80×48 preserved crop. No whole-room screenshot is a runtime asset.

The current actor delivery contains18frames per actor: twelve preserved measurement
or wand-raise frames at180ms and six shelf-lift frames at200ms. All are selectable
as native pose demonstrations. Common walking/action sheets and anchors remain
unchanged. Instance anchors and transparent padding preserve exact scene soles.
Scene switches select the four native states; a dispatcher transfers actors to their
native state cells. Both doors have open/closed/locked pages and only their authored
one-cell threshold blocks. Staff access is within the same map; the external entry
destination remains unbound.

Wand response plays the actual eight ordered32×48 source frames at their contract
100ms timing, then holds the existing transparent terminal frame. These are separate
from actor pixels. The old scene's stacked response fragments are excluded.

## Unresolved native dependency

The side shelf image currently contains the stock box in its pixels. No hash-bound
vacant shelf bed or layered shelf/box source is available. A contextual lift would
otherwise show the box both in the shelf and in the actor's hand. The adapter keeps
contextual removal disabled, exposes native pose demonstrations separately, and
writes `shelf-binding.json` with the required native vacancy dependency. It does not
paint a replacement bed, erase pixels, or claim shelf removal is complete.

The current packet binds the old full scene while the wall/cutaway/door replacement
review is pending. Schema normalization proves authoring shape only. Visual hand,
response, doorway and Y-depth inspection remain runtime QA responsibilities.
`prepared-not-approved`, `runtimePassed:false`, `publicRegistered:false`, and
`canonicalReload:false` remain explicit. Publish the approved library and use
`saveNativeSpaceProject` only in the later supervisor installation stage.
