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

## Concept feed is the only new-game surface (2026-10-07)

The launcher home, the menu 「새 프로젝트」 and the first-boot welcome now all show the same concept feed
(`src/start/conceptFeed/conceptFeed.ts`; spec `docs/superpowers/specs/2026-10-07-concept-feed-design.md`).
A concept card (`src/concepts/format.ts`, `oprn-concept/1`) carries a `presetId` from the eight choices in `newProjectChoices.ts`
plus the five brief slots, so 「▶ 이 게임 만들기」 produces a confirmed `gameDesignBrief` (`src/concepts/brief.ts`) without an interview
and hands it to the existing `generationPending` → `prepareProjectInterviewStartup` path. `buildWelcomeGenrePresetPrompt` names the preset
`<concept title> (<preset label>)` when the brief has a `concept`.

- All eight presets are reachable through concepts, not only the three posters. The AI connection gate (`ensureAiConnectedForPreset`) runs
  when the author presses make; declining keeps the feed open and creates nothing.
- Removed: the welcome briefing/poster stage (`editorWelcome.ts` is now only the show/dismiss gate), `firstWorldArrival.ts`,
  the launcher lobby and inline interview (`startLobby.ts`, `startInterview.ts`), `runStartScreenPresetInterview`, and
  `src/editor/ui/newProjectDialog.ts` with its tests and capture scripts. Sections below that describe those surfaces are history.
- Kept: `projectInterviewDialog.ts` for 「프로젝트 → 게임 기획...」 editing of a saved brief, the playable-segment skeleton,
  and the team first build.
- Official concepts come from the `game-concepts` harness (`openwiki/harnesses/game-concepts.md`): AI writes ~330 candidates and
  draws a SNES-style pixel thumbnail, a human accepts/rejects each at the review page, then `publish` puts them in the store and
  `bundle` refreshes the offline fallback. 「내가 쓴 걸로 만들기」 drafts a card from the author's sentence with the same rules (`src/concepts/draft.ts`).

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

**AI handoff ordering:** the menu's new-project seed carries `gameDesignBrief.generationPending: true` into `createProjectFolderWithSeed`. The bridge creates the folder and the page reloads. The new project's boot saves its preparation while keeping this marker, waits for authentication status, then queues the full `/goal` prompt. Disconnected AI gets a short visible draft with hidden full instructions; connection recovery automatically resumes the same confirmed brief. The execution route claims and saves the marker before capturing its proposal base. A transport failure before worker startup restores and saves the marker; an accepted build is not automatically repeated on reload. The panel awaits `whenAiChatPanelSettled()` and an idle turn slot before classification. Scope checks stop an old handoff after project switching. Do not send to the old store before the folder reload.

## Preset AI connection gate and first team build (2026-09-27)

- Both preset entrances (welcome first-sentence submission, the 새 프로젝트 genre) call `ensureAiConnectedForPreset` from `src/editor/ui/aiConnectGate.ts` **before** the interview. Welcome poster selection alone does not call it. It refreshes companion status first; if connected it returns immediately with no UI. Otherwise an alertdialog (「AI 를 먼저 연결해 주세요」, 팀장·시공·검수 roster, current status line) offers 「나중에」 (stay on the start surface) or 「AI 연결하기」.
- 「AI 연결하기」 hides the gate, opens AI settings above app modals, and waits for `AI_SETTINGS_CLOSED_EVENT`; then it refreshes again and either resolves `true` (interview continues) or reshows the gate with 「아직 연결되지 않았어요」. Arm the wait **after** `openAiSettingsModal()` — it calls `closeAiSettingsModal()` first, which fires the closed event even with no modal open.
- The gate is injected (`EditorWelcomeOptions.ensureAiConnected`, `NewProjectDialogOptions.ensureAiConnected`), so component tests without it keep the old flow. The ⚙ system preset, blank project, and free-text welcome input do not pass the gate.
- The first preset build runs as the `/goal` campaign team: `setPendingAiBootIntent(..., { team: true })` → `AiBootIntentTarget.send/prefill(text, display, { team: true })` → `plainPiTurn(text, { team: true })` → `classifyPlainPiTurn({ piTeam: true })`. The command owns the whole project and carries the minimum-map/content contract; `AiConfig.piTeam` is unchanged, so later requests stay single unless the user turns team on. A prefilled draft keeps the team flag through `composerHandoff.team` only while the visible text is unchanged; explicit `/goal` keeps its campaign mode through the handoff.
- Browser evidence (script removed 2026-10-07 with the dialog): `scripts/capture-preset-ai-gate.mjs` → `verify-shots/preset-ai-connect-gate/SUMMARY.json` + PNG (companion `/auth/status` stubbed signed-out then signed-in; no model calls or project writes).

## Playable first segment — code builds it, code judges it (2026-09-28)

AI-only preset first builds could not be finished: of 24 live runs on 2026-09-27, none reached an end. The largest (17 maps) had no ending; the 4-map run had three unlinked empty maps, no starter and no capture item (`runGameCheck`). The segment is therefore guaranteed by code, not by the prompt.

- `src/project/playableSegment.ts` builds a skeleton for the three start-surface genres with the real editor tools (`runTool`). All share: key action on the start map (`ev_segment_starter`, sets `sw_segment_key`) → door east (`create_transfer_pair`) → `map_segment_route` → `ev_segment_end`, which opens only after the key switch and calls `triggerEnding ending_first_segment`.
  - monster-collect: professor via `give_starter_monsters` (switch spliced after each `giveMonster`), five `item_capture_orb` in the starting inventory, route via `author_wild_route` on beodeul_city; on any other route tileset (new projects start on `monster_overworld`, #2675) `paveMonsterKitRoute` fills the kit's 풀밭 ground, paves its 모래길 autotile path, drops two 키 큰 풀 (terrain tag 5) patches across it and binds encounters to `terrain_grass` (2026-10-27; before this the skeleton threw and new monster-collect projects had no first segment) — with a grass-only Lv3 wild slime `troop_segment_wild` (species formula — the default `troop_slime` beats a Lv5 starter).
  - adventure-jrpg: village chief quest, random encounters on the route, and a `canLose:false` gatekeeper battle (`troop_slime_pair`, 5/5 simulated wins for the Lv1 hero) before the ending.
  - story-cutscene: a memory object to inspect, then the far end.
- `judgePlayableSegment` passes only when `runGameCheck`'s headless autoplay reaches `ending_first_segment`. Any other ending is not a pass. It proves start → partner → route → segment end is walkable; it does not judge fun or looks.
- Runner fix found by this gate: `sceneTestRunner` used to keep executing an event after a lost `canLose:false` battle, so an ending behind an unbeatable gatekeeper counted as reached. It now stops the event there, like the shipped player (`playSceneInterpreter`).
- Seeding: `withVerifiedPlayableSegment` runs in `prepareProjectInterviewStartup` (menu and desktop start screen) and in `applyWelcomeGenreSystemPresetPlan` when a brief exists (welcome poster). The ⚙ system preset (no brief) never gets a skeleton. A skeleton that fails its own judgement is not planted.
- Contract: `playableSegmentContract()` (`playableSegmentContract.ts`, no heavy imports) is added to the builder system prompt and the orchestrator prompt when the project has the skeleton.
- Start variety (2026-10-11, `src/project/startVariety.ts`): the skeleton's shape is no longer fixed. `planStartForBrief(brief, title)` derives, deterministically from the concept slug (or confirmed summary / title), a theme (`river|coast` unless the stage text names desert/snow/swamp), form (`street|scatter|riverbank`, never `plaza` by default), terrain, route-map size (22..34 × 10..16) and entry/end rows (x=0 entry, end event at width-2, rows differ by ≤3). `buildPlayableSegmentSkeleton(project, { legacy })` follows that plan; an untouched blank start map on `beodeul_city` (no other tileset hint in the brief) is pre-built with `author_beodeul_town({theme, form, terrain, seed})` and the door / starter NPC cells are found by BFS over the built roads (never carved). `withVerifiedPlayableSegment` tries the planned skeleton, then the old fixed one (24×12, rows 6, blank start) if the judge fails. "예제로 시작" derives its city seed from the title (fallback seed 7). The same plan is injected into the first-build prompt (`startPlanPrompt`) and `playableSegmentContract` now says only the connection is preserved, not the map shape. Probe: `bun scripts/qa/start-variety-probe.mts` (old vs new renders + judge). Concepts with another tileset hint (jp_city/joseon_baram/wizarding_world) now follow that tileset (2026-10-12, `startRoutePaint.ts`): `openBlankStartOnConceptKit` switches the blank start map to the hint tileset, resizes it (`startMapSizeFor`: jp 52+×34+, joseon/wizarding 48+×36+), fills the ground (jp: 잔디) and lays a main street across the start row (`paintMainStreet`, skipped for wizarding_world via `noMainStreet`); the route map is paved with the kit's road/yard materials (`ROUTE_STYLES`). The prompt (`startPlanPrompt`) names the kit's build tools and forbids `author_beodeul_town` for them. Assistant fixes found by real jp_city runs: `build_hand_interior_room` accepts `layout` together with plan/rooms/connect/exit (layout wins, note in `fitNotes`); the plan-only turn cap (30) gets a batching hint plus a one-time steer at 75% (`piAgentRuntime.ts`). Probe: `scripts/qa-game/briefs/jp-*.json` with `bun scripts/qa-game/cli.mts gen`. Unit assertions: `test/startVariety.test.ts` (not run in CI-gate form yet).
- Gate 1, team runtime (`scripts/lib/piTeamRuntime.ts`): for a `장르 프리셋:` task on a passing skeleton, `finish` is rejected with the blocker list up to two times.
- Gate 2, browser (`aiPiAgentCommand.ts`): the final merged result, and the partial live result of a failed or stopped run, is judged. On failure nothing more is applied; already published live checkpoints are reverted to the passing start state with `applyProjectWithHistory` (undo brings the AI result back), unless the user edited the project during the run.
- Both gates are limited to the preset first build. Later requests may move or extend the segment freely.
- Genres without a skeleton (farm, horror, partner, action) keep the previous AI-only flow and are not gated.
- Visible quest givers and a real campaign definition (2026-10-23): the skeleton's starter pages used `graphic:{transparent:true}`, so the village chief (adventure-jrpg) and the professor (monster-collect) existed but were drawn nowhere — the first objective was found by inspecting a blank tile. `starterNpcGraphic` now picks a walking chip (`노인` for the chief, the event name — `박사` — then `villager` for the professor) through `resolveGraphic` under the genre-lock catalog filter, and falls back to `transparent` only if nothing resolves. The monster-collect preset also authors a minimal `system.monsterCampaign` (`finish`): the collector menu lists `region-map`·`campaign-progress`, but the runtime only shows them when a campaign exists (`listStatusMenuCommandIds`), so the authored entries were silently dropped.
- Regression: `test/playableSegment.test.ts` (reload pass, cut end/door/starter fail, other genres untouched). A bun probe with a stub team verified finish rejection then acceptance after repair. Not verified: a live model run through the gates.
- Runtime QA: `rt-field-quest-giver-visible` and `rt-field-doctor-visible` read `window.__oprnCharacterSprites().events['ev_segment_starter']` after the checkpoint boots, and `rt-field-menu-map-badge` asserts the menu text contains 지도·배지. `projectGenerator` output under `tmp/qp/games/<game>` is cached — a preset change needs `QA_REGENERATE_GENERATED=1` or that folder deleted, otherwise the scenario judges the old project.

## Cinematic interview in the actual app (2026-10-03, launcher/welcome entry superseded 2026-10-07)

- First-time launcher Home and launcher New Game embed the first genre question directly, with a pixel still and optional ambient motion. Genre and answer buttons advance in one click; idea entry, genre mixing, custom answers and extra planning fields stay available in disclosures. `src/start/firstWorldArrival.ts` remains the editor welcome's world-preview stage. Later interview choices determine the confirmed engine. Image characters and scenes remain references, never authored project content.
- `src/editor/ui/projectInterviewDialog.ts` is the production interview, shared by menu creation, welcome posters, launcher planning, and saved-brief editing. New Game opens AI planning by default; examples and blank projects remain under “시작 방식 다시 고르기”. The launcher lazy-loads the draft-only interview on `start-screen.html` before creating a folder. Only final confirmation and account readiness create/open the SQLite project. Legacy launcher payloads without a confirmed brief retain their old editor-side interview route.
- Four author-facing genres: relationship/romance, monster collection/growth, adventure, mystery. No life/management option. `projectInterviewScenes.json` owns five questions and three illustrated choices per genre; `cinematicInterviewQuestions.ts` maps them onto existing brief slots. Genre mixing adds an explicit connection question. Custom concept/answers, recommendation provenance, back/edit, cancellation, and editable final summary remain local drafts until confirmation. No automatic AI extraction is performed in this new choice-driven flow; the full original concept is preserved for the assistant.
- The film runs only for arrival. An explicit genre/answer choice stops and hides it; generation publishes only a freshly reviewed pixel scene. The world-map poster is the first pending still. Later pending requests retain the prior accepted scene with an explicit “이전 장면” status, rather than returning to the video. The bundled branch gallery remains historical evidence and is not the production choice background. Request tokens discard late responses. Motion toggle, reduced-motion default, image failure fallback, modal-stack Escape, focus restoration and tab containment are supported. Image characters never define the protagonist.
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

The user confirms only the editable game direction. Detailed TODOs, tool contracts and evidence requirements are model-only context, not another approval screen or a copy/export workflow. `gameDesignExecution.ts` keeps the 29-task common scaffold and appends the detailed manual's section tasks (57 tasks for one interview genre, 73 for two). `gameDesignBriefContext` embeds the complete common and selected genre manuals in the existing initial-generation and builder/team/Writer/reviewer routes. Human `welcomeGenrePresetDisplayText` uses the selected creative genre(s) and authored summary; the engine seed's older label is a legacy-brief fallback. The 4000-character summary limit is unchanged; internal instructions are composed separately and are never saved into that field.

Tasks carry dependencies, answer-slot provenance, actions, outputs and acceptance criteria. The model expands them for the actual maps/events/branches/assets within the confirmed scope and reconciles edited summary versus earlier answers before building. Later read-only requests and role-limited Writer/reviewer work must not trigger a full build. No persisted execution ledger, new automatic-send trigger or runtime evidence verifier is introduced here: these are model instructions, not enforced completion receipts. Existing save-first/endpoint-readiness handoff and apply/persistence boundaries remain the execution owners.

Regression cases: `test/gameDesignExecution.test.ts` passed in the explicitly authorized 2026-10-03 QA. The startup/boot preparation cases also exercise failed save, project switching before claim and during save, disconnected prefill and duplicate startup. The standalone cinematic preview now keeps the execution pack behind its confirmation action and shows no task list or instruction-copy/export controls; it still does not create a live project.

### Confirmed brief automatic execution (2026-10-03)

Startup joins the actual shared auth probe: a cold `checking` cache no longer permanently reduces a confirmed build to a draft. A connection-change listener resumes only the queued project identity and unchanged brief. A per-boot queue key prevents duplicate startup calls; this is not a lock shared across browser tabs.

`projectInterviewExecutionClaim.ts` saves the execution claim before Pi's proposal capture. An HTTP/transport failure before worker `start`/`team_start` restores and saves the retry marker. Read-only/planning turns do not claim a build. Once the worker starts, later errors do not automatically repeat the request. Completion and publishing remain separate contracts.

The boot target claims its turn slot before classification and checks project identity after awaits. Confirmed genre production bypasses the generic house/village graphic-choice gate. The human composer shows the creative summary; the production request receives the complete execution prompt.

### Detailed authoring manuals (2026-10-03)

`src/project/gameAuthoringPresets/*.md` owns the common production manual and four author-facing genre manuals. Each section contains input, action, output and acceptance, followed by detailed implementation, failure and retry guidance. Romance covers independent character goals, trust/affinity, distinct choice reactions, remembered re-dialogue and relationship progression. Monster covers real species versus owned individuals, capture/bond/hatching, party participation, growth and duplicate rewards. Adventure covers exploration, obstacles, companions, battle outcomes and return paths. Mystery covers internal truth versus player knowledge, evidence/testimony/contradiction, actual case tooling and wrong-answer recovery. Common guidance covers 16-bit pixel-art rejection, schema lookup, first-map writes, state/event contracts, canonical save/reload and independent play evidence.

Run `node scripts/content/prepare-game-authoring-presets.mjs` after editing the source manuals. It builds `documents.json`, used by both Vite and the Bun worker, with full text, section contracts and SHA-256 hashes. `--check` detects stale bundles. `gameAuthoringPresets/index.ts` embeds every selected document between begin/end hash markers; a two-genre interview receives both full genre documents once. There is no retrieval dependency or summary-only substitution. Legacy story briefs do not imply a romance choice; unsupported legacy engines retain their previous context.

`choices.ts` maps all 60 illustrated choices to actionable section references and implementation rules. Unknown/custom choices use the latest free text. Choice IDs are original-choice hints; the edited summary and subsequent explicit user instructions have precedence. The original protagonist, concept and notes remain intact. The initial request header uses the actual author genre rather than the story engine label, and legacy short genre guides are not appended to a cinematic interview's full manuals.

`detailedAuthoringTasks` supplies section-level dependencies, inputs, outputs, acceptance and original answer-slot provenance. Optional modules are applied only when the current scope requires them; skipped is distinct from verified. The existing generic scaffold remains a model planning spine. These documents and TODOs are **model instructions**, not a new persisted task ledger or enforced gameplay verifier. The existing claim, checkpoint, skeleton gate and SQLite persistence boundaries still own execution. Full preset delivery does not prove that the model completed the whole game.

Focused source/variant/graph audit: `node scripts/qa/detailed-authoring-presets.mjs`. Actual packaged editor → production interview → live provider → SQLite evidence: `node scripts/qa/detailed-authoring-live.mjs`, using its own local project folder. The capture observes provider-normalized `prompt_inspection` events, not mocked responses. Read the evidence reports for the exact observed roles and completion scope; do not infer full game completion from the first write.

`scripts/capture-confirmed-brief-autostart.mjs` produces browser evidence in `verify-shots/confirmed-brief-autostart/`: actual panel/startup modules with intercepted authentication/worker responses and stubbed fixture persistence. Its cases cover complete prompt delivery, connection recovery, pre-worker failure restoration, worker acceptance, project switching and save refusal. This does not prove live model output, canonical game persistence or runtime playability. Focused unit cases were authored; this session did not run Vitest or gates.

## Vocabulary and readiness

`resolveGenreVocabulary` provides pack-specific authoring labels without putting farm terms into shared editor core. Supplying `packId` explicitly lets existing pilots, including `createFarmingDemoProject`, be measured without rewriting or relabeling their authored content.

Do not use one ambiguous `ready` flag. The contract has two stages:

1. `evaluateGenrePackConfiguration(project, packId)` evaluates authored/static capability checks and returns `configured`. The farm pilot checks time/gifts, farmable-area presence and in-bounds rectangles, a reachable start-to-farm route, crop records and item references, a hoe and watering can in starting inventory, at least one referenced seed in starting inventory, zero lint errors, and zero reference issues.
2. `evaluateGenrePackPlayableReadiness(project, packId)` is deliberately fail-closed: `playable` is always `false`, and a configured project reports `unverified`. There is no public caller-supplied receipt factory. Phase 4 must add a file-backed or runner-backed evidence adapter before this contract can report playable.

These checks reuse the canonical `Project`, `projectLint`, `collectProjectReferenceIssues`, collision/reachability helpers, and runtime journey ids. They are advisory authoring evidence, not a second schema or genre-specific runtime. Phase 4 must import the IDs from `src/project/genrePackId.ts` and supply evidence from a real runner-owned artifact; it must not synthesize evidence from a button click, default seed, or caller-shaped `{ booted, journeyIds }` object.

## Dialog layering and receipt fixtures (2026-09-08)

(2026-10-07: the dialog was removed; the concept feed overlay `src/editor/conceptFeedOverlay.ts` now owns this Escape layer and the gate test covers it.)
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

## Two new-project surfaces, one choice model (2026-09-11, superseded 2026-10-07 by the concept feed)

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

## 새 몬스터 프로젝트의 참고 프로필 (2026-10-04)

편집기 `materializeGenreBlankProjectSystemPreset`는 몬스터 수집 새 프로젝트에
공용 에메랄드 참고 프로필을 추가한다. 일반 엔진 `applyGenrePreset`는 기존 collector
토글 계약을 유지한다. welcome의 AI 기획 전달은 공용 전체72맵/60종 생성·보수 도구와
교수 소개 안내를 포함한다. AI 없는 「예제로 시작」는 기존 작은 플레이 구간이며
완성 캠페인으로 표시하지 않는다. 공유 계약/실제 출하 증거는
[emerald-monster-production.md](emerald-monster-production.md)를 따른다.

### Executable first romance scene (2026-10-03)

The bounded romance/talk/single/scene route now prepares a provisional one-map conversation and internal registered contract before the saved AI handoff. `author_romance_scene` builds native commands atomically; the final acceptance gate freezes identities, choice labels and source, executes both branches/revisit/cancel/ending and player-save resumption, and requires a current image-backed `review_map` verdict in the team runner. Draft names or a model completion statement are insufficient. Other genres retain their existing route. Scope, extraction limits, ownership and reproduction: [romance-scene](harnesses/romance-scene.md).

### Click-first interview and fresh art (2026-10-04)

The production `projectInterviewDialog.ts` no longer maps answers to bundled branch
illustrations. Genre/answer controls are text buttons, with a full-viewport motion
background on arrival and a pixel still after the first explicit choice. `interviewSceneGeneration.ts` sends the
actual concept, choices, blend, protagonist and notes to the selected account's
image provider. It asks for a fresh composition with locked 16-bit pixel direction;
unset identities must remain absent. These images are ephemeral interview art,
not playable maps, sprites or facts added to the saved brief.

A 750ms debounce, request identity, abort controller and disposed-dialog check keep
old responses from replacing the current selection. On a changed choice, prior art
is visibly labeled as the previous scene until the reviewed replacement arrives.
Opening the interview alone does not generate an unspecified scene. Repeated unchanged renders do not spend another request;
`다시 그리기` explicitly requests a fresh variant. Each result must decode, pass
size/aspect checks, and be delivered to the configured vision model. All six
checks (pixel grid, limited palette, composition, selected facts, identity, no text)
must be true with no findings. Rejection triggers a fresh generation containing
its findings, up to three attempts. Malformed/unacknowledged reviews fail closed.
An unavailable provider or exhausted gate never disables navigation and never
falls back to the old branch image bank. Model judgment is not a mathematical
certification of historical hardware bit depth.

The header and navigation are outside the scrolling content, including the final
confirmation. The launcher `create()` also accepts an empty idea after genre
selection; it must not retain the old mandatory one-sentence guard. The shared first-world arrival permits selecting a genre and
starting with no typing; optional prose and example text remain available. There
are no shortcut hints in these early surfaces. New-project name and screen-size
controls remain visible with a separate scrolling content area and fixed actions.
The full detailed authoring brief still passes internally to the AI assistant;
the interface does not show the execution checklist.

Desktop image calls now use `companionRequestBaseUrl()` like chat calls. A relative
`/v1` request from `app://oprn` previously targeted the asset protocol instead of
the Electron companion. Browser calls still use their own origin.

New cinematic interviews seed `pixel-cinematic` dialogue when no style is authored.
Legacy briefs keep the preset-specific recommendation and existing style overrides
are untouched. The automatically generated garden QA exposed the prior default
`story-cutscene → gold`; an art prompt alone did not correct that product default.

### Launcher planning before project creation (2026-10-04, superseded 2026-10-07 by the concept feed)

The cinematic interview controls use the custom pixel-corner frame and metallic
accent treatment in `styles/shell/dialogs/cinematic-interview.css`. Text remains
native/selectable; decorative layers ignore pointer events. Input fields use an
inset writing surface with a strong focus border, and the existing focus outline
remains visible. Reduced motion and the interview motion toggle stop the metal
sweep and control transitions. The motion button retains its absolute position.
Presentation evidence: `verify-shots/interview-ornate-controls/`. The component
capture accepts `LAUNCHER_INTERVIEW_CAPTURE_DIR` to preserve earlier receipts.

`start/startInterview.ts` loads only the existing draft interview. The launcher
does not navigate to `index.html`, create a project folder, boot Phaser, or load
the store while answers are being chosen. Its account gate runs after final
confirmation; declining connection or failing folder creation retains the
confirmed draft for retry. Menu/welcome connection ordering is unchanged.
The launcher mounts it inline with `container`, `signal` and `clickThrough`,
without a preliminary idea form or modal focus trap. No movie autoplays. The
`onConfirm` callback disables controls while connecting/creating; declining or
failing leaves the same confirmation screen, and navigation aborts pending art
when leaving the interview. Busy navigation is blocked for pointer and keyboard.
Cancelling returns to recent projects even when that list is empty, rather than
immediately reopening the first question.

`StartScreenIntent.gameDesignBrief` carries the complete confirmed metadata,
answers, summary, protagonist and notes, not a shortened visible sentence. Boot
validates it against the selected engine, saves it with `generationPending`, and
uses `prepareProjectInterviewStartup` for the normal internal execution handoff.
It skips a second interview and the launcher sentence-only send. A mismatched,
expired or differently targeted intent never applies to another folder.

`prepareProjectInterviewStartup` prefills an empty, mounted AI composer before
asset preparation, preserving the full internal prompt and first-turn team
option behind the concise visible request. This first apply does not send.
Canonical save and account readiness still precede the later execution handoff;
human drafts are not replaced by the early prefill. The pending generation
marker retains the existing retry semantics.

The lightweight import boundary matters: `llmClient` must read team/apply defaults
from `piAgent/executionDefaults` and `applyMode`, not `executionRoute`, which pulls
intent acceptance, runtime DOM and the project store. The connection gate imports
settings events from `aiSettingsEvents` and loads the settings window only on an
explicit connection click. It owns its app-modal stylesheet outside the editor.

Component evidence and reproduction: `verify-shots/launcher-interview-flow/`
and `scripts/qa/launcher-interview-flow.mjs`. Auth/provider failures there are
synthetic and do not certify art quality or a real assistant run. The separate
`scripts/qa/launcher-interview-native.mjs` records the actual built native app,
real companion requests and owned SQLite folder; its report separates planning
success from saved-brief/assistant handoff. Gates/Vitest are not implied by a
successful UI check.

- jp_city start places (2026-10-12): `planStart.placeId` (startVariety `KIT_START_PLACES`: shopstreet/tram-street/town, school or station words pick school/tram) makes `prebuildStartTown` import the finished place as the start map (new map then swapped into the blank start id; route map keeps the concept tileset). Callers must `await preparePlayableSegmentAssets(project)` first (headless: `setRegionReferenceDownloadLoader` + `preloadKitStartPlaces`). `regionReferenceImport.currentBundledTileset` re-fits stale 48-column jp_city place tilesets via `ensureJpCityTileset` (otherwise imports became wrong-picture copies). Probe: `bun scripts/qa/jp-start-probe.mts`.

## JRPG 남은 결함: 필드 HUD · 전투 균형 완료 게이트 (2026-10-17 fix-leftovers, jrpg-real-1 J09/J06/J04)

- **J09 필드 HUD.** 저장된 `system.fieldHud` 가 없는 `adventure-jrpg` 프로젝트는 기본 「하트 + 514 / 514」 HUD(액션 게임용, 지도·실내 위쪽을 덮음) 대신 프리셋 위젯이 없는 `classic`(고전 JRPG) 테마를 쓴다. 새 프로젝트는 `applyGenrePreset` 이 `fieldHud ??= JRPG_CLASSIC_FIELD_HUD` 로 깔고, 이미 만든 프로젝트·헤드리스 산출물은 `effectiveFieldHud(project)`(`src/project/fieldHud.ts`, 플레이어 `fieldHud.ts` 가 사용)가 같은 값으로 본다. 저작자가 정한 fieldHud 는 그대로 존중한다. 능력치·소지품은 ESC 메뉴에서만. 증거: `scripts/qa/fix-leftovers/field-shot.mjs`(`--old-hud` 로 수리 전 동작 재현).
- **J06 전투 균형이 finish 를 막는다.** `jrpgCompletionGaps` 가 `checkJrpg` 의 `jrpg-party-identical-stats`·`jrpg-boss-not-threatening`·`jrpg-boss-unwinnable`·`jrpg-encounters-harmless`·`jrpg-encounters-wipe-party` 를 완료 조건으로 포함한다(모의전은 즉시, 3판 고정 시드, 검사기가 던지면 막지 않음). 다른 완료 조건과 같은 두 번 거절 규칙(팀 finish). 안내는 `upsert_actor.parameterCurves`·`upsert_enemy.stats`.
  - **역할 곡선(jrpg-loop-1 D7)**: `upsert_actor` 가 기본 곡선 그대로 만든 배우가 다른 배우와 능력치 곡선이 같으면 경고(역할별 예시 곡선 포함)하고, `checkJrpg` 의 `jrpg-party-flat-roles`(파티 3명 이상·여섯 능력치 편차가 모두 15% 미만)를 완료 조건(`BALANCE_CODES`)에 넣었다.
  - **요청한 규모(D13)**: `jrpgCompletionGaps` 가 요청·기획서에 비공정·비행선·탈것 낱말이 있는데 `system.vehicles` 에 airship 이 없으면(place_vehicle), 붕괴·폐허·멸망 낱말이 있는데 붕괴 후 이름의 맵이 없거나 전부 붕괴 맵이면(derive_map_variant era:ruin) 막는다. ff2 는 NPC 「비공정 기관사」만 두고 탈것·붕괴 후 맵 없이 끝났다.
  - **자연어 요청에도 건다(jrpg-loop-1)**: `segmentGate` 는 장르 프리셋 브리프에서만 켜져 「크로노 트리거 같은」 한 줄 요청은 이 관문을 우회했다. `jrpgChatRejections`(piTeamRuntime.ts)가 요청 문장이 JRPG 작업이면(`jrpgCompletionGateApplies`) 같은 `jrpgCompletionGaps` 로 두 번까지 거절한다. 여는 장면이 제목 카드뿐이면 `opening` 결함으로 잡는다(`openingIsOnlyTitleCard`).
    - **자동 플레이 막힘도 마무리 항목(jrpg-loop-2 ff1)**: 채팅 한 줄 경로는 첫 구간 판정(`judgePlayableSegment`)을 안 불러, 시간의 문이 절벽 위에 갇혀 `qa:game check` 막힘 1건인데도 finish 가 받아졌다. 뼈대(`hasPlayableSegmentSkeleton`)가 있으면 같은 판정의 막힌 곳을 `jrpgGaps` 에 더한다(거절 두 번까지).
    - **씨앗 어촌 그대로(jrpg-loop-2)**: 실측 프로젝트 6/6 에서 씨앗 시작 맵(버들항 어촌, 등대 건물 `bd-pick-fishing-port-lighthouse`)이 다시 지어지지 않은 채 「잿빛 설원 · 저항군 전초기지」 같은 이름만 달고 남았다(ff1 은 그 맵이 시작 맵이라 첫 화면이 초록 항구). 항구·어촌 낱말이 없는 이름의 맵에 등대 표지가 있으면 `jrpgCompletionGaps` 가 마무리 항목으로 막는다(거절 두 번까지).
      - **고칠 수 있는 문구·닿는 맵만(jrpg-loop-3)**: ff2·ct2 실측 — 이 맵의 집은 완성된 집 보호 영역이라 `tile_erase`·`clear_map`·`paint_tiles`·`author_beodeul_town` 이 전부 거절됐고, 옛 문구의 「등대 건물 철거」 는 AI 도구에 없었다(builder 가 제자리 수리를 시도하다 두 번 거절 뒤 포기). 이제 문구가 새 맵(create_map → author_beodeul_town) + `set_start_position` 으로 시작을 옮기라고 말하고, 검사는 시작 맵에서 `transfer` 로 닿는 맵만 본다(`reachableMapIds`) — 시작에서 빠진 옛 씨앗 맵은 막지 않는다. `mapGraph.ts` 도 `startMapId !== "map_blank_start"` 이면 `map_blank_start` 에 씨앗 이벤트가 남아 있어도 `unreachable-map` 막힘을 내지 않고, 반대로 새 시작 맵에서 `map_blank_start` 로 문이 남아 있으면 이름을 「(구) 포구 외곽」처럼 바꿔도 `jrpgCompletionGaps` 가 문 삭제를 안내한다(r3-ff1). 테스트는 미실행(tsc 0).
- **J04 429 자동 재시도.** 팀 런타임이 finish 에서 429 로 끊긴 배정을 한 번 자동으로 다시 맡긴다(구현·증거는 `harnesses/romance-scene.md` 「429 자동 재시도」 — 연애와 같은 `piTeamRuntime.ts` 로직 하나다).
- **같은 몸 셋 + 다른 한 명(jrpg-loop-3)**: `partyRoster` 는 `changeParty add` 로 합류하는 모든 배우를 센다 — ff2 는 탈것 배우(`actor_airship`)를 합류시켜 카일·엘레나·가렌(전부 HP514·MP43)이 `jrpg-party-identical-stats` 를 통과했다. 이제 가장 큰 같은 몸 묶음이 3명 이상이면 그 묶음 이름으로 경고한다(`jrpg.ts`).
- **못 고친 것.** J10 광산 바닥 질감: 바닥 키트(`floor-cave` 무작위 혼합 + `ground-rock` 덩이)의 그림 자체가 거칠다 — 팔레트·도트 문제라 새 도트 없이는 못 고친다(장르 관문 대상). J02/J03/J08/J12 는 앞선 PR 에서 처리.
- **J06b 동료 약속(jrpg-loop-2)**: 요청에 동료·파티원·일행이 있으면 `changeParty add` 로 합류시키는 서로 다른 인물이 2명 이상이어야 한다(`COMPANION_WORDS`·`COMPANION_MIN_JOINS`). ct2 는 「시대마다 동료도 만나고요」에 합류 0건 — 시대별 NPC 는 대사만 했다. 합류 이벤트가 있어도 그 동료들을 `set_party` 로 시작 파티(`system.startActorIds` / `session.partyActorIds`)에 미리 다 넣어 두어 새로 합류하는 인물이 2명 미만이면 주인공만 시작 파티에 두라고 막는다(r3-ff1·ct1).
