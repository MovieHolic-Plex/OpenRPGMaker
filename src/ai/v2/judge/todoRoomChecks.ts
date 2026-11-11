// 할 일 검사 가운데 실내 방 검사 — room_zones(구역·초점·갈 이유·반복) · room_graph(선언한 방·연결·계단·랜드마크) · layout_built · layout_review.
import { isPassable } from "@/project/collision";
import type { GameEvent, GameMap, Project } from "@/project/types";
import { isPlaceholderMap } from "../blankStart";
import { bodyReached } from "./eventReach";
import { isPersonEvent } from "../place/placementRules";
import { eventBodyRect } from "@/project/eventFootprintQuery";
import { normName } from "../todo/names";
import type { CheckResult } from "../todo/types";
import { layoutReviewRounds, REVIEWS_TAG } from "../place/layoutReview";
import { t, liveCmds, isAuto, evLabel, mapAt, q, choose, Scope, has, mapInScope, scopeNote, mapNamed, allMapNames, isResult, mapReach } from "./todoCheckFacts";

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

export function checkRoomZones(project: Project, sc: Scope, name: string, min = 2): CheckResult {
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

export function checkLayoutBuilt(project: Project, sc: Scope, name: string): CheckResult {
  const maps = interiorMaps(project, sc, name, LAYOUT_TAG);
  if (isResult(maps)) return maps;
  const results = maps.map((m) => layoutBuiltOf(project, m));
  const bad = results.find((r) => !r.pass);
  return bad ?? results[0]!;
}

/** 자기 검토(review_layout) 바퀴: 칸 배치 선언 위치의 reviews:N 태그. */
export function checkLayoutReview(project: Project, sc: Scope, name: string): CheckResult {
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

export function checkRoomGraph(project: Project, sc: Scope, name: string): CheckResult {
  const maps = interiorMaps(project, sc, name, GRAPH_TAG);
  if (isResult(maps)) return maps;
  const results = maps.map((m) => roomGraphOf(project, m));
  return results.find((x) => x.pass) ?? results[0]!;
}
