// 「jp_city 칸 번호 복구」를 실제 편집기(패키지 빌드 + 프로젝트 호스트, 정본 SQLite)에서 눌러 본다.
//   npm run build:packaged && npm run build:electron   (한 번)
//   unshare -rn sh -c 'ip link set lo up; node scripts/content/jp-city/qa/pin-repair-editor.capture.mjs <프로젝트 폴더> <출력 폴더> <맵id>=<판id> …'
// 맵마다: 맵 목록 우클릭 → 「jp_city 칸 번호 복구」 → 창 캡처 → 판 고르기 → 적용 → 편집기 캔버스 캡처.
// 끝나면 저장을 기다리고 새로고침해 다시 연 편집기에서 맵마다 다시 캡처한다(정본 저장 → 재로드).
import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const [projectDir, OUT, ...picks] = process.argv.slice(2);
await mkdir(OUT, { recursive: true });
const ROOT = resolve(import.meta.dirname, "..", "..", "..", "..");
const PORT = 9871;
const server = spawn(process.execPath, [join(ROOT, "scripts/oprn-serve.mjs"), "--project-dir", projectDir, "--port", String(PORT)], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
const url = await new Promise((ok, fail) => {
  const timer = setTimeout(() => fail(new Error("호스트가 뜨지 않았다")), 120_000);
  const onData = (chunk) => { const m = String(chunk).match(/(http:\/\/\S+)/u); if (m) { clearTimeout(timer); ok(m[1]); } };
  server.stdout.on("data", onData);
  server.stderr.on("data", (c) => process.stderr.write(c));
});
const result = { url, steps: [] };
let browser;
let page;
const shot = async (page, name) => { await page.screenshot({ path: join(OUT, `${name}.png`) }); result.steps.push(name); };
const openMapPane = async (page) => {
  await page.waitForSelector("[data-testid='sidebar-maps']", { timeout: 180_000 });
  if (!(await page.locator("[data-testid='map-tree-list']").isVisible())) await page.click("[data-testid='sidebar-maps']");
  await page.waitForSelector("[data-testid='map-tree-list']", { timeout: 60_000 });
  await page.waitForTimeout(2000);
};
const openMap = async (page, mapId) => {
  await page.click(`[data-testid="map-tree-node-${mapId}"]`);
  await page.waitForTimeout(1500);
};
try {
  browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
  page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  page.on("pageerror", (e) => result.steps.push(`pageerror: ${String(e).slice(0, 200)}`));
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await openMapPane(page);
  for (const pick of picks) {
    const [mapId, eraId] = pick.split("=");
    await openMap(page, mapId);
    await shot(page, `${mapId}-1-before`);
    await page.click(`[data-testid="map-tree-node-${mapId}"]`, { button: "right" });
    await page.click(`[data-testid="map-menu-jp-pin-repair-${mapId}"]`);
    await page.waitForSelector("[data-testid='jp-pin-repair-grid'] canvas", { timeout: 60_000 });
    await page.waitForTimeout(500);
    await page.locator("[data-testid='jp-pin-repair-modal'] .app-modal-card").screenshot({ path: join(OUT, `${mapId}-2-dialog.png`) });
    await page.click(`[data-testid="jp-pin-repair-choice-${eraId}"]`);
    await page.click("[data-testid='jp-pin-repair-apply']");
    await page.waitForSelector("[data-testid='jp-pin-repair-modal']", { state: "detached", timeout: 120_000 });
    await page.waitForTimeout(1500);
    await shot(page, `${mapId}-3-after`);
    // 같은 맵을 다시 열면 「이미 옮겼다」만 나와야 한다(멱등).
    await page.click(`[data-testid="map-tree-node-${mapId}"]`, { button: "right" });
    await page.click(`[data-testid="map-menu-jp-pin-repair-${mapId}"]`);
    await page.waitForSelector("[data-testid='jp-pin-repair-grid']", { timeout: 60_000 });
    const again = await page.locator("[data-testid='jp-pin-repair-modal'] .app-modal-message").innerText();
    const applyVisible = await page.locator("[data-testid='jp-pin-repair-apply']").count();
    result.steps.push(`again ${mapId}: apply=${applyVisible} ${again.slice(0, 60)}`);
    await page.click("[data-testid='jp-pin-repair-cancel']");
  }
  // 자동 저장을 기다린다 — 저장 표시가 「저장됨」이 될 때까지(없으면 넉넉히 기다린다).
  await page.waitForTimeout(8000);
  await page.reload({ waitUntil: "domcontentloaded" });
  await openMapPane(page);
  for (const pick of picks) {
    const [mapId] = pick.split("=");
    await openMap(page, mapId);
    await shot(page, `${mapId}-4-reloaded`);
  }
  result.ok = true;
} catch (error) {
  result.error = String(error?.stack ?? error).split("\n").slice(0, 4).join(" | ");
  result.ok = false;
  await page?.screenshot({ path: join(OUT, "fail.png") }).catch(() => {});
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
await writeFile(join(OUT, "result.json"), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);
