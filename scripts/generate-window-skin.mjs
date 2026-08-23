import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { writePng } from "./lib/pixelPng.mjs";

const TARGET = "public/assets/ui/windowskin-default.png";
const WIDTH = 96;
const HEIGHT = 96;

function mix(a, b, t) {
  return Math.round(a + (b - a) * t);
}

function clampByte(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function noise(x, y) {
  const value = (x * 73 + y * 151 + (x ^ y) * 29 + x * y * 7) & 15;
  return value - 8;
}

function baseBlue(x, y) {
  const t = y / (HEIGHT - 1);
  const n = noise(x, y);
  return [
    clampByte(mix(34, 7, t) + n * 0.55),
    clampByte(mix(88, 36, t) + n * 0.45),
    clampByte(mix(205, 126, t) + n * 0.75),
    255,
  ];
}

function edgeColor(x, y) {
  const d = Math.min(x, y, WIDTH - 1 - x, HEIGHT - 1 - y);
  const lightSide = x <= y && x < WIDTH - 1 - x || y < HEIGHT - 1 - y;

  if (d === 0) return [248, 253, 255, 255];
  if (d === 1) return lightSide ? [190, 224, 255, 255] : [3, 13, 55, 255];
  if (d === 2) return [21, 48, 124, 255];
  if (d === 3) return lightSide ? [111, 166, 255, 255] : [5, 18, 72, 255];
  if (d === 4) return [235, 250, 255, 255];
  if (d === 5) return lightSide ? [96, 151, 250, 255] : [4, 17, 67, 255];
  if (d === 6) return [12, 37, 120, 255];
  if (d === 7) return lightSide ? [47, 102, 212, 255] : [5, 20, 83, 255];
  if (d === 8) return [19, 66, 169, 255];
  return null;
}

function pixel(x, y) {
  const edge = edgeColor(x, y);
  if (edge) return edge;

  const color = baseBlue(x, y);
  if ((x + y * 3) % 17 === 0) {
    color[0] = clampByte(color[0] + 3);
    color[1] = clampByte(color[1] + 4);
    color[2] = clampByte(color[2] + 6);
  }
  if ((x * 5 + y) % 23 === 0) {
    color[0] = clampByte(color[0] - 3);
    color[1] = clampByte(color[1] - 3);
    color[2] = clampByte(color[2] - 5);
  }
  return color;
}

function createPng() {
  const rgba = Buffer.alloc(WIDTH * HEIGHT * 4);
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      const offset = (y * WIDTH + x) * 4;
      const [r, g, b, a] = pixel(x, y);
      rgba[offset] = r;
      rgba[offset + 1] = g;
      rgba[offset + 2] = b;
      rgba[offset + 3] = a;
    }
  }
  return writePng(WIDTH, HEIGHT, rgba);
}

mkdirSync(path.dirname(TARGET), { recursive: true });
writeFileSync(TARGET, createPng());
console.log(`Generated ${TARGET} (${WIDTH}x${HEIGHT}, 24px 9-slice corners)`);
