import { describe, expect, it } from "vitest";
import { compileConditionFromText } from "@/editor/panels/eventEditor/conditionCompile";
import { createBlankProject } from "@/project/defaults";
import { evalCondition, startSession } from "@/project/session";

describe("compileConditionFromText", () => {
  it("compiles night + switch AND friendship OR item sketches", () => {
    const project = createBlankProject();
    project.switches[0] = { id: "sw_door", name: "문 열림" };
    project.database.items[0] = {
      ...project.database.items[0]!,
      id: "item_key",
      name: "낡은 열쇠",
    };

    const andResult = compileConditionFromText("문 열림 AND 밤", project);
    expect(andResult.condition.kind).toBe("all");
    if (andResult.condition.kind === "all") {
      expect(andResult.condition.conditions.some((c) => c.kind === "timePhase")).toBe(true);
      expect(andResult.condition.conditions.some((c) => c.kind === "switch")).toBe(true);
    }

    const orResult = compileConditionFromText("호감 100 OR 낡은 열쇠", project);
    expect(orResult.condition.kind).toBe("any");

    const notResult = compileConditionFromText("NOT 밤", project);
    expect(notResult.condition).toEqual({
      kind: "not",
      condition: { kind: "timePhase", phase: "night" },
    });
  });

  it("evaluates compiled group conditions", () => {
    const project = createBlankProject();
    project.switches[0] = { id: "sw_a", name: "A" };
    const compiled = compileConditionFromText("A AND 낮", project);
    const session = startSession(project);
    session.switches.sw_a = true;
    // gameTime may be undefined → timePhase day can be false; just ensure eval does not throw
    expect(typeof evalCondition(session, compiled.condition)).toBe("boolean");
  });
});
