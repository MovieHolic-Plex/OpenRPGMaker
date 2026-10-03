// 「높이」 지형지물 — 스타크래프트 에디터의 두데드처럼 절벽·언덕에 붙는 것을 골라 놓는다.
//  · 경사로·계단: relief.ramps(1~4 경사로 · 5~8 계단). 칩셋과 무관하게 렌더러가 그린다.
//  · 벽면: 칩셋 키트(덩굴·담쟁이 같은 1~3칸 폭 덧그림)를 relief.wallDecor 로 절벽 남쪽 면에 건다.
//  · 나무·바위: 칩셋 키트를 3층(상층) 스탬프로 찍는다. 들린 칸이면 그림도 같이 들린다(screen.ts).
// 새 저장 필드는 없다. 카탈로그는 칩셋의 structureKits 를 태그·이름으로 고른다 — 키트가 없는 칩셋은 그 탭이 빈다.

import { paintTilesBulk } from "@/editor/tileActions";
import { setLayerTileAt } from "@/project/mapLayers";
import { store } from "@/project/store";
import { reliefLiftField, cellLift } from "@/project/relief/screen";
import { rampCode, RELIEF_BRIDGE, reliefSlopes } from "@/project/relief/walk";
import type { ReliefData, ReliefWallTile } from "@/project/relief/types";
import type { GameMap, MapId, SectionStructureKitDef, TilesetDef } from "@/project/types";

export type ReliefDoodadTab = "ramp" | "wall" | "tree" | "rock" | "bridge";

/** 지형지물 고스트가 놓을 수 있는지 알린다 — 높이 막대가 받아 한 줄로 보여 준다(reliefToolbar.ts). */
export const RELIEF_DOODAD_HOVER_EVENT = "oprn:relief-doodad-hover";
export type ReliefDoodadHoverDetail = { readonly ok: boolean; readonly reason: string; readonly label: string } | null;

export const RELIEF_DOODAD_TABS: readonly { readonly id: ReliefDoodadTab; readonly label: string }[] = [
  { id: "ramp", label: "경사로·계단" },
  { id: "wall", label: "벽면" },
  { id: "tree", label: "나무" },
  { id: "rock", label: "바위·덤불" },
  { id: "bridge", label: "다리" },
];

export type ReliefDoodad =
  | { readonly id: string; readonly tab: "ramp"; readonly kind: "ramp"; readonly label: string; readonly stairs: boolean }
  | { readonly id: string; readonly tab: "bridge"; readonly kind: "bridge"; readonly label: string; readonly axis: "horizontal" | "vertical"; readonly kit: SectionStructureKitDef }
  | { readonly id: string; readonly tab: "wall"; readonly kind: "wall"; readonly label: string; readonly kit: SectionStructureKitDef }
  | { readonly id: string; readonly tab: "tree" | "rock"; readonly kind: "prop"; readonly label: string; readonly kit: SectionStructureKitDef };

/** 탭마다 보여 줄 키트 상한 — 버들항은 나무 키트만 수십 개다. */
const PER_TAB_LIMIT = 24;
/** 자연 비탈은 넓은 면, 계단은 좁은 통로로 읽히도록 구분한다. */
const RAMP_WIDTH = 4, STAIR_WIDTH = 2;

const RAMPS: readonly ReliefDoodad[] = [
  { id: "ramp:slope", tab: "ramp", kind: "ramp", label: "경사로", stairs: false },
  { id: "ramp:stairs", tab: "ramp", kind: "ramp", label: "계단", stairs: true },
];

function kitText(kit: SectionStructureKitDef): string {
  return [kit.id, kit.name ?? "", ...(kit.ai?.tags ?? [])].join(" ");
}

/** 칸이 전부 덧그림(상층)인가 — 벽에 걸거나 땅 위에 찍어도 바닥을 덮지 않는 키트만 고른다. */
function kitIsOverlayOnly(kit: SectionStructureKitDef): boolean {
  return kit.rows.every((row) => row.tiles.every((tile) => tile < 0)) && kit.rows.some((row) => row.upperTiles?.some((tile) => tile >= 0));
}

function kitLabel(kit: SectionStructureKitDef): string {
  const name = kit.name ?? kit.id;
  // 「버들항 해안 절벽길 · 전나무 2×3」 → 「전나무 2×3」
  const tail = name.includes("·") ? name.slice(name.lastIndexOf("·") + 1).trim() : name.replace(/^버들항\s*/, "");
  return tail || name;
}

/** 칩셋의 지형지물 카탈로그. 같은 칩셋 객체면 다시 고르지 않는다. */
const catalogCache = new WeakMap<TilesetDef, readonly ReliefDoodad[]>();
export function reliefDoodadCatalog(tileset: TilesetDef | undefined): readonly ReliefDoodad[] {
  if (!tileset) return RAMPS;
  const cached = catalogCache.get(tileset);
  if (cached) return cached;
  const kits = (tileset.structureKits ?? []).filter((kit): kit is SectionStructureKitDef => kit.kind === "section" && kitIsOverlayOnly(kit));
  const deck = (tileset.structureKits ?? []).find((kit): kit is SectionStructureKitDef =>
    kit.kind === "section" && /바닥 deck|floor.?deck|planks? floor/i.test(kitText(kit))
    && kit.rows.every((row) => row.tiles.every((tile) => {
      const pass = tileset.passability[tile];
      return tile >= 0 && !!pass && pass.up && pass.down && pass.left && pass.right;
    })
      && (row.upperTiles ?? []).every((tile) => tile < 0)));
  const pick = (tab: "wall" | "tree" | "rock", test: (kit: SectionStructureKitDef, text: string) => boolean): ReliefDoodad[] => {
    const out: ReliefDoodad[] = [];
    for (const kit of kits) {
      if (out.length >= PER_TAB_LIMIT) break;
      if (!test(kit, kitText(kit))) continue;
      out.push(tab === "wall"
        ? { id: `wall:${kit.id}`, tab, kind: "wall", label: kitLabel(kit), kit }
        : { id: `${tab}:${kit.id}`, tab, kind: "prop", label: kitLabel(kit), kit });
    }
    return out;
  };
  const catalog: ReliefDoodad[] = [
    ...RAMPS,
    ...(deck ? [
      { id: "bridge:horizontal", tab: "bridge", kind: "bridge", label: "가로 다리", axis: "horizontal", kit: deck },
      { id: "bridge:vertical", tab: "bridge", kind: "bridge", label: "세로 다리", axis: "vertical", kit: deck },
    ] as const : []),
    // 벽면: 세로로 늘어지는 1~3칸 폭 덧그림(덩굴·담쟁이·사슬).
    ...pick("wall", (kit, text) => kit.width <= 3 && kit.height <= 4 && /덩굴|담쟁이|ivy|vine|사슬/i.test(text) && !/아치|처마|시렁|그늘/.test(text)),
    ...pick("tree", (kit, text) => kit.width <= 4 && kit.height <= 5 && (/(^|\s)tree(\s|$)/i.test(text) || /나무|전나무|소나무/.test(text)) && !/화분|벤치|상자|집|다리|문|울타리|간판|수레|통/.test(text)),
    ...pick("rock", (kit, text) => kit.width <= 3 && kit.height <= 3 && /바위|산바위|덤불|헤더|석순|rock|boulder|bush/i.test(text) && !/바닥|cliff|절벽/.test(text)),
  ];
  catalogCache.set(tileset, catalog);
  return catalog;
}

export function findReliefDoodad(tileset: TilesetDef | undefined, id: string | null): ReliefDoodad | null {
  if (!id) return null;
  return reliefDoodadCatalog(tileset).find((doodad) => doodad.id === id) ?? null;
}

/** 화면 칸 사각형(들림을 뺀 그리는 자리, 칸 단위) — 편집기 고스트가 그대로 그린다. */
export interface ReliefDoodadRect { readonly x: number; readonly y: number; readonly w: number; readonly h: number }

export interface ReliefDoodadPlan {
  readonly ok: boolean;
  /** 사람에게 보여 줄 한 줄 — 왜 되는지·안 되는지. */
  readonly reason: string;
  readonly rects: readonly ReliefDoodadRect[];
  readonly apply?: (draft: GameMap) => void;
  /** 나무·바위: 찍을 칸(상층 스탬프). */
  readonly stamp?: readonly { readonly x: number; readonly y: number; readonly layer: "lower" | "upper"; readonly tile: number }[];
}

const level = (relief: ReliefData | undefined, x: number, y: number): number =>
  !relief || x < 0 || y < 0 || x >= relief.width || y >= relief.height ? 0 : relief.levels[y * relief.width + x] ?? 0;

/** 같은 단의 두 둑 사이에 폭 2칸 판을 놓는다. 시작 둑의 윗면에서 골짜기 쪽을 찾는다. */
function planBridge(map: GameMap, doodad: Extract<ReliefDoodad, { kind: "bridge" }>, x: number, y: number): ReliefDoodadPlan {
  const relief = map.relief;
  const hi = level(relief, x, y);
  const horizontal = doodad.axis === "horizontal";
  const rect = { x, y: y - hi, w: horizontal ? 1 : 2, h: horizontal ? 2 : 1 };
  if (!relief || hi === 0) return { ok: false, reason: "언덕 윗면의 가장자리에서 시작한다", rects: [rect] };
  const inside = (X: number, Y: number) => X >= 0 && Y >= 0 && X < map.width && Y < map.height;
  for (const direction of [1, -1]) {
    const cells: { x: number; y: number }[] = [];
    for (let distance = 1; distance < (horizontal ? map.width : map.height); distance++) {
      const span = [0, 1].map((offset) => ({
        x: x + (horizontal ? distance * direction : offset),
        y: y + (horizontal ? offset : distance * direction),
      }));
      if (span.some((cell) => !inside(cell.x, cell.y))) break;
      if (span.every((cell) => level(relief, cell.x, cell.y) === hi && !(relief.ramps?.[cell.y * map.width + cell.x] ?? 0))) {
        const start = [0, 1].map((offset) => ({ x: x + (horizontal ? 0 : offset), y: y + (horizontal ? offset : 0) }));
        if (!cells.length || start.some((cell) => !inside(cell.x, cell.y) || level(relief, cell.x, cell.y) !== hi || (relief.ramps?.[cell.y * map.width + cell.x] ?? 0) > 0)) break;
        const x0 = Math.min(...cells.map((cell) => cell.x)), y0 = Math.min(...cells.map((cell) => cell.y));
        const width = horizontal ? cells.length / 2 : 2, height = horizontal ? 2 : cells.length / 2;
        return {
          ok: true, reason: `${hi}단 둑 사이를 폭 2칸·길이 ${cells.length / 2}칸 다리로 잇는다`,
          rects: [{ x: x0, y: y0 - hi, w: width, h: height }],
          apply: (draft) => {
            if (!draft.relief) return;
            const levels = draft.relief.levels.slice();
            const ramps = draft.relief.ramps?.slice() ?? new Array<number>(levels.length).fill(0);
            for (const cell of cells) {
              const index = cell.y * map.width + cell.x;
              levels[index] = hi; ramps[index] = RELIEF_BRIDGE;
              const tile = doodad.kit.rows[(cell.y - y0) % doodad.kit.height]?.tiles[(cell.x - x0) % doodad.kit.width];
              if (tile !== undefined) setLayerTileAt(draft, 1, index, tile);
              setLayerTileAt(draft, 2, index, -1);
            }
            draft.relief = { ...draft.relief, levels, ramps };
          },
        };
      }
      if (span.some((cell) => level(relief, cell.x, cell.y) >= hi || (relief.ramps?.[cell.y * map.width + cell.x] ?? 0) > 0
        || (map.upperTiles[cell.y * map.width + cell.x] ?? -1) >= 0 || (map.upperOverlayTiles?.[cell.y * map.width + cell.x] ?? -1) >= 0)) break;
      cells.push(...span);
    }
  }
  return { ok: false, reason: "폭 2칸의 낮은 틈 너머에 같은 높이의 둑이 필요하다", rects: [rect] };
}

/** 고른 칸에서 가까운 남쪽 벽(아래 칸이 더 낮은 칸)을 찾는다 — 벽면·경사로는 벽에 붙는다. */
function snapToWall(relief: ReliefData | undefined, x: number, y: number, face: "top" | "wall"): { x: number; y: number } | null {
  if (!relief) return null;
  const order = face === "wall" ? [0] : [0, 1, -1, 2, -2];
  for (const dy of order) {
    const Y = y + dy;
    if (Y < 0 || Y >= relief.height) continue;
    if (level(relief, x, Y) > level(relief, x, Y + 1)) return { x, y: Y };
  }
  return null;
}

/**
 * 고른 지형지물을 (x, y) 에 놓을 수 있는지와 놓을 모양. pick 은 reliefPickCell 결과(보이는 칸과 면)다.
 * 놓기는 placeReliefDoodad 가 이 계획을 그대로 쓴다 — 고스트와 실제 결과가 같은 판정을 탄다.
 */
export function planReliefDoodad(
  map: GameMap,
  doodad: ReliefDoodad,
  pick: { readonly x: number; readonly y: number; readonly face: "top" | "wall" },
): ReliefDoodadPlan {
  const relief = map.relief;
  const lift = relief ? reliefLiftField(relief) : null;
  const drawY = (x: number, y: number) => y - (lift ? cellLift(lift, x, y) : 0);
  if (pick.x < 0 || pick.y < 0 || pick.x >= map.width || pick.y >= map.height) return { ok: false, reason: "맵 밖으로 나간다", rects: [] };
  if (doodad.kind === "bridge") return planBridge(map, doodad, pick.x, pick.y);
  if (doodad.kind === "prop") {
    const { kit } = doodad;
    const x0 = pick.x - Math.floor((kit.width - 1) / 2), y0 = pick.y - (kit.height - 1);
    const base = level(relief, pick.x, pick.y);
    const stamp: { x: number; y: number; layer: "lower" | "upper"; tile: number }[] = [];
    for (let dy = 0; dy < kit.height; dy++) for (let dx = 0; dx < kit.width; dx++) {
      const tile = kit.rows[dy]?.upperTiles?.[dx] ?? -1;
      if (tile >= 0) stamp.push({ x: x0 + dx, y: y0 + dy, layer: "upper", tile });
    }
    const rect = { x: x0, y: drawY(pick.x, pick.y) - (kit.height - 1), w: kit.width, h: kit.height };
    if (stamp.some((cell) => cell.x < 0 || cell.y < 0 || cell.x >= map.width || cell.y >= map.height)) return { ok: false, reason: "맵 밖으로 나간다", rects: [rect] };
    if (stamp.some((cell) => level(relief, cell.x, cell.y) !== base)) return { ok: false, reason: "높이가 다른 칸에 걸친다 — 같은 단 위에만 놓인다", rects: [rect] };
    return { ok: true, reason: base > 0 ? `${base}단 언덕 위에 놓인다` : "땅 위에 놓인다", rects: [rect], stamp };
  }
  const slopes = doodad.kind === "ramp" && relief ? reliefSlopes(relief) : [];
  const hitSlope = slopes.find(s => s.dir === "n" && pick.x >= s.x && pick.x < s.x + s.w && pick.y >= s.y && pick.y < s.y + s.h);
  const wall = hitSlope
    ? { x: hitSlope.x + Math.floor((hitSlope.w - 1) / 2), y: hitSlope.y - 1 }
    : snapToWall(relief, pick.x, pick.y, pick.face);
  if (!relief || !wall) return { ok: false, reason: "남쪽 절벽이 없다 — 언덕 가장자리에 대 보라", rects: [{ x: pick.x, y: drawY(pick.x, pick.y), w: 1, h: 1 }] };
  const hi = level(relief, wall.x, wall.y), lo = level(relief, wall.x, wall.y + 1), height = hi - lo;
  const width = doodad.kind === "ramp" ? (doodad.stairs ? STAIR_WIDTH : RAMP_WIDTH) : doodad.kit.width;
  const x0 = wall.x - Math.floor((width - 1) / 2);
  const faceRect = { x: x0, y: wall.y + 1 - hi, w: width, h: height };
  for (let dx = 0; dx < width; dx++) {
    const X = x0 + dx;
    if (X < 0 || X >= relief.width) return { ok: false, reason: "맵 밖으로 나간다", rects: [faceRect] };
    if (level(relief, X, wall.y) !== hi || level(relief, X, wall.y + 1) !== lo) return { ok: false, reason: "벽 높이가 고르지 않다 — 곧은 절벽에 대 보라", rects: [faceRect] };
  }
  if (doodad.kind === "wall") {
    const { kit } = doodad;
    const rows = Math.min(kit.height, height);
    const tiles: ReliefWallTile[] = [];
    for (let dy = 0; dy < rows; dy++) for (let dx = 0; dx < kit.width; dx++) {
      const tile = kit.rows[dy]?.upperTiles?.[dx] ?? -1;
      if (tile >= 0) tiles.push({ x: x0 + dx, y: wall.y, row: dy + 1, tile });
    }
    return {
      ok: true,
      reason: rows < kit.height ? `${height}단 벽에 건다(아래 ${kit.height - rows}칸은 잘린다)` : `${height}단 벽에 건다`,
      rects: [faceRect],
      apply: (draft) => {
        if (!draft.relief) return;
        const keep = (draft.relief.wallDecor ?? []).filter((d) => !tiles.some((t) => t.x === d.x && t.y === d.y && t.row === d.row));
        draft.relief = { ...draft.relief, wallDecor: [...keep, ...tiles] };
      },
    };
  }
  // 경사로·계단: 벽 남쪽 낮은 땅에 (단 차 + 1)칸 길이로 북쪽 오르막을 깐다(relief-style-sheet 의 계단과 같은 비례).
  const length = height + 1;
  const rampRect = { x: x0, y: wall.y + 1 - hi, w: width, h: height + length };
  // 같은 절벽의 북쪽 통로만 바꾼다. 폭·길이 밖으로 옛 통로를 남기지 않는다.
  const replaceable = slopes.filter(s => s.dir === "n" && s.lo === lo && s.hi === hi
    && s.y === wall.y + 1 && s.h === length && s.x >= x0 && s.x + s.w <= x0 + width);
  for (let dy = 1; dy <= length; dy++) for (let dx = 0; dx < width; dx++) {
    const X = x0 + dx, Y = wall.y + dy;
    if (Y >= relief.height) return { ok: false, reason: "맵 아래로 나간다", rects: [rampRect] };
    if (level(relief, X, Y) !== lo) return { ok: false, reason: `아래 ${length}칸이 평평해야 한다`, rects: [rampRect] };
    const oldCode = relief.ramps?.[Y * relief.width + X] ?? 0;
    if (oldCode > 0 && !((oldCode === 1 || oldCode === 5) && replaceable.some(s => X >= s.x && X < s.x + s.w))) {
      return { ok: false, reason: "다른 통로에 걸친다", rects: [rampRect] };
    }
  }
  const code = rampCode("n", doodad.stairs);
  return {
    ok: true,
    reason: `${height}단을 폭 ${width}칸·길이 ${length}칸 ${doodad.stairs ? "계단으로" : "경사로로"} 잇는다`,
    rects: [rampRect],
    apply: (draft) => {
      if (!draft.relief) return;
      const ramps = draft.relief.ramps ? draft.relief.ramps.slice() : new Array<number>(draft.relief.levels.length).fill(0);
      for (let dy = 1; dy <= length; dy++) for (let dx = 0; dx < width; dx++) ramps[(wall.y + dy) * draft.relief.width + x0 + dx] = code;
      draft.relief = { ...draft.relief, ramps };
    },
  };
}

/** 지형지물 하나를 놓는다. 계획이 안 되면 아무것도 쓰지 않고 그 계획(이유)을 돌려준다. */
export function placeReliefDoodad(
  mapId: MapId,
  doodad: ReliefDoodad,
  pick: { readonly x: number; readonly y: number; readonly face: "top" | "wall" },
): ReliefDoodadPlan {
  const map = store.getCurrent().maps[mapId];
  if (!map) return { ok: false, reason: "맵이 없다", rects: [] };
  const plan = planReliefDoodad(map, doodad, pick);
  if (!plan.ok) return plan;
  if (plan.stamp) {
    paintTilesBulk(mapId, plan.stamp, { autoConnect: false, preservePattern: true, clusterExpand: false });
  } else if (plan.apply) {
    const apply = plan.apply;
    store.updateMapTiles(mapId, apply, { label: `지형지물 · ${doodad.label}`, relief: true });
  }
  return plan;
}
