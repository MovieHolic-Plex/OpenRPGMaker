// Gen1 HUD 정리 증거 — 포켓몬 스킨에서 MP 와 ATB 조각이 실제로 화면에서 사라지는지
// 실브라우저에서 확인한다. jsdom 유닛 테스트는 스타일시트를 적용하지 않으므로 CSS
// display 계약은 여기서만 증명된다. HP 는 반대로 살아 있어야 한다(다 숨기면 안 된다).
import { expect, test } from "@playwright/test";
import { seedPokemonLayoutBattleProject, startReferenceBattle } from "./battleReferenceProject";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
});

test("포켓몬 스킨은 MP/ATB 를 감추고 HP 는 남긴다", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1360, height: 768 });
  await seedPokemonLayoutBattleProject(page);
  await startReferenceBattle(page);

  const hud = await page.evaluate(() => {
    const scene = document.querySelector<HTMLElement>("[data-testid='battle-scene']");
    const measure = (selector: string) => {
      const nodes = [...(scene?.querySelectorAll<HTMLElement>(selector) ?? [])];
      return {
        count: nodes.length,
        // DOM 은 남기고 표시만 끄는 설계다 — 노드 수가 아니라 렌더 여부를 본다.
        visible: nodes.filter((node) => node.getClientRects().length > 0).length,
        display: nodes.map((node) => window.getComputedStyle(node).display),
      };
    };
    return {
      uiStyle: scene?.dataset.battleUiStyle ?? null,
      actorMp: measure(".battle-actor-mp"),
      mpBar: measure(".battle-stat-bar-mp"),
      atbBar: measure(".battle-atb-bar"),
      atbLabel: measure(".battle-atb-label"),
      atbValue: measure(".battle-atb-value"),
      actorGauge: measure(".battle-actor-gauge"),
      enemyAtbBar: measure(".battle-enemy-atb-bar"),
      actorHp: measure(".battle-actor-hp"),
      hpBar: measure(".battle-stat-bar-hp"),
    };
  });
  console.log("GEN1_HUD_TRIM", JSON.stringify(hud));

  expect(hud.uiStyle).toBe("pokemon");
  // MP: 텍스트와 바가 DOM 에는 있지만(동기화 코드가 찾는다) 렌더되지 않는다.
  expect(hud.actorMp.count).toBeGreaterThan(0);
  expect(hud.actorMp.visible).toBe(0);
  expect(hud.actorMp.display.every((value) => value === "none")).toBe(true);
  expect(hud.mpBar.count).toBeGreaterThan(0);
  expect(hud.mpBar.visible).toBe(0);
  // ATB: 렌더되는 조각이 하나도 없다(플로우에 따라 DOM 자체가 없을 수도 있다).
  for (const atb of [hud.atbBar, hud.atbLabel, hud.atbValue, hud.actorGauge, hud.enemyAtbBar]) {
    expect(atb.visible).toBe(0);
  }
  // HP 는 살아 있다 — 숨김 규칙이 HP 까지 먹지 않았다는 증거.
  expect(hud.actorHp.visible).toBeGreaterThan(0);
  expect(hud.hpBar.visible).toBeGreaterThan(0);

  await page.screenshot({ path: testInfo.outputPath("gen1-hud-trim-pokemon-skin.png") });
  await page.locator(".battle-party").first().screenshot({
    path: testInfo.outputPath("gen1-hud-trim-party-closeup.png"),
    animations: "disabled",
  });
});
