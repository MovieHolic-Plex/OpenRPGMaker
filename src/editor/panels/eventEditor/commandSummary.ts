import { gameOverName } from "@/project/gameOverLibrary";
import { equipmentSlotLabel as catalogSlotLabel } from "@/project/equipmentSlots";
import {
  compareAmountLabel,
  pictureSlotCaption,
  runResultLabel,
  seasonLabel,
  timePhaseLabel,
  timerIdLabel,
} from "./options";
import { formatWeightedBranchSummary } from "./weightedBranchTable";
import { BGM_CATALOG } from "@/assets/bgmCatalog";
import { m2CommandById, type M2CommandFieldSpec } from "@/project/eventCommands/m2Catalog";
import { tintDurationMs } from "@/project/eventCommands/tintDuration";
import { coordinateAxisSpec, coordinateFailurePolicy } from "@/project/eventCommands/coordinateDestination";
import { store } from "@/project/store";
import { editorState } from "@/editor/editorState";
import { eventDisplayName } from "@/project/eventDisplayName";
import { PLAYER_MOVE_TARGET } from "@/project/moveRouteTarget";
import { EMOTE_LABELS } from "@/project/emotes";
import type { Command, SwitchValue, VariableOperand } from "@/project/types";

import { relationshipStateName } from "@/project/relationshipState";
import { textBodyOf } from "@/project/io/rewriteLegacyDialogue";
import { insideLocationSentence } from "@/editor/mapLocationLabels";
export type CommandSummaryTone =
  | "plain"
  | "command"
  | "value"
  // 연산 토큰 전용 톤. += 계열은 증가(성공색), -= 는 감소(위험색), = 는 대입(액센트색).
  | "op-add"
  | "op-sub"
  | "op-set"
  // 스위치/플래그 ON·OFF 배지 톤.
  | "badge-on"
  | "badge-off"
  // 선택지 옵션 칩 / 취소 배지.
  | "choice-option"
  | "choice-cancel";

export type CommandSummaryPart = {
  readonly text: string;
  readonly tone: CommandSummaryTone;
};

// 아이템/장비 아이콘 토큰. 문자열 요약(commandSummary)에는 기여하지 않고
// 커맨드 리스트 렌더에서만 16px 이미지로 그려진다. text 를 빈 문자열로 고정해
// `{text, tone}` 기반 기존 소비 코드(테스트 포함)와의 호환을 유지한다.
export type CommandSummaryIconPart = {
  readonly kind: "icon";
  readonly resourceId: string;
  readonly text: "";
  readonly tone: "plain";
};

// [P1] 인라인 썸네일 토큰. 아이콘 토큰과 같은 규약(text:"" 고정, 16px 상한)으로
// 얼굴 크롭/캐릭터 스프라이트/맵 미니 썸네일을 리스트 줄에 부가한다.
export type CommandSummaryVisual =
  | { readonly type: "faceCrop"; readonly resourceId: string }
  | { readonly type: "charsetSprite"; readonly spriteId: string }
  | { readonly type: "mapThumb"; readonly mapId: string };

export type CommandSummaryVisualPart = {
  readonly kind: "visual";
  readonly visual: CommandSummaryVisual;
  readonly text: "";
  readonly tone: "plain";
};

export type CommandSummaryToken = CommandSummaryPart | CommandSummaryIconPart | CommandSummaryVisualPart;

// 아이콘 토큰 판별. 렌더러가 이미지/텍스트 분기할 때 사용한다.
export function isSummaryIconPart(part: CommandSummaryToken): part is CommandSummaryIconPart {
  return "kind" in part && part.kind === "icon";
}

// 썸네일 토큰 판별.
export function isSummaryVisualPart(part: CommandSummaryToken): part is CommandSummaryVisualPart {
  return "kind" in part && part.kind === "visual";
}

export function commandSummary(cmd: Command): string {
  // 아이콘/썸네일 토큰은 문자열 변환 시 스킵한다 (text 가 "" 라 join 결과는 어차피 불변).
  return commandSummaryParts(cmd)
    .filter((part) => !isSummaryIconPart(part) && !isSummaryVisualPart(part))
    .map((part) => part.text)
    .join("");
}

export function commandSummaryParts(cmd: Command): readonly CommandSummaryToken[] {
  const handler = commandSummaryPartHandlers[cmd.kind] as CommandSummaryPartHandler<Command> | undefined;
  return handler ? handler(cmd) : [commandPart("명령")];
}

type CommandSummaryPartHandler<T extends Command> = (cmd: T) => readonly CommandSummaryToken[];
type CommandSummaryPartHandlers = {
  readonly [K in Command["kind"]]?: CommandSummaryPartHandler<Extract<Command, { kind: K }>>;
};

const commandSummaryPartHandlers: CommandSummaryPartHandlers = {
  text: (cmd) => commandLine(
    "문장 표시",
    textPart(oneLine(textBodyOf(cmd) || "...")),
    ...(cmd.emotion && cmd.emotion !== "neutral" ? [plainPart(" · "), valuePart(textEmotionLabel(cmd.emotion))] : []),
    ...(cmd.autoAdvance ? [plainPart(" · "), valuePart("자동 넘김")] : [])
  ),
  changeFace: (cmd) => commandLine(
    "얼굴 바꾸기",
    ...(cmd.resourceId ? [faceVisualPart(cmd.resourceId)] : []),
    valuePart(faceSheetLabel(cmd.resourceId)),
    plainPart(" · "),
    valuePart(facePositionLabel(cmd.position)),
    ...(cmd.flipHorizontally ? [plainPart(" / "), valuePart("좌우 반전")] : [])
  ),
  displayTextSettings: (cmd) => commandLine(
    "문장 표시 설정",
    valuePart(messageWindowFormatLabel(cmd.format)),
    plainPart(" / "),
    valuePart(messageWindowPositionLabel(cmd.position)),
    ...(cmd.preventObscuringPlayer ? [plainPart(" / "), valuePart("가림 방지")] : []),
    ...(cmd.allowEventMovementDuringWait ? [plainPart(" / "), valuePart("이동 허용")] : [])
  ),
  choices: (cmd) => choicesSummaryParts(cmd),
  presentItem: (cmd) => commandLine(
    "아이템 제시",
    ...(cmd.prompt ? [valuePart(oneLine(cmd.prompt)), plainPart("  ")] : []),
    ...(cmd.options.length === 0
      ? [valuePart("(정답 없음)")]
      : cmd.options.flatMap((option, index) => [
        ...(index > 0 ? [plainPart(" ")] : []),
        choiceOptionPart(itemName(option.itemId)),
      ])),
    ...(cmd.consume ? [plainPart(" · "), valuePart("소모")] : [])
  ),
  fork: (cmd) => commandLine("조건 분기", valuePart(conditionSummary(cmd.condition))),
  wait: (cmd) => {
    if (cmd.variableId?.trim()) {
      return commandLine("대기", plainPart("변수 "), valuePart(recordName("variable", cmd.variableId)));
    }
    return commandLine("대기", valuePart((cmd.ms / 1000).toFixed(1)), plainPart(" 초"));
  },
  inputWait: (cmd) => cmd.variableId
    ? commandLine("키 입력 대기", valuePart(recordName("variable", cmd.variableId)))
    : [commandPart("입력 대기")],
  inputNumber: (cmd) =>
    commandLine(
      "숫자 입력",
      valuePart(recordName("variable", cmd.variableId)),
      plainPart(" / "),
      valuePart(String(cmd.digits)),
      plainPart("자리"),
      ...(cmd.prompt?.trim() ? [plainPart(" · "), valuePart(cmd.prompt.trim())] : []),
      ...(cmd.showPad ? [plainPart(" · "), valuePart("키패드")] : [])
    ),
  label: (cmd) => commandLine("라벨", valuePart(cmd.name)),
  gotoLabel: (cmd) => commandLine("라벨로 점프", valuePart(cmd.name)),
  loop: (cmd) => commandLine("반복", valuePart(String(cmd.body.length)), plainPart("개 명령")),
  breakLoop: () => [commandPart("반복 탈출")],
  setSwitch: (cmd) => commandLine(
    "스위치 조작",
    valuePart(recordName("switch", cmd.switchId)),
    plainPart(" "),
    ...switchValueParts(cmd.value),
  ),
  setVariable: (cmd) => commandLine(
    "변수 조작",
    valuePart(recordName("variable", cmd.variableId)),
    plainPart(" "),
    opPart(cmd.op),
    plainPart(" "),
    valuePart(operandSummary(cmd.value))
  ),
  timer: (cmd) => commandLine("타이머", valuePart(timerActionLabel(cmd.action)), ...(cmd.seconds !== undefined ? [plainPart(" "), valuePart(String(cmd.seconds)), plainPart("초")] : [])),
  advanceTime: (cmd) => commandLine("시간 진행", valuePart(advanceTimeSummary(cmd))),
  advanceCropGrowth: (cmd) => commandLine("작물 성장 진행", valuePart(`${cmd.days}일`)),
  setTime: (cmd) => commandLine("시간 설정", valuePart(`${String(cmd.hour).padStart(2, "0")}:${String(cmd.minute ?? 0).padStart(2, "0")}`)),
  sleepUntilMorning: () => [commandPart("다음날 아침까지 취침")],
  transfer: (cmd) => cmd.direction && cmd.direction !== "retain"
    ? commandLine(
        "장소 이동",
        ...mapThumbParts(cmd.mapId),
        valuePart(mapName(cmd.mapId)),
        plainPart(" ("),
        valuePart(`${cmd.x},${cmd.y}`),
        plainPart(") / "),
        valuePart(transferDirectionSummary(cmd.direction))
      )
    : commandLine("장소 이동", ...mapThumbParts(cmd.mapId), valuePart(mapName(cmd.mapId)), plainPart(" ("), valuePart(`${cmd.x},${cmd.y}`), plainPart(")")),
  moveEvent: (cmd) => commandLine(
    "이동 경로 설정",
    ...moveRouteSpriteParts(cmd),
    valuePart(cmd.eventId === PLAYER_MOVE_TARGET ? "주인공" : eventNameForSummary(cmd.eventId)),
    plainPart(" ("),
    valuePart(String(cmd.route.moves.length)),
    plainPart("개)")
  ),
  setEventGraphicPattern: (cmd) => commandLine(
    "모습 바꾸기",
    valuePart(!cmd.eventId || cmd.eventId === "this" ? "이 이벤트" : eventNameForSummary(cmd.eventId)),
    plainPart(" · "),
    valuePart(`모습 ${Number(cmd.pattern) + 1}`)
  ),
  changeTile: (cmd) => commandLine(
    "지형 변경",
    valuePart(mapName(cmd.mapId)),
    plainPart(" "),
    valuePart(tileLayerSummary(cmd.layer)),
    plainPart(" ("),
    valuePart(`${cmd.x},${cmd.y}`),
    plainPart(") → "),
    valuePart(tileValueCaption(cmd.tile))
  ),
  callCommonEvent: (cmd) => commandLine("다른 이벤트 부르기", valuePart(commonEventName(cmd.commonEventId))),
  callMapEvent: (cmd) => commandLine("맵 위 이벤트 부르기", valuePart(mapEventName(cmd.eventId))),
  battleProcessing: (cmd) => commandLine(
    "전투",
    valuePart(
      cmd.troopSource === "variable"
        ? `변수 ${cmd.troopVariableId || "?"}`
        : troopName(cmd.troopId)
    ),
    plainPart(" / "),
    valuePart(cmd.canEscape ? "도망 가능" : "도망 불가"),
    plainPart(" / "),
    valuePart(cmd.canLose ? "패배 허용" : "게임오버"),
    plainPart(cmd.battleFlow === "strict" ? " / 엄격" : cmd.battleFlow === "gauge" ? " / 게이지" : ""),
    plainPart(cmd.branchOnResult ? " / 결과 분기" : ""),
  ),
  learnSkill: (cmd) => commandLine(
    "스킬 변경",
    valuePart(cmd.actorId ? actorName(cmd.actorId) : "파티 전체"),
    plainPart(" "),
    valuePart(cmd.action === "forget" ? "잊기" : "배우기"),
    plainPart(" "),
    valuePart(skillName(cmd.skillId)),
  ),
  changeExp: (cmd) => commandLine(
    "경험치 변경",
    valuePart(cmd.actorId ? actorName(cmd.actorId) : "파티 전체"),
    plainPart(" "),
    opPart(cmd.op),
    plainPart(" "),
    valuePart(typeof cmd.amount === "number" ? String(cmd.amount) : operandSummary(cmd.amount)),
  ),
  changeLevel: (cmd) => commandLine("레벨 변경", valuePart(actorName(cmd.actorId)), plainPart(" "), opPart(cmd.op), plainPart(" "), valuePart(String(cmd.amount))),
  promoteActor: (cmd) => commandLine("승급", valuePart(actorName(cmd.actorId)), plainPart(" → "), valuePart(cmd.toClassId ? className(cmd.toClassId) : "자동 선택")),
  changeEquipment: (cmd) => commandLine(
    "장비 변경",
    valuePart(actorName(cmd.actorId)),
    plainPart(" / "),
    valuePart(equipmentSlotLabel(cmd.slot)),
    plainPart(" = "),
    ...equipmentIconParts(cmd.equipmentId),
    valuePart(equipmentName(cmd.equipmentId))
  ),
  changeActorHp: (cmd) => commandLine(
    "HP 변경",
    valuePart(actorName(cmd.actorId)),
    plainPart(" "),
    opPart(cmd.op),
    plainPart(" "),
    valuePart(formatActorVitalAmount(cmd.amount, cmd.amountMode))
  ),
  changeActorMp: (cmd) => commandLine(
    "MP 변경",
    valuePart(actorName(cmd.actorId)),
    plainPart(" "),
    opPart(cmd.op),
    plainPart(" "),
    valuePart(formatActorVitalAmount(cmd.amount, cmd.amountMode))
  ),
  recoverAll: (cmd) => commandLine("모두 회복", valuePart(cmd.actorId ? actorName(cmd.actorId) : "파티 전체")),
  enterHeroName: (cmd) => commandLine("이름 입력", valuePart(actorName(cmd.actorId)), plainPart(" / 최대 "), valuePart(String(cmd.maxLength)), plainPart("자")),
  changeGold: (cmd) => commandLine(
    "소지금 변경",
    opPart(cmd.op),
    plainPart(" "),
    valuePart(typeof cmd.amount === "number" ? String(cmd.amount) : operandSummary(cmd.amount)),
  ),
  craftRecipe: (cmd) => commandLine(
    "제작",
    valuePart(recipeName(cmd.recipeId)),
    ...resultVariableSummaryParts(cmd.resultVariableId),
  ),
  applyItemUpgrade: (cmd) => commandLine(
    "아이템 업그레이드",
    valuePart(upgradeName(cmd.upgradeId)),
    ...resultVariableSummaryParts(cmd.resultVariableId),
  ),
  equipTool: (cmd) => commandLine("도구 장착", valuePart(cmd.itemId ? itemName(cmd.itemId) : "해제")),
  openChest: (cmd) => commandLine(
    "보관 상자",
    valuePart(cmd.displayName || cmd.chestId || "이 타일 상자"),
    ...(cmd.template ? [plainPart(" · "), valuePart(cmd.template === "farm" ? "농장" : cmd.template === "warehouse" ? "창고" : "금고")] : []),
  ),
  changeItem: (cmd) => commandLine(
    "아이템 변경",
    ...itemIconParts(cmd.itemId),
    valuePart(itemName(cmd.itemId)),
    plainPart(" "),
    opPart(cmd.op),
    plainPart(" "),
    valuePart(typeof cmd.amount === "number" ? String(cmd.amount) : operandSummary(cmd.amount)),
  ),
  changeFriendship: (cmd) => commandLine(
    "호감도 변경",
    valuePart(cmd.npcKey || "이 이벤트"),
    plainPart(" "),
    opPart(cmd.delta >= 0 ? "+=" : "-="),
    plainPart(" "),
    valuePart(String(Math.abs(cmd.delta)))
  ),
  changeFactionStance: (cmd) => commandLine(
    "진영 태도 변경",
    valuePart(cmd.a),
    plainPart(" ↔ "),
    valuePart(cmd.b),
    plainPart(" "),
    opPart(cmd.op),
    plainPart(" "),
    valuePart(String(cmd.value)),
  ),
  getFriendship: (cmd) => commandLine("호감도 읽기", valuePart(cmd.npcKey || "이 이벤트"), plainPart(" → "), valuePart(recordName("variable", cmd.variableId))),
  changeParty: (cmd) => commandLine("파티 멤버 변경", valuePart(actorName(cmd.actorId)), plainPart(" "), valuePart(cmd.action === "add" ? "추가" : "제외")),
  giveMonster: (cmd) => commandLine(
    "몬스터 지급",
    valuePart(monsterSpeciesName(cmd.speciesId)),
    plainPart(" Lv."),
    valuePart(String(cmd.level)),
    ...(cmd.nickname ? [plainPart(" / "), valuePart(cmd.nickname)] : [])
  ),
  moveMonster: (cmd) => commandLine("몬스터 이동", valuePart(monsterInstanceLabel(cmd.instanceId)), plainPart(" → "), valuePart(cmd.to === "party" ? "파티" : "보관함")),
  evolveMonster: (cmd) => commandLine("몬스터 진화", valuePart(monsterInstanceLabel(cmd.instanceId)), plainPart(" → "), valuePart(cmd.toSpeciesId ? monsterSpeciesName(cmd.toSpeciesId) : "조건 충족 첫 진화")),
  addFollower: (cmd) => commandLine("동료 추가", valuePart(cmd.name || (cmd.actorId ? actorName(cmd.actorId) : cmd.graphic?.sprite?.id ?? "그래픽"))),
  removeFollower: (cmd) => commandLine("동료 제거", valuePart(cmd.all === true ? "전체" : cmd.name || "이름 없음")),
  setLighting: (cmd) => commandLine(
    "조명 설정",
    valuePart(`${Math.round(cmd.ambient * 100)}%`),
    ...(cmd.transitionMs ? [plainPart(" · "), valuePart(`${cmd.transitionMs}ms`)] : [])
  ),
  addLight: (cmd) => commandLine("빛 켜기", valuePart(lightAnchorSummary(cmd.source.at)), plainPart(" · 크기 "), valuePart(String(cmd.source.radius))),
  removeLight: (cmd) => commandLine("빛 끄기", valuePart(cmd.all === true ? "전부" : cmd.id || "빛 없음")),
  setWeather: (cmd) => commandLine(
    "날씨 설정",
    valuePart(weatherLabel(cmd.weather)),
    plainPart(" "),
    valuePart(`${Math.round((cmd.intensity ?? 0.5) * 100)}%`),
    ...(cmd.transitionMs ? [plainPart(" / "), valuePart(`${cmd.transitionMs}ms`)] : [])
  ),
  showAnimation: (cmd) => commandLine(
    "애니메이션 표시",
    valuePart(animationTargetSummary(cmd.target)),
    plainPart(" / "),
    valuePart(animationName(cmd.animationId)),
    ...(cmd.wait ? [plainPart(" / "), valuePart("대기")] : [])
  ),
  showEmote: (cmd) => commandLine(
    "이모트 표시",
    valuePart(EMOTE_LABELS[cmd.emote]),
    plainPart(" / "),
    valuePart(emoteTargetSummary(cmd.target))
  ),
  showPicture: (cmd) =>
    commandLine(
      "그림 표시",
      valuePart(`위치 (${cmd.x}, ${cmd.y})`),
    ),
  erasePicture: (cmd) => commandLine("그림 지우기", valuePart(pictureSlotCaption(cmd.pictureId))),
  playAudio: (cmd) => commandLine("소리 재생", valuePart(audioName(cmd.resourceId))),
  playMovie: (cmd) => commandLine(
    "동영상 재생",
    valuePart(movieName(cmd.resourceId)),
    ...(cmd.wait ? [plainPart(" / "), valuePart("대기")] : []),
    ...(cmd.skippable ? [plainPart(" / "), valuePart("건너뛰기 허용")] : [])
  ),
  stopAudio: (c) => (c.channel === "bgm" ? commandLine("BGM 페이드아웃", valuePart("배경음만")) : commandLine("소리 정지", valuePart("설정 없음"))),
  cutsceneControl: (cmd) => commandLine("컷신 제어", valuePart(cmd.mode === "begin" ? "시작" : "종료"), ...(cmd.skippable ? [plainPart(" / "), valuePart("스킵 가능")] : [])),
  shop: (cmd) =>
    commandLine(
      "상점",
      valuePart(String(cmd.itemIds.length)),
      plainPart("개"),
      plainPart("·"),
      valuePart(`${cmd.merchantGold ?? 100}G`)
    ),
  inn: (cmd) => {
    const recover = cmd.recoverMp === false ? "HP만" : "전원 회복";
    const extras: ReturnType<typeof plainPart>[] = [];
    if (cmd.advanceToMorning) extras.push(plainPart(" · 아침"));
    if (cmd.branchOnNotEnoughGold) extras.push(plainPart(" · 부족분기"));
    if (typeof cmd.price !== "number") return commandLine("여관", valuePart(`변수 ${(cmd.price as { id: string }).id}`), plainPart(`G · ${recover}`), ...extras);
    if (cmd.price <= 0) {
      return commandLine("여관", valuePart("무료"), plainPart(` · ${recover}`), ...extras);
    }
    return commandLine("여관", valuePart(String(cmd.price)), plainPart(`G · ${recover}`), ...extras);
  },
  checkpointSave: (cmd) => commandLine("체크포인트 저장", valuePart(cmd.label || "세션")),
  runControl: (cmd) => commandLine("탐험", valuePart(runControlSummary(cmd))),
  killPlayer: (cmd) => commandLine("즉사", valuePart(gameOverName(store.getCurrent(), cmd.gameOverId)), valuePart(cmd.message || "")),
  triggerEnding: (cmd) => commandLine("엔딩", valuePart(endingName(cmd.endingId))),
  gameOver: (cmd) => commandLine("게임 오버", valuePart(gameOverName(store.getCurrent(), cmd.gameOverId))),
  ending: (cmd) => commandLine("엔딩", valuePart(cmd.title)),
  returnToTitle: () => [commandPart("타이틀 화면으로")],
  setFlag: (cmd) => commandLine("기억 설정", valuePart(humanizeAuthorId(cmd.flag)), plainPart(" "), onOffBadgePart(cmd.value)),
  setSelfSwitch: (cmd) => commandLine("이 이벤트 기억", valuePart(cmd.key), plainPart(" "), onOffBadgePart(cmd.value)),
  m2Command: m2CommandSummaryParts,
};

function commandLine(label: string, ...parts: readonly CommandSummaryToken[]): readonly CommandSummaryToken[] {
  return [commandPart(label), plainPart(": "), ...parts];
}

// 연산 토큰. += 계열/-=/= 를 서로 다른 톤으로 구분해 리스트에서 증감·대입이 색으로 읽히게 한다.
// 텍스트 자체는 기존과 동일하게 유지한다 (commandSummary 문자열 불변).
function opPart(op: string): CommandSummaryPart {
  if (op === "+=" || op.startsWith("+")) return { text: "더하기", tone: "op-add" };
  if (op === "-=" || op.startsWith("-")) return { text: "빼기", tone: "op-sub" };
  if (op === "*=") return { text: "곱하기", tone: "op-set" };
  if (op === "/=") return { text: "나누기", tone: "op-set" };
  if (op === "=") return { text: "이 값으로", tone: "op-set" };
  return valuePart(op);
}

function advanceTimeSummary(cmd: Extract<Command, { kind: "advanceTime" }>): string {
  const parts: string[] = [];
  if (cmd.days) parts.push(`${cmd.days}일`);
  if (cmd.hours) parts.push(`${cmd.hours}시간`);
  if (cmd.minutes) parts.push(`${cmd.minutes}분`);
  return parts.length > 0 ? parts.join(" ") : "0분";
}

// 스위치/플래그 켜짐/꺼짐 배지.
function onOffBadgePart(value: boolean): CommandSummaryPart {
  return { text: value ? "켜짐" : "꺼짐", tone: value ? "badge-on" : "badge-off" };
}

function switchValueParts(value: SwitchValue): CommandSummaryPart[] {
  if (value === "toggle") return [{ text: "전환", tone: "badge-off" }];
  if (typeof value === "object" && value !== null) {
    return [valuePart(`변수 ${recordName("variable", value.id)}`)];
  }
  return [onOffBadgePart(value)];
}

// 아이콘 토큰 생성. 리소스 id 만 담고 URL 해석은 렌더러(commandList) 몫.
function iconPart(resourceId: string): CommandSummaryIconPart {
  return { kind: "icon", resourceId, text: "", tone: "plain" };
}

// [P1] 얼굴 크롭 썸네일 토큰 (얼굴 그래픽 변경 줄).
function faceVisualPart(resourceId: string): CommandSummaryVisualPart {
  return { kind: "visual", visual: { type: "faceCrop", resourceId }, text: "", tone: "plain" };
}

// [P1] 장소 이동 줄의 목적지 맵 미니 썸네일 토큰.
function mapThumbParts(mapId: string): readonly CommandSummaryVisualPart[] {
  if (!mapId) return [];
  return [{ kind: "visual", visual: { type: "mapThumb", mapId }, text: "", tone: "plain" }];
}

/**
 * 명령이 가리키는 이벤트의 표시 이름. 요약 줄에 `ev_ux_stress` 같은 원시 ID 가 그대로 뜨던 것을
 * 이름으로 바꾼다(2026-09-03 제안서 §6). 빈 ID 는 이 이벤트, 현재 맵에 없으면 다른 맵까지 찾고,
 * 어디에도 없으면 ID 뒤에 «(없음)» 을 붙여 끊어진 참조임을 드러낸다.
 */
export function eventNameForSummary(eventId: string): string {
  if (!eventId) return "이 이벤트";
  const project = store.getCurrent();
  const currentMapId = editorState.get().currentMapId;
  const currentMap = currentMapId ? project.maps[currentMapId] : undefined;
  const local = currentMap?.events.find((event) => event.id === eventId);
  if (local) return eventDisplayName(local);
  for (const map of Object.values(project.maps)) {
    const found = map.events.find((event) => event.id === eventId);
    if (found) return eventDisplayName(found);
  }
  return `${eventId} (없음)`;
}

// [P1] 이동 경로에 그래픽 변경이 포함되면 해당 캐릭터 스프라이트 썸네일 토큰.
function moveRouteSpriteParts(cmd: Extract<Command, { kind: "moveEvent" }>): readonly CommandSummaryVisualPart[] {
  const change = [...cmd.route.moves].reverse().find((move) => move.kind === "changeGraphic");
  if (!change || change.kind !== "changeGraphic" || !change.spriteId) return [];
  return [{ kind: "visual", visual: { type: "charsetSprite", spriteId: change.spriteId }, text: "", tone: "plain" }];
}

// 아이템에 아이콘 리소스가 지정돼 있으면 아이콘 토큰 1개, 없으면 빈 배열.
function itemIconParts(id: string): readonly CommandSummaryIconPart[] {
  const project = store.getCurrent();
  const record = project.database.items.find((item) => item.id === id);
  return record?.iconResourceId ? [iconPart(record.iconResourceId)] : [];
}

// 장비에 아이콘 리소스가 지정돼 있으면 아이콘 토큰 1개, 없으면 빈 배열.
function equipmentIconParts(id: string): readonly CommandSummaryIconPart[] {
  const project = store.getCurrent();
  const record = project.database.equipment.find((equipment) => equipment.id === id);
  return record?.iconResourceId ? [iconPart(record.iconResourceId)] : [];
}

function transferDirectionSummary(direction: "retain" | "up" | "right" | "down" | "left"): string {
  switch (direction) {
    case "retain":
      return "유지";
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

function lightAnchorSummary(anchor: Extract<Command, { kind: "addLight" }>["source"]["at"]): string {
  if (anchor === "player") return "주인공";
  if ("eventId" in anchor) return `이벤트 ${anchor.eventId}`;
  return `(${anchor.x},${anchor.y})`;
}

function animationTargetSummary(target: Extract<Command, { kind: "showAnimation" }>["target"]): string {
  if (target === "player") return "주인공";
  if ("eventId" in target) return `이벤트 ${target.eventId || "현재"}`;
  return `(${target.x},${target.y})`;
}

function emoteTargetSummary(target: Extract<Command, { kind: "showEmote" }>["target"]): string {
  if (target === "player") return "주인공";
  return target.eventId ? `이벤트 ${target.eventId}` : "이 이벤트";
}

function weatherLabel(kind: Extract<Command, { kind: "setWeather" }>["weather"]): string {
  switch (kind) {
    case "none": return "없음";
    case "rain": return "비";
    case "storm": return "폭풍";
    case "snow": return "눈";
    case "fog": return "안개";
  }
}

function tileLayerSummary(layer: "lower" | "upper"): string {
  return layer === "upper" ? "상위" : "바닥";
}

function tileValueCaption(tile: number): string {
  if (tile < 0) return "비움";
  if (tile === 0) return "빈 바닥";
  if (tile === 1) return "기본 바닥";
  return `그림 ${tile}`;
}

function commandPart(text: string): CommandSummaryPart {
  return { text, tone: "command" };
}



function changeStateSummaryParts(cmd: Extract<Command, { kind: "m2Command" }>): readonly CommandSummaryPart[] {
  const project = store.getCurrent();
  const targetRaw = String(cmd.fields.target ?? "").trim();
  const target =
    !targetRaw || targetRaw === "party" || targetRaw === "all"
      ? "파티 전체"
      : project.database.actors.find((actor) => actor.id === targetRaw)?.name ?? targetRaw;
  const operation = String(cmd.fields.operation ?? "add");
  const opLabel = operation === "remove" ? "해제" : "부여";
  const stateId = String(cmd.fields.value ?? "").trim();
  const stateName = stateId
    ? project.database.states.find((state) => state.id === stateId)?.name ?? stateId
    : "(상태 선택)";
  return commandLine("상태 변경", valuePart(target), plainPart(" · "), valuePart(stateName), plainPart(" "), valuePart(opLabel));
}

function changeParametersSummaryParts(cmd: Extract<Command, { kind: "m2Command" }>): readonly CommandSummaryPart[] {
  const project = store.getCurrent();
  const targetRaw = String(cmd.fields.target ?? "").trim();
  const target =
    !targetRaw || targetRaw === "party" || targetRaw === "all"
      ? "파티 전체"
      : project.database.actors.find((actor) => actor.id === targetRaw)?.name ?? targetRaw;
  const parameter = String(cmd.fields.parameter ?? "maxHp");
  const parameterLabel =
    ({
      maxHp: "최대 HP",
      maxMp: "최대 MP",
      attack: "공격",
      defense: "방어",
      mind: "정신",
      spirit: "정신",
      agility: "민첩",
    } as Record<string, string>)[parameter] ?? parameter;
  const operation = String(cmd.fields.operation ?? "add");
  const opLabel = operation === "remove" ? "−" : operation === "set" ? "＝" : "＋";
  const valueLabel = m2NumericValueLabel(cmd);
  return commandLine("능력치 변경", valuePart(target), plainPart(" "), valuePart(parameterLabel), plainPart(" "), valuePart(`${opLabel}${valueLabel}`));
}

function damageProcessingSummaryParts(cmd: Extract<Command, { kind: "m2Command" }>): readonly CommandSummaryPart[] {
  const project = store.getCurrent();
  const targetRaw = String(cmd.fields.target ?? "").trim();
  const target =
    !targetRaw || targetRaw === "party" || targetRaw === "all"
      ? "파티 전체"
      : project.database.actors.find((actor) => actor.id === targetRaw)?.name ?? targetRaw;
  const operation = String(cmd.fields.operation ?? "add");
  const opLabel = operation === "remove" ? "회복" : "데미지";
  return commandLine("데미지", valuePart(target), plainPart(" · "), valuePart(opLabel), plainPart(" "), valuePart(m2NumericValueLabel(cmd)));
}

function changeActorIdentitySummaryParts(
  cmd: Extract<Command, { kind: "m2Command" }>,
  label: string
): readonly CommandSummaryPart[] {
  const project = store.getCurrent();
  const targetRaw = String(cmd.fields.target ?? "").trim();
  const actorName = targetRaw
    ? project.database.actors.find((actor) => actor.id === targetRaw)?.name ?? targetRaw
    : "(주인공 선택)";
  const value = String(cmd.fields.value ?? "").trim() || "(값 없음)";
  return commandLine(label, valuePart(actorName), plainPart(" · "), valuePart(value));
}

/**
 * OPRN-OUT-013: 제네릭 폴백 요약은 `누구에게 this-event, X 값은 숫자, X 0` 처럼 처음 세
 * 필드만 내몰아 새 소스 키가 정작 목적지를 가린다. 목적지가 이 명령의 전부다.
 */
function coordinateMoveSummaryParts(
  cmd: Extract<Command, { kind: "m2Command" }>,
  label: string,
): readonly CommandSummaryPart[] {
  const target = String(cmd.fields.target ?? "this-event").trim();
  const who = target === PLAYER_MOVE_TARGET || target === "player" ? "주인공"
    : !target || target === "this-event" || target === "this" ? "이 이벤트"
      : target;
  const axis = (key: "x" | "y"): string => {
    const spec = coordinateAxisSpec(cmd.fields, key);
    if (spec.source === "fixed") return String(spec.fixedValue);
    return spec.variableId ? `변수 ${recordName("variable", spec.variableId)}` : "변수 (미선택)";
  };
  const wait = cmd.fields.wait === false ? "" : " · 대기";
  const failure = coordinateFailurePolicy(cmd.fields) === "stop" ? " · 실패시 중단" : "";
  return commandLine(
    label,
    valuePart(who),
    plainPart(" → "),
    valuePart(`(${axis("x")}, ${axis("y")})`),
    plainPart(`${wait}${failure}`),
  );
}

function weightedBranchSummaryParts(
  cmd: Extract<Command, { kind: "m2Command" }>,
): readonly CommandSummaryPart[] {
  const table = String(cmd.fields.table ?? "");
  const resultVariableId = String(cmd.fields.resultVariableId ?? "").trim();
  const variableName = resultVariableId ? recordName("variable", resultVariableId) : undefined;
  const summary = formatWeightedBranchSummary(table, resultVariableId, variableName);
  return commandLine("가중 분기", valuePart(summary));
}

function m2NumericValueLabel(cmd: Extract<Command, { kind: "m2Command" }>): string {
  if (String(cmd.fields.valueSource ?? "") === "variable" || String(cmd.fields.valueVariableId ?? "").trim()) {
    const variableId = String(cmd.fields.valueVariableId ?? "").trim();
    return variableId ? `변수 ${recordName("variable", variableId)}` : "변수 (미선택)";
  }
  return String(cmd.fields.value ?? 0);
}

function plainPart(text: string): CommandSummaryPart {
  return { text, tone: "plain" };
}

function textPart(text: string): CommandSummaryPart {
  return { text, tone: "plain" };
}

function valuePart(text: string): CommandSummaryPart {
  return { text, tone: "value" };
}

function m2CommandSummaryParts(cmd: Extract<Command, { kind: "m2Command" }>): readonly CommandSummaryPart[] {
  const entry = m2CommandById(cmd.commandId);
  const title = entry?.title ?? "";
  if (title === "Comment" || cmd.commandId === "m2-088-comment") {
    const text = String(cmd.fields.comment ?? "").trim() || "(빈 주석)";
    return commandLine("주석", valuePart(oneLine(text)));
  }
  if (title === "Erase Event" || cmd.commandId === "m2-086-erase-event") {
    const eventId = String(cmd.fields.eventId ?? "").trim();
    return commandLine(
      "이벤트 지우기",
      valuePart(eventId ? eventId : "이 이벤트"),
    );
  }
  if (title === "Change Parameters" || cmd.commandId === "m2-014-change-parameters") {
    return changeParametersSummaryParts(cmd);
  }
  if (title === "Change State" || cmd.commandId === "m2-019-change-state") {
    return changeStateSummaryParts(cmd);
  }
  if (title === "Damage Processing" || cmd.commandId === "m2-021-damage-processing") {
    return damageProcessingSummaryParts(cmd);
  }
  if (title === "Change Actor Name" || cmd.commandId === "m2-022-change-actor-name") {
    return changeActorIdentitySummaryParts(cmd, "주인공 이름 변경");
  }
  if (title === "Change Actor Nickname" || cmd.commandId === "m2-023-change-actor-nickname") {
    return changeActorIdentitySummaryParts(cmd, "주인공 별명 변경");
  }
  if (title === "Change Actor Graphic" || cmd.commandId === "m2-024-change-actor-graphic") {
    return changeActorIdentitySummaryParts(cmd, "주인공 모습 변경");
  }
  if (title === "Change Actor Faceset" || cmd.commandId === "m2-025-change-actor-faceset") {
    return changeActorIdentitySummaryParts(cmd, "주인공 얼굴 변경");
  }
  if (title === "Change Actor Class" || cmd.commandId === "m2-091-change-actor-class") {
    return changeActorIdentitySummaryParts(cmd, "주인공 직업 변경");
  }
  if (title === "Weighted Branch" || cmd.commandId === "m2-211-weighted-branch") {
    return weightedBranchSummaryParts(cmd);
  }
  if (title === "Pathfind Move" || cmd.commandId === "m2-205-pathfind-move") {
    return coordinateMoveSummaryParts(cmd, entry?.label ?? "좌표로 이동");
  }

  const page3 = page3M2SummaryParts(cmd, title, entry?.label);
  if (page3) return page3;

  const label = entry?.label ?? cmd.commandId;
  const fields = Object.entries(cmd.fields)
    .filter(([key, value]) => key !== "color" && key !== "valueSource" && key !== "valueVariableId" && String(value).length > 0)
    .slice(0, 3)
    .map(([key, value]) => m2FieldSummaryText(entry?.fields ?? [], key, value));
  if (fields.length === 0) return [commandPart(label)];
  return commandLine(label, valuePart(fields.join(", ")));
}

/**
 * 폴백 요약은 `effect: fadeIn, durationMs: 300` 처럼 내부 키와 영문 값을 그대로 노출했다.
 * 같은 값의 사람용 라벨(카탈로그의 option.label / spec.label)이 이미 있으니 그것을 쓴다.
 */
function m2FieldSummaryText(
  specs: readonly M2CommandFieldSpec[],
  key: string,
  value: unknown
): string {
  const raw = String(value);
  const spec = specs.find((entry) => entry.key === key);
  if (!spec) return `${key}: ${raw}`;
  const option = spec.options?.find((choice) => choice.value === raw);
  if (option) return option.label;
  // 단위가 라벨에 이미 들어 있는 숫자 필드(···(ms))는 값 뒤에 단위를 붙인다.
  const unit = spec.type === "number" ? spec.label.match(/\(([^)]+)\)/u)?.[1] : undefined;
  if (unit) return `${raw}${unit}`;
  return `${spec.label} ${raw}`;
}

function page3M2SummaryParts(
  cmd: Extract<Command, { kind: "m2Command" }>,
  title: string,
  fallbackLabel: string | undefined
): readonly CommandSummaryPart[] | null {
  const f = cmd.fields;
  const str = (key: string): string => String(f[key] ?? "").trim();
  const num = (key: string): string => {
    const raw = f[key];
    return typeof raw === "number" ? String(raw) : String(raw ?? "").trim();
  };
  const labelOf = (ko: string) => ko || fallbackLabel || title;

  switch (title) {
    case "Get Player Location": {
      const variableId = str("variableId") || str("target");
      return commandLine(
        labelOf("주인공 위치 얻기"),
        plainPart("→ "),
        valuePart(variableId ? `변수 ${variableId}` : "(변수 미지정)")
      );
    }
    case "Move to Variable Location": {
      const mapId = str("mapVariableId") || str("mapId");
      const x = str("xVariableId") || str("x") || str("variableX") || "?";
      const y = str("yVariableId") || str("y") || str("variableY") || "?";
      return commandLine(
        labelOf("변수 위치로 이동"),
        valuePart(mapId ? mapName(mapId) : "(맵)"),
        plainPart(" · 변수 좌표 ("),
        valuePart(`${x}, ${y}`),
        plainPart(")")
      );
    }
    case "Get On/Off Vehicle": {
      const target = str("vehicle") || str("target") || "탈것";
      const enabled = str("boarded") || str("enabled");
      const action =
        enabled === "false" || enabled === "0" ? "하차" : enabled === "true" || enabled === "1" ? "승차" : "승하차";
      return commandLine(labelOf("탈것 승하차"), valuePart(target), plainPart(" · "), valuePart(action));
    }
    case "Set Vehicle Location": {
      const vehicle = str("vehicle") || str("target") || "탈것";
      const mapId = str("mapId");
      return commandLine(
        labelOf("탈것 위치 설정"),
        valuePart(vehicle),
        plainPart(" → "),
        valuePart(mapId ? mapName(mapId) : "(맵)"),
        plainPart(" ("),
        valuePart(`${num("x") || "0"}, ${num("y") || "0"}`),
        plainPart(")")
      );
    }
    case "Set Event Location": {
      const target = str("target") || str("eventId") || "이 이벤트";
      const mapId = str("mapId");
      return commandLine(
        labelOf("이벤트 위치 설정"),
        valuePart(target),
        plainPart(" → "),
        ...(mapId ? [valuePart(mapName(mapId)), plainPart(" ")] : []),
        plainPart("("),
        valuePart(`${num("x") || "0"}, ${num("y") || "0"}`),
        plainPart(")")
      );
    }
    case "Swap Event Location": {
      const a = str("eventA") || str("target") || str("eventId") || "이벤트 A";
      const b = str("eventB") || str("value") || str("mapId") || str("target2") || str("eventId2") || str("with") || "이벤트 B";
      return commandLine(labelOf("이벤트 위치 교환"), valuePart(a), plainPart(" ↔ "), valuePart(b));
    }
    case "Get Terrain ID": {
      const variableId = str("variableId");
      return commandLine(
        labelOf("어느 지형인지 알기"),
        plainPart("("),
        valuePart(`${num("x") || "?"}, ${num("y") || "?"}`),
        plainPart(") → "),
        valuePart(variableId ? `변수 ${variableId}` : "(변수 미지정)")
      );
    }
    case "Get Event ID": {
      const variableId = str("variableId");
      return commandLine(
        labelOf("어느 이벤트인지 알기"),
        plainPart("("),
        valuePart(`${num("x") || "?"}, ${num("y") || "?"}`),
        plainPart(") → "),
        valuePart(variableId ? `변수 ${variableId}` : "(변수 미지정)")
      );
    }
    case "Hide Screen":
      return commandLine(labelOf("화면 숨기기"), valuePart(str("value") || str("transition") || "페이드 아웃"));
    case "Show Screen":
      return commandLine(labelOf("화면 표시"), valuePart(str("value") || str("transition") || "페이드 인"));
    case "Tint Screen": {
      const color = str("value") || str("color") || "기본";
      const duration = tintDurationMs(cmd.fields);
      return commandLine(
        labelOf("화면 색조 변경"),
        valuePart(color),
        plainPart(" · "), valuePart(duration > 0 ? `${duration}ms` : "즉시 전환")
      );
    }
    case "Flash Screen": {
      const color = str("color") || str("value") || "white";
      const duration = str("durationMs") || str("duration") || "300";
      return commandLine(
        labelOf("화면 플래시"),
        valuePart(m2ScreenColorLabel(color)),
        plainPart(" · "),
        valuePart(`${duration}ms`)
      );
    }
    case "Shake Screen": {
      const intensity = str("intensity") || str("value") || "3";
      const duration = str("durationMs") || str("duration") || "400";
      return commandLine(
        labelOf("화면 흔들기"),
        plainPart("강도 "),
        valuePart(intensity),
        plainPart(" · "),
        valuePart(`${duration}ms`)
      );
    }
    case "Scroll Map": {
      const direction = m2ScrollDirectionLabel(str("direction") || str("target") || "down");
      const distance = str("distance") || str("value") || "1";
      const mode = str("mode");
      const modeLabel =
        mode === "lock" ? "고정" : mode === "pan" ? "패닝" : mode === "return" ? "복귀" : "";
      return commandLine(
        labelOf("맵 스크롤"),
        valuePart(direction),
        plainPart(" "),
        valuePart(distance),
        plainPart("타일"),
        ...(modeLabel ? [plainPart(" · "), valuePart(modeLabel)] : [])
      );
    }
    case "Set Weather Effects": {
      const weather = m2WeatherValueLabel(str("value") || str("weather") || "none");
      const intensity = str("intensity");
      const transition = str("transitionMs") || str("durationMs") || str("duration");
      return commandLine(
        labelOf("날씨 효과 설정"),
        valuePart(weather),
        ...(intensity ? [plainPart(" · 강도 "), valuePart(intensity)] : []),
        ...(transition ? [plainPart(" · "), valuePart(`${transition}ms`)] : [])
      );
    }
    case "Show Picture": {
      const pictureId = str("pictureId");
      const resourceId = str("resourceId");
      return commandLine(
        labelOf("그림 표시"),
        valuePart(pictureSlotCaption(pictureId)),
        plainPart(" ("),
        valuePart(`${num("x") || "0"}, ${num("y") || "0"}`),
        plainPart(")"),
        ...(resourceId ? [plainPart(" · "), valuePart(resourceId)] : [])
      );
    }
    case "Move Picture": {
      const pictureId = str("pictureId");
      const duration = str("durationMs") || str("duration");
      return commandLine(
        labelOf("그림 이동"),
        valuePart(pictureSlotCaption(pictureId)),
        plainPart(" → ("),
        valuePart(`${num("x") || "0"}, ${num("y") || "0"}`),
        plainPart(")"),
        ...(duration ? [plainPart(" · "), valuePart(`${Math.round(Number(duration) / 100) / 10}초`)] : [])
      );
    }
    case "Erase Picture":
      return commandLine(labelOf("그림 지우기"), valuePart(pictureSlotCaption(str("pictureId"))));
    case "Show Animation": {
      const target = str("target") || "대상";
      const anim = str("animationId") || str("value") || "(애니메이션)";
      return commandLine(
        labelOf("애니메이션 표시"),
        valuePart(target),
        plainPart(" · "),
        valuePart(anim)
      );
    }
    case "Flash Event": {
      const target = str("target") || str("eventId") || "이 이벤트";
      const color = str("color") || str("value");
      return commandLine(
        labelOf("이벤트 플래시"),
        valuePart(target),
        ...(color ? [plainPart(" · "), valuePart(m2ScreenColorLabel(color))] : [])
      );
    }
    case "Stop All Movement":
      return [commandPart(labelOf("모든 이동 중지"))];
    case "Key Input Processing": {
      const variableId = str("variableId") || str("target");
      return commandLine(
        labelOf("키 입력"),
        valuePart(variableId ? `변수 ${variableId}` : "키 대기")
      );
    }
    case "Change Tileset": {
      const tileset = str("value") || str("tilesetId") || str("target") || "(그림 세트)";
      return commandLine(labelOf("맵 그림 세트"), valuePart(tileset));
    }
    case "Change Parallax Back": {
      const resource = str("value") || str("resourceId") || str("target") || "(먼 배경)";
      return commandLine(labelOf("먼 배경 변경"), valuePart(resource));
    }
    case "Set Encounter Rate": {
      const rate = str("value") || str("rate") || str("target") || "0";
      return commandLine(labelOf("랜덤 전투 빈도"), valuePart(rate));
    }
    case "Change Tile": {
      const mapId = str("mapId");
      const layer = str("layer") === "upper" ? "상위" : "바닥";
      const tileNo = Number(str("tile") || str("value") || "0");
      return commandLine(
        labelOf("지형 변경"),
        valuePart(mapId ? mapName(mapId) : "(맵)"),
        plainPart(" "),
        valuePart(layer),
        plainPart(" ("),
        valuePart(`${num("x") || "0"}, ${num("y") || "0"}`),
        plainPart(") → "),
        valuePart(Number.isFinite(tileNo) ? tileValueCaption(tileNo) : "빈 바닥")
      );
    }
    default:
      return null;
  }
}

function m2ScreenColorLabel(color: string): string {
  const key = color.toLowerCase();
  const map: Record<string, string> = {
    white: "흰색",
    red: "빨강",
    green: "초록",
    blue: "파랑",
    black: "검정",
    yellow: "노랑",
    cyan: "청록",
    magenta: "자홍",
    neutral: "기본",
  };
  return map[key] ?? color;
}

function m2ScrollDirectionLabel(direction: string): string {
  switch (direction) {
    case "up":
      return "위";
    case "down":
      return "아래";
    case "left":
      return "왼쪽";
    case "right":
      return "오른쪽";
    default:
      return direction || "아래";
  }
}

function m2WeatherValueLabel(value: string): string {
  const raw = value.toLowerCase();
  if (raw.startsWith("rain")) return "비";
  if (raw.startsWith("storm")) return "폭풍";
  if (raw.startsWith("snow")) return "눈";
  if (raw.startsWith("fog")) return "안개";
  if (raw === "none" || raw === "" || raw === "clear") return "맑음";
  // "rain,0.5" style runtime strings
  const head = raw.split(",")[0]?.trim() ?? raw;
  if (head === "rain") return "비";
  if (head === "storm") return "폭풍";
  if (head === "snow") return "눈";
  if (head === "fog") return "안개";
  if (head === "none") return "맑음";
  return value || "맑음";
}


function choicesSummaryParts(cmd: Extract<Command, { kind: "choices" }>): readonly CommandSummaryToken[] {
  const parts: CommandSummaryToken[] = [commandPart("선택지 표시"), plainPart(": ")];
  const prompt = oneLine(cmd.prompt ?? "");
  if (prompt) {
    parts.push(valuePart(prompt), plainPart("  "));
  }
  const options = cmd.options;
  if (options.length === 0) {
    parts.push(valuePart("(선택지 없음)"));
  } else {
    options.forEach((option, index) => {
      if (index > 0) parts.push(plainPart(" "));
      const label = oneLine(option.text) || `선택지 ${index + 1}`;
      parts.push(choiceOptionPart(`${index + 1}.${label}`));
    });
  }
  parts.push(plainPart("  "), choiceCancelPart(choiceCancelSummary(cmd)));
  return parts;
}

function choiceOptionPart(text: string): CommandSummaryPart {
  return { text, tone: "choice-option" };
}

function choiceCancelPart(text: string): CommandSummaryPart {
  return { text, tone: "choice-cancel" };
}

/** 취소 동작 요약. choiceN 이면 해당 옵션 본문을 보여 "잠시 후" 같은 선택지와 구분한다. */
function choiceCancelSummary(cmd: Extract<Command, { kind: "choices" }>): string {
  const behavior = cmd.cancelBehavior ?? "disallow";
  if (behavior === "disallow") return "취소 없음";
  if (behavior === "branch") return "취소→따로 처리";
  const index = Number.parseInt(behavior.slice("choice".length), 10);
  if (!Number.isFinite(index) || index < 1) return "취소";
  const option = cmd.options[index - 1];
  const label = oneLine(option?.text ?? "") || `선택지 ${index}`;
  return `취소→${label}`;
}

function facePositionLabel(position: Extract<Command, { kind: "changeFace" }>["position"]): string {
  return position === "right" ? "오른쪽" : "왼쪽";
}

function oneLine(value: string): string {
  const t = value.replace(/\s+/g, " ").trim();
  if (t.length <= 80) return t;
  return `${t.slice(0, 78).trimEnd()}…`;
}

function messageWindowFormatLabel(format: Extract<Command, { kind: "displayTextSettings" }>["format"]): string {
  return format === "transparent" ? "투명" : "일반";
}

function messageWindowPositionLabel(position: Extract<Command, { kind: "displayTextSettings" }>["position"]): string {
  switch (position) {
    case "top":
      return "상단";
    case "center":
      return "중앙";
    case "bottom":
      return "하단";
  }
}

function operandSummary(value: VariableOperand): string {
  return typeof value === "number" ? String(value) : `변수 ${recordName("variable", value.id)}`;
}

function conditionSummary(condition: Extract<Command, { kind: "fork" }>['condition']): string {
  switch (condition.kind) {
    case "switch":
      return `${recordName("switch", condition.switchId)} ${condition.value ? "켜짐" : "꺼짐"}`;
    case "variable":
      return `${recordName("variable", condition.variableId)} ${compareAmountLabel(condition.op, condition.value)}`;
    case "selfSwitch":
      return `이 이벤트 기억 ${condition.key} ${condition.value ? "켜짐" : "꺼짐"}`;
    case "actor":
      return `${actorName(condition.actorId)} ${condition.present ? "파티에 있음" : "파티에 없음"}`;
    case "item":
      return `${itemName(condition.itemId)} ${condition.present ? "보유 중" : "보유 안 함"}`;
    case "gold":
      return `소지금 ${compareAmountLabel(condition.op, condition.amount)}`;
    case "timer":
      return `${timerIdLabel(condition.timerId)} ${condition.seconds}초 이하`;
    case "timePhase":
      return `시간대 ${timePhaseLabel(condition.phase)}`;
    case "season":
      return `계절 ${seasonLabel(condition.season)}`;
    case "npcActivity":
      return `활동 ${condition.activity}`;
    case "insideLocation":
      return insideLocationSentence(condition.locationId, condition.inside);
    case "friendshipAtLeast":
      return `호감도 ${condition.npcKey || "이 이벤트"} ${condition.value} 이상`;
    case "relationshipAtLeast":
      return `관계 ${condition.npcKey || "이 이벤트"} ${relationshipStateName(condition.state)} 이상`;
    case "battleResult":
      return `전투 ${condition.result === "victory" ? "승리" : condition.result === "defeat" ? "패배" : "도망"}`;
    case "run":
      return runConditionSummary(condition);
    case "all":
      return condition.conditions.length
        ? `모두 맞을 때(${condition.conditions.map((child) => conditionSummary(child)).join(", ")})`
        : "모두 맞을 때(없음)";
    case "any":
      return condition.conditions.length
        ? `하나라도 맞을 때(${condition.conditions.map((child) => conditionSummary(child)).join(", ")})`
        : "하나라도 맞을 때(없음)";
    case "not":
      return `아닐 때(${conditionSummary(condition.condition)})`;
  }
}

function runControlSummary(command: Extract<Command, { kind: "runControl" }>): string {
  switch (command.action) {
    case "start":
      return `시작 · ${command.seed ?? "자동 난수"} · ${command.startFloor ?? 1}층`;
    case "advance":
      return `다음 층 +${command.amount ?? 1}`;
    case "end":
      return `종료 · ${command.result}`;
    case "setFlag":
      return `${command.flag || "기억"} ${command.value ? "켜짐" : "꺼짐"}`;
    case "resetRoom":
      return `방 초기화 · ${command.roomId || "현재 방"}`;
  }
}

function runConditionSummary(condition: Extract<Extract<Command, { kind: "fork" }>["condition"], { kind: "run" }>): string {
  switch (condition.query) {
    case "active":
      return condition.value === false ? "탐험 중이 아님" : "탐험 중";
    case "floor":
      return `탐험 층 ${compareAmountLabel(condition.op, condition.value)}`;
    case "flag":
      return `탐험 기억 ${condition.flag || "기억"} ${condition.value ? "켜짐" : "꺼짐"}`;
    case "result":
      return `탐험 결과 ${runResultLabel(condition.result)}`;
  }
}

function mapName(id: string): string {
  const project = store.getCurrent();
  return id ? project.maps[id]?.name ?? id : "(맵 선택)";
}

function commonEventName(id: string): string {
  const project = store.getCurrent();
  if (!id) return "(이벤트 선택)";
  const named = project.commonEvents.find((event) => event.id === id)?.name.trim();
  return named || "이름 없는 이벤트";
}

function mapEventName(id: string): string {
  if (!id) return "(이벤트 선택)";
  const project = store.getCurrent();
  for (const map of Object.values(project.maps)) {
    const event = map.events.find((entry) => entry.id === id);
    if (event) return event.id;
  }
  return "이름 없는 이벤트";
}

function troopName(id: string): string {
  const project = store.getCurrent();
  return id ? project.database.troops.find((troop) => troop.id === id)?.name ?? id : "(적 그룹 선택)";
}

function actorName(id: string): string {
  const project = store.getCurrent();
  return id ? project.database.actors.find((actor) => actor.id === id)?.name ?? id : "(주인공 선택)";
}

function skillName(id: string): string {
  const project = store.getCurrent();
  return id ? project.database.skills.find((skill) => skill.id === id)?.name ?? id : "(스킬 선택)";
}

function timerActionLabel(action: string): string {
  if (action === "set") return "설정";
  if (action === "start") return "시작";
  if (action === "stop") return "정지";
  return action;
}


function recipeName(id: string): string {
  if (!id) return "(레시피 선택)";
  const recipe = store.getCurrent().system.craftRecipes?.find((entry) => entry.id === id);
  if (!recipe) return "이름 없는 레시피";
  return recipe.name?.trim() || itemName(recipe.outputItemId);
}

function upgradeName(id: string): string {
  if (!id) return "(업그레이드 선택)";
  const rule = store.getCurrent().system.itemUpgrades?.find((entry) => entry.id === id);
  if (!rule) return "이름 없는 업그레이드";
  return `${itemName(rule.fromItemId)} → ${itemName(rule.toItemId)}`;
}

function resultVariableSummaryParts(resultVariableId: string | undefined): readonly CommandSummaryToken[] {
  // Keep the authored id exact — display lookup may fall back to the id itself.
  if (resultVariableId === undefined || resultVariableId === "") return [];
  return [plainPart(" → "), valuePart(recordName("variable", resultVariableId))];
}

function monsterInstanceLabel(id: string): string {
  return id ? "몬스터" : "(몬스터 선택)";
}

function humanizeAuthorId(id: string): string {
  const trimmed = id.trim();
  if (!trimmed) return "(없음)";
  return trimmed.replace(/^item_/, "").replace(/^(bgm|se|cc0-bgm)-/, "").replace(/_/g, " ");
}

function audioName(id: string): string {
  const trimmed = id.trim();
  if (!trimmed) return "(선택 없음)";
  const track = BGM_CATALOG.find((entry) => entry.id === trimmed);
  if (track) return track.title;
  return humanizeAuthorId(trimmed);
}

function itemName(id: string): string {
  const project = store.getCurrent();
  if (!id) return "(아이템 선택)";
  const named = project.database.items.find((item) => item.id === id)?.name.trim();
  if (named && /[가-힣]/.test(named)) return named;
  return humanizeAuthorId(named || id);
}

function monsterSpeciesName(id: string): string {
  const project = store.getCurrent();
  return id ? (project.database.monsterSpecies ?? []).find((species) => species.id === id)?.name ?? id : "(몬스터 선택)";
}

function equipmentName(id: string): string {
  const project = store.getCurrent();
  return id ? project.database.equipment.find((equipment) => equipment.id === id)?.name ?? id : "(장비 해제)";
}

function className(id: string): string {
  const project = store.getCurrent();
  return project.database.classes.find((record) => record.id === id)?.name ?? id;
}

function equipmentSlotLabel(slot: Extract<Command, { kind: "changeEquipment" }>["slot"]): string {
  return catalogSlotLabel(store.getCurrent(), slot);
}

function formatActorVitalAmount(amount: number, amountMode?: "flat" | "percent"): string {
  return amountMode === "percent" ? `${Math.trunc(amount)}%` : String(amount);
}

function recordName(kind: "switch" | "variable", id: string): string {
  const project = store.getCurrent();
  const collection = kind === "switch" ? project.switches : project.variables;
  const index = collection.findIndex((record) => record.id === id);
  if (index >= 0) {
    const named = collection[index]?.name.trim();
    return named || "(이름 없음)";
  }
  return id ? id : kind === "switch" ? "스위치 선택" : "변수 선택";
}

function endingName(id: string | undefined): string {
  const trimmed = id?.trim() ?? "";
  if (!trimmed) return "자동 선택";
  const named = store.getCurrent().endings?.find((entry) => entry.id === trimmed)?.name.trim();
  return named || humanizeAuthorId(trimmed);
}

function animationName(id: string | undefined): string {
  const trimmed = id?.trim() ?? "";
  if (!trimmed) return "(연출 선택)";
  const named = store.getCurrent().database.battleAnimations.find((entry) => entry.id === trimmed)?.name.trim();
  return named || humanizeAuthorId(trimmed);
}

// 동영상은 아직 리소스 목록(ResourceKind)에 없어 id 를 사람이 읽는 모양으로만 다듬는다.
function movieName(id: string | undefined): string {
  const trimmed = id?.trim() ?? "";
  if (!trimmed) return "(동영상 선택)";
  return humanizeAuthorId(trimmed);
}

function faceSheetLabel(id: string | undefined): string {
  const trimmed = id?.trim() ?? "";
  if (!trimmed) return "얼굴 없음";
  const slug = trimmed
    .replace(/^easyrpg-faceset-/, "")
    .replace(/^generated-face-/, "")
    .replace(/-bust$/, "")
    .replace(/[-_]+/g, " ");
  const numbered = /^(actor|monster|object|people)\s*(\d+)$/i.exec(slug);
  if (numbered) {
    const kind = { actor: "배역", monster: "몬스터", object: "물건", people: "사람" }[numbered[1]!.toLowerCase()] ?? numbered[1]!;
    return `${kind} ${numbered[2]}`;
  }
  return slug;
}

function textEmotionLabel(emotion: string): string {
  switch (emotion) {
    case "happy":
      return "기쁨";
    case "sad":
      return "슬픔";
    case "angry":
      return "분노";
    case "surprised":
      return "놀람";
    default:
      return emotion;
  }
}
