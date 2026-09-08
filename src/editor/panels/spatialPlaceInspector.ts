import type { SpatialGalleryCard } from "@/editor/panels/spatialCatalog";
import { placeChromeState } from "@/editor/panels/spatialPlaceChromeState";
import { mutateWorkingPlace, placeDeletePreview, workingPlace } from "@/editor/panels/spatialPlaceCommands";
import { placeDraftTarget, withPlaceKind, withPlaceLayout, withPlaceName } from "@/editor/panels/spatialPlaceDraft";
import type { PlaceDesign } from "@/project/spatial/types";
import { el } from "@/util/dom";

const KINDS: readonly PlaceDesign["kind"][] = ["facility", "settlement", "natural"];
const LAYOUTS: readonly PlaceDesign["layout"][] = ["row", "double-row", "manual"];

const KIND_LABEL = {
  facility: "시설",
  settlement: "정착지",
  natural: "자연",
} as const;

const LAYOUT_LABEL = {
  row: "한 줄",
  "double-row": "두 줄",
  manual: "직접",
} as const;

export function renderSpatialPlacesInspector(
  card: SpatialGalleryCard | undefined,
  open: boolean,
  rerender: () => void,
): HTMLElement {
  const place = workingPlace(card);
  const target = card ? placeDraftTarget(card) : undefined;
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
  if (place && target) {
    body.push(el("label", {
      class: "spatial-place-field",
      children: [
        el("span", { text: "이름" }),
        el("input", {
          attrs: { type: "text", value: place.name },
          dataset: { testid: "spatial-place-name" },
          on: {
            change: (event) => {
              const input = event.target;
              if (!(input instanceof HTMLInputElement)) return;
              mutateWorkingPlace(target, (current) => withPlaceName(current, input.value));
              rerender();
            },
          },
        }),
      ],
    }));
    body.push(chipRow({
      label: "종류",
      testid: "spatial-place-kind",
      values: KINDS,
      current: place.kind,
      titles: KIND_LABEL,
      onPick: (kind) => {
        mutateWorkingPlace(target, (current) => withPlaceKind(current, kind));
        rerender();
      },
    }));
    body.push(chipRow({
      label: "배치",
      testid: "spatial-place-layout",
      values: LAYOUTS,
      current: place.layout,
      titles: LAYOUT_LABEL,
      onPick: (layout) => {
        mutateWorkingPlace(target, (current) => withPlaceLayout(current, layout));
        rerender();
      },
    }));
    const child = place.children.find((entry) => entry.id === placeChromeState.selectedChildId);
    if (child) {
      body.push(el("p", {
        class: "spatial-inspector-sub",
        text: `${child.source.kind} (${child.x},${child.y}) L${child.level}`,
        dataset: { testid: "spatial-place-child-label" },
      }));
    }
    const link = place.connections.find((entry) => entry.id === placeChromeState.selectedConnectionId);
    if (link) {
      body.push(el("p", {
        class: "spatial-inspector-sub",
        text: `${link.from.childId ?? "자체"} → ${link.to.childId ?? "자체"}`,
        dataset: { testid: "spatial-place-link-label" },
      }));
    }
  }
  if (placeChromeState.deleteOpen) {
    const impact = placeDeletePreview(card);
    body.push(el("div", {
      class: "spatial-place-impact",
      dataset: { testid: "spatial-delete-impact" },
      children: [
        el("p", { text: `참조 ${impact?.strong.length ?? 0}` }),
        el("p", { text: `스냅샷 ${impact?.historical.length ?? 0}` }),
      ],
    }));
  }
  if (placeChromeState.previewError) {
    body.push(el("p", {
      class: "spatial-preview-error",
      text: placeChromeState.previewError,
      dataset: { testid: "spatial-place-status" },
    }));
  }
  return el("aside", {
    class: `spatial-inspector${open ? " is-open" : ""}`,
    attrs: { "aria-label": "속성", id: "spatial-inspector" },
    dataset: { testid: "spatial-inspector" },
    children: body,
  });
}

function chipRow<T extends string>(model: {
  readonly label: string;
  readonly testid: string;
  readonly values: readonly T[];
  readonly current: T;
  readonly titles: Readonly<Record<T, string>>;
  readonly onPick: (value: T) => void;
}): HTMLElement {
  return el("div", {
    class: "spatial-place-chips",
    dataset: { testid: model.testid },
    children: [
      el("span", { class: "spatial-place-field-label", text: model.label }),
      ...model.values.map((value) => el("button", {
        class: `spatial-source-chip${model.current === value ? " is-active" : ""}`,
        text: model.titles[value],
        attrs: { type: "button", "aria-pressed": String(model.current === value) },
        dataset: { testid: `${model.testid}-${value}` },
        on: { click: () => model.onPick(value) },
      })),
    ],
  });
}
