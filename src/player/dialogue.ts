// player/dialogue.ts
// DOM dialogue and choices overlay used by the runtime interpreter.
// It resolves text advancement and choice selection through promises.

import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { DEFAULT_MESSAGE_WINDOW_SETTINGS } from "@/project/session";
import { store } from "@/project/store";
import type { ChoiceCancelBehavior, FaceGraphic, MessageWindowPosition, MessageWindowSettings, Project } from "@/project/types";
import {
  DIALOGUE_FALLBACK_CHAR_WIDTH,
  DIALOGUE_LINES_PER_PAGE,
  fallbackMeasureDialogueText,
  paginateDialogueSegments,
  type DialogueTextMeasure,
  type DialogueTextSegment,
} from "@/player/dialoguePagination";
import { showNumberInput, type DialogueNumberInputRequest } from "@/player/dialogueNumberInput";
import { PLAY_RESOLUTION } from "@/player/playResolution";
import type { PlaySessionLike } from "@/player/types";
import { el, clearChildren } from "@/util/dom";

type DialogueSurfaceSettings = {
  readonly settings?: MessageWindowSettings;
  readonly playerTileY: number;
  readonly mapHeight: number;
  readonly textContext?: DialogueTextContext;
};

export type DialogueTextContext = {
  readonly session: Pick<PlaySessionLike, "variables" | "actorNames">;
  readonly project: Pick<Project, "database">;
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

const DIALOGUE_OVERLAY_HORIZONTAL_PADDING = {
  top: 12,
  center: 8,
  bottom: 12,
} satisfies Record<MessageWindowPosition, number>;
const DIALOGUE_BOX_HORIZONTAL_PADDING = 16;
const DIALOGUE_BOX_HORIZONTAL_BORDER = 2;
const DIALOGUE_FACE_COLUMN_WIDTH = 48;
const DIALOGUE_FACE_COLUMN_GAP = 6;
const DIALOGUE_FONT_FALLBACK =
  '700 7px "DungGeunMo", "Galmuri11", "DotGothic16", "GulimChe", "DotumChe", "MS Gothic", sans-serif';

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
      const position = applyTextSettings(overlay, box, request);
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
      const cursor = el("div", {
        class: "dialogue-page-cursor",
        text: "▼",
        attrs: { "aria-hidden": "true" },
      });
      box.append(cursor);
      overlay.append(box);

      const measure = createDialogueTextMeasure(bodyEl);
      const pages = paginateDialogueSegments(parseDialogueText(request.body, request.textContext), {
        maxWidth: dialogueBodyWidth(request, position),
        measure,
        maxLines: DIALOGUE_LINES_PER_PAGE,
        fallbackCharWidth: DIALOGUE_FALLBACK_CHAR_WIDTH,
      });
      let pageIndex = 0;
      let visibleChars = 0;
      let typing = true;
      let timer = 0;
      const currentSegments = (): readonly DialogueTextSegment[] => pages[pageIndex]?.segments ?? [];
      const finishTyping = (): void => {
        clearTimeout(timer);
        renderDialogueSegments(bodyEl, currentSegments());
        typing = false;
        box.classList.add("page-ready");
      };
      const typeStep = () => {
        const segments = currentSegments();
        const fullLength = visibleTextLength(segments);
        if (visibleChars < fullLength) {
          visibleChars += 1;
          renderDialogueSegments(bodyEl, segments, visibleChars);
          timer = window.setTimeout(typeStep, 24);
        } else {
          finishTyping();
        }
      };
      const startPage = (nextPageIndex: number): void => {
        clearTimeout(timer);
        pageIndex = nextPageIndex;
        visibleChars = 0;
        typing = true;
        box.classList.remove("page-ready");
        renderDialogueSegments(bodyEl, currentSegments(), 0);
        if (visibleTextLength(currentSegments()) === 0) {
          finishTyping();
          return;
        }
        timer = window.setTimeout(typeStep, 24);
      };
      startPage(0);

      const advance = () => {
        if (typing) {
          finishTyping();
          return;
        }
        if (pageIndex < pages.length - 1) {
          startPage(pageIndex + 1);
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
        });
        renderDialogueSegments(promptEl, parseDialogueText(request.prompt, request.textContext));
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
          attrs: { role: "option", type: "button" },
          dataset: { testid: `runtime-choice-${idx}` },
        });
        renderDialogueSegments(btn, parseDialogueText(opt.text, request.textContext));
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

export function resolveDialogueText(value: string, context?: DialogueTextContext): string {
  return parseDialogueText(value, context).map((segment) => segment.text).join("");
}

export function parseDialogueText(value: string, context?: DialogueTextContext): DialogueTextSegment[] {
  const segments: DialogueTextSegment[] = [];
  let colorIndex = 0;
  let buffer = "";
  const push = (): void => {
    if (!buffer) return;
    segments.push({ text: buffer, colorIndex });
    buffer = "";
  };
  for (let i = 0; i < value.length; i += 1) {
    const char = value[i];
    if (char !== "\\") {
      buffer += char;
      continue;
    }
    const next = value[i + 1];
    if (next === "\\") {
      buffer += "\\";
      i += 1;
      continue;
    }
    if ((next === "v" || next === "n" || next === "c") && value[i + 2] === "[") {
      const end = value.indexOf("]", i + 3);
      if (end >= 0) {
        const rawIndex = value.slice(i + 3, end).trim();
        const index = Number(rawIndex);
        if (Number.isInteger(index)) {
          if (next === "v") {
            buffer += String(resolveVariable(context, index));
            i = end;
            continue;
          }
          if (next === "n") {
            buffer += resolveActorName(context, index);
            i = end;
            continue;
          }
          push();
          colorIndex = clampDialogueColor(index);
          i = end;
          continue;
        }
      }
    }
    buffer += char;
  }
  push();
  return segments;
}

function resolveVariable(context: DialogueTextContext | undefined, index: number): number {
  if (!context) return 0;
  const slotId = `var_${String(index).padStart(4, "0")}`;
  return context.session.variables[slotId] ?? context.session.variables[String(index)] ?? context.session.variables[`v${index}`] ?? 0;
}

function resolveActorName(context: DialogueTextContext | undefined, index: number): string {
  if (!context) return "";
  const actor = context.project.database.actors[index - 1];
  if (!actor) return "";
  return context.session.actorNames?.[actor.id] ?? actor.name;
}

function clampDialogueColor(index: number): number {
  if (!Number.isFinite(index)) return 0;
  return Math.max(0, Math.min(19, Math.trunc(index)));
}

function visibleTextLength(segments: readonly DialogueTextSegment[]): number {
  return segments.reduce((total, segment) => total + Array.from(segment.text).length, 0);
}

function renderDialogueSegments(target: HTMLElement, segments: readonly DialogueTextSegment[], visibleChars = Infinity): void {
  clearChildren(target);
  let remaining = visibleChars;
  for (const segment of segments) {
    if (remaining <= 0) break;
    const chars = Array.from(segment.text);
    const text = chars.slice(0, remaining).join("");
    remaining -= chars.length;
    if (!text) continue;
    if (segment.colorIndex === 0) {
      target.append(document.createTextNode(text));
      continue;
    }
    target.append(el("span", {
      class: `dialogue-color dialogue-color-${segment.colorIndex}`,
      text,
    }));
  }
}

function dialogueBodyWidth(request: DialogueTextRequest, position: MessageWindowPosition): number {
  // The play stage is a fixed 320px logical surface. dialogue.css gives the
  // bottom/top overlay 6px horizontal padding, the box 8px padding, and a 1px
  // border; a face column consumes 48px plus the 6px grid gap.
  const baseWidth = PLAY_RESOLUTION.width
    - DIALOGUE_OVERLAY_HORIZONTAL_PADDING[position]
    - DIALOGUE_BOX_HORIZONTAL_PADDING
    - DIALOGUE_BOX_HORIZONTAL_BORDER;
  const faceWidth = request.face ? DIALOGUE_FACE_COLUMN_WIDTH + DIALOGUE_FACE_COLUMN_GAP : 0;
  return Math.max(1, baseWidth - faceWidth);
}

function createDialogueTextMeasure(reference: HTMLElement): DialogueTextMeasure {
  const fallback = (text: string): number => fallbackMeasureDialogueText(text, DIALOGUE_FALLBACK_CHAR_WIDTH);
  const ownerDocument = reference.ownerDocument ?? document;
  const view = ownerDocument.defaultView;
  const canvas = ownerDocument.createElement("canvas");
  const context = typeof canvas.getContext === "function" ? canvas.getContext("2d") : null;
  if (!context) return fallback;
  const computed = view?.getComputedStyle(reference);
  context.font = computed?.font || [
    computed?.fontStyle,
    computed?.fontVariant,
    computed?.fontWeight,
    computed?.fontSize,
    computed?.fontFamily,
  ].filter(Boolean).join(" ") || DIALOGUE_FONT_FALLBACK;
  return (text: string): number => {
    const width = context.measureText(text).width;
    return Number.isFinite(width) && width >= 0 ? width : fallback(text);
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
): MessageWindowPosition {
  const settings = request.settings ?? DEFAULT_MESSAGE_WINDOW_SETTINGS;
  const position = appliedPosition ?? applyOverlayPosition(overlay, request);
  box.classList.toggle("transparent", settings.format === "transparent");
  box.dataset.messageFormat = settings.format;
  box.dataset.messagePosition = position;
  return position;
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
