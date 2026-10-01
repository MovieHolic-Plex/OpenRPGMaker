import { fieldSpawnBody } from "./commandBodyFieldSpawn";
import { openDatabaseResourcePickerDialog } from "@/editor/panels/databaseResourcePickerDialog";
import { showConfirm } from "@/editor/ui/modal";
import { clearChildren, el } from "@/util/dom";
import { isRelationshipState, RELATIONSHIP_STATES, relationshipStateName } from "@/project/relationshipState";
import { recordUsageHint } from "./recordUsageHint";
import { selectedOptionValue, selectWithOptions } from "./dom";
import { segmentedSelect, type SegmentOption } from "./recordPicker";
import { openRecordPickerPanel } from "./recordPickerDialog";
import { choicesBody } from "./commandBodyChoices";
import { inputNumberBody } from "./commandBodyInputNumber";
import { labelBody } from "./commandBodyLabels";
import { loopBody } from "./commandBodyLoop";
import { setVariableBody } from "./commandBodyVariable";
import { conditionForm, databasePicker, selfSwitchControl } from "./conditionForm";
import { aiImageGenerateField } from "@/editor/panels/aiImageGenerateField";
import { faceDisplayModeOf, renderFaceGallery, renderFacesetPreview } from "./facesetPreview";
import { renderConditionEvalPreview } from "./conditionEvalPreview";
import { renderCommandPreview } from "./commandPreview";
import {
  BOOLEAN_OPTIONS,
  TIMER_ACTION_OPTIONS,
  TIMER_ID_OPTIONS,
  type SelectOption,
} from "./options";
import type { Command, Condition, MessageWindowFormat, MessageWindowPosition, SwitchValue } from "@/project/types";
import { factionName, resolveFactionTable } from "@/project/factions";
import { textBodyOf } from "@/project/io/rewriteLegacyDialogue";
import { resourceDisplayName } from "@/player/resourceDisplay";
import { store } from "@/project/store";
import {
  DIALOGUE_CONTAINER_IDS,
  DIALOGUE_CONTAINER_LABELS,
  DIALOGUE_CONTEXT_IDS,
  DIALOGUE_CONTEXTS,
  DIALOGUE_INLINE_TAGS,
  isDialogueContainerId,
  DIALOGUE_STYLE_IDS,
  DIALOGUE_STYLES,
  isDialogueContextId,
  isDialogueStyleId,
} from "@/project/dialogueStyles";
import { editorState } from "@/editor/editorState";
import { hasCharacterId } from "@/project/socialKey";
import type { CommandEditContext } from "./types";
import { appearanceBindingControl } from "../appearanceBindingControl";
import { resolveAppearancePortrait } from "@/project/characterAppearances";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import {
  SHARED_PORTRAIT_EXPRESSIONS, findSharedPortrait, sharedExpressionSetIdOf, sharedPortraitId,
  type SharedPortraitExpression, type SharedPortraitMode,
} from "@/assets/sharedPortraitAssets";

const MESSAGE_WINDOW_FORMAT_OPTIONS = [
  { value: "normal", label: "일반" },
  { value: "transparent", label: "투명" },
] as const satisfies readonly SelectOption<MessageWindowFormat>[];

const MESSAGE_WINDOW_FORMAT_SEGMENTS = [
  { value: "normal", label: "일반", key: "normal" },
  { value: "transparent", label: "투명", key: "transparent" },
] as const satisfies readonly SegmentOption<MessageWindowFormat>[];

const MESSAGE_WINDOW_POSITION_OPTIONS = [
  { value: "top", label: "상단" },
  { value: "center", label: "중앙" },
  { value: "bottom", label: "하단" },
] as const satisfies readonly SelectOption<MessageWindowPosition>[];

const MESSAGE_WINDOW_POSITION_SEGMENTS = [
  { value: "top", label: "상단", key: "top" },
  { value: "center", label: "중앙", key: "center" },
  { value: "bottom", label: "하단", key: "bottom" },
] as const satisfies readonly SegmentOption<MessageWindowPosition>[];

export function renderCoreCommandBody(
  context: CommandEditContext,
  cmd: Command
): HTMLElement | undefined {
  const handler = coreCommandBodyHandlers[cmd.kind] as CoreCommandBodyHandler<Command> | undefined;
  return handler?.(context, cmd);
}

type CoreCommandBodyHandler<T extends Command> = (context: CommandEditContext, cmd: T) => HTMLElement;
type CoreCommandBodyHandlers = {
  readonly [K in Command["kind"]]?: CoreCommandBodyHandler<Extract<Command, { kind: K }>>;
};

const coreCommandBodyHandlers: CoreCommandBodyHandlers = {
  text: textBody,
  changeFace: changeFaceBody,
  displayTextSettings: displayTextSettingsBody,
  choices: choicesBody,
  setFlag: setFlagBody,
  setSelfSwitch: setSelfSwitchBody,
  fork: forkBody,
  setSwitch: setSwitchBody,
  setVariable: setVariableBody,
  changeFriendship: changeFriendshipBody,
  changeFactionStance: changeFactionStanceBody,
  getFriendship: getFriendshipBody,
  setRelationship: setRelationshipBody,
  timer: timerBody,
  inputWait: inputWaitBody,
  inputNumber: inputNumberBody,
  spawnFieldEnemy: fieldSpawnBody,
  label: labelBody,
  gotoLabel: labelBody,
  loop: loopBody,
  breakLoop: () => el("div", { class: "empty-hint", text: "현재 반복을 탈출합니다", dataset: { testid: "break-loop-editor" } }),
};

// 문장 표시 폼: 실제 게임 미리보기와 쉬운 작성 도구가 기본이고, 원시 제어문자는 고급 경로다.
const TEXT_EMOTION_SEGMENTS = [
  { value: "neutral", key: "neutral", label: "기본" },
  { value: "happy", key: "happy", label: "기쁨" },
  { value: "sad", key: "sad", label: "슬픔" },
  { value: "angry", key: "angry", label: "분노" },
  { value: "surprised", key: "surprised", label: "놀람" },
] as const satisfies readonly SegmentOption<"neutral" | "happy" | "sad" | "angry" | "surprised">[];

const TEXT_CONTROL_SNIPPETS: readonly {
  readonly key: string;
  readonly code: string;
  readonly label: string;
  readonly hint: string;
}[] = [
  { key: "color", code: "\\c[1]", label: "색", hint: "이후 글자 색" },
  { key: "hero", code: "\\n[1]", label: "이름", hint: "주인공 이름" },
  { key: "variable", code: "\\v[1]", label: "변수", hint: "변수 값" },
  { key: "gold", code: "\\$", label: "소지금", hint: "소지금 창 표시" },
  { key: "pause", code: "\\!", label: "대기", hint: "키 입력까지 문장 정지" },
  { key: "wait-quarter", code: "\\.", label: "0.25초", hint: "1/4초 지연" },
  { key: "wait-second", code: "\\|", label: "1초", hint: "1초 지연" },
  { key: "fast-on", code: "\\>", label: "빨리", hint: "이후 문장 즉시 표시" },
  { key: "fast-off", code: "\\<", label: "보통", hint: "즉시 표시 해제" },
  { key: "skip-wait", code: "\\^", label: "닫기", hint: "키 입력 없이 창 닫기" },
  { key: "space", code: "\\_", label: "반각", hint: "반각 공백" },
  { key: "speed", code: "\\s[3]", label: "속도", hint: "글자 표시 속도" },
];

function textBody(context: CommandEditContext, cmd: Extract<Command, { kind: "text" }>): HTMLElement {
  const wrap = el("div", {
    class: "event-command-text-editor cream-command-form",
    dataset: { testid: "event-command-text-editor" },
  });
  const speaker = el("input", {
    attrs: { type: "text", placeholder: "비우면 이름 없이 대사만 표시", spellcheck: "false" },
    value: cmd.speaker ?? "",
    dataset: { testid: "event-command-text-speaker" },
  }) as HTMLInputElement;
  const body = el("textarea", {
    attrs: { placeholder: "플레이어에게 보여 줄 문장을 입력하세요", rows: "5" },
    dataset: { testid: "event-command-text-body" },
  }) as HTMLTextAreaElement;
  body.value = textBodyOf(cmd);

  const emotionValueRaw = cmd.emotion ?? "neutral";
  const emotionValue = (TEXT_EMOTION_SEGMENTS.some((entry) => entry.value === emotionValueRaw)
    ? emotionValueRaw
    : "neutral") as (typeof TEXT_EMOTION_SEGMENTS)[number]["value"];
  const emotion = segmentedSelect({
    options: TEXT_EMOTION_SEGMENTS,
    value: emotionValue,
    testid: "event-command-text-emotion",
    ariaLabel: "말투·연출",
  });
  const autoAdvance = el("input", {
    attrs: { type: "checkbox" },
    dataset: { testid: "event-command-text-auto-advance" },
  }) as HTMLInputElement;
  autoAdvance.checked = cmd.autoAdvance === true;
  // 대사 종류: 이름·얼굴 숨김·즉시 표시·소리를 한 번에 바꾼다(src/project/dialogueStyles.ts).
  const lineContext = segmentedSelect({
    options: DIALOGUE_CONTEXT_IDS.map((id) => ({ value: id, key: id, label: DIALOGUE_CONTEXTS[id].label })),
    value: isDialogueContextId(cmd.context) ? cmd.context : "speech",
    testid: "event-command-text-context",
    ariaLabel: "대사 종류",
  });
  // 대사 그릇: 상자·말풍선·흘림·코너. 흘림·코너는 게임을 멈추지 않는다.
  const lineContainer = segmentedSelect({
    options: [
      { value: "", key: "inherit", label: "화자 기본" },
      ...DIALOGUE_CONTAINER_IDS.map((id) => ({ value: id, key: id, label: DIALOGUE_CONTAINER_LABELS[id] })),
    ],
    value: isDialogueContainerId(cmd.container) ? cmd.container : "",
    testid: "event-command-text-container",
    ariaLabel: "대화창 그릇",
  });
  const lineStyle = el("select", {
    dataset: { testid: "event-command-text-style" },
    attrs: { "aria-label": "이 줄의 대화창" },
  }) as HTMLSelectElement;
  lineStyle.append(el("option", { text: "화자·프로젝트 기본", attrs: { value: "" } }));
  for (const id of DIALOGUE_STYLE_IDS) lineStyle.append(el("option", { text: DIALOGUE_STYLES[id].label, attrs: { value: id } }));
  lineStyle.value = isDialogueStyleId(cmd.style) ? cmd.style : "";

  const limitHint = el("div", {
    class: "event-command-text-limit-hint",
    dataset: { testid: "event-command-text-limit-hint" },
  });
  const previewCanvas = el("div", {
    class: "event-command-text-preview-canvas",
    attrs: { "aria-live": "polite", "aria-atomic": "true" },
    dataset: { testid: "event-command-text-live-preview" },
  });
  let voiceResourceId = cmd.voiceResourceId?.trim() ?? "";
  const voiceName = el("span", {
    class: "event-command-text-voice-name",
    text: voiceResourceId ? resourceDisplayName(voiceResourceId, voiceResourceId) : "없음",
    dataset: { testid: "event-command-text-voice-name" },
  });
  const readDraft = (): Extract<Command, { kind: "text" }> => {
    const nextEmotion = emotion.select.value;
    const nextContext = lineContext.select.value;
    return {
      kind: "text",
      speaker: speaker.value.trim() || undefined,
      body: body.value,
      ...(nextEmotion && nextEmotion !== "neutral" ? { emotion: nextEmotion } : {}),
      ...(autoAdvance.checked ? { autoAdvance: true } : {}),
      ...(nextContext && nextContext !== "speech" ? { context: nextContext } : {}),
      ...(lineStyle.value ? { style: lineStyle.value } : {}),
      ...(lineContainer.select.value ? { container: lineContainer.select.value } : {}),
      ...(voiceResourceId ? { voiceResourceId } : {}),
    };
  };
  // 연출은 **바뀐 순간에만** 프리뷰에서 재생한다. 프리뷰는 본문을 한 글자 칠 때마다 다시
  // 그려지므로 늘 재생하면 창이 타자마다 튀어 글을 쓸 수 없다.
  let previewedEmotion = emotionValue as string;
  const refreshPreview = (replayPresentation = false) => {
    clearChildren(previewCanvas);
    previewCanvas.append(
      renderCommandPreview(readDraft(), { face: context.previewFace, replayPresentation })
    );
  };
  const refreshLimitHint = () => {
    const lines = body.value.split(/\r?\n/);
    const maxLine = lines.reduce((m, line) => Math.max(m, line.length), 0);
    const faceAware = Boolean((context as { previewFace?: unknown }).previewFace);
    const maxChars = faceAware ? 38 : 50;
    const overLines = lines.length > 4;
    const overChars = maxLine > maxChars;
    if (overLines || overChars) {
      limitHint.textContent = `권장 길이를 넘김: ${lines.length}줄 / 최대 ${maxLine}자 (권장 4×${maxChars}${faceAware ? "; 얼굴" : ""})`;
      limitHint.dataset.over = "1";
    } else {
      limitHint.textContent = `최대 4줄 / ${maxChars}자 권장${faceAware ? " (얼굴 포함)" : ""}`;
      delete limitHint.dataset.over;
    }
  };
  const apply = () => {
    refreshLimitHint();
    const nextEmotion = emotion.select.value || "neutral";
    const changed = nextEmotion !== previewedEmotion;
    previewedEmotion = nextEmotion;
    refreshPreview(changed);
    context.actions.replaceCommand(context.path, readDraft());
  };
  speaker.addEventListener("change", apply);
  speaker.addEventListener("input", apply);
  body.addEventListener("change", apply);
  body.addEventListener("input", apply);
  emotion.select.addEventListener("change", apply);
  autoAdvance.addEventListener("change", apply);
  lineContext.select.addEventListener("change", apply);
  lineStyle.addEventListener("change", apply);
  lineContainer.select.addEventListener("change", apply);

  refreshLimitHint();
  // 「말투·연출」은 고급 옵션이 아니다. 이 값이 창 등장 곡선·글자 속도·화면 연출을 고르므로
  // 문장을 쓰는 자리에서 바로 보여야 한다(예전에는 접힌 details 안에 있어 아무도 안 썼다).
  const presentation = el("div", {
    class: "event-command-text-presentation-field",
    dataset: { testid: "event-command-text-presentation" },
    children: [
      el("div", {
        class: "event-command-text-presentation-heading",
        children: [
          el("span", { class: "event-command-text-body-label", text: "말투·연출" }),
          el("span", { text: "창이 뜨는 모습과 글자 속도가 함께 바뀝니다." }),
        ],
      }),
      emotion.root,
      el("div", {
        class: "event-command-text-presentation-heading",
        children: [
          el("span", { class: "event-command-text-body-label", text: "대사 종류" }),
          el("span", { text: "내레이션·표지판·편지는 이름과 얼굴을 숨기고 바로 보입니다." }),
        ],
      }),
      lineContext.root,
      el("div", {
        class: "event-command-text-presentation-heading",
        children: [
          el("span", { class: "event-command-text-body-label", text: "대화창 그릇" }),
          el("span", { text: "말풍선은 머리 위에, 흘림·코너는 게임을 멈추지 않고 잠깐 떴다 사라집니다." }),
        ],
      }),
      lineContainer.root,
    ],
  });
  const advanced = el("details", {
    class: "event-command-text-advanced",
    dataset: { testid: "event-command-text-advanced" },
  }) as HTMLDetailsElement;
  advanced.open = cmd.autoAdvance === true || isDialogueStyleId(cmd.style);
  advanced.append(
    el("summary", {
      class: "event-command-text-advanced-summary",
      text: "고급 옵션 (자동 넘김 · 이 줄만 다른 대화창)",
    }),
    el("p", {
      class: "event-command-text-speaker-hint",
      text: "예전 「고급 대화」 기능입니다. 얼굴은 별도 「얼굴 바꾸기」 명령을 쓰세요.",
    }),
    el("label", {
      class: "event-command-text-auto-advance-label",
      children: [autoAdvance, el("span", { text: " 자동 넘김 (키 입력 없이 다음)" })],
    }),
    el("label", {
      class: "event-command-text-style-label",
      children: [el("span", { text: "이 줄의 대화창 " }), lineStyle],
    })
  );

  const easyTools = textEasyTools(body, apply);
  const controlDetails = el("details", {
    class: "event-command-text-control-details",
    dataset: { testid: "event-command-text-control-details" },
  }) as HTMLDetailsElement;
  controlDetails.open = false;
  controlDetails.append(
    el("summary", {
      class: "event-command-text-control-summary",
      children: [
        el("span", { text: "더 많은 문장 효과" }),
        el("span", { class: "event-command-text-control-summary-note", text: "필요할 때만" }),
      ],
    }),
    el("p", {
      class: "event-command-text-control-hint",
      text: "색·대기·속도처럼 덜 쓰는 효과를 넣습니다. 일반 작성은 위의 문장 도구만으로 충분합니다.",
    }),
    controlCharPalette(body, apply),
  );

  refreshPreview();

  wrap.append(
    el("section", {
      class: "event-command-text-preview-card",
      children: [
        el("div", {
          class: "event-command-text-section-head",
          children: [
            el("div", {
              children: [
                el("strong", { text: "게임 화면 미리보기" }),
                el("span", { text: "게임 창(320×240)과 같은 규격을 축소한 모습 · 줄바꿈이 게임과 같습니다" }),
              ],
            }),
            el("span", { class: "event-command-text-live-chip", text: "LIVE" }),
          ],
        }),
        previewCanvas,
      ],
    }),
    el("section", {
      class: "event-command-text-compose-card",
      children: [
        el("label", {
          class: "event-command-text-speaker-field",
          children: [
            el("span", { class: "event-command-text-body-label", text: "말하는 사람" }),
            speaker,
            el("small", { text: "비워 두면 이름표를 숨깁니다." }),
          ],
        }),
        el("div", {
          class: "event-command-text-body-field",
          children: [
            el("div", {
              class: "event-command-text-body-heading",
              children: [
                el("span", { class: "event-command-text-body-label", text: "대화 내용" }),
                limitHint,
              ],
            }),
            body,
          ],
        }),
        presentation,
        el("div", {
          class: "event-command-text-voice-field",
          attrs: { style: "display:flex;flex-wrap:wrap;gap:6px;align-items:center;" },
          dataset: { testid: "event-command-text-voice" },
          children: [
            el("span", { class: "event-command-text-body-label", text: "이 줄의 음성" }),
            voiceName,
            el("button", {
              class: "btn small",
              text: "음성 고르기",
              attrs: { type: "button" },
              dataset: { testid: "event-command-text-voice-pick" },
              on: {
                click: () => {
                  openDatabaseResourcePickerDialog({
                    kind: "sound",
                    title: "음성 고르기",
                    currentId: voiceResourceId,
                    onConfirm: (result) => {
                      voiceResourceId = result.resourceId.trim();
                      voiceName.textContent = voiceResourceId
                        ? resourceDisplayName(voiceResourceId, voiceResourceId)
                        : "없음";
                      apply();
                    },
                  });
                },
              },
            }),
            el("button", {
              class: "btn small",
              text: "지우기",
              attrs: { type: "button" },
              dataset: { testid: "event-command-text-voice-clear" },
              on: {
                click: () => {
                  voiceResourceId = "";
                  voiceName.textContent = "없음";
                  apply();
                },
              },
            }),
            el("small", { text: "이 대사가 뜰 때 한 번 재생합니다. 배경음은 그대로 두고, 글자 소리는 내지 않습니다." }),
          ],
        }),
        easyTools,
        advanced,
        controlDetails,
      ],
    }),
  );
  return wrap;
}

type TextEasyTool = {
  readonly key: string;
  readonly glyph: string;
  readonly label: string;
  readonly hint: string;
  readonly run: (body: HTMLTextAreaElement, commit: () => void) => void;
};

function textEasyTools(body: HTMLTextAreaElement, apply: () => void): HTMLElement {
  const tools: readonly TextEasyTool[] = [
    { key: "new-line", glyph: "↵", label: "줄 바꿈", hint: "커서 위치에서 다음 줄로 넘깁니다.", run: (target, commit) => { insertAtCursor(target, "\n"); commit(); } },
    { key: "hero-name", glyph: "人", label: "주인공 이름", hint: "문장에 넣을 주인공을 고릅니다.", run: (target, commit) => selectTextRecord(target, "actor", commit) },
    { key: "variable", glyph: "#", label: "변수 값", hint: "문장에 넣을 변수를 고릅니다.", run: (target, commit) => selectTextRecord(target, "variable", commit) },
    { key: "emphasis", glyph: "A", label: "강조", hint: "선택한 문장을 강조 색으로 표시합니다.", run: (target, commit) => { wrapSelection(target, "\\c[2]", "\\c[0]"); commit(); } },
    { key: "pause", glyph: "Ⅱ", label: "잠시 멈춤", hint: "이 위치에서 플레이어 입력을 기다립니다.", run: (target, commit) => { insertAtCursor(target, "\\!"); commit(); } },
  ];
  // 본문 태그 — 닫는 태그가 있는 것은 선택 구간을 감싸고, 없는 것은 커서에 넣는다.
  const tagButtons = DIALOGUE_INLINE_TAGS.map((tag) => {
    const open = /^\[[^\]]+\]/.exec(tag.sample)?.[0] ?? `[${tag.label}]`;
    const wraps = tag.sample.includes("[/]");
    return el("button", {
      class: "event-command-text-tool event-command-text-tag",
      attrs: { type: "button", title: `${tag.sample} — ${tag.description}`, "aria-label": `${tag.label} 태그` },
      dataset: { testid: `event-command-text-tag-${tag.id}` },
      on: {
        click: () => {
          if (wraps) wrapSelection(body, open, "[/]");
          else insertAtCursor(body, open);
          apply();
          body.focus();
        },
      },
      children: [el("span", { class: "event-command-text-tool-label", text: open })],
    });
  });
  return el("div", {
    class: "event-command-text-easy-tools",
    dataset: { testid: "event-command-text-easy-tools" },
    children: [
      el("div", {
        class: "event-command-text-tools-heading",
        children: [
          el("span", { class: "event-command-text-body-label", text: "문장 도구" }),
          el("span", { text: "선택한 문장이나 커서 위치에 적용됩니다." }),
        ],
      }),
      el("div", {
        class: "event-command-text-tools-row",
        children: tools.map((tool) => el("button", {
          class: "event-command-text-tool",
          attrs: { type: "button", title: tool.hint, "aria-label": tool.label },
          dataset: { testid: `event-command-text-tool-${tool.key}` },
          on: {
            click: () => tool.run(body, () => {
              apply();
              body.focus();
            }),
          },
          children: [
            el("span", { class: "event-command-text-tool-glyph", text: tool.glyph, attrs: { "aria-hidden": "true" } }),
            el("span", { class: "event-command-text-tool-label", text: tool.label }),
          ],
        })),
      }),
      el("div", {
        class: "event-command-text-tools-row event-command-text-tag-row",
        dataset: { testid: "event-command-text-tag-row" },
        children: tagButtons,
      }),
    ],
  });
}

function textVariableSlot(id: string): number | undefined {
  const index = Number(id.replace(/^(?:var_0*|v)/, ""));
  if (!Number.isInteger(index)) return undefined;
  const variables = store.getCurrent().session.variables;
  const resolvedId = [`var_${String(index).padStart(4, "0")}`, String(index), `v${index}`]
    .find(candidate => variables[candidate] !== undefined);
  return resolvedId === id ? index : undefined;
}

function selectTextRecord(body: HTMLTextAreaElement, kind: "actor" | "variable", commit: () => void): void {
  const start = body.selectionStart;
  const end = body.selectionEnd;
  // The existing subdialog restores this textarea, including on Cancel.
  body.focus({ preventScroll: true });
  openRecordPickerPanel({
    kind,
    currentId: "",
    ...(kind === "variable" ? {
      disabledReason: (id: string) => textVariableSlot(id) === undefined
        ? "이 변수는 현재 문장 번호로 참조할 수 없습니다."
        : undefined,
    } : {}),
    onSelect: id => {
      const index = kind === "actor"
        ? store.getCurrent().database.actors.findIndex(actor => actor.id === id) + 1
        : textVariableSlot(id);
      if (index === undefined || (kind === "actor" && index === 0)) return;
      body.setSelectionRange(start, end);
      insertAtCursor(body, `\\${kind === "actor" ? "n" : "v"}[${index}]`);
      commit();
    },
  });
}

// 제어 문자 팔레트: 커서 위치에 스니펫 삽입. RM2003 제어문자 문법 그대로.
function controlCharPalette(body: HTMLTextAreaElement, apply: () => void): HTMLElement {
  const palette = el("div", {
    class: "event-command-text-palette",
    attrs: { "aria-label": "문장 효과" },
    dataset: { testid: "event-command-text-palette" },
  });
  palette.append(
    el("div", {
      class: "event-command-text-palette-header",
      children: [
        el("span", { class: "event-command-text-palette-label", text: "문장 효과" }),
        el("span", {
          class: "event-command-text-palette-sub",
          text: "클릭하면 커서 위치에 들어갑니다. 미리보기에 바로 반영됩니다.",
        }),
      ],
    })
  );
  const row = el("div", { class: "event-command-text-palette-row" });
  for (const snippet of TEXT_CONTROL_SNIPPETS) {
    row.append(
      el("button", {
        class: "event-command-text-palette-button",
        attrs: { type: "button", title: snippet.hint },
        dataset: { testid: "event-command-text-insert-" + snippet.key },
        on: {
          click: () => {
            insertAtCursor(body, snippet.code);
            apply();
            body.focus();
          },
        },
        children: [
          el("span", { class: "event-command-text-palette-name", text: snippet.label }),
          el("span", { class: "event-command-text-palette-hint", text: snippet.hint }),
        ],
      })
    );
  }
  palette.append(row);
  return palette;
}

function insertAtCursor(body: HTMLTextAreaElement, code: string): void {
  const start = typeof body.selectionStart === "number" ? body.selectionStart : body.value.length;
  const end = typeof body.selectionEnd === "number" ? body.selectionEnd : start;
  body.value = body.value.slice(0, start) + code + body.value.slice(end);
  const cursor = start + code.length;
  try {
    body.setSelectionRange(cursor, cursor);
  } catch {
    /* fakeDom 등 selection 미지원 환경 무시 */
  }
}

function wrapSelection(body: HTMLTextAreaElement, prefix: string, suffix: string): void {
  const start = typeof body.selectionStart === "number" ? body.selectionStart : body.value.length;
  const end = typeof body.selectionEnd === "number" ? body.selectionEnd : start;
  const selection = body.value.slice(start, end);
  body.value = body.value.slice(0, start) + prefix + selection + suffix + body.value.slice(end);
  const selectionStart = start + prefix.length;
  const selectionEnd = selectionStart + selection.length;
  try {
    body.setSelectionRange(selectionStart, selectionEnd);
  } catch {
    /* fakeDom 등 selection 미지원 환경 무시 */
  }
}

const SHARED_PORTRAIT_EXPRESSION_LABELS: Readonly<Record<SharedPortraitExpression, string>> = {
  base: "기본", happy: "기쁨", sad: "슬픔", angry: "분노", surprised: "놀람",
};

/** 공용 흉상·전신의 5표정 줄. 고르면 표정이 없는 대사에 쓸 기본 그림이 바뀐다. */
function sharedPortraitExpressionRow(
  setId: string,
  mode: SharedPortraitMode,
  selected: SharedPortraitExpression,
  onSelect: (resourceId: string) => void,
): HTMLElement {
  return el("div", {
    class: "event-command-face-portrait-expressions",
    dataset: { testid: "event-command-face-portrait-expressions" },
    children: SHARED_PORTRAIT_EXPRESSIONS.map((expression) => {
      const id = sharedPortraitId(setId, mode, expression);
      const url = resolveAssetResourceUrl(id, { project: store.getCurrent() });
      return el("button", {
        class: `event-command-face-portrait-expression${expression === selected ? " selected" : ""}`,
        attrs: { type: "button", title: SHARED_PORTRAIT_EXPRESSION_LABELS[expression], "aria-pressed": String(expression === selected) },
        dataset: { testid: "event-command-face-portrait-expression", expression },
        on: { click: () => onSelect(id) },
        children: [
          ...(url ? [el("img", { attrs: { src: url, alt: "", loading: "lazy" } })] : []),
          el("span", { text: SHARED_PORTRAIT_EXPRESSION_LABELS[expression] }),
        ],
      });
    }),
  });
}

function changeFaceBody(context: CommandEditContext, cmd: Extract<Command, { kind: "changeFace" }>): HTMLElement {
  let appearanceId = cmd.appearanceId;
  const presentation = selectWithOptions([
    { value: "face", label: "얼굴" }, { value: "bust", label: "흉상 (없으면 얼굴)" },
  ] as const, cmd.presentation ?? "face", "event-command-face-presentation");
  const appearance = appearanceBindingControl(appearanceId, "event-command-face-appearance", (id) => {
    appearanceId = id;
    apply();
  });
  // RM-style face picker: selected face card + resource actions on top,
  // a flat standalone-face gallery as the main work surface, position/flip chips below.
  const wrap = el("div", {
    class: "event-command-face-editor",
    dataset: { testid: "event-command-face-editor" },
  });
  const previewHost = el("div", {
    class: "event-command-face-preview-host",
    dataset: { testid: "event-command-face-preview-host" },
  });
  const gridHost = el("div", {
    class: "event-command-face-grid-host",
    dataset: { testid: "event-command-face-grid-host" },
  });
  // Hidden-friendly resource id keeps e2e/tests that fill the resource field working.
  const resource = el("input", {
    class: "event-command-face-resource-input",
    attrs: {
      type: "text",
      placeholder: "얼굴",
      spellcheck: "false",
      "aria-label": "얼굴",
    },
    value: cmd.resourceId,
    dataset: { testid: "event-command-face-resource" },
  }) as HTMLInputElement;
  const position = selectWithOptions(
    [
      { value: "left", label: "왼쪽" },
      { value: "right", label: "오른쪽" },
    ] as const,
    cmd.position,
    "event-command-face-position"
  );
  position.classList.add("event-command-face-position-select");
  const flip = checkboxControl(cmd.flipHorizontally, "event-command-face-flip-horizontal");
  flip.classList.add("event-command-face-flip-checkbox");

  const readDraft = (): Extract<Command, { kind: "changeFace" }> => ({
    kind: "changeFace",
    ...(appearanceId ? { appearanceId, presentation: presentation.value === "bust" ? "bust" : "face" } : {}),
    resourceId: resource.value.trim(),
    position: position.value === "right" ? "right" : "left",
    flipHorizontally: flip.checked,
  });

  const refreshPreview = (): void => {
    const draft = readDraft();
    const resolved = draft.appearanceId
      ? resolveAppearancePortrait(store.getCurrent(), draft.appearanceId, draft.presentation ?? "face")
      : undefined;
    clearChildren(previewHost);
    previewHost.append(
      renderFacesetPreview({
        resourceId: draft.appearanceId ? resolved?.resourceId ?? "" : draft.resourceId,
        presentation: draft.appearanceId ? resolved?.presentation : undefined,
        position: draft.position,
        flipHorizontally: draft.flipHorizontally,
        displaySize: 96,
      })
    );
  };

  // 갤러리는 한 번만 짓고 이후엔 선택 강조만 갱신한다 — 낱장 수백 장을 매 입력마다 다시 만들지 않는다.
  const gallery = renderFaceGallery({
    selectedId: cmd.resourceId,
    cellSize: 52,
    onSelect: (resourceId) => {
      resource.value = resourceId;
      apply();
    },
  });

  const refreshGallery = (): void => {
    const draft = readDraft();
    clearChildren(gridHost);
    const mode = faceDisplayModeOf(draft.resourceId);
    const whole = mode !== "chip";
    wrap.dataset.faceMode = mode;
    if (whole) {
      const shared = findSharedPortrait(draft.resourceId);
      gridHost.append(
        el("div", {
          class: "event-command-face-bust-note",
          dataset: { testid: "event-command-face-bust-note", faceMode: mode },
          children: [
            el("strong", { text: mode === "full" ? "전신 모드" : "흉상 모드" }),
            el("p", {
              text: shared
                ? `대사 창 ${mode === "full" ? "뒤에 크게 세우는 전신" : "옆의 흉상"}입니다. 이어지는 대사에 표정(기쁨·슬픔·분노·놀람)을 고르면 같은 인물의 그 표정 그림으로 바뀝니다. 아래는 표정이 없을 때의 기본 그림입니다.`
                : mode === "full"
                  ? "전신 레이아웃으로 대사 창 위에 크게 세웁니다. 번들 프리셋(generated-face-actor1-full)은 아직 흉상 그림을 공유하므로 그림 자체는 흉상입니다. 표시 위치(왼쪽/오른쪽)와 좌우 반전만 조절하세요."
                  : "이 리소스는 통짜 흉상 이미지입니다. 표시 위치(왼쪽/오른쪽)와 좌우 반전만 조절하세요.",
            }),
            ...(shared ? [sharedPortraitExpressionRow(shared.setId, shared.mode, shared.expression, (id) => {
              resource.value = id;
              apply();
            })] : []),
          ],
        })
      );
      return;
    }
    gallery.setSelected(draft.resourceId);
    gridHost.append(gallery.root);
  };

  const refreshAll = (): void => {
    refreshPreview();
    refreshGallery();
    const sharedSet = sharedExpressionSetIdOf(resource.value.trim());
    faceReturn.style.display = findSharedPortrait(resource.value.trim()) ? "" : "none";
    bustPreset.title = sharedSet ? "이 인물의 흉상 — 대사 창 옆 초상" : "Actor1 흉상 — 대사 창 위 대형 초상";
    fullPreset.title = sharedSet ? "이 인물의 전신 — 대사 창 뒤에 크게" : "전신 레이아웃 (id: generated-face-actor1-full)";
    const linked = Boolean(appearanceId);
    resource.disabled = linked;
    resourceActions.hidden = linked;
    gridHost.hidden = linked;
    directGeneration.hidden = linked;
    presentation.disabled = !linked;
  };

  const apply = (): void => {
    context.actions.replaceCommand(context.path, readDraft());
    refreshAll();
  };

  resource.addEventListener("change", apply);
  resource.addEventListener("input", () => {
    // Live card/gallery refresh while typing; staged commit still on change via apply.
    refreshAll();
  });
  position.addEventListener("change", apply);
  presentation.addEventListener("change", apply);
  flip.addEventListener("change", apply);

  const openPicker = (): void => {
    const draft = readDraft();
    openDatabaseResourcePickerDialog({
      kind: "faceset",
      title: "얼굴 고르기",
      currentId: draft.resourceId,
      allowClear: true,
      testidPrefix: "event-command-face-resource-dialog",
      onConfirm: (result) => {
        resource.value = result.resourceId;
        apply();
      },
    });
  };

  const clearResource = (): void => {
    appearanceId = undefined;
    resource.value = "";
    apply();
  };

  // 흉상·전신 버튼: 고른 얼굴이 공용 표정 세트(낱장 또는 흉상·전신)면 그 인물의 그림으로, 아니면 Actor1 프리셋으로.
  const portraitTarget = (mode: SharedPortraitMode): string => {
    const current = resource.value.trim();
    const portrait = findSharedPortrait(current);
    if (portrait) return sharedPortraitId(portrait.setId, mode, portrait.expression);
    const setId = sharedExpressionSetIdOf(current);
    return setId ? sharedPortraitId(setId, mode, "base") : `generated-face-actor1-${mode}`;
  };
  const bustPreset = el("button", {
    class: "btn small event-command-face-bust-preset",
    text: "흉상",
    attrs: { type: "button", title: "Actor1 흉상 — 대사 창 위 대형 초상" },
    dataset: { testid: "event-command-face-bust-preset" },
    on: { click: () => { resource.value = portraitTarget("bust"); apply(); } },
  });
  const fullPreset = el("button", {
    class: "btn small event-command-face-full-preset",
    text: "전신",
    attrs: { type: "button", title: "전신 레이아웃 (id: generated-face-actor1-full)" },
    dataset: { testid: "event-command-face-full-preset" },
    on: { click: () => { resource.value = portraitTarget("full"); apply(); } },
  });
  const faceReturn = el("button", {
    class: "btn small event-command-face-face-preset",
    text: "얼굴",
    attrs: { type: "button", title: "이 인물의 얼굴 낱장(기본 미소)으로 돌아갑니다" },
    dataset: { testid: "event-command-face-face-preset" },
    on: {
      click: () => {
        const portrait = findSharedPortrait(resource.value.trim());
        if (!portrait) return;
        resource.value = `${portrait.setId}-00`;
        apply();
      },
    },
  });
  // .btn 의 display 가 hidden 속성을 이기므로 style 로 숨긴다.
  faceReturn.style.display = findSharedPortrait(cmd.resourceId) ? "" : "none";

  const resourceActions = el("div", {
    class: "event-command-face-resource-actions",
    children: [
      el("button", {
        class: "btn small event-command-face-pick",
        text: "얼굴 고르기…",
        attrs: { type: "button", "aria-label": "얼굴 그림 선택" },
        dataset: { testid: "event-command-face-resource-set" },
        on: { click: openPicker },
      }),
      faceReturn,
      bustPreset,
      fullPreset,
      el("button", {
        class: "btn small event-command-face-clear",
        text: "해제",
        attrs: { type: "button" },
        dataset: { testid: "event-command-face-resource-clear" },
        on: { click: clearResource },
      }),
    ],
  });

  const selectedCard = el("div", {
    class: "event-command-face-selected-card",
    children: [
      previewHost,
      el("div", {
        class: "event-command-face-selected-meta",
        children: [
          el("div", {
            class: "event-command-face-selected-heading",
            text: "선택한 얼굴",
          }),
          resourceActions,
          resource,
        ],
      }),
    ],
  });

  const optionsRow = el("div", {
    class: "event-command-face-options",
    children: [
      fieldControl("표시 위치", position),
      fieldControl("좌우 반전", flip),
    ],
  });

  const directGeneration = aiImageGenerateField({
    kind: "faceset",
    testidPrefix: "event-command-face-ai",
    queueKey: `event-command-face:${context.path.join(".")}`,
    onInserted: (id) => { resource.value = id; apply(); },
  });
  wrap.append(
    appearance,
    fieldControl("공유 외형 표시", presentation),
    selectedCard,
    el("div", {
      class: "event-command-face-grid-section",
      dataset: { testid: "event-command-face-grid-section" },
      children: [
        el("div", {
          class: "event-command-face-section-label",
          text: "얼굴 선택",
        }),
        gridHost,
      ],
    }),
    directGeneration,
    optionsRow,
    el("p", {
      class: "event-command-face-hint",
      text: "얼굴은 그림 한 장을 고릅니다. 흉상 그림을 고르면 대사 창 위 큰 얼굴로 보이며 갤러리는 숨깁니다.",
    })
  );
  refreshAll();
  return wrap;
}

function displayTextSettingsBody(
  context: CommandEditContext,
  cmd: Extract<Command, { kind: "displayTextSettings" }>
): HTMLElement {
  // RM2k3 문장 표시 설정과 같이 형식/위치/옵션을 그룹으로 나눈다.
  const wrap = el("div", {
    class: "event-command-message-settings",
    dataset: { testid: "event-command-message-settings" },
  });
  // 드롭다운 대신 세그먼트 버튼으로 즉시 선택. 숨김 select 는 testid 와 change 파이프라인을
  // 유지하지만 Playwright `selectOption` 은 못 받는다(hidden 이라 액셔너빌리티에서 막힌다) —
  // 테스트는 `...-segment-<key>` 버튼을 누르고 `aria-pressed` 로 상태를 읽는다.
  const format = segmentedSelect({
    options: MESSAGE_WINDOW_FORMAT_SEGMENTS,
    value: cmd.format,
    testid: "event-command-message-format",
    ariaLabel: "윈도우 표시 형식",
  });
  const position = segmentedSelect({
    options: MESSAGE_WINDOW_POSITION_SEGMENTS,
    value: cmd.position,
    testid: "event-command-message-position",
    ariaLabel: "윈도우 위치",
  });
  const preventObscuring = checkboxControl(cmd.preventObscuringPlayer, "event-command-message-prevent-obscuring");
  const allowMovement = checkboxControl(cmd.allowEventMovementDuringWait, "event-command-message-allow-movement");
  const apply = () => {
    context.actions.replaceCommand(context.path, {
      kind: "displayTextSettings",
      format: selectedOptionValue(format.select, MESSAGE_WINDOW_FORMAT_OPTIONS, cmd.format),
      position: selectedOptionValue(position.select, MESSAGE_WINDOW_POSITION_OPTIONS, cmd.position),
      preventObscuringPlayer: preventObscuring.checked,
      allowEventMovementDuringWait: allowMovement.checked,
    });
  };
  format.select.addEventListener("change", apply);
  position.select.addEventListener("change", apply);
  preventObscuring.addEventListener("change", apply);
  allowMovement.addEventListener("change", apply);
  wrap.append(
    settingsGroup("윈도우 표시 형식", [
      format.root,
      el("p", {
        class: "event-command-settings-hint",
        text: "일반은 창 스킨 배경, 투명은 글자만 표시합니다.",
      }),
    ]),
    settingsGroup("윈도우 위치", [
      position.root,
      el("p", {
        class: "event-command-settings-hint",
        text: "이후 문장·선택지·숫자 입력 창의 기본 위치를 바꿉니다.",
      }),
    ]),
    settingsGroup("옵션", [
      fieldControl("플레이어 가림 방지", preventObscuring),
      fieldControl("대기 중 이벤트 이동", allowMovement),
      el("p", {
        class: "event-command-settings-hint",
        text: "가림 방지는 플레이어와 겹치면 창 위치를 자동 조정합니다. 이동 허용은 메시지 대기 중 다른 이벤트 이동을 허용합니다.",
      }),
    ])
  );
  return wrap;
}

function settingsGroup(title: string, children: readonly HTMLElement[]): HTMLElement {
  return el("fieldset", {
    class: "event-command-settings-group",
    children: [el("legend", { text: title }), ...children],
  });
}

function checkboxControl(checked: boolean, testId: string): HTMLInputElement {
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = checked;
  checkbox.dataset.testid = testId;
  return checkbox;
}

function fieldControl(label: string, control: HTMLElement): HTMLElement {
  return el("label", { class: "inline-field", children: [el("span", { text: label }), control] });
}

function setFlagBody(context: CommandEditContext, cmd: Extract<Command, { kind: "setFlag" }>): HTMLElement {
  const wrap = el("span", {});
  const flag = el("input", {
    attrs: { type: "text", placeholder: "예: 도입을 봄" },
    value: cmd.flag,
    dataset: { testid: "event-command-flag-name" },
  }) as HTMLInputElement;
  const val = selectWithOptions(BOOLEAN_OPTIONS, String(cmd.value));
  const apply = () => {
    context.actions.replaceCommand(context.path, {
      kind: "setFlag",
      flag: flag.value.trim() || "flag1",
      value: val.value === "true",
    });
  };
  flag.addEventListener("change", apply);
  val.addEventListener("change", apply);
  wrap.append(fieldControl("기억", flag), fieldControl("상태", val));
  return wrap;
}

function setSelfSwitchBody(context: CommandEditContext, cmd: Extract<Command, { kind: "setSelfSwitch" }>): HTMLElement {
  const wrap = el("span", {});
  wrap.append(
    selfSwitchControl(cmd.key, cmd.value, (key, value) => {
      context.actions.replaceCommand(context.path, { kind: "setSelfSwitch", key, value });
    }, {
      keyTestId: "event-command-self-switch-key",
      valueTestId: "event-command-self-switch-value",
    })
  );
  return wrap;
}

function forkBody(context: CommandEditContext, cmd: Extract<Command, { kind: "fork" }>): HTMLElement {
  // RM2003 rhythm: dialog edits condition + else flag only. then/else bodies live in the main list.
  const latestFork = (): Extract<Command, { kind: "fork" }> => {
    const current = context.getCurrentCommand?.();
    return current?.kind === "fork" ? current : cmd;
  };
  const wrap = el("div", {
    class: "event-command-fork-form",
    dataset: { testid: "event-command-fork-form" },
  });

  const conditionSection = el("section", {
    class: "event-fork-section event-fork-condition-section",
    children: [
      el("div", {
        class: "event-fork-section-title",
        text: "조건",
        dataset: { testid: "event-fork-condition-title" },
      }),
      conditionForm(cmd.condition, (condition) => {
        context.actions.replaceCommand(context.path, { ...latestFork(), condition });
      }, context.path),
    ],
  });

  const elseCheck = el("input", {
    attrs: { type: "checkbox" },
    dataset: { testid: "event-fork-else-enabled" },
  }) as HTMLInputElement;
  elseCheck.checked = cmd.else !== undefined;
  elseCheck.addEventListener("change", () => {
    const latest = latestFork();
    if (elseCheck.checked) {
      context.actions.replaceCommand(context.path, { ...latest, else: latest.else ?? [] });
      return;
    }
    const dropElseBranch = (): void => {
      context.actions.replaceCommand(context.path, { kind: "fork", condition: latest.condition, then: latest.then });
    };
    if ((latest.else?.length ?? 0) === 0) {
      dropElseBranch();
      return;
    }
    // 네이티브 confirm 은 에디터의 다이얼로그와 모양이 다르다 — 물어보는 동안은 체크를 되돌려 둔다.
    elseCheck.checked = true;
    void showConfirm({
      title: "그 외 분기 삭제",
      message: "그 외 분기에 들어있는 명령이 함께 삭제됩니다. 진행할까요?",
      confirmLabel: "삭제",
      cancelLabel: "유지",
      danger: true,
    }).then((confirmed) => {
      if (!confirmed) return;
      elseCheck.checked = false;
      dropElseBranch();
    });
  });

  const timerWarning = renderForkTimerWarning(cmd.condition);
  const optionsSection = el("section", {
    class: "event-fork-section event-fork-options-section",
    children: [
      el("label", {
        class: "event-fork-else-check",
        children: [
          elseCheck,
          el("span", { text: "조건이 맞지 않을 때 처리 (그 외 분기)" }),
        ],
      }),
      el("p", {
        class: "event-fork-section-hint",
        text: "조건이 맞을 때/맞지 않을 때 안의 명령은 왼쪽 목록에서 고칩니다.",
        dataset: { testid: "event-fork-body-hint" },
      }),
      el("div", {
        class: "event-fork-branch-summary",
        dataset: { testid: "event-fork-branch-summary" },
        children: [
          el("div", {
            class: "event-fork-branch-summary-card then",
            text: `조건이 맞을 때 · ${cmd.then.length}개 명령`,
            dataset: { testid: "event-fork-summary-then" },
          }),
          el("div", {
            class: `event-fork-branch-summary-card else${cmd.else ? "" : " absent"}`,
            text: cmd.else ? `조건이 맞지 않을 때 · ${cmd.else.length}개 명령` : "그 외 · 분기 없음",
            dataset: { testid: "event-fork-summary-else" },
          }),
        ],
      }),
      renderConditionEvalPreview(cmd.condition, editorState.get().currentMapId ?? undefined),
      ...(timerWarning ? [timerWarning] : []),
    ],
  });

  wrap.append(conditionSection, optionsSection);
  return wrap;
}
/**
 * 타이머 조건의 항상-참 함정 인라인 경고. 런타임은 미기동 타이머를 0초로 읽어
 * `seconds >= 0` 조건이 설정 전부터 참이 된다(의도된 계약). 검증기는 warning을
 * 내지만 폼에서 안 보이므로, 조건을 고르는 자리에서 직접 말한다.
 */
function renderForkTimerWarning(condition: Condition): HTMLElement | null {
  const timers: { readonly timerId: string; readonly seconds: number }[] = [];
  const collect = (entry: Condition): void => {
    if (entry.kind === "timer") timers.push(entry);
    else if (entry.kind === "all" || entry.kind === "any") entry.conditions.forEach(collect);
    else if (entry.kind === "not") collect(entry.condition);
  };
  collect(condition);
  const risky = timers.filter((entry) => entry.seconds >= 0);
  if (risky.length === 0) return null;
  const names = [...new Set(risky.map((entry) => entry.timerId === "timer2" ? "타이머 2" : "타이머 1"))].join("·");
  return el("p", {
    class: "event-fork-timer-warning",
    text: `${names} · 0초 이하 조건은 타이머가 꺼져 있어도 참입니다. 타이머를 켜는 명령 뒤에 두거나 임계값을 올리세요.`,
    dataset: { testid: "event-fork-timer-warning" },
  });
}

function setSwitchBody(context: CommandEditContext, cmd: Extract<Command, { kind: "setSwitch" }>): HTMLElement {
  // 스위치 조작: 검색 가능 피커 + 값(ON/OFF/전환/변수) 한 줄. "값 소스" 별도 필드는 두지 않는다.
  const wrap = el("div", { class: "event-command-record-form event-command-switch-form cream-command-form" });
  let currentSwitchId = cmd.switchId;
  let currentOperandVariableId = typeof cmd.value === "object" && cmd.value !== null ? cmd.value.id : "";

  const swSel = databasePicker("switch", cmd.switchId, (switchId) => {
    currentSwitchId = switchId;
    apply();
  }, "event-command-switch-target");

  const valueSelect = selectWithOptions(
    SWITCH_VALUE_OPTIONS,
    switchValueOption(cmd.value),
    "event-command-switch-value",
  );

  const operandVariable = databasePicker("variable", currentOperandVariableId, (variableId) => {
    currentOperandVariableId = variableId;
    apply();
  }, "event-command-switch-operand");

  const valueRow = el("div", {
    class: "event-command-switch-value-row",
    dataset: { testid: "event-command-switch-value-row" },
    children: [valueSelect, operandVariable],
  });

  const hint = el("p", {
    class: "event-command-switch-hint",
    dataset: { testid: "event-command-switch-hint" },
  });
  const renderHint = (): void => {
    const token = valueSelect.value;
    hint.textContent = token === "variable"
      ? "고른 숫자가 0이면 끄고, 아니면 켭니다."
      : token === "toggle"
        ? "지금 켜져 있으면 끄고, 꺼져 있으면 켭니다."
        : "이 스위치를 켜거나 끕니다.";
  };
  const syncVisibility = (): void => {
    const useVariable = valueSelect.value === "variable";
    operandVariable.hidden = !useVariable;
    // fakeDom 호환: classList.toggle 대신 add/remove.
    if (useVariable) valueRow.classList.add("is-variable");
    else valueRow.classList.remove("is-variable");
    renderHint();
  };

  const apply = (): void => {
    const token = valueSelect.value;
    const value: SwitchValue = token === "variable"
      ? { kind: "var", id: currentOperandVariableId }
      : token === "toggle"
        ? "toggle"
        : token === "true";
    context.actions.replaceCommand(context.path, {
      kind: "setSwitch",
      switchId: currentSwitchId,
      value,
    });
  };

  valueSelect.addEventListener("change", () => {
    syncVisibility();
    apply();
  });
  syncVisibility();

  wrap.append(
    fieldControl("스위치", swSel),
    fieldControl("값", valueRow),
    hint,
    recordUsageHint("switch", cmd.switchId),
  );
  return wrap;
}

const SWITCH_VALUE_OPTIONS = [
  { value: "true", label: "켜기" },
  { value: "false", label: "끄기" },
  { value: "toggle", label: "전환" },
  { value: "variable", label: "변수" },
] as const satisfies readonly SelectOption<"true" | "false" | "toggle" | "variable">[];

function switchValueOption(value: SwitchValue): "true" | "false" | "toggle" | "variable" {
  if (typeof value === "object" && value !== null) return "variable";
  if (value === "toggle") return "toggle";
  if (value === false) return "false";
  return "true";
}

function inputWaitBody(context: CommandEditContext, cmd: Extract<Command, { kind: "inputWait" }>): HTMLElement {
  const wrap = el("div", {});
  wrap.append(el("span", { class: "empty-hint", text: "아무 키나 누를 때까지 기다립니다. 변수를 고르면 누른 키를 기억합니다." }));
  let currentVariableId = cmd.variableId ?? "";
  const variablePicker = databasePicker("variable", currentVariableId, (variableId) => {
    currentVariableId = variableId;
    context.actions.replaceCommand(context.path, { kind: "inputWait", variableId: currentVariableId });
  }, "event-command-input-wait-variable");
  wrap.append(el("label", { class: "inline-field", children: [el("span", { text: "어디에 기억" }), variablePicker] }));
  return wrap;
}

function changeFriendshipBody(context: CommandEditContext, cmd: Extract<Command, { kind: "changeFriendship" }>): HTMLElement {
  const wrap = el("div", { class: "event-command-record-form cream-command-form" });
  const npcKey = el("input", {
    attrs: { type: "text", placeholder: "비우면 이 이벤트" },
    value: cmd.npcKey ?? "",
    dataset: { testid: "event-command-friendship-npc-key" },
  }) as HTMLInputElement;
  const delta = el("input", {
    attrs: { type: "number", min: "-1000", max: "1000" },
    value: String(cmd.delta),
    dataset: { testid: "event-command-friendship-delta" },
  }) as HTMLInputElement;
  const apply = () => {
    context.actions.replaceCommand(context.path, {
      kind: "changeFriendship",
      npcKey: npcKey.value.trim() || undefined,
      delta: parseInt(delta.value, 10) || 0,
    });
  };
  npcKey.addEventListener("change", apply);
  delta.addEventListener("change", apply);
  wrap.append(fieldControl("누구", npcKey), fieldControl("변화량", delta));
  appendFriendshipCharacterHint(wrap, cmd.npcKey);
  return wrap;
}

function changeFactionStanceBody(context: CommandEditContext, cmd: Extract<Command, { kind: "changeFactionStance" }>): HTMLElement {
  const wrap = el("div", { class: "event-command-record-form cream-command-form" });
  const table = resolveFactionTable(store.getCurrent().factions);
  const factionSelect = (storedId: string, testid: string): HTMLSelectElement => {
    const select = el("select", { dataset: { testid } }) as HTMLSelectElement;
    if (!table.ids.includes(storedId)) {
      // 아직 만들지 않은 진영을 먼저 참조할 수 있으므로 결손 ID를 렌더만으로 바꾸지 않는다.
      select.append(el("option", {
        attrs: { value: storedId, disabled: "" },
        text: `${storedId} · 존재하지 않는 진영`,
      }));
    }
    for (const id of table.ids) {
      select.append(el("option", {
        attrs: { value: id },
        text: `${factionName(table, id)} (${id})`,
      }));
    }
    select.value = storedId;
    return select;
  };
  const factionA = factionSelect(cmd.a, "event-command-faction-a");
  const factionB = factionSelect(cmd.b, "event-command-faction-b");
  const op = selectWithOptions([
    { value: "=", label: "설정" },
    { value: "+=", label: "올리기" },
    { value: "-=", label: "내리기" },
  ] as const, cmd.op, "event-command-faction-op");
  const value = el("input", {
    attrs: {
      type: "number",
      min: cmd.op === "=" ? "-2" : "0",
      max: cmd.op === "=" ? "2" : "4",
      step: "0.25",
    },
    value: String(cmd.value),
    dataset: { testid: "event-command-faction-value" },
  }) as HTMLInputElement;
  const apply = () => context.actions.replaceCommand(context.path, {
    kind: "changeFactionStance",
    a: factionA.value,
    b: factionB.value,
    op: selectedOptionValue(op, [
      { value: "=", label: "설정" },
      { value: "+=", label: "올리기" },
      { value: "-=", label: "내리기" },
    ] as const, cmd.op),
    value: Number.isFinite(value.valueAsNumber) ? value.valueAsNumber : 0,
  });
  factionA.addEventListener("change", apply);
  factionB.addEventListener("change", apply);
  op.addEventListener("change", () => {
    const selected = selectedOptionValue(op, [
      { value: "=", label: "설정" },
      { value: "+=", label: "올리기" },
      { value: "-=", label: "내리기" },
    ] as const, cmd.op);
    value.min = selected === "=" ? "-2" : "0";
    value.max = selected === "=" ? "2" : "4";
    apply();
  });
  value.addEventListener("change", apply);
  wrap.append(
    fieldControl("진영 A", factionA),
    fieldControl("진영 B", factionB),
    fieldControl("연산", op),
    fieldControl("값", value),
  );
  return wrap;
}

function getFriendshipBody(context: CommandEditContext, cmd: Extract<Command, { kind: "getFriendship" }>): HTMLElement {
  const wrap = el("div", { class: "event-command-record-form cream-command-form" });
  const npcKey = el("input", {
    attrs: { type: "text", placeholder: "비우면 이 이벤트" },
    value: cmd.npcKey ?? "",
    dataset: { testid: "event-command-get-friendship-npc-key" },
  }) as HTMLInputElement;
  let currentVariableId = cmd.variableId;
  const variablePicker = databasePicker("variable", currentVariableId, (variableId) => {
    currentVariableId = variableId;
    context.actions.replaceCommand(context.path, {
      kind: "getFriendship",
      npcKey: npcKey.value.trim() || undefined,
      variableId: currentVariableId,
    });
  });
  npcKey.addEventListener("change", () => {
    context.actions.replaceCommand(context.path, {
      kind: "getFriendship",
      npcKey: npcKey.value.trim() || undefined,
      variableId: currentVariableId,
    });
  });
  wrap.append(fieldControl("누구", npcKey), fieldControl("어디에 저장", variablePicker), recordUsageHint("variable", cmd.variableId));
  appendFriendshipCharacterHint(wrap, cmd.npcKey);
  return wrap;
}

/**
 * 관계 설정 — 표면 게이트가 «컨트롤 0» 으로 잡은 결함(2026-08-30).
 *
 * `setRelationship` 이 커맨드 종류·조건·스키마·검증기에는 들어갔는데 **본문 편집기만 없었다.**
 * 저작자는 명령을 목록에 넣을 수 있지만 대상 NPC 도 상태도 고를 수 없었다. 형태는 형제인
 * `getFriendship`(누구 = 비우면 이 이벤트) + 조건 폼의 관계 select 를 그대로 따른다.
 */
function setRelationshipBody(context: CommandEditContext, cmd: Extract<Command, { kind: "setRelationship" }>): HTMLElement {
  const wrap = el("div", { class: "event-command-record-form cream-command-form" });
  const npcKey = el("input", {
    attrs: { type: "text", placeholder: "비우면 이 이벤트" },
    value: cmd.npcKey ?? "",
    dataset: { testid: "event-command-set-relationship-npc-key" },
  }) as HTMLInputElement;
  const state = el("select", {
    dataset: { testid: "event-command-set-relationship-state" },
  }) as HTMLSelectElement;
  for (const value of RELATIONSHIP_STATES) {
    state.append(el("option", { value, text: relationshipStateName(value) }));
  }
  state.value = cmd.state;
  const apply = () => {
    context.actions.replaceCommand(context.path, {
      kind: "setRelationship",
      npcKey: npcKey.value.trim() || undefined,
      state: isRelationshipState(state.value) ? state.value : "dating",
    });
  };
  npcKey.addEventListener("change", apply);
  state.addEventListener("change", apply);
  wrap.append(fieldControl("누구", npcKey), fieldControl("관계", state));
  appendFriendshipCharacterHint(wrap, cmd.npcKey);
  return wrap;
}

function timerBody(context: CommandEditContext, cmd: Extract<Command, { kind: "timer" }>): HTMLElement {
  const wrap = el("span", {});
  const action = selectWithOptions(TIMER_ACTION_OPTIONS, cmd.action, "event-command-timer-action");
  const timerId = selectWithOptions(TIMER_ID_OPTIONS, cmd.timerId ?? "timer1", "event-command-timer-id");
  const secs = el("input", {
    attrs: { type: "number", min: "0", placeholder: "초" },
    value: String(cmd.seconds ?? 60),
    dataset: { testid: "event-command-timer-seconds" },
  }) as HTMLInputElement;
  const apply = () => {
    context.actions.replaceCommand(context.path, {
      kind: "timer",
      action: selectedOptionValue(action, TIMER_ACTION_OPTIONS, cmd.action),
      seconds: parseInt(secs.value, 10) || 0,
      timerId: selectedOptionValue(timerId, TIMER_ID_OPTIONS, cmd.timerId ?? "timer1"),
    });
  };
  action.addEventListener("change", apply);
  timerId.addEventListener("change", apply);
  secs.addEventListener("change", apply);
  wrap.append(fieldControl("무엇을", action), fieldControl("타이머", timerId), fieldControl("몇 초", secs));
  return wrap;
}

function appendFriendshipCharacterHint(wrap: HTMLElement, npcKey: string | undefined): void {
  if (npcKey?.trim()) return;
  const eventId = editorState.get().selectedEventId;
  if (!eventId) return;
  for (const map of Object.values(store.getCurrent().maps)) {
    const event = map.events.find((entry) => entry.id === eventId);
    if (!event) continue;
    if (hasCharacterId(event)) return;
    wrap.append(
      el("p", {
        class: "event-command-friendship-hint",
        dataset: { testid: "event-command-friendship-requires-character-id" },
        text: "누구를 비우면 이 이벤트의 인물을 씁니다. 인물이 없으면 이 명령은 건너뜁니다.",
      })
    );
    return;
  }
}
