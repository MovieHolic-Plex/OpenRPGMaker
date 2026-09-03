import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
const require = createRequire(new URL("../../../package.json", import.meta.url));
const { chromium } = require("playwright");
const BASE = "http://127.0.0.1:9631";
const OUT = "/tmp/ee-capture/out2";
mkdirSync(OUT, { recursive: true });
const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);
const metrics = { steps: {} };
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });

async function boot(dpr, vp) {
  const context = await browser.newContext({ viewport: vp, deviceScaleFactor: dpr });
  await context.addInitScript(() => {
    window.localStorage.clear(); window.sessionStorage.clear();
    window.localStorage.setItem("oprn:editor-session-id", "ee-ux-proposal-2");
    window.localStorage.setItem("oprn:editor-ui-mode", "expert");
  });
  const page = await context.newPage();
  await page.goto(`${BASE}/?freshProject=1`, { waitUntil: "domcontentloaded", timeout: 120000 }).catch(() => {});
  const deadline = Date.now() + 240000; let booted = false; let lastReload = Date.now();
  while (Date.now() < deadline && !booted) {
    booted = await page.evaluate(() => { const c = document.querySelector("[data-testid=edit-canvas] canvas"); const l = document.querySelector("[data-testid=layer-event]"); return Boolean(c && c.getBoundingClientRect().width > 200 && l && l.getClientRects().length > 0); }).catch(() => false);
    if (booted) break;
    if (Date.now() - lastReload > 45000) { await page.reload({ waitUntil: "domcontentloaded" }).catch(() => {}); lastReload = Date.now(); }
    await page.waitForTimeout(2000);
  }
  if (!booted) throw new Error("boot failed");
  await page.waitForTimeout(2000);
  const inject = await page.evaluate(() => {
    const store = window.__oprnEditorStore; const project = store.getCurrent(); const mapId = project.startMapId; const map = project.maps[mapId];
    let switchId = null, variableId = null, itemIds = [], sprite = null, otherMapId = null;
    const walk = (cmds) => { for (const c of cmds ?? []) { if (!c) continue; if (c.kind === "setSwitch" && !switchId) switchId = c.switchId; if (c.kind === "setVariable" && !variableId) variableId = c.variableId; if (c.kind === "shop" && !itemIds.length && Array.isArray(c.itemIds)) itemIds = c.itemIds.slice(0, 4); if (c.kind === "fork") { if (c.condition?.kind === "switch" && !switchId) switchId = c.condition.switchId; walk(c.then); walk(c.else); } if (c.kind === "choices") for (const o of c.options ?? []) walk(o.branch); } };
    for (const m of Object.values(project.maps)) { if (m.id !== mapId && !otherMapId) otherMapId = m.id ?? null; for (const ev of m.events ?? []) { for (const p of ev.pages ?? []) { walk(p.commands); if (!sprite && p.graphic?.sprite) sprite = p.graphic.sprite; } walk(ev.commands); } }
    if (!otherMapId) otherMapId = Object.keys(project.maps).find((id) => id !== mapId) ?? mapId;
    const taken = new Set((map.events ?? []).map((e) => `${e.x},${e.y}`)); const anchor = map.events?.[0] ?? { x: 5, y: 5 }; let x = anchor.x, y = anchor.y;
    for (let dx = 1; dx < 12; dx += 1) { if (!taken.has(`${anchor.x + dx},${anchor.y}`)) { x = anchor.x + dx; break; } }
    const graphic = sprite ? { sprite, direction: "down" } : {}; const speaker = "대장장이 하몬";
    const ev = { id: "ev_ux_stress", x, y, trigger: { kind: "action" }, commands: [], pages: [
      { id: "p1", name: "첫 만남", conditions: [], graphic, trigger: { kind: "action" }, priority: "same", movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [
        { kind: "text", speaker, body: "어서 오게. 광산에서 캐 온 철광석이 있다면 내가 사 주지." },
        { kind: "choices", prompt: "무엇을 하겠나?", options: [ { text: "철광석을 판다", branch: [ { kind: "changeGold", op: "+=", amount: 120 }, { kind: "text", speaker, body: "좋은 물건이군. 120G 를 주지." } ] }, { text: "무기를 산다", branch: [ { kind: "shop", itemIds, allowSell: true } ] }, { text: "그냥 구경한다", branch: [ { kind: "text", body: "하몬은 다시 망치를 들었다." } ] } ] },
        { kind: "fork", condition: { kind: "switch", switchId, value: true }, then: [ { kind: "text", speaker, body: "축제 준비는 잘 되고 있나? 광장에 등불을 달아야 해." } ], else: [ { kind: "setSwitch", switchId, value: true }, { kind: "text", speaker, body: "다음에 오면 축제 이야기를 해 주지." } ] },
        { kind: "setVariable", variableId, op: "+=", value: 1 },
        { kind: "moveEvent", eventId: "ev_ux_stress", route: { moves: [ { kind: "move", dir: "left" }, { kind: "move", dir: "left" }, { kind: "turn", dir: "down" }, { kind: "wait" } ], repeat: false, wait: true } },
        { kind: "wait", ms: 600 }, { kind: "transfer", mapId: otherMapId, x: 4, y: 6 } ] },
      { id: "p2", name: "축제 이후", conditions: [ { kind: "switch", switchId, value: true } ], graphic, trigger: { kind: "action" }, priority: "same", movement: { type: "random", speed: 3, frequency: 3 }, commands: [ { kind: "text", speaker, body: "축제는 어땠나? 등불이 참 예뻤지." } ] },
      { id: "p3", name: "밤", conditions: [ { kind: "timePhase", phase: "night" } ], graphic, trigger: { kind: "action" }, priority: "same", movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [ { kind: "text", body: "하몬은 잠들어 있다." } ] } ] };
    store.update((draft) => { draft.maps[mapId].events.push(ev); });
    return { ok: true };
  });
  log("inject", JSON.stringify(inject));
  await page.waitForTimeout(700);
  await page.getByTestId("layer-event").click(); await page.waitForTimeout(300);
  const tool = page.locator('[data-testid="tool-event"]:visible').first(); if (await tool.count()) await tool.click();
  await page.waitForTimeout(300);
  await page.getByTestId("event-list-row-ev_ux_stress").first().click(); await page.waitForTimeout(300);
  await page.getByTestId("event-editor-open").click();
  await page.getByTestId("event-editor-modal").waitFor({ state: "visible", timeout: 30000 });
  await page.waitForTimeout(1000);
  await page.getByTestId("event-view-toggle-list").click().catch(() => {});
  await page.waitForTimeout(500);
  return { context, page };
}
const step = async (name, fn) => { try { metrics.steps[name] = (await fn()) ?? "ok"; log("ok", name); } catch (e) { metrics.steps[name] = { failed: String(e).slice(0, 300) }; log("STEP FAILED", name, String(e).slice(0, 200)); } };

{
  const { context, page } = await boot(1, { width: 1440, height: 900 });
  const shot = async (n, o = {}) => { await page.screenshot({ path: `${OUT}/${n}.png`, ...o }); log("shot", n); };
  const dismissConfirm = async () => { const keep = page.getByText("계속 편집", { exact: true }); if (await keep.count()) { await keep.first().click().catch(() => {}); await page.waitForTimeout(300); } };
  const closeSubdialogs = async () => { for (let i = 0; i < 4; i += 1) { const c = page.locator(".event-subdialog-close:visible").last(); if (!(await c.count())) break; await c.click().catch(() => {}); await page.waitForTimeout(300); } };
  const ensureEditor = async () => { await dismissConfirm(); const m = page.getByTestId("event-editor-modal"); if (await m.isVisible().catch(() => false)) return; log("reopening editor"); await page.getByTestId("layer-event").click().catch(() => {}); await page.waitForTimeout(300); await page.getByTestId("event-list-row-ev_ux_stress").first().click(); await page.waitForTimeout(300); await page.getByTestId("event-editor-open").click(); await m.waitFor({ state: "visible", timeout: 20000 }); await page.waitForTimeout(800); await page.getByTestId("event-view-toggle-list").click().catch(() => {}); await page.waitForTimeout(400); };
  const openRail = async (slug) => { await page.locator(`[data-testid=evt-rail-group-${slug}] .event-editor-settings-accordion-header`).first().click({ timeout: 5000 }); await page.waitForTimeout(600); };
  const railGeom = () => page.evaluate(() => { const col = document.querySelector(".event-editor-settings-column"); return { colW: Math.round(col.getBoundingClientRect().width), scrollH: col.scrollHeight, clientH: col.clientHeight, groups: [...document.querySelectorAll("[data-testid^=evt-rail-group-]")].map((g) => ({ id: g.dataset.testid.replace("evt-rail-group-", ""), open: g.classList.contains("is-open"), h: Math.round(g.getBoundingClientRect().height), bodyW: Math.round((g.children[1]?.getBoundingClientRect().width) ?? 0), bodyX: Math.round((g.children[1]?.getBoundingClientRect().x) ?? 0) })) }; });

  await shot("a01-list-no-selection");
  await step("menu-edit", async () => { await page.getByTestId("event-command-edit-menu").click(); await page.waitForTimeout(400); await shot("a02-menu-edit"); const items = await page.evaluate(() => [...document.querySelectorAll("[role=menu] button, [role=menuitem], .event-editor-command-menu button")].filter((b) => b.getClientRects().length).map((b) => b.textContent.trim())); await page.mouse.click(700, 500); await page.waitForTimeout(300); return items; });
  await ensureEditor();
  await step("menu-tools", async () => { const t = page.locator(".event-editor-command-toolbar button").filter({ hasText: /^도구/ }).first(); await t.click(); await page.waitForTimeout(400); await shot("a03-menu-tools"); const items = await page.evaluate(() => [...document.querySelectorAll("[role=menu] button, [role=menuitem], [data-testid=event-editor-aux-tools] button")].filter((b) => b.getClientRects().length).map((b) => b.textContent.trim())); await page.mouse.click(700, 500); await page.waitForTimeout(300); return items; });
  await ensureEditor();
  await step("context-menu", async () => { const head = page.locator('[data-testid=event-editor-modal] .cmd-item .cmd-head').first(); await head.click({ button: "right" }); await page.waitForTimeout(500); await shot("a04-context-menu"); const items = await page.evaluate(() => [...document.querySelectorAll("[data-testid=event-command-context-menu] button, [data-testid=event-command-context-menu] [role=menuitem]")].map((b) => b.textContent.trim())); await page.mouse.click(700, 860); await page.waitForTimeout(300); return items; });
  await ensureEditor();
  for (const slug of ["move", "memory", "npc", "when"]) {
    await step(`rail-${slug}`, async () => { await openRail(slug); await shot(`a05-rail-${slug}`); return await railGeom(); });
  }
  await step("graphic-dialog", async () => {
    await openRail("look-talk");
    await page.getByText("이미지 선택", { exact: true }).first().click(); await page.waitForTimeout(1200); await shot("a09-graphic-dialog");
    const info = await page.evaluate(() => { const d = [...document.querySelectorAll(".event-subdialog-backdrop")].filter((n) => n.getClientRects().length); const last = d.at(-1); const win = last?.querySelector(".event-subdialog-window, [class*=window]") ?? last; const r = win?.getBoundingClientRect(); return { overlays: d.length, testid: last?.dataset.testid, w: r ? Math.round(r.width) : null, h: r ? Math.round(r.height) : null, title: last?.querySelector(".event-subdialog-header")?.textContent.trim().slice(0, 40), text: last?.innerText.replace(/\s+/g, " ").slice(0, 300) }; });
    await closeSubdialogs(); return info;
  });
  await ensureEditor();
  await step("ai-dock", async () => { await page.evaluate(() => { const d = document.querySelector("[data-testid=ai-event-assist]"); const det = d?.tagName === "DETAILS" ? d : d?.closest("details") ?? d?.querySelector("details"); if (det) det.open = true; }); await page.waitForTimeout(600); await shot("a10-ai-dock"); const r = await page.evaluate(() => { const d = document.querySelector("[data-testid=ai-event-assist]"); const r = d.getBoundingClientRect(); const cmds = document.querySelector(".event-editor-commands-column").getBoundingClientRect(); return { dockH: Math.round(r.height), commandsH: Math.round(cmds.height), share: Math.round((r.height / cmds.height) * 100), text: d.innerText.replace(/\s+/g, " ").slice(0, 400) }; }); await page.evaluate(() => { const d = document.querySelector("[data-testid=ai-event-assist]"); const det = d?.tagName === "DETAILS" ? d : d?.closest("details") ?? d?.querySelector("details"); if (det) det.open = false; }); await page.waitForTimeout(300); return r; });
  await ensureEditor();
  await step("depth3", async () => {
    const row = page.locator('[data-testid=event-editor-modal] [data-testid="event-command-fork"]').first(); await row.click(); await page.waitForTimeout(300); await row.dblclick();
    const dlg = page.getByTestId("event-command-edit-dialog"); await dlg.waitFor({ state: "visible", timeout: 8000 }); await page.waitForTimeout(500);
    const pill = dlg.locator("button").filter({ hasText: /Q1|약초|스위치/ }).first();
    let pickerOpen = false;
    if (await pill.count()) { await pill.click(); await page.waitForTimeout(800); pickerOpen = await page.getByTestId("event-record-picker-search").isVisible().catch(() => false); }
    await shot("a11-depth3");
    const depth = await page.evaluate(() => { const layers = [...document.querySelectorAll("body > *")].filter((n) => n.getClientRects().length && ["fixed", "absolute"].includes(getComputedStyle(n).position)); return { fixedLayers: layers.length, classes: layers.map((n) => String(n.className).slice(0, 50)), backdrops: document.querySelectorAll(".event-subdialog-backdrop, .event-editor-modal-backdrop").length }; });
    await closeSubdialogs(); await page.waitForTimeout(300);
    const cancel = page.getByTestId("event-command-edit-cancel"); if (await cancel.count()) await cancel.click().catch(() => {});
    await page.waitForTimeout(300); return { ...depth, pickerOpen };
  });
  await ensureEditor();
  await step("escape-confirm", async () => {
    await page.locator('[data-testid=event-editor-modal] [data-testid="event-command-text"]').first().click(); await page.waitForTimeout(500);
    const sp = page.locator("[data-testid=event-editor-inspector] input[type=text], [data-testid=event-editor-inspector] input:not([type])").first(); if (await sp.count()) { await sp.click(); await page.keyboard.type("!"); await page.waitForTimeout(300); }
    await page.keyboard.press("Escape"); await page.waitForTimeout(700); await shot("a12-escape-confirm");
    const txt = await page.evaluate(() => { const d = [...document.querySelectorAll("*")].filter((n) => n.getClientRects().length && n.children.length && /적용하지 않은 변경/.test(n.textContent) && n.textContent.length < 600).at(-1); return d ? { text: d.innerText.replace(/\s+/g, " ").slice(0, 400), buttons: [...d.querySelectorAll("button")].map((b) => ({ t: b.textContent.trim(), bg: getComputedStyle(b).backgroundColor, color: getComputedStyle(b).color })) } : null; });
    await dismissConfirm(); return txt;
  });
  await ensureEditor();
  metrics.footerButtons = await page.evaluate(() => [...document.querySelectorAll(".event-editor-modal-footer button")].map((b) => b.textContent.trim()));
  metrics.header = await page.evaluate(() => { const h = document.querySelector(".event-editor-modal-header"); return { text: h.innerText.replace(/\s+/g, " "), nameInput: document.querySelector("[data-testid=event-editor-name]")?.value, identity: document.querySelector("[data-testid=event-editor-identity]")?.textContent, buttons: [...h.querySelectorAll("button")].map((b) => b.textContent.trim() || b.getAttribute("aria-label")) }; });
  metrics.pageStrip = await page.evaluate(() => { const s = document.querelector?.("x"); const strip = document.querySelector("[data-testid=event-classic-page-controls]") ?? document.querySelector("[data-testid=evt-header-page-tabs]")?.parentElement; return strip ? { text: strip.innerText.replace(/\s+/g, " "), buttons: [...strip.querySelectorAll("button")].map((b) => b.textContent.trim() || b.getAttribute("aria-label") || b.title), h: Math.round(strip.getBoundingClientRect().height) } : null; });
  await step("fullscreen", async () => { const fs = page.getByTestId("event-editor-window-fullscreen"); if (!(await fs.count())) return "none"; const before = await page.evaluate(() => { const r = document.querySelector(".event-editor-modal-window").getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; }); await fs.click({ timeout: 5000 }); await page.waitForTimeout(600); await shot("a13-fullscreen"); const after = await page.evaluate(() => { const r = document.querySelector(".event-editor-modal-window").getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; }); await fs.click({ timeout: 5000 }).catch(() => {}); await page.waitForTimeout(300); return { before, after }; });
  await ensureEditor();
  await step("close-inspector", async () => { const c = page.getByTestId("event-inspector-close"); if (await c.count()) await c.click(); await page.waitForTimeout(300); });
  for (const [w, h] of [[1280, 800], [1024, 768], [1680, 1000], [1920, 1080]]) {
    await step(`vp-${w}`, async () => { await page.setViewportSize({ width: w, height: h }); await page.waitForTimeout(800); await shot(`a14-vp${w}-list`); return await page.evaluate(() => { const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { x: Math.round(b.x), w: Math.round(b.width), h: Math.round(b.height) }; }; const listBox = document.querySelector(".cmd-list")?.getBoundingClientRect(); return { settings: r(".event-editor-settings-column"), commands: r(".event-editor-commands-column"), inspector: r(".event-editor-inspector-column"), toolbar: r(".event-editor-command-toolbar"), cmdList: r(".cmd-list"), rows: document.querySelectorAll(".cmd-item").length, visibleRows: listBox ? [...document.querySelectorAll(".cmd-item")].filter((e) => { const b = e.getBoundingClientRect(); return b.top >= listBox.top - 1 && b.bottom <= listBox.bottom + 1; }).length : null }; }); });
  }
  await page.setViewportSize({ width: 1440, height: 900 }); await page.waitForTimeout(500);
  metrics.listGeom = await page.evaluate(() => { const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }; }; const heads = [...document.querySelectorAll(".cmd-item .cmd-head")]; return { cmdList: r(".cmd-list"), commands: r(".event-editor-commands-column"), settings: r(".event-editor-settings-column"), rowH: Math.round(heads[0]?.getBoundingClientRect().height ?? 0), rowCount: heads.length, avgTextLen: Math.round(heads.reduce((a, e) => a + e.textContent.trim().length, 0) / Math.max(1, heads.length)), summaryMaxRight: Math.round(Math.max(...heads.map((e) => { const s = e.querySelector(".cmd-summary") ?? e; return s.getBoundingClientRect().right; }))) }; });
  await shot("a15-list-1440-final");
  await context.close();
}
{
  const { context, page } = await boot(2, { width: 1440, height: 900 });
  const clip = async (n, c) => { await page.screenshot({ path: `${OUT}/${n}.png`, clip: c }); log("crop2x", n); };
  const box = async (sel) => { const el = page.locator(sel).first(); if (!(await el.count())) return null; return await el.boundingBox(); };
  const cropSel = async (sel, n, pad = 0) => { const b = await box(sel); if (!b) return log("no", sel); await clip(n, { x: Math.max(0, b.x - pad), y: Math.max(0, b.y - pad), width: Math.min(1440 - Math.max(0, b.x - pad), b.width + pad * 2), height: Math.min(900 - Math.max(0, b.y - pad), b.height + pad * 2) }); };
  await cropSel(".event-editor-modal-header", "z01-header-2x");
  await cropSel("[data-testid=event-classic-page-controls]", "z02-pagestrip-2x", 4);
  await cropSel(".event-editor-command-toolbar", "z03-toolbar-2x", 2);
  await cropSel(".event-editor-modal-footer", "z04-footer-2x");
  await cropSel(".event-editor-settings-column", "z05-rail-2x");
  await clip("z06-list-rows-2x", { x: 268, y: 160, width: 900, height: 300 });
  await page.getByTestId("event-view-toggle-storyboard").click(); await page.waitForTimeout(700);
  await clip("z07-story-cards-2x", { x: 268, y: 160, width: 900, height: 300 });
  await page.getByTestId("event-view-toggle-flow").click(); await page.waitForTimeout(700);
  await clip("z08-flow-2x", { x: 268, y: 160, width: 900, height: 420 });
  await page.getByTestId("event-view-toggle-preview").click(); await page.waitForTimeout(700);
  await clip("z08b-preview-2x", { x: 268, y: 160, width: 1172, height: 660 });
  await page.getByTestId("event-view-toggle-list").click(); await page.waitForTimeout(500);
  await page.getByTestId("event-command-toolbar-add").click(); await page.getByTestId("event-command-picker").waitFor({ state: "visible" }); await page.waitForTimeout(600);
  await clip("z09-picker-2x", { x: 290, y: 20, width: 860, height: 560 });
  await page.getByTestId("event-command-picker-cancel").click(); await page.waitForTimeout(400);
  await page.locator('[data-testid=event-editor-modal] [data-testid="event-command-text"]').first().click(); await page.waitForTimeout(600);
  await cropSel(".event-editor-inspector-column", "z10-inspector-2x");
  await page.screenshot({ path: `${OUT}/z11-with-inspector-1440.png` }); log("shot", "z11");
  await context.close();
}
writeFileSync(`${OUT}/metrics3.json`, JSON.stringify(metrics, null, 2));
log("done");
await browser.close();
