import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
const require = createRequire(new URL("../../../package.json", import.meta.url));
const { chromium } = require("playwright");

const BASE = process.env.BASE ?? "http://127.0.0.1:9631";
const OUT = process.env.OUT ?? "/tmp/ee-capture/out";
mkdirSync(OUT, { recursive: true });
const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);
const metrics = { steps: {}, errors: [] };
const pageErrors = [];

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
await context.addInitScript(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  window.localStorage.setItem("oprn:editor-session-id", "ee-ux-proposal");
  window.localStorage.setItem("oprn:editor-ui-mode", "expert");
});
const page = await context.newPage();
page.on("pageerror", (e) => pageErrors.push(String(e).slice(0, 300)));
page.on("console", (m) => { if (m.type() === "error") pageErrors.push("console: " + m.text().slice(0, 200)); });

const shot = async (name, opts = {}) => {
  const path = `${OUT}/${name}.png`;
  await page.screenshot({ path, ...opts });
  log("shot", name);
};
const step = async (name, fn) => {
  try {
    const r = await fn();
    metrics.steps[name] = r ?? "ok";
  } catch (e) {
    metrics.steps[name] = { failed: String(e).slice(0, 400) };
    metrics.errors.push(`${name}: ${String(e).slice(0, 400)}`);
    log("STEP FAILED", name, String(e).slice(0, 300));
  }
};
const sleep = (ms) => page.waitForTimeout(ms);

// ---------- boot ----------
await page.goto(`${BASE}/?freshProject=1`, { waitUntil: "domcontentloaded", timeout: 120000 }).catch(() => {});
{
  const deadline = Date.now() + 300000;
  let booted = false;
  let lastReload = Date.now();
  while (Date.now() < deadline && !booted) {
    booted = await page.evaluate(() => {
      const host = document.querySelector("[data-testid=edit-canvas]");
      const c = host?.querySelector("canvas");
      const layer = document.querySelector("[data-testid=layer-event]");
      return Boolean(c && c.getBoundingClientRect().width > 200 && layer && layer.getClientRects().length > 0);
    }).catch(() => false);
    if (booted) break;
    if (Date.now() - lastReload > 45000) {
      log("reload (boot not visible yet)");
      await page.reload({ waitUntil: "domcontentloaded" }).catch(() => {});
      lastReload = Date.now();
    }
    await sleep(2000);
  }
  if (!booted) {
    await shot("00-boot-failure");
    console.log("PAGE_ERRORS", pageErrors.slice(0, 10));
    throw new Error("boot failed");
  }
  log("booted");
}
await sleep(2500);
await shot("00-editor-shell");

// ---------- inject stress event ----------
const inject = await page.evaluate(() => {
  const store = window.__oprnEditorStore;
  if (!store) return { ok: false, reason: "no store" };
  const project = store.getCurrent();
  const mapId = project.startMapId;
  const map = project.maps[mapId];
  if (!map) return { ok: false, reason: "no start map" };
  // harvest ids actually used in the project
  let switchId = null, variableId = null, itemIds = [], sprite = null, otherMapId = null;
  const walk = (cmds) => {
    for (const c of cmds ?? []) {
      if (!c || typeof c !== "object") continue;
      if (c.kind === "setSwitch" && !switchId) switchId = c.switchId;
      if (c.kind === "setVariable" && !variableId) variableId = c.variableId;
      if (c.kind === "shop" && itemIds.length === 0 && Array.isArray(c.itemIds)) itemIds = c.itemIds.slice(0, 4);
      if (c.kind === "fork") { if (c.condition?.kind === "switch" && !switchId) switchId = c.condition.switchId; walk(c.then); walk(c.else); }
      if (c.kind === "choices") for (const o of c.options ?? []) walk(o.branch);
    }
  };
  for (const m of Object.values(project.maps)) {
    if (m.id !== mapId && !otherMapId) otherMapId = m.id ?? null;
    for (const ev of m.events ?? []) {
      for (const p of ev.pages ?? []) { walk(p.commands); if (!sprite && p.graphic?.sprite) sprite = p.graphic.sprite; }
      walk(ev.commands);
    }
  }
  const mapIds = Object.keys(project.maps);
  if (!otherMapId) otherMapId = mapIds.find((id) => id !== mapId) ?? mapId;
  if (!switchId) switchId = Object.keys(project.database?.switches ?? {})[0] ?? "sw_1";
  if (!variableId) variableId = Object.keys(project.database?.variables ?? {})[0] ?? "var_1";
  if (itemIds.length === 0) itemIds = Object.keys(project.database?.items ?? {}).slice(0, 4);
  // free tile near the first event
  const taken = new Set((map.events ?? []).map((e) => `${e.x},${e.y}`));
  const anchor = map.events?.[0] ?? { x: 5, y: 5 };
  let x = anchor.x, y = anchor.y;
  for (let dx = 1; dx < 12; dx += 1) { if (!taken.has(`${anchor.x + dx},${anchor.y}`)) { x = anchor.x + dx; break; } }
  const graphic = sprite ? { sprite, direction: "down" } : {};
  const speaker = "대장장이 하몬";
  const ev = {
    id: "ev_ux_stress", x, y, trigger: { kind: "action" }, commands: [],
    pages: [
      {
        id: "p1", name: "첫 만남", conditions: [], graphic, trigger: { kind: "action" }, priority: "same",
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [
          { kind: "text", speaker, body: "어서 오게. 광산에서 캐 온 철광석이 있다면 내가 사 주지." },
          { kind: "choices", prompt: "무엇을 하겠나?", options: [
            { text: "철광석을 판다", branch: [
              { kind: "changeGold", op: "+=", amount: 120 },
              { kind: "text", speaker, body: "좋은 물건이군. 120G 를 주지." },
            ] },
            { text: "무기를 산다", branch: [ { kind: "shop", itemIds, allowSell: true } ] },
            { text: "그냥 구경한다", branch: [ { kind: "text", body: "하몬은 다시 망치를 들었다." } ] },
          ] },
          { kind: "fork", condition: { kind: "switch", switchId, value: true },
            then: [ { kind: "text", speaker, body: "축제 준비는 잘 되고 있나? 광장에 등불을 달아야 해." } ],
            else: [ { kind: "setSwitch", switchId, value: true }, { kind: "text", speaker, body: "다음에 오면 축제 이야기를 해 주지." } ] },
          { kind: "setVariable", variableId, op: "+=", value: 1 },
          { kind: "moveEvent", eventId: "ev_ux_stress", route: { moves: [ { kind: "move", dir: "left" }, { kind: "move", dir: "left" }, { kind: "turn", dir: "down" }, { kind: "wait" } ], repeat: false, wait: true } },
          { kind: "wait", ms: 600 },
          { kind: "transfer", mapId: otherMapId, x: 4, y: 6 },
        ],
      },
      {
        id: "p2", name: "축제 이후", conditions: [ { kind: "switch", switchId, value: true } ], graphic, trigger: { kind: "action" }, priority: "same",
        movement: { type: "random", speed: 3, frequency: 3 },
        commands: [ { kind: "text", speaker, body: "축제는 어땠나? 등불이 참 예뻤지." } ],
      },
      {
        id: "p3", name: "밤", conditions: [ { kind: "timePhase", phase: "night" } ], graphic, trigger: { kind: "action" }, priority: "same",
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [ { kind: "text", body: "하몬은 잠들어 있다." } ],
      },
    ],
  };
  try {
    store.update((draft) => { draft.maps[mapId].events.push(ev); });
  } catch (e) {
    return { ok: false, reason: String(e).slice(0, 300) };
  }
  return { ok: true, mapId, x, y, switchId, variableId, itemIds, otherMapId, eventCount: store.getCurrent().maps[mapId].events.length };
});
log("inject", JSON.stringify(inject));
metrics.inject = inject;
await sleep(800);

// ---------- open editor ----------
await page.getByTestId("layer-event").click();
await sleep(400);
const tool = page.locator('[data-testid="tool-event"]:visible').first();
if (await tool.count()) await tool.click();
await sleep(400);
const targetId = inject.ok ? "ev_ux_stress" : null;
let opened = false;
if (targetId) {
  const row = page.getByTestId(`event-list-row-${targetId}`);
  if (await row.count()) {
    await row.first().click();
    await sleep(400);
    const openBtn = page.getByTestId("event-editor-open");
    if (await openBtn.count()) { await openBtn.click(); opened = true; }
    else { await row.first().dblclick(); opened = true; }
  }
}
if (!opened) {
  const rows = page.locator('[data-testid^="event-list-row-"]');
  const n = await rows.count();
  log("fallback rows", n);
  if (n) { await rows.last().click(); await sleep(300); await page.getByTestId("event-editor-open").click(); opened = true; }
}
const modal = page.getByTestId("event-editor-modal");
await modal.waitFor({ state: "visible", timeout: 30000 });
await sleep(1200);
await shot("01-default");

// ---------- global metrics helper ----------
const measure = async (label) => {
  const m = await page.evaluate(() => {
    const root = document.querySelector("[data-testid=event-editor-modal] .event-editor-modal-window") ?? document.querySelector("[data-testid=event-editor-modal]");
    if (!root) return null;
    const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none" && el.closest("[hidden]") === null; };
    const rect = (sel) => { const el = root.querySelector(sel); if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
    const all = [...root.querySelectorAll("*")].filter(vis);
    const buttons = all.filter((e) => e.matches("button, [role=button]"));
    const inputs = all.filter((e) => e.matches("input, select, textarea"));
    const sig = (b) => { const cs = getComputedStyle(b); return [cs.backgroundColor, cs.color, cs.borderTopWidth + " " + cs.borderTopColor, cs.borderRadius, cs.fontSize, cs.fontWeight, Math.round(b.getBoundingClientRect().height)].join("|"); };
    const btnSigs = new Set(buttons.map(sig));
    const fontSizes = new Map();
    const textColors = new Map();
    const radii = new Map();
    let textNodes = 0, words = 0;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const n = walker.currentNode; const t = n.textContent.trim(); if (!t) continue; const p = n.parentElement; if (!p || !vis(p)) continue;
      textNodes += 1; words += t.split(/\s+/).length;
      const cs = getComputedStyle(p); fontSizes.set(cs.fontSize, (fontSizes.get(cs.fontSize) ?? 0) + 1); textColors.set(cs.color, (textColors.get(cs.color) ?? 0) + 1);
    }
    for (const e of all) { const r = getComputedStyle(e).borderRadius; if (r && r !== "0px") radii.set(r, (radii.get(r) ?? 0) + 1); }
    const clipped = all.filter((e) => { const cs = getComputedStyle(e); return e.children.length === 0 && e.textContent.trim() && (cs.textOverflow === "ellipsis" || cs.whiteSpace === "nowrap") && e.scrollWidth > e.clientWidth + 1; }).map((e) => ({ testid: e.dataset.testid ?? null, cls: String(e.className).slice(0, 50), text: e.textContent.trim().slice(0, 40), sw: e.scrollWidth, cw: e.clientWidth }));
    const emojiRe = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{1F000}-\u{1F2FF}]/u;
    const emojiButtons = buttons.filter((b) => emojiRe.test(b.textContent)).length;
    const emojiAny = all.filter((e) => e.children.length === 0 && emojiRe.test(e.textContent)).length;
    const svgIcons = all.filter((e) => e.matches("svg")).length;
    const focusables = all.filter((e) => e.matches("button, input, select, textarea, a[href], [tabindex]:not([tabindex='-1']), summary") && !e.disabled).length;
    // rules applying to a command row
    let rulesTotal = 0; const sheetsHit = new Set(); let eeRules = 0; const eeSheets = new Set();
    const rowEl = root.querySelector(".cmd-item .cmd-head") ?? root.querySelector(".cmd-item");
    for (const ss of document.styleSheets) {
      let rules; try { rules = ss.cssRules; } catch { continue; }
      const href = ss.href ?? (ss.ownerNode?.dataset?.viteDevId ?? "inline");
      const walkRules = (list) => { for (const r of list) { if (r.cssRules && r.type !== 1) { walkRules(r.cssRules); continue; } if (!r.selectorText) continue; if (r.selectorText.includes("event-editor") || r.selectorText.includes(".cmd-")) { eeRules += 1; eeSheets.add(href); } if (rowEl) { try { if (rowEl.matches(r.selectorText)) { rulesTotal += 1; sheetsHit.add(href); } } catch {} } } };
      walkRules(rules);
    }
    // contrast for hint/label texts
    const lum = (rgb) => { const m = rgb.match(/[\d.]+/g); if (!m) return null; const [r, g, b] = m.slice(0, 3).map((v) => { v = Number(v) / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
    const bgOf = (el) => { let n = el; while (n && n !== document.documentElement) { const bg = getComputedStyle(n).backgroundColor; if (bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent" && !/rgba\([^)]*, 0(\.\d+)?\)$/.test(bg)) return bg; n = n.parentElement; } return "rgb(255, 255, 255)"; };
    const ratio = (fg, bg) => { const a = lum(fg), b = lum(bg); if (a == null || b == null) return null; const [hi, lo] = a > b ? [a, b] : [b, a]; return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100; };
    const lowContrast = [];
    for (const e of all) { if (e.children.length > 0 || !e.textContent.trim()) continue; const cs = getComputedStyle(e); const fg = cs.color; const bg = bgOf(e); const r = ratio(fg, bg); if (r != null && r < 4.5) lowContrast.push({ text: e.textContent.trim().slice(0, 30), fg, bg, ratio: r, fontSize: cs.fontSize, cls: String(e.className).slice(0, 40) }); }
    const win = root.getBoundingClientRect();
    return {
      viewport: { w: innerWidth, h: innerHeight },
      window: { x: Math.round(win.x), y: Math.round(win.y), w: Math.round(win.width), h: Math.round(win.height) },
      header: rect(".event-editor-modal-header"), footer: rect(".event-editor-modal-footer"), toolbar: rect(".event-editor-command-toolbar"),
      settings: rect(".event-editor-settings-column"), commands: rect(".event-editor-commands-column"), inspector: rect(".event-editor-inspector-column"),
      viewToggle: rect("[data-testid=event-view-toggle]"), aiDock: rect("[data-testid=ai-event-assist]"),
      counts: { visibleElements: all.length, buttons: buttons.length, inputs: inputs.length, focusables, textNodes, words, svgIcons, emojiButtons, emojiTextNodes: emojiAny, details: all.filter((e) => e.matches("details")).length, distinctButtonStyles: btnSigs.size, distinctFontSizes: fontSizes.size, distinctTextColors: textColors.size, distinctRadii: radii.size },
      fontSizes: [...fontSizes.entries()].sort((a, b) => b[1] - a[1]), textColors: [...textColors.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12), radii: [...radii.entries()].sort((a, b) => b[1] - a[1]),
      buttonSignatures: [...btnSigs].slice(0, 40),
      clipped, lowContrast: lowContrast.slice(0, 40), lowContrastCount: lowContrast.length,
      css: { rulesMatchingCommandRow: rulesTotal, sheetsMatchingCommandRow: sheetsHit.size, eventEditorRules: eeRules, eventEditorSheets: eeSheets.size, totalSheets: document.styleSheets.length },
      buttonLabels: buttons.map((b) => (b.textContent.trim() || b.getAttribute("aria-label") || b.title || "").slice(0, 24)).filter(Boolean),
    };
  });
  metrics[label] = m;
  log("measured", label, m ? JSON.stringify(m.counts) : "null");
  return m;
};

await step("measure-default", () => measure("default"));

// ---------- views ----------
for (const mode of ["list", "storyboard", "preview", "flow"]) {
  await step(`view-${mode}`, async () => {
    await page.getByTestId(`event-view-toggle-${mode}`).click();
    await sleep(700);
    await shot(`02-view-${mode}`);
  });
}
await page.getByTestId("event-view-toggle-list").click().catch(() => {});
await sleep(500);
await step("measure-list", () => measure("list"));
await shot("02b-list-1440");

// ---------- inspector + edit dialogs ----------
const clickRow = async (kind) => {
  const row = page.locator(`[data-testid=event-editor-modal] [data-testid="event-command-${kind}"]`).first();
  await row.waitFor({ state: "visible", timeout: 5000 });
  await row.click();
  await sleep(500);
  return row;
};
await step("inspector", async () => {
  await clickRow("text");
  await shot("03-inspector-text");
});
const editShot = async (kind, name) => {
  const row = await clickRow(kind);
  await row.dblclick();
  const dlg = page.getByTestId("event-command-edit-dialog");
  await dlg.waitFor({ state: "visible", timeout: 8000 });
  await sleep(700);
  await shot(name);
  const r = await page.evaluate(() => {
    const d = document.querySelector("[data-testid=event-command-edit-dialog]"); if (!d) return null;
    const rc = d.getBoundingClientRect();
    const win = d.querySelector(".subdialog-window, .event-command-edit-window, [class*=window]") ?? d;
    const wr = win.getBoundingClientRect();
    return { backdrop: { w: Math.round(rc.width), h: Math.round(rc.height) }, window: { w: Math.round(wr.width), h: Math.round(wr.height) }, layers: document.querySelectorAll("[data-testid=event-editor-modal], [data-testid=event-command-edit-dialog], .subdialog-backdrop").length, buttons: [...d.querySelectorAll("button")].filter((b) => b.getClientRects().length).length, inputs: [...d.querySelectorAll("input,select,textarea")].filter((b) => b.getClientRects().length).length };
  });
  const cancel = page.getByTestId("event-command-edit-cancel");
  if (await cancel.count()) await cancel.click(); else await page.keyboard.press("Escape");
  await sleep(400);
  return r;
};
for (const [kind, name] of [["text", "04-edit-text"], ["choices", "05-edit-choices"], ["fork", "06-edit-fork"], ["moveEvent", "07-edit-moveroute"], ["transfer", "08-edit-transfer"], ["shop", "09-edit-shop"], ["setVariable", "09b-edit-setvariable"]]) {
  await step(`edit-${kind}`, () => editShot(kind, name));
}

// ---------- command picker ----------
await step("picker", async () => {
  await page.getByTestId("event-command-toolbar-add").click();
  const picker = page.getByTestId("event-command-picker");
  await picker.waitFor({ state: "visible", timeout: 8000 });
  await sleep(600);
  await shot("10-picker-tab1");
  const inventory = {};
  for (const tab of [1, 2, 3, 4]) {
    const t = page.getByTestId(`event-command-picker-tab-${tab}`);
    if (!(await t.count())) continue;
    await t.click(); await sleep(450);
    inventory[`tab${tab}`] = await page.evaluate(() => {
      const p = document.querySelector("[data-testid=event-command-picker]");
      const groups = [...p.querySelectorAll(".event-command-picker-group-heading")].map((g) => g.textContent.trim());
      const btns = [...p.querySelectorAll("button[data-testid^='command-picker-add-']")].filter((b) => b.getClientRects().length);
      const withIcon = btns.filter((b) => b.querySelector("svg, img")).length;
      const badges = btns.filter((b) => b.querySelector("[class*=badge], [class*=runtime]")).length;
      const pr = p.getBoundingClientRect();
      return { groups, buttons: btns.length, withIcon, badges, width: Math.round(pr.width), height: Math.round(pr.height), scrollH: p.querySelector("[class*=body], [class*=scroll]")?.scrollHeight ?? null };
    });
    if (tab > 1) await shot(`10-picker-tab${tab}`);
  }
  metrics.pickerInventory = inventory;
  await page.getByTestId("event-command-picker-tab-1").click().catch(() => {});
  await sleep(300);
  const grid = page.getByTestId("event-command-picker-view-toggle");
  if (await grid.count()) { await grid.click(); await sleep(500); await shot("11-picker-grid"); await grid.click(); await sleep(300); }
  const search = page.getByTestId("event-command-picker-search");
  if (await search.count()) { await search.fill("화면"); await sleep(600); await shot("12-picker-search"); await search.fill(""); }
  await page.getByTestId("event-command-picker-cancel").click();
  await sleep(400);
});

// ---------- rail groups ----------
const openRail = async (slug) => {
  const g = page.getByTestId(`evt-rail-group-${slug}`);
  await g.waitFor({ state: "visible", timeout: 5000 });
  const tag = await g.evaluate((e) => e.tagName + ":" + (e.open === undefined ? "" : String(e.open)));
  if (tag.startsWith("DETAILS")) { const isOpen = await g.evaluate((e) => e.open); if (!isOpen) await g.locator("summary").first().click(); }
  else await g.click();
  await sleep(600);
};
await step("rail-when", async () => {
  await openRail("when");
  await shot("13-rail-when");
  metrics.railWhen = await page.evaluate(() => {
    const col = document.querySelector(".event-editor-settings-column");
    const sheet = document.querySelector("[data-testid=event-condition-list]")?.closest("[class*=sheet], [class*=panel], section, div");
    const cr = col?.getBoundingClientRect();
    return { settingsW: cr ? Math.round(cr.width) : null, settingsScrollH: col?.scrollHeight ?? null, settingsClientH: col?.clientHeight ?? null, conditionListVisible: Boolean(document.querySelector("[data-testid=event-condition-list]")?.getClientRects().length), chips: [...document.querySelectorAll("[data-testid^=event-condition-chip-]")].map((c) => c.textContent.trim()), rows: document.querySelectorAll("[data-testid^=event-condition-row-]").length };
  });
});
await step("record-picker", async () => {
  // add a switch condition via chip, then open its picker
  const chip = page.locator("[data-testid^=event-condition-chip-]").filter({ hasText: /스위치/ }).first();
  if (await chip.count()) { await chip.click(); await sleep(500); }
  await shot("13b-rail-when-with-row");
  const trigger = page.locator("[data-testid^=event-condition-row-] button").first();
  if (await trigger.count()) {
    await trigger.click();
    await sleep(700);
    const search = page.getByTestId("event-record-picker-search");
    if (await search.count()) {
      await shot("14-record-picker");
      metrics.recordPicker = await page.evaluate(() => {
        const s = document.querySelector("[data-testid=event-record-picker-search]");
        const dlg = s?.closest("[role=dialog], .subdialog-window, [class*=dialog], [class*=picker]");
        const r = dlg?.getBoundingClientRect();
        return { w: r ? Math.round(r.width) : null, h: r ? Math.round(r.height) : null, rows: document.querySelectorAll("[data-testid^=event-record-picker-row-]").length, buttons: dlg ? [...dlg.querySelectorAll("button")].map((b) => b.textContent.trim()).filter(Boolean).slice(0, 12) : [] };
      });
      await page.keyboard.press("Escape");
      await sleep(400);
    } else {
      await shot("14-record-picker-unknown");
      await page.keyboard.press("Escape");
    }
  }
});
await step("pages", async () => {
  const seg2 = page.getByTestId("evt-page-segment-2");
  if (await seg2.count()) { await seg2.click(); await sleep(700); await shot("15-page2"); await page.getByTestId("evt-page-segment-1").click(); await sleep(500); }
  metrics.pageTabs = await page.evaluate(() => [...document.querySelectorAll("[data-testid^=evt-page-segment-]")].map((s) => ({ text: s.textContent.trim().slice(0, 40), w: Math.round(s.getBoundingClientRect().width) })));
});
await step("rail-look", async () => {
  await openRail("look-talk");
  await shot("16-rail-look");
  const g = page.getByTestId("event-page-graphic-control");
  if (await g.count()) {
    await g.first().click();
    await sleep(900);
    await shot("16b-graphic-dialog");
    await page.keyboard.press("Escape");
    await sleep(400);
  }
});
await step("rail-move-memory-npc", async () => {
  await openRail("move"); await shot("17-rail-move");
  await openRail("memory"); await shot("17b-rail-memory");
  await openRail("npc"); await shot("17c-rail-npc");
  metrics.railAllOpen = await page.evaluate(() => { const col = document.querySelector(".event-editor-settings-column"); return { scrollH: col?.scrollHeight, clientH: col?.clientHeight, groups: [...document.querySelectorAll("[data-testid^=evt-rail-group-]")].map((g) => ({ id: g.dataset.testid, open: g.open ?? null, h: Math.round(g.getBoundingClientRect().height) })) }; });
});

// ---------- AI dock ----------
await step("ai-dock", async () => {
  const dock = page.getByTestId("ai-event-assist");
  if (!(await dock.count())) return "no dock";
  await dock.evaluate((d) => { const det = d.tagName === "DETAILS" ? d : d.closest("details") ?? d.querySelector("details"); if (det) det.open = true; });
  await sleep(600);
  await dock.scrollIntoViewIfNeeded().catch(() => {});
  await shot("18-ai-dock");
  return await page.evaluate(() => { const d = document.querySelector("[data-testid=ai-event-assist]"); const r = d.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), text: d.innerText.replace(/\s+/g, " ").slice(0, 300) }; });
});

// ---------- context menu ----------
await step("context-menu", async () => {
  const row = page.locator('[data-testid=event-editor-modal] [data-testid="event-command-text"]').first();
  await row.click({ button: "right" });
  await sleep(500);
  await shot("19-context-menu");
  const items = await page.evaluate(() => [...document.querySelectorAll("[data-testid=event-command-context-menu] button, [data-testid=event-command-context-menu] [role=menuitem]")].map((b) => b.textContent.trim()));
  await page.keyboard.press("Escape");
  await sleep(300);
  return items;
});

// ---------- element crops ----------
await step("crops", async () => {
  const crop = async (sel, name) => { const el = page.locator(sel).first(); if (await el.count()) { await el.screenshot({ path: `${OUT}/${name}.png` }); log("crop", name); } };
  await crop(".event-editor-modal-header", "20-header");
  await crop(".event-editor-modal-footer", "21-footer");
  await crop(".event-editor-command-toolbar", "22-toolbar");
  await crop(".event-editor-settings-column", "23-settings-column");
  await crop(".event-editor-inspector-column", "24-inspector-column");
  await crop(".event-editor-commands-column", "24b-commands-column");
});

// ---------- fullscreen ----------
await step("fullscreen", async () => {
  const fs = page.getByTestId("event-editor-window-fullscreen");
  if (!(await fs.count())) return "no fullscreen button";
  await fs.click(); await sleep(700); await shot("25-fullscreen");
  const m = await measure("fullscreen");
  await fs.click(); await sleep(500);
  return m?.window;
});

// ---------- viewports ----------
for (const [w, h] of [[1280, 800], [1024, 768], [1920, 1080]]) {
  await step(`vp-${w}`, async () => {
    await page.setViewportSize({ width: w, height: h });
    await sleep(900);
    await shot(`26-vp${w}`);
    return (await measure(`vp${w}`))?.window;
  });
}
await page.setViewportSize({ width: 1440, height: 900 });
await sleep(500);

// ---------- close and shell after ----------
metrics.pageErrors = pageErrors.slice(0, 30);
writeFileSync(`${OUT}/metrics.json`, JSON.stringify(metrics, null, 2));
log("done; errors:", metrics.errors.length);
await browser.close();
