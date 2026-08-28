import { describe, expect, it } from "vitest";
import {
  parseStructureKitFile,
  serializeStructureKitFile,
  structureKitFileName,
  StructureKitFileError,
  STRUCTURE_KIT_FILE_VERSION,
} from "@/editor/harnessSuggestion/structureKitFile";
import { store } from "@/project/store";
import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";
import type { SectionStructureKitDef } from "@/project/types";

const AT = "2026-08-28T09:12:00.000Z";

function tileset() {
  return store.getCurrent().tilesets[DEFAULT_TILESET_ID]!;
}

function well(): SectionStructureKitDef {
  return {
    id: "kit_well",
    kind: "section",
    name: "우물",
    width: 2,
    height: 2,
    rows: [{ tiles: [421, 421] }, { tiles: [421, 116], upperTiles: [-1, 208] }],
    parts: [{ id: "p1", kind: "entrance", dx: 1, dy: 1, w: 1, h: 1 }],
    learnedFrom: "db-authored",
    ai: { description: "돌 우물", placementRules: "광장 중앙", repeatability: "fixed", origin: "user" },
  };
}

describe("serializeStructureKitFile", () => {
  it("판별자·버전·타일셋·킷을 담는다", () => {
    const json = JSON.parse(serializeStructureKitFile(tileset(), [well()], AT));
    expect(json.format).toBe("rpgzzu-structure-kits");
    expect(json.version).toBe(STRUCTURE_KIT_FILE_VERSION);
    expect(json.exportedAt).toBe(AT);
    expect(json.tileset.id).toBe(DEFAULT_TILESET_ID);
    expect(json.tileset.name).toBe(tileset().name);
    expect(json.kits).toHaveLength(1);
    expect(json.kits[0].name).toBe("우물");
    expect(json.kits[0].parts[0].kind).toBe("entrance");
    expect(json.kits[0].ai.description).toBe("돌 우물");
  });

  it("낱개든 묶음이든 kits 는 항상 배열이다", () => {
    const one = JSON.parse(serializeStructureKitFile(tileset(), [well()], AT));
    const many = JSON.parse(serializeStructureKitFile(tileset(), [well(), { ...well(), id: "k2", name: "다리" }], AT));
    expect(Array.isArray(one.kits)).toBe(true);
    expect(one.kits).toHaveLength(1);
    expect(many.kits).toHaveLength(2);
  });

  it("집 킷은 굳혀서 담는다 — 파일에 들어가는 순간 사진이 된다", () => {
    const house = {
      id: "kit_house",
      kind: "house" as const,
      name: "통나무집",
      houseKitId: "log",
      wings: [{ x: 0, y: 0, w: 5, h: 5 }],
      learnedFrom: "builtin-parametric" as const,
    };
    const json = JSON.parse(serializeStructureKitFile(tileset(), [house], AT));
    expect(json.kits[0].kind).toBe("section");
    expect(Array.isArray(json.kits[0].rows)).toBe(true);
    expect(json.kits[0].houseKitId).toBeUndefined();
  });
});

describe("parseStructureKitFile", () => {
  it("왕복한다", () => {
    const { file, diagnostics } = parseStructureKitFile(serializeStructureKitFile(tileset(), [well()], AT));
    expect(diagnostics).toHaveLength(0);
    expect(file.tileset.id).toBe(DEFAULT_TILESET_ID);
    expect(file.kits[0]!.name).toBe("우물");
    expect(file.kits[0]!.rows[1]!.upperTiles).toEqual([-1, 208]);
  });

  it("JSON 이 아니면 던진다", () => {
    expect(() => parseStructureKitFile("이건 JSON 이 아님")).toThrow(StructureKitFileError);
  });

  it("판별자가 없으면 던진다 — 프로젝트 파일을 잘못 고른 경우", () => {
    expect(() => parseStructureKitFile(JSON.stringify({ version: 1, kits: [] }))).toThrow(StructureKitFileError);
  });

  it("더 새 버전이면 던지고 이유를 말한다", () => {
    const text = JSON.stringify({
      format: "rpgzzu-structure-kits",
      version: STRUCTURE_KIT_FILE_VERSION + 1,
      tileset: { id: "x", name: "x" },
      kits: [],
    });
    expect(() => parseStructureKitFile(text)).toThrow(/더 새 버전/);
  });

  it("킷 12개 중 3개가 깨져도 나머지 9개는 살아남는다", () => {
    const good = well();
    const kits: unknown[] = [];
    for (let i = 0; i < 12; i += 1) {
      if (i === 2) kits.push({ ...good, id: `k${i}`, rows: [] });                       // rows.length ≠ height
      else if (i === 5) kits.push({ ...good, id: `k${i}`, width: 0 });                  // 폭이 0
      else if (i === 9) kits.push({ ...good, id: `k${i}`, rows: [{ tiles: [421] }, { tiles: [421, 421] }] }); // 행 길이 불일치
      else kits.push({ ...good, id: `k${i}` });
    }
    const text = JSON.stringify({
      format: "rpgzzu-structure-kits",
      version: STRUCTURE_KIT_FILE_VERSION,
      exportedAt: AT,
      tileset: { id: DEFAULT_TILESET_ID, name: "합본 마을" },
      kits,
    });

    const { file, diagnostics } = parseStructureKitFile(text);
    expect(file.kits).toHaveLength(9);
    expect(diagnostics).toHaveLength(3);
    expect(diagnostics.map((d) => d.index).sort((a, b) => a - b)).toEqual([2, 5, 9]);
    for (const diagnostic of diagnostics) {
      expect(diagnostic.reason.length).toBeGreaterThan(0);
    }
  });

  it("section 이 아닌 킷은 거른다", () => {
    const text = JSON.stringify({
      format: "rpgzzu-structure-kits",
      version: STRUCTURE_KIT_FILE_VERSION,
      tileset: { id: DEFAULT_TILESET_ID, name: "합본 마을" },
      kits: [{ id: "h", kind: "house", name: "집", houseKitId: "log", wings: [], learnedFrom: "user-paint" }],
    });
    const { file, diagnostics } = parseStructureKitFile(text);
    expect(file.kits).toHaveLength(0);
    expect(diagnostics).toHaveLength(1);
  });
});

describe("structureKitFileName", () => {
  it("낱개는 구조물 이름을 쓴다", () => {
    expect(structureKitFileName("합본 마을", [well()])).toBe("우물.rpgzzu-kit.json");
  });

  it("묶음은 타일셋 이름과 개수를 쓴다", () => {
    expect(structureKitFileName("합본 마을", [well(), { ...well(), id: "k2" }]))
      .toBe("합본 마을-구조물-2개.rpgzzu-kit.json");
  });
});
