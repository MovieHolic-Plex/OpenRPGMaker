import { chromium } from "playwright";
import { createServer } from "node:http";
export const BASE = process.env.AIUI_BASE ?? "http://127.0.0.1:9909";
export async function boot({ w = 1440, h = 900, q = "blankProject=1", extraInit } = {}) {
  const browser = await chromium.launch({ args: ["--disable-background-networking", "--disable-features=NetworkChangeNotifier"] });
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  page.on("pageerror", (e) => console.log("pageerror", e.message.slice(0, 200)));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => { localStorage.setItem("oprn:locale", "ko"); });
  if (extraInit) await page.addInitScript(extraInit);
  if (process.env.AIUI_AUTH !== "0") {
    const cj = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
    await page.route(/\/auth\/status/, r => r.fulfill({ status: 200, headers: cj, json: { connected: true, authKind: "oauth", expired: false, env: false } }));
    await page.route(/\/auth\/providers/, r => r.fulfill({ status: 200, headers: cj, json: { providers: [{ id: "google", label: "Google", authKind: "oauth", defaultModel: "gemini-4-argon", hasLogin: true, hasRefresh: true }] } }));
  }
  await page.route("**/__oprn/ai-activity", (r) => r.fulfill({ json: { ok: true } }));
  await page.route("**/__oprn/edit-activity", (r) => r.fulfill({ json: { ok: true } }));
  await page.goto(`${BASE}/?${q}`, { waitUntil: "domcontentloaded" });
  for (let i = 0; i < 80; i++) { await page.waitForTimeout(1500); if (await page.locator("[data-testid=edit-canvas]").isVisible().catch(() => false)) break; }
  await page.waitForTimeout(2500);
  return { browser, page };
}
