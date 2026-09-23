// Fold the two interior sheet forks onto EasyRPG 실내 통합본.
// Identical cells keep their numbers. Cells whose pixels differ are appended.
// The unified sheet's existing cells are never overwritten.
import { createHash, randomUUID } from "node:crypto";
import { PNG } from "pngjs";
import { readFileSync } from "node:fs";

const COLS = 30;
const TW = 16;
const UNIFIED_ID = "tibo_interior_expanded";
const UNIFIED_ASSET = "easyrpg_interior_unified_20260922";
const FORKS = ["tileset_potter_cohesive_20260921", "tileset_trade_rooms_20260921"];
const FORK_ASSETS = ["interior_potter_cohesive_20260921", "interior_trade_rooms_20260921"];
const GRASS_ID = "forest_harmony_grass_joins";

export function tileHash(png, index) {
  const x = (index % COLS) * TW;
  const y = Math.floor(index / COLS) * TW;
  if (x + TW > png.width || y + TW > png.height) return null;
  const buf = Buffer.alloc(TW * TW * 4);
  for (let row = 0; row < TW; row += 1) {
    const src = ((y + row) * png.width + x) * 4;
    png.data.copy(buf, row * TW * 4, src, src + TW * 4);
  }
  return createHash("sha256").update(buf).digest("hex");
}

function grow(png, height) {
  if (png.height >= height) return png;
  const next = new PNG({ width: png.width, height });
  next.data.fill(0);
  PNG.bitblt(png, next, 0, 0, png.width, png.height, 0, 0);
  return next;
}

function blit(dst, src, from, to) {
  const need = (Math.floor(to / COLS) + 1) * TW;
  const sheet = grow(dst, need);
  PNG.bitblt(src, sheet, (from % COLS) * TW, Math.floor(from / COLS) * TW, TW, TW, (to % COLS) * TW, Math.floor(to / COLS) * TW);
  return sheet;
}

function loadPng(bytes) {
  return PNG.sync.read(Buffer.from(bytes));
}

/** @returns {{ project: object, png: import('pngjs').PNG, report: object }} */
export function foldInteriorForks(project, sheets) {
  const unified = project.tilesets[UNIFIED_ID];
  if (!unified) throw new Error("통합본 타일셋이 없습니다");
  const baseCount = unified.count;
  let png = sheets.unified;
  const byHash = new Map();
  for (let index = 0; index < baseCount; index += 1) {
    const hash = tileHash(png, index);
    if (hash && !byHash.has(hash)) byHash.set(hash, index);
  }
  const appended = [];
  const remap = new Map();
  const used = new Map();
  for (const forkId of FORKS) used.set(forkId, new Set());
  for (const map of Object.values(project.maps)) {
    if (!FORKS.includes(map.tilesetId)) continue;
    for (const key of ["lowerTiles", "upperTiles"]) {
      for (const cell of map[key] ?? []) {
        if (typeof cell === "number" && cell >= 0) used.get(map.tilesetId).add(cell);
      }
    }
  }
  for (const space of Object.values(project.spatialAuthoring?.library?.spaces ?? {})) {
    const forkId = [space.tilesetId, space.composition?.tilesetId].find((id) => FORKS.includes(id));
    if (!forkId) continue;
    if (space.tilesetId !== forkId || space.composition?.tilesetId !== forkId) {
      throw new Error(`${space.id} 타일셋 참조가 어긋나 있습니다`);
    }
    for (const cell of space.composition?.tiles ?? []) {
      if (typeof cell.tile === "number" && cell.tile >= 0) used.get(forkId).add(cell.tile);
    }
  }
  for (const forkId of FORKS) {
    const fork = project.tilesets[forkId];
    const sheet = sheets[forkId];
    if (!fork || !sheet) throw new Error(`없는 포크 ${forkId}`);
    for (const cell of used.get(forkId)) {
      const hash = tileHash(sheet, cell);
      if (!hash) throw new Error(`${forkId} ${cell} 칸이 시트 밖입니다`);
      const existing = byHash.get(hash);
      if (existing !== undefined) {
        remap.set(`${forkId}:${cell}`, existing);
        continue;
      }
      const next = baseCount + appended.length;
      png = blit(png, sheet, cell, next);
      byHash.set(hash, next);
      appended.push({ forkId, from: cell, to: next, label: fork.tileMeta?.[cell]?.label ?? "" });
      remap.set(`${forkId}:${cell}`, next);
      for (const field of ["passability", "priority", "terrain"]) {
        unified[field][next] = structuredClone(fork[field][cell]);
      }
      unified.tileMeta[next] = structuredClone(fork.tileMeta[cell]);
    }
  }
  if (png.data.length !== png.width * png.height * 4) throw new Error("시트 버퍼 길이가 맞지 않습니다");
  for (let index = 0; index < baseCount; index += 1) {
    if (tileHash(png, index) !== tileHash(sheets.unified, index)) throw new Error(`통합본 ${index} 칸이 바뀌었습니다`);
  }
  unified.count = baseCount + appended.length;
  for (const field of ["passability", "priority", "terrain", "tileMeta"]) {
    if (unified[field].length !== unified.count) throw new Error(`${field} 길이 ${unified[field].length} != ${unified.count}`);
  }
  const movedMaps = [];
  for (const map of Object.values(project.maps)) {
    const forkId = map.tilesetId;
    if (!FORKS.includes(forkId)) continue;
    for (const key of ["lowerTiles", "upperTiles"]) {
      if (!Array.isArray(map[key])) continue;
      map[key] = map[key].map((cell) => {
        if (typeof cell !== "number" || cell < 0) return cell;
        const next = remap.get(`${forkId}:${cell}`);
        if (next === undefined) throw new Error(`${map.id} ${forkId}:${cell} 매핑이 없습니다`);
        return next;
      });
    }
    map.tilesetId = UNIFIED_ID;
    movedMaps.push(map.id);
  }
  const movedSpaces = [];
  for (const space of Object.values(project.spatialAuthoring?.library?.spaces ?? {})) {
    if (!FORKS.includes(space.tilesetId)) continue;
    for (const cell of space.composition?.tiles ?? []) {
      if (typeof cell.tile !== "number" || cell.tile < 0) continue;
      const next = remap.get(`${space.tilesetId}:${cell.tile}`);
      if (next === undefined) throw new Error(`${space.id} ${cell.tile} 매핑이 없습니다`);
      cell.tile = next;
    }
    space.tilesetId = UNIFIED_ID;
    if (space.composition) space.composition.tilesetId = UNIFIED_ID;
    movedSpaces.push(space.id);
  }
  for (const forkId of FORKS) delete project.tilesets[forkId];
  const asset = project.assets.uploaded[UNIFIED_ASSET];
  asset.meta = { ...asset.meta, width: png.width, height: png.height, tileSize: TW };
  for (const id of FORK_ASSETS) {
    const still = JSON.stringify(project.tilesets).includes(id) || JSON.stringify(project.maps).includes(id);
    if (still) throw new Error(`${id} 가 아직 참조됩니다`);
    delete project.assets.uploaded[id];
  }
  const grassUsed = Object.values(project.maps).some((map) => map.tilesetId === GRASS_ID)
    || Object.values(project.tilesets).some((tileset) => (tileset.tileGrafts ?? []).some((graft) => graft.sourceChipset === "tex_forest_harmony_grass_joins"));
  if (!grassUsed && project.tilesets[GRASS_ID]) delete project.tilesets[GRASS_ID];
  const note = "바닥과 밑단을 맞춘 그림은 `tibo_interior_expanded`에 이어 붙였다";
  const docs = [];
  const visit = (value) => {
    if (typeof value === "string") return;
    if (Array.isArray(value)) { value.forEach(visit); return; }
    if (!value || typeof value !== "object") return;
    for (const [key, item] of Object.entries(value)) {
      if (typeof item === "string" && (item.includes("tileset_potter_cohesive_20260921") || item.includes("tileset_trade_rooms_20260921"))) {
        value[key] = item
          .replaceAll("tileset_potter_cohesive_20260921", "tibo_interior_expanded")
          .replaceAll("tileset_trade_rooms_20260921", "tibo_interior_expanded");
        docs.push(key);
      } else visit(item);
    }
  };
  visit(project.tilesets);
  if (docs.length) appended.note = note;
  return {
    png,
    report: {
      baseCount,
      appended,
      movedMaps,
      movedSpaces,
      docs,
      grassRemoved: !project.tilesets[GRASS_ID],
      unifiedCount: unified.count,
      image: { width: png.width, height: png.height },
    },
  };
}

export async function bridgeCall(host, token, channel, payload) {
  const response = await fetch(`${host}/__oprn/bridge`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-oprn-bridge-token": token,
      "x-oprn-session": "fold-interior-forks",
    },
    body: JSON.stringify({ channel, payload }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`${channel} ${response.status} ${JSON.stringify(body).slice(0, 400)}`);
  return body;
}

export function pngBytes(png) {
  return PNG.sync.write(png);
}

export function readSheet(path) {
  return loadPng(readFileSync(path));
}

export { loadPng, UNIFIED_ID, UNIFIED_ASSET, randomUUID };
