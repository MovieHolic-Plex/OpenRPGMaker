// Frozen pre-8th-pass precipitation oracle; do not derive it from the new buffer writer.
import type Phaser from "phaser";
import { weatherParticleCount, type WeatherParams } from "@/player/weather/weatherModel";
const MAX_PARTICLES = 180;
export function legacyPrecipitation(
  graphics: Phaser.GameObjects.Graphics,
  params: WeatherParams,
  width: number,
  height: number,
  timeMs: number
): void {
  const count = weatherParticleCount(params, MAX_PARTICLES);
  const rain = params.kind === "rain" || params.kind === "storm";
  const storm = params.kind === "storm";
  const seconds = timeMs / 1000;
  // Index hashing breaks the diagonal grid of the old equally spaced particles.
  const sample = (index: number, salt: number) => {
    let value = Math.imul(index + salt, 1597334677);
    value = Math.imul(value ^ (value >>> 16), 2246822519);
    return ((value ^ (value >>> 13)) >>> 0) / 4294967296;
  };
  for (let index = 0; index < count; index += 1) {
    const depth = sample(index, 11);
    const phase = sample(index, 71) * Math.PI * 2;
    const speed = rain ? 160 + depth * 230 : 10 + depth * 26;
    const wind = rain ? (storm ? 95 : 35) : 8;
    const sway = rain ? 0 : Math.sin(seconds * (0.5 + depth) + phase) * (5 + depth * 12);
    const x = positiveModulo(sample(index, 31) * (width + 48) + seconds * wind * (0.4 + depth) + sway, width + 48) - 24;
    const y = positiveModulo(sample(index, 53) * (height + 48) + seconds * speed, height + 48) - 24;
    const alpha = (0.15 + depth * 0.48) * Math.min(1, params.intensity * 4);
    if (rain) {
      const length = 4 + depth * (storm ? 17 : 11);
      const slant = length * wind / speed;
      // Soft trailing streak with a brighter, short leading edge.
      graphics.lineStyle(0.45 + depth * 0.7, 0xbad0de, alpha * 0.45);
      graphics.lineBetween(x, y, x + slant, y + length);
      graphics.lineStyle(0.4 + depth * 0.65, 0xddeaf1, alpha);
      graphics.lineBetween(x + slant * 0.65, y + length * 0.65, x + slant, y + length);
    } else {
      const radius = 0.45 + depth * 1.3;
      if (depth > 0.65) {
        graphics.fillStyle(0xe1edf6, alpha * 0.12);
        graphics.fillCircle(x, y, radius * 1.9);
      }
      graphics.fillStyle(0xf1f7fc, alpha);
      graphics.fillCircle(x, y, radius);
    }
  }
}

function positiveModulo(value: number, divisor: number): number { return ((value % divisor) + divisor) % divisor; }
