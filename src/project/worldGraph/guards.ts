import { ProjectFormatError } from "../io/errors";
import {
  WORLD_GRAPH_EDGE_KINDS,
  WORLD_GRAPH_ROLES,
  WORLD_GRAPH_SIDES,
  type WorldGraph,
  type WorldGraphBoundary,
  type WorldGraphEdgeKind,
  type WorldGraphEntry,
  type WorldGraphNode,
  type WorldGraphPoint,
  type WorldGraphRole,
  type WorldGraphSide,
} from "./types";

type JsonRecord = Record<string, unknown>;

export function emptyWorldGraph(): WorldGraph {
  return { nodes: [], edges: [] };
}

export function normalizeProjectWorldGraph(project: unknown): WorldGraph {
  const record = requireRecord("project", project);
  if (record.worldGraph === undefined) return emptyWorldGraph();
  return normalizeWorldGraph(record.worldGraph);
}

export function normalizeWorldGraph(value: unknown, label = "worldGraph"): WorldGraph {
  const graph = requireRecord(label, value);
  const nodes = requireArray(`${label}.nodes`, graph.nodes).map((entry, index) =>
    normalizeWorldGraphNode(`${label}.nodes[${index}]`, entry)
  );
  const nodeIds = new Set<string>();
  for (const node of nodes) {
    assert(!nodeIds.has(node.mapId), `${label}.nodes.mapId가 중복되었습니다: ${node.mapId}`);
    nodeIds.add(node.mapId);
  }

  const edges = requireArray(`${label}.edges`, graph.edges).map((entry, index) =>
    normalizeWorldGraphEdge(`${label}.edges[${index}]`, entry, nodeIds)
  );
  const edgeKeys = new Set<string>();
  for (const edge of edges) {
    const key = worldGraphEdgeKey(edge);
    assert(!edgeKeys.has(key), `${label}.edges가 중복되었습니다: ${key}`);
    edgeKeys.add(key);
  }
  return { nodes, edges };
}

export function worldGraphEdgeKey(edge: {
  readonly from: { readonly mapId: string; readonly exit?: WorldGraphBoundary };
  readonly to: { readonly mapId: string; readonly entry?: WorldGraphEntry };
  readonly kind?: WorldGraphEdgeKind;
}): string {
  return [
    edge.kind ?? "transfer",
    edge.from.mapId,
    boundaryKey(edge.from.exit),
    edge.to.mapId,
    entryKey(edge.to.entry),
  ].join("|");
}

function normalizeWorldGraphNode(label: string, value: unknown): WorldGraphNode {
  const node = requireRecord(label, value);
  const mapId = requireNonEmptyString(`${label}.mapId`, node.mapId);
  const role = requireEnum(`${label}.role`, node.role, WORLD_GRAPH_ROLES);
  const rawLabel = node.label === undefined ? undefined : requireNonEmptyString(`${label}.label`, node.label);
  return {
    mapId,
    role,
    ...(rawLabel ? { label: rawLabel } : {}),
  };
}

function normalizeWorldGraphEdge(label: string, value: unknown, nodeIds: ReadonlySet<string>) {
  const edge = requireRecord(label, value);
  const kind = edge.kind === undefined
    ? "transfer"
    : requireEnum(`${label}.kind`, edge.kind, WORLD_GRAPH_EDGE_KINDS);
  const from = normalizeFromEndpoint(`${label}.from`, edge.from, nodeIds);
  const to = normalizeToEndpoint(`${label}.to`, edge.to, nodeIds);
  return { from, to, kind };
}

function normalizeFromEndpoint(label: string, value: unknown, nodeIds: ReadonlySet<string>) {
  const endpoint = requireRecord(label, value);
  const mapId = requireNodeMapId(`${label}.mapId`, endpoint.mapId, nodeIds);
  const exit = endpoint.exit === undefined ? undefined : normalizeBoundary(`${label}.exit`, endpoint.exit);
  return { mapId, ...(exit ? { exit } : {}) };
}

function normalizeToEndpoint(label: string, value: unknown, nodeIds: ReadonlySet<string>) {
  const endpoint = requireRecord(label, value);
  const mapId = requireNodeMapId(`${label}.mapId`, endpoint.mapId, nodeIds);
  const entry = endpoint.entry === undefined ? undefined : normalizeEntry(`${label}.entry`, endpoint.entry);
  return { mapId, ...(entry ? { entry } : {}) };
}

export function normalizeBoundary(label: string, value: unknown): WorldGraphBoundary {
  if (typeof value === "string") return { side: requireSide(label, value) };
  const record = requireRecord(label, value);
  if (record.side !== undefined) return { side: requireSide(`${label}.side`, record.side) };
  return normalizeRect(label, record);
}

export function normalizeEntry(label: string, value: unknown): WorldGraphEntry {
  if (typeof value === "string") return { side: requireSide(label, value) };
  const record = requireRecord(label, value);
  if (record.side !== undefined) return { side: requireSide(`${label}.side`, record.side) };
  if (record.w !== undefined || record.h !== undefined) return normalizeRect(label, record);
  return normalizePoint(label, record);
}

export function isWorldGraphRole(value: string): value is WorldGraphRole {
  return (WORLD_GRAPH_ROLES as readonly string[]).includes(value);
}

export function isWorldGraphSide(value: string): value is WorldGraphSide {
  return (WORLD_GRAPH_SIDES as readonly string[]).includes(value);
}

export function isWorldGraphEdgeKind(value: string): value is WorldGraphEdgeKind {
  return (WORLD_GRAPH_EDGE_KINDS as readonly string[]).includes(value);
}

export function isSideRef(value: WorldGraphBoundary | WorldGraphEntry | undefined): value is { readonly side: WorldGraphSide } {
  return typeof value === "object" && value !== null && "side" in value;
}

export function isRectRef(value: WorldGraphBoundary | WorldGraphEntry | undefined): value is { readonly x: number; readonly y: number; readonly w: number; readonly h: number } {
  return typeof value === "object" && value !== null && "w" in value && "h" in value;
}

export function isPointRef(value: WorldGraphEntry | undefined): value is WorldGraphPoint {
  return typeof value === "object" && value !== null && "x" in value && "y" in value && !("w" in value);
}

function normalizeRect(label: string, record: JsonRecord) {
  const x = requireInteger(`${label}.x`, record.x);
  const y = requireInteger(`${label}.y`, record.y);
  const w = requireInteger(`${label}.w`, record.w);
  const h = requireInteger(`${label}.h`, record.h);
  assert(w > 0 && h > 0, `${label}.w/h는 1 이상이어야 합니다.`);
  return { x, y, w, h };
}

function normalizePoint(label: string, record: JsonRecord): WorldGraphPoint {
  return {
    x: requireInteger(`${label}.x`, record.x),
    y: requireInteger(`${label}.y`, record.y),
  };
}

function boundaryKey(value: WorldGraphBoundary | undefined): string {
  if (!value) return "";
  if (isSideRef(value)) return `side:${value.side}`;
  return `rect:${value.x},${value.y},${value.w},${value.h}`;
}

function entryKey(value: WorldGraphEntry | undefined): string {
  if (!value) return "";
  if (isSideRef(value)) return `side:${value.side}`;
  if (isRectRef(value)) return `rect:${value.x},${value.y},${value.w},${value.h}`;
  return `point:${value.x},${value.y}`;
}

function requireNodeMapId(label: string, value: unknown, nodeIds: ReadonlySet<string>): string {
  const mapId = requireNonEmptyString(label, value);
  assert(nodeIds.has(mapId), `${label}가 worldGraph.nodes에 없습니다: ${mapId}`);
  return mapId;
}

function requireSide(label: string, value: unknown): WorldGraphSide {
  return requireEnum(label, value, WORLD_GRAPH_SIDES);
}

function requireEnum<T extends string>(label: string, value: unknown, allowed: readonly T[]): T {
  const raw = requireNonEmptyString(label, value);
  assert((allowed as readonly string[]).includes(raw), `${label}이 잘못되었습니다: ${raw}`);
  return raw as T;
}

function requireRecord(label: string, value: unknown): JsonRecord {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) return value as JsonRecord;
  throw new ProjectFormatError(`${label}가 객체가 아닙니다.`);
}

function requireArray(label: string, value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  throw new ProjectFormatError(`${label}가 배열이 아닙니다.`);
}

function requireNonEmptyString(label: string, value: unknown): string {
  if (typeof value === "string" && value.trim().length > 0) return value.trim();
  throw new ProjectFormatError(`${label}가 비어 있거나 문자열이 아닙니다.`);
}

function requireInteger(label: string, value: unknown): number {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  throw new ProjectFormatError(`${label}가 정수가 아닙니다.`);
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new ProjectFormatError(message);
}
