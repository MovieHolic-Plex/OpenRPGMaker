# Canonical spatial AI tools

## Ownership

`src/editor/tools/spatialTools.ts` registers the five native tools in the existing
registry. Tools operate on the runner's detached `Project`, never the singleton
manual controller's live project. The compiler entry is the same pure
`previewSpatialAuthoring` used by the shared controller. No tool activates a
legacy project, creates a second catalog, writes persistence directly, or imports
archived legacy data as a live source.

| Tool | Mode | Contract |
| --- | --- | --- |
| `list_spatial_designs` | read | Optional `kind`/`query`; searches the active library across tilesets. Missing and empty authoring stay distinct; neither seeds data. |
| `get_spatial_design` | read | `kind`, `id`; returns the typed design plus resolved transitive revisions and kit cells. Missing/cyclic references reject. |
| `upsert_spatial_design` | write | `kind`, `expectedRevision`, and exactly the body named `object`, `space`, `place`, `region`, or `world`. Zero creates a fresh ID; replacement requires the current revision and next revision in the body. |
| `preview_spatial_build` | read | `kind`, `id`, fresh `occurrenceId`, `seed`; object builds also require a compatible `target` map/rectangle/entry. Returns an issued preview ID and actual impact. |
| `apply_spatial_build` | write | Takes the issued `previewId` into the detached proposal, not the live store. Forged, foreign, stale and consumed IDs reject. |

The kind-specific schemas describe children, terrain, graphics, ports, quantity,
placement and chips. The existing spatial parser/reference validator remains the
single runtime contract, including bounds, allowed edges and cycles. Source edits
never regenerate existing occurrences. Existing generated map collisions are
compiler ownership errors, not implicit replacement permission.

## Preview versus publication

Preview caches are editor-only detached memory; reads do not mutate authored
project JSON. Only the current issued build preview is retained per draft. Normal
`cloneDetachedDraft` transfers that memory and the private object-identity lineage;
JSON copies cannot impersonate it. The runner records the full original baseline,
authorized spatial document, and final validated proposal digest. Every canonical
write, including generic map tools, participates. A later tool cannot launder a
draft edited outside the runner.

`commitChangeset` and `applyProposedProject` unconditionally validate the full
canonical project through `assertSpatialToolChange`: schema/reference checks plus
`validateSpatialProject` on the actual generated overview event/mapConnection
pairs, even when `spatialAuthoring` JSON is unchanged. This happens before baseline
lint subtraction. An existing projection error cannot waive another mutation with
the same lint atom (T17-AV-1). Genuine repairs producing valid projections remain
allowed, as do unrelated edits with pre-existing legacy lint errors. The permanent
`test/spatialToolProjectionBoundary.test.ts` covers registered runner -> shared
acceptance -> real store/history -> deserialize, including the clean-baseline
rejection control and independent entry/return acceptance checks.
Generic hierarchy edits cannot gain authority by passing an otherwise well-formed
object. Canonical projects do not receive the legacy whole-project automatic
tree-pair repair, which could mutate unrelated frozen
rasters after preview.

`applyProposedProject` is still the normal AI publication path. It rejects changed
live content, equal-content foreign project replacements, unissued snapshots and
post-tool tampering before history/store writes. Its existing undo, annotations,
commit recording and canonical store persistence routing remain in place.

The actual `approvalPolicy.ts` at this base returns `apply-now` for successful
writes. These tools do not replace that policy with a new approval gate. Conversely,
manual controller Preview/Apply remains explicitly accepted and does not run an
AI tool against another live project.

## Legacy adapters and context

- Active `get_concept_facility` reads canonical designs, never the retired tileset
  catalog. Legacy receipt tuples provide qualified compatibility aliases; labels
  and opaque design IDs are not parsed as storage identities.
- Active `place_concept` compiles a canonical frozen place. Its legacy `mapId`
  argument becomes the occurrence ID; the response supplies the actual generated
  `mapId`/`mapIds`. A legacy `plan` is rejected with guidance to use typed upsert,
  not silently converted into a competing library or ignored.
- House and village linked interiors use canonical frozen compilation. Callers
  use the returned actual map IDs. Their scope gates allow only issued new
  occurrences and declared output maps, preserving existing definitions,
  occurrences and unrelated data. Canonical village scope follows actual transfer
  chains rather than requiring a separate exterior door to every nested room.
- Canonical navigation must be authored with ports/connections. Legacy floor labels
  are not permission to invent a new navigation graph. Connected fixtures exercise
  explicit source links, and the compiler validates their destinations.
- Legacy room harness plans keep their caller-provided geometry and obtain room
  selections, quantities and chip overrides from canonical sources. The projection
  is transient; it never writes `scratchConceptBundles`.
- Without a canonical document, existing explicit `scratchConceptBundles: []`
  still rejects generation. `get_concept_facility` is now read-only even when
  legacy defaults are available through the pure fallback reader.
- The real system context includes bounded JSON in `<spatial-authoring>` outside
  ordinary budget truncation: source revisions, hierarchy edges, occurrence
  parents, compiled map IDs, generator version and missing-source flags. Old
  catalog instructions are omitted in canonical mode. Tests parse the structural
  payload, not prose.

## Evidence and integration boundary

Focused contracts are `spatialTools`, `spatialAiContext`, `spatialToolAcceptance`
and `spatialLegacyTools`. The existing `placeConceptTool` and
`interiorConceptRoutes` suites characterize the unchanged legacy branch.

`bun run scripts/qa/spatial-ai-tools.mts --evidence <owned-directory>` executes the
actual registered lookup -> design -> preview -> apply tool sequence, then the
real shared proposal acceptance and exact undo/redo. It records source hashes,
real arguments/results, compiled two-bed bindings, a forged-apply rejection and
the accepted project under `output/evidence/tile-to-world/task-17/`.

That driver is explicitly offline and disables remote publication. It is not a
real-provider Q6 transcript or browser/visual acceptance. Those remain parent-owned,
along with catalog content, activation/publication and the final integration build.
The runner does not silently substitute defaults for an inactive/empty library.
