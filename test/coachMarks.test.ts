import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  BASIC_COACH_MARKS,
  COACH_MARKS_SEEN_KEY,
  STANDARD_WELCOME_SEEN_KEY,
  coachMarkPosition,
  dismissCoachMarks,
  maybeStartBasicCoachMarks,
  maybeStartStandardWelcomeCard,
} from "@/editor/coachMarks";
import {
  clearPendingAiBootIntent,
  clearWelcomeIntentBootFlags,
  setPendingAiBootIntent,
  shouldSuppressCoachMarksForWelcomeIntent,
} from "@/editor/aiBootIntent";
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

function appendAnchor(testId: string, rect: Partial<DOMRect>): FakeElement {
  const anchor = new FakeElement("div");
  anchor.dataset.testid = testId;
  anchor.getBoundingClientRect = () => ({
    bottom: rect.bottom ?? 160,
    height: rect.height ?? 40,
    left: rect.left ?? 0,
    right: rect.right ?? (rect.left ?? 0) + (rect.width ?? 0),
    top: rect.top ?? 120,
    width: rect.width ?? 0,
    x: rect.left ?? 0,
    y: rect.top ?? 120,
    toJSON: () => ({}),
  });
  fakeBody().append(anchor);
  return anchor;
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

    expect(BASIC_COACH_MARKS).toHaveLength(3);
    expect(findByTestId(fakeBody(), `coach-mark-${BASIC_COACH_MARKS[0]!.id}`)).toBeTruthy();

    for (let step = 0; step < BASIC_COACH_MARKS.length; step += 1) click("coach-mark-next");

    expect(findByTestId(fakeBody(), "coach-mark-next")).toBeNull();
    expect(storage.getItem(COACH_MARKS_SEEN_KEY)).toBe("1");
  });

  // 세 번째 후보였던 `ai-collapsed-restore` 는 접힘 상태와 함께 사라졌다 — 띠는 항상 상주해
  // 입력창이 늘 보이고, 폴백은 커맨드 바 하나로 충분하다.
  it("AI 단계는 렌더 시 보이는 입력창, 커맨드 바 순으로 앵커를 고른다", () => {
    const input = appendAnchor("ai-input", { left: 1000, right: 1100, width: 100 });
    appendAnchor("ai-command-bar", { left: 800, right: 900, width: 100 });

    maybeStartBasicCoachMarks(storage);
    click("coach-mark-next");
    click("coach-mark-next");
    let card = findByTestId(fakeBody(), "coach-mark-ai");
    expect(card?.style.left).toBe("708px");
    expect(card?.textContent).toContain("위쪽 초보/표준/전문가에서 화면 밀도를 바꿀 수 있어요.");

    dismissCoachMarks();
    input.getBoundingClientRect = () => ({
      bottom: 160, height: 40, left: 1000, right: 1000, top: 120, width: 0,
      x: 1000, y: 120, toJSON: () => ({}),
    });
    maybeStartBasicCoachMarks(storage);
    click("coach-mark-next");
    click("coach-mark-next");
    card = findByTestId(fakeBody(), "coach-mark-ai");
    expect(card?.style.left).toBe("508px");
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

describe("표준 모드 웰컴 카드", () => {
  let restore: () => void;
  let storage: MemoryStorage;

  beforeEach(() => {
    restore = installFakeDom();
    storage = new MemoryStorage();
    clearPendingAiBootIntent();
    clearWelcomeIntentBootFlags();
    resetEditorUiModeForTests("standard");
  });

  afterEach(() => {
    dismissCoachMarks();
    restore();
  });

  it("표준 모드 첫 방문이면 카드를 띄우고, '시작' 클릭 시 본 것으로 기록한 뒤 닫는다", () => {
    maybeStartStandardWelcomeCard(storage);

    expect(findByTestId(fakeBody(), "standard-welcome-card")).toBeTruthy();
    click("standard-welcome-start");

    expect(findByTestId(fakeBody(), "standard-welcome-card")).toBeNull();
    expect(storage.getItem(STANDARD_WELCOME_SEEN_KEY)).toBe("1");

    maybeStartStandardWelcomeCard(storage);
    expect(findByTestId(fakeBody(), "standard-welcome-card")).toBeNull();
  });

  it("이미 본 사용자는 다시 보지 않는다", () => {
    storage.setItem(STANDARD_WELCOME_SEEN_KEY, "1");
    maybeStartStandardWelcomeCard(storage);
    expect(findByTestId(fakeBody(), "standard-welcome-card")).toBeNull();
  });

  it("초보 모드에서는 띄우지 않는다", () => {
    resetEditorUiModeForTests("beginner");
    maybeStartStandardWelcomeCard(storage);
    expect(findByTestId(fakeBody(), "standard-welcome-card")).toBeNull();
  });

  it("welcome intent 부팅 중에는 띄우지 않는다", () => {
    setPendingAiBootIntent("모험 JRPG 만들어 줘");
    expect(shouldSuppressCoachMarksForWelcomeIntent()).toBe(true);

    maybeStartStandardWelcomeCard(storage);
    expect(findByTestId(fakeBody(), "standard-welcome-card")).toBeNull();
  });

  it("localStorage를 쓸 수 없는 환경에서는 예외 없이 띄우지 않는다", () => {
    const throwingStorage = {
      getItem(): string | null {
        throw new Error("localStorage unavailable");
      },
      setItem(): void {
        throw new Error("localStorage unavailable");
      },
    } as unknown as Storage;

    expect(() => maybeStartStandardWelcomeCard(throwingStorage)).not.toThrow();
    expect(findByTestId(fakeBody(), "standard-welcome-card")).toBeNull();
  });
});
