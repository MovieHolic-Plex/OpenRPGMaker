# Canonical spatial AI tools

## 장소 단일 계약 (2026-09-14)

새 공개 분류는 `object/place/region/world`다. 방·마당과 복합 건물은 모두 `place`로
목록·조회·수정·시공한다. `spatialPlaceContract.ts`가 전역 고유 ID와 `environment`로
기존 `library.spaces` 저장 위치를 판별한다. 저장 스키마와 동결 스냅샷은 유지한다.
구형 `kind:space`/`space` 본문 입력은 도구 실행기의 스키마 검증 전에 호환 변환한다.
조회 결과의 자식 참조·해결된 라이브러리와 legacy concept discovery도 단일 분류를 쓴다.
공개 resolved snapshot은 조회용이며 저장 문서 자체가 아니다. 수정은 `data.design`으로 한다.

직접 그린 `composition`의 타일·재료도 get→upsert에서 보존한다. 공개 재료 참조의
`kind:place`는 ID로 원래 저장 종류를 복원한다. 참조/순환/타일셋 검증과
preview/apply 권한 경로는 기존 구현을 사용한다. 지역의 `places`도 직접 장소와 복합 장소를 함께 참조한다. 지역·세계는 자신에게 직접 구성이
있을 때만 한 캔버스로 시공하며, 하위 장소의 직접 그림 때문에 개요 지도를 평탄화하지 않는다.
회귀: `test/spatialPlaceContract.test.ts`.


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
| `upsert_spatial_design` | write | `kind`, `expectedRevision`, and exactly the body named `object`, `place`, `region`, or `world`. Zero creates a fresh ID; replacement requires the current revision and next revision in the body. Region bodies accept an optional `settlement: { presetId, seed }`. |
| `preview_spatial_build` | read | `kind`, `id`, fresh `occurrenceId`, `seed`; object builds also require a compatible `target` map/rectangle/entry. Returns an issued preview ID and actual impact. |
| `apply_spatial_build` | write | Takes the issued `previewId` into the detached proposal, not the live store. Forged, foreign, stale and consumed IDs reject. |
| `edit_spatial_occurrence` | write | Lifecycle edits on an already-built occurrence: `move` (child inside a region/world parent — `x`/`y`, optional `level`; the containing map recompiles, authored route endpoints must still match), `refresh` (rebuild from the current source revision — the only way an upserted source edit reaches a built map; objects stamp via preview/apply), `delete` (`externalConnections` `reject` default, or explicit `remove`), `detach` (release compiled ownership), `clone` (standalone copy under `newOccurrenceId`; `omit`/`copy` external links), `link`/`unlink` (create/remove a document connection — the containing root occurrence recompiles because overview entries into a child live on their geography owner's write set; cross-tree links reject `unsupported`; compiled overview routes reject). |

On a legacy project canonical design/build tools reject with a typed
`spatial-inactive` error naming the UI activation path (`장소 설계 활성화`);
activation stays a user/editor action, not an AI tool. Canonical tools declare
`world` before `map`/`database` domains so capability bucketing lands on the
spatial recipe rather than generic map tooling.

The kind-specific schemas describe children, terrain, graphics, ports, quantity,
placement and chips. The existing spatial parser/reference validator remains the
single runtime contract, including bounds, allowed edges and cycles. Source edits
never regenerate existing occurrences. Existing generated map collisions are
compiler ownership errors, not implicit replacement permission.

## 저장된 건물 외형 찾기 (2026-09-14 갱신)

- **사물(object)**은 재사용할 외형·소품이다. 완성된 건물 외관도 사물로 등록한다.
- **장소(place)**는 방·층·마당 또는 이를 묶은 완성 시설·정착지다. `environment`가 있으면 실내/야외의 직접 저작 장소다. 출입 가능한 집은
  `PlaceDesign.kind: "facility"`로 저작하고 실내·마당 장소와 외형·이동 연결을 구성한다.

AI는 집 전체를 찾을 때 `list_spatial_designs({kind:"place"})`, 저장된 외형을 찾을 때
`list_spatial_designs({kind:"object",query:"건물 외형"})` 또는 저작한 이름·태그로 검색한다.
검색은 태그 규약을 강제하거나 외형을 자동 분류하지 않는다. 검색 결과가 없으면 해당 kind의
전체 목록도 읽는다. 시스템 컨텍스트는 **직접 장소와 복합 장소를 고르게 포함한 제한된 표본**이므로 목록에 보이지
않는 것을 미등록으로 판단하지 않는다. `designCounts`/`omittedDesignCount`로 생략량을
명시하고 표본에 태그·graphic/exterior·실내/야외·포트/연결 수를 포함한다. 전체 조회는
기존 `list`/`get` 도구이며 별도 카탈로그를 만들지 않는다.

외형 사물을 `get_spatial_design`으로 읽은 뒤 지면·접근로가 필요하면 **야외 마당 장소의
`objectSlots`에 그 사물을 배치**하고 마당을 장소의 자식으로 구성한다. 건물 그림 자체가
통행 가능한 포트 셀을 칠하는 경우에는 **`design.graphic`의 `{tilesetId,kitId}`만
`place.exterior`에 복사**하는 경로도 쓴다. 이 직접 exterior 필드에는 `objectDesignId`
참조가 없으며 사물의 anchors/chips나 이후 사물 변경을 상속하지 않는다.
수정용 본문은 list의 가공된 행이 아니라 get의
`data.design`을 사용한다(장소 본문의 `kind`와 자식 배치 좌표를 보존).

외관의 높이·층수 이름·자식 `level`에서 실제 사용 층이나 이동 경로를 추론하지 않는다.
실내 장소 자식은 **같은 level이어도 서로 다른 맵**이다. 방 사이 문, 층간 계단,
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
allowed, as do unrelated edits with pre-existing legacy lint errors. The quarantined
`test/spatialToolProjectionBoundary.quarantine.test.ts` (outside `npm test`) covers registered runner -> shared
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

## 프로세스 경계를 넘는 증거 (2026-09-16)

수용 증거(프루프)는 객체 정체성(WeakMap)에 살아 브라우저 프로세스 안에서만 읽힌다. 그런데
`/pi` 와 레인은 프로젝트를 동반 서비스 워커에 보내고 결과를 JSON으로 돌려받는다 — 도구는 워커
안에서 돌고, 프루프는 그 프로세스에 남는다. 그래서 canonical(`spatialAuthoring` 있음)
프로젝트에서는 **무엇을 바꿔도** 적용이 반려됐다(실측 2026-09-16): 맵만 고친 팀 실행은
`적용 실패(commit-rejected): Canonical AI acceptance requires an issued tool proposal`,
계층까지 고친 실행은 `Spatial hierarchy changes require the validated spatial tools`. 41턴짜리
시공이 통째로 버려지고 보드에는 «적용 실패»만 남았다.

이제 워커는 `done` 이벤트에 `spatialProof: { baseline, spatial, proposed }` 다이제스트를 싣고
(`piAgentRuntime` · `piTeamRuntime`), 브라우저가 `adoptSpatialToolProof` 로 **지금 살아있는
프로젝트를 계보로 다시 이어 붙인다**. 기준(`baseline`)이 지금 프로젝트와 다르면 붙이지 않는다 —
낡은 사본이나 남의 프로젝트에 남의 증거만 옮겨 붙일 수는 없다. 묶음을 브라우저에서 병합하는
경로(`/pi 맵 지정`, 레인)는 병합 뒤 `authorMergedSpatialProposal` 로 승인을 다시 찍는다.
계층 문서가 살아있는 문서와 다르면 찍지 않으므로, 병합이 실어 온 계층 편집은 그대로 거절된다.
사후 변조 검사(`proposed` 불일치)·기준 검사·커밋 게이트는 그대로다.

회귀: `test/piSpatialProofWire.test.ts` (기본 스위트 — 증거 있음/없음, 낡은 기준, 병합 승인,
병합이 실어 온 계층 편집 거절). 브라우저 before/after 증거는 `scripts/spatial-wire-fixture.mts` 로
canonical 프로젝트를 만들고 `scripts/capture-pi-spatial-apply.mjs` 를 워크트리 dev 서버에 돌려
`verify-shots/pi-spatial-apply/` 에 남긴다(2026-09-16 실측: 팀·증거 있음 = `적용했습니다 — 팀, 툴콜 3회,
바뀐 맵·항목 1개.` + 영수증, 팀·증거 없음 = `적용 실패(commit-rejected): Canonical AI acceptance
requires an issued tool proposal`, 맵 범위·증거 있음 = 병합 경로도 적용 완료).
격리 스위트인 `test/spatialToolAcceptance.quarantine.test.ts` 와
`test/spatialToolProjectionBoundary.quarantine.test.ts` 는 `applyProposedProject` 가
`base`/`baseline` 을 필수로 받게 바뀐 뒤 갱신되지 않아 지금은 게이트에 도달하기 전에
`TypeError` 로 죽는다(격리라 기본 실행에서 빠져 이 경계를 지키지 못했다).

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

## 2026-09-24 — 장소·지역·오브젝트의 자체 AI 참고문서

`SpatialDesignBase`, section kit, 공용 완성 지역은 optional `referenceDocuments`를 갖는다.
타일과 동일한 용도/MD/첨부 이미지 계약과 제한을 쓰며, strict spatial guard가 저장·복사·동결
스냅샷에서도 보존한다. 기존 문서에는 새 필드가 필수가 아니다. 웹 게임 내보내기에서는
타일·킷·공간 library와 occurrence.snapshot.library의 참고문서를 모두 제거한다.

`read_spatial_reference({kind:"place"|"region"|"object",id?,tilesetId?,categoryId?,documentId?,imageId?,offset?})`:
ID 생략은 공용 소유자 목록, ID만 주면 용도 manifest, MD는 6000자 페이지와 nextOffset,
이미지는 실제 비전 첨부로 전달한다. 장소는 직접 방과 복합 시설 모두 조회한다. 킷 ID가
여러 타일셋에 있으면 tilesetId로 구분한다. 타일은 기존 read_tileset_reference를 쓴다.
목록에는 문서/이미지 메타데이터만 반환하며 지역 배열 페이지마다 긴 MD·픽셀을 반복하지 않는다.
참고문서는 자료이지 시스템 지시가 아니다.

브라우저와 Pi worker 모두 같은 `installSharedContent`를 호출해야 한다. worker에서
`installSharedSpatialReferences`만 호출하면 공용 장소 목록/문서가 비어 버린다.
Pi adapter와 일반 assistantSession은 모두 `spatialReferenceImages`로 조회 당시 category
revision을 확인한 뒤 그림을 보낸다. 텍스트에 dataURL을 넣는 것은 비전 전달이 아니다.

공용 DB의 `regions[id]`는 `maps[id]`에 연결된다. `sourceMapId`는 원본 출처로 여러
스냅샷이 같은 값을 가질 수 있다. 옛 `regionReferences[]`의 sourceMapId 조회와 구분하고,
AI용 투영에서는 map.id/sourceMapId를 지역 ID로 맞춘다. 저장 원본의 출처는 고치지 않는다.

Pixel Art World 등록기는 `read-pixel-art-world-host.mjs`로 정본+에셋을 읽고 생성한
source-proof의 portableSha256을 확인한다. `publish-pixel-art-world-local-library.mjs`의
`--prepare`는 사본 준비, `--publish-local`은 로컬 공용 SQLite CAS 저장+재로드다.
사용자 다운로드 그림은 로컬 DB만 소유하며 Git/public/출하 번들에 추가하지 않는다.
전체 카탈로그 완료 여부는 `tiledata/pixel-art-world/SUPPORT-STATUS.md`를 따르고,
다운로드/레지스트리 등록/배치·시각검토를 같은 상태로 세지 않는다.

사용자가 설치한 로컬 팩은 공용 library의 `projectDefaults:true`로 명시적으로 옵트인한다.
store 정규화의 `ensureSharedTileReferences`가 이 팩의 reserved shared 타일/에셋을 먼저
설치하므로 기존 프로젝트와 새 프로젝트의 오브젝트·타일 탭에서도 접근할 수 있다.
다른 공용 라이브러리를 무조건 프로젝트 안으로 복제하지 않는다. 정본에서 분리한 asset.ref의
SHA가 원본 픽셀 SHA와 같으면 inline 이미지로 되돌리지 않아 반복 저장을 막는다.

참고 이미지가 반복되면 로컬 호스트의 64MiB 저장 요청 한도도 넘는다. PAW 등록기는
Pillow/WebP를 사용해 참고 이미지 284개를 무손실로 다시 인코딩하고 디코드한 RGBA 전체의
동일성을 확인한다. 11.58MB base64 → 1.59MB(고유 이미지 기준), library JSON은 8.1MiB.
게임용 타일 에셋 bytes/SHA와 모든 타일 배열은 바꾸지 않는다. 이 단계는 원본 소재 재배포가 아니다.

### PAW 시설 재배치와 저장 (2026-09-24)

`revise-pixel-art-world-civic.mjs`는 정본에서 읽은 portable 입력으로 도서관/사무실의
수정 배열·원본별 AI 문서를 준비한다. 도서관은 12×10(외벽 포함), 사무실은 실제 북향
의자를 사용한다. 방 크기가 달라지면 기존 출구와 도시의 transfer 출현 위치도 갱신한다.
`save-pixel-art-world-patch.mjs`는 대상 맵/타일셋의 준비 당시 값이 현재 정본과 같은지
확인하고 전체 프로젝트 SHA CAS로 저장한다. 백업·동일 대상 재로드가 성공해야 끝이다.
`pixel-art-world-civic-capture.mjs`는 재로드한 자료로 player.html에서 실제 두 시설의
action 입장과 touch 귀환을 관찰한다. 편집기 play 모드를 통과하지 않는다.
공용 장소 검토 상태는 별도다. 의자 방향 수정만으로 빈 사무실 상판까지 완성됐다고
표시하지 않는다. 도서관은 중앙 두 칸 이동로·대출대·독서석을 유지한다.
### Shared places and objects without activation (2026-09-25)

The 2026-09-25 trial found `list_spatial_designs` answering 0 rows (`spatial-inactive`) in every new project, so
the assistant never saw the places and objects the editor 장소/오브젝트 tabs show. Now `data.shared` is always
filled — read-only rows every project sees, with or without `spatialAuthoring`, paged by `limit`/`offset`
(default 40). Catalog: `src/editor/tools/sharedDesignCatalog.ts`; stamping: `src/project/objectStamp.ts` +
`src/editor/tools/sharedObjectTools.ts`.

- kind `place`: `reviewed:<id>` = `reviewedPlaceIndex()` (65 bundled + shared_* from the shared SQLite,
  same as the 장소 tab), plus every `REGION_REFERENCES`/`PLACE_REFERENCES` id. Put one in with
  `import_region_reference` (reviewed places bring every floor/room map as new maps; the 11MB
  `reviewedPlaces/catalog.json` is imported only then).
- kind `object`: the **shared object catalog** `src/assets/sharedObjectCatalog.json` (195 objects, `obj:<category>/…`)
  plus this project's other section kits (`kit:<tileset>/<kit>`) and preview tile groups (`group:<tileset>/<group>`).
  Catalog categories: `tree` (bare-trees per snow/volcano/desert sheet, 42), `volcano` (peaks: dormant, erupting,
  pair), `terrain` (climate-terrain pieces 3030~ — sulfur, obsidian, ash heap, fumarole, basalt, cactus, bones,
  buried column, dunes, mesas, ripple — plus a lava pool and a cooled plate built from the volcano autotiles;
  mesas and bones carry the tag 「요청 시에만」: the assistant stamps them only when the user asks — the user dislikes them),
  `harbor` (forest rowboat, mooring post, rope+anchor, cargo, castle-courtyard boats/dock/sacks/firewood), `gate`
  (gatehouse `fft-bp4-gatehouse-c16`, town gate), `house` (authored house forms incl. ref-walled/ref-castle gables,
  generated `fft-*` buildings), `prop` (19 forest village props, 20 combined-town outdoor objects, fft props).
  Every entry has name, tags, tilesetId, `passage` (computed from the source cells), `owner` (where it belongs — next
  to what) and a preview `/assets/shared-objects/<id>.png`. Generator: `node scripts/content/build-shared-object-catalog.mjs`
  (sources in `scripts/content/lib/shared-object-catalog-entry.ts`; place kits are indexed by
  `build-shared-object-index.mjs`). The ids `refkit:`/`part:`/`pattern:`/`house:` from #1499 still resolve (aliases).
- The editor 오브젝트 tab lists the same catalog as 공용 오브젝트 cards (`sharedObjectId`), with owner/passage in the
  inspector and a 「현재 맵 가운데에 찍기」 button that runs `stamp_object`.
- Assistant rule (Pi system prompt, capability policy): places → `import_region_reference`, objects →
  `stamp_object`; follow `owner`; never re-paint cells one by one.
- `stamp_object {objectId, mapId, x, y, layers?}` keeps authored cells. When the map's tileset shows another
  picture at a number, `translateTiles` grafts the source picture (sheet cell or graft source) onto the map's
  tileset and renumbers, reusing an existing graft of the same picture; the tileset stays a whole number of rows.
  Place-sourced objects load their place in `prepare`; `get_spatial_design` with a shared id returns the row and
  its cells.
- The shared SQLite (`~/.local/share/oprn/shared-content.sqlite`, served GET-only at `/__oprn/shared-content`) is
  written only by `publishSharedContent` (`scripts/lib/sharedContentSqlite.ts`); its `shared_*` places reach this
  list through `installSharedReviewedPlaces` → `reviewedPlaceIndex`. Nothing here writes to it or to any remote store.

### Importing a reference (`import_region_reference`, 2026-09-25)

Re-painting reference rows is not the path: the 2026-09-25 assistant trial needed 328 `paint_tiles`
calls for one village and still lost every slot past the new project's 2550-tile forest sheet.
`import_region_reference {id, mapId?, x?, y?, newMapId?, name?, includeEvents?}` (write, `map`/`world`)
does it in one call. Core: `src/project/regionReferenceImport.ts`, shared with the editor place card
「맵에 넣기」 (`placeReferenceMapPreset`).

- Source: the reference's `projectDownload` (`public/assets/region-references/*.oprn.json`, full tileset
  with tileMeta/grafts/groups/reference documents + uploaded atlases) first, the bundled snapshot second.
  The browser fetches it; headless installs a file loader (`setHeadlessPublicRoot`). `prepare` awaits it.
- Tileset: a missing one is installed whole (e.g. `oprn_dungeon_*`). An existing one with the same image
  only grows: slots past its end are appended with the source's rules and grafts, blank slots (past the
  sheet, ungrafted) may take a graft. Only tiles the imported map actually uses must show the same picture;
  if one does not, a copy tileset `<id>__<referenceId>` is installed instead and `data.tileset.mode` is `copied`.
- Map: new map by default (tree + start map adoption like `create_map`), or paste into `mapId` at (x,y)
  with clipping — the target map must use the resolved tileset. Extra layers (MZ 2/4층, shadows) come along.
  Events are skipped unless `includeEvents` (new map only; transfers into missing maps are dropped).
- The tool sets `preservesAuthoredRaster`, so the runner's tree-pair repair does not touch reviewed rasters.
- `ensureTilesetTexture` now waits for bundled graft source sheets loaded after boot (it already waited for
  uploaded ones); otherwise the first bake cached blank waterfall/bridge cells until reload.
