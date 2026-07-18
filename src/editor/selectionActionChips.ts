// 선택 영역 우측에 뜨는 인라인 AI 액션 칩 (스펙 §3 2-A).
// 우클릭 드래그로만 접근되던 영역 AI 작업을 좌클릭 선택에서도 발견 가능하게 노출한다.
// EditScene의 buildPalette 오버레이 슬롯을 공유 — 건축 팔레트가 켜져 있으면 그쪽이 우선.
import { requestAiSelectionContext } from "@/editor/aiSelectionContext";
import type { TileSelection } from "@/editor/editorState";
import { openRegionTaskModal, type RegionTaskModalOptions } from "@/editor/panels/regionTaskModal";
import { el } from "@/util/dom";

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
  { id: "ai", label: "✨ AI 작업…", title: "이 영역에 자연어 지시로 AI 작업", instruction: null },
] as const;

export function selectionChipModalOptions(
  preset: SelectionChipPreset,
  selection: TileSelection,
  anchor?: { readonly x: number; readonly y: number },
): RegionTaskModalOptions {
  return {
    mapId: selection.mapId,
    region: { x: selection.x, y: selection.y, width: selection.width, height: selection.height },
    ...(preset.instruction !== null ? { initialInstruction: preset.instruction, autoRun: true } : {}),
    ...(anchor ? { anchor } : {}),
  };
}

export function renderSelectionActionChips(
  selection: TileSelection,
  openModal: typeof openRegionTaskModal = openRegionTaskModal,
): HTMLElement {
  const bar = el("div", {
    class: "selection-action-chips",
    attrs: { role: "toolbar", "aria-label": "선택 영역 AI 작업" },
    dataset: { testid: "selection-action-chips" },
  });
  for (const preset of SELECTION_CHIP_PRESETS) {
    bar.append(
      el("button", {
        class: "selection-action-chip" + (preset.id === "ai" ? " is-primary" : ""),
        text: preset.label,
        attrs: { type: "button", title: preset.title },
        dataset: { testid: `selection-chip-${preset.id}` },
        on: {
          click: (event) => {
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
  return bar;
}
