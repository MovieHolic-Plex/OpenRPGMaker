> Delegated read-only source review. Browser observations and final priority are in ../README.md; CODE-ONLY below describes this agent's own evidence. Supervisor baseline: 2cd0368b939bc5430ab8daa0e5ea52a38c5c5d00.

# Read-only UX performance audit round 2: relief and editor culling

Evidence level: **CODE-ONLY** for all six findings below. The code paths and allocation formulas are confirmed by inspection; user-visible latency, retained heap sizes and growth curves have not been measured in this audit.

Checkout: `/home/main/.codex/worktrees/e85c/rpg-zzu`.
Started at `f54daa59f6238c6d78e779eff158c1d7ebfc357a`; last rechecked HEAD: `2cd0368b939bc5430ab8daa0e5ea52a38c5c5d00`.
HEAD advanced externally during the read. Read-only diffs show the inspected editor/relief/culling files unchanged between these HEADs and from the previous canvas audit's `d7a3f0136e`.
This audit made no repository edits, git mutations, server/browser starts, test/gate/typecheck/Vitest/stash calls, map allocations or project writes. This file is the only output written by this audit.

Read: AGENTS, quickstart, INDEX coordinates, PROJECT_WIKI, focused editor routing and relief performance/limitations, focused observability, previous canvas and independent verification reports, original and improvement evidence READMEs. The project checkout had no project.sqlite discovered in the initial local file search; no browser was opened to query IndexedDB. Prior audit artifacts supply the relevant history for this source review.

## Evidence boundary

`verify-shots/editor-ux-audit-20261004/agents/canvas.md` already labels its three findings code hypotheses. Independent verification correctly limits the elevation maximum scan to cache misses/cell changes, rather than every pointer event.
Original and post-PR improvement measurement files contain ordinary pan intervals. These are not repeated-pan tracking/heap profiles and do not establish the culling leak or relief allocation costs. Post-PR measured improvements concern inventory editing, tile undo and event opening.
Concurrent round-2 artifacts inspected at report time contained life-collection measurements, not relief/culling evidence. They were left untouched.

## Old hypotheses confirmed against current HEAD

### 1. Eligible Height hover hashes the whole map before testing its cache

Trigger: choose Height on a nonflat map and move the pointer, including movement inside one ground-coordinate cell.

Sources:
- `/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/EditScene.ts:1148`: pointermove reaches updateHoverPreview.
- `/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/EditScene.ts:1514`: no same-cell early return before renderHoverPreview.
- `/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/editSceneHoverPreview.ts:136`: hover key calls reliefSignature.
- `/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/editSceneHoverPreview.ts:143`: equality guard runs afterwards.
- `/home/main/.codex/worktrees/e85c/rpg-zzu/src/project/relief/screen.ts:142`: signature loops levels, then ramps, decorations and style.
- `/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/editSceneHoverPreview.ts:34`: cache miss reaches reliefPickCell.
- `/home/main/.codex/worktrees/e85c/rpg-zzu/src/project/relief/screen.ts:214`: picking loops the cached elevation array for a maximum.

Cost: signature O(WH + ramp count + decoration count) per eligible pointer event. Picking adds O(WH), then a small column search bounded by height, on a hover cache miss. Painted samples also reach reliefPickCell through TilePaintEngine.ts:289. hasRelief itself scans levels until a positive value, so hill location can affect this additional cost.

Guards: painting/active drag/paste/right-region gestures suppress hover; a matching key with nonempty preview skips drawing and picking; lift fields/slopes are cached. Missing relief returns signature 0. Therefore a maximum scan per pointer event is not established.

Narrow remedy: cache relief signature by an authoritative relief mutation revision, including ramps/style/decorations, and use field.maxLift as a conservative picking bound. It includes slope high endpoints, which may exceed cell-centre elevation; this expands the search conservatively. Do not blindly cache by object identity: window.ts:37 explicitly documents writers that modify levels in place. Preserve invalidation on edits, undo/redo and terrain commands.

Recipe: warm identical 48x48 and 96x96 fixtures, with the same small hill near the same low index. Record 100 movements inside one cell, then 100 crossings; compare Height and Paint. Attribute CPU separately to reliefSignature, hasRelief and reliefPickCell; count calls/cache misses separately from input-to-frame latency. Repeat three times without CPU throttling and report machine load.

### 2. Local relief painting retains whole-map pixel backing and copies it on pad changes

Trigger: first persistent hill, then edit below the existing maximum, then raise the highest hill so the render pad actually changes.

Sources:
- `/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/reliefLiveStrips.ts:89`: first nonflat sync creates emptyReliefImage for the map.
- `/home/main/.codex/worktrees/e85c/rpg-zzu/src/project/relief/window.ts:95`: global RGBA, owner and part arrays.
- `/home/main/.codex/worktrees/e85c/rpg-zzu/src/project/relief/window.ts:195`: pad changes add a full-width top boundary window.
- `/home/main/.codex/worktrees/e85c/rpg-zzu/src/project/relief/window.ts:210`: shiftImage allocates replacement global arrays.
- `/home/main/.codex/worktrees/e85c/rpg-zzu/src/project/relief/window.ts:215`: copies old contents into replacement arrays.

Cost: backing allocation and shift copying scale with map pixel area, not brush area. Flat maps clear buffers. The first hill can allocate a pad-zero base and immediately a padded replacement. Full bake fallback also has renderer scratch/output arrays; it can coexist with an old retained image and the newly allocated empty base.

Guards: changed-window baking, 60% full-bake fallback, column strip reuse, patch upload selection, and cost-based rAF scheduling reduce redraw/upload work and frequency. None bounds retained backing by viewport. Padding depends on effective/pruned rendered heights and slopes, not solely the raw maximum entered by the user.

Narrow remedy: use paged backing buffers consistent with existing 256px strip columns; represent vertical movement as a logical origin so pad changes do not copy every page. Keep marching-square/24px dependency halos, boundary redraws, absolute pattern coordinates and pixel ownership consistent. A cap can prevent extreme allocations pending that work but is not a solution to locality.

Memory formula, exact for these three retained buffers only:

- T=16 relief raster pixels per cell, independent of displayed map tileSize.
- P=render pad in relief pixels, N=(16W)*(16H+P).
- RGBA 4N + Int16 owner 2N + Uint8 part N = **7N bytes**.
- Pad shift needs old and new arrays simultaneously: at least **7*N_old + 7*N_new** bytes during copying, before other allocations/GC.
- Pad-zero 64x64: 7 MiB; 96x96: 15.75 MiB. 96x96 with P=64: 16.40625 MiB.
- Mathematical illustration only: pad-zero 1024x1024 is 1.75 GiB. No such fixture should be allocated for this audit.
- Excludes level/grid/lift arrays, patch/full renderer scratch, atlas rasters, strip canvases/GPU textures, object overhead and retained renderer caches. The formula is neither peak memory nor total process memory.

Recipe: run 48x48 then 96x96 serially, with heights no more than 4. Use S brush and a persistent plateau footprint; measure first hill, an edit below current max, then increasing max from 2 to 3. Record image dimensions/pad, mode counters, ArrayBuffer allocation timeline and shiftImage CPU. Verify under/top/slope picking still agrees with the visual. First-hill creation has additional whole-map cell planning (finding 5), so separate its stacks from backing allocation.

### 3. Gradual editor pan can retain destroyed culling entries across many windows

Trigger: on a filled lazy editor map, move gradually across multiple distinct viewports without editing or a full redraw; then revisit them.

Sources:
- `/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/editSceneRender.ts:303`: evicts and destroys tiles outside the new materialization window.
- `/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/editSceneRender.ts:465`: newly created tiles append tracking.
- `/home/main/.codex/worktrees/e85c/rpg-zzu/src/player/playSceneTileCulling.ts:102`: images and parallel coordinates append.
- `/home/main/.codex/worktrees/e85c/rpg-zzu/src/player/playSceneTileCulling.ts:137`: changed-bucket dead count used against full images.length.
- `/home/main/.codex/worktrees/e85c/rpg-zzu/src/player/playSceneTileCulling.ts:185`: buckets outside both windows, or inside both, are skipped.

Cost: dead objects, coordinates and bucket indexes can persist while tracking length grows with tiles recreated since the last compaction/reset. Changed-bucket iteration scans all bucket keys, and relevant buckets include accumulated historical entries. Compaction eligibility uses only the dead objects visited this pass, rather than total retained dead entries.

Qualification: this is retention with no reliable global threshold on the gradual editor-pan path. It does not prove permanent/unbounded growth on every finite-map route; revisiting a concentrated dead bucket, a large camera jump, edit invalidation or a redraw can cause a complete pass/compaction. Do not repeat the previous report's unconditional 'indefinitely' wording as measured behavior.

Guards: tile objects are genuinely evicted; destroyed objects are skipped before setVisible; equal windows skip work; full redraw/shutdown resets tracking. Ordinary cell edits can invalidate the window, forcing a global count. Runtime flat resident-window pan already resets and rebuilds tracking at `/home/main/.codex/worktrees/e85c/rpg-zzu/src/player/playSceneMapRuntime.ts:377`; that path does not share this editor-pan retention mechanism.

Narrow remedy: unregister destroyed tiles or maintain an authoritative global tombstone count and prune dead bucket entries when compacting. Rebuilding tracking from the bounded resident tileIndex on changed windows, as the flat runtime does, is another focused option. Preserve visual-row culling for lifted tiles and pause/resume rather than active=false for hidden animations.

Recipe: use a flat filled 96x96 editor fixture with valid lower and upper tiles, zoom enough that viewport is much smaller than map. Warm once. Smoothly pan a serpentine route through at least six positions; revisit for 20 laps without layer/zoom/map changes. At baseline, after exploration and after laps, record live tileIndex objects, tracking length, active=false retained entries, bucket lengths and culling CPU. Separate pan CPU recording from paused heap inspection. Record any compaction/reset rather than interpreting a sawtooth as a clean plateau. Do not count ordinary old pan timings as this evidence.

## Newly identified issues, not claimed as regressions introduced by PR #2061

### 4. Relief ground preparation does whole-map work before render cache equality

Trigger: a redraw on an unchanged nonflat map, or one small relief/ground edit that schedules relief rendering, with a valid loaded native ground atlas.

Sources:
- `/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/EditScene.ts:2311`: redraw reaches renderReliefLayer.
- `/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/EditScene.ts:2453`: creates ground surface before key calculation/equality at 2456-2457.
- `/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/reliefGroundSurface.ts:28`: allocates cells Int32Array(WH).
- `/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/reliefGroundSurface.ts:30`: hashes every lower/overlay/shadow/stack cell.
- `/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/reliefGroundSurface.ts:40`: allocates resolved array of WH slots.
- `/home/main/.codex/worktrees/e85c/rpg-zzu/src/project/relief/window.ts:147`: partial patch planning compares complete effective/pruned grids; 151 compares complete ground cell fingerprints.

Cost: every eligible renderReliefLayer invocation has O(WH + lower stack entries) ground preparation even when its final key is unchanged. Partial patch setup also retains map-wide comparison work. This is not claimed to run every pan frame: pan materialization does not itself call renderReliefLayer.

Guards: atlas pixels are cached by image identity, composed cell cache capped at 2048, ground unavailable/flat early returns, final render key avoids baking, scheduled requests coalesce. These do not prevent fingerprint allocation/hashing before key equality.

Narrow remedy: retain ground surface/fingerprints across unchanged lower-plane inputs and patch their indexes from authoritative lower/overlay/shadow/stack changes. Relief-only edits should reuse the ground surface. Rebuild for resize, atlas/tileset replacement and full store restore. If optimizing patch planning, propagate affected regions through effective/pruned terrain dependencies; raw brush cells alone are not a correctness proof.

Recipe: existing 48x48/96x96 hill fixtures; perform repeated unchanged redraws on the same map, then precise small edits below the existing maximum. Attribute createReliefGroundSurface and planReliefPatch separately; record cells.byteLength/allocation counts and mode='same' versus 'window'. Atlas decode should be warmed and constant. No evidence of repeated atlas decode is claimed.

### 5. First/last hill builds a map-wide changed-cell list before lazy-window filtering

Trigger: change a flat map to nonflat (first hill) or erase its last remaining height. Ground ownership changes for the lower plane.

Sources:
- `/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/EditScene.ts:2492`: hasRelief transition enumerates WH coordinate objects.
- `/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/EditScene.ts:2502`: maps the whole list to ProjectChangeCell records.
- `/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/editSceneRender.ts:241`: deduplicates, copies and sorts expanded cell list.
- `/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/editSceneRender.ts:483`: adds lower/upper neighbours for each lower cell.
- `/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/editSceneRender.ts:250`: only afterwards skips offscreen cell rendering.

Cost: O(WH) cell objects/keys and expanded deduplication; a sort of the resulting list, rather than just viewport cells. Actual tile creation remains window-bounded. It would be false to claim this creates WH tile sprites on lazy maps.

Guards: ordinary nontransition relief edits emit only differing slots after comparing fields; lazy window limits actual sprite creation; map/render identity must allow incremental work or fallback redraw occurs.

Narrow remedy: on ground-ownership transitions, generate changed cells for the resident tileIndex and current camera source window, including relief overhang, before neighbour expansion/sort. Unmaterialized cells will use current ownership on future pan. Keep actual offscreen residents eligible for destruction and preserve upper/overlay/shadow handling.

Recipe: same first-hill/last-hill 48x48 and 96x96 cases; profile Array.from, changed.map, uniqueRenderableTileCells and sort separately from buffer creation. Record input change counts and actual tileObjectsUpdated. Pan out and back to verify no stale lower/upper/shadow/stack artifacts after this remedy.

### 6. Empty lazy tile chunks survive viewport eviction

Trigger: explore new chunk coordinates by panning a lazy editor map (>2048 cells).

Sources:
- `/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/editSceneRender.ts:112`: creates/registers chunk containers on demand.
- `/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/editSceneRender.ts:419`: eviction removes/destroys child objects from actual parent.
- `/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/editSceneRender.ts:303`: eviction deletes tileIndex entries, not emptied chunks.
- `/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/EditScene.ts:907`: notes chunks disappear only on redraw clear.
- `/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/EditScene.ts:911`: every changed chunk-visibility key scans all accumulated chunk containers.

Cost: chunk container storage and visibility-pass work grow with explored chunk positions, not current viewport. This is bounded by map chunk coordinates and layers; repeated traversals of the same positions should plateau in chunk count. It is distinct from destroyed tile tracking, which can append new entries on repeated visits.

Guards: inactive chunks are hidden, children are evicted, unchanged visibility key skips the scan, redraw clears the registry/parents. Visibility suppression is not chunk removal.

Narrow remedy: after removing the last child from a registered lazy tile chunk, detach/destroy it and delete its registry entry. Use actual parent identity/visual chunk coordinates (lift may change visual Y), not only stored cell coordinates. Recreate when needed and maintain separate lower/upper parents.

Recipe: reuse the flat 96x96 pan fixture. Count chunk registry size, empty chunks and live children at start, after exploring new positions, after returning, and after repeat laps. A useful remedy invariant is no retained empty chunks once eviction completes; inspect lower and upper rendering after return and at a raised upper-tile boundary.

## Safe follow-up measurement protocol (recipe only; not executed)

Use one supervisor-operated editor and one disposable fixture at a time. Keep maps at 48x48 and 96x96 (64x64 is an optional midpoint), heights <=4 and a modest atlas. Both principal sizes exceed the editor's 2048-cell lazy threshold. The pan fixture is flat, with valid lower/upper content, and zoomed so only a small region is resident. No 256/512/1024 relief fixtures or original broad audit script are necessary.
Warm JIT/atlas once; record the first-hill cold allocation separately, then three repetitions of warm actions. Measure function CPU, calls, work counts, frame/long-task intervals and ArrayBuffer allocations. Heap snapshots are separate from latency runs because collection/debug pauses perturb timing. Do not infer ArrayBuffer/GPU totals from JS heap size alone.
Inspect the same fixture after movement/edit/undo: hover top/wall selection, pad-change alignment, strip seams, valid four-direction ramps and lifted upper tiles. A small forced-full rebuild can compare patch pixels, but clears buffers/changes counters and must follow retention measurements. Existing __oprnEditReliefStats exposes bake modes, not total allocation bytes or tracking counts.
If later authorized to run QA, capture exact HEAD, fixture dimensions/tileSize/zoom, renderer/browser, host load, counts and raw traces under a unique output folder. Content persistence is not being validated by these UI fixtures; use a separately authorized disposable SQLite target if save/reload correctness is part of a subsequent patch.

Additional first-hill qualification: with native ground present, the first sync has prev=null and next.opts.ground set. window.ts:139 rejects this ground-ownership mismatch, so reliefLiveStrips.ts:105 takes a full render after the empty global base was already allocated at line 89. First-hill patch-plus-shift behavior applies when that ground-presence mismatch is absent; do not assume mode=window for the native-ground first hill. The 7N formula remains a backing-only lower bound, excluding the additional full-render arrays.
