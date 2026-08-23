// 2026-08-23 실측 회귀: `elementRates:{fire:"C",water:"A",grass:"D"}` 에서 `grass` 만 DB 속성이
// 아니었는데 커밋 전체가 거부됐고, 모델의 재시도는 elementRates 를 아예 빼버려 "불에 강하고 물에 약한"
// 의도가 조용히 사라졌다(전 속성 기본 C). 유효한 키는 살리고 무효한 키만 경고와 함께 버려야 한다.
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools/toolRunner";
import { createBlankProject } from "@/project/defaults";

describe("elementRates 부분 수용", () => {
  it("DB에 없는 속성 키만 버리고 유효한 등급은 유지한다", () => {
    const ctx = { project: createBlankProject() };
    const elementIds = (ctx.project.database.elements ?? []).map((element) => element.id);
    expect(elementIds).toContain("fire");
    expect(elementIds).not.toContain("grass");

    const result = runTool(ctx, "upsert_enemy", {
      enemy: {
        id: "enemy_flame_slime",
        name: "불꽃 슬라임",
        stats: { maxHp: 90, attack: 42 },
        rewards: { exp: 8, gold: 5 },
        elementRates: { fire: "C", water: "A", grass: "D" },
      },
    });

    expect(result.ok).toBe(true);
    const stored = ctx.project.database.enemies.find((enemy) => enemy.id === "enemy_flame_slime");
    expect(stored?.elementRates?.fire).toBe("C");
    expect(stored?.elementRates?.water).toBe("A");
    expect(stored?.elementRates?.grass).toBeUndefined();
    // 무엇을 버렸고 무엇이 유효한지 알려야 모델이 다음 호출을 고칠 수 있다.
    const warnings = [...(result.warnings ?? []), ...(result.diff?.warnings ?? [])].join(" ");
    expect(warnings).toContain("grass");
    expect(warnings).toContain("set_type_chart");
  });

  it("속성 타입을 speciesId로 잘못 보낸 신규 적도 종 참조만 제외하고 생성한다", () => {
    const ctx = { project: createBlankProject() };
    const result = runTool(ctx, "upsert_enemy", {
      enemy: {
        id: "enemy_fire_qa",
        name: "불꽃 정령",
        speciesId: "fire",
        stats: { maxHp: 80, attack: 30 },
        rewards: { exp: 4, gold: 2 },
      },
    });

    expect(result.ok, JSON.stringify(result.issues)).toBe(true);
    expect(ctx.project.database.enemies.find((enemy) => enemy.id === "enemy_fire_qa")?.speciesId).toBeUndefined();
    const warnings = [...(result.warnings ?? []), ...(result.diff?.warnings ?? [])].join(" ");
    expect(warnings).toContain("speciesId");
    expect(warnings).toContain("set_type_chart");
  });
});
