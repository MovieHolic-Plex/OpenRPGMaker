import { describe, expect, it } from "vitest";
import {
  isReadOnlyToolNoise,
  phaseStatusText,
  shouldShowStatusInChat,
} from "@/editor/panels/aiChatPanelHelpers";
import {
  formatAiRunningStatus,
  parseAutonomousRunBudget,
  renderToolActivityEntry,
  renderWorkPlanChecklist,
} from "@/editor/panels/aiChatRenderers";
import { installFakeDom, renderWithFakeDom, type FakeElement } from "./fakeDom";
import type { WorkPlan } from "@/ai/workPlan";

function samplePlan(overrides: Partial<WorkPlan> = {}): WorkPlan {
  return {
    id: "plan-1",
    goal: "RPG 만들어줘",
    createdAt: "2026-08-14T00:00:00.000Z",
    currentLayerIndex: 0,
    currentItemId: "L1-1",
    layers: [
      {
        id: "L1",
        title: "마을",
        items: [
          { id: "L1-1", title: "마을 광장", instruction: "광장", status: "in_progress" },
          { id: "L1-2", title: "집 3채", instruction: "집", status: "pending" },
        ],
      },
    ],
    ...overrides,
  };
}

describe("AI 채팅 lean UI 정책", () => {
  it("단계 라벨에 모델 코드를 넣지 않는다", () => {
    expect(phaseStatusText("plan")).toBe("계획 중");
    expect(phaseStatusText("execute")).toBe("실행 중");
    expect(phaseStatusText("review")).toBe("검수 중");
  });

  it("진행 상태줄은 짧고 분모 상한을 숨긴다", () => {
    expect(formatAiRunningStatus(0, 12_000, 0, 200, "계획 중")).toBe("계획 중… 12초");
    expect(formatAiRunningStatus(0, 12_000, 4, 200, "실행 중")).toBe("실행 중… 12초 · 도구 4");
  });

  it("status 말풍선은 재시도·오류 신호만 허용한다", () => {
    expect(shouldShowStatusInChat("연결 끊김 — 재시도 중(1/2)")).toBe(true);
    expect(shouldShowStatusInChat("요청이 커서 이번 턴에는 일부만 제안합니다. 이어서 요청해 주세요.")).toBe(true);
    expect(shouldShowStatusInChat("변경 없는 종료를 감지해 실행 계획을 다시 요청합니다.")).toBe(false);
    expect(shouldShowStatusInChat("zero-change-rekick")).toBe(false);
  });

  it("조회성 툴 성공은 목록 노이즈로 분류한다", () => {
    expect(isReadOnlyToolNoise("get_map_region")).toBe(true);
    expect(isReadOnlyToolNoise("list_resources")).toBe(true);
    expect(isReadOnlyToolNoise("show_tiles")).toBe(true);
    expect(isReadOnlyToolNoise("paint_road")).toBe(false);
    expect(isReadOnlyToolNoise("build_house_kit")).toBe(false);
  });

  it("성공 툴 항목은 JSON 상세 없이 한 줄이다", () => {
    const restore = installFakeDom();
    try {
      const node = renderWithFakeDom(() =>
        renderToolActivityEntry(
          "paint_road",
          { ok: true, summary: "길 12칸" },
          { args: { mapId: "m1" }, index: 1 }
        )
      ) as FakeElement;
      expect(node.tagName).toBe("DIV");
      expect(node.textContent).toContain("paint_road");
      expect(node.querySelector?.("pre")).toBeFalsy();
    } finally {
      restore();
    }
  });
});

describe("자율 실행 예산 표시 (todo 6)", () => {
  it("자동 계속 status 텍스트에서 used/total 을 파싱한다", () => {
    expect(parseAutonomousRunBudget("자율 실행 계속 (2/48)")).toEqual({ used: 2, total: 48, exhausted: false });
    expect(parseAutonomousRunBudget("자율 실행 계속 (48/48)")).toEqual({ used: 48, total: 48, exhausted: false });
  });

  it("예산 소진 status 는 used=total + exhausted 플래그로 파싱된다", () => {
    expect(parseAutonomousRunBudget("자율 실행 예산 소진 — 「계속」이라고 보내면 이어서 진행합니다."))
      .toEqual({ used: 48, total: 48, exhausted: true });
  });

  it("무관한 status 텍스트는 null 을 돌려준다", () => {
    expect(parseAutonomousRunBudget("생각 중… 3초")).toBeNull();
    expect(parseAutonomousRunBudget("작업 계획 1/4")).toBeNull();
    expect(parseAutonomousRunBudget("")).toBeNull();
  });
});

describe("작업 계획 체크리스트 렌더 (todo 6)", () => {
  it("항목별 상태 마커와 현재 레이어, 진행 요약, 예산을 렌더한다", () => {
    const restore = installFakeDom();
    try {
      const node = renderWithFakeDom(() =>
        renderWorkPlanChecklist(samplePlan(), {
          active: true,
          budget: { used: 3, total: 48 },
        })
      ) as FakeElement;
      expect(node.dataset.testid).toBe("ai-work-plan-checklist");
      expect(node.textContent).toContain("마을 광장");
      expect(node.textContent).toContain("예산 3/48");
      const items = node.querySelectorAll("[data-testid='ai-autonomous-item']");
      expect(items.map((item) => item.dataset.status)).toEqual(["in_progress", "pending"]);
      const layer = node.querySelector("[data-testid='ai-autonomous-layer']");
      expect(layer?.dataset.current).toBe("true");
      expect(node.querySelector("[data-testid='ai-autonomous-progress']")?.textContent).toBe("0/2");
    } finally {
      restore();
    }
  });

  it("필드가 빠진(망가진) 계획 페이로드도 안전하게 렌더한다 — 예외 없음", () => {
    const restore = installFakeDom();
    try {
      const malformed = {
        goal: "목표",
        layers: [
          { id: "L1", title: "레이어", items: [{ id: "x", title: "항목" }] },
          { title: "아이템 없는 레이어" },
        ],
      } as unknown as WorkPlan;
      const node = renderWithFakeDom(() => renderWorkPlanChecklist(malformed)) as FakeElement;
      expect(node.textContent).toContain("항목");
      expect(node.querySelectorAll("[data-testid='ai-autonomous-item']")).toHaveLength(1);
    } finally {
      restore();
    }
  });

  it("layers 가 아예 없는 페이로드는 빈 체크리스트로 안전하게 렌더한다", () => {
    const restore = installFakeDom();
    try {
      const node = renderWithFakeDom(() =>
        renderWorkPlanChecklist({ goal: "던전 하나" } as unknown as WorkPlan)
      ) as FakeElement;
      expect(node.dataset.testid).toBe("ai-work-plan-checklist");
      expect(node.textContent).toContain("던전 하나");
      expect(node.querySelectorAll("[data-testid='ai-autonomous-item']")).toHaveLength(0);
    } finally {
      restore();
    }
  });
});
