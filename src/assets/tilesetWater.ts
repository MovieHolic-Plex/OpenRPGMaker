// 버들항 물 그림판(tex_beodeul_water) — 물가 둑·깊이 띠 덧그림과 «게임마다 다른 물빛».
//
// 왜(2026-11-14 오너 «물 색깔이나 뭐 ... 그런 것들을 좀 더 고려해야할거같군»): 조수가 지은 마을의 물은 몸통 칸 하나(23152)를 깔아 물 화소의 3~6할이
// 한 가지 색이었고, 색상이 171°(초록 쪽)였다. 원래 버들항 항구 그림과 참고 마을은 182~188°에 얕은 띠·깊은 띠가 있다.
//   · 물빛(looks): 버들항 시트에서 물 화소가 실린 칸마다 물 화소만 다시 칠한 칸. 겉모습의 water 갈래가 고르고 그릴 때만 겹친다(assets/tilesetLooks.ts).
//     칸 번호·통행·오토타일·8프레임 물결 띠는 그대로다(프레임 칸마다 다시 칠한 칸이 있다).
//   · 물가 둑(shore)·깊이 띠(deep)·폭포(fall): 2층 투명 덧그림과 절벽면 그림 칸. 시공기가 이식해 쓴다(editor/tools/beodeulWater.ts).
// 그림판·표는 scripts/content/beodeul-water/bake.py 가 굽는다 — 버들항 시트 화소와 수식뿐이다(새로 그린 그림 없음).
import beodeulWater from "./beodeulWater.json";
import type { TilesetDef } from "@/project/types";

type Pairs = readonly number[];
export type TilesetWaterLook = {
  readonly label: string; readonly en?: string;
  /** targets[i] 칸의 그림 = 그림판 (base + cells[i]). */
  readonly base: number;
  /** 바닥 겉모습(grounds 열쇠) → mixed.ground[i] 칸의 그림 = 그림판 (값 + i). 물과 풀이 함께 실린 칸. */
  readonly grounds: Readonly<Record<string, number>>;
  /** 길·광장 겉모습(surface 열쇠) → mixed.paved[i] 칸의 그림 = 그림판 (값 + i). */
  readonly surfaces: Readonly<Record<string, number>>;
  /** 그림판별 [원본 칸, 그림판 칸] 쌍 — 이식된 폭포 칸을 이 물빛으로 다시 그린다. */
  readonly sources?: Readonly<Record<string, Pairs>>;
};
export type TilesetWaterTable = {
  readonly version: number; readonly tilesetId: string; readonly image: string; readonly texture: string;
  readonly tileSize: number; readonly tilesPerRow: number; readonly count: number;
  /** 물가 둑: [이웃 비트 256] → 그림판 칸(-1 = 덧그림 없음). 이웃 비트 = 북서1 북2 북동4 서8 동16 남서32 남64 남동128(물이면 1). 얕은 띠 너머는 옅은 물골 막이다(255 = 막만). */
  readonly shore: readonly number[];
  /** 바닥 겉모습(grounds 열쇠)마다 [풀밭 둑 칸, 그 바닥 둑 칸] 쌍. */
  readonly shoreGrounds: Readonly<Record<string, Pairs>>;
  /** 깊이 띠 셋(뭍에서 두 칸·네 칸·일곱 칸): [띠][이웃 비트 256] → 그림판 칸. */
  readonly deep: readonly (readonly number[])[];
  /** 띠의 속 칸: [띠][농담(0~3) × 2 + 얼룩(0·1)] → 그림판 칸. */
  readonly deepFull: readonly (readonly number[])[];
  /** 폭포: 프레임 여덟 장짜리 띠의 첫 칸. [자리 0 왼끝 · 1 가운데 · 2 오른끝 · 3 한 칸 폭]. top = 마루 줄, body = 떨어지는 줄, foot = 물보라 줄. */
  readonly fall: { readonly frames: number; readonly fps: number; readonly top: readonly number[]; readonly body: readonly number[]; readonly foot: readonly number[] };
  /** 폭포 마루(떨어지기 직전 물 칸)·용소(폭포 밑 물 칸)의 2층 덧그림 — [자리 0 왼끝 · 1 가운데 · 2 오른끝 · 3 한 칸 폭]. */
  readonly crest: readonly number[]; readonly plunge: readonly number[];
  readonly targets: readonly number[]; readonly cells: readonly number[];
  readonly mixed: { readonly ground: readonly number[]; readonly paved: readonly number[] };
  readonly looks: Readonly<Record<string, TilesetWaterLook>>;
};

const TABLES: readonly TilesetWaterTable[] = [beodeulWater as unknown as TilesetWaterTable];

/** 물 그림판 textureKey → 칸 수(bundledChipsetFrameCount 가 쓴다). */
export function tilesetWaterSheetCount(textureKey: string): number | undefined {
  return TABLES.find((table) => table.texture === textureKey)?.count;
}

export function tilesetWaterTableFor(tilesetId: string): TilesetWaterTable | undefined {
  return TABLES.find((table) => table.tilesetId === tilesetId);
}

const mixedIndex = new WeakMap<object, { readonly ground: Map<number, number>; readonly paved: Map<number, number> }>();
/**
 * 물빛이 겹쳐 그리는 [버들항 칸, 그림판 칸] 목록. ground·surface 는 그 게임의 바닥·길 겉모습 — 물과 풀·포석이 함께 실린 칸은
 * 그 겉모습 그림 위에 물만 다시 칠한 칸을 쓴다(없으면 원래 그림 위에 칠한 칸).
 */
export function waterLookPairs(table: TilesetWaterTable, water: string | undefined, ground: string | undefined, surface: string | undefined): [number, number][] {
  const look = table.looks[water ?? ""];
  if (!look) return [];
  let mixed = mixedIndex.get(table);
  if (!mixed) {
    mixed = { ground: new Map(table.mixed.ground.map((tile, i) => [tile, i] as const)), paved: new Map(table.mixed.paved.map((tile, i) => [tile, i] as const)) };
    mixedIndex.set(table, mixed);
  }
  const groundBase = ground ? look.grounds[ground] : undefined, pavedBase = surface ? look.surfaces[surface] : undefined;
  const out: [number, number][] = [];
  for (let i = 0; i < table.targets.length; i += 1) {
    const tile = table.targets[i]!;
    const g = groundBase !== undefined ? mixed.ground.get(tile) : undefined, p = pavedBase !== undefined ? mixed.paved.get(tile) : undefined;
    out.push([tile, g !== undefined ? groundBase! + g : p !== undefined ? pavedBase! + p : look.base + table.cells[i]!]);
  }
  return out;
}

const sources = new WeakMap<object, TilesetDef>();
/**
 * 덧그림 칸의 «원본 타일셋» — translateTiles 가 맵 타일셋으로 이식할 때 통행·위아래·이름표를 여기서 옮긴다.
 * 모두 ★(통행 + 상위): 2층 덧그림은 통행 판정에서 건너뛴다(칸의 통행은 1층 물이 정한다 — 막힘). ○ 로 두면 물 위를 걷는다(자연 덧그림과 같은 규칙).
 * 프로젝트에 넣지 않는다 — 타일셋 목록이 늘지 않는다.
 */
export function waterOverlaySource(table: TilesetWaterTable): TilesetDef {
  const hit = sources.get(table);
  if (hit) return hit;
  const n = table.count;
  const meta: { label: string; description: string }[] = Array.from({ length: n }, () => ({ label: "", description: "" }));
  const mark = (cells: readonly number[], label: string, description: string): void => { for (const cell of cells) if (cell > 0) meta[cell] = { label, description }; };
  const overlay = "2층 투명 덧그림(통행은 아래 물 그대로 — 막힘)";
  mark(table.shore, "물가 둑", `물 칸 가장자리의 풀 둑·젖은 테·얕은 물 띠 — ${overlay}`);
  for (const pairs of Object.values(table.shoreGrounds)) mark(pairs.filter((_, i) => i % 2 === 1), "물가 둑", `물 칸 가장자리의 둑·젖은 테·얕은 물 띠 — ${overlay}`);
  for (const band of [...table.deep, ...table.deepFull]) mark(band, "깊은 물 띠", `뭍에서 먼 물의 반투명 어두운 막 — ${overlay}`);
  mark([...table.crest, ...table.plunge], "폭포 물마루·용소", `폭포 위아래 물 칸의 물보라 — ${overlay}`);
  for (const strip of [table.fall.top, table.fall.body, table.fall.foot]) for (const first of strip) {
    mark(Array.from({ length: table.fall.frames }, (_, f) => first + f), "폭포", "절벽면에 거는 폭포 그림(물결 여덟 프레임)");
  }
  const tileset = {
    id: "beodeul_water", name: "버들항 · 물가 둑·깊은 물 띠·폭포 덧그림",
    image: { type: "bundled", id: table.texture }, kind: "custom", family: "oprn-atlas",
    tileSize: table.tileSize, tilesPerRow: table.tilesPerRow, count: n,
    passability: Array.from({ length: n }, () => ({ up: true, down: true, left: true, right: true })),
    priority: Array(n).fill("upper"), terrain: Array(n).fill(0), tileMeta: meta,
  } as unknown as TilesetDef;
  sources.set(table, tileset);
  return tileset;
}
