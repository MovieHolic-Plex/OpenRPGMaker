// Lane L1 (foundations): tokens, type/target scales, focus ring, theme, tooltips, component skeletons.
// Every device measures only what L1 owns: the tokens in src/styles/tokens.css, the base/overrides
// rules, the shared components (app-modal, empty-state, icons, delayed tooltip) and delayedTooltip*.ts.
// Global counts (all captures, all of src/editor) are gated on the merged build, not here.
// Wave-0 rows owned by L1 that this lane fixes (IS-029, IS-061) reuse the wave-0 devices unchanged.
import { devices as wave0Devices, surfaces as wave0Surfaces } from './wave0.mjs';

const pe = (page, body, arg = null) => page.evaluate(new Function('arg', body), arg);

// Shared in-page helpers (string so it runs in any document).
const H = `
  const vis = (el) => { if (!el || el.nodeType !== 1) return false; const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return false;
    const s = getComputedStyle(el); return s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.02 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth; };
  const parseC = (c) => { const m = String(c).match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(parseFloat); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const over = (f, b) => ({ r: f.r * f.a + b.r * (1 - f.a), g: f.g * f.a + b.g * (1 - f.a), b: f.b * f.a + b.b * (1 - f.a), a: 1 });
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const bgOf = (el) => { const stack = []; let e = el; while (e && e.nodeType === 1) { const c = parseC(getComputedStyle(e).backgroundColor); if (c && c.a > 0) { stack.push(c); if (c.a >= 0.99) break; } e = e.parentElement; }
    let base = { r: 255, g: 255, b: 255, a: 1 }; for (let i = stack.length - 1; i >= 0; i--) base = over(stack[i], base); return base; };
  const tok = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const resolveColor = (value) => { const p = document.createElement('i'); p.style.color = value; document.body.append(p); const c = parseC(getComputedStyle(p).color); p.remove(); return c; };
  const r2 = (n) => Math.round(n * 100) / 100;
  /** Rules (flattened through @layer/@media/@supports) whose selector matches re. */
  const rulesWhere = (pred) => { const out = []; const walk = (rs) => { for (const r of rs) { if (r.selectorText !== undefined && r.style && pred(r)) out.push(r); if (r.cssRules) walk(r.cssRules); } };
    for (const sh of document.styleSheets) { let rs; try { rs = sh.cssRules; } catch { continue; } walk(rs); } return out; };
`;
const ev = (page, body, arg) => pe(page, `${H}\n${body}`, arg);

/** The colour actually drawn as a focus indicator (outline or box-shadow ring) and its contrast with what is behind the control. */
const FOCUS_INDICATOR = `
  const indicator = (el) => {
    const s = getComputedStyle(el); const behind = bgOf(el.parentElement || document.body);
    if (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) {
      // Chromium's 'auto' outline is a 1 px system ring; it is measured with its declared colour and width.
      const c = parseC(s.outlineColor); const drawn = c ? over(c, behind) : null;
      return { kind: s.outlineStyle === 'auto' ? 'outline-auto' : 'outline', widthPx: parseFloat(s.outlineWidth), contrast: drawn ? r2(ratio(drawn, behind)) : 0, color: drawn ? [drawn.r, drawn.g, drawn.b].map(Math.round).join(',') : '' };
    }
    if (s.boxShadow && s.boxShadow !== 'none') {
      // The focus ring is the shadow with no blur and a positive spread: "<color> 0px 0px 0px <spread>px".
      for (const part of s.boxShadow.split(/,(?![^(]*\\))/)) {
        const nums = [...part.matchAll(/(-?[\\d.]+)px/g)].map((m) => parseFloat(m[1])); const inset = /inset/.test(part);
        if (inset || nums.length < 4 || nums[2] !== 0 || nums[3] <= 0) continue;
        const c = parseC(part); if (!c) continue; const drawn = over(c, behind);
        return { kind: 'ring', widthPx: nums[3], contrast: r2(ratio(drawn, behind)), color: [drawn.r, drawn.g, drawn.b].map(Math.round).join(',') };
      }
    }
    return { kind: 'none', widthPx: 0, contrast: 0, color: '' };
  };
`;

async function tabStops(page, n) {
  await page.mouse.move(0, 0);
  await page.evaluate(() => document.activeElement?.blur?.());
  const stops = [];
  for (let i = 0; i < n; i++) {
    await page.keyboard.press('Tab');
    await page.waitForTimeout(140);
    const s = await ev(page, `${FOCUS_INDICATOR}
      const a = document.activeElement; if (!a || a === document.body) return null;
      const name = (a.getAttribute('aria-label') || a.innerText || a.getAttribute('title') || '').replace(/\\s+/g, ' ').trim().slice(0, 24);
      return { name, testid: a.dataset ? a.dataset.testid || '' : '', inTopbar: a.closest('.oprn-menu-bar') ? 1 : 0, inRail: a.closest('.left-activity-item, .ai-chat-sidebar-tab') || a.matches('.left-activity-item, .ai-chat-sidebar-tab') ? 1 : 0, focusVisible: a.matches(':focus-visible') ? 1 : 0, ...indicator(a) };`);
    if (s) stops.push(s);
  }
  return stops;
}

/** Characters where a line break falls inside a word (both neighbours are letters, no space between). */
const MID_WORD = `
  const midWordBreaks = (el) => {
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let n; let prev = null; let breaks = 0, lines = 1; const samples = [];
    while ((n = w.nextNode())) { const t = n.textContent; for (let i = 0; i < t.length; i++) { const ch = t[i]; if (/\\s/.test(ch)) { prev = { ch, top: prev ? prev.top : -1e9 }; continue; }
      const rg = document.createRange(); rg.setStart(n, i); rg.setEnd(n, i + 1); const rects = rg.getClientRects(); if (!rects.length) continue; const top = rects[0].top;
      if (prev && prev.top > -1e8 && top > prev.top + rects[0].height / 2) { lines++; if (!/\\s/.test(prev.ch) && /[\\p{L}\\p{N}]/u.test(prev.ch) && /[\\p{L}\\p{N}]/u.test(ch)) { breaks++; if (samples.length < 6) samples.push(t.slice(Math.max(0, i - 4), i) + '|' + t.slice(i, i + 3)); } }
      prev = { ch, top }; } }
    return { breaks, lines, samples };
  };
`;

/**
 * narrow: a pane whose texts all fit on one line has nothing to sample (L4 shortened the links hint and object names),
 * so each single-line, multi-word element is set to a width at least its longest word but narrower than the text,
 * forcing a line break whose position the element's own word-break rule decides.
 */
async function keepAllDevice(ctx, selector, textNeedle = null, { narrow = false } = {}) {
  if (textNeedle) {
    await ctx.page
      .waitForFunction((n) => [...document.querySelectorAll('div, p, span')].some((e) => e.getClientRects().length && (e.textContent || '').includes(n)), textNeedle, { timeout: 15_000 })
      .catch(() => {});
  }
  const m = await ev(
    ctx.page,
    `${MID_WORD}
     let els = [...document.querySelectorAll(arg.selector)].filter(vis);
     if (arg.needle) els = els.filter((e) => (e.textContent || '').includes(arg.needle)).sort((a, b) => a.textContent.length - b.textContent.length).slice(0, 1);
     let narrowed = 0;
     if (arg.narrow) {
       const pen = document.createElement('canvas').getContext('2d');
       for (const e of els) {
         if (midWordBreaks(e).lines > 1) continue;
         const s = getComputedStyle(e); pen.font = s.font;
         const text = (e.textContent || '').trim(); const words = text.split(/\\s+/).filter(Boolean);
         if (words.length < 2) continue;
         const full = pen.measureText(text).width; const longest = Math.max(...words.map((w) => pen.measureText(w).width));
         const content = Math.ceil(Math.max(longest + 6, full * 0.6));
         if (content >= full) continue;
         const box = s.boxSizing === 'border-box' ? ['paddingLeft', 'paddingRight', 'borderLeftWidth', 'borderRightWidth'].reduce((n, k) => n + parseFloat(s[k] || 0), 0) : 0;
         const width = content + box;
         if (s.display === 'inline') e.style.display = 'inline-block';
         e.style.width = width + 'px'; e.style.maxWidth = width + 'px'; narrowed++;
       }
     }
     let breaks = 0, multiLine = 0; const samples = [];
     for (const e of els) { const r = midWordBreaks(e); breaks += r.breaks; if (r.lines > 1) multiLine++; samples.push(...r.samples); }
     return { elements: els.length, narrowedElements: narrowed, multiLineElements: multiLine, midWordBreaks: breaks, bodyKeepAll: getComputedStyle(document.body).wordBreak === 'keep-all' ? 1 : 0, samples: samples.slice(0, 8) };`,
    { selector, needle: textNeedle, narrow },
  );
  return { pass: m.elements > 0 && m.multiLineElements > 0 && m.midWordBreaks === 0 && m.bodyKeepAll === 1, measured: m };
}

const ICON_NAMES = [
  'play', 'spark', 'minus', 'plus', 'more', 'close', 'check', 'chevron-down', 'chevron-right', 'chevron-left', 'chevron-up',
  'search', 'tool', 'palette', 'warning', 'info', 'arrow-up', 'arrow-down', 'arrow-left', 'arrow-right', 'trash', 'edit',
  'external', 'menu', 'refresh', 'save', 'folder', 'map', 'stop', 'pause', 'help', 'settings', 'user', 'lock', 'eye', 'copy',
];

const wave0 = (id) => wave0Devices.find((d) => d.id === id);

export const surfaces = {
  main1440: { width: 1440, height: 900, lang: 'ko' },
  focusCompare: { width: 1440, height: 900, lang: 'ko' },
  find: { width: 1440, height: 900, lang: 'ko', steps: ['aria:맵·이벤트 찾기'] },
  components: { width: 1440, height: 900, lang: 'ko' },
  dark: { width: 1440, height: 900, lang: 'ko' },
  tooltipEn: { width: 1366, height: 768, lang: 'en' },
  keepEvent: { width: 1024, height: 640, lang: 'ko', steps: ['aria:이벤트 레이어'] },
  keepProgress: { width: 1024, height: 640, lang: 'ko', steps: ['aria:진행'] },
  keepLinks: { width: 1024, height: 640, lang: 'ko', steps: ['aria:연결'] },
  keepObjects: { width: 1024, height: 640, lang: 'ko', steps: ['aria:기물'] },
  keepToast: { width: 1024, height: 640, lang: 'ko', steps: ['aria:살펴볼 것'] },
  forced: wave0Surfaces.forced,
  motion: wave0Surfaces.motion,
};

export const devices = [
  {
    id: 'C-01',
    surface: 'main1440',
    title: 'The first 40 keyboard focus stops draw a focus indicator >= 2 px with >= 3:1 contrast against what is behind',
    async run({ page }) {
      const stops = await tabStops(page, 40);
      // Widths are compared at 0.1 px: a 2 px ring computed through calc() reads 1.99916 px.
      const bad = stops.filter((s) => s.kind === 'none' || Math.round(s.widthPx * 10) / 10 < 2 || s.contrast < 3);
      const m = {
        stops: stops.length,
        failingStops: bad.length,
        minContrast: stops.length ? Math.min(...stops.map((s) => s.contrast)) : 0,
        topbarStops: stops.filter((s) => s.inTopbar).length,
        topbarMinContrast: Math.min(...stops.filter((s) => s.inTopbar).map((s) => s.contrast), 99),
        samples: bad.slice(0, 10).map((s) => `${s.testid || s.name} ${s.kind} ${s.widthPx}px ${s.contrast}:1`),
      };
      return { pass: m.stops >= 30 && m.failingStops === 0, measured: m };
    },
  },
  {
    id: 'C-108',
    surface: 'focusCompare',
    title: 'Top-bar focus ring has the same colour and width as the rail focus ring, and >= 3:1 contrast',
    async run({ page }) {
      const stops = await tabStops(page, 26);
      const top = stops.filter((s) => s.inTopbar);
      const rail = stops.filter((s) => s.inRail);
      const kinds = new Set([...top, ...rail].map((s) => `${s.color}/${s.widthPx}`));
      const m = {
        topbarStops: top.length,
        railStops: rail.length,
        distinctRingStyles: kinds.size,
        topbarMinContrast: Math.min(...top.map((s) => s.contrast), 99),
        railMinContrast: Math.min(...rail.map((s) => s.contrast), 99),
        topbarSample: top[0] ? `${top[0].kind} ${top[0].color} ${top[0].widthPx}px` : '',
        railSample: rail[0] ? `${rail[0].kind} ${rail[0].color} ${rail[0].widthPx}px` : '',
      };
      return { pass: top.length >= 4 && rail.length >= 4 && m.distinctRingStyles === 1 && m.topbarMinContrast >= 3 && m.railMinContrast >= 3, measured: m };
    },
  },
  {
    id: 'C-02',
    surface: 'find',
    title: 'Text sized by the shared type tokens (map/event search window) renders at or above the 12 px floor; the scale exists',
    async run({ page }) {
      const m = await ev(page, `
        const win = [...document.querySelectorAll('.map-event-search-window')].find(vis);
        const rules = rulesWhere((r) => /var\\(--font-(size-xs|size-sm|floor|1\\d|2\\d)\\b/.test(r.style.fontSize + ' ' + r.style.font + ' ' + r.cssText));
        const els = new Set(); for (const r of rules) { let found; try { found = document.querySelectorAll(r.selectorText); } catch { continue; } for (const e of found) if (vis(e) && (!win || win.contains(e)) && (e.innerText || '').trim()) els.add(e); }
        const sizes = [...els].map((e) => parseFloat(getComputedStyle(e).fontSize));
        const below = [...els].filter((e) => parseFloat(getComputedStyle(e).fontSize) < 12);
        const steps = ['--font-12', '--font-13', '--font-14', '--font-16', '--font-18', '--font-22', '--font-28'].filter((n) => tok(n)).length;
        return { windowOpen: win ? 1 : 0, tokenSizedTexts: els.size, minTokenFontPx: sizes.length ? Math.min(...sizes) : 0, belowFloor: below.length, fontFloorToken: parseFloat(tok('--font-floor')) || 0, scaleSteps: steps,
          samples: below.slice(0, 8).map((e) => (e.getAttribute('class') || e.tagName).split(' ')[0] + ' ' + getComputedStyle(e).fontSize + ' ' + (e.innerText || '').trim().slice(0, 16)) };`);
      return { pass: m.windowOpen === 1 && m.tokenSizedTexts > 0 && m.belowFloor === 0 && m.fontFloorToken === 12 && m.scaleSteps >= 6, measured: m };
    },
  },
  {
    id: 'C-03',
    surface: 'components',
    title: 'Shared modal skeleton controls (app-modal button, choice, input; empty-state action) are >= 32 px on each side',
    async run({ page }) {
      // The shared app-modal skeleton (src/editor/ui/modal.ts markup) mounted with its real classes.
      const m = await ev(page, `
        const host = document.createElement('div'); host.dataset.higFixture = 'C-03';
        host.innerHTML = '<div class="app-modal-overlay"><div class="app-modal-card" role="dialog" aria-modal="true"><div class="app-modal-title">확인</div><div class="app-modal-message">본문</div>' +
          '<input class="app-modal-input" value="이름"><div class="app-modal-choices"><button class="app-modal-choice" type="button">선택</button></div>' +
          '<div class="app-modal-actions"><button class="app-modal-button" type="button">취소</button><button class="app-modal-button is-confirm" type="button">확인</button></div></div></div>' +
          '<div class="empty-state" style="position:fixed;left:0;top:0;width:320px"><div class="empty-state__actions"><button class="empty-state__action empty-state__action--ghost" type="button">새로</button></div></div>';
        document.body.append(host);
        const ctl = [...host.querySelectorAll('button, input')];
        const d = ctl.map((e) => { const r = e.getBoundingClientRect(); return { c: (e.getAttribute('class') || '').split(' ').slice(-1)[0], w: Math.round(r.width), h: Math.round(r.height) }; });
        host.remove();
        const small = d.filter((x) => Math.min(x.w, x.h) < 32);
        return { controls: d.length, minSidePx: Math.min(...d.map((x) => Math.min(x.w, x.h))), below32: small.length, hitMinToken: parseFloat(tok('--hit-min')) || 0, hitMinDenseToken: parseFloat(tok('--hit-min-dense')) || 0, samples: small.map((x) => x.c + ' ' + x.w + 'x' + x.h) };`);
      return { pass: m.controls === 5 && m.below32 === 0 && m.hitMinToken === 32 && m.hitMinDenseToken === 28, measured: m };
    },
  },
  {
    id: 'C-04',
    surface: 'components',
    title: 'Text tokens reach 4.5:1 on every surface token and interaction tint; status text reaches 4.5:1 on its own muted tint',
    async run({ page }) {
      const m = await ev(page, `
        const base = resolveColor(tok('--bg-base')); const white = { r: 255, g: 255, b: 255, a: 1 };
        const grounds = { raised: resolveColor(tok('--bg-raised')), base, surface: resolveColor(tok('--bg-surface')), inset: resolveColor(tok('--bg-inset')),
          hover: over(resolveColor(tok('--bg-hover')), base), active: over(resolveColor(tok('--bg-active')), base), controlActive: over(resolveColor(tok('--control-bg-active')), base) };
        const pairs = [];
        for (const t of ['--text-1', '--text-2', '--text-3', '--text-placeholder']) for (const [g, bg] of Object.entries(grounds)) pairs.push([t + '/' + g, ratio(over(resolveColor(tok(t)), bg), bg)]);
        for (const s of ['danger', 'warning', 'success']) { const bg = over(resolveColor(tok('--' + s + '-muted')), white); pairs.push(['--' + s + '/' + s + '-muted', ratio(resolveColor(tok('--' + s)), bg)]); }
        const low = pairs.filter(([, r]) => r < 4.5);
        return { pairs: pairs.length, below45: low.length, minRatio: r2(Math.min(...pairs.map(([, r]) => r))), softTokens: ['--black-soft', '--white-soft'].filter((n) => tok(n)).length, samples: low.map(([k, r]) => k + ' ' + r2(r)) };`);
      return { pass: m.pairs >= 31 && m.below45 === 0 && m.softTokens === 2, measured: m };
    },
  },
  {
    id: 'C-05',
    surface: 'dark',
    title: 'With the OS in dark mode the editor follows it: dark body, readable primary text',
    async run({ page }) {
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.waitForTimeout(800);
      const m = await ev(page, `
        const body = bgOf(document.body); const bar = [...document.querySelectorAll('.oprn-menu-bar')].find(vis);
        const barBg = bar ? bgOf(bar) : body; const text = resolveColor(tok('--text-1'));
        return { bodyLuminance: r2(lum(body)), topbarLuminance: r2(lum(barBg)), text1OnBody: r2(ratio(text, body)), colorScheme: getComputedStyle(document.documentElement).colorScheme === 'light' ? 0 : 1 };`);
      await page.emulateMedia({ colorScheme: 'light' });
      return { pass: m.bodyLuminance < 0.2 && m.topbarLuminance < 0.2 && m.text1OnBody >= 7, measured: m };
    },
  },
  {
    id: 'C-06',
    surface: 'components',
    title: 'Radius and layer scales exist; shared chrome rules (app-modal, delayed tooltip, empty-state) use only scale tokens',
    async run({ page }) {
      const m = await ev(page, `
        // Rules owned by the shared components: every selector in the list starts with an L1 component class.
        const chrome = /^\\.(app-modal|delayed-tooltip|empty-state)/;
        const rules = rulesWhere((r) => r.selectorText.split(',').every((part) => chrome.test(part.trim())));
        const litRadius = rules.filter((r) => r.style.borderRadius && !/var\\(--radius/.test(r.style.borderRadius) && !/^(0|50%)$/.test(r.style.borderRadius));
        const litZ = rules.filter((r) => r.style.zIndex && !/var\\(--z-/.test(r.style.zIndex) && Number(r.style.zIndex) >= 1000);
        const radiusTokens = ['--radius-1', '--radius-2', '--radius-3', '--radius-4'].filter((n) => tok(n)).length;
        const layerTokens = ['--z-dropdown', '--z-popover', '--z-overlay', '--z-dialog', '--z-toast', '--z-tooltip'].filter((n) => tok(n)).length;
        return { chromeRules: rules.length, literalRadius: litRadius.length, literalZ1000: litZ.length, radiusTokens, layerTokens, samples: [...litRadius, ...litZ].slice(0, 8).map((r) => r.selectorText.slice(0, 40) + ' ' + (r.style.borderRadius || r.style.zIndex)) };`);
      return { pass: m.chromeRules > 10 && m.literalRadius === 0 && m.literalZ1000 === 0 && m.radiusTokens === 4 && m.layerTokens === 6, measured: m };
    },
  },
  {
    id: 'C-07',
    surface: 'components',
    title: 'The shared SVG icon set (.ui-icon[data-icon]) renders every named icon at 16/20 px in currentColor',
    async run({ page }) {
      const m = await ev(page, `
        const host = document.createElement('div'); host.style.cssText = 'position:fixed;left:0;top:0;color:rgb(200, 30, 40)';
        host.innerHTML = arg.names.map((n) => '<span class="ui-icon" data-icon="' + n + '" aria-hidden="true"></span>').join('') + '<span class="ui-icon ui-icon--20" data-icon="close" aria-hidden="true"></span>';
        document.body.append(host);
        const spans = [...host.children]; let rendered = 0, sized = 0, current = 0; const missing = [];
        for (const s of spans.slice(0, arg.names.length)) { const cs = getComputedStyle(s); const mask = cs.maskImage || cs.webkitMaskImage || 'none'; const r = s.getBoundingClientRect();
          if (/url\\(/.test(mask) && /svg/.test(mask)) rendered++; else missing.push(s.dataset.icon);
          if (Math.round(r.width) === 16 && Math.round(r.height) === 16) sized++;
          if (cs.backgroundColor === 'rgb(200, 30, 40)') current++; }
        const big = spans[spans.length - 1].getBoundingClientRect(); host.remove();
        return { names: arg.names.length, rendered, sized16: sized, currentColor: current, size20: Math.round(big.width) === 20 && Math.round(big.height) === 20 ? 1 : 0, missing: missing.slice(0, 10) };`, { names: ICON_NAMES });
      return { pass: m.rendered === m.names && m.sized16 === m.names && m.currentColor === m.names && m.size20 === 1, measured: m };
    },
  },
  {
    id: 'C-08',
    surface: 'tooltipEn',
    title: 'Every text-less top-bar button shows a tooltip within 700 ms of hover whose text contains its accessible name',
    async run({ page }) {
      const targets = await ev(page, `
        const bar = [...document.querySelectorAll('.oprn-menu-bar')].find(vis); if (!bar) return [];
        return [...bar.querySelectorAll('button')].filter(vis).filter((b) => !(b.innerText || '').trim() && b.getAttribute('aria-label')).map((b, i) => { b.dataset.higTip = String(i); const r = b.getBoundingClientRect(); return { i, name: b.getAttribute('aria-label'), x: r.left + r.width / 2, y: r.top + r.height / 2 }; });`);
      let shown = 0, matching = 0;
      const misses = [];
      for (const t of targets) {
        await page.mouse.move(t.x, t.y);
        await page.waitForTimeout(700);
        const tip = await ev(page, `const t = [...document.querySelectorAll('[role=tooltip]')].find(vis); return t ? (t.textContent || '').replace(/\\s+/g, ' ').trim() : null;`);
        if (tip) shown++;
        const name = t.name.replace(/\s+/g, ' ').trim();
        if (tip && tip.includes(name)) matching++;
        else if (misses.length < 10) misses.push(`${name} => ${tip ?? '(none)'}`);
        await page.mouse.move(2, 760);
        await page.waitForTimeout(150);
      }
      const m = { iconOnlyButtons: targets.length, tooltipShown: shown, tooltipMatchesName: matching, misses };
      return { pass: m.iconOnlyButtons >= 5 && m.tooltipMatchesName === m.iconOnlyButtons, measured: m };
    },
  },
  { id: 'C-10-event-empty', surface: 'keepEvent', title: 'Korean event empty state breaks only between words', run: (ctx) => keepAllDevice(ctx, '.event-list-empty') },
  { id: 'C-10-progress', surface: 'keepProgress', title: 'Korean progress hint breaks only between words', run: (ctx) => keepAllDevice(ctx, '.left-progress-hint, .left-progress-detail') },
  { id: 'C-10-links', surface: 'keepLinks', title: 'Korean links hint breaks only between words', run: (ctx) => keepAllDevice(ctx, '.left-links-hint', null, { narrow: true }) },
  { id: 'C-10-objects', surface: 'keepObjects', title: 'Korean object card names break only between words', run: (ctx) => keepAllDevice(ctx, '.left-props-name', null, { narrow: true }) },
  { id: 'C-10-toast', surface: 'keepToast', title: 'Korean review card text breaks only between words', run: (ctx) => keepAllDevice(ctx, 'div, p, span', '기본 확인 결과만') },
  wave0('IS-029'),
  wave0('IS-061'),
];
