import { listSaveSlots, type SaveSlotIndex, type SaveSlotReadResult } from "@/player/saveSlots";
import { applySystemGraphic, applyTitleGraphic } from "@/player/systemGraphics";
import { el } from "@/util/dom";

type PlayerLoadPanelOptions = {
  readonly fromTitle: boolean;
  readonly message?: string;
  readonly onBack: () => void;
  readonly onLoadSlot: (slot: SaveSlotIndex) => void;
};

export function renderPlayerLoadPanel(options: PlayerLoadPanelOptions): HTMLElement {
  const panel = el("div", {
    class: "title-screen system-panel",
    dataset: { testid: "title-screen" },
  });
  applyTitleGraphic(panel);
  applySystemGraphic(panel);
  panel.append(el("h2", { text: "불러오기" }));
  if (options.message) panel.append(renderSlotMessage(options.message));
  for (const slot of listSaveSlots(window.localStorage)) {
    if (slot.kind === "corrupt") panel.append(renderCorruptSlot(slot));
    panel.append(renderSlotButton(slot, `${slot.slot}번 저장`, `save-slot-${slot.slot}`, () => options.onLoadSlot(slot.slot)));
  }
  panel.append(el("button", {
    class: "system-shell-button",
    text: options.fromTitle ? "뒤로" : "닫기",
    on: { click: options.onBack },
  }));
  return panel;
}

function renderSlotMessage(message: string): HTMLElement {
  return el("div", {
    class: "system-shell-message",
    text: message,
    attrs: { role: "status" },
  });
}

function renderCorruptSlot(slot: Extract<SaveSlotReadResult, { readonly kind: "corrupt" }>): HTMLElement {
  return el("div", {
    class: "system-shell-corrupt",
    text: `${slot.slot}번 저장 칸 손상: ${slot.message}`,
    dataset: { testid: `save-slot-corrupt-${slot.slot}` },
  });
}

function renderSlotButton(
  slot: SaveSlotReadResult,
  label: string,
  testId: string,
  onClick: () => void
): HTMLButtonElement {
  const text = slot.kind === "present"
    ? `${label}: ${slot.snapshot.projectTitle}`
    : slot.kind === "corrupt"
      ? `${label}: 손상됨`
      : `${label}: 비어 있음`;
  const button = el("button", {
    class: "system-shell-button",
    text,
    dataset: { testid: testId },
    on: { click: onClick },
  });
  if (slot.kind === "corrupt") button.classList.add("is-corrupt");
  return button;
}
