import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  registerAiAssistantBridge,
  unregisterAiAssistantBridge,
  type AiBridgeTurnResult,
} from "@/editor/aiAssistantBridge";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { databaseTabLabel, setDatabaseActiveTab } from "@/editor/panels/database";
import { openDatabaseModal, requestDatabaseModalClose } from "@/editor/panels/databaseModal";
import { setViewModeForCollection } from "@/editor/panels/databaseRecordViewSession";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";
import { installAdmitClient } from "./aiJobAdmitSupport";

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
  // 이 테스트는 enemies 리스트 행의 live-refresh/포커스 보존을 검증한다 — 갤러리 기본값을 list 로 고정.
  setViewModeForCollection("enemies", "list");
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
  it("opens as a database-aware assistant: context chip + suggestions for the current tab", () => {
    registerAiAssistantBridge({
      send: () => Promise.resolve(turnResultStub()),
      getStatus: () => turnResultStub().status,
      getAudit: () => [],
      getHarness: () => null,
      abort: () => undefined,
      openPanel: () => undefined,
    });

    openDatabaseModal("overview");
    const modal = modalRoot();
    const toggle = findByTestId(modal, "database-ai-toggle");
    expect(toggle?.textContent).toContain("AI 어시스턴트");
    toggle?.click();

    const assistant = findByTestId(modal, "database-ai-bar");
    // 무엇이 AI 에게 전달되는지 보인다 — 숨은 컨텍스트가 아니다.
    expect(findByTestId(assistant ?? modal, "database-ai-context")?.textContent).toContain("개요");
    // 개요(레코드 없음)에서는 프로젝트 우선순위 + 이 탭 점검만. 범용 맵·이벤트 문장은 없다.
    expect(findByTestId(assistant ?? modal, "database-ai-suggestion-project")).toBeTruthy();
    expect(findByTestId(assistant ?? modal, "database-ai-suggestion-review")).toBeTruthy();
    expect(findByTestId(assistant ?? modal, "database-ai-suggestion-tune")).toBeNull();
    expect(findByTestId(assistant ?? modal, "database-ai-suggestion-map")).toBeNull();
  });

  it("sends the request through the chat pipeline with the DB context footer and shows the turn in place", async () => {
    store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: false, disabledReason: "load-failed" });
    await store.loadFallbackProject(createBlankProject());
    const jobs = installAdmitClient();
    const openPanel = vi.fn();
    registerAiAssistantBridge({
      send: () => Promise.resolve(turnResultStub()),
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
    // 몬스터 탭에서는 선택 레코드 기반 제안이 앞선다.
    expect(findByTestId(bar ?? modal, "database-ai-suggestion-tune")).toBeTruthy();
    expect(findByTestId(bar ?? modal, "database-ai-suggestion-balance")?.textContent).toContain("난이도");

    const input = findByTestId(modal, "database-ai-input");
    if (!input) throw new Error("missing ai input");
    input.value = "이 몬스터 스탯을 중반 밸런스로";
    const pending = jobs.nextAdmitted();
    findByTestId(modal, "database-ai-run")?.click();
    const admitted = await pending;
    const message = String(admitted.input.payload.instruction ?? "");
    expect(message.startsWith("이 몬스터 스탯을 중반 밸런스로")).toBe(true);
    // 컨텍스트 풋터: 탭 라벨 + 선택 레코드(세션 무선택이면 첫 레코드) — buildSpec 호환 한 줄.
    expect(message).toContain("[컨텍스트] 에디터 전체 요청");
    expect(message).toContain(`현재 화면: 데이터베이스 DB 탭 ${databaseTabLabel("enemies")}`);
    const firstEnemy = store.getCurrent().database.enemies[0];
    if (firstEnemy) {
      expect(message).toContain(`선택 레코드: ${firstEnemy.name || "(이름 없음)"}(${firstEnemy.id})`);
    }
    // 입력은 비고, 요청 원문과 진행 상태가 **바 안에** 뜬다. 채팅 패널은 모달 뒤라 열지 않는다.
    expect(input.value).toBe("");
    expect(openPanel).not.toHaveBeenCalled();
    const turn = findByTestId(modal, "database-ai-turn");
    expect(turn?.hidden).toBe(false);
    expect(findByTestId(modal, "database-ai-turn-request")?.textContent).toBe("이 몬스터 스탯을 중반 밸런스로");
    // E2E 훅: 실 LLM 호출 없이 전송 도달을 검증할 수 있게 마지막 요청을 남긴다.
    expect(window.__oprnDbAiLastRequest?.message).toBe(message);

    // 브리지 runSend 는 async 래퍼라 마이크로태스크가 몇 번 더 돈다 — 기다린다.
    const status = findByTestId(modal, "database-ai-turn-status");
    await jobs.complete({
      assistantText: "슬라임을 다듬었습니다.",
      audit: [{ kind: "tool", name: "tune_enemy", summary: "적 '슬라임' 튜닝: maxHp 18→40" }],
    });
    await vi.waitFor(() => expect(status?.dataset.phase).toBe("done"));
    expect(findByTestId(modal, "database-ai-turn-tools")?.textContent).toContain("maxHp 18→40");
    expect(findByTestId(modal, "database-ai-turn-answer")?.textContent).toContain("슬라임을 다듬었습니다.");

    // 빈 입력은 전송하지 않는다.
    findByTestId(modal, "database-ai-run")?.click();
    expect(jobs.admits).toHaveLength(1);

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

  it("flushes the skipped refresh when focus leaves the modal body (3파 리뷰 Medium)", () => {
    setDatabaseActiveTab("enemies");
    openDatabaseModal("enemies");
    const modal = modalRoot();
    const enemyId = store.getCurrent().database.enemies[0]?.id ?? "";
    const rowBefore = findByTestId(modal, `db-record-row-${enemyId}`);
    expect(rowBefore).not.toBeNull();

    const anyInput = modal.querySelectorAll("input").find((entry) => findByTestId(modal, "database-ai-bar")?.contains(entry) !== true);
    if (!anyInput) throw new Error("no input inside modal body");
    anyInput.focus();

    // 편집 중 도착한 외부(AI) 변경 — 스킵되지만 pendingRefresh 로 보류돼야 한다.
    store.update((draft) => {
      const enemy = draft.database.enemies.find((entry) => entry.id === enemyId);
      if (enemy) enemy.name = "편집 중 도착한 AI 변경";
    }, { scope: "database", collection: "enemies" });
    expect(findByTestId(modalRoot(), `db-record-row-${enemyId}`)).toBe(rowBefore);

    // 포커스가 본문을 떠나면(blur→focusout 버블) 보류분이 반영된다.
    (document as unknown as { activeElement: unknown }).activeElement = null;
    anyInput.dispatchEvent(new Event("focusout", { bubbles: true }));

    const row = findByTestId(modalRoot(), `db-record-row-${enemyId}`);
    expect(row?.textContent ?? "").toContain("편집 중 도착한 AI 변경");
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
