import type { SpatialGalleryCard } from "@/editor/panels/spatialCatalog";
import { cardSubtitle, humanizeSpatialError, spatialSourceLabel } from "@/editor/panels/spatialFeedback";
import { placeChromeState } from "@/editor/panels/spatialPlaceChromeState";
import { mutateWorkingPlace, placeDeletePreview, workingPlace, workingProject } from "@/editor/panels/spatialPlaceCommands";
import { placeDraftTarget, withPlaceKind, withPlaceLayout, withPlaceName } from "@/editor/panels/spatialPlaceDraft";
import {
  deletePlacedChild,
  openPlaceChild,
  ordinaryPlacedConnections,
  selectedPlacedChild,
  setPlacedChildLevel,
} from "@/editor/panels/spatialPlacePlaced";
import { conceptFacilityTemplateById } from "@/project/defaults/conceptFacilityTemplates";
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
  const project = workingProject();
  const body: HTMLElement[] = [];
  if (card) {
    body.push(el("h3", { class: "spatial-inspector-name", text: card.name }));
    const subtitle = cardSubtitle(card);
    if (subtitle) body.push(el("p", { class: "spatial-inspector-sub", text: subtitle }));
    body.push(el("dl", {
      class: "spatial-inspector-facts",
      children: [
        el("dt", { text: "분류" }),
        el("dd", { text: spatialSourceLabel(card) }),
        ...(card.missingSource
          ? [el("dt", { text: "원본" }), el("dd", { class: "spatial-card-badge is-missing", text: "없음" })]
          : []),
      ],
    }));
  }
  if (card && !place) {
    // 꾸러미 시설 카드 — 편집할 PlaceDesign 이 없어도 번들 사실을 보여 준다.
    const bundle = card.source === "default"
      ? conceptFacilityTemplateById(card.localId ?? card.id)
      : project.tilesets[card.tilesetId ?? ""]?.scratchConceptBundles?.find((entry) => entry.id === card.localId);
    if (bundle) {
      body.push(el("dl", {
        class: "spatial-inspector-facts",
        dataset: { testid: "spatial-place-bundle-facts" },
        children: [
          el("dt", { text: "시설" }),
          el("dd", { text: `${bundle.facilities.length}곳` }),
          el("dt", { text: "장소" }),
          el("dd", { text: `${bundle.places.length}곳` }),
        ],
      }));
      body.push(el("p", {
        class: "spatial-readonly-note",
        text: "기본 설계는 읽기 전용입니다 — 「추가」로 내 설계를 만들면 편집할 수 있습니다.",
        dataset: { testid: "spatial-readonly-note" },
      }));
    }
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
    const placedChild = target.occurrenceId ? selectedPlacedChild(project, target.occurrenceId) : undefined;
    const sourceChild = place.children.find((entry) => entry.id === placeChromeState.selectedChildId);
    if (placedChild) {
      body.push(el("p", {
        class: "spatial-inspector-sub",
        text: `${placedChild.name} ${placedChild.occurrenceId} (${placedChild.x},${placedChild.y}) L${placedChild.level} #${placedChild.slotId}:${placedChild.index}`,
        dataset: { testid: "spatial-place-child-label" },
      }));
      body.push(el("label", {
        class: "spatial-place-field",
        children: [
          el("span", { text: "층" }),
          el("input", {
            attrs: { type: "number", value: String(placedChild.level), min: place.kind === "facility" ? "1" : "0", max: "3" },
            dataset: { testid: "spatial-place-child-level" },
            on: {
              change: (event) => {
                const input = event.target;
                if (!(input instanceof HTMLInputElement) || !target.occurrenceId) return;
                setPlacedChildLevel(target.occurrenceId, placedChild, Number(input.value), place.kind);
                rerender();
              },
            },
          }),
        ],
      }));
      body.push(el("button", {
        class: "spatial-action",
        text: "자식 삭제",
        attrs: { type: "button" },
        dataset: { testid: "spatial-place-child-delete" },
        on: {
          click: () => {
            if (!target.occurrenceId) return;
            deletePlacedChild(target.occurrenceId, placedChild);
            placeChromeState.selectedChildId = null;
            rerender();
          },
        },
      }));
    } else if (sourceChild) {
      body.push(el("p", {
        class: "spatial-inspector-sub",
        text: `${sourceChild.source.kind} (${sourceChild.x},${sourceChild.y}) L${sourceChild.level}`,
        dataset: { testid: "spatial-place-child-label" },
      }));
    }
    if (placedChild || sourceChild) {
      body.push(el("button", {
        class: "spatial-open-child",
        text: "열기",
        attrs: { type: "button" },
        dataset: { testid: "spatial-open-child" },
        on: {
          click: () => {
            openPlaceChild(target, place, project);
            rerender();
          },
        },
      }));
    }
    const placedLink = target.occurrenceId
      ? ordinaryPlacedConnections(project, target.occurrenceId).find((link) => link.id === placeChromeState.selectedConnectionId)
      : undefined;
    const sourceLink = place.connections.find((entry) => entry.id === placeChromeState.selectedConnectionId);
    if (placedLink) {
      body.push(el("p", {
        class: "spatial-inspector-sub",
        text: `${placedLink.from.occurrenceId}:${placedLink.from.portId} ${placedLink.bidirectional ? "↔" : "→"} ${placedLink.to.occurrenceId}:${placedLink.to.portId}`,
        dataset: { testid: "spatial-place-link-label" },
      }));
    } else if (sourceLink) {
      body.push(el("p", {
        class: "spatial-inspector-sub",
        text: `${sourceLink.from.childId ?? "자체"} → ${sourceLink.to.childId ?? "자체"}`,
        dataset: { testid: "spatial-place-link-label" },
      }));
    }
  }
  if (placeChromeState.deleteOpen) {
    const impact = placeDeletePreview(card);
    const occurrence = impact?.occurrence;
    body.push(el("div", {
      class: "spatial-place-impact",
      dataset: { testid: "spatial-delete-impact" },
      children: occurrence
        ? [
          el("p", { text: `맵 ${new Set(occurrence.artifacts.map((entry) => entry.binding.mapId)).size}` }),
          el("p", { text: `이벤트 ${occurrence.artifacts.reduce((count, entry) => count + entry.binding.eventIds.length, 0)}` }),
          el("p", { text: `연결 ${occurrence.connections.length}` }),
          el("p", { text: `외부 ${occurrence.externalConnectionIds.length}` }),
        ]
        : [
          el("p", { text: `참조 ${impact?.strong.length ?? 0}` }),
          el("p", { text: `스냅샷 ${impact?.historical.length ?? 0}` }),
        ],
    }));
  }
  if (placeChromeState.previewError) {
    body.push(el("p", {
      class: "spatial-preview-error",
      text: humanizeSpatialError(placeChromeState.previewError) ?? placeChromeState.previewError,
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
