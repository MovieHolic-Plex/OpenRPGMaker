/**
 * 성 캔버스 — 사용자가 직접 성 타일을 찍을 빈 맵을 만든다.
 *  - 잔디 캔버스(빈 판)
 *  - 성 타일 전량(지붕/여장 3×4 블록 + 성벽 정면 + 원형 타워) 라벨·설명 적용 → 팔레트 자기설명
 *  - 좌상단에 '문법 견본판'(조립 예시)만 얹고 나머지는 전부 비움 (견본은 지워도 됨)
 * bun scripts/build-castle-canvas.mts
 */
import fs from "node:fs";
import path from "node:path";
import { loadProjectFromSupabase, saveProjectToSupabase } from "../src/project/supabaseProjectSync.ts";
import { runTool } from "../src/editor/tools/toolRunner.ts";
import { TILE } from "../src/project/defaults/constants.ts";
import { CASTLE_ROOF, CASTLE_WALL, CASTLE_ROUND_TOWER } from "../src/editor/castleKit.ts";
import type { GameMap, Project, TilesetDef } from "../src/project/types.ts";

const MAP_ID = "map_castle_canvas";
const MAP_NAME = "성 캔버스(직접 찍기)";
const TILESET_ID = "easyrpg_chipset_combined_town";
const W = 50;
const H = 40;

// ── 성 타일 라벨(팔레트 자기설명). upper 여부 표기 포함. ──
type Meta = { label: string; description: string; layer: "lower" | "upper" };
const CASTLE_META: Record<number, Meta> = {
  // 성 지붕/여장 3×4 블록 (가로·세로 확장 가능, 중앙이 반복 몸통)
  18: { label: "성 지붕 ┌ 좌상", description: "지붕/여장 블록 왼쪽 위 모서리. 하위, 통행 불가.", layer: "lower" },
  19: { label: "성 지붕 ─ 상단", description: "지붕/여장 블록 윗변. 좌(18)·우(20) 사이 가로 반복. 하위.", layer: "lower" },
  20: { label: "성 지붕 ┐ 우상", description: "지붕/여장 블록 오른쪽 위 모서리. 하위.", layer: "lower" },
  48: { label: "성 지붕 │ 좌측(상)", description: "지붕/여장 블록 왼쪽 변 윗구간. 세로 반복. 하위.", layer: "lower" },
  49: { label: "성 지붕 바닥(옅은)", description: "보루 위 보행로/지붕 면 채움(옅은 회색). 하위.", layer: "lower" },
  50: { label: "성 지붕 ■ 몸통", description: "지붕/여장 가운데 몸통. 상하좌우 확장으로 넓은 면. 하위.", layer: "lower" },
  78: { label: "성 지붕 │ 좌측(하)", description: "지붕/여장 왼쪽 변 아랫구간. 하위.", layer: "lower" },
  79: { label: "성 지붕 바닥(진한)", description: "보루 위 그림자/대비 채움(진한 회색). 하위.", layer: "lower" },
  80: { label: "성 지붕 ■ 몸통(하)", description: "지붕/여장 몸통 아랫구간. 50과 세로로 이어 키움. 하위.", layer: "lower" },
  108: { label: "성 지붕 └ 좌하", description: "지붕/여장 블록 왼쪽 아래 모서리. 하위.", layer: "lower" },
  109: { label: "성 지붕 ─ 하단", description: "지붕/여장 블록 아랫변. 좌(108)·우(110) 사이 가로 반복. 하위.", layer: "lower" },
  110: { label: "성 지붕 ┘ 우하", description: "지붕/여장 블록 오른쪽 아래 모서리. 하위.", layer: "lower" },
  // 성벽 정면 세로 3단(중단 확장)
  21: { label: "성벽 정면 ▲ 상단", description: "성벽 정면 맨 위 단(여장 바로 아래). 가로 반복. 하위, 통행 불가.", layer: "lower" },
  51: { label: "성벽 정면 ■ 중단", description: "성벽 정면 몸통. 21(상)·81(하) 사이 세로·가로 무제한 확장. 하위.", layer: "lower" },
  81: { label: "성벽 정면 ▼ 하단", description: "성벽 정면 맨 아래 단(지면 접면). 가로 반복. 하위.", layer: "lower" },
  // 원형 타워 (세로 조립: 캡 → 몸통/창 → 베이스)
  24: { label: "원형탑 캡 좌(상위)", description: "원형 타워 지붕 캡 왼쪽. 상위 레이어(뒤 비침). 25와 좌우 페어.", layer: "upper" },
  25: { label: "원형탑 캡 우(상위)", description: "원형 타워 지붕 캡 오른쪽. 상위. 24와 페어.", layer: "upper" },
  138: { label: "원형탑 목 좌", description: "캡 아래 타워 목(어깨) 왼쪽. 하위.", layer: "lower" },
  139: { label: "원형탑 목 우", description: "캡 아래 타워 목(어깨) 오른쪽. 하위.", layer: "lower" },
  140: { label: "원형탑 몸통 좌", description: "타워 몸통 왼쪽. 세로 반복으로 높이 조절. 하위.", layer: "lower" },
  141: { label: "원형탑 몸통 우", description: "타워 몸통 오른쪽. 세로 반복. 하위.", layer: "lower" },
  142: { label: "원형탑 창 좌", description: "타워 몸통에 뚫는 창 왼쪽(화살구멍). 하위.", layer: "lower" },
  143: { label: "원형탑 창 우", description: "타워 몸통 창 오른쪽. 하위.", layer: "lower" },
  54: { label: "원형탑 베이스 좌(상위)", description: "타워 지면 접합 베이스 왼쪽. 상위 레이어. 55와 페어.", layer: "upper" },
  55: { label: "원형탑 베이스 우(상위)", description: "타워 지면 접합 베이스 오른쪽. 상위. 54와 페어.", layer: "upper" },
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
  if (!result.ok) throw new Error(`${name}: ${result.summary}\n${JSON.stringify(result.issues ?? [], null, 2)}`);
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

function applyCastleMeta(tileset: TilesetDef): number {
  tileset.tileMeta ??= [];
  while (tileset.tileMeta.length < tileset.count) tileset.tileMeta.push({ label: "", description: "", source: "unknown" });
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
      defaultLayer: meta.layer,
      passage: "solid",
      role: "structure",
      confidence: "high",
    };
    tileset.priority[i] = meta.layer;
    tileset.passability[i] = { up: false, down: false, left: false, right: false };
    n += 1;
  }
  return n;
}

/** 좌상단 문법 견본판 — 조립된 예시(지워도 됨). */
function paintGrammarSampler(map: GameMap): void {
  // (A) 지붕/여장 3×4 블록 @ (2,2)
  const R = CASTLE_ROOF;
  const deck = [
    [R.TL, R.T, R.TR],
    [R.L, R.FILL_LIGHT, R.BODY],
    [R.L2, R.FILL_DARK, R.BODY2],
    [R.BL, R.B, R.BR],
  ];
  for (let dy = 0; dy < deck.length; dy += 1) for (let dx = 0; dx < 3; dx += 1) setLower(map, 2 + dx, 2 + dy, deck[dy]![dx]!);
  // 그 아래 성벽 정면 3단 (여장 지붕과 붙는 정면벽)
  for (let dx = 0; dx < 3; dx += 1) {
    setLower(map, 2 + dx, 6, CASTLE_WALL.TOP);
    setLower(map, 2 + dx, 7, CASTLE_WALL.MID);
    setLower(map, 2 + dx, 8, CASTLE_WALL.BOT);
  }

  // (B) 원형 타워 @ (7,2) — 캡(상위) → 몸통 → 창 → 베이스(상위)
  const T = CASTLE_ROUND_TOWER;
  setUpper(map, 7, 2, T.CAP_L); setUpper(map, 8, 2, T.CAP_R);
  setLower(map, 7, 3, T.NECK_L); setLower(map, 8, 3, T.NECK_R);
  setLower(map, 7, 4, T.BODY_L); setLower(map, 8, 4, T.BODY_R);
  setLower(map, 7, 5, T.WIN_L); setLower(map, 8, 5, T.WIN_R);
  setLower(map, 7, 6, T.BODY_L); setLower(map, 8, 6, T.BODY_R);
  setUpper(map, 7, 7, T.BASE_L); setUpper(map, 8, 7, T.BASE_R);

  // (C) 성벽 + 남문 예시 @ y 11~13, x 2~13 (문 gap x=7,8)
  for (let x = 2; x <= 13; x += 1) {
    if (x === 7 || x === 8) continue; // 문 통로
    setLower(map, x, 11, CASTLE_WALL.TOP);
    setLower(map, x, 12, CASTLE_WALL.MID);
    setLower(map, x, 13, CASTLE_WALL.BOT);
  }
}

const env = loadEnv();
const config = {
  url: env.VITE_SUPABASE_URL!.replace(/\/$/, ""),
  anonKey: env.VITE_SUPABASE_ANON_KEY!,
  projectId: env.VITE_SUPABASE_PROJECT_ID || "rpg-zzu-dungeon-example",
};

const project = await loadProjectFromSupabase(config);
if (!project) throw new Error("load failed");

const tileset = project.tilesets[TILESET_ID];
if (!tileset) throw new Error(`missing tileset ${TILESET_ID}`);
const metaCount = applyCastleMeta(tileset);
console.log("[meta] castle tiles labeled:", metaCount);

// 기존 캔버스 있으면 교체
if (project.maps[MAP_ID]) delete project.maps[MAP_ID];

const ctx = { project };
runOk(ctx, "create_map", { id: MAP_ID, name: MAP_NAME, width: W, height: H });
const map = ctx.project.maps[MAP_ID]!;
map.tilesetId = TILESET_ID;
map.lowerTiles.fill(TILE.GRASS);
map.upperTiles.fill(TILE.EMPTY);

paintGrammarSampler(map);

// 맵 트리에 추가 (기존 start/맵 유지)
const tree = ctx.project.mapTree;
if (!JSON.stringify(tree).includes(MAP_ID)) {
  if (!tree.mapId || !ctx.project.maps[tree.mapId]) {
    ctx.project.mapTree = { mapId: MAP_ID, children: tree.mapId ? [tree] : tree.children ?? [] };
  } else {
    tree.children = [...(tree.children ?? []), { mapId: MAP_ID, children: [] }];
  }
}

const saved = await saveProjectToSupabase(ctx.project, config);

// 검증 카운트
let castleCells = 0;
const castleSet = new Set(Object.keys(CASTLE_META).map(Number));
for (const t of map.lowerTiles) if (castleSet.has(t)) castleCells += 1;
for (const t of map.upperTiles) if (castleSet.has(t)) castleCells += 1;

const report = {
  projectId: config.projectId,
  map: { id: MAP_ID, name: MAP_NAME, size: `${W}x${H}`, castleSamplerCells: castleCells },
  labeled: metaCount,
  saved: (saved as { kind?: string })?.kind ?? saved,
  startUnchanged: { mapId: ctx.project.startMapId, pos: ctx.project.startPos },
};
const outDir = path.join("output", "evidence", "castle-canvas");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
console.log("[done] 성 캔버스", MAP_ID);
