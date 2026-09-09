import type { SpatialAuthoringSession } from "@/editor/panels/spatialAuthoringSession";
import { placeChromeState } from "@/editor/panels/spatialPlaceChromeState";
import { commitWorkingPlace, workingProject } from "@/editor/panels/spatialPlaceCommands";
import { connectLocal, placeDraftTarget } from "@/editor/panels/spatialPlaceDraft";
import {
  ordinaryPlacedConnections,
  placedPortChoices,
  removePlacedConnection,
  submitPlacedConnection,
} from "@/editor/panels/spatialPlacePlaced";
import { newConnectionId } from "@/editor/panels/spatialPlaceQuery";
import { childSourceLabel } from "@/editor/panels/spatialPlacePreview";
import { spatialId } from "@/project/spatial/domain";
import type { PlaceDesign } from "@/project/spatial/types";
import { el } from "@/util/dom";

function option(value: string, label: string, selected: boolean): HTMLElement {
  return el("option", { text: label, attrs: { value, ...(selected ? { selected: "" } : {}) } });
}

function bindSelect(testid: string, value: string, onChange: (next: string) => void, options: readonly HTMLElement[]): HTMLElement {
  const select = el("select", {
    dataset: { testid },
    on: {
      change: (event) => {
        const node = event.target;
        if (!(node instanceof HTMLSelectElement)) return;
        onChange(node.value);
      },
    },
    children: options,
  });
  select.value = value;
  return select;
}

function sourcePortOptions(place: PlaceDesign, childId: string): readonly { readonly id: string; readonly name: string }[] {
  if (childId === "") return place.ports;
  const child = place.children.find((entry) => entry.id === childId);
  const library = workingProject().spatialAuthoring?.library;
  if (!child || !library) return [];
  return child.source.kind === "space"
    ? library.spaces[child.source.id]?.ports ?? []
    : library.places[child.source.id]?.ports ?? [];
}

function renderSourceLinkActions(place: PlaceDesign, target: ReturnType<typeof placeDraftTarget>, rerender: () => void): HTMLElement {
  const selected = place.connections.find((link) => link.id === placeChromeState.selectedConnectionId);
  if (selected && !placeChromeState.connectFromId) {
    placeChromeState.connectFromId = selected.from.childId ?? "";
    placeChromeState.connectFromPort = selected.from.portId;
    placeChromeState.connectToId = selected.to.childId ?? "";
    placeChromeState.connectToPort = selected.to.portId;
    placeChromeState.connectBidirectional = selected.bidirectional;
  }
  const children = [
    { id: "", name: "자체" },
    ...place.children.map((child) => ({
      id: child.id,
      name: childSourceLabel(workingProject(), child.source.kind, child.source.id),
    })),
  ];
  return el("div", {
    class: "spatial-place-link-actions",
    dataset: { testid: "spatial-place-link-actions" },
    children: [
      bindSelect("spatial-place-connect-from", placeChromeState.connectFromId, (value) => {
        placeChromeState.connectFromId = value;
        rerender();
      }, children.map((child) => option(child.id, child.name, child.id === placeChromeState.connectFromId))),
      bindSelect("spatial-place-connect-from-port", placeChromeState.connectFromPort, (value) => {
        placeChromeState.connectFromPort = value;
        rerender();
      }, sourcePortOptions(place, placeChromeState.connectFromId).map((port) => option(port.id, port.name, port.id === placeChromeState.connectFromPort))),
      bindSelect("spatial-place-connect-to", placeChromeState.connectToId, (value) => {
        placeChromeState.connectToId = value;
        rerender();
      }, children.map((child) => option(child.id, child.name, child.id === placeChromeState.connectToId))),
      bindSelect("spatial-place-connect-to-port", placeChromeState.connectToPort, (value) => {
        placeChromeState.connectToPort = value;
        rerender();
      }, sourcePortOptions(place, placeChromeState.connectToId).map((port) => option(port.id, port.name, port.id === placeChromeState.connectToPort))),
      el("button", {
        class: "spatial-action",
        text: selected ? "다시 연결" : "층 연결",
        attrs: { type: "button" },
        dataset: { testid: "spatial-place-connect" },
        on: {
          click: () => {
            commitWorkingPlace(target, connectLocal(place, {
              id: selected?.id ?? newConnectionId(),
              from: {
                childId: placeChromeState.connectFromId ? spatialId(placeChromeState.connectFromId) : null,
                portId: spatialId(placeChromeState.connectFromPort),
              },
              to: {
                childId: placeChromeState.connectToId ? spatialId(placeChromeState.connectToId) : null,
                portId: spatialId(placeChromeState.connectToPort),
              },
              bidirectional: placeChromeState.connectBidirectional,
            }));
            rerender();
          },
        },
      }),
    ],
  });
}

export function renderPlaceLinkActions(
  place: PlaceDesign,
  target: ReturnType<typeof placeDraftTarget>,
  session: SpatialAuthoringSession,
  rerender: () => void,
): HTMLElement {
  if (session.mode !== "instances" || !target.occurrenceId) {
    return renderSourceLinkActions(place, target, rerender);
  }
  const parentId = target.occurrenceId;
  const project = workingProject();
  const choices = placedPortChoices(project, parentId);
  const selected = ordinaryPlacedConnections(project, parentId).find((link) => link.id === placeChromeState.selectedConnectionId);
  if (selected) {
    const from = choices.find((choice) => choice.portId === selected.from.portId && choice.occurrenceId === selected.from.occurrenceId);
    const to = choices.find((choice) => choice.portId === selected.to.portId && choice.occurrenceId === selected.to.occurrenceId);
    if (from && !placeChromeState.connectFromId) {
      placeChromeState.connectFromId = from.occurrenceId;
      placeChromeState.connectFromPort = from.localPortId;
      placeChromeState.connectBidirectional = selected.bidirectional;
    }
    if (to && !placeChromeState.connectToId) {
      placeChromeState.connectToId = to.occurrenceId;
      placeChromeState.connectToPort = to.localPortId;
    }
  }
  const occurrenceOptions = [...new Map(choices.map((choice) => [choice.occurrenceId, choice.label.split(" / ")[0] ?? choice.occurrenceId])).entries()];
  const allPorts = [...new Map(choices.map((choice) => [choice.localPortId, choice])).values()];
  return el("div", {
    class: "spatial-place-link-actions",
    dataset: { testid: "spatial-place-link-actions" },
    children: [
      bindSelect("spatial-place-connect-from", placeChromeState.connectFromId, (value) => {
        placeChromeState.connectFromId = value;
      }, occurrenceOptions.map(([id, label]) => option(id, label, id === placeChromeState.connectFromId))),
      bindSelect("spatial-place-connect-from-port", placeChromeState.connectFromPort, (value) => {
        placeChromeState.connectFromPort = value;
      }, allPorts.map((port) => option(port.localPortId, port.name, port.localPortId === placeChromeState.connectFromPort))),
      bindSelect("spatial-place-connect-to", placeChromeState.connectToId, (value) => {
        placeChromeState.connectToId = value;
      }, occurrenceOptions.map(([id, label]) => option(id, label, id === placeChromeState.connectToId))),
      bindSelect("spatial-place-connect-to-port", placeChromeState.connectToPort, (value) => {
        placeChromeState.connectToPort = value;
      }, allPorts.map((port) => option(port.localPortId, port.name, port.localPortId === placeChromeState.connectToPort))),
      el("label", {
        class: "spatial-place-field",
        children: [
          el("span", { text: "양방향" }),
          el("input", {
            attrs: { type: "checkbox", ...(placeChromeState.connectBidirectional ? { checked: "" } : {}) },
            dataset: { testid: "spatial-place-connect-bidirectional" },
            on: {
              change: (event) => {
                const input = event.target;
                if (!(input instanceof HTMLInputElement)) return;
                placeChromeState.connectBidirectional = input.checked;
              },
            },
          }),
        ],
      }),
      el("button", {
        class: "spatial-action",
        text: selected ? "다시 연결" : "층 연결",
        attrs: { type: "button" },
        dataset: { testid: "spatial-place-connect" },
        on: { click: () => { submitPlacedConnection(workingProject(), parentId); rerender(); } },
      }),
      el("button", {
        class: "spatial-action",
        text: "연결 해제",
        attrs: { type: "button", ...(selected ? {} : { disabled: "" }) },
        dataset: { testid: "spatial-place-disconnect" },
        on: {
          click: () => {
            if (!selected) return;
            removePlacedConnection(parentId, selected.id);
            placeChromeState.selectedConnectionId = null;
            rerender();
          },
        },
      }),
    ],
  });
}
