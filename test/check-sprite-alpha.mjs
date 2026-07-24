import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";

function readPngAlpha(path) {
  const buf = readFileSync(path);
  let offset = 8;
  let width, height;
  const idatChunks = [];
  while (offset < buf.length) {
    const len = buf.readUInt32BE(offset);
    const type = buf.toString("ascii", offset + 4, offset + 8);
    if (type === "IHDR") {
      width = buf.readUInt32BE(offset + 8);
      height = buf.readUInt32BE(offset + 12);
    } else if (type === "IDAT") {
      idatChunks.push(buf.subarray(offset + 8, offset + 8 + len));
    }
    offset += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idatChunks));
  const bpp = 4;
  const stride = width * bpp + 1;
  const pixels = Buffer.alloc(width * height * bpp);
  for (let y = 0; y < height; y++) {
    const filterType = raw[y * stride];
    const rowStart = y * stride + 1;
    for (let x = 0; x < width * bpp; x++) {
      let val = raw[rowStart + x];
      const left = x >= bpp ? pixels[y * width * bpp + x - bpp] : 0;
      const up = y > 0 ? pixels[(y - 1) * width * bpp + x] : 0;
      const upLeft = x >= bpp && y > 0 ? pixels[(y - 1) * width * bpp + x - bpp] : 0;
      if (filterType === 1) val = (val + left) & 0xff;
      else if (filterType === 2) val = (val + up) & 0xff;
      else if (filterType === 3) val = (val + Math.floor((left + up) / 2)) & 0xff;
      else if (filterType === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left), pb = Math.abs(p - up), pc = Math.abs(p - upLeft);
        val = (val + (pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft)) & 0xff;
      }
      pixels[y * width * bpp + x] = val;
    }
  }
  let transparent = 0, semi = 0, opaque = 0, semiSum = 0;
  for (let i = 0; i < width * height; i++) {
    const a = pixels[i * 4 + 3];
    if (a === 0) transparent++;
    else if (a < 220) { semi++; semiSum += a; }
    else opaque++;
  }
  return { width, height, transparent, semi, opaque, avgSemiAlpha: semi > 0 ? Math.round(semiSum / semi) : 0, total: width * height };
}

const files = ["monster-slime-01.png", "monster-golem-01.png", "monster-bat-01.png", "monster-dragon-01.png"];
for (const f of files) {
  try {
    const r = readPngAlpha("public/assets/generated/rm2k3/" + f);
    const visiblePx = r.semi + r.opaque;
    console.log(`${f}: ${r.width}x${r.height} | visible=${visiblePx} | opaque=${r.opaque} (${Math.round(r.opaque / Math.max(1, visiblePx) * 100)}%) | semi=${r.semi} (${Math.round(r.semi / Math.max(1, visiblePx) * 100)}%, avg alpha ${r.avgSemiAlpha}) | transparent=${r.transparent}`);
  } catch (e) {
    console.log(`${f}: ERROR ${e.message}`);
  }
}
