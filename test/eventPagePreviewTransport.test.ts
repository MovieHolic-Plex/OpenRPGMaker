/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderEventPagePreview, renderEventPageFlow } from "@/editor/panels/eventEditor/eventScriptModernViews";
import { renderCommandPreview } from "@/editor/panels/eventEditor/commandPreview";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { Command, EventPage } from "@/project/types";

let serial = 0;
function options(commands: Command[]) {
  const page: EventPage = { id: `transport-${++serial}`, name: "", conditions: [], graphic: {},
    trigger: { kind: "action" }, priority: "same", movement: { type: "fixed", speed: 3, frequency: 3 }, commands };
  return { mapId: "map_start", eventId: "transport", page };
}
const texts = (n: number): Command[] => Array.from({ length: n }, (_, i) => ({ kind: "text", body: `body-${i}` }));
const button = (root: HTMLElement, action: string) => root.querySelector<HTMLButtonElement>(`[data-testid="event-script-live-${action}"]`)!;
const position = (root: HTMLElement) => root.querySelector(".event-script-live-position")!.textContent;
function mount(opts: ReturnType<typeof options>) { const root = renderEventPagePreview(opts); document.body.append(root); return root; }

describe("page preview transport and context", () => {
  beforeEach(() => { vi.useFakeTimers(); store.replace(createBlankProject()); });
  afterEach(() => { document.body.replaceChildren(); vi.clearAllTimers(); vi.useRealTimers(); });

  it("omits empty transport and native-disables all single-step actions without a timer", () => {
    const intervals = vi.spyOn(globalThis, "setInterval");
    const empty = mount(options([]));
    expect(empty.querySelector("button")).toBeNull();
    const one = mount(options(texts(1)));
    for (const action of ["prev", "next", "restart", "play"]) {
      expect(button(one, action).disabled).toBe(true);
      button(one, action).click();
    }
    expect(position(one)).toBe("1/1");
    expect(intervals).not.toHaveBeenCalled();
    intervals.mockRestore();
  });

  it.each([2, 22])("stops on arrival, replays explicitly, and restarts %i steps", n => {
    const root = mount(options(texts(n)));
    const play = button(root, "play");
    expect(button(root, "prev").disabled).toBe(true);
    expect(button(root, "restart").disabled).toBe(true);
    play.focus(); play.click();
    expect(button(root, "restart").disabled).toBe(false);
    expect(play.querySelector(".ee-icon-pause")).not.toBeNull();
    vi.advanceTimersByTime(1200 * (n - 1));
    expect(position(root)).toBe(`${n}/${n}`);
    expect(play.getAttribute("aria-pressed")).toBe("false");
    expect(button(root, "next").disabled).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    expect(document.activeElement).toBe(play);
    play.click();
    expect(position(root)).toBe(`1/${n}`);
    expect(play.getAttribute("aria-pressed")).toBe("true");
    button(root, "restart").focus(); button(root, "restart").click();
    expect(position(root)).toBe(`1/${n}`);
    expect(play.getAttribute("aria-pressed")).toBe("false");
    expect(document.activeElement).toBe(button(root, "next"));
    expect(vi.getTimerCount()).toBe(0);
  });

  it("keeps one persistent bounded status synchronized and resets step scrolling", () => {
    const opts = options([{ kind: "choices", options: [{ text: "branch".repeat(100), branch: texts(2) }] }, ...texts(1)]);
    const root = mount(opts);
    const status = root.querySelector<HTMLElement>('[role="status"]')!;
    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(status.getAttribute("aria-atomic")).toBe("true");
    const stage = root.querySelector<HTMLElement>('[data-testid="event-script-live-stage"]')!;
    expect(stage.tabIndex).toBe(0);
    expect(stage.getAttribute("aria-label")).toBeTruthy();
    stage.scrollTop = 500;
    button(root, "next").focus(); button(root, "next").click();
    expect(stage.scrollTop).toBe(0);
    expect(status.dataset.current).toBe("2");
    expect(status.dataset.total).toBe("4");
    expect(status.textContent!.length).toBeLessThan(150);
    expect(status.textContent).not.toContain("body-0");
    expect(root.querySelectorAll('[role="status"]')).toHaveLength(1);
    expect(root.querySelector('[role="status"]')).toBe(status);
    const details = root.querySelector<HTMLDetailsElement>("details")!;
    details.open = true;
    expect(details.textContent).toContain("branch".repeat(100));
    expect(position(root)).toBe("2/4");
    button(root, "play").click(); button(root, "next").click();
    expect(vi.getTimerCount()).toBe(0);
    expect(status.dataset.current).toBe("3");
    const flow = renderEventPageFlow(opts);
    expect(flow.querySelector('[aria-current="step"]')?.getAttribute("data-cmd-path")).toBe("[0,0,1]");
  });

  it("stops detached playback without changing remembered position or status", () => {
    const opts = options(texts(3)); const root = mount(opts);
    button(root, "next").click(); button(root, "play").click(); root.remove();
    const status = root.querySelector('[role="status"]')!.textContent;
    vi.advanceTimersByTime(3600);
    expect(root.querySelector('[role="status"]')!.textContent).toBe(status);
    expect(position(mount(opts))).toBe("2/3");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("stops manual navigation, keeps enabled controls focused, and cannot accumulate intervals", () => {
    const root = mount(options(texts(3)));
    const intervals = vi.spyOn(globalThis, "setInterval");
    const clears = vi.spyOn(globalThis, "clearInterval");
    const play = button(root, "play");
    for (let i = 0; i < 3; i++) { play.click(); play.click(); }
    expect(intervals).toHaveBeenCalledTimes(3);
    for (const result of intervals.mock.results) expect(clears).toHaveBeenCalledWith(result.value);
    play.click();
    const timer = intervals.mock.results.at(-1)!.value;
    button(root, "next").focus(); button(root, "next").click();
    expect(clears).toHaveBeenCalledWith(timer);
    expect(document.activeElement).toBe(button(root, "next"));
    button(root, "next").click();
    expect(document.activeElement).toBe(button(root, "prev"));
    button(root, "prev").click(); button(root, "prev").click();
    expect(document.activeElement).toBe(button(root, "next"));
    expect(root.querySelector<HTMLElement>('[role="status"]')!.dataset.current).toBe("1");
    intervals.mockRestore(); clears.mockRestore();
  });

  it("separates decorative choice markers from complete display-only labels", () => {
    const label = "  first\n" + "Token".repeat(100);
    const root = renderCommandPreview({ kind: "choices", options: [{ text: label, branch: [] }], cancelBehavior: "branch" });
    expect(root.querySelector(".ecp-choice-label")?.textContent).toBe(label);
    expect(root.querySelector(".ecp-choice .ee-icon")?.getAttribute("aria-hidden")).toBe("true");
    expect(root.querySelector(".ecp-choice button")).toBeNull();
  });
});
