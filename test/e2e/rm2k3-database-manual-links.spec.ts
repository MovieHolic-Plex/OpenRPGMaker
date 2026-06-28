import { expect, test } from "@playwright/test";

test("RM2K3 database modal links every tab to the original manual URL", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/?freshProject=1");

  await page.getByTestId("toolbar-database").click();

  const expectedLinks = [
    ["db-tab-actors", "https://haylee.garden/rpg2003/dactors.htm", "주인공"],
    ["db-tab-classes", "https://haylee.garden/rpg2003/dclasses.htm", "직업"],
    ["db-tab-skills", "https://haylee.garden/rpg2003/dskills.htm", "특수기능"],
    ["db-tab-items", "https://haylee.garden/rpg2003/ditems.htm", "아이템"],
    ["db-tab-equipment", "https://haylee.garden/rpg2003/ditems.htm", "아이템"],
    ["db-tab-enemies", "https://haylee.garden/rpg2003/denemies.htm", "적 캐릭터"],
    ["db-tab-troops", "https://haylee.garden/rpg2003/dtroops.htm", "적 그룹"],
    ["db-tab-elements", "https://haylee.garden/rpg2003/delements.htm", "속성"],
    ["db-tab-states", "https://haylee.garden/rpg2003/dstates.htm", "상태"],
    ["db-tab-animations", "https://haylee.garden/rpg2003/danimations.htm", "전투 애니메이션"],
    ["db-tab-battler-animations", "https://haylee.garden/rpg2003/danimations2.htm", "전투 애니메이션 2"],
    ["db-tab-battle-screen", "https://haylee.garden/rpg2003/dbattlescreen.htm", "전투 화면"],
    ["db-tab-battle-commands", "https://haylee.garden/rpg2003/dbattlescreen.htm", "전투 화면"],
    ["db-tab-terrain", "https://haylee.garden/rpg2003/dterrain.htm", "지형"],
    ["db-tab-tilesets", "https://haylee.garden/rpg2003/dtilesets.htm", "타일셋"],
    ["db-tab-common-events", "https://haylee.garden/rpg2003/dcommonevents.htm", "공용 이벤트"],
    ["db-tab-system", "https://haylee.garden/rpg2003/dsystem.htm", "시스템"],
    ["db-tab-terms", "https://haylee.garden/rpg2003/dterms.htm", "용어"],
    ["db-tab-switches", "https://haylee.garden/rpg2003/supplementarywindowsb.htm", "스위치/변수 창"],
    ["db-tab-variables", "https://haylee.garden/rpg2003/supplementarywindowsb.htm", "스위치/변수 창"],
  ] as const;

  for (const [tabTestId, url, label] of expectedLinks) {
    await page.getByTestId(tabTestId).click();
    await expect(page.getByTestId("db-manual-source-link")).toContainText(label);
    await expect(page.getByTestId("db-manual-source-link")).toHaveAttribute("href", url);
    await expect(page.getByTestId("db-manual-source-url")).toContainText(url);
  }
});
