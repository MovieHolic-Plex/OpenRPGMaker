import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { createServer, type Server } from "node:net";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Browser, type Page } from "playwright";
import { compileSpatialOccurrence } from "../../src/editor/spatial/compileSpatialOccurrence";
import { own } from "../../src/project/spatial/domain";
import { placeChild, placeCompilerFixture, placeRoot, stairFloors } from "../../test/support/spatialPlaceCompilerFixture";
import { fixtureDocument } from "../../test/support/spatialSpaceCompilerFixture";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const port = Number(process.env.QA_PORT ?? 9842);
const base = `http://127.0.0.1:${port}`;
const out = resolve(root, process.env.EVIDENCE_DIR ?? "output/evidence/tile-to-world/place-member-ui");
const viewports = [
  { width: 1024, height: 768 },
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
] as const;
const forbidden = new Set([9841, 9888]);

const consoleMessages: { readonly type: string; readonly text: string }[] = [];
const pageErrors: string[] = [];
const requestFailures: { readonly url: string; readonly error: string | undefined }[] = [];
const httpFailures: { readonly url: string; readonly status: number }[] = [];
const errors: { readonly name: string; readonly message: string; readonly stack?: string }[] = [];
const interactions: Record<string, unknown>[] = [];
const report = {
  base, root, viewports, interactions, errors, outcome: "FAIL", viteBin: "",
  console: consoleMessages, pageErrors, requestFailures, httpFailures,
  geographyMotion: "future-integration: geography compiled-motion backend is repaired elsewhere; this slice tests place-root/room scopes only",
  cleanup: { serverStarted: false, browserStarted: false, browserClosed: false, serverClosed: false,
    cacheRemoved: false, cacheDir: "", serverPid: 0, port },
};

let probe: Server | undefined;
let server: ReturnType<typeof spawn> | undefined;
let serverClosed: Promise<void> | undefined;
let browser: Browser | undefined;
let cacheDir: string | undefined;
let serverLog = "";

async function bounded<T>(operation: Promise<T>, milliseconds: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([operation, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Deadline exceeded: ${milliseconds}ms`)), milliseconds);
    })]);
  } finally { clearTimeout(timer); }
}

function recordFailure(error: unknown): void {
  const entry = error instanceof Error
    ? { name: error.name, message: error.message, ...(error.stack ? { stack: error.stack } : {}) }
    : { name: "UnknownError", message: String(error) };
  errors.push(entry);
  serverLog += `${JSON.stringify({ event: "surface-failure", ...entry })}\n`;
  console.error(JSON.stringify({ event: "surface-failure", ...entry }));
  process.exitCode = 1;
}

function boxOf(box: { x: number; y: number; width: number; height: number } | null) {
  if (!box) return null;
  return { x: box.x, y: box.y, width: box.width, height: box.height };
}


function loadBrowser(spec: string): Promise<Record<string, unknown>> {
  return (new Function("s", "return import(s)") as (s: string) => Promise<Record<string, unknown>>)(spec);
}

const compiled = compileSpatialOccurrence(placeCompilerFixture(19), { occurrenceId: placeRoot });
const innId = placeChild(compiled, placeRoot, "inn");
const room2 = placeChild(compiled, innId, "floor-2");
const innSource = own(fixtureDocument(compiled).occurrences, innId).source.id;
const stairs = stairFloors(compiled);
const fixture = JSON.parse(JSON.stringify(compiled)) as typeof compiled;

async function readPlace(page: Page) {
  return page.evaluate(async (ids: { readonly rootId: string; readonly innId: string }) => {
    const load = new Function("s", "return import(s)") as (s: string) => Promise<Record<string, unknown>>;
    const { store } = await load("/src/project/store.ts") as { store: { getCurrent: () => any } };
    const { spatialSession } = await load("/src/editor/panels/spatialAuthoringSession.ts") as { spatialSession: () => any };
    const { visibleAuthoringProject, hasAuthoringPreview } = await load("/src/editor/panels/spatialAuthoringAccess.ts") as {
      visibleAuthoringProject: () => any; hasAuthoringPreview: () => boolean;
    };
    const { placedPlaceChildren } = await load("/src/editor/spatial/placedPlaceEdits.ts") as {
      placedPlaceChildren: (project: any, id: string) => readonly any[];
    };
    const live = store.getCurrent();
    const visible = visibleAuthoringProject();
    const liveDoc = live.spatialAuthoring;
    const visDoc = visible.spatialAuthoring;
    return {
      session: spatialSession(),
      hasPreview: hasAuthoringPreview(),
      liveTitle: live.meta.title,
      visibleTitle: visible.meta.title,
      liveChildIds: liveDoc ? placedPlaceChildren(live, ids.rootId).map((child) => child.occurrenceId) : [],
      visibleChildIds: visDoc ? placedPlaceChildren(visible, ids.rootId).map((child) => child.occurrenceId) : [],
      visibleChildren: visDoc ? placedPlaceChildren(visible, ids.rootId).map((child) => ({
        id: child.occurrenceId, x: child.x, y: child.y, level: child.level,
      })) : [],
      visibleRooms: visDoc ? placedPlaceChildren(visible, ids.innId).map((child) => ({
        id: child.occurrenceId, x: child.x, y: child.y, level: child.level,
      })) : [],
      liveConnections: liveDoc?.connections.length ?? 0,
      visibleConnections: visDoc?.connections.filter((link) => link.overviewRoute === undefined).length ?? 0,
      liveEvents: Object.values(live.maps).reduce((count, map) => count + map.events.length, 0),
      visibleEvents: Object.values(visible.maps).reduce((count, map) => count + map.events.length, 0),
      applyDisabled: document.querySelector<HTMLButtonElement>("[data-testid='spatial-apply']")?.disabled ?? true,
      previewError: document.querySelector("[data-testid='spatial-preview-error']")?.textContent
        ?? document.querySelector("[data-testid='spatial-place-status']")?.textContent
        ?? "",
    };
  }, { rootId: placeRoot, innId });
}

async function openPlaces(page: Page): Promise<void> {
  await page.getByTestId("toolbar-database").waitFor({ state: "visible", timeout: 120000 });
  await page.getByTestId("toolbar-database").click();
  await page.getByTestId("database-modal").waitFor({ state: "visible" });
  const world = page.getByTestId("db-tab-group-world");
  if (await world.getAttribute("aria-expanded") === "false") await world.click();
  await page.getByTestId("db-tab-spatial-places").click();
  await page.getByTestId("spatial-shell-places").waitFor({ state: "visible" });
  await page.getByTestId("spatial-mode-instances").click();
  await page.evaluate(async () => {
    const load = new Function("s", "return import(s)") as (s: string) => Promise<Record<string, unknown>>;
    const { patchSpatialSession } = await load("/src/editor/panels/spatialAuthoringSession.ts") as {
      patchSpatialSession: (patch: object) => void;
    };
    patchSpatialSession({ inspectorOpen: true });
  });
  await page.getByTestId("spatial-mode-instances").click();
  await page.getByTestId(`spatial-card-${placeRoot}`).click();
  await page.getByTestId(`spatial-place-child-${innId}`).waitFor({ state: "visible" });
}

async function runViewport(page: Page, viewport: { readonly width: number; readonly height: number }, full: boolean): Promise<void> {
  const name = `${viewport.width}x${viewport.height}`;
  page.setDefaultTimeout(30000);
  await page.addInitScript(() => {
    localStorage.setItem("oprn:editor-welcome-dismissed", "1");
    localStorage.setItem("oprn:editor-ui-mode", "expert");
  });
  await page.goto(`${base}/?blankProject=1&aiBridge=0`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.getByTestId("toolbar-database").waitFor({ state: "visible", timeout: 120000 });
  await page.evaluate(async (next) => {
    const load = new Function("s", "return import(s)") as (s: string) => Promise<Record<string, unknown>>;
    const { store } = await load("/src/project/store.ts") as {
      store: { isRemotePersistenceEnabled: () => boolean; replace: (project: unknown, opts?: object) => void };
    };
    if (store.isRemotePersistenceEnabled()) throw new Error("QA requires local persistence");
    store.replace(next, { preserveEventDrafts: false });
  }, fixture);
  await openPlaces(page);
  const innBox = boxOf(await page.getByTestId(`spatial-place-child-${innId}`).boundingBox());
  if (!innBox || innBox.width < 8 || innBox.height < 8) throw new Error(`${name} missing inn token ${JSON.stringify(innBox)}`);
  if (await page.getByTestId("spatial-place-child-inn").count()) throw new Error(`${name} still renders frozen slot inn`);
  await page.screenshot({ path: resolve(out, `${name}-instances.png`), animations: "disabled" });
  interactions.push({ viewport: name, step: "identity", innBox, state: await readPlace(page) });
  if (!full) return;

  await page.getByTestId(`spatial-place-child-${innId}`).dispatchEvent("pointerdown");
  await page.getByTestId("spatial-places-board").press("ArrowRight");
  const nudged = await readPlace(page);
  if (!nudged.hasPreview) throw new Error(`${name} nudge did not issue preview`);
  const liveInn = fixtureDocument(compiled).occurrences[innId];
  if (!liveInn) throw new Error("missing fixture inn");
  const visibleInn = nudged.visibleChildren.find((child) => child.id === innId);
  if (!visibleInn || visibleInn.x !== liveInn.x + 1) {
    throw new Error(`${name} visible inn did not nudge ${JSON.stringify({ visibleInn, liveX: liveInn.x, preview: nudged.hasPreview })}`);
  }
  if (nudged.liveTitle !== compiled.meta.title) throw new Error(`${name} live adopted before apply`);
  await page.screenshot({ path: resolve(out, `${name}-nudge.png`), animations: "disabled" });
  await page.getByTestId("spatial-apply").click();
  const applied = await readPlace(page);
  interactions.push({ viewport: name, step: "nudge-apply", nudged, applied });
  await page.getByTestId("spatial-undo").click();
  const undone = await readPlace(page);
  await page.getByTestId("spatial-redo").click();
  const redone = await readPlace(page);
  interactions.push({ viewport: name, step: "undo-redo", undone, redone });

  await page.getByTestId(`spatial-place-pick-${innSource}`).click();
  const added = await readPlace(page);
  if (added.visibleChildIds.length < 3) throw new Error(`${name} picker did not add actual inn ${JSON.stringify(added.visibleChildIds)}`);
  const extra = added.visibleChildIds.find((id) => id !== innId && id !== added.liveChildIds[0]);
  const created = added.visibleChildIds.find((id) => !added.liveChildIds.includes(id));
  if (!created) throw new Error(`${name} no new actual child ${JSON.stringify(added)}`);
  await page.getByTestId(`spatial-place-child-${created}`).click({ force: true });
  await page.getByTestId("spatial-place-child-delete").click({ force: true });
  const deleted = await readPlace(page);
  if (deleted.visibleChildIds.includes(created)) throw new Error(`${name} delete left ${created}`);
  await page.screenshot({ path: resolve(out, `${name}-add.png`), animations: "disabled" });
  interactions.push({ viewport: name, step: "add-delete", added, deleted, extra });

  await page.evaluate(async (camera) => {
    const load = new Function("s", "return import(s)") as (s: string) => Promise<Record<string, unknown>>;
    const { patchSpatialSession } = await load("/src/editor/panels/spatialAuthoringSession.ts") as {
      patchSpatialSession: (patch: object) => void;
    };
    patchSpatialSession({ camera });
  }, { x: 12, y: 8, zoom: 2 });
  const innToken = page.getByTestId(`spatial-place-child-${innId}`);
  await innToken.waitFor({ state: "visible" });
  await innToken.dispatchEvent("pointerdown");
  await page.getByTestId("spatial-places-board").focus();
  await page.keyboard.press("Enter");
  const drilled = await readPlace(page);
  if (drilled.session.occurrenceId !== innId || drilled.session.mode !== "instances" || drilled.session.designId !== null) {
    throw new Error(`${name} drill did not select actual inn ${JSON.stringify(drilled.session)}`);
  }
  await page.getByTestId("spatial-place-floor-2").click({ force: true });
  await page.getByTestId(`spatial-place-child-${room2}`).waitFor({ state: "visible" });
  await page.getByTestId(`spatial-place-child-${room2}`).dispatchEvent("pointerdown");
  const inspectorToggle = page.getByTestId("spatial-inspector-toggle");
  if (await page.getByTestId("spatial-place-child-level").count() === 0) {
    await inspectorToggle.click({ force: true });
  }
  await page.getByTestId("spatial-place-child-level").waitFor({ state: "visible" });
  await page.getByTestId("spatial-place-child-level").fill("3");
  await page.getByTestId("spatial-place-child-level").dispatchEvent("change");
  const floored = await readPlace(page);
  await page.screenshot({ path: resolve(out, `${name}-floor.png`), animations: "disabled" });
  const lower = stairs[0];
  const upper = stairs[1];
  const other = stairs[2];
  if (!lower || !upper || !other) throw new Error("missing stairs");
  await page.getByTestId("spatial-place-connect-from").selectOption(lower.upId);
  await page.getByTestId("spatial-place-connect-from-port").selectOption("landing");
  await page.getByTestId("spatial-place-connect-to").selectOption(upper.stairId);
  await page.getByTestId("spatial-place-connect-to-port").selectOption("landing");
  await page.getByTestId("spatial-place-connect").click();
  const linked = await readPlace(page);
  await page.getByTestId("spatial-place-connect-to").selectOption(other.stairId);
  await page.getByTestId("spatial-place-connect").click();
  const retargeted = await readPlace(page);
  await page.getByTestId("spatial-place-disconnect").click();
  const unlinked = await readPlace(page);
  await page.screenshot({ path: resolve(out, `${name}-links.png`), animations: "disabled" });
  await page.getByTestId("spatial-back").click();
  const back = await readPlace(page);
  if (back.session.occurrenceId !== placeRoot || back.session.camera.zoom !== 2) {
    throw new Error(`${name} back lost camera/selection ${JSON.stringify(back.session)}`);
  }
  interactions.push({ viewport: name, step: "drill-floor-link", drilled, floored, linked, retargeted, unlinked, back });

  const token = page.getByTestId(`spatial-place-child-${innId}`);
  const box = await token.boundingBox();
  if (!box) throw new Error(`${name} inn token gone`);
  await page.mouse.move(box.x + 4, box.y + 4);
  await page.mouse.down();
  await page.mouse.move(box.x + 48, box.y + 4);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  const escaped = await readPlace(page);
  await page.screenshot({ path: resolve(out, `${name}-escape.png`), animations: "disabled" });
  interactions.push({ viewport: name, step: "escape", escaped });

  await page.getByTestId("spatial-places-board").focus();
  await page.keyboard.press("ArrowDown");
  await page.evaluate(async () => {
    const load = new Function("s", "return import(s)") as (s: string) => Promise<Record<string, unknown>>;
    const { store } = await load("/src/project/store.ts") as {
      store: { getCurrent: () => any; replace: (project: unknown) => void };
    };
    const current = store.getCurrent();
    store.replace({ ...current, meta: { ...current.meta, title: "foreign-live" } });
  });
  await page.getByTestId("spatial-apply").click();
  const stale = await readPlace(page);
  if (stale.liveTitle !== "foreign-live") throw new Error(`${name} stale apply mutated live ${stale.liveTitle}`);
  await page.screenshot({ path: resolve(out, `${name}-stale.png`), animations: "disabled" });
  interactions.push({ viewport: name, step: "stale", stale });
}

try {
  if (forbidden.has(port) || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`QA_PORT ${port} is forbidden or invalid`);
  }
  await mkdir(out, { recursive: true });
  const require = createRequire(import.meta.url);
  report.viteBin = resolve(dirname(require.resolve("vite/package.json")), "bin/vite.js");
  await mkdir(resolve(root, ".vite-cache"), { recursive: true });
  cacheDir = await mkdtemp(resolve(root, ".vite-cache/spatial-place-member-"));
  report.cleanup.cacheDir = cacheDir;
  probe = createServer();
  probe.once("error", (error) => {
    throw new Error(`Port ${port} collision refused: ${error.message}`);
  });
  const listening = once(probe, "listening");
  probe.listen(port, "127.0.0.1");
  await listening;
  const probeClosed = once(probe, "close");
  probe.close();
  await probeClosed;

  const ready = Promise.withResolvers<void>();
  server = spawn(process.execPath, [report.viteBin,
    "--configLoader", "runner", "--host", "127.0.0.1", "--port", String(port), "--strictPort",
  ], {
    cwd: root, detached: true,
    env: { ...process.env, DEV_SERVER_NO_TLS: "1", E2E_FREEZE_DEV_SERVER: "1",
      DEV_SERVER_PORT: String(port), VITE_CACHE_DIR: cacheDir, NO_COLOR: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  report.cleanup.serverStarted = server.pid !== undefined;
  report.cleanup.serverPid = server.pid ?? 0;
  serverClosed = new Promise((resolveClosed) => {
    server?.once("close", (code, signal) => {
      report.cleanup.serverClosed = true;
      serverLog += `${JSON.stringify({ event: "server-close", code, signal })}\n`;
      ready.reject(new Error(`Vite exited ${code}/${signal}`));
      resolveClosed();
    });
  });
  server.once("error", (error) => ready.reject(error));
  for (const stream of [server.stdout, server.stderr]) stream?.on("data", (chunk) => {
    serverLog += chunk.toString();
    if (serverLog.includes(base)) ready.resolve();
  });
  await bounded(ready.promise, 60000);
  const css = await fetch(`${base}/src/styles/index.css`, { signal: AbortSignal.timeout(120000) });
  if (css.status !== 200) throw new Error(`css ${css.status}`);
  await css.arrayBuffer();
  browser = await chromium.launch({ headless: true });
  report.cleanup.browserStarted = true;
  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport });
    page.on("console", (message) => report.console.push({ type: message.type(), text: message.text() }));
    page.on("pageerror", (error) => report.pageErrors.push(error.message));
    page.on("requestfailed", (request) => report.requestFailures.push({
      url: new URL(request.url()).pathname, error: request.failure()?.errorText,
    }));
    page.on("response", (response) => {
      if (response.status() >= 400) report.httpFailures.push({ url: new URL(response.url()).pathname, status: response.status() });
    });
    await runViewport(page, viewport, viewport.width === 1024);
    await page.close();
  }
} catch (error) {
  recordFailure(error);
} finally {
  try {
    if (probe?.listening) {
      const closed = once(probe, "close");
      probe.close();
      await closed;
    }
  } catch (error) { recordFailure(error); }
  try {
    if (browser) { await bounded(browser.close(), 30000); report.cleanup.browserClosed = true; }
  } catch (error) { recordFailure(error); }
  try {
    if (server?.pid && !report.cleanup.serverClosed) process.kill(-server.pid, "SIGTERM");
    if (serverClosed) await bounded(serverClosed, 30000);
  } catch (error) {
    recordFailure(error);
    try {
      if (server?.pid && !report.cleanup.serverClosed) {
        process.kill(-server.pid, "SIGKILL");
        if (serverClosed) await bounded(serverClosed, 30000);
      }
    } catch (shutdownError) { recordFailure(shutdownError); }
  }
  try {
    if (cacheDir) { await rm(cacheDir, { recursive: true }); report.cleanup.cacheRemoved = true; }
  } catch (error) { recordFailure(error); }
  report.outcome = errors.length === 0 ? "PASS" : "FAIL";
  try {
    await mkdir(out, { recursive: true });
    const sources = [
      "src/editor/panels/spatialPlaceCanvas.ts",
      "src/editor/panels/spatialPlaceControls.ts",
      "src/editor/panels/spatialPlaceCommands.ts",
      "src/editor/panels/spatialPlaceInspector.ts",
      "src/editor/panels/spatialPlacePlaced.ts",
      "src/editor/panels/spatialPlaceBoard.ts",
      "src/editor/panels/spatialPlaceLinks.ts",
      "src/editor/panels/spatialAuthoringSession.ts",
    ];
    const hashes: Record<string, string> = {};
    for (const file of sources) {
      hashes[file] = createHash("sha256").update(await readFile(resolve(root, file))).digest("hex");
    }
    const writes = await Promise.allSettled([
      writeFile(resolve(out, "server.log"), serverLog),
      writeFile(resolve(out, "qa.json"), JSON.stringify(report, null, 2)),
      writeFile(resolve(out, "source-hashes.json"), JSON.stringify(hashes, null, 2)),
      writeFile(resolve(out, "cleanup.md"), `# Owned resource cleanup\n\n${JSON.stringify(report.cleanup, null, 2)}\n`),
    ]);
    for (const result of writes) if (result.status === "rejected") recordFailure(result.reason);
  } catch (error) { recordFailure(error); }
}
