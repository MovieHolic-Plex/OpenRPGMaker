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
  ORCHESTRATOR_SYSTEM_PROMPT,
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

  it("does not auto-complete items without successTools on unrelated writes", () => {
    const plan = workPlanFromOrchestratorDecision({
      action: "new_plan",
      goal: "g",
      layers: [
        {
          title: "L",
          items: [
            { title: "탁자", instruction: "place_props table" },
            { title: "NPC", instruction: "place_npc", successTools: ["place_npc"] },
          ],
        },
      ],
    });
    const stuck = advanceWorkPlanFromTools(plan, ["place_npc"]);
    expect(stuck.completed).toBeNull();
    expect(stuck.next?.title).toBe("탁자");
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
    expect(completeWorkItemById(plan, "a").ok).toBe(true);
    expect(completeWorkItemById(plan, "b").ok).toBe(true);
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
    expect(completeWorkItemById(plan, "a").ok).toBe(true);
    expect(shouldRalphContinue(plan, { autoStepsUsed: 0 })).toBe(false);
  });

  it("rejects complete when successTools were not used", () => {
    const plan = workPlanFromOrchestratorDecision({
      action: "new_plan",
      goal: "g",
      layers: [
        {
          title: "L",
          items: [{ title: "탁자", instruction: "place_props table", successTools: ["place_props"] }],
        },
      ],
    });
    const id = plan.currentItemId!;
    const blocked = completeWorkItemById(plan, id, "못 함", { successfulWriteTools: ["place_npc"] });
    expect(blocked.ok).toBe(false);
    if (blocked.ok) throw new Error("expected fail");
    expect(blocked.reason).toContain("place_props");
    expect(plan.layers[0]!.items[0]!.status).toBe("in_progress");

    const ok = completeWorkItemById(plan, id, "done", { successfulWriteTools: ["place_props"] });
    expect(ok.ok).toBe(true);
    expect(isWorkPlanComplete(plan)).toBe(true);
  });
});

describe("canonical construction routing in work plans", () => {
  it("플래너 예시는 목표·정확 수량을 갖춘 공식 facade만 권장한다", () => {
    expect(ORCHESTRATOR_SYSTEM_PROMPT).toContain("author_house");
    expect(ORCHESTRATOR_SYSTEM_PROMPT).toContain("author_village");
    expect(ORCHESTRATOR_SYSTEM_PROMPT).toContain("목표 맵");
    expect(ORCHESTRATOR_SYSTEM_PROMPT).toContain("정확한 수량");
    expect(ORCHESTRATOR_SYSTEM_PROMPT).not.toMatch(/build_house_kit|build_house_lots|build_village|run_village_session|run_village_pipeline/);
  });

  it("폴백 계획의 야외 집과 마을 successTools는 각각 공식 facade만 쓴다", () => {
    const house = buildDefaultWorkPlan("현재 맵에 야외 집 2채를 지어줘", new Date("2026-07-18T00:00:00.000Z"));
    expect(house.layers[0]?.items[0]?.successTools).toEqual(["author_house"]);
    const village = buildDefaultWorkPlan("현재 맵에 집 6채 마을을 만들어줘", new Date("2026-07-18T00:00:00.000Z"));
    expect(village.layers[0]?.items[0]?.successTools).toEqual(["author_village"]);
  });
  it.each(["100x100 city", "winter town", "snow settlement", "대도시", "겨울 도시", "눈 정착지"])(
    "routes %s through author_village",
    (goal) => {
      const plan = buildDefaultWorkPlan(goal, new Date("2026-07-18T00:00:00.000Z"));
      expect(plan.layers[0]?.items[0]?.successTools).toEqual(["author_village"]);
    },
  );
});
