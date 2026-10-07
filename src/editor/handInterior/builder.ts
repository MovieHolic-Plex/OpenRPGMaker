// 손 도트 실내 v5 조립기 — 평면 문자열 한 장이 방 구조(천장·벽면·바닥)를 정하고, 가구는 v5 물건 id 로 넣는다.
// 칸 사전은 src/assets/handInteriorSpec.json(scripts/content/hand-interior/build_tileset.py 가 시트와 함께 만든다).
// 구조 규칙은 tiledata/hand-interior/v5/room2.py 의 render 와 같다 — 예제 26맵의 1층을 이 규칙으로 다시 만들면
// 번들 예제와 칸 번호까지 같다(test/handInteriorBuilder.test.ts).
//
//  평면: '#' = 막힘(벽·천장·건물 밖), 그 밖 = 실내. 막힌 칸 바로 아래 두 줄 = 벽면(못 걸음), 나머지 = 바닥.
//        막힌 칸 중 실내에 닿는(8방) 칸 = 천장 띠, 닿지 않는 칸 = 공허.
//  층:   1층 = 구조, 2층 = 바닥 무늬(깔개·줄 자동 타일 중 밟는 것), 3·4층 = 그리는 순서대로 가구 조각, 탁상 물건은 4층.
//  순서: 걸이 = 벽면 윗줄 y·16, 바닥 무늬 = 맨 먼저, 나머지 = (y + 높이)·16 — 남쪽 가구가 나중(앞)에 그려진다.
//  문(door, jp_city): 가로 칸막이의 1칸 틈 (x,y) 에 단다 — 틈 칸 = 인방 ★, 그 아래 벽면 높이 두 줄 = 열린 문틀(윗줄 ★ · 아랫줄 2층). 통로는 막지 않는다.
//  옆문(sidedoor): 세로 칸막이 3줄 틈의 통로 칸 (x,y) 에 단다 — 위 두 칸(칸막이 끝 벽면) ★ + 통로 칸 2층.
import spec from "@/assets/handInteriorSpec.json";
import jpSpec from "@/assets/jpInteriorSpec.json";
import wizardingSpec from "@/assets/wizardingRoomSpec.json";
import { passabilityOf } from "@/project/collision";
import type { TilesetDef } from "@/project/types";

export const HAND_INTERIOR_TILESET_ID = "atlas_biome_interior";

type SpecCell = readonly [number, number, number, number];
interface SpecObject {
  readonly ko: string; readonly category: string; readonly category_ko: string; readonly kind: "floor" | "wall" | "hang" | "flat" | "door" | "sidedoor";
  readonly w: number; readonly h: number; readonly up: number; readonly cells: readonly SpecCell[];
  readonly surface?: readonly number[]; readonly animated?: boolean; readonly stairs?: "up" | "down";
  /** 조수용 메모(tiledata/hand-interior/v5/notes6.py): 무엇인지 한 줄 · 쓰는 방 태그 · 놓는 곳 · 짝 소품 id. */
  readonly desc?: string; readonly tags?: readonly string[]; readonly place?: string; readonly pair?: readonly string[];
  /** 쓰임(tiledata/hand-interior/v5/use6.py USE_KO): sit·sleep·open·search·read·counter·travel·light·save·heal·switch·push·trap·key·gate·seal·walk·block. */
  readonly use?: readonly string[];
  /** 바라보는 쪽. 없으면 남쪽(카메라 쪽). */
  readonly facing?: "N" | "S" | "E" | "W";
  /** 같은 물건의 다른 상태 그림 — 이벤트 쪽(page)마다 그림을 바꿀 때. others = {상태: 가구 id}. */
  readonly states?: { readonly group: string; readonly state: string; readonly others: Readonly<Record<string, string>> };
}
/** 방 종류 표: 예제 26맵을 방 단위로 나눈 결과. examples = [맵 id, 건물 id, 방 종류, [[가구 id, 개수]]]. */
export interface HandInteriorRoomTable {
  readonly kinds: Readonly<Record<string, { readonly ko: string; readonly alias: readonly string[] }>>;
  readonly buildings: Readonly<Record<string, string>>;
  readonly examples: readonly (readonly [string, string, string, readonly (readonly [string, number])[]])[];
  /** 예제 참고문서 id 머리(없으면 hand-interior-v5-map-). */
  readonly docPrefix?: string;
}
interface SpecTable { readonly ko: string; readonly up: number; readonly oneRow: boolean; readonly pieces: Readonly<Record<string, readonly SpecCell[]>> }
interface SpecLine { readonly ko: string; readonly kind: "floor" | "flat"; readonly up: number; readonly pieces: Readonly<Record<string, readonly SpecCell[]>> }
export interface HandInteriorSpec {
  readonly blank: number; readonly void: number;
  /** 바닥: cols×rows 칸 주기(표면마다 짜임 주기의 배수) × 그림자 4. 번호 = ((y%rows)*cols + x%cols)*4 + 그림자. */
  readonly floors: Readonly<Record<string, { readonly ko: string; readonly cols: number; readonly rows: number; readonly tiles: readonly number[]; readonly lay?: "rowShift" }>>;
  /** 벽면: 2줄 × cols 열 × 서쪽 그림자. 번호 = ((줄-1)*cols + x%cols)*2 + 서쪽. */
  readonly walls: Readonly<Record<string, { readonly ko: string; readonly cols: number; readonly tiles: readonly number[] }>>;
  readonly ceilings: Readonly<Record<string, readonly number[]>>;
  readonly objects: Readonly<Record<string, SpecObject>>;
  readonly tables: Readonly<Record<string, SpecTable>>;
  readonly lines: Readonly<Record<string, SpecLine>>;
  readonly daises: Readonly<Record<string, { readonly ko: string; readonly pieces: Readonly<Record<string, number>> }>>;
  readonly goods: Readonly<Record<string, number>>;
  readonly rooms?: HandInteriorRoomTable;
}
export const HAND_INTERIOR_SPEC = spec as unknown as HandInteriorSpec;
/** 일본 실내(jp_city 번들 안) — 같은 모양의 사양을 scripts/content/jp-city/bake_interior_spec.py 가 굽는다. 조립 규칙은 같다. */
export const JP_INTERIOR_TILESET_ID = "jp_city";
export const JP_INTERIOR_SPEC = jpSpec as unknown as HandInteriorSpec;
/** 마법 학교(wizarding_world) — 바닥·벽면·천장 변형 칸만 scripts/content/wizarding/roomkit_wz.py 가 굽는다. 가구는 칩셋 조립 부품에서(kitHandObjects). */
export const WIZARDING_INTERIOR_TILESET_ID = "wizarding_world";
export const WIZARDING_INTERIOR_SPEC = wizardingSpec as unknown as HandInteriorSpec;
/** 실내를 지을 수 있는 칩셋 → 사양. */
export const HAND_INTERIOR_SPECS: Readonly<Record<string, HandInteriorSpec>> = {
  [HAND_INTERIOR_TILESET_ID]: HAND_INTERIOR_SPEC, [JP_INTERIOR_TILESET_ID]: JP_INTERIOR_SPEC, [WIZARDING_INTERIOR_TILESET_ID]: WIZARDING_INTERIOR_SPEC,
};

/**
 * 타일셋의 방 짓기 역할표(roomKit). 칩셋 id 가 아니라 타일셋 정의를 보므로 스토어 사본(id 가 store_… 로 바뀐 것)도 짓는다.
 * roomKit 이 없는 옛 저장본의 번들 칩셋은 id 로 찾는다.
 */
export function roomSpecOf(tileset: Pick<TilesetDef, "id" | "roomKit"> | undefined): HandInteriorSpec | undefined {
  if (!tileset) return undefined;
  const kit = tileset.roomKit;
  if (kit?.spec && typeof kit.spec === "object") return kit.spec as HandInteriorSpec;
  return HAND_INTERIOR_SPECS[kit?.builtin ?? tileset.id];
}

export interface HandInteriorZone { readonly x0: number; readonly y0: number; readonly x1: number; readonly y1: number; readonly floor?: string; readonly wall?: string }
export interface HandInteriorObject { readonly id: string; readonly x: number; readonly y: number }
export interface HandInteriorTable { readonly style: string; readonly x: number; readonly y: number; readonly w: number; readonly h: number }
export interface HandInteriorLine { readonly id: string; readonly cells?: readonly { readonly x: number; readonly y: number }[]; readonly rect?: { readonly x0: number; readonly y0: number; readonly x1: number; readonly y1: number } }
/** 밟는 단(2층). id = "dais marble|wood|stone" 또는 서쪽 계단 단 "dais-w marble|stone". */
export interface HandInteriorDais { readonly id: string; readonly x: number; readonly y: number; readonly w: number; readonly h: number }
export interface HandInteriorGoods { readonly id: string; readonly x: number; readonly y: number }
export interface HandInteriorInput {
  readonly plan: readonly string[];
  readonly floor: string;
  readonly wall: string;
  /** 도구의 남쪽 출구 폭 계약(기본 1). 원본 예제 렌더러의 평면은 자동 수정하지 않는다. */
  readonly exitWidth?: number;
  readonly zones?: readonly HandInteriorZone[];
  readonly ceiling?: string;
  readonly objects?: readonly HandInteriorObject[];
  readonly tables?: readonly HandInteriorTable[];
  readonly lines?: readonly HandInteriorLine[];
  readonly daises?: readonly HandInteriorDais[];
  readonly goods?: readonly HandInteriorGoods[];
  /** 출입구 칸. 생략하면 맨 아래 줄의 실내 칸. */
  readonly start?: readonly { readonly x: number; readonly y: number }[];
}
export interface HandInteriorIssue { readonly severity: "error" | "warning"; readonly code: string; readonly message: string; readonly x?: number; readonly y?: number }
export interface HandInteriorLayers {
  readonly width: number; readonly height: number;
  readonly lowerTiles: number[]; readonly lowerOverlayTiles: number[]; readonly upperTiles: number[]; readonly upperOverlayTiles: number[];
  readonly issues: HandInteriorIssue[];
  readonly reachable: number; readonly floorCells: number; readonly unreachedFloor: { x: number; y: number }[];
  readonly start: { x: number; y: number }[];
}

/** 평면 분석 — room2.analyse 와 같다. */
export function analyseHandInteriorPlan(plan: readonly string[]) {
  const H = plan.length, W = Math.max(0, ...plan.map((r) => r.length));
  const g: boolean[][] = Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => (plan[y]![x] ?? "#") !== "#"));
  const inn = (x: number, y: number) => x >= 0 && x < W && y >= 0 && y < H && g[y]![x]!;
  const face: number[][] = Array.from({ length: H }, () => new Array<number>(W).fill(0));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!g[y]![x]) continue;
    if (!inn(x, y - 1)) face[y]![x] = 1;
    else if (face[y - 1]![x] === 1) face[y]![x] = 2;
  }
  const top: boolean[][] = Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => {
    if (g[y]![x]) return false;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (inn(x + dx, y + dy)) return true;
    return false;
  }));
  const isFloor = (x: number, y: number) => inn(x, y) && face[y]![x] === 0;
  return { W, H, g, face, top, inn, isFloor };
}

/**
 * 바닥 칸 (x,y) 가 쓸 무늬 열. lay "rowShift" 면 줄마다 무늬를 가로로 민다 — 한 판을 바둑판처럼 반복하면
 * 넓은 빈 바닥에서 같은 무늬가 같은 자리에 줄 서 보인다(2026-10-07 일본 마루). 가로로만 이어지는 무늬(널 마루)여야 한다.
 * 미는 칸 수 = murmur3 fmix32(y+1) % cols. 처음 쓴 (y+1)*40503 % 65521 은 거의 등차수열이라 반복이 사선 격자로 옮겨 갔을 뿐이었다(관문 11회차).
 * jp-city interior/ikit.py lay_x 와 같은 식(test/roomKit.test.ts 가 값을 고정한다).
 */
export function floorLayX(fd: { readonly cols: number; readonly lay?: string }, x: number, y: number): number {
  if (fd.lay !== "rowShift") return x;
  let h = (y + 1) >>> 0;
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b) >>> 0; h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35) >>> 0; h ^= h >>> 16;
  return x + (h >>> 0) % fd.cols;
}

/** 1층(구조) — build_tileset.py structure() 와 같다. */
export function handInteriorStructure(input: Pick<HandInteriorInput, "plan" | "floor" | "wall" | "zones" | "ceiling">, issues: HandInteriorIssue[] = [], S: HandInteriorSpec = HAND_INTERIOR_SPEC): { W: number; H: number; lower: number[] } {
  const { W, H, g, face, top, inn } = analyseHandInteriorPlan(input.plan);
  const ceiling = input.ceiling ?? "default";
  const ceil = S.ceilings[ceiling];
  if (!ceil) throw new HandInteriorError(`천장 "${ceiling}" 이 없다 — ${Object.keys(S.ceilings).join(", ")}`, "unknown-ceiling");
  const need = (kind: "floor" | "wall", id: string) => {
    const table = kind === "floor" ? S.floors : S.walls;
    if (!table[id]) throw new HandInteriorError(`${kind === "floor" ? "바닥" : "벽면"} "${id}" 이 없다 — ${Object.keys(table).join(", ")}`, `unknown-${kind}`);
  };
  need("floor", input.floor); need("wall", input.wall);
  for (const z of input.zones ?? []) { if (z.floor) need("floor", z.floor); if (z.wall) need("wall", z.wall); }
  const mat = (x: number, y: number) => {
    let f = input.floor, w = input.wall;
    for (const z of input.zones ?? []) if (z.x0 <= x && x <= z.x1 && z.y0 <= y && y <= z.y1) { f = z.floor || f; w = z.wall || w; }
    return { f, w };
  };
  const lower: number[] = [];
  for (let cy = 0; cy < H; cy++) for (let cx = 0; cx < W; cx++) {
    const { f, w } = mat(cx, cy);
    const west = inn(cx - 1, cy) ? 0 : 1;
    if (g[cy]![cx] && face[cy]![cx]) { const wd = S.walls[w]!; lower.push(wd.tiles[(((face[cy]![cx]! - 1) * wd.cols + (cx % wd.cols)) * 2) + west]!); }
    else if (g[cy]![cx]) {
      const sh = (cy > 0 && face[cy - 1]![cx] ? 1 : 0) | (west ? 2 : 0);
      const fd = S.floors[f]!;
      lower.push(fd.tiles[((cy % fd.rows) * fd.cols + (floorLayX(fd, cx, cy) % fd.cols)) * 4 + sh]!);
    } else if (top[cy]![cx]) {
      const nv = cy === 0 ? 1 : (inn(cx, cy - 1) || top[cy - 1]![cx] ? 0 : 1);
      const b = (inn(cx, cy + 1) ? 1 : 0) | (inn(cx, cy - 1) ? 2 : 0) | (inn(cx - 1, cy) ? 4 : 0) | (inn(cx + 1, cy) ? 8 : 0) | (16 * nv);
      lower.push(ceil[b]!);
    } else lower.push(S.void);
  }
  void issues;
  return { W, H, lower };
}

export class HandInteriorError extends Error {
  constructor(message: string, readonly code: string) { super(message); this.name = "HandInteriorError"; }
}

const DIRS = [["N", 0, -1], ["E", 1, 0], ["S", 0, 1], ["W", -1, 0]] as const;
/** 줄 자동 타일 조각 키 — kit5.mask_at 과 같다(4방 이웃 + 안쪽 모서리 Ne Es Sw Wn). */
export function linePieceKey(cells: ReadonlySet<string>, x: number, y: number): string {
  const has = (a: number, b: number) => cells.has(`${a},${b}`);
  const m = DIRS.filter(([, dx, dy]) => has(x + dx, y + dy)).map(([d]) => d).join("");
  let ic = "";
  for (const [a, b, dx, dy] of [["N", "E", 1, -1], ["E", "S", 1, 1], ["S", "W", -1, 1], ["W", "N", -1, -1]] as const) {
    if (m.includes(a) && m.includes(b) && !has(x + dx, y + dy)) ic += a + b.toLowerCase();
  }
  return (m || "0") + (ic ? "+" + ic : "");
}

const SEATS = ["chair", "stool", "bar stool", "armchair", "sofa", "bench", "pew", "theater seat", "choir stall"];
/** room4.is_seat — 앉는 가구는 옆 가구의 「사용 칸」 노릇을 한다. */
export function isSeatId(id: string, d?: Pick<SpecObject, "use">): boolean { return SEATS.some((s) => id.startsWith(s)) || !!d?.use?.includes("sit"); }

interface Entry { key: number; order: number; tile: number; layer: 2 | 3; label: string }

/**
 * 평면 + 물건 목록 → 네 층. 오류(겹침·벽면 밖 걸이·바닥 밖 가구)는 issues 에 error 로, 통행 BFS 결과는 warning 으로 남긴다.
 * tileset 이 있으면 통행을 그 정의로 계산한다(없으면 BFS 생략).
 */
export function buildHandInteriorLayers(input: HandInteriorInput, tileset?: TilesetDef, S: HandInteriorSpec = HAND_INTERIOR_SPEC): HandInteriorLayers {
  const issues: HandInteriorIssue[] = [];
  if (!Array.isArray(input.plan) || input.plan.length < 3) throw new HandInteriorError("plan 은 3줄 이상의 문자열 배열이어야 한다.", "invalid-plan");
  const { W, H, lower } = handInteriorStructure(input, issues, S);
  const A = analyseHandInteriorPlan(input.plan);
  if (W < 3 || W > 120 || H > 120) throw new HandInteriorError(`맵 크기 ${W}×${H} — 3~120 칸`, "invalid-plan");
  const per = new Map<number, Entry[]>();
  const goodsAt = new Map<number, { tile: number; label: string }>();
  const surfaceCells = new Set<number>();
  const footprint = new Map<number, string>();
  const seats = new Set<number>();
  let order = 0;
  const inBounds = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;
  const push = (x: number, y: number, e: Omit<Entry, "order">) => {
    if (!inBounds(x, y)) { issues.push({ severity: "error", code: "out-of-bounds", message: `${e.label} 조각 (${x},${y}) 이 맵 밖`, x, y }); return; }
    const i = y * W + x;
    (per.get(i) ?? per.set(i, []).get(i)!).push({ ...e, order: order++ });
  };
  const claim = (x: number, y: number, label: string) => {
    if (!inBounds(x, y)) return;
    const i = y * W + x, had = footprint.get(i);
    if (had) issues.push({ severity: "error", code: "overlap", message: `${label} (${x},${y}) 가 ${had} 와 겹친다`, x, y });
    footprint.set(i, label);
  };
  const drawKey = (kind: SpecObject["kind"], y: number, h: number) => (kind === "hang" ? y * 16 : kind === "flat" ? -1 : kind === "door" ? (y + 3) * 16 : kind === "sidedoor" ? (y + 1) * 16 : (y + h) * 16);

  // "dining 1x3" / "dais 5x2 wood" 처럼 크기를 이름에 넣은 id 는 탁자·단 자동 타일로 푼다(예제 정답 배열의 표기).
  const tables: HandInteriorTable[] = [...(input.tables ?? [])];
  const daises: HandInteriorDais[] = [...(input.daises ?? [])];
  const objects: HandInteriorObject[] = [];
  for (const o of input.objects ?? []) {
    const t = /^([a-z]+) (\d+)x(\d+)$/u.exec(o.id);
    const da = /^(dais(?:-w)?) (\d+)x(\d+) ([a-z]+)$/u.exec(o.id);
    if (!S.objects[o.id] && t && S.tables[t[1]!]) tables.push({ style: t[1]!, x: o.x, y: o.y, w: Number(t[2]), h: Number(t[3]) });
    else if (!S.objects[o.id] && da && S.daises[`${da[1]} ${da[4]}`]) daises.push({ id: `${da[1]} ${da[4]}`, x: o.x, y: o.y, w: Number(da[2]), h: Number(da[3]) });
    else objects.push(o);
  }
  for (const o of objects) {
    const d = S.objects[o.id];
    if (!d) { issues.push({ severity: "error", code: "unknown-object", message: `물건 "${o.id}" 이 없다 — list_hand_interior_parts 로 id 를 찾는다`, x: o.x, y: o.y }); continue; }
    const label = `${d.ko}(${o.id}) @(${o.x},${o.y})`;
    // footprint rules (room4.check): floor/wall stand on floor; wall pieces need the north face; hangings on the upper face row
    if (d.kind === "floor" || d.kind === "wall") {
      for (let dy = 0; dy < d.h; dy++) for (let dx = 0; dx < d.w; dx++) {
        const x = o.x + dx, y = o.y + dy;
        if (!A.isFloor(x, y) && d.stairs !== "up") issues.push({ severity: "error", code: "not-on-floor", message: `${label} 발밑 (${x},${y}) 이 바닥이 아니다`, x, y });
        claim(x, y, label);
        if (isSeatId(o.id, d) && inBounds(x, y)) seats.add(y * W + x);
      }
      if (d.kind === "wall") for (let dx = 0; dx < d.w; dx++) {
        const x = o.x + dx;
        if (!(o.y > 0 && A.face[o.y - 1]?.[x] === 2) && !issues.some((i) => i.message.startsWith(label))) issues.push(d.stairs === "up"
          ? { severity: "error", code: "stairs-not-at-wall", message: `${label} 위로 가는 계단은 북쪽 벽 앞 첫 바닥 줄에 세운다(벽면 두 줄을 덮고 벽 속으로 오른다) — 방 가운데·옆벽 금지`, x, y: o.y }
          : { severity: "error", code: "wall-piece-needs-face", message: `${label} 뒤(북쪽)에 벽면이 없다 — 벽 가구는 북쪽 벽면 바로 아래 첫 바닥 줄에`, x, y: o.y });
      }
    } else if (d.kind === "hang") {
      const cols = Array.from({ length: Math.max(1, d.w) }, (_, dx) => o.x + dx);
      const ok = o.id === "round arch" ? cols.some((x) => A.face[o.y]?.[x] === 1) : cols.every((x) => A.face[o.y]?.[x] === 1);
      if (!ok) issues.push({ severity: "error", code: "hang-not-on-face", message: `${label} 는 걸이 — 벽면 두 줄 중 윗줄(막힌 칸 바로 아래 줄)에 건다`, x: o.x, y: o.y });
    } else if (d.kind === "door") {
      // 가로 칸막이(막힌 줄)의 1칸 틈: 좌우가 막혔고, 위(북쪽 방)와 아래 두 줄이 걸을 수 있는 바닥이며, 아래 두 줄 좌우는 벽면·막힘.
      const solid = (x: number, y: number) => !A.inn(x, y);
      const sideOk = (y: number) => !A.isFloor(o.x - 1, y) && !A.isFloor(o.x + 1, y);
      const ok = A.isFloor(o.x, o.y) && solid(o.x - 1, o.y) && solid(o.x + 1, o.y) && A.inn(o.x, o.y - 1)
        && A.isFloor(o.x, o.y + 1) && A.isFloor(o.x, o.y + 2) && sideOk(o.y + 1) && sideOk(o.y + 2);
      if (!ok) issues.push({ severity: "error", code: "door-not-in-gap", message: `${label} 문은 가로 칸막이('#' 줄)의 1칸 틈 칸에 단다 — 좌우가 '#', 틈 위가 북쪽 방, 틈 아래 두 줄(벽면 높이)이 바닥이어야 한다. 세로 칸막이 3줄 틈에는 옆문(sidedoor 종류)을 통로 칸에 단다`, x: o.x, y: o.y });
    } else if (d.kind === "sidedoor") {
      // 세로 칸막이('#' 열)의 3줄 틈 통로 칸: 좌우가 실내, 위 두 칸이 칸막이 끝 벽면(윗줄·아랫줄), 그 위가 막힌 칸.
      const ok = A.isFloor(o.x, o.y) && A.inn(o.x - 1, o.y) && A.inn(o.x + 1, o.y)
        && A.face[o.y - 1]?.[o.x] === 2 && A.face[o.y - 2]?.[o.x] === 1 && !A.inn(o.x, o.y - 3);
      if (!ok) issues.push({ severity: "error", code: "sidedoor-not-in-gap", message: `${label} 옆문은 세로 칸막이('#' 열)의 3줄 틈 중 통로 칸(셋째 줄)에 단다 — 좌우가 실내, 바로 위 두 칸이 칸막이 끝 벽면이어야 한다`, x: o.x, y: o.y });
    } else if (d.stairs === "down") {
      for (let dy = 0; dy < Math.max(1, d.h); dy++) for (let dx = 0; dx < d.w; dx++) claim(o.x + dx, o.y + dy, label);
    }
    const key = drawKey(d.kind, o.y, d.h);
    for (const [dx, dy, tile, layer] of d.cells) {
      push(o.x + dx, o.y + dy, { key, tile, layer: layer as 2 | 3, label });
      if (d.surface && dy >= 0 && dy < Math.max(1, d.h) && inBounds(o.x + dx, o.y + dy)) surfaceCells.add((o.y + dy) * W + o.x + dx);
    }
  }
  for (const t of tables) {
    const d = S.tables[t.style];
    if (!d) { issues.push({ severity: "error", code: "unknown-table", message: `탁자 스타일 "${t.style}" 이 없다 — ${Object.keys(S.tables).join(", ")}`, x: t.x, y: t.y }); continue; }
    if (!(t.w >= 1 && t.h >= 1)) { issues.push({ severity: "error", code: "invalid-table", message: `탁자 크기 ${t.w}×${t.h}`, x: t.x, y: t.y }); continue; }
    if (d.oneRow && t.h !== 1) issues.push({ severity: "error", code: "table-one-row", message: `${d.ko} 는 한 줄(h=1)만 된다`, x: t.x, y: t.y });
    const label = `${d.ko} ${t.w}×${t.h} @(${t.x},${t.y})`;
    const key = (t.y + t.h) * 16;
    for (let j = 0; j < t.h; j++) for (let i = 0; i < t.w; i++) {
      const rc = t.h === 1 ? "S" : j === 0 ? "T" : j === t.h - 1 ? "B" : "M";
      const cc = t.w === 1 ? "S" : i === 0 ? "L" : i === t.w - 1 ? "R" : "M";
      const cells = d.pieces[cc + rc];
      if (!cells) { issues.push({ severity: "error", code: "table-piece", message: `${label} 조각 ${cc}${rc} 없음` }); continue; }
      const x = t.x + i, y = t.y + j;
      if (!A.isFloor(x, y)) issues.push({ severity: "error", code: "not-on-floor", message: `${label} 발밑 (${x},${y}) 이 바닥이 아니다`, x, y });
      claim(x, y, label);
      if (inBounds(x, y)) surfaceCells.add(y * W + x);
      for (const [dx, dy, tile, layer] of cells) push(x + dx, y + dy, { key, tile, layer: layer as 2 | 3, label });
    }
  }
  for (const l of input.lines ?? []) {
    const d = S.lines[l.id];
    if (!d) { issues.push({ severity: "error", code: "unknown-line", message: `줄 자동 타일 "${l.id}" 이 없다 — ${Object.keys(S.lines).join(", ")}` }); continue; }
    const list: { x: number; y: number }[] = [...(l.cells ?? [])];
    if (l.rect) for (let y = Math.min(l.rect.y0, l.rect.y1); y <= Math.max(l.rect.y0, l.rect.y1); y++) for (let x = Math.min(l.rect.x0, l.rect.x1); x <= Math.max(l.rect.x0, l.rect.x1); x++) list.push({ x, y });
    const set = new Set(list.map((c) => `${c.x},${c.y}`));
    const label = `${d.ko}(${l.id})`;
    for (const c of list) {
      const piece = d.pieces[linePieceKey(set, c.x, c.y)];
      if (!piece) continue;
      if (!A.isFloor(c.x, c.y)) issues.push({ severity: "error", code: "not-on-floor", message: `${label} 칸 (${c.x},${c.y}) 이 바닥이 아니다${d.kind === "flat" ? " — 밟는 무늬가 벽·천장 위에 오면 엔진이 그 벽을 걸을 수 있게 만든다" : ""}`, x: c.x, y: c.y });
      if (d.kind !== "flat") claim(c.x, c.y, label);
      const key = d.kind === "flat" ? -1 : (c.y + 1) * 16;
      for (const [dx, dy, tile, layer] of piece) push(c.x + dx, c.y + dy, { key, tile, layer: layer as 2 | 3, label });
    }
  }
  for (const da of daises) {
    const d = S.daises[da.id];
    if (!d) { issues.push({ severity: "error", code: "unknown-dais", message: `단 "${da.id}" 이 없다 — ${Object.keys(S.daises).join(", ")}`, x: da.x, y: da.y }); continue; }
    for (let j = 0; j < da.h; j++) for (let i = 0; i < da.w; i++) {
      const rc = da.h === 1 ? "S" : j === 0 ? "T" : j === da.h - 1 ? "B" : "M";
      const cc = da.w === 1 ? "S" : i === 0 ? "L" : i === da.w - 1 ? "R" : "M";
      const tile = d.pieces[`${cc}${rc}${(i + j) % 2}`];
      if (tile !== undefined) push(da.x + i, da.y + j, { key: -1, tile, layer: 2, label: `${d.ko} @(${da.x},${da.y})` });
    }
  }
  for (const gd of input.goods ?? []) {
    const tile = S.goods[gd.id.replace(/^goods:/, "")];
    if (tile === undefined) { issues.push({ severity: "error", code: "unknown-goods", message: `탁상 물건 "${gd.id}" 이 없다`, x: gd.x, y: gd.y }); continue; }
    if (!inBounds(gd.x, gd.y)) { issues.push({ severity: "error", code: "out-of-bounds", message: `탁상 물건 ${gd.id} (${gd.x},${gd.y}) 맵 밖` }); continue; }
    const i = gd.y * W + gd.x;
    if (!surfaceCells.has(i)) issues.push({ severity: "error", code: "goods-needs-surface", message: `탁상 물건 ${gd.id} (${gd.x},${gd.y}) — 윗면이 있는 가구(탁자·카운터·책상·협탁 등) 칸 위에만 둔다`, x: gd.x, y: gd.y });
    if (goodsAt.has(i)) issues.push({ severity: "warning", code: "goods-stacked", message: `(${gd.x},${gd.y}) 에 탁상 물건이 둘 — 나중 것만 남는다`, x: gd.x, y: gd.y });
    goodsAt.set(i, { tile, label: gd.id });
  }

  const L2 = new Array<number>(W * H).fill(-1), L3 = new Array<number>(W * H).fill(-1), L4 = new Array<number>(W * H).fill(-1);
  for (const [i, es] of per) {
    es.sort((a, b) => a.key - b.key || a.order - b.order);
    const flats = es.filter((e) => e.layer === 2), rest = es.filter((e) => e.layer === 3);
    if (flats.length) {
      L2[i] = flats[flats.length - 1]!.tile;
      if (flats.length > 1) issues.push({ severity: "warning", code: "flat-stacked", message: `(${i % W},${Math.floor(i / W)}) 바닥 무늬 ${flats.map((e) => e.label).join(" · ")} — 맨 나중 것만 남는다`, x: i % W, y: Math.floor(i / W) });
    }
    const keep = rest.slice(-2);
    if (rest.length > 2) issues.push({ severity: "warning", code: "too-many-layers", message: `(${i % W},${Math.floor(i / W)}) 에 조각 ${rest.length}개 — 앞(남쪽) 두 개만 남는다: ${rest.slice(0, -2).map((e) => e.label).join(" · ")} 버림`, x: i % W, y: Math.floor(i / W) });
    if (keep[0]) L3[i] = keep[0].tile;
    if (keep[1]) L4[i] = keep[1].tile;
  }
  for (const [i, g] of goodsAt) {
    if (L4[i]! >= 0) issues.push({ severity: "error", code: "goods-no-layer", message: `탁상 물건 ${g.label} (${i % W},${Math.floor(i / W)}) — 4층이 이미 다른 조각으로 찼다`, x: i % W, y: Math.floor(i / W) });
    else L4[i] = g.tile;
  }

  // start cells + BFS on the resulting passage
  const start = (input.start?.length ? input.start.map((s) => ({ x: s.x, y: s.y })) : Array.from({ length: W }, (_, x) => ({ x, y: H - 1 })).filter((c) => A.isFloor(c.x, c.y)));
  let reachable = 0;
  const unreachedFloor: { x: number; y: number }[] = [];
  let floorCells = 0;
  if (tileset) {
    const walk = (i: number) => { const p = passabilityOf(tileset, lower[i]!, L2[i]!, L3[i]!, L4[i]!); return p.up || p.down || p.left || p.right; };
    const seen = new Set<number>();
    const q: number[] = [];
    for (const s of start) {
      if (!inBounds(s.x, s.y)) continue;
      const i = s.y * W + s.x;
      if (walk(i) && !seen.has(i)) { seen.add(i); q.push(i); }
    }
    if (!q.length) issues.push({ severity: "error", code: "no-entrance", message: start.length ? `출입구 ${start.map((s) => `(${s.x},${s.y})`).join(" ")} 가 막혔다` : "맨 아래 줄에 실내 칸(출입구)이 없다 — plan 마지막 줄에 '.' 틈을 두거나 start 를 준다" });
    while (q.length) {
      const i = q.pop()!, x = i % W, y = (i - x) / W;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const X = x + dx, Y = y + dy;
        if (!inBounds(X, Y)) continue;
        const j = Y * W + X;
        if (!seen.has(j) && walk(j)) { seen.add(j); q.push(j); }
      }
    }
    reachable = seen.size;
    for (let i = 0; i < W * H; i++) {
      const x = i % W, y = (i - x) / W;
      if (!A.isFloor(x, y)) continue;
      floorCells++;
      if (walk(i) && !seen.has(i)) unreachedFloor.push({ x, y });
    }
    if (unreachedFloor.length) issues.push({ severity: "warning", code: "unreached-floor", message: `출입구에서 닿지 못하는 빈 바닥 ${unreachedFloor.length}칸: ${unreachedFloor.slice(0, 10).map((c) => `(${c.x},${c.y})`).join(" ")} — 가구가 길을 막았거나 방이 닫혔다` });
    // every standing piece needs a reachable side — or a seat beside it that is itself reachable (room4.check seat_ok)
    const byLabel = new Map<string, number[]>();
    for (const [i, label] of footprint) (byLabel.get(label) ?? byLabel.set(label, []).get(label)!).push(i);
    const near = (i: number, ok: (j: number) => boolean) => {
      const x = i % W, y = (i - x) / W;
      return ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const).some(([dx, dy]) => { const X = x + dx, Y = y + dy; return inBounds(X, Y) && ok(Y * W + X); });
    };
    const seatOk = new Set([...seats].filter((i) => near(i, (j) => seen.has(j))));
    for (const [label, cells] of byLabel) {
      const own = new Set(cells);
      const ok = cells.some((i) => near(i, (j) => !own.has(j) && (seen.has(j) || seatOk.has(j))));
      if (!ok) issues.push({ severity: "warning", code: "unreachable-piece", message: `${label} 옆에 닿는 칸이 없다 — 쓸 수 없는 가구` });
    }
  }
  return { width: W, height: H, lowerTiles: lower, lowerOverlayTiles: L2, upperTiles: L3, upperOverlayTiles: L4, issues, reachable, floorCells, unreachedFloor, start };
}
