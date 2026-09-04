import { store } from "@/project/store";
import type { Project } from "@/project/types";
import type { WorldRef } from "@/project/world/types";
import { clearChildren, el } from "@/util/dom";
import {
  type WorldPanelOptions,
  type WorldPanelState,
  currentWorld,
  ensureSelectedEntity,
  jumpToWorldRefTarget,
  summarizeWorldLint,
} from "./worldManager";
import { renderHeader, renderMain } from "./worldPanelViews";

/** 톱바·도구 메뉴·단축키의 세계관 입구. 자료집 「이 세계」 탭으로 점프한다. */
export function openWorldPanel(): void {
  void import("./databaseModal").then(({ openDatabaseModal }) => {
    openDatabaseModal("worldCanon");
  });
}

/** 설정집(낱장 카드) 입구. 자료집 「설정집」 탭으로 점프한다. */
export function openWorldCodexPanel(): void {
  void import("./databaseModal").then(({ openDatabaseModal }) => {
    openDatabaseModal("worldCodex");
  });
}

export function renderWorldPanel(options: WorldPanelOptions = {}): HTMLElement {
  const state: WorldPanelState = {
    tab: options.initialTab ?? "overview",
    search: "",
    selectedId: options.initialEntityId ?? null,
    addType: "character",
    editDraft: null,
    editError: "",
  };
  const root = el("section", {
    class: options.embedded ? "world-panel world-panel-embedded" : "world-panel",
    attrs: { role: options.embedded ? "region" : "dialog", "aria-label": "설정집" },
    dataset: { testid: "world-panel" },
  });

  const refresh = (): void => {
    const project = store.getCurrent();
    const world = currentWorld(project);
    const lint = summarizeWorldLint(world, project);
    ensureSelectedEntity(state, world);
    clearChildren(root);
    root.append(renderHeader(state, refresh, options), renderMain(state, world, project, lint, refresh));
  };

  refresh();
  return root;
}

export function jumpToWorldRef(ref: WorldRef, project: Project = store.getCurrent()): boolean {
  return jumpToWorldRefTarget(ref, project);
}
