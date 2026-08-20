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
  readonly testId: string;
  readonly onClick: () => void;
};

// 세이브 슬롯 카드 뷰모델 — 렌더와 분리된 순수 함수의 출력.
export type SaveSlotCardModel = {
  readonly title: string;
  readonly mapName?: string;
  readonly level?: string;
  readonly playTime?: string;
  readonly savedAt?: string;
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
    dataset: { testid: "player-load-window", playInputOwner: "title-controls" },
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

// 슬롯 버튼(BUTTON + data-testid=save-slot-N 계약 유지) 안에 카드 구조를 채운다.
// 1행: 슬롯 제목 + 맵 이름, 2행: Lv · 플레이타임 · 저장시각. 빈/손상 슬롯은 1행만.
function renderSlotButton(options: SlotButtonOptions): HTMLButtonElement {
  const model = saveSlotCardModel(options.slot);
  const button = el("button", {
    class: `rm2k3-load-slot system-shell-button ${slotStateClass(options.slot)}`,
    dataset: { testid: options.testId },
    on: { click: options.onClick },
  });
  const head = el("span", { class: "rm2k3-load-slot-row rm2k3-load-slot-head" });
  head.append(el("span", { class: "rm2k3-load-slot-title", text: model.title }));
  if (model.mapName) head.append(el("span", { class: "rm2k3-load-slot-map", text: model.mapName }));
  button.append(head);
  const metaParts = [
    { className: "rm2k3-load-slot-level", text: model.level },
    { className: "rm2k3-load-slot-playtime", text: model.playTime },
    { className: "rm2k3-load-slot-saved-at", text: model.savedAt },
  ].filter((part): part is { readonly className: string; readonly text: string } => Boolean(part.text));
  if (metaParts.length > 0) {
    const meta = el("span", { class: "rm2k3-load-slot-row rm2k3-load-slot-meta" });
    for (const part of metaParts) meta.append(el("span", { class: part.className, text: part.text }));
    button.append(meta);
  }
  return button;
}

// 슬롯 읽기 결과 → 카드 뷰모델. DOM/스토리지/현재 시각에 의존하지 않는 순수 함수.
export function saveSlotCardModel(slot: SaveSlotReadResult): SaveSlotCardModel {
  const title = `${slot.slot}번 저장`;
  switch (slot.kind) {
    case "present": {
      const snapshot = slot.snapshot;
      return {
        title,
        // 맵 이름이 비어 있으면 프로젝트 제목으로 대체해 1행이 허전하지 않게 한다.
        mapName: snapshot.mapName || snapshot.projectTitle || undefined,
        level: typeof snapshot.partyLevel === "number" ? `Lv ${snapshot.partyLevel}` : undefined,
        playTime: typeof snapshot.playTimeSeconds === "number" ? formatPlayTime(snapshot.playTimeSeconds) : undefined,
        savedAt: formatSavedAt(snapshot.savedAt) || undefined,
      };
    }
    case "corrupt":
      return { title: `${title}: 이상함` };
    case "empty":
      return { title: `${title}: 비어 있음` };
    default:
      return assertNever(slot);
  }
}

// ISO 저장시각 → 'YYYY.MM.DD HH:mm' 로컬 시각. 무효 ISO 는 빈 문자열.
export function formatSavedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad2 = (value: number): string => String(value).padStart(2, "0");
  return `${date.getFullYear()}.${pad2(date.getMonth() + 1)}.${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
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
