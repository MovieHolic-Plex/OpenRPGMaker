import { chromium } from "playwright";
import { readFile } from "node:fs/promises";

const BASE = process.env.RPG_ZZU_URL ?? "http://127.0.0.1:4173";

// Read env.local for form fill (production build may already bake env into client)
const envText = await readFile(".env.local", "utf8");
const env = Object.fromEntries(
  envText
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1)];
    })
);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on("dialog", (d) => d.accept());

console.log("--- A) without freshProject (remote path) ---");
await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.waitForTimeout(2500);
const bodyA = await page.locator("body").innerText();
console.log("body snippet:", bodyA.slice(0, 400).replace(/\s+/g, " "));
const dbA = page.getByTestId("db-connection-status");
if (await dbA.count()) {
  console.log("DB badge:", await dbA.textContent(), "|", await dbA.getAttribute("title"));
} else {
  console.log("no DB badge (maybe DB required screen)");
}
await page.screenshot({ path: "output/evidence/kingdom-legacy/11-db-no-fresh.png", fullPage: true });

console.log("--- B) with freshProject (dev-showcase, DB off by design) ---");
await page.goto(`${BASE}/?freshProject=1`, { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 60_000 }).catch(() => {});
await page.waitForTimeout(800);
const dbB = page.getByTestId("db-connection-status");
if (await dbB.count()) {
  console.log("DB badge:", await dbB.textContent(), "|", await dbB.getAttribute("title"));
  await dbB.click();
  await page.waitForTimeout(400);
  // fill form from .env.local and try connect
  const url = env.VITE_SUPABASE_URL ?? "";
  const key = env.VITE_SUPABASE_ANON_KEY ?? "";
  const pid = env.VITE_SUPABASE_PROJECT_ID ?? "rpg-zzu-house-template-gallery";
  console.log("filling form url=", url, "projectId=", pid);
  // form field names from dbConnectionSettings field()
  const inputs = page.locator(".db-config-form input");
  const count = await inputs.count();
  console.log("form inputs", count);
  if (count >= 3) {
    await inputs.nth(0).fill(url);
    await inputs.nth(1).fill(key);
    await inputs.nth(2).fill(pid);
  }
  const connectBtn = page.locator('button:has-text("연결"), button:has-text("저장"), [type="submit"]').first();
  if (await connectBtn.isVisible().catch(() => false)) {
    await connectBtn.click();
    await page.waitForTimeout(2500);
  }
  const statusLine = await page.getByTestId("db-config-status-line").textContent().catch(() => null);
  console.log("after connect status line:", statusLine);
  const badgeAfter = await page.getByTestId("db-connection-status").textContent().catch(() => null);
  const titleAfter = await page.getByTestId("db-connection-status").getAttribute("title").catch(() => null);
  console.log("badge after:", badgeAfter, titleAfter);
  await page.screenshot({ path: "output/evidence/kingdom-legacy/12-db-connect-attempt.png", fullPage: true });
}

// Network-level proof with same headers the app uses
console.log("--- C) REST probe ---");
const r = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/projects?select=project_id,title&limit=3`, {
  headers: {
    apikey: env.VITE_SUPABASE_ANON_KEY,
    Authorization: `Bearer ${env.VITE_SUPABASE_ANON_KEY}`,
    Accept: "application/json",
    "Accept-Profile": "rpg_zzu",
  },
});
console.log("REST status", r.status);
console.log("REST body", (await r.text()).slice(0, 300));

await browser.close();
