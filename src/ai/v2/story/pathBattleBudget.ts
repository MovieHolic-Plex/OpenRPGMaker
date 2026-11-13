// ai/v2/story/pathBattleBudget.ts
// 끝맺음: 청사진 길 위 전투(잡몹·길목 전투·보스)를 시작 파티 기준 «한 번에 이어 싸워도 전멸하지 않는» 예산에 맞춘다. 결정적(모의 시드 고정)·되풀이 안전.
//
// 왜(2026-10-29 vm4 argon·flash jrpg 판정): argon — 촌장 자리 붉은 드래곤(보스로 맞춘 사본, 모의 HP 손실 64%) 뒤 HP 174/514 로 동굴 임프 2마리
// (한 판 손실 27%, 동굴에 세 무리)를 만나 전멸했다. 각 전투는 따로 재면 «이긴다»였지만 이어 싸우면 길 위 손실 합이 100% 를 넘었다.
// flash — 판정자가 30분 안에 동굴 거미 두 번째 판에서 시간이 다 됐다(길 전투 셋 + 보스 8.5턴). 길 위 전투 수·전투당 길이도 맞아야 한다.
//
// 규칙(시작 파티 Lv·startActorIds, 몬스터 파티 게임은 제외):
//    보스 = 싸우는 단계(kind battle)의 상대마다 · 마지막 단계 이벤트의 전투, 없으면 마지막 단계 맵의 도망 못 치는 전투. 길목 = 그 밖의 도망 못 치는 전투. 잡몹 = 나머지.
//    보스는 모두 한 밴드에 맞춘다(pathBattleTension BOSS_BAND) — 그 보스 앞에 도착하는 파티(레벨·든 회복약)로 잰다. 왜(2026-11-13 r2s-fun·r2t-fun 플레이):
//    마지막 단계가 싸움이 아닌 게임의 보스는 «길목» 으로 재어 영웅이 45 를 잃고 끝났고, 다른 게임의 마지막 보스는 한 대에 100~130 을 쳤다.
//  - 필수 잡몹(닿으면 싸우는 상징 적 이벤트) 수 상한 MAX_FIELD_EVENTS — 넘는 상징 적은 뒤에서부터 지운다.
//  - 보스 앞 전투(길목·잡몹)의 모의 HP 손실 합 ≤ PRE_BOSS_BUDGET(길목 무게 2·잡몹 1 로 나눔, 각 상한 있음), 승률 100%(모의 판 전부).
//    보스는 쉼터(ensureBossRest) 뒤 풀 HP 로 — 기술·회복약을 쓰는 플레이의 승률 ≥ 95%·12턴 안. 전투당 평균 턴 상한(잡몹 4 · 길목 6).
//  - 길 = 시작 맵 → 단계 맵, 단계 맵 사이를 잇는 통로 맵(mapRoute)까지. 전투 = 이벤트(공통 이벤트 호출 포함)·조우표·옛 조우 목록·필드 스폰.
//  - 보스 앞 전투는 앞 길 전투에서 걸려 전투 뒤에도 남는 해로운 상태(독)를 지고 잰다(vm5 terra: 독이 다음 박쥐 전투로 이어져 전멸).
//  - 맞추기는 내리기만: 손실·승률이 넘치면 공격·마력과 적 피해 기술 위력 15%씩, 턴이 넘치면 HP 15%씩. 원본 DB 적·기술은 두고
//    `troop_path_*`/`enemy_path_*`/`skill_path_*` 사본을 쓴다.
//  - 시작 소지 회복약이 보스 앞 전투 수 + 보스마다 보스전 몫(BOSS_POTIONS)보다 적으면 채운다.
//  - 하한까지 내려도 기준 밖이면 원래 값으로 두고 «맞추기 미완» 줄에 무엇이 얼마나 밖인지 적는다. 보스마다 밴드 안/밖을 잰 값과 함께 한 줄씩 남긴다.
//  - 길 위에서 가장 가벼운 전투 한 번으로 한 레벨이 오르게 시작 파티 곡선(같은 곡선 배우 전부)을 줄인다 — 길 위 전투를 다 이겨도 8레벨까지.
//  - 레벨이 오르면 능력치가 오른다(시작 파티 능력치 곡선의 바닥), 보스는 가진 회복약과 기술을 쓰는 플레이로 재고 «공격만·회복 없음» 으로는
//    못 이기게 올린다 — story/pathBattleTension.ts.
import { simulateBattle } from "@/battle/simulate";
import { DEFAULT_SKILL_ID } from "@/project/defaults/constants";
import { ACTOR_LEVEL_MAX, normalizeActorRecord, totalExpForLevel } from "@/project/actorModel";
import { normalizeEnemyRecord } from "@/project/databaseEnemyTroopRecordModel";
import { actorBattlers } from "@/battle/battleBattlers";
import { stateBehavior } from "@/battle/battleStates";
import { stateClearsOnBattleEnd } from "@/project/battleEndStates";
import { mapRoute } from "@/player/objectiveTarget";
import type { ActorExperienceCurve, EnemyRecord, GameMap, Project, SkillRecord } from "@/project/types";
import { blueprintMapFor } from "./blueprintPathNames";
import { healingItemIds } from "../judge/combatChecks";
import { startHealingItem } from "./healingAccess";
import { buildsWholeGame } from "../request/readers";
import { WEAK_FOE_ASK } from "../request/combat";
import { tagged, type Finding } from "../judge/finding";
import { BOSS_BAND, BOSS_POTIONS, bossBandLine, bossPotionShare, bossSensibleFits, growStartPartyCurves, levelAfter, measureBossSensible, raiseBossTension, type BossParty } from "./pathBattleTension";

type Obj = Record<string, unknown>;
type Role = "field" | "gate" | "boss";

const PRE_BOSS_BUDGET = 0.6;
const ROLE_LIMIT = { field: { loss: 0.2, turns: 4, minWin: 1 }, gate: { loss: 0.35, turns: 6, minWin: 1 }, boss: { loss: 0.7, turns: BOSS_BAND.turns, minWin: BOSS_BAND.minWin } } as const;
const WEIGHT = { field: 1, gate: 2 } as const;
const MAX_FIELD_EVENTS = 4;
const SAMPLES = 24;
const ROUNDS = 16;
const STAT_FLOOR = 0.5;
export const PATH_TROOP_PREFIX = "troop_path_";
const PATH_SKILL_PREFIX = "skill_path_";
const ROLE_KO = { field: "잡몹", gate: "길목", boss: "보스" } as const;

/** step = 보스가 선 청사진 단계의 번호(만나는 순서). */
type Battle = { mapId: string; eventId?: string; troopId: string; role: Role; touch: boolean; step?: number };

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
  // 싸우는 단계의 상대와 마지막 단계의 이벤트 — 이벤트 id·이름 → 단계 번호.
  const bossStep = new Map<string, number>();
  steps.forEach((step, i) => { if (step.kind === "battle" || step === last) for (const key of [step.built?.eventId, step.event]) if (key) bossStep.set(key, i); });
  for (const mapId of mapIds) {
    const map = project.maps[mapId];
    if (!map) continue;
    for (const event of map.events ?? []) for (const battle of eventBattles(project, event)) {
      const step = bossStep.get(event.id) ?? bossStep.get(String(event.name ?? ""));
      out.push({ mapId, eventId: event.id, troopId: battle.troopId, role: step !== undefined ? "boss" : battle.canEscape ? "field" : "gate", touch: touchFoe(event), ...(step !== undefined ? { step } : {}) });
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

/**
 * 사본 무리가 들고 가는 적 참조(전투 이벤트 페이지 조건·명령, 손님 합류 조건, 전투 뒤 명령)를 사본 적 id 로 바꾼다.
 * 왜(2026-10-31 script-ab sab-1031 던전 1회차 A·B 둘 다): 무리만 사본으로 바꾸고 페이지의 `enemyHpBelow` enemyId 는 원본을 가리켜,
 * 보스 반피 대사가 끝내 안 떴다(전투에 원본 적이 없으니 조건이 영원히 거짓).
 */
function remapEnemyRefs(node: unknown, copies: ReadonlyMap<string, string>): void {
  walk(node, (obj) => {
    if (typeof obj.enemyId === "string" && copies.has(obj.enemyId)) obj.enemyId = copies.get(obj.enemyId);
    if (Array.isArray(obj.enemyIds)) obj.enemyIds = obj.enemyIds.map((id) => (typeof id === "string" ? copies.get(id) ?? id : id));
  });
}

/**
 * 이 수정 전에 만든 길 사본 무리도 고친다 — 사본 적 `enemy_path_<무리>_<꼬리>` 의 원본(`enemy_<꼬리>` 또는 `<꼬리>`)을 가리키는 참조를 사본으로.
 * 되풀이 안전: 이미 바꾼 참조는 사본 id 라 다시 맞지 않는다.
 */
export function repairPathTroop(project: Project, troop: Project["database"]["troops"][number]): void {
  const prefix = `enemy_path_${troop.id.slice(PATH_TROOP_PREFIX.length)}_`;
  const made = new Map<string, string>();
  for (const copyId of new Set(troop.enemyIds ?? [])) {
    if (!copyId.startsWith(prefix)) continue;
    const tail = copyId.slice(prefix.length);
    const original = [`enemy_${tail}`, tail].find((id) => project.database.enemies.some((e) => e.id === id));
    if (original) made.set(original, copyId);
  }
  if (!made.size) return;
  remapEnemyRefs(troop.battleEventPages, made);
  remapEnemyRefs(troop.battleGuests, made);
  remapEnemyRefs(troop.afterBattle, made);
}

/** 무리를 길 사본으로(이미 사본이면 그대로). 사본 적은 무리마다 따로 — 같은 적이 다른 몫의 무리에 있어도 서로 안 건드린다. */
export function pathCopy(project: Project, troopId: string): string | undefined {
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
  remapEnemyRefs(clone.battleEventPages, copies);
  remapEnemyRefs(clone.battleGuests, copies);
  remapEnemyRefs(clone.afterBattle, copies);
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
    // 기본 공격(skill_attack)은 사본을 만들지 않는다 — 런타임은 그 id 일 때만 위력을 공격력에서 꺼낸다(사본은 고정 위력 10 이 되어 평타가 거의 0 이 됐다).
    // 평타의 세기는 적 사본의 공격력으로 맞춘다.
    if (!skill || skillId === DEFAULT_SKILL_ID || skill.effect.kind !== "damage" || !(skill.power > 0) || skillId.startsWith(PATH_SKILL_PREFIX)) return skillId;
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

/** 사본 적 `enemy_path_<무리 꼬리>_<적 꼬리>` 의 원래 적(`enemy_<꼬리>` 또는 `<꼬리>`) — 이미 한 번 깎인 사본이 아니라 원래 값으로 하한을 잡는다. */
function sourceEnemy(project: Project, copy: EnemyRecord, troopCopyId: string): EnemyRecord | undefined {
  const prefix = `enemy_path_${troopCopyId.slice(PATH_TROOP_PREFIX.length)}_`;
  if (!copy.id.startsWith(prefix)) return undefined;
  const tail = copy.id.slice(prefix.length);
  return project.database.enemies.find((e) => e.id === `enemy_${tail}` || e.id === tail);
}

function sourceSkill(project: Project, copy: SkillRecord, skillPrefix: string): SkillRecord | undefined {
  const tail = copy.id.slice(skillPrefix.length);
  return project.database.skills.find((k) => k.id === `skill_${tail}` || k.id === tail);
}

/** 보스(troopId 마다 하나)를 만나는 순서로. */
const bossesOf = (battles: readonly Battle[]): Battle[] => [...new Map(battles.filter((b) => b.role === "boss").map((b) => [b.troopId, b])).values()].sort((a, b) => (a.step ?? Infinity) - (b.step ?? Infinity));

/**
 * 보스마다 그 앞에 도착하는 파티: 가장 낮게는 피할 수 없는 전투(그 맵까지의 길목 · 앞 보스)만 이기고,
 * 가장 높게는 그 맵까지의 길 위 전투를 다 이기고. 맵의 이벤트 순서는 만나는 순서가 아니라 맵 순서와 단계 순서로 센다.
 */
function bossArrivals(project: Project, battles: readonly Battle[], bosses: readonly Battle[], party: { ids: string[]; level: number }, potion: string | undefined): Map<string, BossParty> {
  const mapAt = new Map(pathMapIds(project).map((id, i) => [id, i]));
  const arrival = (boss: Battle): BossParty => {
    const before = (roles: readonly Role[]) => [...new Map(battles
      .filter((b) => (b.role === "boss" ? b.troopId !== boss.troopId && (b.step ?? Infinity) < (boss.step ?? Infinity) : roles.includes(b.role) && (mapAt.get(b.mapId) ?? 0) <= (mapAt.get(boss.mapId) ?? 0)))
      .map((b) => [`${b.mapId}#${b.eventId ?? b.troopId}`, troopExp(project, b.troopId)])).values()].reduce((sum, exp) => sum + exp, 0);
    return {
      ids: party.ids, minLevel: levelAfter(project, party.ids[0], party.level, before(["gate"])), maxLevel: levelAfter(project, party.ids[0], party.level, before(["gate", "field"])),
      ...(potion ? { potion } : {}),
    };
  };
  return new Map(bosses.map((boss) => [boss.troopId, arrival(boss)]));
}

/** 지은 게임의 보스마다 밴드 안/밖 한 줄(프로젝트를 바꾸지 않는다) — 재는 도구(scripts/qa/assistant-v2/battleFitProbe)가 전/후를 견줄 때 쓴다. */
export function bossBandReport(project: Project): string[] {
  const party = partyOf(project);
  if (!party) return [];
  const battles = pathBattles(project), bosses = bossesOf(battles);
  const parties = bossArrivals(project, battles, bosses, party, startHealingItem(project));
  return bosses.flatMap((boss) => bossBandLine(project, boss.troopId, parties.get(boss.troopId)!) ?? []);
}

export function fitPathBattlesIn(project: Project): string[] {
  if (!project.gameBlueprint || project.system.battleParty === "monsters" || project.system.monsterBattleParty === true) return [];
  for (const troop of project.database.troops) if (troop.id.startsWith(PATH_TROOP_PREFIX)) repairPathTroop(project, troop);
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

  // 2) 시작 회복약 — 보스 앞 전투 수 + 보스마다 보스전 몫만큼은 들고 시작한다(보스는 약을 쓰는 플레이로 잰다. 맞춘 보스가 더 쓰면 6) 뒤에 그만큼 더한다).
  const bosses = bossesOf(battles);
  const bossShare = BOSS_POTIONS * bosses.length;
  const need = battles.filter((b) => b.role !== "boss" && (b.eventId || b.touch)).length + bossShare;
  const heals = healingItemIds(project);
  const inventory = { ...(project.session.inventory ?? {}) };
  const have = Object.entries(inventory).reduce((sum, [id, n]) => sum + (heals.has(id) ? Math.max(0, n) : 0), 0);
  const potion = startHealingItem(project);
  if (need > have && potion) {
    inventory[potion] = (inventory[potion] ?? 0) + (need - have);
    project.session = { ...project.session, inventory };
    notes.push(`시작 회복약 ${potion} +${need - have}(보스 앞 전투 ${need - bossShare}${bosses.length ? ` + 보스전 ${BOSS_POTIONS}${bosses.length > 1 ? `×${bosses.length}` : ""}` : ""})`);
  }

  // 3) 길 위에서 가장 가벼운 전투 한 번으로 한 레벨 — 모자라면 시작 파티와 같은 곡선을 쓰는 배우들의 경험치 곡선을 같은 비율로 줄인다.
  // 맵의 이벤트 순서는 만나는 순서가 아니다(다시 놓은 적은 목록 끝에 선다) — 어느 전투를 먼저 해도 오르게 가장 작은 경험치에 맞춘다.
  // 그리고 오른 레벨이 능력치로 보이게 시작 파티 능력치 곡선에 바닥을 준다. 사본 무리는 보상을 그대로 들고 가므로 맞추기 전에 해도 같다.
  {
    const troopIds = battles.filter((b) => b.role !== "boss").map((b) => b.troopId);
    const first = troopIds.filter((id) => troopExp(project, id) > 0).sort((x, y) => troopExp(project, x) - troopExp(project, y))[0];
    const pathExp = battles.reduce((sum, b) => sum + troopExp(project, b.troopId), 0);
    if (first) notes.push(...fitFirstLevelUp(project, first, party, pathExp));
    notes.push(...growStartPartyCurves(project, party.ids));
  }
  const bossParties = bossArrivals(project, battles, bosses, party, potion);

  // 4) 몫: 보스 앞 손실 예산을 길목 2·잡몹 1 무게로 나눈다(상징 적·길목은 이벤트마다, 조우표는 한 번으로 친다).
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

  // 5) 맞추기 — 내리기만. 보스는 가진 회복약과 기술을 쓰는 플레이(가장 낮게·가장 높게 도착하는 두 판)로 잰다.
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
  const measureAs = (bossParty?: BossParty) => (troopId: string, startStateIds: readonly string[] = []) => {
    if (bossParty) { const m = measureBossSensible(project, troopId, bossParty); return { win: m.win, loss: m.loss, turns: m.turns }; }
    const r = simulateBattle({ project, troopId, heroLevel: party.level, partyActorIds: party.ids, n: SAMPLES, seed: 11, useSkills: true, startStateIds });
    return { win: r.winRate, loss: Math.max(0, 1 - r.avgHpRemaining / party.hp), turns: r.avgTurns };
  };
  const rename = new Map<string, string>();
  for (const [troopId, { role, cap }] of plan) {
    const limit = ROLE_LIMIT[role];
    const start = role === "boss" ? [] : carried.get(troopId) ?? [];
    const measure = measureAs(role === "boss" ? bossParties.get(troopId) : undefined);
    let before: ReturnType<typeof measure>;
    try { before = measure(troopId, start); } catch { continue; }
    // 보스는 약을 쓰며 싸우므로 끝난 뒤 남은 HP 가 아니라 이기는가·얼마나 긴가로 본다.
    const fits = (m: ReturnType<typeof measure>) => role === "boss" ? bossSensibleFits(m) : m.win >= limit.minWin && m.loss <= cap + 1e-9 && m.turns <= limit.turns;
    if (fits(before)) continue;
    const rowIdsBefore = { troops: new Set(project.database.troops.map((t) => t.id)), enemies: new Set(project.database.enemies.map((e) => e.id)), skills: new Set(project.database.skills.map((k) => k.id)) };
    const copyId = pathCopy(project, troopId);
    if (!copyId) continue;
    const enemyIds = new Set(project.database.troops.find((t) => t.id === copyId)?.enemyIds ?? []);
    const skillPrefix = pathSkillCopies(project, copyId);
    const originals = new Map<string, { stats: EnemyRecord["stats"]; power?: number }>();
    for (const enemy of project.database.enemies) if (enemyIds.has(enemy.id)) originals.set(enemy.id, { stats: { ...(sourceEnemy(project, enemy, copyId)?.stats ?? enemy.stats) } });
    const skillOriginals = new Map<string, number>();
    for (const skill of project.database.skills) if (skill.id.startsWith(skillPrefix)) skillOriginals.set(skill.id, sourceSkill(project, skill, skillPrefix)?.power ?? skill.power);
    let now = measure(copyId, start);
    for (let round = 0; round < ROUNDS && !fits(now); round += 1) {
      const strong = now.win < limit.minWin || (role !== "boss" && now.loss > cap);
      const long = !strong && role === "boss" ? !bossSensibleFits(now) : now.turns > limit.turns;
      let moved = false;
      for (const enemy of project.database.enemies) {
        if (!enemyIds.has(enemy.id)) continue;
        const s = enemy.stats;
        const o = originals.get(enemy.id)!.stats;
        const floorOf = (value: number) => Math.max(1, Math.floor(value * STAT_FLOOR));
        const next = {
          ...s,
          ...(strong ? { attack: Math.max(floorOf(o.attack), Math.floor(s.attack * 0.85)), mind: Math.max(floorOf(o.mind), Math.floor(s.mind * 0.85)) } : {}),
          ...(long || (strong && s.attack <= 1) ? { maxHp: Math.max(floorOf(o.maxHp), Math.floor(s.maxHp * 0.85)) } : {}),
        };
        if (next.attack !== s.attack || next.mind !== s.mind || next.maxHp !== s.maxHp) { enemy.stats = next; moved = true; }
      }
      if (strong) for (const skill of project.database.skills) {
        if (!skill.id.startsWith(skillPrefix) || !(skill.power > 1)) continue;
        skill.power = Math.max(Math.max(1, Math.floor((skillOriginals.get(skill.id) ?? skill.power) * STAT_FLOOR)), Math.floor(skill.power * 0.85));
        moved = true;
      }
      if (!moved) break;
      now = measure(copyId, start);
    }
    if (!fits(now)) {
      for (const enemy of project.database.enemies) { const o = originals.get(enemy.id); if (o) enemy.stats = { ...o.stats }; }
      for (const skill of project.database.skills) { const power = skillOriginals.get(skill.id); if (power !== undefined) skill.power = power; }
      project.database.troops = project.database.troops.filter((t) => rowIdsBefore.troops.has(t.id));
      project.database.enemies = project.database.enemies.filter((e) => rowIdsBefore.enemies.has(e.id));
      project.database.skills = project.database.skills.filter((k) => rowIdsBefore.skills.has(k.id));
      const pct = (x: number) => `${Math.round(x * 100)}%`;
      const want = role === "boss" ? `승률 ≥ ${pct(BOSS_BAND.minWin)} · ${BOSS_BAND.turns}턴 안` : `승률 ${pct(limit.minWin)} · 손실 ≤ ${pct(cap)} · ${limit.turns}턴 안`;
      // 앞 전투에서 남은 상태(독)를 지고 잰 값이면 그 손실은 이 적의 능력치로 줄지 않는다 — 그 사실을 같이 적는다.
      notes.push(`${troopId}(${ROLE_KO[role]}${start.length ? `, 남은 상태 ${start.join("·")} 지고` : ""}) 맞추기 미완 — 적 능력치를 원래 값의 ${pct(STAT_FLOOR)}까지 내려도 기준(${want}) 밖이다: 승률 ${pct(now.win)}·손실 ${pct(now.loss)}·${now.turns.toFixed(1)}턴. 원래 값으로 둔다(승률 ${pct(before.win)}·손실 ${pct(before.loss)}·${before.turns.toFixed(1)}턴)`);
      continue;
    }
    if (copyId !== troopId) rename.set(troopId, copyId);
    const pct = (x: number) => `${Math.round(x * 100)}%`;
    notes.push(`${troopId}(${ROLE_KO[role]}${start.length ? `, 남은 상태 ${start.join("·")} 지고` : ""}) 승률 ${pct(before.win)}·손실 ${pct(before.loss)}·${before.turns.toFixed(1)}턴 → 승률 ${pct(now.win)}·손실 ${pct(now.loss)}·${now.turns.toFixed(1)}턴(몫 ${pct(cap)})`);
  }
  // 6) 보스는 «공격만·회복 없음» 으로는 못 이기게 — 길 사본(적·피해 기술 사본)을 올린다. 원본 DB 적은 그대로.
  for (const [troopId, { role }] of plan) {
    if (role !== "boss") continue;
    const current = rename.get(troopId) ?? troopId;
    const rows = { troops: new Set(project.database.troops.map((t) => t.id)), enemies: new Set(project.database.enemies.map((e) => e.id)), skills: new Set(project.database.skills.map((k) => k.id)) };
    const copyId = pathCopy(project, current);
    if (!copyId) continue;
    pathSkillCopies(project, copyId);
    const note = raiseBossTension(project, copyId, bossParties.get(troopId)!);
    if (note) { notes.push(note); if (copyId !== troopId) rename.set(troopId, copyId); continue; }
    // 올리지 않았으면 방금 만든 사본을 걷는다(이미 사본이던 무리는 그대로).
    project.database.troops = project.database.troops.filter((t) => rows.troops.has(t.id));
    project.database.enemies = project.database.enemies.filter((e) => rows.enemies.has(e.id));
    project.database.skills = project.database.skills.filter((k) => rows.skills.has(k.id));
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
  // 보스전 몫 — 맞춘 보스마다 가장 낮게 도착한 판이 쓰는 약(기술을 쓰든 안 쓰든 많은 쪽)을 시작 소지품이 댄다.
  // 왜(2026-11-13 r2s-fun 자동 플레이): 보스마다 둘씩만 쳤는데 첫 보스가 넷다섯 개를 써서 마지막 보스 앞에 약이 모자랐다.
  if (potion && bosses.length) {
    const shares = bosses.map((boss) => bossPotionShare(project, rename.get(boss.troopId) ?? boss.troopId, bossParties.get(boss.troopId)!));
    const now = Object.entries(project.session.inventory ?? {}).reduce((sum, [id, n]) => sum + (heals.has(id) ? Math.max(0, n) : 0), 0);
    const short = need - bossShare + shares.reduce((sum, n) => sum + n, 0) - now;
    if (short > 0) {
      project.session = { ...project.session, inventory: { ...(project.session.inventory ?? {}), [potion]: (project.session.inventory?.[potion] ?? 0) + short } };
      notes.push(`시작 회복약 ${potion} +${short}(보스전에서 쓰는 약 ${shares.join("+")}개 — 모의로 잰 만큼)`);
    }
  }
  // 7) 보스마다 밴드 안/밖 — 그 보스 앞에 도착하는 파티로 잰 값 그대로. 밖이면 무엇이 밖인지 적는다(조용히 넘어가지 않는다).
  for (const boss of bosses) { const line = bossBandLine(project, rename.get(boss.troopId) ?? boss.troopId, bossParties.get(boss.troopId)!); if (line) notes.push(line); }

  return notes;
}

/** 무리 하나를 이기면 받는 경험치 합. */
function troopExp(project: Project, troopId: string): number {
  return (project.database.troops.find((t) => t.id === troopId)?.enemyIds ?? []).reduce((sum, id) => {
    const enemy = project.database.enemies.find((e) => e.id === id);
    return sum + (enemy ? Math.max(0, normalizeEnemyRecord(enemy).rewards.exp) : 0);
  }, 0);
}

/** 길 위 전투를 다 이겼을 때 오르는 레벨 수의 상한 — 곡선을 줄여도 이보다 빨리 오르게는 하지 않는다. */
const MAX_PATH_LEVELS = 8;

/**
 * 첫 길 전투의 경험치로 시작 레벨에서 다음 레벨이 되도록 경험치 곡선(base·extra·acceleration)을 같은 비율로 줄인다.
 * 기본 곡선(extra 677)은 Lv2 까지 678 이라 짧은 게임에서는 끝까지 Lv1 이다(경험치 677 을 받고 Lv1 로 엔딩).
 * 줄이는 바닥은 고정 비율이 아니라 «길 위 전투(pathExp)를 다 이겨도 MAX_PATH_LEVELS 레벨까지» 다 — 첫 전투 경험치가 작아도(108/678) 맞춘다.
 * 시작 파티 배우 중 맨 앞 배우와 같은 곡선을 쓰는 배우만 고친다(파티 밖 배우는 손대지 않는다). 되풀이 안전(이미 맞으면 그대로).
 */
export function fitFirstLevelUp(project: Project, troopId: string, party: { ids: readonly string[]; level: number }, pathExp = 0): string[] {
  const exp = troopExp(project, troopId);
  const lead = project.database.actors.find((a) => a.id === party.ids[0]);
  if (!lead || exp <= 0 || party.level >= ACTOR_LEVEL_MAX) return [];
  const curve = normalizeActorRecord(lead).expCurve;
  const step = (c: ActorExperienceCurve) => totalExpForLevel(c, party.level + 1) - totalExpForLevel(c, party.level);
  const need = step(curve);
  if (need <= exp) return [];
  const span = totalExpForLevel(curve, Math.min(ACTOR_LEVEL_MAX, party.level + MAX_PATH_LEVELS)) - totalExpForLevel(curve, party.level);
  // 길 위 경험치를 모르는 호출은 그 전투 하나를 길로 본다 — 한 번 이기면 한 레벨.
  const floor = span > 0 ? Math.min(1, Math.max(pathExp, exp) / span) : 1;
  let factor = Math.max(floor, exp / need);
  let next = curve;
  for (let i = 0; i < 20; i += 1) {
    next = { base: Math.floor(curve.base * factor), extra: Math.floor(curve.extra * factor), acceleration: Math.floor(curve.acceleration * factor) };
    if (step(next) <= exp || factor <= floor) break;
    factor = Math.max(floor, factor * 0.95);
  }
  const same = (c: ActorExperienceCurve) => c.base === curve.base && c.extra === curve.extra && c.acceleration === curve.acceleration;
  if (same(next)) return [];
  let changed = 0;
  for (const actor of project.database.actors) {
    if (!party.ids.includes(actor.id) || !same(normalizeActorRecord(actor).expCurve)) continue;
    actor.expCurve = { ...next };
    changed += 1;
  }
  const reach = pathExp > 0 ? (() => { let lv = party.level; while (lv < ACTOR_LEVEL_MAX && totalExpForLevel(next, lv + 1) - totalExpForLevel(next, party.level) <= pathExp) lv += 1; return ` · 길 위 전투 경험치 ${pathExp} 로 Lv${lv}`; })() : "";
  return [`경험치 곡선 extra ${curve.extra}→${next.extra}(배우 ${changed}) — 첫 길 전투 ${troopId} 경험치 ${exp} 로 Lv${party.level}→${party.level + 1}(필요 ${need}→${step(next)})${reach}`];
}
/** 필드 상징 적 한 판 HP 손실 상한 — 「약한」 요청 35%(Lv1 슬라임 한 마리 ≈30%), 그 밖 50%. 길 위 예산(잡몹 20%)은 이어 싸움을 전제한 끝맺음 맞추기 값이라 경고 문턱으로는 너무 엄하다. */
const WEAK_LOSS = 0.35;
const FIELD_LOSS = 0.5;

/**
 * 이번 실행에서 새로 둔 필드 전투(닿으면 싸우는 상징 적)를 시작 파티로 재 본다 — 할 일 관문 «[게임 검사 전투 세기]».
 * 왜(2026-10-30 omo-fr-o opus 숲길): 「약한 몬스터가 있게」 요청에 시작 저장본의 «숲 말벌 무리»(슬라임 둘+동굴 박쥐 Lv6, 맨몸 승률 93%)를
 * 다른 적 셋과 한 숲에 두었고, 판정자는 앞 전투로 HP 272 가 된 채 그 무리에 져서 패배했다. 숲은 청사진 길 밖이라 fitPathBattlesIn 이 재지 않았다.
 * 재는 것: 무리마다 맨몸 모의(같은 시드·판 수) — 승률 100% 미만, 한 판 HP 손실 > 35%(「약한」 요청)·50%, 한 맵의 상징 적을 이어 싸운 손실 합 > 보스 앞 예산(60%).
 * 숲 말벌 무리는 모의 승률은 24/24 였지만 손실 73% — 이어 싸운 판정자가 졌다.
 * 고치기 안내는 같은 모의로 통과하는 기존 무리(적 HP 합이 작은 순 6개까지)를 이른다. 프로젝트는 바꾸지 않는다(사본·맞춤은 끝맺음 path-battles 몫).
 */
export function fieldBattleStrain(before: Project, after: Project, task: string): Finding[] {
  if (after.system.battleParty === "monsters" || after.system.monsterBattleParty === true) return [];
  const party = partyOf(after);
  if (!party) return [];
  // 게임 하나를 짓는 턴(이어 하기 턴도 — 끝맺음 assembly 묶음과 같은 판정)이면 끝맺음 path-battles 가 청사진 길 위 전투를 이미 맞췄다 — 그때만 길 위는 뺀다(장면 요청은 그 단계가 돌지 않는다).
  const onPath = new Set(buildsWholeGame(after, task) ? pathBattles(after).map((b) => `${b.mapId}#${b.troopId}`) : []);
  const weak = WEAK_FOE_ASK.test(task);
  const cache = new Map<string, { win: number; loss: number }>();
  const measure = (troopId: string) => {
    if (!cache.has(troopId)) {
      try {
        const r = simulateBattle({ project: after, troopId, heroLevel: party.level, partyActorIds: party.ids, n: SAMPLES, seed: 11, useSkills: true });
        cache.set(troopId, { win: r.winRate, loss: Math.max(0, 1 - r.avgHpRemaining / party.hp) });
      } catch { cache.set(troopId, { win: 1, loss: 0 }); }
    }
    return cache.get(troopId)!;
  };
  const troopName = (id: string) => after.database.troops.find((t) => t.id === id)?.name ?? id;
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const perMap: { name: string; ids: string[]; lines: string[] }[] = [];
  const bad = new Set<string>();
  for (const map of Object.values(after.maps)) {
    const prev = before.maps[map.id];
    // 새 이벤트이거나 싸우는 무리가 바뀐 이벤트만(페이지 JSON 비교는 정규화 차이로 시작 저장본 이벤트까지 잡았다).
    const sig = (event: GameMap["events"][number], p: Project) => eventBattles(p, event).map((b) => `${b.troopId}:${b.canEscape}`).join(",");
    const prevEvents = new Map((prev?.events ?? []).map((e) => [e.id, sig(e, before)]));
    const fresh: string[] = [];
    const ids: string[] = [];
    for (const event of map.events ?? []) {
      if (!touchFoe(event) || prevEvents.get(event.id) === sig(event, after)) continue;
      for (const b of eventBattles(after, event)) if (b.canEscape && !onPath.has(`${map.id}#${b.troopId}`)) { fresh.push(b.troopId); if (!ids.includes(event.id)) ids.push(event.id); }
    }
    // 무작위 조우는 combatChecks «[게임 검사 전투 난이도]»가 첫 구역에서 잰다 — 여기서는 보이는 적만.
    if (!fresh.length) continue;
    const name = map.name ?? map.id;
    const problems: string[] = [];
    for (const troopId of new Set(fresh)) {
      const m = measure(troopId);
      if (m.win < 1) { problems.push(`${name}: 「${troopName(troopId)}」(${troopId}) 를 시작 파티(Lv${party.level}) 맨몸으로 모의 ${SAMPLES}판 해 보니 승률 ${pct(m.win)}·HP 손실 ${pct(m.loss)} — 질 수 있는 필드 전투다`); bad.add(troopId); }
      else if (m.loss > (weak ? WEAK_LOSS : FIELD_LOSS)) { problems.push(`${name}: ${weak ? "요청은 «약한 몬스터»인데 " : ""}「${troopName(troopId)}」(${troopId}) 맨몸 한 판에 HP ${pct(m.loss)}가 깎인다(상한 ${pct(weak ? WEAK_LOSS : FIELD_LOSS)})`); bad.add(troopId); }
    }
    const chain = fresh.reduce((sum, id) => sum + measure(id).loss, 0);
    if (fresh.length > 1 && chain > PRE_BOSS_BUDGET) problems.push(`${name}: 이 맵의 필드 적 ${fresh.length}무리를 이어 싸우면 HP 손실 합 ${pct(chain)}(예산 ${pct(PRE_BOSS_BUDGET)}) — 회복 없이 가면 전멸한다`);
    if (problems.length) perMap.push({ name, ids, lines: problems });
  }
  if (!perMap.length) return [];
  const hp = (id: string) => (after.database.troops.find((t) => t.id === id)?.enemyIds ?? []).reduce((s, e) => s + (after.database.enemies.find((x) => x.id === e)?.stats.maxHp ?? 0), 0);
  const easy = after.database.troops.filter((t) => !bad.has(t.id) && !t.id.startsWith(PATH_TROOP_PREFIX)).sort((a, b) => hp(a.id) - hp(b.id)).slice(0, 6)
    .filter((t) => { const m = measure(t.id); return m.win >= 1 && m.loss >= 0.03 && m.loss <= WEAK_LOSS; }).map((t) => `${t.id}(${t.name ?? ""}, 손실 ${pct(measure(t.id).loss)})`);
  const fix = ` 필드 적의 troopId 를 시작 파티가 이기는 무리로 바꾸거나(${easy.length ? `예: ${easy.join(", ")}` : "upsert_troop 으로 적 한두 마리 무리를 만들고 simulate_battle 로 승률 100%·손실 35% 이하 확인"}) 수를 줄인다 — 이야기상 강한 적이면 회복 지점을 앞에 두고 보고에 적는다.`;
  // 맵마다 한 문제(이벤트 id 를 실어 기존 결함 가르기·관문 항목 열쇠가 맵 단위로 선다).
  return perMap.map((m) => tagged("game", "전투 세기", `${m.lines.join(" / ")} (이벤트 ${m.ids.join(", ")}).${fix}`));
}
