// H2 — 도구 호출 전 인자 검사·보정과, 거절 뒤 결정적 다시 부르기(할 일 고리 갈고리).
// 모델이 읽는 고침·돌려보냄 글은 영어다(2026-10-30 사용자 결정 — 싼 모델은 영어 되먹임을 더 잘 쓴다). 도구 거절 문장을 가르는 정규식은 한국어 그대로.
//
// 왜(2026-10-30 omo-loop-1030b terra 판, 도구 실패 원문을 센 것): 싼 모델은 도구 자체가 아니라 «인자 모양»에서 무너졌다.
//   · create_transfer_pair 에 doorAt 을 출입구(x,y)와 같은 칸으로(74건) — 규칙은 doorAt=(x,y-1)
//   · place_field_enemy 에 스키마의 모든 칸을 기본값으로(patrol·graphic·빈 directions, 110건) — 「관계없는 칸」 거절
//   · upsert_troop 에 members:[] 를 같이 보내 enemyIds 가 지워짐(14건) · upsert_item repelSteps:0 · referencePurpose:""
//   · stamp_object 를 맵 밖(19,-4)에(42건) · 이동 도착 칸을 덮어 무결성 거부(42건) · 완성된 집 위(18건)
//   · get_event 에 이벤트 이름이나 다른 맵 id(8건)
// 규칙은 각 도구의 검증 글(거절 문장)에서 뽑아 이 파일 한 곳(PRE_RULES·RETRY_RULES)에 모은다.
//   - 답이 하나뿐이면 조용히 고쳐 실행하고 결과에 「고침: …」을 붙인다(arg_fix · retry_fix).
//   - 아니면 실행하지 않고 고친 호출 예시를 돌려준다(arg_reject).
// 이 층은 모델이 «흔히 저지르는 모양»을 잡는다 — 도구 자체 정규화(도구가 빈 members 로 enemyIds 를 지우는 것 등)는 도구 쪽 몫이다.
import type { GameEvent, GameMap, Project } from "@/project/types";
import { isPassable } from "@/project/collision";
import { getTool } from "@/editor/tools/toolRegistry";
import { protectedHouseCells } from "@/editor/tools/houseProtection";
import { resolveObject } from "@/editor/tools/sharedObjectTools";
import { nameScore } from "../todo/names";

type Obj = Record<string, unknown>;
type Schema = { type?: string | string[]; properties?: Record<string, Schema>; required?: readonly string[]; items?: Schema; enum?: readonly unknown[] };
type Cell = { x: number; y: number };

/** 편집기 레지스트리 도구인가(v2 동사가 아니라 빌려 쓰는 도구). 기본값 걷어 내기는 이쪽에만 — v2 동사는 명세를 스스로 읽는다. */
export const isRegistryTool = (name: string): boolean => { try { return !!getTool(name); } catch { return false; } };

const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);
const num = (v: unknown): number | undefined => typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && /^-?\d+$/u.test(v.trim()) ? Number(v) : undefined;
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** 값이 «기본값으로 채운 빈 칸»인가 — 빈 글·빈 배열·null. (0·false 는 실제 값일 수 있어 여기서 보지 않는다.) */
const emptyish = (v: unknown): boolean => v === null || v === "" || (Array.isArray(v) && v.length === 0);
/** 객체의 잎이 모두 0·false·빈 글·빈 배열·null 인가(좌표 {x,y} 는 빼고) — 「아무것도 안 정한」 기본값 묶음. */
function allDefault(v: unknown): boolean {
  if (!isObj(v)) return false;
  if ("x" in v && "y" in v) return false;
  const leaves = Object.values(v);
  return leaves.length > 0 && leaves.every((l) => l === 0 || l === false || emptyish(l) || allDefault(l));
}

/**
 * 스키마 기준으로 선택 칸의 «기본값 채움»을 걷어 낸다: 빈 글·빈 배열·null, 그리고 잎이 모두 기본값인 선택 객체.
 * 필수 칸은 그대로 둔다. 돌려주는 값: 고친 인자와 걷어 낸 칸 경로.
 * terra 는 스키마의 모든 칸을 기본값으로 채웠다(place_field_enemy patrol.directions:[]·graphic{…""}, upsert_troop members:[], referencePurpose:"").
 */
export function pruneDefaults(schema: Schema | undefined, value: unknown, path = ""): { value: unknown; removed: string[] } {
  const removed: string[] = [];
  const walk = (s: Schema | undefined, v: unknown, p: string): unknown => {
    if (Array.isArray(v)) return s?.items ? v.map((x, i) => walk(s.items, x, `${p}[${i}]`)) : v;
    if (!isObj(v) || !s?.properties) return v;
    const required = new Set(s.required ?? []);
    const out: Obj = {};
    for (const [k, child] of Object.entries(v)) {
      const cs = s.properties[k];
      const at = p ? `${p}.${k}` : k;
      if (cs && !required.has(k) && (emptyish(child) || allDefault(child))) { removed.push(at); continue; }
      const next = cs ? walk(cs, child, at) : child;
      // 안을 걷어 내 비게 된 선택 객체도 뺀다(patrol:{directions:[]} → patrol:{}).
      if (cs && !required.has(k) && isObj(next) && !Object.keys(next).length && isObj(child) && Object.keys(child).length) { removed.push(at); continue; }
      out[k] = next;
    }
    return out;
  };
  return { value: walk(schema, value, path), removed };
}

// ───────────── 프로젝트 조회 ─────────────

const eventsOf = (map: GameMap | undefined): GameEvent[] => (map?.events ?? []) as GameEvent[];
export function findMapId(project: Project, ref: unknown): string | undefined {
  if (typeof ref !== "string" || !ref.trim()) return undefined;
  if (project.maps[ref]) return ref;
  const scored = Object.values(project.maps).map((m) => ({ id: m.id, s: nameScore(ref, m.name) })).filter((c) => c.s > 0);
  const best = Math.max(0, ...scored.map((c) => c.s));
  const top = scored.filter((c) => c.s === best);
  return best && top.length === 1 ? top[0]!.id : undefined;
}
/** 이벤트 id 로 찾기: 그 맵 → 모든 맵(하나뿐일 때) → 그 맵의 이름 같은 이벤트(하나뿐일 때). */
export function locateEvent(project: Project, mapId: string | undefined, ref: string): { mapId: string; eventId: string; how: string } | undefined {
  const map = mapId ? project.maps[mapId] : undefined;
  if (map && eventsOf(map).some((e) => e.id === ref)) return { mapId: map.id, eventId: ref, how: "" };
  const holders = Object.values(project.maps).filter((m) => eventsOf(m).some((e) => e.id === ref));
  if (holders.length === 1) return { mapId: holders[0]!.id, eventId: ref, how: `event ${ref} is on ${holders[0]!.name ?? holders[0]!.id} (${holders[0]!.id})` };
  const pool = map ? [map] : Object.values(project.maps);
  const named = pool.flatMap((m) => eventsOf(m).filter((e) => nameScore(ref, e.name) === 3).map((e) => ({ m, e })));
  if (named.length === 1) return { mapId: named[0]!.m.id, eventId: named[0]!.e.id, how: `"${ref}" is an event name — its id is ${named[0]!.e.id}` };
  return undefined;
}
export function eventListLine(project: Project, mapId: string | undefined, limit = 12): string {
  const map = mapId ? project.maps[mapId] : undefined;
  if (!map) return "";
  return eventsOf(map).slice(0, limit).map((e) => `${e.id}${e.name ? `(${e.name})` : ""}`).join(", ");
}
const inBounds = (map: GameMap, x: number, y: number) => x >= 0 && y >= 0 && x < map.width && y < map.height;
/** 이 맵에 내리는 이동 명령의 도착 칸(다른 맵·같은 맵의 transfer). */
function transferLandings(project: Project, mapId: string): Cell[] {
  const out: Cell[] = [];
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) { for (const n of node) visit(n); return; }
    if (!isObj(node)) return;
    if (node.kind === "transfer" && node.mapId === mapId && typeof node.x === "number" && typeof node.y === "number") out.push({ x: node.x, y: node.y });
    for (const [k, v] of Object.entries(node)) if (k !== "condition" && k !== "conditions" && v && typeof v === "object") visit(v);
  };
  for (const m of Object.values(project.maps)) for (const e of eventsOf(m)) { visit(e.commands); visit(e.pages); }
  return out;
}

// ───────────── 규칙 표 ─────────────

export type PreOutcome = { kind: "ok"; args: unknown; notes: string[] } | { kind: "reject"; message: string };
interface PreRule {
  /** 이 규칙이 보는 도구(정규식 또는 이름) */
  readonly tool: RegExp;
  /** 규칙 이름(기록용) — 원래 거절 글 요지 */
  readonly id: string;
  readonly apply: (args: Obj, project: Project) => { args?: Obj; note?: string; reject?: string } | undefined;
}

/** create_transfer_pair 한 끝: doorAt 은 문 하단 칸, 출입구(x,y)는 바로 남쪽(x=doorAt.x, y=doorAt.y+1). 어긋나면 걸을 수 있는 쪽으로 맞춘다. */
function fixTransferEnd(project: Project, end: unknown, label: string): { end?: Obj; note?: string } {
  if (!isObj(end) || !isObj(end.doorAt)) return {};
  const x = num(end.x), y = num(end.y), dx = num(end.doorAt.x), dy = num(end.doorAt.y);
  if (x === undefined || y === undefined || dx === undefined || dy === undefined) return {};
  if (dx === x && dy === y - 1) return {};
  const map = typeof end.mapId === "string" ? project.maps[end.mapId] : undefined;
  const walk = (cx: number, cy: number) => !!map && inBounds(map, cx, cy) && isPassable(project, map, cx, cy);
  // 후보 ① 출입구(x,y)를 지키고 문을 그 위 칸으로 ② 문을 지키고 출입구를 그 아래 칸으로. 출입구 칸이 걸을 수 있는 것만.
  const keepEntry = walk(x, y) ? { ...end, doorAt: { x, y: y - 1 } } : undefined;
  const keepDoor = walk(dx, dy + 1) ? { ...end, x: dx, y: dy + 1 } : undefined;
  if (keepEntry) return { end: keepEntry, note: `${label}: doorAt (${dx},${dy}) was not directly above the entrance (${x},${y}) — doorAt set to (${x},${y - 1})` };
  if (keepDoor) return { end: keepDoor, note: `${label}: entrance (${x},${y}) moved to (${dx},${dy + 1}), directly below the door (${dx},${dy})` };
  // 둘 다 못 걸으면 doorAt 을 뺀다 — 도구가 걸어 닿는 가장 가까운 칸으로 옮겨 잇는다.
  const { doorAt: _d, ...rest } = end;
  return { end: rest, note: `${label}: neither doorAt (${dx},${dy}) nor entrance (${x},${y}) could be aligned — removed doorAt (the tool links at the nearest walkable cell)` };
}

/** 기물 하나의 칸 상자와 입구(있으면). 못 풀면 undefined. */
function objectBox(project: Project, objectId: unknown): { w: number; h: number; entrances: Cell[] } | undefined {
  if (typeof objectId !== "string") return undefined;
  try {
    const r = resolveObject(project, objectId);
    return { w: r.pattern.width, h: r.pattern.height, entrances: (r.entrances ?? []).map((p) => ({ x: Number((p as { x?: number }).x ?? 0), y: Number((p as { y?: number }).y ?? 0) })) };
  } catch { return undefined; }
}
const rectHas = (x: number, y: number, w: number, h: number, c: Cell) => c.x >= x && c.y >= y && c.x < x + w && c.y < y + h;

/** stamp_object 를 놓을 수 있는 가장 가까운 자리 — 맵과 겹치고, 완성된 집·이동 도착 칸을 덮지 않는다. 같은 거리 안에서는 위·왼쪽 먼저(결정적). */
export function nearestStampSpot(map: GameMap, x: number, y: number, w: number, h: number, avoid: readonly Cell[], radius = 4): Cell | undefined {
  const house = protectedHouseCells(map);
  // 옮긴 자리는 맵 안에 다 들어가야 한다 — 반쯤 걸치게 옮기면 그림이 잘린다(맵 위 가장자리 출입구 곁 덩굴 장식이 (20,-1) 로 갔다).
  const ok = (cx: number, cy: number) => cx >= 0 && cy >= 0 && cx + w <= map.width && cy + h <= map.height
    && !house.some((c) => rectHas(cx, cy, w, h, c)) && !avoid.some((c) => rectHas(cx, cy, w, h, c));
  for (let r = 1; r <= radius; r++) {
    const ring: Cell[] = [];
    for (let oy = -r; oy <= r; oy++) for (let ox = -r; ox <= r; ox++) if (Math.max(Math.abs(ox), Math.abs(oy)) === r) ring.push({ x: x + ox, y: y + oy });
    ring.sort((a, b) => (Math.abs(a.x - x) + Math.abs(a.y - y)) - (Math.abs(b.x - x) + Math.abs(b.y - y)) || a.y - b.y || a.x - b.x);
    const hit = ring.find((c) => ok(c.x, c.y));
    if (hit) return hit;
  }
  return undefined;
}

const PRE_RULES: readonly PreRule[] = [
  {
    tool: /^create_transfer_pair$/u, id: "transfer-doorAt",
    apply(args, project) {
      const a = fixTransferEnd(project, args.a, "A"), b = fixTransferEnd(project, args.b, "B");
      if (!a.end && !b.end) return undefined;
      return { args: { ...args, ...(a.end ? { a: a.end } : {}), ...(b.end ? { b: b.end } : {}) }, note: [a.note, b.note].filter(Boolean).join(" · ") };
    },
  },
  {
    // 'patrol 은 behavior:"patrol" 또는 "chase"(순찰+추격) 에서만 씁니다' — 제자리 보초에 순찰 칸을 같이 보내면 거절된다.
    tool: /^place_field_enemy$/u, id: "field-enemy-patrol-behavior",
    apply(args) {
      const behavior = String(args.behavior ?? "stationary");
      if (args.patrol === undefined || behavior === "patrol" || behavior === "chase") return undefined;
      const { patrol: _p, ...rest } = args;
      return { args: rest, note: `removed patrol — behavior "${behavior}" takes no patrol route` };
    },
  },
  {
    // '트룹에는 최소 1마리의 적(enemyIds/members)이 필요합니다' — 비면 이름이 맞는 적 하나를 찾아 넣는다(하나뿐일 때).
    tool: /^upsert_troop$/u, id: "troop-members",
    apply(args, project) {
      const troop = isObj(args.troop) ? args.troop : args;
      const ids = Array.isArray(troop.enemyIds) ? troop.enemyIds : [];
      const members = Array.isArray(troop.members) ? troop.members : [];
      if (ids.length || members.length) return undefined;
      // 이미 있는 트룹을 고치는 호출이면(기존 id) 적을 안 보내도 남는다.
      const existing = (project.database?.troops ?? []).find((t) => String((t as { id?: unknown }).id) === String(troop.id ?? ""));
      if (existing) return undefined;
      const enemies = (project.database?.enemies ?? []) as { id: string; name?: string }[];
      const name = String(troop.name ?? "").replace(/\s*(보스|무리|그룹|일당|부대|boss)\s*$/iu, "");
      const scored = enemies.map((e) => ({ e, s: nameScore(name, e.name) })).filter((c) => c.s > 0);
      const best = Math.max(0, ...scored.map((c) => c.s));
      const top = scored.filter((c) => c.s === best);
      if (best && top.length === 1) {
        const fixed = { ...troop, enemyIds: [top[0]!.e.id] };
        return { args: isObj(args.troop) ? { ...args, troop: fixed } : fixed, note: `the troop had no enemy — put the name-matching enemy ${top[0]!.e.id} (${top[0]!.e.name}) in enemyIds` };
      }
      const cands = (top.length ? top.map((c) => c.e) : enemies).slice(0, 6).map((e) => `${e.id}(${e.name ?? ""})`).join(", ");
      return { reject: `A troop needs at least one enemy — call again with an enemy id in enemyIds: upsert_troop({troop:{id:"${String(troop.id ?? "troop_…")}", name:"${String(troop.name ?? "")}", enemyIds:["<enemy id>"]}}). Candidates: ${cands}` };
    },
  },
  {
    // 이벤트 id 가 그 맵에 없다 — 다른 맵에 하나뿐이면 맵을, 이벤트 이름이면 id 로 바꾼다.
    tool: /^(get_event|move_event|patch_event_page|add_event_page|remove_event|delete_event|duplicate_event)$/u, id: "event-id",
    apply(args, project) {
      if (typeof args.eventId !== "string" || !args.eventId.trim()) return undefined;
      const mapId = findMapId(project, args.mapId) ?? (typeof args.mapId === "string" ? args.mapId : undefined);
      const mapFixed = mapId && mapId !== args.mapId ? { mapId } : {};
      const map = mapId ? project.maps[mapId] : undefined;
      if (map && eventsOf(map).some((e) => e.id === args.eventId)) return Object.keys(mapFixed).length ? { args: { ...args, ...mapFixed }, note: `mapId "${String(args.mapId)}" → ${mapId}` } : undefined;
      const hit = locateEvent(project, mapId, args.eventId);
      if (hit) return { args: { ...args, mapId: hit.mapId, eventId: hit.eventId }, note: hit.how };
      return { reject: `Event ${args.eventId} is not on ${map ? `${map.name ?? map.id} (${map.id})` : "any map"} — it was deleted, or rebuilt with a new id. Events on that map: ${eventListLine(project, mapId) || "(no such map)"}. Call ${String((args as { __tool?: string }).__tool ?? "the same tool")} again with a listed id, or todo block(reason) if the event you need is gone.` };
    },
  },
  {
    // stamp_object: 맵 밖(완전히 벗어남)이면 맵 안 가장 가까운 자리로, 입구 기물을 출입구 이벤트 곁에 찍으면 입구 칸을 그 이벤트에 맞추고,
    // 완성된 집·이동 도착 칸을 덮으면 가장 가까운 빈 자리로.
    tool: /^stamp_object$/u, id: "stamp-place",
    apply(args, project) {
      const map = typeof args.mapId === "string" ? project.maps[args.mapId] : undefined;
      const x = num(args.x), y = num(args.y);
      const box = map ? objectBox(project, args.objectId) : undefined;
      if (!map || x === undefined || y === undefined || !box) return undefined;
      const { w, h } = box;
      const notes: string[] = [];
      let nx = x, ny = y;
      // 입구 하나짜리 기물(굴·문 입구)을 출입구 이벤트 2칸 안에 찍으면 입구 칸을 그 이벤트 칸에 맞춘다 — 그림과 이동 칸이 어긋나지 않게.
      if (box.entrances.length === 1) {
        const ent = box.entrances[0]!;
        const gates = eventsOf(map).filter((e) => JSON.stringify(e.pages ?? e.commands ?? []).includes("\"transfer\""));
        const near = gates.map((e) => ({ e, d: Math.max(Math.abs(e.x - (x + ent.x)), Math.abs(e.y - (y + ent.y))) })).filter((g) => g.d > 0 && g.d <= 2).sort((a, b) => a.d - b.d);
        if (near.length && (near.length === 1 || near[0]!.d < near[1]!.d)) {
          const g = near[0]!.e;
          nx = g.x - ent.x; ny = g.y - ent.y;
          notes.push(`aligned the entrance cell with the transfer event ${g.name ?? g.id} (${g.x},${g.y}): (${x},${y})→(${nx},${ny})`);
        }
      }
      if (nx + w <= 0 || ny + h <= 0 || nx >= map.width || ny >= map.height) {
        const cx = Math.min(Math.max(nx, 0), map.width - w), cy = Math.min(Math.max(ny, 0), map.height - h);
        notes.push(`${w}x${h} at (${nx},${ny}) is outside the ${map.width}x${map.height} map — moved to (${cx},${cy})`);
        nx = cx; ny = cy;
      }
      // 이동 도착 칸: 입구 기물의 입구 칸 바로 아래(길이 끝나는 칸)는 기물이 비워 두므로 그 칸 하나는 덮어도 된다.
      const keep = box.entrances.map((e) => ({ x: nx + e.x, y: ny + e.y + 1 }));
      const landings = transferLandings(project, map.id).filter((c) => !keep.some((k) => k.x === c.x && k.y === c.y));
      const house = protectedHouseCells(map);
      const blocked = house.some((c) => rectHas(nx, ny, w, h, c)) ? "a completed house" : landings.some((c) => rectHas(nx, ny, w, h, c)) ? "a transfer arrival cell" : undefined;
      if (blocked) {
        const spot = nearestStampSpot(map, nx, ny, w, h, landings);
        if (!spot) return { reject: `${w}x${h} at (${nx},${ny}) covers ${blocked}, and there is no free spot within 4 cells. Pick another place (inspect for empty ground) or todo block(reason).` };
        notes.push(`${w}x${h} at (${nx},${ny}) covered ${blocked} — moved to the nearest free spot (${spot.x},${spot.y})`);
        nx = spot.x; ny = spot.y;
      }
      if (nx === x && ny === y) return undefined;
      return { args: { ...args, x: nx, y: ny }, note: notes.join(" · ") };
    },
  },
];

/**
 * 실행 전 검사. schema = 모델이 본 도구 인자 스키마. 돌려주는 값: 고친 인자(+고침 글) 또는 돌려보냄.
 * 레지스트리 도구만 기본값 걷어 내기를 하고, 규칙 표는 이름이 맞는 도구에만 돈다.
 */
export function preCheck(toolName: string, schema: unknown, rawArgs: unknown, project: Project): PreOutcome {
  if (!isObj(rawArgs)) return { kind: "ok", args: rawArgs, notes: [] };
  const notes: string[] = [];
  let args: Obj = clone(rawArgs);
  if (isRegistryTool(toolName)) {
    const pruned = pruneDefaults(schema as Schema, args);
    if (pruned.removed.length) { args = pruned.value as Obj; notes.push(`dropped empty/default optional fields: ${pruned.removed.slice(0, 8).join(", ")}${pruned.removed.length > 8 ? ` +${pruned.removed.length - 8} more` : ""}`); }
  }
  for (const rule of PRE_RULES) {
    if (!rule.tool.test(toolName)) continue;
    let out;
    try { out = rule.apply({ ...args, __tool: toolName } as Obj, project); } catch { out = undefined; }
    if (!out) continue;
    if (out.reject) return { kind: "reject", message: out.reject };
    if (out.args) { const { __tool: _t, ...clean } = out.args as Obj & { __tool?: string }; args = clean; }
    if (out.note) notes.push(out.note);
  }
  return { kind: "ok", args, notes };
}

// ───────────── 거절 뒤 결정적 다시 부르기 ─────────────

/** 거절 글 하나로 다시 부를 인자(차례로 시도) — 없으면 빈 배열. 각 후보에 고침 글. */
export function retryCandidates(toolName: string, schema: unknown, args: unknown, failure: string, project: Project): { args: Obj; note: string }[] {
  if (!isObj(args)) return [];
  const out: { args: Obj; note: string }[] = [];
  const body = failure.replace(/^[^:]*실행 실패:\s*/u, "");
  // ① 「<칸> 은/는 …」 형 검증 거절: 그 칸이 선택 칸이고 값이 기본값처럼 보이거나(0·빈 것), 글이 «…에서만/…만 허용»이면 빼고 다시.
  const field = /^(?:Error:\s*)?([A-Za-z_][\w]*(?:\.[A-Za-z_][\w]*)*)\s*(?:은|는|이|가|에는)\s/u.exec(body)?.[1];
  if (field) {
    const parts = field.split(".");
    const top = parts[0]!;
    const s = schema as Schema | undefined;
    const holder = isObj(args[top]) || top in args ? args : Object.values(args).find((v) => isObj(v) && top in (v as Obj)) as Obj | undefined;
    const holderKey = holder === args ? undefined : Object.keys(args).find((k) => args[k] === holder);
    const holderSchema = holderKey ? s?.properties?.[holderKey] : s;
    const value = holder?.[top];
    const optional = !!holderSchema?.properties?.[top] && !(holderSchema.required ?? []).includes(top);
    const defaultLike = value === 0 || value === false || emptyish(value) || allDefault(value);
    if (holder && value !== undefined && optional && (defaultLike || /에서만|만 허용|만 씁니다|다릅니다/u.test(body))) {
      const { [top]: _drop, ...rest } = holder;
      out.push({ args: holderKey ? { ...args, [holderKey]: rest } : rest, note: `${field} was rejected — called again without the optional field ${holderKey ? `${holderKey}.` : ""}${top}` });
    }
  }
  // ② 「존재하지 않는 이벤트 'X'」·「이벤트를 찾을 수 없습니다: X」: X 가 이벤트 이름이고 하나뿐이면 인자 속 X 를 id 로 바꿔 다시.
  const ghost = /존재하지 않는 이벤트 '([^']+)'|이벤트를 찾을 수 없습니다:\s*([^\s(]+)/u.exec(body);
  const ghostName = ghost?.[1] ?? ghost?.[2];
  if (ghostName) {
    const hit = locateEvent(project, typeof args.mapId === "string" ? args.mapId : undefined, ghostName);
    if (hit && hit.eventId !== ghostName) {
      const replaced = JSON.parse(JSON.stringify(args).split(JSON.stringify(ghostName)).join(JSON.stringify(hit.eventId))) as Obj;
      out.push({ args: hit.mapId && typeof args.mapId === "string" && args.mapId !== hit.mapId ? { ...replaced, mapId: hit.mapId } : replaced, note: `${hit.how} — called again with that id` });
    }
  }
  // ③ stamp_object 무결성 거부(이동 도착 칸을 막음)·완성된 집: 그 칸을 피해 가장 가까운 자리로.
  if (toolName === "stamp_object" && /transfer 목적지가 통행 불가|완성된 집의 보호 영역/u.test(body)) {
    const map = typeof args.mapId === "string" ? project.maps[args.mapId] : undefined;
    const box = map ? objectBox(project, args.objectId) : undefined;
    const x = num(args.x), y = num(args.y);
    if (map && box && x !== undefined && y !== undefined) {
      const named = [...body.matchAll(/\(\s*(\d+)\s*,\s*(\d+)\s*\)/gu)].map((m) => ({ x: Number(m[1]), y: Number(m[2]) }));
      const avoid = [...named, ...transferLandings(project, map.id)];
      const spot = nearestStampSpot(map, x, y, box.w, box.h, avoid);
      if (spot) out.push({ args: { ...args, x: spot.x, y: spot.y }, note: `(${x},${y}) was refused for covering ${/완성된 집/u.test(body) ? "a completed house" : "a transfer arrival cell"} — stamped again at the nearest free spot (${spot.x},${spot.y})` });
    }
  }
  return out;
}
