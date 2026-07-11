/**
 * 1) 사용자가 적어 둔 성 타일 라벨·설명 정리
 * 2) 그 타일로 성 맵 생성 후 Supabase 저장
 */
import fs from "node:fs";
import path from "node:path";
import { loadProjectFromSupabase, saveProjectToSupabase } from "../src/project/supabaseProjectSync.ts";
import { runTool } from "../src/editor/tools/toolRunner.ts";
import { TILE } from "../src/project/defaults/constants.ts";
import type { GameMap, Project, TilesetDef } from "../src/project/types.ts";

const MAP_ID = "map_castle_keep";
const TILESET_ID = "easyrpg_chipset_combined_town";

// 사용자 비전(18~110 블록) — 라벨·설명 재작성
// 시트 30열: 성채 상단/여장·지붕 면 3열 + 성벽 면 1열
const CASTLE_META: Record<number, { label: string; description: string }> = {
  // ── 성 지붕·여장 면 (3×4 블록, 가로 확장 가능 중앙) ──
  18: {
    label: "성 지붕 좌상",
    description: "성 지붕/여장 블록 왼쪽 위 모서리. 지붕 면의 좌상단에 둔다. 하위 레이어, 통행 불가.",
  },
  19: {
    label: "성 지붕 상단",
    description: "성 지붕/여장 블록 윗변 중앙. 좌(18)·우(20) 사이에서 가로로 무제한 반복. 하위, 통행 불가.",
  },
  20: {
    label: "성 지붕 우상",
    description: "성 지붕/여장 블록 오른쪽 위 모서리. 지붕 면의 우상단. 하위, 통행 불가.",
  },
  48: {
    label: "성 지붕 좌측",
    description: "성 지붕/여장 블록 왼쪽 변. 위(18)·아래(78) 사이에서 세로 반복 가능. 하위, 통행 불가.",
  },
  49: {
    label: "성 지붕 바닥(옅은)",
    description: "성 지붕/여장 내부 바닥(옅은 회색). 보루 위 보행로·지붕 면 채움용. 하위. 통행은 맵 설정에 따름(기본 차단 권장).",
  },
  50: {
    label: "성 지붕 중단",
    description: "성 지붕/여장 블록 가운데 몸통. 상하좌우로 확장해 넓은 지붕 면을 채운다. 하위, 통행 불가.",
  },
  78: {
    label: "성 지붕 좌측(하)",
    description: "성 지붕/여장 블록 왼쪽 변 아랫쪽. 좌측 기둥 연장. 하위, 통행 불가.",
  },
  79: {
    label: "성 지붕 바닥(진한)",
    description: "성 지붕/여장 내부 바닥(진한 회색). 보루 위 그림자·대비 채움. 하위, 통행 불가 권장.",
  },
  80: {
    label: "성 지붕 중단(하)",
    description: "성 지붕/여장 몸통 아랫 구간. 50과 함께 세로로 키울 때 사용. 하위, 통행 불가.",
  },
  108: {
    label: "성 지붕 좌하",
    description: "성 지붕/여장 블록 왼쪽 아래 모서리. 지붕 면 하단 좌측 마감. 하위, 통행 불가.",
  },
  109: {
    label: "성 지붕 하단",
    description: "성 지붕/여장 블록 아랫변 중앙. 좌(108)·우(110) 사이에서 가로 반복. 하위, 통행 불가.",
  },
  110: {
    label: "성 지붕 우하",
    description: "성 지붕/여장 블록 오른쪽 아래 모서리. 지붕 면 하단 우측 마감. 하위, 통행 불가.",
  },
  // ── 성벽 정면 (세로 3단, 중단 확장) ──
  21: {
    label: "성벽 상단",
    description: "성벽 정면 맨 위 단. 여장/처마 바로 아래. 가로로 반복해 성벽 윗줄을 만든다. 하위, 통행 불가.",
  },
  51: {
    label: "성벽 중단",
    description: "성벽 정면 몸통. 21(상)·81(하) 사이에서 세로·가로로 무제한 확장. 하위, 통행 불가.",
  },
  81: {
    label: "성벽 하단",
    description: "성벽 정면 맨 아래 단. 지면과 맞닿는 줄. 가로 반복. 하위, 통행 불가.",
  },
};

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
  }
  return env;
}

function runOk(ctx: { project: Project }, name: string, args: Record<string, unknown>): string {
  const result = runTool(ctx, name, args);
  if (!result.ok) {
    throw new Error(`${name}: ${result.summary}\n${JSON.stringify(result.issues ?? [], null, 2)}`);
  }
  return result.summary;
}

function setLower(map: GameMap, x: number, y: number, tile: number): void {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return;
  map.lowerTiles[y * map.width + x] = tile;
}

function setUpper(map: GameMap, x: number, y: number, tile: number): void {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return;
  map.upperTiles[y * map.width + x] = tile;
}

function fillLower(map: GameMap, x0: number, y0: number, w: number, h: number, tile: number): void {
  for (let y = y0; y < y0 + h; y += 1) {
    for (let x = x0; x < x0 + w; x += 1) setLower(map, x, y, tile);
  }
}

/** 성벽 정면 세로 띠: 상21 + 중51* + 하81 */
function paintWallFaceColumn(map: GameMap, x: number, yTop: number, height: number): void {
  if (height < 2) {
    setLower(map, x, yTop, 51);
    return;
  }
  setLower(map, x, yTop, 21);
  for (let y = yTop + 1; y < yTop + height - 1; y += 1) setLower(map, x, y, 51);
  setLower(map, x, yTop + height - 1, 81);
}

/** 성 지붕/여장 면 직사각 (최소 2×2, 권장 ≥3×3) */
function paintRoofDeck(map: GameMap, x0: number, y0: number, w: number, h: number): void {
  const ww = Math.max(2, w);
  const hh = Math.max(2, h);
  for (let y = 0; y < hh; y += 1) {
    for (let x = 0; x < ww; x += 1) {
      const left = x === 0;
      const right = x === ww - 1;
      const top = y === 0;
      const bottom = y === hh - 1;
      let tile = 50; // body
      if (top && left) tile = 18;
      else if (top && right) tile = 20;
      else if (top) tile = 19;
      else if (bottom && left) tile = 108;
      else if (bottom && right) tile = 110;
      else if (bottom) tile = 109;
      else if (left) tile = y === 1 ? 48 : 78;
      else if (right) tile = y === 1 ? 50 : 80; // right edge uses body-ish mid
      else if (y === 1) tile = 49; // light floor band
      else tile = 79; // dark floor body
      // right edge mid rows: use 50/80 as center-right
      if (!top && !bottom && right) tile = y % 2 === 0 ? 50 : 80;
      if (!top && !bottom && left) tile = y % 2 === 0 ? 48 : 78;
      if (!top && !bottom && !left && !right) tile = y % 2 === 0 ? 49 : 79;
      setLower(map, x0 + x, y0 + y, tile);
    }
  }
}

/** 성벽 가로 줄 (정면 단 높이 wallH) */
function paintWallRow(map: GameMap, x0: number, yTop: number, w: number, wallH: number): void {
  for (let x = x0; x < x0 + w; x += 1) paintWallFaceColumn(map, x, yTop, wallH);
}

function applyCastleMeta(tileset: TilesetDef): number {
  tileset.tileMeta ??= [];
  while (tileset.tileMeta.length < tileset.count) {
    tileset.tileMeta.push({ label: "", description: "", source: "unknown" });
  }
  let n = 0;
  for (const [raw, meta] of Object.entries(CASTLE_META)) {
    const i = Number(raw);
    const prev = tileset.tileMeta[i] ?? { label: "", description: "" };
    tileset.tileMeta[i] = {
      ...prev,
      label: meta.label,
      description: meta.description,
      source: "user",
      userLocked: true,
      defaultLayer: "lower",
      passage: "solid",
      role: "structure",
      confidence: "high",
    };
    tileset.priority[i] = "lower";
    tileset.passability[i] = { up: false, down: false, left: false, right: false };
    n += 1;
  }
  return n;
}

const env = loadEnv();
const config = {
  url: env.VITE_SUPABASE_URL!.replace(/\/$/, ""),
  anonKey: env.VITE_SUPABASE_ANON_KEY!,
  projectId: env.VITE_SUPABASE_PROJECT_ID || "rpg-zzu-house-template-gallery",
};

const project = await loadProjectFromSupabase(config);
if (!project) throw new Error("load failed");

const tileset = project.tilesets[TILESET_ID];
if (!tileset) throw new Error(`missing tileset ${TILESET_ID}`);

const metaCount = applyCastleMeta(tileset);
console.log("[meta] updated castle tiles:", metaCount);

// 성 맵: 기존 호수 마을 맵은 유지, 성 맵 추가
const ctx = { project };
const W = 48;
const H = 40;

if (project.maps[MAP_ID]) {
  delete project.maps[MAP_ID];
}

logs: {
  // create_map uses default tileset from blank — force combined town after
}
const createSummary = runOk(ctx, "create_map", {
  id: MAP_ID,
  name: "성채",
  width: W,
  height: H,
});
console.log(createSummary);

const map = ctx.project.maps[MAP_ID]!;
map.tilesetId = TILESET_ID;
// 잔디 바탕
fillLower(map, 0, 0, W, H, TILE.GRASS);
map.upperTiles.fill(TILE.EMPTY);

// 레이아웃
// 외성 벽 박스 (성벽 정면 3단)
const wallH = 3;
const outer = { x: 8, y: 6, w: 32, h: 26 }; // outer wall outer bounds top of wall
// 남쪽 문 틈
const gateX = 22;
const gateW = 4;

// 북쪽 외벽
paintWallRow(map, outer.x, outer.y, outer.w, wallH);
// 남쪽 외벽 (문 비움)
paintWallRow(map, outer.x, outer.y + outer.h - wallH, gateX - outer.x, wallH);
paintWallRow(map, gateX + gateW, outer.y + outer.h - wallH, outer.x + outer.w - (gateX + gateW), wallH);
// 서·동 외벽
for (let y = outer.y + wallH; y < outer.y + outer.h - wallH; y += wallH) {
  const h = Math.min(wallH, outer.y + outer.h - wallH - y);
  paintWallFaceColumn(map, outer.x, y, h);
  paintWallFaceColumn(map, outer.x + outer.w - 1, y, h);
}
// 모서리 보강(세로 이어짐)
paintWallFaceColumn(map, outer.x, outer.y + wallH, outer.h - wallH * 2);
paintWallFaceColumn(map, outer.x + outer.w - 1, outer.y + wallH, outer.h - wallH * 2);

// 내성 안 마당 — 통행 가능한 잔디 (성 지붕 타일은 solid 라 마당에 깔면 NPC 불가)
const inner = { x: outer.x + 2, y: outer.y + wallH + 1, w: outer.w - 4, h: outer.h - wallH * 2 - 2 };
fillLower(map, inner.x, inner.y, inner.w, inner.h, TILE.GRASS);

// 본채 탑 — 북쪽 중앙 지붕 면 + 아래 성벽 (앞 2칸은 잔디 남겨 통행)
const keep = { x: 18, y: 8, w: 12, h: 8 };
paintRoofDeck(map, keep.x, keep.y, keep.w, 3);
paintWallRow(map, keep.x, keep.y + 3, keep.w, 3);

// 모서리 망루 4개 (작은 지붕 면 + 벽)
const towers = [
  { x: outer.x, y: outer.y, w: 4, h: 4 },
  { x: outer.x + outer.w - 4, y: outer.y, w: 4, h: 4 },
  { x: outer.x, y: outer.y + outer.h - 5, w: 4, h: 5 },
  { x: outer.x + outer.w - 4, y: outer.y + outer.h - 5, w: 4, h: 5 },
];
for (const t of towers) {
  paintRoofDeck(map, t.x, t.y, t.w, 2);
  paintWallRow(map, t.x, t.y + 2, t.w, Math.max(2, t.h - 2));
}

// 남문 통로 — 잔디/길
for (let y = outer.y + outer.h - wallH; y < outer.y + outer.h + 2; y += 1) {
  for (let x = gateX; x < gateX + gateW; x += 1) setLower(map, x, y, TILE.GRASS);
}
// 입구 모래 길
const road = runOk(ctx, "paint_road", {
  mapId: MAP_ID,
  style: "sand",
  points: [
    { x: gateX + 1, y: H - 3 },
    { x: gateX + 1, y: outer.y + outer.h - 1 },
    { x: gateX + 1, y: Math.floor(inner.y + inner.h / 2) },
  ],
  naturalness: 0.15,
  seed: 9001,
});
console.log(road);

// 마당 벤치·마법진 약간
runOk(ctx, "place_props", {
  mapId: MAP_ID,
  area: { x: inner.x + 4, y: inner.y + 4, w: 10, h: 6 },
  material: "벤치",
  count: 2,
  minGap: 3,
  naturalness: 0.55,
  seed: 9100,
});
runOk(ctx, "place_props", {
  mapId: MAP_ID,
  area: { x: keep.x + 2, y: keep.y + 5, w: 6, h: 3 },
  material: "마법진",
  count: 1,
  minGap: 0,
  naturalness: 0.4,
  seed: 9101,
});

// 문지기 — 남문 밖 잔디
runOk(ctx, "place_npc", {
  mapId: MAP_ID,
  x: gateX + 1,
  y: Math.min(H - 2, outer.y + outer.h + 1),
  name: "문지기",
  graphic: { query: "warrior" },
  movement: "fixed",
  pages: [{ lines: ["성채에 오신 것을 환영하오. 무기는 문 앞에 두고 들어가시오."] }],
});
// 성주 — 내성 마당 중앙 (잔디)
runOk(ctx, "place_npc", {
  mapId: MAP_ID,
  x: Math.floor(inner.x + inner.w / 2),
  y: Math.floor(inner.y + inner.h / 2),
  name: "성주",
  graphic: { query: "old man" },
  movement: "fixed",
  pages: [{ lines: ["이 성은 옛 왕조의 보루였소. 여장 위 바람을 느껴 보시오."] }],
});

// 맵 트리에 추가
const tree = project.mapTree;
const already = JSON.stringify(tree).includes(MAP_ID);
if (!already) {
  if (!tree.mapId || !project.maps[tree.mapId]) {
    project.mapTree = { mapId: MAP_ID, children: tree.mapId ? [tree] : tree.children ?? [] };
  } else {
    tree.children = [...(tree.children ?? []), { mapId: MAP_ID, children: [] }];
  }
}

// 시작 위치: 성 남쪽 입구 (호수 마을 start는 유지)
// 사용자가 성 맵을 바로 보려면 start 를 바꿀 수도 있으나 호수 마을 유지 요청 없었음 → start 유지
// project.startMapId = MAP_ID;
// project.startPos = { x: gateX + 1, y: H - 4 };

const saved = await saveProjectToSupabase(ctx.project, config);
console.log("[saved]", saved);

// 검증 카운트
let castleTiles = 0;
const map2 = ctx.project.maps[MAP_ID]!;
const castleSet = new Set(Object.keys(CASTLE_META).map(Number));
for (const t of map2.lowerTiles) if (castleSet.has(t)) castleTiles += 1;

const report = {
  metaUpdated: metaCount,
  labels: Object.fromEntries(Object.entries(CASTLE_META).map(([k, v]) => [k, v.label])),
  map: {
    id: MAP_ID,
    size: `${W}x${H}`,
    castleTileCells: castleTiles,
    events: map2.events.length,
  },
  saved,
  startUnchanged: { mapId: ctx.project.startMapId, pos: ctx.project.startPos },
};
const outDir = path.join("output", "evidence", "castle-map");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
console.log("[done] castle meta + map_castle_keep");
