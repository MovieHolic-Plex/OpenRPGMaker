/**
 * 전술(격자) 전투 — 이벤트 명령 tacticsBattle. 파티와 적 그룹(트룹)을 작은 격자 양 끝에 세우고
 * 턴마다 한 유닛씩 이동(맨해튼 이동력 안, 막힌 칸 우회) → 인접 적 공격을 한다. 한쪽이 전멸하면 끝.
 *
 * 규칙은 순수 상태기계(createTacticsState·tacticsMove·tacticsAttack·tacticsWait·runEnemyTurn)이고,
 * 키보드 오버레이(playTacticsBattle)는 그 위에 커서만 얹는다. 전투 결과는 세션 HP 에 되돌려 쓴다.
 */
import { actorDerivedStats } from "@/battle/battleBattlers";
import { normalizeActorRecord } from "@/project/actorModel";
import { effectiveActorEquipment } from "@/project/equipmentRules";
import { effectiveActorClassId } from "@/project/sessionClass";
import { syncActorVitals } from "@/project/sessionVitals";
import type { PlaySession } from "@/project/session";
import type { Project } from "@/project/types";

export const DEFAULT_TACTICS_WIDTH = 8;
export const DEFAULT_TACTICS_HEIGHT = 6;
export const DEFAULT_TACTICS_MOVE = 3;
/** 한 전투가 끝나지 않을 때 무승부 대신 패배로 끊는 턴 상한(양측 한 바퀴 = 1턴). */
export const TACTICS_TURN_LIMIT = 99;

export type TacticsSide = "party" | "enemy";

export interface TacticsUnit {
  readonly id: string;
  readonly side: TacticsSide;
  /** 파티면 actorId, 적이면 enemyId. */
  readonly sourceId: string;
  readonly name: string;
  x: number;
  y: number;
  hp: number;
  readonly maxHp: number;
  readonly attack: number;
  readonly defense: number;
  readonly move: number;
  /** 이번 턴에 이동을 마쳤는가. */
  moved: boolean;
  /** 이번 턴 행동이 끝났는가(공격 또는 대기). */
  acted: boolean;
}

export interface TacticsState {
  readonly width: number;
  readonly height: number;
  readonly units: TacticsUnit[];
  turn: TacticsSide;
  round: number;
  result?: "victory" | "defeat";
  readonly log: string[];
}

export interface TacticsUnitSeed {
  readonly sourceId: string;
  readonly name: string;
  readonly hp: number;
  readonly maxHp: number;
  readonly attack: number;
  readonly defense: number;
  readonly move?: number;
}

/** 파티는 왼쪽 열, 적은 오른쪽 열에 위에서부터 한 칸씩 걸러 세운다(열이 차면 안쪽 열로). */
export function createTacticsState(
  party: readonly TacticsUnitSeed[],
  enemies: readonly TacticsUnitSeed[],
  size: { readonly width?: number; readonly height?: number } = {},
): TacticsState {
  const width = Math.max(4, Math.trunc(size.width ?? DEFAULT_TACTICS_WIDTH));
  const height = Math.max(2, Math.trunc(size.height ?? DEFAULT_TACTICS_HEIGHT));
  const units: TacticsUnit[] = [];
  const place = (seeds: readonly TacticsUnitSeed[], side: TacticsSide): void => {
    seeds.forEach((seed, index) => {
      const column = Math.floor(index / height);
      const x = side === "party" ? column : width - 1 - column;
      const y = index % height;
      units.push({
        id: `${side}:${index}`,
        side,
        sourceId: seed.sourceId,
        name: seed.name,
        x,
        y,
        hp: Math.max(0, Math.trunc(seed.hp)),
        maxHp: Math.max(1, Math.trunc(seed.maxHp)),
        attack: Math.max(0, Math.trunc(seed.attack)),
        defense: Math.max(0, Math.trunc(seed.defense)),
        move: Math.max(1, Math.trunc(seed.move ?? DEFAULT_TACTICS_MOVE)),
        moved: false,
        acted: false,
      });
    });
  };
  place(party.slice(0, width * height / 2), "party");
  place(enemies.slice(0, width * height / 2), "enemy");
  const state: TacticsState = { width, height, units, turn: "party", round: 1, log: [] };
  settleResult(state);
  return state;
}

export function livingUnits(state: TacticsState, side?: TacticsSide): TacticsUnit[] {
  return state.units.filter((unit) => unit.hp > 0 && (side === undefined || unit.side === side));
}

export function unitAt(state: TacticsState, x: number, y: number): TacticsUnit | undefined {
  return state.units.find((unit) => unit.hp > 0 && unit.x === x && unit.y === y);
}

const STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

/** 이동 가능한 칸(자기 칸 포함). 살아 있는 유닛 칸은 지나가지도 멈추지도 못한다. */
export function reachableTiles(state: TacticsState, unit: TacticsUnit): { x: number; y: number }[] {
  const key = (x: number, y: number): string => `${x},${y}`;
  const seen = new Map<string, number>([[key(unit.x, unit.y), 0]]);
  const queue: { x: number; y: number; d: number }[] = [{ x: unit.x, y: unit.y, d: 0 }];
  const out: { x: number; y: number }[] = [{ x: unit.x, y: unit.y }];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.d >= unit.move) continue;
    for (const [dx, dy] of STEPS) {
      const x = current.x + dx;
      const y = current.y + dy;
      if (x < 0 || y < 0 || x >= state.width || y >= state.height || seen.has(key(x, y))) continue;
      if (unitAt(state, x, y)) continue;
      seen.set(key(x, y), current.d + 1);
      queue.push({ x, y, d: current.d + 1 });
      out.push({ x, y });
    }
  }
  return out;
}

export function adjacentFoes(state: TacticsState, unit: TacticsUnit): TacticsUnit[] {
  return livingUnits(state).filter((other) => other.side !== unit.side && Math.abs(other.x - unit.x) + Math.abs(other.y - unit.y) === 1);
}

export function tacticsDamage(attacker: Pick<TacticsUnit, "attack">, defender: Pick<TacticsUnit, "defense">): number {
  return Math.max(1, attacker.attack - Math.floor(defender.defense / 2));
}

function settleResult(state: TacticsState): void {
  if (state.result) return;
  if (livingUnits(state, "enemy").length === 0) state.result = "victory";
  else if (livingUnits(state, "party").length === 0) state.result = "defeat";
}

function canAct(state: TacticsState, unit: TacticsUnit | undefined): unit is TacticsUnit {
  return !!unit && !state.result && unit.hp > 0 && unit.side === state.turn && !unit.acted;
}

export function tacticsMove(state: TacticsState, unitId: string, x: number, y: number): boolean {
  const unit = state.units.find((entry) => entry.id === unitId);
  if (!canAct(state, unit) || unit.moved) return false;
  if (!reachableTiles(state, unit).some((tile) => tile.x === x && tile.y === y)) return false;
  unit.x = x;
  unit.y = y;
  unit.moved = true;
  return true;
}

export function tacticsAttack(state: TacticsState, unitId: string, targetId: string): number | undefined {
  const unit = state.units.find((entry) => entry.id === unitId);
  if (!canAct(state, unit)) return undefined;
  const target = adjacentFoes(state, unit).find((entry) => entry.id === targetId);
  if (!target) return undefined;
  const damage = tacticsDamage(unit, target);
  target.hp = Math.max(0, target.hp - damage);
  unit.moved = true;
  unit.acted = true;
  state.log.push(`${unit.name} → ${target.name} ${damage}${target.hp <= 0 ? " (쓰러짐)" : ""}`);
  settleResult(state);
  endTurnIfDone(state);
  return damage;
}

export function tacticsWait(state: TacticsState, unitId: string): boolean {
  const unit = state.units.find((entry) => entry.id === unitId);
  if (!canAct(state, unit)) return false;
  unit.moved = true;
  unit.acted = true;
  endTurnIfDone(state);
  return true;
}

/** 이번 편 유닛이 모두 행동했으면 상대 편으로 넘긴다. 파티 차례가 다시 오면 라운드가 는다. */
function endTurnIfDone(state: TacticsState): void {
  if (state.result) return;
  if (livingUnits(state, state.turn).some((unit) => !unit.acted)) return;
  state.turn = state.turn === "party" ? "enemy" : "party";
  if (state.turn === "party") state.round += 1;
  for (const unit of livingUnits(state, state.turn)) {
    unit.moved = false;
    unit.acted = false;
  }
  if (state.round > TACTICS_TURN_LIMIT) state.result = "defeat";
}

/** 적 AI: 유닛마다 가장 가까운 파티원 쪽으로 이동력만큼 다가가고, 붙어 있으면 HP 낮은 쪽을 친다. */
export function runEnemyTurn(state: TacticsState): void {
  if (state.turn !== "enemy") return;
  for (const unit of livingUnits(state, "enemy")) {
    if (state.result || state.turn !== "enemy") return;
    if (adjacentFoes(state, unit).length === 0) {
      const foes = livingUnits(state, "party");
      const distanceTo = (x: number, y: number): number =>
        Math.min(...foes.map((foe) => Math.abs(foe.x - x) + Math.abs(foe.y - y)));
      const best = reachableTiles(state, unit)
        .sort((a, b) => distanceTo(a.x, a.y) - distanceTo(b.x, b.y) || a.y - b.y || a.x - b.x)[0];
      if (best) tacticsMove(state, unit.id, best.x, best.y);
    }
    const target = adjacentFoes(state, unit).sort((a, b) => a.hp - b.hp || a.id.localeCompare(b.id))[0];
    if (target) tacticsAttack(state, unit.id, target.id);
    else tacticsWait(state, unit.id);
  }
}

// ── 프로젝트 → 유닛 ───────────────────────────────────────────

export function partyTacticsSeeds(project: Project, session: PlaySession): TacticsUnitSeed[] {
  const seeds: TacticsUnitSeed[] = [];
  for (const actorId of session.partyActorIds) {
    const actor = project.database.actors.find((entry) => entry.id === actorId);
    if (!actor) continue;
    syncActorVitals(project, session.actorVitals, actorId);
    const hp = session.actorVitals[actorId]?.hp ?? 0;
    if (hp <= 0) continue;
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
    seeds.push({ sourceId: actorId, name: actor.name, hp, maxHp: stats.maxHp, attack: stats.attack, defense: stats.defense });
  }
  return seeds;
}

export function troopTacticsSeeds(project: Project, troopId: string): TacticsUnitSeed[] {
  const troop = project.database.troops.find((entry) => entry.id === troopId);
  if (!troop) return [];
  const ids = troop.members?.length ? troop.members.map((member) => member.enemyId) : troop.enemyIds;
  return ids.flatMap((enemyId) => {
    const enemy = project.database.enemies.find((entry) => entry.id === enemyId);
    if (!enemy) return [];
    return [{ sourceId: enemyId, name: enemy.name, hp: enemy.stats.maxHp, maxHp: enemy.stats.maxHp, attack: enemy.stats.attack, defense: enemy.stats.defense }];
  });
}

/** 전투가 끝난 파티 HP 를 세션에 되돌린다. 쓰러진 파티원은 0(패배 처리는 호출자 몫). */
export function writeTacticsVitals(project: Project, session: PlaySession, state: TacticsState): void {
  for (const unit of state.units) {
    if (unit.side !== "party") continue;
    syncActorVitals(project, session.actorVitals, unit.sourceId);
    const vitals = session.actorVitals[unit.sourceId];
    if (vitals) vitals.hp = Math.max(0, Math.min(vitals.hp, unit.hp));
  }
}
