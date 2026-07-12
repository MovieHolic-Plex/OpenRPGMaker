import { store } from "@/project/store";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { DEFAULT_RUNTIME_WINDOW_SKIN_ID, normalizeSystemWindowSkinId } from "@/project/databaseRecordModel";
import type { Project } from "@/project/types";

function resourceUrl(resourceId: string | undefined, project?: Project): string | undefined {
  return resolveAssetResourceUrl(resourceId, { project: project ?? store.getCurrent() }) ?? undefined;
}

function resolveWindowSkinResourceId(resourceId: string | undefined): string {
  return normalizeSystemWindowSkinId(resourceId) ?? DEFAULT_RUNTIME_WINDOW_SKIN_ID;
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
  const resourceId = resolveWindowSkinResourceId(source.system.systemResourceId);
  node.dataset.systemResource = resourceId;
  applyWindowSkinResource(node, resourceId, source);
}

/**
 * Applies battle chrome resources.
 *
 * RM2K3 split:
 * - System (systemResourceId): windowskin for command/status/message panels
 * - System2 (battleSystemResourceId): gauge/number/arrow chrome sheet — NOT a windowskin
 *
 * Historically this applied System2 as border-image, which flooded panels with the
 * sheet's solid orange key color (System2C is mostly #ff9c00). Battle panels must
 * use a real 9-slice windowskin; System2 is exposed as a CSS variable for gauges.
 */
export function applyBattleSystemGraphic(node: HTMLElement, project?: Project): void {
  const source = project ?? store.getCurrent();
  const battleSystemId = source.system.battleSystemResourceId;
  if (battleSystemId) {
    node.dataset.battleSystemResource = battleSystemId;
    const battleSystemUrl = resourceUrl(battleSystemId, source);
    if (battleSystemUrl) {
      node.style.setProperty("--runtime-battle-system2", `url("${battleSystemUrl}")`);
    } else {
      node.style.removeProperty("--runtime-battle-system2");
    }
  } else {
    delete node.dataset.battleSystemResource;
    node.style.removeProperty("--runtime-battle-system2");
  }
  const windowSkinId = resolveWindowSkinResourceId(source.system.systemResourceId);
  node.dataset.systemResource = windowSkinId;
  applyWindowSkinResource(node, windowSkinId, source);
}

function applyWindowSkinResource(node: HTMLElement, resourceId: string | undefined, project?: Project): void {
  const skinId = resolveWindowSkinResourceId(resourceId);
  const dataUrl = resourceUrl(skinId, project) ?? "/assets/ui/windowskin-rm2003.png";
  const cssUrl = `url("${dataUrl}")`;
  node.style.setProperty("--runtime-window-skin", cssUrl);
  node.style.borderImageSource = cssUrl;
  node.style.borderImageSlice = "24 fill";
}
