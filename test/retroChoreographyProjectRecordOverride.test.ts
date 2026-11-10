import { describe, expect, it } from "vitest";
import { resolveRetroClassChoreography, resolveSkillChoreography } from "@/assets/retroSkillCatalog";
import { normalizeSkillChoreographyRecord } from "@/project/skillChoreographyRecords";
import type { SkillChoreographyRecord } from "@/project/types";

// 새라의 용기사 기술(skill_dragoon_*)은 id 자체가 계약 연출이라 프로젝트 연출 레코드를 붙여도 카엘 검 시트가 그려졌다.
const lance = normalizeSkillChoreographyRecord({
  id: "chor_test_lance", name: "창", motion: "dash-strike",
  layers: [{ sheet: "valkyrie_thrust", anchor: "target" }],
}) as SkillChoreographyRecord;

describe("project choreography record named by a contract-id skill", () => {
  it("keeps the contract when no project record is named", () => {
    expect(resolveSkillChoreography({ id: "skill_dragoon_sweeping_lance" }, [lance])?.id).toBe("skill_dragoon_sweeping_lance");
    expect(resolveRetroClassChoreography({ id: "skill_dragoon_sweeping_lance" }, [lance])?.layers.map((l) => l.key)).toContain("hero_whirl");
  });

  it("lets the named project record win over the skill's own contract", () => {
    const resolved = resolveSkillChoreography({ id: "skill_dragoon_sweeping_lance", retroChoreographyId: lance.id }, [lance]);
    expect(resolved?.origin).toBe("project");
    expect(resolved?.id).toBe(lance.id);
    const layers = resolveRetroClassChoreography({ id: "skill_dragoon_sweeping_lance", retroChoreographyId: lance.id }, [lance])!.layers.map((l) => l.key);
    expect(layers).toContain("valkyrie_thrust");
    expect(layers).not.toContain("hero_whirl");
  });

  it("falls back to the contract when the named record does not exist", () => {
    expect(resolveSkillChoreography({ id: "skill_dragoon_sweeping_lance", retroChoreographyId: "chor_missing" }, [lance])?.id).toBe("skill_dragoon_sweeping_lance");
    expect(resolveSkillChoreography({ id: "skill_dragoon_sweeping_lance", retroChoreographyId: lance.id }, undefined)?.id).toBe("skill_dragoon_sweeping_lance");
  });

  it("still keeps an own contract ahead of another contract id", () => {
    expect(resolveRetroClassChoreography({ id: "skill_ranger_snipe", retroChoreographyId: "skill_gunner_snipe" })?.id).toBe("skill_ranger_snipe");
  });
});
