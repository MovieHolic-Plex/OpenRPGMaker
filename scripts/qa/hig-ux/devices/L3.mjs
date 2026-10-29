// Lane L3 devices: editor shell (top bar, project/help menus, command palette, map/event search,
// music dialog, resource manager, identity/history popovers, editor guide, interview dialogs).
// Every device opens the surface through data-testid hooks that exist on the frozen baseline and on
// the lane head, and asserts measured numbers on L3-owned surfaces only.
// The wave-0 rows owned by L3 (IS-003, IS-009, IS-036, IS-051, C-114) are re-exported from wave0.mjs
// unchanged; their wave-0 measurement is the baseline-fail proof.
// C-120 (top-bar tooltip text) and C-112 (rejected by the judge) have no device here: see L3-notes.
import { devices as wave0Devices, surfaces as wave0Surfaces } from './wave0.mjs';

const VIS = `
  const vis = (el) => { if (!el || el.nodeType !== 1) return false; const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return false;
    const s = getComputedStyle(el); return s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.02 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth; };
  const textOf = (el) => (el.innerText || '').replace(/\\s+/g, ' ').trim();
  const nameOf = (el) => (el.getAttribute('aria-label') || el.innerText || el.getAttribute('title') || el.value || '').replace(/\\s+/g, ' ').trim();
  const accentRgb = () => { const p = document.createElement('div'); p.style.cssText = 'position:fixed;left:-9px;top:-9px;width:1px;height:1px;background:var(--accent)'; document.body.append(p); const c = getComputedStyle(p).backgroundColor; p.remove(); return c; };
  const leaves = (root) => [...root.querySelectorAll('*')].filter((e) => vis(e) && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()));
  const stripeOf = (el, pseudo) => { const s = getComputedStyle(el, pseudo || null);
    if (pseudo) { if (s.content === 'none' || s.display === 'none') return 0; const bg = s.backgroundColor; const w = parseFloat(s.width) || 0, h = parseFloat(s.height) || 0;
      return /rgba\\(0, 0, 0, 0\\)|transparent/.test(bg) ? 0 : (w <= 6 && h > w * 2 ? w : h <= 6 && w > h * 2 ? h : 0); }
    const bl = s.borderLeftStyle !== 'none' ? parseFloat(s.borderLeftWidth) || 0 : 0; const br = s.borderRightStyle !== 'none' ? parseFloat(s.borderRightWidth) || 0 : 0;
    const bt = s.borderTopStyle !== 'none' ? parseFloat(s.borderTopWidth) || 0 : 0;
    const inset = [...(s.boxShadow === 'none' ? '' : s.boxShadow).matchAll(/inset[^,]*?(-?[\\d.]+)px (-?[\\d.]+)px/g)].concat([...(s.boxShadow === 'none' ? '' : s.boxShadow).matchAll(/(-?[\\d.]+)px (-?[\\d.]+)px[^,]*inset/g)]).map((m) => Math.max(Math.abs(parseFloat(m[1])), Math.abs(parseFloat(m[2])))).filter((v) => v >= 2);
    const sides = [bl, br, bt].filter((v) => v >= 2); const uneven = sides.length && Math.max(bl, br, bt) - Math.min(bl, br, bt) >= 1 ? Math.max(...sides) : 0;
    return Math.max(uneven, ...inset, 0); };
`;
const pe = (page, body, arg = null) => page.evaluate(new Function('arg', `${VIS}\n${body}`), arg);
const wait = (page, ms) => page.waitForTimeout(ms);
/** Click a control through the DOM (works even when another control sits on top of it at narrow widths). */
async function domClick(page, testid, settle = 900) {
  const ok = await pe(page, `const e = [...document.querySelectorAll('[data-testid="' + arg + '"]')][0]; if (!e) return 0; e.click(); return 1;`, testid);
  if (!ok) throw new Error(`no [data-testid=${testid}]`);
  await wait(page, settle);
}
async function closeLayers(page) {
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('Escape');
    await wait(page, 300);
  }
}

const TOPBAR_MEASURE = `
  const bar = document.querySelector('.oprn-menu-bar');
  const btns = [...bar.querySelectorAll('button,[role=button]')].filter(vis);
  let overlapPairs = 0; const samples = [];
  for (let i = 0; i < btns.length; i++) for (let j = i + 1; j < btns.length; j++) { const a = btns[i], b = btns[j]; if (a.contains(b) || b.contains(a)) continue;
    const r = a.getBoundingClientRect(), s = b.getBoundingClientRect(); const w = Math.min(r.right, s.right) - Math.max(r.left, s.left), h = Math.min(r.bottom, s.bottom) - Math.max(r.top, s.top);
    if (w > 0.5 && h > 0.5) { overlapPairs++; if (samples.length < 4) samples.push(nameOf(a).slice(0, 16) + ' x ' + nameOf(b).slice(0, 16)); } }
  const hit = (el) => { if (!el || !vis(el)) return -1; const r = el.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height / 2; if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) return -1; const h = document.elementFromPoint(x, y); return h && (h === el || el.contains(h)) ? 1 : 0; };
  const more = bar.querySelector('[data-testid="menu-more-tools"]');
  const fullscreen = bar.querySelector('[data-testid="window-fullscreen"]');
  return { buttons: btns.length, overlapPairs, samples, overflowVisible: more && vis(more) ? 1 : 0, overflowHit: hit(more), eventHit: hit(bar.querySelector('[data-testid="layer-event"]')), fullscreenHit: hit(fullscreen) };`;

export const surfaces = {
  ...Object.fromEntries(['topbar683', 'main1024', 'labels', 'guide'].map((k) => [k, wave0Surfaces[k]])),
  c19: { width: 683, height: 427, lang: 'ko' },
  shell: { width: 1440, height: 900, lang: 'ko' },
  shellEn: { width: 1440, height: 900, lang: 'en' },
  cmdk3: { width: 1440, height: 900, lang: 'ko' },
  find: { width: 1440, height: 900, lang: 'ko' },
  music: { width: 1440, height: 900, lang: 'ko' },
  assets: { width: 1440, height: 900, lang: 'ko' },
  identity: { width: 1440, height: 900, lang: 'ko' },
  helpEn: { width: 1366, height: 768, lang: 'en' },
  interview: { width: 1440, height: 900, lang: 'ko' },
};

async function layerGroupMeasure(page) {
  return pe(page, `
    const group = document.querySelector('.oprn-menu-bar [data-testid="left-layer-switcher"]');
    if (!group) return { groupFound: 0 };
    const radios = [...group.querySelectorAll('[role=radio]')].filter(vis);
    const relief = document.querySelector('.oprn-menu-bar [data-testid="layer-relief"]');
    const layerBtns = [...group.querySelectorAll('[data-testid^="layer-"]')].filter(vis);
    let nameMismatch = 0; const names = [];
    for (const b of layerBtns) { const visible = textOf(b.querySelector('.left-layer-btn-label') || b); const acc = (b.getAttribute('aria-label') || b.textContent || '').replace(/\\s+/g, ' ').trim();
      names.push(visible + '|' + acc); if (!visible || !acc.startsWith(visible)) nameMismatch++; }
    const heights = layerBtns.concat(relief && vis(relief) ? [relief] : []).map((b) => b.getBoundingClientRect().height);
    return { groupFound: 1, groupIsRadiogroup: group.getAttribute('role') === 'radiogroup' ? 1 : 0, radios: radios.length, reliefInGroup: relief && group.contains(relief) ? 1 : 0, reliefVisible: relief && vis(relief) ? 1 : 0,
      nameMismatch, minHeightPx: Math.round(Math.min(...heights)), names: names.slice(0, 5) };`);
}

const c21 = (surface) => ({
  id: surface === 'shell' ? 'C-21' : 'C-21-en',
  surface,
  title: 'Layer segment holds only the three layers as a radiogroup; 지형 붓 sits outside; names start with the visible text; 32 px tall',
  async run({ page }) {
    const m = await layerGroupMeasure(page);
    return { pass: m.groupFound === 1 && m.groupIsRadiogroup === 1 && m.radios === 3 && m.reliefInGroup === 0 && m.reliefVisible === 1 && m.nameMismatch === 0 && m.minHeightPx >= 32, measured: m };
  },
});

async function openPalette(page) {
  await page.keyboard.press('Control+K');
  await wait(page, 800);
  const ok = await pe(page, `const i = document.querySelector('[data-testid="command-palette-search"]'); return i && vis(i) ? 1 : 0;`);
  if (!ok) throw new Error('command palette did not open');
}
async function paletteQuery(page, q) {
  await page.locator('[data-testid="command-palette-search"]').fill(q);
  await wait(page, 400);
  return pe(page, `const opts = [...document.querySelectorAll('[data-testid="command-palette"] [role=option]')].filter(vis);
    return { all: opts.length, commands: opts.filter((o) => /^command-palette-item-(command|map)-/.test(o.dataset.testid || '')).length, labels: opts.slice(0, 6).map((o) => textOf(o).slice(0, 30)) };`);
}

async function openHelpFromMenu(page) {
  await domClick(page, 'menu-help', 700);
  await domClick(page, 'menu-help-shortcuts', 1600);
  const ok = await pe(page, `const d = document.querySelector('[data-testid="help-modal"]'); return d && vis(d.querySelector('[role=dialog]')) ? 1 : 0;`);
  if (!ok) throw new Error('editor guide did not open');
}

/** Rule scan of CSS reachable from the build (entry + lazy chunks): one-side stripes on interview dialog selectors. */
async function interviewStripeScan(baseUrl) {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const html = await (await fetch(`${base}?freshProject=1&aiBridge=0`)).text();
  const queue = [...html.matchAll(/(?:src|href)="\/?(assets\/[^"]+\.(?:js|css))"/g)].map((m) => m[1]);
  const seen = new Set();
  const css = [];
  while (queue.length && seen.size < 1500) {
    const f = queue.shift();
    if (seen.has(f)) continue;
    seen.add(f);
    const res = await fetch(base + f);
    if (!res.ok) continue;
    const text = await res.text();
    if (f.endsWith('.css')) {
      css.push({ f, text });
      continue;
    }
    for (const m of text.matchAll(/assets\/[A-Za-z0-9_.-]+\.(?:js|css)/g)) if (!seen.has(m[0])) queue.push(m[0]);
    // Chunks import their siblings relatively ("./name-hash.js").
    for (const m of text.matchAll(/["'`]\.\/([A-Za-z0-9_.-]+\.(?:js|css))["'`]/g)) if (!seen.has(`assets/${m[1]}`)) queue.push(`assets/${m[1]}`);
  }
  const rules = [];
  for (const { f, text } of css) {
    if (!/\.ci-button|\.ci-input|project-interview-receipt/.test(text)) continue;
    for (const m of text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const sel = m[1].trim();
      if (!/\.ci-|project-interview|cinematic-interview/.test(sel)) continue;
      const body = m[2];
      const insetStripe = /inset\s+([2-9]|\d{2,})px\s+0(px)?\s+0/.test(body) || /inset\s+-([2-9]|\d{2,})px\s+0/.test(body);
      const sideBorder = /border-(left|right)\s*:\s*([2-9]|\d{2,})px\s+solid/.test(body) || /border-(left|right)-width\s*:\s*([2-9]|\d{2,})px/.test(body);
      if (insetStripe || sideBorder) rules.push(`${f.split('/').pop()}: ${sel.slice(0, 60)}`);
    }
  }
  return { filesScanned: seen.size, cssFiles: css.length, interviewCssFound: css.some((c) => /\.ci-button/.test(c.text)) ? 1 : 0, stripeRules: rules.length, samples: rules.slice(0, 8) };
}

export const devices = [
  // ---------------------------------------------------------------- C-19 top bar overflow (P0/P1)
  {
    id: 'C-19',
    surface: 'c19',
    title: 'At 683x427, 900x600 and 512x320 visible top-bar buttons never overlap, the overflow button is hit-testable, 전체화면 stays reachable at 900, and clicking 이벤트 selects the layer',
    async run({ page }) {
      const m = {};
      for (const [w, h] of [[900, 600], [512, 320], [683, 427]]) {
        await page.setViewportSize({ width: w, height: h });
        await wait(page, 1500);
        const r = await pe(page, TOPBAR_MEASURE);
        m[`w${w}_overlapPairs`] = r.overlapPairs;
        m[`w${w}_overflowVisible`] = r.overflowVisible;
        m[`w${w}_overflowHit`] = r.overflowHit;
        m[`w${w}_eventHit`] = r.eventHit;
        if (r.samples.length) m[`w${w}_samples`] = r.samples;
        if (w === 900) {
          let inMenu = 0;
          if (r.overflowVisible) {
            await domClick(page, 'menu-more-tools', 700);
            inMenu = await pe(page, `return [...document.querySelectorAll('[role=menu] [role^=menuitem]')].filter(vis).some((i) => textOf(i).startsWith('전체화면')) ? 1 : 0;`);
            await closeLayers(page);
          }
          m.w900_fullscreenReachable = r.fullscreenHit === 1 || inMenu === 1 ? 1 : 0;
        }
      }
      // Real click on the centre of 이벤트 at 683: the layer must switch and no play window may open.
      const target = await pe(page, `const b = document.querySelector('.oprn-menu-bar [data-testid="layer-event"]'); if (!b || !vis(b)) return null; b.scrollIntoView({ block: 'nearest', inline: 'nearest' }); const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 };`);
      if (target) {
        await page.mouse.click(target.x, target.y);
        await wait(page, 1200);
      }
      const after = await pe(page, `const b = document.querySelector('.oprn-menu-bar [data-testid="layer-event"]');
        return { eventActive: b && (b.classList.contains('is-active') || b.getAttribute('aria-checked') === 'true') ? 1 : 0, playOpen: document.querySelector('.test-play-modal-backdrop, [data-testid*="battle-test"][role=dialog]') ? 1 : 0 };`);
      m.w683_eventClickSelects = target ? after.eventActive : 0;
      m.w683_playOpenedByLayerClick = after.playOpen;
      const narrow = [900, 512, 683];
      const pass =
        narrow.every((w) => m[`w${w}_overlapPairs`] === 0) &&
        [512, 683].every((w) => m[`w${w}_overflowVisible`] === 1 && m[`w${w}_overflowHit`] === 1) &&
        narrow.every((w) => m[`w${w}_eventHit`] !== 0) &&
        m.w900_fullscreenReachable === 1 &&
        m.w683_eventClickSelects === 1 &&
        m.w683_playOpenedByLayerClick === 0;
      return { pass, measured: m };
    },
  },

  // ---------------------------------------------------------------- C-20 accent fills and glyph icons (1440)
  {
    id: 'C-20',
    surface: 'shell',
    title: 'At most one accent-filled control in the top bar; no ✦/▶ glyph text in top-bar buttons; studio named AI; random battle icon differs from the walk-encounter icon',
    async run({ page }) {
      const m = await pe(page, `
        const accent = accentRgb(); const bar = document.querySelector('.oprn-menu-bar');
        const fills = [...bar.querySelectorAll('*')].filter(vis).filter((e) => getComputedStyle(e).backgroundColor === accent);
        const glyph = [...bar.querySelectorAll('button')].filter(vis).filter((b) => /[\\u2726\\u25B6\\u25B7\\u2610\\u2694]/.test(b.textContent || ''));
        const studio = bar.querySelector('[data-testid="topbar-ai-studio"]');
        const battle = bar.querySelector('[data-testid="topbar-battle-test"] svg'); const walk = document.querySelector('[data-testid="walk-encounter-list-open"] svg');
        return { accentFills: fills.length, accentSamples: fills.slice(0, 4).map((e) => (e.getAttribute('data-testid') || e.className || e.tagName).toString().slice(0, 30)),
          glyphButtons: glyph.length, glyphSamples: glyph.slice(0, 4).map((b) => (b.textContent || '').trim().slice(0, 12)),
          studioNamedAi: studio && /AI/.test(studio.getAttribute('aria-label') || '') ? 1 : 0,
          battleIconSameAsWalk: battle && walk ? (battle.innerHTML === walk.innerHTML ? 1 : 0) : -1 };`);
      return { pass: m.accentFills <= 1 && m.glyphButtons === 0 && m.studioNamedAi === 1 && m.battleIconSameAsWalk !== 1, measured: m };
    },
  },

  // ---------------------------------------------------------------- C-21 layer segment (ko, en, ja)
  c21('shell'),
  c21('shellEn'),

  // ---------------------------------------------------------------- C-22 project/help menus
  {
    id: 'C-22',
    surface: 'shell',
    title: 'Project menu: trigger differs from the first item, has 저장 with its shortcut in <kbd>; help menu splits 단축키 and the guide',
    async run({ page }) {
      await domClick(page, 'menu-project', 800);
      const p = await pe(page, `
        const trigger = document.querySelector('[data-testid="menu-project"]'); const tText = textOf(trigger.querySelector('.oprn-menu-item-label') || trigger);
        const items = [...document.querySelectorAll('[data-testid="menu-popup-project"] [role^=menuitem]')].filter(vis);
        const label = (i) => textOf(i.querySelector('.oprn-menu-command-label') || i);
        return { triggerText: tText, firstItem: items[0] ? label(items[0]) : '', items: items.length,
          hasSave: items.some((i) => /^저장(\\s|$|…)/.test(label(i))) ? 1 : 0, kbdItems: items.filter((i) => i.querySelector('kbd')).length,
          over24: items.filter((i) => label(i).length > 24).length };`);
      await closeLayers(page);
      await domClick(page, 'menu-help', 800);
      const h = await pe(page, `
        const items = [...document.querySelectorAll('[data-testid="menu-popup-help"] [role^=menuitem]')].filter(vis).map((i) => textOf(i.querySelector('.oprn-menu-command-label') || i));
        const shortcuts = items.filter((t) => /단축키/.test(t)); const guide = items.filter((t) => /가이드|도움말/.test(t) && !/단축키/.test(t));
        return { helpItems: items.length, shortcutOnlyItems: shortcuts.filter((t) => !/도움말|가이드/.test(t)).length, guideItems: guide.length };`);
      await closeLayers(page);
      const m = { ...p, triggerEqualsFirst: p.triggerText === p.firstItem ? 1 : 0, ...h };
      return { pass: m.triggerEqualsFirst === 0 && m.hasSave === 1 && m.kbdItems >= 1 && m.over24 === 0 && m.shortcutOnlyItems >= 1 && m.guideItems >= 1, measured: m };
    },
  },

  // ---------------------------------------------------------------- C-23 language control
  {
    id: 'C-23',
    surface: 'shell',
    title: 'A control named 언어/Language is directly visible in the top bar and lists the languages; the 세계관 tool no longer uses the language globe',
    async run({ page }) {
      const m = await pe(page, `
        const bar = document.querySelector('.oprn-menu-bar');
        const lang = [...bar.querySelectorAll('button')].filter(vis).filter((b) => /^(언어|Language)/.test((b.getAttribute('aria-label') || '').trim()));
        const world = bar.querySelector('[data-testid="toolbar-world"] svg'); const langSvg = lang[0] && lang[0].querySelector('svg');
        if (lang[0]) lang[0].setAttribute('data-l3-lang', '1');
        return { languageControls: lang.length, worldSharesLanguageIcon: world && langSvg ? (world.innerHTML === langSvg.innerHTML ? 1 : 0) : -1 };`);
      let options = 0;
      if (m.languageControls) {
        await pe(page, `document.querySelector('[data-l3-lang="1"]').click();`);
        await wait(page, 700);
        options = await pe(page, `return [...document.querySelectorAll('[role=menu] [role=menuitemradio]')].filter(vis).length;`);
        await closeLayers(page);
      }
      m.languageOptions = options;
      return { pass: m.languageControls >= 1 && m.languageOptions >= 4 && m.worldSharesLanguageIcon === 0, measured: m };
    },
  },

  // ---------------------------------------------------------------- C-113 F5/F6 are left to the browser
  {
    id: 'C-113',
    surface: 'shell',
    title: 'F5/F6 do not switch layers (browser keys); Shift+1..3 switch layers instead',
    async run({ page }) {
      const active = () => pe(page, `const b = document.querySelector('.oprn-menu-bar [data-testid^="layer-"].is-active:not([data-testid="layer-relief"])'); return b ? b.dataset.testid : '';`);
      const send = (code, key, shiftKey = false) =>
        pe(page, `document.body.focus(); const e = new KeyboardEvent('keydown', { code: arg.code, key: arg.key, shiftKey: arg.shiftKey, bubbles: true, cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented ? 1 : 0;`, { code, key, shiftKey });
      const start = await active();
      await send('F6', 'F6');
      await wait(page, 500);
      const afterF6 = await active();
      await send('F5', 'F5');
      await wait(page, 500);
      const afterF5 = await active();
      await send('Digit2', '@', true);
      await wait(page, 500);
      const afterShift2 = await active();
      await send('Digit1', '!', true);
      await wait(page, 500);
      const afterShift1 = await active();
      const m = { startLayer: start, afterF6, afterF5, afterShift2, afterShift1,
        f6SwitchedLayer: afterF6 !== start ? 1 : 0, f5SwitchedLayer: afterF5 !== afterF6 ? 1 : 0,
        shift2SelectsUpper: afterShift2 === 'layer-upper' ? 1 : 0, shift1SelectsLower: afterShift1 === 'layer-lower' ? 1 : 0 };
      return { pass: m.f6SwitchedLayer === 0 && m.f5SwitchedLayer === 0 && m.shift2SelectsUpper === 1 && m.shift1SelectsLower === 1, measured: m };
    },
  },

  // ---------------------------------------------------------------- C-24 / C-116 / C-110 command palette
  {
    id: 'C-24',
    surface: 'cmdk3',
    title: 'Palette finds 크기, BGM, 맵 설정; 자료집 is one command; rows carry no repeated category meta, no row rules, no upper-case group titles; 이벤트 layer declares its shortcut',
    async run({ page }) {
      await openPalette(page);
      const style = await pe(page, `const items = [...document.querySelectorAll('[data-testid="command-palette"] .command-palette-item')].filter(vis);
        const desc = [...document.querySelectorAll('[data-testid="command-palette"] .command-palette-item-desc')].filter(vis).map(textOf);
        const groups = [...document.querySelectorAll('[data-testid="command-palette"] .command-palette-group')].filter(vis);
        return { rows: items.length, repeatedMeta: desc.filter((t) => ['화면', '이동', '도구', '레이어'].includes(t)).length,
          rowRules: items.filter((i) => parseFloat(getComputedStyle(i).borderBottomWidth) > 0).length,
          upperGroups: groups.filter((g) => getComputedStyle(g).textTransform === 'uppercase').length };`);
      const size = await paletteQuery(page, '크기');
      const bgm = await paletteQuery(page, 'BGM');
      const mapSettings = await paletteQuery(page, '맵 설정');
      const db = await paletteQuery(page, '자료집');
      await closeLayers(page);
      const key = await pe(page, `const b = document.querySelector('.oprn-menu-bar [data-testid="layer-event"]'); return b && (b.getAttribute('aria-keyshortcuts') || '').trim() ? 1 : 0;`);
      const m = { ...style, sizeResults: size.commands, bgmResults: bgm.commands, mapSettingsResults: mapSettings.commands, databaseResults: db.commands, databaseLabels: db.labels, eventLayerKeyshortcuts: key };
      return { pass: m.sizeResults >= 1 && m.bgmResults >= 1 && m.mapSettingsResults >= 1 && m.databaseResults === 1 && m.repeatedMeta === 0 && m.rowRules === 0 && m.upperGroups === 0 && m.eventLayerKeyshortcuts === 1, measured: m };
    },
  },
  {
    id: 'C-116',
    surface: 'cmdk3',
    title: 'After typing, the palette still shows the key hint and announces the result count in a status region',
    async run({ page }) {
      await openPalette(page);
      await paletteQuery(page, '자료집');
      const m = await pe(page, `const p = document.querySelector('[data-testid="command-palette"]');
        const hint = leaves(p).filter((e) => e.tagName !== 'INPUT' && /Enter/.test(textOf(e)) && /Esc/.test(textOf(e))).length;
        const status = [...p.querySelectorAll('[role=status],[aria-live]')].filter((e) => /\\d/.test(textOf(e) || e.textContent || ''));
        return { hintVisibleAfterTyping: hint ? 1 : 0, countStatusRegions: status.length, statusText: status[0] ? (status[0].textContent || '').trim().slice(0, 30) : '' };`);
      await closeLayers(page);
      return { pass: m.hintVisibleAfterTyping === 1 && m.countStatusRegions >= 1, measured: m };
    },
  },
  {
    id: 'C-110',
    surface: 'cmdk3',
    title: '도움말: 단축키 보기 opens the guide at the 단축키 section with focus inside it',
    async run({ page }) {
      await openPalette(page);
      await page.keyboard.type('단축');
      await wait(page, 600);
      await page.keyboard.press('Enter');
      await wait(page, 1800);
      const m = await pe(page, `const body = document.querySelector('.help-modal-body'); const sec = document.querySelector('[data-testid="help-modal-section-shortcuts"]');
        if (!body || !sec) return { guideOpen: body ? 1 : 0, shortcutsSection: sec ? 1 : 0 };
        const off = Math.round(sec.getBoundingClientRect().top - body.getBoundingClientRect().top);
        return { guideOpen: 1, shortcutsSection: 1, sectionOffsetPx: off, focusInSection: sec.contains(document.activeElement) ? 1 : 0, focused: (document.activeElement && document.activeElement.tagName || '').toLowerCase() };`);
      await closeLayers(page);
      return { pass: m.guideOpen === 1 && Math.abs(m.sectionOffsetPx ?? 9999) <= 48 && m.focusInSection === 1, measured: m };
    },
  },

  // ---------------------------------------------------------------- C-25 map/event search dialog
  {
    id: 'C-25',
    surface: 'find',
    title: 'Find dialog: no top accent band, no English eyebrow, one guidance sentence, 28 px input, default scope 전체, text >= 12 px with AA contrast',
    async run({ page, probes }) {
      await domClick(page, 'toolbar-search', 1200);
      const m = await pe(page, `const d = document.querySelector('.map-event-search-window'); if (!d) return { dialogOpen: 0 };
        const before = getComputedStyle(d, '::before'); const band = before.content !== 'none' && !/rgba\\(0, 0, 0, 0\\)/.test(before.backgroundColor) ? parseFloat(before.height) || 0 : 0;
        const bt = getComputedStyle(d).borderTopStyle !== 'none' ? parseFloat(getComputedStyle(d).borderTopWidth) || 0 : 0;
        const guidance = leaves(d).filter((e) => /입력하세요|찾아보세요|찾아 이동하세요/.test(textOf(e)));
        const input = d.querySelector('[data-testid="map-event-search-input"]'); const pressed = d.querySelector('[aria-pressed="true"]');
        return { dialogOpen: 1, topBandPx: Math.max(band, bt), eyebrow: /PROJECT NAVIGATOR/.test(d.textContent) ? 1 : 0, guidanceSentences: guidance.length,
          inputHeightPx: Math.round(input.getBoundingClientRect().height), defaultScope: pressed ? textOf(pressed) : '' };`);
      const fonts = await probes.fontFloorProbe(page, { scope: '.map-event-search-window', floorPx: 12 });
      const contrast = await probes.contrastProbe(page, { scope: '.map-event-search-footer' });
      await closeLayers(page);
      Object.assign(m, { textBelow12: fonts.belowCount, minFontPx: fonts.minFontPx, footerLowContrast: contrast.belowCount, footerMinContrast: contrast.minRatio, defaultScopeAll: m.defaultScope === '전체' ? 1 : 0 });
      return { pass: m.dialogOpen === 1 && m.topBandPx <= 1 && m.eyebrow === 0 && m.guidanceSentences <= 1 && m.inputHeightPx >= 28 && m.defaultScopeAll === 1 && m.textBelow12 === 0 && m.footerLowContrast === 0, measured: m };
    },
  },

  // ---------------------------------------------------------------- C-26 music dialog
  {
    id: 'C-26',
    surface: 'music',
    title: 'Music dialog: every visible button named, filled stop icon, 24 px seek track, reasons on unplayable rows, one 음원을 선택 prompt, a filled detail pane, title-only row labels',
    async run({ page, probes }) {
      await domClick(page, 'toolbar-sound-test', 1500);
      const names = await probes.accessibleNameProbe(page, { scope: '.audio-test-window' });
      const m = await pe(page, `const d = document.querySelector('.audio-test-window'); if (!d) return { dialogOpen: 0 };
        const stop = d.querySelector('[data-testid="audio-test-stop"]'); const shapes = stop ? [...stop.querySelectorAll('svg rect, svg path, svg polygon')] : [];
        const filled = shapes.filter((s) => { const f = getComputedStyle(s).fill; return f && f !== 'none' && !/rgba\\(0, 0, 0, 0\\)/.test(f); }).length;
        const seek = d.querySelector('[data-testid="audio-test-seek"]');
        const unplayable = [...d.querySelectorAll('.audio-test-option[aria-disabled="true"]')];
        const reasoned = unplayable.filter((o) => /MIDI|파일|설치|형식|지원/.test((o.getAttribute('title') || '') + ' ' + (o.textContent || ''))).length;
        const prompts = leaves(d).filter((e) => /음원을 선택/.test(textOf(e))).length;
        const detail = d.querySelector('[data-testid="audio-test-description"]');
        const labels = [...d.querySelectorAll('.audio-test-option-label')].map((e) => e.textContent || '');
        return { dialogOpen: 1, stopShapesFilled: filled, seekHeightPx: seek ? Math.round(seek.getBoundingClientRect().height) : 0, unplayableRows: unplayable.length, unplayableWithReason: reasoned,
          selectPrompts: prompts, detailChildrenBeforeSelection: detail ? [...detail.children].filter(vis).length : 0,
          compoundRowLabels: labels.filter((t) => / — |\\(CC0\\)/.test(t)).length };`);
      await closeLayers(page);
      m.unnamedButtons = names.unnamedCount;
      return { pass: m.dialogOpen === 1 && m.unnamedButtons === 0 && m.stopShapesFilled >= 1 && m.seekHeightPx >= 24 && m.unplayableWithReason === m.unplayableRows && m.selectPrompts <= 1 && m.detailChildrenBeforeSelection >= 1 && m.compoundRowLabels === 0, measured: m };
    },
  },

  // ---------------------------------------------------------------- C-27 resource manager
  {
    id: 'C-27',
    surface: 'assets',
    title: 'Resource manager (1440 and 1024): one accent-filled button, no emoji, no audio formats in an image category, no pager on an empty list, no accent stripes or status-less dots',
    async run({ page }) {
      await domClick(page, 'toolbar-resource-manager', 1800);
      const measure = () => pe(page, `const w = document.querySelector('.resource-modal-window'); if (!w) return { open: 0 };
        // A filled (primary-looking) button: saturated opaque fill with light text on it.
        const rgb = (c) => (String(c).match(/[\\d.]+/g) || []).map(Number);
        const btns = [...w.querySelectorAll('button')].filter(vis);
        const filled = btns.filter((b) => { const s = getComputedStyle(b); const [r, g, bl, a = 1] = rgb(s.backgroundColor); const [tr, tg, tb] = rgb(s.color);
          return a > 0.9 && Math.max(r, g, bl) - Math.min(r, g, bl) > 60 && (tr + tg + tb) / 3 > 200 && (r + g + bl) / 3 < 170; });
        const emoji = leaves(w).filter((e) => /\\p{Extended_Pictographic}/u.test(textOf(e))).length;
        const pager = w.querySelector('[aria-label="리소스 페이지"]'); const empty = /0 \\/ 0/.test(pager ? pager.textContent : '') || !!w.querySelector('.rm-empty-title');
        const fmt = w.querySelector('[data-testid="resource-import-format"]');
        const title = w.querySelector('.database-modal-header h2'); const dot = title ? getComputedStyle(title, '::before') : null;
        let stripeRules = 0; for (const sh of document.styleSheets) { let rs; try { rs = sh.cssRules; } catch { continue; } const walk = (list) => { for (const r of list) { if (r.cssRules) walk(r.cssRules); if (!r.selectorText || !/\\.rm-/.test(r.selectorText)) continue; if (/inset\\s+[2-9]px\\s+0(px)?\\s+0/.test(r.style.boxShadow || '')) stripeRules++; } }; walk(rs); }
        return { open: 1, accentButtons: filled.length, accentSamples: filled.map((b) => textOf(b).slice(0, 14)), emoji, pagerVisibleOnEmpty: empty && pager && vis(pager) ? 1 : 0,
          audioFormatsInImageCategory: fmt && /MP3|WAV/.test(fmt.textContent) ? 1 : 0, titleDot: dot && dot.content !== 'none' && dot.display !== 'none' ? 1 : 0, stripeRules };`);
      const wide = await measure();
      await page.setViewportSize({ width: 1024, height: 640 });
      await wait(page, 1200);
      const narrow = await measure();
      await closeLayers(page);
      const m = { ...Object.fromEntries(Object.entries(wide).map(([k, v]) => [`w1440_${k}`, v])), w1024_accentButtons: narrow.accentButtons, w1024_pagerVisibleOnEmpty: narrow.pagerVisibleOnEmpty, w1024_emoji: narrow.emoji };
      const ok = (r) => r.open === 1 && r.accentButtons <= 1 && r.emoji === 0 && r.pagerVisibleOnEmpty === 0 && r.audioFormatsInImageCategory === 0 && r.titleDot === 0 && r.stripeRules === 0;
      return { pass: ok(wide) && ok(narrow), measured: m };
    },
  },

  // ---------------------------------------------------------------- C-28 identity and history popovers
  {
    id: 'C-28',
    surface: 'identity',
    title: 'Identity popover shows no machine id and its save stays disabled until edited; the history popover avoids 커밋 and offers an export action when empty',
    async run({ page }) {
      await domClick(page, 'topbar-identity', 900);
      const id = await pe(page, `const menu = document.querySelector('[data-testid="identity-menu"]'); if (!menu) return { identityOpen: 0 };
        const input = menu.querySelector('input'); const save = menu.querySelector('[data-testid="identity-save"]');
        const text = (menu.innerText || '') + ' ' + (input ? input.value : '');
        return { identityOpen: 1, machineIds: (text.match(/\\b[0-9a-f]{4}\\b/g) || []).length, saveDisabledUntouched: save && (save.disabled || save.getAttribute('aria-disabled') === 'true') ? 1 : 0, value: input ? input.value : '' };`);
      await closeLayers(page);
      await domClick(page, 'commit-history-toggle', 2000);
      const hist = await pe(page, `const p = document.querySelector('[data-testid="commit-history-panel"]'); if (!p) return { historyOpen: 0 };
        const buttons = [...p.querySelectorAll('button')].filter(vis).map(textOf);
        return { historyOpen: 1, commitWords: ((p.innerText || '').match(/커밋/g) || []).length, emptyActions: buttons.filter((t) => /내보내기|저장/.test(t)).length, buttons: buttons.slice(0, 4) };`);
      await closeLayers(page);
      const m = { ...id, ...hist };
      return { pass: m.identityOpen === 1 && m.machineIds === 0 && m.saveDisabledUntouched === 1 && m.historyOpen === 1 && m.commitWords === 0 && m.emptyActions >= 1, measured: m };
    },
  },

  // ---------------------------------------------------------------- C-29 / C-118 / C-111 editor guide (1366 en)
  {
    id: 'C-29',
    surface: 'helpEn',
    title: 'Guide (en 1366): no outdated Korean screenshots, shortcut descriptions at most 3 lines, one active marker in the contents, notes without a 3 px side band',
    async run({ page }) {
      await openHelpFromMenu(page);
      await pe(page, `document.querySelector('[data-testid="help-modal-section-shortcuts"]').scrollIntoView({ block: 'start' });`);
      await wait(page, 900);
      const m = await pe(page, `const d = document.querySelector('[data-testid="help-modal"] [role=dialog]');
        const old = [...d.querySelectorAll('img')].filter((i) => /\\/assets\\/help\\/(overview|map|event|database|resource)\\.png/.test(i.getAttribute('src') || '')).length;
        const lines = [...d.querySelectorAll('.help-modal-shortcut-list dd')].map((dd) => { const s = getComputedStyle(dd); const lh = parseFloat(s.lineHeight) || parseFloat(s.fontSize) * 1.3; return Math.round(dd.getBoundingClientRect().height / lh); });
        const nav = [...d.querySelectorAll('.help-modal-nav-item')];
        const markers = nav.filter((n) => n.classList.contains('active') || stripeOf(n, '::before') > 0 || stripeOf(n) > 0).length;
        const notes = [...d.querySelectorAll('.help-modal-note')].map((n) => parseFloat(getComputedStyle(n).borderLeftWidth) || 0);
        return { oldScreenshots: old, maxDescLines: Math.max(0, ...lines), activeMarkers: markers, maxNoteBorderLeftPx: Math.max(0, ...notes) };`);
      await closeLayers(page);
      return { pass: m.oldScreenshots === 0 && m.maxDescLines <= 3 && m.activeMarkers === 1 && m.maxNoteBorderLeftPx <= 1, measured: m };
    },
  },
  {
    id: 'C-118',
    surface: 'helpEn',
    title: 'Guide: no accent side bar on the active contents item or on section titles',
    async run({ page }) {
      await openHelpFromMenu(page);
      const m = await pe(page, `const d = document.querySelector('[data-testid="help-modal"] [role=dialog]');
        const navStripes = [...d.querySelectorAll('.help-modal-nav-item')].filter((n) => stripeOf(n, '::before') > 0 || stripeOf(n) > 0).length;
        const titleStripes = [...d.querySelectorAll('.help-modal-section > h3')].filter((h) => stripeOf(h, '::before') > 0 || stripeOf(h) > 0).length;
        return { navStripes, titleStripes, titles: d.querySelectorAll('.help-modal-section > h3').length };`);
      await closeLayers(page);
      return { pass: m.titles > 0 && m.navStripes === 0 && m.titleStripes === 0, measured: m };
    },
  },
  {
    id: 'C-111',
    surface: 'helpEn',
    title: 'Guide pictures are not the retired AI RPG MAKER dark-theme captures',
    async run({ page }) {
      await openHelpFromMenu(page);
      const m = await pe(page, `const d = document.querySelector('[data-testid="help-modal"] [role=dialog]'); const imgs = [...d.querySelectorAll('img')];
        return { images: imgs.length, retiredCaptures: imgs.filter((i) => /\\/assets\\/help\\/(overview|map|event|database|resource)\\.png/.test(i.getAttribute('src') || '')).length };`);
      await closeLayers(page);
      return { pass: m.retiredCaptures === 0, measured: m };
    },
  },

  // ---------------------------------------------------------------- C-30 interview stripes (built CSS)
  {
    id: 'C-30',
    surface: 'interview',
    title: 'Interview dialog CSS shipped in the build has no inset/side accent stripes on .ci-* and project-interview selectors',
    async run({ page }) {
      const m = await interviewStripeScan(new URL(page.url()).origin);
      return { pass: m.interviewCssFound === 1 && m.stripeRules === 0, measured: m };
    },
  },

  // ---------------------------------------------------------------- wave-0 rows owned by L3 (unchanged devices)
  ...wave0Devices.filter((d) => ['IS-003', 'IS-009', 'IS-036', 'IS-051', 'C-114'].includes(d.id)),
];

/** Before/after setups for scripts/qa/hig-ux before-after pairs (one PNG per cluster group). */
export const pairs = {
  'C-19-683': { surface: 'c19', prepare: async () => {} },
  'C-19-512': { surface: 'c19', prepare: async ({ page }) => { await page.setViewportSize({ width: 512, height: 320 }); await wait(page, 1500); } },
  'C-20-21-topbar-1440': { surface: 'shell', prepare: async () => {} },
  'C-22-project-menu': { surface: 'shell', prepare: async ({ page }) => domClick(page, 'menu-project', 900) },
  'C-24-116-cmdk': { surface: 'cmdk3', prepare: async ({ page }) => { await openPalette(page); await paletteQuery(page, '맵 설정'); } },
  'C-22-110-help-menu': { surface: 'shell', prepare: async ({ page }) => domClick(page, 'menu-help', 900) },
  'C-110-guide-shortcuts': { surface: 'cmdk3', prepare: async ({ page }) => { await openPalette(page); await page.keyboard.type('단축'); await wait(page, 600); await page.keyboard.press('Enter'); await wait(page, 1800); } },
  'C-25-find': { surface: 'find', prepare: async ({ page }) => domClick(page, 'toolbar-search', 1200) },
  'C-26-music': { surface: 'music', prepare: async ({ page }) => domClick(page, 'toolbar-sound-test', 1500) },
  'C-27-assets': { surface: 'assets', prepare: async ({ page }) => domClick(page, 'toolbar-resource-manager', 1800) },
  'C-28-identity': { surface: 'identity', prepare: async ({ page }) => domClick(page, 'topbar-identity', 900) },
  'C-28-history': { surface: 'identity', prepare: async ({ page }) => domClick(page, 'commit-history-toggle', 2000) },
  'C-29-guide-en': { surface: 'helpEn', prepare: async ({ page }) => { await openHelpFromMenu(page); } },
  'IS-009-036-main1024': { surface: 'main1024', prepare: async () => {} },
};
