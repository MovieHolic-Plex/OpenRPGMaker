import { describe, expect, it } from "vitest";
import { createFarmingDemoProject } from "@/project/defaults/defaultProject";
import { FARMING_CROP_SPRITE_ASSETS, type FarmingCropSpriteAsset } from "@/assets/farmingSprites";
import { cropGraphicIndexForStage, cropGraphicStages, normalizeCropRecord } from "@/project/farmModel";

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
  { file: "crop_blueberry.png", width: 32, height: 16 },
  { file: "crop_melon.png", width: 48, height: 16 },
  { file: "crop_pumpkin.png", width: 48, height: 16 },
  { file: "crop_eggplant.png", width: 32, height: 16 },
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

describe("registered farming crop sprite assets", () => {
  it("registers one asset per shipped sheet with a frameCount matching the sheet width", () => {
    expect(FARMING_CROP_SPRITE_ASSETS).toHaveLength(CROP_SHEETS.length);
    const sheetByFile = new Map<string, { readonly width: number; readonly height: number }>(
      CROP_SHEETS.map((sheet) => [sheet.file, sheet]),
    );
    for (const asset of FARMING_CROP_SPRITE_ASSETS) {
      const sheet = sheetByFile.get(asset.path.split("/").pop() ?? "");
      expect(sheet, asset.id).toBeDefined();
      expect(asset.frameCount, asset.id).toBe((sheet?.width ?? 0) / asset.frameWidth);
      expect(asset.frameHeight).toBe(sheet?.height);
    }
  });
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
    // 개수를 못 박지 않는다 — 작물을 추가할 때마다 이 계약과 무관한 이유로 빨개진다.
    // 지켜야 할 계약은 "모든 작물이 단계마다 유효한 그림을 갖는다" 하나다.
    expect(crops.length, "농사 데모에 작물이 없다").toBeGreaterThan(0);
    // 네 계절 모두 심을 것이 있어야 한다 — 봄만 있으면 나머지 세 계절에 밭이 죽고 할 일이 없다.
    const seasons = new Set(crops.flatMap((crop) => crop.seasons));
    for (const season of ["spring", "summer", "fall"]) {
      expect(seasons.has(season as "spring"), `${season} 에 심을 작물이 없다`).toBe(true);
    }
    for (const crop of crops) {
      const graphicStages = crop.graphicStages ?? [];
      expect(graphicStages.length, `${crop.id} graphicStages`).toBe(crop.stages.length);
      for (const [index, stage] of graphicStages.entries()) {
        expect(stage.resourceId, `${crop.id} stage ${index}`).toBeTruthy();
        expect(stage.frame, `${crop.id} stage ${index} frame`).toBe(index);
      }
    }
  });

  it("derives graphic stages for an unauthored crop at read time, clamping frames to the sheet", () => {
    // 저작 graphicStages 없이 id 만으로 스프라이트가 붙어야 한다(감자 시트 = 2 프레임).
    const crop = normalizeCropRecord({
      id: "crop_potato",
      name: "감자",
      harvestItemId: "item_potato",
      stages: [{ days: 1 }, { days: 1 }, { days: 1 }],
    });
    const stages = cropGraphicStages(crop);
    expect(stages.length).toBe(crop.stages.length);
    expect(stages.map((stage) => stage.frame)).toEqual([0, 1, 1]);
    for (const stage of stages) expect(stage.resourceId).toBe("farming-crop-potato");

    // 등록된 스프라이트가 없는 작물은 아무 stage 도 만들지 않는다.
    const unknown = normalizeCropRecord({ id: "crop_durian", name: "두리안", stages: [{ days: 1 }] });
    expect(cropGraphicStages(unknown)).toEqual([]);
  });

  it("never writes derived graphic stages into the record, and honors an empty authored list as opt-out", () => {
    // 저작하지 않은 아트가 레코드에 심기면 직렬화가 그것을 프로젝트에 새기고 작가는 되돌릴 수 없다.
    const inferred = normalizeCropRecord({ id: "crop_melon", name: "수박", stages: [{ days: 1 }, { days: 1 }] });
    expect(inferred.graphicStages).toBeUndefined();
    expect(JSON.parse(JSON.stringify(inferred))).not.toHaveProperty("graphicStages");
    // 그래도 화면에는 등록 스프라이트가 붙는다.
    expect(cropGraphicStages(inferred).map((stage) => stage.resourceId)).toEqual([
      "farming-crop-melon",
      "farming-crop-melon",
    ]);

    // 번 배열은 "아트 없음" 선언이다 — 자동 배선이 다시 끊어들면 opt-out 이 불가능해진다.
    const optedOut = normalizeCropRecord({
      id: "crop_melon",
      name: "수박",
      stages: [{ days: 1 }],
      graphicStages: [],
    });
    expect(optedOut.graphicStages).toEqual([]);
    expect(cropGraphicStages(optedOut)).toEqual([]);
  });

  it("points every crop graphic stage at a registered farming sprite asset with enough frames", () => {
    const project = createFarmingDemoProject();
    const assetById = new Map<string, FarmingCropSpriteAsset>(
      FARMING_CROP_SPRITE_ASSETS.map((asset) => [asset.id, asset])
    );
    for (const crop of project.database.crops ?? []) {
      for (const stage of cropGraphicStages(crop)) {
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

describe("cropGraphicIndexForStage", () => {
  // 마지막 그림은 수확 가능 전용이다. 예약하지 않으면 익기 전 마지막 단계와 수확기가
  // 같은 그림이 되어 플레이어가 익은 것을 구별할 수 없다.
  it("reserves the last graphic for the ready stage when graphics match growth stages", () => {
    // 감자: 성장 단계 2 · 그림 2
    expect(cropGraphicIndexForStage(2, 2, 0)).toBe(0);
    expect(cropGraphicIndexForStage(2, 2, 1)).toBe(0);
    expect(cropGraphicIndexForStage(2, 2, 2)).toBe(1); // 수확 가능
    expect(cropGraphicIndexForStage(2, 2, 9)).toBe(1); // 단계가 넘쳐도 수확기 그림
  });

  it("maps stages straight through when the author supplied a ready frame", () => {
    // 그림 3 · 단계 2 — 중간 단계에 자기 그림이 있는 배선은 그대로 존중한다.
    expect(cropGraphicIndexForStage(3, 2, 0)).toBe(0);
    expect(cropGraphicIndexForStage(3, 2, 1)).toBe(1);
    expect(cropGraphicIndexForStage(3, 2, 2)).toBe(2);
  });

  it("uses the only graphic when there is nothing to reserve", () => {
    expect(cropGraphicIndexForStage(1, 3, 0)).toBe(0);
    expect(cropGraphicIndexForStage(1, 3, 3)).toBe(0);
  });

  it("reports no graphic when the crop has none", () => {
    expect(cropGraphicIndexForStage(0, 2, 1)).toBe(-1);
  });

  it("treats a negative or fractional stage as the first growing stage", () => {
    expect(cropGraphicIndexForStage(3, 3, -2)).toBe(0);
    expect(cropGraphicIndexForStage(3, 3, 1.9)).toBe(1);
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
