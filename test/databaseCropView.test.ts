import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getMapEditHistoryState, resetMapEditHistory, undoMapEdit } from "@/editor/mapEditHistory";
import { renderCropTab } from "@/editor/panels/databaseCropView";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

let previousWindow: typeof globalThis.window | undefined;

function stubWindowTimers(): void {
  previousWindow = globalThis.window;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      setTimeout: (handler: TimerHandler): number => {
        if (typeof handler === "function") handler();
        return 0;
      },
      clearTimeout,
    },
  });
}

function restoreWindow(): void {
  if (previousWindow === undefined) Reflect.deleteProperty(globalThis, "window");
  else Object.defineProperty(globalThis, "window", { configurable: true, value: previousWindow });
}

function renderUtility(render: (host: HTMLElement, rerender: () => void) => void): FakeElement {
  const host = document.createElement("div") as unknown as FakeElement;
  const rerender = (): void => {
    host.replaceChildren();
    render(host as unknown as HTMLElement, rerender);
  };
  rerender();
  return host;
}

describe("database crop view", () => {
  let cleanupDom: (() => void) | undefined;

  beforeEach(() => {
    cleanupDom = installFakeDom();
    stubWindowTimers();
    store.replace(createBlankProject());
    resetMapEditHistory();
  });

  afterEach(() => {
    cleanupDom?.();
    cleanupDom = undefined;
    restoreWindow();
  });

  // fix(db): 계절 체크박스를 전부 해제하면 normalizeCropRecord가 데이터를 "봄"으로 강제
  // 복원하지만 화면(체크박스)은 갱신되지 않아 사용자가 "어느 계절에도 안 자란다"고
  // 착각했다(qa-items-report.md). rerender를 배선해 화면이 실제 저장값을 반영해야 한다.
  it("re-renders the season checkboxes after unchecking all seasons forces a spring restore", () => {
    const host = renderUtility(renderCropTab);
    findByTestId(host, "db-crop-add")?.click();

    const spring = findByTestId(host, "db-crop-season-spring");
    if (!spring) throw new Error("missing spring checkbox");
    expect(spring.checked).toBe(true);

    spring.checked = false;
    spring.dispatchEvent(new Event("input"));

    const cropId = store.getCurrent().database.crops?.[0]?.id;
    expect(store.getCurrent().database.crops?.find((crop) => crop.id === cropId)?.seasons).toEqual(["spring"]);
    // the DOM must reflect the forced restore, not the just-unchecked state
    const springAfter = findByTestId(host, "db-crop-season-spring");
    expect(springAfter?.checked).toBe(true);
  });

  it("adds an undo snapshot before add/delete and duplicate creates a name with the 사본 suffix", () => {
    const host = renderUtility(renderCropTab);
    expect(getMapEditHistoryState().canUndo).toBe(false);

    findByTestId(host, "db-crop-add")?.click();
    expect(getMapEditHistoryState().canUndo).toBe(true);
    const cropId = store.getCurrent().database.crops?.[0]?.id;
    expect(cropId).toBeTruthy();

    findByTestId(host, "db-crop-duplicate")?.click();
    const crops = store.getCurrent().database.crops ?? [];
    expect(crops).toHaveLength(2);
    expect(crops[1]?.name).toBe("새 작물 사본");
  });

  it("requires a second click within the confirm window before deleting a crop", () => {
    const host = renderUtility(renderCropTab);
    findByTestId(host, "db-crop-add")?.click();
    expect(store.getCurrent().database.crops).toHaveLength(1);

    const deleteButton = findByTestId(host, "db-crop-delete");
    if (!deleteButton) throw new Error("missing delete button");

    deleteButton.click();
    expect(deleteButton.textContent).toBe("정말 삭제?");
    expect(store.getCurrent().database.crops).toHaveLength(1);

    deleteButton.click();
    expect(store.getCurrent().database.crops).toHaveLength(0);

    const undone = undoMapEdit();
    expect(undone).toBe(true);
    expect(store.getCurrent().database.crops).toHaveLength(1);
  });

  // Break caught: an empty crop catalog falls back to a blank detail pane with no first action.
  it("offers a first-crop action in the empty state and opens the created record", () => {
    const host = renderUtility(renderCropTab);
    expect(findByTestId(host, "db-crop-empty")).toBeTruthy();

    findByTestId(host, "db-crop-empty-add")?.click();

    expect(store.getCurrent().database.crops).toHaveLength(1);
    expect(findByTestId(host, "db-crop-name")).toBeTruthy();
  });

  // Break caught: the crop tab exposes raw fields but not whether time/farmable-map wiring is ready.
  it("shows farming readiness and a derived crop loop summary", () => {
    const host = renderUtility(renderCropTab);
    expect(findByTestId(host, "db-crop-readiness-time")?.dataset.state).toBe("needs-setup");
    expect(findByTestId(host, "db-crop-readiness-fields")?.dataset.state).toBe("needs-setup");

    findByTestId(host, "db-crop-add")?.click();
    const cropId = store.getCurrent().database.crops?.[0]?.id;
    if (!cropId) throw new Error("missing added crop");
    store.update((project) => {
      project.system.timeSystem = { enabled: true, dayStartHour: 6, dayEndHour: 26 };
      project.maps[project.startMapId].farmableArea = [{ x: 1, y: 1, w: 3, h: 2 }];
      const crop = project.database.crops?.find((entry) => entry.id === cropId);
      if (!crop) return;
      crop.stages = [{ days: 2 }, { days: 3 }];
      crop.harvestCount = 4;
      crop.seasons = ["spring", "summer"];
      crop.regrow = { days: 2 };
    });

    const readyHost = renderUtility(renderCropTab);
    expect(findByTestId(readyHost, "db-crop-readiness-time")?.dataset.state).toBe("ready");
    expect(findByTestId(readyHost, "db-crop-readiness-fields")?.dataset.state).toBe("ready");
    expect(findByTestId(readyHost, "db-crop-overview-growth")?.dataset.days).toBe("5");
    expect(findByTestId(readyHost, "db-crop-overview-yield")?.dataset.count).toBe("4");
    expect(findByTestId(readyHost, "db-crop-overview-seasons")?.dataset.count).toBe("2");
    expect(findByTestId(readyHost, "db-crop-overview-regrow")?.dataset.days).toBe("2");
  });

  // Break caught: broken seed/harvest links are only visible after opening each record by hand.
  it("reports unusable crop records and exposes direct repair actions", () => {
    store.update((project) => {
      project.database.crops = [{
        id: "crop_broken",
        name: "끊긴 작물",
        seedItemId: "missing_seed",
        harvestItemId: "missing_harvest",
        harvestCount: 1,
        stages: [{ days: 1 }],
        seasons: ["spring"],
      }];
    });

    const host = renderUtility(renderCropTab);
    expect(findByTestId(host, "db-crop-readiness-records")?.dataset.invalid).toBe("1");
    expect(findByTestId(host, "db-crop-readiness-records")?.dataset.state).toBe("needs-setup");
    expect(findByTestId(host, "db-crop-readiness-time-action")).toBeTruthy();
    expect(findByTestId(host, "db-crop-readiness-fields-action")).toBeTruthy();
    expect(findByTestId(host, "db-crop-readiness-tools-action")).toBeTruthy();
    expect(findByTestId(host, "db-crop-readiness-records-action")).toBeTruthy();
  });
});
