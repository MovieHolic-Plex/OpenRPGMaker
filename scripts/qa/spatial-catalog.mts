// scripts/qa/spatial-catalog.mts
// 배송 공간 카탈로그 렌더 근거. 계획서 task18 의 "각 항목의 실제 그림" 요구를 채운다.
//
// 브라우저 캔버스를 쓰지 않는다 — jimp 로 PNG 를 직접 인코딩하므로 Node 에서 그대로 돌고
// 같은 입력이면 같은 바이트가 나온다(src/benchmark/town/inputImages.ts 와 같은 방식).
// 타일 분할도 그 파일의 규약을 그대로 쓴다: 한 줄 TOWN_TILES_PER_ROW 칸, 칸당 TOWN_TILE_SIZE px.
//
// 글자는 그리지 않는다. 카탈로그가 실제로 무엇을 그리는지 눈으로 보는 것이 목적이므로
// 라벨을 얹으면 그림 대신 글자를 검사하게 된다.

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import Jimp from "jimp";
import { TOWN_CHIPSET_PNG_PATH } from "../../src/benchmark/town/inputImages";
import { TOWN_TILES_PER_ROW, TOWN_TILE_SIZE } from "../../src/benchmark/town/types";
import { OUTDOOR_OBJECT_CATALOG } from "../../src/project/defaults/spatial/outdoorObjectCatalog";
import { SPACE_CATALOG, spaceDefById } from "../../src/project/defaults/spatial/spaceCatalog";
import { PLACE_CATALOG } from "../../src/project/defaults/spatial/placeCatalog";
import { REGION_CATALOG, WORLD_CATALOG } from "../../src/project/defaults/spatial/geographyCatalog";
import { outdoorObjectById } from "../../src/project/defaults/spatial/outdoorObjectCatalog";

const { values } = parseArgs({
  options: {
    evidence: { type: "string", default: "output/evidence/tile-to-world/catalog" },
    seeds: { type: "string", default: "7" },
  },
});
const output = resolve(values.evidence);
const seeds = values.seeds.split(",").map((seed) => Number(seed.trim()));
for (const seed of seeds) assert.ok(Number.isSafeInteger(seed), `seed must be an integer: ${values.seeds}`);

const SCALE = 2;
const CELL = TOWN_TILE_SIZE * SCALE;
const BACKGROUND = 0x20232aff;
const LATTICE = 0x3a3f4bff;

const digest = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");

const sheet = await Jimp.read(TOWN_CHIPSET_PNG_PATH);
const sheetRows = sheet.getHeight() / TOWN_TILE_SIZE;

/** 타일 한 칸을 정수배로 옮긴다. 완전 투명 픽셀은 배경을 남겨 상위 소품이 조각으로 보인다. */
function drawTile(canvas: Jimp, tile: number, destX: number, destY: number): void {
  const sourceX = (tile % TOWN_TILES_PER_ROW) * TOWN_TILE_SIZE;
  const sourceY = Math.floor(tile / TOWN_TILES_PER_ROW) * TOWN_TILE_SIZE;
  assert.ok(sourceY + TOWN_TILE_SIZE <= sheet.getHeight(), `tile ${tile} outside the atlas`);
  for (let y = 0; y < TOWN_TILE_SIZE; y += 1) {
    for (let x = 0; x < TOWN_TILE_SIZE; x += 1) {
      const colour = sheet.getPixelColor(sourceX + x, sourceY + y);
      if ((colour & 0xff) === 0) continue;
      for (let dy = 0; dy < SCALE; dy += 1) {
        for (let dx = 0; dx < SCALE; dx += 1) canvas.setPixelColor(colour, destX + x * SCALE + dx, destY + y * SCALE + dy);
      }
    }
  }
}

function board(widthCells: number, heightCells: number): Jimp {
  const canvas = new Jimp(widthCells * CELL, heightCells * CELL, BACKGROUND);
  for (let cx = 0; cx <= widthCells; cx += 1) {
    for (let y = 0; y < canvas.getHeight(); y += 1) canvas.setPixelColor(LATTICE, Math.min(cx * CELL, canvas.getWidth() - 1), y);
  }
  for (let cy = 0; cy <= heightCells; cy += 1) {
    for (let x = 0; x < canvas.getWidth(); x += 1) canvas.setPixelColor(LATTICE, x, Math.min(cy * CELL, canvas.getHeight() - 1));
  }
  return canvas;
}

/** 오브젝트 하나를 자기 칸 크기의 작은 판에 그린다. */
function renderObject(id: string): Jimp {
  const object = outdoorObjectById(id);
  assert.ok(object, `unknown object ${id}`);
  const canvas = board(object.width, object.height);
  for (const cell of object.cells) drawTile(canvas, cell.tile, cell.dx * CELL, cell.dy * CELL);
  return canvas;
}

/** 공간 하나를 지형 판 위에 고정 배치된 오브젝트까지 그린다. */
function renderSpace(id: string): Jimp {
  const space = spaceDefById(id);
  assert.ok(space, `unknown space ${id}`);
  const canvas = board(space.width, space.height);
  let drawn = 0;
  for (const slot of space.slots) {
    if (!slot.at) continue;
    const object = outdoorObjectById(slot.objectId);
    assert.ok(object, `space ${id} references unknown object ${slot.objectId}`);
    for (const cell of object.cells) drawTile(canvas, cell.tile, (slot.at.x + cell.dx) * CELL, (slot.at.y + cell.dy) * CELL);
    drawn += 1;
  }
  assert.ok(drawn > 0, `space ${id} rendered nothing — a blank sheet is not evidence`);
  return canvas;
}

/** 접촉 시트 — 항목들을 격자로 이어 붙여 한 장으로 본다. */
function contactSheet(tiles: readonly Jimp[], perRow: number): Jimp {
  const cellWidth = Math.max(...tiles.map((tile) => tile.getWidth()));
  const cellHeight = Math.max(...tiles.map((tile) => tile.getHeight()));
  const rows = Math.ceil(tiles.length / perRow);
  const sheetCanvas = new Jimp(perRow * (cellWidth + 8), rows * (cellHeight + 8), BACKGROUND);
  tiles.forEach((tile, index) => {
    const column = index % perRow;
    const row = Math.floor(index / perRow);
    sheetCanvas.composite(tile, column * (cellWidth + 8) + 4, row * (cellHeight + 8) + 4);
  });
  return sheetCanvas;
}

const receipts: { readonly kind: string; readonly id: string; readonly file: string; readonly sha256: string; readonly opaquePixels: number }[] = [];

/** 그림이 실제로 무언가를 그렸는지 센다. 0 이면 빈 그림이므로 근거가 아니다. */
function opaquePixels(canvas: Jimp): number {
  let count = 0;
  canvas.scan(0, 0, canvas.getWidth(), canvas.getHeight(), (_x, _y, index) => {
    const colour = (canvas.bitmap.data.readUInt32BE(index) >>> 0);
    if (colour !== BACKGROUND && colour !== LATTICE) count += 1;
  });
  return count;
}

async function emit(kind: string, id: string, canvas: Jimp): Promise<Jimp> {
  const directory = join(output, "contact-sheets", kind);
  await mkdir(directory, { recursive: true });
  const bytes = await canvas.getBufferAsync(Jimp.MIME_PNG);
  const file = join(directory, `${id}.png`);
  await writeFile(file, bytes);
  const painted = opaquePixels(canvas);
  assert.ok(painted > 0, `${kind}/${id} rendered a blank image`);
  receipts.push({ kind, id, file: file.slice(output.length + 1), sha256: digest(bytes), opaquePixels: painted });
  return canvas;
}

await mkdir(output, { recursive: true });

const objectTiles: Jimp[] = [];
for (const object of OUTDOOR_OBJECT_CATALOG) objectTiles.push(await emit("objects", object.id, renderObject(object.id)));
await emit("sheets", "outdoor-objects", contactSheet(objectTiles, 5));

const spaceTiles: Jimp[] = [];
for (const space of SPACE_CATALOG) spaceTiles.push(await emit("spaces", space.id, renderSpace(space.id)));
await emit("sheets", "spaces", contactSheet(spaceTiles, 4));

// 장소·지역·세계는 자기 래스터가 없다(자식 배치와 연결이 전부다). 그림 대신 구성 기록을 남긴다.
const composition = {
  places: PLACE_CATALOG.map((place) => ({
    id: place.id,
    children: place.children.map((child) => ({ id: child.id, kind: child.kind, designId: child.designId, level: child.level })),
    links: place.links.map((link) => ({ id: link.id, from: link.from, to: link.to })),
  })),
  regions: REGION_CATALOG.map((region) => ({
    id: region.id, world: region.world,
    places: region.places.map((child) => ({ id: child.id, designId: child.designId, x: child.x, y: child.y })),
    routes: region.routes.map((route) => ({ id: route.id, points: route.points })),
  })),
  worlds: WORLD_CATALOG.map((world) => ({
    id: world.id, entryRegion: world.entryRegion,
    regions: world.regions.map((child) => child.designId),
    ports: world.ports.map((port) => port.id),
    connections: world.connections,
  })),
};

const manifest = {
  generatedBy: "scripts/qa/spatial-catalog.mts",
  atlas: { path: TOWN_CHIPSET_PNG_PATH, rows: sheetRows, tilesPerRow: TOWN_TILES_PER_ROW, tileSize: TOWN_TILE_SIZE, license: "EasyRPG RTP (CC0)" },
  seeds,
  counts: {
    objects: OUTDOOR_OBJECT_CATALOG.length,
    spaces: SPACE_CATALOG.length,
    places: PLACE_CATALOG.length,
    regions: REGION_CATALOG.length,
    worlds: WORLD_CATALOG.length,
  },
  receipts,
  composition,
};
await writeFile(join(output, "inventory.json"), `${JSON.stringify(manifest, null, 1)}\n`);
console.log(`rendered ${receipts.length} images; objects=${OUTDOOR_OBJECT_CATALOG.length} spaces=${SPACE_CATALOG.length} places=${PLACE_CATALOG.length} regions=${REGION_CATALOG.length} worlds=${WORLD_CATALOG.length}`);
