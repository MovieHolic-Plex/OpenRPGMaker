import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";

test("world canon and codex preserve authoring across save, navigation, search, and narrow layouts", async ({ page }) => {
  test.setTimeout(240_000);
  const output = "verify-shots/world-authoring-fixes";
  await mkdir(output, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => localStorage.setItem("rpg-zzu:editor-ui-mode", "expert"));
  // Host netlink churn can cancel Chromium's localhost module loads. Node's HTTP
  // client transports the same bytes; app code and all UI interactions stay real.
  if (process.env.WORLD_QA_ROUTE_MODULES === "1") {
    await page.route((url) => url.hostname === "127.0.0.1" && url.port === (process.env.DEV_SERVER_PORT ?? "9173"), async (route) => {
      if (route.request().method() !== "GET") return route.continue();
      const response = await fetch(route.request().url());
      const headers = Object.fromEntries(response.headers);
      delete headers["content-encoding"]; delete headers["content-length"];
      await route.fulfill({ status: response.status, headers, body: Buffer.from(await response.arrayBuffer()) });
    });
  }
  await page.goto("/?blankProject=1", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 90_000 });
  for (const id of ["login-guest", "standard-welcome-start", "coach-mark-skip"]) {
    const button = page.getByTestId(id); if (await button.isVisible()) await button.click();
  }
  await page.getByTestId("toolbar-database").click();
  async function tab(id: string) {
    const button = page.getByTestId(id);
    if (!await button.isVisible()) await page.getByTestId("db-tab-group-lore").click();
    await button.click(); await expect(button).toHaveClass(/active/);
  }
  await tab("db-tab-world-canon");
  const power = page.getByTestId("db-world-canon-law-power-note");
  const gods = page.getByTestId("db-world-canon-law-gods-note");
  await power.fill("피의 대가"); await gods.fill("신 없음");
  await page.getByTestId("db-world-canon-law-gods-present").getByText("없음", { exact: true }).click();
  await expect(power).toHaveValue("피의 대가"); await expect(gods).toHaveValue("신 없음");
  await page.getByTestId("db-world-canon-name").fill("가".repeat(150));
  await expect(page.getByTestId("db-world-canon-name")).toHaveValue("가".repeat(120));
  await page.screenshot({ path: `${output}/canon.png` });
  await tab("db-tab-world-codex");
  await page.getByTestId("world-add-entity").click();
  await page.getByTestId("world-edit-name").fill("검색검증카드");
  await page.getByTestId("world-edit-summary").fill("저장할 요약");
  await expect(page.getByTestId("db-footer-status")).toContainText("저장 전");
  await page.getByTestId("world-tab-character").click();
  await expect(page.getByTestId("world-edit-name")).toHaveValue("검색검증카드");
  await tab("db-tab-world-canon");
  await page.getByTestId("db-world-canon-premise").fill("캐시 무효화 후에도 카드 초안 보존");
  await tab("db-tab-world-codex");
  await expect(page.getByTestId("world-edit-summary")).toHaveValue("저장할 요약");
  await page.getByTestId("database-footer-ok").click();
  await expect(page.getByTestId("database-dirty-prompt-region")).toContainText(/저장|변경/);
  const keep = page.getByTestId("database-dirty-prompt-region").getByRole("button", { name: /계속|편집/ });
  await keep.click();
  await page.getByTestId("database-footer-apply").click();
  await expect(page.getByTestId("db-footer-status")).toContainText("닫아도 안전");
  await page.getByTestId("database-footer-ok").click();
  await expect(page.getByTestId("database-modal")).toHaveCount(0);
  await page.getByTestId("toolbar-database").click(); await tab("db-tab-world-codex");
  const card = page.locator(".world-card").first();
  await expect(card).toContainText("검색검증카드");
  await page.getByTestId("world-search").focus(); await page.keyboard.type("검색검증", { delay: 30 });
  await expect(page.getByTestId("world-search")).toHaveValue("검색검증");
  await expect(page.getByTestId("world-search")).toBeFocused();
  await page.getByTestId("world-search").fill(""); await card.click();
  const lock = card.getByTestId("world-lock-toggle");
  await lock.focus(); await page.keyboard.press("Enter"); await expect(lock).toHaveText("잠김");
  await lock.focus(); await page.keyboard.press("Space"); await expect(lock).toHaveText("열림");
  await lock.click(); await expect(lock).toHaveText("잠김");
  await page.screenshot({ path: `${output}/codex-locked.png` });
  await expect(page.getByTestId("world-delete-entity")).toBeDisabled();
  await lock.click();
  for (const width of [1024, 900, 800]) {
    await page.setViewportSize({ width, height: 800 });
    const edit = page.getByTestId("world-edit-toggle");
    await expect(async () => {
      for (const target of [edit, card.locator(".world-card-title")]) {
        const hit = await target.evaluate((node) => {
          const rect = node.getBoundingClientRect();
          const top = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
          return top === node || node.contains(top);
        });
        expect(hit).toBe(true);
      }
    }).toPass({ timeout: 10_000 });
    await page.screenshot({ path: `${output}/codex-${width}.png` });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  page.once("dialog", (dialog) => dialog.dismiss()); await page.getByTestId("world-delete-entity").click();
  await expect(card).toHaveCount(1);
  page.once("dialog", (dialog) => dialog.accept()); await page.getByTestId("world-delete-entity").click();
  await expect(page.locator(".world-card")).toHaveCount(0);
});
