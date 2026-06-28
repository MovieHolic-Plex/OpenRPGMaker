import { shiftMapContent } from "@/editor/mapShiftActions";
import { openEventSubdialog } from "@/editor/panels/eventEditor/subdialog";
import type { MapId } from "@/project/types";
import { el } from "@/util/dom";

export function openMapShiftDialog(mapId: MapId, mapName: string): void {
  openEventSubdialog({
    render: (body, close) => renderShiftBody(body, close, mapId),
    testId: `map-shift-modal-${mapId}`,
    title: "Shift...",
    subtitle: mapName,
    width: "narrow",
  });
}

function renderShiftBody(body: HTMLElement, close: () => void, mapId: MapId): void {
  const dxInput = shiftInput("shift-x-input");
  const dyInput = shiftInput("shift-y-input");
  body.append(
    el("div", {
      class: "panel-section map-shift-panel",
      children: [
        field("X", dxInput),
        field("Y", dyInput),
        el("button", {
          class: "btn",
          text: "Apply",
          dataset: { testid: "map-shift-apply" },
          on: {
            click: () => {
              shiftMapContent(mapId, { dx: numericValue(dxInput), dy: numericValue(dyInput) });
              close();
            },
          },
        }),
      ],
    })
  );
}

function shiftInput(testId: string): HTMLInputElement {
  const input = document.createElement("input");
  input.type = "number";
  input.min = "-128";
  input.max = "128";
  input.value = "0";
  input.dataset.testid = testId;
  return input;
}

function field(label: string, input: HTMLInputElement): HTMLElement {
  return el("label", {
    class: "field",
    children: [el("span", { text: label }), input],
  });
}

function numericValue(input: HTMLInputElement): number {
  const value = Number.parseInt(input.value, 10);
  return Number.isFinite(value) ? value : 0;
}
