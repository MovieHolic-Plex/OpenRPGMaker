import { expect, test, type Page } from "@playwright/test";
import {
  recoveryItemProject,
  startActualPlay,
} from "./rm2k3PlayerStatusMenuHelpers";

test.setTimeout(120_000);

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
});

test("RM2K3 play menu keyboard tour mutates and restores runtime state", async ({ page }) => {
  await startActualPlay(page, recoveryItemProject(77), "/?e2eVitals=1");
  await clearSaveSlots(page);
  const initial = await runtimeSnapshot(page);
  const firstActorId = initial.partyActorIds[0];
  const secondActorId = initial.partyActorIds[1];
  const fourthActorId = initial.partyActorIds[3];
  if (!firstActorId || !secondActorId || !fourthActorId) throw new Error("missing party actors");
  await setActorHp(page, secondActorId, 30);

  await openMenu(page);

  await openCommand(page, "items", "아이템");
  await focusDetailAction(page, "status-menu-item-item_potion");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("status-menu-detail-title")).toHaveText("대상 선택: 테스트 회복약");
  await focusDetailAction(page, `status-menu-item-target-${secondActorId}`);
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("status-menu-message")).toContainText("테스트 회복약을 사용했습니다");
  await expect.poll(async () => (await runtimeSnapshot(page)).actorVitals[secondActorId]?.hp).toBe(107);
  expect((await runtimeSnapshot(page)).inventory.item_potion).toBe(1);
  await backToRail(page);

  await openCommand(page, "skills", "스킬");
  await focusDetailAction(page, `status-menu-skill-actor-${firstActorId}`);
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("status-menu-detail-title")).toContainText("스킬:");
  await expect(page.getByTestId("status-menu-detail")).toContainText("공격");
  await page.keyboard.press("Enter");
  await backToRail(page);

  await openCommand(page, "equipment", "장비");
  await focusDetailAction(page, `status-menu-equipment-actor-${firstActorId}`);
  await page.keyboard.press("Enter");
  await focusDetailAction(page, "status-menu-equipment-slot-weapon");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("status-menu-detail")).toContainText("해제");
  await expect(page.getByTestId("status-menu-detail")).toContainText(/공격 [+-]\d+/);
  await focusDetailAction(page, "status-menu-equipment-item-equip_scout_dagger");
  await page.keyboard.press("Enter");
  await expect.poll(async () => (await runtimeSnapshot(page)).actorEquipment[firstActorId]?.weapon).toBe("equip_scout_dagger");
  await backToRail(page);

  await openCommand(page, "save", "저장");
  await focusDetailAction(page, "save-slot-1");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("status-menu-message")).toContainText("1번 저장 칸에 저장했습니다");
  await expect(page.getByTestId("save-slot-1")).toContainText(/L\d+/);
  const saved = await runtimeSnapshot(page);
  await mutatePositionAndInventory(page, saved.mapId, saved.player.x + 1, saved.player.y);
  await backToRail(page);
  await openCommand(page, "load", "로드");
  await focusDetailAction(page, "load-slot-1");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("main-menu")).toHaveCount(0);
  await expect.poll(async () => (await runtimeSnapshot(page)).player).toEqual(saved.player);
  expect((await runtimeSnapshot(page)).inventory).toEqual(saved.inventory);

  await openMenu(page);
  await openCommand(page, "row", "열 바꾸기");
  await focusDetailAction(page, `status-menu-row-${firstActorId}`);
  await page.keyboard.press("Enter");
  await expect.poll(async () => (await runtimeSnapshot(page)).actorRows[firstActorId]).toBe("back");
  await backToRail(page);

  await openCommand(page, "formation", "진형");
  await focusDetailAction(page, `status-menu-formation-actor-${firstActorId}`);
  await page.keyboard.press("Enter");
  await focusDetailAction(page, `status-menu-formation-actor-${fourthActorId}`);
  await page.keyboard.press("Enter");
  await expect.poll(async () => (await runtimeSnapshot(page)).partyActorIds[3]).toBe(firstActorId);
  await backToRail(page);

  await openCommand(page, "quests", "임무");
  await expect(page.getByTestId("status-menu-detail-title")).toHaveText("임무");
  await backToRail(page);

  await selectCommand(page, "wait");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("status-menu-command-wait")).toContainText("대기 OFF");
  await backToRail(page);

  await selectCommand(page, "to-title");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("title-screen")).toBeVisible();
});

type MenuState = {
  readonly selectedCommand: string;
  readonly mode: "function" | "main";
};

type RuntimeSnapshot = {
  readonly mapId: string;
  readonly player: { readonly x: number; readonly y: number };
  readonly inventory: Record<string, number>;
  readonly partyActorIds: readonly string[];
  readonly actorVitals: Record<string, { readonly hp: number; readonly mp: number; readonly maxHp: number; readonly maxMp: number }>;
  readonly actorEquipment: Record<string, { readonly weapon?: string; readonly shield?: string; readonly armor?: string; readonly helmet?: string; readonly accessory?: string }>;
  readonly actorRows: Record<string, "front" | "back">;
};

async function openMenu(page: Page): Promise<void> {
  if ((await page.getByTestId("main-menu").count()) === 0) await page.keyboard.press("X");
  await expect(page.getByTestId("main-menu")).toBeVisible();
  await backToRail(page);
}

async function openCommand(page: Page, commandId: string, title: string): Promise<void> {
  await selectCommand(page, commandId);
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("status-menu-detail-title")).toHaveText(title);
}

async function selectCommand(page: Page, commandId: string): Promise<void> {
  await openMenu(page);
  for (let i = 0; i < 12; i += 1) {
    if ((await menuState(page)).selectedCommand === commandId) return;
    await page.keyboard.press("ArrowDown");
  }
  throw new Error(`command not reachable by keyboard: ${commandId}`);
}

async function backToRail(page: Page): Promise<void> {
  for (let i = 0; i < 5; i += 1) {
    const state = await menuState(page);
    if (state.mode === "main") return;
    await page.keyboard.press("Escape");
  }
  throw new Error("status menu did not return to rail");
}

async function focusDetailAction(page: Page, testId: string): Promise<void> {
  for (let i = 0; i < 12; i += 1) {
    const selected = await selectedDetailTestId(page);
    if (selected === testId) return;
    await page.keyboard.press("ArrowDown");
  }
  throw new Error(`detail action not reachable by keyboard: ${testId}`);
}

async function selectedDetailTestId(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const selected = document.querySelector<HTMLElement>(".status-menu-detail-action.selected");
    return selected?.dataset.testid ?? null;
  });
}

async function menuState(page: Page): Promise<MenuState> {
  const text = await page.getByTestId("status-menu-debug-json").textContent();
  if (!text) throw new Error("missing status menu debug state");
  return JSON.parse(text) as MenuState;
}

async function runtimeSnapshot(page: Page): Promise<RuntimeSnapshot> {
  const text = await page.getByTestId("runtime-state-json").textContent();
  if (!text) throw new Error("missing runtime state");
  return JSON.parse(text) as RuntimeSnapshot;
}

async function setActorHp(page: Page, actorId: string, hp: number): Promise<void> {
  await page.evaluate(({ id, nextHp }) => window.__oprnSetActorVitals?.(id, nextHp, 0), { id: actorId, nextHp: hp });
}

async function mutatePositionAndInventory(page: Page, mapId: string, x: number, y: number): Promise<void> {
  await page.evaluate((next) => {
    const debugWindow = window as Window & {
      readonly __oprnDebug?: {
        readonly giveItem: (itemId: string, amount: number) => void;
        readonly teleport: (mapId: string, x: number, y: number) => void;
      };
    };
    debugWindow.__oprnDebug?.giveItem("item_potion", 5);
    debugWindow.__oprnDebug?.teleport(next.mapId, next.x, next.y);
  }, { mapId, x, y });
}

async function clearSaveSlots(page: Page): Promise<void> {
  await page.evaluate(() => {
    for (const slot of [1, 2, 3]) window.localStorage.removeItem(`oprn:save-slot:${slot}`);
  });
}
