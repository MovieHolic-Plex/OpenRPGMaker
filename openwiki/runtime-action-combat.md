# Runtime Action Combat

> **2D 타일 액션 전투 지원 (2026-09-07).** 기존 액션 런타임을 신규 저작에도 사용한다. `action-rpg` 장르는 시스템 설정을 켜며, 개별 맵의 옵트인은 계속 명시적으로 지정한다. RM식(`rm2k3`)과 포켓몬식(`gen1`)은 턴제 전투 모델이고, 액션 전투는 별도의 이중 옵트인 패키지다. 스폰 수·대기·턴제 씬 테스트는 액션 검증이 아니다. 브라우저 AI의 완료 판정은 현재 프로젝트에 귀속된 실제 플레이어 전투 증거를 요구한다.

The action HUD displays the lead actor's effective equipped weapon and the
canonical attack/moving-dodge bindings. The farming hand chip is hidden on
action maps without farmable areas; mixed maps keep an explicitly labelled
farming chip. Menus and dialogue retain their existing HUD suppression.

This page is the authority for the real-time action-combat package in OPRN Studio. It documents the activation contract, pure rule modules under `src/battle/action/`, the scene integration layer, player and enemy capabilities, schema definitions, authoring boundaries, and verification targets.

## Activation contract

Action combat is strictly opt-in and dual-gated:

```ts
// src/project/actionCombat.ts
export function isActionCombatMap(project: Project, map: GameMap | undefined | null): boolean {
  return project.system.actionCombat?.enabled === true && map?.actionCombat === true;
}
```

Both conditions must hold:
1. `project.system.actionCombat.enabled === true`
2. `map.actionCombat === true`

If either condition is falsy, field-spawn contact routes to standard turn-based battles via `runFieldSpawnEventBattle` in `src/player/playSceneFieldSpawns.ts`. When both are true, contact enters real-time action combat in `src/player/playSceneActionCombat.ts`, and random encounters on that map are suppressed (`test/actionEncounterGuard.test.ts`).

The shipped action maps are:
- `map_mine_1f` in the farming demo project (`createFarmingDemoProject` in `src/project/defaults/defaultProject.ts`), spawning `troop_bat_swarm` and `troop_golem_guard`.
- `map_action_demo` in `createActionCombatDemoProject` (`src/project/defaults/actionCombatDemoProject.ts`, persisted under project id `rpg-zzu-action-demo`).

## Architecture and pure rule modules

Action-combat rules live in pure TypeScript modules under `src/battle/action/`. These modules do not import Phaser, DOM elements, or scene state. They take plain data inputs and return immutable outcomes.

```
src/battle/action/
├── attackWindow.ts      # Player attack input buffering during weapon cooldown
├── combatMath.ts        # Swing damage and contact damage calculation
├── contact.ts           # Conditional contact damage rules
├── dodge.ts             # Stamina-costed dodge with invulnerability frames (i-frames)
├── guard.ts             # Hold-guard damage reduction and stamina drain
├── hitbox.ts            # Discrete swing arc cells and sub-tile point overlap
├── hitstop.ts           # Micro hitstop freeze calculation
├── kiting.ts            # Ranged enemy distance bands (retreat / hold / advance)
├── knockback.ts         # Real 1-tile grid knockback with collision and resist checks
├── simulate.ts          # Headless balance simulator consuming the pure rule modules
├── skillSlots.ts        # Action skill slot filtering, capping, and cycling
└── stagger.ts           # Enemy hit stagger and windup/dash cancellation
```

### Rule module responsibilities

- **`attackWindow.ts`**:
  Manages the player attack buffer. When the player presses attack during swing cooldown, `bufferAttackPress` stores the request with a bounded lifetime (`ATTACK_BUFFER_LIFETIME_MS = 250`). When cooldown reaches zero, `tickAttackBuffer` fires exactly one swing and clears the buffer. Old presses beyond the lifetime window expire without firing.
- **`combatMath.ts`**:
  Calculates swing and contact damage.
  - `computeSwingDamage`: `Math.max(1, Math.round(attackerAttack + bonus - defenderDefense / 2)) * (0.9 + rand() * 0.2)`
  - `computeContactDamage`: `Math.max(1, Math.round(rawContactDamage - defenderDefense / 4))`
- **`contact.ts`**:
  Gates contact damage so standing still does not harm the player. `enemyIsClosing` requires the enemy to be actively moving or in `dash` mode. Enemies in `windup` or `recover` do not deal contact damage. `contactTouches` checks Chebyshev adjacency (distance <= 1).
- **`dodge.ts`**:
  Evaluates dodge attempts. Consumes stamina (`dodgeStaminaCost`, default 25) and grants an invulnerability window (`dodgeIframesMs`, default 300ms). While an active dodge window runs, subsequent presses do not double-spend stamina.
- **`guard.ts`**:
  Evaluates hold-guard. While the guard key is held and stamina remains, incoming damage is multiplied by `1 - reductionPercent / 100` (`clampGuardReductionPercent` enforces a hard cap at `GUARD_MAX_DAMAGE_REDUCTION_PERCENT = 90`). Stamina drains at `drainPerSec` (default 20/s). Dodge and guard are mutually exclusive.
- **`hitbox.ts`**:
  Generates facing swing arc cells with `swingArcCells(facing, originX, originY, range)`. Checks intersection via `cellInArc` and sub-tile interpolating entity overlap via `swingArcOverlapsPoint(facing, originX, originY, range, targetX, targetY)` with a 0.5-tile box tolerance.
- **`hitstop.ts`**:
  Provides `consumeHitstop(remainingMs, deltaMs)`. Yields `skipUpdate: true` to pause combat frame progression for impact punch without locking global engine loops.
- **`kiting.ts`**:
  Calculates spacing intent for projectile enemies. `kiteBandForAttack` sets a minimum range of 2 and preferred range based on attack range. `resolveKiteIntent` returns `retreat` when closer than minimum, `advance` when farther than preferred, and `hold` when inside the sweet spot.
- **`knockback.ts`**:
  Resolves true 1-tile map displacement. If `roll >= knockbackResist`, displacement picks the dominant axis away from the player. It checks bounds (`inBounds`), terrain passability (`isPassable`), and entity occupancy (`isOccupied`). Blocked paths return specific reasons (`resisted`, `out-of-bounds`, `blocked`, `occupied`).
- **`stagger.ts`**:
  Transitions an enemy to `stagger` mode upon receiving a hit. Cancels active `windup` (clearing telegraphs) and `dash`. While staggered, `canActInMode` returns false, preventing attacks and movement. When stagger timer expires, `tickStagger` returns mode to `combat` and arms a cooldown to avoid instant counter-attacks.
- **`skillSlots.ts`**:
  Extracts up to `ACTION_SKILL_SLOT_MAX = 3` action-enabled skills from learned skills, removes duplicates, and supports cycling via `cycleActionSkillSlot`.
- **`simulate.ts`**:
  Headless balance simulator running 50ms discrete steps. Directly exercises `combatMath`, `dodge`, `guard`, and `stagger` to evaluate balance without spinning up Phaser.

## Scene integration layer

`src/player/playSceneActionCombat.ts` is the glue between PlayScene and the rule modules.

Responsibilities:
- **Initialization & teardown**: `initializeActionCombatForScene` configures `ActionCombatSceneState`, switches input mode via `scene.input_.setAttackMode(true)`, syncs field enemies from `scene.fieldSpawnState`, mounts the HUD, and builds skill slots.
- **Per-frame tick**: `updateActionCombat(deltaMs)` is called from `updatePlayScene`. It consumes hitstop, ticks stamina regeneration (`ACTION_STAMINA_REGEN_PER_SEC = 25`), ticks player iframes, advances enemy state machines, updates projectiles, checks swing overlap, and updates HUD representations.
- **Player actions**:
  - `Space`: Weapon swing. Uses attack buffer if on cooldown. Consumes swing stamina (`ACTION_SWING_STAMINA_COST = 10`), triggers swing arc visual, plays swing audio (`easyrpg-sound-attack1`), checks `swingArcOverlapsPoint` on living enemies.
  - `Shift` (Dash key): Dodge roll with i-frames and stamina cost.
  - `C`: Hold-guard, reducing damage and draining stamina.
  - `Q`: Casts active action skill. Verifies MP cost and item ammunition cost (`ActionSkillProfile.itemCost`), firing player projectiles.
  - `Tab` / `E`: Cycles active action skill slot.
- **Impact & death beat**:
  On enemy defeat, `DEATH_BEAT_MS = 220` triggers a white flash and alpha fade. Once expired, gold, drop item roll, and party EXP (`applyActorLevelUp`) are awarded, and `recordFieldSpawnKill` updates persistence (`session.killedFieldSpawns`).
- **Single player damage gate**: All incoming enemy damage (melee strike, dash hit, projectile, closing contact) flows through `damagePlayer`, ensuring unified evaluation of dodge i-frames, hitstop (`HITSTOP_PLAYER_HURT_MS = 110`), guard reduction, camera shake, red flash, and party death transition.

## Schema definitions and clamps

Action-combat data is authored in database records and normalized via `src/project/actionCombat.ts`:

### `SystemActionCombat` (`project.system.actionCombat`)
- `enabled`: boolean toggle.
- `playerIframesMs`: clamped 0..10000 (default 800).
- `swingCooldownMs`: clamped 50..5000 (default 350).
- `swingDamageBonus`: clamped 0..9999 (default 0).
- `fourWayMovement`: boolean (disables diagonal movement on action maps).
- `dodgeStaminaCost`: clamped 0..100 (default 25).
- `dodgeIframesMs`: clamped 0..3000 (default 300).
- `guardDamageReductionPercent`: clamped 0..90 (default 50).
- `guardStaminaDrainPerSec`: clamped 0..100 (default 20).
- `hud`: `ActionCombatHudConfig` (`hearts?: boolean`, `stamina?: boolean`, `enemyHpBars?: "always" | "damaged" | "never"`).

### `EnemyActionProfile` (`EnemyRecord.actionProfile`)
- `contactDamage`: clamped 0..9999.
- `moveIntervalMs`: clamped 50..10000 (default 500).
- `aggroRange`: clamped 1..30 (default 5).
- `knockbackResist`: clamped 0..1 (default 0).
- `attack`: `EnemyActionAttack`:
  - `kind`: `"melee" | "projectile" | "dash"`.
  - `windupMs`: clamped 100..5000 (default 500).
  - `recoverMs`: clamped 0..5000 (default 500).
  - `damage`: clamped 1..9999.
  - `range`: clamped 1..20.
  - `cooldownMs`: clamped 0..30000 (default 1200).
  - `projectileSpeedTilesPerSec`: clamped 1..30 (default 6).

### `ActionWeaponProfile` (`EquipmentRecord.actionWeapon`)
- `swingRange`: clamped 1..5 (default 1).
- `swingCooldownMs`: clamped 50..5000 (default 350).
- `swingDamageBonus`: clamped 0..9999 (default 0).

### `ActionSkillProfile` (`SkillRecord.actionSkill`)
- `kind`: `"projectile"`.
- `damage`: clamped 1..9999.
- `range`: clamped 1..20 (default 8).
- `speedTilesPerSec`: clamped 1..30 (default 6).
- `itemCost`: optional `{ itemId: string, amount: number (1..99) }`.

## HUD presentation

Action HUD is split between DOM and Phaser:
- **DOM overlay (`src/player/actionHud.ts`)**: Mounted on `.play-stage` (`data-testid="action-hud"`). Renders player HP hearts or bar, stamina gauge, guard indicator, and active skill slot chips.
- **Phaser graphics**: Enemy overhead HP bars above sprites, controlled by `config.enemyHpBars` (`always`, `damaged`, or `never`). Renders windup telegraph boxes (red fill for melee arc, line for dash, path for projectile).

## Design decision: Tile-grid movement vs pixel movement

OPRN Studio action combat intentionally preserves tile-grid movement rather than adopting free pixel-physics movement.

Key reasons:
1. **RPG Maker engine compatibility**: Map triggers, passability checks (`isPassable`), directional facing, autotiles, and event layers operate on discrete tile grids.
2. **Unified entity collision**: Autonomous NPC movers and enemy chase logic share existing grid-based pathfinding without requiring a separate physics engine.
3. **Seamless mode coexistence**: A project can have standard RPG exploration maps alongside action-combat maps without divergent collision geometries.
4. **Predictable tactical spacing**: Weapon swing arcs, telegraph zones, dodge distances, and knockback steps are clear and readable on 16x16 / 32x32 grids.

## Factions and NPC-vs-NPC combat

Action combat is no longer player-centric. Combatants carry a faction, and each enemy's target is resolved from the roster instead of being hardcoded to the player.

### Data flow

`project.factions` (see `openwiki/runtime-project-schema.md`) is resolved once per scene into `ActionCombatSceneState.factions` via `resolveFactionTable`. Each `ActionEnemyState` gets a `factionId` at sync time with precedence spawn definition > enemy record > reserved `enemy`. The party is the reserved `player` faction under the sentinel combatant id `PLAYER_COMBATANT_ID` (`"__player__"`).

### Runtime stance overlay and its save rule

Authored stance is read-only at runtime. Live changes ride the sparse overlay `PlaySession.factionStanceOverrides`, owned by `src/project/factionRuntime.ts`: keys are `JSON.stringify([from, to])` pairs (a separator inside an id cannot collide, and the save stays human-readable), values are continuous and clamped to `-2..2` so a 0.25 reputation step is not rounded away, and `effectiveFactionStance` reads the overlay over the resolved table while still taking `Math.min` of both directions. `setEffectiveFactionStance` / `adjustEffectiveFactionStance` back the `changeFactionStance` event command (`=` sets, `+=` / `-=` accumulate through the current effective value); `applyPlayerKillReputation` cools the defeated faction plus its friends toward the player and warms its enemies by the same weight when `factions.playerKillReputation` is authored. The scene shares one overlay object (`playSceneActionCombat.ts` assigns `scene.session.factionStanceOverrides ??= {}`), so a mid-fight change re-targets existing NPCs on the next retarget tick.

Persistence is split by what each boundary knows. `createSaveSnapshot` writes the overlay only when it is non-empty, so old saves and projects without factions stay byte-identical. The shared slot/autosave wire parser (`parseSessionRecord`) calls `parseFactionStanceOverrides` **without** a table because it has no `Project` yet, so it validates key/value shape only — the same reason calendar normalization waits for `applySaveSnapshot`. `applySaveSnapshot(project, snapshot)` then passes `resolveFactionTable(project.factions)`, and any key naming a faction that no longer exists is dropped: otherwise stale pairs accumulate through every later save, and every lookup would alias them into the reserved `enemy` slot through the unknown-id fallback, quietly shifting the player's standing with real enemies. Reusing a deleted faction's id inherits its overlay on purpose. Id is identity for session state, exactly as it already is for `killedFieldSpawns` and `switches`; if you want a clean slate, use a new id. Contract: `test/factionRuntimePersistence.test.ts`.

### Pure rule module

`src/battle/action/factionTargeting.ts`:
- `resolveHostileTarget({ self, candidates, table, aggroRange, forcedTargetId })` returns the nearest combatant the actor will attack on sight, or `null`. Distance is Chebyshev and ties break by **lowest id**, so the result never depends on candidate array order (that is, on `Map` insertion order or spawn history). A live `forcedTargetId` wins over both stance and range.
- `resolveNpcDamage({ hp, damage, protectedFromNpcs })` applies NPC-inflicted damage; a protected faction floors at 1 HP instead of dying.

Stance and aggression resolution live in `src/project/factions.ts`: `factionStance` symmetrizes with `Math.min`, `willAttackOnSight` gates the four aggression levels, and `isHittableByFaction` exempts friend/ally from stray projectiles. The Database enemy relationship preview applies `willAttackOnSight` in both directions because target acquisition uses each attacker's own aggression; any pair where either side attacks on sight remains expanded, while only pairs where neither side initiates combat may be collapsed.

### Scene behaviour

- **Target acquisition** (`acquireEnemyTarget`) re-resolves every `TARGET_RETARGET_MS` (400ms) rather than every frame, and is **frozen during `windup` and `dash`** so a telegraphed attack lands where it was telegraphed. `aggroRange` comes from the mover's `sightRange`, defaulting to 8.
- **Chasing an NPC** is expressed through `AutonomousMover.chaseTarget`, which `playSceneAutonomous.ts` feeds into `nextChaseDecision` in place of the player tile. When `chaseTarget` is set, a `touch` decision does **not** fire `eventTouch` — inter-NPC contact is not an authoring trigger.
- **Damage routing**: melee arc hits, dash impacts, and projectiles all funnel through `damageActionTarget`, which dispatches to the existing `damagePlayer` gate or to `damageEnemyByNpc`.
- **Contact damage stays player-only**, and only from an enemy whose current target *is* the player. Between NPCs there are no invulnerability frames, so per-frame contact damage would melt both sides instantly; NPC-vs-NPC damage therefore flows exclusively through telegraphed attacks. A neutral enemy walking past the player deals nothing.
- **Projectiles** carry `ownerId` and `ownerFactionId` snapshotted at spawn, so attribution survives the owner dying mid-flight. A projectile hits any combatant that is not friendly to the owner faction (`stance <= 0`); same-faction members are exempt because the matrix diagonal defaults to ally.
- **Retaliation latch**: any damage sets the victim's `forcedTargetId` to the attacker for `RETALIATION_LATCH_MS` (4000ms), including damage from the player. Without it, stray projectiles and friendly fire read as a bug.
- **NPC kills grant the player nothing.** `damageEnemyByNpc` calls `resolveFieldSpawnVictory` (despawn plus respawn timer) but deliberately **not** `recordFieldSpawnKill`, so `session.killedFieldSpawns` persistence and `onKillSwitchId` stay player-only. Ambient skirmishes must not advance authored progress.
- **Readability**: the enemy HP bar frame is drawn in `stanceBarColor(stance to player)` — hostile red, neutral amber, friendly teal. It replaced the flat black backdrop and is the only cue distinguishing sides in a three-way fight.
- **Knockback remains player-sourced only** (`resolveKnockback` still takes the player tile); NPC hits stagger but do not displace.

### Bounding the simulation

There is no new budget system. Field spawns already cap concurrency with `maxAlive` (default 3) and `respawnSec` (default 10), which is the spawn budget for a faction war. Raising `maxAlive` raises target-scan cost linearly: the scan is O(combatants) per enemy and runs on the 400ms retarget tick, not per frame.

## Out of scope / deliberately unsupported

- **Pixel-physics collision**: No Box2D, Arcade Physics bodies, or non-grid velocity vectors.
- **Multi-phase boss scripts in real-time mode**: Complex boss encounters should use standard `battleProcessing` event battles.
- **Wall occlusion shadows for projectiles**: Projectiles check wall tile collision on substeps, but do not cast dynamic line-of-sight shadow geometry.

## Verification and test coverage

### Runtime-owned AI action proof (2026-09-07)

`src/editor/actionCombatRuntimeProbe.ts` exports
`runActionCombatTest(project, { mapId, signal?, timeoutMs? })`.
It copies the project and opens a separate `export-player/player.html` iframe,
with the exported store shim and explicit `qaInstrumentation` boot capability.
It never enters editor play mode, writes authored content, or treats the
turn-based `sceneTestRunner` contact simulation as action evidence.

The immutable `ActionCombatProofReceipt` and
`isVerifiedActionCombatProof(receipt, project, mapId)` live in
`src/testing/actionCombatProof.ts`. The guard requires exact in-memory issuer
ownership, the current whole-project fingerprint, matching map, and a completed
passing run. JSON copies, model-supplied objects, stale revisions, missing
outcomes, wrong-map results, cancellation and timeouts cannot verify. The receipt
includes `version`, `projectFingerprint`, `mapId`, `scenarioId`, `runId`,
`status`, `pass`, numeric `observations`, and an optional failure `reason`.
The public runner has no evidence-input argument or public receipt-minting API.
The fingerprint is canonical whole-project FNV-1a 64-bit. Two unsigned 32-bit
words preserve the exact digest without per-character BigInt overhead; an
independent BigInt oracle test covers the arithmetic.

The fixed `action-combat-v1` scenario runs in `playSceneTestHooks.ts`. It requires
live authored melee and projectile field spawns, passable staging cells and an
actor who survives the control strike. It parks background movers and relocates
live runtime actors for reproducibility; it does not replace authored combat
stats, rewards, weapons, collision rules or the real scene input dispatcher.
It subscribes before input, then pairs the same seed-731 melee strike with
stationary Shift and directional Shift. `damagePlayer` must observe actual
damage in the first case and the **dodge-specific damage rejection gate** in
the second, with the same attack identity. Positive iframe counters, walking
away, and post-hit invulnerability do not establish dodge proof.

The remaining required observations are swing hit, enemy defeat, stamina spent,
stamina recovered, enemy projectile creation and reward grant. They come from
the real combat mutation sites, not UI snapshots or guessed state deltas.
`subscribeActionCombatObservations` is QA-capability gated; normal exports
install no proof globals or observers. The scenario has a 45-second deadline;
the transport defaults to 120 seconds, including a cold development-player build,
and caps caller overrides at the same 120 seconds. An explicit shorter deadline
still cancels and cleans up the owned frame.
Outcome/post-frame listeners are removed on completion or abort, and every
transport exit removes its iframe, timer, abort/message listeners and blob URL.
Execution unavailable or incomplete returns `unverified`, never simulated success.

Focused checks:

```bash
npm test -- test/actionCombatProof.test.ts test/actionCombatRuntimeProof.test.ts test/actionCombatProbeBoot.test.ts
npm run typecheck:app
node scripts/qa/runtime/action-rpg.scenario.mjs
```

The action scenario is a direct executable because the existing visual beat
runner does not expose this async receipt transport. It starts a private
Vite server on **45973**, tests the existing authored action demo on
`map_mine_1f`, and writes
`verify-shots/runtime-qa/action-rpg/{SUMMARY.md,receipt.json,player-proof.png}`.
Read `SUMMARY.md` first. No Supabase or project-content writes are made.
The scenario uses a blank host and the real `/export-player/` deployment from
`devPlayerBundlesPlugin`, without browser request routing. The plugin builds the
player and standalone bundles on first access; `npm run build:player` is the
production player build command. Only the private probe boot resolves public
game resources against the parent editor directory: normal exported games still
resolve assets inside their own deployment directory.

### Pure rule unit tests
- `test/actionAttackWindow.test.ts`: Attack buffering lifetime and single-fire timing.
- `test/actionCombatMath.test.ts`: Damage formulas and variance injection.
- `test/actionCombatConfig.test.ts`: System config and map opt-in gating.
- `test/actionContactDamage.test.ts`: Closing motion requirement for contact hits.
- `test/actionDodge.test.ts`: Stamina expenditure and i-frame windows.
- `test/actionGuard.test.ts`: Damage reduction clamping and continuous stamina drain.
- `test/actionHitbox.test.ts` & `test/actionHitboxOverlap.test.ts`: Swing geometry and sub-tile overlap.
- `test/actionHitstop.test.ts`: Hitstop delta consumption.
- `test/actionKiting.test.ts`: Ranged enemy retreat/hold/advance decisions.
- `test/actionKnockback.test.ts`: Grid displacement, resistance rolls, and obstacle blocking.
- `test/actionSkillSlots.test.ts`: Action skill slot resolution and cycling.
- `test/actionStagger.test.ts`: Windup cancellation and post-stagger recovery cooldowns.
- `test/actionCombatMpCost.test.ts`: Skill MP and ammo costs.
- `test/actionEnemyAuthoring.test.ts`: Schema normalization for enemy profiles.
- `test/actionCombatEditorFields.test.ts`: Database editor fields and clamps.
- `test/actionEncounterGuard.test.ts`: Random encounter suppression on action maps.
- `test/actionSurvival.test.ts`: Zombie grouping, kill persistence, and spawn limits.
- `test/actionSimulate.test.ts` & `test/actionSimulateSharedRules.test.ts`: Headless simulation using shared rule modules.
- `test/actionDemoProject.test.ts`: Action demo project schema and wiring.
- `test/actionTools.test.ts`: AI tools for configuring action combat and enemies.
- `test/factionStance.test.ts`: stance matrix defaults, `Math.min` symmetrization, aggression gating, unknown-id fallback, reserved-faction override, `protectedFromNpcs`, normalization drops, and a serialize/deserialize roundtrip that does not bump the schema version.
- `test/factionTargeting.test.ts`: nearest-hostile selection, candidate-order independence with id tiebreak, aggro range gate, own-faction and self exclusion, all four aggression levels, retaliation latch precedence and fallback, NPC damage and protection floor, plus a 40-tick order-independence check.
- `test/factionNpcCombat.test.ts`: scene-level integration on a stubbed Phaser surface — faction precedence (spawn > record > reserved), hostile factions killing each other with the player away, no gold/exp/kill-persistence from NPC kills, neutral factions never engaging, a protected faction surviving at 1 HP, no contact damage from an enemy engaged elsewhere, and the legacy path where a hostile enemy still attacks the player.
- `test/factionRuntime.test.ts`: overlay absence matching authored behaviour, ordered-pair keys, absolute/delta clamping with fractional reputation preserved, more-hostile resolution for asymmetric loaded overlays, and player-kill reputation spreading to allies and enemies.
- `test/factionRuntimePersistence.test.ts`: overlay roundtrip through the known-field parser, overlay keys dropped for deleted factions, deliberate inheritance on id reuse, legacy snapshots without the field, and an existing NPC target flipping after the shared overlay changes.

### E2E browser specifications
- `test/e2e/action-combat.spec.ts`: Full real-time attack, dodge, guard, and enemy response in browser player.
- `test/e2e/action-survival.spec.ts`: Survival mechanics, stamina depletion, and persistent kills.
- `test/e2e/_verify-action-demo.spec.ts`: End-to-end demo validation.
