# Testing

Use the lightest command that proves the change.

## Agent validation rule

Pick validation based on the touched boundary:

- Type-only or low-risk helper changes: run `npm run typecheck` plus a focused unit test if one exists.
- Project schema, migration, persistence, defaults, or references: run focused Vitest coverage for the changed path and include save/load or migration evidence.
- Cluster-rule changes should include a focused validator test plus a commit-gate proof: a hard rule must still produce a `projectLint` error, `commitChangeset` must return `ok:true` for cluster-rule-only hard violations, and the fixed map should return `ok:true` without cluster-rule issues.
- Editor UI/workflow changes: run focused tests and drive the browser/editor surface with Playwright or an equivalent browser check.
- Chat dock layout regressions have a standing Playwright spec at `test/e2e/chat-dock-switch.spec.ts`; it covers float default placement, side docking persistence, DOM preservation, collapsed float/side states, input focus, and viewport resize bounds. Run it when validating dock UI changes unless the task owner explicitly asks for spec authoring only.
- Runtime/player/battle changes: run focused unit tests plus the smallest e2e or browser scenario that proves the behavior in play mode.
- Battle flow changes should cover both `"gauge"` regression and `"strict"` round collection/resolution. For strict, assert actor command collection, enemy AI inclusion, agility ordering, actor-first/index tie breaks, round-unit state upkeep, hidden gauge UI, and `simulate_battle` round logs from a scripted replay.
- Active-slot/switch battle changes should cover active/reserve snapshot composition, strict switch-first resolution, forced switch after active defeat, defeated reserve exclusion, gauge immediate switch/gauge reset, participant tracking, and `simulate_battle` strict scripts with `"switch"`.
- Runtime growth changes should cover class override save/load compatibility, effective-class stats/skills/equipment/commands, promotion requirements and branch behavior, reward policies using `participatingActorIds`, and equipment effects for element resistance, state resistance, and double attack. Include a command-contract file for any new native event command kind.
- Monster collection changes should cover capture formula boundaries, uncapturable troop blocking, deterministic IV generation, party-six overflow to box, save/load plus legacy-save compatibility, captured-enemy EXP exclusion, `simulate_battle` strict `"capture"` scripts, and starter-choice event walkthroughs. Evolution/type changes should additionally cover level/item/friendship requirements, item consumption, HP-ratio preservation, learned target-species skills, automatic post-victory evolution, `evolveMonster` success/failure branches, type-chart single/dual/STAB/immunity multipliers, missing-chart regression, and `simulate_battle` favorable/unfavorable damage comparisons. Include a command-contract file for any new native event command kind and run `node scripts/generateToolCatalog.mjs` when `define_monster_species`, `set_type_chart`, or `give_starter_monsters` schemas change.
- Hunting-runtime changes should cover weighted encounter distribution with fixed seeds, switch/variable/level/region filtering, field-spawn maxAlive/respawn/passable-cell selection, save/load policy that excludes spawn runtime state, `run_scene_test` field-spawn contact battle/respawn assertions, and a headless hunting-growth path that reaches promotion requirements.
- Troop battle-event changes should cover page conditions for `onRound`/`everyRound`, `enemyHpBelow`, and switch state; `runOnce`; supported message/choices/common-event/vital commands; unsupported-command logs/lint; and event logs returned through runtime snapshots or `simulate_battle`.
- Play status menu keyboard regressions are covered by `test/e2e/rm2k3-menu-keyboard-tour.spec.ts`; it is intentionally long (`test.setTimeout(120_000)`) and tours item use, skills, equipment, save/load, row, formation, quests, wait, and title return using keyboard navigation.
- Wiki-only changes: run `npm run openwiki:verify`.

- `npm test` runs the Vitest unit suite.
- Vitest uses a 15 second per-test timeout in `vitest.config.ts`; several headless walkthrough/autosave tests can exceed the default 5 seconds during full-suite parallel runs even when they pass focused.
- `npm run typecheck` verifies TypeScript only.
- `npm run build` must pass before merge-ready work.
- `playwright` / `npm run test:e2e` covers browser `test/e2e` flows.
- `vitest` is for focused unit tests and fast iteration.
- `run_scene_test` is the headless tick-based scene harness for authored runtime moments that need camera/spawn/picture/audio/session assertions. Use it when `play_walkthrough` is too coarse for cutscenes, timed scenes, trap retry loops, hunting spawns, or ending selection; it is a read tool and uses a session copy only. It supports `retryCheckpoint` steps plus `gameOver`, `playerAt`, `fieldSpawnCount`, and `endingReached` expectations.
- Calendar/time-system changes should cover minute/hour/day/season/year rollover, phase boundaries, menu/battle/cutscene pause, `forceSleep`, `onDayEnd` ordering, save/load plus legacy-save compatibility, and omitted-`timeSystem` regression. Include `run_scene_test` assertions for `gameTimeAt`, `timePhase`, `advanceDays`, page-condition branches, and time-gated encounter tables.
- Checkpoint/trap/ending runtime changes should include focused Vitest for checkpoint save/restore, `killPlayer` game-over retry, `triggerEnding` priority choice, and ending-tool warnings, plus a `run_scene_test` fixture that walks into a trap, retries, and reaches an ending.
- Follower/chase runtime changes should include focused Vitest for A* detours, sight/give-up limits, follower trail inheritance, and save/load preservation. Include `run_scene_test` coverage for obstacle chase distance reduction, safeZone non-contact, chase touch plus checkpoint retry, and `addFollower` followed by `followerAt`.
- Lighting runtime changes should include focused Vitest for mask input calculation, ambient transition interpolation, attached-light tracking, deterministic flicker, save/load preservation, and `set_lighting_volume` map/event modes. Include `run_scene_test` coverage for `lightingAmbient`, `lightAt`, and `lightCount`, especially player-attached flashlight movement and `removeLight all`.
- Phase 6b atmosphere changes should include focused Vitest for `showAnimation` target coordinate resolution and `wait:true` blocking, deterministic storm flash timing, fog/weather save-load round trips, and `set_scene_mood` argument composition. Include `run_scene_test` coverage for `weatherKind`, `animationPlaying`, and fog combined with Phase 6a lighting.
- Investigation/puzzle authoring tools should include focused Vitest for batch hotspot skip/warning behavior, self-switch once pages, compile snapshots for all puzzle kinds, deterministic solvability rejection, and `run_scene_test` assertions for sequence success/reset, item-gate locked/unlocked, and push-switch completion.
- Cutscene timeline work should cover `test/cutsceneCompiler.test.ts` for beat-to-command snapshots, begin/end and validation failures, plus a `run_scene_test` integration fixture that proves camera/picture state and post-cutscene input unlock. Use `cutsceneLocked` expectations for explicit lock assertions.
- Tileset intelligence UI changes should include focused Vitest coverage for review queue ordering/state transitions, correction save metadata and undo, locked AI-write preservation, mock re-audit candidate flow, and palette preset CRUD before running the full suite.
- `npm run perf:bench` runs the Node headless performance budget harness and writes JSON evidence under `evidence/perf/`.
- The perf benchmark measures data-pipeline paint latency, edit render diff planning, undo snapshot bytes, and deserialize+validate load time; it intentionally excludes Phaser render.
- Do not add the perf benchmark as a CI gate unless the budget policy changes, because local timing is machine-dependent.
- For focused selection, run a single file, pattern, or test name instead of the full suite.
- House-harness door/interior changes should cover `test/houseKit.test.ts`, `test/villageBuilder.test.ts`, interpreter command coverage, and `test/e2e/village-house-interior-transfer.spec.ts` for the play-mode action transfer round trip.
- Terrain-template tests should not be reintroduced. When changing persistence around old project JSON, prove legacy `terrainTemplates` are dropped on load and absent after serialize.

Evidence expectations:
- Record the exact command run.
- Capture pass/fail output or a short log excerpt.
- For UI/e2e work, include the tested route and scenario.
- If a test is skipped or flaky, say why and what remains unverified.
