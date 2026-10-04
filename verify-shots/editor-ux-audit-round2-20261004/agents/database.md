> Delegated read-only source review. Browser observations and final priority are in ../README.md; CODE-ONLY below describes this agent's own evidence. Supervisor baseline: 2cd0368b939bc5430ab8daa0e5ea52a38c5c5d00.

# Read-only UX audit round 2: Connections and Life collections

Workspace: /home/main/.codex/worktrees/e85c/rpg-zzu
Read-only HEAD: 2cd0368b939bc5430ab8daa0e5ea52a38c5c5d00. Findings describe inspected source, including any working-tree content; no claim that this HEAD is PR #2061.
Evidence status: CODE-ONLY for all findings. No browser, server, test, gate, typecheck, git mutation, or repository edit was performed. Catalog description/virtualization changes are excluded.
Prior comparison: verify-shots/editor-ux-audit-20261004/agents/database.md reported three hypotheses without timings. Its #2 and #3 are confirmed as source paths below. The new focus issue was not reported there or in the other agents' reports. Existing editor-ux-improvements artifacts do not establish dedicated Connections/Life timings.

## 1. Old hypothesis confirmed: name typing synchronously scans all event references

Concrete native action: toolbar-database → db-group-strip-party → db-tab-skills → select the probe skill → type 20 characters into db-field-name while Connections is mounted.

Exact path (all source paths below are absolute):
- /home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/databaseRecordViews.ts:960 uses textField and calls updateDatabaseRecord(collection,id,{name:next}).
- /home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/databaseControls.ts:11 handles each input synchronously.
- /home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/databaseActions.ts:248 calls store.updateDatabase.
- /home/main/.codex/worktrees/e85c/rpg-zzu/src/project/store.ts:908 makes a new Project root, :916 emits, and :1214 iterates listeners synchronously.
- /home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/databaseModal.ts:389 calls connections.paint before the editing/grace guard at :390.
- /home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/databaseConnectionsPanel.ts:63 skips only the same selection AND same Project identity; :67 calls recordConnections.
- /home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/databaseRecordConnections.ts:157 calls commandsReferenceLocations; :165 caps uses only after computation.
- /home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/databaseCommandReferences.ts:23 walks common events, map events/pages/draft bodies, troop battle pages/after-battle branches.

Scaling: O(database relationship content + event command/condition content) in the worst case, per input. Each command list and some nested predicates short-circuit on a match; no-match lists or matches at their ends expose the full traversal. The display limit is 40 total uses, with three previews per kind; neither limit bounds traversal. If no direct uses exist, recordConnections :162 can call the deletion-reference helper, which for skills can scan commands again at databaseRecordReferences.ts:75. Use a reference at the END of a long common event to avoid this fallback and isolate the single scan.

Guards: collection-only cloning, coalesced undo, project/selection stamp, body editing/grace and rAF refresh guards. The latter protect body redraw, not Connections work. CSS also hides Connections below a 1180px viewport/container and in dock mode (/home/main/.codex/worktrees/e85c/rpg-zzu/src/styles/database/studio-refresh.css:188); paint has no corresponding visibility guard.

Narrow remedy: cache incoming uses by the reference-bearing data, independent of the Project root and presentation fields. Update local checks separately. Keep invalidation for actual reference changes, referenced names, selection and project switch. Do not skip all database changes blindly.

Measurement recipe (future, not run): use two equivalent native fixtures with 100 versus 10,000 text commands followed by one learnSkill reference; same records/maps/layout otherwise. Focus name once and send native key presses, not direct callback calls or fill-only automation. Attribute synchronous input-task time and CPU samples to recordConnections/commandsReferenceLocations; record input-to-next-frame, long tasks, name value and retained focus. Warm tab opening first; repeat equal sequences. Report hardware, viewport, fixture counts and source revision; do not call automation wall time CPU time.

Additional trigger of the SAME scan defect, not a separate fourth finding: databaseConnectionsPanel.ts:68 clears lastKey during expand/collapse; :137 calls repaint. The same unchanged project is rescanned on every .db-connections-more click. Seed at least four matching common events; select [data-testid="db-connections-uses"] .db-connections-more. A narrow repair can rerender the expansion state using already-computed uses/checks.

## 2. Old hypothesis confirmed: Life search constructs all hidden fish inspectors

Action: toolbar-database → db-group-strip-life → db-tab-life-collections; type an absent fish name into [data-testid="db-life-collections-search"], pause, then clear the query or select [data-testid="db-life-collections-row-fish-fish_ux_r2_1"].

Exact path:
- /home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/databaseWorkspace.ts:179 implements the input listener and :185 a 90ms debounce.
- /home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/databaseLifeCollectionsView.ts:101 calls rerender.
- /home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/database.ts:1161 forces a fresh render, :1137 evicts cache, :1147 replaces body children, :1243 calls renderLifeCollectionsTab.
- /home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/databaseLifeCollectionsView.ts:121 iterates EVERY fish, :122 creates each inspector, :351 supplies ALL items, :797 creates one option per item.
- :200 attaches the already-built inspector before :202 adds hidden.
- :89 also constructs all fish list rows and uses :817 itemName's linear item lookup before filters/search discard rows.

Scaling: F fish × I items yields exactly F×I fish-dropdown option elements per completed redraw, plus O(F×I) option-data creation and worst-case name lookups. F=100 and I=1000 implies 100,000 fish options, 99 hidden inspectors when one is selected. This is an inferred node count, not a measured latency. No-match search does not change inspector selection/building. The system cards additionally rebuild two I-sized chip sets even when collapsed (:631/:639/:763).

Guards: 90ms input debounce, hidden inactive panels, tab revisit cache, detached-tab callback check at database.ts:1157. Fresh search explicitly bypasses the cache. Debounce reduces redraw frequency, not redraw size. The schema caps fish at 500; a 100-fish fixture is valid.

Narrow remedy: filter plain record data before constructing rows; create the selected inspector only and reuse it through search-only updates. Preserve inspector testids when mounted and prove compatibility with existing tests that currently expect hidden DOM. Search should update list/count rather than force the full tab renderer. Reuse an item-name lookup map for row summaries.

Measurement recipe (future, not run): F=10/100 × I=100/1000, native search absent-name → clear → choose another fish. Measure debounce time separately from callback/build/layout time. Count options with [data-testid^="db-life-collections-fish-item-"] option; count hidden panels with [data-testid^="db-life-collections-panel-fish-"][hidden]. Observe removed/added subtrees under .db-body and count descendant options, not just top-level MutationObserver nodes. Include render CPU, heap/GC and time until stable paint. First select a single known fish and keep other collections empty for an isolated fixture.

## 3. Genuinely new UX issue: debounced Life search drops focus/caret

Action: focus db-life-collections-search; type one character, wait beyond the 90ms debounce and redraw, then type another without refocusing. Also try editing in the middle of an existing query. The code predicts that redraw blurs and replaces the control; subsequent typing no longer targets that search.

Exact path:
- /home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/databaseLifeCollectionsView.ts:101 calls full rerender without focus restoration.
- /home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/database.ts:1039 calls commitFocusedControlIn before rendering; :1015 explicitly calls active.blur(); :1147 removes the search node.
- databaseLifeCollectionsView.ts has no restoreFocusAfterRerender call. Database renderer's restoration is scroll-only (:1061). Modal focus trap handles Tab boundaries only (databaseModal.ts:770), not search focus recovery.
- /home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/databaseWorkspace.ts:165 says callers own focus/caret retention. A neighboring native caller explicitly restores search focus in /home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/databaseUtilityRecordViews.ts:548.

Scaling/heavy work: occurs even with one fish/item after a typing pause; larger F×I makes recovery later and carries issue #2's reconstruction cost. This finding is a distinct user-visible focus loss, not a second count of the same rendering cost. CODE-ONLY; no browser observation claimed.

Guards: debounce retains query text in module state; renderer commits dirty fields and restores scroll. None preserves the search control/caret here.
Narrow remedy: retain the search element while updating results. If a full redraw remains, preserve focus and selectionStart/selectionEnd/direction only when search still owns focus; do not steal focus after the user switches controls.
Measurement recipe (future, not run): use tiny and large fixtures; insert a character at query midpoint, wait until old node disconnects/new node is attached, inspect document.activeElement and selectionStart/End, then send a second native key without another locator click. Compare against rapid typing below 90ms. Fill alone would hide the defect. Log input timestamps, focusout/blur, redraw completion and whether the second character enters the search value.

## Native fixture schema and selectors (recipe only)

Start from a normalized native Project using /home/main/.codex/worktrees/e85c/rpg-zzu/src/project/defaults/blankProject.ts:79, or the existing E2E seed route /home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/devShowcaseProjects.ts:93. The supplied event-pages-v3 fixture contains minimal v3 skill/item rows; normalize/migrate it before adding native fields, as scripts/qa/editor-ux-forms-audit.mjs does. This audit created no game-content fixture and made no canonical-store writes.

Connections:
- Keep the existing base records and references intact; append normalizeSkillRecord({id:'skill_ux_r2',name:'UX probe',description:'Probe',scope:'enemy',power:10}) using /home/main/.codex/worktrees/e85c/rpg-zzu/src/project/databaseRecordModel.ts:668.
- CommonEvent fields are {id,name,trigger:'none',commands}; schema /home/main/.codex/worktrees/e85c/rpg-zzu/src/project/types/events.ts:824. Long event commands: C copies of {kind:'text',body:'unrelated'} followed by {kind:'learnSkill',actorId:<existing actor id>,skillId:'skill_ux_r2'}. actorId is required (events.ts:421). trigger none prevents automatic execution.
- Select db-record-card-skill_ux_r2 or db-record-row-skill_ux_r2 according to list/gallery mode; input db-field-name; panel db-connections; uses db-connections-uses.
- Use a wide undocked modal and confirm computed display/geometry rather than assuming 1440 viewport makes panel visible. Container and viewport hide rules both apply.

Life:
- Total items I includes base items. Preserve all existing items to avoid dangling old references, and append distinct normalized generic items until total I is reached; normalizeItemRecord is /home/main/.codex/worktrees/e85c/rpg-zzu/src/project/databaseRecordModel.ts:735. For a smaller-I fixture choose a base that already has at most I items. IDs/names can be item_ux_r2_0 / Item 0000, etc.
- Fish record is {id:'fish_ux_r2_0',name:'Fish 0000',itemId:<existing valid item id>,skillXp:1}; no coordinates, sprite or catch table are required. Schema /home/main/.codex/worktrees/e85c/rpg-zzu/src/project/types/database.ts:1095; shape validation /home/main/.codex/worktrees/e85c/rpg-zzu/src/project/io/shapeDatabaseFields.ts:272; P2_RECORD_LIMIT=500 at /home/main/.codex/worktrees/e85c/rpg-zzu/src/project/p2FoundationRecords.ts:18. Reference validation rejects absent itemId targets (io/references.ts:273).
- Use a disposable base with no fishing spots/forage areas/museum rewards to isolate fish. Do not click 'make defaults', which seeds other content and changes counts. Record actual F/I after normalization.
- Native selectors: toolbar-database, db-group-strip-life, db-tab-life-collections, db-life-collections-chip-fish, db-life-collections-search, db-life-collections-row-fish-<id>, db-life-collections-panel-fish-<id>, db-life-collections-fish-item-<id>.
- Search matches fish name/id, not item labels (:280). Use an absent fish name/ID to force zero matches; searching item labels is not an implemented item-search feature.

No timing, runtime focus assertion, test pass or canonical save claim is made by this report.
