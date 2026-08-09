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
  type DialogueTextControl,
  type DialogueTextMeasure,
  type DialogueTextSegment,
} from "@/player/dialoguePagination";
import { showNumberInput, type DialogueNumberInputRequest } from "@/player/dialogueNumberInput";
import { isCancelKey, isConfirmKey, normalizeKey } from "@/player/keyBindings";
import { PLAY_RESOLUTION } from "@/player/playResolution";
import type { PlaySessionLike } from "@/project/sessionRuntimeTypes"
import { el, clearChildren } from "@/util/dom";

type DialogueSurfaceSettings = {
  readonly settings?: MessageWindowSettings;
  readonly playerTileY: number;
  readonly mapHeight: number;
  readonly textContext?: DialogueTextContext;
};

export type DialogueTextContext = {
  readonly session: Pick<PlaySessionLike, "variables" | "actorNames"> & { readonly gold?: number };
  readonly project: Pick<Project, "database">;
};

export type DialogueTextRequest = DialogueSurfaceSettings & {
  readonly speaker?: string;
  readonly body: string;
  readonly face?: FaceGraphic;
  /** true 면 페이지 타이핑 종료 후 키 입력 없이 다음으로. */
  readonly autoAdvance?: boolean;
};

export type DialogueChoicesRequest = DialogueSurfaceSettings & {
  readonly prompt?: string;
  readonly options: { text: string }[];
  readonly cancelBehavior?: ChoiceCancelBehavior;
};

const DEFAULT_DIALOGUE_CHAR_DELAY_MS = 24;

type DialoguePlaybackToken =
  | { readonly kind: "char" }
  | { readonly kind: "control"; readonly control: DialogueTextControl };

export function dialogueSpeedDelayMs(value: number): number {
  const speed = Math.max(1, Math.min(20, Math.trunc(Number.isFinite(value) ? value : 3)));
  return speed * 8;
}

function dialoguePlaybackTokens(segments: readonly DialogueTextSegment[]): DialoguePlaybackToken[] {
  const tokens: DialoguePlaybackToken[] = [];
  for (const segment of segments) {
    for (const control of segment.controlsBefore ?? []) tokens.push({ kind: "control", control });
    for (const _char of Array.from(segment.text)) tokens.push({ kind: "char" });
  }
  return tokens;
}
const DIALOGUE_OVERLAY_HORIZONTAL_PADDING = {
  top: 12,
  center: 8,
  bottom: 12,
} satisfies Record<MessageWindowPosition, number>;
// 2026-07-27 브라우저 실측(test/e2e/_dialogue-box-measure.spec.ts, 320px 논리 화면):
//   .dialogue-box  padding-left/right = 4px  → 좌우 합 8
//   .dialogue-box  border-width       = 8px  → 좌우 합 16  (--runtime-window-border, border-image)
// 예전 값은 padding 16 / border 2 였다 — 합이 18 로 실제 24 보다 **6px 작아서**
// 폭을 6px 넉넉하게 잡았다. 한 줄이 들어간다고 계산한 문장이 실제로는 넘쳐서
// 마지막 글자가 예상 밖에서 꺾였다(실측: 계산 236 vs 실제 본문 폭 230).
const DIALOGUE_BOX_HORIZONTAL_PADDING = 8;
const DIALOGUE_BOX_HORIZONTAL_BORDER = 16;
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
      const portraitMode = dialoguePortraitMode(request.face);
      const isPortrait = portraitMode !== "chip";
      const content = el("div", {
        class: [
          "dialogue-content",
          request.face?.position === "right" ? "face-right" : "",
          isPortrait ? "has-bust" : "",
          isPortrait ? `portrait-${portraitMode}` : "",
        ]
          .filter(Boolean)
          .join(" "),
      });
      if (request.face && !isPortrait) content.append(renderFace(request.face));
      const textColumn = el("div", { class: "dialogue-text-column" });
      const bodyEl = el("div", { class: "body" });
      textColumn.append(bodyEl);
      content.append(textColumn);
      box.append(content);
      if (request.face && isPortrait) {
        // Attach to the message box so left/right tracks the window, not the full screen.
        box.classList.add("has-bust-face", `portrait-${portraitMode}`);
        if (request.face.position === "right") box.classList.add("bust-right");
        else box.classList.add("bust-left");
        overlay.classList.add("has-bust-face");
        box.append(renderFace(request.face));
      }
      // 화자 이름은 본문과 분리된 네임플레이트로 창 상단에 붙인다 (Fields of Mistria 식).
      if (request.speaker?.trim()) {
        box.classList.add("has-speaker");
        box.append(
          el("div", {
            class: "speaker speaker-nameplate",
            text: request.speaker.trim(),
            dataset: { testid: "dialogue-speaker" },
          })
        );
      }
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
        maxLines: dialogueMaxLines(bodyEl),
        fallbackCharWidth: DIALOGUE_FALLBACK_CHAR_WIDTH,
      });
      let pageIndex = 0;
      let visibleChars = 0;
      let tokenIndex = 0;
      let typing = true;
      let waitingForControl = false;
      let autoClosePage = request.autoAdvance === true;
      let charDelayMs = DEFAULT_DIALOGUE_CHAR_DELAY_MS;
      let fastMode = false;
      let timer = 0;
      let goldWindow: HTMLElement | undefined;

      const currentSegments = (): readonly DialogueTextSegment[] => pages[pageIndex]?.segments ?? [];
      const currentTokens = (): readonly DialoguePlaybackToken[] => dialoguePlaybackTokens(currentSegments());
      const showGoldWindow = (): void => {
        if (!goldWindow) {
          goldWindow = el("div", {
            class: "dialogue-gold-window",
            dataset: { testid: "dialogue-gold-window" },
            children: [
              el("span", { class: "dialogue-gold-label", text: "소지금" }),
              el("strong", {
                class: "dialogue-gold-value",
                text: `${Math.max(0, Math.trunc(request.textContext?.session.gold ?? 0))} G`,
              }),
            ],
          });
          overlay.append(goldWindow);
        }
        goldWindow.removeAttribute("hidden");
      };
      const executeControl = (
        control: DialogueTextControl,
        skipWaits: boolean
      ): number | "pause" => {
        switch (control.kind) {
          case "speed":
            charDelayMs = dialogueSpeedDelayMs(control.value);
            return 0;
          case "gold":
            showGoldWindow();
            return 0;
          case "pause":
            return skipWaits ? 0 : "pause";
          case "wait":
            return skipWaits ? 0 : control.ms;
          case "fastOn":
            fastMode = true;
            return 0;
          case "fastOff":
            fastMode = false;
            return 0;
          case "halfSpace":
            return 0;
          case "autoClose":
            autoClosePage = true;
            return 0;
        }
      };
      const markPageReady = (): void => {
        typing = false;
        waitingForControl = false;
        box.classList.add("page-ready");
      };
      const consumeRemainingPage = (): void => {
        clearTimeout(timer);
        const tokens = currentTokens();
        while (tokenIndex < tokens.length) {
          const token = tokens[tokenIndex++];
          if (token?.kind === "char") {
            visibleChars += 1;
          } else if (token?.kind === "control") {
            executeControl(token.control, true);
          }
        }
        renderDialogueSegments(bodyEl, currentSegments());
        markPageReady();
        if (autoClosePage) timer = window.setTimeout(advance, 0);
      };
      const completeTypedPage = (): void => {
        renderDialogueSegments(bodyEl, currentSegments());
        markPageReady();
        if (autoClosePage) timer = window.setTimeout(advance, 0);
      };
      const typeStep = (): void => {
        const tokens = currentTokens();
        while (tokenIndex < tokens.length) {
          const token = tokens[tokenIndex++];
          if (token?.kind === "control") {
            const effect = executeControl(token.control, false);
            if (effect === "pause") {
              typing = false;
              waitingForControl = true;
              box.classList.add("page-ready");
              return;
            }
            if (effect > 0) {
              timer = window.setTimeout(typeStep, effect);
              return;
            }
            continue;
          }
          if (token?.kind === "char") {
            visibleChars += 1;
            renderDialogueSegments(bodyEl, currentSegments(), visibleChars);
            timer = window.setTimeout(typeStep, fastMode ? 0 : charDelayMs);
            return;
          }
        }
        completeTypedPage();
      };
      const startPage = (nextPageIndex: number): void => {
        clearTimeout(timer);
        pageIndex = nextPageIndex;
        visibleChars = 0;
        tokenIndex = 0;
        typing = true;
        waitingForControl = false;
        autoClosePage = request.autoAdvance === true;
        box.classList.remove("page-ready");
        renderDialogueSegments(bodyEl, currentSegments(), 0);
        timer = window.setTimeout(typeStep, fastMode ? 0 : charDelayMs);
      };
      const advance = () => {
        if (waitingForControl) {
          waitingForControl = false;
          typing = true;
          box.classList.remove("page-ready");
          timer = window.setTimeout(typeStep, 0);
          return;
        }
        if (typing) {
          consumeRemainingPage();
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
      startPage(0);
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
        // 취소는 X/Esc 둘 다. 선택지에서 X 만 죽어 있던 결함(적대 리뷰 5).
        if (isCancelKey(e.key)) {
          const cancelIndex = cancelChoiceIndex(request.cancelBehavior, request.options.length);
          if (cancelIndex !== null) {
            e.preventDefault();
            finish(cancelIndex);
          }
          return;
        }
        if (normalizeKey(e.key) === "arrowup") {
          e.preventDefault();
          setSelected((selectedIndex + request.options.length - 1) % request.options.length);
          return;
        }
        if (normalizeKey(e.key) === "arrowdown") {
          e.preventDefault();
          setSelected((selectedIndex + 1) % request.options.length);
          return;
        }
        // 결정은 Z/Enter/Space/E. Enter·Space 만 받아서 대사를 Z 로 넘기다가
        // 선택지가 뜨는 순간 Z 가 죽던 결함(적대 리뷰 1).
        if (isConfirmKey(e.key)) {
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
  let pendingControls: DialogueTextControl[] = [];
  const push = (includeEmpty = false): void => {
    if (!buffer && !includeEmpty && pendingControls.length === 0) return;
    segments.push({
      text: buffer,
      colorIndex,
      ...(pendingControls.length > 0 ? { controlsBefore: pendingControls } : {}),
    });
    buffer = "";
    pendingControls = [];
  };
  const addControl = (control: DialogueTextControl): void => {
    if (buffer) push();
    pendingControls.push(control);
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
    const control = next?.toLowerCase();
    if ((control === "v" || control === "n" || control === "c" || control === "s") && value[i + 2] === "[") {
      const end = value.indexOf("]", i + 3);
      if (end >= 0) {
        const rawIndex = value.slice(i + 3, end).trim();
        const index = Number(rawIndex);
        if (Number.isInteger(index)) {
          if (control === "v") {
            buffer += String(resolveVariable(context, index));
            i = end;
            continue;
          }
          if (control === "n") {
            buffer += resolveActorName(context, index);
            i = end;
            continue;
          }
          if (control === "c") {
            push();
            colorIndex = clampDialogueColor(index);
          } else {
            addControl({ kind: "speed", value: index });
          }
          i = end;
          continue;
        }
      }
    }
    if (next === "_") {
      addControl({ kind: "halfSpace" });
      buffer += " ";
      i += 1;
      continue;
    }
    const simpleControl: DialogueTextControl | undefined =
      next === "$" ? { kind: "gold" }
      : next === "!" ? { kind: "pause" }
      : next === "." ? { kind: "wait", ms: 250 }
      : next === "|" ? { kind: "wait", ms: 1000 }
      : next === ">" ? { kind: "fastOn" }
      : next === "<" ? { kind: "fastOff" }
      : next === "^" ? { kind: "autoClose" }
      : undefined;
    if (simpleControl) {
      addControl(simpleControl);
      i += 1;
      continue;
    }
    buffer += char;
  }
  push(pendingControls.length > 0);
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

/**
 * **한 페이지에 들어가는 줄 수를 상자에서 유도한다.** 상수로 박아 두면 안 된다.
 *
 * 2026-07-27 브라우저 실측(320px 논리 화면, 화자 이름표가 있는 NPC 대사):
 *   상자 바깥 높이 58.8px · 테두리 8px×2 → 안쪽 42.8px
 *   `.dialogue-box.has-speaker` 의 padding-top 18.9px 를 빼면 본문 칸은 **23.9px**
 *   `.dialogue-box .body` 는 font-size 9px · line-height 1.2 = **10.8px/줄**
 *   → 실제로 들어가는 줄 수는 **2줄**
 * 그런데 `DIALOGUE_LINES_PER_PAGE` 는 4 였다. 그래서 3·4번째 줄은 만들어지되
 * (`.body { overflow: auto }`) 화면에는 없었다 — 문장이 소리 없이 잘렸다.
 * 이름표가 없을 때는 42.8/10.8 = 3.96 → 4줄이 맞는다. 즉 상수 4 는 "이름표 없는 경우"에만
 * 맞는 값이었고, NPC 대사는 항상 이름표가 있으므로 항상 틀렸다.
 *
 * 여기서 `clientHeight` 를 읽는 시점은 상자를 이미 overlay 에 붙인 뒤다 — 레이아웃이
 * 확정돼 있어야 값이 나온다. jsdom 처럼 레이아웃이 없는 환경에서는 0 이 나오므로
 * 그때만 상수로 되돌린다.
 */
function dialogueMaxLines(bodyEl: HTMLElement): number {
  const view = bodyEl.ownerDocument?.defaultView;
  if (!view) return DIALOGUE_LINES_PER_PAGE;
  const available = bodyEl.clientHeight;
  if (!Number.isFinite(available) || available <= 0) return DIALOGUE_LINES_PER_PAGE;
  const computed = view.getComputedStyle(bodyEl);
  const lineHeight = parseFloat(computed.lineHeight);
  const resolved = Number.isFinite(lineHeight) && lineHeight > 0
    ? lineHeight
    // line-height: normal 은 숫자로 안 나온다 — 글꼴 크기의 1.2 로 근사한다(.body 의 선언값).
    : parseFloat(computed.fontSize) * 1.2;
  if (!Number.isFinite(resolved) || resolved <= 0) return DIALOGUE_LINES_PER_PAGE;
  // 0.05 는 서브픽셀 반올림 여유다(23.9/10.8 = 2.213 처럼 딱 맞지 않는 값이 정상).
  return Math.max(1, Math.floor(available / resolved + 0.05));
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

// 대사 진행은 결정 키만. Esc 는 취소 키인데 여기서만 "진행"으로 동작해
// 취소가 확인 역할을 하던 결함(적대 리뷰 4)을 잘라냈다. 메시지 창에서 취소는
// RM 관례대로 아무 일도 하지 않는다 — X 와 Esc 가 이제 동일하게 무반응이다.
export function isDialogueAdvanceKey(key: string): boolean {
  return isConfirmKey(key);
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

function dialoguePortraitMode(face: FaceGraphic | undefined): "chip" | "bust" | "full" {
  if (!face?.resourceId) return "chip";
  const id = face.resourceId.trim().toLowerCase();
  if (id.includes("-full") || id.includes("fullbody") || id.includes("-body") || id.endsWith("/full")) {
    return "full";
  }
  if (
    id.includes("-bust")
    || id.includes("-portrait")
    || id.startsWith("generated-face-")
    || id.endsWith("/bust")
  ) {
    return "bust";
  }
  return "chip";
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
  const mode = dialoguePortraitMode(face);
  if (mode !== "chip") {
    const side = face.position === "right" ? "right" : "left";
    return el("div", {
      class: [
        "dialogue-face",
        "dialogue-face-bust",
        `dialogue-face-${mode}`,
        `dialogue-face-side-${side}`,
        face.flipHorizontally ? "flipped" : "",
      ]
        .filter(Boolean)
        .join(" "),
      attrs: {
        "aria-label": `face ${mode} ${face.resourceId}`,
        role: "img",
        style: `background-image:url("${url}")`,
      },
      dataset: {
        testid: "dialogue-face",
        faceMode: mode,
        position: side,
        resourceId: face.resourceId,
      },
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
    dataset: { testid: "dialogue-face", faceMode: "chip" },
  });
}

function safeResourceImageUrl(url: string | null): string | null {
  if (url === null) return null;
  if (/^\/[A-Za-z0-9/_\-.]+\.png$/u.test(url) || /^\/[A-Za-z0-9/_\-.]+\.jpe?g$/u.test(url)) return url;
  if (/^data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/=]+$/u.test(url)) return url;
  return null;
}
