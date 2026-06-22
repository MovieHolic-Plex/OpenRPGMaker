import { store } from "@/project/store";
import { el } from "@/util/dom";
import { selectWithOptions, selectedOptionValue } from "./dom";
import { LAYER_OPTIONS } from "./options";
import type { Command } from "@/project/types";
import type { CommandEditContext } from "./types";

export function renderAdvancedCommandBody(
  context: CommandEditContext,
  cmd: Command
): HTMLElement | undefined {
  switch (cmd.kind) {
    case "transfer":
      return transferBody(context, cmd);
    case "wait":
      return waitBody(context, cmd);
    case "moveEvent":
      return moveEventBody(context, cmd);
    case "changeTile":
      return changeTileBody(context, cmd);
    case "callCommonEvent":
      return callCommonEventBody(context, cmd);
    default:
      return undefined;
  }
}

function transferBody(context: CommandEditContext, cmd: Extract<Command, { kind: "transfer" }>): HTMLElement {
  const mapSel = mapSelect(cmd.mapId, "transfer-map-select");
  const x = el("input", {
    attrs: { type: "number", min: "0", title: "X 좌표" },
    value: String(cmd.x),
    dataset: { testid: "transfer-x-input" },
  }) as HTMLInputElement;
  const y = el("input", {
    attrs: { type: "number", min: "0", title: "Y 좌표" },
    value: String(cmd.y),
    dataset: { testid: "transfer-y-input" },
  }) as HTMLInputElement;
  const apply = () => {
    context.actions.replaceCommand(context.path, {
      kind: "transfer",
      mapId: mapSel.value,
      x: parseInt(x.value, 10) || 0,
      y: parseInt(y.value, 10) || 0,
    });
  };
  mapSel.addEventListener("change", apply);
  x.addEventListener("change", apply);
  y.addEventListener("change", apply);
  const line = el("div", {});
  line.style.display = "flex";
  line.style.gap = "4px";
  line.append(mapSel, x, y);
  return line;
}

function waitBody(context: CommandEditContext, cmd: Extract<Command, { kind: "wait" }>): HTMLElement {
  const ms = el("input", {
    attrs: { type: "number", min: "0", title: "대기 시간(ms)" },
    value: String(cmd.ms),
  }) as HTMLInputElement;
  ms.addEventListener("change", () => {
    context.actions.replaceCommand(context.path, {
      kind: "wait",
      ms: parseInt(ms.value, 10) || 0,
    });
  });
  return ms;
}

function moveEventBody(context: CommandEditContext, cmd: Extract<Command, { kind: "moveEvent" }>): HTMLElement {
  const wrap = el("span", {});
  const eventIdIn = el("input", {
    attrs: { type: "text", placeholder: "이벤트 ID(비우면 현재 이벤트)" },
    value: cmd.eventId,
  }) as HTMLInputElement;
  const repeat = el("input", { attrs: { type: "checkbox" } }) as HTMLInputElement;
  repeat.checked = cmd.route.repeat;
  const apply = () => {
    context.actions.replaceCommand(context.path, {
      kind: "moveEvent",
      eventId: eventIdIn.value,
      route: { moves: cmd.route.moves, repeat: repeat.checked },
    });
  };
  eventIdIn.addEventListener("change", apply);
  repeat.addEventListener("change", apply);
  wrap.append(eventIdIn, el("label", { text: "반복" }), repeat);
  return wrap;
}

function changeTileBody(context: CommandEditContext, cmd: Extract<Command, { kind: "changeTile" }>): HTMLElement {
  const wrap = el("span", {});
  const mapSel = mapSelect(cmd.mapId);
  const layer = selectWithOptions(LAYER_OPTIONS, cmd.layer);
  const x = el("input", { attrs: { type: "number", title: "X 좌표" }, value: String(cmd.x) }) as HTMLInputElement;
  const y = el("input", { attrs: { type: "number", title: "Y 좌표" }, value: String(cmd.y) }) as HTMLInputElement;
  const tile = el("input", { attrs: { type: "number", title: "타일 번호" }, value: String(cmd.tile) }) as HTMLInputElement;
  const apply = () => {
    context.actions.replaceCommand(context.path, {
      kind: "changeTile",
      mapId: mapSel.value,
      layer: selectedOptionValue(layer, LAYER_OPTIONS, cmd.layer),
      x: parseInt(x.value, 10) || 0,
      y: parseInt(y.value, 10) || 0,
      tile: parseInt(tile.value, 10) || 0,
    });
  };
  for (const control of [mapSel, layer, x, y, tile]) {
    control.addEventListener("change", apply);
  }
  wrap.append(mapSel, layer, x, y, tile);
  return wrap;
}

function callCommonEventBody(
  context: CommandEditContext,
  cmd: Extract<Command, { kind: "callCommonEvent" }>
): HTMLElement {
  const project = store.getCurrent();
  const ceSel = el("select") as HTMLSelectElement;
  ceSel.append(el("option", { text: "(선택)", attrs: { value: "" } }));
  for (const ce of project.commonEvents) {
    ceSel.append(el("option", { text: ce.name, attrs: { value: ce.id } }));
  }
  ceSel.value = cmd.commonEventId;
  ceSel.addEventListener("change", () => {
    context.actions.replaceCommand(context.path, {
      kind: "callCommonEvent",
      commonEventId: ceSel.value,
    });
  });
  return ceSel;
}

function mapSelect(currentId: string, testId?: string): HTMLSelectElement {
  const project = store.getCurrent();
  const mapSel = el("select", {
    dataset: testId ? { testid: testId } : undefined,
  }) as HTMLSelectElement;
  mapSel.append(el("option", { text: "(맵 선택)", attrs: { value: "" } }));
  for (const id of Object.keys(project.maps)) {
    mapSel.append(el("option", { text: project.maps[id].name || id, attrs: { value: id } }));
  }
  mapSel.value = currentId;
  return mapSel;
}
