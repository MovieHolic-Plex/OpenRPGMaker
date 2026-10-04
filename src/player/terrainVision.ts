import type Phaser from "phaser";
import type { GameMap, TilesetDef } from "@/project/types";
import { mapTileSize } from "@/project/tileGeometry";
import { terrainVisibleCells, type TerrainSightPoint } from "@/project/terrainGameplay";
import { paintTerrainVision, terrainVisionWindow, type TerrainVisionWindow } from "./terrainVisionRaster";
import { createTerrainVisionBlend, setTerrainVisionTarget, advanceTerrainVisionBlend, type TerrainVisionBlend } from "./terrainVisionTransition";
interface VisionMask {
  image: Phaser.GameObjects.Image; texture: Phaser.Textures.CanvasTexture; textureKey: string;
  key: string; map: GameMap; tileset?: TilesetDef; visible: Set<number>; view: TerrainVisionWindow; blend: TerrainVisionBlend; off: boolean;
}
interface VisionActor { active: boolean; visible: boolean; alpha: number }
interface ActorRestore { actor: VisionActor; visible: boolean; alpha: number }
interface Actors { eventSprites?: Map<string, Phaser.GameObjects.Sprite>; eventPositions?: Record<string, TerrainSightPoint>; characterShadows?: Map<string, VisionActor> }
const masks = new WeakMap<Phaser.Scene, VisionMask>();
const previews = new WeakMap<Phaser.Scene, VisionMask>();
const modified = new WeakMap<Phaser.Scene, ActorRestore[]>();
let serial = 0;
function restoreActors(scene: Phaser.Scene): void {
  for (const { actor, visible, alpha } of modified.get(scene) ?? []) if (actor.active) { actor.visible = visible; actor.alpha = alpha; }
  modified.delete(scene);
}
function dispose(scene: Phaser.Scene): void {
  restoreActors(scene); const old = masks.get(scene); if (!old) return;
  old.image.destroy(); scene.textures.remove(old.textureKey); masks.delete(scene);
  scene.data.remove("terrainVisibleCells"); scene.data.remove("terrainVisionHiddenCount");
}
/** Fade only the rendering; AI visibility and authored sprite alpha keep their existing meanings. */
function bindActors(scene: Phaser.Scene): void {
  if (scene.data.get("terrainVisionCleanup")) return;
  scene.data.set("terrainVisionCleanup", true);
  const opacity = new Map<string, number>(); let lastTime = scene.time.now;
  const before = () => {
    restoreActors(scene); const state = masks.get(scene), now = scene.time.now, step = 1 - Math.exp(-Math.max(0, now - lastTime) / 80); lastTime = now;
    if (!state) return;
    const actors = scene as Phaser.Scene & Actors, changed: ActorRestore[] = [], present = new Set<string>();
    for (const [id, sprite] of actors.eventSprites ?? []) {
      present.add(id);
      const point = actors.eventPositions?.[id] ?? state.map.events.find(e => e.id === id);
      const target = !point || terrainRuntimeSees(scene, point) ? 1 : 0;
      let alpha = opacity.get(id) ?? target; alpha += (target - alpha) * step;
      if (Math.abs(alpha - target) < .01) alpha = target;
      opacity.set(id, alpha);
      for (const actor of [sprite, actors.characterShadows?.get(id)]) if (actor?.visible && alpha < 1) {
        changed.push({ actor, visible: actor.visible, alpha: actor.alpha }); actor.alpha *= alpha;
        if (alpha === 0) actor.visible = false;
      }
    }
    for (const id of opacity.keys()) if (!present.has(id)) opacity.delete(id);
    modified.set(scene, changed); scene.data.set("terrainVisionHiddenCount", changed.filter(v => !v.actor.visible).length);
  };
  const after = () => restoreActors(scene);
  scene.events.on("postupdate", before); scene.events.on("render", after);
  scene.events.once("shutdown", () => { dispose(scene); scene.events.off("postupdate", before); scene.events.off("render", after); scene.data.remove("terrainVisionCleanup"); });
}
export function terrainRuntimeSees(scene: Phaser.Scene, point: TerrainSightPoint): boolean {
  const state = masks.get(scene); return !state || state.off || state.visible.has(Math.floor(point.y) * state.map.width + Math.floor(point.x));
}
export function terrainPreviewSees(scene: Phaser.Scene, map: GameMap, point: TerrainSightPoint): boolean {
  const preview = previews.get(scene);
  return preview?.map !== map || preview.visible.has(Math.floor(point.y) * map.width + Math.floor(point.x));
}
function viewKey(origin: TerrainSightPoint, view: TerrainVisionWindow): string { return `${origin.x}:${origin.y}:${view.left},${view.top},${view.right},${view.bottom},${view.worldY}`; }
function updateTarget(state: VisionMask, scene: Phaser.Scene, map: GameMap, tileset: TilesetDef | undefined, origin: TerrainSightPoint, view: TerrainVisionWindow, player: boolean): void {
  const size = mapTileSize(map), visible = terrainVisibleCells(map, origin, tileset);
  setTerrainVisionTarget(state.blend, scene.time.now, c => paintTerrainVision(c, map, size, visible, view, player ? origin : undefined), (state.view.left - view.left) * size, state.view.worldY - view.worldY);
  state.key = viewKey(origin, view); state.map = map; state.tileset = tileset; state.visible = visible; state.view = view; state.off = false;
}
/** The OFF toggle releases gameplay visibility immediately and fades out the remaining screen fog. */
export function syncTerrainVision(scene: Phaser.Scene, map: GameMap, x: number, y: number, tileset?: TilesetDef): void {
  let state = masks.get(scene);
  if (!map.terrainDesign?.gameplay?.visionBlocking) {
    if (!state) return;
    if (!state.off) { state.off = true; setTerrainVisionTarget(state.blend, scene.time.now, () => {}); }
    scene.data.remove("terrainVisibleCells");
    if (advanceTerrainVisionBlend(state.blend, scene.time.now)) state.texture.refresh();
    if (!state.blend.running) dispose(scene);
    return;
  }
  const size = mapTileSize(map), view = terrainVisionWindow(map, size, scene.cameras.main), origin = { x, y }, key = viewKey(origin, view);
  if (state && (state.map !== map || state.blend.canvas.width !== view.width || state.blend.canvas.height !== view.height)) { dispose(scene); state = undefined; }
  if (!state) {
    const blend = createTerrainVisionBlend(view.width, view.height), textureKey = `terrain-vision-${++serial}`, texture = scene.textures.addCanvas(textureKey, blend.canvas); if (!texture) return;
    texture.setFilter(1); const image = scene.add.image(0, 0, textureKey).setOrigin(0).setDepth(400_000);
    state = { image, texture, textureKey, key: "", map, tileset, visible: new Set(), view, blend, off: false }; masks.set(scene, state); bindActors(scene);
  }
  if (state.key !== key || state.tileset !== tileset || state.off) {
    updateTarget(state, scene, map, tileset, origin, view, true); state.image.setPosition(view.left * size, view.worldY); scene.data.set("terrainVisibleCells", state.visible);
  }
  if (advanceTerrainVisionBlend(state.blend, scene.time.now)) state.texture.refresh();
}
function bindPreview(scene: Phaser.Scene): void {
  if (scene.data.get("terrainPreviewCleanup")) return;
  scene.data.set("terrainPreviewCleanup", true);
  const update = () => {
    const preview = previews.get(scene); if (!preview) return;
    if (!preview.image.active) { previews.delete(scene); return; }
    if (advanceTerrainVisionBlend(preview.blend, scene.time.now)) {
      preview.texture.context.clearRect(0, 0, preview.view.width, preview.view.height); preview.texture.context.drawImage(preview.blend.canvas, 0, 0); preview.texture.refresh();
    }
  };
  scene.events.on("update", update);
  scene.events.once("shutdown", () => { previews.delete(scene); scene.events.off("update", update); scene.data.remove("terrainPreviewCleanup"); });
}
/** The editor shares the feathered silhouette and transition, including redraws while a fade is in progress. */
export function addTerrainVisionPreview(scene: Phaser.Scene, layer: Phaser.GameObjects.Container, map: GameMap, tileset: TilesetDef | undefined, origin: TerrainSightPoint): void {
  if (!map.terrainDesign?.gameplay?.visionBlocking) return;
  const size = mapTileSize(map), view = terrainVisionWindow(map, size, scene.cameras.main), key = viewKey(origin, view);
  let state = previews.get(scene);
  if (state && (state.map !== map || state.blend.canvas.width !== view.width || state.blend.canvas.height !== view.height)) state = undefined;
  const blend = state?.blend ?? createTerrainVisionBlend(view.width, view.height), canvas = document.createElement("canvas"); canvas.width = view.width; canvas.height = view.height;
  const textureKey = `terrain-vision-preview-${++serial}`, texture = scene.textures.addCanvas(textureKey, canvas); if (!texture) return;
  texture.setFilter(1); const image = scene.add.image(view.left * size, view.worldY, textureKey).setOrigin(0); layer.add(image);
  image.once("destroy", () => scene.textures.remove(textureKey));
  if (state) { state.image = image; state.texture = texture; state.textureKey = textureKey; }
  else state = { image, texture, textureKey, key: "", map, tileset, visible: new Set(), view, blend, off: false };
  if (state.key !== key || state.tileset !== tileset) updateTarget(state, scene, map, tileset, origin, view, false);
  advanceTerrainVisionBlend(blend, scene.time.now); texture.context.drawImage(blend.canvas, 0, 0); texture.refresh();
  previews.set(scene, state); bindPreview(scene);
}
