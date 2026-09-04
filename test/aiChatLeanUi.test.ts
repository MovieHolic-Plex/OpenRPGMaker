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
    expect(isReadOnlyToolNoise("build_house" as string)).toBe(false);
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
      // 데크(2026-09-03): 한 줄 텍스트 「✓ 요약」 → 라벨/요약/상태 세 칸 행. 함수 이름은 title 로만.
      expect(node.querySelector?.(".ai-act-label")?.textContent).toBe("길 놓기");
      expect(node.querySelector?.(".ai-act-sum")?.textContent).toBe("길 12칸");
      expect(node.textContent).not.toContain("paint_road");
      expect(node.getAttribute("title")).toContain("paint_road");
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

describe("작업 계획 앞면 렌더", () => {
  it("상태·진행·중지·계획 보기와 예산을 렌더하고 항목 본문은 두지 않는다", () => {
    const restore = installFakeDom();
    try {
      let opened = 0;
      const node = renderWithFakeDom(() =>
        renderWorkPlanChecklist(samplePlan(), {
          active: true,
          budget: { used: 3, total: 48 },
          onOpenBook: () => {
            opened += 1;
          },
        })
      ) as FakeElement;
      expect(node.dataset.testid).toBe("ai-work-plan-checklist");
      expect(node.textContent).toContain("마을 광장 중");
      expect(node.textContent).toContain("예산 3/48");
      expect(node.querySelectorAll("[data-testid='ai-autonomous-item']")).toHaveLength(0);
      expect(node.querySelector("[data-testid='ai-autonomous-progress']")?.textContent).toBe("0/2");
      expect(node.querySelector("[data-testid='ai-run-status']")?.textContent).toBe("마을 광장 중");
      expect(node.querySelector("[data-testid='ai-run-stop']")?.textContent).toBe("중지");
      expect(node.querySelector("[data-testid='ai-plan-book-open']")?.textContent).toBe("계획 보기");
      expect(node.querySelector("[data-testid='ai-run-details-toggle']")?.textContent).toContain("자세히");
      expect(node.querySelector("[data-testid='ai-run-whisper']")?.textContent).not.toContain("예산");
      expect(node.dataset.active).toBe("true");
      expect(node.dataset.complete).toBe("false");
      expect(node.querySelector("[data-testid='ai-work-item-activity']")?.textContent).toBe("진행 중…");
      node.querySelector("[data-testid='ai-plan-book-open']")?.click();
      expect(opened).toBe(1);
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
      expect(node.textContent).toContain("목표");
      expect(node.dataset.testid).toBe("ai-work-plan-checklist");
    } finally {
      restore();
    }
  });

  it("막힌 항목은 앞줄이 먼저 말하고 사유가 붙는다", () => {
    const restore = installFakeDom();
    try {
      const plan = samplePlan();
      plan.layers[0]!.items[0]!.status = "blocked";
      plan.layers[0]!.items[0]!.note = "스펙 게이트: 밑그림이 없습니다";
      const node = renderWithFakeDom(() => renderWorkPlanChecklist(plan, { active: false })) as FakeElement;
      expect(node.dataset.blocked).toBe("true");
      expect(node.querySelector("[data-testid='ai-run-status']")?.textContent).toBe("막힘 — 마을 광장");
      expect(node.querySelector("[data-testid='ai-work-item-blocked-note']")?.textContent).toBe("스펙 게이트: 밑그림이 없습니다");
      expect(node.querySelectorAll("[data-testid='ai-autonomous-item']")).toHaveLength(0);
    } finally {
      restore();
    }
  });

  it("layers 가 아예 없는 페이로드는 빈 앞면으로 안전하게 렌더한다", () => {
    const restore = installFakeDom();
    try {
      const node = renderWithFakeDom(() =>
        renderWorkPlanChecklist({ goal: "던전 하나" } as unknown as WorkPlan)
      ) as FakeElement;
      expect(node.dataset.testid).toBe("ai-work-plan-checklist");
      expect(node.textContent).toContain("던전 하나");
      expect(node.querySelector("[data-testid='ai-autonomous-progress']")?.textContent).toBe("0/0");
    } finally {
      restore();
    }
  });
});
