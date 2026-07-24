import { chromium } from "playwright";
import fs from "node:fs";

const OUT = "output/evidence/action-combat-demo";
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.on("pageerror", (err) => console.log("[pageerror]", String(err).slice(0, 300)));

await page.addInitScript(() => {
  window.localStorage.setItem("rpg-zzu:editor-ui-mode", "expert");
});
await page.goto("http://localhost:9999/?project=rpg-zzu-dungeon-example", { waitUntil: "domcontentloaded" });
await page.getByTestId("edit-canvas").waitFor({ timeout: 30_000 });
console.log("editor loaded");

await page.getByTestId("mode-play").click({ force: true });
await page.getByTestId("test-play-window").waitFor({ timeout: 30_000 });
await page.getByTestId("title-screen").waitFor({ timeout: 20_000 });
await page.keyboard.press("Enter");
await page.getByTestId("runtime-state-json").waitFor({ timeout: 20_000 });
await page.waitForTimeout(1800);
console.log("new game started on demo map");

const readState = () =>
  page.evaluate(() => {
    const state = JSON.parse(document.querySelector("[data-testid='runtime-state-json']")?.textContent ?? "{}");
    const chars = window.__rpgzzuCharacterSprites?.();
    const slimes = Object.entries(chars?.events ?? {})
      .filter(([id]) => id.includes("__field_spawn__"))
      .map(([id, s]) => ({ id, tx: Math.floor(s.x / 16), ty: Math.floor(s.y / 16) }));
    return { player: state.player, mapId: state.mapId, slimes };
  });

let st = await readState();
console.log("map:", st.mapId, "player:", JSON.stringify(st.player), "slimes:", st.slimes.length);
await page.screenshot({ path: `${OUT}/01-field-hud.png` });
console.log("shot 01: field + HUD");

const nearest = (s) => {
  let best = null;
  for (const sl of s.slimes) {
    const d = Math.abs(sl.tx - s.player.x) + Math.abs(sl.ty - s.player.y);
    if (!best || d < best.d) best = { ...sl, d };
  }
  return best;
};

const stepDir = async (dir) => {
  await page.evaluate((d) => window.__rpgzzuInput?.dir(d), dir);
  await page.waitForTimeout(240);
  await page.evaluate(() => window.__rpgzzuInput?.dir(null));
  await page.waitForTimeout(120);
};

let target = nearest(st);
for (let i = 0; i < 16 && target && target.d > 1; i += 1) {
  const dx = target.tx - st.player.x;
  const dy = target.ty - st.player.y;
  await stepDir(Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up");
  st = await readState();
  target = nearest(st);
}
console.log("adjacent to:", JSON.stringify(target), "player:", JSON.stringify(st.player));

const faceDir = target
  ? target.tx > st.player.x ? "right" : target.tx < st.player.x ? "left" : target.ty > st.player.y ? "down" : "up"
  : "down";
await page.evaluate((d) => window.__rpgzzuInput?.dir(d), faceDir);
await page.waitForTimeout(300);
await page.evaluate(() => window.__rpgzzuInput?.dir(null));

const attack = async () => {
  await page.evaluate(() => window.__rpgzzuInput?.attack());
  await page.waitForTimeout(400);
};

await attack();
await page.waitForTimeout(80);
await page.screenshot({ path: `${OUT}/02-first-hit.png` });
console.log("shot 02: first hit");
await page.waitForTimeout(700);
await page.screenshot({ path: `${OUT}/03-enemy-hp-bar.png` });
console.log("shot 03: enemy HP bar persists");

let killed = false;
const reface = async (t, p) => {
  const d = t.tx > p.x ? "right" : t.tx < p.x ? "left" : t.ty > p.y ? "down" : "up";
  await page.evaluate((dir) => window.__rpgzzuInput?.dir(dir), d);
  await page.waitForTimeout(300);
  await page.evaluate(() => window.__rpgzzuInput?.dir(null));
};
for (let round = 0; round < 24 && !killed; round += 1) {
  st = await readState();
  target = nearest(st);
  if (!target) break;
  if (target.d > 1) {
    const dx = target.tx - st.player.x;
    const dy = target.ty - st.player.y;
    await stepDir(Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up");
    continue;
  }
  await reface(target, st.player);
  const before = st.slimes.length;
  await attack();
  const after = await readState();
  if (after.slimes.length < before) {
    killed = true;
    console.log("kill confirmed:", before, "→", after.slimes.length);
    await page.screenshot({ path: `${OUT}/04-kill.png` });
  }
}
if (!killed) console.log("WARN: no kill within rounds");

await page.waitForTimeout(3000);
const hudText = await page.evaluate(() => document.querySelector("[data-testid='action-hud-hp-text']")?.textContent ?? null);
console.log("player HP after contact window:", hudText);
await page.screenshot({ path: `${OUT}/05-contact-damage.png` });

await browser.close();
console.log("DONE");
