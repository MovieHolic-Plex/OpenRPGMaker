import { listSaveSlots, type SaveSlotIndex, type SaveSlotReadResult } from "@/player/saveSlots";
import { applyTitleScreenBackground } from "@/player/systemGraphics";
import { defaultTitleScreenSettings } from "@/project/defaults/defaultDatabase";
import { store } from "@/project/store";
import { el } from "@/util/dom";

type PlayerLoadPanelOptions = {
  readonly fromTitle: boolean;
  readonly message?: string;
  readonly onBack: () => void;
  readonly onLoadSlot: (slot: SaveSlotIndex) => void;
};

type SlotButtonOptions = {
  readonly slot: SaveSlotReadResult;
  readonly label: string;
  readonly testId: string;
  readonly onClick: () => void;
};

export function renderPlayerLoadPanel(options: PlayerLoadPanelOptions): HTMLElement {
  const panel = el("div", {
    class: "title-screen rm-title-screen rm2k3-load-panel system-panel",
    dataset: { testid: "title-screen", screen: "load" },
  });
  applyLoadPanelBackground(panel);

  const loadWindow = el("section", {
    class: "rm2k3-load-window",
    attrs: { "aria-label": "불러오기" },
    dataset: { testid: "player-load-window" },
  });
  loadWindow.append(el("h2", { class: "rm2k3-load-title", text: "불러오기" }));
  if (options.message) loadWindow.append(renderSlotMessage(options.message));

  const slots = el("div", {
    class: "rm2k3-load-slots",
    dataset: { testid: "player-load-slots" },
  });
  for (const slot of listSaveSlots(window.localStorage)) {
    if (slot.kind === "corrupt") slots.append(renderCorruptSlot(slot));
    slots.append(renderSlotButton({
      slot,
      label: `${slot.slot}번 저장`,
      testId: `save-slot-${slot.slot}`,
      onClick: () => options.onLoadSlot(slot.slot),
    }));
  }

  loadWindow.append(
    slots,
    el("button", {
      class: "rm2k3-load-back system-shell-button",
      text: options.fromTitle ? "뒤로" : "닫기",
      dataset: { testid: "player-load-back" },
      on: { click: options.onBack },
    }),
  );
  panel.append(loadWindow);
  return panel;
}

function renderSlotMessage(message: string): HTMLElement {
  return el("div", {
    class: "rm2k3-load-message",
    text: message,
    attrs: { role: "status" },
  });
}

function renderCorruptSlot(slot: Extract<SaveSlotReadResult, { readonly kind: "corrupt" }>): HTMLElement {
  return el("div", {
    class: "rm2k3-load-corrupt",
    text: `${slot.slot}번 저장 칸 이상: ${slot.message}`,
    dataset: { testid: `save-slot-corrupt-${slot.slot}` },
  });
}

function renderSlotButton(options: SlotButtonOptions): HTMLButtonElement {
  return el("button", {
    class: `rm2k3-load-slot system-shell-button ${slotStateClass(options.slot)}`,
    text: slotButtonText(options.slot, options.label),
    dataset: { testid: options.testId },
    on: { click: options.onClick },
  });
}

function slotButtonText(slot: SaveSlotReadResult, label: string): string {
  switch (slot.kind) {
    case "present":
      return `${label}: ${saveSlotStatus(slot)}`;
    case "corrupt":
      return `${label}: 이상함`;
    case "empty":
      return `${label}: 비어 있음`;
    default:
      return assertNever(slot);
  }
}

function saveSlotStatus(slot: Extract<SaveSlotReadResult, { readonly kind: "present" }>): string {
  const parts = [slot.snapshot.projectTitle];
  if (slot.snapshot.mapName) parts.push(slot.snapshot.mapName);
  if (typeof slot.snapshot.playTimeSeconds === "number") parts.push(formatPlayTime(slot.snapshot.playTimeSeconds));
  return parts.join(" / ");
}

function formatPlayTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

function slotStateClass(slot: SaveSlotReadResult): string {
  switch (slot.kind) {
    case "present":
      return "is-present";
    case "corrupt":
      return "is-corrupt";
    case "empty":
      return "is-empty";
    default:
      return assertNever(slot);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled save slot result: ${JSON.stringify(value)}`);
}

function applyLoadPanelBackground(panel: HTMLElement): void {
  const project = store.getCurrent();
  const settings = project.system.titleScreen ?? defaultTitleScreenSettings();
  applyTitleScreenBackground(panel, settings.backgroundResourceId ?? project.system.titleResourceId);
}
