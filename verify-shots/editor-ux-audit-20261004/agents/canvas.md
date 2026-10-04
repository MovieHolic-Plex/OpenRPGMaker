# canvas

Read-only audit at `d7a3f0136e`. Three findings; all **code hypothesis**, with no latency measurements claimed.

1. **Height hover performs whole-map work before its cache check.**
   - Trigger: move the pointer with Height selected, including movement within one cell.
   - Path: [editSceneHoverPreview.ts:136](/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/editSceneHoverPreview.ts:136) calls [screen.ts:142](/home/main/.codex/worktrees/e85c/rpg-zzu/src/project/relief/screen.ts:142), hashing every level and ramp before the hover early return. On cell changes, [screen.ts:214](/home/main/.codex/worktrees/e85c/rpg-zzu/src/project/relief/screen.ts:214) additionally scans every elevation to find a maximum already stored in `field.maxLift`. Each scan visits 1,048,576 entries on a 1024² map.
   - Safeguards: hover object reuse and cached lift fields; neither prevents these scans.
   - Remedy: cache the signature by mutation revision; use `field.maxLift` for picking.
   - Measure: native Height hover on otherwise identical 256²/512² maps containing one hill; record 100 same-cell movements, then 100 cell crossings, profiling these functions separately.

2. **Relief window baking still allocates and copies whole-map pixel buffers.**
   - Trigger: create the first hill, then raise the map’s highest hill.
   - Path: [reliefLiveStrips.ts:89](/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/reliefLiveStrips.ts:89) calls [window.ts:95](/home/main/.codex/worktrees/e85c/rpg-zzu/src/project/relief/window.ts:95): RGBA + owner + part require **7 × (16W) × (16H) bytes**, or **1.75 GiB at 1024²**, before padding and other allocations. Pad changes synchronously allocate replacement buffers and copy their contents at [window.ts:210](/home/main/.codex/worktrees/e85c/rpg-zzu/src/project/relief/window.ts:210).
   - Safeguards: local patch rendering, strip texture reuse, and cost-based scheduling reduce baking frequency and uploads; backing storage remains global.
   - Remedy: page the backing buffers using the existing strip column scheme, so local edits and pad changes touch occupied pages.
   - Measure: native Height S brush on disposable 256²/512² maps; profile first hill creation, another edit below the existing maximum, and raising that maximum. Compare allocation volume and `shiftImage` CPU.

3. **Gradual panning can retain destroyed tile tracking indefinitely.**
   - Trigger: repeatedly pan across a large map without a full redraw.
   - Path: [playSceneTileCulling.ts:137](/home/main/.codex/worktrees/e85c/rpg-zzu/src/player/playSceneTileCulling.ts:137) compares dead entries found only in changed buckets against the entire tracking array. [playSceneTileCulling.ts:181](/home/main/.codex/worktrees/e85c/rpg-zzu/src/player/playSceneTileCulling.ts:181) skips buckets remaining outside both windows, leaving their dead entries uncounted while subsequent pans append new tracking entries.
   - Safeguards: visible tiles are evicted; same-window checks, bucket filtering, and full-redraw resets exist. The compaction threshold uses an incomplete dead count.
   - Remedy: unregister destroyed tiles or maintain a global tombstone count for compaction.
   - Measure: native pan through 30 distinct viewport areas on a filled 512² map, then return, keeping zoom/layer unchanged. Compare tracking length, retained destroyed objects, and culling CPU against the initial view.
