// 두 연결 종류 스샷을 나란히 붙여 한 장으로 만든다 — 감독이 한 번에 비교할 수 있게.
import Jimp from "jimp";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const a = await Jimp.read(join(dir, "kind-oauth.png"));
const b = await Jimp.read(join(dir, "kind-apikey.png"));
const gap = 24, pad = 16, head = 30;
const out = new Jimp(
  a.bitmap.width + b.bitmap.width + gap + pad * 2,
  Math.max(a.bitmap.height, b.bitmap.height) + pad * 2 + head,
  0xf5f1e8ff,
);
const font = await Jimp.loadFont(Jimp.FONT_SANS_16_BLACK);
out.composite(a, pad, pad + head);
out.composite(b, pad + a.bitmap.width + gap, pad + head);
out.print(font, pad + 4, pad, "1) OAuth login - 14 providers, no key field");
out.print(font, pad + a.bitmap.width + gap + 4, pad, "2) API key - 54 providers, key field shown");
const target = join(dir, "kinds-side-by-side.png");
await out.writeAsync(target);
console.log(`${out.bitmap.width}x${out.bitmap.height} -> ${target}`);
