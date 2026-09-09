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
import { fixtureDocument, objectStampFixture } from "../../test/support/spatialSpaceCompilerFixture";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const port = Number(process.env.QA_PORT ?? 44207);
const base = `http://127.0.0.1:${port}`;
const out = resolve(root, "output/evidence/tile-to-world/source-build-ui/focus-fix");
const viewports = [
  { width: 1024, height: 768 },
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
] as const;

const errors: { readonly name: string; readonly message: string }[] = [];
const interactions: Record<string, unknown>[] = [];
const report = {
  base, port, viewports, interactions, errors, outcome: "FAIL",
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
  const entry = error instanceof Error ? { name: error.name, message: error.message } : { name: "UnknownError", message: String(error) };
  errors.push(entry);
  console.error(JSON.stringify({ event: "surface-failure", ...entry }));
  process.exitCode = 1;
}

async function typeField(page: Page, testid: string, text: string): Promise<string> {
  const locator = page.getByTestId(testid);
  await locator.waitFor({ state: "visible" });
  await locator.click();
  await page.keyboard.press("Control+A");
  await page.keyboard.press("Backspace");
  await page.keyboard.type(text);
  const value = await locator.inputValue();
  const focused = await locator.evaluate((node) => document.activeElement === node);
  if (value !== text) throw new Error(`${testid} typed ${JSON.stringify(value)} expected ${JSON.stringify(text)} focused=${focused}`);
  if (!focused) throw new Error(`${testid} lost focus after typing ${text}`);
  return value;
}

async function runViewport(page: Page, viewport: { readonly width: number; readonly height: number }): Promise<void> {
  const name = `${viewport.width}x${viewport.height}`;
  const stamp = objectStampFixture();
  const document = fixtureDocument(stamp.project);
  const merged = { ...stamp.project, spatialAuthoring: { ...document, occurrences: {}, rootOccurrenceIds: [], connections: [] } };
  page.setDefaultTimeout(30000);
  await page.addInitScript(() => {
    localStorage.setItem("oprn:editor-welcome-dismissed", "1");
    localStorage.setItem("rpg-zzu:editor-ui-mode", "expert");
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
  await page.getByTestId("toolbar-database").click();
  await page.getByTestId("database-modal").waitFor({ state: "visible" });
  const world = page.getByTestId("db-tab-group-world");
  if (await world.getAttribute("aria-expanded") === "false") await world.click();
  await page.getByTestId("db-tab-spatial-objects").click();
  await page.getByTestId(`spatial-card-${libraryObjectCardId("hearth-design")}`).click();
  const mapValue = await typeField(page, "spatial-build-map", stamp.target.mapId);
  await typeField(page, "spatial-build-rect-x", String(stamp.target.rect.x));
  await typeField(page, "spatial-build-rect-y", String(stamp.target.rect.y));
  await typeField(page, "spatial-build-rect-width", String(stamp.target.rect.width));
  await typeField(page, "spatial-build-rect-height", String(stamp.target.rect.height));
  await typeField(page, "spatial-build-entry-x", String(stamp.target.entry.x));
  await typeField(page, "spatial-build-entry-y", String(stamp.target.entry.y));
  const seedValue = await typeField(page, "spatial-build-seed", "19");
  await page.getByTestId("spatial-build-seed").press("Tab");
  await page.getByTestId("spatial-build").click();
  const proposalSeed = await page.getByTestId("spatial-build-input").getAttribute("data-seed");
  const proposalMap = await page.getByTestId("spatial-build-input").getAttribute("data-map-id");
  if (proposalSeed !== "19" || proposalMap !== stamp.target.mapId) {
    throw new Error(`${name} proposal not reached by keyboard seed=${proposalSeed} map=${proposalMap}`);
  }
  await page.screenshot({ path: resolve(out, `${name}-keyboard.png`), animations: "disabled" });
  interactions.push({ viewport, mapValue, seedValue, proposalSeed, proposalMap });
}

try {
  await mkdir(out, { recursive: true });
  if (port === 9888) throw new Error("refusing shared 9888");
  const require = createRequire(import.meta.url);
  const viteBin = resolve(dirname(require.resolve("vite/package.json")), "bin/vite.js");
  await mkdir(resolve(root, ".vite-cache"), { recursive: true });
  cacheDir = await mkdtemp(resolve(root, ".vite-cache/source-build-focus-"));
  report.cleanup.cacheDir = cacheDir;
  probe = createServer();
  const listening = once(probe, "listening");
  probe.listen(port, "127.0.0.1");
  await listening;
  const probeClosed = once(probe, "close");
  probe.close();
  await probeClosed;
  const ready = Promise.withResolvers<void>();
  server = spawn(process.execPath, [viteBin, "--configLoader", "runner", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
    cwd: root, detached: true,
    env: { ...process.env, DEV_SERVER_NO_TLS: "1", E2E_FREEZE_DEV_SERVER: "1", DEV_SERVER_PORT: String(port), VITE_CACHE_DIR: cacheDir, NO_COLOR: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  report.cleanup.serverStarted = server.pid !== undefined;
  report.cleanup.serverPid = server.pid ?? 0;
  serverClosed = new Promise((resolveClosed) => {
    server?.once("close", () => { report.cleanup.serverClosed = true; resolveClosed(); });
  });
  for (const stream of [server.stdout, server.stderr]) stream?.on("data", (chunk) => {
    serverLog += chunk.toString();
    if (serverLog.includes(base)) ready.resolve();
  });
  await bounded(ready.promise, 60000);
  browser = await chromium.launch({ headless: true });
  report.cleanup.browserStarted = true;
  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport });
    await runViewport(page, viewport);
    await page.close();
  }
} catch (error) {
  recordFailure(error);
} finally {
  try { if (browser) { await bounded(browser.close(), 30000); report.cleanup.browserClosed = true; } } catch (error) { recordFailure(error); }
  try {
    if (server?.pid && !report.cleanup.serverClosed) process.kill(-server.pid, "SIGTERM");
    if (serverClosed) await bounded(serverClosed, 30000);
  } catch (error) { recordFailure(error); }
  try { if (cacheDir) { await rm(cacheDir, { recursive: true }); report.cleanup.cacheRemoved = true; } } catch (error) { recordFailure(error); }
  report.outcome = errors.length === 0 ? "PASS" : "FAIL";
  const hashes: Record<string, string> = {};
  for (const file of ["src/editor/panels/spatialBuildChrome.ts", "src/editor/panels/spatialObjectCommands.ts", "test/spatialSourceBuildUiFocus.test.ts"]) {
    hashes[file] = createHash("sha256").update(await readFile(resolve(root, file))).digest("hex");
  }
  await writeFile(resolve(out, "keyboard-qa.json"), JSON.stringify(report, null, 2));
  await writeFile(resolve(out, "source-hashes.json"), JSON.stringify(hashes, null, 2));
  await writeFile(resolve(out, "cleanup.md"), `# cleanup\n\n${JSON.stringify(report.cleanup, null, 2)}\n`);
  await writeFile(resolve(out, "server.log"), serverLog);
}
