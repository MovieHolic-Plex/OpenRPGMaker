import { el } from "@/util/dom";
import { store } from "@/project/store";
import type { Command, Dir, MapId, MoveCommand } from "@/project/types";
import type { CommandEditContext } from "./types";
import {
  MOVE_ROUTE_COMMAND_ROWS,
  moveCommandLabel,
  type MoveRouteCommandContext,
} from "./moveRouteCommandCatalog";

const routeParameterDrafts = new Map<string, MoveRouteCommandContext>();

export function moveEventBody(context: CommandEditContext, cmd: Extract<Command, { kind: "moveEvent" }>): HTMLElement {
  const wrap = el("div", { class: "move-route-editor", dataset: { testid: "move-route-editor" } });
  const parameterKey = context.path.join(".");
  const parameterDraft = routeParameterDrafts.get(parameterKey) ?? inferRouteParameters(cmd.route.moves);
  const eventIdIn = el("input", {
    attrs: { type: "text", placeholder: "이벤트 ID(비우면 현재 이벤트)" },
    value: cmd.eventId,
    dataset: { testid: "move-route-event-id-input" },
  });
  const repeat = el("input", {
    attrs: { type: "checkbox" },
    dataset: { testid: "move-route-repeat-checkbox" },
  });
  repeat.checked = cmd.route.repeat;
  const wait = el("input", {
    attrs: { type: "checkbox" },
    dataset: { testid: "move-route-wait-checkbox" },
  });
  wait.checked = cmd.route.wait === true;
  const switchIdIn = el("input", {
    attrs: { type: "text", placeholder: "스위치 ID" },
    value: parameterDraft.switchId,
    dataset: { testid: "move-route-switch-id-input" },
  });
  const graphicIdIn = el("input", {
    attrs: { type: "text", placeholder: "그래픽 ID" },
    value: parameterDraft.spriteId,
    dataset: { testid: "move-route-graphic-id-input" },
  });
  const soundIdIn = el("input", {
    attrs: { type: "text", placeholder: "효과음 ID" },
    value: parameterDraft.soundId,
    dataset: { testid: "move-route-sound-id-input" },
  });
  const npcTargetMap = mapSelect(parameterDraft.npcTargetMapId);
  const npcTargetX = el("input", {
    attrs: { type: "number", min: "0", placeholder: "NPC X" },
    value: parameterDraft.npcTargetX,
    dataset: { testid: "move-route-npc-target-x-input" },
  });
  const npcTargetY = el("input", {
    attrs: { type: "number", min: "0", placeholder: "NPC Y" },
    value: parameterDraft.npcTargetY,
    dataset: { testid: "move-route-npc-target-y-input" },
  });
  const npcTargetDirection = directionSelect(parameterDraft.npcTargetDirection);
  const apply = () => {
    context.actions.replaceCommand(context.path, {
      kind: "moveEvent",
      eventId: eventIdIn.value,
      route: { moves: cmd.route.moves, repeat: repeat.checked, wait: wait.checked },
    });
  };
  eventIdIn.addEventListener("change", apply);
  repeat.addEventListener("change", apply);
  wait.addEventListener("change", apply);
  for (const input of [switchIdIn, graphicIdIn, soundIdIn, npcTargetMap, npcTargetX, npcTargetY, npcTargetDirection]) {
    input.addEventListener("input", () => {
      routeParameterDrafts.set(parameterKey, {
        switchId: switchIdIn.value.trim(),
        spriteId: graphicIdIn.value.trim(),
        soundId: soundIdIn.value.trim(),
        npcTargetMapId: npcTargetMap.value,
        npcTargetX: parseInt(npcTargetX.value, 10) || 0,
        npcTargetY: parseInt(npcTargetY.value, 10) || 0,
        npcTargetDirection: toDirection(npcTargetDirection.value),
      });
    });
    input.addEventListener("change", () => {
      routeParameterDrafts.set(parameterKey, {
        switchId: switchIdIn.value.trim(),
        spriteId: graphicIdIn.value.trim(),
        soundId: soundIdIn.value.trim(),
        npcTargetMapId: npcTargetMap.value,
        npcTargetX: parseInt(npcTargetX.value, 10) || 0,
        npcTargetY: parseInt(npcTargetY.value, 10) || 0,
        npcTargetDirection: toDirection(npcTargetDirection.value),
      });
    });
  }
  const controls = el("div", { class: "move-route-controls" });
  for (const row of MOVE_ROUTE_COMMAND_ROWS) {
    for (const item of row) {
      controls.append(
        el("button", {
          class: "btn small",
          text: item.label,
          dataset: { testid: `move-route-add-${item.testId}` },
          on: {
            click: () => {
              const move = item.createCommand({
                switchId: switchIdIn.value.trim(),
                spriteId: graphicIdIn.value.trim(),
                soundId: soundIdIn.value.trim(),
                npcTargetMapId: npcTargetMap.value,
                npcTargetX: parseInt(npcTargetX.value, 10) || 0,
                npcTargetY: parseInt(npcTargetY.value, 10) || 0,
                npcTargetDirection: toDirection(npcTargetDirection.value),
              });
              if (move) replaceMoveRoute(context, eventIdIn.value, repeat.checked, [...cmd.route.moves, move], wait.checked);
            },
          },
        })
      );
    }
  }
  controls.append(
    el("button", {
      class: "btn small danger",
      text: "비우기",
      dataset: { testid: "move-route-clear" },
      on: { click: () => replaceMoveRoute(context, eventIdIn.value, repeat.checked, [], wait.checked) },
    })
  );
  const repeatLabel = el("label", { text: "반복" });
  repeatLabel.prepend(repeat);
  const waitLabel = el("label", { text: "완료까지 대기" });
  waitLabel.prepend(wait);
  wrap.append(
    el("div", { children: [eventIdIn, repeatLabel, waitLabel] }),
    el("div", { class: "move-route-parameters", children: [switchIdIn, graphicIdIn, soundIdIn, npcTargetMap, npcTargetX, npcTargetY, npcTargetDirection] }),
    controls,
    el("div", {
      class: "empty-hint",
      text: cmd.route.moves.map(moveCommandLabel).join(" -> ") || "(이동 단계 없음)",
      dataset: { testid: "move-route-summary" },
    })
  );
  return wrap;
}

function replaceMoveRoute(
  context: CommandEditContext,
  eventId: string,
  repeat: boolean,
  moves: MoveCommand[],
  wait: boolean
): void {
  context.actions.replaceCommand(context.path, {
    kind: "moveEvent",
    eventId,
    route: { moves, repeat, wait },
  });
}

function inferRouteParameters(moves: readonly MoveCommand[]): MoveRouteCommandContext {
  let switchId = "sw_route_seen";
  let spriteId = "tex_easyrpg_charset_people1";
  let soundId = "se_route_chime";
  for (let index = moves.length - 1; index >= 0; index -= 1) {
    const move = moves[index];
    if (move === undefined) continue;
    switch (move.kind) {
      case "setSwitch":
        switchId = move.switchId;
        break;
      case "changeGraphic":
        spriteId = move.spriteId;
        break;
      case "npcTransfer":
        return {
          switchId,
          spriteId,
          soundId,
          npcTargetMapId: move.mapId,
          npcTargetX: move.x,
          npcTargetY: move.y,
          npcTargetDirection: move.direction ?? "down",
        };
      case "playSe":
        soundId = move.resourceId;
        break;
      default:
        break;
    }
  }
  return {
    switchId,
    spriteId,
    soundId,
    npcTargetMapId: Object.keys(store.getCurrent().maps)[0] ?? "",
    npcTargetX: 0,
    npcTargetY: 0,
    npcTargetDirection: "down",
  };
}

function mapSelect(value: MapId): HTMLSelectElement {
  const select = el("select", { dataset: { testid: "move-route-npc-target-map-input" } });
  for (const map of Object.values(store.getCurrent().maps)) {
    select.append(el("option", { attrs: { value: map.id }, text: map.name }));
  }
  select.value = value;
  return select;
}

function directionSelect(value: Dir): HTMLSelectElement {
  const select = el("select", { dataset: { testid: "move-route-npc-target-direction-input" } });
  for (const option of [
    { value: "down", label: "아래" },
    { value: "left", label: "왼쪽" },
    { value: "right", label: "오른쪽" },
    { value: "up", label: "위" },
  ] as const) {
    select.append(el("option", { attrs: { value: option.value }, text: option.label }));
  }
  select.value = value;
  return select;
}

function toDirection(value: string): Dir {
  if (value === "left" || value === "right" || value === "up" || value === "down") return value;
  return "down";
}
