// Fast structural probe of the editor top menubar + left sidebar per UI mode.
// Read-only: enumerates controls, does not click. Feeds audit-editor-menu-surface.mjs.
// Usage: node scripts/probe-editor-surface.mjs [base-url]
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = process.argv[2] ?? "http://127.0.0.1:9806";
const MODES = ["editor"];
const OUT_DIR = ".omo/evidence/menu-ia";

const browser = await chromium.launch();

async function probeMode(mode) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message)));
  await page.goto(`${BASE}/?blankProject=1`, { waitUntil: "networkidle", timeout: 90_000 });
  await page.locator(".oprn-menu-bar").waitFor({ state: "visible", timeout: 30_000 });

  const describe = (root) => `
    (() => {
      const host = document.querySelector(${JSON.stringify(root)});
      if (!host) return { missing: true };
      const nodes = [...host.querySelectorAll('button,[role=menuitem],[role=tab],a[href],input,select')];
      return {
        missing: false,
        count: nodes.length,
        items: nodes.map((n) => ({
          testid: n.dataset?.testid ?? null,
          tag: n.tagName,
          label: (n.getAttribute('aria-label') || n.textContent || n.title || '').trim().slice(0, 60),
          title: (n.title || '').trim().slice(0, 80),
          disabled: n.disabled === true || n.getAttribute('aria-disabled') === 'true',
          visible: n.getBoundingClientRect().width > 0 && n.getBoundingClientRect().height > 0,
          cls: n.className?.toString?.().slice(0, 90) ?? '',
        })),
      };
    })()`;

  const surfaces = {};
  for (const [name, sel] of Object.entries({
    menubar: ".oprn-menu-bar",
    classicToolbar: ".oprn-toolbar",
    leftPanel: ".left-panel",
  })) {
    surfaces[name] = await page.evaluate(describe(sel));
  }

  // Open each top menu and enumerate its popup commands.
  const menuIds = await page.evaluate(
    `[...document.querySelectorAll('.oprn-menu-bar [data-testid^="menu-"]')].map((n) => n.dataset.testid)`
  );
  const menus = {};
  for (const id of menuIds) {
    await page.click(`[data-testid="${id}"]`);
    const popupSel = `[data-testid="menu-popup-${id.replace(/^menu-/, "")}"]`;
    const found = await page.locator(popupSel).count();
    menus[id] = found
      ? await page.evaluate(describe(popupSel))
      : { missing: true, note: "popup not found" };
    await page.keyboard.press("Escape");
  }

  // Left panel outer structure (which roots exist, and their geometry).
  const layout = await page.evaluate(`
    (() => {
      const pick = (sel) => {
        const n = document.querySelector(sel);
        if (!n) return null;
        const r = n.getBoundingClientRect();
        return { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x), testid: n.dataset?.testid ?? null };
      };
      return {
        bodyClass: document.body.className,
        leftPanel: pick('.left-panel'),
        drawerTabs: pick('[data-testid="left-drawer-tabs"]'),
        mapRoot: pick('[data-testid="left-map-root"]'),
        paletteRoot: pick('[data-testid="left-palette-root"]'),
        workspaceBar: pick('.workspace-bar'),
      };
    })()`);

  await context.close();
  return { mode, layout, surfaces, menus, errors };
}

const results = await Promise.all(MODES.map(probeMode));
await browser.close();

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(`${OUT_DIR}/surface-probe.json`, JSON.stringify(results, null, 2));

for (const r of results) {
  console.log(`\n########## MODE=${r.mode}  errors=${r.errors.length}`);
  console.log("layout:", JSON.stringify(r.layout));
  for (const [name, s] of Object.entries(r.surfaces)) {
    if (s.missing) {
      console.log(`  [${name}] MISSING`);
      continue;
    }
    console.log(`  [${name}] ${s.count} controls`);
    for (const it of s.items) {
      console.log(
        `     ${it.visible ? "v" : "-"}${it.disabled ? "D" : " "} ${it.testid ?? "(no-testid)"} :: ${it.label}`
      );
    }
  }
  for (const [id, m] of Object.entries(r.menus)) {
    if (m.missing) {
      console.log(`  [popup ${id}] ${m.note ?? "MISSING"}`);
      continue;
    }
    console.log(`  [popup ${id}] ${m.count} commands`);
    for (const it of m.items) {
      console.log(`     ${it.disabled ? "D" : " "} ${it.testid} :: ${it.label}`);
    }
  }
}
console.log(`\nPROBE_SAVED=${OUT_DIR}/surface-probe.json`);
