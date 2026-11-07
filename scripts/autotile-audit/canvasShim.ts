// 최소 2D 캔버스 셤 — 실제 렌더 경로(src/editor/mapTileDrawCore.ts)를 Node 에서 그대로 돌리기 위한 것.
// 프로덕션 렌더러를 재구현하면 감사가 재구현을 재는 셈이 되므로, 렌더러는 실제 코드를 쓰고 여기서는 그림판만 흉내낸다.
import { PNG } from "pngjs";

export type RasterImage = { readonly width: number; readonly height: number; readonly data: Uint8Array };

export function decodePng(bytes: Buffer): RasterImage {
  const png = PNG.sync.read(bytes);
  return { width: png.width, height: png.height, data: new Uint8Array(png.data) };
}

export function createCanvas(width: number, height: number): RasterImage {
  return { width, height, data: new Uint8Array(width * height * 4) };
}

export function encodePng(image: RasterImage): Buffer {
  const png = new PNG({ width: image.width, height: image.height });
  png.data = Buffer.from(image.data);
  return PNG.sync.write(png);
}

export class CanvasContext2D {
  readonly canvas: RasterImage;
  fillStyle = "#000";
  private stack: string[] = [];

  constructor(canvas: RasterImage) {
    this.canvas = canvas;
  }

  save(): void {
    this.stack.push(this.fillStyle);
  }

  restore(): void {
    this.fillStyle = this.stack.pop() ?? "#000";
  }

  fillRect(x: number, y: number, w: number, h: number): void {
    const [r, g, b, a] = parseColor(this.fillStyle);
    for (let py = Math.floor(y); py < Math.ceil(y + h); py += 1) {
      for (let px = Math.floor(x); px < Math.ceil(x + w); px += 1) {
        blend(this.canvas, px, py, r, g, b, a);
      }
    }
  }

  drawImage(image: RasterImage, sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number): void {
    if (sw <= 0 || sh <= 0 || dw <= 0 || dh <= 0) return;
    const stepX = sw / dw;
    const stepY = sh / dh;
    for (let oy = 0; oy < dh; oy += 1) {
      const srcY = Math.floor(sy + oy * stepY);
      if (srcY < 0 || srcY >= image.height) continue;
      for (let ox = 0; ox < dw; ox += 1) {
        const srcX = Math.floor(sx + ox * stepX);
        if (srcX < 0 || srcX >= image.width) continue;
        const si = (srcY * image.width + srcX) * 4;
        const a = image.data[si + 3]!;
        if (a === 0) continue;
        blend(this.canvas, Math.floor(dx) + ox, Math.floor(dy) + oy, image.data[si]!, image.data[si + 1]!, image.data[si + 2]!, a);
      }
    }
  }
}

function blend(canvas: RasterImage, x: number, y: number, r: number, g: number, b: number, a: number): void {
  if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return;
  const i = (y * canvas.width + x) * 4;
  if (a === 255) {
    canvas.data[i] = r;
    canvas.data[i + 1] = g;
    canvas.data[i + 2] = b;
    canvas.data[i + 3] = 255;
    return;
  }
  const sa = a / 255;
  const da = canvas.data[i + 3]! / 255;
  const outA = sa + da * (1 - sa);
  if (outA === 0) return;
  canvas.data[i] = Math.round((r * sa + canvas.data[i]! * da * (1 - sa)) / outA);
  canvas.data[i + 1] = Math.round((g * sa + canvas.data[i + 1]! * da * (1 - sa)) / outA);
  canvas.data[i + 2] = Math.round((b * sa + canvas.data[i + 2]! * da * (1 - sa)) / outA);
  canvas.data[i + 3] = Math.round(outA * 255);
}

function parseColor(value: string): [number, number, number, number] {
  const rgba = /^rgba?\(([^)]+)\)$/.exec(value.trim());
  if (rgba) {
    const parts = rgba[1]!.split(",").map((n) => Number(n.trim()));
    return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0, Math.round((parts[3] ?? 1) * 255)];
  }
  const hex = /^#([0-9a-f]{6})$/i.exec(value.trim());
  if (hex) {
    const n = parseInt(hex[1]!, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
  }
  return [0, 0, 0, 255];
}

export function tileAlphaCoverage(image: RasterImage, tile: number, tilesPerRow: number, tileSize: number): number {
  const sx = (tile % tilesPerRow) * tileSize;
  const sy = Math.floor(tile / tilesPerRow) * tileSize;
  let opaque = 0;
  for (let y = 0; y < tileSize; y += 1) {
    for (let x = 0; x < tileSize; x += 1) {
      const px = sx + x;
      const py = sy + y;
      if (px >= image.width || py >= image.height) return -1; // 아틀라스 밖 = 잘못된 인덱스
      if (image.data[(py * image.width + px) * 4 + 3]! > 24) opaque += 1;
    }
  }
  return opaque / (tileSize * tileSize);
}
