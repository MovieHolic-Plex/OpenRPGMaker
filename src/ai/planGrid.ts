// ai/planGrid.ts
// 공간 기획 도안 → 칸 단위 도면 코드(2026-11-05 plan-to-grid, 오너: 「도안은 그냥 공간을 '기획' 하는 정도로만 … AI 가 이미지를 읽고 도면을 다시 코드로 만들어 낼 수 있는 하네싱이 필요할듯. 칸 단위로 그리게끔」).
// 비전 모델은 도안을 「구역(이름·종류·높이·담을 것·모양) + 길(꺾이는 점) + 물건(칸 자리) + 입구」로 다시 그려 JSON 으로 답하고, 이 파일이 그것을
// W×H 칸 층(구역 id·높이·물·길·물건)으로 굳힌다. 검사(크기·구역 덮임·입구에서 이어짐)와 다시 그리기 색(겹쳐 보고 틀린 구역만 고치기)도 여기 둔다.
// 순수 함수만 — 호출(이미지·비전)은 editor/imagePlanMockup.ts, 칸 층을 실제 맵으로 까는 변환은 editor/tools/planGridBuild.ts.
import type { WidenSubject } from "./vagueWidenCatalog";

export type PlanShape =
  | { readonly rect: readonly number[] }
  | { readonly ellipse: readonly number[] }
  | { readonly poly: readonly (readonly number[])[] }
  | { readonly union: readonly PlanShape[] }
  | { readonly ring: readonly PlanShape[] };

export const PLAN_ZONE_KINDS_OUT = ["plaza", "building", "forest", "water", "field", "cliff", "landmark", "yard", "garden", "shrine", "bridge", "other"] as const;
export const PLAN_ZONE_KINDS_IN = ["room", "hall", "corridor", "water", "pit", "landmark", "stairs", "other"] as const;

export interface PlanZone {
  readonly id: string;
  readonly name: string;
  readonly kind: string;
  readonly level: number;
  readonly floor?: string;
  readonly contains: readonly string[];
  readonly shape: PlanShape;
}
export interface PlanPath { readonly from?: string; readonly to?: string; readonly kind: string; readonly width: number; readonly points: readonly (readonly [number, number])[] }
export interface PlanObject { readonly name: string; readonly zone?: string; readonly x: number; readonly y: number; readonly w: number; readonly h: number }
export interface PlanCode {
  readonly cols: number;
  readonly rows: number;
  readonly subject: WidenSubject;
  readonly outline: PlanShape | null;
  readonly zones: readonly PlanZone[];
  readonly paths: readonly PlanPath[];
  readonly objects: readonly PlanObject[];
  readonly entrance: { readonly x: number; readonly y: number; readonly side: string } | null;
}

/** 굳힌 칸 층. zone = 구역 순번(-1 없음), path = 길 칸, land = 땅(야외 윤곽 안), walk = 걸을 수 있는 칸. */
export interface PlanGrid {
  readonly code: PlanCode;
  readonly cols: number;
  readonly rows: number;
  readonly zone: Int16Array;
  readonly path: Uint8Array;
  readonly land: Uint8Array;
  readonly walk: Uint8Array;
  readonly masks: readonly Uint8Array[];
}

export interface PlanCheck {
  readonly issues: readonly string[];
  /** 걸을 수 있는 구역 가운데 입구에서 닿는 비율(0~1). */
  readonly connectivity: number;
  readonly zones: number;
  readonly objects: number;
}

export const PLAN_INDOOR = (s: WidenSubject): boolean => s === "dungeon" || s === "castle" || s === "house";
/** 걷지 못하는 구역 종류(야외는 숲·건물·물·절벽, 실내는 물·구덩이). */
const BLOCKING = new Set(["water", "cliff", "forest", "building", "pit"]);

/** 격자 크기 — 긴 변 60칸(집 실내 40칸), 짧은 변은 도안 비율(최소 20). */
export function planGridSize(width: number, height: number, subject: WidenSubject): { readonly cols: number; readonly rows: number } {
  const long = subject === "house" ? 40 : 60;
  const short = (a: number, b: number) => Math.max(20, Math.round(long * a / b));
  return width >= height ? { cols: long, rows: short(height, width) } : { cols: short(width, height), rows: long };
}

/** 공간 기획 도안 그리기 지시(그림 모델). 예쁜 스크린샷이 아니라 구역·길·무엇이 어디에 있는지가 읽히는 위에서 본 기획도. */
export function planImagePrompt(subject: WidenSubject, what: string): string {
  const place = subject === "house" ? `the ground floor of a house: ${what}` : subject === "dungeon" ? `one dungeon floor: ${what}` : subject === "castle" ? `one castle floor: ${what}` : subject === "forest" ? `a forest area: ${what}` : `a village: ${what}`;
  const indoor = subject === "house" || subject === "dungeon" || subject === "castle";
  return [
    `Draw a SPATIAL PLANNING SHEET for a 2D top-down RPG map of ${place}. It is a designer's zoning plan, not a game screenshot: decide what goes where and what each space should contain.`,
    "Strictly top-down orthographic view (no perspective, no 3/4 view, no walls drawn in front view). Show the whole place on one sheet with an even margin.",
    indoor
      ? "Rooms are clean flat-coloured floor areas with crisp boundaries and a thin dark wall line; corridors are clear 1-3 cell wide strips; everything outside the rooms is plain black."
      : "Zones are clean flat-coloured areas with crisp boundaries: grass, plazas, fields, forest canopy, water, cliffs (shade higher ground lighter and outline cliff edges), with clear roads/paths between them. If the place is an island or plateau, show its outline over a plain dark background.",
    "Each space shows small simple top-down icons of what it contains (furniture, stalls, statues, trees, boats, altars...) at the spots where they belong, with a clear landmark. Mark the entrance with an arrow-free gap or gate.",
    "Use a faint square grid feel (things aligned to cells). Distinct zones, varied sizes and shapes, paths that make sense. No text, no labels, no numbers, no people, no monsters, no UI, no legend.",
  ].join(" ");
}

/** 도면 코드 읽기 지시(비전). 도안 위에 칸 번호 격자를 그린 그림과 함께 간다. */
export function planReadPrompt(subject: WidenSubject, cols: number, rows: number): string {
  const indoor = PLAN_INDOOR(subject);
  const kinds = (indoor ? PLAN_ZONE_KINDS_IN : PLAN_ZONE_KINDS_OUT).join("|");
  return [
    `이 그림은 RPG 맵의 공간 기획 도안이다. 노란 칸 격자(가로 ${cols}칸 0~${cols - 1}, 세로 ${rows}칸 0~${rows - 1}, 5칸마다 번호)를 그렸다. 도안을 칸 단위 도면 코드로 다시 그려 JSON 하나만 답하라. 좌표는 모두 칸 번호(정수), 사각형은 [왼쪽 x, 위 y, 가로 칸 수, 세로 칸 수].`,
    "순서: 1) 도안의 구역(공간)을 빠짐없이 나눈다 — 이름, 종류, 그 공간에 있는 것(물건·특징), 모양. 2) 구역을 잇는 길·통로·다리·계단. 3) 눈에 띄는 물건마다 자리. 4) 입구 칸.",
    "모양(shape)은 도안 윤곽을 따른다: 네모 방은 {\"rect\":[x,y,w,h]}, 둥근 곳은 {\"ellipse\":[cx,cy,rx,ry]}, 불규칙한 곳은 {\"poly\":[[x,y],…]}(꼭짓점 4~16개, 시계 방향), 여러 조각이면 {\"union\":[모양,…]}. 고리·도넛은 {\"ring\":[바깥 모양, 안 구멍 모양]}.",
    indoor
      ? "실내·던전: 바깥 검은 허공은 구역이 아니다. 방·홀은 바닥이 보이는 칸만 덮고(벽 두께 제외), 통로는 실제 통로 칸 폭(1~3)으로 그린다."
      : "야외: 맵 바깥(허공·하늘)이 있으면 outline 으로 땅 윤곽을 준다. level 은 땅 높이 단(0 가장 낮음, 절벽·돌벽 하나 오를 때 +1). 숲 구역은 나무가 빽빽한 곳.",
    "JSON 형식:",
    `{"outline":모양|null(땅·건물 전체 윤곽, 맵 전체가 땅이면 null),"zones":[{"id":"A"(A~Z),"name":"짧은 한국어 이름","kind":"${kinds}","level":0~3,"floor":"grass|dirt|stone|sand|wood|carpet|tile|water|snow","contains":["그 공간에 둘 것",…최대 6],"shape":모양}],"paths":[{"from":"A","to":"B","kind":"road|corridor|bridge|stairs|door","width":1~3,"points":[[x,y],[x,y],…](꺾이는 점, 직선 구간으로 잇는다)}],"objects":[{"name":"물건 이름","zone":"A","x":,"y":,"w":,"h":}](랜드마크·큰 가구·석상·분수·나무 한 그루·상자 등, 최대 40),"entrance":{"x":,"y":,"side":"north|south|east|west|inside"}}`,
    "구역은 실제 그림 자리·크기에 맞춘다. 가운데로 모으거나 네모로 단순화하지 않는다. 겹치는 구역은 나중 것이 위에 칠해진다(작은 구역을 뒤에).",
  ].join("\n");
}

/** 겹쳐 보고 틀린 구역만 고치는 지시. 둘째 그림 = 지금 도면 코드를 구역 종류 색으로 칠해 도안 위에 겹친 것. */
export function planFixPrompt(code: PlanCode, issues: readonly string[]): string {
  const list = code.zones.map((z) => `${z.id}=${z.name}[${z.kind}]`).join("; ");
  return [
    `첫 그림은 칸 격자(${code.cols}×${code.rows})를 그린 공간 기획 도안, 둘째 그림은 지금 도면 코드를 구역마다 색(가운데 글자 = 구역 id, 연한 노랑 = 길, 흰 테두리 = 물건)으로 칠해 같은 도안 위에 반투명으로 겹친 것이다.`,
    `지금 구역: ${list}.`,
    issues.length ? `기계 검사 문제: ${issues.join(" / ")}` : "기계 검사 문제 없음.",
    "겹친 색이 도안과 어긋난 곳(자리·크기·모양이 틀린 구역, 빠진 구역·물길·절벽·길, 없는 구역에 칠한 색)을 찾아 고친 것만 JSON 하나로 답하라. 맞는 구역은 적지 않는다.",
    '{"ok":true|false(고칠 것이 없으면 true),"replace":[고친 구역 전체 객체(같은 id, 처음 형식과 같다: id,name,kind,level,floor,contains,shape)],"add":[새 구역],"remove":["지울 구역 id"],"paths":[새로 더하거나 바꿀 길(같은 from·to 면 바꾼다)],"objects":[빠진 물건만],"outline":모양|null(바꿀 때만),"entrance":{"x","y","side"}|null(바꿀 때만)}',
    '모양 형식: {"rect":[x,y,w,h]} {"ellipse":[cx,cy,rx,ry]} {"poly":[[x,y],…]} {"union":[…]} {"ring":[바깥,구멍]}. 좌표는 칸 번호.',
  ].join("\n");
}

// ── 파싱 ────────────────────────────────────────────────────────────────────────────────────────────────

const num = (v: unknown): number | null => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const int = (v: unknown, d: number): number => { const n = num(v); return n === null ? d : Math.round(n); };
const str = (v: unknown, n: number): string => (typeof v === "string" ? v.replace(/\s+/gu, " ").trim().slice(0, n) : "");

function parseShape(v: unknown, depth = 0): PlanShape | null {
  if (!v || typeof v !== "object" || depth > 4) return null;
  const o = v as Record<string, unknown>;
  const nums = (a: unknown, n: number) => (Array.isArray(a) && a.length >= n && a.slice(0, n).every((x) => num(x) !== null) ? a.slice(0, n).map(Number) : null);
  if ("rect" in o) { const r = nums(o.rect, 4); return r && r[2]! >= 1 && r[3]! >= 1 ? { rect: r } : null; }
  if ("ellipse" in o) { const e = nums(o.ellipse, 4); return e && e[2]! > 0 && e[3]! > 0 ? { ellipse: e } : null; }
  if ("poly" in o && Array.isArray(o.poly)) { const pts = o.poly.map((p) => nums(p, 2)).filter((p): p is number[] => !!p); return pts.length >= 3 ? { poly: pts.slice(0, 40) } : null; }
  if ("union" in o && Array.isArray(o.union)) { const parts = o.union.map((s) => parseShape(s, depth + 1)).filter((s): s is PlanShape => !!s); return parts.length ? { union: parts.slice(0, 12) } : null; }
  if ("ring" in o && Array.isArray(o.ring) && o.ring.length >= 2) { const a = parseShape(o.ring[0], depth + 1), b = parseShape(o.ring[1], depth + 1); return a && b ? { ring: [a, b] } : a; }
  return null;
}

function parseZone(v: unknown, indoor: boolean): PlanZone | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const shape = parseShape(o.shape);
  const id = str(o.id, 3);
  if (!shape || !id) return null;
  const kinds: readonly string[] = indoor ? PLAN_ZONE_KINDS_IN : PLAN_ZONE_KINDS_OUT;
  const kind = str(o.kind, 20).toLowerCase();
  return {
    id, name: str(o.name, 30) || id, kind: kinds.includes(kind) ? kind : "other", level: Math.max(0, Math.min(3, int(o.level, 0))),
    ...(str(o.floor, 12) ? { floor: str(o.floor, 12).toLowerCase() } : {}),
    contains: (Array.isArray(o.contains) ? o.contains : []).map((c) => str(c, 30)).filter(Boolean).slice(0, 6), shape,
  };
}

function parsePath(v: unknown): PlanPath | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const points = (Array.isArray(o.points) ? o.points : []).flatMap((p) => (Array.isArray(p) && num(p[0]) !== null && num(p[1]) !== null ? [[Math.round(Number(p[0])), Math.round(Number(p[1]))] as const] : []));
  if (points.length < 2) return null;
  return { ...(str(o.from, 3) ? { from: str(o.from, 3) } : {}), ...(str(o.to, 3) ? { to: str(o.to, 3) } : {}), kind: str(o.kind, 12) || "road", width: Math.max(1, Math.min(3, int(o.width, 1))), points: points.slice(0, 30) };
}

function parseObject(v: unknown): PlanObject | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const x = num(o.x), y = num(o.y), name = str(o.name, 30);
  if (x === null || y === null || !name) return null;
  return { name, ...(str(o.zone, 3) ? { zone: str(o.zone, 3) } : {}), x: Math.round(x), y: Math.round(y), w: Math.max(1, Math.min(12, int(o.w, 1))), h: Math.max(1, Math.min(12, int(o.h, 1))) };
}

/** 비전 답 → 도면 코드. 구역이 없으면 null. */
export function parsePlanCode(data: Record<string, unknown> | null, subject: WidenSubject, cols: number, rows: number): PlanCode | null {
  if (!data) return null;
  const indoor = PLAN_INDOOR(subject);
  const seen = new Set<string>();
  const zones = (Array.isArray(data.zones) ? data.zones : []).map((z) => parseZone(z, indoor)).filter((z): z is PlanZone => !!z && !seen.has(z.id) && !!seen.add(z.id)).slice(0, 40);
  if (!zones.length) return null;
  const e = data.entrance && typeof data.entrance === "object" ? data.entrance as Record<string, unknown> : null;
  return {
    cols, rows, subject, outline: indoor ? null : parseShape(data.outline), zones,
    paths: (Array.isArray(data.paths) ? data.paths : []).map(parsePath).filter((p): p is PlanPath => !!p).slice(0, 60),
    objects: (Array.isArray(data.objects) ? data.objects : []).map(parseObject).filter((o): o is PlanObject => !!o && o.x >= 0 && o.y >= 0 && o.x < cols && o.y < rows).slice(0, 60),
    entrance: e && num(e.x) !== null && num(e.y) !== null ? { x: Math.max(0, Math.min(cols - 1, Math.round(Number(e.x)))), y: Math.max(0, Math.min(rows - 1, Math.round(Number(e.y)))), side: str(e.side, 8) || "south" } : null,
  };
}

/** 고친 것(replace·add·remove·paths·objects·outline·entrance)을 덧붙인다. 바뀐 항목 수도 돌려준다. */
export function applyPlanFix(code: PlanCode, data: Record<string, unknown> | null): { readonly code: PlanCode; readonly changed: number } {
  if (!data) return { code, changed: 0 };
  const indoor = PLAN_INDOOR(code.subject);
  let zones = [...code.zones], paths = [...code.paths], objects = [...code.objects];
  let changed = 0;
  for (const raw of Array.isArray(data.replace) ? data.replace : []) {
    const z = parseZone(raw, indoor); const i = z ? zones.findIndex((q) => q.id === z.id) : -1;
    if (z && i >= 0) { zones[i] = z; changed += 1; }
  }
  for (const raw of Array.isArray(data.add) ? data.add : []) {
    const z = parseZone(raw, indoor);
    if (!z) continue;
    const id = zones.some((q) => q.id === z.id) ? [..."ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"].find((c) => !zones.some((q) => q.id === c)) : z.id;
    if (!id) continue;
    zones.push({ ...z, id }); changed += 1;
  }
  const rm = new Set((Array.isArray(data.remove) ? data.remove : []).map((v) => String(v)));
  if (rm.size) { const before = zones.length; zones = zones.filter((z) => !rm.has(z.id)); changed += before - zones.length; }
  for (const raw of Array.isArray(data.paths) ? data.paths : []) {
    const p = parsePath(raw); if (!p) continue;
    paths = [...paths.filter((q) => !(p.from && q.from === p.from && q.to === p.to)), p]; changed += 1;
  }
  for (const raw of Array.isArray(data.objects) ? data.objects : []) { const o = parseObject(raw); if (o && o.x < code.cols && o.y < code.rows) { objects.push(o); changed += 1; } }
  const outline = !indoor && data.outline ? parseShape(data.outline) ?? code.outline : code.outline;
  if (outline !== code.outline) changed += 1;
  const e = data.entrance && typeof data.entrance === "object" ? parseObject({ ...(data.entrance as object), name: "entrance" }) : null;
  if (e) changed += 1;
  return { code: { ...code, zones: zones.length ? zones : code.zones, paths: paths.slice(0, 60), objects: objects.slice(0, 60), outline, entrance: e ? { x: e.x, y: e.y, side: str((data.entrance as Record<string, unknown>).side, 8) || "south" } : code.entrance }, changed };
}

// ── 칸으로 굳히기 ───────────────────────────────────────────────────────────────────────────────────────

/** 모양 → 칸 마스크(칸 가운데가 모양 안이면 1). poly 는 칸 가운데 짝홀 규칙. */
export function rasterShape(shape: PlanShape, cols: number, rows: number): Uint8Array {
  const m = new Uint8Array(cols * rows);
  const paint = (s: PlanShape, v: 0 | 1) => {
    if ("rect" in s) {
      const [x, y, w, h] = s.rect.map(Math.round) as [number, number, number, number];
      for (let yy = Math.max(0, y); yy < Math.min(rows, y + h); yy += 1) for (let xx = Math.max(0, x); xx < Math.min(cols, x + w); xx += 1) m[yy * cols + xx] = v;
    } else if ("ellipse" in s) {
      const [cx, cy, rx, ry] = s.ellipse as [number, number, number, number];
      for (let yy = 0; yy < rows; yy += 1) for (let xx = 0; xx < cols; xx += 1) if (((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2 <= 1) m[yy * cols + xx] = v;
    } else if ("poly" in s) {
      const pts = s.poly.map((p) => [p[0]! + 0.5, p[1]! + 0.5] as const);
      for (let yy = 0; yy < rows; yy += 1) for (let xx = 0; xx < cols; xx += 1) {
        const px = xx + 0.5, py = yy + 0.5; let inside = false;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i, i += 1) {
          const [xi, yi] = pts[i]!, [xj, yj] = pts[j]!;
          if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) inside = !inside;
        }
        if (inside) m[yy * cols + xx] = v;
      }
    } else if ("union" in s) for (const t of s.union) paint(t, v);
    else if ("ring" in s) { paint(s.ring[0]!, v); if (s.ring[1]) paint(s.ring[1], 0); }
  };
  paint(shape, 1);
  return m;
}

/** 길 꺾은선 → 칸(폭 width, 굵기는 오른쪽·아래로). */
export function rasterPath(p: PlanPath, cols: number, rows: number, into: Uint8Array): void {
  for (let k = 1; k < p.points.length; k += 1) {
    const [x0, y0] = p.points[k - 1]!, [x1, y1] = p.points[k]!;
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let s = 0; s <= n; s += 1) {
      const x = Math.round(x0 + (x1 - x0) * s / n), y = Math.round(y0 + (y1 - y0) * s / n);
      for (let dy = 0; dy < p.width; dy += 1) for (let dx = 0; dx < p.width; dx += 1) {
        const X = x + dx - ((p.width - 1) >> 1), Y = y + dy - ((p.width - 1) >> 1);
        if (X >= 0 && Y >= 0 && X < cols && Y < rows) into[Y * cols + X] = 1;
      }
    }
  }
}

export function compilePlan(code: PlanCode): PlanGrid {
  const { cols, rows } = code;
  const indoor = PLAN_INDOOR(code.subject);
  const N = cols * rows;
  const zone = new Int16Array(N).fill(-1), path = new Uint8Array(N), walk = new Uint8Array(N);
  const land = indoor ? new Uint8Array(N) : code.outline ? rasterShape(code.outline, cols, rows) : new Uint8Array(N).fill(1);
  const masks = code.zones.map((z) => rasterShape(z.shape, cols, rows));
  masks.forEach((m, i) => { for (let k = 0; k < N; k += 1) if (m[k]) zone[k] = i; });
  for (const p of code.paths) rasterPath(p, cols, rows, path);
  for (let k = 0; k < N; k += 1) {
    const z = zone[k]! >= 0 ? code.zones[zone[k]!]! : null;
    const blocked = !!z && BLOCKING.has(z.kind);
    walk[k] = path[k] ? 1 : indoor ? (z && !blocked ? 1 : 0) : ((land[k] || z) && !blocked ? 1 : 0);
  }
  return { code, cols, rows, zone, path, land, walk, masks };
}

/** 검사: 구역 크기·가려짐, 입구, 입구에서 걸어 닿는 구역 비율. */
export function checkPlan(g: PlanGrid): PlanCheck {
  const { cols, rows, code } = g;
  const issues: string[] = [];
  code.zones.forEach((z, i) => {
    const m = g.masks[i]!; let n = 0, vis = 0;
    for (let k = 0; k < m.length; k += 1) if (m[k]) { n += 1; if (g.zone[k] === i) vis += 1; }
    if (n < 4) issues.push(`zone ${z.id} too small (${n})`);
    else if (vis < n * 0.5) issues.push(`zone ${z.id} mostly covered (${vis}/${n})`);
  });
  const reach = new Uint8Array(cols * rows);
  if (!code.entrance) issues.push("no entrance");
  else {
    let best = -1, bestD = Infinity;
    for (let k = 0; k < reach.length; k += 1) if (g.walk[k]) { const d = Math.abs(k % cols - code.entrance.x) + Math.abs(Math.floor(k / cols) - code.entrance.y); if (d < bestD) { bestD = d; best = k; } }
    if (best >= 0) {
      const q = [best]; reach[best] = 1;
      while (q.length) {
        const k = q.pop()!, x = k % cols, y = (k - x) / cols;
        for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as const) {
          if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
          const n = ny * cols + nx; if (!reach[n] && g.walk[n]) { reach[n] = 1; q.push(n); }
        }
      }
    }
  }
  const walkZones = code.zones.map((z, i) => ({ z, i })).filter(({ z }) => !BLOCKING.has(z.kind));
  const unreached = walkZones.filter(({ i }) => !g.masks[i]!.some((v, k) => v && reach[k]));
  if (unreached.length) issues.push(`unreached ${unreached.map(({ z }) => z.id).join(",")}`);
  return { issues, connectivity: walkZones.length ? Math.round(1000 * (walkZones.length - unreached.length) / walkZones.length) / 1000 : 1, zones: code.zones.length, objects: code.objects.length };
}

const KIND_RGB: Record<string, readonly [number, number, number]> = {
  water: [40, 110, 230], forest: [20, 100, 40], building: [170, 80, 40], plaza: [225, 200, 140], field: [170, 190, 70], cliff: [110, 100, 95],
  landmark: [240, 40, 220], yard: [190, 210, 120], garden: [120, 200, 120], shrine: [240, 120, 200], bridge: [200, 150, 90],
  room: [205, 195, 170], hall: [225, 215, 185], corridor: [235, 225, 170], pit: [30, 20, 20], stairs: [250, 250, 120], other: [160, 160, 200],
};
/** 다시 그리기 색: 구역 종류 색(높을수록 어둡게), 길 연노랑, 바깥 땅 풀색, 허공 검정. */
export function planCellColor(g: PlanGrid, k: number): readonly [number, number, number] {
  if (g.path[k]) return [250, 235, 160];
  const i = g.zone[k]!;
  if (i < 0) return g.land[k] ? [110, 170, 80] : [0, 0, 0];
  const z = g.code.zones[i]!;
  const c = KIND_RGB[z.kind] ?? KIND_RGB.other!;
  if (BLOCKING.has(z.kind) || z.kind === "landmark") return c;
  const f = 1 - 0.13 * z.level;
  return [Math.round(c[0] * f), Math.round(c[1] * f), Math.round(c[2] * f)];
}

/** 조수에게 싣는 짧은 요약(구역 이름·담을 것). */
export function planSummary(code: PlanCode): string {
  return code.zones.map((z) => `${z.id} ${z.name}(${z.kind}${z.level ? ` ${z.level}단` : ""})${z.contains.length ? `: ${z.contains.join(", ")}` : ""}`).join(" / ").slice(0, 1500);
}
