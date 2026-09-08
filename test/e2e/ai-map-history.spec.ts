import { expect, test } from "@playwright/test";
import {
  captureHistoryShot,
  MAP_A,
  MAP_A_NAME,
  MAP_B,
  MAP_B_NAME,
  MAP_DELETED,
  MAP_EMPTY,
  MAP_EMPTY_NAME,
  TITLES,
  TURNS,
  bootEditor,
  expectFilterActive,
  historyRow,
  historySettled,
  LEGACY,
  openHistory,
  seedExtraCurrentMapRows,
  seedMapsAndHistory,
  seedUnscopedLegacy,
  selectHistoryFilter,
  selectKnownMapInHistory,
  selectMap,
} from "./aiMapHistoryHarness";

test.describe("map-scoped AI conversation history", () => {
  test.describe.configure({ timeout: 180_000, retries: 0 });

  test("clock opens history with the current-map filter active", async ({ page }) => {
    await bootEditor(page);
    const nested = page.getByTestId("ai-map-history-open");
    await expect(nested).toHaveCount(1);
    await expect(page.getByTestId("ai-open-conversations").getByTestId("ai-map-history-open")).toHaveCount(1);
    await expect(nested).toBeVisible();
    const appeared = page.getByTestId("ai-history-modal").waitFor({ state: "visible", timeout: 15_000 });
    await nested.click();
    await appeared;
    await historySettled(page);
    await expect(page.getByTestId("ai-history-search")).toBeVisible();
    await captureHistoryShot(page, "green-clock-current-filter", { width: 1440, height: 900 });
    await captureHistoryShot(page, "green-clock-current-filter", { width: 1024, height: 768 });
    await expect(page.getByTestId("ai-history-filter-current")).toBeVisible();
    await expectFilterActive(page, "ai-history-filter-current");
    await expect(page.getByTestId("ai-history-search")).toBeFocused();
  });

  test("history keeps search plus all-map, unknown, and map-selection filters", async ({ page }) => {
    await bootEditor(page);
    await seedMapsAndHistory(page);
    await openHistory(page);
    await expect(page.getByTestId("ai-history-search")).toBeVisible();
    await expect(page.getByTestId("ai-history-filter-all")).toBeVisible();
    await expect(page.getByTestId("ai-history-filter-unknown")).toBeVisible();
    await expect(page.getByTestId("ai-history-map-select")).toBeVisible();
  });

  test("current-map view lists whole conversations by origin or target map", async ({ page }) => {
    await bootEditor(page);
    await seedMapsAndHistory(page);
    await openHistory(page);
    await captureHistoryShot(page, "green-current-map-list", { width: 1440, height: 900 });
    await captureHistoryShot(page, "green-current-map-list", { width: 1024, height: 768 });
    await expect(historyRow(page, TITLES.a)).toBeVisible();
    await expect(historyRow(page, TITLES.mixed)).toBeVisible();
    await expect(historyRow(page, TITLES.b)).toBeHidden();
    await expect(historyRow(page, TITLES.unknown)).toBeHidden();
    await expect(historyRow(page, TITLES.deleted)).toBeHidden();
    await expect(historyRow(page, TITLES.foreign)).toBeHidden();

    await selectHistoryFilter(page, "ai-history-filter-all");
    await expect(historyRow(page, TITLES.a)).toBeVisible();
    await expect(historyRow(page, TITLES.b)).toBeVisible();
    await expect(historyRow(page, TITLES.mixed)).toBeVisible();
    await expect(historyRow(page, TITLES.unknown)).toBeVisible();
    await expect(historyRow(page, TITLES.deleted)).toBeVisible();
    await expect(historyRow(page, TITLES.foreign)).toBeHidden();

    await selectKnownMapInHistory(page, MAP_B);
    await expect(historyRow(page, TITLES.b)).toBeVisible();
    await expect(historyRow(page, TITLES.mixed)).toBeVisible();
    await expect(historyRow(page, TITLES.a)).toBeHidden();
    await expect(historyRow(page, TITLES.unknown)).toBeHidden();
  });

  test("unknown is missing attribution and deleted map ids stay selectable", async ({ page }) => {
    await bootEditor(page);
    await seedMapsAndHistory(page);
    await openHistory(page);
    await selectHistoryFilter(page, "ai-history-filter-unknown");
    await expect(historyRow(page, TITLES.unknown)).toBeVisible();
    await expect(historyRow(page, TITLES.deleted)).toBeHidden();
    await expect(historyRow(page, TITLES.a)).toBeHidden();
    await expect(historyRow(page, TITLES.foreign)).toBeHidden();

    await selectHistoryFilter(page, "ai-history-filter-all");
    await selectKnownMapInHistory(page, MAP_DELETED);
    await expect(historyRow(page, TITLES.deleted)).toBeVisible();
    await expect(historyRow(page, TITLES.unknown)).toBeHidden();
  });

  test("foreign same-map-id conversation cannot be continued", async ({ page }) => {
    await bootEditor(page);
    await seedMapsAndHistory(page);
    await openHistory(page);
    await captureHistoryShot(page, "green-foreign-same-map", { width: 1440, height: 900 });
    const foreign = historyRow(page, TITLES.foreign);
    await expect(foreign).toBeHidden();
    await expect(foreign.getByTestId("ai-history-open")).toHaveCount(0);
  });

  test("continuing a same-project row restores the full conversation", async ({ page }) => {
    await bootEditor(page);
    await seedMapsAndHistory(page);
    await openHistory(page);
    const mixed = historyRow(page, TITLES.mixed);
    await expect(mixed).toBeVisible();
    const closed = page.getByTestId("ai-history-modal").waitFor({ state: "hidden", timeout: 15_000 });
    await mixed.getByTestId("ai-history-open").click();
    await closed;
    const log = page.getByTestId("ai-chat-log");
    await expect(log).toContainText(TITLES.mixed);
    await expect(log).toContainText(TURNS.mixedAssistA);
    await expect(log).toContainText(TURNS.mixedFollowB);
    await expect(log).toContainText(TURNS.mixedAssistB);
  });

  test("A then B then A keeps the live project conversation", async ({ page }) => {
    await bootEditor(page);
    await seedMapsAndHistory(page);
    await openHistory(page);
    const mixed = historyRow(page, TITLES.mixed);
    await expect(mixed).toBeVisible();
    const closed = page.getByTestId("ai-history-modal").waitFor({ state: "hidden", timeout: 15_000 });
    await mixed.getByTestId("ai-history-open").click();
    await closed;
    await expect(page.getByTestId("ai-chat-log")).toContainText(TITLES.mixed);
    const conversationId = await page.getByTestId("ai-panel").getAttribute("data-ai-conversation-id");
    expect(conversationId, "continued conversation id must be captured before A-B-A").toBeTruthy();
    await selectMap(page, MAP_B, MAP_B_NAME);
    await expect(page.getByTestId("ai-chat-log")).toContainText(TITLES.mixed);
    await expect(page.getByTestId("ai-chat-log")).toContainText(TURNS.mixedFollowB);
    await expect(page.getByTestId("ai-panel")).toHaveAttribute("data-ai-conversation-id", conversationId ?? "");
    await selectMap(page, MAP_A, MAP_A_NAME);
    await expect(page.getByTestId("ai-chat-log")).toContainText(TITLES.mixed);
    await expect(page.getByTestId("ai-chat-log")).toContainText(TURNS.mixedAssistA);
    await expect(page.getByTestId("ai-panel")).toHaveAttribute("data-ai-conversation-id", conversationId ?? "");
    await expect(page.getByTestId("ai-panel")).not.toHaveAttribute("data-ai-conversation", "empty");
  });

  test("reload keeps same-project map history", async ({ page }) => {
    await bootEditor(page);
    await seedMapsAndHistory(page);
    await bootEditor(page);
    await openHistory(page);
    await expect(historyRow(page, TITLES.a)).toBeVisible();
    await expect(historyRow(page, TITLES.mixed)).toBeVisible();
    await expect(historyRow(page, TITLES.foreign)).toBeHidden();
  });

  test("explicit recovery surfaces transport failure", async ({ page }) => {
    await bootEditor(page);
    await page.route("**/rest/v1/ai_conversations**", (route) => {
      if (route.request().method() === "GET") {
        return route.fulfill({ status: 500, body: JSON.stringify({ message: "recovery-failed" }) });
      }
      return route.fulfill({ status: 204, body: "" });
    });
    await openHistory(page);
    await page.getByTestId("ai-history-recover").click();
    await historySettled(page);
    const status = page.getByTestId("ai-history-recover-status");
    await expect(status).toBeVisible();
    await expect(status).toHaveAttribute("data-state", "error");
  });

  test("empty current-map view does not list other maps", async ({ page }) => {
    await bootEditor(page);
    await seedMapsAndHistory(page);
    await selectMap(page, MAP_EMPTY, MAP_EMPTY_NAME);
    await openHistory(page);
    await expectFilterActive(page, "ai-history-filter-current");
    await expect(page.getByTestId("ai-history-empty")).toBeVisible();
    await expect(historyRow(page, TITLES.a)).toBeHidden();
    await expect(historyRow(page, TITLES.b)).toBeHidden();
    await expect(historyRow(page, TITLES.mixed)).toBeHidden();
    await selectHistoryFilter(page, "ai-history-filter-all");
    await expect(historyRow(page, TITLES.a)).toBeVisible();
  });

  test("search and pagination stay inside the current project", async ({ page }) => {
    await bootEditor(page);
    await seedMapsAndHistory(page);
    const pageSize = await page.evaluate(async () => {
      const modalPath: string = "/src/editor/panels/aiConversationHistoryModal.ts";
      const mod = await import(/* @vite-ignore */ modalPath) as typeof import("@/editor/panels/aiConversationHistoryModal");
      return mod.AI_HISTORY_ARCHIVE_PAGE_SIZE;
    });
    await seedExtraCurrentMapRows(page, pageSize);
    await openHistory(page);
    const search = page.getByTestId("ai-history-search");
    await search.fill(TITLES.a);
    await historySettled(page);
    await expect(historyRow(page, TITLES.a)).toBeVisible();
    await expect(historyRow(page, TITLES.mixed)).toBeHidden();
    await search.fill("");
    await historySettled(page);
    await expect(page.getByTestId("ai-history-load-more")).toBeVisible();
    const before = await page.getByTestId("ai-history-row").count();
    await page.getByTestId("ai-history-load-more").click();
    await historySettled(page);
    expect(await page.getByTestId("ai-history-row").count()).toBeGreaterThan(before);
    await expect(historyRow(page, TITLES.foreign)).toBeHidden();
    await captureHistoryShot(page, "green-history-scrolled", { width: 1440, height: 900 });
    await captureHistoryShot(page, "green-history-scrolled", { width: 1024, height: 768 });
  });

  test("legacy unscoped view reads the retained transcript without adopting it", async ({ page }) => {
    await bootEditor(page);
    await seedMapsAndHistory(page);
    await seedUnscopedLegacy(page);
    await openHistory(page);
    const mixed = historyRow(page, TITLES.mixed);
    await expect(mixed).toBeVisible();
    const closed = page.getByTestId("ai-history-modal").waitFor({ state: "hidden", timeout: 15_000 });
    await mixed.getByTestId("ai-history-open").click();
    await closed;
    const conversationId = await page.getByTestId("ai-panel").getAttribute("data-ai-conversation-id");
    expect(conversationId, "active conversation id must exist before legacy browse").toBeTruthy();
    await openHistory(page);
    await captureHistoryShot(page, "legacy-normal-current", { width: 1440, height: 900 });
    await captureHistoryShot(page, "legacy-normal-current", { width: 1024, height: 768 });
    await expect(historyRow(page, LEGACY.user)).toBeHidden();
    await selectHistoryFilter(page, "ai-history-filter-legacy");
    await expect(historyRow(page, LEGACY.user)).toBeVisible();
    await expect(historyRow(page, TITLES.mixed)).toBeHidden();
    await expect(page.getByTestId("ai-history-recover")).toBeHidden();
    await expect(page.getByTestId("ai-history-open")).toHaveCount(0);
    await expect(page.getByTestId("ai-history-delete")).toHaveCount(0);
    await expect(historyRow(page, LEGACY.user)).toContainText(LEGACY.mapId);
    await expect(historyRow(page, LEGACY.user)).not.toContainText(MAP_A_NAME);
    await page.getByTestId("ai-history-legacy-inspect").click();
    await historySettled(page);
    const body = page.getByTestId("ai-history-legacy-body");
    await expect(body).toBeVisible();
    await expect(body).toContainText(LEGACY.user);
    await expect(body).toContainText(LEGACY.assist);
    await expect(page.getByTestId("ai-history-modal")).toBeVisible();
    await expect(page.getByTestId("ai-panel")).toHaveAttribute("data-ai-conversation-id", conversationId ?? "");
    await captureHistoryShot(page, "legacy-view", { width: 1440, height: 900 });
    await captureHistoryShot(page, "legacy-view", { width: 1024, height: 768 });
  });

  test("older deleted map remains selectable beyond 200 project records", async ({ page }) => {
    await bootEditor(page);
    await seedMapsAndHistory(page);
    await seedExtraCurrentMapRows(page, 200);
    await openHistory(page);
    const gone = page.getByTestId("ai-history-modal").locator(`[data-map-id="${MAP_DELETED}"]`).first();
    await expect(gone).toBeVisible();
    await gone.click();
    await historySettled(page);
    await expect(historyRow(page, TITLES.deleted)).toBeVisible();
    await expect(page.getByTestId("ai-history-open")).toHaveCount(1);
  });
});
