import type Phaser from "phaser";
import type { GameMap, TilesetDef } from "@/project/types";
import { mapTileSize } from "@/project/tileGeometry";
import { terrainVisibleCells, type TerrainSightPoint } from "@/project/terrainGameplay";
import { paintTerrainVision, terrainVisionWindow } from "./terrainVisionRaster";
interface VisionMask {
  image: Phaser.GameObjects.Image; texture: Phaser.Textures.CanvasTexture; textureKey: string;
  key: string; map: GameMap; tileset?: TilesetDef; visible: Set<number>;
}
interface VisionActor { active: boolean; visible: boolean }
interface Actors { eventSprites?: Map<string, Phaser.GameObjects.Sprite>; eventPositions?: Record<string, TerrainSightPoint>; characterShadows?: Map<string, VisionActor> }
const masks = new WeakMap<Phaser.Scene, VisionMask>();
const hidden = new WeakMap<Phaser.Scene, VisionActor[]>();
let serial = 0;
function restoreActors(scene: Phaser.Scene): void {
  for (const sprite of hidden.get(scene) ?? []) if (sprite.active) sprite.visible = true;
  hidden.delete(scene);
}
function dispose(scene: Phaser.Scene): void {
  restoreActors(scene); const old = masks.get(scene); if (!old) return;
  old.image.destroy(); scene.textures.remove(old.textureKey); masks.delete(scene);
  scene.data.remove("terrainVisibleCells"); scene.data.remove("terrainVisionHiddenCount");
}
/** Display-only visibility: restore after rendering, preserving authored page visibility and game state. */
function bindActors(scene: Phaser.Scene): void {
  if (scene.data.get("terrainVisionCleanup")) return;
  scene.data.set("terrainVisionCleanup", true);
  const before = () => {
    restoreActors(scene); const state = masks.get(scene); if (!state) return;
    const actors = scene as Phaser.Scene & Actors, changed: VisionActor[] = [];
    for (const [id, sprite] of actors.eventSprites ?? []) {
      const point = actors.eventPositions?.[id] ?? state.map.events.find(e => e.id === id);
      if (point && !terrainRuntimeSees(scene, point)) {
        if (sprite.visible) { sprite.visible = false; changed.push(sprite); }
        const shadow = actors.characterShadows?.get(id); if (shadow?.visible) { shadow.visible = false; changed.push(shadow); }
      }
    }
    hidden.set(scene, changed); scene.data.set("terrainVisionHiddenCount", changed.length);
  };
  const after = () => restoreActors(scene);
  scene.events.on("postupdate", before); scene.events.on("render", after);
  scene.events.once("shutdown", () => { dispose(scene); scene.events.off("postupdate", before); scene.events.off("render", after); scene.data.remove("terrainVisionCleanup"); });
}
export function terrainRuntimeSees(scene: Phaser.Scene, point: TerrainSightPoint): boolean {
  const state = masks.get(scene); return !state || state.visible.has(Math.floor(point.y) * state.map.width + Math.floor(point.x));
}
/** OFF removes all fog, including radius clipping. High-ground range remains an independent NPC rule. */
export function syncTerrainVision(scene: Phaser.Scene, map: GameMap, x: number, y: number, tileset?: TilesetDef): void {
  if (!map.terrainDesign?.gameplay?.visionBlocking) { dispose(scene); return; }
  const size = mapTileSize(map), view = terrainVisionWindow(map, size, scene.cameras.main);
  const key = `${x}:${y}:${view.left},${view.top},${view.right},${view.bottom},${view.worldY}`;
  let state = masks.get(scene);
  if (state?.key === key && state.map === map && state.tileset === tileset) return;
  if (state && (state.texture.canvas.width !== view.width || state.texture.canvas.height !== view.height)) { dispose(scene); state = undefined; }
  const visible = terrainVisibleCells(map, { x, y }, tileset);
  if (!state) {
    const canvas = document.createElement("canvas"); canvas.width = view.width; canvas.height = view.height;
    const textureKey = `terrain-vision-${++serial}`, texture = scene.textures.addCanvas(textureKey, canvas); if (!texture) return;
    texture.setFilter(0); const image = scene.add.image(0, 0, textureKey).setOrigin(0).setDepth(400_000);
    state = { image, texture, textureKey, key, map, tileset, visible }; masks.set(scene, state); bindActors(scene);
  }
  state.key = key; state.map = map; state.tileset = tileset; state.visible = visible;
  paintTerrainVision(state.texture.context, map, size, visible, view, { x, y });
  state.texture.refresh(); state.image.setPosition(view.left * size, view.worldY); scene.data.set("terrainVisibleCells", visible);
}
/** The editor uses the exact same raster geometry, clipped to its camera rather than the entire map. */
export function addTerrainVisionPreview(scene: Phaser.Scene, layer: Phaser.GameObjects.Container, map: GameMap, tileset: TilesetDef | undefined, origin: TerrainSightPoint): void {
  if (!map.terrainDesign?.gameplay?.visionBlocking) return;
  const size = mapTileSize(map), view = terrainVisionWindow(map, size, scene.cameras.main), canvas = document.createElement("canvas");
  canvas.width = view.width; canvas.height = view.height; const context = canvas.getContext("2d"); if (!context) return;
  paintTerrainVision(context, map, size, terrainVisibleCells(map, origin, tileset), view);
  const key = `terrain-vision-preview-${++serial}`, texture = scene.textures.addCanvas(key, canvas); if (!texture) return;
  texture.setFilter(0); const image = scene.add.image(view.left * size, view.worldY, key).setOrigin(0); layer.add(image);
  image.once("destroy", () => scene.textures.remove(key));
}
