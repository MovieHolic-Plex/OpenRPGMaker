import fs from "node:fs";
import path from "node:path";
import { chromium, type Page } from "playwright";

class HarnessCaptureError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "HarnessCaptureError";
  }
}

const persistencePath = path.resolve("output", "evidence", "natural-village", "harness-supabase.json");
const persistence = JSON.parse(fs.readFileSync(persistencePath, "utf8")) as { projectId: string; mapId: string };
const baseUrl = process.env.RPG_ZZU_URL ?? "http://127.0.0.1:9999";
const outputDir = path.resolve("output", "evidence", "natural-village", "harness");
fs.mkdirSync(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true });
const consoleErrors: string[] = [];
const requestFailures: { readonly url: string; readonly method: string; readonly errorText: string }[] = [];
page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
page.on("requestfailed", (request) => {
  requestFailures.push({
    url: evidenceRequestUrl(request.url()),
    method: request.method(),
    errorText: request.failure()?.errorText ?? "unknown",
  });
});

try {
  await page.goto(`${baseUrl}/?project=${encodeURIComponent(persistence.projectId)}`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  const mapNode = page.locator(`[data-testid="map-tree-node-${persistence.mapId}"]`);
  await mapNode.waitFor({ state: "attached", timeout: 30_000 });
  const skipCoach = page.getByRole("button", { name: "건너뛰기" });
  if (await skipCoach.isVisible().catch(() => false)) await skipCoach.click();
  await page.locator('[data-testid="editor-ui-mode-expert"]').click();
  await mapNode.click();
  const expand = page.locator('[data-testid="editor-canvas-toolbar-expand"]');
  if (await expand.getAttribute("aria-expanded") === "false") await expand.click();
  const screenshotButton = page.locator('[data-testid="editor-map-screenshot-button"]');
  await screenshotButton.waitFor({ state: "attached", timeout: 15_000 });
  const downloadPromise = page.waitForEvent("download", { timeout: 30_000 });
  await screenshotButton.click();
  const download = await downloadPromise;
  const fileName = `01-${persistence.mapId}.png`;
  const filePath = path.join(outputDir, fileName);
  await download.saveAs(filePath);
  const result = await waitForCaptureResult(page, persistence.mapId);
  const pixelSize = pngDimensions(filePath);
  if (isRecord(result.pixelSize) && (result.pixelSize.width !== pixelSize.width || result.pixelSize.height !== pixelSize.height)) {
    throw new HarnessCaptureError("capture-mismatch", "PNG 크기가 에디터 완료 메타와 다릅니다.");
  }
  const network = classifyRequestFailures(requestFailures);
  if (network.unexpected.length > 0) {
    throw new HarnessCaptureError("network-failure", JSON.stringify(network.unexpected));
  }
  const actionableConsoleErrors = consoleErrors.filter((message) => (
    !(network.optionalDevBridge.length > 0 && message.includes("ERR_CONNECTION_REFUSED"))
  ));
  const evidence = {
    projectId: persistence.projectId,
    mapId: persistence.mapId,
    mapOnly: true,
    fileName,
    byteLength: fs.statSync(filePath).size,
    pixelSize,
    consoleErrors: actionableConsoleErrors,
    network,
  };
  fs.writeFileSync(path.join(outputDir, "capture-evidence.json"), JSON.stringify(evidence, null, 2), "utf8");
  console.log(JSON.stringify(evidence));
} finally {
  await browser.close();
}

function classifyRequestFailures(failures: readonly { readonly url: string; readonly method: string; readonly errorText: string }[]) {
  const optionalDevBridge = failures.filter((failure) => failure.url.includes("127.0.0.1:17831/v1/browser/hello"));
  const abortedNavigationRequests = failures.filter((failure) => failure.errorText === "net::ERR_ABORTED");
  const unexpected = failures.filter((failure) => !optionalDevBridge.includes(failure) && !abortedNavigationRequests.includes(failure));
  return { optionalDevBridge, abortedNavigationRequests, unexpected };
}

function evidenceRequestUrl(raw: string): string {
  const url = new URL(raw);
  return `${url.origin}${url.pathname}`;
}

async function waitForCaptureResult(page: Page, mapId: string): Promise<Record<string, unknown>> {
  const resultNode = page.locator('[data-testid="editor-map-screenshot-result"]');
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const raw = await resultNode.textContent().catch(() => null);
    if (raw) {
      try {
        const parsed: unknown = JSON.parse(raw);
        if (isRecord(parsed) && parsed.state === "done" && parsed.mapId === mapId) return parsed;
      } catch {
        // The result node can be empty while the browser is encoding the PNG.
      }
    }
    await page.waitForTimeout(100);
  }
  throw new HarnessCaptureError("capture-timeout", `${mapId}: 맵 PNG 완료 신호를 받지 못했습니다.`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pngDimensions(filePath: string): { readonly width: number; readonly height: number } {
  const bytes = fs.readFileSync(filePath);
  if (bytes.length < 24 || bytes.toString("ascii", 1, 4) !== "PNG") {
    throw new HarnessCaptureError("invalid-png", `${filePath}: PNG 헤더가 없습니다.`);
  }
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}
