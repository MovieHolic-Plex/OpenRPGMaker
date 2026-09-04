/**
 * 타일 하네스(create_map + build_castle + author_house)로 "성채 마을" 맵을 만들고
 * Supabase에 저장 → 재로드로 존재 증명 → PNG 스크린샷 렌더.
 *
 *   bun scripts/build-castle-village-demo.mts
 *
 * 산출물:
 *   output/evidence/castle-village/castle-village-map.png  (육안 스크린샷)
 *   output/evidence/castle-village/report.json             (시공/저장/재로드 증거)
 */
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import { loadProjectFromSupabase, saveProjectToSupabase } from "../src/project/supabaseProjectSync.ts";
import { runTool } from "../src/editor/tools/toolRunner.ts";
import { chipsetQuarterComposition } from "../src/project/defaults/terrainQuarterAutotile.ts";
import { createBlankProject } from "../src/project/defaults.ts";
import type { GameMap, Project } from "../src/project/types.ts";

const MAP_ID = "map_castle_village_demo";
const MAP_NAME = "성채 마을";
const MAP_W = 56;
const MAP_H = 60;

// 렌더 상수 (Combined Town 칩셋)
const TILE = 16;
const COLS = 30;
const SCALE = 4;
const CHIP_PATH = "public/assets/easyrpg-chipset-combined-town-transparent.png";
const OUT_DIR = path.resolve("output/evidence/castle-village");

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

// ── 1) Supabase 로드 ──
const env = loadEnv();
const config = {
  url: env.VITE_SUPABASE_URL!.replace(/\/$/, ""),
  anonKey: env.VITE_SUPABASE_ANON_KEY!,
  projectId: env.VITE_SUPABASE_PROJECT_ID || "rpg-zzu-house-template-gallery",
};
if (!config.url || !config.anonKey) {
  throw new Error("Supabase 자격증명이 없습니다 (.env.local 확인 필요).");
}

const project = await loadProjectFromSupabase(config);
if (!project) throw new Error(`Supabase 로드 실패: ${config.projectId}`);
console.log(`[load] project=${config.projectId} maps=${Object.keys(project.maps).length}`);

// 기존 데모 맵이 있으면 교체(비파괴: 다른 맵/시작점은 건드리지 않음)
if (project.maps[MAP_ID]) {
  delete project.maps[MAP_ID];
  const strip = (node: { mapId: string; children?: any[] }): any => ({
    mapId: node.mapId,
    children: (node.children ?? []).filter((c) => c.mapId !== MAP_ID).map(strip),
  });
  if (project.mapTree.mapId === MAP_ID) {
    const kids = (project.mapTree.children ?? []).filter((c) => c.mapId !== MAP_ID);
    project.mapTree = kids[0]
      ? { mapId: kids[0].mapId, children: [...(kids[0].children ?? []), ...kids.slice(1)] }
      : { mapId: Object.keys(project.maps)[0] ?? MAP_ID, children: [] };
  } else {
    project.mapTree = strip(project.mapTree);
  }
  console.log(`[replace] 기존 ${MAP_ID} 제거`);
}

const ctx = { project };

// ── 2) 맵 생성 (잔디 평지) ──
console.log(runOk(ctx, "create_map", { id: MAP_ID, name: MAP_NAME, width: MAP_W, height: MAP_H, border: "none" }));

// ── 3) 성 시공 (상단 영역) ──
console.log(
  runOk(ctx, "build_castle", {
    mapId: MAP_ID,
    bounds: { x: 2, y: 1, w: 52, h: 34 },
    wallHeight: 2,
    gateWidth: 8,
    roundTower: true,
    path: true,
    npcs: true,
    seed: 20260719,
  }),
);

// ── 4) 집 4채 (하단, 외장만 — interior:false) ──
const houses: Array<{ kitId: string; wing: { x: number; y: number; w: number; h: number }; owner: string }> = [
  { kitId: "blue-stone", wing: { x: 5, y: 39, w: 13, h: 9 }, owner: "청석집" },
  { kitId: "bright-plaster", wing: { x: 30, y: 39, w: 13, h: 9 }, owner: "회벽집" },
  { kitId: "amber-wood", wing: { x: 5, y: 50, w: 13, h: 9 }, owner: "호박목재집" },
  { kitId: "slate-wood", wing: { x: 30, y: 50, w: 13, h: 9 }, owner: "슬레이트집" },
];
for (const h of houses) {
  console.log(
    runOk(ctx, "author_house", {
      kind: "single",
      mapId: MAP_ID,
      kitId: h.kitId,
      wings: [h.wing],
      door: true,
      interior: "exterior-only",
      ownerName: h.owner,
      windows: { spacing: 2 },
      yard: [],
    }),
  );
}

const built = ctx.project.maps[MAP_ID]!;
console.log(`[built] ${MAP_ID} ${built.width}x${built.height} events=${built.events.length}`);

// ── 5) Supabase 저장 ──
const saved = await saveProjectToSupabase(ctx.project, config);
console.log(`[save] ${saved ? "성공" : "실패"}`);
if (!saved) throw new Error("Supabase 저장 실패");

// ── 5b) 재로드 검증 ──
const reloaded = await loadProjectFromSupabase(config);
const reloadedMap = reloaded?.maps[MAP_ID];
if (!reloadedMap) throw new Error("재로드 검증 실패: 저장된 맵을 다시 찾지 못했습니다.");
console.log(`[verify] 재로드 확인 — ${MAP_ID} ${reloadedMap.width}x${reloadedMap.height} events=${reloadedMap.events.length}`);

// ── 6) PNG 렌더 (재로드한 맵으로) ──
const tileset =
  reloaded!.tilesets[reloadedMap.tilesetId] ??
  createBlankProject().tilesets.easyrpg_chipset_combined_town!;
const chip = PNG.sync.read(fs.readFileSync(CHIP_PATH));

function blitTile(
  dst: PNG,
  tile: number,
  dx: number,
  dy: number,
  scale: number,
  q?: { sx: number; sy: number; sw: number; sh: number },
): void {
  if (tile < 0) return;
  const col = tile % COLS;
  const row = Math.floor(tile / COLS);
  const sx0 = col * TILE + (q?.sx ?? 0);
  const sy0 = row * TILE + (q?.sy ?? 0);
  const sw = q?.sw ?? TILE;
  const sh = q?.sh ?? TILE;
  for (let y = 0; y < sh * scale; y += 1) {
    for (let x = 0; x < sw * scale; x += 1) {
      const sx = sx0 + Math.floor(x / scale);
      const sy = sy0 + Math.floor(y / scale);
      const si = (sy * chip.width + sx) * 4;
      const di = ((dy + y) * dst.width + (dx + x)) * 4;
      const a = chip.data[si + 3]!;
      if (a === 0) continue;
      dst.data[di] = chip.data[si]!;
      dst.data[di + 1] = chip.data[si + 1]!;
      dst.data[di + 2] = chip.data[si + 2]!;
      dst.data[di + 3] = 255;
    }
  }
}

function renderMap(map: GameMap, file: string): void {
  const png = new PNG({ width: map.width * TILE * SCALE, height: map.height * TILE * SCALE });
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = 20;
    png.data[i + 1] = 18;
    png.data[i + 2] = 24;
    png.data[i + 3] = 255;
  }
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      const i = y * map.width + x;
      const lower = map.lowerTiles[i]!;
      const upper = map.upperTiles[i]!;
      const dx = x * TILE * SCALE;
      const dy = y * TILE * SCALE;
      const composition = chipsetQuarterComposition(map, tileset, x, y);
      if (composition) {
        blitTile(png, composition.underlayTile ?? lower, dx, dy, SCALE);
        for (const src of composition.sources) {
          blitTile(png, src.tile, dx + src.offsetX * SCALE, dy + src.offsetY * SCALE, SCALE, {
            sx: src.offsetX,
            sy: src.offsetY,
            sw: 8,
            sh: 8,
          });
        }
      } else if (lower >= 0) blitTile(png, lower, dx, dy, SCALE);
      if (upper >= 0) blitTile(png, upper, dx, dy, SCALE);
    }
  }
  // 이벤트(NPC) 마커
  for (const ev of map.events ?? []) {
    const cx = Math.floor((ev.x + 0.5) * TILE * SCALE);
    const cy = Math.floor((ev.y + 0.5) * TILE * SCALE);
    const r = Math.max(3, Math.floor(TILE * SCALE * 0.2));
    for (let y = -r; y <= r; y += 1) {
      for (let x = -r; x <= r; x += 1) {
        if (x * x + y * y > r * r) continue;
        const px = cx + x;
        const py = cy + y;
        if (px < 0 || py < 0 || px >= png.width || py >= png.height) continue;
        const di = (py * png.width + px) * 4;
        png.data[di] = 60;
        png.data[di + 1] = 140;
        png.data[di + 2] = 255;
        png.data[di + 3] = 255;
      }
    }
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, PNG.sync.write(png));
  console.log(`[render] ${file} ${map.width}x${map.height} events=${map.events.length}`);
}

const pngFile = path.join(OUT_DIR, "castle-village-map.png");
renderMap(reloadedMap, pngFile);

// ── 7) 증거 리포트 ──
fs.mkdirSync(OUT_DIR, { recursive: true });
const report = {
  projectId: config.projectId,
  mapId: MAP_ID,
  mapName: MAP_NAME,
  size: `${reloadedMap.width}x${reloadedMap.height}`,
  events: reloadedMap.events.map((e) => ({ id: e.id, x: e.x, y: e.y })),
  houses: houses.map((h) => ({ kitId: h.kitId, ...h.wing, owner: h.owner })),
  saved,
  reloadVerified: true,
  png: pngFile,
  startUnchanged: { mapId: reloaded!.startMapId, pos: reloaded!.startPos },
};
fs.writeFileSync(path.join(OUT_DIR, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
console.log(`[done] 성채 마을 ${MAP_ID} → project ${config.projectId}`);
