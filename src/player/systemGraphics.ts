import { store } from "@/project/store";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { system2GaugeCssVars } from "@/assets/system2Sheet";
import { transparentColorKeyDataUrl } from "@/assets/transparentColorKeyBackground";
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
    node.style.backgroundSize = "100% 100%";
    node.style.backgroundRepeat = "no-repeat";
    node.style.backgroundPosition = "center";
    node.style.imageRendering = "pixelated";
  } else {
    node.style.backgroundImage = "";
  }
}

/**
 * Sets `--runtime-window-skin` + `data-system-resource` **without** painting a 9-slice
 * fill on the node itself.
 *
 * Use this on full-bleed play roots whose children own the window chrome (battle scene,
 * title screen, dialogue overlay). Painting `border-image-slice: 24 fill` on such a root
 * tiles the windowskin center over the whole scene — the regression fixed by the battle
 * adversarial review §1.
 */
export function applySystemWindowSkinVariable(node: HTMLElement, project?: Project): string {
  const source = project ?? store.getCurrent();
  const skinId = resolveWindowSkinResourceId(source.system.systemResourceId);
  node.dataset.systemResource = skinId;
  return applyWindowSkinVariable(node, skinId, source);
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
 *   and NOT a battle field backdrop.
 *
 * Historically this applied System2 as border-image, which flooded panels with the
 * sheet's solid orange key color (System2C is mostly #ff9c00). Battle panels must
 * use a real 9-slice windowskin; System2 is chroma-keyed and exposed as
 * `--runtime-battle-system2` plus slice CSS vars for HP/SP/AT gauges.
 */
export function applyBattleSystemGraphic(node: HTMLElement, project?: Project): void {
  const source = project ?? store.getCurrent();
  const battleSystemId = source.system.battleSystemResourceId;
  const gaugeVars = system2GaugeCssVars();
  for (const [key, value] of Object.entries(gaugeVars)) {
    node.style.setProperty(key, value);
  }
  if (battleSystemId) {
    node.dataset.battleSystemResource = battleSystemId;
    const battleSystemUrl = resourceUrl(battleSystemId, source);
    if (battleSystemUrl) {
      // Interim raw URL so layout can size before chroma-key finishes.
      node.style.setProperty("--runtime-battle-system2", `url("${battleSystemUrl}")`);
      node.dataset.battleSystem2 = "pending";
      void transparentColorKeyDataUrl(battleSystemUrl)
        .then((dataUrl) => {
          if (node.dataset.battleSystemResource !== battleSystemId) return;
          node.style.setProperty("--runtime-battle-system2", `url("${dataUrl}")`);
          node.dataset.battleSystem2 = "applied";
        })
        .catch(() => {
          if (node.dataset.battleSystemResource !== battleSystemId) return;
          node.dataset.battleSystem2 = "fallback";
        });
    } else {
      node.style.removeProperty("--runtime-battle-system2");
      delete node.dataset.battleSystem2;
    }
  } else {
    delete node.dataset.battleSystemResource;
    delete node.dataset.battleSystem2;
    node.style.removeProperty("--runtime-battle-system2");
  }
  // 전투 루트에는 CSS 변수만 심는다 — 패널들이 var(--runtime-window-skin) 으로 소비한다.
  // 루트 자체에 border-image(slice "24 fill")를 걸면 fill 이 windowskin 의 중앙 타일을
  // **씬 전체**(자식 아래, 배경 위)에 칠해서, 커맨드 패널이 비는 순간(타깃 선택 등)
  // 파란 윈도스킨 타일이 화면을 채우던 결함(적대 리뷰 §1)의 원인이었다.
  applySystemWindowSkinVariable(node, source);
  node.style.removeProperty("border-image-source");
  node.style.removeProperty("border-image-slice");
}

function applyWindowSkinVariable(node: HTMLElement, resourceId: string | undefined, project?: Project): string {
  const skinId = resolveWindowSkinResourceId(resourceId);
  const dataUrl = resourceUrl(skinId, project) ?? "/assets/ui/windowskin-default.png";
  const cssUrl = `url("${dataUrl}")`;
  node.style.setProperty("--runtime-window-skin", cssUrl);
  return cssUrl;
}

function applyWindowSkinResource(node: HTMLElement, resourceId: string | undefined, project?: Project): void {
  const cssUrl = applyWindowSkinVariable(node, resourceId, project);
  node.style.borderImageSource = cssUrl;
  node.style.borderImageSlice = "24 fill";
}
