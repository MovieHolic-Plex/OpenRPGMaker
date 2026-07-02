import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import type { StatusMenuDetail, StatusMenuDetailEntry } from "@/player/playerStatusMenuDetails";
import type { Project } from "@/project/types";
import { el } from "@/util/dom";

export type StatusMenuDetailPanelOptions = {
  readonly selectedActionIndex?: number;
};

export function renderStatusMenuDetailPanel(
  project: Project,
  detail: StatusMenuDetail,
  options: StatusMenuDetailPanelOptions = {}
): HTMLElement {
  const panel = el("section", {
    class: "status-menu-detail",
    dataset: { testid: "status-menu-detail" },
  });
  panel.append(el("h2", {
    class: "status-menu-detail-title",
    text: detail.title,
    dataset: { testid: "status-menu-detail-title" },
  }));
  if (detail.entries.length === 0) {
    panel.append(el("div", {
      class: "status-menu-detail-empty",
      text: detail.emptyLabel ?? detail.hint ?? "",
    }));
    return panel;
  }
  const list = el("div", { class: "status-menu-detail-list" });
  let enabledActionIndex = 0;
  for (const entry of detail.entries) {
    const actionIndex = entry.onActivate && !entry.disabled ? enabledActionIndex : undefined;
    list.append(renderDetailEntry({
      project,
      entry,
      selected: actionIndex === options.selectedActionIndex,
      actionIndex,
    }));
    if (actionIndex !== undefined) enabledActionIndex += 1;
  }
  panel.append(list);
  if (detail.hint) panel.append(el("div", { class: "status-menu-detail-hint", text: detail.hint }));
  return panel;
}

function renderDetailEntry(options: {
  readonly project: Project;
  readonly entry: StatusMenuDetailEntry;
  readonly selected: boolean;
  readonly actionIndex?: number;
}): HTMLElement {
  const { project, entry, selected, actionIndex } = options;
  const row = entry.onActivate
    ? el("button", {
        class: "status-menu-detail-row status-menu-detail-action",
        attrs: { type: "button", ...(entry.disabled ? { disabled: "true", "aria-disabled": "true" } : {}) },
        dataset: detailEntryDataset(entry, actionIndex),
        on: { click: entry.onActivate },
      })
    : el("div", {
        class: "status-menu-detail-row",
        ...(entry.testId ? { dataset: { testid: entry.testId } } : {}),
      });
  if (selected) row.classList.add("selected");
  if (entry.face) {
    row.classList.add("with-face");
    row.append(renderDetailFace(project, entry.face), renderDetailText(entry));
    return row;
  }
  row.append(...renderDetailTextChildren(entry));
  return row;
}

function detailEntryDataset(entry: StatusMenuDetailEntry, actionIndex?: number): Record<string, string> | undefined {
  if (!entry.testId && actionIndex === undefined) return undefined;
  return {
    ...(entry.testId ? { testid: entry.testId } : {}),
    ...(actionIndex === undefined ? {} : { actionIndex: String(actionIndex) }),
  };
}

function renderDetailText(entry: StatusMenuDetailEntry): HTMLElement {
  return el("span", {
    class: "status-menu-detail-copy",
    children: renderDetailTextChildren(entry),
  });
}

function renderDetailTextChildren(entry: StatusMenuDetailEntry): HTMLElement[] {
  const children = [
    el("span", { class: "status-menu-detail-label", text: entry.label }),
    el("span", { class: "status-menu-detail-value", text: entry.value }),
  ];
  if (entry.description) children.push(el("span", { class: "status-menu-detail-description", text: entry.description }));
  return children;
}

function renderDetailFace(project: Project, face: NonNullable<StatusMenuDetailEntry["face"]>): HTMLElement {
  const url = resolveAssetResourceUrl(face.resourceId, { project });
  if (!url) {
    return el("span", {
      class: "status-menu-detail-face missing",
      text: "Face",
      attrs: { role: "img", "aria-label": `${face.alt} missing` },
      dataset: { testid: face.testId },
    });
  }
  return el("span", {
    class: "status-menu-detail-face actor-sheet-crop",
    attrs: {
      role: "img",
      "aria-label": face.alt,
      style: [
        `--crop-url:url("${url}")`,
        "--crop-width:32px",
        "--crop-height:32px",
        "--crop-sheet-width:128px",
        "--crop-sheet-height:128px",
        "--crop-x:0px",
        "--crop-y:0px",
      ].join(";"),
    },
    dataset: { testid: face.testId },
  });
}
