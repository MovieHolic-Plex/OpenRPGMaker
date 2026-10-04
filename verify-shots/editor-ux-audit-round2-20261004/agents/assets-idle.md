> Delegated read-only source review. Browser observations and final priority are in ../README.md; CODE-ONLY below describes this agent's own evidence. Supervisor baseline: 2cd0368b939bc5430ab8daa0e5ea52a38c5c5d00.

# Round 2: resources, hidden previews, idle animation

Read-only source audit at /home/main/.codex/worktrees/e85c/rpg-zzu, HEAD f54daa59f6.
All mechanisms below are CODE-ONLY: source reachability confirmed; latency, CPU utilization and native minimized behavior are not measured here. No repository writes, tests, server/browser starts, git mutations or model overrides. Only this /tmp report was written. Existing untracked round-2 files appeared during the investigation and belong to other work.

Read AGENTS.md, quickstart, INDEX, PROJECT_WIKI, focused editor routing/observability/audio workflow sections, first-round assets/startup-idle/global DOM reports and before/after evidence. No project.sqlite was found in this checkout. Browser IndexedDB was not inspected because browser access was prohibited; no legacy service was queried.

## Evidence boundary

PR #2061's recorded improvements concern inventory input, small tile undo, and inactive event views. Existing Chromium runs used reduced motion and synthetic fixtures with shared content hydration disabled. They do not measure autoplay, native protocol caching, offscreen resource draws or repeated gallery interactions.

A resources cold-open sample exists: audit measurements.json records 213 ms input-to-two-rAF and a 75 ms long task; improvements measurements.json records 260 ms and a 96 ms long task. Each is one sample including automation/frame waits, so this is neither a regression determination nor attribution to any mechanism below. resources-open.png proves a surface was opened, not where CPU time went. The concurrently present round-2 measurements cover life collections only, with reduced motion; they add no evidence for these findings.

## Old hypotheses confirmed in current code

### O1: every image selection/search rebuilds the matching gallery
Trigger: open Resources, choose chipsets/faces/pictures, click another card or edit search.
Sources: /home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/resourceManagerViews.ts:382 (clears list), :436 (all cards), :441 / :446 (selection reenters rendering), :485 (each search input), :632 (full-URL image element).
Work: O(category catalog + matching cards) synchronous filtering and DOM allocation. Full image URLs are assigned eagerly. Warm image decoding/network reuse is browser-managed; repeated decoding is not established.
Guards: alias deduplication and browser cache; no pagination/lazy loading on these cards. The separate expression chooser updates selection in place, so exclude it.
Narrow remedy: retain card DOM for selection and update the two active cards; use bounded pages/lazy image thumbnails for search results.
Recipe: same cold/warm catalog, three selections and a typed/deleted query. Count gallery additions/removals and image requests; profile scripting, style/layout and long tasks separately. Expect no gallery replacements on selection.
Platform: shared renderer path, browser and Electron.

### O2: connected charset cards animate even below the gallery viewport
Trigger: Resources -> Charset/Battle Charset grid, idle at the top, scroll, or obscure the modal.
Sources: /home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/resourceManagerViews.ts:509, :520, :528, :563, :592.
Work: one interval per connected card; eight 24x32 canvas clear/draw operations every 260 ms after its image is ready. For N loaded cards, about 8N / 0.260 draw calls per second, independent of the visible card count.
Guards: stop after detachment; abandoned cards wait at most four ticks. These fixed leaks must not be reported as still present. No viewport/document visibility or reduced-motion guard in this ticker.
Narrow remedy: animate only intersecting cards in the gallery scroller; suspend when the owning surface/document is hidden; honor reduced motion.
Recipe: count CanvasRenderingContext2D drawImage calls from charset canvases over five seconds at top/bottom, list mode, hidden document, and after close. Attribute visible/offscreen cards separately; after close allow attachment cleanup to settle.
Platform: shared renderer path. Native minimized/background frequency needs its own trace.

### O3: resource-manager audio selection/search bypasses picker virtualization
Trigger: Resources -> SE/BGM, choose another row or type/delete search.
Sources: /home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/audioDescriptionEditor.ts:44, :110, :146, :159; /home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/resourceManager.ts:66.
Work: enumerate/filter all audio resources, instantiate every match, rebuild the resource workbench. O(audio catalog + matches), plus N3 below. Database resource-picker virtualization does not cover this manager.
Guards: selecting the same row is a no-op; dirty description input is retained; detail/player release and disposal exist. No repeated audio decode claim.
Narrow remedy: reuse createVirtualList for manager rows and keep the workbench mounted while filtering/selecting.
Recipe: empty/full search in SE and BGM; count audio-resource-row nodes and replacement nodes for three selections/keystrokes; verify description focus, dirty transitions, selected-outside-filter notice and one active preview player.
Platform: shared renderer path.

### O4: parked startup Skills preview still autoplays
Trigger: remember Skills, reload editor, leave Database unopened and reduced motion off.
Sources: /home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/databaseModalLazy.ts:31 / :58; /home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/databaseModal.ts:705 / :714 / :723; /home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/databaseSkillRetroStage.ts:853 / :871 / :926.
Work: the connected but visibility:hidden stage evaluates a timeline and updates actors/effects each rAF, including repeat resting ticks. Cost grows with active effects/targets.
Guards: reduced motion suppresses autoplay, close/tab change stop controllers, two detached ticks stop abandoned stages. Parking stays connected and does not call stop.
Narrow remedy: make prewarm construct a suspended stage; use explicit surface activation/deactivation to resume/stop all preview types. A one-time stop alone is insufficient where image-load callbacks or observers can restart a preview.
Recipe: running markers/rAF callbacks and scripting samples for ten seconds before Database opens; then open/close. Repeat with reduced motion on, tab hidden, and native window minimized.
Platform: foreground browser reproducer is reachable; Electron backgroundThrottling:false at /home/main/.codex/worktrees/e85c/rpg-zzu/electron/main/main.ts:78 and teamWindow.ts:37 makes native background scheduling a separate hypothesis.
Newly traced sibling, same visibility defect: remembered Enemies with a pixel-sheet record starts idle rAF at /home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/databaseEnemyPixelPreview.ts:440; tick :330 only checks connection and redraws even when the idle cell is unchanged. Reduced-motion/detachment/close guards exist. This is expanded coverage of O4, not an independent new root cause.

### O5: Electron catalog protocol still drops conditional cache validation
Trigger: launch/reopen unchanged project in native app:// with unchanged catalog, same profile.
Sources: /home/main/.codex/worktrees/e85c/rpg-zzu/electron/main/protocols.ts:64; /home/main/.codex/worktrees/e85c/rpg-zzu/src/project/sharedContent.ts:92 / :97 / :98; /home/main/.codex/worktrees/e85c/rpg-zzu/scripts/lib/sharedContentSqlite.ts:207 / :215 / :277.
Work: native protocol omits the optional If-None-Match argument and response ETag. Successful responses gunzipSync, copy into Uint8Array on the main process, and parse in renderer. O(uncompressed response bytes); no reuse-cache write without ETag.
Guards: cached server compressed representation and scoped defaults/rest; HTTP middleware forwards validator and returns 304. Dev HTTP performance does not test this native defect.
Narrow remedy: pass request validator, preserve ETag/status, return a bodyless 304 before inflation.
Recipe: compare two native launches with the same partition/project/catalog revision; record scope, status, validator, response ETag and bytes plus main-process inflate/renderer parse stacks. Distinguish app:// from team HTTP host paths.
Platform: Electron app:// only; no native measurements here.

## Newly identified mechanisms (not regressions introduced by #2061)

### N1: battle-animation preview repeatedly allocates every cell DOM node
Trigger: Database -> Battle Animations with a valid sheet/frame cells and reduced motion off; also reachable at startup when that tab is remembered and parked.
Sources: /home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/databaseAnimationPreview.ts:12 / :31 / :272 / :348 / :355.
Work: approximately 15 ticks/sec, each maps the entire frame.cells array to new styled divs and replaces the layer children. About 15C node creations/sec for C cells; invisible cells still create muted DOM. This allocation/DOM churn is a new mechanism, although its hidden-window trigger shares O4's missing visibility contract.
Guards: image readiness/visible-cell bounds validation, disposed state, timer uniqueness, reduced motion and detachment. isDisconnected at :412 checks only attachment, never hidden/parked state.
Narrow remedy: reuse cell sprites by index and patch changed properties; pass explicit surface-active state through start, image load and observer callbacks.
Recipe: 1/16/64-cell equal-length animations, count added/removed cell nodes and timer ticks over ten seconds visible and parked. Test reduced motion and reopening retained tab; profile scripting/GC separately. These are proposed fixture sizes, not existing measurements.
Platform: browser and Electron renderer; native background scheduling separately.

### N2: animation preview subscribes to every document-body structural mutation
Trigger: create a Battle Animations preview, pause it or switch to a cached sibling tab, then type in another UI, stream assistant DOM, or update lists/toasts.
Sources: /home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/databaseAnimationPreview.ts:287 / :306; /home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/database.ts:1138 / :1319.
Work: each delivered document-body childList batch calls the preview observer even for unrelated UI. Connected panels run two closest lookups and attempt start; cached detached panels run containment/stop checks. O(retained observers x delivered mutation batches). N1's own replacements also wake it.
Guards: MutationObserver batches records; timer uniqueness avoids multiple playback loops; record replacement/cache eviction/modal teardown disconnect observer. No whole-document scan or permanent leak is claimed. Pausing playback does not disconnect the observer.
Narrow remedy: move pause/resume/dispose to tab-cache/modal lifecycle ownership; stop observing the entire body. If retaining an observer, restrict it to the attachment boundary and ignore descendant cell mutations.
Recipe: collect observer callback attribution for ten seconds while stopped, cached, and evicted; exercise unrelated assistant/list DOM. Expect zero preview callbacks from unrelated subtree updates after lifecycle routing. Verify cache reattachment still resumes intended playback.
Platform: shared renderer path; no new live measurement.

### N3: non-monster workbench refreshes fully build monster metadata
Trigger: Resources -> BGM/SE search or row change (O3), or switch any resource category.
Sources: /home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/resourceManagerViews.ts:63 / :64 / :120; /home/main/.codex/worktrees/e85c/rpg-zzu/src/assets/monsterResourceCatalog.ts:34 / :42 / :47 / :52 / :55 / :58.
Work: listMonsterResources runs before checking selectedKind; scans generated assets/IDs, profiles/uploads, constructs metadata/tags for all deduplicated monsters, just to supply a category count when another category is open. dedupeListedProfiles separately runs over all categories. O(generated plan + generated IDs + profiles + uploads + monsters) per whole-workbench refresh; no full-catalog caching here. getMonsterResource at :84 independently repeats enumeration for a monster inspector selection.
Guards: raw-ID deduplication, upload precedence, retired-ID exclusion; these preserve correctness but do not skip non-monster work.
Narrow remedy: reuse a catalog/count projection keyed by actual monster/resource dependencies; compute full metadata only for the monster pane; use an indexed lookup for inspector. Do not invalidate on audio-description changes.
Recipe: hold audio catalog constant, vary unrelated monster/profile/upload counts, repeat SE search/select, record listMonsterResources call count/time and allocation stacks. Compare cached count correctness after upload/metadata changes. Impact is unmeasured and should rank below N1 until profiled.
Platform: shared renderer path.
