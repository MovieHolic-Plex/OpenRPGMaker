/**
 * 재구성 성채 저장 — 사용자 문법으로 조립한 '관문 요새'를 프로젝트 맵으로 저장.
 * bun scripts/save-castle-rebuilt.mts
 */
import fs from "node:fs";
import path from "node:path";
import { loadProjectFromSupabase, saveProjectToSupabase } from "../src/project/supabaseProjectSync.ts";
import { runTool } from "../src/editor/tools/toolRunner.ts";
import { TILE } from "../src/project/defaults/constants.ts";
import { paintRoofDeck, paintWallFaceRow, paintRoundTower } from "../src/editor/castleKit.ts";
import type { GameMap, Project } from "../src/project/types.ts";

const MAP_ID = "map_castle_rebuilt";
const MAP_NAME = "성채(재구성) — 관문 요새";
const TILESET_ID = "easyrpg_chipset_combined_town";
const W = 36, H = 26;
const GRASS = TILE.GRASS;

const FLOOR = { TL: 276, T: 277, TR: 278, L: 306, C: 307, R: 308, BL: 336, B: 337, BR: 338 };
const D = { PENNANT: 209, TAPESTRY: 179, PORTCULLIS: 88, GATE: 359, STAIR_L: 111, STAIR_M: 112, STAIR_R: 113, WELL: 382, BRAZIER: 381 };

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
  }
  return env;
}
function runOk(ctx: { project: Project }, name: string, args: Record<string, unknown>): string {
  const r = runTool(ctx, name, args);
  if (!r.ok) throw new Error(`${name}: ${r.summary}\n${JSON.stringify(r.issues ?? [], null, 2)}`);
  return r.summary;
}
const sL = (m: GameMap, x: number, y: number, t: number) => { if (x >= 0 && y >= 0 && x < m.width && y < m.height) m.lowerTiles[y * m.width + x] = t; };
const sU = (m: GameMap, x: number, y: number, t: number) => { if (x >= 0 && y >= 0 && x < m.width && y < m.height) m.upperTiles[y * m.width + x] = t; };
function floor(m: GameMap, x0: number, y0: number, w: number, h: number): void {
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
    const l = x === 0, r = x === w - 1, t = y === 0, b = y === h - 1;
    let tile = FLOOR.C;
    if (t && l) tile = FLOOR.TL; else if (t && r) tile = FLOOR.TR; else if (t) tile = FLOOR.T;
    else if (b && l) tile = FLOOR.BL; else if (b && r) tile = FLOOR.BR; else if (b) tile = FLOOR.B;
    else if (l) tile = FLOOR.L; else if (r) tile = FLOOR.R;
    sL(m, x0 + x, y0 + y, tile);
  }
}
function stair(m: GameMap, x0: number, y0: number, w: number, h: number): void {
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) sL(m, x0 + x, y0 + y, x === 0 ? D.STAIR_L : x === w - 1 ? D.STAIR_R : D.STAIR_M);
}
function hangBanners(m: GameMap, x0: number, x1: number, y: number): void { for (let x = x0; x <= x1; x += 2) sU(m, x, y, D.PENNANT); }

function buildGatehouse(m: GameMap): { gateX: number; gateW: number; approachY: number } {
  const ox = 3, oy = 1, ow = 30, oh = 20, deckH = 2, faceH = 3;
  floor(m, ox + 2, oy + deckH, ow - 4, oh - deckH - faceH - 2);
  paintRoofDeck(m, ox, oy, ow, deckH);
  paintRoofDeck(m, ox, oy + deckH, 2, oh - deckH - faceH);
  paintRoofDeck(m, ox + ow - 2, oy + deckH, 2, oh - deckH - faceH);
  paintWallFaceRow(m, ox, oy + oh - faceH, 2, faceH, { skipTop: true });
  paintWallFaceRow(m, ox + ow - 2, oy + oh - faceH, 2, faceH, { skipTop: true });
  const kw = 10, kx = ox + Math.floor((ow - kw) / 2), ky = oy + deckH;
  paintRoofDeck(m, kx, ky, kw, 3);
  paintWallFaceRow(m, kx, ky + 3, kw, 3);
  sL(m, kx + kw / 2 - 1, ky + 5, D.GATE); sL(m, kx + kw / 2, ky + 5, D.GATE);
  sU(m, kx + 1, ky + 3, D.TAPESTRY); sU(m, kx + kw - 2, ky + 3, D.TAPESTRY);
  const gw = 4, gx = ox + Math.floor((ow - gw) / 2), sy = oy + oh - faceH, deckTop = oy + oh - faceH;
  paintWallFaceRow(m, ox, sy, gx - ox, faceH, { skipTop: true });
  paintWallFaceRow(m, gx + gw, sy, ox + ow - (gx + gw), faceH, { skipTop: true });
  hangBanners(m, ox + 1, gx - 2, sy);
  hangBanners(m, gx + gw + 1, ox + ow - 2, sy);
  for (let y = deckTop; y < sy + faceH + 2; y += 1) for (let x = gx; x < gx + gw; x += 1) { sL(m, x, y, GRASS); sU(m, x, y, 0); }
  stair(m, gx, sy, gw, faceH + 1);
  sL(m, gx, deckTop, D.GATE); sL(m, gx + gw - 1, deckTop, D.GATE);
  sU(m, gx, deckTop, D.PORTCULLIS); sU(m, gx + gw - 1, deckTop, D.PORTCULLIS);
  paintRoundTower(m, ox + 1, oy, 6);
  paintRoundTower(m, ox + ow - 3, oy, 6);
  paintRoundTower(m, ox + 1, sy - 6, 6);
  paintRoundTower(m, ox + ow - 3, sy - 6, 6);
  sU(m, ox + 5, oy + oh - faceH - 3, D.WELL);
  sU(m, ox + ow - 6, oy + oh - faceH - 3, D.BRAZIER);
  sU(m, ox + 6, oy + oh - faceH - 3, D.BRAZIER);
  return { gateX: gx, gateW: gw, approachY: sy + faceH + 2 };
}

const env = loadEnv();
const config = { url: env.VITE_SUPABASE_URL!.replace(/\/$/, ""), anonKey: env.VITE_SUPABASE_ANON_KEY!, projectId: env.VITE_SUPABASE_PROJECT_ID || "rpg-zzu-dungeon-example" };
const project = await loadProjectFromSupabase(config);
if (!project) throw new Error("load failed");
if (project.maps[MAP_ID]) delete project.maps[MAP_ID];

const ctx = { project };
runOk(ctx, "create_map", { id: MAP_ID, name: MAP_NAME, width: W, height: H });
const map = ctx.project.maps[MAP_ID]!;
map.tilesetId = TILESET_ID;
map.lowerTiles.fill(GRASS);
map.upperTiles.fill(TILE.EMPTY);
const info = buildGatehouse(map);

// 성문 앞 잔디 접근 확보(통행). NPC: 문지기
runOk(ctx, "place_npc", {
  mapId: MAP_ID, x: info.gateX + 1, y: Math.min(H - 2, info.approachY + 1),
  name: "문지기", graphic: { query: "guard" }, movement: "fixed",
  pages: [{ lines: ["관문 요새에 오셨소. 성주께서 알현실에서 기다리시오."] }],
});

const tree = ctx.project.mapTree;
if (!JSON.stringify(tree).includes(MAP_ID)) {
  if (!tree.mapId || !ctx.project.maps[tree.mapId]) ctx.project.mapTree = { mapId: MAP_ID, children: tree.mapId ? [tree] : tree.children ?? [] };
  else tree.children = [...(tree.children ?? []), { mapId: MAP_ID, children: [] }];
}
const saved = await saveProjectToSupabase(ctx.project, config);
console.log("[saved]", (saved as { kind?: string })?.kind ?? saved, "->", MAP_ID, `${W}x${H}`);
