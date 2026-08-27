// 맵 선택 위 미니바. 기존 영역 작업/작곡가 경로만 채운다.

import { editorState, type TileSelection } from "@/editor/editorState";
import { el } from "@/util/dom";

export const AI_FILL_COMPOSER_EVENT = "rpgzzu:ai-fill-composer";

export function requestFillComposer(instruction: string): void {
  if (typeof window === "undefined" || typeof window.dispatchEvent !== "function") return;
  const detail = { instruction };
  let event: Event;
  if (typeof CustomEvent === "function") {
    event = new CustomEvent(AI_FILL_COMPOSER_EVENT, { detail });
  } else {
    event = new Event(AI_FILL_COMPOSER_EVENT);
    Object.defineProperty(event, "detail", { configurable: true, value: detail });
  }
  window.dispatchEvent(event);
}

export const SELECTION_MINIBAR_ACTIONS = [
  {
    id: "decorate",
    label: "꾸미기",
    instruction: "선택한 영역을 나무와 풀, 꽃, 자연스러운 길이 어울리도록 꾸며줘.",
  },
  {
    id: "path",
    label: "길",
    instruction: "선택한 영역에 자연스러운 오솔길을 깔아줘.",
  },
  {
    id: "clear",
    label: "비우기",
    instruction: "선택한 영역의 장식과 방해물을 치워 빈 칸으로 만들어줘.",
  },
] as const;

export function selectionMinibarLabel(selection: TileSelection): string {
  return `선택 ${selection.width}×${selection.height}`;
}

export function renderSelectionMinibar(options: {
  readonly selection: TileSelection;
  readonly onPick: (instruction: string) => void;
}): HTMLElement {
  return el("div", {
    class: "selection-minibar",
    dataset: { testid: "selection-minibar" },
    children: [
      el("span", {
        class: "selection-minibar-label",
        text: selectionMinibarLabel(options.selection),
      }),
      ...SELECTION_MINIBAR_ACTIONS.map((action) =>
        el("button", {
          class: "selection-minibar-btn",
          text: action.label,
          attrs: { type: "button" },
          dataset: { testid: `selection-minibar-${action.id}` },
          on: { click: () => options.onPick(action.instruction) },
        }),
      ),
    ],
  });
}

export function installSelectionMinibar(
  host: HTMLElement,
  onPick: (instruction: string) => void,
): () => void {
  const mount = el("div", { class: "selection-minibar-host" });
  host.append(mount);
  const refresh = (): void => {
    const selection = editorState.get().selection;
    if (!selection) {
      mount.replaceChildren();
      mount.hidden = true;
      return;
    }
    mount.hidden = false;
    mount.replaceChildren(renderSelectionMinibar({ selection, onPick }));
  };
  refresh();
  const unsub = editorState.subscribe(refresh);
  return () => {
    unsub();
    mount.remove();
  };
}
