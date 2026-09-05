// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderBattleAnimationRecordForm } from "@/editor/panels/databaseAnimationRecordView";
import { editorState } from "@/editor/editorState";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { BattleAnimationRecord } from "@/project/types";

// Image decoding is a boundary; all form rendering, DOM events and timers are real.
// Chroma-key pixels are covered separately and do not determine playback lifetime.
vi.mock("@/editor/panels/chromaKey", () => ({ applyAutoChromaKeyToBackground: vi.fn() }));

class PreviewImage extends EventTarget {
  static requests: PreviewImage[] = [];
  readonly naturalWidth = 480;
  readonly naturalHeight = 96;
  set src(_url: string) { PreviewImage.requests.push(this); }
}

const frames = [0, 1, 2].map((pattern) => ({
  cells: [{ pattern, x: pattern * 8, y: 0, zoom: 100, opacity: 255, visible: true }],
}));
const animation: BattleAnimationRecord = {
  id: "preview-a", name: "Preview A", resourceId: "easyrpg-battle-blow",
  sheet: { frameWidth: 96, frameHeight: 96, columns: 5 }, frames,
};
let form: HTMLElement;
let motionPreference: MediaQueryList;

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("Image", PreviewImage);
  PreviewImage.requests = [];
  motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
  vi.spyOn(motionPreference, "matches", "get").mockReturnValue(false);
  vi.spyOn(window, "matchMedia").mockReturnValue(motionPreference);
  const project = createBlankProject();
  project.database.battleAnimations = [animation, { ...animation, id: "preview-b", name: "Preview B" }];
  store.replace(project);
  resetMapEditHistory();
  editorState.set({ selectedAnimationFrameIndex: 2, selectedAnimationCellIndex: 0 });
  form = document.createElement("section");
  document.body.append(form);
});

afterEach(async () => {
  if (document.body.hasChildNodes()) await mutateDom(() => document.body.replaceChildren());
  vi.clearAllTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function render(record = animation): void {
  form.replaceChildren();
  renderBattleAnimationRecordForm(form, record);
}
function node(testid: string): HTMLElement {
  const element = form.querySelector(`[data-testid="${testid}"]`);
  if (!(element instanceof HTMLElement)) throw new Error(`Missing ${testid}`);
  return element;
}
function play(): HTMLButtonElement {
  const button = node("db-animation-play");
  if (!(button instanceof HTMLButtonElement)) throw new Error("Expected playback button");
  return button;
}
function imageResult(result: "load" | "error" = "load"): void {
  const image = PreviewImage.requests.at(-1);
  if (!image) throw new Error("Expected image request");
  image.dispatchEvent(new Event(result));
}
function position(): string { return node("db-animation-stage-target").style.backgroundPosition; }
function expectPlaying(playing: boolean): void { expect(play().getAttribute("aria-pressed")).toBe(String(playing)); }

// Subscribe before the DOM mutation. Happy DOM delivers MutationObservers through
// its timer queue, so advancing zero runs that exact lifecycle notification.
async function mutateDom(action: () => void): Promise<void> {
  const observed = new Promise<void>((resolve) => {
    const observer = new MutationObserver(() => { observer.disconnect(); resolve(); });
    observer.observe(document.body, { childList: true, subtree: true });
  });
  action();
  await vi.advanceTimersByTimeAsync(0);
  await observed;
}

describe("battle animation form playback lifetime", () => {
  it("autoplays from the beginning after image load, loops, and restores the editing frame", () => {
    render();
    expectPlaying(false);
    expect(play().disabled).toBe(true);
    imageResult();
    expectPlaying(true);
    expect(position()).toBe("0px 0px");
    vi.advanceTimersByTime(67);
    expect(position()).toBe("-96px 0px");
    vi.advanceTimersByTime(67 * 2);
    expectPlaying(true);
    expect(position()).toBe("0px 0px");
    expect(editorState.get().selectedAnimationFrameIndex).toBe(2);
    play().click();
    expectPlaying(false);
    expect(position()).toBe("-192px 0px");
    vi.advanceTimersByTime(67 * 6);
    expect(position()).toBe("-192px 0px");
  });

  it.each(["db-animation-frame-1", "db-animation-frame-prev"])("%s stops autoplay and preserves selection through field rerenders", (testid) => {
    render(); imageResult();
    node(testid).click(); imageResult();
    expectPlaying(false);
    expect(editorState.get().selectedAnimationFrameIndex).toBe(1);
    expect(node("db-animation-frame-1").classList.contains("active")).toBe(true);
    expect(position()).toBe("-96px 0px");
    node("db-animation-timing-add").click(); imageResult();
    expectPlaying(false);
    vi.advanceTimersByTime(67 * 4);
    expect(position()).toBe("-96px 0px");
  });

  it("explicit stop survives ordinary rerenders but does not leak into another record or form", () => {
    render(); imageResult(); play().click();
    node("db-animation-timing-add").click(); imageResult();
    expectPlaying(false);
    render({ ...animation, id: "preview-b" }); imageResult();
    expectPlaying(true);
    play().click();
    form = document.createElement("section");
    document.body.append(form);
    render(); imageResult();
    expectPlaying(true);
  });

  it("stop restores current inline cell edits rather than the render-time snapshot", () => {
    render(); imageResult();
    const input = node("db-animation-cell-x-0");
    if (!(input instanceof HTMLInputElement)) throw new Error("Expected x input");
    input.value = "55";
    input.dispatchEvent(new Event("input"));
    play().click();
    expect(node("db-animation-stage-target").style.transform).toBe("translate(55px, 0px) scale(1)");
  });

  it("reduced motion starts stopped but allows manual looping playback", () => {
    vi.spyOn(motionPreference, "matches", "get").mockReturnValue(true);
    render(); imageResult();
    expectPlaying(false);
    expect(play().disabled).toBe(false);
    expect(position()).toBe("-192px 0px");
    play().click();
    vi.advanceTimersByTime(67 * 4);
    expectPlaying(true);
    expect(position()).toBe("-96px 0px");
  });

  it.each([undefined, "missing-preview-resource"])("%s graphic has no fake effect or playing state", (resourceId) => {
    render({ ...animation, resourceId });
    expectPlaying(false);
    expect(play().disabled).toBe(true);
    expect(node("db-animation-preview-status").dataset.state).toBe("empty");
    expect(form.querySelector(".db-animation-stage-cell")).toBeNull();
  });

  it.each(["error", "blank", "out-of-sheet"])("%s image/cells cannot advertise playback", (kind) => {
    render(kind === "blank" ? { ...animation, frames: [{ cells: [] }] }
      : kind === "out-of-sheet" ? { ...animation, frames: [{ cells: [{ ...frames[0].cells[0], pattern: 50 }] }] }
      : animation);
    imageResult(kind === "error" ? "error" : "load");
    expectPlaying(false);
    expect(play().disabled).toBe(true);
    expect(node("db-animation-preview-status").dataset.state).toBe("empty");
    expect(form.querySelector(".db-animation-stage-cell")).toBeNull();
  });

  it("rerender cancels the old interval and ignores stale image completion", () => {
    const clear = vi.spyOn(window, "clearInterval");
    render(); imageResult();
    const oldTarget = node("db-animation-stage-target");
    node("db-animation-timing-add").click();
    expect(clear).toHaveBeenCalledTimes(1);
    const staleImage = PreviewImage.requests.at(-1);
    node("db-animation-timing-add").click();
    staleImage?.dispatchEvent(new Event("load"));
    expectPlaying(false);
    imageResult();
    vi.advanceTimersByTime(67);
    expect(position()).toBe("-96px 0px");
    expect(oldTarget.style.backgroundPosition).toBe("0px 0px");
  });

  it("cached tab detach pauses, reattachment starts exactly one loop, and modal close cleans up", async () => {
    const modal = document.createElement("div"); modal.className = "database-modal-backdrop";
    const workspace = document.createElement("div"); workspace.className = "oprn-record-battleAnimations";
    workspace.append(form); modal.append(workspace); document.body.append(modal);
    await mutateDom(() => { render(); imageResult(); });
    const intervals = vi.spyOn(window, "setInterval");
    const clear = vi.spyOn(window, "clearInterval");
    await mutateDom(() => workspace.remove());
    expect(clear).toHaveBeenCalledTimes(1);
    expectPlaying(false);
    await mutateDom(() => modal.append(workspace));
    expectPlaying(true);
    expect(intervals).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(67);
    expect(position()).toBe("-96px 0px");
    await mutateDom(() => modal.remove());
    expect(clear).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(67 * 4);
    expectPlaying(false);
  });
});
