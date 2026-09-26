// 높이 지형(relief) 위에 마을을 얹어 보는 실험 — ops 로 지형을 짓고, 집·길·계단·나무를 단 높이만큼 올려 합성한다.
// 산출: /tmp/hill/relief-village*.png + 검사 글. 정본 저장이 아니라 렌더 실험이다.
//   npx --no-install tsx scripts/content/relief-village-demo.mts
import fs from "node:fs";
import { PNG } from "pngjs";
import { buildReliefOps, type ReliefOpsSpec } from "../../src/project/relief/ops";
import { checkRelief, reliefMatrixText } from "../../src/project/relief/check";
import { effectiveHeights, hsh3, renderRelief } from "../../src/project/relief/render";
import { stampFootprintHouseKit, type HouseKitId } from "../../src/editor/houseKit";

const OUT = process.argv[2] || "/tmp/hill";
const T = 16;
const spec: ReliefOpsSpec = {
  size: [56, 42], seed: 5,
  ops: [
    { op: "fill", h: 1 },
    { op: "plateau", rect: [-4, -4, 60, 11], h: 6, rough: 0.45 },
    { op: "mountain", at: [44, 1], peak: 8, slope: 2, rough: 0.3 },
    { op: "plateau", rect: [0, 8, 24, 21], h: 4, rough: 0.35 },
    { op: "plateau", rect: [32, 8, 55, 22], h: 5, rough: 0.35 },
    { op: "plateau", rect: [14, 15, 44, 27], h: 3, rough: 0.35 },
    { op: "plateau", rect: [0, 20, 20, 31], h: 2, rough: 0.35 },
    { op: "plateau", rect: [40, 22, 55, 32], h: 2, rough: 0.35 },
    { op: "canyon", path: [[3, 38], [12, 37], [18, 41]], width: 8, h: 0 },
    { op: "rough", amount: 0.2 },
  ],
};
const { h: raw } = buildReliefOps(spec);
const e = effectiveHeights(raw);
const H = e.length, W = e[0].length;
const rr = renderRelief(e);
const { PW, SH, pad, src } = rr;

// ---- 칩셋 ----
const chip = PNG.sync.read(fs.readFileSync("public/assets/easyrpg-chipset-combined-town-transparent.png"));
const out = new Uint8ClampedArray(rr.rgba);
const plain = new Uint8ClampedArray(rr.rgba);
const inb = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;
const lv = (x: number, y: number) => (inb(x, y) ? e[y][x] : -1);
// 앞(남쪽) 지형이 가리면 그리지 않는다: 그 화소를 그린 땅 칸이 물체 밑변보다 남쪽이고 더 높을 때
const occluded = (i: number, baseRow: number, L: number) => {
  const c = src[i];
  if (c < 0) return false;
  const cy = (c / W) | 0, cx = c % W;
  return cy > baseRow && e[cy][cx] > L;
};
function blitTile(id: number, cx: number, cy: number, L: number, baseRow: number) {
  if (id < 0 || Math.floor(id / 30) * T >= chip.height) return; // 칩셋 밖 id(더 큰 시트용 키트)는 건너뛴다
  const sx = (id % 30) * T, sy0 = Math.floor(id / 30) * T;
  const ox = cx * T, oy = cy * T + pad - L * T;
  for (let py = 0; py < T; py++) for (let px = 0; px < T; px++) {
    const X = ox + px, Y = oy + py;
    if (X < 0 || Y < 0 || X >= PW || Y >= SH) continue;
    const s = ((sy0 + py) * chip.width + sx + px) * 4;
    if (chip.data[s + 3] < 128) continue;
    const i = Y * PW + X;
    if (occluded(i, baseRow, L)) continue;
    out[i * 4] = chip.data[s]; out[i * 4 + 1] = chip.data[s + 1]; out[i * 4 + 2] = chip.data[s + 2]; out[i * 4 + 3] = 255;
  }
}
const rnd = (a: number, b: number, k = 0) => (hsh3(a, b, 977 + k) % 10000) / 10000;

// ---- 집: 같은 단의 평평한 자리(문 앞 한 줄 + 둘레 1칸 여유)를 찾아 단마다 세운다 ----
const used = new Uint8Array(W * H); // 1=집, 2=길, 3=나무, 4=집 둘레 여유
const houses: { x: number; y: number; w: number; h: number; L: number; kit: HouseKitId; door: [number, number]; lower: number[]; upper: number[] }[] = [];
const kits: HouseKitId[] = ["bright-plaster", "blue-stone", "amber-wood", "slate-wood", "timber-hall"];
const plan: [number, number, number][] = [ // [단, 폭, 높이]
  [6, 6, 5], [6, 5, 5], [5, 6, 5], [5, 5, 5], [4, 6, 5], [4, 5, 5], [3, 5, 5], [3, 4, 4], [2, 5, 5], [2, 6, 5], [1, 6, 5], [1, 5, 5], [1, 7, 7],
];
function flatAt(x0: number, y0: number, w: number, h: number, L: number) {
  for (let y = y0 - 1; y <= y0 + h + 1; y++) for (let x = x0 - 1; x <= x0 + w; x++) {
    if (!inb(x, y) || e[y][x] !== L) return false;
    if (used[y * W + x]) return false;
  }
  return true;
}
plan.forEach(([L, w, h], n) => {
  const cand: [number, number, number][] = [];
  for (let y = 1; y + h + 1 < H; y++) for (let x = 1; x + w < W; x++) if (flatAt(x, y, w, h, L)) cand.push([rnd(x, y, n), x, y]);
  if (!cand.length) { console.log(`단 ${L} ${w}×${h} 자리 없음`); return; }
  cand.sort((a, b) => a[0] - b[0]);
  const [, x, y] = cand[0];
  let kit = kits[0], m = null as unknown as { width: number; height: number; lowerTiles: number[]; upperTiles: number[]; events: unknown[] }, r = null as unknown as ReturnType<typeof stampFootprintHouseKit>;
  for (let k = 0; k < kits.length; k++) { // 찍기가 실패하면 다음 키트로
    kit = kits[(houses.length + k) % kits.length];
    m = { width: W, height: H, lowerTiles: new Array(W * H).fill(-1), upperTiles: new Array(W * H).fill(-1), events: [] };
    r = stampFootprintHouseKit(m as never, { wings: [{ x, y, w, h }], kitId: kit, doorEvent: false, stories: h >= 7 ? 2 : 1 });
    if (r.ok && r.doorAt) break;
  }
  if (!r.ok || !r.doorAt) { console.log(`집 실패 ${kit}: ${r.reason}`); return; }
  m.upperTiles[r.doorAt.y * W + r.doorAt.x] = 146;
  for (let yy = y - 1; yy <= y + h; yy++) for (let xx = x - 1; xx <= x + w; xx++) if (inb(xx, yy) && !used[yy * W + xx]) used[yy * W + xx] = 4;
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) used[yy * W + xx] = 1;
  houses.push({ x, y, w, h, L, kit, door: [r.doorAt.x, r.doorAt.y + 1], lower: m.lowerTiles, upper: m.upperTiles });
});

// ---- 길: 문 앞 → 광장. 같은 단은 사방으로, 남북은 곧은 벽(좌우 이웃도 같은 높이)에서만 계단으로 1~3단 ----
let plaza: [number, number] = [0, 0], best = -1;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (e[y][x] === 1 && !used[y * W + x]) {
  let s = 0;
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (lv(x + dx, y + dy) === 1 && !used[(y + dy) * W + x + dx]) s++;
  const score = s * 100 - Math.abs(x - W / 2) - Math.abs(y - (H - 8));
  if (score > best) { best = score; plaza = [x, y]; }
}
const straightDrop = (x: number, y: number) => { // (x,y) 와 (x,y+1) 사이 남향 벽이 곧은가
  const a = lv(x, y), b = lv(x, y + 1), k = a - b;
  if (k < 1 || k > 3) return false;
  return lv(x - 1, y) === a && lv(x + 1, y) === a && lv(x - 1, y + 1) === b && lv(x + 1, y + 1) === b;
};
const walkable = (x: number, y: number) => inb(x, y) && e[y][x] > 0 && used[y * W + x] !== 1 && used[y * W + x] !== 3;
const pathCell = new Uint8Array(W * H);
const stairs = new Map<number, number>(); // 윗칸 index → 단 차
function route(from: [number, number], to: [number, number]) {
  const dist = new Float64Array(W * H).fill(Infinity), prev = new Int32Array(W * H).fill(-1);
  const s = from[1] * W + from[0], g = to[1] * W + to[0];
  dist[s] = 0;
  const open: number[] = [s];
  while (open.length) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (dist[open[i]] < dist[open[bi]]) bi = i;
    const c = open.splice(bi, 1)[0];
    if (c === g) break;
    const x = c % W, y = (c / W) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (!walkable(nx, ny)) continue;
      let cost = pathCell[ny * W + nx] ? 0.4 : 1; // 이미 난 길을 타면 싸다 → 길이 합쳐진다
      if (e[ny][nx] !== e[y][x]) {
        if (dx !== 0) continue;
        const top = dy > 0 ? [x, y] : [nx, ny];
        if (!straightDrop(top[0], top[1])) continue;
        cost += 4;
      }
      const n = ny * W + nx, d = dist[c] + cost;
      if (d < dist[n]) { if (dist[n] === Infinity) open.push(n); dist[n] = d; prev[n] = c; }
    }
  }
  if (dist[g] === Infinity) return false;
  for (let c = g; c >= 0; c = prev[c]) {
    pathCell[c] = 1;
    const p = prev[c];
    if (p >= 0) {
      const a = Math.min(p, c), b = Math.max(p, c);
      if (b - a === W && e[(a / W) | 0][a % W] !== e[(b / W) | 0][b % W]) stairs.set(a, e[(a / W) | 0][a % W] - e[(b / W) | 0][b % W]);
    }
  }
  return true;
}
const unreached: string[] = [];
for (const hs of houses.slice().sort((a, b) => a.L - b.L)) if (!route(hs.door, plaza)) unreached.push(`${hs.kit}@${hs.L}단`);
for (let i = 0; i < W * H; i++) if (pathCell[i] && !used[i]) used[i] = 2;
for (let i = 0; i < W * H; i++) if (pathCell[i]) used[i] = 2;

// ---- 나무·덤불·꽃: 높은 단일수록, 절벽 가장자리일수록 촘촘히 ----
type Obj = { base: number; L: number; draw: () => void };
const objs: Obj[] = [];
const freeFor = (x: number, y: number, L: number) => inb(x, y) && e[y][x] === L && !used[y * W + x];
for (let y = 1; y < H; y++) for (let x = 0; x < W; x++) {
  const L = lv(x, y);
  if (L <= 0 || !freeFor(x, y, L)) continue;
  let edge = 0;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [0, 2]]) if (lv(x + dx, y + dy) !== L) edge++;
  const p = 0.05 + L * 0.03 + edge * 0.06 + (L >= 6 ? 0.06 : 0);
  const r = rnd(x, y, 3);
  if (r < p * 0.55) {
    used[y * W + x] = 3;
    objs.push({ base: y, L, draw: () => { blitTile(260, x, y - 1, L, y); blitTile(290, x, y, L, y); } });
  } else if (r < p && freeFor(x + 1, y, L)) {
    used[y * W + x] = used[y * W + x + 1] = 3;
    objs.push({ base: y, L, draw: () => { blitTile(262, x, y - 1, L, y); blitTile(263, x + 1, y - 1, L, y); blitTile(292, x, y, L, y); blitTile(293, x + 1, y, L, y); } });
  } else if (r < p + 0.05) {
    used[y * W + x] = 3;
    objs.push({ base: y, L, draw: () => blitTile(289, x, y, L, y) });
  } else if (r < p + 0.09) {
    objs.push({ base: y, L, draw: () => blitTile(288, x, y, L, y) });
  }
}
for (const hs of houses) objs.push({
  base: hs.y + hs.h - 1, L: hs.L, draw: () => {
    for (let yy = hs.y; yy < hs.y + hs.h; yy++) for (let xx = hs.x; xx < hs.x + hs.w; xx++) {
      blitTile(hs.lower[yy * W + xx], xx, yy, hs.L, hs.y + hs.h - 1);
      blitTile(hs.upper[yy * W + xx], xx, yy, hs.L, hs.y + hs.h - 1);
    }
  },
});

// ---- 합성: 물 → 길 → 계단 → 물체(북→남) ----
// 물: 0단 윗면을 절차적으로 칠한다(칩셋 120 은 오토타일 조각이라 한 장으로 깔면 보라 판이 된다)
for (let Y = 0; Y < SH; Y++) for (let X = 0; X < PW; X++) {
  const i = Y * PW + X, c = src[i];
  if (c < 0 || e[(c / W) | 0][c % W] !== 0) continue;
  const cy = (c / W) | 0, top = cy * T + pad;
  if (Y < top || Y >= top + T) continue; // 윗면만
  const wave = Math.sin(X * 0.35 + Y * 0.9) + Math.sin(X * 0.13 - Y * 0.5);
  const shore = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => lv((c % W) + dx, cy + dy) > 0);
  const col: [number, number, number] = wave > 1.5 ? [150, 200, 235] : wave > 0.6 ? [70, 130, 200] : [48, 98, 176];
  if (shore && (hsh3(X, Y, 3) % 5 === 0)) { col[0] = 170; col[1] = 215; col[2] = 240; }
  out[i * 4] = col[0]; out[i * 4 + 1] = col[1]; out[i * 4 + 2] = col[2]; out[i * 4 + 3] = 255;
}
for (let i = 0; i < W * H; i++) if (pathCell[i]) blitTile(360, i % W, (i / W) | 0, e[(i / W) | 0][i % W], (i / W) | 0);
const setPx = (X: number, Y: number, c: [number, number, number]) => { const o = (Y * PW + X) * 4; out[o] = c[0]; out[o + 1] = c[1]; out[o + 2] = c[2]; };
for (const [top, k] of stairs) {
  const x = top % W, y = (top / W) | 0, L = e[y][x];
  const y0 = (y + 1) * T + pad - L * T, y1 = y0 + k * T;
  for (let Y = y0; Y < y1; Y++) for (let X = x * T + 1; X < x * T + 15; X++) {
    if (occluded(Y * PW + X, y, L)) continue;
    const t = (Y - y0) % 5, side = X === x * T + 1 || X === x * T + 14;
    setPx(X, Y, side ? [74, 66, 56] : t === 0 ? [212, 202, 178] : t === 4 ? [96, 86, 72] : [176, 164, 140]);
  }
}
objs.sort((a, b) => a.base - b.base || a.L - b.L);
for (const o of objs) o.draw();

// ---- 저장 ----
const save = (name: string, data: Uint8ClampedArray) => {
  const png = new PNG({ width: PW, height: SH });
  png.data = Buffer.from(data);
  fs.writeFileSync(`${OUT}/${name}`, PNG.sync.write(png));
};
save("relief-village.png", out);
save("relief-village-plain.png", plain);
save("relief-village-xray.png", rr.xray);
const chk = checkRelief(raw);
const lines = [
  chk.text,
  `집 ${houses.length}채: ` + houses.map((hs) => `${hs.kit} ${hs.L}단 [${hs.x},${hs.y}] ${hs.w}×${hs.h}`).join(", "),
  `광장 ${JSON.stringify(plaza)}, 길 ${pathCell.reduce((a, b) => a + b, 0)}칸, 계단 ${stairs.size}곳 (` + [...stairs].map(([t, k]) => `[${t % W},${(t / W) | 0}] ${k}단`).join(" ") + ")",
  unreached.length ? `길이 안 닿은 집: ${unreached.join(", ")}` : "모든 집이 광장까지 이어짐",
];
fs.writeFileSync(`${OUT}/relief-village.txt`, lines.join("\n") + "\n\n" + reliefMatrixText(e) + "\n");
fs.writeFileSync(`${OUT}/relief-village-spec.json`, JSON.stringify(spec, null, 1));
console.log(lines.join("\n"));
console.log(`${PW}×${SH}`);
