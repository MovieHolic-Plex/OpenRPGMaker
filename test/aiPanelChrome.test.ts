import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { editorState } from "@/editor/editorState";
import { getMapEditHistoryState, recordProjectSnapshot, resetMapEditHistory } from "@/editor/mapEditHistory";
import { openAiAssistantPanel } from "@/editor/aiAssistantBridge";
import {
  formatComposerPlaceholder,
  readAgentBrief,
} from "@/editor/panels/aiAgentBrief";
import { renderAiChatPanel } from "@/editor/panels/aiChatPanel";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { FakeElement, findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";

let restoreDom: (() => void) | null = null;
let storage: Map<string, string>;

function installFakeLocalStorage(): void {
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
}

beforeEach(() => {
  store.replace(createBlankProject());
  resetMapEditHistory();
  restoreDom = installFakeDom();
  installFakeLocalStorage();
  const mapId = store.getCurrent().startMapId;
  editorState.set({
    currentMapId: mapId,
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

// 도크 선택 인자는 없다 — 조수는 입력줄(float) 하나에만 산다.
function renderPanel(): FakeElement {
  return renderWithFakeDom(() => renderAiChatPanel());
}

const TAB_ORDER_TAGS = new Set(["BUTTON", "TEXTAREA", "INPUT"]);
const IDLE_FLOAT_TAB_STOPS = [
  "ai-command-menu-toggle",
  "ai-input",
  "ai-send",
] as const;

function collectTabOrderableControls(root: FakeElement): FakeElement[] {
  const stops: FakeElement[] = [];
  const walk = (node: FakeElement): void => {
    if (node.inert) return;
    if (TAB_ORDER_TAGS.has(node.tagName) && !node.disabled) {
      const rawTabIndex = node.getAttribute("tabindex");
      if (rawTabIndex === null || Number(rawTabIndex) >= 0) stops.push(node);
    }
    for (const child of node.childNodes) {
      if (child instanceof FakeElement) walk(child);
    }
  };
  walk(root);
  return stops;
}

/** 접힌 채 부팅한 경우 복귀 버튼으로 펼침 (이미 펼쳐져 있으면 no-op). */
function expandPanel(panel: FakeElement): void {
  if (!panel.classList.contains("is-collapsed")) return;
  findByTestId(panel, "ai-collapsed-restore")?.click();
  expect(panel.classList.contains("is-collapsed")).toBe(false);
}

// 도크 축 삭제(float 단일) — glass 본문 접힘(fold), glass/side 전용 `ai-next-steps` 카드,
// 사이드 전용 `ai-rising-overlay` 는 전부 사라졌다. 해당 케이스는 지우지 않고 「그 표면이
// 돌아오지 않는다」는 반대 계약으로 뒤집었고, 도크별 `it.each` 는 단일 케이스로 합쳤다.
describe("AI 패널 크롬", () => {
  function historyAction(panel: FakeElement): FakeElement {
    const menu = findByTestId(panel, "ai-command-menu");
    const action = menu?.childNodes.find((node): node is FakeElement =>
      node instanceof FakeElement && node.querySelector(".ai-command-menu-label")?.textContent === "전체 기록");
    if (!action) throw new Error("history menu action missing");
    return action;
  }

  it("F2 collapsing history returns to the collapsed float surface", () => {
    const panel = renderPanel();
    historyAction(panel).click();
    expect(panel.classList.contains("is-history-open")).toBe(true);
    findByTestId(panel, "ai-collapse")?.click();
    expect(panel.classList.contains("is-collapsed")).toBe(true);
    expect(panel.classList.contains("is-history-open")).toBe(false);
    expect(panel.classList.contains("is-docked")).toBe(false);
  });

  it("F3 entering studio clears the full-history surface", () => {
    const panel = renderPanel();
    historyAction(panel).click();
    findByTestId(panel, "ai-studio-toggle")?.click();
    expect(panel.classList.contains("is-studio")).toBe(true);
    expect(panel.classList.contains("is-history-open")).toBe(false);
  });

  it("F4 the visible history menu action toggles open and closed", () => {
    const panel = renderPanel();
    const action = historyAction(panel);
    action.click();
    expect(panel.classList.contains("is-history-open")).toBe(true);
    action.click();
    expect(panel.classList.contains("is-history-open")).toBe(false);
  });

  it("패널에 헤더도 얼굴도 없다", () => {
    // Break: `.ai-chat-header` 밴드나 `.ai-director-*` 명패가 되살아났다.
    // 2026-08-28 감독 지시 — 조수의 얼굴을 노출하지 않고 헤더 없는 유리면 하나로 간다.
    const panel = renderPanel();
    expandPanel(panel);

    expect(panel.querySelector(".ai-chat-header")).toBeNull();
    expect(findByTestId(panel, "ai-director-plate")).toBeNull();
    expect(findByTestId(panel, "ai-director-face")).toBeNull();
    expect(findByTestId(panel, "ai-director-line")).toBeNull();
    expect(panel.querySelector(".ai-director-name")).toBeNull();
    expect(panel.querySelector(".ai-header-actions")).toBeNull();
    // 얼굴 리소스가 어떤 경로로도 다시 그려지지 않는지 — 클래스 자체로 확인한다.
    expect(panel.querySelector(".ai-director-face")).toBeNull();
  });

  it("데크 하나가 레일·기록·컴포저를 담고, 레일이 진입점 아이콘과 상태 글자를 든다", () => {
    // Break: 데크 래퍼가 없어 기록 카드와 입력줄이 다시 형제로 뜨거나, 레일 슬롯에 버튼이 비거나,
    // 상태 글자(ai-status)가 컴포저 행에 남는다.
    const panel = renderPanel();
    expandPanel(panel);

    const deck = findByTestId(panel, "ai-deck");
    const rail = findByTestId(panel, "ai-deck-rail");
    const body = findByTestId(panel, "ai-chat-body");
    const bar = findByTestId(panel, "ai-command-bar");
    expect(deck && rail && body && bar).toBeTruthy();
    expect(deck?.contains(rail!)).toBe(true);
    expect(deck?.contains(body!)).toBe(true);
    expect(deck?.contains(bar!)).toBe(true);
    for (const testid of ["ai-context-meter", "ai-new-chat", "ai-open-conversations", "ai-preference-toggle", "ai-command-menu-toggle", "ai-collapse", "ai-status"]) {
      expect(rail?.contains(findByTestId(panel, testid)!), testid).toBe(true);
    }
    // 상태는 세 표면이 같은 값을 든다.
    expect(panel.dataset.aiState).toBe("idle");
    expect(rail?.dataset.aiState).toBe("idle");
    expect(findByTestId(panel, "ai-collapsed-restore")?.dataset.aiState).toBe("idle");
    // ⋯ 메뉴는 레일에 붙는다(닫힘 = hidden).
    const menu = findByTestId(panel, "ai-command-menu");
    expect(rail?.contains(menu!)).toBe(true);
    expect(menu?.hidden).toBe(true);
  });

  it("존재 줄 문구는 여전히 계산되지만 화면에 심지 않는다", () => {
    // 헤더가 사라졌다고 aiAgentBrief 계약까지 죽은 것은 아니다 — 컴포저 플레이스홀더와
    // 시작 화면 힌트가 같은 브리프를 쓴다. 순수 함수 계약만 남기고 DOM 단언은 걷었다.
    const panel = renderPanel();
    expandPanel(panel);

    expect(readAgentBrief().line).toBe("빈 맵 20×15 · 바닥 · 칠하기");
    expect(findByTestId(panel, "ai-director-line")).toBeNull();

    editorState.set({ layer: "upper", tool: "fill" });

    expect(readAgentBrief().line).toBe("빈 맵 20×15 · 상위 · 채우기");
  });

  it("첫 방문(저장값 없음)은 펼친 채 부팅한다", () => {
    // Break: loadPanelCollapsed() still returns true when the key is missing.
    const panel = renderPanel();
    expect(panel.classList.contains("is-collapsed")).toBe(false);
    expect(storage.has("oprn:ai-panel-collapsed")).toBe(false);
  });

  it("부팅 시 저장된 접힘 선택('1')을 복원한다", () => {
    storage.set("oprn:ai-panel-collapsed", "1");
    const panel = renderPanel();
    expect(panel.classList.contains("is-collapsed")).toBe(true);
  });

  it("공개 AI 진입점은 접힌 패널을 펼치고 입력창에 포커스한다", () => {
    storage.set("oprn:ai-panel-collapsed", "1");
    const panel = renderPanel();
    const input = findByTestId(panel, "ai-input");

    expect(panel.classList.contains("is-collapsed")).toBe(true);
    expect(openAiAssistantPanel()).toBe(true);
    expect(panel.classList.contains("is-collapsed")).toBe(false);
    expect(document.activeElement).toBe(input);
    expect(storage.get("oprn:ai-panel-collapsed")).toBe("0");
  });

  // 도크별 분기는 없다 — 셰브론이 여닫는 축은 패널 전체 칩 접힘 하나뿐이다.
  it("컴포저 접기 버튼과 restore가 aria/persistence를 왕복한다", () => {
    const panel = renderPanel();
    const collapse = findByTestId(panel, "ai-collapse");
    const actions = findByTestId(panel, "ai-composer-actions");
    const toolbar = findByTestId(panel, "ai-chat-toolbar");
    const restore = findByTestId(panel, "ai-collapsed-restore");
    if (!collapse || !actions || !toolbar || !restore) throw new Error("collapse fixtures missing");

    // 데크(2026-09-03): 접기는 컴포저 행이 아니라 상태 레일에 산다.
    const rail = findByTestId(panel, "ai-deck-rail");
    expect(rail?.contains(collapse)).toBe(true);
    expect(actions.contains(collapse)).toBe(false);
    expect(toolbar.contains(collapse)).toBe(false);
    expect(collapse.getAttribute("type")).toBe("button");
    expect(collapse.getAttribute("aria-label")).toBe("AI 패널 접기");
    expect(collapse.getAttribute("aria-expanded")).toBe("true");
    expect(restore.getAttribute("aria-label")).toBe("조수");
    expect(restore.getAttribute("aria-expanded")).toBe("true");

    collapse.click();
    expect(panel.classList.contains("is-collapsed")).toBe(true);
    expect(collapse.getAttribute("aria-label")).toBe("AI 패널 펼치기");
    expect(collapse.getAttribute("aria-expanded")).toBe("false");
    expect(restore.getAttribute("aria-expanded")).toBe("false");
    expect(storage.get("oprn:ai-panel-collapsed")).toBe("1");

    restore.click();
    expect(panel.classList.contains("is-collapsed")).toBe(false);
    expect(collapse.getAttribute("aria-label")).toBe("AI 패널 접기");
    expect(collapse.getAttribute("aria-expanded")).toBe("true");
    expect(restore.getAttribute("aria-expanded")).toBe("true");
    expect(storage.get("oprn:ai-panel-collapsed")).toBe("0");
  });

  it("접기 버튼은 본문 접힘(fold) 축을 되살리지 않는다 — 칩 접힘만, 저장값을 쓴다", () => {
    // Break: 셰브론이 다시 두 축(칩 접힘 / 유리 본문 접힘)을 나눠 가지면서 조수 어휘 라벨을
    // 쓰거나, fold 처럼 `oprn:ai-panel-collapsed` 를 안 쓰고 넘어간다.
    const panel = renderPanel();
    const collapse = findByTestId(panel, "ai-collapse");
    if (!collapse) throw new Error("collapse fixtures missing");

    expect(panel.classList.contains("is-glass-folded")).toBe(false);
    expect(panel.classList.contains("is-glass-idle")).toBe(false);
    expect(panel.classList.contains("is-map-first-idle")).toBe(false);
    expect(collapse.getAttribute("aria-label")).toBe("AI 패널 접기");

    collapse.click();
    expect(panel.classList.contains("is-collapsed")).toBe(true);
    expect(panel.classList.contains("is-glass-folded")).toBe(false);
    expect(collapse.getAttribute("aria-label")).toBe("AI 패널 펼치기");
    // fold 는 저장을 건너뛰었다 — 칩 접힘은 사용자의 선택이라 반드시 남는다.
    expect(storage.get("oprn:ai-panel-collapsed")).toBe("1");

    collapse.click();
    expect(panel.classList.contains("is-collapsed")).toBe(false);
    expect(panel.classList.contains("is-glass-folded")).toBe(false);
    expect(collapse.getAttribute("aria-label")).toBe("AI 패널 접기");
    expect(storage.get("oprn:ai-panel-collapsed")).toBe("0");
  });

  it("접기 버튼은 커맨드 바 인셋을 유지하고, 복귀 타깃 클릭으로 펼친다", () => {
    const panel = renderPanel();
    expandPanel(panel);
    const collapse = findByTestId(panel, "ai-collapse");
    if (!collapse) throw new Error("collapse button missing");
    expect(document.body.classList.contains("ai-command-bar-active")).toBe(true);
    expect(document.body.classList.contains("ai-panel-docked")).toBe(false);

    collapse.click();

    expect(panel.classList.contains("is-docked")).toBe(false);
    expect(panel.classList.contains("is-collapsed")).toBe(true);
    const restore = findByTestId(panel, "ai-collapsed-restore");
    expect(restore).toBeTruthy();
    expect(restore?.getAttribute("type")).toBe("button");
    expect(restore?.getAttribute("aria-label")).toBe("조수");
    expect(restore?.textContent ?? "").toContain("조수");
    expect(restore?.querySelector(".ai-collapsed-restore-name")?.textContent).toBe("조수");
    expect(restore?.textContent ?? "").not.toContain("🤖");
    expect(restore?.querySelector(".ai-collapsed-restore-float")).toBeNull();
    expect(restore?.querySelector(".ai-collapsed-restore-rail-icon")).toBeNull();
    expect(restore?.querySelector(".ai-collapsed-restore-rail-label")).toBeNull();
    expect(restore?.querySelector(".ai-director-face")).toBeNull();
    expect(document.body.classList.contains("ai-command-bar-active")).toBe(true);
    expect(document.body.classList.contains("ai-panel-docked")).toBe(false);
    expect(storage.get("oprn:ai-panel-collapsed")).toBe("1");

    restore?.click();

    expect(panel.classList.contains("is-collapsed")).toBe(false);
    expect(document.body.classList.contains("ai-command-bar-active")).toBe(true);
    expect(document.body.classList.contains("ai-panel-docked")).toBe(false);
    expect(storage.get("oprn:ai-panel-collapsed")).toBe("0");
  });

  it("떠 있는 말풍선으로 접으면 얼굴 없이 이름만 남는다", () => {
    // Break: 복귀 알약에 얼굴이 다시 붙었거나, aria-label 이 조수가 아니다.
    storage.set("oprn:ai-panel-docked", "0");
    const panel = renderPanel();
    expandPanel(panel);
    const collapse = findByTestId(panel, "ai-collapse");
    if (!collapse) throw new Error("collapse button missing");

    collapse.click();

    const restore = findByTestId(panel, "ai-collapsed-restore");
    expect(panel.classList.contains("is-docked")).toBe(false);
    expect(panel.classList.contains("is-collapsed")).toBe(true);
    expect(restore?.getAttribute("aria-label")).toBe("조수");
    expect(restore?.textContent ?? "").toContain("조수");
    expect(restore?.textContent ?? "").not.toContain("🤖");
    expect(restore?.querySelector(".ai-collapsed-restore-float")).toBeNull();
    expect(restore?.querySelector(".ai-director-face")).toBeNull();
    expect(restore?.querySelector(".ai-collapsed-restore-name")?.textContent).toBe("조수");
  });

  it("스튜디오에서 접어도 화면 안 복귀 타깃이 남는다", () => {
    const panel = renderPanel();
    expandPanel(panel);
    const studio = findByTestId(panel, "ai-studio-toggle");
    const collapse = findByTestId(panel, "ai-collapse");
    if (!studio || !collapse) throw new Error("studio or collapse button missing");

    studio.click();
    collapse.click();

    const restore = findByTestId(panel, "ai-collapsed-restore");
    expect(panel.classList.contains("is-studio")).toBe(false);
    expect(panel.classList.contains("is-collapsed")).toBe(true);
    expect(restore).toBeTruthy();
  });

  it.each(["idle", "focus", "new-chat"])("%s does not mount assistant preset promotions", (path) => {
    const panel = renderPanel();
    expandPanel(panel);
    const input = findByTestId(panel, "ai-input");
    expect(input).not.toBeNull();
    if (path === "focus") input?.focus();
    if (path === "new-chat") {
      const newChat = findByTestId(panel, "ai-new-chat");
      expect(newChat).not.toBeNull();
      newChat?.click();
    }
    expect(panel.querySelectorAll(".ai-suggest-row")).toHaveLength(0);
    expect(panel.querySelectorAll(".ai-composer-chip")).toHaveLength(0);
    expect(findByTestId(panel, "ai-authoring-examples")).toBeNull();
    expect(findByTestId(panel, "ai-start-visual-gallery")).toBeNull();
    expect(input?.getAttribute("placeholder")).toBe(formatComposerPlaceholder());
  });

  it("복귀 타깃으로 펼치면 저장값이 0이 된다", () => {
    storage.set("oprn:ai-panel-collapsed", "1");
    const panel = renderPanel();
    const restore = findByTestId(panel, "ai-collapsed-restore");

    expect(panel.classList.contains("is-collapsed")).toBe(true);
    expect(restore).toBeTruthy();

    restore?.click();

    expect(panel.classList.contains("is-collapsed")).toBe(false);
    expect(storage.get("oprn:ai-panel-collapsed")).toBe("0");
  });

  it("툴바에 직전 변경 되돌리기 진입점을 제공한다", () => {
    const mapId = store.getCurrent().startMapId;
    recordProjectSnapshot("테스트 편집", mapId);
    const panel = renderPanel();
    const undo = findByTestId(panel, "ai-undo-last");
    if (!undo) throw new Error("AI undo button missing");

    expect(undo.textContent).toContain("되돌리기");
    expect(undo.disabled).toBe(false);

    undo.click();

    expect(getMapEditHistoryState().canUndo).toBe(false);
  });

  it("펼친 플로트에서 숨은 툴바 버튼은 tab 순서에 없다", () => {
    const panel = renderPanel();
    expandPanel(panel);

    const stops = collectTabOrderableControls(panel);
    const stopIds = stops.map((stop) => stop.dataset.testid).filter((id): id is string => Boolean(id));

    expect(stops.some((stop) => stop.closest("[data-testid=ai-chat-toolbar]") !== null)).toBe(false);
    expect(stopIds).toEqual(expect.arrayContaining([...IDLE_FLOAT_TAB_STOPS]));
  });

  it("float dock keeps the work log mounted without the rising overlay", () => {
    const panel = renderPanel();
    expandPanel(panel);

    expect(findByTestId(panel, "ai-command-bar")).toBeTruthy();
    expect(findByTestId(panel, "ai-chat-log")).toBeTruthy();
    expect(findByTestId(panel, "ai-rising-overlay")).toBeNull();
    expect(panel.querySelector(".ai-chat-log")).toBeTruthy();
  });

  it("작업 로그는 유리 마운트 한 칸이고 도크 전환 진입점은 아예 없다", () => {
    // Break: 도크 전환이 되살아나 로그가 사이드 오버레이(`ai-rising-overlay`)로 다시 옮겨간다.
    const panel = renderPanel();
    expandPanel(panel);

    // 예전에는 `chat-dock-toggle` 을 세 번 눌러 float→side→glass 순환이 제자리에 머무는지
    // 봤다. 이제 누를 노드 자체가 없는 것이 계약이다.
    for (const dead of ["chat-dock-toggle", "ai-dock-mode-btn", "ai-chat-detach"]) {
      expect(findByTestId(panel, dead), dead).toBeNull();
    }

    const glassMount = findByTestId(panel, "ai-glass-log");
    const log = findByTestId(panel, "ai-chat-log");
    expect(glassMount?.contains(log)).toBe(true);
    expect(panel.dataset.logSlot).toBe("glass");
    expect(panel.dataset.chatDock).toBe("float");
    expect(log?.hidden).toBe(false);
    expect(findByTestId(panel, "ai-command-bar")).toBeTruthy();
    expect(findByTestId(panel, "ai-rising-overlay")).toBeNull();
    expect(findByTestId(panel, "ai-rising-volatile-zone")).toBeNull();
    // 0건 알림이 사는 고정 영역은 패널 직속으로 남는다. 완료 스트립(`ai-completion-host`)은
    // 2026-08-30 에 걷혔다 — 되돌리기는 컴포저 액션 행의 `ai-composer-undo` 가 맡는다.
    const sticky = findByTestId(panel, "ai-rising-sticky-zone");
    expect(sticky?.parentElement).toBe(panel);
    expect(findByTestId(panel, "ai-completion-host")).toBeNull();
    expect(findByTestId(panel, "ai-composer-undo")).toBeTruthy();
  });

  it("float history remounts the work log outside the rising overlay", () => {
    // Break: history-open float still keeps the log unmounted, or remounts the overlay.
    const panel = renderPanel();
    expandPanel(panel);
    const history = findByTestId(panel, "ai-dock-toggle");
    if (!history) throw new Error("history toggle missing");

    history.click();

    expect(findByTestId(panel, "ai-chat-log")).toBeTruthy();
    expect(findByTestId(panel, "ai-rising-overlay")).toBeNull();
    expect(panel.classList.contains("is-history-open")).toBe(true);
  });
});
