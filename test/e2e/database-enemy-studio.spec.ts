import { expect, test, type Page, type Locator } from "@playwright/test";
import { openDatabase, switchDatabaseTab } from "./oprn-database-helpers";

async function openEnemies(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem("oprn:editor-ui-mode", "expert");
    localStorage.setItem("oprn:editor-ui-mode", "expert");
  });
  // Dev module requests can be cancelled by host network changes; retry the whole boot.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await page.goto("/?freshProject=1", { waitUntil: "domcontentloaded", timeout: 45_000 });
      await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 30_000 });
      break;
    } catch (error) {
      if (attempt === 2) throw error;
      console.warn(`Editor boot attempt ${attempt + 1} failed; retrying`, String(error));
    }
  }
  for (const [button, overlay] of [
    ["login-guest", "login-modal"],
    ["standard-welcome-start", "standard-welcome-card"],
    ["coach-mark-skip", "coach-mark-skip"],
  ]) {
    if (await page.getByTestId(button).isVisible()) {
      await page.getByTestId(button).click();
      await expect(page.getByTestId(overlay)).toBeHidden();
    }
  }
  console.info("[enemy studio] editor booted");
  await openDatabase(page);
  await switchDatabaseTab(page, { label: "몬스터", slug: "enemies", testId: "db-tab-enemies" });
  console.info("[enemy studio] database open");
}

// Visibility alone accepts elements clipped by an overflow:hidden ancestor.
async function expectReachable(control: Locator): Promise<void> {
  await control.scrollIntoViewIfNeeded();
  expect(await control.evaluate((node) => {
    const box = node.getBoundingClientRect();
    const x = box.left + box.width / 2;
    const y = box.top + box.height / 2;
    const hit = document.elementFromPoint(x, y);
    return box.width > 20 && box.height > 15 && (hit === node || node.contains(hit));
  })).toBe(true);
}

test("enemy studio editing remains reachable across desktop sizes", async ({ page }, info) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1680, height: 1050 });
  await openEnemies(page);
  for (const viewport of [{ width: 1680, height: 1050 }, { width: 1280, height: 800 }, { width: 1024, height: 768 }]) {
    console.info(`[enemy studio] viewport ${viewport.width}`);
    await page.setViewportSize(viewport);
    await expectReachable(page.getByTestId("db-enemy-battle-test"));
    const frame = await page.locator(".database-modal-window").boundingBox();
    for (const [section, field] of [
      ["basic", "db-field-enemy-max-hp"],
      ["appearance", "db-enemy-graphic-set"],
      ["combat", "db-picker-enemy-element-rate-fire"],
      ["combat", "db-field-enemy-move-interval-ms"],
      ["rewards", "db-field-enemy-drop-rate"],
    ]) {
      console.info(`[enemy studio] ${viewport.width} ${section}: ${field}`);
      await page.getByTestId(`db-enemy-section-${section}-tab`).click();
      // 등급 표는 「약점·저항」 카드의 접힌 「전체 표 보기」 안에 있다(기본과 다른 것만 칩으로).
      if (field.startsWith("db-picker-enemy-element-rate-")) {
        const table = page.getByTestId("db-enemy-resist-table");
        if (!(await table.evaluate((node) => (node as HTMLDetailsElement).open))) await page.getByTestId("db-enemy-resist-table-toggle").click();
      }
      await expectReachable(page.getByTestId(field));
      expect(await page.locator(".database-modal-window").boundingBox()).toEqual(frame);
    }
    await page.getByTestId("db-enemy-section-basic-tab").click();
    await page.locator(".db-enemy-studio").evaluate((node) => { node.scrollTop = 0; });
    await page.screenshot({ path: info.outputPath(`enemy-studio-${viewport.width}.png`) });
    expect(await page.locator(".oprn-record-enemies").evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
  }
});

test("enemy studio keeps selection, updates previews and opens a disposable battle", async ({ page }) => {
  test.setTimeout(300_000);
  page.on("pageerror", (error) => console.error("[enemy studio] page error", error.message));
  await page.setViewportSize({ width: 1680, height: 1050 });
  await openEnemies(page);
  await page.getByTestId("db-field-enemy-max-hp").fill("321");
  // 미리보기 아래 HP/MP/공격/방어 줄은 「능력치」 카드와 같은 값의 중복이라 뺐다(2026-09-23).
  // 값의 권위는 편집 칸 하나다.
  await expect(page.getByTestId("db-field-enemy-max-hp")).toHaveValue("321");
  await page.getByTestId("db-field-name").fill("작업실 슬라임");
  await expect(page.locator(".oprn-record-enemies .db-list-row.active")).toContainText("작업실 슬라임");
  await expect(page.getByTestId("db-enemy-hero")).toContainText("작업실 슬라임");
  const pause = page.getByTestId("db-enemy-preview-pause");
  await expect(pause).toBeEnabled();
  await pause.click();
  await expect(pause).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".db-enemy-idle-strip")).toHaveCSS("animation-play-state", "paused");
  await page.getByTestId("db-enemy-section-basic-tab").focus();
  await page.keyboard.press("End");
  await expect(page.getByTestId("db-enemy-section-rewards-tab")).toBeFocused();
  await page.getByTestId("db-field-enemy-gold").fill("88");
  await page.locator(".oprn-record-enemies .db-list-row").nth(1).click();
  await expect(page.getByTestId("db-enemy-section-basic-tab")).toHaveAttribute("aria-selected", "true");
  await page.locator(".oprn-record-enemies .db-list-row").first().click();
  await expect(page.getByTestId("db-enemy-section-rewards-tab")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("db-field-enemy-gold")).toHaveValue("88");
  await page.getByTestId("db-enemy-references").locator("summary").click();
  await page.getByTestId("db-enemy-references").getByRole("button", { name: /^드롭/ }).click();
  await expect(page.getByTestId("db-tab-items")).toHaveClass(/active/);
  await switchDatabaseTab(page, { label: "몬스터", slug: "enemies", testId: "db-tab-enemies" });
  await expect(page.getByTestId("db-field-enemy-gold")).toHaveValue("88");
  const before = await page.evaluate(async () => {
    const { store } = await import("/src/project/store.ts");
    return JSON.stringify(store.getCurrent());
  });
  await page.getByTestId("db-enemy-battle-test").click();
  await expect(page.getByTestId("test-play-modal-backdrop")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("test-play-modal-backdrop")).toContainText("작업실 슬라임");
  await expect(page.getByTestId("battle-scene")).toBeAttached({ timeout: 30_000 });
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("test-play-modal-backdrop")).toHaveCount(0);
  await expect(page.getByTestId("database-modal")).toBeVisible();
  await expect(page.getByTestId("db-enemy-battle-test")).toBeFocused();
  expect(await page.evaluate(async () => {
    const { store } = await import("/src/project/store.ts");
    return JSON.stringify(store.getCurrent());
  })).toBe(before);
});
