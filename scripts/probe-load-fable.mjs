import { chromium } from "playwright";

const BASE = process.env.RPG_ZZU_URL ?? "http://127.0.0.1:4173";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on("dialog", (d) => d.accept());

await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 60_000 });
console.log("boot DB:", await page.getByTestId("db-connection-status").textContent());

// open DB settings and pick fable-village if listed
await page.getByTestId("db-connection-status").click();
await page.waitForTimeout(500);
const fable = page.locator("button, [role=option], label, li", { hasText: /fable-village|학습 예시/ }).first();
if (await fable.isVisible().catch(() => false)) {
  await fable.click();
  await page.waitForTimeout(500);
}
// try project id field
const projectId = page.getByTestId("db-config-project-id");
if (await projectId.isVisible().catch(() => false)) {
  await projectId.fill("fable-village");
}
const connect = page.locator("[data-testid='db-config-modal'] button", { hasText: /연결|저장|불러|적용|OK|확인/ }).first();
if (await connect.isVisible().catch(() => false)) {
  await connect.click();
  await page.waitForTimeout(3000);
}
console.log("after switch body:", (await page.locator("body").innerText()).slice(0, 300).replace(/\s+/g, " "));
const required = page.getByTestId("db-required-panel");
const canvas = page.getByTestId("edit-canvas");
if (await required.isVisible().catch(() => false)) {
  console.log("FAILED:", await required.innerText());
} else if (await canvas.isVisible().catch(() => false)) {
  const state = JSON.parse(await page.getByTestId("project-export-json").textContent());
  const kinds = new Set();
  const walk = (cmds) => {
    if (!Array.isArray(cmds)) return;
    for (const c of cmds) {
      if (c?.kind) kinds.add(c.kind);
      walk(c.then); walk(c.else); walk(c.body); walk(c.cancelBranch); walk(c.transactionBranch);
      if (Array.isArray(c.options)) for (const o of c.options) walk(o.branch);
    }
  };
  for (const map of Object.values(state.project.maps || {})) {
    for (const ev of map.events || []) for (const p of ev.pages || []) walk(p.commands);
  }
  console.log("LOADED", state.project.meta?.title, "kinds include setEventGraphicPattern?", kinds.has("setEventGraphicPattern"));
  console.log("sample kinds", [...kinds].sort().slice(0, 30).join(", "));
}
await page.screenshot({ path: "output/evidence/kingdom-legacy/16-fable-load.png", fullPage: true });
await browser.close();
