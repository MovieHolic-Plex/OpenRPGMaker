// omo 할 일 항목의 기계 검사 — 모델이 「다 됐다」고 표시한 항목을 프로젝트만 읽어 결정적으로 판정한다(순수 함수, 부작용 없음).
//
// 대상 고르기(2026-10-30 감독 검토 — 이름만으로는 시작 저장본에 원래 있던 것·부분 일치한 다른 대상·여럿 중 아무거나로 통과했다):
//  ① 항목에 refs(고리가 쓰기 전후 차이로 묶은 id)가 있으면 그 id 들만 판정 대상(이름은 그 안에서 고르는 데만). 묶인 id 가 사라졌으면 실패.
//  ② refs 가 없으면 이름으로 찾되 fresh 면 이번 턴에 새로 생기거나 바뀐 것(ctx.changed)만 후보.
//  ③ 가장 잘 맞는 후보가 이름이 다른 둘 이상이면 통과시키지 않고 「모호함」 — refs 로 묶으라고 적는다. 같은 이름(같은 인물의 여러 이벤트)은 한 무리로 본다.
//     같음 > 부분 일치(같음이 하나도 없을 때만, 짧은 쪽 ≥ 긴 쪽 절반). 이벤트 자기 이름이 대사 화자·적 이름보다 앞선다.
//  ④ detail·evidence 에 잡은 대상 id 를 싣는다. 못 찾으면 가장 가까운 후보를 적어 모델이 다음 바퀴에 고칠 수 있게 한다.
// 걷기 판정은 기존 검사와 같은 함수를 쓴다:
//  - 맵 안: puzzleFlow(앵커=시작점·착지점, 같은 맵 퍼즐 문은 장치를 켤 수 있으면 열림) + bodyReached(그 칸 또는 옆에 닿음).
//  - 맵 사이: 시작 맵에서 출발해, 닿는 이동 이벤트의 도착 맵으로 넓혀 간다(다른 맵 스위치는 puzzleFlow 가 켤 수 있다고 본다).
// 보스 판정은 gateBattleSteps 와 같은 낱말(boss/보스 — 이벤트 id·적 그룹 id)과 도망 불가에 이름(마왕·군주·수문장 등)을 더했다.
import { isPassable } from "@/project/collision";
import type { GameEvent, GameMap, Project } from "@/project/types";
import { findShadowedPages } from "@/project/eventPageShadow";
import { findSetterShadowedPages, projectSwitchSetterLists } from "@/project/eventPageSetterShadow";
import { isPlaceholderMap } from "../blankStart";
import { endingConditionsUnset, writtenStateIds } from "../shipChecks";
import { isObjectiveCommand } from "../discoverability";
import { anchorsOf, bodyReached } from "../eventReach";
import { puzzleFlow } from "../puzzleGates";
import { isPersonEvent } from "../placementRules";
import { hint, nameScore, normName } from "./names";
import type { CheckResult, TodoCheck, TodoCheckContext, TodoItem, TodoPlaceKind } from "./types";

type Obj = Record<string, unknown>;
type Cmd = Obj & { kind: string };

// 판정 글 언어: 사람이 보는 보고·장부는 한국어(detail), 모델이 받는 글은 영어(en, 2026-10-30 사용자 결정).
// runTodoItemCheck 가 같은 판정을 두 번(ko·en) 돌려 둘 다 싣는다 — 글 조립만 다르고 판정은 같다.
let EN = false;
const t = (ko: string, en: string): string => (EN ? en : ko);
export type { TodoCheckContext };

// ───────────── 명령 걷기 ─────────────

/** 명령 목록 속 모든 명령(갈래·선택지·전투 결과 갈래·증거 제시 갈래 안까지). 조건 객체는 건너뛴다. */
function walk(node: unknown, visit: (c: Cmd) => void): void {
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
function deepCmds(project: Project, ev: GameEvent): Cmd[] {
  const own = eventCmds(ev);
  const more = own.filter((c) => c.kind === "callCommonEvent" && typeof c.commonEventId === "string").flatMap((c) => commonCmds(project, String(c.commonEventId)));
  return [...own, ...more];
}

// ───────────── 페이지가 살아 있나 ─────────────
// 런타임은 조건이 맞는 마지막 페이지 하나만 돈다. 가려진 페이지·아무도 켜지 않는 스위치/주지 않는 아이템을 기다리는 페이지의 명령은
// 「있다」로 세지 않는다(2026-10-30 b3 interrogation: 증거 내밀기 페이지가 있어도 판정자는 선택지를 한 번도 못 봤다 — 이런 꼴을 잡는다).

interface Live { written: Set<string>; given: Set<string>; setters: Set<string>[]; startOn: Set<string> }
const liveCache = new WeakMap<Project, Live>();
function liveFacts(project: Project): Live {
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
function liveCmds(project: Project, ev: GameEvent): { cmds: Cmd[]; dead: { why: string; cmds: Cmd[] }[] } {
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
function scanLive(project: Project, maps: readonly GameMap[], pred: (c: Cmd, ev: GameEvent) => boolean): { hits: { map: GameMap; ev: GameEvent; c: Cmd }[]; dead: { map: GameMap; ev: GameEvent; why: string }[] } {
  const hits: { map: GameMap; ev: GameEvent; c: Cmd }[] = [];
  const dead: { map: GameMap; ev: GameEvent; why: string }[] = [];
  for (const map of maps) for (const ev of map.events ?? []) {
    const live = liveCmds(project, ev);
    for (const c of live.cmds) if (pred(c, ev)) hits.push({ map, ev, c });
    for (const d of live.dead) if (d.cmds.some((c) => pred(c, ev))) dead.push({ map, ev, why: d.why });
  }
  return { hits, dead };
}
const deadNote = (dead: readonly { map: GameMap; ev: GameEvent; why: string }[]) =>
  dead.length ? t(` — 영영 안 도는 페이지에만 있다: ${dead.slice(0, 2).map((d) => `${at(d.map, d.ev)} ${d.why}`).join(" / ")}`, ` — only on pages that never run: ${dead.slice(0, 2).map((d) => `${at(d.map, d.ev)} ${d.why}`).join(" / ")}`) : "";

const trigOf = (ev: GameEvent, p: { trigger?: unknown }): string => {
  const t = p.trigger ?? (ev as unknown as Obj).trigger;
  return typeof t === "string" ? t : String((t as { kind?: string } | undefined)?.kind ?? "action");
};
const isAuto = (ev: GameEvent) => (ev.pages ?? []).some((p) => { const t = trigOf(ev, p); return t === "auto" || t === "parallel"; });


// ───────────── 이름·대상 ─────────────

const mapLabel = (m: GameMap) => String((m as unknown as Obj).displayName ?? "").trim() || String(m.name ?? m.id);
const mapNamesOf = (m: GameMap): string[] => [String(m.name ?? ""), String((m as unknown as Obj).displayName ?? ""), m.id].filter(Boolean);
const evLabel = (ev: GameEvent) => String(ev.name ?? "").trim() || ev.id;
const at = (m: GameMap, ev: GameEvent) => EN ? `"${mapLabel(m)}" "${evLabel(ev)}"(${ev.x},${ev.y}) [${ev.id}]` : `「${mapLabel(m)}」 「${evLabel(ev)}」(${ev.x},${ev.y}) [${ev.id}]`;
const mapAt = (m: GameMap) => EN ? `"${mapLabel(m)}" [${m.id}]` : `「${mapLabel(m)}」 [${m.id}]`;
/** 이름 따옴표(한국어 「」, 영어 ""). */
const q = (s: string) => (EN ? `"${s}"` : `「${s}」`);
const evKey = (m: GameMap, ev: GameEvent) => `${m.id}:${ev.id}`;
const evEvidence = (m: GameMap, ev: GameEvent) => ({ mapId: m.id, eventId: ev.id, x: ev.x, y: ev.y });

/** 이 이벤트를 부르는 이름: 자기 이름·id(앞), 대사 화자·건 전투의 적 그룹·적·인물 프로필 이름(뒤). */
function eventNameTiers(project: Project, ev: GameEvent): { primary: string[]; secondary: string[] } {
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

interface Named<T> { t: T; id: string; label: string; primary: string[]; secondary?: string[] }
type Chosen<T> = { ok: true; picked: Named<T>[]; matched: string } | { ok: false; result: CheckResult };

/** 점수: 자기 이름 같음 4 > 딸린 이름 같음 3 > 자기 이름 부분 2 > 딸린 이름 부분 1. */
function scoreNamed<T>(want: string, n: Named<T>): { s: number; name: string } {
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
function choose<T>(want: string, cands: readonly Named<T>[], what: string, bound: boolean, allNames: () => Iterable<string>): Chosen<T> {
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
interface Scope { refs?: TodoCheckContext["refs"]; changed?: TodoCheckContext["changed"]; fresh: boolean }
const scopeOf = (check: TodoCheck, ctx: TodoCheckContext): Scope => ({ refs: ctx.refs, changed: ctx.changed, fresh: !!check.fresh });
const has = (a?: readonly string[]) => !!a && a.length > 0;
const refEvent = (sc: Scope, m: GameMap, ev: GameEvent) => sc.refs!.eventIds!.some((r) => r === ev.id || r === evKey(m, ev));
const freshOnly = (sc: Scope) => sc.fresh && !!sc.changed;

/** 이 이벤트가 이 항목의 판정 대상인가(refs 의 eventIds, 아니면 fresh 면 이번 턴에 바뀐 이벤트). */
function eventInScope(sc: Scope, m: GameMap, ev: GameEvent, alsoTroop?: unknown): boolean {
  if (has(sc.refs?.eventIds) || has(sc.refs?.troopIds)) return (has(sc.refs?.eventIds) && refEvent(sc, m, ev)) || (alsoTroop !== undefined && !!sc.refs?.troopIds?.includes(String(alsoTroop)));
  if (freshOnly(sc)) return sc.changed!.eventKeys.has(evKey(m, ev)) || (alsoTroop !== undefined && sc.changed!.troopIds.has(String(alsoTroop)));
  return true;
}
const eventBound = (sc: Scope) => has(sc.refs?.eventIds);
function mapInScope(sc: Scope, m: GameMap): boolean {
  if (has(sc.refs?.mapIds)) return sc.refs!.mapIds!.includes(m.id);
  if (freshOnly(sc)) return sc.changed!.mapIds.has(m.id);
  return true;
}
function itemInScope(sc: Scope, id: string): boolean {
  if (has(sc.refs?.itemIds)) return sc.refs!.itemIds!.includes(id);
  if (freshOnly(sc)) return sc.changed!.itemIds.has(id);
  return true;
}
/** 범위가 좁혀져 비었을 때 덧붙이는 말. */
const scopeNote = (sc: Scope, kind: "맵" | "이벤트" | "아이템") =>
  has(sc.refs?.mapIds) || has(sc.refs?.eventIds) || has(sc.refs?.itemIds) || has(sc.refs?.troopIds) ? t(` (묶인 대상 안에서 찾았다)`, ` (searched only the bound targets)`)
    : freshOnly(sc) ? t(` (이번 턴에 새로 생기거나 바뀐 ${kind}만 본다 — 원래 있던 것은 이 항목을 통과시키지 않는다)`, ` (only ${WHAT_EN[kind] ?? kind}s created or changed this turn count — pre-existing ones do not pass this item)`) : "";
/** choose()·scopeNote 의 「무엇」 낱말 → 영어. */
const WHAT_EN: Record<string, string> = { 맵: "map", 이벤트: "event", 아이템: "item", 장소: "place", 인물: "person", "말하는 인물": "speaker", "전투 상대": "battle opponent", "출발 맵": "start map", "도착 맵": "destination map", "증거 아이템": "evidence item", "증거를 받을 인물": "person receiving the evidence", 목표: "target" };

/** 묶인 id 가운데 프로젝트에 없는 것. */
function missingRefs(project: Project, refs: TodoCheckContext["refs"]): string[] {
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

const mapNamed = (m: GameMap): Named<GameMap> => ({ t: m, id: m.id, label: mapLabel(m), primary: mapNamesOf(m) });
const allMapNames = (project: Project) => Object.values(project.maps).map(mapLabel);
/** 판정 대상이 아닌 맵 이름(link 의 출발 맵, map 좁히기 등)을 고른다 — 모호하면 실패. */
function resolveMaps(project: Project, want: string, what = "맵"): Chosen<GameMap> {
  return choose(want, Object.values(project.maps).map(mapNamed), what, false, () => allMapNames(project));
}
const isResult = (x: unknown): x is CheckResult => !!x && typeof x === "object" && "pass" in x && "detail" in x;
/** map 으로 좁히기: 이름이 주어졌으면 그 맵(들), 아니면 전부. */
function scopeMaps(project: Project, map: string | undefined): GameMap[] | CheckResult {
  if (!map) return Object.values(project.maps);
  const r = resolveMaps(project, map);
  return r.ok ? r.picked.map((p) => p.t) : r.result;
}
interface EvRef { map: GameMap; ev: GameEvent }
const evNamed = (project: Project, h: EvRef): Named<EvRef> => ({ t: h, id: h.ev.id, label: evLabel(h.ev), ...eventNameTiers(project, h.ev) });
const eventNameList = (maps: readonly GameMap[], filter: (ev: GameEvent) => boolean = () => true) =>
  maps.flatMap((m) => (m.events ?? []).filter(filter).map((ev) => String(ev.name ?? "")).filter(Boolean));

// ───────────── 걷기 ─────────────

interface Walk { reach: Map<string, Uint8Array>; maps: Set<string>; via: Map<string, string> }

/** 맵 안 걷기(퍼즐 문 열기 포함). 앵커가 없으면 undefined. */
function mapReach(project: Project, map: GameMap, anchors?: { x: number; y: number }[]): Uint8Array | undefined {
  const a = anchors ?? anchorsOf(project, map);
  if (!a.length) return undefined;
  return puzzleFlow(project, map.id, { anchors: a })?.reach;
}

/** 이 이벤트에 플레이어가 닿는가(자동·병렬 실행은 맵에 닿으면 된다). */
function eventReached(map: GameMap, reach: Uint8Array | undefined, ev: GameEvent): boolean {
  if (isAuto(ev)) return true;
  return !!reach && bodyReached(map, reach, ev);
}

/** 이 맵 이벤트들의 다른 맵 이동(이벤트, 도착). */
function transfersOut(map: GameMap): { ev: GameEvent; to: { mapId: string; x: number; y: number } }[] {
  const out: { ev: GameEvent; to: { mapId: string; x: number; y: number } }[] = [];
  for (const ev of map.events ?? []) for (const c of eventCmds(ev)) {
    if (c.kind === "transfer" && typeof c.mapId === "string" && typeof c.x === "number" && typeof c.y === "number") out.push({ ev, to: { mapId: c.mapId, x: c.x, y: c.y } });
  }
  return out;
}

/** 시작 맵(또는 from)에서 걸어 이동 이벤트를 타고 닿는 맵들과 맵마다 닿는 칸. */
function walkWorld(project: Project, startMapId: string, startAnchors?: { x: number; y: number }[]): Walk {
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

const startOf = (project: Project, ctx: TodoCheckContext) => (ctx.startMapId && project.maps[ctx.startMapId] ? ctx.startMapId : project.startMapId);

// ───────────── 장소 종류 ─────────────

const KIND_WORDS: Record<TodoPlaceKind, RegExp> = {
  village: /마을|촌|항구|도시|읍|town|village|city|harbor/iu,
  street: /거리|골목|상가|시장|street|market/iu,
  field: /들판|평원|숲|길|초원|필드|언덕|field|forest|road|plain/iu,
  cave: /동굴|굴|cave|grotto/iu,
  dungeon: /던전|지하|미궁|묘지|탑|유적|보스|마왕성|dungeon|crypt|tower|ruin|labyrinth|boss/iu,
  interior: /방|실|집|여관|상점|가게|교회|신전|성당|서재|관|저택|내부|room|house|inn|shop|hall|interior/iu,
};
const GROUP: Record<TodoPlaceKind, "in" | "out"> = { village: "out", street: "out", field: "out", cave: "in", dungeon: "in", interior: "in" };

function mapKinds(map: GameMap): Set<TodoPlaceKind> {
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
function troopOf(project: Project, id: unknown) { return project.database.troops.find((t) => t.id === id); }
function troopNames(project: Project, id: unknown): string[] {
  const t = troopOf(project, id) as unknown as Obj | undefined;
  if (!t) return [];
  const out = [String(t.name ?? ""), String(t.id ?? "")];
  for (const m of (t.members as Obj[] | undefined) ?? []) {
    const e = project.database.enemies.find((x) => x.id === m.enemyId) as unknown as Obj | undefined;
    if (e) out.push(String(e.name ?? ""), String(e.id ?? ""));
  }
  return out.filter(Boolean);
}
function isBossBattle(project: Project, ev: GameEvent, c: Cmd): boolean {
  if (/boss|보스/iu.test(`${ev.id} ${String(c.troopId ?? "")}`)) return true;
  if (c.canEscape === false) return true;
  return [String(ev.name ?? ""), ...troopNames(project, c.troopId)].some((n) => BOSS_WORD.test(n));
}


// ───────────── 판정 ─────────────

export function runTodoCheck(project: Project, check: TodoCheck, ctx: TodoCheckContext = {}): CheckResult {
  if (check.kind === "none") return { pass: true, detail: t("판정자 확인 항목", "judged by a reviewer, not by machine") };
  const gone = missingRefs(project, ctx.refs);
  if (gone.length) return { pass: false, detail: t(`묶인 대상 사라짐: ${gone.slice(0, 4).join(", ")} — 지워졌거나 다른 id 로 다시 만들어졌다`, `bound target gone: ${gone.slice(0, 4).join(", ")} — deleted, or rebuilt with another id`) };
  const sc = scopeOf(check, ctx);
  switch (check.kind) {
    case "place": return checkPlace(project, sc, check.name, check.placeKind);
    case "person": return checkPerson(project, sc, check.name, check.map);
    case "talk": return checkTalk(project, sc, check.who, check.says);
    case "battle": return checkBattle(project, sc, check.who, check.map, check.boss);
    case "link": return checkLink(project, sc, check.from, check.to);
    case "ending": return checkEnding(project, sc, ctx, check.map);
    case "item": return checkItem(project, sc, check.name, check.gives);
    case "present_evidence": return checkPresent(project, sc, check.item, check.to);
    case "objective": return checkObjective(project, sc, check.text);
    case "reachable": return checkReachable(project, sc, check.target, check.from, ctx);
    case "party_join": return checkPartyJoin(project, sc, ctx, check.name, check.map);
  }
}

/** 할 일 항목 하나 판정 — 항목의 refs 를 ctx 에 얹는다. */
export function runTodoItemCheck(project: Project, item: Pick<TodoItem, "check" | "refs">, ctx: TodoCheckContext = {}): CheckResult {
  if (!item.check) return { pass: true, detail: "검사 없음(판정자 확인 항목)", en: "no check (judged by a reviewer)" };
  const c = { ...ctx, refs: item.refs ?? ctx.refs };
  const ko = runTodoCheck(project, item.check, c);
  // 같은 판정의 영어 글(모델에게 간다). 판정이 갈리면(있을 수 없지만) 한국어 판정을 따른다.
  let en: string | undefined;
  EN = true;
  try { en = runTodoCheck(project, item.check, c).detail; } catch { en = undefined; } finally { EN = false; }
  return en ? { ...ko, en } : ko;
}

function checkPlace(project: Project, sc: Scope, name: string, kind?: TodoPlaceKind): CheckResult {
  const cands = Object.values(project.maps).filter((m) => mapInScope(sc, m)).map(mapNamed);
  const r = choose(name, cands, "장소", has(sc.refs?.mapIds), () => allMapNames(project));
  if (!r.ok) {
    const old = !has(sc.refs?.mapIds) && freshOnly(sc) ? resolveMaps(project, name) : undefined;
    return { pass: false, detail: `${r.result.detail}${scopeNote(sc, "맵")}${old?.ok ? t(` — ${old.picked.map((p) => mapAt(p.t)).join(", ")} 는 전부터 있던 맵이다`, ` — ${old.picked.map((p) => mapAt(p.t)).join(", ")} existed before this turn`) : ""}` };
  }
  const maps = r.picked.map((p) => p.t);
  const real = maps.filter((m) => !isPlaceholderMap(m));
  if (!real.length) return { pass: false, detail: t(`${mapAt(maps[0]!)} 는 바닥 한 가지뿐인 빈 자리표시 맵이다 — 장소를 실제로 지어야 한다`, `${mapAt(maps[0]!)} is an empty placeholder map (one floor tile only) — actually build the place`), evidence: { mapId: maps[0]!.id } };
  for (const m of real) {
    const ks = mapKinds(m);
    if (!kind || !ks.size || ks.has(kind) || [...ks].some((k) => GROUP[k] === GROUP[kind])) {
      return { pass: true, detail: t(`장소 ${mapAt(m)} 가 있다(${m.width}×${m.height}, 이벤트 ${m.events?.length ?? 0}${kind ? `, 종류 ${ks.size ? [...ks].join("/") : "모름"} — 요청 ${kind}` : ""})`, `place ${mapAt(m)} exists (${m.width}x${m.height}, ${m.events?.length ?? 0} events${kind ? `, kind ${ks.size ? [...ks].join("/") : "unknown"} — requested ${kind}` : ""})`), evidence: { mapId: m.id } };
    }
  }
  const m = real[0]!;
  return { pass: false, detail: t(`${mapAt(m)} 는 ${[...mapKinds(m)].join("/")} 로 보인다 — ${kind} 장소가 아니다`, `${mapAt(m)} looks like ${[...mapKinds(m)].join("/")} — not a ${kind} place`), evidence: { mapId: m.id } };
}

/** 범위 안 이벤트 후보(맵 좁히기·거르기 포함). */
function eventCands(project: Project, sc: Scope, maps: readonly GameMap[], filter: (ev: GameEvent) => boolean = () => true): Named<EvRef>[] {
  const out: Named<EvRef>[] = [];
  for (const map of maps) for (const ev of map.events ?? []) if (filter(ev) && eventInScope(sc, map, ev)) out.push(evNamed(project, { map, ev }));
  return out;
}

function checkPerson(project: Project, sc: Scope, name: string, map?: string): CheckResult {
  const scope = scopeMaps(project, map);
  if (isResult(scope)) return scope;
  const r = choose(name, eventCands(project, sc, scope, isPersonEvent), "인물", eventBound(sc), () => eventNameList(scope, isPersonEvent));
  if (r.ok) { const h = r.picked[0]!.t; return { pass: true, detail: t(`인물 「${r.matched}」 = ${r.picked.map((p) => at(p.t.map, p.t.ev)).slice(0, 3).join(", ")}`, `person "${r.matched}" = ${r.picked.map((p) => at(p.t.map, p.t.ev)).slice(0, 3).join(", ")}`), evidence: evEvidence(h.map, h.ev) }; }
  if (r.result.detail.startsWith("모호함") || r.result.detail.startsWith("ambiguous")) return r.result;
  const faceless = choose(name, eventCands(project, sc, scope), "이벤트", eventBound(sc), () => []);
  if (faceless.ok) { const h = faceless.picked[0]!.t; return { pass: false, detail: t(`${at(h.map, h.ev)} 는 있지만 사람 그림(걷기 칩)이 없다`, `${at(h.map, h.ev)} exists but has no person sprite (walking charset)`), evidence: evEvidence(h.map, h.ev) }; }
  if (map) {
    const elsewhere = choose(name, eventCands(project, sc, Object.values(project.maps), isPersonEvent), "인물", eventBound(sc), () => []);
    if (elsewhere.ok) { const h = elsewhere.picked[0]!.t; return { pass: false, detail: t(`「${name}」 는 ${at(h.map, h.ev)} 에 있다 — 「${map}」 에는 없다`, `"${name}" is at ${at(h.map, h.ev)} — not on "${map}"`), evidence: evEvidence(h.map, h.ev) }; }
  }
  return { pass: false, detail: `${r.result.detail}${scopeNote(sc, "이벤트")}` };
}

function checkTalk(project: Project, sc: Scope, who: string, says?: string): CheckResult {
  const maps = Object.values(project.maps);
  const r = choose(who, eventCands(project, sc, maps), "말하는 인물", eventBound(sc), () => eventNameList(maps));
  if (!r.ok) return { pass: false, detail: `${r.result.detail}${scopeNote(sc, "이벤트")}` };
  // 고른 인물(같은 이름 무리)의 살아 있는 페이지 대사.
  const lines: { map: GameMap; ev: GameEvent; body: string }[] = [];
  const dead: { map: GameMap; ev: GameEvent; why: string }[] = [];
  for (const { t: { map, ev } } of r.picked) {
    const live = liveCmds(project, ev);
    for (const c of live.cmds) if (c.kind === "text") lines.push({ map, ev, body: String(c.body ?? "") });
    for (const d of live.dead) if (d.cmds.some((c) => c.kind === "text")) dead.push({ map, ev, why: d.why });
  }
  const ids = r.picked.map((p) => p.id).slice(0, 4).join(", ");
  const first = r.picked[0]!.t;
  if (!lines.length) return { pass: false, detail: t(`「${r.matched}」(${ids}) 에 도는 대사 명령이 없다`, `"${r.matched}" (${ids}) has no live dialogue command`) + deadNote(dead), evidence: evEvidence(first.map, first.ev) };
  // refs 로 묶인 이벤트 하나는 이름이 안 맞아도 골라진다 — 그때는 그 이벤트 대사에 「who」 가 말하는 줄(speaker 또는 「who: …」 머리)이 있어야 한다.
  // 2026-10-30 omo-loop-1030 terra boss-room r3: 이름이 id 뿐인 컷신 하나에 묶여 「해골 기사」 대사로 통과했다.
  if (!r.picked.some((p) => scoreNamed(who, p).s > 0)) {
    const w = normName(who, true);
    const speaking = lines.filter((l) => normName(l.body, true).startsWith(w));
    if (!speaking.length) return { pass: false, detail: t(`묶인 이벤트 ${ids} 에 「${who}」 가 말하는 줄이 없다(이름·speaker·「${who}: …」 머리 없음) — 대사의 speaker 를 「${who}」로 쓰거나 그 인물 이벤트에 묶는다(todo bind)`, `bound event ${ids} has no line spoken by "${who}" (no name, speaker, or "${who}: …" prefix) — set the line's speaker to "${who}" or bind that person's event (todo bind)`), evidence: evEvidence(first.map, first.ev) };
    lines.splice(0, lines.length, ...speaking);
  }
  if (says) {
    const want = normName(says, true);
    const hit = lines.find((l) => normName(l.body, true).includes(want));
    if (!hit) return { pass: false, detail: t(`「${r.matched}」(${ids}) 대사 ${lines.length}줄에 「${says}」 가 없다 — 예: 「${lines[0]!.body.slice(0, 40)}」`, `"${r.matched}" (${ids}): none of ${lines.length} lines contains "${says}" — e.g. "${lines[0]!.body.slice(0, 40)}"`), evidence: evEvidence(lines[0]!.map, lines[0]!.ev) };
    return { pass: true, detail: `${at(hit.map, hit.ev)}: ${q(hit.body.slice(0, 50))}`, evidence: evEvidence(hit.map, hit.ev) };
  }
  const l = lines[0]!;
  return { pass: true, detail: t(`「${r.matched}」 ${at(l.map, l.ev)} 대사 ${lines.length}줄: 「${l.body.slice(0, 40)}」`, `"${r.matched}" ${at(l.map, l.ev)} ${lines.length} lines: "${l.body.slice(0, 40)}"`), evidence: evEvidence(l.map, l.ev) };
}

function checkBattle(project: Project, sc: Scope, who?: string, map?: string, boss?: boolean): CheckResult {
  const scope = scopeMaps(project, map);
  if (isResult(scope)) return scope;
  const scan = scanLive(project, scope, (c) => c.kind === "battleProcessing");
  const inScope = scan.hits.filter((h) => eventInScope(sc, h.map, h.ev, h.c.troopId));
  const troopName = (c: Cmd) => troopOf(project, c.troopId)?.name ?? String(c.troopId);
  if (!inScope.length) return { pass: false, detail: t(`${map ? `「${map}」 에` : "어느 맵에도"} 도는 전투 명령(battleProcessing)이 있는 이벤트가 없다`, `no event ${map ? `on "${map}"` : "on any map"} has a live battle command (battleProcessing)`) + scopeNote(sc, "이벤트") + deadNote(scan.dead) };
  type B = (typeof inScope)[number];
  const named = inScope.map((b): Named<B> => ({ t: b, id: `${b.ev.id}/${String(b.c.troopId)}`, label: `${evLabel(b.ev)}(${troopName(b.c)})`, primary: [String(b.ev.name ?? ""), b.ev.id, ...troopNames(project, b.c.troopId)].filter(Boolean), secondary: eventNameTiers(project, b.ev).secondary }));
  let cands = named;
  let matched = "";
  if (who) {
    const r = choose(who, named, "전투 상대", eventBound(sc) || has(sc.refs?.troopIds), () => named.map((n) => n.label));
    if (!r.ok) return { pass: false, detail: `${r.result.detail}${scopeNote(sc, "이벤트")}` };
    cands = r.picked; matched = r.matched;
  }
  const desc = (b: B) => t(`${at(b.map, b.ev)} 적 그룹 「${troopName(b.c)}」 [${String(b.c.troopId)}]${b.c.canEscape === false ? " 도망 불가" : ""}`, `${at(b.map, b.ev)} troop "${troopName(b.c)}" [${String(b.c.troopId)}]${b.c.canEscape === false ? " no escape" : ""}`);
  if (boss) {
    const hit = cands.find((b) => isBossBattle(project, b.t.ev, b.t.c));
    if (!hit) { const b = cands[0]!.t; return { pass: false, detail: t(`${desc(b)} 는 보스전으로 안 보인다(이름·그룹에 보스 낱말 없음, 도망 가능) — 보스면 canEscape:false·보스 그룹으로`, `${desc(b)} does not look like a boss battle (no boss word in the name or troop, escape allowed) — for a boss use canEscape:false and a boss troop`), evidence: evEvidence(b.map, b.ev) }; }
    return { pass: true, detail: `${t("보스전", "boss battle")}${matched ? ` ${q(matched)}` : ""} ${desc(hit.t)}`, evidence: evEvidence(hit.t.map, hit.t.ev) };
  }
  const b = cands[0]!.t;
  return { pass: true, detail: `${t("전투", "battle")}${matched ? ` ${q(matched)}` : ""} ${desc(b)}`, evidence: evEvidence(b.map, b.ev) };
}

function checkLink(project: Project, sc: Scope, from: string, to: string): CheckResult {
  const tr = t;
  const f = resolveMaps(project, from, "출발 맵"), dst = resolveMaps(project, to, "도착 맵");
  if (!f.ok) return f.result;
  if (!dst.ok) return dst.result;
  const toIds = new Set(dst.picked.map((p) => p.id));
  const problems: string[] = [];
  for (const { t: fm } of f.picked) {
    const all = transfersOut(fm).filter((x) => toIds.has(x.to.mapId));
    // 판정 대상 이동 이벤트: refs 의 이벤트, 아니면 fresh 면 이번 턴에 바뀐 이벤트이거나 이번 턴에 생긴 도착 맵으로 가는 것.
    const links = all.filter((x) => has(sc.refs?.eventIds) ? refEvent(sc, fm, x.ev)
      : has(sc.refs?.mapIds) ? sc.refs!.mapIds!.includes(x.to.mapId) || sc.refs!.mapIds!.includes(fm.id)
      : freshOnly(sc) ? sc.changed!.eventKeys.has(evKey(fm, x.ev)) || sc.changed!.mapIds.has(x.to.mapId) : true);
    if (!links.length) { problems.push(tr(`${mapAt(fm)} 에 ${dst.picked.map((p) => mapAt(p.t)).join("/")} 로 가는 ${all.length ? "이번 턴의 " : ""}이동 이벤트가 없다`, `${mapAt(fm)} has no ${all.length ? "new (this turn) " : ""}transfer event to ${dst.picked.map((p) => mapAt(p.t)).join("/")}`) + (all.length ? scopeNote(sc, "이벤트") : "")); continue; }
    const reach = mapReach(project, fm);
    for (const x of links) {
      const target = project.maps[x.to.mapId]!;
      const landOk = x.to.x >= 0 && x.to.y >= 0 && x.to.x < target.width && x.to.y < target.height && isPassable(project, target, x.to.x, x.to.y);
      const fromOk = eventReached(fm, reach, x.ev);
      if (fromOk && landOk) return { pass: true, detail: tr(`${at(fm, x.ev)} → ${mapAt(target)}(${x.to.x},${x.to.y}) 걸어 닿고 도착 칸도 걸을 수 있다`, `${at(fm, x.ev)} → ${mapAt(target)}(${x.to.x},${x.to.y}) is reachable on foot and the arrival cell is walkable`), evidence: evEvidence(fm, x.ev) };
      problems.push(`${at(fm, x.ev)} → ${mapAt(target)}(${x.to.x},${x.to.y}): ${!reach ? tr("이 맵에 들어오는 칸·시작점이 없어 걸어 볼 수 없다", "this map has no entry cell or start point to walk from") : !fromOk ? tr("들어오는 칸에서 걸어 닿지 못한다", "not reachable on foot from the entry cells") : tr("도착 칸이 벽·물건이다", "the arrival cell is a wall or object")}`);
    }
  }
  return { pass: false, detail: problems.slice(0, 3).join(" / ") };
}

const ENDING_KINDS = new Set(["triggerEnding", "ending", "returnToTitle"]);

function checkEnding(project: Project, sc: Scope, ctx: TodoCheckContext, onMap?: string): CheckResult {
  const scope = scopeMaps(project, onMap);
  if (isResult(scope)) return scope;
  const unsetEndings = new Set(endingConditionsUnset(project).map((b) => b.evidence.split(":")[0]!));
  const scan = scanLive(project, scope, (c) => ENDING_KINDS.has(c.kind));
  const sites: { map: GameMap; ev: GameEvent; kind: string; why?: string }[] = [];
  const seen = new Set<GameEvent>();
  for (const h of scan.hits) {
    if (seen.has(h.ev)) continue;
    seen.add(h.ev);
    const why = h.c.kind === "triggerEnding" && typeof h.c.endingId === "string" && unsetEndings.has(h.c.endingId) ? t(`엔딩 ${h.c.endingId} 의 조건 스위치·변수를 켜는 곳이 없다`, `nothing sets the condition switch/variable of ending ${h.c.endingId}`) : undefined;
    sites.push({ map: h.map, ev: h.ev, kind: h.c.kind, why });
  }
  for (const d of scan.dead) if (!seen.has(d.ev)) sites.push({ map: d.map, ev: d.ev, kind: "triggerEnding", why: d.why });
  const mine = sites.filter((s) => eventInScope(sc, s.map, s.ev));
  if (!mine.length) {
    const others = sites.length ? t(` — 엔딩은 ${sites.slice(0, 3).map((s) => at(s.map, s.ev)).join(", ")} 에 있다${mine.length !== sites.length && (freshOnly(sc) || eventBound(sc)) ? "(원래 있던·묶이지 않은 엔딩이라 이 항목을 통과시키지 않는다)" : ""}`, ` — endings exist at ${sites.slice(0, 3).map((s) => at(s.map, s.ev)).join(", ")}${mine.length !== sites.length && (freshOnly(sc) || eventBound(sc)) ? " (pre-existing or unbound endings do not pass this item)" : ""}`) : "";
    const elsewhere = onMap && !sites.length ? Object.values(project.maps).filter((m) => !scope.includes(m)).flatMap((m) => (m.events ?? []).filter((ev) => deepCmds(project, ev).some((c) => ENDING_KINDS.has(c.kind))).map((ev) => at(m, ev))) : [];
    return { pass: false, detail: t(`${onMap ? `「${onMap}」 에 ` : ""}${freshOnly(sc) && !eventBound(sc) ? "이번 턴에 만든 " : ""}엔딩을 부르는 이벤트(triggerEnding·ending·returnToTitle)가 없다`, `no ${freshOnly(sc) && !eventBound(sc) ? "new (this turn) " : ""}event ${onMap ? `on "${onMap}" ` : ""}calls an ending (triggerEnding/ending/returnToTitle)`) + others + (elsewhere.length ? t(` — 엔딩은 ${elsewhere.slice(0, 3).join(", ")} 에 있다`, ` — endings exist at ${elsewhere.slice(0, 3).join(", ")}`) : "") };
  }
  const world = walkWorld(project, startOf(project, ctx));
  const notes: string[] = [];
  for (const s of mine) {
    if (s.why) { notes.push(`${at(s.map, s.ev)}: ${s.why}`); continue; }
    if (!world.maps.has(s.map.id)) { notes.push(`${at(s.map, s.ev)}: ${t(`시작 맵에서 ${mapAt(s.map)} 로 가는 길이 없다`, `no way from the start map to ${mapAt(s.map)}`)}`); continue; }
    if (!eventReached(s.map, world.reach.get(s.map.id), s.ev)) { notes.push(`${at(s.map, s.ev)}: ${t("그 맵 안에서 걸어 닿지 못한다", "not reachable on foot inside that map")}`); continue; }
    return { pass: true, detail: t(`엔딩 ${s.kind} — ${at(s.map, s.ev)}, 시작에서 걸어 닿는다`, `ending ${s.kind} — ${at(s.map, s.ev)}, reachable on foot from the start`), evidence: evEvidence(s.map, s.ev) };
  }
  const s = mine[0]!;
  return { pass: false, detail: t(`엔딩 명령에 닿지 못한다 — ${notes.slice(0, 3).join(" / ")}`, `the ending command cannot be reached — ${notes.slice(0, 3).join(" / ")}`), evidence: evEvidence(s.map, s.ev) };
}

const itemNamed = (it: Obj): Named<Obj> => ({ t: it, id: String(it.id), label: String(it.name ?? it.id), primary: [String(it.name ?? ""), String(it.id ?? "")].filter(Boolean) });
const allItemNames = (project: Project) => (project.database.items as unknown as Obj[]).map((i) => String(i.name ?? ""));

function checkItem(project: Project, sc: Scope, name: string, gives?: boolean): CheckResult {
  const cands = (project.database.items as unknown as Obj[]).filter((i) => itemInScope(sc, String(i.id))).map(itemNamed);
  const r = choose(name, cands, "아이템", has(sc.refs?.itemIds), () => allItemNames(project));
  if (!r.ok) return { pass: false, detail: `${r.result.detail}${scopeNote(sc, "아이템")}` };
  const ids = new Set(r.picked.map((p) => p.id));
  const label = `${q(r.matched)} [${[...ids].join(", ")}]`;
  if (!gives) return { pass: true, detail: t(`아이템 ${label} 이 DB 에 있다`, `item ${label} exists in the database`) };
  const giving = (c: Cmd) => {
    if (c.kind !== "changeItem" || !ids.has(String(c.itemId))) return false;
    const amt = c.amount as unknown;
    const n = typeof amt === "number" ? amt : typeof (amt as Obj | undefined)?.value === "number" ? Number((amt as Obj).value) : 1;
    return (c.op === "+=" || c.op === "=") && n > 0;
  };
  const scan = scanLive(project, Object.values(project.maps), giving);
  const h = scan.hits[0];
  if (h) return { pass: true, detail: t(`${label} 지급 — ${at(h.map, h.ev)}`, `${label} is given — ${at(h.map, h.ev)}`), evidence: evEvidence(h.map, h.ev) };
  return { pass: false, detail: t(`아이템 ${label} 은 있지만 주는 명령(changeItem +=)이 도는 이벤트에 없다`, `item ${label} exists but no live event gives it (changeItem +=)`) + deadNote(scan.dead) };
}

function checkPresent(project: Project, sc: Scope, item: string, to?: string): CheckResult {
  // 증거 아이템은 묶인 아이템이 있으면 그 안에서, 아니면 전부에서(원래 있던 증거를 새 심문에 써도 된다).
  const itemCands = (project.database.items as unknown as Obj[]).filter((i) => !has(sc.refs?.itemIds) || sc.refs!.itemIds!.includes(String(i.id))).map(itemNamed);
  const ri = choose(item, itemCands, "증거 아이템", has(sc.refs?.itemIds), () => allItemNames(project));
  if (!ri.ok) return ri.result;
  const ids = new Set(ri.picked.map((p) => p.id));
  const label = `${q(ri.matched)} [${[...ids].join(", ")}]`;
  if (![...ids].some((id) => liveFacts(project).given.has(id))) return { pass: false, detail: t(`증거 ${label} 을 주는 곳(아이템 넣기·상점·드롭)이 없다 — 플레이어가 가질 수 없다`, `nothing gives evidence ${label} (give item, shop, drop) — the player cannot have it`) };
  const takes = (c: Cmd) => c.kind === "presentItem" && ((c.options as Obj[] | undefined) ?? []).some((o) => ids.has(String(o.itemId)));
  const maps = Object.values(project.maps);
  const scan = scanLive(project, maps, takes);
  const all = [...new Map(scan.hits.map((h) => [h.ev, { map: h.map, ev: h.ev }])).values()];
  const sites = all.filter((s) => eventInScope(sc, s.map, s.ev));
  if (!sites.length) {
    if (all.length) return { pass: false, detail: t(`${label} 을 받는 증거 내밀기는 ${all.map((s) => at(s.map, s.ev)).slice(0, 3).join(", ")} 에 있지만 이 항목의 대상이 아니다`, `evidence presentation accepting ${label} exists at ${all.map((s) => at(s.map, s.ev)).slice(0, 3).join(", ")} but is not this item's target`) + scopeNote(sc, "이벤트") };
    const anyPresent = scanLive(project, maps, (c) => c.kind === "presentItem").hits.length;
    return { pass: false, detail: scan.dead.length ? t(`${label} 을 받는 증거 내밀기가 있지만`, `evidence presentation accepting ${label} exists, but`) + deadNote(scan.dead) : anyPresent ? t(`증거 내밀기(presentItem)는 ${anyPresent}곳 있지만 ${label} 을 맞는 증거로 받는 갈래가 없다`, `there are ${anyPresent} evidence presentations (presentItem) but none accepts ${label} as the right evidence`) : t(`증거 내밀기(presentItem) 명령이 어디에도 없다 — ${label} 을 내밀 수단이 없다`, `there is no presentItem command anywhere — no way to present ${label}`) };
  }
  if (to) {
    const r = choose(to, sites.map((s) => evNamed(project, s)), "증거를 받을 인물", false, () => sites.map((s) => evLabel(s.ev)));
    if (!r.ok) return { pass: false, detail: t(`${label} 을 받는 곳은 ${sites.map((s) => at(s.map, s.ev)).join(", ")} — ${r.result.detail}`, `${label} is accepted at ${sites.map((s) => at(s.map, s.ev)).join(", ")} — ${r.result.detail}`) };
    const hit = r.picked[0]!.t;
    return { pass: true, detail: t(`${label} 을 ${at(hit.map, hit.ev)} 에게 내밀 수 있다`, `${label} can be presented to ${at(hit.map, hit.ev)}`), evidence: evEvidence(hit.map, hit.ev) };
  }
  const s = sites[0]!;
  return { pass: true, detail: t(`${label} 을 ${at(s.map, s.ev)} 에서 내밀 수 있다`, `${label} can be presented at ${at(s.map, s.ev)}`), evidence: evEvidence(s.map, s.ev) };
}

function checkObjective(project: Project, sc: Scope, text?: string): CheckResult {
  const found: { map: GameMap | undefined; ev: GameEvent | undefined; message: string }[] = [];
  for (const h of scanLive(project, Object.values(project.maps), (c) => isObjectiveCommand(c as never)).hits) {
    if (eventInScope(sc, h.map, h.ev)) found.push({ map: h.map, ev: h.ev, message: String((h.c.fields as Obj).message) });
  }
  if (!freshOnly(sc) && !eventBound(sc)) for (const ce of (project.commonEvents ?? []) as unknown as Obj[]) walk(ce.commands, (c) => { if (isObjectiveCommand(c as never)) found.push({ map: undefined, ev: undefined, message: String((c.fields as Obj).message) }); });
  if (!found.length) return { pass: false, detail: t("목표 줄 설정 명령이 없다", "there is no command that sets the objective line") + scopeNote(sc, "이벤트") };
  const pick = text ? found.find((f) => normName(f.message, true).includes(normName(text, true))) : found[0];
  if (!pick) return { pass: false, detail: t(`목표 줄 ${found.length}개에 「${text}」 가 없다 — 있는 것: `, `none of ${found.length} objective lines contains "${text}" — existing: `) + [...new Set(found.map((f) => q(f.message.slice(0, 30))))].slice(0, 4).join(", ") };
  return { pass: true, detail: `${t("목표 줄", "objective line")} ${q(pick.message.slice(0, 50))}${pick.map && pick.ev ? ` — ${at(pick.map, pick.ev)}` : t(" — 공통 이벤트", " — common event")}`, ...(pick.map && pick.ev ? { evidence: evEvidence(pick.map, pick.ev) } : {}) };
}

function checkReachable(project: Project, sc: Scope, target: string, from: string | undefined, ctx: TodoCheckContext): CheckResult {
  let startId = startOf(project, ctx);
  if (from) {
    const f = resolveMaps(project, from, "출발 맵");
    if (!f.ok) return f.result;
    startId = f.picked[0]!.id;
  }
  // 목표 후보: 범위 안 이벤트와 맵을 함께 놓고 이름으로 고른다.
  type T = { kind: "ev"; ref: EvRef } | { kind: "map"; map: GameMap };
  const cands: Named<T>[] = [
    ...eventCands(project, sc, Object.values(project.maps)).map((n): Named<T> => ({ ...n, t: { kind: "ev", ref: n.t } })),
    ...Object.values(project.maps).filter((m) => mapInScope(sc, m) && (!has(sc.refs?.eventIds) || has(sc.refs?.mapIds))).map((m): Named<T> => ({ ...mapNamed(m), t: { kind: "map", map: m } })),
  ];
  const r = choose(target, cands, "목표", eventBound(sc) || has(sc.refs?.mapIds), () => [...allMapNames(project), ...eventNameList(Object.values(project.maps))]);
  if (!r.ok) return { pass: false, detail: `${r.result.detail}${scopeNote(sc, "이벤트")}` };
  const world = walkWorld(project, startId);
  const startLabel = mapAt(project.maps[startId]!);
  for (const p of r.picked) {
    if (p.t.kind === "ev") {
      const { map, ev } = p.t.ref;
      if (world.maps.has(map.id) && eventReached(map, world.reach.get(map.id), ev)) return { pass: true, detail: t(`${at(map, ev)} 에 ${startLabel} 에서 걸어 닿는다`, `${at(map, ev)} is reachable on foot from ${startLabel}`) + (world.via.get(map.id) ? `(${world.via.get(map.id)})` : ""), evidence: evEvidence(map, ev) };
    } else if (world.maps.has(p.t.map.id)) {
      return { pass: true, detail: t(`${mapAt(p.t.map)} 에 ${startLabel} 에서 걸어 닿는다`, `${mapAt(p.t.map)} is reachable on foot from ${startLabel}`) + (world.via.get(p.t.map.id) ? `(${world.via.get(p.t.map.id)})` : ""), evidence: { mapId: p.t.map.id } };
    }
  }
  const p = r.picked[0]!.t;
  if (p.kind === "ev") {
    const { map, ev } = p.ref;
    return { pass: false, detail: t(`${at(map, ev)} 에 ${startLabel} 에서 걸어 닿지 못한다 — ${world.maps.has(map.id) ? "그 맵 안에서 막힌다(벽·물건·안 열리는 문)" : "그 맵으로 가는 이동 이벤트에 닿지 못한다"}`, `${at(map, ev)} is not reachable on foot from ${startLabel} — ${world.maps.has(map.id) ? "blocked inside that map (wall, object, or a door that does not open)" : "no reachable transfer event leads to that map"}`), evidence: evEvidence(map, ev) };
  }
  return { pass: false, detail: t(`${mapAt(p.map)} 에 ${startLabel} 에서 가는 길이 없다(닿는 맵: `, `no way from ${startLabel} to ${mapAt(p.map)} (reachable maps: `) + `${[...world.maps].map((id) => mapLabel(project.maps[id]!)).join(", ")})`, evidence: { mapId: p.map.id } };
}

/** 동료 합류: 파티에 넣는 명령(changeParty add)이 살아 있는 이벤트 페이지에 있고, 그 배우 이름이나 그 이벤트 이름이 name 에 맞고, 시작에서 그 이벤트에 걸어 닿는다. */
function checkPartyJoin(project: Project, sc: Scope, ctx: TodoCheckContext, name: string, onMap?: string): CheckResult {
  const actors = (project.database.actors ?? []) as unknown as Obj[];
  const actorName = (id: unknown) => String(actors.find((a) => String(a.id) === String(id))?.name ?? id ?? "");
  const scope = scopeMaps(project, onMap);
  if (isResult(scope)) return scope;
  const scan = scanLive(project, scope, (c) => c.kind === "changeParty" && c.action === "add");
  const live = scan.hits.filter((h) => eventInScope(sc, h.map, h.ev));
  const mine = eventBound(sc) ? live : live.filter((h) => nameScore(name, actorName(h.c.actorId)) > 0 || eventNameTiers(project, h.ev).primary.some((n) => nameScore(name, n) > 0) || nameScore(name, String(h.ev.name ?? "")) > 0);
  if (!mine.length) {
    const seen = live.length ? t(` — 합류 명령은 있지만 다른 동료다: `, ` — there are join commands, but for other companions: `) + live.slice(0, 3).map((h) => `${q(actorName(h.c.actorId))} ${at(h.map, h.ev)}`).join(", ") : scan.hits.length ? t(` — 합류 명령은 ${scan.hits.slice(0, 2).map((h) => at(h.map, h.ev)).join(", ")} 에 있다(이번 턴 것이 아니다)`, ` — join commands exist at ${scan.hits.slice(0, 2).map((h) => at(h.map, h.ev)).join(", ")} (not from this turn)`) : "";
    return { pass: false, detail: t(`「${name}」 을 파티에 넣는 명령(changeParty add)이 ${onMap ? `「${onMap}」 의 ` : ""}${freshOnly(sc) && !eventBound(sc) ? "이번 턴에 만든 " : ""}도는 이벤트에 없다`, `no live ${freshOnly(sc) && !eventBound(sc) ? "new (this turn) " : ""}event ${onMap ? `on "${onMap}" ` : ""}adds "${name}" to the party (changeParty add)`) + seen + deadNote(scan.dead) + t(" — 동료는 DB 배우(upsert_actor)로 두고 그 인물 대화 끝에 changeParty add", " — make the companion a database actor (upsert_actor) and put changeParty add at the end of their talk") };
  }
  const world = walkWorld(project, startOf(project, ctx));
  for (const h of mine) {
    if (world.maps.has(h.map.id) && eventReached(h.map, world.reach.get(h.map.id), h.ev)) return { pass: true, detail: t(`동료 「${actorName(h.c.actorId)}」 합류 — ${at(h.map, h.ev)}, 시작에서 걸어 닿는다`, `companion "${actorName(h.c.actorId)}" joins — ${at(h.map, h.ev)}, reachable on foot from the start`), evidence: evEvidence(h.map, h.ev) };
  }
  const h = mine[0]!;
  return { pass: false, detail: t(`${at(h.map, h.ev)} 에 합류 명령은 있지만 시작에서 걸어 닿지 못한다`, `${at(h.map, h.ev)} has a join command but is not reachable on foot from the start`), evidence: evEvidence(h.map, h.ev) };
}
