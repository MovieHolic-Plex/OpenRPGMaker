# assistant

Audited `d7a3f0136e`, read only. Three remaining candidates; all **code hypothesis**, with no measured latency claims.

1. **History search scales with the entire archive.**
   - Trigger: open the AI history clock, type a search, or request another page.
   - Path: [conversationStore.ts:253](/home/main/.codex/worktrees/e85c/rpg-zzu/src/ai/conversationStore.ts:253), [query:499](/home/main/.codex/worktrees/e85c/rpg-zzu/src/ai/conversationStore.ts:499), [search listener:631](/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/aiConversationHistoryModal.ts:631).
   - Heavy work: IDB `getAll()` retrieves full transcripts across every project; frontend validation scans entries and sorts all conversations before scope filtering and pagination. Opening performs two scans; every search input starts another. Cost: O(total entries + conversations log conversations).
   - Safeguards: 20-row display pages, record compaction, and generation guards prevent stale results; they do not cancel scans.
   - Narrow remedy: maintain scoped summary records, page through IDB indexes, and debounce search while retaining ownership guards.
   - Supervisor scenario: disposable native profile with 1,000 retained conversations across projects; open current-map history, type ten characters, then load another page. Count `getAll` calls and profile frontend processing.

2. **Spatial checkpoints disable heavy-entry roundtrip reuse.**
   - Trigger: an ordinary live AI checkpoint after the project acquires `spatialAuthoring`.
   - Path: [applyChangesetToStore.ts:507](/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/tools/applyChangesetToStore.ts:507), [sharedDictionaryJson.ts:98](/home/main/.codex/worktrees/e85c/rpg-zzu/src/project/io/sharedDictionaryJson.ts:98), [projectLint.ts:201](/home/main/.codex/worktrees/e85c/rpg-zzu/src/project/lint/projectLint.ts:201).
   - Heavy work: the synchronous precommit gate assembles and deserializes the full wire document, including unchanged heavy dictionaries. Cost: O(serialized document size); blocking issues additionally invoke baseline lint.
   - Safeguards: cached serialization pieces, shared dictionaries, skipped cluster scans, and a UI yield before application remain present. Spatial dependencies explicitly disable skeleton reuse.
   - Narrow remedy: extend roundtrip reuse to preserve spatial dependency fields (`structureKits`/`tileGrafts`) while revalidating changed entries and retaining commit/authority gates.
   - Supervisor scenario: disposable project with substantial uploaded assets; warm caches, receive ten one-cell checkpoints, then repeat with valid spatial authoring present. Profile `checkRoundtrip` and deserialization before store replacement.

3. **Activity thumbnails repeatedly color-key the full uploaded atlas.**
   - Trigger: successive activity images using the same uploaded tileset with an explicit transparency key.
   - Path: [aiActivityMedia.ts:58](/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/aiActivityMedia.ts:58), [toolImageCanvas.ts:52](/home/main/.codex/worktrees/e85c/rpg-zzu/src/ai/toolImageCanvas.ts:52), [chipsetTransparency.ts:29](/home/main/.codex/worktrees/e85c/rpg-zzu/src/assets/chipsetTransparency.ts:29).
   - Heavy work: each visual loads a fresh image and synchronously allocates, reads, scans, and writes the complete atlas before rendering its small crop. Cost: O(atlas pixels) per visual; a 2048² atlas requires 4,194,304 pixel iterations each time.
   - Safeguards: three raster lanes, idle scheduling, bounded crops, and per-visual Blob reuse; no shared keyed-atlas cache on this path.
   - Narrow remedy: bounded cache keyed by immutable archived source, transparency key, and graft revision; preserve historical image accuracy.
   - Supervisor scenario: uploaded 2048² keyed atlas; collect 20 activity captures of the same region while typing. Count full-atlas `getImageData` calls and profile pixel scans, including with activity display set to “생략.”
