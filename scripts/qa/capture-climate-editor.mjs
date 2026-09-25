// Editor evidence: the climate sheets load in the real map canvas (Phaser). Adds climate maps to the throwaway dev project
// of a fresh headless profile, opens each and screenshots the canvas. Nothing is written outside the browser profile.
import fs from "node:fs";
import assert from "node:assert/strict";
import { chromium } from "playwright";
const out = "verify-shots/climate-villages";
const c = JSON.parse(fs.readFileSync("tiledata/climate-villages/catalog.json"));
const fields = JSON.parse(fs.readFileSync("tiledata/field-routes/catalog.json"));
Object.assign(c.maps, fields.maps);
// Each map must show its climate's signature colour: snow white, lava, desert sand, autumn gold grass.
const pick = [["climate-snow-frozen-mistpond", "white", 0.2], ["climate-volcano-twin-falls", "lava", 0.02], ["climate-desert-terrace-canyon", "sand", 0.2],
  ["climate-autumn-chapel-hill", "gold", 0.2], ["field-volcano-ford-cliff-road", "lava", 0.02], ["field-desert-crossroads", "sand", 0.2]];
const browser = await chromium.launch({ headless: true, args: ["--disable-background-networking", "--disable-features=NetworkChangeNotifier"] });
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1050 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error" && /climate|forest_harmony_(snow|volcano|desert|autumn)|\[assets\]/.test(m.text())) errors.push(m.text()); });
  await page.route("**/rest/v1/**", (r) => r.fulfill({ json: [] }));
  await page.addInitScript(() => {
    localStorage.setItem("oprn:editor-ui-mode", "expert");
    localStorage.setItem("oprn:ai-panel-collapsed", "1");
    for (const k of ["oprn:editor-welcome-dismissed", "oprn:standard-welcome-seen", "oprn:coachmarks-basic-v1"]) localStorage.setItem(k, "1");
  });
  await page.goto(`${process.env.BASE ?? "http://127.0.0.1:9816"}/?devProject=1&marketTown=1`, { waitUntil: "domcontentloaded", timeout: 12e4 });
  const guest = page.getByTestId("login-guest");
  await page.getByTestId("ai-input").or(guest).first().waitFor({ timeout: 12e4 });
  if (await guest.isVisible()) await guest.click();
  await page.getByTestId("ai-input").waitFor({ timeout: 12e4 });
  const proof = [];
  for (const [id] of pick) {
    // A dynamic import would get a second module instance; the DEV hook exposes the app's own store.
    await page.evaluate(({ map }) => {
      const store = window.__oprnEditorStore;
      const next = structuredClone(store.getCurrent()); next.maps[map.id] = map; next.mapTree.children.push({ mapId: map.id, children: [] });
      store.replaceProject(next);
    }, { map: c.maps[id] });
    await page.getByTestId("sidebar-maps").click();
    await page.getByTestId(`map-tree-node-${id}`).click();
    await page.waitForTimeout(2500);
    // The map viewport is the largest canvas on the page (the map list draws small thumbnails too).
    const box = await page.evaluate(() => {
      const r = [...document.querySelectorAll("canvas")].map((el) => el.getBoundingClientRect()).sort((a, b) => b.width * b.height - a.width * a.height)[0];
      return { x: Math.max(0, r.x), y: Math.max(0, r.y), width: Math.min(r.width, innerWidth - Math.max(0, r.x)), height: Math.min(r.height, innerHeight - Math.max(0, r.y)) };
    });
    const file = `${out}/editor-${id}.png`;
    await page.screenshot({ path: file, clip: box });
    // The canvas must show the climate palette, not an empty or missing-texture frame. WebGL has no readback,
    // so the screenshot itself is decoded in the page.
    const stats = await page.evaluate(async (url) => {
      const im = new Image(); im.src = url; await im.decode();
      const c2 = document.createElement("canvas"); c2.width = im.width; c2.height = im.height;
      const g = c2.getContext("2d"); g.drawImage(im, 0, 0);
      const d = g.getImageData(0, 0, c2.width, c2.height).data; let white = 0, lava = 0, sand = 0, gold = 0, magenta = 0, n = 0;
      for (let i = 0; i < d.length; i += 16) {
        n++;
        const [r, gg, b] = [d[i], d[i + 1], d[i + 2]];
        if (r > 210 && gg > 215 && b > 225) white++;
        if (r > 180 && gg < 150 && b < 60) lava++;
        if (r > 205 && gg > 175 && gg < 225 && b > 110 && b < 170) sand++;
        if (r > 140 && r < 215 && gg > 140 && gg < 205 && b > 55 && b < 100 && Math.abs(r - gg) < 25) gold++;
        if (r > 240 && gg < 20 && b > 240) magenta++;
      }
      return { white: white / n, lava: lava / n, sand: sand / n, gold: gold / n, magenta: magenta / n };
    }, "data:image/png;base64," + fs.readFileSync(file).toString("base64"));
    proof.push({ id, tilesetId: c.maps[id].tilesetId, ...stats });
  }
  pick.forEach(([, colour, min], k) => assert(proof[k][colour] > min, JSON.stringify(proof[k])));
  assert(proof.every((p) => p.magenta === 0), JSON.stringify(proof));
  assert.deepEqual(errors, []);
  fs.writeFileSync(`${out}/editor-proof.json`, JSON.stringify({ maps: proof, errors }, null, 2) + "\n");
  console.log(proof);
} finally {
  await browser.close();
}
