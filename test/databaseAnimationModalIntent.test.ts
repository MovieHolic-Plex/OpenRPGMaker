// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openDatabaseModal, requestDatabaseModalClose } from "@/editor/panels/databaseModal";
import { editorState } from "@/editor/editorState";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";

// Only image decoding is replaced; modal, store subscription, grace timer,
// panel refresh, record selection and playback bindings run together.
vi.mock("@/editor/panels/chromaKey", () => ({ applyAutoChromaKeyToBackground: vi.fn() }));

class PreviewImage extends EventTarget {
  static requests: PreviewImage[] = [];
  readonly naturalWidth = 480;
  readonly naturalHeight = 96;
  set src(_url: string) { PreviewImage.requests.push(this); }
}

let animationFrames: FrameRequestCallback[];

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-05T13:00:00Z"));
  vi.stubGlobal("Image", PreviewImage);
  PreviewImage.requests = [];
  animationFrames = [];
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => animationFrames.push(callback));
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  vi.spyOn(motion, "matches", "get").mockReturnValue(false);
  vi.spyOn(window, "matchMedia").mockReturnValue(motion);
  const project = createBlankProject();
  const frames = [0, 1, 2].map((pattern) => ({
    cells: [{ pattern, x: 0, y: 0, zoom: 100, opacity: 255, visible: true }],
  }));
  project.database.battleAnimations = ["preview-a", "preview-b"].map((id) => ({
    id, name: id, resourceId: "scarloxy-battle-anim-scratch",
    sheet: { frameWidth: 96, frameHeight: 96, columns: 5 }, frames,
  }));
  store.replace(project);
  resetMapEditHistory();
  editorState.set({ selectedAnimationFrameIndex: 0, selectedAnimationCellIndex: 0 });
  openDatabaseModal("animations");
  imageLoaded();
});

afterEach(async () => {
  requestDatabaseModalClose("battleTest");
  await vi.advanceTimersByTimeAsync(0);
  document.body.replaceChildren();
  vi.clearAllTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function node(testid: string): HTMLElement {
  const element = document.querySelector(`[data-testid="${testid}"]`);
  if (!(element instanceof HTMLElement)) throw new Error(`Missing ${testid}`);
  return element;
}

function imageLoaded(): void {
  const image = PreviewImage.requests.at(-1);
  if (!image) throw new Error("Missing preview image request");
  image.dispatchEvent(new Event("load"));
}

function position(): string { return node("db-animation-stage-target").style.backgroundPosition; }

describe("battle animation intent across the scheduled modal store refresh", () => {
  it.each(["frame selection", "explicit stop"])("retains %s through grace flush and form replacement", async (stop) => {
    node("db-animation-frame-1").click();
    imageLoaded();
    if (stop === "explicit stop") {
      node("db-animation-play").click();
      node("db-animation-play").click();
    }
    expect(position()).toBe("-96px 0px");
    const oldForm = node("db-detail-form");
    const workspace = node("db-shared-workspace");
    let refreshed = false;
    const refreshObserved = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => { observer.disconnect(); reject(new Error("Modal did not replace the form")); }, 1000);
      const observer = new MutationObserver(() => {
        if (node("db-detail-form") === oldForm) return;
        refreshed = true;
        observer.disconnect();
        clearTimeout(timeout);
        resolve();
      });
      // Direct workspace children change only on the parent refresh, not the
      // timing button's synchronous, same-form rerender.
      observer.observe(workspace, { childList: true });
    });
    const add = node("db-animation-timing-add");
    add.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    add.click();
    imageLoaded();
    expect(store.getCurrent().database.battleAnimations[0].timings).toHaveLength(1);
    expect(node("db-detail-form")).toBe(oldForm);
    expect(node("db-animation-play").getAttribute("aria-pressed")).toBe("false");

    // Deliver the real 400ms interaction grace + 50ms flush, then its queued
    // refresh frame. A 402ms playback-only advance never reaches this seam.
    await vi.advanceTimersByTimeAsync(450);
    expect(refreshed).toBe(false);
    const queued = animationFrames.splice(0);
    expect(queued.length).toBeGreaterThan(0);
    for (const callback of queued) callback(performance.now());
    await vi.advanceTimersByTimeAsync(0);
    await refreshObserved;
    imageLoaded();
    expect(oldForm.isConnected).toBe(false);
    expect(node("db-animation-frame-1").classList.contains("active")).toBe(true);
    expect(editorState.get().selectedAnimationFrameIndex).toBe(1);
    expect(node("db-animation-play").getAttribute("aria-pressed")).toBe("false");
    vi.advanceTimersByTime(67 * 4);
    expect(position()).toBe("-96px 0px");
  });

  it("starts fresh on a different record and after closing and reopening the modal", () => {
    node("db-animation-play").click();
    node("db-record-row-preview-b").click();
    imageLoaded();
    expect(node("db-animation-play").getAttribute("aria-pressed")).toBe("true");
    expect(position()).toBe("0px 0px");
    node("db-animation-play").click();
    node("db-record-row-preview-a").click();
    imageLoaded();
    expect(node("db-animation-play").getAttribute("aria-pressed")).toBe("true");
    node("db-animation-play").click();
    requestDatabaseModalClose("battleTest");
    openDatabaseModal("animations");
    imageLoaded();
    expect(node("db-animation-play").getAttribute("aria-pressed")).toBe("true");
    expect(position()).toBe("0px 0px");
  });
});
