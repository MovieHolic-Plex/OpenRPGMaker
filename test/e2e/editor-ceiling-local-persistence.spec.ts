import { expect, test } from "@playwright/test";
import { startNewGameFromTitle } from "./runtimeInput";

const NONCE = `ceiling-local-${Date.now()}`;
const URL = `/?devProject=1&logCabinShowcase=1&localCeiling=${NONCE}`;
const TITLE = `로컬 영속 ${NONCE}`;

test("authoring flushes to local storage, survives reload, and enters test play", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "basic"));
  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 30_000 });

  const originalTitle = await page.title();
  await page.getByTestId("layer-event").click();
  const canvas = page.getByTestId("edit-canvas").locator("canvas").first();
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.getByTestId("basic-create-selected-event").click();
  await expect(page.getByTestId("event-editor-modal")).toBeVisible();
  await page.getByTestId("event-page-name-input").fill(TITLE);
  await page.getByTestId("event-page-name-input").blur();
  await page.getByTestId("event-command-empty-line").dblclick();
  await page.getByTestId("command-picker-add-text").click();
  await page.getByTestId("event-command-text-body").fill(TITLE);
  await page.getByTestId("event-command-edit-ok").click();
  await page.getByTestId("event-editor-ok").click();

  const flushResult = await page.evaluate(async () => window.__oprnProjectE2E?.flush());
  expect(flushResult).toEqual({ kind: "saved-local" });
  const storedBeforeReload = await page.evaluate(() => {
    const key = Object.keys(localStorage).find((candidate) => candidate.startsWith("oprn:dev-project:"));
    return key ? { key, payload: localStorage.getItem(key) } : null;
  });
  expect(storedBeforeReload?.payload).toContain(TITLE);

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 30_000 });
  const snapshot = await page.evaluate(() => window.__oprnProjectE2E?.currentProject());
  expect(JSON.stringify(snapshot?.project)).toContain(TITLE);
  expect(await page.title()).toBe(originalTitle);

  await page.getByTestId("topbar-test-play").click();
  await expect(page.getByTestId("test-play-window")).toBeVisible({ timeout: 30_000 });
  await startNewGameFromTitle(page, { timeoutMs: 30_000 });
  await expect(page.getByTestId("play-canvas")).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("test-play-window-close").click();
  await expect(page.getByTestId("test-play-window")).toBeHidden();

  await page.getByTestId("layer-event").click();
  const eventPosition = await page.evaluate((title) => {
    const project = window.__oprnProjectE2E?.currentProject().project;
    if (!project) return null;
    const event = project.maps[project.startMapId]?.events.find((candidate) => candidate.pages.some((eventPage) => eventPage.name === title));
    return event ? { x: event.x, y: event.y, width: project.maps[project.startMapId]!.width, height: project.maps[project.startMapId]!.height } : null;
  }, TITLE);
  expect(eventPosition).not.toBeNull();
  const reloadedCanvas = page.getByTestId("edit-canvas").locator("canvas").first();
  const reloadedBox = await reloadedCanvas.boundingBox();
  expect(reloadedBox).not.toBeNull();
  const tileSize = 32;
  const mapLeft = Math.floor((reloadedBox!.width - eventPosition!.width * tileSize) / 2);
  const mapTop = Math.floor((reloadedBox!.height - eventPosition!.height * tileSize) / 2);
  await reloadedCanvas.click({
    position: {
      x: mapLeft + eventPosition!.x * tileSize + tileSize / 2,
      y: mapTop + eventPosition!.y * tileSize + tileSize / 2,
    },
  });
  await page.evaluate((title) => {
    const project = window.__oprnProjectE2E!.currentProject().project;
    const mapId = project.startMapId;
    const event = project.maps[mapId]!.events.find((candidate) => candidate.pages.some((eventPage) => eventPage.name === title));
    if (!event) throw new Error("reloaded event missing");
    window.dispatchEvent(new CustomEvent("oprn:test-play-window", {
      detail: { kind: "selected-event", mapId, eventId: event.id },
    }));
  }, TITLE);
  await expect(page.getByTestId("test-play-window-title")).toContainText("이벤트 테스트");
  await expect(page.getByTestId("dialogue-box")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("dialogue-box")).toContainText(TITLE);
});
