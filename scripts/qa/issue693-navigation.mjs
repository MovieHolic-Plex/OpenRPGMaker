import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { firefox } from "@playwright/test";

// Real editor + Phaser + project store, with local-only fixtures and no provider calls.
// Run against a freshly restarted, isolated, frozen Vite server (see the evidence README).
const baseURL = process.env.BASE_URL ?? "http://127.0.0.1:38423";
const output = process.env.EVIDENCE_DIR ?? "output/evidence/issue693-navigation";
const sizes = [{ width: 1024, height: 768 }, { width: 1280, height: 800 }, { width: 1440, height: 900 }]
  .filter(size => !process.env.QA_WIDTH || size.width === Number(process.env.QA_WIDTH));
await mkdir(output, { recursive: true });
const browser = await firefox.launch();
const results = [];
try {
  for (const size of sizes) {
    const context = await browser.newContext({ viewport: size, reducedMotion: "reduce" });
    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    await page.route("**/*", route => {
      const request = route.request();
      if (!["GET", "HEAD", "OPTIONS"].includes(request.method()) && /legacyDb|\/api\//.test(request.url())) {
        return route.abort("blockedbyclient");
      }
      return route.continue();
    });
    await page.addInitScript(() => {
      localStorage.setItem("oprn:editor-ui-mode", "standard");
      localStorage.setItem("oprn:ai-panel-collapsed", "1");
      window.navigationReady = new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(Error("EditScene hook missing")), 90000);
        let hook;
        Object.defineProperty(window, "__oprnEditWorldToClient", {
          configurable: true, get: () => hook,
          set: value => { hook = value; clearTimeout(timer); resolve(); },
        });
      });
    });
    await page.goto(`${baseURL}/?freshProject=1`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.evaluate(() => window.navigationReady);
    await page.evaluate(async () => {
      const { getGame } = await import("/src/app/mode.ts");
      const { editorState: state } = await import("/src/editor/editorState.ts");
      const { store } = await import("/src/project/store.ts");
      const { createBlankProject } = await import("/src/project/defaults.ts");
      const { requestEditorCameraFocus } = await import("/src/editor/editorCameraFocus.ts");
      if (store.remotePersistenceEnabled !== false) throw Error("QA requires local-only project");
      const scene = getGame().scene.getScene("EditScene");
      const afterMutation = mutate => new Promise((resolve, reject) => {
        const finish = () => { clearTimeout(timer); resolve(); };
        const timer = setTimeout(() => { scene.game.events.off("postrender", finish); reject(Error("Phaser postrender missing")); }, 10000);
        scene.game.events.once("postrender", finish);
        mutate();
      });
      window.nav = { scene, state, store, createBlankProject, requestEditorCameraFocus, afterMutation };
    });
    // Real DOM input must reach its target before the render signal is armed.
    // Register the exact input event before Playwright triggers it; no frame-count waits.
    const input = async (type, action) => {
      await page.evaluate(type => {
        window.nav.inputDone = new Promise((resolve, reject) => {
          const receive = () => {
            window.removeEventListener(type, receive, true);
            queueMicrotask(() => window.nav.scene.game.events.once("postrender", finish));
          };
          const finish = () => { clearTimeout(timer); resolve(); };
          const timer = setTimeout(() => {
            window.removeEventListener(type, receive, true);
            window.nav.scene.game.events.off("postrender", finish);
            reject(Error(`${type} / postrender missing`));
          }, 10000);
          window.addEventListener(type, receive, true);
        });
      }, type);
      await action();
      await page.evaluate(() => window.nav.inputDone);
    };
    const state = patch => page.evaluate(patch => window.nav.afterMutation(() => window.nav.state.set(patch)), patch);
    const read = () => page.evaluate(() => ({ camera: window.__oprnEditCamera(), area: window.__oprnEditVisibleArea() }));
    const projectBytes = () => page.evaluate(() => JSON.stringify(window.nav.store.getCurrent()));
    const focus = value => {
      const { canvas, unoccluded: view, worldView: world, zoom } = value.area;
      return { x: world.x + (view.x - canvas.x + view.width / 2) / zoom, y: world.y + (view.y - canvas.y + view.height / 2) / zoom };
    };
    const sameFocus = (before, after) => {
      assert(Math.abs(focus(before).x - focus(after).x) < 1, "visible focal X must survive layout/zoom");
      assert(Math.abs(focus(before).y - focus(after).y) < 1, "visible focal Y must survive layout/zoom");
    };
    const center = (x, y) => page.evaluate(({ x, y }) => window.nav.afterMutation(() => {
      window.nav.requestEditorCameraFocus({ mapId: window.nav.state.get().currentMapId, tileX: x, tileY: y });
    }), { x, y });
    const point = (x, y) => page.evaluate(({ x, y }) => window.__oprnEditWorldToClient(x * 16 + 8, y * 16 + 8), { x, y });
    const scroll = (axis, fraction) => page.getByTestId(`editor-camera-scroll-${axis}`).evaluate((node, { axis, fraction }) => new Promise((resolve, reject) => {
      const key = axis === "x" ? "scrollLeft" : "scrollTop";
      const max = axis === "x" ? node.scrollWidth - node.clientWidth : node.scrollHeight - node.clientHeight;
      const target = Math.round(max * fraction);
      if (Math.abs(node[key] - target) < 1) { resolve(); return; }
      const receive = () => window.nav.scene.game.events.once("postrender", finish);
      const finish = () => { clearTimeout(timer); resolve(); };
      const timer = setTimeout(() => { node.removeEventListener("scroll", receive); reject(Error("native scroll event missing")); }, 10000);
      node.addEventListener("scroll", receive, { once: true });
      node[key] = target;
    }), { axis, fraction });
    const bars = () => page.locator(".editor-camera-scroll").evaluateAll(nodes => nodes.map(node => ({
      axis: node.dataset.testid.endsWith("-x") ? "x" : "y",
      width: node.clientWidth, height: node.clientHeight, scrollWidth: node.scrollWidth, scrollHeight: node.scrollHeight,
      left: node.scrollLeft, top: node.scrollTop, ratio: Number(node.dataset.trackRatio),
      bounds: node.getBoundingClientRect().toJSON(), name: node.getAttribute("aria-label"), tabIndex: node.tabIndex,
    })));
    const scenario = async (name, run) => {
      try { results.push({ size, name, status: "PASS", observed: await run() }); }
      catch (error) { results.push({ size, name, status: "FAIL", error: error.message }); }
      await page.screenshot({ path: `${output}/${size.width}-${name}.png` });
      await writeFile(`${output}/results.json`, JSON.stringify(results, null, 2));
      console.log(size.width, name, results.at(-1).status, results.at(-1).error ?? "");
    };

    for (const mapKind of ["large", "small"]) {
      if (mapKind === "small") {
        await page.evaluate(() => window.nav.afterMutation(() => {
          const project = window.nav.createBlankProject();
          window.nav.store.replace(project);
          window.nav.state.set({ currentMapId: project.startMapId, tool: "select", selection: null, pendingEventCoordinate: null });
        }));
      }
      const mapSize = await page.evaluate(() => {
        const map = window.nav.store.getCurrent().maps[window.nav.state.get().currentMapId];
        return { width: map.width, height: map.height };
      });
      await state({ zoom: 2, tool: "select", selection: null });
      await center(Math.floor(mapSize.width / 2), Math.floor(mapSize.height / 2));
      await scenario(`${mapKind}-ctrl-wheel`, async () => {
        const before = await read();
        const pointer = { x: Math.round(before.area.canvas.x + before.area.canvas.width * .4), y: Math.round(before.area.canvas.y + before.area.canvas.height * .4) };
        const world = value => ({ x: value.area.worldView.x + (pointer.x - value.area.canvas.x) / value.camera.zoom, y: value.area.worldView.y + (pointer.y - value.area.canvas.y) / value.camera.zoom });
        await page.mouse.move(pointer.x, pointer.y);
        const baseline = world(before);
        for (const delta of [-120, 120]) {
          await page.keyboard.down("Control");
          try { await input("wheel", () => page.mouse.wheel(0, delta)); }
          finally { await page.keyboard.up("Control"); }
          const after = await read();
          assert.equal(after.camera.zoom, delta < 0 ? 3 : 2);
          assert(Math.abs(world(after).x - baseline.x) < .01, "pointer world X is fixed");
          assert(Math.abs(world(after).y - baseline.y) < .01, "pointer world Y is fixed");
        }
        return { before, after: await read() };
      });
      await scenario(`${mapKind}-assistant-expanded`, async () => {
        await state({ zoom: 2 });
        const before = await read();
        await input("click", () => page.getByTestId("ai-collapsed-restore").click());
        const after = await read(); sameFocus(before, after);
        assert.equal(after.camera.zoom, before.camera.zoom);
        assert(after.area.unoccluded.height < after.area.canvas.height || after.area.unoccluded.width < after.area.canvas.width);
        return { before, after, bars: await bars() };
      });
      await scenario(`${mapKind}-assistant-resized`, async () => {
        const handle = page.getByTestId("ai-resize-handle");
        await handle.focus();
        const before = await read();
        const oldWidth = await handle.getAttribute("aria-valuenow");
        await input("keyup", () => page.keyboard.press("Shift+ArrowRight"));
        const after = await read(); sameFocus(before, after);
        assert.notEqual(await handle.getAttribute("aria-valuenow"), oldWidth);
        // Keyboard zoom remains available with the assistant open and preserves its focal point.
        await page.evaluate(() => document.activeElement.blur());
        await input("keyup", () => page.keyboard.press("+"));
        assert.equal((await read()).camera.zoom, 3);
        sameFocus(after, await read());
        await input("keyup", () => page.keyboard.press("-"));
        return { before, after, bars: await bars() };
      });
      await scenario(`${mapKind}-scrollbars`, async () => {
        const unchanged = await projectBytes();
        const metrics = [];
        for (const axis of ["x", "y"]) {
          for (const fraction of [0, 1, .5]) {
            await scroll(axis, fraction);
            const view = await read();
            const list = await bars();
            assert.equal(list.length, 2);
            const bar = list.find(item => item.axis === axis);
            const span = axis === "x" ? view.area.unoccluded.width : view.area.unoccluded.height;
            const content = (axis === "x" ? mapSize.width : mapSize.height) * 16 * view.camera.zoom + span + 64;
            const thumbRatio = axis === "x" ? bar.width / bar.scrollWidth : bar.height / bar.scrollHeight;
            assert(Math.abs(thumbRatio - span / content) < .002, "native thumb represents padded viewport fraction");
            const nativePosition = axis === "x" ? bar.left : bar.top;
            const expectedCenter = (nativePosition / bar.ratio - 32) / view.camera.zoom;
            assert(Math.abs(focus(view)[axis] - expectedCenter) < .75, "native thumb position agrees with camera");
            assert.equal(bar.tabIndex, 0); assert(bar.name);
            metrics.push({ axis, fraction, view, bar });
          }
        }
        const keyboardBefore = await read();
        const horizontal = page.getByTestId("editor-camera-scroll-x");
        await horizontal.focus();
        await horizontal.evaluate(node => {
          window.nav.keyboardScrolled = new Promise((resolve, reject) => {
            const finish = () => { clearTimeout(timer); resolve(); };
            const timer = setTimeout(() => { node.removeEventListener("scrollend", finish); reject(Error("keyboard scrollend missing")); }, 10000);
            node.addEventListener("keydown", () => node.addEventListener("scrollend", finish, { once: true }), { once: true });
          });
        });
        await page.keyboard.press("ArrowRight");
        await page.evaluate(() => window.nav.keyboardScrolled);
        const keyboardAfter = await read();
        assert(keyboardAfter.camera.scrollX > keyboardBefore.camera.scrollX, "native keyboard scrollbar input moves the camera");
        metrics.push({ keyboardBefore, keyboardAfter });
        assert.equal(await projectBytes(), unchanged);
        return metrics;
      });
      await scenario(`${mapKind}-assistant-collapsed`, async () => {
        const before = await read();
        await input("click", () => page.getByTestId("ai-collapse").click());
        const after = await read(); sameFocus(before, after);
        return { before, after, bars: await bars() };
      });
      await scenario(`${mapKind}-neutral-drag`, async () => {
        await state({ tool: "select", selection: null, activePaletteStamp: null, pastePreview: null });
        await center(0, 0);
        const before = await read();
        const pointer = await point(-2, -2);
        const unchanged = await projectBytes();
        await page.mouse.move(pointer.x, pointer.y);
        await input("pointermove", async () => {
          await page.mouse.down();
          await page.mouse.move(pointer.x + 24, pointer.y + 20);
        });
        await page.mouse.up();
        const after = await read();
        assert(after.camera.scrollX < before.camera.scrollX - 5);
        assert(after.camera.scrollY < before.camera.scrollY - 5);
        assert.equal(await projectBytes(), unchanged);
        assert.equal(await page.evaluate(() => window.nav.state.get().selection), null);
        return { before, after, bars: await bars() };
      });
      await scenario(`${mapKind}-pan-alternatives`, async () => {
        const receipts = [];
        const unchanged = await projectBytes();
        for (const gesture of ["space", "middle", "pan-tool"]) {
          await state({ tool: gesture === "pan-tool" ? "pan" : "paint", layer: "lower", selection: null });
          await center(5, 5);
          const pointer = await point(4, 4);
          const before = await read();
          await page.mouse.move(pointer.x, pointer.y);
          if (gesture === "space") await page.keyboard.down("Space");
          try {
            await input("pointermove", async () => {
              await page.mouse.down({ button: gesture === "middle" ? "middle" : "left" });
              await page.mouse.move(pointer.x + 24, pointer.y + 20);
            });
          } finally {
            await page.mouse.up({ button: gesture === "middle" ? "middle" : "left" });
            if (gesture === "space") await page.keyboard.up("Space");
          }
          const after = await read();
          assert(Math.abs(after.camera.scrollX - before.camera.scrollX + 24 / before.camera.zoom) < .01);
          assert(Math.abs(after.camera.scrollY - before.camera.scrollY + 20 / before.camera.zoom) < .01);
          receipts.push({ gesture, before, after });
        }
        assert.equal(await projectBytes(), unchanged);
        return receipts;
      });
      await scenario(`${mapKind}-edit-alignment`, async () => {
        await state({ zoom: 3, tool: "select", selection: null, layer: "lower" });
        await center(5, 5);
        const a = await point(4, 4); const b = await point(6, 6);
        const camera = (await read()).camera;
        await page.mouse.move(a.x, a.y); await page.mouse.down();
        await page.mouse.move(b.x, b.y);
        await input("mouseup", () => page.mouse.up());
        const selection = await page.evaluate(() => window.nav.state.get().selection);
        assert.deepEqual({ x: selection.x, y: selection.y, width: selection.width, height: selection.height }, { x: 4, y: 4, width: 3, height: 3 });
        assert.deepEqual((await read()).camera, camera, "inside-map selection wins over pan");
        await state({ selection: null, tool: "paint", selectedTile: 7, brushSize: 1, autoConnectMode: false });
        const old = await page.evaluate(() => {
          const map = window.nav.store.getCurrent().maps[window.nav.state.get().currentMapId];
          return map.lowerTiles[4 * map.width + 4];
        });
        await input("mouseup", () => page.mouse.click(a.x, a.y));
        const painted = await page.evaluate(() => {
          const map = window.nav.store.getCurrent().maps[window.nav.state.get().currentMapId];
          return map.lowerTiles[4 * map.width + 4];
        });
        assert.notEqual(painted, old, "paint lands at the pointed tile after zoom and pan");
        assert.deepEqual((await read()).camera, camera, "paint never pans");
        await state({ tool: "event", layer: "event" });
        await input("mouseup", () => page.mouse.click(b.x, b.y));
        const pending = await page.evaluate(() => window.nav.state.get().pendingEventCoordinate);
        assert.equal(pending.x, 6); assert.equal(pending.y, 6);
        assert.deepEqual((await read()).camera, camera, "event placement never pans");
        await state({ tool: "select", layer: "lower", pendingEventCoordinate: null });
        const wheelBefore = await read();
        await page.mouse.move(a.x, a.y);
        await input("wheel", () => page.mouse.wheel(24, 40));
        const wheelAfter = await read();
        assert.equal(wheelAfter.camera.zoom, wheelBefore.camera.zoom);
        assert(Math.abs(wheelAfter.camera.scrollX - wheelBefore.camera.scrollX - 24) < .01);
        assert(Math.abs(wheelAfter.camera.scrollY - wheelBefore.camera.scrollY - 40) < .01);
        return { selection, painted, pending, wheelBefore, wheelAfter };
      });
    }
    await scenario("live-resize-and-mode", async () => {
      await state({ tool: "select", selection: null, zoom: 2 });
      await center(5, 5);
      const before = await read();
      for (const mode of ["expert", "standard"]) {
        await page.getByTestId("workspace-panels-button").click();
        await input("click", () => page.getByTestId(`workspace-ui-mode-${mode}`).click());
        // Window size changes always produce the exact Phaser scale resize event.
        await page.evaluate(() => {
          window.nav.resized = new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(Error("Phaser resize missing")), 10000);
            window.nav.scene.scale.once("resize", () => {
              window.nav.scene.game.events.once("postrender", () => { clearTimeout(timer); resolve(); });
            });
          });
        });
        await page.setViewportSize({ width: size.width + (mode === "expert" ? 64 : 0), height: size.height });
        await page.evaluate(() => window.nav.resized);
        sameFocus(before, await read());
        assert.equal((await read()).camera.zoom, before.camera.zoom);
      }
      return { before, after: await read(), bars: await bars() };
    });
    await context.close();
  }
} finally {
  await browser.close();
  await writeFile(`${output}/results.json`, JSON.stringify(results, null, 2));
}
if (results.some(result => result.status !== "PASS")) process.exitCode = 1;
