// 코드 지형 미리보기 그림(2026-10-30): 조수가 마을 자리를 고를 수 있게 단·물·좌표 눈금을 한 장으로.
// 단은 낮을수록 어두운 풀색, 높을수록 밝게(단 번호를 덩이 한가운데에 적는다), 단 경계는 검은 선, 강·못·바다는 파랑, 강 건널 자리는 흰 점.
// 눈금: 5칸마다 옅은 선, 10칸마다 진한 선, 위·왼쪽 여백에 칸 번호. 브라우저·Bun 어디서나 돌도록 PNG 는 직접 짠다(색 번호 PNG, 무압축 deflate).
import type { CodeTerrain } from "./beodeulTerrainGen";

const FONT: Record<string, string[]> = {
  "0": ["111", "101", "101", "101", "111"], "1": ["010", "110", "010", "010", "111"], "2": ["111", "001", "111", "100", "111"],
  "3": ["111", "001", "111", "001", "111"], "4": ["101", "101", "111", "001", "001"], "5": ["111", "100", "111", "001", "111"],
  "6": ["111", "100", "111", "101", "111"], "7": ["111", "001", "010", "010", "010"], "8": ["111", "101", "111", "101", "111"],
  "9": ["111", "101", "111", "001", "111"],
};
const PAL: [number, number, number][] = [
  [24, 24, 28], // 0 여백
  [230, 230, 230], // 1 글자
  [20, 20, 20], // 2 단 경계
  [58, 110, 168], // 3 강
  [74, 134, 192], // 4 못
  [42, 90, 144], // 5 바다
  [255, 255, 255], // 6 건널 자리
  [0, 0, 0], // 7 눈금 10
  [52, 92, 44], [74, 120, 58], [100, 148, 70], [132, 174, 86], [166, 198, 108], [200, 220, 140], // 8~13 단 0~5
];

function crc32(b: Uint8Array): number {
  let c = ~0;
  for (let i = 0; i < b.length; i += 1) { c ^= b[i]!; for (let k = 0; k < 8; k += 1) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); }
  return ~c >>> 0;
}
function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length); const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length); for (let i = 0; i < 4; i += 1) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8); dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}
function zstore(raw: Uint8Array): Uint8Array {
  const parts: number[] = [0x78, 0x01];
  for (let o = 0; o < raw.length; o += 65535) {
    const n = Math.min(65535, raw.length - o); parts.push(o + n >= raw.length ? 1 : 0, n & 255, n >> 8, ~n & 255, (~n >> 8) & 255);
    for (let i = 0; i < n; i += 1) parts.push(raw[o + i]!);
  }
  let a = 1, b = 0; for (let i = 0; i < raw.length; i += 1) { a = (a + raw[i]!) % 65521; b = (b + a) % 65521; }
  parts.push((b >> 8) & 255, b & 255, (a >> 8) & 255, a & 255);
  return Uint8Array.from(parts);
}
function indexedPng(w: number, h: number, px: Uint8Array): Uint8Array {
  const ihdr = new Uint8Array(13); const dv = new DataView(ihdr.buffer); dv.setUint32(0, w); dv.setUint32(4, h); ihdr[8] = 8; ihdr[9] = 3;
  const plte = new Uint8Array(PAL.length * 3); PAL.forEach((c, i) => plte.set(c, i * 3));
  const raw = new Uint8Array((w + 1) * h); for (let y = 0; y < h; y += 1) raw.set(px.subarray(y * w, (y + 1) * w), y * (w + 1) + 1);
  const parts = [Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("PLTE", plte), chunk("IDAT", zstore(raw)), chunk("IEND", new Uint8Array())];
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0)); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function base64(b: Uint8Array): string {
  let s = "";
  for (let i = 0; i < b.length; i += 3) {
    const n = (b[i]! << 16) | ((b[i + 1] ?? 0) << 8) | (b[i + 2] ?? 0);
    s += B64[(n >> 18) & 63]! + B64[(n >> 12) & 63]! + (i + 1 < b.length ? B64[(n >> 6) & 63]! : "=") + (i + 2 < b.length ? B64[n & 63]! : "=");
  }
  return s;
}

/** 지형 미리보기 PNG(바이트). scale = 칸 하나의 화소 수. */
export function terrainPreviewPng(t: CodeTerrain, scale = 8): Uint8Array {
  const M = 16; // 위·왼쪽 눈금 여백
  const w = M + t.W * scale, h = M + t.H * scale;
  const px = new Uint8Array(w * h);
  const set = (x: number, y: number, v: number) => { if (x >= 0 && y >= 0 && x < w && y < h) px[y * w + x] = v; };
  const text = (s: string, x: number, y: number, v = 1) => { let cx = x; for (const ch of s) { const g = FONT[ch]; if (g) g.forEach((row, j) => [...row].forEach((b, i) => { if (b === "1") set(cx + i, y + j, v); })); cx += 4; } };
  for (let cy = 0; cy < t.H; cy += 1) for (let cx = 0; cx < t.W; cx += 1) {
    const c = cy * t.W + cx, wv = t.water[c]!;
    const v = wv === 1 ? 3 : wv === 2 ? 4 : wv === 3 ? 5 : 8 + Math.min(5, t.levels[c]!);
    for (let j = 0; j < scale; j += 1) for (let i = 0; i < scale; i += 1) set(M + cx * scale + i, M + cy * scale + j, v);
    // 단 경계(높은 칸 쪽에 선)
    const L = t.levels[c]!;
    if (!wv) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= t.W || ny >= t.H) continue;
      const n = ny * t.W + nx; if (t.water[n] || t.levels[n]! >= L) continue;
      for (let k = 0; k < scale; k += 1) {
        const x = M + cx * scale + (dx === 1 ? scale - 1 : dx === -1 ? 0 : k), y = M + cy * scale + (dy === 1 ? scale - 1 : dy === -1 ? 0 : k);
        set(x, y, 2); if (dy === 1) set(x, y - 1, 2); // 남쪽 절벽은 두 줄(3/4 시점에서 보이는 면)
      }
    }
  }
  // 눈금
  for (let k = 0; k <= Math.max(t.W, t.H); k += 5) {
    const strong = k % 10 === 0;
    if (k <= t.W) for (let y = M; y < h; y += strong ? 1 : 2) set(M + k * scale, y, strong ? 7 : 2);
    if (k <= t.H) for (let x = M; x < w; x += strong ? 1 : 2) set(x, M + k * scale, strong ? 7 : 2);
    if (strong || scale >= 8) { if (k < t.W) text(String(k), M + k * scale + 1, 5); if (k < t.H) text(String(k), 1, M + k * scale + 2); }
  }
  for (const k of t.crossings) for (let j = -1; j <= 1; j += 1) for (let i = -1; i <= 1; i += 1) set(M + k.x * scale + (scale >> 1) + i, M + k.y * scale + (scale >> 1) + j, 6);
  // 단 번호(넓은 덩이 한가운데)
  for (const a of t.areas.filter((q) => q.area >= 40)) text(String(a.level), M + a.cx * scale + (scale >> 1) - 1, M + a.cy * scale + (scale >> 1) - 2, a.level >= 3 ? 2 : 1);
  return indexedPng(w, h, px);
}

export function terrainPreviewDataUrl(t: CodeTerrain, scale = 8): string {
  return `data:image/png;base64,${base64(terrainPreviewPng(t, scale))}`;
}
