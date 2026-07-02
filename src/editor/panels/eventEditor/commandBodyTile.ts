import { el } from "@/util/dom";
import { selectedOptionValue, selectWithOptions } from "./dom";
import { LAYER_OPTIONS } from "./options";
import { mapSelect, numberInput } from "./commandBodyAdvanced";
import type { Command } from "@/project/types";
import type { CommandEditContext } from "./types";

export function changeTileBody(context: CommandEditContext, cmd: Extract<Command, { kind: "changeTile" }>): HTMLElement {
  const wrap = el("span", {});
  const mapSel = mapSelect(cmd.mapId, "change-tile-map-select");
  const layer = selectWithOptions(LAYER_OPTIONS, cmd.layer, "change-tile-layer-select");
  const x = numberInput(cmd.x, "X 좌표", "change-tile-x-input");
  const y = numberInput(cmd.y, "Y 좌표", "change-tile-y-input");
  const tile = numberInput(cmd.tile, "타일 번호", "change-tile-tile-input");
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
  for (const control of [mapSel, layer, x, y, tile]) control.addEventListener("change", apply);
  wrap.append(mapSel, layer, x, y, tile);
  return wrap;
}
