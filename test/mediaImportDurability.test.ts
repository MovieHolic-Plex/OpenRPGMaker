/** @vitest-environment happy-dom */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { importMediaResource, mediaImportRuleFor } from "@/editor/panels/resourceManagerMediaImport";
import { resetModalStackForTest } from "@/editor/ui/modalStack";
import { getMapEditHistoryState, resetMapEditHistory } from "@/editor/mapEditHistory";

class Reader extends EventTarget {
  static latest: Reader;
  result = "data:audio/ogg;base64,T2dnUw==";
  onload: (() => void | Promise<void>) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  constructor() { super(); Reader.latest = this; }
  readAsDataURL() {}
  abort() { this.onabort?.(); }
}

beforeEach(() => {
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: "dev-showcase" });
  store.replaceProject(createBlankProject());
  store._setPersistenceStateForTest({ loaded: true });
  resetMapEditHistory();
  vi.stubGlobal("FileReader", Reader);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  resetModalStackForTest();
  document.body.replaceChildren();
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false });
  vi.clearAllTimers();
  vi.useRealTimers();
});

function begin() {
  const imported = vi.fn();
  importMediaResource(new File(["OggS"], "chosen.ogg", { type: "audio/ogg" }), mediaImportRuleFor("music"), imported);
  return { imported, read: Reader.latest.onload?.() };
}

function button(id: string) {
  const element = document.querySelector<HTMLButtonElement>(`[data-testid="${id}"]`);
  if (!element) throw new Error(`Missing control ${id}`);
  return element;
}

it("offers an explicit save-copy decision before any showcase mutation and preserves source on cancel", async () => {
  const before = store.getCurrent();
  const promotion = vi.spyOn(store, "loadNewRemoteProjectTransactionally");
  const { imported, read } = begin();
  expect(imported).not.toHaveBeenCalled();
  expect(store.getCurrent()).toBe(before);
  button("app-modal-cancel").click();
  await read;
  expect(promotion).not.toHaveBeenCalled();
  expect(store.getCurrent()).toBe(before);
  expect(getMapEditHistoryState().canUndo).toBe(false);
});

it("does not announce success until the confirmed promotion has completed", async () => {
  let finish: (value: { projectId: string }) => void = () => { throw new Error("Missing promotion"); };
  let entered: () => void = () => {};
  const started = new Promise<void>(resolve => { entered = resolve; });
  const promotion = vi.spyOn(store, "loadNewRemoteProjectTransactionally").mockImplementation(async candidate => {
    expect(Object.values(candidate.assets.uploaded).some(asset => asset.name === "chosen")).toBe(true);
    expect(store.getCurrent().assets.uploaded).toEqual({});
    return new Promise(resolve => { finish = resolve; entered(); });
  });
  const { imported, read } = begin();
  expect(imported).not.toHaveBeenCalled();
  button("app-modal-confirm").click();
  // Await the exact call boundary before releasing the durable result.
  await started;
  expect(promotion).toHaveBeenCalledOnce();
  expect(imported).not.toHaveBeenCalled();
  finish({ projectId: "new-copy" });
  await read;
  expect(imported).toHaveBeenCalledOnce();
});

it("keeps source and history unchanged when the confirmed promotion rejects", async () => {
  const before = store.getCurrent();
  vi.spyOn(store, "loadNewRemoteProjectTransactionally").mockRejectedValue(new Error("save unavailable"));
  const { imported, read } = begin();
  button("app-modal-confirm").click();
  await read;
  expect(imported).not.toHaveBeenCalled();
  expect(store.getCurrent()).toBe(before);
  expect(getMapEditHistoryState().canUndo).toBe(false);
  expect(document.querySelector('[data-testid="toast"]')?.classList.contains("error")).toBe(true);
});

it("cannot promote the old candidate after an edit during the confirmation", async () => {
  const promotion = vi.spyOn(store, "loadNewRemoteProjectTransactionally");
  const { imported, read } = begin();
  store.update(draft => { draft.meta.title = "newer work"; });
  button("app-modal-confirm").click();
  await read;
  expect(promotion).not.toHaveBeenCalled();
  expect(imported).not.toHaveBeenCalled();
  expect(store.getCurrent().meta.title).toBe("newer work");
});

it("awaits the ordinary remote flush before reporting an accepted import", async () => {
  store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: true, disabledReason: null });
  let finish: () => void = () => { throw new Error("Missing flush"); };
  const flush = vi.spyOn(store, "flush").mockImplementation(() => new Promise(resolve => {
    finish = () => resolve({ kind: "saved" });
  }));
  // Avoid scheduling a real network timer; the explicit flush is the asserted boundary.
  vi.useFakeTimers();
  const { imported, read } = begin();
  expect(flush).toHaveBeenCalledOnce();
  expect(imported).not.toHaveBeenCalled();
  finish();
  await read;
  expect(imported).toHaveBeenCalledOnce();
  vi.clearAllTimers();
  vi.useRealTimers();
});
