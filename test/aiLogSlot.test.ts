// 로그 마운트 단일 출처 회귀 스펙 — 3단계(도크·로그 마운트 단일화).
//
// 고정하는 것: 같은 `log` 엘리먼트의 배치를 결정하는 코드가 세 함수(도크 정책·기록 열기·
// 스튜디오)에 흩어져 있어, 상태 조합마다 어느 마운트에 붙는지 코드로 알 수 없었다. 이제
// `mountLog()` 하나가 정하고 결과를 `panel.dataset.logSlot` 으로 노출한다.
//
// 표는 2026-08-23 브라우저 실측(verify-shots/ai-dock-log-mount/matrix-before.json)과 같다.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { editorState } from "@/editor/editorState";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { renderAiChatPanel } from "@/editor/panels/aiChatPanel";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { FakeElement, findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";

let restoreDom: (() => void) | null = null;
let storage: Map<string, string>;

beforeEach(() => {
  store.replace(createBlankProject());
  resetMapEditHistory();
  restoreDom = installFakeDom();
  storage = new Map();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    writable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => void storage.set(key, String(value)),
      removeItem: (key: string) => void storage.delete(key),
      clear: () => storage.clear(),
    },
  });
  editorState.set({
    currentMapId: store.getCurrent().startMapId,
    layer: "lower",
    tool: "paint",
    selection: null,
    chatDock: "float",
  });
});

afterEach(() => {
  restoreDom?.();
  restoreDom = null;
  Reflect.deleteProperty(globalThis, "localStorage");
});

function renderPanel(): FakeElement {
  const panel = renderWithFakeDom(() => renderAiChatPanel());
  // 부팅 접힘 상태에서는 도크 정책이 돌지 않는다 — 펼쳐서 잰다.
  findByTestId(panel, "ai-collapsed-restore")?.click();
  return panel;
}

/** 도크를 원하는 값까지 순환시킨다(glass → side → float → glass). */
function setDock(panel: FakeElement, want: string): void {
  const toggle = findByTestId(panel, "chat-dock-toggle");
  if (!toggle) throw new Error("dock toggle missing");
  for (let i = 0; i < 4; i += 1) {
    if (panel.dataset.chatDock === want) return;
    toggle.click();
  }
  throw new Error(`dock ${want} 로 못 갔다`);
}

function logParentClass(panel: FakeElement): string {
  const log = findByTestId(panel, "ai-chat-log");
  if (!log) return "(unmounted)";
  return log.parentNode instanceof FakeElement ? log.parentNode.className : "(detached)";
}

describe("로그 슬롯은 한 곳에서 정해진다", () => {
  it("도크별 기본 뷰: 유리는 카드 본문, 사이드는 휘발 존, float 은 마운트 없음", () => {
    const panel = renderPanel();

    setDock(panel, "glass");
    expect(panel.dataset.logSlot).toBe("glass");
    expect(logParentClass(panel)).toContain("ai-glass-log");

    setDock(panel, "side");
    expect(panel.dataset.logSlot).toBe("volatile");
    expect(logParentClass(panel)).toContain("ai-rising-volatile-zone");

    setDock(panel, "float");
    expect(panel.dataset.logSlot).toBe("none");
    expect(findByTestId(panel, "ai-chat-log")).toBeNull();
  });

  it("기록을 열면 도크와 무관하게 기록 마운트로 간다", () => {
    const panel = renderPanel();
    const history = findByTestId(panel, "ai-dock-toggle");
    if (!history) throw new Error("history toggle missing");

    for (const dock of ["glass", "side", "float"]) {
      setDock(panel, dock);
      history.click();
      expect(panel.dataset.logSlot, dock).toBe("history");
      expect(logParentClass(panel), dock).toContain("ai-history-log-mount");
      history.click();
      // 닫으면 그 도크의 기본 슬롯으로 되돌아온다 — 예전에는 닫는 쪽이 항상 휘발 존에
      // 넣고 뒤이어 도크 정책이 다시 옮기는 이중 이동이었다.
      expect(panel.dataset.logSlot, dock).toBe(dock === "glass" ? "glass" : dock === "side" ? "volatile" : "none");
    }
  });

  it("스튜디오도 기록 마운트를 쓰고, 끄면 도크 기본으로 돌아온다", () => {
    const panel = renderPanel();
    setDock(panel, "side");
    const studio = findByTestId(panel, "ai-studio-toggle");
    if (!studio) throw new Error("studio toggle missing");

    studio.click();
    expect(panel.dataset.logSlot).toBe("history");
    expect(logParentClass(panel)).toContain("ai-history-log-mount");

    studio.click();
    expect(panel.dataset.logSlot).toBe("volatile");
    expect(logParentClass(panel)).toContain("ai-rising-volatile-zone");
  });

  it("오버레이는 사이드 도크만 가진다", () => {
    const panel = renderPanel();

    setDock(panel, "side");
    expect(findByTestId(panel, "ai-rising-overlay")).toBeTruthy();

    setDock(panel, "float");
    expect(findByTestId(panel, "ai-rising-overlay")).toBeNull();

    setDock(panel, "glass");
    expect(findByTestId(panel, "ai-rising-overlay")).toBeNull();
  });
});
