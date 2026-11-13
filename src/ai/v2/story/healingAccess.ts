// 전투가 있는 게임에 회복할 길을 결정적으로 넣는다 — 시작 맵 「회복의 샘」(전원 회복·저장)과 시작 회복약.
//
// 왜(2026-10-29 vm1 flash jrpg 판정 「전투 못 이김」): 던전 빌더가 적·보스를 두었는데 여관·상점·회복약·회복 기술이 하나도 없었다.
// 끝맺음 관문은 「회복 수단 없음」을 글로 짚었지만 Flash 는 고치지 않았고, 판정자는 임프 전투 두 번에 깎인 HP 로 보스 앞에 섰다.
// 이제 전투를 짓는 빌더(던전)와 청사진 경로 짓기가 끝에 이 함수를 부른다. 회복 길이 이미 하나라도 있으면 아무것도 하지 않는다.
// 쉴 곳·가게가 필요한가는 place/program.ts serviceNeeds 하나가 정한다(2026-11-11 목적표). 목적표가 여관·가게 건물을 세운 게임은 그 방 안에 주인을 세우고,
// 그런 건물이 없는 게임(선언이 없는 세계·예전 길)만 예전처럼 시작 맵에 샘·떠돌이 상인을 둔다.
// 목표 줄도 샘 자리를 가리킨다(시작 맵에서 걸리는 목표 글 끝 괄호에 「회복의 샘: <맵> <방위>」).
import { normalizeActorRecord, parameterValueAtLevel } from "@/project/actorModel";
import { canMove, isPassableLanding } from "@/project/collision";
import { pickSpot } from "@/editor/tools/jrpgVolumeTools";
import { REST_ROLE, SUPPLY_ROLE } from "@/project/settlementProgram";
import type { GameMap, Project } from "@/project/types";
import { allCommands, battleSites, healingItemIds } from "../judge/combatChecks";
import { mapRegion } from "../judge/objectiveWhere";
import { isObjectiveCommand } from "../judge/objectiveCommand";
import { reachWithout } from "../judge/puzzleChecks";
import { serviceNeeds, serviceRoom } from "../place/program";
import { incomingLandings } from "../place/where";
import type { BuildRun } from "../shared/types";
import { victoryGatedSwitches } from "./blueprint";

const HEALING_SPRING_ID = "ev_heal_spring";
const HEALING_SPRING_NAME = "회복의 샘";
/** 회복 길이 없을 때 시작 소지품에 넣는 회복약 개수. */
const START_POTIONS = 3;

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
  if (message.includes(hint.split(":")[0]!)) return message;
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
  // 목적표의 여관이 있으면 그 안에 주인을 세운다(먼저 — 그러면 아래 «회복 길 없음»이 풀려 샘을 두지 않는다).
  notes.push(...keepInn(run));
  const project = run.ctx.project;
  if (!battleSites(project).length) return notes;
  const map = project.maps[project.startMapId];
  if (!map) return notes;
  if (serviceNeeds(project, "built").rest) {
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
  // 목적표의 여관은 시작 맵이 아닌 장소에 있을 수 있다 — 싸우러 가는 목표 줄이 여관이 있는 장소를 가리키게 한다.
  const inn = serviceRoom(run.ctx.project, REST_ROLE);
  const innHost = inn ? run.ctx.project.maps[inn.hostMapId] : undefined;
  if (live && innHost && mapHasFullRecovery(run.ctx.project.maps[inn!.mapId]!)) {
    const hinted = hintObjectives(run, live, `여관: ${innHost.name ?? innHost.id}`);
    if (hinted) notes.push(`목표 줄 ${hinted}곳에 여관 자리`);
  }
  return notes;
}

/** 목적표가 지은 방 안, 들어온 칸에서 안쪽으로 걸어 들어간 자리(길을 막지 않는 칸). */
function keeperCell(project: Project, room: GameMap): { x: number; y: number } | undefined {
  const landing = incomingLandings(project, room.id).find((c) => isPassableLanding(project, room, c.x, c.y));
  return landing ? pickSpot(project, room, landing, new Set(), 0.7, 3) : undefined;
}

/** 목적표의 여관(place/program.ts) 안에 여관 주인 — 말을 걸면 전원 회복(값 없음: 시작 맵의 샘과 같은 안전망이다). 결정적·되풀이 안전. */
function keepInn(run: BuildRun): string[] {
  const project = run.ctx.project;
  const inn = serviceRoom(project, REST_ROLE);
  const room = inn ? project.maps[inn.mapId] : undefined;
  if (!inn || !room || mapHasFullRecovery(room)) return [];
  const cell = keeperCell(project, room);
  if (!cell) return [];
  const res = run.call("place_npc", {
    mapId: room.id, x: cell.x, y: cell.y, name: "여관 주인", id: `ev_${room.id}_innkeeper`, movement: "fixed",
    graphic: { query: "중년 여성 주민" },
    pages: [{ name: "여관 주인 · 기본", lines: ["먼 길 오셨군요. 방은 비어 있으니 쉬다 가세요."], commands: [{ kind: "recoverAll" }, { kind: "text", body: "푹 쉬었다. 기운이 돌아왔다." }] }],
  });
  return res.ok ? [`${room.name ?? room.id} (${cell.x},${cell.y}) 여관 주인(전원 회복)`] : [];
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
  // 싸우는 단계의 상대와 마지막 단계의 이벤트 — 길 위 전투 맞추기(pathBattles)가 보스로 재는 것과 같은 것. 이긴 뒤 스위치 대신 쪽지를 떨어뜨리는 상대도 보스다
  // (2026-11-13 r2s-fun: 번호 쪽지를 주는 인형 앞의 쉼터가 사라졌다).
  const steps = project.gameBlueprint?.steps ?? [];
  const stepBoss = new Set(steps.flatMap((step, i) => step.built?.eventId && (step.kind === "battle" || i === steps.length - 1) ? [`${step.built.mapId}/${step.built.eventId}`] : []));
  const out: { map: GameMap; x: number; y: number; id: string }[] = [];
  for (const map of Object.values(project.maps)) for (const ev of map.events ?? []) {
    const text = JSON.stringify(ev.pages ?? []);
    if (!text.includes('"battleProcessing"')) continue;
    if (stepBoss.has(`${map.id}/${ev.id}`)) { out.push({ map, x: ev.x, y: ev.y, id: ev.id }); continue; }
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
    if (!map || done.has(map.id) || map.id === project.startMapId) continue;
    const id = `ev_${map.id}_rest`;
    // 우리가 놓은 결정 뒤에 그 맵에 다른 전원 회복(모델이 놓은 저장 지점 등)이 생겼으면 결정을 걷는다 — 한 맵에 쉼터가 둘 서지 않게.
    const others = map.events.filter((e) => e.id !== id);
    if (others.length !== map.events.length && mapHasFullRecovery({ ...map, events: others })) { map.events = others; notes.push(`${map.name ?? map.id} 보스 앞 쉼터 결정을 걷음 — 그 맵에 다른 전원 회복이 있다`); continue; }
    if (mapHasFullRecovery(map)) continue;
    done.add(map.id);
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

const SUPPLY_SHOP_ID = "ev_supply_shop";
const SUPPLY_SHOP_NAME = "떠돌이 상인";

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
  // 목적표의 가게가 있으면 그 안에 주인을 세운다 — 가게를 둘지는 목적표가 이미 정했다(place/program.ts serviceNeeds "plan").
  const shop = serviceRoom(project, SUPPLY_ROLE);
  if (shop) {
    const room = project.maps[shop.mapId]!;
    if (allCommands(project).some((r) => r.mapId === room.id && r.cmd.kind === "shop")) return [];
    const goods = supplyGoods(project), cell = goods.length ? keeperCell(project, room) : undefined;
    if (!cell) return [];
    const res = run.call("place_npc", {
      mapId: room.id, x: cell.x, y: cell.y, name: "가게 주인", id: `ev_${room.id}_shopkeeper`, movement: "fixed",
      graphic: { query: "중년 남성 주민" },
      pages: [{ name: "가게 주인 · 기본", lines: ["어서 오게. 먼 길 떠나기 전에 약부터 챙기게."], commands: [{ kind: "shop", shopType: "normal", itemIds: goods, allowSell: true }] }],
    });
    return res.ok ? [`${room.name ?? room.id} (${cell.x},${cell.y}) 가게 주인(${goods.join("·")})`] : [];
  }
  if (!serviceNeeds(project, "built").supply) return [];
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
    // 싸움터가 어디인지(동굴·설원·정거장) 이 단계는 모른다 — 대사에 장소 이름을 넣지 않는다.
    pages: [{ name: `${SUPPLY_SHOP_NAME} · 기본`, lines: ["먼 길 떠나기 전에 약부터 챙기게. 다치면 돌아올 길도 멀다네."], commands: [{ kind: "shop", shopType: "normal", itemIds: goods, allowSell: true }] }],
  });
  return res.ok ? [`${map.name ?? map.id} (${cell.x},${cell.y}) ${SUPPLY_SHOP_NAME}(${goods.join("·")})`] : [];
}

/**
 * 시작 맵에 상점이 있는데 시작 돈이 0 이면 그 상점의 가장 싼 회복약 둘 값을 시작 돈으로 준다(10 단위 올림, 100~300). 결정적·되풀이 안전(돈이 있으면 그대로).
 * 왜(2026-10-29 vm6 argon jrpg 판정 major): 목표가 「장비를 갖춘 뒤 동굴로」인데 소지금 0G — 마을 상인의 약(105G·150G)을 아무것도 살 수 없었고
 * 돈은 동굴 적을 잡아야 들어왔다. 판정자는 돈 벌 길을 찾다 시간을 썼다.
 */
export function ensureStartingGold(run: BuildRun): string[] {
  const project = run.ctx.project;
  if ((project.session.gold ?? 0) > 0) return [];
  const map = project.maps[project.startMapId];
  if (!map) return [];
  const ids = new Set<string>();
  // 시작 맵의 상점과, 목적표가 세운 가게(시작 맵이 아닌 장소의 가게 안일 수 있다).
  const shopRoom = serviceRoom(project, SUPPLY_ROLE);
  for (const m of [map, ...(shopRoom && project.maps[shopRoom.mapId] ? [project.maps[shopRoom.mapId]!] : [])]) for (const ev of m.events ?? []) for (const p of ev.pages ?? []) for (const c of (p.commands ?? []) as unknown as Record<string, unknown>[]) {
    if (c.kind === "shop" && Array.isArray(c.itemIds)) for (const id of c.itemIds) ids.add(String(id));
  }
  const prices = project.database.items.filter((i) => ids.has(i.id) && (i.price ?? 0) > 0 && (healingItemIds(project).has(i.id) || i.type === "medicine")).map((i) => i.price ?? 0).sort((a, b) => a - b);
  if (!prices.length) return [];
  const want = Math.min(300, Math.max(100, Math.ceil(((prices[0] ?? 0) * 2) / 10) * 10));
  run.ctx.project = { ...project, session: { ...project.session, gold: want } };
  return [`시작 돈 0G → ${want}G (상점의 가장 싼 약 ${prices[0]}G 둘 값)`];
}
