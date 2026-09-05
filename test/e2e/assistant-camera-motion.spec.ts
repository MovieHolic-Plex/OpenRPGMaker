import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const evidence = path.resolve(".omo/evidence/assistant-camera-motion");

// Ephemeral contract fixture only: exercises the shipped editor camera, without an LLM or remote writes.
test("assistant camera: smooth fit, exact map, interruption, overlay and reduced motion", async ({ page, baseURL }) => {
  test.setTimeout(180_000);
  mkdirSync(evidence, { recursive: true });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem("oprn:editor-welcome-dismissed", "1");
    localStorage.setItem("oprn:standard-welcome-seen", "1");
    localStorage.setItem("oprn:coachmarks-basic-v1", "1");
  });
  // Local Vite resources go through Playwright's Node transport: host netlink changes can
  // otherwise abort Chromium's entire module graph with ERR_NETWORK_CHANGED.
  await page.route((url) => url.origin === new URL(baseURL!).origin && !url.pathname.startsWith("/api/"), async (route) => {
    await route.fulfill({ response: await route.fetch() });
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/?freshProject=1", { waitUntil: "domcontentloaded" });
  const guest = page.getByTestId("login-guest");
  if (await guest.isVisible().catch(() => false)) await guest.click();
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 45_000 });
  await page.waitForFunction(() => Boolean((window as any).__oprnEditVisibleArea?.()));
  await page.evaluate(async () => {
    const { store } = await import(/* @vite-ignore */ "/src/project/store.ts");
    const { createBlankMap } = await import(/* @vite-ignore */ "/src/project/defaults.ts");
    const { editorState } = await import(/* @vite-ignore */ "/src/editor/editorState.ts");
    const { requestEditorCameraFocus } = await import(/* @vite-ignore */ "/src/editor/editorCameraFocus.ts");
    const { focusEditorRegion } = await import(/* @vite-ignore */ "/src/editor/editorReferenceNavigation.ts");
    const { VIEW_FOCUS_TOOLS } = await import(/* @vite-ignore */ "/src/editor/tools/viewFocusTools.ts");
    const project = structuredClone(store.getCurrent());
    const a = createBlankMap("Camera QA A", 100, 80);
    const b = createBlankMap("Camera QA B", 30, 24);
    a.id = "camera-qa-a"; b.id = "camera-qa-b";
    project.maps = { [a.id]: a, [b.id]: b };
    project.startMapId = a.id;
    project.mapTree = { mapId: a.id, children: [{ mapId: b.id, children: [] }] };
    store.replace(project);
    editorState.set({ currentMapId: a.id, zoom: 4, tool: "select" });
    (window as any).__cameraQA = { editorState, requestEditorCameraFocus, focusEditorRegion, store, tool: VIEW_FOCUS_TOOLS[0] };
  });
  await page.waitForTimeout(200);

  const smooth = await page.evaluate(async () => {
    const w = window as any;
    const read = () => ({ ...w.__oprnEditCamera(), view: { ...w.__oprnEditVisibleArea().worldView }, mapId: w.__oprnEditMapViewport().mapId });
    const before = read();
    const result = w.__cameraQA.tool.run(w.__cameraQA.store.getCurrent(), { mapId: "camera-qa-a", x: 64, y: 48, w: 30, h: 25 });
    w.__cameraQA.focusEditorRegion(result.data);
    const immediate = read();
    const frames: any[] = [];
    const start = performance.now();
    while (performance.now() - start < 15_000) {
      await new Promise(requestAnimationFrame);
      frames.push({ time: performance.now() - start, ...read() });
      if (performance.now() - start >= 900 && Math.abs(read().zoom - w.__cameraQA.editorState.get().zoom) < 0.000001) break;
    }
    return { before, immediate, frames, final: read(), area: w.__oprnEditVisibleArea(), viewport: w.__oprnEditMapViewport() };
  });
  writeFileSync(path.join(evidence, "smooth-frames.json"), JSON.stringify(smooth, null, 2));
  expect(smooth.immediate.zoom).toBe(smooth.before.zoom);
  expect(smooth.immediate.view).toEqual(smooth.before.view);
  expect(smooth.final.zoom).toBeLessThan(smooth.before.zoom);
  expect(smooth.frames.some((f) => f.zoom < smooth.before.zoom && f.zoom > smooth.final.zoom)).toBe(true);
  expect(smooth.frames.every((f) => f.mapId === "camera-qa-a" && Number.isFinite(f.view.x))).toBe(true);
  for (let index = 1; index < smooth.frames.length; index++) {
    expect(smooth.frames[index].zoom).toBeLessThanOrEqual(smooth.frames[index - 1].zoom + 0.00001);
  }
  // The target center must land in the visible area, including when the assistant floats over the canvas.
  const { canvas, unoccluded, worldView, zoom } = smooth.area;
  const x = canvas.x + (79 * 16 - worldView.x) * zoom;
  const y = canvas.y + (60.5 * 16 - worldView.y) * zoom;
  expect(Math.abs(x - (unoccluded.x + unoccluded.width / 2))).toBeLessThan(3);
  expect(Math.abs(y - (unoccluded.y + unoccluded.height / 2))).toBeLessThan(3);
  await page.screenshot({ path: path.join(evidence, "01-fit-region.png") });

  const switched = await page.evaluate(async () => {
    const w = window as any;
    w.__cameraQA.requestEditorCameraFocus({ mapId: "camera-qa-a", tileX: 2, tileY: 2 });
    await new Promise((resolve) => setTimeout(resolve, 80));
    w.__cameraQA.editorState.set({ currentMapId: "camera-qa-b" });
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
    const before = w.__oprnEditCamera();
    // A late result for A must not move B.
    w.__cameraQA.requestEditorCameraFocus({ mapId: "camera-qa-a", tileX: 90, tileY: 70 });
    await new Promise((resolve) => setTimeout(resolve, 800));
    return { before, after: w.__oprnEditCamera(), viewport: w.__oprnEditMapViewport() };
  });
  expect(switched.viewport.mapId).toBe("camera-qa-b");
  expect(switched.after).toEqual(switched.before);
  await page.screenshot({ path: path.join(evidence, "02-map-switch.png") });

  await page.evaluate(() => {
    const w = window as any;
    w.__cameraQA.requestEditorCameraFocus({ mapId: "camera-qa-b", tileX: 27, tileY: 20 });
  });
  await page.waitForTimeout(60);
  const rect = await page.getByTestId("edit-canvas").boundingBox();
  if (!rect) throw new Error("missing canvas");
  await page.mouse.move(rect.x + rect.width * 0.85, rect.y + rect.height * 0.5);
  await page.mouse.wheel(30, 50);
  await page.waitForTimeout(80);
  const stopped = await page.evaluate(() => (window as any).__oprnEditCamera());
  await page.waitForTimeout(800);
  expect(await page.evaluate(() => (window as any).__oprnEditCamera())).toEqual(stopped);

  await page.emulateMedia({ reducedMotion: "reduce" });
  const reduced = await page.evaluate(() => {
    const w = window as any;
    w.__cameraQA.focusEditorRegion({ mapId: "camera-qa-b", x: 10, y: 10, w: 1, h: 1 });
    return w.__oprnEditVisibleArea();
  });
  const reducedX = reduced.canvas.x + (10.5 * 16 - reduced.worldView.x) * reduced.zoom;
  const reducedY = reduced.canvas.y + (10.5 * 16 - reduced.worldView.y) * reduced.zoom;
  expect(Math.abs(reducedX - reduced.unoccluded.x - reduced.unoccluded.width / 2)).toBeLessThan(3);
  expect(Math.abs(reducedY - reduced.unoccluded.y - reduced.unoccluded.height / 2)).toBeLessThan(3);
  const reducedCamera = await page.evaluate(() => (window as any).__oprnEditCamera());
  await page.waitForTimeout(700);
  expect(await page.evaluate(() => (window as any).__oprnEditCamera())).toEqual(reducedCamera);
  writeFileSync(path.join(evidence, "measurements.json"), JSON.stringify({ smooth, switched, stopped, reduced, errors }, null, 2));
  expect(errors).toEqual([]);
});
