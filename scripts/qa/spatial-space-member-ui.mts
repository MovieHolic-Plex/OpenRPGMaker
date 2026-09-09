import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Browser, type Page } from "playwright";
import { SPACE_TILE_PX } from "../../src/editor/panels/spatialSpaceCanvas";
import { placedSpaceFixture, repeatedSlot } from "../../test/support/placedSpaceFixture";
import { spaceRoot } from "../../test/support/spatialSpaceCompilerFixture";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const port = Number(process.env.QA_PORT ?? 44193);
const base = `http://127.0.0.1:${port}`;
const out = resolve(root, process.env.EVIDENCE_DIR ?? "output/evidence/tile-to-world/space-member-ui");
const viewports = [
  { width: 1024, height: 768 },
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
] as const;

const errors: { readonly name: string; readonly message: string; readonly stack?: string }[] = [];
const interactions: Record<string, unknown>[] = [];
const report = {
  base, root, viewports, interactions, errors, outcome: "FAIL",
  cleanup: { serverStarted: false, browserStarted: false, browserClosed: false, serverClosed: false,
    cacheRemoved: false, cacheDir: "", serverPid: 0, port },
};
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
  process.exitCode = 1;
}

async function snapshot(page: Page) {
  return page.evaluate(async () => {
    const load = (path: string) => new Function("p", "return import(p)")(path) as Promise<Record<string, unknown>>;
    const { store } = await load("/src/project/store.ts") as { store: { getCurrent: () => { spatialAuthoring?: unknown } } };
    const access = await load("/src/editor/panels/spatialAuthoringAccess.ts") as {
      visibleAuthoringProject: () => { spatialAuthoring?: { occurrences?: Record<string, { id: string; x: number; y: number; parentId: string | null; parentSlot?: unknown }> } };
      hasAuthoringPreview: () => boolean;
    };
    const { spatialSession } = await load("/src/editor/panels/spatialAuthoringSession.ts") as { spatialSession: () => unknown };
    const visibleAuthoringProject = access.visibleAuthoringProject;
    const hasAuthoringPreview = access.hasAuthoringPreview;
    const live = store.getCurrent();
    const visible = visibleAuthoringProject();
    const members = Object.values(visible.spatialAuthoring?.occurrences ?? {})
      .filter((child) => child.parentId === "compiler-room")
      .map((child) => ({ id: child.id, x: child.x, y: child.y, slot: child.parentSlot }));
    const art = document.querySelector<HTMLElement>(".spatial-space-board-art");
    const token = document.querySelector<HTMLElement>("[data-testid='spatial-member-repeated-hearth-2']");
    return {
      session: spatialSession(),
      hasPreview: hasAuthoringPreview(),
      liveHash: JSON.stringify(live.spatialAuthoring),
      members,
      previewError: document.querySelector("[data-testid='spatial-preview-error']")?.textContent ?? "",
      artLeft: art?.style.left ?? "",
      artTop: art?.style.top ?? "",
      tokenLeft: token?.style.left ?? "",
      tokenTop: token?.style.top ?? "",
      applyDisabled: document.querySelector<HTMLButtonElement>("[data-testid='spatial-apply']")?.disabled ?? true,
    };
  });
}

async function openPlacedSpace(page: Page, project: unknown): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem("oprn:editor-welcome-dismissed", "1");
    localStorage.setItem("rpg-zzu:editor-ui-mode", "expert");
  });
  await page.goto(`${base}/?blankProject=1&aiBridge=0`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.getByTestId("toolbar-database").waitFor({ state: "visible", timeout: 120000 });
  await page.evaluate(async (fixture) => {
    const load = (path: string) => new Function("p", "return import(p)")(path) as Promise<{
      store: { isRemotePersistenceEnabled: () => boolean; replace: (project: unknown, options: { preserveEventDrafts: boolean }) => void };
    }>;
    const { store } = await load("/src/project/store.ts");
    if (store.isRemotePersistenceEnabled()) throw new Error("QA requires local persistence");
    store.replace(fixture, { preserveEventDrafts: false });
  }, project);
  await page.getByTestId("toolbar-database").click();
  await page.getByTestId("database-modal").waitFor({ state: "visible" });
  const world = page.getByTestId("db-tab-group-world");
  if (await world.getAttribute("aria-expanded") === "false") await world.click();
  await page.getByTestId("db-tab-spatial-spaces").click();
  await page.getByTestId("spatial-shell-spaces").waitFor({ state: "visible" });
  await page.getByTestId("spatial-mode-instances").click();
  await page.getByTestId(`spatial-card-${spaceRoot}`).waitFor({ state: "visible" });
  await page.getByTestId(`spatial-card-${spaceRoot}`).click();
  await page.getByTestId("spatial-space-board").waitFor({ state: "visible" });
  await page.getByTestId(`spatial-member-${repeatedSlot}-2`).waitFor({ state: "visible", timeout: 15000 });
}


async function dragMember(page: Page, testid: string, tileX: number, tileY: number, cancel: boolean): Promise<void> {
  await page.evaluate(({ testid, tileX, tileY, tilePx, cancel }) => {
    const token = document.querySelector<HTMLElement>(`[data-testid='${testid}']`);
    if (!token) throw new Error(`missing ${testid}`);
    token.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: 12, clientY: 12 }));
    const board = document.querySelector<HTMLElement>("[data-testid='spatial-space-board']");
    if (!board) throw new Error("missing live board");
    const box = board.getBoundingClientRect();
    const clientX = box.left + tileX * tilePx + 1;
    const clientY = box.top + tileY * tilePx + 1;
    board.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX, clientY }));
    if (cancel) board.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    else board.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, clientX, clientY }));
  }, { testid, tileX, tileY, tilePx: SPACE_TILE_PX, cancel });
}

async function runViewport(page: Page, viewport: { readonly width: number; readonly height: number }): Promise<void> {
  const name = `${viewport.width}x${viewport.height}`;
  page.setDefaultTimeout(30000);
  const fixture = placedSpaceFixture();
  const project = fixture.draft.project;
  await openPlacedSpace(page, project);
  const before = await snapshot(page);
  const selected = `[data-testid='spatial-member-${repeatedSlot}-2']`;
  const sibling = `[data-testid='spatial-member-${repeatedSlot}-0']`;
  if (!await page.locator(selected).count()) throw new Error(`${name} missing selected member token`);
  if (!await page.locator(sibling).count()) throw new Error(`${name} missing sibling member token`);
  await page.screenshot({ path: resolve(out, `${name}-members.png`), animations: "disabled" });

  await dragMember(page, `spatial-member-${repeatedSlot}-2`, 4, 5, true);
  const afterEscape = await snapshot(page);
  const escaped = afterEscape.members.find((member) => member.id === "opaque selected member");
  if (escaped && (escaped.x !== 8 || escaped.y !== 4) && afterEscape.hasPreview) {
    throw new Error(`${name} Escape did not cancel member move`);
  }
  await page.screenshot({ path: resolve(out, `${name}-escape.png`), animations: "disabled" });

  await dragMember(page, `spatial-member-${repeatedSlot}-2`, 4, 5, false);
  const afterMove = await snapshot(page);
  const moved = afterMove.members.find((member) => member.id === "opaque selected member");
  const frozen = afterMove.members.find((member) => member.id === "opaque first member");
  if (!moved || moved.x !== 4 || moved.y !== 5) throw new Error(`${name} selected member did not move ${JSON.stringify(moved)}`);
  if (!frozen || frozen.x !== 1 || frozen.y !== 4) throw new Error(`${name} sibling mutated ${JSON.stringify(frozen)}`);
  if (afterMove.liveHash !== before.liveHash) throw new Error(`${name} live store changed before apply`);
  await page.screenshot({ path: resolve(out, `${name}-moved.png`), animations: "disabled" });

  await page.getByTestId("spatial-space-board").focus();
  await page.keyboard.press("ArrowRight");
  const afterNudge = await snapshot(page);
  const nudged = afterNudge.members.find((member) => member.id === "opaque selected member");
  if (!nudged || nudged.x !== 5) throw new Error(`${name} keyboard nudge failed ${JSON.stringify(nudged)}`);

  await page.getByTestId("spatial-apply").click();
  const afterApply = await snapshot(page);
  if (afterApply.liveHash === before.liveHash) throw new Error(`${name} apply did not adopt`);
  await page.getByTestId("spatial-undo").click();
  const afterUndo = await snapshot(page);
  await page.getByTestId("spatial-redo").click();
  const afterRedo = await snapshot(page);
  interactions.push({ viewport: name, before, afterEscape, afterMove, afterNudge, afterApply, afterUndo, afterRedo });
}

try {
  await mkdir(out, { recursive: true });
  if (!Number.isInteger(port) || port === 9888) throw new Error("refusing shared 9888");
  const require = createRequire(import.meta.url);
  const viteBin = resolve(dirname(require.resolve("vite/package.json")), "bin/vite.js");
  cacheDir = await mkdtemp(resolve(root, ".vite-cache/space-member-ui-"));
  report.cleanup.cacheDir = cacheDir;
  const probe = createServer();
  const listening = once(probe, "listening");
  probe.listen(port, "127.0.0.1");
  await listening;
  const probeClosed = once(probe, "close");
  probe.close();
  await probeClosed;
  const ready = Promise.withResolvers<void>();
  server = spawn(process.execPath, [viteBin, "--configLoader", "runner", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
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
  for (const stream of [server.stdout, server.stderr]) stream?.on("data", (chunk) => {
    serverLog += chunk.toString();
    if (serverLog.includes(base)) ready.resolve();
  });
  await bounded(ready.promise, 60000);
  const index = await fetch(base, { signal: AbortSignal.timeout(30000) });
  if (index.status !== 200) throw new Error(`index ${index.status}`);
  await writeFile(resolve(out, "http-index.txt"), `HTTP ${index.status}\n${[...index.headers].map(([k, v]) => `${k}: ${v}`).join("\n")}\n`);
  browser = await chromium.launch({ headless: true });
  report.cleanup.browserStarted = true;
  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport });
    await bounded(runViewport(page, viewport), 180000);
    await page.close();
  }
} catch (error) {
  recordFailure(error);
} finally {
  try { if (browser) { await bounded(browser.close(), 30000); report.cleanup.browserClosed = true; } }
  catch (error) { recordFailure(error); }
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
  try { if (cacheDir) { await rm(cacheDir, { recursive: true }); report.cleanup.cacheRemoved = true; } }
  catch (error) { recordFailure(error); }
  report.outcome = errors.length === 0 ? "PASS" : "FAIL";
  const sources = [
    "src/editor/panels/spatialSpaceCanvas.ts",
    "src/editor/panels/spatialSpaceCommands.ts",
    "src/editor/panels/spatialSpaceInspector.ts",
    "src/editor/panels/spatialSpaceChrome.ts",
    "src/editor/panels/spatialSpaceDraft.ts",
    "src/editor/panels/spatialSpacePlacedActions.ts",
    "src/editor/panels/spatialSpaceMembers.ts",
    "src/editor/panels/spatialSpaceLayoutView.ts",
    "src/editor/panels/spatialSpaceChromeState.ts",
  ];
  const hashes: Record<string, string> = {};
  for (const file of sources) hashes[file] = createHash("sha256").update(await readFile(resolve(root, file))).digest("hex");
  await mkdir(out, { recursive: true });
  await writeFile(resolve(out, "server.log"), serverLog);
  await writeFile(resolve(out, "qa.json"), JSON.stringify(report, null, 2));
  await writeFile(resolve(out, "source-hashes.json"), JSON.stringify(hashes, null, 2));
  await writeFile(resolve(out, "cleanup.md"), `# Owned resource cleanup\n\n${JSON.stringify(report.cleanup, null, 2)}\n`);
}
