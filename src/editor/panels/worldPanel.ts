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

export function openWorldPanel(): HTMLElement {
  document.querySelector("[data-testid='world-panel-modal']")?.remove();

  let closed = false;
  const backdrop = el("div", {
    class: "database-modal-backdrop world-panel-backdrop",
    attrs: { role: "presentation" },
    dataset: { testid: "world-panel-modal" },
  });
  const close = (): void => {
    if (closed) return;
    closed = true;
    backdrop.remove();
    document.removeEventListener("keydown", onKeyDown);
  };
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") close();
  };

  const panel = renderWorldPanel({ onClose: close });
  backdrop.append(panel);
  backdrop.addEventListener("mousedown", (event) => {
    if (event.target === backdrop) close();
  });
  document.addEventListener("keydown", onKeyDown);
  document.body.append(backdrop);
  panel.querySelector<HTMLElement>("[data-testid='world-search']")?.focus();
  return panel;
}

export function renderWorldPanel(options: WorldPanelOptions = {}): HTMLElement {
  const state: WorldPanelState = {
    tab: "overview",
    search: "",
    selectedId: options.initialEntityId ?? null,
    addType: "character",
    editDraft: null,
    editError: "",
  };
  const root = el("section", {
    class: "world-panel",
    attrs: { role: "dialog", "aria-label": "세계관" },
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
