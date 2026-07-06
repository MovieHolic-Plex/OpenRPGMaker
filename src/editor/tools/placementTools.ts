import { buildGroupSample, type GroupSample } from "@/ai/groupSampleBuilder";
import { TILE } from "@/project/defaults/constants";
import { isUpperOnlyOverlayTile } from "@/project/tilesetHarness";
import type { Command, GameMap, Project, TileGroupMetadata, TilesetDef } from "@/project/types";
import { inMapBounds, passabilityWarning, requireMap, setLower, type Point } from "./mapHelpers";
import { placementSoftPenalty } from "./placementScoring";
import { resolvePlacementStructure, type StructureCellEdit } from "./placementStructure";
import { ToolError, type JsonSchema, type ToolDefinition, type ToolExecResult } from "./types";

type Area = { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
type Rect = Area;
type RecordValue = { readonly [key: string]: unknown };
type ScatterArgs = {
  readonly mapId: string;
  readonly groupId: string;
  readonly area: Area;
  readonly count: number;
  readonly minGap: number;
  readonly maxGap: number;
  readonly avoidProtected: boolean;
  readonly preferSoftRules: boolean;
  readonly applyStructure: boolean;
};
type Footprint = { readonly w: number; readonly h: number; readonly lower: readonly number[]; readonly upper: readonly number[] };
type ChooseInput = {
  readonly choices: readonly Point[];
  readonly allowed: readonly Point[];
  readonly placed: readonly Rect[];
  readonly footprint: Footprint;
  readonly minGap: number;
  readonly seed: string;
  readonly step: number;
  readonly map: GameMap;
  readonly group: TileGroupMetadata;
  readonly preferSoftRules: boolean;
};

const AREA_SCHEMA: JsonSchema = {
  type: "object",
  properties: { x: { type: "integer" }, y: { type: "integer" }, w: { type: "integer" }, h: { type: "integer" } },
  required: ["x", "y", "w", "h"],
};

const scatterObject: ToolDefinition = {
  name: "scatter_object",
  description: "타일 그룹 오브젝트를 영역 안에 여러 개 흩뿌려 배치한다. 풋프린트 단위로 원자 배치하며 시작칸/이벤트/transfer/상위 타일 보호셀을 피한다.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      groupId: { type: "string" },
      area: AREA_SCHEMA,
      count: { type: "integer" },
      minGap: { type: "integer", description: "오브젝트 사이 최소 빈 칸 수(기본 1)" },
      maxGap: { type: "integer", description: "흩뿌림 후보를 고를 때 선호하는 최대 빈 칸 수(기본 3)" },
      avoidProtected: { type: "boolean", description: "시작칸/이벤트/transfer 목적지/상위 타일 점유 칸 회피(기본 true)" },
      preferSoftRules: { type: "boolean", description: "soft/medium 규칙 만족을 우선(기본 true)" },
      applyStructure: { type: "boolean", description: "overlay/처마 생략 등 구조 규칙 자동 적용(기본 true)" },
    },
    required: ["mapId", "groupId", "area", "count"],
  },
  run(draft, rawArgs): ToolExecResult {
    const args = parseArgs(rawArgs);
    const map = requireMap(draft, args.mapId);
    const tileset = draft.tilesets[map.tilesetId];
    if (!tileset) throw new ToolError(`타일셋을 찾을 수 없습니다: ${map.tilesetId}`, { code: "tileset-not-found", mapId: map.id });
    const group = groupById(map, draft, args.groupId);
    const sample = buildGroupSample(tileset, {
      role: group.role,
      tileIds: group.tileIds,
      patternGrammar: group.patternGrammar,
    });
    const footprint = oneInstance(sample, group, tileset);
    const blocked = args.avoidProtected ? blockedCells(draft, map) : new Set<string>();
    const candidates = origins(map, args.area, footprint).filter((origin) => clearAt(map, footprint, origin, blocked));
    const seed = `${map.id}|${group.id}|${args.area.x},${args.area.y},${args.area.w},${args.area.h}|${args.count}|${args.minGap}|${args.maxGap}`;
    const placed: Rect[] = [];
    for (let step = 0; step < args.count; step += 1) {
      const allowed = candidates.filter((origin) => spaced(rectAt(origin, footprint), placed, args.minGap));
      if (allowed.length === 0) break;
      const nearby = placed.length === 0 ? allowed : allowed.filter((origin) => placed.some((rect) => gap(rectAt(origin, footprint), rect) <= args.maxGap));
      placed.push(rectAt(choose({
        choices: nearby.length > 0 ? nearby : allowed,
        allowed,
        placed,
        footprint,
        minGap: args.minGap,
        seed,
        step,
        map,
        group,
        preferSoftRules: args.preferSoftRules,
      }), footprint));
    }
    const touched = placed.flatMap((rect) => paint(map, footprint, rect));
    const structureTouched = args.applyStructure && ((group.junctions?.length ?? 0) > 0 || (group.overlays?.length ?? 0) > 0)
      ? applyStructureEdits(map, resolvePlacementStructure({ map, tileset, group, placed }))
      : [];
    const skipped = args.count - placed.length;
    const warning = passabilityWarning(draft, map, [...touched, ...structureTouched]);
    return {
      summary: `${map.name}에 ${group.name} ${placed.length}개 배치(간격 ${args.minGap}~${args.maxGap})${skipped > 0 ? ` — ${skipped}개 건너뜀: 보호셀/간격/공간 부족` : ""}`,
      data: { placed: placed.length, requested: args.count, skipped },
      warnings: warning ? [warning] : undefined,
    };
  },
};

export const PLACEMENT_TOOLS: readonly ToolDefinition[] = [scatterObject];

function parseArgs(args: Record<string, unknown>): ScatterArgs {
  const areaRecord = record(args["area"], "area{x,y,w,h}");
  const area = { x: int(areaRecord["x"], "area.x"), y: int(areaRecord["y"], "area.y"), w: int(areaRecord["w"], "area.w"), h: int(areaRecord["h"], "area.h") };
  const count = int(args["count"], "count");
  const minGap = int(args["minGap"] ?? 1, "minGap");
  const maxGap = int(args["maxGap"] ?? 3, "maxGap");
  if (area.w < 1 || area.h < 1) throw new ToolError("area.w/h는 1 이상이어야 합니다.", { code: "invalid-args" });
  if (count < 1) throw new ToolError("count는 1 이상이어야 합니다.", { code: "invalid-args" });
  if (minGap < 0 || maxGap < minGap) throw new ToolError("간격은 0 이상이고 maxGap은 minGap 이상이어야 합니다.", { code: "invalid-args" });
  return {
    mapId: str(args["mapId"], "mapId"),
    groupId: str(args["groupId"], "groupId"),
    area,
    count,
    minGap,
    maxGap,
    avoidProtected: bool(args["avoidProtected"] ?? true, "avoidProtected"),
    preferSoftRules: bool(args["preferSoftRules"] ?? true, "preferSoftRules"),
    applyStructure: bool(args["applyStructure"] ?? true, "applyStructure"),
  };
}

function record(value: unknown, label: string): RecordValue {
  if (!isRecord(value)) throw new ToolError(`${label}가 필요합니다.`, { code: "invalid-args" });
  return value;
}

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null;
}

function str(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "") throw new ToolError(`${label}(문자열)가 필요합니다.`, { code: "invalid-args" });
  return value;
}

function int(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isInteger(value)) throw new ToolError(`${label}(정수)가 필요합니다.`, { code: "invalid-args" });
  return value;
}

function bool(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") throw new ToolError(`${label}(boolean)가 필요합니다.`, { code: "invalid-args" });
  return value;
}

function groupById(map: GameMap, project: Project, groupId: string): TileGroupMetadata {
  const group = project.tilesets[map.tilesetId]?.tileGroups?.find((entry) => entry.id === groupId);
  if (!group) throw new ToolError(`타일 그룹을 찾을 수 없습니다: ${groupId}`, { code: "group-not-found", mapId: map.id });
  return group;
}

function oneInstance(sample: GroupSample, group: TileGroupMetadata, tileset: TilesetDef): Footprint {
  const hasUpper = sample.upper.some((tile) => tile !== TILE.EMPTY);
  const occupied = new Set<number>();
  for (let index = 0; index < sample.w * sample.h; index += 1) {
    const upper = sample.upper[index] ?? TILE.EMPTY;
    const lower = sample.lower[index] ?? TILE.EMPTY;
    if ((hasUpper && upper !== TILE.EMPTY) || (!hasUpper && lower !== TILE.EMPTY)) occupied.add(index);
  }
  const first = [...occupied].sort((a, b) => a - b)[0];
  if (first === undefined) throw new ToolError(`타일 그룹 '${group.name}'에는 배치할 타일이 없습니다.`, { code: "empty-group" });
  const component = new Set<number>();
  const stack = [first];
  while (stack.length > 0) {
    const current = stack.pop();
    if (current === undefined || component.has(current) || !occupied.has(current)) continue;
    component.add(current);
    const x = current % sample.w;
    const y = Math.floor(current / sample.w);
    if (x > 0) stack.push(y * sample.w + x - 1);
    if (x < sample.w - 1) stack.push(y * sample.w + x + 1);
    if (y > 0) stack.push((y - 1) * sample.w + x);
    if (y < sample.h - 1) stack.push((y + 1) * sample.w + x);
  }
  const xs = [...component].map((index) => index % sample.w);
  const ys = [...component].map((index) => Math.floor(index / sample.w));
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const y0 = Math.min(...ys);
  const y1 = Math.max(...ys);
  const lower: number[] = [];
  const upper: number[] = [];
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      const source = y * sample.w + x;
      const sourceUpper = component.has(source) ? sample.upper[source] ?? TILE.EMPTY : TILE.EMPTY;
      const sourceLower = component.has(source) ? sample.lower[source] ?? TILE.EMPTY : TILE.EMPTY;
      lower.push(hasUpper ? backingLower(tileset, sourceUpper) : sourceLower);
      upper.push(sourceUpper);
    }
  }
  return { w: x1 - x0 + 1, h: y1 - y0 + 1, lower, upper };
}

function backingLower(tileset: TilesetDef, upperTile: number): number {
  return isUpperOnlyOverlayTile(tileset, upperTile) ? defaultGrassTile(tileset) : TILE.EMPTY;
}

function defaultGrassTile(tileset: TilesetDef): number {
  if (TILE.GRASS >= 0 && TILE.GRASS < tileset.count) return TILE.GRASS;
  const firstLower = tileset.priority.findIndex((layer) => layer === "lower");
  return firstLower >= 0 ? firstLower : TILE.EMPTY;
}

function blockedCells(project: Project, map: GameMap): Set<string> {
  const blocked = new Set<string>();
  const visit = (commands: readonly Command[]): void => {
    for (const command of commands) {
      if (command.kind === "transfer" && command.mapId === map.id) blocked.add(key(command.x, command.y));
      else if (command.kind === "choices") {
        for (const option of command.options) visit(option.branch);
        visit(command.cancelBranch ?? []);
      } else if (command.kind === "fork") {
        visit(command.then);
        visit(command.else ?? []);
      } else if (command.kind === "loop") visit(command.body);
    }
  };
  for (let y = 0; y < map.height; y += 1) for (let x = 0; x < map.width; x += 1) if (map.upperTiles[y * map.width + x] !== TILE.EMPTY) blocked.add(key(x, y));
  for (const event of map.events) blocked.add(key(event.x, event.y));
  if (project.startMapId === map.id) blocked.add(key(project.startPos.x, project.startPos.y));
  for (const sourceMap of Object.values(project.maps)) {
    for (const event of sourceMap.events) {
      visit(event.commands);
      for (const page of event.pages ?? []) visit(page.commands);
    }
  }
  for (const commonEvent of project.commonEvents) visit(commonEvent.commands);
  return blocked;
}

function origins(map: GameMap, area: Area, footprint: Footprint): readonly Point[] {
  const points: Point[] = [];
  for (let y = area.y; y <= area.y + area.h - footprint.h; y += 1) {
    for (let x = area.x; x <= area.x + area.w - footprint.w; x += 1) {
      if (inMapBounds(map, x, y) && inMapBounds(map, x + footprint.w - 1, y + footprint.h - 1)) points.push({ x, y });
    }
  }
  return points;
}

function clearAt(map: GameMap, footprint: Footprint, origin: Point, blocked: ReadonlySet<string>): boolean {
  for (let y = 0; y < footprint.h; y += 1) for (let x = 0; x < footprint.w; x += 1) if (blocked.has(key(origin.x + x, origin.y + y))) return false;
  return inMapBounds(map, origin.x, origin.y) && inMapBounds(map, origin.x + footprint.w - 1, origin.y + footprint.h - 1);
}

function rectAt(origin: Point, footprint: Footprint): Rect {
  return { x: origin.x, y: origin.y, w: footprint.w, h: footprint.h };
}

function spaced(candidate: Rect, placed: readonly Rect[], minGap: number): boolean {
  return placed.every((rect) => !(candidate.x < rect.x + rect.w && candidate.x + candidate.w > rect.x && candidate.y < rect.y + rect.h && candidate.y + candidate.h > rect.y) && gap(candidate, rect) >= minGap);
}

function gap(a: Rect, b: Rect): number {
  return Math.max(Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w), 0), Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h), 0));
}

function choose(input: ChooseInput): Point {
  const { choices, allowed, placed, footprint, minGap, seed, step, map, group, preferSoftRules } = input;
  const first = choices[0];
  if (!first) throw new ToolError("배치 후보가 없습니다.", { code: "no-placement" });
  let best = first;
  let bestPenalty = Number.POSITIVE_INFINITY;
  let bestFuture = -1;
  let bestRank = Number.POSITIVE_INFINITY;
  for (const candidate of choices) {
    const candidateRect = rectAt(candidate, footprint);
    const penalty = preferSoftRules ? placementSoftPenalty({ group, candidate: candidateRect, placed, map }) : 0;
    const future = allowed.filter((origin) => (origin.x !== candidate.x || origin.y !== candidate.y) && spaced(rectAt(origin, footprint), [...placed, candidateRect], minGap)).length;
    const rank = hash(`${seed}|${step}|${candidate.x},${candidate.y}`);
    if (penalty < bestPenalty || (penalty === bestPenalty && (future > bestFuture || (future === bestFuture && rank < bestRank)))) {
      best = candidate;
      bestPenalty = penalty;
      bestFuture = future;
      bestRank = rank;
    }
  }
  return best;
}

function hash(input: string): number {
  let value = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    value ^= input.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function paint(map: GameMap, footprint: Footprint, origin: Point): readonly Point[] {
  const touched: Point[] = [];
  for (let y = 0; y < footprint.h; y += 1) {
    for (let x = 0; x < footprint.w; x += 1) {
      const source = y * footprint.w + x;
      const lower = footprint.lower[source] ?? TILE.EMPTY;
      const upper = footprint.upper[source] ?? TILE.EMPTY;
      if (lower === TILE.EMPTY && upper === TILE.EMPTY) continue;
      const target = (origin.y + y) * map.width + origin.x + x;
      if (lower !== TILE.EMPTY && (lower !== TILE.GRASS || map.lowerTiles[target] === TILE.EMPTY)) setLower(map, origin.x + x, origin.y + y, lower);
      if (upper !== TILE.EMPTY) map.upperTiles[(origin.y + y) * map.width + origin.x + x] = upper;
      touched.push({ x: origin.x + x, y: origin.y + y });
    }
  }
  return touched;
}

function applyStructureEdits(map: GameMap, edits: readonly StructureCellEdit[]): readonly Point[] {
  const touched: Point[] = [];
  for (const edit of edits) {
    if (!inMapBounds(map, edit.x, edit.y)) continue;
    const index = edit.y * map.width + edit.x;
    if (edit.layer === "lower") map.lowerTiles[index] = edit.tile;
    else map.upperTiles[index] = edit.tile;
    touched.push({ x: edit.x, y: edit.y });
  }
  return touched;
}

function key(x: number, y: number): string {
  return `${x},${y}`;
}
