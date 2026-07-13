import { describe, expect, it } from "vitest";
import { createFarmingDemoProject } from "@/project/defaults/defaultProject";
import { FARMING_CROP_SPRITE_ASSETS, type FarmingCropSpriteAsset } from "@/assets/farmingSprites";

type BinaryFsReader = {
  readonly readFileSync: (path: URL) => Uint8Array;
};

const loadBinaryFs = async (): Promise<BinaryFsReader> => {
  const moduleName = "node:fs";
  return (await import(moduleName)) as BinaryFsReader;
};

const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

const CROP_SHEETS = [
  { file: "crop_potato.png", width: 32, height: 16 },
  { file: "crop_strawberry.png", width: 32, height: 16 },
  { file: "crop_tomato.png", width: 48, height: 16 },
  { file: "crop_corn.png", width: 48, height: 16 },
] as const;

const ANIMAL_SHEETS = [
  { file: "chicken.png", width: 288, height: 256 },
  { file: "cow.png", width: 288, height: 256 },
] as const;

describe("farming crop sprite sheets", () => {
  for (const sheet of CROP_SHEETS) {
    it(`ships a valid ${sheet.width}x${sheet.height} RGBA PNG for ${sheet.file}`, async () => {
      const fs = await loadBinaryFs();
      const bytes = fs.readFileSync(new URL(`../public/assets/farming/crops/${sheet.file}`, import.meta.url));

      expect(Array.from(bytes.slice(0, PNG_SIGNATURE.length))).toEqual(Array.from(PNG_SIGNATURE));
      expect(readUint32BE(bytes, 16)).toBe(sheet.width);
      expect(readUint32BE(bytes, 20)).toBe(sheet.height);
      expect(bytes[24]).toBe(8);
      expect(bytes[25]).toBe(6);
      expect(hasChunk(bytes, "IDAT")).toBe(true);
    });
  }
});

describe("farming animal charsets", () => {
  for (const sheet of ANIMAL_SHEETS) {
    it(`ships a valid ${sheet.width}x${sheet.height} RM2K3 charset PNG for ${sheet.file}`, async () => {
      const fs = await loadBinaryFs();
      const bytes = fs.readFileSync(new URL(`../public/assets/farming/animals/${sheet.file}`, import.meta.url));

      expect(Array.from(bytes.slice(0, PNG_SIGNATURE.length))).toEqual(Array.from(PNG_SIGNATURE));
      expect(readUint32BE(bytes, 16)).toBe(sheet.width);
      expect(readUint32BE(bytes, 20)).toBe(sheet.height);
      expect(bytes[24]).toBe(8);
      expect(bytes[25]).toBe(6);
      expect(hasChunk(bytes, "IDAT")).toBe(true);
    });
  }
});

describe("farming demo crop graphics wiring", () => {
  it("gives every crop record a graphic stage with a non-empty resourceId per stage", () => {
    const project = createFarmingDemoProject();
    const crops = project.database.crops ?? [];
    expect(crops.length).toBe(4);
    for (const crop of crops) {
      const graphicStages = crop.graphicStages ?? [];
      expect(graphicStages.length, `${crop.id} graphicStages`).toBe(crop.stages.length);
      for (const [index, stage] of graphicStages.entries()) {
        expect(stage.resourceId, `${crop.id} stage ${index}`).toBeTruthy();
        expect(stage.frame, `${crop.id} stage ${index} frame`).toBe(index);
      }
    }
  });

  it("points every crop graphic stage at a registered farming sprite asset with enough frames", () => {
    const project = createFarmingDemoProject();
    const assetById = new Map<string, FarmingCropSpriteAsset>(
      FARMING_CROP_SPRITE_ASSETS.map((asset) => [asset.id, asset])
    );
    for (const crop of project.database.crops ?? []) {
      for (const stage of crop.graphicStages ?? []) {
        const asset = assetById.get(stage.resourceId ?? "");
        expect(asset, `${crop.id} → ${stage.resourceId}`).toBeDefined();
        expect(typeof stage.frame).toBe("number");
        expect(Number(stage.frame)).toBeLessThan(asset?.frameCount ?? 0);
      }
    }
  });

  it("places a chicken and a cow on the farming demo map with farm charsets", () => {
    const project = createFarmingDemoProject();
    const map = project.maps["map_farming_demo"];
    expect(map).toBeDefined();
    const spriteIds = (map?.events ?? []).map((event) => event.pages?.[0]?.graphic.sprite?.id);
    expect(spriteIds).toContain("tex_farming_charset_chicken");
    expect(spriteIds).toContain("tex_farming_charset_cow");
  });
});

function hasChunk(bytes: Uint8Array, type: string): boolean {
  let offset = PNG_SIGNATURE.length;
  while (offset + 12 <= bytes.length) {
    const length = readUint32BE(bytes, offset);
    const chunkType = ascii(bytes, offset + 4, offset + 8);
    if (chunkType === type) return true;
    offset += length + 12;
  }
  return false;
}

function readUint32BE(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] ?? 0) * 0x1000000) + (((bytes[offset + 1] ?? 0) << 16) | ((bytes[offset + 2] ?? 0) << 8) | (bytes[offset + 3] ?? 0));
}

function ascii(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.slice(start, end));
}
