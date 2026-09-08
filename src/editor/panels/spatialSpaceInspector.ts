import type { SpatialGalleryCard } from "@/editor/panels/spatialCatalog";
import { spaceChromeState } from "@/editor/panels/spatialSpaceChromeState";
import { mutateWorkingSpace, spaceDeletePreview, workingSpace } from "@/editor/panels/spatialSpaceCommands";
import {
  setSlotChips,
  setSlotRequired,
  spaceDraftTarget,
  withEnvironment,
  withShape,
  withSize,
} from "@/editor/panels/spatialSpaceDraft";
import type { SpaceDesign } from "@/project/spatial/types";
import { el } from "@/util/dom";

const SHAPES: readonly SpaceDesign["shape"][] = ["rect", "l", "alcove"];

export function renderSpatialSpacesInspector(
  card: SpatialGalleryCard | undefined,
  open: boolean,
  rerender: () => void,
): HTMLElement {
  const space = workingSpace(card);
  const target = card ? spaceDraftTarget(card) : undefined;
  const body: HTMLElement[] = [];
  if (card) {
    body.push(el("h3", { class: "spatial-inspector-name", text: card.name }));
    if (card.subtitle) body.push(el("p", { class: "spatial-inspector-sub", text: card.subtitle }));
    body.push(el("dl", {
      class: "spatial-inspector-facts",
      children: [
        el("dt", { text: "원본" }),
        el("dd", { text: card.source === "default" ? "기본 설계" : card.source === "own" ? "내 설계" : "배치" }),
        ...(card.missingSource
          ? [el("dt", { text: "원본" }), el("dd", { class: "spatial-card-badge is-missing", text: "없음" })]
          : []),
      ],
    }));
  }
  if (space && target) {
    body.push(shapeControls(space, target, rerender));
    body.push(sizeControls(space, target, rerender));
    body.push(environmentControls(space, target, rerender));
    const slot = space.objectSlots.find((entry) => entry.id === spaceChromeState.selectedSlotId);
    if (slot) {
      body.push(el("label", {
        class: "spatial-space-field",
        children: [
          el("span", { text: "필수" }),
          el("input", {
            attrs: { type: "checkbox", ...(slot.required ? { checked: "" } : {}) },
            dataset: { testid: "spatial-slot-required" },
            on: {
              change: (event) => {
                const box = event.target;
                if (!(box instanceof HTMLInputElement)) return;
                mutateWorkingSpace(target, (current) => setSlotRequired(current, slot.id, box.checked));
                rerender();
              },
            },
          }),
        ],
      }));
      body.push(el("label", {
        class: "spatial-space-field",
        children: [
          el("span", { text: "칩" }),
          el("input", {
            attrs: { type: "text", value: (slot.chipOverrides ?? []).join(",") },
            dataset: { testid: "spatial-slot-chips" },
            on: {
              change: (event) => {
                const input = event.target;
                if (!(input instanceof HTMLInputElement)) return;
                const chips = input.value.split(",").map((part) => part.trim()).filter(Boolean);
                mutateWorkingSpace(target, (current) => setSlotChips(current, slot.id, chips));
                rerender();
              },
            },
          }),
        ],
      }));
    }
    const port = space.ports.find((entry) => entry.id === spaceChromeState.selectedPortId);
    if (port) {
      body.push(el("p", {
        class: "spatial-inspector-sub",
        text: `${port.name} (${port.x},${port.y})`,
        dataset: { testid: "spatial-port-label" },
      }));
    }
  }
  if (spaceChromeState.deleteOpen) {
    const impact = spaceDeletePreview(card);
    body.push(el("div", {
      class: "spatial-space-impact",
      dataset: { testid: "spatial-delete-impact" },
      children: [
        el("p", { text: `참조 ${impact?.strong.length ?? 0}` }),
        el("p", { text: `스냅샷 ${impact?.historical.length ?? 0}` }),
      ],
    }));
  }
  return el("aside", {
    class: `spatial-inspector${open ? " is-open" : ""}`,
    attrs: { "aria-label": "속성", id: "spatial-inspector" },
    dataset: { testid: "spatial-inspector" },
    children: body,
  });
}

function shapeControls(space: SpaceDesign, target: ReturnType<typeof spaceDraftTarget>, rerender: () => void): HTMLElement {
  return el("div", {
    class: "spatial-space-shapes",
    children: SHAPES.map((shape) => el("button", {
      class: `spatial-source-chip${space.shape === shape ? " is-active" : ""}`,
      text: shape,
      attrs: { type: "button", "aria-pressed": String(space.shape === shape) },
      dataset: { testid: `spatial-shape-${shape}` },
      on: {
        click: () => {
          mutateWorkingSpace(target, (current) => withShape(current, shape));
          rerender();
        },
      },
    })),
  });
}

function sizeControls(space: SpaceDesign, target: ReturnType<typeof spaceDraftTarget>, rerender: () => void): HTMLElement {
  const commit = (which: "width" | "height", raw: string): void => {
    const value = Number(raw);
    if (!Number.isFinite(value)) return;
    mutateWorkingSpace(target, (current) => withSize(
      current,
      which === "width" ? value : current.width,
      which === "height" ? value : current.height,
    ));
    rerender();
  };
  return el("div", {
    class: "spatial-space-size",
    children: [
      el("label", {
        class: "spatial-space-field",
        children: [
          el("span", { text: "너비" }),
          el("input", {
            attrs: { type: "number", min: "1", value: String(space.width) },
            dataset: { testid: "spatial-space-width" },
            on: { change: (event) => {
              const input = event.target;
              if (input instanceof HTMLInputElement) commit("width", input.value);
            } },
          }),
        ],
      }),
      el("label", {
        class: "spatial-space-field",
        children: [
          el("span", { text: "높이" }),
          el("input", {
            attrs: { type: "number", min: "1", value: String(space.height) },
            dataset: { testid: "spatial-space-height" },
            on: { change: (event) => {
              const input = event.target;
              if (input instanceof HTMLInputElement) commit("height", input.value);
            } },
          }),
        ],
      }),
    ],
  });
}

function environmentControls(space: SpaceDesign, target: ReturnType<typeof spaceDraftTarget>, rerender: () => void): HTMLElement {
  return el("div", {
    class: "spatial-space-env-edit",
    children: (["interior", "outdoor"] as const).map((environment) => el("button", {
      class: `spatial-source-chip${space.environment === environment ? " is-active" : ""}`,
      text: environment === "interior" ? "실내" : "실외",
      attrs: { type: "button" },
      dataset: { testid: `spatial-space-env-${environment}` },
      on: {
        click: () => {
          mutateWorkingSpace(target, (current) => withEnvironment(current, environment));
          rerender();
        },
      },
    })),
  });
}
