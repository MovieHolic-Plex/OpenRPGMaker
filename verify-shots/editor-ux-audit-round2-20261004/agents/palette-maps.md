> Delegated read-only source review. Browser observations and final priority are in ../README.md; CODE-ONLY below describes this agent's own evidence. Supervisor baseline: 2cd0368b939bc5430ab8daa0e5ea52a38c5c5d00.

# UX audit round 2: palette, Maps, Progress

Evidence level: CODE-ONLY. Reviewed HEAD 2cd0368b93 (includes merged #2061).
Scope: read-only source and existing evidence. No repo writes, servers, browsers,
tests, gates, Vitest, typecheck, stash, or Git mutations performed by this audit.
Only this optional report was written, outside the repository.

Classification: findings 1 and 2 confirm old hypotheses. Finding 3 confirms the
old event-cloning mechanism but identifies a genuinely new trigger: the selected
Progress pane continues doing that work after its ancestor is collapsed.
No latency numbers or savings are claimed for these findings.

Context read: AGENTS.md, quickstart, PROJECT_WIKI, INDEX coordinates, focused
editor-pre-edit-routing palette/map/subscriber sections, editor-observability,
old agents/palette-sidebar.md and agents/verification.md, old audit README,
and relevant existing improvements evidence. The old palette report explicitly
has no latency measurements; improvements evidence covers other interactions.
No local project.sqlite exists. Browser IndexedDB was not inspected because the
delegated read-only scope prohibited browser startup. No LegacyDb lookup was necessary.

HEAD changed externally from f54daa59f6 to 2cd0368b93 during the audit. Read-only
Git comparison found no changes in the examined palette/map/Progress source files
between those revisions, or since the old audit d7a3f0136e. New untracked round-2
QA files also appeared externally; this audit did not create or modify them.
Their available JSON did not supply measurements for these three paths.

## 1. OLD CONFIRMED: filtered tile selection builds closed auxiliary bodies

Trigger: open a Beodeul custom-atlas map, keep Brush Assist and My Structures
closed, enable a category or search filter, then click a different same-layer
tile while the paint tool and stamp state already match.

Source chain (absolute paths are formed with the repository prefix above):
- /home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/editor.ts:309: selection-only notification tries in-place sync;
  :314 and :883 queue palette refresh if it fails.
- /home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/tilePalette.ts:799: any active filter rejects in-place sync.
- tilePalette.ts:187: unchanged-input guard fails for the new selected tile.
- tilePalette.ts:440 and :638: builds assist panel eagerly.
- tilePalette.ts:503: builds kit shelf before passing a body callback.
- /home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/sidebarSurface.ts:103: closed popup skips calling body(),
  but the caller has already constructed its contents.
- /home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/tilePalettePreviewPanel.ts:61: similarity calculation;
  :62: usage-location search on current map.
- /home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/tileBrushTools.ts:124: scores N tiles; :135 sorts positive
  candidates, up to O(N log N) on a cold distinct-tile query.
- tileBrushTools.ts:81: usage search is O(width*height) worst case, ending early
  if six matches are found. A tile absent from the map makes the full scan run.
- /home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/harnessSuggestion/structureKitShelf.ts:31 and :41: one assembled
  canvas per section kit; canvas work scales with total icon cell/pixel area.
- /home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/harnessSuggestion/kitRender.ts:39: allocates each canvas; :68
  schedules image-backed drawing even though the shelf is not displayed.

Direct JSON read confirmed the current bundle has 27,648 tiles and 725 kits,
all 725 of kind section. These are content counts, not browser measurements.

Guards: custom sheet retention/virtualization keeps existing tile nodes;
120ms search debounce reduces filter typing refreshes; similarity cache is keyed
by tileset object, selected tile and limit; image cache shares image loading.
Those guards do not cache the kit canvas collection, avoid usage scans, or make
the eager bodies lazy. Repeated selection of the same tile may notify nothing.

Narrow remedy: allow filtered custom-atlas selection to update mounted selection
and filter exception state in place; preserve the RM2K filtered rebuild contract.
Separate always-visible assist controls from lazy popup content. Construct the
kit shelf inside the popup body callback; determine trigger availability from
kit metadata without building icons. Preserve recent-category membership updates,
filter counts and selected-tile visibility.

Measurement recipe (not run): use the same Beodeul map and ten distinct same-layer
choices in All versus a fixed non-recent category, closed popups. Attribute CPU
to computeSimilarTiles, usedLocationsForTile, makeStructureKitShelf and kitRender;
count canvas allocations through the next rendered frames, including detached
canvases (a DOM observer on the visible palette alone misses closed-body work).
Compare cold distinct tiles with a warmed repeat sequence. Record event-to-frame
time, selection/scroll correctness and sheet identity. After the lazy-body fix,
closed kit/assist bodies should perform no icon/similarity/usage work.

## 2. OLD CONFIRMED: different-map click has duplicate synchronous tree rebuilds

Trigger: Maps activity pane visible, click a valid different map row.

Source chain:
- /home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/mapList.ts:1288 calls selectEditorMap; :1289 immediately
  calls rerenderMapList; :973 forwards to renderMapList.
- /home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/mapSelection.ts:44 changes editor state for a different map.
- /home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/editorState.ts:246 calls listeners synchronously.
- /home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/mapSidebarSection.ts:26 detects changed map ID; :22 calls
  renderMapList synchronously before the click handler returns.
- /home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/mapList.ts:88 clears the tree; :161 renders expanded rows.
- mapList.ts:380 enumerates all M map keys for every rendered non-folder row R:
  O(R*M) enumeration/allocation per rebuild; O(M^2) when all maps are expanded.
- mapList.ts:471 creates each row's thumbnail canvas; :476 reads link statistics.

Thus the explicit handler and visible activity-pane subscription provide at
least two synchronous rebuilds for that click. Other dock subscriptions can add
later refreshes; this is not a claim of exactly two total refreshes everywhere.

Guards: unchanged map ID skips the subscription; hidden root skips refresh;
collapsed branches reduce R; cached link inputs and thumbnail map hashes/images
reduce underlying analysis/raster work. Store-only refresh guards focus and
settles paint after 500ms, but the editor-state callback bypasses those guards.
Warm thumbnail hits still allocate new row canvases and blit into them.
Thumbnail raster cache holds 120 entries, so 200 maps cannot all remain warm.

Narrow remedy: pass a once-computed canDelete/mapCount through RenderNodeContext;
use a single refresh owner when the activity pane observes an actual map change.
Keep explicit refresh for folders, same-map multi-selection, rejected navigation,
and surfaces without that subscription. Preserve focus and reveal behavior.

Measurement recipe (not run): 20, 80 and 200 expanded maps; alternate different
rows with no mutation. Count renderMapList invocations and removed/added row and
canvas nodes per click; attribute Object.keys CPU. Warm thumbnails for <=120;
report the 200-map cache-eviction case separately. Include folder/chord/same-map
controls. Expected narrow-fix result: one owner rebuild on a different-map click,
with O(M) rather than O(R*M) map-key enumeration, and preserved selection/focus.

## 3. NEW: selected Progress keeps cloning events after its ancestor collapses

Old-confirmed mechanism: visible Progress responds to tile/relief changes and
counts events using a payload-cloning helper. New issue: its hidden-pane guard
fails when the selected pane is collapsed instead of switching to another pane.

Trigger: click Progress, click the same activity button again to collapse the
sidebar content, then paint a continuous stroke with committed events present.

Source chain:
- /home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/aiSidebarWorkspace.ts:125: repeated active button click sets
  collapsed=true and calls sync().
- aiSidebarWorkspace.ts:96 hides the content parent, while :98 sets child hidden
  only from pane identity. Selected Progress remains root.hidden=false.
- aiSidebarWorkspace.ts:68 places Progress under that hidden content parent.
- /home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/leftProgressPane.ts:29 checks only root.hidden.
- leftProgressPane.ts:100 schedules every store notification; :101 retains only
  reference-issue results for tile/relief changes, not event counts.
- leftProgressPane.ts:33 invokes evaluateAuthoringJourney; :78 replaces its rows.
- /home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/authoringJourney.ts:65 obtains committedEvents(...).length on every map.
- /home/main/.codex/worktrees/e85c/rpg-zzu/src/project/eventDrafts.ts:51 -> :28 deep-clones normal event bodies. Edit drafts
  clone their original at :48; new/deleted drafts follow explicit exclusion rules.

Scaling: each coalesced render scans map/event collections and clones total
committed event/command payload B: roughly O(M + event count + B), plus allocation
and rebuilding the five stage rows. Tile painting does not change event counts.
No full-project test fingerprint hash is assumed on every paint: authoring change
tracking clears testedProjectFingerprint, which short-circuits that branch.

Guards: rAF coalesces notifications within a frame; disposed panes unsubscribe;
reference issues remain cached for cell/relief changes; selecting another pane
sets Progress.root.hidden=true. Collapsing the selected pane only hides its
ancestor, so it defeats the current guard. This does not concern document-hidden
rAF throttling; the editor document remains visible while the panel collapses.

Narrow remedy: sync each surface.root.hidden from collapsed || pane !== id,
then show() refreshes it when reopened. This avoids layout reads to test visibility.
For the separately confirmed visible-pane cost, use a count-only helper with the
same new/edit/remote-delete semantics, memoized by retained event-array identity;
skip replacing unchanged stage output. Do not cache counts by whole map identity,
which changes on tile edits, and do not drop invalidation on event/project changes.

Measurement recipe (not run): fixed map size; disposable 0- and 2,000-event copies,
with short versus long command payloads. Compare Progress visible, same Progress
selected but collapsed, and Tools selected during the same stroke. Count
committedEvents/structuredClone calls and Progress child replacements; collect
function CPU/allocation plus event-to-frame timing. Check own root.hidden and
parent hidden separately. After visibility fix: zero Progress evaluation/row work
while collapsed; reopening must show current counts and completion accurately.
