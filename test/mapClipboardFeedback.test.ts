import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

let restoreDom: (() => void) | null = null;

function fakeBody(): FakeElement {
  if (document.body instanceof FakeElement) return document.body;
  throw new Error("Expected fake body");
}

beforeEach(() => {
  vi.resetModules();
  restoreDom = installFakeDom();
});

afterEach(() => {
  restoreDom?.();
  restoreDom = null;
  vi.resetModules();
});

async function setupClipboard(): Promise<{
  readonly copySelection: (mapId: string) => boolean;
  readonly mapId: string;
  readonly pasteClipboard: (mapId: string, x: number, y: number) => boolean;
}> {
  const { editorState } = await import("@/editor/editorState");
  const { copySelection, pasteClipboard } = await import("@/editor/mapClipboard");
  const { createBlankProject } = await import("@/project/defaults");
  const { store } = await import("@/project/store");
  store.replace(createBlankProject());
  editorState.set({ selection: null, clipboard: null });
  return { copySelection, mapId: store.getCurrent().startMapId, pasteClipboard };
}

describe("맵 클립보드 피드백", () => {
  it("선택 영역 없이 복사하면 false와 안내 토스트를 반환한다", async () => {
    const { copySelection, mapId } = await setupClipboard();

    expect(copySelection(mapId)).toBe(false);

    expect(findByTestId(fakeBody(), "toast")?.textContent).toContain("선택");
  });

  it("클립보드 없이 붙여넣으면 false와 안내 토스트를 반환한다", async () => {
    const { mapId, pasteClipboard } = await setupClipboard();

    expect(pasteClipboard(mapId, 1, 1)).toBe(false);

    expect(findByTestId(fakeBody(), "toast")?.textContent).toContain("복사");
  });
});
