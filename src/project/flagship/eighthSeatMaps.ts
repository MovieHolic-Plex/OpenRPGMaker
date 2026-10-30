/**
 * 『여덟째 자리』 맵 13장 — 모두 번들 wizarding_world 를 build_wizarding_space 로 짓는다(새 그림 없음).
 *
 * 원작을 바로 떠올리게 하는 키트(동물 기숙사 깃발 넷·해골 날개말·빗자루 경기 소품·촉수 덩굴·귀마개)는 놓지 않는다.
 * 그래서 깃발이 레시피에 든 공간(성채 홀·복도·휴게실·침실·온실·승차장)은 furnitureMode "list" 로 가구를 명시한다.
 * 나머지(도서관·편지 탑·시계탑·실습실·병동·호숫가)는 레시피 가구에 금지 키트가 없어 auto 로 둔다.
 *
 * 맵 잇기: 복도(es_corridor)가 중심이다. 북 = 시계탑, 서 = 실기 강의실·실습실·병동, 동 = 휴게실·도서관·편지 탑, 남 = 큰 강당.
 * 큰 강당 동 = 온실, 남 = 숲 승차장, 승차장 동 = 호숫가 창고, 휴게실 동 = 침실.
 */
import type { GameMap, Project } from "@/project/types";
import { canMove, isPassable } from "@/project/collision";

export type ExecTool = (name: string, args: Record<string, unknown>) => { data?: unknown; summary?: string };
export type Cell = { x: number; y: number };
type Side = "n" | "s" | "e" | "w";
type DoorCell = { x: number; y: number; side: Side };

export const ES_MAP = {
  coach: "es_coach",
  hall: "es_hall",
  corridor: "es_corridor",
  common: "es_common",
  dorm: "es_dorm",
  duel: "es_duelroom",
  library: "es_library",
  greenhouse: "es_greenhouse",
  letters: "es_letters",
  clock: "es_clock",
  lab: "es_lab",
  infirmary: "es_infirmary",
  boathouse: "es_boathouse",
} as const;
export type EsMapKey = keyof typeof ES_MAP;

/** 맵 이름(ESC 메뉴 머리줄 — 8자 안쪽). */
export const ES_MAP_NAMES: Readonly<Record<EsMapKey, string>> = {
  coach: "서쪽 숲 승차장", hall: "큰 강당", corridor: "동쪽 복도", common: "장학생 휴게실", dorm: "장학생 침실",
  duel: "실기 강의실", library: "도서관", greenhouse: "약초 온실", letters: "편지 탑", clock: "시계탑 기어실",
  lab: "지하 실습실", infirmary: "병동", boathouse: "호숫가 창고",
};

type Furn = { kit: string; x?: number; y?: number };
interface MapSpec {
  readonly key: EsMapKey;
  readonly space: string;
  readonly variant?: string;
  readonly width?: number;
  readonly height?: number;
  readonly doors: { side: Side; offset?: number; kind?: "single" | "double" }[];
  readonly furnitureMode: "list" | "auto";
  readonly furniture?: Furn[];
  readonly seed?: number;
  readonly density?: "sparse" | "normal" | "full";
}

/** 깃발·날개말·빗자루 경기·촉수 덩굴·귀마개 — 놓으면 원작이 보인다(설계서 2.1). */
export const ES_BANNED_KITS: readonly string[] = [
  "wz-furn-banner-lion", "wz-furn-banner-snake", "wz-furn-banner-eagle", "wz-furn-banner-badger",
  "wz-cre-thestral-down", "wz-cre-thestral-harness", "wz-qd-goal-kit", "wz-qd-ball-crate-open", "wz-qd-broom-rack",
  "wz-qd-locker-g", "wz-qd-locker-s", "wz-qd-locker-r", "wz-qd-locker-h",
  "wz-gh-tentaclevine", "wz-gh-earmuff-rack", "wz-gh-earmuff-basket",
  "wz-gh-pot-row", "wz-gh-mandrake-pot", "wz-gh-mandrake-pulled-f", "wz-gh-mandrake-pulled", "wz-gh-mandrake-replant",
];

// 큰 강당 30×22: 북벽 벽난로·커튼·촛대, 가운데 통로 양옆으로 긴 탁자 네 줄(의자는 레시피가 위아래로 붙인다).
const HALL_TABLES: Furn[] = [];
for (const x of [4, 9, 18, 23]) for (const y of [7, 13]) HALL_TABLES.push({ kit: "wz-furn-bench-long", x, y });

const SPECS: readonly MapSpec[] = [
  {
    key: "coach", space: "carriage", width: 30, height: 20, seed: 3,
    doors: [{ side: "n", kind: "double" }, { side: "e", offset: 9 }], furnitureMode: "list",
    furniture: [
      { kit: "wz-car-carriage-right" }, { kit: "wz-car-canopy" }, { kit: "wz-car-lantern-post" }, { kit: "wz-car-lantern-post" },
      { kit: "wz-car-noticeboard" }, { kit: "wz-car-trunk" }, { kit: "wz-car-trunk" }, { kit: "wz-car-harness-hook" },
    ],
  },
  {
    key: "hall", space: "shared", width: 30, height: 22, seed: 1,
    doors: [{ side: "s", kind: "double" }, { side: "n" }, { side: "e", offset: 12 }], furnitureMode: "list",
    furniture: [
      { kit: "wz-furn-fireplace" },
      { kit: "wz-furn-curtain-open" }, { kit: "wz-furn-curtain-open" },
      { kit: "wz-castle-sconce" }, { kit: "wz-castle-sconce" },
      ...HALL_TABLES,
      { kit: "wz-furn-candlestick", x: 2, y: 5 }, { kit: "wz-furn-candlestick", x: 27, y: 5 },
    ],
  },
  {
    key: "corridor", space: "shared", variant: "corridor", width: 10, height: 30, seed: 1,
    doors: [{ side: "s" }, { side: "n" }, { side: "w", offset: 7 }, { side: "w", offset: 15 }, { side: "w", offset: 23 },
      { side: "e", offset: 7 }, { side: "e", offset: 15 }, { side: "e", offset: 23 }],
    furnitureMode: "list",
    furniture: [{ kit: "wz-castle-sconce" }, { kit: "wz-castle-sconce" }, { kit: "wz-furn-curtain-open" }],
  },
  {
    key: "common", space: "shared", variant: "common", width: 20, height: 14, seed: 2,
    doors: [{ side: "w", offset: 9 }, { side: "e", offset: 9 }], furnitureMode: "list",
    furniture: [
      { kit: "wz-furn-fireplace" }, { kit: "wz-furn-bookshelf" }, { kit: "wz-furn-bookshelf-low" },
      { kit: "wz-car-noticeboard" }, { kit: "wz-furn-table-small" }, { kit: "wz-furn-candlestick" }, { kit: "wz-furn-crate-stack" },
    ],
  },
  {
    key: "dorm", space: "shared", variant: "dorm", width: 18, height: 12, seed: 1,
    doors: [{ side: "w", offset: 8 }], furnitureMode: "list",
    furniture: [
      { kit: "wz-dorm-bed-green", x: 3, y: 4 }, { kit: "wz-dorm-bed-red", x: 12, y: 4 }, { kit: "wz-dorm-nightstand", x: 14, y: 4 },
      { kit: "wz-dorm-lamp-green" }, { kit: "wz-dorm-lamp-green" },
      { kit: "wz-dorm-wardrobe" }, { kit: "wz-dorm-mirror" }, { kit: "wz-dorm-trunk" },
    ],
  },
  {
    key: "duel", space: "shared", variant: "common", width: 22, height: 16, seed: 1,
    doors: [{ side: "e", offset: 11 }], furnitureMode: "list",
    furniture: [
      { kit: "wz-castle-sconce" }, { kit: "wz-castle-sconce" },
      { kit: "wz-qd-mark-circle", x: 9, y: 8 },
      { kit: "wz-furn-bench-seat", x: 3, y: 8 }, { kit: "wz-furn-bench-seat", x: 3, y: 11 },
      { kit: "wz-furn-bench-seat", x: 16, y: 8 }, { kit: "wz-furn-bench-seat", x: 16, y: 11 },
      { kit: "wz-qd-target" },
    ],
  },
  { key: "library", space: "library", seed: 2, doors: [{ side: "w", offset: 12 }], furnitureMode: "auto", density: "normal" },
  {
    key: "greenhouse", space: "greenhouse", width: 24, height: 15, seed: 1,
    doors: [{ side: "w", offset: 10 }], furnitureMode: "list",
    // 화분 줄(wz-gh-pot-row)은 「맨드레이크 화분 줄」이고 분갈이 작업대 곁에만 선다 — 둘 다 빼고 긴 작업대·묘목 트레이·화분으로.
    furniture: [
      { kit: "wz-gh-vine-wall" }, { kit: "wz-gh-vine-wall" },
      { kit: "wz-furn-bench-long", x: 6, y: 6 }, { kit: "wz-furn-bench-long", x: 14, y: 6 },
      { kit: "wz-gh-seedtray", x: 6, y: 10 }, { kit: "wz-gh-seedtray", x: 14, y: 10 }, { kit: "wz-gh-watercan", x: 10, y: 7 }, { kit: "wz-gh-soilbox" },
      { kit: "wz-gh-pot-full", x: 18, y: 7 }, { kit: "wz-gh-pot-empty", x: 19, y: 7 }, { kit: "wz-gh-vine-bush" },
    ],
  },
  { key: "letters", space: "owlery", seed: 2, doors: [{ side: "w", offset: 9 }], furnitureMode: "auto", density: "normal" },
  { key: "clock", space: "clocktower", seed: 1, doors: [{ side: "s" }], furnitureMode: "auto", density: "normal" },
  { key: "lab", space: "potions", seed: 1, doors: [{ side: "e", offset: 9 }], furnitureMode: "auto", density: "sparse" },
  { key: "infirmary", space: "infirmary", seed: 1, doors: [{ side: "e", offset: 9 }], furnitureMode: "auto", density: "sparse" },
  { key: "boathouse", space: "boathouse", seed: 1, doors: [{ side: "w" }], furnitureMode: "auto", density: "normal" },
];

/** 문 잇기: [맵, 변, 몇 번째 그 변의 문] ↔ [맵, 변, 몇 번째]. */
const LINKS: readonly [EsMapKey, Side, number, EsMapKey, Side, number][] = [
  ["coach", "n", 0, "hall", "s", 0],
  ["hall", "n", 0, "corridor", "s", 0],
  ["hall", "e", 0, "greenhouse", "w", 0],
  ["corridor", "n", 0, "clock", "s", 0],
  ["corridor", "w", 0, "duel", "e", 0],
  ["corridor", "w", 1, "lab", "e", 0],
  ["corridor", "w", 2, "infirmary", "e", 0],
  ["corridor", "e", 0, "common", "w", 0],
  ["corridor", "e", 1, "library", "w", 0],
  ["corridor", "e", 2, "letters", "w", 0],
  ["common", "e", 0, "dorm", "w", 0],
  ["coach", "e", 0, "boathouse", "w", 0],
];

export interface EsMapInfo {
  readonly mapId: string;
  readonly width: number;
  readonly height: number;
  readonly spawn: Cell;
  readonly doorCells: DoorCell[];
  readonly placed: { kit: string; x: number; y: number }[];
}
export type EsAnchors = Readonly<Record<EsMapKey, EsMapInfo>> & {
  /** 문 잇기 결과: 맵 → 그 맵의 문 칸 키 `${side}${index}` → 이 문이 서 있는 칸(이동 이벤트 칸). */
  readonly doors: Readonly<Record<EsMapKey, Record<string, Cell>>>;
};

/** 같은 변의 문 칸을 문(덩이)별로 묶는다 — 2칸 문은 이웃한 두 칸이 한 문이다. */
function doorsOnSide(cells: readonly DoorCell[], side: Side): DoorCell[][] {
  const on = cells.filter((c) => c.side === side).sort((a, b) => (side === "n" || side === "s" ? a.x - b.x : a.y - b.y));
  const groups: DoorCell[][] = [];
  for (const c of on) {
    const last = groups[groups.length - 1];
    const prev = last?.[last.length - 1];
    if (prev && Math.abs(prev.x - c.x) + Math.abs(prev.y - c.y) === 1) last!.push(c);
    else groups.push([c]);
  }
  return groups;
}

export function buildEighthSeatMaps(_project: Project, exec: ExecTool, onMapError?: (key: EsMapKey, error: unknown) => void): EsAnchors {
  const info = {} as Record<EsMapKey, EsMapInfo>;
  for (const spec of SPECS) {
    try { buildOne(spec); } catch (error) { if (!onMapError) throw error; onMapError(spec.key, error); }
  }
  function buildOne(spec: MapSpec): void {
    for (const f of spec.furniture ?? []) if (ES_BANNED_KITS.includes(f.kit)) throw new Error(`[eighth-seat] 금지 키트 ${f.kit} (${spec.key})`);
    const res = exec("build_wizarding_space", {
      mapId: ES_MAP[spec.key], name: ES_MAP_NAMES[spec.key], space: spec.space,
      ...(spec.variant ? { variant: spec.variant } : {}),
      ...(spec.width ? { width: spec.width } : {}), ...(spec.height ? { height: spec.height } : {}),
      doors: spec.doors, furnitureMode: spec.furnitureMode,
      ...(spec.furniture ? { furniture: spec.furniture } : {}),
      ...(spec.density ? { density: spec.density } : {}), seed: spec.seed ?? 1,
    });
    const d = res.data as { mapId: string; width: number; height: number; spawn: Cell; doorCells: DoorCell[]; placed: { kit: string; x: number; y: number }[] };
    for (const p of d.placed) if (ES_BANNED_KITS.includes(p.kit)) throw new Error(`[eighth-seat] 레시피가 금지 키트 ${p.kit} 를 놓았다 (${spec.key})`);
    info[spec.key] = { mapId: d.mapId, width: d.width, height: d.height, spawn: d.spawn, doorCells: d.doorCells, placed: d.placed };
  }
  const doors = Object.fromEntries(Object.keys(ES_MAP).map((k) => [k, {}])) as Record<EsMapKey, Record<string, Cell>>;
  for (const [ka, sa, ia, kb, sb, ib] of LINKS) {
    if (!info[ka] || !info[kb]) continue;
    const ga = doorsOnSide(info[ka].doorCells, sa)[ia];
    const gb = doorsOnSide(info[kb].doorCells, sb)[ib];
    if (!ga || !gb) throw new Error(`[eighth-seat] 문 없음: ${ka}.${sa}${ia} ↔ ${kb}.${sb}${ib}`);
    const n = Math.min(ga.length, gb.length);
    for (let i = 0; i < n; i += 1) {
      const a = ga[i]!, b = gb[i]!;
      exec("create_transfer_pair", { a: { mapId: info[ka].mapId, x: a.x, y: a.y }, b: { mapId: info[kb].mapId, x: b.x, y: b.y }, fade: "black" });
    }
    doors[ka][`${sa}${ia}`] = { x: ga[0]!.x, y: ga[0]!.y };
    doors[kb][`${sb}${ib}`] = { x: gb[0]!.x, y: gb[0]!.y };
  }
  return { ...info, doors } as EsAnchors;
}

/** origin 둘레에서 사람을 세울 빈 칸(통행·이벤트 없음·한쪽이라도 열림). */
export function freeCell(project: Project, map: GameMap, origin: Cell, avoid: readonly Cell[] = [], maxR = 8): Cell {
  for (let r = 0; r <= maxR; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = origin.x + dx, y = origin.y + dy;
        if (x < 1 || y < 1 || x >= map.width - 1 || y >= map.height - 1) continue;
        if (!isPassable(project, map, x, y)) continue;
        if (map.events.some((e) => e.x === x && e.y === y)) continue;
        if (avoid.some((c) => c.x === x && c.y === y)) continue;
        const open = ([[0, 1], [0, -1], [1, 0], [-1, 0]] as const).some(([ddx, ddy]) => canMove(project, map, x, y, x + ddx, y + ddy));
        if (open) return { x, y };
      }
    }
  }
  throw new Error(`[eighth-seat] ${map.id}: (${origin.x},${origin.y}) 근처에 빈 칸이 없다`);
}
