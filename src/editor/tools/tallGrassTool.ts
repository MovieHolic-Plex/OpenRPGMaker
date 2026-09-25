// editor/tools/tallGrassTool.ts
// arrange_tall_grass — 숲마을(forest_harmony)·기후 시트 맵의 빈 풀밭에 키큰 풀 E/F/G 덩이를 깐다.
//
// 왜 따로 있나(2026-09-25 조수 시험 S4): 키큰 풀 세 종류(PR #1421)를 깔 조수 도구가 없어 조수는 paint_tiles 로
// 네모를 칠하거나 아예 안 깔았다. 저작 스크립트의 규칙(scripts/content/lib/tall-grass.mjs)을 TS 로 옮긴
// arrangeTallGrass(project/defaults/tallGrassArrange.ts)를 그대로 쓴다 — 2×2 미만 삭제, 곧은 볼록 모서리 깎기,
// 덩이마다 한 종류(수관 1칸 안 E · 집·길 3칸 안 G · 나머지 F), 이웃 마스크 오토타일. 타일은 코드가 고른다.

import { isForestTallGrassTileset, ensureForestTallGrass, type TallGrassKind } from "@/project/defaults/forestTallGrass";
import { ALL_TALL_GRASS, arrangeTallGrass, tallGrassContext } from "@/project/defaults/tallGrassArrange";
import { TILE } from "@/project/defaults/constants";
import type { GameMap, Rect } from "@/project/types";
import { requireMap } from "./mapHelpers";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

/** Plain meadow ground of the forest atlas and its climate repaints (lawn + lawn texture). */
const MEADOW = new Set([TILE.GRASS, 1140, 1141, 1142, 1143, 1144, 1145, 1146, 1147]);
const VOLCANO_TEXTURE = "tex_forest_harmony_volcano";

function noise(x: number, y: number, seed: number): number {
  const hash = (a: number, b: number): number => {
    let n = Math.imul(a, 374761393) ^ Math.imul(b, 668265263) ^ seed;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 0xffffffff * 2 - 1;
  };
  const ix = Math.floor(x), iy = Math.floor(y), tx = x - ix, ty = y - iy;
  const e = (v: number): number => v * v * (3 - 2 * v);
  const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
  return lerp(lerp(hash(ix, iy), hash(ix + 1, iy), e(tx)), lerp(hash(ix, iy + 1), hash(ix + 1, iy + 1), e(tx)), e(ty));
}

function parseRect(map: GameMap, value: unknown): Rect {
  if (value === undefined) return { x: 0, y: 0, w: map.width, h: map.height };
  const r = value as Partial<Rect> | null;
  const x = Number(r?.x), y = Number(r?.y), w = Number(r?.w), h = Number(r?.h);
  if (![x, y, w, h].every(Number.isInteger) || w < 2 || h < 2) {
    throw new ToolError("rect 는 {x,y,w,h} 정수(w·h ≥ 2)입니다.", { code: "invalid-args", mapId: map.id });
  }
  const x0 = Math.max(0, x), y0 = Math.max(0, y), x1 = Math.min(map.width, x + w), y1 = Math.min(map.height, y + h);
  if (x1 - x0 < 2 || y1 - y0 < 2) throw new ToolError(`rect 가 맵(${map.width}×${map.height}) 밖입니다.`, { code: "invalid-args", mapId: map.id });
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

const arrangeTallGrassTool: ToolDefinition = {
  name: "arrange_tall_grass",
  description:
    "숲마을(forest_harmony)·기후 숲 시트(설원·사막·화산·가을) 맵의 빈 풀밭에 키큰 풀 덩이를 깐다. 타일을 직접 고르지 않는 결정론 도구 — "
    + "덩이는 2×2 이상, 1칸 띠·외딴 포기 없음, 곧은 볼록 모서리는 깎아 둥글게, 덩이마다 한 종류: "
    + "E 짙음(숲 수관에 닿는 덩이) · F 밝음(트인 풀밭) · G 짧음(집·길 3칸 안). style:auto(기본)가 이 규칙으로 고르고, E/F/G 는 모든 덩이를 그 종류로. "
    + "집 벽·지붕·문·창·울타리 1칸 안과 문 앞 2칸, 이벤트 칸에는 깔지 않는다. 화산 시트는 G 가 없다(auto 는 F 로). "
    + "rect 안의 이미 깔린 키큰 풀도 같은 규칙으로 다시 다듬는다(기존 덩이는 모양이 그대로고, 다시 부르면 남은 풀밭에 덩이를 더 깐다). density 는 rect 안 빈 풀밭 중 풀숲 후보 비율(0.05~0.8, 기본 0.3). "
    + "조우 풀숲이 필요한 도로 맵은 author_wild_route 가 풀숲·로케이션까지 만든다 — 이 도구는 그 뒤 빈 풀밭을 채우거나 마을·필드 장식용.",
  mode: "write",
  invalidArgsExample: { mapId: "map_route_1", rect: { x: 0, y: 0, w: 40, h: 30 }, style: "auto", density: 0.3 },
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string", description: "깔 맵 id(forest_harmony 또는 기후 숲 시트 타일셋)" },
      rect: {
        type: "object", description: "범위 {x,y,w,h}(생략하면 맵 전체)",
        properties: { x: { type: "integer" }, y: { type: "integer" }, w: { type: "integer" }, h: { type: "integer" } },
        required: ["x", "y", "w", "h"],
      },
      style: { type: "string", enum: ["auto", "E", "F", "G"], description: "auto(기본): 덩이마다 규칙으로 E/F/G · E 짙음 · F 밝음 · G 짧음" },
      density: { type: "number", description: "빈 풀밭 중 풀숲 후보 비율 0.05~0.8(기본 0.3). 다듬기 뒤 실제 칸은 조금 줄어든다" },
      seed: { type: "integer", description: "덩이 무늬·모서리 깎기 시드(기본 1)" },
    },
    required: ["mapId"],
    additionalProperties: false,
  },
  run(draft, args): ToolExecResult {
    const map = requireMap(draft, args.mapId as string);
    const tileset = draft.tilesets[map.tilesetId];
    if (!tileset || !isForestTallGrassTileset(tileset)) {
      throw new ToolError(`arrange_tall_grass 는 숲마을(forest_harmony)과 기후 숲 시트(forest_harmony_snow·desert·volcano·autumn) 맵에서만 씁니다(현재 ${map.tilesetId}). 다른 타일셋은 그 타일셋의 풀 오토타일을 fill_region 으로.`,
        { code: "tall-grass-tileset", mapId: map.id });
    }
    ensureForestTallGrass(tileset);
    const style = (args.style ?? "auto") as string;
    if (!["auto", "E", "F", "G"].includes(style)) throw new ToolError("style 은 auto·E·F·G 중 하나입니다.", { code: "invalid-args", mapId: map.id });
    const volcano = tileset.image.type === "bundled" && tileset.image.id === VOLCANO_TEXTURE;
    if (volcano && style === "G") throw new ToolError("화산 시트에는 짧은 풀(G)을 깔지 않습니다 — style:auto(G 자리는 F) 또는 E·F 를 쓰세요.", { code: "tall-grass-style", mapId: map.id });
    const density = args.density === undefined ? 0.3 : Number(args.density);
    if (!Number.isFinite(density) || density < 0.05 || density > 0.8) throw new ToolError("density 는 0.05~0.8 입니다.", { code: "invalid-args", mapId: map.id });
    const seed = args.seed === undefined ? 1 : Number(args.seed);
    if (!Number.isInteger(seed)) throw new ToolError("seed 는 정수입니다.", { code: "invalid-args", mapId: map.id });
    const rect = parseRect(map, args.rect);
    const W = map.width, H = map.height, N = W * H;
    const at = (x: number, y: number): number => y * W + x;
    const inRect = (x: number, y: number): boolean => x >= rect.x && y >= rect.y && x < rect.x + rect.w && y < rect.y + rect.h;

    // Houses keep their walls and doors clear: no grass within one cell of a building piece, two below a door.
    const ctx = tallGrassContext(tileset);
    const doorTiles = new Set<number>();
    (tileset.tileMeta ?? []).forEach((meta, tile) => { if (meta?.role === "door") doorTiles.add(tile); });
    const keepClear = new Uint8Array(N);
    const clear = (x: number, y: number): void => { if (x >= 0 && y >= 0 && x < W && y < H) keepClear[at(x, y)] = 1; };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = at(x, y), lower = map.lowerTiles[i] ?? -1, upper = map.upperTiles[i] ?? -1;
      if (ctx.house(lower) || (upper >= 0 && ctx.house(upper))) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) clear(x + dx, y + dy);
      if (doorTiles.has(lower) || doorTiles.has(upper)) for (let dy = 1; dy <= 2; dy++) for (let dx = -1; dx <= 1; dx++) clear(x + dx, y + dy);
    }
    for (const event of map.events) {
      clear(event.x, event.y);
      for (let dy = 1; dy <= 2; dy++) clear(event.x, event.y + dy); // the cell a player steps from to use it
    }
    const stacked = (i: number): boolean => !!map.lowerTileStacks?.[i]?.length || !!map.upperTileStacks?.[i]?.length;
    const meadow = (i: number): boolean => (map.upperTiles[i] ?? -1) === TILE.EMPTY && MEADOW.has(map.lowerTiles[i]!) && !keepClear[i] && !stacked(i);

    // Existing tall grass touching the rect is re-arranged as a whole patch (no half-arranged patch at the border).
    const existing = new Set<number>();
    for (let y = rect.y; y < rect.y + rect.h; y++) for (let x = rect.x; x < rect.x + rect.w; x++) {
      const start = at(x, y);
      if (existing.has(start) || !ALL_TALL_GRASS.has(map.lowerTiles[start]!)) continue;
      const stack = [start]; existing.add(start);
      while (stack.length) {
        const c = stack.pop()!, cx = c % W, cy = Math.floor(c / W);
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = cx + dx, ny = cy + dy, j = at(nx, ny);
          if (nx < 0 || ny < 0 || nx >= W || ny >= H || existing.has(j) || !ALL_TALL_GRASS.has(map.lowerTiles[j]!)) continue;
          existing.add(j); stack.push(j);
        }
      }
    }

    // New patches: coherent noise blobs, biased to the middle of open meadow (the empty screens), densest first.
    const openDist = new Int32Array(N).fill(-1);
    const queue: number[] = [];
    for (let i = 0; i < N; i++) if (!meadow(i)) { openDist[i] = 0; queue.push(i); }
    for (let k = 0; k < queue.length; k++) {
      const c = queue[k]!, cx = c % W, cy = Math.floor(c / W);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || openDist[at(nx, ny)] !== -1) continue;
        openDist[at(nx, ny)] = openDist[c]! + 1; queue.push(at(nx, ny));
      }
    }
    const candidates: { index: number; score: number }[] = [];
    for (let y = rect.y; y < rect.y + rect.h; y++) for (let x = rect.x; x < rect.x + rect.w; x++) {
      const i = at(x, y);
      if (!meadow(i)) continue;
      const open = openDist[i] === -1 ? 6 : Math.min(openDist[i]!, 6);
      const score = noise(x / 4.5, y / 4.5, seed ^ 0x7a11) + 0.25 * noise(x / 2, y / 2, seed ^ 0x1c3e) + 0.12 * open;
      candidates.push({ index: i, score });
    }
    candidates.sort((a, b) => b.score - a.score || a.index - b.index);
    // New grass keeps one clear cell from existing tall grass, so an author_wild_route encounter patch (its location
    // rect) never swells into a new patch; clusters under 9 cells would only leave specks after the 2×2 rule.
    const nearExisting = (i: number): boolean => {
      const x0 = i % W, y0 = Math.floor(i / W);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const x = x0 + dx, y = y0 + dy;
        if (x >= 0 && y >= 0 && x < W && y < H && existing.has(at(x, y))) return true;
      }
      return false;
    };
    const top = new Set(candidates.filter(c => !nearExisting(c.index)).slice(0, Math.round(candidates.length * density)).map(c => c.index));
    // Opening (3×3 erode, then dilate back): noise ridges leave 2-wide ribbons; only bodies at least 3 wide survive,
    // and they come back rounded.
    const full = (i: number): boolean => {
      const x0 = i % W, y0 = Math.floor(i / W);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (x0 + dx < 0 || x0 + dx >= W || !top.has(at(x0 + dx, y0 + dy))) return false;
      }
      return true;
    };
    const picked = new Set<number>();
    for (const i of top) if (full(i)) {
      const x0 = i % W, y0 = Math.floor(i / W);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) picked.add(at(x0 + dx, y0 + dy));
    }
    // Narrow meadow (a verge between road and forest) has no 3-wide body: a ribbon there stays, unless it is an arm
    // of a body the opening kept.
    const bodies = new Set(picked);
    for (const i of top) {
      if (picked.has(i)) continue;
      const x0 = i % W, y0 = Math.floor(i / W);
      let arm = false;
      for (let dy = -1; dy <= 1 && !arm; dy++) for (let dx = -1; dx <= 1; dx++) if (bodies.has(at(x0 + dx, y0 + dy))) { arm = true; break; }
      if (!arm) picked.add(i);
    }
    const chosen: number[] = [];
    for (const start of picked) {
      const comp = [start], seen = new Set([start]);
      for (let k = 0; k < comp.length; k++) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const x = comp[k]! % W + dx, y = Math.floor(comp[k]! / W) + dy, j = at(x, y);
        if (x >= 0 && y >= 0 && x < W && y < H && picked.has(j) && !seen.has(j)) { seen.add(j); comp.push(j); }
      }
      for (const c of comp) picked.delete(c);
      if (comp.length >= 9) chosen.push(...comp);
    }
    const wanted = [...existing, ...chosen];
    if (!wanted.length) {
      throw new ToolError(`범위 ${JSON.stringify(rect)} 에 키큰 풀을 깔 빈 풀밭이 없습니다(바탕 잔디 240·1140~1147, 윗층 빈 칸, 집·문·이벤트 곁 제외).`, { code: "tall-grass-no-room", mapId: map.id });
    }
    const replace: Partial<Record<TallGrassKind, TallGrassKind>> = volcano ? { G: "F" } : {};
    const result = arrangeTallGrass(map, { cells: wanted, tileset, seed, lawn: TILE.GRASS, ...(style === "auto" ? {} : { kind: style as TallGrassKind }), replace });
    const before = [...map.lowerTiles];
    map.lowerTiles = result.lowerTiles;
    const changed = before.reduce((n, tile, i) => n + (tile !== map.lowerTiles[i] ? 1 : 0), 0);
    const patches = result.patches.map(p => {
      const xs = p.cells.map(i => i % W), ys = p.cells.map(i => Math.floor(i / W));
      const x = Math.min(...xs), y = Math.min(...ys);
      return { kind: p.kind, x, y, w: Math.max(...xs) - x + 1, h: Math.max(...ys) - y + 1, cells: p.cells.length };
    }).filter(p => inRect(p.x, p.y) || inRect(p.x + p.w - 1, p.y + p.h - 1));
    const warnings: string[] = [];
    if (!result.patches.length) warnings.push("다듬기(2×2 미만 삭제) 뒤 남은 덩이가 없습니다 — density 를 올리거나 더 넓은 빈 풀밭에서 부르세요.");
    const byKind = (k: TallGrassKind): number => result.patches.filter(p => p.kind === k).length;
    return {
      summary: `${map.name} 키큰 풀 — 덩이 ${result.patches.length}곳(E ${byKind("E")} · F ${byKind("F")} · G ${byKind("G")}), ${result.stats.cells}칸, 바뀐 칸 ${changed}`,
      data: { mapId: map.id, rect, style, density, patches, stats: result.stats, changedCells: changed },
      ...(warnings.length ? { warnings } : {}),
    };
  },
};

export const TALL_GRASS_TOOLS: readonly ToolDefinition[] = [arrangeTallGrassTool];
