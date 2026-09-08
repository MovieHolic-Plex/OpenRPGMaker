/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appearanceGenerationController } from "@/editor/characterAppearanceGeneration";
import { openDatabaseModal, requestDatabaseModalClose } from "@/editor/panels/databaseModal";
import { selectCharacterAppearance } from "@/editor/panels/databaseAppearanceView";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";

beforeEach(() => {
  const project = createBlankProject();
  project.database.characterAppearances = [
    { id: "first", name: "First", description: "" },
    { id: "second", name: "Second", description: "" },
  ];
  store.replace(project);
  selectCharacterAppearance("first");
  openDatabaseModal("characterAppearances");
});

afterEach(() => {
  requestDatabaseModalClose("battleTest");
  appearanceGenerationController.cancel();
  vi.unstubAllGlobals();
});

function click(testid: string): void {
  const element = document.querySelector(`[data-testid="${testid}"]`);
  if (!(element instanceof HTMLButtonElement)) throw new TypeError(`Missing button ${testid}`);
  element.click();
}

function deferred<T>() {
  let settle: (value: T) => void = () => { throw new TypeError("Promise not initialized"); };
  const promise = new Promise<T>((resolve) => { settle = resolve; });
  return { promise, resolve: (value: T) => settle(value) };
}

describe("appearance generation view lifecycle", () => {
  it.each([
    "appearance-row-second",
    "appearance-add",
    "appearance-duplicate",
    "appearance-delete",
    "db-tab-actors",
    "database-modal-close",
  ])("cancels generation and ignores late output when activating %s", async (action) => {
    const response = deferred<Response>();
    const started = deferred<void>();
    vi.stubGlobal("fetch", () => { started.resolve(); return response.promise; });
    const assetsBefore = Object.keys(store.getCurrent().assets.uploaded);
    const generation = appearanceGenerationController.generate({ appearanceId: "first", slot: "face" });
    await started.promise;
    expect(appearanceGenerationController.getState().status).toBe("generating");

    click(action);

    const statusAfterAction = appearanceGenerationController.getState().status;
    response.resolve(new Response(JSON.stringify({ image: {
      dataUrl: "data:image/png;base64,AAAA", mimeType: "image/png", model: "test", provider: "test",
    } }), { status: 200 }));
    await generation;
    expect(statusAfterAction).toBe("idle");
    expect(appearanceGenerationController.getState().status).toBe("idle");
    expect(Object.keys(store.getCurrent().assets.uploaded)).toEqual(assetsBefore);
    expect(store.getCurrent().database.characterAppearances?.every((record) => !record.face)).toBe(true);
  });
});
