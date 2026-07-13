import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { editorState } from "@/editor/editorState";
import {
  installSelectionChipHint,
  resetSelectionChipHintForTests,
  SELECTION_CHIP_HINT_KEY,
} from "@/editor/selectionChipHint";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

function fakeBody(): FakeElement {
  if (document.body instanceof FakeElement) return document.body;
  throw new Error("Expected fake body");
}

describe("선택 도구 AI 칩 힌트", () => {
  let restore: () => void;
  let storage: MemoryStorage;

  beforeEach(() => {
    restore = installFakeDom();
    storage = new MemoryStorage();
    resetSelectionChipHintForTests();
    editorState.set({ tool: "paint", layer: "lower" });
  });

  afterEach(() => {
    restore();
    resetSelectionChipHintForTests();
  });

  it("선택 도구로 처음 바꿀 때 1회만 토스트를 띄우고 플래그를 저장한다", () => {
    installSelectionChipHint(storage);

    editorState.set({ tool: "select" });

    const toastNode = findByTestId(fakeBody(), "toast");
    expect(toastNode?.textContent).toContain("AI 작업");
    expect(storage.getItem(SELECTION_CHIP_HINT_KEY)).toBe("1");

    // 다른 도구로 갔다가 다시 select — 재노출 없음.
    if (toastNode) toastNode.textContent = "";
    editorState.set({ tool: "erase" });
    editorState.set({ tool: "select" });
    expect(findByTestId(fakeBody(), "toast")?.textContent).not.toContain("AI 작업");
  });

  it("이미 본 사용자는 처음부터 토스트가 없다", () => {
    storage.setItem(SELECTION_CHIP_HINT_KEY, "1");
    installSelectionChipHint(storage);

    editorState.set({ tool: "select" });

    expect(findByTestId(fakeBody(), "toast")).toBeNull();
  });

  it("select가 아닌 도구 전환은 반응하지 않는다", () => {
    installSelectionChipHint(storage);

    editorState.set({ tool: "fill" });
    editorState.set({ tool: "event", layer: "event" });

    expect(findByTestId(fakeBody(), "toast")).toBeNull();
    expect(storage.getItem(SELECTION_CHIP_HINT_KEY)).toBeNull();
  });
});
