import fs from "node:fs";
import path from "node:path";
import { chromium, type Page } from "playwright";
import { REFERENCE_PROJECT_ID, STAGE_MAP_IDS } from "./natural-village/blueprint.ts";

class NaturalVillageCaptureError extends Error {
  constructor(readonly code: "editor-load" | "capture-timeout" | "capture-mismatch" | "invalid-png" | "network-failure", message: string) {
    super(message);
    this.name = "NaturalVillageCaptureError";
  }
}

const baseUrl = process.env.RPG_ZZU_URL ?? "http://127.0.0.1:9999";
const captureIteration = process.env.CAPTURE_ITERATION ?? "iteration-02";
const outputDir = path.resolve("output", "evidence", "natural-village", "reference", captureIteration);
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
  // 밀도(예전 전문가 모드)는 탑바 토글이 아니라 저장 키로 지정한다 — 앞면 컨트롤이
  // 작업 프리셋으로 바뀌었고 밀도는 패널 메뉴 안으로 들어갔다.
  await page.addInitScript(() => window.localStorage.setItem("oprn:editor-ui-mode", "expert"));
  await page.goto(`${baseUrl}/?project=${encodeURIComponent(REFERENCE_PROJECT_ID)}`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  const finalNode = page.locator(`[data-testid="map-tree-node-${STAGE_MAP_IDS[4]}"]`);
  await finalNode.waitFor({ state: "attached", timeout: 30_000 });
  const skipCoach = page.getByRole("button", { name: "건너뛰기" });
  if (await skipCoach.isVisible().catch(() => false)) await skipCoach.click();
  await page.locator('[data-testid="editor-map-screenshot-button"]').waitFor({ state: "attached", timeout: 15_000 });

  const captures: Record<string, unknown>[] = [];
  for (let index = 0; index < STAGE_MAP_IDS.length; index += 1) {
    const mapId = STAGE_MAP_IDS[index];
    if (!mapId) continue;
    await page.locator(`[data-testid="map-tree-node-${mapId}"]`).click();
    const expand = page.locator('[data-testid="editor-canvas-toolbar-expand"]');
    if (await expand.getAttribute("aria-expanded") === "false") await expand.click();
    const downloadPromise = page.waitForEvent("download", { timeout: 30_000 });
    await page.locator('[data-testid="editor-map-screenshot-button"]').click();
    const download = await downloadPromise;
    const fileName = `${String(index + 1).padStart(2, "0")}-${mapId}.png`;
    const filePath = path.join(outputDir, fileName);
    await download.saveAs(filePath);
    const result = await waitForCaptureResult(page, mapId);
    const png = pngDimensions(filePath);
    if (result.pixelSize && isRecord(result.pixelSize)) {
      if (result.pixelSize.width !== png.width || result.pixelSize.height !== png.height) {
        throw new NaturalVillageCaptureError("capture-mismatch", `${mapId}: PNG 크기가 결과 메타와 다릅니다.`);
      }
    }
    captures.push({ mapId, fileName, byteLength: fs.statSync(filePath).size, pixelSize: png });
    console.log(JSON.stringify(captures[captures.length - 1]));
  }
  const network = classifyRequestFailures(requestFailures);
  if (network.unexpected.length > 0) {
    throw new NaturalVillageCaptureError("network-failure", JSON.stringify(network.unexpected));
  }
  const actionableConsoleErrors = consoleErrors.filter((message) => (
    !(network.optionalDevBridge.length > 0 && message.includes("ERR_CONNECTION_REFUSED"))
  ));
  fs.writeFileSync(
    path.join(outputDir, "capture-evidence.json"),
    JSON.stringify({ projectId: REFERENCE_PROJECT_ID, mapOnly: true, captures, consoleErrors: actionableConsoleErrors, network }, null, 2),
    "utf8",
  );
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
    const parsed = parseRecord(raw);
    if (parsed?.state === "done" && parsed.mapId === mapId) return parsed;
    await page.waitForTimeout(100);
  }
  throw new NaturalVillageCaptureError("capture-timeout", `${mapId}: 맵 PNG 완료 신호를 받지 못했습니다.`);
}

function parseRecord(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pngDimensions(filePath: string): { readonly width: number; readonly height: number } {
  const bytes = fs.readFileSync(filePath);
  if (bytes.length < 24 || bytes.toString("ascii", 1, 4) !== "PNG") {
    throw new NaturalVillageCaptureError("invalid-png", `${filePath}: PNG 헤더가 없습니다.`);
  }
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}
