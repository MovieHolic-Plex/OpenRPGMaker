// Assistant adapters for the same planners used by the terrain icon dock.
import { planTerrainDesign, type TerrainDesignOptions } from "@/editor/terrainDesignPlans";
import { planTerrainFeature } from "@/editor/terrainFeatures";
import { planReliefRamp } from "@/editor/reliefRampPlan";
import { planQuickHouse, quickHouseStyles, quickHouseStyleName, quickHouseKit, type QuickHouseOptions } from "@/editor/quickHouse";
import { inspectTerrainRoute, type TerrainRoutePoint } from "@/project/terrainRoute";
import { terrainHeight } from "@/project/terrainGameplay";
import { DEFAULT_TERRAIN_GAMEPLAY } from "@/project/terrainDesign";
import { structurePlacementsOf } from "@/project/structurePlacements";
import type { GameMap, Project } from "@/project/types";
import { requireMap } from "./mapHelpers";
import { ToolError, type JsonSchema, type ToolDefinition } from "./types";

const point: JsonSchema = { type: "object", properties: { x: { type: "integer", minimum: 0 }, y: { type: "integer", minimum: 0 } }, required: ["x", "y"], additionalProperties: false };
const mapId: JsonSchema = { type: "string" };
function checkedPoint(map: GameMap, value: unknown): TerrainRoutePoint {
  const p = value as TerrainRoutePoint;
  if (!p || !Number.isInteger(p.x) || !Number.isInteger(p.y) || p.x < 0 || p.y < 0 || p.x >= map.width || p.y >= map.height)
    throw new ToolError("좌표는 맵 안의 정수 칸이어야 합니다", { code: "invalid-args", mapId: map.id });
  return p;
}
function tilesetFor(project: Project, map: GameMap) {
  const ts = project.tilesets[map.tilesetId];
  if (!ts) throw new ToolError(`타일셋을 찾을 수 없습니다: ${map.tilesetId}`);
  return ts;
}
const designDefaults: TerrainDesignOptions = { symmetry: "none", areaShape: "polygon", width: 3, delta: 1, seed: 1,
  weights: [60, 30, 10], waterLevel: 0, maxDepth: 3, shallowWidth: 1, flattenRoad: false, unlock: false, density: 25 };
const designTool: ToolDefinition = {
  name: "design_terrain", mode: "write", domains: ["map", "tile"],
  description: "에디터 지형 설계 도구 그대로 절벽 윤곽·능선·계곡·호수·재질 혼합·군집·잠금을 저작한다. 높이는 delta로 현재 높이에 더한다(음수는 내림), 1·2·3 고지 프리셋 없음. contour/lake/lock은 polygon 점 3개 이상 또는 areaShape:rect의 대각점 2개. ridge/valley는 선 점 2개 이상. mix/mixedCluster는 점 1개 이상. 집터 평탄화는 sculpt_relief rect를 쓰고 집은 place_terrain_house로 놓는다. 기존 집은 피해 설계한다. 생성한 윤곽·능선·계곡·호수는 에디터 목록에서 재편집 가능하다.",
  parameters: { type: "object", properties: { mapId, tool: { type: "string", enum: ["contour", "ridge", "valley", "lake", "mix", "mixedCluster", "lock"] }, points: { type: "array", items: point },
    delta: { type: "integer", minimum: -14, maximum: 14 }, width: { type: "integer", minimum: 1, maximum: 24 },
    areaShape: { type: "string", enum: ["polygon", "rect", "line"] }, seed: { type: "integer" },
    symmetry: { type: "string", enum: ["none", "mirrorX", "mirrorY", "both", "rotate2", "rotate4"] },
    waterLevel: { type: "integer", minimum: 0, maximum: 14 }, maxDepth: { type: "integer", minimum: 1, maximum: 14 }, shallowWidth: { type: "integer", minimum: 0, maximum: 12 },
    density: { type: "integer", minimum: 0, maximum: 100 }, weights: { type: "array", items: { type: "integer", minimum: 0, maximum: 100 } }, unlock: { type: "boolean" }, editId: { type: "string" },
  }, required: ["mapId", "tool", "points"], additionalProperties: false },
  run(project, args) {
    const map = requireMap(project, args.mapId as string), ts = tilesetFor(project, map);
    const points = (args.points as unknown[]).map(p => checkedPoint(map, p));
    const { mapId: _id, tool, points: _points, editId, weights, ...settings } = args;
    if (weights !== undefined && (!Array.isArray(weights) || weights.length !== 3)) throw new ToolError("weights는 풀·흙·돌(군집은 나무·바위·덤불) 비중 세 개입니다");
    const options: TerrainDesignOptions = { ...designDefaults, ...settings, ...(weights ? { weights: weights as [number, number, number] } : {}) };
    const feature = ["contour", "ridge", "valley", "lake"].includes(String(tool));
    const shape = options.areaShape === "rect" && points.length === 2 ? [points[0]!, { x: points[1]!.x, y: points[0]!.y }, points[1]!, { x: points[0]!.x, y: points[1]!.y }] : points;
    if (editId && !feature) throw new ToolError("editId는 윤곽·능선·계곡·호수만 지원합니다");
    const plan = feature ? planTerrainFeature(map, ts, tool as "contour" | "ridge" | "valley" | "lake", points, options, typeof editId === "string" && editId ? editId : null)
      : planTerrainDesign(map, ts, tool as "mix" | "mixedCluster" | "lock", shape, options);
    if (!plan.ok || !plan.apply) throw new ToolError(plan.reason, { code: "terrain-placement", mapId: map.id });
    plan.apply(map);
    return { summary: plan.reason, data: { mapId: map.id, affectedCells: plan.indices.length, featureId: feature ? map.terrainDesign?.features?.at(-1)?.id : undefined } };
  },
};

const houseTool: ToolDefinition = {
  name: "place_terrain_house", mode: "write", domains: ["map", "tile"],
  description: "에디터의 집 도구로 버들항 집 외관 한 채를 조립한다. 벽 폭·층수와 지붕 폭을 별도로 정하며, 지붕만 넓힐 수 있다. anchor는 문 맨 아랫칸, 실제 문 앞은 (anchor.x,anchor.y+1). 집 전체+문 앞은 같은 높이의 평평한 빈 땅이어야 한다. 물·잠금·다른 집 위는 거부한다. 고지에는 먼저 sculpt_relief rect로 집터를 만들고 놓은 뒤 lay_terrain_road로 문 앞까지 연결하고 check_terrain_access로 검사한다. 스타일 목록은 inspect_terrain으로 조회. 이것은 외관 도구이며 실내와 문 이벤트는 생성하지 않는다.",
  parameters: { type: "object", properties: { mapId, anchor: point,
    style: { type: "string", description: "inspect_terrain의 houseStyles에서 고른 ID" }, width: { type: "integer", minimum: 5, maximum: 24 },
    stories: { type: "integer", enum: [1, 2] }, roofWidth: { type: "integer", minimum: 5, maximum: 24 }, kitId: { type: "string" },
  }, required: ["mapId", "anchor", "style", "width", "stories"], additionalProperties: false },
  run(project, args) {
    const map = requireMap(project, args.mapId as string), ts = tilesetFor(project, map), anchor = checkedPoint(map, args.anchor);
    if (!quickHouseStyles(ts).includes(args.style as QuickHouseOptions["style"])) throw new ToolError(`지원하는 집 스타일: ${quickHouseStyles(ts).join(", ")}`);
    const options: QuickHouseOptions = { style: args.style as QuickHouseOptions["style"], width: args.width as number,
      stories: args.stories as 1 | 2, ...(typeof args.roofWidth === "number" ? { roofWidth: args.roofWidth } : {}),
      ...(typeof args.kitId === "string" && args.kitId ? { kitId: args.kitId } : {}) };
    if (options.kitId && !ts.structureKits?.some(k => k.id === options.kitId)) throw new ToolError("kitId를 찾을 수 없습니다");
    const plan = planQuickHouse(map, ts, anchor, options);
    if (!plan.ok || !plan.apply || !plan.kit) throw new ToolError(plan.reason, { code: "terrain-house-placement", mapId: map.id });
    // The editor also registers generated kits. Keep the definition after SQLite reload for roof resizing.
    if (!ts.structureKits?.some(k => k.id === plan.kit!.id)) ts.structureKits = [...(ts.structureKits ?? []), plan.kit];
    plan.apply(map);
    return { summary: plan.reason, data: { kitId: plan.kit.id, x: plan.x, y: plan.y, width: plan.kit.width, height: plan.kit.height,
      level: terrainHeight(map, anchor.x, anchor.y), doorFront: { x: anchor.x, y: anchor.y + 1 }, placementId: map.structurePlacements?.at(-1)?.id } };
  },
};

const roadTool: ToolDefinition = {
  name: "lay_terrain_road", mode: "write", domains: ["map", "tile"],
  description: "에디터의 도로 드래그 도구로 꺾은 점들을 잇고, 절벽 접합에는 매끈한 경사로를 자동으로 만든다. 계단 코드나 절벽 타일을 찍지 않는다. 높이 차 앞에 곧은 접근로(단차+1칸)가 있어야 한다. 집 안이 아니라 반환받은 doorFront까지만 잇는다. flattenRoad:true는 첫 점 높이로 길 전체를 평탄화하므로 고지 연결에는 기본 false를 쓴다. 결과 reachable:false나 warnings면 완료가 아니다. 경로를 고쳐 재시도하고 check_terrain_access로 실제 canMove 통행을 검사한다. 기존 물체와 잠금은 보존한다.",
  parameters: { type: "object", properties: { mapId, points: { type: "array", items: point }, width: { type: "integer", minimum: 1, maximum: 12 }, flattenRoad: { type: "boolean" }, editId: { type: "string" } }, required: ["mapId", "points"], additionalProperties: false },
  run(project, args) {
    const map = requireMap(project, args.mapId as string), points = (args.points as unknown[]).map(p => checkedPoint(map, p));
    if (points.length < 2) throw new ToolError("도로 점은 두 개 이상 필요합니다");
    const width = typeof args.width === "number" ? args.width : 3;
    const plan = planTerrainFeature(map, tilesetFor(project, map), "road", points, { ...designDefaults, width, flattenRoad: args.flattenRoad === true }, typeof args.editId === "string" && args.editId ? args.editId : null);
    if (!plan.ok || !plan.apply) throw new ToolError(plan.reason, { code: "terrain-road-placement", mapId: map.id });
    plan.apply(map);
    const route = inspectTerrainRoute(project, map, points[0]!, points.at(-1)!, width);
    return { summary: `${plan.reason} · ${route.reason}`, ...(route.reachable ? {} : { warnings: ["실제 통행이 끊겼습니다. 경로를 수정하고 다시 검사하세요."] }),
      data: { reachable: route.reachable, blocked: route.blocked, featureId: map.terrainDesign?.features?.at(-1)?.id,
        rampCells: map.relief?.ramps?.filter(v => v >= 1 && v <= 4).length ?? 0 } };
  },
};

const rampTool: ToolDefinition = {
  name: "place_terrain_ramp", mode: "write", domains: ["map", "tile"],
  description: "에디터 경사로 도구 그대로 곧은 절벽 가장자리에 매끈한 경사로를 놓는다(계단 아님). at은 높이가 올라가는 쪽 가장자리의 칸. 네 방향을 자동 판정하고 폭 2·4·6칸, 길이=단차+1. 아래 접근 땅이 평평하고 비어 있어야 한다. 보통 lay_terrain_road의 자동 경사로를 먼저 쓰고 필요한 접합만 보완한다.",
  parameters: { type: "object", properties: { mapId, at: point, width: { type: "integer", enum: [2, 4, 6] } }, required: ["mapId", "at"], additionalProperties: false },
  run(project, args) {
    const map = requireMap(project, args.mapId as string), at = checkedPoint(map, args.at);
    const plan = planReliefRamp(map, { ...at, face: "top" }, typeof args.width === "number" ? args.width : 4, false);
    if (!plan.ok || !plan.apply) throw new ToolError(plan.reason, { code: "terrain-ramp-placement", mapId: map.id });
    plan.apply(map);
    return { summary: plan.reason, data: { rampCells: map.relief?.ramps?.filter(v => v >= 1 && v <= 4).length ?? 0 } };
  },
};

const inspectTool: ToolDefinition = {
  name: "inspect_terrain", mode: "read", domains: ["map", "tile"],
  description: "지형 도구의 실제 높이·매끈한 경사로/계단 수·시야 차단 설정·배치 집의 평탄성·문 앞 좌표·사용 가능한 기본 집 스타일을 읽는다. 집터가 전부 평평한지 확인하고 check_terrain_access로 아래 출발점부터 모든 문 앞까지 실제 통행을 검사한다. read_relief는 높이 행렬, show_map_region은 실제 화면 검수에 쓴다.",
  parameters: { type: "object", properties: { mapId }, required: ["mapId"] },
  run(project, args) {
    const map = requireMap(project, args.mapId as string), ts = tilesetFor(project, map);
    const houses = structurePlacementsOf(map).flatMap(p => {
      const kit = ts.structureKits?.find(k => k.id === p.kitId);
      const door = kit?.parts?.find(part => part.kind === "entrance");
      if (!door) return [];
      const doorFront = { x: p.x + door.dx, y: p.y + door.dy + door.h };
      const heights = new Set<number>();
      for (let y = p.y; y < p.y + p.h; y++) for (let x = p.x; x < p.x + p.w; x++) heights.add(terrainHeight(map, x, y));
      const level = terrainHeight(map, doorFront.x, doorFront.y);
      return [{ placementId: p.id, kitId: p.kitId, x: p.x, y: p.y, width: p.w, height: p.h, doorFront,
        level, flat: heights.size === 1 && heights.has(level), heights: [...heights] }];
    });
    const data = { mapId: map.id, tilesetId: map.tilesetId, maxHeight: Math.max(0, ...(map.relief?.levels ?? [])),
      rampCells: map.relief?.ramps?.filter(v => v >= 1 && v <= 4).length ?? 0, stairCells: map.relief?.ramps?.filter(v => v >= 5 && v <= 8).length ?? 0,
      gameplay: { ...DEFAULT_TERRAIN_GAMEPLAY, ...map.terrainDesign?.gameplay }, houses,
      houseStyles: quickHouseStyles(ts).map(id => ({ id, name: quickHouseStyleName(id), exampleSize: (() => { const kit = quickHouseKit(ts, { style: id, width: 9, stories: 1 }); return kit ? { width: kit.width, height: kit.height } : undefined; })() })),
      features: map.terrainDesign?.features?.map(f => ({ id: f.id, tool: f.tool, points: f.points })) ?? [] };
    return { summary: `고지 ${data.maxHeight}단 · 경사로 ${data.rampCells}칸 · 집 ${houses.length}채(평탄 ${houses.filter(h => h.flat).length}) · 시야 차단 ${data.gameplay.visionBlocking ? "켬" : "끔"}`, data };
  },
};

const accessTool: ToolDefinition = {
  name: "check_terrain_access", mode: "read", domains: ["map", "tile"],
  description: "에디터 경로 검사와 같은 실제 canMove/canMoveFootprint로 출발점에서 목적지 칸 자체까지 통행을 검사한다. 높이·경사로 옆벽·깊은 물·타일 충돌·선택한 몸 크기·이벤트를 반영한다. 문 칸은 막히므로 inspect_terrain의 doorFront들을 targets로 전달한다. 인접 도달만 검사하는 check_reachability와 목적지가 다르다. reachable:false면 완료를 말하지 말고 도로/경사로를 수정한다.",
  parameters: { type: "object", properties: { mapId, from: point, targets: { type: "array", items: point },
    width: { type: "integer", minimum: 1, maximum: 12 }, bodyWidth: { type: "integer", minimum: 1, maximum: 8 }, bodyHeight: { type: "integer", minimum: 1, maximum: 8 }, events: { type: "boolean" } }, required: ["mapId", "from", "targets"], additionalProperties: false },
  run(project, args) {
    const map = requireMap(project, args.mapId as string), from = checkedPoint(map, args.from), targets = (args.targets as unknown[]).map(p => checkedPoint(map, p));
    if (!targets.length) throw new ToolError("검사 목적지가 필요합니다");
    const bodyHeight = typeof args.bodyHeight === "number" ? args.bodyHeight : 1;
    const routes = targets.map(to => ({ target: to, ...inspectTerrainRoute(project, map, from, to, typeof args.width === "number" ? args.width : 1,
      { bodyWidth: typeof args.bodyWidth === "number" ? args.bodyWidth : 1, bodyHeight, passRows: bodyHeight, events: args.events !== false, doors: "authored", switches: {} }) }));
    const reachable = routes.every(r => r.reachable);
    return { summary: `실제 지형 통행: ${routes.filter(r => r.reachable).length}/${routes.length}곳 도달`, data: { reachable, routes } };
  },
};
export const TERRAIN_TOOLS: readonly ToolDefinition[] = [designTool, houseTool, roadTool, rampTool, inspectTool, accessTool];
