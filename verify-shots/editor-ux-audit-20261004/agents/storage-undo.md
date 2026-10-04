# storage-undo

At `d7a3f0136e`, three convincing remaining paths. **All confidence: code hypothesis; no current timing claims.** Audit remained read only.

1. **Save preparation can block shortly after the editor becomes usable.**
   - Trigger: open/reload a project, then begin typing or painting while baseline warm-up runs.
   - Current path: [store.ts:998](/home/main/.codex/worktrees/e85c/rpg-zzu/src/project/store.ts:998) synchronously shares digests, digests the whole wire projection, then visits both baseline/current tileset dictionaries. [store.ts:1816](/home/main/.codex/worktrees/e85c/rpg-zzu/src/project/store.ts:1816) schedules one idle callback with a timeout; it never yields within that callback. Cost scales with visited nodes/string bytes.
   - Safeguards: lineage/baseline checks cancel obsolete work; digest caches and trusted shared entries reduce repeat work. Idle scheduling does not bound callback duration.
   - Narrow remedy: make baseline digest preparation resumable with bounded traversal slices and cancellation; preserve freshness checks.
   - Native measurement: cold-open the supervisor’s largest fixture; immediately alternate painting and DB-name typing for ten seconds. Attribute renderer long tasks to `baselineFrom`, `shareContentDigests`, and `jsonContentDigest`; compare warm reopen.

2. **The sliced save diff still contains unbounded whole-map serialization.**
   - Trigger: paint one cell on a large map, then autosave or Ctrl/Cmd+S while continuing editor interaction.
   - Current path: [projectPatch.ts:36](/home/main/.codex/worktrees/e85c/rpg-zzu/src/project/persistence/core/projectPatch.ts:36) stringifies both map versions; differing strings cause two additional recursive canonical serializations. [projectPatch.ts:145](/home/main/.codex/worktrees/e85c/rpg-zzu/src/project/persistence/core/projectPatch.ts:145) checks its slice budget only between generator steps. Afterwards, [electronRepository.ts:365](/home/main/.codex/worktrees/e85c/rpg-zzu/src/project/persistence/electronRepository.ts:365) synchronously JSON-roundtrips changed patch values. Work is proportional to the entire changed map, irrespective of edited-cell count.
   - Safeguards: unchanged references skip comparison; diff yields between entries; transport sends changed entries. These operations precede the host boundary and run in the renderer.
   - Narrow remedy: use structural comparison with array identity shortcuts; move changed-map wire conversion to a worker or resumable serializer.
   - Native measurement: identical 100×100 and 1024×1024 fixtures; change one cell, press Save, immediately paint elsewhere. Profile `sameValue`, `canonicalJsonString`, and `toWireValue` separately from host wait.

3. **History-list jumps retain full-project cloning and repeated map cloning.**
   - Trigger: select an older undo/redo entry, or rewind a completed AI turn.
   - Current path: [mapEditHistory.ts:467](/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/mapEditHistory.ts:467) and [mapEditHistory.ts:495](/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/mapEditHistory.ts:495) initially `structuredClone` the entire project, including shared assets/reference documents. Each traversed map snapshot then [clones all remaining project data](/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/mapEditHistory.ts:162). For N map entries, this adds N copies of unrelated maps. AI rewind reaches this path at [aiChatPanel.ts:1390](/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/aiChatPanel.ts:1390).
   - Safeguards: bounded history depth; intermediate clones share tilesets/uploaded entries. The initial full clone bypasses that sharing.
   - Narrow remedy: assemble traversal using shallow project/map dictionaries, clone only restored maps, and retain draft reconciliation.
   - Native measurement: make ten separate one-cell strokes; choose the tenth undo-history row, then redo-history jump. Compare identical active maps in projects containing one versus twelve maps; capture clone/GC costs.
