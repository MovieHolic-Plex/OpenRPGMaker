import { mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";

const out = resolve(process.env.QA_OUT_DIR ?? "verify-shots/runtime-qa/follower-frames");
const projectJson = await readFile(resolve("test/fixtures/projects/follower-qa-pokemon.json"), "utf8");
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
const server = await startPlayerQaServer();
const errors = [];
try {
  await mkdir(out, { recursive: true });
  const page = await browser.newPage({ viewport: { width: 640, height: 480 } });
  page.on("pageerror", (err) => errors.push("pageerror: " + err.message));
  await page.route("**/__runtime-qa/project.json", (route) => route.fulfill({ status: 200, contentType: "application/json", body: projectJson }));
  await page.addInitScript(() => {
    try { localStorage.clear(); } catch {}
    window.__OPENRPG_BOOT__ = { projectUrl: "/__runtime-qa/project.json", saveNamespace: "probe:follower-frames", qaInstrumentation: true };
  });
  await page.goto(server.url + "/player.html", { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-testid='title-screen']", { timeout: 60000 });
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__oprnDebug && window.__oprnDebug.readState().currentMapId, null, { timeout: 30000 });
  await page.evaluate(() => window.__oprnDebug.setSeed(11));
  await page.waitForTimeout(600);
  // state before: player (13,12). Walk right ~6 tiles: hold right 1500ms, sampling frames mid-walk.
  await page.evaluate(() => window.__oprnInput.dir("right"));
  let shots = 0;
  const samples = [];
  const t0 = Date.now();
  while (Date.now() - t0 < 1500) {
    await page.screenshot({ path: out + "/mid-" + String(shots).padStart(2, "0") + ".png" });
    const sprites = page.evaluate(() => {
      const s = window.__oprnCharacterSprites();
      const follower = s && s.followers ? Object.entries(s.followers)[0] : null;
      const startedAt = follower && window.__oprnFollowerMotionStartedAt ? window.__oprnFollowerMotionStartedAt(follower[0]) : null;
      return { player: s && s.player, follower: follower ? follower[1] : null, startedAt };
    });
    samples.push(await sprites);
    shots += 1;
    await page.waitForTimeout(110);
  }
  await page.evaluate(() => window.__oprnInput.dir(null));
  await page.waitForTimeout(400);
  const st = await page.evaluate(() => window.__oprnDebug.readState());
  console.log("FINAL", JSON.stringify({ x: st.x, y: st.y, shots, samples }, null, 1));
} finally {
  console.log("ERRORS", JSON.stringify(errors.slice(0, 6)));
  await browser.close();
  await server.close();
}
