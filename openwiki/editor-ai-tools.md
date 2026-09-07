# Editor AI Tools & Vocabulary

## Measured zero-prop rejection diagnostics (2026-09-07)

`placePropsDomain.ts` and the shared pattern engine in `placementTools.ts` retain
the existing single/pattern admission rules, material resolution, sampling,
packing, event opt-out and unconditional house/stamp ownership protections.
Zero placement still throws `placement-zero`; neither rejection nor diagnosis
changes tile arrays, shared tile rules, authored overrides or requested count.

On zero placement, `PropPlacementError.diagnostics` measures candidate origins
with the same admission predicates, collecting all vetoes instead of stopping at
the first. The unchanged runner transports the machine record as one standalone
`placement_diagnostics: <JSON>` line in the **full** `issues[].message`. Parse that
sentinel and JSON, not cause/recovery prose or the clipped `summary`. This track
does not add error `data` transport or an automatic retry consumer.

- `unit: "candidate-origin"`: each geometrically fitting object origin counts
  once, not once per footprint cell, rejected prop, or placement attempt.
  `footprint.w/h` are tile-cell dimensions. `candidateOrigins = rejectedOrigins
  + eligibleOrigins`; `rejectedBy` counts each origin once per reason, so its
  overlapping values must **not** be summed as a rejected-origin total.
- `scope: "area-candidate-origins"` is a census of the area on zero placement,
  not a claim that the natural sampler tried every origin. Single-tile natural
  sampling can miss eligible cells; `eligibleOrigins` is not packing capacity.
  Pattern origins must fit the area and map. No fitting geometry yields zero
  origins and empty reasons, not an invented occupancy cause. Single-tile
  domain calls also count out-of-map origins as `outOfBounds` (the public v3
  boundary still rejects out-of-map rectangles before placement).
- Internal dense explicit origins use `scope: "explicit-candidate-origins"`;
  repeated coordinates count once and outside-area/map footprints are rejected.
  Tree visibility and first-step bag footprints retain their actual policies.
- Reasons distinguish `upperOccupied`, `lowerImpassable`, `protectedSurface`
  (road/sand/cobble), `blockedLowerSurface` (the existing water/wall mask),
  `lowerIncompatible` (the lower footprint's placement rule, not necessarily
  impassability), `protectedEvent` (start/event/transfer), `protectedOwnership`
  (house/stamp), `outOfBounds`, and `trunkVisibility`.
  An upper-occupied origin also checks the lower ground that clearing upper
  would expose, across the entire footprint; `lowerImpassable` includes that
  recovery blocker. Existing trunk-supported canopy overlap is preserved.
- `upperErase.upperOnlyOrigins` counts origins whose only blocker is upper
  occupancy. `upperErase.recommended` is true only when **every** census origin
  is upper-only and at least one exists. Mixed causes, blocked lower, protected
  surfaces, events/ownership, insufficient geometry and missed samples get no
  erase recommendation. When applicable the hint explicitly uses
  `tile_erase(layer:"upper")`, never its destructive default `both`. This is
  advice, not permission to bypass approval, ownership or the commit gate.

The captured regenerated-cellar area `(7,5) 3x3` contains six passable lower423
and three passable lower360 cells, with empty upper. Its diagnostic is exactly
`candidateOrigins:9, rejectedOrigins:9, eligibleOrigins:0,
rejectedBy:{protectedSurface:9}` with upper erase disabled, even for count2/3.
The older tall-grass forest test actually writes incompatible **lower**
vegetation: its 30x30 area has 870 rejected 1x2 origins, not occupied upper.
Its former prose expectation requiring upper erase was replaced by those exact
machine counters and whole-project non-mutation assertions.

Contracts: `test/propRejectionDiagnostics.test.ts` and
`test/placePropsZeroPlacement.test.ts`. Real runner countercases preserve exact
2/2 combined-town crates237 on ground222/240 and interior crates295 on floor72;
they assert unchanged lower material and tileset rules, not reduced counts or
material substitution. Diagnostics are offline engine/tool evidence, not a
repair of Round10 content or proof of live-model recovery.

Verification receipt for task `st_01a079e9`, exact base
`ecae43ffca8714cb1a13b073c0825c65e8ae8c30`:

- RED: the initial 22-case diagnostic suite had 19 missing-diagnostics failures
  and three passing exact 2/2 crate controls. Additional countercases caught
  blocked lower furniture backing and incorrectly labeled explicit-origin scope.
- GREEN: `npm test -- test/propRejectionDiagnostics.test.ts
  test/placePropsZeroPlacement.test.ts --maxWorkers=2` passed all 29 tests.
  No timeout, sleep, polling or expected placement-count relaxation was added.
- Protected run: 19 files, 201 passing / 14 failing tests. An untouched archived
  base run of the 18 pre-existing files had 174 passing / the **same 14 failing
  test identities**, giving zero new failures. Existing failures remain visible:
  `scatterObject` six (legacy tree origin/count expectations),
  `clusterRulePlacement` five (legacy tile-layer expectations), `forestDensity`
  two (`0.3003472222222222 < 0.3`), and `houseProtectionForest` one (puddle
  fixture `Cannot read properties of undefined (reading 'type')`).
- `npm run typecheck:app` and `npm run build:app` exited 0. Build emitted circular
  re-export, mixed static/dynamic import and large-chunk warnings. The shared LSP
  client timed out on refreshed files; a dedicated local TypeScript `tsserver`
  completed syntax, semantic and suggestion diagnostics for all four changed TS
  files, with zero diagnostics and no missing completion events. No Markdown
  LSP is configured; the wiki passed `git diff --check`.
- An offline `vite-node --config vitest.config.ts` exercise called the real
  `runTool` boundary: the nine-cell sand/road case rejected without mutation,
  while ground222, ground240 and interior floor72 each placed exactly 2/2 crates
  with original lower tiles and tileset rules intact. No live DB, model, UI,
  gameplay session, push, PR or remote merge was part of verification.
- Raw local receipts: `/tmp/st_01a079e9-receipts/`. `red.log` SHA256
  `7f7540b4dc729563aed45506bc5d43e3fd47d3436dbde54a07ad81f033bb0886`;
  `green-focused-final.log` SHA256
  `a14b6b58cd6b6fff6a6e2a5770151833cb7b60bf4254b638a32a50245795c95a`.
  Those temporary logs are not shipped source; the tests and this receipt are
  the durable reproduction contract. Full-suite gates and player/standalone
  builds were not run for this bounded editor-only repair.

## Logical walkthrough versus real player traversal (2026-09-07)

`play_walkthrough`의 `moveTo`는 좌표를 이동시키지만 `playerTouch`/`eventTouch`를 발동하지 않는다.
이동문 명령을 검사하려면 해당 이벤트 ID로 `interact`한 뒤 `mapId`를 확인한다.
따라서 이동문 좌표에 `moveTo`한 직후 다른 맵을 기대하는 시나리오의 실패만으로 전송 엔진 결함을 단정하지 않는다.
논리 검사 통과와 실제 키보드 이동·터치 발동은 별도 증거다. 런타임 QA 하네스에서 실제 왕복을 확인한다.
이 설명은 도구 사용 계약의 명확화이며 실행기·전송·통행 판정의 동작 변경이 아니다.

## Tile-query selector and filter boundaries (2026-09-07)

`tile_query`의 `similar`/`unclassified`는 `labels`/`vocab`/`unapproved`와 같은 선택 순서를 쓴다:
명시 `tilesetId` → 명시 `mapId`의 타일셋 → 시작 맵의 타일셋 → `DEFAULT_TILESET_ID`.
선택한 명시 ID가 없거나 비어 있으면 오류이며, 다른 맵/타일셋으로 조용히 대체하지 않는다.
`labels`의 비어 있지 않은 검색어가 일치하지 않으면 `labels: []`를 반환한다. 생략/빈 문자열/공백은
기존 제한 개수 탐색을 유지하며, 빈 검색에서만 설명 전용 타일의 전체 스캔 폴백을 허용한다.
의미 매칭·통행·카탈로그 라벨은 변경하지 않는다. 회귀: `test/tileQueryBoundaries.test.ts`
(시작/대상/명시 타일셋 분리, 잘못된 선택자, 검색 실패와 빈 검색 탐색).
Generated `place_npc({guide:"action-controls"})` guides omit automatic portraits;
an explicit `face` still uses the normal authoring contract. This avoids shipping
an inferred faceset ID absent from the project while preserving the canonical
controls, existing guide identity and position.

## Audio description tools and event candidates

Audio identity is `{ kind: "music" | "sound", resourceId: rawId }`. Search-result prefixes
`bgm:` and `se:` aren't valid override keys or detail/write tool IDs.
`src/editor/tools/audioDescriptionTools.ts` defines:

| Tool | Contract |
| --- | --- |
| `get_audio_resource` | Read an existing resource's full description and source from the current project. The resource is returned at `data.resource`, with its raw `id`. |
| `set_audio_description` | Write through the existing draft/proposal/approval path. `action: "set"` requires a string; `""` clears. `action: "reset"` removes the override and rejects a supplied `description`. |
| `upsert_resource` | `resource.description` is optional and allowed only for music/sound. Omission preserves the override; an explicit string uses the same writer. Description-only edits don't need a new asset or `dataUrl`. |

New strings are trimmed at the write boundary and limited to 4,000 UTF-16 code units after
trimming. Internal line breaks survive. Kind/ID existence and input validation happen before
applying the edit. `src/editor/tools/resourceTools.ts` owns upload integration.
`audioDescriptionsChanged` counts changed kind/raw-ID states, including clears and resets.
The changeset, preview, commit summary and meaningful-change checks retain description-only
proposals; they aren't tile-only auto-apply work. Approval and project undo/redo use the
existing transaction path.

### Search pages and full detail

`list_resources` in `src/editor/tools/queryTools.ts` keeps search kinds `bgm`/`se`, existing
prefixed result IDs and the default 20 results. `offset` defaults to 0 and must be a
nonnegative safe integer; `limit` is an integer from 1 through 50. The response contains
`data.matches`, `data.total` and `data.nextOffset`, which is `null` at the end.
Non-audio search meaning stays unchanged.

Audio matches also contain raw `resourceId`, `description`, `descriptionSource` and
`descriptionTruncated`. Lists expose at most 240 UTF-16 code units per description;
`get_audio_resource` returns the full value. Search ranking uses the full effective
description in `src/assets/resourceSearch.ts`, including text beyond that excerpt.
Overridden or cleared catalog descriptions aren't secretly appended as search terms.

### Event prompt projection is not ID authority

`src/ai/eventAudioPrompt.ts` builds at most 40 candidates per music/sound slot:

1. Up to 20 positive-score request matches, ranked using names, tags and full descriptions.
   Equal scores retain existing event catalog order.
2. Up to 10 still-unselected project-override or uploaded candidates.
3. All remaining places use still-unselected candidates in existing scene/category order.

Zero matches consume no first-group quota; duplicate IDs don't consume later quotas.
Each JSON entry includes raw ID, name, tags, a 240-unit description excerpt, source and
truncation flag. `src/ai/eventCommandAssist.ts` forwards the submitted request into this
projection. Validation still uses the full `eventResourceIdSet()` in
`src/ai/eventResourceCatalog.ts`, so a valid ID outside the visible 40 remains valid.
Keep description-heavy prompt imports in the prompt module, not the shared eligibility
module used by other consumers.

Descriptions are JSON-escaped reference data, not instructions or proof of listening.
Escaping doesn't replace write approval or tool validation. `src/ai/contextBuilder.ts`
directs fresh detail reads when full/current evidence is needed, including after conversation
compaction. Each request uses the current project rather than a description cache or an
old tool-result excerpt. Automatic `recommendMapBgm` selection is unchanged.

Focused coverage: `test/audioDescriptionTools.test.ts`,
`test/audioDescriptionDiff.test.ts`, `test/audioDescriptionToolStore.test.ts`,
`test/audioDescriptionToolExposure.test.ts`, `test/audioResourceToolPagination.test.ts`,
`test/audioDescriptionPrompt.test.ts`, `test/audioDescriptionPromptTransport.test.ts`,
`test/audioDescriptionSessionPrompt.test.ts`.

## Project wiki application ownership (2026-09-07)

`AssistantSessionOptions.prepareProjectWiki` is an awaited editor-owned checkpoint
before intent selection and authoring. Failure stops that turn before tools run.
The callback refreshes only the detached session's world documents.
Ordinary `applyProposedProject` calls retain the live `project.world`, because a
map/title proposal does not own codex edits made after its preview. Explicit
`resetProject` keeps its replacement semantics. Tests:
`projectWikiSession.test.ts` and `projectWikiApplication.test.ts`.

## Completed-house transaction protection - Phase 1 (2026-09-05)

`src/editor/tools/houseProtection.ts` is the shared completed-house ownership rule.
Every write through `runToolDefinition` captures the **current accepted project**,
not the assistant session's initial baseline, then checks the detached draft after
**global tree-pair repair and before commit**, including dry-run. There is no
selection, BuildSpec, map-target, or tool-name exemption. A rejected transaction
returns `protected-house-write` or `house-overlap` and commits none of its maps,
events, interiors, or map-tree additions. Human direct editing is unchanged.

Final application also checks the current live store before history or replacement.
`applyProposedProject` covers chat proposals, autonomous milestones, and cluster
AI acceptance. `applyRegionProjectWithHistory` covers full and partial region
approval after seam polishing. A safe detached tool result is not permission to
overwrite a later human house edit or to commit protected-cell changes introduced
by region postprocessing. Rejection leaves both the live project and undo history
untouched; see `applyProposedProjectHouseProtection`, `regionTaskHouseProtection`,
and `clusterAiModalHouseProtection` tests. Region tasks also retain newly completed
house snapshots from the full session proposal before clipping. Full, partial,
and immediate application check those snapshots after review polishing, so a
selection that excludes the north ridge cannot commit a damaged new house.
The selection is not expanded; unsafe candidates reject atomically.
`regionTaskCompletedHouse` covers clipping, approval-time re-polishing, and intact
house controls.

Completion is metadata-defined: `layoutPlan.regions` with `role:"house"` protect
the full bbox (including empty gaps between wings) plus its full-width north
ridge row `y-1`, clipped to the map. Human `structurePlacements` protect their
recorded rectangles, without an extra ridge. Both base layers and both persisted
sparse stack entries are compared exactly, including empty cells and absent
stacks. Stack rendering is deprecated, but that is not permission to erase saved
stack data. Non-house layout regions and raw wall/roof tiles do not acquire this
lock; existing fill role protections and incremental wall/door/window/roof
construction without completion metadata remain unchanged.

Roof-deck attachment protection requires recorded deck evidence (`shape:
"rooftop-deck"`, `shape:rooftop-deck` tag, or `roof-deck` tag), a recorded door,
and an existing upper ladder tile at the shared authored attachment coordinate.
Only that one ground attachment outside the bbox is added, not the whole yard;
an arbitrary nearby tile 322 is not evidence of a house attachment. The shared
ladder calculation is also used by `village/houses.ts` when authoring decks.

`houseKitDomain` preflights standalone/lots house footprints and records each
completed house after house-owned finishing, before subsequent yard work and
runner postprocessing. A draft-local seal retains those exact registration-time
values; it is never refreshed to accept later corruption. Legacy `build_house`
also preflights and registers. Durable ownership uses existing layout fields
and survives serialize/deserialize; no schema or lock UI was added. The next
transaction snapshots any accepted human edits, not original kit artwork.

Map deletion, changing the protected map's tileset ID/tile size, cropping, and
removing/shrinking/moving away/reclassifying recorded protection are rejected.
Descriptive labels, notes, and tags may change when protection is preserved.
New overlapping house geometry is rejected even when tile IDs are identical;
pre-existing overlaps are tolerated only while their overlap does not expand.
Village registration retains every earlier layout region and allocates unique
IDs. Phase 2 now seals village houses internally before environmental work;
see the construction contract below. The Phase 1 final guard remains unchanged.

Cluster approval (`clusterAiModal.ts`, including palette range classification) uses
`applyProposedProject` against the live store, not direct snapshot/replacement.
That common boundary owns house validation, undo, AI-attributed replacement,
focus and commit logging. A stale proposal that would overwrite human house
edits or remove a newly completed house leaves store/history and session draft
unchanged; the modal reports failure and keeps the proposal available. Safe
metadata-only proposals apply once and then rebase. Existing destructive/rule
confirmation hooks are unchanged. Regression: `test/clusterAiModalHouseProtection.test.ts`.

Focused contracts: `test/houseProtection.test.ts`, `test/toolHouseProtection.test.ts`,
`test/houseKitDomainSeam.test.ts`, `test/villageBuilderSeam.test.ts`,
`test/assistantMapPreservationGuard.test.ts`, `test/constructionToolsV3.test.ts`.
The session matrix covers accepted, same-turn, same-session, and newly created
maps against selection, `confirmDestroy`, and both `overExisting` values.

## Completed-house construction protection - Phase 2 (2026-09-06)

`village/builder.ts` finishes doors, ridge/roof/deck, banners, shop signs, and
linked interiors before publishing house regions. It captures exact layer/stack
snapshots once, locally to that builder invocation. Roads, yard fences, terrain,
environmental decor, landscape, placement cleanup, NPC placement, and snow ground
are checked against those same values after each stage. Road sub-stages also
check before retry rollback. No post-environment door/ridge restoration remains;
a damaged stage fails the whole tool with `protected-house-write`.

Village seals do not accumulate in the standalone producer's project WeakMap.
A discarded pipeline attempt discards its local snapshots; the accepted attempt
still passes the unchanged transaction guard after global tree repair. The
accepted start cell is excluded from new candidates so facade start restoration
cannot reopen a sealed house. Existing metadata houses and human stamp bounds
exclude new candidates and direct road/plaza/decor/landscape/snow writes, including
autotile neighbors. Roof-deck metadata also records custom deck templates through
the existing `roof-deck` tag. Only the existing bbox/ridge/recorded ladder geometry
is owned, not the whole yard. Exact counts, connected-road checks and explicit
capacity failure keep their existing contracts.

`fill_region` skips metadata-owned cells before passage previews, lower/upper
painting, `clearUpper`, and neighbor autotile writes. The fill-only structure-role
fallback checks both layers without creating ownership metadata. `filled` counts
permitted paint candidates; `mutatedCells` counts distinct final changed cells
(including unprotected reshaped neighbors); `skipped.structure` counts protected
requested candidates once. All-protected fills truthfully report zero change.

`forestComposition.ts` preflights floor tone/litter, bushes, gap closure, edge
feathering, undergrowth, full puddle candidates, and autotile neighbors. Tree
placement rejects the whole footprint. The supported ungrouped tree-base path
also excludes the repair canopy one row north before placing its trunk. Useful
work outside houses still succeeds. No force option, schema, lock UI, raw-wall
completion inference, human-brush restriction, or final-guard exemption was added.

Primary regressions: `houseProtectionFill`, `houseProtectionForest`,
`houseProtectionLifecycle`, and `villageHouseProtection`. Runnable integrated
50x50/100x100 evidence: `.omo/evidence/house-protection/p2/exercise.mts`.

## 퀘스트 입력과 완주 증거 계약 (2026-09-05)

`create_quest`는 `QuestDef`의 단계 정의와 이벤트/플래그를 만들며 graph를 만들지 않는다. `questToolSchemas.ts`가 giver/target의 `{mapId,eventId}` 또는 `{create:{mapId,x,y,name}}`, collect의 `itemId/count/sources`, kill의 `troopId/at`, reach의 `mapId/x/y`를 모델 스키마에 모두 노출한다. 공통 runner의 검사는 얕으므로 `parseQuestDef`가 실제 kind별 중첩 구조를 컴파일 전에 검증한다. 오류에는 `def.steps[0].at.mapId` 같은 경로와 올바른 형태를 싣는다. provider용 키 합집합 때문에 공통 좌표 정규화가 reach/talk에도 `at`를 합성할 수 있어, 단계 파서는 해당 kind의 필드만 검증한다.

`define_quest.completesWhen`은 이벤트용 `CONDITION_SCHEMA`와 다르다. **switch/variable/storyFlag 3종**과 `{all:[조건,...]}`만 모델에 노출한다. gold/item/selfSwitch 또는 `{kind:"all",conditions:[...]}`는 지원하지 않는다. 아이템 획득이나 전투 결과를 조건으로 쓰려면 이벤트가 switch/variable에 기록한 값을 참조한다. 같은 ID의 단계 정의를 graph로 교체하는 호출은 `quest-kind-conflict`로 거부한다. 성공을 만들기 위해 원래 단계 메타를 지울 수 없다.

`verify_quest`는 **선언된 graph 노드만** 검사한다. 미선언 목표의 완성도나 전체 게임 완주를 뜻하지 않는다. walkthrough에 `manualHints` 또는 debug `set` 단계가 있으면 read 도구 실행은 정상이어도 `data.ok=false`, `verificationStatus:"manual-required"`이며 요약은 `미검증`이다. `simulationOk`는 디버그 대체를 포함한 시뮬레이션 결과이고, `verifiedNodeIds`는 완주 증거가 있는 노드 목록이다. `workItemOutcome.verifyAuthoredQuestsPlayable`도 동일하게 수동/강제 세팅을 완료 근거에서 제외한다. 단계형 퀘스트의 자동 완주 검증은 아직 지원하지 않으며, 기존 정의를 보존한 실제 플레이 검증이 필요하다고 안내한다. 같은 ID의 `define_quest` 재등록을 권하지 않는다.

회귀: `test/questToolContract.test.ts`(중첩 입력·실제 예시·overwrite 거부), `test/questGraph.test.ts`(전투·맵 이동의 debug 대체는 미검증), `test/bossPhaseQuestOutcomeGate.test.ts`(직접 완료 게이트). Provider 계약은 `test/toolSchemaProviderCompat.test.ts`.

## DB 조회 페이지와 마을 전체 범위 (2026-09-05)

`get_database_records`는 collection/include 외에 `ids`, `limit`(1~500), `offset`을 받는다. 응답은 실제 `records`, 필터 후 `total`, 이어 읽을 `nextOffset`(없으면 null)이다. 대규모 DB에서 ID 목록을 먼저 읽고 기존 레코드 변경 직전 `ids:[실제 ID], include:"full"`로 필요한 원본만 조회할 수 있다. 페이지에 반환되지 않은 ID는 조회 증거로 인정하지 않는다.

`author_village`의 target.fullMap 또는 루트 fullMap이 true이면 세션이 뷰포트 20×20 bounds를 끼워 넣지 않는다. 전체 맵 요청과 부분 bounds를 함께 전달하면 `village-scope-conflict`로 거부해 둘 중 하나를 고르게 한다(사람 승인 단계가 아니라 모델의 인자 수정). bounds를 조용히 넓히거나 전체 요청을 부분 시공으로 완료하지 않는다. Tests: `authorVillageViewportBounds`, `authorVillageScopeGate`.



> **Encoding note:** Some Korean descriptive text has EUC-KR→UTF-8 mojibake from the original source commit. English terms, file paths, and code references are intact. For accurate Korean, consult the referenced source files. Partial automated restoration applied; remaining garbled CJK is irreversibly corrupted.

Soft-confirm vocabulary, region task routing, AI visual polish, dock modes, tool exposure caps, and MCP bridge.

- **루트 컨테이너의 게임 느낌은 `src/editor/lootFeedback.ts` 한 곳에서 낸다 (2026-09-04 실측 결함 수정):** `place_chest` 와 `place_concept` 의 `loot` 칩(나무 상자·잡화 상자·캨비닛·술통·진열대)이 「지급 + 텍스트」만 뻑어 상자를 열어도 소리 하나 없고 열림 페이지가 **닫힌 그림**을 그대로 썼고, 공지 문장은 raw `item_potion` id 를 노출했다. 이제 닫힘 페이지는 `chestOpenCommands`(개방 SE `cc0-se-osx-wooded-box-open` → `setEventGraphicPattern` right(반개방) → up(개방), 각 `wait`) → `lootGrantCommands`(아이템 징글 `…nes09` → `changeItem` → 사이 → 동전 `cc0-se-orp-inventory-coin` → `changeGold`) → DB 이름으로 쓴 `text` → `setSelfSwitch` 순이고, 열림 페이지 그래픽은 `chestOpenedGraphic`(같은 슬롯의 up 프레임)이다. 타일 가구인 개념 loot 는 `lootRummageCommands`(같은 나무 SE + wait) 다음 동전→금화→문장. RM2k3 Object 차셋의 상자 슬롯은 **방향 행**이 개방 단계다(down=닫힘, right=반개방, up=개방 — Object1.png 슬롯 6 실측). SE id 는 전부 CC0 카탈로그라 참조 검증을 통과하고 `test/lootFeedback.test.ts` 가 `isSeCatalogResourceId` 로 오타 회귀를 잡는다. 출하 플레이어 증명은 `npm run qa:runtime -- --scenario chest-open`(`openwiki/testing.md`).

- **의도 라우팅은 모델이 한 번 선언한다 (2026-09-03, 키워드 분류기 7종 삭제):** 턴 시작에 `intentDeclarationClient.createLlmIntentDeclarer` 가 lite 모델·`json_object` 로 사용자 원문을 읽어 `{mode, space, facility, targetMapId, useSelection, clarify, needsPlan, resetsContext, tools}` 를 선언하고(`src/ai/intentDeclaration.ts`, 1.7~2초), 세션은 그 선언만 소비한다 — 되묻기(chat 에서만, 모델이 낸 질문 그대로), 플래너 스킵(selection·question·single-step), 플래너 direct 존중, 볼륨 막대(플래너가 `new_plan.volume` 으로 선언한 것만), 툴 노출(코어 + UI 도메인 + 선언 툴의 도메인 + 핀; 선언 툴·원문의 이름 언급·능력 승격은 상한 밖), 수정 대상 맵, 완성도 린트. 본문 모델에는 **의도 노트**(「대장간 = place_concept(query:"대장간"), 야외/실내 다시 묻지 말 것」 등)와 **선택 영역 노트**가 오케스트레이션 메시지로 간다. 「도구 규칙」 가이드 17줄과 카테고리 가이드는 **툴 설명 40곳으로 옮겼고** 메시지는 사용자 발화 + `[컨텍스트]` 사실만 싣는다. 삭제: `modifyIntent`(→`contextFooter.ts`)·`intentClarify`·`plannerSkip`·`regionIntentRouter`·`INTENT_KEYWORDS` 문장 스캔·볼륨 정규식/강제 계획·`detectConstructionIntent`. 근거는 2026-09-03 감사(52문장 매트릭스·브라우저 17회): 가이드(기계 텍스트)를 분류기가 사용자 말로 읽어 chat 되묻기 22/52 오탐, 플래너 protocol-lock 오발, 「이 마을에 상인 하나 추가해줘」 93초·맵 3장 폭주. 설계 노트 `docs/superpowers/specs/2026-09-03-llm-intent-routing-design.md`, 진단 스펙 `test/e2e/_intent-router-cases.spec.ts`(CASES/AGENT_MODE/CASES_OUT). 아래 「도구 규칙 공유」「영역 라우터」「되묻기 정규식」「볼륨 계약 코드 강제」 서술은 이 날짜 이전 상태다.
- **시설은 모델이 설계하고 코드가 시공한다 — 「AI 는 소비만」 철회 (2026-09-03):** 「여관 지어줘」가 매번 픽셀 단위로 같은 맵을 냈다. `place_concept` 경로(도면 `layoutConceptFacility` → 구성 `composeConceptRoom` → 카탈로그 그림)에 난수가 한 곳도 없었고 `seed` 는 테마 가구 경로에서만 소비돼 죽어 있었으며, 모델은 시설명 외에 넣을 인자가 없었다. 이제 DB 「맵 → 타일셋 → 개념 꾸러미」의 시설은 **템플릿(출발점)**이다: 모델이 `get_concept_facility(query)` 로 템플릿(plan 모양)·물건 어휘·여관 `variants[]`(시골 단층 / 2층 / double-row)를 읽고, 수식어가 없어도 규모·layout 을 정한 `plan` 을 `place_concept({query, mapId, plan})` 에 넘긴다. 좌표·벽·문·이벤트는 여전히 코드 몫이다(모델이 bbox 를 찍던 옛 경로의 실패를 되풀이하지 않기 위해). 경계는 `src/editor/conceptPlan.ts` `parseConceptPlan` 이 한 번만 검증한다 — 어휘에 없는 objectId·모르는 칩·없는 장소 참조·범위 밖 count/level 은 `invalid-plan` 으로 거절하고 허용값을 문장에 담는다. 템플릿의 `required` 물건을 설계에서 빼면 **경고**(거부 아님). 템플릿에 없는 시설(「목욕탕」)도 plan 이 있으면 짓는다. `plan` 생략 시 종전과 같이 템플릿 그대로. `composeConceptRoom` 은 `seed` 를 받아 방마다(`deterministicRng(seed, "concept", roomId)`) 첫 가구의 좌우, 동률 후보, 구석·러그 자리를 흔든다 — 자리 채움을 깨지 않도록 「가장자리 시작」 규약은 유지하고 서↔동만 뒤집는다. `seed` 생략 시 mapId 해시에서 파생(같은 mapId 는 같은 배치). 의도 선언의 시설 `tools` 는 `[get_concept_facility, place_concept]`. 프롬프트 절 「개념 꾸러미 — 시설 템플릿」과 툴 설명이 같은 순서를 말한다. Tests: `test/placeConceptTool.test.ts` 「place_concept plan」 9건(3객실+주방 설계, 필수 누락 경고, invalid-plan 3종, 템플릿 없는 시설, 2층 설계, seed 변주·재현, 전 seed 자리 채움).
- **시설 실내는 place_concept 가 개념 꾸러미를 읽는다 (2026-09-02):** 사용자가 데이터베이스 「맵 → 타일셋 → 개념 꾸러미」에서 고친 시설→장소→물건→칩 나무가 정본이다. `place_concept({query, mapId})` 가 그 나무를 풀어 실내 맵을 시공하고, 테마 하드코딩 가구는 끈다. 빈 배열(`[]`)은 재시드하지 않는다. 「여관 지어줘」는 실내 시설로 라우팅하고 야외/실내 되묻기를 하지 않는다(「여관 주인」은 직업이라 빼다). 40툴 상한에는 핀하지 않고, 설명 낱말 승격·`find_tools` 로 손에 넣는다. **시공은 도면·구성·칩 집행까지 한다(2026-09-02 개편):** 장소 `role/size/count` 로 홀(정문)→복도→방 3단 도면(`layoutConceptFacility`), 슬롯 구성(`interiorConceptCompose.ts` — 벽걸이는 벽면, 계단은 복도 끝, 문 앞 통로 비움, 못 놓은 물건은 `concept: … 자리 없음` 경고), 칩 이벤트(`interiorConceptEvents.ts` — sleep=`inn`, transfer=계단 연결 지점, loot=1회 노획, event=조사). 툴 결과 `data.rooms`·`data.connections`(미연결 계단은 대상이 같은 맵 정문) 을 싣는다. 실제 조수 턴 증거 스펙: `test/e2e/_place-concept-inn-evidence.spec.ts`(진단), 보고서 `scripts/gen-place-concept-report.mts`. **두 턴 사이 DB 수정은 세션이 다시 읽는다 (2026-09-02 실측 수정):** 세션 draft 는 마지막 적용 시점 사본이라 사용자가 임시 탭에서 여관→주막으로 고친 뒤 「주막을 새 맵으로 지어줘」가 「찾지 못했다」로 실패했다. 패널 `sendText` 가 새 턴 직전 승인 대기 제안이 없으면 `AssistantSession.syncBaselineFromStoreIfClean(store.getCurrent())` 로 기준을 맞추고 시스템 프롬프트를 재조립한다(`rebaseProject` 는 이제 `turnProposals` 도 비운다). 실측 함정: 「주막 만들어줘」는 여관 맵이 이미 있으면 모델이 기존 맵 단장(`furnish_interior_space`)으로 읽는다 — 새 맵이면 문장에 「새 맵으로」. 영역 라우터(`regionIntentRouter`)는 여관 같은 실내 시설 낱말이 있으면 structure 가이드를 떼지만, 야외 자리 단서(공터·부지·마당·들판·야외)가 함께 오면 남긴다(「이 공터에 여관을 짓고…」는 야외 건물 + 실내). WorkPlan `complete_work_item` 이 직전 `place_concept` 성공을 「기록 없음」으로 거부하던 false negative 는 고쳤다(2026-09-03): 원인은 라운드 끝 successTools 자동 완료가 성공 툴 집합을 비운 뒤 모델이 같은 항목을 명시 완료한 것 — 이미 done/skipped 인 항목은 `completeWorkItemById` 가 `alreadyDone` 으로 idempotent 하게 받고 「다시 시공하지 마세요」라고 답한다(`test/workPlan.test.ts`). 거부 → 재시공으로 같은 맵을 두 번 짓던 실측이 `reports/place-concept-inn/e2e/receipt.json` 에 있다. Tests: `test/placeConceptTool.test.ts`, `test/placeConceptAssistant.test.ts`(스텁 LLM 첫 라운드 노출·호출), `test/placeConceptRender.test.ts`, `test/intentClarify.test.ts`. **시설 아홉 종 (2026-09-02 다양화):** 실내 칩셋 초안은 여관·민가·상점·술집·서재·대장간·교회·창고·길드(`CONCEPT_FACILITY_TEMPLATES`)다. 툴 설명에 그 시설명과 별칭(주막·도서관·성당)을 낱말로 박아 「상점 지어줘」「대장간 만들어줘」가 승격(matchScore ≥ 20)된다 — 설명의 낱말을 지우면 승격이 죽는다(`test/conceptFacilityTemplates.test.ts` 가 모든 초안 라벨로 잠근다). 시스템 프롬프트 개념 꾸러미 절은 **두 단계**다(2026-09-03): 초안 그대로(칩셋에 `scratchConceptBundles` 가 없음)면 시설명 한 줄(`query=시설명`), 사용자가 고친 나무(배열 있음)면 시설마다 한 줄(`query="…"`, 장소 `[역할·크기 ×개수·바닥]`, 물건 라벨 + 표식 `*필수 ⌂수면 $노획 ↔맵 연결`, 벽 재질은 기본값이 아닐 때만, 9시설 ≈ 1,500자). 빈 프로젝트 프롬프트는 20,000자 예산 중 약 19,250자를 이미 써서 초안에도 시설별 줄을 싣자 뒤의 「게임 스타일 문서(발췌)」가 밀려났다(`test/worldAiExclusion.test.ts`) — 프롬프트 절을 늘릴 때 이 테스트가 예산 카나리아다. 찾지 못한 시설명은 오류 문구에 지금 부를 수 있는 시설 목록을 싣는다. **층(2026-09-03):** 장소 `level`(1~3) 이 둘 이상이면 `place_concept` 이 층마다 맵(`<mapId>_2f`, 「<시설명> 2층」)을 짓고 코드가 잇는다 — 아래층 계단(transfer 칩) → 위층 문 자리 북쪽 착지, 위층 정문 이벤트 → 「계단(아래)」 → 아래층 계단 앞. 층마다 밴드 폭을 가장 넓은 층에 맞춘다(`minBandWidth`). 결과 `data.floors`. 아래층에 계단이 없으면 정문 앞으로 내려오고 경고. 초안 아홉 종은 한 층이다(`test/conceptFacilityLevels.test.ts`). **볼륨 계약 폭주의 근인(2026-09-03 수정):** 패널이 매 턴 붙이는 「도구 규칙」 가이드의 마을·상점·NPC 낱말이 의도 스캔에 섞여 모든 공간 요청이 마을 막대를 받았다 — `stripContextFooter` 가 가이드 블록(「도구 규칙:」/「(영역 작업: …)」 첫 줄부터)을 뗀다. `buildVolumeWorkPlan` 은 막대가 요구하는 축만 항목으로 둔다. 실측 「여관 지어줘」 66초·툴 19회 → 10초·툴 3회(`test/e2e/_concept-inn-audit.spec.ts`, 감사 로그 전체 덤프 진단 스펙). **의도 라우터·되묻기에는 여관 외 시설명을 넣지 않았다** — 「대장간 지어줘」는 야외 건물일 수 있어 기존대로 실내/야외를 되묻고, 실내로 답하면 place_concept 이 짓는다(코퍼스 `blacksmith-full` 은 structure+npc-shop 을 기대한다).

- **조수 예산은 후하다 (2026-09-01):** 채팅 기본 `maxTokens=200000` · `maxToolCalls=2000`. 영역 AI 천장도 2000 (`REGION_SURFACE_MAX_TOOL_CALLS`). 저장된 옛 공장 기본(토큰 32768/툴콜 200)은 로드 시 새 기본으로 승격. WorkPlan Ralph 자동 이어가기 256단계. 시스템 프롬프트 문자 예산 100000. cpen 전송층 `max_tokens` 8192 클램프는 공급자 422 때문에 그대로다(동반 서비스/Antigravity 는 제한 없음). Tests: `test/aiLlmClient.test.ts`, `test/assistantEndpoint.test.ts`, `test/regionTaskRun.test.ts`.
- **볼륨 오케스트레이션은 코드가 강제한다 (2026-09-01):** 예산만 올려서는 모델이 한 줄 NPC 로 퇴장한다. `volumeContract.ts` 가 턴 시작 스냅샷 대비 델타 막대(RPG=맵3·상태별 NPC6·상점1·퀘스트1 / 마을=맵1·NPC3·상점1)를 재고, 플래너 `direct` 를 거부하며, 툴 없는 종료에 `HARNESS CONTINUE` 를 최대 8회 재주입한다. 사용자 「계속」은 안전 상한(Ralph 256 / 자율 런 48) 뒤에만 남는다. Tests: `test/volumeContract.test.ts`, `test/volumeContractSession.test.ts`.
- **런이 끝나면 토큰·시간을 남긴다 (2026-09-01):** `runRecap.ts` 가 호출 지점 토큰 델타와 경과, 플래너/Ralph/볼륨/툴 과정을 감사 `run-recap` JSON 과 활동 로그에 기록한다. 채팅에는 토큰 한 줄만 보인다. Tests: `test/runRecap.test.ts`.
- **복잡한 NPC 는 조회 후 상태별 다중 페이지 (2026-09-01):** 한 줄 인사 `place_npc` 만 부르는 단편 저작을 막는다. 프롬프트 블록 `EVENT_PAGE_SEMANTICS_BLOCK` + 수칙 8이 조회 순서(`find_events`/`get_event`/`get_story_state`/`get_database_records`)와 상태별 페이지 패턴을 고정하고, `place_npc.characterId`·페이지별 `name`/`graphic`, `make_villager` 의 `pages`/`dialogue.when`(switch·selfSwitch·friendship) 이 그 패턴을 실제로 받는다. `find_events` 매치는 pageCount/conditionKinds 를 포함한다. 상세는 `openwiki/editor-event-authoring.md`. Tests: `test/aiEventPageSemantics.test.ts`, `test/toolsMapManagement.test.ts`.

- **들어가서 걷는 집은 `author_house(interior:"linked-interior")` 한 번이 정답 (2026-09-04):** 외장만 짓고 `create_transfer_pair`/`start_interior_room_session` 으로 잇는 3단계는 가짜 출입구(같은 맵 teleport)와 점유된 문 칸에서 깨진다. `linked-interior` 는 실내맵+문/출구 양방향 전이를 원자적으로 만든다(`houseKitDomain` → `createHouseInteriorMap`). `interior` 생략도 이 모드가 기본. `space:"both"`·야외 집·영역 위 집은 이 경로, 외장 없는 독립 실내만 세션, 개념 시설은 `place_concept`. Tests: `test/intentDeclaration.test.ts`, `test/proposalCompleteness.test.ts`, `test/interiorRoomPipeline.test.ts`, `test/constructionContracts.test.ts`.
- **집 문은 기본 개방 — 걸어 들어가면 열린다 (2026-09-05 갱신):** 실외 집 시공(`author_house`/`build_village`/`build_house_kit`)의 집 문은 문 스프라이트(벽 칸, below 장식) + 문 앞 통행 칸의 투명 발판(`<doorEventId>_step`, playerTouch+below) 두 이벤트다. 문 칸은 벽이라 밟히지 않으므로 playerTouch 발판은 문 앞에만 둔다 — 시작집 문(STARTER_HOUSE_DOOR_APPROACH)과 같은 배치. 발판은 `callMapEvent(doorEventId)`로 문 본체의 활성 페이지를 실행한다. 이전에는 발판이 `transfer`만 가져 문 본체의 열림 SE·프레임·대기를 전부 건너뛰었다. 본체 페이지를 복사하지 않아 이후 사용자가 바꾼 소리·조건·명령도 그대로 따른다. 기존 문을 고칠 때는 발판의 단일 transfer를 문 ID를 가리키는 callMapEvent로 바꾸고 문 그림·페이지·실내·출구는 보존한다. **귀환 착지가 발판과 같아도 즉시 재전이하지 않는다:** `transferTo`는 도착 후 auto만 실행하고 playerTouch는 걸음 완료 때 평가한다. 벽 위 문 그림의 통행 경고와 착지 발판 경고만으로 런타임 불량을 단정하지 말 것. Tests: `test/houseDoorOpen.test.ts`(실제 생성→호출→열림 순서·원본 편집 보존·귀환 시 접촉 미실행).
- **출입구·타일은 벽에 바짝 붙인다 (2026-08-31):** 모델이 벽·맵 끝에서 1칸 안쪽에 좌표를 잡는 버릇이 있다. `create_transfer_pair` 는 `snapFlushToWall`(`src/editor/tools/wallFlush.ts`)로 그 1칸을 당긴다 — 맵 가장자리(x=0 / width-1)와 벽 바로 앞 통행 칸. playerTouch+below 는 벽 칸 위에서 발동하지 않으므로(`openwiki/runtime-sessions.md`) 벽 위 요청도 바로 앞 통행 칸으로 옮긴다. 문 자리 자체가 이벤트에 점유됐으면(여관 문 이벤트 등) 1칸 안쪽을 gate로 쓰지 않는다 — 스냅이 밀려난 자리를 radius=0에서 제외하고 옆 flush 칸을 먼저 찾으며, 착지가 점유된 후보도 버린다(2026-09-04). `fill_region` / `paint_tiles` rect 는 맵 **안 벽** 과의 1칸 틈만 메운다(맵 가장자리까지 늘리면 원형 호수가 남쪽으로 샌다). 프롬프트 정책 「벽 밀착」과 도구 description 이 같은 말을 한다. Tests: `test/wallFlush.test.ts`, `test/transferGateOccupied.test.ts`, `test/agentUxPolicyPrompt.test.ts`.

- **구조물 스탬프는 사람 팔레트 전용 (2026-08-31):** 구조물 스탬프는 LLM 비노출이고 사람 팔레트에서만 쓴다. 프롬프트 수칙 11과 「구조물 스탬프는 사람 팔레트 전용」 절이 같은 금지를 말한다. 집=`author_house`, 마을=`author_village`, 벽=`build_wall`, 지형=`fill_region`, 소품=`place_props`. 사람 팔레트 선반·`applyPaletteStamp` 경로는 그대로다. Tests: `test/structureKitTools.test.ts` 「제거된 구조물 스탬프 호출은 미등록으로 거부된다」.

- **"여기에 마을"은 보고 있는 화면에 지어진다 — 타일 사각형 규약은 좌상단 기준·칸 수·마지막 칸 x+w-1 (2026-08-30):** `author_village` 가 `kind:"existing"` 이면서 `target.bounds` 가 없으면, **호출 경계**가 라이브 뷰포트 스냅샷 중심에 `MIN_SIZE`(20, `tools/village/constants.ts`) 정방형을 만들어 맵 안쪽으로 밀어 넣은 뒤 구체적인 좌표로 인자에 박는다(`AssistantSession.resolveToolCallArgs` → `viewportVillageBounds`, `src/editor/tools/authorVillageSupport.ts`). **툴 자신은 `(draft, args)` 의 순수 함수로 남는다** — bounds 가 없으면 툴은 여전히 맵 전체를 재포장한다. 라이브 상태를 툴 안에서 읽으면 같은 인자가 카메라 위치에 따라 다른 영역을 시공해, `applyToolSequenceToStore` 재적용과 감사 재생이 사용자가 검토한 영역과 달라진다. 채팅 경로 전체로 보면 맵 전체 재포장은 **그 맵에 맞는 스냅샷이 없을 때만** 일어난다. 왜 필요했나: 라우팅 예시 문구가 모델에게 bounds 를 생략하라고 말하므로, 예전 기본값은 사용자가 한 화면만 가리킨 맵을 (0,0) 부터 다 덮었다. **함정:** 뷰포트 스냅샷은 한 변이 최대 16타일로 재단되고(`DEFAULT_VIEWPORT_MAX_SPAN`, `src/ai/mapViewportContext.ts:35`) rect 파서는 w/h 20 미만을 거부하므로(`MIN_SIZE`), 스냅샷 사각형을 **그대로 넘길 수가 없다** — 그 부정합이 헬퍼가 자기 정방형을 따로 만드는 이유다. 사각형 규약은 이제 `set_build_spec` 스키마 설명과 시스템 프롬프트의 뷰포트 블록에 명시된다: 좌상단 원점, w/h 는 타일 **칸 수**, 마지막 칸은 x+w-1 / y+h-1. `가시 영역` 줄은 그에 맞춰 마지막 칸을 **포함해** 찍는다 — 예전엔 반열림 끝값을 찍어, 그것을 그대로 베낀 모델이 한 칸 밀렸다. 스냅샷의 타일 크기는 `TILE_SIZE`(16) 고정이지 `map.tileSize` 가 아니다 — 그리기·`pointerToTile` 이 전부 16 단위라 여기서만 `map.tileSize` 를 쓰면 스냅샷과 나머지 사이에 좌표계가 쪼개진다. Tests: `test/authorVillageViewportBounds.test.ts`, `test/mapViewportContext.test.ts`.

- **AI reach: prompt capability index + natural-language escalation + authored-data facades (2026-08-27):** three separate walls kept the assistant out of editor areas that already existed, and all three are now closed.
  1. **The model could not see what exists.** The registry holds 148 LLM-reachable tools but only 40 schemas ride each round, and `buildSystemPrompt` listed none of them — an unexposed tool was indistinguishable from a missing feature, which is exactly how the 2026-08-23/24 "그 기능이 없습니다" incidents below happened. `src/ai/toolCapabilityIndex.ts` now builds a **names-only** index of `activeTools()` grouped by editor area (핵심/맵/타일·배치/이벤트/데이타버이스/퓠스트/월드 그래프/전통/시스템 + 기타 catch-all; a multi-domain tool appears under its first domain only, every live tool exactly once) and `buildSystemPrompt` emits it directly after `INTRO`, before the budget slicer's reach. **The index's own char cost is added to the effective budget** because the empty-project prompt already measured 11,978 chars against `DEFAULT_BUDGET_CHARS` 12,000 — without that, the index would have silently evicted the map-region tail. It also survives the smallest calibrated budget (`tokenBudget` clamps to 0.5x = 6,000). Its rule block states that every listed name exists, that a missing schema means `find_tools(query)` then call it next round, that reporting a listed capability as unsupported is a defect, and that the UX-policy engine limits (3D, real-time action battle, external API/plugins, real deployment) still stand. Contract: `test/aiToolCapabilityIndex.test.ts` — exact-once coverage against the LIVE registry (a newly registered tool cannot fall out silently), no deprecated name advertised, pre-existing sections still render, deterministic output, and a char ceiling that fails loudly when the index balloons.
  2. **Escalation only fired on exact tool names.** `mentionedToolSchemas` needs the user to type the registry name, so "타이틀 화면 바곶줘" (domains core|map|system, `set_title_screen` not in the 40) escalated nothing. `src/ai/capabilityEscalation.ts` scores the request against the whole active registry with **the same matcher `find_tools` uses** (`matchScore`, now exported from `discoveryTools.ts` — one matcher, so auto-escalation and model-driven discovery never disagree), requires score >= 20 so a single incidental word cannot drag a tool in, drops already-exposed names, and returns at most 6 schemas. Those join the required set outside the domain cap while the base slice shrinks by the same count, so the round's unreserved working set stays 40; `clampTurnToolSchemas` keeps the whole request inside the provider's 128 and **drops escalated guesses first** so a guess can never evict a mentioned/plan-required/core tool. Observable via `tools:escalated <names> (capability)` and the `| capability:<names>` suffix on `tools:exposed`. Contract: `test/aiCapabilityEscalation.test.ts` (asserts the premise — tool absent from both the domain slice and name-mention escalation — before asserting recovery).
  3. **Some editor areas had no tool at all.** A full audit of every top-level `Project` field, every `ProjectDatabaseRecords` collection and every `SystemRecords` field against the registry (`.omo/evidence/ai-editor-reach-20260827/coverage-audit.md`) found **32 authored-data surfaces the editor UI writes and no tool could touch** — the life-sim/economy half of `SystemRecords` was the largest hole. New typed facades: `upsert_craft_recipe`/`delete_craft_recipe`/`upsert_item_upgrade`/`set_sell_prices`/`upsert_tool_action`/`configure_life_economy` (`lifeEconomyTools.ts`); `upsert_fish_species`/`delete_fish_species`/`configure_fishing`/`configure_seasonal_forage`/`configure_museum`/`configure_collections` (`lifeCollectionTools.ts`); `upsert_farm_building_type`/`upsert_home_decoration_type`/`upsert_farm_animal_building`/`set_session_farm_state` (`farmSpatialTools.ts`); `configure_game_systems`/`set_project_genre` (`gameSystemToggleTools.ts` — genre on the EXISTING project, because `reset_project(genrePreset)` wipes it); `create_tileset`/`set_tileset_properties`/`upsert_autotile_group`/`delete_autotile_group`/`set_animation_strips`/`set_tile_grafts` (`tilesetAtlasTools.ts` — before this, no tool could create a tileset at all); `upsert_map_connection`/`delete_map_connection`/`upsert_village_document`/`delete_village_document`/`upsert_resource_profile`/`delete_resource_profile`/`upsert_character_profile`/`upsert_test_preset`/`delete_test_preset`/`manage_flag_slot` (`authoringMiscTools.ts`; `manage_flag_slot` is the first way to add a plain switch/variable slot or delete one with a reference check — `prune_unused` only blanked names). `delete_database_record`/`duplicate_database_record` now reach `monsterSpecies`/`crops`/`lifeSkills`/`farmAnimalSpecies`/`fishSpecies`/`farmBuildingTypes`/`homeDecorationTypes`, and `set_title_screen` reaches `backgroundLayers`/`particles`/`intro`. Every section in a `configure_*` facade is independent: passing one section must not clear its siblings. Contracts: `test/aiEditorReachParity.test.ts` (names + provider-compatible schemas + index/registry reachability for all of them) plus one behavioral test per facade file. **Sections deliberately left uncovered:** `session.placeables`, `assets.sprites`, `project.flags` — no editor UI writes them, so a tool there would be ahead of the editor.
  Runtime proof (not just unit tests): `test/e2e/ai-editor-reach.spec.ts` loads the real editor, imports the live modules in the page, and asserts the assembled prompt indexes every active tool and that the natural-language request escalates the tool the domain slice dropped. **Registration seam note:** the six facade modules were registered in `toolRegistry.ts` as empty arrays *before* implementation so parallel agents never had to edit the registry — that prevented git conflicts, but a broken intermediate module still breaks every sibling's test run through the shared import, so each module must stay compiling after every save.

- **AI 배치 툴은 통행 가능 칸에 자동 착지한다 (2026-08-27):** `place_battle_blocker`는 `inMapBounds` + `troopId` 만 검사해 몬스터를 벽 위에 그냥 세웠다. 이제 모든 이벤트 배치 툴은 `resolveEventPlacement`(`src/editor/tools/eventTools.ts`)를 지난다 — 캐릭터형(몬스터·추격자·NPC)과 밟아서 발동하는 트리거는 반경 3 자동 착지로 `isPassable` 칸을 강제하고 `위치 자동 조정: (a,b) → (c,d)` 경고와 `data.adjusted` 를 낸다. action 트리거 오브젝트(문·상자·간판)는 RM2K3 의미대로 벽 위를 허용하되, 인접 칸이 전부 막혔으면 착지시키거나 `*-impassable` `ToolError` 로 거부한다. 그래도 사면이 막힌 채 남은 이벤트는 `projectLint` 의 `event-unreachable` 경고가 잡는다. 실면 증거(배포 데모 맵 5개 × `runTool`): `npx vite-node scripts/prove-ai-placement-passability.mts`, 로그는 `.omo/evidence/ai-place-passable-20260827/`. 계약 테스트: `test/aiEventPlacementPassability.test.ts`, `test/projectLint.test.ts`.

- **보물상자의 벽감 예외는 수면 허용이 아니다 (2026-09-05):** `place_chest`는 `assertChestDrySurface`로 요청 좌표와 자동 착지 결과를 검사한다. 현재 타일셋의 `tileMeta.role`/물 그룹으로 수면을 식별하고, 메타가 없는 기본 칩셋에만 기본 물 타일 번호를 적용한다. 다른 칩셋의 같은 번호를 물로 단정하지 않는다. 수면은 이웃 지면에서 조사 가능하거나 통행 설정을 열어도 `chest-on-water`로 거부하며, 오류는 지면·다리 좌표를 안내한다. O 상층 다리/발판은 지지면으로 허용하고 ★ 장식은 하층 물을 덮지 않는다. 기존 벽감 상자와 다른 action 이벤트의 접근 정책은 그대로다. 사전 `get_map_region` 호출 여부와 무관하게 검사한다. 회귀: `test/treasureChestPlacement.test.ts` — 숲 던전 (19,6) 물가 재현의 `runTool` 실패·무변경, 통행 가능한 물, 다리/★ 장식, 타일셋별 역할, 자동 착지 수면 거부.

- **배치 계약이 이제 정말 전수 적용된다 + 구조 게이트 (2026-08-30):** 위 2026-08-27 항목의 "이제 **모든** 이벤트 배치 툴은 `resolveEventPlacement`를 지난다"는 실측과 달랐다. 계약을 지나지 않고 `map.events` 에 직접 쓰던 경로가 7곳 남아 있었고, 그것이 "AI 가 물 위에 NPC 를 세운다"는 신고의 실제 원인이었다: `set_lighting_volume`/`set_scene_mood`(applyMode "event")가 area 전 칸에 playerTouch 이벤트를 무조건 생성, `author_story_arc`, 퀘스트 컴파일러 7개 생성 지점(대화 NPC·기버·드롭 전투·도달 마커·수집물·게이트), `copy_map_region`(withEvents)의 목적지 무검사 복제, 조사 퍼즐 4개 컴파일러(특히 push-switches **발판**은 playerTouch 라 물 위면 퍼즐이 풀리지 않는다), `give_starter_monsters`, 그리고 계약 자신의 파일에 있던 `ensureMapCheckpointEvent`(0,0 고정)·`script_cutscene`. 지금은 전부 계약을 지난다 — 캐릭터형·밟기형은 통행 가능 칸 강제, action 트리거는 인접 통행 가능 칸 필수.
  - **단일 대상 vs 영역/대량의 처리가 다르다.** 단일 대상은 기존대로 반경 3 자동 착지 + `위치 자동 조정` 경고, 실패 시 `*-impassable` ToolError. 영역/대량(조명 볼륨·분위기·퍼즐 발판·영역 복제)은 **전체를 실패시키지 않고** 통행 불가 칸을 건너뛰고 `통행 불가 칸 N개를 건너뛰었습니다: (x,y)...` 로 보고한다(죽은 이벤트를 만들지 않는 것이 목적이므로). `copy_map_region` 은 `data.eventsCopied`/`data.eventsSkipped` 로도 센다.
  - **auto 트리거는 throw 하지 않는다.** `ensureMapCheckpointEvent` 를 캐릭터형으로 걸었더니 좌상단 반경 3이 전부 막힌 맵(동굴·두꺼운 벽)에서 ToolError 가 `place_trap(respawnCheckpoint)`/`make_chase_scene(checkpointOnEntry)` **전체**를 죽였다 — auto 는 좌표와 무관하게 발동하므로 원래 (0,0) 배치는 기능 버그가 아니라 린트 경고였고, 고치려던 것보다 나쁜 회귀였다. `checkpointSpot` 은 착지 시도 → 실패 시 맵 전체 첫 통행 칸 → 그것도 없으면 (0,0) 이며 절대 throw 하지 않는다.
  - **지형 편집이 이벤트를 조용히 좌초시키지 않는다.** `mapHelpers.passabilityWarning` 은 칸 수만 세던 것에서 그 칸에 남은 이벤트 id·좌표(최대 5건 + "외 N건")를 함께 말하도록 바뀌었다. `paint_tiles` 로 NPC 위에 물을 칠하면 그 자리에서 알 수 있다.
  - **「오른쪽 위」는 화면 기준 좌표로 확정한다.** `src/ai/viewRelativeLocation.ts` — 가시 카메라 상자(`viewX/Y/W/H`)를 사분면으로 자르고, 턴 프롬프트와 암묵 명세와 마을 `forestAnchor`가 그 상자를 쓴다. 맵 전체 구석·강 반대편 숲 띠로 추측하지 않는다. Tests: `test/viewRelativeLocation.test.ts`.
  - **모델이 물을 먼저 본다.** `formatViewportContextBlock` 이 `pass:x,y` 머리 + 행마다 `#`(통행 불가)/`.` 한 글자 그리드를 붙인다(칸당 1자, 행당 1줄). 판정은 `isPassable` — `get_map_region` 의 `passable` 은 `passageMarkForTile(...) !== "x"` 라서 합성 레이어를 무시하는 **다른 출처**다. 함정: `project` 인자가 optional 이라 호출부가 안 넘기면 그리드가 조용히 사라진다. 실측으로 `contextBuilder.ts`·`assistantSession.ts` 두 호출부가 안 넘겨서 기능이 죽어 있었고, 단위 테스트는 인자를 직접 넘기므로 그 누락을 못 봤다. 회귀: `test/aiMapContextPassabilityWiring.test.ts` 가 `buildSystemPrompt` 와 세션 턴 블록 **양쪽**을 고정한다.
  - **회귀를 막는 건 게이트다.** `test/aiEventPlacementSurfaceGate.test.ts` 가 TypeScript 컴파일러 API 로 `src/editor/tools/**`·`src/project/quest/**` 를 AST 스캔해 `.events.push`/`events = [...]`/`events[i] =`, 별칭 push(`const queue = map.events` 와 구조 분해 `const { events: queue } = map` 둘 다), 그리고 래퍼 `upsertEventIntoMap(...)` 호출을 찾고, 같은 함수(중첩 콜백 포함) 또는 그 함수가 부르는 같은 파일 헬퍼에 계약 호출이 없으면 file:line 을 지목하며 실패한다. 허용목록 키는 `file#function` 이라 줄이 이동해도 살아남고, 항목마다 한국어 이유가 필수이며 쓰이지 않는 예외는 stale 로 실패한다. 주석·문자열에 계약 이름만 적어두는 위장은 통과하지 못한다. 변이 증명: `actionTools.ts` 에 무검사 push 를 넣으면 `actionTools.ts:268 (zzProbeUnguardedInsertion, events.push)` 로 RED.
  - 계약 테스트: `test/aiEventPlacementPassability.test.ts`(기존 11건) + 신규 `aiPlacementLighting`·`aiPlacementStoryArc`·`aiPlacementQuestCompiler`·`aiPlacementCopyRegion`·`aiPlacementInvestigationPuzzles`·`aiPlacementStarterMonsters`·`aiPlacementCutsceneCheckpoint`·`aiMapContextPassability`·`aiMapContextPassabilityWiring`·`aiEventPlacementSurfaceGate`.

- **Authored-data capability parity (2026-08-26):** remaining Database/resource/map mutations that the editor already persisted but the assistant could not name now have typed facades: `upsert_life_skill`, `upsert_life_system` (daily weather + farm animal species), `upsert_battle_animation`, `upsert_resource` / `delete_resource`, `register_structure_kit`, and `shift_map`. `get_database_records` accepts `include:"full"` and lists `lifeSkills` / `farmAnimalSpecies` / `crops`. Intent keywords `생활`/`레시피`/`가축`/`날씨` activate `database`; `포획`/`몬스터 시스템` activate `system`; `사냥터` activates `map`. Pins keep the new write tools inside the 40-tool cap. `delete_resource` is destructive. Isolated event-command assist and tileset vision remain specialized generators; authored mutations they need now exist on the shared registry. Contract: `test/aiEditorCapabilityParity.test.ts`.

- **Editor-wide tool discovery and authored-data facades (2026-08-25):** the normal per-round exposure remains bounded by the 40-tool domain selector. `find_tools` is a read-only search tool that is *not* a `CORE_TOOL_NAMES` pin: `AssistantSession` attaches its schema outside the 40-tool window so interior/map pins and fair domain quotas stay intact. It searches the complete active registry by name/description/domain and returns up to six strict schemas. The session may remember at most 16 discovered tools for the current user turn and recomputes schemas on every LLM round; plan-required, quest-persist, and `set_build_spec` schemas are also reserved outside the 40-tool window. Audit rows `tools:escalated ...` and `tools:exposed ...` make the escalation observable. Discovery resets at the next user message and never bypasses registry mode, schema validation, approval classification, or deprecated-tool filtering. Canonical editor-wide mutations include `duplicate_map`, `manage_map_tree`, expanded `set_map_properties`, `duplicate_database_record`, destructive `delete_database_record`, `upsert_database_utility` for elements/terrains/battle commands, and `set_project_settings` for project identity, terms, resolution, system resources, initial party, and battle defaults. Keep broad editor concepts behind typed facades rather than adding one tool per form control. Contracts: `test/aiEditorFullToolCoverage.test.ts`, `test/aiToolDiscoveryEscalation.test.ts`, and `test/aiEditorFullToolSafety.test.ts`.

- **Canvas AI workbench (2026-08-25):** the expert canvas toolbar now exposes four real quick actions through `src/editor/panels/canvasAiWorkbench.ts`: `만들기` arms the existing deterministic build palette and selection tool, `다듬기` sends the current tile selection through the bounded `openRegionTaskModal` preview/apply flow with a constrained polish prompt, `검사` opens `canvasInspectionPanel.ts` over deterministic `projectLint` results with camera focus and bounded AI-repair handoff, and `AI 요청` opens the same region-task composer for the current selection or whole map. The toolbar wiring lives in `editorZoomToolbar.ts`; browser proof is `test/e2e/canvas-ai-workbench.spec.ts`.

- **Antigravity integer enums (2026-09-07):** keep local `type:"integer", enum:[1,2,3]` and sparse `[4,8]` numeric. Google CCA's legacy `parameters` protobuf encodes enum members as strings, not tool arguments. `scripts/lib/ohMyPiToolEnums.ts` retains source paths/membership and runs through `ohMyPiPiAiRuntime.ts`'s SDK **post-normalization `onPayload`** hook: Claude's numeric members are encoded; Gemini's stripped members are restored exactly. Only a fresh legacy payload copy changes. Unsupported numeric enums, lost fields, changed types or incompatible membership fail HTTP400 before fetch; Codex and `parametersJsonSchema` are not encoded. Never fix this by deleting constraints or stringifying local schemas/arguments. Regression: `ohMyPiNumericEnum.bun.test.ts` (full captured 48 tools and live corpus), `ohMyPiToolEnums.bun.test.ts` (real normalization/fail-closed seams), `ohMyPiNumericEnumLocal.test.ts` (shipped normalization and actual house/interior parsers). Earlier browser-aborted planner calls remain a separate unresolved observation, not a reason to change deadlines.

- **Tool JSON schemas must be strict-provider compatible (2026-08-14 실측):** array-typed tool params MUST carry `items`, and union-typed items must not use bare `oneOf` without a `type` — Gemini-backed gateways reject the whole request with 400 `upstream_request_rejected ... properties[yard].items: missing field`, killing every chat turn while OpenAI-style backends accept the same payload. Two such bugs shipped (`build_house_lots` yard items as `oneOf`, `author_house` yard array with no `items`); both fixed in `src/editor/tools/houseLotTools.ts` / `src/editor/tools/authorHouseToolDef.ts`. When adding tool params, run a catalog audit: every `{type:"array"}` node must have `items`, and validate the full exposed tool list through the real gateway (cpen caps `tools` at 128; session exposure cap 40 stays within it).

- **객체 타입 파라미터는 `properties` 를 반드시 선언한다 (2026-08-23 실측):** `{ type: "object" }` 만 적고 실제 필드를 `description` 문자열에만 써 두면 400 은 안 나지만 strict function-calling 경로에서 모델이 그 객체의 필드를 **표현할 방법이 없어 `{}` 만 보낸다.** 실측 턴: `set_work_plan` 이 `layers:[{}]` 8회, `set_build_spec` 이 `assets:[{}]` 10회 연속 → 계획 폐기 → 스펙 게이트가 `fill_region`/`place_npc` 까지 차단 → 31콜 중 21콜 실패. 배열 길이만 1,2,3,6,5 로 바뀌고 내용은 늘 비어 있었다는 게 모델이 아니라 스키마가 벽이라는 증거다. 카탈로그 전역 109개 노드를 고쳤고(재사용 조각은 `src/editor/tools/schemaShapes.ts`: `COORD_SCHEMA`/`RECT_SCHEMA`/`COMMAND_SCHEMA`/`SIMPLE_PAGE_SCHEMA`/`CUTSCENE_BEAT_SCHEMA`/`CONDITION_SCHEMA`/`LIGHT_SOURCE_SCHEMA`/`VILLAGE_*_PLAN_SCHEMA`), 감사는 `test/toolSchemaProviderCompat.test.ts` 가 고정한다. 유니온 shape 은 `oneOf` 금지 → **키 합집합을 전부 선택 필드로**. 진짜 동적 키 맵(`elementRates`, `priceBySeason`, `inventory` 등)만 `additionalProperties: true` 로 명시 면제. 커맨드 `kind` 는 자유 문자열로 두지 말고 `COMMAND_KINDS`/`CONDITION_KINDS` enum 을 노출한다(자유 문자열이면 모델이 없는 kind 를 만들어 보낸다).
- **NPC command contract / repair (2026-09-06):** `COMMAND_SCHEMA.kind` exposes only `COMMAND_KINDS`; `CONDITION_SCHEMA.kind` exposes only `CONDITION_KINDS`. `item` and `selfSwitch` are page conditions, not executable commands. Item grants use `{kind:"changeItem",itemId,op:"+=",amount}`; switch writes use `setSelfSwitch` or `setSwitch`. Command `op` is declared explicitly. Command/condition `value` fields are declared without a single-type restriction so boolean, numeric, and supported variable operands are not falsely advertised as strings. This uses no `oneOf`, `anyOf`, or array-valued provider `type`; `jsonSchema.matchesType` treats an omitted type as unconstrained, while the existing command/condition shape validators remain responsible for variant validity. Existing internal type-array consumers remain supported. Rejected `item`/`changeItems`/`gainItem` commands return an `invalid-args` issue containing a standalone `repair: <JSON>` line with `{path,example}`. The example uses canonical `changeItem`, preserves a supplied string item ID and finite numeric amount (otherwise lookup placeholder / amount 1), and is guidance only: none of these names becomes an alias. Read the full issue message, not the 200-character summary. Replace only the command at `path` and use an ID obtained from `get_database_records`; do not remove the grant to make the call succeed. `test/npcCommandContract.test.ts` parses the repair JSON, checks schema/compiler/shape acceptance, and retries through the real `place_npc` runner. Evidence: `.omo/evidence/assistant-tool-reliability/schema`. Live Gemini acceptance is not established by the local provider-compatibility audit.
  - Audit NPC repairs (entries 170/174/196): the real runner keeps missing `pages` invalid. Only an otherwise recognized `place_npc` call with a sole nonempty `dialogue.text` receives `{path:"pages",example:[{lines:[originalText]}]}`; the hint distinguishes dialogue NPCs from object gimmicks. The optional `ToolDefinition.invalidArgsRepair` callback supplies input-specific schema-error guidance without running or mutating the project. Missing-kind `{commandId,fields:{lines}}` for Show Text (`m2-001-show-text`, or the audited invalid `m2-101-show-text`) remains rejected and suggests native `{kind:"text",body:lines.join("\n")}`. This is not an M2 ID alias, and no other ID or extra/conflicting field is guessed away. Sole `{selfSwitch:"A"}` condition shorthand receives canonical `{kind:"selfSwitch",key:"A",value:true}`; explicit boolean false/true is retained (the same omitted-value default as `make_villager.dialogue.when`). Singleton corrections target the actual `pages[i].conditions` field with an array; array corrections target only `pages[i].conditions[j]`, preserving siblings. Extra or malformed conditions get no lossy repair, including `kind:"none"` with additional fields (only bare `{kind:"none"}` still normalizes away). Apply the parsed `example` at `path`, retain other pages and dialogue, and retry through the runner. No story text is invented and canonical pages/condition arrays are unchanged. Focused contract: `test/npcAuditRepair.test.ts`; RED/GREEN and correction evidence: `.omo/evidence/assistant-audit-pr/npc/`.
- **`kind` 로 허용 키가 갈리는 툴은 스키마가 아니라 파서에서 정규화한다.** `oneOf` 를 못 쓰므로 모델은 두 모드 키를 섞어 보낸다 — 실측: `author_house` 에 `kind:"lots"` + 최상위 `kitId/wings` 를 한 턴에 33회 연속 전송. 에러 문구에 허용 키 전체를 실어도(`rejectUnknownKeys` 개선) 같은 턴에서 교정되지 않았다. `parseAuthorHouseRequest` 의 `normalizeRequestShape` 가 shape 로 모드를 추론하고 단일 모드 키를 `houses[0]` 로 접는다 — 같은 파일의 wings 클램프·`windows:true` 보정과 동일 방침. 실측 결과 33회 실패 → 성공 1회.
- **동료 저작 전용 툴 (`src/editor/tools/companionTools.ts`).** `add_companion` 은 `target.eventId` 면 그 이벤트의 **마지막 페이지**(RM 계열은 조건을 만족하는 마지막 페이지가 실행된다 — 첫 페이지에 넣으면 조건 가드용 빈 페이지에 박힌다)에 `addFollower` 를 붙이고, `target.mapId/x/y` 면 이벤트를 만든다(`trigger:"talk"` = 말 걸어 합류 + `setSelfSwitch A` 로 사라짐, `"autorun"` = `{kind:"auto"}` + 스위치 가드로 1회). `who` 는 `{actorId}` / `{query}` / `{textureKey, characterIndex}` 이고 그래픽은 항상 `charsetFollowerGraphic` 을 거친다. `configure_companion_rules` 는 `system.companions`(대형·간격·인원 상한·초과 정책·맵 이동 시 해제)를 쓰며 `domains: ["system"]` 로 선언해 event 도메인 자리를 잡아먹지 않는다. 동료는 DB 레코드가 아니라 세션 상태이므로 `DB_TOOLS`/database 도메인에는 넣지 않는다. 노출 경로 확보를 위해 `assistantToolMode` event 의도 키워드에 `동료/동행/펫/따라오/따라다니/companion/follower/pet` 을 추가했다 — 키워드가 없으면 40툴 트림에서 잘려 모델이 "그 기능이 없다"고 오보한다.
- **노출되지 않은 툴은 모델에게 "없는 기능"이다 (2026-08-23 실측).** "상성표/엔딩 조건" 요청에서 `set_type_chart`·`define_ending`·`get_database_records`·`script_cutscene` 가 도메인 스코핑·40툴 상한에 밀려 노출되지 않았고, 모델은 사용자에게 **"그 기능이 없습니다"** 라고 보고하며 작업 3건을 skip 했다. 툴콜 실패보다 나쁘다 — 사용자가 제품 한계로 오해한다. 수정: 참조 id 조회(`get_database_records`)를 `CORE_TOOL_NAMES` 로 승격(모든 쓰기의 전제), 의도 키워드에 `상성/상성표/속성`(battle+database) · `엔딩/ending/결말`(event+quest) · `컷신/cutscene/연출/선택지`(event) 추가, `PINNED_TOOLS_BY_DOMAIN` 에 `set_type_chart`/`define_ending`/`list_endings`/`script_cutscene(_preset)` 핀. **핀은 `tool.domains` 기준이다** — 엔딩 툴은 `withDomain(ENDING_TOOLS,"event")` 이므로 quest 에 핀해도 효과가 없다. 회귀 고정: `test/aiEndingToolExposure.test.ts`. 매 턴 노출 목록은 `tools:exposed <n> — <names>` 감사 라인으로 확인한다.
- **도메인 핀 맵에는 같은 키를 두 번 선언하지 않는다 (2026-08-24 실측).** `new Map([...])` 의 `system` 항목이 앞에서 `reset_project`/`configure_time_system`, 뒤에서 `evaluate_game_quality` 로 두 번 선언되어 뒤 항목이 앞 세트를 통째로 덮었다. 단일 도메인 요청에서는 우연히 시간 툴이 40개 안에 들지만, 길+NPC+상자+시간 복합 턴에서는 밀려 모델이 "시간 시스템 활성화 기능이 없다"고 오보했다. 시스템 핀은 한 `Set` 에 세 툴을 함께 둔다. 회귀 고정: `test/toolDomainScoping.test.ts`의 복합 요청 노출 계약.
- **플래너 응답이 잘리면 무관한 폴백 템플릿으로 갈아탄다 (2026-08-23 실측).** 6개 산출물 요청에서 플래너 JSON 이 출력 한도로 끊겨 `parseOrchestratorDecision` 이 `null` 을 돌려주자, 세션이 `buildDefaultWorkPlan` 의 장르 템플릿(moon-cutscene 1항목)으로 대체했고 모델이 "던전·적·물약·상성표·선택지는 추가되지 않았습니다"라고 말하면서도 턴은 성공으로 끝났다. 수정: 파서가 실패 **사유**를 반환하고(`OrchestratorParseResult`), 잘린 JSON 은 괄호를 닫아 도착한 layer 만이라도 복구하며, 폴백 진입 시 사용자에게 상태 메시지로 알린다. 플래너 프롬프트에 간결성(goal/instruction ≤200자)과 "모든 산출물은 항목으로 표현" 규칙을 넣었다.
- **완료 게이트는 읽기 툴도 세고, 없는 툴은 successTools 에서 버린다.** `successTools:["get_map_region"]`(읽기) 이나 `["configure_element_table"]`(존재하지 않음) 같은 항목은 쓰기만 세던 게이트에서 **영구 미완료**가 되어 skip 밖에 답이 없었다. `turnSuccessfulTools`(읽기 포함)로 판정하고, `sanitizeToolNames` 가 레지스트리에 없는 이름을 제거한다. `get_work_plan` 은 계획이 없어도 `ok:true`("활성 WorkPlan 없음") — 정상 상태를 실패로 세지 않는다.
- **거부 메시지는 유효값을 실어야 한다.** `speciesId does not exist.` / `elementRates key does not exist` / `알 수 없는 trigger.` 처럼 무엇이 유효한지 알려주지 않으면 모델이 같은 인자를 반복 전송하거나 "기능이 없다"며 포기한다. 이제 유효 id 표본(최대 12개)·허용 trigger 목록·허용 키 목록을 함께 반환한다(`references.ts` `knownIdsHint`, `shapeReferenceFields.ts` `TRIGGER_KINDS`, `boundary.ts` `rejectUnknownKeys`). `define_ending` 은 없는 스위치/변수를 거부하지 않고 `ensureNamed*` 로 만든다(엔딩 조건은 "앞으로 켜질" 플래그를 가리키므로 존재 검사가 순서 교착을 만든다).
- **린트·커밋 경로는 불완전한 저작 데이터에서 throw 하면 안 된다.** 모델이 이벤트 레벨 trigger 만 주고 페이지에는 `conditions/commands` 만 담아 `upsert_event` 를 호출하면 `projectLint` 의 `isSteppableTouch` 가 `page.trigger.kind` 를 읽다 TypeError → 커밋이 "후처리 실패: Cannot read properties of undefined" 로 끝나 원인이 가려졌다(3회 재전송). `fillRequiredPageFields` 가 `id/name/conditions/graphic/trigger/priority/movement` 를 보완하고(경고 표시), 린트 헬퍼는 `trigger?: undefined` 를 허용한다. 회귀 고정: `test/eventPageRequiredFields.test.ts`.
- **기존 이벤트 저수준 수정은 top-level patch 계약이다 (2026-08-24 실측).** `upsert_event` 가 입력 객체로 기존 레코드를 통째로 교체하면 스케줄을 붙이는 후속 턴이 NPC의 `pages`/그래픽/`characterId` 를 지우고, `place_chest` 뒤의 위치 보정이 50G 보상과 셀프스위치 페이지를 지울 수 있다. 기존 id에는 입력에 실제 포함한 최상위 키만 덮고 생략한 좌표·트리거·커맨드·페이지·인물 키는 보존한다. 새 id일 때만 `x/y` 가 필수다. `make_villager` 는 같은 맵의 정확한 event id 또는 `characterId` 를 우선 재사용하며, 스케줄-only 재호출은 기존 위치와 대사 페이지를 보존한다. 스케줄만 바꿀 때는 여전히 `set_npc_schedule` 이 우선 경로다. 회귀 고정: `test/toolsMapManagement.test.ts`, `test/stardewAuthoringTools.test.ts`.
- **부분 수용이 전체 거부보다 낫다 (2026-08-23 실측).** `elementRates:{fire:"C",water:"A",grass:"D"}` 에서 `grass` 만 DB 속성이 아니었는데 커밋 전체가 거부되고, 모델의 재시도는 `elementRates` 를 아예 빼버려 "불에 강하고 물에 약한" 의도가 조용히 사라졌다(전 속성 기본 C). `dropUnknownElementRates`(dbTools)가 무효 키만 버리고 유효 등급은 살린 뒤 사용 가능한 속성 id 와 함께 경고한다 — `fill_region` 이 보호 셀만 건너뛰는 방침과 같다. 회귀: `test/elementRatesPartialAccept.test.ts`. **`enemy.elementRates`(= `database.elements` id)와 `set_type_chart.types`(= `monsterSpecies.types`)는 다른 네임스페이스다** — 모델이 자주 혼동하므로 툴 description 에 명시했다.
- **실내 방 세션이 시작 맵을 교체하면 시작 좌표가 벽이 된다 (2026-08-23 실측).** `createEmptyRoomMap` 이 전면 VOID 였기 때문에 `start_interior_room_session` 직후 커밋이 `시작 위치가 통행 불가 타일입니다: (10, 8)` 로 거부됐고, 원인이 자기 인자가 아닌 줄 모르는 모델이 좌표만 바꿔 4회 재시도했다. 이제 계획된 바닥 footprint(rooms/wings)를 기본 바닥 타일로 선칠하고(바닥 레이어가 뒤에서 정식 재칠 — 최종 결과 불변), `reconcilePlayerStart`(roomHarness/engine)가 시작 좌표를 방 안 통행 가능 칸으로 옮기며 경고한다. 시작이 곧 실내인 게임(침실에서 깨어나기)을 막지 않기 위해 거부가 아니라 보정을 택했다.
- **`upsert_enemy` 는 이 호출이 새로 가리키는 참조를 먼저 검사하고, 커밋 거부 요약은 첫 사유를 싣는다 (2026-09-03).** DB AI 바 턴 실측: 모델이 조회 없이 `actions[].skillId: "skill_0001"` · `rewards.dropItemId: "item_0001"` 자리표시 id 를 넣자 일반 무결성 게이트(`commitChangeset` → reference-validation)가 쓰기 전체를 `'upsert_enemy' 커밋 거부(무결성 오류)` **한 줄로** 반려했다 — 함께 보낸 스탯·보상까지 버려지고 사유는 `issues` 에만 있어 모델·사용자 모두 이유를 못 봤다. 수정 둘: (1) `rejectUnknownEnemyReferences`(`dbTools.ts`)가 `skillIds`/`actions[].skillId`/`rewards.dropItemId`/`actions[].switch*AfterAction.switchId` 중 **이 호출의 args 가 넘긴 것만** 검사해 `enemy-reference-not-found` 로 위반 목록(먼저) + 허용 예시 5개 + `get_database_records` 안내(뒤)를 돌려준다(`upsert_troop` enemyIds · `define_monster_species` skillId 와 같은 패턴). 기존 레코드의 선재 깨진 참조는 보지 않는다 — 커밋 게이트가 기준선으로 용인하는 오류라 스탯 한 줄 고치기를 막으면 안 된다. (2) `toolRunner.commitRejectionSummary` 가 `'<tool>' 커밋 거부(무결성 오류) — <첫 위반 메시지> (+N건)` 을 만든다(접두어 유지 — 기존 `toContain("커밋 거부")` 계약). `activityLog.deriveAiActivityDiagnostics` 는 요약에 이미 든 이슈를 다시 붙이지 않는다. 회귀 고정: `test/dbToolsIntegrity.test.ts`(세 참조 거부·선재 오류 무시·정상 참조 통과·일반 게이트 요약).
- **NPC·몬스터는 이미지 없이 생산되지 않는다 (2026-08-30).** 모델은 `upsert_enemy` / `define_monster_species` 에서 `monsterResourceId` 를 상습적으로 생략했고, 통과된 레코드는 전투에서 `skinEnemySpriteUrl()` 공용 스프라이트로 대체되어 **모든 적이 같은 모습**이 됐다(`src/player/battleFieldDom.ts:547`). 원인은 둘이다: (1) 생략이 그대로 통과했고, (2) 리소스 id 는 전부 영어 어간이어서 `searchResources("monster","슬라임")` 가 0건 — 한국어로 넣으면 `invalid-args` 로 튕기니 모델은 필드를 아예 부치지 않는 것을 학습한다. 수정: `src/assets/monsterResourceSemantics.ts` 가 한국어 ↔ 어간 색인(종류·속성·재질·역할)을 들고 `monsterCandidates()` 태그에 주입되어 "해골 궁수" → `generated-enemy-skeleton-archer` 로 해석되고, `assignMonsterResourceId`(`src/editor/tools/monsterGraphicAssignment.ts`)가 생략 시 **정규화한 정확한 정체성 또는 모든 검색 낱말이 라벨/태그에 정확히 일치하는 경우에만** 이름으로 붙이고 경고한다. **2026-09-06: 해시 폴백을 제거했다.** `enemy_leaf_fox` / `풀잎여우`가 검색 0건 뒤 해골로 저장되던 결함이다. 부분 문자열·일부 낱말·`*`/`all`/`전체`·일반 카테고리만으로는 자동 지정하지 않는다. 넓은 `searchResources`는 조회용으로 유지한다. 세 쓰기 경로는 공용 `ensureMonsterGraphic`을 거쳐, 확실한 외형이 없으면 `monster-graphic-required`로 원자적으로 거부하고 `list_resources(kind:"monster", query:"*")` 조회 후 명시 ID를 넣도록 안내한다. 명시한 미등록 값/불확실한 검색어는 `invalid-args`이며, 확실한 검색어는 계속 해석한다. 등록된 명시 ID·기존 ID는 덮지 않고, `transparent:true`는 이미지 생략을 허용한다. 종족 `graphic` 부분 변경은 기존 ID와 투명 상태를 보존한다. `make_action_enemy`는 선택 `monsterResourceId`/`transparent` 인자를 받아 오류에서 복구할 수 있고 기존 적 수정에도 같은 검사를 적용한다. 회귀: `test/monsterGraphicReliability.test.ts`의 실제 `runTool` 생성·수정·거부 후 무변경 계약. 이 보장은 `make_action_enemy` 생성 경로에도 적용되어 이후 `make_hunting_ground` 필드 스폰이 같은 몬스터 외형을 쓰며, `place_battle_blocker` / `make_chase_scene` 는 그래픽 생략 시 `query:"monster"` charset 과 경고를 낸다. `add_companion` 의 actor 경로는 액터 `characterResourceId` 를 `charsetFollowerGraphic` 으로 해석하고, 값이 없으면 NPC 페이지와 같은 `resolveGraphicQuery("villager")` 주민 charset으로 폴백하므로 인간 동료가 몬스터 열차 charset으로 보이지 않는다. 같은 이유로 `upsert_event` 는 **대화가 있는 `action` 페이지가 그래픽 없이** 잡힐 때 먼저 그래픽이 있는 sibling page의 charset을 재사용하고, sibling이 없을 때만 주민 charset을 붙인다 — 셀프스위치 전환으로 NPC 정체성이 바뀌지 않는다. 말을 걸어야 하는데 안 보이는 이벤트는 플레이어가 찾을 수 없으므로 의도된 저작이 아니다. `priority:"below"`인 바닥 조사 마커는 보완하지 않으며, 투명 이벤트의 명시 경로는 `graphic:{transparent:true}` 이고 `auto`/`parallel` 컷신 이벤트도 그대로 둔다. 회귀 고정: `test/aiGraphicAutofill.test.ts`.
- **적대적 인자 스윕은 상시 게이트다.** `test/toolHostileArgs.test.ts` 가 전 쓰기 툴(100+)에 `empty`/`nulls`/`wrongTypes`/`deepHoles` 4종 인자를 먹이고, **거부는 허용하되 크래시·`후처리 실패`·`Cannot read properties` 는 금지**한다. 계약은 성공이 아니라 읽을 수 있는 실패다 — 모델이 고칠 수 없는 메시지는 그 자체로 버그다.

- **Soft-confirm (목록 확인) replaces hard unapproved-vocabulary blocks for construction.** `resolveVocabForBuild` in `src/project/tileVocabulary.ts` returns `approved | soft | missing`. Existing groups/tiles soft-allow and paint the map with `data.vocabSoftConfirm`; only missing ids hard-fail. Soft construction proposals set `requiresApproval` and show **cropped** map before/after thumbs (change bbox) plus 상세 재료·배치를 확인할 수 있는 UI; accept (`그대로 적용`) runs `applyVocabSoftConfirmApprovals` so `origin:user` is marked only on explicit accept (autoApprove still blocked). Card-level material warnings skip the second `confirmRuleApproval` modal. `place_props` identical args are deduped once per turn (`writeDedupeKey`). Login modal z-index stays below the proposal modal; proposal open forces guest identity if needed. Region AI (`runRegionTask`) shows no chat proposal card, but its default apply gate is `"approval"` (`runRegionTask.ts:831`) — the change lands only through the `pendingRegionApply` review modal (approve/discard); it auto-applies only via the legacy `gate:"immediate"` path (:850). Region runs also cap the session at `REGION_TASK_MAX_TOOL_CALLS = 24` tool calls (`runRegionTask.ts:50,:222`), and still mark soft vocab on apply and seed harness groups.
- AI activity/conversation persistence is not best-effort when Supabase is configured. Missing dedicated tables must surface `SupabaseMigrationRequiredError`; apply and verify schema with `npm run db:migrate` / `npm run db:verify-ai`. Historical `ai_analysis_runs` fallback rows remain readable, but new activity logs only write `ai_activity_logs`, and remote log diagnostics are always scoped to the configured project id.
- Tile v3 includes `fill_region` in `src/editor/tools/v3/constructionTools.ts` for water/floor/ground surface fills with autotile or animated-terrain groups (soft-confirm when not yet origin:user). Use `fill_region` for lakes, rivers, floors, and terrain areas; keep `place_props` for scattered objects such as trees, rocks, and flowers. `build_wall` requires a supported expandable pattern with defined parts; fixed fence props without that pattern use `place_props`, not `build_wall` or `fill_region`. `fill_region` and `tile_erase` skip only protected start/transfer-destination cells that would become impassable and return a warning for the skipped coordinates instead of rejecting the whole edit.
- **Erase restoration ground (2026-09-07):** `tile_erase(kind:"all")` ranks only observed compatible lower ground, outside the rectangle first and inside second (row-major ties). Tileset role/group semantics, authored tile-role and layer overrides, metadata passage, and runtime passability must agree; floor/terrain/ground/path can qualify, not walls, roofs, props, water, upper homes, or blocked tiles. An explicit authored ground role can supersede inherited group vocabulary, but cannot bypass runtime layer/passage or completed-house protection. No candidate means `erase-ground-unresolved` before either layer changes, not a grass fallback or a fabricated atlas tile. Inspect the selected tileset and explicitly paint a valid ground surface before retrying. `layer:"upper"` needs no ground and reports `groundTile:null`; start/transfer support and transaction ownership guards still apply. `kind:"market"` retains its separate selective demolition contract. Regressions: `test/tileEraseGround.test.ts` (fresh 12x10 border, captured wall distribution, real crate placement on town222/240 and interior72, authored rules, atomic failure, ownership), plus `test/constructionToolsV3.test.ts` (upper-support passage protection and market behavior).
- Live MCP bridge for external agents: `src/editor/aiAssistantBridge.ts` registers from `aiChatPanel` and long-polls `http://127.0.0.1:17831` (see `npm run mcp:assistant` / `scripts/rpgzzu-assistant-mcp.mjs`). Same chat session as the UI; tools are `assistant_send` / `status` / `audit` / `harness` / `abort`. Dev auto-connects; `?aiBridge=0` disables. `agy mcp add rpgzzu-assistant node scripts/rpgzzu-assistant-mcp.mjs` registers the bridge in AGY. AGY 1.1.x uses newline-delimited stdio JSON-RPC while older repo clients use `Content-Length`; `scripts/lib/mcpStdioFraming.mjs` detects the first inbound frame and replies in the same format. Keep both paths covered by `test/mcpStdioFraming.node.test.mjs`; a mere `agy mcp list` is not a health check—verify `assistant_ping` and `assistant_status` against an open editor.
- **상점 저작은 모든 활성 페이지에서 런타임이 열려야 한다 (2026-08-24 실측):** 런타임 `resolveEventPage`는 조건이 맞는 마지막 페이지를 선택한다. `make_villager`가 첫 페이지에만 `shop`을 넣고 뒤의 무조건 대사 페이지를 남기면 DB에는 상점 명령이 있어도 플레이에서는 상점이 열리지 않는다. `make_villager`와 `set_shop_stock`은 이제 이벤트의 모든 페이지에 동일 재고의 `shop` 명령을 추가/갱신한다. `runSceneTest(... expect.shopStock)`로 활성 페이지를 검증한다.
- **상점 의도와 명시 툴은 노출 상한 밖에서도 보존한다 (2026-08-24 실측):** `상점`/`상인`/`재고` 및 `shop`/`merchant`/`stock`은 event 도메인을 연다. `set_shop_stock`은 event 대표 pinned tool이다. 사용자가 `get_event`처럼 정확한 레지스트리 이름을 프롬프트에 썼다면 `mentionedToolSchemas`가 40-tool 도메인 trimming 뒤 다시 합쳐 준다. 그렇지 않으면 타일 UI + 복합 보존 문구가 핀을 채워, 모델이 실제로 존재하는 조회 툴을 “없다”고 오보하고 work item을 skip할 수 있다.
- **길 존재 판정은 autotile 패밀리 전체를 본다 (2026-08-24):** `aiAgentBrief.mapHasPath`와 원격 검증기는 단일 `TILE.PATH` id만 비교하지 않고 `isRoadTile`을 쓴다. 실제 dirt-road edge/corner id(예: 390/391/392/420/450)만 있는 맵을 “길 없음”으로 안내하면 안 된다.
- The AI chat panel owns user-visible turn controls and wires sibling modules: `src/editor/panels/aiChatPanel.ts` (turn pipeline, selection task, chrome/layout assembly), `aiChatPanelHelpers.ts` (pure helpers/audit export), `aiSettingsModal.ts` + `aiAuthSettings.ts` (config/auth surface), `aiProposalCard.ts` (proposal card + accept/reject/fusion), `aiConversationLog.ts` (bubbles/reasoning/tool activity/tile visuals), plus thinner shells `aiProposalSummary.ts` / `aiChatRenderers.ts` / `aiProposalFusion.ts`. (`aiCommandBar.ts` 는 커버이서 재구축으로, `aiProposalModal.ts` 는 승인 게이트 폐지로 삭제된 파일이다 — 찾지 마라.) Public test imports stay on `aiChatPanel` via re-export. Readiness is auth-mode-aware: ChatGPT mode requires a model and a reachable companion/login, while API-key mode preflights endpoint + key. The panel opens settings with focus, restores the latest same-project conversation asynchronously from IndexedDB `oprn-ai-records` (`src/ai/aiRecordDb.ts`; the old `oprn:ai-conversations` localStorage key is migrated on first access — see `editor-ai-panel.md` 「대화 기록의 로컬 정본은 IndexedDB 다」), shows elapsed time plus a visible tool counter during running turns, and wires the visible abort button to `AssistantSession`/`llmClient` AbortSignal. Keep browser UI in the panel layer; `src/ai/assistantSession.ts` should remain browser-independent and only accept the optional signal.
- **AI visual polish (?쒖븞 6):** start cards use fixed 16px icons + uniform 48px row height and 2/3-column grids; start screen stays top-aligned (no vertical center abyss). Header has a thin accent gradient bar. Status badge uses `data-status-tone` (`idle`/`running`/`review`/`error`/`ok`) via `statusToneOf` ??same token colors as the collapsed FAB rail dots. Full history groups prior turns into collapsible `.ai-turn-group` with day dividers (`.ai-day-divider`); mini-stream still hides `.is-prior-turn`. Styles live mainly in `tabs-b-assistant-panel.css`; tests: `test/aiVisualPolish.test.ts`.
- **AI shared surface + dock modes:** Basic/expert editor chrome must not fork the AI panel. Start screen is the minimal empty-hint surface (`ai-start-screen` + `ai-start-empty-hint`, optional ?댁뼱媛湲? in both modes; there is no `ai-expert-board`. Chat layout is **side** (default full-height right column, accent border, header ?쒖궗?대뱶??chip) vs **float** (map-over command capsule, ?쒗뵆濡쒗똿??chip + ?쒗뵆濡쒗똿 諛?쨌 留????낅젰??label). Visible dock mode buttons: `ai-dock-mode-btn` / `ai-dock-mode-btn-header`; menu copy: ?쒗뵆濡쒗똿 바로 ?꾪솚??/ ?쒖궗?대뱶 ?⑤꼸濡?고정?? Tests: `test/aiSharedSurface.test.ts`.
- **툴콜 응답 파싱은 프로토콜 계약의 일부다 (2026-08-30):** 툴 실패로 보이던 신고 중 상당수는 공급자 응답 파싱 결함이었다 — `index` 없는 스트리밍 delta 가 병렬 툴콜을 한 호출로 이어붙이고, id 없는 응답이 중복/빈 `tool_call_id` 를 만들고, 잘린 인자 JSON 이 `필수 인자 누락` 으로 위장됐다. 세부·회귀는 `openwiki/editor-ai-panel.md` 의 «툴콜 프로토콜은 경계에서 보정한다» 항목과 `test/aiToolCallProtocol.test.ts` / `test/aiToolCallSessionProtocol.test.ts` 를 보라. 툴 스키마 계약(array items·oneOf 금지)과 달리 이 계층은 **모델이 아니라 전송/파싱**의 문제이므로, 툴 실패를 조사할 때 스키마보다 먼저 여기를 확인한다.
- AI chat streaming retry is split by layer: `src/ai/llmClient.ts` normalizes stream reader disconnects and early SSE termination into retryable `LlmError`s, while `src/ai/assistantSession.ts` owns LLM-round retries, disables the client's internal retry for those calls, clears partial stream UI with `assistant_stream_reset`, and emits Korean retry status text. User AbortSignal cancellation must still return `aborted` without retry.
- Failed tool rows in `src/editor/panels/aiChatRenderers.ts` must expose the real `ToolResult.summary` plus the first issue message before appending the internal retry count; do not mask actionable errors behind a retry-only label.
- Main chat model orchestration is owned by `src/ai/assistantSession.ts`, with UI status display in `src/editor/panels/aiChatPanel.ts`. Orchestration is enabled when `agentMode === "auto"` (planner always on, single model or not) or when `liteModel` differs from `model` (`orchestrationEnabled()`, assistantSession.ts:1508); only `chat` mode keeps the pure legacy `model !== liteModel` test. When active, `sendUserMessage` emits `phase` events for `plan`/`execute`/`review`: plan and review use the supervisor `model`, write-tool execution uses `configForLiteModel`, and review may send one `?ъ떎??` repair pass back to execution before final response. Phase-control prompts are transient `role:"user"` messages prefixed `[?ㅼ??ㅽ듃?덉씠??` and are removed from `messages` at turn end; review calls omit tools and `tool_choice`. If orchestration is active, `requestLikelyExpectsChange()` is true, no write tool was attempted, and the assistant is about to end with non-question text, `AssistantSession` injects one transient `[?ㅼ??ㅽ듃?덉씠?? ?ъ슜?먮뒗 蹂경을 湲곕??⑸땲??..` user message to re-kick planning; the second zero-change ending is allowed to finish. Assistant final text must suppress raw provider tool-call markup such as `<tool_call>`/`<invoke name=` and route review-time markup corruption through the one repair pass. The status ticker should fuse the phase label into elapsed/tool progress, e.g. "계획 以?m3) ??12珥?쨌 ?꾧뎄 3/200". `runRegionTask` creates sessions with an already-lite config and should remain a lite-only path. `configForLiteModel` (`src/ai/llmClient.ts`) falls back to `config.model` (supervisor) when `liteModel` is unset — this unifies region-task execution across authModes (ChatGPT OAuth routes via `/v1` codex proxy; apiKey routes via `config.baseUrl`). `loadAiConfig()` fills a missing `liteModel` with the stored `model`, not `DEFAULT_LITE_MODEL`, so changing the supervisor model alone propagates to region-task execution without a separate liteModel setting. Explicit `liteModel` is still respected when set.
- Assistant skills were removed (2026-08-27): there is no slash skill list, skill drawer, or skill pin bar. The chat header stays light (title, status/abort, font/settings/dock, collapse) and the composer takes free text only. Do not reintroduce skill surfaces or always-visible header mode badges.
- AI tool reachability is scoped by active domain union, not a single mode. `src/editor/assistantToolMode.ts` computes `core + uiDomain + deterministic intent keywords + recent successful tool domains`, with recent domains kept by a short TTL and reset by explicit task-switch wording. Tile intent keywords include placement words such as `?섎Т`/`?뚰뭹`/`吏?/`嫄대Ъ` so region construction stays on the tile domain. `src/editor/tools/toolRegistry.ts` accepts `{ domains }`, keeps deprecated tools hidden, caps exposed tools at 40 (`MAX_EXPOSED_TOOLS`, `toolRegistry.ts:219`) by domain priority, and preserves all database tools once the database domain is active.
- Tool exposure caps (default 40) drop only weak/recent domains wholesale; strong tile+event intent stays and is trimmed with pinned write tools (`place_props`, `place_npc`, `author_house`, `start_interior_room_session`, `run_interior_room_pipeline`, `advance_interior_room_build`, `evaluate_interior_room`, ??.
- Region AI (`src/editor/regionTask/runRegionTask.ts`) may still seed build-palette harness groups; soft-confirm means existing tree/prop group ids work without prior origin:user. Prompt lists available group ids. `place_npc`/`make_villager` default graphic to villager when omitted. Each run builds a `RegionTaskLogExport` (audit + toolCalls + uiEvents + harness) on `result.log`, publishes `window.__rpgzzuRegionTaskLog` / `__rpgzzuLastRegionTaskLog()`, and the region modal header has a small **로그** button (`region-task-copy-log`) next to ?뚯쁺???묒뾽??that copies the JSON to the clipboard after a run.
- AI tool argument normalization is centralized in `src/editor/tools/jsonSchema.ts` before schema validation. It accepts common coordinate shape drift by flattening `{rect|region|area|bounds|at|pos|point:{x,y,w,h}}` into flat `x/y/w/h` tools, wrapping flat `x/y[/w/h]` into the single coordinate object required by v3 tools, and mapping `width/height` aliases to `w/h` (and back) based only on the declared schema.
- **Reachability coordinate boundary (2026-09-07):** `check_reachability` in `queryTools.ts` applies the existing `validateArgs(COORD_SCHEMA, point)` to `from` and every `targets[i]` before BFS. The shared runner validates only outer object/array types; missing, fractional, nonfinite, or structurally invalid coordinate fields must return `ok:false` / `invalid-args` with no reachability data, not `ok:true, reachable:false`. Existing schema normalization (including numeric strings and coordinate wrappers), extra point metadata, and empty target arrays remain supported. Valid queries still return real reachable/unreachable verdicts with adjacent-or-on semantics. `test/reachabilityArguments.test.ts` covers recorded wire114, nested object/array countercases, real `runTool` -> `ToolVerificationEvidence` retry history, and genuine negative evidence surviving another passing query. This is a local query-boundary fix, not recursive validation for other tools (including `run_lint` specs), verification ownership/canonicalization repair, or retroactive reclassification of an old session ledger.
- W5 team workflow UI shows current editor identity in the topbar, can reopen the mock login modal, and reads recent `project_commits` through `listProjectCommitsFromSupabase`. The mock login only updates the local editor owner label and last-login-method localStorage marker; real Auth/RLS session handling belongs to the Phase 8 switchover.
- For quick navigation, grep within `src/editor` first, then follow the feature-specific file groups above: map, event, database, resource, tile palette, save/import/export.



- Room harness automation may use the low-level typed `src/editor/roomHarness/facade.ts` API for deterministic start/advance/evaluate, lock, and room-only reroll operations. The user-facing quota-independent route is `src/editor/regionTask/runDirectRoomDraft.ts`, exposed by the region modal as **AI 없이 실내 초안** with structural presets and composable modifiers. It selects a world-reachable doorway, connects both transfer directions, and enters the same `pendingRegionApply` review/approval surface as AI work; LLM tool wrappers remain compatible but are not the only route to harness behavior.
- Tileset knowledge analysis uses `requestCpenTilesetMapping` as a real multimodal OpenAI-compatible request: the user message contains a JSON task plus an `image_url` data URL for the rendered full atlas. `tilesetAiNativeAnalysis.ts` validates proposal tile ranges and executable template geometry before any review card is shown. The review/apply boundary is `tilesetAiNativeReviewApply.ts`; do not move `store.update` into Analyze or card rendering. High-confidence means `>=0.85`, uncertain means `>=0.5`, and lower results always require an explicit per-card decision.
- The tileset client follows the shared AI proxy-auth contract: relative `baseUrl` values are same-origin server-authenticated routes, require no browser API key, and must not receive an `Authorization` header. Absolute provider URLs still require the configured key. Review apply rejects overlapping lower-confidence candidates after deterministic confidence/id sorting.
- `author_village` preserves unsupported landmark intent truthfully at the existing theme→decor seam: normalized themes containing `fountain` or `분수` place the supported combined_town well tile `382` at the plaza and return a visible construction warning that the fountain asset is unavailable and the well was substituted. Ordinary themes retain the default single-well behavior without this warning; no fountain tile or asset-generation capability is implied.
- `author_village` pipeline ends with a placement-conflict scrub (`scrubPlacementConflicts` in `src/project/lint/layoutPlacementValidate.ts`, called from `village/builder.ts` after landscape): later stages (decor scatter, waterway/lake carving) can paint water or walls under tree canopies already in `upperTiles`, which the approval gate (`validateLayoutPlacement`) correctly rejects as `layout-prop-on-water` / `layout-tree-on-impassable`. The scrub removes exactly those upper cells with the same rule set as the gate, so a fresh `author_village` village passes first-accept without AI fix turns (verified: luna run17, T1 accepted on attempt 1).
- `build_village` 간선은 4갈래 중 1갈래가 광장이 아니라 인접 축 간선에 T자로 붙는다 (2026-09-04): 예전엔 4갈래가 전부 광장 rect 변에 닿아 매번 같은 plus 위상(= 십자가로 보임)이 반복됐다. `villageArteryRoutes` 가 시드별 분기 갈래를 돌리고(4-cycle, [N,S,W,E]에서 +2라 정반대 축이 아님), N/S 앵커는 가장자리 1/5 폭으로 흩어 일직선 세로축을 깬다. 앵커·분기 갈래는 원본 시드에 묶고 흔들림만 재시도 시드에 맡겨 layoutPlan.roadAnchors와 exitRoads 게이트가 어긋나지 않는다. 4변 출구는 유지되므로 `exitRoads=4` 게이트는 그대로 통과한다. Tests: `test/villageCrossRoad.test.ts`.
- `build_village`는 집을 찍기 전에 스케치 프리패스를 먼저 돌린다 (2026-09-04): `build_village`가 `buildHouses` 전에 `sketchHouseSites`를 뽑고, 스케치 후보를 분수 슬롯·격자보다 먼저 시도한다. 사이트 간격은 8폭+마진(10). 격자는 폴백이다. `villageArteryRoutes`는 다리당 내부 경유점 하나를 더 넣되 `host[1]` T-join과 4변 출구는 그대로 둔다. Tests: `test/villageSketch.test.ts`.
- `build_village` 대형 맵 대로 골격은 이제 곡선이다 (2026-09-05): `villageBoulevardPath`가 시드 고정 경유점으로 동서·남북 곡선을 그리고, 예약과 시공은 `boulevardCells` 한 칸 함수를 같이 쓴다. Tests: `test/villageBoulevard.test.ts`.

## Project-wide quality evaluation

`evaluate_game_quality` is read-only. It combines project lint and tileset-palette findings with structural coverage across legacy event commands, event pages, common events, troop battle pages, and every nested command branch. It also reports quest/battle/ending/content counts, story-flag reads and writes, and optional caller-supplied walkthrough results. Objective project errors, unauthored secondary maps, and uninvoked ending definitions block its verdict; palette findings and caller-supplied walkthrough results remain explicit evidence. It never emits a numeric score and cannot measure fun, originality, emotional impact, pacing quality, or preferred difficulty.

**Ending invocation (2026-09-06):** `define_ending` stores a definition, not an automatic switch listener. An event must execute `triggerEnding`: a named `endingId` selects that definition directly, while an omitted id selects the highest-priority definition whose conditions match. Completion assessment reports `ending-uninvoked` errors and `coverage.endings.uninvokedIds` for definitions without a named or condition-selected invocation. It traverses nested branches/common events/troop pages but ignores obsolete root commands when event pages exist. Presence is only a structural lower bound: it does not establish branch reachability, satisfiable conditions, epilogue presentation or actual completion. Games without ending definitions (including native `ending` commands and open-ended games) acquire no new requirement.

This check lives in `qualityEvaluation.ts`, not `projectLint` or the write gate: defining an ending before wiring it remains valid. Never make `setSwitch` run endings automatically. The existing `define_ending` guidance calls for an explicit terminal command and, for item-consuming exits, a higher-priority completed-switch page that prevents same-run relock/repeated consumption. Regression: `test/aiEndingCompletionRegression.test.ts` exercises real tools, serialization, page selection, interpreter execution and the machine verdict consumer; historical broken content still does not end. Parent-owned real AI generation and exported-player walking remain required for game-completion proof.

**Verification evidence (2026-09-07):** `ToolResult.ok` means execution, not a passing artifact verdict. Existing `parseToolVerdict` semantics remain. `ToolVerificationEvidence` separates adopted requirements, unresolved findings and attempts; neither an explicit exploratory pass nor a malformed invocation invents an obligation. Accepted criteria and validated `WorkItem.verificationChecks` own requirements; absent scope remains pending specification. Session check IDs survive scheduling changes and appear in `data.verification` on plan/verification results. See [editor-ai-panel.md](editor-ai-panel.md), "Session-owned acceptance contract", for the small declaration and `correct_verification({checkId,args})` surfaces. Ordinary compatible reruns still resolve their own scope; unrelated maps/events and weaker assertions cannot. Writes retire passing adopted proof, while a successful unowned dummy probe can be removed without a recreation obligation. Genuine negative findings, including advisory ones, remain blocking until a compatible real pass. Layer advisory scheduling and terminal acceptance evaluation are unchanged.

`run_scene_test` now returns host `interactions:[{stepIndex,mapId,eventId}]` (including movement-triggered transfers) and structured `setupFailure`. Only an unowned assertion-free interaction with no selected target receives the invalid-probe exception; explicitly missing targets and failed assertions do not. Facing corrections preserve all other steps and require matching map-owned trace. Movement/walk/set-position is never stripped from identity. No scene receipt is browser player, visual, persistence or action-combat proof. Tests: `assistantVerificationEvidence`, `assistantVerificationContinuation`, `sceneVerificationRepair`, `sceneTestRunner`, and the caller matrix in `aiAssistantSession`.

`play_walkthrough` exposes a single provider-safe scenario item object rather than JSON Schema unions. All runner fields are optional at the provider boundary because the valid required set depends on `do`/`expect`; the runner is the strict trust boundary and rejects unknown fields, mixed variants, bad types, and empty scenarios before executing any command. Provider-compat tests recursively reject both `oneOf` and `anyOf` anywhere in an exposed tool schema.

## prune_unused 의 참조 수집은 variableId 를 가진 명령 전부를 세야 한다 (2026-08-29 실측 결함 수정)

`src/editor/tools/refactorTools.ts` `addCommandRefs` 의 `switch` 가 다루던 kind 는
`setSwitch`/`setVariable`/`changeGold`/`changeExp`/`getFriendship`/`fork`/`changeItem`/
`battleProcessing`/`shop` **9종뿐**이었다. 스키마(`src/project/types/events.ts`)에서
`variableId` 를 지니는 kind 는 `wait`·`inputWait`·`inputNumber`·`setVariable`·`getFriendship` 이라
**앞의 세 개가 통째로 빠졌다.** `moveEvent` 경로 안의 `{ kind: "setSwitch" }` 무브도 누락됐다
(`databaseCommandReferences.ts:298` 은 그걸 센다).

왜 조용한가: 누락된 참조는 `findUnused` 를 지나 `prune_unused apply=true` 에서 **이름만 비우고
id 슬롯은 남긴다**(`def.name = ""`). id 가 지워지지 않으므로 `commandReferenceValidation.ts:205` 의
`inputNumber: variableId가 존재하지 않습니다` 단언은 **끝까지 안 뜬다.** 그리고 `actions.ts:438` 이
이름이 빈 슬롯을 다음 «변수 추가» 에 **재발급**한다 — 무관한 두 기능이 한 변수를 조용히 공유하게 된다.

계약 테스트: `test/refactorTools.test.ts` «prune_unused 참조 수집 누락» (inputNumber/inputWait/wait
각각 단독 참조 + moveEvent 경로 setSwitch + 진짜 미참조 변수는 여전히 보고되는 회귀 케이스).

- **이미지 생성은 Antigravity 한 경로뿐이다 (2026-08-30, 2026-09-03 갱신):** 동반 서비스에
  `POST /v1/images/generations` 가 붙었다(`ohMyPiHttp.mjs` → 어댑터 `generateImage` →
  Bun 워커 `/image` → `scripts/lib/ohMyPiImageRuntime.ts`). 브라우저 클라이언트는
  `src/ai/imageGenerationClient.ts` 이고 `/v1/chat/completions` 와 같은 같은-오리진 규약을 쓴다.
  요청 모델은 `gemini-3.8-flash`. 카탈로그에 없으면 워커가 `gemini-3.1-flash-image` 로 떨어진다.
  이벤트 「그림 표시」 폼의 `AI로 만들기`(`showPictureAiField`)가 같은 경로를 타고
  `insertGeneratedPictureAsset` 으로 업로드 그림 리소스를 심는다.
  실측 결과: `google-antigravity` + `gemini-3.1-flash-image` 에 `generationConfig.responseModalities`
  = `["TEXT","IMAGE"]` 를 pi-ai 의 `onPayload` 훅으로 주입하면 `v1internal:streamGenerateContent`
  가 `inlineData`(image/jpeg, 약 360KB base64) 를 200 으로 돌려준다.
  **Codex 는 못 한다** — 호스팅 `image_generation` 툴을 요청할 방법이 pi-ai 에 없다
  (`NativeToolMarker` 가 `{type:"computer"}` 하나뿐). 응답 쪽 `image_generation_call` 파서는
  있지만 요청을 만들 수 없으므로 살아 있는 경로가 아니다. 그래서 클라이언트는 대화 제공자가
  무엇이든 그림만 Antigravity 로 보내고, 모달이 그 사실을 안내한다.
  **함정 둘:** (1) pi-ai 의 Google 응답 파서는 `inlineData` 를 버린다(`type:"image"` 파트를
  만들지 않는다) — 그래서 이미지 바이트는 전송 계층에서 직접 줍는다. (2) 그때 재생하는
  `Response` 에 `url` 을 다시 심어야 한다. 없으면 pi-ai 가 `Missing request URL` 로 끊는다.


## Action controls guide (2026-09-07)

2D tile action combat is supported; 3D open worlds remain outside the engine.
`actionArenaAuthoring.ts` selects its recipe only for a structured creation
declaration with nonempty `actionCombat.targets` and no clarification. The
selector never parses user keywords. `buildActionArenaAuthoringGuide` is consumed
by the action welcome preset and the lead's context integration. It reads
existing maps/events/resources/party/enemies/troops before minimal terrain/start,
names the map and game, orders enemy before troop before spawn, and makes one
controls guide. Each target must pass `run_action_combat_test({mapId})` before
decorations; the async acceptance/runtime lane owns that tool's receipt.
`run_scene_test`, spawn counts and turn-based `simulate_battle` cannot substitute
for action proof. Unrequested quests, shops, bosses, rewards and multi-page
quotas are not part of this recipe. Existing arena modifications remain focused
repairs with retained acceptance targets, not a new-arena starter.
Free-text welcome handoff also preserves the requested scope rather than adding
the generic preset's NPC/item quotas before structured intent classification.

`make_action_enemy` prepares the enemy and validates its graphic, target map,
troop membership and spawn area before committing either record. `spawn.id`
upserts within the target map; omission appends a fresh ID. `set_action_combat`
validates its map before enabling the system and exposes the existing
`dodgeStaminaCost`, `dodgeIframesMs`, `guardDamageReductionPercent` and
`guardStaminaDrainPerSec` normalizers. Read resources first, create the enemy,
then `upsert_troop({troop:{id,name,enemyIds:[enemyId]}})`, then attach its spawn.
`test/actionAuthoringPrerequisites.test.ts` covers both direct-draft atomic
failure and the real runner's successful dependency order.

`place_npc` accepts `guide: "action-controls"` instead of authored `pages` for one
controls page only. `src/player/keyBindings.ts` exports `ACTION_CONTROL_BINDINGS`
(`id`, normalized `keys`, `label`) and `ACTION_CONTROLS_GUIDE`; the generated text
comes from those runtime predicates, not model-authored key descriptions.
The default identity is `ev_action_controls_<mapId>`. An explicit ID takes
precedence. Retries update that event's page without moving it, even when the
requested name or coordinates change. Nearby ordinary NPCs are not guide
identities, and distinct explicit ordinary NPC IDs still remain distinct.
Ordinary NPCs still require authored pages. The guide is the narrow exception to
the narrative multi-page recommendation, not a fallback for missing dialogue.

Regression: `test/actionControlsGuide.test.ts` exercises real tool dispatch,
repeat identity, explicit-ID priority, ordinary NPC separation, and shipped
command-body equality with the canonical guide.

## NPC 대사는 코드가 지어내지 않는다 — 캐스트 라이터 계약 (2026-09-03)

사용자 보고: "npc 대사가 생성할 때마다 비슷하다. 하드코딩이냐?" — 맞았다. `author_village` 는 인자에 대사 자리가 없어
(`npcCount` 만) 항상 `village/constants.ts DEFAULT_NPCS`(민재·소라·대길… 10명 고정 대사)를 돌려썼고, `make_villager`/`place_npc`
는 대사를 빼면 `"안녕하세요."`·`"일하는 중이야."`·호감 페이지 `"고마워…"` 를, 밑그림 npc 자동 배치는 `"${name}입니다."` 를,
`build_castle` 은 문지기·성주 고정 대사를 박았다. 그리고 `project.world`(세계관)는 AI 어디에도 실리지 않았다
(`buildWorldDigest` 호출자 0). 전부 제거했고 계약을 이렇게 바꿨다.

**계약**
- NPC 를 만드는 툴은 대사가 없으면 **text 커맨드 0 인 '대기' 페이지**를 만든다. 대체 문구 없음. `author_village`/`build_village`
  는 `대사 없는 NPC: N명` 경고를 그대로 낸다. 임시 이름은 `주민 N` 이며 캐스트 라이터가 이름까지 바꾼다(내부 맵 이름
  `주민 N의 집 내부` 도 함께 바뀐다). `make_villager` 의 활동 페이지·`friendshipUnlock` 페이지도 대사 없이 만들어지고
  `friendshipLines:{unlock, after}` 인자로만 채워진다.
- `author_village` 는 `residents:[{name, role?, lines?}]` 를 받는다(스키마·`parseAuthorVillageRequest`·`villageDomainArgs → npcs`).
  모델이 직접 쓰면 그대로 들어간다.
- 세션 훅 `AssistantSession.authorPendingNpcCast` — **턴 끝**(최종 응답·검수 종료·예산 종료 직전)에 기준선에 없던 대사 없는
  NPC 를 맵별로 모아 lite 모델(`configForLiteModel`, `response_format: json_object`)에게 **한 장의 캐스트 시트**를 받는다.
  프롬프트(`ai/npcCast.buildCastWriterMessages`)에는 테마(툴콜 `theme` 또는 밑그림 title)·요청문·세계관 다이제스트
  (`buildWorldDigest`, 600토큰)·같은 맵의 이미 대사 있는 주민·대기 페이지(pageId + 조건 라벨: 활동/시간대/호감도…)가 실린다.
- 검증은 코드가 한다(`parseCastSheet`): 대기 페이지 전원 ≥1줄, 주민 ≥2 이면 절반 이상이 **다른 주민 이름**을 언급, 세계관
  개체가 있으면 ≥1줄이 그 **이름**을 언급, placeholder 이름 금지, 모르는 eventId 거부. 실패 사유를 붙여 1회 재요청.
- 적용은 새 쓰기 툴 `author_npc_cast`(`tools/npcCastTools.ts`) — 페이지에 changeFace+text 를 앞에 넣고 **상점 등 비텍스트 커맨드는
  보존**, 페이지/이벤트 이름 변경, 주민을 `world` 의 `character` 개체(`w_npc_<eventId>`, refs event+map, origin ai) + 맵 `place`
  개체(`w_place_<mapId>`) + `locatedIn`/`knows` 관계로 등록(`castSheetToWorldPatch`, `normalizeWorld` 통과). 사용자(origin user)·
  잠긴 개체는 덮지 않는다. diff 에 `eventsModified`·`worldEntitiesAdded` 가 잡혀 제안·감사·되돌리기가 다른 쓰기와 같다.
- 실패(JSON 깨짐·검증 2회 실패·툴 거부)는 **재킥**: 감사 `npc-cast:failed`, 오케스트레이션 메시지 "HARNESS: 대사 없는 NPC N명…
  place_npc {id, dialogue} 로 직접 쓰라" 를 넣고 최종 응답 분기에서 라운드를 한 번 더 돈다(턴당 1회). 성공은 `npc-cast:applied`.
- 데모/샘플 콘텐츠(`src/editor/content/*`, `src/project/defaults/dewVillageDialogue.ts`)는 저작된 게임 데이터라 건드리지 않았다.
- 테스트: `test/npcCast.test.ts`(순수 검증·세계관 패치), `test/npcCastTools.test.ts`(대기 페이지·residents·friendshipLines·castle·
  author_npc_cast), `test/npcCastSession.test.ts`(훅 성공/재킥). `aiEventPageSemantics` 의 "still greets" 케이스는 새 계약으로 바꿨다.

## 「이 세계」 캐논은 문장 3채널에 강제된다 (2026-09-04)

`worldCanonContext.worldCanonPromptSection`(「이 세계(세계관 고정)」 블록)은 메인 어시스턴트 컨텍스트의 예산 밖 고정분
(`contextBuilder.withWorldCanon`)이었지만, 정작 문장을 쓰는 3채널에는 닿지 않았다. 공유 검사
`findWorldCanonAbsenceHits`(absences 부분일치, 빈 캐논→`[]`)로 세 채널에 주입+검증을 걸었다:
- NPC 캐스트 라이터(`ai/npcCast`): `CastContext.worldCanon`(`WorldCanon | undefined`, required)에 캐논 전문 + 시스템 금지줄,
  `parseCastSheet`가 이름·역할·요약·전 라인 금지어 검사 — 히트 시 재킥. 호출부(`assistantSession.authorPendingNpcCast`)는 `project.worldCanon` 전달.
- DB AI 생성(`editor/aiDatabaseGeneration`): `buildRecordPrompt(kind, brief, names, canon?)` 시스템 주입,
  `parseGeneratedRecord(kind, raw, canon?)`가 name+원시 description 검사 — 적 스키마에 description이 없어 필터 뒤가
  아니라 **원시 응답 기준**이다. `generateDatabaseRecordWithAi`는 `project.worldCanon` 전달.
- 이벤트 Assist(`ai/eventCommandAssist`): `buildEventAssistPrompt`에 캐논 섹션, `parseAndValidate`가 text body·화자·
  선택지 질문/문구·숫자 입력 안내·여관 인사/질문·killPlayer 메시지·엔딩 제목/본문 (중첩 fork/choices/loop 포함,
  `commandBranches` 순회) 금지어 검사 — 자가수정 루프가 고친다. 비노출 필드(label 이름 등)는 검사하지 않는다.
- 셋 다 빈 캐논이면 블록도 검증도 없이 기존과 동일. 테스트: 각 파일의 "worldCanon 강제" describe.

## 마을 설계서 (2026-09-05)

author_village와 buildVillageDomain이 DB 설계서의 고정값·집 수 범위·집 재료/층수 호환성을 시공 전에 검사한다. 기본 설계서가 있으면 ID·집 수 생략이 가능하다. 상세 계약과 경계는 [마을 설계서](village-design.md).

## 저수준 이벤트 입력은 명령 위치를 검증한다 (2026-09-05)

`upsert_event`의 `event.trigger.commands` 또는 `event.pages[n].trigger.commands`는 `invalid-args`로 거부한다.
명령은 trigger와 같은 객체의 `commands`에 둔다. 검사는 입력 patch를 병합·정규화하기 전에 수행한다.
실제 JRPG 재실행에서 잘못 중첩된 transfer를 도구가 무시하고 빈 commands로 저장해 던전 귀환이 사라졌기 때문이다.
`test/toolsMapManagement.test.ts`는 두 잘못된 위치를 모두 거부하고 기존 귀환 이벤트가 그대로 남는지 검증한다.

2026-09-06 R5: `schemaShapes.ts`의 실행 명령 enum은 `COMMAND_KINDS`만 노출한다.
아이템 차감은 `{kind:"changeItem",itemId,op:"-=",amount:1}`, 스위치 대입은
`{kind:"setSwitch",switchId,value:true}`, 아이템 조건은 `{kind:"item",itemId,present:true}`,
엔딩 호출은 `{kind:"triggerEnding",endingId}`(ID 생략 시 조건 선택)다. `op`/`endingId`/`present`를
선언하며 `find_tools`도 같은 등록 스키마를 반환한다. 다형 `value`는 거짓 `type:"string"` 대신
타입 제약 없이 필드를 노출하고 kind별 boolean/number/"toggle"/변수 피연산자를 설명한다.
이는 provider의 union type 및 oneOf/anyOf 금지를 유지하기 위한 경계 표현이며, 실제 타입·필수 값은
기존 컴파일러/shape 검증기가 검사한다. `test/aiCommandSchemaContract.test.ts`는 컴파일·직렬화 보존,
잘못된 명령/누락 조건 값의 원자적 거부, 참조 조회 선행을 검증한다. 실모델 복구·플레이 증명은 별도다.

2026-09-06 R10: `upsert_event.event.pages`는 `NATIVE_EVENT_PAGE_SCHEMA`이며 SimplePage 컴파일 경로가 아니다.
대사·선택·효과는 `page.commands`에 넣고, 선택 명령은
`{kind:"choices",options:[{text:"선택",branch:[{kind:"changeItem",itemId,op:"-=",amount:1},{kind:"triggerEnding",endingId}]}]}`다.
`page.choices/lines/showText/messages/text/face` 및 `graphic.query/textureKey/characterIndex`를 제출하면
병합 전에 `invalid-args`와 네이티브 수정 JSON 예시로 원자적 거부한다. 그래픽은 `graphic.sprite:{type,id}`를 사용한다.
기존 이벤트에서 생략한 최상위 필드는 정규화도 하지 않는다. `pages`를 제출하면 배열 전체 교체이며,
제출된 페이지의 필수 필드 보완과 R5 명령 검증은 유지한다. `place_npc`/`make_villager`의 SimplePage 컴파일은 그대로다.
회귀: `test/aiNativePageContract.test.ts`는 실제 round2 출구 입력 거부, 예시 재호출, 직렬화 후 선택·열쇠 1개 차감·
기록된 epilogue·`returnToTitle`, 취소 무효과, 생략 페이지 보존과 고수준 컴파일을 검증한다. 실브라우저 완주/원격 재로드는 별도 게이트다.

2026-09-07 R14: `list_resources(kind:"charset")`와 `list_npc_graphics`는 기존 필드·사용자 라벨/태그를
유지하면서 `nativeGraphic:{sprite:{type:"bundled",id},direction:"down",pattern}`을 추가한다.
이 객체를 `upsert_event.event.pages[n].graphic`에 그대로 넣는다. `pattern`은 characterIndex가 아니라
시트 프레임이며, 기존 `charsetFrameIndex`로 계산한 슬롯 0~7의 아래방향 정지 프레임은
25,28,31,34,73,76,79,82다. 작은 pattern 값도 슬롯으로 재해석하지 않는다. 고수준 SimplePage 컴파일과
카탈로그 라벨은 바꾸지 않는다. `test/nativeGraphicDiscovery.test.ts`는 두 조회 → 네이티브 업서트 →
직렬화/재로드 → 실제 `renderTiles`의 sprite 생성 인자를 독립 프레임 표와 대조한다(8슬롯·두 행·네 방향).

## 보물상자는 노출된 수면을 거부한다 (2026-09-05)

`place_chest`는 요청 좌표와 자동 착지 결과를 모두 검사한다. 물 판정은 현재 타일셋의
`roleCapabilities(...).terrainTag`를 사용하고, 메타가 없는 기본 칩셋에만 칩 번호 폴백을 적용한다.
통행 가능한 O 상층 다리는 허용하지만 ★ 장식은 하층 물을 가리지 않는다. 벽감의 인접 조사 예외는 유지한다.
`test/treasureChestPlacement.test.ts`가 물·다리·다른 타일셋·자동 착지를 검증한다.

## 모험 저작 완료와 재시도 (2026-09-05)

Final-artifact assessment (2026-09-06, R12): `agentVerification` adds
`evaluate_game_quality` for authored endings and repeats earlier quality checks at
completion. `AssistantSession` assesses the current draft independently of the
once-per-layer sweep, including tool/token-budget termination. Its
`completion_assessment` event and `TurnResult.completionAssessment` retain the
acceptance snapshot (including R7 field diagnostics), adventure structure/icon/
image gaps, current check results, and unresolved verification findings together.
The same combined state reaches the model before bounded repair selection and is
composed into one terminal report, never replacing one failure category with another.
Repairing one category does not reset promises/baselines or replay applied milestones.
Missing `triggerEnding` invocation requests content repair; general advisory lint
does not become a fatal gate. Static checks and persistence receipts remain distinct
from actual playthrough proof.

의도 선언의 선택적 `adventure`(village/dungeon/party/battle)는 전체 모험 저작 요청에만 붙인다. 단순 NPC 추가·질문·DB 시드 요청에 키워드로 덧붙이지 않는다. 세션은 선언을 자동 계속과 계획 교체 뒤에도 보존하고, 최종 경로 양쪽에서 `adventureCompletionProblems`를 실행한다. 구조 타일 없는 시작 마을, 도달 가능한 탐험 맵 전이·전투 연결 부재, 시작 파티/합류 부재를 보완 지시로 돌려주며 4회 뒤에도 미완성이면 완료 응답을 대체한다. 최종 쓰기 뒤 모든 맵 전체 show_map_region 조회와 저작 아이템 아이콘도 요구한다. 이것은 정적 최소 조건이며 페이지 조건·미술 완성도·재미를 증명하지 않는다. 출하 런타임과 직접 시각 검사는 별도로 한다.

place_npc는 NPC의 name을 페이지 제목과 분리해 저장한다. 이름 없는 재시도는 가까운 동명 이벤트를, 같은 명시 ID는 해당 이벤트를 재사용하며 위치·일정을 보존한다. 다른 명시 ID는 의도적 복수 배치다. 새 착용 장비는 upsert_equipment를 써야 하며 upsert_item의 레거시 장비 종류 신규 생성은 거절한다(기존 레거시 수정은 허용). 저수준 text.body의 문자형 역슬래시+n은 실제 줄바꿈으로 고치도록 거절하되 배우 이름 제어문자는 유지한다.

모험 보완 검사는 도달 가능한 보물/전투 이벤트 및 시작 맵 복귀 전이를 요구하고, 상호작용 이벤트의 타일 통행·접근을 검사한다. 던전 외형은 `list_dungeon_room_themes` → `run_dungeon_room_pipeline`로 저작하도록 안내하며 기존 맵 무단 교체는 금지한다. 이 검사는 동굴 미술을 자동 인증하지 않는다. 전체 맵 시각 조회는 반환 영역 기준으로 합산한다(1회 최대 24×24).

`set_project_settings({startActorIds})`는 system 메타데이터와 `project.session.partyActorIds` 시작 상태를 함께 갱신한다. 런타임 `startSession` 및 모험 완료 검사는 `startStateOf(project)`를 정본으로 읽는다. system만 4인으로 바꿔도 실제 플레이가 1인으로 남던 오류를 저장/재로드/새 세션 테스트로 보호한다.

NPC 고수준 commands의 `text.lines`는 실제 줄바꿈을 포함한 `text.body`로 정규화한다. 저수준 text 명령의 body 누락은 거절한다. 맵 충돌 검사는 스프라이트가 있는 NPC/상자의 막힌 바닥을 검사하며, 타일에 부착된 투명 조사 이벤트는 인접 접근을 허용한다.

선언된 adventure 계약의 도구는 `adventureToolNames`에서 실제 호출 스키마로 승격되어 첫 실행부터 노출된다. 안내문에서 언급만 하고 도메인 쿼터에 숨기는 것을 금지한다. 조건 kind 누락 오류는 실행 가능한 selfSwitch/switch 예시를 반환한다.

시각 재검증에서 장비 아이콘 누락이 발견돼 모험 완료 검사의 저작 레코드 추적을 items와 equipment로 확장했다. 두 컬렉션의 동일 ID도 따로 추적한다. 그림 없는 장비를 생성하고 완료라고 답하는 통합 회귀를 유지한다.
