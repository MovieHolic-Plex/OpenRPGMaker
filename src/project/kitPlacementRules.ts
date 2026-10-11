// 키트 놓기 규칙(2026-10-11) — 「물레방아는 물가에 걸쳐서만」처럼 그림이 뜻을 갖는 자리. stamp_object 가 찍기 전에 검사해
// 어기면 거절한다. 조수(AI)·마을 시공기·사람 모두 이 도구를 지나므로 프롬프트가 아니라 실행기가 지킨다.
//
// 왜: 사용자 지적 — 물레방아·배·잔교·다리는 「물 위에만 건설 가능」 같은 규칙이 있어야 하고 AI 가 반드시 따라야 한다.
// 판정은 찍을 맵의 1층 칸 그림 뜻(tileMeta.tags 의 water / 이름의 「얼음」)으로 한다. 2층 덧그림(물가 둑)은 보지 않는다.
import type { GameMap, StructureKitDef, TilesetDef } from "./types";

export type PlacementSurface = "water" | "ice" | "land";
interface CellRule {
  /** 키트 안 칸 좌표들. "bottom" = 맨 아래 줄, "all" = 그림이 있는 모든 칸, "deck" = 맨 위·아래 줄을 뺀 가운데 줄들의 가운데 열들. */
  cells: "bottom" | "all" | "deck" | readonly (readonly [number, number])[];
  on: PlacementSurface;
  /** 이 칸들 가운데 최소 몇 개(비율이면 0~1)가 그 바닥이어야 하나. 생략 = 전부. */
  atLeast?: number;
}
export interface KitPlacementRule { rules: readonly CellRule[]; why: string }

const WATER_ALL: KitPlacementRule = { rules: [{ cells: "all", on: "water" }], why: "배·물새·수련은 물 위에만 놓는다(둘레가 뭍이면 안 된다)." };
const BRIDGE: KitPlacementRule = {
  rules: [{ cells: "deck", on: "water", atLeast: 0.5 }],
  why: "다리는 물을 건너야 한다 — 다리 바닥(가운데 줄)의 절반 이상이 물 위여야 한다. 물이 없는 곳에 다리를 놓지 않는다.",
};

/** 키트 id → 규칙. 같은 그림의 다른 이름도 같이 적는다. */
export const KIT_PLACEMENT_RULES: Readonly<Record<string, KitPlacementRule>> = {
  "bd-pick-riverside-mill-waterwheel": {
    rules: [{ cells: [[0, 3], [1, 3], [2, 3]], on: "water", atLeast: 1 }, { cells: [[0, 3], [1, 3], [2, 3]], on: "land", atLeast: 1 }],
    why: "물레방아는 물가에 걸친다 — 바퀴 밑 줄에 물 칸과 뭍 칸이 둘 다 있어야 한다(물 한가운데·뭍 한가운데 금지).",
  },
  "bd-pick-swamp-stilt-rowboat": WATER_ALL, "bd-pick-swamp-stilt-fishing-boat": WATER_ALL, "bd-pick-sea-cave-boat": WATER_ALL,
  "bd-pick-swamp-stilt-ducks": WATER_ALL, "bd-pick-desert-oasis-lily": WATER_ALL,
  "bd-pick-coast-cliff-road-rowboat": { rules: [{ cells: "all", on: "water" }], why: "나룻배는 물 위에만 놓는다." },
  "bd-pick-fishing-port-upturned-boat": { rules: [{ cells: "all", on: "land" }], why: "엎어 둔 배는 뭍(물가)에 둔다." },
  "bd-pick-snowfield-ice-boat": { rules: [{ cells: "all", on: "ice" }], why: "얼음 위 배는 얼음 위에만." },
  "bd-pick-snowfield-ice-hole": { rules: [{ cells: "all", on: "ice" }], why: "얼음 구멍은 얼음 위에만." },
  "bd-pick-snowfield-ice-row": { rules: [{ cells: "all", on: "ice" }], why: "얼음 낚시 줄은 얼음 위에만." },
  "bd-pick-fishing-port-jetty-stem": { rules: [{ cells: "all", on: "water", atLeast: 0.6 }], why: "잔교 몸통은 물로 뻗는다 — 60% 이상이 물 위여야 한다." },
  "bd-pick-fishing-port-jetty-head": { rules: [{ cells: "all", on: "water", atLeast: 0.8 }], why: "잔교 머리는 물 위에 놓는다." },
  "bd-pick-fishing-port-jetty-west": { rules: [{ cells: "all", on: "water", atLeast: 0.6 }], why: "작은 부두는 물로 뻗는다." },
  "bd-pick-fishing-port-jetty-post": { rules: [{ cells: "bottom", on: "water" }], why: "잔교 말뚝은 물에 박는다." },
  "bd-pick-fishing-port-fish-market": { rules: [{ cells: "bottom", on: "water", atLeast: 1 }], why: "생선 시장은 물가에 걸친다 — 맨 아래 줄에 물 칸이 하나 이상." },
  "bd-bridge-arch": BRIDGE, "bd-pick-riverside-mill-plank-footbridge": BRIDGE, "bd-pick-mountain-pass-stone-bridge": BRIDGE,
  "bd-river-bridge": BRIDGE,
};

/** 입구가 있는 건물은 물 위에 짓지 않는다(규칙 표에 따로 적힌 키트는 그 규칙만). 기둥 위 오두막처럼 물에 서는 집은 예외. */
const WATER_BUILDINGS = /pierhut|stilt-(?:e|n|s|w)\d|fish-market|waterwheel|lighthouse/;

function surfaceOf(map: GameMap, ts: TilesetDef, x: number, y: number): PlacementSurface | null {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return null;
  const t = map.lowerTiles[y * map.width + x] ?? -1;
  if (t < 0) return "land";
  const meta = ts.tileMeta?.[t];
  const tags = meta?.tags ?? [];
  if (tags.includes("water")) return "water";
  if (/얼음|ice/i.test(meta?.label ?? "")) return "ice";
  return "land";
}

function ruleCells(kit: StructureKitDef, cells: CellRule["cells"]): [number, number][] {
  const drawn = (dx: number, dy: number) => { const r = kit.rows[dy]; return !!r && ((r.tiles[dx] ?? -1) >= 0 || (r.upperTiles?.[dx] ?? -1) >= 0); };
  if (cells === "bottom") return Array.from({ length: kit.width }, (_, dx) => [dx, kit.height - 1] as [number, number]).filter(([dx, dy]) => drawn(dx, dy));
  if (cells === "all") { const out: [number, number][] = []; for (let dy = 0; dy < kit.height; dy += 1) for (let dx = 0; dx < kit.width; dx += 1) if (drawn(dx, dy)) out.push([dx, dy]); return out; }
  if (cells === "deck") {
    const out: [number, number][] = [];
    const y0 = kit.height > 2 ? 1 : 0, y1 = kit.height > 2 ? kit.height - 2 : kit.height - 1;
    const x0 = kit.width > 2 ? 1 : 0, x1 = kit.width > 2 ? kit.width - 2 : kit.width - 1;
    for (let dy = y0; dy <= y1; dy += 1) for (let dx = x0; dx <= x1; dx += 1) out.push([dx, dy]);
    return out;
  }
  return cells.map(([dx, dy]) => [dx, dy] as [number, number]);
}

const SURFACE_KO: Record<PlacementSurface, string> = { water: "물", ice: "얼음", land: "뭍" };

/** 규칙을 어기면 사람이 읽을 이유를 돌려준다(통과면 null). kit 은 찍을 키트 정의, (x, y) 는 왼쪽 위 칸. */
export function checkKitPlacement(map: GameMap, ts: TilesetDef, kitId: string, kit: StructureKitDef, x: number, y: number): string | null {
  const rule = KIT_PLACEMENT_RULES[kitId];
  if (rule) {
    for (const r of rule.rules) {
      const cells = ruleCells(kit, r.cells);
      if (!cells.length) continue;
      const hits = cells.filter(([dx, dy]) => surfaceOf(map, ts, x + dx, y + dy) === r.on).length;
      const need = r.atLeast === undefined ? cells.length : r.atLeast < 1 ? Math.ceil(r.atLeast * cells.length) : r.atLeast;
      if (hits < need) return `「${kit.name ?? kitId}」 놓기 규칙: ${rule.why} (${SURFACE_KO[r.on]} 칸 ${hits}/${cells.length}, 필요 ${need})`;
    }
    return null;
  }
  const isBuilding = (kit.parts ?? []).some((p) => p.kind === "entrance");
  if (isBuilding && !WATER_BUILDINGS.test(kitId)) {
    const wet = ruleCells(kit, "all").filter(([dx, dy]) => surfaceOf(map, ts, x + dx, y + dy) === "water");
    if (wet.length) return `「${kit.name ?? kitId}」 놓기 규칙: 건물은 물 위에 짓지 않는다 — 물 칸 ${wet.length}개(${wet.slice(0, 4).map(([dx, dy]) => `(${x + dx},${y + dy})`).join(" ")}). 뭍으로 옮기거나 물을 메운 뒤 놓는다.`;
  }
  return null;
}
