> Delegated read-only source review. Browser observations and final priority are in ../README.md; CODE-ONLY below describes this agent's own evidence. Supervisor baseline: 2cd0368b939bc5430ab8daa0e5ea52a38c5c5d00.

# Assistant UX audit round 2 — CODE-ONLY

Checkout: /home/main/.codex/worktrees/e85c/rpg-zzu
HEAD inspected: 2cd0368b939bc5430ab8daa0e5ea52a38c5c5d00; includes edd036172c, PR #2061.
Read-only source inspection. No servers, browser sessions, tests, gates, typecheck, user records, live model calls, external writes, or git mutations. This /tmp report is the only authored artifact.
All six performance findings below are CODE-ONLY: reachable work is confirmed in source, latency is unmeasured. Measurement recipes are proposed future work, not executed work.

## Old hypotheses confirmed in current code

### 1. Conversation history still reads and validates the entire archive
Trigger: open history with a current map, type in search, or load another page.
Sources:
- /home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/aiConversationHistoryModal.ts:537 (page query), :574 (map catalog), :631 (every input), :691 (two sequential initial queries).
- /home/main/.codex/worktrees/e85c/rpg-zzu/src/ai/conversationStore.ts:253 (read/validate/sort), :98 (entry validation), :372 (summary entry traversal), :495 (scope then summary then filter then pagination).
- /home/main/.codex/worktrees/e85c/rpg-zzu/src/ai/aiRecordDb.ts:99 (objectStore.getAll at :103).
Scaling: O(all archived transcript entries + N log N), plus same-scope summary and attribution processing, per query. Opening normally does two scans; every keystroke schedules a further scan. A 20-row page only bounds displayed results.
Existing guards: compact records; 20-row display pages; scope and generation/modal ownership checks discard stale results; no-map current filter returns early. Existing checkpoint/activity-trace indexes are not conversation summary pagination. No cancellation of already-started archive reads.
Narrow remedy: persisted per-conversation summaries and scope/time indexes, separate map catalog, indexed page traversal, debounce/coalesce title searches; keep scope and ownership checks.
Future measurement: synthetic disposable archive with 100/1000/5000 conversations across scopes, no actual records; open current-map history, type ten characters, load page 2. Count getAll calls, transferred record bytes, summary/validation CPU and input-to-paint distributions.

### 2. Presence of spatialAuthoring disables roundtrip skeleton reuse
Trigger: even a one-cell checkpoint in a project with spatialAuthoring defined.
Sources:
- /home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/tools/applyChangesetToStore.ts:507 -> commitChangeset.
- /home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/tools/changeset.ts:389 (draft lint), :396 (baseline lint only if blocking errors exist).
- /home/main/.codex/worktrees/e85c/rpg-zzu/src/project/io/sharedDictionaryJson.ts:96 (spatial exclusion at :98), :115 (full-wire fallback at :116).
- /home/main/.codex/worktrees/e85c/rpg-zzu/src/project/lint/projectLint.ts:201 (deserialize full roundtrip input).
Scaling: cached dictionary pieces still must be joined into full wire JSON and parsed/validated; O(full serialized document bytes), with additional allocations/GC. A draft blocking error also triggers baseline lint; this is conditional, not every checkpoint.
Existing guards: WeakMap serialization pieces; WeakSet passed entries; shared dictionaries; clusterMapIds:[]; authority, spatial acceptance and house protection; UI yield before apply. The spatial exclusion is deliberate because validators read structureKits/tileGrafts dependencies.
Narrow remedy: preserve every spatial dependency read by validation in reusable projections; revalidate changed entries/dependencies. Do not simply remove the spatial exclusion or skip the commit/authority gate.
Future measurement: synthetic matched asset-heavy fixtures with and without valid spatialAuthoring; warm identical entries, apply ten one-cell synthetic checkpoints. Attribute serialization join, deserialize, lint, GC, checkpoint-to-ACK latency; include changed structureKit/graft rejection cases.
Old source comments mention historical 149MB/0.8s measurements; those are not round-2 measurements and must not be reported as current timings.

### 3. Activity images repeatedly color-key the full atlas
Trigger: successive map activity visuals from the same uploaded tileset with an explicit transparency key.
Sources:
- /home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/aiActivityMedia.ts:58 (fresh Image), :59 (keying), :97 (prepare even with feed hidden).
- /home/main/.codex/worktrees/e85c/rpg-zzu/src/ai/toolImageCanvas.ts:52 -> /home/main/.codex/worktrees/e85c/rpg-zzu/src/assets/chipsetTransparency.ts:29 (whole canvas/getImageData/key/putImageData).
Scaling: O(atlas pixels) per distinct visual, before small crop render. 2048x2048 implies 4,194,304 pixel positions; this is arithmetic, not a measured duration. The general loadTilesetImage URL cache is bypassed by activityMedia's local loader, and it does not cache keyed canvases anyway.
Existing guards: explicit key required; three raster lanes; idle scheduling; bounded map crop; pending-by-ID and saved Blob reuse; historical immutable source. No shared keyed-atlas cache for different visual IDs. Display level 'none' returns early in view rendering but retains/rasterizes history intentionally.
Narrow remedy: bounded decoded/keyed atlas cache keyed by immutable source/ref, transparency key and graft revision; preserve historical source fidelity and fail-closed graft handling.
Future measurement: 20 distinct visuals of one keyed 2048x2048 atlas, visible and 'none' display; count whole-atlas getImageData/key scans and allocations, compare changing keys/grafts as cache invalidation controls.

## Genuinely new findings relative to prior assistant report

### 4. Human-edit protection adds full-cell comparison to descriptor-free edits
Trigger: while runPiCommand remains active, make a height-only edit with no tile edits/cell descriptor, or use a descriptor-free full-map restoration.
Sources:
- /home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/aiPiAgentCommand.ts:265 (subscribe across run, finally dispose).
- /home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/reliefActions.ts:80 (height-only change omits cells).
- /home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/assistantHumanEdits.ts:50 (entire grid), :5 (cellValue), :69 (protected-cell comparisons on later applies).
Scaling: two JSON serializations per cell during fallback comparison. Per cell also scans wall decorations, locked-cell lists, doodad memberships and feature patches; O(C*(1+D+L+G+F)) where those letters count scanned metadata, not map groups alone. A flat 512x512 map alone implies 524,288 cellValue invocations. Later checkpoint comparisons depend on retained protected cells and the same metadata scanning.
Existing guards: request lifetime; lineage/project identity invalidation; skip AI/system changes; explicit cells including same-value intent; map scope; old===next skips fallback; structure-change rejection. Normal tile strokes with exact descriptors avoid the grid fallback.
Narrow remedy: report all affected relief cells explicitly; compare unchanged array/metadata references before scanning; build per-map cell metadata indexes for necessary fallback and protected-cell comparison. Keep same-value brush intent and protection across ACK rebases.
Future measurement: matched 128x128 and 512x512 synthetic maps, Pi run active versus idle; height-only edit with topGrass off, then descriptor-free restoration. Count cellValue calls, stringify CPU, membership scans and subscriber time, with zero and populated metadata. Verify preserved-cell/neighbor behavior separately.

### 5. Small activity crops first clone full auxiliary map layers
Trigger: a read/write tool producing a map visual on a large map with extra layers, relief, terrain design or doodad groups.
Sources:
- /home/main/.codex/worktrees/e85c/rpg-zzu/src/ai/activityVisual.ts:81 (full tileset metadata clone), :82 (cloneExtraLayers(map)), :83 (crop afterwards), :85 (size guard afterwards).
- /home/main/.codex/worktrees/e85c/rpg-zzu/src/project/mapLayers.ts:104 (copies full arrays/metadata).
- /home/main/.codex/worktrees/e85c/rpg-zzu/src/ai/piAgent/toolAdapter.ts:237 (before capture), :267 (after capture); legacy session also calls capture.
Scaling: O(full auxiliary map arrays + memberships + tileset metadata) temporary copying before a maximum 32x24 result, potentially twice per write. Size rejection occurs after clone/serialization, so rejected visuals still pay that work. This synchronous capture happens before the later idle raster queue.
Existing guards: max crop, 40 event markers, source/data limits, post-capture size cap, catch failures. Tileset referenceDocuments/structureKits are omitted; no entire project is copied. Idle raster lanes do not guard capture allocation.
Narrow remedy: copy only requested auxiliary-layer cells from original arrays; filter/rebase sparse memberships without a preliminary full clone; cache immutable tileset capture metadata by source identity. Preserve exact historical content and layer order.
Future measurement: constant 24x16 capture on 128x128/512x512 fixtures with optional auxiliary layers present, hold tileset constant; attribute cloneExtraLayers, tileset structuredClone, JSON size check and GC. Include oversize tileset fixture to expose rejected-capture cost.

### 6. Activity archive pruning reads all visual/Blob payloads
Trigger: first quiet 600ms interval after media persistence, repeatedly across separated tool/image bursts; flushActivityMedia can force cleanup too.
Source: /home/main/.codex/worktrees/e85c/rpg-zzu/src/ai/activityMediaArchive.ts:27 (600ms debounce), :40 (prune), :45 (getAll full records), :48 (sort), :64 (visual size accounting).
Scaling: O(total archived visual payload bytes + N log N) deserialization/materialization and sorting. Blob byte copying is implementation-dependent and not claimed; getAll includes Blob handles and full visual structures where only id/at/bytes are needed. Readwrite transaction lasts through fetch, sort and deletes, serialized on writing queue.
Existing guards: 600ms debounce; seven-day/64MB eventual pruning; per-visual approximately 2.1MB budget; 256-record/16MB memory bounds; caught archive errors. 64MB is a cleanup target, not a strict transient bound; continuous persistence resets cleanup and can delay it. Three raster lanes do not bound this database enumeration.
Narrow remedy: separate compact id/at/bytes metadata or indexed timestamp/byte accounting; prune using metadata and fetch/delete payloads by key. Add bounded maximum cleanup delay if bursts can be continuous.
Future measurement: synthetic 8/32/64MB archives; emit small tool/image bursts separated by over 600ms, then continuous bursts. Count prune getAll calls, request-result payloads, sort CPU, transaction/write-queue wait and memory; compare display 'none'.

## Existing background guards and evidence — not a new stall finding
- /home/main/.codex/worktrees/e85c/rpg-zzu/src/ai/piAgent/client.ts:164 yields before apply, then awaits actual apply and forms ACK at :176; decorative reveal is not awaited here.
- /home/main/.codex/worktrees/e85c/rpg-zzu/src/ai/yieldToUi.ts:25 uses rAF when focused, MessageChannel when hidden/blurred, switches while waiting and cleans listeners/timers.
- /home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/agentFocus.ts:63 drops background reveals; agentConstructionRevealRenderer.ts:68/:81 stops/refuses background replay; assistantViewNavigation.ts:23 blocks navigation.
- Electron main/main.ts:78 and main/teamWindow.ts:37 set backgroundThrottling:false.
EXISTING EVIDENCE: /home/main/.codex/worktrees/e85c/rpg-zzu/verify-shots/assistant-view-background/README.md documents seven browser checks, two real applied/ACKed scripted checkpoints with about 1.88MB fixture, hidden/unfocused simulation and paused rAF/0/50ms timers. /home/main/.codex/worktrees/e85c/rpg-zzu/verify-shots/assistant-human-work/README.md documents thirteen browser checks and protected values 22->23->23 across scripted ACK rebases.
These establish scripted behavior, not performance of the six candidates, actual Electron minimization, live models or canonical SQLite persistence. No timing from the prior generic editor audit is attributed to assistant paths.

Comparison baseline: /home/main/.codex/worktrees/e85c/rpg-zzu/verify-shots/editor-ux-audit-20261004/agents/assistant.md (three old CODE-ONLY hypotheses at d7a3f0136e). #2061 did not modify these three source paths in the inspected commit.
Concurrent unrelated untracked round-2 QA script/evidence appeared during read-only inspection; left untouched and not used as execution evidence.
