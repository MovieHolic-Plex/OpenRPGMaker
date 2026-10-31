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
import { eventBodyRect } from "@/project/eventFootprintQuery";
import { hint, nameScore, normName } from "./names";
import type { CheckResult, TodoCheck, TodoCheckContext, TodoItem, TodoPlaceKind } from "./types";
import { layoutReviewRounds, REVIEWS_TAG } from "../layoutReview";

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
const WHAT_EN: Record<string, string> = { 맵: "map", 이벤트: "event", 아이템: "item", 장소: "place", 인물: "person", "말하는 인물": "speaker", "전투 상대": "battle opponent", "출발 맵": "start map", "도착 맵": "destination map", "증거 아이템": "evidence item", "증거를 받을 인물": "person receiving the evidence", 목표: "target", "실내 맵": "interior map" };

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
  street: /거리|골목|상가|상점가|시장|아케이드|street|market|arcade|shotengai/iu,
  field: /들판|평원|숲|길|초원|필드|언덕|field|forest|road|plain/iu,
  cave: /동굴|굴|cave|grotto/iu,
  dungeon: /던전|지하|미궁|묘지|탑|유적|보스|마왕성|dungeon|crypt|tower|ruin|labyrinth|boss/iu,
  // 「상점가」「가게 거리」는 거리다 — 「상점」이 맞아 상점가 거리가 실내로 읽혀 거리 항목이 세 번 실패했다(2026-10-30 asst-parity 마왕 편의점 opus).
  interior: /방|실|집|여관|상점(?!가)|가게(?!\s*거리)|교회|신전|성당|서재|관|저택|내부|room|house|inn|shop(?!ping)|hall|interior/iu,
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
    case "room_zones": return checkRoomZones(project, sc, check.map, check.min);
    case "room_graph": return checkRoomGraph(project, sc, check.map);
    case "layout_built": return checkLayoutBuilt(project, sc, check.map);
    case "layout_review": return checkLayoutReview(project, sc, check.map);
    case "code_lock": return checkCodeLock(project, sc, check.code, check.hintAfter, check.on);
  }
}

// ───────────── 번호 자물쇠 ─────────────
// 2026-11-01 값싼 모델 대조(gemini-3.8-flash 자물쇠 판): 할 일을 «목표 줄»로 확인하게 적어 자물쇠 없이 ✓ 로 닫았다. 요청 뼈대가
// 이 확인을 덧붙여 «입력 → 정답 분기 → 열림(+틀린 횟수 힌트)» 이 실제 명령으로 있어야 끝난다.
type CmdNode = Record<string, unknown>;
function branchesOf(c: CmdNode): CmdNode[][] {
  const out: CmdNode[][] = [];
  for (const k of ["then", "else", "body", "commands", "cancelBranch", "otherwiseBranch", "victoryBranch", "defeatBranch", "escapeBranch"]) if (Array.isArray(c[k])) out.push(c[k] as CmdNode[]);
  for (const o of (Array.isArray(c.options) ? c.options : []) as CmdNode[]) if (o && Array.isArray(o.branch)) out.push(o.branch as CmdNode[]);
  return out;
}
function flatCmds(list: unknown, out: CmdNode[] = []): CmdNode[] {
  for (const c of (Array.isArray(list) ? list : []) as CmdNode[]) { if (!c || typeof c !== "object") continue; out.push(c); for (const b of branchesOf(c)) flatCmds(b, out); }
  return out;
}
/** 정답 갈래가 실제로 무엇을 여나 — 이동·엔딩·타일·공통 이벤트·물건은 그 자체로, 스위치는 그 스위치를 조건으로 읽는 페이지·분기가
 * 그런 일을 할 때만(두 단계까지). 2026-11-01 cheap r6 deepseek: 정답에 스위치만 켜고 그 스위치로 «문이 조금 열렸다» 글만 보여
 * 서재 문은 그대로 잠겨 엔딩에 못 갔는데 ✓ 였다. */
const EFFECT = new Set(["transfer", "triggerEnding", "ending", "changeTile", "callCommonEvent", "changeItem"]);
function opensSomething(project: Project, ev: GameEvent, cmds: CmdNode[], depth = 0): boolean {
  if (cmds.some((c) => EFFECT.has(String(c.kind)))) return true;
  if (depth >= 2) return false;
  for (const c of cmds) {
    const self = c.kind === "setSelfSwitch";
    if (c.kind !== "setSwitch" && !self) continue;
    const key = self ? `"key":"${String(c.key ?? c.selfSwitch ?? "A")}"` : `"switchId":"${String(c.switchId)}"`;
    const reads = (cond: unknown) => { const j = JSON.stringify(cond ?? null); return j.includes(key) && (!self || j.includes("selfSwitch")); };
    for (const map of Object.values(project.maps)) for (const other of (map.events ?? []) as GameEvent[]) {
      if (self && other.id !== ev.id) continue;
      for (const page of ((other as unknown as { pages?: { conditions?: unknown; commands?: unknown }[] }).pages ?? [])) {
        if (reads(page.conditions) && opensSomething(project, other, flatCmds(page.commands), depth + 1)) return true;
        for (const f of flatCmds(page.commands)) if (f.kind === "fork" && reads(f.condition) && opensSomething(project, other, flatCmds(f.then), depth + 1)) return true;
      }
    }
  }
  return false;
}
function checkCodeLock(project: Project, sc: Scope, code: string, hintAfter?: number, on?: string): CheckResult {
  const want = Number(code);
  const notes: string[] = [];
  for (const map of Object.values(project.maps)) {
    for (const ev of (map.events ?? []) as GameEvent[]) {
      if (!eventInScope(sc, map, ev)) continue;
      const pages = ((ev as unknown as { pages?: { commands?: unknown }[] }).pages ?? [{ commands: (ev as unknown as { commands?: unknown }).commands }]);
      for (const page of pages) {
        const all = flatCmds(page.commands);
        const inputs = all.filter((c) => c.kind === "inputNumber" && typeof c.variableId === "string").map((c) => String(c.variableId));
        if (!inputs.length) continue;
        // 요청이 자물쇠 자리를 이름으로 말했으면(「자물쇠」를 조사하면 …) 그 이벤트여야 한다 — 2026-11-01 cheap r4 flash: 번호 입력을 「액자」에 붙이고 ✓ 로 닫았다.
        if (on && nameScore(on, String(ev.name ?? "")) <= 0) { notes.push(t(`${at(map, ev)}: 번호를 받지만 요청의 자물쇠는 「${on}」이다 — 「${on}」 이벤트에 붙인다`, `${at(map, ev)}: takes the number, but the request puts the lock on «${on}» — put it on the «${on}» event`)); continue; }
        const forks = all.filter((c) => c.kind === "fork");
        const right = forks.find((f) => { const k = f.condition as CmdNode | undefined; return k?.kind === "variable" && inputs.includes(String(k.variableId)) && Number(k.value) === want && (k.op === "==" || k.op === undefined); });
        if (!right) { notes.push(t(`${at(map, ev)}: 숫자를 받지만 ${code} 와 같은지 묻는 분기가 없다`, `${at(map, ev)}: takes a number but no fork compares it == ${code}`)); continue; }
        const opens = opensSomething(project, ev, flatCmds(right.then));
        if (!opens) { notes.push(t(`${at(map, ev)}: ${code} 정답 분기가 아무것도 열지 않는다 — 이동·엔딩이 없고, 켠 스위치를 읽어 문을 여는(이동·엔딩) 페이지도 없다`, `${at(map, ev)}: the == ${code} branch opens nothing — no transfer or ending, and no page reads the switch it sets to open a way out (a transfer or an ending)`)); continue; }
        if (hintAfter) {
          const counters = all.filter((c) => c.kind === "setVariable" && (c.op === "+=" || c.op === "+") && Number(c.value) === 1).map((c) => String(c.variableId));
          const hint = forks.find((f) => { const k = f.condition as CmdNode | undefined; return k?.kind === "variable" && counters.includes(String(k.variableId)) && Number(k.value) === hintAfter && [">=", "=="].includes(String(k.op)) && flatCmds(f.then).some((c) => c.kind === "text"); });
          if (!counters.length) { notes.push(t(`${at(map, ev)}: 틀린 횟수를 세는 명령(변수 +1)이 없다`, `${at(map, ev)}: nothing counts wrong tries (no variable += 1)`)); continue; }
          if (!hint) { notes.push(t(`${at(map, ev)}: 틀린 횟수가 ${hintAfter} 일 때 힌트 대사를 보이는 분기가 없다`, `${at(map, ev)}: no fork shows a hint line when the wrong-try count reaches ${hintAfter}`)); continue; }
        }
        return { pass: true, detail: t(`번호 자물쇠 ${code} — ${at(map, ev)}: 입력 → 정답 분기 → 열림${hintAfter ? ` · ${hintAfter}번째 오답 힌트` : ""}`, `number lock ${code} — ${at(map, ev)}: input → == ${code} → opens${hintAfter ? `, hint at wrong try ${hintAfter}` : ""}`), evidence: evEvidence(map, ev) };
      }
    }
  }
  return { pass: false, detail: notes.length ? notes.slice(0, 3).join(" / ") : t(`숫자를 입력받는(inputNumber) 이벤트가 없다 — 번호 ${code} 자물쇠가 아직 없다`, `no event asks for a number (inputNumber) — the ${code} lock does not exist yet`) };
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

/**
 * Literal lines a TypeScript event script shows (`game.showMessage("…")`, quotes or template text) — a script is a
 * real dialogue command (openwiki/script-sandbox.md). 2026-10-31 live run: a merchant written as one script kept
 * failing «has no live dialogue command», and the model added a plain text line in front just to pass.
 */
function scriptMessageLiterals(source: string): string[] {
  const out: string[] = [];
  const re = /game\.showMessage\(\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/gu;
  for (const m of source.matchAll(re)) if (m[2]?.trim()) out.push(m[2]);
  return out;
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
    for (const c of live.cmds) {
      if (c.kind === "text") lines.push({ map, ev, body: String(c.body ?? "") });
      else if (c.kind === "script") for (const body of scriptMessageLiterals(String(c.source ?? ""))) lines.push({ map, ev, body });
    }
    for (const d of live.dead) if (d.cmds.some((c) => c.kind === "text" || c.kind === "script")) dead.push({ map, ev, why: d.why });
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

// ───────────── 실내 구역·방 그래프 ─────────────
// 2026-10-30 mapvqa ③(판정자 gpt-6.1-sol, 사용자 기준 방과 쌍 비교): 진 방 = 한 칸짜리 방이라 조사할 곳이 없음·같은 서가/식탁 줄 반복,
// 이긴 방 = 서로 다른 구역·방을 오가게 만든 방(여러 방·계단·곁방·큰 랜드마크). 맵 데이터만 읽는다:
//  room_zones — 구역 = 빌더가 남긴 design-area 이름표(src/editor/handInterior/designAreaRecord.ts). 겹침(작은 쪽 60%↑)·같은 초점은 하나로 센다.
//    구역마다 초점이 놓여 닿고, 갈 이유(사람·살아 있는 조사·이동)가 있고, 같은 기물 줄 반복이 적어야 한다.
//  room_graph — 모델이 선언한 방 그래프(room-graph 이름표: 선언 JSON + 방마다 랜드마크·계단 자리)와 실제 맵을 맞춘다:
//    선언한 방이 모두 지어졌나 · 선언한 연결마다 두 방이 걸어서 이어지나(두 방 상자 + 그 사이 칸막이 줄만으로) · 모든 방에 입구에서 걸어 닿나 ·
//    선언한 계단이 놓여 닿나 · 방마다 선언한 랜드마크가 놓여 닿나.
const DESIGN_AREA = "design-area";
const ROOM_TAG = "hand-layout-room";
const GRAPH_TAG = "room-graph";
const SEAT = /chair|stool|bench|sofa|armchair|cushion|방석|의자/iu;
const REASON_KINDS = new Set(["text", "showText", "showChoices", "choice", "changeItem", "presentItem", "battleProcessing", "transfer", "shop", "shopProcessing", "inputNumber", "callCommonEvent"]);
type Loc = { name: string; x: number; y: number; w: number; h: number; tags?: string[]; note?: string };
const tagVal = (l: Loc, key: string) => (l.tags ?? []).find((g) => g.startsWith(`${key}:`))?.slice(key.length + 1);
const overlap = (a: Loc, b: Loc) => {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? (w * h) / Math.min(a.w * a.h, b.w * b.h) : 0;
};
const rectText = (l: { x: number; y: number; w: number; h: number }) => `(${l.x},${l.y}) ${l.w}×${l.h}`;
const locName = (l: Loc) => q(l.name);

/** 이 이벤트가 플레이어가 그 구역에 갈 이유인가(사람·살아 있는 조사·이동) — 이유 이름. */
function reasonOf(project: Project, ev: GameEvent): string | undefined {
  if (isAuto(ev)) return undefined;
  if (isPersonEvent(ev)) return t("사람", "person");
  const kinds = new Set(liveCmds(project, ev).cmds.map((c) => c.kind));
  if (kinds.has("transfer")) return t("이동", "transfer");
  if ([...kinds].some((k) => REASON_KINDS.has(k))) return t("조사", "inspect");
  return undefined;
}

/** 이벤트 몸체와 구역 상자 사이 칸 거리(겹치면 0). */
function rectGap(ev: GameEvent, z: Loc): number {
  const r = eventBodyRect(ev);
  const dx = Math.max(0, z.x - r.right, r.left - (z.x + z.w - 1)), dy = Math.max(0, z.y - r.bottom, r.top - (z.y + z.h - 1));
  return Math.max(dx, dy);
}

/**
 * 갈 이유를 구역에 나눠 준다 — 이벤트마다 가장 가까운 구역 하나(상자 안 0칸, 둘레 2칸까지).
 * 조사 지점을 가구 칸에 주면 이벤트 짓기(resolveWhere)가 문 곁·접근 칸을 피해 1~2칸 옮기므로 2칸까지 봐준다. 한 이벤트가 두 구역을 채우지 않는다.
 */
function assignReasons(project: Project, map: GameMap, reach: Uint8Array | undefined, zones: readonly Loc[]): Map<Loc, string[]> {
  const out = new Map<Loc, string[]>(zones.map((z) => [z, []]));
  for (const ev of map.events ?? []) {
    const why = reasonOf(project, ev);
    if (!why || (reach && !bodyReached(map, reach, ev))) continue;
    let best: Loc | undefined, gap = 3;
    for (const z of zones) { const g = rectGap(ev, z); if (g < gap) { gap = g; best = z; } }
    if (best) out.get(best)!.push(`${why} ${q(evLabel(ev))}(${ev.x},${ev.y})`);
  }
  return out;
}

/** 상자(x,y,w,h) 둘레 한 칸 가운데 걸어 닿는 칸이 있나(맵 밖은 건너뛴다). reach 가 없으면 true. */
function ringReached(map: GameMap, reach: Uint8Array | undefined, b: readonly [number, number, number, number]): boolean {
  if (!reach) return true;
  const [fx, fy, fw, fh] = b;
  for (let y = fy - 1; y <= fy + fh; y++) for (let x = fx - 1; x <= fx + fw; x++) {
    if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
    if (reach[y * map.width + x]) return true;
  }
  return false;
}
const boxTag = (l: Loc, key: string): [number, number, number, number] | undefined => {
  const v = tagVal(l, key)?.split(",").map(Number);
  return v && v.length === 4 && v.every((n) => Number.isFinite(n)) ? v as [number, number, number, number] : undefined;
};

/** 구역 하나 판정 — 문제 글 목록(빈 목록이면 통과)과 한 줄 요약. */
function zoneVerdict(map: GameMap, reach: Uint8Array | undefined, z: Loc, reasons: readonly string[]): { problems: string[]; line: string } {
  const problems: string[] = [];
  const focal = tagVal(z, "focal") ?? "?";
  const at = boxTag(z, "focal-at");
  let focalNote: string;
  if (!at) { focalNote = t(`초점 ${focal} 없음`, `focal ${focal} missing`); problems.push(t(`구역 ${locName(z)}: 초점 「${focal}」이 놓이지 않았다(설계 묶음에 없거나 자리가 없어 빠졌다) — 그 구역 묶음에 초점 기물을 넣어 다시 짓는다`, `zone ${locName(z)}: focal part "${focal}" was not placed (not in a design group, or no room for it) — put it in that zone's group and rebuild`)); }
  else {
    const ok = ringReached(map, reach, at);
    focalNote = `${t("초점", "focal")} ${focal}@${at[0]},${at[1]}${reach ? (ok ? t(" 닿음", " reachable") : t(" 못 닿음", " unreachable")) : ""}`;
    if (!ok) problems.push(t(`구역 ${locName(z)}: 초점 ${focal}(${at[0]},${at[1]}) 둘레 칸에 걸어 닿지 못한다 — 묶음 자리를 옮기거나 통로를 낸다`, `zone ${locName(z)}: no walkable cell next to focal ${focal}(${at[0]},${at[1]}) — move the group or open a path`));
  }
  if (!reasons.length) problems.push(t(`구역 ${locName(z)} ${rectText(z)}: 플레이어가 갈 이유가 없다 — 이 상자 안(또는 바로 옆) 칸에 조사 지점(add_event: 대사·단서·아이템)이나 사람(add_people)·계단을 둔다${z.note ? ` (설계의 오는 이유: ${z.note.split(" — 오는 이유: ")[1] ?? ""})` : ""}`,
    `zone ${locName(z)} ${rectText(z)}: no reason for the player to go there — put an inspect point (add_event: line, clue, item), a person (add_people) or stairs inside this box or right next to it${z.note ? ` (your design's reason: ${z.note.split(" — 오는 이유: ")[1] ?? ""})` : ""}`));
  return { problems, line: `${locName(z)} ${rectText(z)} ${focalNote} · ${t("이유", "reasons")} ${reasons.length ? reasons.slice(0, 2).join(", ") : t("없음", "none")}` };
}

/** 방 이름표의 놓인 기물 기록으로 반복을 본다. */
function repetitionProblems(rooms: readonly Loc[]): string[] {
  const out: string[] = [];
  for (const r of rooms) {
    const objs = tagVal(r, "objs");
    if (objs) {
      const counts = objs.split(";").map((p) => { const i = p.lastIndexOf("*"); return [p.slice(0, i), Number(p.slice(i + 1))] as const; }).filter(([id, n]) => id && n > 0 && !SEAT.test(id));
      const total = counts.reduce((a, [, n]) => a + n, 0);
      const top = counts.sort((a, b) => b[1] - a[1])[0];
      if (top && top[1] >= 5 && top[1] / total > 0.35) out.push(t(`방 ${locName(r)}: 같은 기물 ${top[0]} 가 ${top[1]}/${total}개 — 같은 줄 반복으로 보인다. 구역마다 다른 물건으로 나눈다`, `room ${locName(r)}: the same part ${top[0]} is ${top[1]} of ${total} — reads as a repeated row. Give each zone different things`));
    }
    const same = Number(tagVal(r, "same-groups") ?? 0);
    if (same >= 3) out.push(t(`방 ${locName(r)}: 기물 구성이 같은 묶음이 ${same}개 — 같은 식탁·서가 줄 반복. 묶음마다 쓰임을 달리한다`, `room ${locName(r)}: ${same} groups with the same parts — a repeated table/shelf row. Give each group its own use`));
  }
  return out;
}

function roomZonesOf(project: Project, m: GameMap, min: number): CheckResult {
  const locs = ((m.locations ?? []) as unknown as Loc[]);
  const rooms = locs.filter((l) => (l.tags ?? []).includes(ROOM_TAG));
  const zones = locs.filter((l) => (l.tags ?? []).includes(DESIGN_AREA));
  const designed = rooms.filter((r) => (r.tags ?? []).includes("model-designed"));
  // 방 그래프로 지은 맵은 방 하나가 구역 하나다(방 그래프 선언 + 방마다 랜드마크).
  const graphRooms = locs.filter((l) => (l.tags ?? []).includes(GRAPH_TAG) && tagVal(l, "room"));
  const asZones: Loc[] = zones.length ? zones : graphRooms.map((g) => ({ ...g, tags: [...(g.tags ?? []), ...(tagVal(g, "landmark") ? [`focal:${tagVal(g, "landmark")}`] : []), ...(tagVal(g, "landmark-at") ? [`focal-at:${tagVal(g, "landmark-at")}`] : [])] }));
  if (!asZones.length) {
    const why = designed.length ? t(`방 설계에 구역 칸(design.areas)이 없어 구역 기록이 없다 — edit_place({patch:{mapId:"${m.id}", design}}) 로 design.areas 2~4개({name, purpose, focal(초점 기물 id), visit(오는 이유)})와 묶음마다 area 를 넣어 다시 짓는다`,
      `the room design has no zones (design.areas), so no zones were recorded — rebuild with edit_place({patch:{mapId:"${m.id}", design}}) giving design.areas (2–4 of {name, purpose, focal (part id), visit (why the player comes)}) and an area on each group, or build several rooms (zones with x, y and connections)`)
      : rooms.length ? t(`이 맵의 방은 모델 설계(design)로 지어지지 않아 구역 기록이 없다 — 설계(design.areas·묶음 area)로 다시 짓는다`, `this map's rooms were not built from your design, so no zones were recorded — rebuild them from a design (design.areas, group area)`)
        : t(`이 맵은 구역 기록을 남기는 손 도트 실내 설계로 지어지지 않았다 — 실내면 make_place 설계(design.areas)로 짓고, 아니면 이 항목을 none 으로 바꾸거나 drop 한다`, `this map was not built as a designed hand-pixel interior — if it is an interior, build it with make_place and a design; otherwise drop this item`);
    return { pass: false, detail: `${mapAt(m)}: ${why}`, evidence: { mapId: m.id } };
  }
  // 겹침·같은 초점 구역은 하나로.
  const groups: Loc[][] = [];
  for (const z of asZones) {
    const g = groups.find((list) => list.some((o) => normName(o.name, true) === normName(z.name, true) || overlap(o, z) >= 0.6 || (tagVal(o, "focal") && tagVal(o, "focal") === tagVal(z, "focal") && tagVal(z, "focal") !== "(없음)")));
    if (g) g.push(z); else groups.push([z]);
  }
  const reach = mapReach(project, m);
  const problems: string[] = [];
  const lines: string[] = [];
  if (groups.length < min) problems.push(t(`서로 다른 구역 ${groups.length}개(필요 ${min}) — ${groups.length < asZones.length ? `구역 ${asZones.length}개 중 겹치거나 초점이 같은 것을 하나로 셌다. ` : ""}한 칸에 다 보이는 방은 조사할 곳이 없다. 쓰임이 다른 구역이나 방(곁방 zone·칸막이)을 더해 edit_place 로 다시 짓는다`,
    `${groups.length} distinct zones (need ${min}) — ${groups.length < asZones.length ? `of ${asZones.length} zones, overlapping ones or ones with the same focal part were counted once. ` : ""}a room you take in at one glance has nothing to explore. Add zones or rooms with different uses (a side-room zone with x, y and a connection) and rebuild with edit_place`));
  const reps: Loc[] = groups.map((g) => {
    if (g.length === 1) return g[0]!;
    const x0 = Math.min(...g.map((z) => z.x)), y0 = Math.min(...g.map((z) => z.y)), x1 = Math.max(...g.map((z) => z.x + z.w)), y1 = Math.max(...g.map((z) => z.y + z.h));
    const withFocal = g.find((z) => tagVal(z, "focal-at")) ?? g[0]!;
    return { ...withFocal, name: g.map((z) => z.name).join("+"), x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  });
  const reasons = assignReasons(project, m, reach, reps);
  for (const z of reps) {
    const v = zoneVerdict(m, reach, z, reasons.get(z) ?? []);
    lines.push(v.line);
    problems.push(...v.problems);
  }
  if (!reach) problems.push(t("이 맵에 들어오는 칸·시작점이 없어 걸어 볼 수 없다 — 문(create_transfer_pair)으로 잇는다", "this map has no entry cell or start point, so walking cannot be checked — link it with a door (create_transfer_pair)"));
  problems.push(...repetitionProblems(rooms));
  const head = `${mapAt(m)} ${t("구역", "zones")} ${groups.length}: ${lines.join(" / ")}`;
  if (problems.length) return { pass: false, detail: `${head} — ${t("걸린 것", "problems")}: ${problems.slice(0, 5).join(" / ")}`, evidence: { mapId: m.id } };
  return { pass: true, detail: head, evidence: { mapId: m.id } };
}

/** 이름으로 실내 맵 고르기(같은 이름 층 여럿이면 기록이 있는 맵을 먼저). */
function interiorMaps(project: Project, sc: Scope, name: string, tag: string): GameMap[] | CheckResult {
  const cands = Object.values(project.maps).filter((m) => mapInScope(sc, m)).map(mapNamed);
  const r = choose(name, cands, "실내 맵", has(sc.refs?.mapIds), () => allMapNames(project));
  if (!r.ok) return { pass: false, detail: `${r.result.detail}${scopeNote(sc, "맵")}` };
  const maps = r.picked.map((p) => p.t).filter((m) => !isPlaceholderMap(m));
  if (!maps.length) return { pass: false, detail: t(`${mapAt(r.picked[0]!.t)} 는 빈 자리표시 맵이다 — 방을 실제로 지어야 한다`, `${mapAt(r.picked[0]!.t)} is an empty placeholder map — the room has to be built`), evidence: { mapId: r.picked[0]!.t.id } };
  const tagged = maps.filter((m) => (m.locations ?? []).some((l) => (l.tags ?? []).includes(tag)));
  return tagged.length ? tagged : maps;
}

function checkRoomZones(project: Project, sc: Scope, name: string, min = 2): CheckResult {
  const maps = interiorMaps(project, sc, name, DESIGN_AREA);
  if (isResult(maps)) return maps;
  const results = maps.map((m) => roomZonesOf(project, m, min));
  return results.find((x) => x.pass) ?? results[0]!;
}

interface GraphDeclJson { rooms: { id: string; name: string; role?: string; stairs?: string; landmark?: string }[]; connections: { a: string; b: string; type: string }[]; entrance: string }

/**
 * 칸 배치로 지은 맵의 문짝 칸(잠긴 문·쇠창살 문·옆문) — 방 그래프·랜드마크 걷기에서 지나갈 수 있는 문으로 친다.
 * 왜(2026-10-31 bbox 이식 측정): 감방 쇠창살 문 칸은 타일 통행이 막혀 «선언한 연결이 막혔다 — 문 앞 가구를 옮겨라»가 떴고,
 * 모델이 쇠창살 문을 모두 떼어 감방이 트인 방이 됐다. 칸 배치 검사(interiorWalls)는 이미 문짝을 지나갈 수 있는 문으로 본다.
 */
function layoutDoorCells(m: GameMap): Set<number> {
  const out = new Set<number>();
  const loc = (m.locations ?? []).find((l) => (l.tags ?? []).includes(LAYOUT_TAG) && (l.tags ?? []).includes("decl"));
  if (!loc?.note) return out;
  try {
    const d = JSON.parse(loc.note) as { objects?: { id: string; x: number; y: number }[] };
    for (const o of d.objects ?? []) if (/\b(door|gate)\b/u.test(o.id) && o.x >= 0 && o.y >= 0 && o.x < m.width && o.y < m.height) out.add(o.y * m.width + o.x);
  } catch { /* 선언이 깨졌으면 문짝 없음 */ }
  return out;
}

/** 걷기 결과를 문짝 칸 너머로 넓힌다(문짝이 없으면 그대로). */
function reachThroughDoors(project: Project, map: GameMap, reach: Uint8Array | undefined, doors: ReadonlySet<number>): Uint8Array | undefined {
  if (!reach || !doors.size) return reach;
  const W = map.width, out = Uint8Array.from(reach);
  const q: number[] = [];
  for (let i = 0; i < out.length; i++) if (out[i]) q.push(i);
  while (q.length) {
    const i = q.pop()!, x = i % W, y = (i - x) / W;
    for (const [X, Y] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as const) {
      if (X < 0 || Y < 0 || X >= W || Y >= map.height) continue;
      const j = Y * W + X;
      if (!out[j] && (doors.has(j) || (doors.has(i) && isPassable(project, map, X, Y)))) { out[j] = 1; q.push(j); }
    }
  }
  return out;
}

/** 두 방 상자와 그 사이 칸막이 줄 안에서만 걸어 A 에서 B 로 가나(문·트인 칸이 실제로 뚫렸나). doors = 지나갈 수 있는 문짝 칸. */
function roomsJoined(project: Project, map: GameMap, a: Loc, b: Loc, doors: ReadonlySet<number> = new Set()): boolean {
  const x0 = Math.min(a.x, b.x), y0 = Math.min(a.y, b.y), x1 = Math.max(a.x + a.w, b.x + b.w) - 1, y1 = Math.max(a.y + a.h, b.y + b.h) - 1;
  const inA = (x: number, y: number) => x >= a.x && x < a.x + a.w && y >= a.y && y < a.y + a.h;
  const inB = (x: number, y: number) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h;
  // 허용 칸: 두 방 상자 + 두 상자 사이 칸막이(겹친 줄·열의 띠).
  const between = (x: number, y: number) => {
    const ox0 = Math.max(a.x, b.x), ox1 = Math.min(a.x + a.w, b.x + b.w) - 1, oy0 = Math.max(a.y, b.y), oy1 = Math.min(a.y + a.h, b.y + b.h) - 1;
    return (x >= ox0 && x <= ox1 && y >= y0 && y <= y1) || (y >= oy0 && y <= oy1 && x >= x0 && x <= x1);
  };
  const ok = (x: number, y: number) => x >= 0 && y >= 0 && x < map.width && y < map.height && (inA(x, y) || inB(x, y) || between(x, y)) && (doors.has(y * map.width + x) || isPassable(project, map, x, y));
  const seen = new Set<number>();
  const stack: [number, number][] = [];
  for (let y = a.y; y < a.y + a.h; y++) for (let x = a.x; x < a.x + a.w; x++) if (ok(x, y)) { stack.push([x, y]); seen.add(y * map.width + x); }
  while (stack.length) {
    const [x, y] = stack.pop()!;
    if (inB(x, y)) return true;
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as const) {
      const k = ny * map.width + nx;
      if (!seen.has(k) && ok(nx, ny)) { seen.add(k); stack.push([nx, ny]); }
    }
  }
  return false;
}

/** 방 상자 안에 걸어 닿는 칸이 있나. */
function roomReached(map: GameMap, reach: Uint8Array | undefined, r: Loc): boolean {
  if (!reach) return false;
  for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (x >= 0 && y >= 0 && x < map.width && y < map.height && reach[y * map.width + x]) return true;
  return false;
}

function roomGraphOf(project: Project, m: GameMap): CheckResult {
  const locs = ((m.locations ?? []) as unknown as Loc[]);
  const declLoc = locs.find((l) => (l.tags ?? []).includes(GRAPH_TAG) && (l.tags ?? []).includes("decl"));
  let decl: GraphDeclJson | undefined;
  try { decl = declLoc?.note ? JSON.parse(declLoc.note) as GraphDeclJson : undefined; } catch { decl = undefined; }
  if (!decl?.rooms?.length) {
    return { pass: false, detail: t(`${mapAt(m)}: 방 그래프 선언이 없다 — 실내를 여러 방으로 지으려면 make_place/edit_place 의 zones 마다 id·x·y·design(w,h)·landmark 를 주고 connections:[{a,b,type:"door"|"open"}]·entrance 를 준다`,
      `${mapAt(m)}: no room graph was declared — to build the interior as rooms, give each zone id, x, y, design (w, h) and landmark, plus connections:[{a, b, type:"door"|"open"}] and entrance, in make_place/edit_place`), evidence: { mapId: m.id } };
  }
  const roomLocs = new Map(locs.filter((l) => (l.tags ?? []).includes(GRAPH_TAG) && tagVal(l, "room")).map((l) => [tagVal(l, "room")!, l] as const));
  const doors = layoutDoorCells(m);
  const reach = reachThroughDoors(project, m, mapReach(project, m), doors);
  const problems: string[] = [];
  const built = decl.rooms.filter((r) => roomLocs.has(r.id));
  const lost = decl.rooms.filter((r) => !roomLocs.has(r.id));
  if (lost.length) problems.push(t(`선언한 방 ${lost.map((r) => q(r.id)).join(", ")} 이 맵에 없다`, `declared rooms ${lost.map((r) => q(r.id)).join(", ")} are not on the map`));
  if (!reach) problems.push(t("들어오는 칸·시작점이 없어 걸어 볼 수 없다 — 문(create_transfer_pair)으로 잇는다", "no entry cell or start point, so walking cannot be checked — link it with a door (create_transfer_pair)"));
  const unreached = built.filter((r) => !roomReached(m, reach, roomLocs.get(r.id)!));
  if (reach && unreached.length) problems.push(t(`입구에서 걸어 닿지 못하는 방: ${unreached.map((r) => q(r.id)).join(", ")} — 연결을 더하거나 문 앞을 비운다`, `rooms not reachable on foot from the entrance: ${unreached.map((r) => q(r.id)).join(", ")} — add a connection or clear the doorway`));
  const cut = decl.connections.filter((c) => roomLocs.has(c.a) && roomLocs.has(c.b) && !roomsJoined(project, m, roomLocs.get(c.a)!, roomLocs.get(c.b)!, doors));
  if (cut.length) problems.push(t(`선언한 연결이 막혔다: ${cut.map((c) => `${c.a}–${c.b}`).join(", ")} — 문·트인 칸 앞의 가구를 옮긴다`, `declared connections are blocked: ${cut.map((c) => `${c.a}–${c.b}`).join(", ")} — move the furniture away from that doorway`));
  const lines: string[] = [];
  for (const r of built) {
    const l = roomLocs.get(r.id)!;
    const bits: string[] = [];
    if (r.landmark) {
      const at = boxTag(l, "landmark-at");
      if (!at) problems.push(t(`방 ${q(r.id)}: 랜드마크 ${r.landmark} 가 놓이지 않았다 — 그 방 design.groups 에 넣는다(id 는 room_parts)`, `room ${q(r.id)}: landmark ${r.landmark} was not placed — put it in that room's design.groups (ids from room_parts)`));
      else if (!ringReached(m, reach, at)) problems.push(t(`방 ${q(r.id)}: 랜드마크 ${r.landmark}(${at[0]},${at[1]}) 둘레에 걸어 닿지 못한다`, `room ${q(r.id)}: no walkable cell next to landmark ${r.landmark}(${at[0]},${at[1]})`));
      bits.push(`${t("랜드마크", "landmark")} ${r.landmark}${at ? `@${at[0]},${at[1]}` : t(" 없음", " missing")}`);
    } else if ((decl as { source?: string }).source !== "layout") problems.push(t(`방 ${q(r.id)}: 랜드마크를 선언하지 않았다 — zone.landmark 에 그 방의 눈길을 끄는 큰 기물 id 하나`, `room ${q(r.id)}: no landmark declared — set zone.landmark to the one big part the room is built around`));
    if (r.stairs) {
      const at = boxTag(l, "stairs-at");
      if (!at) problems.push(t(`방 ${q(r.id)}: 계단(${r.stairs})을 선언했지만 계단 기물이 없다 — stairs up wood·stairs down 같은 계단을 그 방 design.groups 에`, `room ${q(r.id)}: stairs (${r.stairs}) declared but no stairs part was placed — put a stairs part (stairs up wood, stairs down…) in that room's design.groups`));
      else if (!ringReached(m, reach, at)) problems.push(t(`방 ${q(r.id)}: 계단(${at[0]},${at[1]})에 걸어 닿지 못한다`, `room ${q(r.id)}: the stairs at (${at[0]},${at[1]}) cannot be reached on foot`));
      bits.push(`${t("계단", "stairs")} ${r.stairs}${at ? "" : t(" 없음", " missing")}`);
    }
    if (r.role) bits.push(r.role);
    lines.push(`${q(r.id)} ${rectText(l)}${bits.length ? ` ${bits.join(" · ")}` : ""}`);
  }
  if ((decl as { source?: string }).source === "layout" && !built.some((r) => r.landmark)) problems.push(t("랜드마크가 없다 — layout.landmark 에 장소가 서는 큰 기물 하나", "no landmark — set layout.landmark to the one big piece the place is built around"));
  const head = `${mapAt(m)} ${t("방", "rooms")} ${built.length}/${decl.rooms.length}, ${t("연결", "connections")} ${decl.connections.length - cut.length}/${decl.connections.length}: ${lines.join(" / ")}`;
  if (problems.length) return { pass: false, detail: `${head} — ${t("걸린 것", "problems")}: ${problems.slice(0, 6).join(" / ")}`, evidence: { mapId: m.id } };
  return { pass: true, detail: head, evidence: { mapId: m.id } };
}

const LAYOUT_TAG = "interior-layout";
interface LayoutDeclJson { regions: { id: string; x: number; y: number; w: number; h: number; cells?: number }[]; objects: { id: string; x: number; y: number; w: number; h: number }[]; landmark?: { id: string; x: number; y: number; w: number; h: number }; entrance: { x: number; y: number }; required?: { ask: string; ok: boolean; why?: string }[] }

/** 칸 배치로 지은 맵: 선언한 방(영역)과 기물이 지금 맵에 있나 — 방 칸이 막힌 칸이 아니고, 기물 발자국에 그림이 있다. 랜드마크는 걸어 닿아야 한다. */
function layoutBuiltOf(project: Project, m: GameMap): CheckResult {
  const decl0 = (m.locations ?? []).find((l) => (l.tags ?? []).includes(LAYOUT_TAG) && (l.tags ?? []).includes("decl"));
  let decl: LayoutDeclJson | undefined;
  try { decl = decl0?.note ? JSON.parse(decl0.note) as LayoutDeclJson : undefined; } catch { decl = undefined; }
  if (!decl?.regions?.length) return { pass: false, detail: t(`${mapAt(m)}: 칸 배치 선언이 없다 — make_place spec.layout 으로 짓는다`, `${mapAt(m)}: no layout record — build it with make_place spec.layout`), evidence: { mapId: m.id } };
  const W = m.width, idx = (x: number, y: number) => y * W + x;
  const solid = m.lowerTiles[0];
  const art = (x: number, y: number) => [m.upperTiles, m.upperOverlayTiles, m.lowerOverlayTiles].some((layer) => ((layer as number[] | undefined)?.[idx(x, y)] ?? -1) >= 0);
  const problems: string[] = [];
  const lostRooms = decl.regions.filter((r) => {
    let n = 0, open = 0;
    // 벽 우선 형식은 방 칸 수(cells)를 남긴다 — 상자 안 열린 칸이 그 80% 이상이면 선 것으로 본다(L 자 방의 상자엔 벽 칸이 섞인다).
    if (typeof r.cells === "number") { for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (x < W && y < m.height && m.lowerTiles[idx(x, y)] !== solid) open++; return open < 0.8 * r.cells; }
    for (let y = r.y + 2; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) { if (x >= W || y >= m.height) continue; n++; if (m.lowerTiles[idx(x, y)] !== solid) open++; }
    return n > 0 && open / n < 0.8;
  });
  if (lostRooms.length) problems.push(t(`선언한 방이 맵에 없다: ${lostRooms.map((r) => q(r.id)).join(", ")}`, `declared regions are gone from the map: ${lostRooms.map((r) => q(r.id)).join(", ")}`));
  const lostObjs = decl.objects.filter((o) => { for (let y = o.y; y < o.y + Math.max(1, o.h); y++) for (let x = o.x; x < o.x + o.w; x++) if (art(x, y)) return false; return true; });
  if (lostObjs.length) problems.push(t(`선언한 기물 ${lostObjs.length}개가 맵에 없다: ${lostObjs.slice(0, 8).map((o) => `${o.id}@${o.x},${o.y}`).join(", ")}`, `${lostObjs.length} declared pieces are not on the map: ${lostObjs.slice(0, 8).map((o) => `${o.id}@${o.x},${o.y}`).join(", ")}`));
  // 요청 물건(layout.required): 고치기를 다 쓰고도 남은 것 — 덧그림으로만 보이거나 놓지 않은 것(interiorRoomChecks.requiredCheck)
  const unmet = (decl.required ?? []).filter((r) => !r.ok);
  if (unmet.length) problems.push(t(`요청 물건이 안 보인다: ${unmet.map((r) => `${q(r.ask)}(${r.why ?? ""})`).join(", ")}`, `requested items not shown: ${unmet.map((r) => `${q(r.ask)} (${r.why ?? "unmet"})`).join(", ")} — place a standing piece for each with review_layout`));
  if (!decl.landmark) problems.push(t("랜드마크가 없다", "no landmark"));
  else {
    const reach = reachThroughDoors(project, m, mapReach(project, m), layoutDoorCells(m));
    const lm = decl.landmark;
    if (reach && !ringReached(m, reach, [lm.x, lm.y, lm.w, Math.max(1, lm.h)])) problems.push(t(`랜드마크 ${lm.id}(${lm.x},${lm.y}) 둘레에 걸어 닿지 못한다`, `landmark ${lm.id} at (${lm.x},${lm.y}) has no walkable cell next to it`));
  }
  const head = `${mapAt(m)} ${t("영역", "regions")} ${decl.regions.length - lostRooms.length}/${decl.regions.length}, ${t("기물", "pieces")} ${decl.objects.length - lostObjs.length}/${decl.objects.length}${decl.landmark ? `, ${t("랜드마크", "landmark")} ${decl.landmark.id}` : ""}`;
  if (problems.length) return { pass: false, detail: `${head} — ${t("걸린 것", "problems")}: ${problems.join(" / ")}`, evidence: { mapId: m.id } };
  return { pass: true, detail: head, evidence: { mapId: m.id } };
}

function checkLayoutBuilt(project: Project, sc: Scope, name: string): CheckResult {
  const maps = interiorMaps(project, sc, name, LAYOUT_TAG);
  if (isResult(maps)) return maps;
  const results = maps.map((m) => layoutBuiltOf(project, m));
  const bad = results.find((r) => !r.pass);
  return bad ?? results[0]!;
}

/** 자기 검토(review_layout) 바퀴: 칸 배치 선언 위치의 reviews:N 태그. */
function checkLayoutReview(project: Project, sc: Scope, name: string): CheckResult {
  const maps = interiorMaps(project, sc, name, LAYOUT_TAG);
  if (isResult(maps)) return maps;
  const want = layoutReviewRounds();
  const results = maps.map((m): CheckResult => {
    const decl = (m.locations ?? []).find((l) => (l.tags ?? []).includes(LAYOUT_TAG) && (l.tags ?? []).includes("decl"));
    const n = Number((decl?.tags ?? []).find((x) => x.startsWith(REVIEWS_TAG))?.slice(REVIEWS_TAG.length) ?? 0) || 0;
    if (!decl) return { pass: false, detail: t(`${mapAt(m)}: 칸 배치 선언이 없다`, `${mapAt(m)}: no layout record — build it with make_place spec.layout`), evidence: { mapId: m.id } };
    return n >= want
      ? { pass: true, detail: t(`${mapAt(m)} 자기 검토 ${n}바퀴`, `${mapAt(m)} self-reviewed ${n} round(s)`), evidence: { mapId: m.id } }
      : { pass: false, detail: t(`${mapAt(m)} 자기 검토 ${n}/${want}바퀴 — 그림을 플레이어 눈으로 보고 review_layout 을 보낸다`, `${mapAt(m)} self-review ${n}/${want} — look at its picture as a player walking in and send review_layout({mapId:"${m.id}", problems, patch}) (empty patch if nothing is wrong)`), evidence: { mapId: m.id } };
  });
  return results.find((r) => !r.pass) ?? results[0]!;
}

function checkRoomGraph(project: Project, sc: Scope, name: string): CheckResult {
  const maps = interiorMaps(project, sc, name, GRAPH_TAG);
  if (isResult(maps)) return maps;
  const results = maps.map((m) => roomGraphOf(project, m));
  return results.find((x) => x.pass) ?? results[0]!;
}
