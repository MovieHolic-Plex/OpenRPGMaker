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
import sengokuSpec from "@/assets/sengokuEdoRoomSpec.json";
import campusSpec from "@/assets/modernCampusRoomSpec.json";
import gothicSpec from "@/assets/gothicManorRoomSpec.json";
import modernCitySpec from "@/assets/modernCityRoomSpec.json";
import { passabilityOf } from "@/project/collision";
import { stairArrivalFacing, stairContractForKit, stairContractForSpecObject, type StairContract } from "@/project/stairs/contract";
import type { TilesetDef } from "@/project/types";

export const HAND_INTERIOR_TILESET_ID = "atlas_biome_interior";

/** 상판이 dy -1 줄에 그려지고 dy 0 은 받침대·다리인 가구(생성 사양 JSON 을 다시 굽지 않고 여기서 준다 — 사양의 surfaceRow 가 있으면 그것이 먼저). */
const PEDESTAL_SURFACE_ROW: Readonly<Record<string, number>> = { "mci-cafe-table": -1, "mci-bedside": -1, "mci-med-cart": -1 };
/** 가구의 상판 줄 dy(없으면 undefined = 0..h-1 줄 전부). */
/**
 * 탁상 물건이 앉는 윗면 줄 dy. surfaceRow·받침대 표가 먼저, 없으면 윗면 그림 상자(surface = [x, y, w, h] px, 그림 맨 위 기준)의 가운데가
 * 발밑 줄 위로 솟은 줄(dy < 0)에 있으면 그 줄 — 카운터(up 8, 윗면 y 2~7)는 윗면이 dy -1 줄에 그려지고 dy 0 은 서랍 앞면이다.
 * 2026-10-29 방 견본 4판: 계산대 위 돈통·저울·종이 서랍 앞면에 그려져 「서랍장으로 읽힘」(잡화점·빵집·옷가게 major).
 */
export function surfaceRowOf(id: string, d: { readonly surfaceRow?: number; readonly surface?: readonly number[]; readonly up?: number }): number | undefined {
  const fixed = d.surfaceRow ?? PEDESTAL_SURFACE_ROW[id.split(":")[0]!];
  if (fixed !== undefined) return fixed;
  if (d.surface && d.surface.length >= 4 && d.up) {
    const row = Math.floor((d.surface[1]! + d.surface[3]! / 2 - d.up) / 16);
    if (row < 0) return row;
  }
  return undefined;
}

type SpecCell = readonly [number, number, number, number];
interface SpecObject {
  readonly ko: string; readonly category: string; readonly category_ko: string; readonly kind: "floor" | "wall" | "hang" | "flat" | "door" | "sidedoor";
  readonly w: number; readonly h: number; readonly up: number; readonly cells: readonly SpecCell[];
  readonly surface?: readonly number[]; readonly animated?: boolean; readonly stairs?: "up" | "down";
  /** 윗면(상판)이 그려진 줄 dy. 없으면 0..h-1 줄. 원탁·협탁처럼 dy 0 이 받침대인 가구는 -1 — 탁상 물건이 받침대 칸에 오면 상판 칸으로 올린다
   *  (2026-10-28 interior 장부 111: 카페 원탁 받침대 칸에 컵이 그려져 바닥에 놓인 듯 보였다). */
  readonly surfaceRow?: number;
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
  /**
   * 천장 띠 안쪽 모서리 조각(선택): 천장 id → "<기본 비트>:<모서리 비트>" → 칸. 모서리 비트 1 남서 · 2 남동 · 4 북서 · 8 북동 —
   * 그 대각선 이웃이 바닥이고 대각선을 낀 두 이웃이 막힌 모서리. 칸막이가 벽 띠와 T·ㄱ 자로 만나는 칸에서 몰딩이 끊기지 않게 잇는다.
   */
  readonly ceilingCorners?: Readonly<Record<string, Readonly<Record<string, number>>>>;
  readonly objects: Readonly<Record<string, SpecObject>>;
  readonly tables: Readonly<Record<string, SpecTable>>;
  readonly lines: Readonly<Record<string, SpecLine>>;
  readonly daises: Readonly<Record<string, { readonly ko: string; readonly pieces: Readonly<Record<string, number>> }>>;
  readonly goods: Readonly<Record<string, number>>;
  readonly rooms?: HandInteriorRoomTable;
  /**
   * 심연(구덩이) 자동 타일(선택, interior-plus 굽기): masks[i] 이웃 8비트(N1 NE2 E4 SE8 S16 SW32 W64 NW128, 같은 구덩이면 1,
   * 대각선은 낀 두 직교 이웃이 모두 1일 때만) → tiles[i]. 47가지 정규 마스크.
   */
  readonly pits?: Readonly<Record<string, { readonly ko: string; readonly masks: readonly number[]; readonly tiles: readonly number[] }>>;
}
export const HAND_INTERIOR_SPEC = spec as unknown as HandInteriorSpec;
/** 일본 실내(jp_city 번들 안) — 같은 모양의 사양을 scripts/content/jp-city/bake_interior_spec.py 가 굽는다. 조립 규칙은 같다. */
export const JP_INTERIOR_TILESET_ID = "jp_city";
export const JP_INTERIOR_SPEC = jpSpec as unknown as HandInteriorSpec;
/** 마법 학교(wizarding_world) — 바닥·벽면·천장 변형 칸만 scripts/content/wizarding/roomkit_wz.py 가 굽는다. 가구는 칩셋 조립 부품에서(kitHandObjects). */
export const WIZARDING_INTERIOR_TILESET_ID = "wizarding_world";
export const WIZARDING_INTERIOR_SPEC = wizardingSpec as unknown as HandInteriorSpec;
/** 전국·에도 일본(sengoku_edo) — 다다미 방·다실·여관 방·알현실·가게·농가·도장 사양을 scripts/content/sengoku-edo/bake_se.py 가 굽는다(art/interior.py). 조립 규칙은 같다. */
export const SENGOKU_INTERIOR_TILESET_ID = "sengoku_edo";
export const SENGOKU_INTERIOR_SPEC = sengokuSpec as unknown as HandInteriorSpec;
/** 현대 학교·캠퍼스(modern_campus) — 교실·복도·도서관·보건실·급식실·기숙사 사양을 scripts/content/modern-campus/bake_mc.py 가 굽는다(새 가구 + 재사용 jp_city 학교 기물). 조립 규칙은 같다. */
export const CAMPUS_INTERIOR_TILESET_ID = "modern_campus";
export const CAMPUS_INTERIOR_SPEC = campusSpec as unknown as HandInteriorSpec;
/** 고딕 저택(gothic_manor) — 바닥·벽면·천장 변형 칸만 scripts/content/gothic-manor/roomkit_gm.py 가 굽는다. 가구는 칩셋 조립 부품에서. */
export const GOTHIC_INTERIOR_TILESET_ID = "gothic_manor";
export const GOTHIC_INTERIOR_SPEC = gothicSpec as unknown as HandInteriorSpec;
/** 도쿄풍 현대 도시(modern_city) — 사무실·편의점·아파트·병동·로비·카페·은행·대합실·창고 사양을 scripts/content/modern-city-int/bake_interior.py 가 굽는다. 조립 규칙은 같다. */
export const MODERN_CITY_INTERIOR_TILESET_ID = "modern_city";
export const MODERN_CITY_INTERIOR_SPEC = modernCitySpec as unknown as HandInteriorSpec;
/** 실내를 지을 수 있는 칩셋 → 사양. */
export const HAND_INTERIOR_SPECS: Readonly<Record<string, HandInteriorSpec>> = {
  [HAND_INTERIOR_TILESET_ID]: HAND_INTERIOR_SPEC, [JP_INTERIOR_TILESET_ID]: JP_INTERIOR_SPEC, [WIZARDING_INTERIOR_TILESET_ID]: WIZARDING_INTERIOR_SPEC,
  [SENGOKU_INTERIOR_TILESET_ID]: SENGOKU_INTERIOR_SPEC, [CAMPUS_INTERIOR_TILESET_ID]: CAMPUS_INTERIOR_SPEC,
  [GOTHIC_INTERIOR_TILESET_ID]: GOTHIC_INTERIOR_SPEC, [MODERN_CITY_INTERIOR_TILESET_ID]: MODERN_CITY_INTERIOR_SPEC,
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
  /** 벽면에 박은 엘리베이터 문·계단 앞 탈 자리(첫 바닥 줄, 조각 폭만큼) — 층 이동 출입구(create_transfer_pair)는 이 칸에 둔다. */
  readonly travel: HandInteriorTravelSpot[];
}
/**
 * 층 이동 탈 자리. 계단 입구 계약(project/stairs/contract.ts)이 있는 계단은 trigger(이동 이벤트를 다는 계단 그림 칸)·facing(도착 방향,
 * 계단을 등짐)·leads·mode 를 함께 준다. x,y 는 들어서는 앞 칸(도착 칸)이다.
 */
export interface HandInteriorTravelSpot {
  readonly label: string; readonly x: number; readonly y: number;
  readonly trigger?: { readonly x: number; readonly y: number };
  readonly facing?: "up" | "down" | "left" | "right";
  readonly leads?: StairContract["leads"];
  readonly mode?: StairContract["mode"];
}
const SPEC_TILESET = new Map<HandInteriorSpec, string>();
/** 사양 → 칩셋 id(계단 계약 표의 열쇠). 업로드 칩셋의 사양은 없다. */
function specTilesetId(S: HandInteriorSpec): string | undefined {
  if (!SPEC_TILESET.size) for (const [id, spec] of Object.entries(HAND_INTERIOR_SPECS)) SPEC_TILESET.set(spec, id);
  return SPEC_TILESET.get(S);
}

/** 평면 분석 결과 — face: 0 바닥 · 1 벽면 윗줄 · 2 벽면 아랫줄. */
export interface HandInteriorPlanAnalysis {
  readonly W: number; readonly H: number;
  readonly g: boolean[][]; readonly face: number[][]; readonly top: boolean[][];
  readonly inn: (x: number, y: number) => boolean;
  readonly isFloor: (x: number, y: number) => boolean;
}

/** 평면 분석 — room2.analyse 와 같다. */
export function analyseHandInteriorPlan(plan: readonly string[]): HandInteriorPlanAnalysis {
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
  const corners = S.ceilingCorners?.[ceiling];
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
      const oS = inn(cx, cy + 1), oN = inn(cx, cy - 1), oW = inn(cx - 1, cy), oE = inn(cx + 1, cy);
      const b = (oS ? 1 : 0) | (oN ? 2 : 0) | (oW ? 4 : 0) | (oE ? 8 : 0) | (16 * nv);
      const d = (!oS && !oW && inn(cx - 1, cy + 1) ? 1 : 0) | (!oS && !oE && inn(cx + 1, cy + 1) ? 2 : 0)
        | (!oN && !oW && inn(cx - 1, cy - 1) ? 4 : 0) | (!oN && !oE && inn(cx + 1, cy - 1) ? 8 : 0);
      lower.push((d ? corners?.[`${b}:${d}`] : undefined) ?? ceil[b]!);
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

/**
 * 천장 줄에 거는 걸이(천문대 둥근 지붕 조각, 폴른 스타 #3234). 좌표 y 가 벽면 윗줄이 아니라 그 위 천장 줄(막힌 칸)이다.
 * 일반 걸이 규칙(y = 벽면 윗줄)으로 검사하면 문서대로 놓은 관측 틈이 늘 거부됐다 — 2026-10-22 다듬기 9바퀴 동안 「관측 틈」 확인 항목이 한 번도 못 짓고 끝났다.
 * "face-below": 맨 윗줄이 천장 줄이고 바로 아랫줄부터 벽면(관측 틈·갈빗대·처마). "ceiling": 천장 띠 안에만 놓인다(지붕 면·갈빗대 끝·둥근 지붕 전체).
 */
export function ceilingHang(id: string): "face-below" | "ceiling" | undefined {
  if (id === "dome slit tall" || id === "dome rib" || id === "dome rib west" || id === "dome rib east" || id === "dome cornice") return "face-below";
  if (id === "dome shell" || id === "dome rib top west" || id === "dome rib top east" || id === "dome vault") return "ceiling";
  return undefined;
}

/**
 * 벽면에 박는 탈것(엘리베이터 문·벽 속 계단) 중 그림이 벽면 두 줄 높이뿐인 것. 첫 바닥 줄에 세우면 벽면 아랫줄과 바닥 줄에 반씩 걸쳐
 * 벽면 윗줄이 비고 문이 바닥으로 튀어나왔다(2026-10-17 r4-rom-d 로비: modern_city mci-elevator·mci-stairs-up, up=16).
 * 이런 조각은 벽면 두 줄에 딱 맞춰 그리고, 준 칸(첫 바닥 줄)은 그림 없이 비워 탈 자리로 둔다. up=32 탈것(다른 칩셋)은 벽면 두 줄 + 바닥 줄을 이미 덮는다.
 */
export function isFlushTravelPiece(d: Pick<SpecObject, "kind" | "use" | "up" | "h">): boolean {
  return d.kind === "wall" && !!d.use?.includes("travel") && d.h === 1 && Math.ceil(d.up / 16) + d.h <= 2;
}

interface Entry { key: number; order: number; tile: number; layer: 2 | 3; label: string; /** 단 윗면 — 같은 칸의 다른 바닥 무늬(마법진·단 앞 턱)는 3층으로 올려 단 위에 얹는다 */ base?: true; /** 줄 자동 타일(깔개·난간) — 단 위로 올리지 않는다(예배당 깔개 끝이 서쪽 계단 단에 닿는 예제 그대로) */ line?: true }

/** 탁자 칸으로 치는 가구: 식탁·책상·회의 탁자(id 의 table·desk 또는 태그 식탁·탁자·책상·회의). 파일 캐비닛·협탁 같은 윗면 가구는 빠진다. */
const TABLE_ID = /(^|-)(table|desk)(-|$)/u;
const TABLE_TAG = /^(식탁|탁자|책상|회의)$/u;
function isTablePiece(id: string, d: SpecObject): boolean {
  return d.kind === "floor" && !isSeatId(id, d) && (TABLE_ID.test(id) || !!d.tags?.some((t) => TABLE_TAG.test(t)));
}
/** 남향 좌석 id 의 다른 방향 그림(같은 크기만): mci-chair-office-s -> mci-chair-office-n, mci-armchair -> mci-armchair-e. */
function facingSibling(id: string, dir: "n" | "e" | "w", S: HandInteriorSpec): string | undefined {
  const d = S.objects[id]!;
  const sib = /-s$/u.test(id) ? id.replace(/-s$/u, `-${dir}`) : `${id}-${dir}`;
  const e = S.objects[sib];
  return e && e.w === d.w && e.h === d.h ? sib : undefined;
}
/**
 * 남향(그림 기본) 좌석이 탁자를 등지지 않게 돌린다 - 탁자 남쪽 의자는 북향, 서쪽 의자는 동향, 동쪽 의자는 서향 그림으로 바꾼다
 * (2026-10-18 사용자 「의자가 아래 방향만 구현되어있는거냐. 학생회실 보니까 어이가없네」). 남쪽에 탁자가 있는(이미 탁자를 보는) 좌석, 탁자에 안 붙은 좌석,
 * 방향 그림이 없는 칩셋의 좌석은 그대로 둔다. 견본·조수·청사진 어느 길로 들어온 의자든 여기서 한 번에 맞춘다.
 */
export function faceSeatsToTables(objects: readonly HandInteriorObject[], tables: readonly HandInteriorTable[], S: HandInteriorSpec): HandInteriorObject[] {
  const cells = new Set<string>();
  const mark = (x0: number, y0: number, w: number, h: number) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) cells.add(`${x},${y}`); };
  for (const t of tables) mark(t.x, t.y, t.w, t.h);
  for (const o of objects) { const d = S.objects[o.id]; if (d && isTablePiece(o.id, d)) mark(o.x, o.y, d.w, d.h); }
  if (!cells.size) return [...objects];
  const any = (pts: readonly (readonly [number, number])[]) => pts.some(([x, y]) => cells.has(`${x},${y}`));
  const span = (n: number, f: (k: number) => readonly [number, number]) => Array.from({ length: n }, (_, k) => f(k));
  return objects.map((o) => {
    const d = S.objects[o.id];
    if (!d || !isSeatId(o.id, d) || (d.facing ?? "S") !== "S") return o;
    if (any(span(d.w, (k) => [o.x + k, o.y + d.h]))) return o;
    const dir = any(span(d.w, (k) => [o.x + k, o.y - 1])) ? "n"
      : any(span(d.h, (k) => [o.x + d.w, o.y + k])) ? "e"
      : any(span(d.h, (k) => [o.x - 1, o.y + k])) ? "w" : undefined;
    const sib = dir && facingSibling(o.id, dir, S);
    return sib ? { ...o, id: sib } : o;
  });
}

/**
 * 평면 + 물건 목록 → 네 층. 오류(겹침·벽면 밖 걸이·바닥 밖 가구)는 issues 에 error 로, 통행 BFS 결과는 warning 으로 남긴다.
 * tileset 이 있으면 통행을 그 정의로 계산한다(없으면 BFS 생략).
 */
/** 벽면 걸이인데 앞 칸이 탈 자리인 탈것 문(J45: 전철 차내는 남쪽 바깥 출구 대신 이 문으로 드나든다). */
export const VEHICLE_DOORS: ReadonlySet<string> = new Set(["st-car-door"]);

export function buildHandInteriorLayers(input: HandInteriorInput, tileset?: TilesetDef, S: HandInteriorSpec = HAND_INTERIOR_SPEC): HandInteriorLayers {
  const issues: HandInteriorIssue[] = [];
  if (!Array.isArray(input.plan) || input.plan.length < 3) throw new HandInteriorError("plan 은 3줄 이상의 문자열 배열이어야 한다.", "invalid-plan");
  const { W, H, lower } = handInteriorStructure(input, issues, S);
  const A = analyseHandInteriorPlan(input.plan);
  if (W < 3 || W > 120 || H > 120) throw new HandInteriorError(`맵 크기 ${W}×${H} — 3~120 칸`, "invalid-plan");
  const per = new Map<number, Entry[]>();
  const goodsAt = new Map<number, { tile: number; label: string }>();
  const surfaceCells = new Set<number>();
  /** 받침대 칸 → 그 위 상판 칸(surfaceRow 가구). */
  const liftGoods = new Map<number, number>();
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
  const raw: HandInteriorObject[] = [];
  for (const o of input.objects ?? []) {
    const t = /^([a-z]+) (\d+)x(\d+)$/u.exec(o.id);
    const da = /^(dais(?:-w)?) (\d+)x(\d+) ([a-z]+)$/u.exec(o.id);
    if (!S.objects[o.id] && t && S.tables[t[1]!]) tables.push({ style: t[1]!, x: o.x, y: o.y, w: Number(t[2]), h: Number(t[3]) });
    else if (!S.objects[o.id] && da && S.daises[`${da[1]} ${da[4]}`]) daises.push({ id: `${da[1]} ${da[4]}`, x: o.x, y: o.y, w: Number(da[2]), h: Number(da[3]) });
    else raw.push(o);
  }
  const objects = faceSeatsToTables(raw, tables, S);
  /** 벽면에 딱 맞춰 박은 탈것: 벽면 칸 → 이름표(걸이와 겹치면 안 된다), 탈 자리(그 앞 첫 바닥 줄 칸). */
  const flushFace = new Map<number, string>();
  const landings: { i: number; label: string; trigger?: number; facing?: HandInteriorTravelSpot["facing"]; leads?: StairContract["leads"]; mode?: StairContract["mode"]; stair?: string }[] = [];
  const stairLabels = new Map<string, { approach: string }>();
  const specTs = tileset ? (tileset.roomKit?.builtin ?? tileset.id) : specTilesetId(S);
  for (const o of objects) {
    const d = S.objects[o.id];
    if (!d) { issues.push({ severity: "error", code: "unknown-object", message: `물건 "${o.id}" 이 없다 — list_hand_interior_parts 로 id 를 찾는다`, x: o.x, y: o.y }); continue; }
    const label = `${d.ko}(${o.id}) @(${o.x},${o.y})`;
    const flush = isFlushTravelPiece(d);
    // 계단 입구 계약: 앞 칸(들어서는 쪽)이 바닥이어야 하고, 탈 자리는 그 앞 칸, 이동 칸은 계단 그림 칸이다(추측하지 않는다).
    // 사양 물건 표에 없고 칩셋 조립 부품에서 온 가구(kitHandObjects: 마법 학교 등)는 키트 계약을 그대로 쓴다 — 키트 원점은 맨 위 칸 줄.
    const kitStair = specTs && !stairContractForSpecObject(specTs, o.id) ? stairContractForKit(specTs, o.id) : undefined;
    const stair = specTs ? (stairContractForSpecObject(specTs, o.id) ?? (kitStair ? { contract: kitStair, kit: o.id, lift: -Math.min(0, ...d.cells.map((c) => c[1])) } : undefined)) : undefined;
    if (stair && stair.contract.leads !== "same") {
      const c = stair.contract, ox = o.x, oy = o.y - stair.lift;
      const approach = c.approach.map(([dx, dy]) => ({ x: ox + dx, y: oy + dy }));
      const floor = approach.filter((p) => A.isFloor(p.x, p.y));
      const sideKo = c.side === "S" ? "남쪽" : c.side === "N" ? "북쪽" : c.side === "E" ? "동쪽" : c.side === "W" ? "서쪽" : "옆";
      if (!floor.length) issues.push({ severity: "error", code: "stair-entrance-blocked", message: `${label} 계단 앞 칸(들어서는 쪽 ${sideKo}) ${approach.map((p) => `(${p.x},${p.y})`).join(" ")} 이 바닥이 아니다 — 계단은 앞 칸이 방 바닥으로 열린 자리에 둔다. ${c.note}`, x: o.x, y: o.y });
      for (const p of floor) {
        // 앞 칸과 맞닿은 이동 칸(같은 열·같은 줄, side=any 면 아무 이웃)
        const t = c.trigger.map(([dx, dy]) => ({ x: ox + dx, y: oy + dy })).sort((a, b) => (Math.abs(a.x - p.x) + Math.abs(a.y - p.y)) - (Math.abs(b.x - p.x) + Math.abs(b.y - p.y)))[0];
        landings.push({ i: p.y * W + p.x, label, ...(t && inBounds(t.x, t.y) ? { trigger: t.y * W + t.x } : {}), facing: stairArrivalFacing(c, p, t), leads: c.leads, mode: c.mode, stair: label });
      }
      stairLabels.set(label, { approach: approach.map((p) => `(${p.x},${p.y})`).join(" ") });
    }
    // footprint rules (room4.check): floor/wall stand on floor; wall pieces need the north face; hangings on the upper face row
    if (d.kind === "floor" || d.kind === "wall") {
      for (let dy = 0; dy < d.h; dy++) for (let dx = 0; dx < d.w; dx++) {
        const x = o.x + dx, y = o.y + dy;
        if (!A.isFloor(x, y) && (flush || d.stairs !== "up")) issues.push({ severity: "error", code: "not-on-floor", message: flush ? `${label} 앞 탈 자리 (${x},${y}) 가 바닥이 아니다 — 벽면 바로 아래 첫 바닥 줄 칸을 준다(그림은 그 위 벽면 두 줄에 박힌다)` : `${label} 발밑 (${x},${y}) 이 바닥이 아니다`, x, y });
        claim(x, y, label);
        if (stair && stair.contract.leads !== "same") { /* 계약이 탈 자리를 정했다 */ }
        else if (flush && inBounds(x, y)) landings.push({ i: y * W + x, label });
        else if ((d.use?.includes("travel") || Boolean(d.stairs)) && dy === d.h - 1 && A.isFloor(x, y + 1)) landings.push({ i: (y + 1) * W + x, label });
        else if ((d.use?.includes("travel") || Boolean(d.stairs)) && dy === d.h - 1 && dx === 0 && A.isFloor(x - 1, y)) landings.push({ i: y * W + (x - 1), label });
        else if ((d.use?.includes("travel") || Boolean(d.stairs)) && dy === d.h - 1 && dx === d.w - 1 && A.isFloor(x + 1, y)) landings.push({ i: y * W + (x + 1), label });
        if (isSeatId(o.id, d) && inBounds(x, y)) seats.add(y * W + x);
      }
      if (d.kind === "wall") for (let dx = 0; dx < d.w; dx++) {
        const x = o.x + dx;
        const faced = o.y > 0 && A.face[o.y - 1]?.[x] === 2 && (!flush || A.face[o.y - 2]?.[x] === 1);
        if (!faced && !issues.some((i) => i.message.startsWith(label))) issues.push(d.stairs === "up"
          ? { severity: "error", code: "stairs-not-at-wall", message: `${label} 위로 가는 계단은 북쪽 벽 앞 첫 바닥 줄에 세운다(벽면 두 줄을 덮고 벽 속으로 오른다) — 방 가운데·옆벽 금지`, x, y: o.y }
          : { severity: "error", code: "wall-piece-needs-face", message: `${label} 뒤(북쪽)에 벽면${flush ? " 두 줄" : ""}이 없다 — 벽 가구는 북쪽 벽면 바로 아래 첫 바닥 줄에`, x, y: o.y });
      }
      // 벽 속 계단·에스컬레이터(상행·하행 모두 벽면 위층 입구로 이어진다)는 건물 바깥 북쪽 벽에 — 벽 너머(북쪽)에 다른 방 바닥이 있으면 칸막이에 박혀 옆방으로 오르는 그림이 된다
      // (2026-10-18 적대적 VQA: 백화점 아트리움 에스컬레이터가 VIP 홀과의 칸막이 속으로 올라갔다).
      if (d.kind === "wall" && d.stairs && !issues.some((i) => i.message.startsWith(label))) {
        const partition = Array.from({ length: d.w }, (_, dx) => o.x + dx).some((x) => Array.from({ length: Math.max(0, o.y - 3) }, (_, y) => y).some((y) => A.isFloor(x, y)));
        if (partition) issues.push({ severity: "warning", code: "stairs-into-partition", message: `${label} 이 방 사이 칸막이 속으로 이어진다(북쪽 너머에 다른 방이 있다) — 벽 속 계단·에스컬레이터는 건물 맨 북쪽 바깥 벽에 붙은 방에 둔다`, x: o.x, y: o.y });
      }
    } else if (d.kind === "hang") {
      const cols = Array.from({ length: Math.max(1, d.w) }, (_, dx) => o.x + dx);
      // 벽면 윗줄이 있는 줄(이 열에서 처음 face 1 인 y) — 오류 문구에 맞는 y 를 알려 준다.
      const faceTop = (x: number) => { for (let y = 0; y < H; y++) if (A.face[y]?.[x] === 1) return y; return -1; };
      const ceil = ceilingHang(o.id);
      if (ceil) {
        // 천장 걸이(천문대 둥근 지붕 조각): 좌표 y = 천장 줄. 모든 조각이 바닥 아닌 칸, 맨 윗줄은 막힌 칸(천장),
        // 벽면까지 내려오는 조각(관측 틈·갈빗대·처마)은 바로 아랫줄이 벽면 윗줄이어야 한다.
        const top = Math.min(...d.cells.map(([, dy]) => dy));
        const bad = d.cells.some(([dx, dy]) => { const x = o.x + dx, y = o.y + dy; return !inBounds(x, y) || A.isFloor(x, y) || (dy === top && A.inn(x, y)); })
          || (ceil === "face-below" && !cols.every((x) => A.face[o.y + 1]?.[x] === 1));
        // 맵 맨 윗줄에 붙은 관측 틈은 위로 지붕이 없어 「벽의 창」으로 읽힌다(2026-10-22 다듬기 7바퀴: 틈은 놓였지만 판정자가 매번 「지붕까지 트인 틈이 안 보인다」).
        if (!bad && ceil === "face-below" && o.id === "dome slit tall" && o.y < 2) issues.push({ severity: "warning", code: "dome-slit-no-roof", message: `${label} 위로 천장 띠가 ${o.y}줄뿐이라 지붕이 보이지 않는다 — 큰 둥근 홀이면 plan 맨 위에 '#' 4줄을 두고 북벽을 3칸마다 한 줄씩 계단식으로 올린 뒤 dome vault(30×8 한 장, x=방 왼쪽 벽 다음 칸, y=0)를 걸고 틈은 그 가운데(dome vault x+14, y=3)에 둔다 — 틈이 둥근 지붕을 가르며 꼭대기까지 이어져 읽힌다(폴른 r28 천문대). 칸 조각 dome cornice·shell 은 1배에서 벽 위 말뚝으로 읽혔다`, x: o.x, y: o.y });
        if (bad) {
          const ft = faceTop(o.x);
          issues.push({ severity: "error", code: "hang-not-on-face", message: `${label} 는 천장 걸이 — y 는 벽면 윗줄 바로 위 천장 줄(막힌 칸)${ceil === "face-below" ? ", 아래 두 줄이 벽면" : ""}${ft > 0 ? ` — 이 열(x=${o.x})은 y=${ft - 1}` : ""}`, x: o.x, y: o.y });
        }
      } else {
        const ok = o.id === "round arch" ? cols.some((x) => A.face[o.y]?.[x] === 1) : cols.every((x) => A.face[o.y]?.[x] === 1);
        if (!ok) { const ft = faceTop(o.x); issues.push({ severity: "error", code: "hang-not-on-face", message: `${label} 는 걸이 — 벽면 두 줄 중 윗줄(막힌 칸 바로 아래 줄)에 건다${ft >= 0 ? ` — 이 열(x=${o.x})은 y=${ft}` : ""}`, x: o.x, y: o.y }); }
        // 탈것 문(벽면에 그린 전철 출입문)은 바로 앞 첫 바닥 줄이 내리는 칸이다 — 남쪽 바깥 출구가 없는 차내에서 유일한 드나드는 자리(J45).
        else if (VEHICLE_DOORS.has(o.id)) for (const x of cols) if (A.isFloor(x, o.y + 2)) landings.push({ i: (o.y + 2) * W + x, label });
      }
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
      for (let dy = 0; dy < Math.max(1, d.h); dy++) for (let dx = 0; dx < d.w; dx++) {
        const x = o.x + dx, y = o.y + dy;
        claim(x, y, label);
        if (!(stair && stair.contract.leads !== "same") && dy === Math.max(1, d.h) - 1 && A.isFloor(x, y + 1)) landings.push({ i: (y + 1) * W + x, label });
      }
    }
    // 벽면 높이 탈것은 한 줄 올려 벽면 두 줄에 그린다 — 준 칸(첫 바닥 줄)은 그림 없이 비어 탈 자리가 된다.
    const lift = flush ? 1 : 0;
    const key = drawKey(d.kind, o.y - lift, d.h);
    const isSurfaceObj = Boolean(d.surface) || /counter|table|desk|booth|zashiki|kotatsu|chabudai|reception|teller/iu.test(o.id);
    for (const [dx, dy, tile, layer] of d.cells) {
      push(o.x + dx, o.y + dy - lift, { key, tile, layer: layer as 2 | 3, label });
      if (flush && inBounds(o.x + dx, o.y + dy - lift)) flushFace.set((o.y + dy - lift) * W + o.x + dx, label);
      const row = surfaceRowOf(o.id, d);
      if (row !== undefined) {
        if (dy === row && inBounds(o.x + dx, o.y + dy)) {
          surfaceCells.add((o.y + dy) * W + o.x + dx);
          for (let r = dy + 1; r < Math.max(1, d.h); r++) if (inBounds(o.x + dx, o.y + r)) liftGoods.set((o.y + r) * W + o.x + dx, (o.y + dy) * W + o.x + dx);
        }
      } else if (isSurfaceObj && dy >= 0 && dy < Math.max(1, d.h) && inBounds(o.x + dx, o.y + dy)) surfaceCells.add((o.y + dy) * W + o.x + dx);
    }
  }
  // 걸이(액자·시계·창)는 벽면에 박은 엘리베이터 문·계단과 같은 칸에 걸 수 없다 — 문 위에 액자가 덮였다.
  for (const o of objects) {
    const d = S.objects[o.id];
    if (d?.kind !== "hang") continue;
    const hit = d.cells.map(([dx, dy]) => [o.x + dx, o.y + dy] as const).find(([x, y]) => inBounds(x, y) && flushFace.has(y * W + x));
    if (hit) issues.push({ severity: "error", code: "hang-over-travel", message: `${d.ko}(${o.id}) @(${o.x},${o.y}) 가 ${flushFace.get(hit[1] * W + hit[0])} 의 벽면 (${hit[0]},${hit[1]}) 을 덮는다 — 걸이는 옆 벽면으로`, x: hit[0], y: hit[1] });
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
      for (const [dx, dy, tile, layer] of piece) push(c.x + dx, c.y + dy, { key, tile, layer: layer as 2 | 3, label, line: true });
    }
  }
  for (const da of daises) {
    const d = S.daises[da.id];
    if (!d) { issues.push({ severity: "error", code: "unknown-dais", message: `단 "${da.id}" 이 없다 — ${Object.keys(S.daises).join(", ")}`, x: da.x, y: da.y }); continue; }
    for (let j = 0; j < da.h; j++) for (let i = 0; i < da.w; i++) {
      const rc = da.h === 1 ? "S" : j === 0 ? "T" : j === da.h - 1 ? "B" : "M";
      const cc = da.w === 1 ? "S" : i === 0 ? "L" : i === da.w - 1 ? "R" : "M";
      const tile = d.pieces[`${cc}${rc}${(i + j) % 2}`];
      if (tile !== undefined) push(da.x + i, da.y + j, { key: -1, tile, layer: 2, label: `${d.ko} @(${da.x},${da.y})`, base: true });
    }
  }
  for (const gd of input.goods ?? []) {
    const tile = S.goods[gd.id.replace(/^goods:/, "")];
    if (tile === undefined) { issues.push({ severity: "error", code: "unknown-goods", message: `탁상 물건 "${gd.id}" 이 없다`, x: gd.x, y: gd.y }); continue; }
    if (!inBounds(gd.x, gd.y)) { issues.push({ severity: "error", code: "out-of-bounds", message: `탁상 물건 ${gd.id} (${gd.x},${gd.y}) 맵 밖` }); continue; }
    const i = liftGoods.get(gd.y * W + gd.x) ?? gd.y * W + gd.x;
    if (!surfaceCells.has(i)) issues.push({ severity: "error", code: "goods-needs-surface", message: `탁상 물건 ${gd.id} (${gd.x},${gd.y}) — 윗면이 있는 가구(탁자·카운터·책상·협탁 등) 칸 위에만 둔다`, x: gd.x, y: gd.y });
    if (goodsAt.has(i)) issues.push({ severity: "warning", code: "goods-stacked", message: `(${gd.x},${gd.y}) 에 탁상 물건이 둘 — 나중 것만 남는다`, x: gd.x, y: gd.y });
    goodsAt.set(i, { tile, label: gd.id });
  }

  const L2 = new Array<number>(W * H).fill(-1), L3 = new Array<number>(W * H).fill(-1), L4 = new Array<number>(W * H).fill(-1);
  for (const [i, es] of per) {
    es.sort((a, b) => a.key - b.key || a.order - b.order);
    // 단 위 바닥 무늬(마법진·별 봉인·단 앞 턱·오르는 계단)는 3층 맨 아래로 올려 단 윗면 위에 얹는다 — stamp_object 가 평평한 키트를 3층에 찍는 것과 같다.
    // (2026-10-22 폴른 스타 시험: 조수가 단 위에 마법진을 두면 「맨 나중 것만 남는다」로 단이나 마법진이 지워졌다.)
    const base = es.filter((e) => e.base);
    const lifted = base.length ? es.filter((e) => e.layer === 2 && !e.base && !e.line) : [];
    const flats = base.length ? es.filter((e) => e.layer === 2 && !lifted.includes(e)) : es.filter((e) => e.layer === 2), rest = [...lifted, ...es.filter((e) => e.layer === 3)];
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
  const southStart = Array.from({ length: W }, (_, x) => ({ x, y: H - 1 })).filter((c) => A.isFloor(c.x, c.y));
  const travelStart = landings.map((l) => ({ x: l.i % W, y: Math.floor(l.i / W) }));
  const start = input.start?.length ? input.start.map((s) => ({ x: s.x, y: s.y })) : (southStart.length ? southStart : travelStart);
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
    // 계약 계단: 앞 칸 중 하나라도 닿으면 된다(넓은 계단 한쪽을 가구가 막아도 탈 수 있다). 하나도 안 닿으면 막힌 계단.
    for (const [label, info] of stairLabels) {
      const mine = landings.filter((l) => l.stair === label);
      if (mine.length && !mine.some((l) => seen.has(l.i))) issues.push({ severity: "error", code: "stair-entrance-blocked", message: `${label} 계단 앞 칸 ${info.approach} 에 출입구에서 닿지 못한다 — 앞을 막은 가구를 치우거나 계단을 방 쪽으로 연 자리에 둔다`, x: mine[0]!.i % W, y: Math.floor(mine[0]!.i / W) });
    }
    for (const l of landings) if (!l.stair && !seen.has(l.i)) issues.push({ severity: "error", code: "travel-landing-unreached", message: `${l.label} 앞 탈 자리 (${l.i % W},${Math.floor(l.i / W)}) 에 출입구에서 닿지 못한다 — 앞을 막은 가구를 치운다`, x: l.i % W, y: Math.floor(l.i / W) });
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
  return { width: W, height: H, lowerTiles: lower, lowerOverlayTiles: L2, upperTiles: L3, upperOverlayTiles: L4, issues, reachable, floorCells, unreachedFloor, start,
    travel: landings.map((l) => ({ label: l.label, x: l.i % W, y: Math.floor(l.i / W),
      ...(l.trigger !== undefined ? { trigger: { x: l.trigger % W, y: Math.floor(l.trigger / W) } } : {}),
      ...(l.facing ? { facing: l.facing } : {}), ...(l.leads ? { leads: l.leads } : {}), ...(l.mode ? { mode: l.mode } : {}) })) };
}
