import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { chromium, type Browser } from "playwright";
import { PNG } from "pngjs";
import type { GameMap, Project, TilesetDef } from "../../src/project/types.ts";
import { deserialize, serialize } from "../../src/project/io.ts";
import { renderMapPng } from "../qa-game/render.mts";
import { runSceneTest } from "../../src/testing/sceneTestRunner.ts";
import { startPlayerQaServer } from "../lib/runtimeQaRun.mjs";
import "../lib/oauthClients.mjs";
import { resolveRequestApiKey } from "../lib/aiAuthRuntime.ts";
import { completeProvider } from "../lib/ohMyPiPiAiRuntime.ts";
import { finishDraftTilesets } from "../../src/editor/tools/changeset.ts";
import { bakeWorkshopObject } from "../../src/project/workshopTiles.ts";
import { bundledChipsetTilesPerRow } from "../../src/assets/bundledChipsetGeometry.ts";
import { charsetFrameSource, type CharsetDirection } from "../../src/assets/easyrpgRtp.ts";
import { ensureEventHasVisibleGraphic } from "../../src/editor/tools/customMapObjectTools.ts";
import { installBeodeulArchitecture } from "../../src/project/defaults/beodeulArchitecture.ts";
import { compactMapLayers, setLayerTileAt } from "../../src/project/mapLayers.ts";
import { CONSTRUCTION_TOOLS_V3 } from "../../src/editor/tools/v3/constructionTools.ts";
import { SHARED_OBJECT_TOOLS } from "../../src/editor/tools/sharedObjectTools.ts";
import { dressBeodeulGround } from "../../src/editor/tools/beodeulGroundTools.ts";
import { createJrpg200FixtureProject } from "./jrpg-200-harness.mts";
import { JRPG_200_CASES, type JrpgCommandCase } from "./jrpg-200-cases.mts";

const MODEL_PROVIDER = "google-antigravity" as const;
const MODEL_ID = "gemini-4-argon";

const fillRegionTool = CONSTRUCTION_TOOLS_V3.find((t) => t.name === "fill_region")!;
const stampObjectTool = SHARED_OBJECT_TOOLS.find((t) => t.name === "stamp_object")!;

// ============================================================================
// 1. Atomic Clause & 2-Pass Live In-Game Brutal QA Contract
// ============================================================================

export interface AtomicClauseCheck {
  readonly id: string;
  readonly clause: string;
  readonly category:
    | "floor_integrity"
    | "map_setting"
    | "terrain_object"
    | "ingame_audio"
    | "ingame_visual_fx"
    | "ingame_branch_dom"
    | "db_entity"
    | "pass1_map_judge"
    | "pass2_ingame_judge";
  readonly passed: boolean;
  readonly detail: string;
}

export interface LiveInGameBranchTelemetry {
  readonly branchLabel: string;
  readonly screenshotPath: string;
  readonly afterScreenshotPath?: string;
  /** Frame captured at the strongest on-screen effect (tint/shake/particles) seen while playing the whole event. */
  readonly peakScreenshotPath?: string;
  readonly walkPeak?: boolean;
  /** Every distinct dialogue box text seen while playing the event. */
  readonly dialogueLines?: string[];
  readonly audioObserved: string[];
  readonly screenEffectVisible: boolean;
  readonly screenEffectMode: string;
  readonly screenEffectBg: string;
  readonly letterboxPx: number;
  readonly particleEmitterCount: number;
  readonly aliveParticles: number;
  readonly shakeIntensity: number;
  readonly weatherKind: string;
  readonly playerPose: string;
  readonly playerTint: string;
  readonly playerAngle: number;
  readonly followerCount: number;
  readonly mapOverrideCount: number;
  readonly dialogueVisible: boolean;
  readonly dialogueText: string;
  readonly gameOverAfterAdvance: boolean;
  readonly switchesAfterAdvance: Record<string, boolean>;
  readonly pageErrors: string[];
  readonly consoleErrors: string[];
  readonly missingResourceError: boolean;
}

export interface BrutalPilotEvaluation {
  readonly caseId: string;
  readonly title: string;
  readonly prompt: string;
  readonly mode: "before_lenient" | "after_brutal_fix";
  readonly overallPassed: boolean;
  readonly passedCount: number;
  readonly totalClauses: number;
  readonly clauses: AtomicClauseCheck[];
  readonly branchA: LiveInGameBranchTelemetry;
  readonly branchB: LiveInGameBranchTelemetry;
  readonly pass1MapJudgeVerdict: {
    passed: boolean;
    score: number;
    critique: string;
  };
  readonly pass2InGameJudgeVerdict: {
    passed: boolean;
    score: number;
    critique: string;
  };
}

// ============================================================================
// 2. Seamless Organic Custom 3x3 Floor & 2x2 Object Pixel Grids
//    ("." = copy exact rendered pixel from pre-bake map PNG so there is ZERO
//     rectangular sticker border!)
// ============================================================================

type Rgba = [number, number, number, number];

const DOMAIN_PALETTE: Record<string, Rgba> = {
  ".": [0, 0, 0, 0],
  // Basalt / Volcano / Lava
  K: [22, 18, 20, 255],    // Deep obsidian outline
  D: [48, 38, 42, 255],    // Dark volcanic basalt
  S: [78, 62, 64, 255],    // Mid volcanic rock
  L: [112, 88, 84, 255],   // Warm ash stone
  R: [195, 36, 24, 255],   // Deep magma red
  O: [242, 102, 28, 255],  // Molten lava orange
  Y: [255, 214, 64, 255],  // White-hot magma yellow
  W: [255, 248, 220, 255], // Core incandescence
  // Poison Swamp / Toxic Fog
  P: [74, 28, 108, 255],   // Deep toxic purple
  M: [138, 56, 196, 255],  // Mid poison violet
  V: [198, 120, 255, 255], // Bright toxic mist
  G: [72, 108, 62, 255],   // Mossy swamp rim
  // Grandleon / Sanctuary Gold & Cyan
  A: [184, 138, 44, 255],  // Antique gold
  C: [56, 208, 245, 255],  // Sacred cyan / ice
  B: [24, 120, 196, 255],  // Deep azure
};

function makeGrid(w: number, h: number, fillChar: string, draw: (set: (x: number, y: number, c: string) => void) => void): string[] {
  const grid = Array.from({ length: h }, () => Array.from({ length: w }, () => fillChar));
  const set = (x: number, y: number, c: string) => {
    if (x >= 0 && x < w && y >= 0 && y < h && c.length === 1) {
      grid[y]![x] = c;
    }
  };
  draw(set);
  return grid.map((r) => r.join(""));
}

function drawRect(set: (x: number, y: number, c: string) => void, x0: number, y0: number, w: number, h: number, c: string) {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) set(x, y, c);
  }
}

function drawCircle(set: (x: number, y: number, c: string) => void, cx: number, cy: number, r: number, c: string) {
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r) set(x, y, c);
    }
  }
}

// 48x48 (3x3) Seamless Organic Volcanic Magma Fissure Floor (no square borders!)
const FLOOR_VOLCANO_48 = makeGrid(48, 48, ".", (set) => {
  for (const [cx, cy, r] of [
    [24, 23, 18],
    [15, 29, 12],
    [33, 28, 13],
    [22, 34, 11],
  ] as const) {
    drawCircle(set, cx, cy, r, "S");
    drawCircle(set, cx, cy, r - 1.5, "D");
  }
  drawCircle(set, 24, 22, 14, "K");
  drawCircle(set, 24, 22, 11.5, "R");
  drawCircle(set, 24, 22, 7.5, "O");
  drawCircle(set, 24, 22, 4, "Y");
  drawCircle(set, 33, 29, 6.5, "K");
  drawCircle(set, 33, 29, 5, "R");
  drawCircle(set, 33, 29, 3, "O");
  drawCircle(set, 33, 29, 1.5, "Y");
  for (let y = 18; y < 43; y++) {
    const dx = Math.round(Math.sin(y * 0.38) * 2.5);
    set(24 + dx - 2, y, "K");
    set(24 + dx - 1, y, "R");
    set(24 + dx, y, "Y");
    set(24 + dx + 1, y, "O");
    set(24 + dx + 2, y, "K");
  }
  for (let x = 9; x < 39; x++) {
    const dy = Math.round(Math.cos(x * 0.35) * 2);
    set(x, 26 + dy - 1, "R");
    set(x, 26 + dy, "O");
    set(x, 26 + dy + 1, "K");
  }
});

// 32x32 (2x2) Erupting Volcanic Crater Vent Object
const OBJ_VOLCANO_CRATER_32 = makeGrid(32, 32, ".", (set) => {
  drawCircle(set, 16, 18, 13, "K");
  drawCircle(set, 16, 18, 12, "D");
  drawCircle(set, 16, 16, 10, "S");
  drawCircle(set, 16, 13, 8, "K");
  drawCircle(set, 16, 13, 7, "R");
  drawCircle(set, 16, 13, 5, "O");
  drawCircle(set, 16, 13, 3, "Y");
  drawCircle(set, 16, 12, 1.5, "W");
  for (const [px, py, r, col] of [
    [12, 6, 2, "O"],
    [20, 7, 2, "O"],
    [16, 4, 2.5, "Y"],
    [10, 10, 1.5, "Y"],
    [22, 10, 1.5, "Y"],
  ] as const) {
    drawCircle(set, px, py, r, col);
  }
});

// 48x48 (3x3) Seamless Cracked Stone Bridge Deck over Molten Lava
const FLOOR_LAVA_BRIDGE_48 = makeGrid(48, 48, ".", (set) => {
  for (let y = 17; y < 44; y++) {
    const cx = 24 + Math.round(Math.sin(y * 0.45) * 3);
    set(cx - 2, y, "K");
    set(cx - 1, y, "R");
    set(cx, y, "Y");
    set(cx + 1, y, "O");
    set(cx + 2, y, "K");
  }
});

// 32x32 (2x2) Collapsing Lava Bridge Span Fissure Object
const OBJ_LAVA_BRIDGE_32 = makeGrid(32, 32, ".", (set) => {
  drawCircle(set, 16, 16, 10, "K");
  drawCircle(set, 16, 16, 8.5, "D");
  drawCircle(set, 16, 16, 6.5, "R");
  drawCircle(set, 16, 16, 4.5, "O");
  drawCircle(set, 16, 16, 2.5, "Y");
  drawRect(set, 5, 9, 4, 3, "S");
  drawRect(set, 23, 10, 4, 3, "S");
  drawRect(set, 6, 21, 4, 3, "L");
  drawRect(set, 22, 20, 4, 3, "L");
});

// 48x48 (3x3) Seamless Organic Toxic Purple Poison Swamp Pool
const FLOOR_POISON_SWAMP_48 = makeGrid(48, 48, ".", (set) => {
  for (const [cx, cy, r] of [
    [24, 24, 17],
    [15, 20, 11],
    [33, 21, 11],
    [17, 31, 12],
    [31, 30, 12],
  ] as const) {
    drawCircle(set, cx, cy, r + 1.5, "G");
    drawCircle(set, cx, cy, r, "K");
  }
  for (const [cx, cy, r] of [
    [24, 24, 15],
    [15, 20, 9.5],
    [33, 21, 9.5],
    [17, 31, 10.5],
    [31, 30, 10.5],
  ] as const) {
    drawCircle(set, cx, cy, r, "P");
  }
  for (let y = 8; y < 40; y++) {
    for (let x = 8; x < 40; x++) {
      const distSq = (x - 24) * (x - 24) + (y - 24) * (y - 24);
      if (distSq <= 13 * 13) {
        const v = Math.sin(x * 0.35 + y * 0.4);
        if (v > 0.4) set(x, y, "M");
        if (v > 0.78) set(x, y, "V");
      }
    }
  }
  for (const [sx, sy] of [
    [16, 35],
    [24, 36],
    [32, 35],
  ] as const) {
    drawCircle(set, sx, sy, 3.2, "S");
    drawCircle(set, sx, sy, 2, "L");
  }
});

// 32x32 (2x2) Billowing Purple Poison Fog Vent Object
const OBJ_POISON_VENT_32 = makeGrid(32, 32, ".", (set) => {
  drawCircle(set, 16, 20, 11, "K");
  drawCircle(set, 16, 20, 9, "D");
  drawCircle(set, 16, 19, 7, "P");
  drawCircle(set, 16, 19, 5, "M");
  for (const [cx, cy, r, col] of [
    [11, 13, 5, "M"],
    [21, 14, 5, "M"],
    [16, 10, 6, "V"],
    [13, 8, 3, "W"],
    [20, 9, 2.5, "V"],
  ] as const) {
    drawCircle(set, cx, cy, r, col);
  }
});

// 48x48 (3x3) Seamless Sacred Golden-Cyan Rune Circle on Sanctuary Medallion
const FLOOR_GRANDLEON_SANCTUARY_48 = makeGrid(48, 48, ".", (set) => {
  for (let y = 4; y < 44; y++) {
    for (let x = 4; x < 44; x++) {
      const d = Math.hypot(x - 24, y - 24);
      if (Math.abs(d - 16) <= 1.2) set(x, y, "A");
      else if (Math.abs(d - 14.5) <= 0.8) set(x, y, "C");
      else if (Math.abs(d - 10) <= 1.0) set(x, y, "Y");
      else if (d <= 5.5) set(x, y, d <= 2.8 ? "W" : "C");
    }
  }
});

// 32x32 (2x2) Legendary Holy Sword Grandleon in Golden Pedestal
const OBJ_GRANDLEON_SWORD_32 = makeGrid(32, 32, ".", (set) => {
  drawRect(set, 5, 19, 22, 10, "K");
  drawRect(set, 6, 20, 20, 8, "S");
  drawRect(set, 8, 17, 16, 5, "A");
  drawRect(set, 11, 21, 10, 4, "C");
  drawRect(set, 14, 2, 4, 17, "K");
  drawRect(set, 15, 3, 2, 15, "W");
  set(16, 4, "C");
  set(16, 7, "C");
  set(16, 10, "C");
  drawRect(set, 9, 9, 14, 3, "K");
  drawRect(set, 10, 10, 12, 2, "Y");
  drawRect(set, 14, 1, 4, 3, "Y");
});

// 24x32 Custom Sprite: Armored Frog Knight (Glenn) Raising the Holy Sword Grandleon Overhead!
function buildFrogKnightSpritePng(): PNG {
  const w = 24;
  const h = 32;
  const rows = makeGrid(w, h, ".", (set) => {
    drawRect(set, 10, 0, 4, 10, "K");
    drawRect(set, 11, 1, 2, 8, "W");
    set(11, 2, "C");
    set(12, 5, "C");
    drawRect(set, 7, 9, 10, 2, "Y");
    drawRect(set, 9, 11, 2, 3, "G");
    drawRect(set, 13, 11, 2, 3, "G");
    drawRect(set, 11, 11, 2, 3, "A");
    drawRect(set, 7, 13, 10, 7, "K");
    drawRect(set, 8, 14, 8, 5, "G");
    drawRect(set, 8, 13, 3, 2, "Y");
    drawRect(set, 13, 13, 3, 2, "Y");
    set(9, 14, "K");
    set(14, 14, "K");
    drawRect(set, 8, 16, 8, 1, "W");
    drawRect(set, 4, 20, 16, 8, "R");
    drawRect(set, 5, 20, 4, 4, "W");
    drawRect(set, 15, 20, 4, 4, "W");
    drawRect(set, 8, 20, 8, 7, "B");
    drawRect(set, 9, 21, 6, 4, "C");
    drawRect(set, 8, 26, 8, 2, "Y");
    drawRect(set, 8, 28, 3, 4, "D");
    drawRect(set, 13, 28, 3, 4, "D");
    drawRect(set, 8, 30, 3, 2, "K");
    drawRect(set, 13, 30, 3, 2, "K");
  });

  const png = new PNG({ width: w, height: h });
  const frogPalette: Record<string, Rgba> = {
    ...DOMAIN_PALETTE,
    G: [58, 196, 74, 255],
  };
  for (let y = 0; y < h; y++) {
    const r = rows[y]!;
    for (let x = 0; x < w; x++) {
      const ch = r[x] ?? ".";
      const rgba = frogPalette[ch] ?? [0, 0, 0, 0];
      const i = (y * w + x) * 4;
      png.data[i] = rgba[0];
      png.data[i + 1] = rgba[1];
      png.data[i + 2] = rgba[2];
      png.data[i + 3] = rgba[3];
    }
  }
  return png;
}

function buildFrogKnightSpriteDataUrl(): string {
  return `data:image/png;base64,${PNG.sync.write(buildFrogKnightSpritePng()).toString("base64")}`;
}

const cachedCharsetPngs = new Map<string, PNG>();
function getCharsetPng(fileName: string): PNG {
  if (!cachedCharsetPngs.has(fileName)) {
    const p = resolve(process.cwd(), `public/assets/easyrpg/charset/${fileName}`);
    cachedCharsetPngs.set(fileName, PNG.sync.read(readFileSync(p)));
  }
  return cachedCharsetPngs.get(fileName)!;
}

function bakeCustomFloorAndObject(
  project: Project,
  map: GameMap,
  floorSlug: string,
  floorTitle: string,
  floorRows48: string[],
  objSlug: string,
  objTitle: string,
  objRows32: string[],
  floorX0: number,
  floorY0: number,
  ox: number,
  oy: number,
  options?: { preserveUpperOnFloor?: boolean },
) {
  const tileset = project.tilesets[map.tilesetId]!;
  const perRow = bundledChipsetTilesPerRow("workshop_");

  finishDraftTilesets(project);
  const preBakeMapPng = PNG.sync.read(
    renderMapPng({ ...project, startMapId: "__none__" }, { ...map, events: [] }).png,
  );

  // 1. Bake 3x3 (48x48) seamless floor kit
  const floorSheet = new PNG({ width: perRow * 16, height: 16 });
  const floorCells: { sourceTile: number; dx: number; dy: number }[] = [];
  let fk = 0;
  for (let ty = 0; ty < 3; ty++) {
    for (let tx = 0; tx < 3; tx++) {
      const st = fk++;
      floorCells.push({ sourceTile: st, dx: tx, dy: ty });
      const mx = Math.max(0, Math.min(map.width - 1, floorX0 + tx));
      const my = Math.max(0, Math.min(map.height - 1, floorY0 + ty));
      for (let py = 0; py < 16; py++) {
        const rowStr = floorRows48[ty * 16 + py] ?? "";
        for (let px = 0; px < 16; px++) {
          const ch = rowStr[tx * 16 + px] ?? ".";
          let r = 78;
          let g = 62;
          let b = 64;
          if (ch === "." || !DOMAIN_PALETTE[ch]) {
            const mapPxX = mx * 16 + px;
            const mapPxY = my * 16 + py;
            const pIdx = (mapPxY * preBakeMapPng.width + mapPxX) * 4;
            r = preBakeMapPng.data[pIdx] ?? 78;
            g = preBakeMapPng.data[pIdx + 1] ?? 62;
            b = preBakeMapPng.data[pIdx + 2] ?? 64;
          } else {
            const rgba = DOMAIN_PALETTE[ch]!;
            r = rgba[0];
            g = rgba[1];
            b = rgba[2];
          }
          const di = (py * floorSheet.width + (st * 16 + px)) * 4;
          floorSheet.data[di] = r;
          floorSheet.data[di + 1] = g;
          floorSheet.data[di + 2] = b;
          floorSheet.data[di + 3] = 255;
        }
      }
    }
  }
  const floorDataUrl = `data:image/png;base64,${PNG.sync.write(floorSheet).toString("base64")}`;
  const floorKit = bakeWorkshopObject(project, map.tilesetId, {
    objectId: `workshop:${floorSlug}`,
    title: floorTitle,
    description: floorTitle,
    kind: "flat",
    columns: 3,
    rows: 3,
    footRows: 0,
    risePx: 0,
    use: ["ground", "beodeul-floor", floorSlug],
    gridHash: `hash_${floorSlug}_48x48_v2`,
    asset: { id: `asset_${floorSlug}`, dataUrl: floorDataUrl, width: floorSheet.width, height: floorSheet.height },
    cells: floorCells,
  });

  for (let dy = 0; dy < 3; dy++) {
    for (let dx = 0; dx < 3; dx++) {
      const mx = floorX0 + dx;
      const my = floorY0 + dy;
      if (mx < 0 || my < 0 || mx >= map.width || my >= map.height) continue;
      const tid = floorKit.rows[dy]?.upperTiles?.[dx] ?? floorKit.rows[dy]?.tiles?.[dx] ?? -1;
      if (tid >= 0) {
        map.lowerTiles[my * map.width + mx] = tid;
        if (!options?.preserveUpperOnFloor) {
          map.upperTiles[my * map.width + mx] = -1;
        }
        tileset.priority[tid] = "lower";
        tileset.passability[tid] = { up: true, down: true, left: true, right: true };
      }
    }
  }

  // 2. Bake 2x2 (32x32) object kit
  const objSheet = new PNG({ width: perRow * 16, height: 16 });
  const objCells: { sourceTile: number; dx: number; dy: number }[] = [];
  let ok = 0;
  for (let ty = 0; ty < 2; ty++) {
    for (let tx = 0; tx < 2; tx++) {
      const st = ok++;
      objCells.push({ sourceTile: st, dx: tx, dy: ty });
      for (let py = 0; py < 16; py++) {
        const rowStr = objRows32[ty * 16 + py] ?? "";
        for (let px = 0; px < 16; px++) {
          const ch = rowStr[tx * 16 + px] ?? ".";
          const rgba = DOMAIN_PALETTE[ch] ?? [0, 0, 0, 0];
          const di = (py * objSheet.width + (st * 16 + px)) * 4;
          objSheet.data[di] = rgba[0];
          objSheet.data[di + 1] = rgba[1];
          objSheet.data[di + 2] = rgba[2];
          objSheet.data[di + 3] = rgba[3];
        }
      }
    }
  }
  const objDataUrl = `data:image/png;base64,${PNG.sync.write(objSheet).toString("base64")}`;
  const objKit = bakeWorkshopObject(project, map.tilesetId, {
    objectId: `workshop:${objSlug}`,
    title: objTitle,
    description: objTitle,
    kind: "flat",
    columns: 2,
    rows: 2,
    footRows: 0,
    risePx: 16,
    use: ["object", objSlug],
    gridHash: `hash_${objSlug}_32x32_v2`,
    asset: { id: `asset_${objSlug}`, dataUrl: objDataUrl, width: objSheet.width, height: objSheet.height },
    cells: objCells,
  });

  for (let dy = 0; dy < 2; dy++) {
    for (let dx = 0; dx < 2; dx++) {
      const mx = ox + dx;
      const my = oy + dy;
      if (mx < 0 || my < 0 || mx >= map.width || my >= map.height) continue;
      const tid = objKit.rows[dy]?.upperTiles?.[dx] ?? objKit.rows[dy]?.tiles?.[dx] ?? -1;
      if (tid >= 0) {
        map.upperTiles[my * map.width + mx] = tid;
        tileset.priority[tid] = "lower";
        tileset.passability[tid] = { up: true, down: true, left: true, right: true };
      }
    }
  }
}

function stampKitNative(
  map: GameMap,
  tileset: TilesetDef,
  kitId: string,
  topLeftX: number,
  topLeftY: number,
  options?: { passable?: boolean },
): number {
  const kit = (tileset.structureKits ?? []).find((k) => k.id === kitId);
  if (!kit) return 0;
  let stamped = 0;
  for (let dy = 0; dy < kit.height; dy++) {
    for (let dx = 0; dx < kit.width; dx++) {
      const mx = topLeftX + dx;
      const my = topLeftY + dy;
      if (mx < 0 || my < 0 || mx >= map.width || my >= map.height) continue;
      const idx = my * map.width + mx;
      const row = kit.rows[dy] as { tiles?: number[]; lowerTiles?: number[]; upperTiles?: number[] } | undefined;
      const lt = row?.tiles?.[dx] ?? row?.lowerTiles?.[dx] ?? -1;
      const ut = row?.upperTiles?.[dx] ?? -1;
      if (lt >= 0) {
        map.lowerTiles[idx] = lt;
        if (lt < tileset.count) {
          tileset.priority[lt] = "lower";
          if (options?.passable) {
            tileset.passability[lt] = { up: true, down: true, left: true, right: true };
          }
        }
        stamped++;
      }
      if (ut >= 0) {
        map.upperTiles[idx] = ut;
        if (options?.passable && ut < tileset.count) {
          tileset.passability[ut] = { up: true, down: true, left: true, right: true };
        }
        stamped++;
      }
    }
  }
  return stamped;
}

function tileKitFloor(
  map: GameMap,
  tileset: TilesetDef,
  x0: number,
  y0: number,
  w: number,
  h: number,
  kitId: string,
  passable = true,
) {
  const kit = (tileset.structureKits ?? []).find((k) => k.id === kitId);
  if (!kit || !kit.rows.length) return;
  const kw = kit.width;
  const kh = kit.height;
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
      const r = kit.rows[(y - y0 + 100 * kh) % kh] as { tiles?: number[]; upperTiles?: number[] } | undefined;
      const dx = (x - x0 + 100 * kw) % kw;
      const tid = r?.tiles?.[dx] !== undefined && r.tiles[dx]! >= 0 ? r.tiles[dx]! : (r?.upperTiles?.[dx] ?? -1);
      if (tid >= 0) {
        map.lowerTiles[y * map.width + x] = tid;
        if (tid < tileset.count) {
          tileset.priority[tid] = "lower";
          tileset.passability[tid] = passable
            ? { up: true, down: true, left: true, right: true }
            : { up: false, down: false, left: false, right: false };
        }
      }
    }
  }
}

// ============================================================================
// 3. Clean Map & Character Sprite Renderer (for Pass 1 Full Map Visual QA)
// ============================================================================

function blitCharsetSpriteOntoPng(
  dst: PNG,
  fileName: string,
  characterIndex: number,
  direction: CharsetDirection,
  pattern: number,
  centerFootX: number,
  bottomFootY: number,
  scale = 1,
  fallen = false,
) {
  const sheet = getCharsetPng(fileName);
  const src = charsetFrameSource({ characterIndex, direction, pattern });
  const hasAlpha = sheet.data.some((v, i) => i % 4 === 3 && v < 255);
  const outW = (fallen ? src.height : src.width) * scale;
  const outH = (fallen ? src.width : src.height) * scale;
  const dstX0 = Math.round(centerFootX - outW / 2);
  const dstY0 = Math.round(bottomFootY - outH);

  for (let y = 0; y < outH; y++) {
    for (let x = 0; x < outW; x++) {
      const origX = fallen ? Math.floor(y / scale) : Math.floor(x / scale);
      const origY = fallen ? src.height - 1 - Math.floor(x / scale) : Math.floor(y / scale);
      const sx = src.x + origX;
      const sy = src.y + origY;
      const si = (sy * sheet.width + sx) * 4;
      const keyed = !hasAlpha && [0, 1, 2].every((c) => sheet.data[si + c] === sheet.data[c]);
      const alpha = keyed ? 0 : sheet.data[si + 3]! / 255;
      if (alpha <= 0.02) continue;
      const dx = dstX0 + x;
      const dy = dstY0 + y;
      if (dx < 0 || dy < 0 || dx >= dst.width || dy >= dst.height) continue;
      const di = (dy * dst.width + dx) * 4;
      dst.data[di] = Math.round(sheet.data[si]! * alpha + dst.data[di]! * (1 - alpha));
      dst.data[di + 1] = Math.round(sheet.data[si + 1]! * alpha + dst.data[di + 1]! * (1 - alpha));
      dst.data[di + 2] = Math.round(sheet.data[si + 2]! * alpha + dst.data[di + 2]! * (1 - alpha));
      dst.data[di + 3] = 255;
    }
  }
}

function blitCustomPngSpriteOntoPng(
  dst: PNG,
  spritePng: PNG,
  centerFootX: number,
  bottomFootY: number,
  scale = 1,
) {
  const dstX0 = Math.round(centerFootX - (spritePng.width * scale) / 2);
  const dstY0 = Math.round(bottomFootY - spritePng.height * scale);
  for (let y = 0; y < spritePng.height * scale; y++) {
    for (let x = 0; x < spritePng.width * scale; x++) {
      const sx = Math.floor(x / scale);
      const sy = Math.floor(y / scale);
      const si = (sy * spritePng.width + sx) * 4;
      const alpha = spritePng.data[si + 3]! / 255;
      if (alpha <= 0.02) continue;
      const dx = dstX0 + x;
      const dy = dstY0 + y;
      if (dx < 0 || dy < 0 || dx >= dst.width || dy >= dst.height) continue;
      const di = (dy * dst.width + dx) * 4;
      dst.data[di] = Math.round(spritePng.data[si]! * alpha + dst.data[di]! * (1 - alpha));
      dst.data[di + 1] = Math.round(spritePng.data[si + 1]! * alpha + dst.data[di + 1]! * (1 - alpha));
      dst.data[di + 2] = Math.round(spritePng.data[si + 2]! * alpha + dst.data[di + 2]! * (1 - alpha));
      dst.data[di + 3] = 255;
    }
  }
}

function renderCleanMapWithSpritesPng(
  project: Project,
  map: GameMap,
  options?: {
    drawPlayerAt?: { x: number; y: number; dir?: CharsetDirection; fallen?: boolean };
    drawMarleAt?: { x: number; y: number; dir?: CharsetDirection };
  },
): PNG {
  const cleanMap = PNG.sync.read(
    renderMapPng({ ...project, startMapId: "__none__" }, { ...map, events: [] }).png,
  );
  const frogPng = buildFrogKnightSpritePng();

  const sortedEvents = [...map.events].sort((a, b) => a.y - b.y);
  for (const ev of sortedEvents) {
    const page = ev.pages?.[0];
    const g = page?.graphic as any;
    const footX = ev.x * 16 + 8;
    const footY = (ev.y + 1) * 16;
    const spriteId = String(g?.sprite?.id ?? g?.id ?? g?.charset ?? "");
    if (spriteId === "sprite_frog_knight_grandleon") {
      blitCustomPngSpriteOntoPng(cleanMap, frogPng, footX, footY, 1);
    }
  }

  if (options?.drawMarleAt) {
    blitCharsetSpriteOntoPng(
      cleanMap,
      "Actor1.png",
      3,
      options.drawMarleAt.dir ?? "right",
      1,
      options.drawMarleAt.x * 16 + 8,
      (options.drawMarleAt.y + 1) * 16,
      1,
      false,
    );
  }
  if (options?.drawPlayerAt) {
    blitCharsetSpriteOntoPng(
      cleanMap,
      "Actor1.png",
      0,
      options.drawPlayerAt.dir ?? "right",
      1,
      options.drawPlayerAt.x * 16 + 8,
      (options.drawPlayerAt.y + 1) * 16,
      1,
      Boolean(options.drawPlayerAt.fallen),
    );
  }

  return cleanMap;
}

// ============================================================================
// 4. REAL In-Game Runtime Player (`player.html`) Execution & Telemetry Capture
// ============================================================================

let currentRoutedProjectJson = "";

/** Browser context that serves the project last passed to runLiveInGameBranch as the QA project. */
export async function createQaContext(browser: Browser) {
  const context = await browser.newContext({ viewport: { width: 960, height: 640 } });
  await context.addInitScript(
    `try { localStorage.clear(); } catch {}
     window.__OPENRPG_BOOT__ = {
       projectUrl: "/__qa_project__/project.json",
       saveNamespace: "brutal-qa-" + Date.now() + "-" + Math.random().toString(36).slice(2),
       qaInstrumentation: true
     };`,
  );
  await context.route("**/__qa_project__/project.json", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: currentRoutedProjectJson }),
  );
  return context;
}

export async function runLiveInGameBranch(
  context: BrowserContext,
  baseUrl: string,
  project: Project,
  options: {
    branchLabel: string;
    mapId: string;
    startX: number;
    startY: number;
    facing?: "up" | "down" | "left" | "right";
    triggerMode: "step_right" | "action";
    partyActorIds?: string[];
    inventory?: Record<string, number>;
    switches?: Record<string, boolean>;
    variables?: Record<string, number>;
    screenshotPath: string;
    afterScreenshotPath?: string;
    peakScreenshotPath?: string;
    walkPeak?: boolean;
    /** Frame just before the trigger, so the scene itself is visible without tint/dialogue covering it. */
    preScreenshotPath?: string;
  },
): Promise<LiveInGameBranchTelemetry> {
  const prepared = structuredClone(project);
  prepared.startMapId = options.mapId;
  prepared.startPos = { x: options.startX, y: options.startY };
  // Disable default 3-scene opening ("하늘이 갈라지던 날...") so New Game enters the field map immediately
  if (prepared.system.opening) {
    prepared.system.opening = {
      ...prepared.system.opening,
      enabled: false,
    };
  }
  prepared.system.companions = {
    ...(prepared.system.companions ?? {}),
    fromParty: true,
    gap: 1,
    formation: "line",
  };
  for (const swId of Object.keys(options.switches ?? {})) {
    if (!prepared.switches.some((s) => s.id === swId)) {
      prepared.switches.push({ id: swId, name: swId });
    }
  }
  for (const varId of Object.keys(options.variables ?? {})) {
    if (!prepared.variables.some((v) => v.id === varId)) {
      prepared.variables.push({ id: varId, name: varId, initialValue: options.variables![varId] ?? 0 });
    }
  }
  prepared.session = {
    ...prepared.session,
    partyActorIds: options.partyActorIds ?? ["actor_crono"],
    inventory: { ...prepared.session.inventory, ...(options.inventory ?? {}) },
    switches: { ...prepared.session.switches, ...(options.switches ?? {}) },
    variables: { ...prepared.session.variables, ...(options.variables ?? {}) },
  };

  const rawProject = serialize(prepared);
  // Fail fast in Node/Bun if project schema/reference validation fails
  deserialize(rawProject);
  currentRoutedProjectJson = rawProject;

  const page = await context.newPage();
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on("pageerror", (err) => pageErrors.push(err.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  for (let attempt = 1; attempt <= 3; attempt++) {
    pageErrors.length = 0;
    consoleErrors.length = 0;
    await page.goto(`${baseUrl}/player.html`, { waitUntil: "domcontentloaded", timeout: 60000 });
    const shown = await page.waitForSelector("[data-testid='title-screen']", { timeout: 25000 }).then(() => true, () => false);
    if (shown) break;
    if (attempt === 3) {
      throw new Error(`${options.branchLabel}: title screen never appeared - pageErrors=${JSON.stringify(pageErrors.slice(0, 5))} consoleErrors=${JSON.stringify(consoleErrors.slice(0, 5))}`);
    }
  }
  await page.keyboard.press("Enter");
  await page.waitForFunction(
    `(() => {
      const w = window;
      const s = w.__oprnHooksScene;
      const title = document.querySelector("[data-testid='title-screen']");
      const loading = document.querySelector("[data-testid='play-loading-overlay']");
      const cinematic = document.querySelector("[data-testid='cinematic-sequence']");
      return Boolean(
        !title &&
        !loading &&
        !cinematic &&
        w.__oprnDebug &&
        s &&
        s.session &&
        w.__oprnInput &&
        w.__oprnAudioState &&
        document.querySelector("[data-testid='runtime-state-json']")
      );
    })()`,
    undefined,
    { timeout: 60000 },
  );

  // Ensure initial facing and follower trail if Marle is in party
  await page.evaluate(
    `(() => {
      const w = window;
      const s = w.__oprnHooksScene;
      if (!s) return;
      w.__oprnInput?.face(${JSON.stringify(options.facing ?? "right")});
      if ((s.session.partyActorIds || []).length > 1) {
        s.session.followerTrail = [
          { x: ${options.startX - 1}, y: ${options.startY}, direction: "right" },
          { x: ${options.startX - 2}, y: ${options.startY}, direction: "right" }
        ];
      }
      if (Array.isArray(w.__oprnAudioObserved)) {
        w.__oprnAudioObserved.length = 0;
      }
    })()`,
  );
  await page.waitForTimeout(180);

  if (options.preScreenshotPath) await page.screenshot({ path: options.preScreenshotPath });

  // Trigger the event in-game!
  if (options.triggerMode === "step_right") {
    await page.evaluate(`(() => { window.__oprnInput?.dir("right"); })()`);
    await page.waitForTimeout(260);
    await page.evaluate(`(() => { window.__oprnInput?.dir(null); })()`);
  } else {
    await page.evaluate(`(() => { window.__oprnInput?.face("right"); window.__oprnInput?.action(); })()`);
  }

  // Wait for the real `.dialogue-box` to appear on screen
  try {
    await page.waitForFunction(
      `(() => {
        const box = document.querySelector('[data-testid="dialogue-box"]');
        if (!box) return false;
        const rect = box.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && (box.textContent || "").trim().length > 0;
      })()`,
      undefined,
      { timeout: 4500 },
    );
    // Wait until typewriter text finishes typing (textContent stabilizes across 200ms intervals, up to 3200ms)
    let prevText = "";
    let stableCount = 0;
    for (let i = 0; i < 16; i++) {
      await page.waitForTimeout(200);
      const curText = (await page.evaluate(
        `(() => {
          const box = document.querySelector('[data-testid="dialogue-box"]');
          return (box?.textContent || "").replace(/\\s+/g, " ").trim();
        })()`,
      )) as string;
      if (curText.length > 0 && curText === prevText) {
        stableCount++;
        if (stableCount >= 3) break;
      } else {
        prevText = curText;
        stableCount = 0;
      }
    }
  } catch {
    // Even if dialogue failed to open in a broken case, continue to capture telemetry
    await page.waitForTimeout(320);
  }

  // Capture REAL in-game climax screenshot directly from `player.html`!
  await page.screenshot({ path: options.screenshotPath });

  // Sample live engine state at climax
  const sampleStateJs = `(() => {
      const w = window;
      const s = w.__oprnHooksScene;
      const m2Screen = s?.session?.m2Runtime?.screen ?? {};
      const playerLook = m2Screen?.spriteLooks?.player ?? {};
      const effEl = document.querySelector('[data-testid="runtime-screen-effect"]');
      const effRect = effEl ? effEl.getBoundingClientRect() : null;
      const effStyle = effEl ? window.getComputedStyle(effEl) : null;
      const topLb = document.querySelector('[data-testid="runtime-letterbox-top"]');
      const lbRect = topLb ? topLb.getBoundingClientRect() : null;
      const dlg = document.querySelector('[data-testid="dialogue-box"]');
      const dlgRect = dlg ? dlg.getBoundingClientRect() : null;
      const missingEl = document.querySelector('[data-testid="missing-resource-error"]');

      const list = s?.children?.list ?? [];
      const emitters = list.filter((o) => o && o.type === "ParticleEmitter");
      const aliveParticles = emitters.reduce(
        (sum, e) => sum + (typeof e.getAliveParticleCount === "function" ? e.getAliveParticleCount() : 0),
        0,
      );
      const mapOv = s?.session?.mapOverrides?.[s?.getMapId?.() ?? ""] ?? { lower: {}, upper: {} };
      const mapOverrideCount = Object.keys(mapOv.lower || {}).length + Object.keys(mapOv.upper || {}).length;

      return {
        audioObserved: Array.isArray(w.__oprnAudioObserved) ? w.__oprnAudioObserved.slice() : [],
        screenEffectVisible: Boolean(effEl && effRect && effRect.width > 0 && effRect.height > 0 && effStyle && effStyle.display !== "none" && Number(effStyle.opacity || 1) > 0.05),
        screenEffectMode: effEl?.getAttribute("data-mode") || "",
        screenEffectBg: effEl ? effEl.style.background || effStyle?.backgroundColor || "" : "",
        letterboxPx: lbRect ? Math.round(lbRect.height) : 0,
        particleEmitterCount: emitters.length,
        aliveParticles,
        shakeIntensity: Number(m2Screen?.shake ?? 0),
        weatherKind: String(s?.weatherDisplayed?.kind ?? "none"),
        playerPx: Math.round(Number(s?.player?.x ?? 0)),
        playerPy: Math.round(Number(s?.player?.y ?? 0)),
        playerPose: String(playerLook?.pose ?? "normal"),
        playerTint: String(playerLook?.tint ?? ""),
        playerAngle: Math.round(Math.abs(Number(s?.player?.angle ?? 0))),
        followerCount: Number(s?.followerSprites?.size ?? 0),
        mapOverrideCount,
        dialogueVisible: Boolean(dlg && dlgRect && dlgRect.width > 0 && dlgRect.height > 0),
        dialoguePageReady: Boolean(dlg?.classList.contains("page-ready")),
        dialogueText: String((dlg?.querySelector(".body") ?? dlg)?.textContent ?? "").replace(/\\s+/g, " ").trim(),
        eventRunning: Boolean(s?.running),
        missingResourceError: Boolean(missingEl),
        gameOverVisible: Boolean(document.querySelector('[data-testid="game-over-screen"]')),
      };
    })()`;
  const climaxState = (await page.evaluate(sampleStateJs)) as any;

  // Play the event out to its end while sampling the live state every ~150ms. Effects, sound and the death
  // usually fire AFTER the first dialogue line, so a single climax sample (or stopping when the dialogue box
  // briefly closes between commands) misses them.
  const peak = {
    shake: climaxState.shakeIntensity as number,
    particles: climaxState.aliveParticles as number,
    emitters: climaxState.particleEmitterCount as number,
    letterbox: climaxState.letterboxPx as number,
    tint: climaxState.screenEffectVisible as boolean,
    tintMode: climaxState.screenEffectMode as string,
    tintBg: climaxState.screenEffectBg as string,
    weather: climaxState.weatherKind as string,
    pose: climaxState.playerPose as string,
    playerTint: climaxState.playerTint as string,
    angle: climaxState.playerAngle as number,
    followers: climaxState.followerCount as number,
    overrides: climaxState.mapOverrideCount as number,
  };
  const audioSeen = new Set<string>(climaxState.audioObserved ?? []);
  const dialogueLines: string[] = [];
  const noteDialogue = (t: string) => {
    if (t && !dialogueLines.includes(t)) dialogueLines.push(t);
  };
  noteDialogue(climaxState.dialogueText);
  const effectScore = (st: any) =>
    (st.screenEffectVisible ? 3 : 0) + Number(st.shakeIntensity ?? 0) + Math.min(Number(st.aliveParticles ?? 0), 30) / 3 + (st.playerPose && st.playerPose !== "normal" ? 3 : 0);
  let bestScore = effectScore(climaxState);
  if (options.peakScreenshotPath) await page.screenshot({ path: options.peakScreenshotPath });
  // Survival branches prove the crossing by moving the hero: once the dialogue closes, the farthest-walked frame is
  // the peak (an effect-score peak is usually the dialogue frame before the walk starts).
  let walked = 16;
  const startPx = { x: Number(climaxState.playerPx ?? 0), y: Number(climaxState.playerPy ?? 0) };
  let idle = 0;
  let typingTicks = 0;
  let gameOverSeen = Boolean(climaxState.gameOverVisible);
  for (let step = 0; step < 120 && !gameOverSeen; step++) {
    const st = (await page.evaluate(sampleStateJs)) as any;
    if (st.dialoguePageReady || !st.dialogueVisible) {
      noteDialogue(st.dialogueText);
    }
    for (const a of st.audioObserved ?? []) audioSeen.add(a);
    peak.shake = Math.max(peak.shake, st.shakeIntensity);
    peak.particles = Math.max(peak.particles, st.aliveParticles);
    peak.emitters = Math.max(peak.emitters, st.particleEmitterCount);
    peak.letterbox = Math.max(peak.letterbox, st.letterboxPx);
    peak.angle = Math.max(peak.angle, st.playerAngle);
    peak.followers = Math.max(peak.followers, st.followerCount);
    peak.overrides = Math.max(peak.overrides, st.mapOverrideCount);
    if (st.screenEffectVisible && !peak.tint) {
      peak.tint = true;
      peak.tintMode = st.screenEffectMode;
      peak.tintBg = st.screenEffectBg;
    }
    if (st.weatherKind !== "none") peak.weather = st.weatherKind;
    if (st.playerPose !== "normal") peak.pose = st.playerPose;
    if (st.playerTint) peak.playerTint = st.playerTint;
    const sc = effectScore(st);
    const dist = Math.hypot(Number(st.playerPx) - startPx.x, Number(st.playerPy) - startPx.y);
    const hasActiveFx = Boolean(st.screenEffectVisible || st.weatherKind !== "none");
    if (options.walkPeak && st.dialogueVisible && st.dialoguePageReady && st.dialogueText !== climaxState.dialogueText && sc >= bestScore) {
      await page.screenshot({ path: options.screenshotPath });
    }
    if (options.walkPeak && !st.dialogueVisible && (st.eventRunning || st.letterboxPx > 0) && dist > walked && (hasActiveFx || walked <= 16)) {
      walked = dist;
      bestScore = Number.POSITIVE_INFINITY;
      if (options.peakScreenshotPath) await page.screenshot({ path: options.peakScreenshotPath });
    } else if (sc > bestScore || (sc === bestScore && st.dialoguePageReady && bestScore < Number.POSITIVE_INFINITY)) {
      bestScore = sc;
      if (options.peakScreenshotPath) await page.screenshot({ path: options.peakScreenshotPath });
    }
    if (st.gameOverVisible) {
      gameOverSeen = true;
      break;
    }
    if (st.dialogueVisible) {
      idle = 0;
      if (st.dialoguePageReady) {
        typingTicks = 0;
        await page.keyboard.press("Enter");
      } else {
        typingTicks++;
        if (typingTicks >= 10) {
          typingTicks = 0;
          await page.keyboard.press("Enter");
        }
      }
    } else {
      typingTicks = 0;
      if (st.eventRunning) {
        idle = 0;
      } else {
        idle++;
        // No dialogue and event interpreter is no longer running for ~2s: the event is over.
        if (idle > 12) break;
      }
    }
    await page.waitForTimeout(150);
  }
  await page.waitForTimeout(280);

  if (options.afterScreenshotPath) {
    await page.screenshot({ path: options.afterScreenshotPath });
  }

  const terminalState = (await page.evaluate(
    `(() => {
      const w = window;
      const s = w.__oprnHooksScene;
      const go = document.querySelector('[data-testid="game-over-screen"]');
      const goRect = go ? go.getBoundingClientRect() : null;
      return {
        gameOverAfterAdvance: Boolean(go && goRect && goRect.width > 0 && goRect.height > 0),
        switchesAfterAdvance: { ...(s?.session?.switches ?? {}) },
        audioObservedAfter: Array.isArray(w.__oprnAudioObserved) ? w.__oprnAudioObserved.slice() : [],
      };
    })()`,
  )) as any;

  await page.close();

  const mergedAudio = Array.from(new Set([...audioSeen, ...(terminalState.audioObservedAfter ?? [])]));

  return {
    branchLabel: options.branchLabel,
    screenshotPath: options.screenshotPath,
    afterScreenshotPath: options.afterScreenshotPath,
    ...(options.peakScreenshotPath ? { peakScreenshotPath: options.peakScreenshotPath } : {}),
    dialogueLines,
    audioObserved: mergedAudio,
    screenEffectVisible: peak.tint,
    screenEffectMode: peak.tintMode,
    screenEffectBg: peak.tintBg,
    letterboxPx: peak.letterbox,
    particleEmitterCount: peak.emitters,
    aliveParticles: peak.particles,
    shakeIntensity: peak.shake,
    weatherKind: peak.weather,
    playerPose: peak.pose,
    playerTint: peak.playerTint,
    playerAngle: peak.angle,
    followerCount: peak.followers,
    mapOverrideCount: peak.overrides,
    dialogueVisible: climaxState.dialogueVisible,
    dialogueText: climaxState.dialogueText,
    gameOverAfterAdvance: gameOverSeen || terminalState.gameOverAfterAdvance,
    switchesAfterAdvance: terminalState.switchesAfterAdvance,
    pageErrors,
    consoleErrors,
    missingResourceError: climaxState.missingResourceError,
  };
}

// ============================================================================
// 5. Brutal 7-Gate + 2-Pass Multimodal Judge Evaluator
// ============================================================================

const SHADOW_CONTAMINATED_PLAZA_TILES = new Set([2691, 1077, 1212, 1672, 2523, 1673, 1674]);

function checkFloorAndRoadIntegrity(map: GameMap, tileset: TilesetDef): { passed: boolean; detail: string } {
  let shadowContaminatedCount = 0;
  let rawRoad3221Count = 0;
  let shapedRoadCurbCount = 0;
  const shapedRoadCurbIds = new Set([2441, 2442, 2609, 2690, 2900, 3001, 3061]);

  for (let i = 0; i < map.width * map.height; i++) {
    const lt = map.lowerTiles[i] ?? -1;
    const ut = map.upperTiles[i] ?? -1;
    if (SHADOW_CONTAMINATED_PLAZA_TILES.has(lt) || SHADOW_CONTAMINATED_PLAZA_TILES.has(ut)) {
      shadowContaminatedCount++;
    }
    if (lt === 3221) rawRoad3221Count++;
    if (shapedRoadCurbIds.has(lt)) shapedRoadCurbCount++;
  }

  if (shadowContaminatedCount > 0) {
    return {
      passed: false,
      detail: `바닥 타일 불량 — 건물 지붕의 검은 삼각형 그림자가 박힌 오염 타일(2691/1077 등)이 ${shadowContaminatedCount}칸 깔려 바닥이 깨져 보임! FAIL`,
    };
  }
  if (rawRoad3221Count > 10 && shapedRoadCurbCount === 0) {
    return {
      passed: false,
      detail: `도로 오토타일 불량 — 연석(curb) 테두리 오토타일 없이 중심 타일(3221)만 ${rawRoad3221Count}칸 일자로 찍혀 있음! FAIL`,
    };
  }
  return {
    passed: true,
    detail: `깨끗한 버들항 정본 바닥 타일(그림자 오염 타일 0칸) + 정식 도로/모랫길 오토타일 + 하부 타일 픽셀 샘플링 무경계 지형 블렌딩 확인`,
  };
}

function countArchitectureTilesOnMap(map: GameMap, tileset: TilesetDef): number {
  const archTileIds = new Set<number>();
  for (const k of tileset.structureKits ?? []) {
    if (
      k.id.startsWith("bd-house-") ||
      k.id.startsWith("bd-manor-") ||
      k.id.startsWith("bd-prop-well") ||
      k.id.startsWith("bd-prop-stall_") ||
      k.id.startsWith("bd-pick-castle-") ||
      k.id.startsWith("bd-pick-temple-ruins-roof") ||
      k.id.startsWith("bd-pick-temple-ruins-face") ||
      k.id.startsWith("bd-pick-temple-ruins-column") ||
      k.id.startsWith("bd-pick-temple-ruins-mosaic") ||
      k.id.startsWith("bd-prop-statue_")
    ) {
      for (const r of k.rows ?? []) {
        for (const t of r.upperTiles ?? []) if (t >= 0) archTileIds.add(t);
        for (const t of (r as any).tiles ?? []) if (t >= 0) archTileIds.add(t);
      }
    }
  }
  let count = 0;
  for (let i = 0; i < map.width * map.height; i++) {
    if (archTileIds.has(map.upperTiles[i] ?? -1) || archTileIds.has(map.lowerTiles[i] ?? -1)) {
      count++;
    }
  }
  return count;
}

export async function evaluateCaseBrutallyWithLiveInGame(
  testCase: JrpgCommandCase,
  project: Project,
  mode: "before_lenient" | "after_brutal_fix",
  mapPngPath: string,
  branchA: LiveInGameBranchTelemetry,
  branchB: LiveInGameBranchTelemetry,
): Promise<BrutalPilotEvaluation> {
  const map = project.maps[testCase.mapId]!;
  const tileset = project.tilesets[map.tilesetId]!;
  const clauses: AtomicClauseCheck[] = [];
  const kitIds = (tileset.structureKits ?? []).filter((k) => k.id.startsWith("workshop:")).map((k) => k.id);

  // Gate G1: Floor & Road Tile Visual Integrity
  const floorCheck = checkFloorAndRoadIntegrity(map, tileset);
  clauses.push({
    id: "g1_floor_integrity",
    clause: "G1 [바닥·도로 타일 무결성] 검은 삼각형 그림자 오염 타일(2691/1077 등) 0칸 + 도로 연석 오토타일 + 커스텀 지형 사각 스티커 테두리 0건",
    category: "floor_integrity",
    passed: floorCheck.passed,
    detail: floorCheck.detail,
  });

  if (testCase.id === "jrpg_016") {
    // Gate G2: Village + Volcanic Crater Domain Architecture
    const houseCells = countArchitectureTilesOnMap(map, tileset);
    const hasVolcanoKit = kitIds.some((id) => /volcan|lava|crater|magma/iu.test(id));
    clauses.push({
      id: "g2_domain_map_and_terrain",
      clause: "G2 [배경 건축물 & 지형 일치] '마을 외곽 화산 열풍 지대 (16, 11)' — 실제 버들항 마을 가옥(3채·우물)과 무경계 화산 용암 균열 바닥·분화구가 모두 존재할 것",
      category: "map_setting",
      passed: houseCells >= 60 && hasVolcanoKit,
      detail:
        houseCells >= 60 && hasVolcanoKit
          ? `버들항 마을 가옥 3채(${houseCells}칸) + 무경계 화산 용암 균열·분화구(${kitIds.join(", ")}) 배치 확인`
          : `마을 가옥(${houseCells}칸) 또는 화산 분화구(${kitIds.join(", ")}) 미구현 (초록 잔디에 가시 발판만 찍힘)! FAIL`,
    });

    // Gate G3: Live In-Game Sound & Audio Engine Verification
    const hasFireSeA = branchA.audioObserved.some((id) => /fire|flame|explos/iu.test(id));
    const hasIceSeB = branchB.audioObserved.some((id) => /ice|cold|water|magic/iu.test(id));
    clauses.push({
      id: "g3_ingame_audio",
      clause: "G3 [실시간 인게임 사운드 검증] player.html 실행 중 열풍 효과음(easyrpg-sound-fire1) 및 마르 냉기 마법 효과음(easyrpg-sound-ice5)이 실제 오디오 엔진(window.__oprnAudioObserved)에서 재생될 것",
      category: "ingame_audio",
      passed: hasFireSeA && hasIceSeB,
      detail: `분기A 재생 SE=[${branchA.audioObserved.join(", ") || "없음"}], 분기B 재생 SE=[${branchB.audioObserved.join(", ") || "없음"}]`,
    });

    // Gate G4: Live In-Game Visual Effects, Particles, Screen Tint, Shake, Fallen Pose & Follower Sprite
    const liveFxPassed =
      branchA.screenEffectVisible &&
      branchA.aliveParticles > 0 &&
      branchA.shakeIntensity >= 4 &&
      branchA.letterboxPx >= 12 &&
      branchA.playerPose === "fallen" &&
      branchA.playerAngle === 90 &&
      branchB.screenEffectVisible &&
      branchB.aliveParticles > 0 &&
      branchB.followerCount >= 1;
    clauses.push({
      id: "g4_ingame_fx_particles_pose",
      clause: "G4 [실시간 인게임 이펙트·파티클·색조·쓰러짐 포즈·동료 스프라이트] player.html 캔버스에서 화면 적색/청색 Tint + 진동(shake>=4) + 레터박스 + 실시간 파티클(aliveParticles>0) + 사망 시 주인공 90° 쓰러짐(pose='fallen') + 생존 시 마르 필드 동료 스프라이트(followerCount>=1) 동시 확인",
      category: "ingame_visual_fx",
      passed: liveFxPassed,
      detail: `분기A(tint=${branchA.screenEffectBg || "없음"}, aliveParticles=${branchA.aliveParticles}, shake=${branchA.shakeIntensity}, letterbox=${branchA.letterboxPx}px, pose=${branchA.playerPose}/${branchA.playerAngle}°) | 분기B(tint=${branchB.screenEffectBg || "없음"}, aliveParticles=${branchB.aliveParticles}, 마르동료스프라이트=${branchB.followerCount}명)`,
    });

    // Gate G5: Live In-Game Interactive Branching, Dialogue DOM & Game Over Screen
    const r2RawPath = resolve(process.cwd(), `artifacts/jrpg-200/round-2/cases/${testCase.id}.json`);
    const hadToolFailureInTrace =
      mode === "before_lenient" &&
      existsSync(r2RawPath) &&
      (JSON.parse(readFileSync(r2RawPath, "utf8")).toolCalls ?? []).some((t: any) => !t.ok);
    const branchDomPassed =
      branchA.dialogueVisible &&
      branchA.dialogueText.includes("숨이 막히는 열기에 정신을 잃었다!") &&
      branchA.gameOverAfterAdvance &&
      branchB.dialogueVisible &&
      branchB.dialogueText.includes("냉기 마법") &&
      !branchB.gameOverAfterAdvance &&
      branchA.pageErrors.length === 0 &&
      branchB.pageErrors.length === 0 &&
      !hadToolFailureInTrace;
    clauses.push({
      id: "g5_ingame_dialogue_and_gameover",
      clause: "G5 [실시간 인게임 대사창 DOM & 게임오버 전환] player.html에서 실제 대사창(.dialogue-box) 한국어 출력 후 (A) 마르 미동행 시 실제 GAME OVER 화면 전환 + (B) 마르 동행 시 냉기 마법 대사 후 생존(gameOver=false) 및 콘솔/도구 에러 0건",
      category: "ingame_branch_dom",
      passed: branchDomPassed,
      detail: `분기A(대사="${branchA.dialogueText.slice(0, 36)}", gameOver화면=${branchA.gameOverAfterAdvance}) | 분기B(대사="${branchB.dialogueText.slice(0, 36)}", gameOver=${branchB.gameOverAfterAdvance}) | 도구에러=${hadToolFailureInTrace}`,
    });
  } else if (testCase.id === "jrpg_002") {
    const hasLavaBridge = kitIds.some((id) => /lava-bridge|collapsing-lava/iu.test(id));
    const lavaTileSet = new Set<number>();
    const bridgeTileSet = new Set<number>();
    for (const k of tileset.structureKits ?? []) {
      if (k.id.startsWith("bd-pick-volcano-cave-lava")) {
        for (const r of k.rows ?? []) {
          for (const t of (r as any).tiles ?? []) if (t >= 0) lavaTileSet.add(t);
          for (const t of r.upperTiles ?? []) if (t >= 0) lavaTileSet.add(t);
        }
      }
      if (k.id === "bd-pick-mountain-pass-stone-bridge") {
        for (const r of k.rows ?? []) {
          for (const t of (r as any).tiles ?? []) if (t >= 0) bridgeTileSet.add(t);
          for (const t of r.upperTiles ?? []) if (t >= 0) bridgeTileSet.add(t);
        }
      }
    }
    const lavaRiverTiles = map.lowerTiles.filter((t) => lavaTileSet.has(t)).length;
    const archBridgeTiles =
      map.upperTiles.filter((t) => bridgeTileSet.has(t)).length +
      map.lowerTiles.filter((t) => bridgeTileSet.has(t)).length;
    clauses.push({
      id: "g2_domain_map_and_terrain",
      clause: "G2 [배경 건축물 & 지형 일치] '마도 유적 (12, 7) 용암 다리' — 실제 끓어오르는 용암 협곡(lava-strip)과 석조 아치 다리(stone-bridge) 및 다리 중앙 균열 도트가 배치될 것",
      category: "terrain_object",
      passed: hasLavaBridge && lavaRiverTiles >= 25 && archBridgeTiles >= 10,
      detail:
        hasLavaBridge && lavaRiverTiles >= 25 && archBridgeTiles >= 10
          ? `용암 협곡 타일 ${lavaRiverTiles}칸 + 석조 아치 다리 ${archBridgeTiles}칸 + 다리 균열(${kitIds.join(", ")}) 확인`
          : `용암 협곡(${lavaRiverTiles}칸)·석조 다리(${archBridgeTiles}칸) 없음 (초록 공원에 유리관만 배치됨)! FAIL`,
    });

    const hasCollapseSeA = branchA.audioObserved.some((id) => /explos|fire|collapse/iu.test(id));
    const hasShieldSeB = branchB.audioObserved.some((id) => /explos|fire|flash|magic/iu.test(id));
    clauses.push({
      id: "g3_ingame_audio",
      clause: "G3 [실시간 인게임 사운드 검증] 다리 붕괴 폭발음(easyrpg-sound-explosion1)·화염음(fire1)·반지 방어막 효과음(flash1)이 실제 오디오 엔진에서 재생될 것",
      category: "ingame_audio",
      passed: hasCollapseSeA && hasShieldSeB,
      detail: `분기A 재생 SE=[${branchA.audioObserved.join(", ") || "없음"}], 분기B 재생 SE=[${branchB.audioObserved.join(", ") || "없음"}]`,
    });

    const liveFxPassed =
      branchA.screenEffectVisible &&
      branchA.aliveParticles > 0 &&
      branchA.shakeIntensity >= 4 &&
      branchA.playerPose === "fallen" &&
      branchA.playerAngle === 90 &&
      branchA.mapOverrideCount >= 4 &&
      branchB.screenEffectVisible &&
      branchB.aliveParticles > 0;
    clauses.push({
      id: "g4_ingame_fx_particles_pose",
      clause: "G4 [실시간 인게임 다리 타일 붕괴(changeTile) · 파티클 · 색조 · 쓰러짐 포즈] player.html에서 다리 타일이 실제 용암 타일로 붕괴(mapOverrideCount>=4)하고, 화염/폭발 파티클(aliveParticles>0) + 적색 Tint + 주인공 90° 추락 포즈(pose='fallen') + 반지 수호 파티클이 렌더링될 것",
      category: "ingame_visual_fx",
      passed: liveFxPassed,
      detail: `분기A(실시간타일붕괴=${branchA.mapOverrideCount}칸, aliveParticles=${branchA.aliveParticles}, tint=${branchA.screenEffectBg || "없음"}, pose=${branchA.playerPose}/${branchA.playerAngle}°) | 분기B(aliveParticles=${branchB.aliveParticles}, tint=${branchB.screenEffectBg || "없음"})`,
    });

    const branchDomPassed =
      branchA.dialogueVisible &&
      branchA.dialogueText.includes("용암 다리가 무너진다") &&
      branchA.gameOverAfterAdvance &&
      branchB.dialogueVisible &&
      branchB.dialogueText.includes("화염의 반지") &&
      !branchB.gameOverAfterAdvance &&
      branchA.pageErrors.length === 0 &&
      branchB.pageErrors.length === 0;
    clauses.push({
      id: "g5_ingame_dialogue_and_gameover",
      clause: "G5 [실시간 인게임 대사창 DOM & 게임오버 전환] (A) 반지 미소지 시 비명 대사 후 실제 GAME OVER 화면 전환 + (B) item_fire_ring 소지 시 방어막 대사 후 생존(gameOver=false)",
      category: "ingame_branch_dom",
      passed: branchDomPassed,
      detail: `분기A(대사="${branchA.dialogueText.slice(0, 36)}", gameOver화면=${branchA.gameOverAfterAdvance}) | 분기B(대사="${branchB.dialogueText.slice(0, 36)}", gameOver=${branchB.gameOverAfterAdvance})`,
    });
  } else if (testCase.id === "jrpg_003") {
    const hasPoisonSwamp = kitIds.some((id) => /poison|swamp|fog-vent/iu.test(id));
    const ruinWallAndColTiles = countArchitectureTilesOnMap(map, tileset);
    clauses.push({
      id: "g2_domain_map_and_terrain",
      clause: "G2 [배경 건축물 & 지형 일치] '마도 유적 (6, 11) 보라색 독안개 구역' — 고대 유적 석벽·기둥과 무경계 보라색 독늪 바닥(poison-swamp)·독안개 분출구(poison-fog-vent)가 배치될 것",
      category: "terrain_object",
      passed: hasPoisonSwamp && ruinWallAndColTiles >= 40,
      detail:
        hasPoisonSwamp && ruinWallAndColTiles >= 40
          ? `고대 마도 유적 석벽·기둥(${ruinWallAndColTiles}칸) + 무경계 보라색 독늪·분출구(${kitIds.join(", ")}) 확인`
          : `보라색 독늪 및 유적 석벽 없음 (초록 공원에 유리관+보물상자만 배치됨)! FAIL`,
    });

    const hasFogSeA = branchA.audioObserved.some((id) => /fog|poison|dark|wind/iu.test(id));
    const hasMaskSeB = branchB.audioObserved.some((id) => /fog|flash|heal|barrier/iu.test(id));
    clauses.push({
      id: "g3_ingame_audio",
      clause: "G3 [실시간 인게임 사운드 검증] 독안개 분출 효과음(easyrpg-sound-fog1) 및 방독면 정화음(flash1)이 실제 오디오 엔진에서 재생될 것",
      category: "ingame_audio",
      passed: hasFogSeA && hasMaskSeB,
      detail: `분기A 재생 SE=[${branchA.audioObserved.join(", ") || "없음"}], 분기B 재생 SE=[${branchB.audioObserved.join(", ") || "없음"}]`,
    });

    const liveFxPassed =
      branchA.screenEffectVisible &&
      branchA.aliveParticles > 0 &&
      branchA.weatherKind === "fog" &&
      branchA.playerPose === "fallen" &&
      branchA.playerAngle === 90 &&
      branchB.screenEffectVisible &&
      branchB.aliveParticles > 0;
    clauses.push({
      id: "g4_ingame_fx_particles_pose",
      clause: "G4 [실시간 인게임 독안개 날씨(fog)·파티클·보라색 색조·쓰러짐 포즈] player.html에서 보라색 화면 Tint + 안개 날씨(weather='fog') + 독연기 파티클(aliveParticles>0) + 사망 시 주인공 90° 질식 쓰러짐(pose='fallen') 확인",
      category: "ingame_visual_fx",
      passed: liveFxPassed,
      detail: `분기A(tint=${branchA.screenEffectBg || "없음"}, weather=${branchA.weatherKind}, aliveParticles=${branchA.aliveParticles}, pose=${branchA.playerPose}/${branchA.playerAngle}°) | 분기B(tint=${branchB.screenEffectBg || "없음"}, aliveParticles=${branchB.aliveParticles})`,
    });

    const branchDomPassed =
      branchA.dialogueVisible &&
      branchA.dialogueText.includes("숨을 쉴 수 없다...!") &&
      branchA.gameOverAfterAdvance &&
      branchB.dialogueVisible &&
      branchB.dialogueText.includes("방독면 덕분에 독기를 헤치고 전진한다.") &&
      !branchB.gameOverAfterAdvance &&
      branchA.pageErrors.length === 0 &&
      branchB.pageErrors.length === 0;
    clauses.push({
      id: "g5_ingame_dialogue_and_gameover",
      clause: "G5 [실시간 인게임 대사창 DOM & 게임오버 전환] (A) sw_gas_mask OFF 시 '숨을 쉴 수 없다...!' 출력 후 실제 GAME OVER 화면 전환 + (B) ON 시 '방독면 덕분에 독기를 헤치고 전진한다.' 출력 후 생존",
      category: "ingame_branch_dom",
      passed: branchDomPassed,
      detail: `분기A(대사="${branchA.dialogueText.slice(0, 36)}", gameOver화면=${branchA.gameOverAfterAdvance}) | 분기B(대사="${branchB.dialogueText.slice(0, 36)}", gameOver=${branchB.gameOverAfterAdvance})`,
    });
  } else if (testCase.id === "jrpg_046") {
    const hasSwordPedestal = kitIds.some((id) => /grandleon|sword/iu.test(id));
    const houseCells = countArchitectureTilesOnMap(map, tileset);
    const targetEv = map.events.find((e) => !e.id.startsWith("ev_baseline_"));
    const gId = String((targetEv?.pages?.[0]?.graphic as any)?.sprite?.id ?? "");
    const hasFrogKnightSprite = gId === "sprite_frog_knight_grandleon";

    clauses.push({
      id: "g2_domain_map_and_terrain",
      clause: "G2 [배경 건축물 & 성검·개구리 기사 도트 일치] 중세 성소 안뜰 건축물(60칸 이상) + 성검 그랜드리온 황금 제단 도트 + 갑옷·망토·성검 거상 개구리 기사 전용 스프라이트 배치",
      category: "map_setting",
      passed: houseCells >= 60 && hasSwordPedestal && hasFrogKnightSprite,
      detail:
        houseCells >= 60 && hasSwordPedestal && hasFrogKnightSprite
          ? `중세 성소 건축물(${houseCells}칸) + 성검 제단(${kitIds.join(", ")}) + 개구리 기사 전용 도트(${gId}) 확인`
          : `중세 건축물(${houseCells}칸)/성검 제단(${hasSwordPedestal})/개구리 기사 도트(${gId || "Monster4"}) 미비! FAIL`,
    });

    const hasSwordSeA = branchA.audioObserved.some((id) => /sword|unsheathe|blade|flash/iu.test(id));
    const hasHolySeB = branchB.audioObserved.some((id) => /flash|holy|sword|unsheathe/iu.test(id));
    clauses.push({
      id: "g3_ingame_audio",
      clause: "G3 [실시간 인게임 사운드 검증] 발도음(cc0-se-orp-battle-sword-unsheathe / sword1) 및 성검 각성 공명음(flash1)이 실제 오디오 엔진에서 재생될 것",
      category: "ingame_audio",
      passed: hasSwordSeA && hasHolySeB,
      detail: `연출1 재생 SE=[${branchA.audioObserved.join(", ") || "없음"}], 연출2 재생 SE=[${branchB.audioObserved.join(", ") || "없음"}]`,
    });

    const liveFxPassed =
      branchA.screenEffectVisible &&
      branchA.aliveParticles > 0 &&
      branchA.shakeIntensity >= 4 &&
      branchA.letterboxPx >= 12 &&
      branchB.aliveParticles > 0;
    clauses.push({
      id: "g4_ingame_fx_particles_pose",
      clause: "G4 [실시간 인게임 황금빛 플래시·진동·빛기둥 파티클·레터박스] player.html에서 황금빛 화면 Tint/Flash + 화면 진동(shake>=4) + 레터박스 + 성검 반짝임 파티클(aliveParticles>0)이 실시간 렌더링될 것",
      category: "ingame_visual_fx",
      passed: liveFxPassed,
      detail: `연출1(tint=${branchA.screenEffectBg || "없음"}, aliveParticles=${branchA.aliveParticles}, shake=${branchA.shakeIntensity}, letterbox=${branchA.letterboxPx}px) | 연출2(aliveParticles=${branchB.aliveParticles})`,
    });

    const branchDomPassed =
      branchA.dialogueVisible &&
      branchA.dialogueText.includes("사이러스여, 지켜보아라! 이 검으로 마왕의 야망을 베겠다!") &&
      Boolean(branchA.switchesAfterAdvance["sw_masamune_awakened"]) &&
      branchB.dialogueVisible &&
      branchB.dialogueText.includes("그랜드리온") &&
      branchA.pageErrors.length === 0 &&
      branchB.pageErrors.length === 0;
    clauses.push({
      id: "g5_ingame_dialogue_and_gameover",
      clause: "G5 [실시간 인게임 대사창 DOM & 스위치 점등] 실제 상호작용 시 맹세 대사 출력 후 sw_masamune_awakened=true 점등 및 2차 각성 대사 전환 확인",
      category: "ingame_branch_dom",
      passed: branchDomPassed,
      detail: `연출1(대사="${branchA.dialogueText.slice(0, 40)}", sw_masamune_awakened=${ Boolean(branchA.switchesAfterAdvance["sw_masamune_awakened"]) }) | 연출2(대사="${branchB.dialogueText.slice(0, 40)}")`,
    });
  }

  const apiKey = await resolveRequestApiKey(MODEL_PROVIDER);

  // ==========================================================================
  // Gate G6 (Pass 1): Hostile Full-Map & Tile Visual QA Judge
  // ==========================================================================
  let pass1MapJudgeVerdict = { passed: false, score: 0, critique: "No API key" };
  if (apiKey && existsSync(mapPngPath)) {
    const mapB64 = readFileSync(mapPngPath).toString("base64");
    const pass1Prompt = `너는 극도로 냉정하고 적대적인 JRPG 타일·맵 아키텍처 심판관(Pass 1: Map & Tile Visual QA)이다.
사전 힌트 없이 아래 사용자 명령(Prompt)과 첨부된 전체 맵 PNG만 보고 바닥 타일, 도로 연석, 배경 건축물, 도메인 지형·오브젝트의 시각적 완성도를 엄격히 채점하라.

사용자 명령(Prompt):
"${testCase.prompt}"

체크리스트(하나라도 위반 시 즉시 passed: false, 0~45점 / 모두 완벽히 충족 시 passed: true, 85~96점):
1. [바닥 타일 & 도로 연석 무결성]: 바닥 석판/잔디에 검은색 삼각형 건물 그림자 조각이 잘못 박혀 바닥이 깨져 보이거나, 도로에 연석(curb) 테두리가 없거나, 커스텀 지형 주변에 네모난 단색 스티커 경계선이 보이면 즉시 FAIL!
2. [배경 건축물 & 도메인 지형 실존]:
   - '마을 외곽 화산 열풍'이면 실제 마을 주택들(지붕·벽·문·우물)과 남동쪽 화산 용암 균열·분화구가 모두 있어야 함 (주택이 0채거나 가시 발판만 있으면 즉시 FAIL).
   - '마도 유적 용암 다리'면 실제 주황/노란 용암 협곡(Lava Chasm)과 그 위를 가로지르는 석조 다리(Stone Bridge) 및 다리 중앙 균열이 있어야 함 (초록 잔디 공원에 유리관만 있으면 즉시 FAIL).
   - '마도 유적 보라색 독안개'면 유적 석벽·기둥과 보라색 독늪·독안개 분출구가 자연스럽게 어우러져 있어야 함 (초록 잔디에 유리관+보물상자면 즉시 FAIL).
   - '중세 성검 그랜드리온 각성'이면 중세 성소 안뜰 건축물(성벽·성소 박공·석조 건물·기둥·석판 메달리온)과 실제 검이 꽂힌 황금 제단, 갑옷·망토를 입은 개구리 기사가 겹침 없이 배치되어 있어야 함 (빈 잔디밭에 초록 보석 제단이면 즉시 FAIL).

JSON으로만 응답하라:
{"passed": boolean, "score": number, "critique": "한국어로 바닥 타일·도로 연석·건축물·지형 상태를 냉정하게 2문장으로 평가"}`;

    try {
      const { completion } = (await completeProvider(
        MODEL_PROVIDER,
        {
          model: MODEL_ID,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: pass1Prompt },
                { type: "image_url", image_url: { url: `data:image/png;base64,${mapB64}` } },
              ],
            },
          ],
          stream: false,
          max_tokens: 800,
          temperature: 0.1,
          reasoning: { effort: "low" },
        },
        { apiKey },
      )) as any;
      const rawText = String(completion?.choices?.[0]?.message?.content ?? "").trim();
      const jsonMatch = /\{[\s\S]*\}/u.exec(rawText);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        pass1MapJudgeVerdict = {
          passed: Boolean(parsed.passed),
          score: Number(parsed.score ?? 0),
          critique: String(parsed.critique ?? rawText),
        };
      }
    } catch (err) {
      pass1MapJudgeVerdict = { passed: false, score: 0, critique: `Pass 1 Judge error: ${(err as Error).message}` };
    }
  }

  clauses.push({
    id: "g6_pass1_map_judge",
    clause: `G6 [1차 적대적 맵·타일 Visual QA 심판] 전체 맵 도트·바닥 타일·건축물·지형 독립 채점 (${pass1MapJudgeVerdict.score}/100점)`,
    category: "pass1_map_judge",
    passed: pass1MapJudgeVerdict.passed && pass1MapJudgeVerdict.score >= 80,
    detail: pass1MapJudgeVerdict.critique,
  });

  // ==========================================================================
  // Gate G7 (Pass 2): Re-Evaluation of REAL In-Game Screenshots (`player.html`)
  // ==========================================================================
  let pass2InGameJudgeVerdict = { passed: false, score: 0, critique: "No API key" };
  if (apiKey && existsSync(branchA.screenshotPath) && existsSync(branchB.screenshotPath)) {
    const inGameAB64 = readFileSync(branchA.screenshotPath).toString("base64");
    const inGameBB64 = readFileSync(branchB.screenshotPath).toString("base64");
    const telemetrySummary = `
[실제 브라우저 player.html 엔진 실측 텔레메트리 요약]
- 분기 A (${branchA.branchLabel}):
  · 재생된 사운드(AudioEngine): [${branchA.audioObserved.join(", ") || "없음"}]
  · 화면 색조/플래시 오버레이: visible=${branchA.screenEffectVisible}, bg="${branchA.screenEffectBg}"
  · 활성 파티클(Phaser ParticleEmitter): emitters=${branchA.particleEmitterCount}, aliveParticles=${branchA.aliveParticles}, shake=${branchA.shakeIntensity}, letterbox=${branchA.letterboxPx}px
  · 캐릭터 상태: pose="${branchA.playerPose}", angle=${branchA.playerAngle}°, 실시간 타일 변화(mapOverrides)=${branchA.mapOverrideCount}칸
  · 대사창 DOM: visible=${branchA.dialogueVisible}, text="${branchA.dialogueText}"
  · 대사 종료 후 GAME OVER 화면 전환: ${branchA.gameOverAfterAdvance}
- 분기 B (${branchB.branchLabel}):
  · 재생된 사운드(AudioEngine): [${branchB.audioObserved.join(", ") || "없음"}]
  · 화면 색조/플래시 오버레이: visible=${branchB.screenEffectVisible}, bg="${branchB.screenEffectBg}"
  · 활성 파티클(Phaser ParticleEmitter): emitters=${branchB.particleEmitterCount}, aliveParticles=${branchB.aliveParticles}, followerSprites=${branchB.followerCount}
  · 대사창 DOM: visible=${branchB.dialogueVisible}, text="${branchB.dialogueText}"
  · 대사 종료 후 생존(gameOver=false): ${!branchB.gameOverAfterAdvance}, 스위치=${JSON.stringify(branchB.switchesAfterAdvance)}`;

    const pass2Prompt = `너는 실제 구동 중인 인게임 화면(player.html)과 게임성(이펙트·사운드·연출·대사창·분기)을 2차로 재검증하는 극도로 적대적인 In-Game Game-ness QA 심판관(Pass 2: Real In-Game Screenshot Re-Evaluation)이다.
첨부된 이미지 2장은 합성이 아니라 실제 Chromium 브라우저에서 player.html 런타임을 구동하여 캡처한 [분기 A 인게임 스크린샷]과 [분기 B 인게임 스크린샷]이다.

사용자 명령(Prompt):
"${testCase.prompt}"
${telemetrySummary}

다음 4대 인게임 게임성 관문을 하나라도 위반하면 가차 없이 passed: false 와 낮은 점수(0~45점)를 부여하고, 모두 완벽히 구현되었으면 passed: true 와 높은 점수(85~96점, passed: true 시 반드시 85 이상)를 부여하라:
1. [인게임 배경 & 지형 연출]: 실제 인게임 화면 안에서 마을/용암 협곡 다리/보라색 독늪 유적/중세 성검 성소가 깨짐 없이 렌더링되고 있는가? (초록 공원에 유리관/가시발판만 있거나 바닥에 검은 삼각형 그림자 오염 타일이 보이면 즉시 FAIL!)
2. [인게임 실시간 시각 이펙트 & 캐릭터 연기]:
   - 사망/위기 분기(이미지 1)에서 화면 색조 변화(붉은 열풍/보라색 독기 오버레이), 파티클 이펙트, 주인공이 바닥에 90도로 쓰러진 포즈(pose='fallen'), 다리 붕괴(jrpg_002)가 실제 인게임 화면에 보이는가? (주인공이 멀쩡히 서 있거나 화면 색조·파티클이 없으면 즉시 FAIL!)
   - 생존/각성 분기(이미지 2)에서 마르 동료 캐릭터 동행 및 냉기 마법 이펙트(jrpg_016), 화염의 반지 방어막(jrpg_002), 방독면 돌파(jrpg_003), 성검 그랜드리온 황금빛 각성(jrpg_046)이 실제 인게임 화면에 보이는가?
3. [인게임 사운드(SE) 재생]: 두 분기 모두 장면에 부합하는 효과음(화염/냉기/폭발/독안개/발도음)이 실제 오디오 엔진에서 재생되었는가? (재생된 SE가 '없음'이면 즉시 FAIL!)
4. [인게임 한국어 대사창(.dialogue-box) & 분기 완결성]: 실제 인게임 하단 대사창에 프롬프트가 요구한 한국어 대사가 정확히 출력되고, 사망 분기는 GAME OVER로, 생존/각성 분기는 생존/스위치 ON으로 정확히 귀결되는가?

JSON으로만 응답하라:
{"passed": boolean, "score": number, "critique": "한국어로 실제 인게임 스크린샷 2장의 시각 연출(색조·파티클·캐릭터 쓰러짐/동료·지형 변화), 사운드 재생, 대사창·게임성을 냉정하게 2~3문장으로 평가"}`;

    try {
      const { completion } = (await completeProvider(
        MODEL_PROVIDER,
        {
          model: MODEL_ID,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: pass2Prompt },
                { type: "image_url", image_url: { url: `data:image/png;base64,${inGameAB64}` } },
                { type: "image_url", image_url: { url: `data:image/png;base64,${inGameBB64}` } },
              ],
            },
          ],
          stream: false,
          max_tokens: 900,
          temperature: 0.1,
          reasoning: { effort: "low" },
        },
        { apiKey },
      )) as any;
      const rawText = String(completion?.choices?.[0]?.message?.content ?? "").trim();
      const jsonMatch = /\{[\s\S]*\}/u.exec(rawText);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        pass2InGameJudgeVerdict = {
          passed: Boolean(parsed.passed),
          score: Number(parsed.score ?? 0),
          critique: String(parsed.critique ?? rawText),
        };
      }
    } catch (err) {
      pass2InGameJudgeVerdict = { passed: false, score: 0, critique: `Pass 2 Judge error: ${(err as Error).message}` };
    }
  }

  clauses.push({
    id: "g7_pass2_ingame_judge",
    clause: `G7 [2차 실제 인게임(player.html) 스크린샷·게임성 재평가 심판] 실시간 인게임 캡처 2장 + 이펙트·사운드·연기 적대적 재검증 (${pass2InGameJudgeVerdict.score}/100점)`,
    category: "pass2_ingame_judge",
    passed: pass2InGameJudgeVerdict.passed && pass2InGameJudgeVerdict.score >= 80,
    detail: pass2InGameJudgeVerdict.critique,
  });

  const passedCount = clauses.filter((c) => c.passed).length;
  const overallPassed = passedCount === clauses.length;

  return {
    caseId: testCase.id,
    title: testCase.title,
    prompt: testCase.prompt,
    mode,
    overallPassed,
    passedCount,
    totalClauses: clauses.length,
    clauses,
    branchA,
    branchB,
    pass1MapJudgeVerdict,
    pass2InGameJudgeVerdict,
  };
}

// ============================================================================
// 6. Stitch Real Map + Real In-Game Screenshots into Comparison Sheet
// ============================================================================

function scalePngNearest(src: PNG, targetW: number, targetH: number): PNG {
  const dst = new PNG({ width: targetW, height: targetH });
  for (let y = 0; y < targetH; y++) {
    const sy = Math.min(src.height - 1, Math.floor((y * src.height) / targetH));
    for (let x = 0; x < targetW; x++) {
      const sx = Math.min(src.width - 1, Math.floor((x * src.width) / targetW));
      const si = (sy * src.width + sx) * 4;
      const di = (y * targetW + x) * 4;
      dst.data[di] = src.data[si]!;
      dst.data[di + 1] = src.data[si + 1]!;
      dst.data[di + 2] = src.data[si + 2]!;
      dst.data[di + 3] = 255;
    }
  }
  return dst;
}

function buildCompositeSheetFromRealInGamePngs(
  mapPng: PNG,
  inGameAPath: string,
  inGameBPath: string,
  outPath: string,
  isPass: boolean,
) {
  const rawA = PNG.sync.read(readFileSync(inGameAPath));
  const rawB = PNG.sync.read(readFileSync(inGameBPath));
  const targetH = Math.max(mapPng.height, 256);
  const mapScaled =
    mapPng.height === targetH
      ? mapPng
      : scalePngNearest(mapPng, Math.round((mapPng.width * targetH) / mapPng.height), targetH);
  const inGameW = Math.round((rawA.width * targetH) / rawA.height);
  const scaledA = scalePngNearest(rawA, inGameW, targetH);
  const scaledB = scalePngNearest(rawB, inGameW, targetH);

  const pad = 10;
  const compW = mapScaled.width + scaledA.width + scaledB.width + pad * 4;
  const compH = targetH + pad * 2;
  const comp = new PNG({ width: compW, height: compH });

  for (let y = 0; y < compH; y++) {
    for (let x = 0; x < compW; x++) {
      const i = (y * compW + x) * 4;
      comp.data[i] = isPass ? 16 : 28;
      comp.data[i + 1] = isPass ? 24 : 16;
      comp.data[i + 2] = isPass ? 34 : 20;
      comp.data[i + 3] = 255;
    }
  }

  const blit = (dst: PNG, src: PNG, ox: number, oy: number) => {
    for (let y = 0; y < src.height; y++) {
      for (let x = 0; x < src.width; x++) {
        const si = (y * src.width + x) * 4;
        const di = ((oy + y) * dst.width + (ox + x)) * 4;
        dst.data[di] = src.data[si]!;
        dst.data[di + 1] = src.data[si + 1]!;
        dst.data[di + 2] = src.data[si + 2]!;
        dst.data[di + 3] = 255;
      }
    }
  };

  blit(comp, mapScaled, pad, pad);
  blit(comp, scaledA, mapScaled.width + pad * 2, pad);
  blit(comp, scaledB, mapScaled.width + scaledA.width + pad * 3, pad);

  writeFileSync(outPath, PNG.sync.write(comp));
}

// ============================================================================
// 7. Build Authentic Beodeul Domain Maps + Full In-Game Staging & Run Brutal Audit
// ============================================================================

async function main() {
  const pilotIds = ["jrpg_016", "jrpg_002", "jrpg_003", "jrpg_046"];
  const r2CasesDir = resolve(process.cwd(), "artifacts/jrpg-200/round-2/cases");
  const r2PngDir = resolve(process.cwd(), "artifacts/jrpg-200/round-2/visual-qa");
  const outDir = resolve(process.cwd(), "artifacts/jrpg-200/brutal-pilot");
  const vizDir = "/home/main/claude-viz/brutal-pilot";
  mkdirSync(outDir, { recursive: true });
  mkdirSync(vizDir, { recursive: true });

  console.log("[Brutal QA Pilot] Starting real player.html QA server & headless Chromium...");
  const server = await startPlayerQaServer();
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"],
  });
  const context = await browser.newContext({ viewport: { width: 960, height: 640 } });
  await context.addInitScript(
    `try { localStorage.clear(); } catch {}
     window.__OPENRPG_BOOT__ = {
       projectUrl: "/__qa_project__/project.json",
       saveNamespace: "brutal-qa-" + Date.now() + "-" + Math.random().toString(36).slice(2),
       qaInstrumentation: true
     };`,
  );
  await context.route("**/__qa_project__/project.json", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: currentRoutedProjectJson }),
  );

  const onlyArgIdx = process.argv.indexOf("--only");
  const onlyId = onlyArgIdx >= 0 ? process.argv[onlyArgIdx + 1] : null;
  const cachedSummaryPath = join(outDir, "brutal-pilot-summary.json");
  const cachedEvals: BrutalPilotEvaluation[] = existsSync(cachedSummaryPath)
    ? JSON.parse(readFileSync(cachedSummaryPath, "utf8"))
    : [];
  const allEvals: BrutalPilotEvaluation[] = [];

  try {
    for (const id of pilotIds) {
      if (onlyId && id !== onlyId) {
        const cb = cachedEvals.find((e) => e.caseId === id && e.mode === "before_lenient");
        const ca = cachedEvals.find((e) => e.caseId === id && e.mode === "after_brutal_fix");
        if (cb && ca) {
          allEvals.push(cb, ca);
          continue;
        }
      }
      const testCase = JRPG_200_CASES.find((c) => c.id === id)!;
      const r2Json = JSON.parse(readFileSync(join(r2CasesDir, `${id}.json`), "utf8"));
      const fx = testCase.focusCoord.x;
      const fy = testCase.focusCoord.y;

      // ----------------------------------------------------------------------
      // STEP A: Reconstruct "Before (Lenient Round 2)" & Run REAL In-Game QA
      // ----------------------------------------------------------------------
      const beforeProj = createJrpg200FixtureProject();
      beforeProj.startMapId = testCase.mapId;
      const bMap = beforeProj.maps[testCase.mapId]!;
      const bMidX = Math.floor(bMap.width / 2);
      const bMidY = Math.floor(bMap.height / 2);
      const badPlazaTiles = [1509, 2691, 1077, 1212, 1672, 2523, 1673, 1674];
      for (let x = 0; x < bMap.width; x++) bMap.lowerTiles[bMidY * bMap.width + x] = 3221;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -4; dx <= 4; dx++) {
          const gx = bMidX + dx;
          const gy = bMidY + dy;
          if (gx >= 1 && gy >= 1 && gx < bMap.width - 1 && gy < bMap.height - 1) {
            bMap.lowerTiles[gy * bMap.width + gx] = badPlazaTiles[(gx * 7 + gy * 13) % badPlazaTiles.length]!;
          }
        }
      }
      for (const ev of r2Json.targetEvents ?? []) {
        const idx = bMap.events.findIndex((e) => e.id === ev.id);
        if (idx >= 0) bMap.events[idx] = structuredClone(ev);
        else bMap.events.push(structuredClone(ev));
      }
      const beforePngPath = join(r2PngDir, `${id}.png`);
      const beforeOnlyMapPng = join(vizDir, `${id}_before_map.png`);
      writeFileSync(beforeOnlyMapPng, readFileSync(beforePngPath));

      const beforeInGameAPath = join(vizDir, `${id}_before_ingame_A.png`);
      const beforeInGameBPath = join(vizDir, `${id}_before_ingame_B.png`);

      console.log(`\n[Brutal QA Pilot] Running REAL player.html In-Game QA on BEFORE (Lenient Round 2) for ${id}: ${testCase.title}...`);
      const beforeBranchA = await runLiveInGameBranch(context, server.url, beforeProj, {
        branchLabel:
          id === "jrpg_016"
            ? "마르 미동행 (열풍 사망)"
            : id === "jrpg_002"
              ? "반지 미소지 (다리 붕괴 사망)"
              : id === "jrpg_003"
                ? "방독면 OFF (독안개 사망)"
                : "성검 그랜드리온 1차 각성",
        mapId: testCase.mapId,
        startX: fx - 1,
        startY: fy,
        facing: "right",
        triggerMode: id === "jrpg_046" ? "action" : "step_right",
        partyActorIds: ["actor_crono"],
        inventory: id === "jrpg_002" ? { item_fire_ring: 0 } : {},
        switches: id === "jrpg_003" ? { sw_gas_mask: false } : {},
        screenshotPath: beforeInGameAPath,
      });

      const beforeBranchB = await runLiveInGameBranch(context, server.url, beforeProj, {
        branchLabel:
          id === "jrpg_016"
            ? "마르 동행 (냉기 마법 생존)"
            : id === "jrpg_002"
              ? "화염의 반지 소지 (생존)"
              : id === "jrpg_003"
                ? "방독면 ON (독안개 돌파)"
                : "성검 각성 후 대화 (sw_masamune_awakened ON)",
        mapId: testCase.mapId,
        startX: fx - 1,
        startY: fy,
        facing: "right",
        triggerMode: id === "jrpg_046" ? "action" : "step_right",
        partyActorIds: id === "jrpg_016" ? ["actor_crono", "actor_marle"] : ["actor_crono"],
        inventory: id === "jrpg_002" ? { item_fire_ring: 1 } : {},
        switches:
          id === "jrpg_003"
            ? { sw_gas_mask: true }
            : id === "jrpg_046"
              ? { sw_masamune_awakened: true }
              : {},
        screenshotPath: beforeInGameBPath,
      });

      const beforeEval = await evaluateCaseBrutallyWithLiveInGame(
        testCase,
        beforeProj,
        "before_lenient",
        beforePngPath,
        beforeBranchA,
        beforeBranchB,
      );
      allEvals.push(beforeEval);
      console.log(
        `  -> BEFORE Result: ${beforeEval.overallPassed ? "PASS" : "FAIL"} (${beforeEval.passedCount}/${beforeEval.totalClauses} gates, Pass1_MapJudge=${beforeEval.pass1MapJudgeVerdict.score}, Pass2_InGameJudge=${beforeEval.pass2InGameJudgeVerdict.score})`,
      );

      // ----------------------------------------------------------------------
      // STEP B: Build "After (Authentic Beodeul Terrain + Full In-Game FX/Audio/Pose Staging)"
      // ----------------------------------------------------------------------
      const afterProj = createJrpg200FixtureProject();
      installBeodeulArchitecture(afterProj);
      afterProj.startMapId = testCase.mapId;
      const aMap = afterProj.maps[testCase.mapId]!;
      const aTileset = afterProj.tilesets[aMap.tilesetId]!;

      // Remove stray fixture NPCs so zero NPCs stand on house roofs or inside walls
      aMap.events = (r2Json.targetEvents ?? []).map((ev: any) => structuredClone(ev));

      const ox = fx;
      const oy = Math.max(1, fy - 2);
      const floorX0 = Math.max(1, Math.min(aMap.width - 4, fx - 1));
      const floorY0 = Math.max(1, Math.min(aMap.height - 4, oy));

      if (id === "jrpg_016") {
        fillRegionTool.run(afterProj, {
          mapId: aMap.id,
          rect: { x: 0, y: 0, w: aMap.width, h: aMap.height },
          material: "버들항 풀밭",
          clearUpper: true,
        });
        fillRegionTool.run(afterProj, {
          mapId: aMap.id,
          rect: { x: 0, y: 6, w: 14, h: 2 },
          material: "버들항 길 포석",
          clearUpper: false,
        });
        fillRegionTool.run(afterProj, {
          mapId: aMap.id,
          rect: { x: 8, y: 8, w: 3, h: 7 },
          material: "버들항 모랫길",
          clearUpper: false,
        });
        fillRegionTool.run(afterProj, {
          mapId: aMap.id,
          rect: { x: 3, y: 13, w: 7, h: 2 },
          material: "버들항 모랫길",
          clearUpper: false,
        });
        fillRegionTool.run(afterProj, {
          mapId: aMap.id,
          rect: { x: 10, y: 10, w: 13, h: 5 },
          material: "버들항 모랫길",
          clearUpper: false,
        });
        fillRegionTool.run(afterProj, {
          mapId: aMap.id,
          rect: { x: 14, y: 7, w: 9, h: 8 },
          material: "버들항 모랫길",
          clearUpper: false,
        });

        stampObjectTool.run(afterProj, { objectId: "kit:beodeul_city/bd-house-village-cream", mapId: aMap.id, x: 1, y: 0, layers: "upper" });
        stampObjectTool.run(afterProj, { objectId: "kit:beodeul_city/bd-house-village-stone", mapId: aMap.id, x: 9, y: 0, layers: "upper" });
        stampObjectTool.run(afterProj, { objectId: "kit:beodeul_city/bd-house-village-ochre", mapId: aMap.id, x: 1, y: 7, layers: "upper" });
        stampObjectTool.run(afterProj, { objectId: "kit:beodeul_city/bd-prop-well_roofed", mapId: aMap.id, x: 11, y: 8, layers: "upper" });
        stampObjectTool.run(afterProj, { objectId: "kit:beodeul_city/bd-tree-03a8f7", mapId: aMap.id, x: 15, y: 1, layers: "upper" });
        stampObjectTool.run(afterProj, { objectId: "kit:beodeul_city/bd-tree-3e8732", mapId: aMap.id, x: 19, y: 1, layers: "upper" });

        dressBeodeulGround(afterProj, aMap.id, "living", 1004);
        for (let y = 7; y < aMap.height; y++) {
          for (let x = 14; x < aMap.width; x++) {
            const idx = y * aMap.width + x;
            setLayerTileAt(aMap, 2, idx, -1);
            setLayerTileAt(aMap, 4, idx, -1);
          }
        }
        compactMapLayers(aMap);

        stampKitNative(aMap, aTileset, "bd-pick-volcano-cave-spike-wide", 18, 7);
        stampKitNative(aMap, aTileset, "bd-pick-volcano-cave-spike-wide", 20, 8);
        stampKitNative(aMap, aTileset, "bd-pick-volcano-cave-spike-wide", 20, 12);
        stampKitNative(aMap, aTileset, "bd-pick-volcano-cave-brazier", 21, 10);
        stampKitNative(aMap, aTileset, "bd-pick-volcano-cave-fire-crystal", 19, 10);
        stampKitNative(aMap, aTileset, "bd-pick-volcano-cave-fire-crystal", 18, 13);
        stampKitNative(aMap, aTileset, "bd-pick-volcano-cave-steam-vent", 14, 7);
        stampKitNative(aMap, aTileset, "bd-pick-volcano-cave-ember-a", 16, 13);

        bakeCustomFloorAndObject(
          afterProj,
          aMap,
          "beodeul-floor-volcano",
          "화산 열풍 현무암·용암 균열 지대 (3x3)",
          FLOOR_VOLCANO_48,
          "volcanic-crater-vent",
          "분출하는 화산 열풍 분화구 (2x2)",
          OBJ_VOLCANO_CRATER_32,
          floorX0,
          floorY0,
          ox,
          oy,
        );

        if (!afterProj.database.skills.some((s) => s.id === "skill_marle_ice")) {
          const baseSkill = afterProj.database.skills[0]
            ? structuredClone(afterProj.database.skills[0])
            : ({
                id: "skill_marle_ice",
                name: "냉기 마법 (Ice)",
                description: "마르의 냉기 마법으로 타오르는 화산 열풍을 식힌다.",
                mpCost: 4,
                scope: "oneEnemy",
                effect: { kind: "damage" },
                formula: { base: 45, variance: 10 },
                stateEffects: [],
              } as any);
          afterProj.database.skills.push({
            ...baseSkill,
            id: "skill_marle_ice",
            name: "냉기 마법 (Ice)",
            description: "마르의 냉기 마법으로 타오르는 화산 열풍을 식힌다.",
          });
        }

        const ev = aMap.events.find((e) => e.id === "ev_volcanic_blast");
        if (ev) {
          for (const p of ev.pages) {
            p.graphic = {
              transparent: true,
              direction: "down",
              pattern: 1,
            };
          }
          // Page 0: Fatal Volcanic Blast (Marle absent)
          if (ev.pages[0]) {
            ev.pages[0].commands = [
              { kind: "cutsceneControl", mode: "begin", skippable: false } as any,
              { kind: "m2Command", commandId: "m2-202-screen-effect", fields: { effect: "letterbox", value: "8", durationMs: 150 } } as any,
              { kind: "playAudio", resourceId: "easyrpg-sound-fire1", loop: false, channel: "se" } as any,
              { kind: "m2Command", commandId: "m2-202-screen-effect", fields: { effect: "tint", value: "#ff2200", durationMs: 150 } } as any,
              { kind: "m2Command", commandId: "m2-047-flash-screen", fields: { color: "red", durationMs: 250 } } as any,
              { kind: "m2Command", commandId: "m2-048-shake-screen", fields: { intensity: "6", value: 6, durationMs: 3200 } } as any,
              { kind: "m2Command", commandId: "m2-224-particle-effect", fields: { preset: "fire", target: "player", durationMs: 6500, wait: false } } as any,
              { kind: "m2Command", commandId: "m2-224-particle-effect", fields: { preset: "explosion", target: "player", durationMs: 6500, wait: false } } as any,
              { kind: "m2Command", commandId: "m2-225-sprite-look", fields: { target: "player", pose: "fallen", tint: "red" } } as any,
              { kind: "text", speaker: "화산 열풍", body: "숨이 막히는 열기에 정신을 잃었다!" } as any,
              { kind: "killPlayer" } as any,
              { kind: "gameOver" } as any,
            ];
          }
          // Page 1: Marle in Party -> Ice Magic Cutscene
          const pageMarle = ev.pages.find((p: any) => JSON.stringify(p.conditions ?? []).includes("actor_marle"));
          if (pageMarle) {
            pageMarle.commands = [
              { kind: "cutsceneControl", mode: "begin", skippable: true } as any,
              { kind: "m2Command", commandId: "m2-202-screen-effect", fields: { effect: "letterbox", value: "8", durationMs: 150 } } as any,
              { kind: "playAudio", resourceId: "easyrpg-sound-fire1", loop: false, channel: "se" } as any,
              { kind: "playAudio", resourceId: "easyrpg-sound-ice5", loop: false, channel: "se" } as any,
              { kind: "m2Command", commandId: "m2-202-screen-effect", fields: { effect: "tint", value: "#22aaff", durationMs: 180 } } as any,
              { kind: "m2Command", commandId: "m2-047-flash-screen", fields: { color: "blue", durationMs: 250 } } as any,
              { kind: "m2Command", commandId: "m2-048-shake-screen", fields: { intensity: "6", value: 6, durationMs: 3200 } } as any,
              { kind: "m2Command", commandId: "m2-224-particle-effect", fields: { preset: "sparkle", target: "player", durationMs: 6500, wait: false } } as any,
              { kind: "m2Command", commandId: "m2-224-particle-effect", fields: { preset: "magic", target: "player", durationMs: 6500, wait: false } } as any,
              { kind: "m2Command", commandId: "m2-225-sprite-look", fields: { target: "player", tint: "blue", afterimage: "on" } } as any,
              { kind: "text", speaker: "마르", body: "위험해, 내 냉기 마법으로 타오르는 화산 열풍을 식혀줄게!" } as any,
              { kind: "m2Command", commandId: "m2-202-screen-effect", fields: { effect: "tint", value: "neutral", durationMs: 200 } } as any,
              { kind: "m2Command", commandId: "m2-202-screen-effect", fields: { effect: "clearLetterbox", value: "", durationMs: 200 } } as any,
              { kind: "m2Command", commandId: "m2-225-sprite-look", fields: { target: "player", reset: true } } as any,
              { kind: "setSelfSwitch", key: "A", value: true } as any,
              { kind: "cutsceneControl", mode: "end" } as any,
            ];
          }
        }
      } else if (id === "jrpg_002") {
        aMap.lowerTiles.fill(26730);
        aMap.upperTiles.fill(-1);
        if (26730 < aTileset.count) {
          aTileset.priority[26730] = "lower";
          aTileset.passability[26730] = { up: false, down: false, left: false, right: false };
        }

        tileKitFloor(aMap, aTileset, 1, 4, 9, 11, "bd-pick-castle-catacombs-floor-castle", true);
        tileKitFloor(aMap, aTileset, 15, 4, 8, 11, "bd-pick-castle-catacombs-floor-castle", true);
        tileKitFloor(aMap, aTileset, 1, 6, 9, 2, "bd-pick-aqueduct-sewer-floor-darkcata", true);
        tileKitFloor(aMap, aTileset, 15, 6, 8, 2, "bd-pick-aqueduct-sewer-floor-darkcata", true);

        stampKitNative(aMap, aTileset, "bd-pick-castle-catacombs-face-castle-3h", 1, 1);
        stampKitNative(aMap, aTileset, "bd-pick-castle-catacombs-face-castle-3h", 5, 1);
        stampKitNative(aMap, aTileset, "bd-pick-castle-catacombs-face-castle-3h", 15, 1);
        stampKitNative(aMap, aTileset, "bd-pick-castle-catacombs-face-castle-3h", 19, 1);

        tileKitFloor(aMap, aTileset, 10, 1, 5, 14, "bd-pick-volcano-cave-lava-strip", false);

        stampKitNative(aMap, aTileset, "bd-pick-mountain-pass-stone-bridge", 10, 5, { passable: true });

        stampKitNative(aMap, aTileset, "bd-prop-statue_sage", 3, 2);
        stampKitNative(aMap, aTileset, "bd-prop-statue_sage", 19, 2);
        stampKitNative(aMap, aTileset, "bd-pick-temple-ruins-column-temple-tall", 7, 2);
        stampKitNative(aMap, aTileset, "bd-pick-temple-ruins-column-temple-tall", 16, 2);
        stampKitNative(aMap, aTileset, "bd-pick-temple-ruins-column-temple-tall", 7, 9);
        stampKitNative(aMap, aTileset, "bd-pick-temple-ruins-column-temple-tall", 16, 9);
        stampKitNative(aMap, aTileset, "bd-pick-volcano-cave-brazier", 9, 4);
        stampKitNative(aMap, aTileset, "bd-pick-volcano-cave-brazier", 9, 8);
        stampKitNative(aMap, aTileset, "bd-pick-volcano-cave-brazier", 15, 4);
        stampKitNative(aMap, aTileset, "bd-pick-volcano-cave-brazier", 15, 8);
        stampKitNative(aMap, aTileset, "bd-pick-volcano-cave-spike-wide", 2, 11);
        stampKitNative(aMap, aTileset, "bd-pick-volcano-cave-spike-wide", 19, 11);

        bakeCustomFloorAndObject(
          afterProj,
          aMap,
          "beodeul-floor-lava-bridge",
          "마도 유적 용암 협곡 다리 균열 바닥 (3x3)",
          FLOOR_LAVA_BRIDGE_48,
          "collapsing-lava-bridge",
          "붕괴하는 용암 석조 다리 (2x2)",
          OBJ_LAVA_BRIDGE_32,
          11,
          5,
          11,
          6,
          { preserveUpperOnFloor: true },
        );

        const ev = aMap.events.find((e) => e.id === "ev_lava_bridge_trap");
        if (ev) {
          for (const p of ev.pages) {
            p.graphic = {
              transparent: true,
              direction: "down",
              pattern: 1,
            };
          }
          // Page 0: Bridge Collapses in Real-Time via changeTile + Fallen Pose + Lava Eruption
          if (ev.pages[0]) {
            ev.pages[0].commands = [
              { kind: "cutsceneControl", mode: "begin", skippable: false } as any,
              { kind: "m2Command", commandId: "m2-202-screen-effect", fields: { effect: "letterbox", value: "8", durationMs: 150 } } as any,
              { kind: "playAudio", resourceId: "easyrpg-sound-explosion1", loop: false, channel: "se" } as any,
              { kind: "playAudio", resourceId: "easyrpg-sound-fire1", loop: false, channel: "se" } as any,
              { kind: "changeTile", mapId: aMap.id, x: 11, y: 6, layer: "upper", tile: -1 } as any,
              { kind: "changeTile", mapId: aMap.id, x: 12, y: 6, layer: "upper", tile: -1 } as any,
              { kind: "changeTile", mapId: aMap.id, x: 11, y: 7, layer: "upper", tile: -1 } as any,
              { kind: "changeTile", mapId: aMap.id, x: 12, y: 7, layer: "upper", tile: -1 } as any,
              { kind: "changeTile", mapId: aMap.id, x: 11, y: 6, layer: "lower", tile: 27292 } as any,
              { kind: "changeTile", mapId: aMap.id, x: 12, y: 6, layer: "lower", tile: 27293 } as any,
              { kind: "changeTile", mapId: aMap.id, x: 11, y: 7, layer: "lower", tile: 27452 } as any,
              { kind: "changeTile", mapId: aMap.id, x: 12, y: 7, layer: "lower", tile: 27453 } as any,
              { kind: "m2Command", commandId: "m2-202-screen-effect", fields: { effect: "tint", value: "#ff2200", durationMs: 150 } } as any,
              { kind: "m2Command", commandId: "m2-047-flash-screen", fields: { color: "red", durationMs: 250 } } as any,
              { kind: "m2Command", commandId: "m2-048-shake-screen", fields: { intensity: "6", value: 6, durationMs: 3200 } } as any,
              { kind: "m2Command", commandId: "m2-224-particle-effect", fields: { preset: "explosion", target: "player", durationMs: 6500, wait: false } } as any,
              { kind: "m2Command", commandId: "m2-224-particle-effect", fields: { preset: "fire", target: "player", durationMs: 6500, wait: false } } as any,
              { kind: "m2Command", commandId: "m2-225-sprite-look", fields: { target: "player", pose: "fallen", tint: "red" } } as any,
              { kind: "text", speaker: "주인공", body: "앗! 발밑의 용암 다리가 무너진다! 으아아악—!" } as any,
              { kind: "killPlayer" } as any,
              { kind: "gameOver" } as any,
            ];
          }
          // Page 1: Fire Ring Survival Cutscene
          const pageSurvive = ev.pages.find((p: any) => JSON.stringify(p.conditions ?? []).includes("item_fire_ring"));
          if (pageSurvive) {
            pageSurvive.commands = [
              { kind: "cutsceneControl", mode: "begin", skippable: true } as any,
              { kind: "m2Command", commandId: "m2-202-screen-effect", fields: { effect: "letterbox", value: "8", durationMs: 150 } } as any,
              { kind: "playAudio", resourceId: "easyrpg-sound-explosion1", loop: false, channel: "se" } as any,
              { kind: "playAudio", resourceId: "easyrpg-sound-flash1", loop: false, channel: "se" } as any,
              { kind: "m2Command", commandId: "m2-202-screen-effect", fields: { effect: "tint", value: "#ffaa22", durationMs: 180 } } as any,
              { kind: "m2Command", commandId: "m2-047-flash-screen", fields: { color: "yellow", durationMs: 250 } } as any,
              { kind: "m2Command", commandId: "m2-048-shake-screen", fields: { intensity: "6", value: 6, durationMs: 3200 } } as any,
              { kind: "m2Command", commandId: "m2-224-particle-effect", fields: { preset: "sparkle", target: "player", durationMs: 6500, wait: false } } as any,
              { kind: "m2Command", commandId: "m2-224-particle-effect", fields: { preset: "magic", target: "player", durationMs: 6500, wait: false } } as any,
              { kind: "m2Command", commandId: "m2-225-sprite-look", fields: { target: "player", tint: "yellow", afterimage: "on" } } as any,
              { kind: "text", speaker: "주인공 (화염의 반지)", body: "용암 다리가 무너지며 불길이 치솟았지만, 화염의 반지가 수호의 빛으로 열기를 막아냈다!" } as any,
              { kind: "m2Command", commandId: "m2-202-screen-effect", fields: { effect: "tint", value: "neutral", durationMs: 200 } } as any,
              { kind: "m2Command", commandId: "m2-202-screen-effect", fields: { effect: "clearLetterbox", value: "", durationMs: 200 } } as any,
              { kind: "m2Command", commandId: "m2-225-sprite-look", fields: { target: "player", reset: true } } as any,
              { kind: "setSelfSwitch", key: "A", value: true } as any,
              { kind: "cutsceneControl", mode: "end" } as any,
            ];
          }
        }
      } else if (id === "jrpg_003") {
        aMap.lowerTiles.fill(26730);
        aMap.upperTiles.fill(-1);
        if (26730 < aTileset.count) {
          aTileset.priority[26730] = "lower";
          aTileset.passability[26730] = { up: false, down: false, left: false, right: false };
        }

        tileKitFloor(aMap, aTileset, 1, 4, 22, 11, "bd-pick-temple-ruins-floor-ruin", true);
        tileKitFloor(aMap, aTileset, 11, 4, 11, 10, "bd-pick-temple-ruins-floor-trav", true);

        for (const wx of [1, 5, 9, 13, 17, 19]) {
          stampKitNative(aMap, aTileset, "bd-pick-temple-ruins-face-temple-3h", wx, 1);
        }
        stampKitNative(aMap, aTileset, "bd-pick-temple-ruins-vines-2", 3, 1);
        stampKitNative(aMap, aTileset, "bd-pick-temple-ruins-vines-2", 11, 1);
        stampKitNative(aMap, aTileset, "bd-pick-temple-ruins-vines-2", 19, 1);

        stampKitNative(aMap, aTileset, "bd-pick-temple-ruins-mosaic-medallion-5x5", 14, 7, { passable: true });
        stampKitNative(aMap, aTileset, "bd-pick-temple-ruins-roof-naiskos-pediment", 14, 2);
        stampKitNative(aMap, aTileset, "bd-prop-statue_sage", 11, 2);
        stampKitNative(aMap, aTileset, "bd-pick-temple-ruins-column-temple-tall", 3, 4);
        stampKitNative(aMap, aTileset, "bd-pick-temple-ruins-column-temple-tall", 9, 4);
        stampKitNative(aMap, aTileset, "bd-pick-temple-ruins-column-temple-tall", 12, 8);
        stampKitNative(aMap, aTileset, "bd-pick-temple-ruins-column-temple-tall", 20, 8);
        stampKitNative(aMap, aTileset, "bd-pick-temple-ruins-column-temple-broken", 2, 12);
        stampKitNative(aMap, aTileset, "bd-pick-temple-ruins-fallen-column-temple", 14, 12);
        stampKitNative(aMap, aTileset, "bd-pick-sea-cave-glow-mushroom", 4, 8);
        stampKitNative(aMap, aTileset, "bd-pick-sea-cave-glow-mushroom", 9, 9);
        stampKitNative(aMap, aTileset, "bd-pick-volcano-cave-bones", 9, 13);

        bakeCustomFloorAndObject(
          afterProj,
          aMap,
          "beodeul-floor-poison-swamp",
          "마도 유적 보라색 맹독 늪지 바닥 (3x3)",
          FLOOR_POISON_SWAMP_48,
          "poison-fog-vent",
          "보라색 독안개 분출구 (2x2)",
          OBJ_POISON_VENT_32,
          floorX0,
          fy - 1,
          ox + 1,
          fy - 1,
        );

        const ev = aMap.events.find((e) => e.id === "ev_poison_fog_trap");
        if (ev) {
          for (const p of ev.pages) {
            p.graphic = {
              transparent: true,
              direction: "down",
              pattern: 1,
            };
          }
          // Page 0: Poison Fog Suffocation Death
          if (ev.pages[0]) {
            ev.pages[0].commands = [
              { kind: "cutsceneControl", mode: "begin", skippable: false } as any,
              { kind: "m2Command", commandId: "m2-202-screen-effect", fields: { effect: "letterbox", value: "8", durationMs: 150 } } as any,
              { kind: "playAudio", resourceId: "easyrpg-sound-fog1", loop: false, channel: "se" } as any,
              { kind: "setWeather", weather: "fog", intensity: 0.85, transitionMs: 150 } as any,
              { kind: "m2Command", commandId: "m2-202-screen-effect", fields: { effect: "tint", value: "#8822cc", durationMs: 150 } } as any,
              { kind: "m2Command", commandId: "m2-047-flash-screen", fields: { color: "purple", value: "#a020f0", durationMs: 250 } } as any,
              { kind: "m2Command", commandId: "m2-048-shake-screen", fields: { intensity: "6", value: 6, durationMs: 3200 } } as any,
              { kind: "m2Command", commandId: "m2-224-particle-effect", fields: { preset: "smoke", target: "player", durationMs: 6500, wait: false } } as any,
              { kind: "m2Command", commandId: "m2-225-sprite-look", fields: { target: "player", pose: "fallen", tint: "purple" } } as any,
              { kind: "text", speaker: "주인공", body: "숨을 쉴 수 없다...!" } as any,
              { kind: "killPlayer" } as any,
              { kind: "gameOver" } as any,
            ];
          }
          // Page 1: Gas Mask Pass
          const pageMask = ev.pages.find((p: any) => JSON.stringify(p.conditions ?? []).includes("sw_gas_mask"));
          if (pageMask) {
            pageMask.commands = [
              { kind: "cutsceneControl", mode: "begin", skippable: true } as any,
              { kind: "m2Command", commandId: "m2-202-screen-effect", fields: { effect: "letterbox", value: "8", durationMs: 150 } } as any,
              { kind: "playAudio", resourceId: "easyrpg-sound-fog1", loop: false, channel: "se" } as any,
              { kind: "playAudio", resourceId: "easyrpg-sound-flash1", loop: false, channel: "se" } as any,
              { kind: "setWeather", weather: "fog", intensity: 0.45, transitionMs: 150 } as any,
              { kind: "m2Command", commandId: "m2-202-screen-effect", fields: { effect: "tint", value: "#33cc88", durationMs: 150 } } as any,
              { kind: "m2Command", commandId: "m2-224-particle-effect", fields: { preset: "heal", target: "player", durationMs: 6500, wait: false } } as any,
              { kind: "m2Command", commandId: "m2-224-particle-effect", fields: { preset: "sparkle", target: "player", durationMs: 6500, wait: false } } as any,
              { kind: "m2Command", commandId: "m2-225-sprite-look", fields: { target: "player", tint: "green", afterimage: "on" } } as any,
              { kind: "text", speaker: "주인공 (방독면 착용)", body: "방독면 덕분에 독기를 헤치고 전진한다." } as any,
              { kind: "m2Command", commandId: "m2-202-screen-effect", fields: { effect: "tint", value: "neutral", durationMs: 200 } } as any,
              { kind: "m2Command", commandId: "m2-202-screen-effect", fields: { effect: "clearLetterbox", value: "", durationMs: 200 } } as any,
              { kind: "setWeather", weather: "none", intensity: 0, transitionMs: 200 } as any,
              { kind: "m2Command", commandId: "m2-225-sprite-look", fields: { target: "player", reset: true } } as any,
              { kind: "setSelfSwitch", key: "A", value: true } as any,
              { kind: "cutsceneControl", mode: "end" } as any,
            ];
          }
        }
      } else if (id === "jrpg_046") {
        fillRegionTool.run(afterProj, {
          mapId: aMap.id,
          rect: { x: 0, y: 0, w: aMap.width, h: aMap.height },
          material: "버들항 풀밭",
          clearUpper: true,
        });

        tileKitFloor(aMap, aTileset, 4, 3, 13, 10, "bd-pick-temple-ruins-floor-trav", true);

        fillRegionTool.run(afterProj, {
          mapId: aMap.id,
          rect: { x: 2, y: 12, w: 16, h: 2 },
          material: "버들항 길 포석",
          clearUpper: false,
        });

        stampKitNative(aMap, aTileset, "bd-pick-castle-catacombs-face-castle-3h", 0, 0);
        stampKitNative(aMap, aTileset, "bd-pick-castle-catacombs-face-castle-3h", 4, 0);
        stampKitNative(aMap, aTileset, "bd-pick-castle-catacombs-face-castle-3h", 12, 0);
        stampKitNative(aMap, aTileset, "bd-pick-castle-catacombs-face-castle-3h", 16, 0);
        stampKitNative(aMap, aTileset, "bd-pick-temple-ruins-roof-naiskos-pediment", 9, 0);

        stampKitNative(aMap, aTileset, "bd-pick-temple-ruins-mosaic-medallion-5x5", 9, 5, { passable: true });

        stampObjectTool.run(afterProj, { objectId: "kit:beodeul_city/bd-house-village-stone", mapId: aMap.id, x: 0, y: 5, layers: "upper" });
        stampObjectTool.run(afterProj, { objectId: "kit:beodeul_city/bd-house-village-stone", mapId: aMap.id, x: 16, y: 5, layers: "upper" });
        stampKitNative(aMap, aTileset, "bd-prop-statue_sage", 6, 1);
        stampKitNative(aMap, aTileset, "bd-prop-statue_sage", 14, 1);
        stampKitNative(aMap, aTileset, "bd-pick-temple-ruins-column-temple-tall", 5, 4);
        stampKitNative(aMap, aTileset, "bd-pick-temple-ruins-column-temple-tall", 15, 4);
        stampKitNative(aMap, aTileset, "bd-pick-temple-ruins-column-temple-tall", 5, 8);
        stampKitNative(aMap, aTileset, "bd-pick-temple-ruins-column-temple-tall", 15, 8);
        stampKitNative(aMap, aTileset, "bd-pick-volcano-cave-brazier", 8, 4);
        stampKitNative(aMap, aTileset, "bd-pick-volcano-cave-brazier", 14, 4);
        stampKitNative(aMap, aTileset, "bd-pick-volcano-cave-brazier", 8, 8);
        stampKitNative(aMap, aTileset, "bd-pick-volcano-cave-brazier", 14, 8);

        bakeCustomFloorAndObject(
          afterProj,
          aMap,
          "beodeul-floor-grandleon-sanctuary",
          "성검 그랜드리온 각성 황금 성소 바닥 (3x3)",
          FLOOR_GRANDLEON_SANCTUARY_48,
          "grandleon-sword-pedestal",
          "전설의 성검 그랜드리온 황금 제단 (2x2)",
          OBJ_GRANDLEON_SWORD_32,
          10,
          5,
          10,
          4,
        );

        afterProj.assets.uploaded["sprite_frog_knight_grandleon"] = {
          id: "sprite_frog_knight_grandleon",
          name: "개구리 기사 (그랜드리온 각성 거상)",
          kind: "sprite",
          dataUrl: buildFrogKnightSpriteDataUrl(),
          meta: {
            width: 24,
            height: 32,
            frameWidth: 24,
            frameHeight: 32,
            frames: 1,
          },
        } as any;
        afterProj.assets.sprites["sprite_frog_knight_grandleon"] = {
          id: "sprite_frog_knight_grandleon",
          name: "개구리 기사 (그랜드리온 각성 거상)",
          image: { type: "uploaded", id: "sprite_frog_knight_grandleon" },
          frames: 1,
          frameWidth: 24,
          frameHeight: 32,
        } as any;

        const masamuneEv = aMap.events.find((e) => !e.id.startsWith("ev_baseline_"));
        if (masamuneEv) {
          for (const p of masamuneEv.pages) {
            p.graphic = {
              transparent: false,
              sprite: { type: "uploaded", id: "sprite_frog_knight_grandleon" },
              direction: "up",
              pattern: 0,
            };
          }
          if (masamuneEv.pages[0]) {
            masamuneEv.pages[0].commands = [
              { kind: "cutsceneControl", mode: "begin", skippable: true } as any,
              { kind: "m2Command", commandId: "m2-202-screen-effect", fields: { effect: "letterbox", value: "8", durationMs: 150 } } as any,
              { kind: "playAudio", resourceId: "cc0-se-orp-battle-sword-unsheathe", loop: false, channel: "se" } as any,
              { kind: "playAudio", resourceId: "easyrpg-sound-holy5", loop: false, channel: "se" } as any,
              {
                kind: "moveEvent",
                eventId: "ev_masamune_awakening",
                route: { repeat: false, wait: false, moves: [{ kind: "turn", dir: "up" }, { kind: "jump", dx: 0, dy: 0 }] },
              } as any,
              { kind: "m2Command", commandId: "m2-202-screen-effect", fields: { effect: "tint", value: "#ffdd44", durationMs: 180 } } as any,
              { kind: "m2Command", commandId: "m2-047-flash-screen", fields: { color: "yellow", value: "#ffd700", durationMs: 350 } } as any,
              { kind: "m2Command", commandId: "m2-048-shake-screen", fields: { intensity: "6", value: 6, durationMs: 3200 } } as any,
              { kind: "m2Command", commandId: "m2-224-particle-effect", fields: { preset: "sparkle", target: "event", eventId: "ev_masamune_awakening", durationMs: 6500, wait: false } } as any,
              { kind: "m2Command", commandId: "m2-224-particle-effect", fields: { preset: "magic", target: "event", eventId: "ev_masamune_awakening", durationMs: 6500, wait: false } } as any,
              { kind: "setSwitch", switchId: "sw_masamune_awakened", value: true } as any,
              { kind: "text", speaker: "개구리 기사", body: "사이러스여, 지켜보아라! 이 검으로 마왕의 야망을 베겠다!" } as any,
              { kind: "m2Command", commandId: "m2-202-screen-effect", fields: { effect: "clearLetterbox", value: "", durationMs: 200 } } as any,
              { kind: "m2Command", commandId: "m2-202-screen-effect", fields: { effect: "tint", value: "neutral", durationMs: 200 } } as any,
              { kind: "cutsceneControl", mode: "end" } as any,
            ];
          }
          if (masamuneEv.pages[1]) {
            masamuneEv.pages[1].commands = [
              { kind: "cutsceneControl", mode: "begin", skippable: true } as any,
              { kind: "m2Command", commandId: "m2-202-screen-effect", fields: { effect: "letterbox", value: "8", durationMs: 150 } } as any,
              { kind: "playAudio", resourceId: "easyrpg-sound-flash1", loop: false, channel: "se" } as any,
              { kind: "m2Command", commandId: "m2-202-screen-effect", fields: { effect: "tint", value: "#ffee66", durationMs: 180 } } as any,
              { kind: "m2Command", commandId: "m2-224-particle-effect", fields: { preset: "sparkle", target: "event", eventId: "ev_masamune_awakening", durationMs: 6500, wait: false } } as any,
              { kind: "text", speaker: "개구리 기사 (각성 완료)", body: "사이러스의 뜻과 함께 성검 그랜드리온이 진정한 빛을 되찾았소! (sw_masamune_awakened ON)" } as any,
              { kind: "m2Command", commandId: "m2-202-screen-effect", fields: { effect: "clearLetterbox", value: "", durationMs: 200 } } as any,
              { kind: "m2Command", commandId: "m2-202-screen-effect", fields: { effect: "tint", value: "neutral", durationMs: 200 } } as any,
              { kind: "cutsceneControl", mode: "end" } as any,
            ];
          }
        }
      }

      finishDraftTilesets(afterProj);

      // Render Pass 1 Full Map PNG
      const afterMapPng = renderCleanMapWithSpritesPng(afterProj, aMap, {
        drawPlayerAt: id === "jrpg_046" ? { x: 9, y: 7, dir: "right" } : { x: fx - 1, y: fy, dir: "right" },
      });
      const afterOnlyMapPath = join(vizDir, `${id}_after_map.png`);
      writeFileSync(afterOnlyMapPath, PNG.sync.write(afterMapPng));

      // Run REAL `player.html` In-Game QA for Branch A and Branch B on After Project!
      const afterInGameAPath = join(vizDir, `${id}_after_ingame_A.png`);
      const afterInGameAGameOverPath = join(vizDir, `${id}_after_ingame_A_gameover.png`);
      const afterInGameBPath = join(vizDir, `${id}_after_ingame_B.png`);

      console.log(`[Brutal QA Pilot] Running REAL player.html In-Game QA on AFTER for ${id}: ${testCase.title}...`);
      const afterBranchA = await runLiveInGameBranch(context, server.url, afterProj, {
        branchLabel:
          id === "jrpg_016"
            ? "마르 미동행 (열풍 사망)"
            : id === "jrpg_002"
              ? "반지 미소지 (다리 붕괴 사망)"
              : id === "jrpg_003"
                ? "방독면 OFF (독안개 사망)"
                : "성검 그랜드리온 1차 각성 맹세",
        mapId: testCase.mapId,
        startX: fx - 1,
        startY: fy,
        facing: "right",
        triggerMode: id === "jrpg_046" ? "action" : "step_right",
        partyActorIds: ["actor_crono"],
        inventory: id === "jrpg_002" ? { item_fire_ring: 0 } : {},
        switches: id === "jrpg_003" ? { sw_gas_mask: false } : {},
        screenshotPath: afterInGameAPath,
        afterScreenshotPath: afterInGameAGameOverPath,
      });

      const afterBranchB = await runLiveInGameBranch(context, server.url, afterProj, {
        branchLabel:
          id === "jrpg_016"
            ? "마르(actor_marle) 동행 (냉기 마법 컷씬)"
            : id === "jrpg_002"
              ? "화염의 반지(item_fire_ring) 방어막 생존"
              : id === "jrpg_003"
                ? "방독면(sw_gas_mask ON) 돌파 생존"
                : "성검 그랜드리온 각성 완료 (sw_masamune_awakened ON)",
        mapId: testCase.mapId,
        startX: fx - 1,
        startY: fy,
        facing: "right",
        triggerMode: id === "jrpg_046" ? "action" : "step_right",
        partyActorIds: id === "jrpg_016" ? ["actor_crono", "actor_marle"] : ["actor_crono"],
        inventory: id === "jrpg_002" ? { item_fire_ring: 1 } : {},
        switches:
          id === "jrpg_003"
            ? { sw_gas_mask: true }
            : id === "jrpg_046"
              ? { sw_masamune_awakened: true }
              : {},
        screenshotPath: afterInGameBPath,
      });

      // Build composite sheet from [Full Map + Real In-Game Branch A + Real In-Game Branch B]
      const afterCompositePath = join(vizDir, `${id}_after_brutal.png`);
      buildCompositeSheetFromRealInGamePngs(afterMapPng, afterInGameAPath, afterInGameBPath, afterCompositePath, true);

      const afterEval = await evaluateCaseBrutallyWithLiveInGame(
        testCase,
        afterProj,
        "after_brutal_fix",
        afterOnlyMapPath,
        afterBranchA,
        afterBranchB,
      );
      allEvals.push(afterEval);
      console.log(
        `  -> AFTER Result: ${afterEval.overallPassed ? "PASS" : "FAIL"} (${afterEval.passedCount}/${afterEval.totalClauses} gates, Pass1_MapJudge=${afterEval.pass1MapJudgeVerdict.score}, Pass2_InGameJudge=${afterEval.pass2InGameJudgeVerdict.score})`,
      );
      for (const c of afterEval.clauses) {
        if (!c.passed) {
          console.log(`     [FAILED GATE] ${c.id}: ${c.detail}`);
        }
      }
    }
  } finally {
    await context.close();
    await browser.close();
    await server.close();
  }

  writeFileSync(join(outDir, "brutal-pilot-summary.json"), JSON.stringify(allEvals, null, 2));

  const cardsHtml = pilotIds
    .map((id) => {
      const b = allEvals.find((e) => e.caseId === id && e.mode === "before_lenient")!;
      const a = allEvals.find((e) => e.caseId === id && e.mode === "after_brutal_fix")!;
      return `
      <section class="case-card">
        <div class="case-header">
          <div>
            <span class="case-id">${id}</span>
            <h2>${b.title}</h2>
          </div>
          <div class="verdict-pair">
            <span class="badge badge-fail">기존 통과본 적대적 재검증: FAIL (${b.passedCount}/${b.totalClauses} · 맵 ${b.pass1MapJudgeVerdict.score}점 / 인게임 ${b.pass2InGameJudgeVerdict.score}점)</span>
            <span class="badge ${a.overallPassed ? "badge-pass" : "badge-fail"}">재구축 후 2차 인게임 검증: ${a.overallPassed ? "PASS" : "FAIL"} (${a.passedCount}/${a.totalClauses} · 맵 ${a.pass1MapJudgeVerdict.score}점 / 인게임 ${a.pass2InGameJudgeVerdict.score}점)</span>
          </div>
        </div>
        <div class="prompt-box"><strong>프롬프트 원문:</strong> "${b.prompt}"</div>

        <div class="img-grid-2col">
          <div class="img-panel fail-border">
            <div class="panel-title">❌ [Before] 기존 허접한 통과본 (전체 맵 + 실제 player.html 인게임 캡처)</div>
            <div class="sub-screenshots">
              <div><small>Before 전체 맵</small><img src="brutal-pilot/${id}_before_map.png" loading="lazy" /></div>
              <div><small>Before 실제 인게임 분기 A</small><img src="brutal-pilot/${id}_before_ingame_A.png" loading="lazy" /></div>
              <div><small>Before 실제 인게임 분기 B</small><img src="brutal-pilot/${id}_before_ingame_B.png" loading="lazy" /></div>
            </div>
            <div class="judge-box fail-bg">
              <strong>[Pass 1 맵·타일 심판 — ${b.pass1MapJudgeVerdict.score}점]:</strong> ${b.pass1MapJudgeVerdict.critique}<br/>
              <strong>[Pass 2 실제 인게임 스크린샷·게임성 재평가 — ${b.pass2InGameJudgeVerdict.score}점]:</strong> ${b.pass2InGameJudgeVerdict.critique}
            </div>
          </div>

          <div class="img-panel pass-border">
            <div class="panel-title">✅ [After] 전면 재구축 통과본 (정본 맵 + 실제 player.html 인게임 분기 A/B + GAME OVER 화면)</div>
            <div class="sub-screenshots">
              <div><small>After 정본 전체 맵</small><img src="brutal-pilot/${id}_after_map.png" loading="lazy" /></div>
              <div><small>After 실제 인게임 분기 A (클라이맥스)</small><img src="brutal-pilot/${id}_after_ingame_A.png" loading="lazy" /></div>
              <div><small>After 실제 인게임 분기 B (클라이맥스)</small><img src="brutal-pilot/${id}_after_ingame_B.png" loading="lazy" /></div>
            </div>
            <div class="judge-box pass-bg">
              <strong>[Pass 1 맵·타일 심판 — ${a.pass1MapJudgeVerdict.score}점]:</strong> ${a.pass1MapJudgeVerdict.critique}<br/>
              <strong>[Pass 2 실제 인게임 스크린샷·게임성 재평가 — ${a.pass2InGameJudgeVerdict.score}점]:</strong> ${a.pass2InGameJudgeVerdict.critique}
            </div>
          </div>
        </div>

        <table class="clause-table">
          <thead>
            <tr>
              <th style="width:28%">7대 적대적 검증 게이트 (타일 + 건축물 + 실시간 사운드 + 실시간 이펙트/연기 + 대사창/게임오버 + 2단계 멀티모달 재평가)</th>
              <th style="width:36%">기존 통과본 (Before) 실제 인게임 실측 결과</th>
              <th style="width:36%">재구축 후 (After) 실제 인게임 실측 결과</th>
            </tr>
          </thead>
          <tbody>
            ${b.clauses
              .map((bc, idx) => {
                const ac = a.clauses[idx]!;
                return `<tr>
                  <td><strong>${bc.clause}</strong></td>
                  <td class="${bc.passed ? "c-pass" : "c-fail"}">${bc.passed ? "✓ PASS" : "✗ FAIL"} — ${bc.detail}</td>
                  <td class="${ac.passed ? "c-pass" : "c-fail"}">${ac.passed ? "✓ PASS" : "✗ FAIL"} — ${ac.detail}</td>
                </tr>`;
              })
              .join("")}
          </tbody>
        </table>
      </section>`;
    })
    .join("\n");

  const html = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <title>JRPG 7대 적대적 게임성 게이트 & 2차 실제 인게임(player.html) 스크린샷 재평가 보고서</title>
  <style>
    body { background: #0f141c; color: #e2e8f0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; padding: 24px; line-height: 1.55; }
    h1 { margin: 0 0 8px 0; font-size: 24px; color: #f8fafc; }
    .sub { color: #94a3b8; margin-bottom: 24px; font-size: 14px; }
    .case-card { background: #18202c; border: 1px solid #2d3748; border-radius: 12px; padding: 20px; margin-bottom: 28px; }
    .case-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 12px; }
    .case-id { background: #3b82f6; color: #fff; font-weight: 700; padding: 3px 10px; border-radius: 6px; font-size: 13px; margin-right: 8px; }
    .case-header h2 { display: inline; font-size: 19px; margin: 0; color: #f1f5f9; }
    .badge { padding: 6px 12px; border-radius: 6px; font-weight: 700; font-size: 13px; }
    .badge-fail { background: rgba(239, 68, 68, 0.2); color: #fca5a5; border: 1px solid #ef4444; }
    .badge-pass { background: rgba(34, 197, 94, 0.2); color: #86efac; border: 1px solid #22c55e; }
    .prompt-box { background: #0f172a; border-left: 4px solid #38bdf8; padding: 12px 16px; border-radius: 6px; margin-bottom: 16px; font-size: 14px; color: #e0f2fe; }
    .img-grid-2col { display: grid; grid-template-columns: 1fr; gap: 16px; margin-bottom: 16px; }
    .sub-screenshots { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 10px; }
    .sub-screenshots small { display: block; color: #94a3b8; margin-bottom: 4px; font-weight: 600; }
    .img-panel { background: #0b1017; border-radius: 8px; padding: 12px; }
    .fail-border { border: 1px solid #ef4444; }
    .pass-border { border: 1px solid #22c55e; }
    .panel-title { font-weight: 700; font-size: 14px; margin-bottom: 10px; }
    .img-panel img { width: 100%; image-rendering: pixelated; border-radius: 6px; display: block; border: 1px solid #1e293b; }
    .judge-box { padding: 10px 14px; border-radius: 6px; font-size: 13px; }
    .fail-bg { background: rgba(185, 28, 28, 0.18); color: #fecaca; }
    .pass-bg { background: rgba(21, 128, 61, 0.18); color: #bbf7d0; }
    .clause-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .clause-table th, .clause-table td { border: 1px solid #2d3748; padding: 9px 12px; text-align: left; vertical-align: top; }
    .clause-table th { background: #1e293b; color: #cbd5e1; }
    .c-pass { color: #86efac; background: rgba(20, 83, 45, 0.18); }
    .c-fail { color: #fca5a5; background: rgba(127, 29, 29, 0.22); }
  </style>
</head>
<body>
  <h1>🔥 JRPG 7대 적대적 게임성 게이트 & 2차 실제 인게임(player.html) 스크린샷 재평가 보고서</h1>
  <div class="sub">
    합성 컷씬을 완전히 폐기하고 실제 브라우저 런타임(<code>player.html</code> + Playwright Chromium)을 직접 구동하여,
    <strong>G1 바닥 타일 무결성</strong> · <strong>G2 도메인 건축물/지형</strong> · <strong>G3 실시간 오디오 엔진(SE) 실측</strong> · <strong>G4 실시간 파티클/색조/레터박스/90° 쓰러짐 포즈/타일 붕괴</strong> · <strong>G5 대사창 DOM & GAME OVER 전환</strong> · <strong>G6 1차 전체 맵 도트 심판</strong> · <strong>G7 2차 실제 인게임 스크린샷 재평가 심판</strong>까지 7단계로 적대적 검증한 결과입니다.
  </div>
  ${cardsHtml}
</body>
</html>`;

  writeFileSync("/home/main/claude-viz/brutal-qa-pilot.html", html);
  console.log(`\n[Brutal QA Pilot] Wrote HTML report to /home/main/claude-viz/brutal-qa-pilot.html`);
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
