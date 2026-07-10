import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  registerAiAssistantBridge,
  unregisterAiAssistantBridge,
  type AiBridgeTurnResult,
} from "@/editor/aiAssistantBridge";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { setDatabaseActiveTab } from "@/editor/panels/database";
import { openDatabaseModal, requestDatabaseModalClose } from "@/editor/panels/databaseModal";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

// DB 3파 M7 — DB 모달 안 AI 연결.
// ① AI 바 실행 시 채팅 파이프라인 전송 함수가 컨텍스트 풋터 포함 메시지로 호출된다.
// ② AI(외부 경로)가 store 를 바꾸면 열린 모달 DOM 이 즉시 갱신된다(stale 해소).
// ③ close 후 store 구독이 해제된다(리스너 누수 금지 — 1파 M11 교훈).

type FakeBrowserGlobals = {
  readonly window: typeof globalThis.window | undefined;
  readonly requestAnimationFrame: typeof globalThis.requestAnimationFrame | undefined;
};

let restoreDom: (() => void) | undefined;
let previousBrowserGlobals: FakeBrowserGlobals;

beforeEach(() => {
  restoreDom = installFakeDom();
  previousBrowserGlobals = {
    requestAnimationFrame: globalThis.requestAnimationFrame,
    window: globalThis.window,
  };
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      clearTimeout,
      // aiBridge=0 — registerAiAssistantBridge 가 로컬 HTTP 브리지 폴링 루프를 켜지 않게 한다
      // (가짜 setTimeout 이 즉시 실행이라 폴링이 무한 재귀가 된다).
      location: { search: "?aiBridge=0" },
      localStorage: createFakeLocalStorage(),
      setTimeout: (handler: TimerHandler): number => {
        if (typeof handler === "function") handler();
        return 0;
      },
    },
  });
  Object.defineProperty(globalThis, "requestAnimationFrame", {
    configurable: true,
    value: (callback: FrameRequestCallback): number => {
      callback(0);
      return 0;
    },
  });
  store.replace(createBlankProject());
  resetMapEditHistory();
});

afterEach(() => {
  requestDatabaseModalClose("battleTest");
  unregisterAiAssistantBridge();
  document.querySelector("[data-testid='database-modal']")?.remove();
  restoreDom?.();
  restoreDom = undefined;
  restoreBrowserGlobal("window", previousBrowserGlobals.window);
  restoreBrowserGlobal("requestAnimationFrame", previousBrowserGlobals.requestAnimationFrame);
});

function createFakeLocalStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => Array.from(values.keys())[index] ?? null,
    removeItem: (key: string) => void values.delete(key),
    setItem: (key: string, value: string) => void values.set(key, value),
  } as Storage;
}

function restoreBrowserGlobal(name: "window" | "requestAnimationFrame", value: unknown): void {
  if (value === undefined) {
    Reflect.deleteProperty(globalThis, name);
    return;
  }
  Object.defineProperty(globalThis, name, { configurable: true, value });
}

function modalRoot(): FakeElement {
  const backdrop = document.querySelector("[data-testid='database-modal']");
  if (!(backdrop instanceof FakeElement)) throw new Error("database modal not open");
  return backdrop;
}

function turnResultStub(): AiBridgeTurnResult {
  return {
    ok: true,
    status: { ready: true, turnBusy: false, configReady: true, lastStatus: "대기", bridgeConnected: false, panelMounted: true },
    audit: [],
    harness: null,
  };
}

function storeListenerCount(): number {
  return (store as unknown as { listeners: Set<unknown> }).listeners.size;
}

describe("database modal AI bar (M7-①)", () => {
  it("sends the request through the chat pipeline with the DB context footer and opens the chat dock", () => {
    const sent: string[] = [];
    const openPanel = vi.fn();
    registerAiAssistantBridge({
      send: (text: string) => {
        sent.push(text);
        return Promise.resolve(turnResultStub());
      },
      getStatus: () => turnResultStub().status,
      getAudit: () => [],
      getHarness: () => null,
      abort: () => undefined,
      openPanel,
    });

    openDatabaseModal("enemies");
    const modal = modalRoot();
    const toggle = findByTestId(modal, "database-ai-toggle");
    const bar = findByTestId(modal, "database-ai-bar");
    expect(toggle).not.toBeNull();
    expect(bar?.hidden).toBe(true);

    toggle?.click();
    expect(bar?.hidden).toBe(false);
    expect(toggle?.attrs["aria-expanded"]).toBe("true");

    const input = findByTestId(modal, "database-ai-input");
    if (!input) throw new Error("missing ai input");
    input.value = "이 몬스터 스탯을 중반 밸런스로";
    findByTestId(modal, "database-ai-run")?.click();

    expect(sent).toHaveLength(1);
    const message = sent[0] ?? "";
    expect(message.startsWith("이 몬스터 스탯을 중반 밸런스로")).toBe(true);
    // 컨텍스트 풋터: 탭 라벨 + 선택 레코드(세션 무선택이면 첫 레코드) — buildSpec 호환 한 줄.
    expect(message).toContain("[컨텍스트] 데이터베이스 DB 탭: 몬스터");
    const firstEnemy = store.getCurrent().database.enemies[0];
    if (firstEnemy) {
      expect(message).toContain(`선택 레코드: ${firstEnemy.name || "(이름 없음)"}(${firstEnemy.id})`);
    }
    // 채팅 도크(패널)를 연다 + 입력은 비운다.
    expect(openPanel).toHaveBeenCalledTimes(1);
    expect(input.value).toBe("");
    // E2E 훅: 실 LLM 호출 없이 전송 도달을 검증할 수 있게 마지막 요청을 남긴다.
    expect(window.__rpgzzuDbAiLastRequest?.message).toBe(message);

    // 빈 입력은 전송하지 않는다.
    findByTestId(modal, "database-ai-run")?.click();
    expect(sent).toHaveLength(1);

    // 닫기 버튼으로 바가 접힌다.
    findByTestId(modal, "database-ai-close")?.click();
    expect(bar?.hidden).toBe(true);
    expect(toggle?.attrs["aria-expanded"]).toBe("false");
  });
});

describe("database modal live refresh on store change (M7-②)", () => {
  it("re-renders the open modal body when the database changes outside the modal", () => {
    setDatabaseActiveTab("enemies");
    openDatabaseModal("enemies");
    const modal = modalRoot();
    const enemyId = store.getCurrent().database.enemies[0]?.id ?? "";
    expect(findByTestId(modal, `db-record-row-${enemyId}`)).not.toBeNull();

    // AI/외부 경로를 흉내: 모달 밖에서 store 를 직접 갱신한다(scope database).
    store.update((draft) => {
      const enemy = draft.database.enemies.find((entry) => entry.id === enemyId);
      if (enemy) enemy.name = "AI가 바꾼 몬스터";
    }, { scope: "database", collection: "enemies" });

    const row = findByTestId(modalRoot(), `db-record-row-${enemyId}`);
    expect(row?.textContent ?? "").toContain("AI가 바꾼 몬스터");
  });

  it("skips the refresh while the user is typing inside the modal body (focus preservation)", () => {
    setDatabaseActiveTab("enemies");
    openDatabaseModal("enemies");
    const modal = modalRoot();
    const enemyId = store.getCurrent().database.enemies[0]?.id ?? "";
    const rowBefore = findByTestId(modal, `db-record-row-${enemyId}`);
    expect(rowBefore).not.toBeNull();

    // 본문 안 텍스트 입력에 포커스 — keystroke 마다 오는 store.update 로 재렌더하면 포커스를 잃는다.
    const anyInput = modal.querySelectorAll("input").find((entry) => findByTestId(modal, "database-ai-bar")?.contains(entry) !== true);
    if (!anyInput) throw new Error("no input inside modal body");
    anyInput.focus();

    store.update((draft) => {
      const enemy = draft.database.enemies.find((entry) => entry.id === enemyId);
      if (enemy) enemy.name = "입력 중 변경";
    }, { scope: "database", collection: "enemies" });

    // 재렌더가 스킵됐으므로 리스트 행 노드가 그대로다(교체되지 않음).
    expect(findByTestId(modalRoot(), `db-record-row-${enemyId}`)).toBe(rowBefore);
  });
});

describe("database modal unsubscribes on close (M7-③)", () => {
  it("removes the store listener when the modal closes", () => {
    const baseline = storeListenerCount();
    openDatabaseModal("enemies");
    expect(storeListenerCount()).toBe(baseline + 1);

    requestDatabaseModalClose("battleTest");
    expect(storeListenerCount()).toBe(baseline);
    expect(document.querySelector("[data-testid='database-modal']")).toBeNull();
  });

  it("keeps exactly one store listener across reopen", () => {
    const baseline = storeListenerCount();
    openDatabaseModal("enemies");
    openDatabaseModal("actors");
    openDatabaseModal("enemies");
    expect(storeListenerCount()).toBe(baseline + 1);
    requestDatabaseModalClose("battleTest");
    expect(storeListenerCount()).toBe(baseline);
  });
});
