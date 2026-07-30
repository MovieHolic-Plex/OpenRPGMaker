// 스크래치: charset characterIndex 와 faceset faceIndex 가 같은 인물인지 육안 비교용 몽타주.
const fs = require("node:fs");
const { PNG } = require("pngjs");

function load(p) {
  return PNG.sync.read(fs.readFileSync(p));
}
function blit(dst, src, sx, sy, sw, sh, dx, dy, scale) {
  for (let y = 0; y < sh; y += 1) {
    for (let x = 0; x < sw; x += 1) {
      const si = ((sy + y) * src.width + (sx + x)) * 4;
      for (let ky = 0; ky < scale; ky += 1) {
        for (let kx = 0; kx < scale; kx += 1) {
          const px = dx + x * scale + kx;
          const py = dy + y * scale + ky;
          if (px < 0 || py < 0 || px >= dst.width || py >= dst.height) continue;
          const di = (py * dst.width + px) * 4;
          const a = src.data[si + 3];
          if (a === 0) continue;
          dst.data[di] = src.data[si];
          dst.data[di + 1] = src.data[si + 1];
          dst.data[di + 2] = src.data[si + 2];
          dst.data[di + 3] = 255;
        }
      }
    }
  }
}

const SHEETS = process.argv.slice(2);
const scale = 2;
const CW = 24, CH = 32, FW = 48, FH = 48;
const cellW = FW * scale + 8;
const rowH = FH * scale + CH * scale + 12;

for (const name of SHEETS) {
  const cs = load(`public/assets/easyrpg/charset/${name}.png`);
  const fsheet = load(`public/assets/easyrpg/faceset/${name}.png`);
  const out = new PNG({ width: cellW * 8, height: rowH, fill: true });
  for (let i = 0; i < out.data.length; i += 4) {
    out.data[i] = 40; out.data[i + 1] = 40; out.data[i + 2] = 48; out.data[i + 3] = 255;
  }
  for (let idx = 0; idx < 8; idx += 1) {
    // charset: 4열x2행 블록, 블록당 3프레임x4방향. down = 방향행 0, pattern 1 = 가운데 프레임.
    const blockCol = idx % 4, blockRow = Math.floor(idx / 4);
    const sx = blockCol * 3 * CW + 1 * CW;
    const sy = blockRow * 4 * CH + 2 * CH;
    blit(out, cs, sx, sy, CW, CH, idx * cellW + (FW * scale - CW * scale) / 2, 4, scale);
    // faceset: 4열x4행
    const fx = (idx % 4) * FW, fy = Math.floor(idx / 4) * FH;
    blit(out, fsheet, fx, fy, FW, FH, idx * cellW, CH * scale + 8, scale);
  }
  fs.writeFileSync(`report-assets/face-vs-charset-${name}.png`, PNG.sync.write(out));
  console.log(`wrote report-assets/face-vs-charset-${name}.png  charset=${cs.width}x${cs.height} faceset=${fsheet.width}x${fsheet.height}`);
}
