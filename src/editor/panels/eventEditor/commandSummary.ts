import { m2CommandById } from "@/editor/eventCommands/m2Catalog";
import { numberedName } from "@/editor/panels/databaseDisplay";
import { store } from "@/project/store";
import { PLAYER_MOVE_TARGET } from "@/project/moveRouteTarget";
import type { Command, VariableOperand } from "@/project/types";

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
  | "badge-off";

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

export type CommandSummaryToken = CommandSummaryPart | CommandSummaryIconPart;

// 아이콘 토큰 판별. 렌더러가 이미지/텍스트 분기할 때 사용한다.
export function isSummaryIconPart(part: CommandSummaryToken): part is CommandSummaryIconPart {
  return "kind" in part && part.kind === "icon";
}

export function commandSummary(cmd: Command): string {
  // 아이콘 토큰은 문자열 변환 시 스킵한다 (text 가 "" 라 join 결과는 어차피 불변).
  return commandSummaryParts(cmd)
    .filter((part) => !isSummaryIconPart(part))
    .map((part) => part.text)
    .join("");
}

export function commandSummaryParts(cmd: Command): readonly CommandSummaryToken[] {
  switch (cmd.kind) {
    case "text":
      return commandLine("문장 표시", textPart(oneLine(cmd.body || "...")));
    case "changeFace":
      return commandLine(
        "얼굴 그래픽 변경",
        valuePart(cmd.resourceId || "(선택 없음)"),
        plainPart(" #"),
        valuePart(String(cmd.faceIndex + 1)),
        plainPart(" "),
        valuePart(facePositionLabel(cmd.position)),
        ...(cmd.flipHorizontally ? [plainPart(" / "), valuePart("좌우 반전")] : [])
      );
    case "displayTextSettings":
      return commandLine(
        "문장 표시 설정",
        valuePart(messageWindowFormatLabel(cmd.format)),
        plainPart(" / "),
        valuePart(messageWindowPositionLabel(cmd.position)),
        ...(cmd.allowEventMovementDuringWait ? [plainPart(" / "), valuePart("이동 허용")] : [])
      );
    case "choices":
      return commandLine(
        "선택지 표시",
        valuePart(choiceSummary(cmd)),
        ...(cmd.cancelBehavior ? [plainPart(" / 취소 "), valuePart(choiceCancelSummary(cmd.cancelBehavior))] : [])
      );
    case "fork":
      return commandLine("조건 분기", valuePart(conditionSummary(cmd.condition)));
    case "wait":
      return commandLine("대기", valuePart((cmd.ms / 1000).toFixed(1)), plainPart(" 초"));
    case "inputWait":
      return cmd.variableId
        ? commandLine("키 입력 대기", valuePart(recordName("variable", cmd.variableId)))
        : [commandPart("입력 대기")];
    case "inputNumber":
      return commandLine("숫자 입력", valuePart(recordName("variable", cmd.variableId)), plainPart(" / "), valuePart(String(cmd.digits)), plainPart("자리"));
    case "label":
      return commandLine("라벨", valuePart(cmd.name));
    case "gotoLabel":
      return commandLine("라벨로 점프", valuePart(cmd.name));
    case "loop":
      return commandLine("반복", valuePart(String(cmd.body.length)), plainPart("개 명령"));
    case "breakLoop":
      return [commandPart("반복 탈출")];
    case "setSwitch":
      return commandLine("스위치 조작", valuePart(recordName("switch", cmd.switchId)), plainPart(" "), onOffBadgePart(cmd.value));
    case "setVariable":
      return commandLine(
        "변수 조작",
        valuePart(recordName("variable", cmd.variableId)),
        plainPart(" "),
        opPart(cmd.op),
        plainPart(" "),
        valuePart(operandSummary(cmd.value))
      );
    case "timer":
      return commandLine("타이머 조작", valuePart(cmd.action), ...(cmd.seconds !== undefined ? [plainPart(" "), valuePart(String(cmd.seconds)), plainPart("초")] : []));
    case "transfer":
      if (cmd.direction && cmd.direction !== "retain") {
        return commandLine(
          "장소 이동",
          valuePart(mapName(cmd.mapId)),
          plainPart(" ("),
          valuePart(`${cmd.x},${cmd.y}`),
          plainPart(") / "),
          valuePart(transferDirectionSummary(cmd.direction))
        );
      }
      return commandLine("장소 이동", valuePart(mapName(cmd.mapId)), plainPart(" ("), valuePart(`${cmd.x},${cmd.y}`), plainPart(")"));
    case "moveEvent":
      return commandLine("이동 경로 설정", valuePart(cmd.eventId === PLAYER_MOVE_TARGET ? "주인공" : (cmd.eventId || "이 이벤트")), plainPart(" ("), valuePart(String(cmd.route.moves.length)), plainPart("개)"));
    case "changeTile":
      return commandLine(
        "타일 변경",
        valuePart(mapName(cmd.mapId)),
        plainPart(" "),
        valuePart(tileLayerSummary(cmd.layer)),
        plainPart(" ("),
        valuePart(`${cmd.x},${cmd.y}`),
        plainPart(") = "),
        valuePart(String(cmd.tile))
      );
    case "callCommonEvent":
      return commandLine("이벤트 호출", valuePart(commonEventName(cmd.commonEventId)));
    case "callMapEvent":
      return commandLine("맵 이벤트 호출", valuePart(cmd.eventId || "(이벤트 선택)"));
    case "battleProcessing":
      return commandLine("전투 처리", valuePart(cmd.canEscape ? "도망 가능" : "일반"), plainPart(", ["), valuePart(troopName(cmd.troopId)), plainPart("]"));
    case "learnSkill":
      return commandLine("특수기 변경", valuePart(actorName(cmd.actorId)), plainPart(" / "), valuePart(skillName(cmd.skillId)));
    case "changeExp":
      return commandLine("경험치 변경", valuePart(actorName(cmd.actorId)), plainPart(" "), opPart(cmd.op), plainPart(" "), valuePart(String(cmd.amount)));
    case "changeLevel":
      return commandLine("레벨 변경", valuePart(actorName(cmd.actorId)), plainPart(" "), opPart(cmd.op), plainPart(" "), valuePart(String(cmd.amount)));
    case "changeEquipment":
      return commandLine(
        "장비 변경",
        valuePart(actorName(cmd.actorId)),
        plainPart(" / "),
        valuePart(equipmentSlotLabel(cmd.slot)),
        plainPart(" = "),
        ...equipmentIconParts(cmd.equipmentId),
        valuePart(equipmentName(cmd.equipmentId))
      );
    case "changeActorHp":
      return commandLine("HP 변경", valuePart(actorName(cmd.actorId)), plainPart(" "), opPart(cmd.op), plainPart(" "), valuePart(String(cmd.amount)));
    case "changeActorMp":
      return commandLine("MP 변경", valuePart(actorName(cmd.actorId)), plainPart(" "), opPart(cmd.op), plainPart(" "), valuePart(String(cmd.amount)));
    case "recoverAll":
      return commandLine("모두 회복", valuePart(cmd.actorId ? actorName(cmd.actorId) : "파티 전체"));
    case "enterHeroName":
      return commandLine("이름 입력 처리", valuePart(actorName(cmd.actorId)), plainPart(" / 최대 "), valuePart(String(cmd.maxLength)), plainPart("자"));
    case "changeGold":
      return commandLine("소지금 변경", opPart(cmd.op), plainPart(" "), valuePart(String(cmd.amount)));
    case "changeItem":
      return commandLine(
        "아이템 변경",
        ...itemIconParts(cmd.itemId),
        valuePart(itemName(cmd.itemId)),
        plainPart(" "),
        opPart(cmd.op),
        plainPart(" "),
        valuePart(String(cmd.amount))
      );
    case "changeParty":
      return commandLine("파티 멤버 변경", valuePart(actorName(cmd.actorId)), plainPart(" "), valuePart(cmd.action === "add" ? "추가" : "제외"));
    case "showPicture":
      return commandLine("그림 표시", valuePart(cmd.pictureId), plainPart(" ("), valuePart(`${cmd.x},${cmd.y}`), plainPart(")"));
    case "erasePicture":
      return commandLine("그림 삭제", valuePart(cmd.pictureId));
    case "playAudio":
      return commandLine("소리 재생", valuePart(cmd.resourceId || "(선택 없음)"));
    case "stopAudio":
      return commandLine("소리 정지", valuePart("설정 없음"));
    case "shop":
      return commandLine("상점 처리", valuePart(String(cmd.itemIds.length)), plainPart("개"));
    case "inn":
      return commandLine("여관 처리", valuePart(String(cmd.price)), plainPart("G"));
    case "gameOver":
      return [commandPart("게임 오버")];
    case "ending":
      return commandLine("엔딩", valuePart(cmd.title));
    case "returnToTitle":
      return [commandPart("타이틀 화면으로")];
    case "setFlag":
      return commandLine("플래그 설정", valuePart(cmd.flag), plainPart(" "), onOffBadgePart(cmd.value));
    case "setSelfSwitch":
      return commandLine("셀프 스위치 설정", valuePart(cmd.key), plainPart(" "), onOffBadgePart(cmd.value));
    case "m2Command":
      return m2CommandSummaryParts(cmd);
    default:
      return [commandPart("명령")];
  }
}

function commandLine(label: string, ...parts: readonly CommandSummaryToken[]): readonly CommandSummaryToken[] {
  return [commandPart(label), plainPart(": "), ...parts];
}

// 연산 토큰. += 계열/-=/= 를 서로 다른 톤으로 구분해 리스트에서 증감·대입이 색으로 읽히게 한다.
// 텍스트 자체는 기존과 동일하게 유지한다 (commandSummary 문자열 불변).
function opPart(op: string): CommandSummaryPart {
  if (op.startsWith("+")) return { text: op, tone: "op-add" };
  if (op.startsWith("-")) return { text: op, tone: "op-sub" };
  if (op === "=") return { text: op, tone: "op-set" };
  return valuePart(op);
}

// 스위치/플래그 ON·OFF 배지 토큰. 텍스트는 기존 "ON"/"OFF" 그대로.
function onOffBadgePart(value: boolean): CommandSummaryPart {
  return { text: value ? "ON" : "OFF", tone: value ? "badge-on" : "badge-off" };
}

// 아이콘 토큰 생성. 리소스 id 만 담고 URL 해석은 렌더러(commandList) 몫.
function iconPart(resourceId: string): CommandSummaryIconPart {
  return { kind: "icon", resourceId, text: "", tone: "plain" };
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

function tileLayerSummary(layer: "lower" | "upper"): string {
  return layer === "upper" ? "상위" : "하위";
}

function commandPart(text: string): CommandSummaryPart {
  return { text, tone: "command" };
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
  const label = entry?.label ?? cmd.commandId;
  const fields = Object.entries(cmd.fields)
    .filter(([, value]) => String(value).length > 0)
    .slice(0, 3)
    .map(([key, value]) => `${key}: ${String(value)}`);
  if (fields.length === 0) return [commandPart(label)];
  return commandLine(label, valuePart(fields.join(", ")));
}

function choiceSummary(cmd: Extract<Command, { kind: "choices" }>): string {
  const options = cmd.options.map((option) => option.text).join(" / ");
  return cmd.prompt ? `${oneLine(cmd.prompt)} - ${options}` : options;
}

function choiceCancelSummary(behavior: Extract<Command, { kind: "choices" }>["cancelBehavior"]): string {
  if (!behavior) return "";
  if (behavior === "disallow") return "금지";
  if (behavior === "branch") return "분기";
  return `선택지 ${behavior.slice("choice".length)}`;
}

function facePositionLabel(position: Extract<Command, { kind: "changeFace" }>["position"]): string {
  return position === "right" ? "오른쪽" : "왼쪽";
}

function oneLine(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 80);
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

function conditionSummary(condition: Extract<Command, { kind: "fork" }>["condition"]): string {
  switch (condition.kind) {
    case "switch":
      return `${recordName("switch", condition.switchId)} ${condition.value ? "ON" : "OFF"}`;
    case "variable":
      return `${recordName("variable", condition.variableId)} ${condition.op} ${condition.value}`;
    case "selfSwitch":
      return `셀프 ${condition.key} ${condition.value ? "ON" : "OFF"}`;
    case "actor":
      return `${actorName(condition.actorId)} ${condition.present ? "있음" : "없음"}`;
    case "item":
      return `${itemName(condition.itemId)} ${condition.present ? "소지" : "미소지"}`;
    case "gold":
      return `소지금 ${condition.op} ${condition.amount}`;
    case "timer":
      return `${condition.timerId} <= ${condition.seconds}초`;
  }
}

function mapName(id: string): string {
  const project = store.getCurrent();
  return id ? project.maps[id]?.name ?? id : "(맵 선택)";
}

function commonEventName(id: string): string {
  const project = store.getCurrent();
  return id ? project.commonEvents.find((event) => event.id === id)?.name ?? id : "(이벤트 선택)";
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
  return id ? project.database.skills.find((skill) => skill.id === id)?.name ?? id : "(특수기 선택)";
}

function itemName(id: string): string {
  const project = store.getCurrent();
  return id ? project.database.items.find((item) => item.id === id)?.name ?? id : "(아이템 선택)";
}

function equipmentName(id: string): string {
  const project = store.getCurrent();
  return id ? project.database.equipment.find((equipment) => equipment.id === id)?.name ?? id : "(장비 해제)";
}

function equipmentSlotLabel(slot: Extract<Command, { kind: "changeEquipment" }>["slot"]): string {
  return { weapon: "무기", shield: "방패", armor: "갑옷", helmet: "머리", accessory: "장신구" }[slot];
}

function recordName(kind: "switch" | "variable", id: string): string {
  const project = store.getCurrent();
  const collection = kind === "switch" ? project.switches : project.variables;
  const index = collection.findIndex((record) => record.id === id);
  if (index >= 0) return `[${numberedName(index, collection[index]?.name ?? "")}]`;
  const label = id ? id : kind === "switch" ? "스위치 선택" : "변수 선택";
  return `[${label}]`;
}
