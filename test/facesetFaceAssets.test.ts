import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  FACESET_FACE_ASSETS,
  LEGACY_FACESET_SHEET_IDS,
  faceIdForSheetCell,
} from "@/assets/facesetFaceAssets";

describe("얼굴 낱장 에셋 목록", () => {
  it("7장의 시트를 16칸씩 쪼갠 112개 낱장을 등록한다", () => {
    expect(LEGACY_FACESET_SHEET_IDS).toHaveLength(7);
    expect(FACESET_FACE_ASSETS).toHaveLength(112);

    const ids = new Set(FACESET_FACE_ASSETS.map((face) => face.id));
    expect(ids.size).toBe(112);
    for (const sheetId of LEGACY_FACESET_SHEET_IDS) {
      expect(FACESET_FACE_ASSETS.filter((face) => face.sheetResourceId === sheetId)).toHaveLength(16);
    }
    expect(FACESET_FACE_ASSETS.map((face) => face.sheetIndex)).toEqual(
      LEGACY_FACESET_SHEET_IDS.flatMap(() => [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15])
    );
  });

  it("시트 id + 칸 번호를 낱장 id 로 바꾼다", () => {
    expect(faceIdForSheetCell("easyrpg-faceset-actor1", 7)).toBe("easyrpg-faceset-actor1-07");
    expect(faceIdForSheetCell("easyrpg-faceset-people1", 15)).toBe("easyrpg-faceset-people1-15");
    expect(faceIdForSheetCell("generated-actor-hero-01-face", 7)).toBe("generated-actor-hero-01-face-07");
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
    expect(hero).toMatchObject({
      name: "hero-01-face 얼굴 1",
      path: "assets/generated/starter/hero-01-face/00.png",
      sheetResourceId: "generated-actor-hero-01-face",
      sheetIndex: 0,
    });
  });
});
