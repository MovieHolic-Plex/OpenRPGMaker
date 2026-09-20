import type Phaser from "phaser";

const SIZE = 256;
const KEY = "__oprn_weather_mist_v1";

/** Periodic value noise: each octave wraps independently, so drifting never exposes a seam. */
function noise(x: number, y: number, period: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const smooth = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  const u = smooth(x - ix);
  const v = smooth(y - iy);
  const hash = (a: number, b: number) => {
    let n = Math.imul((a % period + period) % period, 374761393)
      + Math.imul((b % period + period) % period, 668265263) + seed;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
  };
  const a = hash(ix, iy);
  const b = hash(ix + 1, iy);
  const c = hash(ix, iy + 1);
  const d = hash(ix + 1, iy + 1);
  return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
}

/** Generated once per game texture manager, reused across maps. No external assets or per-frame uploads. */
export function ensureFogTexture(textures: Phaser.Textures.TextureManager, key = KEY): string {
  if (textures.exists(key)) return key;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SIZE;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Weather requires a 2D canvas context");
  const pixels = context.createImageData(SIZE, SIZE);
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      let density = 0;
      let weight = 0;
      for (let octave = 0; octave < 5; octave += 1) {
        const period = 4 * 2 ** octave;
        const amplitude = 0.5 ** octave;
        density += noise(x / SIZE * period, y / SIZE * period, period, 97 + octave * 113) * amplitude;
        weight += amplitude;
      }
      // Continuous density, with transparent pockets and feathered wisps rather than sprite silhouettes.
      density = Math.max(0, Math.min(1, (density / weight - 0.20) / 0.60));
      const offset = (y * SIZE + x) * 4;
      pixels.data[offset] = 213;
      pixels.data[offset + 1] = 226;
      pixels.data[offset + 2] = 232;
      pixels.data[offset + 3] = Math.round(density ** 1.5 * 255);
    }
  }
  context.putImageData(pixels, 0, 0);
  const texture = textures.addCanvas(key, canvas);
  // Phaser's LINEAR filter (0): the game's pixelArt/NEAREST setting must not turn mist into blocks.
  texture?.setFilter(0);
  return key;
}
