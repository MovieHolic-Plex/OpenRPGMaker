# Shared spatial authoring controller

Manual source-build API, frozen-input disclosure and compile-owner routing:
[Manual spatial source-build core](spatial-manual-build.md).

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
Shared edit generations use the additive `createDraft(fromDraft?)` guarded fork.
It preserves the original live baseline and compiler-protected checkpoint, but
issues a new detached handle. `continueDraft(preview, ancestor?)` can require that
the preview descends from an exact active draft/proposal generation. Its issuer,
spent and live-stale checks retain priority. Private ancestry spans all intermediate
previews/continuations; no persisted schema or independent-branch invalidation is
introduced. See the manual-build page for both placed adapters' handoff recipe.


Results discriminate on `kind: "ok" | "error"`. Errors expose `code`, `message`
and optional `detail`; expected invalid input, unsupported compilation, stale
baselines and ownership rejection do not mutate live state.

Operations are `edit`, `edit-connection`, `instantiate`, `clone-occurrence`, `clone-design`,
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

## Selective standalone-object graphic replacement

`compileSpatialOccurrence(project, request, previousOccurrence?)` accepts the prior
occurrence as compiler-only authorization for replacing an owned standalone graphic.
`previewSpatialAuthoring` supplies it only from `protectedDocument.occurrences`:
for a continuation this is the latest issued preview checkpoint, never the editable
draft or refreshed snapshot. A newly instantiated root has no checkpoint entry and
retains the original first-stamp path. Direct compiler calls without prior context
retain matching-raster validation; they do not guess an old footprint.

Both old and current owned bindings must match the explicit target and their stored
raster digests. Replacement clears only the prior frozen graphic's exact layer
cells, then paints the selected new frozen cells inside the same reservation.
There is no stored underlay: a vacated graphic layer becomes `-1`, not invented
floor terrain. Unused reservation cells, other layers, stacks, unmanaged events
and disjoint sibling bindings remain untouched. New occupied cells use the normal
blocked-cell checks; atlas mismatch, oversize, stale content, overlapping unmanaged
events and inaccessible ports reject the detached proposal. Projection bindings
still confer no replacement authority. Source-only edits do not refresh instances.

Compiler regressions are in `test/spatialOwnedObjectCompile.test.ts`; they build
two actual mixed-layer authored objects before editing their shared source, and
cover selective repaint, shrink, preservation, digest-adoption rejection and
invalid targets. `test/spatialOwnedObjectRefresh.test.ts` separately exercises the
real controller bridge: selective mixed-layer refresh, exact sibling/outside-cell
preservation, whole-project apply/undo/redo, continued refresh, forged editable
footprints, first builds, and stored/forged digest rejection. Compiler-only tests
are not substituted for this controller/history acceptance.

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

Placed ordinary links use `operation: { kind: "edit-connection", request }`.
`SpatialConnectionEdit` in `authoringTypes.ts` accepts exactly these intents:

- `{ kind: "create", connection: { id, from, to, bidirectional } }` allocates the
  caller's fresh actual edge ID; collisions with any spatial ID reject.
- `{ kind: "replace", connection: { id, from, to, bidirectional } }` replaces
  the existing edge at that exact ID, including endpoint or direction changes.
- `{ kind: "remove", connectionId }` unlinks that exact existing edge.

Both endpoints contain actual `{ occurrenceId, portId }` values. Resolve named
ports with the existing `localPortId` associations before this boundary. Ordinary
links have no mandatory local-connection provenance: do not parse edge IDs or
attach `overviewRoute`. This API rejects overview routes; their geography-owned
association and write-set rules remain unchanged.

Every connection edit requires the normal explicit `compile: { occurrenceId }`
request covering all old and new endpoints in that occurrence's actual subtree.
For connected rooms, use the containing place, not a leaf room. Keep the draft's
connection graph unchanged and send the intended change in the operation; old
proof comes from the controller checkpoint, not a caller-rewritten graph.
Use `continueDraft` for subsequent operations on an unapplied proposal.

Replace/remove preflight the old concrete landings, exact owned event IDs,
raster digests and strict transfer/mapConnection pairs. Missing authority is not
treated as uncompiled when an old pair or another direction's claim exists.
Only the selected edge's authorized transfers and binding connection IDs are
released before the new graph is validated and compiled. Invalid ports, blocked
landings, unknown edge IDs, unmanaged ambiguity or insufficient compilation scope
reject without changing live project/history. All existing compiler guards still
apply; this is not implicit source refresh or generic graph reconciliation.

Containing place recompilation also preserves the persisted identities of retained
ordinary transfers. Before raster release, it captures their exact logical edge,
concrete source/target ports, actual event owner, raster digest and validated
event/mapConnection pair. Emission uses that transient proof, not the spelling of
an event ID. Unchanged associations retain the complete event/page and projection
payloads, including opaque saved IDs. If the same concrete port moves, only source
coordinates and transfer destination coordinates change; saved IDs and other
payload fields remain intact. Mismatched old endpoints or ownership reject rather
than being hidden by restoring old commands after compilation. No persisted
provenance or schema field is added.

`test/spatialConnectionIdentity.test.ts` promotes the independent AV-CONNECTION-01
fixture and its seven passing controls. `test/spatialConnectionRecompile.test.ts`
covers moved-port identity retention with real interpreter destinations and rejects
mismatched old graph/pair proof. The original independent RED report remains under
`output/evidence/tile-to-world/connection-edit/independent/`; correction evidence is
separate under `connection-edit/identity-fix/`.

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
