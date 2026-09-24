// 선택 영역 액션 바 — 우클릭 드래그를 놓은 자리에 뜨는 컴포저.
// 한 줄짜리 AI 지시 입력(자라남)이 주인공이고, 복사·붙여넣기·지우기·다듬기 등은 그 안의 아이콘이다.
// EditScene의 buildPalette 오버레이 슬롯을 공유 — 건축 팔레트가 켜져 있으면 그쪽이 우선.
import { requestAiSelectionContext } from "@/editor/aiSelectionContext";
import { saveSelectionAsStructureKit } from "@/editor/harnessSuggestion/structureKitActions";
import type { TileSelection } from "@/editor/editorState";
import { editorState } from "@/editor/editorState";
import { canEditMap, mapEditLockNotice } from "@/editor/mapEditLocks";
import { resolveRegionClientRect } from "@/editor/regionClientRect";
import { toast } from "@/util/toast";
import {
  cancelPastePreview,
  clearSelection,
  clearSelectionRegion,
  copySelection,
  enterPastePreview,
} from "@/editor/mapClipboard";
import { openRegionTaskModal, type RegionTaskModalOptions } from "@/editor/panels/regionTaskModal";
import { POLISH_INSTRUCTION } from "@/editor/regionTask/suggestedCommands";
import type { RegionTaskMode } from "@/editor/regionTask/runRegionTask";
import { el } from "@/util/dom";
import { openWalkEncounterForSelection } from "@/editor/panels/walkEncounterModal";
import { buildSvgIcon, makeSvgIcon, type SvgNodeSpec } from "@/editor/panels/tileToolbarIcons";
import { installDelayedTooltips } from "@/editor/delayedTooltipRollout";

/** 이 칸 수를 넘는 「지우기」는 두 번 눌러야 실행된다. 3×4 이하는 즉시 실행(기존 동작). */
export const CLEAR_CONFIRM_CELLS = 12;

/** 입력창이 자라는 상한(줄). 넘으면 입력창 안에서 스크롤한다. */
const PROMPT_MAX_LINES = 6;

/** 우클릭/선택 드래그로 잡은 영역의 칩 바만 띄운다. Ctrl+V 고스트·확정 뒤에는 숨긴다. */
export function shouldShowSelectionActionChips(state: {
  readonly selection: TileSelection | null;
  readonly pastePreview: { readonly x: number; readonly y: number } | null;
  readonly mapId: string | null;
}): boolean {
  if (state.pastePreview) return false;
  if (!state.selection || !state.mapId) return false;
  return state.selection.mapId === state.mapId;
}

export interface SelectionChipPreset {
  readonly id: string;
  readonly label: string;
  readonly title: string;
  /** null이면 지시 입력을 위해 모달만 연다(autoRun 없음). */
  readonly instruction: string | null;
  /** "polish" 면 다듬기(주변 어울림 재구성) 경로로 실행한다. */
  readonly mode?: RegionTaskMode;
}

// 구조물/길 같은 "무엇을 만들지" 단축 칩은 여기 두지 않는다 — 그건 지시문 선택이라 모달 안
// 추천 칩의 일이다. 다만 **다듬기는 지시문을 고를 것이 없다**(대상=이 사각형, 목표=주변 어울림).
// 모달을 열어 문장을 확인하고 실행 버튼을 누르는 왕복이 순손실이라 원탭으로 캔버스에 둔다.
export const SELECTION_CHIP_PRESETS: readonly SelectionChipPreset[] = [
  { id: "ai", label: "AI", title: "이 영역에 AI 지시 실행 (Enter)", instruction: null },
  {
    id: "polish",
    label: "다듬기",
    title: "다듬기 — 주변과 어울리게 AI가 다시 짜기 (타일·이벤트 전권)",
    instruction: POLISH_INSTRUCTION,
    mode: "polish",
  },
] as const;

export function selectionChipModalOptions(
  preset: SelectionChipPreset,
  selection: TileSelection,
  anchor?: { readonly x: number; readonly y: number },
): RegionTaskModalOptions {
  const region = { x: selection.x, y: selection.y, width: selection.width, height: selection.height };
  // 창이 자기가 바꿀 영역을 덮지 않도록 대상의 화면 사각형을 넘긴다. 이 계산은 Phaser
  // 카메라를 읽어야 해서 EditScene 이 등록소에 꽂아 둔다 — 등록이 없으면(테스트·헤드리스)
  // null 이고 창은 anchor 배치로 폴백한다.
  const avoid = anchor ? resolveRegionClientRect(region) : null;
  return {
    mapId: selection.mapId,
    region,
    ...(preset.instruction !== null ? { initialInstruction: preset.instruction, autoRun: true } : {}),
    ...(preset.mode ? { mode: preset.mode } : {}),
    ...(anchor ? { anchor } : {}),
    ...(avoid ? { avoid } : {}),
  };
}

const ICON_COPY: readonly SvgNodeSpec[] = [
  { tag: "rect", attrs: { x: "7.5", y: "7.5", width: "11", height: "11", rx: "2" } },
  { tag: "path", attrs: { d: "M14.5 7.5V5a1.5 1.5 0 0 0-1.5-1.5H5A1.5 1.5 0 0 0 3.5 5v8A1.5 1.5 0 0 0 5 14.5h2.5" } },
];
const ICON_PASTE: readonly SvgNodeSpec[] = [
  { tag: "path", attrs: { d: "M8 4.5H6A1.5 1.5 0 0 0 4.5 6v12A1.5 1.5 0 0 0 6 19.5h10a1.5 1.5 0 0 0 1.5-1.5V6A1.5 1.5 0 0 0 16 4.5h-2" } },
  { tag: "rect", attrs: { x: "8", y: "2.5", width: "6", height: "4", rx: "1" } },
  { tag: "path", attrs: { d: "M8 11h6M8 14.5h4" } },
];
const ICON_TRASH: readonly SvgNodeSpec[] = [
  { tag: "path", attrs: { d: "M4 6h14" } },
  { tag: "path", attrs: { d: "M8.5 6V4.5A1 1 0 0 1 9.5 3.5h3a1 1 0 0 1 1 1V6" } },
  { tag: "path", attrs: { d: "M5.5 6l.9 11.6A1.5 1.5 0 0 0 7.9 19h6.2a1.5 1.5 0 0 0 1.5-1.4L16.5 6" } },
  { tag: "path", attrs: { d: "M9.5 10v5M12.5 10v5" } },
];
const ICON_SEND: readonly SvgNodeSpec[] = [
  { tag: "path", attrs: { d: "M11 17.5V5" } },
  { tag: "path", attrs: { d: "M5.5 10.5L11 5l5.5 5.5" } },
];

function makeAiSparkIcon(): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.classList.add("selection-action-spark");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute(
    "d",
    "M12 2.5l1.35 5.15L18.5 9 13.35 10.35 12 15.5l-1.35-5.15L5.5 9l5.15-1.35L12 2.5zm6.2 9.3l.75 2.85 2.85.75-2.85.75-.75 2.85-.75-2.85-2.85-.75 2.85-.75.75-2.85zM5.8 14.8l.55 2.1 2.1.55-2.1.55-.55 2.1-.55-2.1-2.1-.55 2.1-.55.55-2.1z",
  );
  path.setAttribute("fill", "currentColor");
  svg.append(path);
  return svg;
}

function iconButton(input: {
  readonly testid: string;
  readonly title: string;
  readonly icon: SVGSVGElement;
  readonly className?: string;
  readonly onClick?: (event: Event) => void;
}): HTMLButtonElement {
  return el("button", {
    class: "selection-action-chip is-icon" + (input.className ? ` ${input.className}` : ""),
    attrs: { type: "button", title: input.title, "aria-label": input.title },
    dataset: { testid: `selection-chip-${input.testid}` },
    children: [input.icon],
    ...(input.onClick ? { on: { click: input.onClick } } : {}),
  }) as HTMLButtonElement;
}

function anchorFromEvent(event: Event | undefined): { x: number; y: number } | undefined {
  const mouse = event as MouseEvent | undefined;
  if (!mouse || typeof mouse.clientX !== "number") return undefined;
  if (mouse.clientX === 0 && mouse.clientY === 0) return undefined;
  return { x: mouse.clientX, y: mouse.clientY };
}

function autosizePrompt(prompt: HTMLTextAreaElement): void {
  const style = prompt.style;
  if (!style) return;
  // CSS 와 맞물린 수치: border-box · 줄 높이 20px · 위아래 패딩 5px.
  const lineHeight = 20;
  const padding = 10;
  const min = lineHeight + padding;
  const max = lineHeight * PROMPT_MAX_LINES + padding;
  style.height = "auto";
  const content = prompt.scrollHeight || min;
  style.height = `${Math.min(max, Math.max(min, content))}px`;
  style.overflowY = content > max ? "auto" : "hidden";
}

/** 입력창이 새로 뜬 바에서 포커스를 받는다. EditScene 이 바를 붙이고 자리를 잡은 뒤 부른다. */
export function focusSelectionActionPrompt(bar: HTMLElement): void {
  const prompt = bar.querySelector?.(".selection-action-prompt") as HTMLTextAreaElement | null | undefined;
  if (!prompt || typeof prompt.focus !== "function") return;
  prompt.focus({ preventScroll: true });
}

export function renderSelectionActionChips(
  selection: TileSelection,
  openModal: typeof openRegionTaskModal = openRegionTaskModal,
  onPastePreviewCancel: () => void = () => undefined,
): HTMLElement {
  const hasClipboard = editorState.get().clipboard !== null;
  const bar = el("div", {
    class: "selection-action-chips",
    attrs: { role: "toolbar", "aria-label": "선택 영역 작업" },
    dataset: { testid: "selection-action-chips" },
  });

  const prompt = el("textarea", {
    class: "selection-action-prompt",
    attrs: {
      rows: "1",
      placeholder: "이 영역에 AI 지시…",
      "aria-label": "이 영역에 내릴 AI 지시",
      spellcheck: "false",
    },
    dataset: { testid: "selection-chip-prompt" },
  }) as HTMLTextAreaElement;

  const runPreset = (preset: SelectionChipPreset, event?: Event): void => {
    // 잠긴 맵은 AI 가 쓸 수 없다. 창을 여는 주체가 이 바라서 검사도 여기서 한다.
    if (!canEditMap(selection.mapId)) {
      toast(mapEditLockNotice(selection.mapId), "error");
      return;
    }
    requestAiSelectionContext(selection, false);
    openModal(selectionChipModalOptions(preset, selection, anchorFromEvent(event) ?? promptAnchor()));
  };

  const promptAnchor = (): { x: number; y: number } | undefined => {
    const rect = bar.getBoundingClientRect?.();
    if (!rect || !(rect.width > 0)) return undefined;
    return { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) };
  };

  const aiPreset = SELECTION_CHIP_PRESETS.find((preset) => preset.id === "ai")!;
  const submitPrompt = (event?: Event): void => {
    const text = prompt.value.trim();
    // 빈 입력으로 실행하면 지시를 고를 수 있는 전체 창을 연다(추천 칩·이전 지시).
    runPreset(text ? { ...aiPreset, instruction: text } : aiPreset, event);
  };

  const send = iconButton({
    testid: "ai",
    title: aiPreset.title,
    icon: buildSvgIcon(ICON_SEND),
    className: "is-primary selection-action-send",
    onClick: (event) => submitPrompt(event),
  });

  const syncSendState = (): void => {
    const empty = prompt.value.trim().length === 0;
    send.classList?.toggle?.("is-empty", empty);
    send.setAttribute("title", empty ? "AI 작업 창 열기" : aiPreset.title);
  };

  const copyButton = iconButton({
    testid: "copy",
    title: "복사 (Ctrl+C)",
    icon: buildSvgIcon(ICON_COPY),
    onClick: () => { copySelection(selection.mapId); },
  });

  const pasteButton = hasClipboard
    ? iconButton({
        testid: "paste",
        title: "붙여넣기 (Ctrl+V)",
        icon: buildSvgIcon(ICON_PASTE),
        onClick: () => { enterPastePreview(selection.mapId, selection.x, selection.y); },
      })
    : null;

  // 지우기 — 넓은 영역은 한 번 더 물어본다. 되돌리기가 있어도 48칸이 한 번의 오클릭으로
  // 사라지면 무엇이 사라졌는지 알아보기 어렵고, 바로 옆이 「복사」라 오클릭 거리가 짧다.
  const clearCells = Math.max(0, selection.width) * Math.max(0, selection.height);
  const clearButton = iconButton({
    testid: "clear",
    title: "지우기 (Del)",
    icon: buildSvgIcon(ICON_TRASH),
    className: "is-danger",
  });
  let clearArmed = false;
  let clearArmTimer: ReturnType<typeof setTimeout> | null = null;
  const disarmClear = (): void => {
    clearArmed = false;
    if (clearArmTimer !== null) clearTimeout(clearArmTimer);
    clearArmTimer = null;
    clearButton.textContent = "";
    clearButton.append(buildSvgIcon(ICON_TRASH));
    clearButton.classList?.remove?.("is-armed");
  };
  clearButton.addEventListener("click", () => {
    if (clearCells <= CLEAR_CONFIRM_CELLS || clearArmed) {
      disarmClear();
      clearSelectionRegion(selection.mapId);
      return;
    }
    clearArmed = true;
    clearButton.textContent = `${clearCells}칸 지울까요?`;
    clearButton.classList?.add?.("is-armed");
    // 확인 상태로 방치되면 스스로 풀린다 — 다음 클릭이 뜻하지 않게 지우기가 되지 않게.
    clearArmTimer = setTimeout(disarmClear, 4000);
  });

  const polishPreset = SELECTION_CHIP_PRESETS.find((preset) => preset.id === "polish")!;
  const polishButton = iconButton({
    testid: "polish",
    title: polishPreset.title,
    icon: makeSvgIcon("polish"),
    onClick: (event) => runPreset(polishPreset, event),
  });

  const encounterButton = iconButton({
    testid: "walk-encounter",
    title: "걸을 때 적 만나기",
    icon: makeSvgIcon("combat"),
    onClick: () => openWalkEncounterForSelection(selection),
  });

  const structureButton = iconButton({
    testid: "save-structure",
    title: "구조물로 저장 — 이 맵 타일셋의 구조물 킷으로",
    icon: makeSvgIcon("structure"),
    onClick: () => { saveSelectionAsStructureKit(selection); },
  });

  const dismiss = (): void => {
    cancelPastePreview();
    clearSelection();
    onPastePreviewCancel();
  };
  const dismissButton = iconButton({
    testid: "dismiss",
    title: "선택 해제 (Esc)",
    icon: makeSvgIcon("close"),
    className: "selection-action-chip-dismiss",
    onClick: dismiss,
  });

  prompt.addEventListener("input", () => {
    autosizePrompt(prompt);
    syncSendState();
  });
  prompt.addEventListener("keydown", (raw) => {
    const event = raw as KeyboardEvent;
    // 한글 조합 중 Enter 는 글자 확정이다 — 실행으로 받으면 마지막 글자가 잘린다.
    if (event.isComposing || event.keyCode === 229) return;
    const empty = prompt.value.length === 0;
    const mod = event.ctrlKey || event.metaKey;
    if (event.key === "Enter" && !event.shiftKey && !mod && !event.altKey) {
      event.preventDefault();
      submitPrompt();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      if (!empty) {
        prompt.value = "";
        autosizePrompt(prompt);
        syncSendState();
        return;
      }
      dismiss();
      return;
    }
    // 입력창이 포커스를 가져가도 비어 있는 동안은 캔버스 단축키가 그대로 통한다 —
    // 영역을 잡자마자 Ctrl+C·Del 을 누르던 손버릇이 조용히 먹히지 않게.
    if (!empty) return;
    const key = event.key.toLowerCase();
    if (mod && !event.altKey && key === "c") {
      event.preventDefault();
      copyButton.click();
    } else if (mod && !event.altKey && key === "v" && pasteButton) {
      event.preventDefault();
      pasteButton.click();
    } else if (event.key === "Delete") {
      event.preventDefault();
      clearButton.click();
    }
  });

  const tools = el("div", {
    class: "selection-action-tools",
    children: [
      polishButton,
      copyButton,
      ...(pasteButton ? [pasteButton] : []),
      clearButton,
      encounterButton,
      structureButton,
      el("span", { class: "selection-action-sep", attrs: { "aria-hidden": "true" } }),
      dismissButton,
    ],
  });

  // send 를 DOM 에서 입력창 바로 뒤에 둔다 — Tab 이 입력 → 실행 순서로 흐르고, 바의 첫 버튼이
  // AI 실행이라는 기존 계약(region-task-redesign e2e)도 유지된다. 화면 배치는 CSS order.
  bar.append(makeAiSparkIcon(), prompt, send, tools);
  syncSendState();
  installDelayedTooltips(bar);

  // 바깥을 누르면 입력창 포커스를 돌려준다 — 그래야 캔버스 단축키(Ctrl+Z 등)가 다시 통한다.
  if (typeof document !== "undefined" && typeof document.addEventListener === "function") {
    const releaseFocus = (event: Event): void => {
      if (!bar.isConnected) {
        document.removeEventListener("pointerdown", releaseFocus, true);
        return;
      }
      const target = event.target as Node | null;
      if (target && typeof bar.contains === "function" && bar.contains(target)) return;
      if (document.activeElement === prompt) prompt.blur();
    };
    document.addEventListener("pointerdown", releaseFocus, true);
  }

  return bar;
}
