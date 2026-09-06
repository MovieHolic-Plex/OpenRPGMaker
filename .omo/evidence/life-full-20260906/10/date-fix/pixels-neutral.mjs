import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { PNG } from "pngjs";
const root = new URL("./native-neutral/", import.meta.url);
const before = PNG.sync.read(await readFile(new URL("forage-generated.png", root)));
const after = PNG.sync.read(await readFile(new URL("forage-picked.png", root)));
assert.equal(before.width, 1280); assert.equal(before.height, 960);
assert.equal(after.width, before.width); assert.equal(after.height, before.height);
let changedPixels = 0;
const bounds = { minX: before.width, minY: before.height, maxX: 0, maxY: 0 };
for (let y = 0; y < before.height; y++) for (let x = 0; x < before.width; x++) {
  const i = (y * before.width + x) * 4;
  if (before.data.subarray(i, i + 4).equals(after.data.subarray(i, i + 4))) continue;
  changedPixels++;
  bounds.minX = Math.min(bounds.minX, x); bounds.minY = Math.min(bounds.minY, y);
  bounds.maxX = Math.max(bounds.maxX, x); bounds.maxY = Math.max(bounds.maxY, y);
}
// A pickup marker at logical (40,64), rendered at scale 4. No unrelated field pixels change.
assert.ok(changedPixels > 0);
assert.ok(bounds.minX >= 112 && bounds.maxX < 208 && bounds.minY >= 128 && bounds.maxY < 272);
await writeFile(new URL("pixels.json", root), JSON.stringify({ pass: true, width: before.width, height: before.height, changedPixels, bounds,
  method: "Exact native PNG RGBA comparison, no baseline update; marker-region change only. Not a human visual review." }, null, 2) + "\n");
