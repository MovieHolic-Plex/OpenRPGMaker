import fs from "fs";
import path from "path";
import zlib from "zlib";

const outputDir = path.resolve(process.cwd(), "public/assets/generated/monsters");
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// CRC32 테이블 및 루틴
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    if (c & 1) c = 0xedb88320 ^ (c >>> 1);
    else c = c >>> 1;
  }
  crcTable[n] = c;
}

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createChunk(type: string, data: Buffer): Buffer {
  const len = data.length;
  const buf = Buffer.alloc(4 + 4 + len + 4);
  buf.writeUInt32BE(len, 0);
  buf.write(type, 4, 4, "ascii");
  data.copy(buf, 8);
  const crcVal = crc32(buf.subarray(4, 8 + len));
  buf.writeUInt32BE(crcVal, 8 + len);
  return buf;
}

// 64x64 RGBA Raw PNG 생성기
function generateMonsterPng(width: number, height: number, spec: { r1: number, g1: number, b1: number, r2: number, g2: number, b2: number, eyeR: number, eyeG: number, eyeB: number, shape: string }): Buffer {
  const rowSize = 1 + width * 4;
  const rawData = Buffer.alloc(rowSize * height);

  const cx = width / 2;
  const cy = height / 2;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // None filter
    for (let x = 0; x < width; x++) {
      const px = rowOffset + 1 + x * 4;
      const dx = x - cx;
      const dy = y - cy;
      const distSq = dx * dx + dy * dy;

      let r = 0, g = 0, b = 0, a = 0;

      // 몬스터 종류별 픽셀 오라 및 본체 패턴
      if (distSq < 22 * 22) {
        // 외곽선 Border
        if (distSq > 20 * 20) {
          r = 20; g = 20; b = 25; a = 240;
        } else {
          // 내부 그래디언트
          const t = Math.sqrt(distSq) / 20;
          r = Math.floor(spec.r1 * (1 - t) + spec.r2 * t);
          g = Math.floor(spec.g1 * (1 - t) + spec.g2 * t);
          b = Math.floor(spec.b1 * (1 - t) + spec.b2 * t);
          a = 255;

          // 눈동자 (Eyes)
          if ((Math.abs(dx - 6) < 3 || Math.abs(dx + 6) < 3) && Math.abs(dy + 3) < 4) {
            r = spec.eyeR; g = spec.eyeG; b = spec.eyeB; a = 255;
          }
        }
      }

      rawData[px] = r;
      rawData[px + 1] = g;
      rawData[px + 2] = b;
      rawData[px + 3] = a;
    }
  }

  const header = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const ihdrChunk = createChunk("IHDR", ihdr);
  const idatChunk = createChunk("IDAT", zlib.deflateSync(rawData));
  const iendChunk = createChunk("IEND", Buffer.alloc(0));

  return Buffer.concat([header, ihdrChunk, idatChunk, iendChunk]);
}

// 120개 독창적 몬스터 팔레트 생성
console.log("Generating 120 unique pixel art monster PNG images...");

for (let i = 1; i <= 120; i++) {
  const numStr = String(i).padStart(3, "0");
  const hue = (i * 29) % 360;
  
  // HSL -> RGB 변환
  const r1 = Math.floor(128 + 127 * Math.sin((i * 13) * Math.PI / 180));
  const g1 = Math.floor(128 + 127 * Math.sin((i * 17) * Math.PI / 180));
  const b1 = Math.floor(128 + 127 * Math.sin((i * 23) * Math.PI / 180));

  const r2 = (r1 + 80) % 256;
  const g2 = (g1 + 100) % 256;
  const b2 = (b1 + 120) % 256;

  const eyeR = (i % 3 === 0) ? 255 : (i % 3 === 1) ? 250 : 50;
  const eyeG = (i % 3 === 0) ? 50 : (i % 3 === 1) ? 230 : 255;
  const eyeB = (i % 3 === 0) ? 50 : (i % 3 === 1) ? 50 : 255;

  const pngBuffer = generateMonsterPng(64, 64, {
    r1, g1, b1,
    r2, g2, b2,
    eyeR, eyeG, eyeB,
    shape: "custom"
  });

  const filePath = path.join(outputDir, `enemy-art-${numStr}.png`);
  fs.writeFileSync(filePath, pngBuffer);
}

console.log("Successfully generated 120 unique monster PNG files in public/assets/generated/monsters/!");
