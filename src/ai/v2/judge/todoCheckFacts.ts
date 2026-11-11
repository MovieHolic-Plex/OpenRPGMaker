// 할 일 검사가 같이 쓰는 읽기 — 명령 걷기·살아 있는 쪽·이름으로 대상 고르기·범위(refs/fresh)·맵 사이 걷기·보스 판정. 판정 글 언어(ko/en)도 여기서 고른다.
import { isPassable } from "@/project/collision";
import type { GameEvent, GameMap, Project } from "@/project/types";
import { findShadowedPages } from "@/project/eventPageShadow";
import { findSetterShadowedPages, projectSwitchSetterLists } from "@/project/eventPageSetterShadow";
import { writtenStateIds } from "./shipChecks";
import { anchorsOf, bodyReached } from "./eventReach";
import { puzzleFlow } from "./puzzleGates";
import { hint, nameScore, normName } from "../todo/names";
import type { CheckResult, TodoCheck, TodoCheckContext, TodoPlaceKind } from "../todo/types";

export type Obj = Record<string, unknown>;

export type Cmd = Obj & { kind: string };

// 판정 글 언어: 사람이 보는 보고·장부는 한국어(detail), 모델이 받는 글은 영어(en, 2026-10-30 사용자 결정).
// runTodoItemCheck 가 같은 판정을 두 번(ko·en) 돌려 둘 다 싣는다 — 글 조립만 다르고 판정은 같다.
let EN = false;

/** 판정 글 언어를 바꾼다 — 같은 판정을 영어로 한 번 더 돌릴 때만 켠다(runTodoItemCheck). */
export const setEnglish = (on: boolean): void => { EN = on; };

export const t = (ko: string, en: string): string => (EN ? en : ko);

// ───────────── 명령 걷기 ─────────────

/** 명령 목록 속 모든 명령(갈래·선택지·전투 결과 갈래·증거 제시 갈래 안까지). 조건 객체는 건너뛴다. */
export function walk(node: unknown, visit: (c: Cmd) => void): void {
  if (Array.isArray(node)) { for (const n of node) walk(n, visit); return; }
  if (!node || typeof node !== "object") return;
  const r = node as Obj;
  if (typeof r.kind === "string") visit(r as Cmd);
  for (const [k, v] of Object.entries(r)) {
    if (k === "condition" || k === "conditions" || k === "route") continue;
    if (v && typeof v === "object") walk(v, visit);
  }
}

const eventCmds = (ev: GameEvent): Cmd[] => {
  const out: Cmd[] = [];
  walk((ev as unknown as Obj).commands, (c) => out.push(c));
  for (const p of ev.pages ?? []) walk(p.commands, (c) => out.push(c));
  return out;
};

const commonCmds = (project: Project, id: string): Cmd[] => {
  const ce = (project.commonEvents ?? []).find((c) => (c as unknown as Obj).id === id) as unknown as Obj | undefined;
  const out: Cmd[] = [];
  if (ce) walk(ce.commands, (c) => out.push(c));
  return out;
};

/** 이벤트가 부르는 공통 이벤트까지 펼친 명령(한 단계). */
export function deepCmds(project: Project, ev: GameEvent): Cmd[] {
  const own = eventCmds(ev);
  const more = own.filter((c) => c.kind === "callCommonEvent" && typeof c.commonEventId === "string").flatMap((c) => commonCmds(project, String(c.commonEventId)));
  return [...own, ...more];
}

// ───────────── 페이지가 살아 있나 ─────────────
// 런타임은 조건이 맞는 마지막 페이지 하나만 돈다. 가려진 페이지·아무도 켜지 않는 스위치/주지 않는 아이템을 기다리는 페이지의 명령은
// 「있다」로 세지 않는다(2026-10-30 b3 interrogation: 증거 내밀기 페이지가 있어도 판정자는 선택지를 한 번도 못 봤다 — 이런 꼴을 잡는다).

interface Live { written: Set<string>; given: Set<string>; setters: Set<string>[]; startOn: Set<string> }

const liveCache = new WeakMap<Project, Live>();

export function liveFacts(project: Project): Live {
  let f = liveCache.get(project);
  if (f) return f;
  const given = new Set<string>();
  const ids = (node: unknown) => JSON.stringify(node ?? null).replace(/"itemId":"([^"]+)"/gu, (m, id: string) => { given.add(id); return m; });
  // 얻는 길: 아이템 넣기 명령, 상점 품목, 적 드롭.
  const gives = (c: Cmd) => { if (c.kind === "changeItem" && (c.op === "+=" || c.op === "=") && typeof c.itemId === "string") given.add(c.itemId); else if (/shop/iu.test(c.kind)) ids(c); };
  for (const map of Object.values(project.maps)) for (const ev of map.events ?? []) eventCmds(ev).forEach(gives);
  for (const ce of (project.commonEvents ?? []) as unknown as Obj[]) walk(ce.commands, gives);
  for (const [id, n] of Object.entries(((project.session as unknown as Obj | undefined)?.items as Record<string, number> | undefined) ?? {})) if (n > 0) given.add(id);
  for (const e of project.database.enemies ?? []) ids((e as unknown as Obj).drops ?? (e as unknown as Obj).dropItems);
  f = {
    written: writtenStateIds(project).switches,
    given,
    setters: projectSwitchSetterLists(project),
    startOn: new Set(Object.entries(project.session?.switches ?? {}).filter(([, on]) => on === true).map(([id]) => id)),
  };
  liveCache.set(project, f);
  return f;
}

/** 페이지마다 영영 안 도는 까닭(살아 있으면 undefined). 이벤트마다 한 번 잰다. */
const deadCacheKo = new WeakMap<GameEvent, (string | undefined)[]>();

const deadCacheEn = new WeakMap<GameEvent, (string | undefined)[]>();

function deadPages(project: Project, ev: GameEvent): (string | undefined)[] {
  const deadCache = EN ? deadCacheEn : deadCacheKo;
  const hit = deadCache.get(ev);
  if (hit) return hit;
  const pages = ev.pages ?? [];
  const f = liveFacts(project);
  const out: (string | undefined)[] = pages.map(() => undefined);
  if (pages.length > 1) {
    for (const sh of findShadowedPages(pages)) out[sh.index] ??= t(`페이지 ${sh.index + 1} 은 뒤 페이지 ${sh.byIndex + 1}(조건이 같거나 더 적다)에 가려 영영 안 돈다`, `page ${sh.index + 1} is shadowed by later page ${sh.byIndex + 1} (same or fewer conditions) and never runs`);
    for (const ss of findSetterShadowedPages(pages, f.setters, f.startOn)) out[ss.index] ??= t(`페이지 ${ss.index + 1} 의 스위치 ${ss.switchIds.join("·")} 를 켜는 곳이 모두 페이지 ${ss.byIndex + 1} 조건(${ss.bySwitchIds.join("·")})도 켜서 영영 안 돈다`, `page ${ss.index + 1} never runs: everything that turns on switch ${ss.switchIds.join("+")} also turns on page ${ss.byIndex + 1}'s condition (${ss.bySwitchIds.join("+")})`);
  }
  pages.forEach((page, index) => {
    if (out[index]) return;
    const missing: string[] = [];
    const visit = (c: unknown): void => {
      const r = c as Obj | undefined;
      if (!r || typeof r !== "object") return;
      if (r.kind === "switch" && r.value !== false && typeof r.switchId === "string" && !f.written.has(r.switchId)) missing.push(t(`스위치 ${r.switchId}(켜는 곳 없음)`, `switch ${r.switchId} (nothing turns it on)`));
      if (r.kind === "item" && r.present !== false && typeof r.itemId === "string" && !f.given.has(r.itemId)) missing.push(t(`아이템 ${r.itemId}(주는 곳 없음)`, `item ${r.itemId} (nothing gives it)`));
      if (r.kind === "all" && Array.isArray(r.conditions)) r.conditions.forEach(visit);
    };
    (page.conditions ?? []).forEach(visit);
    if (missing.length) out[index] = t(`페이지 ${index + 1} 조건 ${missing.join(", ")}`, `page ${index + 1} condition: ${missing.join(", ")}`);
  });
  deadCache.set(ev, out);
  return out;
}

/** 살아 있는 페이지의 명령(부르는 공통 이벤트 속까지)과, 죽은 페이지에만 있는 명령의 까닭. */
export function liveCmds(project: Project, ev: GameEvent): { cmds: Cmd[]; dead: { why: string; cmds: Cmd[] }[] } {
  const cmds: Cmd[] = [];
  const dead: { why: string; cmds: Cmd[] }[] = [];
  walk((ev as unknown as Obj).commands, (c) => cmds.push(c));
  (ev.pages ?? []).forEach((page, i) => {
    const list: Cmd[] = [];
    walk(page.commands, (c) => list.push(c));
    for (const c of [...list]) if (c.kind === "callCommonEvent" && typeof c.commonEventId === "string") list.push(...commonCmds(project, c.commonEventId));
    const why = deadPages(project, ev)[i];
    if (why) dead.push({ why, cmds: list }); else cmds.push(...list);
  });
  return { cmds, dead };
}

/** 맵들의 살아 있는 페이지에서 pred 가 맞는 명령, 그리고 죽은 페이지에만 있던 것과 그 까닭. */
export function scanLive(project: Project, maps: readonly GameMap[], pred: (c: Cmd, ev: GameEvent) => boolean): { hits: { map: GameMap; ev: GameEvent; c: Cmd }[]; dead: { map: GameMap; ev: GameEvent; why: string }[] } {
  const hits: { map: GameMap; ev: GameEvent; c: Cmd }[] = [];
  const dead: { map: GameMap; ev: GameEvent; why: string }[] = [];
  for (const map of maps) for (const ev of map.events ?? []) {
    const live = liveCmds(project, ev);
    for (const c of live.cmds) if (pred(c, ev)) hits.push({ map, ev, c });
    for (const d of live.dead) if (d.cmds.some((c) => pred(c, ev))) dead.push({ map, ev, why: d.why });
  }
  return { hits, dead };
}

export const deadNote = (dead: readonly { map: GameMap; ev: GameEvent; why: string }[]) =>
  dead.length ? t(` — 영영 안 도는 페이지에만 있다: ${dead.slice(0, 2).map((d) => `${at(d.map, d.ev)} ${d.why}`).join(" / ")}`, ` — only on pages that never run: ${dead.slice(0, 2).map((d) => `${at(d.map, d.ev)} ${d.why}`).join(" / ")}`) : "";

const trigOf = (ev: GameEvent, p: { trigger?: unknown }): string => {
  const t = p.trigger ?? (ev as unknown as Obj).trigger;
  return typeof t === "string" ? t : String((t as { kind?: string } | undefined)?.kind ?? "action");
};

export const isAuto = (ev: GameEvent) => (ev.pages ?? []).some((p) => { const t = trigOf(ev, p); return t === "auto" || t === "parallel"; });

// ───────────── 이름·대상 ─────────────

export const mapLabel = (m: GameMap) => String((m as unknown as Obj).displayName ?? "").trim() || String(m.name ?? m.id);

const mapNamesOf = (m: GameMap): string[] => [String(m.name ?? ""), String((m as unknown as Obj).displayName ?? ""), m.id].filter(Boolean);

export const evLabel = (ev: GameEvent) => String(ev.name ?? "").trim() || ev.id;

export const at = (m: GameMap, ev: GameEvent) => EN ? `"${mapLabel(m)}" "${evLabel(ev)}"(${ev.x},${ev.y}) [${ev.id}]` : `「${mapLabel(m)}」 「${evLabel(ev)}」(${ev.x},${ev.y}) [${ev.id}]`;

export const mapAt = (m: GameMap) => EN ? `"${mapLabel(m)}" [${m.id}]` : `「${mapLabel(m)}」 [${m.id}]`;

/** 이름 따옴표(한국어 「」, 영어 ""). */
export const q = (s: string) => (EN ? `"${s}"` : `「${s}」`);

export const evKey = (m: GameMap, ev: GameEvent) => `${m.id}:${ev.id}`;

export const evEvidence = (m: GameMap, ev: GameEvent) => ({ mapId: m.id, eventId: ev.id, x: ev.x, y: ev.y });

/** 이 이벤트를 부르는 이름: 자기 이름·id(앞), 대사 화자·건 전투의 적 그룹·적·인물 프로필 이름(뒤). */
export function eventNameTiers(project: Project, ev: GameEvent): { primary: string[]; secondary: string[] } {
  const primary = [String(ev.name ?? ""), ev.id].filter(Boolean);
  const secondary = new Set<string>();
  for (const c of deepCmds(project, ev)) {
    if (c.kind === "text" && typeof c.speaker === "string" && c.speaker.trim()) secondary.add(c.speaker.trim());
    if (c.kind === "battleProcessing") for (const n of troopNames(project, c.troopId)) secondary.add(n);
  }
  const cid = (ev as unknown as Obj).characterId;
  if (typeof cid === "string") { secondary.add(cid); const prof = (project.characters ?? {})[cid] as Obj | undefined; if (typeof prof?.name === "string") secondary.add(prof.name); }
  return { primary, secondary: [...secondary] };
}

export interface Named<T> { t: T; id: string; label: string; primary: string[]; secondary?: string[] }

type Chosen<T> = { ok: true; picked: Named<T>[]; matched: string } | { ok: false; result: CheckResult };

/** 점수: 자기 이름 같음 4 > 딸린 이름 같음 3 > 자기 이름 부분 2 > 딸린 이름 부분 1. */
export function scoreNamed<T>(want: string, n: Named<T>): { s: number; name: string } {
  let best = { s: 0, name: "" };
  const tier = (names: readonly string[], exact: number, part: number) => {
    for (const name of names) {
      const r = nameScore(want, name);
      const s = r === 3 ? exact : r === 2 ? part : 0;
      if (s > best.s) best = { s, name };
    }
  };
  tier(n.primary, 4, 2);
  tier(n.secondary ?? [], 3, 1);
  return best;
}

/**
 * 이름으로 고르기. 가장 높은 점수의 후보들이 서로 다른 이름이면 「모호함」 실패. 같은 이름 무리면 무리 전체를 돌려준다.
 * 후보가 하나뿐이면(refs 로 묶인 대상 하나) 이름이 안 맞아도 그것을 고른다 — 이름은 refs 안에서 고르는 데만 쓴다.
 */
export function choose<T>(want: string, cands: readonly Named<T>[], what: string, bound: boolean, allNames: () => Iterable<string>): Chosen<T> {
  if (bound && cands.length === 1) return { ok: true, picked: [...cands], matched: cands[0]!.label };
  const scored = cands.map((c) => ({ c, ...scoreNamed(want, c) })).filter((x) => x.s > 0);
  if (!scored.length) return { ok: false, result: { pass: false, detail: t(`${what} 「${want}」 이 없다.`, `no ${WHAT_EN[what] ?? what} "${want}".`) + hint(want, bound ? cands.map((c) => c.label) : allNames(), EN) } };
  const top = Math.max(...scored.map((x) => x.s));
  const tops = scored.filter((x) => x.s === top);
  const groups = new Map<string, typeof tops>();
  for (const x of tops) { const k = normName(x.name, true); groups.set(k, [...(groups.get(k) ?? []), x]); }
  if (groups.size > 1) {
    const list = [...groups.values()].map((g) => `${q(g[0]!.name)}(${g.map((x) => x.c.id).slice(0, 3).join(", ")})`).slice(0, 4).join(" · ");
    return { ok: false, result: { pass: false, detail: t(`모호함: ${what} 「${want}」 후보 ${list} — 이름을 정확히 쓰거나 todo 에 refs 로 묶어라`, `ambiguous: ${WHAT_EN[what] ?? what} "${want}" candidates ${list} — use the exact name or bind it with todo bind`) } };
  }
  return { ok: true, picked: tops.map((x) => x.c), matched: tops[0]!.name };
}

/** 판정 대상 범위(refs → fresh·changed → 전부). note 는 왜 좁혔는지. */
export interface Scope { refs?: TodoCheckContext["refs"]; changed?: TodoCheckContext["changed"]; fresh: boolean }

export const scopeOf = (check: TodoCheck, ctx: TodoCheckContext): Scope => ({ refs: ctx.refs, changed: ctx.changed, fresh: !!check.fresh });

export const has = (a?: readonly string[]) => !!a && a.length > 0;

export const refEvent = (sc: Scope, m: GameMap, ev: GameEvent) => sc.refs!.eventIds!.some((r) => r === ev.id || r === evKey(m, ev));

export const freshOnly = (sc: Scope) => sc.fresh && !!sc.changed;

/** 이 이벤트가 이 항목의 판정 대상인가(refs 의 eventIds, 아니면 fresh 면 이번 턴에 바뀐 이벤트). */
export function eventInScope(sc: Scope, m: GameMap, ev: GameEvent, alsoTroop?: unknown): boolean {
  if (has(sc.refs?.eventIds) || has(sc.refs?.troopIds)) return (has(sc.refs?.eventIds) && refEvent(sc, m, ev)) || (alsoTroop !== undefined && !!sc.refs?.troopIds?.includes(String(alsoTroop)));
  if (freshOnly(sc)) return sc.changed!.eventKeys.has(evKey(m, ev)) || (alsoTroop !== undefined && sc.changed!.troopIds.has(String(alsoTroop)));
  return true;
}

export const eventBound = (sc: Scope) => has(sc.refs?.eventIds);

export function mapInScope(sc: Scope, m: GameMap): boolean {
  if (has(sc.refs?.mapIds)) return sc.refs!.mapIds!.includes(m.id);
  if (freshOnly(sc)) return sc.changed!.mapIds.has(m.id);
  return true;
}

export function itemInScope(sc: Scope, id: string): boolean {
  if (has(sc.refs?.itemIds)) return sc.refs!.itemIds!.includes(id);
  if (freshOnly(sc)) return sc.changed!.itemIds.has(id);
  return true;
}

/** 범위가 좁혀져 비었을 때 덧붙이는 말. */
export const scopeNote = (sc: Scope, kind: "맵" | "이벤트" | "아이템") =>
  has(sc.refs?.mapIds) || has(sc.refs?.eventIds) || has(sc.refs?.itemIds) || has(sc.refs?.troopIds) ? t(` (묶인 대상 안에서 찾았다)`, ` (searched only the bound targets)`)
    : freshOnly(sc) ? t(` (이번 턴에 새로 생기거나 바뀐 ${kind}만 본다 — 원래 있던 것은 이 항목을 통과시키지 않는다)`, ` (only ${WHAT_EN[kind] ?? kind}s created or changed this turn count — pre-existing ones do not pass this item)`) : "";

/** choose()·scopeNote 의 「무엇」 낱말 → 영어. */
const WHAT_EN: Record<string, string> = { 맵: "map", 이벤트: "event", 아이템: "item", 장소: "place", 인물: "person", "말하는 인물": "speaker", "전투 상대": "battle opponent", "출발 맵": "start map", "도착 맵": "destination map", "증거 아이템": "evidence item", "증거를 받을 인물": "person receiving the evidence", 목표: "target", "실내 맵": "interior map" };

/** 묶인 id 가운데 프로젝트에 없는 것. */
export function missingRefs(project: Project, refs: TodoCheckContext["refs"]): string[] {
  if (!refs) return [];
  const out: string[] = [];
  for (const id of refs.mapIds ?? []) if (!project.maps[id]) out.push(t(`맵 ${id}`, `map ${id}`));
  const evs = new Set<string>();
  for (const m of Object.values(project.maps)) for (const ev of m.events ?? []) { evs.add(ev.id); evs.add(evKey(m, ev)); }
  for (const id of refs.eventIds ?? []) if (!evs.has(id)) out.push(t(`이벤트 ${id}`, `event ${id}`));
  for (const id of refs.itemIds ?? []) if (!project.database.items.some((i) => i.id === id)) out.push(t(`아이템 ${id}`, `item ${id}`));
  for (const id of refs.troopIds ?? []) if (!project.database.troops.some((tr) => tr.id === id)) out.push(t(`적 그룹 ${id}`, `troop ${id}`));
  return out;
}

export const mapNamed = (m: GameMap): Named<GameMap> => ({ t: m, id: m.id, label: mapLabel(m), primary: mapNamesOf(m) });

export const allMapNames = (project: Project) => Object.values(project.maps).map(mapLabel);

/** 판정 대상이 아닌 맵 이름(link 의 출발 맵, map 좁히기 등)을 고른다 — 모호하면 실패. */
export function resolveMaps(project: Project, want: string, what = "맵"): Chosen<GameMap> {
  return choose(want, Object.values(project.maps).map(mapNamed), what, false, () => allMapNames(project));
}

export const isResult = (x: unknown): x is CheckResult => !!x && typeof x === "object" && "pass" in x && "detail" in x;

/** map 으로 좁히기: 이름이 주어졌으면 그 맵(들), 아니면 전부. */
export function scopeMaps(project: Project, map: string | undefined): GameMap[] | CheckResult {
  if (!map) return Object.values(project.maps);
  const r = resolveMaps(project, map);
  return r.ok ? r.picked.map((p) => p.t) : r.result;
}

export interface EvRef { map: GameMap; ev: GameEvent }

export const evNamed = (project: Project, h: EvRef): Named<EvRef> => ({ t: h, id: h.ev.id, label: evLabel(h.ev), ...eventNameTiers(project, h.ev) });

export const eventNameList = (maps: readonly GameMap[], filter: (ev: GameEvent) => boolean = () => true) =>
  maps.flatMap((m) => (m.events ?? []).filter(filter).map((ev) => String(ev.name ?? "")).filter(Boolean));

// ───────────── 걷기 ─────────────

interface Walk { reach: Map<string, Uint8Array>; maps: Set<string>; via: Map<string, string> }

/** 맵 안 걷기(퍼즐 문 열기 포함). 앵커가 없으면 undefined. */
export function mapReach(project: Project, map: GameMap, anchors?: { x: number; y: number }[]): Uint8Array | undefined {
  const a = anchors ?? anchorsOf(project, map);
  if (!a.length) return undefined;
  return puzzleFlow(project, map.id, { anchors: a })?.reach;
}

/** 이 이벤트에 플레이어가 닿는가(자동·병렬 실행은 맵에 닿으면 된다). */
export function eventReached(map: GameMap, reach: Uint8Array | undefined, ev: GameEvent): boolean {
  if (isAuto(ev)) return true;
  return !!reach && bodyReached(map, reach, ev);
}

/** 이 맵 이벤트들의 다른 맵 이동(이벤트, 도착). */
export function transfersOut(map: GameMap): { ev: GameEvent; to: { mapId: string; x: number; y: number } }[] {
  const out: { ev: GameEvent; to: { mapId: string; x: number; y: number } }[] = [];
  for (const ev of map.events ?? []) for (const c of eventCmds(ev)) {
    if (c.kind === "transfer" && typeof c.mapId === "string" && typeof c.x === "number" && typeof c.y === "number") out.push({ ev, to: { mapId: c.mapId, x: c.x, y: c.y } });
  }
  return out;
}

/** 시작 맵(또는 from)에서 걸어 이동 이벤트를 타고 닿는 맵들과 맵마다 닿는 칸. */
export function walkWorld(project: Project, startMapId: string, startAnchors?: { x: number; y: number }[]): Walk {
  const reach = new Map<string, Uint8Array>();
  const maps = new Set<string>();
  const via = new Map<string, string>();
  const landings = new Map<string, { x: number; y: number }[]>();
  const start = project.maps[startMapId];
  if (!start) return { reach, maps, via };
  const queue: string[] = [startMapId];
  maps.add(startMapId);
  if (startAnchors) landings.set(startMapId, startAnchors);
  for (let k = 0; k < queue.length; k++) {
    const id = queue[k]!;
    const map = project.maps[id]!;
    // 시작 맵은 시작 앵커, 그 밖은 실제로 타고 온 착지 칸(없으면 들어오는 모든 착지 칸).
    const own = landings.get(id)?.filter((p) => p.x >= 0 && p.y >= 0 && p.x < map.width && p.y < map.height && isPassable(project, map, p.x, p.y));
    const r = mapReach(project, map, own?.length ? own : undefined);
    if (r) reach.set(id, r);
    for (const t of transfersOut(map)) {
      const target = project.maps[t.to.mapId];
      if (!target || t.to.mapId === id || !eventReached(map, r, t.ev)) continue;
      const list = landings.get(t.to.mapId) ?? [];
      list.push({ x: t.to.x, y: t.to.y });
      landings.set(t.to.mapId, list);
      if (!maps.has(t.to.mapId)) { maps.add(t.to.mapId); via.set(t.to.mapId, `${mapLabel(map)}→${mapLabel(target)}`); queue.push(t.to.mapId); }
    }
  }
  // 늦게 들어온 착지 칸까지 포함해 한 번 더(같은 맵에 여러 입구).
  for (const id of maps) {
    const map = project.maps[id]!;
    const own = landings.get(id)?.filter((p) => p.x >= 0 && p.y >= 0 && p.x < map.width && p.y < map.height && isPassable(project, map, p.x, p.y));
    if (own && own.length > 1) { const r = mapReach(project, map, own); if (r) reach.set(id, r); }
  }
  return { reach, maps, via };
}

export const startOf = (project: Project, ctx: TodoCheckContext) => (ctx.startMapId && project.maps[ctx.startMapId] ? ctx.startMapId : project.startMapId);

// ───────────── 장소 종류 ─────────────

const KIND_WORDS: Record<TodoPlaceKind, RegExp> = {
  village: /마을|촌|항구|도시|읍|town|village|city|harbor/iu,
  street: /거리|골목|상가|상점가|시장|아케이드|street|market|arcade|shotengai/iu,
  field: /들판|평원|숲|길|초원|필드|언덕|field|forest|road|plain/iu,
  cave: /동굴|굴|cave|grotto/iu,
  dungeon: /던전|지하|미궁|묘지|탑|유적|보스|마왕성|dungeon|crypt|tower|ruin|labyrinth|boss/iu,
  // 「상점가」「가게 거리」는 거리다 — 「상점」이 맞아 상점가 거리가 실내로 읽혀 거리 항목이 세 번 실패했다(2026-10-30 asst-parity 마왕 편의점 opus).
  interior: /방|실|집|여관|상점(?!가)|가게(?!\s*거리)|교회|신전|성당|서재|관|저택|내부|room|house|inn|shop(?!ping)|hall|interior/iu,
};

export const GROUP: Record<TodoPlaceKind, "in" | "out"> = { village: "out", street: "out", field: "out", cave: "in", dungeon: "in", interior: "in" };

export function mapKinds(map: GameMap): Set<TodoPlaceKind> {
  const name = mapNamesOf(map).join(" ");
  const tileset = String(map.tilesetId ?? "");
  const out = new Set<TodoPlaceKind>();
  // 타일셋 id 는 안쪽 종류(던전·동굴·실내)만 알려 준다 — 「beodeul_city」 칩셋으로 지은 던전 방이 마을로 읽혔다.
  for (const k of Object.keys(KIND_WORDS) as TodoPlaceKind[]) if (KIND_WORDS[k].test(name) || (GROUP[k] === "in" && KIND_WORDS[k].test(tileset))) out.add(k);
  if ((map.climate as { mode?: string } | undefined)?.mode === "indoor") out.add("interior");
  return out;
}

// ───────────── 보스 ─────────────

const BOSS_WORD = /boss|보스|마왕|군주|수문장|문지기|대장|두목|우두머리|왕$/iu;

export function troopOf(project: Project, id: unknown) { return project.database.troops.find((t) => t.id === id); }

export function troopNames(project: Project, id: unknown): string[] {
  const t = troopOf(project, id) as unknown as Obj | undefined;
  if (!t) return [];
  const out = [String(t.name ?? ""), String(t.id ?? "")];
  for (const m of (t.members as Obj[] | undefined) ?? []) {
    const e = project.database.enemies.find((x) => x.id === m.enemyId) as unknown as Obj | undefined;
    if (e) out.push(String(e.name ?? ""), String(e.id ?? ""));
  }
  return out.filter(Boolean);
}

export function isBossBattle(project: Project, ev: GameEvent, c: Cmd): boolean {
  if (/boss|보스/iu.test(`${ev.id} ${String(c.troopId ?? "")}`)) return true;
  if (c.canEscape === false) return true;
  return [String(ev.name ?? ""), ...troopNames(project, c.troopId)].some((n) => BOSS_WORD.test(n));
}
