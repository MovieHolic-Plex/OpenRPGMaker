import { chromium } from "@playwright/test";

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  ignoreHTTPSErrors: true,
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage();
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(error.message));

try {
  await page.goto("http://127.0.0.1:9805/?blankProject=1", {
    waitUntil: "domcontentloaded",
    timeout: 45_000,
  });
  await page.waitForFunction(() => document.body.childElementCount > 0, undefined, { timeout: 30_000 });

  const setup = await page.evaluate(async () => {
    const { store } = await import("/src/project/store.ts");
    const { openRegionTaskModal } = await import("/src/editor/panels/regionTaskModal.ts");
    const project = store.getCurrent();
    const before = JSON.stringify(project);
    const map = project.maps[project.startMapId];
    openRegionTaskModal({
      mapId: project.startMapId,
      region: { x: 0, y: 0, width: Math.min(4, map.width), height: Math.min(4, map.height) },
    });
    window.__tilemapHarnessBefore = before;
    return { mapId: project.startMapId, maps: Object.keys(project.maps).length, events: map.events.length };
  });

  const directButton = page.getByTestId("region-task-direct-room");
  await directButton.waitFor({ state: "visible", timeout: 15_000 });
  await page.getByTestId("region-task-direct-preset").selectOption("inn");
  await page.getByTestId("region-task-direct-modifier").selectOption("rustic");
  await directButton.click();

  await page.getByTestId("region-task-room-controls").waitFor({ state: "visible", timeout: 30_000 });
  await page.getByTestId("region-task-review-metrics").waitFor({ state: "visible", timeout: 15_000 });
  const pendingSnapshot = await page.evaluate(() => window.__rpgzzuRegionTaskPending?.get?.() ?? null);
  const ghostBefore = await page.evaluate(async () => {
    const { getAgentGhostPreviewState } = await import("/src/editor/agentGhostPreview.ts");
    return getAgentGhostPreviewState();
  });

  const lockButton = page.locator('[data-testid^="region-task-room-lock-"]').first();
  const rerollButton = page.locator('[data-testid^="region-task-room-reroll-"]').first();
  await lockButton.click();
  const rerollDisabledWhenLocked = await rerollButton.isDisabled();
  await lockButton.click();
  const rerollDisabledAfterUnlock = await rerollButton.isDisabled();
  await rerollButton.click();
  await page.waitForTimeout(2_000);
  const rerollSummary = await page.getByTestId("region-task-summary").textContent();

  const ghostAfter = await page.evaluate(async () => {
    const { getAgentGhostPreviewState } = await import("/src/editor/agentGhostPreview.ts");
    return getAgentGhostPreviewState();
  });
  await page.getByTestId("region-task-room-checkpoint-preview").waitFor({ state: "visible", timeout: 20_000 });
  await page.waitForFunction(() => {
    const caption = document.querySelector(".region-task-room-checkpoint-caption")?.textContent ?? "";
    return caption.includes("완성 실내 미리보기");
  }, undefined, { timeout: 20_000 });

  const evidence = {
    setup,
    stage: await page.getByTestId("region-task-modal").getAttribute("data-stage"),
    summary: await page.getByTestId("region-task-summary").textContent(),
    metrics: await page.getByTestId("region-task-review-metrics").textContent(),
    blockers: await page.getByTestId("region-task-blockers").textContent(),
    blockersHidden: await page.getByTestId("region-task-blockers").evaluate((node) => node.classList.contains("hidden")),
    roomControlRows: await page.locator('[data-testid^="region-task-room-lock-"]').count(),
    checkpointButtons: await page.locator('[data-testid^="region-task-room-checkpoint-"]:not([data-testid="region-task-room-checkpoint-preview"])').count(),
    partialApplyCount: await page.getByTestId("region-task-partial-apply").count(),
    rerollDisabledWhenLocked,
    rerollDisabledAfterUnlock,
    rerollSummary,
    ghostRevisionBefore: ghostBefore.revision,
    ghostRevisionAfter: ghostAfter.revision,
    ghostPreviewCount: ghostAfter.previews.length,
    checkpointPreviewVisible: await page.getByTestId("region-task-room-checkpoint-preview").isVisible(),
    checkpointCaption: await page.locator(".region-task-room-checkpoint-caption").textContent(),
    selectedCheckpoint: await page.locator(".region-task-room-checkpoint.is-selected").textContent(),
    pending: pendingSnapshot,
  };

  await page.screenshot({
    path: ".playwright-cli/tilemap-harness-overhaul-browser.png",
    fullPage: true,
  });

  await page.getByTestId("region-task-discard").click();
  await page.waitForFunction(() => window.__rpgzzuRegionTaskPending?.get?.() == null, undefined, { timeout: 10_000 });
  evidence.afterDiscard = await page.evaluate(async () => {
    const { store } = await import("/src/project/store.ts");
    return {
      pending: window.__rpgzzuRegionTaskPending?.get?.() ?? null,
      projectUnchanged: JSON.stringify(store.getCurrent()) === window.__tilemapHarnessBefore,
      mapCount: Object.keys(store.getCurrent().maps).length,
    };
  });
  evidence.pageErrors = pageErrors;

  if (!evidence.rerollDisabledWhenLocked) throw new Error("reroll remained enabled while room was locked");
  if (evidence.rerollDisabledAfterUnlock) throw new Error("reroll remained disabled after unlock");
  if (evidence.ghostRevisionAfter <= evidence.ghostRevisionBefore) throw new Error(`reroll did not refresh ghost preview revision: ${evidence.rerollSummary}`);
  if (evidence.partialApplyCount !== 0) throw new Error("structural room proposal exposed tile-only partial apply");
  if (!evidence.checkpointCaption?.includes("완성 실내 미리보기")) throw new Error(`latest completed checkpoint was not auto-previewed: ${evidence.checkpointCaption}`);
  if (!evidence.selectedCheckpoint) throw new Error("latest completed checkpoint was not visibly selected");
  if (!evidence.afterDiscard.projectUnchanged) throw new Error("discard mutated the authored project");
  if (pageErrors.length > 0) throw new Error(`page errors: ${pageErrors.join(" | ")}`);

  console.log(JSON.stringify(evidence, null, 2));
} finally {
  await browser.close();
}
