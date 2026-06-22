import { store } from "@/project/store";

function uploadedResourceUrl(resourceId: string | undefined): string | undefined {
  if (!resourceId) return undefined;
  return store.getCurrent().assets.uploaded[resourceId]?.dataUrl;
}

export function applyTitleGraphic(node: HTMLElement): void {
  const resourceId = store.getCurrent().system.titleResourceId;
  if (resourceId) {
    node.dataset.titleResource = resourceId;
  }
  const dataUrl = uploadedResourceUrl(resourceId);
  if (dataUrl) {
    node.style.backgroundImage = `linear-gradient(rgba(20, 28, 44, 0.86), rgba(20, 28, 44, 0.92)), url("${dataUrl}")`;
  }
}

export function applySystemGraphic(node: HTMLElement): void {
  const resourceId = store.getCurrent().system.systemResourceId;
  if (resourceId) {
    node.dataset.systemResource = resourceId;
  }
  const dataUrl = uploadedResourceUrl(resourceId);
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
  const dataUrl = uploadedResourceUrl(resourceId);
  if (dataUrl) {
    node.style.borderImageSource = `url("${dataUrl}")`;
    node.style.borderImageSlice = "1";
    node.style.backgroundImage = `linear-gradient(rgba(20, 28, 44, 0.92), rgba(20, 28, 44, 0.92)), url("${dataUrl}")`;
  }
}
