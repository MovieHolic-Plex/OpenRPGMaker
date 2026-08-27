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
  const selectedActionIndex = options.selectedActionIndex ?? 0;
  const panel = el("section", {
    class: "status-menu-detail",
    attrs: { tabindex: "-1" },
    dataset: { testid: "status-menu-detail" },
  });
  if (detail.tabs?.length) panel.classList.add("life-ledger-detail");
  panel.append(el("h2", {
    class: "status-menu-detail-title",
    text: detail.title,
    dataset: { testid: "status-menu-detail-title" },
  }));
  if (detail.artwork) {
    panel.append(el("figure", {
      class: "life-ledger-artwork",
      children: [el("img", {
        attrs: { src: detail.artwork.src, alt: detail.artwork.alt },
        dataset: { testid: "life-ledger-artwork" },
      })],
    }));
  }
  let enabledActionIndex = 0;
  if (detail.tabs?.length) {
    const tabs = el("div", {
      class: "life-ledger-tabs",
      attrs: { role: "tablist", "aria-label": "생활 장부 분류" },
    });
    for (const tab of detail.tabs) {
      const actionIndex = tab.onActivate ? enabledActionIndex : undefined;
      const button = el("button", {
        class: "life-ledger-tab status-menu-detail-action",
        text: tab.label,
        attrs: {
          type: "button",
          role: "tab",
          "aria-selected": String(tab.selected),
          "aria-controls": "life-ledger-tab-panel",
        },
        dataset: {
          testid: tab.testId,
          ...(actionIndex === undefined ? {} : { actionIndex: String(actionIndex) }),
        },
        ...(tab.onActivate ? { on: { click: tab.onActivate } } : {}),
      });
      if (tab.selected) button.classList.add("active");
      if (actionIndex === options.selectedActionIndex) button.classList.add("selected");
      tabs.append(button);
      if (actionIndex !== undefined) enabledActionIndex += 1;
    }
    panel.append(tabs);
  }
  if (detail.entries.length === 0) {
    panel.append(el("div", {
      class: "status-menu-detail-empty",
      text: detail.emptyLabel ?? detail.hint ?? "",
      attrs: { id: "life-ledger-tab-panel", role: detail.tabs ? "tabpanel" : "status" },
    }));
    if (detail.hint) panel.append(el("div", { class: "status-menu-detail-hint", text: detail.hint }));
    return panel;
  }
  const interactiveList = detail.entries.some((entry) => Boolean(entry.onActivate));
  const list = el("div", {
    class: "status-menu-detail-list",
    attrs: {
      id: "life-ledger-tab-panel",
      role: detail.tabs ? "tabpanel" : interactiveList ? "menu" : "list",
      tabindex: "0",
    },
  });
  for (const entry of detail.entries) {
    const actionIndex = entry.onActivate && !entry.disabled ? enabledActionIndex : undefined;
    const row = renderDetailEntry({
      project,
      entry,
      selected: actionIndex === selectedActionIndex,
      actionIndex,
      informationalList: !interactiveList,
    });
    list.append(row);
    if (actionIndex === selectedActionIndex) {
      list.setAttribute("aria-activedescendant", detailEntryId(entry, actionIndex));
    }
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
  readonly informationalList: boolean;
}): HTMLElement {
  const { project, entry, selected, actionIndex, informationalList } = options;
  // 조작 가능한 행(아이템/스킬/장비 후보)의 설명은 푸터가 대신 보여준다 → 행을 1줄로 압축해
  // 리스트가 잘린 글자로 끝나는 문제를 없앤다. 정보성 행(상태 화면 등)은 설명을 그대로 붙인다
  // — 그쪽은 푸터로 옮길 대상이 여러 개 동시에 필요해서 대체가 안 된다.
  const inlineDescription = Boolean(entry.description) && !entry.onActivate;
  const rowClasses = [
    "status-menu-detail-row",
    inlineDescription ? "has-description" : "",
    entry.onActivate ? "status-menu-detail-row-compact" : "",
    entry.disabled ? "disabled" : "",
    entry.destructive ? "destructive" : "",
  ].filter(Boolean).join(" ");
  const row = entry.onActivate
    ? el("button", {
        class: `${rowClasses} status-menu-detail-action`,
        attrs: {
          id: detailEntryId(entry, actionIndex),
          type: "button",
          role: "menuitem",
          tabindex: selected ? "0" : "-1",
          "aria-current": selected ? "true" : "false",
          "aria-label": [entry.label, entry.description].filter(Boolean).join(" — "),
          ...(entry.disabled ? { disabled: "true", "aria-disabled": "true" } : {}),
        },
        dataset: detailEntryDataset(entry, actionIndex),
        on: { click: entry.onActivate },
      })
    : el("div", {
        class: rowClasses,
        attrs: informationalList ? { role: "listitem" } : undefined,
        ...(entry.testId ? { dataset: { testid: entry.testId } } : {}),
      });
  if (selected) row.classList.add("selected");
  if (entry.icon) {
    row.append(renderDetailEntryIcon(project, entry.icon), renderDetailText(entry));
    return row;
  }
  if (entry.face) {
    row.classList.add("with-face");
    row.append(renderDetailFace(project, entry.face), renderDetailText(entry));
    return row;
  }
  row.append(...renderDetailTextChildren(entry));
  return row;
}

function detailEntryId(entry: StatusMenuDetailEntry, actionIndex?: number): string {
  return entry.testId ?? `status-menu-detail-action-${actionIndex ?? "disabled"}`;
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

function renderDetailEntryIcon(project: Project, icon: NonNullable<StatusMenuDetailEntry["icon"]>): HTMLElement {
  const url = resolveAssetResourceUrl(icon.resourceId, { project });
  if (!url) {
    return el("span", {
      class: "status-menu-entry-icon missing",
      attrs: { role: "img", "aria-label": `${icon.alt} missing` },
      dataset: { testid: icon.testId },
    });
  }
  return el("span", {
    class: "status-menu-entry-icon",
    attrs: {
      role: "img",
      "aria-label": icon.alt,
      style: [
        `background-image:url("${url}")`,
        "background-size:contain",
        "background-repeat:no-repeat",
        "background-position:center",
        "image-rendering:pixelated",
      ].join(";"),
    },
    dataset: { testid: icon.testId },
  });
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
  // 얼굴은 낱장 파일 한 장이다 — 32px 상자에 그대로 맞춘다(시트 크롭 없음).
  return el("span", {
    class: "status-menu-detail-face",
    attrs: {
      role: "img",
      "aria-label": face.alt,
      style: [
        `background-image:url("${url}")`,
        "background-size:32px 32px",
        "background-repeat:no-repeat",
        "image-rendering:pixelated",
        "width:32px",
        "height:32px",
      ].join(";"),
    },
    dataset: { testid: face.testId },
  });
}
