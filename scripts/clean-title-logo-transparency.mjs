import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import Jimp from "jimp";

const sourcePath = resolve(process.argv[2] ?? "public/assets/generated/title/title-logo-crest.png");
const outputPath = resolve(process.argv[3] ?? "output/title-logo-crest-transparent.png");

const image = await Jimp.read(sourcePath);
const { data, height, width } = image.bitmap;
const visited = new Uint8Array(width * height);
const queue = new Int32Array(width * height);
let head = 0;
let tail = 0;

const isBackground = (pixel) => {
  const offset = pixel * 4;
  const red = data[offset] ?? 0;
  const green = data[offset + 1] ?? 0;
  const blue = data[offset + 2] ?? 0;
  const alpha = data[offset + 3] ?? 0;
  const darkest = Math.min(red, green, blue);
  const lightest = Math.max(red, green, blue);
  return alpha === 0 || (darkest >= 215 && lightest - darkest <= 28);
};

const enqueue = (pixel) => {
  if (visited[pixel] !== 0 || !isBackground(pixel)) return;
  visited[pixel] = 1;
  queue[tail] = pixel;
  tail += 1;
};

for (let x = 0; x < width; x += 1) {
  enqueue(x);
  enqueue((height - 1) * width + x);
}
for (let y = 0; y < height; y += 1) {
  enqueue(y * width);
  enqueue(y * width + width - 1);
}

while (head < tail) {
  const pixel = queue[head] ?? 0;
  head += 1;
  const x = pixel % width;
  const y = Math.floor(pixel / width);
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) continue;
      const nextX = x + dx;
      const nextY = y + dy;
      if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height) continue;
      enqueue(nextY * width + nextX);
    }
  }
}

for (let pixel = 0; pixel < visited.length; pixel += 1) {
  if (visited[pixel] !== 0) data[pixel * 4 + 3] = 0;
}

await mkdir(dirname(outputPath), { recursive: true });
await image.writeAsync(outputPath);
const output = await readFile(outputPath);
const digest = createHash("sha256").update(output).digest("hex");
await writeFile(`${outputPath}.sha256`, `${digest}\n`, "utf8");
console.log(JSON.stringify({ outputPath, width, height, transparentPixels: tail, sha256: digest }, null, 2));
