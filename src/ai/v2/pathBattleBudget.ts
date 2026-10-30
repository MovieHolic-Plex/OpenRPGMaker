// ai/v2/pathBattleBudget.ts
// 끝맺음: 청사진 길 위 전투(잡몹·길목 전투·보스)를 시작 파티 기준 «한 번에 이어 싸워도 전멸하지 않는» 예산에 맞춘다. 결정적(모의 시드 고정)·되풀이 안전.
//
// 왜(2026-10-29 vm4 argon·flash jrpg 판정): argon — 촌장 자리 붉은 드래곤(보스로 맞춘 사본, 모의 HP 손실 64%) 뒤 HP 174/514 로 동굴 임프 2마리
// (한 판 손실 27%, 동굴에 세 무리)를 만나 전멸했다. 각 전투는 따로 재면 «이긴다»였지만 이어 싸우면 길 위 손실 합이 100% 를 넘었다.
// flash — 판정자가 30분 안에 동굴 거미 두 번째 판에서 시간이 다 됐다(길 전투 셋 + 보스 8.5턴). 길 위 전투 수·전투당 길이도 맞아야 한다.
//
// 규칙(시작 파티 Lv·startActorIds, 몬스터 파티 게임은 제외):
//    보스 = 마지막 단계 이벤트의 전투, 없으면 마지막 단계 맵의 도망 못 치는 전투. 길목 = 그 밖의 도망 못 치는 전투. 잡몹 = 나머지.
//  - 필수 잡몹(닿으면 싸우는 상징 적 이벤트) 수 상한 MAX_FIELD_EVENTS — 넘는 상징 적은 뒤에서부터 지운다.
//  - 보스 앞 전투(길목·잡몹)의 모의 HP 손실 합 ≤ PRE_BOSS_BUDGET(길목 무게 2·잡몹 1 로 나눔, 각 상한 있음), 승률 100%(모의 판 전부).
//    보스는 쉼터(ensureBossRest) 뒤 풀 HP 로 — 승률 ≥ 95%·손실 ≤ 70%. 전투당 평균 턴 상한(잡몹 4 · 길목 6 · 보스 10).
//  - 길 = 시작 맵 → 단계 맵, 단계 맵 사이를 잇는 통로 맵(mapRoute)까지. 전투 = 이벤트(공통 이벤트 호출 포함)·조우표·옛 조우 목록·필드 스폰.
//  - 보스 앞 전투는 앞 길 전투에서 걸려 전투 뒤에도 남는 해로운 상태(독)를 지고 잰다(vm5 terra: 독이 다음 박쥐 전투로 이어져 전멸).
//  - 맞추기는 내리기만: 손실·승률이 넘치면 공격·마력과 적 피해 기술 위력 15%씩, 턴이 넘치면 HP 15%씩. 원본 DB 적·기술은 두고
//    `troop_path_*`/`enemy_path_*`/`skill_path_*` 사본을 쓴다.
//  - 시작 소지 회복약이 보스 앞 전투 수보다 적으면 채운다.
//  - 첫 길 전투 한 번으로 한 레벨이 오르게 시작 파티 곡선(같은 곡선 배우 전부)을 줄인다(vm5 argon: 346 받고 Lv1 그대로).
import { simulateBattle } from "@/battle/simulate";
import { ACTOR_LEVEL_MAX, normalizeActorRecord, totalExpForLevel } from "@/project/actorModel";
import { normalizeEnemyRecord } from "@/project/databaseEnemyTroopRecordModel";
import { actorBattlers } from "@/battle/battleBattlers";
import { stateBehavior } from "@/battle/battleStates";
import { stateClearsOnBattleEnd } from "@/project/battleEndStates";
import { mapRoute } from "@/player/objectiveTarget";
import type { ActorExperienceCurve, EnemyRecord, GameMap, Project, SkillRecord } from "@/project/types";
import { blueprintMapFor } from "./blueprintPath";
import { healingItemIds } from "./combatChecks";
import { startHealingItem } from "./healingAccess";

type Obj = Record<string, unknown>;
type Role = "field" | "gate" | "boss";

const PRE_BOSS_BUDGET = 0.6;
const ROLE_LIMIT = { field: { loss: 0.2, turns: 4, minWin: 1 }, gate: { loss: 0.35, turns: 6, minWin: 1 }, boss: { loss: 0.7, turns: 10, minWin: 0.95 } } as const;
const WEIGHT = { field: 1, gate: 2 } as const;
const MAX_FIELD_EVENTS = 4;
const SAMPLES = 24;
const ROUNDS = 16;
const MIN_CURVE_FACTOR = 0.2;
export const PATH_TROOP_PREFIX = "troop_path_";
export const PATH_SKILL_PREFIX = "skill_path_";

type Battle = { mapId: string; eventId?: string; troopId: string; role: Role; touch: boolean };

function walk(node: unknown, visit: (cmd: Obj) => void): void {
  if (Array.isArray(node)) { for (const item of node) walk(item, visit); return; }
  if (!node || typeof node !== "object") return;
  visit(node as Obj);
  for (const value of Object.values(node as Obj)) if (value && typeof value === "object") walk(value, visit);
}

/** 이벤트가 싸우는 무리(고정 troopId). 공통 이벤트 호출은 그 공통 이벤트의 전투까지 따라간다. */
function eventBattles(project: Project, event: GameMap["events"][number]): { troopId: string; canEscape: boolean }[] {
  const out: { troopId: string; canEscape: boolean }[] = [];
  const seen = new Set<string>();
  const visit = (node: unknown) => walk(node, (cmd) => {
    if (cmd.kind === "battleProcessing" && typeof cmd.troopId === "string" && cmd.troopSource !== "variable" && !out.some((b) => b.troopId === cmd.troopId)) out.push({ troopId: cmd.troopId, canEscape: cmd.canEscape !== false });
    if (cmd.kind === "callCommonEvent" && typeof cmd.commonEventId === "string" && !seen.has(cmd.commonEventId)) {
      seen.add(cmd.commonEventId);
      visit(project.commonEvents?.find((common) => common.id === cmd.commonEventId)?.commands);
    }
  });
  visit(event.pages);
  return out;
}

const touchFoe = (event: GameMap["events"][number]) => (event.pages ?? []).some((page) => ["eventTouch", "playerTouch"].includes(String((page.trigger as { kind?: string } | undefined)?.kind)));

/**
 * 청사진 길 위 맵 — 시작 맵에서 단계 맵까지, 단계 맵 사이를 잇는 맵(이동 명령 경로 mapRoute 의 가운데)까지 순서대로.
 * 왜(2026-10-29 vm5): 단계 장소만 보면 단계 사이 통로 맵의 조우가 예산 밖이었다.
 */
function pathMapIds(project: Project): string[] {
  const steps = project.gameBlueprint?.steps ?? [];
  const stepMaps = steps.map((step) => blueprintMapFor(project, step.place)?.id).filter((id): id is string => !!id);
  const out: string[] = [];
  const add = (id: string) => { if (project.maps[id] && !out.includes(id)) out.push(id); };
  let prev = project.maps[project.startMapId] ? project.startMapId : undefined;
  for (const id of stepMaps) {
    if (prev && prev !== id) for (const hop of mapRoute(project, prev, id) ?? [prev]) add(hop);
    add(id);
    prev = id;
  }
  return out;
}

/** 청사진 길 위 전투 목록(맵 순서·맵 안 이벤트 순서). 이벤트 전투(공통 이벤트 호출 포함)·조우표·옛 조우 목록(troopIds)·필드 스폰. */
export function pathBattles(project: Project): Battle[] {
  const steps = project.gameBlueprint?.steps ?? [];
  const mapIds = pathMapIds(project);
  if (!mapIds.length) return [];
  const last = steps[steps.length - 1];
  const lastMap = last ? blueprintMapFor(project, last.place)?.id : undefined;
  const out: Battle[] = [];
  for (const mapId of mapIds) {
    const map = project.maps[mapId];
    if (!map) continue;
    for (const event of map.events ?? []) for (const battle of eventBattles(project, event)) {
      const isLastStepEvent = !!last && (event.id === last.event || event.name === last.event);
      out.push({ mapId, eventId: event.id, troopId: battle.troopId, role: isLastStepEvent ? "boss" : battle.canEscape ? "field" : "gate", touch: touchFoe(event) });
    }
    const random = map.encounterTable?.length ? map.encounterTable.map((entry) => entry.troopId) : (map.encounterRate ?? 0) > 0 ? map.troopIds ?? [] : [];
    for (const troopId of [...random, ...(map.fieldSpawns ?? []).map((spawn) => spawn.troopId)]) {
      if (!out.some((b) => b.troopId === troopId && b.mapId === mapId)) out.push({ mapId, troopId, role: "field", touch: false });
    }
  }
  if (!out.some((b) => b.role === "boss")) {
    // 마지막 단계 맵의 도망 못 치는 전투 중 가장 센(적 HP 합) 것.
    const hp = (troopId: string) => (project.database.troops.find((t) => t.id === troopId)?.enemyIds ?? []).reduce((sum, id) => sum + (project.database.enemies.find((e) => e.id === id)?.stats.maxHp ?? 0), 0);
    const candidates = out.filter((b) => b.mapId === lastMap && b.role === "gate").sort((a, b) => hp(b.troopId) - hp(a.troopId));
    const boss = candidates[0];
    if (boss) for (const b of out) if (b.troopId === boss.troopId && b.mapId === boss.mapId) b.role = "boss";
  }
  return out;
}

/** 이 무리의 적이 거는, 전투가 끝나도 남는 해로운 상태(독처럼 다음 전투로 이어지는 것). */
function lingeringStates(project: Project, troopId: string): string[] {
  const out = new Set<string>();
  for (const enemyId of project.database.troops.find((t) => t.id === troopId)?.enemyIds ?? []) {
    const enemy = project.database.enemies.find((e) => e.id === enemyId);
    const skillIds = new Set([...(enemy?.skillIds ?? []), ...(enemy?.actions ?? []).map((a) => a.skillId)]);
    for (const skillId of skillIds) for (const effect of project.database.skills.find((k) => k.id === skillId)?.stateEffects ?? []) {
      if (effect.operation !== "add" || !(effect.chance > 0)) continue;
      const state = project.database.states.find((st) => st.id === effect.stateId);
      if (!state || stateClearsOnBattleEnd(project, state, state.id)) continue;
      const behavior = stateBehavior(state);
      if (behavior.hpDamagePercentPerTurn > 0 || behavior.restrictsAction || behavior.blocksSkillUse || behavior.attackMultiplier < 1 || behavior.defenseMultiplier < 1) out.add(state.id);
    }
  }
  return [...out];
}

function partyOf(project: Project): { ids: string[]; level: number; hp: number } | undefined {
  const ids = (project.system.startActorIds ?? []).filter((id) => project.database.actors.some((a) => a.id === id));
  if (!ids.length) return undefined;
  const level = Math.max(1, ...ids.map((id) => project.database.actors.find((a) => a.id === id)!.initialLevel ?? 1));
  const hp = actorBattlers(project, { levels: Object.fromEntries(ids.map((id) => [id, level])), partyActorIds: ids }).reduce((sum, b) => sum + b.maxHp, 0);
  return hp > 0 ? { ids, level, hp } : undefined;
}

/** 무리를 길 사본으로(이미 사본이면 그대로). 사본 적은 무리마다 따로 — 같은 적이 다른 몫의 무리에 있어도 서로 안 건드린다. */
function pathCopy(project: Project, troopId: string): string | undefined {
  if (troopId.startsWith(PATH_TROOP_PREFIX)) return troopId;
  const source = project.database.troops.find((t) => t.id === troopId);
  if (!source) return undefined;
  const id = `${PATH_TROOP_PREFIX}${troopId.replace(/^troop_/u, "")}`;
  if (project.database.troops.some((t) => t.id === id)) return id;
  const memberIds = (source.members?.length ? source.members.map((m) => m.enemyId) : source.enemyIds) ?? [];
  if (!memberIds.length) return undefined;
  const copies = new Map<string, string>();
  for (const enemyId of new Set(memberIds)) {
    const enemy = project.database.enemies.find((e) => e.id === enemyId);
    if (!enemy) return undefined;
    const copyId = `enemy_path_${id.slice(PATH_TROOP_PREFIX.length)}_${enemyId.replace(/^enemy_/u, "")}`;
    if (!project.database.enemies.some((e) => e.id === copyId)) project.database.enemies.push({ ...structuredClone(enemy), id: copyId } as EnemyRecord);
    copies.set(enemyId, copyId);
  }
  const clone = structuredClone(source);
  (clone as { id: string }).id = id;
  (clone as { enemyIds: string[] }).enemyIds = (source.enemyIds ?? memberIds).map((e) => copies.get(e) ?? e);
  if (source.members?.length) (clone as { members: unknown[] }).members = source.members.map((m) => ({ ...m, enemyId: copies.get(m.enemyId) ?? m.enemyId }));
  project.database.troops.push(clone);
  return id;
}

/**
 * 길 사본 무리의 적이 쓰는 피해 기술을 무리마다 사본(`skill_path_*`)으로 바꾼다 — 능력치가 바닥(1)이면 기술 위력(독침 53)이 피해를 정해
 * 공격·마력만 내려서는 피해가 줄지 않았다(vm5 terra). 이미 사본이면 그대로(되풀이 안전). 원본 기술은 두므로 다른 적·영웅에 번지지 않는다.
 */
function pathSkillCopies(project: Project, copyId: string): string {
  const prefix = `${PATH_SKILL_PREFIX}${copyId.slice(PATH_TROOP_PREFIX.length)}_`;
  const skillCopy = (skillId: string): string => {
    const skill = project.database.skills.find((k) => k.id === skillId);
    if (!skill || skill.effect.kind !== "damage" || !(skill.power > 0) || skillId.startsWith(PATH_SKILL_PREFIX)) return skillId;
    const id = `${prefix}${skillId.replace(/^skill_/u, "")}`;
    if (!project.database.skills.some((k) => k.id === id)) project.database.skills.push({ ...structuredClone(skill), id } as SkillRecord);
    return id;
  };
  for (const enemyId of new Set(project.database.troops.find((t) => t.id === copyId)?.enemyIds ?? [])) {
    const enemy = project.database.enemies.find((e) => e.id === enemyId);
    if (!enemy || !enemy.id.startsWith("enemy_path_")) continue;
    enemy.skillIds = (enemy.skillIds ?? []).map(skillCopy);
    enemy.actions = (enemy.actions ?? []).map((action) => ({ ...action, skillId: skillCopy(action.skillId) }));
  }
  return prefix;
}

export function fitPathBattlesIn(project: Project): string[] {
  if (!project.gameBlueprint || project.system.battleParty === "monsters" || project.system.monsterBattleParty === true) return [];
  const party = partyOf(project);
  if (!party) return [];
  const notes: string[] = [];
  let battles = pathBattles(project);
  if (!battles.length) return [];

  // 1) 필수 잡몹(닿으면 싸우는 상징 적) 수 상한 — 넘는 것은 뒤에서부터 지운다(이야기 이벤트가 아닌 이름 없는 도망 가능 상징 적만).
  const foes = battles.filter((b) => b.role === "field" && b.touch && b.eventId);
  const removable = foes.filter((b) => { const ev = project.maps[b.mapId]?.events.find((e) => e.id === b.eventId); return !!ev && !String(ev.name ?? "").trim(); });
  const excess = Math.max(0, foes.length - MAX_FIELD_EVENTS);
  if (excess > 0) {
    const drop = removable.slice(-excess);
    for (const b of drop) {
      const map = project.maps[b.mapId];
      if (map) map.events = map.events.filter((e) => e.id !== b.eventId);
    }
    if (drop.length) notes.push(`길 위 상징 적 ${foes.length}→${foes.length - drop.length}(상한 ${MAX_FIELD_EVENTS})`);
    battles = battles.filter((b) => !drop.includes(b));
  }

  // 2) 몫: 보스 앞 손실 예산을 길목 2·잡몹 1 무게로 나눈다(상징 적·길목은 이벤트마다, 조우표는 한 번으로 친다).
  const preBoss = battles.filter((b) => b.role !== "boss");
  const weight = preBoss.reduce((sum, b) => sum + WEIGHT[b.role as "field" | "gate"], 0);
  const capFor = (b: Battle): number => b.role === "boss" ? ROLE_LIMIT.boss.loss : Math.min(ROLE_LIMIT[b.role].loss, weight > 0 ? PRE_BOSS_BUDGET * WEIGHT[b.role as "field" | "gate"] / weight : 1);
  // 같은 무리가 여러 자리에 나오면 가장 엄한 몫으로.
  const plan = new Map<string, { role: Role; cap: number }>();
  for (const b of battles) {
    const cap = capFor(b);
    const prev = plan.get(b.troopId);
    const role: Role = prev?.role === "boss" || b.role === "boss" ? "boss" : prev?.role === "gate" || b.role === "gate" ? "gate" : "field";
    plan.set(b.troopId, { role, cap: Math.min(prev?.cap ?? cap, cap) });
  }

  // 3) 맞추기 — 내리기만.
  // 앞 길 전투에서 걸려 전투 뒤에도 남는 해로운 상태(독)를 지고 시작한다 — 보스는 쉼터 뒤라 맨몸. vm5 terra: 박쥐 독침의 독이 다음 박쥐 전투로
  // 이어져(방어 하락까지 겹쳐) 따로 재면 손실 20% 인 전투에서 전멸했다.
  const carried = new Map<string, string[]>();
  {
    const seenStates = new Set<string>();
    for (const b of battles) {
      if (b.role !== "boss") carried.set(b.troopId, [...new Set([...(carried.get(b.troopId) ?? []), ...seenStates])]);
      for (const stateId of lingeringStates(project, b.troopId)) seenStates.add(stateId);
    }
  }
  const measure = (troopId: string, startStateIds: readonly string[] = []) => {
    const r = simulateBattle({ project, troopId, heroLevel: party.level, partyActorIds: party.ids, n: SAMPLES, seed: 11, useSkills: true, startStateIds });
    return { win: r.winRate, loss: Math.max(0, 1 - r.avgHpRemaining / party.hp), turns: r.avgTurns };
  };
  const rename = new Map<string, string>();
  for (const [troopId, { role, cap }] of plan) {
    const limit = ROLE_LIMIT[role];
    const start = role === "boss" ? [] : carried.get(troopId) ?? [];
    let before: ReturnType<typeof measure>;
    try { before = measure(troopId, start); } catch { continue; }
    const fits = (m: ReturnType<typeof measure>) => m.win >= limit.minWin && m.loss <= cap + 1e-9 && m.turns <= limit.turns;
    if (fits(before)) continue;
    const copyId = pathCopy(project, troopId);
    if (!copyId) continue;
    const enemyIds = new Set(project.database.troops.find((t) => t.id === copyId)?.enemyIds ?? []);
    const skillPrefix = pathSkillCopies(project, copyId);
    let now = measure(copyId, start);
    for (let round = 0; round < ROUNDS && !fits(now); round += 1) {
      const strong = now.win < limit.minWin || now.loss > cap;
      const long = now.turns > limit.turns;
      let moved = false;
      for (const enemy of project.database.enemies) {
        if (!enemyIds.has(enemy.id)) continue;
        const s = enemy.stats;
        const next = {
          ...s,
          ...(strong ? { attack: Math.max(1, Math.floor(s.attack * 0.85)), mind: Math.max(1, Math.floor(s.mind * 0.85)) } : {}),
          ...(long || (strong && s.attack <= 1) ? { maxHp: Math.max(1, Math.floor(s.maxHp * 0.85)) } : {}),
        };
        if (next.attack !== s.attack || next.mind !== s.mind || next.maxHp !== s.maxHp) { enemy.stats = next; moved = true; }
      }
      if (strong) for (const skill of project.database.skills) {
        if (!skill.id.startsWith(skillPrefix) || !(skill.power > 1)) continue;
        skill.power = Math.max(1, Math.floor(skill.power * 0.85));
        moved = true;
      }
      if (!moved) break;
      now = measure(copyId, start);
    }
    if (copyId !== troopId) rename.set(troopId, copyId);
    const pct = (x: number) => `${Math.round(x * 100)}%`;
    notes.push(`${troopId}(${role === "boss" ? "보스" : role === "gate" ? "길목" : "잡몹"}${start.length ? `, 남은 상태 ${start.join("·")} 지고` : ""}) 승률 ${pct(before.win)}·손실 ${pct(before.loss)}·${before.turns.toFixed(1)}턴 → 승률 ${pct(now.win)}·손실 ${pct(now.loss)}·${now.turns.toFixed(1)}턴(몫 ${pct(cap)})`);
  }
  if (rename.size) {
    const mapIds = new Set(battles.map((b) => b.mapId));
    for (const mapId of mapIds) {
      const map = project.maps[mapId];
      if (!map) continue;
      for (const event of map.events ?? []) walk(event.pages, (cmd) => { if (cmd.kind === "battleProcessing" && typeof cmd.troopId === "string" && rename.has(cmd.troopId)) cmd.troopId = rename.get(cmd.troopId); });
      for (const entry of map.encounterTable ?? []) if (rename.has(entry.troopId)) entry.troopId = rename.get(entry.troopId)!;
    }
  }

  // 4) 시작 회복약 — 보스 앞 전투 수만큼은 들고 시작한다.
  const need = battles.filter((b) => b.role !== "boss" && (b.eventId || b.touch)).length;
  const heals = healingItemIds(project);
  const inventory = { ...(project.session.inventory ?? {}) };
  const have = Object.entries(inventory).reduce((sum, [id, n]) => sum + (heals.has(id) ? Math.max(0, n) : 0), 0);
  if (need > have) {
    const potion = startHealingItem(project);
    if (potion) {
      inventory[potion] = (inventory[potion] ?? 0) + (need - have);
      project.session = { ...project.session, inventory };
      notes.push(`시작 회복약 ${potion} +${need - have}(보스 앞 전투 ${need})`);
    }
  }

  // 5) 첫 길 전투 한 번으로 한 레벨 — 모자라면 시작 파티와 같은 곡선을 쓰는 배우들의 경험치 곡선을 같은 비율로 줄인다.
  const first = battles.find((b) => b.role !== "boss");
  if (first) notes.push(...fitFirstLevelUp(project, rename.get(first.troopId) ?? first.troopId, party));
  return notes;
}

/**
 * 첫 길 전투의 경험치로 시작 레벨에서 다음 레벨이 되도록 경험치 곡선(base·extra·acceleration)을 같은 비율로 줄인다.
 * 왜(2026-10-29 vm5 argon jrpg): 기본 곡선(extra 677)은 Lv2 까지 678 인데 첫 임프 두 마리가 346 이라, 판정자가
 * 「경험치 346 을 받았는데 메뉴에는 Lv 1 그대로」라고 적었다. 레벨이 더 빨리 오르는 쪽이라 위 예산(시작 레벨로 잰다)은 그대로 성립한다.
 * 곡선이 시작 파티의 맨 앞 배우와 같은 배우만 고친다 — 나중에 합류하는 같은 곡선 배우도 같은 속도로 오른다. 되풀이 안전(이미 맞으면 그대로).
 */
function fitFirstLevelUp(project: Project, troopId: string, party: { ids: readonly string[]; level: number }): string[] {
  const troop = project.database.troops.find((t) => t.id === troopId);
  const exp = (troop?.enemyIds ?? []).reduce((sum, id) => {
    const enemy = project.database.enemies.find((e) => e.id === id);
    return sum + (enemy ? Math.max(0, normalizeEnemyRecord(enemy).rewards.exp) : 0);
  }, 0);
  const lead = project.database.actors.find((a) => a.id === party.ids[0]);
  if (!lead || exp <= 0 || party.level >= ACTOR_LEVEL_MAX) return [];
  const curve = normalizeActorRecord(lead).expCurve;
  const step = (c: ActorExperienceCurve) => totalExpForLevel(c, party.level + 1) - totalExpForLevel(c, party.level);
  const need = step(curve);
  if (need <= exp) return [];
  // 첫 전투 경험치가 아주 작으면(곡선을 1/5 아래로 줄여야 하면) 곡선 전체가 무너진다 — 그때는 손대지 않는다.
  if (exp / need < MIN_CURVE_FACTOR) return [];
  let factor = exp / need;
  let next = curve;
  for (let i = 0; i < 20; i += 1) {
    next = { base: Math.floor(curve.base * factor), extra: Math.floor(curve.extra * factor), acceleration: Math.floor(curve.acceleration * factor) };
    if (step(next) <= exp) break;
    factor *= 0.95;
  }
  if (step(next) > exp || factor < MIN_CURVE_FACTOR) return [];
  const same = (c: ActorExperienceCurve) => c.base === curve.base && c.extra === curve.extra && c.acceleration === curve.acceleration;
  let changed = 0;
  for (const actor of project.database.actors) {
    if (!same(normalizeActorRecord(actor).expCurve)) continue;
    actor.expCurve = { ...next };
    changed += 1;
  }
  return [`경험치 곡선 extra ${curve.extra}→${next.extra}(배우 ${changed}) — 첫 길 전투 ${troopId} 경험치 ${exp} 로 Lv${party.level}→${party.level + 1}(필요 ${need}→${step(next)})`];
}
