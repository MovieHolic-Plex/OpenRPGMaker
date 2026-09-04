import { describe, expect, it } from "vitest";
import { BUILTIN_HOUSE_STRUCTURE_KITS, builtinHouseStructureKitsFor } from "@/editor/harnessSuggestion/builtinHouseStructureKits";

describe("내장 집 스탬프 제거", () => {
  it("내장 목록은 비어 있다 — 집 외장은 author_house 정본이 담당한다", () => {
    expect(BUILTIN_HOUSE_STRUCTURE_KITS).toHaveLength(0);
    expect(builtinHouseStructureKitsFor({ id: "combined_town" })).toHaveLength(0);
    expect(builtinHouseStructureKitsFor({ id: "easyrpg_chipset_interior" })).toHaveLength(0);
  });
});
