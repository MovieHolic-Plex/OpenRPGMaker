// player/dialogue.ts
// DOM 대사창/선택지 오버레이. 인터프리터의 text/choices 요청을 화면에 표시.
// 사용자 입력(클릭/엔터 → 진행, 선택지 클릭 → 인덱스)을 콜백으로 전달.

import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { DEFAULT_MESSAGE_WINDOW_SETTINGS } from "@/project/session";
import { store } from "@/project/store";
import type { ChoiceCancelBehavior, FaceGraphic, MessageWindowPosition, MessageWindowSettings } from "@/project/types";
import { showNumberInput, type DialogueNumberInputRequest } from "@/player/dialogueNumberInput";
import { el, clearChildren } from "@/util/dom";

type DialogueSurfaceSettings = {
  readonly settings?: MessageWindowSettings;
  readonly playerTileY: number;
  readonly mapHeight: number;
};

export type DialogueTextRequest = DialogueSurfaceSettings & {
  readonly speaker?: string;
  readonly body: string;
  readonly face?: FaceGraphic;
};

export type DialogueChoicesRequest = DialogueSurfaceSettings & {
  readonly prompt?: string;
  readonly options: { text: string }[];
  readonly cancelBehavior?: ChoiceCancelBehavior;
};

export interface DialogueUI {
  // 대사창 표시. advance() 호출 시 resolve되는 Promise를 반환.
  showText(request: DialogueTextRequest): Promise<void>;
  // 선택지 표시. 사용자가 고른 인덱스로 resolve.
  showChoices(request: DialogueChoicesRequest): Promise<number>;
  showNumberInput(request: DialogueNumberInputRequest): Promise<number>;
  // 숨김.
  hide(): void;
}

export function createDialogueUI(host: HTMLElement): DialogueUI {
  const overlay = el("div", { class: "dialogue-overlay" });
  host.append(overlay);

  function showText(request: DialogueTextRequest): Promise<void> {
    clearChildren(overlay);
    resetOverlay(overlay);
    return new Promise<void>((resolve) => {
      const box = el("div", { class: "dialogue-box", dataset: { testid: "dialogue-box" } });
      applyTextSettings(overlay, box, request);
      const content = el("div", {
        class: `dialogue-content${request.face?.position === "right" ? " face-right" : ""}`,
      });
      if (request.face) content.append(renderFace(request.face));
      const textColumn = el("div", { class: "dialogue-text-column" });
      if (request.speaker) {
        textColumn.append(el("div", { class: "speaker", text: request.speaker }));
      }
      const bodyEl = el("div", { class: "body" });
      textColumn.append(bodyEl);
      content.append(textColumn);
      box.append(content);
      const hint = el("div", {
        class: "continue-hint",
        text: "▼ 클릭/엔터",
      });
      box.append(hint);

      // 타이핑 효과.
      let i = 0;
      let typing = true;
      const full = request.body;
      const typeStep = () => {
        if (i < full.length) {
          bodyEl.textContent = full.slice(0, i + 1);
          i++;
          timer = window.setTimeout(typeStep, 24);
        } else {
          typing = false;
        }
      };
      let timer = window.setTimeout(typeStep, 24);

      const advance = () => {
        if (typing) {
          // 타이핑 스킵 → 전문 표시.
          clearTimeout(timer);
          bodyEl.textContent = full;
          typing = false;
          return;
        }
        cleanup();
        resolve();
      };
      const onKey = (e: KeyboardEvent) => {
        if (isDialogueAdvanceKey(e.key)) {
          e.preventDefault();
          advance();
        }
      };
      const cleanup = () => {
        clearTimeout(timer);
        box.removeEventListener("click", advance);
        document.removeEventListener("keydown", onKey);
        clearChildren(overlay);
        resetOverlay(overlay);
      };
      box.addEventListener("click", advance);
      document.addEventListener("keydown", onKey);

      overlay.append(box);
    });
  }

  function showChoices(request: DialogueChoicesRequest): Promise<number> {
    return new Promise<number>((resolve) => {
      clearChildren(overlay);
      resetOverlay(overlay);
      const position = applyOverlayPosition(overlay, request);
      if (request.prompt) {
        const pbox = el("div", { class: "dialogue-box", dataset: { testid: "dialogue-box" } });
        applyTextSettings(overlay, pbox, request, position);
        pbox.append(el("div", { class: "body", text: request.prompt }));
        overlay.append(pbox);
      }

      let onKey: (event: KeyboardEvent) => void;
      const finish = (index: number): void => {
        document.removeEventListener("keydown", onKey);
        clearChildren(overlay);
        resetOverlay(overlay);
        resolve(index);
      };
      onKey = (e: KeyboardEvent) => {
        const n = parseInt(e.key, 10);
        if (!isNaN(n) && n >= 1 && n <= request.options.length) {
          e.preventDefault();
          finish(n - 1);
          return;
        }
        if (normalizedDialogueKey(e.key) === "escape") {
          const cancelIndex = cancelChoiceIndex(request.cancelBehavior, request.options.length);
          if (cancelIndex !== null) {
            e.preventDefault();
            finish(cancelIndex);
          }
        }
      };

      const choicesEl = el("div", { class: "choices", dataset: { testid: "runtime-choices" } });
      request.options.forEach((opt, idx) => {
        const btn = el("button", {
          class: "choice-btn",
          text: `▶ ${opt.text}`,
          dataset: { testid: `runtime-choice-${idx}` },
        });
        btn.addEventListener("click", () => finish(idx));
        choicesEl.append(btn);
      });

      document.addEventListener("keydown", onKey);

      overlay.append(choicesEl);
    });
  }

  function hide(): void {
    clearChildren(overlay);
    resetOverlay(overlay);
  }

  return {
    showText,
    showChoices,
    showNumberInput: (request) => showNumberInput(overlay, request, { applyTextSettings, resetOverlay }),
    hide,
  };
}

export function isDialogueAdvanceKey(key: string): boolean {
  const normalized = normalizedDialogueKey(key);
  return normalized === "enter" || normalized === " " || normalized === "space" || normalized === "escape" || normalized === "e" || normalized === "z";
}

function normalizedDialogueKey(key: string): string {
  return key.length === 1 ? key.toLowerCase() : key.toLowerCase();
}

function applyTextSettings(
  overlay: HTMLElement,
  box: HTMLElement,
  request: DialogueSurfaceSettings,
  appliedPosition?: MessageWindowPosition
): void {
  const settings = request.settings ?? DEFAULT_MESSAGE_WINDOW_SETTINGS;
  const position = appliedPosition ?? applyOverlayPosition(overlay, request);
  box.classList.toggle("transparent", settings.format === "transparent");
  box.dataset.messageFormat = settings.format;
  box.dataset.messagePosition = position;
}

function applyOverlayPosition(overlay: HTMLElement, request: DialogueSurfaceSettings): MessageWindowPosition {
  const settings = request.settings ?? DEFAULT_MESSAGE_WINDOW_SETTINGS;
  const position = effectivePosition({
    settings,
    playerTileY: request.playerTileY,
    mapHeight: request.mapHeight,
  });
  overlay.classList.add(`position-${position}`);
  return position;
}

function resetOverlay(overlay: HTMLElement): void {
  overlay.className = "dialogue-overlay";
}

function effectivePosition(model: {
  readonly settings: MessageWindowSettings;
  readonly playerTileY: number;
  readonly mapHeight: number;
}): MessageWindowPosition {
  if (!model.settings.preventObscuringPlayer) return model.settings.position;
  const maxY = Math.max(1, model.mapHeight - 1);
  const normalizedY = model.playerTileY / maxY;
  if (normalizedY <= 0.35) return "bottom";
  if (normalizedY >= 0.65) return "top";
  return model.settings.position;
}

function cancelChoiceIndex(
  behavior: ChoiceCancelBehavior | undefined,
  optionCount: number
): number | null {
  if (!behavior || behavior === "disallow") return null;
  if (behavior === "branch") return -1;
  const index = Number(behavior.replace("choice", "")) - 1;
  if (Number.isInteger(index) && index >= 0 && index < optionCount) return index;
  return null;
}

function renderFace(face: FaceGraphic): HTMLElement {
  const url = safeResourceImageUrl(resolveAssetResourceUrl(face.resourceId, { project: store.getCurrent() }));
  if (!url) {
    return el("div", {
      class: "dialogue-face missing",
      text: face.resourceId || "face",
      dataset: { testid: "dialogue-face" },
    });
  }
  const index = Math.max(0, Math.min(15, face.faceIndex));
  const col = index % 4;
  const row = Math.floor(index / 4);
  const scale = 4.5;
  const style = [
    `--crop-url:url("${url}")`,
    `--crop-width:${48 * scale}px`,
    `--crop-height:${48 * scale}px`,
    `--crop-sheet-width:${192 * scale}px`,
    `--crop-sheet-height:${192 * scale}px`,
    `--crop-x:-${col * 48 * scale}px`,
    `--crop-y:-${row * 48 * scale}px`,
  ];
  if (face.flipHorizontally) style.push("transform:scaleX(-1)");
  return el("div", {
    class: `dialogue-face actor-sheet-crop${face.flipHorizontally ? " flipped" : ""}`,
    attrs: {
      "aria-label": `얼굴 그래픽 ${face.resourceId} ${index + 1}`,
      role: "img",
      style: style.join(";"),
    },
    dataset: { testid: "dialogue-face" },
  });
}

function safeResourceImageUrl(url: string | null): string | null {
  if (url === null) return null;
  if (/^\/[A-Za-z0-9/_\-.]+\.png$/u.test(url) || /^\/[A-Za-z0-9/_\-.]+\.jpe?g$/u.test(url)) return url;
  if (/^data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/=]+$/u.test(url)) return url;
  return null;
}
