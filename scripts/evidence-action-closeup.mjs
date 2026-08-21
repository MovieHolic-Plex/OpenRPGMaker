import { chromium } from "playwright";
import fs from "node:fs";

const OUT = "output/evidence/action-combat-demo";
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.addInitScript(() => {
  window.localStorage.setItem("oprn:editor-ui-mode", "expert");
});
await page.goto("http://localhost:9999/?project=rpg-zzu-dungeon-example", { waitUntil: "domcontentloaded" });
await page.getByTestId("edit-canvas").waitFor({ timeout: 30_000 });
await page.getByTestId("mode-play").click({ force: true });
await page.getByTestId("title-screen").waitFor({ timeout: 20_000 });
await page.keyboard.press("Enter");
await page.getByTestId("runtime-state-json").waitFor({ timeout: 20_000 });
await page.waitForTimeout(1500);

const readState = () =>
  page.evaluate(() => {
    const state = JSON.parse(document.querySelector("[data-testid='runtime-state-json']")?.textContent ?? "{}");
    const chars = window.__oprnCharacterSprites?.();
    const slimes = Object.entries(chars?.events ?? {})
      .filter(([id]) => id.includes("__field_spawn__"))
      .map(([id, s]) => ({ id, tx: Math.floor(s.x / 16), ty: Math.floor(s.y / 16) }));
    return { player: state.player, slimes };
  });

const stepDir = async (dir) => {
  await page.evaluate((d) => window.__oprnInput?.dir(d), dir);
  await page.waitForTimeout(240);
  await page.evaluate(() => window.__oprnInput?.dir(null));
  await page.waitForTimeout(120);
};

let st = await readState();
let target = null;
for (const sl of st.slimes) {
  const d = Math.abs(sl.tx - st.player.x) + Math.abs(sl.ty - st.player.y);
  if (!target || d < target.d) target = { ...sl, d };
}
for (let i = 0; i < 16 && target && target.d > 1; i += 1) {
  const dx = target.tx - st.player.x;
  const dy = target.ty - st.player.y;
  await stepDir(Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up");
  st = await readState();
  target = null;
  for (const sl of st.slimes) {
    const d = Math.abs(sl.tx - st.player.x) + Math.abs(sl.ty - st.player.y);
    if (!target || d < target.d) target = { ...sl, d };
  }
}
console.log("adjacent:", JSON.stringify(target), "player:", JSON.stringify(st.player));

const face = target.tx > st.player.x ? "right" : target.tx < st.player.x ? "left" : target.ty > st.player.y ? "down" : "up";
await page.evaluate((d) => window.__oprnInput?.dir(d), face);
await page.waitForTimeout(300);
await page.evaluate(() => window.__oprnInput?.dir(null));

for (let attempt = 0; attempt < 6; attempt += 1) {
  await page.evaluate(() => window.__oprnInput?.attack());
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${OUT}/07-swing-burst-${attempt}.png` });
  await page.waitForTimeout(280);
}
console.log("burst shots taken");

await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/08-damaged-enemy-bar.png` });
console.log("post-hit bar shot taken");

await browser.close();
console.log("DONE");
