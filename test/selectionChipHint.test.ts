import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { editorState } from "@/editor/editorState";
import {
  installSelectionChipHint,
  notifyRightDragRegionSelected,
  resetSelectionChipHintForTests,
  RIGHT_DRAG_REGION_HINT_KEY,
  SELECTION_CHIP_HINT_KEY,
  setRightDragRegionHintStorage,
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

// 우클릭 드래그는 **다른 제스처**다. 선택 도구 전환에 걸린 위 힌트는 우클릭 사용자를 못 잡고,
// 기본(beginner) 모드에서는 선택 도구가 도구막대에 없어 아예 뜨지 않는다.
describe("우클릭 드래그 영역 힌트", () => {
  let restore: () => void;
  let storage: MemoryStorage;

  beforeEach(() => {
    restore = installFakeDom();
    storage = new MemoryStorage();
    resetSelectionChipHintForTests();
    setRightDragRegionHintStorage(storage);
  });

  afterEach(() => {
    restore();
    resetSelectionChipHintForTests();
  });

  it("첫 우클릭 드래그 성공 직후 1회만 토스트를 띄운다", () => {
    notifyRightDragRegionSelected();

    const toastNode = findByTestId(fakeBody(), "toast");
    // 문구는 화면에 실제로 있는 라벨만 쓴다 — 「AI 작업」은 액션 바의 첫 버튼이다.
    expect(toastNode?.textContent).toContain("AI 작업");
    expect(storage.getItem(RIGHT_DRAG_REGION_HINT_KEY)).toBe("1");

    if (toastNode) toastNode.textContent = "";
    notifyRightDragRegionSelected();
    expect(findByTestId(fakeBody(), "toast")?.textContent).not.toContain("AI 작업");
  });

  it("이미 본 사용자는 처음부터 토스트가 없다", () => {
    storage.setItem(RIGHT_DRAG_REGION_HINT_KEY, "1");

    notifyRightDragRegionSelected();

    expect(findByTestId(fakeBody(), "toast")).toBeNull();
  });

  it("선택 도구 힌트와 서로 다른 키를 쓴다 — 한쪽을 봤다고 다른 쪽이 사라지지 않는다", () => {
    storage.setItem(SELECTION_CHIP_HINT_KEY, "1");

    notifyRightDragRegionSelected();

    expect(findByTestId(fakeBody(), "toast")?.textContent).toContain("AI 작업");
    expect(RIGHT_DRAG_REGION_HINT_KEY).not.toBe(SELECTION_CHIP_HINT_KEY);
  });
});
