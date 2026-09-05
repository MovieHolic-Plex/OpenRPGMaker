# Interior Room Session Harness (villager-room-v1)

The LLM-harnessed interior pipeline: start session, advance build per layer, evaluate, and self-repair loop.

## Tileset-specific map generation contract

- `generate_map` resolves the requested `tilesetId` through `src/editor/tools/mapGenerationProfiles.ts`. Numeric tile IDs are local to that tileset and must never be reused through a global village/interior palette.
- Every bundled tileset has its own explicit profile key and layout grammar (`settlement|dungeon|rooms|ship|world|city|wilds`). The generated `GameMap.tilesetId` remains the requested ID.
- A profile owns the passable floor/path tiles, blocked boundary/obstacle tile, accent tile, and topology grammar. `generate_map` applies that passage contract before its reachability repair loop.
- The passage contract updates the project tileset record shared by every map using that `tilesetId`; floor/path/accent stay passable and the profile obstacle stays blocked consistently across those maps.
- The passage contract updates the project tileset record shared by every map using that `tilesetId`; generation therefore treats floor/path/accent as passable and the profile obstacle as blocked consistently across those maps.
- `villager-room-v1` and `dungeon-room-v1` remain the detailed layer/session pipelines for their respective authored workflows. The generic `generate_map` dispatcher does not force every tileset through the interior pipeline.
- Uploaded or unknown tilesets do not silently inherit bundled numeric IDs; generation rejects them until a dedicated profile is authored.

## Interior Room Session Harness (villager-room-v1)


- The interior pipeline is LLM-harnessed via `src/editor/tools/interiorRoomSession.ts`: `start_interior_room_session` (plan args: `wings|rooms(+per-room floorTile)`, `innerDoors`, `door`, `theme`, `seed`, `floorTile`, `wallMaterial: cream|gold-brick|stone-brick`) ??`advance_interior_room_build` per layer (`floor ??walls ??furniture ??entrance ??critique`) ??`evaluate_interior_room`.
- `evaluate_interior_room` mirrors the village harness contract (`villageEvaluate.VillageLookReport`): returns `{ ok, score, issues, metrics, attempt, maxAttempts, feedbackForLlm }`. Checks are theme furniture manifests, door-BFS walkability (furniture treated as obstacles), and quadrant fill balance. On failure the assistant should follow `feedbackForLlm`, patch via `advance_interior_room_build({ forceLayer: "furniture" })` or plan changes, and re-evaluate ??same self-repair loop as `villageSession`.
- The builder guarantees geometry invariants regardless of caller: hard multi-tile sets are never half-placed, room entry cells are reserved during placement (`ENTRY_SENTINEL`), and `enforceWalkability` melts removable single props to keep every open cell reachable from the door. `plan.seed` feeds a mulberry32 RNG (variant/rotation/jitter), so the same plan reproduces and a new seed rerolls furniture placement. After walkability, `fillSparseQuadrants` fills the sparsest quadrant with theme wall-snap goods using place-verify-revert (each placement is BFS-verified and reverted if it blocks a path).
- Space-role harnessing: "interior" is the parent concept; placement decisions are per space. Each `rooms[]` entry carries a role theme (`bedroom|study|dining|kitchen|storage|tavern|corridor`); `corridor` is a walkway role ??no floor-occupying furniture, only wall d챕cor and tall displays (bust/armor), and its cells are exempt from quadrant-density judgement and fillers. `furnish_interior_space({ sessionId, roomId, theme?, seed? })` demolishes and re-furnishes one space (furniture, wall d챕cor row, rugs) with the role grammar, then re-runs map-wide walkability ??the per-space repair/retheme loop for the assistant.
- Contextual prop anchoring: bedroom rugs anchor at the bed's foot (not under table sets), a nightstand (`VR.BOX`) lands beside the bed head via `placeBedsideProp`, and bedroom table sets are excluded from the bed zone (Chebyshev ??2) and rug cells. Kitchen cauldron/kettle anchor next to the stove.
- Editor chatbot integration: the harness tools are registered in `toolRegistry.ts` under the `tile` domain and survive the 40-tool exposure quota in tile mode (regression-fixed in `test/toolExposureQuota.test.ts`); `scripts/check-tool-exposure.mts` probes the live exposure set. The former `build-interior` assistant skill that injected the full playbook (plan grammar: partition spacing, innerDoors, corridor role, wallMaterial/floorTile rules; plus the session → evaluate → `furnish_interior_space` self-repair loop) was removed with the assistant-skill feature (2026-08-27) — the tools and their descriptions are now the only prompt-side source. Session-built maps are auto-registered in `mapTree` so they appear in the editor map list.
- End-to-end reference: `scripts/demo-assistant-interior-build.mts` drives the real tool handlers (requirement ??plan ??session ??per-space furnish ??evaluate ??deploy) against the live Supabase project; `scripts/build-room-practice-project.mts --reroll N` is the batch/script path that bypasses the LLM loop on purpose. The batch script gates `--save` behind per-map evaluation (seed-retry loop, up to 12 rerolls per plan).



## Safe detached draft and approval harness

- Room sessions now live in editor-only `detachedDraftMemory` through `roomHarness/sessionStore.ts`; they are transferred explicitly when assistant/region drafts are cloned and never become `Project` JSON or runtime/session state.
- `roomHarness/engine.ts` records an explicit checkpoint for every layer, including structured location-aware warning/error data. `roomHarness/facade.ts` is the low-level typed API for start/advance/evaluate, room lock/unlock, and seeded room-only reroll; it does not depend on LLM tool exposure or the 40-tool quota. `regionTask/runDirectRoomDraft.ts` is the connected editor coordinator: the region modal's **AI 없이 실내 초안** action offers home/inn/manor presets plus composable theme modifiers, selects an event-free doorway whose adjacent return cell is reachable from the authored start (following existing transfers), builds all layers in detached memory, and creates exterior→interior plus interior→exterior transfers.
- Room-only reroll restores every tile/stack outside the selected room byte-for-byte, preserves all events, uses an explicit integer seed, rejects locked rooms, re-evaluates the resulting room draft, and refreshes the ghost preview/review report.
- Region review runs bounded deterministic isolation repairs and a hard world-navigation preflight before approval. Unreachable auto-generated `ev_inspect_*` flavor events may be removed within the same repair budget; authored objectives, transfer sources/destinations, NPC schedule destinations, and living destinations remain blockers.
- `pendingRegionApply` always compares an authoritative live project fingerprint and always performs a fresh review (using `reviewRegionDraft` as the fallback) for full, replacement/partial, reroll, and NPC-resolution candidates. Structural room/map proposals do not expose tile-only partial apply because that would separate the door from its map/session. A successful approval records exactly one `{ kind: "project" }` history snapshot and performs one store replacement, so one undo removes both the exterior door and generated interior map.

## Interior object catalog is the shape source of truth (2026-08-28)

- 가구 형상은 `src/editor/interiorObjectCatalog.ts` 가 데이터로 선언한다: `INTERIOR_OBJECT_CATALOG` 항목마다 `id`, 한국어 `label`, `role`(`InteriorSemanticTileRole | null`), `width`/`height`, `layer`, `cells`(`{dx,dy,layer,tile}[]`), `themes`, `snap`. 조회는 `interiorObjectById` / `interiorObjectsForTheme`.
- **2026-08-31:** 실내 칩셋을 처음 열거나 하네스가 돌면 그 카탈로그가 `tileset.structureKits`(계보 `interior-catalog`, `ai.snap`/`ai.interiorRole`/`ai.themes`)와 `tileset.interiorRoomKinds` 로 시드된다. 이후 파이프라인은 타일셋 데이터를 읽고, 코드 카탈로그는 시드·폴백이다. 기본 7종(bedroom…) 배치는 여전히 코드 프로그램이고, **없는 방 종류 id** 는 역할·스냅으로 가구를 놓는 일반 배치기를 탄다. 벽·천장 문법은 아직 실내 칩셋 전용이다.
- 파이프라인이 그 데이터를 소비한다: `src/editor/interiorRoomPipeline.ts` 의 `objectCells(id)` + `paintObjectCells(map, cells, ox, oy)` 가 침대(가로/세로)·책장·화덕·긴 탁자·카운터·피아노를 카탈로그 셀로 찍는다. 정의가 없는 id 는 즉시 예외 — 오타가 반쪽 가구로 새지 않는다.
- 셀 모양이 `renderTileCellsToCanvas`(`kitRender.ts`)의 `{dx,dy,layer,tile}` 과 같으므로 에디터 UI(데이터베이스 '구조물' 탭)가 같은 데이터를 그대로 래스터로 그린다. 즉 사용자가 보는 그림과 AI 가 찍는 타일이 한 정본에서 나온다.
- **변경의 심판은 패리티 테스트다**: `test/interiorRoomPipelineParity.test.ts` 가 `test/fixtures/interiorRoomDemoRooms.baseline.json`(데모 방 7종의 `lowerTiles`/`upperTiles`, 변경 전 코드에서 박제)과 바이트 단위로 비교한다. 카탈로그 셀을 하나만 바꿔도 이 테스트가 깨진다 — 배치를 의도적으로 바꿀 때만 픽스처를 다시 박제하고, 그 이유를 커밋 메시지에 남긴다.
- 카탈로그 자체 불변식은 `test/interiorObjectCatalog.test.ts` (셀 경계, 중복 좌표, 역할 타일 포함 관계, 테마 필수 역할 충족, id 규칙).

## 소품 표면 어휘가 `PlacementZone` 으로 통일됐다 (2026-08-30, PR #316)

`interiorRoomPipeline.ts` 의 `PROP_SURFACE` 표가 쓰던 자체 어휘가 공용 `PlacementZone`
(`src/project/types/base.ts:117-129`)으로 바뀌었다. **다른 세션 코드가 옛 값 이름을 참조하고 있으면
같이 고쳐야 한다** — 값 세 개가 이름을 바꿨고, 새 항목 `STOVE_BOT`/`STOVE_TOP`/`HEARTH` 가 들어왔다.

내장 `kitchen-stove` 그룹(타일 21/51)에는 하드코딩 규칙 `r_interior_stove_north_wall`
(`interiorRoomPipeline.ts:441-458`, `zone: "againstWall"`, `facing: "north"`, `strength: "hard"`)이
붙는다. 하드코딩은 **규칙 자체**뿐이고 벽·바닥 판정은 여전히 `passability` 에서 온다 — 타일 id
목록으로 벽을 정하지 않는다. 이 규칙이 만드는 lint 코드는 `cluster-rule:surface:*` 라서 커밋을
막지 않는다(`openwiki/editor-validation.md` 의 같은 날 항목 참조).


## 개념 시설 시공 — place_concept 경로가 파이프라인에서 다른 점 (2026-09-02)

`InteriorRoomPlan.concept` 가 있으면 파이프라인은 테마 프로그램 대신 나무를 따른다. 데모 방 패리티 픽스처(`test/interiorRoomPipelineParity.test.ts`)는 이 분기를 타지 않으므로 그대로다.

- **도면**은 `src/editor/conceptBundleResolve.ts` 의 `layoutConceptFacility` 가 장소 역할로 만든다: 방 줄(y=4, 가로 1열 파티션) → 3행 파티션 → 복도(3행) → 3행 파티션 → 홀(정문, 남쪽 행 중앙). 내부 문은 파티션 트림 행. 오버레이(`ConceptOverlay.rooms[roomId]`)는 방 인스턴스마다 장소·역할·물건·칩을 싣는다(`interiorKit.parseConceptOverlay`).
- **구성**은 `src/editor/interiorConceptCompose.ts` 의 `composeConceptRoom` 이 방 하나씩 한다. 슬롯 종류: 벽걸이(`wall-any` → 크림 벽면 윗줄, 상위 레이어), 키 큰 가구(시계·갑옷·흉상·거울·진열대·화덕 → 상단이 벽면 아랫줄), 북벽(침대·책장·카운터·피아노), 복도 끝(transfer 칩=계단), 바닥(탁자 — 방 중앙, 좌석군 사이 통로), 구석(1×1 block), 러그(침대 발치, 통로 위 허용). 문에서 방 안으로 곧게 이어지는 **통로**와 정문 좌우는 가구 금지. 벽 물건 사이 1칸 간격은 자리가 모자라면 양보한다. 못 앉힌 물건은 `concept: <물건> 자리 없음 (<장소>)` 경고 — 숨기지 않는다.
- **벽·천장**: 벽 문법은 그대로 쓰고, 그 뒤 `carveOutsideVoid` 가 바닥·벽면에 이웃한 한 겹만 천장으로 남기고 밖을 「암흑 공허」(116)로 비운다. 천장 정본 v2(검정 몸통)에서는 건물 밖과 천장이 같은 검정이라 「벽 위에 천장이 없다」고 읽혔기 때문이다.
- **칩 집행**은 `src/editor/interiorConceptEvents.ts` 의 `attachConceptEvents` 가 furniture 층 끝(통행 확보 뒤)에 한다: transfer > sleep > loot > event 우선순위로 물건마다 이벤트 하나, 앵커는 최하단 행 중앙, `ev_concept_<mapId>_<thing>_<n>`. 개념 시설은 `attachPropInspectEvents`·`fillSparseQuadrants` 를 타지 않는다(나무에 없는 것을 보태지 않는다). `evaluate_interior_room` 의 필수 가구 검사는 개념 필수 물건(`conceptManifestWarnings`)으로 바뀐다.
- **보고서 렌더러**: `scripts/lib/renderInteriorMapPng.mts` 는 에디터와 같은 `chipsetQuarterComposition` 으로 천장·벽 프레임을 그린다. 원시 셀로 그리면 천장이 풀밭 조각으로 찍혀 판정을 오염시킨다(2026-09-02 실측). 계약: `test/placeConceptRender.test.ts`.
- **시설 다양화 (2026-09-02):** 초안 아홉 종(`src/project/defaults/conceptFacilityTemplates.ts`)이 같은 도면 규칙·같은 구성기로 선다. 그 과정에서 바뀐 규칙 — (1) **홀 넓힘**: 복도 없이 방 둘 이상이 홀 바로 위에 서면 홀을 좌우 1열씩 넓힌다(`BAND_SPREAD`). 방문 착지 열이 홀 북벽을 2칸 조각으로 쪼개 카운터·피아노 같은 3칸 가구가 설 자리가 없었다(술집·민가). (2) **구성 순서**: 벽 가구(필수 먼저) → 러그 → 바닥·구석(필수 먼저). 러그는 상위 레이어 가구 밑으로 들어가고(`freeFor` 가 러그 칸을 상위 레이어에만 허용, 하부 레이어 상자·책장은 러그를 덮어 구멍을 내므로 불허) 입구 표지(`ENTRY_SENTINEL`) 위에도 깔린다. 방 전체를 훑어 중앙에 가장 가까운 3×3 을 고른다. (3) **구석 소품**: 네 구석 → 둘레(남·북 행, 서·동 열) → 안쪽 순으로 앉아 창고의 상자·술통 7개가 다 선다. (4) **북벽 앵커 공유**: 북벽 가구·키 큰 가구·복도 끝 계단은 서로를 앵커로 보고 퍼진다 — 안 그러면 흉상 둘이 동쪽에만 나란히 선다(교회). (5) **재질**: 장소 `floor` → `RoomSpec.floorTile`(돌 12·널 102·돗자리 139), 시설 `wall` → `plan.wallMaterial`. 파이프라인이 원래 갖고 있던 리틴트를 그대로 쓴다. (6) 조사 문장은 시설명을 받는다(`ConceptEventOptions.facilityLabel` — 「대장간 카운터다」). 계약: `test/conceptFacilityTemplates.test.ts`(초안마다 plan/walkability 경고 0·자리 없음 0·필수 물건 존재·도면 다양성·재질 리틴트).
- **모델 설계 plan + 배치 seed (2026-09-03):** `place_concept` 이 `plan`(장소·물건 목록)을 받으면 `conceptPlan.parseConceptPlan` 이 합성 꾸러미로 바꿔 같은 도면기·구성기에 넘긴다 — 파이프라인은 템플릿과 설계를 구분하지 않는다. `InteriorRoomPlan.seed` 는 개념 분기에서 `composeConceptRoom({seed})` 로 소비된다(종전엔 테마 가구 RNG 에만 쓰여 개념 시설은 seed 와 무관했다). 도면 문법은 `plan.layout`: `row`(방 줄 → 복도 → 홀, 기본) 또는 `double-row`(북 방 줄 → 복도 → 홀+남쪽 날개, `places[].zone` north|south). 구현 `src/editor/conceptLayoutDoubleRow.ts`. 여관 품질은 `scoreConceptFacility` 가 도달·침대·카운터·계단·자리없음·종횡비·템플릿복사를 채점해 `place_concept` 결과 `review` 에 싣는다. `get_concept_facility(여관)` 은 `variants[]`(시골 단층 / 2층 객실 / 복도 양쪽)와 「수식어가 없어도 설계하라」 designHint 를 준다. 증거: `test/conceptDoubleRowLayout.test.ts` · `test/conceptFacilityScore.test.ts` · `reports/inn-freeform/index.html`.


## 도면 호환성과 외장 스탬프 후속 (2026-09-05)

- 두 줄 도면도 한 줄과 같은 legacy 복도 판정(라벨 복도·통로·corridor·hall 또는 id corridor)을 쓴다. 명시한 `role`이 우선하고, 한글 `홀`이나 id `hall`만으로 복도를 추정하지 않는다. theme은 방의 placeId를 그대로 전달하고 복도만 corridor다. 계약: `test/conceptDoubleRowLayout.test.ts`.
- 건물 팔레트 `stampHouse`는 문 이벤트 또는 실내 토글이 꺼지면 `author_house(kind: single, interior: exterior-only)`로 보낸다. `author_house`가 읽지 않는 `doorEvent` 인자는 보내지 않는다. 후대 시공 검증·시작점 복원 경로를 유지한다. 계약: `test/buildPalette.test.ts`.


## 입구 예약·멀티타일 통행 복원 (2026-09-05)

- lower 책장도 upper ENTRY_SENTINEL을 검사한다. 카운터·책장·화덕은 현재 objectCells 카탈로그를 쓰며, 배치 전 두 레이어 값을 세트 단위로 기록한다. 단일 소품 제거로 길이 안 열릴 때만 막은 세트를 통째로 복원한다.
- 저널은 맵 객체별 WeakMap이며 전체/방 가구 시공 시작 때 새로 만들고 통행 검사에 들어갈 때 소비·삭제한다. 개념 꾸러미 경로는 저널에 등록하지 않는다. 이전 맵/재시공의 기록을 다음 작업이 사용하지 않는다.
- 실제 ㄱ자 서재 기본 플랜은 동쪽 포켓 앞 2×3 책장 때문에 개방 셀 9개가 고립돼 있었다. 이제 책장 6칸을 바닥으로 통째로 복원해 0개가 된다. 후속 공백 보정이 소품을 더해 조사 이벤트는 11→12개. 그 방의 단위 테스트 parity fixture만 실측대로 갱신했다(나머지 6개 플랜은 동일).
- 계약: `test/interiorRoomWalkabilitySeal.test.ts`(입구 봉쇄, 실제 서재 세트 복원, 맵 간 독립), `test/interiorRoomPipelineParity.test.ts`, `test/interiorObjectCatalog.test.ts`.


## 공포 게임 제작 기능 (2026-09-05)

실내 평가 결과는 구조·통행 범위와 별도 시각 검토 필요를 명시한다. 데이터·런타임·저작·검증 계약은 [horror-authoring.md](horror-authoring.md) 참조.

## 여관 외 시설의 공간 구성 (2026-09-05)

- `interiorConceptCompose`는 `facilityId`가 `house|shop|tavern|library|smithy|church|warehouse|guild`인 경우에만 가구 묶음 선호를 적용한다. 방 크기·문 예약·가구 셀·레이어는 기존 계약을 유지한다. 여관과 알 수 없는 사용자 시설은 기존 배치 경로다.
- 침대가 없는 방의 러그는 탁자가 실제로 앉을 수 있는 자리를 먼저 고르고, 탁자는 러그 위를 선호한다. 조리·작업 소품은 화덕, 침실 상자는 침대, 스툴은 좌석군 가까이에 둔다. 같은 종류 재고는 흩어진 모서리 대신 묶어서 놓는다. 후보가 기존 충돌·문 예약 검사를 통과해야 한다.
- 창고 상자·술통은 가운데 반출 통로 양옆의 짧은 적재열을 선호한다. 1칸 소품 후보는 BFS로 기존·신규 `event|loot|sleep|transfer` 물건의 접근 가능한 인접 칸을 보존한다. 가운데 통로만 열려 있어도 3×3 상자의 중앙 노획 상자는 갇힐 수 있으므로 바닥 통행 검사만으로 대체하지 않는다. 한 줄 좌석군은 한 행씩 띄워 정렬해 특정 seed가 중간 행을 먼저 소비하고 후속 좌석을 탈락시키지 않게 한다.
- 기본 초안 8종의 좌석·상품·작업 공간을 보강했다. 길드는 비어 있던 복도 밴드 대신 회의실과 의뢰 기록실을 접수홀에 연결한다. `scratchInnBundle`은 수정하지 않는다.
- `get_concept_facility`는 `conceptFacilityVariants.ts`를 통해 여관 외 8종에도 시공 가능한 공간 구성 참고안을 제공한다. 현재 `template`은 계속 프로젝트의 저작 데이터다. 참고안을 자동 적용하거나 기존 `scratchConceptBundles` 배열·기존 맵을 기본값으로 교체하지 않는다. 기존 프로젝트에서도 배치 개선은 다음 시공에 적용되며, 새 초안의 추가 물건은 참고안 또는 명시적 초안 재삽입으로 선택한다.
- 재현: `node_modules/.bin/vite-node scripts/qa-facility-quality.mts verified`로 실제 `runTool(place_concept)` 결과와 무표식 전체 맵 PNG를 만든다. `npm run build:player` 후 `node scripts/qa-facility-player.mjs verified`로 같은 결과를 빌드된 `player.html`에서 검증한다. 출하 플레이어의 store shim을 그대로 쓰고 패키징할 번들 애셋만 `public/assets`에서 제공한다. 수백 개 Vite 개발 모듈을 반복 로딩하지 않는다. 산출물은 `output/evidence/facility-quality/verified/`, 런타임 판정은 `player/SUMMARY.md`부터 읽는다. 이는 게임으로 출하하거나 사용자 DB를 대체하는 콘텐츠가 아니라 생성기 회귀 QA fixture다.
- 회귀: `test/conceptFacilityComposition.test.ts`는 8종×3개 seed의 필수 가구 전체 셀, 사용자 가구 삭제 보존, 탁자·러그 묶음, 적재열·중앙 통로, 9개 상자 중 가운데 노획 상자의 실제 접근 가능성을 확인한다. 기존 여관·실내 패리티·실외 칩셋 거절 계약도 함께 돌린다.
