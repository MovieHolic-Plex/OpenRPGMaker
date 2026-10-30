import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { markClassicWindowSkin, usesClassicWindowSkin } from "@/player/systemGraphics";
import { storeImageSizeProblem } from "@/assetStore/format";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { FakeElement, installFakeDom } from "./fakeDom";

// 고전 윈도스킨 대화창을 고른 게임은 메뉴·상점·타이틀 창에도 같은 9칸 그림을 쓴다(windowSkinSurfaces.css).
// 유리(기본)·에메랄드 몬스터 화면은 표식이 붙지 않아 지금 화면 그대로다.
describe("classic window skin surfaces", () => {
  let restoreDom: (() => void) | undefined;
  beforeEach(() => { restoreDom = installFakeDom(); store.replace(createBlankProject()); });
  afterEach(() => { restoreDom?.(); restoreDom = undefined; });

  it("marks surfaces only when the dialogue style is classic", () => {
    const node = document.createElement("div") as unknown as FakeElement;
    expect(markClassicWindowSkin(node as unknown as HTMLElement)).toBe(false);
    expect(node.dataset.windowSkin).toBeUndefined();
    store.update((draft) => { draft.system.dialogueStyle = "classic"; });
    expect(markClassicWindowSkin(node as unknown as HTMLElement)).toBe(true);
    expect(node.dataset.windowSkin).toBe("classic");
  });

  it("leaves the emerald monster style alone", () => {
    const project = createBlankProject();
    project.system.dialogueStyle = "classic";
    project.meta.oprnMonsterStyle = { version: 1, reference: "emerald" };
    expect(usesClassicWindowSkin(project)).toBe(false);
  });

  it("paints only under the classic marker", () => {
    const css = readFileSync("src/styles/runtime/windowSkinSurfaces.css", "utf8");
    const selectors = css.replace(/\/\*[\s\S]*?\*\//gu, "").split("}").map((block) => block.split("{")[0]!.trim()).filter(Boolean);
    expect(selectors.length).toBeGreaterThan(0);
    for (const selector of selectors) {
      for (const part of selector.split(/,(?![^(]*\))/u)) expect(part).toContain('[data-window-skin="classic"]');
    }
    expect(css).not.toMatch(/battle-/u);
  });

  it("store accepts only 96x96 system window skins", () => {
    expect(storeImageSizeProblem("system", 96, 96)).toBeNull();
    expect(storeImageSizeProblem("system", 160, 80)).not.toBeNull();
    expect(storeImageSizeProblem("system2", 80, 96)).toBeNull();
  });
});
