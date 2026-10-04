// 높이 지형 편집기 화면 증거 — relief 픽스처(scripts/qa/runtime/relief-fixture.mts)를 메모리로 넣고 맵만 찍는다.
// 저작 콘텐츠를 저장하지 않는다(시각 확인 전용).
//   node scripts/qa/relief-editor-capture.mjs .omo/runtime-qa/relief.json verify-shots/relief-runtime/editor.png
import { readFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { createServer } from "vite";

const root = fileURLToPath(new URL("../../", import.meta.url));
const [fixture = ".omo/runtime-qa/relief.json", out = "verify-shots/relief-runtime/editor.png"] = process.argv.slice(2);
const project = JSON.parse(readFileSync(join(root, fixture), "utf8"));
const map = project.maps[project.startMapId];
mkdirSync(dirname(join(root, out)), { recursive: true });

process.env.DEV_SERVER_NO_TLS = "1";
const server = await createServer({
  configFile: join(root, "vite.config.ts"),
  configLoader: "runner",
  cacheDir: join(root, ".vite-cache/relief-editor"),
  server: { port: 0, host: "127.0.0.1", hmr: false, watch: { ignored: ["**/*"] } },
});
await server.listen();
const address = server.httpServer.address();
const origin = `http://127.0.0.1:${address.port}`;
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 1100 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript((seed) => {
    window.__OPRN_E2E_PROJECT__ = seed;
    window.localStorage.clear();
    window.localStorage.setItem("oprn:editor-ui-mode", "expert");
    window.localStorage.setItem("oprn:ai-panel-collapsed", "1");
    for (const key of ["oprn:editor-welcome-dismissed", "oprn:standard-welcome-seen", "oprn:coachmarks-basic-v1"]) window.localStorage.setItem(key, "1");
  }, project);
  await page.goto(`${origin}/?map=${project.startMapId}&mapOnlyCapture=1`, { waitUntil: "domcontentloaded", timeout: 180_000 });
  await page.getByTestId("edit-canvas").waitFor({ timeout: 180_000 });
  await page.waitForFunction(() => typeof window.__oprnEditWorldToClient === "function", null, { timeout: 60_000 });
  // 텍스처가 다 올라오고 절벽 띠가 그려질 때까지: 두 프레임 연속 같은 캔버스면 정착.
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.waitForLoadState("networkidle", { timeout: 60_000 });
  const clip = await page.evaluate(({ width, height }) => {
    const a = window.__oprnEditWorldToClient(0, -6 * 16), b = window.__oprnEditWorldToClient(width * 16, height * 16);
    return { x: Math.max(0, a.x), y: Math.max(0, a.y), width: b.x - Math.max(0, a.x), height: b.y - Math.max(0, a.y) };
  }, { width: map.width, height: map.height });
  await page.screenshot({ path: join(root, out), clip: clip.width > 0 && clip.height > 0 ? clip : undefined });
  console.log(JSON.stringify({ out, clip, errors }));
  if (errors.length) process.exitCode = 1;
} finally {
  await browser.close();
  await server.close();
}
