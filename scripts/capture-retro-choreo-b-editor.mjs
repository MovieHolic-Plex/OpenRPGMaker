// B 편집기 증거 촬영. 사용: npm run dev:worktree (9807) 후  node scripts/capture-retro-choreo-b-editor.mjs [baseUrl]
// 결과: verify-shots/retro-choreo-b/g-*.png + g-results.json (메모리 세션 ?freshProject=1 — 정본 저장 증거 아님)
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const BASE = process.argv[2] ?? "http://127.0.0.1:9807";
const OUT = path.resolve("verify-shots/retro-choreo-b");
fs.mkdirSync(OUT, { recursive: true });
const results = {};
const browser = await chromium.launch({ args: ["--disable-background-networking", "--disable-features=NetworkChangeNotifier"] });
const p = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
await p.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
p.on("pageerror", (e) => console.log("PAGEERROR", e.message));
p.on("console", (m) => { if (m.type() === "error") console.log("CONSOLE", m.text().slice(0, 300)); });
await p.goto(`${BASE}/?freshProject=1`);
await p.waitForSelector("[data-testid='edit-canvas']", { timeout: 90000 });
await p.waitForTimeout(2000);
const wait = (ms = 700) => p.waitForTimeout(ms);
const tid = (id) => p.locator(`[data-testid="${id}"]`);
const shot = (name) => p.screenshot({ path: path.join(OUT, name), timeout: 120000, animations: "allow" });
const jsClick = (id) => p.evaluate((x) => document.querySelector(`[data-testid="${x}"]`).click(), id);
const setValue = (id, value) => p.evaluate(([x, v]) => {
  const host = document.querySelector(`[data-testid="${x}"]`);
  const input = host.matches("input,select,textarea") ? host : host.querySelector("input,select,textarea");
  input.value = v;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}, [id, String(value)]);
const rec = () => p.evaluate(() => { const r = window.__oprnEditorStore.getCurrent().database.skillChoreographies.at(-1); return JSON.parse(JSON.stringify(r)); });

await tid("toolbar-database").click();
await tid("database-modal").waitFor({ timeout: 30000 });
await wait(1200);
await jsClick("db-tab-retro-choreographies");
await wait(2500);
await tid("db-retro-choreo-list").locator(".db-list-row").first().click();
await wait(1500);
await jsClick("db-retro-choreo-clone");
await wait(1800);
results.before = await rec();
await p.evaluate(() => document.querySelector("[data-testid='db-retro-choreo-handles']")?.scrollIntoView({ block: "start" }));
await wait(500);
await shot("g0-handles-before.png");

// 손잡이 조작
await tid("db-retro-choreo-weight").locator("[data-weight='heavy']").click();
await wait(500);
await tid("db-retro-choreo-tint").locator("[data-tint='ice']").click().catch(() => {});
await wait(500);
results.afterHeavyIce = await rec();
await p.evaluate(() => document.querySelector("[data-testid='db-retro-choreo-handles']")?.scrollIntoView({ block: "start" }));
await shot("g1-handles-after.png");
console.log(JSON.stringify({ tintTestids: await p.evaluate(() => [...document.querySelectorAll("[data-testid^='db-retro-choreo-']")].map((e) => e.dataset.testid).filter((s) => /speed|tint|weight|shake|flash|dim|cutin|se$/.test(s))) }));
fs.writeFileSync(path.join(OUT, "g-results.json"), JSON.stringify(results, null, 2));
await browser.close();
