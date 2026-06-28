import { expect, test } from "@playwright/test";
import {
  audioState,
  C002_SCREENSHOT,
  recoveryItemProject,
  runtimeState,
  startActualPlay,
} from "./rm2k3PlayerStatusMenuHelpers";

test("fullscreen item target, equipment, row, and formation actions mutate runtime state", async ({ page }) => {
  const recoveryAmount = 77;
  await startActualPlay(page, recoveryItemProject(recoveryAmount), "/?e2eVitals=1");
  const before = await runtimeState(page);
  const firstActorId = before.partyActorIds[0];
  const secondActorId = before.partyActorIds[1];
  if (!firstActorId || !secondActorId) throw new Error("missing party actors");
  await lowerActorHp(page, secondActorId);

  await page.keyboard.press("X");
  await page.getByTestId("status-menu-command-items").click();
  await page.getByTestId("status-menu-use-item_potion").click();
  await expect(page.getByTestId("status-menu-detail-title")).toContainText("대상 선택");
  await page.getByTestId(`status-menu-item-target-${secondActorId}`).click();
  await expect(page.getByTestId("status-menu-message")).toContainText("테스트 회복약을 사용했습니다");
  await expect.poll(async () => (await runtimeState(page)).actorVitals[secondActorId]?.hp).toBe(30 + recoveryAmount);
  await expect.poll(async () => (await audioState(page)).se?.resourceId).toBe("easyrpg-sound-item1");
  expect((await runtimeState(page)).inventory.item_potion).toBe(1);

  await page.keyboard.press("X");
  await page.getByTestId("status-menu-command-equipment").click();
  await page.getByTestId(`status-menu-equipment-actor-${firstActorId}`).click();
  await page.getByTestId("status-menu-equipment-slot-weapon").click();
  await page.getByTestId("status-menu-equip-equip_scout_dagger").click();
  const afterEquip = await runtimeState(page);
  expect(afterEquip.actorEquipment[firstActorId]?.weapon).toBe("equip_scout_dagger");
  expect(afterEquip.inventory.equip_scout_dagger).toBeUndefined();
  expect(afterEquip.inventory.equip_sword).toBe(1);

  await page.keyboard.press("X");
  await page.getByTestId("status-menu-command-row").click();
  await page.getByTestId(`status-menu-row-toggle-${firstActorId}`).click();
  expect((await runtimeState(page)).actorRows[firstActorId]).toBe("back");

  await page.keyboard.press("X");
  await page.getByTestId("status-menu-command-formation").click();
  await page.getByTestId(`status-menu-formation-actor-${secondActorId}`).click();
  await page.getByTestId("status-menu-formation-move-up").click();
  expect((await runtimeState(page)).partyActorIds[0]).toBe(secondActorId);
  await page.getByTestId("main-menu").screenshot({ path: C002_SCREENSHOT });
});

test("uses a DB-edited recovery item from the status menu", async ({ page }, testInfo) => {
  const recoveryAmount = 77;
  await startActualPlay(page, recoveryItemProject(recoveryAmount), "/?e2eVitals=1");
  const actorId = (await runtimeState(page)).partyActorIds[0];
  if (!actorId) throw new Error("missing party actor");
  await lowerActorHp(page, actorId);

  await page.keyboard.press("X");
  await expect(page.getByTestId("main-menu")).toBeVisible();
  await page.getByTestId("status-menu-command-items").click();
  await expect(page.getByTestId("status-menu-detail")).toContainText("테스트 회복약");
  await page.getByTestId("status-menu-use-item_potion").click();
  await expect(page.getByTestId("status-menu-detail-title")).toContainText("대상 선택");
  await page.getByTestId(`status-menu-item-target-${actorId}`).click();

  await expect(page.getByTestId("status-menu-message")).toContainText("테스트 회복약을 사용했습니다");
  await expect.poll(async () => (await runtimeState(page)).actorVitals[actorId]?.hp).toBe(30 + recoveryAmount);
  await expect.poll(async () => (await audioState(page)).se?.resourceId).toBe("easyrpg-sound-item1");
  expect((await runtimeState(page)).inventory.item_potion).toBe(1);
  await page.getByTestId("main-menu").screenshot({ path: testInfo.outputPath("status-menu-item-use-db-edited-recovery.png") });
});

async function lowerActorHp(page: import("@playwright/test").Page, actorId: string): Promise<void> {
  await expect
    .poll(async () =>
      page.evaluate(() => typeof window.__rpgzzuSetActorVitals)
    )
    .toBe("function");
  await page.evaluate((id) => {
    window.__rpgzzuSetActorVitals?.(id, 30, 0);
  }, actorId);
  await expect.poll(async () => (await runtimeState(page)).actorVitals[actorId]?.hp).toBe(30);
}
