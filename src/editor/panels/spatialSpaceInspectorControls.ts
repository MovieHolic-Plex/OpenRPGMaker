import { mutateWorkingSpace } from "@/editor/panels/spatialSpaceCommands";
import { withEnvironment, withShape, withSize, type SpaceDraftTarget } from "@/editor/panels/spatialSpaceDraft";
import type { SpaceDesign } from "@/project/spatial/types";
import { el } from "@/util/dom";

const SHAPES: readonly SpaceDesign["shape"][] = ["rect", "l", "alcove", "l-right", "bay", "notch", "cross"];

export function spaceShapeControls(space: SpaceDesign, target: SpaceDraftTarget, rerender: () => void): HTMLElement {
  if (space.environment === "interior" && space.interiorLayout) return el("p", {
    text: `${space.interiorLayout.rooms.length}개 방의 외곽을 합친 구조입니다.`,
    dataset: { testid: "spatial-composed-footprint" },
  });
  return el("div", {
    class: "spatial-space-shapes",
    children: SHAPES.map((shape) => el("button", {
      class: `spatial-source-chip${space.shape === shape ? " is-active" : ""}`,
      text: ({ rect: "직사각형", l: "L자", alcove: "북쪽 알코브", "l-right": "반대 ㄱ자", bay: "남쪽 돌출방", notch: "벽 돌출 홈", cross: "십자형 방" })[shape],
      attrs: { type: "button", "aria-pressed": String(space.shape === shape) },
      dataset: { testid: `spatial-shape-${shape}` },
      on: { click: () => { mutateWorkingSpace(target, (current) => withShape(current, shape)); rerender(); } },
    })),
  });
}

export function spaceSizeControls(space: SpaceDesign, target: SpaceDraftTarget, rerender: () => void): HTMLElement {
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

export function spaceEnvironmentControls(space: SpaceDesign, target: SpaceDraftTarget, rerender: () => void): HTMLElement {
  return el("div", {
    class: "spatial-space-env-edit",
    children: (["interior", "outdoor"] as const).map((environment) => el("button", {
      class: `spatial-source-chip${space.environment === environment ? " is-active" : ""}`,
      text: environment === "interior" ? "실내" : "실외",
      attrs: { type: "button" },
      dataset: { testid: `spatial-space-env-${environment}` },
      on: { click: () => { mutateWorkingSpace(target, (current) => withEnvironment(current, environment)); rerender(); } },
    })),
  });
}
