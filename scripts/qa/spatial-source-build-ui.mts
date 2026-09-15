import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { createServer, type Server } from "node:net";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Browser, type Page } from "playwright";
import { libraryObjectCardId } from "../../src/editor/panels/spatialObjectDraft";
import { librarySpaceCardId } from "../../src/editor/panels/spatialSpaceDraft";
import { fixtureDocument, objectStampFixture, spaceDesign } from "../../test/support/spatialSpaceCompilerFixture";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const port = Number(process.env.QA_PORT ?? 44191);
const base = `http://127.0.0.1:${port}`;
const out = resolve(root, process.env.EVIDENCE_DIR ?? "output/evidence/tile-to-world/source-build-ui");
const viewports = [
  { width: 1024, height: 768 },
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
] as const;

const consoleMessages: { readonly type: string; readonly text: string }[] = [];
const pageErrors: string[] = [];
const requestFailures: { readonly url: string; readonly error: string | undefined }[] = [];
const httpFailures: { readonly url: string; readonly status: number }[] = [];
const errors: { readonly name: string; readonly message: string; readonly stack?: string }[] = [];
const interactions: Record<string, unknown>[] = [];
const report = {
  base, root, viewports, interactions, errors, outcome: "FAIL", viteBin: "",
  console: consoleMessages, pageErrors, requestFailures, httpFailures,
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

async function readBuild(page: Page) {
  return page.evaluate(async () => {
    const { store }: typeof import("../../src/project/store") = await import("/src/" + "project/store.ts");
    const { spatialSession }: typeof import("../../src/editor/panels/spatialAuthoringSession") =
      await import("/src/" + "editor/panels/spatialAuthoringSession.ts");
    const { visibleAuthoringProject, hasAuthoringPreview }: typeof import("../../src/editor/panels/spatialAuthoringAccess") =
      await import("/src/" + "editor/panels/spatialAuthoringAccess.ts");
    const { spatialBuildProposal }: typeof import("../../src/editor/panels/spatialBuildActions") =
      await import("/src/" + "editor/panels/spatialBuildActions.ts");
    const live = store.getCurrent();
    const visible = visibleAuthoringProject();
    return {
      session: spatialSession(),
      hasPreview: hasAuthoringPreview(),
      proposal: spatialBuildProposal(),
      liveOccurrenceCount: Object.keys(live.spatialAuthoring?.occurrences ?? {}).length,
      visibleOccurrenceCount: Object.keys(visible.spatialAuthoring?.occurrences ?? {}).length,
      liveMapCount: Object.keys(live.maps).length,
      visibleMapCount: Object.keys(visible.maps).length,
      paletteStamp: (await import("/src/" + "editor/editorState.ts")).editorState.get().activePaletteStamp,
      buildDisabled: document.querySelector<HTMLButtonElement>("[data-testid='spatial-build']")?.disabled ?? true,
      applyDisabled: document.querySelector<HTMLButtonElement>("[data-testid='spatial-apply']")?.disabled ?? true,
      previewDisabled: document.querySelector<HTMLButtonElement>("[data-testid='spatial-preview']")?.disabled ?? true,
      seed: document.querySelector<HTMLInputElement>("[data-testid='spatial-build-seed']")?.value ?? null,
      inputText: document.querySelector("[data-testid='spatial-build-input']")?.textContent ?? "",
      previewError: document.querySelector("[data-testid='spatial-preview-error']")?.textContent ?? "",
    };
  });
}

async function openDatabase(page: Page): Promise<void> {
  await page.getByTestId("toolbar-database").waitFor({ state: "visible", timeout: 120000 });
  await page.getByTestId("toolbar-database").click();
  await page.getByTestId("database-modal").waitFor({ state: "visible" });
  const world = page.getByTestId("db-tab-group-world");
  if (await world.getAttribute("aria-expanded") === "false") await world.click();
}

async function runViewport(page: Page, viewport: { readonly width: number; readonly height: number }): Promise<void> {
  const name = `${viewport.width}x${viewport.height}`;
  const stamp = objectStampFixture();
  const document = fixtureDocument(stamp.project);
  const merged = { ...stamp.project, spatialAuthoring: { ...document, occurrences: {}, rootOccurrenceIds: [], connections: [] } };
  page.setDefaultTimeout(30000);
  await page.addInitScript(() => {
    localStorage.setItem("oprn:editor-welcome-dismissed", "1");
    localStorage.setItem("oprn:editor-ui-mode", "expert");
  });
  await page.goto(`${base}/?blankProject=1&aiBridge=0`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.getByTestId("toolbar-database").waitFor({ state: "visible", timeout: 120000 });
  await page.evaluate(async (fixture) => {
    const { store }: typeof import("../../src/project/store") = await import("/src/" + "project/store.ts");
    const { editorState }: typeof import("../../src/editor/editorState") = await import("/src/" + "editor/editorState.ts");
    if (store.isRemotePersistenceEnabled()) throw new Error("QA requires local persistence");
    store.replace(fixture, { preserveEventDrafts: false });
    editorState.set({ currentMapId: fixture.startMapId, selection: null, activePaletteStamp: null });
  }, merged);
  await openDatabase(page);

  await page.getByTestId("db-tab-spatial-objects").click();
  await page.getByTestId("spatial-shell-objects").waitFor({ state: "visible" });
  await page.getByTestId(`spatial-card-${libraryObjectCardId("hearth-design")}`).click();
  await page.getByTestId("spatial-build").waitFor({ state: "visible" });
  await page.getByTestId("spatial-build-map").waitFor({ state: "visible" });
  const objectGeometry = {
    build: boxOf(await page.getByTestId("spatial-build").boundingBox()),
    seed: boxOf(await page.getByTestId("spatial-build-seed").boundingBox()),
    apply: boxOf(await page.getByTestId("spatial-apply").boundingBox()),
    preview: boxOf(await page.getByTestId("spatial-preview").boundingBox()),
    canvas: boxOf(await page.getByTestId("spatial-canvas").boundingBox()),
    map: boxOf(await page.getByTestId("spatial-build-map").boundingBox()),
  };
  if (!objectGeometry.canvas || objectGeometry.canvas.height < 120) {
    throw new Error(`${name} objects canvas collapsed ${JSON.stringify(objectGeometry.canvas)}`);
  }
  if (!objectGeometry.map || objectGeometry.map.y + objectGeometry.map.height > viewport.height + 1) {
    throw new Error(`${name} object target map offscreen ${JSON.stringify(objectGeometry.map)}`);
  }
  if (objectGeometry.build && objectGeometry.build.height > 48) {
    throw new Error(`${name} Build button stretched ${objectGeometry.build.height}`);
  }
  await page.screenshot({ path: resolve(out, `${name}-objects.png`), animations: "disabled" });

  const fillVisible = async (testid: string, value: string) => {
    const locator = page.getByTestId(testid);
    await locator.waitFor({ state: "visible" });
    await locator.fill(value);
    await locator.dispatchEvent("change");
  };
  await fillVisible("spatial-build-seed", "19");
  await fillVisible("spatial-build-map", stamp.target.mapId);
  await fillVisible("spatial-build-rect-x", String(stamp.target.rect.x));
  await fillVisible("spatial-build-rect-y", String(stamp.target.rect.y));
  await fillVisible("spatial-build-rect-width", String(stamp.target.rect.width));
  await fillVisible("spatial-build-rect-height", String(stamp.target.rect.height));
  await fillVisible("spatial-build-entry-x", String(stamp.target.entry.x));
  await fillVisible("spatial-build-entry-y", String(stamp.target.entry.y));
  const beforeBuild = await readBuild(page);
  if (beforeBuild.buildDisabled) throw new Error(`${name} object Build stayed disabled after explicit target ${JSON.stringify(beforeBuild)}`);
  await page.getByTestId("spatial-build").click();
  const afterBuild = await readBuild(page);
  if (afterBuild.liveOccurrenceCount !== beforeBuild.liveOccurrenceCount) {
    throw new Error(`${name} Build mutated live occurrences`);
  }
  if (!afterBuild.proposal || afterBuild.proposal.input.seed !== 19) {
    throw new Error(`${name} Build did not freeze seed 19 ${JSON.stringify(afterBuild)}`);
  }
  if (afterBuild.applyDisabled) throw new Error(`${name} Apply stayed disabled after Build ${JSON.stringify(afterBuild)}`);
  const builtButton = boxOf(await page.getByTestId("spatial-build").boundingBox());
  if (builtButton && builtButton.height > 48) throw new Error(`${name} Build stretched after disclosure ${builtButton.height}`);
  await page.screenshot({ path: resolve(out, `${name}-objects-built.png`), animations: "disabled" });
  await page.getByTestId("spatial-apply").click();
  const afterApply = await readBuild(page);
  if (afterApply.liveOccurrenceCount !== afterBuild.visibleOccurrenceCount) {
    throw new Error(`${name} Apply did not adopt the issued occurrence`);
  }
  if (afterApply.session.mode !== "instances" || afterApply.session.occurrenceId !== afterBuild.proposal?.input.rootId) {
    throw new Error(`${name} Apply did not select the built occurrence`);
  }
  await page.screenshot({ path: resolve(out, `${name}-objects-applied.png`), animations: "disabled" });

  await page.getByTestId("db-tab-spatial-spaces").click();
  await page.getByTestId("spatial-shell-spaces").waitFor({ state: "visible" });
  await page.getByTestId(`spatial-card-${librarySpaceCardId(spaceDesign)}`).click();
  await page.getByTestId("spatial-build").waitFor({ state: "visible" });
  const spaceGeometry = {
    build: boxOf(await page.getByTestId("spatial-build").boundingBox()),
    seed: boxOf(await page.getByTestId("spatial-build-seed").boundingBox()),
    canvas: boxOf(await page.getByTestId("spatial-canvas").boundingBox()),
  };
  await page.screenshot({ path: resolve(out, `${name}-spaces.png`), animations: "disabled" });

  await page.getByTestId("db-tab-spatial-places").click();
  await page.getByTestId("spatial-shell-places").waitFor({ state: "visible" });
  await page.getByTestId("spatial-build").waitFor({ state: "visible" });
  const placeGeometry = {
    build: boxOf(await page.getByTestId("spatial-build").boundingBox()),
    seed: boxOf(await page.getByTestId("spatial-build-seed").boundingBox()),
    canvas: boxOf(await page.getByTestId("spatial-canvas").boundingBox()),
  };
  await page.screenshot({ path: resolve(out, `${name}-places.png`), animations: "disabled" });

  for (const [label, geometry] of Object.entries({ object: objectGeometry, space: spaceGeometry, place: placeGeometry })) {
    const build = geometry.build;
    if (!build || build.width < 8 || build.height < 8) throw new Error(`${name} ${label} Build control missing box`);
    if (build.x < 0 || build.y < 0 || build.x + build.width > viewport.width + 1 || build.y + build.height > viewport.height + 1) {
      throw new Error(`${name} ${label} Build clipped`);
    }
  }
  interactions.push({
    viewport, afterBuild, afterApply, objectGeometry, spaceGeometry, placeGeometry,
    rootId: afterBuild.proposal?.input.rootId, seed: afterBuild.proposal?.input.seed,
  });
}

try {
  await mkdir(out, { recursive: true });
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("QA_PORT must be a TCP port");
  if (port === 9888) throw new Error("refusing shared 9888");
  const require = createRequire(import.meta.url);
  report.viteBin = resolve(dirname(require.resolve("vite/package.json")), "bin/vite.js");
  await mkdir(resolve(root, ".vite-cache"), { recursive: true });
  cacheDir = await mkdtemp(resolve(root, ".vite-cache/source-build-ui-"));
  report.cleanup.cacheDir = cacheDir;
  probe = createServer();
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
  serverClosed = new Promise(resolveClosed => {
    server?.once("close", (code, signal) => {
      report.cleanup.serverClosed = true;
      serverLog += `${JSON.stringify({ event: "server-close", code, signal })}\n`;
      ready.reject(new Error(`Vite exited ${code}/${signal}`));
      resolveClosed();
    });
  });
  server.once("error", error => ready.reject(error));
  for (const stream of [server.stdout, server.stderr]) stream?.on("data", chunk => {
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
    page.on("console", message => report.console.push({ type: message.type(), text: message.text() }));
    page.on("pageerror", error => report.pageErrors.push(error.message));
    page.on("requestfailed", request => report.requestFailures.push({
      url: new URL(request.url()).pathname, error: request.failure()?.errorText,
    }));
    page.on("response", response => {
      if (response.status() >= 400) report.httpFailures.push({ url: new URL(response.url()).pathname, status: response.status() });
    });
    await runViewport(page, viewport);
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
      "src/editor/panels/spatialBuildChrome.ts",
      "src/editor/panels/spatialStage.ts",
      "src/editor/panels/spatialObjectCommands.ts",
      "src/editor/panels/spatialSpaceCommands.ts",
      "src/editor/panels/spatialPlaceCommands.ts",
      "src/editor/panels/spatialObjectInspector.ts",
      "src/editor/panels/spatialTilesTab.ts",
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
