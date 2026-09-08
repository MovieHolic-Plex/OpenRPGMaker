# Shared spatial authoring controller

## Status and ownership

Task11's backend supports object, space and place authoring through the real project
store and existing project/map history. It consumes task34's explicit overview
associations. This is not whole-task11 acceptance: geography compiler integration,
real panel wiring, Q2/Q3 browser acceptance and the lead's combined build remain open.

The public types are in `src/editor/spatial/authoringTypes.ts`, originally published
in `5a0eddd43c30b6345b494024ebbc34c12443792a`. The runtime factory is
`createSpatialAuthoringController()` from `src/editor/spatial/actions.ts`.
There is no panel-specific persistence, history, activation or save-token authority.

## Panel contract

1. Obtain a controller and call `createDraft()`.
2. Edit the returned draft's detached `project`, using the existing typed project
   and spatial domain fields. Keep the original draft handle: constructing a new
   `{ project: ... }` wrapper loses its private baseline and returns `foreign-draft`.
3. Call `preview(draft, { operation, compile? })`. Inspect the returned frozen project
   and its map, occurrence and exact changed/removed-event impacts.
4. To keep editing a displayed proposal, call `continueDraft(preview)` and keep
   the new issued draft handle. Edit its detached project, then preview only the
   next requested operation. The common `editAuthoringDraft` helper does this
   automatically; it never reconstructs a draft from copied preview output.
5. Call `apply(preview)` only after explicit acceptance. A preview belongs to its
   issuing controller and can be accepted once. A new identical proposal is a no-op,
   not an extra history step.
6. `undo()` and `redo()` traverse the existing global editor history. They are not
   private panel undo stacks.

Results discriminate on `kind: "ok" | "error"`. Errors expose `code`, `message`
and optional `detail`; expected invalid input, unsupported compilation, stale
baselines and ownership rejection do not mutate live state.

Operations are `edit`, `instantiate`, `clone-occurrence`, `clone-design`,
`delete-occurrence`, `delete-design`, `detach` and `refresh`. Instantiation,
duplication and deletion use the existing domain request types. Source deletion
rejects strong references but retains historical snapshots. Duplication copies
frozen occurrence content instead of expanding today's source.

Compilation is explicit. Object compilation requires the existing stamp target
(map, rectangle and entry); spaces and places generate their own output. Editing
a library source alone never refreshes or recompiles an existing occurrence.
Refreshing compiled content requires an explicit compile request. Refresh matches
retained children by stored parent-slot associations and ports by stored local-port
associations, preserving opaque persisted IDs. Explicit refresh restores today's
source quantity even when the frozen tree is sparse. Missing occurrences and ports
reserve persisted identities before deterministic allocation, including identities
retained later in the transitive traversal; constructor spelling cannot alias a
surviving sibling or its descendants. Removed ports are released only after the
previous owned raster digest passes preflight.

AV11-01's permanent regression is `test/spatialAuthoringRefreshCollision.test.ts`:
the legal deleted-index-0 / renamed-index-1 fixture retains both indexes through
compiled preview, apply and project IO. Ordinary sparse and transitive opaque-ID
controls remain covered, plus missing-floor occurrence/port collision cases.
Scoped RED/GREEN evidence is in
`output/evidence/tile-to-world/task-11/refresh-identity/Scope.json`; this correction
does not resolve the independent AV11-02/AV11-03 findings or grant task11 acceptance.

Raw draft map/mapConnection/map-tree edits and forged binding changes are rejected.
Use the ordinary map editor for human raster edits. Use `detach` explicitly to
release ownership while retaining pixels, events and navigation. Compilation still
rejects stale owned raster; this controller does not implement an implicit force
replace. A compiled projected child must be recompiled through its actual owning
composition when its rendered output needs to change.

## Editable preview continuation

Continuation preserves the whole proposal, including earlier source edits and
already-previewed compile, delete or clone results. It does not replay those
operations, auto-apply them, or refresh compiled output when an ordinary edit is
made. Repeated previews of the same draft still operate on that draft's original
input; preview itself does not advance or mutate the draft.

Only the issuing controller's exact frozen preview can establish a protected
checkpoint. `continueDraft` returns a separate editable copy, while its private
checkpoint remains immutable. Raster, mapConnections, map-tree and binding guards
compare against that checkpoint; copied/fabricated preview wrappers and copied
generated output in a fresh raw draft confer no authority. Manual changes to a
continued draft's protected fields still reject.

The original live-project fingerprint survives every continuation. Final impact
is the difference from that original live project, not merely the last checkpoint.
One explicit acceptance commits the complete proposal, and one undo/redo restores
its exact before/after states. Continuation rejects foreign, stale, already-applied
and in-flight previews using the same consumed-handle guard as apply. Undo does
not revive a consumed preview, even when it restores the original baseline.

## Atomicity and stale checks

A private draft/preview handle captures a SHA-256 fingerprint of the full current
project plus project identity. This includes editable sources, shared assets,
maps/events/mapConnections and the **entire logical spatial document**, including
`overviewRoute` and `overviewEntries`. Association-only changes invalidate a
preview even when every raster digest remains identical. Changed source/project
content invalidates both preview generation and later apply before mutation.

The preview compiler operates only on detached copies. Apply validates project IO
again, then performs one `store.replace` through `applyProjectWithHistory`.
The store's narrow `commitHistory` hook publishes the history snapshot after local
adoption but before synchronous mutation observers. Consequently observers see
project and history together, and a subscriber's later edit gets the later undo
entry. Rejected store writes preserve both undo and redo stacks. Event-draft,
canonical activation, raw snapshot and CAS recovery behavior remains in the store.

## Exact connection cleanup

Delete/refresh consumes `inspectOverviewEntryChanges` and the actual event-owner
records. Both source and return owners, their raster digests, actual automatic
transfer events and exact mapConnection projections pass preflight before cleanup.
World-entry-only dependencies are included even without a logical route. Removing
one route may orphan another marker; the domain metadata fixed point determines
those impacts, rather than a coordinate or ID-spelling heuristic.

Only the impacted event IDs are removed from surviving maps. Binding event lists
and digests are updated; unrelated terrain/events remain untouched. Deleted owned
rectangles use the existing ownership-release compiler seam. Ordinary stair/door
links resolve their concrete endpoints and explicit event ownership too, so
removing a middle floor cannot leave outside transfer events behind. The existing
strict automatic-transfer validator is shared, not reimplemented.

Detach remains different from delete: domain proof is pruned, but existing map
output/navigation stays as unmanaged content. No whole overview raster is erased
merely because one of its entries points into the deleted subtree.

## Verification and remaining integration

The focused controller tests cover detached previews, object/space/place output,
source-only edits, source/instance cloning and deletion, refresh, repeated apply,
no-op acceptance, foreign handles, stale source/tile/association edits, ownership
forgery, failed apply preserving redo, nested synchronous observers, exact
undo/redo and incoming overview/ordinary connection cleanup.

Permanent `spatialAuthoringContinuation*.test.ts` regressions drive the real shared
helper/controller/store/history seam. They include both independent AV11-03
compile/delete cases, repeated continuation with original full impact and exact
undo/redo, clone-edit preservation, forged checkpoints and protected-field writes,
direct live mutations, identical-content project switches, and spent/in-flight
capability rejection. These are offline integration scenarios, not browser or
whole-task acceptance.

The offline contract driver exercises the real controller/store/history entrypoints:

```sh
bun run scripts/qa/spatial-authoring-contract.mts \
  --scenario preview-history --evidence "$RUN_OWNED_EVIDENCE"
```

It records source-file hashes and exact before/accepted project hashes, successful
undo/redo and a rejected stale apply. It does not load a remote project or enable
publication. Owned validation uses the execution plan's shared flock and monitor.

The adjacent unchanged `storeMutationInstrumentation.test.ts` has an inherited
structural failure: its allowed-method list omits `activateSpatialAuthoring`, which
already assigns `this.current` on the starting commit. Its seven other checks
passed. This lane neither changes that test nor modifies activation to hide the
failure. Some LSP refresh requests hit the existing 3000ms tool deadline; the
scoped TypeScript compiler check passed without altered limits or suppressions.

Final integration remains explicit:

- Bind the real factory in the parent UI composition root with
  `bindSpatialAuthoringControllerFactory(createSpatialAuthoringController)`.
  UI access must preserve the issued draft handle. UI files are owned by the panel lanes.
- Integrate task10's real region/world compiler and replace the current honest
  `unsupported` geography witness with positive region/world controller scenarios.
- Exercise task34 cleanup against task10-produced geography, including shared
  markers and nested world/region delete/refresh with exact undo/redo. The current
  task34 contract witnesses cover the backend seam, not geography generation.
- Complete Q2/Q3 through actual panel surfaces and the lead's single combined
  build/acceptance batch. No UI, CSS, image or live publication approval is claimed.
