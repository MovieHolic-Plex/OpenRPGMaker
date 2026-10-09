import type Phaser from "phaser";
import { sunlightField, normalizeSunlight, type SunlightField } from "@/project/sunlight";
import { mapTileSize } from "@/project/tileGeometry";
import type { GameMap, TilesetDef } from "@/project/types";
import { ensureTilesetTexture } from "@/editor/tilesetImage";
import { canvasSunlightArt } from "@/project/sunlightArtCanvas";
import type { SunlightArtSource } from "@/project/sunlightArt";
import { reliefReadSignature } from "@/project/relief/screen";

const instances = new WeakMap<object, SunlightLayer>();
let serial = 0;
interface Patch { image: Phaser.GameObjects.Image; texture: string }

/** Canvas batchSprite grows rounded images by half a source pixel. A 4x mask then
 * shifts its opaque rows by two world pixels, opening a stripe between receivers.
 * Mask coordinates already align to the world pixel grid; preserve their exact extent. */
function renderShadowCanvas(renderer: Phaser.Renderer.Canvas.CanvasRenderer, image: Phaser.GameObjects.Image,
  camera: Phaser.Cameras.Scene2D.Camera, parent?: Phaser.GameObjects.Components.TransformMatrix): void {
  camera.addToRenderList(image);
  const rounded = camera.roundPixels;
  camera.roundPixels = false;
  try { renderer.batchSprite(image, image.frame, camera, parent); }
  finally { camera.roundPixels = rounded; }
}

/** Cached world-anchored receiver masks. Work is budgeted; unchanged frames only compare small inputs. */
export class SunlightLayer {
  private readonly patches = new Map<number, Patch>();
  private readonly wanted = new Set<number>();
  private pending: number[] = [];
  private map: GameMap | undefined;
  private tileset: TilesetDef | undefined;
  private inputKey = "";
  private viewKey = "";
  private field: SunlightField | null = null;
  private artSource: SunlightArtSource | undefined;
  private readonly prefix = `sunlight-${serial++}-`;
  readonly counts = { builds: 0, frames: 0, pending: 0 };

  constructor(private readonly scene: Phaser.Scene, private readonly options: {
    /** Editor masks occupy their own container above tile art and below editor chrome. */
    container?: Phaser.GameObjects.Container;
    depthOf(row: number, tileSize: number): number;
  }) {
    instances.set(scene, this);
    scene.events.once("shutdown", () => this.destroy());
  }

  sync(map: GameMap | undefined, tileset: TilesetDef | undefined): boolean {
    const params = normalizeSunlight(map?.sunlight);
    if (!map || !params.enabled || params.opacity === 0) {
      if (this.map || this.patches.size) this.clear();
      this.map = undefined; this.field = null; this.artSource = undefined;
      return false;
    }
    const key = `${JSON.stringify(params)}|${reliefReadSignature(map.relief)}`;
    if (this.map !== map || this.tileset !== tileset || this.inputKey !== key || (!this.artSource && tileset)) {
      this.clear(); this.map = map; this.tileset = tileset; this.inputKey = key;
      this.artSource = undefined;
      if (tileset) {
        const textureKey = ensureTilesetTexture(this.scene, tileset);
        if (this.scene.textures.exists(textureKey)) {
          const image = this.scene.textures.get(textureKey).getSourceImage() as CanvasImageSource;
          this.artSource = canvasSunlightArt(image, tileset.tileSize, tileset.tilesPerRow);
        }
      }
      this.field = sunlightField(map, tileset, this.artSource); this.counts.builds++;
    }
    const field = this.field;
    const view = this.scene.cameras.main.worldView;
    if (!field || view.width <= 0 || view.height <= 0) return false;
    const tileSize = mapTileSize(map, tileset), columns = Math.ceil(map.width / 16);
    const minX = Math.max(0, Math.floor(view.x / tileSize / 16));
    const maxX = Math.min(columns - 1, Math.floor((view.x + view.width) / tileSize / 16));
    const minY = Math.max(0, Math.floor(view.y / tileSize) - 1);
    const maxY = Math.min(map.height - 1, Math.ceil((view.y + view.height) / tileSize + field.maxTerrain) + 1);
    const viewKey = `${minX},${maxX},${minY},${maxY},${tileSize}`;
    if (this.viewKey !== viewKey) {
      this.viewKey = viewKey; this.wanted.clear(); this.pending = [];
      for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
        const index = y * columns + x; this.wanted.add(index);
        if (!this.patches.has(index)) this.pending.push(index);
      }
      for (const [index, p] of this.patches) {
        p.image.setVisible(this.wanted.has(index));
        // Keep only a small offscreen margin; returning to a distant area rebuilds its masks.
        if (!this.wanted.has(index) && this.patches.size > this.wanted.size + 128) this.remove(index);
      }
    }
    const until = performance.now() + 6;
    let created = false;
    while (this.pending.length && performance.now() < until) {
      const index = this.pending.shift()!, row = Math.floor(index / columns), column = index % columns;
      const raster = field.row(row, column * 16, Math.min(map.width, (column + 1) * 16));
      const canvas = document.createElement("canvas"); canvas.width = raster.w; canvas.height = raster.h;
      const context = canvas.getContext("2d"); if (!context) continue;
      context.putImageData(new ImageData(new Uint8ClampedArray(raster.rgba), raster.w, raster.h), 0, 0);
      const texture = this.prefix + index;
      // Match native pixel art: linear filtering introduces a bright seam at each row's transparent edge.
      this.scene.textures.addCanvas(texture, canvas)?.setFilter(1);
      const image = this.scene.add.image(raster.x * raster.scale * tileSize, raster.y * raster.scale * tileSize, texture)
        .setOrigin(0).setScale(raster.scale * tileSize).setDepth(this.options.depthOf(row, tileSize));
      image.setName("sunlight-shadow");
      (image as Phaser.GameObjects.Image & { renderCanvas: typeof renderShadowCanvas }).renderCanvas = renderShadowCanvas;
      this.options.container?.add(image);
      this.patches.set(index, { image, texture });
      created = true;
      this.counts.frames++;
    }
    this.counts.pending = this.pending.length;
    if (created) this.options.container?.sort("depth");
    return this.pending.length > 0;
  }

  /** Tile operations can update a runtime map in place. */
  invalidate(): void { this.map = undefined; }
  private remove(index: number): void {
    const p = this.patches.get(index); if (!p) return;
    p.image.destroy(); this.scene.textures.remove(p.texture); this.patches.delete(index);
  }
  private clear(): void {
    for (const index of this.patches.keys()) this.remove(index);
    this.pending = []; this.wanted.clear(); this.viewKey = ""; this.counts.pending = 0;
  }
  destroy(): void { this.clear(); instances.delete(this.scene); }
  diagnostics() {
    return { ...this.counts, visible: [...this.patches.values()].filter(p => p.image.visible).length,
      textures: this.patches.size, enabled: !!this.map && normalizeSunlight(this.map.sunlight).enabled,
      params: this.map ? normalizeSunlight(this.map.sunlight) : undefined,
      nativeArt: !!this.artSource,
      maxTerrain: this.field?.maxTerrain ?? 0,
      casters: this.field?.casters.map(({ id, kind, height, base, x, y, w, d, volumes }) =>
        ({ id, kind, height, base, x, y, w, d, components: volumes?.length ?? 1 })) ?? [] };
  }
}
export function invalidateSunlight(scene: object): void { instances.get(scene)?.invalidate(); }
export function sunlightDiagnostics(scene: object) { return instances.get(scene)?.diagnostics() ?? { enabled: false, pending: 0, textures: 0 }; }
