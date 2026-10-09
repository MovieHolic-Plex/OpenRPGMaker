// @vitest-environment node
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium, type Browser } from "playwright";
import { createServer, type ViteDevServer } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const EVIDENCE = "output/evidence/tile-to-world/task-16";
const HARNESS = "/test/support/spatial-geography-raster.html";
const RASTER = "[data-testid='spatial-geography-raster']";

describe("spatial geography candidate raster", () => {
  let cacheDir: string | undefined;
  let server: ViteDevServer | undefined;
  let browser: Browser | undefined;
  let origin = "";

  // 서버·브라우저는 한 번만 띄운다. 아래 두 테스트가 각자 60초 예산을 갖는다 — 예전엔 페이지를
  // **두 번** 띄우는 작업이 하나의 60초 안에 들어가야 해서, 실행 시간이 40~60초 사이를 오가며
  // 전체 게이트에서 간헐적으로 `Test timed out in 60000ms` 로 죽었다(2026-09-13 실측).
  // 마감을 늘리지 않고 **작업 단위를 나눴다**.
  beforeAll(async () => {
    // 매 실행 새 임시 cacheDir — 공유 경로를 썼더니 이전 실행이 남긴 dep 최적화 캐시가
    // 썩어 페이지가 ready 신호를 못 내는 일이 있었다(실측: 캐시 삭제 후 통과).
    // 이 테스트의 결정성은 **경합 제거**(verify-gates 의 browser 스테이지, maxWorkers=2)가 맡는다.
    cacheDir = await mkdtemp(join(tmpdir(), "spatial-geography-raster-"));
    server = await createServer({
      configFile: false,
      root: resolve("."),
      publicDir: "public",
      cacheDir,
      resolve: { alias: { "@": resolve("src") } },
      server: { port: 0, host: "127.0.0.1", strictPort: false, fs: { allow: [resolve(".")] } },
      appType: "mpa",
    });
    await server.listen();
    origin = server.resolvedUrls?.local[0]?.replace(/\/$/, "") ?? "";
    if (!origin) throw new Error("vite origin missing");
    await server.warmupRequest("/test/support/spatialGeographyRasterHarness.ts");
    browser = await chromium.launch({ headless: true });
  }, 120_000);

  afterAll(async () => {
    await browser?.close();
    await server?.close();
    if (cacheDir) await rm(cacheDir, { recursive: true, force: true });
  });

  it("paints lake-country through paintGeographyAtlas", async () => {
    const page = await browser!.newPage({ viewport: { width: 1280, height: 800 } });
    try {
      await page.goto(`${origin}${HARNESS}`, { waitUntil: "domcontentloaded" });
      await page.waitForSelector("html[data-ready='1']");
      await page.waitForSelector(`${RASTER}[data-painted='atlas']`);
      const canvas = page.locator(RASTER);
      expect(await canvas.getAttribute("data-painted")).toBe("atlas");
      await mkdir(EVIDENCE, { recursive: true });
      await canvas.screenshot({ path: `${EVIDENCE}/lake-country-candidate.png` });
      const samples = await canvas.evaluate((node) => {
        if (!(node instanceof HTMLCanvasElement)) throw new Error("expected canvas");
        const ctx = node.getContext("2d");
        if (!ctx) throw new Error("missing context");
        const tile = Number(node.dataset.tile ?? 16);
        const at = (x: number, y: number): number[] => [...ctx.getImageData(x * tile + 8, y * tile + 8, 1, 1).data];
        return { ground: at(0, 0), water: at(55, 0), road: at(50, 40), painted: node.dataset.painted };
      });
      expect(samples.painted).toBe("atlas");
      expect(samples.water).not.toEqual(samples.ground);
      expect(samples.road).not.toEqual(samples.water);
    } finally {
      await page.close();
    }
  }, 60_000);

  it("shows a typed error for a narrow mountain range", async () => {
    const page = await browser!.newPage({ viewport: { width: 1280, height: 800 } });
    try {
      await page.goto(`${origin}${HARNESS}?fault=narrow-mountain`, { waitUntil: "domcontentloaded" });
      await page.waitForSelector("html[data-ready='1']");
      await page.waitForSelector(`${RASTER}[data-painted='error']`);
      const fault = page.locator(RASTER);
      expect(await fault.getAttribute("data-painted")).toBe("error");
      expect(await fault.getAttribute("data-error")).toMatch(/invalid-args/);
      await page.screenshot({ path: `${EVIDENCE}/narrow-mountain-error.png` });
    } finally {
      await page.close();
    }
  }, 60_000);
});
