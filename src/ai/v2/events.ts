// 조수 v2 — 이벤트(컷신) 빌더.
//
// 모델은 «누가 나타나고, 누가 어디로 걷고, 무슨 말을 하는가»(EventBeat)만 쓴다. 칸 번호·이벤트 id 는 이 파일이 정한다:
//  - 등장 인물은 v1 place_npc 로 먼저 놓는다(걸어 닿는 칸, 길 안 막음). 이미 맵에 있는 같은 이름 NPC 는 그대로 쓴다.
//  - 걷기 목적지 낱말(길·광장·입구·문 앞·다른 사람 이름)은 걸어 닿는 칸/인물로 풀고, 실제 길찾기는 v1 approach 비트가 실행 순간에 한다.
//  - 한 번만 도는 자동 실행(게임 시작) 컷신은 v1 script_cutscene(trigger auto, once) 이 만든다.
//  - 만든 페이지는 v1 probeCutscene 으로 한 번 돌려 보고, 그 문제 목록을 warnings 에 싣는다.
// «나타남»은 컷신 비트에 따로 없다 — 처음에 투명(look alpha 0)으로 두었다가 그 순간 alpha 1 로 켠다(걸어 들어오는 게 아니라 «팍» 나타남).
import type { Command, GameEvent, GameMap, Project } from "@/project/types";
import { probeCutscene } from "@/editor/cutscenePreview/probe";
import { dist, edgeExitCells, eventBlockers, eventsOf, findMap, graphicQueries, resolveWhere, shortestPathCells, transferCells, walkReach, walkStart } from "./people";
import type { BuildRun, ContentBuildResult, EventBeat, EventSpec } from "./types";

export const EVENT_CARD =
  "이벤트(events) 명세: {kind:'cutscene'|'talk'|'trigger', when?:'game-start'|'touch'|'talk', mapId?, where?, at?, beats:[…]}. " +
  "cutscene+game-start = 게임이 시작되면 한 번만 자동 재생(시작 맵). 비트 do: " +
  "walk{who,to}=걷기(to=길·광장·입구·문 앞 같은 자리 낱말, 다른 사람 이름이면 그 곁으로, {x,y} 는 꼭 필요할 때만) / " +
  "say{who,text}=대사 / appear{who,where,looks?}=그 자리에 «팍» 나타남(걸어 들어오기 아님) / face{who,toward}=바라봄 / wait{ms} / fade{dir:'in'|'out'}. " +
  "who: 주인공·player·hero = 플레이어, 그 밖의 이름 = 컷신에 나타나는 사람(appear 로 먼저 등장시키거나 맵에 이미 있는 NPC 이름). " +
  "컷신이 끝나도 나타난 사람은 그 자리에 서 있다. 빌더가 걸어 닿는 칸만 쓰고 만든 뒤 컷신 검사(probe)를 돌려 문제를 알린다.";

type Cell = { x: number; y: number };

const HERO = /^(주인공|플레이어|용사|player|hero|protagonist)$/i;
const ROAD = /^(길|도로|큰길|길가|길 ?위|road|street|path|way)$/i;

function isHero(who: string): boolean {
  return HERO.test(who.trim());
}

/** 시작 지점에서 «입구»(맵 가장자리 출구) 쪽으로 난 길 위의 칸 — n 걸음 앞. */
function roadCell(project: Project, map: GameMap, n: number, avoid: ReadonlySet<number>): Cell | undefined {
  const w = map.width;
  const start = walkStart(project, map);
  const blockers = eventBlockers(map);
  const reach = walkReach(project, map, start, blockers);
  const exit = edgeExitCells(map, reach)
    .filter((c) => dist(c, start) > 1)
    .sort((x, y) => dist(x, start) - dist(y, start))[0];
  if (!exit) return undefined;
  // 입구 → 시작 최단 경로를 시작에서부터 걷는 순서로 되짚는다.
  const onPath = shortestPathCells(project, map, start, exit, blockers);
  const transfers = new Set(transferCells(map).map((c) => c.y * w + c.x));
  const cells = [...onPath]
    .map((i) => ({ x: i % w, y: Math.floor(i / w) }))
    .filter((c) => !(c.x === start.x && c.y === start.y) && !avoid.has(c.y * w + c.x) && !transfers.has(c.y * w + c.x))
    .sort((a, b) => dist(a, start) - dist(b, start));
  return cells[Math.min(Math.max(n - 1, 0), cells.length - 1)];
}

interface Actor {
  readonly name: string;
  eventId: string;
  cell?: Cell;
  hidden: boolean;
}

function findNpcByName(map: GameMap, name: string): GameEvent | undefined {
  const want = name.trim().toLowerCase();
  return eventsOf(map).find((e) => (e.name ?? "").trim().toLowerCase() === want);
}

export function buildEvent(run: BuildRun, spec: EventSpec): ContentBuildResult {
  const firstCall = run.calls.length;
  const warnings: string[] = [];
  const fail = (summary: string, mapIds: string[] = []): ContentBuildResult => ({
    ok: false, mapIds, summary, warnings, missingArt: [], calls: run.calls.slice(firstCall),
  });

  const when = spec.when ?? (spec.kind === "talk" ? "talk" : spec.kind === "trigger" ? "touch" : "game-start");
  const mapId = spec.mapId ?? run.ctx.project.startMapId;
  let map = findMap(run.ctx.project, mapId);
  if (!map) return fail(`맵 '${mapId}' 이 없다.`);
  if (spec.beats.length === 0) return fail("비트가 비었다.");
  if (when === "game-start" && mapId !== run.ctx.project.startMapId) {
    warnings.push(`game-start 는 시작 맵(${run.ctx.project.startMapId}) 에서만 게임이 열 때 돈다 — '${mapId}' 의 자동 컷신은 그 맵에 들어갈 때 돈다.`);
  }

  // 1) 등장 인물 모으기.
  const actors = new Map<string, Actor>();
  const appearBeat = new Map<string, Extract<EventBeat, { do: "appear" }>>();
  const names: string[] = [];
  const noteName = (n: string): void => { if (!isHero(n) && !names.includes(n)) names.push(n); };
  for (const b of spec.beats) {
    if (b.do === "appear") { noteName(b.who); if (!appearBeat.has(b.who)) appearBeat.set(b.who, b); }
    else if (b.do === "say" || b.do === "walk" || b.do === "face") {
      noteName(b.who);
      if (b.do === "walk" && typeof b.to === "string") { /* 사람 이름일 수 있어 아래에서 판정 */ }
    }
  }
  const knownName = (s: string): boolean => names.includes(s) || !!findNpcByName(map!, s);
  for (const b of spec.beats) {
    if (b.do === "walk" && typeof b.to === "string" && !isHero(b.to) && !ROAD.test(b.to) && knownName(b.to)) noteName(b.to);
    if (b.do === "face" && !isHero(b.toward) && knownName(b.toward)) noteName(b.toward);
  }

  const used: Cell[] = [];
  for (const name of names) {
    const ab = appearBeat.get(name);
    const existing = findNpcByName(map, name);
    if (existing && !ab) {
      actors.set(name, { name, eventId: existing.id, cell: { x: existing.x, y: existing.y }, hidden: false });
      used.push({ x: existing.x, y: existing.y });
      continue;
    }
    if (existing && ab) warnings.push(`${name}: 맵에 같은 이름 NPC 가 이미 있어 그 사람을 나타나게 한다(새로 만들지 않는다).`);
    if (existing) {
      actors.set(name, { name, eventId: existing.id, cell: { x: existing.x, y: existing.y }, hidden: true });
      used.push({ x: existing.x, y: existing.y });
      continue;
    }
    // 새로 놓기.
    const whereWord = ab ? (typeof ab.where === "string" ? ab.where : undefined) : undefined;
    const whereAt = ab && typeof ab.where !== "string" ? ab.where : undefined;
    if (!ab) warnings.push(`${name}: appear 비트가 없고 맵에도 없어 기본 자리에 새로 놓고 처음부터 보이게 둔다.`);
    const w = ab && typeof ab.where === "string" && ROAD.test(ab.where.trim())
      ? (() => {
          const c = roadCell(run.ctx.project, map!, 6, new Set(used.map((u) => u.y * map!.width + u.x)));
          return c ? { cell: c as Cell, note: undefined as string | undefined } : resolveWhere(run.ctx.project, map!, undefined, { avoid: used });
        })()
      : resolveWhere(run.ctx.project, map, whereWord, { at: whereAt, avoid: used });
    if (w.note) warnings.push(`${name}: ${w.note}`);
    const base: Record<string, unknown> = { mapId, name, x: w.cell.x, y: w.cell.y, movement: "fixed" };
    const queries = graphicQueries(ab?.looks, name);
    let r: ReturnType<BuildRun["call"]> | undefined;
    for (const q of queries) {
      r = run.call("place_npc", { ...base, graphic: { query: q } });
      if (r.ok) break;
    }
    if (!r?.ok) {
      r = run.call("place_npc", base);
      if (r.ok) warnings.push(`${name}: 그림을 못 골라 도구 기본 그림으로 놓았다.`);
    }
    if (!r.ok) return fail(`${name} 을(를) 놓지 못했다 — ${String(r.summary).slice(0, 160)}`, [mapId]);
    const d = (r.data ?? {}) as { eventId?: string; x?: number; y?: number };
    if (!d.eventId) return fail(`${name}: place_npc 가 이벤트 id 를 안 돌려줬다.`, [mapId]);
    const cell = { x: d.x ?? w.cell.x, y: d.y ?? w.cell.y };
    used.push(cell);
    actors.set(name, { name, eventId: d.eventId, cell, hidden: !!ab });
    map = findMap(run.ctx.project, mapId) ?? map;
  }

  // 2) 비트 → script_cutscene 비트.
  const start = walkStart(run.ctx.project, map);
  const avoidSet = (): Set<number> => new Set(used.map((u) => u.y * map!.width + u.x));
  const idOf = (who: string): string | undefined => (isHero(who) ? "player" : actors.get(who)?.eventId);
  const out: Record<string, unknown>[] = [];
  // 나타나는 사람은 처음에 투명.
  for (const a of actors.values()) if (a.hidden) out.push({ kind: "look", target: a.eventId, alpha: 0 });

  const cellFor = (to: string | Cell, who: string): Cell | undefined => {
    if (typeof to !== "string") {
      const r = resolveWhere(run.ctx.project, map!, undefined, { at: to, avoid: used });
      if (r.note) warnings.push(`${who}: ${r.note}`);
      return r.cell;
    }
    if (ROAD.test(to.trim())) {
      const c = roadCell(run.ctx.project, map!, 5, avoidSet());
      if (c) return c;
      warnings.push(`${who}: '길' 로 걸을 길을 못 찾아 시작 근처로 갔다.`);
    }
    const r = resolveWhere(run.ctx.project, map!, to, { avoid: used });
    if (r.note) warnings.push(`${who}: ${r.note}`);
    return r.cell;
  };

  for (const b of spec.beats) {
    switch (b.do) {
      case "appear": {
        const id = idOf(b.who);
        if (!id || isHero(b.who)) { warnings.push(`appear: '${b.who}' 은 나타날 수 있는 사람이 아니다(주인공은 처음부터 있다).`); break; }
        out.push({ kind: "look", target: id, alpha: 1 });
        out.push({ kind: "wait", ms: 300 });
        break;
      }
      case "walk": {
        const id = idOf(b.who);
        if (!id) { warnings.push(`walk: 누군지 모르는 '${b.who}'.`); break; }
        if (typeof b.to === "string" && !ROAD.test(b.to.trim())) {
          const targetId = isHero(b.to) ? "player" : actors.get(b.to)?.eventId;
          if (targetId && targetId !== id) { out.push({ kind: "approach", actor: id, target: targetId, distance: 1, wait: true }); break; }
        }
        const c = cellFor(b.to, b.who);
        if (!c) { warnings.push(`walk: ${b.who} 의 목적지를 못 풀었다.`); break; }
        out.push({ kind: "approach", actor: id, x: c.x, y: c.y, distance: 0, wait: true });
        break;
      }
      case "say": {
        const id = idOf(b.who);
        if (!id) { warnings.push(`say: 누군지 모르는 '${b.who}'.`); break; }
        const beat: Record<string, unknown> = { kind: "say", text: b.text, actor: id };
        if (!isHero(b.who)) beat.speaker = b.who;
        out.push(beat);
        break;
      }
      case "face": {
        const id = idOf(b.who);
        if (!id) { warnings.push(`face: 누군지 모르는 '${b.who}'.`); break; }
        const t = isHero(b.toward) ? "player" : actors.get(b.toward)?.eventId;
        if (t) out.push({ kind: "faceToward", actor: id, target: t });
        else {
          const c = cellFor(b.toward, b.who);
          if (c) out.push({ kind: "faceToward", actor: id, x: c.x, y: c.y });
        }
        break;
      }
      case "wait":
        out.push({ kind: "wait", ms: Math.max(0, Math.round(b.ms)) });
        break;
      case "fade":
        out.push({ kind: "fade", direction: b.dir, durationMs: 600, wait: true });
        break;
    }
  }
  if (out.length === 0) return fail("옮길 수 있는 비트가 하나도 없다.", [mapId]);

  // 3) 컷신 이벤트 자리(보이지 않는 연출 이벤트) — 사람·주인공 칸을 피한 빈 칸.
  const trigger = when === "game-start" ? "auto" : when === "talk" ? "action" : "playerTouch";
  const hostCell = resolveWhere(run.ctx.project, map, when === "game-start" ? undefined : spec.where, { at: spec.at, avoid: [...used, start] });
  if (hostCell.note && when !== "game-start") warnings.push(`컷신 자리: ${hostCell.note}`);
  const args: Record<string, unknown> = {
    mapId, x: hostCell.cell.x, y: hostCell.cell.y, trigger, beats: out, skippable: true, mode: "replace",
    once: when === "game-start" || when === "touch",
  };
  const cut = run.call("script_cutscene", args);
  for (const w of cut.warnings ?? []) warnings.push(`컷신: ${w}`);
  if (!cut.ok) return fail(`컷신을 만들지 못했다 — ${String(cut.summary).slice(0, 200)}`, [mapId]);
  const cd = (cut.data ?? {}) as { eventId?: string; pageId?: string; commandCount?: number; unsupportedCommands?: unknown };
  if (!cd.eventId) return fail("script_cutscene 가 이벤트 id 를 안 돌려줬다.", [mapId]);
  if (Array.isArray(cd.unsupportedCommands) && cd.unsupportedCommands.length > 0) warnings.push(`지원 안 되는 명령: ${JSON.stringify(cd.unsupportedCommands).slice(0, 160)}`);

  // 4) 컷신 검사(probe).
  const after = findMap(run.ctx.project, mapId);
  const ev = after ? eventsOf(after).find((e) => e.id === cd.eventId) : undefined;
  const page = ev?.pages?.find((p) => (cd.pageId ? p.id === cd.pageId : p.name === "컷신")) ?? ev?.pages?.[0];
  const commands = ((page?.commands ?? ev?.commands ?? []) as Command[]);
  let probeNote = "";
  if (commands.length > 0) {
    try {
      const p = probeCutscene(run.ctx.project, commands, { width: 640, height: 360 });
      for (const issue of p.issues) warnings.push(`probe: ${issue}`);
      probeNote = ` · probe ${Math.round(p.durationMs / 100) / 10}초, 대사 ${p.sayCount}줄, 문제 ${p.issues.length}`;
    } catch (e) {
      warnings.push(`probe 실행 실패: ${String((e as Error).message ?? e).slice(0, 120)}`);
    }
  } else {
    warnings.push("만든 페이지에서 명령을 못 읽어 probe 를 돌리지 못했다.");
  }
  for (const a of actors.values()) if (a.hidden) warnings.push(`${a.name}: 처음 놓인 자리는 (${a.cell?.x},${a.cell?.y}) — 컷신이 옮긴 뒤 어디에 남는지는 v1 컷신 규칙에 따르고 여기서 보장하지 않는다.`);

  const eventIds = [{ mapId, eventId: cd.eventId }, ...[...actors.values()].map((a) => ({ mapId, eventId: a.eventId }))];
  return {
    ok: true,
    mapIds: [mapId],
    summary: `컷신 '${cd.eventId}' (${trigger}${out.length ? `, 비트 ${out.length}` : ""}, ${when === "game-start" ? "한 번만" : when}) 을 ${mapId} (${hostCell.cell.x},${hostCell.cell.y}) 에 만듦${probeNote}`,
    warnings,
    missingArt: [],
    calls: run.calls.slice(firstCall),
    eventIds,
  };
}
