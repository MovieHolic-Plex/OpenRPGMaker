// player/dialogue.ts
// DOM dialogue and choices overlay used by the runtime interpreter.
// It resolves text advancement and choice selection through promises.

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
  // Show a dialogue window until the player advances it.
  showText(request: DialogueTextRequest): Promise<void>;
  // Show choices and resolve with the selected option index.
  showChoices(request: DialogueChoicesRequest): Promise<number>;
  showNumberInput(request: DialogueNumberInputRequest): Promise<number>;
  // Hide any active dialogue overlay.
  hide(): void;
}

export function createDialogueUI(host: HTMLElement): DialogueUI {
  const overlay = el("div", { class: "dialogue-overlay" });
  host.append(overlay);

  function showText(request: DialogueTextRequest): Promise<void> {
    clearChildren(overlay);
    resetOverlay(overlay);
    return new Promise<void>((resolve) => {
      const box = dialogueBox("", "dialogue-box");
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
        text: "click/enter",
      });
      box.append(hint);

      // Typewriter effect.
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
          // Skip the typewriter and show the full line.
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
      overlay.classList.add("choices-active");
      if (request.options.length >= 4) overlay.classList.add("choices-compact");
      const choicesWindow = dialogueBox("choices", "dialogue-box");
      applyTextSettings(overlay, choicesWindow, request, position);
      const choicesEl = el("div", { class: "choice-list", dataset: { testid: "runtime-choices" } });
      if (request.prompt) {
        const promptEl = el("div", {
          class: "choice-prompt-row",
          text: request.prompt,
        });
        choicesEl.append(promptEl);
      }

      let onKey: (event: KeyboardEvent) => void;
      const finish = (index: number): void => {
        document.removeEventListener("keydown", onKey);
        clearChildren(overlay);
        resetOverlay(overlay);
        resolve(index);
      };
      let selectedIndex = 0;
      const buttons: HTMLButtonElement[] = [];
      const setSelected = (nextIndex: number): void => {
        selectedIndex = nextIndex;
        buttons.forEach((button, buttonIndex) => {
          const selected = buttonIndex === selectedIndex;
          button.classList.toggle("selected", selected);
          button.setAttribute("aria-selected", selected ? "true" : "false");
        });
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
          return;
        }
        if (normalizedDialogueKey(e.key) === "arrowup") {
          e.preventDefault();
          setSelected((selectedIndex + request.options.length - 1) % request.options.length);
          return;
        }
        if (normalizedDialogueKey(e.key) === "arrowdown") {
          e.preventDefault();
          setSelected((selectedIndex + 1) % request.options.length);
          return;
        }
        if (normalizedDialogueKey(e.key) === "enter" || normalizedDialogueKey(e.key) === " ") {
          e.preventDefault();
          finish(selectedIndex);
        }
      };

      request.options.forEach((opt, idx) => {
        const btn = el("button", {
          class: "choice-btn",
          text: opt.text,
          attrs: { role: "option", type: "button" },
          dataset: { testid: `runtime-choice-${idx}` },
        });
        btn.addEventListener("mouseenter", () => setSelected(idx));
        btn.addEventListener("focus", () => setSelected(idx));
        btn.addEventListener("click", () => finish(idx));
        buttons.push(btn);
        choicesEl.append(btn);
      });
      choicesEl.setAttribute("role", "listbox");
      setSelected(0);

      document.addEventListener("keydown", onKey);

      choicesWindow.append(choicesEl);
      overlay.append(choicesWindow);
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

function dialogueBox(extraClass: string, testId: string): HTMLElement {
  return el("div", {
    class: `dialogue-box${extraClass ? ` ${extraClass}` : ""}`,
    dataset: { testid: testId },
  });
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
  const scale = 1;
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
      "aria-label": `face ${face.resourceId} ${index + 1}`,
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
