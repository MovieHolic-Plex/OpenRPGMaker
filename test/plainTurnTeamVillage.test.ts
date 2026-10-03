// 팀을 켠 채 「마을 만들어」를 보내면 팀으로 돈다. 예전엔 마을 계약이 걸려 runPiCommand 가 팀을 조용히 껐다
// (2026-09-18 이후 일반 채팅 67회 실행 중 팀 실행 0회 — 활동 기록 실측).
import { describe, expect, it } from "vitest";
import { resolveAutonomy } from "@/ai/autonomyLevels";
import { classifyPlainPiTurn } from "@/ai/piAgent/plainTurn";
import type { IntentDeclarer } from "@/ai/intentDeclarationClient";
import type { IntentDeclaration } from "@/ai/intentDeclaration";
import { createBlankProject } from "@/project/defaults";
import { FOREST_HARMONY_ID } from "@/project/defaults/forestHarmony";

const villageIntent = {
  source: "llm", mode: "create", tools: ["author_village"], construction: { houseCount: 2, npcCount: 0 },
  needsPlan: true, clarify: null,
} as unknown as IntentDeclaration;
const declarer: IntentDeclarer = async () => ({ intent: villageIntent, elapsedMs: 0 } as never);

const classify = (piTeam: boolean, text: string, options: { readonly forestTileset?: boolean } = {}) => {
  const project = createBlankProject();
  if (options.forestTileset) {
    // 새 프로젝트 기본 칩셋은 버들항(#1789)이고, 버들항 맵의 마을 요청은 계약 대신 author_beodeul_town 으로 간다.
    // 마을 계약 경로(숲마을 생성기)를 보려면 시작 맵을 숲마을 칩셋으로 바꾼다.
    // 시작 맵은 이미 내용이 있어 맵 전체 재시공 계약을 걸지 않는다(villageContract livedWholeMap) — 맵을 고르지 않은 새 마을 요청으로 본다.
    project.maps[project.startMapId]!.tilesetId = FOREST_HARMONY_ID;
  }
  return classifyPlainPiTurn({
    project, text, currentMapId: options.forestTileset ? null : project.startMapId, selection: null, hasActivePlan: false,
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
    const out = await classify(false, "숲마을 하나 지어 줘 (혼자)", { forestTileset: true });
    expect(out.mode).toBe("single");
    expect(out.plan.villageContract).toBeDefined();
  });
  it("버들항 맵이면 혼자여도 계약 없이 버들항 마을로 간다", async () => {
    const out = await classify(false, "마을 하나 지어 줘 (혼자)");
    expect(out.mode).toBe("single");
    expect(out.plan.villageContract).toBeUndefined();
    expect(out.plan.routingAudit).toContain("버들항 마을");
  });
});
