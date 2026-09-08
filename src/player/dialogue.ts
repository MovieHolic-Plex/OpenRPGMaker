// player/dialogue.ts
// DOM dialogue and choices overlay used by the runtime interpreter.
// It resolves text advancement and choice selection through promises.

import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { FACE_IMAGE_SIZE } from "@/assets/resourceSlicing";
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
import {
  mountDialoguePage,
  renderDialogueSegments,
  type DialoguePageRenderer,
} from "@/player/dialogueTextRenderer";
import {
  dialoguePresentationCssVars,
  dialoguePresentationProfile,
  dialogueScaledCharDelayMs,
  dialogueSpeakerInsetPx,
  type DialoguePresentationProfile,
} from "@/player/dialoguePresentation";
import { prefersReducedMotion } from "@/player/characterLanding";
import { isCancelKey, isConfirmKey, isTextEntryTarget, normalizeKey } from "@/player/keyBindings";
import { applySystemWindowSkinVariable } from "@/player/systemGraphics";
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
  readonly signal?: AbortSignal;
  readonly speaker?: string;
  readonly body: string;
  readonly face?: FaceGraphic;
  /** true 면 페이지 타이핑 종료 후 키 입력 없이 다음으로. */
  readonly autoAdvance?: boolean;
  /**
   * 「문장 표시」 커맨드의 연출 선택자. 감정 이름이 그대로 연출 프로파일을 고른다
   * (src/player/dialoguePresentation.ts). 모르는 값과 빈 값은 neutral 로 떨어진다.
   */
  readonly emotion?: string;
  /** 검사용 주입 구멍. 생략하면 matchMedia 를 본다. */
  readonly reducedMotion?: boolean;
};

export type DialogueChoicesRequest = DialogueSurfaceSettings & {
  readonly prompt?: string;
  readonly options: { text: string }[];
  readonly cancelBehavior?: ChoiceCancelBehavior;
  readonly signal?: AbortSignal;
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
  top: 20,
  center: 20,
  bottom: 20,
} satisfies Record<MessageWindowPosition, number>;
const DIALOGUE_BOX_HORIZONTAL_PADDING = 16;
const DIALOGUE_BOX_HORIZONTAL_BORDER = 2;
const DIALOGUE_FACE_COLUMN_WIDTH = 48;
const DIALOGUE_FACE_COLUMN_GAP = 8;
const DIALOGUE_BUST_TEXT_RESERVE = 96;
const DIALOGUE_FULL_TEXT_RESERVE = 100;
const DIALOGUE_FONT_FALLBACK =
  '700 7px "DungGeunMo", "Galmuri11", "DotGothic16", "GulimChe", "DotumChe", "MS Gothic", sans-serif';

export interface DialogueUI {
  // Show a dialogue window until the player advances it.
  showText(request: DialogueTextRequest): Promise<void>;
  // Show choices and resolve with the selected option index.
  showChoices(request: DialogueChoicesRequest): Promise<number>;
  showNumberInput(request: DialogueNumberInputRequest): Promise<number>;
  /** 즉시 컷. 창 전환처럼 대사창이 남아 있으면 안 되는 자리에서 쓴다. */
  hide(): void;
  /** 퇴장 연출을 재생한 뒤 창을 뺀다. 대화 세션이 끝나는 자리에서 쓴다. */
  close(): void;
}

/** 지연 실행 주입 구멍. 취소 함수를 돌려준다. createBattleTransition 과 같은 형태. */
export type DialogueSchedule = (callback: () => void, delayMs: number) => () => void;

const defaultDialogueSchedule: DialogueSchedule = (callback, delayMs) => {
  // window 가 없는 환경(node 단위 테스트, test/fakeDom.ts)에서는 지연 없이 끝낸다 —
  // 퇴장 연출은 브라우저 전용이고, 여기서 예약을 걸면 DOM 이 영원히 안 비워진다.
  if (typeof window === "undefined") {
    callback();
    return () => {};
  }
  const id = window.setTimeout(callback, delayMs);
  return () => window.clearTimeout(id);
};

export function createDialogueUI(
  host: HTMLElement,
  schedule: DialogueSchedule = defaultDialogueSchedule
): DialogueUI {
  // 스크림은 오버레이의 **형제**여야 한다. 오버레이는 position-top/bottom 에서 높이가
  // 화면의 27% 뿐이라 그 안에 두면 화면을 덮을 수 없다. z-index 38 — 대사창(39) 아래,
  // 존 피드백·미니맵(30) 위. 크롭 inset 은 runtime/playSurface.css 가 맞춘다.
  const scrim = el("div", { class: "dialogue-scrim", attrs: { "aria-hidden": "true" } });
  const overlay = el("div", { class: "dialogue-overlay" });
  applySystemWindowSkinVariable(overlay);
  host.append(scrim, overlay);

  // 퇴장 예약. 상자를 즉시 파괴하지 않고 이만큼 미뤄 두기 때문에 퇴장 연출이 재생된다.
  let pendingExit: { readonly cancelTimer: () => void; readonly finish: () => void } | null = null;
  // 지금 열려 있는 창의 퇴장 길이. close() 가 프로파일을 다시 볼 수 없어서 들고 있는다.
  let activeExitMs = 0;
  let cancelActiveChoice: (() => void) | undefined;
  let cancelActiveText: (() => void) | undefined;

  const clearOverlay = (): void => {
    clearChildren(overlay);
    resetOverlay(overlay);
    resetScrim(scrim);
  };

  /**
   * 오버레이를 새 창이 인수한다. 돌려주는 값은 **인수 직전에 창이 열려 있었는가** —
   * 그게 곧 대화 세션이 이어지는 중인가다. 세션 플래그를 따로 들 필요가 없다.
   *
   * 연속 대사는 advance() → cleanup() → resolve() → (마이크로태스크) → 다음 showText 가
   * 같은 tick, 페인트 전에 일어난다. 그래서 cleanup 이 걸어 둔 퇴장 예약은 한 프레임도
   * 그려지지 않고 여기서 취소되고, 진입 연출도 다시 재생되지 않는다.
   */
  const takeOverOverlay = (): boolean => {
    cancelActiveText?.();
    cancelActiveChoice?.();
    const wasOpen = overlay.firstChild !== null;
    if (pendingExit) {
      pendingExit.cancelTimer();
      pendingExit = null;
    }
    clearOverlay();
    return wasOpen;
  };

  const beginExit = (box: HTMLElement, exitMs: number): void => {
    if (pendingExit) return;
    box.dataset.dialoguePhase = "exit";
    // 스크림도 같이 걷힌다. 다음 대사가 이어지면 takeOverOverlay() 가 같은 tick 에 다시
    // 켜므로 페인트에는 꺼진 프레임이 나타나지 않는다.
    delete scrim.dataset.dialogueScrim;
    let settled = false;
    const finish = (): void => {
      if (settled) return;
      settled = true;
      pendingExit = null;
      clearOverlay();
    };
    const cancelTimer = schedule(finish, exitMs);
    // schedule 이 동기로 끝냈으면(node 환경) 예약을 남기지 않는다.
    if (!settled) pendingExit = { cancelTimer, finish };
  };

  const beginEnter = (box: HTMLElement, enterMs: number, animate: boolean): (() => void) => {
    if (!animate) {
      box.dataset.dialoguePhase = "shown";
      return () => {};
    }
    box.dataset.dialoguePhase = "enter";
    return schedule(() => {
      if (box.dataset.dialoguePhase === "enter") box.dataset.dialoguePhase = "shown";
    }, enterMs);
  };

  function showText(request: DialogueTextRequest): Promise<void> {
    if (request.signal?.aborted) return Promise.reject(new DOMException("Text cancelled", "AbortError"));
    const wasOpen = takeOverOverlay();
    return new Promise<void>((resolve, reject) => {
      let settled = false;
      const box = dialogueBox("", "dialogue-box");
      const position = applyTextSettings(overlay, box, request);
      const profile = dialoguePresentationProfile(request.emotion, {
        reducedMotion: resolveReducedMotion(request.reducedMotion),
      });
      applyDialoguePresentation(box, profile);
      applyDialogueScrim(scrim, profile, position);
      activeExitMs = profile.exitMs;
      const portraitMode = dialoguePortraitMode(request.face);
      const isPortrait = portraitMode !== "face";
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
      let nameplate: HTMLElement | undefined;
      if (request.speaker?.trim()) {
        box.classList.add("has-speaker");
        nameplate = el("div", {
          class: "speaker speaker-nameplate",
          text: request.speaker.trim(),
          dataset: { testid: "dialogue-speaker" },
        });
        box.append(nameplate);
      }
      const cursor = el("div", {
        class: "dialogue-page-cursor",
        text: "▼",
        attrs: { "aria-hidden": "true" },
      });
      box.append(cursor);
      overlay.append(box);
      // 이름표가 본문 첫 줄을 덮지 않게 여백을 재서 심는다. 오버레이에 붙인 **뒤**라야
      // offsetHeight 가 나오고, 줄 수를 세기 **전**이라야 그 줄 수가 실제 본문 칸을 본다.
      if (nameplate) reserveSpeakerInset(box, nameplate);

      const measure = createDialogueTextMeasure(bodyEl);
      const pages = paginateDialogueSegments(parseDialogueText(request.body, request.textContext), {
        maxWidth: dialogueBodyWidth(request, position, logicalHostWidth(host)),
        measure,
        maxLines: dialogueMaxLines(bodyEl),
        fallbackCharWidth: DIALOGUE_FALLBACK_CHAR_WIDTH,
      });
      // 진입 연출은 페이지네이션이 끝난 뒤에 건다. 연출은 transform/opacity 뿐이라
      // clientHeight 에 영향이 없지만, 순서를 고정해 두면 나중에 레이아웃 속성을
      // 실수로 애니메이션해도 측정이 먼저 끝나 있다(줄 수가 틀어지면 문장이 조용히 잘린다).
      const cancelEnter = beginEnter(box, profile.enterMs, !wasOpen);
      let pageIndex = 0;
      let visibleChars = 0;
      let tokenIndex = 0;
      let typing = true;
      let waitingForControl = false;
      let autoClosePage = request.autoAdvance === true;
      // 프로파일 배율은 기본 지연에만 적용한다. \s[n] 로 명시한 속도는 저작자 의도라
      // 그대로 이긴다(executeControl 의 "speed" 분기가 배율 없이 덮어쓴다).
      let charDelayMs = dialogueScaledCharDelayMs(DEFAULT_DIALOGUE_CHAR_DELAY_MS, profile);
      let fastMode = false;
      let timer = 0;
      let goldWindow: HTMLElement | undefined;
      // 페이지마다 새로 마운트한다. 타이핑은 이 렌더러에 "몇 글자까지" 만 알려주고
      // 이미 붙은 글자 노드는 건드리지 않는다 — 그래야 글자 연출이 되감기지 않는다.
      let pageRenderer: DialoguePageRenderer | undefined;

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
        pageRenderer?.revealAll();
        markPageReady();
        if (autoClosePage) timer = window.setTimeout(advance, 0);
      };
      const completeTypedPage = (): void => {
        pageRenderer?.revealAll();
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
            pageRenderer?.reveal(visibleChars);
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
        pageRenderer = mountDialoguePage(bodyEl, currentSegments());
        timer = window.setTimeout(typeStep, fastMode ? 0 : charDelayMs);
      };
      const advance = () => {
        if (settled) return;
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
        settled = true;
        cleanup();
        beginExit(box, profile.exitMs);
        resolve();
      };
      const onKey = (e: KeyboardEvent) => {
        // 텍스트 입력 컨트롤(런타임 디버그 패널)에 치는 Enter/Space 는 대사 진행이 아니다.
        if (settled || e.repeat || e.isComposing || isTextEntryTarget(e.target)) return;
        if (isDialogueAdvanceKey(e.key)) {
          e.preventDefault();
          e.stopImmediatePropagation();
          advance();
        }
      };
      const cleanup = () => {
        cancelEnter();
        clearTimeout(timer);
        box.removeEventListener("click", advance);
        document.removeEventListener("keydown", onKey);
        request.signal?.removeEventListener("abort", abort);
        if (cancelActiveText === abort) cancelActiveText = undefined;
      };
      const abort = (): void => {
        if (settled) return;
        settled = true;
        cleanup();
        clearOverlay();
        reject(new DOMException("Text cancelled", "AbortError"));
      };
      cancelActiveText = abort;
      request.signal?.addEventListener("abort", abort, { once: true });
      box.addEventListener("click", advance);
      document.addEventListener("keydown", onKey);
      startPage(0);
    });
  }

  function showChoices(request: DialogueChoicesRequest): Promise<number> {
    if (request.signal?.aborted) return Promise.reject(new DOMException("Choice cancelled", "AbortError"));
    // 대사 직후 선택지는 같은 창 세션이다 — 여기서 진입 연출을 다시 재생하면 안 된다.
    const wasOpen = takeOverOverlay();
    return new Promise<number>((resolve, reject) => {
      const position = applyOverlayPosition(overlay, request);
      overlay.classList.add("choices-active");
      if (request.options.length >= 4) overlay.classList.add("choices-compact");
      const choicesWindow = dialogueBox("choices", "dialogue-box");
      applyTextSettings(overlay, choicesWindow, request, position);
      const choicesProfile = dialoguePresentationProfile(undefined, {
        reducedMotion: resolveReducedMotion(undefined),
      });
      applyDialoguePresentation(choicesWindow, choicesProfile);
      applyDialogueScrim(scrim, choicesProfile, position);
      activeExitMs = choicesProfile.exitMs;
      const choicesEl = el("div", { class: "choice-list", dataset: { testid: "runtime-choices" } });
      if (request.prompt) {
        const promptEl = el("div", {
          class: "choice-prompt-row",
        });
        renderDialogueSegments(promptEl, parseDialogueText(request.prompt, request.textContext));
        choicesEl.append(promptEl);
      }

      let onKey: (event: KeyboardEvent) => void;
      let settled = false;
      const cleanup = (): void => {
        settled = true;
        document.removeEventListener("keydown", onKey);
        request.signal?.removeEventListener("abort", abort);
        if (cancelActiveChoice === abort) cancelActiveChoice = undefined;
      };
      const abort = (): void => {
        if (settled) return;
        cleanup();
        clearOverlay();
        reject(new DOMException("Choice cancelled", "AbortError"));
      };
      const finish = (index: number): void => {
        if (settled) return;
        cleanup();
        beginExit(choicesWindow, choicesProfile.exitMs);
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
          button.tabIndex = selected ? 0 : -1;
        });
        const selected = buttons[selectedIndex];
        if (selected?.isConnected && document.activeElement !== selected) selected.focus({ preventScroll: true });
      };
      onKey = (e: KeyboardEvent) => {
        if (settled || e.isComposing) return;
        if (e.repeat && (isConfirmKey(e.key) || isCancelKey(e.key) || /^[1-9]$/.test(e.key))) {
          e.preventDefault();
          return;
        }
        // 입력창에 치는 숫자·Enter 가 선택지를 고르면 안 된다(텍스트 입력 컨트롤은 게임 키가 아니다).
        if (isTextEntryTarget(e.target)) return;
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

      cancelActiveChoice = abort;
      request.signal?.addEventListener("abort", abort, { once: true });
      document.addEventListener("keydown", onKey);

      choicesWindow.append(choicesEl);
      overlay.append(choicesWindow);
      setSelected(0);
      beginEnter(choicesWindow, choicesProfile.enterMs, !wasOpen);
    });
  }

  /** 즉시 컷. 퇴장 예약이 걸려 있으면 취소하고 바로 비운다. */
  function hide(): void {
    cancelActiveText?.();
    cancelActiveChoice?.();
    if (pendingExit) {
      pendingExit.cancelTimer();
      pendingExit = null;
    }
    clearOverlay();
  }

  /** 퇴장 연출을 재생한 뒤 비운다. 이미 예약이 걸려 있으면 그대로 둔다. */
  function close(): void {
    cancelActiveText?.();
    cancelActiveChoice?.();
    const box = overlay.querySelector<HTMLElement>(".dialogue-box");
    if (!box) {
      hide();
      return;
    }
    beginExit(box, activeExitMs);
  }

  return {
    showText,
    showChoices,
    showNumberInput: (request) => {
      takeOverOverlay();
      return showNumberInput(overlay, request, { applyTextSettings, resetOverlay });
    },
    hide,
    close,
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

function dialogueBodyWidth(request: DialogueTextRequest, position: MessageWindowPosition, hostWidth: number): number {
  const baseWidth = hostWidth
    - DIALOGUE_OVERLAY_HORIZONTAL_PADDING[position]
    - DIALOGUE_BOX_HORIZONTAL_PADDING
    - DIALOGUE_BOX_HORIZONTAL_BORDER;
  const portraitMode = dialoguePortraitMode(request.face);
  const faceWidth = !request.face
    ? 0
    : portraitMode === "full"
      ? DIALOGUE_FULL_TEXT_RESERVE
      : portraitMode === "bust"
        ? DIALOGUE_BUST_TEXT_RESERVE
        : DIALOGUE_FACE_COLUMN_WIDTH + DIALOGUE_FACE_COLUMN_GAP;
  return Math.max(1, baseWidth - faceWidth);
}

function logicalHostWidth(host: HTMLElement): number {
  const inlineWidth = Number.parseFloat(host.style.width);
  if (Number.isFinite(host.clientWidth) && host.clientWidth > 0) return host.clientWidth;
  if (Number.isFinite(inlineWidth) && inlineWidth > 0) return inlineWidth;
  return PLAY_RESOLUTION.width;
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

/**
 * 이름표가 파고든 깊이만큼 본문을 내린다. 근거와 실측은
 * `dialogueSpeakerInsetPx` 주석에 있다 — 여기는 DOM 을 읽어 넘기는 통로다.
 *
 * `offsetTop`/`offsetHeight` 를 쓴다. 무대가 `--play-scale` 로 확대되므로
 * `getBoundingClientRect()` 는 배율이 섞인 화면 px 를 주고, 그 값을 padding 으로 심으면
 * 배율만큼 부풀어 본문 칸이 사라진다.
 */
function reserveSpeakerInset(box: HTMLElement, nameplate: HTMLElement): void {
  const view = box.ownerDocument?.defaultView;
  if (!view) return;
  const fallback = Number.parseFloat(view.getComputedStyle(box).paddingTop);
  const inset = dialogueSpeakerInsetPx(
    nameplate.offsetTop,
    nameplate.offsetHeight,
    Number.isFinite(fallback) ? fallback : 0
  );
  if (inset === undefined) return;
  box.style.setProperty("--runtime-dialogue-speaker-inset", `${inset}px`);
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
  const box = el("div", {
    class: `dialogue-box${extraClass ? ` ${extraClass}` : ""}`,
    dataset: { testid: testId },
  });
  // 대화/이름상자/선택지 창도 자료집 System 윈도스킨 파이프를 통한다.
  // 하드코드 hex 유리 토큰만 쓰던 시절엔 윈도스킨을 바꿔도 메시지 창은 그대로여시
  // 전투/상점/필드 메뉴와 창이 서로 다른 색이었다. 표면은 CSS 가 변수로 소모한다.
  applySystemWindowSkinVariable(box);
  return box;
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

function resetScrim(scrim: HTMLElement): void {
  scrim.className = "dialogue-scrim";
  delete scrim.dataset.dialogueScrim;
  delete scrim.dataset.dialogueFlash;
}

/**
 * 화면 단위 연출. 스크림은 창이 아니라 **화면**에 걸리므로 상자가 아니라 자기 엘리먼트에
 * 얹는다. 위치 클래스를 같이 실어 어두워지는 쪽을 창이 있는 쪽으로 맞춘다 —
 * 창이 위에 있는데 아래를 어둡게 하면 방향이 어긋난 채 화면만 탁해진다.
 *
 * 변수는 `dialoguePresentationCssVars` 를 통째로 심는다. 스크림이 쓰는 두 개만 골라
 * 손으로 다시 쓰면 그게 곧 TS/CSS 이중 기재와 같은 어긋남의 씨앗이 된다.
 */
function applyDialogueScrim(
  scrim: HTMLElement,
  profile: DialoguePresentationProfile,
  position: MessageWindowPosition
): void {
  scrim.className = `dialogue-scrim position-${position}`;
  for (const [name, value] of Object.entries(dialoguePresentationCssVars(profile))) {
    scrim.style.setProperty(name, value);
  }
  scrim.dataset.dialogueScrim = "on";
  if (profile.flash) scrim.dataset.dialogueFlash = "1";
  else delete scrim.dataset.dialogueFlash;
}

function resolveReducedMotion(override: boolean | undefined): boolean {
  if (typeof override === "boolean") return override;
  // prefersReducedMotion() 은 window.matchMedia 를 그대로 부른다. node 환경 테스트와
  // test/fakeDom.ts 처럼 document 만 있는 환경에서 죽지 않게 여기서 가드한다.
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return prefersReducedMotion();
}

/**
 * 연출 상태를 **상자에** 얹는다. 오버레이에 얹으면 안 된다 — resetOverlay() 가
 * className 을 통짜로 덮어쓰기 때문에 조용히 지워진다.
 * CSS 는 [data-dialogue-*] 와 var(--dialogue-*) 로 이 값을 받는다.
 */
function applyDialoguePresentation(box: HTMLElement, profile: DialoguePresentationProfile): void {
  box.dataset.dialogueEmotion = profile.emotion;
  box.dataset.dialogueMotion = profile.motion ? "on" : "off";
  if (profile.shake) box.dataset.dialogueShake = "1";
  if (profile.flash) box.dataset.dialogueFlash = "1";
  if (profile.charReveal) box.dataset.dialogueCharReveal = "1";
  for (const [name, value] of Object.entries(dialoguePresentationCssVars(profile))) {
    box.style.setProperty(name, value);
  }
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

function dialoguePortraitMode(face: FaceGraphic | undefined): "face" | "bust" | "full" {
  if (!face?.resourceId) return "face";
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
  return "face";
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
  if (mode !== "face") {
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
  // 얼굴은 낱장 파일(48×48) 한 장이다 — 상자 크기만 정하고 이미지를 통째로 그린다.
  const style = [
    `--face-url:url("${url}")`,
    `--face-width:${FACE_IMAGE_SIZE}px`,
    `--face-height:${FACE_IMAGE_SIZE}px`,
  ];
  if (face.flipHorizontally) style.push("transform:scaleX(-1)");
  return el("div", {
    class: `dialogue-face dialogue-face-image${face.flipHorizontally ? " flipped" : ""}`,
    attrs: {
      "aria-label": `face ${face.resourceId}`,
      role: "img",
      style: style.join(";"),
    },
    dataset: { testid: "dialogue-face", faceMode: "face" },
  });
}

function safeResourceImageUrl(url: string | null): string | null {
  if (url === null) return null;
  if (/^\/[A-Za-z0-9/_\-.]+\.png$/u.test(url) || /^\/[A-Za-z0-9/_\-.]+\.jpe?g$/u.test(url)) return url;
  if (/^data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/=]+$/u.test(url)) return url;
  return null;
}
