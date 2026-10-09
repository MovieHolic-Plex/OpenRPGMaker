// 저장 실패 가시성 계약 — 톱바 저장 상태 칩.
//
// 실측 배경(2026-08-29 관측성 감사):
//  · `AutoSaveState` 는 error(message·retryCount)까지 갖추고 있었고, 그걸 그리는
//    `renderDbConnectionStatus` + CSS 8종도 이미 있었다. 그런데 하단 상태바 폐지(2026-08-25)로
//    칩이 호스트를 잃어 **프로덕션 호출 사이트가 0건**이었다(rg: 정의 1 + 테스트 5 + 주석 1).
//  · `subscribeAutoSave` 구독자도 이벤트 편집기 드래프트 체크포인트 1곳뿐이었다.
//  · 남은 `renderPersistenceModeBanner` 는 `status.kind !== "disabled"` 면 null 을 돌려주므로
//    autosave 실패를 아예 다루지 않고, 마운트 시 1회만 그려져 상태 변화에도 반응하지 않는다.
//  → 결과적으로 오토세이브가 계속 실패해도 사용자·감독 누구도 모르고 console.error 만 남았다.
//
// 계약: 실패·충돌은 톱바에 뜨고, saved 로 돌아가면 사라지고, 톱바 재렌더가 구독을 누적시키지 않는다.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { editorState } from "@/editor/editorState";
import { createBlankProject } from "@/project/defaults";
import { store, type AutoSaveState } from "@/project/store";
import { _resetLoggerForTest, getLogEntries } from "@/util/logger";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

const { renderTopbar } = await import("@/editor/panels/menu");

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return Array.from(this.values.keys())[index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

let restoreDom: (() => void) | null = null;
let previousWindow: unknown;
/** menu.ts 는 팝업 바깥 클릭 리스너를 window.setTimeout(…, 0) 으로 미룬다 — 해체 전에 취소한다. */
let pendingTimers: ReturnType<typeof globalThis.setTimeout>[] = [];

/** 구독된 autosave 리스너. 개수가 곧 누수 여부다. */
let autoSaveListeners: ((state: AutoSaveState) => void)[] = [];
let unsubscribeCount = 0;
let autoSaveState: AutoSaveState = { kind: "idle" };
/**
 * menu.ts 는 이전 구독 해제 함수를 모듈 상태로 들고 있어 테스트 경계를 넘어 살아남는다.
 * 즉 다음 테스트의 첫 renderTopbar 가 **직전 테스트의** 해제 함수를 부른다 — 세대 번호로
 * 걸러내지 않으면 해제 횟수가 1 더 세어진다(실측: 4 렌더에 5).
 */
let channelGeneration = 0;

function fake(node: HTMLElement): FakeElement {
  if (node instanceof FakeElement) return node;
  throw new Error("expected FakeElement");
}

function installBrowserGlobals(): void {
  const storage = new MemoryStorage();
  Object.defineProperty(globalThis, "localStorage", { configurable: true, writable: true, value: storage });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    writable: true,
    value: {
      localStorage: storage,
      innerWidth: 1600,
      innerHeight: 1000,
      setTimeout: ((handler: TimerHandler, timeout?: number) => {
        const handle = globalThis.setTimeout(handler as () => void, timeout);
        pendingTimers.push(handle);
        return handle;
        // Node 의 setTimeout 타입에는 `__promisify__` 가 붙어 있어 직접 단정이 막힌다.
        // 프로덕션 코드는 브라우저 시그니처만 쓰므로 unknown 경유가 맞다.
      }) as unknown as typeof globalThis.setTimeout,
      clearTimeout: globalThis.clearTimeout.bind(globalThis),
      requestAnimationFrame: (cb: FrameRequestCallback) => { void cb; return 0; },
      scrollTo: vi.fn(),
      getComputedStyle: () => ({ getPropertyValue: () => "" }),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    },
  });
  Object.defineProperty(document, "documentElement", { configurable: true, value: document.createElement("html") });
  Object.defineProperty(document, "fullscreenElement", { configurable: true, writable: true, value: null });
}

/** store 의 autosave 채널을 테스트가 직접 구동한다 — 상태 전이는 private setter 뒤에 있다. */
function installAutoSaveChannel(): void {
  channelGeneration += 1;
  const generation = channelGeneration;
  vi.spyOn(store, "getAutoSaveState").mockImplementation(() => autoSaveState);
  vi.spyOn(store, "subscribeAutoSave").mockImplementation((listener) => {
    autoSaveListeners.push(listener);
    return () => {
      if (generation !== channelGeneration) return;
      unsubscribeCount += 1;
      autoSaveListeners = autoSaveListeners.filter((item) => item !== listener);
    };
  });
}

function emitAutoSave(next: AutoSaveState): void {
  autoSaveState = next;
  for (const listener of [...autoSaveListeners]) listener(next);
}

function renderFreshTopbar(): HTMLElement {
  const topbar = document.createElement("div");
  renderTopbar(topbar);
  return topbar;
}

function saveStatusHost(topbar: HTMLElement): FakeElement {
  const host = findByTestId(fake(topbar), "topbar-save-status");
  if (!host) throw new Error("톱바에 저장 상태 칩 호스트가 없다");
  return host;
}

beforeEach(() => {
  previousWindow = globalThis.window;
  restoreDom = installFakeDom();
  installBrowserGlobals();
  _resetLoggerForTest();
  autoSaveListeners = [];
  unsubscribeCount = 0;
  autoSaveState = { kind: "idle" };
  installAutoSaveChannel();
  store.replace(createBlankProject());
  editorState.set({
    currentMapId: store.getCurrent().startMapId,
    layer: "lower",
    tool: "paint",
    selectedEventId: null,
  });
});

afterEach(async () => {
  await new Promise<void>((resolve) => { globalThis.setTimeout(resolve, 0); });
  for (const handle of pendingTimers) globalThis.clearTimeout(handle);
  pendingTimers = [];
  restoreDom?.();
  restoreDom = null;
  Reflect.deleteProperty(globalThis, "localStorage");
  Object.defineProperty(globalThis, "window", { configurable: true, writable: true, value: previousWindow });
  vi.restoreAllMocks();
  _resetLoggerForTest();
});

describe("톱바 저장 상태 칩", () => {
  it("자동 저장이 실패하면 칩과 다시 저장 버튼이 뜨고 재시도 횟수를 보여준다", () => {
    // Break: 저장이 계속 실패하는데 화면에는 아무 흔적이 없다(칩이 호스트를 다시 잃는다).
    const topbar = renderFreshTopbar();
    const host = saveStatusHost(topbar);
    expect(host.hidden, "조용한 상태에서는 접혀 있어야 한다").toBe(true);

    emitAutoSave({ kind: "error", message: "provider 401 secret detail", retryCount: 3 });

    expect(host.hidden).toBe(false);
    expect(host.style.display).toBe("inline-flex");
    expect(host.dataset.autosaveKind).toBe("error");
    // 라이브 리전은 내용이 바뀌기 전부터 DOM 에 있어야 읽힌다.
    expect(host.getAttribute("role")).toBe("status");
    expect(host.getAttribute("aria-live")).toBe("polite");

    expect(findByTestId(host, "db-connection-status"), "기존 칩을 재사용해야 한다").not.toBeNull();
    expect(findByTestId(host, "db-autosave-retry"), "다시 저장 진입점").not.toBeNull();
    const state = findByTestId(host, "db-autosave-state");
    expect(state?.className ?? "").toContain("db-autosave-state");
    expect(state?.textContent ?? "").toContain("저장 실패");
    expect(state?.textContent ?? "").toContain("3회");
    // 오류 원문 노출 금지 계약(결함 ⑫)은 그대로 유지된다.
    expect(host.textContent).not.toContain("provider 401 secret detail");
  });

  it("저장 충돌도 같은 칩으로 뜬다 — store 가 conflict 를 error 로 접어 보낸다", () => {
    // Break: AutoSaveState 에 conflict kind 가 없다는 사실을 잊고 충돌 분기를 따로 만들었다가
    // 실제 충돌(kind:"error" + 충돌 문구)을 아무 데서도 안 그리게 된다.
    const topbar = renderFreshTopbar();
    const host = saveStatusHost(topbar);

    emitAutoSave({ kind: "error", message: "온라인 저장이 충돌했습니다. 저장본을 다시 불러온 뒤 저장하세요." });

    expect(host.hidden).toBe(false);
    expect(findByTestId(host, "db-connection-status")).not.toBeNull();
    expect(findByTestId(host, "db-autosave-retry")).not.toBeNull();
  });

  it("실패가 아닌 상태에서는 조용하고 saved 로 돌아가면 사라진다", () => {
    // Break: "저장됨"·"저장 대기"가 톱바에 상주해 정작 실패했을 때의 신호 가치를 잡아먹고,
    //        281px 짜리 칩이 칠할 때마다 떴다 사라져 옆 버튼을 좌우로 흔든다(실측 캡처).
    const topbar = renderFreshTopbar();
    const host = saveStatusHost(topbar);

    emitAutoSave({ kind: "pending" });
    expect(host.hidden).toBe(true);
    emitAutoSave({ kind: "saving" });
    expect(host.hidden).toBe(true);

    emitAutoSave({ kind: "error", message: "network down", retryCount: 1 });
    expect(host.hidden).toBe(false);
    expect(findByTestId(host, "db-connection-status")).not.toBeNull();

    // 실패 에피소드 중의 재시도(saving)는 칩을 붙잡아 둔다 — 눌렀는데 사라지면 결과를 오해한다.
    emitAutoSave({ kind: "saving" });
    expect(host.hidden, "재시도 중에도 칩이 남는다").toBe(false);
    expect(host.dataset.autosaveKind).toBe("saving");

    emitAutoSave({ kind: "saved", at: Date.now() });
    expect(host.hidden, "성공하면 조용해진다").toBe(true);
    expect(host.style.display).toBe("none");
    expect(findByTestId(host, "db-connection-status")).toBeNull();
    expect(findByTestId(host, "db-autosave-retry")).toBeNull();

    emitAutoSave({ kind: "idle" });
    expect(host.hidden).toBe(true);
  });

  it("톱바를 다시 그려도 autosave 구독이 누적되지 않는다", () => {
    // Break: mode.ts 가 renderTopbar 를 6곳에서 부르므로 구독이 세션 동안 쌓여
    // 죽은 DOM 을 계속 그린다(실측된 리스너 누수 유형).
    const first = renderFreshTopbar();
    renderFreshTopbar();
    renderFreshTopbar();
    const last = renderFreshTopbar();

    expect(autoSaveListeners.length, "살아 있는 구독은 항상 1개").toBe(1);
    expect(unsubscribeCount, "재렌더마다 이전 구독을 끊는다").toBe(3);

    emitAutoSave({ kind: "error", message: "network down", retryCount: 2 });

    expect(saveStatusHost(last).hidden, "최신 톱바가 상태를 받는다").toBe(false);
    expect(saveStatusHost(first).hidden, "떼어낸 톱바는 더 이상 갱신되지 않는다").toBe(true);
  });

  it("다시 저장 버튼이 실제 저장을 재시도한다", async () => {
    // Break: 실패는 보이는데 그 자리에서 되돌릴 방법이 없다.
    const flush = vi.spyOn(store, "flush").mockResolvedValue({ kind: "saved" });
    const topbar = renderFreshTopbar();
    const host = saveStatusHost(topbar);
    emitAutoSave({ kind: "error", message: "network down", retryCount: 1 });

    findByTestId(host, "db-autosave-retry")?.click();

    await vi.waitFor(() => expect(flush).toHaveBeenCalledTimes(1));
    await Promise.resolve();
    await Promise.resolve();
  });

  it("상태 전이를 autosave 네임스페이스 로그로 남긴다", () => {
    // Break: 화면을 안 보고 있었던 실패는 사후에 조회할 데가 없어진다(감사 원점).
    const topbar = renderFreshTopbar();
    saveStatusHost(topbar);

    emitAutoSave({ kind: "pending" });
    emitAutoSave({ kind: "error", message: "network down", retryCount: 4 });

    const errors = getLogEntries({ ns: "autosave", minLevel: "error" });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.detail).toMatchObject({ message: "network down", retryCount: 4 });
    // 진행 상태는 콘솔을 시끄럽게 하지 않되 링버퍼에는 남는다.
    expect(getLogEntries({ ns: "autosave" }).some((entry) => entry.level === "debug")).toBe(true);
  });

  it("톱바의 기존 저장·열기·테스트 동작을 건드리지 않는다", () => {
    // Break: 칩을 끼우면서 트레일링 클러스터나 클래식 툴바 버튼이 밀려 사라진다.
    const topbar = fake(renderFreshTopbar());

    // 열기·가져오기·저장본 다시 불러오기는 프로젝트 메뉴 항목이다(2026-09-03, 클래식 툴바 행 삭제).
    for (const testId of [
      "toolbar-save",
      "menu-project",
      "topbar-test-play",
      "topbar-ai-settings",
      "editor-topbar-trailing",
    ]) {
      expect(findByTestId(topbar, testId), testId).not.toBeNull();
    }
  });
});
