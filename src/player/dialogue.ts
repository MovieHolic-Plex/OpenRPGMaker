import { installTapOrSwipeToClose, isTouchUiHost } from "@/player/touchTap";
import { getEffectiveReadingPreferences, playerTextDelay, setAuthoredPreferenceDefaults } from '@/player/playerPreferences';
import { backlogViewIsOpen, backlogRecentlyClosed, closeBacklogView, openBacklogView } from '@/player/dialogueBacklogView';
import { dialogueUiText } from '@/player/dialogueUiStrings';
import { applyWindowOpacity } from '@/player/dialogueWindowOpacity';
import {
  DUAL_FULLBODY_VEIL_PRESET_ID, ROMANCE_FULL_PORTRAIT_DEFAULTS,
  SKIP_STEP_DELAY_MS, appendBacklog, autoAdvanceDelayMs, dialogueReadKey, dialogueSystemHasControls, isDialogueRead, markDialogueRead,
  normalizeBacklog, resolveDialogueSystem, skipVerdict,
  type AuthoredDialogueSystem, type BacklogHost, type ReadingStopReason,
} from '@/project/dialogueSystem';
import { cancelChoiceIndex } from '@/project/choiceCancellation';
import { resolveAuthoredVnLook, resolveVnLook, vnLookAttributes, vnLookShowsPortraits, type ResolvedVnLook } from '@/project/vnLook';
// player/dialogue.ts
// DOM dialogue and choices overlay used by the runtime interpreter.
// It resolves text advancement and choice selection through promises.

import { decodeCharsetFrameIndex } from "@/assets/easyrpgRtp";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { reviewedFaceIdForCharset } from "@/assets/reviewedCharsetFaces";
import { applyPixelBust, pixelBustSettled, preloadPixelBust } from "@/player/bustPixelate";
import { warmImageUrl } from "@/assets/imageWarmQueue";
import { dialogueFaceForEmotion, findSharedPortrait, sharedExpressionSetIdOf, sharedPortraitId, sharedPortraitNativeGaze, sharedPortraitRendering } from "@/assets/sharedPortraitAssets";
import { FACE_IMAGE_SIZE } from "@/assets/resourceSlicing";
import { appearancePortraitForEmotion, faceForDialogueEmotion, resolveActorAppearance, resolveAppearancePortrait } from "@/project/characterAppearances";
import { facePresentationForResource } from "@/project/facePresentation";
import { DEFAULT_MESSAGE_WINDOW_SETTINGS } from "@/project/session";
import { store } from "@/project/store";
import { portraitForcesBottom } from "@/project/dialoguePortraitPosition";
import type { ChoiceCancelBehavior, FaceGraphic, MessageWindowPosition, MessageWindowSettings, Project } from "@/project/types";
import {
  DIALOGUE_FALLBACK_CHAR_WIDTH,
  DIALOGUE_LINES_PER_PAGE,
  fallbackMeasureDialogueText,
  paginateDialogueSegments,
  type DialoguePage,
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
import { directionForKey, isCancelKey, isConfirmKey, isTextEntryTarget, keyboardEventKey } from "@/player/keyBindings";
import { installConfirmPressTracker, isLeakedConfirmPress, isPlayerKeyInput, OPEN_GRACE_MS } from "@/player/confirmMashGuard";
import { applySystemWindowSkinVariable } from "@/player/systemGraphics";
import { resolveAudioSource } from "@/player/audio/audioResources";
import { lineVoiceActive, playLineVoice, stopLineVoice } from "@/player/lineVoice";
import { createDialogueVoice, type DialogueVoicePlayer as DialoguePlayerVoice } from "@/player/dialogueVoice";
import { createMonsterDialogueTick } from "@/player/monsterSfx";
import {
  DIALOGUE_TAG_COLORS,
  isNonBlockingContainer,
  parseDialogueEmotion,
  punctuationPauseMs,
  resolveDialogueFullPortraitLayout,
  resolveDialogueLook,
  type DialogueFullPortraitLayout,
  type DialogueLook,
} from "@/project/dialogueStyles";
import { resolveFontStack } from "@/project/fontRegistry";
import { EMOTE_ASSET_PATH, EMOTE_FRAME_SIZE, emoteFrameIndex, type EmoteKind } from "@/project/emotes";
import { withInlineAsset } from "@/assets/inlineAssetStore";
import { PLAY_RESOLUTION } from "@/player/playResolution";
import type { PlaySessionLike } from "@/project/sessionRuntimeTypes"
import { el, clearChildren } from "@/util/dom";
import { stampEmeraldSurface } from "@/player/emeraldSurfaces";
import { stripSpeakerEcho } from "@/project/dialogueSpeakerEcho";

type DialogueSurfaceSettings = {
  readonly settings?: MessageWindowSettings;
  readonly playerTileY: number;
  readonly mapHeight: number;
  /** 화면 속 주인공의 세로 위치(0=맨 위, 1=맨 아래). 있으면 타일 위치 대신 이것으로 가림을 판정한다 — 카메라가 맵 가장자리에 걸리면 둘이 다르다. */
  readonly playerScreenY?: number;
  readonly textContext?: DialogueTextContext;
  /**
   * 대화창 스타일·대사 종류·화자 목소리(project/dialogueStyles.ts resolveDialogueLook).
   * 생략하면 프로젝트 기본 스타일 + 화자 이름으로 찾은 프로필을 쓴다.
   */
  readonly look?: DialogueLook;
  /**
   * 'off' 면 읽기 보조(백로그 기록·읽은 글 표시·오토·스킵·숨기기 단추)를 이 요청에 쓰지 않는다.
   * 전투 중 이벤트 대사처럼 세션에 속하지 않는 임시 문맥이 저장되는 백로그에 섞이지 않게 한다.
   */
  readonly reading?: "off";
};

export type DialogueTextContext = {
  readonly session: Pick<PlaySessionLike, "variables" | "actorNames"> & { readonly gold?: number; readonly stringVariables?: Readonly<Record<string, string>> };
  readonly project: Pick<Project, "database">;
};

export type DialogueTextRequest = DialogueSurfaceSettings & {
  readonly signal?: AbortSignal;
  readonly speaker?: string;
  readonly body: string;
  readonly face?: FaceGraphic;
  /** 저작이 대사 앞에 준 듣는 사람 얼굴(화자 반대 자리). 있으면 앞 화자 대신 이 얼굴이 듣는 사람 흉상이다. */
  readonly listenerFace?: FaceGraphic;
  /** true 면 듣는 흉상은 listenerFace 하나로만 정한다(없으면 비운다) — 「앞 화자가 남는다」 규칙을 쓰지 않는다(text.bustSide "stage"). */
  readonly stageListener?: boolean;
  /** true 면 페이지 타이핑 종료 후 키 입력 없이 다음으로. */
  readonly autoAdvance?: boolean;
  /** 엔딩 에필로그의 글. 스킵은 이 글을 절대 건너뛰지 않는다(interpreter text 단계의 endingEpilogue). */
  readonly endingEpilogue?: boolean;
  /**
   * 바로 뒤에 질문 없는 선택지가 온다(interpreter text 단계). 마지막 쪽 커서를 ■ 대신 ▼ 로 그려 결정 키 한 번이면
   * 선택지가 이어진다는 것을 보인다. 글은 자기 결정 키를 기다린다 — 스스로 닫으면 「계속」 키가 선택지를 고른다.
   * 선택지는 이 글을 틀에 남긴 채 뜬다(choiceFrame).
   */
  readonly beforeChoices?: boolean;
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
  /** 이 줄 전체의 음성 파일. 있으면 글자 삑 소리는 내지 않는다. */
  readonly voiceResourceId?: string;
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
/** 휠 위로 백로그 열기: 닫은 뒤 이 시간은 다시 안 열고, 이 시간 안에 문턱만큼 쌓여야 연다(관성 스크롤·핀치 오작동 방지). */
const WHEEL_REOPEN_COOLDOWN_MS = 450;
const WHEEL_OPEN_WINDOW_MS = 300;
const WHEEL_OPEN_THRESHOLD = 40;
/** 말풍선 본문 폭(논리 px). 넘으면 줄을 바꾸고, 세 줄을 넘으면 상자로 간다. */
const DIALOGUE_BALLOON_TEXT_WIDTH = 150;
const DIALOGUE_BALLOON_MAX_LINES = 3;
const DIALOGUE_BALLOON_EDGE = 4;
const DIALOGUE_BALLOON_TAIL = 7;
/** 위가 모자라 아래로 뒤집을 때 머리 기준점에서 내리는 거리 — 대략 캐릭터 한 명 키. */
const DIALOGUE_BALLOON_BELOW = 38;
const DIALOGUE_MOUTH_FRAME_MS = 120;

/** 대화 기록 키. 물리 KeyL 이라 자판 배열과 무관하고, 한글 입력 상태의 ㅣ 도 받는다. */
export function isDialogueLogKey(key: string, code?: string): boolean {
  return code === "KeyL" || key === "l" || key === "L" || key === "ㅣ" || key === "PageUp";
}

export type DialogueChoicesRequest = DialogueSurfaceSettings & {
  readonly prompt?: string;
  readonly options: { text: string }[];
  readonly cancelBehavior?: ChoiceCancelBehavior;
  readonly signal?: AbortSignal;
};

const DEFAULT_DIALOGUE_CHAR_DELAY_MS = 24;
/**
 * 흘림이 밀렸을 때 따라잡는 한도. 글자마다 setTimeout 을 이어 붙이면 기기가 바쁠 때 콜백이 늦은 만큼이 글자마다 쌓여
 * 24ms 글자가 60~110ms 로 흘렀다(2026-10-29 vm3 flash 방탈출 「대사 한 글자씩 느리게」, 부하 중 계측 hud/pacing-dialogue).
 * 다음 글자 시각을 예정표로 들고 늦은 만큼 다음 기다림을 줄인다 — 단 탭이 숨었다 돌아온 것 같은 긴 정지 뒤에 남은
 * 글을 한꺼번에 쏟지 않게 이만큼까지만 따라잡는다.
 */
const DIALOGUE_TYPE_CATCHUP_MAX_MS = 400;

/** 선택 질문 노드 id. 한 화면에 창은 하나지만, 연속 선택마다 새 노드가 생긴다. */
let choicePromptSerial = 0;

type DialoguePlaybackToken =
  | { readonly kind: "char" }
  | { readonly kind: "control"; readonly control: DialogueTextControl };

export function dialogueSpeedDelayMs(value: number): number {
  const speed = Math.max(1, Math.min(20, Math.trunc(Number.isFinite(value) ? value : 3)));
  return speed * 8;
}

/** 글자 소리: 녹음된 줄 음성이 있으면 합성 없음, 저작한 목소리가 있으면 그것, 둘 다 없으면 몬스터 장르 기본 글자 소리(그 외 장르는 무음). */
function dialogueVoiceFor(look: DialogueLook, voiceUrl: string | null): DialoguePlayerVoice {
  if (voiceUrl) return createDialogueVoice({ ...look, voice: null });
  if (look.voice) return createDialogueVoice(look);
  return createMonsterDialogueTick(store.getCurrent());
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
// 흉상·전신은 상자 **위(위쪽 창은 아래)** 에 서고 상자 안쪽을 거의 덮지 않는다 — 글 여백을 두면 글 폭만 좁아지고
// 반대편이 빈다(2026-10-17 매트릭스 실측: 1024 폭 하단 창에서 글 폭 890 → 590). 그래서 여백은 0 이다.
const DIALOGUE_BUST_TEXT_RESERVE = 0;
const DIALOGUE_FULL_TEXT_RESERVE = 0;
/** RPG 만들기식 대사창: 한 페이지에 보이는 줄은 최대 3줄. 상자가 더 커도 3줄에서 끊어 다음 장으로 넘긴다. */
const DIALOGUE_VISIBLE_LINES = 3;
/**
 * 전신 초상(하단 대사창): 9:16 세로 그림을 **화면 높이** 비율로 키우고 아래 일부는 화면 밖으로 내린다.
 * 고정 px 로 두면 해상도를 올릴수록(최대 1920×1080) 초상이 작아져, 비율로 정의한다.
 * 비율은 프로젝트 기본(system.dialogueFullPortrait, 기본 높이 125%·내림 20%)에 장면 배율(face.fullScale)을 곱한 값 —
 * resolveDialogueFullPortraitLayout 하나가 런타임과 에디터 미리보기에 같이 답한다.
 * 초상은 대사창 뒤에 서므로 글 여백이 없다. CSS(--runtime-dialogue-full-*)는 이 한 곳의 값만 쓴다.
 */
const DIALOGUE_FULL_ASPECT = 9 / 16;

/** 상자 뒤에 서는 전신 초상의 크기·내림을 화면 높이로 심는다. 위치·층은 CSS(.dialogue-face-behind). */
function styleBehindPortrait(node: HTMLElement, hostHeight: number, face: FaceGraphic, isDualFullbodyVeil = false): void {
  const configured = store.getCurrent()?.system.dialogueFullPortrait ?? (isDualFullbodyVeil ? ROMANCE_FULL_PORTRAIT_DEFAULTS : undefined);
  const layout = resolveDialogueFullPortraitLayout(configured, face.fullScale);
  const metrics = fullPortraitMetrics(hostHeight, layout);
  node.classList.add("dialogue-face-behind");
  node.style.setProperty("--runtime-dialogue-full-height", `${metrics.height}px`);
  node.style.setProperty("--runtime-dialogue-full-width", `${metrics.width}px`);
  node.style.setProperty("--runtime-dialogue-full-drop", `${metrics.drop}px`);
}

/**
 * 양쪽 전신 베일 프리셋에서 얼굴·흉상 리소스를 같은 인물의 전신(full) 초상으로 승격한다.
 * 공용 76종과 현대 연애 24종 모두 같은 세트 안에 -full-<표정> 이 있어 그림을 새로 만들지 않는다.
 */
export function promoteFaceToFullPortrait(
  face: FaceGraphic | undefined,
  emotion?: string,
  expressionFace?: string,
): FaceGraphic | undefined {
  if (!face?.resourceId) return undefined;
  const setId = sharedExpressionSetIdOf(face.resourceId);
  if (setId) {
    const baseExpr = findSharedPortrait(face.resourceId)?.expression ?? "base";
    const fullBase = sharedPortraitId(setId, "full", baseExpr);
    const fullEmotion = dialogueFaceForEmotion(fullBase, emotion, expressionFace) ?? fullBase;
    if (findSharedPortrait(fullEmotion)) {
      return { ...face, resourceId: fullEmotion, presentation: "full" };
    }
  }
  if (face.resourceId === "generated-face-actor1-bust") {
    return { ...face, resourceId: "generated-face-actor1-full", presentation: "full" };
  }
  const lineFace = dialogueFaceForEmotion(face.resourceId, emotion, expressionFace);
  return { ...face, ...(lineFace ? { resourceId: lineFace } : {}), presentation: "full" };
}

/**
 * 양쪽 전신 베일 프리셋의 하단 대화창 왼쪽에 함께 띄우는 화자 클로즈업(흉상/얼굴) 리소스 ID를 구한다.
 */
export function resolveVeilCornerFaceResourceId(faceResourceId: string): string {
  const shared = findSharedPortrait(faceResourceId);
  if (shared) {
    return sharedPortraitId(shared.setId, "bust", shared.expression);
  }
  if (faceResourceId === "generated-face-actor1-full") {
    return "generated-face-actor1-bust";
  }
  return faceResourceId;
}

function renderVeilSpeakerFace(face: FaceGraphic): HTMLElement | undefined {
  const cornerResourceId = resolveVeilCornerFaceResourceId(face.resourceId);
  const url = safeResourceImageUrl(resolveAssetResourceUrl(cornerResourceId, { project: store.getCurrent() }));
  if (!url) return undefined;
  return el("div", {
    class: `dialogue-veil-speaker-face${face.flipHorizontally ? " flipped" : ""}`,
    attrs: {
      "aria-label": `speaker face ${cornerResourceId}`,
      role: "img",
      style: `background-image:url("${url}")`,
    },
    dataset: {
      testid: "dialogue-veil-speaker-face",
      resourceId: cornerResourceId,
    },
  });
}

function portraitIdentityOf(key: string, face: FaceGraphic): string {
  const sharedSet = sharedExpressionSetIdOf(face.resourceId);
  if (sharedSet) return sharedSet;
  if (face.resourceId.startsWith("generated-face-actor1-")) return "generated-face-actor1";
  const trimmed = key.trim();
  return trimmed || face.resourceId;
}

function resolveActorFullPortrait(
  project: Project,
  rawActor: Project["database"]["actors"][number] | undefined,
): FaceGraphic | undefined {
  if (!rawActor) return undefined;
  if (rawActor.appearanceId) {
    const appFace = resolveAppearancePortrait(project, rawActor.appearanceId, "full");
    if (appFace) return promoteFaceToFullPortrait(appFace);
  }
  const actor = resolveActorAppearance(project, rawActor);
  if (actor.faceResourceId) {
    return promoteFaceToFullPortrait({
      resourceId: actor.faceResourceId,
      position: "left",
      flipHorizontally: false,
    });
  }
  if (actor.characterResourceId) {
    const paired = reviewedFaceIdForCharset(actor.characterResourceId, actor.characterIndex ?? 0);
    if (paired) {
      return promoteFaceToFullPortrait({
        resourceId: paired,
        position: "left",
        flipHorizontally: false,
      });
    }
  }
  return undefined;
}

function resolveEventFullPortrait(
  project: Project,
  event: Project["maps"][string]["events"][number],
): FaceGraphic | undefined {
  for (const page of event.pages ?? []) {
    if (page.graphic?.appearanceId) {
      const appFace = resolveAppearancePortrait(project, page.graphic.appearanceId, "full");
      if (appFace) return promoteFaceToFullPortrait(appFace);
    }
    for (const cmd of page.commands ?? []) {
      if (cmd.kind === "changeFace") {
        if (cmd.appearanceId) {
          const appFace = resolveAppearancePortrait(project, cmd.appearanceId, "full");
          if (appFace) return promoteFaceToFullPortrait(appFace);
        }
        if (cmd.resourceId) {
          return promoteFaceToFullPortrait({
            resourceId: cmd.resourceId,
            position: cmd.position,
            flipHorizontally: cmd.flipHorizontally,
          });
        }
      }
    }
    const spriteId = page.graphic?.sprite?.id;
    if (spriteId) {
      const charIdx = decodeCharsetFrameIndex(typeof page.graphic.pattern === "number" ? page.graphic.pattern : 0).characterIndex;
      const paired = reviewedFaceIdForCharset(spriteId, charIdx);
      if (paired) {
        return promoteFaceToFullPortrait({
          resourceId: paired,
          position: "right",
          flipHorizontally: false,
        });
      }
    }
  }
  return undefined;
}

function resolveSpeakerFullPortraitFromProject(
  project: Project | undefined,
  speakerName: string | undefined,
): FaceGraphic | undefined {
  const name = speakerName?.trim();
  if (!project || !name) return undefined;
  const actor = project.database.actors.find((entry) => entry.name.trim() === name);
  if (actor) {
    const actorFace = resolveActorFullPortrait(project, actor);
    if (actorFace) return actorFace;
  }
  const appearance = project.database.characterAppearances?.find((entry) => entry.name.trim() === name);
  if (appearance) {
    const appFace = resolveAppearancePortrait(project, appearance.id, "full");
    if (appFace) return promoteFaceToFullPortrait(appFace);
  }
  for (const map of Object.values(project.maps)) {
    for (const event of map.events) {
      const charName = event.characterId ? project.characters?.[event.characterId]?.displayName?.trim() : undefined;
      if (charName === name || event.name?.trim() === name) {
        const evFace = resolveEventFullPortrait(project, event);
        if (evFace) return evFace;
      }
    }
  }
  return undefined;
}

function resolveDualStagePartner(
  project: Project | undefined,
  session: DialogueTextContext["session"] | undefined,
  speakerKey: string,
  speakerFace: FaceGraphic,
): { readonly key: string; readonly face: FaceGraphic } | undefined {
  if (!project) return undefined;
  const speakerId = portraitIdentityOf(speakerKey, speakerFace);
  const partyIds = (session as { readonly partyActorIds?: readonly string[] } | undefined)?.partyActorIds;
  const leadActorId = partyIds?.[0] ?? project.system.startActorIds?.[0] ?? project.database.actors[0]?.id;
  const leadActor = project.database.actors.find((entry) => entry.id === leadActorId) ?? project.database.actors[0];
  const leadFace = resolveActorFullPortrait(project, leadActor);
  if (leadFace && portraitIdentityOf(leadActor?.name ?? "", leadFace) !== speakerId && leadActor?.name?.trim() !== speakerKey) {
    return { key: leadActor?.name?.trim() || "__hero__", face: leadFace };
  }
  const currentMapId = (session as { readonly currentMapId?: string } | undefined)?.currentMapId ?? project.startMapId;
  const currentMap = project.maps[currentMapId];
  for (const event of currentMap?.events ?? []) {
    const evFace = resolveEventFullPortrait(project, event);
    const evName = (event.characterId ? project.characters?.[event.characterId]?.displayName : undefined)?.trim()
      || event.name?.trim()
      || event.id;
    if (evFace && portraitIdentityOf(evName, evFace) !== speakerId && evName !== speakerKey) {
      return { key: evName, face: evFace };
    }
  }
  for (const app of project.database.characterAppearances ?? []) {
    const appFace = promoteFaceToFullPortrait(resolveAppearancePortrait(project, app.id, "full"));
    if (appFace && portraitIdentityOf(app.name, appFace) !== speakerId && app.name.trim() !== speakerKey) {
      return { key: app.name.trim() || app.id, face: appFace };
    }
  }
  for (const actor of project.database.actors) {
    const actorFace = resolveActorFullPortrait(project, actor);
    if (actorFace && portraitIdentityOf(actor.name, actorFace) !== speakerId && actor.name.trim() !== speakerKey) {
      return { key: actor.name.trim() || actor.id, face: actorFace };
    }
  }
  return undefined;
}

/**
 * 캐릭터 엔딩 CG에 함께 세울 주인공과 엔딩 상대의 전신 초상(웃는 표정). 상대는 엔딩 조건의 호감 키로 찾는다.
 * 찾지 못한 쪽은 비워 둔다 — 엉뚱한 인물로 채우지 않는다.
 */
export function resolveEndingCouplePortraits(
  project: Project,
  partnerKey: string | undefined,
): { hero?: FaceGraphic; partner?: FaceGraphic; partnerName?: string } {
  const smiling = (face: FaceGraphic | undefined): FaceGraphic | undefined => face && (promoteFaceToFullPortrait(face, "happy") ?? face);
  const leadId = project.system.startActorIds?.[0] ?? project.database.actors[0]?.id;
  const hero = smiling(resolveActorFullPortrait(project, project.database.actors.find((actor) => actor.id === leadId)));
  const heroPart = hero ? { hero } : {};
  if (!partnerKey) return heroPart;
  for (const map of Object.values(project.maps)) {
    for (const event of map.events) {
      if (event.characterId !== partnerKey && event.id !== partnerKey && event.id !== `ev_${partnerKey}`) continue;
      const partner = smiling(resolveEventFullPortrait(project, event));
      if (!partner) continue;
      const partnerName = project.characters?.[partnerKey]?.displayName?.trim() || event.name?.trim();
      return { ...heroPart, partner, ...(partnerName ? { partnerName } : {}) };
    }
  }
  return heroPart;
}

function fullPortraitMetrics(
  hostHeight: number,
  layout: DialogueFullPortraitLayout,
): { height: number; width: number; drop: number } {
  const height = Math.round(hostHeight * layout.heightRatio);
  const width = Math.round(height * DIALOGUE_FULL_ASPECT);
  return {
    height,
    width,
    drop: Math.round(height * layout.dropRatio),
  };
}
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
  /** 오토·스킵을 멈춘다(선택지·장면 전환·전투 같은 경계에서 호출). 켜져 있지 않으면 아무 일도 없다. 생략 가능한 멤버 — 테스트 대역은 안 갖는다. */
  stopReading?(reason: ReadingStopReason): void;
  /** 지금 읽기 모드. */
  readingMode?(): "off" | "auto" | "skip";
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
  stampEmeraldSurface(overlay, store.getCurrent(), "dialogue");
  stampEmeraldSurface(scrim, store.getCurrent(), "dialogue-scrim");
  host.append(scrim, overlay);
  installConfirmPressTracker();

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
    delete overlay.dataset.dialogueHidden;
    delete scrim.dataset.dialogueHidden;
    hiddenByUser = false;
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
    const wasOpen = overlay.firstChild !== null || pendingExit !== null;
    // 위치가 바뀌는 연속 대사에서 창이 튀지 않게, 지우기 전에 앞 창의 자리를 기억한다(FLIP).
    const prevBox = overlay.querySelector<HTMLElement>(".dialogue-box");
    const savedBoxTop = prevBox ? layoutTop(overlay, prevBox)?.top : undefined;
    previousTextBox = wasOpen && prevBox && !prevBox.classList.contains("choices") && !prevBox.classList.contains("dialogue-balloon") ? prevBox : undefined;
    cancelActiveText?.();
    cancelActiveChoice?.();
    previousBoxTop = savedBoxTop;
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
      stageSlots = {};
      lastLineForcedBottom = false;
      previousBoxTop = undefined;
      sessionPosition = undefined;
      lastBoxPosition = undefined;
    };
    const cancelTimer = schedule(finish, exitMs);
    // schedule 이 동기로 끝냈으면(node 환경) 예약을 남기지 않는다.
    if (!settled) pendingExit = { cancelTimer, finish };
  };

  /** 다음 줄이 초상을 기다리는 동안 앞 줄의 퇴장을 멈추고 창을 그대로 세워 둔다(세션이 끊기지 않게 — 화자·듣는 사람 무대를 잇는다). */
  const holdPendingExit = (): void => {
    if (!pendingExit) return;
    pendingExit.cancelTimer();
    pendingExit = null;
    const exiting = overlay.querySelector<HTMLElement>('.dialogue-box[data-dialogue-phase="exit"]');
    if (exiting) exiting.dataset.dialoguePhase = "shown";
  };

  /** 변환(진입 연출)을 뺀 레이아웃 윗변 — 화면 좌표. 연출 도중의 값이 섞이면 미끄러짐의 출발점이 틀어진다. */
  const layoutTop = (host: HTMLElement, node: HTMLElement): { readonly top: number; readonly scale: number } | undefined => {
    if (typeof host.getBoundingClientRect !== "function" || host.offsetHeight <= 0) return undefined;
    const rect = host.getBoundingClientRect();
    const scale = rect.height / host.offsetHeight || 1;
    return { top: rect.top + node.offsetTop * scale, scale };
  };

  /**
   * 이어지는 대사에서 초상 규칙 때문에 창의 세로 자리가 바뀌면(초상 없는 줄 위/가운데 ↔ 초상 있는 줄 아래) 앞 창이 있던 자리에서 새 자리로 미끄러진다.
   * 레이아웃은 즉시 새 자리로 확정되고(캡처·판정에 영향 없음) `translate` 만 되감아 재생한다. 움직임 줄이기에서는 쓰지 않는다.
   */
  const glideFromPreviousBox = (box: HTMLElement): void => {
    const before = previousBoxTop;
    previousBoxTop = undefined;
    if (before === undefined || typeof box.animate !== "function") return;
    if (resolveReducedMotion(undefined)) return;
    const after = layoutTop(overlay, box);
    if (after === undefined) return;
    // 화면 좌표의 차이를 상자 안 좌표(CSS px)로 되돌린다 — 플레이 화면은 논리 해상도를 키워서 보여 준다.
    const dy = (before - after.top) / after.scale;
    if (Math.abs(dy) * after.scale < 12) return;
    box.animate([{ translate: `0 ${dy}px` }, { translate: "0 0" }], { duration: 220, easing: "cubic-bezier(0.22, 0.8, 0.3, 1)" });
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

  // ── 읽기 보조(오토·스킵·숨기기) 상태 ───────────────────────────────────────────
  // 저작(meta.oprnDialogueSystem·연애 기본 구성)이 있을 때만 켜진다. 없으면 아래 값은 전부 쉬고 옛 동작 그대로다.
  // 대사창에 단추 줄은 그리지 않는다(2026-10-17 사용자 지시: 미연시 에디터가 아니다) — 단축키(A·S·H·L·Ctrl)와 휠·ESC 메뉴로만 쓴다.
  type ReadingMode = "off" | "auto" | "skip";
  let readingMode: ReadingMode = "off";
  let ctrlSkip = false;
  let hiddenByUser = false;
  let activeReading: { readonly reevaluate: () => void; readonly clearTimer: () => void; readonly toggle: (mode: "auto" | "skip") => void; readonly openBacklog: () => void; readonly setHidden: (value: boolean) => void } | undefined;
  /** 마지막으로 쓴 백로그 문맥. ESC 메뉴·openLog() 가 같은 화면을 연다. */
  let lastBacklog: { readonly host: BacklogHost; readonly system: AuthoredDialogueSystem } | undefined;
  const isSkipping = (): boolean => readingMode === "skip" || ctrlSkip;
  const stopReading = (reason: ReadingStopReason): void => {
    const was = readingMode !== "off" || ctrlSkip;
    readingMode = "off";
    ctrlSkip = false;
    activeReading?.clearTimer();
    if (!was) return;
    overlay.dataset.readingStop = reason;
  };
  const setHiddenState = (value: boolean): void => {
    hiddenByUser = value;
    if (value) overlay.dataset.dialogueHidden = "1";
    else delete overlay.dataset.dialogueHidden;
    if (value) scrim.dataset.dialogueHidden = "1";
    else delete scrim.dataset.dialogueHidden;
  };

  // ── 대화 기록(백로그) ──────────────────────────────────────────────────────
  // 옛 방식: 이 UI 가 살아 있는 동안(한 플레이 세션) 본 대사를 모은다. 저장 파일에는 넣지 않는다.
  // 새 방식(저작된 대사 시스템에서 백로그가 켜졌을 때): 세션의 dialogueBacklog 링 버퍼에 쓰고 세이브에 실린다. 둘은 같은 줄을 따로 센다.
  const logEntries: DialogueLogEntry[] = [];
  let logPanel: HTMLElement | undefined;
  /** 이 요청에 적용할 대사 시스템. reading:'off' 면 없다. */
  const systemFor = (request: { readonly reading?: "off" }): AuthoredDialogueSystem | undefined =>
    request.reading === "off" ? undefined : resolveDialogueSystem(store.getCurrent());
  /** 백로그·읽은 글 표시가 쓸 세션. 가짜 세션(전투 임시 문맥)은 reading:'off' 로 걸러진다. */
  const sessionHostFor = (request: { readonly textContext?: DialogueTextContext }): BacklogHost | undefined =>
    (request.textContext?.session as unknown as BacklogHost | undefined) ?? undefined;
  const recordLog = (request: DialogueTextRequest, look: DialogueLook, toBacklog = true): { readonly text: string; readonly speaker?: string } | undefined => {
    const text = parseDialogueText(request.body, request.textContext).map((segment) => segment.text).join("").trim();
    if (!text) return undefined;
    const speaker = look.hideName ? undefined : nameplateSpeaker(request.speaker, request.textContext);
    logEntries.push({
      text,
      context: look.context,
      ...(speaker ? { speaker } : {}),
      ...(look.nameColor ? { color: look.nameColor } : {}),
    });
    if (logEntries.length > DIALOGUE_LOG_LIMIT) logEntries.splice(0, logEntries.length - DIALOGUE_LOG_LIMIT);
    const system = systemFor(request);
    const host = sessionHostFor(request);
    if (toBacklog && system?.backlog.enabled && host) {
      appendBacklog(host, { kind: "line", text, ...(speaker ? { speaker } : {}), ...(look.nameColor ? { color: look.nameColor } : {}), ...(look.context ? { context: look.context } : {}) }, system.backlog.limit);
      lastBacklog = { host, system };
    }
    return { text, ...(speaker ? { speaker } : {}) };
  };
  const recordChoice = (request: DialogueChoicesRequest, index: number): void => {
    const system = systemFor(request);
    const host = sessionHostFor(request);
    if (!system?.backlog.enabled || !host) return;
    const plain = (text: string): string => parseDialogueText(text, request.textContext).map((segment) => segment.text).join("").trim();
    const option = request.options[index];
    const picked = option ? plain(option.text) : dialogueUiText(system, "backlog.cancel");
    if (!picked) return;
    const prompt = request.prompt ? plain(request.prompt) : "";
    appendBacklog(host, { kind: "choice", picked, ...(prompt ? { prompt } : {}) }, system.backlog.limit);
    lastBacklog = { host, system };
  };
  const closeLog = (): void => {
    logPanel?.remove();
    logPanel = undefined;
    closeBacklogView();
  };
  const openNewBacklog = (): boolean => {
    if (!lastBacklog) return false;
    const { host: sessionHost, system } = lastBacklog;
    openBacklogView({ host, entries: normalizeBacklog(sessionHost.dialogueBacklog, system.backlog.limit) ?? [], system });
    return true;
  };
  const openLog = (): void => {
    closeLog();
    if (openNewBacklog()) return;
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
    const closeButton = el("button", {
      class: "dialogue-log-close",
      text: "닫기 ✕",
      attrs: { type: "button", "aria-label": "대화 기록 닫기" },
      dataset: { testid: "dialogue-log-close" },
    });
    closeButton.addEventListener("click", (event) => { event.stopPropagation(); closeLog(); });
    logPanel = el("div", {
      class: "dialogue-log",
      attrs: { role: "dialog", "aria-label": "대화 기록" },
      dataset: { testid: "dialogue-log" },
      children: [
        el("div", { class: "dialogue-log-head", children: [
          el("strong", { text: "대화 기록" }),
          el("span", { class: "dialogue-log-hint", text: isTouchUiHost(host) ? "탭하거나 쓸어서 닫기" : "L · Esc 닫기 · ↑↓ 넘겨 보기" }),
          closeButton,
        ] }),
        list,
      ],
    });
    // 폰에는 L·Esc 가 없다 — 보이는 닫기 단추와 탭·쓸기로 닫는다(2026-10-24, 아이폰에서 기록 창에 갇힌 신고).
    installTapOrSwipeToClose(logPanel, closeLog);
    host.append(logPanel);
    list.scrollTop = list.scrollHeight;
  };
  /** 대화 중 기록 키. 기록이 열려 있으면 다른 키는 삼킨다. 처리했으면 true. */
  const handleLogKey = (e: KeyboardEvent): boolean => {
    if (logPanel) {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (isDialogueLogKey(e.key, e.code) || e.key === "Escape") closeLog();
      else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        const list = logPanel.querySelector<HTMLElement>(".dialogue-log-list");
        if (list) list.scrollTop += e.key === "ArrowUp" ? -24 : 24;
      }
      return true;
    }
    if (isDialogueLogKey(e.key, e.code)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (activeReading) activeReading.openBacklog();
      else openLog();
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
    // 흘림·bark 앰비언트 대사는 세션 백로그(세이브)에 쓰지 않는다 — 순찰 NPC 가 링 버퍼를 채우지 못하게(2026-10-17 적대 리뷰 D11).
    recordLog(request, look, false);
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
      const cornerName = look.hideName ? undefined : nameplateSpeaker(request.speaker, request.textContext);
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
  // 직전 대사가 초상 때문에 아래로 강제됐는가 — 같은 세션의 선택지가 대사창과 같은 자리에 서도록 이어 쓴다.
  let lastLineForcedBottom = false;
  let previousBoxTop: number | undefined;
  // 고정 틀(2026-10-22): 열려 있는 대화 세션의 창 자리. 「주인공 가림 피하기」(auto)는 세션의 첫 창에서 한 번만 정하고,
  // 이어지는 줄·선택지는 이 자리를 물려받는다 — 줄마다 다시 판정해 창이 위↔아래로 튀던 결함(아스트라·폴른 데모).
  // 저자가 그 줄에 자리를 못박았으면(top·center·bottom, 또는 가림 피하기를 끈 문장 표시 설정) 그 자리를 따른다.
  let sessionPosition: MessageWindowPosition | undefined;
  // 선택지 직전의 대사 상자(떼어 낸 노드). 선택지는 이 상자를 같은 자리에 「틀」로 남기고 그 위에 선택지 칸을 띄운다.
  let previousTextBox: HTMLElement | undefined;
  // 바로 앞 창이 선 자리(저자가 못박은 줄 포함). 선택지는 앞 대사 상자와 같은 자리에 선다.
  let lastBoxPosition: MessageWindowPosition | undefined;
  let listenerPortrait: { readonly key: string; readonly face: FaceGraphic } | undefined;
  let stageSlots: {
    left?: { readonly key: string; readonly idKey: string; readonly face: FaceGraphic };
    right?: { readonly key: string; readonly idKey: string; readonly face: FaceGraphic };
  } = {};
  function showText(rawRequest: DialogueTextRequest): Promise<void> {
    const request = withoutSpeakerEcho(rawRequest);
    if (request.signal?.aborted) return Promise.reject(new DOMException("Text cancelled", "AbortError"));
    const system = systemFor(request);
    if (request.reading !== "off") setAuthoredPreferenceDefaults(system?.defaults);
    const activeProjectForRequest = (request.textContext?.project && "system" in request.textContext.project ? request.textContext.project as Project : undefined) ?? store.getCurrent();
    const voiceFile = request.voiceResourceId?.trim();
    const voiceUrl = voiceFile ? resolveAudioSource(voiceFile, activeProjectForRequest) : null;
    const requestedLook = request.look ?? resolveDialogueLook(activeProjectForRequest, {
      speaker: resolveDialogueSpeakerName(request.speaker, request.textContext) ?? request.speaker,
      emotion: request.emotion,
    });
    const startVoice = (): void => {
      if (voiceUrl) playLineVoice(voiceUrl);
      else stopLineVoice();
    };
    if (isNonBlockingContainer(requestedLook.container)) {
      startVoice();
      // 흘림·코너 대사는 대사 상자를 건드리지 않고, 기다리지도 않는다.
      showAmbient(request, voiceUrl ? { ...requestedLook, voice: null } : requestedLook);
      return Promise.resolve();
    }
    // 초상이 아직 안 받아졌으면 받을 때까지(상한 있음) 창을 열지 않는다 — 이름표만 있는 빈 창이 먼저 뜨고
    // 초상·본문이 약 1초 뒤에 따라오던 결함(2026-10-30 이세계 고딩). 그동안 앞 줄의 창은 퇴장하지 않고 그대로 선다.
    const waiting = unsettledLinePortraits(request, requestedLook, activeProjectForRequest);
    if (waiting.length > 0) {
      holdPendingExit();
      return waitForLinePortraits(waiting, request.signal).then(() => {
        if (request.signal?.aborted) throw new DOMException("Text cancelled", "AbortError");
        startVoice();
        return presentText(request, requestedLook, voiceUrl, system);
      });
    }
    startVoice();
    return presentText(request, requestedLook, voiceUrl, system);
  }

  function presentText(
    request: DialogueTextRequest,
    requestedLook: DialogueLook,
    voiceUrl: string | null,
    system: ReturnType<typeof systemFor>,
  ): Promise<void> {
    const wasOpen = takeOverOverlay();
    return new Promise<void>((resolve, reject) => {
      let settled = false;
      let look = requestedLook;
      // 말풍선은 머리 위 기준점이 있어야 그린다. 없으면(편집기 미리보기·플레이어 이벤트 밖) 상자다.
      let useBalloon = look.container === "balloon" && request.anchor?.() !== undefined;
      const recorded = recordLog(request, look);
      const speakerKey = request.speaker?.trim() || request.speakerKey || "";
      const profile = dialoguePresentationProfile(request.emotion, {
        reducedMotion: resolveReducedMotion(request.reducedMotion),
      });
      activeExitMs = profile.exitMs;
      let voice = dialogueVoiceFor(look, voiceUrl);
      let box!: HTMLElement;
      let bodyEl!: HTMLElement;
      let cursor!: HTMLElement;
      let faceEl: HTMLElement | undefined;
      let veilFaceEl: HTMLElement | undefined;
      let faceForLine: FaceGraphic | undefined;
      let position!: MessageWindowPosition;
      let pages!: ReturnType<typeof paginateDialogueSegments>;
      const segmentsAll = parseDialogueText(request.body, request.textContext);

      const mount = (balloon: boolean): void => {
        // 오버레이는 줄마다 재사용된다 — 앞 줄이 맞춘 높이를 지워야 다음 줄이 처음부터 잰다.
        overlay.style.removeProperty("height");
        const behindPortraits: HTMLElement[] = [];
        let glideFromPrevious = false;
        box = dialogueBox("", "dialogue-box");
        const activeProject = (request.textContext?.project && "system" in request.textContext.project ? request.textContext.project as Project : undefined) ?? store.getCurrent();
        applyDialogueLook(overlay, box, look);
        const rawVnLook = resolveVnLook(activeProject);
        const effectiveVnLook = look.style === DUAL_FULLBODY_VEIL_PRESET_ID && (!rawVnLook || rawVnLook.source === "setting-default")
          ? resolveAuthoredVnLook({ version: 1, preset: DUAL_FULLBODY_VEIL_PRESET_ID }, "setting-default")
          : rawVnLook;
        const vnLook = applyVnLook(overlay, effectiveVnLook);
        const isDualFullbodyVeil = look.style === DUAL_FULLBODY_VEIL_PRESET_ID || vnLook?.preset === DUAL_FULLBODY_VEIL_PRESET_ID;
        const uiScale = isDualFullbodyVeil ? Math.max(1, Math.round((logicalHostHeight(host) / PLAY_RESOLUTION.height) * 1000) / 1000) : 1;
        if (isDualFullbodyVeil) {
          overlay.dataset.dialogueStage = DUAL_FULLBODY_VEIL_PRESET_ID;
          if (uiScale > 1) overlay.style.setProperty("--dialogue-ui-scale", String(uiScale));
          else overlay.style.removeProperty("--dialogue-ui-scale");
        } else {
          delete overlay.dataset.dialogueStage;
          overlay.style.removeProperty("--dialogue-ui-scale");
        }
        const speakerName = nameplateSpeaker(request.speaker, request.textContext);
        const allowPortrait = !look.hideFace && !balloon && vnLookShowsPortraits(vnLook);
        const stagedSpeakerFace = !wasOpen
          ? undefined
          : stageSlots.left && speakerKey !== "" && stageSlots.left.key === speakerKey
            ? stageSlots.left.face
            : stageSlots.right && speakerKey !== "" && stageSlots.right.key === speakerKey
              ? stageSlots.right.face
              : undefined;
        const baseFace = !allowPortrait
          ? undefined
          : request.face ?? (isDualFullbodyVeil ? (stagedSpeakerFace ?? resolveSpeakerFullPortraitFromProject(activeProject, speakerName)) : undefined);
        // 공용 흉상·전신이면 줄의 표정으로 같은 모양의 표정 그림을 고른다(sharedPortraitAssets.ts).
        if (baseFace && isDualFullbodyVeil) {
          faceForLine = promoteFaceToFullPortrait(baseFace, look.emotion, look.expressionFace);
        } else {
          const lineFaceId = baseFace ? faceForDialogueEmotion(activeProject, baseFace.resourceId, look.emotion, look.expressionFace) : undefined;
          faceForLine = baseFace && lineFaceId && lineFaceId !== baseFace.resourceId ? { ...baseFace, resourceId: lineFaceId } : baseFace;
        }
        let face = faceForLine;
        const portraitMode = dialoguePortraitMode(face);
        const isPortrait = portraitMode !== "face";
        // 흉상·전신이 실제로 그려지는 줄은 저작한 위치(위·가운데)와 상관없이 아래다. 위치 결정은 여기 한 곳이다.
        const forceBottom = portraitForcesBottom(portraitMode);
        // 같은 세션에서 초상 규칙이 창 자리를 바꾸는 줄에서만 앞 창이 있던 자리에서 미끄러진다(그 밖의 줄은 옛 동작 그대로).
        glideFromPrevious = wasOpen && lastLineForcedBottom !== forceBottom;
        lastLineForcedBottom = forceBottom;
        position = applyTextSettings(overlay, box, request, undefined, forceBottom, wasOpen ? sessionPosition : undefined);
        // 저자가 못박은 한 줄(top·center·bottom)은 세션 자리를 바꾸지 않는다 — 다음 보통 줄은 원래 자리로 돌아간다.
        if (forceBottom || (request.settings ?? DEFAULT_MESSAGE_WINDOW_SETTINGS).preventObscuringPlayer) sessionPosition = position;
        lastBoxPosition = position;
        overlay.classList.toggle("dialogue-continued", wasOpen);
        applyDialoguePresentation(box, profile);
        applyDialogueScrim(scrim, profile, position);
        const content = el("div", {
          class: [
            "dialogue-content",
            !isDualFullbodyVeil && face?.position === "right" ? "face-right" : "",
            !isDualFullbodyVeil && isPortrait ? "has-bust" : "",
            isPortrait ? `portrait-${portraitMode}` : "",
          ]
            .filter(Boolean)
            .join(" "),
        });
        faceEl = undefined;
        veilFaceEl = undefined;
        if (face && !isPortrait) {
          faceEl = renderFace(face);
          content.append(faceEl);
        }
        const textColumn = el("div", { class: "dialogue-text-column" });
        bodyEl = el("div", { class: "body" });
        textColumn.append(bodyEl);
        content.append(textColumn);
        box.append(content);
        if (!wasOpen) {
          stageSlots = {};
        }
        if (face && isPortrait) {
          const idKey = portraitIdentityOf(speakerKey, face);
          if (isDualFullbodyVeil) {
            let speakerSide: "left" | "right";
            if (stageSlots.left && (stageSlots.left.idKey === idKey || (speakerKey !== "" && stageSlots.left.key === speakerKey))) {
              speakerSide = "left";
            } else if (stageSlots.right && (stageSlots.right.idKey === idKey || (speakerKey !== "" && stageSlots.right.key === speakerKey))) {
              speakerSide = "right";
            } else if (stageSlots.left && !stageSlots.right) {
              speakerSide = "right";
            } else if (stageSlots.right && !stageSlots.left) {
              speakerSide = "left";
            } else {
              speakerSide = face.position === "right" ? "right" : "left";
            }
            face = { ...face, position: speakerSide };
            faceForLine = face;
            stageSlots[speakerSide] = { key: speakerKey, idKey, face };
            const otherSide: "left" | "right" = speakerSide === "left" ? "right" : "left";
            if (!stageSlots[otherSide] || stageSlots[otherSide]?.idKey === idKey) {
              const partner = (listenerPortrait && portraitIdentityOf(listenerPortrait.key, listenerPortrait.face) !== idKey)
                ? { key: listenerPortrait.key, face: promoteFaceToFullPortrait(listenerPortrait.face) ?? listenerPortrait.face }
                : resolveDualStagePartner(activeProject, request.textContext?.session, speakerKey || speakerName || "", face);
              if (partner) {
                const partnerFace: FaceGraphic = { ...partner.face, position: otherSide };
                stageSlots[otherSide] = {
                  key: partner.key,
                  idKey: portraitIdentityOf(partner.key, partnerFace),
                  face: partnerFace,
                };
              }
            }
            const otherEntry = stageSlots[otherSide];
            listenerPortrait = otherEntry && otherEntry.idKey !== idKey
              ? { key: otherEntry.key, face: { ...otherEntry.face, position: otherSide } }
              : undefined;
          } else {
            if (wasOpen && lastPortrait && lastPortrait.key !== speakerKey) listenerPortrait = lastPortrait;
            else if (!wasOpen || listenerPortrait?.key === speakerKey) listenerPortrait = undefined;
            // 저작이 고른 듣는 사람(말을 다른 상대에게 돌린 줄) — 앞 화자보다 우선한다.
            if (request.listenerFace?.resourceId && (request.listenerFace.position === "right") !== (face.position === "right")) {
              listenerPortrait = { key: `listener:${request.listenerFace.resourceId}`, face: request.listenerFace };
            } else if (request.stageListener) listenerPortrait = undefined;
            // 인물은 저작된 자기 자리(왼쪽/오른쪽)를 장면 내내 지킨다. 듣는 사람이 화자와 같은 쪽 사람이면 반대편으로 옮겨
            // 그리지 않고 비운다 — 옮기면 그 인물이 대사마다 좌우를 맞바꾼다(첫사랑 r4: 오른쪽 자리 인물끼리의 대화).
            if (listenerPortrait && (listenerPortrait.face.position === "right" ? "right" : "left") === (face.position === "right" ? "right" : "left")) {
              listenerPortrait = undefined;
            }
          }
          // Attach to the message box so left/right tracks the window, not the full screen.
          box.classList.add("has-bust-face", `portrait-${portraitMode}`);
          // 하단 전신: 초상이 대사창 **뒤**에 서도록 상자 밖(오버레이의 상자 앞 형제)에 둔다.
          // 상자는 backdrop-filter 로 자기 쌓임 맥락을 만들어 안의 자식은 상자 배경 뒤로 갈 수 없다.
          const tallFull = portraitMode === "full" && position === "bottom";
          if (tallFull) {
            box.classList.add("portrait-full-tall");
          }
          if (face.position === "right") box.classList.add("bust-right");
          else box.classList.add("bust-left");
          overlay.classList.add("has-bust-face");
          faceEl = renderFace(face);
          if (tallFull) {
            styleBehindPortrait(faceEl, logicalHostHeight(host), face, isDualFullbodyVeil);
            behindPortraits.push(faceEl);
          if (isDualFullbodyVeil) {
            veilFaceEl = renderVeilSpeakerFace(face);
            if (veilFaceEl) {
              box.classList.add("has-veil-speaker-face");
              content.classList.add("has-veil-speaker-face");
              content.prepend(veilFaceEl);
            }
          }
          } else box.append(faceEl);
          if (listenerPortrait) {
            const side: FaceGraphic["position"] = face.position === "right" ? "left" : "right";
            const other = renderFace({ ...listenerPortrait.face, position: side });
            other.classList.add("dialogue-portrait-listener");
            other.dataset.testid = "dialogue-portrait-listener";
            box.classList.add("has-portrait-listener");
            if (tallFull) {
              styleBehindPortrait(other, logicalHostHeight(host), listenerPortrait.face, isDualFullbodyVeil);
              behindPortraits.push(other);
            } else box.append(other);
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
        // 대화 기록 단추 — 마우스로도 열 수 있게. 키는 L. 저작된 대사 시스템에서는 대사창에 단추를 두지 않는다(백로그는 L·휠·ESC 메뉴).
        if (!balloon && !dialogueSystemHasControls(system)) {
          const logButton = el("button", {
            class: "dialogue-log-button",
            text: "기록",
            attrs: { type: "button", "aria-label": "대화 기록 (L)" },
            dataset: { testid: "dialogue-log-button" },
          });
          logButton.addEventListener("click", (event) => {
            event.stopPropagation();
            if (logPanel || backlogViewIsOpen()) closeLog();
            else if (activeReading) activeReading.openBacklog();
            else openLog();
          });
          box.append(logButton);
        }
        overlay.append(box);
        if (glideFromPrevious) glideFromPreviousBox(box);
        else previousBoxTop = undefined;
        if (system) applyWindowOpacity(box, getEffectiveReadingPreferences(system.defaults).windowOpacity);
        // 상자 뒤 초상은 상자 **다음** 형제여야 퇴장 연출 선택자(`~`)가 닿는다. 쌓임은 z-index 가 정한다.
        overlay.append(...behindPortraits);
        // 이름표가 본문 첫 줄을 덮지 않게 여백을 재서 심는다. 오버레이에 붙인 **뒤**라야
        // offsetHeight 가 나오고, 줄 수를 세기 **전**이라야 그 줄 수가 실제 본문 칸을 본다.
        if (nameplate && !balloon) reserveSpeakerInset(box, nameplate);
        const measure = createDialogueTextMeasure(bodyEl);
        const baseWidth = balloon
          ? DIALOGUE_BALLOON_TEXT_WIDTH
          : overlay.dataset.monsterStyle === "emerald" && bodyEl.clientWidth > 0
            ? bodyEl.clientWidth
            // 상수로 계산한 폭은 상자의 실제 안쪽 폭보다 몇 px 넓을 수 있다(jrpg-real-1 J07: 282 대 280).
            // 실제 레이아웃이 있으면 둘 중 좁은 쪽을 쓴다 — 넓게 재면 40자 줄이 DOM 에서 한 번 더 접혀 4번째 줄이 잘린다.
            : Math.min(
              dialogueBodyWidth({ ...request, face }, position, logicalHostWidth(host), Boolean(veilFaceEl), uiScale),
              measuredBodyContentWidth(bodyEl) ?? Number.POSITIVE_INFINITY,
            );
        const maxLines = balloon ? DIALOGUE_BALLOON_MAX_LINES : dialogueMaxLines(bodyEl);
        pages = paginateDialogueSegments(segmentsAll, { maxWidth: baseWidth, measure, maxLines, fallbackCharWidth: DIALOGUE_FALLBACK_CHAR_WIDTH });
        // 안전망: 글꼴 폭 측정이 실제 렌더와 어긋나 한 줄이 더 접히면 페이지가 상자보다 길어진다. 실제로 붙여 보고
        // 넘치면 폭을 조금씩 줄여 다시 나눈다(글이 소리 없이 잘리는 것보다 줄이 조금 일찍 접히는 편이 낫다).
        if (!balloon) {
          for (let shrink = 1; shrink <= 8 && dialoguePagesOverflowBody(bodyEl, pages); shrink += 1) {
            pages = paginateDialogueSegments(segmentsAll, { maxWidth: Math.max(1, baseWidth - shrink * 4), measure, maxLines, fallbackCharWidth: DIALOGUE_FALLBACK_CHAR_WIDTH });
          }
          // 페이지를 나눈 **뒤에** 높이를 줄인다 — 줄 수 계산이 상자 높이를 먼저 봐야 하므로 순서가 바뀌면 순환한다.
          if (!face) fitDialogueBoxToPages(overlay, box, bodyEl, pages);
        }
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
      // 다음 글자가 나올 예정 시각(Date.now 기준 — 가짜 타이머 시험에서도 setTimeout 과 같은 시계를 탄다).
      let typeDue = 0;
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
        voice = dialogueVoiceFor(look, voiceUrl);
        const baseResourceForExpr = faceForLine?.resourceId ?? request.face?.resourceId;
        const nextFace = findSharedPortrait(baseResourceForExpr)
          ? dialogueFaceForEmotion(baseResourceForExpr, emotion, expression?.face)
          : expression?.face ?? appearancePortraitForEmotion(store.getCurrent(), baseResourceForExpr, emotion);
        if (nextFace && faceEl) {
          currentFaceId = nextFace;
          setFaceImage(faceEl, nextFace);
          if (veilFaceEl) {
            setFaceImage(veilFaceEl, resolveVeilCornerFaceResourceId(nextFace));
          }
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
        // ▼ 다음 쪽이 있다 / ■ 이 대사가 끝이다. 바로 뒤에 선택지가 오는 글은 끝 쪽도 ▼ — 결정 키 한 번이면 선택지가 이어진다.
        // 이 글은 스스로 닫지 않고 자기 결정 키를 기다린다(RPG 메이커 2000 과 같다). 2026-10-29 에 다 나오자마자 닫히게 했더니
        // 「계속」 하려고 누른 Enter/Z 가 이미 열린 선택지의 0번을 골라 엔딩 분기가 틀어졌다(마왕 편의점 데모 QA).
        // 그 결정 키 자체·누른 채 반복은 showChoices 의 isLeakedConfirmPress·repeat 거르기가 버린다.
        const endsHere = last && request.beforeChoices !== true;
        cursor.textContent = endsHere ? "■" : "▼";
        cursor.classList.toggle("is-end", endsHere);
        box.classList.add("page-ready");
        scheduleReading();
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
              typeDue = Date.now(); timer = window.setTimeout(typeStep, 0);
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
              typeDue = Date.now() + effect;
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
            const step = fastMode ? 0 : charDelayMs * rateFactor + pause;
            const now = Date.now();
            typeDue = Math.max(typeDue, now - DIALOGUE_TYPE_CATCHUP_MAX_MS) + step;
            // 예정보다 늦었으면 그만큼 덜 기다린다. 명목 간격보다 오래 기다리는 일은 없다(시계가 멈춘 시험에서도 옛 동작 그대로).
            timer = window.setTimeout(typeStep, Math.min(step, Math.max(0, typeDue - now)));
            return;
          }
        }
        completeTypedPage();
      };
      const startPage = (nextPageIndex: number): void => {
        clearTimeout(timer);
        clearReadTimer();
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
        typeDue = Date.now() + (fastMode ? 0 : charDelayMs);
        timer = window.setTimeout(typeStep, fastMode ? 0 : charDelayMs);
        // 스킵 중이면 이 쪽을 바로 채운다(안전 규칙에 걸리면 여기서 스킵이 꺼지고 평소처럼 흐른다).
        if (system && isSkipping()) reevaluate();
      };
      const advance = () => {
        if (settled || logPanel || hiddenByUser || backlogViewIsOpen()) return;
        clearReadTimer();
        if (waitingForControl) {
          waitingForControl = false;
          typing = true;
          box.classList.remove("page-ready");
          startMouth();
          typeDue = Date.now(); timer = window.setTimeout(typeStep, 0);
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
      // ── 읽기 보조: 오토·스킵·숨기기 ────────────────────────────────────────────
      // 안전 규칙은 순수 함수(project/dialogueSystem.ts skipVerdict·stopsReading)가 정하고, 여기는 그 답대로 타이머를 돌린다.
      // 선택지·엔딩 에필로그·[넘기기금지] 글·(읽은 글만 범위의) 안 읽은 글에서는 스킵이 꺼지고, 오토·스킵은 선택지를 절대 고르지 않는다.
      const sessionHost = sessionHostFor(request);
      const lineKey = dialogueReadKey(recorded?.speaker, recorded?.text ?? "");
      // 빈 글(제어 태그뿐)은 읽을 것이 없으니 읽은 글로 친다.
      const wasRead = !recorded || (system !== undefined && sessionHost !== undefined && isDialogueRead(sessionHost, lineKey));
      // 읽은 글 색 구분(vnLook readColor) — 이미 읽은 줄의 상자에 표시만 심는다. 색은 src/styles/vnLook.css.
      if (wasRead && recorded) box.dataset.vnReadLine = "1";
      if (system?.skip.enabled && sessionHost && recorded) markDialogueRead(sessionHost, lineKey);
      const lockedLine = segmentsAll.some((segment) => segment.controlsBefore?.some((control) => control.kind === "lock" && control.on) === true);
      let readTimer = 0;
      const clearReadTimer = (): void => {
        if (readTimer) window.clearTimeout(readTimer);
        readTimer = 0;
      };
      const readingBlocked = (): boolean =>
        hiddenByUser || backlogViewIsOpen() || logPanel !== undefined || (typeof document !== "undefined" && document.hidden)
        || (readingMode === "auto" && lineVoiceActive());
      const readAdvance = (): void => {
        readTimer = 0;
        if (settled) return;
        if (readingBlocked()) {
          readTimer = window.setTimeout(readAdvance, 250);
          return;
        }
        advance();
      };
      /** 스킵이 이 줄을 지나가도 되는가. 안 되면 스킵을 끄고 false. */
      const skipAllowed = (): boolean => {
        if (!system) return false;
        const verdict = skipVerdict({
          enabled: system.skip.enabled,
          scope: getEffectiveReadingPreferences(system.defaults).skipScope,
          isRead: wasRead,
          endingEpilogue: request.endingEpilogue === true,
          lockedText: lockedLine,
        });
        if (verdict.ok) return true;
        stopReading(verdict.reason);
        return false;
      };
      const scheduleReading = (): void => {
        clearReadTimer();
        if (settled || typing || waitingForControl || !system || request.autoAdvance === true) return;
        if (isSkipping()) {
          if (skipAllowed()) readTimer = window.setTimeout(readAdvance, SKIP_STEP_DELAY_MS);
        } else if (readingMode === "auto") {
          readTimer = window.setTimeout(readAdvance, autoAdvanceDelayMs(pageChars.length, getEffectiveReadingPreferences(system.defaults).autoSpeed));
        }
      };
      const reevaluate = (): void => {
        if (settled || !system) return;
        if (isSkipping()) {
          if (!skipAllowed()) return;
          if (waitingForControl) {
            waitingForControl = false;
            typing = true;
            box.classList.remove("page-ready");
            consumeRemainingPage();
            return;
          }
          if (typing && !locked) {
            consumeRemainingPage();
            return;
          }
        }
        scheduleReading();
      };
      const toggleMode = (mode: "auto" | "skip"): void => {
        if (settled || !system) return;
        if (mode === "auto" && !system.auto.enabled) return;
        if (mode === "skip" && !system.skip.enabled) return;
        readingMode = readingMode === mode ? "off" : mode;
        delete overlay.dataset.readingStop;
        if (readingMode === "off") clearReadTimer();
        reevaluate();
      };
      let dropHiddenListeners = (): void => {};
      const setHidden = (value: boolean): void => {
        if (settled || !system) return;
        if (!value) {
          dropHiddenListeners();
          setHiddenState(false);
          scheduleReading();
          return;
        }
        // 자동으로 넘어가는 줄(autoAdvance)은 숨겨 두면 사용자가 못 읽고 지나가므로 숨길 수 없다.
        if (!system.hideButton.enabled || request.autoAdvance === true || hiddenByUser || backlogViewIsOpen()) return;
        stopReading("manual");
        setHiddenState(true);
        const swallow = (event: Event): void => {
          event.preventDefault();
          event.stopPropagation();
        };
        const onPointer = (event: Event): void => {
          swallow(event);
          dropHiddenListeners();
          setHiddenState(false);
          scheduleReading();
          // 같은 누름의 click 이 게임(맵 터치 이동)에 닿지 않게 한 번 삼킨다.
          const swallowClick = (clickEvent: Event): void => {
            swallow(clickEvent);
            host.removeEventListener("click", swallowClick, true);
          };
          host.addEventListener("click", swallowClick, true);
          window.setTimeout(() => host.removeEventListener("click", swallowClick, true), 500);
        };
        const onHiddenKey = (event: KeyboardEvent): void => {
          if (event.key === "Control" || event.key === "Shift" || event.key === "Alt" || event.key === "Meta") return;
          swallow(event);
          // H 를 꾹 누르면 반복 keydown 이 숨김을 바로 되돌려 깜빡였다(적대 리뷰 D6). 반복은 삼키기만 한다.
          if (event.repeat) { event.stopImmediatePropagation(); return; }
          event.stopImmediatePropagation();
          dropHiddenListeners();
          setHiddenState(false);
          scheduleReading();
        };
        host.addEventListener("pointerdown", onPointer, true);
        document.addEventListener("keydown", onHiddenKey, true);
        dropHiddenListeners = (): void => {
          host.removeEventListener("pointerdown", onPointer, true);
          document.removeEventListener("keydown", onHiddenKey, true);
          dropHiddenListeners = (): void => {};
        };
      };
      const openBacklogForLine = (): void => {
        if (settled) return;
        stopReading("manual");
        if (hiddenByUser) setHidden(false);
        if (system?.backlog.enabled && sessionHost) {
          lastBacklog = { host: sessionHost, system };
          closeLog();
          openNewBacklog();
        } else if (logPanel) closeLog();
        else openLog();
      };
      const readingHandle = { reevaluate, clearTimer: clearReadTimer, toggle: toggleMode, openBacklog: openBacklogForLine, setHidden };
      activeReading = readingHandle;

      const onKey = (e: KeyboardEvent) => {
        // 텍스트 입력 컨트롤(런타임 디버그 패널)에 치는 Enter/Space 는 대사 진행이 아니다.
        // 한글 IME 는 key 를 Process 로 바꾸므로, 진행·취소는 물리 키를 본다.
        if (settled || e.repeat) return;
        const key = keyboardEventKey(e);
        if (key === "Process" || key === "Unidentified") return;
        if ((e.isComposing && key === e.key) || isTextEntryTarget(e.target)) return;
        if (system) {
          // Ctrl 은 누르는 동안만 스킵. 누르고 있다가 다른 키가 Ctrl 없이 눌리면(놓친 keyup) 스킵을 푼다.
          if (ctrlSkip && !e.ctrlKey) ctrlSkip = false;
          if (hiddenByUser) {
            // 숨김 중 아무 키나 누르면 돌아온다. 그 키는 게임에 닿지 않는다.
            e.preventDefault();
            e.stopImmediatePropagation();
            setHidden(false);
            return;
          }
          if (key === "Control" && system.skip.enabled && !backlogViewIsOpen()) {
            ctrlSkip = true;
            delete overlay.dataset.readingStop;
            reevaluate();
            return;
          }
          if (!e.ctrlKey && !e.metaKey && !e.altKey) {
            const shortcut = e.code === "KeyA" ? "auto" : e.code === "KeyS" ? "skip" : e.code === "KeyH" ? "hide" : undefined;
            const enabled = shortcut === "auto" ? system.auto.enabled : shortcut === "skip" ? system.skip.enabled : shortcut === "hide" ? system.hideButton.enabled : false;
            if (shortcut && enabled) {
              e.preventDefault();
              e.stopImmediatePropagation();
              if (shortcut === "hide") setHidden(true);
              else toggleMode(shortcut);
              return;
            }
          }
          // 오토·스킵 중 결정키·취소키는 읽기 보조만 끈다(글을 넘기지도, 메뉴를 열지도 않는다).
          if (readingMode !== "off" && (isDialogueAdvanceKey(key) || key === "Escape")) {
            e.preventDefault();
            e.stopImmediatePropagation();
            stopReading("manual");
            return;
          }
        }
        if (handleLogKey(e)) return;
        if (isDialogueAdvanceKey(key)) {
          e.preventDefault();
          e.stopImmediatePropagation();
          advance();
        }
      };
      const onKeyUp = (e: KeyboardEvent): void => {
        if (e.key === "Control" && ctrlSkip) {
          ctrlSkip = false;
          scheduleReading();
        }
      };
      const onBlur = (): void => {
        if (!ctrlSkip) return;
        ctrlSkip = false;
        scheduleReading();
      };
      const onBoxClick = (): void => {
        // 오토·스킵 중 클릭은 읽기 보조만 끈다.
        if (readingMode !== "off" || ctrlSkip) {
          stopReading("manual");
          return;
        }
        advance();
      };
      let wheelUp = 0;
      let wheelAt = 0;
      const onBoxWheel = (e: WheelEvent): void => {
        // 휠을 위로 굴리면 백로그(저작된 시스템에서 켜졌을 때만).
        if (e.deltaY >= 0 || !system?.backlog.enabled || settled) return;
        // 트랙패드 핀치(ctrlKey)와 백로그를 닫은 직후의 관성 스크롤은 열기가 아니다. 짧은 시간 안에 쌓인 위로 굴림이 문턱을 넘어야 연다(적대 리뷰 D5).
        if (e.ctrlKey || backlogRecentlyClosed(WHEEL_REOPEN_COOLDOWN_MS)) return;
        const now = Date.now();
        wheelUp = now - wheelAt > WHEEL_OPEN_WINDOW_MS ? -e.deltaY : wheelUp - e.deltaY;
        wheelAt = now;
        if (wheelUp < WHEEL_OPEN_THRESHOLD) return;
        wheelUp = 0;
        e.preventDefault();
        openBacklogForLine();
      };
      const cleanup = () => {
        cancelEnter();
        clearTimeout(timer);
        clearReadTimer();
        dropHiddenListeners();
        if (activeReading === readingHandle) activeReading = undefined;
        document.removeEventListener("keyup", onKeyUp);
        if (typeof window !== "undefined") window.removeEventListener("blur", onBlur);
        box.removeEventListener("wheel", onBoxWheel);
        stopMouth();
        if (balloonRaf && typeof cancelAnimationFrame === "function") cancelAnimationFrame(balloonRaf);
        box.removeEventListener("click", onBoxClick);
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
      box.addEventListener("click", onBoxClick);
      box.addEventListener("wheel", onBoxWheel, { passive: false });
      document.addEventListener("keydown", onKey);
      document.addEventListener("keyup", onKeyUp);
      if (typeof window !== "undefined") window.addEventListener("blur", onBlur);
      startPage(0);
    });
  }

  function showChoices(request: DialogueChoicesRequest): Promise<number> {
    if (request.signal?.aborted) return Promise.reject(new DOMException("Choice cancelled", "AbortError"));
    // 대사 직후 선택지는 같은 창 세션이다 — 여기서 진입 연출을 다시 재생하면 안 된다.
    const system = systemFor(request);
    if (request.reading !== "off") setAuthoredPreferenceDefaults(system?.defaults);
    // 선택지는 사람이 직접 고른다 — 오토·스킵은 여기서 반드시 멈춘다.
    stopReading("choices");
    const wasOpen = takeOverOverlay();
    return new Promise<number>((resolve, reject) => {
      const activeProject = (request.textContext?.project && "system" in request.textContext.project ? request.textContext.project as Project : undefined) ?? store.getCurrent();
      const choiceLook = request.look ?? resolveDialogueLook(activeProject);
      const rawVnLook = resolveVnLook(activeProject);
      const effectiveVnLook = choiceLook.style === DUAL_FULLBODY_VEIL_PRESET_ID && (!rawVnLook || rawVnLook.source === "setting-default")
        ? resolveAuthoredVnLook({ version: 1, preset: DUAL_FULLBODY_VEIL_PRESET_ID }, "setting-default")
        : rawVnLook;
      const isDualFullbodyVeil = choiceLook.style === DUAL_FULLBODY_VEIL_PRESET_ID || effectiveVnLook?.preset === DUAL_FULLBODY_VEIL_PRESET_ID;
      // 선택지는 바로 앞 대사 상자와 같은 자리에 선다(같은 세션 안에서 창이 위로 뛰지 않게). 앞 창이 없으면 대사와 같은 규칙으로 정한다.
      const anchorPosition = wasOpen ? lastBoxPosition : undefined;
      const framePrevious = previousTextBox;
      previousTextBox = undefined;
      if (anchorPosition) overlay.dataset.dialoguePositionReason = "previous-box";
      const position = anchorPosition
        ? (overlay.classList.add(`position-${anchorPosition}`), anchorPosition)
        : applyOverlayPosition(overlay, request, isDualFullbodyVeil);
      lastBoxPosition = position;
      overlay.classList.add("choices-active");
      if (request.options.length >= 4) overlay.classList.add("choices-compact");
      const choicesWindow = dialogueBox("choices", "dialogue-box");
      applyDialogueLook(overlay, choicesWindow, choiceLook);
      applyVnLook(overlay, effectiveVnLook);
      const uiScale = isDualFullbodyVeil ? Math.max(1, Math.round((logicalHostHeight(host) / PLAY_RESOLUTION.height) * 1000) / 1000) : 1;
      if (isDualFullbodyVeil) {
        overlay.dataset.dialogueStage = DUAL_FULLBODY_VEIL_PRESET_ID;
        if (uiScale > 1) overlay.style.setProperty("--dialogue-ui-scale", String(uiScale));
        else overlay.style.removeProperty("--dialogue-ui-scale");
      } else {
        delete overlay.dataset.dialogueStage;
        overlay.style.removeProperty("--dialogue-ui-scale");
      }
      applyTextSettings(overlay, choicesWindow, request, position);
      const choicesProfile = dialoguePresentationProfile(undefined, {
        reducedMotion: resolveReducedMotion(undefined),
      });
      applyDialoguePresentation(choicesWindow, choicesProfile);
      applyDialogueScrim(scrim, choicesProfile, position);
      activeExitMs = choicesProfile.exitMs;
      const choiceBehindPortraits: HTMLElement[] = [];
      if (isDualFullbodyVeil && (stageSlots.left || stageSlots.right)) {
        overlay.classList.add("has-bust-face");
        choicesWindow.classList.add("has-bust-face", "portrait-full", "portrait-full-tall");
        const hostHeight = logicalHostHeight(host);
        if (stageSlots.left) {
          const leftEl = renderFace({ ...stageSlots.left.face, position: "left" });
          styleBehindPortrait(leftEl, hostHeight, stageSlots.left.face, true);
          choiceBehindPortraits.push(leftEl);
        }
        if (stageSlots.right) {
          const rightEl = renderFace({ ...stageSlots.right.face, position: "right" });
          rightEl.classList.add("dialogue-portrait-listener");
          styleBehindPortrait(rightEl, hostHeight, stageSlots.right.face, true);
          choiceBehindPortraits.push(rightEl);
        }
      }
      const choicesEl = el("div", { class: "choice-list", dataset: { testid: "runtime-choices" } });
      // 고정 틀: 대사 상자 크기·자리는 그대로 두고, 선택지 칸은 그 위(창이 위에 있으면 아래)에 따로 뜬다.
      // 틀에는 질문(prompt)이, 질문이 없으면 바로 앞 대사가 그대로 남는다. 둘 다 없으면 빈 틀이다.
      const frame = choiceFrame(request, framePrevious, choiceLook);
      // 질문은 틀 본문에만 있다. 목록이 그 노드를 이름으로 삼아야 포커스가 단추에 있어도 질문이 읽힌다.
      const promptId = frame.dataset.choicePromptId;
      if (promptId) choicesEl.setAttribute("aria-labelledby", promptId);
      else choicesEl.setAttribute("aria-label", dialogueUiText(system, "backlog.choice"));
      if (frame) {
        overlay.classList.add("choices-framed");
        applyTextSettings(overlay, frame, request, position);
      }
      if (request.prompt && !frame) {
        const promptEl = el("div", {
          class: "choice-prompt-row",
        });
        renderDialogueSegments(promptEl, parseDialogueText(request.prompt, request.textContext));
        choicesEl.append(promptEl);
      }

      let onKey: (event: KeyboardEvent) => void;
      let settled = false;
      // 앞 대사를 넘긴 그 Enter 가 선택지를 고르지 않게 한다. 대사를 닫는 keydown 안에서 선택지가 열리고 0번 단추에
      // 포커스가 가면, 브라우저가 같은 키의 기본 동작으로 그 단추를 「클릭」해 플레이어가 보지도 못한 선택이 된다
      // (첫사랑 VQA 4차 — 마지막 선택이 저절로 골라져 엔딩까지 흘러감). 키보드 결정은 onKey 가 따로 받으므로
      // 열린 직후, 이 선택지가 keydown 을 하나도 받지 않은 채 들어온 키보드발 클릭(detail 0)만 버린다.
      const openedAt = performance.now();
      let sawKeyDown = false;
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
        recordChoice(request, index);
        cleanup();
        if (frame) frame.dataset.dialoguePhase = "exit";
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
        if (selected?.isConnected && choicesEl.scrollHeight > choicesEl.clientHeight + 1) {
          // 창이 보이는 화면 상한까지 자라고도 넘칠 때만 목록이 스크롤된다(모든 스타일 공통).
          // Scroll only the choice list, never the page/game stage.
          const item = selected.getBoundingClientRect(), list = choicesEl.getBoundingClientRect();
          const scale = choicesEl.clientHeight > 0 ? list.height / choicesEl.clientHeight : 1;
          if (scale > 0 && item.bottom > list.bottom) choicesEl.scrollTop += (item.bottom - list.bottom) / scale;
          else if (scale > 0 && item.top < list.top) choicesEl.scrollTop -= (list.top - item.top) / scale;
        }
      };
      onKey = (e: KeyboardEvent) => {
        if (settled || isTextEntryTarget(e.target)) return;
        const key = keyboardEventKey(e);
        if (key === "Process" || key === "Unidentified") return;
        if (e.isComposing && key === e.key) return;
        // 앞 대사를 넘기던 결정 키 연타가 선택지를 고르지 않게 한다(confirmMashGuard): 열리기 전·열린 뒤 300ms 안에 누른 결정 키,
        // 바로 앞 결정 키에서 450ms 안에 이어 누른 결정 키는 버린다. 손을 멈췄다 새로 누르거나 커서를 옮긴 뒤의 결정만 받는다.
        // 첫사랑 r11·r8(선택지 등장과 Enter 가 같은 0.1초), 회귀 벤치 ebfe-sl 방탈출·추리 A8 「Enter 10번」(연타 간격 250~400ms).
        // 숫자 키(바로 고르기)도 열린 직후에는 버린다. 플레이어 입력(실제 키·패드)만 막는다 — 단위 테스트 합성 키는 지나간다.
        if (isLeakedConfirmPress(e, openedAt)
          || (isPlayerKeyInput(e) && e.timeStamp - openedAt < OPEN_GRACE_MS && /^[1-9]$/.test(key))) {
          e.preventDefault();
          return;
        }
        sawKeyDown = true;
        if (e.repeat && (isConfirmKey(key) || isCancelKey(key) || /^[1-9]$/.test(key))) {
          e.preventDefault();
          return;
        }
        const n = parseInt(key, 10);
        if (!isNaN(n) && n >= 1 && n <= request.options.length && !document.querySelector("[data-testid='title-screen']")) {
          e.preventDefault();
          e.stopPropagation();
          finish(n - 1);
          return;
        }
        // 취소는 X/Esc 둘 다. 선택지에서 X 만 죽어 있던 결함(적대 리뷰 5).
        if (isCancelKey(key)) {
          const cancelIndex = cancelChoiceIndex(request.cancelBehavior, request.options.length);
          if (cancelIndex !== null) {
            e.preventDefault();
            finish(cancelIndex);
          }
          return;
        }
        // 필드·전투·상태 메뉴와 같이 W/S 도 위아래다. ←→ 는 받지 않는다 — 패드 스틱이
        // 대각선이면 ArrowDown 과 ArrowRight 가 한 번에 오고, 둘 다 「다음」이면 한 줄을 건너뛴다.
        const dir = directionForKey(key);
        if (dir === "up" || dir === "down") {
          e.preventDefault();
          const delta = dir === "up" ? request.options.length - 1 : 1;
          setSelected((selectedIndex + delta) % request.options.length);
          return;
        }
        // 결정은 Z/Enter/Space/E. Enter·Space 만 받아서 대사를 Z 로 넘기다가
        // 선택지가 뜨는 순간 Z 가 죽던 결함(적대 리뷰 1).
        if (isConfirmKey(key)) {
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
        btn.addEventListener("click", (event) => {
          if (event.isTrusted && event.detail === 0 && !sawKeyDown && performance.now() - openedAt < 400) return;
          finish(idx);
        });
        buttons.push(btn);
        choicesEl.append(btn);
      });
      choicesEl.setAttribute("role", "listbox");
      setSelected(0);

      cancelActiveChoice = abort;
      request.signal?.addEventListener("abort", abort, { once: true });
      document.addEventListener("keydown", onKey);

      choicesWindow.append(choicesEl);
      if (frame) overlay.append(frame);
      overlay.append(choicesWindow, ...choiceBehindPortraits);
      // 질문은 타이핑되지 않는다. 창이 붙는 순간 한 번만 알린다 — 글자마다 갱신하면 질문이 조각나 읽힌다.
      if (promptId) {
        const announcement = el("div", {
          class: "dialogue-choice-announcement",
          dataset: { testid: "dialogue-choice-announcement" },
          attrs: { role: "status", "aria-atomic": "true" },
        });
        overlay.append(announcement);
        announcement.textContent = document.getElementById(promptId)?.textContent?.trim() ?? "";
      }
      if (system) applyWindowOpacity(choicesWindow, getEffectiveReadingPreferences(system.defaults).windowOpacity);
      if (system && frame) applyWindowOpacity(frame, getEffectiveReadingPreferences(system.defaults).windowOpacity);
      if (frame) beginEnter(frame, choicesProfile.enterMs, !wasOpen);
      beginEnter(choicesWindow, choicesProfile.enterMs, !wasOpen);
    });
  }

  /** 즉시 컷. 퇴장 예약이 걸려 있으면 취소하고 바로 비운다. */
  function hide(): void {
    stopReading("boundary");
    stopLineVoice();
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
    stageSlots = {};
    lastLineForcedBottom = false;
    previousBoxTop = undefined;
    sessionPosition = undefined;
    lastBoxPosition = undefined;
  }

  /** 퇴장 연출을 재생한 뒤 비운다. 이미 예약이 걸려 있으면 그대로 둔다. */
  function close(): void {
    stopReading("boundary");
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
      stopReading("choices");
      takeOverOverlay();
      return showNumberInput(overlay, request, { applyTextSettings, resetOverlay });
    },
    hide,
    close,
    openLog,
    closeLog,
    dialogueLog: () => [...logEntries],
    stopReading,
    readingMode: () => (isSkipping() ? "skip" : readingMode),
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
  else {
    node.style.backgroundImage = `url("${url}")`;
    if (node.classList.contains("dialogue-face-bust")) {
      delete node.dataset.bustPixel;
      applyPixelBust(node, url);
    }
  }
  node.dataset.resourceId = resourceId;
  if (node.dataset.portraitRender) node.dataset.portraitRender = sharedPortraitRendering(resourceId);
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
    // \T[id] — 문자열 변수(자유 텍스트 입력 결과). id 는 숫자가 아니어도 된다.
    if (control === "t" && value[i + 2] === "[") {
      const end = value.indexOf("]", i + 3);
      if (end >= 0) {
        buffer += context?.session.stringVariables?.[value.slice(i + 3, end).trim()] ?? "";
        i = end;
        continue;
      }
    }
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

function dialogueBodyWidth(
  request: DialogueTextRequest,
  position: MessageWindowPosition,
  hostWidth: number,
  hasVeilCornerFace = false,
  uiScale = 1,
): number {
  const baseWidth = hostWidth
    - (DIALOGUE_OVERLAY_HORIZONTAL_PADDING[position]
      + DIALOGUE_BOX_HORIZONTAL_PADDING
      + DIALOGUE_BOX_HORIZONTAL_BORDER) * uiScale;
  const portraitMode = dialoguePortraitMode(request.face);
  const faceWidth = hasVeilCornerFace
    ? Math.round((44 + DIALOGUE_FACE_COLUMN_GAP) * uiScale)
    : !request.face
      ? 0
      : portraitMode === "full"
        // 하단 전신은 대사창 뒤에 서므로 글이 왼쪽 끝부터 나온다(여백 0).
        ? position === "bottom" ? 0 : DIALOGUE_FULL_TEXT_RESERVE
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
/**
 * 한 줄짜리 대사가 화면의 22% 를 덮지 않게, 가장 긴 페이지의 줄 수만큼으로 상자 높이를 맞춘다.
 * 위·아래 자리의 일반 상자만 건드린다. 말풍선·에메랄드·VN 페이지·전신 무대·초상 상자는 저작한 높이를 그대로 둔다.
 */
function fitDialogueBoxToPages(
  overlay: HTMLElement,
  box: HTMLElement,
  bodyEl: HTMLElement,
  pages: ReadonlyArray<{ lines: ReadonlyArray<unknown> }>,
): void {
  if (!overlay.classList.contains("position-top") && !overlay.classList.contains("position-bottom")) return;
  if (bodyEl.closest('[data-monster-style="emerald"], [data-vn-layout="page"]') || overlay.dataset.dialogueStage) return;
  const view = bodyEl.ownerDocument?.defaultView;
  if (!view || bodyEl.clientHeight <= 0) return;
  const needed = Math.max(1, ...pages.map((page) => page.lines.length));
  const computed = view.getComputedStyle(bodyEl);
  const lineHeight = parseFloat(computed.lineHeight) || parseFloat(computed.fontSize) * 1.2;
  if (!Number.isFinite(lineHeight) || lineHeight <= 0) return;
  if (needed * lineHeight >= bodyEl.clientHeight - 0.5) return;
  overlay.style.height = "auto";
  box.style.minHeight = "0";
  bodyEl.style.flex = "0 0 auto";
  bodyEl.style.minHeight = `${Math.ceil(needed * lineHeight)}px`;
}

function dialogueMaxLines(bodyEl: HTMLElement): number {
  // 풀스크린 글 페이지(vnLook layout=page)는 상자가 화면을 채우므로 한 페이지에 여러 줄(상한 9)이 들어간다.
  const cap = bodyEl.closest('[data-monster-style="emerald"]') ? 2 : bodyEl.closest('[data-vn-layout="page"]') ? 9 : DIALOGUE_VISIBLE_LINES;
  return Math.min(cap, derivedDialogueMaxLines(bodyEl));
}

function derivedDialogueMaxLines(bodyEl: HTMLElement): number {
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

/** 본문 칸의 실제 글자 폭(padding 제외). 레이아웃이 없으면 undefined. */
function measuredBodyContentWidth(bodyEl: HTMLElement): number | undefined {
  const view = bodyEl.ownerDocument?.defaultView;
  const width = bodyEl.clientWidth;
  if (!view || !Number.isFinite(width) || width <= 0) return undefined;
  const style = view.getComputedStyle(bodyEl);
  const inner = width - (parseFloat(style.paddingLeft) || 0) - (parseFloat(style.paddingRight) || 0);
  return inner > 0 ? inner : undefined;
}

/** 각 페이지를 본문 칸에 실제로 붙여 보고 세로로 넘치는 페이지가 있는지 본다(레이아웃이 없으면 false). */
function dialoguePagesOverflowBody(bodyEl: HTMLElement, pages: readonly DialoguePage[]): boolean {
  if (!bodyEl.clientHeight || bodyEl.clientHeight <= 0) return false;
  const saved = bodyEl.textContent;
  try {
    for (const page of pages) {
      bodyEl.textContent = page.segments.map((segment) => segment.text).join("");
      if (bodyEl.scrollHeight > bodyEl.clientHeight + 1) return true;
    }
    return false;
  } finally {
    bodyEl.textContent = saved;
  }
}

/**
 * 선택지 동안 자리를 지키는 대사 상자 「틀」. 질문이 있으면 질문을 본문으로 쓴 새 상자, 없으면 바로 앞 대사 상자의 사본
 * (이름표·얼굴·글 그대로, 입력은 받지 않는다). 앞 대사도 질문도 없으면 빈 상자다 — 다음 대사가 이 자리·이 높이로 이어진다.
 */
function choiceFrame(request: DialogueChoicesRequest, previous: HTMLElement | undefined, look: DialogueLook): HTMLElement {
  let frame: HTMLElement;
  let promptBody: HTMLElement | undefined;
  if (!request.prompt && previous) {
    frame = previous.cloneNode(true) as HTMLElement;
    frame.querySelectorAll(".dialogue-page-cursor, .continue-hint, .dialogue-log-button").forEach((node) => node.remove());
    frame.classList.remove("page-ready", "dialogue-beat-shake");
    for (const key of ["dialogueShake", "dialogueFlash", "dialogueCharReveal", "dialogueBeats"]) delete frame.dataset[key];
    // 앞 대사의 사본은 이미 읽힌 글이다. 장식만 남기고 접근성 트리에서는 뺀다.
    frame.setAttribute("aria-hidden", "true");
  } else {
    frame = dialogueBox("", "dialogue-choice-frame");
    const content = el("div", { class: "dialogue-content" });
    const column = el("div", { class: "dialogue-text-column" });
    const body = el("div", { class: "body" });
    if (request.prompt) {
      renderDialogueSegments(body, parseDialogueText(request.prompt, request.textContext));
      choicePromptSerial += 1;
      body.id = `dialogue-choice-prompt-${choicePromptSerial}`;
      promptBody = body;
    } else {
      frame.setAttribute("aria-hidden", "true");
    }
    column.append(body);
    content.append(column);
    frame.append(content);
    frame.dataset.dialogueStyle = look.style;
  }
  frame.classList.add("choices-frame");
  frame.dataset.testid = "dialogue-choice-frame";
  frame.removeAttribute("data-play-input-owner");
  // 질문이 있는 틀은 숨기지 않는다. aria-hidden 조상 안의 글은 목록 이름(aria-labelledby)으로도 버려진다.
  if (promptBody) frame.dataset.choicePromptId = promptBody.id;
  return frame;
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
  stampEmeraldSurface(box, store.getCurrent(), "dialogue-box");
  return box;
}

/**
 * 이름표로 보일 화자. 「내레이션」 같은 서술 표기는 인물이 아니다 — 생성 모델이 서술 줄에 speaker:"내레이션" 을
 * 달아 엔딩 에필로그에 「내레이션」 이름표가 떴다(2026-09-24 추리 도그푸딩). 이름표 없이 서술로 보인다.
 */
const NARRATION_SPEAKER = /^(?:내레이션|나레이션|해설|서술|narration|narrator)$/iu;

/** 본문 앞에 이름표와 같은 이름이 또 붙어 있으면 걷은 요청을 돌려준다(dialogueSpeakerEcho.ts). */
function withoutSpeakerEcho(request: DialogueTextRequest): DialogueTextRequest {
  const raw = request.speaker?.trim();
  if (!nameplateSpeaker(raw)) return request;
  const plate = resolveDialogueSpeakerName(raw, request.textContext);
  const byRaw = stripSpeakerEcho(request.body, raw);
  const body = plate && plate !== raw && byRaw === request.body ? stripSpeakerEcho(request.body, plate) : byRaw;
  return body === request.body ? request : { ...request, body };
}

/**
 * 이름표·화자 프로필에 쓸 이름. `\n[1]`·`\v[1]`·`\t[id]` 는 본문과 같은 규칙으로 푼다.
 * 코드가 비면(없는 배우 번호) 원문을 남겨 오타가 이름표에 그대로 보이게 한다.
 */
export function resolveDialogueSpeakerName(speaker: string | undefined, context?: DialogueTextContext): string | undefined {
  const name = speaker?.trim();
  if (!name) return undefined;
  if (!context || !name.includes("\\")) return name;
  const resolved = resolveDialogueText(name, context).trim();
  return resolved || name;
}

export function nameplateSpeaker(speaker: string | undefined, context?: DialogueTextContext): string | undefined {
  const raw = speaker?.trim();
  if (!raw || NARRATION_SPEAKER.test(raw)) return undefined;
  return resolveDialogueSpeakerName(raw, context);
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
  appliedPosition?: MessageWindowPosition,
  forceBottom = false,
  sessionAnchor?: MessageWindowPosition
): MessageWindowPosition {
  const settings = request.settings ?? DEFAULT_MESSAGE_WINDOW_SETTINGS;
  const position = appliedPosition ?? applyOverlayPosition(overlay, request, forceBottom, sessionAnchor);
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

const vnVarNames = new WeakMap<HTMLElement, readonly string[]>();

/**
 * 미연시 대사창 룩(meta.oprnVnLook · 연애 기본 룩)을 오버레이에 심는다. 룩이 없으면 이전 값을 걷어 옛 대사창 그대로 둔다.
 * 해석은 src/project/vnLook.ts 한 곳, 모양은 src/styles/vnLook.css 한 곳이다.
 */
function applyVnLook(overlay: HTMLElement, look: ResolvedVnLook | undefined): ResolvedVnLook | undefined {
  for (const key of Object.keys(overlay.dataset)) if (key.startsWith("vn")) delete overlay.dataset[key];
  for (const name of vnVarNames.get(overlay) ?? []) overlay.style.removeProperty(name);
  vnVarNames.delete(overlay);
  if (!look) return undefined;
  const attrs = vnLookAttributes(look);
  for (const [key, value] of Object.entries(attrs.dataset)) overlay.dataset[key] = value;
  for (const [name, value] of Object.entries(attrs.vars)) overlay.style.setProperty(name, value);
  vnVarNames.set(overlay, Object.keys(attrs.vars));
  return look;
}

/**
 * 창 자리 하나를 정한다. 순서: 초상 규칙(흉상·전신은 아래) → 열린 세션의 자리(가림 피하기가 켜진 줄만 물려받는다 —
 * 저자가 못박은 자리는 그대로 따른다) → 가림 피하기 판정 → 저작한 자리.
 */
function applyOverlayPosition(
  overlay: HTMLElement,
  request: DialogueSurfaceSettings,
  forceBottom = false,
  sessionAnchor?: MessageWindowPosition
): MessageWindowPosition {
  const settings = request.settings ?? DEFAULT_MESSAGE_WINDOW_SETTINGS;
  const position: MessageWindowPosition = forceBottom
    ? "bottom"
    : sessionAnchor && settings.preventObscuringPlayer
      ? sessionAnchor
      : effectivePosition({
        settings,
        playerTileY: request.playerTileY,
        mapHeight: request.mapHeight,
        ...(request.playerScreenY === undefined ? {} : { playerScreenY: request.playerScreenY }),
      });
  overlay.classList.add(`position-${position}`);
  // QA·디버그용 근거(무엇이 이 자리를 정했나). 화면에는 쓰이지 않는다.
  overlay.dataset.dialoguePositionReason = forceBottom
    ? "portrait"
    : sessionAnchor && settings.preventObscuringPlayer
      ? "session"
      : !settings.preventObscuringPlayer
        ? "fixed"
        : request.playerScreenY !== undefined ? `auto:${request.playerScreenY.toFixed(2)}` : `auto-tile:${request.playerTileY}/${request.mapHeight}`;
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

/** 창이 덮는 화면 띠의 높이 비율(창 약 0.29 + 주인공 스프라이트 반 키 여유). 주인공 중심이 이 띠 안이면 가린다. */
const DIALOGUE_OBSCURE_BAND = 0.36;

function effectivePosition(model: {
  readonly settings: MessageWindowSettings;
  readonly playerTileY: number;
  readonly mapHeight: number;
  readonly playerScreenY?: number;
}): MessageWindowPosition {
  if (!model.settings.preventObscuringPlayer) return model.settings.position;
  const maxY = Math.max(1, model.mapHeight - 1);
  // 화면 속 높이를 알면(카메라를 거친 값) 저작한 자리가 주인공을 **실제로 덮을 때만** 반대쪽으로 보낸다.
  // 예전 규칙(가운데 0.5 를 넘으면 위)은 화면 가운데 근처에 선 주인공에서 줄마다·세션마다 창을 위↔아래로 뒤집었다
  // (2026-10-22 아스트라 호라이즌: 덮지도 않는 아래 창이 위로 올라갔다가 선택지에서 다시 아래로). 창 띠는
  // DIALOGUE_OBSCURE_BAND(창 높이 약 30% + 주인공 반 키) — 그 안에 주인공 중심이 들어와야 가린다고 본다.
  if (model.playerScreenY !== undefined) {
    const y = model.playerScreenY;
    if (model.settings.position === "top") return y < DIALOGUE_OBSCURE_BAND ? "bottom" : "top";
    if (model.settings.position === "bottom") return y > 1 - DIALOGUE_OBSCURE_BAND ? "top" : "bottom";
    return y <= 0.5 ? "bottom" : "top";
  }
  const normalizedY = model.playerTileY / maxY;
  if (normalizedY <= 0.35) return "bottom";
  if (normalizedY >= 0.65) return "top";
  return model.settings.position;
}

/** 초상을 기다리는 상한. 넘으면 예전처럼 창을 먼저 열고 초상은 받는 대로 보인다. */
const LINE_PORTRAIT_WAIT_MAX_MS = 1500;
/** 받아 둔 작은 얼굴(48px) 그림 주소. 흉상은 bustPixelate 가 따로 센다. */
const settledFaceUrls = new Set<string>();

function runningUnderTest(): boolean {
  const env = import.meta.env as { readonly VITEST?: boolean; readonly MODE?: string } | undefined;
  return env?.VITEST === true || env?.MODE === "test";
}

type PendingLinePortrait = { readonly url: string; readonly kind: "bust" | "face" };

/**
 * 이 줄이 그릴 초상(화자·표정 변형·듣는 사람) 중 아직 받지 않은 것. 비면 창을 바로 연다.
 * 단위 테스트(happy-dom 은 그림을 받지 않는다)와 그림을 받을 수 없는 환경에서는 늘 비어 있다 — 옛 동기 경로 그대로.
 */
function unsettledLinePortraits(request: DialogueTextRequest, look: DialogueLook, project: Project): PendingLinePortrait[] {
  if (runningUnderTest() || typeof window === "undefined" || typeof Image === "undefined") return [];
  if (look.hideFace || look.container === "balloon") return [];
  const faces: FaceGraphic[] = [];
  if (request.face?.resourceId) {
    faces.push(request.face);
    const variant = faceForDialogueEmotion(project, request.face.resourceId, look.emotion, look.expressionFace);
    if (variant && variant !== request.face.resourceId) faces.push({ ...request.face, resourceId: variant });
  }
  if (request.listenerFace?.resourceId) faces.push(request.listenerFace);
  const pending: PendingLinePortrait[] = [];
  for (const face of faces) {
    const url = safeResourceImageUrl(resolveAssetResourceUrl(face.resourceId, { project: store.getCurrent() }));
    if (!url || pending.some((entry) => entry.url === url)) continue;
    const kind = dialoguePortraitMode(face) === "face" ? "face" : "bust";
    if (kind === "bust" ? pixelBustSettled(url) : settledFaceUrls.has(url)) continue;
    pending.push({ url, kind });
  }
  return pending;
}

function waitForLinePortraits(pending: readonly PendingLinePortrait[], signal: AbortSignal | undefined): Promise<void> {
  const loads = Promise.all(pending.map((entry) => entry.kind === "bust"
    ? preloadPixelBust(entry.url)
    : warmImageUrl(entry.url).then(() => { settledFaceUrls.add(entry.url); })));
  return new Promise<void>((resolve) => {
    let done = false;
    const finish = (): void => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      signal?.removeEventListener("abort", finish);
      resolve();
    };
    const timer = window.setTimeout(finish, LINE_PORTRAIT_WAIT_MAX_MS);
    signal?.addEventListener("abort", finish, { once: true });
    void loads.then(finish, finish);
  });
}

function dialoguePortraitMode(face: FaceGraphic | undefined): "face" | "bust" | "full" {
  if (!face?.resourceId) return "face";
  return face.presentation ?? facePresentationForResource(face.resourceId);
}

/** 흉상·전신이 그 자리(왼쪽/오른쪽)에서 화면 바깥을 보는가 — 원래 시선을 아는 그림만(모르면 그대로 둔다). */
function portraitLooksOutward(resourceId: string, side: "left" | "right"): boolean {
  const gaze = sharedPortraitNativeGaze(resourceId);
  return gaze !== null && gaze === side;
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
    const bust = el("div", {
      class: [
        "dialogue-face",
        "dialogue-face-bust",
        `dialogue-face-${mode}`,
        `dialogue-face-side-${side}`,
        face.flipHorizontally ? "flipped" : "",
        // 그림의 원래 시선이 화면 바깥쪽이면 거울로 뒤집어 대화창 가운데(상대)를 보게 한다. 저작된 flipped 는 그 위에서 한 번 더 뒤집는다.
        portraitLooksOutward(face.resourceId, side) ? "gaze-mirror" : "",
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
        portraitRender: sharedPortraitRendering(face.resourceId),
      },
    });
    // 그림(또는 에메랄드 화면의 도트 변환본)이 준비될 때까지 숨긴다 — 빈 틀이 먼저 보였다(2026-10-21 아스트라 첫 10분 녹화).
    bust.style.visibility = "hidden";
    applyPixelBust(bust, url, () => { bust.style.visibility = ""; });
    return bust;
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

/** Quoted CSS `url("…")` 를 닫거나 이스케이프하는 글자. */
const DIALOGUE_CSS_URL_BREAK = /["\\\u0000-\u001f\u007f]/u;
const DIALOGUE_ROOT_IMAGE_URL = /^\/[A-Za-z0-9/_\-.]+\.(?:png|jpe?g|webp|gif)$/iu;
const DIALOGUE_DATA_IMAGE_URL = /^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/iu;
const DIALOGUE_ASSET_SCHEME_URL = /^oprn-asset:\/\/[^/?#]+\/[0-9a-f]{64}$/iu;
const DIALOGUE_ASSET_HOST_URL = /^\/__oprn\/asset\/(?:[^/?#]+\/)?[0-9a-f]{64}$/iu;
const DIALOGUE_HTTP_IMAGE_EXT = /\.(?:png|jpe?g|webp|gif)$/iu;

function safeResourceImageUrl(url: string | null): string | null {
  if (url === null || DIALOGUE_CSS_URL_BREAK.test(url)) return null;
  // 묶음 얼굴·초상은 루트 경로다. 올린 그림은 png/jpeg 뿐 아니라 webp·gif 도 온다.
  if (DIALOGUE_ROOT_IMAGE_URL.test(url) || DIALOGUE_DATA_IMAGE_URL.test(url)) return url;
  // 데스크톱·브라우저 호스트의 올린 그림은 확장자 없는 내용 주소다.
  // `oprn-asset://<프로젝트>/<sha256>`, `/__oprn/asset/<프로젝트>/<sha256>`.
  // 확장자를 요구하면 대사창만 얼굴이 빈 칸이 된다(상태 메뉴는 같은 주소를 그대로 그린다).
  if (DIALOGUE_ASSET_SCHEME_URL.test(url) || DIALOGUE_ASSET_HOST_URL.test(url)) return url;
  // 내보내기 플레이어는 배포 하위 경로를 포함한 http(s) 로 다시 쓴다. 경로의 확장자만 본다.
  if (/^https?:\/\//u.test(url)) {
    try {
      if (DIALOGUE_HTTP_IMAGE_EXT.test(new URL(url).pathname)) return url;
    } catch (error) {
      if (!(error instanceof TypeError)) throw error;
      return null;
    }
  }
  return null;
}
