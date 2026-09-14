import { describe, expect, it } from "vitest";
import { completeWorkItemById, openWorkItemIds, type WorkPlan } from "@/ai/workPlan";

function planWith(successTools: readonly string[]): WorkPlan {
  return {
    goal: "마을 손보기",
    currentItemId: "i1",
    layers: [{ id: "l1", title: "레이어", items: [
      { id: "i1", title: "안내원 배치", status: "in_progress", successTools: [...successTools] },
      { id: "i2", title: "간판 세우기", status: "pending" },
    ] }],
  } as unknown as WorkPlan;
}

// F4(`.omo/evidence/ai-assistant-failure-modes.md`): 앞선 게이트·스키마 거부로 successTools 기록이
// 남지 않으면 항목을 영원히 닫을 수 없어, 같은 항목이 예산이 마를 때까지 재시도됐다.
describe("작업 항목 완료 — 선언한 툴 기록이 비었을 때", () => {
  it("기본값은 그대로 거부하고 누락된 툴을 알려준다", () => {
    const result = completeWorkItemById(planWith(["place_npc"]), "i1", undefined, { successfulTools: ["get_map_info"] });
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.missingTools).toEqual(["place_npc"]);
  });

  it("면제를 켜도 산출물 검사가 막으면 완료되지 않는다", () => {
    const plan = planWith(["place_npc"]);
    const result = completeWorkItemById(plan, "i1", undefined, {
      successfulTools: [],
      waiveMissingTools: true,
      outcomeGate: () => ({ ok: false, reason: "⚠ 미이행: 실제 변경이 없습니다(체인지셋 0건)." }),
    });
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toContain("체인지셋 0건");
    expect(plan.layers[0]!.items[0]!.status).toBe("in_progress");
  });

  it("면제 + 산출물 검사 통과면 닫고, 무엇을 면제했는지 항목에 남긴다", () => {
    const plan = planWith(["place_npc"]);
    const result = completeWorkItemById(plan, "i1", undefined, {
      successfulTools: ["make_villager"],
      waiveMissingTools: true,
      outcomeGate: () => ({ ok: true }),
    });
    expect(result.ok).toBe(true);
    expect(result.ok === true && result.waivedTools).toEqual(["place_npc"]);
    expect(plan.layers[0]!.items[0]!.status).toBe("done");
    expect(plan.layers[0]!.items[0]!.note).toContain("place_npc");
    expect(plan.currentItemId).toBe("i2");
  });

  it("쓰기 기록 자체가 없으면 면제 대상이 아니다", () => {
    const plan = planWith([]);
    plan.layers[0]!.items[0]! = { ...plan.layers[0]!.items[0]!, requiresAnyWrite: true };
    const result = completeWorkItemById(plan, "i1", undefined, {
      successfulTools: [], waiveMissingTools: true, outcomeGate: () => ({ ok: true }),
    });
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toContain("쓰기 툴 기록이 없습니다");
  });

  it("막힌 항목도 유효한 id 목록에 넣는다", () => {
    const plan = planWith(["place_npc"]);
    plan.layers[0]!.items[0]! = { ...plan.layers[0]!.items[0]!, status: "blocked" };
    expect(openWorkItemIds(plan)).toEqual(["i1", "i2"]);
  });
});
