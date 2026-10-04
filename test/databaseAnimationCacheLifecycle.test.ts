// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { refreshDatabasePanel, renderDatabasePanel, setDatabaseActiveTab } from "@/editor/panels/database";
import { openDatabaseModal, prewarmDatabaseModal, requestDatabaseModalClose } from "@/editor/panels/databaseModal";
import { editorState } from "@/editor/editorState";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";

vi.mock("@/editor/panels/chromaKey", () => ({ applyAutoChromaKeyToBackground: vi.fn() }));

// Body observers must remain absent; track only any accidentally added subscriptions
// and the editor's 67ms playback intervals. Test signals use the native observer.
const NativeMutationObserver = globalThis.MutationObserver;
const observers = new Set<MutationObserver>();
const intervals = new Set<number>();
class PreviewImage extends EventTarget {
  static requests: PreviewImage[] = [];
  readonly naturalWidth = 480;
  readonly naturalHeight = 96;
  set src(_url: string) { PreviewImage.requests.push(this); }
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-05T13:00:00Z"));
  observers.clear(); intervals.clear(); PreviewImage.requests = [];
  vi.stubGlobal("Image", PreviewImage);
  vi.stubGlobal("MutationObserver", class extends NativeMutationObserver {
    override observe(target: Node, options?: MutationObserverInit): void {
      super.observe(target, options);
      if (target === document.body && options?.subtree) observers.add(this);
    }
    override disconnect(): void { super.disconnect(); observers.delete(this); }
  });
  const setInterval = window.setInterval.bind(window);
  const clearInterval = window.clearInterval.bind(window);
  vi.spyOn(window, "setInterval").mockImplementation((handler, delay, ...args) => {
    const id = setInterval(handler, delay, ...args);
    if (delay === 67) intervals.add(id);
    return id;
  });
  vi.spyOn(window, "clearInterval").mockImplementation((id) => {
    intervals.delete(id); clearInterval(id);
  });
  const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
  vi.spyOn(preference, "matches", "get").mockReturnValue(false);
  vi.spyOn(window, "matchMedia").mockReturnValue(preference);
  const project = createBlankProject();
  project.database.battleAnimations = [{
    id: "cache-preview", name: "Cache preview", resourceId: "scarloxy-battle-anim-scratch",
    sheet: { frameWidth: 96, frameHeight: 96, columns: 5 },
    frames: [0, 1, 2].map((pattern) => ({
      cells: [{ pattern, x: 0, y: 0, zoom: 100, opacity: 255, visible: true }],
    })),
  }];
  store.replace(project);
  resetMapEditHistory();
  editorState.set({ selectedAnimationFrameIndex: 0, selectedAnimationCellIndex: 0 });
});

afterEach(async () => {
  requestDatabaseModalClose("battleTest");
  await vi.advanceTimersByTimeAsync(0);
  document.body.replaceChildren();
  vi.clearAllTimers();
  vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers();
});

function node(selector: string): HTMLElement {
  const result = document.querySelector(selector);
  if (!(result instanceof HTMLElement)) throw new Error(`Missing ${selector}`);
  return result;
}
function byTestId(id: string): HTMLElement { return node(`[data-testid='${id}']`); }
function loadPreview(): void {
  const image = PreviewImage.requests.at(-1);
  if (!image) throw new Error("Missing preview image request");
  image.dispatchEvent(new Event("load"));
}

// Subscribe to the exact child replacement BEFORE triggering refresh. The bounded
// timeout fails missing refreshes; zero-time delivery drains Happy DOM observers.
function nextMutation(target: Node): Promise<void> {
  return new Promise((resolve, reject) => {
    const observer = new NativeMutationObserver(() => {
      observer.disconnect(); clearTimeout(timeout); resolve();
    });
    const timeout = setTimeout(() => {
      observer.disconnect(); reject(new Error("Expected cache lifecycle mutation"));
    }, 1000);
    observer.observe(target, { childList: true });
  });
}
async function mutate(target: Node, action: () => void): Promise<void> {
  const changed = nextMutation(target);
  action();
  await vi.advanceTimersByTimeAsync(0);
  await changed;
}
async function open(): Promise<void> {
  await mutate(document.body, () => openDatabaseModal("animations"));
  loadPreview();
  expect(observers.size).toBe(0);
  expect(intervals.size).toBe(1);
}
async function close(): Promise<void> {
  await mutate(document.body, () => requestDatabaseModalClose("battleTest"));
  expect(document.querySelector("[data-testid='database-modal']")).toBeNull();
  expect(observers.size).toBe(0);
  expect(intervals.size).toBe(0);
}
function expectCurrentOnly(): void {
  expect(document.querySelectorAll(".db-animation-stage-panel")).toHaveLength(1);
  expect(observers.size).toBe(0);
  expect(intervals.size).toBe(1);
}

describe("battle animation preview ownership in the real modal tab cache", () => {
  it("disposes previews on repeated input/parent refresh cycles and modal close", async () => {
    await open();
    for (const x of [12, 24, 36]) {
      const oldWorkspace = node(".oprn-record-battleAnimations");
      const refreshed = nextMutation(node(".db-body"));
      const input = byTestId("db-animation-cell-x-0");
      if (!(input instanceof HTMLInputElement)) throw new Error("Expected cell input");
      input.value = String(x);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      // The real modal defers input-triggered refresh for 400ms grace + 50ms,
      // then schedules rAF. Deliver both, not the insufficient 402ms advance.
      await vi.advanceTimersByTimeAsync(450);
      vi.advanceTimersToNextFrame();
      await vi.advanceTimersByTimeAsync(0);
      await refreshed;
      expect(node(".oprn-record-battleAnimations")).not.toBe(oldWorkspace);
      expect(store.getCurrent().database.battleAnimations[0].frames?.[0].cells[0].x).toBe(x);
      loadPreview();
      expectCurrentOnly();
    }
    await close();
  });

  it.each(["refresh", "remount"])("disposes replaced workspaces on same-project %s", async (kind) => {
    await open();
    const host = node(".database-modal-body");
    for (let cycle = 0; cycle < 2; cycle += 1) {
      const oldWorkspace = node(".oprn-record-battleAnimations");
      await mutate(kind === "refresh" ? node(".db-body") : host, () => {
        if (kind === "refresh") refreshDatabasePanel(host);
        else renderDatabasePanel(host);
      });
      expect(node(".oprn-record-battleAnimations")).not.toBe(oldWorkspace);
      loadPreview();
      expectCurrentOnly();
    }
    await close();
  });

  it("retains cached DOM with no body observer, resumes its loop, and closes a detached tab", async () => {
    await open();
    const workspace = node(".oprn-record-battleAnimations");
    const imageRequests = PreviewImage.requests.length;
    await mutate(node(".db-body"), () => byTestId("db-tab-terms").click());
    expect(workspace.isConnected).toBe(false);
    expect(observers.size).toBe(0);
    expect(intervals.size).toBe(0);
    // 전투 애니메이션은 도트 연출의 하위 보기다(2026-10-02) — 레일 버튼이 없어 연출 탭을 거쳐 연다.
    await mutate(node(".db-body"), () => byTestId("db-tab-retro-choreographies").click());
    await mutate(node(".db-body"), () => byTestId("db-subview-animations").click());
    expect(node(".oprn-record-battleAnimations")).toBe(workspace);
    expect(PreviewImage.requests).toHaveLength(imageRequests);
    expectCurrentOnly();
    vi.advanceTimersByTime(67);
    expect(byTestId("db-animation-stage-target").style.backgroundPosition).toBe("-96px 0px");
    await mutate(node(".db-body"), () => byTestId("db-tab-terms").click());
    await close();
  });

  it("keeps a remembered prewarm static even after image load, and activates on reveal", async () => {
    setDatabaseActiveTab("animations");
    prewarmDatabaseModal();
    await vi.advanceTimersByTimeAsync(0);
    loadPreview();
    await vi.advanceTimersByTimeAsync(1000);
    expect(intervals.size).toBe(0);
    expect(observers.size).toBe(0);
    expect(document.querySelector("[data-testid='database-modal-parked']")).not.toBeNull();
    openDatabaseModal();
    await vi.advanceTimersByTimeAsync(0);
    expect(intervals.size).toBe(1);
    await close();
  });

  it("keeps cell nodes during playback and ignores unrelated assistant DOM", async () => {
    await open();
    const layer = node(".db-animation-stage-cells");
    const sprites = [...layer.children];
    const mutations: MutationRecord[] = [];
    const tracker = new NativeMutationObserver(records => mutations.push(...records));
    tracker.observe(layer, { childList: true });
    const assistant = document.createElement("aside");
    document.body.append(assistant);
    for (let i = 0; i < 30; i++) assistant.append(document.createElement("span"));
    await vi.advanceTimersByTimeAsync(67 * 8);
    expect([...layer.children]).toEqual(sprites);
    expect(mutations).toHaveLength(0);
    expect(observers.size).toBe(0);
    tracker.disconnect(); assistant.remove();
    await close();
  });

  it("disposes a detached preview when a project mutation invalidates its cached tab", async () => {
    await open();
    await mutate(node(".db-body"), () => byTestId("db-tab-terms").click());
    expect(observers.size).toBe(0);
    const refreshed = nextMutation(node(".db-body"));
    store.update((project) => { project.meta.terms.gold = "Changed"; }, { scope: "database", collection: "terms" });
    vi.advanceTimersToNextFrame();
    await vi.advanceTimersByTimeAsync(0);
    await refreshed;
    expect(observers.size).toBe(0);
    expect(intervals.size).toBe(0);
    // 전투 애니메이션은 도트 연출의 하위 보기다(2026-10-02) — 레일 버튼이 없어 연출 탭을 거쳐 연다.
    await mutate(node(".db-body"), () => byTestId("db-tab-retro-choreographies").click());
    await mutate(node(".db-body"), () => byTestId("db-subview-animations").click());
    loadPreview();
    expectCurrentOnly();
    await close();
  });
});
