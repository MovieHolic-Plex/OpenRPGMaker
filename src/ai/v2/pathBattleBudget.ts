// ai/v2/pathBattleBudget.ts
// 끝맺음: 청사진 길 위 전투(잡몹·길목 전투·보스)를 시작 파티 기준 «한 번에 이어 싸워도 전멸하지 않는» 예산에 맞춘다. 결정적(모의 시드 고정)·되풀이 안전.
//
// 왜(2026-10-29 vm4 argon·flash jrpg 판정): argon — 촌장 자리 붉은 드래곤(보스로 맞춘 사본, 모의 HP 손실 64%) 뒤 HP 174/514 로 동굴 임프 2마리
// (한 판 손실 27%, 동굴에 세 무리)를 만나 전멸했다. 각 전투는 따로 재면 «이긴다»였지만 이어 싸우면 길 위 손실 합이 100% 를 넘었다.
// flash — 판정자가 30분 안에 동굴 거미 두 번째 판에서 시간이 다 됐다(길 전투 셋 + 보스 8.5턴). 길 위 전투 수·전투당 길이도 맞아야 한다.
//
// 규칙(시작 파티 Lv·startActorIds, 몬스터 파티 게임은 제외):
//  - 길 = 청사진 단계 맵(단계 순서). 전투 = 그 맵 이벤트의 battleProcessing 과 조우표 무리.
//    보스 = 마지막 단계 이벤트의 전투, 없으면 마지막 단계 맵의 도망 못 치는 전투. 길목 = 그 밖의 도망 못 치는 전투. 잡몹 = 나머지.
//  - 필수 잡몹(닿으면 싸우는 상징 적 이벤트) 수 상한 MAX_FIELD_EVENTS — 넘는 상징 적은 뒤에서부터 지운다.
//  - 보스 앞 전투(길목·잡몹)의 모의 HP 손실 합 ≤ PRE_BOSS_BUDGET(길목 무게 2·잡몹 1 로 나눔, 각 상한 있음), 승률 100%(모의 판 전부).
//    보스는 쉼터(ensureBossRest) 뒤 풀 HP 로 — 승률 ≥ 95%·손실 ≤ 70%. 전투당 평균 턴 상한(잡몹 4 · 길목 6 · 보스 10).
//  - 맞추기는 내리기만: 손실·승률이 넘치면 공격·마력 15%씩, 턴이 넘치면 HP 15%씩. 원본 DB 적은 두고 `troop_path_*`/`enemy_path_*` 사본을 쓴다.
//  - 시작 소지 회복약이 보스 앞 전투 수보다 적으면 채운다.
import { simulateBattle } from "@/battle/simulate";
import { actorBattlers } from "@/battle/battleBattlers";
import type { EnemyRecord, GameMap, Project } from "@/project/types";
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
export const PATH_TROOP_PREFIX = "troop_path_";

type Battle = { mapId: string; eventId?: string; troopId: string; role: Role; touch: boolean };

function walk(node: unknown, visit: (cmd: Obj) => void): void {
  if (Array.isArray(node)) { for (const item of node) walk(item, visit); return; }
  if (!node || typeof node !== "object") return;
  visit(node as Obj);
  for (const value of Object.values(node as Obj)) if (value && typeof value === "object") walk(value, visit);
}

function eventBattles(event: GameMap["events"][number]): { troopId: string; canEscape: boolean }[] {
  const out: { troopId: string; canEscape: boolean }[] = [];
  walk(event.pages, (cmd) => { if (cmd.kind === "battleProcessing" && typeof cmd.troopId === "string" && !out.some((b) => b.troopId === cmd.troopId)) out.push({ troopId: cmd.troopId, canEscape: cmd.canEscape !== false }); });
  return out;
}

const touchFoe = (event: GameMap["events"][number]) => (event.pages ?? []).some((page) => ["eventTouch", "playerTouch"].includes(String((page.trigger as { kind?: string } | undefined)?.kind)));

/** 청사진 길 위 전투 목록(단계 맵 순서·맵 안 이벤트 순서). */
export function pathBattles(project: Project): Battle[] {
  const steps = project.gameBlueprint?.steps ?? [];
  const mapIds = [...new Set(steps.map((step) => blueprintMapFor(project, step.place)?.id).filter((id): id is string => !!id))];
  if (!mapIds.length) return [];
  const last = steps[steps.length - 1];
  const lastMap = last ? blueprintMapFor(project, last.place)?.id : undefined;
  const out: Battle[] = [];
  for (const mapId of mapIds) {
    const map = project.maps[mapId];
    if (!map) continue;
    for (const event of map.events ?? []) for (const battle of eventBattles(event)) {
      const isLastStepEvent = !!last && (event.id === last.event || event.name === last.event);
      out.push({ mapId, eventId: event.id, troopId: battle.troopId, role: isLastStepEvent ? "boss" : battle.canEscape ? "field" : "gate", touch: touchFoe(event) });
    }
    for (const entry of map.encounterTable ?? []) if (!out.some((b) => b.troopId === entry.troopId && b.mapId === mapId)) out.push({ mapId, troopId: entry.troopId, role: "field", touch: false });
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
  const measure = (troopId: string) => {
    const r = simulateBattle({ project, troopId, heroLevel: party.level, partyActorIds: party.ids, n: SAMPLES, seed: 11, useSkills: true });
    return { win: r.winRate, loss: Math.max(0, 1 - r.avgHpRemaining / party.hp), turns: r.avgTurns };
  };
  const rename = new Map<string, string>();
  for (const [troopId, { role, cap }] of plan) {
    const limit = ROLE_LIMIT[role];
    let before: ReturnType<typeof measure>;
    try { before = measure(troopId); } catch { continue; }
    const fits = (m: ReturnType<typeof measure>) => m.win >= limit.minWin && m.loss <= cap + 1e-9 && m.turns <= limit.turns;
    if (fits(before)) continue;
    const copyId = pathCopy(project, troopId);
    if (!copyId) continue;
    const enemyIds = new Set(project.database.troops.find((t) => t.id === copyId)?.enemyIds ?? []);
    let now = measure(copyId);
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
      if (!moved) break;
      now = measure(copyId);
    }
    if (copyId !== troopId) rename.set(troopId, copyId);
    const pct = (x: number) => `${Math.round(x * 100)}%`;
    notes.push(`${troopId}(${role === "boss" ? "보스" : role === "gate" ? "길목" : "잡몹"}) 승률 ${pct(before.win)}·손실 ${pct(before.loss)}·${before.turns.toFixed(1)}턴 → 승률 ${pct(now.win)}·손실 ${pct(now.loss)}·${now.turns.toFixed(1)}턴(몫 ${pct(cap)})`);
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
  return notes;
}
