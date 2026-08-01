import { store } from "@/project/store";
import { DEFAULT_ATTACK_COOLDOWN_MS, DEFAULT_PROJECTILE_SPEED_TILES_PER_SEC, isActionCombatMap, resolveActionCombatConfig } from "@/project/actionCombat";
import { swingArcCells, cellInArc } from "@/action/hitbox";
import { computeContactDamage, computeSwingDamage } from "@/action/combatMath";
import { consumeHitstop } from "@/action/hitstop";
import { playAudioCommand } from "@/player/audio";
import { resolveFieldSpawnVictory, syncFieldSpawnEventsIntoMap } from "@/player/fieldSpawns";
import { recordFieldSpawnKill } from "@/player/playSceneFieldSpawns";
import { syncActorVitals } from "@/project/sessionVitals";
import { normalizeActorRecord, parameterValueAtLevel } from "@/project/actorModel";
import { nextSessionRandom } from "@/project/session";
import { characterSpriteX, characterSpriteY, MAP_UPPER_LAYER_DEPTH } from "@/player/characterDepth";
import { TILE_SIZE } from "@/assets/bundled";
import { inBounds, isPassable } from "@/project/collision";
import { moveRuntimeEventPosition } from "@/player/runtimeEventState";
import { monsterTypesForRecord, typeChartMultiplierForTypes } from "@/battle/typeChart";
import { applyActorLevelUp } from "@/player/battleRewardsToSession";
import { learnedSkillIds } from "@/battle/battleBattlers";
import { effectiveActorClassId, hasActorClassOverride } from "@/project/sessionClass";
import { effectiveActorEquipment } from "@/player/playerEquipmentRules";
import { transitionItemState } from "@/player/itemTransitions";
import type { Dir, EnemyActionAttack, EnemyRecord, Project } from "@/project/types";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import {
  ACTION_STAMINA_MAX,
  ACTION_STAMINA_REGEN_PER_SEC,
  ACTION_SWING_STAMINA_COST,
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
// 액션 전투 효과음 SE 리소스(EasyRPG RTP 사운드). 프로젝트에 해당 SE 가 없으면 resolveAudioSource 가 null 을 반환해 무음.
const SE_SWING_RESOURCE_ID = "easyrpg-sound-attack1";
const SE_HIT_ENEMY_RESOURCE_ID = "easyrpg-sound-blow2";
const SE_PLAYER_HURT_RESOURCE_ID = "easyrpg-sound-damage2";
// 적 공격 예고: windup 중 스프라이트 붉은 tint 점멸.
const WINDUP_TINT_COLOR = 0xff5544;
const WINDUP_TINT_DURATION_MS = 160;

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
    enemies: new Map(),
    projectiles: [],
    projectileSerial: 0,
    playerIframesMs: 0,
    playerFlashMs: 0,
    swingCooldownMs: 0,
    stamina: ACTION_STAMINA_MAX,
    hitstopMs: 0,
    lastHudSignature: "",
  };
  scene.actionCombatState = state;
  scene.input_.setAttackMode(true);
  syncActionEnemies(scene);
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
  syncActionEnemies(scene);
  tickActionTimers(scene, state, deltaMs);
  updateEnemyModes(scene, state, deltaMs);
  updateProjectiles(scene, state, deltaMs);
  applyContactDamage(scene, state);
  redrawEnemyHpBars(scene, state);
  updateActionHudModel(scene, state);
}

function tickActionTimers(scene: PlaySceneContext, state: ActionCombatSceneState, deltaMs: number): void {
  state.playerIframesMs = Math.max(0, state.playerIframesMs - deltaMs);
  state.swingCooldownMs = Math.max(0, state.swingCooldownMs - deltaMs);
  if (state.config.stamina) {
    state.stamina = Math.min(ACTION_STAMINA_MAX, state.stamina + (ACTION_STAMINA_REGEN_PER_SEC * deltaMs) / 1000);
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
  }
}

function syncActionEnemies(scene: PlaySceneContext): void {
  const state = scene.actionCombatState;
  if (!state || !scene.fieldSpawnState) return;
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

function enemyTilePosition(scene: PlaySceneContext, eventId: string): { x: number; y: number } | null {
  const pos = scene.eventPositions[eventId];
  if (pos) {
    const mover = scene.autonomousNPCs.get(eventId);
    const move = mover?.activeMove;
    if (move && mover) {
      const progress = Math.min(1, move.elapsedMs / Math.max(1, mover.moveDurationMs));
      return {
        x: Math.round(move.fromX + (move.toX - move.fromX) * progress),
        y: Math.round(move.fromY + (move.toY - move.fromY) * progress),
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

function applyContactDamage(scene: PlaySceneContext, state: ActionCombatSceneState): void {
  // RM eventTouch 의미론: 적이 플레이어에 "닿는" 것은 같은 칸이 아니라 인접(8방) 접촉.
  // NPC 이동 규칙상 적 묘버는 플레이어 칸에 진입할 수 없으므로 같은 칸 판정은 절대 발화하지 않는다.
  const targets = [{ x: scene.tileX, y: scene.tileY }];
  if (scene.moving) targets.push({ x: scene.movingTo.x, y: scene.movingTo.y });
  for (const enemy of state.enemies.values()) {
    if (enemy.mode === "dash") continue;
    const pos = enemyTilePosition(scene, enemy.eventId);
    if (!pos) continue;
    const touching = targets.some((t) => Math.max(Math.abs(pos.x - t.x), Math.abs(pos.y - t.y)) <= 1);
    if (!touching) continue;
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
  const dodging = scene.dashing && scene.moving;
  if (dodging) return;
  const project = store.getCurrent();
  const leadId = scene.session.partyActorIds[0];
  if (!leadId) return;
  syncActorVitals(project, scene.session.actorVitals, leadId);
  const vitals = scene.session.actorVitals[leadId];
  if (!vitals || vitals.hp <= 0) return;
  vitals.hp = Math.max(0, vitals.hp - damage);
  state.playerIframesMs = state.config.playerIframesMs;
  state.playerFlashMs = PLAYER_FLASH_MS;
  state.hitstopMs = Math.max(state.hitstopMs, HITSTOP_PLAYER_HURT_MS);
  scene.player.setTintFill(0xff7777);
  scene.cameras.main.shake(90, 0.006);
  playActionSe(SE_PLAYER_HURT_RESOURCE_ID);
  spawnDamageNumber(scene, characterSpriteX(fromTileX), characterSpriteY(fromTileY) - 20, `-${damage}`, "#ff6655");
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
  if (state.swingCooldownMs > 0) return;
  if (state.config.stamina && state.stamina < ACTION_SWING_STAMINA_COST) return;
  const lead = leadActorSwingProfile(scene);
  if (!lead) return;
  state.swingCooldownMs = lead.cooldownMs;
  if (state.config.stamina) state.stamina = Math.max(0, state.stamina - ACTION_SWING_STAMINA_COST);
  const arc = swingArcCells(scene.facing, scene.tileX, scene.tileY, lead.range);
  flashSwingArc(scene, scene.facing, lead.range);
  pulsePlayerSwing(scene);
  playActionSe(SE_SWING_RESOURCE_ID);
  const project = store.getCurrent();
  for (const enemy of [...state.enemies.values()]) {
    const pos = enemyTilePosition(scene, enemy.eventId);
    if (!pos || !cellInArc(arc, pos.x, pos.y)) continue;
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
  const knownSkillIds = (() => {
    const actor = project.database.actors.find((entry) => entry.id === leadId);
    if (!actor) return [] as string[];
    const normalized = normalizeActorRecord(actor);
    const level = scene.session.actorLevels?.[leadId] ?? normalized.initialLevel;
    const classOverrides = scene.session.classOverrides;
    const effectiveClass = effectiveActorClassId(project, { classOverrides }, leadId);
    const usesOverride = hasActorClassOverride({ classOverrides: classOverrides ? { ...classOverrides } : undefined }, leadId);
    return learnedSkillIds(project, normalized, level, scene.session.actorSkillIds?.[leadId], effectiveClass, usesOverride);
  })();
  const skill = knownSkillIds
    .map((id) => project.database.skills.find((entry) => entry.id === id))
    .find((record) => record?.actionSkill);
  if (!skill?.actionSkill) return;
  const mpCost = skill.mpCost.flat + Math.round((skill.mpCost.percentMax * vitals.maxMp) / 100);
  if (vitals.mp < mpCost) return;
  const ammo = skill.actionSkill.itemCost;
  if (ammo && (scene.session.inventory[ammo.itemId] ?? 0) < ammo.amount) return;
  vitals.mp -= mpCost;
  if (ammo) commitItemRemoval(project, scene, ammo.itemId, ammo.amount);
  const dir = dirDelta(scene.facing);
  spawnProjectileFrom(scene, state, {
    faction: "player",
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

function hitActionEnemy(scene: PlaySceneContext, state: ActionCombatSceneState, enemy: ActionEnemyState, damage: number, tileX: number, tileY: number): void {
  enemy.hp = Math.max(0, enemy.hp - damage);
  enemy.flashMs = ENEMY_FLASH_MS;
  state.hitstopMs = Math.max(state.hitstopMs, HITSTOP_HIT_ENEMY_MS);
  scene.eventSprites.get(enemy.eventId)?.setTintFill(0xffffff);
  scene.cameras.main.shake(60, 0.004);
  playActionSe(SE_HIT_ENEMY_RESOURCE_ID);
  spawnDamageNumber(scene, characterSpriteX(tileX), characterSpriteY(tileY) - 20, String(damage), "#ffe066");
  applyKnockbackVisual(scene, enemy);
  if (enemy.hp > 0) return;
  grantActionKillRewards(scene, enemy, tileX, tileY);
  cleanupEnemyVisuals(scene, enemy);
  state.enemies.delete(enemy.eventId);
  if (scene.fieldSpawnState) {
    recordFieldSpawnKill(scene, resolveFieldSpawnVictory(scene.fieldSpawnState, enemy.eventId));
    syncFieldSpawnEventsIntoMap(scene.map, scene.fieldSpawnState, scene.eventPositions);
    scene.renderTiles();
    scene.registerPageMoveRoutes();
  }
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

function spawnDamageNumber(scene: PlaySceneContext, worldX: number, worldY: number, text: string, color: string): void {
  const label = scene.add.text(worldX, worldY, text, {
    fontFamily: "monospace",
    fontSize: "12px",
    fontStyle: "bold",
    color,
    stroke: "#000000",
    strokeThickness: 3,
  });
  label.setOrigin(0.5, 1);
  label.setDepth(COMBAT_DEPTH + 1);
  scene.tweens.add({
    targets: label,
    y: worldY - 14,
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
    graphics.fillStyle(0x000000, 0.7);
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
  const signature = `${vitals.hp}/${vitals.maxHp}|${Math.round(state.stamina)}|${state.config.stamina}`;
  if (signature === state.lastHudSignature) return;
  state.lastHudSignature = signature;
  state.hud.update({
    hp: vitals.hp,
    maxHp: vitals.maxHp,
    stamina: Math.round(state.stamina),
    staminaMax: ACTION_STAMINA_MAX,
    showStamina: state.config.stamina,
  });
}

function cleanupEnemyVisuals(scene: PlaySceneContext, enemy: ActionEnemyState): void {
  enemy.telegraph?.destroy();
  enemy.telegraph = undefined;
  stopWindupTelegraph(scene, enemy);
  const mover = scene.autonomousNPCs.get(enemy.eventId);
  if (mover) mover.actionFrozen = false;
  scene.eventSprites.get(enemy.eventId)?.clearTint();
}

// 액션 전투 효과음 재생. 리소스가 프로젝트에 없으면 playAudioCommand 가 조용히 no-op.
function playActionSe(resourceId: string): void {
  playAudioCommand({ resourceId, loop: false }, store.getCurrent());
}

function applyKnockbackVisual(scene: PlaySceneContext, enemy: ActionEnemyState): void {
  const sprite = scene.eventSprites.get(enemy.eventId);
  if (!sprite) return;
  if (enemy.knockbackResist > 0 && nextSessionRandom(scene.session, "battle") < enemy.knockbackResist) return;
  const dx = sprite.x - characterSpriteX(scene.tileX);
  const dy = sprite.y - characterSpriteY(scene.tileY);
  const len = Math.max(0.001, Math.hypot(dx, dy));
  const push = 5;
  const homeX = sprite.x;
  const homeY = sprite.y;
  sprite.setPosition(homeX + (dx / len) * push, homeY + (dy / len) * push);
  scene.tweens.add({ targets: sprite, x: homeX, y: homeY, duration: 140 });
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
  for (const enemy of state.enemies.values()) {
    enemy.attackCooldownMs = Math.max(0, enemy.attackCooldownMs - deltaMs);
    const pos = enemyTilePosition(scene, enemy.eventId);
    if (!pos) continue;
    const dx = scene.tileX - pos.x;
    const dy = scene.tileY - pos.y;
    const cheby = Math.max(Math.abs(dx), Math.abs(dy));
    const attack = enemy.actionAttack;
    switch (enemy.mode) {
      case "combat": {
        if (!attack || enemy.attackCooldownMs > 0) break;
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
  if (attack.kind === "melee") {
    const arc = swingArcCells(dir, pos.x, pos.y, attack.range);
    if (cellInArc(arc, scene.tileX, scene.tileY) || (scene.moving && cellInArc(arc, scene.movingTo.x, scene.movingTo.y))) {
      damagePlayer(scene, state, attack.damage, scene.tileX, scene.tileY);
    }
    enterRecover(enemy, attack);
    return;
  }
  if (attack.kind === "projectile") {
    spawnProjectileFrom(scene, state, {
      faction: "enemy",
      x: pos.x,
      y: pos.y,
      dirX: 0,
      dirY: 0,
      aimAtPlayer: true,
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
  const hitsPlayer = (dash.toX === scene.tileX && dash.toY === scene.tileY)
    || (scene.moving && dash.toX === scene.movingTo.x && dash.toY === scene.movingTo.y);
  if (hitsPlayer || !inBounds(scene.map, dash.toX, dash.toY) || !isPassable(project, scene.map, dash.toX, dash.toY)) {
    if (hitsPlayer) damagePlayer(scene, state, attack.damage, dash.fromX, dash.fromY);
    if (sprite) sprite.setPosition(characterSpriteX(dash.fromX), characterSpriteY(dash.fromY));
    enterRecover(enemy, attack);
    return;
  }
  moveRuntimeEventPosition(scene.eventPositions, enemy.eventId, dash.toX, dash.toY, scene.eventPositions[enemy.eventId]?.direction ?? "down");
  dash.tilesLeft -= 1;
  const adjacentToPlayer = Math.max(Math.abs(dash.toX - scene.tileX), Math.abs(dash.toY - scene.tileY)) <= 1;
  if (dash.tilesLeft <= 0 || adjacentToPlayer) {
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
  readonly x: number;
  readonly y: number;
  readonly dirX: number;
  readonly dirY: number;
  readonly aimAtPlayer?: boolean;
  readonly speedTilesPerSec: number;
  readonly damage: number;
  readonly elementId: string | undefined;
  readonly maxRangeTiles: number;
  readonly color: number;
}

function spawnProjectileFrom(scene: PlaySceneContext, state: ActionCombatSceneState, spec: ProjectileSpawnSpec): void {
  let dirX = spec.dirX;
  let dirY = spec.dirY;
  if (spec.aimAtPlayer) {
    const dx = scene.tileX - spec.x;
    const dy = scene.tileY - spec.y;
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
      if (p.faction === "enemy") {
        if (playerTiles.some((t) => t.x === tx && t.y === ty)) {
          damagePlayer(scene, state, p.damage, tx, ty);
          consumed = true;
        }
      } else {
        for (const enemy of [...state.enemies.values()]) {
          const pos = enemyTilePosition(scene, enemy.eventId);
          if (!pos || pos.x !== tx || pos.y !== ty) continue;
          const multiplier = typeChartMultiplierForTypes(project, p.elementId, [], monsterTypesForRecord(project, enemy.enemyId));
          hitActionEnemy(scene, state, enemy, Math.max(1, Math.round(p.damage * multiplier)), tx, ty);
          consumed = true;
          break;
        }
      }
    }
    p.object.setPosition(characterSpriteX(p.x), characterSpriteY(p.y) - TILE_SIZE / 2);
    if (consumed || blocked) {
      p.object.destroy();
      state.projectiles.splice(i, 1);
    }
  }
}
