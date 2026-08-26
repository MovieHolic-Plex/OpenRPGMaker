import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  applyBattleSystemGraphic,
  applySystemGraphic,
  applyTitleScreenBackground,
} from "@/player/systemGraphics";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { FakeElement, installFakeDom } from "./fakeDom";

describe("system graphics resource application", () => {
  let restoreDom: (() => void) | undefined;

  beforeEach(() => {
    restoreDom = installFakeDom();
    store.replace(createBlankProject());
  });

  afterEach(() => {
    restoreDom?.();
    restoreDom = undefined;
  });

  it("applies a CSS 9-slice windowskin and never paints EasyRPG System sheets as border-image", () => {
    store.update((draft) => {
      // Legacy DB value: EasyRPG System sheet (orange key + icon strip). Must be remapped.
      draft.system.systemResourceId = "easyrpg-system-system-a";
      draft.system.battleSystemResourceId = "easyrpg-system2-system2-b";
    });
    const systemNode = document.createElement("div") as unknown as FakeElement;
    const battleNode = document.createElement("div") as unknown as FakeElement;

    applySystemGraphic(systemNode as unknown as HTMLElement);
    applyBattleSystemGraphic(battleNode as unknown as HTMLElement);

    // Field and battle panels both use the real windowskin, not SystemA.png.
    // 저작 기본 스킨은 따뜻한 갈색 9-slice 다(DEFAULT_RUNTIME_WINDOW_SKIN_ID = windowskin-warm).
    expect(systemNode.style["--runtime-window-skin"]).toContain("windowskin-warm.png");
    expect(battleNode.style["--runtime-window-skin"]).toContain("windowskin-warm.png");
    expect(systemNode.dataset.systemResource).toBe("windowskin-warm");
    // System2 is gauge chrome only — never border-image fill (that flooded orange panels).
    expect(battleNode.style["--runtime-battle-system2"]).toContain("System2B.png");
    expect(battleNode.dataset.battleSystemResource).toBe("easyrpg-system2-system2-b");
  });

  it("keeps an explicit CSS windowskin resource when authored", () => {
    store.update((draft) => {
      draft.system.systemResourceId = "windowskin-default";
    });
    const node = document.createElement("div") as unknown as FakeElement;
    applySystemGraphic(node as unknown as HTMLElement);
    expect(node.style["--runtime-window-skin"]).toContain("windowskin-default.png");
    expect(node.dataset.systemResource).toBe("windowskin-default");
  });

  it("applies title background from resource id", () => {
    const node = document.createElement("div") as unknown as FakeElement;
    applyTitleScreenBackground(node as unknown as HTMLElement, "easyrpg-title-title3");
    expect(node.style.backgroundImage).toContain("Title3.png");
  });
});
