import { expect, test } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { waitForEditorProject } from "../../scripts/lib/waitForEditorProject.mjs";

test.use({ browserName: "firefox", launchOptions: {} });

const evidence = "output/evidence/battle-command-studio-p1";
test("class command placement uses actual class menus", async ({ page }) => {
  test.setTimeout(240_000);
  await mkdir(evidence, { recursive: true });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.addInitScript(() => {
    localStorage.setItem("rpg-zzu:editor-ui-mode", "expert");
    localStorage.setItem("oprn:database.activeTab", "battleCommands");
  });
  await page.goto("/?blankProject=1");
  await expect(page.getByTestId("toolbar-database")).toBeVisible({ timeout: 45_000 });
  await waitForEditorProject(page);
  await page.evaluate(async () => {
    const path = "/src/project/store.ts";
    const { store } = await import(path);
    const project = structuredClone(store.getCurrent());
    const base = project.database.classes[0];
    project.database.classes = [
      { ...base, id: "qa_class_a", name: "검과 마법을 함께 다루는 아주 긴 이름의 한국어 직업", battleCommands: [] },
      { ...base, id: "qa_class_b", name: "두 번째 직업", battleCommands: [] },
      ...project.database.classes,
    ];
    project.database.battleCommands = [
      { id: "qa_attack", name: "전방의 적을 향해 검을 휘두르는 아주 긴 한국어 공격 이름", kind: "attack" },
      { id: "qa_item", name: "가방", kind: "item" },
      { id: "qa_guard", name: "방어", kind: "guard" },
      ...project.database.battleCommands,
    ];
    store.replace(project, { change: { scope: "project", label: "QA fixture", origin: "system" } });
  });
  await page.getByTestId("toolbar-database").click();
  await expect(page.getByTestId("db-battle-command-palette")).toBeVisible();
  if (process.env.STUDIO_RED === "1") await page.screenshot({ path: `${evidence}/before-1280x800.png` });
  await expect(page.getByTestId("db-command-class-select")).toBeVisible();
  await page.getByTestId("db-command-class-select").selectOption("qa_class_b");
  await expect(page.getByTestId("db-command-menu-row")).toHaveCount(0);
  await page.getByTestId("db-command-class-select").selectOption("qa_class_a");
  await page.getByTestId("db-battle-command-card-0").dragTo(page.getByTestId("db-command-slot-0"));
  await expect(page.getByTestId("db-command-menu-row")).toHaveCount(1);
  await page.getByTestId("db-command-place-qa_item").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("db-command-menu-row")).toHaveCount(2);
  await expect(page.getByTestId("db-command-remove-qa_item")).toBeFocused();
  await page.getByTestId("db-command-menu-row").nth(1).dragTo(page.getByTestId("db-command-slot-0"));
  await expect(page.getByTestId("db-command-menu-row").first()).toHaveAttribute("data-command-id", "qa_item");
  await page.getByTestId("db-command-down-qa_item").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("db-command-menu-row").first()).toHaveAttribute("data-command-id", "qa_attack");
  await page.getByTestId("db-command-remove-qa_item").click();
  await expect(page.getByTestId("db-command-menu-row")).toHaveCount(1);
  await page.getByTestId("db-command-undo").click();
  await expect(page.getByTestId("db-command-menu-row")).toHaveCount(2);
  await page.getByTestId("db-command-class-select").selectOption("qa_class_b");
  await expect(page.getByTestId("db-command-menu-row")).toHaveCount(0);
  await page.getByTestId("db-command-class-select").selectOption("qa_class_a");
  const authored = await page.evaluate(async () => {
    const path = "/src/project/store.ts";
    const { store } = await import(path);
    return structuredClone(store.getCurrent().database.classes);
  });
  await page.getByTestId("database-footer-apply").click();
  await page.getByTestId("database-modal-close").click();
  await expect(page.getByTestId("database-modal")).toBeHidden();
  await page.getByTestId("menu-project").click();
  const downloadReady = page.waitForEvent("download", { timeout: 30_000 });
  await page.getByTestId("menu-project-export").click();
  const download = await downloadReady;
  const packagePath = `${evidence}/class-menu-roundtrip.oprn`;
  await download.saveAs(packagePath);
  await page.evaluate(async () => {
    const path = "/src/project/store.ts";
    const { store } = await import(path);
    store.update((project: { database: { classes: { id: string; battleCommands: unknown[] }[] } }) => {
      const klass = project.database.classes.find((entry) => entry.id === "qa_class_a");
      if (klass) klass.battleCommands = [];
    }, { scope: "database", collection: "classes", label: "QA reload sentinel", origin: "system" });
    const unsubscribe = store.subscribe((_project: unknown, change: { projectSwitch?: boolean }) => {
      if (!change.projectSwitch) return;
      unsubscribe();
      console.info("qa-battle-command-import-ready");
    });
  });
  await page.getByTestId("menu-project").click();
  const chooserReady = page.waitForEvent("filechooser", { timeout: 10_000 });
  await page.getByTestId("menu-project-import").click();
  const chooser = await chooserReady;
  const imported = page.waitForEvent("console", { predicate: (message) => message.text() === "qa-battle-command-import-ready", timeout: 30_000 });
  await chooser.setFiles(packagePath);
  await imported;
  expect(await page.evaluate(async () => {
    const path = "/src/project/store.ts";
    const { store } = await import(path);
    return store.getCurrent().database.classes;
  })).toEqual(authored);
  await page.getByTestId("toolbar-database").click();
  await page.getByTestId("db-command-class-select").selectOption("qa_class_a");
  await expect(page.getByTestId("db-command-menu-row")).toHaveCount(2);
  for (const viewport of [{width:1024,height:768},{width:1280,height:800},{width:1440,height:900}]) {
    await page.setViewportSize(viewport);
    await expect(page.getByTestId("db-command-menu-board")).toBeVisible();
    const geometry = await page.getByTestId("db-command-menu-board").evaluate((board) => {
      const palette = document.querySelector('[data-testid="db-battle-command-palette"]');
      const placement = board.parentElement;
      if (!palette || !placement) throw new Error("missing placement regions");
      return { viewport: innerWidth, documentWidth: document.documentElement.scrollWidth,
        paletteRight: palette.getBoundingClientRect().right, boardLeft: board.getBoundingClientRect().left,
        boardRight: board.getBoundingClientRect().right, placementRight: placement.getBoundingClientRect().right,
        contentWidth: placement.scrollWidth, availableWidth: placement.clientWidth };
    });
    expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewport);
    expect(geometry.paletteRight).toBeLessThanOrEqual(geometry.boardLeft);
    expect(geometry.boardRight).toBeLessThanOrEqual(geometry.placementRight + 1);
    expect(geometry.contentWidth).toBeLessThanOrEqual(geometry.availableWidth);
    await writeFile(`${evidence}/geometry-${viewport.width}x${viewport.height}.json`, JSON.stringify(geometry, null, 2));
    await page.screenshot({ path: `${evidence}/after-${viewport.width}x${viewport.height}.png` });
  }
});
