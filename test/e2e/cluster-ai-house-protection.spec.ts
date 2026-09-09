import { expect, test as base, type Page, type BrowserContext } from "@playwright/test";
import { writeFileSync } from "node:fs";

// Real editor/modal/session/runner/store. Only model HTTP responses are scripted.
// This is an engine-only fixture; no authored content is saved remotely.
async function prepareEditor(page: Page, context: BrowserContext) {
  await test.step("Install remote-write guard and isolated static transport", async () => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await context.route("**/*", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (!["GET", "HEAD", "OPTIONS"].includes(request.method()) && url.hostname !== "127.0.0.1") {
        return route.abort("blockedbyclient");
      }
      return route.fallback();
    });
    // Avoid this host's Chromium ERR_NETWORK_CHANGED without retrying requests.
    await page.route("**/*", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.hostname === "127.0.0.1" && request.method() === "GET"
        && (request.isNavigationRequest() || /^\/(src|node_modules|@|vendor)\//.test(url.pathname))) {
        return route.fulfill({ response: await route.fetch({
          headers: { ...request.headers(), connection: "close" }, maxRetries: 0, timeout: 60_000,
        }) });
      }
      return route.fallback();
    });
    await page.addInitScript(() => {
      localStorage.setItem("rpg-zzu:editor-ui-mode", "standard");
      localStorage.setItem("oprn:editor-welcome-dismissed", "1");
      localStorage.setItem("oprn:standard-welcome-seen", "1");
      localStorage.setItem("oprn:coachmarks-basic-v1", "1");
      localStorage.setItem("oprn:ai-config", JSON.stringify({ configVersion: 2, agentMode: "chat", maxToolCalls: 4 }));
    });
  });
  await test.step("Navigate and dismiss editor boot overlays", async () => {
    await page.goto("/?blankProject=1&aiBridge=0", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 60_000 });
    const guest = page.getByTestId("login-guest");
    if (await guest.isVisible()) await guest.click();
    await expect(page.getByTestId("login-modal")).toHaveCount(0);
    const welcome = page.getByTestId("standard-welcome-start");
    if (await welcome.isVisible()) await welcome.click();
    await expect(page.getByTestId("standard-welcome-card")).toHaveCount(0);
    const coach = page.getByTestId("coach-mark-skip");
    if (await coach.isVisible()) await coach.click();
    await expect(page.locator("[data-testid^='coach-mark-']")).toHaveCount(0);
  });
  await test.step("Load the real cluster, store and history modules before behavior", async () => {
    await page.evaluate(async () => {
      const moduleUrl = (suffix: string) => performance.getEntriesByType("resource")
        .map((entry) => entry.name).find((url) => new URL(url).pathname === suffix) ?? suffix;
      await Promise.all([
        import(moduleUrl("/src/project/store.ts")),
        import(moduleUrl("/src/editor/mapEditHistory.ts")),
        import(moduleUrl("/src/editor/panels/clusterAiModal.ts")),
        import(moduleUrl("/src/editor/panels/aiConnectionStatus.ts")),
      ]);
    });
  });
}

const test = base.extend<{ drainRoutes: void; editor: void }>({
  drainRoutes: [async ({ page }, use) => {
    await use();
    // Drain before page disposal, under a deadline separate from test behavior.
    // The context-owned remote-write guard remains installed until context disposal.
    await test.step("Drain page routes before fixture disposal", async () => {
      await page.unrouteAll({ behavior: "wait" });
    });
  }, { auto: true, timeout: 30_000 }],
  editor: [async ({ page, context }, use) => {
    // Explicit fixture time excludes expensive boot/module loading from behavior.
    await prepareEditor(page, context);
    await use();
  }, { auto: true, timeout: 180_000 }],
});

for (const scenario of ["upper-and-stack", "new-house", "safe"] as const) {
  test(`cluster modal house protection: ${scenario}`, async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    let wrote = false;
    const toolResults = new Map<string, boolean>();
    await page.route("**/v1/chat/completions", async (route) => {
      const body = route.request().postDataJSON();
      if (!body.tools?.length) return route.fulfill({ json: { choices: [{ finish_reason: "stop", message: {
        role: "assistant", content: JSON.stringify({ action: "new_plan", goal: "Classify metadata",
          layers: [{ title: "Metadata", items: [{ title: "Metadata", instruction: "upsert_tile_group",
            successTools: ["upsert_tile_group"] }] }] }),
      } }] } });
      for (const message of body.messages) {
        if (message.role === "tool" && message.tool_call_id === "metadata") {
          const ok = JSON.parse(message.content).ok;
          expect(ok).toBe(true);
          // Later model requests repeat conversation history, not tool execution.
          toolResults.set(message.tool_call_id, ok);
        }
      }
      const call = !wrote;
      wrote = true;
      return route.fulfill({ json: { choices: [{ finish_reason: call ? "tool_calls" : "stop", message: call ? {
        role: "assistant", content: null, tool_calls: [{ id: "metadata", type: "function", function: {
          name: "upsert_tile_group", arguments: JSON.stringify({ name: "Cluster QA metadata", role: "prop", tileIds: [322],
            reason: "Classify an unrelated tile without changing houses" }),
        } }],
      } : { role: "assistant", content: "CLUSTER_QA_DONE" } }] } });
    });
    await test.step("Establish the human precondition and await the real metadata proposal", async () => {
      const remoteEnabled = await page.evaluate(async (kind) => {
        const moduleUrl = (suffix: string) => performance.getEntriesByType("resource")
          .map((entry) => entry.name).find((url) => new URL(url).pathname === suffix) ?? suffix;
        const { store }: typeof import("../../src/project/store") = await import(moduleUrl("/src/project/store.ts"));
        const { resetMapEditHistory }: typeof import("../../src/editor/mapEditHistory") = await import(moduleUrl("/src/editor/mapEditHistory.ts"));
        const { openClusterAiModal }: typeof import("../../src/editor/panels/clusterAiModal") = await import(moduleUrl("/src/editor/panels/clusterAiModal.ts"));
        const { resetAiConnectionStatusCache }: typeof import("../../src/editor/panels/aiConnectionStatus") = await import(moduleUrl("/src/editor/panels/aiConnectionStatus.ts"));
        resetAiConnectionStatusCache();
        store.update((project) => {
          const map = project.maps[project.startMapId];
          project.startPos = { x: 0, y: 0 };
          map.lowerTiles.fill(0);
          map.upperTiles.fill(-1);
          delete map.upperTileStacks;
          map.layoutPlan = { version: 1, kind: "fixture", regions: kind === "new-house" ? [] : [
            { id: "cluster-qa-house", role: "house", label: "QA house", x: 3, y: 3, w: 4, h: 4 },
          ] };
          map.lowerTiles[3 * map.width + 3] = 96;
          map.upperTiles[3 * map.width + 3] = 199;
        }, { scope: "project", origin: "human", label: "Cluster QA precondition" });
        resetMapEditHistory();
        const project = store.getCurrent();
        openClusterAiModal({ kind: "range-classify", tilesetId: project.maps[project.startMapId].tilesetId,
          rect: { x: 0, y: 0, w: 1, h: 1 }, tileIds: [322] });
        return store.isRemotePersistenceEnabled();
      }, scenario);
      expect(remoteEnabled).toBe(false);
      await expect(page.getByTestId("cluster-ai-accept")).toBeVisible({ timeout: 30_000 });
      expect([...toolResults.entries()]).toEqual([["metadata", true]]);
    });
    const result = await test.step("Apply the live edit and observe the real accept status transition", async () => {
      // Observe the exact status transition before clicking the real accept button.
      return page.evaluate(async (kind) => {
        const moduleUrl = (suffix: string) => performance.getEntriesByType("resource")
          .map((entry) => entry.name).find((url) => new URL(url).pathname === suffix) ?? suffix;
        const { store }: typeof import("../../src/project/store") = await import(moduleUrl("/src/project/store.ts"));
        const history: typeof import("../../src/editor/mapEditHistory") = await import(moduleUrl("/src/editor/mapEditHistory.ts"));
        if (kind !== "safe") store.update((project) => {
          const map = project.maps[project.startMapId];
          if (kind === "new-house") map.layoutPlan = { version: 1, kind: "fixture", regions: [
            { id: "new-qa-house", role: "house", label: "New QA house", x: 3, y: 3, w: 4, h: 4 },
          ] };
          else {
            const index = 4 * map.width + 5;
            map.upperTiles[index] = 322;
            map.upperTileStacks = { [index]: [199, 322] };
          }
        }, { scope: "project", origin: "human", label: "Human change after cluster preview" });
        const before = store.getCurrent();
        const bytes = JSON.stringify(before);
        const entries = history.getMapEditHistoryEntries().length;
        let mutations = 0;
        const unsubscribe = store.subscribe(() => { mutations += 1; });
        const status = document.querySelector('[data-testid="cluster-ai-status"]');
        if (!status) throw new Error("Missing real cluster status");
        const initial = status.textContent;
        await new Promise<void>((resolve, reject) => {
          const observer = new MutationObserver(() => {
            if (status.textContent === initial) return;
            clearTimeout(timeout);
            observer.disconnect();
            resolve();
          });
          const timeout = setTimeout(() => { observer.disconnect(); reject(new Error("Cluster acceptance deadline")); }, 15_000);
          observer.observe(status, { childList: true, subtree: true, characterData: true });
          document.querySelector<HTMLButtonElement>('[data-testid="cluster-ai-accept"]')?.click();
        });
        unsubscribe();
        const after = store.getCurrent();
        return { sameReference: before === after, sameBytes: JSON.stringify(after) === bytes,
          sameMaps: JSON.stringify(before.maps) === JSON.stringify(after.maps), mutations,
          undoDelta: history.getMapEditHistoryEntries().length - entries,
          proposalRetained: !!document.querySelector('[data-testid="cluster-ai-accept"]'),
          groupAdded: Object.values(after.tilesets).some((tileset) => tileset.tileGroups?.some((group) => group.name === "Cluster QA metadata")),
          status: status.textContent };
      }, scenario);
    });
    await test.step("Verify exact store, map, mutation, undo and proposal invariants", async () => {
      await page.screenshot({ path: testInfo.outputPath(`${scenario}.png`), animations: "disabled" });
      const receipt = JSON.stringify({ scenario, toolResults: [...toolResults.entries()], ...result }, null, 2);
      writeFileSync(testInfo.outputPath(`${scenario}.json`), receipt + "\n");
      await testInfo.attach(scenario, { body: receipt, contentType: "application/json" });
      if (scenario === "safe") {
        expect(result).toMatchObject({ sameReference: false, sameBytes: false, sameMaps: true,
          mutations: 1, undoDelta: 1, proposalRetained: false, groupAdded: true });
      } else expect(result).toMatchObject({ sameReference: true, sameBytes: true, sameMaps: true,
        mutations: 0, undoDelta: 0, proposalRetained: true, groupAdded: false });
      await page.getByTestId("cluster-ai-modal-close").click();
    });
  });
}
