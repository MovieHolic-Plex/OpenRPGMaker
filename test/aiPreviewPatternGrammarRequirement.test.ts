import { describe, expect, it } from "vitest";
import { evaluateChipsetEligibility } from "@/project/aiPreviewContracts";
import { defaultTileset } from "@/project/defaults/defaultAssets";
import { roleCapabilities } from "@/project/tileRoles";

/** 주어진 역할의 그룹에서만 patternGrammar 를 떼고 적격성을 재평가한다. */
function eligibilityWithoutGrammarFor(role: string) {
  const tileset = defaultTileset();
  tileset.tileGroups = (tileset.tileGroups ?? []).map((group) =>
    group.role === role ? { ...group, patternGrammar: undefined } : group
  );
  return evaluateChipsetEligibility(tileset);
}

describe("패턴 문법 필수 역할 (특성화)", () => {
  it("terrain·water·wall 만 패턴 문법을 요구한다", () => {
    const tileset = defaultTileset();
    const required = ["terrain", "water", "wall"];
    const notRequired = ["building", "castle", "fence", "roof", "prop"];
    for (const role of required) {
      expect(roleCapabilities(tileset, role).requiresPatternGrammar, role).toBe(true);
    }
    for (const role of notRequired) {
      expect(roleCapabilities(tileset, role).requiresPatternGrammar, role).toBe(false);
    }
  });

  // 위 테스트는 능력 표만 본다 — needsPatternGrammar 를 한 번도 부르지 않는다.
  // 아래는 그 분기를 양방향으로 통과시켜, 판정이 항상 true/false 로 굳는 변이를 잡는다.
  it("문법을 잃은 wall 그룹은 후보에서 빠지고, 문법 없는 building 그룹은 남는다", () => {
    // wall: requiresPatternGrammar=true → 문법이 없어지면 의미 그룹이 사라진다.
    const wall = eligibilityWithoutGrammarFor("wall");
    expect(wall.eligible).toBe(false);
    const missing = wall.missingEvidence.find((evidence) => evidence.code === "missing_semantic_groups");
    expect(missing?.detail).toContain("wall");

    // building: requiresPatternGrammar=false → 문법이 없어도 적격을 유지한다.
    expect(eligibilityWithoutGrammarFor("building").eligible).toBe(true);
  });
});
