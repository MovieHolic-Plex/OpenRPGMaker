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
