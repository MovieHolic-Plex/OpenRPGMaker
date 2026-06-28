import { m2CommandById } from "@/editor/eventCommands/m2Catalog";
import { store } from "@/project/store";
import type { Command, VariableOperand } from "@/project/types";

export function commandSummary(cmd: Command): string {
  switch (cmd.kind) {
    case "text":
      return `문장 표시: ${oneLine(cmd.body || "...")}`;
    case "changeFace":
      return `얼굴 그래픽 변경: ${cmd.resourceId || "(선택 없음)"} #${cmd.faceIndex + 1} ${cmd.position}${cmd.flipHorizontally ? " / 좌우 반전" : ""}`;
    case "displayTextSettings":
      return `문장 표시 설정: ${messageWindowFormatLabel(cmd.format)} / ${messageWindowPositionLabel(cmd.position)}${cmd.allowEventMovementDuringWait ? " / 이동 허용" : ""}`;
    case "choices":
      return `선택지 표시: ${choiceSummary(cmd)}${cmd.cancelBehavior ? ` / 취소 ${cmd.cancelBehavior}` : ""}`;
    case "fork":
      return `조건 분기: ${conditionSummary(cmd.condition)}`;
    case "wait":
      return `대기: ${(cmd.ms / 1000).toFixed(1)} 초`;
    case "inputWait":
      return "입력 대기";
    case "inputNumber":
      return `숫자 입력: ${recordName("variable", cmd.variableId)} / ${cmd.digits}자리`;
    case "label":
      return `라벨: ${cmd.name}`;
    case "gotoLabel":
      return `라벨로 점프: ${cmd.name}`;
    case "setSwitch":
      return `스위치 조작: ${recordName("switch", cmd.switchId)} ${cmd.value ? "ON" : "OFF"}`;
    case "setVariable":
      return `변수 조작: ${recordName("variable", cmd.variableId)} ${cmd.op} ${operandSummary(cmd.value)}`;
    case "timer":
      return `타이머 조작: ${cmd.action}${cmd.seconds !== undefined ? ` ${cmd.seconds}초` : ""}`;
    case "transfer":
      return `장소 이동: ${mapName(cmd.mapId)} (${cmd.x},${cmd.y})`;
    case "moveEvent":
      return `이동 경로 설정: ${cmd.eventId || "이 이벤트"} (${cmd.route.moves.length}개)`;
    case "changeTile":
      return `타일 변경: ${mapName(cmd.mapId)} ${cmd.layer} (${cmd.x},${cmd.y}) = ${cmd.tile}`;
    case "callCommonEvent":
      return `이벤트 호출: ${commonEventName(cmd.commonEventId)}`;
    case "battleProcessing":
      return `전투 처리: ${cmd.canEscape ? "도망 가능" : "일반"}, [${troopName(cmd.troopId)}]`;
    case "learnSkill":
      return `특수기 변경: ${actorName(cmd.actorId)} / ${skillName(cmd.skillId)}`;
    case "changeGold":
      return `소지금 변경: ${cmd.op} ${cmd.amount}`;
    case "changeItem":
      return `아이템 변경: ${itemName(cmd.itemId)} ${cmd.op} ${cmd.amount}`;
    case "changeParty":
      return `파티 멤버 변경: ${actorName(cmd.actorId)} ${cmd.action === "add" ? "추가" : "제외"}`;
    case "showPicture":
      return `그림 표시: ${cmd.pictureId} (${cmd.x},${cmd.y})`;
    case "erasePicture":
      return `그림 삭제: ${cmd.pictureId}`;
    case "playAudio":
      return `BGM 재생: ${cmd.resourceId || "(선택 없음)"}`;
    case "stopAudio":
      return "BGM 페이드아웃";
    case "shop":
      return `상점 처리: ${cmd.itemIds.length}개`;
    case "inn":
      return `여관 처리: ${cmd.price}G`;
    case "gameOver":
      return "게임 오버";
    case "ending":
      return `엔딩: ${cmd.title}`;
    case "returnToTitle":
      return "타이틀 화면으로";
    case "setFlag":
      return `플래그 설정: ${cmd.flag} ${cmd.value ? "ON" : "OFF"}`;
    case "m2Command":
      return m2CommandSummary(cmd);
    default:
      return "명령";
  }
}

function m2CommandSummary(cmd: Extract<Command, { kind: "m2Command" }>): string {
  const entry = m2CommandById(cmd.commandId);
  const label = entry?.label ?? cmd.commandId;
  const fields = Object.entries(cmd.fields)
    .filter(([, value]) => String(value).length > 0)
    .slice(0, 3)
    .map(([key, value]) => `${key}: ${String(value)}`);
  return fields.length > 0 ? `${label}: ${fields.join(", ")}` : label;
}

function choiceSummary(cmd: Extract<Command, { kind: "choices" }>): string {
  const options = cmd.options.map((option) => option.text).join(" / ");
  return cmd.prompt ? `${oneLine(cmd.prompt)} - ${options}` : options;
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
  if (condition.kind === "switch") return `${recordName("switch", condition.switchId)} ${condition.value ? "ON" : "OFF"}`;
  return `${recordName("variable", condition.variableId)} ${condition.op} ${condition.value}`;
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

function recordName(kind: "switch" | "variable", id: string): string {
  const project = store.getCurrent();
  const collection = kind === "switch" ? project.switches : project.variables;
  const index = collection.findIndex((record) => record.id === id);
  const label = id ? collection[index]?.name ?? id : kind === "switch" ? "스위치 선택" : "변수 선택";
  return index >= 0 ? `[${String(index + 1).padStart(4, "0")}: ${label}]` : `[${label}]`;
}
