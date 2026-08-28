import { describe, expect, it } from "vitest";
import {
  parseStructureKitFile,
  planImport,
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

  it("origin 을 파일에 적힌 그대로 보존한다 — 제로 부트스트랩", () => {
    const { file } = parseStructureKitFile(serializeStructureKitFile(tileset(), [well()], AT));
    expect(file.kits[0]!.ai?.origin).toBe("user");
  });

  it("origin 이 없으면 만들어내지 않는다", () => {
    const noOrigin = { ...well(), ai: { description: "d", placementRules: "p" } };
    const { file } = parseStructureKitFile(serializeStructureKitFile(tileset(), [noOrigin], AT));
    expect(file.kits[0]!.ai?.origin).toBeUndefined();
  });

  it("origin 이 알 수 없는 값이면 거른다 — user/ai 가 아닌 값을 통과시키지 않는다", () => {
    const text = JSON.stringify({
      format: "rpgzzu-structure-kits",
      version: STRUCTURE_KIT_FILE_VERSION,
      tileset: { id: DEFAULT_TILESET_ID, name: "합본 마을" },
      kits: [{ ...well(), ai: { description: "d", placementRules: "p", origin: "system" } }],
    });
    const { file } = parseStructureKitFile(text);
    expect(file.kits[0]!.ai?.origin).toBeUndefined();
  });

  it("role 이 알 수 없는 값이면 거르고, 알려진 값이면 통과시킨다", () => {
    const text = JSON.stringify({
      format: "rpgzzu-structure-kits",
      version: STRUCTURE_KIT_FILE_VERSION,
      tileset: { id: DEFAULT_TILESET_ID, name: "합본 마을" },
      kits: [
        { ...well(), id: "k_bad", ai: { description: "d", placementRules: "p", role: "garbage" } },
        { ...well(), id: "k_good", ai: { description: "d", placementRules: "p", role: "fence" } },
      ],
    });
    const { file } = parseStructureKitFile(text);
    expect(file.kits[0]!.ai?.role).toBeUndefined();
    expect(file.kits[1]!.ai?.role).toBe("fence");
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

describe("planImport", () => {
  function fileWith(kits: SectionStructureKitDef[], tilesetId = DEFAULT_TILESET_ID) {
    return parseStructureKitFile(JSON.stringify({
      format: "rpgzzu-structure-kits",
      version: STRUCTURE_KIT_FILE_VERSION,
      tileset: { id: tilesetId, name: "합본 마을" },
      kits,
    }));
  }

  it("같은 칩셋이면 경고가 없다", () => {
    const { file, diagnostics } = fileWith([well()]);
    const plan = planImport(file, tileset(), [], diagnostics);
    expect(plan.tilesetMismatch).toBe(false);
    expect(plan.candidates).toHaveLength(1);
    expect(plan.candidates[0]!.defaultChecked).toBe(true);
  });

  it("다른 칩셋이면 경고 플래그가 선다", () => {
    const { file, diagnostics } = fileWith([well()], "easyrpg_chipset_dungeon");
    const plan = planImport(file, tileset(), [], diagnostics);
    expect(plan.tilesetMismatch).toBe(true);
    expect(plan.fileTilesetName).toBe("합본 마을");
  });

  it("같은 모양이 이미 있으면 기본 체크를 푼다", () => {
    const existing = well();
    const { file, diagnostics } = fileWith([{ ...well(), id: "other_id", name: "다른 이름" }]);
    const plan = planImport(file, tileset(), [existing], diagnostics);
    expect(plan.candidates[0]!.duplicate).toBe(true);
    expect(plan.candidates[0]!.defaultChecked).toBe(false);
  });

  it("이름이 겹치고 모양이 다르면 개명한다", () => {
    const existing = { ...well(), id: "existing", rows: [{ tiles: [1, 1] }, { tiles: [1, 1] }] };
    const { file, diagnostics } = fileWith([well()]);
    const plan = planImport(file, tileset(), [existing], diagnostics);
    expect(plan.candidates[0]!.duplicate).toBe(false);
    expect(plan.candidates[0]!.nameConflict).toBe(true);
    expect(plan.candidates[0]!.resolvedName).toBe("우물 (2)");
  });

  it("파일 안에서 이름이 겹쳐도 서로 어긋나게 개명한다", () => {
    const a = well();
    const b = { ...well(), id: "k2", rows: [{ tiles: [9, 9] }, { tiles: [9, 9] }] };
    const { file, diagnostics } = fileWith([a, b]);
    const plan = planImport(file, tileset(), [], diagnostics);
    expect(plan.candidates.map((c) => c.resolvedName)).toEqual(["우물", "우물 (2)"]);
  });

  it("진단을 그대로 들고 간다", () => {
    const { file, diagnostics } = fileWith([{ ...well(), rows: [] } as unknown as SectionStructureKitDef]);
    const plan = planImport(file, tileset(), [], diagnostics);
    expect(plan.candidates).toHaveLength(0);
    expect(plan.diagnostics).toHaveLength(1);
  });
});
