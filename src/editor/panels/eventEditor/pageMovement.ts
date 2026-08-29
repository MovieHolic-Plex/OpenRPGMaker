import { updateEventPage } from "@/editor/eventPages";
import { el } from "@/util/dom";
import { selectedOptionValue, selectWithOptions } from "./dom";
import { openPageMoveRouteDialog } from "./moveRouteDialog";
import { renderPageLivingMovement } from "./pageNpcLiving";
import type { EventPage, EventPageMovement, MapId, MoveCommand } from "@/project/types";

const MOVEMENT_TYPE_OPTIONS = [
  { value: "fixed", label: "정지" },
  { value: "random", label: "무작위" },
  { value: "approach", label: "접근" },
  { value: "chase", label: "추격" },
  { value: "custom", label: "사용자 지정" },
  { value: "living", label: "생활 이동" },
] as const;

export function renderPageMovement(mapId: MapId, eventId: string, page: EventPage): HTMLElement {
  const movement = page.movement;
  const type = selectWithOptions(MOVEMENT_TYPE_OPTIONS, movement.type, "event-page-movement-type");
  const frequency = frequencySelect(movement.frequency);
  const isCustom = movement.type === "custom";
  const hasAutonomousMovement = movement.type !== "fixed";
  frequency.disabled = !hasAutonomousMovement;
  const applyBasics = () => replaceMovement(mapId, eventId, page, {
    ...movementForType(movement, selectedOptionValue(type, MOVEMENT_TYPE_OPTIONS, movement.type), mapId),
    speed: movement.speed,
    frequency: parseInt(frequency.value, 10) || 1,
  });
  type.addEventListener("change", applyBasics);
  frequency.addEventListener("change", applyBasics);
  const customRoute = el("button", {
    class: "btn event-page-custom-route",
    text: "사용자 지정 이동 경로 설정",
    attrs: isCustom ? { type: "button" } : { type: "button", disabled: "" },
    dataset: { testid: "event-page-custom-route" },
    on: {
      click: () => openPageMoveRouteDialog({
        movement: {
          ...movement,
          type: "custom",
          frequency: parseInt(frequency.value, 10) || movement.frequency,
          route: movement.route ?? { moves: [], repeat: true },
        },
        onApply: (nextMovement) => replaceMovement(mapId, eventId, page, nextMovement),
      }),
    },
  });
  const wrap = el("div", { class: "event-page-movement", dataset: { testid: "event-page-movement" } });
  wrap.append(
    el("div", {
      class: "event-page-movement-basics",
      children: [
        type,
        // 정지여도 빈도 슬롯은 유지(비활성) — RM/e2e 계약. 경로 버튼만 custom 일 때 활성.
        compactLabel("움직임 빈도", frequency, !hasAutonomousMovement),
        customRoute,
      ],
    })
  );
  if (isCustom) {
    wrap.append(el("div", { class: "event-page-movement-route", children: [routeSummary(movement)] }));
  }
  if (movement.type === "living") {
    wrap.append(renderPageLivingMovement(mapId, eventId, page));
  }
  return wrap;
}

function movementForType(movement: EventPageMovement, type: EventPageMovement["type"], mapId: MapId): EventPageMovement {
  if (type === "custom") {
    return { ...movement, type, route: movement.route ?? { moves: [], repeat: true } };
  }
  if (type === "living") {
    return {
      ...movement,
      type,
      living: movement.living ?? {
        destinations: [{ mapId, x: 0, y: 0, direction: "down" }],
        repeat: false,
      },
    };
  }
  if (type === "chase") {
    return { ...movement, type, pathfind: movement.pathfind ?? true };
  }
  return { ...movement, type };
}

function compactLabel(text: string, control: HTMLElement, disabled = false): HTMLElement {
  return el("label", {
    class: "event-page-movement-label" + (disabled ? " disabled" : ""),
    children: [el("span", { text }), control],
  });
}

function frequencySelect(value: number): HTMLSelectElement {
  const select = el("select", { dataset: { testid: "event-page-movement-frequency" } });
  const labels = ["아주 드묾", "드묾", "가끔", "보통", "자주", "꽤 자주", "매우 자주", "아주 자주"];
  for (let frequency = 1; frequency <= 8; frequency += 1) {
    select.append(el("option", { attrs: { value: String(frequency) }, text: labels[frequency - 1] ?? String(frequency) }));
  }
  select.value = String(value);
  return select;
}

function replaceMovement(mapId: MapId, eventId: string, page: EventPage, movement: EventPageMovement): void {
  updateEventPage(mapId, eventId, page.id, { movement });
}

function routeSummary(movement: EventPageMovement): HTMLElement {
  return el("div", {
    class: "empty-hint",
    text: (movement.route?.moves ?? []).map(moveLabel).join(" -> ") || "(이동 경로 없음)",
    dataset: { testid: "event-page-movement-route-summary" },
  });
}

function moveLabel(command: MoveCommand): string {
  switch (command.kind) {
    case "move":
      return `${dirLabel(command.dir)} 이동`;
    case "moveDiagonal":
      return `${dirLabel(command.horizontal)} ${dirLabel(command.vertical)} 이동`;
    case "moveRandom":
      return "무작위 이동";
    case "moveTowardPlayer":
      return "플레이어 쪽 이동";
    case "moveAwayFromPlayer":
      return "플레이어에게서 멀어짐";
    case "stepForward":
      return "한 걸음 전진";
    case "jump":
      return "점프";
    case "dropIn":
      return "위에서 낙하";
    case "land":
      return "착지";
    case "turn":
      return `${dirLabel(command.dir)} 향함`;
    case "turnRelative":
      return "회전";
    case "turnRandom":
      return "무작위로 향함";
    case "turnTowardPlayer":
      return "플레이어 쪽으로 향함";
    case "turnAwayFromPlayer":
      return "플레이어 반대로 향함";
    case "setDirectionFix":
      return `방향 고정 ${onOff(command.enabled)}`;
    case "setThrough":
      return `통과 ${onOff(command.enabled)}`;
    case "setAnimation":
      return `애니메이션 ${onOff(command.enabled)}`;
    case "changeOpacity":
      return command.delta < 0 ? "불투명도 감소" : "불투명도 증가";
    case "setSwitch":
      return `스위치 ${command.switchId} ${onOff(command.value)}`;
    case "changeSpeed":
      return command.delta < 0 ? "속도 감소" : "속도 증가";
    case "changeFrequency":
      return command.delta < 0 ? "빈도 감소" : "빈도 증가";
    case "changeGraphic":
      return `그래픽 ${command.spriteId}`;
    case "npcTransfer":
      return `NPC 맵 이동 ${command.mapId} (${command.x}, ${command.y})`;
    case "playSe":
      return `효과음 ${command.resourceId}`;
    case "wait":
      return "대기";
  }
}

function dirLabel(dir: "left" | "right" | "up" | "down"): string {
  switch (dir) {
    case "up":
      return "위";
    case "down":
      return "아래";
    case "left":
      return "왼쪽";
    case "right":
      return "오른쪽";
  }
}

function onOff(value: boolean): string {
  return value ? "ON" : "OFF";
}
