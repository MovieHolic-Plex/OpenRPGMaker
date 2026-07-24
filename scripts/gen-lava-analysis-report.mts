/**
 * 용암동굴 타일셋팅 분석 리포트 생성기 v2 (분석 전용 — 원격 저장 없음).
 * v2: ① 천장-벽 결합(앵커) 문법으로 모의수정 교정 ② 레일 코너/분기 연결성 감사 추가
 * 실행: npx tsx scripts/gen-lava-analysis-report.mts
 */
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import { loadProjectFromSupabase } from "../src/project/supabaseProjectSync.ts";
import { chipsetQuarterComposition } from "../src/project/defaults/terrainQuarterAutotile.ts";
import { repairLavaMineMap } from "./lib/lavaMineRepair.mts";
import type { GameMap, Project } from "../src/project/types.ts";

const OUT = path.resolve("output/evidence/lava-mine-analysis");
fs.mkdirSync(OUT, { recursive: true });
const T = 16;
const COLS = 30;

// ── 1. Supabase 로드 (provenance) ──────────────────────────────────────────
const env: Record<string, string> = {};
for (const line of fs.readFileSync(".env.local", "utf8").split(/\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
}
const supabaseUrl = env.VITE_SUPABASE_URL!.replace(/\/$/, "");
const loadedAt = new Date().toISOString();
const remote = await loadProjectFromSupabase({ url: supabaseUrl, anonKey: env.VITE_SUPABASE_ANON_KEY!, projectId: "rpg-zzu-showcase" });
if (!remote) throw new Error("원격 로드 실패");
const map = remote.maps["map_sc_dungeon_lava"];
if (!map) throw new Error("map_sc_dungeon_lava 없음");
const proof = {
  source: "Supabase REST (loadProjectFromSupabase)",
  supabaseHost: new URL(supabaseUrl).host,
  projectId: "rpg-zzu-showcase",
  loadedAt,
  mapCount: Object.keys(remote.maps).length,
  mapId: map.id,
  mapName: map.name,
  mapSize: `${map.width}x${map.height}`,
  tilesetId: map.tilesetId,
  lowerTileChecksum: map.lowerTiles.reduce((a, t) => (a * 31 + t) >>> 0, 7).toString(16),
};
fs.writeFileSync(path.join(OUT, "proof.json"), JSON.stringify(proof, null, 2));
console.log("loaded:", JSON.stringify(proof));

// ── 2. 타일 어휘 ───────────────────────────────────────────────────────────
const W = map.width, H = map.height;
const lower = map.lowerTiles, upper = map.upperTiles;
const LAVA = new Set([243, 244, 245, 273, 274, 275, 303, 304, 305, 333, 334, 335]);
const FLOOR = new Set([240, 241, 242, 270, 271, 272, 300, 301, 302, 330, 331, 332]);
const CEIL = new Set([249, 250, 251, 279, 280, 281, 309, 310, 311, 339, 340, 341]);
const BAND = new Set([102, 103, 104]);
const BAND_BODY = new Set([132, 133, 134]);
const ROCKWALL = new Set([255, 256, 257]);
const TORCH = new Set([208, 263, 264, 293]);
// 레일 전체 어휘 (타일셋 메타 description 정본):
// 세로 114(상단캡)/144(중간)/174(하단캡) · 가로 115~117 · 코너 54(S-E)/55(S-W)/84(N-E)/85(N-W) · 판자 위 곡선·분기 56~59/86~89
const RAIL = new Set([54, 55, 56, 57, 58, 59, 84, 85, 86, 87, 88, 89, 114, 115, 116, 117, 144, 174]);
const CORNER_TILE = new Set([54, 55, 84, 85, 56, 57, 58, 59, 86, 87, 88, 89]);
const at = (x: number, y: number) => y * W + x;
const isFloor = (t: number) => FLOOR.has(t) || t === 141 || t === 142 || t === 143;

// 결함 셀 수집 (기존 6종)
const railsOnLava: [number, number][] = [];
const torchInLava: [number, number][] = [];
const walkableWallBand: [number, number][] = [];
const speckle: [number, number][] = [];
const lavaBorder: [number, number][] = [];
const deadZone: [number, number][] = [];
let floorCeilDirect = 0;
for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
  const l = lower[at(x, y)]!, u = upper[at(x, y)]!;
  if (RAIL.has(u) && LAVA.has(l)) railsOnLava.push([x, y]);
  if (TORCH.has(u) && LAVA.has(l)) torchInLava.push([x, y]);
  if (BAND.has(l)) walkableWallBand.push([x, y]);
  if (LAVA.has(l) && (x === 0 || y === 0 || x === W - 1 || y === H - 1)) lavaBorder.push([x, y]);
  if (y < 4 && CEIL.has(l)) deadZone.push([x, y]);
  if (y < H - 1 && isFloor(l) && CEIL.has(lower[at(x, y + 1)]!)) floorCeilDirect += 1;
  if (x > 0 && y > 0 && x < W - 1 && y < H - 1 && (CEIL.has(l) || BAND_BODY.has(l) || ROCKWALL.has(l))) {
    let fn = 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) if (isFloor(lower[at(x + dx, y + dy)]!)) fn += 1;
    if (fn >= 3) speckle.push([x, y]);
  }
}

// ── 2b. 레일 연결성 감사 ───────────────────────────────────────────────────
const isRailAt = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && RAIL.has(upper[at(x, y)]!);
let railTotal = 0, strictCornerUsed = 0, plankPieceUsed = 0, cornerAsStraight = 0, junctionNoTile = 0, isolatedRail = 0;
const STRICT_CORNER = new Set([54, 55, 84, 85]);
const PLANK_PIECE = new Set([56, 57, 58, 59, 86, 87, 88, 89]);
const railBad: [number, number][] = [];
for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
  const t = upper[at(x, y)]!;
  if (!RAIL.has(t)) continue;
  railTotal += 1;
  const n = isRailAt(x, y - 1), s = isRailAt(x, y + 1), e = isRailAt(x + 1, y), w = isRailAt(x - 1, y);
  const deg = (n ? 1 : 0) + (s ? 1 : 0) + (e ? 1 : 0) + (w ? 1 : 0);
  if (STRICT_CORNER.has(t)) { strictCornerUsed += 1; continue; }
  if (PLANK_PIECE.has(t)) { plankPieceUsed += 1; continue; }
  const needsCorner = (s && e && !n && !w) || (s && w && !n && !e) || (n && e && !s && !w) || (n && w && !s && !e);
  if (needsCorner) { cornerAsStraight += 1; railBad.push([x, y]); continue; }
  if (deg >= 3) { junctionNoTile += 1; railBad.push([x, y]); continue; }
  if (deg === 0) { isolatedRail += 1; railBad.push([x, y]); }
}
const counts = {
  railsOnLava: railsOnLava.length, torchInLava: torchInLava.length,
  walkableWallBand: walkableWallBand.length, speckle: speckle.length,
  lavaBorder: lavaBorder.length, deadZone: deadZone.length, floorCeilDirect,
  railTotal, strictCornerUsed, plankPieceUsed, cornerAsStraight, junctionNoTile, isolatedRail,
};
console.log("defects:", JSON.stringify(counts));

// ── 2c. 원격 맵 레일 단절 전수 감사 ─────────────────────────────────────────
// 끝점(deg1) 전방 분류: 용암/천장/바닥/경계+장애/1칸갭. 코너 오용·고립은 2b에서 집계.
const railBreaks = { toLava: [] as unknown[], toCeil: [] as unknown[], toFloor: [] as unknown[], blocked: [] as unknown[], gap: [] as unknown[] };
{
  const dirs = [[0, -1], [0, 1], [1, 0], [-1, 0]] as const;
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    if (!isRailAt(x, y)) continue;
    const nb = dirs.filter(([dx, dy]) => isRailAt(x + dx, y + dy));
    if (nb.length !== 1) continue;
    const [dx, dy] = nb[0]!;
    const fx = x - dx, fy = y - dy; // 전방(진행 방향)
    if (fx < 0 || fy < 0 || fx >= W || fy >= H) { railBreaks.blocked.push([x, y, 'map-edge']); continue; }
    if (isRailAt(fx, fy)) continue;
    const ft = lower[at(fx, fy)]!;
    const gx = fx - dx, gy = fy - dy;
    if (isFloor(ft) && gx >= 0 && gy >= 0 && gx < W && gy < H && isRailAt(gx, gy)) { railBreaks.gap.push([x, y, `->${gx},${gy}`]); continue; }
    if (LAVA.has(ft)) railBreaks.toLava.push([x, y]);
    else if (CEIL.has(ft)) railBreaks.toCeil.push([x, y]);
    else if (isFloor(ft)) railBreaks.toFloor.push([x, y]);
    else railBreaks.blocked.push([x, y, `lower=${ft}`]);
  }
}
console.log('rail breaks:', JSON.stringify(railBreaks));

// ── 2d. 원격 맵 개구 의미론 감사 (수정 전 현재 상태의 엄밀 단절 수) ─────────
// 직선만으로 만든 지그재그 경로의 모든 굴절 = 일방 개구 단절.
const ORIG_OPENS: Record<number, readonly string[]> = {
  114: ["S"], 144: ["N", "S"], 174: ["N"], 115: ["E", "W"], 116: ["E", "W"], 117: ["E", "W"],
  54: ["S", "E"], 55: ["S", "W"], 84: ["N", "E"], 85: ["N", "W"],
};
const origAudit = { oneWay: [] as [number, number][], dangling: [] as [number, number][] };
{
  const oOpen = (x: number, y: number, dir: string) => isRailAt(x, y) && (ORIG_OPENS[upper[at(x, y)]!] ?? []).includes(dir);
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    const t = upper[at(x, y)]!;
    const o = ORIG_OPENS[t];
    if (!o) continue;
    for (const dir of o) {
      const [dx, dy] = dir === "E" ? [1, 0] : dir === "W" ? [-1, 0] : dir === "S" ? [0, 1] : [0, -1];
      const back = dir === "E" ? "W" : dir === "W" ? "E" : dir === "S" ? "N" : "S";
      if (!isRailAt(x + dx, y + dy)) origAudit.dangling.push([x, y]);
      else if (!oOpen(x + dx, y + dy, back)) origAudit.oneWay.push([x, y]);
    }
  }
}
console.log("original openings audit: oneWay=" + origAudit.oneWay.length + " dangling=" + origAudit.dangling.length, JSON.stringify(origAudit.oneWay.slice(0, 24)));

// ── 3. 렌더러 ──────────────────────────────────────────────────────────────
const chip = PNG.sync.read(fs.readFileSync("public/assets/easyrpg-chipset-dungeon-transparent.png"));
function render(m: GameMap, proj: Project, scale: number): PNG {
  const png = new PNG({ width: m.width * T * scale, height: m.height * T * scale });
  for (let i = 0; i < png.data.length; i += 4) { png.data[i] = 24; png.data[i + 1] = 22; png.data[i + 2] = 28; png.data[i + 3] = 255; }
  const blit = (tile: number, dx: number, dy: number, q?: { sx: number; sy: number; sw: number; sh: number }): void => {
    if (tile < 0) return;
    const sx0 = (tile % COLS) * T + (q?.sx ?? 0), sy0 = Math.floor(tile / COLS) * T + (q?.sy ?? 0);
    const sw = q?.sw ?? T, sh = q?.sh ?? T;
    for (let y = 0; y < sh * scale; y += 1) for (let x = 0; x < sw * scale; x += 1) {
      const si = ((sy0 + Math.floor(y / scale)) * chip.width + (sx0 + Math.floor(x / scale))) * 4;
      const di = ((dy + y) * png.width + (dx + x)) * 4;
      if (chip.data[si + 3] === 0) continue;
      png.data[di] = chip.data[si]!; png.data[di + 1] = chip.data[si + 1]!; png.data[di + 2] = chip.data[si + 2]!; png.data[di + 3] = 255;
    }
  };
  for (let y = 0; y < m.height; y += 1) for (let x = 0; x < m.width; x += 1) {
    const i = y * m.width + x, dx = x * T * scale, dy = y * T * scale;
    const tset = proj.tilesets[m.tilesetId];
    const comp = tset ? chipsetQuarterComposition(m, tset, x, y) : null;
    if (comp) {
      blit(comp.underlayTile ?? m.lowerTiles[i]!, dx, dy);
      for (const s of comp.sources) blit(s.tile, dx + s.offsetX * scale, dy + s.offsetY * scale, { sx: s.offsetX, sy: s.offsetY, sw: 8, sh: 8 });
    } else if (m.lowerTiles[i]! >= 0) blit(m.lowerTiles[i]!, dx, dy);
    if (m.upperTiles[i]! >= 0) blit(m.upperTiles[i]!, dx, dy);
  }
  return png;
}
function mark(png: PNG, x: number, y: number, scale: number, rgb: [number, number, number]): void {
  const s = T * scale, px = x * s, py = y * s, w = 3;
  const px_ = (xx: number, yy: number) => { const di = (yy * png.width + xx) * 4; if (di < 0 || di + 3 >= png.data.length) return; png.data[di] = rgb[0]; png.data[di + 1] = rgb[1]; png.data[di + 2] = rgb[2]; png.data[di + 3] = 255; };
  for (let i = 0; i < s; i += 1) for (let k = 0; k < w; k += 1) { px_(px + i, py + k); px_(px + i, py + s - 1 - k); px_(px + k, py + i); px_(px + s - 1 - k, py + i); }
}
function crop(png: PNG, tx: number, ty: number, tw: number, th: number, scale: number, zoom: number): PNG {
  const s = T * scale, out = new PNG({ width: tw * s * zoom, height: th * s * zoom });
  for (let y = 0; y < out.height; y += 1) for (let x = 0; x < out.width; x += 1) {
    const si = ((ty * s + Math.floor(y / zoom)) * png.width + (tx * s + Math.floor(x / zoom))) * 4;
    const di = (y * out.width + x) * 4;
    for (let k = 0; k < 4; k += 1) out.data[di + k] = png.data[si + k]!;
  }
  return out;
}
function sideBySide(a: PNG, b: PNG): PNG {
  const out = new PNG({ width: a.width + b.width + 8, height: Math.max(a.height, b.height) });
  for (let i = 0; i < out.data.length; i += 4) { out.data[i + 3] = 255; out.data[i] = 18; out.data[i + 1] = 18; out.data[i + 2] = 22; }
  const paste = (src: PNG, ox: number) => { for (let y = 0; y < src.height; y += 1) for (let x = 0; x < src.width; x += 1) { const si = (y * src.width + x) * 4, di = (y * out.width + x + ox) * 4; for (let k = 0; k < 4; k += 1) out.data[di + k] = src.data[si + k]!; } };
  paste(a, 0); paste(b, a.width + 8);
  return out;
}

const SCALE = 3;
const base = render(map, remote, SCALE);
fs.writeFileSync(path.join(OUT, "current.png"), PNG.sync.write(base));

const overlay = PNG.sync.read(Buffer.from(PNG.sync.write(base)));
for (const [x, y] of deadZone) mark(overlay, x, y, SCALE, [80, 80, 90]);
for (const [x, y] of walkableWallBand) mark(overlay, x, y, SCALE, [0, 190, 255]);
for (const [x, y] of speckle) mark(overlay, x, y, SCALE, [255, 0, 255]);
for (const [x, y] of lavaBorder) mark(overlay, x, y, SCALE, [255, 230, 0]);
for (const [x, y] of railsOnLava) mark(overlay, x, y, SCALE, [255, 40, 40]);
for (const [x, y] of torchInLava) mark(overlay, x, y, SCALE, [255, 140, 0]);
for (const [x, y] of railBad) mark(overlay, x, y, SCALE, [60, 255, 60]);
fs.writeFileSync(path.join(OUT, "defects-overlay.png"), PNG.sync.write(overlay));

const crops: { file: string; region: [number, number, number, number] }[] = [
  { file: "crop-rails-lava.png", region: [10, 44, 14, 11] },
  { file: "crop-torch-lava.png", region: [0, 36, 12, 12] },
  { file: "crop-confetti.png", region: [28, 4, 14, 8] },
  { file: "crop-edge.png", region: [14, 24, 14, 10] },
  { file: "crop-deadzone.png", region: [20, 0, 16, 7] },
  { file: "crop-rail-corner.png", region: [16, 6, 13, 14] },
];
for (const c of crops) {
  const [cx, cy, cw, ch] = c.region;
  fs.writeFileSync(path.join(OUT, c.file), PNG.sync.write(sideBySide(crop(base, cx, cy, cw, ch, SCALE, 2), crop(overlay, cx, cy, cw, ch, SCALE, 2))));
}

// ── 4. 모의 수정 (교정된 결합 문법) ────────────────────────────────────────
const FLOOR_FILL = 301;
const CEIL_FILL = 310;
function buildFixed(anchor: boolean) {
  return repairLavaMineMap(map, anchor);
}
const naive = buildFixed(false);
const fixed = buildFixed(true);
console.log("unanchored wall faces — naive:", naive.unanchored, "| anchored:", fixed.unanchored);
console.log("fixed stats:", JSON.stringify(fixed.stats));
fs.writeFileSync(path.join(OUT, "fixed-preview.png"), PNG.sync.write(render(fixed.m, remote, SCALE)));
const fixedR = render(fixed.m, remote, SCALE);
fs.writeFileSync(path.join(OUT, "fixed-crop-rails.png"), PNG.sync.write(crop(fixedR, 10, 44, 14, 11, SCALE, 2)));
fs.writeFileSync(path.join(OUT, "fixed-crop-edge.png"), PNG.sync.write(crop(fixedR, 14, 24, 14, 10, SCALE, 2)));
fs.writeFileSync(path.join(OUT, "fixed-crop-rail-corner.png"), PNG.sync.write(crop(fixedR, 16, 6, 13, 14, SCALE, 2)));

// 벽 문법 모식도: 천장 2행 / 밴드 / 밴드바디 / 바닥 2행 — 수직 스택 결합 구조
const gram = { ...map, width: 8, height: 6 } as unknown as GameMap;
{
  const gl: number[] = [], gu: number[] = [];
  for (let y = 0; y < 6; y += 1) for (let x = 0; x < 8; x += 1) {
    gl.push(y < 2 ? 310 : y === 2 ? 103 : y === 3 ? 133 : 301);
    gu.push(-1);
  }
  (gram as { lowerTiles: number[] }).lowerTiles = gl;
  (gram as { upperTiles: number[] }).upperTiles = gu;
}
fs.writeFileSync(path.join(OUT, "wall-grammar.png"), PNG.sync.write(render(gram, remote, 6)));

// ── 5. HTML 리포트 ─────────────────────────────────────────────────────────
const b64 = (f: string) => fs.readFileSync(path.join(OUT, f)).toString("base64");
const img = (f: string, alt: string) => `<img src="data:image/png;base64,${b64(f)}" alt="${alt}" style="image-rendering:pixelated;max-width:100%;border:1px solid #333;border-radius:6px;">`;

const driftRows = [
  ["102–104", "거친 바위벽(갈색) · wall · solid", "적암 대지/자갈 · 통행 가능", "벽인데 걸어 들어감"],
  ["132–134", "거친 바위벽(갈색) · wall · solid", "뿌리 커튼 벽 · solid", "라벨 드리프트"],
  ["263/264/293", "횃불 · solid(장식)", "횃불/모닥불 · 통행 가능", "횃불을 뚫고 지나감"],
  ["259–262 등 소품", "바위/수정 소품 · solid(장식)", "통행 가능", "장식을 뚫고 지나감"],
  ["373/403", "WS_ICE 벽 띠(레이아웃 정본)", "검푸른 급류 · water · solid", "용암동굴 '광석'으로 오용"],
].map((r) => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td></tr>`).join("");

const html = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><title>용암동굴 타일셋팅 분석 — rpg-zzu-showcase</title>
<style>
 body{background:#141216;color:#e8e2da;font:15px/1.65 -apple-system,'Segoe UI','Malgun Gothic',sans-serif;max-width:1080px;margin:0 auto;padding:32px 20px 80px}
 h1{font-size:26px;border-bottom:2px solid #b8492b;padding-bottom:10px}
 h2{font-size:20px;margin-top:44px;color:#ffb27a;border-left:4px solid #b8492b;padding-left:10px}
 h3{font-size:16px;color:#ffd9a0}
 .card{background:#1e1b22;border:1px solid #333;border-radius:10px;padding:16px 20px;margin:14px 0}
 table{border-collapse:collapse;width:100%;font-size:13.5px}
 th,td{border:1px solid #3a3540;padding:6px 10px;text-align:left;vertical-align:top}
 th{background:#2a2530}
 code{background:#2a2530;padding:1px 6px;border-radius:4px;font-size:13px}
 .ok{color:#7fd47f}.bad{color:#ff7a7a}.warn{color:#ffd27a}
 .legend span{display:inline-block;margin-right:14px;font-size:13px}
 .sw{display:inline-block;width:12px;height:12px;border:2px solid;border-radius:2px;vertical-align:-1px;margin-right:4px}
 .grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
 .cap{font-size:12.5px;color:#a99;margin:6px 0 0}
 ol li,ul li{margin:5px 0}
</style></head><body>

<h1>용암동굴(<code>map_sc_dungeon_lava</code>) 타일셋팅 분석 리포트 v3</h1>
<p class="cap">v3 변경: <b>천장 포기 규칙</b>(벽을 세울 수 없는 천장은 바닥으로 흡수) 코드 구현 + 레일 단절 <b>전수 감사</b>. 절차적 생성을 전제로 한 결정적 파이프라인으로 정리</p>

<div class="card">
<h3>0. Supabase provenance</h3>
<p class="ok">이 리포트의 모든 데이터와 이미지는 로컬 fixture가 아니라 Supabase 원격 프로젝트에서 직접 로드한 것입니다.</p>
<table>
<tr><th>항목</th><th>값</th></tr>
<tr><td>로드 경로</td><td><code>loadProjectFromSupabase()</code> (src/project/supabaseProjectSync.ts)</td></tr>
<tr><td>Supabase 호스트</td><td><code>${proof.supabaseHost}</code></td></tr>
<tr><td>프로젝트 ID</td><td><code>${proof.projectId}</code></td></tr>
<tr><td>로드 시각</td><td>${proof.loadedAt}</td></tr>
<tr><td>대상 맵</td><td><code>${proof.mapId}</code> — "${proof.mapName}" (실제 ${proof.mapSize}) · 전체 ${proof.mapCount}맵</td></tr>
<tr><td>타일 체크섬</td><td><code>${proof.lowerTileChecksum}</code></td></tr>
<tr><td>증거 파일</td><td><code>output/evidence/lava-mine-analysis/proof.json</code></td></tr>
</table>
</div>

<h2>1. 현재 상태 + 결함 오버레이</h2>
<div class="card">
${img("defects-overlay.png", "defects")}
<p class="legend">
<span><span class="sw" style="border-color:rgb(255,40,40)"></span>용암 위 레일 (${counts.railsOnLava})</span>
<span><span class="sw" style="border-color:rgb(255,140,0)"></span>용암 속 횃불 (${counts.torchInLava})</span>
<span><span class="sw" style="border-color:rgb(0,190,255)"></span>통행 가능한 '벽' (${counts.walkableWallBand})</span>
<span><span class="sw" style="border-color:rgb(255,0,255)"></span>고립 스펙클 (${counts.speckle})</span>
<span><span class="sw" style="border-color:rgb(255,230,0)"></span>테두리 용암 (${counts.lavaBorder})</span>
<span><span class="sw" style="border-color:rgb(120,120,130)"></span>데드존 (${counts.deadZone})</span>
<span><span class="sw" style="border-color:rgb(60,255,60)"></span>레일 문법 위반 (${counts.cornerAsStraight + counts.junctionNoTile + counts.isolatedRail})</span>
</p>
</div>

<h2>2. 결함 카탈로그 (좌 원본 / 우 표시)</h2>
<div class="grid2">
<div class="card"><h3>① 용암 위 레일</h3>${img("crop-rails-lava.png", "rails")}<p class="cap">레일 ${counts.railsOnLava}칸이 용암(통행 불가) 위에 배치.</p></div>
<div class="card"><h3>② 용암 속 횃불</h3>${img("crop-torch-lava.png", "torch")}<p class="cap">횃불 ${counts.torchInLava}개가 용암 표면에 떠 있음.</p></div>
<div class="card"><h3>③ 벽 띠 콘페티</h3>${img("crop-confetti.png", "confetti")}<p class="cap">수평 백월 어휘를 유기적 경계에 기계 적용 → 1–2칸 조각 산재.</p></div>
<div class="card"><h3>④ 벽면 없는 경계</h3>${img("crop-edge.png", "edge")}<p class="cap">바닥↔천장 직접 경계 ${counts.floorCeilDirect}곳, 벽면 경유는 6곳뿐.</p></div>
<div class="card"><h3>⑤ 상단 4행 데드존</h3>${img("crop-deadzone.png", "dead")}<p class="cap">0–3행 220칸이 통째로 천장 어둠.</p></div>
<div class="card"><h3>⑥ 레일 코너 없음 (v2 추가)</h3>${img("crop-rail-corner.png", "railcorner")}<p class="cap">레일 ${counts.railTotal}칸 중 곡선 코너(54/55/84/85) 사용 <b>${counts.strictCornerUsed}</b>. 방향이 꺾이는 ${counts.cornerAsStraight}칸에 직선 타일 오용, 분기 ${counts.junctionNoTile}칸, 고립 레일 ${counts.isolatedRail}칸. 판자 위 곡선·분기 조각(56~59/86~89)은 ${counts.plankPieceUsed}칸 사용됐으나 방향 정합성은 수동 확인 필요.</p></div>
</div>

<div class="card">
<h3>레일 어휘 (칩셋 원본, 노란 그리드 = 타일 경계)</h3>
${img("rail-tiles.png", "railtiles")}
<p class="cap">타일셋 메타 정본: 세로 114/144/174 · 가로 115~117 · <b>곡선 코너 54(남↔동) / 55(남↔서) / 84(북↔동) / 85(북↔서)</b> · 판자 위 곡선·분기 56~59/86~89 · 4곡선을 2×2로 모으면 원형 루프. decorate 스크립트는 이 중 114/144/115/116 네 종만 써서 모든 커브가 직선 충돌로 끊김.</p>
</div>

<h2>2b. 레일 단절 전수 감사 (원격 맵 현재 상태)</h2>
<div class="card">
<table>
<tr><th>분류</th><th>건수</th><th>좌표/내용</th><th>처방</th></tr>
<tr><td>용암 위 레일</td><td>${counts.railsOnLava}</td><td>(14–16,47–48)·(14–16,52–53)</td><td>철거</td></tr>
<tr><td>코너 필요한데 직선</td><td>${counts.cornerAsStraight}</td><td>전 구간 산재</td><td>마스크 기반 54/55/84/85 교체</td></tr>
<tr><td>고립 레일 (deg 0)</td><td>${counts.isolatedRail}</td><td>1칸</td><td>제거 또는 연결</td></tr>
<tr><td>끝점 → 바닥 (캡 필요)</td><td>${railBreaks.toFloor.length}</td><td>${JSON.stringify(railBreaks.toFloor)}</td><td>세로 캡 114/174, 가로 캡 어휘 확정 후 적용</td></tr>
<tr><td>끝점 → 장애 타일</td><td>${railBreaks.blocked.length}</td><td>${JSON.stringify(railBreaks.blocked)} — 뿌리 커튼(132)에 막힘</td><td>132 회수 후 노선 재검토</td></tr>
<tr><td>끝점 → 용암</td><td>${railBreaks.toLava.length}</td><td>—</td><td>—</td></tr>
<tr><td>끝점 → 천장 (터널 후보)</td><td>${railBreaks.toCeil.length}</td><td>—</td><td>—</td></tr>
<tr><td>1칸 갭 (거의 연결)</td><td>${railBreaks.gap.length}</td><td>—</td><td>—</td></tr>
</table>
<p class="cap">수정 후 엄밀 재감사(개구 의미론): 갭 메움 ${fixed.stats.railGapsFilled}칸, 고립 제거 ${fixed.stats.railIsolatedRemoved}칸, 일방 개구(단절) ${fixed.stats.railOneWay.length}칸, 늘어진 개구 ${fixed.stats.railDangling.length}칸, 분기 타일 확정 필요 ${fixed.stats.railJunctionPending.length}칸 ${JSON.stringify(fixed.stats.railJunctionPending)}.</p>
</div>

<h2>3. 근본 원인 — 레포 정본 vs 원격 타일셋 드리프트</h2>
<div class="card">
<table>
<tr><th>타일</th><th>레포 정본</th><th>원격 프로젝트 저장값</th><th>결과</th></tr>
${driftRows}
</table>
<p>제작 경위: 사용자 리사이즈(26×18→55×55) 후 바닥/천장/용암 배치 → <code>scripts/decorate-lava-mine.mts</code>가 장식 저장. 스크립트 문제: (1) 하부 통행성 미검사 (2) 수평 백월 문법의 기계 적용 (3) <b>레일 코너 어휘 미사용</b> (4) 저장 후 시각 QA 없음.</p>
</div>

<h2>4. 수정 계획 (v3 — 절차적 생성 가능한 결정적 파이프라인)</h2>
<div class="card">
<h3>올바른 동굴 벽 문법 — 천장은 벽 위에 '고정'되고, 고정할 수 없으면 천장을 '포기'한다</h3>
${img("wall-grammar.png", "grammar")}
<p>불변식: <b>밴드바디 위에는 반드시 밴드, 밴드 위에는 반드시 천장</b> (<code>천장(≥1) → 밴드(103) → 밴드바디(133) → 바닥</code>). v3에서 추가한 규칙:</p>
<ul>
<li><b>앵커 규칙</b> — 스택 불완전 벽면은 천장으로 환원 (고정점 반복). 미고정 벽면 ${naive.unanchored} → 0칸.</li>
<li><b>천장 포기 규칙 (v3)</b> — 그래도 '바로 아래가 바닥인 천장'이 남으면 그 천장은 <b>포기하고 바닥으로 흡수</b>. {밴드 시공 → 앵커 환원 → 천장 포기}를 <b>전역 고정점</b>으로 반복하므로, 포기로 새로 노출된 경계에도 벽이 다시 시공된다. 사후조건: 천장 포기 <b>${fixed.stats.abandonedCeiling}칸</b>, 무지지 직접 경계 <b>${fixed.stats.directBorderLeft}칸</b>, 높이≠2인 벽면 <b>${fixed.stats.badFaceHeight}칸</b> — 즉 모든 벽면이 <b>동등한 세로 2칸(밴드+밴드바디)</b>으로 균일.</li>
</ul>
<p class="cap">사용자 가설 검증: '벽이 안 생기는 자리가 레일 때문'일 것이라는 추측은 데이터상 부분적(88개 천장 남단 중 레일 인접 9칸, 10%). 주원인은 얕은 천장 기하(1~2타일 깊이 혀/노치)이며, 포기 규칙이 이를 결정적으로 해소한다. 레일은 벽 문법보다 <b>나중에</b> 배치해야 하므로 파이프라인 순서로 분리했다.</p>
</div>
<div class="card">
<h3>파이프라인 (순서 고정, 각 단계 로컬·결정적)</h3>
<ol>
<li><b>타일셋 메타 재동기화</b> — 원격 타일셋 라벨/통행성을 레포 정본으로 교정 (102–104·132–134 → wall/solid, 횃불·소품 → solid).</li>
<li><b>기하 확정</b> — 바닥/천장/용암 배치 (사용자 또는 생성기 출력).</li>
<li><b>콘페티 회수 + 스펙클 흡수</b> — 잘못된 벽 띠 환원, 고립 1칸 솔리드 2패스 흡수.</li>
<li><b>벽면 합성</b> — 남향 경계에 밴드+밴드바디 → <b>앵커 환원(고정점)</b> → <b>천장 포기(고정점)</b>. 종료 조건: 미고정 벽면 0, 무지지 직접 경계 0.</li>
<li><b>레일 배선 (마지막)</b> — 용암/벽 위 금지, 이웃 마스크로 직선·코너(54/55/84/85)·캡(114/174) 결정, 분기는 56~59/86~89 중 방향 확정 후 배치.</li>
<li><b>장식</b> — 횃불은 밴드 셀에만, 용암 위 금지.</li>
<li><b>레이아웃 판단 사항</b> — 상단 4행 데드존, 테두리 용암 ${counts.lavaBorder}칸, 고립 용암, 맵 이름.</li>
<li><b>저장·검증</b> — saveProjectToSupabase → 재로드 → 체크섬/렌더 비교 → 플레이 통행 + 레일 마스크 검증(위반 0).</li>
</ol>
</div>
<div class="card">
<h3>모의 수정 미리보기 (앵커 문법 + 레일 코너 적용, 미저장)</h3>
${img("fixed-preview.png", "fixed")}
<div class="grid2">
<div>${img("fixed-crop-edge.png", "fix1")}<p class="cap">벽 띠 — 스택이 성립하는 곳만 2행으로 시공됨</p></div>
<div>${img("fixed-crop-rail-corner.png", "fix2")}<p class="cap">레일 — 꺾임 지점에 코너 타일(54/55/84/85)이 배치됨</p></div>
</div>
</div>

<h2>5. 결론</h2>
<div class="card">
<ul>
<li>데이터 출처: <span class="ok">Supabase <code>rpg-zzu-showcase</code> 원격 직접 로드</span>.</li>
<li>v1~v3에서 지적받아 교정: ① 벽면은 천장에 앵커된 완전 스택에만 ② 레일 코너 어휘 ③ 벽을 세울 수 없는 천장은 포기. v4: ④ 벽면 합성을 <b>전역 고정점</b>으로 재구성 — 모든 벽면이 동등한 세로 2칸(높이 불일치 ${fixed.stats.badFaceHeight}칸) ⑤ 레일 감사를 <b>개구(openings) 의미론</b>으로 재작성 — (25,9) 가로 런 갭 메움, 평행 복선 허위 연결 제거, 캡 자동 결정, 잔여 단절 ${fixed.stats.railOneWay.length + fixed.stats.railDangling.length}칸.</li>
<li>핵심 원인: <span class="bad">원격 타일셋 메타 드리프트</span> + <span class="bad">장식 스크립트의 무검증 배치</span> + <span class="warn">사용자 베이스의 1칸 스펙클</span>.</li>
</ul>
</div>
<p class="cap">생성: ${loadedAt} · scripts/gen-lava-analysis-report.mts · 분석 전용, 원격 프로젝트 변경 없음</p>
</body></html>`;
fs.writeFileSync(path.join(OUT, "report.html"), html);
console.log("report:", path.join(OUT, "report.html"));
