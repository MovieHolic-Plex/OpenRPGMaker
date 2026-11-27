import { isEmeraldMonsterStyle } from "@/project/emeraldMonsterStyle";
import { monsterSaveSummaryLine } from "@/project/monsterSaveSummary";
import {
  listSaveSlots,
  readAutosave,
  safeLocalStorage,
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
import { appendCloudOtherSaves, cloudStatusLine } from "./cloudOtherSaves";
import { formatControlHints, type InputDeviceKind } from "@/player/inputGlyphs";
import { runtimeUiLocale, runtimeUiText } from "@/player/runtimeUiStrings";
import type { Project } from "@/project/types";

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
  readonly project?: Project;
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
  /** 몬스터 수집 게임: 「주인공 · 도감 12/60 · 배지 2/8 · 파티 3」. */
  readonly monster?: string;
  /** 오토세이브 카드 전용: 저장을 일으킨 트리거 표기("맵 이동"/"전투 승리"). */
  readonly trigger?: string;
  /** 미연시 세이브 카드: 저장 시점의 마지막 대사 한 줄. */
  readonly scene?: string;
};

export function renderPlayerLoadPanel(options: PlayerLoadPanelOptions): HTMLElement {
  const panel = el("div", {
    class: "title-screen rm-title-screen oprn-load-panel system-panel",
    dataset: { testid: "title-screen", screen: "load" },
  });
  applyLoadPanelBackground(panel);
  if (isEmeraldMonsterStyle(store.getCurrent())) panel.dataset.monsterStyle = "emerald";

  const project = store.getCurrent();
  const loadTitle = runtimeUiText(project, "load.title");
  const loadWindow = el("section", {
    class: "oprn-load-window",
    attrs: { "aria-label": loadTitle },
    dataset: { testid: "player-load-window", playInputOwner: "title-controls" },
  });
  loadWindow.append(el("h2", { class: "oprn-load-title", text: loadTitle }));
  if (options.message) loadWindow.append(renderSlotMessage(options.message));
  const cloudLine = cloudStatusLine();
  if (cloudLine) loadWindow.append(cloudLine);

  const slots = el("div", {
    class: "oprn-load-slots",
    dataset: { testid: "player-load-slots" },
  });
  // 오토세이브 카드: 최상단, 불러오기 전용(수동 저장 메뉴의 덮어쓰기 대상이 아니다).
  const storage = safeLocalStorage();
  const autosave = storage ? readAutosave(storage) : { kind: "empty" as const };
  if (autosave.kind === "present" && options.onLoadAutosave
    && snapshotLoadBlocker(project, autosave.snapshot) === null) {
    slots.append(renderAutosaveButton(autosave.snapshot, options.onLoadAutosave, project));
  }
  const slotList: readonly SaveSlotReadResult[] = storage
    ? listSaveSlots(storage)
    : ([1, 2, 3] as const).map((slot) => ({ kind: "empty", slot }));
  for (const slot of slotList) {
    if (slot.kind === "corrupt") slots.append(renderCorruptSlot(slot));
    // 이어질 수 없는 슬롯은 골라지기 전에 이유가 보여야 한다 — 누를 수 있지만
    // player.loadSlot 이 같은 사유로 다시 막는다.
    const blocker = slot.kind === "present" ? snapshotLoadBlocker(project, slot.snapshot) : null;
    if (blocker) slots.append(renderIncompatibleSlot(slot.slot, blocker));
    slots.append(renderSlotButton({
      slot,
      testId: `save-slot-${slot.slot}`,
      project,
      onClick: () => options.onLoadSlot(slot.slot),
    }));
  }

  loadWindow.append(
    slots,
    el("div", {
      class: "oprn-load-message",
      text: loadPanelControlsHint(options.fromTitle, undefined, project),
      dataset: { testid: "player-load-controls", fromTitle: options.fromTitle ? "true" : "false" },
    }),
    el("button", {
      class: "oprn-load-back system-shell-button",
      text: options.fromTitle ? runtimeUiText(project, "load.cancel") : runtimeUiText(project, "credits.close"),
      dataset: { testid: "player-load-back" },
      on: { click: options.onBack },
    }),
  );
  panel.append(loadWindow);
  if (storage) appendPredecessorSaveImports(slots, { project: store.getCurrent(), storage, onLoadSlot: options.onLoadSlot });
  appendCloudOtherSaves(slots, { onLoadSlot: options.onLoadSlot, ...(options.onLoadAutosave ? { onLoadAutosave: options.onLoadAutosave } : {}) });
  if (storage) appendSaveFileTransfers(slots, { project: store.getCurrent(), storage, onLoadSlot: options.onLoadSlot });
  return panel;
}

export function loadPanelControlsHint(fromTitle: boolean, device?: InputDeviceKind, project?: Project): string {
  const loc = runtimeUiLocale(project ?? store.getCurrent());
  const moveLabel = loc === "en" ? "Move" : loc === "ja" ? "移動" : loc === "zh" ? "移动" : "이동";
  const loadLabel = loc === "en" ? "Load" : loc === "ja" ? "ロード" : loc === "zh" ? "读取" : "불러오기";
  const backLabel = fromTitle
    ? (loc === "en" ? "Back" : loc === "ja" ? "戻る" : loc === "zh" ? "返回" : "뒤로")
    : (loc === "en" ? "Close" : loc === "ja" ? "閉じる" : loc === "zh" ? "关闭" : "닫기");
  return formatControlHints(
    [
      { action: "scroll", label: moveLabel },
      { action: "confirm", label: loadLabel },
      { action: "cancel", label: backLabel },
    ],
    device,
    " · ",
  );
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
    saveSlotCardModel(options.slot, options.project),
    `oprn-load-slot system-shell-button ${slotStateClass(options.slot)}`,
    options.testId,
    options.onClick,
  );
}

// 오토세이브 카드 — 수동 슬롯과 같은 카드 구조 + is-autosave 상태 클래스 + 트리거 표기.
function renderAutosaveButton(snapshot: SaveSnapshot, onClick: () => void, project?: Project): HTMLButtonElement {
  return renderCardButton(
    autosaveCardModel(snapshot, project),
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
  if (model.monster) {
    button.append(el("span", { class: "oprn-load-slot-row oprn-load-slot-monster", text: model.monster, dataset: { testid: `${testId}-monster` } }));
  }
  if (model.scene) {
    button.append(el("span", { class: "oprn-load-slot-row oprn-load-slot-scene", text: `“${model.scene}”`, dataset: { testid: `${testId}-scene` } }));
  }
  return button;
}

// 오토세이브 스냅샷 → 카드 뷰모델(순수 함수). 제목은 "자동 저장", 트리거를 함께 표기한다.
export function autosaveCardModel(snapshot: SaveSnapshot, project?: Project): SaveSlotCardModel {
  const nonKo = project ? runtimeUiLocale(project) !== "ko" : false;
  return {
    title: nonKo ? runtimeUiText(project, "load.autosave") : "자동 저장",
    mapName: snapshot.mapName || snapshot.projectTitle || undefined,
    ...(snapshot.chapterLabel ? { chapter: snapshot.chapterLabel } : {}),
    level: typeof snapshot.partyLevel === "number" ? `Lv ${snapshot.partyLevel}` : undefined,
    playTime: typeof snapshot.playTimeSeconds === "number" ? formatPlayTime(snapshot.playTimeSeconds) : undefined,
    savedAt: formatSavedAt(snapshot.savedAt) || undefined,
    ...monsterCardPart(snapshot),
    ...(snapshot.sceneLine ? { scene: snapshot.sceneLine } : {}),
    trigger: autosaveTriggerLabel(snapshot.autosaveTrigger, project),
  };
}

// 트리거 표기. 구 스냅샷(트리거 없음)은 표기 자체를 생략한다.
export function autosaveTriggerLabel(trigger: AutosaveTrigger | undefined, project?: Project): string | undefined {
  const loc = project ? runtimeUiLocale(project) : "ko";
  switch (trigger) {
    case "transfer":
      return loc === "en" ? "Map Transfer" : loc === "ja" ? "マップ移動" : loc === "zh" ? "地图切换" : "맵 이동";
    case "battleVictory":
      return loc === "en" ? "Battle Victory" : loc === "ja" ? "戦闘勝利" : loc === "zh" ? "战斗胜利" : "전투 승리";
    default:
      return undefined;
  }
}

// 슬롯 읽기 결과 → 카드 뷰모델. DOM/스토리지/현재 시각에 의존하지 않는 순수 함수.
export function saveSlotCardModel(slot: SaveSlotReadResult, project?: Project): SaveSlotCardModel {
  const nonKo = project ? runtimeUiLocale(project) !== "ko" : false;
  const title = nonKo ? runtimeUiText(project, "load.slotLabel", slot.slot) : `${slot.slot}번 저장`;
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
        ...monsterCardPart(snapshot),
        ...(snapshot.sceneLine ? { scene: snapshot.sceneLine } : {}),
      };
    }
    case "corrupt":
      return { title: `${title}: ${nonKo ? runtimeUiText(project, "load.corrupt") : "이상함"}` };
    case "empty":
      return { title: `${title}: ${nonKo ? runtimeUiText(project, "load.empty") : "비어 있음"}` };
    default:
      return assertNever(slot);
  }
}

function monsterCardPart(snapshot: SaveSnapshot): { readonly monster?: string } {
  const summary = snapshot.monsterSummary;
  return summary ? { monster: [summary.trainer, monsterSaveSummaryLine(summary)].filter(Boolean).join(" · ") } : {};
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
