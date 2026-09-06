import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

/** Supervisor-driven browser proof. All mutations stay in freshProject's local session. */
export async function runSidebarBrushQa({ browser, baseUrl, outputDir, scope = "all", only = [] }) {
  await mkdir(outputDir, { recursive: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.setDefaultTimeout(60_000);
  const results = [];
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  // Chromium's host-network change cancellation also affects loopback imports.
  // Keep the real browser page, but deliver local GET responses through Node/Bun.
  await page.route("**/*", async route => {
    const request = route.request();
    if (request.method() !== "GET" || new URL(request.url()).origin !== new URL(baseUrl).origin) {
      return route.continue();
    }
    const response = await fetch(request.url(), { signal: AbortSignal.timeout(60_000) });
    await route.fulfill({
      status: response.status,
      headers: Object.fromEntries(response.headers),
      body: Buffer.from(await response.arrayBuffer()),
    });
  });
  await page.addInitScript(() => {
    window.sidebarSceneReady = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("EditScene did not publish its coordinate hook")), 90_000);
      let worldToClient;
      Object.defineProperty(window, "__oprnEditWorldToClient", {
        configurable: true,
        get: () => worldToClient,
        set: value => {
          worldToClient = value;
          clearTimeout(timeout);
          resolve();
        },
      });
    });
    localStorage.setItem("oprn:editor-ui-mode", "standard");
    localStorage.setItem("oprn:coachmarks-basic-v1", "1");
    localStorage.setItem("oprn:standard-welcome-seen", "1");
    localStorage.setItem("oprn:ai-panel-collapsed", "1");
  });
  const screenshot = name => page.screenshot({ path: join(outputDir, `${name}.png`) });
  const state = () => page.evaluate(() => window.sidebarQa.state.get());
  const map = () => page.evaluate(() => {
    const { state, store } = window.sidebarQa;
    const value = store.getCurrent().maps[state.get().currentMapId];
    return { lower: [...value.lowerTiles], upper: [...value.upperTiles], width: value.width };
  });
  const mode = async value => {
    await page.getByTestId("workspace-panels-button").click();
    await page.getByTestId(`workspace-ui-mode-${value}`).click();
  };
  const size = async value => {
    const control = page.getByTestId(`brush-size-${value}`);
    if (!(await control.isVisible())) await page.getByTestId("oprn-tool-overflow").click();
    await control.click();
    await page.keyboard.press("Escape");
  };
  const point = (x, y) => page.evaluate(({ x, y }) => window.__oprnEditWorldToClient(x * 16 + 8, y * 16 + 8), { x, y });
  const visibleAnchor = async () => {
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    return page.evaluate(() => {
      const view = window.__oprnEditVisibleArea().worldView;
      return { x: Math.floor((view.x + view.width * 0.35) / 16), y: Math.floor((view.y + view.height * 0.45) / 16) };
    });
  };
  const click = async (x, y, options) => {
    const p = await point(x, y);
    assert(p.x > 330 && p.x < 1430 && p.y > 125 && p.y < 890, `offscreen tile ${x},${y}: ${JSON.stringify(p)}`);
    await page.mouse.click(p.x, p.y, options);
  };
  const paint = async () => {
    await page.getByTestId("layer-lower").click();
    await page.getByTestId("tool-paint").click();
    await page.locator('.chipset-tile[data-tile-index="7"]').click();
  };
  const scenario = async (name, action) => {
    if (only.length > 0 && !only.some(prefix => name.startsWith(prefix))) return;
    try {
      const observed = await action();
      await screenshot(name);
      results.push({ name, status: "PASS", observed, screenshot: `${name}.png` });
    } catch (error) {
      await screenshot(name);
      results.push({ name, status: "FAIL", error: error.message, screenshot: `${name}.png` });
    }
    console.log(`QA ${name}: ${results.at(-1).status}`);
  };
  let cleanup = false;
  try {
    await page.goto(`${baseUrl}/?freshProject=1`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 90_000 });
    await page.evaluate(() => window.sidebarSceneReady);
    await page.evaluate(async () => {
      const { store } = await import("/src/project/store.ts");
      const { editorState } = await import("/src/editor/editorState.ts");
      const history = await import("/src/editor/mapEditHistory.ts");
      assertLocal();
      function assertLocal() {
        if (store.remotePersistenceEnabled !== false) throw new Error("QA requires remote persistence disabled");
      }
      window.sidebarQa = { store, state: editorState, history };
      // Keep the existing assets/viewport, but remove incidental terrain and events.
      store.update(project => {
        const map = project.maps[editorState.get().currentMapId];
        map.lowerTiles.fill(240);
        map.upperTiles.fill(-1);
        map.events = [];
        map.lowerTileStacks = {};
        map.upperTileStacks = {};
      }, { scope: "project", label: "Local sidebar QA fixture", origin: "system" });
      history.resetMapEditHistory();
    });
    const anchor = await visibleAnchor();
    if (scope !== "ui") {
      for (const n of [2, 4]) {
        await scenario(`C1-size-${n}`, async () => {
          await paint();
          await size(n);
          const before = await map();
          await click(anchor.x + (n === 4 ? 7 : 0), anchor.y);
          const after = await map();
          const changed = after.lower.flatMap((value, i) => value === 7 && value !== before.lower[i] ? [i] : []);
          assert.equal(changed.length, n * n, `${n}x${n} brush footprint`);
          return { size: n, painted: changed.length, anchor };
        });
      }
      await scenario("C2-sparse-stroke", async () => {
        await paint();
        await size(1);
        const before = await map();
        const a = await point(anchor.x - 3, anchor.y + 4);
        const b = await point(anchor.x + 9, anchor.y + 4);
        await page.mouse.move(a.x, a.y);
        await page.mouse.down();
        await page.mouse.move(b.x, b.y, { steps: 1 });
        await page.mouse.up();
        const after = await map();
        const row = Array.from({ length: 13 }, (_, i) => after.lower[(anchor.y + 4) * after.width + anchor.x - 3 + i]);
        assert.equal(row.filter(tile => tile === 7).length, 13, "sparse stroke must fill all intervening cells");
        await page.getByTestId("oprn-tool-undo").click();
        assert.deepEqual((await map()).lower, before.lower, "one undo must restore the entire stroke");
        return { painted: 13, oneUndoRestored: true };
      });
      await scenario("C3-noop-redo", async () => {
        await paint();
        await size(1);
        await click(anchor.x, anchor.y + 6);
        await click(anchor.x + 4, anchor.y + 6);
        await page.getByTestId("oprn-tool-undo").click();
        assert.equal(await page.evaluate(() => window.sidebarQa.history.getMapEditHistoryState().canRedo), true);
        const before = await map();
        await click(anchor.x, anchor.y + 6);
        assert.deepEqual(await map(), before, "no-op must leave both layers unchanged");
        assert.equal(await page.evaluate(() => window.sidebarQa.history.getMapEditHistoryState().canRedo), true, "no-op must preserve redo");
        await page.keyboard.press("Control+y");
        const restored = await map();
        assert.equal(restored.lower[(anchor.y + 6) * restored.width + anchor.x + 4], 7);
        return { unchangedClick: true, redoRestored: true };
      });
      await scenario("C6-picking-parity", async () => {
        await page.evaluate(({ x, y }) => {
          const { store, state } = window.sidebarQa;
          store.update(project => {
            const map = project.maps[state.get().currentMapId], i = y * map.width + x;
            map.lowerTiles[i] = 43;
            map.upperTiles[i] = 85;
          }, { scope: "project", label: "Local picking QA fixture", origin: "system" });
        }, anchor);
        await page.getByTestId("layer-lower").click();
        await page.getByTestId("tool-eyedropper").click();
        await click(anchor.x, anchor.y);
        const toolbar = await state();
        await page.getByTestId("layer-lower").click();
        await click(anchor.x, anchor.y, { button: "right" });
        const right = await state();
        assert.deepEqual([toolbar.selectedTile, toolbar.layer], [85, "upper"]);
        assert.deepEqual([right.selectedTile, right.layer], [85, "upper"]);
        return { toolbar: [toolbar.selectedTile, toolbar.layer], right: [right.selectedTile, right.layer] };
      });
      await page.evaluate(() => {
        const { store, state } = window.sidebarQa;
        store.update(project => {
          const map = project.maps[state.get().currentMapId];
          project.tilesets[map.tilesetId].structureKits = [{
            id: "qa-brush-section", kind: "section", name: "QA stamp",
            width: 2, height: 2, rows: [{ tiles: [7, 7] }, { tiles: [7, 7] }],
            learnedFrom: "db-authored",
          }];
        }, { scope: "project", label: "Local stamp QA fixture", origin: "system" });
      });
      for (const shape of ["rect", "round"]) {
        await scenario(`C8b-kit-after-${shape}`, async () => {
          await page.getByTestId("tool-paint").click();
          await page.getByTestId(`oprn-tool-${shape}`).click();
          await page.getByTestId("structure-kit-qa-brush-section").click();
          const selected = await state();
          assert.equal(selected.paintShape, "pen", "selecting a kit must leave shape-drag mode");
          assert.equal(selected.activePaletteStamp?.cells.length, 4);
          const x = anchor.x + (shape === "rect" ? 1 : 5), y = anchor.y - 4;
          await click(x, y);
          const after = await map();
          for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
            assert.equal(after.lower[(y + dy) * after.width + x + dx], 7);
          }
          return { shape, stampCells: 4, placed: true };
        });
      }
      await scenario("C8c-keyboard-stamp-reset", async () => {
        await page.getByTestId("tool-paint").click();
        await page.getByTestId("structure-kit-qa-brush-section").click();
        assert.equal((await state()).activePaletteStamp?.cells.length, 4);
        await page.keyboard.press("Escape");
        await page.keyboard.press("e");
        await page.keyboard.press("b");
        assert.equal((await state()).activePaletteStamp, null, "B must clear a stamp just like the Paint button");
        await page.getByTestId("structure-kit-qa-brush-section").click();
        await page.getByTestId("tool-paint").click();
        assert.equal((await state()).activePaletteStamp, null);
        return { keyboardClears: true, buttonClears: true };
      });
    }
    if (scope !== "core") {
      await scenario("C4-modes-and-viewports", async () => {
        await paint();
        await size(4);
        const layouts = [];
        for (const value of ["beginner", "standard", "expert"]) {
          await mode(value);
          for (const [width, height] of [[1440, 900], [1280, 800], [1024, 768]]) {
            await page.setViewportSize({ width, height });
            await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
            assert.equal(await page.getByTestId("brush-size-4").isVisible(), true, `${value} requires visible size controls`);
            assert.equal((await state()).brushSize, 4);
            const dimensions = await page.evaluate(() => {
              const canvas = document.querySelector(".canvas-area").getBoundingClientRect();
              const size = document.querySelector('[data-testid="brush-size-4"]').getBoundingClientRect();
              return { canvasWidth: canvas.width, size: size.toJSON(), overflow: document.documentElement.scrollWidth > innerWidth };
            });
            assert(dimensions.canvasWidth >= 520);
            assert.equal(dimensions.overflow, false);
            assert(dimensions.size.bottom <= height && dimensions.size.right <= width);
            await screenshot(`${value}-${width}`);
            layouts.push({ mode: value, width, height, ...dimensions });
          }
        }
        await page.setViewportSize({ width: 1440, height: 900 });
        await mode("standard");
        return layouts;
      });
      await scenario("C5-representative-selection", async () => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await mode("standard");
        await page.getByTestId("layer-lower").click();
        const target = await visibleAnchor();
        await page.evaluate(({ x, y }) => {
          const { store, state } = window.sidebarQa;
          store.update(project => {
            const map = project.maps[state.get().currentMapId], i = y * map.width + x;
            map.lowerTiles[i] = 423;
            map.upperTiles[i] = -1;
          }, { scope: "project", label: "Local autotile QA fixture", origin: "system" });
        }, target);
        await page.getByTestId("tile-search-input").fill("zzzz-no-match");
        await click(target.x, target.y, { button: "right" });
        const representative = page.getByTestId("chipset-tile-363");
        assert.equal(await representative.count(), 1, "picked representative must survive filter");
        assert.equal(await representative.getAttribute("aria-pressed"), "true");
        await page.getByTestId("tile-search-input").fill("");
        assert.equal(await representative.getAttribute("aria-pressed"), "true");
        return { picked: (await state()).selectedTile, representative: 363, pressed: true };
      });
      await scenario("C7-beginner-search", async () => {
        await mode("standard");
        await page.getByTestId("tile-search-input").fill("");
        await paint();
        await mode("beginner");
        await page.getByTestId("basic-tile-search").fill("zzzz-no-match");
        const feedback = page.getByTestId("basic-tile-search-feedback");
        assert.equal(await feedback.isVisible(), true, "unmatched search needs feedback");
        assert.equal(await feedback.getAttribute("data-match-count"), "0");
        assert.equal(await page.getByTestId("basic-tile-search-reset").isVisible(), true);
        await page.getByTestId("basic-tile-search-reset").click();
        assert.equal(await page.getByTestId("basic-tile-search").inputValue(), "");
        assert.equal(await page.getByTestId("basic-tile-search").evaluate(e => e === document.activeElement), true);
        return { matchCount: 0, reset: true, focusRestored: true };
      });
      await scenario("C8a-custom-atlas-stamp", async () => {
        await mode("standard");
        await page.getByTestId("tile-search-input").fill("");
        await page.getByTestId("tool-paint").click();
        await page.evaluate(() => {
          const { store, state } = window.sidebarQa;
          store.update(project => {
            const map = project.maps[state.get().currentMapId], tileset = project.tilesets[map.tilesetId];
            tileset.kind = "custom";
            // Retain the real bundled sheet's 30-column geometry; only classify
            // this four-cell fixture to make its authored layers deterministic.
            for (const tile of [7, 8, 37, 38]) tileset.priority[tile] = "lower";
          }, { scope: "project", label: "Local custom atlas QA fixture", origin: "system" });
          state.set({ layer: "lower", selectedTile: 7 });
        });
        const first = page.locator('.chipset-tile[data-tile-index="7"]');
        const last = page.locator('.chipset-tile[data-tile-index="38"]');
        await last.evaluate(node => node.scrollIntoView({ block: "nearest", inline: "nearest" }));
        const a = await first.boundingBox(), b = await last.boundingBox();
        assert(a && b);
        await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
        await page.mouse.down();
        await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
        await page.mouse.up();
        const selected = await state();
        assert(selected.activePaletteStamp, "custom atlas drag must create a stamp");
        assert.deepEqual(selected.activePaletteStamp.cells.map(cell => cell.tile), [7, 8, 37, 38]);
        const target = await visibleAnchor();
        const x = target.x + 1, y = target.y + 2;
        await click(x, y);
        const after = await map();
        assert.deepEqual([
          after.lower[y * after.width + x], after.lower[y * after.width + x + 1],
          after.lower[(y + 1) * after.width + x], after.lower[(y + 1) * after.width + x + 1],
        ], [7, 8, 37, 38]);
        return { sourceCells: [7, 8, 37, 38], placed: true };
      });
    }
  } finally {
    await context.close();
    cleanup = true;
    await writeFile(join(outputDir, "results.json"), JSON.stringify({ baseUrl, scope, results, errors, cleanup }, null, 2));
  }
  return { results, errors, cleanup, outputDir };
}
