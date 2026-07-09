import { expect, test, type Locator, type Page } from "@playwright/test";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";
import {
  exportedProject,
  makeCommerceProject,
  makeInsufficientCommerceProject,
  makeInnRecoveryProject,
  runtimeState,
  tapKey,
} from "./rm2k3-commerce-fixtures";
import { startNewGameFromTitle } from "./runtimeInput";

type PickerCommand = {
  readonly kind: "shop" | "inn";
  readonly testId: "command-picker-add-shop" | "command-picker-add-inn";
};

async function clickMapTile(page: Page, x: number, y: number): Promise<void> {
  const canvas = page.getByTestId("edit-canvas").locator("canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("missing editor canvas");
  const project = await exportedProject(page);
  const map = project.maps[project.startMapId];
  const zoom = 2;
  const tileSize = map.tileSize * zoom;
  const mapLeft = Math.floor((box.width - map.width * tileSize) / 2);
  const mapTop = Math.floor((box.height - map.height * tileSize) / 2);
  await canvas.dblclick({ position: { x: mapLeft + x * tileSize + tileSize / 2, y: mapTop + y * tileSize + tileSize / 2 } });
}

async function addCommerceCommand(page: Page, command: PickerCommand): Promise<Locator> {
  await page.getByTestId("event-command-empty-line").dblclick();
  const picker = page.getByTestId("event-command-picker");
  await expect(picker).toBeVisible();
  await picker.getByTestId("event-command-picker-tab-2").click();
  await picker.getByTestId(command.testId).click();
  await expect(picker).toBeHidden();
  const commandRow = page.getByTestId(`event-command-${command.kind}`).first();
  await expect(commandRow).toBeVisible();
  await commandRow.locator(".cmd-head").dblclick();
  await expect(commandRow).toHaveClass(/editing/);
  return commandRow;
}

async function openEventEditorAtMapTile(page: Page): Promise<void> {
  await page.getByTestId("layer-event").click();
  await page.getByTestId("tool-event").click();
  await clickMapTile(page, 1, 1);

  const editor = page.getByTestId("event-editor-modal");
  try {
    await expect(editor).toBeVisible({ timeout: 1000 });
  } catch {
    await page.getByTestId("event-editor-open").click();
    await expect(editor).toBeVisible();
  }
  await expect(page.getByTestId("event-command-empty-line")).toBeVisible();
}

async function waitForRuntimeInput(page: Page): Promise<void> {
  await expect
    .poll(async () =>
      page.evaluate(() => typeof (window as unknown as { __rpgzzuInput?: unknown }).__rpgzzuInput)
    )
    .toBe("object");
}

test("shop and inn commands are readable in the editor and playable at runtime", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const authoringProject = makeCommerceProject();
  authoringProject.maps.map_shop.events = [];
  await seedProjectFromSupabaseCanonical(page, authoringProject);
  await openEventEditorAtMapTile(page);

  await expect(page.getByTestId("event-command-kind-select")).toHaveCount(0);
  await expect(page.getByTestId("event-command-add")).toHaveCount(0);

  const shopCommand = await addCommerceCommand(page, { kind: "shop", testId: "command-picker-add-shop" });
  await shopCommand.getByTestId("shop-available-items").selectOption("item_potion");
  await shopCommand.getByTestId("shop-add-item").click();
  await expect(shopCommand.getByTestId("shop-selected-items")).toHaveValue("item_potion");
  await expect(shopCommand).toContainText("Type");
  await expect(shopCommand).toContainText("Available Items");
  await page.screenshot({ path: testInfo.outputPath("shop-editor-readable.png"), fullPage: true });

  const innCommand = await addCommerceCommand(page, { kind: "inn", testId: "command-picker-add-inn" });
  await innCommand.getByTestId("inn-price-input").fill("25");
  await innCommand.getByTestId("inn-price-input").blur();
  await expect(innCommand).toContainText("여관 요금");
  await page.getByTestId("event-editor-apply").click();
  await page.screenshot({ path: testInfo.outputPath("shop-inn-editor-readable.png"), fullPage: true });
  const authoredCommands = Object.values((await exportedProject(page)).maps).flatMap((map) =>
    map.events.flatMap((event) => [
      ...(event.commands ?? []),
      ...(event.pages ?? []).flatMap((eventPage) => eventPage.commands),
    ])
  );
  expect(authoredCommands).toContainEqual(expect.objectContaining({ kind: "shop", itemIds: ["item_potion"] }));
  expect(authoredCommands).toContainEqual(expect.objectContaining({ kind: "inn", price: 25 }));
  await shopCommand.locator(".cmd-head").dblclick();
  await expect(shopCommand).toHaveClass(/editing/);
  await shopCommand.getByTestId("shop-type-sellOnly").check();
  await shopCommand.locator(".cmd-head").dblclick();
  await expect(shopCommand).toHaveClass(/editing/);
  await shopCommand.getByTestId("shop-branch-on-transaction").check();
  await shopCommand.locator(".cmd-head").dblclick();
  await expect(shopCommand).toHaveClass(/editing/);
  await expect(shopCommand.getByTestId("shop-transaction-branch-controls")).toBeVisible();
  await shopCommand.getByTestId("shop-add-transaction-branch-command").click();
  await page.getByTestId("event-editor-apply").click();
  const authoredCommerceCommands = Object.values((await exportedProject(page)).maps).flatMap((map) =>
    map.events.flatMap((event) => [
      ...(event.commands ?? []),
      ...(event.pages ?? []).flatMap((eventPage) => eventPage.commands),
    ])
  );
  expect(authoredCommerceCommands).toContainEqual(
    expect.objectContaining({
      kind: "shop",
      itemIds: ["item_potion"],
      allowSell: true,
      shopType: "sellOnly",
      messageType: "welcome",
      branchOnTransaction: true,
      transactionBranch: [expect.objectContaining({ kind: "text" })],
    })
  );

  await page.getByTestId("event-editor-modal-close").click();
  await expect(page.getByTestId("event-editor-modal")).toHaveCount(0);
  await seedProjectFromSupabaseCanonical(page, makeCommerceProject());
  await page.getByTestId("mode-play").click();
  await startNewGameFromTitle(page);
  await waitForRuntimeInput(page);
  await expect.poll(async () => page.evaluate(() => "__rpgzzuSetActorVitals" in window)).toBe(false);
  await page.getByTestId("play-canvas").locator("canvas").click();
  await tapKey(page, "Space");

  await expect(page.getByTestId("shop-scene")).toContainText("Welcome.");
  await page.screenshot({ path: testInfo.outputPath("shop-runtime-menu-readable.png"), fullPage: true });
  await page.getByTestId("shop-mode-buy").click();
  await expect(page.getByTestId("shop-scene")).toContainText("회복약");
  await page.screenshot({ path: testInfo.outputPath("shop-runtime-items-readable.png"), fullPage: true });
  await page.getByTestId("shop-buy-item_potion").click();

  await expect(page.getByTestId("inn-scene")).toContainText("여관");
  await expect(page.getByTestId("inn-scene")).toContainText("25 G");
  await page.screenshot({ path: testInfo.outputPath("inn-runtime-readable.png"), fullPage: true });
  await page.getByTestId("inn-stay").click();

  await expect.poll(async () => (await runtimeState(page)).gold).toBe(63);
  const runtime = await runtimeState(page);
  expect(runtime.inventory.item_potion).toBe(1);
});

test("common event inline commands use readable Korean command labels", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await seedProjectFromSupabaseCanonical(page, makeCommerceProject());
  await page.getByTestId("toolbar-database").click();
  await page.getByTestId("db-tab-common-events").click();

  await expect(page.getByTestId("db-detail-form")).toContainText("상점 공용 이벤트");
  await expect(page.getByTestId("db-detail-form")).toContainText("상점 처리");
  await expect(page.getByTestId("db-detail-form")).toContainText("+ 문장 표시");
  await expect(page.getByTestId("db-detail-form")).not.toContainText("+ text");
  await page.screenshot({ path: testInfo.outputPath("common-event-inline-readable.png"), fullPage: true });
});

test("shop and inn keep the player in the panel when gold is insufficient", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await seedProjectFromSupabaseCanonical(page, makeInsufficientCommerceProject());
  await page.getByTestId("mode-play").click();
  await startNewGameFromTitle(page);
  await waitForRuntimeInput(page);
  await page.getByTestId("play-canvas").locator("canvas").click();
  await tapKey(page, "Space");

  await page.getByTestId("shop-mode-buy").click();
  await page.getByTestId("shop-buy-item_potion").click();
  await expect(page.getByTestId("shop-scene")).toContainText("Not enough money.");
  await expect(page.getByTestId("shop-scene")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("shop-insufficient-gold-readable.png"), fullPage: true });
  await page.getByTestId("shop-item-cancel").click();
  await page.getByTestId("shop-menu-cancel").click();

  await expect(page.getByTestId("inn-scene")).toContainText("25 G");
  await page.getByTestId("inn-stay").click();
  await expect(page.getByTestId("inn-scene")).toContainText("소지금이 부족합니다.");
  await expect(page.getByTestId("inn-scene")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("inn-insufficient-gold-readable.png"), fullPage: true });
});

test("shop supports quantity purchase and item selling when enabled", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const project = makeCommerceProject();
  const pageCommands = project.maps.map_shop.events[0]?.pages?.[0]?.commands;
  if (!pageCommands) throw new Error("missing commerce commands");
  pageCommands[1] = { kind: "shop", itemIds: ["item_potion"], allowSell: true, quantityMode: "select" };
  await seedProjectFromSupabaseCanonical(page, project);
  await page.getByTestId("mode-play").click();
  await startNewGameFromTitle(page);
  await waitForRuntimeInput(page);
  await page.getByTestId("play-canvas").locator("canvas").click();
  await tapKey(page, "Space");

  await page.getByTestId("shop-mode-buy").click();
  await page.getByTestId("shop-quantity-input").fill("2");
  await page.screenshot({ path: testInfo.outputPath("shop-quantity-buy-readable.png"), fullPage: true });
  await page.getByTestId("shop-buy-item_potion").click();
  await expect(page.getByTestId("inn-scene")).toBeVisible();
  let runtime = await runtimeState(page);
  expect(runtime.gold).toBe(76);
  expect(runtime.inventory.item_potion).toBe(2);
  await page.getByTestId("inn-cancel").click();

  await tapKey(page, "Space");
  await page.getByTestId("shop-mode-sell").click();
  await page.getByTestId("shop-quantity-input").fill("3");
  await page.getByTestId("shop-sell-item_potion").click();
  await expect(page.getByTestId("shop-scene")).toContainText("You do not have enough.");
  await page.getByTestId("shop-quantity-input").fill("1");
  await page.getByTestId("shop-sell-item_potion").click();
  await expect(page.getByTestId("shop-scene")).toContainText("sold.");
  await page.screenshot({ path: testInfo.outputPath("shop-sell-readable.png"), fullPage: true });
  runtime = await runtimeState(page);
  expect(runtime.gold).toBe(182);
  expect(runtime.inventory.item_potion).toBe(1);
});

test("inn restores party HP and MP after payment", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await seedProjectFromSupabaseCanonical(page, makeInnRecoveryProject(), "/?e2eVitals=1");
  await page.getByTestId("mode-play").click();
  await startNewGameFromTitle(page);
  await waitForRuntimeInput(page);
  await page.getByTestId("play-canvas").locator("canvas").click();
  const before = await runtimeState(page);
  const actorId = before.partyActorIds[0];
  if (!actorId) throw new Error("missing party actor");
  await expect
    .poll(async () =>
      page.evaluate(() => typeof (window as unknown as { __rpgzzuSetActorVitals?: unknown }).__rpgzzuSetActorVitals)
    )
    .toBe("function");
  await page.evaluate((id) => {
    const testWindow = window as unknown as { __rpgzzuSetActorVitals?: (actorId: string, hp: number, mp: number) => void };
    testWindow.__rpgzzuSetActorVitals?.(id, 1, 0);
  }, actorId);
  await expect.poll(async () => (await runtimeState(page)).actorVitals[actorId]?.hp).toBe(1);
  await expect.poll(async () => (await runtimeState(page)).actorVitals[actorId]?.mp).toBe(0);
  await tapKey(page, "Space");

  await expect(page.getByTestId("inn-scene")).toContainText("여관");
  await page.screenshot({ path: testInfo.outputPath("inn-recovery-readable.png"), fullPage: true });
  await page.getByTestId("inn-stay").click();
  const after = await runtimeState(page);
  expect(after.actorVitals[actorId]?.hp).toBe(after.actorVitals[actorId]?.maxHp);
  expect(after.actorVitals[actorId]?.mp).toBe(after.actorVitals[actorId]?.maxMp);
  expect(after.gold).toBe(75);
});
