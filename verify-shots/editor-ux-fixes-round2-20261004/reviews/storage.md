# Independent correctness review

Reviewed `7ce9a76555..7e9612de2a31136af62f587515b3556693a042dd` for the four requested files, plus the current uncommitted `eventDraftVault.ts` draft-list cache. Read-only source/call-site review; no gates, Vitest, typecheck, server, browser, stash, or reproduction execution. Only this report was written.

## Finding: [P2] Enforce water-depth copy-on-write before yielding during wire preparation

**Changed location:** `src/project/persistence/electronRepository.ts:365`, which now awaits `withWirePatchValuesSliced`; the new suspension points are `src/project/persistence/core/projectPatch.ts:243–245` and `291`.

The submitted project view is not immutable for an existing editor operation. `store.updateMapTiles` (`src/project/store.ts:1046–1053`) copies tile grids but shares `terrainDesign`. `paintTerrainBrush` (`src/editor/terrainBrush.ts:38`) then mutates `draft.terrainDesign.waterDepth[...]` directly. Consequently, painting during the newly asynchronous wire copy changes the old project view being serialized. Tiles remain from the submitted revision, while water depth can come from the subsequent brush operation; a yield within the depth array can even produce a partially updated depth grid.

This is a new exposure of an existing unsafe writer: the previous wire preparation synchronously completed `JSON.parse(JSON.stringify(map))`, so a normal brush task could not interleave within that copy. The existing asynchronous diff already had a related window, but that does not protect the newly introduced wire-copy window.

**Editor reproduction for the supervisor:**

1. Use a large map with an existing `terrainDesign.waterDepth` array (a lake feature creates one), and make a map edit so the map is included in the next patch.
2. Start autosave/manual save. While wire preparation yields within that map, paint a surface/river stroke at a cell whose water depth changes. For deterministic timing, inject the stroke through the wire preparation's yield callback with `sliceMs = 0`, after lower-grid copying starts and before depth copying finishes.
3. Inspect the first outgoing `patch.maps.set[mapId]` or the adapter's returned `submitted`: it contains old tiles paired with new water depth. Expected: both branches describe the revision captured before the stroke. The following catch-up save may repair the host, but the first persisted revision and its receipt describe a state that was never submitted as a coherent editor revision.

**Minimal deterministic reproduction specification (not executed):**

```ts
const submittedMap = {
  lowerTiles: Array(1024).fill(16),
  terrainDesign: { waterDepth: Array(1024).fill(1) },
};
const patch = { maps: { set: { m: submittedMap } } };
let liveMap = submittedMap;
let yields = 0;
const wire = await withWirePatchValuesSliced(patch, async () => {
  if (++yields !== 4) return;
  // Mirrors updateMapTiles + paintTerrainBrush's existing shared-depth write.
  liveMap = { ...liveMap, lowerTiles: liveMap.lowerTiles.slice() };
  liveMap.lowerTiles[800] = 23;
  liveMap.terrainDesign.waterDepth[800] = 0;
}, 0);
// Expected submitted pair at cell 800: [16, 1].
// Source-traced result: [16, 0]; current editor pair: [23, 0].
```

**Action:** Copy `terrainDesign` and its `waterDepth` array before the surface/river brush mutates them, and audit other shallow map writers for the same contract before treating sliced wire preparation as submission-safe. Add a focused supervisor-run regression that edits during the yield callback, rather than only mutating the input after wire preparation resolves. The existing new patch test checks isolation only after resolution and misses this interval.

## Other requested areas

No additional concrete regressions found in mixed map/project/tileset history ordering, draft/recovery semantics and the current cached draft lists, or ordinary JSON comparison/wire compatibility. Vault entries remain privately cloned, revision changes invalidate serialized caches, and editor event mutation paths examined replace event arrays/objects. These are source-review conclusions, not claims that tests or browser QA passed.
