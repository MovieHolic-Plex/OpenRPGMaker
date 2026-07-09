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

  it("applies EasyRPG system skins instead of skipping them", () => {
    store.update((draft) => {
      draft.system.systemResourceId = "easyrpg-system-system-a";
      draft.system.battleSystemResourceId = "easyrpg-system2-system2-b";
    });
    const systemNode = document.createElement("div") as unknown as FakeElement;
    const battleNode = document.createElement("div") as unknown as FakeElement;

    applySystemGraphic(systemNode as unknown as HTMLElement);
    applyBattleSystemGraphic(battleNode as unknown as HTMLElement);

    expect(systemNode.style["--runtime-window-skin"]).toContain("SystemA.png");
    expect(battleNode.style["--runtime-window-skin"]).toContain("System2B.png");
  });

  it("applies title background from resource id", () => {
    const node = document.createElement("div") as unknown as FakeElement;
    applyTitleScreenBackground(node as unknown as HTMLElement, "easyrpg-title-title3");
    expect(node.style.backgroundImage).toContain("Title3.png");
  });
});
