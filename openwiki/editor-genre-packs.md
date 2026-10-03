# Editor Genre Packs

Genre packs are editor-side authoring guidance over the single canonical `Project` schema and the single player runtime. They are not alternate engines or schema variants.

## Ownership

- `src/project/genrePackId.ts` owns the six persisted IDs: `adventure-jrpg`, `monster-collect`, `horror-chase`, `story-cutscene`, `farm-life`, and `action-rpg`.
- `src/editor/genrePacks.ts` owns the machine-readable registry: starter, navigation, vocabulary, recipes, lint mappings, journeys, and runtime requirements.
- `src/editor/newProjectChoices.ts` owns the eight first-class new-project choices (label, blurb, art, tone, poster caption, featured tier, row art) and the order contract. It is the single source both surfaces derive from.
- `src/editor/welcomeGenrePresets.ts` maps all eight welcome presets to a real pack and blank-project system-preset recipe. The first-screen briefing and the new-project dialog show only three start choices (`monster-collect`, `story-cutscene`, `adventure-jrpg`). Horror, farm, partner-raise, and action-RPG stay in the choice catalog for existing projects and tools, and are not mounted on either start surface. `buildWelcomeGenrePresetPrompt` remains an optional AI enhancement; it is not the pack contract.
- `src/editor/welcomeGenreSystemPresetAction.ts` is the project-creation boundary shared by AI posters and confirmed manual system presets. It adopts the detached seed into the SQLite folder already opened by the shell, then requires `store.flush()` to return `saved` before releasing an AI intent. It does not create a LegacyDb row or provide transactional rollback.
- `src/project/genrePresets.ts` only applies standard `system.*` opt-ins. Player/runtime modules must not switch on `system.genre`.

`src/project/genrePackId.ts` is also the Phase 4 SSOT. Phase 4 code must import `GenrePackId`, `GENRE_PACK_IDS`, and `isGenrePackId` from that module. Welcome ids such as `horror-gallery` and `school-horror` are recipe/card ids mapped to canonical `horror-chase`; they are not aliases that persistence may accept.

## Safe blank-project system-preset flow

`action-rpg` selects `action-system`, enabling only `system.actionCombat`.
It never enables every map. The author opts in each intended arena via map
properties or `set_action_combat({enabled:true,mapId})`; other maps retain their
existing combat routing. The new-project dialog uses the same registry. The
action welcome prompt uses `actionArenaAuthoring.ts`, not the generic NPC/item
checklist. Static configuration checks system/map opt-in, a spawn whose first
troop enemy has an action profile, lint errors, and reference integrity.
It does not certify real combat playability.

`adventure-jrpg` selects `adventure-system` (2026-09-26). Before, it applied only
`system.genre`, so the gear (no AI) produced a blank project with a label. It now
fills `battleParty: "actors"`, `menuUiStyle: "party-first"` and `companions {maxCompanions:3, formation:"line"}`
only when those fields are empty (`??=`), so applying the poster to an open
project keeps an author's choice. The battle method stays the default pixel side
view — it no longer writes `battleUiStyle` (2026-10-02). Requirements add `battle-troops`, `lint-errors`
and `reference-integrity`. Evidence: `verify-shots/gap-fixes/c1-before.json`,
`c1-after.json`, `c4-report.json`.

`createGenreBlankProjectSystemPresetPlan(packId, recipeId)` validates a selection without touching project state. Recipes declare `starterKind: "blank-project-system-preset"` plus the exact shared `system.*` fields they apply; they do not carry fictional executable adapter IDs. `materializeGenreBlankProjectSystemPreset(plan)` returns a detached `createBlankProject()` on the normal `Project` schema with the selected `system.genre` and shared system opt-ins. `authoredContentSeeded` is always `false`: a card label such as adventure village, gallery horror, or farm life is inspiration, not a promise that authored maps/events/records exist.

The live welcome DOM keeps AI creation and manual system setup separate. Choosing an illustrated poster only previews a scene and opens the first-sentence composer. Explicit submission passes the original sentence through the connection gate to the shared interview, then awaits `applyWelcomeGenreSystemPresetPlan` through `applySystemPreset(plan, brief)`. The detached seed includes the confirmed brief before adoption. The shell already owns the target SQLite folder; the action replaces the in-memory project and requires a successful flush before focusing the start map or releasing an AI prompt. A failed save keeps welcome visible with an inline alert and never starts generation; the candidate may already be in memory. The visible “AI 없이 직접 만들기” action keeps an explicit confirmation, applies only the system preset, and returns no AI prompt. Free-text input without a genre uses the current project.

Controls (including keyboard input) are blocked during the interview and saving. Cancelling the interview is a no-op. `finishEditorBoot` applies the selected engine settings before handoff; `applyWelcomeGenrePresetToOpenProject` skips the fixed world-canon seed whenever a confirmed game brief exists, so a horror collection game does not regain the default hopeful/fairytale tone.

**AI handoff ordering:** the menu's new-project seed carries `gameDesignBrief.generationPending: true` into `createProjectFolderWithSeed`. The bridge creates the folder and the page reloads. The new project's boot saves its preparation while keeping this marker, waits for authentication status, then queues the full prompt. Disconnected AI gets a short visible draft with hidden full instructions; connection recovery automatically resumes the same confirmed brief. The execution route claims and saves the marker before capturing its proposal base. A transport failure before worker startup restores and saves the marker; an accepted build is not automatically repeated on reload. The panel awaits `whenAiChatPanelSettled()` and an idle turn slot before classification. Scope checks stop an old handoff after project switching. Do not send to the old store before the folder reload.

## Preset AI connection gate and first team build (2026-09-27)

- Both preset entrances (welcome first-sentence submission, the 새 프로젝트 genre) call `ensureAiConnectedForPreset` from `src/editor/ui/aiConnectGate.ts` **before** the interview. Welcome poster selection alone does not call it. It refreshes companion status first; if connected it returns immediately with no UI. Otherwise an alertdialog (「AI 를 먼저 연결해 주세요」, 팀장·시공·검수 roster, current status line) offers 「나중에」 (stay on the start surface) or 「AI 연결하기」.
- 「AI 연결하기」 hides the gate, opens AI settings above app modals, and waits for `AI_SETTINGS_CLOSED_EVENT`; then it refreshes again and either resolves `true` (interview continues) or reshows the gate with 「아직 연결되지 않았어요」. Arm the wait **after** `openAiSettingsModal()` — it calls `closeAiSettingsModal()` first, which fires the closed event even with no modal open.
- The gate is injected (`EditorWelcomeOptions.ensureAiConnected`, `NewProjectDialogOptions.ensureAiConnected`), so component tests without it keep the old flow. The ⚙ system preset, blank project, and free-text welcome input do not pass the gate.
- The first preset build runs as a team for that one turn: `setPendingAiBootIntent(..., { team: true })` → `AiBootIntentTarget.send/prefill(text, display, { team: true })` → `plainPiTurn(text, { team: true })` → `classifyPlainPiTurn({ piTeam: true })`. `AiConfig.piTeam` is unchanged, so later requests stay single unless the user turns team on. A prefilled draft keeps the team flag through `composerHandoff.team` only while the visible text is unchanged; read-only dials and village contracts still demote to single.
- Browser evidence: `scripts/capture-preset-ai-gate.mjs` → `verify-shots/preset-ai-connect-gate/SUMMARY.json` + PNG (companion `/auth/status` stubbed signed-out then signed-in; no model calls or project writes).

## Playable first segment — code builds it, code judges it (2026-09-28)

AI-only preset first builds could not be finished: of 24 live runs on 2026-09-27, none reached an end. The largest (17 maps) had no ending; the 4-map run had three unlinked empty maps, no starter and no capture item (`runGameCheck`). The segment is therefore guaranteed by code, not by the prompt.

- `src/project/playableSegment.ts` builds a skeleton for the three start-surface genres with the real editor tools (`runTool`). All share: key action on the start map (`ev_segment_starter`, sets `sw_segment_key`) → door east (`create_transfer_pair`) → `map_segment_route` → `ev_segment_end`, which opens only after the key switch and calls `triggerEnding ending_first_segment`.
  - monster-collect: professor via `give_starter_monsters` (switch spliced after each `giveMonster`), five `item_capture_orb` in the starting inventory, route via `author_wild_route` with a grass-only Lv3 wild slime `troop_segment_wild` (species formula — the default `troop_slime` beats a Lv5 starter).
  - adventure-jrpg: village chief quest, random encounters on the route, and a `canLose:false` gatekeeper battle (`troop_slime_pair`, 5/5 simulated wins for the Lv1 hero) before the ending.
  - story-cutscene: a memory object to inspect, then the far end.
- `judgePlayableSegment` passes only when `runGameCheck`'s headless autoplay reaches `ending_first_segment`. Any other ending is not a pass. It proves start → partner → route → segment end is walkable; it does not judge fun or looks.
- Runner fix found by this gate: `sceneTestRunner` used to keep executing an event after a lost `canLose:false` battle, so an ending behind an unbeatable gatekeeper counted as reached. It now stops the event there, like the shipped player (`playSceneInterpreter`).
- Seeding: `withVerifiedPlayableSegment` runs in `prepareProjectInterviewStartup` (menu and desktop start screen) and in `applyWelcomeGenreSystemPresetPlan` when a brief exists (welcome poster). The ⚙ system preset (no brief) never gets a skeleton. A skeleton that fails its own judgement is not planted.
- Contract: `playableSegmentContract()` (`playableSegmentContract.ts`, no heavy imports) is added to the builder system prompt and the orchestrator prompt when the project has the skeleton.
- Gate 1, team runtime (`scripts/lib/piTeamRuntime.ts`): for a `장르 프리셋:` task on a passing skeleton, `finish` is rejected with the blocker list up to two times.
- Gate 2, browser (`aiPiAgentCommand.ts`): the final merged result, and the partial live result of a failed or stopped run, is judged. On failure nothing more is applied; already published live checkpoints are reverted to the passing start state with `applyProjectWithHistory` (undo brings the AI result back), unless the user edited the project during the run.
- Both gates are limited to the preset first build. Later requests may move or extend the segment freely.
- Genres without a skeleton (farm, horror, partner, action) keep the previous AI-only flow and are not gated.
- Regression: `test/playableSegment.test.ts` (reload pass, cut end/door/starter fail, other genres untouched). A bun probe with a stub team verified finish rejection then acceptance after repair. Not verified: a live model run through the gates.

## Cinematic interview in the actual app (2026-10-03)

- Before the interview, `src/start/firstWorldArrival.ts` supplies the same world-preview stage to first-time launcher Home, launcher New Game, and editor welcome. The three engine choices remain canonical. Choosing one changes the reference background and focuses a local first-sentence draft; only explicit submission starts connection/planning. Welcome passes that draft as `initialAnswer` and preserves it on connection/interview cancellation. Later interview choices may change or mix author genres and determine the confirmed engine. Image characters and scenes remain references, never authored project content.
- `src/editor/ui/projectInterviewDialog.ts` is the production interview, shared by menu creation, welcome posters, launcher handoff, and saved-brief editing. New Game opens AI planning by default; examples and blank projects remain under “시작 방식 다시 고르기”. The launcher still creates/opens the SQLite folder before the editor's connection gate and interview; its lightweight bundle does not import editor/AI code.
- Four author-facing genres: relationship/romance, monster collection/growth, adventure, mystery. No life/management option. `projectInterviewScenes.json` owns five questions and three illustrated choices per genre; `cinematicInterviewQuestions.ts` maps them onto existing brief slots. Genre mixing adds an explicit connection question. Custom concept/answers, recommendation provenance, back/edit, cancellation, and editable final summary remain local drafts until confirmation. No automatic AI extraction is performed in this new choice-driven flow; the full original concept is preserved for the assistant.
- Every preset click cuts to a reviewed pixel-art scene. `public/assets/project-interview/` ships 45 WebPs and the user's world-map video/poster; `reviews.json` records reviewed-original and shipped hashes. Image preloading uses a request token to discard late responses. Motion toggle, reduced-motion default, image failure fallback, modal-stack Escape, focus restoration and tab containment are supported. Image characters never define the protagonist.
- `Project.gameDesignBrief` remains version 1 with optional `interview` metadata, validated by `project/gameInterview.ts`: author genre, secondary genre, original concept, protagonist, notes, choice IDs, and blend answer/source. Legacy briefs stay valid and reopen through `legacyProjectInterviewDialog.ts`, preserving old question wording and the legacy free-text extraction path. Do not reinterpret an old transcript as new preset choices.
- Engine preset is separate from author genre: any monster component uses `monster-collect`; otherwise any adventure component uses `adventure-jrpg`; romance/mystery use `story-cutscene` with their own author instructions. Menu, welcome plan, and launcher defaults all follow the **confirmed** engine. On launcher genre change only the fresh seed's system defaults are replaced; maps, project identity and selected viewport stay intact. Saved-brief editing restricts engine changes rather than silently changing a running project.
- Only direction/answers/summary appear in the confirmation screen. The detailed execution contract is derived internally by `gameDesignBriefContext`, passed to the assistant after the existing save-first `generationPending` handoff. The newest edited summary takes priority. Changing answers after editing a summary blocks confirmation until the author refreshes or edits that summary; no stale handoff. Choosing a new preset never itself starts a model call.
- `프로젝트 → 게임 기획...` still saves edits with a snapshot and prefills the composer without auto-send. The assistant must adapt placeholder skeleton characters/actions to the confirmed concept while preserving first-segment reachability; it must not treat reference pictures or engine defaults as author decisions.

Browser evidence: `verify-shots/cinematic-interview/` and `scripts/capture-cinematic-interview.mjs` exercise the real production components in isolation: menu → mixed interview → confirmed engine/brief, four genre branches, custom answer/recommendation provenance, stale summary, reopen/cancel/focus, narrow viewport and reduced motion. No live model or canonical content writes; JSON normalization is not SQLite reload evidence. Those regressions were initially authored under the session test restriction. The user explicitly authorized execution on 2026-10-03; focused tests and actual-app checks are recorded in `verify-shots/interview-adversarial/validation.json` and the three `interview-*` evidence folders.

First-sentence browser evidence: `verify-shots/first-world-arrival/`, generated by `scripts/capture-first-world-arrival.mjs`, covers preview-only selection, explicit launcher handoff, draft retention on connection/interview/create cancellation or failure, confirmed engine changes, manual save waiting, returning-author continuation, narrow viewport, reduced motion and en/ja/zh. Bridge and save callbacks are isolated; no live AI or canonical SQLite writes.

Full-window correction: `verify-shots/first-world-fullscreen/` uses the same capture with `FIRST_WORLD_CAPTURE_DIR`. The scene spans the viewport behind launcher/editor chrome; owners provide the isolated stack and the shared scene uses a fixed background. Cards and the dark composer remain bounded within that scene. Browser evidence checks all four edges at 320×780, 1280×720, 1440×900 and 1920×1080, plus no desktop scroll at 1280×720 and 1440×900. Captures show the actual viewport rather than stitching a scrolling page.

### Internal execution handoff (2026-10-03)

Actual-folder QA found the first AI checkpoint rejected as `stale-base`: the post-boot shared-reference refresh changed four tilesets after the run captured its base. `src/main.ts` registers a shared preparation promise in `projectInterviewBootPreparation.ts`; pending-folder startup and the preset `runPiCommand` await it before claiming/saving/capturing. Welcome's direct preset route also confirms a canonical flush before capture. Project switching during the await stops the old handoff; unrelated live edits still invalidate proposals. This orders boot-owned mutations rather than relaxing the application gate.

Actual-app QA evidence: `verify-shots/interview-desktop/` covers the Electron launcher, `verify-shots/interview-adversarial/` covers 36 browser assertions and the 45 reviewed art hashes, and `verify-shots/interview-live-handoff/` covers actual model checkpoints and a canonical NPC/choice-event reload (project `d4eeda26-ba1b-435a-87af-30543e5f541a`, revision 8). For follow-up Pi QA use the real `ai-input` / `ai-send` controls: public `__oprnAiBridge.send` dispatches through AssistantSession, unlike the composer/boot handoff. Focused tests have 133 distinct passes; six failures/two errors also reproduce on unchanged main. CSS remains red on both source snapshots; surface verification did not finish all axes due heap exhaustion. Shipping export preparation of this large QA document crashed isolated browser probes; it is an explicit unverified path, not a passing release receipt. See the evidence summaries for scope and reproduction.

QA limitation (2026-10-03): the dedicated player initially failed four of five beats, then both development-browser retries and a packaged-player retry timed out before title visibility. The same full canonical fixture was retained; no NPC dialogue/choice execution pass is claimed. This runtime failure has not been attributed to or compared against unchanged main. Full-document export preparation also crashed isolated browsers; see `verify-shots/interview-live-handoff/SUMMARY.md`.

The dialog retries the same scene after image failure, responds to reduced-motion changes while open, and resets both desktop body and mobile panel scrolling on a new step. At widths up to 850px editable text is 16px and touch controls are at least 44px. The cinematic palette uses three documented `--cinema-*` tokens.

The user confirms only the editable game direction. Detailed TODOs, tool contracts and evidence requirements are model-only context, not another approval screen or a copy/export workflow. `gameDesignExecution.ts` derives a 29-task scaffold from the saved brief; `gameDesignBriefContext` appends it to the existing initial-generation and builder/team/Writer/reviewer routes. Human `welcomeGenrePresetDisplayText` uses the selected creative genre(s) and authored summary; the engine seed's older label is a legacy-brief fallback. The 4000-character summary limit is unchanged; internal instructions are composed separately and are never saved into that field.

Tasks carry dependencies, answer-slot provenance, actions, outputs and acceptance criteria. The model expands them for the actual maps/events/branches/assets within the confirmed scope and reconciles edited summary versus earlier answers before building. Later read-only requests and role-limited Writer/reviewer work must not trigger a full build. No persisted execution ledger, new automatic-send trigger or runtime evidence verifier is introduced here: these are model instructions, not enforced completion receipts. Existing save-first/endpoint-readiness handoff and apply/persistence boundaries remain the execution owners.

Regression cases: `test/gameDesignExecution.test.ts` passed in the explicitly authorized 2026-10-03 QA. The startup/boot preparation cases also exercise failed save, project switching before claim and during save, disconnected prefill and duplicate startup. The standalone cinematic preview now keeps the execution pack behind its confirmation action and shows no task list or instruction-copy/export controls; it still does not create a live project.

### Confirmed brief automatic execution (2026-10-03)

Startup joins the actual shared auth probe: a cold `checking` cache no longer permanently reduces a confirmed build to a draft. A connection-change listener resumes only the queued project identity and unchanged brief. A per-boot queue key prevents duplicate startup calls; this is not a lock shared across browser tabs.

`projectInterviewExecutionClaim.ts` saves the execution claim before Pi's proposal capture. An HTTP/transport failure before worker `start`/`team_start` restores and saves the retry marker. Read-only/planning turns do not claim a build. Once the worker starts, later errors do not automatically repeat the request. Completion and publishing remain separate contracts.

The boot target claims its turn slot before classification and checks project identity after awaits. Confirmed genre production bypasses the generic house/village graphic-choice gate. The human composer shows the creative summary; the production request receives the complete execution prompt.

`scripts/capture-confirmed-brief-autostart.mjs` produces browser evidence in `verify-shots/confirmed-brief-autostart/`: actual panel/startup modules with intercepted authentication/worker responses and stubbed fixture persistence. Its cases cover complete prompt delivery, connection recovery, pre-worker failure restoration, worker acceptance, project switching and save refusal. This does not prove live model output, canonical game persistence or runtime playability. Focused unit cases were authored; this session did not run Vitest or gates.

## Vocabulary and readiness

`resolveGenreVocabulary` provides pack-specific authoring labels without putting farm terms into shared editor core. Supplying `packId` explicitly lets existing pilots, including `createFarmingDemoProject`, be measured without rewriting or relabeling their authored content.

Do not use one ambiguous `ready` flag. The contract has two stages:

1. `evaluateGenrePackConfiguration(project, packId)` evaluates authored/static capability checks and returns `configured`. The farm pilot checks time/gifts, farmable-area presence and in-bounds rectangles, a reachable start-to-farm route, crop records and item references, a hoe and watering can in starting inventory, at least one referenced seed in starting inventory, zero lint errors, and zero reference issues.
2. `evaluateGenrePackPlayableReadiness(project, packId)` is deliberately fail-closed: `playable` is always `false`, and a configured project reports `unverified`. There is no public caller-supplied receipt factory. Phase 4 must add a file-backed or runner-backed evidence adapter before this contract can report playable.

These checks reuse the canonical `Project`, `projectLint`, `collectProjectReferenceIssues`, collision/reachability helpers, and runtime journey ids. They are advisory authoring evidence, not a second schema or genre-specific runtime. Phase 4 must import the IDs from `src/project/genrePackId.ts` and supply evidence from a real runner-owned artifact; it must not synthesize evidence from a button click, default seed, or caller-shaped `{ booted, journeyIds }` object.

## Dialog layering and receipt fixtures (2026-09-08)

The new-project dialog `src/editor/ui/newProjectDialog.ts` registers with `modalStack` and
unregisters on every settled result. Escape cancels only that layer; it must not dismiss an
underlying Database window. `src/editor/panels/newProjectDialog.ts` was a stale duplicate of
the same surface (last touched 2026-09-05, called only by tests) and was removed on 2026-09-11 —
its Escape-layer coverage moved onto the live `ui/` module.
`test/modalEscapeLayerGate.test.ts` exercises the real dialog and Database world route.
Receipt CLI fixtures must fingerprint the normalized loaded project: text-only title graphics
without a resource are intentionally omitted during loading. Valid evidence alone does not
make a blank project ready; missing authored commands remain `incomplete` and unsupported
commands remain `blocked` (`test/genrePackReceiptCli.test.ts`).

## Validation

## Two new-project surfaces, one choice model (2026-09-11)

`newProjectChoices.ts` is the single source; both surfaces are views of it.

| | First-screen briefing | `새 프로젝트` dialog |
|---|---|---|
| Module | `src/editor/editorWelcome.ts` | `src/editor/ui/newProjectDialog.ts` |
| Chrome | full-window world previews via `modalStack` | modal overlay via `modalStack` |
| Returns | `EditorWelcomeResult` (`prompt`, `systemPresetPlan`) | `{ title, choiceId, screenSize, gameDesignBrief? }` |
| Art | reviewed `project-interview` reference scenes | `newProjectChoiceRowThumb` (falls back to `thumb`) |

Before the merge the two lists had drifted apart with no shared record: `story-cutscene` read
"회상 스토리" on the first screen and "스토리 컷신" in the dialog, and `horror-chase` was two
first-screen posters but a single dialog row named "공포 추격". A name chosen on the first screen
then appeared to vanish. `test/newProjectDialog.test.ts` now asserts that every dialog row's
label and blurb are character-identical to the first-screen poster's.

The dialog row id is a **choice id**, not a `GenrePackId`. `horror-chase` carries two names
(`horror-gallery`, `school-horror`) and only the choice id can tell them apart; deriving the AI
prompt from the pack id silently picked one of them. `menu.ts` resolves the pack for the seed but
the preset for the prompt from `choiceId`.

Row art is separated only where a poster's art is shared with a sibling of the same pack — the
dialog shows every option at once, so duplicated art makes the choice unreadable.
`newProjectChoiceRowThumb` owns that rule.

Automation boot detection moved to `src/editor/automationBootContext.ts`. It used to exist twice
with different rules (only the welcome copy knew `?forceWelcome=1`), so first-screen QA had to
satisfy two separate sets.

- `test/genrePackRegistry.test.ts`: exact registry set, complete machine data, all-eight welcome mappings, honest blank-system-preset results, detached preset isolation, farm configuration negative controls, and fail-closed playability.
- `test/genrePersistence.test.ts`: official-ID serialization roundtrip and rejection of arbitrary IDs.
- `test/actionGenreAuthoring.test.ts`: action registry entry points, save/load, map opt-in isolation, and existing-genre routing.
- `test/editorWelcome.test.ts`: the live DOM exposes the confirmed system-preset action separately from AI, renders only the three start posters, and defers auto-send until project preparation succeeds, staying mounted on failure.
- `test/newProjectPresetHandoff.test.ts`: saved-brief boot claim, deferred flush, save failure, project switch, offline draft and duplicate-send prevention. `studioBarActions.test.ts` covers the folder seed and absence of sends to the old project.
- `test/gameDesignBrief.test.ts` and `test/projectInterviewDialog.test.ts`: schema roundtrip, missing/invalid metadata, question branches, explicit confirmation, provenance, skipped slots, and cancel/edit isolation.
- `test/welcomeGenreSystemPresetAction.test.ts`: detached seed includes the confirmed brief before adoption; adoption failure does not focus or release a result.
- `test/e2e/director-first-briefing.spec.ts`: Chromium boots the production editor welcome and gates the three start posters. The extra-worlds toggle is absent.

When extending packs, add capability requirements that the shared runtime already understands. Add a shared runtime capability first if none exists; never add a genre branch to player code.
# 예제로 시작하기와 인터뷰 반영 과정 (2026-10-01)

시작 화면과 메뉴의 새 프로젝트는 같은 `src/start/projectStart.ts` 정본을 읽는다.
처음에는 세 장르의 **플레이 가능한 예제**, 빈 프로젝트, AI 기획 중에서 고른다.
예제는 이름을 확인하고 화면 크기를 필요할 때 펼친 뒤 만든다. AI 연결과 인터뷰는 AI 기획 경로에서만 요구한다.

- 씨앗: `editor/projectStartSeed.ts`. 기존 `createStarterMap`과 `withVerifiedPlayableSegment`를 재사용한다.
  새 타일 조립법을 만들지 않는다. 판정을 통과하지 못하면 생성 오류를 보여 준다.
  예제는 작은 마을 → 장르별 길 → 구간 끝이며 새 SQLite 폴더에 저장한다.
- 첫 편집: `panels/firstRunGuide.ts`가 기존 오른쪽 조수 도크를 사용한다. 대사 수정 → 테스트 플레이를 안내한다.
  안내 중 조수·팀 레일을 접고, 조수 열기를 누르면 기존 도크를 돌려준다. 기존 사용자 프로젝트에는 안내 플래그를 추가하지 않는다.
  `flags.firstRunGuide`, `starterExample`, `firstRunDialogueEdited`, `firstRunTested`는 기존 boolean flags 계약으로 저장된다.
  대사는 store의 맵 변이 API와 감사 descriptor를 통과한다. 테스트 완료는 같은 문서 fingerprint의 실제 boot 성공에서만 기록한다.
- 인터뷰: `projectInterviewDialog.ts`가 답변 영수증, 다섯 기획 항목의 진행, 누적 답변을 표시한다.
  기본 1200ms의 읽기 시간과 450ms의 다음 질문 인계를 사용한다. 실제 자유 답변 추출과 읽기 시간은 함께 진행한다.
  로컬 선택 확인은 AI가 생성한 해석으로 표시하지 않는다. 추출 실패는 기존 답변을 보존하고 나머지를 직접 묻는다.
  취소/닫기는 추출 요청과 표시 타이머를 함께 중단하며 늦은 완료가 모달을 다시 열지 않는다.
  `presentationDelayMs: 0`은 결정적 호출자용이며 제품 기본값은 아니다.

화면·저장 증거: `verify-shots/project-first-run/`. 이 세션에서는 AGENTS의 제한에 따라 gates/vitest를 실행하지 않았다.
