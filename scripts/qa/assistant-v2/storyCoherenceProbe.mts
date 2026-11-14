// 조수 v2 «맵 위의 것이 맵·이야기와 맞나» 탐침(모델 없음). 눈가림 플레이가 짚은 다섯 가지를 저장본·새로 지은 판에서 센다.
//   bun scripts/qa/assistant-v2/storyCoherenceProbe.mts facts <project.json>            사실 표(아래 다섯 묶음)
//   bun scripts/qa/assistant-v2/storyCoherenceProbe.mts fixture <run-dir> <out.json>    그 판 첫 턴의 청사진·대사를 빈 프로젝트에 다시 지어(build_places → build_blueprint_path → 끝맺음) 사실 표
//   bun scripts/qa/assistant-v2/storyCoherenceProbe.mts pacing <project.json>           청사진 단계를 차례로 걷는 길: 맵마다 걷는 칸·들를 곳·걸음·길이 밟는 칸
// 저장본을 지금 코드의 끝맺음에 다시 통과시킨 것은 finishReplay.mts 가 쓴 <이름>.project.json 을 facts 로 읽는다.
// 묶음: G 잠김 글이 실제 조건과 다른 것 · O 목표 글의 대상과 꼬리 대상이 다른 것/곁 퀘스트가 건 목표 · F 싸우는 단계의 상대(이긴 뒤 남는 그림·필드 그림≠전투 그림)
//       T 전투 맵의 배경·적·상자 · X 경험치 곡선(길 위 전투로 오르는 레벨)
import fs from "node:fs";
import path from "node:path";
import { createBlankProject } from "../../../src/project/defaults/blankProject.ts";
import { createV2Tools } from "../../../src/ai/v2/tools/verbs.ts";
import { V2Session } from "../../../src/ai/v2/turn/session.ts";
import { runFinishAutoBuild } from "../../../src/ai/v2/finish/index.ts";
import { resolveBattleBackdrop } from "../../../src/battle/battleBackdrop.ts";
import { normalizeActorRecord, totalExpForLevel } from "../../../src/project/actorModel.ts";
import { isPassable, canMove } from "../../../src/project/collision.ts";
import type { PiAssistantV2Env } from "../../../src/ai/v2/shared/env.ts";
import type { ToolContext } from "../../../src/editor/tools/types.ts";
import type { GameMap, Project } from "../../../src/project/types.ts";

type Obj = Record<string, unknown>;
type Ev = GameMap["events"][number];
const bare = (s: string) => s.replace(/[\s「」『』"'·]/gu, "");
function walk(node: unknown, visit: (cmd: Obj) => void): void {
  if (Array.isArray(node)) { for (const n of node) walk(n, visit); return; }
  if (!node || typeof node !== "object") return;
  visit(node as Obj);
  for (const v of Object.values(node as Obj)) if (v && typeof v === "object") walk(v, visit);
}
const all = (p: Project) => Object.values(p.maps).flatMap((map) => (map.events ?? []).map((ev) => ({ map, ev })));
const named = (ev: Ev) => String((ev as { name?: string }).name ?? "").trim();
const texts = (cmds: unknown): string[] => { const out: string[] = []; walk(cmds, (c) => { if (c.kind === "text" && typeof c.body === "string") out.push(c.body); }); return out; };

function facts(p: Project): { lines: string[]; counts: Record<string, number> } {
  const lines: string[] = [];
  const counts: Record<string, number> = {};
  const bump = (k: string, n = 1) => { counts[k] = (counts[k] ?? 0) + n; };
  const steps = p.gameBlueprint?.steps ?? [];
  const heads = steps.map((st) => ({ id: st.id, head: bare((st.who?.trim() || st.event).split(/\s+/u).at(-1) ?? "") })).filter((h) => h.head.length >= 2);

  // G) 잠김 글
  for (const key of ["G gates", "G wrong-prerequisite", "O objectives", "O text≠tail target", "O side-quest objective", "F step foes", "F stays after win", "F field≠battle sprite", "T battle maps", "T forest backdrop off-theme", "T loot is crafting material"]) bump(key, 0);
  for (const { map, ev } of all(p)) {
    const pages = ev.pages ?? [];
    const lockedAt = pages.findIndex((pg) => !(pg.conditions ?? []).length && (pg.commands ?? []).length > 0 && (pg.commands as unknown as Obj[]).every((c) => c.kind === "text"));
    const open = pages.find((pg, i) => i > lockedAt && (pg.conditions ?? []).length === 1);
    const cond = (open?.conditions?.[0] ?? {}) as { kind?: string; switchId?: string; itemId?: string };
    if (lockedAt < 0 || !open || !(cond.switchId || cond.itemId)) continue;
    const setters = all(p).filter((r) => r.ev.id !== ev.id && (() => { let hit = false; walk(r.ev.pages, (c) => { if ((c.kind === "setSwitch" && c.switchId === cond.switchId && c.value !== false) || (c.kind === "changeItem" && !!cond.itemId && c.itemId === cond.itemId)) hit = true; }); return hit; })());
    if (setters.length !== 1) continue;
    bump("G gates");
    const setter = setters[0]!;
    const setterHead = bare(named(setter.ev).split(/\s+/u).at(-1) ?? "");
    const body = texts(pages[lockedAt]!.commands).filter((l) => !/^먼저\s/u.test(l)).map(bare).join(" ");
    const other = heads.find((h) => h.head !== setterHead && !bare(named(setter.ev)).includes(h.head) && !bare(named(ev)).includes(h.head) && body.includes(h.head));
    if (other && !(setterHead.length >= 2 && body.includes(setterHead))) {
      bump("G wrong-prerequisite");
      lines.push(`G  「${named(ev) || ev.id}」(${map.name}) 잠김 글 «${texts(pages[lockedAt]!.commands).join(" / ").slice(0, 110)}» — 실제 조건은 「${named(setter.ev)}」, 글은 ${other.id} «${other.head}» 를 말한다`);
    }
  }

  // O) 목표
  const quests = ((p as unknown as { quests?: { key?: string; giver?: { eventId?: string } }[] }).quests ?? []).filter((q) => q.key);
  const evNames = all(p).filter((r) => bare(named(r.ev)).length >= 2 && !r.ev.id.startsWith("ev_objective") && !r.ev.id.startsWith("ev_gate_"));
  for (const { map, ev } of all(p)) for (const page of ev.pages ?? []) {
    const sideSwitch = quests.some((q) => JSON.stringify(page.commands ?? []).includes(`"sw_${q.key}_`) || JSON.stringify(page.conditions ?? []).includes(`"sw_${q.key}_`));
    walk(page.commands, (c) => {
      if (c.kind !== "m2Command" || (c.fields as Obj | undefined)?.surface !== "objectiveChip") return;
      const message = String((c.fields as Obj).message ?? "");
      bump("O objectives");
      const tail = /\s*\(([^()]*)\)\s*$/u.exec(message);
      const base = tail ? message.slice(0, tail.index) : message;
      const label = tail ? bare((tail[1]!.split("→").at(-1) ?? "").split("·").at(-1) ?? "") : "";
      const inText = [...new Set(evNames.filter((r) => r.ev.id !== ev.id && bare(base).includes(bare(named(r.ev)))).map((r) => bare(named(r.ev))))];
      const textNamed = inText.filter((n) => !inText.some((o) => o !== n && o.includes(n)));
      if (textNamed.length === 1 && label && label !== textNamed[0] && evNames.some((r) => bare(named(r.ev)) === label)) {
        bump("O text≠tail target");
        lines.push(`O  「${named(ev) || ev.id}」(${map.name}) 목표 «${message.slice(0, 80)}» — 글은 «${textNamed[0]}», 표시는 «${label}»`);
      }
      if (sideSwitch && quests.some((q) => ev.id.startsWith(`ev_${q.key}_`) || ev.id === q.giver?.eventId)) {
        bump("O side-quest objective");
        lines.push(`O  곁 퀘스트 페이지 ${ev.id}(${map.name}) 가 본편 목표를 바꾼다: «${message.slice(0, 60)}»`);
      }
    });
  }

  // F) 싸우는 단계의 상대
  for (const { map, ev } of all(p)) {
    if (!ev.id.startsWith("ev_chain_")) continue;
    const pages = ev.pages ?? [];
    const fightAt = pages.findIndex((pg) => JSON.stringify(pg.commands ?? []).includes('"battleProcessing"'));
    if (fightAt < 0) continue;
    bump("F step foes");
    let troopId = "";
    const won = new Set<string>();
    walk(pages[fightAt]!.commands, (c) => { if (c.kind === "battleProcessing" && typeof c.troopId === "string") troopId ||= c.troopId; if (c.kind === "setSwitch" && c.value === true) won.add(String(c.switchId)); });
    const troop = p.database.troops.find((t) => t.id === troopId);
    const lead = p.database.enemies.find((e) => e.id === (troop?.members?.[0]?.enemyId ?? troop?.enemyIds?.[0])) as { name?: string; monsterResourceId?: string } | undefined;
    const sprite = (pg: (typeof pages)[number]) => { const g = (pg.graphic ?? {}) as { transparent?: boolean; sprite?: { id?: string } }; return g.transparent === true ? "" : String(g.sprite?.id ?? ""); };
    const after = pages.find((pg, i) => i > fightAt && (pg.conditions ?? []).some((c) => won.has(String((c as { switchId?: string }).switchId))));
    const stays = !!after && !!sprite(after);
    const field = sprite(pages[fightAt]!);
    const differs = !!lead?.monsterResourceId && !!field && field !== lead.monsterResourceId && !/people|actor|charset_(?!monster|animal)/u.test(field);
    if (stays) bump("F stays after win");
    if (differs) bump("F field≠battle sprite");
    lines.push(`F  「${named(ev)}」(${map.name}) 상대 «${lead?.name}» 전투 그림 ${lead?.monsterResourceId} · 필드 그림 ${field || "(없음)"} · 이긴 뒤 ${stays ? `그대로 서 있다(${sprite(after!)})` : "맵에서 걷힌다"}`);
  }

  // T) 전투 맵의 배경·적·상자
  for (const map of Object.values(p.maps)) {
    const fights: { troopId: string; x: number; y: number }[] = [];
    for (const ev of map.events ?? []) walk(ev.pages, (c) => { if (c.kind === "battleProcessing" && typeof c.troopId === "string") fights.push({ troopId: c.troopId, x: ev.x, y: ev.y }); });
    const loot: string[] = [];
    for (const ev of map.events ?? []) if (/chest/u.test(ev.id)) walk(ev.pages, (c) => {
      if (c.kind === "changeItem") { const item = p.database.items.find((i) => i.id === c.itemId); loot.push(`${item?.name ?? c.itemId}(${item?.type})`); if (item?.type === "normalGoods") bump("T loot is crafting material"); }
      if (c.kind === "changeGold") loot.push(`${String(c.amount)}G`);
    });
    if (!fights.length && !loot.length) continue;
    const backs = [...new Set(fights.map((f) => resolveBattleBackdrop({ project: p, troopId: f.troopId, location: { mapId: map.id, x: f.x, y: f.y } })))];
    const foes = [...new Set(fights.map((f) => { const t = p.database.troops.find((x) => x.id === f.troopId); return (t?.enemyIds ?? []).map((id) => p.database.enemies.find((e) => e.id === id)?.name ?? id).join("+"); }))];
    if (fights.length) bump("T battle maps");
    if (fights.length && map.tilesetId !== "beodeul_city" && backs.includes("battle-scenery-forest") && !/숲|forest/iu.test(map.name ?? "")) bump("T forest backdrop off-theme");
    lines.push(`T  ${map.name}(${map.tilesetId}) 배경 ${backs.join(",") || "-"} · 적 ${foes.join(" / ") || "-"} · 상자 ${loot.join(", ") || "-"}`);
  }

  // X) 경험치
  const ids = (p.system.startActorIds ?? []).filter((id) => p.database.actors.some((a) => a.id === id));
  const lead = p.database.actors.find((a) => a.id === ids[0]);
  if (lead) {
    const curve = normalizeActorRecord(lead).expCurve;
    const lv0 = lead.initialLevel ?? 1;
    const expOf = (troopId: string) => (p.database.troops.find((t) => t.id === troopId)?.enemyIds ?? []).reduce((s, id) => s + Math.max(0, Number((p.database.enemies.find((e) => e.id === id) as { rewards?: { exp?: number } } | undefined)?.rewards?.exp ?? 0)), 0);
    let stepExp = 0, pathExp = 0;
    for (const { ev } of all(p)) walk(ev.pages, (c) => { if (c.kind !== "battleProcessing" || typeof c.troopId !== "string") return; const e = expOf(c.troopId); pathExp += e; if (c.canEscape === false) stepExp += e; });
    const levelAt = (exp: number) => { let lv = lv0; while (lv < 99 && totalExpForLevel(curve, lv + 1) - totalExpForLevel(curve, lv0) <= exp) lv += 1; return lv; };
    counts["X level after all battles"] = levelAt(pathExp);
    counts["X level after step battles only"] = levelAt(stepExp);
    lines.push(`X  곡선 base ${curve.base} extra ${curve.extra} accel ${curve.acceleration} · Lv${lv0}→${lv0 + 1} 필요 ${totalExpForLevel(curve, lv0 + 1) - totalExpForLevel(curve, lv0)} · 단계 전투 경험치 ${stepExp} → Lv${levelAt(stepExp)} · 전투 이벤트 전부 ${pathExp} → Lv${levelAt(pathExp)}`);
  }
  return { lines, counts };
}

/**
 * 걸음 재기: 시작 칸에서 청사진 단계의 이벤트를 차례로 찾아간다(다른 맵이면 맵 사이 이동 이벤트를 가장 적게 거치는 길로).
 * 맵마다: 크기 · 걷는 칸(시작 칸에서 닿는 칸) · 꼭 들를 곳(단계 이벤트) · 그 밖의 할 것(대사·상자·적) · 그 맵에서 걷는 걸음 · 길이 밟는 칸의 비율.
 */
function pacing(p: Project): string[] {
  const steps = p.gameBlueprint?.steps ?? [];
  type Pt = { x: number; y: number };
  const stat = new Map<string, { walked: number; touched: Set<number>; visits: number; passes: number; lost: number; entry?: Pt }>();
  const of = (mapId: string) => { let s = stat.get(mapId); if (!s) { s = { walked: 0, touched: new Set(), visits: 0, passes: 0, lost: 0 }; stat.set(mapId, s); } return s; };
  const blockersOf = (map: GameMap) => new Set((map.events ?? []).filter((e) => (e.pages ?? []).some((pg) => (pg.priority ?? "same") === "same" && !!(pg.graphic as { sprite?: unknown } | undefined)?.sprite)).map((e) => e.y * map.width + e.x));
  const bfs = (map: GameMap, from: Pt) => {
    const key = (x: number, y: number) => y * map.width + x;
    const blockers = blockersOf(map);
    const dist = new Map<number, number>([[key(from.x, from.y), 0]]);
    const prev = new Map<number, number>();
    const queue = [from];
    for (let i = 0; i < queue.length; i += 1) {
      const c = queue[i]!;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const x = c.x + dx, y = c.y + dy;
        if (x < 0 || y < 0 || x >= map.width || y >= map.height || dist.has(key(x, y)) || !canMove(p, map, c.x, c.y, x, y)) continue;
        dist.set(key(x, y), dist.get(key(c.x, c.y))! + 1);
        prev.set(key(x, y), key(c.x, c.y));
        if (!blockers.has(key(x, y))) queue.push({ x, y });
      }
    }
    return { dist, prev };
  };
  /** 맵 사이 이동: 맵 → (이동 이벤트, 도착 맵, 도착 칸). */
  const doors = new Map<string, { ev: Ev; to: string; land: Pt }[]>();
  for (const { map, ev } of all(p)) walk(ev.pages, (c) => {
    if (c.kind !== "transfer" || typeof c.mapId !== "string" || c.mapId === map.id || !p.maps[c.mapId]) return;
    const list = doors.get(map.id) ?? [];
    if (!list.some((d) => d.ev.id === ev.id && d.to === c.mapId)) list.push({ ev, to: c.mapId, land: { x: Number(c.x), y: Number(c.y) } });
    doors.set(map.id, list);
  });
  const hops = (from: string, to: string): { ev: Ev; to: string; land: Pt }[] | undefined => {
    const prev = new Map<string, { from: string; door: { ev: Ev; to: string; land: Pt } }>();
    const queue = [from];
    const seen = new Set([from]);
    for (let i = 0; i < queue.length; i += 1) for (const door of doors.get(queue[i]!) ?? []) { if (seen.has(door.to)) continue; seen.add(door.to); prev.set(door.to, { from: queue[i]!, door }); queue.push(door.to); }
    if (!seen.has(to)) return undefined;
    const out: { ev: Ev; to: string; land: Pt }[] = [];
    for (let at = to; at !== from; at = prev.get(at)!.from) out.unshift(prev.get(at)!.door);
    return out;
  };
  /** 지금 칸에서 그 이벤트(또는 옆 칸)까지 걷고 그 칸을 돌려준다. */
  const go = (map: GameMap, at: Pt, target: Pt): Pt => {
    const s = of(map.id);
    const key = (x: number, y: number) => y * map.width + x;
    const { dist, prev } = bfs(map, at);
    const goal = [key(target.x, target.y), key(target.x, target.y + 1), key(target.x, target.y - 1), key(target.x + 1, target.y), key(target.x - 1, target.y)].filter((k) => dist.has(k)).sort((a, b) => dist.get(a)! - dist.get(b)!)[0];
    if (goal === undefined) { s.lost += 1; return at; }
    s.walked += dist.get(goal)!;
    for (let k: number | undefined = goal; k !== undefined; k = prev.get(k)) s.touched.add(k);
    return { x: goal % map.width, y: Math.floor(goal / map.width) };
  };
  let mapId = p.startMapId;
  const start = p.startPos as Pt | undefined;
  let at: Pt = start && p.maps[mapId] && isPassable(p, p.maps[mapId]!, start.x, start.y) ? start : { x: 1, y: 1 };
  of(mapId).entry = at;
  const order: string[] = [mapId];
  for (const st of steps) {
    // 지은 이벤트(built.eventId)가 먼저다 — 같은 사람의 뒤 단계는 앞 단계의 이벤트를 같이 쓰고 그 이벤트의 이름은 앞 단계의 것이다(이름으로만 찾으면 돌아가는 걸음이 빠진다).
    const builtId = (st as { built?: { eventId?: string } }).built?.eventId;
    const hit = (builtId ? all(p).find(({ ev }) => ev.id === builtId) : undefined) ?? all(p).find(({ ev }) => ev.id === st.event || named(ev) === st.event);
    if (!hit) continue;
    for (const door of hit.map.id === mapId ? [] : hops(mapId, hit.map.id) ?? []) {
      at = go(p.maps[mapId]!, at, { x: door.ev.x, y: door.ev.y });
      of(mapId).passes += 1;
      mapId = door.to;
      at = door.land;
      of(mapId).entry ??= at;
      order.push(mapId);
    }
    if (mapId !== hit.map.id) { of(hit.map.id).lost += 1; continue; }
    at = go(hit.map, at, { x: hit.ev.x, y: hit.ev.y });
    of(mapId).visits += 1;
  }
  const out: string[] = [];
  let sumWalk = 0, sumCells = 0, sumVisits = 0, sumTouched = 0;
  for (const map of Object.values(p.maps)) {
    const s = stat.get(map.id);
    if (!s) { out.push(`${(map.name ?? map.id).padEnd(12)} ${String(map.width).padStart(2)}×${String(map.height).padEnd(2)} 길이 지나지 않는다`); continue; }
    const walkable = s.entry ? bfs(map, s.entry).dist.size : 0;
    const stepEvents = new Set(steps.map((st) => st.event));
    const others = (map.events ?? []).filter((e) => !stepEvents.has(e.id) && !stepEvents.has(named(e)) && !(doors.get(map.id) ?? []).some((d) => d.ev.id === e.id) && !e.id.startsWith("ev_objective") && !e.id.startsWith("ev_locked_door")
      && (e.pages ?? []).some((pg) => (pg.commands ?? []).length && (pg.trigger as { kind?: string } | undefined)?.kind !== "auto" && (pg.trigger as { kind?: string } | undefined)?.kind !== "parallel")).length;
    const visitsHere = order.filter((id) => id === map.id).length;
    sumWalk += s.walked; sumCells += walkable; sumVisits += s.visits; sumTouched += s.touched.size;
    out.push(`${(map.name ?? map.id).padEnd(12)} ${String(map.width).padStart(2)}×${String(map.height).padEnd(2)} 걷는 칸 ${String(walkable).padStart(4)} · 꼭 들를 곳 ${s.visits}(단계) · 그 밖의 할 것 ${others} · 들어온 횟수 ${visitsHere} · 걸음 ${String(s.walked).padStart(3)} · 길이 밟는 칸 ${s.touched.size} = 걷는 칸의 ${Math.round((100 * s.touched.size) / Math.max(1, walkable))}% (안 밟는 칸 ${Math.max(0, walkable - s.touched.size)})${s.lost ? ` · 못 닿은 곳 ${s.lost}` : ""} · 들를 곳 하나당 ${s.visits ? Math.round(s.walked / s.visits) : s.walked}걸음`);
  }
  out.push(`합계: 단계 ${sumVisits} · 걸음 ${sumWalk} · 걷는 칸 ${sumCells} · 밟는 칸 ${sumTouched} = ${Math.round((100 * sumTouched) / Math.max(1, sumCells))}% · 단계 하나당 ${sumVisits ? Math.round(sumWalk / sumVisits) : 0}걸음 · 맵 순서: ${order.map((id) => p.maps[id]?.name ?? id).join(" → ")}`);
  return out;
}

const REQUEST: Record<string, string> = { desert_east: "사막 오아시스에서 벌어지는 게임 하나 만들어 줘.", snow_north: "북방 설원에서 벌어지는 게임 하나 만들어 줘." };

async function fixture(runDir: string): Promise<Project> {
  const turn = JSON.parse(fs.readFileSync(path.join(runDir, "session", "turns", "001.json"), "utf8")) as { toolArgs: { name: string; args: Obj }[] };
  const bpArgs = turn.toolArgs.find((t) => t.name === "write_blueprint")!.args;
  const pathArgs = turn.toolArgs.filter((t) => t.name === "build_blueprint_path").map((t) => t.args).find((a) => Array.isArray(a.steps) && (a.steps as unknown[]).length) ?? {};
  const kinds = new Set(((bpArgs.places ?? []) as { kind: string }[]).map((pl) => pl.kind));
  const worldId = kinds.has("oasis") || kinds.has("pyramid") ? "desert_east" : "snow_north";
  const task = REQUEST[worldId]!;
  const project = createBlankProject();
  const ctx: ToolContext = { project, currentMapId: project.startMapId, assistantRun: true };
  const session = new V2Session();
  const env = {
    ctx, request: { task, provider: "local-cli:claude", mapIds: [], project, projectKey: `["project","coherence-${path.basename(runDir)}"]` } as never,
    emit: () => {}, record: () => {}, sideChat: async () => JSON.stringify({ imagesSeen: 0, axes: {}, score: 7, majors: [] }), render: async () => "", checkpoint: async () => {},
  } as unknown as PiAssistantV2Env;
  const tools = createV2Tools(env, session);
  const call = async (name: string, args: unknown): Promise<Obj> => {
    const tool = tools.find((t) => t.name === name)!;
    const res = await tool.execute(`c-${name}`, args);
    const text = (res.content as { type: string; text?: string }[]).find((c) => c.type === "text")?.text ?? "{}";
    try { return JSON.parse(text.split("\n[")[0]!) as Obj; } catch { return { ok: false, summary: text.slice(0, 300) }; }
  };
  // 세계 검사·종류 섞임 검사는 두 번까지 돌려보낸다 — 받을 때까지 같은 청사진을 다시 낸다(모델이 한 일과 같다).
  for (let i = 0; i < 3; i += 1) { const bp = await call("write_blueprint", bpArgs); if (bp.ok) break; if (i === 2) console.log(`write_blueprint: ${String(bp.summary).slice(0, 300)}`); }
  const built = await call("build_places", {});
  const pathRes = await call("build_blueprint_path", pathArgs);
  console.log(`fixture ${path.basename(runDir)} world=${ctx.project.gameBlueprint?.setting} build_places=${built.ok} path=${pathRes.ok}`);
  console.log(`  path: ${String(pathRes.summary).slice(0, 700)}`);
  for (const m of [...session.missingArt]) console.log(`  missingArt: ${m}`);
  try { await runFinishAutoBuild(env, session); } catch (e) { console.log(`  끝맺음 예외: ${(e as Error).message.slice(0, 200)}`); }
  for (const m of [...session.missingArt]) if (m.startsWith("[art-gap]")) console.log(`  missingArt(끝맺음 뒤): ${m}`);
  return ctx.project;
}

const [mode, a, b] = process.argv.slice(2);
if (mode === "facts" || mode === "pacing") {
  const raw = JSON.parse(fs.readFileSync(a!, "utf8")) as Obj;
  const project = (raw.project ?? raw) as unknown as Project;
  if (mode === "pacing") for (const line of pacing(project)) console.log(line);
  else { const f = facts(project); for (const line of f.lines) console.log(line); console.log(JSON.stringify(f.counts)); }
} else if (mode === "fixture") {
  const project = await fixture(a!);
  if (b) fs.writeFileSync(b, JSON.stringify(project));
  const f = facts(project);
  for (const line of f.lines) console.log(line);
  console.log(JSON.stringify(f.counts));
} else console.log("usage: storyCoherenceProbe.mts facts|pacing <project.json> | fixture <run-dir> [out.json]");
