import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  AUTHORABLE_FACESET_FACE_ASSETS,
  FACESET_FACE_ASSETS,
  GENERATED_FACESET_FACE_IDS,
  LEGACY_FACESET_SHEET_IDS,
  faceIdForSheetCell,
} from "@/assets/facesetFaceAssets";

describe("얼굴 낱장 에셋 목록", () => {
  it("81장의 시트를 16칸씩 쪼갠 1296개 낱장을 등록한다", () => {
    expect(LEGACY_FACESET_SHEET_IDS).toHaveLength(81);
    expect(FACESET_FACE_ASSETS).toHaveLength(1296);

    const ids = new Set(FACESET_FACE_ASSETS.map((face) => face.id));
    expect(ids.size).toBe(1296);
    for (const sheetId of LEGACY_FACESET_SHEET_IDS) {
      expect(FACESET_FACE_ASSETS.filter((face) => face.sheetResourceId === sheetId)).toHaveLength(16);
    }
    expect(FACESET_FACE_ASSETS.map((face) => face.sheetIndex)).toEqual(
      LEGACY_FACESET_SHEET_IDS.flatMap(() => [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15])
    );
  });

  it("삭제된 starter 낱장을 저작 목록에 등록하지 않는다", () => {
    // 삭제된 두 starter 시트는 카탈로그에서도 제외한다.
    expect(GENERATED_FACESET_FACE_IDS.size).toBe(0);
    for (const id of GENERATED_FACESET_FACE_IDS) {
      expect(id.startsWith("generated-actor-hero-")).toBe(true);
    }
    expect(AUTHORABLE_FACESET_FACE_ASSETS).toHaveLength(1296 - GENERATED_FACESET_FACE_IDS.size);
    for (const face of AUTHORABLE_FACESET_FACE_ASSETS) {
      expect(GENERATED_FACESET_FACE_IDS.has(face.id)).toBe(false);
    }
  });

  it("시트 id + 칸 번호를 낱장 id 로 바꾼다", () => {
    expect(faceIdForSheetCell("easyrpg-faceset-actor1", 7)).toBe("easyrpg-faceset-actor1-07");
    expect(faceIdForSheetCell("easyrpg-faceset-people1", 15)).toBe("easyrpg-faceset-people1-15");
    expect(faceIdForSheetCell("generated-actor-hero-01-face", 7)).toBe("generated-actor-hero-01-face");
  });

  it("칸 번호가 없거나 범위를 벗어나면 0..15 로 가둔다", () => {
    expect(faceIdForSheetCell("easyrpg-faceset-actor1", 99)).toBe("easyrpg-faceset-actor1-15");
    expect(faceIdForSheetCell("easyrpg-faceset-actor1", -1)).toBe("easyrpg-faceset-actor1-00");
    expect(faceIdForSheetCell("easyrpg-faceset-actor1", undefined)).toBe("easyrpg-faceset-actor1-00");
    expect(faceIdForSheetCell("easyrpg-faceset-actor1", Number.NaN)).toBe("easyrpg-faceset-actor1-00");
    expect(faceIdForSheetCell("easyrpg-faceset-actor1", Number.POSITIVE_INFINITY)).toBe("easyrpg-faceset-actor1-00");
    expect(faceIdForSheetCell("easyrpg-faceset-actor1", 7.9)).toBe("easyrpg-faceset-actor1-07");
  });

  it("시트가 아닌 id 는 그대로 돌려준다", () => {
    expect(faceIdForSheetCell("easyrpg-faceset-actor1-07", 3)).toBe("easyrpg-faceset-actor1-07");
    expect(faceIdForSheetCell("generated-face-actor1-bust", 3)).toBe("generated-face-actor1-bust");
    expect(faceIdForSheetCell("", 3)).toBe("");
  });

  it("등록된 낱장 파일이 모두 디스크에 있다", () => {
    const missing = FACESET_FACE_ASSETS
      .filter((face) => !existsSync(path.join("public", face.path)))
      .map((face) => `${face.id}:${face.path}`);

    expect(missing).toEqual([]);
  });

  it("낱장 이름은 시트 이름과 1-based 칸 번호를 담는다", () => {
    const actor1 = FACESET_FACE_ASSETS.find((face) => face.id === "easyrpg-faceset-actor1-07");
    expect(actor1).toMatchObject({
      name: "Actor1 얼굴 8 · EasyRPG",
      path: "assets/easyrpg/faceset/Actor1/07.png",
      sheetResourceId: "easyrpg-faceset-actor1",
      sheetIndex: 7,
    });

    const hero = FACESET_FACE_ASSETS.find((face) => face.id === "generated-actor-hero-01-face-00");
    expect(hero).toBeUndefined();
  });
});

// A surviving UI alone is not a complete import: all common character sets must
// resolve to sixteen physical assets and retain their stable resource ids.
describe("복구된 공용 표정", () => {
  it("76캐릭터의 1216표정을 중복 없이 제공한다", async () => {
    const { FACE_EXPRESSION_SETS } = await import("@/assets/faceExpressionSets");
    expect(FACE_EXPRESSION_SETS).toHaveLength(76);
    const allFaces = FACE_EXPRESSION_SETS.flatMap(set => [...set.faces]);
    expect(allFaces).toHaveLength(1216);
    expect(new Set(allFaces.map(face => face.id)).size).toBe(1216);
    for (const set of FACE_EXPRESSION_SETS) {
      expect(set.faces).toHaveLength(16);
      expect(set.faces.every(face => face.sheetResourceId === set.id)).toBe(true);
    }
    for (const stem of ["monster-white-dragon", "monster-hood-skeleton", "monster-beast", "monster-red-helm"]) {
      expect(FACE_EXPRESSION_SETS.some(set => set.id === `shared-${stem}-expressions`)).toBe(true);
    }
  });
});
