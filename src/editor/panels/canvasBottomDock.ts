// editor/panels/canvasBottomDock.ts
// 캔버스 좌하단 「빠른 배치 독」: [오브젝트 O | NPC·이벤트 U].
// 상단 바(지형·바닥·상위·이벤트)는 레이어/모드 전환을 담당하고,
// 좌하단 독은 완성 개체(스탬프·상호작용 프롭·NPC/이벤트)를 플로팅 창으로 바로 꺼내 까는 역할만 맡는다.

import { editorState } from "@/editor/editorState";
import { mountFloatingDoodadWindow, type FloatingDoodadWindowMount } from "@/editor/panels/floatingDoodadWindow";
import { mountFloatingUnitWindow, type FloatingUnitWindowMount } from "@/editor/panels/floatingUnitWindow";
import { selectSidebarLayer } from "@/editor/panels/leftLayerSwitcher";
import { el } from "@/util/dom";

export function mountCanvasBottomDock(canvasArea: HTMLElement): () => void {
  let unitWin: FloatingUnitWindowMount | null = null;
  let doodadWin: FloatingDoodadWindowMount | null = null;

  const makeDockButton = (id: string, label: string, hotkey: string, title: string, onClick: () => void): HTMLButtonElement =>
    el("button", {
      class: "cbd-btn",
      attrs: { type: "button", title, "aria-pressed": "false" },
      dataset: { testid: `canvas-dock-${id}` },
      children: [
        el("span", { text: label }),
        el("kbd", { class: "cbd-btn-kbd", text: hotkey }),
      ],
      on: { click: onClick },
    }) as HTMLButtonElement;

  const doodadBtn = makeDockButton("doodad", "오브젝트", "O", "플로팅 오브젝트 팔레트 열기/닫기 (O / D)", () => {
    unitWin?.setOpen(false);
    doodadWin?.toggle();
    sync();
  });

  const unitBtn = makeDockButton("unit", "NPC·이벤트", "U", "NPC·이벤트 빠른 목록 열기/닫기 (U)", () => {
    doodadWin?.setOpen(false);
    const opening = !(unitWin?.isOpen() ?? false);
    if (opening) selectSidebarLayer("event");
    unitWin?.toggle();
    sync();
  });

  const dock = el("nav", {
    class: "canvas-bottom-dock",
    attrs: { "aria-label": "빠른 배치 독" },
    dataset: { testid: "canvas-bottom-dock" },
    children: [
      el("div", {
        class: "cbd-bar",
        children: [doodadBtn, unitBtn],
      }),
    ],
  });

  unitWin = mountFloatingUnitWindow(canvasArea, (isOpen) => {
    if (isOpen) doodadWin?.setOpen(false);
    sync();
  });

  doodadWin = mountFloatingDoodadWindow(canvasArea, (isOpen) => {
    if (isOpen) unitWin?.setOpen(false);
    sync();
  });

  function sync(): void {
    const state = editorState.get();
    const unitOpen = unitWin?.isOpen() ?? false;
    const doodadOpen = doodadWin?.isOpen() ?? false;

    const stampArmed = !unitOpen && state.layer !== "event" && (Boolean(state.activePaletteStamp) || Boolean(state.reliefDoodad));
    doodadBtn.classList.toggle("is-active", doodadOpen || stampArmed);
    doodadBtn.setAttribute("aria-pressed", String(doodadOpen));
    unitBtn.classList.toggle("is-active", unitOpen);
    unitBtn.setAttribute("aria-pressed", String(unitOpen));
  }

  const unsubEditor = editorState.subscribe(() => sync());

  canvasArea.append(dock);
  sync();

  return () => {
    unsubEditor();
    unitWin?.dispose();
    unitWin = null;
    doodadWin?.dispose();
    doodadWin = null;
    dock.remove();
  };
}
