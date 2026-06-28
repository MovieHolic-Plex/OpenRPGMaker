import { el } from "@/util/dom";
import type { Command, MoveCommand } from "@/project/types";
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
  const apply = () => {
    context.actions.replaceCommand(context.path, {
      kind: "moveEvent",
      eventId: eventIdIn.value,
      route: { moves: cmd.route.moves, repeat: repeat.checked },
    });
  };
  eventIdIn.addEventListener("change", apply);
  repeat.addEventListener("change", apply);
  for (const input of [switchIdIn, graphicIdIn, soundIdIn]) {
    input.addEventListener("input", () => {
      routeParameterDrafts.set(parameterKey, {
        switchId: switchIdIn.value.trim(),
        spriteId: graphicIdIn.value.trim(),
        soundId: soundIdIn.value.trim(),
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
              });
              if (move) replaceMoveRoute(context, eventIdIn.value, repeat.checked, [...cmd.route.moves, move]);
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
      on: { click: () => replaceMoveRoute(context, eventIdIn.value, repeat.checked, []) },
    })
  );
  const repeatLabel = el("label", { text: "반복" });
  repeatLabel.prepend(repeat);
  wrap.append(
    el("div", { children: [eventIdIn, repeatLabel] }),
    el("div", { class: "move-route-parameters", children: [switchIdIn, graphicIdIn, soundIdIn] }),
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
  moves: MoveCommand[]
): void {
  context.actions.replaceCommand(context.path, {
    kind: "moveEvent",
    eventId,
    route: { moves, repeat },
  });
}

function inferRouteParameters(moves: readonly MoveCommand[]): MoveRouteCommandContext {
  let switchId = "sw_route_seen";
  let spriteId = "npc_villager";
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
  };
}
