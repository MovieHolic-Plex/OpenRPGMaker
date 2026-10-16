# Romance first conversation authoring harness

`src/harnesses/romance-scene/` implements one bounded playable scene, using the canonical Project schema and existing runtime interpreter. It is not another engine or a general natural-language game compiler.

## Entry and contract

New-project interview choices must be romance alone, `activity=talk`, `progression=single`, `scope=scene`. The source brief is retained verbatim. Explicit supported name/place/two-choice forms are extracted from the latest edited summary first, then interview fields. Unspecified fields are labelled `temporary` in the internal contract; reference pictures do not define the protagonist or appearance. Arbitrary prose does not become enforced requirements automatically. Mixed genres and longer stories continue through the existing authoring route.

`gameDesignBrief.implementation` contains a registered `harnessId` and validated version-1 contract. It is optional for old projects, survives normal Project serialization and SQLite persistence, and remains internal to the assistant context. Eligibility is used only to prepare the new-project seed; completion gates require an explicitly activated contract, so an old matching interview is not newly blocked. `_core/authoringRegistry.ts` owns executable routing; the light manifest registry owns schema validation and CLI discovery.

The prepared single-map scene is playable immediately, with an existing temporary character sprite, first-choice variable, relationship variable, completion switch, branch-specific revisit pages, cancellation and ending. Its `_draft` page is explicitly incomplete. Startup saves before releasing the AI request and rebuilds the request from the prepared brief. It must not silently fall back to the old two-map skeleton on preparation failure.

## Authoring and rejection

While the seeded page is provisional, the production tool runner blocks other event/map/tile writes (planning `set_build_spec` remains available). The first builder must author the conversation before background construction, so visible playable progress does not wait for decoration.

`author_romance_scene` accepts opening, two reactions, two remembered revisit lines and closing. It preserves contract identities and choice labels. It authors native commands, then executes both branches before the ordinary tool runner atomically accepts the draft. Invalid arguments, identical reactions, inaccessible events or runtime failures leave the original project unchanged.

`inspect_romance_scene` walks from the real start position to the partner; it does not teleport or set expected relationship state. It executes both choices, repeated revisit, finish and cancel. It also serializes a real player save snapshot, restores it, and checks the remembered dialogue. This save-slot check is distinct from canonical SQLite project reload evidence.

Completion freezes the base contract and rejects changed/deleted contracts, changed source, identities or choice labels, unrequested protagonist sprite changes, extra maps, provisional pages, unchanged draft dialogue, missing/invisible sprite assets, equal reactions/memories, repeated gain, inaccessible events and unreachable endings. Inspection exceptions become blocking diagnostics. Team finish has no two-rejection bypass for this harness, and omission of a successful finish blocks the final result.

A successful current `review_map` is also mandatory. The read-only reviewer must receive an actual `show_map_region` PNG in a model tool response and submit `report_review` with no findings. The receipt is bound to the reviewed map/project content; subsequent content changes invalidate it. This is a model visual review, not a mathematical proof of art quality. Unsupported visual requirements and remaining findings must be reported honestly. Existing assignment repair budgets remain in force; no persistent TODO ledger is introduced.

## Art direction and compact dialogue (2026-10-04)

`artDirection.ts` adds the same 16-bit scene composition instructions to the assistant brief and the read-only map reviewer. It preserves user names, appearance and location; it does not impose the reference post-office layout on other games. The active romance reviewer must report `artChecks` for composition/place/materials/grounding/readability, each exactly once with `passed:true` and a concrete observation of at least 24 characters. Missing, duplicate, failed or empty evidence blocks completion even if the reviewer says `ok:true`. These receipts are observations from a model, not an objective beauty score, and cannot certify dialogue UI from a map-only PNG.

A narrowly bounded blank-ground check rejects a town interview when over 70% of the meeting viewport is bare stock Beodeul grass (737). It inspects at most 20×15 cells around the partner and includes both overlay layers. It applies only to the original bundled Beodeul texture, not an uploaded replacement/graft at that tile, other chipsets, or other experience choices. Passing this check does not prove composition quality; paved emptiness and repeated props still require visual rejection. Functional `author_romance_scene`/`inspect_romance_scene` remain independent so first dialogue can appear before scenery.

New relation/romance preset defaults use `pixel-cinematic`: square translucent charcoal panels, Galmuri9, compact 25% stage height. Existing authored cream/gold styles are retained. Explicit fonts/styles still take precedence. Long choices wrap and scroll inside the compact panel; keyboard selection scrolls that list only and accounts for the stage scale. Long prose uses native pagination. Actual `player.html` screenshots must accompany map review.

The earlier post-office art comparison was a **coding-agent authored reference scene**, not an AI regeneration success or a universal first-scene template. That manual refinement script has been removed; the stored historical project/evidence remains intact. Its save/reload and shipped-player evidence is indexed in `verify-shots/romance-art/SUMMARY.md` and must not be presented as maker automation proof.

## Maker-owned repair loop (2026-10-04)

The product must generate the scene from the confirmed interview. A coding agent manually improving an example project is not evidence that the maker improved. Fresh automatic evidence must retain the sent interview, provider events, AI-authored commits, unchanged user identities, and canonical save/reload; manual content edits invalidate that claim.

For a new-game request marked `장르 프리셋:` with an active authoring harness, production `review_map` now owns the rejection → builder repair → fresh image review loop. Each rejection consumes the existing per-map fix budget (maximum two); it uses normal map assignment, checkpoints, browser publication and persistence. The reviewer remains read-only. Failed repairs or exhausted budgets return an incomplete result and cannot receive `finish`. Scenery repair checkpoints and the final merge reject changes to the brief, map scope/start, protagonist identity/appearance, existing events, dialogue or choices before publishing them. Execution inspection is also run on the reviewed snapshot, so a visually approved repair that removes the conversation remains rejected. The current registered harness is bounded romance; this does not claim equivalent enforcement for every genre.

This loop does not run for later read-only review requests or ordinary follow-ups. Read-only requests cannot assign map writes. A review/repair holds the map against another writer or concurrent review and blocks project-wide writes and finish until it ends. Cancellation stops new repair assignments. An active harness still needs image evidence in YOLO; the ordinary non-harness YOLO route retains its skip behavior. Each mutation invalidates the prior whole-project review signature. Before any optional final narrative audit, the runtime checks the authoring receipt and execution contract. A verified first build reuses its mandatory current-image review instead of launching another narrative audit after accepted finish; ordinary follow-ups retain the configured final audit. This prevents a finished first scene from waiting on duplicate checks before terminal `done`.

The artist/reviewer instructions reject disconnected prop arrangements and paving that merely reduces the grass count. A location label or a generic shop badge is not evidence of the requested place. These are model observations, not an objective aesthetic guarantee. `scripts/qa/maker-art-repair.mts` injects a synthetic provider into production orchestration to check repair/pass, exhaustion, read-only/follow-up, cancellation, YOLO and broken event repairs. It is control-flow evidence, not live visual proof. `ROMANCE_QA_SPEC=<json>` configures the actual New Game interview QA without changing generated map content.

## Modern start stage and stage designation (2026-10-16 romance audit I2/I3/O1)

- **Where the scene opens.** A romance-alone interview (`interview.genre === 'romance'`, no secondary) now maps its stage to a start chipset in `startVariety.inferStartTilesetHint`: experience `campus` -> `modern_campus`; free text/notes with workplace/neighbourhood words (직장·카페·편의점·동네 …) -> `modern_city`; `palace` and word-less `town` keep the Beodeul start. A concept card's `타일셋:` line still wins. `StartPlan.composeKit` carries it.
- **Code builds the stage, not a flat 20x15 lawn.** `playableSegment.stageStartOnModernKit` (used by `withVerifiedPlayableSegment` before the harness seed) and `prebuildStartTown` (story-cutscene skeleton) call `composeKitStartMap`, which runs the real `compose_campus_grounds` / `compose_modern_city_street` tools on the untouched start map and starts the player at the composer's gate/sidewalk cell. `compose_campus_grounds` now calls `claimStartIfBlank` like the city composer (a new project's default start (10,8) was blocked and the commit was rejected).
- **The one-map rule is relaxed, its intent kept.** The contract's partner/place/choices/source stay frozen (inspect compares the contract with `mapId` ignored). The **stage is the start map**; other maps may exist as long as they are reachable from the stage through `transfer` doors (campus/city interiors). A map with no door path from the stage (a leftover seed map, an abandoned `create_map`) still rejects: `무대와 문으로 이어지지 않은 맵`. New tool `set_romance_stage {mapId, x?, y?}` moves the partner event, the start map/pos and the contract `mapId` to another existing map; the old map must then be removed (or linked). It is allowed before the first conversation is authored (prerequisite whitelist in `toolRunner.ts`).
- **Partner cell.** `partnerCell`: two cells east of the start if passable (identical to the old behaviour on a lawn start); on composer-built maps the nearest walkable cell about 4 steps from the start (the start sits at the gate, the cell two east is the crosswalk).
- **Flat-ground gate.** `romanceStageFlatFindings`: any chipset, the 20x15 viewport around the partner, >90% one floor tile and <5% upper/overlay tiles -> finding. It blocks the **finish** verdict (`judgePlayableSegment`) and the team review (`piTeamRuntime`), not the draft seed (the conversation is written first, then the place). `visual-flat` in `qa:game check` stays a warning.
- Evidence scripts: `scripts/qa/romance-fix/` (`seed-probe.mts`, `stage.mts`, `route-proof.mts`, `sqlite-roundtrip.sh`) and `scripts/qa/runtime/romance-fix-stage.scenario.mjs`.

## Reproduction

```bash
npm run harness -- romance-scene inspect --project <hydrated-project.json>
node scripts/qa/romance-scene-contract.mjs <baseline.json> <proof.json>
node scripts/qa/romance-scene-live.mjs
node scripts/qa/romance-scene-package.mjs <canonical.json> output/qa/romance-scene/package <owned-host-url>
ROMANCE_QA_PACKAGED=1 ROMANCE_QA_PACKAGE_DIR=output/qa/romance-scene/package node scripts/qa/romance-scene-player.mjs output/qa/romance-scene/package/project.json <evidence-dir>
node scripts/qa/romance-scene-review.mjs <hydrated-project.json> <owned-host-url> <evidence-dir>
```

The focused contract script checks production tool dispatch, atomic rejection, schema roundtrip, native runtime paths and adversarial variants. Live QA uses a dedicated host/root, normal New Game interview, real provider, and host persistence. Authored tiles require reading the current canonical reference documents/images first. Game browser evidence must use the dedicated `player.html` QA server, never the editor play shell. Do not confuse fixture execution or JSON roundtrip with live provider success or SQLite reload.

Actual evidence is indexed in `verify-shots/romance-scene/SUMMARY.md`. The final automatic project completed without human content repair; a software-renderer page error prevents calling the full editor UI audit error-free. Package browser QA includes real exported dependencies and disables opening only on an explicitly labelled scene QA copy.

## 하루 루프 뼈대 `system.socialLoop` (2026-10-16, 현대 연애 병목 감사 2번)

옵트인이다 — `system.socialLoop` 이 없으면 동작·저장 바이트가 그대로다(`databaseRecordModel.ts` 화이트리스트에 있어야 저장·불러오기 왕복에서 살아남는다).

- **데이터**: `system.socialLoop?: { slotsPerDay?: 1..12(기본 3); dailyFriendshipCap?: 기본 20 }`, 세션 `session.socialLoop`(오늘 쓴 칸·사람별 오늘 얻은 호감, 날이 바뀌면 다음 대화에서 새로 시작). 정본 `src/project/socialLoop.ts`.
- **판정은 `trySocialTalk(session, event, project)` 한 곳**(`friendship.ts`): 호감이 오르는 대화(`talkFriendship`)가 시간대 한 칸을 쓰고, 한 사람에게서 하루 합계에 상한이 있다. 상한을 채운 사람과 또 말하면 호감은 0 이지만 칸은 쓴다(플레이어가 갇히지 않게 거절하지 않는다). 칸이 없으면 `no-slots`.
- **시계**: 칸 하나 = 하루 길이 ÷ 칸 수만큼 시계가 간다(`player/socialSlotClock.ts`, 하루 끝 1분 앞까지만). 마지막 칸을 쓰면 `forceSleep` 이 켜져 있을 때 하루가 저물어 `playSceneInterpreter.runTalkPath` 가 `sleepUntilMorning` 을 부른다 → `timeSystem.onDayEnd` 공통 이벤트(기한 엔딩)가 돈다. 자연 시계가 같은 순간 먼저 강제 취침을 걸어 열린 피드백 대사를 가져가는 경우(`Text cancelled`)는 정상 흐름으로 삼킨다.
- **헤드리스 같은 규칙**: `sceneTestRunner.applySocialTalkForRunner`(대화 호감)·`runDayEndHookForRunner`/`sleepUntilMorningForRunner`(잠). `qa:game check` 가 같은 루프를 본다(별도 PR).
- **도구**: `place_npc` 의 `talkFriendship`(호감 대화 켜기) — 모르는 키는 조수 실행에서 거부(`toolRunner` strict keys, 말없이 버리지 않는다). `set_deadline_ending`(`endingTools.ts`): 「N일 뒤 결말 판정」 한 줄 — 공통 이벤트 `ce_deadline_ending` + 변수 `var_days_elapsed` + `timeSystem.onDayEnd` 를 한 번에 깔고, 엔딩 조건 `friendshipAtLeast`(npcKey, value)를 쓴다.
- **런타임 QA**: `npm run qa:runtime -- --scenario romance-loop`(대화 3번→하루 저묾→이튿날 아침 호감 유지) · `romance-loop-end`(기한 1일 → 「친구로 남는 결말」 에필로그 → 엔딩 화면). 픽스처는 `scripts/qa/romance-fix/loop-fixture.mts`. SQLite 왕복 `scripts/qa/romance-fix/sqlite-roundtrip-loop.sh`(시험 프로젝트에만).

## 연애 인터뷰 기본값 (2026-10-16, 5번)

`src/project/romancePreset.ts` `applyRomanceDefaults(project)` — 인터뷰 장르가 `romance` 일 때만(결정론, 이미 있던 설정은 건드리지 않는다): 시간 시스템(0.1분/초·강제 취침), `socialLoop`, 호감 하트 HUD(`fieldHud` 위젯 소스 `friendship`·`socialSlots` 추가, 글자·CSS 만), 타이틀 배경(`oprn-still-moon-meadow` — 새 그림 없음, 눈 덮인 마을 기본값 대체), 장르 잠금 `romance`(`genreLock.ts` `GENRE_LOCK_PRESETS.romance`: 허용 계열 oprn-campus/oprn-modern/oprn-jp, 몬스터 잠금 #2625 과 같은 구조, 조수 실행에서만 강제). 호출처: `projectInterviewStartup.ts`·`welcomeGenreSystemPresetAction.ts`.

## 다인 루프 뼈대 · 2차 수리 (2026-10-16)

모두 선택 `socialLoop` 안쪽이다 — 저장 바이트·다른 장르 불변. 새 그림 없음(타이틀은 별도 PR, 아래).

- **HUD 호감 목록**: 위젯 `kind:"party"`·`source:"friendship"` 은 호감이 기록된 사람이 둘 이상이면 「이름 + 하트」 줄 목록(`fieldHudData.ts` friends 분기·`fieldHudRender.ts` `hud-rel-row`·`fieldHud.css`), 한 명이면 예전 게이지 하나. 표시 상한은 `socialLoop.ts` `friendshipDisplayMax(project)`(socialLoop 켠 프로젝트 = 100, 아니면 기본 1000 단계). 이름은 `friendship.ts` `friendshipDisplayName`(프로필 `displayName` → 이벤트 `name`).
- **ESC 관계 탭 버그**: 「관계」 는 접힌 묶음(기록) 아래 항목이라 `renderMenu` 가 「available 에 없다」며 items 로 되돌렸다 → `listStatusMenuCommandIds` 에 있으면 허용(`playerStatusMenuController.ts`).
- **`set_deadline_ending` 인물별 문턱**: `tiers[].characterId` — 다인 연애에서 「그 사람 호감이 문턱 이상 → 그 사람과의 결말」, 위에서부터 처음 맞는 항목이 이긴다.
- **시간표에 요일은 없다**: `NpcScheduleWhen` = timePhase·hourRange·season·dayRange. 요일마다 다른 만남은 NPC 이벤트 페이지의 `weekday` 조건(0=일..6=토, 시작 월요일)으로 나눈다. 「일일 이벤트 풀」 = 페이지 풀(요일·호감 조건), 무작위 프리미티브는 없다 — 결정론이다. 도구 설명 오기(「요일은 GameTime에 없으므로」)를 고쳤다.
- **`talkFriendship` 인물은 기본 제자리**(`eventTools.ts` `resolveSocialNpcMovement`): 이름 추론이 배회(random)로 두면 시간표 자리에 서 있어야 할 사람이 칸을 벗어나고 한 칸 폭 길을 막는다. 배회는 `movement:"random"` 명시. `make_villager` 는 새 이벤트에 `name` 을 단다(없으면 HUD·ESC 가 characterId 를 보였다). 호감 대화·피드백의 말하는 이름은 상태 페이지 제목이 아니라 이벤트 이름(`characterProfiles.ts` `resolveCharacterSpeaker`).
- **`qa:game check` 가 기한 엔딩을 걷는다**(`src/qa/gameCheck/deadline.ts`): `runAutoPlay` 의 목표는 맵 이벤트 페이지 안 `triggerEnding` 뿐이라 `onDayEnd` 공통 이벤트가 고르는 기한 엔딩은 걸어 본 적이 없다(문턱을 400 으로 막아도·엔딩이 하나도 안 닿아도 「막힘 0」). 이제 인물 한 명에게 집중하는 판들 + 아무도 안 만나는 판을 헤드리스 러너로 끝까지 돌려 어떤 엔딩이 닿는지 센다. 어느 판도 못 닿으면 막힘 `deadline-ending-unreachable`, 정의된 엔딩 중 안 닿은 것은 경고 `deadline-ending-unplayed`(집중 판은 휴리스틱이라 막힘이 아니다). 한계: 말 걸기 호감만 쓴다(선택지로 올리는 문턱은 맵 목표 쪽 자동 플레이).
- **프로브·시나리오**: `scripts/qa/romance-fix2/` — `multi-fixture.mts`+`runtime/romance-multi`(3인·시간대 위치·요일 페이지·ESC 관계 21비트), `playthrough.mts`(인물별 끝까지 플레이), `run-proof.mts`+`runtime/romance-run`(조수가 지은 한 편의 캡처), `save-reload.mjs`(시험 SQLite 폴더 저장→재로드), `assistant-runs/`(조수 대용 3판의 도구 호출 목록).
- **타이틀 = 후보 C 확정**(옥상 노을, 교복 둘이 난간에서 교정을 내려다봄): 생성형 큰 그림 한 장, `ROMANCE_TITLE_RESOURCE_ID = "oprn-title-romance-campus"`(별도 PR #2676, 노부부 벽난로 그림을 대체). 사용자에게 고르게 하는 단계는 없다.

## 엔딩 분기 · 호감 통일 (2026-10-16 romance-fix-4, R01/R02)

실제 Argon 재측정(romance-real-2)에서 3판 모두 엔딩 1개였고(호감과 무관), 선택지 호감(변수)과 ESC·HUD 호감(engine friendship)이 따로였다.

- **「가장 가까운 사람」 키 `*`**: `friendshipAtLeast.npcKey === "*"`(`session.ANY_FRIENDSHIP_KEY`, `friendshipValueOf`)는 기록된 모든 사람 중 최고 호감을 읽는다. 인물을 아직 모르는 뼈대 엔딩이 누적 호감으로 갈릴 때 쓴다. `changeFriendship` 의 npcKey 로는 못 쓴다(무시).
- **연애 뼈대 엔딩 셋** (`playableSegment.ts` ROMANCE_SKELETON.branchEndings, 상수는 `playableSegmentContract.ts`): `ending_romance_happy`(≥60, priority 20) · `ending_romance_normal`(≥25, priority 10) · `ending_first_segment`(조건 없음 = 혼자, 기본). 구간 끝 이벤트(`ev_segment_end`)는 **endingId 없는 triggerEnding** 으로 불러 조건·priority 가 고른다 — 마지막 선택지가 결말을 정하지 않는다. `judgePlayableSegment` 는 연애 뼈대에서 이 셋 중 어느 엔딩에 닿아도 합격으로 본다(`isRomanceSkeletonProject`).
- **기한 판정 기본 설치**: `applyRomanceDefaults` 가 뼈대 엔딩이 있고 `onDayEnd` 가 비었으면 `installDeadlineEnding`(14일, `src/project/deadlineEnding.ts` 순수 함수 — `set_deadline_ending` 도구와 같은 몸통)으로 같은 세 문턱을 건다. 하루 루프가 결말로 이어진다.
- **`set_deadline_ending`**: `tiers` 생략 시 뼈대 세 엔딩 사용, `characterId:"*"` 허용. 히로인별 결말은 `define_ending` 후 tiers 맨 위에 `{endingId, friendshipAtLeast, characterId}` 로 얹는다.
- **호감 변수 읽기 호환** (`src/project/affectionVariables.ts`): 이름이 「인물 호감도」 모양(예: 「윤서연 호감도」)이고 그 인물이 프로필 displayName·이벤트 이름으로 하나로 정해지면, 런타임 `setVariable`(commandCatalog)이 변수의 **변화량(Δ)** 을 그 인물 `friendship` 에도 더한다 → 선택지가 올린 호감이 ESC 관계 화면·호감 HUD·`friendshipAtLeast`·엔딩에 그대로 반영된다. 변수 자체와 변수 조건은 그대로 동작한다. 인물을 못 정한 호감 변수는 `romance-affection-variable-unmapped` 경고(완료 조건). 정식 경로는 `changeFriendship({npcKey, delta})` 다(조수 지시문·`schemaShapes` 가 그렇게 안내).
- **검사** (`src/qa/gameCheck/romanceEndings.ts`): `romance-endings-unbranched`(호감으로 갈리는 엔딩 <3), `romance-ending-shadowed`(어떤 호감 상태에서도 못 이기는 엔딩), `romance-endings-not-per-heroine`(호감 대화 인물 ≥2인데 엔딩이 특정 인물을 안 겨눔). 모두 `romanceCompletionGaps`(finish 게이트) 대상. 기한 엔딩 자동 플레이(`deadline.ts`)는 인물 집중·아무도 안 만남에 더해 **호감 문턱 상태(딱 문턱 / 한 칸 모자람)에서 시작하는 판**을 돌려 문턱 엔딩을 하나씩 연다. autoPlay 는 `*` 키를 인식하고, 이름 없는 triggerEnding 의 목표를 호감 문턱 없는 기본 결말로 둔다(`bareEndingTarget`).


## 제목 · 완료 게이트 · 엔딩 화면 작은 줄 (2026-10-16 romance-fix-4, R03/R05/R08)

- **완료 게이트가 채팅 한 줄 경로에서도 걸린다 (R03)**: `romanceCompletionGaps(project, { task })` 는 인터뷰(`gameDesignBrief`)가 없어도 요청 글이 연애 게임 제작이면(`isRomanceGameRequest`: 연애·로맨스·소개팅… + 만들기 + 게임) 연애 프로젝트로 본다. 단일 에이전트는 `PiRomanceProduction`(`src/ai/piAgent/romanceProduction.ts`, `piAgentRuntime.ts` 완료 루프), 팀은 `piTeamRuntime.ts` finish 의 독립 블록(`romanceRejections < 2`, 구간 게이트와 별개)이 같은 목록으로 돌려보낸다. 새 완료 코드: `romance-default-subtitle`(「마음이 닿는 계절」 그대로), `romance-title-art-mismatch`. 도구 이름은 `set_title_screen`(`configure_title_screen` 은 없다).
- **제목 그림 잠금**: 연애 잠금 프로젝트에서 조수가 제목 배경을 연애 허용 목록(`romanceTitleArt.ts` `ROMANCE_TITLE_BACKGROUNDS`) 밖의 번들 그림(농장 등)으로 바꾸면 `toolRunner.ts rejectRomanceTitleMismatch` 가 `romance-title-art` 로 거절한다. 사용자가 올린 그림은 막지 않는다.
- **긴 제목 (R05)**: `title.css` 의 제목 `max-width` 가 제목 왼쪽(`--title-left`, `titleScreen.ts` 가 설정)에서 오른쪽 가장자리까지만 쓰고 줄을 바꾼다.
- **엔딩 화면 위 작은 줄 (R08)**: `EndingPresentation.kicker`(≤24자, `define_ending.presentation.kicker`). 비우면 연애 프로젝트(`usesRelationshipMenu`)는 「두 사람의 이야기」, 어두운 톤은 「이야기의 끝」, 나머지는 「우리의 여정」.



## HUD 가림 · 짧은 이름 (2026-10-16 romance-fix-4, R06/R09)

호감 목록·남은 시간 판은 값이 바뀐 뒤 3초만, 시계는 모서리 칩 — 평소 지도·실내 위쪽을 덮지 않는다(자세한 건 `editor-ai-tools.md` 의 romance HUD 항목). 이름 줄임은 `friendshipShortName`(괄호·앞 직함 제거). 옛 기본 HUD 로 저장된 프로젝트는 `applyRomanceDefaults` 가 새 배치로 바꾼다. 못 고친 것: HUD 가 가린 실내 위쪽의 수리 후 캡처(야외 픽스처만 측정), R09 id 중복 인물(HUD 만 해결), R10 ESC 「타이틀로」 겹침.


## 남은 결함 수리 (2026-10-17 fix-leftovers, romance-real-2 R04/R07/R10/R12/R14/R15)

- **R04 팀 시간 상한은 팀 전체 벽시계다.** `PiAgentRequest.timeoutMs`(없으면 `PI_AGENT_DEFAULT_TIMEOUT_MS`)는 예전엔 팀장·시공·검수·첫 플레이 검토가 **각자** 통째로 받았다(최악 +수 배, 실측 1380초 상한에 1611초). `piTeamRuntime.ts child()` 는 이제 `teamTimeoutLeftMs(상한, 팀 시작, 지금)`(바닥 1초)만큼만 하위 에이전트에 준다. 장기 목표(goalCampaign) 45분은 에이전트마다 따로 쓴다. 증거 스크립트 `scripts/qa/fix-leftovers/r04-team-timeout.mts`(상한 3000ms 가짜 실행기: 수리 전 팀장·시공·검수가 각자 3000ms 를 받아 최악 종료 +6779ms, 수리 후 팀장 2998·시공 1722ms 로 줄어 +3070ms 에 맞고, 상한이 이미 지난 뒤 시작한 검수는 1초 바닥만 받는다).
- **R07 대사 본문의 화자 이름.** `src/project/dialogueSpeakerEcho.ts stripSpeakerEcho(body, speaker)`: 이름표와 같은 이름(또는 「서연 (소꿉친구 반장)」→「서연」 같은 줄임)이 본문 맨 앞에 「이름:」·「[이름]」·「【이름】」 로 또 붙으면 재생(`player/dialogue.ts showText`)이 걷고 바깥 따옴표도 벗긴다. 다른 이름·본문 속 인용은 건드리지 않는다. `romance-speaker-in-body` 검사도 같은 함수로 「이름:」 형을 잡는다(저작 데이터는 깨끗해야 한다는 경고 문구 유지).
- **R10 ESC 「타이틀로」 겹침.** 도트 스킨 명령 창 높이가 94px 고정이라 7항목(호감도·일정·소지품·저장·불러오기·설정·타이틀로) 연애 메뉴의 마지막 항목이 창 밖으로 나갔다. `playerStatusMenu.ts` 가 `--status-menu-command-count` 를 박고 `pixelWindows.css` 의 `--px-dock-h = max(94px, 항목수×14+8)` 로 높이를 정하며 아래 돈·장소·시간·장 창은 그만큼 내려온다. 6항목 이하는 이전과 같다.
- **R12 아침 06:00 어두움 — 재현 안 됨.** 시간대 틴트는 06~10시 「아침」 0.08 알파뿐이다. 실제 어둠은 날이 바뀌는 `sleepUntilMorning` 의 페이드 인 중에 찍힌 것(소프트웨어 GL 에서 3초 넘게 걸림): 같은 장면이 60프레임 뒤 밝다(`scripts/qa/runtime/romance-r12-fade.scenario.mjs`, 평균 밝기 18.9 → 122.9). 상시 어둠 결함이 아니라 코드를 바꾸지 않았다.
- **R14 선택지 이벤트가 투명.** `romance-choice-event-invisible`(경고, 완료 조건은 아님): 선택지(`choices`)가 달린 action 이벤트가 그림 없는 투명 이벤트이고 물건 타일도 없는 빈 바닥이면 짚는다(약속 게시판·에스프레소 머신 주문서 — 실제 Argon 산출물 2판에서 잡힘).
- **R15 짝 얼굴 없는 칩.** 얼굴이 없으면 대사창은 얼굴 칸 없이 본문이 전폭을 쓴다(캡처로 확인, 별도 폴백 코드 없음).
- **429 자동 재시도(연애·JRPG 공용).** 팀 finish 는 429 로 끊긴 채 같은 맵에 다시 맡겨지지 않은 배정(`rateLimitedUnresolved`)이 있으면 제공자 쿨다운(`retry-after-ms`, 없으면 60초, 최대 330초)만큼 쉰 뒤 같은 맵·같은 task 로 **한 번** 다시 맡기고(`retryRateLimitedAssignments`) 끝나면 이어서 finish 검사를 한다. 팀 남은 시간이 쉬는 시간+120초 미만이면 건너뛴다. 다시 429 면 기존 가드(팀장에게 되돌려 재배정, #2752)가 그대로 걸린다. 증거: `scripts/qa/fix-leftovers/team-429-retry.mts`.
- **못 고친 것.** R11(맵 구도: 아스팔트 띠·봄에 가을 나무·NPC 밀집은 모델의 배치 판단이라 코드 규칙으로 고칠 수 없다), R13(연애 전용 도구를 안 쓰는 것은 모델 선택 — 지시문 효과는 실 Argon 재측정으로만 판정), R16(측정 한계).
