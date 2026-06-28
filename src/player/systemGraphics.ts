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
  const dataUrl = resourceUrl(resourceId);
  if (dataUrl) {
    node.style.borderImageSource = `url("${dataUrl}")`;
    node.style.borderImageSlice = "1";
    node.style.backgroundImage = `linear-gradient(rgba(20, 28, 44, 0.94), rgba(20, 28, 44, 0.94)), url("${dataUrl}")`;
  }
}

export function applyBattleSystemGraphic(node: HTMLElement): void {
  const resourceId = store.getCurrent().system.battleSystemResourceId;
  if (resourceId) {
    node.dataset.battleSystemResource = resourceId;
  }
  const dataUrl = resourceUrl(resourceId);
  if (dataUrl) {
    node.style.borderImageSource = `url("${dataUrl}")`;
    node.style.borderImageSlice = "1";
    node.style.backgroundImage = `linear-gradient(rgba(20, 28, 44, 0.92), rgba(20, 28, 44, 0.92)), url("${dataUrl}")`;
  }
}
