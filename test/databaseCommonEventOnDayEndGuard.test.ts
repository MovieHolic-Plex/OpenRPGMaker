import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { commonEventReferenceMessage } from "@/editor/databaseReferences";
import { renderCommonEventsTab } from "@/editor/panels/databaseCommonEventViews";
import { normalizeTimeSystemConfig } from "@/project/databaseRecordModel";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

let restoreDom: (() => void) | undefined;
let previousWindow: typeof globalThis.window | undefined;

beforeEach(() => {
  restoreDom = installFakeDom();
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
  const project = createBlankProject();
  project.commonEvents = [{ id: "ce_day_end", name: "하루가 끝날 때", trigger: "none", commands: [] }];
  project.system.timeSystem = normalizeTimeSystemConfig({
    enabled: true,
    onDayEnd: "ce_day_end",
  });
  store.replace(project);
});

afterEach(() => {
  restoreDom?.();
  restoreDom = undefined;
  if (previousWindow === undefined) Reflect.deleteProperty(globalThis, "window");
  else Object.defineProperty(globalThis, "window", { configurable: true, value: previousWindow });
});

describe("common event onDayEnd delete guard", () => {
  it("names the time-system day-end hook in the block message", () => {
    expect(commonEventReferenceMessage("ce_day_end")).toContain("시간 시스템(하루 끝)");
    expect(commonEventReferenceMessage("ce_other")).toBeNull();
  });

  it("blocks the common-event delete button while onDayEnd points at it", () => {
    const host = document.createElement("div") as unknown as FakeElement;
    const rerender = (): void => {
      host.replaceChildren();
      renderCommonEventsTab(host as unknown as HTMLElement, rerender);
    };
    rerender();

    const deleteButton = findByTestId(host, "db-common-event-delete-ce_day_end");
    if (!deleteButton) throw new Error("missing delete button");
    deleteButton.click();
    deleteButton.click();

    expect(store.getCurrent().commonEvents.map((event) => event.id)).toEqual(["ce_day_end"]);
    expect(deleteButton.textContent).not.toBe("정말 삭제?");
  });
});
