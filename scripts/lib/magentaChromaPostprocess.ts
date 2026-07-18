/**
 * Force RM2k3-style magenta chroma key, then export keyed pixels as real alpha.
 * Uses Pillow via python (sharp is not a repo dependency).
 *
 * Pipeline:
 * 1. Resize with nearest (pixel art)
 * 2. Mark near-magenta + corner-connected background as key
 * 3. Write pure #FF00FF for keyed RGB, alpha 0 for delivery
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Buffer } from "node:buffer";

export const MAGENTA_RGB = { r: 255, g: 0, b: 255 } as const;

export type MagentaPostprocessOptions = {
  readonly width: number;
  readonly height: number;
  readonly maxGreen?: number;
  readonly minMagentaChannel?: number;
  readonly floodDistance?: number;
};

function isNearMagenta(r: number, g: number, b: number, minCh: number, maxG: number): boolean {
  return r >= minCh && b >= minCh && g <= maxG;
}

function colorDist(r: number, g: number, b: number, r2: number, g2: number, b2: number): number {
  const dr = r - r2;
  const dg = g - g2;
  const db = b - b2;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/**
 * Mutates RGBA buffer in place: keyed pixels become alpha 0.
 * Returns count of keyed pixels.
 */
export function applyMagentaChromaKeyToRgba(
  data: Uint8Array | Buffer,
  width: number,
  height: number,
  options: Omit<MagentaPostprocessOptions, "width" | "height"> = {},
): number {
  const minCh = options.minMagentaChannel ?? 200;
  const maxG = options.maxGreen ?? 100;
  const floodDistance = options.floodDistance ?? 48;
  const n = width * height;
  const key = new Uint8Array(n);

  for (let i = 0; i < n; i += 1) {
    const o = i * 4;
    const r = data[o] ?? 0;
    const g = data[o + 1] ?? 0;
    const b = data[o + 2] ?? 0;
    if (isNearMagenta(r, g, b, minCh, maxG)) key[i] = 1;
  }

  const queue: number[] = [];
  const corners = [0, width - 1, (height - 1) * width, (height - 1) * width + (width - 1)];
  for (const c of corners) {
    if (c < 0 || c >= n) continue;
    if (!key[c]) {
      key[c] = 1;
      queue.push(c);
    }
  }
  for (let x = 0; x < width; x += 1) {
    const top = x;
    const bot = (height - 1) * width + x;
    if (key[top]) queue.push(top);
    if (key[bot]) queue.push(bot);
  }
  for (let y = 0; y < height; y += 1) {
    const left = y * width;
    const right = y * width + (width - 1);
    if (key[left]) queue.push(left);
    if (key[right]) queue.push(right);
  }

  const seen = new Uint8Array(n);
  while (queue.length) {
    const i = queue.pop()!;
    if (seen[i]) continue;
    seen[i] = 1;
    key[i] = 1;
    const o = i * 4;
    const r0 = data[o] ?? 0;
    const g0 = data[o + 1] ?? 0;
    const b0 = data[o + 2] ?? 0;
    const x = i % width;
    const y = (i / width) | 0;
    const neigh = [
      x > 0 ? i - 1 : -1,
      x + 1 < width ? i + 1 : -1,
      y > 0 ? i - width : -1,
      y + 1 < height ? i + width : -1,
    ];
    for (const j of neigh) {
      if (j < 0 || seen[j] || key[j]) continue;
      const jo = j * 4;
      const r = data[jo] ?? 0;
      const g = data[jo + 1] ?? 0;
      const b = data[jo + 2] ?? 0;
      if (isNearMagenta(r, g, b, minCh, maxG) || colorDist(r, g, b, r0, g0, b0) <= floodDistance) {
        const maxc = Math.max(r, g, b);
        const minc = Math.min(r, g, b);
        const sat = maxc - minc;
        if (sat > 80 && !isNearMagenta(r, g, b, minCh, maxG) && colorDist(r, g, b, r0, g0, b0) > floodDistance * 0.65) {
          continue;
        }
        key[j] = 1;
        queue.push(j);
      }
    }
  }

  let keyed = 0;
  for (let i = 0; i < n; i += 1) {
    if (!key[i]) continue;
    const o = i * 4;
    data[o] = MAGENTA_RGB.r;
    data[o + 1] = MAGENTA_RGB.g;
    data[o + 2] = MAGENTA_RGB.b;
    data[o + 3] = 0;
    keyed += 1;
  }
  return keyed;
}

function pythonBin(): string {
  for (const candidate of ["python", "py", "python3"]) {
    const probe = spawnSync(candidate, ["-c", "from PIL import Image"], { encoding: "utf8" });
    if (probe.status === 0) return candidate;
  }
  throw new Error("Python + Pillow required for DB art postprocess (sharp not installed)");
}

/**
 * Resize + magenta key postprocess via Pillow.
 */
export async function postprocessDbArtPng(
  raw: Buffer,
  options: MagentaPostprocessOptions,
): Promise<{ png: Buffer; keyedPixels: number }> {
  const width = options.width;
  const height = options.height;
  const minCh = options.minMagentaChannel ?? 200;
  const maxG = options.maxGreen ?? 100;
  const floodDistance = options.floodDistance ?? 48;

  const dir = path.join(tmpdir(), "rpg-zzu-db-art");
  mkdirSync(dir, { recursive: true });
  const stamp = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const inPath = path.join(dir, `in_${stamp}.png`);
  const outPath = path.join(dir, `out_${stamp}.png`);
  const metaPath = path.join(dir, `meta_${stamp}.json`);
  writeFileSync(inPath, raw);

  const py = `
from PIL import Image
import json, math
from pathlib import Path

in_path = Path(r'''${inPath.replace(/\\/g, "/")}''')
out_path = Path(r'''${outPath.replace(/\\/g, "/")}''')
meta_path = Path(r'''${metaPath.replace(/\\/g, "/")}''')
W, H = ${width}, ${height}
MIN_CH, MAX_G, FLOOD = ${minCh}, ${maxG}, ${floodDistance}

im = Image.open(in_path).convert("RGBA")
w0, h0 = im.size
side = min(w0, h0)
left = (w0 - side) // 2
top = (h0 - side) // 2
sq = im.crop((left, top, left + side, top + side)).resize((W, H), Image.Resampling.NEAREST)
px = list(sq.getdata())
n = W * H

def near_mag(r,g,b):
    return r >= MIN_CH and b >= MIN_CH and g <= MAX_G

def dist(a,b):
    return math.sqrt((a[0]-b[0])**2 + (a[1]-b[1])**2 + (a[2]-b[2])**2)

key = [False]*n
for i,(r,g,b,a) in enumerate(px):
    if near_mag(r,g,b):
        key[i] = True

q = []
for c in [0, W-1, (H-1)*W, (H-1)*W + (W-1)]:
    if 0 <= c < n:
        key[c] = True
        q.append(c)
for x in range(W):
    for c in (x, (H-1)*W + x):
        if key[c]: q.append(c)
for y in range(H):
    for c in (y*W, y*W + (W-1)):
        if key[c]: q.append(c)

seen = [False]*n
while q:
    i = q.pop()
    if seen[i]:
        continue
    seen[i] = True
    key[i] = True
    r0,g0,b0,a0 = px[i]
    x, y = i % W, i // W
    for j in (i-1 if x>0 else -1, i+1 if x+1<W else -1, i-W if y>0 else -1, i+W if y+1<H else -1):
        if j < 0 or seen[j] or key[j]:
            continue
        r,g,b,a = px[j]
        if near_mag(r,g,b) or dist((r,g,b),(r0,g0,b0)) <= FLOOD:
            sat = max(r,g,b) - min(r,g,b)
            if sat > 80 and not near_mag(r,g,b) and dist((r,g,b),(r0,g0,b0)) > FLOOD*0.65:
                continue
            key[j] = True
            q.append(j)

keyed = 0
out = []
for i,(r,g,b,a) in enumerate(px):
    if key[i]:
        out.append((255,0,255,0))
        keyed += 1
    else:
        out.append((r,g,b,a))

sq.putdata(out)
sq.save(out_path)
meta_path.write_text(json.dumps({"keyedPixels": keyed}), encoding="utf8")
`;

  const bin = pythonBin();
  const result = spawnSync(bin, ["-c", py], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`pillow magenta postprocess failed: ${result.stderr || result.stdout}`);
  }
  if (!existsSync(outPath)) throw new Error("pillow postprocess produced no output");
  const png = readFileSync(outPath);
  let keyedPixels = 0;
  try {
    keyedPixels = JSON.parse(readFileSync(metaPath, "utf8")).keyedPixels ?? 0;
  } catch {
    keyedPixels = 0;
  }
  try {
    unlinkSync(inPath);
    unlinkSync(outPath);
    unlinkSync(metaPath);
  } catch {
    // ignore cleanup
  }
  return { png, keyedPixels };
}
