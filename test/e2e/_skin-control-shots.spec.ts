// 대조군 — 포켓몬 수정이 다른 스킨을 건드리지 않았는지 확인한다.
// CSS 변경은 전부 [data-battle-ui-style="pokemon"] 스코프이고, JS 변경(markMenuCursor)만
// 공유 경로다. retro2003/rm2003 의 명령 국면이 예전 그대로인지 눈으로 본다.
import { expect, test, type Page } from "@playwright/test";
import { seedProjectForEditor } from "./projectSeed";
import { createBlankProject } from "@/project/defaults";
import { openDatabase, switchDatabaseTab, DATABASE_TAB_SPECS } from "./oprn-database-helpers";

const TROOPS_TAB = DATABASE_TAB_SPECS.find((tab) => tab.slug === "troops")!;
const OUT = process.env.CONTROL_SHOTS_DIR ?? "verify-shots/skin-control";
test.setTimeout(120_000);

async function shoot(page: Page, skin: string): Promise<void> {
  const project = createBlankProject();
  project.system.battleUiStyle = skin as typeof project.system.battleUiStyle;
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
  await seedProjectForEditor(page, project);
  await openDatabase(page);
  await switchDatabaseTab(page, TROOPS_TAB);
  await page.locator(".db-list-row").first().click();
  await page.getByTestId("db-troop-battle-test").click();
  await expect(page.getByTestId("test-play-window")).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(2600);
  await page.screenshot({ path: `${OUT}/${skin}-command.png` });

  const cursor = await page.evaluate(() => {
    const el = document.querySelector<HTMLElement>(".battle-command[data-battle-command-cursor='true']");
    return { label: el?.querySelector("strong")?.textContent?.trim() ?? null, inert: el?.dataset.battleCommandInert ?? null };
  });
  console.log(`\n${skin}: 커서=${JSON.stringify(cursor)}`);
}

test("retro2003 대조", async ({ page }) => {
  await shoot(page, "retro2003");
});

test("rm2003 대조", async ({ page }) => {
  await shoot(page, "rm2003");
});
