// Lane L2 devices: 다국어·영어 문구 (plan todo 17, clusters C-11..C-18).
// The capture box has no catalog on disk, so devices open surfaces through stable test ids and read
// the shipped en/ja catalog from the build itself (the lazily imported en-<hash>.js chunk).
// Every device returns measured counts; pass is a threshold on those counts.

const VIS = `
  const vis = (el) => { if (!el || el.nodeType !== 1) return false; const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return false;
    const s = getComputedStyle(el); return s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.02 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth; };
  const norm = (s) => String(s || '').replace(/\\s+/g, ' ').trim();
  const texts = (root) => { const out = []; if (!root) return out; const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) { const t = norm(n.data); if (t && vis(n.parentElement)) out.push(t); } return out; };
  const attrs = (root, names = ['aria-label', 'title', 'placeholder']) => { const out = []; if (!root) return out;
    for (const e of [root, ...root.querySelectorAll('*')]) { if (!vis(e)) continue; for (const a of names) { const v = e.getAttribute(a); if (v) out.push(norm(v)); } } return out; };
  const hangul = (list) => list.reduce((n, s) => n + (s.match(/[\\uac00-\\ud7a3]/g) || []).length, 0);
  const biggestDialog = () => [...document.querySelectorAll('[role=dialog]')].filter(vis).sort((a, b) => { const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect(); return rb.width * rb.height - ra.width * ra.height; })[0] || null;
`;
const pe = (page, body, arg = null) => page.evaluate(new Function('arg', `${VIS}\n${body}`), arg);
const READY = '[data-testid="toolbar-database"]';

async function reload(page) {
  await page.goto(page.url(), { waitUntil: 'load', timeout: 120_000 });
  await page.waitForSelector(READY, { timeout: 60_000 });
  await page.waitForTimeout(2500);
}
async function clickTid(page, tid, settle = 900) {
  await page.locator(`[data-testid="${tid}"]`).first().click({ timeout: 15_000 });
  await page.waitForTimeout(settle);
}
/** Click when the control exists; returns 1 when clicked, 0 when the build has no such control. */
async function tryClickTid(page, tid, settle = 900) {
  const loc = page.locator(`[data-testid="${tid}"]`).first();
  if (!(await loc.isVisible().catch(() => false))) return 0;
  await loc.click({ timeout: 15_000 });
  await page.waitForTimeout(settle);
  return 1;
}
async function clickText(page, re, settle = 1200) {
  const ok = await pe(page, `
    const re = new RegExp(arg);
    const el = [...document.querySelectorAll('[role=menuitem],button,[role=option],li,a')].filter(vis).filter((e) => re.test(norm(e.innerText)))
      .sort((a, b) => a.getBoundingClientRect().width * a.getBoundingClientRect().height - b.getBoundingClientRect().width * b.getBoundingClientRect().height)[0];
    if (!el) return null; el.setAttribute('data-l2-click', '1'); return norm(el.innerText);`, re);
  if (!ok) return null;
  await page.locator('[data-l2-click="1"]').first().click({ timeout: 10_000 });
  await page.evaluate(() => document.querySelector('[data-l2-click]')?.removeAttribute('data-l2-click'));
  await page.waitForTimeout(settle);
  return ok;
}

/** Load the shipped catalog chunk (assets/<lang>-<hash>.js) that the page imported at boot. */
async function shippedCatalog(page, lang) {
  return page.evaluate(async (lang) => {
    const url = performance.getEntriesByType('resource').map((e) => e.name).find((n) => new RegExp(`/assets/${lang}-[\\w-]+\\.js$`).test(n));
    if (!url) return null;
    const mod = await import(url);
    return mod.default ?? null;
  }, lang);
}

// test/i18n.test.ts pins this value verbatim (region-select help hint), so it keeps its dash.
const DASH_ALLOWED = new Set(['Select region \u2014 when you release: \u300cAI task\u300d, copy, erase, and \u300cSave as structure\u300d']);

// ---------------------------------------------------------------- C-14 sentence-case heuristic (same rule the fix applied)
const KEEP = new Set(`AI ID IDs HP MP TP SP NPC NPCs RPG JRPG OPRN Steam Google ChatGPT Gemini Codex OpenAI Claude Anthropic EasyRPG RPG2000 RPG2003 RM2000 RM2003 RM2K RM2K3 CC0 CC MIDI PNG GIF JSON URL API UI HUD LPC Ollama LiteLLM Windows Linux macOS Mac iOS Android SQLite Pi Lv XP EXP BGM BGS ME SE ESC Esc Ctrl Shift Alt Enter Space Tab Backspace Delete Home End PageUp PageDown F1 F2 F3 F4 F5 F6 F7 F8 F9 F10 F11 F12 Cmd Option OK Studio Electron Supabase GitHub Discord YouTube Twitter X Tiled Aseprite Beodeul Astra Horizon Joseon Baram Murim Sengoku Edo Kenney Tibo Slates Itch Wang Lua JavaScript TypeScript Python Node CSV TSV ZIP HTML CSS SVG WebGL GPU CPU FPS ASCII Unicode Korean English Japanese Chinese I I'm I'll I've A B C D E N S W NE NW SE SW Up Down Left Right Inspector Monday Tuesday Wednesday Thursday Friday Saturday Sunday January February March April May June July August September October November December Pokemon Pokémon Zelda Mother EarthBound Undertale Ys Dragon Quest Final Fantasy Chrono Trigger Mana Seiken Densetsu Nintendo Game Boy GBA SNES NES DS Switch MV MZ VX Ace XP2 Unity Godot GameMaker Pixel Fantasy Ren'Py Ren Py Steamworks DLC Bun Vite PWA Aooni Scarloxy Pok Mt Mr Mrs Dr St`.split(/\s+/));
function isLabel(v) {
  if (v.includes('Studio') || v.length > 48 || /[.!?]\s|[.!?]$|\n|:/.test(v)) return false;
  const words = v.split(/\s+/);
  return words.length >= 2 && words.length <= 6;
}
function titleWords(v) {
  const words = v.split(' ');
  const out = [];
  for (let i = 1; i < words.length; i++) {
    const w = words[i];
    const prev = words[i - 1];
    if (!/[A-Za-z0-9]/.test(prev) || /^["'\u201c\u2018]/.test(w) || /[·/|→([+&>«,]$|^[·/|→+&>]$/.test(prev) || /^[([«]/.test(w)) continue;
    const m = w.replace(/^[("'[<«]+/, '').match(/^[A-Za-z][A-Za-z'-]*/);
    if (!m) continue;
    const core = m[0];
    if (core[0] === core[0].toUpperCase() && core !== core.toUpperCase() && !KEEP.has(core) && !/\d/.test(core)) {
      if ((core.length > 1 && core.slice(1) === core.slice(1).toLowerCase()) || core.includes('-')) out.push(core);
    }
  }
  return out;
}

export const surfaces = {
  terms: { width: 1366, height: 768, lang: 'en', readySelector: READY },
  dash: { width: 1366, height: 768, lang: 'en', readySelector: READY },
  workshopEn: { width: 1366, height: 768, lang: 'en', readySelector: READY },
  mainJa: { width: 1366, height: 768, lang: 'ja', readySelector: READY },
  mainZh: { width: 1366, height: 768, lang: 'zh', readySelector: READY },
  dataNames: { width: 1366, height: 768, lang: 'en', readySelector: READY },
  plural: { width: 1366, height: 768, lang: 'en', readySelector: READY },
  typoKo: { width: 1440, height: 900, lang: 'ko', readySelector: READY },
  rail: { width: 1366, height: 768, lang: 'en', readySelector: READY },
  caseEn: { width: 1366, height: 768, lang: 'en', readySelector: READY },
};

export const devices = [
  // ---------------------------------------------------------------- C-13 terminology
  {
    id: 'L2-C13-terms',
    surface: 'terms',
    title: 'English names the AI settings tabs, tile passage directions, sound tabs, enemy list and world entry with one correct term each',
    async run({ page }) {
      const m = {};
      await clickTid(page, 'topbar-ai-settings', 1500);
      const ai = await pe(page, `const d = biggestDialog(); const t = texts(d);
        const bad = ['Link', 'Show', 'Verify link', 'Confirmation Failed'];
        return { aiTexts: t.length, aiForbidden: t.filter((s) => bad.includes(s)).length, aiSample: t.filter((s) => bad.includes(s)).slice(0, 6) };`);
      Object.assign(m, ai);
      await reload(page);
      await clickTid(page, 'selected-tile-props-open', 1500);
      const tile = await pe(page, `const d = biggestDialog(); const t = texts(d);
        const bad = ['High', 'Low', 'Upper right', 'All passed', 'Fully blocked'];
        const dirs = ['Up', 'Down', 'Left', 'Right'];
        return { tileTexts: t.length, tileForbidden: t.filter((s) => bad.includes(s)).length, tileDirections: t.filter((s) => dirs.includes(s)).length, tileSample: t.filter((s) => bad.includes(s)) };`);
      Object.assign(m, tile);
      await reload(page);
      await clickTid(page, 'menu-more-tools', 900);
      const musicItem = await clickText(page, '^Music');
      const music = await pe(page, `const d = biggestDialog(); const t = texts(d);
        return { musicTexts: t.length, musicForbidden: t.filter((s) => s === 'Audio' || s === 'SE' || / · Audio · /.test(s)).length, musicSample: t.filter((s) => s === 'Audio' || s === 'SE').slice(0, 4) };`);
      Object.assign(m, music, { musicItemFound: musicItem ? 1 : 0 });
      await reload(page);
      await clickTid(page, 'menu-more-tools', 900);
      const worldItem = await clickText(page, '^World', 2500);
      const world = await pe(page, `const w = [...document.querySelectorAll('.database-modal-window, [role=dialog]')].filter(vis)[0];
        const active = w ? [...w.querySelectorAll('[role=tab][aria-selected=true], [aria-current=page], [aria-current=true]')].filter(vis).map((e) => norm(e.innerText)).filter(Boolean) : [];
        const title = w ? norm((w.querySelector('h1, h2, [role=heading]') || {}).innerText || '') : '';
        return { worldActive: active, worldTitle: title, worldHead: w ? texts(w).slice(0, 8) : [] };`);
      const itemName = (worldItem || '').replace(/\s*Ctrl.*$/, '').trim();
      m.worldItem = itemName;
      m.worldActive = world.worldActive;
      m.worldHead = world.worldHead;
      m.worldNameMatches = itemName && (world.worldActive.includes(itemName) || world.worldTitle === itemName || world.worldHead.includes(itemName)) ? 1 : 0;
      await reload(page);
      await clickTid(page, 'toolbar-database', 1500);
      await clickTid(page, 'db-group-strip-battle', 700);
      await clickTid(page, 'db-tab-enemies', 1500);
      const enemy = await pe(page, `const w = [...document.querySelectorAll('.database-modal-window')].filter(vis)[0]; const t = texts(w);
        return { enemyTexts: t.length, enemyMonsterTerms: t.filter((s) => s === 'Monster' || /^Monster (resource|skills)$/.test(s)).length };`);
      Object.assign(m, enemy);
      const pass = m.aiTexts > 0 && m.aiForbidden === 0 && m.tileTexts > 0 && m.tileForbidden === 0 && m.tileDirections === 4 &&
        m.musicTexts > 0 && m.musicForbidden === 0 && m.worldNameMatches === 1 && m.enemyTexts > 0 && m.enemyMonsterTerms === 0;
      return { pass, measured: m };
    },
  },

  // ---------------------------------------------------------------- C-18 dashes in the en catalog
  {
    id: 'L2-C18-dash',
    surface: 'dash',
    title: 'The shipped English catalog uses no em or en dash as a separator',
    async run({ page }) {
      const cat = await shippedCatalog(page, 'en');
      if (!cat) return { pass: false, measured: { catalogLoaded: 0 } };
      const values = Object.values(cat);
      const withDash = values.filter((v) => /[\u2013\u2014]/.test(v) && !DASH_ALLOWED.has(v));
      const ui = await pe(page, `return attrs(document.body, ['aria-label']).filter((s) => / \\u2014 /.test(s) && !/[\\uac00-\\ud7a3]/.test(s)).length;`);
      return {
        pass: withDash.length === 0,
        measured: { catalogLoaded: 1, values: values.length, valuesWithDash: withDash.length, sample: withDash.slice(0, 5), englishAriaWithEmDash: ui },
      };
    },
  },

  // ---------------------------------------------------------------- C-15 fragment translation / missing keys
  {
    id: 'L2-C15-workshop-en',
    surface: 'workshopEn',
    title: 'The Workshop card in English has no Hangul and no "Yes:" mistranslation of 예:',
    async run({ page }) {
      await clickTid(page, 'sidebar-workshop', 1800);
      const m = await pe(page, `const root = document.querySelector('[data-testid="left-workshop-pane"]') || document.querySelector('[data-testid="editor-ai-sidebar"]');
        const t = texts(root); const a = attrs(root);
        const all = [...t, ...a];
        return { found: root ? 1 : 0, strings: all.length, hangulChars: hangul(all), yesColon: all.filter((s) => /^Yes:/.test(s)).length,
          sample: all.filter((s) => /[\\uac00-\\ud7a3]|^Yes:/.test(s)).slice(0, 8) };`);
      return { pass: m.found === 1 && m.strings > 5 && m.hangulChars === 0 && m.yesColon === 0, measured: m };
    },
  },
  {
    id: 'L2-C15-ja-joint',
    surface: 'mainJa',
    title: 'Japanese undo/redo log labels are whole sentences without a space before の',
    async run({ page }) {
      const m = await pe(page, `const a = attrs(document.body, ['aria-label', 'title']);
        const log = a.filter((s) => /の(記録|履歴)を展開/.test(s));
        return { logLabels: log.length, spacedJoint: log.filter((s) => / の(記録|履歴)/.test(s)).length, sample: log.slice(0, 4) };`);
      return { pass: m.logLabels > 0 && m.spacedJoint === 0, measured: m };
    },
  },
  {
    id: 'L2-C15-zh-studio',
    surface: 'mainZh',
    title: 'Chinese names the AI Studio button in Chinese like the other locales',
    async run({ page }) {
      const m = await pe(page, `const b = document.querySelector('[data-testid="topbar-ai-studio"]');
        const label = b ? norm(b.getAttribute('aria-label') || b.getAttribute('title') || '') : '';
        return { found: b ? 1 : 0, label, untranslated: /AI Studio/.test(label) ? 1 : 0, hangulChars: hangul([label]) };`);
      return { pass: m.found === 1 && m.untranslated === 0 && m.hangulChars === 0, measured: m };
    },
  },

  // ---------------------------------------------------------------- C-16 bundled data names
  {
    id: 'L2-C16-data-names',
    surface: 'dataNames',
    title: 'Bundled tile, tileset and default map names read in English in the palette, selected-tile strip and props header',
    async run({ page }) {
      const pal = await pe(page, `const root = document.querySelector('[data-testid="left-palette-root"]');
        const t = texts(root); const a = attrs(root, ['aria-label', 'title']);
        const strip = [...document.querySelectorAll('[data-testid^="selected-tile"], [data-testid="palette-tileset-name"]')].filter(vis);
        const st = strip.flatMap((e) => [norm(e.innerText), e.getAttribute('aria-label') || '', e.getAttribute('title') || '']).filter(Boolean);
        return { paletteStrings: t.length + a.length, paletteHangul: hangul([...t, ...a]), stripStrings: st.length, stripHangul: hangul(st),
          paletteSample: [...t, ...a].filter((s) => /[\\uac00-\\ud7a3]/.test(s)).slice(0, 6), stripSample: st.filter((s) => /[\\uac00-\\ud7a3]/.test(s)).slice(0, 3) };`);
      await clickTid(page, 'sidebar-props', 1500);
      const props = await pe(page, `const head = [...document.querySelectorAll('.left-props-head, .left-props-context')].filter(vis);
        const t = head.flatMap((e) => texts(e));
        const mapName = norm((document.querySelector('.left-props-map [translate="no"], .left-props-map') || {}).innerText || '').replace(/^Map:\\s*/, '');
        return { propsHeadStrings: t.length, propsHangul: hangul(t), propsMapName: mapName, propsSample: t.filter((s) => /[\\uac00-\\ud7a3]/.test(s)).slice(0, 4) };`);
      await clickTid(page, 'sidebar-maps', 1500);
      const maps = await pe(page, `const root = document.querySelector('[data-testid="left-map-root"]') || document.querySelector('[data-testid="editor-ai-sidebar"]');
        return { mapListHasEmptyMap: texts(root).includes('Empty map') ? 1 : 0 };`);
      const m = { ...pal, ...props, ...maps };
      m.mapNameConsistent = m.propsMapName === 'Empty map' && m.mapListHasEmptyMap === 1 ? 1 : 0;
      const pass = m.paletteStrings > 10 && m.paletteHangul === 0 && m.stripStrings > 0 && m.stripHangul === 0 &&
        m.propsHeadStrings > 0 && m.propsHangul === 0 && m.mapNameConsistent === 1;
      return { pass, measured: m };
    },
  },

  // ---------------------------------------------------------------- C-12 plurals
  {
    id: 'L2-C12-plural',
    surface: 'plural',
    title: 'A one-map project reads "1 map" / "1 item" (never "1 maps" / "1 items") in the review badge, progress, links and journey popover',
    async run({ page }) {
      const grab = (label) => pe(page, `const all = [...texts(document.body), ...attrs(document.body, ['aria-label', 'title'])];
        const bad = all.filter((s) => /\\b1 (maps|items|tabs|events|commits|cells|tiles)\\b|All 1 map/.test(s));
        const good = all.filter((s) => /\\b1 (map|item|tab|event|commit)\\b/.test(s));
        return { bad: bad.length, good: good.length, sample: bad.slice(0, 4), where: arg };`, label);
      const res = [await grab('main')];
      await clickTid(page, 'sidebar-progress', 1500);
      res.push(await grab('progress'));
      await clickTid(page, 'sidebar-links', 1500);
      res.push(await grab('links'));
      const toggle = page.locator('[data-testid="authoring-journey-toggle"]').first();
      if (await toggle.isVisible().catch(() => false)) {
        await toggle.click();
        await page.waitForTimeout(1200);
        res.push(await grab('journey'));
      }
      const bad = res.reduce((n, r) => n + r.bad, 0);
      const good = res.reduce((n, r) => n + r.good, 0);
      return { pass: bad === 0 && good > 0, measured: { pluralErrors: bad, singularForms: good, surfaces: res.length, detail: res } };
    },
  },

  // ---------------------------------------------------------------- C-17 typo in bundled tile names
  {
    id: 'L2-C17-seo-typo',
    surface: 'typoKo',
    title: 'Searching 흙길 in the palette shows no 「서으로」 tile names, and the shipped tileset JSON has none',
    async run({ page }) {
      const json = await page.evaluate(async () => {
        const url = performance.getEntriesByType('resource').map((e) => e.name).find((n) => /beodeulCityTileset-[\w-]+\.json$/.test(n));
        if (!url) return { jsonLoaded: 0 };
        const text = await (await fetch(url)).text();
        return { jsonLoaded: 1, jsonTypo: (text.match(/서으로/g) || []).length, jsonWest: (text.match(/서쪽으로 이어짐/g) || []).length };
      });
      const search = page.locator('[data-testid="palette-catalog-search"]').first();
      await search.click();
      await search.fill('농장 흙길');
      await page.waitForTimeout(2200);
      const pal = await pe(page, `const root = document.querySelector('[data-testid="left-palette-root"]');
        const all = [...texts(root), ...attrs(root, ['aria-label', 'title'])];
        return { paletteStrings: all.length, farmPathHits: all.filter((s) => /농장 흙길/.test(s)).length, paletteTypo: all.filter((s) => /서으로/.test(s)).length };`);
      const m = { ...json, ...pal };
      return { pass: m.jsonLoaded === 1 && m.jsonTypo === 0 && m.jsonWest > 0 && m.farmPathHits > 0 && m.paletteTypo === 0, measured: m };
    },
  },

  // ---------------------------------------------------------------- C-11 rail labels
  {
    id: 'L2-C11-rail',
    surface: 'rail',
    title: 'English left-rail labels are one line, unclipped, without soft hyphens or the developer word "Lint"; the command palette groups say Check',
    async run({ page }) {
      const rail = await pe(page, `const labels = [...document.querySelectorAll('.left-activity-bar .ai-chat-sidebar-tab-label')].filter(vis);
        const btns = [...document.querySelectorAll('.left-activity-bar button')].filter(vis);
        const lines = (el) => { const r = document.createRange(); r.selectNodeContents(el); return new Set([...r.getClientRects()].map((x) => Math.round(x.top))).size; };
        const rows = labels.map((l) => ({ t: l.textContent, lines: lines(l), over: l.scrollWidth - l.clientWidth }));
        return { labels: labels.length, softHyphens: rows.filter((r) => r.t.includes('\\u00ad')).length + btns.filter((b) => (b.getAttribute('aria-label') || '').includes('\\u00ad')).length,
          multiLine: rows.filter((r) => r.lines > 1).length, clipped: rows.filter((r) => r.over > 1).length,
          lint: rows.filter((r) => /lint/i.test(r.t)).length + btns.filter((b) => /lint/i.test(b.getAttribute('aria-label') || '')).length, rows };`);
      await page.keyboard.press('Control+k');
      await page.waitForTimeout(1200);
      const cmdk = await pe(page, `const d = biggestDialog() || document.body; const t = texts(d);
        return { paletteRows: t.length, paletteLint: t.filter((s) => /\\bLint\\b/i.test(s)).length };`);
      const m = { ...rail, ...cmdk };
      return { pass: m.labels >= 6 && m.softHyphens === 0 && m.multiLine === 0 && m.clipped === 0 && m.lint === 0 && m.paletteRows > 0 && m.paletteLint === 0, measured: m };
    },
  },

  // ---------------------------------------------------------------- C-14 sentence case
  {
    id: 'L2-C14-case',
    surface: 'caseEn',
    title: 'English short labels use sentence case: catalog Title Case count is 0, layer/zoom labels and database tabs agree',
    async run({ page }) {
      const cat = await shippedCatalog(page, 'en');
      if (!cat) return { pass: false, measured: { catalogLoaded: 0 } };
      const titled = Object.values(cat).filter((v) => typeof v === 'string' && isLabel(v) && titleWords(v).length > 0);
      const main = await pe(page, `return attrs(document.body, ['aria-label', 'title']).concat(texts(document.body));`);
      const mainTitled = [...new Set(main)].filter((s) => isLabelLike(s));
      function isLabelLike(s) { return /^(Event|Ground|Upper) Layer\b|^Zoom In\b/.test(s); }
      await clickTid(page, 'toolbar-database', 1500);
      const dbTabs = [];
      for (const g of ['story', 'battle', 'system']) {
        await tryClickTid(page, `db-group-strip-${g}`, 900);
        dbTabs.push(...(await pe(page, `return [...document.querySelectorAll('.database-modal-window [data-testid^="db-tab-"]')].filter(vis).map((e) => norm(e.innerText)).filter(Boolean);`)));
      }
      const dbTitled = [...new Set(dbTabs)].filter((s) => titleWords(s).length > 0);
      return {
        pass: titled.length === 0 && mainTitled.length === 0 && dbTabs.length > 5 && dbTitled.length === 0,
        measured: { catalogLoaded: 1, catalogTitleCase: titled.length, catalogSample: titled.slice(0, 6), mainTitleCase: mainTitled.length, mainSample: mainTitled.slice(0, 4), dbTabs: dbTabs.length, dbTitleCase: dbTitled.length, dbSample: dbTitled.slice(0, 6) },
      };
    },
  },
];

// ---------------------------------------------------------------- before/after pairs (devices/L2-pairs.mjs)
async function hoverTid(page, tid) {
  await page.locator(`[data-testid="${tid}"]`).first().hover();
  await page.waitForTimeout(1800);
}
export const pairs = {
  'C-13-ai-settings': { surface: 'terms', prepare: ({ page }) => clickTid(page, 'topbar-ai-settings', 1500) },
  'C-13-tile-props': { surface: 'terms', prepare: ({ page }) => clickTid(page, 'selected-tile-props-open', 1500) },
  'C-13-music': {
    surface: 'terms',
    prepare: async ({ page }) => {
      await clickTid(page, 'menu-more-tools', 900);
      await clickText(page, '^Music');
    },
  },
  'C-18-layer-tooltip': { surface: 'dash', prepare: ({ page }) => hoverTid(page, 'layer-lower') },
  'C-15-workshop': { surface: 'workshopEn', prepare: ({ page }) => clickTid(page, 'sidebar-workshop', 1800) },
  'C-15-ja-main': { surface: 'mainJa', prepare: async () => {} },
  'C-16-palette': { surface: 'dataNames', prepare: async () => {} },
  'C-16-props': { surface: 'dataNames', prepare: ({ page }) => clickTid(page, 'sidebar-props', 1500) },
  'C-12-progress': { surface: 'plural', prepare: ({ page }) => clickTid(page, 'sidebar-progress', 1500) },
  'C-12-links': { surface: 'plural', prepare: ({ page }) => clickTid(page, 'sidebar-links', 1500) },
  'C-17-farm-path': {
    surface: 'typoKo',
    prepare: async ({ page }) => {
      const search = page.locator('[data-testid="palette-catalog-search"]').first();
      await search.click();
      await search.fill('농장 흙길');
      await page.waitForTimeout(2200);
    },
  },
  'C-11-cmdk': {
    surface: 'rail',
    prepare: async ({ page }) => {
      await page.keyboard.press('Control+k');
      await page.waitForTimeout(1200);
    },
  },
  'C-14-db-system': {
    surface: 'caseEn',
    prepare: async ({ page }) => {
      await clickTid(page, 'toolbar-database', 1500);
      await clickTid(page, 'db-group-strip-system', 1200);
    },
  },
};
