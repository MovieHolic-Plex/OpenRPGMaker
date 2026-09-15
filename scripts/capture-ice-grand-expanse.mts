import { createHash } from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import net, { type Server } from "node:net";
import path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";

import { chromium, type Page } from "@playwright/test";

import { hashIceGrandExpanseMap } from "../src/project/defaults/iceGrandExpanse.ts";
import { ICE_GRAND_EXPANSE_MAP_ID } from "../src/project/defaults/iceGrandExpansePlan.ts";
import type { GameMap } from "../src/project/types.ts";
import {
  createLocalIceGrandExpanseProject,
  ICE_EXPANSE_RUN_ID,
  ICE_EXPANSE_SOURCE_MANIFEST_SHA256,
} from "./verify-ice-grand-expanse.mts";

const HOST = "127.0.0.1";
const BRIDGE_URL = "http://127.0.0.1:17831/v1/browser/hello";
const FULL_SIZE = { width: 2_048, height: 2_048 } as const;
const CROP_SIZE = { width: 956, height: 782 } as const;
const CROPS = [
  { slug: "entry", x: 64, y: 117 },
  { slug: "ridge-junction", x: 64, y: 84 },
  { slug: "narrow-pass", x: 40, y: 38 },
  { slug: "mirror-lake-seals", x: 64, y: 60 },
  { slug: "checkpoint-shortcut", x: 68, y: 32 },
  { slug: "boss-approach", x: 64, y: 19 },
] as const;

type ImageAudit = { readonly distinctSampledRgb: number; readonly height: number; readonly variance: number; readonly width: number };
type BrowserFailure = { readonly errorText: string; readonly method: string; readonly url: string };
type CaptureBinding = { readonly currentMapId: string; readonly derivedMapSha256: string };

class IceExpanseCaptureError extends Error {
  readonly name = "IceExpanseCaptureError";
  constructor(readonly code: string, message: string) { super(message); }
}

const runRoot = path.resolve("output", "evidence", "ice-grand-expanse", ICE_EXPANSE_RUN_ID);
const sourceManifestPath = path.join(runRoot, "source-manifest.json");
const finalDir = path.join(runRoot, "task-7", "browser");
const tempDir = path.join(runRoot, "task-7", `.browser-${process.pid}-${Date.now()}`);
if (fs.existsSync(finalDir)) throw new IceExpanseCaptureError("OUTPUT_EXISTS", finalDir);
const sourceManifest = parseRecord(fs.readFileSync(sourceManifestPath, "utf8"));
if (sourceManifest.runId !== ICE_EXPANSE_RUN_ID || sourceManifest.sourceManifestSha256 !== ICE_EXPANSE_SOURCE_MANIFEST_SHA256) {
  throw new IceExpanseCaptureError("SOURCE_MANIFEST_MISMATCH", sourceManifestPath);
}

const buildStartedAt = new Date().toISOString();
await runBuild();
const buildFinishedAt = new Date().toISOString();
const local = await createLocalIceGrandExpanseProject();
fs.mkdirSync(tempDir, { recursive: true });

const reservation = await reservePort();
const port = reservation.port;
const previewArgv = [
  path.resolve("node_modules", "vite", "bin", "vite.js"), "preview", "--host", HOST,
  "--port", String(port), "--strictPort",
] as const;
await closeServer(reservation.server);
const preview = spawn(process.execPath, previewArgv, { cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"] });
if (preview.pid === undefined) throw new IceExpanseCaptureError("PREVIEW_START_FAILED", "preview PID unavailable");
const previewPid = preview.pid;
const previewLog: string[] = [];
preview.stdout?.on("data", (chunk: Buffer) => previewLog.push(chunk.toString("utf8")));
preview.stderr?.on("data", (chunk: Buffer) => previewLog.push(chunk.toString("utf8")));

let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
let captureSucceeded = false;
try {
  await waitForServer(port, preview);
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ acceptDownloads: true, deviceScaleFactor: 1, viewport: { width: 1_440, height: 1_000 } });
  await context.addInitScript(({ project }) => {
    window.__OPRN_E2E_PROJECT__ = project;
    localStorage.clear();
    localStorage.setItem("oprn:editor-ui-mode", "expert");
  }, { project: local.project });
  const page = await context.newPage();
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const requestFailures: BrowserFailure[] = [];
  const httpErrors: { readonly status: number; readonly url: string }[] = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("requestfailed", (request) => requestFailures.push({
    errorText: request.failure()?.errorText ?? "unknown", method: request.method(), url: request.url(),
  }));
  page.on("response", (response) => { if (response.status() >= 400) httpErrors.push({ status: response.status(), url: response.url() }); });

  await openMap(page, port);
  const artifacts: Record<string, unknown>[] = [];
  const fullBinding = await assertBoundMap(page, local.derivedMapSha256);
  const downloadPromise = page.waitForEvent("download", { timeout: 30_000 });
  await page.getByTestId("editor-map-screenshot-button").dispatchEvent("click");
  const fullPath = path.join(tempDir, "01-expanse-full-2048x2048.png");
  await (await downloadPromise).saveAs(fullPath);
  await page.waitForFunction((mapId) => {
    const raw = document.querySelector('[data-testid="editor-map-screenshot-result"]')?.textContent;
    if (!raw) return false;
    try { const value = JSON.parse(raw); return value.state === "done" && value.mapId === mapId; } catch { return false; }
  }, ICE_GRAND_EXPANSE_MAP_ID, { timeout: 30_000 });
  artifacts.push(await writeSidecar(page, fullPath, fullBinding, "full", FULL_SIZE));

  for (const crop of CROPS) {
    await openMap(page, port, crop);
    const binding = await assertBoundMap(page, local.derivedMapSha256);
    const filePath = path.join(tempDir, `${String(artifacts.length + 1).padStart(2, "0")}-${crop.slug}.png`);
    await page.getByTestId("edit-canvas").locator("canvas").first().screenshot({ path: filePath });
    artifacts.push(await writeSidecar(page, filePath, binding, crop.slug, CROP_SIZE, crop));
  }

  const bridgeFailures = requestFailures.filter(({ url }) => url === BRIDGE_URL);
  const actionableConsole = consoleErrors.filter((message) => !(message === "Failed to load resource: net::ERR_CONNECTION_REFUSED" && bridgeFailures.length > 0));
  const unexpectedRequests = requestFailures.filter(({ url }) => url !== BRIDGE_URL);
  if (actionableConsole.length + pageErrors.length + unexpectedRequests.length + httpErrors.length > 0) {
    throw new IceExpanseCaptureError("BROWSER_DIAGNOSTIC", JSON.stringify({ actionableConsole, httpErrors, pageErrors, unexpectedRequests }));
  }
  await context.close();
  await browser.close();
  browser = undefined;
  await stopOwnedPreview(preview, previewPid);
  await waitForPortClosed(port);
  const receipt = {
    status: "INTERIM_LOCAL_NOT_SUPABASE_SAVED", runId: ICE_EXPANSE_RUN_ID,
    sourceManifestSha256: ICE_EXPANSE_SOURCE_MANIFEST_SHA256, derivedMapSha256: local.derivedMapSha256,
    mapId: ICE_GRAND_EXPANSE_MAP_ID, targetUrl: `http://${HOST}:${port}/`, viewport: { width: 1_440, height: 1_000, deviceScaleFactor: 1 },
    build: { command: "npm run build", startedAt: buildStartedAt, finishedAt: buildFinishedAt },
    preview: { argv: [process.execPath, ...previewArgv], pid: previewPid, port, closedBeforeReceipt: true, logSha256: sha256(previewLog.join("")) },
    diagnostics: { allowedBridgeRefusals: bridgeFailures.length, consoleErrors: actionableConsole, httpErrors, pageErrors, requestFailures: unexpectedRequests },
    artifacts, playSurfaces: [], playSurfaceClaim: "not captured by this terrain milestone script",
  } as const;
  fs.writeFileSync(path.join(tempDir, "capture-receipt.json"), `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  fs.renameSync(tempDir, finalDir);
  captureSucceeded = true;
  process.stdout.write(`${JSON.stringify(receipt)}\n`);
} finally {
  if (browser !== undefined) await browser.close();
  await stopOwnedPreview(preview, previewPid);
  await waitForPortClosed(port);
  if (!captureSucceeded) fs.rmSync(tempDir, { force: true, recursive: true });
}

async function openMap(page: Page, port: number, focus?: { readonly x: number; readonly y: number }): Promise<void> {
  const query = new URLSearchParams({ devProject: "1", rm2k3Shell: "1" });
  if (focus !== undefined) { query.set("focusX", String(focus.x)); query.set("focusY", String(focus.y)); }
  await page.goto(`http://${HOST}:${port}/?${query}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 20_000 });
  const node = page.getByTestId(`map-tree-node-${ICE_GRAND_EXPANSE_MAP_ID}`);
  await node.scrollIntoViewIfNeeded();
  await node.click();
  await page.waitForTimeout(2 * 16);
}

async function assertBoundMap(page: Page, expectedHash: string): Promise<CaptureBinding> {
  const raw = await page.getByTestId("project-export-json").textContent();
  const exported = parseRecord(raw ?? ""); const editor = recordChild(exported, "editor"); const project = recordChild(exported, "project");
  const maps = recordChild(project, "maps"); const map = maps[ICE_GRAND_EXPANSE_MAP_ID];
  if (editor.currentMapId !== ICE_GRAND_EXPANSE_MAP_ID || !isGameMap(map)) throw new IceExpanseCaptureError("MAP_BINDING_MISMATCH", "derived map is not selected/exported");
  const derivedMapSha256 = await hashIceGrandExpanseMap(map);
  if (derivedMapSha256 !== expectedHash) throw new IceExpanseCaptureError("MAP_HASH_MISMATCH", derivedMapSha256);
  return { currentMapId: ICE_GRAND_EXPANSE_MAP_ID, derivedMapSha256 };
}

async function writeSidecar(
  page: Page,
  filePath: string,
  binding: CaptureBinding,
  slug: string,
  expected: { readonly height: number; readonly width: number },
  focus?: { readonly x: number; readonly y: number },
): Promise<Record<string, unknown>> {
  const bytes = fs.readFileSync(filePath); const image = await auditPng(page, bytes);
  if (image.width !== expected.width || image.height !== expected.height || image.distinctSampledRgb < 16 || image.variance <= 1) {
    throw new IceExpanseCaptureError("PNG_INVALID", `${slug}: ${JSON.stringify(image)}`);
  }
  const sidecar = {
    runId: ICE_EXPANSE_RUN_ID, sourceManifestSha256: ICE_EXPANSE_SOURCE_MANIFEST_SHA256,
    derivedMapSha256: binding.derivedMapSha256, currentMapId: binding.currentMapId, slug,
    ...(focus === undefined ? {} : { focus }), fileName: path.basename(filePath), byteLength: bytes.length, pngSha256: sha256(bytes), image,
  };
  fs.writeFileSync(`${filePath}.json`, `${JSON.stringify(sidecar, null, 2)}\n`, "utf8");
  return sidecar;
}

async function auditPng(page: Page, bytes: Buffer): Promise<ImageAudit> {
  return page.evaluate(async (dataUrl) => {
    const bitmap = await createImageBitmap(await (await fetch(dataUrl)).blob());
    const canvas = document.createElement("canvas"); canvas.width = bitmap.width; canvas.height = bitmap.height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (context === null) throw new TypeError("2d canvas unavailable");
    context.drawImage(bitmap, 0, 0); const pixels = context.getImageData(0, 0, bitmap.width, bitmap.height).data;
    const colors = new Set<string>(); let sum = 0; let squared = 0; let count = 0;
    const step = Math.max(1, Math.floor(Math.sqrt((bitmap.width * bitmap.height) / 16_384)));
    for (let y = 0; y < bitmap.height; y += step) for (let x = 0; x < bitmap.width; x += step) {
      const index = (y * bitmap.width + x) * 4; const r = pixels[index] ?? 0; const g = pixels[index + 1] ?? 0; const b = pixels[index + 2] ?? 0;
      colors.add(`${r},${g},${b}`); const luminance = (r + g + b) / 3; sum += luminance; squared += luminance * luminance; count += 1;
    }
    bitmap.close(); const mean = sum / count;
    return { distinctSampledRgb: colors.size, height: canvas.height, variance: squared / count - mean * mean, width: canvas.width };
  }, `data:image/png;base64,${bytes.toString("base64")}`);
}

async function runBuild(): Promise<void> {
  const command = process.platform === "win32" ? (process.env.ComSpec ?? "cmd.exe") : "npm";
  const args = process.platform === "win32" ? ["/d", "/s", "/c", "npm run build"] : ["run", "build"];
  const child = spawn(command, args, { cwd: process.cwd(), stdio: "inherit" });
  const exitCode = await new Promise<number | null>((resolve, reject) => { child.once("error", reject); child.once("exit", resolve); });
  if (exitCode !== 0) throw new IceExpanseCaptureError("BUILD_FAILED", String(exitCode));
}

async function reservePort(): Promise<{ readonly port: number; readonly server: Server }> {
  const server = net.createServer();
  await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(0, HOST, resolve); });
  const address = server.address();
  if (address === null || typeof address === "string") throw new IceExpanseCaptureError("PORT_RESERVATION_FAILED", "TCP address unavailable");
  return { port: address.port, server };
}

async function closeServer(server: Server): Promise<void> { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }

async function waitForServer(port: number, child: ChildProcess): Promise<void> {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new IceExpanseCaptureError("PREVIEW_EXITED", String(child.exitCode));
    const ready = await new Promise<boolean>((resolve) => {
      const request = http.get({ host: HOST, path: "/", port, timeout: 500 }, (response) => { response.resume(); resolve(true); });
      request.once("error", () => resolve(false)); request.once("timeout", () => { request.destroy(); resolve(false); });
    });
    if (ready) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new IceExpanseCaptureError("PREVIEW_TIMEOUT", String(port));
}

async function stopOwnedPreview(child: ChildProcess, pid: number): Promise<void> {
  if (child.exitCode !== null) return;
  const command = process.platform === "win32" ? "taskkill" : "kill";
  const args = process.platform === "win32" ? ["/PID", String(pid), "/T", "/F"] : ["-TERM", `-${pid}`];
  const killer = spawn(command, args, { stdio: "ignore" });
  await new Promise<void>((resolve) => { killer.once("error", resolve); killer.once("exit", () => resolve()); });
  await new Promise<void>((resolve) => { if (child.exitCode !== null) resolve(); else child.once("exit", () => resolve()); });
}

async function waitForPortClosed(port: number): Promise<void> {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const open = await new Promise<boolean>((resolve) => { const socket = net.connect(port, HOST); socket.once("connect", () => { socket.destroy(); resolve(true); }); socket.once("error", () => resolve(false)); });
    if (!open) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new IceExpanseCaptureError("PORT_STILL_OPEN", String(port));
}

function parseRecord(raw: string): Record<string, unknown> { const value: unknown = JSON.parse(raw); if (!isRecord(value)) throw new IceExpanseCaptureError("JSON_INVALID", "expected record"); return value; }
function recordChild(parent: Record<string, unknown>, key: string): Record<string, unknown> { const value = parent[key]; if (!isRecord(value)) throw new IceExpanseCaptureError("JSON_INVALID", key); return value; }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function isGameMap(value: unknown): value is GameMap { return isRecord(value) && typeof value.id === "string" && typeof value.width === "number" && typeof value.height === "number" && typeof value.tilesetId === "string" && Array.isArray(value.lowerTiles) && Array.isArray(value.upperTiles) && Array.isArray(value.events); }
function sha256(value: Uint8Array | string): string { return createHash("sha256").update(value).digest("hex"); }
