import { store } from "@/project/store";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import type { Project } from "@/project/types";

function resourceUrl(resourceId: string | undefined, project?: Project): string | undefined {
  return resolveAssetResourceUrl(resourceId, { project: project ?? store.getCurrent() }) ?? undefined;
}

export function applyTitleGraphic(node: HTMLElement, project?: Project): void {
  const source = project ?? store.getCurrent();
  const resourceId = source.system.titleResourceId;
  if (resourceId) {
    node.dataset.titleResource = resourceId;
  }
  const dataUrl = resourceUrl(resourceId, source);
  if (dataUrl) {
    node.style.backgroundImage = `url("${dataUrl}")`;
  }
}

export function applyTitleScreenBackground(node: HTMLElement, resourceId: string | undefined, project?: Project): void {
  if (resourceId) {
    node.dataset.titleResource = resourceId;
  }
  const url = resourceUrl(resourceId, project);
  if (url) {
    node.style.backgroundImage = `url("${url}")`;
  } else {
    node.style.backgroundImage = "";
  }
}

/** Applies system window skin so DB systemResourceId changes are visible on runtime chrome. */
export function applySystemGraphic(node: HTMLElement, project?: Project): void {
  const source = project ?? store.getCurrent();
  const resourceId = source.system.systemResourceId;
  if (resourceId) {
    node.dataset.systemResource = resourceId;
  } else {
    delete node.dataset.systemResource;
  }
  applyWindowSkinResource(node, resourceId, source);
}

/** Applies battle System2 chrome so DB battleSystemResourceId changes are visible in battle UI. */
export function applyBattleSystemGraphic(node: HTMLElement, project?: Project): void {
  const source = project ?? store.getCurrent();
  const resourceId = source.system.battleSystemResourceId;
  if (resourceId) {
    node.dataset.battleSystemResource = resourceId;
  } else {
    delete node.dataset.battleSystemResource;
  }
  applyWindowSkinResource(node, resourceId, source);
}

function applyWindowSkinResource(node: HTMLElement, resourceId: string | undefined, project?: Project): void {
  const dataUrl = resourceUrl(resourceId, project);
  if (!dataUrl) {
    // Fall back to CSS default (--runtime-window-skin on :root) by clearing inline overrides.
    node.style.removeProperty("--runtime-window-skin");
    node.style.removeProperty("border-image-source");
    node.style.removeProperty("border-image-slice");
    return;
  }
  const cssUrl = `url("${dataUrl}")`;
  node.style.setProperty("--runtime-window-skin", cssUrl);
  node.style.borderImageSource = cssUrl;
  node.style.borderImageSlice = "24 fill";
}
