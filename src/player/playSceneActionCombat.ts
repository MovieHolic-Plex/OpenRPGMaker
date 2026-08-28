import { store } from "@/project/store";
import { projectFontStack } from "@/project/fontRegistry";
import { DEFAULT_ATTACK_COOLDOWN_MS, DEFAULT_PROJECTILE_SPEED_TILES_PER_SEC, isActionCombatMap, resolveActionCombatConfig } from "@/project/actionCombat";
import { swingArcCells, cellInArc, swingArcOverlapsPoint } from "@/battle/action/hitbox";
import { bufferAttackPress, createAttackBuffer, tickAttackBuffer } from "@/battle/action/attackWindow";
import { computeContactDamage, computeSwingDamage } from "@/battle/action/combatMath";
import { consumeHitstop } from "@/battle/action/hitstop";
import { canActInMode, resolveStaggerOnHit, tickStagger } from "@/battle/action/stagger";
import { resolveKnockback } from "@/battle/action/knockback";
import { resolveDodgeStep } from "@/battle/action/dodge";
import { guardedDamage, resolveGuardStep } from "@/battle/action/guard";
import { kiteBandForAttack } from "@/battle/action/kiting";
import { activeActionSkillId, cycleActionSkillSlot, resolveActionSkillSlots } from "@/battle/action/skillSlots";
import { shouldApplyContactDamage } from "@/battle/action/contact";
import { resolveHostileTarget, resolveNpcDamage, type FactionCombatantRef } from "@/battle/action/factionTargeting";
import {
  applyPlayerKillReputation,
  effectiveFactionStance,
} from "@/project/factionRuntime";
import {
  DEFAULT_ENEMY_FACTION_ID,
  factionAggression,
  isHittableByFaction,
  isProtectedFromNpcs,
  PLAYER_FACTION_ID,
  resolveFactionTable,
  stanceBarColor,
  willAttackOnSight,
} from "@/project/factions";
import { playAudioCommand } from "@/player/audio";
import { resolveFieldSpawnVictory, syncFieldSpawnEventsIntoMap } from "@/player/fieldSpawns";
import { recordFieldSpawnKill } from "@/player/playSceneFieldSpawns";
import { syncActorVitals } from "@/project/sessionVitals";
import { normalizeActorRecord, parameterValueAtLevel } from "@/project/actorModel";
import { nextSessionRandom } from "@/project/session";
import { characterSpriteX, characterSpriteY, MAP_UPPER_LAYER_DEPTH } from "@/player/characterDepth";
import { TILE_SIZE } from "@/assets/bundled";
import { inBounds, isPassable } from "@/project/collision";
import { moveRuntimeEventPosition } from "@/project/runtimeEventState"
import { monsterTypesForRecord, typeChartMultiplierForTypes } from "@/battle/typeChart";
import { applyActorLevelUp } from "@/player/battleRewardsToSession";
import { learnedSkillIds } from "@/battle/battleBattlers";
import { battleSkillMpCost } from "@/battle/battleSkillUse";
import { effectiveActorClassId, hasActorClassOverride } from "@/project/sessionClass";
import { effectiveActorEquipment } from "@/project/equipmentRules";
import { transitionItemState } from "@/project/itemTransitions";
import type { Dir, EnemyActionAttack, EnemyRecord, Project } from "@/project/types";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import {
  ACTION_STAMINA_MAX,
  ACTION_STAMINA_REGEN_PER_SEC,
  ACTION_SWING_STAMINA_COST,
  PLAYER_COMBATANT_ID,
  RETALIATION_LATCH_MS,
  TARGET_RETARGET_MS,
  type ActionCombatSceneState,
  type ActionEnemyState,
} from "@/player/actionCombatTypes";
import { mountActionHud } from "@/player/actionHud";

const ENEMY_FLASH_MS = 120;
const PLAYER_FLASH_MS = 200;
const SWING_VFX_MS = 160;
const COMBAT_DEPTH = MAP_UPPER_LAYER_DEPTH + 1;
const DASH_STEP_MS = 70;
const TELEGRAPH_ALPHA = 0.35;
// 히트스톱: 타격 순간 액션 전투 갱신만 아주 짧게 건너뛴다(게임 전체는 얼리지 않음).
const HITSTOP_HIT_ENEMY_MS = 70;
const HITSTOP_PLAYER_HURT_MS = 110;
// 넉백: 한 타일을 밀려나는 데 걸리는 시간. 히트스톱이 풀린 직후 튀듯 밀린다.
const KNOCKBACK_TWEEN_MS = 120;
// 사망 연출: 적이 같은 프레임에 사라지지 않고 흰 섬광 → 페이드로 꺼진다.
const DEATH_BEAT_MS = 220;
// 액션 전투 효과음 SE 리소스(EasyRPG RTP 사운드). 프로젝트에 해당 SE 가 없으면 resolveAudioSource 가 null 을 반환해 무음.
const SE_SWING_RESOURCE_ID = "easyrpg-sound-attack1";
const SE_HIT_ENEMY_RESOURCE_ID = "easyrpg-sound-blow2";
const SE_PLAYER_HURT_RESOURCE_ID = "easyrpg-sound-damage2";
// 적 공격 예고: windup 중 스프라이트 붉은 tint 점멸.
const WINDUP_TINT_COLOR = 0xff5544;
const WINDUP_TINT_DURATION_MS = 160;
// 생략된 aggroRange 에 대한 타깃 탐색 시야. fieldSpawns 의 sightRange 기본값과 맞췄다.
const DEFAULT_TARGET_SIGHT_RANGE = 8;

export function isActionCombatSceneActive(scene: PlaySceneContext): boolean {
  return scene.actionCombatState !== null;
}

export function initializeActionCombatForScene(scene: PlaySceneContext): void {
  destroyActionCombatVisuals(scene);
  const project = store.getCurrent();
  if (!isActionCombatMap(project, scene.map)) {
    scene.actionCombatState = null;
    scene.input_.setAttackMode(false);
    return;
  }
  const config = resolveActionCombatConfig(project);
  const state: ActionCombatSceneState = {
    config,
    factions: resolveFactionTable(project.factions),
    factionStanceOverrides: scene.session.factionStanceOverrides ??= {},
    enemies: new Map(),
    projectiles: [],
    projectileSerial: 0,
    playerIframesMs: 0,
    dodgeIframesMs: 0,
    playerFlashMs: 0,
    swingCooldownMs: 0,
    attackBuffer: createAttackBuffer(),
    stamina: ACTION_STAMINA_MAX,
    guarding: false,
    guardMultiplier: 1,
    skillSlotIds: [],
    activeSkillSlot: 0,
    hitstopMs: 0,
    lastHudSignature: "",
  };
  scene.actionCombatState = state;
  scene.input_.setAttackMode(true);
  refreshActionSkillSlots(scene, state);
  syncActionEnemiesForScene(scene);
  if (config.hearts || config.stamina) {
    const host = scene.game.canvas.closest(".play-stage");
    state.hud = mountActionHud(host instanceof HTMLElement ? host : null) ?? undefined;
    state.hud?.setHpVisible(config.hearts);
  }
  if (config.enemyHpBars !== "never") {
    state.barsGraphics = scene.add.graphics();
    state.barsGraphics.setDepth(COMBAT_DEPTH);
  }
}

function destroyActionCombatVisuals(scene: PlaySceneContext): void {
  const state = scene.actionCombatState;
  if (!state) return;
  for (const enemy of state.enemies.values()) cleanupEnemyVisuals(scene, enemy);
  for (const projectile of state.projectiles) projectile.object.destroy();
  state.projectiles.length = 0;
  state.hud?.destroy();
  state.barsGraphics?.destroy();
  scene.player.clearTint();
  scene.actionCombatState = null;
}

export function updateActionCombatForScene(scene: PlaySceneContext, deltaMs: number): void {
  const state = scene.actionCombatState;
  if (!state) return;
  if (scene.running) return;
  // 히트스톱: 남은 시간이 있으면 이번 프레임 갱신을 건너뛴다(입력 큐는 막지 않음).
  const hitstop = consumeHitstop(state.hitstopMs, deltaMs);
  state.hitstopMs = hitstop.nextRemainingMs;
  if (hitstop.skipUpdate) return;
  syncActionEnemiesForScene(scene);
  // 슬롯 순환 엣지는 이동/조사 경로가 아니라 여기서 바로 소모한다.
  if (scene.input_.consumeSkillCycleEdge()) cycleActionSkillSlotForScene(scene, state);
  updatePlayerGuard(scene, state, deltaMs);
  tickActionTimers(scene, state, deltaMs);
  updatePlayerDodge(scene, state, deltaMs);
  updateEnemyModes(scene, state, deltaMs);
  updateProjectiles(scene, state, deltaMs);
  applyContactDamage(scene, state);
  redrawEnemyHpBars(scene, state);
  updateActionHudModel(scene, state);
}

function tickActionTimers(scene: PlaySceneContext, state: ActionCombatSceneState, deltaMs: number): void {
  state.playerIframesMs = Math.max(0, state.playerIframesMs - deltaMs);
  // 쿨다운 중 눌린 공격은 버퍼에 기록되고, 쿨다운이 끝나는 프레임에 딱 한 번 발화한다.
  const cooldownBefore = state.swingCooldownMs;
  state.swingCooldownMs = Math.max(0, cooldownBefore - deltaMs);
  const buffered = tickAttackBuffer(state.attackBuffer, cooldownBefore, deltaMs);
  if (buffered.fired) performActionCombatSwing(scene, state);
  if (state.config.staminaEnabled) {
    // 가드를 잡고 있는 동안은 회복하지 않는다 — 그러지 않으면 드레인이 리젬에 상쇄되어 상시 가드가 공짜가 된다.
    if (!state.guarding) {
      state.stamina = Math.min(ACTION_STAMINA_MAX, state.stamina + (ACTION_STAMINA_REGEN_PER_SEC * deltaMs) / 1000);
    }
  }
  if (state.playerFlashMs > 0) {
    state.playerFlashMs = Math.max(0, state.playerFlashMs - deltaMs);
    if (state.playerFlashMs === 0) scene.player.clearTint();
  }
  for (const enemy of state.enemies.values()) {
    if (enemy.flashMs > 0) {
      enemy.flashMs = Math.max(0, enemy.flashMs - deltaMs);
      if (enemy.flashMs === 0) scene.eventSprites.get(enemy.eventId)?.clearTint();
    }
    enemy.retargetMs = Math.max(0, enemy.retargetMs - deltaMs);
    if (enemy.forcedTargetMs > 0) {
      enemy.forcedTargetMs = Math.max(0, enemy.forcedTargetMs - deltaMs);
      if (enemy.forcedTargetMs === 0) enemy.forcedTargetId = undefined;
    }
  }
}

export function syncActionEnemiesForScene(scene: PlaySceneContext): void {
  const state = scene.actionCombatState;
  if (!state || !scene.fieldSpawnState) return;
  if (state.fieldSpawnRuntime !== scene.fieldSpawnState) {
    for (const enemy of state.enemies.values()) cleanupEnemyVisuals(scene, enemy);
    state.enemies.clear();
    for (const projectile of state.projectiles) projectile.object.destroy();
    state.projectiles.length = 0;
    state.fieldSpawnRuntime = scene.fieldSpawnState;
  }
  const project = store.getCurrent();
  const aliveIds = new Set<string>();
  for (const entry of scene.fieldSpawnState.entries) {
    for (const instance of entry.alive) {
      aliveIds.add(instance.eventId);
      if (state.enemies.has(instance.eventId)) continue;
      const record = resolveSpawnEnemyRecord(project, instance.troopId);
      if (!record) continue;
      state.enemies.set(instance.eventId, {
        eventId: instance.eventId,
        enemyId: record.id,
        factionId: resolveSpawnFactionId(scene, instance.eventId, record),
        hp: record.stats.maxHp,
        maxHp: record.stats.maxHp,
        defense: record.stats.defense,
        contactDamage: record.actionProfile?.contactDamage,
        attack: record.stats.attack,
        exp: record.rewards.exp,
        actionAttack: record.actionProfile?.attack,
        gold: record.rewards.gold,
        dropItemId: record.rewards.dropItemId,
        dropRatePercent: record.rewards.dropRatePercent,
        knockbackResist: record.actionProfile?.knockbackResist ?? 0,
        flashMs: 0,
        mode: "combat",
        modeTimerMs: 0,
        attackCooldownMs: 0,
        retargetMs: 0,
        forcedTargetMs: 0,
      });
    }
  }
  for (const eventId of [...state.enemies.keys()]) {
    if (!aliveIds.has(eventId)) state.enemies.delete(eventId);
  }
}

function resolveSpawnEnemyRecord(project: Project, troopId: string): EnemyRecord | undefined {
  const troop = project.database.troops.find((entry) => entry.id === troopId);
  const enemyId = troop?.members?.[0]?.enemyId ?? troop?.enemyIds[0];
  if (!enemyId) return undefined;
  return project.database.enemies.find((entry) => entry.id === enemyId);
}

// 진영 우선순위: 스폰 정의 > 적 레코드 > 예약 진영 enemy. 스폰 쪽이 이기는 이유는
// 같은 적 레코드를 산적/경비병 양쪽에 배치할 수 있어야 하기 때문이다.
function resolveSpawnFactionId(scene: PlaySceneContext, eventId: string, record: EnemyRecord): string {
  for (const entry of scene.fieldSpawnState?.entries ?? []) {
    if (!entry.alive.some((instance) => instance.eventId === eventId)) continue;
    if (entry.spawn.factionId !== undefined && entry.spawn.factionId.length > 0) return entry.spawn.factionId;
    break;
  }
  return record.factionId !== undefined && record.factionId.length > 0 ? record.factionId : DEFAULT_ENEMY_FACTION_ID;
}

// 전투원 스냅샷. 플레이어와 살아 있는 액션 적을 하나의 목록으로 합쳐 타깃 탐색에 넘긴다.
function combatantRefs(scene: PlaySceneContext, state: ActionCombatSceneState): FactionCombatantRef[] {
  const refs: FactionCombatantRef[] = [{
    id: PLAYER_COMBATANT_ID,
    factionId: PLAYER_FACTION_ID,
    x: scene.tileX,
    y: scene.tileY,
  }];
  for (const enemy of state.enemies.values()) {
    if (enemy.dying === true || enemy.hp <= 0) continue;
    const pos = enemyTilePosition(scene, enemy.eventId);
    if (!pos) continue;
    refs.push({ id: enemy.eventId, factionId: enemy.factionId, x: pos.x, y: pos.y });
  }
  return refs;
}

// 대상이 이번 프레임에 점유한 칸들. 플레이어는 이동 중 예약 칸까지 포함한다(기존 판정과 동일).
function targetTiles(scene: PlaySceneContext, targetId: string): { x: number; y: number }[] {
  if (targetId === PLAYER_COMBATANT_ID) {
    const tiles = [{ x: scene.tileX, y: scene.tileY }];
    if (scene.moving) tiles.push({ x: scene.movingTo.x, y: scene.movingTo.y });
    return tiles;
  }
  const pos = enemyTilePosition(scene, targetId);
  return pos ? [pos] : [];
}

function acquireEnemyTarget(
  scene: PlaySceneContext,
  state: ActionCombatSceneState,
  enemy: ActionEnemyState,
  pos: { x: number; y: number },
  refs: readonly FactionCombatantRef[]
): FactionCombatantRef | null {
  const cached = enemy.targetId === undefined
    ? undefined
    : refs.find((ref) => ref.id === enemy.targetId);
  // 예고한 공격은 예고한 자리에 떨어진다 — 선딜/돌진 중에는 대상을 바꾸지 않는다.
  if (enemy.mode === "windup" || enemy.mode === "dash") return cached ?? null;
  const cachedStillHostile = cached && (
    enemy.forcedTargetId === cached.id
    || willAttackOnSight(
      effectiveFactionStance(state.factions, state.factionStanceOverrides, enemy.factionId, cached.factionId),
      factionAggression(state.factions, enemy.factionId),
    )
  );
  if (enemy.retargetMs > 0 && cachedStillHostile) return cached;
  enemy.retargetMs = TARGET_RETARGET_MS;
  const sightRange = scene.autonomousNPCs.get(enemy.eventId)?.sightRange ?? DEFAULT_TARGET_SIGHT_RANGE;
  const target = resolveHostileTarget({
    self: { id: enemy.eventId, factionId: enemy.factionId, x: pos.x, y: pos.y },
    candidates: refs,
    table: state.factions,
    stanceOverrides: state.factionStanceOverrides,
    aggroRange: sightRange,
    forcedTargetId: enemy.forcedTargetId,
  });
  enemy.targetId = target?.id;
  return target;
}

// 보복 래치. 태도가 중립이어도 맞은 쪽은 가해자를 노린다.
function latchRetaliation(victim: ActionEnemyState, attackerId: string): void {
  if (victim.eventId === attackerId) return;
  victim.forcedTargetId = attackerId;
  victim.forcedTargetMs = RETALIATION_LATCH_MS;
  victim.targetId = attackerId;
  victim.retargetMs = TARGET_RETARGET_MS;
}

// 적 공격의 단일 피해 출구. 대상이 플레이어면 기존 게이트를, NPC 면 NPC 전용 경로를 탄다.
function damageActionTarget(
  scene: PlaySceneContext,
  state: ActionCombatSceneState,
  attacker: ActionEnemyState,
  targetId: string,
  damage: number,
  fromTileX: number,
  fromTileY: number
): void {
  if (targetId === PLAYER_COMBATANT_ID) {
    damagePlayer(scene, state, damage, fromTileX, fromTileY);
    return;
  }
  const victim = state.enemies.get(targetId);
  if (!victim) return;
  damageEnemyByNpc(scene, state, victim, attacker.eventId, damage);
}

// NPC 가 NPC 를 때린 결과. 플레이어 보상·처치 영속·킬 스위치는 일부러 건드리지 않는다 —
// 저작자의 진행 트리거가 앰비언트 싸움으로 저절로 켜지면 안 된다.
function damageEnemyByNpc(
  scene: PlaySceneContext,
  state: ActionCombatSceneState,
  victim: ActionEnemyState,
  attackerId: string,
  damage: number
): void {
  if (victim.dying === true) return;
  const pos = enemyTilePosition(scene, victim.eventId);
  const outcome = resolveNpcDamage({
    hp: victim.hp,
    damage,
    protectedFromNpcs: isProtectedFromNpcs(state.factions, victim.factionId),
  });
  victim.hp = outcome.hp;
  victim.flashMs = ENEMY_FLASH_MS;
  scene.eventSprites.get(victim.eventId)?.setTintFill(0xffffff);
  if (pos) {
    spawnDamageNumber(scene, characterSpriteX(pos.x), characterSpriteY(pos.y) - 20, String(Math.max(0, Math.round(damage))), "#d7c7ff");
  }
  latchRetaliation(victim, attackerId);
  if (!outcome.died) {
    staggerActionEnemy(scene, victim);
    return;
  }
  victim.dying = true;
  playEnemyDeathBeat(scene, victim);
  cleanupEnemyVisuals(scene, victim);
  state.enemies.delete(victim.eventId);
  for (const other of state.enemies.values()) {
    if (other.targetId === victim.eventId) other.targetId = undefined;
    if (other.forcedTargetId === victim.eventId) {
      other.forcedTargetId = undefined;
      other.forcedTargetMs = 0;
    }
  }
  if (scene.fieldSpawnState) {
    resolveFieldSpawnVictory(scene.fieldSpawnState, victim.eventId);
    syncFieldSpawnEventsIntoMap(scene.map, scene.fieldSpawnState, scene.eventPositions);
    scene.renderTiles();
    scene.registerPageMoveRoutes();
  }
}

// 보간 중인 적의 소수 타일 좌표. 라운딩 전 값이라 서브타일 겹침 판정에 쓴다.
function enemyFractionalTilePosition(scene: PlaySceneContext, eventId: string): { x: number; y: number } | null {
  const pos = scene.eventPositions[eventId];
  if (pos) {
    const mover = scene.autonomousNPCs.get(eventId);
    const move = mover?.activeMove;
    if (move && mover) {
      const progress = Math.min(1, move.elapsedMs / Math.max(1, mover.moveDurationMs));
      return {
        x: move.fromX + (move.toX - move.fromX) * progress,
        y: move.fromY + (move.toY - move.fromY) * progress,
      };
    }
    return { x: pos.x, y: pos.y };
  }
  if (!scene.fieldSpawnState) return null;
  for (const entry of scene.fieldSpawnState.entries) {
    const instance = entry.alive.find((candidate) => candidate.eventId === eventId);
    if (instance) return { x: instance.x, y: instance.y };
  }
  return null;
}

function enemyTilePosition(scene: PlaySceneContext, eventId: string): { x: number; y: number } | null {
  const pos = enemyFractionalTilePosition(scene, eventId);
  if (!pos) return null;
  return { x: Math.round(pos.x), y: Math.round(pos.y) };
}

// 대시 걸음마다 회피를 시도한다. 성공하면 스태미나를 쓰고 짧은 무적 창만 열린다.
// 스태미나가 비용보다 적으면 회피가 열리지 않고 그대로 맞는다(예전의 무한 무적 제거).
function updatePlayerDodge(scene: PlaySceneContext, state: ActionCombatSceneState, deltaMs: number): void {
  // 가드와 회피는 동시에 서지 않는다. 가드를 잡은 동안은 대시로 무적을 사지 못한다.
  const requested = state.config.staminaEnabled && !state.guarding && scene.dashing && scene.moving && scene.inputEnabled;
  const outcome = resolveDodgeStep({
    stamina: state.stamina,
    cost: state.config.dodgeStaminaCost,
    iframesMs: state.config.dodgeIframesMs,
    activeIframesMs: state.dodgeIframesMs,
    deltaMs,
    requested,
  });
  state.stamina = outcome.stamina;
  state.dodgeIframesMs = outcome.iframesRemainingMs;
}

// 홀드 가드. 키를 누르고 있는 동안 피해가 줄고 스태미나가 탄다. 판정 자체는 전부 순수 모듈(guard.ts).
function updatePlayerGuard(scene: PlaySceneContext, state: ActionCombatSceneState, deltaMs: number): void {
  const requested = state.config.staminaEnabled && scene.inputEnabled && !scene.running && scene.input_.isGuardHeld();
  const outcome = resolveGuardStep({
    stamina: state.stamina,
    reductionPercent: state.config.guardDamageReductionPercent,
    drainPerSec: state.config.guardStaminaDrainPerSec,
    deltaMs,
    requested,
    dodging: state.dodgeIframesMs > 0,
  });
  state.stamina = outcome.stamina;
  state.guarding = outcome.guarding;
  state.guardMultiplier = outcome.damageMultiplier;
}

function applyContactDamage(scene: PlaySceneContext, state: ActionCombatSceneState): void {
  // RM eventTouch 의미론: 적이 플레이어에 "닿는" 것은 같은 칸이 아니라 인접(8방) 접촉.
  // NPC 이동 규칙상 적 묘버는 플레이어 칸에 진입할 수 없으므로 같은 칸 판정은 절대 발화하지 않는다.
  // 단, 접촉 피해는 **거리를 좁히는 적**만 준다 — windup/recover 중이면 예고된 타격이 피해원이다.
  const targets = [{ x: scene.tileX, y: scene.tileY }];
  if (scene.moving) targets.push({ x: scene.movingTo.x, y: scene.movingTo.y });
  for (const enemy of state.enemies.values()) {
    // 경직 중인 적은 거리를 종힐 수 없으니 접촉 피해도 없다.
    if (!canActInMode(enemy.mode)) continue;
    // 접촉 피해는 플레이어 전용이며, 그재도 플레이어를 노리는 적만 주다.
    // NPC 간 피해는 전부 예고된 공격만 거친다 — 매 프레임 접촉 피해는 방어 무적 창이 없어 서로 녹아버린다.
    if (enemy.targetId !== PLAYER_COMBATANT_ID) continue;
    const pos = enemyTilePosition(scene, enemy.eventId);
    if (!pos) continue;
    const moving = scene.autonomousNPCs.get(enemy.eventId)?.activeMove != null;
    if (!shouldApplyContactDamage({ enemyTile: pos, playerTiles: targets, mode: enemy.mode, moving })) continue;
    const lead = leadActorStats(scene);
    if (!lead) return;
    const damage = computeContactDamage({
      contactDamage: enemy.contactDamage,
      enemyAttack: enemy.attack,
      defenderDefense: lead.defense,
    });
    damagePlayer(scene, state, damage, pos.x, pos.y);
    return;
  }
}

function damagePlayer(scene: PlaySceneContext, state: ActionCombatSceneState, damage: number, fromTileX: number, fromTileY: number): void {
  if (damage <= 0) return;
  if (state.playerIframesMs > 0) return;
  // 회피 무적: 스태미나를 지불하고 열린 짧은 창 동안만 유효하다.
  if (state.dodgeIframesMs > 0) return;
  // 가드: 무적이 아니라 감산이다. 피해는 반드시 1 이상 들어온다.
  const dealt = state.guarding ? guardedDamage(damage, state.guardMultiplier) : damage;
  if (dealt <= 0) return;
  const project = store.getCurrent();
  const leadId = scene.session.partyActorIds[0];
  if (!leadId) return;
  syncActorVitals(project, scene.session.actorVitals, leadId);
  const vitals = scene.session.actorVitals[leadId];
  if (!vitals || vitals.hp <= 0) return;
  vitals.hp = Math.max(0, vitals.hp - dealt);
  state.playerIframesMs = state.config.playerIframesMs;
  state.playerFlashMs = PLAYER_FLASH_MS;
  state.hitstopMs = Math.max(state.hitstopMs, HITSTOP_PLAYER_HURT_MS);
  scene.player.setTintFill(state.guarding ? 0x88bbff : 0xff7777);
  scene.cameras.main.shake(90, 0.006);
  playActionSe(SE_PLAYER_HURT_RESOURCE_ID);
  spawnDamageNumber(scene, characterSpriteX(fromTileX), characterSpriteY(fromTileY) - 20, `-${dealt}`, state.guarding ? "#9bd0ff" : "#ff6655");
  if (vitals.hp <= 0) killPartyForActionCombat(scene);
}

function killPartyForActionCombat(scene: PlaySceneContext): void {
  const project = store.getCurrent();
  for (const actorId of scene.session.partyActorIds) {
    syncActorVitals(project, scene.session.actorVitals, actorId);
    const vitals = scene.session.actorVitals[actorId];
    if (vitals) vitals.hp = 0;
    scene.session.actorStateIds ??= {};
    const states = new Set(scene.session.actorStateIds[actorId] ?? []);
    states.add("state_death");
    scene.session.actorStateIds[actorId] = [...states];
  }
  scene.showGameOverScreen("몬스터에게 쓰러졌습니다.");
}

export function tryActionCombatSwing(scene: PlaySceneContext): void {
  const state = scene.actionCombatState;
  if (!state || scene.running || !scene.inputEnabled) return;
  // 쿨다운 중 입력은 유지된다: 버퍼에 기록해 두면 쿨다운이 끝나는 프레임에 한 번 발화한다.
  if (state.swingCooldownMs > 0) {
    bufferAttackPress(state.attackBuffer);
    return;
  }
  performActionCombatSwing(scene, state);
}

function performActionCombatSwing(scene: PlaySceneContext, state: ActionCombatSceneState): void {
  if (state.config.staminaEnabled && state.stamina < ACTION_SWING_STAMINA_COST) return;
  const lead = leadActorSwingProfile(scene);
  if (!lead) return;
  state.swingCooldownMs = lead.cooldownMs;
  if (state.config.staminaEnabled) state.stamina = Math.max(0, state.stamina - ACTION_SWING_STAMINA_COST);
  flashSwingArc(scene, scene.facing, lead.range);
  pulsePlayerSwing(scene);
  playActionSe(SE_SWING_RESOURCE_ID);
  const project = store.getCurrent();
  // 보간 중인 적은 반올림 타일이 아니라 몸이 실제로 호와 겹치는지로 판정한다.
  for (const enemy of [...state.enemies.values()]) {
    const pos = enemyFractionalTilePosition(scene, enemy.eventId);
    if (!pos || !swingArcOverlapsPoint(scene.facing, scene.tileX, scene.tileY, lead.range, pos.x, pos.y)) continue;
    const base = computeSwingDamage({
      attackerAttack: lead.attack,
      defenderDefense: enemy.defense,
      bonus: lead.damageBonus,
      rand: () => nextSessionRandom(scene.session, "battle"),
    });
    const multiplier = typeChartMultiplierForTypes(project, lead.elementId, [], monsterTypesForRecord(project, enemy.enemyId));
    const damage = Math.max(1, Math.round(base * multiplier));
    hitActionEnemy(scene, state, enemy, damage, pos.x, pos.y);
  }
}

export function tryActionSkillCast(scene: PlaySceneContext): void {
  const state = scene.actionCombatState;
  if (!state || scene.running || !scene.inputEnabled) return;
  const project = store.getCurrent();
  const leadId = scene.session.partyActorIds[0];
  if (!leadId) return;
  syncActorVitals(project, scene.session.actorVitals, leadId);
  const vitals = scene.session.actorVitals[leadId];
  if (!vitals) return;
  // 예전에는 배운 스킬 중 actionSkill 이 붙은 맨 앞 하나만 find 로 집어 나머지는 닿지 않았다.
  // 지금은 슬롯 목록을 재해석하고 **활성 슬롯**을 쓴다(R 로 순환).
  refreshActionSkillSlots(scene, state);
  const skillId = activeActionSkillId(state.skillSlotIds, state.activeSkillSlot);
  if (!skillId) return;
  const skill = project.database.skills.find((entry) => entry.id === skillId);
  if (!skill?.actionSkill) return;
  const mpCost = battleSkillMpCost(skill, vitals.maxMp);
  if (vitals.mp < mpCost) return;
  const ammo = skill.actionSkill.itemCost;
  if (ammo && (scene.session.inventory[ammo.itemId] ?? 0) < ammo.amount) return;
  vitals.mp -= mpCost;
  if (ammo) commitItemRemoval(project, scene, ammo.itemId, ammo.amount);
  const dir = dirDelta(scene.facing);
  spawnProjectileFrom(scene, state, {
    faction: "player",
    ownerId: PLAYER_COMBATANT_ID,
    ownerFactionId: PLAYER_FACTION_ID,
    x: scene.tileX,
    y: scene.tileY,
    dirX: dir.x,
    dirY: dir.y,
    speedTilesPerSec: skill.actionSkill.speedTilesPerSec ?? DEFAULT_PROJECTILE_SPEED_TILES_PER_SEC,
    damage: skill.actionSkill.damage,
    elementId: skill.elementId,
    maxRangeTiles: skill.actionSkill.range,
    color: 0x66ccff,
  });
}

// 주인공이 배운 스킬 id 목록(레벌/클래스 오버라이드 반영).
function leadLearnedSkillIds(scene: PlaySceneContext, project: Project, leadId: string): readonly string[] {
  const actor = project.database.actors.find((entry) => entry.id === leadId);
  if (!actor) return [];
  const normalized = normalizeActorRecord(actor);
  const level = scene.session.actorLevels?.[leadId] ?? normalized.initialLevel;
  const classOverrides = scene.session.classOverrides;
  const effectiveClass = effectiveActorClassId(project, { classOverrides }, leadId);
  const usesOverride = hasActorClassOverride({ classOverrides: classOverrides ? { ...classOverrides } : undefined }, leadId);
  return learnedSkillIds(project, normalized, level, scene.session.actorSkillIds?.[leadId], effectiveClass, usesOverride);
}

// 배운 스킬 → 액션 슬롯 재해석. 슬롯이 줄어들어 활성 인덱스가 범위를 벗어나면 0 번으로 스냅된다.
function refreshActionSkillSlots(scene: PlaySceneContext, state: ActionCombatSceneState): void {
  const project = store.getCurrent();
  const leadId = scene.session.partyActorIds[0];
  const learned = leadId ? leadLearnedSkillIds(scene, project, leadId) : [];
  state.skillSlotIds = resolveActionSkillSlots(learned, (skillId) => (
    project.database.skills.find((entry) => entry.id === skillId)?.actionSkill != null
  ));
  if (state.activeSkillSlot >= state.skillSlotIds.length) state.activeSkillSlot = 0;
}

function cycleActionSkillSlotForScene(scene: PlaySceneContext, state: ActionCombatSceneState): void {
  refreshActionSkillSlots(scene, state);
  state.activeSkillSlot = cycleActionSkillSlot(state.activeSkillSlot, state.skillSlotIds.length);
}

/** HUD 표시용 슬롯 이름. 스킬 레코드가 사라지면 id 를 그대로 보여준다. */
function actionSkillSlotNames(project: Project, slotIds: readonly string[]): string[] {
  return slotIds.map((id) => project.database.skills.find((entry) => entry.id === id)?.name ?? id);
}

function hitActionEnemy(scene: PlaySceneContext, state: ActionCombatSceneState, enemy: ActionEnemyState, damage: number, tileX: number, tileY: number): void {
  // 이미 사망 연출에 들어간 적은 다시 맞지 않는다(보상 이중 지급 방지).
  if (enemy.dying) return;
  enemy.hp = Math.max(0, enemy.hp - damage);
  enemy.flashMs = ENEMY_FLASH_MS;
  state.hitstopMs = Math.max(state.hitstopMs, HITSTOP_HIT_ENEMY_MS);
  scene.eventSprites.get(enemy.eventId)?.setTintFill(0xffffff);
  scene.cameras.main.shake(60, 0.004);
  playActionSe(SE_HIT_ENEMY_RESOURCE_ID);
  spawnDamageNumber(scene, characterSpriteX(tileX), characterSpriteY(tileY) - 20, String(damage), "#ffe066");
  latchRetaliation(enemy, PLAYER_COMBATANT_ID);
  if (enemy.hp > 0) {
    staggerActionEnemy(scene, enemy);
    applyKnockback(scene, state, enemy);
    return;
  }
  // 사망: 보상은 여기서 정확히 한 번 떨어지고, 사라지는 연출만 뒤로 미룬다.
  enemy.dying = true;
  applyKillReputation(state, enemy.factionId);
  grantActionKillRewards(scene, enemy, tileX, tileY);
  playEnemyDeathBeat(scene, enemy);
  cleanupEnemyVisuals(scene, enemy);
  state.enemies.delete(enemy.eventId);
  if (scene.fieldSpawnState) {
    recordFieldSpawnKill(scene, resolveFieldSpawnVictory(scene.fieldSpawnState, enemy.eventId));
    syncFieldSpawnEventsIntoMap(scene.map, scene.fieldSpawnState, scene.eventPositions);
    scene.renderTiles();
    scene.registerPageMoveRoutes();
  }
}

// 사망 연출(데스 비트). 적 이벤트/스프라이트는 스폰 정리와 함께 이번 프레임에 사라지므로,
// 같은 자리에 스프라이트 사본(고스트)을 하나 남겨 흰 섬광 → 페이드로 꺼뜨린다.
// 규칙 상태(보상/스폰)는 이미 확정돼 있어서 연출이 전투 판정에 끼어들지 않는다.
function playEnemyDeathBeat(scene: PlaySceneContext, enemy: ActionEnemyState): void {
  const sprite = scene.eventSprites.get(enemy.eventId);
  if (!sprite) return;
  const ghost = scene.add.sprite(sprite.x, sprite.y, sprite.texture.key, sprite.frame.name);
  ghost.setOrigin(sprite.originX, sprite.originY);
  ghost.setDisplaySize(sprite.displayWidth, sprite.displayHeight);
  ghost.setDepth(COMBAT_DEPTH);
  ghost.setTintFill(0xffffff);
  scene.tweens.add({
    targets: ghost,
    alpha: 0,
    scaleX: ghost.scaleX * 1.25,
    scaleY: ghost.scaleY * 0.7,
    y: ghost.y - TILE_SIZE * 0.25,
    duration: DEATH_BEAT_MS,
    ease: "Quad.easeOut",
    onComplete: () => ghost.destroy(),
  });
}

// 피격 경직. 진행 중이던 선딜/돌진을 실제로 끊는다: 텔레그래프와 점멸 트윈을 없애고,
// 예약된 공격 상태를 버리고, 경직 창 동안 이동/행동을 얼린다.
function staggerActionEnemy(scene: PlaySceneContext, enemy: ActionEnemyState): void {
  const outcome = resolveStaggerOnHit({ mode: enemy.mode });
  if (outcome.cancelWindup || enemy.mode === "windup") {
    enemy.telegraph?.destroy();
    enemy.telegraph = undefined;
    stopWindupTelegraph(scene, enemy);
  }
  if (outcome.cancelDash) enemy.dash = undefined;
  enemy.mode = outcome.mode;
  enemy.modeTimerMs = outcome.modeTimerMs;
  const mover = scene.autonomousNPCs.get(enemy.eventId);
  if (mover) {
    mover.actionFrozen = true;
    mover.activeMove = null;
  }
}

function applyKillReputation(state: ActionCombatSceneState, defeatedFactionId: string): void {
  const config = store.getCurrent().factions?.playerKillReputation;
  if (!config) return;
  const next = applyPlayerKillReputation(
    state.factions,
    state.factionStanceOverrides,
    defeatedFactionId,
    config.weight,
  );
  replaceFactionStanceOverrides(state.factionStanceOverrides, next);
  // 타깃 캐시는 최대 400ms 남아 있을 수 있다. 평판 변경 직후 전원이 다시 판단해야
  // "진행 중 싸움이 반응한다"는 계약이 프레임 단위로 지켜진다.
  for (const combatant of state.enemies.values()) combatant.retargetMs = 0;
}

function replaceFactionStanceOverrides(
  target: Record<string, number>,
  source: Readonly<Record<string, number>>,
): void {
  for (const key of Object.keys(target)) delete target[key];
  Object.assign(target, source);
}

function grantActionKillRewards(scene: PlaySceneContext, enemy: ActionEnemyState, tileX: number, tileY: number): void {
  let text = "";
  if (enemy.gold > 0) {
    scene.session.gold += enemy.gold;
    text = `+${enemy.gold}G`;
  }
  if (enemy.exp > 0) {
    const project = store.getCurrent();
    let leveledUp = false;
    for (const actorId of scene.session.partyActorIds) {
      scene.session.actorExperience[actorId] = (scene.session.actorExperience[actorId] ?? 0) + enemy.exp;
      if (applyActorLevelUp(scene.session, project, actorId)) leveledUp = true;
    }
    text = text ? `${text} EXP+${enemy.exp}` : `EXP+${enemy.exp}`;
    if (leveledUp) {
      spawnDamageNumber(scene, characterSpriteX(scene.tileX), characterSpriteY(scene.tileY) - 40, "LEVEL UP!", "#8fd3ff");
    }
  }
  if (enemy.dropItemId && enemy.dropRatePercent > 0) {
    const roll = nextSessionRandom(scene.session, "battle") * 100;
    if (roll < enemy.dropRatePercent) {
      commitItemGrant(store.getCurrent(), scene, enemy.dropItemId, 1);
      text = text ? `${text} +아이템` : "+아이템";
    }
  }
  if (text) spawnDamageNumber(scene, characterSpriteX(tileX), characterSpriteY(tileY) - 34, text, "#9be37e");
}

function commitItemGrant(project: Project, scene: PlaySceneContext, itemId: string, amount: number): void {
  commitItemTransition(scene, transitionItemState(scene.session, project.database.items, { kind: "grant", itemId, amount }));
}

function commitItemRemoval(project: Project, scene: PlaySceneContext, itemId: string, amount: number): void {
  commitItemTransition(scene, transitionItemState(scene.session, project.database.items, { kind: "remove", itemId, amount }));
}

function commitItemTransition(
  scene: PlaySceneContext,
  next: { readonly inventory: Record<string, number>; readonly itemUseCharges: Record<string, number> },
): void {
  scene.session.inventory = next.inventory;
  scene.session.itemUseCharges = next.itemUseCharges;
}

interface LeadSwingProfile {
  readonly attack: number;
  readonly defense: number;
  readonly range: number;
  readonly cooldownMs: number;
  readonly damageBonus: number;
  readonly elementId: string | undefined;
}

function leadActorSwingProfile(scene: PlaySceneContext): LeadSwingProfile | null {
  const project = store.getCurrent();
  const leadId = scene.session.partyActorIds[0];
  const actor = project.database.actors.find((entry) => entry.id === leadId);
  if (!actor) return null;
  const normalized = normalizeActorRecord(actor);
  const level = scene.session.actorLevels?.[leadId] ?? normalized.initialLevel;
  const config = scene.actionCombatState?.config;
  const weaponId = effectiveActorEquipment(project, actor, scene.session.actorEquipment?.[actor.id], effectiveActorClassId(project, scene.session, actor.id)).weapon;
  const weapon = project.database.equipment.find((entry) => entry.id === weaponId);
  const profile = weapon?.actionWeapon;
  const weaponAttack = weapon?.statBonuses?.attack ?? 0;
  return {
    attack: parameterValueAtLevel(normalized.parameterCurves.attack, level) + weaponAttack,
    defense: parameterValueAtLevel(normalized.parameterCurves.defense, level),
    range: profile?.swingRange ?? config?.swingRange ?? 1,
    cooldownMs: profile?.swingCooldownMs ?? config?.swingCooldownMs ?? 350,
    damageBonus: (config?.swingDamageBonus ?? 0) + (profile?.swingDamageBonus ?? 0),
    elementId: weapon?.attackElementIds?.[0],
  };
}

function leadActorStats(scene: PlaySceneContext): { attack: number; defense: number } | null {
  const profile = leadActorSwingProfile(scene);
  return profile ? { attack: profile.attack, defense: profile.defense } : null;
}

// 스윙 궤적. 예전에는 공격 범위 타일을 흰 사각형으로 칠했다 지우기만 해서
// "검기"가 아니라 네모 칸 점멸로 보였다. 이제 플레이어를 중심으로 초승달 궤적을
// 실제로 **훑고 지나가게** 그린다: 선행 각도가 SWING_SWEEP_DEG 를 쓸어가며
// 잔상이 뒤따르고, 진행에 따라 굵기·알파가 줄어 사라진다.
const SWING_SWEEP_DEG = 132;
const SWING_TRAIL_DEG = 74;
// 화면 좌표(y 아래로 증가) 기준 정면 각도.
const FACING_ANGLE_DEG: Record<Dir, number> = { right: 0, down: 90, left: 180, up: -90 };

function flashSwingArc(scene: PlaySceneContext, facing: Dir, range: number): void {
  const graphics = scene.add.graphics();
  graphics.setDepth(COMBAT_DEPTH);
  const centerX = characterSpriteX(scene.tileX);
  // 스프라이트 발밑이 아니라 몸통 높이에서 베어야 궤적이 캐릭터에 걸린다.
  const centerY = characterSpriteY(scene.tileY) - TILE_SIZE / 2;
  // 타일 16px 기준이라 작게 잡으면 데미지 숫자에 묻힌다 — 사거리 1 에서도 한 타일보다 크게.
  const radius = TILE_SIZE * (0.7 * Math.max(1, range) + 0.75);
  const facingDeg = FACING_ANGLE_DEG[facing];
  const startDeg = facingDeg - SWING_SWEEP_DEG / 2;

  // 진행도는 별도 객체를 트윈해서 읽는다. addCounter + tween.getValue() 는
  // Phaser 버전에 따라 null 을 돌려줘 t 가 계속 0 이 되고, 그러면 폭이 0 이라
  // 궤적이 한 프레임도 그려지지 않는다(실측으로 확인).
  const progress = { t: 0 };
  scene.tweens.add({
    targets: progress,
    t: 1,
    duration: SWING_VFX_MS,
    ease: "Cubic.easeOut",
    onUpdate: () => {
      const t = progress.t;
      const leadDeg = startDeg + SWING_SWEEP_DEG * t;
      // 잔상은 시작점 이전으로 넘어가지 않게 자르되, 첫 프레임에도 보이도록 최소 폭을 준다.
      const tailDeg = Math.max(startDeg, leadDeg - SWING_TRAIL_DEG) === leadDeg
        ? leadDeg - Math.min(SWING_TRAIL_DEG, 10)
        : Math.max(startDeg, leadDeg - SWING_TRAIL_DEG);
      const fade = 1 - t;
      graphics.clear();
      // 바깥쪽 흐린 층 → 안쪽 밝은 심 두 겹으로 겹쳐 검광처럼 보이게 한다.
      strokeArcBand(graphics, centerX, centerY, radius, tailDeg, leadDeg, 9, 0x8fd0ff, 0.4 * fade);
      strokeArcBand(graphics, centerX, centerY, radius, tailDeg, leadDeg, 4, 0xffffff, fade);
      // 선두를 짧게 한 번 더 덧그려 베는 끝이 밝게 튀게 한다.
      strokeArcBand(graphics, centerX, centerY, radius, Math.max(tailDeg, leadDeg - 16), leadDeg, 6, 0xffffff, fade);
    },
    onComplete: () => graphics.destroy(),
  });
}

// 스윙할 때 캐릭터도 같이 움직여야 궤적만 따로 나가는 느낌이 안 든다.
// 위치는 playSceneMovement 가 매 프레임 덮어쓰므로(x/y 직접 대입) 손대면 안 되고,
// 스케일은 아무도 건드리지 않아 안전하다. 눌렀다 펴는 스쿼시로 내지르는 동작을 낸다.
function pulsePlayerSwing(scene: PlaySceneContext): void {
  scene.tweens.killTweensOf(scene.player);
  scene.player.setScale(1, 1);
  scene.tweens.add({
    targets: scene.player,
    scaleX: 1.16,
    scaleY: 0.88,
    duration: Math.round(SWING_VFX_MS * 0.35),
    yoyo: true,
    ease: "Quad.easeOut",
    onComplete: () => scene.player.setScale(1, 1),
  });
}

// 초승달 한 겹. lineStyle + arc + strokePath 는 이 씬에서 화면에 나오지 않는다
// (HP 바처럼 fill 계열만 그려진다 — 실측 확인). 그래서 바깥/안쪽 반지름을 따라
// 점을 뽑아 **채워진 띠**로 그린다.
const ARC_SEGMENTS = 14;

function strokeArcBand(
  graphics: Phaser.GameObjects.Graphics,
  centerX: number,
  centerY: number,
  radius: number,
  fromDeg: number,
  toDeg: number,
  thickness: number,
  color: number,
  alpha: number
): void {
  if (alpha <= 0 || toDeg <= fromDeg) return;
  const outer = radius + thickness / 2;
  const inner = Math.max(1, radius - thickness / 2);
  const points: Phaser.Types.Math.Vector2Like[] = [];
  for (let step = 0; step <= ARC_SEGMENTS; step += 1) {
    const rad = Phaser.Math.DegToRad(fromDeg + ((toDeg - fromDeg) * step) / ARC_SEGMENTS);
    points.push({ x: centerX + Math.cos(rad) * outer, y: centerY + Math.sin(rad) * outer });
  }
  for (let step = ARC_SEGMENTS; step >= 0; step -= 1) {
    const rad = Phaser.Math.DegToRad(fromDeg + ((toDeg - fromDeg) * step) / ARC_SEGMENTS);
    points.push({ x: centerX + Math.cos(rad) * inner, y: centerY + Math.sin(rad) * inner });
  }
  graphics.fillStyle(color, alpha);
  graphics.fillPoints(points, true, true);
}

// 뜨는 데밌지 숫자. 타일이 16px 이라 12px 글자는 적 스프라이트를 토막 덮어버렸다.
// 8px + 엉은 하단 효과로 줄이고, 생재 높이도 한 타일 이내로 잡는다.
const DAMAGE_NUMBER_FONT_PX = 8;
const DAMAGE_NUMBER_RISE_PX = 10;

function spawnDamageNumber(scene: PlaySceneContext, worldX: number, worldY: number, text: string, color: string): void {
  const label = scene.add.text(worldX, worldY, text, {
    fontFamily: projectFontStack(store.getCurrent().system.fonts, "mono"),
    fontSize: `${DAMAGE_NUMBER_FONT_PX}px`,
    fontStyle: "bold",
    color,
    stroke: "#000000",
    strokeThickness: 2,
  });
  label.setOrigin(0.5, 1);
  label.setDepth(COMBAT_DEPTH + 1);
  scene.tweens.add({
    targets: label,
    y: worldY - DAMAGE_NUMBER_RISE_PX,
    alpha: 0,
    duration: 650,
    onComplete: () => label.destroy(),
  });
}

function redrawEnemyHpBars(scene: PlaySceneContext, state: ActionCombatSceneState): void {
  const graphics = state.barsGraphics;
  if (!graphics) return;
  graphics.clear();
  for (const enemy of state.enemies.values()) {
    if (state.config.enemyHpBars === "damaged" && enemy.hp >= enemy.maxHp) continue;
    const sprite = scene.eventSprites.get(enemy.eventId);
    if (!sprite) continue;
    const barWidth = 24;
    const x = sprite.x - barWidth / 2;
    const y = sprite.y - sprite.displayHeight - 6;
    const ratio = enemy.maxHp > 0 ? enemy.hp / enemy.maxHp : 0;
    // 테두리 색 = 플레이어 기준 태도. NPC 난전에서 누가 적인지 읽힐 유일한 단서다.
    graphics.fillStyle(stanceBarColor(effectiveFactionStance(state.factions, state.factionStanceOverrides, PLAYER_FACTION_ID, enemy.factionId)), 0.9);
    graphics.fillRect(x - 1, y - 1, barWidth + 2, 5);
    graphics.fillStyle(ratio > 0.3 ? 0x7ec850 : 0xe05c4a, 1);
    graphics.fillRect(x, y, Math.max(0, Math.round(barWidth * ratio)), 3);
  }
}

function updateActionHudModel(scene: PlaySceneContext, state: ActionCombatSceneState): void {
  if (!state.hud) return;
  const project = store.getCurrent();
  const leadId = scene.session.partyActorIds[0];
  if (!leadId) return;
  syncActorVitals(project, scene.session.actorVitals, leadId);
  const vitals = scene.session.actorVitals[leadId];
  if (!vitals) return;
  const signature = `${vitals.hp}/${vitals.maxHp}|${Math.round(state.stamina)}|${state.config.stamina}|${state.skillSlotIds.join(",")}|${state.activeSkillSlot}|${state.guarding}`;
  if (signature === state.lastHudSignature) return;
  state.lastHudSignature = signature;
  state.hud.update({
    hp: vitals.hp,
    maxHp: vitals.maxHp,
    stamina: Math.round(state.stamina),
    staminaMax: ACTION_STAMINA_MAX,
    showStamina: state.config.stamina,
    skillSlotNames: actionSkillSlotNames(project, state.skillSlotIds),
    activeSkillSlot: state.activeSkillSlot,
    guarding: state.guarding,
  });
}

function cleanupEnemyVisuals(scene: PlaySceneContext, enemy: ActionEnemyState): void {
  enemy.telegraph?.destroy();
  enemy.telegraph = undefined;
  enemy.knockbackTween?.stop();
  enemy.knockbackTween = undefined;
  stopWindupTelegraph(scene, enemy);
  const mover = scene.autonomousNPCs.get(enemy.eventId);
  if (mover) mover.actionFrozen = false;
  scene.eventSprites.get(enemy.eventId)?.clearTint();
}

// 액션 전투 효과음 재생. 리소스가 프로젝트에 없으면 playAudioCommand 가 조용히 no-op.
function playActionSe(resourceId: string): void {
  playAudioCommand({ resourceId, loop: false }, store.getCurrent());
}

// 실제 넉백. 규칙(방향/저항/막힘)은 resolveKnockback 이 정하고, 여기서는 런타임 좌표를 옮기고
// 스프라이트를 **새 타일로** 보낸다(예전에는 5px 밀었다가 제자리로 돌아와 위치가 그대로였다).
function applyKnockback(scene: PlaySceneContext, state: ActionCombatSceneState, enemy: ActionEnemyState): void {
  const from = enemyTilePosition(scene, enemy.eventId);
  if (!from) return;
  const project = store.getCurrent();
  const outcome = resolveKnockback({
    enemyTile: from,
    playerTile: { x: scene.tileX, y: scene.tileY },
    knockbackResist: enemy.knockbackResist,
    roll: nextSessionRandom(scene.session, "battle"),
    inBounds: (x, y) => inBounds(scene.map, x, y),
    isPassable: (x, y) => isPassable(project, scene.map, x, y),
    isOccupied: (x, y) => otherEnemyOccupiesTile(scene, state, enemy.eventId, x, y),
  });
  if (!outcome.displaced) return;
  moveRuntimeEventPosition(scene.eventPositions, enemy.eventId, outcome.x, outcome.y, scene.eventPositions[enemy.eventId]?.direction ?? "down");
  const sprite = scene.eventSprites.get(enemy.eventId);
  if (!sprite) return;
  enemy.knockbackTween?.stop();
  enemy.knockbackTween = scene.tweens.add({
    targets: sprite,
    x: characterSpriteX(outcome.x),
    y: characterSpriteY(outcome.y),
    duration: KNOCKBACK_TWEEN_MS,
    ease: "Quad.easeOut",
    onComplete: () => {
      enemy.knockbackTween = undefined;
      sprite.setPosition(characterSpriteX(outcome.x), characterSpriteY(outcome.y));
    },
  });
}

function otherEnemyOccupiesTile(scene: PlaySceneContext, state: ActionCombatSceneState, selfEventId: string, x: number, y: number): boolean {
  for (const other of state.enemies.values()) {
    if (other.eventId === selfEventId) continue;
    const pos = enemyTilePosition(scene, other.eventId);
    if (pos && pos.x === x && pos.y === y) return true;
  }
  return false;
}

function dominantAxisDir(dx: number, dy: number): Dir {
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? "right" : "left";
  return dy >= 0 ? "down" : "up";
}

function dirDelta(dir: Dir): { x: -1 | 0 | 1; y: -1 | 0 | 1 } {
  switch (dir) {
    case "down": return { x: 0, y: 1 };
    case "left": return { x: -1, y: 0 };
    case "right": return { x: 1, y: 0 };
    case "up": return { x: 0, y: -1 };
  }
}

function updateEnemyModes(scene: PlaySceneContext, state: ActionCombatSceneState, deltaMs: number): void {
  const refs = combatantRefs(scene, state);
  for (const enemy of state.enemies.values()) {
    enemy.attackCooldownMs = Math.max(0, enemy.attackCooldownMs - deltaMs);
    const pos = enemyTilePosition(scene, enemy.eventId);
    if (!pos) continue;
    // 원거리 적은 거리를 지킨다: 추객 묘버에 밴드를 심어 주면 붙지 않게 한다.
    const mover = scene.autonomousNPCs.get(enemy.eventId);
    if (mover) mover.kite = kiteBandForAttack(enemy.actionAttack) ?? undefined;
    const target = acquireEnemyTarget(scene, state, enemy, pos, refs);
    // 믄버는 기본적으로 플레이어를 췔는다. NPC 를 노릴 때만 목표 좌표를 심어 준다.
    if (mover) {
      mover.chaseTarget = target !== null && target.id !== PLAYER_COMBATANT_ID
        ? { x: target.x, y: target.y }
        : undefined;
    }
    const dx = (target?.x ?? pos.x) - pos.x;
    const dy = (target?.y ?? pos.y) - pos.y;
    const cheby = target ? Math.max(Math.abs(dx), Math.abs(dy)) : Number.POSITIVE_INFINITY;
    const attack = enemy.actionAttack;
    switch (enemy.mode) {
      case "combat": {
        if (!attack || enemy.attackCooldownMs > 0 || !target) break;
        if (attack.kind === "melee" && cheby <= attack.range) startWindup(scene, enemy, attack, pos.x, pos.y, dx, dy);
        else if (attack.kind === "projectile" && cheby <= attack.range && cheby >= 2) startWindup(scene, enemy, attack, pos.x, pos.y, dx, dy);
        else if (attack.kind === "dash" && cheby <= attack.range && cheby >= 2 && (dx === 0 || dy === 0)) {
          startWindup(scene, enemy, attack, pos.x, pos.y, dx, dy);
        }
        break;
      }
      case "windup": {
        enemy.modeTimerMs -= deltaMs;
        if (enemy.modeTimerMs <= 0) executeStrike(scene, state, enemy, attack, pos);
        break;
      }
      case "dash": {
        stepDash(scene, state, enemy, deltaMs);
        break;
      }
      case "stagger": {
        const staggered = tickStagger({
          modeTimerMs: enemy.modeTimerMs,
          deltaMs,
          attackCooldownMs: enemy.attackCooldownMs,
          armCooldownMs: attack?.cooldownMs ?? DEFAULT_ATTACK_COOLDOWN_MS,
        });
        enemy.modeTimerMs = staggered.modeTimerMs;
        enemy.attackCooldownMs = staggered.attackCooldownMs;
        if (staggered.mode === "combat") endRecover(scene, enemy, attack);
        break;
      }
      case "recover": {
        enemy.modeTimerMs -= deltaMs;
        if (enemy.modeTimerMs <= 0) endRecover(scene, enemy, attack);
        break;
      }
    }
  }
}

function startWindup(scene: PlaySceneContext, enemy: ActionEnemyState, attack: EnemyActionAttack, ex: number, ey: number, dx: number, dy: number): void {
  enemy.mode = "windup";
  enemy.modeTimerMs = attack.windupMs;
  const mover = scene.autonomousNPCs.get(enemy.eventId);
  if (mover) {
    mover.actionFrozen = true;
    mover.facing = dominantAxisDir(dx, dy);
    mover.activeMove = null;
  }
  const sprite = scene.eventSprites.get(enemy.eventId);
  if (sprite) sprite.setPosition(characterSpriteX(ex), characterSpriteY(ey));
  const dir = dominantAxisDir(dx, dy);
  moveRuntimeEventPosition(scene.eventPositions, enemy.eventId, ex, ey, dir);
  startWindupTelegraph(scene, enemy, sprite);
  drawTelegraph(scene, enemy, attack, ex, ey, dir, dx, dy);
}

// windup 예고 시각화: 스프라이트에 붉은 tint 를 입히고 alpha 를 점멸시켜 "공격이 온다" 를 알린다.
function startWindupTelegraph(scene: PlaySceneContext, enemy: ActionEnemyState, sprite: Phaser.GameObjects.Sprite | undefined): void {
  if (!sprite) return;
  stopWindupTelegraph(scene, enemy);
  sprite.setTint(WINDUP_TINT_COLOR);
  enemy.windupTween = scene.tweens.add({
    targets: sprite,
    alpha: 0.4,
    duration: WINDUP_TINT_DURATION_MS,
    yoyo: true,
    repeat: -1,
  });
}

// windup 종료/취소 시 예고 시각화 원복. tint 가 남으면 적이 계속 빨갛게 보인다.
function stopWindupTelegraph(scene: PlaySceneContext, enemy: ActionEnemyState): void {
  if (enemy.windupTween) {
    enemy.windupTween.stop();
    enemy.windupTween = undefined;
  }
  const sprite = scene.eventSprites.get(enemy.eventId);
  if (!sprite) return;
  sprite.setAlpha(1);
  // 피격 흰색 플래시가 진행 중이면 그 tint 를 지우지 않는다.
  if (enemy.flashMs <= 0) sprite.clearTint();
}

function drawTelegraph(scene: PlaySceneContext, enemy: ActionEnemyState, attack: EnemyActionAttack, ex: number, ey: number, dir: Dir, dx: number, dy: number): void {
  const graphics = scene.add.graphics();
  graphics.setDepth(COMBAT_DEPTH - 1);
  graphics.fillStyle(0xff3322, TELEGRAPH_ALPHA);
  const project = store.getCurrent();
  const cells: { x: number; y: number }[] = [];
  if (attack.kind === "melee") {
    cells.push(...swingArcCells(dir, ex, ey, attack.range));
  } else if (attack.kind === "dash") {
    const delta = dirDelta(dir);
    for (let step = 1; step <= attack.range; step += 1) {
      const cx = ex + delta.x * step;
      const cy = ey + delta.y * step;
      if (!inBounds(scene.map, cx, cy) || !isPassable(project, scene.map, cx, cy)) break;
      cells.push({ x: cx, y: cy });
    }
  } else {
    const len = Math.max(1, Math.round(Math.hypot(dx, dy)));
    for (let step = 1; step <= Math.min(attack.range, len); step += 1) {
      const cx = ex + Math.round((dx / len) * step);
      const cy = ey + Math.round((dy / len) * step);
      if (!inBounds(scene.map, cx, cy)) break;
      if (!cells.some((c) => c.x === cx && c.y === cy)) cells.push({ x: cx, y: cy });
    }
  }
  for (const cell of cells) {
    graphics.fillRect(characterSpriteX(cell.x) - TILE_SIZE / 2, characterSpriteY(cell.y) - TILE_SIZE, TILE_SIZE, TILE_SIZE);
  }
  enemy.telegraph = graphics;
}

function executeStrike(scene: PlaySceneContext, state: ActionCombatSceneState, enemy: ActionEnemyState, attack: EnemyActionAttack | undefined, pos: { x: number; y: number }): void {
  enemy.telegraph?.destroy();
  enemy.telegraph = undefined;
  stopWindupTelegraph(scene, enemy);
  if (!attack) {
    endRecover(scene, enemy, attack);
    return;
  }
  const dir = scene.eventPositions[enemy.eventId]?.direction ?? "down";
  const targetId = enemy.targetId;
  const tiles = targetId !== undefined ? targetTiles(scene, targetId) : [];
  if (attack.kind === "melee") {
    const arc = swingArcCells(dir, pos.x, pos.y, attack.range);
    const hit = tiles.find((tile) => cellInArc(arc, tile.x, tile.y));
    if (hit && targetId !== undefined) {
      damageActionTarget(scene, state, enemy, targetId, attack.damage, hit.x, hit.y);
    }
    enterRecover(enemy, attack);
    return;
  }
  if (attack.kind === "projectile") {
    spawnProjectileFrom(scene, state, {
      faction: "enemy",
      ownerId: enemy.eventId,
      ownerFactionId: enemy.factionId,
      x: pos.x,
      y: pos.y,
      dirX: 0,
      dirY: 0,
      aimAt: tiles[0],
      speedTilesPerSec: attack.projectileSpeedTilesPerSec ?? DEFAULT_PROJECTILE_SPEED_TILES_PER_SEC,
      damage: attack.damage,
      elementId: undefined,
      maxRangeTiles: attack.range,
      color: 0xff7733,
    });
    enterRecover(enemy, attack);
    return;
  }
  const delta = dirDelta(dir);
  const nextX = pos.x + delta.x;
  const nextY = pos.y + delta.y;
  enemy.dash = { dirX: delta.x, dirY: delta.y, tilesLeft: attack.range, stepProgressMs: 0, fromX: pos.x, fromY: pos.y, toX: nextX, toY: nextY };
  enemy.mode = "dash";
}

function enterRecover(enemy: ActionEnemyState, attack: EnemyActionAttack): void {
  enemy.mode = "recover";
  enemy.modeTimerMs = attack.recoverMs;
}

function endRecover(scene: PlaySceneContext, enemy: ActionEnemyState, attack: EnemyActionAttack | undefined): void {
  enemy.mode = "combat";
  enemy.dash = undefined;
  enemy.attackCooldownMs = attack?.cooldownMs ?? DEFAULT_ATTACK_COOLDOWN_MS;
  const mover = scene.autonomousNPCs.get(enemy.eventId);
  if (mover) mover.actionFrozen = false;
  if (enemy.flashMs <= 0) scene.eventSprites.get(enemy.eventId)?.clearTint();
}

function stepDash(scene: PlaySceneContext, state: ActionCombatSceneState, enemy: ActionEnemyState, deltaMs: number): void {
  const dash = enemy.dash;
  const attack = enemy.actionAttack;
  if (!dash || !attack) {
    endRecover(scene, enemy, attack);
    return;
  }
  dash.stepProgressMs += deltaMs;
  const sprite = scene.eventSprites.get(enemy.eventId);
  if (dash.stepProgressMs < DASH_STEP_MS) {
    if (sprite) {
      const progress = dash.stepProgressMs / DASH_STEP_MS;
      sprite.setPosition(
        characterSpriteX(dash.fromX + (dash.toX - dash.fromX) * progress),
        characterSpriteY(dash.fromY + (dash.toY - dash.fromY) * progress)
      );
    }
    return;
  }
  dash.stepProgressMs = 0;
  const project = store.getCurrent();
  const targetId = enemy.targetId;
  const tiles = targetId !== undefined ? targetTiles(scene, targetId) : [];
  const hitsTarget = tiles.some((tile) => tile.x === dash.toX && tile.y === dash.toY);
  if (hitsTarget || !inBounds(scene.map, dash.toX, dash.toY) || !isPassable(project, scene.map, dash.toX, dash.toY)) {
    if (hitsTarget && targetId !== undefined) {
      damageActionTarget(scene, state, enemy, targetId, attack.damage, dash.fromX, dash.fromY);
    }
    if (sprite) sprite.setPosition(characterSpriteX(dash.fromX), characterSpriteY(dash.fromY));
    enterRecover(enemy, attack);
    return;
  }
  moveRuntimeEventPosition(scene.eventPositions, enemy.eventId, dash.toX, dash.toY, scene.eventPositions[enemy.eventId]?.direction ?? "down");
  dash.tilesLeft -= 1;
  const adjacentToTarget = tiles.some((tile) => (
    Math.max(Math.abs(dash.toX - tile.x), Math.abs(dash.toY - tile.y)) <= 1
  ));
  if (dash.tilesLeft <= 0 || adjacentToTarget) {
    enterRecover(enemy, attack);
    return;
  }
  dash.fromX = dash.toX;
  dash.fromY = dash.toY;
  dash.toX += dash.dirX;
  dash.toY += dash.dirY;
}

interface ProjectileSpawnSpec {
  readonly faction: "enemy" | "player";
  readonly ownerId: string;
  readonly ownerFactionId: string;
  readonly x: number;
  readonly y: number;
  readonly dirX: number;
  readonly dirY: number;
  readonly aimAt?: { readonly x: number; readonly y: number } | undefined;
  readonly speedTilesPerSec: number;
  readonly damage: number;
  readonly elementId: string | undefined;
  readonly maxRangeTiles: number;
  readonly color: number;
}

function spawnProjectileFrom(scene: PlaySceneContext, state: ActionCombatSceneState, spec: ProjectileSpawnSpec): void {
  let dirX = spec.dirX;
  let dirY = spec.dirY;
  if (spec.aimAt) {
    const dx = spec.aimAt.x - spec.x;
    const dy = spec.aimAt.y - spec.y;
    const len = Math.max(0.001, Math.hypot(dx, dy));
    dirX = dx / len;
    dirY = dy / len;
  }
  const object = scene.add.circle(characterSpriteX(spec.x), characterSpriteY(spec.y) - TILE_SIZE / 2, 3, spec.color);
  object.setDepth(COMBAT_DEPTH + 1);
  object.setStrokeStyle(1, spec.faction === "player" ? 0xddf4ff : 0xffdd88);
  state.projectileSerial += 1;
  state.projectiles.push({
    id: state.projectileSerial,
    faction: spec.faction,
    ownerId: spec.ownerId,
    ownerFactionId: spec.ownerFactionId,
    x: spec.x,
    y: spec.y,
    dirX,
    dirY,
    speedTilesPerMs: spec.speedTilesPerSec / 1000,
    damage: spec.damage,
    elementId: spec.elementId,
    traveledTiles: 0,
    maxRangeTiles: spec.maxRangeTiles,
    object,
  });
}

function updateProjectiles(scene: PlaySceneContext, state: ActionCombatSceneState, deltaMs: number): void {
  if (state.projectiles.length === 0) return;
  const project = store.getCurrent();
  const playerTiles = [{ x: scene.tileX, y: scene.tileY }];
  if (scene.moving) playerTiles.push({ x: scene.movingTo.x, y: scene.movingTo.y });
  for (let i = state.projectiles.length - 1; i >= 0; i -= 1) {
    const p = state.projectiles[i]!;
    let remaining = p.speedTilesPerMs * deltaMs;
    let consumed = false;
    let blocked = false;
    while (remaining > 0 && !consumed && !blocked) {
      const step = Math.min(0.5, remaining);
      remaining -= step;
      p.x += p.dirX * step;
      p.y += p.dirY * step;
      p.traveledTiles += step;
      const tx = Math.round(p.x);
      const ty = Math.round(p.y);
      blocked = p.traveledTiles >= p.maxRangeTiles || !inBounds(scene.map, tx, ty) || !isPassable(project, scene.map, tx, ty);
      if (blocked) break;
      // 유탄 명중: 발사자 진영에 우호(1 이상)가 아닌 전투원은 전부 맞는다.
      // 같은 진영은 대각선 기본값이 동맹(2)이라 자연하게 아군 오사에서 면제된다.
      if (
        p.ownerId !== PLAYER_COMBATANT_ID
        && isHittableByFaction(effectiveFactionStance(state.factions, state.factionStanceOverrides, p.ownerFactionId, PLAYER_FACTION_ID))
        && playerTiles.some((t) => t.x === tx && t.y === ty)
      ) {
        damagePlayer(scene, state, p.damage, tx, ty);
        consumed = true;
        break;
      }
      for (const enemy of [...state.enemies.values()]) {
        if (enemy.eventId === p.ownerId) continue;
        const pos = enemyTilePosition(scene, enemy.eventId);
        if (!pos || pos.x !== tx || pos.y !== ty) continue;
        if (!isHittableByFaction(effectiveFactionStance(state.factions, state.factionStanceOverrides, p.ownerFactionId, enemy.factionId))) continue;
        const multiplier = typeChartMultiplierForTypes(project, p.elementId, [], monsterTypesForRecord(project, enemy.enemyId));
        const damage = Math.max(1, Math.round(p.damage * multiplier));
        if (p.ownerId === PLAYER_COMBATANT_ID) hitActionEnemy(scene, state, enemy, damage, tx, ty);
        else damageEnemyByNpc(scene, state, enemy, p.ownerId, damage);
        consumed = true;
        break;
      }
    }
    p.object.setPosition(characterSpriteX(p.x), characterSpriteY(p.y) - TILE_SIZE / 2);
    if (consumed || blocked) {
      p.object.destroy();
      state.projectiles.splice(i, 1);
    }
  }
}
