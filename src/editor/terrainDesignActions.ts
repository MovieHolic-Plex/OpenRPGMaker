import { editorState, type EditorState, type TerrainDesignTool } from "./editorState";
import { store } from "@/project/store";
import { recordMapEditIfChanged } from "./mapEditHistory";
import { planTerrainDesign, type TerrainDesignOptions, type TerrainDesignPlan } from "./terrainDesignPlans";
import { captureTerrainStamp, planTerrainStamp, symmetricStampPlacement } from "./terrainStamps";
import { symmetryVariants, type TerrainPoint } from "./terrainDesignGeometry";
import { toast } from "@/util/toast";

export const TERRAIN_DESIGN_TOOLS: readonly [TerrainDesignTool, string][] = [["contour", "절벽 윤곽"], ["road", "길"], ["ridge", "능선"], ["valley", "계곡"], ["lake", "호수·해안"], ["mix", "재질 혼합"], ["mixedCluster", "혼합 군집"], ["stamp", "지형 도장"], ["lock", "영역 잠금"], ["route", "경로 검사"]];
export function isTerrainDesignTool(tool: EditorState["terrainBrush"]): tool is TerrainDesignTool { return TERRAIN_DESIGN_TOOLS.some(([key]) => key === tool); }
export function terrainDesignOptions(s = editorState.get()): TerrainDesignOptions {
  return { symmetry: s.terrainSymmetry, areaShape: s.terrainAreaShape, width: s.terrainWidth, delta: s.terrainDelta, seed: s.terrainSeed, weights: s.terrainMixWeights, waterLevel: s.terrainLakeLevel, maxDepth: s.terrainLakeDepth, shallowWidth: s.terrainShallowWidth, flattenRoad: s.terrainRoadFlatten, unlock: s.terrainUnlock, density: s.reliefClusterDensity };
}
export function designOutline(s: EditorState): TerrainPoint[] {
  const points = s.terrainPoints?.mapId === s.currentMapId ? s.terrainPoints.points : [];
  if (s.terrainAreaShape !== "rect" || points.length < 2 || !["contour", "lake", "lock"].includes(s.terrainBrush)) return points;
  const a = points[0]!, b = points[1]!;
  return [a, { x: b.x, y: a.y }, b, { x: a.x, y: b.y }];
}
export function applyTerrainDesignPlan(mapId: string, plan: TerrainDesignPlan, label: string): boolean {
  if (!plan.ok || !plan.apply) { toast(plan.reason, "info"); return false; }
  const map = store.getCurrent().maps[mapId]; if (!map) return false;
  const cells = plan.indices.flatMap(i => [{ x: i % map.width, y: Math.floor(i / map.width), layer: "lower" as const }, { x: i % map.width, y: Math.floor(i / map.width), layer: "upper" as const }]);
  recordMapEditIfChanged(mapId, () => store.updateMapTiles(mapId, plan.apply!, { label, relief: true, cells }));
  return true;
}
export function commitTerrainDesign(): void {
  const s = editorState.get(), mapId = s.currentMapId, map = mapId ? store.getCurrent().maps[mapId] : undefined;
  if (!map || !mapId || !isTerrainDesignTool(s.terrainBrush) || ["stamp", "route"].includes(s.terrainBrush)) return;
  const tileset = store.getCurrent().tilesets[map.tilesetId]; if (!tileset) return;
  const plan = planTerrainDesign(map, tileset, s.terrainBrush as Exclude<TerrainDesignTool, "stamp" | "route">, designOutline(s), terrainDesignOptions(s));
  if (applyTerrainDesignPlan(mapId, plan, TERRAIN_DESIGN_TOOLS.find(([key]) => key === s.terrainBrush)![1])) { editorState.set({ terrainPoints: null }); toast(plan.reason, "info"); }
}
export function selectTerrainDesignTool(tool: TerrainDesignTool): void {
  editorState.set({ terrainBrush: tool, terrainDesignOpen: true, terrainPoints: null, reliefDoodad: null, reliefDoodadOpen: false, reliefBridgeStart: null, terrainMoveGroup: false, ...(tool === "route" ? { terrainRoute: null } : {}), ...(tool === "lake" || tool === "lock" ? { terrainAreaShape: "polygon" as const } : {}) });
}
export function handleTerrainDesignPointer(mapId: string, point: TerrainPoint, first: boolean, right: boolean): void {
  const s = editorState.get(), map = store.getCurrent().maps[mapId]; if (!map || !isTerrainDesignTool(s.terrainBrush)) return;
  if (right) { editorState.set({ terrainPoints: null }); return; }
  if (!first || point.x < 0 || point.y < 0 || point.x >= map.width || point.y >= map.height) return;
  const tileset = store.getCurrent().tilesets[map.tilesetId]; if (!tileset) return;
  if (s.terrainBrush === "mix" || s.terrainBrush === "mixedCluster") {
    const plan = planTerrainDesign(map, tileset, s.terrainBrush, [point], terrainDesignOptions(s));
    applyTerrainDesignPlan(mapId, plan, s.terrainBrush === "mix" ? "재질 혼합" : "혼합 군집"); return;
  }
  if (s.terrainBrush === "stamp" && !s.terrainStampCapture) {
    const stamp = store.getCurrent().terrainStamps?.find(stamp => stamp.id === s.terrainStampId);
    if (!stamp) { toast("도장을 먼저 저장하거나 목록에서 고르세요", "info"); return; }
    // All symmetric placements share one history step; plan sequentially against the latest map.
    recordMapEditIfChanged(mapId, () => {
      const placed = new Set<string>();
      for (const variant of symmetryVariants(s.terrainSymmetry, map.width, map.height)) {
        const current = store.getCurrent().maps[mapId]!, { anchor, rotation, mirror } = symmetricStampPlacement(stamp, point, s.terrainStampRotation, s.terrainStampMirror, variant, map.width, map.height);
        const key = `${anchor.x},${anchor.y},${rotation},${mirror}`;
        if (placed.has(key)) continue;
        placed.add(key);
        const plan = planTerrainStamp(current, tileset, stamp, anchor, rotation, mirror);
        if (!plan.ok || !plan.apply) { toast(plan.reason, "info"); continue; }
        // Autotile fringe is included in the annotation.
        const cells = plan.indices.flatMap(i => [{ x: i % map.width, y: Math.floor(i / map.width), layer: "lower" as const }, { x: i % map.width, y: Math.floor(i / map.width), layer: "upper" as const }]);
        store.updateMapTiles(mapId, plan.apply, { label: "지형 도장 배치", relief: true, cells });
      }
    }); return;
  }
  const points = s.terrainPoints?.mapId === mapId ? s.terrainPoints.points : [];
  if (points.length >= 256) { toast("외곽 점은 최대 256개입니다. 적용 후 이어 그리세요", "info"); return; }
  if (points.length >= 3 && point.x === points[0]!.x && point.y === points[0]!.y) { commitTerrainDesign(); return; }
  const next = [...points, point]; editorState.set({ terrainPoints: { mapId, points: next } });
  if (s.terrainBrush === "route" && next.length === 2) { editorState.set({ terrainRoute: { mapId, start: next[0]!, end: next[1]! }, terrainPoints: null }); return; }
  if (s.terrainBrush === "stamp" && next.length === 2) {
    try {
      const stamp = captureTerrainStamp(map, next[0]!, next[1]!, s.terrainStampName);
      store.update(project => { project.terrainStamps = [...(project.terrainStamps ?? []), stamp]; }, { scope: "project", label: "지형 도장 저장" });
      editorState.set({ terrainStampId: stamp.id, terrainStampCapture: false, terrainPoints: null }); toast(`${stamp.name} 저장 · ${stamp.width}×${stamp.height}칸`, "info");
    } catch (e) { editorState.set({ terrainPoints: null }); toast((e as Error).message, "info"); }
  }
}
