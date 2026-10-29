// 조수 v2 전투 끝맺음 검사 — «끝까지 깰 수 있는 전투 게임인가».
//
// 왜(2026-10-25 판정 J55·J4): 견습 기사·던전·마법 시험·몬스터 숲 네 게임에 여관·포션·회복 기술이 하나도 없었다.
// 무작위 조우로 깎인 HP 가 돌아올 길이 없어 보스에서 무한 게임 오버가 났고, 승리 직후 자동 저장(HP 1)을 «이어하기»로 불러도 그대로였다.
// 약초 숲(jrpg-herb)은 첫 숲의 말벌·박쥐 떼가 시작 레벨 파티를 거의 다 쓰러뜨렸다(모의 승률 0.58·남은 HP 12%).
// 조수가 «다 됐다»고 하기 전에 이 검사가 끝맺음 관문에 올린다. 순수 함수(전투 모의는 결정적 시드).
import { simulateBattle } from "@/battle/simulate";
import { normalizeActorRecord, parameterValueAtLevel } from "@/project/actorModel";
import { classLearnedSkillIdsUpToLevel } from "@/project/sessionClass";
import type { Project } from "@/project/types";
import { wantsWholeGame } from "./shipChecks";

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj | undefined => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : undefined);

/** 요청이 무작위 조우를 말하는가 — 말하지 않으면 조수가 켜지 않는다(보이는 적·이벤트 전투로 충분하다). */
export const ENCOUNTER_ASK = /랜덤|무작위|인카운터|조우|마주치|튀어나|풀숲에서|사냥|레벨(을|이)?\s*(조금\s*)?(올|업)|경험치|몇 번 싸우|싸우면서|encounter|random battle|grind/iu;

/** 첫 전투 구역 기준: 시작 파티·시작 레벨로 이 승률·남은 HP 비율 밑이면 «초반이 너무 세다». */
export const FIRST_AREA_MIN_WIN = 0.8;
export const FIRST_AREA_MIN_HP_SHARE = 0.3;

function walk(list: unknown, visit: (cmd: Obj) => void): void {
  if (!Array.isArray(list)) return;
  for (const raw of list) {
    const cmd = obj(raw);
    if (!cmd) continue;
    visit(cmd);
    for (const [key, child] of Object.entries(cmd)) {
      if (key === "condition") continue;
      if (Array.isArray(child)) {
        if (child.some((c) => obj(c)?.kind)) walk(child, visit);
        else for (const c of child) { const o = obj(c); if (o) { walk(o.branch, visit); walk(o.commands, visit); } }
      }
    }
  }
}

/** 프로젝트의 모든 명령(맵 이벤트·공통 이벤트·적 무리 전투 페이지) — mapId 와 함께. */
export function allCommands(project: Project): { cmd: Obj; mapId: string; eventName: string }[] {
  const out: { cmd: Obj; mapId: string; eventName: string }[] = [];
  for (const map of Object.values(project.maps)) for (const ev of map.events ?? []) {
    const e = ev as unknown as Obj;
    for (const page of (e.pages as Obj[] | undefined) ?? []) walk(page.commands, (cmd) => out.push({ cmd, mapId: map.id, eventName: String(e.name ?? e.id) }));
  }
  for (const ce of (project.commonEvents ?? []) as unknown as Obj[]) walk(ce.commands, (cmd) => out.push({ cmd, mapId: "common", eventName: String(ce.name ?? ce.id) }));
  return out;
}

/** 무작위 조우가 실제로 나는 맵(발생률 > 0 이고 뽑을 적 무리가 있다). */
export function encounterMaps(project: Project): string[] {
  return Object.values(project.maps)
    .filter((m) => (m.encounterRate ?? 0) > 0 && ((m.encounterTable?.length ?? 0) > 0 || (m.troopIds?.length ?? 0) > 0))
    .map((m) => m.id);
}

/** 전투가 나는 곳(이벤트 전투·무작위 조우·필드 적 스폰). 비면 전투 없는 게임이다. */
export function battleSites(project: Project): string[] {
  const out = new Set<string>();
  for (const r of allCommands(project)) if (r.cmd.kind === "battleProcessing") out.add(`${r.mapId}/${r.eventName}`);
  for (const id of encounterMaps(project)) out.add(`${id}/무작위 조우`);
  for (const m of Object.values(project.maps)) if ((m.fieldSpawns?.length ?? 0) > 0) out.add(`${m.id}/필드 적`);
  return [...out];
}

function healingSkillIds(project: Project): Set<string> {
  return new Set(project.database.skills.filter((s) => s.effect?.kind === "healing" && s.effect.affects === "hp").map((s) => s.id));
}

/** HP 를 되돌리는 아이템(회복량 또는 회복 기술을 쓰는 아이템). */
export function healingItemIds(project: Project): Set<string> {
  const skills = healingSkillIds(project);
  return new Set(project.database.items.filter((i) => (i.hpRecovery?.flat ?? 0) > 0 || (i.hpRecovery?.percentMax ?? 0) > 0 || (!!i.skillId && skills.has(i.skillId))).map((i) => i.id));
}

/**
 * 플레이어가 HP 를 되찾을 수 있는 길. 여관·전원 회복 명령·HP 올리기 명령, 회복 아이템을 주는 이벤트(상자·NPC)·파는 상점·시작 소지품·적 드롭,
 * 시작 파티의 회복 기술, 쓰러지면 회복해 깨어나는 게임 오버(blackout/recover). 비면 회복할 길이 없다.
 */
export function healingSources(project: Project): string[] {
  const out: string[] = [];
  const items = healingItemIds(project);
  for (const r of allCommands(project)) {
    const c = r.cmd;
    if (c.kind === "inn" || c.kind === "recoverAll") out.push(`${r.eventName}: ${String(c.kind)}`);
    else if (c.kind === "changeActorHp" && c.op === "+=" && Number(c.amount) > 0) out.push(`${r.eventName}: HP 회복`);
    else if (c.kind === "changeItem" && c.op !== "-=" && typeof c.itemId === "string" && items.has(c.itemId)) out.push(`${r.eventName}: ${c.itemId} 지급`);
    else if (c.kind === "shop") {
      const ids = [...((c.itemIds as string[] | undefined) ?? []), ...(((c.stock as Obj[] | undefined) ?? []).map((s) => String(s.itemId)))];
      const sold = ids.find((id) => items.has(id));
      if (sold) out.push(`${r.eventName}: 상점 ${sold}`);
    }
  }
  for (const [id, n] of Object.entries(project.session.inventory ?? {})) if (n > 0 && items.has(id)) out.push(`시작 소지품 ${id}`);
  for (const e of project.database.enemies) {
    const r = e.rewards;
    const drops = r?.drops ?? (r?.dropItemId ? [{ itemId: r.dropItemId, ratePercent: r.dropRatePercent }] : []);
    for (const d of drops) if (d.ratePercent > 0 && items.has(d.itemId)) out.push(`${e.name} 드롭 ${d.itemId}`);
  }
  const heals = healingSkillIds(project);
  for (const id of project.system.startActorIds ?? []) {
    const raw = project.database.actors.find((a) => a.id === id);
    if (!raw) continue;
    const actor = normalizeActorRecord(raw);
    const known = [...actor.learnedSkills.filter((l) => l.tp === undefined && l.level <= actor.initialLevel).map((l) => l.skillId), ...classLearnedSkillIdsUpToLevel(project, actor.classId, actor.initialLevel)];
    const skill = known.find((s) => heals.has(s));
    if (skill) out.push(`${actor.name} 회복 기술 ${skill}`);
  }
  const system = project.system as unknown as Obj;
  const overs = [obj(system.gameOver), ...(((system.gameOvers as Obj[] | undefined) ?? []).map((g) => obj(g.settings)))].filter((g): g is Obj => !!g);
  if (overs.some((g) => g.outcome === "recover" || (g.outcome === undefined && g.presentation === "blackout"))) out.push("게임 오버 = 회복해 깨어남");
  return out;
}

/** 이 실행이 전투를 건드렸는가(전투 데이터·조우표·전투 명령). 안 건드린 작은 고치기에는 전투 검사를 걸지 않는다. */
export function touchedCombat(before: Project, after: Project): boolean {
  const db = (p: Project) => JSON.stringify([p.database.troops, p.database.enemies, p.database.skills, p.database.actors, p.database.classes]);
  const enc = (p: Project) => JSON.stringify(Object.values(p.maps).map((m) => [m.id, m.encounterRate ?? 0, m.encounterTable ?? null, m.troopIds ?? null, m.fieldSpawns ?? null]));
  const fights = (p: Project) => JSON.stringify(allCommands(p).filter((r) => r.cmd.kind === "battleProcessing").map((r) => [r.mapId, r.cmd.troopId]));
  return db(before) !== db(after) || enc(before) !== enc(after) || fights(before) !== fights(after);
}

/** 시작 맵에서 전투 없는 맵을 지나 처음 닿는 전투 맵(첫 숲·첫 동굴). 이동 명령을 따라간다. */
export function firstBattleMaps(project: Project): string[] {
  const battle = new Set(encounterMaps(project));
  const links = new Map<string, Set<string>>();
  for (const r of allCommands(project)) if (r.cmd.kind === "transfer" && typeof r.cmd.mapId === "string" && r.mapId !== "common") {
    const s = links.get(r.mapId) ?? new Set<string>(); s.add(r.cmd.mapId); links.set(r.mapId, s);
  }
  for (const c of project.mapConnections ?? []) if (c.playerEnabled) {
    const s = links.get(c.from.mapId) ?? new Set<string>(); s.add(c.to.mapId); links.set(c.from.mapId, s);
  }
  const out: string[] = [];
  const seen = new Set<string>([project.startMapId]);
  const queue = [project.startMapId];
  while (queue.length) {
    const id = queue.shift()!;
    if (battle.has(id)) { out.push(id); continue; }
    for (const next of links.get(id) ?? []) if (!seen.has(next) && project.maps[next]) { seen.add(next); queue.push(next); }
  }
  return out;
}

/** 시작 파티·시작 레벨로 첫 전투 맵의 조우 무리를 모의한다 — 너무 센 무리(승률·남은 HP). */
export function firstAreaAttrition(project: Project): { mapId: string; troopId: string; winRate: number; hpShare: number; level: number }[] {
  if (project.system.battleParty === "monsters" || project.system.monsterBattleParty === true) return [];
  const party = (project.system.startActorIds ?? []).filter((id) => project.database.actors.some((a) => a.id === id));
  if (!party.length) return [];
  const actors = party.map((id) => normalizeActorRecord(project.database.actors.find((a) => a.id === id)!));
  const level = Math.max(1, ...actors.map((a) => a.initialLevel));
  const maxHp = actors.reduce((sum, a) => sum + parameterValueAtLevel(a.parameterCurves.maxHp, level), 0);
  const out: { mapId: string; troopId: string; winRate: number; hpShare: number; level: number }[] = [];
  const tried = new Set<string>();
  for (const mapId of firstBattleMaps(project)) {
    const map = project.maps[mapId]!;
    const entries = map.encounterTable?.length
      ? map.encounterTable.filter((e) => e.weight > 0 && !e.conditions?.switchId && !e.conditions?.variableId && (e.conditions?.minPartyLevel ?? 1) <= level).map((e) => e.troopId)
      : map.troopIds ?? [];
    for (const troopId of entries) {
      if (tried.has(troopId) || tried.size >= 6 || !project.database.troops.some((t) => t.id === troopId)) continue;
      tried.add(troopId);
      try {
        const sim = simulateBattle({ project, troopId, heroLevel: level, partyActorIds: party, n: 12, seed: 7, useSkills: true });
        const hpShare = maxHp > 0 ? sim.avgHpRemaining / maxHp : 1;
        if (sim.winRate < FIRST_AREA_MIN_WIN || hpShare < FIRST_AREA_MIN_HP_SHARE) out.push({ mapId, troopId, winRate: sim.winRate, hpShare, level });
      } catch { /* 모의 실패는 넘어간다 */ }
    }
  }
  return out;
}

/** 걸음당 발생률 → 평균 몇 걸음마다 한 번(런타임 누적 규칙: 걸음마다 rate 씩 쌓여 1000 분의 누적값 확률). */
export function stepsPerEncounter(rate: number): number {
  if (rate <= 0) return Infinity;
  let expected = 0, survive = 1;
  for (let k = 1; survive > 1e-9 && k < 1000; k += 1) { survive *= Math.max(0, 1 - Math.min(1, (k * rate) / 1000)); expected += survive; }
  return Math.round(expected + 1);
}

/**
 * 끝맺음 관문에 올릴 전투 문제(빈 배열이면 통과). 전투를 건드린 실행이나 게임을 만드는 요청일 때만 본다.
 * 회복 수단 없음은 «출하 차단»급 — 고치지 못하면 «완성»이라고 쓰지 못한다.
 */
export function combatProblems(before: Project, after: Project, task: string): string[] {
  if (!wantsWholeGame(task) && !touchedCombat(before, after)) return [];
  const sites = battleSites(after);
  if (!sites.length) return [];
  const problems: string[] = [];
  if (!healingSources(after).length) {
    problems.push(`[출하 차단 no-healing] 전투가 있는데(${sites.slice(0, 3).join(", ")}${sites.length > 3 ? ` 외 ${sites.length - 3}곳` : ""}) HP 를 되찾을 길이 하나도 없다 — 깎인 HP 가 그대로 남아 보스에서 무한 게임 오버가 나고, 승리 직후 자동 저장(HP 1)을 불러와도 그대로다. build_blueprint_path 를 다시 부르면 시작 맵에 회복의 샘(전원 회복·저장)과 시작 회복약 3개를 결정적으로 넣는다. 직접 고치려면 마을에 여관(recoverAll 이벤트 또는 inn 명령)을 두거나, set_shop_stock 으로 상점에서 포션(item_potion)을 팔거나, place_chest{contents:{itemId:'item_potion'}} 로 보스 앞에 회복약을, 보스 앞에 place_savepoint{heal:true} 를 둔다. 회복 기술을 쓰는 동료(upsert_actor learnedSkills 에 skill_heal)도 된다. 고치지 못하면 «완성»이라고 쓰지 않는다.`);
  }
  // 요청에 없는 무작위 조우: 이 실행이 새로 켠 맵만(전에 켜져 있던 맵은 앞 요청이 켰다).
  if (!ENCOUNTER_ASK.test(task)) {
    const was = new Set(encounterMaps(before));
    const turnedOn = encounterMaps(after).filter((id) => !was.has(id));
    if (turnedOn.length) problems.push(`[게임 검사 조우] 요청에 무작위 조우(랜덤 인카운터)가 없는데 ${turnedOn.slice(0, 3).map((id) => `「${after.maps[id]!.name}」`).join(", ")} 에 켰다 — 시키지 않은 조우가 파티를 깎는다. set_encounter_table{mapId, entries, encounterRate:0} 으로 끄고, 싸움이 필요하면 보이는 적(place_field_enemy)이나 이벤트 전투로 둔다. 일부러 켰다면 보고에 «무작위 조우를 켰다(약 N걸음마다)»고 적는다.`);
  }
  // 첫 전투 구역이 시작 파티에게 너무 세다(J4).
  const hard = firstAreaAttrition(after);
  if (hard.length) {
    const list = hard.slice(0, 3).map((h) => `「${after.maps[h.mapId]!.name}」 ${h.troopId} 승률 ${Math.round(h.winRate * 100)}%·남은 HP ${Math.round(h.hpShare * 100)}%`).join(", ");
    const rate = after.maps[hard[0]!.mapId]!.encounterRate ?? 0;
    problems.push(`[게임 검사 전투 난이도] 시작 파티(Lv${hard[0]!.level})로 첫 전투 구역의 조우를 모의 12판 해 보니 너무 세다: ${list} — 첫 숲에서 몇 번 만에 전멸하고 레벨을 올릴 틈이 없다. 첫 구역 적은 시작 파티가 대개 이기고(승률 ${Math.round(FIRST_AREA_MIN_WIN * 100)}% 이상) HP 가 ${Math.round(FIRST_AREA_MIN_HP_SHARE * 100)}% 넘게 남도록 upsert_enemy 로 HP·공격을 낮추거나 그 무리를 뒤쪽 맵(또는 conditions.minPartyLevel)으로 옮긴다. 조우율 ${rate}(약 ${stepsPerEncounter(rate)}걸음마다 한 번)${rate > 10 ? "도 잦다 — 6~10 으로 낮춘다" : ""}. simulate_battle{troopId, heroLevel:${hard[0]!.level}} 로 다시 확인한다.`);
  }
  // MP 기술이 공짜 기술보다 약하다(J8) — 기술·배우를 건드린 실행이나 게임 만들기 요청일 때.
  problems.push(...weakPaidSkills(after).slice(0, 3));
  return problems;
}

/** 기술 하나의 대략 위력(런타임 뺄셈식의 공격 쪽: power + 능력치/2) × 타수·분산 없음 — 같은 배우 기술끼리 비교만 한다. */
function skillMagnitude(project: Project, skillId: string, stats: { attack: number; mind: number; attackPower: number }): number | undefined {
  const skill = project.database.skills.find((s) => s.id === skillId);
  if (!skill || skill.effect?.kind !== "damage" || skill.effect.affects !== "hp" || skill.damageFormula) return undefined;
  const stat = skill.effect.statistic === "mind" ? stats.mind : stats.attack;
  // 기본 공격(skill_attack)은 위력 자리에 무기 공격력을 쓴다.
  const power = skill.id === "skill_attack" ? stats.attackPower : skill.power;
  const hits = skill.hitSequence?.length ? skill.hitSequence.reduce((a, b) => a + b, 0) : 1;
  const crit = 1 + ((skill.criticalRate ?? 10) / 100) * ((skill.criticalMultiplier ?? 1.35) - 1);
  return (power + Math.floor(stat / 2)) * hits * crit * ((skill.hitRate ?? 100) / 100);
}

/**
 * MP 를 내는 기술이 공짜 기술보다 약하다(2026-10-25 판정 J8): 레온의 십자베기(MP 3, 위력 62)가 공짜 검격(위력 67)보다 덜 아팠다.
 * 시작 파티가 아는 기술마다, 같은 대상 범위·같은 능력치의 공짜 피해 기술보다 기대 피해가 높지 않으면 짚는다(상태 효과가 붙은 기술은 뺀다 — 쓰임이 다르다).
 */
export function weakPaidSkills(project: Project): string[] {
  const out: string[] = [];
  for (const id of project.system.startActorIds ?? []) {
    const raw = project.database.actors.find((a) => a.id === id);
    if (!raw) continue;
    const actor = normalizeActorRecord(raw);
    const level = Math.max(actor.initialLevel, 5);
    const stats = { attack: parameterValueAtLevel(actor.parameterCurves.attack, level), mind: parameterValueAtLevel(actor.parameterCurves.mind, level), attackPower: 10 };
    const known = [...new Set([...actor.learnedSkills.filter((l) => l.tp === undefined && l.level <= level).map((l) => l.skillId), ...classLearnedSkillIdsUpToLevel(project, actor.classId, level)])];
    const skills = known.map((sid) => project.database.skills.find((s) => s.id === sid)).filter((s): s is NonNullable<typeof s> => !!s);
    const cost = (s: (typeof skills)[number]) => (s.mpCost?.flat ?? 0) + (s.mpCost?.percentMax ?? 0);
    for (const paid of skills) {
      if (cost(paid) <= 0 || paid.stateEffects?.length || paid.effect?.kind !== "damage") continue;
      const mine = skillMagnitude(project, paid.id, stats);
      if (mine === undefined) continue;
      const rivals = skills.filter((s) => cost(s) <= 0 && s.scope === paid.scope && s.effect?.kind === "damage" && s.effect.statistic === (paid.effect as { statistic?: string }).statistic);
      const best = rivals.map((s) => ({ s, m: skillMagnitude(project, s.id, stats) })).filter((r): r is { s: (typeof skills)[number]; m: number } => r.m !== undefined).sort((a, b) => b.m - a.m)[0];
      if (best && mine <= best.m) out.push(`[게임 검사 기술] ${actor.name}의 「${paid.name}」(${paid.id}, MP ${cost(paid)}, 위력 ${paid.power})가 공짜 「${best.s.name}」(${best.s.id}, 위력 ${best.s.power})보다 약하다(Lv${level} 기대 피해 ${Math.round(mine)} ≤ ${Math.round(best.m)}) — MP 를 내고 쓸 까닭이 없다. upsert_skill 로 MP 기술 위력을 공짜 기술보다 10% 이상 높이거나(위력 ${Math.ceil(best.s.power * 1.1)} 이상), 속성·상태 효과·여러 대상 같은 다른 쓰임을 준다.`);
    }
  }
  return out;
}
