// Editor evidence: tall grass E/F/G renders in the real map canvas (Phaser) on forest_harmony and the climate sheets.
// Builds one board (E, F, G patches laid out by scripts/content/lib/tall-grass.mjs) into the throwaway dev project
// of a fresh headless profile, opens it per tileset and screenshots the canvas. Nothing is written outside the profile.
// Usage: BASE=http://127.0.0.1:<dev:worktree port> node scripts/qa/capture-tall-grass-editor.mjs
import fs from "node:fs";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { arrangeTallGrass } from "../content/lib/tall-grass.mjs";

const out = "verify-shots/tall-grass"; fs.mkdirSync(out, { recursive: true });
const B = [
  "..............................",
  ".XXXXXXXX...XX...XXXXXX..XXX..",
  ".XXXXXXXX...XX...XXXXXX..XXX..",
  ".XXXXXXXX...XX...XX......XXX..",
  ".XXX.XXXX...XX...XX...........",
  ".XXXXXXXX...XX................",
  "..XXXXXX......................",
  ".............................."];
const W = B[0].length, H = B.length * 3;
const lower = Array(W * H).fill(240), upper = Array(W * H).fill(-1);
["E", "F", "G"].forEach((type, k) => {
  const band = { width: W, height: B.length, lowerTiles: Array(W * B.length).fill(240), upperTiles: Array(W * B.length).fill(-1) };
  const cells = []; B.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === "X") cells.push(y * W + x); }));
  arrangeTallGrass(band, { cells, type, seed: 5 }).lowerTiles.forEach((t, i) => { lower[k * W * B.length + i] = t; });
});
const TILESETS = ["forest_harmony", "forest_harmony_snow", "forest_harmony_desert", "forest_harmony_volcano", "forest_harmony_autumn"];
const browser = await chromium.launch({ headless: true, args: ["--disable-background-networking", "--disable-features=NetworkChangeNotifier"] });
try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error" && /forest_harmony|\[assets\]|tall/i.test(m.text())) errors.push(m.text()); });
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
  for (const tilesetId of TILESETS) {
    const id = `map_tall_grass_${tilesetId}`;
    const info = await page.evaluate(({ id, tilesetId, W, H, lower, upper }) => {
      const store = window.__oprnEditorStore;
      const next = structuredClone(store.getCurrent());
      const base = Object.values(next.maps)[0];
      next.maps[id] = { ...structuredClone(base), id, name: `키큰 풀 ${tilesetId}`, width: W, height: H, tilesetId, lowerTiles: lower, upperTiles: upper, events: [] };
      next.mapTree.children.push({ mapId: id, children: [] });
      store.replaceProject(next);
      const t = store.getCurrent().tilesets[tilesetId];
      return { groups: t.autotileGroups.filter((g) => g.id.startsWith("builtin_tall_grass")).map((g) => g.id), pass: [304, 1155, 1159].map((n) => t.passability[n].up && t.passability[n].left) };
    }, { id, tilesetId, W, H, lower, upper });
    await page.getByTestId("sidebar-maps").click();
    await page.getByTestId(`map-tree-node-${id}`).click();
    await page.waitForTimeout(2500);
    const box = await page.evaluate(() => {
      const r = [...document.querySelectorAll("canvas")].map((el) => el.getBoundingClientRect()).sort((a, b) => b.width * b.height - a.width * a.height)[0];
      return { x: Math.max(0, r.x), y: Math.max(0, r.y), width: Math.min(r.width, innerWidth - Math.max(0, r.x)), height: Math.min(r.height, innerHeight - Math.max(0, r.y)) };
    });
    const file = `${out}/editor-${tilesetId}.png`;
    await page.screenshot({ path: file, clip: box });
    proof.push({ tilesetId, ...info, file });
  }
  assert(proof.every((p) => p.groups.length === 3 && p.pass.every(Boolean)), JSON.stringify(proof));
  assert.deepEqual(errors, []);
  fs.writeFileSync(`${out}/editor-proof.json`, JSON.stringify({ maps: proof, errors }, null, 2) + "\n");
  console.log(proof);
} finally {
  await browser.close();
}
