# Editor preview performance (2026-10-04)

Scope: round-two audit `verify-shots/editor-ux-audit-round2-20261004/agents/assets-idle.md`.
These changes are renderer/protocol code only; they do not author game content.

## Native shared catalog validators (O5)

`electron/main/protocols.ts` forwards the request's `If-None-Match` into
`sharedContentResponse(method, url, validator)` and preserves its status and ETag.
A 304 returns `new Response(null, ...)` before gunzip, byte copying or JSON serialization.
Successful gzip payloads still become plain JSON for app://; no unverified custom-protocol
content-encoding support is assumed. `no-store` is retained: the renderer's
`sharedContentCache` owns the scoped IndexedDB snapshot and sends conditional requests.
HTTP host and asset protocols are unchanged. Defaults/rest/all use the backend's scoped ETags.

`test/editorSharedCatalogProtocol.test.ts` defines contracts for conditional responses,
changed revisions, payloads and errors. It has not been executed in this worker.

Native QA: open the same project twice in Electron with its partition and catalog unchanged.
Record defaults/rest/all request validators, status, response ETag and transferred bytes.
The second request with a cached snapshot must return 304 with zero body bytes and no
main-process gunzip stack. Change the catalog revision through its existing authorized
publishing workflow: expect 200, a new ETag and the updated snapshot. HTTP measurements do
not establish app:// behavior.

## Parked, cached and hidden DB previews (O4/N1/N2)

`databasePreviewLifecycle.ts` owns weak DOM bindings, explicit modal activation and
one document visibility listener for activated previews. It has no MutationObserver.
`databaseModal.ts` sets its backdrop inactive BEFORE parked construction and activates
it on reveal. Close/discard disposes both the attached surface and detached tab-cache
entries through `disposeDatabasePanelPreviews`; orphan cleanup uses the same path.
`database.ts` changes here are lifecycle calls only: retain/pause before detachment,
activate after attachment, dispose on force-fresh/cache eviction/project invalidation.

The existing `stopSkillAnimationStagesIn`/`resumeSkillAnimationStagesIn` callsites
now route every registered DB preview, including battle animations. Transient record
replacement does not permanently disable the reusable detail host. Constructors draw
one static frame and activate once after synchronous attachment; queued activation
cannot override an explicit pause. A parked ancestor always wins over a child resume.
This covers normal skill sheets, retro class and monster skills, and enemy pixel sheets.

Playback preference belongs to each preview, independently of surface activity.
Reduced motion starts static; manual Play remains available where previously supported.
Explicit Stop and enemy still-cell selection survive hide/reveal and cached reattachment.
Retro timelines resume without accumulating hidden wall time or replaying buffered sound;
late sound-ready and battle image-load callbacks check activation/disposal. Active,
unowned detachment tears down on the next playback tick; record replacement teardown
settles at the microtask boundary. ResizeObservers are disconnected on final disposal.
No background assistant/session/transport pause is introduced.

Battle cell sprites keep a pool by index, allocating only when a frame exceeds the
previous cell count. Shorter frames hide surplus sprites; style patches preserve RM
scale, rotation, mirror and opacity. Chroma keying is applied on allocation/activation,
not per 15fps frame; coordinate patches do not overwrite its resolved background URL.
The former whole-body attachment observer is removed, not replaced with another observer.

Focused regression contracts: `databasePreviewHiddenSurface.test.ts` exercises actual
retro/enemy stages through parking, visibility, reduced motion, cache reattachment,
still-frame preference and disposal. `databaseAnimationCacheLifecycle.test.ts` now
expects zero body observers and covers real modal prewarm and stable sprite identity.
These contracts have not been run. esbuild transform verifies syntax only.

Browser QA (normal motion first, then reduced motion): remember Skills, Enemies with a
pixel-sheet record, and Battle Animations in separate reloads. Leave Database unopened
for ten seconds; preview running markers and preview rAF/67ms callbacks must stay idle.
Reveal, change tabs and return: running intent resumes, explicitly stopped/still previews
stay stopped, and retained nodes/images are reused. Repeat with a hidden document and
Electron minimized. Close while a preview tab is cached; no preview clock or resize
observer remains. Resolve an image/sound load after hiding/closing; it must not restart.
For 1/16/64-cell animation fixtures, count stage child additions/removals over ten seconds;
after the pool reaches its largest frame, equal-size playback has zero child replacements.
Stream assistant DOM while an animation is paused/cached: zero preview MutationObserver
callbacks; the assistant must continue its existing background work.

## Resource galleries and audio manager (O1/O2/O3/N3)

`resourceManagerViews.ts` caps either image layout at 80 entries per page. Search/filter
changes reset paging; next/previous reach every result. A recent import selects and
reveals its containing page even when the former filter was built-in only. Gallery
selection patches only the old/new active classes and ARIA selection, then updates the
inspector; it preserves gallery nodes, scroll and image elements. Grid and list images
use native `loading="lazy"`/`decoding="async"`; the selected inspector stays eager.

Charset cards observe intersection against their actual gallery scroller. Their existing
260ms interval is now a bounded ownership/visibility check: it loads/draws only an
intersecting card in a visible document/surface, yields to a registered modal above the
resource manager, and draws one static frame under reduced motion. All eight initial
cells are drawn together when the image becomes ready. Offscreen cards do not decode a
sheet by assigning its URL until first eligible visibility. Without IntersectionObserver,
geometry intersection is the fallback. Gallery replacement, category change and manager
close dispose tickers/observers explicitly; the former four-tick abandoned-attachment
limit and first-tick detached cleanup remain. No body observer is introduced.

`audioDescriptionEditor.ts` uses the existing `createVirtualList` with 32px uniform rows
and six-row overscan in a block scroller. The zero-height/detached fallback receives at
most 80 items until a measured viewport exists. A resize then feeds the complete results;
scrolling reaches the full catalog. Selection updates mounted row classes without
replacing them. Filtering resets scroll but retains search input, draft/caret and the
selected-outside-results notice. `resourceManager.ts` retains the SE/BGM shell, category
sidebar and file input while searching/selecting/editing descriptions. It swaps only a
changed detail/player and refreshes categories only when resource dependencies change.
Dirty save/discard/cancel and player release/close ownership remain in the existing editor.
The modal's repeated initialKind argument is an opening hint, preserving later tab choice.

Non-monster rendering never calls `listMonsterResources`. A raw registration count is
cached by profile references and uploaded-entry identity; full names/tags/descriptions are cached
only on monster-pane demand by those dependencies plus effective `monsterMetadata`. The inspector
uses the same ID index, without re-enumeration. Audio-description changes invalidate
neither cache. `store.update` preserves untouched profiles but shallow-copies the upload
dictionary and deep-clones override maps; the manager coalesces identical uploaded-entry
dictionaries and compares the small override map only on monster demand. No upload
bytes or full catalog metadata are serialized for this comparison. The catalog currently
exports no raw-ID projection, so the manager mirrors its registration rules locally:
generated retirement filters, raw ID dedupe, non-monster upload masking, dictionary-key
identity and profile registrations. `resourceManagerPerformance.test.ts` compares this
projection with the authority including shadow/retirement/orphan cases so future catalog
registration changes require synchronizing this narrow projection.

Focused contracts (not executed): `resourceManagerPerformance.test.ts` covers catalog
call counts/invalidation, count equivalence, both gallery page limits, recent import
reachability, zero gallery child replacements on selection, lazy image attributes,
SE/BGM shell/row retention, measured virtualization, dirty draft navigation and charset
visibility/reduced-motion/obscuration/cleanup. `resourceManagerMonsterCatalog.test.ts`
now checks full catalog reachability by paging/search rather than all cards in one DOM.

Browser QA: use a real project with >160 picture/face entries and a large SE/BGM catalog.
Select three cards at a nonzero scroll offset: gallery childList additions/removals must
be zero, with only two active-state patches. Type/delete a query, switch both layouts,
page to the last result and import another item: no page exceeds 80 and the import is
selected/revealed. Compare requests/decodes with cold and warm caches separately.
For charset grid, count canvas drawImage calls by card during five seconds at top/bottom,
under reduced motion, hidden document, an overlay and after close. Only visible eligible
cards advance; reduced motion draws static cells; closing removes all owned timers.
For SE/BGM, use a viewport with a measured 320px row area: expect roughly ten visible
rows plus at most twelve overscan rows, and stable shell/search nodes through query and
selection. Test empty/full filters, selected-outside-filter, draft save/discard/cancel,
caret retention, uploaded deletion and a single preview player. Instrument catalog calls:
SE/BGM search/select must make zero monster metadata calls; enter monsters once, select
three entries, then edit an audio description: one initial catalog computation, no extra
inspector calls. Upload masking/monster metadata edits must produce the correct counts
and effective inspector metadata. These are source guarantees/recipes, not measured
latency or CPU improvements.

Charset visibility uses the character strip bounds, rather than the card header. A title peeking into the viewport must not start the eight canvases still below its edge. Native normal-motion evidence is in `verify-shots/editor-ux-fixes-round2-20261004/extras-motion/`.
