/**
 * Permanent generator for docs/interior-wall-frame-cases/*.png (Option B contract).
 *
 * Every grid on every image comes from a real API:
 *   - house stores  → planInteriorHouseWalls (the pipeline's sole house wall writer)
 *   - dark renders  → chipsetQuarterComposition → interiorDarkWallQuarterComposition
 *   - retint faces  → retintHouseWallFace
 *   - role/atlas ids → HOUSE_SHELL_TILE / DARK_WALL_TILE / DARK_WALL_QUARTER_SOURCE
 *
 * Nothing here hand-assembles a tile layout. If the contract changes, re-run this and the
 * PNGs follow the code:
 *
 *   bun scripts/render-interior-wall-contract-cases.mts
 */
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import {
  planInteriorHouseWalls,
  type InteriorHouseWallInput,
} from "../src/editor/interiorHouseWallGrammar.ts";
import { retintHouseWallFace } from "../src/editor/interiorRoomPipeline.ts";
import {
  createDarkWallAutotileGroup,
  DARK_WALL_QUARTER_SOURCE,
  DARK_WALL_TILE,
} from "../src/project/defaults/darkWallAutotile.ts";
import {
  HOUSE_SHELL_FORBIDDEN_TILES,
  HOUSE_SHELL_TILE,
} from "../src/project/defaults/interiorHouseWallTiles.ts";
import { chipsetQuarterComposition } from "../src/project/defaults/terrainQuarterAutotile.ts";
import { INTERIOR_TEXTURE_KEY } from "../src/project/tilesetHarness/themePacks.ts";
import type { GameMap, TilesetDef } from "../src/project/types.ts";

const TILE = 16;
const COLS = 30;
const SCALE = 3;
const CELL = TILE * SCALE;
const OUT_DIR = path.resolve("docs/interior-wall-frame-cases");
const CHIPSET = "public/assets/easyrpg-chipset-interior-transparent.png";
const H_CAP = HOUSE_SHELL_TILE.capStraight;
const H_JOINT_NW = HOUSE_SHELL_TILE.capJointNW;

const C = {
  bg: [14, 19, 25],
  panel: [23, 30, 40],
  line: [44, 56, 72],
  text: [231, 238, 247],
  muted: [147, 164, 184],
  house: [107, 207, 142], // store: house whole tile
  dark: [90, 167, 224], //   store: dark 366
  source: [224, 179, 90], // render-only quarter source
  bad: [232, 106, 106], //   forbidden
} as const;

type RGB = readonly [number, number, number] | readonly number[];
type MapView = { readonly width: number; readonly height: number; readonly lowerTiles: number[] };

const chip = PNG.sync.read(fs.readFileSync(CHIPSET));

/** Interior tileset stub — the dark group is what gates quarter composition. */
const TILESET: Pick<TilesetDef, "autotileGroups" | "image"> = {
  image: { type: "bundled", id: INTERIOR_TEXTURE_KEY },
  autotileGroups: [createDarkWallAutotileGroup()],
};

// ── pixel helpers ───────────────────────────────────────────────────────────

function makePng(width: number, height: number, fill: RGB = C.bg): PNG {
  const png = new PNG({ width, height });
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = fill[0]!;
    png.data[i + 1] = fill[1]!;
    png.data[i + 2] = fill[2]!;
    png.data[i + 3] = 255;
  }
  return png;
}

function px(dst: PNG, x: number, y: number, color: RGB): void {
  if (x < 0 || y < 0 || x >= dst.width || y >= dst.height) return;
  const i = (y * dst.width + x) * 4;
  dst.data[i] = color[0]!;
  dst.data[i + 1] = color[1]!;
  dst.data[i + 2] = color[2]!;
  dst.data[i + 3] = 255;
}

function fillRect(dst: PNG, x: number, y: number, w: number, h: number, color: RGB): void {
  for (let dy = 0; dy < h; dy += 1) for (let dx = 0; dx < w; dx += 1) px(dst, x + dx, y + dy, color);
}

function strokeRect(dst: PNG, x: number, y: number, w: number, h: number, color: RGB, weight = 1): void {
  for (let t = 0; t < weight; t += 1) {
    for (let dx = 0; dx < w; dx += 1) {
      px(dst, x + dx, y + t, color);
      px(dst, x + dx, y + h - 1 - t, color);
    }
    for (let dy = 0; dy < h; dy += 1) {
      px(dst, x + t, y + dy, color);
      px(dst, x + w - 1 - t, y + dy, color);
    }
  }
}

/** Blit a chipset tile (or one 8×8 quarter of it) with alpha skip. */
function blitTile(
  dst: PNG,
  tile: number,
  dx: number,
  dy: number,
  scale: number,
  quarter?: { sx: number; sy: number; sw: number; sh: number },
): void {
  if (tile < 0) return;
  const sx0 = (tile % COLS) * TILE + (quarter?.sx ?? 0);
  const sy0 = Math.floor(tile / COLS) * TILE + (quarter?.sy ?? 0);
  const sw = quarter?.sw ?? TILE;
  const sh = quarter?.sh ?? TILE;
  for (let y = 0; y < sh * scale; y += 1) {
    for (let x = 0; x < sw * scale; x += 1) {
      const si = ((sy0 + Math.floor(y / scale)) * chip.width + (sx0 + Math.floor(x / scale))) * 4;
      if (chip.data[si + 3] === 0) continue;
      px(dst, dx + x, dy + y, [chip.data[si]!, chip.data[si + 1]!, chip.data[si + 2]!]);
    }
  }
}

// ── 3×5 bitmap font ─────────────────────────────────────────────────────────

const FONT: Record<string, readonly string[]> = {
  "0": ["###", "# #", "# #", "# #", "###"],
  "1": [" # ", "## ", " # ", " # ", "###"],
  "2": ["###", "  #", "###", "#  ", "###"],
  "3": ["###", "  #", "###", "  #", "###"],
  "4": ["# #", "# #", "###", "  #", "  #"],
  "5": ["###", "#  ", "###", "  #", "###"],
  "6": ["###", "#  ", "###", "# #", "###"],
  "7": ["###", "  #", "  #", "  #", "  #"],
  "8": ["###", "# #", "###", "# #", "###"],
  "9": ["###", "# #", "###", "  #", "###"],
  A: ["###", "# #", "###", "# #", "# #"],
  B: ["## ", "# #", "## ", "# #", "## "],
  C: ["###", "#  ", "#  ", "#  ", "###"],
  D: ["## ", "# #", "# #", "# #", "## "],
  E: ["###", "#  ", "###", "#  ", "###"],
  F: ["###", "#  ", "###", "#  ", "#  "],
  G: ["###", "#  ", "# #", "# #", "###"],
  H: ["# #", "# #", "###", "# #", "# #"],
  I: ["###", " # ", " # ", " # ", "###"],
  J: ["  #", "  #", "  #", "# #", "###"],
  K: ["# #", "# #", "## ", "# #", "# #"],
  L: ["#  ", "#  ", "#  ", "#  ", "###"],
  M: ["# #", "###", "###", "# #", "# #"],
  N: ["# #", "###", "###", "###", "# #"],
  O: ["###", "# #", "# #", "# #", "###"],
  P: ["###", "# #", "###", "#  ", "#  "],
  Q: ["###", "# #", "# #", "###", "  #"],
  R: ["###", "# #", "###", "## ", "# #"],
  S: ["###", "#  ", "###", "  #", "###"],
  T: ["###", " # ", " # ", " # ", " # "],
  U: ["# #", "# #", "# #", "# #", "###"],
  V: ["# #", "# #", "# #", "# #", " # "],
  W: ["# #", "# #", "###", "###", "# #"],
  X: ["# #", "# #", " # ", "# #", "# #"],
  Y: ["# #", "# #", "###", " # ", " # "],
  Z: ["###", "  #", " # ", "#  ", "###"],
  " ": ["   ", "   ", "   ", "   ", "   "],
  "-": ["   ", "   ", "###", "   ", "   "],
  "/": ["  #", "  #", " # ", "#  ", "#  "],
  "|": [" # ", " # ", " # ", " # ", " # "],
  ":": ["   ", " # ", "   ", " # ", "   "],
  ".": ["   ", "   ", "   ", "   ", " # "],
  ",": ["   ", "   ", "   ", " # ", "#  "],
  "+": ["   ", " # ", "###", " # ", "   "],
  "=": ["   ", "###", "   ", "###", "   "],
  "!": [" # ", " # ", " # ", "   ", " # "],
  "?": ["###", "  #", " ##", "   ", " # "],
  "(": [" ##", " # ", " # ", " # ", " ##"],
  ")": ["## ", " # ", " # ", " # ", "## "],
  "#": ["# #", "###", "# #", "###", "# #"],
  "*": ["# #", " # ", "# #", "   ", "   "],
  "<": ["  #", " # ", "#  ", " # ", "  #"],
  ">": ["#  ", " # ", "  #", " # ", "#  "],
};

function textWidth(text: string, scale: number): number {
  return text.length * 4 * scale - scale;
}

function drawText(dst: PNG, text: string, x: number, y: number, scale: number, color: RGB): void {
  let cx = x;
  for (const ch of text.toUpperCase()) {
    const glyph = FONT[ch] ?? FONT["?"]!;
    for (let gy = 0; gy < glyph.length; gy += 1) {
      const row = glyph[gy]!;
      for (let gx = 0; gx < row.length; gx += 1) {
        if (row[gx] !== "#") continue;
        fillRect(dst, cx + gx * scale, y + gy * scale, scale, scale, color);
      }
    }
    cx += 4 * scale;
  }
}

/** Text with a 1px dark halo so ids stay readable on busy chipset pixels. */
function drawLabel(dst: PNG, text: string, x: number, y: number, scale: number, color: RGB): void {
  for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]] as const) {
    drawText(dst, text, x + ox, y + oy, scale, [0, 0, 0]);
  }
  drawText(dst, text, x, y, scale, color);
}

// ── map rendering ───────────────────────────────────────────────────────────

/** Production render path: quarter composition when it applies, plain whole tile otherwise. */
function drawMapRender(dst: PNG, map: MapView, ox: number, oy: number): void {
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      const lower = map.lowerTiles[y * map.width + x]!;
      const dx = ox + x * CELL;
      const dy = oy + y * CELL;
      const composition = chipsetQuarterComposition(map, TILESET, x, y);
      if (composition) {
        blitTile(dst, composition.underlayTile ?? lower, dx, dy, SCALE);
        for (const src of composition.sources) {
          blitTile(dst, src.tile, dx + src.offsetX * SCALE, dy + src.offsetY * SCALE, SCALE, {
            sx: src.offsetX,
            sy: src.offsetY,
            sw: 8,
            sh: 8,
          });
        }
      } else {
        blitTile(dst, lower, dx, dy, SCALE);
      }
    }
  }
}

function tileTint(tile: number): RGB {
  if (HOUSE_SHELL_FORBIDDEN_TILES.includes(tile)) return C.bad;
  if (tile === DARK_WALL_TILE.BODY) return C.dark;
  if (tile === HOUSE_SHELL_TILE.void || tile === HOUSE_SHELL_TILE.floor) return C.muted;
  if ((Object.values(HOUSE_SHELL_TILE) as number[]).includes(tile)) return C.house;
  if ((Object.values(DARK_WALL_QUARTER_SOURCE) as number[]).includes(tile)) return C.source;
  return C.muted;
}

/** Store grid: plain whole tiles + the stored id printed on every cell. */
function drawMapStore(dst: PNG, map: MapView, ox: number, oy: number): void {
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      const tile = map.lowerTiles[y * map.width + x]!;
      const dx = ox + x * CELL;
      const dy = oy + y * CELL;
      fillRect(dst, dx, dy, CELL, CELL, C.panel);
      blitTile(dst, tile, dx, dy, SCALE);
      strokeRect(dst, dx, dy, CELL, CELL, C.line);
      const label = String(tile);
      drawLabel(dst, label, dx + (CELL - textWidth(label, 2)) / 2, dy + CELL / 2 - 5, 2, tileTint(tile));
    }
  }
}

// ── panel layout ────────────────────────────────────────────────────────────

type Panel =
  | { readonly kind: "store"; readonly label: string; readonly map: MapView }
  | { readonly kind: "render"; readonly label: string; readonly map: MapView }
  | { readonly kind: "atlas"; readonly label: string; readonly rows: readonly (readonly number[])[]; readonly captions?: Readonly<Record<number, string>> }
  | { readonly kind: "cards"; readonly label: string; readonly cards: readonly Card[]; readonly perRow: number };

type Card = { readonly tile: number; readonly name: string; readonly tint: RGB };

const PAD = 16;
const TITLE_H = 34;
const PANEL_LABEL_H = 16;
const GAP = 18;

function panelSize(panel: Panel): { w: number; h: number } {
  const body = ((): { w: number; h: number } => {
    if (panel.kind === "store" || panel.kind === "render") {
      return { w: panel.map.width * CELL, h: panel.map.height * CELL };
    }
    if (panel.kind === "atlas") {
      const cols = Math.max(...panel.rows.map((r) => r.length));
      const capH = panel.captions ? 12 : 0;
      return { w: cols * CELL, h: panel.rows.length * (CELL + capH) };
    }
    const rows = Math.ceil(panel.cards.length / panel.perRow);
    return { w: panel.perRow * (CELL + 8), h: rows * (CELL + 22) };
  })();
  // A narrow panel must still reserve room for its own caption, or the next label overlaps it.
  return { w: Math.max(body.w, textWidth(panel.label, 2)), h: body.h };
}

function drawPanel(dst: PNG, panel: Panel, ox: number, oy: number): void {
  drawText(dst, panel.label, ox, oy, 2, C.muted);
  const y = oy + PANEL_LABEL_H;
  if (panel.kind === "store") drawMapStore(dst, panel.map, ox, y);
  else if (panel.kind === "render") drawMapRender(dst, panel.map, ox, y);
  else if (panel.kind === "atlas") {
    const capH = panel.captions ? 12 : 0;
    for (let r = 0; r < panel.rows.length; r += 1) {
      const row = panel.rows[r]!;
      for (let c = 0; c < row.length; c += 1) {
        const tile = row[c]!;
        const dx = ox + c * CELL;
        const dy = y + r * (CELL + capH);
        fillRect(dst, dx, dy, CELL, CELL, C.panel);
        blitTile(dst, tile, dx, dy, SCALE);
        strokeRect(dst, dx, dy, CELL, CELL, tileTint(tile));
        const id = String(tile);
        drawLabel(dst, id, dx + 2, dy + 2, 2, tileTint(tile));
        const cap = panel.captions?.[tile];
        if (cap) drawText(dst, cap, dx, dy + CELL + 2, 1, C.muted);
      }
    }
  } else {
    for (let i = 0; i < panel.cards.length; i += 1) {
      const card = panel.cards[i]!;
      const dx = ox + (i % panel.perRow) * (CELL + 8);
      const dy = y + Math.floor(i / panel.perRow) * (CELL + 22);
      fillRect(dst, dx, dy, CELL, CELL, C.panel);
      blitTile(dst, card.tile, dx, dy, SCALE);
      strokeRect(dst, dx, dy, CELL, CELL, card.tint, 2);
      drawText(dst, String(card.tile), dx, dy + CELL + 2, 1, card.tint);
      drawText(dst, card.name, dx, dy + CELL + 9, 1, C.muted);
    }
  }
}

function renderCase(title: string, note: string, panels: readonly Panel[]): PNG {
  const sizes = panels.map(panelSize);
  const w = PAD * 2 + sizes.reduce((a, s) => a + s.w, 0) + GAP * (panels.length - 1);
  const h = PAD * 2 + TITLE_H + PANEL_LABEL_H + Math.max(...sizes.map((s) => s.h));
  const png = makePng(Math.max(w, PAD * 2 + textWidth(title, 2)), h);
  drawText(png, title, PAD, PAD, 2, C.text);
  if (note) drawText(png, note, PAD, PAD + 14, 1, C.muted);
  let x = PAD;
  for (let i = 0; i < panels.length; i += 1) {
    drawPanel(png, panels[i]!, x, PAD + TITLE_H);
    x += sizes[i]!.w + GAP;
  }
  return png;
}

function write(name: string, png: PNG): void {
  const out = path.join(OUT_DIR, name);
  fs.writeFileSync(out, PNG.sync.write(png));
  console.log(`[png] ${name} ${png.width}×${png.height}`);
}

// ── grid builders (real APIs only) ──────────────────────────────────────────

function houseGrid(input: InteriorHouseWallInput): MapView {
  const lowerTiles = Array.from({ length: input.width * input.height }, () => HOUSE_SHELL_TILE.void);
  for (const p of planInteriorHouseWalls(input)) lowerTiles[p.y * input.width + p.x] = p.tile;
  return { width: input.width, height: input.height, lowerTiles };
}

function rectMask(W: number, H: number, boxes: readonly { x: number; y: number; w: number; h: number }[]): boolean[] {
  const mask = Array.from({ length: W * H }, () => false);
  for (const b of boxes) {
    for (let y = b.y; y < b.y + b.h; y += 1) for (let x = b.x; x < b.x + b.w; x += 1) mask[y * W + x] = true;
  }
  return mask;
}

function darkGrid(rows: readonly string[]): MapView {
  // '#' = stored dark body 366, '.' = floor 72, ' ' = void 430
  const width = rows[0]!.length;
  const lowerTiles: number[] = [];
  for (const row of rows) {
    for (const ch of row) {
      lowerTiles.push(ch === "#" ? DARK_WALL_TILE.BODY : ch === "." ? HOUSE_SHELL_TILE.floor : HOUSE_SHELL_TILE.void);
    }
  }
  return { width, height: rows.length, lowerTiles };
}

function crop(map: MapView, x0: number, y0: number, w: number, h: number): MapView {
  const lowerTiles: number[] = [];
  for (let y = y0; y < y0 + h; y += 1) {
    for (let x = x0; x < x0 + w; x += 1) lowerTiles.push(map.lowerTiles[y * map.width + x] ?? HOUSE_SHELL_TILE.void);
  }
  return { width: w, height: h, lowerTiles };
}

function asGameMap(map: MapView): GameMap {
  return {
    id: "case",
    name: "case",
    width: map.width,
    height: map.height,
    tilesetId: "easyrpg_chipset_interior",
    tileSize: TILE,
    lowerTiles: [...map.lowerTiles],
    upperTiles: Array.from({ length: map.width * map.height }, () => -1),
    events: [],
  };
}

// Rooms start at y=3 so the cap row (faceBottom - 2) has somewhere to live.
// A room pinned to y<2 clips its own cap off the map and documents nothing.

// Single rect room — the canonical villager-room-v1 shell.
const SINGLE: InteriorHouseWallInput = {
  width: 10,
  height: 11,
  floor: rectMask(10, 11, [{ x: 2, y: 3, w: 6, h: 5 }]),
  door: { x: 5, y: 7 },
};

// Gapless left/right rooms → 1-col partition + inner door.
const TWO_ROOM_V: InteriorHouseWallInput = {
  width: 12,
  height: 11,
  floor: rectMask(12, 11, [{ x: 2, y: 3, w: 4, h: 5 }, { x: 6, y: 3, w: 4, h: 5 }]),
  rooms: [
    { id: "west", x: 2, y: 3, w: 4, h: 5 },
    { id: "east", x: 6, y: 3, w: 4, h: 5 },
  ],
  door: { x: 3, y: 7 },
  innerDoors: [{ x: 5, y: 5 }],
};

// Stacked rooms with a 3-row band between them + a 3-cell inner corridor.
const TWO_ROOM_H: InteriorHouseWallInput = {
  width: 10,
  height: 15,
  floor: rectMask(10, 15, [{ x: 2, y: 3, w: 6, h: 4 }, { x: 2, y: 10, w: 6, h: 3 }]),
  rooms: [
    { id: "north", x: 2, y: 3, w: 6, h: 4 },
    { id: "south", x: 2, y: 10, w: 6, h: 3 },
  ],
  door: { x: 5, y: 12 },
  innerDoors: [{ x: 5, y: 7 }, { x: 5, y: 8 }, { x: 5, y: 9 }],
};

const singleGrid = houseGrid(SINGLE);
const twoRoomVGrid = houseGrid(TWO_ROOM_V);
const twoRoomHGrid = houseGrid(TWO_ROOM_H);

/** A case that clips its own cap/joints off-map illustrates nothing — fail loudly instead. */
for (const [name, grid] of [
  ["single", singleGrid],
  ["two-room-v", twoRoomVGrid],
  ["two-room-h", twoRoomHGrid],
] as const) {
  for (const [role, tile] of [
    ["cap", H_CAP],
    ["cap joint", H_JOINT_NW],
  ] as const) {
    if (!grid.lowerTiles.includes(tile)) throw new Error(`${name} grid is missing its ${role} (${tile})`);
  }
  const forbidden = grid.lowerTiles.filter((t) => HOUSE_SHELL_FORBIDDEN_TILES.includes(t));
  if (forbidden.length > 0) throw new Error(`${name} grid leaked forbidden tiles: ${forbidden.join(",")}`);
}

function retinted(material: "gold-brick" | "stone-brick"): MapView {
  const gm = asGameMap(singleGrid);
  retintHouseWallFace(gm, material);
  return { width: gm.width, height: gm.height, lowerTiles: gm.lowerTiles };
}

// ── cases ───────────────────────────────────────────────────────────────────

fs.mkdirSync(OUT_DIR, { recursive: true });

const H = HOUSE_SHELL_TILE;
const Q = DARK_WALL_QUARTER_SOURCE;

// 1. Raw 3×4 source block — proves the atlas pixels are unchanged.
write(
  "case_chipset_3x4_autotile_block.png",
  renderCase(
    "chipset 3x4 source block - render only",
    "366 store body + 367/368 previews, then the 3x3 frame. these ids are atlas coords, not store values.",
    [
      {
        kind: "atlas",
        label: "sheet rows 12-15 x cols 6-8",
        rows: [
          [366, 367, 368],
          [396, 397, 398],
          [426, 427, 428],
          [456, 457, 458],
        ],
      },
    ],
  ),
);

// 2. 3×3 line-direction reference.
write(
  "case_3x3_body_for_quarters.png",
  renderCase(
    "3x3 quarter source - real line directions",
    "read the pixels, not the old edgeN/edgeS names. this is the reference table for dark quarter sampling.",
    [
      {
        kind: "atlas",
        label: "dark quarter sources",
        rows: [
          [396, 397, 398],
          [426, 427, 428],
          [456, 457, 458],
        ],
        captions: {
          396: "top+left",
          397: "top",
          398: "top+right",
          426: "left",
          427: "body",
          428: "right",
          456: "bottom+left",
          457: "bottom",
          458: "bottom+right",
        },
      },
    ],
  ),
);

// 3. Role cards — store roles vs render-source roles, split.
write(
  "case_role_cards.png",
  renderCase(
    "role cards - store vs render source",
    "green = house whole tile written to lowerTiles. blue = the only dark store id. amber = render-only atlas source.",
    [
      {
        kind: "cards",
        label: "house store (whole tile)",
        perRow: 8,
        cards: [
          { tile: H.creamUpperL, name: "cream ul", tint: C.house },
          { tile: H.creamUpperM, name: "cream um", tint: C.house },
          { tile: H.creamUpperR, name: "cream ur", tint: C.house },
          { tile: H.creamLowerL, name: "cream ll", tint: C.house },
          { tile: H.creamLowerM, name: "cream lm", tint: C.house },
          { tile: H.creamLowerR, name: "cream lr", tint: C.house },
          { tile: H.soloUpper, name: "solo up", tint: C.house },
          { tile: H.soloLower, name: "solo low", tint: C.house },
          { tile: H.capStraight, name: "cap", tint: C.house },
          { tile: H.capJointNW, name: "joint nw", tint: C.house },
          { tile: H.capJointNE, name: "joint ne", tint: C.house },
          { tile: H.postWest, name: "post w", tint: C.house },
          { tile: H.postEast, name: "post e", tint: C.house },
          { tile: H.southTrim, name: "trim/step", tint: C.house },
          { tile: H.southWestCorner, name: "door w", tint: C.house },
          { tile: H.southEastCorner, name: "door e", tint: C.house },
        ],
      },
      {
        kind: "cards",
        label: "dark store",
        perRow: 1,
        cards: [{ tile: DARK_WALL_TILE.BODY, name: "body", tint: C.dark }],
      },
      {
        kind: "cards",
        label: "dark render source (never stored)",
        perRow: 5,
        cards: [
          { tile: Q.center, name: "center", tint: C.source },
          { tile: Q.concave, name: "concave", tint: C.source },
          { tile: Q.edgeN, name: "top", tint: C.source },
          { tile: Q.edgeS, name: "bottom", tint: C.source },
          { tile: Q.edgeW, name: "left", tint: C.source },
          { tile: Q.edgeE, name: "right", tint: C.source },
          { tile: Q.cornerNW, name: "top+left", tint: C.source },
          { tile: Q.cornerNE, name: "top+rght", tint: C.source },
          { tile: Q.cornerSW, name: "bot+left", tint: C.source },
          { tile: Q.cornerSE, name: "bot+rght", tint: C.source },
        ],
      },
    ],
  ),
);

// 4. Role strip — the forbidden three next to the two live contracts.
write(
  "case_role_strip.png",
  renderCase(
    "contract boundary - forbidden vs live",
    "233/258 are pink placeholders and 257 is furniture texture. no wall or door writes them.",
    [
      {
        kind: "cards",
        label: "forbidden - never written",
        perRow: 3,
        cards: HOUSE_SHELL_FORBIDDEN_TILES.map((tile) => ({
          tile,
          name: tile === 257 ? "no door base" : "no cap joint",
          tint: C.bad,
        })),
      },
      {
        kind: "cards",
        label: "house cap joints instead",
        perRow: 3,
        cards: [
          { tile: H.capJointNW, name: "joint nw", tint: C.house },
          { tile: H.capStraight, name: "cap", tint: C.house },
          { tile: H.capJointNE, name: "joint ne", tint: C.house },
        ],
      },
      {
        kind: "cards",
        label: "house door step instead",
        perRow: 3,
        cards: [
          { tile: H.southWestCorner, name: "flank w", tint: C.house },
          { tile: H.southTrim, name: "step", tint: C.house },
          { tile: H.southEastCorner, name: "flank e", tint: C.house },
        ],
      },
      {
        kind: "cards",
        label: "dark store",
        perRow: 1,
        cards: [{ tile: DARK_WALL_TILE.BODY, name: "only 366", tint: C.dark }],
      },
    ],
  ),
);

// 5. 105 ring — negative evidence: plain cream, no auto-shape, no quarters.
{
  const ring: MapView = {
    width: 5,
    height: 5,
    lowerTiles: [
      H.creamLowerM, H.creamLowerM, H.creamLowerM, H.creamLowerM, H.creamLowerM,
      H.creamLowerM, H.floor, H.floor, H.floor, H.creamLowerM,
      H.creamLowerM, H.floor, H.floor, H.floor, H.creamLowerM,
      H.creamLowerM, H.floor, H.floor, H.floor, H.creamLowerM,
      H.creamLowerM, H.creamLowerM, H.creamLowerM, H.creamLowerM, H.creamLowerM,
    ],
  };
  const composed = ring.lowerTiles.filter((_, i) =>
    chipsetQuarterComposition(ring, TILESET, i % ring.width, Math.floor(i / ring.width)) !== null,
  ).length;
  if (composed !== 0) throw new Error(`105 ring must never quarter-compose, got ${composed} cells`);
  write(
    "case_ring_body_105_only.png",
    renderCase(
      "105 is plain cream - not an autotile body",
      "store and render are identical: 105 no longer shapes into edges/corners and no quarter fires on it.",
      [
        { kind: "store", label: "store", map: ring },
        { kind: "render", label: "render (0 quarter cells)", map: ring },
      ],
    ),
  );
}

// 6. House ring corners — 458/456 north joints, 398/396 south, zero pink.
{
  const forbidden = singleGrid.lowerTiles.filter((t) => HOUSE_SHELL_FORBIDDEN_TILES.includes(t)).length;
  if (forbidden !== 0) throw new Error(`house shell leaked ${forbidden} forbidden tiles`);
  write(
    "case_ring_edge_corner_labels.png",
    renderCase(
      "house shell ring - planInteriorHouseWalls output",
      "cap joints 458/456, posts 428/426, south trim 397, door flanks 398/396. no 233/258/257.",
      [
        { kind: "store", label: "store (whole tiles)", map: singleGrid },
        { kind: "render", label: "render (plain - no quarters)", map: singleGrid },
      ],
    ),
  );
}

// 7. North cream face 2-row + cap.
write(
  "case_cream_north_face_2row.png",
  renderCase(
    "north face - cream 2 rows under 457 cap",
    "cropped from the same planInteriorHouseWalls result. run ends take 74/104 and 76/106.",
    [
      { kind: "store", label: "store", map: crop(singleGrid, 1, 0, 8, 4) },
      { kind: "render", label: "render", map: crop(singleGrid, 1, 0, 8, 4) },
    ],
  ),
);

// 8. Door alcove — 398 | floor | 396 with a 397 step and void around it.
write(
  "case_door_alcove_398_396_397.png",
  renderCase(
    "south door alcove - 398 floor 396 over a 397 step",
    "step is 397 only. the old 257 post bases are gone; the diagonals stay real void 430.",
    [
      { kind: "store", label: "store", map: crop(singleGrid, 3, 6, 5, 5) },
      { kind: "render", label: "render", map: crop(singleGrid, 3, 6, 5, 5) },
    ],
  ),
);

// 9. The old 397 conflict, now split by layer.
{
  const houseStep = crop(singleGrid, 4, 7, 3, 3);
  const darkRow = darkGrid([
    "     ",
    " ### ",
    "     ",
  ]);
  write(
    "case_conflict_397_edgeS_vs_doorStep.png",
    renderCase(
      "397 resolved - house stores it, dark only samples it",
      "left: house writes 397 as a finished door step. right: dark stores 366 and 397 appears only as a top-line quarter.",
      [
        { kind: "store", label: "house store 397", map: houseStep },
        { kind: "render", label: "house render (plain)", map: houseStep },
        { kind: "store", label: "dark store (366 only)", map: darkRow },
        { kind: "render", label: "dark render (samples 397)", map: darkRow },
      ],
    ),
  );
}

// 10. House posts are whole tiles; a dark 1-col is quarter-composed.
{
  const housePosts = crop(twoRoomVGrid, 4, 0, 3, 9);
  const darkCol = darkGrid([
    "   ",
    " # ",
    " # ",
    " # ",
    "   ",
  ]);
  write(
    "case_1col_pillar_posts.png",
    renderCase(
      "1 col - house post vs dark pillar",
      "house partition stores 77/107 then posts. dark pillar stores 366 and renders 426|428 half-and-half.",
      [
        { kind: "store", label: "house store", map: housePosts },
        { kind: "render", label: "house render", map: housePosts },
        { kind: "store", label: "dark store", map: darkCol },
        { kind: "render", label: "dark render", map: darkCol },
      ],
    ),
  );
}

// 11. Gapless rooms keep 77/107 — never body-only 105.
{
  const soloUppers = twoRoomVGrid.lowerTiles.filter((t) => t === H.soloUpper).length;
  if (soloUppers === 0) throw new Error("gapless partition lost its 77 solo tile");
  write(
    "case_cream_solo_partition_77_107.png",
    renderCase(
      "gapless rooms - 1 col partition keeps 77/107",
      "ceiling-attached cells take solo 77/107; deeper cells become posts. no body-only 105 column.",
      [
        { kind: "store", label: "store", map: twoRoomVGrid },
        { kind: "render", label: "render", map: twoRoomVGrid },
      ],
    ),
  );
}

// 12/13. Retint — face swaps, frame and door untouched.
for (const [material, file] of [
  ["gold-brick", "case_gold_brick_face_retint.png"],
  ["stone-brick", "case_stone_brick_face_retint.png"],
] as const) {
  const map = retinted(material);
  write(
    file,
    renderCase(
      `${material} retint - face only`,
      "retintHouseWallFace swaps the cream face for finished brick tiles. cap/posts/trim/door keep their ids.",
      [
        { kind: "store", label: "store", map },
        { kind: "render", label: "render (plain whole tiles)", map },
      ],
    ),
  );
}

// 14. Chipset highlight — which contract owns which id.
{
  const scale = 2;
  const houseIds = new Set((Object.values(HOUSE_SHELL_TILE) as number[]).filter((t) => t !== H.void && t !== H.floor));
  const sourceIds = new Set(Object.values(DARK_WALL_QUARTER_SOURCE) as number[]);
  const forbiddenIds = new Set(HOUSE_SHELL_FORBIDDEN_TILES);
  const marked = new Set<number>([...houseIds, ...sourceIds, ...forbiddenIds, DARK_WALL_TILE.BODY]);

  const png = makePng(chip.width * scale + PAD * 2, chip.height * scale + PAD * 2 + 54);
  drawText(png, "interior chipset - contract ownership", PAD, PAD, 2, C.text);
  drawText(png, "green house store    blue dark store 366    amber dark render source only", PAD, PAD + 16, 1, C.muted);
  drawText(png, "green+amber both (house whole tile AND dark quarter source)    red forbidden", PAD, PAD + 24, 1, C.muted);
  drawText(png, "unmarked tiles are dimmed - they belong to neither wall contract", PAD, PAD + 32, 1, C.muted);
  const ox = PAD;
  const oy = PAD + 46;

  // Dim everything, then restore full brightness only on tiles a wall contract owns —
  // otherwise the marks vanish into a busy 480-tile sheet.
  for (let y = 0; y < chip.height; y += 1) {
    for (let x = 0; x < chip.width; x += 1) {
      const si = (y * chip.width + x) * 4;
      const tile = Math.floor(y / TILE) * COLS + Math.floor(x / TILE);
      const lit = marked.has(tile);
      const color: RGB = chip.data[si + 3] === 0
        ? C.panel
        : lit
          ? [chip.data[si]!, chip.data[si + 1]!, chip.data[si + 2]!]
          : [chip.data[si]! * 0.28 + 14, chip.data[si + 1]! * 0.28 + 19, chip.data[si + 2]! * 0.28 + 25];
      fillRect(png, ox + x * scale, oy + y * scale, scale, scale, color);
    }
  }

  const mark = (tile: number, color: RGB, inset = 0, weight = 2): void => {
    const x = ox + (tile % COLS) * TILE * scale + inset;
    const y = oy + Math.floor(tile / COLS) * TILE * scale + inset;
    strokeRect(png, x, y, TILE * scale - inset * 2, TILE * scale - inset * 2, color, weight);
  };
  for (const tile of houseIds) {
    mark(tile, C.house);
    // 397/396/398/426/428/456/457/458 are house whole tiles AND dark quarter sources.
    if (sourceIds.has(tile)) mark(tile, C.source, 2, 1);
  }
  for (const tile of sourceIds) {
    if (!houseIds.has(tile)) mark(tile, C.source);
  }
  mark(DARK_WALL_TILE.BODY, C.dark);
  for (const tile of forbiddenIds) mark(tile, C.bad);
  write("chipset_highlight_key_tiles.png", png);
}

// 15. Dark shape gallery — one image, every shape the plan asks for.
{
  const shapes: readonly { name: string; rows: readonly string[] }[] = [
    { name: "isolated", rows: ["   ", " # ", "   "] },
    { name: "row", rows: ["     ", " ### ", "     "] },
    { name: "col", rows: ["   ", " # ", " # ", " # ", "   "] },
    { name: "l-bend", rows: ["    ", " ###", " #  ", " #  ", "    "] },
    { name: "3x3 hole", rows: ["     ", " ### ", " #.# ", " ### ", "     "] },
    { name: "concave", rows: ["     ", " ### ", " ### ", " ##  ", "     "] },
  ];
  for (const shape of shapes) {
    const map = darkGrid(shape.rows);
    const file = `case_dark_366_${shape.name.replace(/[^a-z0-9]+/g, "_")}.png`;
    write(
      file,
      renderCase(
        `dark 366 - ${shape.name}`,
        "store is 366 on every wall cell. the four quarters are chosen at render time from 368/396-458.",
        [
          { kind: "store", label: "store", map },
          { kind: "render", label: "render", map },
        ],
      ),
    );
  }
}

// 16. House topology gallery — single rect, vertical partition, horizontal band.
write(
  "case_house_single_rect.png",
  renderCase(
    "house shell - single rect room",
    "planInteriorHouseWalls: one plan always yields one finished tile grid.",
    [
      { kind: "store", label: "store", map: singleGrid },
      { kind: "render", label: "render", map: singleGrid },
    ],
  ),
);

write(
  "case_house_two_rooms_vertical.png",
  renderCase(
    "house shell - gapless rooms, 1 col partition + inner door",
    "partition cells are reserved before the shell runs. no post-pass repaints 105 over them.",
    [
      { kind: "store", label: "store", map: twoRoomVGrid },
      { kind: "render", label: "render", map: twoRoomVGrid },
    ],
  ),
);

write(
  "case_house_two_rooms_horizontal.png",
  renderCase(
    "house shell - stacked rooms, banded partition + inner door",
    "the band between rooms resolves to cap + cream face; the inner door keeps its floor opening.",
    [
      { kind: "store", label: "store", map: twoRoomHGrid },
      { kind: "render", label: "render", map: twoRoomHGrid },
    ],
  ),
);

console.log("\nAll case PNGs regenerated from real APIs.");
