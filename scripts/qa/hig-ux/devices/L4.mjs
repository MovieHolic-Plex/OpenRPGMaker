// Lane L4 devices: canvas, left dock, tile palette, map list and map settings (plan todos 7, 8, 9)
// plus the wave-0 rows classified as L4 failures (re-used from wave0.mjs as the baseline-fail proof).
// Every device returns measured numbers; each asserts only on L4-owned surfaces.
import { surfaces as W0_SURFACES, devices as W0_DEVICES } from './wave0.mjs';

const VIS = `
  const vis = (el) => { if (!el || el.nodeType !== 1) return false; const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return false;
    const s = getComputedStyle(el); return s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.02 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth; };
  const textOf = (el) => (el?.innerText || '').replace(/\\s+/g, ' ').trim();
  const nameOf = (el) => (el.getAttribute('aria-label') || (el.getAttribute('aria-labelledby') && document.getElementById(el.getAttribute('aria-labelledby'))?.innerText) || el.innerText || el.getAttribute('title') || '').replace(/\\s+/g, ' ').trim();
  const count = (hay, needle) => hay.split(needle).length - 1;
  const parseC = (c) => { const m = String(c).match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(parseFloat); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const over = (f, b) => ({ r: f.r * f.a + b.r * (1 - f.a), g: f.g * f.a + b.g * (1 - f.a), b: f.b * f.a + b.b * (1 - f.a), a: 1 });
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const bgOf = (el) => { const st = []; let e = el; while (e && e.nodeType === 1) { const c = parseC(getComputedStyle(e).backgroundColor); if (c && c.a > 0) { st.push(c); if (c.a >= 0.99) break; } e = e.parentElement; }
    let base = { r: 255, g: 255, b: 255, a: 1 }; for (let i = st.length - 1; i >= 0; i--) base = over(st[i], base); return base; };
  const contrast = (el) => { const cs = getComputedStyle(el); const bg = bgOf(el); const fg = over(parseC(cs.color), bg); const a = lum(fg), b = lum(bg); return +((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toFixed(2); };
  const fontPx = (el) => parseFloat(getComputedStyle(el).fontSize);
  const insetStripe = (el) => { const bs = getComputedStyle(el).boxShadow; if (!bs || bs === 'none') return 0;
    for (const seg of bs.split(/,(?![^(]*\\))/)) { if (!/inset/.test(seg)) continue; const n = [...seg.replace(/rgba?\\([^)]*\\)/g, '').matchAll(/(-?[\\d.]+)px/g)].map((m) => Math.abs(parseFloat(m[1])));
      const [x = 0, y = 0, blur = 0, spread = 0] = n; if (blur === 0 && spread === 0 && ((x > 0) !== (y > 0))) return 1; } return 0; };
  const rectOf = (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), r: Math.round(r.right), b: Math.round(r.bottom) }; };
  const glyphOnly = (t) => /^[\\p{Extended_Pictographic}\\u2190-\\u21FF\\u2500-\\u27BF\\u2B00-\\u2BFF\\u22EF\\u2212+×−⋯…▾▸◂]+$/u.test(t.replace(/\\s+/g, ''));
`;
const pe = (page, body, arg = null) => page.evaluate(new Function('arg', `${VIS}\n${body}`), arg);
const T = (ctx, ko) => ctx.lib.tr(ctx.surface.lang, ko);
async function click(ctx, ko, opts = {}) {
  const p = await ctx.lib.locateTarget(ctx.page, T(ctx, ko), { lang: ctx.surface.lang, log: ctx.log, timeoutMs: opts.timeoutMs ?? 12_000 });
  await ctx.page.mouse.click(p.x, p.y, opts.button ? { button: opts.button } : undefined);
  await ctx.page.waitForTimeout(opts.settleMs ?? 700);
  return p;
}
async function clickSel(page, selector, settleMs = 700) {
  await page.locator(selector).first().click();
  await page.waitForTimeout(settleMs);
}

/** Whole map visible in the unoccluded canvas: tile box from the editor's own viewport snapshot. */
const MAP_FIT = `
  const snap = window.__oprnEditMapViewport?.(); const area = window.__oprnEditVisibleArea?.(); const cam = window.__oprnEditCamera?.();
  if (!snap || !area) return { snapshot: 0 };
  const meta = [...document.querySelectorAll('.map-tree-meta, .map-item, [role=treeitem]')].map(textOf).join(' ');
  const m = meta.match(/(\\d+)\\s*[×x]\\s*(\\d+)/); const mapW = m ? +m[1] : arg.w, mapH = m ? +m[2] : arg.h;
  // The fresh project's first map uses a 16 px tileset; area.unoccluded is already in client (viewport) coordinates.
  const T = 16; const tl = window.__oprnEditWorldToClient(0, 0); const br = window.__oprnEditWorldToClient(mapW * T, mapH * T);
  const u = area.unoccluded; const ux = u.x, uy = u.y, ur = u.x + u.width, ub = u.y + u.height;
  return { snapshot: 1, mapW, mapH, viewX: snap.viewX, viewY: snap.viewY, viewW: snap.viewW, viewH: snap.viewH, zoom: cam?.zoom ?? 0,
    fullyVisible: snap.viewX === 0 && snap.viewY === 0 && snap.viewW >= mapW && snap.viewH >= mapH ? 1 : 0,
    topLeftInsideUnoccluded: tl.x >= ux - 1 && tl.y >= uy - 1 ? 1 : 0, bottomRightInsideUnoccluded: br.x <= ur + 1 && br.y <= ub + 1 ? 1 : 0,
    mapClientRect: [Math.round(tl.x), Math.round(tl.y), Math.round(br.x), Math.round(br.y)].join(','), unoccludedClientRect: [Math.round(ux), Math.round(uy), Math.round(ur), Math.round(ub)].join(','),
    unoccludedW: Math.round(u.width), unoccludedH: Math.round(u.height) };`;

/** Canvas floating toolbar geometry. */
const TOOLBAR = `
  const bar = [...document.querySelectorAll('.canvas-toolbar')].filter(vis)[0]; if (!bar) return { toolbar: 0 };
  const area = (document.querySelector('.editor-canvas-scroll-shell') || document.querySelector('.canvas-area')).getBoundingClientRect();
  const r = bar.getBoundingClientRect(); const btns = [...bar.querySelectorAll('button')].filter(vis);
  const first = btns[0]; const badge = [...document.querySelectorAll('.region-size-badge')].filter(vis)[0];
  let badgeOverlap = 0; if (badge) { const q = badge.getBoundingClientRect(); const w = Math.min(r.right, q.right) - Math.max(r.left, q.left), h = Math.min(r.bottom, q.bottom) - Math.max(r.top, q.top); if (w > 0.5 && h > 0.5) badgeOverlap = Math.round(w * h); }
  const exp = bar.querySelector('[data-testid=editor-canvas-toolbar-expand]');
  return { toolbar: 1, barH: Math.round(r.height), barW: Math.round(r.width), inside: r.left >= area.left - 1 && r.right <= area.right + 1 && r.top >= area.top - 1 ? 1 : 0,
    rows: new Set(btns.map((b) => Math.round(b.getBoundingClientRect().top / 8))).size,
    firstX: first ? Math.round(first.getBoundingClientRect().left) : -1, buttons: btns.length,
    glyphButtons: btns.filter((b) => !b.querySelector('svg') && glyphOnly(textOf(b)) && textOf(b)).length,
    expandHasExpanded: exp && exp.hasAttribute('aria-expanded') ? 1 : 0, expandName: exp ? nameOf(exp) : '', badgeOverlapPx2: badgeOverlap };`;

/**
 * Expand the docked assistant through its rail restore control and wait for its composer. The control is resolved by
 * test id: L5 renamed it from 「AI 패널 펼치기」 to 「조수 펼치기」, and the device must open it on both builds.
 */
async function openAssistant(page) {
  const composer = page.locator('[data-testid="ai-input"]').first();
  if (!(await composer.isVisible().catch(() => false))) {
    await page.locator('[data-testid="ai-collapsed-restore"]').first().click({ timeout: 25_000 }).catch(() => {});
  }
  return composer.waitFor({ state: 'visible', timeout: 15_000 }).then(() => 1, () => 0);
}

/** Poll a geometry read until two reads 300 ms apart agree (the canvas refits over a few frames), at most 6 s. */
async function settled(page, body, arg) {
  let last = await pe(page, body, arg);
  for (const deadline = Date.now() + 6000; Date.now() < deadline; ) {
    await page.waitForTimeout(300);
    const next = await pe(page, body, arg);
    if (JSON.stringify(next) === JSON.stringify(last)) return next;
    last = next;
  }
  return last;
}

async function toolbarWithAssistant(ctx) {
  const assistantOpen = await openAssistant(ctx.page);
  await settled(ctx.page, TOOLBAR);
  const r = await toolbarDevice(ctx);
  return { pass: r.pass && assistantOpen === 1, measured: { ...r.measured, assistantOpen } };
}

async function toolbarDevice(ctx) {
  const { page } = ctx;
  const before = await pe(page, TOOLBAR);
  if (!before.toolbar) return { pass: false, measured: { toolbar: 0 } };
  const clicked = await page.locator('[data-testid=editor-canvas-toolbar-expand]').first().click({ timeout: 8000 }).then(() => 1, () => 0);
  await page.waitForTimeout(700);
  const after = await pe(page, TOOLBAR);
  const items = await pe(page, `return [...document.querySelectorAll('[data-testid=editor-grid-toggle], [data-testid=editor-map-screenshot-button]')].filter(vis).length;`);
  await page.keyboard.press('Escape');
  const m = {
    barHeightPx: before.barH, barWidthPx: before.barW, rows: before.rows, insideCanvas: before.inside, glyphButtons: before.glyphButtons,
    firstButtonShiftPx: Math.abs(after.firstX - before.firstX), expandHasExpanded: before.expandHasExpanded, overflowItemsShown: items,
    afterRows: after.rows, afterBarHeightPx: after.barH, badgeOverlapPx2: before.badgeOverlapPx2, expandName: before.expandName, expandClicked: clicked,
  };
  return {
    pass: m.expandClicked === 1 && m.barHeightPx <= 40 && m.rows === 1 && m.insideCanvas === 1 && m.glyphButtons === 0 && m.firstButtonShiftPx === 0 && m.expandHasExpanded === 1 && m.overflowItemsShown === 2 && m.afterBarHeightPx <= 40 && m.badgeOverlapPx2 === 0,
    measured: m,
  };
}

export const surfaces = {
  progress1440: { width: 1440, height: 900, lang: 'ko', steps: ['aria:진행'] },
  fit1024: { width: 1024, height: 640, lang: 'ko' },
  fitAi1440: { width: 1440, height: 900, lang: 'ko' },
  toolbar1024: { width: 1024, height: 640, lang: 'ko' },
  toolbarAi1024: { width: 1024, height: 640, lang: 'ko' },
  toolbar900: { width: 900, height: 600, lang: 'ko' },
  links1440: { width: 1440, height: 900, lang: 'ko', steps: ['aria:연결'] },
  objects1920: { width: 1920, height: 1080, lang: 'ko', steps: ['aria:기물', 'wait:1200'] },
  store1440: { width: 1440, height: 900, lang: 'ko', steps: ['aria:에셋 스토어'] },
  workshop1440: { width: 1440, height: 900, lang: 'ko', steps: ['aria:공방', 'wait:1200'] },
  mapcreate1440: { width: 1440, height: 900, lang: 'ko', steps: ['aria:맵', 'wait:800'] },
  maplist1440: { width: 1440, height: 900, lang: 'ko', steps: ['aria:맵', 'wait:800'] },
};

const PART1 = [
  {
    id: 'C-47',
    surface: 'progress1440',
    title: 'Authoring progress: map stage done on a tiled map, no git words, no repeated facts, no accent stripe, 12 px floor',
    async run(ctx) {
      const { page } = ctx;
      const pane = await pe(page, `
        const p = document.querySelector('[data-testid=left-progress-pane]'); if (!p || !vis(p)) return { pane: 0 };
        const t = textOf(p); const map = p.querySelector('[data-testid=left-progress-map]');
        const small = [...p.querySelectorAll('.left-progress-detail, .left-progress-hint, .left-progress-count')].filter(vis).map(fontPx);
        const acks = [...p.querySelectorAll('.left-progress-ack')].filter(vis);
        return { pane: 1, mapStageState: map?.dataset.state || '', commitWords: count(t, '커밋'), mapOneCount: count(t, '맵 1개'),
          minFontPx: small.length ? Math.min(...small) : 99, ackNameMismatch: acks.filter((a) => !nameOf(a).startsWith(textOf(a))).length };`);
      await click(ctx, '저작 진행', { settleMs: 800 });
      const strip = await pe(page, `
        const s = document.querySelector('[data-testid=authoring-journey-strip]'); const tg = document.querySelector('[data-testid=authoring-journey-toggle]');
        if (!s || !vis(s)) return { strip: 0 };
        const t = textOf(s); const cur = [...s.querySelectorAll('[aria-current=step]')];
        const ev = [...s.querySelectorAll('.authoring-journey-evidence')].filter(vis);
        return { strip: 1, stripCommitWords: count(t, '커밋'), stripMapOneCount: count(t, '맵 1개'),
          confirmButtons: [...s.querySelectorAll('button')].filter((b) => textOf(b) === '확인').length,
          currentStripes: cur.filter(insetStripe).length, stripMapCompletion: s.querySelector('[data-testid=authoring-journey-stage-map]')?.dataset.completion || '',
          toggleExpanded: tg?.getAttribute('aria-expanded') === 'true' ? 1 : 0, stripMinFontPx: ev.length ? Math.min(...ev.map(fontPx)) : 99 };`);
      await page.keyboard.press('Escape');
      const m = { ...pane, ...strip, mapStageDone: pane.mapStageState === 'done' ? 1 : 0 };
      const pass = m.pane === 1 && m.strip === 1 && m.mapStageDone === 1 && m.commitWords === 0 && m.stripCommitWords === 0 &&
        m.mapOneCount <= 1 && m.stripMapOneCount <= 1 && m.confirmButtons === 0 && m.currentStripes === 0 && m.stripMapCompletion !== 'pending' &&
        m.toggleExpanded === 1 && m.minFontPx >= 12 && m.stripMinFontPx >= 12 && m.ackNameMismatch === 0;
      return { pass, measured: m };
    },
  },
  {
    id: 'C-33-first-1024',
    surface: 'fit1024',
    title: 'At 1024x640 the first screen shows the whole 20x15 map',
    async run({ page }) {
      const m = await pe(page, MAP_FIT, { w: 20, h: 15 });
      return { pass: m.snapshot === 1 && m.fullyVisible === 1 && m.topLeftInsideUnoccluded === 1 && m.bottomRightInsideUnoccluded === 1, measured: m };
    },
  },
  {
    id: 'C-33-assistant-1440',
    surface: 'fitAi1440',
    title: 'Opening the assistant panel refits the map inside the remaining canvas',
    async run({ page }) {
      const assistantOpen = await openAssistant(page);
      const m = await settled(page, MAP_FIT, { w: 20, h: 15 });
      const panel = await pe(page, `return [...document.querySelectorAll('.ai-chat-panel, .ai-chat-sidebar-panel, [data-testid=ai-chat-panel]')].filter(vis).length;`);
      return { pass: assistantOpen === 1 && m.snapshot === 1 && m.fullyVisible === 1 && m.topLeftInsideUnoccluded === 1 && m.bottomRightInsideUnoccluded === 1, measured: { ...m, assistantSurfaces: panel, assistantOpen } };
    },
  },
  {
    id: 'C-32-1024',
    surface: 'toolbar1024',
    title: 'Canvas toolbar: one row inside the canvas at 1024x640, overflow opens without moving the bar, no glyph buttons',
    run: toolbarDevice,
  },
  {
    id: 'C-32-ai-1024',
    surface: 'toolbarAi1024',
    title: 'Canvas toolbar stays one row and clear of the size badge with the assistant panel open at 1024x640',
    run: toolbarWithAssistant,
  },
  {
    id: 'C-32-900',
    surface: 'toolbar900',
    title: 'Canvas toolbar stays one row inside the canvas at 900x600',
    run: toolbarDevice,
  },
  {
    id: 'C-48',
    surface: 'links1440',
    title: 'Map links: summary and cards agree, warning chips are readable, isolated cards carry a fix action',
    async run({ page }) {
      const m = await pe(page, `
        const p = document.querySelector('[data-testid=left-links-pane]'); if (!p || !vis(p)) return { pane: 0 };
        const sum = p.querySelector('[data-testid=left-links-summary]'); const sumText = textOf(sum);
        const cards = [...p.querySelectorAll('.left-links-card')]; const bad = cards.filter((c) => c.dataset.state === 'isolated' || c.dataset.state === 'unreachable');
        const summaryProblem = sum.classList.contains('has-problems') || /닿지 않|고립|없는 맵/.test(sumText) ? 1 : 0;
        const summaryAllOk = /모두 연결됨/.test(sumText) ? 1 : 0;
        const warn = [...p.querySelectorAll('.left-links-flag')].filter(vis);
        const actionless = bad.filter((c) => ![...c.querySelectorAll('button')].some((b) => /문|이동/.test(textOf(b)) && !b.classList.contains('left-links-name'))).length;
        const tiny = [...p.querySelectorAll('.left-links-summary, .left-links-flag, .left-links-counts, .left-links-hint')].filter(vis).filter((e) => fontPx(e) < 12).length;
        return { pane: 1, cards: cards.length, warnCards: bad.length, summaryProblem, summaryAllOk,
          contradiction: (bad.length > 0 && summaryAllOk) || (bad.length === 0 && summaryProblem) ? 1 : 0,
          warnChips: warn.length, minChipContrast: warn.length ? Math.min(...warn.map(contrast)) : 99, minChipFontPx: warn.length ? Math.min(...warn.map(fontPx)) : 99,
          actionlessIsolatedCards: actionless, tinyTexts: tiny, summary: sumText };`);
      return { pass: m.pane === 1 && m.contradiction === 0 && m.minChipContrast >= 4.5 && m.minChipFontPx >= 12 && m.actionlessIsolatedCards === 0 && m.tinyTexts === 0, measured: m };
    },
  },
  {
    id: 'C-46',
    surface: 'objects1920',
    title: 'Object cards fill the pane at 1920x1080, no repeated size/source meta, the map name has a label',
    async run({ page }) {
      const m = await pe(page, `
        const p = document.querySelector('[data-testid=left-props-pane]'); if (!p || !vis(p)) return { pane: 0 };
        const cards = [...p.querySelectorAll('[data-testid=left-props-card]')]; const pr = p.getBoundingClientRect();
        const last = cards[cards.length - 1]; const lr = last ? last.getBoundingClientRect() : null;
        const moreBtn = p.querySelector('[data-testid=left-props-more]'); const moreLeft = moreBtn && !moreBtn.hidden ? 1 : 0;
        const head = p.querySelector('.left-props-head'); const headText = textOf(head);
        const sizeRepeats = cards.filter((c) => (textOf(c).match(/\\d+×\\d+/g) || []).length > 1).length;
        const tiny = [...p.querySelectorAll('.left-props-size, .left-props-reason, .left-props-context > span, .left-props-result-count, .left-props-browser label > span')].filter(vis).filter((e) => fontPx(e) < 12).length;
        return { pane: 1, cards: cards.length, paneBottom: Math.round(pr.bottom), lastCardBottom: lr ? Math.round(lr.bottom) : 0, cardHeight: lr ? Math.round(lr.height) : 0,
          filled: !lr ? 0 : (lr.bottom >= pr.bottom - lr.height || !moreLeft) ? 1 : 0, moreButtonShown: moreLeft,
          sizeRepeatCards: sizeRepeats, chipsetReasonRepeats: count(textOf(p), '이 칩셋에서 사용'), mapLabelInHead: /맵\\s*[:·]/.test(headText) ? 1 : 0, tinyTexts: tiny };`);
      return { pass: m.pane === 1 && m.cards > 0 && m.filled === 1 && m.sizeRepeatCards === 0 && m.chipsetReasonRepeats === 0 && m.mapLabelInHead === 1 && m.tinyTexts === 0, measured: m };
    },
  },
  {
    id: 'C-50',
    surface: 'store1440',
    title: 'Store pane offers an action on the web build, shares the panel inset, and the added notice has no side stripe',
    async run(ctx) {
      const { page } = ctx;
      const s = await pe(page, `
        const p = document.querySelector('[data-testid=left-store-pane]'); if (!p || !vis(p)) return { pane: 0 };
        const h = p.querySelector('h2, .left-store-title'); const actions = [...p.querySelectorAll('button, a[href]')].filter(vis).length;
        const probe = document.createElement('div'); probe.className = 'store-added'; document.body.append(probe); const bl = parseFloat(getComputedStyle(probe).borderLeftWidth) || 0; probe.remove();
        const tiny = [...p.querySelectorAll('*')].filter((e) => vis(e) && e.childNodes.length && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())).filter((e) => fontPx(e) < 12).length;
        return { pane: 1, actions, titleLeft: h ? Math.round(h.getBoundingClientRect().left) : -1, storeAddedBorderLeftPx: bl, tinyTexts: tiny };`);
      await click(ctx, '기물', { settleMs: 1200 });
      const ref = await pe(page, `const h = document.querySelector('[data-testid=left-props-pane] .left-props-head h2'); return { refTitleLeft: h && vis(h) ? Math.round(h.getBoundingClientRect().left) : -1 };`);
      const m = { ...s, ...ref, titleLeftDeltaPx: Math.abs((s.titleLeft ?? 0) - ref.refTitleLeft) };
      return { pass: m.pane === 1 && m.actions >= 1 && m.refTitleLeft >= 0 && m.titleLeftDeltaPx <= 2 && m.storeAddedBorderLeftPx <= 1 && m.tinyTexts === 0, measured: m };
    },
  },
  {
    id: 'C-49',
    surface: 'workshop1440',
    title: 'Workshop pane: no placeholder card, named checkbox, 28 px summary, no inset accent stripe on selection',
    async run({ page }) {
      await page.locator('[data-testid=workshop-oneclick-more] > summary').first().click().catch(() => {});
      await page.waitForTimeout(500);
      const m = await pe(page, `
        const p = document.querySelector('[data-testid=left-workshop-pane]'); if (!p || !vis(p)) return { pane: 0 };
        const soon = [...p.querySelectorAll('*')].filter((e) => vis(e) && !e.children.length && /준비 중/.test(textOf(e))).length;
        const boxes = [...p.querySelectorAll('input[type=checkbox]')];
        const unnamed = boxes.filter((b) => { const n = b.getAttribute('aria-label') || (b.labels && [...b.labels].map(textOf).join(' ')) || ''; return !n.trim() || n.trim() === 'on' || !b.getAttribute('aria-label'); }).length;
        const sum = p.querySelector('[data-testid=workshop-oneclick-more] > summary'); const sh = sum ? Math.round(sum.getBoundingClientRect().height) : 0;
        const host = document.createElement('div'); host.className = 'workshop'; const it = document.createElement('div'); it.className = 'workshop-item is-selected'; host.append(it); document.body.append(host);
        const stripe = insetStripe(it); host.remove();
        const notes = [...p.querySelectorAll('.left-workshop-note, .left-workshop-lead')].filter(vis).length;
        return { pane: 1, soonTexts: soon, checkboxes: boxes.length, unnamedCheckboxes: unnamed, summaryHeightPx: sh, selectedItemInsetStripe: stripe, explanationLayers: notes };`);
      return { pass: m.pane === 1 && m.soonTexts === 0 && m.checkboxes >= 1 && m.unnamedCheckboxes === 0 && m.summaryHeightPx >= 28 && m.selectedItemInsetStripe === 0, measured: m };
    },
  },
  {
    id: 'C-51',
    surface: 'mapcreate1440',
    title: 'Map create dialog: presets are a pressed group, one primary action, compact size inputs, blank preset named for what it makes',
    async run({ page }) {
      await page.locator('[data-testid=map-add], [data-testid=map-tree-add-map], [data-testid=map-add-root]').first().click({ timeout: 8000 }).catch(async () => {
        const p = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /새 맵/.test(x.innerText || x.getAttribute('aria-label') || '')); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
        if (p) await page.mouse.click(p.x, p.y);
      });
      await page.waitForTimeout(900);
      await page.locator('[data-testid=map-create-preset-blank]').first().click();
      await page.waitForTimeout(400);
      const m = await pe(page, `
        const d = document.querySelector('[data-testid=map-create-dialog]'); if (!d || !vis(d)) return { dialog: 0 };
        const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
        const probe = document.createElement('i'); probe.style.color = accent; document.body.append(probe); const accentRgb = getComputedStyle(probe).color; probe.remove();
        const btns = [...d.querySelectorAll('button')].filter(vis);
        const primary = btns.filter((b) => getComputedStyle(b).backgroundColor === accentRgb).length;
        const w = d.querySelector('[data-testid=map-create-width]'), h = d.querySelector('[data-testid=map-create-height]');
        const blank = d.querySelector('[data-testid=map-create-preset-blank]');
        return { dialog: 1, pressedPresets: d.querySelectorAll('[aria-pressed=true]').length, primaryButtons: primary, widthInputPx: Math.round(w.getBoundingClientRect().width), heightInputPx: Math.round(h.getBoundingClientRect().width),
          blankPresetSaysEmpty: /^빈 맵$/.test(textOf(blank)) ? 1 : 0, blankPresetLabel: textOf(blank) };`);
      await page.keyboard.press('Escape');
      return { pass: m.dialog === 1 && m.pressedPresets === 1 && m.primaryButtons === 1 && m.widthInputPx <= 120 && m.heightInputPx <= 120 && m.blankPresetSaysEmpty === 0, measured: m };
    },
  },
  {
    id: 'C-45',
    surface: 'maplist1440',
    title: 'Map list: header tools visible without hover, row menu button readable and >= 28 px, no inset stripe, no raster icons in the context menu',
    async run({ page }) {
      await page.mouse.move(900, 500);
      await page.waitForTimeout(400);
      const m = await pe(page, `
        const panel = [...document.querySelectorAll('.map-tree-panel')].filter(vis)[0]; if (!panel) return { panel: 0 };
        const head = [...panel.querySelectorAll('.map-tree-header .map-tree-action, .map-tree-header-actions button')];
        const hidden = head.filter((b) => Number(getComputedStyle(b).opacity) < 1 || !vis(b)).length;
        const row = panel.querySelector('.map-item.active') || panel.querySelector('.map-item');
        const trig = row?.querySelector('.map-context-trigger, .map-tree-more');
        const tr = trig ? trig.getBoundingClientRect() : null; const icon = trig ? (trig.querySelector('span, svg') || trig) : null;
        const name = row?.querySelector('.map-tree-name'); const clipped = name && name.scrollWidth > name.clientWidth + 1 ? 1 : 0;
        return { panel: 1, headerTools: head.length, headerToolsHidden: hidden, rowMenuOpacity: trig ? Number(getComputedStyle(trig).opacity) : 0,
          rowMenuMinSidePx: tr ? Math.round(Math.min(tr.width, tr.height)) : 0, rowMenuIconContrast: trig ? contrast(trig) : 0,
          activeRowInsetStripe: row ? insetStripe(row) : 0, nameClipped: clipped, nameTitle: name && (name.getAttribute('title') || row.getAttribute('title')) ? 1 : 0 };`);
      const row = page.locator('.map-tree-panel .map-item').first();
      await row.click({ button: 'right' });
      await page.waitForTimeout(700);
      const menu = await pe(page, `const menu = [...document.querySelectorAll('[role=menu], .context-menu, [class*=context-menu]')].filter(vis)[0]; if (!menu) return { menuOpen: 0, menuRasterIcons: 0 };
        const raster = [...menu.querySelectorAll('img, [class*=rm-tool-icon], [class*=oprn-icon-]')].filter((e) => { const s = getComputedStyle(e); return e.tagName === 'IMG' || (s.backgroundImage && s.backgroundImage !== 'none'); }).length;
        return { menuOpen: 1, menuRasterIcons: raster };`);
      await page.keyboard.press('Escape');
      const r = { ...m, ...menu };
      return {
        pass: r.panel === 1 && r.headerToolsHidden === 0 && r.rowMenuOpacity === 1 && r.rowMenuMinSidePx >= 28 && r.activeRowInsetStripe === 0 && (r.nameClipped === 0 || r.nameTitle === 1) && r.menuOpen === 1 && r.menuRasterIcons === 0,
        measured: r,
      };
    },
  },
];

Object.assign(surfaces, {
  rail1440: { width: 1440, height: 900, lang: 'ko' },
  inspect1440: { width: 1440, height: 900, lang: 'ko' },
  palette1440: { width: 1440, height: 900, lang: 'ko' },
  tileprops1440: { width: 1440, height: 900, lang: 'ko' },
  brush1440: { width: 1440, height: 900, lang: 'ko' },
  brush1440en: { width: 1440, height: 900, lang: 'en' },
  autotile1440: { width: 1440, height: 900, lang: 'ko' },
  layers1440: { width: 1440, height: 900, lang: 'ko' },
  layers1366en: { width: 1366, height: 768, lang: 'en' },
  stamp1440: { width: 1440, height: 900, lang: 'ko' },
  stamp1366en: { width: 1366, height: 768, lang: 'en' },
  session1440: { width: 1440, height: 900, lang: 'ko' },
  session900: { width: 900, height: 600, lang: 'ko' },
  canvasKeys1440: { width: 1440, height: 900, lang: 'ko' },
  tools1024: { width: 1024, height: 640, lang: 'ko' },
  tools1440: { width: 1440, height: 900, lang: 'ko' },
  cards1440: { width: 1440, height: 900, lang: 'ko' },
  prefab1024: { width: 1024, height: 640, lang: 'ko' },
  sheet1440: { width: 1440, height: 900, lang: 'ko' },
  // Before/after only (no device): surfaces opened through their real control.
  baInspect1440: { width: 1440, height: 900, lang: 'ko', steps: ['aria:검사', 'wait:900'] },
  baTileProps1440: { width: 1440, height: 900, lang: 'ko', steps: ['aria:타일 속성 열기', 'wait:900'] },
  baPrefab1024: { width: 1024, height: 640, lang: 'ko', steps: ['text:프리팹', 'wait:900'] },
  baEvent1440: { width: 1440, height: 900, lang: 'ko', steps: ['aria:이벤트 레이어', 'wait:900'] },
});

async function toolRowDevice({ page }) {
  const rows = await pe(page, `
    const bar = [...document.querySelectorAll('[data-testid=left-palette-root] .oprn-tile-toolbar')].filter(vis)[0]; if (!bar) return { bar: 0 };
    const btns = [...bar.querySelectorAll('button')].filter(vis).filter((b) => !b.closest('.oprn-toolbar-dropdown'));
    const byRow = new Map(); for (const b of btns) { const t = Math.round(b.getBoundingClientRect().top / 6); byRow.set(t, (byRow.get(t) || 0) + 1); }
    const counts = [...byRow.values()];
    const card = [...document.querySelectorAll('.palette-card-window .palette-card')].filter(vis)[0];
    return { bar: 1, buttons: btns.length, rows: counts.length, rowCounts: counts.join('/'), rowSpread: counts.length ? Math.max(...counts) - Math.min(...counts) : 99,
      glyphTexts: btns.filter((b) => /⋯|…/.test(textOf(b))).length, minToolH: Math.min(...btns.map((b) => Math.round(b.getBoundingClientRect().height))),
      cardY: card ? Math.round(card.getBoundingClientRect().top) : -1 };`);
  await page.locator('[data-testid=paint-shape-select]').first().selectOption('rect').catch(() => {});
  await page.waitForTimeout(800);
  const after = await pe(page, `const card = [...document.querySelectorAll('.palette-card-window .palette-card')].filter(vis)[0]; return { cardY: card ? Math.round(card.getBoundingClientRect().top) : -1, shape: document.querySelector('[data-testid=paint-shape-select]')?.value || '' };`);
  const m = { ...rows, shapeAfter: after.shape, cardShiftPx: rows.cardY >= 0 && after.cardY >= 0 ? Math.abs(after.cardY - rows.cardY) : -1 };
  return { pass: m.bar === 1 && (m.rows === 1 || (m.rows === 2 && m.rowSpread <= 1)) && m.glyphTexts === 0 && m.shapeAfter === 'rect' && m.cardShiftPx === 0, measured: m };
}

const BANNER = `
  const b = [...document.querySelectorAll('[data-testid=save-skip-banner]')].filter(vis)[0]; if (!b) return { banner: 0 };
  const br = b.getBoundingClientRect(); const c = [...document.querySelectorAll('.phaser-container canvas')].filter(vis)[0]; const cr = c ? c.getBoundingClientRect() : null;
  const btns = [...b.querySelectorAll('button')].filter(vis);
  return { banner: 1, text: textOf(b), emDash: /\u2014/.test(textOf(b)) ? 1 : 0, minButtonH: btns.length ? Math.min(...btns.map((x) => Math.round(x.getBoundingClientRect().height))) : 0,
    bannerCanvasGapPx: cr ? Math.round(cr.top - br.bottom) : -1 };`;

async function sessionDevice({ page }) {
  const before = await pe(page, BANNER);
  await pe(page, `document.activeElement?.blur?.(); document.body.focus();`);
  await page.keyboard.press('Control+s');
  await page.waitForTimeout(1200);
  const t = await pe(page, `const btn = [...document.querySelectorAll('.toast button, [role=status] button')].filter(vis).find((b) => /내보내기|Export/i.test(textOf(b)));
    if (!btn) return { toastExport: 0 }; const r = btn.getBoundingClientRect(); return { toastExport: 1, x: r.left + r.width / 2, y: r.top + r.height / 2 };`);
  if (t.toastExport) { await page.mouse.click(t.x, t.y); await page.waitForTimeout(1500); }
  const after = await pe(page, BANNER);
  const m = { banner: before.banner, emDash: before.emDash, minButtonH: before.minButtonH, bannerCanvasGapPx: before.bannerCanvasGapPx, toastHasExport: t.toastExport,
    bannerChangedAfterExport: before.banner && after.banner && after.text !== before.text ? 1 : 0, textBefore: before.text, textAfter: after.text };
  return { pass: m.banner === 1 && m.emDash === 0 && m.minButtonH >= 28 && Math.abs(m.bannerCanvasGapPx) <= 1 && m.toastHasExport === 1 && m.bannerChangedAfterExport === 1, measured: m };
}

async function stampStripDevice({ page }) {
  const m = await pe(page, `
    const chip = [...document.querySelectorAll('[data-testid=selected-tile-status]')].filter(vis)[0]; if (!chip) return { strip: 0 };
    const label = chip.querySelector('.selected-tile-label'); const set = chip.querySelector('.selected-tile-tileset');
    const t = textOf(label);
    return { strip: 1, labelText: t, startsWithNumber: /^\\d+\\s/.test(t) ? 1 : 0, labelClipped: label.scrollWidth > label.clientWidth + 1 ? 1 : 0,
      tilesetClipped: set && set.scrollWidth > set.clientWidth + 1 ? 1 : 0, tilesetText: textOf(set) };`);
  return { pass: m.strip === 1 && m.startsWithNumber === 0 && m.labelClipped === 0, measured: m };
}

async function layerDevice({ page }) {
  const head = () => pe(page, `const h = [...document.querySelectorAll('[data-testid=left-palette-root] .sidebar-map-header')].filter(vis)[0]; return h ? textOf(h) : '';`);
  const pressLayer = async (re) => {
    const p = await pe(page, `const b = [...document.querySelectorAll('.left-layer-btn, [data-testid^=layer-]')].filter(vis).find((x) => new RegExp(arg).test(x.getAttribute('aria-label') || textOf(x))); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 };`, re);
    if (p) { await page.mouse.click(p.x, p.y); await page.waitForTimeout(900); }
    return p ? 1 : 0;
  };
  const lowerHead = await head();
  const upperFound = await pressLayer('상위|Upper');
  const upperHead = await head();
  const eventFound = await pressLayer('이벤트|Event');
  const ev = await pe(page, `const h = [...document.querySelectorAll('[data-testid=left-palette-root] .sidebar-map-header')].filter(vis)[0];
    const empty = [...document.querySelectorAll('.event-list-empty')].filter(vis)[0]; const title = [...document.querySelectorAll('.event-list-title')].filter(vis)[0];
    return { eventHead: h ? textOf(h) : '', emptyState: empty ? 1 : 0, newEventButtons: empty ? [...empty.querySelectorAll('button')].filter((b) => /새 이벤트|New event/i.test(textOf(b))).length : 0,
      titleTransform: title ? getComputedStyle(title).textTransform : 'missing' };`);
  const m = { upperFound, eventFound, lowerHeadNamesLayer: /바닥|하위|Ground|Lower/i.test(lowerHead) ? 1 : 0, upperHeadNamesLayer: /상위|Upper/i.test(upperHead) ? 1 : 0,
    eventHeadNamesLayer: /이벤트|Event/i.test(ev.eventHead) ? 1 : 0, emptyState: ev.emptyState, newEventButtons: ev.newEventButtons, titleTransform: ev.titleTransform, upperHead, eventHead: ev.eventHead };
  return { pass: m.upperFound === 1 && m.eventFound === 1 && m.upperHeadNamesLayer === 1 && m.eventHeadNamesLayer === 1 && (m.emptyState === 0 || m.newEventButtons === 1) && m.titleTransform === 'none', measured: m };
}

const BRUSH_TOGGLES = `
  const ts = [...document.querySelectorAll('[data-testid=auto-connect-mode-toggle], [data-testid=cluster-assist-mode-toggle]')].filter(vis);
  return ts.map((b) => ({ id: b.dataset.testid, pressed: b.getAttribute('aria-pressed'), name: nameOf(b), text: textOf(b) }));`;

async function pickAutotileByKeyboard(page) {
  const ok = await pe(page, `const c = [...document.querySelectorAll('.palette-card-window .palette-card')].find((b) => /오토타일|autotile/i.test(b.title + ' ' + textOf(b))); if (!c) return 0; c.focus(); return document.activeElement === c ? 1 : 0;`);
  if (ok) await page.keyboard.press('Enter');
  await page.waitForTimeout(700);
  return ok;
}

async function brushToggleDevice({ page }) {
  const t = await pe(page, BRUSH_TOGGLES);
  const before = t.find((x) => x.id === 'auto-connect-mode-toggle');
  const picked = await pickAutotileByKeyboard(page);
  const after = (await pe(page, BRUSH_TOGGLES)).find((x) => x.id === 'auto-connect-mode-toggle');
  const live = await pe(page, `return [...document.querySelectorAll('[role=status],[aria-live],[role=alert]')].map(textOf).join(' | ');`);
  const m = { toggles: t.length, withPressed: t.filter((x) => x.pressed === 'true' || x.pressed === 'false').length,
    nameMatchesVisible: t.filter((x) => x.name && x.text && x.name === x.text).length, names: t.map((x) => x.name).join(' / '), texts: t.map((x) => x.text).join(' / '),
    autotilePicked: picked, pressedChanged: before && after && before.pressed !== after.pressed ? 1 : 0,
    announced: before && after && before.pressed !== after.pressed ? (/이웃 연결|Neighbor|connect/i.test(live) ? 1 : 0) : 1 };
  return { pass: m.toggles === 2 && m.withPressed === 2 && m.nameMatchesVisible === 2 && m.announced === 1, measured: m };
}

const PART23 = [
  {
    id: 'C-41',
    surface: 'sheet1440',
    title: 'Tile sheet: a zoom control exists, 2x makes cells >= 32 px, the # toggle has a name',
    async run({ page }) {
      await page.locator('[data-testid=palette-tab-tiles]').first().click().catch(() => {});
      await page.waitForTimeout(1200);
      const cell = () => pe(page, `const c = [...document.querySelectorAll('[data-testid=tile-palette] .chipset-tile')].filter(vis)[0]; return c ? Math.round(Math.min(c.getBoundingClientRect().width, c.getBoundingClientRect().height)) : 0;`);
      const before = await cell();
      const zoom = page.locator('[aria-label="확대"]').filter({ has: page.locator('option') }).first();
      const hasZoom = await zoom.count();
      if (hasZoom) { await zoom.selectOption('2').catch(() => {}); await page.waitForTimeout(1200); }
      const after = await cell();
      const hash = await pe(page, `const b = [...document.querySelectorAll('[data-testid=tile-number-toggle]')].filter(vis)[0]; return b ? nameOf(b) : '';`);
      const m = { zoomControl: hasZoom ? 1 : 0, cellPxBefore: before, cellPxAt2x: after, hashName: hash };
      return { pass: m.zoomControl === 1 && m.cellPxAt2x >= 32 && m.hashName.length > 0, measured: m };
    },
  },
  {
    id: 'C-42',
    surface: 'prefab1024',
    title: 'Prefab tab at 1024x640: no raw English tag chips, chip area <= 72 px, >= 3 card rows visible, 12 px card names',
    async run({ page }) {
      await page.locator('[data-testid=palette-tab-prefab]').first().click();
      await page.waitForTimeout(900);
      const m = await pe(page, `
        const row = [...document.querySelectorAll('[data-testid=palette-prefab-chips]')].filter(vis)[0]; if (!row) return { chips: 0 };
        const area = row.parentElement.classList.contains('palette-smart-chip-bar') ? row.parentElement : row;
        const chips = [...row.querySelectorAll('.palette-smart-chip')];
        const raw = chips.filter((c) => /^[a-z]+$/.test(textOf(c))).map(textOf);
        const body = document.querySelector('[data-testid=palette-smart-body]'); const br = body ? body.getBoundingClientRect() : null;
        const cards = [...document.querySelectorAll('.palette-card-window .palette-card')].filter((c) => { const r = c.getBoundingClientRect(); return br && r.height > 2 && r.top >= br.top - 1 && r.bottom <= br.bottom + 1; });
        const rows = new Set(cards.map((c) => Math.round(c.getBoundingClientRect().top))).size;
        const names = cards.map((c) => c.querySelector('.palette-card-name')).filter(Boolean);
        return { chips: chips.length, rawTagChips: raw.length, rawSamples: raw.slice(0, 5), chipAreaH: Math.round(area.getBoundingClientRect().height), fullyVisibleCardRows: rows,
          minNameFontPx: names.length ? Math.min(...names.map(fontPx)) : 0, bodyH: br ? Math.round(br.height) : 0 };`);
      return { pass: m.chips > 0 && m.rawTagChips === 0 && m.chipAreaH <= 72 && m.fullyVisibleCardRows >= 3 && m.minNameFontPx >= 12, measured: m };
    },
  },
  { id: 'C-34-1024', surface: 'tools1024', title: 'Draw tool row: one row or two even rows at 1024x640; shape change does not move the palette', run: toolRowDevice },
  { id: 'C-34-1440', surface: 'tools1440', title: 'Draw tool row: one row or two even rows at 1440x900; shape change does not move the palette', run: toolRowDevice },
  {
    id: 'C-35',
    surface: 'tools1440',
    title: 'Draw panel targets: category chips and tabs >= 28 px, undo/redo and history disclosure >= 32 px tall',
    async run({ page }) {
      const m = await pe(page, `
        const h = (sel) => [...document.querySelectorAll(sel)].filter(vis).map((e) => Math.round(e.getBoundingClientRect().height));
        const chips = h('.palette-smart-chip'), tabs = h('.palette-smart-tab'), hist = h('[data-testid=oprn-tool-undo], [data-testid=oprn-tool-redo], [data-testid=oprn-tool-undo-history], [data-testid=oprn-tool-redo-history]');
        const mn = (a) => a.length ? Math.min(...a) : 0;
        return { chips: chips.length, minChipH: mn(chips), tabs: tabs.length, minTabH: mn(tabs), historyButtons: hist.length, minHistoryH: mn(hist) };`);
      return { pass: m.chips > 0 && m.minChipH >= 28 && m.tabs > 0 && m.minTabH >= 28 && m.historyButtons === 4 && m.minHistoryH >= 32, measured: m };
    },
  },
  {
    id: 'C-37',
    surface: 'cards1440',
    title: 'Palette card names: every clipped name ends in an ellipsis and its card carries the full name; no shared prefix repeated on every card',
    async run({ page }) {
      const m = await pe(page, `
        const cards = [...document.querySelectorAll('.palette-card-window .palette-card')].filter(vis); if (!cards.length) return { cards: 0 };
        let clipped = 0, clippedBad = 0; const samples = [];
        for (const c of cards) { const n = c.querySelector('.palette-card-name'); if (!n) continue;
          const over = n.scrollWidth > n.clientWidth + 1 || n.scrollHeight > n.clientHeight + 1; if (!over) continue; clipped++;
          const full = (c.getAttribute('title') || '') + ' ' + (c.getAttribute('aria-label') || '');
          const ok = getComputedStyle(n).textOverflow === 'ellipsis' && full.includes(textOf(n));
          if (!ok) { clippedBad++; if (samples.length < 4) samples.push(textOf(n)); } }
        const firstWords = cards.map((c) => (textOf(c.querySelector('.palette-card-name')).split(' ')[0] || ''));
        const sharedPrefix = firstWords.length > 2 && firstWords.every((w) => w && w === firstWords[0]) ? 1 : 0;
        return { cards: cards.length, clippedNames: clipped, clippedWithoutEllipsisOrTitle: clippedBad, samples, sharedPrefixOnEveryCard: sharedPrefix, minNameFontPx: Math.min(...cards.map((c) => fontPx(c.querySelector('.palette-card-name')))) };`);
      return { pass: m.cards > 0 && m.clippedWithoutEllipsisOrTitle === 0 && m.sharedPrefixOnEveryCard === 0 && m.minNameFontPx >= 12, measured: m };
    },
  },
  {
    id: 'C-105',
    surface: 'canvasKeys1440',
    title: 'Keyboard-only painting: Tab reaches a named map canvas, arrows move a cell cursor, Space paints (undo becomes available)',
    async run({ page }) {
      const undoState = () => pe(page, `const u = document.querySelector('[data-testid=oprn-tool-undo]'); return u ? (u.disabled ? 0 : 1) : -1;`);
      const undoBefore = await undoState();
      await pe(page, `document.activeElement?.blur?.();`);
      let reached = 0;
      for (let i = 1; i <= 90; i++) {
        await page.keyboard.press('Tab');
        if (await pe(page, `return document.activeElement?.tagName === 'CANVAS' && !!document.activeElement.closest('.phaser-container') ? 1 : 0;`)) { reached = i; break; }
      }
      const named = await pe(page, `const c = document.querySelector('.phaser-container canvas'); return { name: c?.getAttribute('aria-label') || '', role: c?.getAttribute('role') || '' };`);
      let camShift = -1; let painted = 0;
      if (reached) {
        const cam0 = await pe(page, `const c = window.__oprnEditCamera?.(); return c ? [Math.round(c.scrollX), Math.round(c.scrollY)] : [0, 0];`);
        await page.keyboard.press('ArrowRight');
        await page.keyboard.press('ArrowDown');
        await page.waitForTimeout(300);
        const cam1 = await pe(page, `const c = window.__oprnEditCamera?.(); return c ? [Math.round(c.scrollX), Math.round(c.scrollY)] : [0, 0];`);
        camShift = Math.abs(cam1[0] - cam0[0]) + Math.abs(cam1[1] - cam0[1]);
        await page.keyboard.press('Space');
        await page.waitForTimeout(900);
        painted = await undoState();
      }
      const m = { tabsToCanvas: reached || 91, canvasNamed: named.name ? 1 : 0, canvasRole: named.role, arrowCameraShiftPx: camShift, undoBefore, undoEnabledAfterSpace: painted };
      return { pass: m.tabsToCanvas <= 90 && m.canvasNamed === 1 && m.arrowCameraShiftPx === 0 && m.undoBefore === 0 && m.undoEnabledAfterSpace === 1, measured: m };
    },
  },
  { id: 'C-54', surface: 'session1440', title: 'Temporary session: Ctrl+S offers Export, export updates the banner, banner sits on the canvas without a gap', run: sessionDevice },
  { id: 'C-54-900', surface: 'session900', title: 'Temporary session banner buttons stay >= 28 px tall at 900x600', run: sessionDevice },
  { id: 'C-38', surface: 'stamp1440', title: 'Selected-tile strip: tile name first without the internal number, neither name clipped', run: stampStripDevice },
  { id: 'C-38-en', surface: 'stamp1366en', title: 'Selected-tile strip at 1366 en: tile name first, nothing clipped', run: stampStripDevice },
  { id: 'C-53', surface: 'layers1440', title: 'Switching layers updates the left panel head; the empty event list offers a New event button', run: layerDevice },
  { id: 'C-53-en', surface: 'layers1366en', title: 'Event list title is not upper-cased at 1366 en; panel head follows the layer', run: layerDevice },
  { id: 'C-36', surface: 'brush1440', title: 'Brush toggles are fixed-name buttons with aria-pressed; switching to an autotile is announced', run: brushToggleDevice },
  { id: 'C-36-en', surface: 'brush1440en', title: 'Brush toggles keep visible label == accessible name in English', run: brushToggleDevice },
  {
    id: 'C-107',
    surface: 'autotile1440',
    title: 'Picking an autotile by keyboard: neighbour-connect switch keeps its name, is announced and can be undone',
    async run({ page }) {
      const before = (await pe(page, BRUSH_TOGGLES)).find((x) => x.id === 'auto-connect-mode-toggle');
      const picked = await pickAutotileByKeyboard(page);
      const after = (await pe(page, BRUSH_TOGGLES)).find((x) => x.id === 'auto-connect-mode-toggle');
      const live = await pe(page, `const regions = [...document.querySelectorAll('[role=status],[aria-live],[role=alert]')];
        const hit = regions.find((r) => /이웃 연결/.test(textOf(r)));
        return { text: hit ? textOf(hit) : '', undo: hit ? [...hit.querySelectorAll('button')].filter((b) => /되돌리기/.test(textOf(b))).length : 0 };`);
      const m = { autotilePicked: picked, pressedBefore: before?.pressed ?? '', pressedAfter: after?.pressed ?? '', switched: before && after && before.pressed !== after.pressed ? 1 : 0,
        nameStable: before && after && before.name === after.name ? 1 : 0, nameBefore: before?.name ?? '', nameAfter: after?.name ?? '',
        announced: live.text ? 1 : 0, undoInAnnouncement: live.undo };
      return { pass: m.autotilePicked === 1 && m.switched === 1 && m.nameStable === 1 && m.announced === 1 && m.undoInAnnouncement >= 1, measured: m };
    },
  },
  {
    id: 'C-43',
    surface: 'tileprops1440',
    title: 'Tile properties: a labelled dialog, direction toggles say what a check means, UI font, 32 px close button',
    async run({ page }) {
      const card = page.locator('.palette-card-window .palette-card').first();
      if (await card.count()) { await card.click(); await page.waitForTimeout(600); }
      await page.locator('[data-testid=selected-tile-props-open]').first().click();
      await page.waitForTimeout(800);
      const m = await pe(page, `
        const root = document.querySelector('[data-testid=tile-props-dialog]'); if (!root) return { open: 0 };
        const dlg = root.querySelector('[role=dialog][aria-labelledby]'); const body = root.querySelector('.tile-props-dialog-body');
        const boxes = [...root.querySelectorAll('.tile-mapping-passage-grid input[type=checkbox]')];
        const meaning = boxes.filter((b) => /지나갈|통과|막|pass|block/i.test((b.getAttribute('aria-label') || '') + ' ' + (b.labels ? [...b.labels].map(textOf).join(' ') : ''))).length;
        const fonts = [body, ...body.querySelectorAll('.tile-mapping-inspector, .tile-mapping-title, .tile-mapping-meta, .tile-mapping-section-title')].filter(Boolean).map((e) => getComputedStyle(e).fontFamily);
        const close = root.querySelector('.tile-props-dialog-close'); const cr = close.getBoundingClientRect();
        return { open: 1, labelledDialog: dlg ? 1 : 0, directionBoxes: boxes.length, boxesWithMeaning: meaning, monospaceNodes: fonts.filter((f) => /mono/i.test(f)).length,
          closeW: Math.round(cr.width), closeH: Math.round(cr.height), closeGlyph: glyphOnly(textOf(close)) && !close.querySelector('svg') ? 1 : 0 };`);
      await page.keyboard.press('Escape');
      return { pass: m.open === 1 && m.labelledDialog === 1 && m.directionBoxes === 4 && m.boxesWithMeaning === 4 && m.monospaceNodes === 0 && m.closeW >= 32 && m.closeH >= 32 && m.closeGlyph === 0, measured: m };
    },
  },
  {
    id: 'C-40',
    surface: 'palette1440',
    title: 'Palette keyboard: Enter on a card keeps focus on the chosen card, ArrowRight moves to the next card without panning the map, one card is selected',
    async run({ page }) {
      const ok = await pe(page, `const c = document.querySelector('.palette-card-window .palette-card'); if (!c) return 0; c.focus(); return document.activeElement === c ? 1 : 0;`);
      if (!ok) return { pass: false, measured: { firstCardFocused: 0 } };
      const firstId = await pe(page, `return document.activeElement?.dataset.testid || '';`);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(900);
      const a = await pe(page, `const e = document.activeElement; const cam = window.__oprnEditCamera?.();
        const sel = new Set([...document.querySelectorAll('.palette-card.is-active, .palette-card[aria-selected=true], .palette-card[aria-pressed=true]')].filter(vis));
        return { activeIsCard: e?.classList.contains('palette-card') ? 1 : 0, activeIsChosen: e?.dataset.testid === arg ? 1 : 0, selectedCards: sel.size, camX: cam ? Math.round(cam.scrollX) : 0, camY: cam ? Math.round(cam.scrollY) : 0 };`, firstId);
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(500);
      const b = await pe(page, `const e = document.activeElement; const cam = window.__oprnEditCamera?.();
        return { activeIsCard: e?.classList.contains('palette-card') ? 1 : 0, movedOff: e?.dataset.testid !== arg ? 1 : 0, camX: cam ? Math.round(cam.scrollX) : 0, camY: cam ? Math.round(cam.scrollY) : 0 };`, firstId);
      const m = { firstCardFocused: ok, focusOnChosenAfterEnter: a.activeIsChosen, selectedCards: a.selectedCards, arrowMovedToCard: b.activeIsCard && b.movedOff ? 1 : 0,
        cameraShiftPx: Math.abs(b.camX - a.camX) + Math.abs(b.camY - a.camY) };
      return { pass: m.focusOnChosenAfterEnter === 1 && m.selectedCards === 1 && m.arrowMovedToCard === 1 && m.cameraShiftPx === 0, measured: m };
    },
  },
  {
    id: 'C-31',
    surface: 'rail1440',
    title: 'Left rail: active item has no accent side bar, labels are >= 12 px with contrast >= 4.5',
    async run({ page }) {
      const m = await pe(page, `
        const items = [...document.querySelectorAll('.left-activity-bar .left-activity-item')].filter(vis); if (!items.length) return { items: 0 };
        const active = items.filter((b) => b.getAttribute('aria-pressed') === 'true');
        const bars = active.filter((b) => { const s = getComputedStyle(b, '::before'); return s.content !== 'none' && s.content !== 'normal' && parseFloat(s.width) > 0; }).length;
        const labels = [...document.querySelectorAll('.left-activity-bar .ai-chat-sidebar-tab-label')].filter(vis);
        return { items: items.length, activeItems: active.length, activeSideBars: bars, activeInsetStripes: active.filter(insetStripe).length,
          labels: labels.length, minLabelFontPx: labels.length ? Math.min(...labels.map(fontPx)) : 0, minLabelContrast: labels.length ? Math.min(...labels.map(contrast)) : 0 };`);
      return { pass: m.items > 0 && m.activeItems === 1 && m.activeSideBars === 0 && m.activeInsetStripes === 0 && m.labels > 0 && m.minLabelFontPx >= 12 && m.minLabelContrast >= 4.5, measured: m };
    },
  },
  {
    id: 'C-55',
    surface: 'rail1440',
    title: 'Canvas/dock CSS: active layer button, relief tab and dock tab carry no inset accent stripe; the deck progress line does not sweep',
    async run({ page }) {
      const m = await pe(page, `
        const host = document.createElement('div'); host.className = 'left-panel-stack'; document.body.append(host);
        const mk = (tag, cls, attrs = {}) => { const e = document.createElement(tag); e.className = cls; for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); e.textContent = 'x'; host.append(e); return e; };
        const layer = mk('button', 'layer-btn active'); const relief = mk('button', 'relief-pop-tab is-active');
        const tabs = document.createElement('div'); tabs.className = 'ai-chat-sidebar-tabs'; host.append(tabs); const tab = document.createElement('button'); tab.setAttribute('aria-pressed', 'true'); tab.textContent = 'x'; tabs.append(tab);
        const rail = mk('div', 'ai-deck-rail', { 'data-ai-state': 'run' });
        const before = getComputedStyle(rail, '::before');
        const r = { layerBtnStripe: insetStripe(layer), reliefTabStripe: insetStripe(relief), dockTabStripe: insetStripe(tab),
          deckSweepAnimations: before.animationName && before.animationName !== 'none' ? 1 : 0 };
        host.remove(); return r;`);
      return { pass: m.layerBtnStripe === 0 && m.reliefTabStripe === 0 && m.dockTabStripe === 0 && m.deckSweepAnimations === 0, measured: m };
    },
  },
  {
    id: 'C-44',
    surface: 'inspect1440',
    title: 'Rail 「검사」 opens its popover beside the rail button, the title appears once, no emoji, sentence-case section labels',
    async run({ page }) {
      await page.locator('[data-testid=sidebar-inspect]').first().click();
      await page.waitForTimeout(900);
      const m = await pe(page, `
        const btn = document.querySelector('[data-testid=sidebar-inspect]'); const br = btn.getBoundingClientRect();
        const pop = [...document.querySelectorAll('.oprn-toolbar-dropdown')].filter(vis).find((d) => d.querySelector('.rule-audit-panel')); if (!pop) return { popover: 0 };
        const pr = pop.getBoundingClientRect();
        const clone = pop.cloneNode(true); clone.querySelectorAll('[data-testid^=sidebar-pin-]').forEach((e) => e.remove());
        const t = pop.innerText.replace(/\\s+/g, ' '); const tNoPins = (clone.textContent || '').replace(/\\s+/g, ' ');
        const sections = [...pop.querySelectorAll('.oprn-overflow-section, .rule-audit-panel > summary')].filter(vis);
        return { popover: 1, popLeft: Math.round(pr.left), railRight: Math.round(br.right), leftOffsetPx: Math.round(pr.left - br.right),
          railPressed: [...document.querySelectorAll('.left-activity-bar [aria-pressed=true]')].length,
          titleRepeats: count(tNoPins, '규칙 감사'), emoji: (t.match(/\\p{Extended_Pictographic}/gu) || []).length,
          upperSections: sections.filter((e) => getComputedStyle(e).textTransform !== 'none').length };`);
      await page.keyboard.press('Escape');
      return { pass: m.popover === 1 && Math.abs(m.leftOffsetPx) <= 16 && m.railPressed === 1 && m.titleRepeats <= 1 && m.emoji === 0 && m.upperSections === 0, measured: m };
    },
  },
];

// Wave-0 rows classified as L4 failures: same device, namespaced surface.
const W0_L4 = ['IS-020', 'IS-040', 'IS-012', 'IS-046', 'IS-103', 'IS-067', 'IS-089', 'C-106'];
const w0Surfaces = Object.fromEntries(
  [...new Set(W0_DEVICES.filter((d) => W0_L4.includes(d.id)).map((d) => d.surface))].map((s) => [`w0-${s}`, W0_SURFACES[s]]),
);
const w0Devices = W0_DEVICES.filter((d) => W0_L4.includes(d.id)).map((d) => ({ ...d, surface: `w0-${d.surface}` }));

Object.assign(surfaces, w0Surfaces);
export const devices = [...PART1, ...PART23, ...w0Devices];
