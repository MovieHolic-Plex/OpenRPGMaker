// test/regionTaskWideReview.test.ts
// Wide fullscreen-style review stage (review-only): side-by-side before/after,
// checklist-styled change list/issues, sticky compare-actions, kbd hints with
// Left/Right A/B flip wired to setAbView. Enter=apply / R=retry preserved.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { closeRegionTaskModal, openRegionTaskModal } from "@/editor/panels/regionTaskModal";
import { __clearPendingRegionApplyForTest, setPendingRegionApply } from "@/editor/regionTask/pendingRegionApply";
import type { RegionTaskResult } from "@/editor/regionTask/runRegionTask";
import { type FakeElement, findByTestId, installFakeDom } from "./fakeDom";

const REGION = { x: 0, y: 0, width: 2, height: 2 };

function openModal(options: Parameters<typeof openRegionTaskModal>[0]): FakeElement {
  return openRegionTaskModal(options) as unknown as FakeElement;
}

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

let restoreDom: (() => void) | null = null;

afterEach(() => {
  closeRegionTaskModal();
  restoreDom?.();
  restoreDom = null;
});

function fakePendingResult(hooks: { readonly onApply: () => void }): RegionTaskResult {
  const project = {
    maps: { m1: { id: "m1", name: "맵", width: 4, height: 4, tileSize: 16, events: [] } },
    tilesets: {},
  };
  const clippedProject = {
    ...project,
    maps: {
      m1: {
        ...project.maps.m1,
        events: [{ id: "npc-review", x: 1, y: 1, trigger: "action", commands: [] }],
      },
    },
  };
  const report = {
    issues: [{ code: "schedule", severity: "warning", message: "NPC 일정 확인" }],
    metrics: {
      changedCells: 3, changedEvents: 1, passableChangedCells: 2, isolatedChangedCells: 0,
      scheduledNpcs: 0, scheduleEntries: 0, timeSystemEnabled: false, roomSessions: 0,
      roomScoreAverage: null,
    },
  } as never;
  const pending = setPendingRegionApply({
    baseProject: project as never,
    clippedProject: clippedProject as never,
    mapId: "m1",
    region: REGION,
    changedCells: 3,
    changedEvents: 1,
    instruction: "테스트",
    getCurrentProject: () => project as never,
    report,
    reviewProject: (candidate) => ({ project: candidate, report }),
    onApply: hooks.onApply,
    onDiscard: () => {},
    onSettle: () => {},
  });
  return {
    ok: true, applied: false, changedCells: 3, changedEvents: 1, clippedCells: 0,
    proposedCalls: 1, assistantText: "", pending, review: pending.report,
  };
}

async function openInReview(hooks: { readonly onApply: () => void }): Promise<FakeElement> {
  __clearPendingRegionApplyForTest();
  restoreDom = installFakeDom();
  const run = vi.fn(async () => fakePendingResult(hooks));
  const root = openModal({
    mapId: "m1",
    region: REGION,
    initialInstruction: "테스트",
    autoRun: true,
    run: run as never,
    renderSnapshot: () => Promise.resolve(document.createElement("div")),
  });
  await flush();
  return root;
}

function pressKeyOnDocument(key: string): void {
  const event = new Event("keydown") as Event & { key?: string };
  event.key = key;
  (document as unknown as { dispatchEvent: (event: Event) => boolean }).dispatchEvent(event);
}

describe("wide review stage (review-only)", () => {
  it("review stage opts into the wide decision layout via data-stage", async () => {
    const root = await openInReview({ onApply: () => {} });
    const modal = findByTestId(root, "region-task-modal") ?? findByTestId(root, "region-task-popover");
    expect(modal?.dataset.stage).toBe("review");
    // Wide 진입은 data-stage 계약이다 — JS 가 별도 클래스를 달지 않고 CSS 가 판단한다(파일 원칙).
    const css = readFileSync(resolve(__dirname, "..", "src", "styles", "editor", "region-task.css"), "utf8");
    expect(css).toContain('.region-task-modal[data-stage="review"]');
  });

  it("before/after figures sit side-by-side in a wide compare container", async () => {
    const root = await openInReview({ onApply: () => {} });
    const wide = findByTestId(root, "region-task-wide-compare");
    expect(wide).not.toBeNull();
    expect(findByTestId(wide!, "region-task-before")).not.toBeNull();
    expect(findByTestId(wide!, "region-task-after")).not.toBeNull();
  });

  it("change list and issues render as checklists", async () => {
    const root = await openInReview({ onApply: () => {} });
    const list = findByTestId(root, "region-task-change-list");
    expect(list?.classList.contains("is-checklist")).toBe(true);
    const issues = findByTestId(root, "region-task-review-issues");
    expect(issues?.classList.contains("is-checklist")).toBe(true);
  });

  it("compare-actions row and kbd hint row exist in review", async () => {
    const root = await openInReview({ onApply: () => {} });
    expect(findByTestId(root, "region-task-compare-actions")).not.toBeNull();
    const hints = findByTestId(root, "region-task-kbd-hints");
    expect(hints).not.toBeNull();
    expect(hints?.textContent ?? "").toContain("Enter");
  });

  it("ArrowLeft/ArrowRight flip the A/B view via setAbView", async () => {
    const root = await openInReview({ onApply: () => {} });
    const preview = findByTestId(root, "region-task-preview")!;
    expect(preview.dataset.abView).toBe("after");
    (document as unknown as { activeElement: unknown }).activeElement = null;
    pressKeyOnDocument("ArrowLeft");
    expect(preview.dataset.abView).toBe("before");
    pressKeyOnDocument("ArrowRight");
    expect(preview.dataset.abView).toBe("after");
  });

  it("Enter still applies and R still retries with focus guards", async () => {
    __clearPendingRegionApplyForTest();
    restoreDom?.();
    restoreDom = installFakeDom();
    const onApply = vi.fn();
    const run = vi.fn(async () => fakePendingResult({ onApply }));
    const root = openModal({
      mapId: "m1",
      region: REGION,
      initialInstruction: "테스트",
      autoRun: true,
      run: run as never,
      renderSnapshot: () => Promise.resolve(document.createElement("div")),
    });
    await flush();
    expect(run).toHaveBeenCalledTimes(1);
    (document as unknown as { activeElement: unknown }).activeElement = null;
    pressKeyOnDocument("Enter");
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledTimes(1);
    await flush();

    // retry path: fresh review, R re-runs with the same instruction
    closeRegionTaskModal();
    restoreDom?.();
    __clearPendingRegionApplyForTest();
    restoreDom = installFakeDom();
    const run2 = vi.fn(async () => fakePendingResult({ onApply: () => {} }));
    openModal({
      mapId: "m1",
      region: REGION,
      initialInstruction: "테스트",
      autoRun: true,
      run: run2 as never,
      renderSnapshot: () => Promise.resolve(document.createElement("div")),
    });
    await flush();
    (document as unknown as { activeElement: unknown }).activeElement = null;
    pressKeyOnDocument("r");
    await flush();
    expect(run2).toHaveBeenCalledTimes(2);
    expect(root).not.toBeNull();
  });

  it("compose stage stays narrow with no review-only chrome", async () => {
    __clearPendingRegionApplyForTest();
    restoreDom = installFakeDom();
    const root = openModal({ mapId: "m1", region: REGION, run: vi.fn() });
    const modal = findByTestId(root, "region-task-modal") ?? findByTestId(root, "region-task-popover");
    expect(modal?.dataset.stage).toBe("compose");
    expect(findByTestId(root, "region-task-wide-compare")).toBeNull();
    expect(findByTestId(root, "region-task-kbd-hints")).toBeNull();
  });
});
