import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { createBlankProject } from "@/project/defaults";
import type { Command, EventPage, Project } from "@/project/types";
import { debugState, dispatchChange, openEventEditor, runtimeState, screenshotEvidence, writeEvidenceJson, writeEvidenceText, type DebugState } from "./eventEditorCertEvidence";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";
import { startNewGameFromTitle } from "./runtimeInput";

const EVIDENCE_DIR = "output/evidence/event-editor-cert/loop10-economy-commerce";
const POTION_ID = "item_potion";
const REMOVED_ACTOR_ID = "actor_scout";

test.setTimeout(90_000);

test("loop10 certifies economy party shop and inn commands", async ({ page }) => {
  await mkdir(EVIDENCE_DIR, { recursive: true });
  await page.setViewportSize({ width: 1478, height: 926 });
  await seedProjectFromSupabaseCanonical(page, economyCommerceProject(), "/?e2eVitals=1");
  await writeJson("000-scenario.json", {
    scope: ["changeGold", "changeItem", "changeParty", "shop", "inn", "roundtrip persistence", "runtime state mutation"],
  });

  await screenshot(page, "001-editor-event-layer.png");
  await openEventEditor(page, "ev_economy_commerce");
  await editCommand(page, "changeGold", async (command) => {
    await command.getByTestId("change-gold-op-select").selectOption("+=");
  });
  await editCommand(page, "changeGold", async (command) => fillAndChange(command.getByTestId("change-gold-amount-input"), "100"));
  await editCommand(page, "changeItem", async (command) => {
    await command.getByTestId("change-item-select").selectOption(POTION_ID);
  });
  await editCommand(page, "changeItem", async (command) => {
    await command.getByTestId("change-item-op-select").selectOption("+=");
  });
  await editCommand(page, "changeItem", async (command) => {
    await fillAndChange(command.getByTestId("change-item-amount-input"), "2");
  });
  await editCommand(page, "changeParty", async (command) => {
    await command.getByTestId("change-party-actor-select").selectOption(REMOVED_ACTOR_ID);
  });
  await editCommand(page, "changeParty", async (command) => {
    await command.getByTestId("change-party-action-select").selectOption("remove");
  });
  await editCommand(page, "shop", async (command) => {
    // 자료집 카탈로그 행을 골라 담기 — 사용자가 실제로 쓰는 경로다. 예전에는
    // aria-hidden 트레이 안의 보이지 않는 select 를 눌러 통과했다.
    await command.getByTestId(`shop-catalog-row-${POTION_ID}`).click();
    await command.getByTestId("shop-add-item").click();
  });
  await editCommand(page, "inn", async (command) => fillAndChange(command.getByTestId("inn-price-input"), "25"));
  await screenshot(page, "002-editor-economy-commerce.png");
  await page.getByTestId("event-editor-apply").click();
  const editorExport = await debugState(page);
  assertEconomyExport(editorExport);
  await writeJson("003-editor-export.json", editorExport);
  await page.getByTestId("event-editor-modal-close").click();

  await page.addInitScript((project) => {
    window.__RPG_ZZU_E2E_PROJECT__ = project;
    window.localStorage.clear();
  }, editorExport.project);
  await page.reload();
  await expect(page.getByTestId("edit-canvas")).toBeVisible();
  const roundtrip = await debugState(page);
  assertEconomyExport(roundtrip);
  const potionPrice = itemPrice(roundtrip.project, POTION_ID);
  const expectedFinalGold = 100 - potionPrice - 25;
  await writeJson("004-editor-roundtrip-after-reload.json", roundtrip);
  await openEventEditor(page, "ev_economy_commerce");
  await editCommand(page, "changeGold", async (command) => {
    await expect(command.getByTestId("change-gold-amount-input")).toHaveValue("100");
  });
  await editCommand(page, "shop", async (command) => {
    await expect(
      command.locator(`[data-testid="shop-sale-list"] [data-testid="shop-item-row-${POTION_ID}"]`)
    ).toBeVisible();
  });
  await editCommand(page, "inn", async (command) => {
    await expect(command.getByTestId("inn-price-input")).toHaveValue("25");
  });
  await screenshot(page, "005-editor-after-reload.png");
  await page.getByTestId("event-editor-modal-close").click();

  await page.getByTestId("mode-play").click();
  await startNewGameFromTitle(page);
  await damageFirstActor(page);
  await page.getByTestId("event-ev_economy_commerce").click();
  await expect(page.getByTestId("shop-scene")).toContainText("어서 오세요.");
  const beforePurchase = await runtimeState(page);
  expect(beforePurchase.gold).toBe(100);
  expect(beforePurchase.inventory[POTION_ID]).toBe(2);
  expect(beforePurchase.partyActorIds).not.toContain(REMOVED_ACTOR_ID);
  await writeJson("006-runtime-before-shop-purchase.json", beforePurchase);
  await screenshot(page, "007-runtime-shop-menu.png");
  await page.getByTestId("shop-mode-buy").click();
  await expect(page.getByTestId("shop-scene")).toContainText("회복약");
  await screenshot(page, "008-runtime-shop-items.png");
  await page.getByTestId(`shop-buy-${POTION_ID}`).click();
  await expect(page.getByTestId("inn-scene")).toContainText("25 G");
  await screenshot(page, "009-runtime-inn-prompt.png");
  await page.getByTestId("inn-stay").click();
  const finalState = await runtimeState(page);
  const actorId = finalState.partyActorIds[0];
  if (!actorId) throw new Error("missing party actor");
  expect(finalState.gold).toBe(expectedFinalGold);
  expect(finalState.inventory[POTION_ID]).toBe(3);
  expect(finalState.partyActorIds).not.toContain(REMOVED_ACTOR_ID);
  expect(finalState.actorVitals[actorId]?.hp).toBe(finalState.actorVitals[actorId]?.maxHp);
  expect(finalState.actorVitals[actorId]?.mp).toBe(finalState.actorVitals[actorId]?.maxMp);
  await writeJson("010-runtime-after-commerce.json", finalState);
  // 숙박 연출(페이드 → 기상 메시지)이 끝나 여관 창이 닫힌 뒤 메뉴를 연다.
  await expect(page.getByTestId("inn-scene")).toBeHidden();
  await page.keyboard.press("X");
  await page.getByTestId("status-menu-command-items").click();
  await expect(page.getByTestId("status-menu-gold")).toContainText(`${expectedFinalGold}G`);
  await expect(page.getByTestId("status-menu-detail")).toContainText("3개");
  await screenshot(page, "011-status-menu-after-commerce.png");

  await writeText("rm2003-comparison-note.md", [
    "# RM2003 comparison note - Loop 10 economy and commerce",
    "",
    "- Baseline source: `.omo/teams/019f135a-1dd7-7691-b6a1-0686a7ae9dbc/artifacts/A-rm2003-reference.md`.",
    "- Certified here: Change Gold, Change Item, Change Party, Shop Processing, and Inn Processing authoring, roundtrip persistence, runtime state mutation, visible shop/inn panels, and final field menu state.",
    "- Scoped deviation: this certifies a single buy transaction and paid inn stay with HP/MP recovery. It does not certify every RM2003 shop message set, sell-only branch, or all shop quantity edge cases.",
    "",
  ].join("\n"));
  await writeJson("cleanup-receipt.json", {
    ownedServerProcess: "playwright webServer",
    browserClosedBy: "playwright test runner",
    storageIsolation: "fresh browser context per test; localStorage cleared before reload",
    generatedEvidenceRoot: EVIDENCE_DIR,
    status: "cleaned by runner",
  });
  await writeJson("manifest.json", {
    runId: "loop10-economy-commerce",
    criticalGate: {
      minimumScore: 9,
      result: "PENDING_REVIEW",
      rubric: ".omo/teams/019f135a-1dd7-7691-b6a1-0686a7ae9dbc/artifacts/E-critical-gate-rubric.md",
    },
    screenshots: ["002-editor-economy-commerce.png", "005-editor-after-reload.png", "007-runtime-shop-menu.png", "008-runtime-shop-items.png", "009-runtime-inn-prompt.png", "011-status-menu-after-commerce.png"],
    json: ["000-scenario.json", "003-editor-export.json", "004-editor-roundtrip-after-reload.json", "006-runtime-before-shop-purchase.json", "010-runtime-after-commerce.json", "cleanup-receipt.json"],
    notes: ["rm2003-comparison-note.md"],
  });
});

async function editCommand(page: Page, kind: Command["kind"], action: (command: ReturnType<Page["getByTestId"]>) => Promise<void>): Promise<void> {
  const command = page.getByTestId(`event-command-${kind}`).first();
  if (!(await command.evaluate((node) => node.classList.contains("editing")).catch(() => false))) {
    await command.scrollIntoViewIfNeeded();
    await command.evaluate((node) => node.classList.add("editing"));
  }
  await expect(command).toHaveClass(/editing/);
  await action(command);
}

async function fillAndChange(locator: ReturnType<Page["getByTestId"]>, value: string): Promise<void> {
  await locator.fill(value);
  await dispatchChange(locator);
}

async function damageFirstActor(page: Page): Promise<void> {
  const state = await runtimeState(page);
  const actorId = state.partyActorIds[0];
  if (!actorId) throw new Error("missing party actor");
  await expect.poll(async () => page.evaluate(() => typeof (window as unknown as { __oprnSetActorVitals?: unknown }).__oprnSetActorVitals)).toBe("function");
  await page.evaluate((id) => {
    const hooks = window as unknown as { __oprnSetActorVitals?: (actorId: string, hp: number, mp: number) => void };
    hooks.__oprnSetActorVitals?.(id, 1, 0);
  }, actorId);
}

async function screenshot(page: Page, name: string): Promise<void> {
  await screenshotEvidence(page, EVIDENCE_DIR, name);
}

async function writeJson(name: string, value: unknown): Promise<void> {
  await writeEvidenceJson(EVIDENCE_DIR, name, value);
}

async function writeText(name: string, value: string): Promise<void> {
  await writeEvidenceText(EVIDENCE_DIR, name, value);
}

function assertEconomyExport(state: DebugState): void {
  const event = state.project.maps[state.project.startMapId]?.events.find((item) => item.id === "ev_economy_commerce");
  expect(event?.pages?.[0]?.commands).toMatchObject([
    { kind: "changeGold", op: "+=", amount: 100 },
    { kind: "changeItem", itemId: POTION_ID, op: "+=", amount: 2 },
    { kind: "changeParty", actorId: REMOVED_ACTOR_ID, action: "remove" },
    { kind: "shop", itemIds: [POTION_ID] },
    { kind: "inn", price: 25 },
  ]);
}

function itemPrice(project: Project, itemId: string): number {
  const item = project.database.items.find((record) => record.id === itemId);
  if (!item) throw new Error(`missing item ${itemId}`);
  return item.price;
}

function economyCommerceProject(): Project {
  const project = createBlankProject();
  const map = project.maps[project.startMapId];
  if (!map) throw new Error("missing start map");
  map.events.push({
    id: "ev_economy_commerce",
    x: project.startPos.x,
    y: project.startPos.y - 1,
    trigger: { kind: "action" },
    commands: [],
    pages: [eventPage([
      { kind: "changeGold", op: "=", amount: 0 },
      { kind: "changeItem", itemId: "", op: "=", amount: 0 },
      { kind: "changeParty", actorId: "", action: "add" },
      { kind: "shop", itemIds: [] },
      { kind: "inn", price: 0 },
    ])],
  });
  return project;
}

function eventPage(commands: Command[]): EventPage {
  return {
    id: "economy_commerce_page",
    name: "economy_commerce_page",
    conditions: [],
    graphic: {},
    trigger: { kind: "action" },
    priority: "same",
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands,
  };
}
