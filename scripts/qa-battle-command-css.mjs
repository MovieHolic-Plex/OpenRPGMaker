// End-to-end authoring proof: editor controls -> serialized project -> shipped player.
import { firefox, expect } from "@playwright/test";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { startPlayerQaServer, runRuntimeQa } from "./lib/runtimeQaRun.mjs";
import battleScenario from "./qa/runtime/battle-rm2000.scenario.mjs";
import { waitForEditorProject } from "./lib/waitForEditorProject.mjs";

const output = resolve("output/evidence/battle-command-css");
await mkdir(output, { recursive: true });
const browser = await firefox.launch({ headless: true });
let server;
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.addInitScript(() => {
    localStorage.setItem("rpg-zzu:editor-ui-mode", "expert");
    localStorage.setItem("oprn:database.activeTab", "battleCommands");
  });
  await page.goto(`http://127.0.0.1:${process.env.DEV_SERVER_PORT ?? "19841"}/?blankProject=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await expect(page.getByTestId("toolbar-database")).toBeVisible({ timeout: 120000 });
  await waitForEditorProject(page);
  const fixture = await readFile("test/fixtures/projects/battle-v3.json", "utf8");
  await page.evaluate(async (json) => {
    const storePath = "/src/project/store.ts";
    const ioPath = "/src/project/io.ts";
    const { store } = await import(storePath);
    const { deserialize } = await import(ioPath);
    store.replace(deserialize(json));
  }, fixture);
  await page.getByTestId("toolbar-database").click();
  // Reorder the class through the real editor, not by changing its fixture array.
  await page.getByTestId("db-command-class-select").selectOption("class_fighter");
  await page.getByTestId("db-command-place-cmd_attack").click();
  await expect(page.getByTestId("db-command-menu-row")).toHaveCount(1);
  await page.getByTestId("db-command-place-cmd_skill").click();
  await expect(page.getByTestId("db-command-menu-row")).toHaveCount(2);
  await page.getByTestId("db-command-place-cmd_item").click();
  await expect(page.getByTestId("db-command-menu-row")).toHaveCount(3);
  const firstRow = page.getByTestId("db-command-menu-row").first();
  const firstId = await firstRow.getAttribute("data-command-id");
  await firstRow.dragTo(page.getByTestId("db-command-slot-2"));
  const expectedOrder = await page.getByTestId("db-command-menu-row").evaluateAll((rows) => rows.map((row) => row.getAttribute("data-command-id")));
  expect(expectedOrder[1]).toBe(firstId);
  expect(expectedOrder).toEqual(["cmd_skill", "cmd_attack", "cmd_item"]);
  const css = ".command { color: #e8f0ff; background-color: #25324a; border-radius: 8px; }\n.command:focus-visible { background-color: #4a57d6; }";
  await page.getByTestId("db-command-css-input").fill(css);
  await page.getByTestId("db-command-css-apply").click();
  await expect(page.getByTestId("db-command-css-preview").locator(".battle-command").first()).toHaveCSS("color", "rgb(232, 240, 255)");
  for (const width of [1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.getByTestId("db-command-css-editor").scrollIntoViewIfNeeded();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    expect(overflow).toBe(false);
    await page.screenshot({ path: `${output}/editor-${width}.png` });
  }
  await page.getByTestId("database-footer-apply").click();
  const project = await page.evaluate(async () => {
    const storePath = "/src/project/store.ts";
    const ioPath = "/src/project/io.ts";
    const { store } = await import(storePath);
    const { serialize } = await import(ioPath);
    return serialize(store.getCurrent());
  });
  const projectPath = `${output}/authored-project.json`;
  await writeFile(projectPath, project);
  await page.close();

  server = await startPlayerQaServer();
  const player = await browser.newPage();
  const report = await runRuntimeQa(player, {
    ...battleScenario, id: "battle-command-css", projectFixture: projectPath,
  }, { serverUrl: server.url, outDir: `${output}/runtime` });
  expect(report.errors).toEqual([]);
  expect(report.beats.flatMap((beat) => beat.failures)).toEqual([]);
  const buttons = player.getByTestId("battle-command-grid").locator(".battle-command");
  await expect(buttons.first()).toHaveCSS("color", "rgb(232, 240, 255)");
  await expect(buttons.first()).toHaveCSS("border-radius", "8px");
  const runtimeIds = await buttons.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-testid")));
  expect(runtimeIds.slice(0, 2)).toEqual(["actor-command-skill", "actor-command-attack"]);
  // One learned skill uses the existing direct-target shortcut.
  await expect(player.getByTestId("actor-command-skill")).toHaveAttribute("data-battle-command-cursor", "true");
  await player.keyboard.press("Enter");
  await expect(player.getByTestId("battle-target-enemy-1")).toBeVisible();
  await expect(player.getByTestId("battle-target-enemy-1")).toHaveCSS("color", "rgb(232, 240, 255)");
  await player.keyboard.press("Escape");
  await expect(player.getByTestId("actor-command-attack")).toBeVisible();
  await player.keyboard.press("ArrowDown");
  await player.keyboard.press("ArrowDown");
  await expect(player.getByTestId("actor-command-item")).toHaveAttribute("data-battle-command-cursor", "true");
  await player.keyboard.press("Enter");
  await expect(player.getByTestId("actor-item-item_bomb")).toBeVisible();
  await expect(player.getByTestId("actor-item-item_bomb")).toHaveCSS("color", "rgb(232, 240, 255)");
  await player.screenshot({ path: `${output}/runtime-item.png` });
  await player.keyboard.press("Escape");
  await expect(player.getByTestId("actor-command-item")).toBeVisible();
  await player.keyboard.press("ArrowUp");
  await expect(player.getByTestId("actor-command-attack")).toHaveAttribute("data-battle-command-cursor", "true");
  await player.keyboard.press("Enter");
  await expect(player.getByTestId("battle-target-enemy-1")).toBeVisible();
  await expect(player.getByTestId("battle-target-enemy-1")).toHaveCSS("border-radius", "8px");
  await player.screenshot({ path: `${output}/runtime-target.png` });
  const before = await player.getByTestId("battle-enemy-list-hp-enemy-1").textContent();
  await player.getByTestId("battle-enemy-list-hp-enemy-1").evaluate((node) => {
    const before = node.textContent;
    const observer = new MutationObserver(() => {
      if (node.textContent === before) return;
      observer.disconnect();
      console.info(`qa-command-damage:${node.textContent}`);
    });
    observer.observe(node, { childList: true, characterData: true, subtree: true });
  });
  const damageReady = player.waitForEvent("console", { predicate: (message) => message.text().startsWith("qa-command-damage:"), timeout: 30000 });
  await player.keyboard.press("Enter");
  const damage = (await damageReady).text();
  await expect(player.getByTestId("battle-target-enemy-1")).toHaveCount(0);
  await player.screenshot({ path: `${output}/runtime-action.png` });
  await writeFile(`${output}/result.json`, JSON.stringify({ expectedOrder, runtimeIds, css, before, damage, report }, null, 2));
  console.log(`PASS: editor drag/CSS -> serialized reload -> shipped-player menu, skill target, item submenu and attack damage. Evidence: ${output}`);
} finally {
  await browser.close();
  await server?.close();
}
