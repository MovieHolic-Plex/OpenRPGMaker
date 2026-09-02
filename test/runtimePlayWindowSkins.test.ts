// @vitest-environment happy-dom
//
// 플레이 모드 창(전투 · 상점 · 타이틀 · 메시지)이 프로젝트 자료집의 System 윈도스킨을
// 정직하게 소비하는지 고정한다. 회귀 계약:
//   1) 전투 루트에 9-slice fill 을 걸지 않는다 (걸면 커맨드 패널이 비는 순간 씬 전체가
//      윈도스킨 중앙 타일로 칠해진다 — 적대 리뷰 §1).
//   2) System2 는 게이지 시트다. border-image 로 쓰면 #ff9c00 키컬러가 창을 덮는다.
//   3) 12종 전투 스킨 파셜이 창 표면을 하드코드 색으로 덮어 윈도스킨을 죽이지 않는다.
//   4) 상점/대화/타이틀 메뉴는 같은 `--runtime-window-skin` 배관을 공유하되, 패널을 그
//      비트맵으로 **칠하지는 않고** rm2000 전투 HUD 와 같은 유리 토큰으로 그린다. 배관과
//      프로젝트 데이터는 그대로다(JS 는 여전히 변수를 심고, 전투 다섯 창은 _windowskin.css
//      계약을 지킨다). 증거: verify-shots/glass-runtime 의 before ↔ after 짝.
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  applyBattleSystemGraphic,
  applySystemGraphic,
  applySystemWindowSkinVariable,
} from "@/player/systemGraphics";
import { createDialogueUI } from "@/player/dialogue";
import { renderTitleScreen } from "@/player/titleScreen";
import { createShopOverlay, renderShopItems, renderShopMenu } from "@/player/playSceneShopDom";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { resolveTerms } from "@/project/terms";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import type { ItemRecord } from "@/project/types/database";
import type { ShopStep } from "@/player/playSceneShop";

const read = (path: string): string => readFileSync(path, "utf8");

const BATTLE_WINDOW_SELECTORS = [
  ".battle-command-panel",
  ".battle-enemy-list-panel",
  ".battle-message-window",
  ".battle-party",
  ".battle-result-panel",
] as const;

function shopScene(): PlaySceneContext {
  return {
    session: {
      gold: 250,
      inventory: { item_potion: 3 },
      partyActorIds: ["actor_1", "actor_2"],
    },
  } as unknown as PlaySceneContext;
}

function shopItems(): ItemRecord[] {
  const base = createBlankProject().database.items[0];
  const potion = { ...base, id: "item_potion", name: "포션", price: 50 } as ItemRecord;
  const sword = { ...base, id: "item_sword", name: "청동검", price: 300 } as ItemRecord;
  return [potion, sword];
}

const shopStep = { allowSell: true } as ShopStep;

describe("runtime play window skins — 전투 크롬", () => {
  beforeEach(() => {
    store.replace(createBlankProject());
  });

  it("전투 루트에는 CSS 변수만 심고 border-image fill 을 남기지 않는다", () => {
    store.update((draft) => {
      draft.system.systemResourceId = "windowskin-default";
      draft.system.battleSystemResourceId = "easyrpg-system2-system2-c";
    });
    const root = document.createElement("section");
    root.style.setProperty("border-image-source", 'url("stale.png")');
    root.style.setProperty("border-image-slice", "24 fill");

    applyBattleSystemGraphic(root);

    expect(root.style.getPropertyValue("--runtime-window-skin")).toContain("windowskin-default.png");
    expect(root.dataset.systemResource).toBe("windowskin-default");
    expect(root.style.getPropertyValue("border-image-source")).toBe("");
    expect(root.style.getPropertyValue("border-image-slice")).toBe("");
  });

  it("System2 는 게이지 변수로만 나가고 윈도스킨 자리를 차지하지 않는다", () => {
    store.update((draft) => {
      draft.system.battleSystemResourceId = "easyrpg-system2-system2-c";
    });
    const root = document.createElement("section");
    applyBattleSystemGraphic(root);

    const system2 = root.style.getPropertyValue("--runtime-battle-system2");
    expect(system2).not.toBe("");
    expect(root.style.getPropertyValue("--runtime-window-skin")).not.toBe(system2);
    expect(root.dataset.battleSystemResource).toBe("easyrpg-system2-system2-c");
    expect(root.style.getPropertyValue("border-image-source")).toBe("");
  });

  it("_windowskin.css 가 다섯 개 전투 창에 윈도스킨을 배분하고, 루트는 건드리지 않는다", () => {
    const contract = read("src/styles/runtime/battle-skins/_windowskin.css");
    for (const selector of BATTLE_WINDOW_SELECTORS) {
      expect(contract).toContain(`.battle-scene ${selector}`);
    }
    expect(contract).toContain("border-image-source: var(--runtime-window-skin) !important;");
    // 루트(.battle-scene 단독) 규칙으로 fill 을 칠하지 않는다.
    expect(contract).not.toMatch(/\.battle-scene\s*\{[^}]*border-image/s);
    // System2 는 이 파일에서 쓰지 않는다.
    expect(contract).not.toContain("--runtime-battle-system2");

    const index = read("src/styles/runtime/battle-skins/index.css");
    const imports = [...index.matchAll(/@import "\.\/(_[a-z]+)\.css";/g)].map((match) => match[1]);
    // 계약 파일이 마지막이어야 스킨 파셜의 하드코드 창 표면을 이긴다.
    expect(imports.at(-1)).toBe("_windowskin");
  });

  it("스킨 파셜이 창 표면에서 border-image 를 죽이지 않는다", () => {
    const partials = [
      "_pokemon", "_rm2000", "_octopath", "_chrono", "_bravely",
      "_dragonquest", "_ff", "_mother", "_goldensun", "_mv", "_vxace",
    ];
    for (const name of partials) {
      const css = read(`src/styles/runtime/battle-skins/${name}.css`);
      const blocks = css.split("}");
      for (const block of blocks) {
        if (!/border-image:\s*none/.test(block)) continue;
        // .battle-command(커맨드 행)은 창이 아니다 — 창 다섯 개만 검사한다.
        for (const selector of BATTLE_WINDOW_SELECTORS) {
          expect(block, `${name}.css 가 ${selector} 의 윈도스킨을 없앤다`).not.toContain(selector);
        }
      }
    }
  });
});

describe("runtime play window skins — 상점", () => {
  beforeEach(() => {
    store.replace(createBlankProject());
    store.update((draft) => {
      draft.system.systemResourceId = "windowskin-default";
    });
  });

  it("상점 오버레이는 스크림이다 — 변수는 심지만 자기 몸에 fill 을 칠하지 않는다", () => {
    const overlay = createShopOverlay();
    expect(overlay.dataset.testid).toBe("shop-scene");
    expect(overlay.dataset.systemResource).toBe("windowskin-default");
    expect(overlay.style.getPropertyValue("--runtime-window-skin")).toContain("windowskin-default.png");
    expect(overlay.style.getPropertyValue("border-image-source")).toBe("");
  });

  it("물건 목록이 아이콘·이름·소지·가격을 한 행에서 보여준다", () => {
    const items = shopItems();
    const shell = renderShopItems({
      scene: shopScene(),
      step: shopStep,
      items,
      mode: "buy",
      prompt: "무엇을 살까?",
      terms: resolveTerms(createBlankProject()),
      merchantGold: 900,
      setStatus: () => {},
      showMenu: () => {},
      onItem: () => {},
    });

    const row = shell.querySelector<HTMLElement>("[data-testid='shop-buy-item_potion']");
    expect(row).not.toBeNull();
    expect(row?.querySelector("[data-testid='shop-item-icon-item_potion']")).not.toBeNull();
    // 값만 있으면 단위를 알 수 없다 — 소지금 패널과 같은 단위를 붙인다.
    expect(row?.querySelector("[data-testid='shop-price-item_potion']")?.textContent).toBe("50G");
    // 파티 소지 수량이 목록에서 바로 읽힌다(구매 전에 창을 옮겨 다니지 않는다).
    expect(row?.querySelector("[data-testid='shop-owned-item_potion']")?.textContent).toBe("x3");
    // 소지금 + 상인 소지금이 같은 화면에 있다.
    expect(shell.querySelector("[data-testid='shop-player-gold']")?.textContent).toContain("250");
    expect(shell.querySelector("[data-testid='shop-merchant-gold']")?.textContent).toContain("900");
    expect(shell.querySelector("[data-testid='shop-owned-panel']")).not.toBeNull();
  });

  it("입구 화면에서 2003 클론 빈 패널 껍질을 쓰지 않는다", () => {
    const shell = renderShopMenu(shopStep, resolveTerms(createBlankProject()), () => {}, () => {});
    expect(shell.querySelector(".runtime-shop-top-panel")).toBeNull();
    expect(shell.querySelector(".runtime-shop-middle-panel")).toBeNull();
    expect(shell.querySelector(".runtime-shop-greeting-panel")).not.toBeNull();
    expect(shell.querySelector("[data-testid='shop-mode-buy']")).not.toBeNull();
  });

  it("shop.css 의 가게 창 표면은 두 경로 모두 윈도스킨 칠 없이 유리 토큰을 쓴다", () => {
    // 기본 규칙만 검사하면 안 된다: @supports (backdrop-filter) 블록이 같은 속성을 덮으므로,
    // 그 블록을 지원하는 브라우저(증거 샷의 Chromium 포함)에서는 기본 규칙이 죽은 코드다.
    // 실제로 사용자가 보는 표면은 **승자 규칙**이다 — 두 규칙을 함께 고정한다.
    const css = read("src/styles/runtime/shop.css");
    const base = css.slice(css.indexOf(".runtime-shop-panel {"));
    const baseRule = base.slice(0, base.indexOf("}"));
    const supportsBlock = css.slice(css.indexOf("@supports (backdrop-filter: blur(2px)) {", css.indexOf(".runtime-shop-panel {")));
    const winnerRule = supportsBlock.slice(0, supportsBlock.indexOf("  }"));

    for (const rule of [baseRule, winnerRule]) {
      expect(rule).not.toContain("border-image-source: var(--runtime-window-skin)");
      expect(rule).toMatch(/var\(--runtime-glass-|var\(--shop-(surface|line|radius)\)/);
    }
    // 상점 지역 변수는 공용 유리 토큰을 가리켜야 한다 — 두 번째 디자인 시스템 금지.
    const overlayVars = css.slice(css.indexOf(".runtime-shop-overlay {"));
    for (const name of ["--shop-accent:", "--shop-surface:", "--shop-line:", "--shop-radius:", "--shop-ui-font:"]) {
      const declaration = overlayVars.slice(overlayVars.indexOf(name)).split(";")[0];
      expect(declaration, `${name} 가 공용 토큰을 가리키지 않는다`).toContain("var(--runtime-");
    }
    expect(css).toContain(".runtime-shop-item-icon");
  });
});

describe("runtime play window skins — 메시지 창과 타이틀", () => {
  let host: HTMLElement | undefined;

  beforeEach(() => {
    store.replace(createBlankProject());
    store.update((draft) => {
      draft.system.systemResourceId = "windowskin-default";
    });
    host = document.createElement("div");
    document.body.append(host);
  });

  afterEach(() => {
    host?.remove();
    host = undefined;
  });

  it("대화 오버레이가 자료집 윈도스킨 변수를 심는다", () => {
    const overlay = host!.querySelector<HTMLElement>(".dialogue-overlay") ?? undefined;
    expect(overlay).toBeUndefined();
    createDialogueUI(host!);
    const created = host!.querySelector<HTMLElement>(".dialogue-overlay");
    expect(created).not.toBeNull();
    expect(created?.dataset.systemResource).toBe("windowskin-default");
    expect(created?.style.getPropertyValue("--runtime-window-skin")).toContain("windowskin-default.png");
  });

  it("dialogue.css 가 배관은 유지하면서 메시지 창 프레임을 유리 토큰으로 그린다", () => {
    const css = read("src/styles/dialogue.css");
    const frame = css.slice(css.indexOf(".dialogue-box::before {"));
    const frameRule = frame.slice(0, frame.indexOf("}"));
    expect(frameRule).not.toContain("border-image-source: var(--runtime-window-skin)");
    expect(frameRule).toMatch(/var\(--runtime-(glass|dialogue-glass)-/);
    // 예전엔 ::before/::after 를 통째로 껐다 — 그러면 프레임을 걸 자리가 없다.
    expect(css).not.toContain(".dialogue-box::after,\n.dialogue-box::before {\n  display: none;\n}");

    // 이름 상자(화자 라벨)도 같은 파이프여야 한다. 예전 계약은 이 상자가 윈도스킨을
    // fill 로 받아 표면까지 그리는 것이었다 — 이제는 대화창과 같은 유리 표면·테두리를 쓴다.
    const nameplate = css.slice(css.indexOf(".dialogue-box .speaker.speaker-nameplate {"));
    const nameplateRule = nameplate.slice(0, nameplate.indexOf("}"));
    expect(nameplateRule).not.toContain("border-image-source: var(--runtime-window-skin)");
    expect(nameplateRule).toMatch(/border: 1px solid var\(--runtime-dialogue-glass-border\)/);
    expect(nameplateRule).toMatch(/var\(--runtime-dialogue-glass-surface/);
  });

  it("타이틀 루트가 정규화된 윈도스킨 id 를 노출하고 배경 그래픽을 유지한다", () => {
    const project = createBlankProject();
    project.system.systemResourceId = "windowskin-default";
    project.system.titleResourceId = "easyrpg-title-title3";
    const title = renderTitleScreen(project, {
      onNewGame: () => {},
      onResume: () => {},
      onContinue: () => {},
      onQuit: () => {},
    });

    expect(title.dataset.systemResource).toBe("windowskin-default");
    expect(title.style.getPropertyValue("--runtime-window-skin")).toContain("windowskin-default.png");
    // 전면 루트에 9-slice fill 을 칠하지 않는다 — 타이틀 키아트가 보여야 한다.
    expect(title.style.getPropertyValue("border-image-source")).toBe("");
    expect(title.style.backgroundImage).toMatch(/^url\(/);
    expect(title.querySelector(".rm-title-menu")).not.toBeNull();
  });

  it("title.css 의 타이틀 메뉴 창이 윈도스킨 칠 없이 유리 토큰을 쓴다", () => {
    const css = read("src/styles/runtime/title.css");
    const menu = css.slice(css.indexOf(".rm-title-screen-editorial .rm-title-menu {"));
    const menuRule = menu.slice(0, menu.indexOf("}"));
    expect(menuRule).not.toContain("border-image-source: var(--runtime-window-skin)");
    expect(menuRule).toMatch(/var\(--runtime-glass-|var\(--runtime-window-fill-fallback\)/);
  });

  it("필드 메인 메뉴와 상점/대화가 같은 변수 이름을 공유한다", () => {
    const node = document.createElement("div");
    applySystemGraphic(node);
    const overlay = document.createElement("div");
    applySystemWindowSkinVariable(overlay);
    expect(node.style.getPropertyValue("--runtime-window-skin")).toBe(
      overlay.style.getPropertyValue("--runtime-window-skin")
    );
    // applySystemGraphic 은 창 자체이므로 9-slice 를 칠한다. 변수 전용 API 는 칠하지 않는다.
    expect(node.style.getPropertyValue("border-image-source")).not.toBe("");
    expect(overlay.style.getPropertyValue("border-image-source")).toBe("");
  });
});
