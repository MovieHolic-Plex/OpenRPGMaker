// 마을 룩 진단이 **사용자/AI 에게 도달하는지** 지키는 가드.
//
// 실측 배경(2026-07-26): 룩 평가가 4건의 구체적 지적과 수정안을 계산한 뒤,
// evaluate_village_layer 도구가 `score=0.34 2x2=10` 한 줄만 남기고 전부 버렸다.
// 점수만 받으면 무엇을 고쳐야 할지 알 수 없으므로 진단이 사실상 없는 것과 같았다.
import { describe, expect, it } from "vitest";
import { runTool, type ToolContext } from "@/editor/tools";
import { createSampleAdventureProject } from "@/project/defaults/defaultProject";
import { SYSTEM_SKILLS } from "@/ai/skills";

type LookData = {
  readonly ok: boolean;
  readonly detail: string;
  readonly issues?: readonly string[];
  readonly fixes?: readonly { readonly action: string; readonly hint: string }[];
};

function runLookAudit(): LookData {
  const project = createSampleAdventureProject();
  const ctx: ToolContext = { project };
  const result = runTool(ctx, "evaluate_village_layer", { mapId: project.startMapId, layer: "look" }, { dryRun: true });
  return result.data as LookData;
}

describe("evaluate_village_layer(look) 출력", () => {
  const data = runLookAudit();

  it("실패 시 지적 목록을 함께 돌려준다 — 점수만 주면 고칠 수 없다", () => {
    expect(data.ok).toBe(false);
    expect(data.issues ?? []).not.toEqual([]);
  });

  it("지적마다 실행 가능한 수정안이 붙는다", () => {
    expect(data.fixes ?? []).not.toEqual([]);
    for (const fix of data.fixes ?? []) {
      expect(fix.action.trim().length).toBeGreaterThan(0);
      expect(fix.hint.trim().length).toBeGreaterThan(0);
    }
  });

  it("detail 한 줄만 읽어도 무엇이 문제인지 알 수 있다", () => {
    // 요약 문자열에 지적이 들어가야 로그/토스트만 봐도 판단이 된다.
    expect(data.detail).toMatch(/—/);
    expect(data.detail.length).toBeGreaterThan(20);
  });

  it("실제 샘플 마을에서 눈으로 보이는 결함을 잡는다", () => {
    const text = (data.issues ?? []).join(" | ");
    // 100폭 맵의 96타일 직선 도로와 NPC 시간표 0개 — 스크린샷으로 확인한 결함이다.
    expect(text).toContain("도로 직선 구간이 너무 길다");
    expect(text).toContain("시간표가 있는 주민이 부족하다");
  });
});

describe("맵 검증 스킬", () => {
  it("룩 게이트를 호출하도록 지시한다 — 안 부르면 린트만 보고 '문제 없음' 이라 보고한다", () => {
    const skill = SYSTEM_SKILLS.find((entry) => entry.id === "map-audit");
    expect(skill).toBeDefined();
    const prompt = skill!.buildPrompt?.({}, { mapId: "m", mapName: "테스트", selection: null }) ?? "";
    expect(prompt).toContain("evaluate_village_layer");
    expect(prompt).toContain("look");
  });
});
