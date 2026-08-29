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

const TAB_ORDER_TAGS = new Set(["BUTTON", "TEXTAREA", "INPUT"]);
const IDLE_TAB_STOPS = [
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

/**
 * 띠를 자람 상태로 올린다. 유휴 56px 에서는 `.ai-chat-body` 가 숨어 본문 계약을 잴 수 없다.
 *
 * 구 헬퍼는 `expandPanel` 이었고 접힘 복귀 알약(`ai-collapsed-restore`)을 눌렀다 — 접힘 상태와
 * 그 알약은 함께 삭제됐다(스펙 §1). 지금 축은 유휴↔자람 하나이고, 입력이 그것을 켠다.
 */
function risePanel(panel: FakeElement): void {
  // 브리지 진입점(`openPanel` → `revealVolatileZone`)으로 올린다. 입력에 글자를 넣어 올리는
  // 방법도 있지만, 아래 테스트 다수가 **빈 컴포저** 계약을 재므로 내용을 남기면 안 된다.
  if (!openAiAssistantPanel()) throw new Error("assistant bridge not registered");
  if (!panel.classList.contains("is-risen")) throw new Error("panel did not rise");
}

describe("AI 패널 크롬", () => {
  it("패널에 헤더도 얼굴도 없다", () => {
    // Break: `.ai-chat-header` 밴드나 `.ai-director-*` 명패가 되살아났다.
    // 2026-08-28 감독 지시 — 조수의 얼굴을 노출하지 않고 헤더 없는 유리면 하나로 간다.
    const panel = renderPanel();
    risePanel(panel);

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
    risePanel(panel);

    expect(readAgentBrief().line).toBe("빈 맵 20×15 · 바닥 · 칠하기");
    expect(findByTestId(panel, "ai-director-line")).toBeNull();

    editorState.set({ layer: "upper", tool: "fill" });

    expect(readAgentBrief().line).toBe("빈 맵 20×15 · 덧그림 · 채우기");
  });

  // ── 삭제한 접힘·도크 테스트 6건 ──────────────────────────────────────────────
  //   첫 방문(저장값 없음)은 펼친 채 부팅한다
  //   부팅 시 저장된 접힘 선택('1')을 복원한다
  //   접기 버튼은 커맨드 바 인셋을 유지하고, 복귀 타깃 클릭으로 펼친다
  //   떠 있는 말풍선으로 접으면 얼굴 없이 이름만 남는다
  //   스튜디오에서 접어도 화면 안 복귀 타깃이 남는다
  //   복귀 타깃으로 펼치면 저장값이 0이 된다
  //
  // 접힘은 상태가 아니게 됐다. 유휴가 56px 한 줄이면 접어서 아낄 공간이 없다(스펙 §3 작성자
  // 판단) — `ai-collapse` · `ai-collapsed-restore` · `oprn:ai-panel-collapsed` · `is-collapsed` ·
  // `is-studio` · body 클래스 `ai-command-bar-active` / `ai-panel-docked` 가 함께 사라졌다.
  // 커맨드 바 인셋(`--ai-command-bar-clearance`)은 캔버스를 밀어내던 reflow 경로여서
  // 스펙 §2 가 금지한다.

  it("공개 AI 진입점은 휘발 존을 드러내고 입력창에 포커스한다", () => {
    // 접힘이 없어졌으니 이 진입점이 하는 일은 "보이게 하고 커서를 준다" 둘뿐이다.
    const panel = renderPanel();
    const input = findByTestId(panel, "ai-input");

    expect(openAiAssistantPanel()).toBe(true);
    expect(document.activeElement).toBe(input);
    expect(findByTestId(panel, "ai-rising-volatile-zone")?.hidden).toBe(false);
  });

  it("빈 부팅은 오버레이 빈 키트 없이 감독 칩만 둔다", () => {
    // Break: boot still appends ai-start-visual-gallery / ai-empty-cta, or skips ai-composer-chips.
    const panel = renderPanel();
    // 유휴 56px 에서는 초대 문구가 문서에서 빠진다 — 한 줄에 들어갈 자리가 없다(스펙 §2).
    // 자람 뒤의 노출은 바로 다음 테스트가 잰다.
    expect(findByTestId(panel, "ai-next-steps")?.hidden).toBe(true);

    risePanel(panel);
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
  });

  it("자람 직후 빈 화면은 다음 할 일을 큰 버튼으로 보여 준다", () => {
    const panel = renderPanel();
    risePanel(panel);
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
    risePanel(panel);
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

  it("컴포저 ☰ 가 직전 변경 되돌리기 진입점을 제공한다", () => {
    // 되돌리기 버튼(`ai-undo-last`)은 이제 완료 카드가 설 때만 화면에 붙는다 — 적용한 것이
    // 없는데 되돌리기를 상시 세워 둘 이유가 없다. 카드가 없는 동안의 진입점은 ☰ 항목이고,
    // 그 항목이 같은 버튼을 클릭한다(aiChatPanel `sharedMenuActions.undoLast`).
    const mapId = store.getCurrent().startMapId;
    recordProjectSnapshot("테스트 편집", mapId);
    const panel = renderPanel();

    expect(findByTestId(panel, "ai-undo-last")).toBeNull();
    findByTestId(panel, "ai-command-menu-toggle")?.click();
    const undo = findByTestId(panel, "ai-command-menu-undo");
    if (!undo) throw new Error("☰ 되돌리기 항목 없음");
    expect(undo.textContent).toContain("되돌리기");

    undo.click();

    expect(getMapEditHistoryState().canUndo).toBe(false);
  });

  it("유휴 띠의 tab 순서는 ☰·입력창·전송 셋뿐이다", () => {
    const panel = renderPanel();
    risePanel(panel);

    const stops = collectTabOrderableControls(panel);
    const stopIds = stops.map((stop) => stop.dataset.testid).filter((id): id is string => Boolean(id));

    expect(stops.some((stop) => stop.closest("[data-testid=ai-chat-toolbar]") !== null)).toBe(false);
    expect(stopIds).toEqual(expect.arrayContaining([...IDLE_TAB_STOPS]));
  });

  // ── 삭제한 도크별 로그 마운트 테스트 3건 ────────────────────────────────────
  //   float dock keeps the work log mounted without the rising overlay
  //   side dock mounts the work log, and switching back to float keeps it visible
  //   float history remounts the work log outside the rising overlay
  //
  // 슬롯이 둘(volatile · history)로 줄었고 그 계약은 aiLogSlot.test.ts 가 소유한다. 여기 셋은
  // 도크를 순환시키며 같은 것을 세 번 재고 있었다 — `ai-glass-log` 도 유리 도크와 함께 삭제됐다.
});
