# Testing

## P2 낚시·채집·도감·박물관 focused gate (2026-08-25)

- `npx vitest run test/p2ProjectSchema.test.ts test/p2LifeRuntime.test.ts test/p2DayTransition.test.ts test/p2SessionPersistence.test.ts test/p2ReferenceLifecycle.test.ts test/p2EditorAuthoring.test.ts test/p2LifeLedgerUi.test.ts --configLoader runner`를 실행하고, matching P0/P1 persistence/transition/editor/life-ledger regressions와 `npm run typecheck:app`를 뒤따르게 한다.
- hostile cases는 failed-catch RNG rollback, no energy, unavailable season/time/weather, deterministic daily forage placement/cleanup, placeable/inventory overflow, duplicate day advance, collection counter overflow, duplicate donation/reward, aggregate reward overflow, malformed/stale save row, legacy omitted field, exact map/item deletion impact, structured editor roundtrip, long name, empty tab, pointer/keyboard tab semantics를 포함한다. Merged-root browser evidence에서는 root-owned `foraging-card.png`가 실제로 해석되는지도 확인한다.

Use the lightest command that proves the change.

## 체공(점프·낙하) focused gate (2026-08-29)

- `test/characterHop.test.ts`: 순수 곡선·클램프 계약. 아크 대칭성과 양끝 0, 낙하의 감가속 비대칭, `hopOriginY` 가 `height × scaleY` 로 나누는지(`hopOriginY(16,32,2) === 1.25`), 착지 충격 계획이 `MIN_IMPACT_LIFT_PX` 미만이면 `null` 인지, `prefers-reduced-motion` 에서 흔들림·먼지가 빠지고 SE 만 남는지.
- `test/runtimeCharacterHop.test.ts`: NPC 체공. 리프트가 최고점까지 오르는 동안 `sprite.y` 와 `sprite.depth` 가 **불변**인지(깊이 y-소트·카메라·조명이 이 값을 읽는다), 점프가 이동 속도가 아니라 자기 `durationMs` 를 쓰는지, `dropIn` 이 타일을 바꾸지 않는지.
- `test/runtimePlayerHop.test.ts`: 주인공 체공. 목적지 커밋(`tileX`/`session.x`), 맵 밖 점프는 건너뛰고 다음 명령을 소비, 낙하가 끝날 때까지 다음 걸음을 시작하지 않음. 이 파일의 `playerMock.setFrame` 은 Phaser 처럼 원점을 `[0.5, 1]` 로 되돌린다 — **리프트는 프레임 갱신 뒤에 적용해야 한다**는 호출 순서 계약을 테스트가 직접 지킨다.
- `test/hopPersistence.test.ts`: 저작한 `heightPx`/`durationMs`/`dx`/`dy` 의 저장 왕복(두 저작면 모두). 문자열 높이는 `deserialize` 가 던져야 한다.
- `test/moveRouteCatalogPersistence.test.ts`: 팔레트 44 버튼이 만드는 커맨드 전부를 하나씩·통째로 왕복시킨다(범인 버튼의 `testId` 를 실어 실패). 그리고 「효과음 재생」 기본값이 `collectResourceIds` 안에 있는지 잠근다 — 이 한 줄이 "없는 리소스 기본값이 이벤트 저장을 통째로 막는" 결함의 회귀 게이트다.
- 회귀는 `test/runtimeNpcRoute*.test.ts`, `test/runtimeMoveRoute*.test.ts`, `test/e2e/oprn-move-route-focused.spec.ts`(카탈로그 버튼/행 수) 까지. 그 스펙의 스윕 시험은 **스위치·효과음 칸을 채우지 않는다** — 없는 id 를 넣으면 「적용」이 이벤트를 저장하지 않아 내보내기가 빈 채로 나온다(예전 `sw_route_seen`/`se_route_chime` 이 그래서 0 개를 뱉었다).

### 체공 런타임 QA — `npm run qa:runtime -- --scenario hop`

jsdom 이 못 하는 것만 본다. 리프트는 Phaser 의 `displayOrigin` 에 실리고 `setFrame` 이 그것을
되돌리므로, **원점 계약의 최종 판정은 실제 Phaser 뿐이다.**

- 새 op: `playerRoute`(이동 경로를 주인공에게 직접 물린다), `waitForLift`(리프트 창을 조건으로
  대기), `waitForGrounded`(체공 상태기 소멸을 대기), `captureShadowSample`(픽셀 대조용 표본 프레임).
- 새 expect: `playerLiftPx(AtLeast)`, `playerSpriteY`(접지선), `playerAirborne`,
  `playerShadowVisible`(깊이 띠 0~100k + alpha>0 동시 확인), `playerShadowGroundY`(타원 아래 끝),
  `playerShadowInkAtLeast`(렌더된 픽셀 농도).
- **착지 판정은 `liftPx` 로 하지 마라.** 훅이 정수로 반올림하므로 착지 직전 프레임도 0 으로
  보인다 — `playerAirborne` / `waitForGrounded` 가 유일한 진실이다.

#### 오브젝트 축 검사는 "한 픽셀도 안 그려진 상태" 를 통과시킨다 (2026-08-29 실측)

그림자가 `visible=true`, alpha>0, 깊이 띠 안, 카메라 안인데도 화면에 전혀 없었다(원인은
`textures.createCanvas` + 나중에 그리기, `openwiki/runtime-battle.md` 참고). 그래서
`playerShadowInkAtLeast` 는 **렌더된 픽셀**을 잰다. 여기까지 오는 데 실패한 설계 두 개를 기록한다.

1. 같은 프레임에서 상자를 **위로** 옮겨 잡은 대조군 → 캐릭터의 발이 늘 거기 있어 측정이
   뒤집혔다(-0.036).
2. 같은 프레임에서 상자를 **아래로** 옮겨 잡은 대조군 → 지형 자체가 5% 어두워서 **완전 투명한
   그림자도 통과**했다(0.050 > 0.03).

지금 쓰는 방식은 같은 **월드 사각형**을 두 프레임에서 비교한다: 그림자가 떠 있던 프레임 대
캐릭터가 그 자리를 걸어서 떠난 뒤의 프레임. 지형이 동일하므로 차이는 그림자뿐이다.
눈금(실측): 정상 0.10~0.15 / 완전 투명 0.026~0.030(두 프레임의 카메라 스크롤 차이에서 오는
서브픽셀 잡음 바닥) → 하한 0.06. 측정은 고고도에서만 유효하다 — 낮은 고도에서는 캐릭터의 발이
상자를 덮는다.

### 워크트리에 `node_modules` 가 없을 때 (2026-08-29 실측)

`.herdr` 워크트리는 `node_modules` 를 공유하지 않고 `.vite` 캐시만 갖는 경우가 있어 `npm test`/`npm run typecheck` 가 바로 죽는다. 본 레포의 도구를 워크트리에 겨누면 된다.

```bash
cd /home/main/z-project/rpg-zzu
node node_modules/vitest/vitest.mjs run --configLoader bundle \
  --root /home/main/.herdr/worktrees/rpg-zzu/<name> test/characterHop.test.ts
```

타입체크는 워크트리 tsconfig 를 상속한 임시 설정에 `node_modules` 경로를 얹는다. `"*": ["*", ".../node_modules/*"]` 매핑을 빼면 `phaser` 가 TS2307 로 터지면서 수백 개 가짜 에러가 번진다.

```json
{ "extends": "/home/main/.herdr/worktrees/rpg-zzu/<name>/tsconfig.json",
  "compilerOptions": { "paths": {
    "@/*": ["src/*"],
    "*": ["*", "/home/main/z-project/rpg-zzu/node_modules/*"] } } }
```

## Roguelike run Phase 0–3 coverage (2026-08-24)

- `test/roguelikeRun.test.ts`: real interpreter lifecycle plus save-snapshot roundtrip.
- `test/roguelikeRunEditor.test.ts`: native condition/command forms and staged edit preservation.
- `test/commandContracts/runControl.contract.test.ts`: all action variants, inactive no-op behavior, non-blocking completion, and project serialization.
- `test/roguelikeRooms.test.ts`: exact deterministic slot selection, generation invalidation after floor/reset changes and same-seed restart, real `run_scene_test` enemy and one-shot loot reset behavior, live event-surface rebuild, save/load generation stability, event-reset opt-out, real-time enemy HP/projectile cleanup, active-run kill persistence isolation, AI tool authoring, import validation, and project roundtrip.
- Registry/shape coverage includes `runControl` and `run`; native manifest counts are 75 commands and 16 conditions at this phase.
- **Condition coverage (2026-08-29).** `test/conditionEvaluatorParity.test.ts` is the parity spine: it feeds identical `(condition, state)` pairs for all 16 kinds, in both a satisfying and a non-satisfying state, to all three evaluators (`pageResolution.evalPageCondition`, `session.evalCondition`, the battle runtime's `evaluateCondition`) and asserts identical verdicts. It also asserts `Object.keys(CASES)` equals `CONDITION_KINDS` in order, so a new union member fails the test until it is classified. `ALLOWLISTED_DIVERGENCES` is currently empty — record evidence before adding to it.
  `test/commandContracts/fork.contract.test.ts` covers all 16 kinds through the real interpreter drain; it previously covered only 10, with `timePhase`/`season`/`npcActivity`/`friendshipAtLeast`/`battleResult`/`run` proven at the `evalCondition` unit level but never through branch selection. It also pins that an empty friendship `npcKey` resolves via the host event's `characterId`.
  `test/pageConditionAuthoringIntegrity.test.ts` pins that a page condition survives an emptied reference (inline error, not deletion) and that touching a disabled row activates it visibly. `test/conditionEvalPreview.test.ts` pins the three-state 판정 불가 verdict. `test/conditionCopyTokens.test.ts` is the internal-token gate for condition copy.

### 조건 게이트를 부하 중에 재지 마라 (실측 2026-08-29)

`.omo/gates-baseline.json` 은 `baselineTrustworthy: false` 이고 이유가 적혀 있다 — 동일 코드로
연속 실행해도 실패 수가 170/187/195/203 으로 흔들리고 `failedFiles` 는 **합집합**이다.
실측: playwright 시간 QA 가 dev 서버를 돎리는 동시에 `npm run gates` 를 돌렸다가 24개 파일이
「새로 실패」로 찍혔고, 그 중에는 바로 전에 개별 실행으로 두 번 초록을 본 파일도 섞여 있었다.
따라서 게이트 회귀 파정은 **조용한 상태에서 해당 파일을 개별 재실행**해서 마무리해야 한다.
`typecheck:app` 은 기준선이 0 오류 + `baselineTrustworthy: true` 이므로 그곳의 오류는 바로 회귀다.

## Agent validation rule

**Authored game content** (demo maps, events, sample adventure data meant for the product): incomplete until **Supabase save + load-back** succeeds. Repo fixtures alone do not count. See root `AGENTS.md`.

Pick validation based on the touched boundary:

- Type-only or low-risk helper changes: run `npm run typecheck` plus a focused unit test if one exists.
- Project schema, migration, persistence, defaults, or references: run focused Vitest coverage for the changed path and include save/load or migration evidence.
- Default item/equipment catalog changes run `test/defaultItemCatalogQuality.test.ts` for Korean copy and shape coherence plus `test/itemRuntimeUsability.test.ts` for real field-menu/battle effect and consumption behavior. Keep the icon-coverage and default-database suites in the same focused gate.
- Terms/runtime label changes should cover `resolveTerms` defaults and overrides, old JSON with missing `meta.terms`, unknown term roundtrips, and focused DOM/model checks for battle command labels, shop text, inn text, and status/common labels when touched.
- Cluster-rule changes should include a focused validator test plus a commit-gate proof: a hard rule must still produce a `projectLint` error, `commitChangeset` must return `ok:true` for cluster-rule-only hard violations, and the fixed map should return `ok:true` without cluster-rule issues.
- Editor UI/workflow changes: run focused tests and drive the browser/editor surface with Playwright or an equivalent browser check.
- Desktop UI integration: use the Beginner/Standard/Expert shell matrix at `1024×768`, `1280×800`, and `1440×900`; separately exercise the event editor at `1586×992`, `1280×900`, `1024×768`, and `960×900`. Capture fresh three-mode shells, menu focus, shared modal, AI restore, event-editor, and title/load state; record viewport and localStorage setup next to the screenshots.
- The focused desktop regression batch includes the applicable UI unit files (modal stack, AI panel chrome, coachmarks, play input blocker, and title screen) plus `test/e2e/responsive-shell.spec.ts`, `test/e2e/desktop-editor-interactions.spec.ts`, `test/e2e/title-play-controls.spec.ts`, and the event-editor desktop flow. Use an isolated server port with `--workers=1`; fail on every browser error except the documented optional developer bridge refusal.
- `npm run build` is required before integrated UI handoff. The root supervisor, not a task worker, owns `npm run gates`; compare any gate result to the repository baseline instead of treating pre-existing failures as this task's regression.
- Modern Exteriors content/release validation is blocked without repository-visible redistribution rights. Do not run or claim its seed/reload/remote diagnostic, and do not write Supabase data as a replacement for the blocked validation.
- Canonical ice-terrain changes must run `test/iceDiagonalTerrain.test.ts`, `test/dungeonThemedLayouts.test.ts`, and `test/dungeonRoomPipeline.test.ts`. The exact Supabase crop fixture must stay unchanged; generated ridges must contain all six role tiles and return zero issues from `validateIceDiagonalTerrain`; the ceiling band must contain none of them. For authored output, save only a derived map id, reload it from Supabase, compare both tile layers, and capture small real editor-canvas regions against `map_g_ice_grand`.
- Chat dock layout regressions have a standing Playwright spec at `test/e2e/chat-dock-switch.spec.ts`; it covers **glass default**, glass → side → float movement, the side `↗` detach escape, the unclipped header menu, icon-first idle-screen choices and the input-only escape path, side panel ≈ layout 1/3 width, DOM preservation, persisted/reloaded dock state, collapsed float/side states, input focus, and viewport resize bounds. Unit coverage for the width helper lives with layout/panel tests (`computeSideChatWidth`). Auto expand/collapse (map-first default collapsed, expand on turn, re-collapse after idle when auto-expanded) is covered by `test/aiPanelAutoExpand.test.ts` plus chrome defaults in `test/aiPanelChrome.test.ts`. Run these when validating dock UI changes unless the task owner explicitly asks for spec authoring only.
- The genre-neutral authoring launcher and collapsed journey chip are covered by `test/authoringTasks.test.ts` and `test/authoringJourney.test.ts`; command reuse, loaded project identity, and player-boot evidence are covered by `test/commandRegistry.test.ts`, `test/loadNewRemoteProject.test.ts`, and `test/selectedEventTestModal.test.ts`. `test/quickBattleAuthoringGate.test.ts` drives the database basic-record button and proves broken references create no Quick Battle modal, session, or runtime. A Test click or synchronous `renderPlayer` return is not completion evidence. Passing coverage must observe actual `PlayScene` readiness, bind the success event to the current project fingerprint, invalidate it after authored changes, fail closed for stale/broken-reference events, keep manual acknowledgement distinct from completion, and exercise the exact issue list/Data repair path. `test/e2e/authoring-journey.spec.ts` proves the journey stays a corner chip, the topbar launcher still reaches Data, and the open popover keeps the 1024px font/target/clipping contract.
- Runtime/player/battle changes: run focused unit tests plus the smallest e2e or browser scenario that proves the behavior in play mode.
- Weather rendering has one Phaser-owned runtime path (`playSceneWeather.ts`). Focused tests assert the pure Phaser render plan for rain, storm, snow, fog, and none. The retired DOM overlay/CSS path must not be restored.
- Web export/player-bundle changes should cover project serialization roundtrip, used-asset collection, `export_game` summary data, `build:player` output files/HTML structure, and practical bundle string checks for editor/AI/remote-provider leakage such as `supabase` and `llm-provider`. Manifest coverage must prove the exact transitive Vite JS/CSS/assets closure, runtime asset hashes, missing/malformed/tampered/interrupted reads, and Unicode full-casefold collisions across manifest/generated ZIP sets (at minimum sharp-s, Greek final sigma, compatibility ligatures, and NFC composition). Pin the offline Unicode 15 data version, authoritative input digests, table counts, and fail-closed stream validation; keep post-version drift canaries such as U+1C89/U+1C8A and U+10D50/U+10D70. A Unicode data regeneration must independently compare every scalar key and run every NFKC relation in the official `NormalizationTest.txt`. Fetch/parser/hash and atomic serialize/open/write/fsync/close/rename/remove adapters must turn `Error` and non-`Error` throws into stable value-free typed failures while preserving the prior manifest and cleanup behavior. Keep every product/source module below the programming LOC ceiling or document an approved exception. When the task owner forbids Playwright for export smoke, stop at static output validation and report the manual serving path instead.
- Community player pipeline changes must run `npm run test:node playerArtifactPipeline` (or `node --test test/playerArtifactPipeline.node.test.mjs test/playerArtifactPipelineRollback.node.test.mjs test/playerArtifactPipelineGuard.node.test.mjs test/playerArtifactPipelineRecovery.node.test.mjs`) in disposable roots. Cover installed tamper/missing/extra, old lock, source/runtime/deployment digest drift, redacted scan/adapter failures, copy and post-copy rehash failures, all four target/lock rename positions both before and after native rename side effects, lock serialize/open/write/fsync/close failures, guard open/write/fsync/close/remove faults, concurrent/replacement ownership, dead-PID guard recovery, interrupted backup/staging recovery, raw preflight failures, and physical Windows junction/symlink escape rejection with an unchanged outside canary. Every pre-commit failure must leave the prior target and lock byte-identical and leave no task-owned guard/staging/backup residue. Do not exercise sync against the repository's real `dist/export-player`, `community-site/public/player-static`, or lock until the final artifact-install task owns that mutation.
- Community play-route/package-contract changes must cover canonical `.oprn` export, legacy `.rpgzzu` import, real reader/writer normalization and reload identity, encoded hostile slugs, typed boot-config roundtrip, stable save namespace, localized return URL, visibility-before-shell, real editor-schema rejection of malformed objects, traversal 400, missing/invisible 404, corrupt/adapter 500, and value-free error bodies. Drive the actual exported shell plus Korean/English errors in Chromium at desktop/mobile/tablet widths; use injected adapters and fixture packages only, with no production DB writes or credentials.
- Battle flow changes should cover both `"gauge"` regression and `"strict"` round collection/resolution. For strict, assert actor command collection, enemy AI inclusion, agility ordering, actor-first/index tie breaks, round-unit state upkeep, hidden gauge UI, and `simulate_battle` round logs from a scripted replay.
- Exact Gen1 battle changes must keep the pure golden vectors (`gen1DamageGolden`, `gen1CaptureGolden`, `gen1StatusGolden`) and the live runtime wiring suite (`gen1RuntimeExactIntegration`) green. Include nominal-100% 1/256 miss, physical/special classification by element, player PP timing and legal Struggle/recoil, support-only auto fallback, non-link enemy unlimited PP, omitted-active-slot 1v1, post-hit chance byte boundaries, custom type-id semantics, major-status type immunity, wake-turn loss, residual KO, second-major-status rejection, trainer capture blocking, exact capture/shakes, captured-state filtering/HP clamp, and monster plus actor PP save roundtrips. Injected constant RNG must terminate; it may not hang rejection sampling. Pair these with RM2K3 runtime/prediction regressions before handoff.
- Active-slot/switch battle changes should cover active/reserve snapshot composition, strict switch-first resolution, forced switch after active defeat, defeated reserve exclusion, gauge immediate switch/gauge reset, participant tracking, and `simulate_battle` strict scripts with `"switch"`.
- Runtime growth changes should cover class override save/load compatibility, effective-class stats/skills/equipment/commands, promotion requirements and branch behavior, reward policies using `participatingActorIds`, and equipment effects for element resistance, state resistance, and double attack. Include a command-contract file for any new native event command kind.
- Save-slot regression tests must cross the real storage codec (`saveToSlot`/`writeAutosave` -> `readSaveSlot`/`readAutosave` -> `applySaveSnapshot`); direct `createSaveSnapshot` -> `applySaveSnapshot` tests cannot detect fields dropped by the known-field JSON parser. Active/reserve monster reward tests must assert both persisted EXP and result-screen level-up previews against `participatingActorIds`.
- Monster collection changes should cover capture formula boundaries, uncapturable troop blocking, deterministic IV generation, party-six overflow to box, save/load plus legacy-save compatibility, captured-enemy EXP exclusion, `simulate_battle` strict `"capture"` scripts, and starter-choice event walkthroughs. Evolution/type changes should additionally cover level/item/friendship requirements, item consumption, HP-ratio preservation, learned target-species skills, automatic post-victory evolution, `evolveMonster` success/failure branches, type-chart single/dual/STAB/immunity multipliers, missing-chart regression, and `simulate_battle` favorable/unfavorable damage comparisons. Care-item tests must reject missing/zero, non-finite, unsafe, and over-cap source stacks and assert exact session non-mutation, including friendship and EXP. Include a command-contract file for any new native event command kind and run `node scripts/generateToolCatalog.mjs` when `define_monster_species`, `set_type_chart`, or `give_starter_monsters` schemas change.
- Hunting-runtime changes should cover weighted encounter distribution with fixed seeds, switch/variable/level/region filtering, field-spawn maxAlive/respawn/passable-cell selection, save/load policy that excludes spawn runtime state, `run_scene_test` field-spawn contact battle/respawn assertions, and a headless hunting-growth path that reaches promotion requirements.
- Farming-runtime changes should cover till/plant/water/harvest state transitions, unwatered-day growth stop, season-change death, regrow harvest cycles, save/load preservation, farmableArea bounds, crop DB/tool schemas, `advanceCropGrowth`, and a `run_scene_test` path that plants, waters through `advanceDays`, asserts `cropStageAt`, harvests, and asserts `inventoryCount`.
- P0 life-runtime changes use `test/p0RuntimeIntegration.test.ts`, `test/p0DayTransitionSceneFailure.test.ts`, `test/p0TransitionControlFlow.test.ts`, `test/p0LifeLedgerUi.test.ts`, and `test/p0SessionPersistence.test.ts`. Required hostile cases are exact and zero-minute day boundaries, `restorePerDay: 0`, repeated/source-stale transition keys, malformed/current/non-adjacent saved cursors, non-safe and absolute-minute-overflow saved clocks, already-settled and invalid shipping, season day 28 plus custom season boundaries, stale maker state, maker-disabled overflow bypass plus maker-enabled overflow fail-closed, insufficient-energy all-or-nothing area actions, success-only crop/rock/tree XP, manual/autosave/checkpoint cursor roundtrip, legacy menu absence, generated-art wiring, four tab roles/action indices, long labels, empty states, and pure API-backed UI actions. Preflight failures must show `day-transition-error` without running hooks/fades/success refreshes. Post-fade hook failures must roll the session back, fade in, refresh/sync the restored surfaces, and remain visibly failed. Blocking interpreter sleeps must not resume later commands after `false`; ordinary fire-and-forget sleep/advance paths must observe false/rejected promises. Parallel sleep/advance cases must stay pending without resuming, resume only after success, and retain a stopped process/error surface without executing later commands after false or rejection.
- P1 weather/animal foundation changes use `test/p1FoundationSchema.test.ts`. Keep authored normalize/shape/serialize/deserialize/start-session coverage together with manual save, autosave, and checkpoint round trips. Hostile coverage must include unknown weather enums, duplicate ids, over-limit arrays, non-finite or unsafe numeric fields, writer/parser/direct-apply sanitization, one-day-only weather persistence (no forecast snapshot), and schema-v3 saves that omit both optional runtime fields.
- P1 daily-weather runtime changes use `test/p1WeatherCalendar.test.ts` and `test/p1WeatherDayTransition.test.ts`. Keep fixed-seed/day determinism, season/year forecast boundaries, authored `forecastDays`, all-zero/malformed table fallback, disabled-package clearing, and exact `session.rng` non-mutation under repeated/out-of-order forecast queries. The farming handoff must reject stale/non-rain/zero-intensity weather, be idempotent, skip dead/untilled plots, and prove rain/storm watering happens before `syncFarmPlotsToDate`. Actual `dayTransition.ts` wiring is an integration-owner test and must preserve atomic transition rollback.
- P1 farm-animal runtime changes use `test/p1FarmAnimals.test.ts` and `test/p1SessionPersistence.test.ts` together with the foundation suite. Cover compatible assignment/move and capacity, missing species/building/item refs, duplicate or malformed live instances, empty arrays, atomic feed debit and same-day receipt, late/future care rejection, friendship cap, both-care production eligibility, per-species cadence, exact-once/future advance cursors, whole-herd product overflow rollback, atomic ready-product collection, valid moved-home save roundtrip, stale-home fallback, and deterministic unassignment of saved capacity overflow. `test/p1DayTransitionIntegration.test.ts` additionally proves source-day care produces after the other stages and animal overflow rolls back weather, calendar, shipping, farming, energy, and makers with the live session unchanged. `test/p1HostileAudit.test.ts` independently guards live-calendar care, future production, capacity repair, disabled screen-weather clearing, and stale saved-weather replacement. `test/p1RuntimeUi.test.ts` proves an animal-only package exposes the life ledger, generated animal artwork is wired, and feed/pet/collect buttons mutate only through the animal authorities.
- P1 browser gates are `test/e2e/stardew-p1-editor.spec.ts` and `test/e2e/stardew-p1-runtime.spec.ts` against Supabase project `rpg-zzu-stardew-demo`. They verify the four authored season tables, both species, the placed home and two event-bound animals, HUD date/current weather/forecast/birthday, visible animal event sprites, generated animal art, real feed/pet actions, containment, and horizontal overflow at 1024×768 and 1440×900. Screenshots are tracked under `.superpowers/sdd/qa-shots/stardew-p1/`. `net::ERR_ABORTED` is accepted only as navigation/teardown cancellation and the absent optional local browser bridge is the only allowed connection refusal; other request failures, page exceptions, and console errors fail the specs.
- Stardew life-content validation additionally runs `test/stardewDemo.test.ts`, `test/databaseCropView.test.ts`, `test/databaseCharacterView.test.ts`, and `test/databaseMonsterSpeciesView.test.ts`; live persistence uses `RPG_ZZU_LIVE_SUPABASE_ROUNDTRIP=1 npx vitest run test/stardewSupabaseRoundtrip.live.test.ts --configLoader runner`. Browser evidence comes from `test/e2e/stardew-life-content.spec.ts` (remote project, 1024/1440 DB layouts and card navigation), `test/e2e/stardew-resident-runtime.spec.ts` (loved gift response +80), and the explicit diagnostic specs `_farm-loop-probe`, `_farm-visual-inspect`, `_mine-loop-probe`. Use a unique `DEV_SERVER_PORT`; evidence is written under `output/evidence/stardew/` and must be visually inspected, not accepted from exit status alone.
- Friendship/gift/seasonal-shop changes should cover friendship clamp/save-load, deterministic gift preference deltas, daily gift limits and next-day reset, `friendshipAtLeast`, `getFriendship` variable bridging, `giftSystem` off regression, legacy shop-without-stock regression, seasonal stock filtering/prices, `set_shop_stock`/`make_villager` tool contracts, and a `run_scene_test` path that gives a loved gift, asserts `friendshipAtLeast`, branches dialogue, advances days into another season, and asserts `shopStock`. Gift-consumption tests must reject missing/zero, non-finite, unsafe, and over-cap source stacks and assert exact session non-mutation, including birthday friendship and `dailyGifts` receipt state.
- Troop battle-event changes should cover page conditions for `onRound`/`everyRound`, `enemyHpBelow`, and switch state; `runOnce`; supported message/choices/common-event/vital commands; unsupported-command logs/lint; and event logs returned through runtime snapshots or `simulate_battle`.
- Play status menu keyboard regressions are covered by `test/e2e/oprn-menu-keyboard-tour.spec.ts`; it is intentionally long (`test.setTimeout(120_000)`) and tours item use, skills, equipment, save/load, row, formation, quests, wait, and title return using keyboard navigation.
- Wiki-only changes: run `npm run openwiki:verify`.

- `npm test` runs the Vitest unit suite.
- `npm run test:node` runs the `node:test` suite. It **discovers** `test/**/*.test.mjs` through `scripts/run-node-tests.mjs` instead of listing files, and fails when discovery returns nothing. Do not replace it with a hardcoded file list: `playerArtifactPipeline*` (4 files), `playerArtifactContract`, and `playerReleasePreflight` (85 cases total) were silently unreachable for months because Vitest's `include` is `test/**/*.test.ts` and the only npm entry point named two OAuth files explicitly. It now gates CI in the `unit-tests` job of `.github/workflows/parity.yml`.
- `npm run test:ai-oauth` filters the same runner down to the OAuth files. The ported OAuth stack is pinned by `test/oauthCredentials.test.ts`(요청 자격 패커·만료 거절), `test/codexOAuthFlow.test.ts`(device 흐름, 주입 fetch/sleep), `test/antigravityOAuthFlow.test.ts`(인가 URL·프로젝트 발견·온보딩 재시도), `test/oauthLoopbackCallback.node.test.mjs`(바인드 우선·포트 점유 폴백·정리), `test/ohMyPiWorker.node.test.mjs`(인증은 Node / 완성은 Bun 워커), `test/ohMyPiLiveLogin.node.test.mjs`(**실제 제공자 엔드포인트**를 우리 코드로 친다). OAuth 스위트는 시간에 기대지 않는다: 폴링·재시도 대기는 주입된 sleep 으로 즉시 끝나고, 상한은 호출 횟수로 검증한다. 저장소 경로 env(`RPG_ZZU_OH_MY_PI_AUTH_PATH`)는 `scripts/lib/aiAuthRuntime.ts` 를 **import 하기 전에** 정해야 한다 — 저장소가 모듈 로드 시점에 만들어지므로 static import 로는 늦는다(그래서 두 node 스위트가 동적 import 를 쓴다).
- `npm run test:parity` runs the editor->player parity suite (`test/parity/`: contract matrix resolver, parity rig, battle/actor-class/round-trip/scene behavioral parity, golden-project playthrough, and the play-boot validation gate). It gates CI via `.github/workflows/parity.yml`; heavy Playwright e2e is nightly/optional and does NOT gate CI.
- Vitest uses a 15 second per-test timeout in `vitest.config.ts`; several headless walkthrough/autosave tests can exceed the default 5 seconds during full-suite parallel runs even when they pass focused.
- `npm run typecheck` verifies TypeScript only.
- `npm run build` must pass before merge-ready work.
- `playwright` / `npm run test:e2e` covers browser `test/e2e` flows.
- Database permanent QA specs (2026-08 beginner campaign): `test/e2e/qa-overview.spec.ts` (overview dashboard chips/curve/scatter/issue-jump, F1/F4/F5/F7 contracts), `qa-characters.spec.ts` (character profile CRUD + orphan-id card + '이벤트로 이동'), `qa-tilesets.spec.ts` + `qa-structure-kits.spec.ts` (tileset inspector fields + stamp empty/registered states), and `qa-db-beginner-mode.spec.ts` (beginner chrome: Tools-menu entry, common-6 nav + `db-nav-all`, plain jargon labels, dirty guard in beginner lane). All five must stay green in one run: `npx playwright test test/e2e/qa-overview.spec.ts test/e2e/qa-characters.spec.ts test/e2e/qa-tilesets.spec.ts test/e2e/qa-structure-kits.spec.ts test/e2e/qa-db-beginner-mode.spec.ts` (14 tests). Broken product contracts discovered later must move to audit specs as findings — permanent specs are green-only.
- Diagnostic audit family `test/e2e/_db-audit-*.spec.ts` (+ shared helper `test/e2e/dbAuditHelpers.ts`): adversarial probes that RECORD findings instead of failing green contracts (crud-battle, crud-collection, matrix, commands, utility-system, chrome, visual-capture). Underscore-prefixed specs are excluded from normal runs by `playwright.config.ts` `testIgnore: ["**/_*.spec.ts"]`; run them by naming the file explicitly on the CLI or with `E2E_INCLUDE_DIAGNOSTICS=1` (the config flips `testIgnore` off when either is detected). Test-level timeouts are expected probe limitations, not harness failures. Findings land as scored JSON (S×B rubric, `docs/reviews/db-beginner-heuristics-rubric.md`) in `output/evidence/db-beginner-audit/findings/` (gitignored); each spec truncates its own findings file at run start, so a completed run yields a clean file. Consolidated ledger: `docs/reviews/db-beginner-adversarial-qa-findings.md`.
- `vitest` is for focused unit tests and fast iteration.
- `run_scene_test` is the headless tick-based scene harness for authored runtime moments that need camera/spawn/picture/audio/session assertions. Use it when `play_walkthrough` is too coarse for cutscenes, timed scenes, trap retry loops, hunting spawns, farming plots, gifts, seasonal shops, or ending selection; it is a read tool and uses a session copy only. It supports `gift`, `retryCheckpoint`, and `advanceDays` steps plus `gameOver`, `playerAt`, `fieldSpawnCount`, `cropStageAt`, `inventoryCount`, `friendshipAtLeast`, `shopStock`, and `endingReached` expectations. Both `advanceDays` and natural exact clock crossings invoke `transitionToNextDay`, so headless assertions observe the same shipping settlement, energy restore, maker advancement, farm growth, and transition cursor as PlayScene.
- Calendar/time-system changes should cover minute/hour/day/season/year rollover, phase boundaries, menu/battle/cutscene pause, `forceSleep`, `onDayEnd` ordering, save/load plus legacy-save compatibility, custom `daysPerSeason` wire preservation (including day 40), and omitted-`timeSystem` regression. Include `run_scene_test` assertions for `gameTimeAt`, `timePhase`, `advanceDays`, page-condition branches, and time-gated encounter tables.
- NPC schedule changes should cover `when` matching for phase/season/dayRange/hourRange, same-map walking plus final facing, offscreen cross-map relocation, paused-time no-op behavior, dialogue/wait interruption and resumption, no-regression for unscheduled NPCs, save/load of schedule runtime fields, and `run_scene_test` assertions using `eventAt`, `eventOnMap`, and `npcActivity` page branches. Map-reference work also runs `test/npcScheduleReferenceIntegrity.test.ts`: unknown/blank/missing maps, fractional/negative/out-of-bounds coordinates, orphan hosts, exact deletion-impact row paths, target-only cascade, valid duplicate-row roundtrip, and scheduled event-ID global-key collisions are mandatory hostile cases.
- Checkpoint/trap/ending runtime changes should include focused Vitest for checkpoint save/restore, `killPlayer` game-over retry, `triggerEnding` priority choice, and ending-tool warnings, plus a `run_scene_test` fixture that walks into a trap, retries, and reaches an ending.
- Follower/chase runtime changes should include focused Vitest for A* detours, sight/give-up limits, follower trail inheritance, and save/load preservation. Include `run_scene_test` coverage for obstacle chase distance reduction, safeZone non-contact, chase touch plus checkpoint retry, and `addFollower` followed by `followerAt`.
- Lighting runtime changes should include focused Vitest for mask input calculation, ambient transition interpolation, attached-light tracking, deterministic flicker, save/load preservation, and `set_lighting_volume` map/event modes. Include `run_scene_test` coverage for `lightingAmbient`, `lightAt`, and `lightCount`, especially player-attached flashlight movement and `removeLight all`.
- Phase 6b atmosphere changes should include focused Vitest for `showAnimation` target coordinate resolution and `wait:true` blocking, deterministic storm flash timing, fog/weather save-load round trips, and `set_scene_mood` argument composition. Include `run_scene_test` coverage for `weatherKind`, `animationPlaying`, and fog combined with Phase 6a lighting.
- Investigation/puzzle authoring tools should include focused Vitest for batch hotspot skip/warning behavior, self-switch once pages, compile snapshots for all puzzle kinds, deterministic solvability rejection, and `run_scene_test` assertions for sequence success/reset, item-gate locked/unlocked, and push-switch completion.
- Horror/mystery prototype QA uses `src/testing/horrorExperienceQa.ts` as a strict, repeatable experience proxy rather than claiming simulated human taste. The project-specific plan in `src/testing/horrorMysteryQaPlan.ts` must exercise locked-gate feedback, wrong-answer recovery, the critical path, trap and chaser death with checkpoint retry, and two distinct endings through the real scene runner. Any mandatory scenario failure, lint error, silent lethal event, missing safe zone, or failed/missing browser smoke is a blocking failure; score alone cannot override it.

- **One-command horror browser-evidence contract (Slice A + indent):** `npm run qa:horror` is the single automated gate and needs **no human-maintained evidence** — it (1) runs `scripts/capture-horror-browser-evidence.mts` (`npm run capture:horror`) which **always owns a freshly verified-free port and an exact spawned process from this worktree** — spawned via `process.execPath` on the Vite JS entry with `shell:false`/`windowsHide:true` so the ChildProcess IS the server process and cleanup tears it down on Windows and Linux (no cmd-wrapper orphan; see `scripts/lib/vite-invocation.mjs` + `test/viteInvocation.test.ts`), passing `--strictPort`. **It never reuses an already-listening server** — an occupied port (this app or foreign) is an explicit failure via `planServerOwnership` (`scripts/lib/horror-capture-rules.mjs` + `test/horrorCaptureRules.test.ts`). Content binding uses a deterministic canonical digest (`scripts/lib/canonical-project-digest.mjs`) computed independently on Node (Supabase reload) and in-browser from actual project data, compared, mismatch hard-fails, and expected+observed digests are persisted; it also asserts the live session's exact expected startMapId/startPos x/y, and observes the required start-map custom BGM (cc0-bgm-dungeon → cave-theme.ogg) request+playback via a `window.__oprnAudioObserved` hook (`src/player/audio/audioEngine.ts`) — a broken required BGM fails. `browser-title.png` = title before play, `browser-play-start.png` = after play; browser-qa.json persists start-phase screenshots plus expectedStart/contentDigest/bgm fields. Launches headless Chromium against the real editor URL `/?project=rpg-zzu-horror-mystery-prototype-v1`, observes the real UI: title resource + image load, desktop touch-pad absence, the actual play-session start map id/x/y and passability (via live `__oprnDebug.readState()` + `isPassable`), and console/page/request errors — writing `output/evidence/horror-mystery-prototype/browser-qa.json` plus that title screenshot, then cleaning up its child server/browser on success and failure (bounded waits, no process-wide kill); (2) verifies source identity from `window.__oprnProjectE2E.currentProject()` digest binding and **fails** if it is not `rpg-zzu-horror-mystery-prototype-v1` or the content differs, with credentials never reaching output; (3) then reloads the project id from Supabase, combines the runs with the fresh evidence (guarded by `capturedBy` provenance + 5-minute freshness window + reject more than 30s in the future via `scripts/lib/horror-browser-evidence.mjs`), and emits JSON and Markdown reports. Documented optional-developer-bridge/telemetry request noise (`__oprn/ai-activity`, `dbserver:8100`, `127.0.0.1:17xxx` companion) is excluded from `consoleErrorCount`. Regression coverage lives in `test/horrorBrowserEvidenceFreshness.test.ts`, `test/horrorCaptureRules.test.ts`, `test/canonicalProjectDigest.test.ts`, and `test/horrorBgmAndScreenshots.test.ts`. `scripts/build-horror-mystery-prototype.mts` runs via the separate **`npm run build:horror`** script (author/build path, distinct from QA).
- Semantic scene-runner contracts (`test/horrorSemanticScenarios.test.ts`) pin the evaluator's observable evidence so a silent no-op can never score as feedback:
  - **locked-gate-feedback** requires a runner-observable message — `SceneTestResult.finalState.messages` accumulates the transcript and the runner exposes a `messageShown` expect; an interact that produces no text fails.
  - **wrong-answer-recovery** requires an explicit incorrect transition: after a wrong sequence press the progress variable (`var_<puzzle>_step`) must reset to 0 *and* a wrong-answer message must be shown. A solver that merely ignores the wrong input fails. These came from a hostile review — prior scenarios only asserted unchanged switches/inventory, so a silent no-op passed.
  - **critical-path** uses only contiguous legal `move` steps (reachability-checked) from `project.startMapId`/`startPos` through actual transfers/landings, checkpoint, corridor, and finale — no `set`/teleport navigation skips. It asserts transfer landing passability, the checkpoint snapshot captured after the actual gallery→chase transfer, and `bgmPlaying` after corridor/finale entry. The runner now applies each map's authored BGM (`resolveMapBgm` + `applyMapBgmToSession`, session-only, no engine) on initial entry and every transfer.
  - A map authored with `bgm.mode="custom"` must resolve its `resourceId`; `evaluateHorrorExperienceQa` emits `audio:unresolved-resource` and fails the build when `resolveAudioSource` returns null (a broken id would otherwise play silent).
  - Reachability and checkpoint-rollback protections are preserved — trap/chaser retry tests still assert full rollback (switch/inventory), not just position.
- Story flag / narrative-state changes should include focused Vitest for registry declare/rename/retire, auto target allocation, duplicate id/target rejection, usage-index accuracy across page conditions, conditional branches, setSwitch/setVariable, move-route setSwitch, common events, and troop battle events, plus projectLint warnings for read-without-write, write-without-read, undeclared use, retired target use, and legacy projects with no `storyFlags`. Quest graph changes should cover DAG validation/cycle rejection, dead-end write-site lint, unreachable/orphan node warnings, storyFlag condition resolution, `generate_walkthrough` JSON schema compatibility with `run_scene_test`, manualHint `set` fallback, and `verify_quest` success/failure reporting. `explain_event` coverage should evaluate all existing page-condition kinds and include an integration fixture proving concise `get_story_state`, `find_flag_usage`, and a blocked page summary such as `S3=off` for page 2.
- World graph changes should cover schema normalization, missing-node and duplicate-edge rejection, `link_maps` bidirectional idempotency, role-default map generation in `build_world`, adjacent boundary passability warnings, transfer destination/event-overlap errors, and a `run_scene_test` chain across generated maps.
- Large-project regression coverage lives in `test/fixtures/largeProject.ts` and `test/largeProjectPerf.test.ts`. The fixture should remain deterministic at 50 maps of 40x40 tiles, and the test should keep loose timing/size thresholds for deserialize normalization, serialized byte size, and a one-map 100-tick `run_scene_test` path.
- Cutscene timeline work should cover `test/cutsceneCompiler.test.ts` for beat-to-command snapshots, begin/end and validation failures, plus a `run_scene_test` integration fixture that proves camera/picture state and post-cutscene input unlock. Use `cutsceneLocked` expectations for explicit lock assertions.
- Tileset intelligence UI changes should include focused Vitest coverage for review queue ordering/state transitions, correction save metadata and undo, locked AI-write preservation, mock re-audit candidate flow, and palette preset CRUD before running the full suite.
- Tileset vocabulary cleanup must separately cover palette presets (`test/tilesetPaletteT1a.test.ts`), review/legacy metadata compatibility (`test/tilesetT1bReviewUi.test.ts`, `test/tileMetadataTools.test.ts`, `test/tilesetSectionTabs.test.ts`), and build tile-group bootstrap (`test/buildPalette.test.ts`). A rename of build-palette group symbols must leave persisted group ids and `tileset.palettePresets` unchanged.
- Tileset knowledge changes run the manual contract suite (`test/tilesetGridSelection.test.ts`, `test/tilesetKnowledgeTemplates.test.ts`, `test/tilesetDirectionalPassage.test.ts`, `test/tilesetKnowledgeContract.test.ts`, `test/repeatableBlockGrammar.test.ts`, `test/tilesetKnowledgeWorkspace.test.ts`) plus the AI workspace suite (`test/tilesetAiNativeReviewModel.test.ts`, `test/tilesetAiNativeAnalysis.test.ts`, `test/tilesetAiNativeReviewApply.test.ts`, `test/tilesetAiConversationSession.test.ts`, `test/tilesetAiWorkspaceModal.test.ts`, `test/tilesetAiCpenClient.test.ts`). The AI suite must prove that the normal manual editor remains visible, the bottom trigger is the only AI entry, whole-atlas analysis is detached, the workspace advances through its three-step wizard (`analyze → questions → summary`, with natural-step derivation and manual stepper navigation), AI questions and quick replies parse safely, answers carry into reanalysis, a per-question discard action skips the current proposal, confirmed groups remain staged until one explicit apply on the summary step, and human locks/stale fingerprints are preserved. Browser coverage is `test/e2e/tileset-ai-native-review.spec.ts` for manual surface → modal open → three-step flow (analyze status, questions with discard, summary list, apply) → export persistence, plus `test/e2e/tileset-knowledge-authoring.spec.ts` for the unchanged executable manual editor.
- AI boundary regressions must additionally cover keyless relative-proxy auth (no browser `Authorization` header), fail-closed mixed/duplicate tile-id arrays, overlapping-proposal arbitration, and executable 9×9 atlas placement (`test/clusterRulePlacement.test.ts`, focused with `-t "9x9 물 아틀라스"` while unrelated baseline failures remain in that file).
- `npm run perf:bench` runs the Node headless performance budget harness and writes JSON evidence under `evidence/perf/`.
- The perf benchmark measures data-pipeline paint latency, edit render diff planning, undo snapshot bytes, and deserialize+validate load time; it intentionally excludes Phaser render.
- Do not add the perf benchmark as a CI gate unless the budget policy changes, because local timing is machine-dependent.
- For focused selection, run a single file, pattern, or test name instead of the full suite.
- House-harness door/interior changes should cover `test/houseKit.test.ts`, `test/villageBuilder.test.ts`, interpreter command coverage, and `test/e2e/village-house-interior-transfer.spec.ts` for the play-mode action transfer round trip.
- Natural-village grammar changes must cover `test/naturalVillageReference.test.ts`, `test/houseKit.test.ts`, and `test/villageBuilder.test.ts`. The contract checks staged direct-authoring maps, shape/kit/story diversity, one intact door pair per house, no adjacent windows, four boundary road exits with no house-footprint intrusion, short fence fragments, bounded straight-road runs, interior mixed-tree density, varied props, and scheduled NPC activity/movement diversity. Authored evidence is complete only after `scripts/author-natural-village-reference.mts` and `scripts/author-natural-village-harness.mts` save and reload their project ids from Supabase. Browser evidence must use the editor's map screenshot action (not a viewport/editor screenshot); `scripts/capture-natural-village-reference.mts` captures every stage and `scripts/capture-natural-village-harness.mts` captures the final generated comparison. Capture evidence classifies the optional `127.0.0.1:17831` developer bridge separately and fails on unexpected network request failures. `scripts/generate-natural-village-report.mts` builds the linked HTML evidence report.
- Interior wall-contract changes (Option B: 주택 통타일 grammar + 다크 `366` 저장 + 렌더 전용 쿼터 소스) run as one focused batch: `npx vitest run test/interiorRoomPipeline.test.ts test/interiorAutotile.test.ts test/darkWallAutotile.test.ts test/interiorWallFrameQuarterComposition.test.ts test/legacyInteriorWallContract.test.ts test/tilesetHarness.test.ts`. Must assert: blank interior tileset seeds **no** wall-frame store group and the dark group stores `366` only; quarter composition fires only when the center is `366` and returns `null` for house ids/`430`; house grids carry cream 2-row + `457` cap with `458`/`456` joints and a `398|72|396` door over a `397` step; no `233`/`257`/`258` anywhere; user-authored autotile groups survive a harness re-seed; legacy diagnosis reports ambiguous maps without mutating them. Visual evidence is generated, never hand-drawn — `bun scripts/render-interior-wall-contract-cases.mts` rewrites `docs/interior-wall-frame-cases/*.png` from the real APIs and asserts the contract inline (105 must quarter-compose 0 cells; house grids must contain a cap and no forbidden tile).
- Terrain-template tests should not be reintroduced. When changing persistence around old project JSON, prove legacy `terrainTemplates` are dropped on load and absent after serialize.
- M2 event-command test contracts (2026-08-08 repair): a Page-3 rich-form test earns its place only by driving the form, asserting the resulting command JSON, **and** asserting the runtime effect through `executeM2RuntimeCommand`. Existence-only assertions (a testid renders, a shell mounts) certify nothing and must be rewritten to that shape or deleted — `test/page3CommandBodies.test.ts` traded nine such checks for seven full form→JSON→runtime contracts. `test/commandContracts/m2Command.contract.test.ts` covers every behavior-full command id and must keep map/common effects separate from troop parser effects: running troop-only commands through the map harness silently passes. Native aliases are converted by `newCommand` for picker authoring while persisted `m2Command` aliases stay runtime-partial and fallback-safe; assert both halves. Staged-state regressions belong in `test/eventEditorStagedState.test.ts` using its `stagedContext(initial)` harness.
- Editor command bodies must never spread the render-time `cmd` in a commit handler; that loses a prior field edit in the same form session. Patch from `context.getCurrentCommand?.()` instead, via the shared `replaceFields(context, cmd, fields, removeKeys?)` exported from `src/editor/panels/eventEditor/commandBodyM2Page3.ts` (or the local `latestShop`/`latestChoices`/`latestFork`/`updateField` equivalents). One-time seeds are the only legitimate `...cmd` spread. Any new command body needs a consecutive-two-field-edit case proving both survive.

Evidence expectations:
- Official cross-genre readiness is machine-computed by `evaluateOfficialGenrePackReadiness` from the exact five contracts in `src/project/officialGenrePackRequirements.ts` (`horror-chase`, not the old `horror` id), native command guarantees, authored command presence, real `projectLint` output, and semantic assertion receipts. Capability and authorship are separate gates: a globally supported command does not make a blank project ready. Map/common/troop command indexes include nested branches and exclude uncommitted new-event drafts. Status is only `blocked`, `incomplete`, or `ready`; there is no caller-supplied certification flag. Missing authored content is `incomplete`, while partial/missing runtime support, invalid evidence, or blocking lint is `blocked`; the known partial monster commands therefore stay blocked.
- Screenshot counts are never a genre pass condition. `verifyGenrePackAssertionReceipts` requires schema version 1, exact receipt/assertion keys, a 64-hex canonical project revision, and every declared assertion for every official pack. Direct callers must supply `validateEvidence`; omitting it fails every assertion with `evidence-validation-missing`, so a non-empty path string is never structural proof by itself. The CLI command is `npm run verify:genre-packs -- <assertion-receipts.json> <serialized-project.json>`; it canonicalizes and hashes the deserialized project, requires each evidence path to resolve to a regular JSON file beneath `evidence/`, `output/evidence/`, or `.omo/evidence/` (including realpath containment), validates `{schemaVersion,packId,assertionId,projectRevision,status}`, and sets final `ok` only when both evidence verification and the actual project readiness matrix pass. A path string, screenshot volume, or valid assertion files for a blank project cannot turn the gate green.
- `browser-verify:genre` addresses cards by stable `data-pack-id`, requires the exact official five without missing/extra/duplicate ids, and requires each click to detach the welcome DOM. `partner-raise` is only a welcome variant of `monster-collect`; it is never a sixth official pack. Diagnostic screenshot quantity is not part of the verdict.
- `play_walkthrough` publishes one provider-safe object schema with all optional variant fields and no `oneOf`/`anyOf`. `runWalkthrough` strictly validates each `do` / `expect` variant, required types, allowed fields, and mixed shapes before running step zero. A `kind`-shaped step or a choice step carrying map fields fails with a `scenario[index]` reason and `stepsRun: 0`.
- Record the exact command run.
- Capture pass/fail output or a short log excerpt.
- For UI/e2e work, include the tested route and scenario.
- If a test is skipped or flaky, say why and what remains unverified.


## Event-editor trust-loop validation (2026-07-30)
- This repository pins `vitest` exactly to `3.2.4` in both `package.json` and `package-lock.json`. In the current Windows/Node toolchain, Vitest 4.x fails before test collection with runner/config initialization errors; do not loosen or upgrade this pin without separately proving the full gate. Focused invocations use `--configLoader runner`.
- Event draft/editor changes should run `npm run typecheck:app` plus: `npx vitest run test/eventDrafts.test.ts test/eventDraftVault.test.ts test/eventDraftValidator.test.ts test/eventBeginnerTemplates.test.ts test/eventTestSandbox.test.ts test/eventEditorTrustLoop.test.ts test/selectedEventTestModal.test.ts --configLoader runner`.
- Required assertions are canonical projection while editing, crash/replace recovery, Cancel rollback, Apply/OK/Test fatal blocking, recursive nested validation and navigation, safe record-backed beginner templates, newest-first recents and roving tabs, focus/caret/details/scroll restoration, sandbox-only selected draft injection, deterministic spawn, real `initialEventTestId` player wiring, and zero `store.flush()` calls on the selected-event path. Follow with `npm run gates`, `npm run build`, and a practical browser smoke for merge-ready UI work.

## 얼굴 바꾸기(changeFace) 폼 시각 계약 (2026-08-28 실측)

- 게이트: `npx playwright test test/e2e/event-face-command-visual.spec.ts` + `npm run gates:css`(graph 고아 0건, 예산 래칫 회귀 0건).
- 이 스펙이 잡는 것은 **얼굴이 두 장 겹쳐 보이는** 회귀다. `facesetPreview.faceImage()` 는
  얼굴 상자에 `--face-url` CSS 배경(로드 실패 폴백)을 깔고 그 안에 실제 `<img>` 를 넣는다.
  두 규칙(`<img>` 절대 배치 + 배경 끄기)을 담고 있던
  `event-editor.command-preview/07-identifiable-previews.css` 가 **어떤 배럴에도 @import 되지
  않은 고아 파일**이라 `<img>` 가 `position:static` 원본 크기(48×48)로 흘러가고 배경은 상자
  전체(96×96)에 `contain` 으로 깔렸다. 실측: 얼굴 상자 115개 중 114개가 이중 페인트.
- 계약 3줄: (1) `<img>` 가 있으면 상자의 computed `background-image` 는 `none`,
  (2) `<img>` 는 `position:absolute` 로 상자 내부를 정확히 채운다, (3) `<img>` 를 떼면
  배경 폴백이 되살아난다. 배경/`<img>` 를 **같은 크기로 맞추는 것만으로는 부족하다** —
  nearest-neighbour 래스터화 결과가 미묘하게 달라 배경이 테두리에서 1px 새어나온다.
- 대비는 computed 색이 아니라 **렌더된 픽셀**로 본다. `.ecp-message-window` 가 불투명
  `--bg-surface` 층을 어두운 유리 색 위에 깔고 있던 동안 computed 대비는 17.8:1 로
  보였지만 실제 페인트는 #FFF6E2 on #F7F8F8 = **1.0:1** 이었다.
- 배경/전경 층 순서를 만질 때는 `.ecp-message-window` 를 공유하는 문장 표시·선택지·문장
  표시 설정 미리보기도 같이 눈으로 확인한다.

## P2 spatial focused gate (2026-08-25)

- Schema/legacy/roundtrip: `test/p2SpatialSchema.test.ts`.
- Atomic economy, collision, move/upgrade/rotation/removal: `test/p2SpatialTransactions.test.ts`.
- Save writer, wire parser, direct checkpoint, explicit-empty and omitted-legacy behavior: `test/p2SpatialPersistence.test.ts`.
- Definition/placement FK, footprint collision, repair, map cascade and delete guards: `test/p2SpatialReferenceIntegrity.test.ts`.
- Database CRUD/navigation and runtime visibility: `test/p2SpatialEditorAuthoring.test.ts`, Database sidebar suites, and `test/p2SpatialRuntimeUi.test.ts`.
- Root integration performs real browser QA at 1024x768 and 1440x900 using `db-tab-farm-spatial`, `db-spatial-workspace`, `db-spatial-hero-image`, CRUD testids, and `life-ledger-tab-spaces`. This isolated implementation does not claim browser evidence.

## 워크트리 e2e 는 dev 서버가 조용히 안 뜬다 (2026-08-27 실측)

- `playwright.config.ts` 의 `webServer.command` 는 `npm run dev -- --port <DEV_SERVER_PORT>` 인데
  `npm run dev` 스크립트가 `--port 9999 --strictPort` 를 하드코딩한다. 메인 세션이 9999 를 점유하면
  vite 가 즉시 죽고 지정 포트에는 아무것도 LISTEN 하지 않는다 → 모든 스펙이 `edit-canvas` 를 못 찾는다.
  타임아웃을 15s→120s 로 늘려도 똑같이 실패하므로 "머신이 느려서" 로 오진하기 쉽다.
- 판별: `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:<port>/` → `000` 이면 서버가 없다.
- 회피: `DEV_SERVER_NO_TLS=1 npm run dev:worktree -- --port <free>` 로 직접 띄우고
  `DEV_SERVER_PORT=<free> npx playwright test ...` 로 실행한다(`reuseExistingServer: true`).
  포트는 `ss -tlnp` 로 실측해서 고른다 — `wt create` 가 배정한 포트도 이미 점유돼 있을 수 있다.
- 브라우저 QA 중에 다른 에이전트가 `src/` 를 편집하면 HMR 리로드가 끼어들어
  `ERR_NETWORK_CHANGED` 가 쏟아지고 편집기 부팅이 깨진다. 소스가 조용할 때 브라우저 증거를 잡아라.

### `locator.click()` 은 잘림 버그를 구조적으로 못 잡는다 (2026-08-29 실측)

Playwright 의 `locator.click()` 은 누르기 전에 `scrollIntoViewIfNeeded` 를 한다. **사람은 화면 밖이라 못 누르는 버튼도 테스트는 스크롤해서 누른다.** 그래서 "클릭 성공"은 그 버튼이 보인다는 증거가 되지 못한다. DB 구조물 탭의 `[편집]` 이 화면 밖 67px 에 있었는데 e2e 가 초록불이었던 이유가 이것이다.

- 판정은 **좌표로** 해라: `scroller.scrollTop = 0` 으로 되돌린 뒤 `getBoundingClientRect()` 를 재고,
  `document.elementFromPoint(중심)` 이 그 버튼(또는 그 자손)인지 본다. 그리고 `scrollHeight - clientHeight === 0`(스크롤 여지 없음)을 함께 확인한다. 마지막 증명은 `page.mouse.click(좌표)` — 이건 자동 스크롤을 거치지 않는다.
- `toBeVisible()` 도 부족하다. Playwright 의 "visible" 은 `display`/`visibility`/크기만 보고 **조상의 `overflow` 로 잘렸는지는 보지 않는다.**
- **접두사가 겹치는 testid 를 `^=` 로 잡지 마라.** `[data-testid^="structure-kit-edit-"]` 는 `structure-kit-editor`·`-editor-close`·`-editor-canvas` 까지 다 잡아 strict 위반이 난다. 컨테이너 클래스로 좁혀라(`.structure-kit-actions [data-testid^=...]`).
- **탭 전환은 헤딩 가시성으로 확인하면 안 된다.** DB 사이드바 탭을 누른 직후 초기화 경합에 밀려 `activeTab` 이 기본값으로 되돌아가는 것을 실측했다(구조물 → 파티). 공용 헬퍼 `switchDatabaseTab`(`test/e2e/oprn-database-helpers.ts`)을 써라 — 그룹을 순회해 찾고 **탭 버튼의 `.active`** 까지 확인한다. 그룹 슬러그를 직접 박아 넣으면(`db-tab-group-map` 같은 존재하지 않는 값) 헬퍼가 통째로 죽어도 아무도 모른다.
- **점 한 번 찍는 `count() > 0` 은 렌더 경합에 진다.** 다이얼로그가 그려지기 전에 0 을 읽고 그냥 지나쳐 버린다. `expect(async () => {...}).toPass()` 로 감싸라.
- 케이스마다 앱을 통째로 부팅하는 스펙은 `--workers=1` 로 돌려라. 병렬로 겹치면 다운로드 이벤트·다이얼로그 렌더가 밀려 간헐 실패한다(실측: 병렬 2건 실패 → 직렬 4건 전부 통과).

### 스크롤이 생겼다고 다 닿는 건 아니다 — 가운데 정렬 넘침 (2026-08-30 실측)

`scrollHeight > clientHeight` 가 참이어도 **넘친 내용의 시작 쪽은 스크롤로 닿지 않을 수 있다.** `place-content: center` / `align-items: center` 인 스크롤 칸에서 자식이 칸보다 크면 위·왼쪽으로도 넘치는데, 스크롤 원점이 콘텐츠 박스 시작이라 그 위쪽은 영구히 가려진다. 실측: 200×100 칸에 300px 자식 → `center` 는 `scrollHeight` 200(100px 유실) + `scrollTop=0` 에서 자식 top 이 칸 top 보다 **99px 위**, `safe center` 는 `scrollHeight` 300 + top 1.

- 판정 스니펫: `const t = box.scrollTop; box.scrollTop = 0; const gap = child.getBoundingClientRect().top - box.getBoundingClientRect().top; box.scrollTop = t;` — `gap` 이 음수면 그만큼 못 닿는다.
- `scrollHeight` 를 콘텐츠 실제 크기와 대조하는 것도 같은 결함을 잡는다(40칸×16px = 640 이어야 하는데 589 가 나오면 잘렸다).
- 고침은 `safe` 키워드. 크로미움 115+ / 파이어폭스 129+ / 사파리 17.6+ 이고 이 저장소 플레이라이트 크로미움에서 `getComputedStyle(...).alignContent === "safe center"` 로 지원을 확인했다.

### 미정의 커스텀 프로퍼티는 콘솔에 아무 말도 남기지 않는다 (2026-08-30 실측)

`background: var(--없는토큰)` 은 대체값이 없으면 **계산값 시점에 선언 자체가 무효**가 되어 초기값(`transparent`)으로 떨어진다. 콘솔 경고도, devtools 취소선도 없다. 구조물 편집기 다이얼로그가 배경 없이 떠서 뒤의 DB 표가 뚫려 보이던 원인이 이것이고, `--oprn-*` 60개 중 23개가 이 상태였다.

- 확인은 **계산값으로** 해라: `getComputedStyle(el).backgroundColor === "rgba(0, 0, 0, 0)"` 이면 죽은 선언이다. 소스 CSS 를 읽어서는 알 수 없다.
- `npm run gates:css` 의 `undefinedVars` 지표가 이걸 센다. 숫자가 줄면 죽은 선언을 살린 것이다.

### `ERR_NETWORK_CHANGED` 는 HMR 말고 호스트 인터페이스 때문에도 터진다 (2026-08-28 실측)

- 증상: `page.goto` 는 성공했는데 화면이 **완전 백지**이고 aria 스냅샷이 비어 있다. 콘솔에 앱
  에러는 없고 `net::ERR_NETWORK_CHANGED` 만 모듈 요청 수십 개에 붙는다. `edit-canvas` 대기가
  120s 까지 늘려도 실패한다 → "머신이 느리다" / "앱이 깨졌다" 로 오진하기 쉽다.
- 원인: 크로미움은 OS 네트워크 변경 알림(리눅스 netlink)을 받으면 **진행 중인 요청을 전부 취소**한다.
  알림이 요청별이 아니라 프로세스 전역이라 `127.0.0.1` dev 서버 접속까지 함께 죽는다. 이 박스에서는
  **도커 브리지가 오르내리는 것**(`ip -br link` 에 `br-*` 가 `NO-CARRIER` 로 뜬다)이 방아쇠였다.
  다른 에이전트가 컨테이너를 띄우거나 내리는 동안 e2e 가 돌면 재현된다. HMR 과 무관하게 발생한다.
- 판별: `ip -br link | grep NO-CARRIER` 로 흔들리는 인터페이스를 확인한다. dev 서버는 정상
  (`curl` 200)인데 브라우저만 백지면 이쪽이다.
- 회피 1: `gotoWithRetry`(#154, `test/e2e/oprn-database-helpers.ts`)를 쓴다 — 전송 계층 중단을
  한 번 재시도한다. 계약은 `test/e2e/goto-retry-network-change.spec.ts` 가 고정한다.
- 회피 2: 인터페이스가 계속 흔들리는 동안에는 **파이어폭스로 돌린다.** 파이어폭스는 그 알림에
  반응하지 않는다. 스펙 파일 맨 위에 한 줄이면 된다:
  `test.use({ browserName: "firefox", viewport: { width: 1600, height: 1000 } });`
  프로젝트 이름은 그대로 `[chromium]` 으로 찍히지만 실제 엔진은 파이어폭스다 — 로그 라벨을
  근거로 "크로미움에서 통과했다" 고 보고하지 말 것. 파이어폭스 바이너리가 없으면
  `npx playwright install firefox` 로 받는다.
- 실측 사례: DB 사이드바 레일 작업(#160)에서 크로미움으로 두 번 연속 백지가 나 증거를 못 잡았고,
  파이어폭스로 바꾸자 같은 트리에서 즉시 통과했다. 그 스펙은 지금도 파이어폭스로 돈다.

## 런타임(게임) 전용 비전 QA 하네스 (2026-08-28)

게임 화면을 브라우저로 QA 할 때 **편집기 셸을 통과하지 마라.** `npm run qa:runtime`
(반복) / `npm run qa:runtime:gate` (게이트). `player.html` 을 전용 vite 서버로 띄워
편집기 크롬 0, HMR 유지, 출하 shim 경로를 그대로 통과한다. 편집기 play 모드는 실제
`@/project/store`, 내보내기 플레이어는 `exportProjectStoreShim` 을 쓰므로 **편집기
경로로 하는 런타임 QA 는 출하물을 검증하지 않는다.**

- 결과는 `verify-shots/runtime-qa/<시나리오>/SUMMARY.md` 를 **먼저** 읽고 "즉시 확인" 으로
  표시된 PNG 만 열어라. `shot` 은 옵트인이고 실패 비트는 자동 캡처된다. 출력 디렉터리는
  매 실행 재생성되며 gitignore 대상이다.
- 시나리오는 `scripts/qa/runtime/<name>.scenario.mjs`. 좌표 기대치는 추측하지 말고
  `scripts/_dump-event-tiles.mjs` 로 실물에서 읽어라.
- 체공(점프·낙하) 시나리오와 그 전용 op/expect 는 위 "체공 런타임 QA" 절에 있다. 거기서
  얻은 일반 교훈: **오브젝트가 존재한다는 검사는 그것이 그려졌다는 뜻이 아니다.**
- 전투 주스가 맵을 드러내는 회귀는 `test/runtime/battle-flash-map.spec.ts` 가 잠근다. 같은 QA
  서버로 `player.html` 을 띄워 `battle-v3.json` 시작 맵(0,0) 오른쪽 `battleProcessing` 이벤트로
  **실전투 DOM** 에 들어간 뒤, 한 번의 rAF 샘플 시리즈에서 세 가지를 같이 본다: 루트
  `background-color` 알파 == 1, `.battle-field::after` 오버레이 알파 > 0(플래시가 사라지지
  않았다는 증명), 루트 `transform` 의 translate 성분 == 0. 알파를 **클래스 부착 지속 시간에
  기대어 재지 마라** — 런타임은 `setTimeout` 으로 클래스를 떼므로 판정이 그 뒤로 밀리면
  오버레이가 `rgba(0,0,0,0)` 으로 읽힌다(실측으로 버진 경합). 샘플러는
  `getAnimations().playState` 가 running 인 동안만 돌고 스스로 멈춘다.
- 누출은 필드가 백드롭 이미지로 닫혀 있어서 **필드-HUD 4px 거터와 HUD 패널 사이**에서 가장
  자명하다. 새 증거를 모으려면 30x30 마을 프로젝트(`editor-authored-demo-v3.json`, 시작 맵
  `ev_lantern_training` 이 (20,14))로 띄우면 뒤에 새는 타일이 눈에 보인다. RED/GREEN 실측은
  `.omo/evidence/battle-flash-map/` 에 있다.
- 시나리오는 `query` 로 `player.html` 쿼리를 붙일 수 있다(예: `{ e2eVitals: "1" }` → 액터
  바이탈 훅 `__oprnSetActorVitals` 개방). `setVitals` op 은 그 훅으로 파티 전원(또는
  `actorIds`)의 HP/MP 를 세운다. `expect.battleResult` 는 `session.battleResult` 를 대조한다.
- `battle-defeat` 시나리오가 전투 패배 → 게임 오버 결말의 실기 증거다. 파티를 HP 0 으로
  만들어 전투 개시 시점에 `defeat` 을 확정시킨다 — **검증 대상이 전투 산식이 아니라 호스트의
  패배 처리 경로**이기 때문이다. HP 1 로는 패배가 재현되지 않았다(`battleDamage.ts:175` 는
  `power + floor(atk/2) - floor(def/2) <= 0` 이면 데미지 0 → 약한 적 앞에서 1 HP 파티가
  무적이 되고, 실측에서 레벨 1 파티가 108HP 트룹을 이겨 `battleResult=victory` 가 찍혔다).
- `battle` 시나리오는 `map_moonwell_forest` 의 봉인 이벤트(14,2 · `movement: fixed`)로
  `troop_forest_hornets` **3마리 전투**에 들어가고, `battlerGeometry` 기대치가 실브라우저
  rect 로 배틀러 배치를 판정한다(적 이미지가 필드 안에 온전히 있는지 + 발이 백드롭
  지평선 33% 아래인지). CSS 레이아웃은 jsdom 으로 재현되지 않으므로 이 기하는 실브라우저
  측정만이 근거다. 12종 스킨 전수는 `system.battleUiStyle` 만 바꾼 픽스처 사본에
  `--project` / `--out` 을 붙여 같은 시나리오를 돌려서 본다.
- `battlerGeometry` 는 네 축이다: 필드 담기 · 발이 지평선 아래 · 스프라이트 크기 0 아님 ·
  **적끼리 겹침 아님**. 겹침 축이 없던 동안 rm2000/dragonquest/mv 가 3마리를 한 점에 겹쳐
  그리면서 통과했다 — 담기·지평선만 보면 "완전히 겹친 한 덩어리"가 정답으로 보인다.
- 스윕은 스킨마다 서버·브라우저를 새로 띄운다. **도는 중에 `git stash` 같은 트리 변경을 하면
  안 된다** — 실측: 스윕 중 stash 로 ff 런이 "전투가 시작되지 않았다"로 죽었다(내 변경이
  사라진 트리를 읽었다). 결과가 오염되면 그 스킨만 다시 돌려라.

함정 (전부 실측):
- `vite.player.config.ts` 는 `publicDir: false` 다. 그대로 dev 서빙하면 번들 텍스처
  (`assets/easyrpg-*.png`, `public/assets/` 34개)가 전부 404 → **조용한 검은 스크린샷**.
  `vite.player-qa.config.ts` 가 되살린다.
- 워크트리는 `node_modules` 를 메인 레포로 심링크해 `node_modules/.vite` 까지 공유한다.
  다른 config 로 서버를 띄우면 공유 캐시를 재최적화해 **남의 dev 서버를 죽인다**
  (`vite.config.ts:350-354`, 실측 3회). 반드시 전용 `cacheDir` / `VITE_CACHE_DIR`.
- `vite.config.ts` 의 `server.fs.allow` 는 `../rpg-zzu/node_modules`(구 형제 워크트리
  `rpg-zzu-*`)만 넓힌다. **`.claude/worktrees/*` 에서는 존재하지 않는 경로로 풀려 편집기
  dev 서버가 phaser 를 403 으로 막는다.** 올바른 일반화는 `realpathSync("./node_modules")`.
- 고정 키 횟수로 대사를 소진하면 닫힌 뒤 남은 Enter 가 NPC 를 재발동시켜 선택지가 다시
  열린다. `pressUntil` op(매 입력 후 조건 확인)을 써라.
- **`__oprnDebug.teleport` 는 맵 비교를 세션 쓰기보다 먼저 해야 한다 (2026-08-28 수정).**
  이전 구현은 `applyAndSync` 로 `session.currentMapId` 를 먼저 갈아치운 뒤
  `getMapId() !== mapId` 를 비교해서 **`loadMap` 이 한 번도 호출되지 않았다** — 세션만 새 맵을
  가리키고 화면은 옛 맵을 계속 그렸고, `expect.mapId` 는 세션 값을 읽으니 그 거짓말을 통과시켰다
  (smoke 시나리오의 맵 전환 비트가 그 상태였다). 지금은 이전 mapId 를 캡처해 비교한다.
  같은 맵 안 재배치는 여전히 스프라이트를 옮기지 않는다(`loadMap` 을 부를 이유가 없다).
- `movement` 가 `fixed` 가 아닌 NPC 는 같은 세션 안에서 배회한다. 고정 좌표 인접을 전제한
  상호작용 비트는 취약하다.
- `__oprnPlayerSprite().resourceId` 가 채워져 있어도 `textureKey` 는 `__MISSING` 일 수 있다
  (Phaser 초록 와이어프레임). 게이트는 `playerSpriteTextureLoaded` 축으로 봐야 한다.
- `test/fixtures/projects/oprn-sample-v3.json` 은 플레이어 캐릭셋이 `__MISSING` 으로 그려진다
  (픽스처 4개 중 이것만, 같은 `resourceId`, 실패 요청 0건). 원인 미규명. 기본 픽스처는
  `editor-authored-demo-v3.json` 을 쓴다.

## sceneTestRunner 의 자율 이동 관측 공백 (2026-08-27)

- `src/testing/sceneTestRunner.ts` 는 추격(chase) 무버만 시뮬레이션하고 무작위·접근·사용자 지정
  페이지 이동은 굴리지 않는다. 그래서 `{ kind: "expect", eventAt: <원래 좌표> }` 는 NPC 가
  실제로 움직이든 안 움직이든 통과한다 — "안 움직인다" 류 회귀를 이 러너로 증명하지 말라.
  단위 레벨은 `test/runtimeEventPageMovement.test.ts`, 실물은 브라우저 Test Play 로 잡는다.

## fakeDom 은 프로덕션이 쓰는 브라우저 전역을 빠짐없이 준다 (2026-08-29)

`vitest.config.ts` 는 `environment: "node"` 라서 DOM 전역이 하나도 없다. `test/fakeDom.ts` 의
`installFakeDom()` 이 주는 것만 존재한다. 그 목록에 **생성자 전역 `Image` 가 빠져 있었다** —
`HTMLImageElement` 는 `instanceof` 용으로 매핑돼 있었는데(`defineDomGlobal("HTMLImageElement", FakeElement)`)
`new Image()` 가 쓰는 생성자는 없었다. 실측: 전체 스위트 오류 230건 중 **222건이
`ReferenceError: Image is not defined`** 였고, 발화점은 `src/editor/panels/chromaKey.ts:110`
(`getAutoKeyedDataUrl`) **한 곳**, 귀속 파일은 `databaseWorkbench`·`databaseFilterChips`·
`databaseRecordThumbnails`·`eventEditorTrustLoop` **4개**였다.

핵심은 스텁이 **무엇을 발화하는가**다. `getAutoKeyedDataUrl` 은 `load` 와 `error` 양쪽에서
resolve 하고 error 분기는 원본 URL 을 캐시·반환한다. 그래서 `FakeImage` 는 `src` 대입 시
`queueMicrotask` 로 `error` 를 **딱 한 번** 발화한다(`addEventListener` 가 `{ once: true }` 를
무시하므로 발화 횟수는 스텁이 보장한다). 아무 이벤트도 쏘지 않는 스텁을 넣으면 222건의 rejection 이
222건의 **무한 pending** 으로 바뀐다 — 오류가 타임아웃으로 옷만 갈아입는 셈이다. 계약 테스트:
`test/fakeDomImageGlobal.test.ts`.

Unhandled Rejection 은 그 순간 실행 중이던 아무 파일에 귀속되므로, 이 종류의 누락은
**비결정적 오귀속**의 원인이 된다. 새 브라우저 전역을 프로덕션이 쓰기 시작하면 `fakeDom` 의
`DomGlobalName` 유니온·save/restore 목록·`defineDomGlobal` 세 곳을 같이 늘려야 한다.

## bugfix-sweep 실제 표면 하네스 (2026-08-29)

`node scripts/qa-bugfix-sweep-evidence.mjs` 는 **프로젝트의 Vite SSR 모듈 파이프라인**으로
프로덕션 함수를 끝까지 실행해 관측값을 `.omo/evidence/bugfix-sweep/real-surface.txt` 에 남긴다.
검사 4건: 프로젝트 교체 후 Ctrl+Z / 묶음 조건 안 스위치의 삭제 가드 / `inputNumber` 만 쓰는 변수의
prune 판정 / 명시적 초안 저장 뒤 중복 쓰기.

왜 vitest 가 아니라 별도 러너인가: 이 네 가지는 **한 흐름으로 이어 태워야** 사용자가 겪는 순서가
되고, 산출물이 사람이 읽는 증거로 커밋된다. 왜 `npx tsx` 가 아닌가: `supabaseProjectConfig()` 의
`env` 기본값이 `import.meta.env` 라서 tsx 에서 `undefined` 로 터진다 — Vite 파이프라인을 타면 앱과
같은 해석 경로가 된다. `createServer` 에 `watch: null` 을 준 이유는 워처가 시스템 inotify 한도를
넘겨(ENOSPC) 죽었기 때문이다(스위트와 동시에 돌 때 특히).
