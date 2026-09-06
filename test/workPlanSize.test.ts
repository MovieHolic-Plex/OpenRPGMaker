import { describe, expect, it } from "vitest";
import {
  buildDefaultWorkPlan,
  getCurrentWorkItem,
  parseOrchestratorDecision,
  parsePlannerVolume,
  summarizeWorkPlan,
  workPlanFromOrchestratorDecision,
  workPlanFromSetToolArgs,
} from "@/ai/workPlan";

const tasks = Array.from({ length: 320 }, (_, index) => ({
  id: `independent-${index}`,
  title: `Record ${index}`,
  instruction: JSON.stringify({ recordId: index, values: Array.from({ length: 120 }, (_, value) => value) }),
  doneWhen: JSON.stringify({ recordId: index, fields: ["id", "name", "price"], verified: true }),
  successTools: ["get_database_records"],
}));
const goal = JSON.stringify({ requestedRecords: tasks.map(task => task.id), preserve: "original-values" });
const input = {
  action: "new_plan" as const,
  goal,
  layers: Array.from({ length: 16 }, (_, layer) => ({
    id: `layer-${layer}`,
    title: `Records ${layer}`,
    items: tasks.slice(layer * 20, (layer + 1) * 20),
  })),
};

describe("large authored work plans", () => {
  it("keeps every independently authored item and its parsed data", () => {
    // Given a large complete planner response, when parsed, then no item is compressed away.
    const parsed = parseOrchestratorDecision(JSON.stringify(input)).decision;
    if (!parsed || parsed.action === "direct" || parsed.action === "resume") throw new Error("Expected a plan");
    const plan = workPlanFromOrchestratorDecision(parsed);
    expect(plan.layers.flatMap(layer => layer.items).map(({ id, title, instruction, doneWhen, successTools }) => ({
      id, title, instruction, doneWhen, successTools,
    }))).toEqual(tasks);
    expect(summarizeWorkPlan(plan).itemsTotal).toBe(320);
  });

  it("preserves the complete parsed goal in both planner and in-loop authoring", () => {
    // Given a goal carrying every requested record ID, neither authoring path may truncate it.
    const parsed = parseOrchestratorDecision(JSON.stringify(input)).decision;
    if (!parsed || parsed.action === "direct" || parsed.action === "resume") throw new Error("Expected a plan");
    const plans = [workPlanFromOrchestratorDecision(parsed), workPlanFromSetToolArgs(input)];
    for (const plan of plans) {
      expect(plan?.goal).toBe(goal);
      expect(plan?.layers.flatMap(layer => layer.items).at(-1)?.id).toBe("independent-319");
    }
  });

  it("keeps the complete user payload in emergency fallback goals and instructions", () => {
    // Given a failed planner's original request, fallback must preserve every requested record.
    const fallback = buildDefaultWorkPlan(goal);
    expect(fallback.goal).toBe(goal);
    expect(getCurrentWorkItem(fallback)?.instruction).toBe(goal);
  });

  it("does not lower planner-declared output quantities to an arbitrary ceiling", () => {
    // Given explicit large output quantities, parsed acceptance volume remains exact.
    const volume = { authoredMaps: 128, multiPageNpcs: 512, shops: 76, quests: 96 };
    expect(parsePlannerVolume(volume)).toEqual(volume);
  });

  it("still normalizes invalid negative and nonfinite quantities", () => {
    // Given invalid boundary numbers, removing the authoring ceiling does not accept them.
    expect(parsePlannerVolume({ authoredMaps: -1, multiPageNpcs: Infinity, shops: 7.9, quests: NaN }))
      .toEqual({ authoredMaps: 0, multiPageNpcs: 0, shops: 7, quests: 0 });
  });
});
