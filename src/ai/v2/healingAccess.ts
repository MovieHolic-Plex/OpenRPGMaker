// 전투가 있는 게임에 회복할 길을 결정적으로 넣는다 — 시작 맵 「회복의 샘」(전원 회복·저장)과 시작 회복약.
//
// 왜(2026-10-29 vm1 flash jrpg 판정 「전투 못 이김」): 던전 빌더가 적·보스를 두었는데 여관·상점·회복약·회복 기술이 하나도 없었다.
// 끝맺음 관문은 「회복 수단 없음」을 글로 짚었지만 Flash 는 고치지 않았고, 판정자는 임프 전투 두 번에 깎인 HP 로 보스 앞에 섰다.
// 이제 전투를 짓는 빌더(던전)와 청사진 경로 짓기가 끝에 이 함수를 부른다. 회복 길이 이미 하나라도 있으면 아무것도 하지 않는다.
// 목표 줄도 샘 자리를 가리킨다(시작 맵에서 걸리는 목표 글 끝 괄호에 「회복의 샘: <맵> <방위>」).
import { normalizeActorRecord, parameterValueAtLevel } from "@/project/actorModel";
import { canMove, isPassableLanding } from "@/project/collision";
import type { GameMap, Project } from "@/project/types";
import { allCommands, battleSites, healingItemIds, healingSources } from "./combatChecks";
import { isObjectiveCommand, mapRegion } from "./discoverability";
import { reachWithout } from "./puzzleChecks";
import type { BuildRun } from "./types";
import { victoryGatedSwitches } from "./blueprint";

export const HEALING_SPRING_ID = "ev_heal_spring";
export const HEALING_SPRING_NAME = "회복의 샘";
/** 회복 길이 없을 때 시작 소지품에 넣는 회복약 개수. */
export const START_POTIONS = 3;

/**
 * 시작 소지품에 넣을 회복약 — 약(medicine) 가운데 한 개로 선두 영웅 최대 HP 의 4분의 1 이상을 채우는 가장 싼 약(값 1000 이하).
 * 그런 약이 없으면 가장 많이 채우는 약. 값이 없는(파는 물건이 아닌) 아이템은 고르지 않는다.
 * 왜: 가장 싼 약은 「붉은 사과」(HP 15 / 514)였다 — 세 개를 줘도 회복 길이 아니다.
 */
export function startHealingItem(project: Project): string | undefined {
  const heals = healingItemIds(project);
  const lead = project.database.actors.find((a) => a.id === (project.system.startActorIds ?? [])[0]);
  const actor = lead ? normalizeActorRecord(lead) : undefined;
  const heroHp = actor ? parameterValueAtLevel(actor.parameterCurves.maxHp, actor.initialLevel) : 500;
  const amount = (i: Project["database"]["items"][number]) => (i.hpRecovery?.flat ?? 0) + Math.floor(((i.hpRecovery?.percentMax ?? 0) / 100) * heroHp);
  const items = project.database.items.filter((i) => heals.has(i.id) && (i.price ?? 0) > 0 && (i.price ?? 0) <= 1000 && amount(i) > 0)
    .sort((a, b) => (a.price ?? 0) - (b.price ?? 0) || a.id.localeCompare(b.id));
  // 약(medicine)을 먼저 — 음식(파이·사과)보다 회복약이 「회복 수단」으로 읽힌다.
  // 이름이 「…약」·potion 인 것 먼저(같은 medicine 이라도 「왕실 사과 파이」보다 「상급 회복약」).
  const potions = items.filter((i) => i.type === "medicine" && /약$|potion/iu.test(`${i.name ?? ""} ${i.id}`));
  const medicine = items.filter((i) => i.type === "medicine");
  const pick = (list: typeof items) => list.find((i) => amount(i) >= heroHp / 4) ?? [...list].sort((a, b) => amount(b) - amount(a) || (a.price ?? 0) - (b.price ?? 0))[0];
  return (pick(potions) ?? pick(medicine) ?? pick(items))?.id;
}

/** 시작 자리에서 걸어 3~8칸, 둘레 한 칸에 이벤트가 없는 칸(가까운 순·결정적). */
function springCell(project: Project, map: GameMap, accept: (cell: { x: number; y: number }) => boolean = () => true): { x: number; y: number } | undefined {
  const start = project.startMapId === map.id && project.startPos ? project.startPos : { x: Math.floor(map.width / 2), y: Math.floor(map.height / 2) };
  const near = (x: number, y: number) => (map.events ?? []).some((e) => Math.abs(e.x - x) <= 1 && Math.abs(e.y - y) <= 1);
  const seen = new Set<string>([`${start.x},${start.y}`]);
  let frontier = [start];
  for (let dist = 1; dist <= 12 && frontier.length; dist += 1) {
    const next: { x: number; y: number }[] = [];
    for (const cell of frontier) for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]] as const) {
      const x = cell.x + dx, y = cell.y + dy, key = `${x},${y}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (!isPassableLanding(project, map, x, y)) continue;
      next.push({ x, y });
    }
    if (dist >= 3) {
      // 샘 칸은 막히지 않는 칸이어야 한다 — 샘 둘레에 걸을 칸이 둘 이상 남아 길목을 막지 않는다.
      const open = (x: number, y: number) => [[0, -1], [1, 0], [0, 1], [-1, 0]].filter(([dx, dy]) => isPassableLanding(project, map, x + dx!, y + dy!)).length;
      const hit = next.find((c) => !near(c.x, c.y) && open(c.x, c.y) >= 3 && accept(c));
      if (hit) return hit;
    }
    frontier = next;
  }
  return undefined;
}

/** 목표 글 끝에 샘 자리를 붙인다 — 괄호가 있으면 그 안에 「/」로, 없으면 새 괄호로. */
function withSpringHint(message: string, hint: string): string {
  if (message.includes(HEALING_SPRING_NAME)) return message;
  return /\)\s*$/u.test(message) ? message.replace(/\)\s*$/u, ` / ${hint})`) : `${message} (${hint})`;
}

/**
 * 맵 이벤트의 목표 줄에 샘 자리를 붙인다 — 전투가 나는 맵 이름이 나오는 목표(던전으로 향하는 안내)만. 그런 목표가 없으면 이 맵의 목표 모두.
 * 바뀐 이벤트만 upsert_event 로 다시 쓴다(사본에서 고친다).
 */
function hintObjectives(run: BuildRun, map: GameMap, hint: string): number {
  const project = run.ctx.project;
  const battleMaps = new Set(battleSites(project).map((site) => site.split("/")[0]!));
  const names = [...battleMaps].map((id) => project.maps[id]?.name).filter((n): n is string => !!n && n.length >= 2);
  const messages: string[] = [];
  const collect = (list: unknown): void => {
    if (!Array.isArray(list)) return;
    for (const raw of list) {
      const cmd = raw as Record<string, unknown>;
      if (!cmd || typeof cmd !== "object") continue;
      if (isObjectiveCommand(cmd as never)) messages.push(String((cmd.fields as Record<string, unknown>).message));
      for (const value of Object.values(cmd)) if (Array.isArray(value)) collect(value);
    }
  };
  for (const event of map.events ?? []) for (const page of event.pages ?? []) collect(page.commands);
  const towardBattle = (message: string) => names.some((name) => message.includes(name));
  const pick = messages.some(towardBattle) ? towardBattle : () => true;
  let changed = 0;
  for (const original of map.events ?? []) {
    let touched = 0;
    const visit = (list: unknown): void => {
      if (!Array.isArray(list)) return;
      for (const raw of list) {
        const cmd = raw as Record<string, unknown>;
        if (!cmd || typeof cmd !== "object") continue;
        if (isObjectiveCommand(cmd as never)) {
          const fields = cmd.fields as Record<string, unknown>;
          const message = String(fields.message);
          const next = pick(message) ? withSpringHint(message, hint) : message;
          if (next !== message) { cmd.fields = { ...fields, message: next }; touched += 1; }
        }
        for (const value of Object.values(cmd)) if (Array.isArray(value)) visit(value);
      }
    };
    const event = structuredClone(original);
    for (const page of event.pages ?? []) visit(page.commands);
    if (touched && run.call("upsert_event", { mapId: map.id, event: event as unknown as Record<string, unknown>, replacePages: true }).ok) changed += touched;
  }
  return changed;
}

/**
 * 전투가 있는데 회복할 길이 하나도 없으면 시작 맵에 회복의 샘(place_savepoint heal)과 시작 회복약을 넣는다. 결정적·되풀이 안전.
 * 샘이 있으면(이번에 넣었든 앞서 넣었든) 시작 맵 목표 줄이 샘 자리를 가리키게 한다. 무엇을 했는지 한 줄씩 돌려준다.
 */
export function ensureHealingAccess(run: BuildRun): string[] {
  const notes: string[] = [];
  const project = run.ctx.project;
  if (!battleSites(project).length) return notes;
  const map = project.maps[project.startMapId];
  if (!map) return notes;
  if (!healingSources(project).length) {
    const potion = startHealingItem(project);
    if (potion) {
      const inventory = { ...(project.session.inventory ?? {}) };
      inventory[potion] = (inventory[potion] ?? 0) + START_POTIONS;
      if (run.call("set_session_start", { inventory }).ok) notes.push(`시작 소지품 ${potion}×${START_POTIONS}`);
    }
    const cell = springCell(run.ctx.project, map);
    if (cell) {
      const res = run.call("place_savepoint", { mapId: map.id, x: cell.x, y: cell.y, id: HEALING_SPRING_ID, name: HEALING_SPRING_NAME, heal: true, mode: "both", sparkleRadius: 2 });
      if (res.ok) notes.push(`${map.name ?? map.id} (${cell.x},${cell.y}) 회복의 샘(전원 회복·저장)`);
    }
  }
  const live = run.ctx.project.maps[run.ctx.project.startMapId];
  const spring = live?.events.find((e) => e.id === HEALING_SPRING_ID);
  if (live && spring) {
    const hinted = hintObjectives(run, live, `${HEALING_SPRING_NAME}: ${live.name ?? live.id} ${mapRegion(live, spring.x, spring.y)}`);
    if (hinted) notes.push(`목표 줄 ${hinted}곳에 샘 자리`);
  }
  return notes;
}

/** 보스(승리로 길을 여는 전투) 이벤트 — 이름 끝 _boss 이거나 승리 갈래에서만 켜는 스위치를 켠다. */
function bossEvents(project: Project): { map: GameMap; x: number; y: number; id: string }[] {
  const gated = victoryGatedSwitches(project);
  // 다른 이벤트의 페이지 조건으로 쓰이는 스위치만 「길을 연다」 — 잡몹이 자기 자신을 숨기는 _clear 스위치는 빼야 한다.
  const conditionUsers = new Map<string, Set<string>>();
  for (const map of Object.values(project.maps)) for (const ev of map.events ?? []) for (const page of ev.pages ?? []) {
    for (const m of JSON.stringify((page as unknown as { conditions?: unknown }).conditions ?? []).matchAll(/"switchId":"([^"]+)"/gu)) {
      const set = conditionUsers.get(m[1]!) ?? new Set<string>();
      set.add(`${map.id}/${ev.id}`);
      conditionUsers.set(m[1]!, set);
    }
  }
  const out: { map: GameMap; x: number; y: number; id: string }[] = [];
  for (const map of Object.values(project.maps)) for (const ev of map.events ?? []) {
    const text = JSON.stringify(ev.pages ?? []);
    if (!text.includes('"battleProcessing"')) continue;
    const opensOther = [...text.matchAll(/"kind":"setSwitch"[^}]*?"switchId":"([^"]+)"/gu)].some((m) => gated.has(m[1]!) && [...(conditionUsers.get(m[1]!) ?? [])].some((u) => u !== `${map.id}/${ev.id}`));
    if (/_boss$/u.test(ev.id) || opensOther) out.push({ map, x: ev.x, y: ev.y, id: ev.id });
  }
  return out.sort((a, b) => Number(!/_boss$/u.test(a.id)) - Number(!/_boss$/u.test(b.id)));
}

/** 그 맵 안에 전원 회복(여관·recoverAll)이 있나. */
function mapHasFullRecovery(map: GameMap): boolean {
  return (map.events ?? []).some((ev) => /"kind":"(?:recoverAll|inn)"/u.test(JSON.stringify(ev.pages ?? [])));
}

/** 보스 둘레에서 걸어 4~10칸, 둘레 한 칸에 이벤트가 없고 이웃 셋 이상이 트인 칸(보스에 가까운 순·결정적). */
function restCell(project: Project, map: GameMap, boss: { x: number; y: number }, side?: ReadonlySet<string>): { x: number; y: number } | undefined {
  const near = (x: number, y: number) => (map.events ?? []).some((e) => Math.abs(e.x - x) <= 1 && Math.abs(e.y - y) <= 1);
  const open = (x: number, y: number) => [[0, -1], [1, 0], [0, 1], [-1, 0]].filter(([dx, dy]) => isPassableLanding(project, map, x + dx!, y + dy!)).length;
  const seen = new Set<string>([`${boss.x},${boss.y}`]);
  let frontier = [boss];
  for (let dist = 1; dist <= 10 && frontier.length; dist += 1) {
    const next: { x: number; y: number }[] = [];
    for (const cell of frontier) for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]] as const) {
      const x = cell.x + dx, y = cell.y + dy, key = `${x},${y}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (!isPassableLanding(project, map, x, y)) continue;
      next.push({ x, y });
    }
    if (dist >= 4) {
      const hit = [...next].sort((a, b) => a.y - b.y || a.x - b.x).find((c) => !near(c.x, c.y) && open(c.x, c.y) >= 3 && (!side || side.has(`${c.x},${c.y}`)));
      if (hit) return hit;
    }
    frontier = next;
  }
  return undefined;
}

/**
 * 보스가 있는 맵에 전원 회복이 없으면 보스 몇 걸음 앞에 「쉼터 결정」(전원 회복·저장)을 둔다. 결정적·되풀이 안전.
 * 왜(2026-10-29 vm3 flash jrpg 판정 「전투 못 이김」): 회복의 샘은 시작 마을 구석에만 있었고, 판정자는 동굴 잡몹 두 번에
 * 깎이고 독에 걸린 채(301/514) 리치 앞에 섰다. 모의 전투(만피로 시작)는 이긴다고 했지만, 실제로는 깎인 HP 로 시작한다.
 */
export function ensureBossRest(run: BuildRun): string[] {
  const notes: string[] = [];
  const project = run.ctx.project;
  const done = new Set<string>();
  for (const boss of bossEvents(project)) {
    const map = run.ctx.project.maps[boss.map.id];
    if (!map || done.has(map.id) || map.id === project.startMapId || mapHasFullRecovery(map)) continue;
    done.add(map.id);
    const id = `ev_${map.id}_rest`;
    if (map.events.some((e) => e.id === id)) continue;
    // 들어오는 쪽(보스 둘레 3×3 을 지나지 않고 닿는 칸)에 먼저 둔다 — 보스 너머에 두면 회복하러 보스를 지나야 한다. 그런 칸이 없으면 둘레 어디든.
    const blocked = new Set<string>();
    for (let dx = -1; dx <= 1; dx += 1) for (let dy = -1; dy <= 1; dy += 1) blocked.add(`${boss.x + dx},${boss.y + dy}`);
    const side = reachWithout(run.ctx.project, map, blocked, true) ?? undefined;
    const cell = (side ? restCell(run.ctx.project, map, boss, side) : undefined) ?? restCell(run.ctx.project, map, boss);
    if (!cell) continue;
    const res = run.call("place_savepoint", { mapId: map.id, x: cell.x, y: cell.y, id, name: "쉼터 결정", heal: true, mode: "both", sparkleRadius: 2 });
    if (res.ok) notes.push(`${map.name ?? map.id} (${cell.x},${cell.y}) 보스 앞 쉼터 결정(전원 회복·저장)`);
  }
  return notes;
}

export const SUPPLY_SHOP_ID = "ev_supply_shop";
export const SUPPLY_SHOP_NAME = "떠돌이 상인";

/** 전투로 돈을 벌거나(적 보상·상자·이벤트 돈) 시작 돈이 있는가. */
function goldObtainable(project: Project): boolean {
  if ((project.session.gold ?? 0) > 0) return true;
  const commands = allCommands(project);
  if (commands.some((r) => r.cmd.kind === "changeGold" && r.cmd.op !== "-=")) return true;
  const fought = new Set(commands.filter((r) => r.cmd.kind === "battleProcessing").map((r) => String(r.cmd.troopId)));
  for (const m of Object.values(project.maps)) for (const e of m.encounterTable ?? []) fought.add(String((e as { troopId?: string }).troopId));
  for (const m of Object.values(project.maps)) for (const id of m.troopIds ?? []) fought.add(String(id));
  const enemies = new Set(project.database.troops.filter((t) => fought.has(t.id)).flatMap((t) => t.enemyIds ?? []));
  return project.database.enemies.some((e) => enemies.has(e.id) && (e.rewards?.gold ?? 0) > 0);
}

/**
 * 떠돌이 상인이 팔 물건 — 이름이 「…약」·potion 인 HP 회복약 가운데 싼 둘, 적 기술이 거는 전투 뒤에도 남는 상태(독 등)를 푸는 가장 싼 약 하나.
 * 값이 있는(파는 물건인) 1000 이하 약만. 결정적(값·id 순).
 */
function supplyGoods(project: Project): string[] {
  const heals = healingItemIds(project);
  const priced = project.database.items.filter((i) => i.type === "medicine" && (i.price ?? 0) > 0 && (i.price ?? 0) <= 1000)
    .sort((a, b) => (a.price ?? 0) - (b.price ?? 0) || a.id.localeCompare(b.id));
  const lead = project.database.actors.find((a) => a.id === (project.system.startActorIds ?? [])[0]);
  const actor = lead ? normalizeActorRecord(lead) : undefined;
  const heroHp = actor ? parameterValueAtLevel(actor.parameterCurves.maxHp, actor.initialLevel) : 500;
  const amount = (i: Project["database"]["items"][number]) => (i.hpRecovery?.flat ?? 0) + Math.floor(((i.hpRecovery?.percentMax ?? 0) / 100) * heroHp);
  const named = priced.filter((i) => heals.has(i.id) && amount(i) > 0 && /약$|potion/iu.test(`${i.name ?? ""} ${i.id}`));
  const pool = named.length ? named : priced.filter((i) => heals.has(i.id) && amount(i) > 0);
  // 싼 약 하나(최대 HP 10분의 1 이상) + 보스전에 쓸 큰 약 하나(4분의 1 이상) — 「붉은 사과」 같은 HP 15 짜리는 팔지 않는다.
  const small = pool.find((i) => amount(i) >= heroHp / 10) ?? pool[0];
  const big = pool.find((i) => amount(i) >= heroHp / 4 && i.id !== small?.id);
  const out = [small, big].filter((i): i is NonNullable<typeof i> => !!i).map((i) => i.id);
  const inflicted = new Set<string>();
  const skillIds = new Set(project.database.enemies.flatMap((e) => [...(e.skillIds ?? []), ...(e.actions ?? []).map((a) => a.skillId)]));
  for (const s of project.database.skills) if (skillIds.has(s.id)) for (const fx of s.stateEffects ?? []) if (fx.operation !== "remove") inflicted.add(fx.stateId);
  const lasting = [...inflicted].filter((id) => /전투 종료 후 유지/u.test(project.database.states.find((st) => st.id === id)?.removalCondition ?? ""));
  for (const stateId of lasting) {
    if (out.some((id) => (project.database.items.find((i) => i.id === id)?.healStateIds ?? []).includes(stateId))) continue;
    const cure = priced.find((i) => (i.healStateIds ?? []).includes(stateId));
    if (cure) out.push(cure.id);
  }
  return out.slice(0, 4);
}

/**
 * 전투가 있고 돈을 벌 수 있는데 상점이 하나도 없으면 시작 맵 시작 자리 가까이에 약을 파는 떠돌이 상인을 세운다. 결정적·되풀이 안전.
 * 왜(2026-10-29 vm3 flash jrpg 판정 major): 「소지금 206G 를 쓸 곳이 없다」 — 상자·적 보상으로 돈이 들어오는데 마을에 상점이 없었고,
 * 동굴 독이 보스전까지 남았다(해독약을 살 데도 없었다).
 */
export function ensureSupplyShop(run: BuildRun): string[] {
  const project = run.ctx.project;
  if (!battleSites(project).length || !goldObtainable(project)) return [];
  if (allCommands(project).some((r) => r.cmd.kind === "shop")) return [];
  const map = project.maps[project.startMapId];
  if (!map || map.events.some((e) => e.id === SUPPLY_SHOP_ID)) return [];
  const goods = supplyGoods(project);
  if (!goods.length) return [];
  // 상인은 길을 막는 사람이다(회복의 샘과 달리 밟고 지나갈 수 없다) — 세웠을 때 걸어 닿는 칸이 그 칸 하나만 줄어드는 자리만 쓴다.
  // 왜(2026-10-29 vm3 flash jrpg 재생): 이웃 셋이 트인 (5,3) 이 시작 주머니의 유일한 목이었다 — 세우자 닿는 칸 734 → 22, 동굴 문까지 자동 플레이가 끊겼다.
  // 닿는 칸은 시작 자리 하나에서 센다 — 여러 입구에서 세면(reachWithout) 목 너머가 다른 입구로 닿아 보여 목을 못 잡는다.
  const start = project.startPos ?? { x: Math.floor(map.width / 2), y: Math.floor(map.height / 2) };
  const reachFrom = (blocked: string): number => {
    const seen = new Set<string>([`${start.x},${start.y}`]);
    const queue = [start];
    for (let i = 0; i < queue.length; i += 1) {
      const c = queue[i]!;
      for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]] as const) {
        const x = c.x + dx, y = c.y + dy, key = `${x},${y}`;
        if (seen.has(key) || key === blocked || !canMove(project, map, c.x, c.y, x, y)) continue;
        seen.add(key);
        queue.push({ x, y });
      }
    }
    return seen.size;
  };
  const base = reachFrom("");
  const cell = springCell(project, map, (c) => reachFrom(`${c.x},${c.y}`) >= base - 1);
  if (!cell) return [];
  const res = run.call("place_npc", {
    mapId: map.id, x: cell.x, y: cell.y, name: SUPPLY_SHOP_NAME, id: SUPPLY_SHOP_ID, movement: "fixed",
    graphic: { query: "중년 남성 주민" },
    pages: [{ name: `${SUPPLY_SHOP_NAME} · 기본`, lines: ["먼 길 떠나기 전에 약부터 챙기게. 동굴에서 다치면 돌아올 길도 멀다네."], commands: [{ kind: "shop", shopType: "normal", itemIds: goods, allowSell: true }] }],
  });
  return res.ok ? [`${map.name ?? map.id} (${cell.x},${cell.y}) ${SUPPLY_SHOP_NAME}(${goods.join("·")})`] : [];
}
