import type { Command, Condition, EventAnimationType, EventPage, Trigger } from "@/project/types";

export type SelectOption<T extends string> = {
  readonly value: T;
  readonly label: string;
};
export type EventEditorTriggerKind = Exclude<Trigger["kind"], "touch">;

export type PageCommandButton = {
  readonly kind: Command["kind"];
  readonly testId: string;
  readonly label: string;
};

export const TRIGGER_OPTIONS = [
  { value: "action", label: "결정키로 시작" },
  { value: "playerTouch", label: "플레이어가 접촉" },
  { value: "eventTouch", label: "이벤트가 접촉" },
  { value: "auto", label: "자동 실행" },
  { value: "parallel", label: "병렬 처리" },
] as const satisfies readonly SelectOption<EventEditorTriggerKind>[];

export const COMMAND_KIND_OPTIONS = [
  { value: "text", label: "문장 표시" },
  { value: "displayTextSettings", label: "문장 표시 설정" },
  { value: "changeFace", label: "얼굴 그래픽 변경" },
  { value: "choices", label: "선택지 표시" },
  { value: "fork", label: "조건 분기" },
  { value: "setSwitch", label: "스위치 조작" },
  { value: "setVariable", label: "변수 조작" },
  { value: "timer", label: "타이머 조작" },
  { value: "inputNumber", label: "숫자 입력" },
  { value: "inputWait", label: "키 입력 대기" },
  { value: "label", label: "라벨" },
  { value: "gotoLabel", label: "라벨 이동" },
  { value: "loop", label: "반복" },
  { value: "breakLoop", label: "반복 탈출" },
  { value: "transfer", label: "장소 이동" },
  { value: "moveEvent", label: "이벤트 이동" },
  { value: "setEventGraphicPattern", label: "이벤트 프레임 변경" },
  { value: "changeTile", label: "지형 변경" },
  { value: "callCommonEvent", label: "공통 이벤트 호출" },
  { value: "callMapEvent", label: "맵 이벤트 호출" },
  { value: "battleProcessing", label: "전투 처리" },
  { value: "learnSkill", label: "특수기 습득" },
  { value: "changeExp", label: "경험치 변경" },
  { value: "changeLevel", label: "레벨 변경" },
  { value: "promoteActor", label: "승급" },
  { value: "changeEquipment", label: "장비 변경" },
  { value: "changeActorHp", label: "HP 변경" },
  { value: "changeActorMp", label: "MP 변경" },
  { value: "recoverAll", label: "모두 회복" },
  { value: "enterHeroName", label: "이름 입력 처리" },
  { value: "changeGold", label: "소지금 변경" },
  { value: "changeItem", label: "아이템 변경" },
  { value: "changeParty", label: "파티 변경" },
  { value: "giveMonster", label: "몬스터 지급" },
  { value: "moveMonster", label: "몬스터 이동" },
  { value: "evolveMonster", label: "몬스터 진화" },
  { value: "addFollower", label: "동행자 추가" },
  { value: "removeFollower", label: "동행자 제거" },
  { value: "setLighting", label: "조명 설정" },
  { value: "addLight", label: "광원 추가" },
  { value: "removeLight", label: "광원 제거" },
  { value: "setWeather", label: "날씨 설정" },
  { value: "showAnimation", label: "애니메이션 표시" },
  { value: "showPicture", label: "그림 표시" },
  { value: "erasePicture", label: "그림 삭제" },
  { value: "playAudio", label: "소리 재생" },
  { value: "stopAudio", label: "소리 정지" },
  { value: "cutsceneControl", label: "컷신 제어" },
  { value: "shop", label: "상점 처리" },
  { value: "inn", label: "여관 처리" },
  { value: "checkpointSave", label: "체크포인트 저장" },
  { value: "killPlayer", label: "즉사" },
  { value: "triggerEnding", label: "엔딩 트리거" },
  { value: "gameOver", label: "게임 오버" },
  { value: "ending", label: "엔딩" },
  { value: "returnToTitle", label: "타이틀로 돌아가기" },
  { value: "wait", label: "대기" },
  { value: "setFlag", label: "플래그 설정" },
  { value: "setSelfSwitch", label: "셀프 스위치 설정" },
  { value: "m2Command", label: "M2/현대 명령" },
] as const satisfies readonly SelectOption<Command["kind"]>[];

export const SELF_SWITCH_KEY_OPTIONS = [
  { value: "A", label: "A" },
  { value: "B", label: "B" },
  { value: "C", label: "C" },
  { value: "D", label: "D" },
] as const satisfies readonly SelectOption<"A" | "B" | "C" | "D">[];

export function commandKindLabel(kind: Command["kind"]): string {
  return COMMAND_KIND_OPTIONS.find((option) => option.value === kind)?.label ?? kind;
}

export const PAGE_COMMAND_BUTTONS = [
  { kind: "text", testId: "command-add-text", label: "문장" },
  { kind: "choices", testId: "command-add-choice", label: "선택지" },
  { kind: "setSwitch", testId: "command-add-switch", label: "스위치" },
  { kind: "setVariable", testId: "command-add-variable", label: "변수" },
  { kind: "fork", testId: "command-add-branch", label: "분기" },
  { kind: "timer", testId: "command-add-timer", label: "타이머" },
  { kind: "transfer", testId: "command-add-transfer", label: "장소 이동" },
  { kind: "moveEvent", testId: "command-add-move-route", label: "이동" },
  { kind: "showPicture", testId: "command-add-picture", label: "그림" },
  { kind: "playAudio", testId: "command-add-audio", label: "소리" },
  { kind: "battleProcessing", testId: "command-add-battle", label: "전투" },
  { kind: "changeGold", testId: "command-add-gold", label: "돈" },
  { kind: "changeItem", testId: "command-add-item", label: "아이템" },
  { kind: "changeParty", testId: "command-add-party", label: "파티" },
  { kind: "giveMonster", testId: "command-add-give-monster", label: "몬스터" },
  { kind: "evolveMonster", testId: "command-add-evolve-monster", label: "진화" },
  { kind: "addFollower", testId: "command-add-follower", label: "동행자" },
  { kind: "setLighting", testId: "command-add-set-lighting", label: "조명" },
  { kind: "setWeather", testId: "command-add-set-weather", label: "날씨" },
  { kind: "showAnimation", testId: "command-add-show-animation", label: "애니메이션" },
  { kind: "checkpointSave", testId: "command-add-checkpoint-save", label: "체크포인트" },
  { kind: "killPlayer", testId: "command-add-kill-player", label: "즉사" },
  { kind: "triggerEnding", testId: "command-add-trigger-ending", label: "엔딩 트리거" },
  { kind: "ending", testId: "command-add-ending", label: "엔딩" },
  { kind: "gameOver", testId: "command-add-game-over", label: "게임 오버" },
] as const satisfies readonly PageCommandButton[];

export const EVENT_PRIORITY_OPTIONS = [
  { value: "below", label: "캐릭터 아래" },
  { value: "same", label: "캐릭터와 같음" },
  { value: "above", label: "캐릭터 위" },
] as const satisfies readonly SelectOption<EventPage["priority"]>[];

export const EVENT_ANIMATION_TYPE_OPTIONS = [
  { value: "normal", label: "보통" },
  { value: "step", label: "정지 시 애니메이션" },
  { value: "fixedDirection", label: "방향 고정" },
  { value: "fixedDirectionStep", label: "방향 고정 + 정지 애니메이션" },
  { value: "fixedGraphic", label: "그래픽 고정" },
  { value: "fourFrame", label: "4프레임 애니메이션" },
] as const satisfies readonly SelectOption<EventAnimationType>[];

export const BOOLEAN_OPTIONS = [
  { value: "true", label: "참" },
  { value: "false", label: "거짓" },
] as const satisfies readonly SelectOption<"true" | "false">[];

export const VARIABLE_OP_OPTIONS = [
  { value: "=", label: "=" },
  { value: "+=", label: "+=" },
  { value: "-=", label: "-=" },
  { value: "*=", label: "*=" },
  { value: "/=", label: "/=" },
] as const satisfies readonly SelectOption<Extract<Command, { kind: "setVariable" }>["op"]>[];

export const TIMER_ACTION_OPTIONS = [
  { value: "set", label: "설정" },
  { value: "start", label: "시작" },
  { value: "stop", label: "정지" },
] as const satisfies readonly SelectOption<Extract<Command, { kind: "timer" }>["action"]>[];

export const TIMER_ID_OPTIONS = [
  { value: "timer1", label: "타이머 1" },
  { value: "timer2", label: "타이머 2" },
] as const satisfies readonly SelectOption<NonNullable<Extract<Command, { kind: "timer" }>["timerId"]>>[];

export const CONDITION_OP_OPTIONS = [
  { value: "==", label: "같음" },
  { value: ">=", label: "이상" },
  { value: "<=", label: "이하" },
  { value: ">", label: "초과" },
  { value: "<", label: "미만" },
  { value: "!=", label: "다름" },
] as const satisfies readonly SelectOption<Extract<Condition, { kind: "variable" }>["op"]>[];

export const LAYER_OPTIONS = [
  { value: "lower", label: "하위" },
  { value: "upper", label: "상위" },
] as const satisfies readonly SelectOption<Extract<Command, { kind: "changeTile" }>["layer"]>[];

export function optionValue<T extends string>(
  value: string,
  options: readonly SelectOption<T>[],
  fallback: T
): T {
  return options.some((option) => option.value === value) ? matchingValue(value, options, fallback) : fallback;
}

function matchingValue<T extends string>(
  value: string,
  options: readonly SelectOption<T>[],
  fallback: T
): T {
  for (const option of options) {
    if (option.value === value) return option.value;
  }
  return fallback;
}
