// ai/imagePlan.ts
// 그림 도안 먼저 짓기(AI 설정 「그림 도안 먼저」) — 모호한 새로 짓기를 넓힌 장면(vagueWiden)을 짓기 전에 ChatGPT 이미지 모델로 도안 한 장을 받고,
// 도안 위에 칸 번호 격자를 그려 비전 모델이 배치(길·집·광장·높은 단·방)를 칸 좌표로 읽게 한 뒤, 그 좌표를 빌더가 이미 받는 인자로 조수에게 건넨다.
// 도안 그림만 붙이면 조수는 빌더를 기본 인자로 불러 도안이 사라졌다(2026-11-04 실측). 호출(이미지·비전·계정)은 editor/imagePlanMockup.ts 가 한다.
import type { WidenSubject } from "./vagueWidenCatalog";
import { dungeonPlanFromCells, forestDesignFromCells, villageArgsFromCells, type CellMap } from "./imagePlanCells";

export const IMAGE_PLAN_PROVIDER = "ChatGPT";

export interface ImagePlanScene {
  readonly subject: WidenSubject;
  readonly label: string;
  readonly traits: readonly string[];
}

const NO_NOISE = "No people, no characters, no monsters, no text, no labels, no UI, no grid lines.";
const STYLE = "16px-per-tile SNES-era JRPG map, crisp pixel art, orthographic, no perspective, no isometric angle.";

export function imagePlanPrompt(scene: ImagePlanScene): string {
  const what = `${scene.label} (${scene.traits.join(", ")})`;
  if (scene.subject === "house" || scene.subject === "dungeon" || scene.subject === "castle") {
    const indoor = scene.subject === "house"
      ? `the ground-floor INTERIOR FLOOR PLAN of a house: ${what}. Walls seen from above with a short front face, a door on the south wall, furniture, one stair, one landmark. Indoors only - no exterior, no yard, no village.`
      : `a dungeon floor drawn as a top-down plan: ${what}. Rooms joined by corridors, a start room, a boss or treasure room, one landmark. Dark void outside the rooms.`;
    return `Design a mockup of a game map: ${indoor} Style: ${STYLE} 3/4 top-down view (tops of walls and objects visible, short front faces, no side faces). Show the whole map as one screenshot. ${NO_NOISE}`;
  }
  return `Design a mockup of a game map: ${what}. Style: ${STYLE} 3/4 top-down view (tops of buildings and objects visible, short front faces, no side faces). Show the whole place as one map screenshot seen from above: its outline, where each zone sits, the paths between them, height changes as cliffs with stairs, and one clear landmark. ${NO_NOISE}`;
}

/** 격자 칸 수(가로×세로). 도안 가로세로비에 맞춰 세로를 정한다. */
export function gridSizeFor(width: number, height: number): { readonly cols: number; readonly rows: number } {
  const cols = 24;
  return { cols, rows: Math.max(8, Math.min(24, Math.round(cols * height / width))) };
}

export function imagePlanReadPrompt(subject: WidenSubject, cols: number, rows: number): string {
  const head = `이 그림은 RPG 맵 도안 위에 노란 칸 격자(가로 0~${cols - 1}, 세로 0~${rows - 1}, 칸 번호가 가장자리에 적혀 있다)를 그린 것이다. 칸 번호 기준으로 배치를 읽어 JSON 하나만 답하라. 그림에 없는 항목은 빈 배열·null 로 둔다.`;
  if (subject === "village") {
    return `${head}\n{"gather":{"x":,"y":}|null(우물·광장 가운데),"landmark":{"x":,"y":}|null(가장 눈에 띄는 높은 곳 건물),"anchor":{"x":,"y":}|null(큰 건물),"work":{"x":,"y":}|null(헛간·방앗간),"houses":[{"x":,"y":,"kind":"small|medium|large"}](집 한 채마다 건물 가운데),"fields":[{"x":,"y":}](밭 가운데),"forests":[{"x":,"y":}](숲 덩이 가운데),"exits":["north|south|east|west"](큰길이 그림 밖으로 나가는 쪽),"water":"river|coast|none","high":"north|center|west|east|none"(가장 높은 단 자리),"tiers":1~4(절벽 단 수),"terrain":["${cols}글자 행", … ${rows}줄](칸 하나당 글자 하나, 위에서 아래: 0가장 낮은 땅 1·2·3 점점 높은 단(절벽·돌담으로 갈리는 단 하나가 +1) ~강 |폭포 o연못·호수; 집·길·숲·밭은 그 칸의 땅 단으로 적는다)}`;
  }
  if (subject === "forest") {
    return `${head}\n숲길의 본길과 갈림길을 읽어라. {"entryAt":0~1(길이 그림 아래 가장자리에서 들어오는 가로 위치, 0=왼쪽),"exitAt":0~1(위쪽으로 나가는 가로 위치),"bends":1~6(굽이 수),"width":"narrow|normal|wide","branches":[{"at":0~1(본길 진행 위치, 0=아래),"toward":"left|right","end":"chest|clearing|nothing"}],"clearings":[{"at":0~1,"size":"small|medium|large","toward":"left|right|center"}],"cliffs":true|false(절벽 단·돌계단이 있나),"landmark":"그림 속 눈에 띄는 것 한 줄"}`;
  }
  return `${head}\n방(바닥이 보이는 구역)과 방을 잇는 통로를 읽어라. {"rooms":[{"kind":"entrance|hall|side|boss|treasure|living|kitchen|bedroom|other","x":,"y":,"w":,"h":}](칸 번호로 왼쪽 위 칸과 가로·세로 칸 수, 입구 방이 첫째),"links":[[0,1],[1,2]](통로가 잇는 두 방의 rooms 순번 0부터, 고리 통로도 모두),"start":{"x":,"y":},"landmark":{"x":,"y":}|null,"stairs":{"x":,"y":}|null}`;
}

export interface ImagePlanRead {
  readonly subject: WidenSubject;
  readonly cols: number;
  readonly rows: number;
  readonly data: Record<string, unknown>;
  /** 칸 지도 읽기(imagePlanCells.ts) — 있으면 빌더 인자는 이것에서 옮긴다. fixedRegions = 겹쳐 보고 고친 영역 수. */
  readonly cells?: CellMap;
  readonly fixedRegions?: number;
}

function scaleCell(value: unknown, from: number, to: number): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round((n + 0.5) * to / from - 0.5) : null;
}

function scalePoint(value: unknown, read: ImagePlanRead, width: number, height: number): { x: number; y: number } | null {
  if (!value || typeof value !== "object") return null;
  const p = value as Record<string, unknown>;
  const x = scaleCell(p.x, read.cols, width), y = scaleCell(p.y, read.rows, height);
  return x === null || y === null ? null : { x, y };
}

function scaleList(value: unknown, read: ImagePlanRead, width: number, height: number, max: number): Array<{ x: number; y: number; kind?: string }> {
  if (!Array.isArray(value)) return [];
  return value.slice(0, max).flatMap((item) => {
    const p = scalePoint(item, read, width, height);
    const kind = item && typeof item === "object" ? (item as Record<string, unknown>).kind : undefined;
    return p ? [{ ...p, ...(typeof kind === "string" ? { kind } : {}) }] : [];
  });
}

/** 마을 도안 → author_beodeul_town 인자(칸 좌표는 도안 격자에서 맵 크기로 옮긴다). */
export function villageArgsFromRead(read: ImagePlanRead, width: number, height: number): Record<string, unknown> {
  const d = read.data;
  const layout: Record<string, unknown> = {};
  for (const key of ["gather", "landmark", "anchor", "work"] as const) {
    const p = scalePoint(d[key], read, width, height);
    if (p) layout[key] = key === "gather" ? { ...p, plaza: true } : p;
  }
  const houses = scaleList(d.houses, read, width, height, 24).map((h) => ({ x: h.x, y: h.y, ...(h.kind === "small" || h.kind === "medium" || h.kind === "large" ? { kind: h.kind } : {}) }));
  if (houses.length) layout.houses = houses;
  const fields = scaleList(d.fields, read, width, height, 6).map(({ x, y }) => ({ x, y }));
  if (fields.length) layout.fields = fields;
  const forests = scaleList(d.forests, read, width, height, 8).map(({ x, y }) => ({ x, y }));
  if (forests.length) layout.forests = forests;
  if (Array.isArray(d.exits)) layout.exits = d.exits.filter((e) => ["north", "south", "east", "west"].includes(String(e))).slice(0, 2);
  const args: Record<string, unknown> = { width, height, terrainGen: "code", layout };
  if (houses.length >= 3 && houses.length <= 5) args.houseCount = houses.length;
  const tiers = Number(d.tiers);
  if (Number.isFinite(tiers) && tiers >= 1) {
    args.landform = tiers >= 3 ? "terraces" : "hill";
    args.tiers = Math.max(1, Math.min(4, Math.round(tiers) - 1 || 1));
  }
  if (["north", "center", "west", "east"].includes(String(d.high))) args.high = d.high;
  const terrain = Array.isArray(d.terrain) ? d.terrain.map((r) => String(r).replace(/[^0-3~|o]/gu, "0")) : [];
  if (terrain.length >= 6 && terrain.every((r) => r.length >= 6)) {
    args.terrainMap = terrain;
    if (!args.landform) args.landform = "terraces";
  }
  if (d.water === "none" && !args.terrainMap) args.water = "none";
  return args;
}

/** 숲 도안 → author_forest_route designs[0] */
export function forestDesignFromRead(read: ImagePlanRead): Record<string, unknown> {
  const d = read.data;
  const clamp01 = (v: unknown): number | undefined => { const n = Number(v); return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : undefined; };
  const design: Record<string, unknown> = {};
  const entry = clamp01(d.entryAt); if (entry !== undefined) design.entryAt = entry;
  const exit = clamp01(d.exitAt); if (exit !== undefined) design.exitAt = exit;
  const bends = Number(d.bends); if (Number.isFinite(bends)) design.bends = Math.max(1, Math.min(6, Math.round(bends)));
  if (["narrow", "normal", "wide"].includes(String(d.width))) design.width = d.width;
  if (Array.isArray(d.branches)) design.branches = d.branches.slice(0, 4).flatMap((b) => {
    const o = b as Record<string, unknown>; const at = clamp01(o.at);
    return at === undefined ? [] : [{ at, toward: o.toward === "right" ? "right" : "left", ...(["chest", "clearing", "nothing"].includes(String(o.end)) ? { end: o.end } : {}) }];
  });
  if (Array.isArray(d.clearings)) design.clearings = d.clearings.slice(0, 4).flatMap((c) => {
    const o = c as Record<string, unknown>; const at = clamp01(o.at);
    return at === undefined ? [] : [{ at, size: ["small", "medium", "large"].includes(String(o.size)) ? o.size : "medium", toward: ["left", "right", "center"].includes(String(o.toward)) ? o.toward : "center" }];
  });
  return design;
}

const ROOM_KINDS: Record<string, string> = { entrance: "entrance", hall: "hall", side: "crypt", boss: "boss", treasure: "vault" };
const DUNGEON_POS_SCALE = 2;
const DUNGEON_SIZE_SCALE = 1.25;

/** 방 도안 → author_dungeon {rooms[]{id,kind,x,y,w,h}, links}. 자리는 크기보다 더 크게 키워(위치 2배·크기 1.25배) 방 사이에 벨·통로 자리를 남긴다(입구 먼저). */
export function dungeonPlanFromRead(read: ImagePlanRead): { rooms: Array<Record<string, unknown>>; links: string[][] } {
  const raw = Array.isArray(read.data.rooms) ? read.data.rooms.slice(0, 12) : [];
  const rooms: Array<Record<string, unknown>> = [];
  const indexOf = new Map<number, string>();
  raw.forEach((item, i) => {
    const r = item as Record<string, unknown>;
    const x = Number(r.x), y = Number(r.y), w = Number(r.w), h = Number(r.h);
    if (![x, y, w, h].every(Number.isFinite)) return;
    const id = `r${rooms.length + 1}`;
    indexOf.set(i, id);
    rooms.push({
      id, kind: rooms.length === 0 ? "entrance" : ROOM_KINDS[String(r.kind)] ?? "hall",
      x: Math.max(0, Math.round(x * DUNGEON_POS_SCALE)), y: Math.max(0, Math.round(y * DUNGEON_POS_SCALE)),
      w: Math.max(6, Math.min(40, Math.round(w * DUNGEON_SIZE_SCALE))), h: Math.max(5, Math.min(22, Math.round(h * DUNGEON_SIZE_SCALE))),
    });
  });
  const links: string[][] = [];
  for (const pair of Array.isArray(read.data.links) ? read.data.links : []) {
    if (!Array.isArray(pair) || pair.length < 2) continue;
    const a = indexOf.get(Number(pair[0])), b = indexOf.get(Number(pair[1]));
    if (a && b && a !== b) links.push([a, b]);
  }
  return { rooms, links };
}

/** 조수에게 가는 짓기 지시 — 읽은 배치를 그대로 빌더 인자로 보내게 한다. */
export function imagePlanBuildNote(scene: ImagePlanScene, read: ImagePlanRead | null): string {
  const head = `[그림 도안] 짓기 전에 이 장면을 ChatGPT 이미지 모델로 그린 도안(첫 요청에 붙은 그림)과, 그 도안에서 칸 번호로 읽은 배치를 함께 싣는다. 도안의 큰 구도(장소 윤곽·구역 자리·길·높낮이·랜드마크 위치)를 따르되 칸과 물건은 이 프로젝트의 실제 칩셋 조각만 쓴다. 도안의 색·질감을 베끼지 않는다.`;
  if (!read) return head;
  if (read.cells) return `${head}\n${cellBuildNote(scene.subject, read.cells)}`;
  if (scene.subject === "village") {
    const a = villageArgsFromRead(read, 56, 44);
    return `${head}\n읽은 마을 배치: author_beodeul_town 을 부를 때 이 인자를 그대로 보낸다(맵 크기 ${a.width}×${a.height}, 자리는 맵 칸 좌표): ${JSON.stringify(a)}. 이 인자를 빼거나 기본값으로 바꾸지 않는다.`;
  }
  if (scene.subject === "forest") {
    return `${head}\n읽은 숲길 설계: author_forest_route 를 부를 때 designs[0] 을 이대로 보낸다: ${JSON.stringify(forestDesignFromRead(read))}. 이 설계를 빼거나 기본값으로 바꾸지 않는다.`;
  }
  if (scene.subject === "dungeon" || scene.subject === "castle") {
    const plan = dungeonPlanFromRead(read);
    return plan.rooms.length
      ? `${head}\n읽은 방 배치: author_dungeon 을 부를 때 rooms 와 links 를 이대로 보낸다(x·y 는 방 자리, 첫 방 = 입구): rooms=${JSON.stringify(plan.rooms)} links=${JSON.stringify(plan.links)}. 방 자리·크기·통로를 빼거나 기본값으로 바꾸지 않는다.`
      : head;
  }
  return `${head}\n읽은 방 배치(도안 칸 기준): ${JSON.stringify(read.data)}. 실내 평면도를 따라 방 구획·문·가구 자리를 정한다.`;
}

function cellBuildNote(subject: WidenSubject, cells: CellMap): string {
  const marks = cells.landmarks.map((l) => `${l.id}=${l.label ?? l.kind}(${l.x},${l.y} ${l.w}×${l.h})`).join(" · ");
  const markLine = marks ? ` 도안의 랜드마크(빠짐없이 짓는다 — 칩셋에 맞는 조각이 없으면 비워 두지 말고 가장 가까운 조각으로 자리를 채우고 그렇게 말한다): ${marks}.` : "";
  if (subject === "village") {
    const a = villageArgsFromCells(cells);
    return `읽은 마을 칸 지도(${cells.cols}×${cells.rows}): author_beodeul_town 을 부를 때 이 인자를 그대로 보낸다(맵 크기 ${a.width}×${a.height} = 도안 가로세로비, 자리는 맵 칸 좌표): ${JSON.stringify(a)}. 이 인자를 빼거나 기본값으로 바꾸지 않는다.${markLine}`;
  }
  if (subject === "forest") {
    return `읽은 숲길 설계: author_forest_route 를 부를 때 designs[0] 을 이대로 보낸다: ${JSON.stringify(forestDesignFromCells(cells))}. 이 설계를 빼거나 기본값으로 바꾸지 않는다.${markLine}\n도안 칸 지도(_ 바깥 · 0~3 땅 단 · ~ 물 · | 폭포 · = 길 · t 나무 · h 건물 · A~Z 랜드마크):\n${cells.cells.join("\n")}`;
  }
  if (subject === "dungeon" || subject === "castle") {
    const plan = dungeonPlanFromCells(cells);
    return plan.rooms.length
      ? `읽은 방 배치(도안 칸 = 맵 칸, 늘리지 않는다): author_dungeon 을 부를 때 rooms 와 links 를 이대로 보낸다(x·y 는 방 자리, 첫 방 = 입구, 한 층): rooms=${JSON.stringify(plan.rooms)} links=${JSON.stringify(plan.links)}. 방 자리·크기·통로를 빼거나 기본값으로 바꾸지 않는다.${markLine}`
      : markLine;
  }
  return `읽은 실내 칸 지도(${cells.cols}×${cells.rows}, _ 바깥 · # 벽 · . 바닥 · = 복도 · ~ 물 · A~Z 랜드마크): 방 구획·문·가구 자리를 이 지도대로 정한다.${markLine}\n${cells.cells.join("\n")}`;
}

export const IMAGE_PLAN_SKIPPED_LINE = "그림 도안을 건너뛰었어요 — ChatGPT 계정이 연결돼 있지 않습니다. 도안 없이 지어요.";
export const IMAGE_PLAN_FAILED_LINE = "그림 도안을 받지 못했어요(ChatGPT 이미지 요청 실패). 도안 없이 지어요.";
export const IMAGE_PLAN_READ_FAILED_LINE = "도안은 받았지만 배치를 읽지 못했어요. 도안 그림만 보여 주고 지어요.";
