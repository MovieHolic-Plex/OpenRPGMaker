import { defaultOutdoorTilesetId } from "@/project/defaults/forestHarmony";
// 선언형 월드 그래프 툴: plan_world / link_maps / build_world / lint_world.

import { passableLanding, upsertEventIntoMap } from "./eventTools";
import { inMapBounds, requireMap, type Point } from "./mapHelpers";
import { snapFlushToWall } from "./wallFlush";
import { ToolError, type JsonSchema, type ToolDefinition, type ToolExecResult } from "./types";
import { appendToTree } from "@/project/mapTree";
import { isPassable } from "@/project/collision";
import { DEFAULT_TILE_SIZE, COMBINED_TOWN_TILESET_ID, TILE } from "@/project/defaults/constants";
import { exceedsMapDimensionLimit, MAX_TOOL_MAP_DIMENSION, mapSizeLimitMessage } from "@/project/mapSizeLimits";
import { normalizeWorldGraph } from "@/project/worldGraph";
import {
  isPointRef,
  isRectRef,
  isSideRef,
  lintWorldGraph,
  normalizeBoundary,
  normalizeEntry,
  type WorldGraph,
  type WorldGraphBoundary,
  type WorldGraphEdge,
  type WorldGraphEntry,
  type WorldGraphRole,
  type WorldGraphSide,
} from "@/project/worldGraph";
import type { Command, EventPage, GameEvent, GameMap, Project, TransferFade } from "@/project/types";
import { eventAtPoint } from "@/project/eventFootprintQuery";

type JsonRecord = Record<string, unknown>;

interface BuildWorldNodeInput {
  readonly mapId: string;
  readonly role: WorldGraphRole;
  readonly label?: string;
  readonly width?: number;
  readonly height?: number;
  readonly size?: { readonly width?: number; readonly height?: number; readonly w?: number; readonly h?: number };
  readonly concept?: string;
}

interface LinkResult {
  readonly eventIdA: string;
  readonly eventIdB?: string;
  readonly gateA: Point;
  readonly gateB: Point;
  readonly landingA?: Point;
  readonly landingB: Point;
  readonly changedEvents: number;
}

const PASSIVE: EventPage["movement"] = { type: "fixed", speed: 3, frequency: 3 };
const DEFAULT_MAP_SIZE = 20;
const DUNGEON_AMBIENT = 0.75;

/** 월드 gate — `{side}` 또는 `{x,y,w,h}` 유니온이라 키 합집합을 선택 필드로 둔다. */
const WORLD_GATE_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    side: { type: "string", enum: ["north", "south", "east", "west"] },
    x: { type: "integer" },
    y: { type: "integer" },
    w: { type: "integer" },
    h: { type: "integer" },
  },
};

/** 월드 노드 — plan_world/build_world 가 같은 shape 을 받는다. */
const WORLD_GRAPH_NODE_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    mapId: { type: "string" },
    role: { type: "string", enum: ["town", "field", "dungeon", "interior"] },
    label: { type: "string" },
    width: { type: "integer", description: `가로 타일 수(3 이상, 최대 ${MAX_TOOL_MAP_DIMENSION})` },
    height: { type: "integer", description: `세로 타일 수(3 이상, 최대 ${MAX_TOOL_MAP_DIMENSION})` },
    size: { type: "string" },
    concept: { type: "string" },
  },
  required: ["mapId", "role"],
};

/** 월드 edge — `{from:{mapId,exit?},to:{mapId,entry?},kind?}`. */
const WORLD_GRAPH_EDGE_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    from: {
      type: "object",
      properties: { mapId: { type: "string" }, exit: WORLD_GATE_SCHEMA },
      required: ["mapId"],
    },
    to: {
      type: "object",
      properties: { mapId: { type: "string" }, entry: WORLD_GATE_SCHEMA },
      required: ["mapId"],
    },
    kind: { type: "string", description: "기본 transfer" },
  },
  required: ["from", "to"],
};

const planWorld: ToolDefinition = {
  name: "plan_world",
  description: `선언형 worldGraph를 검증해 프로젝트에 등록한다. 맵은 만들지 않으며, edges는 nodes에 선언된 mapId만 참조할 수 있다. 크기 힌트는 build_world 와 같은 상한(최대 ${MAX_TOOL_MAP_DIMENSION}×${MAX_TOOL_MAP_DIMENSION})을 지켜야 한다. canonical spatialAuthoring 프로젝트의 「세계」 계층(지형 자동 컴파일)은 upsert_spatial_design(kind:world)→preview_spatial_build→apply_spatial_build 를 쓴다 — 이 도구는 수작업 맵 그래프다.`,
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      nodes: {
        type: "array",
        description: "월드 노드 [{mapId,role,label?}], role: town/field/dungeon/interior",
        items: WORLD_GRAPH_NODE_SCHEMA,
      },
      edges: {
        type: "array",
        description: "월드 edge [{from:{mapId,exit?},to:{mapId,entry?},kind?}], kind 기본 transfer",
        items: WORLD_GRAPH_EDGE_SCHEMA,
      },
    },
    required: ["nodes", "edges"],
  },
  run(draft, args): ToolExecResult {
    const graph = normalizeGraphOrToolError({ nodes: args.nodes, edges: args.edges });
    // normalizeWorldGraph 는 width/height 를 버리므로 원본 노드 레코드에서 힌트를 검사한다.
    assertPlanNodeSizes(requireRecordArray(args.nodes, "nodes") as unknown as BuildWorldNodeInput[]);
    draft.worldGraph = graph;
    const missing = graph.nodes.filter((node) => !draft.maps[node.mapId]).map((node) => node.mapId);
    return {
      summary: `월드 그래프 계획 등록 — 노드 ${graph.nodes.length}개, edge ${graph.edges.length}개`,
      data: { nodes: graph.nodes.length, edges: graph.edges.length, missingMapIds: missing },
      warnings: missing.length > 0 ? [`아직 생성되지 않은 월드 그래프 맵: ${missing.join(", ")}`] : undefined,
    };
  },
};

const linkMaps: ToolDefinition = {
  name: "link_maps",
  description: "두 맵 사이 transfer edge를 등록하고 실제 출입구 이벤트를 안정 ID로 생성/갱신한다. bidirectional 기본 true.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      from: {
        type: "object",
        description: "{mapId,x,y} 또는 {mapId,exit:{side|x,y,w,h}}",
        properties: {
          mapId: { type: "string" },
          x: { type: "integer" },
          y: { type: "integer" },
          exit: WORLD_GATE_SCHEMA,
        },
        required: ["mapId"],
      },
      to: {
        type: "object",
        description: "{mapId,x,y} 또는 {mapId,entry:{x,y|side|x,y,w,h}}",
        properties: {
          mapId: { type: "string" },
          x: { type: "integer" },
          y: { type: "integer" },
          entry: WORLD_GATE_SCHEMA,
        },
        required: ["mapId"],
      },
      bidirectional: { type: "boolean", description: "기본 true. false면 from→to 이벤트만 만든다." },
      fade: { type: "string", enum: ["black", "white", "none"] },
    },
    required: ["from", "to"],
  },
  run(draft, args): ToolExecResult {
    const result = linkMapsInDraft(draft, {
      from: requireRecordArg(args.from, "from"),
      to: requireRecordArg(args.to, "to"),
      bidirectional: args.bidirectional !== false,
      fade: (args.fade as TransferFade | undefined) ?? "black",
      registerEdge: true,
    });
    return {
      summary: `맵 연결 생성/갱신: ${result.gateA.x},${result.gateA.y} -> ${result.landingB.x},${result.landingB.y}${result.eventIdB ? " (양방향)" : " (단방향)"}`,
      data: result,
    };
  },
};

const buildWorld: ToolDefinition = {
  name: "build_world",
  description:
    `worldGraph 형태의 plan으로 다중 맵 월드를 만든다. 노드별 빈 맵과 역할 기본 지형만 만들고, transfer edges를 일괄 link_maps 처리한다. 마을 내부 콘텐츠(집/NPC)는 만들지 않는다. 노드 맵 하나는 최대 ${MAX_TOOL_MAP_DIMENSION}×${MAX_TOOL_MAP_DIMENSION} — 더 넓은 월드는 노드를 늘려 나눠라. canonical spatialAuthoring 프로젝트의 「세계」 계층은 upsert_spatial_design(kind:world)→preview_spatial_build→apply_spatial_build, 이후 수정은 edit_spatial_occurrence 를 쓴다.`,
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      plan: {
        type: "object",
        description: "{nodes:[{mapId,role,label?,width?,height?,size?,concept?}],edges:[...]}",
        properties: {
          nodes: { type: "array", items: WORLD_GRAPH_NODE_SCHEMA },
          edges: { type: "array", items: WORLD_GRAPH_EDGE_SCHEMA },
        },
        required: ["nodes"],
      },
      fade: { type: "string", enum: ["black", "white", "none"] },
    },
    required: ["plan"],
  },
  run(draft, args): ToolExecResult {
    const plan = requireRecordArg(args.plan, "plan");
    const graph = normalizeGraphOrToolError({
      nodes: plan.nodes,
      edges: plan.edges,
    });
    const buildNodes = requireRecordArray(plan.nodes, "plan.nodes") as unknown as BuildWorldNodeInput[];
    assertPlanNodeSizes(buildNodes);
    const nodeHints = new Map(buildNodes.map((node) => [node.mapId, node]));
    const created: Record<string, string> = {};
    const reused: string[] = [];

    for (const node of graph.nodes) {
      const hint = nodeHints.get(node.mapId);
      if (draft.maps[node.mapId]) {
        reused.push(node.mapId);
        continue;
      }
      const width = dimensionFromHint(hint, "width");
      const height = dimensionFromHint(hint, "height");
      const map = createRoleMap(draft, node.mapId, node.label ?? hint?.concept ?? node.mapId, width, height, node.role);
      draft.maps[map.id] = map;
      addMapToTree(draft, map.id);
      created[node.mapId] = map.id;
      if (!draft.maps[draft.startMapId]) {
        draft.startMapId = map.id;
        draft.startPos = { x: Math.floor(map.width / 2), y: Math.floor(map.height / 2) };
      }
    }

    draft.worldGraph = graph;
    const links: LinkResult[] = [];
    for (const edge of graph.edges) {
      if (edge.kind !== "transfer") continue;
      const link = linkMapsInDraft(draft, {
        from: endpointRecordFromEdge(edge.from),
        to: endpointRecordFromEdge(edge.to),
        bidirectional: true,
        fade: (args.fade as TransferFade | undefined) ?? "black",
        registerEdge: true,
      });
      links.push(link);
    }

    return {
      summary: `월드 빌드 완료 — 맵 생성 ${Object.keys(created).length}개/재사용 ${reused.length}개, transfer 연결 ${links.length}개`,
      data: { mapIds: Object.fromEntries(graph.nodes.map((node) => [node.mapId, node.mapId])), created, reused, links },
    };
  },
};

const lintWorldTool: ToolDefinition = {
  name: "lint_world",
  description: "worldGraph의 맵 참조, transfer 목적지, adjacent 경계 통행성 일관성을 검사한다.",
  mode: "read",
  parameters: { type: "object", properties: {} },
  run(project): ToolExecResult {
    const issues = lintWorldGraph(project);
    const errors = issues.filter((issue) => issue.severity === "error").length;
    const warnings = issues.filter((issue) => issue.severity === "warning").length;
    const infos = issues.filter((issue) => issue.severity === "info").length;
    return {
      summary: `world lint: error ${errors}건 / warning ${warnings}건 / info ${infos}건`,
      data: { counts: { errors, warnings, infos }, issues },
    };
  },
};

function linkMapsInDraft(
  draft: Project,
  options: {
    readonly from: JsonRecord;
    readonly to: JsonRecord;
    readonly bidirectional: boolean;
    readonly fade: TransferFade;
    readonly registerEdge: boolean;
  }
): LinkResult {
  const fromMap = requireMap(draft, stringField(options.from, "from.mapId"));
  const toMap = requireMap(draft, stringField(options.to, "to.mapId"));
  const fromExit = boundaryFromEndpoint(options.from, "from");
  const toEntry = entryFromEndpoint(options.to, "to");
  const gateA = gatePointForEndpoint(draft, fromMap, options.from, fromExit, "from");
  const gateB = gatePointForEndpoint(draft, toMap, options.to, toEntry, "to", fromExit ? oppositeBoundary(fromExit, fromMap) : undefined);
  const requestedLandingB = isPointRef(toEntry) ? toEntry : undefined;
  const landingB = requestedLandingB
    ? assertProvidedLanding(draft, toMap, requestedLandingB, gateB, "to.entry")
    : safeLanding(draft, toMap, gateB, "to");
  const landingA = options.bidirectional ? safeLanding(draft, fromMap, gateA, "from") : undefined;

  const idBase = `${fromMap.id}:${gateA.x},${gateA.y}->${toMap.id}:${gateB.x},${gateB.y}`;
  const eventIdA = stableId("ev_world_gate", idBase);
  const outcomeA = upsertEventIntoMap(fromMap, transferGateEvent(eventIdA, gateA, {
    kind: "transfer",
    mapId: toMap.id,
    x: landingB.x,
    y: landingB.y,
    fade: options.fade,
  }));
  let changedEvents = outcomeA === "added" ? 1 : 0;
  let eventIdB: string | undefined;
  if (options.bidirectional && landingA) {
    eventIdB = stableId("ev_world_gate", `${toMap.id}:${gateB.x},${gateB.y}->${fromMap.id}:${gateA.x},${gateA.y}`);
    const outcomeB = upsertEventIntoMap(toMap, transferGateEvent(eventIdB, gateB, {
      kind: "transfer",
      mapId: fromMap.id,
      x: landingA.x,
      y: landingA.y,
      fade: options.fade,
    }));
    if (outcomeB === "added") changedEvents += 1;
  }

  if (options.registerEdge) {
    upsertWorldTransferEdge(draft, {
      from: { mapId: fromMap.id, exit: fromExit ?? pointRect(gateA) },
      to: { mapId: toMap.id, entry: landingB },
      kind: "transfer",
    });
  }

  return { eventIdA, ...(eventIdB ? { eventIdB } : {}), gateA, gateB, landingA, landingB, changedEvents };
}

function normalizeGraphOrToolError(value: unknown): WorldGraph {
  try {
    return normalizeWorldGraph(value);
  } catch (cause) {
    throw new ToolError(cause instanceof Error ? cause.message : String(cause), { code: "world-graph-invalid" });
  }
}

function createRoleMap(project: Project, id: string, name: string, width: number, height: number, role: WorldGraphRole): GameMap {
  if (width < 3 || height < 3) throw new ToolError(`월드 맵 크기는 최소 3x3이어야 합니다: ${id}`, { code: "world-map-size", mapId: id });
  // build_world 는 노드 전체를 미리 검사하지만(assertPlanNodeSizes), 이 헬퍼로 들어오는 다른
  // 호출자가 생겨도 셀 배열 할당 전에 막히도록 여기서도 상한을 지킨다.
  assertWorldNodeSize(id, width, height);
  const size = width * height;
  const lowerTile = roleBaseTile(role);
  const map: GameMap = {
    id,
    name,
    width,
    height,
    tilesetId: role === "town" || role === "field" ? defaultOutdoorTilesetId(project) : COMBINED_TOWN_TILESET_ID,
    tileSize: DEFAULT_TILE_SIZE,
    lowerTiles: new Array<number>(size).fill(lowerTile),
    upperTiles: new Array<number>(size).fill(TILE.EMPTY),
    events: [],
  };
  if (role === "dungeon") map.defaultLighting = { ambient: DUNGEON_AMBIENT, color: "#05070a", sources: [] };
  return map;
}

function roleBaseTile(role: WorldGraphRole): number {
  switch (role) {
    case "dungeon": return TILE.DARK_GRASS;
    case "interior": return TILE.PATH;
    case "town":
    case "field":
      return TILE.GRASS;
  }
}

function assertWorldNodeSize(mapId: string, width: number, height: number): void {
  if (!exceedsMapDimensionLimit(width, height)) return;
  throw new ToolError(`${mapSizeLimitMessage()} — 초과 노드: ${mapId} (${width}×${height})`, {
    code: "map-too-large",
    mapId,
  });
}

/**
 * 계획 단계에서 노드 크기 힌트를 전부 검사한다.
 *
 * 왜 선행 검사인가: 노드를 돌면서 하나씩 만들면 초대형 노드 앞의 정상 노드는 이미 draft 에
 * 할당된다. 툴 실패가 draft 를 버리므로 프로젝트에 남지는 않지만, 실패 전에 수만 칸을 배열로
 * 잡는 낭비가 그대로다. 그리고 plan_world 는 맵을 만들지 않아도 build_world 가 그대로 읽는
 * 크기 힌트를 저장하므로, 같은 검사를 계획 등록에도 걸어야 "계획은 통과했는데 시공만 거부"로
 * 어긋나지 않는다(OPRN-OUT-018).
 */
function assertPlanNodeSizes(nodes: readonly BuildWorldNodeInput[]): void {
  for (const node of nodes) {
    const mapId = typeof node?.mapId === "string" ? node.mapId : "(mapId 없음)";
    assertWorldNodeSize(mapId, dimensionFromHint(node, "width"), dimensionFromHint(node, "height"));
  }
}

function dimensionFromHint(hint: BuildWorldNodeInput | undefined, key: "width" | "height"): number {
  const direct = hint?.[key];
  if (typeof direct === "number" && Number.isInteger(direct)) return direct;
  const size = hint?.size;
  if (size) {
    const value = key === "width" ? size.width ?? size.w : size.height ?? size.h;
    if (typeof value === "number" && Number.isInteger(value)) return value;
  }
  return DEFAULT_MAP_SIZE;
}

function addMapToTree(project: Project, mapId: string): void {
  if (!project.maps[project.mapTree.mapId]) {
    project.mapTree = { mapId, children: [] };
    return;
  }
  if (treeContains(project.mapTree, mapId)) return;
  appendToTree(project.mapTree, mapId);
}

function treeContains(node: Project["mapTree"], mapId: string): boolean {
  if (node.mapId === mapId) return true;
  return node.children.some((child) => treeContains(child, mapId));
}

function endpointRecordFromEdge(endpoint: { readonly mapId: string; readonly exit?: WorldGraphBoundary; readonly entry?: WorldGraphEntry }): JsonRecord {
  return {
    mapId: endpoint.mapId,
    ...(endpoint.exit ? { exit: endpoint.exit } : {}),
    ...(endpoint.entry ? { entry: endpoint.entry } : {}),
  };
}

function upsertWorldTransferEdge(draft: Project, edge: WorldGraphEdge): void {
  const current = draft.worldGraph ?? { nodes: [], edges: [] };
  const nodes = ensureGraphNodesForMaps(draft, current.nodes, [edge.from.mapId, edge.to.mapId]);
  const edges = [...current.edges];
  const existingIndex = edges.findIndex((entry) =>
    entry.kind === edge.kind && entry.from.mapId === edge.from.mapId && entry.to.mapId === edge.to.mapId
  );
  if (existingIndex >= 0) edges[existingIndex] = edge;
  else edges.push(edge);
  draft.worldGraph = normalizeGraphOrToolError({ nodes, edges });
}

function ensureGraphNodesForMaps(
  draft: Project,
  nodes: readonly WorldGraph["nodes"][number][],
  mapIds: readonly string[]
): WorldGraph["nodes"] {
  const byId = new Map(nodes.map((node) => [node.mapId, node]));
  for (const mapId of mapIds) {
    if (byId.has(mapId)) continue;
    byId.set(mapId, { mapId, role: "field", label: draft.maps[mapId]?.name ?? mapId });
  }
  return [...byId.values()];
}

function transferGateEvent(id: string, point: Point, target: Command): GameEvent {
  return {
    id,
    x: point.x,
    y: point.y,
    trigger: { kind: "playerTouch" },
    commands: [],
    pages: [
      {
        id: `${id}_page`,
        name: "월드 출입구",
        conditions: [],
        graphic: { transparent: true },
        trigger: { kind: "playerTouch" },
        priority: "below",
        overlapForbidden: false,
        movement: PASSIVE,
        commands: [target],
      },
    ],
  };
}

function gatePointForEndpoint(
  project: Project,
  map: GameMap,
  endpoint: JsonRecord,
  ref: WorldGraphBoundary | WorldGraphEntry | undefined,
  label: string,
  fallbackSide?: WorldGraphSide
): Point {
  if (typeof endpoint.x === "number" && typeof endpoint.y === "number") {
    const point = snapFlushToWall(project, map, endpoint.x, endpoint.y);
    assertPointInMap(map, point, label);
    return point;
  }
  if (ref && isPointRef(ref)) {
    const point = snapFlushToWall(project, map, ref.x, ref.y);
    assertPointInMap(map, point, label);
    return point;
  }
  if (ref && isSideRef(ref)) return sideCenter(map, ref.side);
  if (ref && isRectRef(ref)) return rectCenterOnBoundary(map, ref, label);
  if (fallbackSide) return sideCenter(map, fallbackSide);
  return { x: Math.floor(map.width / 2), y: Math.floor(map.height / 2) };
}

function boundaryFromEndpoint(endpoint: JsonRecord, label: string): WorldGraphBoundary | undefined {
  if (endpoint.exit !== undefined) return normalizeBoundary(`${label}.exit`, endpoint.exit);
  if (typeof endpoint.x === "number" && typeof endpoint.y === "number") return pointRect({ x: endpoint.x, y: endpoint.y });
  return undefined;
}

function entryFromEndpoint(endpoint: JsonRecord, label: string): WorldGraphEntry | undefined {
  if (endpoint.entry !== undefined) return normalizeEntry(`${label}.entry`, endpoint.entry);
  return undefined;
}

function safeLanding(project: Project, map: GameMap, gate: Point, label: string): Point {
  const first = passableLanding(project, map, gate.x, gate.y);
  if (first && !samePoint(first, gate) && !eventAt(map, first)) return first;
  const candidates: Point[] = [
    { x: gate.x, y: gate.y + 1 },
    { x: gate.x, y: gate.y - 1 },
    { x: gate.x + 1, y: gate.y },
    { x: gate.x - 1, y: gate.y },
  ];
  for (const candidate of candidates) {
    if (!inMapBounds(map, candidate.x, candidate.y)) continue;
    if (!isPassable(project, map, candidate.x, candidate.y)) continue;
    if (eventAt(map, candidate)) continue;
    return candidate;
  }
  throw new ToolError(`${label} 출입구 인접에 통행 가능하고 이벤트가 없는 착지 칸이 없습니다.`, {
    code: "transfer-no-landing",
    mapId: map.id,
    x: gate.x,
    y: gate.y,
  });
}

function assertProvidedLanding(project: Project, map: GameMap, point: Point, gate: Point, label: string): Point {
  assertPointInMap(map, point, label);
  if (samePoint(point, gate)) {
    throw new ToolError(`${label} 착지가 출입구 좌표와 겹칩니다.`, { code: "transfer-retrigger", mapId: map.id, x: point.x, y: point.y });
  }
  if (!isPassable(project, map, point.x, point.y)) {
    throw new ToolError(`${label} 착지가 통행 불가입니다: ${map.id} (${point.x}, ${point.y})`, { code: "transfer-impassable", mapId: map.id, x: point.x, y: point.y });
  }
  if (eventAt(map, point)) {
    throw new ToolError(`${label} 착지에 이벤트가 겹칩니다: ${map.id} (${point.x}, ${point.y})`, { code: "transfer-event-overlap", mapId: map.id, x: point.x, y: point.y });
  }
  return { x: point.x, y: point.y };
}

function sideCenter(map: GameMap, side: WorldGraphSide): Point {
  switch (side) {
    case "north": return { x: Math.floor(map.width / 2), y: 0 };
    case "south": return { x: Math.floor(map.width / 2), y: map.height - 1 };
    case "east": return { x: map.width - 1, y: Math.floor(map.height / 2) };
    case "west": return { x: 0, y: Math.floor(map.height / 2) };
  }
}

function rectCenterOnBoundary(map: GameMap, rect: { readonly x: number; readonly y: number; readonly w: number; readonly h: number }, label: string): Point {
  const point = { x: rect.x + Math.floor((rect.w - 1) / 2), y: rect.y + Math.floor((rect.h - 1) / 2) };
  assertPointInMap(map, point, label);
  return point;
}

function oppositeBoundary(boundary: WorldGraphBoundary, map: GameMap): WorldGraphSide | undefined {
  const side = isSideRef(boundary) ? boundary.side : sideForRect(map, boundary);
  if (!side) return undefined;
  switch (side) {
    case "north": return "south";
    case "south": return "north";
    case "east": return "west";
    case "west": return "east";
  }
}

function sideForRect(map: GameMap, rect: { readonly x: number; readonly y: number; readonly w: number; readonly h: number }): WorldGraphSide | undefined {
  if (rect.h === 1 && rect.y === 0) return "north";
  if (rect.h === 1 && rect.y + rect.h === map.height) return "south";
  if (rect.w === 1 && rect.x === 0) return "west";
  if (rect.w === 1 && rect.x + rect.w === map.width) return "east";
  return undefined;
}

function assertPointInMap(map: GameMap, point: Point, label: string): void {
  if (inMapBounds(map, point.x, point.y)) return;
  throw new ToolError(`${label} 좌표가 맵 밖입니다: ${map.id} (${point.x}, ${point.y})`, {
    code: "world-link-bounds",
    mapId: map.id,
    x: point.x,
    y: point.y,
  });
}

function eventAt(map: GameMap, point: Point): GameEvent | undefined {
  // 몸 사각으로 찾는다 — 2x2 이벤트의 비앵커 칸에 관문을 놓으면 몸통에 겹쳐 박힌다.
  return eventAtPoint(map, point.x, point.y);
}

function pointRect(point: Point) {
  return { x: point.x, y: point.y, w: 1, h: 1 };
}

function samePoint(a: Point, b: Point): boolean {
  return a.x === b.x && a.y === b.y;
}

function stableId(prefix: string, signature: string): string {
  return `${prefix}_${hashString(signature)}`;
}

function hashString(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function requireRecordArg(value: unknown, label: string): JsonRecord {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) return value as JsonRecord;
  throw new ToolError(`${label}는 객체여야 합니다.`, { code: "invalid-args" });
}

function requireRecordArray(value: unknown, label: string): JsonRecord[] {
  if (!Array.isArray(value)) throw new ToolError(`${label}는 배열이어야 합니다.`, { code: "invalid-args" });
  return value.map((entry, index) => requireRecordArg(entry, `${label}[${index}]`));
}

function stringField(record: JsonRecord, label: string): string {
  const key = label.split(".").at(-1) ?? label;
  const value = record[key];
  if (typeof value === "string" && value.trim().length > 0) return value.trim();
  throw new ToolError(`${label} 문자열이 필요합니다.`, { code: "invalid-args" });
}

export const WORLD_GRAPH_TOOLS: readonly ToolDefinition[] = [
  planWorld,
  linkMaps,
  buildWorld,
  lintWorldTool,
];
