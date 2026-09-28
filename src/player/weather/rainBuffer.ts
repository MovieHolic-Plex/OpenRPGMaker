import type Phaser from "phaser";
import { stormFlashOpacity, weatherParticleCount, type WeatherParams } from "./weatherModel";

// Phaser Graphics Commands (verified against the installed renderer in the regression test).
const BEGIN_PATH = 1, FILL_RECT = 3, LINE_TO = 4, MOVE_TO = 5;
const LINE_STYLE = 6, FILL_STYLE = 7, STROKE_PATH = 9;
export const WEATHER_MAX_PARTICLES = 180;
const seeds = new Float64Array(WEATHER_MAX_PARTICLES * 3);
function sample(index: number, salt: number): number {
  let value = Math.imul(index + salt, 1597334677);
  value = Math.imul(value ^ (value >>> 16), 2246822519);
  return ((value ^ (value >>> 13)) >>> 0) / 4294967296;
}
for (let i = 0; i < WEATHER_MAX_PARTICLES; i++) {
  seeds[i * 3] = sample(i, 11);
  seeds[i * 3 + 1] = sample(i, 31);
  seeds[i * 3 + 2] = sample(i, 53);
}
const buffers = new WeakMap<Phaser.GameObjects.Graphics, number[]>();

/** Same commands, coordinates and draw order as lineStyle/lineBetween, without clearing/growing the array. */
export function renderRainBuffer(
  graphics: Phaser.GameObjects.Graphics, params: WeatherParams,
  width: number, height: number, timeMs: number,
): void {
  let buffer = buffers.get(graphics);
  if (!buffer) {
    // Force double elements, including on V8, before storing integer opcodes.
    buffer = new Array<number>(WEATHER_MAX_PARTICLES * 24 + 8).fill(0.5);
    buffers.set(graphics, buffer);
  }
  const count = weatherParticleCount(params, WEATHER_MAX_PARTICLES);
  const storm = params.kind === "storm";
  const wind = storm ? 95 : 35;
  const seconds = timeMs / 1000;
  let offset = 0;
  for (let i = 0; i < count; i++) {
    const depth = seeds[i * 3]!;
    const speed = 160 + depth * 230;
    const x = modulo(seeds[i * 3 + 1]! * (width + 48) + seconds * wind * (0.4 + depth), width + 48) - 24;
    const y = modulo(seeds[i * 3 + 2]! * (height + 48) + seconds * speed, height + 48) - 24;
    const alpha = (0.15 + depth * 0.48) * Math.min(1, params.intensity * 4);
    const length = 4 + depth * (storm ? 17 : 11);
    const slant = length * wind / speed;
    offset = line(buffer, offset, 0.45 + depth * 0.7, 0xbad0de, alpha * 0.45, x, y, x + slant, y + length);
    offset = line(buffer, offset, 0.4 + depth * 0.65, 0xddeaf1, alpha,
      x + slant * 0.65, y + length * 0.65, x + slant, y + length);
  }
  const flash = stormFlashOpacity(params, timeMs);
  if (flash > 0) {
    buffer[offset++] = FILL_STYLE; buffer[offset++] = 0xffffff; buffer[offset++] = flash;
    buffer[offset++] = FILL_RECT; buffer[offset++] = 0; buffer[offset++] = 0;
    buffer[offset++] = width; buffer[offset++] = height;
  }
  buffer.length = offset;
  graphics.commandBuffer = buffer;
}
function line(b: number[], i: number, width: number, color: number, alpha: number,
  x: number, y: number, endX: number, endY: number): number {
  b[i++] = LINE_STYLE; b[i++] = width; b[i++] = color; b[i++] = alpha;
  b[i++] = BEGIN_PATH;
  b[i++] = MOVE_TO; b[i++] = x; b[i++] = y;
  b[i++] = LINE_TO; b[i++] = endX; b[i++] = endY;
  b[i++] = STROKE_PATH;
  return i;
}
function modulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}
