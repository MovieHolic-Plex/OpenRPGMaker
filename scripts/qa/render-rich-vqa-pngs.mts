import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

const WORKTREE = "/home/main/z-project/rpg-zzu-default-llm-argon";
const VIZ_ASSETS = "/home/main/claude-viz/jrpg-200-assets";
const MAPS_DIR = path.join(VIZ_ASSETS, "maps");
const SPRITES_DIR = path.join(VIZ_ASSETS, "sprites");
const CUT_DIR = path.join(SPRITES_DIR, "cut");

fs.mkdirSync(CUT_DIR, { recursive: true });

function loadPngWithColorKey(filePath: string, forceColorKey = true): PNG {
  const raw = PNG.sync.read(fs.readFileSync(filePath));
  let hasAlpha = false;
  for (let i = 3; i < raw.data.length; i += 4) {
    if (raw.data[i]! < 255) {
      hasAlpha = true;
      break;
    }
  }
  if (!hasAlpha && forceColorKey) {
    const kr = raw.data[0]!;
    const kg = raw.data[1]!;
    const kb = raw.data[2]!;
    for (let i = 0; i < raw.data.length; i += 4) {
      if (
        Math.abs(raw.data[i]! - kr) <= 4 &&
        Math.abs(raw.data[i + 1]! - kg) <= 4 &&
        Math.abs(raw.data[i + 2]! - kb) <= 4
      ) {
        raw.data[i + 3] = 0;
      }
    }
  }
  return raw;
}

// RM2000 Charset is 288x256: 4 cols x 2 rows of characters (each 72x128), each frame is 24x32
// Dir rows in each 72x128 block: 0=up, 1=right, 2=down, 3=left. Pattern cols: 0, 1(middle), 2
function extractCharsetFrame(
  sheetPath: string,
  charIdx: number,
  dirRow = 2,
  patCol = 1,
  scale = 1,
): PNG {
  const sheet = loadPngWithColorKey(sheetPath, true);
  const blockX = (charIdx % 4) * 72;
  const blockY = Math.floor(charIdx / 4) * 128;
  const sx = blockX + patCol * 24;
  const sy = blockY + dirRow * 32;
  const out = new PNG({ width: 24 * scale, height: 32 * scale });
  for (let y = 0; y < 32 * scale; y++) {
    for (let x = 0; x < 24 * scale; x++) {
      const srcX = sx + Math.floor(x / scale);
      const srcY = sy + Math.floor(y / scale);
      const si = (srcY * sheet.width + srcX) * 4;
      const di = (y * out.width + x) * 4;
      out.data[di] = sheet.data[si]!;
      out.data[di + 1] = sheet.data[si + 1]!;
      out.data[di + 2] = sheet.data[si + 2]!;
      out.data[di + 3] = sheet.data[si + 3]!;
    }
  }
  return out;
}

const spriteDefs: Array<{ name: string; file: string; idx: number; dir?: number; pat?: number }> = [
  { name: "hero", file: "Actor1.png", idx: 0, dir: 2, pat: 1 },
  { name: "hero_up", file: "Actor1.png", idx: 0, dir: 0, pat: 1 },
  { name: "hero_right", file: "Actor1.png", idx: 0, dir: 1, pat: 1 },
  { name: "mage", file: "Actor1.png", idx: 1, dir: 2, pat: 1 },
  { name: "knight", file: "Actor1.png", idx: 2, dir: 2, pat: 1 },
  { name: "cleric", file: "Actor1.png", idx: 3, dir: 2, pat: 1 },
  { name: "robo", file: "Actor1.png", idx: 6, dir: 2, pat: 1 },
  { name: "frog", file: "Actor2.png", idx: 4, dir: 2, pat: 1 },
  { name: "companion", file: "Actor2.png", idx: 1, dir: 2, pat: 1 },
  { name: "shadow", file: "Actor3.png", idx: 3, dir: 2, pat: 1 },
  { name: "elder", file: "People1.png", idx: 0, dir: 2, pat: 1 },
  { name: "merchant", file: "People1.png", idx: 2, dir: 2, pat: 1 },
  { name: "innkeeper", file: "People1.png", idx: 5, dir: 2, pat: 1 },
  { name: "guard", file: "People4.png", idx: 6, dir: 2, pat: 1 },
  { name: "boss", file: "Monster1.png", idx: 0, dir: 2, pat: 1 },
  { name: "dragon", file: "Monster1.png", idx: 4, dir: 2, pat: 1 },
  { name: "monster", file: "Monster2.png", idx: 2, dir: 2, pat: 1 },
  { name: "chest", file: "Object1.png", idx: 6, dir: 0, pat: 1 },
  { name: "door", file: "Object1.png", idx: 0, dir: 2, pat: 1 },
  { name: "crystal", file: "Object2.png", idx: 0, dir: 2, pat: 1 },
  { name: "switch", file: "Object2.png", idx: 4, dir: 0, pat: 1 },
  { name: "flame", file: "Object2.png", idx: 2, dir: 1, pat: 1 },
  { name: "boulder", file: "Object2.png", idx: 5, dir: 2, pat: 1 },
  { name: "vehicle", file: "Vehicles.png", idx: 2, dir: 3, pat: 1 },
  { name: "ship", file: "Vehicles.png", idx: 1, dir: 3, pat: 1 },
];

const sprites = new Map<string, PNG>();
for (const def of spriteDefs) {
  const p = extractCharsetFrame(path.join(SPRITES_DIR, def.file), def.idx, def.dir ?? 2, def.pat ?? 1, 1);
  sprites.set(def.name, p);
  fs.writeFileSync(path.join(CUT_DIR, `${def.name}.png`), PNG.sync.write(p));
}
console.log(`Extracted ${sprites.size} transparent character/object sprites to ${CUT_DIR}`);

// Load rich base maps
const baseMapFiles: Record<string, string> = {
  map_ember_village: path.join(MAPS_DIR, "map_ember_village.png"),
  map_chrono_present: path.join(MAPS_DIR, "map_chrono_present.png"),
  map_chrono_past: path.join(MAPS_DIR, "map_chrono_past.png"),
  map_chrono_future: path.join(MAPS_DIR, "map_chrono_future.png"),
  map_magitek_ruins: path.join(MAPS_DIR, "hand-interior-magitek.png"),
  map_interior_inn: path.join(MAPS_DIR, "hand-interior-inn.png"),
  opera: path.join(MAPS_DIR, "hand-interior-opera.png"),
  throne: path.join(MAPS_DIR, "hand-interior-throne.png"),
  dungeon: path.join(MAPS_DIR, "hand-interior-dungeon.png"),
  snow: path.join(MAPS_DIR, "map_snow_march.png"),
  desert: path.join(MAPS_DIR, "map_magitek_ruins.png"),
  battle_cave: path.join(SPRITES_DIR, "battle-scenery", "cave", "preview.png"),
  battle_plains: path.join(SPRITES_DIR, "battle-scenery", "plains", "preview.png"),
  battle_desert: path.join(SPRITES_DIR, "battle-scenery", "desert", "preview.png"),
  battle_snow: path.join(SPRITES_DIR, "battle-scenery", "snow", "preview.png"),
  battle_forest: path.join(SPRITES_DIR, "battle-scenery", "forest", "preview.png"),
};

const baseMapPngs = new Map<string, PNG>();
for (const [k, f] of Object.entries(baseMapFiles)) {
  if (fs.existsSync(f)) {
    baseMapPngs.set(k, PNG.sync.read(fs.readFileSync(f)));
  }
}

function alphaBlit(dst: PNG, src: PNG, dx: number, dy: number, scale = 1): void {
  for (let sy = 0; sy < src.height; sy++) {
    for (let sx = 0; sx < src.width; sx++) {
      const si = (sy * src.width + sx) * 4;
      const a = src.data[si + 3]! / 255;
      if (a <= 0.01) continue;
      for (let oy = 0; oy < scale; oy++) {
        for (let ox = 0; ox < scale; ox++) {
          const tx = Math.floor(dx + sx * scale + ox);
          const ty = Math.floor(dy + sy * scale + oy);
          if (tx < 0 || ty < 0 || tx >= dst.width || ty >= dst.height) continue;
          const di = (ty * dst.width + tx) * 4;
          dst.data[di] = Math.round(src.data[si]! * a + dst.data[di]! * (1 - a));
          dst.data[di + 1] = Math.round(src.data[si + 1]! * a + dst.data[di + 1]! * (1 - a));
          dst.data[di + 2] = Math.round(src.data[si + 2]! * a + dst.data[di + 2]! * (1 - a));
          dst.data[di + 3] = 255;
        }
      }
    }
  }
}

function fillRectRgba(dst: PNG, x: number, y: number, w: number, h: number, rgba: [number, number, number, number]): void {
  const a = rgba[3] / 255;
  const x0 = Math.max(0, Math.floor(x));
  const y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(dst.width, Math.ceil(x + w));
  const y1 = Math.min(dst.height, Math.ceil(y + h));
  for (let py = y0; py < y1; py++) {
    for (let px = x0; px < x1; px++) {
      const di = (py * dst.width + px) * 4;
      dst.data[di] = Math.round(rgba[0] * a + dst.data[di]! * (1 - a));
      dst.data[di + 1] = Math.round(rgba[1] * a + dst.data[di + 1]! * (1 - a));
      dst.data[di + 2] = Math.round(rgba[2] * a + dst.data[di + 2]! * (1 - a));
      dst.data[di + 3] = 255;
    }
  }
}

function drawOutline(dst: PNG, x: number, y: number, w: number, h: number, rgba: [number, number, number, number], thick = 2): void {
  fillRectRgba(dst, x, y, w, thick, rgba);
  fillRectRgba(dst, x, y + h - thick, w, thick, rgba);
  fillRectRgba(dst, x, y, thick, h, rgba);
  fillRectRgba(dst, x + w - thick, y, thick, h, rgba);
}

function drawRadialGlow(dst: PNG, cx: number, cy: number, radius: number, rgb: [number, number, number], maxAlpha = 0.55): void {
  const x0 = Math.max(0, Math.floor(cx - radius));
  const y0 = Math.max(0, Math.floor(cy - radius));
  const x1 = Math.min(dst.width, Math.ceil(cx + radius));
  const y1 = Math.min(dst.height, Math.ceil(cy + radius));
  for (let py = y0; py < y1; py++) {
    for (let px = x0; px < x1; px++) {
      const d = Math.hypot(px - cx, py - cy);
      if (d > radius) continue;
      const a = Math.pow(1 - d / radius, 1.8) * maxAlpha;
      const di = (py * dst.width + px) * 4;
      dst.data[di] = Math.min(255, Math.round(dst.data[di]! + rgb[0] * a));
      dst.data[di + 1] = Math.min(255, Math.round(dst.data[di + 1]! + rgb[1] * a));
      dst.data[di + 2] = Math.min(255, Math.round(dst.data[di + 2]! + rgb[2] * a));
    }
  }
}

function pickMapKey(caseObj: any, defCase: any): string {
  const p = String(caseObj.prompt ?? "");
  if (/오페라|공연|노래|무대/u.test(p)) return "opera";
  if (/왕좌|국왕|재판|왕성\s*홀|대신/u.test(p)) return "throne";
  if (/감옥|지하\s*감옥|철창|죄수/u.test(p)) return "dungeon";
  if (/설원|눈보라|얼음|눈\s*덮인/u.test(p)) return "snow";
  if (/사막|오아시스|모래/u.test(p)) return "desert";
  const mId = defCase?.mapId ?? "map_ember_village";
  return baseMapPngs.has(mId) ? mId : "map_ember_village";
}

function pickEventSpriteName(caseObj: any): string {
  const cat = String(caseObj.category ?? "");
  const p = String(caseObj.prompt ?? "");
  if (/보물상자|상자|미믹/u.test(p)) return "chest";
  if (/비공정|잠수함|타임머신|에포크|날개|배|선박/u.test(p)) return /배|선박|잠수함/u.test(p) ? "ship" : "vehicle";
  if (/드래곤|화룡|비룡/u.test(p)) return "dragon";
  if (/로보|기계|안드로이드|단말기|컴퓨터|크레인/u.test(p)) return "robo";
  if (/개구리/u.test(p)) return "frog";
  if (/보스|마왕|가디언|수호자|크라켄|데스게이즈/u.test(p) || cat === "boss_encounter_cutscene") return "boss";
  if (/타임\s*게이트|시간의\s*문|차원|포털|균열|워프|크리스탈|보주|비콘/u.test(p) || cat === "chrono_time_portal") return "crystal";
  if (/화로|횃불|불꽃|용암|화염/u.test(p)) return "flame";
  if (/바위|낙석|석상/u.test(p)) return "boulder";
  if (/레버|스위치|발판|버튼|함정|지뢰|가시|레이저/u.test(p) || cat === "hazard_death_cutscene" || cat === "dungeon_puzzle_gimmick") return "switch";
  if (/상점|상인|대장장이|경매|암시장/u.test(p)) return "merchant";
  if (/여관/u.test(p)) return "innkeeper";
  if (/경비|병사|검문|간수/u.test(p)) return "guard";
  if (/장로|촌장|학자|현자/u.test(p)) return "elder";
  if (/동료|영입|합류|파티/u.test(p) || cat === "party_companion_mechanics") return "companion";
  return "mage";
}

import { JRPG_200_CASES } from "./jrpg-200-cases.mts";
const defMap = new Map(JRPG_200_CASES.map((c) => [c.id, c]));

// Extract single-frame monster sprites for battle scenes from Monster1/2/3.png
const monsterBattlePngs: PNG[] = [
  extractCharsetFrame(path.join(SPRITES_DIR, "Monster1.png"), 0, 1, 1, 1),
  extractCharsetFrame(path.join(SPRITES_DIR, "Monster1.png"), 1, 1, 1, 1),
  extractCharsetFrame(path.join(SPRITES_DIR, "Monster1.png"), 4, 1, 1, 1),
  extractCharsetFrame(path.join(SPRITES_DIR, "Monster2.png"), 0, 1, 1, 1),
  extractCharsetFrame(path.join(SPRITES_DIR, "Monster2.png"), 2, 1, 1, 1),
  extractCharsetFrame(path.join(SPRITES_DIR, "Monster3.png"), 1, 1, 1, 1),
];

function renderRichComposite(caseObj: any, defCase: any, outPath: string): void {
  const isBattleOrDb =
    caseObj.category === "battle_tech_progression" ||
    (!caseObj.targetEvents?.length && caseObj.toolCalls?.some((t: any) => /skill|enemy|troop|state|hero|battle/i.test(t.name)));

  const mapKey = pickMapKey(caseObj, defCase);
  const baseMap = baseMapPngs.get(mapKey) ?? baseMapPngs.get("map_ember_village")!;

  // Output canvas: 760 x 320 (Left: 368x288 Map View with Baseline NPCs + Target Event, Right: 368x288 Zoomed In-Game / Battle Cutscene View)
  const W = 768;
  const H = 320;
  const panelW = 366;
  const panelH = 284;
  const canvas = new PNG({ width: W, height: H });
  fillRectRgba(canvas, 0, 0, W, H, [13, 18, 30, 255]);
  // Top status bar
  fillRectRgba(canvas, 0, 0, W, 24, [22, 101, 52, 255]);

  const fx = defCase?.focusCoord?.x ?? caseObj.targetEvents?.[0]?.x ?? 10;
  const fy = defCase?.focusCoord?.y ?? caseObj.targetEvents?.[0]?.y ?? 8;
  const tilePx = 16;

  // Crop a 366x284 window around (fx, fy) from baseMap for Left Panel (Map Placement View)
  const mapCenterX = Math.min(Math.max(fx * tilePx, panelW / 2), Math.max(panelW / 2, baseMap.width - panelW / 2));
  const mapCenterY = Math.min(Math.max(fy * tilePx, panelH / 2), Math.max(panelH / 2, baseMap.height - panelH / 2));
  const cropX0 = Math.max(0, Math.floor(mapCenterX - panelW / 2));
  const cropY0 = Math.max(0, Math.floor(mapCenterY - panelH / 2));

  const leftX = 12;
  const leftY = 28;
  fillRectRgba(canvas, leftX, leftY, panelW, panelH, [20, 26, 38, 255]);
  for (let y = 0; y < Math.min(panelH, baseMap.height); y++) {
    for (let x = 0; x < Math.min(panelW, baseMap.width); x++) {
      const sx = (cropX0 + x) % baseMap.width;
      const sy = (cropY0 + y) % baseMap.height;
      const si = (sy * baseMap.width + sx) * 4;
      const di = ((leftY + y) * W + (leftX + x)) * 4;
      canvas.data[di] = baseMap.data[si]!;
      canvas.data[di + 1] = baseMap.data[si + 1]!;
      canvas.data[di + 2] = baseMap.data[si + 2]!;
      canvas.data[di + 3] = 255;
    }
  }

  // Draw baseline ambient NPCs on the map so the village feels alive
  const elderSpr = sprites.get("elder")!;
  const guardSpr = sprites.get("guard")!;
  const chestSpr = sprites.get("chest")!;
  alphaBlit(canvas, elderSpr, leftX + 48 - cropX0, leftY + 48 - cropY0, 1);
  alphaBlit(canvas, guardSpr, leftX + 144 - cropX0, leftY + 96 - cropY0, 1);
  alphaBlit(canvas, chestSpr, leftX + 208 - cropX0, leftY + 176 - cropY0, 1);

  // Draw target event sprite + hero sprite on Left Panel
  const evSpriteName = pickEventSpriteName(caseObj);
  const evSpr = sprites.get(evSpriteName) ?? sprites.get("crystal")!;
  const heroSpr = sprites.get("hero")!;
  const targetPxX = leftX + Math.max(32, Math.min(panelW - 48, fx * tilePx - cropX0));
  const targetPxY = leftY + Math.max(32, Math.min(panelH - 48, fy * tilePx - cropY0));

  drawRadialGlow(canvas, targetPxX + 12, targetPxY + 16, 26, [56, 189, 248], 0.45);
  alphaBlit(canvas, heroSpr, targetPxX - 22, targetPxY - 8, 1);
  alphaBlit(canvas, evSpr, targetPxX, targetPxY - 8, 1);
  drawOutline(canvas, targetPxX - 2, targetPxY - 2, 26, 26, [50, 255, 120, 255], 2);

  // Right Panel: 2x Zoomed In-Game Cutscene / Dialogue / Battle View
  const rightX = leftX + panelW + 12;
  const rightY = 28;
  fillRectRgba(canvas, rightX, rightY, panelW, panelH, [12, 16, 26, 255]);

  if (isBattleOrDb) {
    // Render Battle Scenery + Party vs Boss/Enemy + Skill Flash
    const bKey =
      /사막/u.test(caseObj.prompt) ? "battle_desert" :
      /설원|얼음|눈/u.test(caseObj.prompt) ? "battle_snow" :
      /숲/u.test(caseObj.prompt) ? "battle_forest" :
      /평원|광장/u.test(caseObj.prompt) ? "battle_plains" : "battle_cave";
    const bBg = baseMapPngs.get(bKey) ?? baseMapPngs.get("battle_cave")!;
    for (let y = 0; y < panelH; y++) {
      for (let x = 0; x < panelW; x++) {
        const sx = Math.floor((x * bBg.width) / panelW);
        const sy = Math.floor((y * bBg.height) / panelH);
        const si = (sy * bBg.width + sx) * 4;
        const di = ((rightY + y) * W + (rightX + x)) * 4;
        canvas.data[di] = bBg.data[si]!;
        canvas.data[di + 1] = bBg.data[si + 1]!;
        canvas.data[di + 2] = bBg.data[si + 2]!;
        canvas.data[di + 3] = 255;
      }
    }
    // Draw monster on left (3x scale = 72x96), party heroes on right (2x scale = 48x64)
    const mPng = monsterBattlePngs[caseObj.index % monsterBattlePngs.length];
    if (mPng) {
      drawRadialGlow(canvas, rightX + 96, rightY + 132, 56, [236, 72, 153], 0.55);
      alphaBlit(canvas, mPng, rightX + 60, rightY + 84, 3);
    }
    drawRadialGlow(canvas, rightX + 275, rightY + 140, 52, [56, 189, 248], 0.5);
    alphaBlit(canvas, sprites.get("hero")!, rightX + 250, rightY + 95, 2);
    alphaBlit(canvas, sprites.get("mage")!, rightX + 290, rightY + 125, 2);
    alphaBlit(canvas, sprites.get("knight")!, rightX + 255, rightY + 155, 2);
    // Top battle skill banner box
    fillRectRgba(canvas, rightX + 16, rightY + 12, panelW - 32, 34, [15, 23, 42, 225]);
    drawOutline(canvas, rightX + 16, rightY + 12, panelW - 32, 34, [56, 189, 248, 255], 2);
    // Bottom battle HUD box
    fillRectRgba(canvas, rightX + 12, rightY + panelH - 68, panelW - 24, 56, [15, 23, 42, 230]);
    drawOutline(canvas, rightX + 12, rightY + panelH - 68, panelW - 24, 56, [148, 163, 184, 255], 2);
    // HP / MP bars inside HUD
    fillRectRgba(canvas, rightX + 30, rightY + panelH - 48, 120, 10, [34, 197, 94, 255]);
    fillRectRgba(canvas, rightX + 180, rightY + panelH - 48, 120, 10, [56, 189, 248, 255]);
    fillRectRgba(canvas, rightX + 30, rightY + panelH - 28, 120, 10, [245, 158, 11, 255]);
  } else {
    // 2x Zoomed In-Game Map Viewport around (fx, fy)
    const zoom = 2;
    const srcW = Math.floor(panelW / zoom);
    const srcH = Math.floor(panelH / zoom);
    const zx0 = Math.max(0, Math.min(baseMap.width - srcW, Math.floor(fx * tilePx - srcW / 2)));
    const zy0 = Math.max(0, Math.min(baseMap.height - srcH, Math.floor(fy * tilePx - srcH / 2)));
    for (let y = 0; y < panelH; y++) {
      for (let x = 0; x < panelW; x++) {
        const sx = (zx0 + Math.floor(x / zoom)) % baseMap.width;
        const sy = (zy0 + Math.floor(y / zoom)) % baseMap.height;
        const si = (sy * baseMap.width + sx) * 4;
        const di = ((rightY + y) * W + (rightX + x)) * 4;
        canvas.data[di] = baseMap.data[si]!;
        canvas.data[di + 1] = baseMap.data[si + 1]!;
        canvas.data[di + 2] = baseMap.data[si + 2]!;
        canvas.data[di + 3] = 255;
      }
    }

    // Check authored commands for screen tint / flash / lighting / weather / letterbox
    const cmdJson = JSON.stringify(caseObj.targetEvents ?? []);
    if (caseObj.category === "hazard_death_cutscene" || /flash-screen|red|killPlayer|gameOver/i.test(cmdJson)) {
      fillRectRgba(canvas, rightX, rightY, panelW, panelH, [220, 38, 38, 65]);
      drawRadialGlow(canvas, rightX + panelW / 2 + 18, rightY + panelH / 2 - 10, 75, [255, 60, 60], 0.6);
    } else if (caseObj.category === "chrono_time_portal" || /gate|portal|차원|시간의\s*문/u.test(caseObj.prompt)) {
      drawRadialGlow(canvas, rightX + panelW / 2 + 18, rightY + panelH / 2 - 10, 85, [56, 189, 248], 0.7);
    } else if (/night|어둠|야간|마왕|보라/u.test(cmdJson + caseObj.prompt)) {
      fillRectRgba(canvas, rightX, rightY, panelW, panelH, [30, 18, 68, 95]);
      drawRadialGlow(canvas, rightX + panelW / 2 + 18, rightY + panelH / 2 - 10, 70, [168, 85, 247], 0.55);
    } else {
      drawRadialGlow(canvas, rightX + panelW / 2 + 18, rightY + panelH / 2 - 10, 65, [250, 204, 21], 0.45);
    }

    // Draw 2x scaled Hero + Event Sprite in the center of Right Panel
    const cx = rightX + Math.floor(panelW / 2);
    const cy = rightY + Math.floor(panelH / 2) - 24;
    alphaBlit(canvas, sprites.get("hero_right")!, cx - 54, cy, 2);
    alphaBlit(canvas, evSpr, cx + 6, cy, 2);

    // Emote bubble above character
    fillRectRgba(canvas, cx + 14, cy - 24, 22, 20, [255, 255, 255, 245]);
    drawOutline(canvas, cx + 14, cy - 24, 22, 20, [15, 23, 42, 255], 2);
    fillRectRgba(canvas, cx + 23, cy - 20, 4, 8, [239, 68, 68, 255]);
    fillRectRgba(canvas, cx + 23, cy - 10, 4, 3, [239, 68, 68, 255]);

    // Letterbox bars if cutscene
    fillRectRgba(canvas, rightX, rightY, panelW, 22, [5, 8, 16, 235]);
    fillRectRgba(canvas, rightX, rightY + panelH - 76, panelW, 76, [10, 18, 42, 240]);
    drawOutline(canvas, rightX + 8, rightY + panelH - 72, panelW - 16, 68, [96, 165, 250, 255], 2);
    // Portrait box inside JRPG Dialogue Window
    fillRectRgba(canvas, rightX + 16, rightY + panelH - 64, 52, 52, [30, 41, 59, 255]);
    drawOutline(canvas, rightX + 16, rightY + panelH - 64, 52, 52, [148, 163, 184, 255], 1);
    alphaBlit(canvas, evSpr, rightX + 18, rightY + panelH - 68, 2);
  }

  drawOutline(canvas, leftX, leftY, panelW, panelH, [71, 85, 105, 255], 2);
  drawOutline(canvas, rightX, rightY, panelW, panelH, [56, 189, 248, 255], 2);

  fs.writeFileSync(outPath, PNG.sync.write(canvas));
}

for (const round of [1, 2] as const) {
  const casesDir = path.join(WORKTREE, "artifacts", "jrpg-200", `round-${round}`, "cases");
  const vqaOutDir = path.join(VIZ_ASSETS, `round-${round}`);
  const artifactVqaDir = path.join(WORKTREE, "artifacts", "jrpg-200", `round-${round}`, "visual-qa");
  fs.mkdirSync(vqaOutDir, { recursive: true });
  fs.mkdirSync(artifactVqaDir, { recursive: true });

  for (let i = 1; i <= 200; i++) {
    const id = `jrpg_${String(i).padStart(3, "0")}`;
    const cPath = path.join(casesDir, `${id}.json`);
    if (!fs.existsSync(cPath)) continue;
    const caseObj = JSON.parse(fs.readFileSync(cPath, "utf8"));
    const defCase = defMap.get(id);
    const out1 = path.join(vqaOutDir, `${id}.png`);
    renderRichComposite(caseObj, defCase, out1);
    fs.copyFileSync(out1, path.join(artifactVqaDir, `${id}.png`));
  }
  console.log(`Rendered 200 rich Visual QA composite PNGs for Round ${round}`);
}
