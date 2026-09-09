import type { GeographyView } from "@/editor/panels/spatialGeographyCanvas";
import { geographyChromeState } from "@/editor/panels/spatialGeographyChromeState";
import {
  geographyDeletePreview,
  mutateWorkingGeography,
  workingGeography,
  workingProject,
} from "@/editor/panels/spatialGeographyCommands";
import { geographyDraftTarget, withGeographyName } from "@/editor/panels/spatialGeographyDraft";
import { worldCrossingPoints } from "@/editor/panels/spatialGeographyGeometry";
import { geographyViewChildren } from "@/editor/panels/spatialGeographyQuery";
import { openSelectedChild } from "@/editor/panels/spatialGeographyNavigate";
import { el } from "@/util/dom";

export function renderSpatialGeographyInspector(view: GeographyView, rerender: () => void): HTMLElement {
  const { session, card, kind } = view;
  const design = workingGeography(card, kind);
  const target = card ? geographyDraftTarget(card, kind) : undefined;
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
  if (design && target) {
    body.push(el("label", {
      class: "spatial-geography-field",
      children: [
        el("span", { text: "이름" }),
        el("input", {
          attrs: { type: "text", value: design.name },
          dataset: { testid: "spatial-name" },
          on: {
            change: (event) => {
              const input = event.target;
              if (!(input instanceof HTMLInputElement)) return;
              mutateWorkingGeography(target, (current) => withGeographyName(current, input.value));
              rerender();
            },
          },
        }),
      ],
    }));
    body.push(el("p", {
      class: "spatial-inspector-sub",
      text: `${design.terrain.width}×${design.terrain.height} · ${design.terrain.floor}`,
      dataset: { testid: "spatial-geography-size" },
    }));
    const child = geographyViewChildren(workingProject(), design, target.occurrenceId).find((entry) => entry.id === geographyChromeState.selectedChildId);
    if (child) {
      body.push(el("p", {
        class: "spatial-inspector-sub",
        text: `개요 (${child.x},${child.y})`,
        dataset: { testid: "spatial-geography-child-frame", frame: "overview" },
      }));
      body.push(el("button", {
        class: "spatial-open-child",
        text: "열기",
        attrs: { type: "button" },
        dataset: { testid: "spatial-open-child" },
        on: { click: () => openSelectedChild(session, design, rerender) },
      }));
    }
    if ("places" in design) {
      const route = design.routes.find((entry) => entry.id === geographyChromeState.selectedRouteId) ?? design.routes[0];
      if (route) {
        body.push(el("p", {
          class: "spatial-inspector-sub",
          text: route.points.map((point) => `${point.x},${point.y}`).join(" → "),
          dataset: { testid: "spatial-geography-route-label" },
        }));
      }
    } else {
      const link = design.connections[0];
      const kids = geographyViewChildren(workingProject(), design, target.occurrenceId);
      const from = link?.from.childId ? kids.find((entry) => entry.id === link.from.childId) : undefined;
      const to = link?.to.childId ? kids.find((entry) => entry.id === link.to.childId) : undefined;
      if (from && to) {
        body.push(el("p", {
          class: "spatial-inspector-sub",
          text: worldCrossingPoints(from, to).map((point) => `${point.x},${point.y}`).join(" → "),
          dataset: { testid: "spatial-geography-crossing-label" },
        }));
      }
      body.push(el("p", {
        class: "spatial-inspector-sub",
        text: `진입 ${design.entryPort.childId ?? "자체"}`,
        dataset: { testid: "spatial-geography-entry" },
      }));
    }
  }
  if (geographyChromeState.deleteOpen) {
    const impact = geographyDeletePreview(card, kind);
    body.push(el("div", {
      class: "spatial-geography-impact",
      dataset: { testid: "spatial-delete-impact" },
      children: [
        el("p", { text: `참조 ${impact?.strong.length ?? 0}` }),
        el("p", { text: `스냅샷 ${impact?.historical.length ?? 0}` }),
      ],
    }));
  }
  if (geographyChromeState.previewError) {
    body.push(el("p", {
      class: "spatial-preview-error",
      text: geographyChromeState.previewError,
      dataset: { testid: "spatial-preview-error" },
    }));
  }
  return el("aside", {
    class: `spatial-inspector${session.inspectorOpen ? " is-open" : ""}`,
    attrs: { "aria-label": "속성", id: "spatial-inspector" },
    dataset: { testid: "spatial-inspector" },
    children: body,
  });
}
