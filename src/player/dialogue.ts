import { playerTextDelay } from '@/player/playerPreferences';
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
  type DialogueTextFx,
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
import { createDialogueVoice } from "@/player/dialogueVoice";
import {
  DIALOGUE_TAG_COLORS,
  isNonBlockingContainer,
  parseDialogueEmotion,
  punctuationPauseMs,
  resolveDialogueLook,
  type DialogueLook,
} from "@/project/dialogueStyles";
import { resolveFontStack } from "@/project/fontRegistry";
import { EMOTE_ASSET_PATH, EMOTE_FRAME_SIZE, emoteFrameIndex, type EmoteKind } from "@/project/emotes";
import { withInlineAsset } from "@/assets/inlineAssetStore";
import { PLAY_RESOLUTION } from "@/player/playResolution";
import type { PlaySessionLike } from "@/project/sessionRuntimeTypes"
import { el, clearChildren } from "@/util/dom";

type DialogueSurfaceSettings = {
  readonly settings?: MessageWindowSettings;
  readonly playerTileY: number;
  readonly mapHeight: number;
  readonly textContext?: DialogueTextContext;
  /**
   * 대화창 스타일·대사 종류·화자 목소리(project/dialogueStyles.ts resolveDialogueLook).
   * 생략하면 프로젝트 기본 스타일 + 화자 이름으로 찾은 프로필을 쓴다.
   */
  readonly look?: DialogueLook;
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
  /**
   * 말하는 캐릭터의 머리 위 한 점(대사 무대의 논리 px). 말풍선·흘림 대사가 여기에 붙는다.
   * 매 프레임 다시 부른다 — 캐릭터가 움직이면 말풍선도 따라간다. 없으면 말풍선은 상자가 된다.
   */
  readonly anchor?: () => { readonly x: number; readonly y: number } | undefined;
  /** 초상 무대가 「같은 화자인가」를 가르는 열쇠. 생략하면 화자 이름. */
  readonly speakerKey?: string;
  /** [소리:id] 태그. 런타임이 효과음을 낸다. */
  readonly onSound?: (soundId: string) => void;
  /** [화면흔들] 태그. 런타임이 카메라를 흔든다(대사 상자는 스스로 흔든다). */
  readonly onScreenShake?: () => void;
  /** 표정의 이모트를 머리 위에 띄운다. */
  readonly onEmote?: (emote: EmoteKind) => void;
};

/** 대화 기록 한 줄. */
export type DialogueLogEntry = {
  readonly speaker?: string;
  readonly color?: string;
  readonly text: string;
  readonly context: string;
};

const DIALOGUE_LOG_LIMIT = 200;
/** 말풍선 본문 폭(논리 px). 넘으면 줄을 바꾸고, 세 줄을 넘으면 상자로 간다. */
const DIALOGUE_BALLOON_TEXT_WIDTH = 150;
const DIALOGUE_BALLOON_MAX_LINES = 3;
const DIALOGUE_BALLOON_EDGE = 4;
const DIALOGUE_BALLOON_TAIL = 7;
/** 위가 모자라 아래로 뒤집을 때 머리 기준점에서 내리는 거리 — 대략 캐릭터 한 명 키. */
const DIALOGUE_BALLOON_BELOW = 38;
const DIALOGUE_MOUTH_FRAME_MS = 120;

/** 대화 기록 키. 한글 입력 상태의 ㅣ 도 받는다. */
export function isDialogueLogKey(key: string): boolean {
  return key === "l" || key === "L" || key === "ㅣ" || key === "PageUp";
}

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
  /** 대화 기록 창. 대화 중에는 L 로도 연다. */
  openLog(): void;
  closeLog(): void;
  /** 이 플레이 세션에서 본 대사(오래된 것부터, 최대 200줄). */
  dialogueLog(): readonly DialogueLogEntry[];
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
      // 대화 세션이 끝났다 — 초상 무대가 기억한 앞 화자를 잊는다.
      lastPortrait = undefined;
      listenerPortrait = undefined;
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

  // ── 대화 기록(백로그) ──────────────────────────────────────────────────────
  // 이 UI 가 살아 있는 동안(한 플레이 세션) 본 대사를 모은다. 저장 파일에는 넣지 않는다.
  const logEntries: DialogueLogEntry[] = [];
  let logPanel: HTMLElement | undefined;
  const recordLog = (request: DialogueTextRequest, look: DialogueLook): void => {
    const text = parseDialogueText(request.body, request.textContext).map((segment) => segment.text).join("").trim();
    if (!text) return;
    const speaker = look.hideName ? undefined : nameplateSpeaker(request.speaker);
    logEntries.push({
      text,
      context: look.context,
      ...(speaker ? { speaker } : {}),
      ...(look.nameColor ? { color: look.nameColor } : {}),
    });
    if (logEntries.length > DIALOGUE_LOG_LIMIT) logEntries.splice(0, logEntries.length - DIALOGUE_LOG_LIMIT);
  };
  const closeLog = (): void => {
    logPanel?.remove();
    logPanel = undefined;
  };
  const openLog = (): void => {
    closeLog();
    const list = el("ol", { class: "dialogue-log-list" });
    for (const entry of logEntries) {
      const item = el("li", {
        class: `dialogue-log-entry${entry.speaker ? "" : " no-speaker"}`,
        dataset: { context: entry.context },
      });
      if (entry.speaker) {
        const name = el("strong", { class: "dialogue-log-speaker", text: entry.speaker });
        if (entry.color) name.style.color = entry.color;
        item.append(name);
      }
      item.append(el("span", { class: "dialogue-log-text", text: entry.text }));
      list.append(item);
    }
    if (logEntries.length === 0) list.append(el("li", { class: "dialogue-log-empty", text: "아직 나눈 대화가 없습니다." }));
    logPanel = el("div", {
      class: "dialogue-log",
      attrs: { role: "dialog", "aria-label": "대화 기록" },
      dataset: { testid: "dialogue-log" },
      children: [
        el("div", { class: "dialogue-log-head", children: [
          el("strong", { text: "대화 기록" }),
          el("span", { text: "L · Esc 닫기 · ↑↓ 넘겨 보기" }),
        ] }),
        list,
      ],
    });
    host.append(logPanel);
    list.scrollTop = list.scrollHeight;
  };
  /** 대화 중 기록 키. 기록이 열려 있으면 다른 키는 삼킨다. 처리했으면 true. */
  const handleLogKey = (e: KeyboardEvent): boolean => {
    if (logPanel) {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (isDialogueLogKey(e.key) || e.key === "Escape") closeLog();
      else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        const list = logPanel.querySelector<HTMLElement>(".dialogue-log-list");
        if (list) list.scrollTop += e.key === "ArrowUp" ? -24 : 24;
      }
      return true;
    }
    if (isDialogueLogKey(e.key)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      openLog();
      return true;
    }
    return false;
  };

  // ── 흘림 대사 · 코너 대사(게임을 멈추지 않는 그릇) ─────────────────────────
  const ambientLayer = el("div", { class: "dialogue-ambient-layer", attrs: { "aria-live": "polite" } });
  const cornerStack = el("div", { class: "dialogue-corner-stack", dataset: { testid: "dialogue-corner-stack" } });
  ambientLayer.append(cornerStack);
  host.append(ambientLayer);
  const activeBarks = new Map<string, () => void>();
  const showAmbient = (request: DialogueTextRequest, look: DialogueLook): void => {
    recordLog(request, look);
    const segments = parseDialogueText(request.body, request.textContext);
    const chars = segments.flatMap((segment) => Array.from(segment.text));
    const lifetime = Math.min(7000, Math.max(2200, 1600 + chars.length * 90));
    const voice = createDialogueVoice(look);
    const body = el("div", { class: "body dialogue-ambient-body" });
    const renderer = mountDialoguePage(body, segments);
    let shown = 0;
    const delay = Math.max(12, DEFAULT_DIALOGUE_CHAR_DELAY_MS * look.delayScale);
    const typer = window.setInterval(() => {
      shown += 1;
      renderer.reveal(shown);
      voice.speak(chars[shown - 1] ?? "");
      if (shown >= chars.length) window.clearInterval(typer);
    }, delay);
    let node: HTMLElement;
    let raf = 0;
    const key = request.speakerKey ?? request.speaker ?? "";
    if (look.container === "corner") {
      const face = look.hideFace ? undefined : request.face;
      node = el("div", {
        class: "dialogue-corner-item",
        dataset: { testid: "dialogue-corner", dialogueStyle: look.style },
      });
      if (face?.resourceId) {
        const faceEl = renderFace({ ...face, presentation: "face", resourceId: look.expressionFace ?? face.resourceId });
        faceEl.classList.add("dialogue-corner-face");
        node.append(faceEl);
      }
      const column = el("div", { class: "dialogue-corner-text" });
      const cornerName = look.hideName ? undefined : nameplateSpeaker(request.speaker);
      if (cornerName) {
        const name = el("strong", { class: "dialogue-corner-name", text: cornerName });
        if (look.nameColor) name.style.color = look.nameColor;
        column.append(name);
      }
      column.append(body);
      node.append(column);
      cornerStack.append(node);
      while (cornerStack.children.length > 3) cornerStack.firstElementChild?.remove();
    } else {
      activeBarks.get(key)?.();
      node = el("div", {
        class: "dialogue-bark",
        dataset: { testid: "dialogue-bark", dialogueStyle: look.style },
        children: [body],
      });
      if (look.nameColor) node.style.setProperty("--dialogue-speaker-color", look.nameColor);
      ambientLayer.append(node);
      const place = (): void => {
        placeBalloonNode(node, request.anchor?.(), host);
        raf = typeof requestAnimationFrame === "function" ? requestAnimationFrame(place) : 0;
      };
      place();
    }
    if (look.emote) request.onEmote?.(look.emote);
    let removed = false;
    const remove = (): void => {
      if (removed) return;
      removed = true;
      window.clearInterval(typer);
      window.clearTimeout(expire);
      if (raf && typeof cancelAnimationFrame === "function") cancelAnimationFrame(raf);
      node.classList.add("is-leaving");
      window.setTimeout(() => node.remove(), 180);
      if (activeBarks.get(key) === remove) activeBarks.delete(key);
    };
    const expire = window.setTimeout(remove, lifetime);
    if (look.container === "bark") activeBarks.set(key, remove);
  };

  // ── 초상 무대: 앞 화자의 초상을 반대쪽에 흐리게 남긴다 ──────────────────────
  // 대화 세션(창이 이어서 열려 있는 동안)에만 기억한다. 퇴장이 끝나면 잊는다.
  let lastPortrait: { readonly key: string; readonly face: FaceGraphic } | undefined;
  let listenerPortrait: { readonly key: string; readonly face: FaceGraphic } | undefined;

  function showText(request: DialogueTextRequest): Promise<void> {
    if (request.signal?.aborted) return Promise.reject(new DOMException("Text cancelled", "AbortError"));
    const requestedLook = request.look ?? resolveDialogueLook(store.getCurrent(), { speaker: request.speaker, emotion: request.emotion });
    if (isNonBlockingContainer(requestedLook.container)) {
      // 흘림·코너 대사는 대사 상자를 건드리지 않고, 기다리지도 않는다.
      showAmbient(request, requestedLook);
      return Promise.resolve();
    }
    const wasOpen = takeOverOverlay();
    return new Promise<void>((resolve, reject) => {
      let settled = false;
      let look = requestedLook;
      // 말풍선은 머리 위 기준점이 있어야 그린다. 없으면(편집기 미리보기·플레이어 이벤트 밖) 상자다.
      let useBalloon = look.container === "balloon" && request.anchor?.() !== undefined;
      recordLog(request, look);
      const speakerKey = request.speaker?.trim() || request.speakerKey || "";
      const profile = dialoguePresentationProfile(request.emotion, {
        reducedMotion: resolveReducedMotion(request.reducedMotion),
      });
      activeExitMs = profile.exitMs;
      let voice = createDialogueVoice(look);
      let box!: HTMLElement;
      let bodyEl!: HTMLElement;
      let cursor!: HTMLElement;
      let faceEl: HTMLElement | undefined;
      let faceForLine: FaceGraphic | undefined;
      let position!: MessageWindowPosition;
      let pages!: ReturnType<typeof paginateDialogueSegments>;
      const segmentsAll = parseDialogueText(request.body, request.textContext);

      const mount = (balloon: boolean): void => {
        box = dialogueBox("", "dialogue-box");
        applyDialogueLook(overlay, box, look);
        position = applyTextSettings(overlay, box, request);
        applyDialoguePresentation(box, profile);
        applyDialogueScrim(scrim, profile, position);
        const baseFace = look.hideFace || balloon ? undefined : request.face;
        faceForLine = baseFace && look.expressionFace ? { ...baseFace, resourceId: look.expressionFace } : baseFace;
        const face = faceForLine;
        const portraitMode = dialoguePortraitMode(face);
        const isPortrait = portraitMode !== "face";
        const content = el("div", {
          class: [
            "dialogue-content",
            face?.position === "right" ? "face-right" : "",
            isPortrait ? "has-bust" : "",
            isPortrait ? `portrait-${portraitMode}` : "",
          ]
            .filter(Boolean)
            .join(" "),
        });
        faceEl = undefined;
        if (face && !isPortrait) {
          faceEl = renderFace(face);
          content.append(faceEl);
        }
        const textColumn = el("div", { class: "dialogue-text-column" });
        bodyEl = el("div", { class: "body" });
        textColumn.append(bodyEl);
        content.append(textColumn);
        box.append(content);
        if (face && isPortrait) {
          // Attach to the message box so left/right tracks the window, not the full screen.
          box.classList.add("has-bust-face", `portrait-${portraitMode}`);
          if (face.position === "right") box.classList.add("bust-right");
          else box.classList.add("bust-left");
          overlay.classList.add("has-bust-face");
          faceEl = renderFace(face);
          box.append(faceEl);
          // 초상 무대: 방금 전 다른 화자의 초상을 반대편에 흐리게 남긴다(듣는 쪽).
          // 같은 화자가 이어 말하면 듣는 쪽은 그대로 남는다.
          if (wasOpen && lastPortrait && lastPortrait.key !== speakerKey) listenerPortrait = lastPortrait;
          else if (!wasOpen || listenerPortrait?.key === speakerKey) listenerPortrait = undefined;
          if (listenerPortrait) {
            const side: FaceGraphic["position"] = face.position === "right" ? "left" : "right";
            const other = renderFace({ ...listenerPortrait.face, position: side });
            other.classList.add("dialogue-portrait-listener");
            other.dataset.testid = "dialogue-portrait-listener";
            box.classList.add("has-portrait-listener");
            box.append(other);
          }
          lastPortrait = { key: speakerKey, face };
        }
        if (balloon) {
          overlay.classList.add("balloon-active");
          box.classList.add("dialogue-balloon");
          box.dataset.testid = "dialogue-box";
          box.dataset.container = "balloon";
        }
        // 화자 이름은 본문과 분리된 네임플레이트로 창 상단에 붙인다 (Fields of Mistria 식).
        let nameplate: HTMLElement | undefined;
        const speakerName = nameplateSpeaker(request.speaker);
        if (speakerName && !look.hideName) {
          box.classList.add("has-speaker");
          nameplate = el("div", {
            class: "speaker speaker-nameplate",
            text: speakerName + look.nameSuffix,
            dataset: { testid: "dialogue-speaker" },
          });
          if (look.nameColor) nameplate.style.setProperty("--dialogue-speaker-color", look.nameColor);
          if (look.emote) nameplate.append(emoteBadge(look.emote));
          box.append(nameplate);
        }
        cursor = el("div", {
          class: "dialogue-page-cursor",
          text: "▼",
          attrs: { "aria-hidden": "true" },
        });
        box.append(cursor);
        // 대화 기록 단추 — 마우스로도 열 수 있게. 키는 L.
        const logButton = el("button", {
          class: "dialogue-log-button",
          text: "기록",
          attrs: { type: "button", "aria-label": "대화 기록 (L)", tabindex: "-1" },
          dataset: { testid: "dialogue-log-button" },
        });
        logButton.addEventListener("click", (event) => {
          event.stopPropagation();
          if (logPanel) closeLog();
          else openLog();
        });
        if (!balloon) box.append(logButton);
        overlay.append(box);
        // 이름표가 본문 첫 줄을 덮지 않게 여백을 재서 심는다. 오버레이에 붙인 **뒤**라야
        // offsetHeight 가 나오고, 줄 수를 세기 **전**이라야 그 줄 수가 실제 본문 칸을 본다.
        if (nameplate && !balloon) reserveSpeakerInset(box, nameplate);
        const measure = createDialogueTextMeasure(bodyEl);
        pages = paginateDialogueSegments(segmentsAll, {
          maxWidth: balloon
            ? DIALOGUE_BALLOON_TEXT_WIDTH
            : dialogueBodyWidth({ ...request, face }, position, logicalHostWidth(host)),
          measure,
          maxLines: balloon ? DIALOGUE_BALLOON_MAX_LINES : dialogueMaxLines(bodyEl),
          fallbackCharWidth: DIALOGUE_FALLBACK_CHAR_WIDTH,
        });
      };

      mount(useBalloon);
      if (useBalloon && pages.length > 1) {
        // 말풍선에 다 안 들어가면 상자로 되돌린다 — 말풍선이 여러 장 넘어가면 읽기 어렵다.
        box.remove();
        overlay.classList.remove("balloon-active");
        useBalloon = false;
        mount(false);
      }
      if (look.emote) request.onEmote?.(look.emote);
      let balloonRaf = 0;
      const placeBalloon = (): void => {
        placeBalloonNode(box, request.anchor?.(), host);
        balloonRaf = typeof requestAnimationFrame === "function" ? requestAnimationFrame(placeBalloon) : 0;
      };
      if (useBalloon) placeBalloon();

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
      // 프로파일 배율은 기본 지연에만 적용한다. \s[n]은 프로파일을 덮어쓰지만
      // 기기별 읽기 속도 배율은 기본 지연과 명시한 속도 양쪽에 적용한다.
      let charDelayMs = playerTextDelay(dialogueScaledCharDelayMs(DEFAULT_DIALOGUE_CHAR_DELAY_MS, profile)) * look.delayScale;
      // [빠르게]·[느리게] 배율. \s[n] 과 곱한다.
      let rateFactor = 1;
      // [넘기기금지] 구간 — 켜져 있으면 키로 남은 글자를 한 번에 채우지 않는다.
      let locked = false;
      let fastMode = false;
      let timer = 0;
      let goldWindow: HTMLElement | undefined;
      // 입 모양: 말하는 동안 평소 얼굴과 입 벌린 얼굴을 번갈아 보인다.
      let mouthTimer = 0;
      let mouthOpen = false;
      let currentFaceId = faceForLine?.resourceId;
      const stopMouth = (): void => {
        if (mouthTimer) window.clearInterval(mouthTimer);
        mouthTimer = 0;
        if (mouthOpen && faceEl && currentFaceId) setFaceImage(faceEl, currentFaceId);
        mouthOpen = false;
      };
      const startMouth = (): void => {
        stopMouth();
        if (!faceEl || !look.talkFace || !currentFaceId || look.instant) return;
        const talk = look.talkFace;
        mouthTimer = window.setInterval(() => {
          mouthOpen = !mouthOpen;
          if (faceEl && currentFaceId) setFaceImage(faceEl, mouthOpen ? talk : currentFaceId);
        }, DIALOGUE_MOUTH_FRAME_MS);
      };
      // 페이지마다 새로 마운트한다. 타이핑은 이 렌더러에 "몇 글자까지" 만 알려주고
      // 이미 붙은 글자 노드는 건드리지 않는다 — 그래야 글자 연출이 되감기지 않는다.
      let pageRenderer: DialoguePageRenderer | undefined;
      // 목소리가 읽을 글자. 토큰은 글자를 들고 있지 않아서 페이지마다 같은 순서로 펼쳐 둔다.
      let pageChars: string[] = [];

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
      const applyExpression = (emotionText: string): void => {
        const emotion = parseDialogueEmotion(emotionText);
        if (!emotion) return;
        const expression = look.expressions?.[emotion];
        look = {
          ...look,
          emotion,
          voicePitch: look.basePitch + (expression?.pitch ?? 0),
          ...(expression?.emote ? { emote: expression.emote } : {}),
        };
        voice = createDialogueVoice(look);
        if (expression?.face && faceEl) {
          currentFaceId = expression.face;
          setFaceImage(faceEl, expression.face);
        }
        box.dataset.dialogueExpression = emotion;
        if (expression?.emote) {
          request.onEmote?.(expression.emote);
          const plate = box.querySelector<HTMLElement>(".speaker-nameplate");
          plate?.querySelector(".dialogue-emote-badge")?.remove();
          plate?.append(emoteBadge(expression.emote));
        }
      };
      // 비트가 실제로 울린 순서를 상자에 남긴다(런타임 QA 가 소리 없는 헤드리스에서 읽는다).
      const noteBeat = (beat: string): void => {
        box.dataset.dialogueBeats = box.dataset.dialogueBeats ? `${box.dataset.dialogueBeats} ${beat}` : beat;
      };
      const beatShake = (): void => {
        request.onScreenShake?.();
        box.classList.remove("dialogue-beat-shake");
        void box.offsetWidth;
        box.classList.add("dialogue-beat-shake");
      };
      const executeControl = (
        control: DialogueTextControl,
        skipWaits: boolean
      ): number | "pause" => {
        switch (control.kind) {
          case "speed":
            charDelayMs = playerTextDelay(dialogueSpeedDelayMs(control.value)) * look.delayScale;
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
          case "rate":
            rateFactor = control.factor;
            return 0;
          case "expression":
            applyExpression(control.emotion);
            return 0;
          case "sound":
            if (!skipWaits) {
              request.onSound?.(control.soundId);
              noteBeat(`sound:${control.soundId}`);
            }
            return 0;
          case "screenShake":
            if (!skipWaits) {
              beatShake();
              noteBeat("screenShake");
            }
            return 0;
          case "lock":
            locked = control.on;
            return 0;
        }
      };
      const markPageReady = (): void => {
        typing = false;
        waitingForControl = false;
        stopMouth();
        const last = pageIndex >= pages.length - 1;
        // ▼ 다음 쪽이 있다 / ■ 이 대사가 끝이다.
        cursor.textContent = last ? "■" : "▼";
        cursor.classList.toggle("is-end", last);
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
            // 넘기기금지 구간 앞에서는 멈추고 거기서부터 다시 흘린다(표지판 같은 즉시 표시는 예외).
            if (token.control.kind === "lock" && token.control.on && !look.instant) {
              locked = true;
              pageRenderer?.reveal(visibleChars);
              timer = window.setTimeout(typeStep, 0);
              return;
            }
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
              stopMouth();
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
            const char = pageChars[visibleChars - 1] ?? "";
            if (!fastMode) voice.speak(char);
            // 구두점 뒤 쉼 — 말의 호흡. 화자 빠르기·기기 읽기 속도를 같이 탄다.
            const pause = look.punctuationPause && !fastMode
              ? playerTextDelay(punctuationPauseMs(char, pageChars[visibleChars])) * look.delayScale
              : 0;
            timer = window.setTimeout(typeStep, fastMode ? 0 : charDelayMs * rateFactor + pause);
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
        cursor.classList.remove("is-end");
        cursor.textContent = "▼";
        pageRenderer = mountDialoguePage(bodyEl, currentSegments());
        pageChars = currentSegments().flatMap((segment) => Array.from(segment.text));
        // 표지판·편지·안내는 흘리지 않고 한 번에 보인다.
        if (look.instant) {
          consumeRemainingPage();
          return;
        }
        startMouth();
        timer = window.setTimeout(typeStep, fastMode ? 0 : charDelayMs);
      };
      const advance = () => {
        if (settled || logPanel) return;
        if (waitingForControl) {
          waitingForControl = false;
          typing = true;
          box.classList.remove("page-ready");
          startMouth();
          timer = window.setTimeout(typeStep, 0);
          return;
        }
        if (typing) {
          if (locked) return;
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
        if (handleLogKey(e)) return;
        if (isDialogueAdvanceKey(e.key)) {
          e.preventDefault();
          e.stopImmediatePropagation();
          advance();
        }
      };
      const cleanup = () => {
        cancelEnter();
        clearTimeout(timer);
        stopMouth();
        if (balloonRaf && typeof cancelAnimationFrame === "function") cancelAnimationFrame(balloonRaf);
        box.removeEventListener("click", advance);
        document.removeEventListener("keydown", onKey);
        request.signal?.removeEventListener("abort", abort);
        if (cancelActiveText === abort) cancelActiveText = undefined;
      };
      const abort = (): void => {
        if (settled) return;
        settled = true;
        cleanup();
        closeLog();
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
      applyDialogueLook(overlay, choicesWindow, request.look ?? resolveDialogueLook(store.getCurrent()));
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
          attrs: { role: "option", type: "button", "data-play-input-owner": "play-ui" },
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
    closeLog();
    lastPortrait = undefined;
    listenerPortrait = undefined;
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
    openLog,
    closeLog,
    dialogueLog: () => [...logEntries],
  };
}

/**
 * 말풍선·흘림 대사를 머리 위 기준점에 붙인다. 화면 가장자리에서 밀려나지 않게 가두고,
 * 위가 모자라면 캐릭터 아래로 내려 꼬리를 위로 뒤집는다. 꼬리 x 는 기준점을 가리킨다.
 * 기준점이 없으면 화면 위 가운데에 둔다(흘림 대사가 사라지지 않게).
 */
function placeBalloonNode(
  node: HTMLElement,
  anchor: { readonly x: number; readonly y: number } | undefined,
  host: HTMLElement,
): void {
  const hostWidth = logicalHostWidth(host);
  const hostHeight = logicalHostHeight(host);
  const width = node.offsetWidth;
  const height = node.offsetHeight;
  const point = anchor ?? { x: hostWidth / 2, y: height + DIALOGUE_BALLOON_TAIL + DIALOGUE_BALLOON_EDGE * 2 };
  const maxLeft = Math.max(DIALOGUE_BALLOON_EDGE, hostWidth - width - DIALOGUE_BALLOON_EDGE);
  const left = Math.min(maxLeft, Math.max(DIALOGUE_BALLOON_EDGE, point.x - width / 2));
  let top = point.y - height - DIALOGUE_BALLOON_TAIL;
  const below = top < DIALOGUE_BALLOON_EDGE;
  if (below) top = Math.min(hostHeight - height - DIALOGUE_BALLOON_EDGE, point.y + DIALOGUE_BALLOON_BELOW);
  node.style.left = `${Math.round(left)}px`;
  node.style.top = `${Math.round(top)}px`;
  node.classList.toggle("tail-up", below);
  node.style.setProperty("--balloon-tail-x", `${Math.round(Math.min(width - 10, Math.max(10, point.x - left)))}px`);
  node.dataset.balloonEdge = left <= DIALOGUE_BALLOON_EDGE ? "left" : left >= maxLeft ? "right" : "";
}

function logicalHostHeight(host: HTMLElement): number {
  if (Number.isFinite(host.clientHeight) && host.clientHeight > 0) return host.clientHeight;
  const inlineHeight = Number.parseFloat(host.style.height);
  if (Number.isFinite(inlineHeight) && inlineHeight > 0) return inlineHeight;
  return PLAY_RESOLUTION.height;
}

/** 얼굴·초상 노드의 그림만 바꾼다(표정·입 모양). renderFace 의 두 모양을 다 받는다. */
function setFaceImage(node: HTMLElement, resourceId: string): void {
  const url = safeResourceImageUrl(resolveAssetResourceUrl(resourceId, { project: store.getCurrent() }));
  if (!url) return;
  if (node.classList.contains("dialogue-face-image")) node.style.setProperty("--face-url", `url("${url}")`);
  else node.style.backgroundImage = `url("${url}")`;
  node.dataset.resourceId = resourceId;
}

/** 이름표 옆 작은 이모트(맵 이모트와 같은 시트). */
function emoteBadge(emote: EmoteKind): HTMLElement {
  return el("span", {
    class: "dialogue-emote-badge",
    attrs: {
      "aria-label": emote,
      role: "img",
      style: `background-image:url("${withInlineAsset(`/${EMOTE_ASSET_PATH}`)}");background-position:-${emoteFrameIndex(emote) * EMOTE_FRAME_SIZE}px 0`,
    },
    dataset: { testid: "dialogue-emote-badge", emote },
  });
}

export function resolveDialogueText(value: string, context?: DialogueTextContext): string {
  return parseDialogueText(value, context).map((segment) => segment.text).join("");
}

export function parseDialogueText(value: string, context?: DialogueTextContext): DialogueTextSegment[] {
  const segments: DialogueTextSegment[] = [];
  let colorIndex = 0;
  let buffer = "";
  let pendingControls: DialogueTextControl[] = [];
  // 본문 태그 상태. [/] 는 가장 최근에 연 태그 하나를 닫는다.
  let fx: DialogueTextFx | undefined;
  let rate = 1;
  const openTags: ({ readonly type: "fx"; readonly previous: DialogueTextFx | undefined }
    | { readonly type: "rate"; readonly previous: number }
    | { readonly type: "lock" })[] = [];
  const push = (includeEmpty = false): void => {
    if (!buffer && !includeEmpty && pendingControls.length === 0) return;
    segments.push({
      text: buffer,
      colorIndex,
      ...(pendingControls.length > 0 ? { controlsBefore: pendingControls } : {}),
      ...(fx ? { fx } : {}),
    });
    buffer = "";
    pendingControls = [];
  };
  const addControl = (control: DialogueTextControl): void => {
    if (buffer) push();
    pendingControls.push(control);
  };
  const openFx = (patch: DialogueTextFx): void => {
    if (buffer) push();
    openTags.push({ type: "fx", previous: fx });
    fx = { ...fx, ...patch };
  };
  const applyTag = (raw: string): boolean => {
    const tag = parseInlineTag(raw);
    if (!tag) return false;
    switch (tag.kind) {
      case "close": {
        const top = openTags.pop();
        if (!top) return true;
        if (top.type === "fx") {
          if (buffer) push();
          fx = top.previous;
        } else if (top.type === "rate") {
          rate = top.previous;
          addControl({ kind: "rate", factor: rate });
        } else {
          addControl({ kind: "lock", on: false });
        }
        return true;
      }
      case "fx":
        openFx(tag.fx);
        return true;
      case "rate":
        openTags.push({ type: "rate", previous: rate });
        rate = tag.factor;
        addControl({ kind: "rate", factor: rate });
        return true;
      case "lock":
        openTags.push({ type: "lock" });
        addControl({ kind: "lock", on: true });
        return true;
      case "control":
        addControl(tag.control);
        return true;
    }
  };
  for (let i = 0; i < value.length; i += 1) {
    const char = value[i];
    if (char === "[") {
      const end = value.indexOf("]", i + 1);
      if (end > i && end - i <= 40 && applyTag(value.slice(i + 1, end))) {
        i = end;
        continue;
      }
    }
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

type ParsedInlineTag =
  | { readonly kind: "close" }
  | { readonly kind: "fx"; readonly fx: DialogueTextFx }
  | { readonly kind: "rate"; readonly factor: number }
  | { readonly kind: "lock" }
  | { readonly kind: "control"; readonly control: DialogueTextControl };

/**
 * 본문 태그 하나(대괄호 안쪽)를 읽는다. 모르는 태그는 undefined — 그대로 글자로 보인다.
 * 목록·예시는 project/dialogueStyles.ts DIALOGUE_INLINE_TAGS 가 정본이다.
 */
function parseInlineTag(raw: string): ParsedInlineTag | undefined {
  const text = raw.trim();
  if (text === "/") return { kind: "close" };
  const colon = text.search(/[:：]/u);
  const name = (colon >= 0 ? text.slice(0, colon) : text).trim().toLowerCase();
  const arg = colon >= 0 ? text.slice(colon + 1).trim() : "";
  switch (name) {
    case "흔들": case "shake": return { kind: "fx", fx: { shake: true } };
    case "물결": case "wave": return { kind: "fx", fx: { wave: true } };
    case "크게": case "big": return { kind: "fx", fx: { size: "big" } };
    case "작게": case "small": return { kind: "fx", fx: { size: "small" } };
    case "색": case "color": {
      const color = DIALOGUE_TAG_COLORS[arg] ?? DIALOGUE_TAG_COLORS[arg.toLowerCase()]
        ?? (/^#[0-9a-f]{6}$/iu.test(arg) ? arg : undefined);
      return color ? { kind: "fx", fx: { color } } : undefined;
    }
    case "쉼": case "pause": {
      const seconds = Number(arg || "0.5");
      if (!Number.isFinite(seconds) || seconds < 0) return undefined;
      return { kind: "control", control: { kind: "wait", ms: Math.round(Math.min(5, seconds) * 1000) } };
    }
    case "빠르게": case "fast": return { kind: "rate", factor: 0.5 };
    case "느리게": case "slow": return { kind: "rate", factor: 2 };
    case "표정": case "face": {
      const emotion = parseDialogueEmotion(arg);
      return emotion ? { kind: "control", control: { kind: "expression", emotion } } : undefined;
    }
    case "소리": case "sound":
      return arg ? { kind: "control", control: { kind: "sound", soundId: arg } } : undefined;
    case "화면흔들": case "screenshake": return { kind: "control", control: { kind: "screenShake" } };
    case "넘기기금지": case "noskip": return { kind: "lock" };
    default: return undefined;
  }
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
    attrs: { "data-play-input-owner": "play-ui" },
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
/**
 * 이름표로 보일 화자. 「내레이션」 같은 서술 표기는 인물이 아니다 — 생성 모델이 서술 줄에 speaker:"내레이션" 을
 * 달아 엔딩 에필로그에 「내레이션」 이름표가 떴다(2026-09-24 추리 도그푸딩). 이름표 없이 서술로 보인다.
 */
const NARRATION_SPEAKER = /^(?:내레이션|나레이션|해설|서술|narration|narrator)$/iu;

export function nameplateSpeaker(speaker: string | undefined): string | undefined {
  const name = speaker?.trim();
  if (!name || NARRATION_SPEAKER.test(name)) return undefined;
  return name;
}

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

/**
 * 대화창 스타일은 **오버레이**에 싣는다 — 대사 상자·선택지·소지금 창이 같은 스킨을 받게.
 * resetOverlay() 는 className 만 덮으므로 dataset 은 창을 열 때마다 여기서 다시 쓴다.
 * 대사 종류(context)는 한 줄의 것이라 **상자**에 싣는다. CSS: src/styles/dialogueStyles.css.
 */
function applyDialogueLook(overlay: HTMLElement, box: HTMLElement, look: DialogueLook): void {
  overlay.dataset.dialogueStyle = look.style;
  box.dataset.dialogueStyle = look.style;
  if (look.context !== "speech") box.dataset.dialogueContext = look.context;
  // 외침은 감정 흔들림과 같은 규칙을 탄다 — 움직임 줄이기 안전망도 그대로 받는다.
  if (look.shake) box.dataset.dialogueShake = "1";
  if (look.font) box.style.setProperty("--runtime-dialogue-font", resolveFontStack(look.font));
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
  if (face.presentation) return face.presentation;
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
  // The resource resolver rebases exported assets, including deployment subpaths.
  // Keep the PNG/JPEG contract and reject characters that escape a quoted CSS URL.
  if (/^https?:\/\//u.test(url) && !/["\\\u0000-\u001f\u007f]/u.test(url)) {
    try {
      if (/\.(?:png|jpe?g)$/u.test(new URL(url).pathname)) return url;
    } catch (error) {
      if (!(error instanceof TypeError)) throw error;
      return null;
    }
  }
  return null;
}
