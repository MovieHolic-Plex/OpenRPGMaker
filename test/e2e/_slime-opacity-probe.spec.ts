// 몬스터가 반투명한가 — 배경을 바꿔 찍어 몸통 픽셀이 따라 변하는지 본다.
// 변하면 합성 단계의 투명(opacity/blend), 그대로면 스프라이트 자체 무늬다.
import { expect, test, type Page } from "@playwright/test";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";
import { createBlankProject } from "@/project/defaults";
import { openDatabase, switchDatabaseTab, DATABASE_TAB_SPECS } from "./oprn-database-helpers";

const TROOPS_TAB = DATABASE_TAB_SPECS.find((tab) => tab.slug === "troops")!;
const OUT = "verify-shots/slime-opacity";
test.setTimeout(120_000);

test("슬라임 반투명 판정", async ({ page }: { page: Page }) => {
  const project = createBlankProject();
  project.system.battleUiStyle = "pokemon";
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
  await seedProjectFromSupabaseCanonical(page, project);
  await openDatabase(page);
  await switchDatabaseTab(page, TROOPS_TAB);
  await page.locator(".db-list-row").first().click();
  await page.getByTestId("db-troop-battle-test").click();
  await expect(page.getByTestId("test-play-window")).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(2600);

  // 애니메이션을 멈춰 프레임 잡음을 없앤다.
  await page.addStyleTag({ content: ".battle-scene, .battle-scene * { animation: none !important; transition: none !important; }" });
  await page.waitForTimeout(300);

  const computed = await page.evaluate(() => {
    const img = document.querySelector<HTMLElement>(".battle-enemy-image");
    const node = document.querySelector<HTMLElement>(".battle-enemy");
    if (!img || !node) return null;
    const ci = getComputedStyle(img), cn = getComputedStyle(node);
    return {
      imageOpacity: ci.opacity, imageFilter: ci.filter, imageBlend: ci.mixBlendMode,
      imageBg: ci.backgroundImage.split("/").slice(-1)[0],
      nodeOpacity: cn.opacity, nodeFilter: cn.filter, nodeBlend: cn.mixBlendMode,
      sceneOpacity: getComputedStyle(document.querySelector<HTMLElement>(".battle-scene")!).opacity,
    };
  });
  console.log("\n===== 계산값 =====\n" + JSON.stringify(computed, null, 2));

  const enemy = page.locator(".battle-enemy").first();
  await enemy.screenshot({ path: `${OUT}/01-normal-bg.png` });

  // 배경만 새빨강으로 — 스프라이트에는 손대지 않는다.
  await page.addStyleTag({
    content: `.battle-scene .battle-field { background: #ff0000 !important; }
              .battle-scene .battle-backdrop { background: #ff0000 !important; background-image: none !important; }`,
  });
  await page.waitForTimeout(300);
  await enemy.screenshot({ path: `${OUT}/02-red-bg.png` });

  // 배경만 새파랑으로
  await page.addStyleTag({
    content: `.battle-scene .battle-field { background: #0000ff !important; }
              .battle-scene .battle-backdrop { background: #0000ff !important; background-image: none !important; }`,
  });
  await page.waitForTimeout(300);
  await enemy.screenshot({ path: `${OUT}/03-blue-bg.png` });
});
