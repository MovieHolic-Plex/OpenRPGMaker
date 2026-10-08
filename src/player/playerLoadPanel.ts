import {
  listSaveSlots,
  readAutosave,
  snapshotLoadBlocker,
  type AutosaveTrigger,
  type SaveSlotIndex,
  type SaveSlotReadResult,
  type SaveSnapshot,
} from "@/player/saveSlots";
import { applyTitleScreenBackground } from "@/player/systemGraphics";
import { defaultTitleScreenSettings } from "@/project/defaults/defaultDatabase";
import { store } from "@/project/store";
import { el } from "@/util/dom";
import { appendPredecessorSaveImports } from "./predecessorSaveImports";
import { appendSaveFileTransfers } from "./saveFileTransfers";

type PlayerLoadPanelOptions = {
  readonly fromTitle: boolean;
  readonly message?: string;
  readonly onBack: () => void;
  readonly onLoadSlot: (slot: SaveSlotIndex) => void;
  /** 오토세이브 카드 불러오기. 생략 시 카드는 렌더되지 않는다(레거시 호출부 호환). */
  readonly onLoadAutosave?: () => void;
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
  /** 저장 당시 장(시대) 이름. */
  readonly chapter?: string;
  readonly level?: string;
  readonly playTime?: string;
  readonly savedAt?: string;
  /** 오토세이브 카드 전용: 저장을 일으킨 트리거 표기("맵 이동"/"전투 승리"). */
  readonly trigger?: string;
};

export function renderPlayerLoadPanel(options: PlayerLoadPanelOptions): HTMLElement {
  const panel = el("div", {
    class: "title-screen rm-title-screen oprn-load-panel system-panel",
    dataset: { testid: "title-screen", screen: "load" },
  });
  applyLoadPanelBackground(panel);

  const loadWindow = el("section", {
    class: "oprn-load-window",
    attrs: { "aria-label": "불러오기" },
    dataset: { testid: "player-load-window", playInputOwner: "title-controls" },
  });
  loadWindow.append(el("h2", { class: "oprn-load-title", text: "불러오기" }));
  if (options.message) loadWindow.append(renderSlotMessage(options.message));

  const slots = el("div", {
    class: "oprn-load-slots",
    dataset: { testid: "player-load-slots" },
  });
  // 오토세이브 카드: 최상단, 불러오기 전용(수동 저장 메뉴의 덮어쓰기 대상이 아니다).
  const autosave = readAutosave(window.localStorage);
  if (autosave.kind === "present" && options.onLoadAutosave
    && snapshotLoadBlocker(store.getCurrent(), autosave.snapshot) === null) {
    slots.append(renderAutosaveButton(autosave.snapshot, options.onLoadAutosave));
  }
  for (const slot of listSaveSlots(window.localStorage)) {
    if (slot.kind === "corrupt") slots.append(renderCorruptSlot(slot));
    // 이어질 수 없는 슬롯은 골라지기 전에 이유가 보여야 한다 — 누를 수 있지만
    // player.loadSlot 이 같은 사유로 다시 막는다.
    const blocker = slot.kind === "present" ? snapshotLoadBlocker(store.getCurrent(), slot.snapshot) : null;
    if (blocker) slots.append(renderIncompatibleSlot(slot.slot, blocker));
    slots.append(renderSlotButton({
      slot,
      testId: `save-slot-${slot.slot}`,
      onClick: () => options.onLoadSlot(slot.slot),
    }));
  }

  loadWindow.append(
    slots,
    el("button", {
      class: "oprn-load-back system-shell-button",
      text: options.fromTitle ? "뒤로" : "닫기",
      dataset: { testid: "player-load-back" },
      on: { click: options.onBack },
    }),
  );
  panel.append(loadWindow);
  appendPredecessorSaveImports(slots, { project: store.getCurrent(), storage: window.localStorage, onLoadSlot: options.onLoadSlot });
  appendSaveFileTransfers(slots, { project: store.getCurrent(), storage: window.localStorage, onLoadSlot: options.onLoadSlot });
  return panel;
}

function renderSlotMessage(message: string): HTMLElement {
  return el("div", {
    class: "oprn-load-message",
    text: message,
    attrs: { role: "status" },
  });
}

function renderIncompatibleSlot(slot: SaveSlotIndex, reason: string): HTMLElement {
  return el("div", {
    class: "oprn-load-corrupt",
    text: `${slot}번 저장 칸을 이어서 할 수 없습니다: ${reason}`,
    dataset: { testid: `save-slot-incompatible-${slot}` },
  });
}

function renderCorruptSlot(slot: Extract<SaveSlotReadResult, { readonly kind: "corrupt" }>): HTMLElement {
  return el("div", {
    class: "oprn-load-corrupt",
    text: `${slot.slot}번 저장 칸 이상: ${slot.message}`,
    dataset: { testid: `save-slot-corrupt-${slot.slot}` },
  });
}

// 슬롯 버튼(BUTTON + data-testid=save-slot-N 계약 유지) 안에 카드 구조를 채운다.
// 1행: 슬롯 제목 + 맵 이름, 2행: Lv · 플레이타임 · 저장시각. 빈/손상 슬롯은 1행만.
function renderSlotButton(options: SlotButtonOptions): HTMLButtonElement {
  return renderCardButton(
    saveSlotCardModel(options.slot),
    `oprn-load-slot system-shell-button ${slotStateClass(options.slot)}`,
    options.testId,
    options.onClick,
  );
}

// 오토세이브 카드 — 수동 슬롯과 같은 카드 구조 + is-autosave 상태 클래스 + 트리거 표기.
function renderAutosaveButton(snapshot: SaveSnapshot, onClick: () => void): HTMLButtonElement {
  return renderCardButton(
    autosaveCardModel(snapshot),
    "oprn-load-slot system-shell-button is-present is-autosave",
    "save-slot-auto",
    onClick,
  );
}

function renderCardButton(
  model: SaveSlotCardModel,
  className: string,
  testId: string,
  onClick: () => void,
): HTMLButtonElement {
  const button = el("button", {
    class: className,
    dataset: { testid: testId },
    on: { click: onClick },
  });
  const head = el("span", { class: "oprn-load-slot-row oprn-load-slot-head" });
  head.append(el("span", { class: "oprn-load-slot-title", text: model.title }));
  if (model.mapName) head.append(el("span", { class: "oprn-load-slot-map", text: model.mapName }));
  if (model.chapter) head.append(el("span", { class: "oprn-load-slot-chapter", text: model.chapter, dataset: { testid: `${testId}-chapter` } }));
  button.append(head);
  const metaParts = [
    { className: "oprn-load-slot-trigger", text: model.trigger },
    { className: "oprn-load-slot-level", text: model.level },
    { className: "oprn-load-slot-playtime", text: model.playTime },
    { className: "oprn-load-slot-saved-at", text: model.savedAt },
  ].filter((part): part is { readonly className: string; readonly text: string } => Boolean(part.text));
  if (metaParts.length > 0) {
    const meta = el("span", { class: "oprn-load-slot-row oprn-load-slot-meta" });
    for (const part of metaParts) meta.append(el("span", { class: part.className, text: part.text }));
    button.append(meta);
  }
  return button;
}

// 오토세이브 스냅샷 → 카드 뷰모델(순수 함수). 제목은 "자동 저장", 트리거를 함께 표기한다.
export function autosaveCardModel(snapshot: SaveSnapshot): SaveSlotCardModel {
  return {
    title: "자동 저장",
    mapName: snapshot.mapName || snapshot.projectTitle || undefined,
    ...(snapshot.chapterLabel ? { chapter: snapshot.chapterLabel } : {}),
    level: typeof snapshot.partyLevel === "number" ? `Lv ${snapshot.partyLevel}` : undefined,
    playTime: typeof snapshot.playTimeSeconds === "number" ? formatPlayTime(snapshot.playTimeSeconds) : undefined,
    savedAt: formatSavedAt(snapshot.savedAt) || undefined,
    trigger: autosaveTriggerLabel(snapshot.autosaveTrigger),
  };
}

// 트리거 한글 표기. 구 스냅샷(트리거 없음)은 표기 자체를 생략한다.
export function autosaveTriggerLabel(trigger: AutosaveTrigger | undefined): string | undefined {
  switch (trigger) {
    case "transfer":
      return "맵 이동";
    case "battleVictory":
      return "전투 승리";
    case "ending":
      return "엔딩 완료";
    default:
      return undefined;
  }
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
        ...(snapshot.chapterLabel ? { chapter: snapshot.chapterLabel } : {}),
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
