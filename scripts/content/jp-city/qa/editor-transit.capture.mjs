// 편집기 「맵 속성 → 탈것(차·버스·전차)」 칸 화면 증거 — 小学校 맵을 편집기 store 에 넣고 창을 연다.
//
//   unshare -rn sh -c 'ip link set lo up; node scripts/content/jp-city/qa/editor-transit.capture.mjs'
//
// 1) 조수 도구로 깐 노선(픽스처) 목록이 보이는가  2) 「모두 지우기」 → 「차 흐름 자동으로 깔기」 가 같은 노선을 다시 만드는가.
// 증거: verify-shots/jp-city/transit-editor/*.png + result.json. 픽스처는 scripts/qa/runtime/transit-fixture.mts.
import { chromium } from "@playwright/test";
import { spawn, spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../../../../", import.meta.url));
const OUT = join(ROOT, "verify-shots/jp-city/transit-editor");
const FIXTURE = "/tmp/oprn-transit-editor-fixture.json";
const PORT = 5791;
const MAP_ID = "jp-city-school";

await mkdir(OUT, { recursive: true });
const built = spawnSync("npx", ["--no-install", "tsx", "--import", "./tiledata/jp-city/refs/css-stub.mjs", "scripts/qa/runtime/transit-fixture.mts", "--out", FIXTURE], { cwd: ROOT, encoding: "utf8" });
if (built.status !== 0) { console.error(built.stdout, built.stderr); process.exit(2); }
const fx = JSON.parse(await readFile(FIXTURE, "utf8"));

const server = spawn("npm", ["run", "dev", "--", "--port", String(PORT), "--strictPort"], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"], detached: true });
let base = null;
const ready = new Promise((resolve) => {
  const onData = (d) => { const m = String(d).match(/Local:\s+(https?):\/\/([^:/\s]+):(\d+)/); if (m && !base) { base = `${m[1]}://${m[2]}:${m[3]}`; resolve(); } };
  server.stdout.on("data", onData); server.stderr.on("data", onData);
});
await Promise.race([ready, new Promise((_, rej) => setTimeout(() => rej(new Error("dev 서버가 90초 안에 뜨지 않았다")), 90_000))]);

const result = {};
let browser;
let page;
try {
  browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, ignoreHTTPSErrors: true });
  await context.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem("oprn:editor-ui-mode", "expert");
  });
  page = await context.newPage();
  await page.goto(`${base}/?freshProject=1`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.waitForFunction(() => !!window.__oprnEditorStore, undefined, { timeout: 120_000 });
  // 새 프로젝트 불러오기가 늦게 끝나 넣은 맵을 덮는 일이 있다 — 맵 목록이 3초 동안 그대로일 때까지 기다린다.
  await page.waitForFunction(() => window.__oprnEditorStore.isLoaded() && Object.keys(window.__oprnEditorStore.getCurrent().maps).length > 3, undefined, { timeout: 180_000, polling: 250 });
  await page.waitForFunction(() => {
    const ids = Object.keys(window.__oprnEditorStore.getCurrent().maps).join(",");
    const w = window; const now = performance.now();
    if (w.__qaIds !== ids) { w.__qaIds = ids; w.__qaSince = now; return false; }
    return now - w.__qaSince > 3000;
  }, undefined, { timeout: 120_000, polling: 250 });
  await page.evaluate((project) => { window.__oprnEditorStore.replaceProject(project); }, fx);
  await page.waitForTimeout(1500);
  result.injected = await page.evaluate((id) => !!window.__oprnEditorStore.getCurrent().maps[id], MAP_ID);
  await page.evaluate(async (mapId) => {
    const m = await import("/src/editor/panels/mapPropertiesDialog.ts");
    m.openMapPropertiesDialog(mapId, "小学校");
  }, MAP_ID);
  await page.locator("[data-testid='map-props-tab-transit']").click();
  const section = page.locator("[data-testid='map-transit-section']");
  await section.waitFor({ state: "visible", timeout: 30_000 });
  await section.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await page.locator(`[data-testid='map-properties-modal-${MAP_ID}']`).screenshot({ path: join(OUT, "1-routes.png") });
  result.before = await page.evaluate((id) => window.__oprnEditorStore.getCurrent().maps[id].transit?.routes.map((r) => r.id), MAP_ID);

  await page.locator("[data-testid='map-transit-clear']").click();
  await page.waitForTimeout(300);
  result.cleared = await page.evaluate((id) => window.__oprnEditorStore.getCurrent().maps[id].transit?.routes?.length ?? 0, MAP_ID);
  if (!(await page.locator("[data-testid='map-transit-auto']").isVisible())) await page.locator("[data-testid='map-props-tab-transit']").click();
  await page.locator("[data-testid='map-transit-auto']").click();
  await page.waitForTimeout(500);
  await page.locator("[data-testid='map-transit-section']").scrollIntoViewIfNeeded();
  await page.locator(`[data-testid='map-properties-modal-${MAP_ID}']`).screenshot({ path: join(OUT, "2-auto.png") });
  result.after = await page.evaluate((id) => window.__oprnEditorStore.getCurrent().maps[id].transit?.routes.map((r) => `${r.id}:${r.headwaySec}`), MAP_ID);
  result.ok = result.cleared === 0 && result.after?.length === 2;
} catch (error) {
  result.error = String(error?.stack ?? error).split("\n").slice(0, 4).join(" | ");
  await page?.screenshot({ path: join(OUT, "fail.png") }).catch(() => {});
  result.maps = await page?.evaluate(() => Object.keys(window.__oprnEditorStore.getCurrent().maps)).catch(() => null);
  result.ok = false;
} finally {
  await browser?.close();
  try { process.kill(-server.pid, "SIGTERM"); } catch { /* 이미 끝남 */ }
}
await writeFile(join(OUT, "result.json"), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);
