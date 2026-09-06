import { expect, test, type Locator, type Page } from "@playwright/test";

type BrowserSignals = Window & {
  walkSceneReady: Promise<void>;
  walkChange: Promise<void>;
  __oprnEditWorldToClient: (x: number, y: number) => { x: number; y: number };
};

async function armProjectChange(page: Page, expectedRows: number): Promise<void> {
  await page.evaluate(async (expectedRows) => {
    const path = "/src/project/store.ts";
    const { store } = await import(path) as typeof import("../../src/project/store");
    (window as BrowserSignals).walkChange = new Promise<void>((resolve, reject) => {
      const dispose = store.subscribe((project) => {
        if ((project.maps[project.startMapId]?.encounterTable?.length ?? 0) !== expectedRows) return;
        clearTimeout(deadline); dispose(); resolve();
      });
      const deadline = setTimeout(() => { dispose(); reject(new Error("Encounter mutation was not emitted")); }, 10_000);
    });
  }, expectedRows);
}

async function dragRegion(page: Page, x: number, y: number): Promise<void> {
  const points = await page.evaluate(async ({ x, y }) => {
    const path = "/src/editor/editorState.ts";
    const { editorState } = await import(path) as typeof import("../../src/editor/editorState");
    const w = window as BrowserSignals;
    w.walkChange = new Promise<void>((resolve, reject) => {
      const dispose = editorState.subscribe((state) => {
        const rect = state.selection;
        if (rect?.x !== x || rect.y !== y || rect.width !== 3 || rect.height !== 3) return;
        clearTimeout(deadline); dispose(); resolve();
      });
      const deadline = setTimeout(() => { dispose(); reject(new Error("Drag selection was not emitted")); }, 10_000);
    });
    return [w.__oprnEditWorldToClient((x + 0.5) * 16, (y + 0.5) * 16),
      w.__oprnEditWorldToClient((x + 2.5) * 16, (y + 2.5) * 16)];
  }, { x, y });
  const [start, end] = points;
  if (!start || !end) throw new Error("Missing drag geometry");
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 5 });
  await page.mouse.up();
  await page.evaluate(() => (window as BrowserSignals).walkChange);
}

async function assertReachable(page: Page, id: string): Promise<void> {
  expect(await page.getByTestId(id).evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return rect.width > 0 && rect.height >= 32 && rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight
      && node.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
  })).toBe(true);
}

async function clickVisibleControl(page: Page, control: Locator): Promise<void> {
  const point = await control.evaluate((node) => {
    node.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
    const rect = node.getBoundingClientRect();
    const x = rect.x + rect.width / 2;
    const y = rect.y + rect.height / 2;
    if (!rect.width || !rect.height || !node.contains(document.elementFromPoint(x, y))) {
      throw new Error("Control is not reachable by pointer");
    }
    return { x, y };
  });
  await page.mouse.click(point.x, point.y);
}

for (const [width, height] of [[1024, 768], [1280, 800], [1440, 900]]) {
  test(`drag encounter authoring, repeat, undo and delete at ${width}`, async ({ page }, testInfo) => {
    // Covers cold editor boot plus the full create/reuse/undo/delete journey.
    test.setTimeout(240_000);
    await page.setViewportSize({ width, height });
    // Some shared Linux hosts abort this large dev CSS module in Firefox.
    // Opt-in transport only: serve the exact response from the same Vite server.
    if (process.env.WALK_QA_ROUTE_CSS === "1") {
      await page.route("**/src/styles/index.css", async (route) => {
        const response = await page.request.get(route.request().url());
        await route.fulfill({ response });
      });
    }
    await page.addInitScript(() => {
      localStorage.setItem("oprn:editor-ui-mode", "beginner");
      localStorage.setItem("oprn:coachmarks-basic-v1", "1");
      localStorage.setItem("oprn:standard-welcome-seen", "1");
      localStorage.setItem("oprn:ai-panel-collapsed", "1");
      // Observe the real scene's readiness hook assignment before boot. No
      // polling or synthetic readiness; the assigned function is unchanged.
      const w = window as BrowserSignals;
      w.walkSceneReady = new Promise<void>((resolve, reject) => {
        const deadline = setTimeout(() => reject(new Error("Editor scene did not become ready")), 60_000);
        Object.defineProperty(w, "__oprnEditWorldToClient", { configurable: true, set(value: BrowserSignals["__oprnEditWorldToClient"]) {
          Object.defineProperty(w, "__oprnEditWorldToClient", { configurable: true, writable: true, value });
          clearTimeout(deadline); resolve();
        } });
      });
    });
    await page.goto("/?blankProject=1", { waitUntil: "domcontentloaded" });
    await page.evaluate(() => (window as BrowserSignals).walkSceneReady);
    await page.evaluate(async () => {
      const path = "/src/app/mode.ts";
      const { getGame } = await import(path) as typeof import("../../src/app/mode");
      const game = getGame();
      if (!game) throw new Error("Missing edit game");
      await new Promise<void>((resolve, reject) => {
        const done = () => { clearTimeout(deadline); resolve(); };
        const deadline = setTimeout(() => { game.events.off("postrender", done); reject(new Error("No rendered editor frame")); }, 10_000);
        game.events.once("postrender", done);
      });
    });
    await assertReachable(page, "walk-encounter-list-open");
    await clickVisibleControl(page, page.getByTestId("walk-encounter-list-open"));
    await clickVisibleControl(page, page.getByTestId("walk-encounter-select-area"));
    await dragRegion(page, 7, 5);
    await assertReachable(page, "selection-chip-walk-encounter");
    await clickVisibleControl(page, page.getByTestId("selection-chip-walk-encounter"));
    await page.locator('[data-testid^="walk-enemy-"]').first().check();
    await page.getByTestId("walk-encounter-frequency").evaluate((node) => node.scrollIntoView({ block: "nearest", behavior: "instant" }));
    await assertReachable(page, "walk-encounter-frequency");
    await page.getByTestId("walk-encounter-frequency").selectOption("60");
    if (await page.getByTestId("walk-encounter-legacy").count()) await page.getByTestId("walk-encounter-legacy").selectOption("replace");
    await assertReachable(page, "walk-encounter-save");
    await page.screenshot({ path: testInfo.outputPath(`form-${width}.png`) });
    await armProjectChange(page, 1);
    await clickVisibleControl(page, page.getByTestId("walk-encounter-save"));
    await page.evaluate(() => (window as BrowserSignals).walkChange);

    await dragRegion(page, 11, 5);
    await clickVisibleControl(page, page.getByTestId("selection-chip-walk-encounter"));
    await clickVisibleControl(page, page.getByTestId("walk-encounter-reuse"));
    await armProjectChange(page, 2);
    await clickVisibleControl(page, page.getByTestId("walk-encounter-save"));
    await page.evaluate(() => (window as BrowserSignals).walkChange);
    await armProjectChange(page, 1);
    await clickVisibleControl(page, page.getByTestId("oprn-tool-undo"));
    await page.evaluate(() => (window as BrowserSignals).walkChange);

    await clickVisibleControl(page, page.getByTestId("walk-encounter-list-open"));
    expect(await page.locator('[data-testid^="walk-encounter-region-"]').count()).toBe(1);
    await clickVisibleControl(page, page.getByTestId("walk-encounter-edit-0"));
    await clickVisibleControl(page, page.getByTestId("walk-encounter-advanced").locator("summary"));
    await assertReachable(page, "walk-encounter-save");
    await page.screenshot({ path: testInfo.outputPath(`advanced-${width}.png`) });
    await page.keyboard.press("Escape");
    await clickVisibleControl(page, page.getByTestId("walk-encounter-list-open"));
    await clickVisibleControl(page, page.getByTestId("walk-encounter-edit-0"));
    await clickVisibleControl(page, page.getByTestId("walk-encounter-delete"));
    await armProjectChange(page, 0);
    await clickVisibleControl(page, page.getByTestId("walk-encounter-delete"));
    await page.evaluate(() => (window as BrowserSignals).walkChange);
  });
}
