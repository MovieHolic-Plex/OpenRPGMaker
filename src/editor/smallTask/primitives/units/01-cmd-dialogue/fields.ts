import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { commandSummary } from "@/editor/panels/eventEditor/commandSummary";
import type { JsonSchema } from "@/editor/tools/types";
import { resolveAppearancePortrait } from "@/project/characterAppearances";
import { MAX_SHOWN_CHOICES } from "@/project/choiceView";
import { DIALOGUE_FULL_PORTRAIT_LIMITS } from "@/project/dialogueStyles";
import { facePresentationForResource } from "@/project/facePresentation";
import { validateCommands } from "@/project/io/commandReferenceValidation";
import { ProjectFormatError } from "@/project/io/errors";
import { collectResourceIds } from "@/project/io/resourceReferenceValidation";
import { uploadedAssetMime } from "@/project/persistence/assetAccessors";
import type { Command, Project } from "@/project/types";
import { PrimitiveError } from "../../errors";
import { displayText } from "../../../target";

const string = (description: string): JsonSchema => ({ type: "string", description });
const id = (description: string): JsonSchema => ({ ...string(description), minLength: 1 });
const flag = (description: string): JsonSchema => ({ type: "boolean", description });
const options = (description: string, ...values: string[]): JsonSchema => ({ type: "string", enum: values, description });
const integer = (description: string, minimum: number, maximum: number): JsonSchema =>
  ({ type: "integer", minimum, maximum, description });
const ids = (description: string): JsonSchema =>
  ({ type: "array", items: id("자료에서 확인한 아이템 식별자"), description });
const fullScale = DIALOGUE_FULL_PORTRAIT_LIMITS.scale;

export const dialogueFields = {
  text: {
    title: "대사",
    fields: {
      body: id("화면에 표시할 대사. 줄바꿈을 포함할 수 있습니다."),
      speaker: string("말하는 인물의 이름. 비워 두면 이름을 숨깁니다."),
      emotion: options("표정. 기본, 기쁨, 슬픔, 분노, 놀람 중 하나입니다.", "neutral", "happy", "sad", "angry", "surprised"),
      autoAdvance: flag("확인 입력 없이 대사를 넘길지 정합니다."),
      position: options("이 대사의 창 위치. 자동, 위, 가운데, 아래 중 하나입니다.", "auto", "top", "center", "bottom"),
    },
    insertRequires: ["body"],
  },
  changeFace: {
    title: "얼굴 바꾸기",
    fields: {
      resourceId: string("프로젝트에서 확인한 얼굴 그림 식별자. 빈 문자열을 보내면 얼굴을 숨깁니다."),
      appearanceId: id("얼굴을 가져올 인물 외형의 식별자."),
      position: options("얼굴을 띄울 쪽. 왼쪽 또는 오른쪽입니다.", "left", "right"),
      flipHorizontally: flag("그림을 좌우로 뒤집을지 정합니다."),
      presentation: options("그림 형태. 얼굴, 흉상, 전신 중 하나입니다.", "face", "bust", "full"),
      fullScale: integer(`전신 그림 배율. ${fullScale.min}%부터 ${fullScale.max}%까지이며 기본 크기는 100%입니다.`,
        fullScale.min, fullScale.max),
    },
    insertRequires: [],
  },
  choices: {
    title: "선택지",
    fields: {
      prompt: string("선택지와 함께 표시할 질문."),
      optionLabels: {
        type: "array", minItems: 1, maxItems: MAX_SHOWN_CHOICES,
        items: id("화면에 표시할 선택지 문구."),
        description: "화면 순서대로 적은 선택지 문구. 수정할 때는 기존 선택지 수와 같아야 합니다.",
      },
      cancelBehavior: options("취소 처리. 취소 금지, 첫째부터 다섯째 중 하나 선택, 또는 취소 분기 실행입니다.",
        "disallow", "choice1", "choice2", "choice3", "choice4", "choice5", "branch"),
    },
    appendOption: id("기존 선택지 끝에 추가할 문구. 추가한 줄의 분기는 비어 있습니다."),
    insertRequires: [],
  },
  presentItem: {
    title: "아이템 제시",
    fields: {
      prompt: string("무엇을 보여 줄지 묻는 안내 문구."),
      itemIds: ids("목록에 띄울 아이템 식별자. 빈 목록은 기본 후보를 띄웁니다."),
      consume: flag("정답 아이템을 보여 주면 한 개를 소모할지 정합니다."),
    },
    correctItemIds: ids("정답으로 받을 아이템 식별자. 각각 빈 분기를 만듭니다."),
    insertRequires: [],
  },
  inputWait: {
    title: "입력 대기",
    fields: {
      variableId: string("누른 키를 저장할 변수 식별자. 빈 문자열을 보내면 입력만 기다립니다."),
    },
    insertRequires: [],
  },
  inputNumber: {
    title: "숫자 입력",
    fields: {
      variableId: id("입력한 숫자를 저장할 변수 식별자."),
      digits: integer("입력할 수 있는 최대 자릿수. 한 자리부터 여섯 자리까지입니다.", 1, 6),
      prompt: string("숫자 입력창 위에 표시할 안내 문구."),
      showPad: flag("화면에 숫자 키패드를 함께 띄울지 정합니다."),
    },
    insertRequires: ["variableId"],
  },
  enterHeroName: {
    title: "이름 입력",
    fields: {
      actorId: string("이름을 바꿀 배우 식별자. 문자열 변수에 저장할 때는 비워도 됩니다."),
      stringVariableId: string("입력한 글자를 저장할 변수 식별자. 빈 문자열을 보내면 배우 이름을 바꿉니다."),
      maxLength: integer("입력할 수 있는 최대 글자 수. 한 자부터 열두 자까지입니다.", 1, 12),
      showInitialName: flag("입력창을 열 때 기존 이름이나 글자를 채워 둘지 정합니다."),
      prompt: string("문자열 입력창 위에 표시할 안내 문구."),
      presentation: options("입력 화면 연출. 기본 창 또는 별빛 연출입니다.", "window", "showcase"),
    },
    insertRequires: [],
  },
  displayTextSettings: {
    title: "문장 표시 설정",
    fields: {
      format: options("대화창 형태. 일반 창 또는 투명 창입니다.", "normal", "transparent"),
      position: options("대화창 위치. 위, 가운데, 아래 중 하나입니다.", "top", "center", "bottom"),
      preventObscuringPlayer: flag("대화창이 주인공을 가리지 않도록 옮길지 정합니다."),
      allowEventMovementDuringWait: flag("대사에 응답을 기다리는 동안 이벤트가 움직일 수 있게 할지 정합니다."),
    },
    insertRequires: [],
  },
} satisfies Record<string, { title: string; fields: Record<string, JsonSchema>; insertRequires: string[] } & Record<string, unknown>>;

export type DialogueKind = keyof typeof dialogueFields;
export type DialogueCommand = Extract<Command, { kind: DialogueKind }>;

function recordIds(records: readonly { id: string }[] | undefined): Set<string> {
  return new Set(records?.map(record => record.id));
}

function requireVariable(project: Project, variableId: string | undefined) {
  if (variableId && !project.variables.some(variable => variable.id === variableId)) {
    throw new PrimitiveError("입력을 저장할 변수를 찾을 수 없습니다.");
  }
}

function requirePortraitImage(project: Project, resourceId: string): void {
  const uploaded = Object.hasOwn(project.assets.uploaded, resourceId) ? project.assets.uploaded[resourceId] : undefined;
  const url = resolveAssetResourceUrl(resourceId, { project });
  const image = uploaded?.ref
    ? /^image\/(?:png|jpeg|webp|gif)$/iu.test(uploadedAssetMime(uploaded))
    : url !== null && (/\.(?:png|jpe?g|webp|gif)(?:[?#].*)?$/iu.test(url) || /^data:image\/(?:png|jpeg|webp|gif);base64,/iu.test(url));
  if (!image || uploaded?.kind === "music" || uploaded?.kind === "sound" || uploaded?.kind === "movie") {
    throw new PrimitiveError("대화창에 표시할 수 있는 얼굴 그림을 골라 주세요.");
  }
}

/** Validate the edited row, leaving pre-existing commands in its branches alone. */
export function validateDialogueReferences(project: Project, command: DialogueCommand, patch: Readonly<Record<string, unknown>>) {
  if (command.kind === "inputWait") requireVariable(project, command.variableId);
  if (command.kind === "enterHeroName") {
    requireVariable(project, command.stringVariableId);
    if (!command.actorId.trim() && !command.stringVariableId) {
      throw new PrimitiveError("이름을 바꿀 배우나 글자를 저장할 변수를 골라 주세요.");
    }
  }
  if (command.kind === "changeFace") {
    if (command.resourceId && !command.resourceId.trim()) throw new PrimitiveError("얼굴 그림을 골라 주세요.");
  }
  if (command.kind !== "changeFace" && command.kind !== "presentItem" &&
      command.kind !== "inputNumber" && command.kind !== "enterHeroName") return;

  const empty = new Set<string>();
  const row = command.kind === "presentItem" ? {
    ...command,
    options: command.options.map(option => ({ ...option, branch: [] })),
    otherwiseBranch: [],
    cancelBranch: [],
  } : command;
  try {
    validateCommands([row], {
      appearanceIds: recordIds(project.database.characterAppearances),
      actorIds: recordIds(project.database.actors),
      itemIds: recordIds(project.database.items),
      variableIds: recordIds(project.variables),
      resourceIds: command.kind === "changeFace" ? collectResourceIds(project) : empty,
      classIds: empty, enemyIds: empty, equipmentIds: empty, skillIds: empty, animationIds: empty,
      switchIds: empty, mapIds: empty, commonEventIds: empty, endingIds: empty, gameOverIds: empty, troopIds: empty, speciesIds: empty,
    });
  } catch (error) {
    if (!(error instanceof ProjectFormatError)) throw error;
    const messages = {
      changeFace: "지정한 얼굴 그림이나 인물 외형을 찾을 수 없습니다.",
      presentItem: "제시할 아이템을 자료집에서 찾을 수 없습니다.",
      inputNumber: "숫자를 저장할 변수를 찾을 수 없습니다.",
      enterHeroName: "이름을 바꿀 배우를 자료집에서 찾을 수 없습니다.",
    };
    throw new PrimitiveError(messages[command.kind]);
  }

  if (command.kind !== "changeFace") return;
  if (command.appearanceId && (Object.hasOwn(patch, "appearanceId") || Object.hasOwn(patch, "presentation"))) {
    const portrait = resolveAppearancePortrait(project, command.appearanceId, command.presentation ?? "face");
    if (!portrait) throw new PrimitiveError("선택한 인물 외형에 표시할 초상이 없습니다.");
    requirePortraitImage(project, portrait.resourceId);
  } else if (command.resourceId && Object.hasOwn(patch, "resourceId")) {
    requirePortraitImage(project, command.resourceId);
  }
}

function previewText(text: string, fallback = ""): string {
  return displayText(text.replace(/[\p{Script=Latin}\d_:@/.-]*\p{Script=Latin}[\p{Script=Latin}\d_:@/.-]*/gu, "…")
    .replace(/[{}[\]<>]/gu, ""), fallback);
}

function recordLabel(records: readonly { id: string; name: string }[] | undefined, key: string, fallback: string): string {
  const name = records?.find(record => record.id === key)?.name;
  return previewText(name && name !== key ? name : "", fallback);
}

export function dialogueDetail(project: Project, command: DialogueCommand): string {
  switch (command.kind) {
    case "text":
      return commandSummary({ ...command, body: previewText(command.body, "대사 문구"), speaker: previewText(command.speaker ?? "") });
    case "choices":
      return commandSummary({
        ...command,
        prompt: previewText(command.prompt ?? ""),
        options: command.options.map(option => ({ ...option, text: previewText(option.text, "선택 문구") })),
      });
    case "displayTextSettings":
      return commandSummary(command);
    case "changeFace": {
      const portrait = command.appearanceId
        ? resolveAppearancePortrait(project, command.appearanceId, command.presentation ?? "face")
        : command;
      if (!portrait?.resourceId) return "얼굴 숨기기";
      const side = command.position === "left" ? "왼쪽" : "오른쪽";
      const mode = portrait.presentation ?? facePresentationForResource(portrait.resourceId);
      const shape = mode === "bust" ? "흉상" : mode === "full" ? "전신" : "얼굴";
      return `${side} ${shape}${command.flipHorizontally ? " 좌우 반전" : ""}`;
    }
    case "presentItem":
      return `아이템 제시 · ${previewText(command.prompt ?? "", "소지품에서 고르기")}`;
    case "inputWait":
      return command.variableId
        ? `키 입력 대기 · ${recordLabel(project.variables, command.variableId, "지정한 변수")}에 저장`
        : commandSummary(command);
    case "inputNumber":
      return `${recordLabel(project.variables, command.variableId, "지정한 변수")}에 최대 ${command.digits}자리 숫자 입력`;
    case "enterHeroName":
      return command.stringVariableId
        ? `${recordLabel(project.variables, command.stringVariableId, "지정한 변수")}에 최대 ${command.maxLength}자 입력`
        : `${recordLabel(project.database.actors, command.actorId, "지정한 배우")}의 이름을 최대 ${command.maxLength}자 입력`;
  }
}
