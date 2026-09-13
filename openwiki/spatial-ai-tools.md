# Canonical spatial AI tools

## Ownership

`src/editor/tools/spatialTools.ts` registers the seven native tools in the existing
registry. Tools operate on the runner's detached `Project`, never the singleton
manual controller's live project. The compiler entry is the same pure
`previewSpatialAuthoring` used by the shared controller. No tool activates a
legacy project, creates a second catalog, writes persistence directly, or imports
archived legacy data as a live source.

| Tool | Mode | Contract |
| --- | --- | --- |
| `list_spatial_designs` | read | Optional `kind`/`query`; searches id/name/tags in the full active library across tilesets. Existing full list fields remain; place rows add `placeKind` so list `kind: "place"` does not hide the facility/settlement/natural subtype. For an exact upsert body read `get_spatial_design`. On a legacy project (`spatialAuthoring` absent) returns `data.active: false` with an explicit summary instead of an ambiguous empty list; neither state seeds data. |
| `get_geography_vocabulary` | read | No args. Returns the accepted region/world authoring vocabulary: world tilesetIds (profiles with `layout: "world"` that are actually `isWorldTileset`), `WORLD_TERRAIN_BLOCKS` material names, the settlement tileset, `mountain:<surface>` structure rules, route/connection constraints, `entryPort` requirement, and the project's `villagePresets` (id/name) for `region.settlement`. |
| `get_spatial_design` | read | `kind`, `id`; returns the typed design plus resolved transitive revisions and kit cells. Missing/cyclic references reject. `resolved:false` returns only the design body — enough for an upsert revision round-trip when the full read exceeds the tool payload cap. |
| `upsert_spatial_design` | write | `kind`, `expectedRevision`, and exactly the body named `object`, `space`, `place`, `region`, or `world`. Zero creates a fresh ID; replacement requires the current revision and next revision in the body. Region bodies accept an optional `settlement: { presetId, seed }`. |
| `preview_spatial_build` | read | `kind`, `id`, fresh `occurrenceId`, `seed`; object builds also require a compatible `target` map/rectangle/entry. Returns an issued preview ID and actual impact. |
| `apply_spatial_build` | write | Takes the issued `previewId` into the detached proposal, not the live store. Forged, foreign, stale and consumed IDs reject. |
| `edit_spatial_occurrence` | write | Lifecycle edits on an already-built occurrence: `move` (child inside a region/world parent — `x`/`y`, optional `level`; the containing map recompiles, authored route endpoints must still match), `refresh` (rebuild from the current source revision — the only way an upserted source edit reaches a built map; objects stamp via preview/apply), `delete` (`externalConnections` `reject` default, or explicit `remove`), `detach` (release compiled ownership), `clone` (standalone copy under `newOccurrenceId`; `omit`/`copy` external links), `link`/`unlink` (create/remove a document connection — the containing root occurrence recompiles because overview entries into a child live on their geography owner's write set; cross-tree links reject `unsupported`; compiled overview routes reject). |

On a legacy project canonical design/build tools reject with a typed
`spatial-inactive` error naming the UI activation path (`공간 설계 활성화`);
activation stays a user/editor action, not an AI tool. Canonical tools declare
`world` before `map`/`database` domains so capability bucketing lands on the
spatial recipe rather than generic map tooling.

The kind-specific schemas describe children, terrain, graphics, ports, quantity,
placement and chips. The existing spatial parser/reference validator remains the
single runtime contract, including bounds, allowed edges and cycles. Source edits
never regenerate existing occurrences. Existing generated map collisions are
compiler ownership errors, not implicit replacement permission.

## 사물·공간·장소와 저장된 건물 외형 찾기 (2026-09-12)

- **사물(object)**은 재사용할 외형·소품이다. 완성된 건물 외관도 사물로 등록한다.
- **공간(space)**은 실제로 사용할 방·층·마당이다. `environment`로 실내/야외를 구분한다.
- **장소(place)**는 공간이나 다른 장소를 묶은 완성 시설·정착지다. 출입 가능한 집은
  `PlaceDesign.kind: "facility"`로 저작하고 실내·마당 공간과 외형·이동 연결을 구성한다.

AI는 집 전체를 찾을 때 `list_spatial_designs({kind:"place"})`, 저장된 외형을 찾을 때
`list_spatial_designs({kind:"object",query:"건물 외형"})` 또는 저작한 이름·태그로 검색한다.
검색은 태그 규약을 강제하거나 외형을 자동 분류하지 않는다. 검색 결과가 없으면 해당 kind의
전체 목록도 읽는다. 시스템 컨텍스트는 **kind별 최대 6건의 표본**이므로 목록에 보이지
않는 것을 미등록으로 판단하지 않는다. `designCounts`/`omittedDesignCount`로 생략량을
명시하고 표본에 태그·graphic/exterior·실내/야외·포트/연결 수를 포함한다. 전체 조회는
기존 `list`/`get` 도구이며 별도 카탈로그를 만들지 않는다.

외형 사물을 `get_spatial_design`으로 읽은 뒤 지면·접근로가 필요하면 **야외 마당 공간의
`objectSlots`에 그 사물을 배치**하고 마당을 장소의 자식으로 구성한다. 건물 그림 자체가
통행 가능한 포트 셀을 칠하는 경우에는 **`design.graphic`의 `{tilesetId,kitId}`만
`place.exterior`에 복사**하는 경로도 쓴다. 이 직접 exterior 필드에는 `objectDesignId`
참조가 없으며 사물의 anchors/chips나 이후 사물 변경을 상속하지 않는다.
수정용 본문은 list의 가공된 행이 아니라 get의
`data.design`을 사용한다(장소 본문의 `kind`와 자식 배치 좌표를 보존).

외관의 높이·층수 이름·자식 `level`에서 실제 사용 층이나 이동 경로를 추론하지 않는다.
실내 공간 자식은 **같은 level이어도 서로 다른 맵**이다. 방 사이 문, 층간 계단,
바깥 출입/귀환을 ports/connections로 명시하고 시공 후 왕복 이동을 검증한다. 장소 자신의
포트는 그 위치에 실제 칠해진 통행 가능한 야외 표면이 필요하다. source upsert는 기존
frozen occurrence를 바꾸지 않으므로 적용하려면 명시적 refresh가 필요하다.

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
  and opaque design IDs are not parsed as storage identities. Its description now
  states the canonical/legacy split explicitly so models do not assume the legacy
  concept-bundle contract on canonical projects.
- Active `place_concept` compiles a canonical frozen place. Its legacy `mapId`
  argument becomes the occurrence ID; the response supplies the actual generated
  `mapId`/`mapIds`. A legacy `plan` is rejected with guidance to use typed upsert,
  not silently converted into a competing library or ignored. Both descriptions
  name the canonical tool chain (`list/get/upsert_spatial_design`,
  `preview/apply_spatial_build`) as the authoring path on canonical projects.
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
  ordinary budget truncation: per-kind samples/counts, discovery tags/graphics,
  source revisions, hierarchy edges, occurrence
  parents, compiled map IDs, generator version and missing-source flags. Old
  catalog instructions are omitted in canonical mode. Tests parse the structural
  payload, not prose.
- The capability index (`src/ai/toolCapabilityIndex.ts`) carries a `spatial-world`
  recipe: read `list_spatial_designs`/`get_spatial_design`/`get_geography_vocabulary`,
  write `upsert/preview/apply/edit_spatial_occurrence`, verify
  `check_reachability`/`run_lint`/`play_walkthrough`. Its policy states the
  `data.active`/`spatial-inactive` contract, bottom-up authoring, vocabulary-first
  terrain rules, single-preview sequencing, frozen occurrence semantics, and the
  explicit `edit_spatial_occurrence refresh` path for propagating source edits to
  built occurrences.

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

## Completed region references (2026-09-13)

`read_region_reference` is a read-only catalog tool available on **both legacy
and canonical projects**, without spatial activation. No `id` lists references;
`{id,row,rows}` reads a bounded window (default 8, maximum 16 rows). `nextRow:null`
marks completion. Results include exact lower/upper tile arrays, dimensions,
preview URL, lessons, provenance, and the frozen passage/priority/terrain for
every returned tile. These flags belong to the example, not the active project's
possibly edited tileset. Responses are detached copies. No live map is changed.

`regionReferenceContext()` supplies a compact discovery entry to the next AI
turn. The `spatial-world` capability group includes the reader. The example must
not be sent to `upsert_spatial_design` as though it were a procedural region.
Tests reconstruct the complete source through registered tool reads, verify
metadata/non-mutation, reject invalid pages, and exercise the read-only card.
