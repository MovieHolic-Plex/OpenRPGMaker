import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AI_CONFIG_STORAGE_KEY, defaultAiConfig } from "@/ai/llmClient";
import { editorState } from "@/editor/editorState";
import { getMapEditHistoryState, recordProjectSnapshot, resetMapEditHistory } from "@/editor/mapEditHistory";
import { openAiAssistantPanel } from "@/editor/aiAssistantBridge";
import {
  directorStartPrompts,
  formatComposerPlaceholder,
  nextStepHint,
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
    chatDock: "float",
  });
});

afterEach(() => {
  restoreDom?.();
  restoreDom = null;
  Reflect.deleteProperty(globalThis, "localStorage");
});

function renderPanel(dock?: "glass" | "side" | "float"): FakeElement {
  return renderWithFakeDom(() => renderAiChatPanel(dock ? { getChatDock: () => dock } : {}));
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

describe("AI 패널 크롬", () => {
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

  it("존재 줄 문구는 여전히 계산되지만 화면에 심지 않는다", () => {
    // 헤더가 사라졌다고 aiAgentBrief 계약까지 죽은 것은 아니다 — 컴포저 플레이스홀더와
    // 시작 화면 힌트가 같은 브리프를 쓴다. 순수 함수 계약만 남기고 DOM 단언은 걷었다.
    const panel = renderPanel();
    expandPanel(panel);

    expect(readAgentBrief().line).toBe("빈 맵 20×15 · 바닥 · 칠하기");
    expect(findByTestId(panel, "ai-director-line")).toBeNull();

    editorState.set({ layer: "upper", tool: "fill" });

    expect(readAgentBrief().line).toBe("빈 맵 20×15 · 덧그림 · 채우기");
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

  // glass 는 빠져 있다: 거기서 이 셰브론은 칩 접힘이 아니라 본문 접힘(fold) 토글이고
  // `oprn:ai-panel-collapsed` 를 쓰지 않는다. 그 계약은 test/aiGlassFold.test.ts 가 갖는다.
  it.each(["side", "float"] as const)("%s dock의 실제 composer 접기 버튼과 restore가 aria/persistence를 왕복한다", (dock) => {
    const panel = renderPanel(dock);
    const collapse = findByTestId(panel, "ai-collapse");
    const actions = findByTestId(panel, "ai-composer-actions");
    const toolbar = findByTestId(panel, "ai-chat-toolbar");
    const restore = findByTestId(panel, "ai-collapsed-restore");
    if (!collapse || !actions || !toolbar || !restore) throw new Error("collapse fixtures missing");

    expect(actions.contains(collapse)).toBe(true);
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

  it("glass 의 접기 버튼은 칩 접힘이 아니라 본문 접힘을 토글하고 저장값을 건드리지 않는다", () => {
    const panel = renderPanel("glass");
    const collapse = findByTestId(panel, "ai-collapse");
    if (!collapse) throw new Error("collapse fixtures missing");

    // 부팅이 이미 접힌 입력줄이므로 라벨도 조수 어휘를 쓴다("AI 패널" 이 아니다).
    expect(panel.classList.contains("is-glass-folded")).toBe(true);
    expect(panel.classList.contains("is-collapsed")).toBe(false);
    expect(collapse.getAttribute("aria-label")).toBe("조수 대화 펼치기");
    expect(collapse.getAttribute("aria-expanded")).toBe("false");

    collapse.click();
    expect(panel.classList.contains("is-glass-folded")).toBe(false);
    expect(panel.classList.contains("is-collapsed")).toBe(false);
    expect(collapse.getAttribute("aria-label")).toBe("조수 대화 접기");
    expect(collapse.getAttribute("aria-expanded")).toBe("true");
    // fold 는 저장하지 않는다 — 유휴 자동 접힘이 있으면 "펼침"은 안정된 선택이 아니다.
    expect(storage.has("oprn:ai-panel-collapsed")).toBe(false);
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

  it("빈 플로트 부팅은 오버레이 빈 키트 없이 감독 칩만 둔다", () => {
    // Break: boot still appends ai-start-visual-gallery / ai-empty-cta, or skips ai-composer-chips.
    const panel = renderPanel();
    expandPanel(panel);
    const chips = findByTestId(panel, "ai-composer-chips");
    const chipButtons = chips?.querySelectorAll("button") ?? [];
    const expected = directorStartPrompts(readAgentBrief());
    const input = findByTestId(panel, "ai-input");

    expect(findByTestId(panel, "ai-start-visual-gallery")).toBeNull();
    expect(findByTestId(panel, "ai-empty-cta")).toBeNull();
    expect(chips).toBeTruthy();
    expect(chipButtons.length).toBeGreaterThanOrEqual(0);
    expect(chipButtons.length).toBeLessThanOrEqual(3);
    expect(chipButtons.length).toBe(expected.length);
    expect(input?.getAttribute("placeholder")).toBe(formatComposerPlaceholder(readAgentBrief()));
    expect(findByTestId(panel, "ai-next-steps")?.hidden).toBe(true);
  });

  it("유리·사이드 빈 화면은 다음 할 일을 큰 버튼으로 보여 준다", () => {
    editorState.set({ chatDock: "glass" });
    const panel = renderPanel();
    expandPanel(panel);
    const steps = findByTestId(panel, "ai-next-steps");
    const examples = findByTestId(panel, "ai-authoring-examples");
    const buttons = examples?.querySelectorAll(".ai-authoring-example-chip") ?? [];

    expect(steps?.hidden).toBe(false);
    expect(findByTestId(panel, "ai-next-steps-hint")?.textContent).toBe(nextStepHint(readAgentBrief()));
    expect(buttons.length).toBe(4);
    expect(examples).toBeTruthy();
  });

  it("감독 칩 클릭은 입력만 채우고 전송하지 않는다", () => {
    // Break: chip click calls sendText (user row or settings modal) instead of filling the input.
    storage.set(
      AI_CONFIG_STORAGE_KEY,
      JSON.stringify({ ...defaultAiConfig(), authMode: "apiKey", baseUrl: "https://example.invalid/v1", apiKey: "" }),
    );
    const panel = renderPanel();
    expandPanel(panel);
    const expected = directorStartPrompts(readAgentBrief());
    const first = expected[0];
    if (!first) throw new Error("directorStartPrompts returned no chips");
    const chips = findByTestId(panel, "ai-composer-chips");
    const chip = chips?.querySelectorAll("button")[0];
    const input = findByTestId(panel, "ai-input") as unknown as { value: string } | null;
    if (!chip || !input) throw new Error("composer chip or input missing");

    chip.click();

    expect(input.value).toBe(first.instruction);
    expect(document.activeElement).toBe(input);
    expect(findByTestId(panel, "ai-command-row-user")).toBeNull();
    expect(findByTestId(panel, "ai-command-row")).toBeNull();
    expect(findByTestId(panel, "ai-settings-modal")).toBeNull();
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

  it("side dock mounts the work log, and switching back to float keeps it visible", () => {
    const panel = renderPanel();
    expandPanel(panel);
    const toggle = findByTestId(panel, "chat-dock-toggle");
    if (!toggle) throw new Error("dock toggle missing");

    toggle.click();
    expect(findByTestId(panel, "ai-glass-log")).toBeTruthy();
    expect(findByTestId(panel, "ai-chat-log")).toBeTruthy();

    toggle.click();

    const sideLog = findByTestId(panel, "ai-chat-log");
    expect(sideLog).toBeTruthy();
    expect(findByTestId(panel, "ai-rising-overlay")?.contains(sideLog)).toBe(true);
    expect(findByTestId(panel, "ai-command-bar")).toBeTruthy();
    expect(sideLog?.hidden).toBe(false);
    expect(findByTestId(panel, "ai-rising-volatile-zone")?.classList.contains("is-faded")).toBe(false);
    expect(findByTestId(panel, "ai-rising-volatile-zone")?.hidden).toBe(false);

    toggle.click();

    expect(findByTestId(panel, "ai-command-bar")).toBeTruthy();
    expect(findByTestId(panel, "ai-chat-log")).toBeTruthy();
    expect(findByTestId(panel, "ai-rising-overlay")).toBeNull();
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
