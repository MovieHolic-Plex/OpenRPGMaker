// 팀을 켠 채 「마을 만들어」를 보내면 팀으로 돈다. 예전엔 마을 계약이 걸려 runPiCommand 가 팀을 조용히 껐다
// (2026-09-18 이후 일반 채팅 67회 실행 중 팀 실행 0회 — 활동 기록 실측).
import { describe, expect, it } from "vitest";
import { resolveAutonomy } from "@/ai/autonomyLevels";
import { classifyPlainPiTurn } from "@/ai/piAgent/plainTurn";
import type { IntentDeclarer } from "@/ai/intentDeclarationClient";
import type { IntentDeclaration } from "@/ai/intentDeclaration";
import { createBlankProject } from "@/project/defaults";

const villageIntent = {
  source: "llm", mode: "create", tools: ["author_village"], construction: { houseCount: 2, npcCount: 0 },
  needsPlan: true, clarify: null,
} as unknown as IntentDeclaration;
const declarer: IntentDeclarer = async () => ({ intent: villageIntent, elapsedMs: 0 } as never);

const classify = (piTeam: boolean, text: string) => {
  const project = createBlankProject();
  return classifyPlainPiTurn({
    project, text, currentMapId: project.startMapId, selection: null, hasActivePlan: false,
    autonomy: resolveAutonomy("balanced"), declarer: () => declarer, piTeam,
  });
};

describe("팀 설정과 마을 계약", () => {
  it("팀을 켜면 마을 요청에도 계약을 걸지 않고 팀으로 분류한다", async () => {
    const out = await classify(true, "숲마을 하나 지어 줘 (팀)");
    expect(out.mode).toBe("team");
    expect(out.plan.villageContract).toBeUndefined();
  });
  it("혼자 설정이면 예전처럼 마을 계약을 건다", async () => {
    const out = await classify(false, "숲마을 하나 지어 줘 (혼자)");
    expect(out.mode).toBe("single");
    expect(out.plan.villageContract).toBeDefined();
  });
});
