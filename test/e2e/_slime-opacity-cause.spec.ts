// 원인 확정: 에디터 유래 규칙 `:where(body:has(.editor-layout)) .battle-enemy:disabled`
// 가 적 버튼을 55% 로 낮추는가. body 에서 .editor-layout 만 떼고 다시 재 본다.
import { expect, test, type Page } from "@playwright/test";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";
import { createBlankProject } from "@/project/defaults";
import { openDatabase, switchDatabaseTab, DATABASE_TAB_SPECS } from "./oprn-database-helpers";

const TROOPS_TAB = DATABASE_TAB_SPECS.find((tab) => tab.slug === "troops")!;
const OUT = "verify-shots/slime-opacity";
test.setTimeout(120_000);

test("반투명 원인 확정", async ({ page }: { page: Page }) => {
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
  await page.addStyleTag({ content: ".battle-scene, .battle-scene * { animation: none !important; }" });

  const read = () =>
    page.evaluate(() => {
      const n = document.querySelector<HTMLButtonElement>(".battle-enemy");
      if (!n) return null;
      return {
        tag: n.tagName,
        disabled: n.disabled,
        ariaDisabled: n.getAttribute("aria-disabled"),
        opacity: getComputedStyle(n).opacity,
        editorLayoutPresent: document.querySelector(".editor-layout") !== null,
      };
    });

  const before = await read();
  console.log("\n===== 에디터 안 =====\n" + JSON.stringify(before, null, 2));
  await page.locator(".battle-enemy").first().screenshot({ path: `${OUT}/10-editor.png` });

  // 출하 플레이어 흉내: .editor-layout 클래스만 뗀다(다른 것은 그대로).
  await page.evaluate(() => {
    for (const el of document.querySelectorAll(".editor-layout")) el.classList.remove("editor-layout");
  });
  await page.waitForTimeout(300);
  const after = await read();
  console.log("\n===== .editor-layout 제거 후 =====\n" + JSON.stringify(after, null, 2));
  await page.locator(".battle-enemy").first().screenshot({ path: `${OUT}/11-no-editor-layout.png` });

  // 대상 선택 국면에서는 버튼이 활성화되는가 (그러면 그때만 또렷해진다는 뜻)
  await page.evaluate(() => {
    for (const el of document.querySelectorAll("body")) el.classList.add("editor-layout");
  });
  await page.keyboard.press("Enter");
  await page.waitForTimeout(800);
  const duringTarget = await page.evaluate(() => {
    const n = document.querySelector<HTMLButtonElement>(".battle-enemy");
    const scene = document.querySelector<HTMLElement>(".battle-scene");
    return n ? { phase: scene?.dataset.battlePhase, disabled: n.disabled, opacity: getComputedStyle(n).opacity } : null;
  });
  console.log("\n===== 명령 확정 직후 =====\n" + JSON.stringify(duringTarget, null, 2));
});
