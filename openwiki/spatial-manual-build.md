# Manual spatial source-build core

This is the shared controller adapter, not completed visual-control acceptance.
Concrete Build/seed/target controls and browser acceptance remain parent-owned.
No persistence, schema, controller operation, compiler or history implementation
is replaced by this adapter.

## Public entry points

`src/editor/panels/spatialBuildActions.ts` exports:

- `resolveSpatialBuildSource(card)` returns a normal `SpatialAuthoringResult`
  containing an explicit `SpatialDesignReference<"object" | "space" | "place">`.
  Only canonical gallery records carry `card.canonicalSource`. Compatibility
  room rules, house shapes, concept bundles and unconverted kits/default catalog
  cards require explicit copy/conversion (`canonical-copy-required`). Never
  reconstruct identity from `localId`, labels, source provenance or kit ID.
- `previewSpatialSourceBuild(input: SpatialSourceBuildInput)` issues a detached
  instantiate-and-compile proposal through the existing shared access/controller.
- `spatialBuildProposal()` exposes frozen `input` plus the current issued
  `preview` (null after compilation failure or while continuing an edit).
- `MANUAL_SPATIAL_BUILD_VERSION` is `manual-spatial-build-v1`.
- Public readonly types: `SpatialSourceBuildInput`, `SpatialBuildProposal`.

## Inputs and display obligations

Allocate a fresh opaque `SpatialId` once for `rootId`. Supply an integer seed;
the adapter has no hidden default. Tests exercise seed 19 independently of the
fixture's seed 7. Root x/y/level are zero; space/place compilation creates new
maps rather than stamping the selected map.

For a space/place source pass `destination: { kind: "new-maps" }`.
For a standalone object pass `destination: { kind: "map", currentMapId,
selection, entry }`, where currentMapId and selection come from the current
editor state. `selection` is the real `TileSelection`; its mapId must match.
The entry coordinate must be explicit. Null/missing selection or entry is not
replaced with (0,0), a guessed passable tile or a fixture fallback. The canonical
compiler validates rectangle bounds, atlas, occupancy and reachability.

Keep `spatialBuildProposal().input` visible with the displayed proposal. Changing
the selected source, map target, entry or seed does NOT silently retarget that
proposal. A different Build input returns `build-proposal-pending` while retaining
the original disclosed proposal. The UI can explicitly cancel the entire shared
draft with `clearAuthoringSession()` before starting another proposal; it must not
silently discard unsaved source edits. Input/request copies are frozen, so callers
cannot mutate queued compilation through their original entry/source objects.

## Preview and Apply

Build uses the current issued draft, including deliberate unsaved source edits.
The first Build instantiates its root and compiles it. Re-preview/continuation
preserves that root and does not replay instantiation when it already exists.
A source correction after failed compilation can build the same allocated root.
Source-save `previewAuthoringDraft()` remains edit-only unless an explicit request
has been queued; ordinary source saves never refresh frozen instances.

An external placed adapter uses `spatialAuthoringController()` and the issued
draft returned by `editAuthoringDraft`. Feed its successful exact preview to
`retainAuthoringPreview(preview)` from shared access. This verifies the issuer,
baseline, unconsumed handle and active shared ancestry through `continueDraft`, retains the exact displayed
preview, and stores the issued continuation for subsequent edits. It never copies
generated output into a raw draft. Normal Apply adopts the same issued preview;
foreign, stale and consumed previews cannot be imported into the shared session.

MB-HANDOFF-SESSION-LINEAGE: each shared edit now obtains a fresh controller-issued
generation, even when edits return to byte-identical contents. An undisplayed draft
is forked via `controller.createDraft(currentDraft)` with its original baseline and
protected checkpoint. A displayed proposal is continued normally. Controller-private
issuance edges preserve the whole multi-step adapter ancestry. Retention calls
`continueDraft(preview, activePreview ?? activeDraft)`; superseded/unrelated handles
return `code: stale, detail: authoring-session-lineage` before shared state changes.
No build disclosure is cleared or patched to conceal an obsolete proposal.

Both placed adapter signatures remain unchanged. Always pass the latest draft
returned by `editAuthoringDraft`, continue intermediate issued previews normally,
then retain the exact final preview. Do not reuse a draft from an earlier shared
edit. Independent branches still work through the controller's ordinary unfenced
continue/apply methods; the fence is local to shared-session retention.

Use the ordinary `applyAuthoringPreview()` for explicit acceptance. A successful
build Apply creates one project-history entry and selects its exact root in the
matching instances tab, clearing designId. Errors retain live selection and all
live data/history. Undo/Redo use the existing global history; edit-after-Undo
clears redo. The build metadata has the same project-scoped lifetime as the issued
shared access session and is cleared on successful Apply/cancel/project switch.

Controls must not let a local created-design fallback override the resulting
explicit occurrence selection (in particular `visiblePlaceSelection` still needs
the parent UI lane's instances-mode guard). Build availability/error text and the
frozen-input disclosure must be rendered by that lane; this core does not claim
that those controls or their browser acceptance are complete.

## Compile owner for placed adapters

`src/editor/spatial/authoringScope.ts` exports:

`spatialAuthoringCompileScope(document, occurrenceId, target?) -> SpatialCompileRequest`

The document must already be schema-parsed (acyclic actual parentId graph).
The helper requires persisted occurrence associations and follows actual parentId
to the containing root. It never guesses from source IDs, generated ID spelling,
record order, equal snapshots or projection map metadata. Standalone space roots
compile themselves; nested room/object/place edits compile the containing root
place. Geography containment selects its canonical region/world ancestor compiler.
Standalone object roots require the explicit retained stamp target; every other
root rejects a target. There is no speculative entry reconstruction from bindings.

The helper selects scope, not write permission: existing compiler raster digests,
projection restrictions, external-connection and overview write-set guards remain
unchanged. Connections beyond the containing root remain unsupported; do not
follow a connection to a second root or use projection metadata as erasure rights.
Connection creation/replacement/removal must use the separately delivered typed
controller operation, never direct graph or binding mutation by a panel.

## Verification

Real-controller tests are split into manual build, eligibility/input boundaries,
continuation, ownership guards and compile scope. They use actual compiler/store/
history adoption, not permissive mock handles or fixture re-instantiation as the
action. Canonical source fixtures start with no occurrences. Scope scenarios edit
a connected nested room through an issued draft and compile its containing place.
Mixed-cell object assertions check exact lower/upper offsets and untouched outside
cells. UI/browser and integrated parent acceptance remain explicitly pending.

Evidence lives under `output/evidence/tile-to-world/manual-build-core/`.
The wider neighboring continuation test invocation timed out at the existing
300-second monitor bound; it is incomplete, not a passing compatibility result.
The new ownership tests were subsequently isolated and passed without changing
deadlines. No inherited test was deleted, skipped, suppressed or retried to green.
One early test used floor width as whole-map width; its corrected expectation
includes the compiler's documented two-tile shell on each side. An invalid detached
overview fixture was replaced with a valid cross-root connection fixture to reach
the external write-set guard, rather than accepting unrelated schema rejection.
