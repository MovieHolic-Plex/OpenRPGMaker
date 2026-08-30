// 선택 영역 액션 칩 — 캔버스 우하단 반투명 플로팅 바.
// 복사/붙여넣기/지우기/AI 작업/선택 해제를 한 곳에서 제공한다.
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
import { el } from "@/util/dom";

/** 이 칸 수를 넘는 「지우기」는 두 번 눌러야 실행된다. 3×4 이하는 즉시 실행(기존 동작). */
export const CLEAR_CONFIRM_CELLS = 12;

export interface SelectionChipPreset {
  readonly id: string;
  readonly label: string;
  readonly title: string;
  /** null이면 지시 입력을 위해 모달만 연다(autoRun 없음). */
  readonly instruction: string | null;
}

// 영역 모달(suggestedCommands)과 중복되는 구조물/길/다듬기 단축 칩은 두지 않는다.
// 캔버스 칩은 모달 진입 1개만 — 세부 추천은 모달 안에서 보여준다.
export const SELECTION_CHIP_PRESETS: readonly SelectionChipPreset[] = [
  { id: "ai", label: "AI", title: "이 영역에 자연어 지시로 AI 작업", instruction: null },
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
    ...(anchor ? { anchor } : {}),
    ...(avoid ? { avoid } : {}),
  };
}

function makeAiSparkIcon(): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "20");
  svg.setAttribute("height", "20");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.classList.add("selection-action-chip-icon");
  // 4점 스파클 — 글자 없이 AI 힌트만 전달
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute(
    "d",
    "M12 2.5l1.35 5.15L18.5 9 13.35 10.35 12 15.5l-1.35-5.15L5.5 9l5.15-1.35L12 2.5zm6.2 9.3l.75 2.85 2.85.75-2.85.75-.75 2.85-.75-2.85-2.85-.75 2.85-.75.75-2.85zM5.8 14.8l.55 2.1 2.1.55-2.1.55-.55 2.1-.55-2.1-2.1-.55 2.1-.55.55-2.1z",
  );
  path.setAttribute("fill", "currentColor");
  svg.append(path);
  return svg;
}

export function renderSelectionActionChips(
  selection: TileSelection,
  openModal: typeof openRegionTaskModal = openRegionTaskModal,
): HTMLElement {
  const hasClipboard = editorState.get().clipboard !== null;
  const bar = el("div", {
    class: "selection-action-chips",
    attrs: { role: "toolbar", "aria-label": "선택 영역 작업" },
    dataset: { testid: "selection-action-chips" },
  });

  // AI 칩이 이 바의 첫 버튼이자 주 버튼이다 — 우클릭 드래그로 영역을 잡는 가장 흔한
  // 목적이고, 나머지(복사·지우기)는 그 다음이다. 예전에는 맨 끝에 있었고 그 앞자리를
  // `8×6` 정적 텍스트가 차지해 버튼 줄 안에서 버튼처럼 읽혔다.
  // 크기 표시는 캔버스의 선택 사각형 위 배지(region-size-badge)로 옮겼다 — 원래 붙어야 할
  // 자리이고, 드래그 중에도 보인다.
  for (const preset of SELECTION_CHIP_PRESETS) {
    const isAi = preset.id === "ai";
    bar.append(
      // AI 칩에 아이콘만 두면 무엇을 하는 버튼인지 눈으로 알 수 없어(title 은 마우스를
      // 올려야 나온다) 스파클 + 글자 라벨을 함께 둔다.
      el("button", {
        class: "selection-action-chip" + (isAi ? " is-primary" : ""),
        attrs: {
          type: "button",
          title: preset.title,
          "aria-label": preset.title,
        },
        dataset: { testid: `selection-chip-${preset.id}` },
        children: isAi
          ? [makeAiSparkIcon(), el("span", { class: "selection-action-chip-text", text: "AI 작업" })]
          : undefined,
        text: isAi ? undefined : preset.label,
        on: {
          click: (event) => {
            // 잠긴 맵은 AI 가 쓸 수 없다. 예전에는 EditScene 이 창을 열기 직전에 봤는데,
            // 창을 여는 주체가 이 칩으로 옮겨졌으므로 검사도 함께 옮긴다.
            if (!canEditMap(selection.mapId)) {
              toast(mapEditLockNotice(selection.mapId), "error");
              return;
            }
            requestAiSelectionContext(selection, false);
            const mouse = event as MouseEvent;
            const anchor =
              typeof mouse.clientX === "number" && (mouse.clientX !== 0 || mouse.clientY !== 0)
                ? { x: mouse.clientX, y: mouse.clientY }
                : undefined;
            openModal(selectionChipModalOptions(preset, selection, anchor));
          },
        },
      }),
    );
  }

  // 복사
  bar.append(
    el("button", {
      class: "selection-action-chip",
      text: "복사",
      attrs: { type: "button", title: "영역 복사 (Ctrl+C)" },
      dataset: { testid: "selection-chip-copy" },
      on: { click: () => { copySelection(selection.mapId); } },
    }),
  );

  // 붙여넣기 (클립보드 있을 때만)
  if (hasClipboard) {
    bar.append(
      el("button", {
        class: "selection-action-chip",
        text: "붙여넣기",
        attrs: { type: "button", title: "클립보드를 커서 위치에 붙여넣기 (Ctrl+V)" },
        dataset: { testid: "selection-chip-paste" },
        on: {
          click: () => {
            enterPastePreview(selection.mapId, selection.x, selection.y);
          },
        },
      }),
    );
  }

  // 지우기 — 넓은 영역은 한 번 더 물어본다. 되돌리기가 있어도 48칸이 한 번의 오클릭으로
  // 사라지면 무엇이 사라졌는지 알아보기 어렵고, 바로 옆이 「복사」라 오클릭 거리가 짧다.
  const clearCells = Math.max(0, selection.width) * Math.max(0, selection.height);
  const clearButton = el("button", {
    class: "selection-action-chip",
    text: "지우기",
    attrs: { type: "button", title: "선택 영역을 빈 칸으로 (Del)" },
    dataset: { testid: "selection-chip-clear" },
  }) as HTMLButtonElement;
  let clearArmed = false;
  let clearArmTimer: ReturnType<typeof setTimeout> | null = null;
  const disarmClear = (): void => {
    clearArmed = false;
    if (clearArmTimer !== null) clearTimeout(clearArmTimer);
    clearArmTimer = null;
    clearButton.textContent = "지우기";
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
  bar.append(clearButton);

  // 구조물로 저장 — 고른 구획을 이 맵의 타일셋 킷으로 학습시킨다(팔레트 스탬프·AI 시공 공용).
  bar.append(
    el("button", {
      class: "selection-action-chip",
      text: "구조물로 저장",
      attrs: { type: "button", title: "선택 영역을 이 맵 타일셋의 구조물 킷으로 저장" },
      dataset: { testid: "selection-chip-save-structure" },
      on: { click: () => { saveSelectionAsStructureKit(selection); } },
    }),
  );

  // 선택 해제
  bar.append(
    el("button", {
      class: "selection-action-chip selection-action-chip-dismiss",
      text: "✕",
      attrs: { type: "button", title: "선택 해제 (Esc)" },
      dataset: { testid: "selection-chip-dismiss" },
      on: { click: () => { cancelPastePreview(); clearSelection(); } },
    }),
  );

  return bar;
}
