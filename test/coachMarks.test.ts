import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  BASIC_COACH_MARKS,
  COACH_MARKS_SEEN_KEY,
  coachMarkPosition,
  dismissCoachMarks,
  maybeStartBasicCoachMarks,
} from "@/editor/coachMarks";
import { resetEditorUiModeForTests } from "@/editor/editorUiMode";
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

function click(testId: string): void {
  const node = findByTestId(fakeBody(), testId) as unknown as HTMLElement | null;
  if (!node) throw new Error(`testid not found: ${testId}`);
  node.click();
}

describe("coachMarkPosition", () => {
  const viewport = { width: 1280, height: 800 };
  const card = { width: 280, height: 196 };

  it("side별로 앵커 기준 위치를 계산하고 뷰포트 안으로 clamp한다", () => {
    const anchor = { left: 0, top: 100, right: 48, bottom: 500, width: 48 };
    expect(coachMarkPosition({ side: "right", anchor, viewport, card }).left).toBe(60);

    const rightEdge = { left: 1240, top: 100, right: 1280, bottom: 500, width: 40 };
    const clamped = coachMarkPosition({ side: "right", anchor: rightEdge, viewport, card });
    expect(clamped.left + 280).toBeLessThanOrEqual(viewport.width);

    const leftEdge = { left: 4, top: 100, right: 44, bottom: 500, width: 40 };
    expect(coachMarkPosition({ side: "left", anchor: leftEdge, viewport, card }).left).toBeGreaterThanOrEqual(12);
  });

  it("uses the measured card height when clamping the lower edge", () => {
    const lowAnchor = { left: 400, top: 760, right: 520, bottom: 790, width: 120 };
    const compactCard = { width: 280, height: 104 };
    const tallCard = { width: 280, height: 244 };

    expect(coachMarkPosition({ side: "below", anchor: lowAnchor, viewport, card: compactCard }).top).toBe(684);
    expect(coachMarkPosition({ side: "below", anchor: lowAnchor, viewport, card: tallCard }).top).toBe(544);
  });
});

describe("기본 모드 코치마크", () => {
  let restore: () => void;
  let storage: MemoryStorage;

  beforeEach(() => {
    restore = installFakeDom();
    storage = new MemoryStorage();
    resetEditorUiModeForTests("beginner");
  });

  afterEach(() => {
    dismissCoachMarks();
    restore();
  });

  it("첫 방문이면 1단계 카드를 띄우고, '다음'으로 완주하면 플래그를 저장한다", () => {
    maybeStartBasicCoachMarks(storage);

    expect(findByTestId(fakeBody(), `coach-mark-${BASIC_COACH_MARKS[0]!.id}`)).toBeTruthy();

    for (let step = 0; step < BASIC_COACH_MARKS.length; step += 1) click("coach-mark-next");

    expect(findByTestId(fakeBody(), "coach-mark-next")).toBeNull();
    expect(storage.getItem(COACH_MARKS_SEEN_KEY)).toBe("1");
  });

  it("건너뛰기는 즉시 닫고 다시 보지 않는다", () => {
    maybeStartBasicCoachMarks(storage);
    click("coach-mark-skip");

    expect(findByTestId(fakeBody(), "coach-mark-skip")).toBeNull();
    expect(storage.getItem(COACH_MARKS_SEEN_KEY)).toBe("1");

    maybeStartBasicCoachMarks(storage);
    expect(findByTestId(fakeBody(), "coach-mark-skip")).toBeNull();
  });

  it("이미 본 사용자와 전문가 모드에서는 시작하지 않는다", () => {
    storage.setItem(COACH_MARKS_SEEN_KEY, "1");
    maybeStartBasicCoachMarks(storage);
    expect(findByTestId(fakeBody(), "coach-mark-next")).toBeNull();

    storage.removeItem(COACH_MARKS_SEEN_KEY);
    resetEditorUiModeForTests("expert");
    maybeStartBasicCoachMarks(storage);
    expect(findByTestId(fakeBody(), "coach-mark-next")).toBeNull();
  });
});
