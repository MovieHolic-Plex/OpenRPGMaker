// Wave-0 lane: classify the IDEAL-STATE rows the audit left "untested" on the frozen baseline,
// plus the five clusters whose members the blind judge left unclear (C-114, C-74, C-90, C-106, C-09).
// Run with --expect any; the classification (pass | fail | not-measurable) is written from the JSON.
// Every device returns measured numbers. A device whose row cannot be measured in a static dist
// reports measurable: 0 and the number that proves why (for example no exported player in dist).
import fs from 'node:fs';
import path from 'node:path';

const VIS = `
  const vis = (el) => { if (!el || el.nodeType !== 1) return false; const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return false;
    const s = getComputedStyle(el); return s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.02 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth; };
  const rectOf = (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), b: Math.round(r.bottom), r: Math.round(r.right) }; };
  const nameOf = (el) => (el.getAttribute('aria-label') || el.innerText || el.getAttribute('title') || el.value || '').replace(/\\s+/g, ' ').trim();
  const allNames = (el) => [el.getAttribute('aria-label'), el.getAttribute('title'), el.innerText].filter(Boolean).join(' ');
  const textOf = (el) => (el.innerText || '').replace(/\\s+/g, ' ').trim();
  const INTERACTIVE = 'button,a[href],input,select,textarea,summary,[role=button],[role=tab],[role=menuitem],[role=menuitemcheckbox],[role=menuitemradio],[role=option],[role=checkbox],[role=switch],[role=treeitem],[role=radio]';
  const LAYERS = '[role=dialog],[role=alertdialog],[role=menu],[role=listbox],dialog[open],[aria-modal=true]';
`;
const pe = (page, body, arg = null) => page.evaluate(new Function('arg', `${VIS}\n${body}`), arg);

const T = (ctx, ko) => ctx.lib.tr(ctx.surface.lang, ko);
async function click(ctx, ko, opts = {}) {
  const p = await ctx.lib.locateTarget(ctx.page, T(ctx, ko), { lang: ctx.surface.lang, log: ctx.log, timeoutMs: opts.timeoutMs ?? 12_000 });
  await ctx.page.mouse.click(p.x, p.y, opts.button ? { button: opts.button } : undefined);
  await ctx.page.waitForTimeout(opts.settleMs ?? 700);
  return p;
}
async function tryClick(ctx, ko, opts = {}) {
  try {
    return await click(ctx, ko, { timeoutMs: 6000, ...opts });
  } catch {
    return null;
  }
}
const layerCount = (page) => pe(page, `return [...document.querySelectorAll(LAYERS)].filter(vis).length;`);
async function shot(page, clip, debugName = null) {
  const buf = await page.screenshot({ clip, animations: 'disabled' });
  if (debugName && process.env.HIG_UX_DEBUG_DIR) fs.writeFileSync(path.join(process.env.HIG_UX_DEBUG_DIR, `wave0-${debugName}.png`), buf);
  return buf;
}
async function diffPx(page, a, b) {
  const { PNG } = await import('pngjs');
  const pa = PNG.sync.read(a);
  const pb = PNG.sync.read(b);
  if (pa.width !== pb.width || pa.height !== pb.height) return pa.width * pa.height;
  let n = 0;
  for (let i = 0; i < pa.data.length; i += 4) {
    if (Math.max(Math.abs(pa.data[i] - pb.data[i]), Math.abs(pa.data[i + 1] - pb.data[i + 1]), Math.abs(pa.data[i + 2] - pb.data[i + 2])) > 24) n++;
  }
  return n;
}
const canvasClip = (page) =>
  pe(page, `const c = [...document.querySelectorAll('.phaser-container canvas, .editor-canvas-scroll-shell canvas')].filter(vis).sort((a,b)=>b.clientWidth*b.clientHeight-a.clientWidth*a.clientHeight)[0];
    if (!c) return null; const r = c.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) };`);

/** Footer reachability of the largest visible dialog: rect inside the viewport, footer buttons above the fold and hit-testable. */
const DIALOG_FIT = `
  const ds = [...document.querySelectorAll('[role=dialog],[aria-modal=true],dialog[open]')].filter(vis).sort((a,b)=>{const ra=a.getBoundingClientRect(), rb=b.getBoundingClientRect(); return rb.width*rb.height-ra.width*ra.height;});
  const dlg = ds[0]; if (!dlg) return { dialogs: 0 };
  const r = dlg.getBoundingClientRect();
  let foot = [...dlg.querySelectorAll('footer button, [class*=footer] button, [class*=actions] button')].filter((b) => b.getClientRects().length);
  if (!foot.length) { const all = [...dlg.querySelectorAll('button')].filter((b) => b.getClientRects().length); const maxB = Math.max(...all.map((b) => b.getBoundingClientRect().bottom)); foot = all.filter((b) => b.getBoundingClientRect().bottom >= maxB - 4); }
  let below = 0, unreachable = 0;
  for (const b of foot) { const br = b.getBoundingClientRect(); if (br.bottom > innerHeight + 0.5 || br.right > innerWidth + 0.5) below++;
    const cx = Math.min(innerWidth - 1, br.left + br.width / 2), cy = Math.min(innerHeight - 1, br.top + br.height / 2); const hit = document.elementFromPoint(cx, cy); if (!hit || !(b === hit || b.contains(hit))) unreachable++; }
  const scrollers = [dlg, ...dlg.querySelectorAll('*')].filter((e) => e.scrollTop > 0).length;
  return { dialogs: ds.length, inside: r.left >= -0.5 && r.top >= -0.5 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5 ? 1 : 0,
    dialogBottom: Math.round(r.bottom), dialogRight: Math.round(r.right), viewportH: innerHeight, viewportW: innerWidth,
    footerButtons: foot.length, footerBelowFold: below, footerUnreachable: unreachable, scrolledContainers: scrollers, title: (dlg.getAttribute('aria-label') || '').slice(0, 30) };`;

const HYPE_KO = ['한눈에', '손쉽게', '스마트한', '혁신적인', '간편하게'];
const HYPE_EN = ['seamless', 'effortless', 'supercharge', 'cutting-edge', 'ai-powered'];
const HYPE_JA = ['シームレス', '手軽に', '革新的', 'スマートな'];
const HYPE_ZH = ['无缝', '轻松', '革命性', '智能化'];
function readCatalog(lib, lang) {
  const f = path.join(lib.REPO_ROOT, 'src/i18n/catalogs', `${lang}.json`);
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {};
}

export const surfaces = {
  main1024: { width: 1024, height: 640, lang: 'ko' },
  main1440: { width: 1440, height: 900, lang: 'ko' },
  topbar683: { width: 683, height: 427, lang: 'ko' },
  dialogs: { width: 1024, height: 640, lang: 'ko' },
  db: { width: 1024, height: 640, lang: 'ko', steps: ['aria:자료집'] },
  roles: { width: 1440, height: 900, lang: 'ko' },
  maps: { width: 1024, height: 640, lang: 'ko', steps: ['aria:맵'] },
  view: { width: 1440, height: 900, lang: 'ko' },
  settings: { width: 1440, height: 900, lang: 'ko' },
  forced: { width: 1440, height: 900, lang: 'ko' },
  motion: { width: 1440, height: 900, lang: 'ko' },
  labels: { width: 1440, height: 900, lang: 'ko' },
  helpEn: { width: 1440, height: 900, lang: 'en', steps: ['aria:도움말', 'text:단축키 · 도움말'] },
  cmdk: { width: 1440, height: 900, lang: 'ko' },
  guide: { width: 1440, height: 900, lang: 'ko' },
  paint: { width: 1440, height: 900, lang: 'ko' },
  keyboard: { width: 1440, height: 900, lang: 'ko' },
  play: { width: 1440, height: 900, lang: 'ko' },
  playRestore: { width: 1440, height: 900, lang: 'ko' },
  overlays: { width: 1440, height: 900, lang: 'ko' },
  ai: { width: 1440, height: 900, lang: 'ko' },
  first: { width: 1440, height: 900, lang: 'ko', query: 'aiBridge=0', readySelector: 'body', settleMs: 1500 },
  env: { width: 1440, height: 900, lang: 'ko' },
};

export const devices = [
  // ---------------------------------------------------------------- main 1024x640
  {
    id: 'IS-006',
    surface: 'main1024',
    title: 'Map canvas is the largest region and covers >= 45 % of a 1024x640 window',
    async run({ page }) {
      const m = await pe(page, `
        const vp = innerWidth * innerHeight;
        const canvas = [...document.querySelectorAll('.editor-canvas-scroll-shell, .canvas-area')].filter(vis)[0];
        const cr = canvas.getBoundingClientRect();
        const regions = [...document.querySelectorAll('.oprn-menu-bar, aside, .ai-chat-sidebar, [class*=right-rail], [class*=assistant-rail], .ai-chat-panel, .chat-dock')].filter(vis).filter((e) => !e.contains(canvas) && !canvas.contains(e));
        const areas = regions.map((e) => { const r = e.getBoundingClientRect(); return { cls: (e.getAttribute('class') || e.tagName).split(' ')[0], area: Math.round(r.width * r.height) }; });
        const maxOther = Math.max(0, ...areas.map((a) => a.area));
        return { canvasRatio: +(cr.width * cr.height / vp).toFixed(3), canvasAreaPx: Math.round(cr.width * cr.height), largestOtherAreaPx: maxOther, regions: areas.slice(0, 8) };`);
      return { pass: m.canvasRatio >= 0.45 && m.canvasAreaPx > m.largestOtherAreaPx, measured: m };
    },
  },
  {
    id: 'IS-009',
    surface: 'main1024',
    title: 'Chrome shows map name, active layer and active tool as readable text',
    async run({ page }) {
      const m = await pe(page, `
        const tree = document.querySelector('.map-item.active, [role=treeitem][aria-selected=true]');
        const mapName = (tree ? textOf(tree.querySelector('.map-item-name, .map-name') || tree) : '').split(' ')[0] || '빈 맵';
        const chromeTexts = [...document.querySelectorAll('.oprn-menu-bar *, .ai-chat-sidebar *, .canvas-toolbar *, [class*=status] *')].filter(vis).filter((e) => !e.children.length).map(textOf);
        const mapNameShown = chromeTexts.filter((t) => t.startsWith(mapName.slice(0, 4))).length;
        const layer = [...document.querySelectorAll('.left-layer-btn.is-active, [role=tab][aria-selected=true].left-layer-btn')].filter(vis)[0];
        const tool = [...document.querySelectorAll('.oprn-tile-tool.active, .oprn-tile-tool[aria-pressed=true]')].filter(vis)[0];
        const toolName = tool ? (tool.getAttribute('aria-label') || '') : '';
        const toolTextShown = toolName ? chromeTexts.filter((t) => t === toolName || t.startsWith(toolName)).length : 0;
        return { mapNameShown, activeLayerTextLen: layer ? textOf(layer).length : 0, activeToolVisibleTextLen: tool ? textOf(tool).length : 0, activeToolNameShownAsText: toolTextShown, toolName, mapName };`);
      return { pass: m.mapNameShown > 0 && m.activeLayerTextLen > 0 && (m.activeToolVisibleTextLen > 0 || m.activeToolNameShownAsText > 0), measured: m };
    },
  },
  {
    id: 'IS-020',
    surface: 'main1024',
    title: 'Adjacent hit areas in the chrome and palette never overlap; focus outlines do not spill onto neighbours',
    async run({ page }) {
      const scope = ['.oprn-menu-bar', '.ai-chat-sidebar', '.canvas-toolbar'];
      // Hit rects are clipped by every scrolling/overflow-hidden ancestor, so a card scrolled under a sticky footer is not counted.
      const ov = await pe(page, `
        const els = []; for (const s of arg) for (const root of document.querySelectorAll(s)) for (const el of root.querySelectorAll(INTERACTIVE)) if (vis(el) && !els.includes(el)) els.push(el);
        const clipRect = (el) => { const r = el.getBoundingClientRect(); let R = { l: r.left, t: r.top, r: r.right, b: r.bottom }; for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { const s = getComputedStyle(p);
          if (s.overflowX !== 'visible' || s.overflowY !== 'visible') { const q = p.getBoundingClientRect(); R = { l: Math.max(R.l, q.left), t: Math.max(R.t, q.top), r: Math.min(R.r, q.right), b: Math.min(R.b, q.bottom) }; } } return R; };
        const rs = els.map(clipRect); let pairs = 0, max = 0; const samples = [];
        for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) { const a = els[i], b = els[j]; if (a.contains(b) || b.contains(a)) continue; const A = rs[i], B = rs[j];
          if (A.r - A.l < 1 || A.b - A.t < 1 || B.r - B.l < 1 || B.b - B.t < 1) continue;
          const w = Math.min(A.r, B.r) - Math.max(A.l, B.l), h = Math.min(A.b, B.b) - Math.max(A.t, B.t);
          if (w > 0.5 && h > 0.5) { pairs++; max = Math.max(max, Math.round(w * h)); if (samples.length < 6) samples.push(nameOf(a).slice(0, 24) + ' x ' + nameOf(b).slice(0, 24) + ' ' + Math.round(w * h)); } }
        return { elements: els.length, overlapPairs: pairs, maxOverlapPx2: max, samples };`, scope);
      const spill = await pe(page, `
        const els = []; for (const s of arg) for (const root of document.querySelectorAll(s)) for (const el of root.querySelectorAll(INTERACTIVE)) if (vis(el) && !els.includes(el)) els.push(el);
        let spills = 0, checked = 0; const samples = [];
        for (const el of els.slice(0, 80)) { el.focus({ focusVisible: true }); if (document.activeElement !== el) continue; checked++;
          const s = getComputedStyle(el); const ow = s.outlineStyle !== 'none' ? (parseFloat(s.outlineWidth) || 0) + Math.max(0, parseFloat(s.outlineOffset) || 0) : 0;
          const sh = s.boxShadow === 'none' ? 0 : Math.max(0, ...[...s.boxShadow.matchAll(/(-?[\\d.]+)px/g)].map((m) => Math.abs(parseFloat(m[1]))));
          const g = Math.max(ow, sh); if (!g) continue; const r = el.getBoundingClientRect();
          const R = { l: r.left - g, t: r.top - g, r: r.right + g, b: r.bottom + g };
          for (const o of els) { if (o === el || o.contains(el) || el.contains(o)) continue; const q = o.getBoundingClientRect();
            const w = Math.min(R.r, q.right) - Math.max(R.l, q.left), h = Math.min(R.b, q.bottom) - Math.max(R.t, q.top);
            const w0 = Math.min(r.right, q.right) - Math.max(r.left, q.left), h0 = Math.min(r.bottom, q.bottom) - Math.max(r.top, q.top);
            if (w > 0.5 && h > 0.5 && !(w0 > 0.5 && h0 > 0.5)) { spills++; if (samples.length < 6) samples.push(nameOf(el).slice(0, 24) + ' -> ' + nameOf(o).slice(0, 24)); break; } } }
        document.activeElement?.blur?.(); return { focusChecked: checked, focusSpills: spills, spillSamples: samples };`, scope);
      return { pass: ov.overlapPairs === 0 && spill.focusSpills === 0, measured: { overlapPairs: ov.overlapPairs, maxOverlapPx2: ov.maxOverlapPx2, elements: ov.elements, ...spill, overlapSamples: ov.samples.slice(0, 6) } };
    },
  },
  {
    id: 'IS-036',
    surface: 'main1024',
    title: 'One visible status strip (role=status / aria-live) with at most four items holds the save state',
    async run({ page }) {
      const m = await pe(page, `
        const live = [...document.querySelectorAll('[role=status],[aria-live]')];
        const visible = live.filter(vis);
        const saveLive = live.filter((e) => /save|저장/.test(e.className + ' ' + textOf(e)));
        const saveVisible = saveLive.filter(vis).length;
        const strip = visible.sort((a,b)=>b.getBoundingClientRect().width-a.getBoundingClientRect().width)[0];
        return { liveRegionsTotal: live.length, liveRegionsVisible: visible.length, saveStateLiveVisible: saveVisible, stripItems: strip ? strip.children.length : 0,
          visibleSamples: visible.slice(0, 5).map((e) => (e.getAttribute('class') || e.tagName).split(' ')[0] + ':' + textOf(e).slice(0, 30)) };`);
      return { pass: m.saveStateLiveVisible >= 1 && m.stripItems >= 1 && m.stripItems <= 4, measured: m };
    },
  },
  {
    id: 'IS-040',
    surface: 'main1024',
    title: 'Canvas never traps focus and no user-actionable control is removed from the Tab order',
    async run({ page }) {
      const m = await pe(page, `
        const c = [...document.querySelectorAll('.phaser-container canvas, .editor-canvas-scroll-shell')].filter(vis)[0];
        const focusTarget = c.closest('[tabindex]') || c; focusTarget.focus?.();
        const canvasFocusable = document.activeElement === focusTarget && focusTarget !== document.body ? 1 : 0;
        const roving = '[role=tablist],[role=radiogroup],[role=toolbar],[role=grid],[role=listbox],[role=tree],[role=menu],[role=menubar],[role=treegrid]';
        const neg = [...document.querySelectorAll(INTERACTIVE)].filter(vis).filter((e) => e.getAttribute('tabindex') === '-1');
        const stray = neg.filter((e) => { const box = e.closest(roving); if (!box) return true; return ![...box.querySelectorAll('[tabindex="0"]')].length; });
        return { canvasFocusable, negTabindexControls: neg.length, strayNegTabindex: stray.length, straySamples: stray.slice(0, 8).map((e) => nameOf(e).slice(0, 24)) };`);
      let trapped = 0;
      if (m.canvasFocusable) {
        await page.keyboard.press('Tab');
        trapped = await pe(page, `const c = document.querySelector('.phaser-container'); return c && c.contains(document.activeElement) ? 1 : 0;`);
      }
      return { pass: trapped === 0 && m.strayNegTabindex === 0, measured: { ...m, trappedAfterTab: trapped } };
    },
  },
  {
    id: 'IS-059',
    surface: 'main1024',
    title: 'Chrome icons are SVG in currentColor; no glyph or raster icons',
    async run({ page }) {
      const m = await pe(page, `
        const btns = [...document.querySelectorAll('.oprn-menu-bar button, .left-activity-item, .ai-chat-sidebar-tab, .oprn-tile-toolbar button, .canvas-toolbar button')].filter(vis);
        let svgIcons = 0, svgNotCurrent = 0, glyphIcons = 0, rasterIcons = 0; const glyphSamples = [];
        const glyph = /^[\\p{Extended_Pictographic}\\u2190-\\u21FF\\u2500-\\u27BF\\u2B00-\\u2BFF\\u22EF\\u2212+×−⋯…▾▸◂]+$/u;
        for (const b of btns) { const svg = b.querySelector('svg'); const img = b.querySelector('img'); const t = textOf(b);
          if (svg) { svgIcons++; const paint = [svg, ...svg.querySelectorAll('path,circle,rect,line,polyline,polygon')].map((e) => [e.getAttribute('fill'), e.getAttribute('stroke')]).flat().filter(Boolean);
            const cs = getComputedStyle(svg); const col = getComputedStyle(b).color; const usesCurrent = paint.some((p) => /currentcolor/i.test(p)) || cs.fill === col || cs.stroke === col; if (!usesCurrent) svgNotCurrent++; }
          if (img) rasterIcons++;
          if (!svg && !img && t && glyph.test(t.replace(/\\s+/g, ''))) { glyphIcons++; if (glyphSamples.length < 10) glyphSamples.push(t + ' ' + nameOf(b).slice(0, 20)); } }
        return { chromeButtons: btns.length, svgIcons, svgNotCurrentColor: svgNotCurrent, glyphIcons, rasterIcons, glyphSamples };`);
      return { pass: m.glyphIcons === 0 && m.rasterIcons === 0 && m.svgNotCurrentColor === 0, measured: m };
    },
  },
  {
    id: 'IS-062',
    surface: 'main1024',
    title: 'Chrome transitions and animations last at most 300 ms',
    async run({ page }) {
      const m = await pe(page, `
        const toMs = (v) => String(v).split(',').map((x) => x.trim()).map((x) => x.endsWith('ms') ? parseFloat(x) : parseFloat(x) * 1000).filter(Number.isFinite);
        let over = 0, maxT = 0, maxA = 0, infinite = 0; const samples = [];
        for (const el of document.querySelectorAll('body *')) { if (!vis(el)) continue; const s = getComputedStyle(el);
          const t = Math.max(0, ...toMs(s.transitionDuration)); const a = s.animationName !== 'none' ? Math.max(0, ...toMs(s.animationDuration)) : 0;
          if (s.animationName !== 'none' && /infinite/.test(s.animationIterationCount)) infinite++;
          maxT = Math.max(maxT, t); maxA = Math.max(maxA, a);
          if (t > 300 || a > 300) { over++; if (samples.length < 8) samples.push((el.getAttribute('class') || el.tagName).split(' ')[0] + ' t=' + t + ' a=' + a); } }
        return { over300Count: over, maxTransitionMs: maxT, maxAnimationMs: maxA, infiniteAnimations: infinite, samples };`);
      return { pass: m.over300Count === 0, measured: m };
    },
  },
  {
    id: 'IS-097',
    surface: 'main1024',
    title: 'With the AI bridge off and no team host, the workspace paints with 0 modals and one non-blocking status banner',
    async run({ page }) {
      const m = await pe(page, `
        const modals = [...document.querySelectorAll('[role=dialog],[role=alertdialog],[aria-modal=true],dialog[open]')].filter(vis).length;
        const banners = [...document.querySelectorAll('[role=status],[role=alert],[aria-live]')].filter(vis).filter((e) => textOf(e).length > 0);
        const canvas = [...document.querySelectorAll('.phaser-container canvas')].filter(vis).length;
        const offlineText = [...document.querySelectorAll('body *')].filter(vis).filter((e) => !e.children.length && /연결 안 됨|오프라인|연결이 필요|연결 확인 필요/.test(textOf(e))).length;
        return { visibleModals: modals, statusBanners: banners.length, canvasPainted: canvas, offlineIndicators: offlineText, bannerSamples: banners.slice(0, 4).map((e) => textOf(e).slice(0, 40)) };`);
      return { pass: m.visibleModals === 0 && m.canvasPainted >= 1 && m.statusBanners >= 1, measured: m };
    },
  },

  // ---------------------------------------------------------------- main 1440x900
  {
    id: 'IS-012',
    surface: 'main1440',
    title: 'The focused panel is told apart from inactive panels by border or title treatment',
    async run({ page }) {
      const sig = () =>
        pe(page, `return ['.ai-chat-sidebar', '.canvas-area'].map((s) => { const e = document.querySelector(s); if (!e) return ''; const c = getComputedStyle(e);
          return [c.borderTopWidth, c.borderLeftWidth, c.borderRightWidth, c.borderColor, c.outlineStyle, c.outlineWidth, c.boxShadow].join('|'); });`);
      const search = await pe(page, `const i = [...document.querySelectorAll('.ai-chat-sidebar input')].filter(vis)[0]; if (!i) return 0; i.focus(); return document.activeElement === i ? 1 : 0;`);
      await page.waitForTimeout(300);
      const leftFocused = await sig();
      const clip = await canvasClip(page);
      await page.mouse.click(clip.x + 8, clip.y + 8, { button: 'middle' }).catch(() => {});
      await pe(page, `document.activeElement?.blur?.(); const c = document.querySelector('.phaser-container canvas'); c?.focus?.();`);
      await page.waitForTimeout(300);
      const canvasFocused = await sig();
      const leftChanged = leftFocused[0] !== canvasFocused[0] ? 1 : 0;
      const canvasChanged = leftFocused[1] !== canvasFocused[1] ? 1 : 0;
      return { pass: leftChanged === 1 && canvasChanged === 1, measured: { leftPanelFocusedViaInput: search, leftRegionStyleChanged: leftChanged, canvasRegionStyleChanged: canvasChanged, leftFocused, canvasFocused } };
    },
  },
  {
    id: 'IS-052',
    surface: 'main1440',
    title: 'No hype wording in the four catalogs or on the visible surface; no static hype badges',
    async run({ page, lib }) {
      const hits = { ko: [], en: [], ja: [], zh: [] };
      for (const lang of ['en', 'ja', 'zh']) {
        const cat = readCatalog(lib, lang);
        for (const [k, v] of Object.entries(cat)) {
          if (lang === 'en' && HYPE_KO.some((b) => k.includes(b)) && !hits.ko.includes(k)) hits.ko.push(k);
          const val = String(v);
          const list = lang === 'en' ? HYPE_EN : lang === 'ja' ? HYPE_JA : HYPE_ZH;
          if (list.some((b) => val.toLowerCase().includes(b.toLowerCase()))) hits[lang].push(val.slice(0, 60));
        }
      }
      const vis = await pe(page, `
        const words = arg; const texts = [...document.querySelectorAll('body *')].filter(vis).filter((e) => !e.children.length).map(textOf);
        const visibleHits = texts.filter((t) => words.some((w) => t.toLowerCase().includes(w.toLowerCase()))).length;
        const badges = [...document.querySelectorAll('[class*=badge],[class*=pill],[class*=tag]')].filter(vis).filter((e) => /^(new|hot|beta|신규|인기|ai-powered|추천)$/i.test(textOf(e))).length;
        return { visibleHits, staticHypeBadges: badges };`, [...HYPE_KO, ...HYPE_EN]);
      const m = { catalogKoHits: hits.ko.length, catalogEnHits: hits.en.length, catalogJaHits: hits.ja.length, catalogZhHits: hits.zh.length, ...vis, samples: [...hits.ko, ...hits.en, ...hits.ja, ...hits.zh].slice(0, 8) };
      return { pass: m.catalogKoHits + m.catalogEnHits + m.catalogJaHits + m.catalogZhHits + m.visibleHits + m.staticHypeBadges === 0, measured: m };
    },
  },
  {
    id: 'IS-056',
    surface: 'main1440',
    title: 'Editor strings name the input actually available: no "tap" / 탭하세요 wording in the editor',
    async run({ page, lib }) {
      const en = readCatalog(lib, 'en');
      const ja = readCatalog(lib, 'ja');
      const zh = readCatalog(lib, 'zh');
      const tapEn = Object.values(en).filter((v) => /\btap (this|the|a|an|on|to)\b/i.test(String(v)));
      const koTap = Object.keys(en).filter((k) => /탭하세요|탭해서|탭하면/.test(k));
      const tapJa = Object.values(ja).filter((v) => /タップ/.test(String(v)));
      const tapZh = Object.values(zh).filter((v) => /轻触|点按/.test(String(v)));
      const visibleKo = await pe(page, `return [...document.querySelectorAll('body *')].filter(vis).filter((e) => !e.children.length && /탭하세요|tap /i.test(textOf(e))).length;`);
      const m = { enTapPhrases: tapEn.length, koTapPhrases: koTap.length, jaTapPhrases: tapJa.length, zhTapPhrases: tapZh.length, visibleTapPhrases: visibleKo, samples: [...tapEn, ...tapJa, ...tapZh].slice(0, 5).map((s) => String(s).slice(0, 70)), runtimeTouchChecked: 0 };
      return { pass: m.enTapPhrases + m.koTapPhrases + m.jaTapPhrases + m.zhTapPhrases + m.visibleTapPhrases === 0, measured: m };
    },
  },

  // ---------------------------------------------------------------- top bar overflow
  {
    id: 'IS-003',
    surface: 'topbar683',
    title: 'When the top bar runs out of width, 세계관/음악/찾기 move into one labelled overflow menu with chords; at 1920 they are visible',
    async run(ctx) {
      const { page } = ctx;
      const TOOLS = ['세계관', '음악·효과음', '맵·이벤트 찾기'];
      const measureBar = () =>
        pe(page, `
          const bar = document.querySelector('.oprn-menu-bar'); const btns = [...bar.querySelectorAll('button')];
          const direct = arg.map((n) => btns.filter((b) => vis(b) && (b.getAttribute('aria-label') || '').startsWith(n)).length ? 1 : 0);
          const popups = btns.filter((b) => vis(b) && b.hasAttribute('aria-haspopup') && nameOf(b));
          const overflow = btns.filter((b) => vis(b) && /더 보기|더보기|more|넘침|overflow/i.test(nameOf(b) + ' ' + b.className));
          let overlapPairs = 0; const vb = btns.filter(vis); for (let i = 0; i < vb.length; i++) for (let j = i + 1; j < vb.length; j++) { const a = vb[i].getBoundingClientRect(), c = vb[j].getBoundingClientRect();
            if (Math.min(a.right, c.right) - Math.max(a.left, c.left) > 0.5 && Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top) > 0.5 && !vb[i].contains(vb[j]) && !vb[j].contains(vb[i])) overlapPairs++; }
          let overflowHittable = 0; if (overflow[0]) { overflow[0].setAttribute('data-w0-overflow', '1'); const r = overflow[0].getBoundingClientRect(); const h = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); overflowHittable = h && (h === overflow[0] || overflow[0].contains(h)) ? 1 : 0; }
          return { overflowHittable, directVisible: direct.reduce((a, b) => a + b, 0), haspopupCount: popups.length, overflowButtons: overflow.length, overlapPairs, barScrollW: bar.scrollWidth, barClientW: bar.clientWidth };`, TOOLS);
      const narrow = await measureBar();
      let inOverflow = 0;
      let withChord = 0;
      if (narrow.overflowButtons) {
        // Activated through the DOM: at this width the overflow button can sit under a neighbour (C-19), which overflowHittable records.
        await pe(page, `document.querySelector('[data-w0-overflow="1"]').click();`);
        await page.waitForTimeout(600);
        const r = await pe(page, `
          const items = [...document.querySelectorAll('[role=menu] [role^=menuitem], [role=menu] button')].filter(vis);
          const found = arg.map((n) => items.find((i) => textOf(i).startsWith(n)));
          return { inOverflow: found.filter(Boolean).length, withChord: found.filter((i) => i && (i.querySelector('kbd') || /(Ctrl|Cmd|⌘|F\\d)/.test(textOf(i)))).length };`, TOOLS);
        inOverflow = r.inOverflow;
        withChord = r.withChord;
        await page.keyboard.press('Escape');
      }
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.waitForTimeout(1200);
      const wide = await measureBar();
      const m = { narrowDirectVisible: narrow.directVisible, narrowInOverflow: inOverflow, narrowOverflowWithChord: withChord, narrowOverflowButtons: narrow.overflowButtons, narrowOverflowHittable: narrow.overflowHittable, narrowHaspopupCount: narrow.haspopupCount, narrowOverlapPairs: narrow.overlapPairs, narrowBarOverflowPx: narrow.barScrollW - narrow.barClientW, wideDirectVisible: wide.directVisible };
      const hidden = TOOLS.length - m.narrowDirectVisible;
      return { pass: hidden > 0 && m.narrowOverflowButtons === 1 && m.narrowOverflowHittable === 1 && m.narrowInOverflow === hidden && m.narrowOverflowWithChord === hidden && m.narrowOverlapPairs === 0 && m.wideDirectVisible === TOOLS.length, measured: m };
    },
  },

  // ---------------------------------------------------------------- dialogs at 1024x640 and 200 %
  {
    id: 'IS-005',
    surface: 'dialogs',
    title: 'Dialogs (자료집, AI 설정) fit 1024x640 and 200 % zoom with footer buttons above the fold',
    async run(ctx) {
      const { page } = ctx;
      const out = {};
      for (const [key, label] of [['database', '자료집'], ['aiSettings', 'AI 설정 열기']]) {
        await page.setViewportSize({ width: 1024, height: 640 });
        await page.waitForTimeout(400);
        await click(ctx, label, { settleMs: 1500 });
        out[`${key}_1024`] = await pe(page, DIALOG_FIT);
        await page.setViewportSize({ width: 512, height: 320 });
        await page.waitForTimeout(1200);
        out[`${key}_200pct`] = await pe(page, DIALOG_FIT);
        await page.setViewportSize({ width: 1024, height: 640 });
        await page.waitForTimeout(400);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(800);
        if (await layerCount(page)) {
          await pe(page, `const b = [...document.querySelectorAll('[role=dialog] button')].filter(vis).find((b) => /닫기|close/i.test(allNames(b))); b?.click();`);
          await page.waitForTimeout(800);
        }
      }
      const rows = Object.values(out);
      const bad = rows.filter((r) => !r.dialogs || !r.inside || r.footerBelowFold || r.footerUnreachable || r.scrolledContainers).length;
      const m = { checkedStates: rows.length, failingStates: bad };
      for (const [k, r] of Object.entries(out)) {
        m[`${k}_inside`] = r.inside ?? 0;
        m[`${k}_footerBelowFold`] = r.footerBelowFold ?? -1;
        m[`${k}_footerUnreachable`] = r.footerUnreachable ?? -1;
        m[`${k}_dialogBottom`] = r.dialogBottom ?? -1;
      }
      m.detail = out;
      return { pass: bad === 0, measured: m };
    },
  },

  // ---------------------------------------------------------------- 자료집 window
  {
    id: 'IS-076',
    surface: 'db',
    title: '자료집: one selected row with a non-colour marker; filtering and clearing restores selection and scroll',
    async run({ page }) {
      const state = () =>
        pe(page, `
          const rows = [...document.querySelectorAll('.db-list-row')].filter(vis);
          const sel = rows.filter((r) => r.getAttribute('aria-selected') === 'true');
          const list = rows[0]?.closest('[role=grid],[role=listbox],[role=table],.db-list, .virtual-list') || rows[0]?.parentElement;
          let scroller = rows[0]; while (scroller && !(scroller.scrollHeight > scroller.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(scroller).overflowY))) scroller = scroller.parentElement;
          const a = sel[0], b = rows.find((r) => r !== a);
          const csA = a ? getComputedStyle(a) : null, csB = b ? getComputedStyle(b) : null;
          const weightDelta = csA && csB ? Math.abs(parseInt(csA.fontWeight) - parseInt(csB.fontWeight)) : 0;
          const borderDelta = csA && csB ? Math.abs((parseFloat(csA.borderLeftWidth) || 0) - (parseFloat(csB.borderLeftWidth) || 0)) : 0;
          const insetMarker = csA && /inset/.test(csA.boxShadow) && !/inset/.test(csB?.boxShadow || '') ? 1 : 0;
          const iconMarker = a && a.querySelector('[class*=check], [class*=marker], svg[class*=selected]') ? 1 : 0;
          return { rows: rows.length, selectedCount: sel.length, selectedText: a ? textOf(a).slice(0, 20) : '', weightDelta, borderDelta, insetMarker, iconMarker, scrollTop: scroller ? Math.round(scroller.scrollTop) : 0, rowH: a ? Math.round(a.getBoundingClientRect().height) : 0 };`);
      const before = await state();
      const filter = page.locator('input[aria-label="이름 또는 ID 검색"]').first();
      await filter.fill('수호');
      await page.waitForTimeout(700);
      const filtered = await state();
      await filter.fill('');
      await page.waitForTimeout(700);
      const after = await state();
      const nonColourMarker = before.weightDelta >= 200 || before.borderDelta >= 2 || before.insetMarker || before.iconMarker ? 1 : 0;
      const m = { selectedCount: before.selectedCount, nonColourMarker, weightDelta: before.weightDelta, borderDelta: before.borderDelta, rowsBefore: before.rows, rowsFiltered: filtered.rows, rowsAfterClear: after.rows,
        sameSelectionAfterClear: after.selectedText === before.selectedText && after.selectedCount === 1 ? 1 : 0, scrollDeltaPx: Math.abs(after.scrollTop - before.scrollTop), rowH: before.rowH };
      return { pass: m.selectedCount === 1 && nonColourMarker === 1 && m.sameSelectionAfterClear === 1 && m.scrollDeltaPx <= m.rowH, measured: m };
    },
  },
  {
    id: 'IS-075',
    surface: 'db',
    title: '자료집: switching record with a dirty field prompts to apply or discard, naming the record',
    async run({ page }) {
      const field = await pe(page, `
        const dlg = document.querySelector('.database-modal-window');
        const inputs = [...dlg.querySelectorAll('input[type=text], input:not([type]), textarea')].filter(vis).filter((i) => !i.getAttribute('aria-label')?.includes('검색') && i.closest('.db-ws-section, [class*=workspace], [class*=detail], [class*=editor]'));
        const i = inputs[0] || [...dlg.querySelectorAll('input:not([type]), input[type=text]')].filter(vis).filter((x) => !/검색/.test(x.getAttribute('aria-label') || x.placeholder || ''))[0];
        if (!i) return { found: 0 }; i.setAttribute('data-w0-field', '1'); return { found: 1, value: i.value };`);
      if (!field.found) return { pass: false, measured: { fieldFound: 0 } };
      const layersBefore = await layerCount(page);
      const loc = page.locator('[data-w0-field="1"]');
      await loc.click();
      await page.keyboard.press('End');
      await page.keyboard.type('W0');
      await page.waitForTimeout(200);
      const rows = page.locator('.db-list-row');
      await rows.nth(1).click();
      await page.waitForTimeout(900);
      const r = await pe(page, `
        const prompts = [...document.querySelectorAll('[role=alertdialog],[role=dialog]')].filter(vis).filter((d) => !d.classList.contains('database-modal-window'));
        const rows = [...document.querySelectorAll('.db-list-row')].filter(vis);
        return { prompts: prompts.length, promptNamesRecord: prompts.some((p) => /주인공/.test(textOf(p))) ? 1 : 0, firstRowText: textOf(rows[0]).slice(0, 30), selected: textOf(rows.find((x) => x.getAttribute('aria-selected') === 'true') || document.body).slice(0, 12) };`);
      const committedToFirst = /W0/.test(r.firstRowText) ? 1 : 0;
      const m = { fieldFound: 1, layersBefore, promptsAfterSwitch: r.prompts, promptNamesRecord: r.promptNamesRecord, editCommittedImmediately: committedToFirst, switchedTo: r.selected };
      if (r.prompts) await page.keyboard.press('Escape');
      return { pass: m.promptsAfterSwitch >= 1 && m.promptNamesRecord === 1, measured: m };
    },
  },
  {
    id: 'IS-091',
    surface: 'db',
    title: '자료집 record delete asks no confirmation, removes the record and is reverted by one undo',
    async run({ page }) {
      const rowsInfo = (name) =>
        pe(page, `const rows = [...document.querySelectorAll('.db-list-row')].filter((r) => r.getClientRects().length);
          return { total: rows.length, present: arg ? rows.filter((r) => textOf(r).startsWith(arg)).length : 0 };`, name);
      // Party members cannot be deleted while in use (error toast), so delete a record far from the start party.
      const row = page.locator('.db-list-row').nth(14);
      await row.scrollIntoViewIfNeeded();
      await row.click();
      await page.waitForTimeout(600);
      const name = ((await row.innerText()).trim().split(/\s+/)[0]) || '';
      const before = await rowsInfo(name);
      const pressDelete = () => pe(page, `const b = [...document.querySelectorAll('[data-testid="db-delete-selected"]')].filter(vis)[0]; if (!b) return ''; b.click(); return textOf(b);`);
      await pressDelete();
      await page.waitForTimeout(400);
      // The baseline arms the button ("정말 삭제?") and needs a second press within 3 s: that is a confirmation step.
      const armedLabel = await pe(page, `const b = [...document.querySelectorAll('[data-testid="db-delete-selected"]')].filter(vis)[0]; return b ? textOf(b) : '';`);
      const armedConfirm = armedLabel && armedLabel !== '삭제' ? 1 : 0;
      if (armedConfirm) {
        await pressDelete();
        await page.waitForTimeout(900);
      }
      const r = await pe(page, `
        const confirms = [...document.querySelectorAll('[role=alertdialog],[role=dialog]')].filter(vis).filter((d) => !d.classList.contains('database-modal-window'));
        const toasts = [...document.querySelectorAll('.toast-message, [class*=toast] [class*=message]')].filter(vis).map(textOf);
        return { confirms: confirms.length, confirmText: confirms[0] ? textOf(confirms[0]).slice(0, 60) : '', toastText: toasts.join(' / ').slice(0, 80) };`);
      if (r.confirms) {
        const ok = await pe(page, `const d = [...document.querySelectorAll('[role=alertdialog],[role=dialog]')].filter(vis).filter((d) => !d.classList.contains('database-modal-window'))[0];
          const b = [...d.querySelectorAll('button')].filter(vis).find((x) => /삭제|delete/i.test(textOf(x))); if (!b) return 0; b.click(); return 1;`);
        if (!ok) await page.keyboard.press('Escape');
        await page.waitForTimeout(800);
      }
      const after = await rowsInfo(name);
      const undone = await pe(page, `
        const toast = [...document.querySelectorAll('[class*=toast] button, [role=status] button')].filter(vis).find((b) => /되돌리기|실행 취소|undo/i.test(textOf(b)));
        const foot = [...document.querySelectorAll('.database-footer-button')].filter(vis).find((b) => /되돌리기/.test(textOf(b)) && !b.disabled);
        const b = toast || foot; if (!b) return { undoControl: '' }; b.click(); return { undoControl: toast ? 'toast' : 'footer' };`);
      await page.waitForTimeout(900);
      const restored = await rowsInfo(name);
      const m = { deletedName: name, rowsBefore: before.total, rowsAfterDelete: after.total, presentAfterDelete: after.present, armedSecondPressConfirm: armedConfirm, armedLabel, confirmDialogs: r.confirms, confirmText: r.confirmText, toastText: r.toastText,
        undoControl: undone.undoControl, rowsAfterUndo: restored.total, restoredByOneUndo: restored.present > 0 && restored.total === before.total ? 1 : 0, exportOverwriteChecked: 0 };
      return { pass: m.confirmDialogs === 0 && m.armedSecondPressConfirm === 0 && m.rowsAfterDelete === m.rowsBefore - 1 && m.restoredByOneUndo === 1, measured: m };
    },
  },

  // ---------------------------------------------------------------- roles
  {
    id: 'IS-046',
    surface: 'roles',
    title: 'Layer tabs and 자료집 sections are tablists, the map tree has level and expansion, dividers are valued separators',
    async run(ctx) {
      const { page } = ctx;
      const layers = await pe(page, `
        const btns = [...document.querySelectorAll('.left-layer-btn')].filter(vis).filter((b) => !/지형 붓/.test(b.getAttribute('aria-label') || ''));
        const group = btns[0]?.parentElement; const gRole = group?.getAttribute('role') || '';
        const roleOk = btns.filter((b) => (b.getAttribute('role') === 'tab' && b.hasAttribute('aria-selected')) || (b.getAttribute('role') === 'radio' && b.hasAttribute('aria-checked'))).length;
        const seps = [...document.querySelectorAll('.resizer, [class*=resizer], [role=separator]')].filter(vis);
        const sepOk = seps.filter((s) => s.getAttribute('role') === 'separator' && s.tabIndex >= 0 && s.hasAttribute('aria-valuenow')).length;
        return { layerButtons: btns.length, layerGroupIsTablist: /tablist|radiogroup/.test(gRole) ? 1 : 0, layerButtonsWithRoleState: roleOk, separators: seps.length, separatorsValued: sepOk };`);
      await click(ctx, '맵', { settleMs: 1200 });
      const tree = await pe(page, `
        const t = [...document.querySelectorAll('[role=tree]')].filter(vis)[0]; const items = t ? [...t.querySelectorAll('[role=treeitem]')].filter(vis) : [];
        return { treeFound: t ? 1 : 0, treeItems: items.length, itemsWithLevel: items.filter((i) => i.hasAttribute('aria-level')).length, itemsWithExpanded: items.filter((i) => i.hasAttribute('aria-expanded')).length };`);
      await click(ctx, '자료집', { settleMs: 1800 });
      const db = await pe(page, `
        const dlg = document.querySelector('.database-modal-window'); if (!dlg) return { dbOpen: 0 };
        const groups = [...dlg.querySelectorAll('.db-group-strip-btn')].filter(vis); const tabs = [...dlg.querySelectorAll('.db-tab')].filter(vis);
        const groupTabs = groups.filter((b) => b.getAttribute('role') === 'tab' && b.hasAttribute('aria-selected')).length;
        const navTabs = tabs.filter((b) => b.getAttribute('role') === 'tab' && b.hasAttribute('aria-selected')).length;
        return { dbOpen: 1, dbGroupButtons: groups.length, dbGroupButtonsAsTabs: groupTabs, dbSectionButtons: tabs.length, dbSectionButtonsAsTabs: navTabs, dbTabpanels: dlg.querySelectorAll('[role=tabpanel]').length };`);
      const m = { ...layers, ...tree, ...db };
      const pass =
        m.layerGroupIsTablist === 1 && m.layerButtonsWithRoleState === m.layerButtons && m.separators > 0 && m.separatorsValued === m.separators &&
        m.treeFound === 1 && m.itemsWithLevel === m.treeItems && m.itemsWithExpanded === m.treeItems &&
        m.dbOpen === 1 && m.dbGroupButtonsAsTabs === m.dbGroupButtons && m.dbSectionButtonsAsTabs === m.dbSectionButtons && m.dbTabpanels > 0;
      return { pass, measured: m };
    },
  },

  // ---------------------------------------------------------------- map tree
  {
    id: 'IS-103',
    surface: 'maps',
    title: 'Map-tree context menu holds <= 8 enabled rows, destructive rows last, inside a 1024x640 window',
    async run({ page }) {
      const row = page.locator('[role=treeitem]').first();
      await row.click({ button: 'right' });
      await page.waitForTimeout(800);
      let m = await pe(page, `
        const menus = [...document.querySelectorAll('[role=menu], .context-menu, [class*=context-menu]')].filter(vis); const menu = menus[0];
        if (!menu) return { menus: 0 };
        const items = [...menu.querySelectorAll('[role^=menuitem], button')].filter(vis);
        const enabled = items.filter((i) => !i.disabled && i.getAttribute('aria-disabled') !== 'true');
        const destr = items.map((i, n) => (/삭제|지우기|제거|delete|remove/i.test(textOf(i)) || /danger|destructive/.test(i.className) ? n : -1)).filter((n) => n >= 0);
        const r = menu.getBoundingClientRect();
        return { menus: menus.length, items: items.length, enabledItems: enabled.length, destructiveRows: destr.length, destructiveLast: destr.length ? (destr[destr.length - 1] === items.length - 1 && destr.every((n, k) => n === items.length - destr.length + k) ? 1 : 0) : 1,
          insideViewport: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight ? 1 : 0, menuBottom: Math.round(r.bottom), labels: items.map((i) => textOf(i).slice(0, 16)).slice(0, 14) };`);
      m = { via: 'contextmenu', ...m };
      if (!m.menus) {
        await page.keyboard.press('Escape');
        await page.locator('[aria-label$="메뉴"].map-context-trigger').first().click();
        await page.waitForTimeout(800);
        m = { ...(await pe(page, `
          const menu = [...document.querySelectorAll('[role=menu], [class*=context-menu]')].filter(vis)[0]; if (!menu) return { menus: 0 };
          const items = [...menu.querySelectorAll('[role^=menuitem], button')].filter(vis); const enabled = items.filter((i) => !i.disabled && i.getAttribute('aria-disabled') !== 'true');
          const destr = items.map((i, n) => (/삭제|지우기|제거/.test(textOf(i)) ? n : -1)).filter((n) => n >= 0); const r = menu.getBoundingClientRect();
          return { menus: 1, items: items.length, enabledItems: enabled.length, destructiveRows: destr.length, destructiveLast: destr.length ? (destr.every((n, k) => n === items.length - destr.length + k) ? 1 : 0) : 1,
            insideViewport: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight ? 1 : 0, menuBottom: Math.round(r.bottom), labels: items.map((i) => textOf(i).slice(0, 16)).slice(0, 14) };`)), via: 'menu-button' };
      }
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
      return { pass: m.menus >= 1 && m.enabledItems <= 8 && m.destructiveLast === 1 && m.insideViewport === 1, measured: m };
    },
  },
  {
    id: 'IS-067',
    surface: 'maps',
    title: 'F2 starts an inline rename in the map tree and in a 자료집 list',
    async run(ctx) {
      const { page } = ctx;
      await pe(page, `[...document.querySelectorAll('[role=treeitem]')].filter(vis)[0]?.focus();`);
      const focused = await pe(page, `return document.activeElement?.getAttribute('role') === 'treeitem' ? 1 : 0;`);
      const inputsBefore = await pe(page, `return [...document.querySelectorAll('[role=tree] input, .map-tree-list input')].filter(vis).length;`);
      await page.keyboard.press('F2');
      await page.waitForTimeout(700);
      const r = await pe(page, `return { inputs: [...document.querySelectorAll('[role=tree] input, .map-tree-list input, .map-item input')].filter(vis).length, dialogs: [...document.querySelectorAll('[role=dialog]')].filter(vis).length, activeIsInput: /INPUT|TEXTAREA/.test(document.activeElement?.tagName || '') ? 1 : 0 };`);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
      // Same gesture in a 자료집 list.
      await click(ctx, '자료집', { settleMs: 1800 });
      const dbRow = page.locator('.db-list-row').nth(1);
      await dbRow.focus();
      const dbFocused = await pe(page, `return document.activeElement?.classList.contains('db-list-row') ? 1 : 0;`);
      const dbInputsBefore = await pe(page, `return [...document.querySelectorAll('.db-list-row input')].filter(vis).length;`);
      await page.keyboard.press('F2');
      await page.waitForTimeout(700);
      const db = await pe(page, `const a = document.activeElement; return { inRowInputs: [...document.querySelectorAll('.db-list-row input')].filter(vis).length, activeIsInput: /INPUT|TEXTAREA/.test(a?.tagName || '') ? 1 : 0 };`);
      await page.keyboard.press('Escape');
      const m = { rowFocused: focused, inlineInputsBefore: inputsBefore, inlineInputsAfterF2: r.inputs, renameDialogsAfterF2: r.dialogs, activeIsInput: r.activeIsInput,
        dbRowFocused: dbFocused, dbInlineInputsAfterF2: db.inRowInputs - dbInputsBefore, dbActiveIsInputAfterF2: db.activeIsInput, deleteKeyChecked: 0 };
      const mapOk = focused === 1 && m.inlineInputsAfterF2 > inputsBefore && m.activeIsInput === 1;
      const dbOk = dbFocused === 1 && (m.dbInlineInputsAfterF2 > 0 || m.dbActiveIsInputAfterF2 === 1);
      return { pass: mapOk && dbOk, measured: m };
    },
  },

  // ---------------------------------------------------------------- view menu: layout reset (NEW feature)
  {
    id: 'IS-007',
    surface: 'view',
    title: 'View menu has a checked toggle row with a chord for each hideable surface, and one 레이아웃 초기화 command',
    async run(ctx) {
      const { page } = ctx;
      await click(ctx, '보기 — 패널과 언어', { settleMs: 800 });
      const m = await pe(page, `
        const menu = [...document.querySelectorAll('[role=menu]')].filter(vis)[0]; const items = menu ? [...menu.querySelectorAll('[role^=menuitem]')].filter(vis) : [];
        const toggles = items.filter((i) => i.getAttribute('role') === 'menuitemcheckbox');
        const withChord = toggles.filter((i) => i.querySelector('kbd') || /(Ctrl|Cmd|⌘|Alt|F\\d)/.test(textOf(i))).length;
        const names = toggles.map((t) => textOf(t));
        const reset = items.filter((i) => /레이아웃.*(초기화|재설정)|reset layout/i.test(textOf(i))).length;
        return { toggleRows: toggles.length, toggleRowsWithChord: withChord, resetRows: reset, aiPanelToggle: names.some((n) => /AI|조수/.test(n)) ? 1 : 0, canvasToolbarToggle: names.some((n) => /도구/.test(n)) ? 1 : 0, statusToggle: names.some((n) => /상태/.test(n)) ? 1 : 0, names };`);
      await page.keyboard.press('Escape');
      await page.keyboard.press('Control+K');
      await page.waitForTimeout(700);
      await page.keyboard.type('레이아웃');
      await page.waitForTimeout(700);
      const palette = await pe(page, `return [...document.querySelectorAll('[role=option], [role=listbox] *, .command-palette-item, [class*=command-palette] li, [class*=command-palette] button')].filter(vis).filter((e) => /레이아웃/.test(textOf(e)) && /초기화|재설정/.test(textOf(e))).length;`);
      await page.keyboard.press('Escape');
      m.resetCommandsInPalette = palette;
      return { pass: m.resetRows + palette >= 1 && m.toggleRows > 0 && m.toggleRowsWithChord === m.toggleRows && m.aiPanelToggle && m.canvasToolbarToggle && m.statusToggle, measured: m };
    },
  },

  // ---------------------------------------------------------------- app text size (NEW feature)
  {
    id: 'IS-018',
    surface: 'settings',
    title: 'An app-level text-size setting rescales the root font without reload',
    async run(ctx) {
      const { page } = ctx;
      const rootBefore = await pe(page, `return parseFloat(getComputedStyle(document.documentElement).fontSize);`);
      const topBefore = await pe(page, `const b = [...document.querySelectorAll('.oprn-menu-bar button')].filter(vis).find((x) => textOf(x)); return b ? parseFloat(getComputedStyle(b).fontSize) : 0;`);
      await click(ctx, 'AI 설정 열기', { settleMs: 1500 });
      await tryClick(ctx, '표시', { settleMs: 800 });
      const changed = await pe(page, `
        const rows = [...document.querySelectorAll('[role=dialog] *')].filter(vis).filter((e) => !e.children.length && /^글자 크기$|text size|font size/i.test(textOf(e)));
        let sel = null; for (const r of rows) { let p = r.parentElement; for (let k = 0; k < 4 && p && !sel; k++, p = p.parentElement) sel = p.querySelector('select'); if (sel) break; }
        if (!sel) return { controls: rows.length, changedTo: '' };
        const opts = [...sel.options]; const cur = sel.selectedIndex; const next = opts[opts.length - 1 === cur ? 0 : opts.length - 1];
        sel.value = next.value; sel.dispatchEvent(new Event('input', { bubbles: true })); sel.dispatchEvent(new Event('change', { bubbles: true }));
        const desc = (sel.closest('[class*=row]') || sel.parentElement); return { controls: rows.length, changedTo: next.value, scopeText: textOf(desc).slice(0, 60) };`);
      await page.waitForTimeout(700);
      const rootAfter = await pe(page, `return parseFloat(getComputedStyle(document.documentElement).fontSize);`);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
      const topAfter = await pe(page, `const b = [...document.querySelectorAll('.oprn-menu-bar button')].filter(vis).find((x) => textOf(x)); return b ? parseFloat(getComputedStyle(b).fontSize) : 0;`);
      const m = { textSizeControlsFound: changed.controls, rootFontBeforePx: rootBefore, rootFontAfterPx: rootAfter, rootFontDeltaPx: rootAfter - rootBefore, topbarLabelDeltaPx: topAfter - topBefore, changedTo: changed.changedTo, controlScope: changed.scopeText ?? '' };
      return { pass: m.rootFontDeltaPx !== 0, measured: m };
    },
  },

  // ---------------------------------------------------------------- forced colours
  {
    id: 'IS-029',
    surface: 'forced',
    title: 'Under forced colours every surface is opaque and no primary region moves',
    async run({ page }) {
      const rects = () =>
        pe(page, `return ['.oprn-menu-bar', '.ai-chat-sidebar', '.canvas-area', '.palette-work-shell', '.canvas-toolbar'].map((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; });`);
      const before = await rects();
      await page.emulateMedia({ forcedColors: 'active' });
      await page.waitForTimeout(900);
      const after = await rects();
      let maxShift = 0;
      before.forEach((b, i) => {
        if (b && after[i]) maxShift = Math.max(maxShift, ...b.map((v, k) => Math.abs(v - after[i][k])));
      });
      const t = await pe(page, `
        let translucent = 0; const samples = [];
        for (const el of document.querySelectorAll('.oprn-menu-bar *, .ai-chat-sidebar *, .canvas-toolbar, .canvas-toolbar *, [role=dialog], [role=menu]')) { if (!vis(el)) continue;
          const m = getComputedStyle(el).backgroundColor.match(/rgba?\\(([^)]+)\\)/); if (!m) continue; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(parseFloat); const a = p.length > 3 ? p[3] : 1;
          if (a > 0.01 && a < 0.99) { translucent++; if (samples.length < 6) samples.push((el.getAttribute('class') || el.tagName).split(' ')[0] + ' a=' + a); } }
        const bf = [...document.querySelectorAll('body *')].filter(vis).filter((e) => { const s = getComputedStyle(e); return (s.backdropFilter && s.backdropFilter !== 'none'); }).length;
        return { translucentBackgrounds: translucent, backdropFilters: bf, samples };`);
      await page.emulateMedia({ forcedColors: 'none' });
      const m = { maxRectShiftPx: Math.round(maxShift * 10) / 10, regionsMeasured: before.filter(Boolean).length, ...t };
      return { pass: m.maxRectShiftPx <= 1 && m.translucentBackgrounds === 0 && m.backdropFilters === 0, measured: m };
    },
  },

  // ---------------------------------------------------------------- reduced motion
  {
    id: 'IS-061',
    surface: 'motion',
    title: 'With prefers-reduced-motion, no animation is running after scripted transitions',
    async run(ctx) {
      const { page } = ctx;
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.waitForTimeout(500);
      const count = () => pe(page, `const a = document.getAnimations(); return { all: a.length, running: a.filter((x) => x.playState === 'running').length, infinite: a.filter((x) => x.effect?.getTiming?.().iterations === Infinity).length };`);
      const idle = await count();
      const steps = {};
      for (const [k, label] of [['helpMenu', '도움말'], ['database', '자료집']]) {
        await click(ctx, label, { settleMs: 80 });
        steps[k] = await count();
        await page.keyboard.press('Escape');
        await page.waitForTimeout(700);
      }
      const m = { idleAnimations: idle.all, idleInfinite: idle.infinite, helpMenuAnimations: steps.helpMenu.all, databaseAnimations: steps.database.all, runtimeChecked: 0 };
      return { pass: m.idleAnimations + m.helpMenuAnimations + m.databaseAnimations === 0, measured: m };
    },
  },

  // ---------------------------------------------------------------- labels
  {
    id: 'IS-051',
    surface: 'labels',
    title: 'Chrome and menu action labels are <= 24 characters; output/destructive confirms are named for the action',
    async run(ctx) {
      const { page } = ctx;
      const scan = () =>
        pe(page, `
          const els = [...document.querySelectorAll('.oprn-menu-bar button, [role=menu] [role^=menuitem], .canvas-toolbar button, .oprn-tile-toolbar button, [role=dialog] footer button, [class*=footer] button')].filter(vis);
          const long = els.filter((e) => textOf(e).length > 24); const generic = [...document.querySelectorAll('[role=dialog] button, [role=alertdialog] button')].filter(vis).filter((b) => /^(확인|OK)$/i.test(textOf(b))).length;
          return { labels: els.length, over24: long.length, generic, samples: long.map((e) => textOf(e) + ' (' + textOf(e).length + ')').slice(0, 6) };`);
      const main = await scan();
      await click(ctx, '새 프로젝트', { settleMs: 800 });
      const menu = await scan();
      await page.keyboard.press('Escape');
      const m = { labelsChecked: main.labels + menu.labels, over24Count: main.over24 + menu.over24, genericConfirmButtons: main.generic + menu.generic, samples: [...main.samples, ...menu.samples] };
      return { pass: m.over24Count === 0 && m.genericConfirmButtons === 0, measured: m };
    },
  },

  // ---------------------------------------------------------------- help in English
  {
    id: 'IS-072',
    surface: 'helpEn',
    title: 'Help opened in English shows no Hangul outside examples and every image has alt text',
    async run({ page }) {
      const m = await pe(page, `
        const dlg = [...document.querySelectorAll('[role=dialog]')].filter(vis).sort((a,b)=>b.getBoundingClientRect().height-a.getBoundingClientRect().height)[0];
        if (!dlg) return { helpOpen: 0 };
        const clone = dlg.cloneNode(true); clone.querySelectorAll('code, kbd, pre, [class*=example], [lang=ko]').forEach((e) => e.remove());
        const text = clone.textContent || ''; const hangul = (text.match(/[\\uAC00-\\uD7A3]/g) || []).length; const latin = (text.match(/[A-Za-z]/g) || []).length;
        const imgs = [...dlg.querySelectorAll('img')]; const noAlt = imgs.filter((i) => !(i.getAttribute('alt') || '').trim()).length;
        const samples = (text.match(/[\\uAC00-\\uD7A3][\\uAC00-\\uD7A3 ]{2,20}/g) || []).slice(0, 6);
        return { helpOpen: 1, hangulChars: hangul, latinChars: latin, images: imgs.length, imagesWithoutAlt: noAlt, samples };`);
      return { pass: m.helpOpen === 1 && m.hangulChars === 0 && m.imagesWithoutAlt === 0, measured: m };
    },
  },

  // ---------------------------------------------------------------- IME in the command palette
  {
    id: 'IS-071',
    surface: 'cmdk',
    title: 'IME composition in the command palette and an inspector field yields the composed string; composing Enter does not submit',
    async run(ctx) {
      const { page } = ctx;
      await page.keyboard.press('Control+K');
      await page.waitForTimeout(800);
      const focused = await pe(page, `const a = document.activeElement; if (!a || !/INPUT|TEXTAREA/.test(a.tagName)) return 0; a.setAttribute('data-w0-ime', '1'); return 1;`);
      if (!focused) return { pass: false, measured: { paletteInputFocused: 0 } };
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Input.imeSetComposition', { text: '안녕하', selectionStart: 3, selectionEnd: 3 });
      await cdp.send('Input.imeSetComposition', { text: '안녕하세', selectionStart: 4, selectionEnd: 4 });
      await cdp.send('Input.insertText', { text: '안녕하세요' });
      await page.waitForTimeout(400);
      const value = await page.locator('[data-w0-ime="1"]').inputValue();
      const layersBefore = await layerCount(page);
      const url = page.url();
      await pe(page, `const i = document.querySelector('[data-w0-ime="1"]'); i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 229, isComposing: true, bubbles: true, cancelable: true }));`);
      await page.waitForTimeout(700);
      const after = await pe(page, `const i = document.querySelector('[data-w0-ime="1"]'); return { stillThere: i && vis(i) ? 1 : 0, value: i ? i.value : '' };`);
      const layersAfter = await layerCount(page);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(600);
      // Same composition in an inspector field (자료집 record name).
      await click(ctx, '자료집', { settleMs: 1800 });
      const fieldFound = await pe(page, `const dlg = document.querySelector('.database-modal-window'); const i = dlg && [...dlg.querySelectorAll('input:not([type]), input[type=text]')].filter(vis).filter((x) => !/검색/.test(x.getAttribute('aria-label') || x.placeholder || ''))[0];
        if (!i) return 0; i.setAttribute('data-w0-ime2', '1'); i.focus(); i.select(); return 1;`);
      let fieldEqual = 0;
      if (fieldFound) {
        await cdp.send('Input.imeSetComposition', { text: '안녕', selectionStart: 2, selectionEnd: 2 });
        await cdp.send('Input.imeSetComposition', { text: '안녕하세', selectionStart: 4, selectionEnd: 4 });
        await cdp.send('Input.insertText', { text: '안녕하세요' });
        await page.waitForTimeout(400);
        fieldEqual = (await page.locator('[data-w0-ime2="1"]').inputValue()) === '안녕하세요' ? 1 : 0;
      }
      const m = { paletteInputFocused: 1, composedEqual: value === '안녕하세요' ? 1 : 0, composedLength: value.length, paletteOpenAfterComposingEnter: after.stillThere, layersBefore, layersAfter, navigated: page.url() === url ? 0 : 1,
        inspectorFieldFound: fieldFound, inspectorComposedEqual: fieldEqual, aiPromptChecked: 0, eventEditorChecked: 0 };
      return { pass: m.composedEqual === 1 && m.paletteOpenAfterComposingEnter === 1 && m.layersAfter === m.layersBefore && m.navigated === 0 && m.inspectorComposedEqual === 1, measured: m };
    },
  },

  // ---------------------------------------------------------------- C-114 guide escape focus
  {
    id: 'C-114',
    surface: 'guide',
    title: 'Closing the editor guide with Escape returns focus to a control (not <body>)',
    async run({ page }) {
      await page.keyboard.press('Control+K');
      await page.waitForTimeout(800);
      await page.keyboard.type('단축');
      await page.waitForTimeout(800);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1500);
      const opened = await layerCount(page);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(900);
      const r = await pe(page, `const a = document.activeElement; return { layersAfter: [...document.querySelectorAll(LAYERS)].filter(vis).length, focusOnBody: !a || a === document.body ? 1 : 0, focusedTag: a ? a.tagName.toLowerCase() : '', focusedName: a && a !== document.body ? nameOf(a).slice(0, 30) : '' };`);
      const m = { guideLayersOpen: opened, ...r };
      return { pass: opened >= 1 && r.layersAfter === 0 && r.focusOnBody === 0, measured: m };
    },
  },

  // ---------------------------------------------------------------- paint + undo
  {
    id: 'IS-089',
    surface: 'paint',
    title: 'Undo/redo buttons are visible, disabled at the start of history and named with the operation they reverse',
    async run({ page }) {
      const read = () =>
        pe(page, `const f = (n) => [...document.querySelectorAll('.oprn-tile-tool')].filter(vis).find((b) => (b.getAttribute('aria-label') || '') === n || (b.getAttribute('aria-label') || '').startsWith(n + ':') || (b.getAttribute('aria-label') || '').startsWith(n + ' '));
          const u = f('되돌리기'), r = f('다시실행'); const dis = (b) => (b && (b.disabled || b.getAttribute('aria-disabled') === 'true') ? 1 : 0);
          return { undoFound: u ? 1 : 0, redoFound: r ? 1 : 0, undoDisabled: dis(u), redoDisabled: dis(r), undoName: u ? (u.getAttribute('aria-label') || '') + ' | ' + (u.getAttribute('title') || '') : '' };`);
      const start = await read();
      const clip = await canvasClip(page);
      await page.mouse.click(clip.x + clip.width / 2, clip.y + clip.height / 2);
      await page.waitForTimeout(700);
      const after = await read();
      const m = { undoFound: start.undoFound, redoFound: start.redoFound, undoDisabledAtStart: start.undoDisabled, redoDisabledAtStart: start.redoDisabled, undoEnabledAfterEdit: after.undoDisabled ? 0 : 1, undoNameChangedAfterEdit: after.undoName !== start.undoName ? 1 : 0, undoNameBefore: start.undoName, undoNameAfter: after.undoName };
      return { pass: m.undoFound && m.redoFound && m.undoDisabledAtStart === 1 && m.undoEnabledAfterEdit === 1 && m.undoNameChangedAfterEdit === 1, measured: m };
    },
  },
  {
    id: 'IS-090',
    surface: 'paint',
    title: 'One 20-tile stroke is reverted by a single Ctrl+Z, and five separate edits by five Ctrl+Z',
    async run({ page }) {
      await page.addStyleTag({ content: '.toast-stack, [class*=toast] { visibility: hidden !important; }' });
      const full = await canvasClip(page);
      // Compare only the map band: the floating toolbar sits at the top and undo toasts stack at the bottom-left.
      const clip = { x: full.x, y: full.y + 60, width: full.width, height: full.height - 160 };
      const park = () => page.mouse.move(5, full.y + full.height - 5);
      await page.keyboard.press('Control+Z');
      await page.waitForTimeout(500);
      await park();
      await page.waitForTimeout(400);
      const base = await shot(page, clip, 'is090-base');
      const y = clip.y + clip.height / 2 - 40;
      const x0 = clip.x + clip.width / 2 - 320;
      await page.mouse.move(x0 + 4, y);
      await page.mouse.down();
      for (let i = 1; i <= 40; i++) await page.mouse.move(x0 + 4 + i * 15.5, y);
      await page.mouse.up();
      await park();
      await page.waitForTimeout(500);
      const stroked = await shot(page, clip, 'is090-stroked');
      await page.keyboard.press('Control+Z');
      await page.waitForTimeout(700);
      const undone = await shot(page, clip, 'is090-undone');
      for (let i = 0; i < 5; i++) {
        await page.mouse.click(clip.x + clip.width / 2 - 200 + i * 80, clip.y + clip.height / 2 + 80);
        await page.waitForTimeout(150);
      }
      await park();
      await page.waitForTimeout(400);
      const five = await shot(page, clip, 'is090-five');
      for (let i = 0; i < 5; i++) {
        await page.keyboard.press('Control+Z');
        await page.waitForTimeout(200);
      }
      await page.waitForTimeout(500);
      const fiveUndone = await shot(page, clip, 'is090-fiveUndone');
      const m = {
        strokeChangedPx: await diffPx(page, base, stroked),
        afterOneUndoDiffPx: await diffPx(page, base, undone),
        fiveEditsChangedPx: await diffPx(page, base, five),
        afterFiveUndoDiffPx: await diffPx(page, base, fiveUndone),
      };
      return { pass: m.strokeChangedPx > 2000 && m.afterOneUndoDiffPx <= 200 && m.fiveEditsChangedPx > 200 && m.afterFiveUndoDiffPx <= 200, measured: m };
    },
  },

  // ---------------------------------------------------------------- keyboard reach (C-106, IS-104)
  {
    id: 'C-106',
    surface: 'keyboard',
    title: 'The palette is one Tab stop and is reached in few Tab presses',
    async run({ page }) {
      const stops = await pe(page, `const w = document.querySelector('.palette-card-window'); if (!w) return { cards: 0 }; const f = [...w.querySelectorAll(INTERACTIVE + ',[tabindex]')].filter(vis); return { cards: f.length, tabStops: f.filter((e) => e.tabIndex >= 0).length };`);
      await pe(page, `document.activeElement?.blur?.();`);
      let reachedAt = 0;
      for (let i = 1; i <= 60; i++) {
        await page.keyboard.press('Tab');
        const inPal = await pe(page, `const w = document.querySelector('.palette-card-window'); return w && w.contains(document.activeElement) ? 1 : 0;`);
        if (inPal) {
          reachedAt = i;
          break;
        }
      }
      let paletteTabsInside = 0;
      if (reachedAt) {
        for (let i = 0; i < 10; i++) {
          await page.keyboard.press('Tab');
          if (await pe(page, `const w = document.querySelector('.palette-card-window'); return w && w.contains(document.activeElement) ? 1 : 0;`)) paletteTabsInside++;
          else break;
        }
      }
      const m = { paletteCards: stops.cards, paletteTabStops: stops.tabStops, tabsToReachPalette: reachedAt || 61, consecutiveTabsInsidePalette: paletteTabsInside };
      return { pass: m.paletteTabStops <= 1 && m.tabsToReachPalette <= 12 && m.consecutiveTabsInsidePalette === 0, measured: m };
    },
  },
  {
    id: 'IS-104',
    surface: 'keyboard',
    title: 'Palette pick and canvas placement have keyboard equivalents',
    async run({ page }) {
      const sel = () => pe(page, `const w = document.querySelector('.palette-card-window'); const s = w ? [...w.querySelectorAll('.is-selected, .selected, .active, [aria-selected=true], [aria-pressed=true]')].filter(vis) : []; return s.map((e) => textOf(e).slice(0, 20)).join('|');`);
      const before = await sel();
      const target = await pe(page, `const w = document.querySelector('.palette-card-window'); const c = [...w.querySelectorAll(INTERACTIVE + ',[tabindex]')].filter(vis); const t = c[c.length - 1]; if (!t) return 0; t.setAttribute('data-w0-card', '1'); return 1;`);
      if (target) {
        await page.locator('[data-w0-card="1"]').focus();
        await page.keyboard.press('Enter');
        await page.waitForTimeout(600);
      }
      const after = await sel();
      const canvas = await pe(page, `const c = document.querySelector('.phaser-container canvas'); const host = c?.closest('[tabindex]'); return { canvasTabIndex: c ? c.tabIndex : -9, hostFocusable: host && host.tabIndex >= 0 ? 1 : 0 };`);
      const m = { keyboardPickChangedSelection: before !== after ? 1 : 0, canvasKeyboardFocusable: canvas.canvasTabIndex >= 0 || canvas.hostFocusable ? 1 : 0, canvasTabIndex: canvas.canvasTabIndex, storeDragChecked: 0 };
      return { pass: m.keyboardPickChangedSelection === 1 && m.canvasKeyboardFocusable === 1, measured: m };
    },
  },

  // ---------------------------------------------------------------- test play
  {
    id: 'IS-083',
    surface: 'play',
    title: 'Test play takes keyboard focus so, after the opening, the first ArrowDown (no click) changes the game picture',
    async run(ctx) {
      const { page } = ctx;
      await click(ctx, '테스트 실행', { settleMs: 6000 });
      const focus = await pe(page, `const m = document.querySelector('.test-play-modal-backdrop'); return { modalOpen: m && vis(m) ? 1 : 0, focusInModal: m && m.contains(document.activeElement) ? 1 : 0, focusedClass: (document.activeElement?.className || '').toString().slice(0, 30) };`);
      // The game window is the largest box inside the backdrop; its first 32 px are the title strip.
      const clip = await pe(page, `const m = document.querySelector('.test-play-modal-backdrop'); const mr = m.getBoundingClientRect();
        const w = [...m.querySelectorAll('div, section')].filter(vis).map((e) => [e, e.getBoundingClientRect()]).filter(([, r]) => r.width < mr.width - 4 || r.height < mr.height - 4).sort((a, b) => b[1].width * b[1].height - a[1].width * a[1].height)[0];
        if (!w) return null; const r = w[1]; return { x: Math.round(r.left), y: Math.round(r.top + 32), width: Math.round(r.width), height: Math.round(r.height - 40) };`);
      const opening = () => pe(page, `return [...document.querySelectorAll('.test-play-modal-backdrop [class*=cinematic]')].filter(vis).length;`);
      const openingShown = await opening();
      // Skip the opening cinematic with its own key (Escape) - a key press, not a click.
      if (openingShown) {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(3500);
      }
      const stillOpen = await layerCount(page);
      const a = await shot(page, clip, 'is083-a');
      await page.waitForTimeout(500);
      const b = await shot(page, clip, 'is083-b');
      await page.keyboard.down('ArrowDown');
      await page.waitForTimeout(500);
      await page.keyboard.up('ArrowDown');
      await page.waitForTimeout(400);
      const c = await shot(page, clip, 'is083-c');
      const idle = await diffPx(page, a, b);
      const key = await diffPx(page, b, c);
      const m = { ...focus, openingCinematic: openingShown ? 1 : 0, modalOpenAfterSkip: stillOpen ? 1 : 0, idleChangePx: idle, keyChangePx: key };
      return { pass: m.focusInModal === 1 && m.modalOpenAfterSkip === 1 && key > idle * 2 + 100, measured: m };
    },
  },
  {
    id: 'IS-084',
    surface: 'play',
    title: 'During test play editor panels are hidden and one strip shows map name and an exit back to the editor',
    async run({ page }) {
      const m = await pe(page, `
        const modal = document.querySelector('.test-play-modal-backdrop'); if (!modal) return { modalOpen: 0 };
        const probes = ['.ai-chat-sidebar', '.palette-work-shell', '.oprn-menu-bar', '.left-activity-item'].map((s) => document.querySelector(s)).filter(Boolean);
        let editorHit = 0; for (const p of probes) { const r = p.getBoundingClientRect(); if (r.width < 2) continue; const h = document.elementFromPoint(r.left + r.width / 2, r.top + Math.min(r.height / 2, 20)); if (h && !modal.contains(h)) editorHit++; }
        const mapName = (document.querySelector('.map-item.active .map-item-name, .map-item.active') ? textOf(document.querySelector('.map-item.active')).split(' ')[0] : '빈 맵');
        const strip = modal.querySelector('header, [class*=toolbar], [class*=titlebar], [class*=header]') || modal;
        const exit = [...modal.querySelectorAll('button')].filter(vis).find((b) => /편집/.test(allNames(b)));
        return { modalOpen: 1, editorPanelsHittable: editorHit, stripHasMapName: textOf(strip).includes('빈 맵') ? 1 : 0, stripText: textOf(strip).slice(0, 50), exitFound: exit ? 1 : 0, exitNameSaysReturn: exit && /돌아가기|편집기로/.test(nameOf(exit)) ? 1 : 0, exitName: exit ? nameOf(exit) : '' };`);
      return { pass: m.modalOpen === 1 && m.editorPanelsHittable === 0 && m.stripHasMapName === 1 && m.exitNameSaysReturn === 1, measured: m };
    },
  },
  {
    id: 'C-90',
    surface: 'play',
    title: 'While test play is open, editor controls behind it are inert and Tab stays inside the window',
    async run({ page }) {
      const m = await pe(page, `
        const modal = document.querySelector('.test-play-modal-backdrop'); if (!modal) return { modalOpen: 0 };
        const outside = [...document.querySelectorAll(INTERACTIVE)].filter((e) => !modal.contains(e) && e.getClientRects().length && !e.closest('[inert],[aria-hidden=true]') && !e.disabled && e.tabIndex >= 0);
        return { modalOpen: 1, editorFocusableBehind: outside.length };`);
      let escapes = 0;
      for (let i = 0; i < 12; i++) {
        await page.keyboard.press('Tab');
        escapes += await pe(page, `const m = document.querySelector('.test-play-modal-backdrop'); const a = document.activeElement; return m && a && a !== document.body && !m.contains(a) ? 1 : 0;`);
      }
      m.tabPressesLeavingModal = escapes;
      return { pass: m.modalOpen === 1 && m.editorFocusableBehind === 0 && escapes === 0, measured: m };
    },
  },
  {
    id: 'IS-085',
    surface: 'play',
    title: 'Escape in test play opens a pause surface (never quits); a second Escape resumes',
    async run({ page }) {
      await pe(page, `const c = document.querySelector('.test-play-modal-backdrop canvas'); c?.focus?.();`);
      const pauseCount = () => pe(page, `const m = document.querySelector('.test-play-modal-backdrop'); if (!m) return { open: 0, pause: 0 }; return { open: vis(m) ? 1 : 0, pause: [...m.querySelectorAll('*')].filter(vis).filter((e) => !e.children.length && /일시정지|일시 정지|paused|계속하기/i.test(textOf(e))).length };`);
      const before = await pauseCount();
      await page.keyboard.press('Escape');
      await page.waitForTimeout(900);
      const first = await pauseCount();
      await page.keyboard.press('Escape');
      await page.waitForTimeout(900);
      const second = await pauseCount();
      const m = { openBefore: before.open, openAfterFirstEscape: first.open, pauseLabelsAfterFirstEscape: first.pause, openAfterSecondEscape: second.open, pauseLabelsAfterSecondEscape: second.pause, blurPauseChecked: 0 };
      return { pass: m.openAfterFirstEscape === 1 && m.pauseLabelsAfterFirstEscape >= 1 && m.openAfterSecondEscape === 1 && m.pauseLabelsAfterSecondEscape === 0, measured: m };
    },
  },
  {
    id: 'IS-086',
    surface: 'playRestore',
    title: 'Leaving test play restores the layer, tool, zoom and scroll exactly',
    async run(ctx) {
      const { page } = ctx;
      await tryClick(ctx, '상위 레이어', { settleMs: 500 });
      await tryClick(ctx, '지우개', { settleMs: 500 });
      await tryClick(ctx, '확대', { settleMs: 500 });
      const state = () =>
        pe(page, `const layer = [...document.querySelectorAll('.left-layer-btn.is-active')].filter(vis).map((e) => e.getAttribute('aria-label')).join(',');
          const tool = [...document.querySelectorAll('.oprn-tile-tool.active')].filter(vis).map((e) => e.getAttribute('aria-label')).join(',');
          const zoom = [...document.querySelectorAll('.canvas-toolbar *')].filter(vis).filter((e) => !e.children.length && /^\\d+(\\.\\d+)?x$|%$/.test(textOf(e))).map(textOf).join(',');
          const s = document.querySelector('.editor-canvas-scroll-shell'); const pal = [...document.querySelectorAll('.palette-card-window .is-selected, .palette-card-window [aria-pressed=true], .palette-card-window .selected')].map(textOf).join('|');
          return { layer, tool, zoom, scrollX: s ? Math.round(s.scrollLeft) : 0, scrollY: s ? Math.round(s.scrollTop) : 0, rail: [...document.querySelectorAll('.left-activity-item[aria-pressed=true], .left-activity-item.is-active, .left-activity-item[aria-selected=true]')].map((e) => textOf(e)).join(','), palette: pal.slice(0, 40) };`);
      const before = await state();
      await click(ctx, '테스트 실행', { settleMs: 5000 });
      const opened = await layerCount(page);
      const exit = await pe(page, `const b = [...document.querySelectorAll('.test-play-modal-backdrop button')].filter(vis).find((x) => /편집으로/.test(allNames(x))); if (!b) return 0; b.click(); return 1;`);
      await page.waitForTimeout(1500);
      const after = await state();
      const keys = ['layer', 'tool', 'zoom', 'scrollX', 'scrollY', 'rail', 'palette'];
      const differing = keys.filter((k) => String(before[k]) !== String(after[k]));
      const m = { playOpened: opened > 0 ? 1 : 0, exitClicked: exit, fieldsCompared: keys.length, fieldsDiffering: differing.length, differing, before, after };
      return { pass: m.playOpened === 1 && exit === 1 && m.fieldsDiffering === 0, measured: m };
    },
  },

  // ---------------------------------------------------------------- C-09 overlay chrome consistency
  {
    id: 'C-09',
    surface: 'overlays',
    title: 'Overlays share one close button, backdrop and footer treatment',
    async run(ctx) {
      const { page } = ctx;
      const rows = {};
      for (const [k, label] of [['assets', '소재'], ['music', '음악·효과음'], ['find', '맵·이벤트 찾기'], ['aiSettings', 'AI 설정 열기'], ['database', '자료집']]) {
        if (!(await tryClick(ctx, label, { settleMs: 1500 }))) {
          rows[k] = { opened: 0 };
          continue;
        }
        rows[k] = await pe(page, `
          const d = [...document.querySelectorAll('[role=dialog],[aria-modal=true]')].filter(vis).sort((a,b)=>b.getBoundingClientRect().width*b.getBoundingClientRect().height-a.getBoundingClientRect().width*a.getBoundingClientRect().height)[0];
          if (!d) return { opened: 0 };
          const close = [...d.querySelectorAll('button')].filter(vis).find((b) => /닫기|close/i.test(allNames(b)) && b.getBoundingClientRect().top < d.getBoundingClientRect().top + 70);
          const cr = close ? close.getBoundingClientRect() : null;
          let bd = d.parentElement; while (bd && bd !== document.body && getComputedStyle(bd).position !== 'fixed') bd = bd.parentElement; const backdrop = bd && bd !== document.body ? getComputedStyle(bd).backgroundColor : 'none';
          const footer = d.querySelector('footer, [class*=footer]') && vis(d.querySelector('footer, [class*=footer]')) ? 1 : 0;
          return { opened: 1, closeW: cr ? Math.round(cr.width) : 0, closeH: cr ? Math.round(cr.height) : 0, closeTopRight: cr ? (d.getBoundingClientRect().right - cr.right < 40 ? 1 : 0) : 0, backdrop, footer };`);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(700);
        if (await layerCount(page)) {
          await pe(page, `const b = [...document.querySelectorAll('[role=dialog] button')].filter(vis).find((b) => /닫기|close/i.test(allNames(b))); b?.click();`);
          await page.waitForTimeout(700);
        }
      }
      const opened = Object.values(rows).filter((r) => r.opened);
      const distinct = (f) => new Set(opened.map(f)).size;
      const m = {
        overlaysOpened: opened.length,
        distinctCloseSizes: distinct((r) => `${r.closeW}x${r.closeH}`),
        closeUnder32: opened.filter((r) => Math.min(r.closeW, r.closeH) < 32).length,
        missingCloseButton: opened.filter((r) => !r.closeW).length,
        distinctBackdrops: distinct((r) => r.backdrop),
        distinctFooterPresence: distinct((r) => r.footer),
        rows,
      };
      return { pass: m.overlaysOpened >= 4 && m.distinctCloseSizes === 1 && m.closeUnder32 === 0 && m.missingCloseButton === 0 && m.distinctBackdrops === 1 && m.distinctFooterPresence === 1, measured: m };
    },
  },

  // ---------------------------------------------------------------- C-74 assistant draft overwrite
  {
    id: 'C-74',
    surface: 'ai',
    title: 'A suggestion from another entry point does not silently overwrite the assistant draft',
    async run(ctx) {
      const { page } = ctx;
      await tryClick(ctx, 'AI 패널 펼치기', { settleMs: 1200 });
      const found = await pe(page, `const t = [...document.querySelectorAll('textarea, [contenteditable=true]')].filter(vis).filter((e) => !e.disabled && !e.readOnly)[0]; if (!t) return 0; t.setAttribute('data-w0-draft', '1'); return 1;`);
      if (!found) return { pass: false, measured: { composerFound: 0 } };
      const box = page.locator('[data-w0-draft="1"]');
      await box.click();
      await page.keyboard.type('테스트 초안');
      await page.waitForTimeout(300);
      const typed = await box.evaluate((e) => e.value ?? e.textContent);
      const peek = await tryClick(ctx, '살펴볼 것 1개', { settleMs: 1000 });
      let acted = 0;
      if (peek) {
        acted = await pe(page, `
          const cards = [...document.querySelectorAll('[class*=suggestion] button, [class*=peek] button, [role=dialog] button, [class*=popover] button')].filter(vis).filter((b) => !/닫기|close|접기/i.test(nameOf(b)) && !b.closest('[data-w0-draft]'));
          const b = cards.find((x) => /요청|실행|맡기|AI|고치|보내|채우/.test(nameOf(x))) || cards[0]; if (!b) return 0; b.setAttribute('data-w0-act', nameOf(b).slice(0, 30)); b.click(); return 1;`);
        await page.waitForTimeout(1200);
      }
      const actName = await pe(page, `return document.querySelector('[data-w0-act]')?.getAttribute('data-w0-act') || '';`);
      const r = await pe(page, `const t = document.querySelector('[data-w0-draft="1"]'); const v = t ? (t.value ?? t.textContent) : '';
        const confirm = [...document.querySelectorAll('[role=alertdialog],[role=dialog],[class*=toast],[role=status]')].filter(vis).filter((e) => /덮어|교체|바꿀까|되돌리기|이전 초안|덧붙/.test(textOf(e))).length;
        return { value: v, confirmOrUndo: confirm };`);
      const m = { composerFound: 1, draftTyped: typed === '테스트 초안' ? 1 : 0, suggestionActed: acted, actedOn: actName, draftKept: r.value.includes('테스트 초안') ? 1 : 0, draftLengthAfter: r.value.length, replaceConfirmOrUndo: r.confirmOrUndo };
      return { pass: m.suggestionActed === 1 && (m.draftKept === 1 || m.replaceConfirmOrUndo >= 1), measured: m };
    },
  },

  // ---------------------------------------------------------------- volatile session badge
  {
    id: 'IS-093',
    surface: 'env',
    title: 'A volatile session shows a persistent 저장 안 됨 indicator on every screen',
    async run(ctx) {
      const { page } = ctx;
      const count = () => pe(page, `return [...document.querySelectorAll('body *')].filter(vis).filter((e) => !e.children.length && /저장 안 됨|저장되지 않|임시 세션|not saved|unsaved/i.test(textOf(e))).length;`);
      const out = { mainScreen: await count() };
      for (const [k, label] of [['database', '자료집'], ['aiSettings', 'AI 설정 열기'], ['testPlay', '테스트 실행']]) {
        await click(ctx, label, { settleMs: k === 'testPlay' ? 5000 : 1500 });
        out[k] = await count();
        await page.keyboard.press('Escape');
        await page.waitForTimeout(900);
        if (await layerCount(page)) {
          await pe(page, `const b = [...document.querySelectorAll('[role=dialog] button')].filter(vis).find((b) => /닫기|close|편집으로/i.test(allNames(b))); b?.click();`);
          await page.waitForTimeout(900);
        }
      }
      const screens = Object.keys(out).length;
      const without = Object.values(out).filter((n) => n === 0).length;
      return { pass: without === 0, measured: { screensChecked: screens, screensWithoutBadge: without, ...out, storeFailureForced: 0 } };
    },
  },
  {
    id: 'ENV',
    surface: 'env',
    title: 'Dist environment facts that decide not-measurable rows (exported player, store server, AI, persistence)',
    async run(ctx) {
      const { page } = ctx;
      const player = await page.evaluate(async () => {
        const idx = await (await fetch('/')).text();
        const res = await fetch('/player.html');
        const t = await res.text();
        return { playerHtmlStatus: res.status, playerHtmlIsIndexFallback: t === idx ? 1 : 0, playerHtmlBytes: t.length };
      });
      const volatile = await pe(page, `return [...document.querySelectorAll('button')].filter(vis).filter((b) => /저장 안 됨/.test(textOf(b))).length;`);
      await tryClick(ctx, '에셋 스토어', { settleMs: 4000 });
      const store = await pe(page, `
        const pane = [...document.querySelectorAll('[class*=store]')].filter(vis).sort((a,b)=>b.getBoundingClientRect().height-a.getBoundingClientRect().height)[0];
        if (!pane) return { storePaneFound: 0, storeCards: 0, storeImages: 0 };
        return { storePaneFound: 1, storeCards: pane.querySelectorAll('[class*=card]').length, storeImages: [...pane.querySelectorAll('img')].filter(vis).length, storeErrorText: /오류|실패|연결|불러오지|error|offline/i.test(textOf(pane)) ? 1 : 0, storeText: textOf(pane).slice(0, 80) };`);
      const ai = await pe(page, `return { aiLockScrims: document.querySelectorAll('.ai-lock-scrim').length, aiBridgeParam: new URLSearchParams(location.search).get('aiBridge') === '0' ? 1 : 0 };`);
      // Export in the web dist: the web-bundle export needs a deployed player manifest; the desktop exports need Electron.
      const layersBeforeExport = await layerCount(page);
      await click(ctx, '새 프로젝트', { settleMs: 800 });
      await tryClick(ctx, '웹 서버 번들 내보내기 (.zip)...', { settleMs: 3000 });
      const exp = await pe(page, `return { exportDialogs: [...document.querySelectorAll('[role=dialog],[aria-modal=true]')].filter(vis).length,
        exportErrorToasts: [...document.querySelectorAll('[class*=toast]')].filter(vis).filter((e) => /실패|failed|manifest/i.test(textOf(e))).length,
        exportErrorText: ([...document.querySelectorAll('[class*=toast]')].filter(vis).map(textOf).find((t) => /실패|failed/i.test(t)) || '').slice(0, 90) };`);
      return { pass: true, measured: { ...player, volatileSessionBadges: volatile, ...store, ...ai, layersBeforeExport, ...exp } };
    },
  },

  // ---------------------------------------------------------------- first launch
  {
    id: 'IS-100',
    surface: 'first',
    title: 'A fresh profile reaches a paintable canvas after at most one dialog and with no sign-in prompt',
    async run({ page }) {
      let dialogsSeen = 0;
      let signIn = 0;
      let canvasAt = 0;
      const seen = new Set();
      let landing = '';
      for (let i = 0; i < 40; i++) {
        const s = await pe(page, `
          const ds = [...document.querySelectorAll('[role=dialog],[role=alertdialog],[aria-modal=true],dialog[open]')].filter(vis).map((d) => (d.getAttribute('aria-label') || textOf(d).slice(0, 30)));
          const canvas = [...document.querySelectorAll('.phaser-container canvas')].filter(vis).length && ![...document.querySelectorAll('[aria-modal=true]')].filter(vis).length ? 1 : 0;
          const login = [...document.querySelectorAll('body *')].filter(vis).filter((e) => !e.children.length && /^(로그인|sign in|log in)$/i.test(textOf(e))).length;
          return { ds, canvas, login, title: document.title, body: textOf(document.body).slice(0, 80) };`);
        if (!landing) landing = s.body;
        for (const d of s.ds) seen.add(d);
        signIn = Math.max(signIn, s.login);
        if (s.canvas) {
          canvasAt = i + 1;
          break;
        }
        await page.waitForTimeout(500);
      }
      dialogsSeen = seen.size;
      const m = { dialogsBeforeCanvas: dialogsSeen, signInPrompts: signIn, canvasReached: canvasAt ? 1 : 0, pollsToCanvas: canvasAt, dialogs: [...seen].slice(0, 4), landing };
      return { pass: m.canvasReached === 1 && m.dialogsBeforeCanvas <= 1 && m.signInPrompts === 0, measured: m };
    },
  },
];
