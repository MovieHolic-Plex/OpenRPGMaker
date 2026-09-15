import { expect, test } from "@playwright/test";
import { waitForEditorProject } from "../../scripts/lib/waitForEditorProject.mjs";

test.use({ browserName: "firefox", launchOptions: {} });

test("authors scoped command CSS and restores it after project export and import", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.addInitScript(() => {
    localStorage.setItem("oprn:editor-ui-mode", "expert");
    localStorage.setItem("oprn:database.activeTab", "battleCommands");
  });
  await page.goto("/?blankProject=1");
  await waitForEditorProject(page);
  await page.getByTestId("toolbar-database").click({ timeout: 45_000 });
  const editor = page.getByTestId("db-command-css-input");
  await expect(editor).toBeVisible();
  await editor.fill(".command { color: #123456; background-color: #eeeeee; border-radius: 8px; }");
  await page.getByTestId("db-command-preview-switch").check();
  await expect(editor).toHaveValue(".command { color: #123456; background-color: #eeeeee; border-radius: 8px; }");
  await page.getByTestId("db-command-css-apply").click();
  const preview = page.getByTestId("db-command-css-preview");
  await expect(preview.locator(".battle-command").first()).toHaveCSS("color", "rgb(18, 52, 86)");
  await editor.fill("body { display: none; }");
  await page.getByTestId("db-command-preview-switch").uncheck();
  await expect(editor).toHaveValue("body { display: none; }");
  await expect(page.getByTestId("db-command-css-apply")).toBeDisabled();
  await expect(preview.locator(".battle-command").first()).toHaveCSS("color", "rgb(18, 52, 86)");
  await page.getByTestId("db-command-css-revert").click();
  await expect(editor).toHaveValue(".command { color: #123456; background-color: #eeeeee; border-radius: 8px; }");
  await page.getByTestId("database-footer-apply").click();
  await page.getByTestId("database-modal-close").click();
  await page.getByTestId("menu-project").click();
  const downloadReady = page.waitForEvent("download");
  await page.getByTestId("menu-project-export").click();
  const download = await downloadReady;
  const path = test.info().outputPath("command-css.oprn");
  await download.saveAs(path);
  await page.getByTestId("toolbar-database").click();
  await page.getByTestId("db-command-css-reset").click();
  await expect(editor).toHaveValue("");
  await page.getByTestId("database-footer-apply").click();
  await page.getByTestId("database-modal-close").click();
  await page.getByTestId("menu-project").click();
  const chooserReady = page.waitForEvent("filechooser");
  await page.getByTestId("menu-project-import").click();
  const chooser = await chooserReady;
  await page.evaluate(async () => {
    const path = "/src/project/store.ts";
    const { store } = await import(path);
    const unsubscribe = store.subscribe((_project: unknown, change: { projectSwitch?: boolean }) => {
      if (!change.projectSwitch) return;
      unsubscribe();
      console.info("command-css-import-ready");
    });
  });
  const imported = page.waitForEvent("console", { predicate: (message) => message.text() === "command-css-import-ready" });
  await chooser.setFiles(path);
  await imported;
  await page.getByTestId("toolbar-database").click();
  await expect(editor).toHaveValue(".command { color: #123456; background-color: #eeeeee; border-radius: 8px; }");
  await expect(preview.locator(".battle-command").first()).toHaveCSS("color", "rgb(18, 52, 86)");
  await page.screenshot({ path: test.info().outputPath("command-css-restored.png") });
});
