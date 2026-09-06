import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium, type Page } from "@playwright/test";
import { deserialize, serialize } from "@/project/io";
import { readStoredZipEntry, readStoredZipEntryNames } from "@/project/packageZip";
import { parseReleaseManifest, releaseManifestFromZip, verifyGameRelease } from "@/project/gameRelease";
import { readTrustedRuntime, RUNTIME_ARCHIVE_FOLDER } from "./lib/runtimeArchive";
import { exerciseExport, installExportObservations, rejectBadExport, requiredRuntimePngPattern, verifyEditorTestPlay } from "./lib/exportPlayability.mjs";

function arg(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`);
  return index < 0 ? fallback : process.argv[index + 1] ?? fallback;
}

const editorUrl = arg("editor-url", "http://127.0.0.1:9841");
const apiTransport = process.argv.includes("--api-transport");
const publicationMode = process.argv.includes("--publication");
const outDir = resolve(arg("out", "verify-shots/export-playability"));
const temp = await mkdtemp(join(tmpdir(), "oprn-export-qa-"));
await mkdir(outDir, { recursive: true });
const mime: Readonly<Record<string, string>> = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".wav": "audio/wav",
  ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".woff2": "font/woff2", ".webm": "video/webm",
};

async function serveZip(bytes: Uint8Array, prefix: string) {
  const entries = new Map(readStoredZipEntryNames(bytes).map((name) => [name, readStoredZipEntry(bytes, name)]));
  const server = createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
    const entry = pathname.startsWith(prefix) ? entries.get(pathname.slice(prefix.length)) : undefined;
    if (!entry) { response.writeHead(404); response.end("Not in exported game"); return; }
    response.writeHead(200, { "content-type": mime[extname(pathname)] ?? "application/octet-stream" });
    response.end(entry);
  });
  await new Promise<void>((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("Expected TCP listener");
  return {
    url: `http://127.0.0.1:${address.port}${prefix}player.html`,
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>((done, reject) => server.close((error) => error ? reject(error) : done()));
    },
  };
}

async function menu(page: Page, id: string): Promise<void> {
  await page.getByTestId("menu-project").click();
  await page.getByTestId(id).click();
}

async function download(page: Page, id: string, name: string): Promise<string> {
  if (await page.getByTestId("toast").count()) {
    await page.getByTestId("toast").evaluate((node) => node.setAttribute("data-qa-previous-toast", "true"));
  }
  // Cold production builds plus serial media packaging can exceed three minutes
  // on a shared verification host. This is a deadline, never a success-by-delay.
  const pending = page.waitForEvent("download", { timeout: 360000 });
  const error = page.locator('[data-testid="toast"].error:not([data-qa-previous-toast])');
  const rejected = error.waitFor({ state: "visible", timeout: 360000 }).then(async () => {
    throw new Error(await error.textContent() ?? "Export failed");
  });
  console.log(`QA download ${name}: requested`);
  await menu(page, id);
  const result = await Promise.race([pending, rejected]);
  const target = join(temp, name);
  await result.saveAs(target);
  assert.equal(await result.failure(), null);
  console.log(`QA download ${name}: saved`);
  return target;
}

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const editorContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const results: Array<Record<string, unknown>> = [];
const cleanup: string[] = [];
const transportErrors: Array<{ path: string; error: string }> = [];
let activeRequests = 0;
const requestSlots: Array<() => void> = [];
try {
  // Only a fresh QA profile is used. Refuse every remote write, even if a future import regresses.
  await editorContext.route("**/*", async (route) => {
    if (!["GET", "HEAD"].includes(route.request().method())) return route.abort("blockedbyclient");
    // Optional transport isolation for hosts whose network-change notifications abort
    // Chromium's large dev-module graph. Forward real server responses, never mock them.
    if (apiTransport && route.request().url().startsWith(`${editorUrl}/`)) {
      if (activeRequests >= 8) await new Promise<void>((resolveSlot) => requestSlots.push(resolveSlot));
      activeRequests += 1;
      try {
        await route.fulfill({ response: await route.fetch({ timeout: 180000 }) });
      } catch (error) {
        transportErrors.push({
          path: new URL(route.request().url()).pathname,
          error: (error instanceof Error ? error.message : String(error)).replace(/\n[\s\S]*/, ""),
        });
        await route.abort("failed");
      } finally {
        activeRequests -= 1;
        requestSlots.shift()?.();
      }
      return;
    }
    return route.continue();
  });
  const page = await editorContext.newPage();
  page.setDefaultTimeout(30000);
  console.log("QA editor: open isolated local project");
  await page.goto(`${editorUrl}/?blankProject=1`, { waitUntil: "domcontentloaded" });
  await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 120000 });
  const remoteEnabled = await page.evaluate(() => {
    return Function("return window.__oprnEditorStore.isRemotePersistenceEnabled()")();
  });
  assert.equal(remoteEnabled, false, "QA must never use a remote project");

  const project = deserialize(await readFile("test/fixtures/projects/editor-authored-demo-v3.json", "utf8"));
  // A deterministic test-only copy; no fixture file or remote project is edited.
  for (const map of Object.values(project.maps)) {
    for (const event of map.events) {
      for (const page of event.pages ?? []) page.movement = { type: "fixed", speed: 2, frequency: 3 };
    }
  }
  const fixturePath = join(temp, "gameplay-fixture.json");
  await writeFile(fixturePath, serialize(project));
  const chooser = page.waitForEvent("filechooser");
  await menu(page, "menu-project-import");
  await (await chooser).setFiles(fixturePath);
  await page.getByTestId("menu-project").filter({ hasText: project.meta.title }).waitFor({ state: "visible" });
  console.log("QA editor: fixture imported, download web ZIP and HTML");
  if (publicationMode) {
    await menu(page, "menu-project-publication");
    await page.getByTestId("publication-prepare").click({ timeout: 360000 });
    await page.getByTestId("publication-version").fill("qa-release-A");
    await page.getByTestId("publication-apply").click();
  }
  const zipPath = await download(page, "menu-project-export-web", "game.zip");
  const htmlPath = await download(page, "menu-project-export-standalone", "game.html");
  await page.screenshot({ path: join(outDir, "editor-downloads.png") });
  results.push({ kind: "editor-downloads", pass: true });

  const zip = new Uint8Array(await readFile(zipPath));
  let missingImagePattern: string;
  if (publicationMode) {
    const manifest = await parseReleaseManifest(releaseManifestFromZip(zip));
    const trusted = await readTrustedRuntime(resolve(RUNTIME_ARCHIVE_FOLDER), manifest.publication.runtimeTarget);
    await verifyGameRelease(zip, trusted);
    missingImagePattern = requiredRuntimePngPattern(trusted);
    await writeFile(join(outDir, "release.json"), JSON.stringify(manifest, null, 2));
    await writeFile(join(outDir, "game.zip"), zip);
    await writeFile(join(outDir, "game.html"), await readFile(htmlPath));
    results.push({ kind: "release-integrity", releaseId: manifest.releaseId, runtimeTarget: trusted.runtimeTarget, pass: true });
  } else {
    const png = readStoredZipEntryNames(zip).find((name) => name.endsWith(".png"));
    assert.ok(png, "The exported project must include a PNG for export rejection QA");
    missingImagePattern = `**/${png}`;
  }
  for (const [kind, prefix] of [["root", "/"], ["nested", "/games/demo/"], ["html", null]] as const) {
    console.log(`QA ${kind}: actual gameplay and save/load`);
    const server = prefix === null ? null : await serveZip(zip, prefix);
    const url = server?.url ?? pathToFileURL(htmlPath).href;
    const origin = server ? new URL(url).origin : null;
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    try {
      await installExportObservations(context);
      await context.route("**/*", (route) => {
        const requested = route.request().url();
        if (/^https?:/.test(requested) && new URL(requested).origin !== origin) return route.abort("blockedbyclient");
        return route.continue();
      });
      results.push(await exerciseExport(await context.newPage(), { url, kind, outDir }));
    } finally {
      await context.close();
      await server?.close();
      cleanup.push(`${kind}: context and static server closed`);
    }
  }

  results.push(await rejectBadExport(page, publicationMode ? "**/runtime-archive/*/standalone/standalone.js" : "**/standalone-player/standalone.js", "<!doctype html><html>Wrong bundle</html>", 200));
  results.push(await rejectBadExport(page, missingImagePattern, "Missing required image", 404));
  await page.screenshot({ path: join(outDir, "rejected-export.png") });

  await page.getByTestId("mode-play").click();
  await page.getByTestId("test-play-window").waitFor({ state: "visible", timeout: 60000 });
  await page.locator('[data-testid="test-play-window"] canvas').waitFor({ state: "visible", timeout: 60000 });
  const editorMovement = await verifyEditorTestPlay(page);
  await page.screenshot({ path: join(outDir, "editor-test-play.png") });
  await page.getByTestId("test-play-window-close").click();
  results.push({ kind: "editor-test-play", pass: true, movement: editorMovement });
} catch (error) {
  results.push({ kind: "harness", pass: false, error: String(error) });
  const page = editorContext.pages()[0];
  if (page && !page.isClosed()) {
    await page.screenshot({ path: join(outDir, "editor-failure.png") });
    await writeFile(join(outDir, "editor-failure.txt"), await page.locator("body").innerText());
  }
} finally {
  await editorContext.unrouteAll({ behavior: "wait" });
  await editorContext.close();
  await browser.close();
  await rm(temp, { recursive: true, force: true });
  cleanup.push("editor context, browser, and temporary downloads removed");
  if (transportErrors.length) results.push({ kind: "editor-transport", pass: false, errors: transportErrors });
  await writeFile(join(outDir, "results.json"), JSON.stringify({ results, cleanup, editorTransport: apiTransport ? "api-forward" : "browser" }, null, 2));
}
for (const result of results) console.log(`${result.pass ? "PASS" : "FAIL"} ${result.kind ?? result.pattern}: ${result.error ?? ""}`);
console.log(`Evidence: ${outDir}/results.json`);
process.exitCode = results.every((result) => result.pass === true) ? 0 : 1;
