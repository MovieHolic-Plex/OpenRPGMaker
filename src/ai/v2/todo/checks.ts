// omo 할 일 항목의 기계 검사 — 모델이 「다 됐다」고 표시한 항목을 프로젝트만 읽어 결정적으로 판정한다(순수 함수, 부작용 없음).
//
// 이름은 느슨히 맞추고(./names.ts), 못 찾으면 detail 에 가장 가까운 후보를 적어 모델이 다음 바퀴에 고칠 수 있게 한다.
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
import { hint, nameMatches, nameScore, normName } from "./names";
import type { CheckResult, TodoCheck, TodoPlaceKind } from "./types";

type Obj = Record<string, unknown>;
type Cmd = Obj & { kind: string };
export interface TodoCheckContext { startMapId?: string }

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
const deadCache = new WeakMap<GameEvent, (string | undefined)[]>();
function deadPages(project: Project, ev: GameEvent): (string | undefined)[] {
  const hit = deadCache.get(ev);
  if (hit) return hit;
  const pages = ev.pages ?? [];
  const f = liveFacts(project);
  const out: (string | undefined)[] = pages.map(() => undefined);
  if (pages.length > 1) {
    for (const sh of findShadowedPages(pages)) out[sh.index] ??= `페이지 ${sh.index + 1} 은 뒤 페이지 ${sh.byIndex + 1}(조건이 같거나 더 적다)에 가려 영영 안 돈다`;
    for (const ss of findSetterShadowedPages(pages, f.setters, f.startOn)) out[ss.index] ??= `페이지 ${ss.index + 1} 의 스위치 ${ss.switchIds.join("·")} 를 켜는 곳이 모두 페이지 ${ss.byIndex + 1} 조건(${ss.bySwitchIds.join("·")})도 켜서 영영 안 돈다`;
  }
  pages.forEach((page, index) => {
    if (out[index]) return;
    const missing: string[] = [];
    const visit = (c: unknown): void => {
      const r = c as Obj | undefined;
      if (!r || typeof r !== "object") return;
      if (r.kind === "switch" && r.value !== false && typeof r.switchId === "string" && !f.written.has(r.switchId)) missing.push(`스위치 ${r.switchId}(켜는 곳 없음)`);
      if (r.kind === "item" && r.present !== false && typeof r.itemId === "string" && !f.given.has(r.itemId)) missing.push(`아이템 ${r.itemId}(주는 곳 없음)`);
      if (r.kind === "all" && Array.isArray(r.conditions)) r.conditions.forEach(visit);
    };
    (page.conditions ?? []).forEach(visit);
    if (missing.length) out[index] = `페이지 ${index + 1} 조건 ${missing.join(", ")}`;
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
  dead.length ? ` — 영영 안 도는 페이지에만 있다: ${dead.slice(0, 2).map((d) => `${at(d.map, d.ev)} ${d.why}`).join(" / ")}` : "";

const trigOf = (ev: GameEvent, p: { trigger?: unknown }): string => {
  const t = p.trigger ?? (ev as unknown as Obj).trigger;
  return typeof t === "string" ? t : String((t as { kind?: string } | undefined)?.kind ?? "action");
};
const isAuto = (ev: GameEvent) => (ev.pages ?? []).some((p) => { const t = trigOf(ev, p); return t === "auto" || t === "parallel"; });

// ───────────── 이름 ─────────────

const mapLabel = (m: GameMap) => String((m as unknown as Obj).displayName ?? "").trim() || String(m.name ?? m.id);
const mapNamesOf = (m: GameMap): string[] => [String(m.name ?? ""), String((m as unknown as Obj).displayName ?? ""), m.id].filter(Boolean);
const evLabel = (ev: GameEvent) => String(ev.name ?? "").trim() || ev.id;
const at = (m: GameMap, ev: GameEvent) => `「${mapLabel(m)}」 「${evLabel(ev)}」(${ev.x},${ev.y})`;

/** 이 이벤트를 부르는 이름들: 이벤트 이름·id, 대사 화자, 인물 프로필 이름. */
function eventNames(project: Project, ev: GameEvent): string[] {
  const out = new Set<string>([String(ev.name ?? ""), ev.id]);
  // 대사 화자(부르는 공통 이벤트 속까지)와 이 이벤트가 거는 전투의 적 그룹·적 이름 — 이름 없는 보스 이벤트(「…_boss」, 대사는 공통 이벤트)도 찾게.
  for (const c of deepCmds(project, ev)) {
    if (c.kind === "text" && typeof c.speaker === "string" && c.speaker.trim()) out.add(c.speaker.trim());
    if (c.kind === "battleProcessing") for (const n of troopNames(project, c.troopId)) out.add(n);
  }
  const cid = (ev as unknown as Obj).characterId;
  if (typeof cid === "string") { out.add(cid); const prof = (project.characters ?? {})[cid] as Obj | undefined; if (typeof prof?.name === "string") out.add(prof.name); }
  return [...out].filter(Boolean);
}
const evScore = (project: Project, want: string, ev: GameEvent) => Math.max(0, ...eventNames(project, ev).map((n) => nameScore(want, n)));

function findMaps(project: Project, want: string): GameMap[] {
  const scored = Object.values(project.maps).map((m) => ({ m, s: Math.max(0, ...mapNamesOf(m).map((n) => nameScore(want, n))) })).filter((x) => x.s > 0);
  const top = Math.max(0, ...scored.map((x) => x.s));
  return scored.filter((x) => x.s === top).map((x) => x.m);
}
const allMapNames = (project: Project) => Object.values(project.maps).map(mapLabel);

/** map 으로 좁히기: 이름이 주어졌으면 맞는 맵들, 아니면 전부. 못 찾으면 실패 결과. */
function scopeMaps(project: Project, map: string | undefined): GameMap[] | CheckResult {
  if (!map) return Object.values(project.maps);
  const found = findMaps(project, map);
  return found.length ? found : { pass: false, detail: `맵 「${map}」 이 없다.${hint(map, allMapNames(project))}` };
}
const isResult = (x: unknown): x is CheckResult => !!x && typeof x === "object" && "pass" in x && "detail" in x;

/** 이름이 맞는 이벤트(가장 잘 맞는 점수만). */
function findEvents(project: Project, maps: readonly GameMap[], want: string, filter: (ev: GameEvent) => boolean = () => true): { map: GameMap; ev: GameEvent }[] {
  const hits: { map: GameMap; ev: GameEvent; s: number }[] = [];
  for (const map of maps) for (const ev of map.events ?? []) { if (!filter(ev)) continue; const s = evScore(project, want, ev); if (s > 0) hits.push({ map, ev, s }); }
  const top = Math.max(0, ...hits.map((h) => h.s));
  return hits.filter((h) => h.s === top);
}
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
  switch (check.kind) {
    case "none": return { pass: true, detail: "판정자 확인 항목" };
    case "place": return checkPlace(project, check.name, check.placeKind);
    case "person": return checkPerson(project, check.name, check.map);
    case "talk": return checkTalk(project, check.who, check.says);
    case "battle": return checkBattle(project, check.who, check.map, check.boss);
    case "link": return checkLink(project, check.from, check.to);
    case "ending": return checkEnding(project, ctx, check.map);
    case "item": return checkItem(project, check.name, check.gives);
    case "present_evidence": return checkPresent(project, check.item, check.to);
    case "objective": return checkObjective(project, check.text);
    case "reachable": return checkReachable(project, check.target, check.from, ctx);
  }
}

function checkPlace(project: Project, name: string, kind?: TodoPlaceKind): CheckResult {
  const maps = findMaps(project, name);
  if (!maps.length) return { pass: false, detail: `장소 「${name}」 맵이 없다.${hint(name, allMapNames(project))}` };
  const real = maps.filter((m) => !isPlaceholderMap(m));
  if (!real.length) return { pass: false, detail: `「${mapLabel(maps[0]!)}」 는 바닥 한 가지뿐인 빈 자리표시 맵이다 — 장소를 실제로 지어야 한다`, evidence: { mapId: maps[0]!.id } };
  if (!kind) return { pass: true, detail: `장소 「${mapLabel(real[0]!)}」 가 있다(${real[0]!.width}×${real[0]!.height}, 이벤트 ${real[0]!.events?.length ?? 0})`, evidence: { mapId: real[0]!.id } };
  for (const m of real) {
    const ks = mapKinds(m);
    if (!ks.size || ks.has(kind) || [...ks].some((k) => GROUP[k] === GROUP[kind])) return { pass: true, detail: `장소 「${mapLabel(m)}」 가 있다(종류 ${ks.size ? [...ks].join("/") : "모름"}, 요청 ${kind})`, evidence: { mapId: m.id } };
  }
  const m = real[0]!;
  return { pass: false, detail: `「${mapLabel(m)}」 는 ${[...mapKinds(m)].join("/")} 로 보인다 — ${kind} 장소가 아니다`, evidence: { mapId: m.id } };
}

function checkPerson(project: Project, name: string, map?: string): CheckResult {
  const scope = scopeMaps(project, map);
  if (isResult(scope)) return scope;
  const hits = findEvents(project, scope, name, isPersonEvent);
  if (hits.length) { const h = hits[0]!; return { pass: true, detail: `인물 ${at(h.map, h.ev)}`, evidence: { mapId: h.map.id, eventId: h.ev.id, x: h.ev.x, y: h.ev.y } }; }
  const elsewhere = map ? findEvents(project, Object.values(project.maps), name, isPersonEvent)[0] : undefined;
  if (elsewhere) return { pass: false, detail: `「${name}」 는 「${mapLabel(elsewhere.map)}」 에 있다 — 「${map}」 에는 없다`, evidence: { mapId: elsewhere.map.id, eventId: elsewhere.ev.id, x: elsewhere.ev.x, y: elsewhere.ev.y } };
  const faceless = findEvents(project, scope, name)[0];
  if (faceless) return { pass: false, detail: `${at(faceless.map, faceless.ev)} 는 있지만 사람 그림(걷기 칩)이 없다`, evidence: { mapId: faceless.map.id, eventId: faceless.ev.id, x: faceless.ev.x, y: faceless.ev.y } };
  return { pass: false, detail: `인물 「${name}」 이 ${map ? `「${map}」 에` : "어느 맵에도"} 없다.${hint(name, eventNameList(scope, isPersonEvent))}` };
}

function checkTalk(project: Project, who: string, says?: string): CheckResult {
  const maps = Object.values(project.maps);
  // 그 인물 이벤트의 대사, 또는 어느 이벤트든 화자가 그 인물인 대사.
  const named = new Set(findEvents(project, maps, who).map((h) => h.ev));
  const scan = scanLive(project, maps, (c, ev) => c.kind === "text" && (named.has(ev) || (typeof c.speaker === "string" && nameMatches(who, c.speaker))));
  const lines = scan.hits.map((h) => ({ map: h.map, ev: h.ev, body: String(h.c.body ?? "") }));
  if (!lines.length) {
    if (scan.dead.length) return { pass: false, detail: `「${who}」 대사가 있지만${deadNote(scan.dead)}`, evidence: { mapId: scan.dead[0]!.map.id, eventId: scan.dead[0]!.ev.id, x: scan.dead[0]!.ev.x, y: scan.dead[0]!.ev.y } };
    const any = [...named][0];
    if (any) { const m = maps.find((mm) => mm.events?.includes(any))!; return { pass: false, detail: `${at(m, any)} 에 대사 명령이 없다`, evidence: { mapId: m.id, eventId: any.id, x: any.x, y: any.y } }; }
    const speakers = maps.flatMap((m) => (m.events ?? []).flatMap((ev) => [String(ev.name ?? ""), ...eventCmds(ev).filter((c) => c.kind === "text").map((c) => String(c.speaker ?? ""))]));
    return { pass: false, detail: `「${who}」 가 말하는 대사가 없다(그 이름의 이벤트·화자 없음).${hint(who, speakers)}` };
  }
  if (says) {
    const want = normName(says, true);
    const hit = lines.find((l) => normName(l.body, true).includes(want));
    if (!hit) return { pass: false, detail: `「${who}」 대사 ${lines.length}줄에 「${says}」 가 없다 — 예: 「${lines[0]!.body.slice(0, 40)}」${deadNote(scan.dead.filter((d) => liveCmds(project, d.ev).dead.some((x) => x.cmds.some((c) => c.kind === "text" && normName(String(c.body ?? ""), true).includes(want)))))}`, evidence: { mapId: lines[0]!.map.id, eventId: lines[0]!.ev.id } };
    return { pass: true, detail: `${at(hit.map, hit.ev)}: 「${hit.body.slice(0, 50)}」`, evidence: { mapId: hit.map.id, eventId: hit.ev.id, x: hit.ev.x, y: hit.ev.y } };
  }
  const l = lines[0]!;
  return { pass: true, detail: `${at(l.map, l.ev)} 대사 ${lines.length}줄: 「${l.body.slice(0, 40)}」`, evidence: { mapId: l.map.id, eventId: l.ev.id, x: l.ev.x, y: l.ev.y } };
}

function checkBattle(project: Project, who?: string, map?: string, boss?: boolean): CheckResult {
  const scope = scopeMaps(project, map);
  if (isResult(scope)) return scope;
  const scan = scanLive(project, scope, (c) => c.kind === "battleProcessing");
  const all = scan.hits.map((h) => ({ map: h.map, ev: h.ev, c: h.c, names: [...eventNames(project, h.ev), ...troopNames(project, h.c.troopId)] }));
  if (!all.length) return { pass: false, detail: `${map ? `「${map}」 에` : "어느 맵에도"} 도는 전투 명령(battleProcessing)이 있는 이벤트가 없다${deadNote(scan.dead)}` };
  let cands = all;
  if (who) {
    const scored = all.map((b) => ({ b, s: Math.max(0, ...b.names.map((n) => nameScore(who, n))) })).filter((x) => x.s > 0);
    const top = Math.max(0, ...scored.map((x) => x.s));
    cands = scored.filter((x) => x.s === top).map((x) => x.b);
    if (!cands.length) return { pass: false, detail: `「${who}」 와의 전투가 없다 — 있는 전투: ${[...new Set(all.map((b) => `${evLabel(b.ev)}(${troopOf(project, b.c.troopId)?.name ?? String(b.c.troopId)})`))].slice(0, 6).join(", ")}` };
  }
  const desc = (b: (typeof all)[number]) => `${at(b.map, b.ev)} 적 그룹 「${troopOf(project, b.c.troopId)?.name ?? String(b.c.troopId)}」${b.c.canEscape === false ? " 도망 불가" : ""}`;
  if (boss) {
    const hit = cands.find((b) => isBossBattle(project, b.ev, b.c));
    if (!hit) return { pass: false, detail: `${desc(cands[0]!)} 는 보스전으로 안 보인다(이름·그룹에 보스 낱말 없음, 도망 가능) — 보스면 canEscape:false·보스 그룹으로`, evidence: { mapId: cands[0]!.map.id, eventId: cands[0]!.ev.id, x: cands[0]!.ev.x, y: cands[0]!.ev.y } };
    return { pass: true, detail: `보스전 ${desc(hit)}`, evidence: { mapId: hit.map.id, eventId: hit.ev.id, x: hit.ev.x, y: hit.ev.y } };
  }
  const b = cands[0]!;
  return { pass: true, detail: `전투 ${desc(b)}`, evidence: { mapId: b.map.id, eventId: b.ev.id, x: b.ev.x, y: b.ev.y } };
}

function checkLink(project: Project, from: string, to: string): CheckResult {
  const fromMaps = findMaps(project, from), toMaps = findMaps(project, to);
  if (!fromMaps.length) return { pass: false, detail: `출발 맵 「${from}」 이 없다.${hint(from, allMapNames(project))}` };
  if (!toMaps.length) return { pass: false, detail: `도착 맵 「${to}」 이 없다.${hint(to, allMapNames(project))}` };
  const toIds = new Set(toMaps.map((m) => m.id));
  const problems: string[] = [];
  for (const fm of fromMaps) {
    const links = transfersOut(fm).filter((t) => toIds.has(t.to.mapId));
    if (!links.length) { problems.push(`「${mapLabel(fm)}」 에 「${to}」 로 가는 이동 이벤트가 없다`); continue; }
    const reach = mapReach(project, fm);
    for (const t of links) {
      const target = project.maps[t.to.mapId]!;
      const landOk = t.to.x >= 0 && t.to.y >= 0 && t.to.x < target.width && t.to.y < target.height && isPassable(project, target, t.to.x, t.to.y);
      const fromOk = eventReached(fm, reach, t.ev);
      const ev = { mapId: fm.id, eventId: t.ev.id, x: t.ev.x, y: t.ev.y };
      if (fromOk && landOk) return { pass: true, detail: `${at(fm, t.ev)} → 「${mapLabel(target)}」(${t.to.x},${t.to.y}) 걸어 닿고 도착 칸도 걸을 수 있다`, evidence: ev };
      problems.push(`${at(fm, t.ev)} → 「${mapLabel(target)}」(${t.to.x},${t.to.y}): ${!reach ? "이 맵에 들어오는 칸·시작점이 없어 걸어 볼 수 없다" : !fromOk ? "들어오는 칸에서 걸어 닿지 못한다" : "도착 칸이 벽·물건이다"}`);
    }
  }
  return { pass: false, detail: problems.slice(0, 3).join(" / ") };
}

const ENDING_KINDS = new Set(["triggerEnding", "ending", "returnToTitle"]);

function checkEnding(project: Project, ctx: TodoCheckContext, onMap?: string): CheckResult {
  const scope = scopeMaps(project, onMap);
  if (isResult(scope)) return scope;
  const unsetEndings = new Set(endingConditionsUnset(project).map((b) => b.evidence.split(":")[0]!));
  const scan = scanLive(project, scope, (c) => ENDING_KINDS.has(c.kind));
  const sites: { map: GameMap; ev: GameEvent; kind: string; why?: string }[] = [];
  const seen = new Set<GameEvent>();
  for (const h of scan.hits) {
    if (seen.has(h.ev)) continue;
    seen.add(h.ev);
    const why = h.c.kind === "triggerEnding" && typeof h.c.endingId === "string" && unsetEndings.has(h.c.endingId) ? `엔딩 ${h.c.endingId} 의 조건 스위치·변수를 켜는 곳이 없다` : undefined;
    sites.push({ map: h.map, ev: h.ev, kind: h.c.kind, why });
  }
  for (const d of scan.dead) if (!seen.has(d.ev)) sites.push({ map: d.map, ev: d.ev, kind: "triggerEnding", why: d.why });
  if (!sites.length) {
    if (onMap) {
      const elsewhere = Object.values(project.maps).filter((m) => !scope.includes(m)).flatMap((m) => (m.events ?? []).filter((ev) => deepCmds(project, ev).some((c) => ENDING_KINDS.has(c.kind))).map((ev) => at(m, ev)));
      return { pass: false, detail: `「${onMap}」 에 엔딩을 부르는 이벤트가 없다${elsewhere.length ? ` — 엔딩은 ${elsewhere.slice(0, 3).join(", ")} 에 있다` : " — 엔딩 명령이 어디에도 없다"}` };
    }
    return { pass: false, detail: "엔딩 명령(triggerEnding·ending·returnToTitle)이 어느 이벤트에도 없다 — 엔딩 장면 끝에 넣어야 한다" };
  }
  const world = walkWorld(project, startOf(project, ctx));
  const notes: string[] = [];
  for (const s of sites) {
    const ev = { mapId: s.map.id, eventId: s.ev.id, x: s.ev.x, y: s.ev.y };
    if (s.why) { notes.push(`${at(s.map, s.ev)}: ${s.why}`); continue; }
    if (!world.maps.has(s.map.id)) { notes.push(`${at(s.map, s.ev)}: 시작 맵에서 「${mapLabel(s.map)}」 로 가는 길이 없다`); continue; }
    if (!eventReached(s.map, world.reach.get(s.map.id), s.ev)) { notes.push(`${at(s.map, s.ev)}: 그 맵 안에서 걸어 닿지 못한다`); continue; }
    return { pass: true, detail: `엔딩 ${s.kind} — ${at(s.map, s.ev)}, 시작에서 걸어 닿는다`, evidence: ev };
  }
  const s = sites[0]!;
  return { pass: false, detail: `엔딩 명령에 닿지 못한다 — ${notes.slice(0, 3).join(" / ")}`, evidence: { mapId: s.map.id, eventId: s.ev.id, x: s.ev.x, y: s.ev.y } };
}

function findItems(project: Project, name: string) {
  const items = project.database.items as unknown as Obj[];
  const scored = items.map((it) => ({ it, s: Math.max(nameScore(name, String(it.name ?? "")), nameScore(name, String(it.id ?? ""))) })).filter((x) => x.s > 0);
  const top = Math.max(0, ...scored.map((x) => x.s));
  return scored.filter((x) => x.s === top).map((x) => x.it);
}

function checkItem(project: Project, name: string, gives?: boolean): CheckResult {
  const items = findItems(project, name);
  if (!items.length) return { pass: false, detail: `아이템 「${name}」 이 DB 에 없다.${hint(name, (project.database.items as unknown as Obj[]).map((i) => String(i.name ?? "")))}` };
  const ids = new Set(items.map((i) => String(i.id)));
  const label = String(items[0]!.name ?? items[0]!.id);
  if (!gives) return { pass: true, detail: `아이템 「${label}」 이 DB 에 있다` };
  const giving = (c: Cmd) => {
    if (c.kind !== "changeItem" || !ids.has(String(c.itemId))) return false;
    const amt = c.amount as unknown;
    const n = typeof amt === "number" ? amt : typeof (amt as Obj | undefined)?.value === "number" ? Number((amt as Obj).value) : 1;
    return (c.op === "+=" || c.op === "=") && n > 0;
  };
  const scan = scanLive(project, Object.values(project.maps), giving);
  const h = scan.hits[0];
  if (h) return { pass: true, detail: `「${label}」 지급 — ${at(h.map, h.ev)}`, evidence: { mapId: h.map.id, eventId: h.ev.id, x: h.ev.x, y: h.ev.y } };
  return { pass: false, detail: `아이템 「${label}」 은 있지만 주는 명령(changeItem +=)이 도는 이벤트에 없다${deadNote(scan.dead)}` };
}

function checkPresent(project: Project, item: string, to?: string): CheckResult {
  const items = findItems(project, item);
  if (!items.length) return { pass: false, detail: `증거 아이템 「${item}」 이 DB 에 없다.${hint(item, (project.database.items as unknown as Obj[]).map((i) => String(i.name ?? "")))}` };
  const ids = new Set(items.map((i) => String(i.id)));
  const label = String(items[0]!.name ?? items[0]!.id);
  const takes = (c: Cmd) => c.kind === "presentItem" && ((c.options as Obj[] | undefined) ?? []).some((o) => ids.has(String(o.itemId)));
  const maps = Object.values(project.maps);
  const scan = scanLive(project, maps, takes);
  const sites = [...new Map(scan.hits.map((h) => [h.ev, { map: h.map, ev: h.ev }])).values()];
  if (![...ids].some((id) => liveFacts(project).given.has(id))) return { pass: false, detail: `증거 「${label}」 을 주는 곳(아이템 넣기·상점·드롭)이 없다 — 플레이어가 가질 수 없다` };
  if (!sites.length) {
    const anyPresent = scanLive(project, maps, (c) => c.kind === "presentItem").hits.length;
    return { pass: false, detail: scan.dead.length ? `「${label}」 을 받는 증거 내밀기가 있지만${deadNote(scan.dead)}` : anyPresent ? `증거 내밀기(presentItem)는 ${anyPresent}곳 있지만 「${label}」 을 맞는 증거로 받는 갈래가 없다` : `증거 내밀기(presentItem) 명령이 어디에도 없다 — 「${label}」 을 내밀 수단이 없다` };
  }
  if (to) {
    const hit = sites.find((s) => evScore(project, to, s.ev) > 0);
    if (!hit) return { pass: false, detail: `「${label}」 을 받는 곳은 ${sites.map((s) => at(s.map, s.ev)).join(", ")} — 「${to}」 에게 내미는 갈래가 아니다` };
    return { pass: true, detail: `「${label}」 을 ${at(hit.map, hit.ev)} 에게 내밀 수 있다`, evidence: { mapId: hit.map.id, eventId: hit.ev.id, x: hit.ev.x, y: hit.ev.y } };
  }
  const s = sites[0]!;
  return { pass: true, detail: `「${label}」 을 ${at(s.map, s.ev)} 에서 내밀 수 있다`, evidence: { mapId: s.map.id, eventId: s.ev.id, x: s.ev.x, y: s.ev.y } };
}

function checkObjective(project: Project, text?: string): CheckResult {
  const found: { map: GameMap | undefined; ev: GameEvent | undefined; message: string }[] = [];
  for (const h of scanLive(project, Object.values(project.maps), (c) => isObjectiveCommand(c as never)).hits) found.push({ map: h.map, ev: h.ev, message: String((h.c.fields as Obj).message) });
  for (const ce of (project.commonEvents ?? []) as unknown as Obj[]) walk(ce.commands, (c) => { if (isObjectiveCommand(c as never)) found.push({ map: undefined, ev: undefined, message: String((c.fields as Obj).message) }); });
  if (!found.length) return { pass: false, detail: "목표 줄 설정 명령이 없다" };
  const pick = text ? found.find((f) => normName(f.message, true).includes(normName(text, true))) : found[0];
  if (!pick) return { pass: false, detail: `목표 줄 ${found.length}개에 「${text}」 가 없다 — 있는 것: ${[...new Set(found.map((f) => `「${f.message.slice(0, 30)}」`))].slice(0, 4).join(", ")}` };
  return { pass: true, detail: `목표 줄 「${pick.message.slice(0, 50)}」${pick.map && pick.ev ? ` — ${at(pick.map, pick.ev)}` : " — 공통 이벤트"}`, ...(pick.map && pick.ev ? { evidence: { mapId: pick.map.id, eventId: pick.ev.id, x: pick.ev.x, y: pick.ev.y } } : {}) };
}

function checkReachable(project: Project, target: string, from: string | undefined, ctx: TodoCheckContext): CheckResult {
  let startId = startOf(project, ctx);
  if (from) {
    const fm = findMaps(project, from);
    if (!fm.length) return { pass: false, detail: `출발 맵 「${from}」 이 없다.${hint(from, allMapNames(project))}` };
    startId = fm[0]!.id;
  }
  const world = walkWorld(project, startId);
  const startLabel = mapLabel(project.maps[startId]!);
  const evs = findEvents(project, Object.values(project.maps), target);
  const maps = findMaps(project, target);
  // 이벤트 이름이 맵 이름보다 더 잘 맞으면 이벤트로, 아니면 맵으로 본다.
  const evTop = evs.length ? evScore(project, target, evs[0]!.ev) : 0;
  const mapTop = maps.length ? Math.max(...mapNamesOf(maps[0]!).map((n) => nameScore(target, n))) : 0;
  if (evs.length && evTop >= mapTop) {
    for (const h of evs) if (world.maps.has(h.map.id) && eventReached(h.map, world.reach.get(h.map.id), h.ev)) {
      return { pass: true, detail: `${at(h.map, h.ev)} 에 「${startLabel}」 에서 걸어 닿는다${world.via.get(h.map.id) ? `(${world.via.get(h.map.id)})` : ""}`, evidence: { mapId: h.map.id, eventId: h.ev.id, x: h.ev.x, y: h.ev.y } };
    }
    const h = evs[0]!;
    return { pass: false, detail: `${at(h.map, h.ev)} 에 「${startLabel}」 에서 걸어 닿지 못한다 — ${world.maps.has(h.map.id) ? "그 맵 안에서 막힌다(벽·물건·안 열리는 문)" : "그 맵으로 가는 이동 이벤트에 닿지 못한다"}`, evidence: { mapId: h.map.id, eventId: h.ev.id, x: h.ev.x, y: h.ev.y } };
  }
  if (maps.length) {
    const hit = maps.find((m) => world.maps.has(m.id));
    if (hit) return { pass: true, detail: `「${mapLabel(hit)}」 에 「${startLabel}」 에서 걸어 닿는다${world.via.get(hit.id) ? `(${world.via.get(hit.id)})` : ""}`, evidence: { mapId: hit.id } };
    return { pass: false, detail: `「${mapLabel(maps[0]!)}」 에 「${startLabel}」 에서 가는 길이 없다(닿는 맵: ${[...world.maps].map((id) => mapLabel(project.maps[id]!)).join(", ")})`, evidence: { mapId: maps[0]!.id } };
  }
  return { pass: false, detail: `「${target}」 라는 이벤트·맵이 없다.${hint(target, [...allMapNames(project), ...eventNameList(Object.values(project.maps))])}` };
}
