// 로그 마운트 단일 출처 회귀 스펙.
//
// 고정하는 것: 같은 `log` 엘리먼트의 배치를 결정하는 코드가 세 함수(도크 정책·기록 열기·
// 스튜디오)에 흩어져 있어, 상태 조합마다 어느 마운트에 붙는지 코드로 알 수 없었다. 이제
// `mountLog()` 하나가 정하고 결과를 `panel.dataset.logSlot` 으로 노출한다.
//
// 2026-08-31: 도크가 float 하나가 되면서 슬롯 표가 (도크 3 × 기록/스튜디오 2) 에서
// **둘**로 줄었다 — 기록/스튜디오가 열려 있으면 `history`, 아니면 `glass`.
// 사이드 도크 전용이던 `volatile` 슬롯과 `.ai-rising-overlay` 는 함께 삭제됐다.
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
  });
});

afterEach(() => {
  restoreDom?.();
  restoreDom = null;
  Reflect.deleteProperty(globalThis, "localStorage");
});

function renderPanel(): FakeElement {
  const panel = renderWithFakeDom(() => renderAiChatPanel());
  // 부팅 접힘 상태에서는 뷰 정책이 돌지 않는다 — 펼쳐서 잰다.
  findByTestId(panel, "ai-collapsed-restore")?.click();
  return panel;
}

function logParentClass(panel: FakeElement): string {
  const log = findByTestId(panel, "ai-chat-log");
  if (!log) return "(unmounted)";
  return log.parentNode instanceof FakeElement ? log.parentNode.className : "(detached)";
}

describe("로그 슬롯은 한 곳에서 정해진다", () => {
  it("기본 뷰는 유리 로그 마운트 하나다", () => {
    const panel = renderPanel();
    expect(panel.dataset.chatDock).toBe("float");
    expect(panel.dataset.logSlot).toBe("glass");
    expect(findByTestId(panel, "ai-chat-log")).toBeTruthy();
    expect(logParentClass(panel)).toContain("ai-glass-log");
  });

  it("기록을 열면 기록 마운트로 가고, 닫으면 기본 슬롯으로 돌아온다", () => {
    const panel = renderPanel();
    const history = findByTestId(panel, "ai-dock-toggle");
    if (!history) throw new Error("history toggle missing");

    history.click();
    expect(panel.dataset.logSlot).toBe("history");
    expect(logParentClass(panel)).toContain("ai-history-log-mount");

    history.click();
    // 예전에는 닫는 쪽이 항상 휘발 존에 넣고 뒤이어 도크 정책이 다시 옮기는 이중 이동이었다.
    expect(panel.dataset.logSlot).toBe("glass");
    expect(logParentClass(panel)).toContain("ai-glass-log");
  });

  it("스튜디오도 기록 마운트를 쓰고, 끄면 기본으로 돌아온다", () => {
    const panel = renderPanel();
    const studio = findByTestId(panel, "ai-studio-toggle");
    if (!studio) throw new Error("studio toggle missing");

    studio.click();
    expect(panel.dataset.logSlot).toBe("history");
    expect(logParentClass(panel)).toContain("ai-history-log-mount");

    studio.click();
    expect(panel.dataset.logSlot).toBe("glass");
    expect(logParentClass(panel)).toContain("ai-glass-log");
  });

  it("사이드 도크 전용 오버레이·휘발 존은 어느 상태에서도 없다", () => {
    const panel = renderPanel();
    expect(findByTestId(panel, "ai-rising-overlay")).toBeNull();
    expect(findByTestId(panel, "ai-rising-volatile-zone")).toBeNull();

    findByTestId(panel, "ai-dock-toggle")?.click();
    expect(findByTestId(panel, "ai-rising-overlay")).toBeNull();
    expect(findByTestId(panel, "ai-rising-volatile-zone")).toBeNull();
  });

  it("완료 스트립과 0건 알림 호스트는 남고 승인 UI는 없다", () => {
    const panel = renderPanel();
    expect(findByTestId(panel, "ai-rising-sticky-zone")).toBeTruthy();
    expect(findByTestId(panel, "ai-completion-host")).toBeTruthy();
    for (const dead of [
      "ai-proposal-reopen",
      "ai-proposal-pin-host",
      "ai-proposal-host",
      "ai-proposal-modal",
      "ai-proposal-card",
    ]) {
      expect(findByTestId(panel, dead), dead).toBeNull();
    }
  });
});
