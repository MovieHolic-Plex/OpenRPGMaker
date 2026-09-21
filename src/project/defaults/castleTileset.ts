import { createSharedCastleReferences } from "./sharedCastleReferences";
import type { PassFlag, TileAiMetadata, TilesetDef } from "../types";
import {
  CASTLE_TILE_COUNT,
  CASTLE_TILESET_ID,
  CASTLE_TILESET_NAME,
  CASTLE_TILESET_TEXTURE_KEY,
  CASTLE_TILES_PER_ROW,
  CASTLE_TILE_SIZE,
} from "./constants";
import { createCastleStructureKits } from "./castleStructureKits";
import { CASTLE_MEASURED_PARTS } from './castleMeasuredParts';

// Alpha classification measured from the unmodified bundled PNG, 16px cells.
// E = empty, T = transparent/partial, O = opaque. See ATTRIBUTION.md for its hash.
const ALPHA = [
  "EETTTTTTTTTTTTTTTTTTOOOOOOTTTTTT",
  "EEOOOOOOOOOOTOOOOOOTOOTTOOTOOOOT",
  "EEOOOOTTTTTTTOOOOOOTOTTTTOTOOOOT",
  "EEOOOOOOOOOOTOOOOOOTOTTTTOTOTTOT",
  "TTTTTTTTTTTTTOOOOOOTOTTTTTTOOOOT",
  "OOOOOOOOOOOOTOOOOOOTOTTTTOTTTTTT",
  "OOOOOOOOOOOOTOOOOTOTOOOOOOOOOOOO",
  "OOOOOOOOTTOOTOOOOTOTOOTTOOOOTTOO",
  "OOOOOOOTTTTOTOOOTTOTOTTTTOOTTTTO",
  "OOOOOOOTTTTOTOOOOOOTOTTTTOOTTTTO",
  "OOOOOOOTEEETTOOOOOOTOTTTTTOTEEET",
  "TTTTTTOEEEEOTOOOOOOTOTTTTOOEEEEO",
  "TTTTTTTTTTOOTOOOOOOTTTEEEEEEEEEE",
  "TTTTTTTTTTOOTOOOOOOTOOEEEEEETTEE",
  "OOTTTTTTTTOOTTTTTTTOOOOTEETTTOTT",
  "OOEETTTTTTOOTTTTTTTOOOOTEETOOOOT",
  "TTTTTTOOOOTTTTTTTTTTTTOOOOTOOOOT",
  "TTTTTTOOOOTTTTTTTTTTTTOOOOTOOOOT",
  "OOOOTTTTTTTTTTTTTTTTTTOOOOEEEEEE",
  "OOOOTTETTTTTTTEETETTTTOOOOEETTTT",
  "OOOOTTTTTTTTOOOOOOOOOOTTTTTTTTTT",
  "OOOOTTOOTOOTOOOOOOOOOOOOTTTTTTTT",
  "OOTTOOOOTOOTOOOOOOOOOOOOTOOTTTTT",
  "OOTTOOOOTOOTOOOOOOOOOOOOTTTTTTTT",
  "OOOOOOOOOOOOOOOOOOETTEOOETTTTTET",
  "OOOOOOOOOOOOOOOOOOTTTTTTTTTTTTET",
  "OOOOOOOOOOOOOOEEEETOOTTTTTOTTTET",
  "OOOOOOOOOOOOOOEEEETTTTTTTTTTTTTT",
  "OOOOOOOOOOOOOOTTTETTOTTTTTTTETTT",
  "OOOOOOOOOOOOOOTOTETTTTTTTTTTTTTT",
  "OOOOOOOOOOOOOOTTTTTTTTTTTTTTTOOT",
  "OOOOOOOOOOOOOOTTTTTTTTTTTTTTTTTT",
].join("");

const GRASS_SOURCE_TILES = new Set([176, 193, 194, 195, 196, 197]);
const WATER_SOURCE_TILES = new Set([
  192, 208, 209, 210, 211, 212, 213, 214,
  224, 225, 226, 227, 228, 229, 230,
  240, 241, 242, 243, 244, 245, 246,
]);

/** Original 32px artwork occupies 2×2 cells on the engine's fixed 16px map grid. */
export function createCastleTileset(): TilesetDef {
  const tileMeta: TileAiMetadata[] = Array.from({ length: CASTLE_TILE_COUNT }, (_, tile) => {
    const x = tile % CASTLE_TILES_PER_ROW;
    const y = Math.floor(tile / CASTLE_TILES_PER_ROW);
    const sourceTile = Math.floor(y / 2) * 16 + Math.floor(x / 2);
    const empty = ALPHA[tile] === "E";
    const grass = GRASS_SOURCE_TILES.has(sourceTile);
    const water = WATER_SOURCE_TILES.has(sourceTile);
    const paving = x >= 12 && x < 18 && y >= 20 && y < 26;
    const measured = CASTLE_MEASURED_PARTS.find(p => {
      const [sx,sy,w,h]=p.rect;
      return x>=sx && x<sx+w && y>=sy && y<sy+h
        && !(p.id==='clock-tree' && x>=sx+4 && y<sy+2);
    });
    const ground = grass || water || paving;
    const label = empty ? "빈칸" : measured?.name ?? (grass ? "잔디" : water ? "물·물가" : "미분류 · 조립 전 확인");
    return {
      label: `${label} ${tile}`,
      description: `원본 32px 타일 ${sourceTile}의 ${x % 2 + 1}열 ${y % 2 + 1}행 조각. 원본 타일은 2×2칸으로 선택합니다.`,
      tags: ["성채", ground ? "지형" : "덧그림", ...(ALPHA[tile] === "O" ? [] : ["투명"])],
      defaultLayer: ground ? "lower" : "upper",
      passage: empty || grass || paving ? "passable" : "solid",
      source: "bundled-default",
    };
  });
  return {
    id: CASTLE_TILESET_ID,
    name: CASTLE_TILESET_NAME,
    image: { type: "bundled", id: CASTLE_TILESET_TEXTURE_KEY },
    kind: "custom",
    tileSize: CASTLE_TILE_SIZE,
    tilesPerRow: CASTLE_TILES_PER_ROW,
    count: CASTLE_TILE_COUNT,
    passability: tileMeta.map((meta): PassFlag => {
      const open = meta.passage === "passable";
      return { up: open, down: open, left: open, right: open };
    }),
    priority: tileMeta.map((meta) => meta.defaultLayer === "lower" ? "lower" : "upper"),
    terrain: Array.from({ length: CASTLE_TILE_COUNT }, () => 0),
    structureKits: createCastleStructureKits(),
    referenceDocuments: createSharedCastleReferences(),
    tileMeta,
    tileGroups: [],
  };
}
