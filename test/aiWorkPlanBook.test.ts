import { afterEach, describe, expect, it } from "vitest";
import type { WorkPlan } from "@/ai/workPlan";
import {
  closeWorkPlanBook,
  openWorkPlanBook,
  updateWorkPlanBook,
  workPlanBookIsOpen,
} from "@/editor/panels/aiWorkPlanModal";
import { workPlanBookPages } from "@/editor/panels/aiWorkPlanPages";
import { modalStackDepthForTest, resetModalStackForTest } from "@/editor/ui/modalStack";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

function samplePlan(overrides: Partial<WorkPlan> = {}): WorkPlan {
  return {
    id: "plan-1",
    goal: "강가 마을을 만든다",
    createdAt: "2026-09-03T00:00:00.000Z",
    currentLayerIndex: 0,
    currentItemId: "L1-1",
    plannerNote: "물은 먼저, 집은 나중에",
    layers: [
      {
        id: "L1",
        title: "터 잡기",
        items: [
          {
            id: "L1-1",
            title: "강 그리기",
            instruction: "fill_region 으로 강을 깐다",
            doneWhen: "강 타일이 맵에 있다",
            status: "in_progress",
          },
          {
            id: "L1-2",
            title: "다리",
            instruction: "paint_road 로 다리를 놓는다",
            status: "pending",
          },
        ],
      },
      {
        id: "L2",
        title: "살림",
        items: [
          {
            id: "L2-1",
            title: "집 3채",
            instruction: "author_house 3",
            status: "pending",
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe("workPlanBookPages", () => {
  it("표지 한 장과 레이어마다 한 장을 만든다", () => {
    const pages = workPlanBookPages(samplePlan());
    expect(pages.map((page) => page.kind)).toEqual(["cover", "layer", "layer"]);
    const cover = pages[0];
    if (cover?.kind !== "cover") throw new Error("cover missing");
    expect(cover.goal).toBe("강가 마을을 만든다");
    expect(cover.plannerNote).toBe("물은 먼저, 집은 나중에");
    expect(cover.done).toBe(0);
    expect(cover.total).toBe(3);
    expect(cover.layers.map((layer) => layer.title)).toEqual(["터 잡기", "살림"]);
    expect(cover.layers[0]?.current).toBe(true);
    expect(pages[1]?.kind === "layer" && pages[1].items).toHaveLength(2);
  });

  it("layers 가 없어도 표지는 남긴다", () => {
    const pages = workPlanBookPages({ goal: "던전 하나" } as unknown as WorkPlan);
    expect(pages).toHaveLength(1);
    expect(pages[0]?.kind).toBe("cover");
    if (pages[0]?.kind !== "cover") throw new Error("cover missing");
    expect(pages[0].goal).toBe("던전 하나");
    expect(pages[0].total).toBe(0);
  });
});

describe("작업 계획 책 모달", () => {
  let restore: (() => void) | null = null;

  afterEach(() => {
    closeWorkPlanBook();
    resetModalStackForTest();
    restore?.();
    restore = null;
  });

  function mount(plan: WorkPlan = samplePlan()): FakeElement {
    restore = installFakeDom();
    const overlay = openWorkPlanBook({ plan, active: true }) as unknown as FakeElement;
    return overlay;
  }

  it("표지에서 시작해 다음/점이 레이어 페이지를 연다", () => {
    const overlay = mount();
    expect(workPlanBookIsOpen()).toBe(true);
    expect(modalStackDepthForTest()).toBe(1);
    expect(findByTestId(overlay, "ai-plan-book-title")?.textContent).toBe("강가 마을을 만든다");
    expect(findByTestId(overlay, "ai-plan-book-count")?.textContent).toBe("1 / 3");
    const sheets = overlay.querySelectorAll("[data-testid='ai-plan-book-sheet']");
    expect(sheets.map((sheet) => sheet.dataset.kind)).toEqual(["cover", "layer", "layer"]);
    expect(sheets[0]?.className).toContain("is-current");
    expect(findByTestId(overlay, "ai-plan-book-progress")?.textContent).toBe("0/3 완료");
    expect(overlay.querySelectorAll("[data-testid='ai-autonomous-item']")).toHaveLength(3);

    findByTestId(overlay, "ai-plan-book-next")?.click();
    expect(findByTestId(overlay, "ai-plan-book-count")?.textContent).toBe("2 / 3");
    const current = overlay.querySelectorAll("[data-testid='ai-plan-book-sheet']")
      .find((sheet) => sheet.className.includes("is-current"));
    expect(current?.dataset.kind).toBe("layer");
    expect(current?.textContent).toContain("강 그리기");
    expect(current?.textContent).toContain("fill_region 으로 강을 깐다");
    expect(current?.textContent).toContain("완료 조건 · 강 타일이 맵에 있다");
    expect(current?.textContent).toContain("진행 중");

    overlay.querySelectorAll("[data-testid='ai-plan-book-dot']")[2]?.click();
    expect(findByTestId(overlay, "ai-plan-book-count")?.textContent).toBe("3 / 3");
    const last = overlay.querySelectorAll("[data-testid='ai-plan-book-sheet']")
      .find((sheet) => sheet.className.includes("is-current"));
    expect(last?.textContent).toContain("집 3채");
  });

  it("목차 행은 해당 레이어 페이지로 점프한다", () => {
    const overlay = mount();
    const rows = overlay.querySelectorAll("[data-testid='ai-plan-book-toc-row']");
    expect(rows).toHaveLength(2);
    rows[1]?.click();
    expect(findByTestId(overlay, "ai-plan-book-count")?.textContent).toBe("3 / 3");
    const current = overlay.querySelectorAll("[data-testid='ai-plan-book-sheet']")
      .find((sheet) => sheet.className.includes("is-current"));
    expect(current?.textContent).toContain("살림");
  });

  it("같은 계획을 다시 열면 페이지를 유지한 채 내용만 갱신한다", () => {
    const overlay = mount();
    findByTestId(overlay, "ai-plan-book-next")?.click();
    const advanced = samplePlan({
      layers: samplePlan().layers.map((layer, index) =>
        index === 0
          ? {
              ...layer,
              items: layer.items.map((item) =>
                item.id === "L1-1" ? { ...item, status: "done" as const } : item,
              ),
            }
          : layer,
      ),
    });
    updateWorkPlanBook({ plan: advanced, active: true });
    expect(document.querySelectorAll("[data-testid='ai-plan-book-overlay']")).toHaveLength(1);
    expect(findByTestId(overlay, "ai-plan-book-count")?.textContent).toBe("2 / 3");
    expect(overlay.querySelector("[data-status='done']")?.textContent).toContain("강 그리기");
  });

  it("닫기 버튼은 오버레이와 모달 스택을 걷는다", () => {
    const overlay = mount();
    findByTestId(overlay, "ai-plan-book-close")?.click();
    expect(workPlanBookIsOpen()).toBe(false);
    expect(document.querySelector("[data-testid='ai-plan-book']")).toBeNull();
    expect(modalStackDepthForTest()).toBe(0);
  });
});
