/**
 * 액션 전투 동료(system.actionCombat.allies). 켜면
 * - 필드를 따라오는 파티 동료가 사거리 안 가장 가까운 적을 스스로 때리고(동료마다 쿨다운),
 * - 선두 교대 키(V)로 살아 있는 다음 파티원이 조작 캐릭터가 된다(세이브의 partyActorIds 순서를 돌린다).
 * 꺼져 있으면 아무것도 하지 않는다 — 기존 액션 전투 그대로.
 *
 * 판정(누구를 언제 때리나)은 순수 함수 planAllyStrikes 이고, 씬 연결은 updateActionAlliesForScene 이 한다.
 */
import { computeSwingDamage } from "@/battle/action/combatMath";
import { actorDerivedStats } from "@/battle/battleBattlers";
import { normalizeActorRecord } from "@/project/actorModel";
import { effectiveActorEquipment } from "@/project/equipmentRules";
import { followerPositions } from "@/project/followers";
import { nextSessionRandom } from "@/project/session";
import { effectiveActorClassId } from "@/project/sessionClass";
import { syncActorVitals } from "@/project/sessionVitals";
import { store } from "@/project/store";
import type { Project, SystemActionCombat } from "@/project/types";
import type { PlaySession } from "@/project/session";
import type { ActionCombatSceneState, ActionEnemyState } from "@/player/actionCombatTypes";
import type { PlaySceneContext } from "@/player/playSceneTypes";

export const DEFAULT_ALLY_REACH_TILES = 1;
export const DEFAULT_ALLY_COOLDOWN_MS = 900;

export function actionAlliesEnabled(config: Pick<SystemActionCombat, "allies"> | undefined): boolean {
  return config?.allies === true;
}

export interface AllyCombatant {
  readonly actorId: string;
  readonly x: number;
  readonly y: number;
}

export interface EnemyTarget {
  readonly eventId: string;
  readonly x: number;
  readonly y: number;
}

export interface AllyStrike {
  readonly actorId: string;
  readonly eventId: string;
}

/**
 * 이번 프레임 휘두를 동료와 대상. cooldowns 는 제자리에서 줄고, 휘두른 동료는 cooldownMs 로 다시 찬다.
 * 대상은 체비쇼프 거리(대각 포함) reach 안의 가장 가까운 적. 같은 거리면 eventId 순으로 고정한다.
 */
export function planAllyStrikes(
  allies: readonly AllyCombatant[],
  enemies: readonly EnemyTarget[],
  cooldowns: Map<string, number>,
  deltaMs: number,
  options: { readonly reachTiles?: number; readonly cooldownMs?: number } = {},
): AllyStrike[] {
  const reach = options.reachTiles ?? DEFAULT_ALLY_REACH_TILES;
  const cooldownMs = options.cooldownMs ?? DEFAULT_ALLY_COOLDOWN_MS;
  const strikes: AllyStrike[] = [];
  for (const ally of allies) {
    const remaining = Math.max(0, (cooldowns.get(ally.actorId) ?? 0) - Math.max(0, deltaMs));
    cooldowns.set(ally.actorId, remaining);
    if (remaining > 0) continue;
    let best: { eventId: string; distance: number } | undefined;
    for (const enemy of enemies) {
      const distance = Math.max(Math.abs(Math.round(enemy.x) - ally.x), Math.abs(Math.round(enemy.y) - ally.y));
      if (distance > reach) continue;
      if (!best || distance < best.distance || (distance === best.distance && enemy.eventId < best.eventId)) {
        best = { eventId: enemy.eventId, distance };
      }
    }
    if (!best) continue;
    strikes.push({ actorId: ally.actorId, eventId: best.eventId });
    cooldowns.set(ally.actorId, cooldownMs);
  }
  return strikes;
}

function actorAlive(project: Project, session: PlaySession, actorId: string): boolean {
  syncActorVitals(project, session.actorVitals, actorId);
  return (session.actorVitals[actorId]?.hp ?? 0) > 0;
}

/** 필드에 서 있는 살아 있는 파티 동료(선두 제외)와 그 칸. */
export function partyAllyCombatants(project: Project, session: PlaySession, map: PlaySceneContext["map"]): AllyCombatant[] {
  const party = new Set(session.partyActorIds.slice(1));
  const out: AllyCombatant[] = [];
  for (const position of followerPositions(session, project.system.companions, { project, map })) {
    const actorId = position.follower.eventId;
    if (!actorId || position.follower.kind === "monster" || !party.has(actorId)) continue;
    if (!actorAlive(project, session, actorId)) continue;
    out.push({ actorId, x: position.x, y: position.y });
  }
  return out;
}

/**
 * 선두 교대: 살아 있는 다음 파티원을 맨 앞으로(앞사람은 맨 뒤로). 바꿨으면 새 선두 id.
 * 한 명뿐이거나 모두 쓰러졌으면 그대로 두고 undefined.
 */
export function rotateActionLeader(project: Project, session: PlaySession): string | undefined {
  const party = session.partyActorIds;
  for (let shift = 1; shift < party.length; shift += 1) {
    const candidate = party[shift];
    if (!candidate || !actorAlive(project, session, candidate)) continue;
    session.partyActorIds = [...party.slice(shift), ...party.slice(0, shift)];
    return candidate;
  }
  return undefined;
}

function allySwingDamage(project: Project, session: PlaySession, actorId: string, enemy: ActionEnemyState, bonus: number): number {
  const actor = project.database.actors.find((entry) => entry.id === actorId);
  if (!actor) return 1;
  const normalized = normalizeActorRecord(actor);
  const classId = effectiveActorClassId(project, session, actorId);
  const stats = actorDerivedStats(project, normalized, {
    level: session.actorLevels?.[actorId] ?? normalized.initialLevel,
    classOverrides: session.classOverrides,
    promotionLineage: session.promotionLineage,
    growthProgress: session.growthProgress,
    paramBonuses: session.actorParamBonuses?.[actorId],
    equipment: effectiveActorEquipment(project, actor, session.actorEquipment?.[actorId], classId),
  });
  return Math.max(1, computeSwingDamage({
    attackerAttack: stats.attack,
    defenderDefense: enemy.defense,
    bonus,
    rand: () => nextSessionRandom(session, "battle"),
  }));
}

/**
 * 액션 전투 한 프레임의 동료 몫. 선두 교대 엣지를 먼저 소모하고, 그다음 동료 공격을 굴린다.
 * hit 은 플레이어 스윙과 같은 피격 경로(보상·스폰 정리 포함)다.
 */
export function updateActionAlliesForScene(
  scene: PlaySceneContext,
  state: ActionCombatSceneState,
  deltaMs: number,
  enemyPosition: (eventId: string) => { x: number; y: number } | null,
  hit: (enemy: ActionEnemyState, damage: number, x: number, y: number) => void,
): void {
  const project = store.getCurrent();
  if (!actionAlliesEnabled(project.system.actionCombat)) return;
  if (scene.input_.consumeLeaderSwitchEdge() && rotateActionLeader(project, scene.session)) {
    scene.refreshRuntimeSurfaces();
  }
  const allies = partyAllyCombatants(project, scene.session, scene.map);
  if (allies.length === 0) return;
  const targets: EnemyTarget[] = [];
  for (const enemy of state.enemies.values()) {
    if (enemy.dying) continue;
    const pos = enemyPosition(enemy.eventId);
    if (pos) targets.push({ eventId: enemy.eventId, x: pos.x, y: pos.y });
  }
  state.allyCooldowns ??= new Map();
  for (const strike of planAllyStrikes(allies, targets, state.allyCooldowns, deltaMs)) {
    const enemy = state.enemies.get(strike.eventId);
    const pos = enemyPosition(strike.eventId);
    if (!enemy || enemy.dying || !pos) continue;
    hit(enemy, allySwingDamage(project, scene.session, strike.actorId, enemy, state.config.swingDamageBonus), pos.x, pos.y);
  }
}
