// @vitest-environment node
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium, type Browser, type Page } from "playwright";
import { createServer, type ViteDevServer } from "vite";
import { describe, expect, it } from "vitest";

const EVIDENCE = "output/evidence/tile-to-world/task-16";
const HARNESS = "/test/support/spatial-geography-raster.html";
const RASTER = "[data-testid='spatial-geography-raster']";

describe("spatial geography candidate raster", () => {
  it("paints lake-country through paintGeographyAtlas and shows typed mountain errors", async () => {
    let cacheDir: string | undefined;
    let server: ViteDevServer | undefined;
    let browser: Browser | undefined;
    let page: Page | undefined;
    try {
      // 매 실행 새 임시 cacheDir — 공유 경로를 썼더니 이전 실행이 남긴 dep 최적화 캐시가
      // 썩어 페이지가 ready 신호를 못 내는 일이 있었다(2026-09-13 실측: 캐시 삭제 후 통과).
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
      const origin = server.resolvedUrls?.local[0]?.replace(/\/$/, "");
      if (!origin) throw new Error("vite origin missing");
      // 브라우저가 붙기 전에 하네스가 import 하는 모듈 그래프를 미리 변환한다. 이 테스트는
      // 매번 임시 cacheDir 로 콜드 서버를 띄우므로, 앱 그래프 변환이 30초 셀렉터 마감을
      // 넘겨 게이트가 뒤집혔다(2026-09-13 실측: 단독 36.98s 통과 → 다음 실행 37.83s 실패).
      // 마감이 아니라 콜드 스타트를 고친다.
      await server.warmupRequest("/test/support/spatialGeographyRasterHarness.ts");
      browser = await chromium.launch({ headless: true });
      page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

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

      await page.goto(`${origin}${HARNESS}?fault=narrow-mountain`, { waitUntil: "domcontentloaded" });
      await page.waitForSelector("html[data-ready='1']");
      await page.waitForSelector(`${RASTER}[data-painted='error']`);
      const fault = page.locator(RASTER);
      expect(await fault.getAttribute("data-painted")).toBe("error");
      expect(await fault.getAttribute("data-error")).toMatch(/invalid-args/);
      await page.screenshot({ path: `${EVIDENCE}/narrow-mountain-error.png` });
    } finally {
      await page?.close();
      await browser?.close();
      await server?.close();
      if (cacheDir) await rm(cacheDir, { recursive: true, force: true });
    }
  }, 60_000);
});
