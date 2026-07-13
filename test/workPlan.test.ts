import { describe, expect, it } from "vitest";
import {
  advanceWorkPlanFromTools,
  buildDefaultWorkPlan,
  completeWorkItemById,
  formatRalphContinueMessage,
  formatWorkPlanForOrchestration,
  isWorkPlanComplete,
  parseOrchestratorDecision,
  shouldRalphContinue,
  workPlanFromOrchestratorDecision,
  workPlanFromSetToolArgs,
  buildOrchestratorUserPayload,
  summarizeWorkPlan,
  MAX_WORK_PLAN_AUTO_STEPS_PER_TURN,
} from "@/ai/workPlan";

describe("planner LLM plan parsing (no regex planning)", () => {
  it("parses new_plan JSON from main planner", () => {
    const raw = JSON.stringify({
      action: "new_plan",
      goal: "100x100 장터 + 30분 퀘스트",
      plannerNote: "hub then side maps then quests",
      layers: [
        {
          title: "허브",
          items: [
            {
              title: "마을 시공",
              instruction: "build_village width 100 height 100 houses 16",
              doneWhen: "100x100 hub map with houses exists",
              successTools: ["build_village"],
            },
          ],
        },
        {
          title: "퀘스트",
          items: [
            {
              title: "Q1",
              instruction: "place_npc 미르 + choices",
              doneWhen: "미르 NPC with dialogue choices",
              successTools: ["place_npc", "upsert_event"],
            },
          ],
        },
      ],
    });
    const decision = parseOrchestratorDecision(raw);
    expect(decision?.action).toBe("new_plan");
    if (!decision || decision.action === "direct" || decision.action === "resume") throw new Error("expected plan");
    const plan = workPlanFromOrchestratorDecision(decision);
    expect(plan.layers).toHaveLength(2);
    expect(plan.currentItemId).toBeTruthy();
    expect(summarizeWorkPlan(plan).itemsTotal).toBe(2);
    expect(formatWorkPlanForOrchestration(plan)).toContain("Worker instruction");
    expect(formatWorkPlanForOrchestration(plan)).toContain("Done when");
  });

  it("parses fenced JSON and direct action", () => {
    const fenced = "```json\n{\"action\":\"direct\",\"reason\":\"one NPC line\"}\n```";
    expect(parseOrchestratorDecision(fenced)).toEqual({ action: "direct", reason: "one NPC line" });
  });

  it("parses resume", () => {
    expect(parseOrchestratorDecision('{"action":"resume","reason":"user said continue"}')?.action).toBe("resume");
  });

  it("builds planner user payload with active plan", () => {
    const plan = buildDefaultWorkPlan("fallback goal for payload test");
    const payload = buildOrchestratorUserPayload({
      userText: "계속",
      activePlan: plan,
      projectSummary: "maps=1",
    });
    expect(payload).toContain("User request");
    expect(payload).toContain("Active WorkPlan");
    expect(payload).toContain("use action=resume");
  });

  it("builds plan from set_work_plan tool args", () => {
    const plan = workPlanFromSetToolArgs({
      goal: "작은 숲 맵",
      layers: [
        {
          title: "맵",
          items: [{ title: "생성", instruction: "create_map 40x40 forest", successTools: ["create_map"] }],
        },
      ],
    });
    expect(plan).not.toBeNull();
    expect(plan!.goal).toBe("작은 숲 맵");
    expect(plan!.currentItemId).toBeTruthy();
  });
});

describe("workPlan progress harness", () => {
  it("advances when successTools match", () => {
    const plan = workPlanFromOrchestratorDecision({
      action: "new_plan",
      goal: "g",
      layers: [
        {
          title: "L",
          items: [
            { title: "A", instruction: "do A", successTools: ["build_village"] },
            { title: "B", instruction: "do B", successTools: ["place_npc"] },
          ],
        },
      ],
    });
    const first = plan.currentItemId;
    const { completed, next } = advanceWorkPlanFromTools(plan, ["build_village"]);
    expect(completed?.id).toBe(first);
    expect(next?.title).toBe("B");
  });

  it("completes all via completeWorkItemById", () => {
    const plan = workPlanFromOrchestratorDecision({
      action: "new_plan",
      goal: "g",
      layers: [
        {
          title: "L",
          items: [
            { id: "a", title: "A", instruction: "a" },
            { id: "b", title: "B", instruction: "b" },
          ],
        },
      ],
    });
    completeWorkItemById(plan, "a");
    completeWorkItemById(plan, "b");
    expect(isWorkPlanComplete(plan)).toBe(true);
  });

  it("Ralph continues while plan incomplete and under cap", () => {
    const plan = workPlanFromOrchestratorDecision({
      action: "new_plan",
      goal: "g",
      layers: [
        {
          title: "L",
          items: [
            { title: "A", instruction: "do A" },
            { title: "B", instruction: "do B" },
          ],
        },
      ],
    });
    expect(shouldRalphContinue(plan, { autoStepsUsed: 0 })).toBe(true);
    expect(shouldRalphContinue(plan, { autoStepsUsed: MAX_WORK_PLAN_AUTO_STEPS_PER_TURN })).toBe(false);
    expect(
      shouldRalphContinue(plan, {
        autoStepsUsed: 0,
        assistantText: "어떤 스타일로 할까요?",
      })
    ).toBe(false);
    expect(formatRalphContinueMessage(plan)).toContain("RALPH CONTINUE");
  });

  it("Ralph stops when plan complete", () => {
    const plan = workPlanFromOrchestratorDecision({
      action: "new_plan",
      goal: "g",
      layers: [{ title: "L", items: [{ id: "a", title: "A", instruction: "a" }] }],
    });
    completeWorkItemById(plan, "a");
    expect(shouldRalphContinue(plan, { autoStepsUsed: 0 })).toBe(false);
  });
});
