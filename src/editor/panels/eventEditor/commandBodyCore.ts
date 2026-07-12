import { openDatabaseResourcePickerDialog } from "@/editor/panels/databaseResourcePickerDialog";
import { clearChildren, el } from "@/util/dom";
import { recordUsageHint } from "./recordUsageHint";
import { selectedOptionValue, selectWithOptions } from "./dom";
import { choicesBody } from "./commandBodyChoices";
import { inputNumberBody } from "./commandBodyInputNumber";
import { labelBody } from "./commandBodyLabels";
import { loopBody } from "./commandBodyLoop";
import { setVariableBody } from "./commandBodyVariable";
import { databasePicker, conditionForm } from "./conditionForm";
import { renderFacesetPreview } from "./facesetPreview";
import { renderForkBranch } from "./forkBranch";
import { clampFaceIndex, FACESET_FACE_COUNT } from "./messageDialogControls";
import {
  BOOLEAN_OPTIONS,
  SELF_SWITCH_KEY_OPTIONS,
  TIMER_ACTION_OPTIONS,
  TIMER_ID_OPTIONS,
  type SelectOption,
} from "./options";
import type { Command, MessageWindowFormat, MessageWindowPosition } from "@/project/types";
import type { CommandEditContext } from "./types";

const MESSAGE_WINDOW_FORMAT_OPTIONS = [
  { value: "normal", label: "일반" },
  { value: "transparent", label: "투명" },
] as const satisfies readonly SelectOption<MessageWindowFormat>[];

const MESSAGE_WINDOW_POSITION_OPTIONS = [
  { value: "top", label: "상단" },
  { value: "center", label: "중앙" },
  { value: "bottom", label: "하단" },
] as const satisfies readonly SelectOption<MessageWindowPosition>[];

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
  getFriendship: getFriendshipBody,
  timer: timerBody,
  inputWait: inputWaitBody,
  inputNumber: inputNumberBody,
  label: labelBody,
  gotoLabel: labelBody,
  loop: loopBody,
  breakLoop: () => el("div", { class: "empty-hint", text: "현재 반복을 탈출합니다" }),
};

// [중간-3] 문장 표시 폼: 화자/내용 세로 스택 + 제어 문자 팔레트.
const TEXT_CONTROL_SNIPPETS: readonly { readonly key: string; readonly code: string; readonly hint: string }[] = [
  { key: "color", code: "\\c[1]", hint: "색상 변경 (0-19)" },
  { key: "hero", code: "\\n[1]", hint: "주인공 이름" },
  { key: "variable", code: "\\v[1]", hint: "변수 값" },
  { key: "gold", code: "\\$", hint: "소지금 창" },
  { key: "pause", code: "\\!", hint: "키 입력 대기" },
  { key: "wait-quarter", code: "\\.", hint: "1/4초 지연" },
  { key: "wait-second", code: "\\|", hint: "1초 지연" },
];

function textBody(context: CommandEditContext, cmd: Extract<Command, { kind: "text" }>): HTMLElement {
  const wrap = el("div", { class: "event-command-text-editor" });
  const speaker = el("input", {
    attrs: { type: "text", placeholder: "화자" },
    value: cmd.speaker ?? "",
  }) as HTMLInputElement;
  const body = el("textarea", { attrs: { placeholder: "대화 내용" } }) as HTMLTextAreaElement;
  body.value = cmd.body;
  const apply = () => {
    context.actions.replaceCommand(context.path, {
      kind: "text",
      speaker: speaker.value.trim() || undefined,
      body: body.value,
    });
  };
  speaker.addEventListener("change", apply);
  speaker.addEventListener("input", apply);
  body.addEventListener("change", apply);
  body.addEventListener("input", apply);
  wrap.append(fieldControl("화자", speaker), fieldControl("내용", body), controlCharPalette(body, apply));
  return wrap;
}

// 제어 문자 팔레트: 커서 위치에 스니펫 삽입. RM2003 제어문자 문법 그대로.
function controlCharPalette(body: HTMLTextAreaElement, apply: () => void): HTMLElement {
  const palette = el("div", {
    class: "event-command-text-palette",
    attrs: { "aria-label": "제어 문자 팔레트" },
    dataset: { testid: "event-command-text-palette" },
  });
  palette.append(el("span", { class: "event-command-text-palette-label", text: "제어 문자" }));
  for (const snippet of TEXT_CONTROL_SNIPPETS) {
    palette.append(
      el("button", {
        class: "event-command-text-palette-button",
        text: snippet.code,
        attrs: { type: "button", title: snippet.hint },
        dataset: { testid: `event-command-text-insert-${snippet.key}` },
        on: {
          click: () => {
            insertAtCursor(body, snippet.code);
            apply();
            body.focus();
          },
        },
      })
    );
  }
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

function changeFaceBody(context: CommandEditContext, cmd: Extract<Command, { kind: "changeFace" }>): HTMLElement {
  const wrap = el("div", { class: "event-command-face-editor" });
  const previewHost = el("div", {
    class: "event-command-face-preview-host",
    dataset: { testid: "event-command-face-preview-host" },
  });
  const resource = el("input", {
    class: "event-command-face-resource-input",
    attrs: { type: "text", placeholder: "얼굴 그래픽 리소스 ID", spellcheck: "false" },
    value: cmd.resourceId,
    dataset: { testid: "event-command-face-resource" },
  }) as HTMLInputElement;
  const faceIndex = el("input", {
    attrs: { type: "number", min: "1", max: String(FACESET_FACE_COUNT) },
    value: String(cmd.faceIndex + 1),
    dataset: { testid: "event-command-face-index" },
  }) as HTMLInputElement;
  const position = selectWithOptions(
    [
      { value: "left", label: "왼쪽" },
      { value: "right", label: "오른쪽" },
    ] as const,
    cmd.position,
    "event-command-face-position"
  );
  const flip = checkboxControl(cmd.flipHorizontally, "event-command-face-flip-horizontal");

  const readDraft = (): Extract<Command, { kind: "changeFace" }> => ({
    kind: "changeFace",
    resourceId: resource.value.trim(),
    faceIndex: clampFaceIndex(faceIndex.value),
    position: position.value === "right" ? "right" : "left",
    flipHorizontally: flip.checked,
  });

  const refreshPreview = (): void => {
    const draft = readDraft();
    clearChildren(previewHost);
    previewHost.append(
      renderFacesetPreview({
        resourceId: draft.resourceId,
        faceIndex: draft.faceIndex,
        position: draft.position,
        flipHorizontally: draft.flipHorizontally,
        displaySize: 112,
      })
    );
  };

  const apply = (): void => {
    context.actions.replaceCommand(context.path, readDraft());
    refreshPreview();
  };

  resource.addEventListener("change", apply);
  resource.addEventListener("input", () => {
    // Live left-card refresh while typing; staged commit still on change/blur via apply.
    refreshPreview();
  });
  faceIndex.addEventListener("change", apply);
  faceIndex.addEventListener("input", refreshPreview);
  position.addEventListener("change", apply);
  flip.addEventListener("change", apply);

  const openPicker = (): void => {
    const draft = readDraft();
    openDatabaseResourcePickerDialog({
      kind: "faceset",
      title: "얼굴 그래픽 선택",
      currentId: draft.resourceId,
      currentFaceIndex: draft.faceIndex,
      allowClear: true,
      testidPrefix: "event-command-face-resource-dialog",
      onConfirm: (result) => {
        resource.value = result.resourceId;
        faceIndex.value = String((result.faceIndex ?? 0) + 1);
        apply();
      },
    });
  };

  const clearResource = (): void => {
    resource.value = "";
    faceIndex.value = "1";
    apply();
  };

  refreshPreview();

  const resourceRow = el("div", {
    class: "event-command-face-resource-row",
    children: [
      resource,
      el("button", {
        class: "btn small event-command-face-pick",
        text: "설정…",
        attrs: { type: "button", "aria-label": "얼굴 그래픽 리소스 선택" },
        dataset: { testid: "event-command-face-resource-set" },
        on: { click: openPicker },
      }),
      el("button", {
        class: "btn small event-command-face-clear",
        text: "해제",
        attrs: { type: "button" },
        dataset: { testid: "event-command-face-resource-clear" },
        on: { click: clearResource },
      }),
    ],
  });

  wrap.append(
    previewHost,
    el("div", {
      class: "event-command-face-fields",
      children: [
        fieldControl("얼굴 그래픽", resourceRow),
        fieldControl("얼굴 번호", faceIndex),
        fieldControl("표시 위치", position),
        fieldControl("좌우 반전", flip),
        el("p", {
          class: "event-command-face-hint",
          text: "이후 문장 표시 창에 이 얼굴이 붙습니다. 오른쪽 미리보기는 플레이 시 대사 창 모습입니다.",
        }),
      ],
    })
  );
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
  const format = selectWithOptions(MESSAGE_WINDOW_FORMAT_OPTIONS, cmd.format, "event-command-message-format");
  const position = selectWithOptions(MESSAGE_WINDOW_POSITION_OPTIONS, cmd.position, "event-command-message-position");
  const preventObscuring = checkboxControl(cmd.preventObscuringPlayer, "event-command-message-prevent-obscuring");
  const allowMovement = checkboxControl(cmd.allowEventMovementDuringWait, "event-command-message-allow-movement");
  const apply = () => {
    context.actions.replaceCommand(context.path, {
      kind: "displayTextSettings",
      format: selectedOptionValue(format, MESSAGE_WINDOW_FORMAT_OPTIONS, cmd.format),
      position: selectedOptionValue(position, MESSAGE_WINDOW_POSITION_OPTIONS, cmd.position),
      preventObscuringPlayer: preventObscuring.checked,
      allowEventMovementDuringWait: allowMovement.checked,
    });
  };
  format.addEventListener("change", apply);
  position.addEventListener("change", apply);
  preventObscuring.addEventListener("change", apply);
  allowMovement.addEventListener("change", apply);
  wrap.append(
    settingsGroup("윈도우 표시 형식", [
      fieldControl("표시 형식", format),
      el("p", {
        class: "event-command-settings-hint",
        text: "일반은 창 스킨 배경, 투명은 글자만 표시합니다.",
      }),
    ]),
    settingsGroup("윈도우 위치", [
      fieldControl("표시 위치", position),
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
    attrs: { type: "text", placeholder: "플래그 이름" },
    value: cmd.flag,
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
  wrap.append(fieldControl("플래그", flag), fieldControl("값", val));
  return wrap;
}

function setSelfSwitchBody(context: CommandEditContext, cmd: Extract<Command, { kind: "setSelfSwitch" }>): HTMLElement {
  const wrap = el("span", {});
  const key = selectWithOptions(SELF_SWITCH_KEY_OPTIONS, cmd.key, "event-command-self-switch-key");
  const val = selectWithOptions(BOOLEAN_OPTIONS, String(cmd.value), "event-command-self-switch-value");
  const apply = () => {
    context.actions.replaceCommand(context.path, {
      kind: "setSelfSwitch",
      key: key.value as "A" | "B" | "C" | "D",
      value: val.value === "true",
    });
  };
  key.addEventListener("change", apply);
  val.addEventListener("change", apply);
  wrap.append(fieldControl("셀프 스위치", key), fieldControl("값", val));
  return wrap;
}

function forkBody(context: CommandEditContext, cmd: Extract<Command, { kind: "fork" }>): HTMLElement {
  const wrap = el("div", {});
  wrap.append(conditionForm(cmd.condition, (condition) => {
    context.actions.replaceCommand(context.path, { ...cmd, condition });
  }));
  wrap.append(renderForkBranch(context.path, context.actions, cmd, "then", cmd.then));
  if (cmd.else) {
    wrap.append(renderForkBranch(context.path, context.actions, cmd, "else", cmd.else));
  } else {
    wrap.append(el("button", {
      class: "btn",
      text: "+ else 추가",
      on: { click: () => context.actions.replaceCommand(context.path, { ...cmd, else: [] }) },
    }));
  }
  return wrap;
}

function setSwitchBody(context: CommandEditContext, cmd: Extract<Command, { kind: "setSwitch" }>): HTMLElement {
  // [치명-2] 전용 레코드 폼 레이아웃(스타일: .event-command-record-form) — 셀렉트 최소폭 보장,
  // ... 피커 버튼과 수평 배치, 빈 공간에는 참조 요약을 표시한다.
  const wrap = el("div", { class: "event-command-record-form" });
  let currentSwitchId = cmd.switchId;
  const swSel = databasePicker("switch", cmd.switchId, (switchId) => {
    currentSwitchId = switchId;
    context.actions.replaceCommand(context.path, { ...cmd, switchId });
  });
  const val = selectWithOptions(BOOLEAN_OPTIONS, String(cmd.value));
  val.addEventListener("change", () => {
    context.actions.replaceCommand(context.path, { ...cmd, switchId: currentSwitchId, value: val.value === "true" });
  });
  wrap.append(
    fieldControl("스위치", swSel),
    fieldControl("값", val),
    recordUsageHint("switch", cmd.switchId)
  );
  return wrap;
}

function inputWaitBody(context: CommandEditContext, cmd: Extract<Command, { kind: "inputWait" }>): HTMLElement {
  const wrap = el("div", {});
  wrap.append(el("span", { class: "empty-hint", text: "아무 키 대기 (변수 미지정 시 키 코드 저장 안 함)" }));
  let currentVariableId = cmd.variableId ?? "";
  const variablePicker = databasePicker("variable", currentVariableId, (variableId) => {
    currentVariableId = variableId;
    context.actions.replaceCommand(context.path, { kind: "inputWait", variableId: currentVariableId });
  });
  wrap.append(el("label", { class: "inline-field", children: [el("span", { text: "키 코드 저장 변수(선택)" }), variablePicker] }));
  return wrap;
}

function changeFriendshipBody(context: CommandEditContext, cmd: Extract<Command, { kind: "changeFriendship" }>): HTMLElement {
  const wrap = el("div", { class: "event-command-record-form" });
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
  wrap.append(fieldControl("NPC 키", npcKey), fieldControl("변화량", delta));
  return wrap;
}

function getFriendshipBody(context: CommandEditContext, cmd: Extract<Command, { kind: "getFriendship" }>): HTMLElement {
  const wrap = el("div", { class: "event-command-record-form" });
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
  wrap.append(fieldControl("NPC 키", npcKey), fieldControl("저장 변수", variablePicker), recordUsageHint("variable", cmd.variableId));
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
  wrap.append(fieldControl("동작", action), fieldControl("타이머", timerId), fieldControl("시간(초)", secs));
  return wrap;
}
