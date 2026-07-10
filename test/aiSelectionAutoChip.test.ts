import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderAiChatPanel } from "@/editor/panels/aiChatPanel";
import { editorState } from "@/editor/editorState";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

describe("selection auto chip", () => {
  let restore: () => void;
  beforeEach(() => {
    restore = installFakeDom();
    store.replace(createBlankProject());
    editorState.set({ selection: null, currentMapId: store.getCurrent().startMapId });
    document.body.append(renderAiChatPanel());
  });
  afterEach(() => {
    editorState.set({ selection: null });
    restore();
  });

  function chip(): unknown {
    return findByTestId(document.body as unknown as FakeElement, "ai-selection-chip");
  }

  it("선택이 생기면 칩이 자동 부착되고, ×로 해제하면 같은 선택엔 다시 붙지 않는다", () => {
    const mapId = store.getCurrent().startMapId;
    editorState.set({ selection: { mapId, x: 1, y: 1, width: 3, height: 3 } });
    expect(chip()).toBeTruthy();
    (findByTestId(document.body as unknown as FakeElement, "ai-selection-chip-clear") as unknown as HTMLElement).click();
    expect(chip()).toBeFalsy();
    // 같은 선택 그대로 → 재부착 없음
    editorState.set({ zoom: 3 });
    expect(chip()).toBeFalsy();
    // 새 선택 → 재부착
    editorState.set({ selection: { mapId, x: 2, y: 2, width: 4, height: 4 } });
    expect(chip()).toBeTruthy();
  });
});
