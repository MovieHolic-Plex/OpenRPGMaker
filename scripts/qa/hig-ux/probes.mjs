// Measuring probes for hig-ux devices. Every probe returns plain numbers so a device can
// assert on a measured value instead of text presence or state equality.
import fs from 'node:fs';
import { PNG } from 'pngjs';

const INTERACTIVE =
  'button,a[href],input,select,textarea,summary,[role=button],[role=tab],[role=menuitem],[role=option],[role=checkbox],[role=switch],[role=treeitem],[tabindex]:not([tabindex="-1"])';
const LAYERS = '[role=dialog],[role=alertdialog],[role=menu],[role=listbox],dialog[open],[aria-modal=true]';

// Injected into the page once per call; kept as a string so it runs in any document.
const HELPERS = `
  const __vis = (el) => { const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return false; const s = getComputedStyle(el);
    return s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.02 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth; };
  const __parseC = (c) => { const m = String(c).match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(parseFloat); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const __over = (f, b) => ({ r: f.r * f.a + b.r * (1 - f.a), g: f.g * f.a + b.g * (1 - f.a), b: f.b * f.a + b.b * (1 - f.a), a: 1 });
  const __lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const __bgOf = (el) => { const stack = []; let e = el; while (e && e.nodeType === 1) { const c = __parseC(getComputedStyle(e).backgroundColor); if (c && c.a > 0) { stack.push(c); if (c.a >= 0.99) break; } e = e.parentElement; }
    let base = { r: 255, g: 255, b: 255, a: 1 }; for (let i = stack.length - 1; i >= 0; i--) base = __over(stack[i], base); return base; };
  const __name = (el) => (el.getAttribute('aria-label') || (el.getAttribute('aria-labelledby') && document.getElementById(el.getAttribute('aria-labelledby'))?.innerText) || el.getAttribute('title') || el.innerText || el.value || el.placeholder || '').replace(/\\s+/g, ' ').trim();
  const __desc = (el) => { const r = el.getBoundingClientRect(); return { tag: el.tagName.toLowerCase(), name: __name(el).slice(0, 40), x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }; };
  const __collect = (sel) => { const out = []; for (const s of [].concat(sel)) for (const el of document.querySelectorAll(s)) if (__vis(el) && !out.includes(el)) out.push(el); return out; };
  const __inScope = (scope) => { const roots = scope ? __collect(scope) : [document.body]; const out = []; for (const r of roots) for (const el of [r, ...r.querySelectorAll(${JSON.stringify(INTERACTIVE)})]) if (el.matches(${JSON.stringify(INTERACTIVE)}) && __vis(el) && !out.includes(el)) out.push(el); return out; };
`;

function inPage(page, body, arg) {
  return page.evaluate(new Function('arg', `${HELPERS}\n${body}`), arg);
}

const round = (n, d = 2) => (Number.isFinite(n) ? Number(n.toFixed(d)) : n);

/** Largest pairwise intersection (CSS px^2) among the given targets, or all interactive elements in scope. Ancestor/descendant pairs are ignored. */
export async function overlapProbe(page, { selectors, scope } = {}) {
  return inPage(
    page,
    `const els = arg.selectors ? __collect(arg.selectors) : __inScope(arg.scope);
     let max = 0, pairs = 0; const samples = [];
     for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) {
       const a = els[i], b = els[j]; if (a.contains(b) || b.contains(a)) continue;
       const r = a.getBoundingClientRect(), s = b.getBoundingClientRect();
       const w = Math.min(r.right, s.right) - Math.max(r.left, s.left), h = Math.min(r.bottom, s.bottom) - Math.max(r.top, s.top);
       if (w > 0.5 && h > 0.5) { pairs++; const area = Math.round(w * h); max = Math.max(max, area); if (samples.length < 10) samples.push({ a: __desc(a), b: __desc(b), area }); }
     }
     return { elements: els.length, overlapPairs: pairs, maxOverlapPx2: max, samples };`,
    { selectors, scope },
  );
}

/** Smallest side (CSS px) of the targets and how many fall under minPx. */
export async function targetSizeProbe(page, { selectors, scope, minPx = 24 } = {}) {
  return inPage(
    page,
    `const els = arg.selectors ? __collect(arg.selectors) : __inScope(arg.scope);
     const d = els.map(__desc); const small = d.filter((e) => Math.min(e.w, e.h) < arg.minPx);
     return { elements: d.length, minSidePx: d.length ? Math.min(...d.map((e) => Math.min(e.w, e.h))) : null, belowCount: small.length, minPx: arg.minPx, samples: small.slice(0, 15) };`,
    { selectors, scope, minPx },
  );
}

function textWalk(body) {
  return `const roots = arg.selectors ? __collect(arg.selectors) : (arg.scope ? __collect(arg.scope) : [document.body]);
    const seen = new Set(); const items = [];
    for (const root of roots) { const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n;
      while ((n = w.nextNode())) { const t = (n.textContent || '').replace(/\\s+/g, ' ').trim(); const el = n.parentElement;
        if (!t || !el || seen.has(el) || !__vis(el)) continue; seen.add(el); const cs = getComputedStyle(el); ${body} } }`;
}

/** Smallest rendered font size (CSS px) of visible text and the count below floorPx. */
export async function fontFloorProbe(page, { selectors, scope, floorPx = 12 } = {}) {
  return inPage(
    page,
    `${textWalk(`items.push({ t: t.slice(0, 30), fs: parseFloat(cs.fontSize), ...__desc(el) });`)}
     const below = items.filter((i) => i.fs < arg.floorPx);
     return { texts: items.length, minFontPx: items.length ? Math.min(...items.map((i) => i.fs)) : null, belowCount: below.length, floorPx: arg.floorPx, samples: below.slice(0, 15) };`,
    { selectors, scope, floorPx },
  );
}

/** WCAG contrast of visible text against its composited background; minRatio and count below the AA need (4.5, or 3 for large text). */
export async function contrastProbe(page, { selectors, scope } = {}) {
  const r = await inPage(
    page,
    `${textWalk(`const fg = __parseC(cs.color); if (!fg) continue; const bg = __bgOf(el); const f2 = __over(fg, bg);
       const L1 = __lum(f2), L2 = __lum(bg); const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
       const fs = parseFloat(cs.fontSize); const large = fs >= 24 || (fs >= 18.66 && parseInt(cs.fontWeight) >= 700);
       items.push({ t: t.slice(0, 30), ratio, need: large ? 3 : 4.5, fs });`)}
     const low = items.filter((i) => i.ratio < i.need);
     return { texts: items.length, minRatio: items.length ? Math.min(...items.map((i) => i.ratio)) : null, belowCount: low.length, samples: low.slice(0, 15) };`,
    { selectors, scope },
  );
  r.minRatio = round(r.minRatio);
  for (const s of r.samples) s.ratio = round(s.ratio);
  return r;
}

/** Count of visible interactive elements without an accessible name. */
export async function accessibleNameProbe(page, { selectors, scope } = {}) {
  return inPage(
    page,
    `const els = arg.selectors ? __collect(arg.selectors) : __inScope(arg.scope);
     const unnamed = els.filter((e) => !__name(e));
     return { elements: els.length, unnamedCount: unnamed.length, samples: unnamed.slice(0, 15).map(__desc) };`,
    { selectors, scope },
  );
}

/** Visible elements that own a vertical scroll inside scope (nested scroll boxes). */
export async function scrollOwnerProbe(page, { scope } = {}) {
  return inPage(
    page,
    `const roots = arg.scope ? __collect(arg.scope) : [document.body]; const owners = [];
     for (const r of roots) for (const el of [r, ...r.querySelectorAll('*')]) { const s = getComputedStyle(el);
       if (/auto|scroll/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 1 && __vis(el) && !owners.includes(el)) owners.push(el); }
     return { scrollOwnerCount: owners.length, owners: owners.slice(0, 15).map((el) => (el.id ? '#' + el.id : el.tagName.toLowerCase()) + (el.getAttribute('class') ? '.' + el.getAttribute('class').trim().split(/\\s+/).slice(0, 3).join('.') : '')) };`,
    { scope },
  );
}

/** Document scroll overflow beyond the viewport (CSS px). */
export async function documentOverflowProbe(page) {
  return page.evaluate(() => {
    const d = document.documentElement;
    return {
      overflowXPx: Math.max(0, Math.max(d.scrollWidth, document.body.scrollWidth) - innerWidth),
      overflowYPx: Math.max(0, Math.max(d.scrollHeight, document.body.scrollHeight) - innerHeight),
      viewport: [innerWidth, innerHeight],
    };
  });
}

function changedPixels(a, b, threshold = 24) {
  const pa = PNG.sync.read(a);
  const pb = PNG.sync.read(b);
  if (pa.width !== pb.width || pa.height !== pb.height) return pa.width * pa.height;
  let n = 0;
  for (let i = 0; i < pa.data.length; i += 4) {
    const d = Math.max(
      Math.abs(pa.data[i] - pb.data[i]),
      Math.abs(pa.data[i + 1] - pb.data[i + 1]),
      Math.abs(pa.data[i + 2] - pb.data[i + 2]),
    );
    if (d > threshold) n++;
  }
  return n;
}

/**
 * Keyboard-style focus on selector and measure the ring: pixels that change in a 6 px band
 * around the element (normalised to CSS px), the element perimeter, and the computed outline/shadow width.
 */
export async function focusRingProbe(page, selector, { padPx = 6 } = {}) {
  await page.mouse.move(0, 0);
  await page.evaluate(() => document.activeElement?.blur?.());
  const loc = page.locator(selector).first();
  const box = await loc.boundingBox();
  if (!box) throw new Error(`focusRingProbe: ${selector} has no box`);
  const clip = { x: Math.max(0, box.x - padPx), y: Math.max(0, box.y - padPx), width: box.width + 2 * padPx, height: box.height + 2 * padPx };
  const before = await page.screenshot({ clip, animations: 'disabled' });
  await loc.evaluate((el) => el.focus({ focusVisible: true }));
  await page.waitForTimeout(350);
  const after = await page.screenshot({ clip, animations: 'disabled' });
  const dsf = await page.evaluate(() => devicePixelRatio);
  const style = await loc.evaluate((el) => {
    const s = getComputedStyle(el);
    const outline = s.outlineStyle !== 'none' ? parseFloat(s.outlineWidth) || 0 : 0;
    const shadow = s.boxShadow === 'none' ? 0 : Math.max(0, ...[...s.boxShadow.matchAll(/(-?[\d.]+)px/g)].map((m) => Math.abs(parseFloat(m[1]))));
    return { focused: document.activeElement === el, focusVisible: el.matches(':focus-visible'), outlineWidthPx: outline, shadowMaxPx: shadow };
  });
  const changed = changedPixels(before, after) / (dsf * dsf);
  if (process.env.HIG_UX_DEBUG_DIR) {
    fs.writeFileSync(`${process.env.HIG_UX_DEBUG_DIR}/focus-before.png`, before);
    fs.writeFileSync(`${process.env.HIG_UX_DEBUG_DIR}/focus-after.png`, after);
  }
  return { ...style, changedPx: Math.round(changed), perimeterPx: Math.round(2 * (box.width + box.height)) };
}

/**
 * Focus the trigger, open it with openKey, press Escape and measure where focus went.
 * focusDistancePx is the distance between the trigger centre and the focused element centre
 * (document.body when focus was dropped); focusRestored is 1 only when the trigger itself holds focus.
 */
export async function escapeRestoreProbe(page, selector, { openKey = 'Enter', settleMs = 900 } = {}) {
  const countLayers = () =>
    inPage(page, `return __collect(${JSON.stringify(LAYERS)}).length;`);
  const loc = page.locator(selector).first();
  await loc.evaluate((el) => el.focus({ focusVisible: true }));
  const layersBefore = await countLayers();
  await page.keyboard.press(openKey);
  await page.waitForTimeout(settleMs);
  const layersOpen = await countLayers();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(settleMs);
  const layersAfter = await countLayers();
  const where = await loc.evaluate((trigger) => {
    const a = document.activeElement ?? document.body;
    const c = (el) => {
      const r = el.getBoundingClientRect();
      return [r.left + r.width / 2, r.top + r.height / 2];
    };
    const [tx, ty] = c(trigger);
    const [ax, ay] = c(a);
    return {
      focusRestored: a === trigger ? 1 : 0,
      focusDistancePx: Math.round(Math.hypot(tx - ax, ty - ay)),
      focusedTag: a.tagName.toLowerCase(),
      focusedName: (a.getAttribute('aria-label') || a.innerText || '').trim().slice(0, 40),
    };
  });
  return { layersBefore, layersOpen, layersAfter, ...where };
}

/** Whole-page summary ported from the audit probe; used for capture records and before/after notes. */
export async function pageSummaryProbe(page) {
  const [targets, names, fonts, contrast, overflow, scroll] = [
    await targetSizeProbe(page, { minPx: 24 }),
    await accessibleNameProbe(page),
    await fontFloorProbe(page, { floorPx: 12 }),
    await contrastProbe(page),
    await documentOverflowProbe(page),
    await scrollOwnerProbe(page),
  ];
  return {
    interactive: targets.elements,
    small24: targets.belowCount,
    unnamed: names.unnamedCount,
    tinyText: fonts.belowCount,
    lowContrast: contrast.belowCount,
    minContrast: contrast.minRatio,
    overflowXPx: overflow.overflowXPx,
    scrollOwners: scroll.scrollOwnerCount,
  };
}
