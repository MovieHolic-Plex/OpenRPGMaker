import { z } from "zod";
import { canMove, tilePassability } from "@/project/collision";
import { clearTileStack } from "@/project/mapOverlayTiles";
import { isWorldTileset, isWorldWaterTile } from "@/project/defaults/worldCoastMapping";
import { WORLD_STRUCTURE_RULES as RULES } from "@/project/defaults/worldStructureRules";
import type { GameMap, PassFlag, Project, TilesetDef } from "@/project/types";
import { requireMap } from "./mapHelpers";
import { ToolError, type JsonSchema, type ToolDefinition } from "./types";

const pointSchema = z.number().int().min(0).max(255);
const bridgeSchema = z.object({
  mapId: z.string().min(1), x: pointSchema, y: pointSchema,
  length: z.number().int().min(1).max(128),
  orientation: z.enum(["horizontal", "vertical"]),
  style: z.enum(["span", "short-a", "short-b"]).default("span"),
}).strict();
const tierSchema = z.object({
  x: pointSchema, y: pointSchema,
  width: z.number().int().min(7).max(128),
  height: z.number().int().min(5).max(128),
  stairX: pointSchema,
  frontOffsets: z.array(z.number().int().min(-2).max(2)).optional(),
}).strict();
const mountainSchema = z.object({
  mapId: z.string().min(1), surface: z.enum(["grass", "dirt", "snow"]),
  tiers: z.array(tierSchema).min(1).max(RULES.mountain.maxTiers),
}).strict();
type Point = { readonly x: number; readonly y: number };
type Cell = Point & { readonly tile: number; readonly layer: "lower" | "upper" };
type TileRule = { readonly pass: PassFlag; readonly layer: "lower" | "upper" };
const OPEN: PassFlag = { up: true, down: true, left: true, right: true };
const CLOSED: PassFlag = { up: false, down: false, left: false, right: false };
const NS: PassFlag = { up: true, down: true, left: false, right: false };
const EW: PassFlag = { up: false, down: false, left: true, right: true };
const coord: JsonSchema = { type: "integer", minimum: 0, maximum: 255 };

function invalid(message: string, code = "invalid-args"): never {
  throw new ToolError(message, { code });
}
function parse<S extends z.ZodType>(schema: S, args: Record<string, unknown>): z.output<S> {
  const parsed = schema.safeParse(args);
  if (!parsed.success) invalid(parsed.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; "));
  return parsed.data;
}
function sourceTileset(project: Project, map: GameMap): TilesetDef {
  const tileset = project.tilesets[map.tilesetId];
  if (!tileset || !isWorldTileset(tileset) || tileset.tileSize !== RULES.tileSize || tileset.tilesPerRow !== RULES.columns) {
    invalid("기본 World 칩셋(16px, 30열) 맵만 지원합니다. 다른 칩셋의 같은 번호로 시공하지 않습니다.", "world-chipset-required");
  }
  if (tileset.transparentColor && tileset.transparentColor.toLowerCase() !== RULES.transparentColor) {
    invalid("원본 World와 다른 사용자 투명색이 설정되어 있습니다.", "world-transparency-conflict");
  }
  return tileset;
}
function inside(map: GameMap, p: Point): boolean {
  return p.x >= 0 && p.y >= 0 && p.x < map.width && p.y < map.height;
}
function index(map: GameMap, p: Point): number { return p.y * map.width + p.x; }
function validateCells(project: Project, map: GameMap, cells: readonly Cell[]): void {
  for (const p of cells) {
    if (!inside(map, p)) invalid(`구조물 전체가 맵 안에 들어가야 합니다: (${p.x}, ${p.y})`, "out-of-bounds");
    if (map.upperTiles[index(map, p)] >= 0 || map.events.some(e => e.x === p.x && e.y === p.y)) {
      invalid(`기존 물건이나 이벤트와 겹칩니다: (${p.x}, ${p.y})`, "occupied");
    }
    if (project.startMapId === map.id && project.startPos.x === p.x && project.startPos.y === p.y) {
      invalid("시작 위치를 구조물로 덮을 수 없습니다.", "occupied");
    }
  }
}
function writableTileset(project: Project, map: GameMap, rules: ReadonlyMap<number, TileRule>): TilesetDef {
  const source = sourceTileset(project, map);
  for (const [tile, rule] of rules) {
    if (tile >= source.count || source.tileGrafts?.some(g => g.targetTile === tile)
      || source.autotileGroups?.some(g => g.memberTileIds.includes(tile))) {
      invalid(`조립에 필요한 ${tile}번의 원본 그림/그룹이 변경되어 있습니다.`, "world-tile-conflict");
    }
    const meta = source.tileMeta?.[tile];
    if (meta?.userLocked || meta?.source === "user" || meta?.locked || meta?.origin === "user") {
      if (source.priority[tile] !== "lower" || (["up", "down", "left", "right"] as const)
        .some(dir => source.passability[tile]?.[dir] !== rule.pass[dir])
        || meta.passage === "star") invalid(`잠긴 ${tile}번의 통행 설정과 조립 규칙이 다릅니다.`, "world-tile-locked");
    }
  }
  const id = `world_structures_${map.id}`;
  if (source.id === id) {
    if (Object.values(project.maps).some(other => other.id !== map.id && other.tilesetId === id)) {
      invalid("전용 타일셋이 다른 맵과 공유되어 있습니다. 먼저 타일셋을 분리하세요.", "shared-structure-tileset");
    }
  } else {
    if (project.tilesets[id]) invalid(`전용 타일셋 ID가 이미 사용 중입니다: ${id}`, "tileset-id-conflict");
    project.tilesets[id] = { ...structuredClone(source), id, name: `${source.name} · ${map.name} 구조물` };
    map.tilesetId = id;
  }
  const target = project.tilesets[id];
  target.transparentColor = RULES.transparentColor;
  target.tileMeta ??= [];
  for (const [tile, rule] of rules) {
    target.passability[tile] = { ...rule.pass };
    target.priority[tile] = "lower";
    target.tileMeta[tile] = {
      // The load-time harness derives rendering priority from this override.
      // Bridges occupy upperTiles, but must remain below the player, not star tiles.
      ...target.tileMeta[tile], defaultLayer: "lower",
      passage: Object.values(rule.pass).some(Boolean) ? "passable" : "solid",
      source: "user", userLocked: true,
    };
  }
  return target;
}
function place(map: GameMap, cells: readonly Cell[]): void {
  for (const cell of cells) {
    const i = index(map, cell);
    if (cell.layer === "lower") map.lowerTiles[i] = cell.tile;
    else map.upperTiles[i] = cell.tile;
    clearTileStack(map, cell.layer, i);
  }
}
function pathBetween(project: Project, map: GameMap, start: Point, end: Point): Point[] | null {
  const first = index(map, start), last = index(map, end);
  const prev = new Int32Array(map.width * map.height).fill(-1), queue = [first];
  prev[first] = first;
  for (let k = 0; k < queue.length && prev[last] < 0; k++) {
    const i = queue[k], p = { x: i % map.width, y: Math.floor(i / map.width) };
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const q = { x: p.x + dx, y: p.y + dy };
      if (!inside(map, q)) continue;
      const n = index(map, q);
      if (prev[n] >= 0 || !canMove(project, map, p.x, p.y, q.x, q.y)) continue;
      prev[n] = i; queue.push(n);
    }
  }
  if (prev[last] < 0) return null;
  const path: Point[] = [];
  for (let i = last;; i = prev[i]) {
    path.push({ x: i % map.width, y: Math.floor(i / map.width) });
    if (i === first) break;
  }
  return path.reverse();
}

const bridge: ToolDefinition = {
  name: "author_world_bridge", mode: "write", domains: ["tile", "map"],
  description: "World 월드맵에 석조 다리를 시공한다. 가로/세로 span과 한 칸 short-a/short-b 건널목. 물 위 직선과 양끝의 통행 가능한 육지가 필요하다. 다리 끝 접합과 옆면 차단을 검증하며 교차·곡선·입체교차는 지원하지 않는다.",
  parameters: {
    type: "object", additionalProperties: false,
    properties: { mapId: { type: "string" }, x: coord, y: coord, length: { type: "integer", minimum: 1, maximum: 128 },
      orientation: { type: "string", enum: ["horizontal", "vertical"] }, style: { type: "string", enum: ["span", "short-a", "short-b"] } },
    required: ["mapId", "x", "y", "length", "orientation"],
  },
  run(project, args) {
    const a = parse(bridgeSchema, args), map = requireMap(project, a.mapId), source = sourceTileset(project, map);
    const vertical = a.orientation === "vertical", dx = vertical ? 0 : 1, dy = vertical ? 1 : 0;
    if (a.style !== "span" && (vertical || a.length !== 1)) invalid("짧은 석교는 horizontal, length:1로만 배치합니다.");
    const entry = { x: a.x - dx, y: a.y - dy }, exit = { x: a.x + dx * a.length, y: a.y + dy * a.length };
    const deck = a.style === "short-a" ? 412 : a.style === "short-b" ? 442
      : vertical ? RULES.bridge.vertical.deck : RULES.bridge.horizontal.deck;
    const cells: Cell[] = [], rules = new Map<number, TileRule>([[deck, { pass: vertical ? NS : EW, layer: "upper" }]]);
    for (let i = 0; i < a.length; i++) {
      const p = { x: a.x + dx * i, y: a.y + dy * i };
      cells.push({ ...p, tile: deck, layer: "upper" });
      if (!vertical && a.style === "span") {
        cells.push({ x: p.x, y: p.y + 1, tile: RULES.bridge.horizontal.support, layer: "upper" });
        rules.set(RULES.bridge.horizontal.support, { pass: CLOSED, layer: "upper" });
      }
    }
    validateCells(project, map, cells);
    for (const cell of cells) if (!isWorldWaterTile(map.lowerTiles[index(map, cell)])) invalid("교량과 지지부 전체가 물 위에 있어야 합니다.", "bridge-needs-water");
    for (const p of [entry, exit]) {
      if (!inside(map, p) || isWorldWaterTile(map.lowerTiles[index(map, p)])) invalid("교량 양끝에 육지 진입부가 필요합니다.", "bridge-needs-landings");
      validateCells(project, map, [{ ...p, tile: 0, layer: "lower" }]);
      const pass = tilePassability(source, map.lowerTiles[index(map, p)], -1);
      if (vertical ? !pass.up || !pass.down : !pass.left || !pass.right) invalid("양끝 지면의 통행 방향이 교량과 맞지 않습니다.", "bridge-landing-blocked");
    }
    writableTileset(project, map, rules);
    place(map, cells);
    if (!pathBetween(project, map, entry, exit)) invalid("교량 진입부 연결 검증 실패", "structure-unreachable");
    return { summary: `${a.length}칸 ${vertical ? "세로" : "가로"} 석교 시공 · 양안 연결과 옆면 차단`,
      data: { mapId: map.id, entry, exit, tilesetId: map.tilesetId, cells: cells.length, direction: a.orientation } };
  },
};

const mountain: ToolDefinition = {
  name: "author_world_mountain", mode: "write", domains: ["tile", "map"],
  description: "World 월드맵에 다층 산·절벽을 만든다. grass/dirt/snow, 1~4단. tiers는 아래→위 순서의 절대좌표 상판이며 각 상판 아래에 벽 2행과 계단을 조립한다. 위 단은 아래 단 내부에 여백을 두고 배치한다. frontOffsets로 열별 전면을 -2~2칸 굴곡지게 한다. 각 층 계단 외 진입 차단을 검증한다.",
  parameters: {
    type: "object", additionalProperties: false,
    properties: {
      mapId: { type: "string" }, surface: { type: "string", enum: ["grass", "dirt", "snow"] },
      tiers: { type: "array", items: { type: "object", additionalProperties: false,
        properties: { x: coord, y: coord, width: { type: "integer", minimum: 7, maximum: 128 },
          height: { type: "integer", minimum: 5, maximum: 128 }, stairX: coord,
          frontOffsets: { type: "array", items: { type: "integer", minimum: -2, maximum: 2 } } },
        required: ["x", "y", "width", "height", "stairX"] } },
    }, required: ["mapId", "surface", "tiers"],
  },
  invalidArgsExample: { mapId: "world", surface: "snow", tiers: [{ x: 8, y: 5, width: 27, height: 26, stairX: 12 }, { x: 12, y: 8, width: 18, height: 16, stairX: 26 }] },
  run(project, args) {
    const a = parse(mountainSchema, args), map = requireMap(project, a.mapId), source = sourceTileset(project, map);
    const cap = RULES.mountain.surfaces[a.surface], cells: Cell[] = [], landings: Point[] = [], gates: Point[] = [];
    const surfaces: Set<number>[] = [];
    const rules = new Map<number, TileRule>();
    for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) rules.set(cap + row * 30 + col, {
      pass: { up: row !== 0, down: row !== 2, left: col !== 0, right: col !== 2 }, layer: "lower",
    });
    for (const row of RULES.mountain.wall) for (const tile of row) rules.set(tile, { pass: CLOSED, layer: "lower" });
    rules.set(RULES.mountain.stair, { pass: NS, layer: "lower" });
    rules.set(RULES.mountain.path, { pass: OPEN, layer: "lower" });
    for (const [level, tier] of a.tiers.entries()) {
      if (tier.stairX < tier.x + 1 || tier.stairX >= tier.x + tier.width - 1) invalid("계단은 상판의 좌우 모서리 안쪽에 있어야 합니다.");
      const offsets = tier.frontOffsets ?? Array(tier.width).fill(0);
      if (offsets.length !== tier.width) invalid("frontOffsets 길이는 width와 같아야 합니다.");
      if (offsets.some((n, i) => i > 0 && Math.abs(n - offsets[i - 1]) > 1)) invalid("인접 전면 높이 차이는 1칸 이하여야 합니다.");
      const endY = (x: number) => tier.y + tier.height - 1 + offsets[x - tier.x];
      const contains = (x: number, y: number) => x >= tier.x && x < tier.x + tier.width && y >= tier.y && y <= endY(x)
        && x >= tier.x + Math.max(0, 2 - (y - tier.y)) && x < tier.x + tier.width - Math.max(0, 2 - (y - tier.y));
      const interior = new Set<number>(), tierCells: Cell[] = [];
      for (let x = tier.x; x < tier.x + tier.width; x++) for (let y = tier.y; y <= endY(x); y++) {
        if (!contains(x, y)) continue;
        const n = !contains(x, y - 1), s = !contains(x, y + 1), w = !contains(x - 1, y), e = !contains(x + 1, y);
        const tile = cap + (n ? 0 : s ? 60 : 30) + (w ? 0 : e ? 2 : 1);
        tierCells.push({ x, y, tile, layer: "lower" });
        if (!n && !s && !w && !e) interior.add(index(map, { x, y }));
      }
      for (let x = tier.x; x < tier.x + tier.width; x++) {
        const col = x === tier.x || endY(x - 1) < endY(x) ? 0 : x === tier.x + tier.width - 1 || endY(x + 1) < endY(x) ? 2 : 1;
        for (let row = 0; row < 2; row++) tierCells.push({ x, y: endY(x) + row + 1, tile: RULES.mountain.wall[row][col], layer: "lower" });
      }
      const landing = { x: tier.stairX, y: endY(tier.stairX) + 3 };
      if (!inside(map, landing)) invalid("계단 아래 진입부까지 맵 안에 들어가야 합니다.", "out-of-bounds");
      if (level > 0 && [...tierCells, landing].some(p => !surfaces[level - 1].has(index(map, p)))) {
        invalid("위 단의 벽과 계단 진입부까지 아래 단의 내부 평면에 들어가야 합니다.", "tier-overlap");
      }
      for (let y = endY(tier.stairX); y < landing.y; y++) tierCells.push({ x: tier.stairX, y, tile: RULES.mountain.stair, layer: "lower" });
      cells.push(...tierCells); surfaces.push(interior); landings.push(landing);
      gates.push({ x: tier.stairX, y: landing.y - 2 });
    }
    validateCells(project, map, cells);
    validateCells(project, map, [{ ...landings[0], tile: 0, layer: "lower" }]);
    for (const cell of cells) {
      const lower = map.lowerTiles[index(map, cell)];
      const passage = tilePassability(source, lower, -1);
      if (isWorldWaterTile(lower) || !Object.values(passage).some(Boolean)) invalid("산은 빈 통행 지면에 배치하세요. 기존 물·벽·산을 덮지 않습니다.", "mountain-needs-ground");
    }
    writableTileset(project, map, rules);
    place(map, cells);
    const entry = landings[0], last = a.tiers[a.tiers.length - 1];
    const summit = { x: last.x + Math.floor(last.width / 2), y: last.y + 2 };
    const route = pathBetween(project, map, entry, summit);
    if (!route) invalid("산의 진입부에서 정상까지 걸을 수 없습니다.", "structure-unreachable");
    for (const gate of gates) {
      const i = index(map, gate), old = map.lowerTiles[i];
      map.lowerTiles[i] = RULES.mountain.wall[0][1];
      const bypass = pathBetween(project, map, entry, summit);
      map.lowerTiles[i] = old;
      if (bypass) invalid("계단 밖에서 다음 층으로 진입할 수 있습니다. 상판 여백을 늘리세요.", "tier-bypass");
    }
    // A path uses only existing open interior, never erases a boundary or staircase.
    for (const p of route) if (map.lowerTiles[index(map, p)] === cap + 31) map.lowerTiles[index(map, p)] = RULES.mountain.path;
    return { summary: `${a.tiers.length}단 산 시공 · 모든 층 계단 및 정상 도달 검증`,
      data: { mapId: map.id, tiers: a.tiers.length, entry, summit, gates, route, cells: new Set(cells.map(p => index(map, p))).size, tilesetId: map.tilesetId } };
  },
};

export const WORLD_STRUCTURE_TOOLS: readonly ToolDefinition[] = [
  { name: "get_world_structure_rules", mode: "read", domains: ["tile", "map"],
    description: "World 다리·산·절벽 조립 규칙 조회. 정확한 원본 타일, 상판·벽·계단, 지원 범위와 시공 도구를 반환한다.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
    run: () => ({ summary: "World 석교와 다층 산 조립 규칙", data: { ...RULES, tools: [bridge.name, mountain.name], overpass: false } }) },
  bridge, mountain,
];
