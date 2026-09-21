import type Phaser from "phaser";

/** A broad cloud field in world pixels, independent of camera/viewport size. */
export const CLOUD_FIELD_SIZE = 512;
export const CLOUD_SHAPE_FRAMES = 8;
export const CLOUD_SHAPE_PERIOD_MS = 96_000;
export const CLOUD_SHAPE_TEXTURE_KEY = "__oprn_cloud_silhouette_v3";
const RESOLUTION = 256;

// Sparse, asymmetric banks: most of the tile is completely sunlit. No fog/noise density in the cores.
const BANKS = [
  { x: 90, y: 105, scale: 1, angle: -0.18 },
  { x: 365, y: 215, scale: 1.15, angle: 0.35 },
  { x: 165, y: 420, scale: 0.85, angle: -0.5 },
  { x: 350, y: 440, scale: 1, angle: 0.15 },
  { x: 320, y: 35, scale: 0.9, angle: -0.35 },
  { x: 70, y: 270, scale: 1.1, angle: 0.28 },
];
const LOBES = [
  { x: 0, y: 0, rx: 71, ry: 43 },
  { x: -49, y: 8, rx: 43, ry: 32 },
  { x: -25, y: -29, rx: 38, ry: 31 },
  { x: 23, y: -24, rx: 44, ry: 36 },
  { x: 58, y: 4, rx: 38, ry: 28 },
  { x: 22, y: 28, rx: 42, ry: 25 },
];

export function cloudShapeTextureKey(frame: number, amount = 3): string {
  return `${CLOUD_SHAPE_TEXTURE_KEY}_${amount}_${frame}`;
}

/** Prebaked slow shape evolution: no canvas painting / pixel uploads during play. */
export function ensureCloudShapeTextures(textures: Phaser.Textures.TextureManager, amount = 3): void {
  if (textures.exists(cloudShapeTextureKey(CLOUD_SHAPE_FRAMES - 1, amount))) return;
  for (let frame = 0; frame < CLOUD_SHAPE_FRAMES; frame++) {
    const key = cloudShapeTextureKey(frame, amount);
    if (textures.exists(key)) continue;
    const phase = frame / CLOUD_SHAPE_FRAMES * Math.PI * 2;
    const banks = BANKS.slice(0, amount).map((bank, bankIndex) => ({
      ...bank, cos: Math.cos(bank.angle), sin: Math.sin(bank.angle),
      lobes: LOBES.map((lobe, index) => ({
        x: lobe.x + Math.sin(phase + index * 1.7 + bankIndex) * 3,
        y: lobe.y + Math.cos(phase + index * 1.3 + bankIndex) * 3,
        rx: lobe.rx * (1 + 0.045 * Math.sin(phase + index + bankIndex)),
        ry: lobe.ry * (1 + 0.045 * Math.cos(phase + index * 1.4 + bankIndex)),
      })),
    }));
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = RESOLUTION;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Cloud shadows require a canvas context");
    const pixels = context.createImageData(RESOLUTION, RESOLUTION);
    for (let y = 0; y < RESOLUTION; y++) {
      for (let x = 0; x < RESOLUTION; x++) {
        let distance = 1000;
        for (const bank of banks) {
          const wrap = (v: number) => ((v + CLOUD_FIELD_SIZE * 1.5) % CLOUD_FIELD_SIZE) - CLOUD_FIELD_SIZE / 2;
          const dx = wrap(x * 2 - bank.x);
          const dy = wrap(y * 2 - bank.y);
          const lx = (dx * bank.cos + dy * bank.sin) / bank.scale;
          const ly = (-dx * bank.sin + dy * bank.cos) / bank.scale;
          if (Math.abs(lx) > 115 || Math.abs(ly) > 85) continue;
          let bankDistance = 1000;
          for (const lobe of bank.lobes) {
            const d = (Math.hypot((lx - lobe.x) / lobe.rx, (ly - lobe.y) / lobe.ry) - 1) * Math.min(lobe.rx, lobe.ry);
            // Smooth union removes the seams between the large lobes without blurring the entire cloud.
            const h = Math.max(8 - Math.abs(bankDistance - d), 0) / 8;
            bankDistance = Math.min(bankDistance, d) - h * h * 2;
          }
          distance = Math.min(distance, bankDistance * bank.scale);
        }
        const t = Math.max(0, Math.min(1, (4 - distance) / 8));
        const alpha = t * t * (3 - 2 * t);
        const offset = (y * RESOLUTION + x) * 4;
        pixels.data[offset] = pixels.data[offset + 1] = pixels.data[offset + 2] = 255;
        pixels.data[offset + 3] = Math.round(alpha * 255);
      }
    }
    context.putImageData(pixels, 0, 0);
    textures.addCanvas(key, canvas)?.setFilter(0);
  }
}
