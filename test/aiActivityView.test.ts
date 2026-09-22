import { Window } from "happy-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createActivityTrace, recordActivityEvent } from "@/ai/activityTrace";
import { createActivityView } from "@/editor/panels/aiActivityView";
import { isAiLiveCanvasEnabled, setAiLiveCanvasEnabled } from "@/editor/aiLiveCanvas";
import { createActivityLevelControl, getActivityLevel, setActivityLevel } from "@/editor/panels/aiActivityPreference";

beforeEach(() => {
  const window = new Window();
  vi.stubGlobal("document", window.document);
  vi.stubGlobal("localStorage", window.localStorage);
  vi.stubGlobal("Event", window.Event);
  setActivityLevel("brief");
  setAiLiveCanvasEnabled(true);
});
afterEach(() => {
  setAiLiveCanvasEnabled(true);
  vi.unstubAllGlobals();
});
describe("AI activity display levels", () => {
  it("defaults to brief and synchronizes existing main/member views without executing work", () => {
    expect(getActivityLevel()).toBe("brief");
    const main = createActivityView({ archive: false });
    const member = createActivityView({ archive: false });
    const control = createActivityLevelControl();
    document.body.append(main.root, member.root, control);
    let trace = createActivityTrace("조회");
    for (let i = 0; i < 12; i++) trace = recordActivityEvent(trace, { type: "tool_end", id: String(i), name: "get_map_region", ok: true, summary: "영역 확인" });
    main.update(trace); member.update(trace);
    expect(main.root.querySelectorAll(".ai-activity-entry").length).toBeLessThanOrEqual(4);
    setActivityLevel("trace");
    expect(main.root.querySelectorAll(".ai-activity-entry")).toHaveLength(12);
    expect(member.root.dataset.level).toBe("trace");
    expect(control.querySelector('[aria-pressed="true"]')?.getAttribute("data-activity-level")).toBe("trace");
    setActivityLevel("none");
    expect(main.root.hidden).toBe(true);
    setActivityLevel("detail");
    expect(main.root.hidden).toBe(false);
    expect(main.root.querySelectorAll(".ai-activity-entry")).toHaveLength(12);
  });

  it("toggles map construction visuals without changing the work log", () => {
    const control = createActivityLevelControl();
    document.body.append(control);
    const button = control.querySelector("[data-testid='ai-live-canvas']");
    expect(button?.getAttribute("aria-pressed")).toBe("true");
    expect(isAiLiveCanvasEnabled()).toBe(true);
    (button as HTMLButtonElement).click();
    expect(isAiLiveCanvasEnabled()).toBe(false);
    expect(button?.getAttribute("aria-pressed")).toBe("false");
    expect(getActivityLevel()).toBe("brief");
    (button as HTMLButtonElement).click();
    expect(isAiLiveCanvasEnabled()).toBe(true);
  });
  it("keeps unchanged rows and open payloads while another tool completes", () => {
    setActivityLevel("trace");
    const view = createActivityView({ archive: false }); document.body.append(view.root);
    let trace = createActivityTrace("작업");
    trace = recordActivityEvent(trace, { type: "tool_end", id: "first", name: "get_event", ok: true, summary: "확인", result: { pages: 2 } });
    view.update(trace);
    const first = view.root.querySelector(".ai-activity-entry") as HTMLDetailsElement;
    first.open = true;
    trace = recordActivityEvent(trace, { type: "tool_end", id: "second", name: "find_events", ok: false, summary: "대상 없음" });
    view.update(trace);
    expect(view.root.querySelector(".ai-activity-entry")).toBe(first);
    expect(first.open).toBe(true);
  });
});
