import { drawTerrainWater } from "@/player/terrainWater";
import { addTerrainVisionPreview } from "@/player/terrainVision";
import type { TerrainRouteOptions } from "@/project/terrainRoute";
import type Phaser from "phaser";
import type { GameMap, Project, TilesetDef } from "@/project/types";
import { cellLift, reliefLiftField } from "@/project/relief/screen";
import { mapTileSize } from "@/project/tileGeometry";
import { inspectTerrainRoute, type TerrainRouteResult } from "@/project/terrainRoute";
import type { EditorState } from "./editorState";
import { designOutline } from "./terrainDesignActions";
import { lineCells, polygonCells, symmetryVariants, transformPoint } from "./terrainDesignGeometry";
import { planQuickHouseDrag, quickHouseOptions } from "./quickHouse";
import { drawQuickHousePreview } from "./quickHousePreview";

const cache = new WeakMap<GameMap, { project: Project; tileset: TilesetDef; key: string; result: TerrainRouteResult }>();
export function terrainRouteResult(project: Project, map: GameMap, route: NonNullable<EditorState["terrainRoute"]>, width: number, state?: EditorState): TerrainRouteResult {
  const options: TerrainRouteOptions | undefined = state ? { bodyWidth:state.terrainRouteBody[0], bodyHeight:state.terrainRouteBody[1], passRows:state.terrainRouteBody[2], events:state.terrainRouteEvents, doors:state.terrainRouteDoors, doorId:state.terrainRouteDoorId, switches:state.terrainRouteSwitches } : undefined;
  const key = JSON.stringify(options) + `${route.start.x},${route.start.y}:${route.end.x},${route.end.y}:${width}`, tileset = project.tilesets[map.tilesetId]!, old = cache.get(map);
  if (old?.project === project && old.key === key && old.tileset === tileset) return old.result;
  const result = inspectTerrainRoute(project, map, route.start, route.end, width, options); cache.set(map, { project, tileset, key, result }); return result;
}
export function renderTerrainDesignOverlay(scene: Phaser.Scene, layer: Phaser.GameObjects.Container, project: Project, map: GameMap, state: EditorState): void {
  drawTerrainWater(scene,map,g=>layer.add(g));
  if (state.tool !== "relief") return;
  if (state.terrainBrush === "house" && !state.terrainVisionPreview && state.terrainHouseDrag?.mapId === map.id) {
    const tileset = project.tilesets[map.tilesetId];
    if (tileset) drawQuickHousePreview(scene, layer, map, tileset, planQuickHouseDrag(map, tileset, state.terrainHouseDrag, quickHouseOptions(state)));
  }
  const tileSize = mapTileSize(map, project.tilesets[map.tilesetId]), lift = map.relief ? reliefLiftField(map.relief) : null, g = scene.add.graphics();
  const cell = (x: number, y: number, color: number, alpha: number, outline = false) => { const Y = (y - (lift ? cellLift(lift, x, y) : 0)) * tileSize; g.fillStyle(color, alpha); g.fillRect(x * tileSize, Y, tileSize, tileSize); if (outline) { g.lineStyle(1, color, .9); g.strokeRect(x * tileSize + 1, Y + 1, tileSize - 2, tileSize - 2); } };
  if (state.terrainVisionPreview) {
    const origin=state.terrainVisionOrigin??project.startPos;
    addTerrainVisionPreview(scene,layer,map,project.tilesets[map.tilesetId],origin);
    cell(origin.x,origin.y,0x64e3a2,.8,true);
  }
  for (const i of map.terrainDesign?.lockedCells ?? []) { const x = i % map.width, y = Math.floor(i / map.width); cell(x, y, 0x9a78cf, .19, true); }
  if (state.terrainBrush === "lake") for (let i = 0; i < (map.terrainDesign?.waterDepth?.length ?? 0); i++) {
    const depth = map.terrainDesign!.waterDepth![i]!; if (depth === 1) cell(i % map.width, Math.floor(i / map.width), 0x6bdcd6, .18, true);
  }
  if (state.terrainSymmetry !== "none") {
    g.lineStyle(1, 0xe8c261, .6);
    if (["mirrorX", "both", "rotate2", "rotate4"].includes(state.terrainSymmetry)) { g.beginPath(); g.moveTo(map.width * tileSize / 2, 0); g.lineTo(map.width * tileSize / 2, map.height * tileSize); g.strokePath(); }
    if (["mirrorY", "both", "rotate2", "rotate4"].includes(state.terrainSymmetry)) { g.beginPath(); g.moveTo(0, map.height * tileSize / 2); g.lineTo(map.width * tileSize, map.height * tileSize / 2); g.strokePath(); }
  }
  if (state.terrainPoints?.mapId === map.id) {
    const points = designOutline(state), polygon = ["contour", "lake", "lock", "finish"].includes(state.terrainBrush) && state.terrainAreaShape !== "line";
    for (const variant of symmetryVariants(state.terrainSymmetry, map.width, map.height)) {
      const transformed = points.map(p => transformPoint(p, map.width, map.height, variant)), fill = polygon && transformed.length >= 3 ? polygonCells(transformed, map.width, map.height) : lineCells(transformed);
      for (const p of fill) cell(p.x, p.y, 0x4e9fe4, .2);
      for (const p of transformed) cell(p.x, p.y, 0x4e9fe4, .45, true);
    }
  }
  if (state.terrainRoute?.mapId === map.id) {
    const result = terrainRouteResult(project, map, state.terrainRoute, state.terrainRouteWidth, state);
    for (const p of result.path) cell(p.x, p.y, 0x4e9fe4, .48, true);
    for (const p of result.bottlenecks) cell(p.x, p.y, 0xe6a635, .7, true);
    for (const p of result.blocked) cell(p.x, p.y, 0xe34848, .65, true);
    for (const [p, color] of [[state.terrainRoute.start, 0x2fa765], [state.terrainRoute.end, 0x9756d9]] as const) cell(p.x, p.y, color, .8, true);
  }
  layer.add(g);
}
