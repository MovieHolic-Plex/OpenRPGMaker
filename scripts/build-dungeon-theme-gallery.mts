/**
 * 던전 칩셋 테마 갤러리 v2 — 사용자 구조 교정 반영.
 * 교정 사항:
 *  - 레일은 반드시 이어야 한다 (코너가 런 끝 캡을 대체, 루프는 [54,55]/[84,85])
 *  - 계단은 높낮이가 바뀌는 지점(절벽 베이스)에만 — 장식용 남발 금지, 한 곳에 몰지 않음
 *  - 얼음 절벽: 위에 설원 땅(6-8) + 면 286/287·316/317 + 베이스 346/347
 *  - 설원 벽: 372-374/402-404 + 위에 눈 땅
 *  - 신전: 마법진 3×3 [441-443/471-473/27-29] · 왕좌 3×2 [447-449/477-479] · 기둥 [446/476]
 *    오르간 2×2 [444-445/474-475] · 카펫 9슬라이스 [138-140 / 168-170 / 198-199-200] · 카펫 계단은 단상 앞 한 곳
 *    105-107은 벽돌이 아니라 붉은 '계단' — 벽에는 108/109 사용
 * 저장: Supabase rpg-zzu-dungeon-theme-gallery (덮어쓰기) → 재로드 검증
 * 실행: npx tsx scripts/build-dungeon-theme-gallery.mts   (드라이: --dry)
 */
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import { createEmptyToolProject } from "../src/editor/tools/emptyProject.ts";
import { ensureTilesetHarnesses } from "../src/project/tilesetHarness.ts";
import { chipsetQuarterComposition } from "../src/project/defaults/terrainQuarterAutotile.ts";
import { loadProjectFromSupabase, saveProjectToSupabase } from "../src/project/supabaseProjectSync.ts";
import type { GameMap, Project } from "../src/project/types.ts";

const OUT = path.resolve("output/evidence/dungeon-theme-gallery");
fs.mkdirSync(OUT, { recursive: true });
const T = 16, COLS = 30, W = 30, H = 22;
const TILESET_ID = "easyrpg_chipset_dungeon";
const PROJECT_ID = "rpg-zzu-dungeon-theme-gallery";
const DRY = process.argv.includes("--dry");

const env: Record<string, string> = {};
for (const line of fs.readFileSync(".env.local", "utf8").split(/\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
}
const config = { url: env.VITE_SUPABASE_URL!.replace(/\/$/, ""), anonKey: env.VITE_SUPABASE_ANON_KEY!, projectId: PROJECT_ID };

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 레일 개구 정본 (사용자 방향표 포함)
const OPENS: Record<number, readonly string[]> = {
  114: ["S"], 144: ["N", "S"], 174: ["N"], 115: ["E"], 116: ["E", "W"], 117: ["W"],
  54: ["S", "E"], 55: ["S", "W"], 84: ["N", "E"], 85: ["N", "W"],
  56: ["E", "W", "S"], 57: ["S", "N", "W"], 58: ["S", "N", "E"], 59: ["W", "S", "E"],
  86: ["N", "S", "E"], 87: ["W", "N", "E"], 88: ["E", "N", "W"], 89: ["N", "W", "S"],
};

type Cliff = {
  top: number[];   // 절벽 상단행 (런 변형: [L,M,R] 또는 [L,R] 교대)
  mid?: number[];  // 중간행
  base?: number[]; // 베이스행
  stairMid: number; // 절벽을 뚫는 계단 타일(중앙)
};
type Theme = {
  id: string; name: string; seed: number;
  floor: number[]; ceil: number;
  band: [number, number, number] | null;
  body: [number, number, number] | null;
  cliff?: Cliff;            // 절벽 지형 있는 테마
  floorAccent?: { tiles: number[]; p: number }[];
  props: { tile: number; p: number; upper?: boolean }[];
  feature: "lavaPool" | "pits" | "iceBlob" | "snowPile" | "none";
  rails?: "loop" | "tee";
  wallTorch?: boolean;
  rimPeaks?: boolean;       // 북쪽 림에 설산 대각(408/409) 상위 배치
};
const THEMES: Theme[] = [
  {
    id: "map_g_lava", name: "용암 광산", seed: 11,
    floor: [300, 301, 302], ceil: 308, band: [102, 103, 104], body: [132, 133, 134],
    floorAccent: [{ tiles: [43], p: 0.012 }, { tiles: [270, 271, 272], p: 0.05 }],
    props: [{ tile: 289, p: 0.012 }, { tile: 259, p: 0.012 }, { tile: 260, p: 0.008 }, { tile: 299, p: 0.006 }, { tile: 262, p: 0.006 }],
    feature: "lavaPool", rails: "loop", wallTorch: true,
  },
  {
    id: "map_g_dirt", name: "흙 광산 갱도", seed: 23,
    floor: [360, 361, 362], ceil: 310, band: [225, 226, 227], body: [255, 256, 257],
    floorAccent: [{ tiles: [166], p: 0.012 }],
    props: [{ tile: 299, p: 0.008 }, { tile: 417, p: 0.008 }, { tile: 419, p: 0.008 }, { tile: 297, p: 0.006 }],
    feature: "none", rails: "tee", wallTorch: true,
  },
  {
    id: "map_g_ice", name: "얼음 동굴", seed: 37,
    floor: [6, 7, 8], ceil: 428, band: [286, 286, 287], body: [316, 316, 317],
    cliff: { top: [286, 287], mid: [316, 317], base: [346, 347], stairMid: 49 },
    floorAccent: [{ tiles: [9, 10, 11], p: 0.02 }],
    props: [{ tile: 262, p: 0.012 }, { tile: 261, p: 0.01 }, { tile: 237, p: 0.02 }],
    feature: "iceBlob", wallTorch: false,
  },
  {
    id: "map_g_gray", name: "회암 동굴", seed: 41,
    floor: [126, 127, 128], ceil: 430, band: [21, 22, 23], body: [51, 52, 53],
    cliff: { top: [21, 22, 23], mid: [51, 52, 53], stairMid: 253 },
    floorAccent: [{ tiles: [130], p: 0.05 }, { tiles: [216, 217, 218], p: 0.04 }],
    props: [{ tile: 290, p: 0.012 }, { tile: 382, p: 0.012 }, { tile: 267, p: 0.008 }, { tile: 20, p: 0.004 }],
    feature: "pits", wallTorch: true,
  },
  {
    id: "map_g_snow", name: "설원 동굴", seed: 53,
    floor: [6, 7, 8], ceil: 428, band: [286, 286, 287], body: [316, 316, 317],
    cliff: { top: [372, 373, 374], mid: [402, 403, 404], stairMid: 49 },
    floorAccent: [{ tiles: [9, 10, 11], p: 0.02 }],
    props: [{ tile: 345, p: 0.004 }, { tile: 237, p: 0.03 }, { tile: 261, p: 0.008 }],
    feature: "snowPile", wallTorch: false, rimPeaks: true,
  },
];

const at = (x: number, y: number) => y * W + x;

// 런 변형: [L,M,R]은 좌/중/우, [L,R]은 교대
function runVariants(lower: number[], rowTiles: number[]): void {
  for (let y = 0; y < H; y += 1) {
    let x = 0;
    const inSet = (t: number) => rowTiles.includes(t);
    while (x < W) {
      if (!inSet(lower[at(x, y)]!)) { x += 1; continue; }
      let x1 = x;
      while (x1 + 1 < W && inSet(lower[at(x1 + 1, y)]!)) x1 += 1;
      if (rowTiles.length === 3) {
        lower[at(x, y)] = rowTiles[0]!;
        for (let k = x + 1; k < x1; k += 1) lower[at(k, y)] = rowTiles[1]!;
        if (x1 !== x) lower[at(x1, y)] = rowTiles[2]!;
      } else if (rowTiles.length === 2) {
        for (let k = x; k <= x1; k += 1) lower[at(k, y)] = rowTiles[(k - x) % 2]!;
      }
      x = x1 + 1;
    }
  }
}

function buildCave(th: Theme): GameMap {
  const rnd = mulberry32(th.seed);
  const lower = new Array<number>(W * H).fill(th.ceil);
  const upper = new Array<number>(W * H).fill(-1);
  const isFloor = (t: number) =>
    th.floor.includes(t) || (th.floorAccent ?? []).some((a) => a.tiles.includes(t)) ||
    (th.cliff ? t === th.cliff.stairMid : false) || [304, 151, 160, 70].includes(t) === false && false;

  // ── 1) 하나의 큰 남쪽 동굴 (타원 3개를 겹쳐 연결된 공간으로) ─────────────
  const cx = [W * 0.28 + rnd() * 2, W * 0.58 + rnd() * 2, W * 0.8 - rnd() * 2];
  const cy = [H * 0.6 + rnd() * 2, H * 0.68 + rnd() * 1.5, H * 0.55 + rnd() * 2];
  const rx = [6.5 + rnd() * 2, 7 + rnd() * 2, 5.5 + rnd() * 1.5];
  const ry = [4 + rnd(), 4.5 + rnd(), 3.5 + rnd()];
  for (let i = 0; i < 3; i += 1) {
    for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
      const d = ((x - cx[i]!) / rx[i]!) ** 2 + ((y - cy[i]!) / ry[i]!) ** 2;
      if (d <= 1) lower[at(x, y)] = th.floor[Math.floor(rnd() * th.floor.length)]!;
    }
  }
  // ── 2) 절벽 ledge (있는 테마): 상층 지면 + 절벽면 + 베이스 + 계단 1곳 ─────
  let stairX = -1, stairY = -1;
  if (th.cliff) {
    const baseY = 7 + Math.floor(rnd() * 2);
    const cliffY = (x: number) => baseY + Math.round(1.3 * Math.sin(x / 3.1 + th.seed));
    const rows = [th.cliff.top, th.cliff.mid, th.cliff.base].filter(Boolean) as number[][];
    for (let x = 2; x < W - 2; x += 1) {
      const y = cliffY(x);
      // 절벽 북쪽(동굴 남쪽이 아닌 위쪽) = 상층 지면
      for (let yy = 2; yy < y; yy += 1) if (lower[at(x, yy)] === th.ceil) lower[at(x, yy)] = th.floor[Math.floor(rnd() * th.floor.length)]!;
      rows.forEach((row, k) => { if (y + k < H - 2) lower[at(x, y + k)] = row[Math.min(1, row.length - 1)]!; });
    }
    // 계단: 절벽면이 연속되는 중앙 부근 1곳 — 베이스행을 계단 타일로 교체
    stairX = Math.floor(W / 2) + Math.floor(rnd() * 5) - 2;
    stairY = cliffY(stairX) + rows.length - 1;
    lower[at(stairX, stairY)] = th.cliff.stairMid;
    // 런 변형
    rows.forEach((row, k) => runVariants(lower, row));
    // 계단 셀 복원 (런 변형이 덮을 수 있음)
    lower[at(stairX, stairY)] = th.cliff.stairMid;
  }
  // ── 3) 어둠 천장 벽 합성 고정점 (밴드 좌/중/우) ──────────────────────────
  const isWalkFloor = (t: number) => th.floor.includes(t) || (th.floorAccent ?? []).some((a) => a.tiles.includes(t)) || t === th.cliff?.stairMid || t === 304 || t === 151 || t === 70;
  for (let iter = 0; iter < 10; iter += 1) {
    let changed = 0;
    if (th.band && th.body) {
      for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
        const t = lower[at(x, y)]!;
        if (th.body.includes(t) && !(y > 0 && th.band.includes(lower[at(x, y - 1)]!))) { lower[at(x, y)] = th.ceil; changed += 1; continue; }
        if (th.band.includes(t) && !(y > 0 && (lower[at(x, y - 1)] === th.ceil || th.band.includes(lower[at(x, y - 1)]!)))) { lower[at(x, y)] = th.ceil; changed += 1; }
      }
    }
    for (let y = 0; y < H - 1; y += 1) for (let x = 0; x < W; x += 1) {
      if (lower[at(x, y)] !== th.ceil || !isWalkFloor(lower[at(x, y + 1)]!)) continue;
      if (y > 1 && lower[at(x, y - 1)] === th.ceil && lower[at(x, y - 2)] === th.ceil && th.band && th.body) {
        lower[at(x, y)] = th.body[1];
        lower[at(x, y - 1)] = th.band[1];
        changed += 1;
      } else if (x >= 1 && x < W - 1 && y >= 2 && y < H - 2) {
        lower[at(x, y)] = th.floor[0]!;
        changed += 1;
      }
    }
    if (changed === 0) break;
  }
  if (th.band) runVariants(lower, th.band);
  if (th.body) runVariants(lower, th.body);
  // ── 4) 피처 (절벽면·계단 침범 금지) ────────────────────────────────────────
  const floorCells = (): [number, number][] => {
    const out: [number, number][] = [];
    for (let y = 1; y < H - 1; y += 1) for (let x = 1; x < W - 1; x += 1) if (isWalkFloor(lower[at(x, y)]!)) out.push([x, y]);
    return out;
  };
  const carvePatch = (tiles: number[], count: number): void => {
    const cells = floorCells();
    for (let i = 0; i < count && cells.length > 0; i += 1) {
      const [pcx, pcy] = cells[Math.floor(rnd() * cells.length)]!;
      const center = tiles[0]!;
      for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
        const d = ((x - pcx) / 2.6) ** 2 + ((y - pcy) / 1.8) ** 2;
        if (d <= 1 && isWalkFloor(lower[at(x, y)]!) && th.floor.includes(lower[at(x, y)]!)) lower[at(x, y)] = center;
      }
    }
  };
  if (th.feature === "lavaPool") carvePatch([304], 2);
  if (th.feature === "pits") carvePatch([160], 2);
  if (th.feature === "iceBlob") carvePatch([70], 3);
  if (th.feature === "snowPile") carvePatch([237, 238, 239], 2);
  // 바닥 포인트 (피처 후)
  for (const acc of th.floorAccent ?? []) {
    for (let i = 0; i < W * H; i += 1) if (th.floor.includes(lower[i]!) && rnd() < acc.p) lower[i] = acc.tiles[Math.floor(rnd() * acc.tiles.length)]!;
  }
  // ── 5) 레일 — 반드시 이어지게: L자(코너가 끝 캡을 대체) + T분기 + 루프 ─────
  if (th.rails) {
    const cells = floorCells();
    const clear = (x: number, y: number) => x > 0 && y > 0 && x < W - 1 && y < H - 1 && th.floor.includes(lower[at(x, y)]!) && upper[at(x, y)] === -1;
    const spot = cells.find(([x, y]) =>
      [0, 1, 2, 3].every((k) => clear(x + k, y)) && [1, 2, 3].every((k) => clear(x + 3, y + k)) && clear(x + 3, y + 4));
    if (spot) {
      const [x0, y0] = spot;
      if (th.rails === "loop") {
        // L자: [115,116,116,55] + 아래로 [144,144,174] (55 = 서+남 코너)
        upper[at(x0, y0)] = 115;
        upper[at(x0 + 1, y0)] = 116;
        upper[at(x0 + 2, y0)] = 116;
        upper[at(x0 + 3, y0)] = 55;
        upper[at(x0 + 3, y0 + 1)] = 144;
        upper[at(x0 + 3, y0 + 2)] = 144;
        upper[at(x0 + 3, y0 + 3)] = 174;
        // 2×2 루프: [54,55] / [84,85]
        const loop = cells.find(([x, y]) =>
          (Math.abs(x - x0) > 6 || Math.abs(y - y0) > 5) &&
          [0, 1].every((dx) => [0, 1].every((dy) => clear(x + dx, y + dy))));
        if (loop) {
          const [lx, ly] = loop;
          upper[at(lx, ly)] = 54; upper[at(lx + 1, ly)] = 55;
          upper[at(lx, ly + 1)] = 84; upper[at(lx + 1, ly + 1)] = 85;
        }
      } else {
        // T분기: [115,116,56,116,117] + 56 아래로 [144,174] (56 = 동서+남)
        const teeOk = [0, 1, 2, 3, 4].every((k) => clear(x0 + k, y0)) && clear(x0 + 2, y0 + 1) && clear(x0 + 2, y0 + 2);
        if (teeOk) {
          upper[at(x0, y0)] = 115;
          upper[at(x0 + 1, y0)] = 116;
          upper[at(x0 + 2, y0)] = 56;
          upper[at(x0 + 3, y0)] = 116;
          upper[at(x0 + 4, y0)] = 117;
          upper[at(x0 + 2, y0 + 1)] = 144;
          upper[at(x0 + 2, y0 + 2)] = 174;
        }
      }
    }
  }
  // ── 6) 소품 (상위, 바닥·레일·계단과 비겹침) ────────────────────────────────
  for (const pr of th.props) {
    for (const [x, y] of floorCells()) {
      if (upper[at(x, y)] !== -1 || rnd() >= pr.p) continue;
      upper[at(x, y)] = pr.tile;
    }
  }
  // 설산 대각: 북쪽 림 상단에 상위로
  if (th.rimPeaks) {
    for (let x = 4; x < W - 4; x += 5) {
      const y = 2 + Math.floor(rnd() * 2);
      if (upper[at(x, y)] === -1) upper[at(x, y)] = rnd() < 0.5 ? 408 : 409;
    }
  }
  // 벽 횃불: 밴드 셀에만
  if (th.wallTorch && th.band) {
    let n = 0;
    for (let y = 1; y < H - 1 && n < 5; y += 1) for (let x = 1; x < W - 1 && n < 5; x += 1) {
      if (th.band.includes(lower[at(x, y)]!) && upper[at(x, y)] === -1 && rnd() < 0.07) { upper[at(x, y)] = 264; n += 1; }
    }
  }
  return { id: th.id, name: th.name, width: W, height: H, tilesetId: TILESET_ID, tileSize: 16, lowerTiles: lower, upperTiles: upper, events: [] } as GameMap;
}

// ── 신전 왕좌 (조립 교정) ──────────────────────────────────────────────────
function buildTemple(): GameMap {
  const id = "map_g_temple", name = "신전 왕좌";
  const lower = new Array<number>(W * H).fill(430);
  const upper = new Array<number>(W * H).fill(-1);
  // 벽: 북쪽 어둠 캡 2행 + 흰 석벽돌 면(108), 모서리 장식 각석(109)
  for (let x = 2; x < W - 2; x += 1) { lower[at(x, 2)] = 430; lower[at(x, 3)] = 430; }
  for (let x = 2; x < W - 2; x += 1) lower[at(x, 4)] = 108;
  lower[at(2, 4)] = 109; lower[at(W - 3, 4)] = 109;
  for (let y = 4; y < H - 3; y += 1) { lower[at(2, y)] = 108; lower[at(3, y)] = 108; lower[at(W - 3, y)] = 108; lower[at(W - 4, y)] = 108; }
  for (let x = 2; x < W - 2; x += 1) lower[at(x, H - 4)] = 108; // 남면
  // 바닥: 모자이크 체커
  for (let y = 5; y < H - 4; y += 1) for (let x = 4; x < W - 4; x += 1) lower[at(x, y)] = (x + y) % 2 === 0 ? 80 : 111;
  // 카펫 9슬라이스 N-S 통로 (폭 3): 상단 캡 [138,139,140] → 중간 [168,169,170] → 하단 캡 [198,199,200]
  const cx0 = 13;
  for (let y = 5; y < H - 4; y += 1) for (let dx = 0; dx < 4; dx += 1) lower[at(cx0 + dx, y)] = dx === 0 ? 168 : dx === 3 ? 170 : 169;
  for (let dx = 0; dx < 4; dx += 1) { lower[at(cx0 + dx, 5)] = dx === 0 ? 138 : dx === 3 ? 140 : 139; lower[at(cx0 + dx, H - 5)] = dx === 0 ? 198 : dx === 3 ? 200 : 199; }
  // 대형 비석 3×3 [438-440 / 468-470 / 24-26] — 북벽 중앙
  const stele = [[438, 439, 440], [468, 469, 470], [24, 25, 26]];
  stele.forEach((row, dy) => row.forEach((t, dx) => { upper[at(13 + dx, 5 + dy)] = t; }));
  // 왕좌 3×2 [447,448,449 / 477,478,479] — 카펫 위, 비석 앞
  [447, 448, 449].forEach((t, dx) => { upper[at(13 + dx, 9)] = t; });
  [477, 478, 479].forEach((t, dx) => { upper[at(13 + dx, 10)] = t; });
  // 카펫 계단 [228,229,230] — 왕좌 단상 앞 1곳 (높이 전이 지점)
  [228, 229, 230].forEach((t, dx) => { lower[at(13 + dx, 11)] = t; });
  // 마법진 3×3 [441-443 / 471-473 / 27-29] — 홀 중앙
  const circle = [[441, 442, 443], [471, 472, 473], [27, 28, 29]];
  circle.forEach((row, dy) => row.forEach((t, dx) => { upper[at(13 + dx, 14 + dy)] = t; }));
  // 양옆 석상 쌍 (여신 145+175, 가고일 146+176)
  upper[at(6, 11)] = 145; upper[at(6, 12)] = 175;
  upper[at(23, 11)] = 146; upper[at(23, 12)] = 176;
  // 석조 기둥 1×2 (446/476) — 카펫 양옆
  for (const px of [9, 20]) { upper[at(px, 8)] = 446; upper[at(px, 9)] = 476; }
  // 파이프 오르간 2×2 [444,445 / 474,475] — 서벽
  upper[at(4, 6)] = 444; upper[at(5, 6)] = 445;
  upper[at(4, 7)] = 474; upper[at(5, 7)] = 475;
  // 벽 횃불 (북면)
  for (const tx of [5, 10, 19, 24]) upper[at(tx, 4)] = 264;
  return { id, name, width: W, height: H, tilesetId: TILESET_ID, tileSize: 16, lowerTiles: lower, upperTiles: upper, events: [] } as GameMap;
}

// ── QA ──────────────────────────────────────────────────────────────────────
function auditRails(map: GameMap): string[] {
  const issues: string[] = [];
  const railAt = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && OPENS[map.upperTiles[at(x, y)]!] !== undefined;
  const openAt = (x: number, y: number, d: string) => railAt(x, y) && OPENS[map.upperTiles[at(x, y)]!]!.includes(d);
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    const o = OPENS[map.upperTiles[at(x, y)]!];
    if (!o) continue;
    for (const dir of o) {
      const [dx, dy] = dir === "E" ? [1, 0] : dir === "W" ? [-1, 0] : dir === "S" ? [0, 1] : [0, -1];
      const back = dir === "E" ? "W" : dir === "W" ? "E" : dir === "S" ? "N" : "S";
      if (!railAt(x + dx, y + dy)) issues.push(`레일 개구 늘어짐 @${x},${y} ${dir}`);
      else if (!openAt(x + dx, y + dy, back)) issues.push(`레일 일방 개구 @${x},${y} ${dir}`);
    }
  }
  return issues;
}
function audit(map: GameMap, th: Theme | null): string[] {
  const issues: string[] = auditRails(map);
  let floorCount = 0;
  for (let i = 0; i < W * H; i += 1) if (map.lowerTiles[i] !== (th?.ceil ?? 430)) floorCount += 1;
  if (floorCount < W * H * 0.2) issues.push("바닥 비율 낮음");
  if (th?.band && th.body) {
    for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
      if (th.body.includes(map.lowerTiles[at(x, y)]!) && !(y > 0 && th.band.includes(map.lowerTiles[at(x, y - 1)]!))) issues.push(`미고정 몸통 @${x},${y}`);
      if (th.band.includes(map.lowerTiles[at(x, y)]!) && !(y > 0 && (map.lowerTiles[at(x, y - 1)] === th.ceil || th.band.includes(map.lowerTiles[at(x, y - 1)]!)))) issues.push(`미고정 밴드 @${x},${y}`);
    }
  }
  // 계단은 절벽면과 맞닿아 있어야 한다
  const stairTiles = [48, 49, 50, 105, 106, 107, 228, 229, 230, 252, 253, 254];
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    if (!stairTiles.includes(map.lowerTiles[at(x, y)]!)) continue;
    if (th?.cliff) {
      const rows = [th.cliff.top, th.cliff.mid, th.cliff.base].filter(Boolean) as number[][];
      const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => rows.some((r) => r.includes(map.lowerTiles[at(x + dx, y + dy)] ?? -1)));
      if (!near) issues.push(`근거 없는 계단 @${x},${y}`);
    } else if (map.id !== "map_g_temple") issues.push(`절벽 없는 맵의 계단 @${x},${y}`);
  }
  return [...new Set(issues)].slice(0, 6);
}

// ── 렌더 ────────────────────────────────────────────────────────────────────
const chip = PNG.sync.read(fs.readFileSync("public/assets/easyrpg-chipset-dungeon-transparent.png"));
function renderPng(project: Project, map: GameMap): PNG {
  const scale = 4;
  const png = new PNG({ width: map.width * T * scale, height: map.height * T * scale });
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
  for (let y = 0; y < map.height; y += 1) for (let x = 0; x < map.width; x += 1) {
    const i = y * map.width + x, dx = x * T * scale, dy = y * T * scale;
    const tset = project.tilesets[map.tilesetId];
    const comp = tset ? chipsetQuarterComposition(map, tset, x, y) : null;
    if (comp) {
      blit(comp.underlayTile ?? map.lowerTiles[i]!, dx, dy);
      for (const s of comp.sources) blit(s.tile, dx + s.offsetX * scale, dy + s.offsetY * scale, { sx: s.offsetX, sy: s.offsetY, sw: 8, sh: 8 });
    } else if (map.lowerTiles[i]! >= 0) blit(map.lowerTiles[i]!, dx, dy);
    if (map.upperTiles[i]! >= 0) blit(map.upperTiles[i]!, dx, dy);
  }
  return png;
}
// 개념 다이어그램용 미니맵 렌더
function renderDiagram(tiles: number[][], upperTiles: number[][], file: string): void {
  const h = tiles.length, w = tiles[0]!.length;
  const m = { id: "diagram", name: "diagram", width: w, height: h, tilesetId: TILESET_ID, tileSize: 16, lowerTiles: tiles.flat(), upperTiles: upperTiles.flat(), events: [] } as GameMap;
  fs.writeFileSync(path.join(OUT, file), PNG.sync.write(renderPng(project, m)));
}

// ── 프로젝트 구성 ───────────────────────────────────────────────────────────
const project: Project = createEmptyToolProject("던전 테마 갤러리");
project.meta.title = "던전 칩셋 테마 갤러리 (6종) v2";
ensureTilesetHarnesses(project);
{
  const ts = project.tilesets[TILESET_ID]!;
  const solid = [102, 103, 104, 132, 133, 134, 285, 315, 9, 10, 11, 39, 40, 41, 43, 69, 70, 71, 99, 100, 101,
    207, 208, 209, 263, 264, 293, 259, 260, 261, 262, 288, 289, 290, 291, 292, 318, 319, 320, 321, 322, 323,
    348, 349, 350, 351, 352, 353, 382, 383, 412, 413, 345, 436, 378, 379, 380, 381, 410, 411,
    294, 296, 297, 298, 324, 326, 327, 328, 329, 354, 356, 357, 358, 359, 384, 385, 386, 387, 388, 389, 414, 415, 416, 417, 418, 419, 408, 409];
  const pass = ts.passability as Record<number, { up: boolean; down: boolean; left: boolean; right: boolean }>;
  for (const t of solid) pass[t] = { up: false, down: false, left: false, right: false };
}

const maps: GameMap[] = THEMES.map((th) => buildCave(th));
maps.push(buildTemple());
const issuesAll: Record<string, string[]> = {};
maps.forEach((m, i) => {
  const issues = audit(m, THEMES[i] ?? null);
  if (issues.length > 0) issuesAll[m.id] = issues;
  project.maps[m.id] = m;
  fs.writeFileSync(path.join(OUT, `${m.id}.png`), PNG.sync.write(renderPng(project, m)));
  console.log("[map]", m.id, m.name, issues.length ? `QA ${issues.length}건` : "QA 통과");
});
project.startMapId = maps[0]!.id;
project.startPos = { x: 15, y: 14 };
project.mapTree = { mapId: maps[0]!.id, children: maps.slice(1).map((m) => ({ mapId: m.id, children: [] })) };
if (Object.keys(issuesAll).length > 0) console.log("[QA 경고]", JSON.stringify(issuesAll));

// 개념 다이어그램 3종: 절벽 스택 / 레일 연결 / 신전 조립
{
  const C = 430, F = 6;
  // 얼음 절벽 스택: [눈 땅 6-8] [286/287] [316/317] [346/347] [빙판 6-8]
  renderDiagram([
    [C, C, C, C, C, C, C, C],
    [F, F, F, F, F, F, F, F],
    [286, 286, 287, 286, 287, 286, 286, 287],
    [316, 316, 317, 316, 317, 316, 316, 317],
    [346, 346, 347, 346, 347, 346, 346, 347],
    [F, F, F, F, 49, F, F, F],
    [F, F, F, F, F, F, F, F],
  ], Array.from({ length: 7 }, () => [ -1, -1, -1, -1, -1, -1, -1, -1 ]), "diagram-cliff.png");
  // 설원 절벽 스택: [눈 땅] [372-374] [402-404] [눈 바닥]
  renderDiagram([
    [C, C, C, C, C, C, C, C],
    [F, F, F, F, F, F, F, F],
    [372, 373, 373, 373, 374, 372, 373, 374],
    [402, 403, 403, 403, 404, 402, 403, 404],
    [F, F, F, F, 49, F, F, F],
    [F, F, F, F, F, F, F, F],
  ], Array.from({ length: 6 }, () => [ -1, -1, -1, -1, -1, -1, -1, -1 ]), "diagram-snowcliff.png");
  // 레일: L자 + T + 루프
  const railLower = Array.from({ length: 8 }, () => Array.from({ length: 12 }, () => 301));
  const railUpper = Array.from({ length: 8 }, () => Array.from({ length: 12 }, () => -1));
  railUpper[1][1] = 115; railUpper[1][2] = 116; railUpper[1][3] = 116; railUpper[1][4] = 55;
  railUpper[2][4] = 144; railUpper[3][4] = 144; railUpper[4][4] = 174;
  railUpper[1][6] = 115; railUpper[1][7] = 116; railUpper[1][8] = 56; railUpper[1][9] = 116; railUpper[1][10] = 117;
  railUpper[2][8] = 144; railUpper[3][8] = 174;
  railUpper[5][6] = 54; railUpper[5][7] = 55; railUpper[6][6] = 84; railUpper[6][7] = 85;
  renderDiagram(railLower, railUpper, "diagram-rails.png");
}

// ── 저장 + 재로드 검증 ──────────────────────────────────────────────────────
if (!DRY) {
  const saved = await saveProjectToSupabase(project, config);
  console.log("[저장]", (saved as { kind?: string })?.kind);
  if ((saved as { kind?: string })?.kind !== "saved") throw new Error("저장 실패");
  const verify = await loadProjectFromSupabase(config);
  if (!verify) throw new Error("재로드 실패");
  const ok = maps.every((m) => {
    const v = verify.maps[m.id];
    return v && v.width === m.width && v.lowerTiles.length === m.lowerTiles.length;
  });
  console.log("[재로드]", verify.meta.title, "| 맵:", maps.filter((m) => verify.maps[m.id]).length, "/", maps.length, "| 일치:", ok);
  if (!ok) throw new Error("재로드 검증 실패");
}

// ── HTML ────────────────────────────────────────────────────────────────────
const b64 = (f: string) => fs.readFileSync(path.join(OUT, f)).toString("base64");
const img = (f: string) => `<img src="data:image/png;base64,${b64(f)}" style="image-rendering:pixelated;max-width:100%;border:1px solid #333;border-radius:6px;">`;
const FIXES: Record<string, string> = {
  map_g_lava: "레일이 끊겨 있던 것을 L자(55 코너가 런 끝을 대체)+2×2 루프 [54,55/84,85]로 재배선, 개구 감사 0. 장식용 계단 제거 — 이 맵에는 높이 전이가 없으므로 계단 없음.",
  map_g_dirt: "T분기 56(동서+남)으로 레일 연결, 개구 감사 0. 장식용 계단 제거. 금광 166·흙 벽 225-227/255-257(광산용 흙 벽) 적용.",
  map_g_ice: "절벽 구조 교정: 위에 눈 땅(6-8) → 면 286/287·316/317 → 베이스 346/347 → 빙판. 청록 계단 49는 절벽 베이스 1곳에만(상층↔하층 전이).",
  map_g_gray: "절벽 ledge + 암벽 21-23/51-53 + 계단 253을 절벽 베이스에 뚫어 상하층 연결. 그 외 장식 계단 없음. 자갈 바닥 130·구덩이·얼굴 조각.",
  map_g_snow: "설원 벽 교정: 372-374/402-404(네 지정) + 위에 눈 땅. 설산 대각 408/409는 북쪽 림 상단에 상위 레이어로만(바닥 산재 금지). 계단 49는 절벽 1곳.",
  map_g_temple: "105-107은 벽돌이 아니라 붉은 계단 — 벽에서 제거하고 흰 석벽돌 108+각석 109로 재시공. 마법진 3×3 조립(441-443/471-473/27-29). 왕좌 3×2(447-449/477-479, 왼쪽 잘림 해소). 기둥 446/476, 오르간 444-445/474-475. 카펫 9슬라이스(138-140 캡/168-170 통로/198-200 캡) + 카펫 계단은 왕좌 단상 앞 1곳.",
};
const cards = maps.map((m) => `
<div class="card">
  <h3>${m.name} <code>${m.id}</code></h3>
  ${img(m.id + ".png")}
  <p class="fix">${FIXES[m.id] ?? ""}</p>
  ${issuesAll[m.id] ? `<p class="warn">QA 잔여: ${issuesAll[m.id]!.join(" / ")}</p>` : '<p class="ok">QA 통과 (레일 개구 0 · 벽 앵커 0 · 계단 위치 규칙)</p>'}
</div>`).join("");
const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>던전 테마 갤러리 v2 — 구조 교정</title>
<style>body{background:#141216;color:#e8e2da;font:15px/1.6 -apple-system,'Segoe UI','Malgun Gothic',sans-serif;max-width:1000px;margin:0 auto;padding:28px 18px 80px}
h1{font-size:24px;border-bottom:2px solid #b8492b;padding-bottom:10px}
h2{font-size:19px;margin-top:36px;color:#ffb27a;border-left:4px solid #b8492b;padding-left:10px}
.card{background:#1e1b22;border:1px solid #333;border-radius:10px;padding:14px 18px;margin:16px 0}
.cap{font-size:12.5px;color:#a99}.ok{color:#7fd47f;font-size:12.5px}.warn{color:#ffd27a;font-size:12.5px}.fix{font-size:13.5px;color:#d8d2c8}
code{background:#2a2530;padding:1px 6px;border-radius:4px;font-size:12px}
table{border-collapse:collapse;font-size:13px}th,td{border:1px solid #3a3540;padding:5px 9px;text-align:left;vertical-align:top}th{background:#2a2530}</style></head><body>
<h1>던전 테마 갤러리 v2 — 구조 교정 결과</h1>
<p class="cap">v1의 오류 교정: ① 레일은 반드시 연결 ② 계단은 높낮이 전이(절벽 베이스)에만 ③ 얼음/설원 절벽은 '눈 땅 + 면 + 베이스' 스택 ④ 설원 벽은 372-374/402-404 ⑤ 신전 조립(마법진 3×3, 왕좌 3×2, 카펫 9슬라이스, 105-107은 벽돌이 아니라 계단)<br>
저장: Supabase <code>${PROJECT_ID}</code> ${DRY ? "(드라이런)" : "· 저장+재로드 검증 완료"} · 생성: ${new Date().toISOString()}</p>

<h2>교정 개념 다이어그램</h2>
<div class="card"><h3>얼음 절벽 스택: 눈 땅 → 면(286/287·316/317) → 베이스(346/347) → 빙판, 계단 49는 베이스를 뚫는다</h3>${img("diagram-cliff.png")}</div>
<div class="card"><h3>설원 절벽 스택: 눈 땅 → 372-374 → 402-404 → 눈 바닥</h3>${img("diagram-snowcliff.png")}</div>
<div class="card"><h3>레일 연결 규칙: L자(55 코너가 끝 캡을 대체) · T분기(56=동서+남) · 2×2 루프([54,55]/[84,85])</h3>${img("diagram-rails.png")}</div>

<h2>테마 맵 (수정 후)</h2>
${cards}
</body></html>`;
fs.writeFileSync(path.join(OUT, "gallery.html"), html);
console.log("[html]", path.join(OUT, "gallery.html"));
