import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderCommitHistoryButton, renderIdentityTopbarControl } from "@/editor/teamWorkflowUi";
import { modalStackDepthForTest, resetModalStackForTest } from "@/editor/ui/modalStack";
import { createBlankProject } from "@/project/defaults";
import { setOwnerLabel } from "@/project/editorIdentity";
import { store } from "@/project/store";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

// 데이터베이스 모달의 도크 모드 백드롭은 pointer-events: none 이라, 데이터베이스를
// 켜 둔 채로 톱바의 신원 메뉴·커밋 히스토리를 열 수 있다. 이 팝오버들이 공용 Escape
// 계층을 점유하지 않으면 Escape 가 그대로 흘러 아래 데이터베이스가 대신 닫힌다.
//
// teamWorkflowUi.test.ts 는 document.addEventListener 를 vi.fn() 으로 덮어써서 Escape
// 라우팅을 볼 수 없다 — 그래서 계층 검증은 이 파일에서 따로 한다.
vi.mock("@/project/supabaseProjectSync", () => ({
  listProjectCommitsFromSupabase: vi.fn(async () => []),
}));

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

let restoreDom: (() => void) | null = null;

beforeEach(() => {
  restoreDom = installFakeDom();
  resetModalStackForTest();
  const storage = new MemoryStorage();
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: storage,
      setTimeout: (handler: TimerHandler) => {
        if (typeof handler === "function") handler();
        return 0;
      },
    },
  });
  store.replace(createBlankProject());
});

afterEach(() => {
  resetModalStackForTest();
  restoreDom?.();
  restoreDom = null;
  Reflect.deleteProperty(globalThis, "localStorage");
  Reflect.deleteProperty(globalThis, "window");
  vi.restoreAllMocks();
});

function fakeBody(): FakeElement {
  if (document.body instanceof FakeElement) return document.body;
  throw new Error("Expected fake body");
}

function fakeElement(node: HTMLElement): FakeElement {
  if (node instanceof FakeElement) return node;
  throw new Error("Expected fake element");
}

function dispatchEscape(): void {
  const event = new Event("keydown", { bubbles: true, cancelable: true }) as Event & { key: string };
  Object.defineProperty(event, "key", { configurable: true, value: "Escape" });
  document.dispatchEvent(event);
}

describe("톱바 팝오버의 Escape 계층", () => {
  it("커밋 히스토리 패널은 계층을 점유하고 Escape 로 자기만 닫는다", async () => {
    const button = renderCommitHistoryButton();
    document.body.append(button);

    button.click();
    await Promise.resolve();
    expect(findByTestId(fakeBody(), "commit-history-panel")).not.toBeNull();
    expect(modalStackDepthForTest()).toBe(1);

    dispatchEscape();

    expect(findByTestId(fakeBody(), "commit-history-panel")).toBeNull();
    expect(modalStackDepthForTest()).toBe(0);
  });

  it("신원 메뉴도 계층을 점유하고 Escape 로 자기만 닫는다", () => {
    setOwnerLabel("기존 사용자");
    const identity = renderIdentityTopbarControl(() => undefined);
    document.body.append(identity);

    findByTestId(fakeElement(identity), "topbar-identity")?.click();
    expect(findByTestId(fakeBody(), "identity-label-input")).not.toBeNull();
    expect(modalStackDepthForTest()).toBe(1);

    dispatchEscape();

    expect(findByTestId(fakeBody(), "identity-label-input")).toBeNull();
    expect(modalStackDepthForTest()).toBe(0);
  });
});
