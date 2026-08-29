// 로그 마운트 단일 출처 회귀 스펙.
//
// 고정하는 것: 같은 `log` 엘리먼트의 배치를 정하는 코드가 한 곳에만 있다는 것. 원래는
// 세 함수(도크 정책 · 기록 열기 · 스튜디오)가 제각기 `remove()` + `append()` 로 재부모화해서,
// 상태 조합마다 어느 마운트에 붙는지 코드로 알 수 없었다 — 기록을 닫으면 휘발 존에 넣었다가
// 바로 뒤이어 도크 정책이 유리 마운트로 다시 집어오는 이중 이동까지 있었다. 이제
// `mountLog()` 하나가 정하고 결과를 `panel.dataset.logSlot` 으로 노출한다.
//
// 조수 띠로 넘어오면서 슬롯이 3종(glass · volatile · history)에서 **2종**으로 줄었다.
// `glass` 는 유리 도크와 함께 사라졌고, 스튜디오 토글도 없어졌다. 남은 축은 기록 하나다.
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
  return renderWithFakeDom(() => renderAiChatPanel());
}

function logParentClass(panel: FakeElement): string {
  const log = findByTestId(panel, "ai-chat-log");
  if (!log) return "(unmounted)";
  return log.parentNode instanceof FakeElement ? log.parentNode.className : "(detached)";
}

function historyToggle(panel: FakeElement): FakeElement {
  const button = findByTestId(panel, "ai-chat-history");
  if (!button) throw new Error("history toggle missing");
  return button;
}

describe("로그 슬롯은 한 곳에서 정해진다", () => {
  it("기본 슬롯은 휘발 존이다", () => {
    const panel = renderPanel();

    expect(panel.dataset.logSlot).toBe("volatile");
    expect(logParentClass(panel)).toContain("ai-rising-volatile-zone");
  });

  it("기록을 열면 기록 마운트로 가고 닫으면 휘발 존으로 돌아온다", () => {
    const panel = renderPanel();
    const history = historyToggle(panel);

    history.click();
    expect(panel.dataset.logSlot).toBe("history");
    expect(logParentClass(panel)).toContain("ai-history-log-mount");

    history.click();
    // 예전에는 닫는 쪽이 항상 휘발 존에 넣고 뒤이어 도크 정책이 다시 옮기는 이중 이동이었다.
    expect(panel.dataset.logSlot).toBe("volatile");
    expect(logParentClass(panel)).toContain("ai-rising-volatile-zone");
  });

  it("여러 번 여닫아도 로그 엘리먼트는 하나뿐이다", () => {
    // 재부모화가 여러 곳에서 일어나면 복제본이 남는다 — 슬롯이 하나면 개수가 늘 1 이다.
    const panel = renderPanel();
    const history = historyToggle(panel);

    for (let i = 0; i < 3; i += 1) history.click();
    expect(panel.querySelectorAll('[data-testid="ai-chat-log"]').length).toBe(1);
    expect(panel.dataset.logSlot).toBe("history");

    history.click();
    expect(panel.querySelectorAll('[data-testid="ai-chat-log"]').length).toBe(1);
    expect(panel.dataset.logSlot).toBe("volatile");
  });

  it("오버레이와 스티키 존은 띠에 상주한다", () => {
    // 구 구현에서 오버레이는 사이드 도크 전용이었다 — 도크가 하나뿐이니 조건이 사라진다.
    const panel = renderPanel();

    expect(findByTestId(panel, "ai-rising-overlay")).toBeTruthy();
    expect(findByTestId(panel, "ai-rising-sticky-zone")).toBeTruthy();
    expect(findByTestId(panel, "ai-completion-host")).toBeTruthy();
    expect(findByTestId(panel, "ai-proposal-pin-host")).toBeTruthy();
  });

  it("제안 reopen pill 은 인라인 결정 카드로 대체돼 노출되지 않는다", () => {
    const panel = renderPanel();

    const pill = findByTestId(panel, "ai-proposal-reopen");
    const pillHidden = pill == null
      || pill.hidden === true
      || (pill as { attrs?: { hidden?: string } }).attrs?.hidden !== undefined;
    expect(pillHidden).toBe(true);
  });

  it("휘발 존은 페이드 클래스를 다시 달지 않는다", () => {
    // 페이드(is-faded, opacity .42)는 삭제됐다 — 상주하는 패널을 흐리는 것 자체가 오답이고,
    // 타이머를 둔 곳도 둘(컨트롤러 + 로컬)이었다.
    const panel = renderPanel();
    const zone = findByTestId(panel, "ai-rising-volatile-zone");

    expect(zone?.className).not.toContain("is-faded");
  });

  it("유휴에서는 휘발 존이 접히고 자라면 열린다", () => {
    // 유휴 56px 에 빈 로그 껍데기를 두면 그 높이가 그대로 공백이 된다(스펙 §2).
    const panel = renderPanel();
    const zone = findByTestId(panel, "ai-rising-volatile-zone");
    const input = findByTestId(panel, "ai-input");
    if (!zone || !input) throw new Error("zone/input missing");

    expect(panel.classList.contains("is-risen")).toBe(false);
    expect(zone.hidden).toBe(true);

    (input as unknown as { value: string }).value = "안녕";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    expect(panel.classList.contains("is-risen")).toBe(true);
    expect(zone.hidden).toBe(false);
  });

  /**
   * 스펙 §6 게이트 4 — `ai-new-session` 은 **동작** 테스트가 0건이었다.
   *
   * 이 파일이 자연스러운 집이다: ＋ 가 하는 일의 핵심이 `log.replaceChildren()` 이라 로그
   * 마운트 계약과 같은 대상을 만진다. 기존 `aiAssistantUxP0P2.test.ts` 는 aria-label 만
   * 재고 있었다 — 버튼이 있다는 것만 알려 주고, 눌러서 비워지는지는 아무도 보지 않았다.
   */
  it("＋ 새 대화는 로그를 비우고 휘발 존 슬롯으로 되돌린다", () => {
    const panel = renderPanel();
    const log = findByTestId(panel, "ai-chat-log");
    const history = historyToggle(panel);
    const newSession = findByTestId(panel, "ai-new-session");
    if (!log || !newSession) throw new Error("log/new-session missing");

    // 대화가 있는 상태를 만든다(로그에 줄이 있고, 기록 슬롯으로 옮겨 둔 상태).
    log.append(new FakeElement("div"));
    history.click();
    expect(panel.dataset.logSlot).toBe("history");
    expect(log.childNodes.length).toBe(1);

    newSession.click();

    expect(log.childNodes.length).toBe(0);
    // 로그 엘리먼트 자체는 살아 있어야 한다 — 지워 버리면 다음 턴이 붙을 자리가 없다.
    expect(findByTestId(panel, "ai-chat-log")).toBe(log);
    expect(panel.querySelectorAll('[data-testid="ai-chat-log"]').length).toBe(1);
  });
});
