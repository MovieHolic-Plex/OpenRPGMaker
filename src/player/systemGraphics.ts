import { store } from "@/project/store";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";

function resourceUrl(resourceId: string | undefined): string | undefined {
  return resolveAssetResourceUrl(resourceId, { project: store.getCurrent() }) ?? undefined;
}

export function applyTitleGraphic(node: HTMLElement): void {
  const resourceId = store.getCurrent().system.titleResourceId;
  if (resourceId) {
    node.dataset.titleResource = resourceId;
  }
  const dataUrl = resourceUrl(resourceId);
  if (dataUrl) {
    node.style.backgroundImage = `url("${dataUrl}")`;
  }
}

export function applyTitleScreenBackground(node: HTMLElement, resourceId: string | undefined): void {
  if (resourceId) {
    node.dataset.titleResource = resourceId;
  }
  const url = resourceUrl(resourceId);
  if (url) {
    node.style.backgroundImage = `url("${url}")`;
  }
}

export function applySystemGraphic(node: HTMLElement): void {
  const resourceId = store.getCurrent().system.systemResourceId;
  if (resourceId) {
    node.dataset.systemResource = resourceId;
  }
  applyWindowSkinResource(node, resourceId, "easyrpg-system-");
}

export function applyBattleSystemGraphic(node: HTMLElement): void {
  const resourceId = store.getCurrent().system.battleSystemResourceId;
  if (resourceId) {
    node.dataset.battleSystemResource = resourceId;
  }
  applyWindowSkinResource(node, resourceId, "easyrpg-system2-");
}

function applyWindowSkinResource(node: HTMLElement, resourceId: string | undefined, legacyPrefix: string): void {
  if (resourceId?.startsWith(legacyPrefix)) return;
  const dataUrl = resourceUrl(resourceId);
  if (!dataUrl) return;
  const cssUrl = `url("${dataUrl}")`;
  node.style.setProperty("--runtime-window-skin", cssUrl);
  node.style.borderImageSource = cssUrl;
  node.style.borderImageSlice = "24 fill";
}
