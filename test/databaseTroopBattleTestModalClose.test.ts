import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { openDatabaseModal } from "@/editor/panels/databaseModal";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { documentListenerCount, installFakeDom } from "./fakeDom";

// 전투 테스트는 실제 배틀 런타임(캔버스/자산)이 필요해 무겁다 — 여기서 검증할 것은 "버튼을
// 누르면 모달이 정식 close() 경로로 정리되는가"이지 배틀 씬 자체가 아니므로 스텁으로 대체한다.
vi.mock("@/editor/panels/testPlayModal", () => ({
  openTroopBattleTestModal: vi.fn(async () => undefined),
}));

let restoreDom: (() => void) | undefined;
let previousWindow: typeof globalThis.window | undefined;

beforeEach(() => {
  restoreDom = installFakeDom();
  previousWindow = globalThis.window;
  // close()가 무조건 stopModalDrag()를 거치며 window.addEventListener/removeEventListener를
  // 호출한다(드래그가 실제로 시작됐는지 여부와 무관) — 이 스위트는 environment: "node"라
  // window가 없으므로 최소 스텁을 심는다.
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      clearTimeout,
      localStorage: createFakeLocalStorage(),
      setTimeout: (handler: TimerHandler): number => {
        if (typeof handler === "function") handler();
        return 0;
      },
    },
  });
  store.replace(createBlankProject());
  resetMapEditHistory();
});

afterEach(() => {
  document.querySelector("[data-testid='database-modal']")?.remove();
  restoreDom?.();
  restoreDom = undefined;
  if (previousWindow === undefined) Reflect.deleteProperty(globalThis, "window");
  else Object.defineProperty(globalThis, "window", { configurable: true, value: previousWindow });
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

describe("troop battle test button closes the database modal cleanly (M11)", () => {
  it("removes both document keydown listeners instead of leaking them via a raw DOM remove", () => {
    openDatabaseModal("troops");

    // openDatabaseModal registers 2 document keydown listeners: the dirty-close controller's
    // Escape handler and the undo/redo history hotkey handler. modalStack 의 공유 캡처
    // 리스너 1개가 더해져 3 이다 — 그쪽은 document 당 한 번만 붙고 모달과 함께 사라지지 않는다
    // (2026-09-19: DB 모달이 창 모드에서 modalStack 에 등록되면서 추가됐다).
    expect(documentListenerCount("keydown")).toBe(3);
    expect(document.querySelector("[data-testid='database-modal']")).not.toBeNull();

    const battleTestButton = document.querySelector<HTMLButtonElement>("[data-testid='db-troop-battle-test']");
    if (!battleTestButton) throw new Error("missing battle test button — troop record form not rendered");
    battleTestButton.click();

    // fix(db) M11: 전투 테스트 버튼이 document.querySelector(...)?.remove()로 모달 DOM만
    // 뜯어내면 이 2개 리스너가 정리되지 않고 샌다. requestDatabaseModalClose("battleTest")를
    // 통해 정식 close()가 돌아야 한다.
    // 모달이 등록한 2개는 사라지고, 공유 리스너 1개만 남는다(누수가 아니라 문서 단위 상주).
    expect(documentListenerCount("keydown")).toBe(1);
    expect(document.querySelector("[data-testid='database-modal']")).toBeNull();
  });
});
