import { readdirSync, readFileSync } from "node:fs";
import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";
import { OBJECT_SPEC_LIMITS, OBJECT_SPEC_PASSAGE_CHARS } from "@/project/objectSpec";
import catalog from "../public/assets/beodeul-objects/catalog.json" with { type: "json" };
import manifest from "../public/assets/beodeul-objects/manifest.json" with { type: "json" };

const folder = new URL("../public/assets/beodeul-objects/", import.meta.url);
const assetId = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/u;
const assetFilename = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*\.png$/u;
const revisionSuffix = /_(?:[rv]\d+|hq\d*)$/u;
const tileSize = 16;

describe("Beodeul placeable object data", () => {
  it("matches placeable PNGs to unique IDs and keeps approved source filenames", () => {
    const ids = catalog.map(object => object.id);
    expect(new Set(ids).size).toBe(ids.length);
    // Hyphenated PNGs in this directory are reference renders.
    const pngs = readdirSync(folder).filter(filename => assetFilename.test(filename));
    expect(pngs.sort()).toEqual(ids.map(id => `${id}.png`).sort());
    for (const { id, nameKo, sourceFile, tags } of catalog) {
      expect(id).toMatch(assetId);
      expect(id).not.toMatch(revisionSuffix);
      expect(sourceFile).toMatch(assetFilename);
      expect(sourceFile.slice(0, -".png".length).replace(revisionSuffix, "")).toBe(id);
      expect(nameKo).toMatch(/[가-힣]/u);
      expect(tags.length).toBeGreaterThan(0);
      expect(tags.length, id).toBeLessThan(OBJECT_SPEC_LIMITS.tags);
      expect(tags.every(tag => tag.trim().length > 0 && tag.length <= OBJECT_SPEC_LIMITS.tagLength), id).toBe(true);
    }
  });

  it("describes the PNG dimensions and passage of each occupied 16px cell", () => {
    for (const { id, widthPx, heightPx, widthTiles, heightTiles, footprint } of catalog) {
      const image = PNG.sync.read(readFileSync(new URL(`${id}.png`, folder)));
      expect([widthPx, heightPx], id).toEqual([image.width, image.height]);
      expect([widthTiles, heightTiles], id).toEqual([Math.ceil(widthPx / tileSize), Math.ceil(heightPx / tileSize)]);
      const drawn = new Set<number>();
      let hasTransparency = false;
      for (let pixel = 0; pixel < widthPx * heightPx; pixel++) {
        if (image.data[pixel * 4 + 3] === 0) {
          hasTransparency = true;
          continue;
        }
        const x = Math.floor((pixel % widthPx) / tileSize);
        const y = Math.floor(pixel / (widthPx * tileSize));
        drawn.add(y * widthTiles + x);
      }
      expect(hasTransparency || footprint.every(row => /^\.+$/u.test(row)), id).toBe(true);
      expect(drawn.size, id).toBeGreaterThan(0);
      expect(footprint, id).toHaveLength(heightTiles);
      for (const [y, row] of footprint.entries()) {
        expect(row, id).toHaveLength(widthTiles);
        for (const [x, mark] of [...row].entries()) {
          expect(OBJECT_SPEC_PASSAGE_CHARS, id).toContain(mark);
          expect(drawn.has(y * widthTiles + x), `${id} (${x},${y})`).toBe(mark !== " ");
        }
      }
    }
  });

  it("assigns a palette group to every object and includes every required set piece", () => {
    const groups = new Set(manifest.groups.map(group => group.id));
    const piecesBySet = new Map(manifest.sets.map(set => [set.id, new Set<string>()]));
    expect(groups.size).toBe(manifest.groups.length);
    expect(piecesBySet.size).toBe(manifest.sets.length);
    for (const { id, group, category, set } of catalog) {
      expect(groups.has(group), id).toBe(true);
      expect(["prop", "indoor", "nature", "structure"], id).toContain(category);
      if (set) {
        const pieces = piecesBySet.get(set.id);
        expect(category, id).toBe("structure");
        expect(pieces, id).toBeDefined();
        expect(pieces!.has(set.piece), id).toBe(false);
        pieces!.add(set.piece);
      }
    }
    for (const { id, requiredPieces } of manifest.sets) {
      expect(new Set(requiredPieces).size, id).toBe(requiredPieces.length);
      expect([...piecesBySet.get(id)!], id).toEqual(expect.arrayContaining(requiredPieces));
    }
  });
});
