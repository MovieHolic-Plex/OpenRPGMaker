// test/planToolExposure.test.ts
// 자율 런 계획 요구 툴 노출 — 도메인 게이트·40툴 상한과 무관하게 successTools/지시문 툴을 보장.

import { describe, expect, it } from "vitest";
import { planRequiredToolNames, planRequiredToolSchemas } from "@/ai/planToolExposure";
import type { WorkPlan } from "@/ai/workPlan";

function plan(items: Array<{ successTools?: readonly string[]; instruction?: string }>): WorkPlan {
  return {
    id: "wp_test",
    goal: "새 RPG 프로젝트를 만들어줘: plan_world로 시작, play_walkthrough로 검증. 프로젝트 제목: '자율 마을의 전설'.",
    createdAt: "2026-08-14T00:00:00.000Z",
    layers: [
      {
        id: "L1",
        title: "세계",
        items: items.map((item, index) => ({
          id: `L1-${index}`,
          title: `항목 ${index}`,
          instruction: item.instruction ?? "지시문",
          ...(item.successTools ? { successTools: item.successTools } : {}),
          status: "pending",
        })),
      },
    ],
  };
}

describe("planRequiredToolNames", () => {
  it("successTools 를 모두 수집한다", () => {
    const names = planRequiredToolNames(
      plan([
        { successTools: ["plan_world", "set_session_start"] },
        { successTools: ["build_village", "author_house"] },
        { successTools: ["verify_quest", "play_walkthrough"] },
      ]),
    );
    for (const want of ["plan_world", "set_session_start", "build_village", "author_house", "verify_quest", "play_walkthrough"]) {
      expect(names).toContain(want);
    }
  });

  it("지시문에 적힌 툴 이름도 수집한다(부분 문자열 오탐 없음)", () => {
    const names = planRequiredToolNames(
      plan([
        { instruction: "set_encounter_table + upsert_enemy/upsert_troop 5종을 만든다" },
        { instruction: "author_village 를 호출한다" },
      ]),
    );
    expect(names).toContain("set_encounter_table");
    expect(names).toContain("upsert_enemy");
    expect(names).toContain("upsert_troop");
    expect(names).toContain("author_village");
    // "village" 단독 토큰은 툴이 아니다 — author_village 와 혼동하지 않는다.
    expect(names).not.toContain("village");
  });

  it("목표문에 적힌 툴도 수집한다", () => {
    const names = planRequiredToolNames(plan([{ instruction: "아무것도 안 함" }]));
    expect(names).toContain("plan_world");
    expect(names).toContain("play_walkthrough");
  });

  it("중복을 제거한다", () => {
    const names = planRequiredToolNames(
      plan([
        { successTools: ["plan_world"], instruction: "plan_world 로 시작" },
        { successTools: ["plan_world"] },
      ]),
    );
    expect(names.filter((n) => n === "plan_world")).toHaveLength(1);
  });
});

describe("planRequiredToolSchemas", () => {
  it("레지스트리에 존재하는 툴만 스키마로 변환한다", () => {
    const schemas = planRequiredToolSchemas(
      plan([
        { successTools: ["plan_world", "no_such_tool_xyz", "play_walkthrough"] },
      ]),
    );
    const names = schemas.map((s) => s.function.name);
    expect(names).toContain("plan_world");
    expect(names).toContain("play_walkthrough");
    expect(names).not.toContain("no_such_tool_xyz");
    for (const schema of schemas) {
      expect(schema.type).toBe("function");
      expect(schema.function.parameters.type).toBe("object");
    }
  });

  it("deprecated 툴은 supersededBy 로 대체해 노출한다", () => {
    // build_village(v1)는 deprecated + supersededBy=author_village — 계획이 v1 을 요구해도 v2 가 노출된다.
    const schemas = planRequiredToolSchemas(plan([{ successTools: ["build_village"] }]));
    const names = schemas.map((s) => s.function.name);
    expect(names).toContain("author_village");
    expect(names).not.toContain("build_village");
    for (const schema of schemas) {
      expect(schema.type).toBe("function");
      expect(schema.function.description.length).toBeGreaterThan(0);
    }
  });
});
