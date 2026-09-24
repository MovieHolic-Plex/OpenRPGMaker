import { gameOverOutcome, resolveGameOverSettings } from "@/project/cinematicSettings";
import { gameOverName } from "@/project/gameOverLibrary";
import { el } from "@/util/dom";
import { tintDurationMs } from "@/project/eventCommands/tintDuration";
import { store } from "@/project/store";
import { startSession } from "@/project/session";
import { stockEntryPrice } from "@/project/shopStock";
import { shopGreetingText } from "@/project/shopMessages";
import { resolveTerms } from "@/project/terms";
import { shopCatalogRecords } from "./shopEditorModel";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { DEFAULT_BATTLE_FIELD_BACKGROUND_ID } from "@/project/databaseEnemyTroopRecordModel";
import { parseDialogueText } from "@/player/dialogue";
import { resolveDialogueLook, type DialogueLook } from "@/project/dialogueStyles";
import { resolveFontStack } from "@/project/fontRegistry";
import { applySystemWindowSkinVariable } from "@/player/systemGraphics";
import { dialoguePresentationCssVars, dialoguePresentationProfile } from "@/player/dialoguePresentation";
import { prefersReducedMotion } from "@/player/characterLanding";
import type { DialogueTextControl } from "@/player/dialoguePagination";
import { applyDialogueFx } from "@/player/dialogueTextRenderer";
import { preloadRuntimeStyles } from "@/app/runtimeStyles";
import { faceDisplayModeOf, renderFacesetCrop } from "./facesetPreview";
import { SPEAK_SAMPLE_BODY, SPEAK_SAMPLE_SPEAKER } from "@/editor/eventCommands/quickAuthoringDefaults";
import {
  actorBattleM2Preview,
  equipmentStage,
  expGaugeStage,
  levelGaugeStage,
  partyChipStage,
  recoverAllGaugeStage,
  vitalGaugeStage,
  type ActorBattlePreviewDeps,
} from "./commandPreviewActorBattle";
import { drawTransferFallback, drawTransferMapPreview } from "./transferMapPreview";
import { cameraControlStage as mapScreenCameraStage, changeTileChipStage } from "./commandPreviewMapScreen";
import { initialBadge } from "./recordPicker";
import { m2CommandById } from "@/project/eventCommands/m2Catalog";
import { pictureSlotCaption } from "./options";
import { commandLabel } from "./commandPicker";
import { commandSummaryParts, isSummaryIconPart } from "./commandSummary";
import { textBodyOf } from "@/project/io/rewriteLegacyDialogue";
import { planScreenEffect } from "@/player/interpreter/screenEffectPlan";
import { clampMs } from "@/player/interpreter/commandCatalog";
import { isRecognizedTintValue, isVisibleTint, parseTintColor, rgbaToCss } from "@/player/screen/tintModel";
import { formatVariableFormula } from "./commandBodyVariable";
import { previewAudio } from "./previewAudio";
import { previewForkFlow } from "./previewForkFlow";
import { previewMoveRoute } from "./previewMoveRoute";
import { previewPicture } from "./previewPicture";
import {
  playShowAnimationOnce,
  renderShowAnimationFallback,
  renderShowAnimationFrame,
  showAnimationPlaybackSource,
} from "./showAnimationPlayback";
import { graphicForPatternPreview } from "./commandBodyAdvanced";
import { renderEventGraphicPreview } from "./eventGraphicPreview";
import { decodeCharsetFrameIndex } from "@/assets/easyrpgRtp";
import type { Command } from "@/project/types";
import type { ActiveFace, PreviewSimState } from "./previewSimulation";
import { getSimSwitch, getSimVariable, getSimItem } from "./previewSimulation";

const PREVIEW_FACE_SIZE = 96;
/** 게임 대사창의 얼굴 칸(논리 px). `--runtime-dialogue-face-size` 와 같다. */
const RUNTIME_FACE_SIZE = 48;

export type CommandPreviewContext = {
  readonly face?: ActiveFace;
  readonly simState?: PreviewSimState;
  readonly hostEventId?: string;
  readonly forkTaken?: "then" | "else" | "unknown";
  readonly skipped?: boolean;
  /**
   * 「말투·연출」 진입 연출을 프리뷰에서 한 번 재생한다. 호출부가 **연출이 바뀐 순간에만**
   * 켠다 — 프리뷰는 본문을 한 글자 칠 때마다 다시 그려지므로, 늘 켜 두면 창이
   * 타자마다 튀어 글을 쓸 수 없다.
   */
  readonly replayPresentation?: boolean;
};

// 명령 편집 모달 우측 "이미지 리치" 프리뷰 패널. staged command 를 받아 종류별 시각화를
// 렌더한다. 전용 렌더러가 없으면 요약 카드로 폴백한다(패널이 비어 보이지 않게).
export function renderCommandPreview(cmd: Command, context?: CommandPreviewContext): HTMLElement {
  void preloadRuntimeStyles();
  const visual = renderVisual(cmd, context);
  const summaryOnly = visual.classList.contains("ecp-summary-card");
  const panel = el("div", {
    class: summaryOnly ? "event-command-preview ecp-summary-only" : "event-command-preview",
    dataset: { testid: "event-command-preview-body", previewKind: cmd.kind },
  });
  if (context?.skipped) panel.classList.add("ecp-skipped");
  panel.append(el("div", { class: "ecp-caption", text: commandPreviewCaption(cmd) }));
  panel.append(visual);
  return panel;
}

function commandPreviewCaption(cmd: Command): string {
  if (cmd.kind === "m2Command") {
    return m2CommandById(cmd.commandId)?.label ?? cmd.commandId;
  }
  return commandLabel(cmd.kind);
}

function renderVisual(cmd: Command, context?: CommandPreviewContext): HTMLElement {
  if (cmd.kind === "m2Command") {
    const title = m2CommandById(cmd.commandId)?.title;
    if (title === "Screen Effect") return screenEffectStage(cmd);
    if (title === "Camera Control") return mapScreenCameraStage(cmd);
    // 레거시 RM 화면 행도 같은 무대에 서다 — 토큰 요약 카드로 내밀지 않는다.
    const legacy = legacyScreenEffectCommand(cmd, title);
    if (legacy) return screenEffectStage(legacy);
  }
  const handler = visualPreviewHandlers[cmd.kind] as VisualPreviewHandler<Command> | undefined;
  return handler ? handler(cmd, context) : summaryCard(cmd, context);
}

type VisualPreviewHandler<T extends Command> = (cmd: T, context?: CommandPreviewContext) => HTMLElement;
type VisualPreviewHandlers = {
  readonly [K in Command["kind"]]?: VisualPreviewHandler<Extract<Command, { kind: K }>>;
};

const visualPreviewHandlers: VisualPreviewHandlers = {
  text: (cmd, context) =>
    messageWindowMock(cmd.speaker, textBodyOf(cmd), context?.face, {
      emotion: cmd.emotion,
      replay: context?.replayPresentation === true,
      simState: context?.simState,
      look: resolveDialogueLook(store.getCurrent(), { speaker: cmd.speaker, style: cmd.style, context: cmd.context, container: cmd.container, emotion: cmd.emotion }),
    }),
  changeFace: faceStage,
  displayTextSettings: settingsMessageMock,
  choices: choicesMock,
  inputNumber: inputNumberStage,
  transfer: transferStage,
  moveEvent: previewMoveRoute,
  setEventGraphicPattern: patternStage,
  fork: (cmd, ctx) => previewForkFlow(cmd, ctx),
  showPicture: previewPicture,
  playAudio: previewAudio,
  stopAudio: previewAudio,
  changeItem: (cmd, ctx) => itemStage(cmd, ctx),
  shop: shopStage,
  inn: innStage,
  changeParty: (cmd, ctx) => partyChipStage(cmd, previewDeps(ctx)),
  changeActorHp: (cmd) => vitalGaugeStage(cmd, "hp"),
  changeActorMp: (cmd) => vitalGaugeStage(cmd, "mp"),
  changeLevel: levelGaugeStage,
  recoverAll: recoverAllGaugeStage,
  changeEquipment: (cmd, ctx) => equipmentStage(cmd, previewDeps(ctx)),
  addFollower: (cmd) => screenMock(cmd.name || cmd.actorId || "FOLLOWER", "title"),
  removeFollower: (cmd) => screenMock(cmd.all === true ? "FOLLOWERS OFF" : "FOLLOWER OFF", "title"),
  setLighting: lightingStage,
  addLight: lightSourceStage,
  removeLight: removeLightStage,
  setWeather: weatherStage,
  showAnimation: animationStage,
  playMovie: movieStage,
  erasePicture: erasePictureStage,
  changeTile: changeTileChipStage,
  inputWait: inputWaitStage,
  changeGold: (cmd, ctx) => goldStage(cmd, ctx),
  openChest: storageChestStage,
  changeExp: (cmd, ctx) => expGaugeStage(cmd, previewDeps(ctx)),
  learnSkill: skillStage,
  battleProcessing: battleStage,
  setSwitch: (cmd, ctx) => lampStage(switchName(cmd.switchId), resolveSwitchDisplay(cmd, ctx), ctx?.simState ? getSimSwitch(ctx.simState, cmd.switchId) : undefined),
  setVariable: variableStage,
  setSelfSwitch: (cmd) => lampStage(`이 이벤트 기억 ${cmd.key}`, cmd.value),
  setFlag: (cmd, ctx) => lampStage(cmd.flag || "플래그", cmd.value, ctx?.simState ? getSimSwitch(ctx.simState, cmd.flag) : undefined),
  checkpointSave: (cmd) => screenMock(cmd.label ? `체크포인트: ${cmd.label}` : "체크포인트 저장", "title"),
  killPlayer: gameOverStage,
  triggerEnding: (cmd) => screenMock(cmd.endingId || "ENDING", "ending"),
  gameOver: gameOverStage,
  returnToTitle: () => screenMock("타이틀 화면", "title"),
  ending: (cmd) => screenMock(cmd.title || "THE END", "ending"),
  openSaveMenu: () => screenMock("저장", "title"),
  wait: waitStage,
  m2Command: m2VisualPreview,
};

function m2VisualPreview(cmd: Extract<Command, { kind: "m2Command" }>, context?: CommandPreviewContext): HTMLElement {
  if (cmd.commandId === "m2-025-change-actor-faceset") {
    return m2Preview(cmd, context);
  }
  if (cmd.commandId === "m2-209-advanced-dialogue") {
    const fields = cmd.fields ?? {};
    const speaker = String(fields.speaker ?? "").trim();
    return messageWindowMock(speaker || undefined, String(fields.body ?? ""), context?.face, {
      replay: false,
      simState: context?.simState,
    });
  }
  const title = m2CommandById(cmd.commandId)?.title;
  const actorSurface = actorBattleM2Preview(cmd, title, previewDeps(context));
  if (actorSurface) return actorSurface;
  if (title === "Open Save Menu") return screenMock("저장", "title");
  if (title === "Game Over") return screenMock("GAME OVER", "gameover");
  if (title === "Return to Title Screen") return screenMock("타이틀 화면", "title");
  return summaryCard(cmd, context);
}

/**
 * 프리뷰 창에 런타임과 같은 연출 상태를 얹는다. 키프레임 이름과 감정별 매핑은 CSS 가
 * 갖고 있고 프리뷰는 그 규칙을 그대로 재사용한다 — `dialogue.css` 는 에디터 CSS 그래프에도
 * 들어 있다(`styles/index.css` → `runtime/index.css` → `../dialogue.css`, 2026-09-11 Task 7 이후).
 * 그래서 여기서는 dataset 과 변수만 심고 곡선은 손대지 않는다.
 * `test/dialoguePreviewPresentationCss.test.ts` 가 두 선택자 집합이 어긋나지 않게 잠근다.
 */
function applyPreviewPresentation(win: HTMLElement, emotion: string | undefined, replay: boolean): void {
  const profile = dialoguePresentationProfile(emotion, {
    reducedMotion: typeof window !== "undefined" && typeof window.matchMedia === "function" && prefersReducedMotion(),
  });
  win.dataset.dialogueEmotion = profile.emotion;
  win.dataset.dialogueMotion = profile.motion ? "on" : "off";
  for (const [name, value] of Object.entries(dialoguePresentationCssVars(profile))) {
    win.style.setProperty(name, value);
  }
  // phase 는 재생 요청이 있을 때만 심는다. 없으면 규칙이 안 걸려 정착 상태로 그려진다.
  if (replay) win.dataset.dialoguePhase = "enter";
}

/**
 * 런타임 규격 무대. 대사·선택지 창은 게임(`player/dialogue.ts` + `styles/dialogue.css`)과
 * **같은 클래스**로 320×240 논리 화면 안에 그리고, 무대 폭에 맞춰 통째로 축소한다
 * (`.ecp-runtime-viewport` 의 `transform: scale(tan(atan2(100cqw, 320px)))`).
 *
 * 왜 (실측 2026-09-17): 예전 프리뷰는 자기 폰트(13px Malgun)·자기 패딩(10/12px)·자기 폭으로
 * 창을 그렸다. 같은 대사가 게임에선 3줄, 다이얼로그 프리뷰에선 4줄, 인스펙터에선 5줄로
 * 꺾였고 「최대 4줄」 안내가 잘못된 폭을 기준으로 판정됐다. 게임 창은 논리 300px 폭에
 * 9px 글자다 — 그 비율을 그대로 축소해야 줄바꿈이 맞는다. 이 무대의 시각 규칙은 전부
 * dialogue.css 가 소유하고, 여기서는 구조와 축소만 담당한다.
 */
function runtimeStage(overlayClass: string): { readonly frame: HTMLElement; readonly stage: HTMLElement; readonly overlay: HTMLElement } {
  const frame = el("div", { class: "ecp-runtime-frame" });
  const stage = el("div", {
    class: "ecp-stage ecp-stage-runtime",
    dataset: { testid: "ecp-runtime-stage" },
    attrs: { "aria-label": "게임 화면 320×240 을 축소한 무대" },
  });
  const viewport = el("div", { class: "ecp-runtime-viewport", attrs: { "aria-hidden": "true" } });
  const overlay = el("div", { class: `dialogue-overlay ${overlayClass}` });
  viewport.append(overlay);
  stage.append(viewport);
  frame.append(stage);
  return { frame, stage, overlay };
}

function messageWindowMock(
  speaker: string | undefined,
  body: string,
  face?: CommandPreviewContext["face"],
  presentation?: {
    readonly emotion?: string;
    readonly replay: boolean;
    readonly simState?: PreviewSimState;
    /** 대화창 스타일·대사 종류·화자 프로필을 합친 결과. 게임과 같은 data-* 를 심는다. */
    readonly look?: DialogueLook;
  }
): HTMLElement {
  const { frame, overlay } = runtimeStage("position-bottom");
  const look = presentation?.look;
  if (look?.hideFace) face = undefined;
  // 말하기 무대: 빈 본문이어도 게임 창에 샘플 대사가 보인다. "..." 만 남기지 않는다.
  // 얼굴은 빌려 오지 않는다 — 이 명령엔 얼굴이 없으므로 게임에서도 얼굴 없이 뜬다.
  const authored = body.trim().length > 0;
  const shownBody = authored ? body : SPEAK_SAMPLE_BODY;
  const rawSpeaker = (speaker?.trim() ?? "") || (authored ? "" : SPEAK_SAMPLE_SPEAKER);
  const speakerName = look?.hideName || !rawSpeaker ? "" : rawSpeaker + (look?.nameSuffix ?? "");
  const faceRight = face?.position === "right";
  const win = el("div", {
    class: [
      "dialogue-box",
      "ecp-message-window",
      "page-ready",
      face ? "with-face" : "",
      faceRight ? "face-right" : "",
      speakerName ? "has-speaker" : "",
    ]
      .filter(Boolean)
      .join(" "),
    dataset: { testid: "ecp-message-window", ...(authored ? {} : { sample: "true" }) },
  });
  applySystemWindowSkinVariable(win);
  if (look) applyPreviewDialogueLook(overlay, win, look);
  if (presentation) applyPreviewPresentation(win, presentation.emotion, presentation.replay);
  // 런타임과 같은 골격: .dialogue-content > [.dialogue-face] + .dialogue-text-column > .body
  const content = el("div", { class: "dialogue-content ecp-message-content" + (faceRight ? " face-right" : "") });
  if (face) {
    const slot = el("div", { class: "dialogue-face ecp-message-face" });
    slot.append(renderFacesetCrop({ ...face, displaySize: RUNTIME_FACE_SIZE }));
    content.append(slot);
  }
  const textCol = el("div", { class: "dialogue-text-column" });
  textCol.append(renderPreviewDialogueBody(shownBody, presentation?.simState));
  content.append(textCol);
  win.append(content);
  // 화자 네임플레이트는 창 밖(상단 가장자리)에 올려 본문과 시각적으로 분리한다.
  if (speakerName) {
    const nameplate = el("div", {
      class: "speaker speaker-nameplate ecp-message-speaker ecp-message-speaker-nameplate",
      text: speakerName,
      dataset: { testid: "ecp-message-speaker" },
    });
    if (look?.nameColor) nameplate.style.setProperty("--dialogue-speaker-color", look.nameColor);
    win.append(nameplate);
  }
  win.append(el("div", { class: "dialogue-page-cursor", text: "▼", attrs: { "aria-hidden": "true" } }));
  overlay.append(win);
  if (look && look.container !== "box") stageDialogueContainer(overlay, win, look, speakerName, shownBody, presentation?.simState);
  if (!authored) {
    frame.append(
      el("div", {
        class: "ecp-message-sample-note",
        dataset: { testid: "ecp-message-sample-note" },
        text: "샘플 대사 — 본문을 쓰면 이 창에 그대로 들어갑니다",
      })
    );
  }
  return frame;
}

/**
 * 대화창 그릇 견본 — 말풍선은 무대 위 인물 머리 위에, 흘림·코너는 게임과 같은 비차단 층에 그린다.
 * 인물은 칸 크기 자리표시로만 둔다(견본이 맵을 그리지는 않는다).
 */
function stageDialogueContainer(
  overlay: HTMLElement,
  win: HTMLElement,
  look: DialogueLook,
  speakerName: string,
  body: string,
  simState?: PreviewSimState,
): void {
  const viewport = overlay.parentElement;
  if (!viewport) return;
  overlay.dataset.container = look.container;
  const actor = el("div", { class: "ecp-container-actor", attrs: { "aria-hidden": "true" } });
  if (look.container === "balloon") {
    overlay.classList.add("balloon-active");
    win.classList.add("dialogue-balloon");
    // 인물 머리(top 206) 위 꼬리 7px — 높이를 모르니 아래 변으로 붙인다. 자료집 견본은 무대 아래 띠만
    // 보여 주므로(320×92) 말풍선·흘림도 그 안에 들게 화면 아래쪽 인물에 붙인다.
    win.style.left = "92px";
    win.style.bottom = "41px";
    win.style.setProperty("--balloon-tail-x", "58px");
    viewport.append(actor);
    return;
  }
  win.remove();
  const layer = el("div", { class: "dialogue-ambient-layer" });
  const text = renderPreviewDialogueBody(body, simState);
  if (look.container === "bark") {
    const bark = el("div", { class: "dialogue-bark", dataset: { dialogueStyle: look.style }, children: [text] });
    bark.style.left = "104px";
    bark.style.bottom = "41px";
    bark.style.setProperty("--balloon-tail-x", "46px");
    layer.append(bark);
    viewport.append(actor);
  } else {
    const column = el("div", { class: "dialogue-corner-text" });
    if (speakerName) {
      const name = el("strong", { class: "dialogue-corner-name", text: speakerName });
      if (look.nameColor) name.style.color = look.nameColor;
      column.append(name);
    }
    column.append(text);
    layer.append(el("div", {
      class: "dialogue-corner-stack",
      children: [el("div", { class: "dialogue-corner-item", dataset: { dialogueStyle: look.style }, children: [column] })],
    }));
  }
  viewport.append(layer);
}

/** 런타임 applyDialogueLook(player/dialogue.ts) 과 같은 자리에 같은 값을 심는다. */
function applyPreviewDialogueLook(overlay: HTMLElement, win: HTMLElement, look: DialogueLook): void {
  overlay.dataset.dialogueStyle = look.style;
  win.dataset.dialogueStyle = look.style;
  if (look.context !== "speech") win.dataset.dialogueContext = look.context;
  if (look.font) win.style.setProperty("--runtime-dialogue-font", resolveFontStack(look.font));
}

/**
 * 자료집(시스템 「대화창」·캐릭터 「대화」)이 쓰는 견본 창. 명령 프리뷰와 같은 무대·같은 규칙이라
 * 여기서 보이는 모양이 곧 게임 모양이다.
 */
export function renderDialogueLookSample(speaker: string, body: string, look: DialogueLook): HTMLElement {
  void preloadRuntimeStyles();
  return messageWindowMock(speaker, body, undefined, { replay: false, look });
}

/** Resolve RM control codes the same way play-mode dialogue does (editor preview). */
function renderPreviewDialogueBody(body: string, simState?: PreviewSimState): HTMLElement {
  const project = store.getCurrent();
  const variableDefaults: Record<string, number> = {};
  for (const entry of project.variables ?? []) {
    variableDefaults[entry.id] = 0;
  }
  for (let i = 1; i <= 20; i += 1) {
    const id = "var_" + String(i).padStart(4, "0");
    if (variableDefaults[id] === undefined) variableDefaults[id] = 0;
  }
  const segments = parseDialogueText(body || "...", {
    session: { variables: { ...variableDefaults, ...simState?.variables }, actorNames: {} },
    project,
  });
  const bodyEl = el("div", {
    class: "body ecp-message-body",
    dataset: { testid: "ecp-message-body" },
  });
  let wrote = false;
  for (const segment of segments) {
    for (const control of segment.controlsBefore ?? []) {
      bodyEl.append(renderPreviewControlBadge(control));
      wrote = true;
    }
    if (!segment.text) continue;
    wrote = true;
    if (segment.fx) {
      // 본문 태그 — 게임과 같은 클래스. 흔들·물결은 글자마다 쪼개야 transform 이 먹는다.
      const perChar = segment.fx.shake || segment.fx.wave;
      const pieces = perChar ? Array.from(segment.text) : [segment.text];
      pieces.forEach((piece, index) => {
        const span = el("span", {
          class: segment.colorIndex ? "dialogue-color dialogue-color-" + String(segment.colorIndex) : "",
          text: piece,
        });
        applyDialogueFx(span, segment.fx, index);
        bodyEl.append(span);
      });
      continue;
    }
    if (segment.colorIndex === 0) {
      bodyEl.append(document.createTextNode(segment.text));
      continue;
    }
    bodyEl.append(
      el("span", {
        class: "dialogue-color dialogue-color-" + String(segment.colorIndex),
        text: segment.text,
      })
    );
  }
  if (!wrote) {
    bodyEl.append(document.createTextNode(body.trim() ? "" : "..."));
  }
  return bodyEl;
}

/** Render each zero-width control exactly where it occurs in the authored sentence. */
function renderPreviewControlBadge(control: DialogueTextControl): HTMLElement {
  let key: string;
  let label: string;
  let glyph = "";
  switch (control.kind) {
    case "pause":
      key = "pause";
      label = "키 입력 대기";
      glyph = "!";
      break;
    case "wait":
      key = control.ms === 250 ? "wait-quarter" : control.ms === 1000 ? "wait-second" : `wait-${control.ms}`;
      label = control.ms === 250 ? "1/4초 지연" : control.ms === 1000 ? "1초 지연" : `${control.ms}ms 지연`;
      glyph = control.ms === 250 ? "." : control.ms === 1000 ? "|" : "";
      break;
    case "gold":
      key = "gold";
      label = "소지금 창 · 0 G";
      glyph = "$";
      break;
    case "fastOn":
      key = "fast-on";
      label = "즉시 표시 시작";
      glyph = ">";
      break;
    case "fastOff":
      key = "fast-off";
      label = "즉시 표시 끝";
      glyph = "<";
      break;
    case "autoClose":
      key = "skip-wait";
      label = "입력 대기 없이 닫기";
      glyph = "^";
      break;
    case "halfSpace":
      key = "space";
      label = "반각 공백";
      glyph = "_";
      break;
    case "speed":
      key = "speed";
      label = `표시 속도 ${control.value}`;
      glyph = "s";
      break;
    case "rate":
      key = "rate";
      label = control.factor < 1 ? "빠르게" : "느리게";
      break;
    case "expression":
      key = "expression";
      label = `표정 ${control.emotion}`;
      break;
    case "sound":
      key = "sound";
      label = `소리 ${control.soundId}`;
      break;
    case "screenShake":
      key = "screen-shake";
      label = "화면흔들";
      break;
    case "lock":
      key = control.on ? "lock-on" : "lock-off";
      label = control.on ? "넘기기금지" : "넘기기 허용";
      break;
  }
  return el("span", {
    class: "ecp-message-control-badge ecp-message-inline-control",
    text: glyph ? `${label} ${glyph}` : label,
    dataset: { testid: "ecp-message-control-" + key, controlKind: control.kind },
    attrs: { title: glyph ? `\\${glyph}` : label },
  });
}


function faceStage(cmd: Extract<Command, { kind: "changeFace" }>): HTMLElement {
  // Play mock: face graphic as it will appear next to dialogue — not the editor label card.
  const mode = faceDisplayModeOf(cmd.resourceId);
  const whole = mode !== "chip";
  const side = cmd.position === "right" ? "right" : "left";
  const stage = el("div", {
    class: `ecp-stage ecp-face-stage${whole ? " ecp-face-stage-bust" : ""} ecp-face-pos-${side}`,
  });
  const win = el("div", {
    class: [
      "ecp-message-window",
      "with-face",
      "ecp-face-message",
      side === "right" ? "face-right" : "face-left",
      whole ? "with-bust" : "",
      whole ? `with-${mode}` : "",
    ]
      .filter(Boolean)
      .join(" "),
    dataset: { testid: "ecp-message-window" },
  });
  if (whole) {
    const portrait = renderFacesetCrop({
      resourceId: cmd.resourceId,
      flipHorizontally: cmd.flipHorizontally,
      displaySize: mode === "full" ? 160 : 140,
      position: side,
    });
    portrait.classList.add(`ecp-portrait-${side}`);
    stage.append(portrait);
    win.append(
      el("div", {
        class: "ecp-message-text",
        children: [
          el("div", {
            class: "ecp-message-body",
            text: mode === "full" ? "대사 창 위에\n전신이 표시됩니다." : "대사 창 위에\n흉상이 표시됩니다.",
          }),
        ],
      })
    );
  } else {
    win.append(
      renderFacesetCrop({
        resourceId: cmd.resourceId,
        flipHorizontally: cmd.flipHorizontally,
        displaySize: PREVIEW_FACE_SIZE,
        position: side,
      }),
      el("div", {
        class: "ecp-message-text",
        children: [
          el("div", {
            class: "ecp-message-body",
            text: "대사 창에\n이 얼굴이 표시됩니다.",
          }),
        ],
      })
    );
  }
  stage.append(win);
  const sideLabel = side === "right" ? "오른쪽" : "왼쪽";
  stage.append(
    el("div", {
      class: "ecp-face-caption",
      text: whole
        ? `${sideLabel} · ${mode === "full" ? "전신" : "흉상"}${cmd.flipHorizontally ? " · 좌우 반전" : ""}`
        : `${sideLabel} · 얼굴${cmd.flipHorizontally ? " · 좌우 반전" : ""}`,
      dataset: { testid: "ecp-face-caption" },
    })
  );
  return stage;
}

function patternStage(cmd: Extract<Command, { kind: "setEventGraphicPattern" }>): HTMLElement {
  const stage = el("div", {
    class: "ecp-stage ecp-pattern-stage",
    dataset: { testid: "ecp-pattern-stage" },
  });
  const graphic = graphicForPatternPreview(cmd.eventId, cmd.pattern);
  const sprite = renderEventGraphicPreview(graphic);
  sprite.classList.add("ecp-pattern-sprite");
  sprite.dataset.testid = "ecp-pattern-sprite";
  const decoded = decodeCharsetFrameIndex(cmd.pattern);
  const targetLabel = cmd.eventId?.trim() || "이 이벤트";
  const patternName = ["왼쪽", "가운데", "오른쪽"][decoded.pattern] ?? String(decoded.pattern);
  stage.append(
    el("div", {
      class: "ecp-pattern-stage-inner",
      children: [
        sprite,
        el("div", {
          class: "ecp-pattern-caption",
          dataset: { testid: "ecp-pattern-caption" },
          children: [
            el("div", { class: "ecp-pattern-caption-title", text: targetLabel }),
            el("div", {
              class: "ecp-pattern-caption-meta",
              text: `방향 ${patternDirectionLabel(decoded.direction)} · 패턴 ${patternName}`,
            }),
          ],
        }),
      ],
    })
  );
  return stage;
}

function patternDirectionLabel(direction: "up" | "right" | "down" | "left"): string {
  switch (direction) {
    case "up":
      return "위";
    case "right":
      return "오른쪽";
    case "down":
      return "아래";
    case "left":
      return "왼쪽";
  }
}

function settingsMessageMock(cmd: Extract<Command, { kind: "displayTextSettings" }>): HTMLElement {
  const transparent = cmd.format === "transparent";
  const stage = el("div", {
    class: `ecp-stage pos-${cmd.position}`,
    dataset: { testid: "ecp-settings-stage" },
  });
  // 플레이어 위치를 무대 중앙에 두고, 가림 방지 시 창이 플레이어를 피한 느낌을 준다.
  stage.append(el("div", { class: "ecp-player-pawn", attrs: { title: "플레이어" }, text: "★" }));
  const win = el("div", {
    class: `ecp-message-window${transparent ? " transparent" : ""} has-speaker`,
    dataset: { testid: "ecp-message-window" },
  });
  win.append(
    el("div", {
      class: "ecp-message-body",
      text: transparent
        ? "투명 창으로 표시됩니다.\n배경 없이 글자만 보입니다."
        : "일반 창으로 표시됩니다.\n이후 문장 표시에 적용됩니다.",
    }),
    el("div", {
      class: "ecp-message-speaker ecp-message-speaker-nameplate",
      text: "미리보기",
      dataset: { testid: "ecp-message-speaker" },
    })
  );
  stage.append(win);

  const badges = el("div", { class: "ecp-settings-badges", dataset: { testid: "ecp-settings-badges" } });
  badges.append(el("span", { class: "ecp-move-badge", text: transparent ? "투명" : "일반" }));
  badges.append(el("span", { class: "ecp-move-badge", text: positionLabel(cmd.position) }));
  badges.append(
    el("span", {
      class: `ecp-move-badge${cmd.preventObscuringPlayer ? "" : " off"}`,
      text: cmd.preventObscuringPlayer ? "가림 방지 켜짐" : "가림 방지 꺼짐",
    })
  );
  badges.append(
    el("span", {
      class: `ecp-move-badge${cmd.allowEventMovementDuringWait ? "" : " off"}`,
      text: cmd.allowEventMovementDuringWait ? "이벤트 이동 허용" : "이벤트 이동 정지",
    })
  );

  const wrap = el("div", { class: "ecp-settings-preview" });
  wrap.append(stage, badges);
  return wrap;
}

function choicesMock(cmd: Extract<Command, { kind: "choices" }>): HTMLElement {
  // 게임의 선택지 창(`.dialogue-overlay.choices-active > .dialogue-box.choices > .choice-list`)
  // 과 같은 골격. 첫 항목이 커서(◆)를 가진 채 뜨는 것도 게임 시작 상태 그대로다.
  const { frame, overlay } = runtimeStage("position-bottom choices-active");
  const win = el("div", { class: "dialogue-box choices ecp-message-window ecp-choice-window" });
  applySystemWindowSkinVariable(win);
  const list = el("div", { class: "choice-list" });
  const prompt = cmd.prompt?.trim();
  if (prompt) list.append(el("div", { class: "choice-prompt-row ecp-message-body", text: prompt }));
  const options = cmd.options.filter((option) => option.text.trim().length > 0);
  options.forEach((option, index) =>
    list.append(
      el("div", {
        class: "choice-btn ecp-choice" + (index === 0 ? " selected" : ""),
        text: option.text || `선택지 ${index + 1}`,
      })
    )
  );
  if (options.length === 0) list.append(el("div", { class: "choice-btn ecp-choice empty", text: "선택지 없음" }));
  win.append(list);
  overlay.append(win);
  if (cmd.cancelBehavior && cmd.cancelBehavior !== "disallow") {
    // 취소 결과는 게임 화면에 없는 정보다 — 무대 밖 캡션으로 둔다(창 테두리를 타지 않게).
    frame.append(
      el("div", {
        class: "ecp-face-caption",
        text: `취소 → ${choiceCancelCaption(cmd.cancelBehavior)}`,
      })
    );
  }
  return frame;
}


function choiceCancelCaption(behavior: NonNullable<Extract<Command, { kind: "choices" }>["cancelBehavior"]>): string {
  if (behavior === "branch") return "취소 분기";
  return `선택지 ${behavior.slice("choice".length)}`;
}

/** 숫자 입력 — System.png fill 금지. 플레이 시작 시 빈 슬롯 + 커서 상태를 보여 준다. */
function inputNumberStage(cmd: Extract<Command, { kind: "inputNumber" }>): HTMLElement {
  const digits = Math.max(1, Math.min(6, Math.trunc(cmd.digits) || 1));
  const title = cmd.prompt?.trim() || "숫자 입력";
  const stage = el("div", { class: "ecp-stage ecp-number-stage" });
  const win = el("div", {
    class: "ecp-number-window ecp-number-window-clean",
    dataset: { testid: "ecp-number-window" },
  });
  win.append(el("div", { class: "ecp-number-title", text: title }));

  const slots = el("div", {
    class: "ecp-number-slots",
    dataset: { testid: "ecp-number-slots" },
  });
  // Honest idle preview: empty slots with cursor on the first digit.
  for (let i = 0; i < digits; i += 1) {
    slots.append(
      el("div", {
        class: `ecp-number-slot empty${i === 0 ? " cursor" : ""}`,
        text: "",
        attrs: { "aria-hidden": "true" },
      })
    );
  }
  win.append(slots);

  if (cmd.showPad) {
    const pad = el("div", { class: "ecp-number-pad", dataset: { testid: "ecp-number-pad" } });
    for (const key of ["1", "2", "3", "4", "5", "6", "7", "8", "9", "←", "0", "OK"] as const) {
      pad.append(
        el("div", {
          class: `ecp-number-pad-key${key === "OK" ? " ok" : ""}${key === "←" ? " back" : ""}`,
          text: key,
        })
      );
    }
    win.append(pad);
  } else {
    win.append(
      el("div", {
        class: "ecp-number-ok-mock",
        text: "OK",
        dataset: { testid: "ecp-number-ok-mock" },
      })
    );
  }

  // 변수 표시명이 자리수 미리보기를 삼키지 않게, 자리수·상태와 변수 칩을 분리한다.
  win.append(
    el("div", {
      class: "ecp-number-meta",
      dataset: { testid: "ecp-number-meta" },
      children: [
        el("span", {
          class: "ecp-number-meta-digits",
          dataset: { testid: "ecp-number-digit-count" },
          text: `${digits}자리 · 대기 중`,
        }),
        el("span", {
          class: "ecp-number-meta-variable",
          dataset: { testid: "ecp-number-variable" },
          attrs: { title: `변수 ${variablePreviewName(cmd.variableId)}` },
          text: `변수 ${variablePreviewName(cmd.variableId)}`,
        }),
      ],
    })
  );
  stage.append(win);
  return stage;
}

function variablePreviewName(variableId: string): string {
  if (!variableId) return "(미선택)";
  const project = store.getCurrent();
  const index = project.variables.findIndex((entry) => entry.id === variableId);
  if (index < 0) return variableId;
  const name = project.variables[index]?.name?.trim();
  return name || "(이름 없음)";
}

function transferStage(cmd: Extract<Command, { kind: "transfer" }>): HTMLElement {
  const stage = el("div", { class: "ecp-stage ecp-map-stage" });
  const project = store.getCurrent();
  const map = project.maps[cmd.mapId];
  if (!map) {
    stage.append(missingCard("맵을 찾을 수 없습니다"));
    return stage;
  }
  const canvas = document.createElement("canvas");
  canvas.className = "ecp-map-canvas";
  canvas.dataset.testid = "ecp-transfer-canvas";
  stage.append(canvas);
  const selection = { x: cmd.x, y: cmd.y, zoom: fitZoom(map.width * map.tileSize) };
  // Canvas 2D 를 지원하는 환경(실제 브라우저)에서만 그린다. 노드/fakeDom 은 캡션만 표시.
  // 비동기 그리기: 이 canvas 가 아직 DOM 에 붙어 있을 때만 반영(stale draw 방지).
  if (typeof canvas.getContext === "function") {
    drawTransferMapPreview({ canvas, project, mapId: cmd.mapId, selection, isCurrent: () => canvas.isConnected }).catch(() => {
      try {
        drawTransferFallback({ canvas, map, selection });
      } catch {
        /* 캔버스 미지원 환경 — 무시 */
      }
    });
  }
  stage.append(el("div", { class: "ecp-map-caption", text: `${map.name || cmd.mapId} (${cmd.x}, ${cmd.y})` }));
  return stage;
}

function itemStage(cmd: Extract<Command, { kind: "changeItem" }>, context?: CommandPreviewContext): HTMLElement {
  const project = store.getCurrent();
  const record = project.database.items.find((item) => item.id === cmd.itemId);
  const stage = el("div", { class: "ecp-icon-stage" });
  stage.append(el("div", { class: "ecp-hero-icon", children: [heroIcon(record?.iconResourceId ?? record?.imageResourceId, record?.name ?? cmd.itemId, 48)] }));
  stage.append(el("div", { class: "ecp-icon-name", text: record?.name ?? (cmd.itemId || "(아이템 선택)") }));
  const amountText = typeof cmd.amount === "number"
    ? String(cmd.amount) + "개"
    : ("변수 " + (cmd.amount.id || "?"));
  stage.append(el("div", { class: "ecp-op-strip", text: cmd.op + " " + amountText }));
  if (context?.simState) {
    const curCount = getSimItem(context.simState, cmd.itemId);
    stage.append(el("div", { class: "ecp-current-state", text: `현재 보유: ${curCount}개` }));
  }
  return stage;
}

function storageChestStage(cmd: Extract<Command, { kind: "openChest" }>): HTMLElement {
  const shared = Boolean(cmd.chestId?.trim());
  const title = cmd.displayName?.trim() || (cmd.template === "farm" ? "농장 상자" : cmd.template === "warehouse" ? "공동 창고" : cmd.template === "vault" ? "금고" : "보관 상자");
  const stage = el("div", {
    class: "ecp-storage-chest-stage",
    dataset: { testid: "open-chest-preview" },
  });
  stage.append(
    el("div", {
      class: "ecp-storage-chest-heading",
      children: [
        el("strong", { text: "플레이 화면 예시" }),
        el("span", { text: title }),
        el("span", { text: shared ? "여러 상자 공유" : "이 상자 전용" }),
        ...(cmd.template || cmd.layout ? [el("span", { text: [cmd.template, cmd.layout].filter(Boolean).join(" · ") })] : []),
      ],
    }),
    el("div", {
      class: "ecp-storage-chest-columns",
      children: [
        storagePreviewPane("가방 · 소지품", ["회복약 ×3", "해독초 ×1"]),
        el("div", {
          class: "ecp-storage-chest-transfer",
          attrs: { "aria-hidden": "true" },
          children: [
            el("span", { text: "넣기 →" }),
            el("span", { text: "← 꺼내기" }),
          ],
        }),
        storagePreviewPane("보관 상자", ["철광석 ×5", "빈 칸"]),
      ],
    }),
    el("div", {
      class: "ecp-storage-chest-note",
      text: "선택한 아이템을 한 개씩 넣거나 꺼냅니다.",
    }),
  );
  return stage;
}

function storagePreviewPane(title: string, rows: readonly string[]): HTMLElement {
  return el("div", {
    class: "ecp-storage-chest-pane",
    children: [
      el("strong", { text: title }),
      ...rows.map((row, index) => el("span", {
        class: `ecp-storage-chest-item${row === "빈 칸" ? " empty" : ""}${index === 0 ? " selected" : ""}`,
        text: row,
      })),
    ],
  });
}


function innStage(cmd: Extract<Command, { kind: "inn" }>): HTMLElement {
  const price = typeof cmd.price === "number" ? Math.max(0, Math.trunc(cmd.price) || 0) : 0;
  const priceDisplay = typeof cmd.price === "number" ? price : `변수 ${(cmd.price as { id: string }).id}`;
  const recoverMp = cmd.recoverMp !== false;
  const stage = el("div", { class: "ecp-stage ecp-inn-stage", dataset: { testid: "ecp-inn-stage" } });
  const win = el("div", { class: "ecp-inn-window", dataset: { testid: "ecp-inn-window" } });
  const note = cmd.note?.trim() || "어서 오세요. 편히 쉬어가시겠어요?";
  const question =
    cmd.question?.trim() ||
    (price <= 0
      ? "하룻밤 묵으시겠습니까? (무료)"
      : `하룻밤 묵는 데 ${price.toLocaleString("ko-KR")} G 입니다. 묵으시겠습니까?`);
  const recoverLabel = recoverMp ? "전원 회복" : "HP만 회복";
  const chips: string[] = [
    typeof cmd.price !== "number" ? `${priceDisplay} G · ${recoverLabel} · 변수` : price <= 0 ? `무료 숙박 · ${recoverLabel}` : `${priceDisplay} G · ${recoverLabel}`,
  ];
  if (cmd.advanceToMorning) chips.push("아침 이동");
  if (cmd.branchOnNotEnoughGold) chips.push("부족 분기");
  win.append(
    el("div", { class: "ecp-inn-title", text: "여관" }),
    el("div", { class: "ecp-inn-note", text: note }),
    el("div", { class: "ecp-inn-question", text: question }),
    el("div", {
      class: "ecp-inn-actions",
      children: [
        el("span", { class: "ecp-inn-choice selected", text: "예" }),
        el("span", { class: "ecp-inn-choice", text: "아니오" }),
      ],
    }),
    el("div", {
      class: "ecp-inn-price-chip",
      text: chips.join(" · "),
    })
  );
  stage.append(win);
  return stage;
}

function shopStage(cmd: Extract<Command, { kind: "shop" }>): HTMLElement {
  const project = store.getCurrent();
  const previewSeason = project.system.timeSystem?.enabled ? startSession(project).gameTime?.season : undefined;
  // System.png border-image fill 을 쓰면 하단 팔레트 스트립(0123456789)이
  // 미리보기 전체를 덮어 "배경이 깨진" 것처럼 보인다. 상점 프리뷰는 솔리드 창으로 둔다.
  const win = el("div", { class: "ecp-shop-window ecp-shop-window-clean", dataset: { testid: "ecp-shop-window" } });
  const shopType =
    cmd.shopType === "buyOnly" ? "구매 전용" : cmd.shopType === "sellOnly" ? "판매 전용" : "구매/판매";
  const message = shopGreetingText(cmd.messageType, resolveTerms(project));
  const merchantGold = typeof cmd.merchantGold === "number" && Number.isFinite(cmd.merchantGold)
    ? Math.max(0, Math.floor(cmd.merchantGold))
    : 100;
  win.append(
    el("div", {
      class: "ecp-shop-title",
      text: `상점 · ${cmd.itemIds.length}개 · ${shopType}`,
    }),
    el("div", { class: "ecp-shop-message", text: message }),
    el("div", {
      class: "ecp-shop-merchant-gold",
      dataset: { testid: "ecp-shop-merchant-gold" },
      text: `상인의 매입 예산 ${merchantGold.toLocaleString("ko-KR")} G`,
    })
  );
  if (cmd.itemIds.length === 0) {
    win.append(
      el("div", {
        class: "ecp-shop-empty-warn",
        dataset: { testid: "ecp-shop-empty-warn" },
        text: "상품 없음 — 판매 목록을 추가하세요",
      })
    );
  }
  const list = el("div", { class: "ecp-shop-item-list" });
  const catalog = new Map(shopCatalogRecords(project).map((record) => [record.id, record]));
  for (const id of cmd.itemIds.slice(0, 8)) {
    const record = catalog.get(id);
    const stock = cmd.stock?.find((entry) => entry.itemId === id);
    const name = record?.name ?? "찾을 수 없는 상품";
    const priceValue = record ? (stock ? stockEntryPrice(stock, previewSeason) : undefined) ?? record.price : undefined;
    const hasSeasonPrice = Boolean(stock?.priceBySeason && previewSeason && stock.priceBySeason[previewSeason] !== undefined);
    const price = priceValue === undefined ? "—" : `${priceValue.toLocaleString("ko-KR")} G${hasSeasonPrice ? ` · ${previewSeason}` : ""}`;
    list.append(
      el("div", {
        class: "ecp-shop-item-row",
        attrs: { title: record?.description?.trim() || name },
        children: [
          el("div", {
            class: "ecp-shop-item-icon",
            children: [heroIcon(record?.iconResourceId ?? record?.imageResourceId, name, 22)],
          }),
          el("span", { class: "ecp-shop-item-name", text: name }),
          el("span", { class: "ecp-shop-item-price", text: price }),
        ],
      })
    );
  }
  if (cmd.itemIds.length === 0) {
    list.append(el("div", { class: "ecp-shop-item-empty", text: "상품 없음" }));
  } else if (cmd.itemIds.length > 8) {
    list.append(el("div", { class: "ecp-shop-item-more", text: `외 ${cmd.itemIds.length - 8}개…` }));
  }
  win.append(list);
  win.append(el("p", { class: "ecp-shop-branch-note", text: "진열 구성 · 기본 판매 가격 미리보기" }));
  if (cmd.branchOnTransaction) {
    win.append(el("div", { class: "ecp-shop-branch-note", text: "거래 후 분기 있음" }));
  }
  const stage = el("div", { class: "ecp-stage ecp-shop-stage" });
  stage.append(win);
  return stage;
}

function goldStage(cmd: Extract<Command, { kind: "changeGold" }>, context?: CommandPreviewContext): HTMLElement {
  const stage = el("div", { class: "ecp-icon-stage" });
  stage.append(el("div", { class: "ecp-gold-badge", text: "G" }));
  const amountText = typeof cmd.amount === "number"
    ? String(cmd.amount)
    : ("변수 " + (cmd.amount.id || "?"));
  stage.append(el("div", { class: "ecp-op-strip", text: "소지금 " + cmd.op + " " + amountText }));
  if (context?.simState) {
    stage.append(el("div", { class: "ecp-current-state", text: `현재 소지금: ${context.simState.gold} G` }));
  }
  return stage;
}

function skillStage(cmd: Extract<Command, { kind: "learnSkill" }>): HTMLElement {
  const project = store.getCurrent();
  const stage = el("div", { class: "ecp-icon-stage" });
  const targetLabel = !cmd.actorId || cmd.actorId === "party" || cmd.actorId === "all"
    ? "파티 전체"
    : (project.database.actors.find((actor) => actor.id === cmd.actorId)?.name ?? (cmd.actorId || "(주인공 선택)"));
  const skillName = project.database.skills.find((skill) => skill.id === cmd.skillId)?.name ?? (cmd.skillId || "(스킬 선택)");
  const verb = cmd.action === "forget" ? "망각" : "습득";
  stage.append(el("div", { class: "ecp-skill-badge", text: "SK" }));
  stage.append(el("div", { class: "ecp-icon-name", text: targetLabel }));
  stage.append(el("div", { class: "ecp-op-strip", text: `${verb} ${skillName}` }));
  return stage;
}

function battleStage(cmd: Extract<Command, { kind: "battleProcessing" }>): HTMLElement {
  const project = store.getCurrent();
  const troop = cmd.troopSource === "variable"
    ? undefined
    : project.database.troops.find((entry) => entry.id === cmd.troopId);
  const stage = el("div", {
    class: "ecp-icon-stage ecp-battle-stage",
    dataset: { testid: "ecp-battle-stage" },
  });

  // 전투 배경 + 적 스프라이트 미니 전장 — 검 아이콘만 보이던 빈 프리뷰 대체.
  const field = el("div", { class: "ecp-battle-field", dataset: { testid: "ecp-battle-field" } });
  // System2 is gauge chrome — never a battle field. Match resolveBattleBackdrop fallback.
  const backdropId = troop?.previewBackgroundResourceId ?? DEFAULT_BATTLE_FIELD_BACKGROUND_ID;
  const backdropUrl = resolveAssetResourceUrl(backdropId, { project });
  if (backdropUrl) {
    field.style.backgroundImage = `linear-gradient(180deg, rgba(8,12,24,0.15), rgba(8,12,24,0.45)), url("${backdropUrl.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}")`;
    field.style.backgroundSize = "cover";
    field.style.backgroundPosition = "center";
  }

  const enemyIds =
    troop?.members && troop.members.length > 0
      ? troop.members.map((member) => member.enemyId)
      : (troop?.enemyIds ?? []);
  const row = el("div", { class: "ecp-battle-enemies" });
  const shown = enemyIds.slice(0, 4);
  if (cmd.troopSource === "variable") {
    row.append(el("div", {
      class: "ecp-battle-enemy-fallback",
      text: "VAR",
      attrs: { title: `변수 ${cmd.troopVariableId || "?"}` },
    }));
  } else if (shown.length === 0) {
    // 번 검 아이콘은 적을 보여 주지 않는다 — 뭐가 비었는지 말하는 경고가 들어간다.
    row.append(el("div", {
      class: "ecp-battle-enemy-missing",
      dataset: { testid: "ecp-battle-enemy-missing" },
      text: troop ? "이 적 그룹에 몬스터가 없습니다" : "적 그룹을 고르세요",
    }));
  } else {
    for (const enemyId of shown) {
      const enemy = project.database.enemies.find((entry) => entry.id === enemyId);
      const url = resolveAssetResourceUrl(enemy?.monsterResourceId, { project });
      if (url) {
        row.append(
          el("img", {
            class: "ecp-battle-enemy",
            attrs: {
              src: url,
              alt: enemy?.name ?? enemyId,
              title: enemy?.name ?? enemyId,
              draggable: "false",
            },
          }),
        );
      } else {
        row.append(el("div", { class: "ecp-battle-enemy-fallback", text: (enemy?.name ?? "?").slice(0, 2) }));
      }
    }
    if (enemyIds.length > 4) {
      row.append(el("div", { class: "ecp-battle-enemy-fallback", text: `+${enemyIds.length - 4}` }));
    }
  }
  field.append(row);

  const title = cmd.troopSource === "variable"
    ? `변수 ${cmd.troopVariableId || "?"}`
    : (troop?.name ?? (cmd.troopId || "(적 그룹 선택)"));
  // 트룹은 카드다 — 전장·몬스터 아트·이름이 한 단지로 보인다.
  const card = el("div", {
    class: "ecp-troop-card",
    dataset: {
      testid: "ecp-troop-card",
      troopId: cmd.troopSource === "variable" ? "" : (cmd.troopId ?? ""),
      enemyCount: String(shown.length),
    },
    children: [
      field,
      el("div", { class: "ecp-troop-card-name", dataset: { testid: "ecp-troop-card-name" }, text: title }),
    ],
  });
  stage.append(card);

  const rewards = battleRewardSummary(project, enemyIds);
  if (rewards) {
    stage.append(el("div", {
      class: "ecp-battle-rewards",
      dataset: { testid: "ecp-battle-rewards" },
      text: rewards,
    }));
  }

  const badges = el("div", { class: "ecp-move-badges" });
  badges.append(el("span", { class: "ecp-move-badge", text: cmd.canEscape ? "도망 가능" : "도망 불가" }));
  badges.append(el("span", { class: "ecp-move-badge", text: cmd.canLose ? "패배 허용" : "패배=게임오버" }));
  if (cmd.battleFlow) {
    badges.append(el("span", {
      class: "ecp-move-badge",
      text: cmd.battleFlow === "strict" ? "엄격 턴제" : "게이지",
    }));
  }
  if (cmd.branchOnResult) {
    badges.append(el("span", { class: "ecp-move-badge", text: "결과 분기" }));
  }
  if (shown.length > 0 && cmd.troopSource !== "variable") {
    const names = shown
      .map((id) => project.database.enemies.find((e) => e.id === id)?.name ?? id)
      .slice(0, 3)
      .join(" · ");
    badges.append(el("span", { class: "ecp-move-badge", text: names }));
  }
  stage.append(badges);

  if (!cmd.troopId && cmd.troopSource !== "variable") {
    stage.append(el("div", {
      class: "ecp-battle-empty-warn",
      dataset: { testid: "ecp-battle-empty-warn" },
      text: "적 그룹 필요",
    }));
  } else {
    stage.append(el("div", {
      class: "ecp-battle-result-note",
      text: "확인 시 전투 시작 → battleResult 저장",
    }));
  }
  return stage;
}

function battleRewardSummary(
  project: ReturnType<typeof store.getCurrent>,
  enemyIds: readonly string[]
): string {
  let exp = 0;
  let gold = 0;
  const drops: string[] = [];
  for (const enemyId of enemyIds) {
    const enemy = project.database.enemies.find((entry) => entry.id === enemyId);
    if (!enemy) continue;
    exp += enemy.rewards.exp ?? 0;
    gold += enemy.rewards.gold ?? 0;
    if (enemy.rewards.dropItemId) {
      const item = project.database.items.find((entry) => entry.id === enemy.rewards.dropItemId);
      const label = item?.name ?? enemy.rewards.dropItemId;
      if (!drops.includes(label)) drops.push(label);
    }
  }
  const parts: string[] = [];
  if (exp > 0) parts.push(`EXP ${exp}`);
  if (gold > 0) parts.push(`Gold ${gold}`);
  if (drops.length > 0) parts.push(`드롭 ${drops.slice(0, 2).join(" · ")}`);
  return parts.join(" · ");
}

function lampStage(name: string, value: boolean, currentValue?: boolean): HTMLElement {
  const stage = el("div", { class: "ecp-icon-stage" });
  stage.append(el("div", { class: `ecp-lamp ${value ? "on" : "off"}`, text: value ? "켜짐" : "꺼짐" }));
  stage.append(el("div", { class: "ecp-icon-name", text: name }));
  if (currentValue !== undefined) {
    stage.append(el("div", { class: "ecp-current-state", text: `현재: ${currentValue ? "켜짐" : "꺼짐"}` }));
  }
  return stage;
}

function variableStage(cmd: Extract<Command, { kind: "setVariable" }>, context?: CommandPreviewContext): HTMLElement {
  const stage = el("div", { class: "ecp-stage ecp-variable-stage" });
  const card = el("div", {
    class: "ecp-variable-card",
    dataset: { testid: "ecp-variable-card" },
  });
  card.append(el("div", { class: "ecp-variable-title", text: "변수 조작" }));
  card.append(
    el("div", {
      class: "ecp-variable-formula",
      dataset: { testid: "ecp-variable-formula" },
      text: formatVariableFormula(cmd),
    })
  );
  const sourceLabel = typeof cmd.value === "number" ? "숫자" : "변수";
  const metaParts = [`값은 ${sourceLabel} · 정수 연산`];
  if (context?.simState) {
    const curVal = getSimVariable(context.simState, cmd.variableId);
    metaParts.unshift(`현재 값: ${curVal}`);
  }
  card.append(
    el("div", {
      class: "ecp-variable-meta",
      dataset: { testid: "ecp-variable-meta" },
      text: metaParts.join(" · "),
    })
  );
  stage.append(card);
  return stage;
}

function resolveSwitchDisplay(cmd: Extract<Command, { kind: "setSwitch" }>, context?: CommandPreviewContext): boolean {
  if (cmd.value === "toggle") {
    if (context?.simState) return !getSimSwitch(context.simState, cmd.switchId);
    return false;
  }
  if (typeof cmd.value === "object" && cmd.value !== null && cmd.value.kind === "var") {
    if (context?.simState) return getSimVariable(context.simState, cmd.value.id) !== 0;
    return false;
  }
  return cmd.value as boolean;
}

/** A configuration summary; full timed playback lives in the database editor. */
function gameOverStage(cmd: Extract<Command, { kind: "gameOver" | "killPlayer" }>): HTMLElement {
  const project = store.getCurrent(), settings = resolveGameOverSettings(project.system, cmd.gameOverId);
  const outcome = gameOverOutcome(settings);
  const result = { menu: "재시도 · 타이틀 선택", recover: "파티 회복 · 장소 귀환", title: "타이틀 자동 복귀" }[outcome];
  const name = gameOverName(project, cmd.gameOverId ?? project.system.defaultGameOverId);
  const message = (cmd.kind === "killPlayer" ? cmd.message : undefined) ?? settings?.message;
  return el("div", { class: "ecp-game-over-summary", children: [
    el("small", { text: "선택한 게임 오버" }),
    el("strong", { text: name }),
    el("p", { text: outcome === "menu" ? settings?.title ?? "게임 오버" : message ?? "패배 후 진행" }),
    ...(outcome === "menu" && message ? [el("p", { text: message })] : []),
    el("span", { text: result }),
    el("small", { text: "전체 연출은 자료집의 게임 오버 탭에서 미리볼 수 있습니다." }),
  ] });
}

function screenMock(text: string, variant: "gameover" | "title" | "ending"): HTMLElement {
  const stage = el("div", { class: "ecp-stage" });
  stage.append(el("div", { class: `ecp-result-screen ${variant}`, text }));
  return stage;
}

function summaryCard(cmd: Command, context?: CommandPreviewContext): HTMLElement {
  const card = el("div", { class: "ecp-summary-card ecp-runtime-effect-card", dataset: { testid: "ecp-runtime-effect" } });
  card.append(el("div", { class: "ecp-runtime-effect-title", text: "미리보기" }));
  const line = el("div", { class: "ecp-summary-line" });
  for (const part of commandSummaryParts(cmd)) {
    if (isSummaryIconPart(part)) {
      const url = resolveIconUrl(part.resourceId);
      if (url) line.append(el("img", { class: "ecp-summary-icon", attrs: { src: url, alt: "", width: "16", height: "16" } }));
      continue;
    }
    line.append(el("span", { class: `ecp-token ${part.tone}`, text: part.text }));
  }
  card.append(line);
  if (context?.simState) {
    const effectDesc = describeRuntimeEffect(cmd, context.simState, context.hostEventId);
    if (effectDesc) {
      card.append(el("div", { class: "ecp-runtime-effect-detail", text: effectDesc }));
    }
  }
  if (context?.skipped) {
    card.classList.add("ecp-skipped");
    card.append(el("div", { class: "ecp-skipped-badge", text: "실행되지 않는 분기" }));
  }
  return card;
}

/** 동료·전투 저작면 프리뷰가 쓰는 공용 헬퍼 묶음. */
function previewDeps(context?: CommandPreviewContext): ActorBattlePreviewDeps {
  return {
    icon: heroIcon,
    variableName: variablePreviewName,
    simPartyActorIds: context?.simState?.partyActorIds,
  };
}

function heroIcon(resourceId: string | undefined, name: string, size: number): HTMLElement {
  const url = resolveIconUrl(resourceId);
  if (url) return el("img", { class: "ecp-hero-img", attrs: { src: url, alt: "", width: String(size), height: String(size), draggable: "false" } });
  return initialBadge(name);
}

function resolveIconUrl(resourceId: string | undefined): string | null {
  return resolveAssetResourceUrl(resourceId, { project: store.getCurrent() });
}

function missingCard(text: string): HTMLElement {
  return el("div", { class: "ecp-missing-card", text });
}

function positionLabel(position: "top" | "center" | "bottom"): string {
  switch (position) {
    case "top":
      return "상단";
    case "center":
      return "중앙";
    case "bottom":
      return "하단";
  }
}

function fitZoom(pxWidth: number): number {
  if (pxWidth <= 0) return 1;
  return Math.max(0.15, Math.min(2, 260 / pxWidth));
}

/** 대기 — 타임라인이다. 같은 초를 두 번 쓴 요약 카드가 아니다. */
function waitStage(cmd: Extract<Command, { kind: "wait" }>): HTMLElement {
  const stage = el("div", { class: "ecp-stage ecp-wait-stage", dataset: { testid: "ecp-wait-stage" } });
  const variableId = cmd.variableId?.trim();
  const seconds = Math.max(0, cmd.ms) / 1000;
  const spanLabel = variableId
    ? `변수 ${variablePreviewName(variableId)} 값`
    : `${seconds.toFixed(cmd.ms % 1000 === 0 ? 0 : 1)}초`;
  stage.append(waitTimeline(spanLabel, variableId ? null : seconds));
  return stage;
}

/**
 * 이전 명령 → 대기 구간 → 다음 명령. 대기 길이는 구간의 폭으로도 보인다.
 * 고정 시간이면 눈금(초)을 얹고, 변수면 길이가 정해지지 않았음을 그대로 말한다.
 */
function waitTimeline(spanLabel: string, seconds: number | null): HTMLElement {
  const rail = el("div", { class: "ecp-wait-rail", attrs: { "aria-hidden": "true" } });
  const span = el("div", {
    class: `ecp-wait-span${seconds === null ? " is-variable" : ""}`,
    dataset: { testid: "ecp-wait-span" },
  });
  // 0.1초 = 최소 폭, 3초 = 꽉 찬 폭. 변수 대기는 절반 폭 점선으로 둔다.
  span.style.setProperty("--wait-span", seconds === null ? "50%" : `${Math.max(12, Math.min(100, (seconds / 3) * 100))}%`);
  span.append(el("span", { class: "ecp-wait-span-label", text: spanLabel }));
  rail.append(
    el("div", { class: "ecp-wait-node is-before", children: [el("span", { text: "이전 명령" })] }),
    span,
    el("div", { class: "ecp-wait-node is-after", children: [el("span", { text: "다음 명령" })] })
  );
  const ticks = el("div", { class: "ecp-wait-ticks", dataset: { testid: "ecp-wait-ticks" } });
  if (seconds === null) {
    ticks.append(el("span", { class: "ecp-wait-tick", text: "길이는 실행할 때 정해집니다" }));
  } else {
    for (const tick of [0, 1, 2, 3]) {
      ticks.append(
        el("span", {
          class: `ecp-wait-tick${seconds >= tick && tick > 0 ? " is-passed" : ""}`,
          text: `${tick}s`,
        })
      );
    }
  }
  return el("div", {
    class: "ecp-wait-timeline",
    dataset: { testid: "ecp-wait-timeline" },
    children: [rail, ticks],
  });
}

function switchName(id: string): string {
  const project = store.getCurrent();
  const index = project.switches.findIndex((entry) => entry.id === id);
  if (index >= 0) return project.switches[index]?.name || `스위치 ${index + 1}`;
  return id || "스위치";
}

function lightingStage(cmd: Extract<Command, { kind: "setLighting" }>): HTMLElement {
  const ambient = Math.max(0, Math.min(1, Number(cmd.ambient) || 0));
  const pct = Math.round(ambient * 100);
  const stage = el("div", {
    class: "ecp-stage ecp-lighting-stage",
    dataset: { testid: "ecp-lighting-stage" },
  });
  const screen = el("div", { class: "ecp-fx-screen ecp-lighting-screen" });
  const overlay = el("div", { class: "ecp-lighting-overlay" });
  // ambient 0 = fully dark overlay, ambient 1 = no darkening
  overlay.style.opacity = String(1 - ambient);
  if (cmd.color) overlay.style.background = cmd.color;
  screen.append(overlay);
  screen.append(el("div", { class: "ecp-fx-label", text: `어둠 ${100 - pct}%` }));
  stage.append(screen);
  const meta: string[] = [`밝기 ${pct}%`];
  if (cmd.transitionMs) meta.push(`${cmd.transitionMs}ms`);
  stage.append(el("div", { class: "ecp-fx-caption", text: meta.join(" · ") }));
  return stage;
}

function lightSourceStage(cmd: Extract<Command, { kind: "addLight" }>): HTMLElement {
  const stage = el("div", {
    class: "ecp-stage ecp-light-source-stage",
    dataset: { testid: "ecp-light-source-stage" },
  });
  const screen = el("div", { class: "ecp-fx-screen ecp-light-source-screen" });
  const glow = el("div", { class: "ecp-light-glow" });
  const radius = Math.max(1, Number(cmd.source.radius) || 4);
  const intensity = Math.max(0.2, Math.min(1, Number(cmd.source.intensity ?? 1)));
  glow.style.width = `${Math.min(80, 18 + radius * 8)}%`;
  glow.style.height = glow.style.width;
  glow.style.opacity = String(0.35 + intensity * 0.55);
  if (cmd.source.color) {
    glow.style.background = `radial-gradient(circle, ${cmd.source.color} 0%, transparent 70%)`;
  }
  screen.append(glow);
  screen.append(el("div", { class: "ecp-fx-label", text: cmd.source.id || "빛" }));
  stage.append(screen);
  stage.append(
    el("div", {
      class: "ecp-fx-caption",
      text: `${lightAnchorPreview(cmd.source.at)} · r${radius}`,
    })
  );
  return stage;
}

function removeLightStage(cmd: Extract<Command, { kind: "removeLight" }>): HTMLElement {
  const stage = el("div", {
    class: "ecp-stage ecp-light-source-stage ecp-light-source-off",
    dataset: { testid: "ecp-remove-light-stage" },
  });
  const screen = el("div", { class: "ecp-fx-screen ecp-light-source-screen" });
  screen.append(el("div", { class: "ecp-light-glow off" }));
  screen.append(
    el("div", {
      class: "ecp-fx-label",
      text: cmd.all === true ? "빛 모두 끄기" : "빛 끄기",
    })
  );
  stage.append(screen);
  stage.append(
    el("div", {
      class: "ecp-fx-caption",
      text: cmd.all === true ? "빛 모두 끄기" : cmd.id || "빛 없음",
    })
  );
  return stage;
}


function m2Field(cmd: Extract<Command, { kind: "m2Command" }>, key: string, fallback: string): string {
  const value = cmd.fields?.[key];
  if (typeof value === "string" && value.trim()) return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
}

/**
 * 레거시 RM 화면 행(색조·플래시·숨기기·표시·날씨 효과)을 모던 `Screen Effect` 무대의
 * 필드로 옮긴다. 같은 일을 하는 행이 다른 모양으로 보이거나, 서로 다른 진상을
 * 이야기하면 작가가 어떤 행을 골러도 믿지 못한다. 흔들기(Shake)는 오버레이 한 장으로
 * 재현할 수 없으니 여기서 다루지 않는다(상상만 그리는 무대는 또 다른 거짓말이다).
 */
function legacyScreenEffectCommand(
  cmd: Extract<Command, { kind: "m2Command" }>,
  title: string | undefined
): Extract<Command, { kind: "m2Command" }> | undefined {
  const fields = ((): { readonly effect: string; readonly value: string; readonly durationMs: number } | undefined => {
    switch (title) {
      case "Tint Screen":
        return {
          effect: "tint",
          value: m2Field(cmd, "value", "") || m2Field(cmd, "color", "neutral"),
          durationMs: tintDurationMs(cmd.fields),
        };
      case "Flash Screen":
        return {
          effect: "flash",
          // 레거시 `value` 기본값은 "flash" 라는 하나마나한 문자다 — 색은 `color` 가 진짜다.
          value: m2Field(cmd, "color", "white"),
          durationMs: Number(m2Field(cmd, "durationMs", "300")),
        };
      case "Hide Screen":
        return { effect: "fadeOut", value: "", durationMs: Number(m2Field(cmd, "durationMs", "300")) };
      case "Show Screen":
        return { effect: "fadeIn", value: "", durationMs: Number(m2Field(cmd, "durationMs", "300")) };
      case "Set Weather Effects":
        return {
          effect: "weather",
          value: m2Field(cmd, "value", "none"),
          durationMs: Number(m2Field(cmd, "transitionMs", "0")) || 300,
        };
      default:
        return undefined;
    }
  })();
  if (!fields) return undefined;
  return { kind: "m2Command", commandId: cmd.commandId, fields: { ...fields } };
}

function screenEffectStage(cmd: Extract<Command, { kind: "m2Command" }>): HTMLElement {
  const effect = m2Field(cmd, "effect", "fadeIn");
  const value = m2Field(cmd, "value", "");
  const duration = m2CommandById(cmd.commandId)?.title === "Tint Screen"
    ? tintDurationMs(cmd.fields)
    : clampMs(Number(m2Field(cmd, "durationMs", "300")));
  const model = screenEffectPreviewModel(effect, value, duration);
  const stage = el("div", {
    class: `ecp-stage ecp-screen-effect-stage ecp-screen-effect-${effect}`,
    dataset: { testid: "ecp-screen-effect-stage", effect, playState: "idle" },
  });
  // 재생 전이 시간은 런타임 clampMs 가 자른 값을 그대로 쓴다 — 300ms 와 1200ms 가 달라 보여야 한다.
  stage.style.setProperty("--ecp-fx-duration", `${duration}ms`);
  const screen = el("div", {
    class: "ecp-fx-screen ecp-screen-effect-screen",
    dataset: { testid: "ecp-screen-effect-screen" },
  });
  // 미니 모니터 속 가짜 게임 화면. 효과는 "무엇을 덮는가"가 전부라
  // 덮을 대상이 없으면(흰 배경) 어떤 효과도 보이지 않는다.
  screen.append(
    el("div", {
      class: "ecp-screen-effect-scene",
      dataset: { testid: "ecp-screen-effect-scene" },
      attrs: { "aria-hidden": "true" },
    })
  );
  const overlay = el("div", {
    class: model.neutral ? "ecp-screen-effect-overlay is-fx-neutral" : "ecp-screen-effect-overlay",
    dataset: { testid: "ecp-screen-effect-overlay" },
    attrs: { "aria-hidden": "true" },
  });
  overlay.style.background = model.background;
  overlay.style.opacity = String(model.restOpacity);
  screen.append(overlay);
  screen.append(el("div", { class: "ecp-fx-label", text: screenEffectLabel(effect) }));
  stage.append(screen);
  stage.append(screenEffectPlayButton(stage, overlay, model, duration));
  const meta = [screenEffectLabel(effect)];
  if (value) meta.push(value);
  meta.push(`${duration}ms`);
  if (model.note) meta.push(model.note);
  stage.append(el("div", { class: "ecp-fx-caption", text: meta.join(" · ") }));
  if (model.error) {
    stage.append(
      el("div", {
        class: "ecp-screen-effect-error",
        dataset: { testid: "ecp-screen-effect-error" },
        attrs: { role: "status" },
        text: model.error,
      })
    );
  }
  return stage;
}


const SCREEN_EFFECT_LABELS: Record<string, string> = {
  fadeIn: "페이드 인",
  fadeOut: "페이드 아웃",
  flash: "플래시",
  tint: "색조",
  weather: "날씨",
};

function screenEffectLabel(effect: string): string {
  return SCREEN_EFFECT_LABELS[effect] ?? effect;
}

/** 프리뷰 오버레이 한 장으로 표현하는 효과 상태. 전부 런타임 계획(planScreenEffect)에서 도출한다. */
type ScreenEffectPreviewModel = {
  /** 오버레이 배경 — 런타임 rgba 그대로(알파 포함). */
  readonly background: string;
  /** 재생 시작 지점의 불투명도. */
  readonly fromOpacity: number;
  /** 정지·도착 상태의 불투명도. */
  readonly restOpacity: number;
  /** 색조 제거(톤 리셋) — 색을 칠하는 것이 아니라 지우는 상태. */
  readonly neutral?: boolean;
  readonly note?: string;
  readonly error?: string;
};

function screenEffectPreviewModel(effect: string, value: string, durationMs: number): ScreenEffectPreviewModel {
  const plan = planScreenEffect(effect, value, durationMs);
  const error = screenEffectValueError(effect, value);
  switch (plan.kind) {
    case "tint": {
      // 페이드 인은 "이미 검게 덮인 화면을 걷어낸다" — 도착지가 투명이라
      // 걷어내는 대상(검은 막)을 시작 상태로 보여줘야 재생이 말이 된다.
      if (plan.unhide) {
        return { background: "rgba(0,0,0,1)", fromOpacity: 1, restOpacity: 0.12, note: "어두운 화면을 걷어냄" };
      }
      const rgba = parseTintColor(plan.tint);
      if (!isVisibleTint(rgba)) {
        // 빈 값 = 런타임의 neutral. 색을 칠하는 것이 아니므로 붉은 사각이 아니라
        // 채도를 걷어내는 상태로 그린다(CSS 가 grayscale 을 입힌다).
        return {
          background: "rgba(255,255,255,0)",
          fromOpacity: 0,
          restOpacity: 1,
          neutral: true,
          note: "색조 제거",
        };
      }
      return { background: rgbaToCss(rgba), fromOpacity: 0, restOpacity: 1, ...(error ? { error } : {}) };
    }
    case "flash": {
      const rgba = parseTintColor(plan.color);
      return {
        background: rgbaToCss({ ...rgba, a: 1 }),
        fromOpacity: 1,
        restOpacity: 0.14,
        note: "번쩍인 뒤 원래대로",
        ...(error ? { error } : {}),
      };
    }
    case "weather":
      return { background: "rgba(120,150,190,0.45)", fromOpacity: 0, restOpacity: 1, note: plan.weather };
    case "unsupported":
      return { background: "rgba(15,23,42,0.35)", fromOpacity: 0, restOpacity: 1 };
  }
}

/** 색 값을 런타임이 알아볼 수 없으면 사유를 돌린다. 색을 안 쓰는 효과(페이드/날씨)는 검사하지 않는다. */
function screenEffectValueError(effect: string, value: string): string | undefined {
  if (effect !== "tint" && effect !== "flash") return undefined;
  const trimmed = value.trim();
  if (!trimmed || isRecognizedTintValue(trimmed)) return undefined;
  return `알 수 없는 색 '${trimmed}' — 런타임은 흰색으로 대신합니다.`;
}

/** 한 번 재생. from 상태로 점프한 다음 다음 프레임에 rest 로 풀어 CSS 전이가 돌게 한다. */
function screenEffectPlayButton(
  stage: HTMLElement,
  overlay: HTMLElement,
  model: ScreenEffectPreviewModel,
  durationMs: number
): HTMLElement {
  let settleTimer: ReturnType<typeof setTimeout> | undefined;
  const settle = () => {
    if (settleTimer !== undefined) clearTimeout(settleTimer);
    settleTimer = undefined;
    stage.dataset.playState = "idle";
  };
  overlay.addEventListener("transitionend", (event) => {
    if ((event as TransitionEvent).propertyName === "opacity") settle();
  });
  return el("button", {
    class: "ecp-screen-effect-play",
    text: "▶ 재생",
    attrs: { type: "button", title: `${durationMs}ms 동안 한 번 재생` },
    dataset: { testid: "ecp-screen-effect-play" },
    on: {
      click: () => {
        stage.dataset.playState = "playing";
        // is-fx-from 은 transition 을 끄는 클래스다 — 시작 상태로 즉시 점프한다.
        overlay.classList.add("is-fx-from");
        overlay.style.opacity = String(model.fromOpacity);
        nextFrame(() => {
          nextFrame(() => {
            overlay.classList.remove("is-fx-from");
            overlay.style.opacity = String(model.restOpacity);
            // transitionend 가 오지 않는 환경(모션 감소 설정 등)을 위한 안전망.
            settleTimer = setTimeout(settle, durationMs + 250);
          });
        });
      },
    },
  });
}

/** requestAnimationFrame 이 없는 환경(유닛 테스트 fake DOM 기본 모드)에서는 그자리에서 진행한다. */
function nextFrame(callback: () => void): void {
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => callback());
  else callback();
}


function weatherStage(cmd: Extract<Command, { kind: "setWeather" }>): HTMLElement {
  const kind = cmd.weather || "none";
  const intensity = Math.max(0, Math.min(1, Number(cmd.intensity ?? 0.5)));
  const stage = el("div", {
    class: `ecp-stage ecp-weather-stage ecp-weather-${kind}`,
    dataset: { testid: "ecp-weather-stage", weather: kind },
  });
  const screen = el("div", { class: "ecp-fx-screen ecp-weather-screen" });
  const particles = el("div", {
    class: `ecp-weather-particles ecp-weather-particles-${kind}`,
    attrs: { "aria-hidden": "true" },
  });
  const count = kind === "none" ? 0 : Math.max(4, Math.round(6 + intensity * 14));
  for (let i = 0; i < count; i += 1) {
    const drop = el("span", { class: "ecp-weather-drop" });
    drop.style.left = `${(i * 37 + 11) % 100}%`;
    drop.style.top = `${(i * 53 + 7) % 100}%`;
    drop.style.animationDelay = `${(i % 8) * 0.12}s`;
    particles.append(drop);
  }
  screen.append(particles);
  screen.append(el("div", { class: "ecp-fx-label", text: weatherPreviewLabel(kind) }));
  stage.append(screen);
  const meta: string[] = [weatherPreviewLabel(kind), `강도 ${Math.round(intensity * 100)}%`];
  if (cmd.transitionMs) meta.push(`${cmd.transitionMs}ms`);
  stage.append(el("div", { class: "ecp-fx-caption", text: meta.join(" · ") }));
  return stage;
}

function animationStage(cmd: Extract<Command, { kind: "showAnimation" }>): HTMLElement {
  const stage = el("div", {
    class: "ecp-stage ecp-animation-stage",
    dataset: { testid: "ecp-animation-stage" },
  });
  const screen = el("div", { class: "ecp-fx-screen ecp-animation-screen page3-anim-stage" });
  // 이 카드도 편집 본문 표시면과 같은 재생기를 쓴다 — 가짜 링 연출은 없다.
  const project = store.getCurrent();
  const record = project.database.battleAnimations.find((entry) => entry.id === cmd.animationId);
  const source = showAnimationPlaybackSource(record, project);
  if (source) {
    const cells = el("div", {
      class: "db-animation-stage-cells page3-anim-cells",
      dataset: { testid: "ecp-animation-frame-layer" },
    });
    screen.append(cells);
    if (source.frames.length > 1) playShowAnimationOnce(screen, cells, source);
    else renderShowAnimationFrame(cells, source, 0);
  } else {
    renderShowAnimationFallback(screen, record?.name ?? "연출 없음");
  }
  stage.append(screen);
  const meta = [record?.name ?? (cmd.animationId || "연출 없음"), animationTargetPreview(cmd.target)];
  if (cmd.wait) meta.push("대기");
  stage.append(el("div", { class: "ecp-fx-caption", text: meta.join(" · ") }));
  return stage;
}

// 동영상 무대. 진짜 프레임을 보여줄 수 없으니(리소스 종류가 아직 없다) 재생 리소스 이름과
// 대기/건너뛰기 선언만 그대로 그린다 — 없는 재생을 있는 식으로 연출하지 않는다.
function movieStage(cmd: Extract<Command, { kind: "playMovie" }>): HTMLElement {
  const stage = el("div", {
    class: "ecp-stage ecp-movie-stage",
    dataset: { testid: "ecp-movie-stage" },
  });
  const screen = el("div", { class: "ecp-fx-screen ecp-movie-screen" });
  screen.append(el("div", { class: "ecp-fx-label", text: cmd.resourceId ? `▶ ${cmd.resourceId}` : "동영상 없음" }));
  stage.append(screen);
  const meta = [cmd.wait === true ? "끝나면 진행" : "바로 진행"];
  if (cmd.skippable === true) meta.push("건너뛰기 허용");
  stage.append(el("div", { class: "ecp-fx-caption", text: meta.join(" · ") }));
  return stage;
}

function erasePictureStage(cmd: Extract<Command, { kind: "erasePicture" }>): HTMLElement {
  const root = el("div", {
    class: "ecp-picture ecp-picture-erase",
    dataset: { testid: "ecp-erase-picture-preview" },
  });
  const screen = el("div", { class: "ecp-picture-screen" });
  const marker = el("div", { class: "ecp-picture-marker missing ecp-picture-erase-marker" });
  marker.append(el("span", { class: "ecp-picture-missing-label", text: cmd.pictureId ? `✕ ${pictureSlotCaption(cmd.pictureId)}` : "✕ 그림 없음" }));
  screen.append(marker);
  root.append(screen);
  root.append(el("div", { class: "ecp-picture-caption", text: `${pictureSlotCaption(cmd.pictureId)} 지우기` }));
  return root;
}


function inputWaitStage(cmd: Extract<Command, { kind: "inputWait" }>): HTMLElement {
  const stage = el("div", {
    class: "ecp-stage ecp-input-wait-stage",
    dataset: { testid: "ecp-input-wait-stage" },
  });
  stage.append(el("div", { class: "ecp-input-wait-key", text: "⌨" }));
  stage.append(el("div", { class: "ecp-fx-label", text: "키 입력 대기" }));
  stage.append(
    el("div", {
      class: "ecp-fx-caption",
      text: cmd.variableId?.trim()
        ? `변수 ${variablePreviewName(cmd.variableId)}`
        : "기억하지 않음",
    })
  );
  return stage;
}

function lightAnchorPreview(anchor: Extract<Command, { kind: "addLight" }>["source"]["at"]): string {
  if (anchor === "player") return "플레이어";
  if ("eventId" in anchor) return `이벤트 ${anchor.eventId || "현재"}`;
  return `(${anchor.x}, ${anchor.y})`;
}

function animationTargetPreview(target: Extract<Command, { kind: "showAnimation" }>["target"]): string {
  if (target === "player") return "플레이어";
  if ("eventId" in target) return `이벤트 ${target.eventId || "현재"}`;
  return `(${target.x}, ${target.y})`;
}

function weatherPreviewLabel(kind: Extract<Command, { kind: "setWeather" }>["weather"]): string {
  switch (kind) {
    case "none":
      return "맑음";
    case "rain":
      return "비";
    case "storm":
      return "폭풍";
    case "snow":
      return "눈";
    case "fog":
      return "안개";
    default:
      return String(kind);
  }
}

function m2Preview(cmd: Extract<Command, { kind: "m2Command" }>, context?: CommandPreviewContext): HTMLElement {
  if (cmd.commandId === "m2-025-change-actor-faceset") {
    const resourceId = String(cmd.fields.value ?? "").trim();
    const project = store.getCurrent();
    const actor = project.database.actors.find((entry) => entry.id === String(cmd.fields.target ?? ""));
    const stage = el("div", {
      class: "ecp-stage ecp-face-stage",
      dataset: { testid: "ecp-m2-faceset-stage" },
    });
    stage.append(renderFacesetCrop({
      resourceId: resourceId || actor?.faceResourceId || "",
      flipHorizontally: false,
      displaySize: PREVIEW_FACE_SIZE,
      position: "left",
    }));
    stage.append(el("div", {
      class: "ecp-face-caption",
      text: actor?.name ? `${actor.name} 얼굴` : "주인공 얼굴 변경",
      dataset: { testid: "ecp-face-caption" },
    }));
    return stage;
  }
  return summaryCard(cmd, context);
}

function describeRuntimeEffect(cmd: Command, simState: PreviewSimState, _hostEventId?: string): string | null {
  switch (cmd.kind) {
    case "changeLevel": {
      const curLevel = simState.variables[cmd.actorId + "_level"] ?? 0;
      return `레벨 ${cmd.op} ${cmd.amount} (현재: ${curLevel})`;
    }
    case "changeActorHp":
      return `HP ${cmd.op} ${cmd.amount}`;
    case "changeActorMp":
      return `MP ${cmd.op} ${cmd.amount}`;
    case "recoverAll":
      return cmd.actorId ? `${cmd.actorId} 전원 회복` : "전원 회복";
    case "changeEquipment":
      return `${cmd.actorId} 장비 변경: ${cmd.slot} = ${cmd.equipmentId}`;
    case "enterHeroName":
      return `${cmd.actorId} 이름 입력`;
    case "transfer":
      return `맵 이동 → (${cmd.x}, ${cmd.y})`;
    case "callCommonEvent":
      return `이벤트 ${cmd.commonEventId} 부르기`;
    case "callMapEvent":
      return `맵 이벤트 ${cmd.eventId} 호출`;
    case "setLighting":
      return `밝기 ${Math.round(cmd.ambient * 100)}%`;
    case "setWeather":
      return `날씨: ${weatherPreviewLabel(cmd.weather)}`;
    case "timer":
      return cmd.action === "set" ? `타이머 ${cmd.seconds}초 설정` : `타이머 ${cmd.action}`;
    case "changeFriendship":
      return `호감도 ${cmd.delta >= 0 ? "+" : ""}${cmd.delta}`;
    case "changeFactionStance":
      return `진영 태도 ${cmd.a} ↔ ${cmd.b} ${cmd.op} ${cmd.value}`;
    case "checkpointSave":
      return cmd.label ? `체크포인트 저장: ${cmd.label}` : "체크포인트 저장";
    case "setEventGraphicPattern":
      return `이벤트 그래픽 변경`;
    case "changeTile":
      return `타일 변경: ${cmd.layer} (${cmd.x},${cmd.y}) = ${cmd.tile}`;
    case "spawnFieldEnemy":
      return "필드 몬스터 생성";
    case "despawnFieldEnemy":
      return `필드 몬스터 제거: ${cmd.spawnId}`;
    case "killPlayer":
      return `주인공 사망: ${gameOverName(store.getCurrent(), cmd.gameOverId)}`;
    case "gameOver":
      return `게임 오버: ${gameOverName(store.getCurrent(), cmd.gameOverId)}`;
    case "returnToTitle":
      return "타이틀로 돌아가기";
    case "ending":
      return `엔딩: ${cmd.title}`;
    case "label":
      return `라벨: ${cmd.name}`;
    case "gotoLabel":
      return `라벨로 이동: ${cmd.name}`;
    case "breakLoop":
      return "반복 중단";
    case "advanceTime":
      return `시간 경과: ${cmd.minutes ?? 0}분 ${cmd.hours ?? 0}시간`;
    case "setTime":
      return `시간 설정: ${cmd.hour}:${String(cmd.minute ?? 0).padStart(2, "0")}`;
    case "sleepUntilMorning":
      return "아침까지 수면";
    case "cutsceneControl":
      return cmd.mode === "begin" ? "연출 시작" : "연출 종료";
    case "equipTool":
      return cmd.itemId ? `도구 장착: ${cmd.itemId}` : "도구 해제";
    default:
      return null;
  }
}
