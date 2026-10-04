> Delegated read-only source review. Browser observations and final priority are in ../README.md; CODE-ONLY below describes this agent's own evidence. Supervisor baseline: 2cd0368b939bc5430ab8daa0e5ea52a38c5c5d00.

# Read-only UX performance audit, round 2: events and storage

Audited 2026-10-04. Checkout HEAD at close of source review: 2cd0368b939bc5430ab8daa0e5ea52a38c5c5d00, after #2061. HEAD changed during inspection from f54daa59f6; read-only git diff found no intervening changes in the inspected event-editor, history, store, clone, vault, and persistence paths.

No repository files were written. No servers/browsers, tests/gates/Vitest/typecheck/stash, git mutations, or model overrides were used. This report is the sole file written by this audit, outside the repository. Pre-existing untracked round-2 QA artifacts were left untouched.

All eight causal findings below are CODE-ONLY: reachable source work, not measured current latency. Prior measured event opening is discussed separately. N = authored command count; R = mounted command rows; I = active-page validation issues; S = selected paths; A = containing map content/bytes; P = whole project content; K = traversed history entries; E = total project events; D = total vaulted draft content. Depth/text size can increase the constants.

Read AGENTS.md, quickstart, INDEX coordinates, PROJECT_WIKI ownership sections, focused event-authoring/command-fixes/observability/project-persistence sections, and previous events, storage-undo, storage-undo-followup, dom-global, verification reports and before/after evidence READMEs. No project.sqlite was found under this checkout with the targeted filename search; browser IndexedDB was not accessed under the explicit no-browser constraint. No LegacyDb access was needed.

## Old hypotheses confirmed in the current code

### 1. Tab/Shift+Tab enumerates every focus candidate (CODE-ONLY)
Trigger: Tab in an open long event modal, including after List -> Story/Flow or zero-match search.
Source: /home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/eventEditor/modal.ts:969-988, especially :972 and :976.
Producer: /home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/eventEditor/commandList.ts:138-145 and :540-555; one head plus three buttons per ordinary row (~4R controls), before other modal controls.
Work: querySelectorAll + Array.from + offsetParent read for every candidate on EVERY Tab, although only the first/last boundaries are used. List retained after creation remains part of the query when hidden. Geometry can flush pending layout; this is NOT evidence of one reflow per read.
Guards: Tab only, top modal only, invisible candidates excluded after reads, trap teardown. Lazy initial views reduce uncreated candidates but do not avoid retained-row scanning.
Narrow remedy: cached first/last tabbable boundaries invalidated on body, visibility, disabled and nested-modal changes; native traversal inside boundaries. Skip known hidden subtrees before geometry when refreshing.
Measurement recipe: 100/1,000/5,000 flat commands, 20 Tabs each in List, List -> Story, and zero-match List; count queried candidates/offsetParent reads, key-handler CPU and style/layout trace; validate wrap and Shift+Tab.
Previous hypothesis: agents/dom-global.md. Current latency has not been measured.

### 2. One command move clones page history and containing map, then rebuilds the active body (CODE-ONLY)
Trigger: row/toolbar move arrow, or a completed same-container drag drop.
Sources: /home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/eventEditor/commandToolbarHistory.ts:93-102, :130, :141, :177; /home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/eventPages.ts:428 (arrow), :453 (drop); /home/main/.codex/worktrees/e85c/rpg-zzu/src/project/store.ts:854; /home/main/.codex/worktrees/e85c/rpg-zzu/src/project/projectClone.ts:183-185, :240; /home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/eventEditor/modal.ts:371, :412; /home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/eventEditor/commandList.ts:76.
Work: deep-clone N commands for history; COW map getter deep-clones all A (tiles plus all events/pages); stringify complete before/after command trees for no-op history detection; synchronous store notification stages/replaces dynamic body and creates every active List row. Badge work in finding 7 is additional.
Guards: 50 command-history entries; reentrant history changes bypass duplicate snapshots; unrelated maps, tilesets and uploaded assets share references; stable catalog retained; hidden views are now lazy. No-op checks INSIDE the map mutator and history finally happen after costly preparation.
Narrow remedy: event/page mutation with structural sharing of tile arrays and other events; reorder/history operations carrying source/target paths instead of full-page snapshots; replace only affected list range and dependent face/step summaries. Do not merely switch to updateMap, which also copies a map.
Measurement recipe: same 1,000-command event on 100x100 vs 512x512 map; move middle command one slot; count clone/stringify calls, allocations, created rows and synchronous handler CPU; separately profile mutation, history and active render; verify branches and undo/cancel.
Previous hypothesis: agents/events.md #2. Prior open timings do not measure move latency.

### 3. Sliced save still does unbounded whole-map comparison and wire conversion (CODE-ONLY)
Trigger: change one tile cell, autosave (current delay 1,500ms) or Ctrl/Cmd+S; keep interacting during save.
Sources: /home/main/.codex/worktrees/e85c/rpg-zzu/src/project/store.ts:258, :1458, :1471; /home/main/.codex/worktrees/e85c/rpg-zzu/src/project/persistence/electronRepository.ts:365; /home/main/.codex/worktrees/e85c/rpg-zzu/src/project/persistence/core/projectPatch.ts:36-41, :97-99, :145-150, :183.
Work: changed map falls through sameValue: two whole-map JSON.stringify calls, then two recursive canonical strings if they differ; changed patch map undergoes another JSON.stringify + JSON.parse. O(A) per changed map, regardless of one edited cell. Generator budget checked only after next() returns, not inside a map operation.
Guards: identical references skip comparisons; tilesets use trusted digest fast paths; yield between dictionary entries (12ms target, not a hard bound); only changed values sent; saves coalesce, preserve newer edits and retry stale host bases. No host wait is needed to incur renderer serialization.
Narrow remedy: identity-aware JSON equality traversing changed branches (skip unchanged rows/arrays); resumable or worker-based changed-map serialization/wire preparation preserving wire semantics and immutable submit snapshot. Chunking only between maps is insufficient.
Measurement recipe: 100x100/512x512/1024x1024 flat maps, one changed cell; warm baseline; profile sameValue, canonicalJsonString, toWireValue before IPC and host time separately; record input CPU/long tasks while a second edit occurs; verify reload and latest-edit retention in supervisor-owned storage fixture.
Previous hypothesis: agents/storage-undo.md #2. No native save measurement in original synthetic UI evidence.

### 4. Multi-entry history jump bypasses the guarded single-cell undo path (CODE-ONLY)
Trigger: confirm history row with steps > 1; equivalent redo-history jump; AI marker rewind reaches the same traversal.
Sources: /home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/tileHistoryMenu.ts:278-292; /home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/mapEditHistory.ts:508-518, :536-551, :159-165; /home/main/.codex/worktrees/e85c/rpg-zzu/src/project/projectClone.ts:127-131; /home/main/.codex/worktrees/e85c/rpg-zzu/src/project/eventDrafts.ts:77-81.
Work: initial structuredClone(current) copies full project, including assets/references; K applySnapshotToProject calls clone the remaining project (all map data) and separately restored map; reverse snapshot uses projectWithoutEventDrafts(current), cloning again. Rough work O(P + K * nonshared-project-content + sum(restored-map-bytes) + P). One final replace remains project scope.
Guards: integer/range checks, confirmation revision/project identity check, bounded history (50, large snapshot limit 25), only one final emit; per-entry clones SHARE tilesets/uploaded assets. Do not claim those assets are re-cloned K times. Single-step history rows use spec.step(), so use steps > 1 for this finding.
Narrow remedy: one isolated accumulator sharing immutable dictionaries, replacing only restored map/page branches; collapse redundant map snapshots while preserving traversal order across project snapshots; shared reverse snapshot; one final draft-aware replacement.
Measurement recipe: ten strokes; choose 10-step undo then multi-step redo; compare same active map in 1-map/12-map projects and then increase shared assets; profile initial clone, per-step clone, reverse snapshot and replace separately; validate final map and draft preservation.
Previous hypothesis: agents/storage-undo.md #3 and agents/verification.md #1. Excludes recently fixed guarded cell undo.

## Genuinely new relative to the previous area reports

### 5. Search performs a full DOM/text/filter pass per character, including a retained hidden list (CODE-ONLY)
Trigger: type one character into event-command-search, especially Story after first using List.
Sources: /home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/eventEditor/content.ts:527-535, :542-581, :733-756.
Work: enumerate every row and branch group; rebuild byPath, read/lowercase row text, build matches/ancestors, assign every row.hidden and query branch descendants. Both list and storyboard are filtered on every input even if one surface is hidden. O(R + row-text-bytes) for flat lists; ancestor and repeated branch-subtree work grows with depth.
Guards: no-row surfaces cost little; empty query avoids text scans but still resets every row; ancestor retention preserves matching descendants; Flow materializes list only for nonempty search. No debounce or unchanged-query guard. This is per-input scanning, not a repeat of the fixed eager hidden-view construction.
Narrow remedy: cache normalized summary text/path hierarchy per page version; compute matches from model, update only changed row visibility, and defer hidden-surface updates until activation; preserve ancestor/branch-group semantics and count across the whole page.
Measurement recipe: 100/1,000/5,000 commands; ten characters in List vs Story entered directly vs List -> Story; count text reads/hidden writes, handler CPU and candidate rows, including zero matches and deeply nested branches; verify matches, ancestors, IME/focus.
Previous events/dom-global reports do not identify this per-character filter path.

### 6. Selection paints every row; Ctrl+A makes membership comparison quadratic (CODE-ONLY)
Trigger: click a row; Ctrl+A on a command head; Tab/key on an unselected head additionally selects before shortcut dispatch.
Sources: /home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/eventEditor/commandList.ts:199-201, :223-227, :522-525; /home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/eventEditor/commandInspector.ts:78-95, :180-183; /home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/eventEditor/commandListContextMenu.ts:147-150.
Work: click clears selected class across all sibling list rows, then showCommandInspector calls notifyCommandSelectionChanged across every data-cmd-path row. Each row searches selectedPaths and repeatedly JSON.stringify(path). O(R*S); for flat Ctrl+A, S=R=N, roughly N(N+1)/2 membership attempts. Keydown preselection can add O(R) on Tab before modal trap.
Guards: selection surface scoped to current editor section; inspection keeps multi-selection only with preserveSelection; toolbar updates are bounded; Ctrl+A selection intentionally covers all authored commands including hidden ones. None indexes membership or tracks only changed selected DOM rows.
Narrow remedy: Set of pre-encoded selected path keys; row registry plus update only old/new selected rows for single selection; only select/refresh inspector for keys that need a command action; keep Ctrl+A full authored semantics.
Measurement recipe: 100/1,000/5,000 flat commands; alternating single clicks, Ctrl+A once, then Tab from an unselected head; count membership/stringify/class operations and handler CPU; verify multi-copy/cut, hidden selections and focus.
Previous reports mention Tab enumeration, not selection's R*S expansion.

### 7. Validation badges scan all active-page issues once for EACH command row (CODE-ONLY)
Trigger: move/edit one command or reopen/switch a List page containing many validation issues.
Sources: /home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/eventEditor/content.ts:163-164, :201-204; /home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/eventEditor/commandList.ts:164, :248-265; /home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/eventEditor/modal.ts:371, :412.
Work: every renderCommandItem calls issues.filter across the whole active-page array. O(N*I*path-depth), potentially O(N^2) when each command has an issue, added to full active-list render on a command mutation. Every matching badge also derives severity and title.
Guards: issues are restricted to active page first; zero issues produce no badge; each row has rendering error isolation; lazy inactive views excluded. No grouping/index by commandPath.
Narrow remedy: build Map(encoded command path -> issues) once per validation result, pass indexed lookup to the row renderer; preserve severity/title/count.
Measurement recipe: fixed 1,000 commands, vary I=0/10/100/1,000 with valid-shaped missing-resource commands producing issues; move one row; count issue predicate calls and separate validator time from badge time; compare 100/1,000/5,000 with I proportional to N; check issue destinations/counts.
No previous area report isolates this multiplier.

### 8. Draft synchronization/persistence scans all events and serializes all vaulted drafts (CODE-ONLY)
Trigger: edit/reorder with open event drafts; settled 250ms vault timer or explicit project Save.
Sources: /home/main/.codex/worktrees/e85c/rpg-zzu/src/project/store.ts:871, :1428-1429; /home/main/.codex/worktrees/e85c/rpg-zzu/src/project/eventDraftVault.ts:73-94, :96-100, :252-267, :305; /home/main/.codex/worktrees/e85c/rpg-zzu/src/project/projectClone.ts:184, :240.
Work: sync enumerates every map/event even without changes. Identity cache skips unchanged draft copies, but whole-map COW gives affected-map events new identities and can clone their draft/original command content again. Persist enumerates ALL vault entries, deep-clones every event, JSON.stringify the full payload and synchronous localStorage.setItem. O(E + newly-copied-draft-bytes) during update/sync; O(D) per settled vault persist/save. This is separate from canonical project-save diff.
Guards: event identity WeakMap; non-draft events skip clone; 250ms debounce; empty vault removes storage item; no localStorage -> no write; exceptions caught. There is no dirty revision/serialized-payload cache for nonempty vault, and savedAt changes each persist.
Narrow remedy: event/map-scoped vault synchronization with maintained draft index; revision tracking and unchanged-payload skip; serializing retained immutable entries without pre-cloning; ensure crash recovery and explicit flush remain correct. Debouncing alone does not bound a full payload write.
Measurement recipe: same 1,000-command active draft, 1 vs 10 long vaulted drafts; then many unrelated events/maps; edit one label or move once and wait for existing debounce; measure sync, listEventDraftVaultEntries, stringify, setItem separately; compare repeated save with unchanged drafts and verify crash recovery in supervisor fixture.
Previous storage reports discuss draft reconciliation during undo, not this full-vault persistence path.

## Existing measurement, kept separate from causal CODE-ONLY claims

/home/main/.codex/worktrees/e85c/rpg-zzu/verify-shots/editor-ux-improvements-20261004/README.md reports post-fix 1,000-text-command List opening at 2,153ms vs 3,521ms before. One opening per condition, automation input -> two rAF, Vite Chromium 1440x900, reduced-motion, synthetic fixture, no host save/model calls, hydration omitted. This supports remaining overall opening cost, not a timing attribution to badges, selection, Tab, search or move. Active List still synchronously creates all rows at commandList.ts:76 and recurses branches; there is no List virtualization/window or per-frame mounting budget. Remedy is windowed/staged active-row mounting preserving path selection, ancestor visibility, DnD and keyboard focus; measure same original fixture before/after.

The incomplete pre-existing round-2 measurements file seen during this audit contained life-collection cases only, not evidence for these paths.

## Boundary checks / not repeated as findings

- Lazy Story/Flow/List initial construction and idempotent same-mode application are fixed; excluded as problems.
- Guarded small tile single-step undo is fixed; excluded. Multi-entry jump is a separate direct traversal.
- Save receipt contentIdentity is lazy (store.ts:1500), so ordinary saves do NOT necessarily hash the full project at receipt creation.
- Local save compares full saved/submitted documents only when savedProject !== submittedPrivate (store.ts:1527); no unconditional comparison claim.
- Dragover measures the target row only; no full-list scan established per dragover. Dragend's selector is one-time cleanup.
- Old baseline warmup hypothesis remains at store.ts:998-1009, scheduleIdleWork :1816-1819: one unbounded idle traversal with lineage/baseline and digest-cache guards. It is load/reload scheduled work, not O(N) on each input, so omitted from the per-input shortlist. Measure cold/warm open while typing and separate digest preparation from interaction.
- Post-save manual commit logging is scheduled/coalesced at projectCommitLog.ts:151-181, but one idle callback can remain unbounded. This audit did not complete a new independent attribution through manualDiffFromBaseline and transport; no extra definitive finding made.

Suggested first measurement order: Ctrl+A membership slope; command move with fixed N and varied A; Tab candidate/geometry cost; search with hidden retained list; save serialization and vault stages; K-step history traversal with unrelated maps. Recipes above are prospective and were not run.
