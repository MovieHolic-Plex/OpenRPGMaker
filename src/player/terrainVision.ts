import type Phaser from "phaser";
import type { GameMap } from "@/project/types";
import { mapTileSize } from "@/project/tileGeometry";
import { terrainHeight, terrainVisibleCells } from "@/project/terrainGameplay";
interface VisionMask {
  image: Phaser.GameObjects.Image;
  texture: Phaser.Textures.CanvasTexture;
  textureKey: string;
  key: string;
  relief: GameMap["relief"];
  rules: unknown;
}
const masks = new WeakMap<Phaser.Scene, VisionMask>();
let serial = 0;
function dispose(scene: Phaser.Scene): void {
  const old = masks.get(scene);
  if (!old) return;
  old.image.destroy();
  scene.textures.remove(old.textureKey);
  masks.delete(scene);
}
/** Camera-sized fog. Front rows overwrite back rows, including transparent visible cells. */
export function syncTerrainVision(scene: Phaser.Scene, map: GameMap, x: number, y: number): void {
  const rules = map.terrainDesign?.gameplay;
  if (!rules?.visionBlocking && !rules?.highGroundVision) { dispose(scene); return; }
  const size = mapTileSize(map), camera = scene.cameras.main;
  const left = Math.max(0, Math.floor(camera.scrollX / size) - 2);
  const right = Math.min(map.width - 1, Math.ceil((camera.scrollX + camera.width / camera.zoom) / size) + 2);
  const top = Math.max(0, Math.floor(camera.scrollY / size) - 2);
  const bottom = Math.min(map.height - 1, Math.ceil((camera.scrollY + camera.height / camera.zoom) / size) + 16);
  const worldY = (Math.floor(camera.scrollY / size) - 16) * size;
  const width = Math.max(1, (right - left + 1) * size);
  const height = Math.max(1, Math.ceil(camera.height / camera.zoom) + 34 * size);
  const key = `${map.id}:${x}:${y}:${left},${top},${right},${bottom},${worldY}`;
  let state = masks.get(scene);
  if (state?.key === key && state.relief === map.relief && state.rules === rules) return;
  if (state && (state.texture.canvas.width !== width || state.texture.canvas.height !== height)) { dispose(scene); state = undefined; }
  if (!state) {
    const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
    const textureKey = `terrain-vision-${++serial}`, texture = scene.textures.addCanvas(textureKey, canvas);
    if (!texture) return;
    texture.setFilter(0);
    const image = scene.add.image(0, 0, textureKey).setOrigin(0).setDepth(400_000);
    state = { image, texture, textureKey, key: "", relief: undefined, rules: undefined }; masks.set(scene, state);
    // Attach once per scene; size changes only replace the texture.
    if (!scene.data.get("terrainVisionCleanup")) {
      scene.data.set("terrainVisionCleanup", true);
      scene.events.once("shutdown", () => { dispose(scene); scene.data.remove("terrainVisionCleanup"); });
    }
  }
  state.key = key; state.relief = map.relief; state.rules = rules;
  const visible = terrainVisibleCells(map, { x, y }), context = state.texture.context;
  context.clearRect(0, 0, width, height); context.fillStyle = "rgba(7,14,24,0.88)";
  for (let Y = top; Y <= bottom; Y++) for (let X = left; X <= right; X++) {
    const lift = terrainHeight(map, X, Y), px = (X - left) * size, py = (Y - lift) * size - worldY;
    const south = Y + 1 < map.height ? terrainHeight(map, X, Y + 1) : 0;
    const span = size * Math.max(1, 1 + lift - south);
    // A visible foreground must clear a hidden background's projected mask.
    context.clearRect(px, py, size, span);
    if (!visible.has(Y * map.width + X)) context.fillRect(px, py, size, span);
  }
  // The observed player remains readable above a neighboring cell's fog.
  const feet = (y + 1 - terrainHeight(map, x, y)) * size - worldY;
  context.clearRect((x - left) * size - 2, feet - size * 2, size + 4, size * 2);
  state.texture.refresh(); state.image.setPosition(left * size, worldY);
}
