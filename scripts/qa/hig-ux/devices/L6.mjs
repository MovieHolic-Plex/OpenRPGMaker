// Lane L6 devices: 자료집(데이터베이스) 창 · 세계 문서 (plan todos 12, 13) plus the wave-0 rows
// classified as L6 failures (IS-075, IS-076, IS-091, reused unchanged from wave0.mjs).
// Every device opens the 자료집 through its stable test id (labels are translated in en/ja and the
// capture box has no catalog to translate step labels), measures numbers and asserts on them.
import { devices as wave0Devices } from './wave0.mjs';

const VIS = `
  const vis = (el) => { if (!el || el.nodeType !== 1) return false; const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return false;
    const s = getComputedStyle(el); return s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.02 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth; };
  const textOf = (el) => (el.innerText || '').replace(/\\s+/g, ' ').trim();
  const rectOf = (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), b: Math.round(r.bottom), r: Math.round(r.right) }; };
  const win = () => [...document.querySelectorAll('.database-modal-window')].filter(vis)[0] || null;
  const parseC = (c) => { const m = String(c).match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(parseFloat); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const bgOf = (el) => { let e = el; while (e && e.nodeType === 1) { const c = parseC(getComputedStyle(e).backgroundColor); if (c && c.a > 0.5) return c; e = e.parentElement; } return { r: 255, g: 255, b: 255, a: 1 }; };
  const sat = (c) => { const mx = Math.max(c.r, c.g, c.b), mn = Math.min(c.r, c.g, c.b); return mx === 0 ? 0 : (mx - mn) / mx; };
`;
const pe = (page, body, arg = null) => page.evaluate(new Function('arg', `${VIS}\n${body}`), arg);

async function openDb(page) {
  const already = await page.locator('.database-modal-window').first().isVisible().catch(() => false);
  if (!already) {
    await page.locator('[data-testid="toolbar-database"]').first().click();
  }
  await page.locator('.database-modal-window').first().waitFor({ state: 'visible', timeout: 25_000 });
  await page.waitForTimeout(900);
}
async function clickTid(page, tid, settle = 700) {
  await page.locator(`[data-testid="${tid}"]`).first().click();
  await page.waitForTimeout(settle);
}
async function openTab(page, groupSlug, tabTid) {
  await clickTid(page, `db-group-strip-${groupSlug}`, 500);
  await clickTid(page, tabTid, 1200);
}
const w0 = Object.fromEntries(wave0Devices.filter((d) => ['IS-075', 'IS-076', 'IS-091'].includes(d.id)).map((d) => [d.id, d]));
// en/ja translate the 자료집 label; wait for the stable toolbar test id instead.
const READY = '[data-testid="toolbar-database"]';
const W0_SURFACE = { width: 1024, height: 640, lang: 'ko', steps: ['aria:자료집'] };

export const surfaces = {
  db1440: { width: 1440, height: 900, lang: 'ko' },
  db1024: { width: 1024, height: 640, lang: 'ko' },
  db900: { width: 900, height: 600, lang: 'ko' },
  db1440b: { width: 1440, height: 900, lang: 'ko' },
  world1366en: { width: 1366, height: 768, lang: 'en', readySelector: READY },
  enemyEn: { width: 1366, height: 768, lang: 'en', readySelector: READY },
  enemyJa: { width: 1366, height: 768, lang: 'ja', readySelector: READY },
  footer1440: { width: 1440, height: 900, lang: 'ko' },
  escFocus: { width: 1440, height: 900, lang: 'ko' },
  dirty: { width: 1440, height: 900, lang: 'ko' },
  deleteRef: { width: 1440, height: 900, lang: 'ko' },
  keepEdit: { width: 1440, height: 900, lang: 'ko' },
  rail: { width: 1440, height: 900, lang: 'ko' },
  world1440: { width: 1440, height: 900, lang: 'ko' },
  stripes: { width: 1440, height: 900, lang: 'ko' },
  tabSearch: { width: 1440, height: 900, lang: 'ko' },
  tabSearchEn: { width: 1366, height: 768, lang: 'en', readySelector: READY },
  sublistEn: { width: 1366, height: 768, lang: 'en', readySelector: READY },
  formNames: { width: 1440, height: 900, lang: 'ko' },
  listArrow: { width: 1440, height: 900, lang: 'ko' },
  fold: { width: 1440, height: 900, lang: 'ko' },
  'w0-IS-075': W0_SURFACE,
  'w0-IS-076': W0_SURFACE,
  'w0-IS-091': W0_SURFACE,
};

// ---------------------------------------------------------------- C-85 enemy detail language
async function enemyLanguage({ page }) {
  await openDb(page);
  await openTab(page, 'battle', 'db-tab-enemies');
  const m = await pe(page, `
    const w = win(); const pane = w.querySelector('.db-detail-pane, .oprn-record-detail-pane') || w;
    const all = textOf(pane);
    // chrome = hero tags and the faction picker, without spans that carry authored data (translate=no)
    const chromeText = (root) => { if (!root) return ''; const c = root.cloneNode(true); for (const d of c.querySelectorAll('[translate="no"], [data-i18n-skip]')) d.remove(); return (c.textContent || '').replace(/\\s+/g, ' ').trim(); };
    const tags = [...pane.querySelectorAll('.db-ws-hero-tags .db-ws-tag, .db-ws-hero-eyebrow')].filter(vis);
    const tagText = tags.map(chromeText).join(' | ');
    const sel = pane.querySelector('[data-testid="db-picker-enemy-faction"]');
    const selText = sel ? [...sel.options].map((o) => o.text).join(' | ') : '';
    const hangul = (s) => (s.match(/[\\uac00-\\ud7a3]/g) || []).length;
    const opts = [...pane.querySelectorAll('select')].filter(vis).flatMap((s) => [...s.options].map((o) => o.text));
    const rawEnum = (all.match(/\\((enemy|player|neutral|default)\\)/g) || []).length + opts.filter((t) => /\\((enemy|player|neutral)\\)/.test(t)).length;
    const badPlural = (all.match(/\\b1 (skills|actions|items|species)\\b/g) || []).length;
    return { tagHangul: hangul(tagText), factionSelectHangul: hangul(selText), rawEnum, badPlural, tagText: tagText.slice(0, 160), selText: selText.slice(0, 120) };`);
  return { pass: m.tagHangul === 0 && m.factionSelectHangul === 0 && m.rawEnum === 0 && m.badPlural === 0, measured: m };
}

// ---------------------------------------------------------------- C-76 small window layout
async function smallWindow({ page }) {
  await openDb(page);
  const m = await pe(page, `
    const w = win(); const wr = w.getBoundingClientRect();
    const list = w.querySelector('.db-actor-studio-table, .db-list');
    const lr = list.getBoundingClientRect();
    const rows = [...list.querySelectorAll('.db-list-row')].filter((r) => { const b = r.getBoundingClientRect(); return b.height > 4 && b.top >= lr.top - 1 && b.bottom <= lr.bottom + 1; });
    const nameCell = list.querySelector('.db-list-row .db-actor-name-stack, .db-list-row .db-list-name');
    const loadout = w.querySelector('[data-testid="db-field-actor-loadout-slots"]');
    const scrollers = [w, ...w.querySelectorAll('*')].filter((el) => { const s = getComputedStyle(el); return /auto|scroll/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 1 && vis(el); });
    const footer = w.querySelector('.database-modal-footer'); const fr = footer.getBoundingClientRect();
    const ai = [...w.querySelectorAll('.database-ai-bar:not([hidden]), [data-testid="database-ai-bar"]')].filter(vis)[0];
    const backdrop = w.closest('.database-modal-backdrop'); const bc = parseC(getComputedStyle(backdrop).backgroundColor) || { a: 0 };
    const gap = Math.max(0, Math.round(wr.left), Math.round(wr.top), Math.round(innerWidth - wr.right), Math.round(innerHeight - wr.bottom));
    return { visibleRows: rows.length, nameCellW: nameCell ? Math.round(nameCell.clientWidth) : 0, loadoutInputW: loadout ? Math.round(loadout.clientWidth) : 0,
      scrollOwners: scrollers.length, scrollerNames: scrollers.map((e) => (e.getAttribute('class') || e.tagName).split(' ')[0]).join(','),
      aiBarOverlapPx: ai ? Math.max(0, Math.round(ai.getBoundingClientRect().bottom - fr.top)) : 0, edgeGapPx: gap, scrimAlpha: +bc.a.toFixed(2) };`);
  const minRows = m.visibleRows >= 0 && page.viewportSize().height >= 900 ? 8 : 6;
  m.minRows = minRows;
  const edgeOk = m.edgeGapPx === 0 || m.scrimAlpha >= 0.85;
  m.edgeOk = edgeOk ? 1 : 0;
  return { pass: m.visibleRows >= minRows && m.nameCellW >= 80 && m.loadoutInputW >= 80 && m.scrollOwners <= 2 && m.aiBarOverlapPx === 0 && edgeOk, measured: m };
}

async function worldComposer({ page }) {
  await openDb(page);
  await openTab(page, 'lore', 'db-tab-world-canon');
  const m = await pe(page, `
    const w = win(); const footer = w.querySelector('.database-modal-footer'); const fr = footer.getBoundingClientRect();
    const bar = [...w.querySelectorAll('.world-canon-body-ai, [class*=body-ai]')].filter((e) => e.querySelector('button'))[0];
    if (!bar) return { found: 0 };
    const btns = [...bar.querySelectorAll('button, input')].filter((b) => b.getClientRects().length);
    const below = btns.filter((b) => b.getBoundingClientRect().bottom > fr.top + 0.5).length;
    const cut = btns.filter((b) => { const r = b.getBoundingClientRect(); return r.top < fr.top && r.bottom > fr.top; }).length;
    let sc = bar.parentElement; while (sc && !(sc.scrollHeight > sc.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(sc).overflowY))) sc = sc.parentElement;
    return { found: 1, controls: btns.length, controlsBelowFooter: below, controlsCutByFooter: cut, inScroller: sc && w.contains(sc) ? 1 : 0 };`);
  // Reachable means: every composer control is above the footer, or it sits inside a scroll owner (scrollable into view) and none is cut.
  return { pass: m.found === 1 && m.controlsCutByFooter === 0 && (m.controlsBelowFooter === 0 || m.inScroller === 1), measured: m };
}

// ---------------------------------------------------------------- C-84 list and header density
async function listDensity({ page }) {
  await openDb(page);
  const m = await pe(page, `
    const w = win(); const wr = w.getBoundingClientRect();
    const head = [...w.querySelectorAll('.db-actor-table-header [role=columnheader]')].filter(vis);
    const helps = [...w.querySelectorAll('.actor-field-help, .db-record-hero-summary')].filter(vis);
    const minFont = (els) => els.length ? Math.min(...els.map((e) => parseFloat(getComputedStyle(e).fontSize))) : 99;
    const del = [...w.querySelectorAll('[data-testid="db-delete-selected"]')].filter(vis)[0];
    const dup = [...w.querySelectorAll('[data-testid="db-duplicate-record"]')].filter(vis)[0];
    const dc = del ? parseC(getComputedStyle(del).color) : null; const dupc = dup ? parseC(getComputedStyle(dup).color) : null;
    const redness = (c) => c ? c.r - Math.max(c.g, c.b) : 0;
    const deleteDanger = del && (redness(dc) >= 60 || redness(bgOf(del)) >= 60) ? 1 : 0;
    const gap = del && dup ? Math.round(del.getBoundingClientRect().left - dup.getBoundingClientRect().right) : -1;
    // occurrences of the category word as chrome (headings, tabs, chips) in the top 300px of the window;
    // record names inside list rows are authored data and are not counted
    let top = 0; const walker = document.createTreeWalker(w, NodeFilter.SHOW_TEXT); let n;
    while ((n = walker.nextNode())) { const el = n.parentElement; if (!el || !vis(el) || el.closest('.db-list-row')) continue; const t = n.textContent || ''; if (!t.includes('주인공')) continue; const r = el.getBoundingClientRect(); if (r.top < wr.top + 300) top += (t.match(/주인공/g) || []).length; }
    const rows = [...w.querySelectorAll('.db-actor-table-row:not(.db-actor-table-header)')];
    const cols = rows.length ? rows[0].querySelectorAll('[role=gridcell]').length : 0;
    let sameCols = 0; for (let c = 1; c < cols; c++) { const vals = new Set(rows.map((r) => textOf(r.querySelectorAll('[role=gridcell]')[c] || r))); if (vals.size === 1) sameCols++; }
    const nameRepeat = rows.filter((r) => { const name = textOf(r.querySelector('.db-list-name') || r); return [...r.querySelectorAll('[role=gridcell]')].slice(1).some((c) => textOf(c) === name); }).length;
    return { headerMinFont: minFont(head), helpMinFont: minFont(helps), deleteDanger, deleteGapPx: gap, topCategoryWord: top, sameValueColumns: sameCols, nameRepeatRows: nameRepeat, rows: rows.length };`);
  return { pass: m.headerMinFont >= 12 && m.helpMinFont >= 12 && m.deleteDanger === 1 && m.deleteGapPx >= 12 && m.topCategoryWord <= 2 && m.sameValueColumns === 0 && m.nameRepeatRows === 0, measured: m };
}

// ---------------------------------------------------------------- C-81 footer weight
async function footerWeight({ page }) {
  await openDb(page);
  const m = await pe(page, `
    const w = win(); const f = w.querySelector('.database-modal-footer');
    const btns = [...f.querySelectorAll('button')].filter(vis);
    const filled = btns.filter((b) => { const c = parseC(getComputedStyle(b).backgroundColor); return c && c.a > 0.8 && sat(c) > 0.35; });
    const undo = btns.find((b) => b.dataset.testid === 'database-footer-undo');
    const help = btns.find((b) => b.dataset.testid === 'database-footer-help');
    const close = btns.find((b) => b.dataset.testid === 'database-footer-ok') || btns.find((b) => /닫기/.test(textOf(b)));
    const ratio = (b) => { const s = getComputedStyle(b); const fg = parseC(s.color); const bg = bgOf(b); const op = Number(s.opacity); const mix = { r: fg.r * op + bg.r * (1 - op), g: fg.g * op + bg.g * (1 - op), b: fg.b * op + bg.b * (1 - op) }; return contrast(mix, bg); };
    return { primaryFilled: filled.length, primaryText: filled.map(textOf).join('/'), undoDisabled: undo && undo.disabled ? 1 : 0,
      undoOpacity: undo ? Number(getComputedStyle(undo).opacity) : 1, undoContrast: undo ? +ratio(undo).toFixed(2) : 0, enabledContrast: close ? +ratio(close).toFixed(2) : 0,
      helpLeftOfClose: help && close && help.getBoundingClientRect().left < close.getBoundingClientRect().left ? 1 : 0 };`);
  const dimmed = m.undoDisabled === 1 && (m.undoOpacity <= 0.5 || m.undoContrast < m.enabledContrast);
  m.undoDimmed = dimmed ? 1 : 0;
  return { pass: m.primaryFilled === 1 && dimmed && m.helpLeftOfClose === 1, measured: m };
}

// ---------------------------------------------------------------- C-83 focus restore + Ctrl+K
async function escapeAndPalette({ page }) {
  const btn = page.locator('[data-testid="toolbar-database"]').first();
  await btn.focus();
  await page.keyboard.press('Enter');
  await page.locator('.database-modal-window').first().waitFor({ state: 'visible', timeout: 25_000 });
  await page.waitForTimeout(900);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(900);
  const after = await pe(page, `
    const a = document.activeElement; const open = [...document.querySelectorAll('.database-modal-window')].filter(vis).length;
    return { open, focusOnOpener: a && a.dataset && a.dataset.testid === 'toolbar-database' ? 1 : 0, focused: a ? (a.getAttribute('aria-label') || a.tagName).slice(0, 30) : '' };`);
  await btn.focus();
  await page.keyboard.press('Enter');
  await page.locator('.database-modal-window').first().waitFor({ state: 'visible', timeout: 25_000 });
  await page.waitForTimeout(900);
  await page.keyboard.press('Control+k');
  await page.waitForTimeout(900);
  const pal = await pe(page, `
    const p = [...document.querySelectorAll('[data-testid="command-palette"] [role=dialog]')].filter(vis);
    const top = p[0] ? document.elementFromPoint(p[0].getBoundingClientRect().left + 20, p[0].getBoundingClientRect().top + 15) : null;
    return { palettes: p.length, paletteOnTop: p[0] && top && p[0].contains(top) ? 1 : 0, paletteFocused: p[0] && p[0].contains(document.activeElement) ? 1 : 0 };`);
  const m = { closedAfterEscape: after.open === 0 ? 1 : 0, focusOnOpener: after.focusOnOpener, focusedAfterClose: after.focused, ...pal };
  return { pass: m.closedAfterEscape === 1 && m.focusOnOpener === 1 && m.palettes === 1 && m.paletteOnTop === 1, measured: m };
}

// ---------------------------------------------------------------- C-82 close flow consistency
async function closeFlow({ page }) {
  const editAndClose = async (how) => {
    await openDb(page);
    const lvl = page.locator('[data-testid="db-field-initial-level"]').first();
    await lvl.click();
    await lvl.fill(how === 'escape' ? '7' : '8');
    await page.keyboard.press('Tab');
    await page.waitForTimeout(500);
    if (how === 'escape') await page.keyboard.press('Escape');
    else await page.locator('[data-testid="database-modal-close"]').first().click();
    await page.waitForTimeout(1000);
    return pe(page, `
      const w = win(); const band = w ? [...w.querySelectorAll('[data-testid="database-dirty-prompt"]')].filter(vis)[0] : null;
      const first = band ? [...band.querySelectorAll('button')].filter(vis)[0] : null;
      const undoEmpty = w ? [...w.querySelectorAll('[data-testid="database-footer-undo"]')].filter((b) => b.disabled).length : 0;
      return { open: w ? 1 : 0, band: band ? 1 : 0, focusOnFirstBandButton: first && document.activeElement === first ? 1 : 0, bandWithNoUndo: band && undoEmpty ? 1 : 0 };`);
  };
  const esc = await editAndClose('escape');
  let saveErrors = 0;
  let closedAfterSave = 1;
  if (esc.band) {
    await page.locator('[data-testid="database-dirty-save"]').first().click();
    await page.waitForTimeout(1500);
    const r = await pe(page, `const errs = [...document.querySelectorAll('[data-status-kind="error"], .toast-message.error, [class*=toast][class*=error]')].filter(vis).length; return { errs, open: win() ? 1 : 0 };`);
    saveErrors = r.errs;
    closedAfterSave = r.open ? 0 : 1;
  }
  if (await page.locator('.database-modal-window').first().isVisible().catch(() => false)) {
    await page.locator('[data-testid="database-modal-close"]').first().click();
    await page.waitForTimeout(800);
  }
  const x = await editAndClose('x');
  const m = { escapeOpen: esc.open, escapeBand: esc.band, xOpen: x.open, xBand: x.band, focusOnFirstBandButton: esc.focusOnFirstBandButton, bandWithNoUndo: esc.bandWithNoUndo + x.bandWithNoUndo, saveErrors, closedAfterSave };
  const same = m.escapeOpen === m.xOpen && m.escapeBand === m.xBand ? 1 : 0;
  m.sameOutcome = same;
  const bandOk = m.escapeBand === 0 || (m.focusOnFirstBandButton === 1 && m.closedAfterSave === 1 && m.saveErrors <= 1);
  return { pass: same === 1 && bandOk && m.bandWithNoUndo === 0, measured: m };
}

// ---------------------------------------------------------------- C-109 / C-119 delete of a referenced record
async function selectActor(page, name) {
  await page.locator('.db-actor-table-row.db-list-row', { hasText: name }).first().click();
  await page.waitForTimeout(700);
}
async function deleteReferenced({ page }) {
  await openDb(page);
  await selectActor(page, '수호자');
  const before = await pe(page, `
    const del = [...document.querySelectorAll('[data-testid="db-delete-selected"]')].filter(vis)[0];
    const ids = (del.getAttribute('aria-describedby') || '').split(/\\s+/).filter(Boolean);
    const reasons = ids.map((id) => document.getElementById(id)).filter((e) => e && vis(e) && textOf(e).length > 0);
    return { blocked: del.disabled || del.getAttribute('aria-disabled') === 'true' ? 1 : 0, visibleReason: reasons.length };`);
  const del = page.locator('[data-testid="db-delete-selected"]').first();
  await del.focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(700);
  const after = await pe(page, `
    const tools = [...document.querySelectorAll('.database-modal-window .db-toolbar button')].filter(vis);
    const pops = [...document.querySelectorAll('.toast, .toast-message, [class*=toast-item], [role=alert]')].filter(vis);
    let covered = 0; for (const t of tools) { const r = t.getBoundingClientRect(); for (const p of pops) { const q = p.getBoundingClientRect(); if (Math.min(r.right, q.right) - Math.max(r.left, q.left) > 1 && Math.min(r.bottom, q.bottom) - Math.max(r.top, q.top) > 1) covered++; } }
    const rows = [...document.querySelectorAll('.db-actor-table-row.db-list-row')].filter((r) => textOf(r).startsWith('수호자')).length;
    return { coveredToolbarButtons: covered, stillPresent: rows };`);
  const m = { ...before, ...after };
  return { pass: m.blocked === 1 && m.visibleReason >= 1 && m.coveredToolbarButtons === 0 && m.stillPresent >= 1, measured: m };
}
async function deleteName({ page }) {
  await openDb(page);
  await selectActor(page, '수호자');
  const m = await pe(page, `
    const del = [...document.querySelectorAll('[data-testid="db-delete-selected"]')].filter(vis)[0];
    const name = (del.getAttribute('aria-label') || textOf(del));
    return { namesRecord: name.includes('수호자') ? 1 : 0, nameLength: name.length, label: name.slice(0, 40) };`);
  return { pass: m.namesRecord === 1, measured: m };
}

// ---------------------------------------------------------------- C-115 keep editing returns focus
async function keepEditing({ page }) {
  await openDb(page);
  await openTab(page, 'lore', 'db-tab-world-codex');
  await clickTid(page, 'world-add-entity', 900);
  const name = page.locator('[data-testid="world-edit-name"]').first();
  await name.click();
  await name.fill('L6 키보드 카드');
  await page.waitForTimeout(300);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(900);
  const band = await pe(page, `return { band: [...document.querySelectorAll('[data-testid="database-dirty-prompt"]')].filter(vis).length };`);
  const keep = page.locator('[data-testid="database-dirty-keep-editing"]').first();
  if (band.band) {
    await keep.focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(700);
  }
  const m = await pe(page, `
    const a = document.activeElement;
    return { focusOnEditedField: a && a.dataset && a.dataset.testid === 'world-edit-name' ? 1 : 0, focusOnClose: a && a.dataset && a.dataset.testid === 'database-modal-close' ? 1 : 0,
      bandAfter: [...document.querySelectorAll('[data-testid="database-dirty-prompt"]')].filter(vis).length, open: win() ? 1 : 0 };`);
  Object.assign(m, band);
  return { pass: m.band === 1 && m.focusOnEditedField === 1 && m.bandAfter === 0 && m.open === 1, measured: m };
}

// ---------------------------------------------------------------- C-79 rail group switch
async function railGroups({ page }) {
  await openDb(page);
  const out = {};
  let bad = 0;
  for (const [slug, label] of [['lore', '이야기'], ['battle', '전투'], ['life', '생활'], ['system', '시스템']]) {
    await clickTid(page, `db-group-strip-${slug}`, 1200);
    const r = await pe(page, `
      const w = win(); const crumb = w.querySelector('[data-testid="database-modal-crumb"] li'); const first = crumb ? textOf(crumb).replace(/^›\\s*/, '') : '';
      const current = [...w.querySelectorAll('.db-tabs > .db-tab[aria-current]')].filter(vis).length;
      return { first, current };`);
    out[`${slug}_crumbMatches`] = r.first === label ? 1 : 0;
    out[`${slug}_currentItems`] = r.current;
    if (r.first !== label || r.current !== 1) bad++;
  }
  const strip = await pe(page, `
    const s = [...document.querySelectorAll('[data-testid="db-group-strip-world"] .db-group-strip-label')][0];
    const editorRail = [...document.querySelectorAll('button[aria-label="맵"], [data-testid*="left-rail"] button')].map((b) => (b.getAttribute('aria-label') || textOf(b)));
    return { mapGroupLabel: s ? textOf(s) : '', sameAsEditorRail: s && textOf(s) === '맵' ? 1 : 0, editorRailHasMap: editorRail.includes('맵') ? 1 : 0 };`);
  Object.assign(out, strip, { badGroups: bad });
  return { pass: bad === 0 && strip.sameAsEditorRail === 0, measured: out };
}

// ---------------------------------------------------------------- C-80 hidden tabs and duplicate heading
async function hiddenTabs({ page }) {
  await openDb(page);
  const out = {};
  let bad = 0;
  for (const [slug, label] of [['life', '생활'], ['lore', '이야기']]) {
    await clickTid(page, `db-group-strip-${slug}`, 1000);
    const r = await pe(page, `
      const w = win(); const rail = w.querySelector('.db-tabs');
      const inView = [...rail.children].filter((c) => vis(c));
      // a run = one element whose own text joins names with three or more middle dots (a sentence-like list;
      // a single tab name such as 「낚시·채집·박물관」 carries two)
      const own = (e) => [...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('');
      const dotRuns = [...rail.querySelectorAll('*')].filter((e) => vis(e) && (own(e).match(/·/g) || []).length >= 3).length;
      const head = inView.find((c) => c.classList.contains('db-tab-group'));
      const headText = head ? textOf(head) : '';
      const hiddenTabs = [...rail.querySelectorAll('.db-tab')].filter((t) => t.hidden && !t.dataset.searchSecondary && (t.dataset.inView === '1')).length;
      const revealButtons = [...rail.querySelectorAll('button')].filter((b) => vis(b) && b.dataset.revealTab).length;
      return { dotRuns, headText, hiddenTabs, revealButtons };`);
    out[`${slug}_dotRuns`] = r.dotRuns;
    out[`${slug}_headEqualsRail`] = r.headText === label ? 1 : 0;
    out[`${slug}_hiddenTabs`] = r.hiddenTabs;
    out[`${slug}_revealButtons`] = r.revealButtons;
    if (r.dotRuns > 0 || r.headText === label || r.revealButtons !== r.hiddenTabs) bad++;
  }
  out.badGroups = bad;
  return { pass: bad === 0, measured: out };
}

// ---------------------------------------------------------------- C-87 world overview radios and copy
async function worldOverview({ page }) {
  await openDb(page);
  await openTab(page, 'lore', 'db-tab-world-canon');
  const snap = await page.locator('[data-testid="db-world-canon-status"]').first().ariaSnapshot().catch(() => '');
  const snap2 = await page.locator('[data-testid="db-world-canon-visibility"]').first().ariaSnapshot().catch(() => '');
  const names = [...`${snap}\n${snap2}`.matchAll(/radio "([^"]*)"/g)].map((x) => x[1]);
  const m = await pe(page, `
    const w = win();
    const radios = [...w.querySelectorAll('input[type=radio]')].filter((r) => r.closest('[data-testid="db-world-canon-status"], [data-testid="db-world-canon-visibility"]'));
    const hit = radios.map((r) => { const l = r.closest('label') || r; const b = l.getBoundingClientRect(); return Math.min(b.width, b.height); });
    const bgA = (r) => { const l = r.closest('label') || r; const c = parseC(getComputedStyle(l).backgroundColor); return c ? c.a * (sat(c) > 0.3 ? 1 : 0.2) : 0; };
    const sel = radios.filter((r) => r.checked), uns = radios.filter((r) => !r.checked);
    const fillDelta = sel.length && uns.length ? Math.max(...sel.map(bgA)) - Math.max(...uns.map(bgA)) : 1;
    const txt = textOf(w);
    return { radios: radios.length, minHitPx: hit.length ? Math.round(Math.min(...hit)) : 0, selectedFillDelta: +fillDelta.toFixed(2),
      limitMentions: (txt.match(/20,?000자/g) || []).length, assistantWord: (txt.match(/어시스턴트/g) || []).length + [...w.querySelectorAll('[aria-label*="어시스턴트"],[title*="어시스턴트"]')].length,
      freeWriteMentions: (txt.match(/자유롭게 적으세요/g) || []).length };`);
  m.rawEnumNames = names.filter((n) => /^(draft|canon|public|secret)$/.test(n)).length;
  m.namedRadios = names.length;
  return { pass: m.radios >= 4 && m.namedRadios >= 4 && m.rawEnumNames === 0 && m.minHitPx >= 24 && m.selectedFillDelta <= 0.05 && m.limitMentions === 1 && m.assistantWord === 0, measured: m };
}

// ---------------------------------------------------------------- C-88 stripe selection markers
// The audit's lint findings (D-004 .. D-051) are CSS rules, several of them overridden at the default
// state, so the device reads the shipped stylesheet (CSSOM) for the cited selectors and counts the rules
// that still paint a one-side stripe (border on one side >= 2px, or an inset box-shadow 2-4px along one
// edge) or a 2px accent outline. It also checks the rendered selected actor row.
const STRIPE_SELECTORS = [
  '.database-ai-turn-request', '.asset-browser-title-input', '.db-studio-summary-metric', '.oprn-record-classes .db-list-row.active',
  '.db-tab-note', 'button.db-actor-table-row.active', '.db-dialogue-row.is-overflow', '.db-script-line.is-overflow', '.world-card.active',
  '.world-canon-ai-grid-item', '.growth-catalog-item.is-active', '.growth-node.is-selected', '.growth-node-port', '.db-troop-member-row.active',
  '.db-list-row.active', '.db-record-intro', '.db-gallery-card.active', '.db-system-section-button.active', '.db-system-studio-preview-menu span',
  '.db-system-resolution-warning', '.tileset-ai-result-tile-row.locked', '.tileset-ai-analyze-copy li', '.tileset-ai-analyze-spinner',
  '.tileset-knowledge-template-grid button',
];
async function stripes({ page }) {
  await openDb(page);
  const m = await page.evaluate((keys) => {
    const rules = [];
    const walk = (list) => { for (const r of list) { if (r.cssRules && !r.selectorText) walk(r.cssRules); else if (r.selectorText) rules.push(r); } };
    for (const sheet of document.styleSheets) { try { walk(sheet.cssRules); } catch { /* cross-origin */ } }
    const px = (v) => { const m = String(v || '').match(/(-?[\d.]+)px/); return m ? Math.abs(parseFloat(m[1])) : 0; };
    let edge = 0, inset = 0, outline = 0; const samples = [];
    for (const r of rules) {
      const sel = r.selectorText; if (!keys.some((k) => sel.includes(k))) continue;
      const st = r.style;
      const sides = ['Left', 'Right', 'Top', 'Bottom'].map((side) => ({ side, w: px(st[`border${side}Width`]), style: st[`border${side}Style`], color: st[`border${side}Color`] }));
      const set = sides.filter((x) => x.w >= 2 && x.style !== 'none');
      if (set.length > 0 && set.length < 4) { edge++; if (samples.length < 8) samples.push(`edge ${sel.slice(-50)}`); }
      else if (set.length === 4 && /accent/.test(st.borderColor || st.borderTopColor || '')) { outline++; if (samples.length < 8) samples.push(`outline ${sel.slice(-50)}`); }
      const sh = (st.boxShadow || '').replace(/var\([^)]*\)\)?|rgba?\([^)]*\)|color-mix\([^)]*\)\)?/g, 'C');
      if (/inset\s+-?[2-4]px\s+0(px)?(\s+0(px)?)?\s+C?/.test(sh)) { inset++; if (samples.length < 8) samples.push(`inset ${sel.slice(-50)}`); }
    }
    const a = document.querySelector('.db-actor-table-row.active');
    return { matchedRules: rules.filter((r) => keys.some((k) => r.selectorText.includes(k))).length, edgeRules: edge, insetRules: inset, accentOutlineRules: outline,
      selectedRowShadowNone: a && getComputedStyle(a).boxShadow === 'none' ? 1 : 0, samples: samples.join(' | ') };
  }, STRIPE_SELECTORS);
  m.stripes = m.edgeRules + m.insetRules + m.accentOutlineRules;
  return { pass: m.matchedRules > 0 && m.stripes === 0 && m.selectedRowShadowNone === 1, measured: m };
}

// ---------------------------------------------------------------- C-78 tab search icon
async function tabSearchIcon({ page }) {
  await openDb(page);
  const m = await pe(page, `
    const i = [...document.querySelectorAll('.db-tab-search')].filter(vis)[0]; const s = getComputedStyle(i);
    const hasIcon = s.backgroundImage && s.backgroundImage !== 'none' ? 1 : 0;
    const posX = parseFloat(s.backgroundPositionX) || 0; const size = parseFloat((s.backgroundSize || '').split(' ')[0]) || 16;
    const iconRight = hasIcon ? posX + size : 0;
    return { hasIcon, paddingLeft: parseFloat(s.paddingLeft), iconRight: Math.round(iconRight), needed: Math.round(iconRight + 4) };`);
  return { pass: m.paddingLeft >= m.needed, measured: m };
}

// ---------------------------------------------------------------- C-86 en truncation and uppercase labels
async function sublistTruncation({ page }) {
  await openDb(page);
  const m = await pe(page, `
    const w = win(); const tabs = [...w.querySelectorAll('.db-tabs > .db-tab')].filter(vis);
    let clipped = 0, bad = 0; const samples = [];
    for (const t of tabs) { const label = [...t.querySelectorAll('*'), t].find((e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()));
      if (!label) continue; const s = getComputedStyle(label);
      const over = label.scrollWidth > label.clientWidth + 1 || t.scrollWidth > t.clientWidth + 1;
      if (!over) continue; clipped++;
      const ellipsis = s.textOverflow === 'ellipsis' && s.overflow !== 'visible' && !/flex|grid/.test(s.display);
      const titled = !!(t.getAttribute('title') || label.getAttribute('title'));
      if (!(ellipsis && titled)) { bad++; if (samples.length < 4) samples.push(textOf(t).slice(0, 30)); } }
    const labels = [...w.querySelectorAll('.db-detail-pane .db-field > span:first-child, .db-detail-pane .actor-check span, .db-detail-pane label.db-field > span')].filter(vis);
    const upper = labels.filter((l) => getComputedStyle(l).textTransform === 'uppercase').length;
    return { tabs: tabs.length, clippedTabs: clipped, clippedWithoutEllipsis: bad, samples: samples.join(' | '), fieldLabels: labels.length, uppercaseLabels: upper };`);
  return { pass: m.fieldLabels > 0 && m.uppercaseLabels === 0 && m.clippedWithoutEllipsis === 0, measured: m };
}

// ---------------------------------------------------------------- C-77 form names and hit areas
// Accessible names come from Chromium's accessibility tree (ariaSnapshot), not from attribute guessing.
async function unnamedControls(page) {
  const snap = await page.locator('.database-modal-window .db-body').first().ariaSnapshot().catch(() => '');
  const ctrls = [...snap.matchAll(/^\s*- (textbox|spinbutton|combobox|checkbox|searchbox|slider|radio|switch)(?= |:|$)(?: "([^"]*)")?(.*)$/gm)].map((x) => ({ role: x[1], name: x[2] ?? '', rest: x[3] }));
  const unnamed = ctrls.filter((c) => !c.name.trim());
  const valueOnly = ctrls.filter((c) => { const v = (c.rest.match(/: "?([^"]*)"?$/) || [])[1]; return c.name && v && c.name.trim() === v.trim(); });
  return { controls: ctrls.length, unnamed: unnamed.length, valueOnly: valueOnly.length, samples: unnamed.slice(0, 4).map((c) => c.role + c.rest.slice(0, 24)).join(';') };
}
async function formNames({ page }) {
  await openDb(page);
  const actors = await unnamedControls(page);
  const strip = await page.locator('[data-testid="db-group-strip"]').first().ariaSnapshot().catch(() => '');
  const stripNames = [...strip.matchAll(/button "([^"]*)"/g)].map((x) => x[1]);
  const m = await pe(page, `
    const cb = document.querySelector('[data-testid="db-actor-start-party"]'); const hit = cb ? (cb.closest('label') || cb).getBoundingClientRect() : null;
    const strip = [...document.querySelectorAll('[data-testid^="db-group-strip-"]')].filter(vis);
    return { partyHitMinPx: hit ? Math.round(Math.min(hit.width, hit.height)) : 0, stripLabels: strip.map((b) => textOf(b)).join('|') };`);
  const visible = m.stripLabels.split('|');
  m.stripNameMismatch = stripNames.filter((n, i) => !visible[i] || !n.startsWith(visible[i])).length;
  await openTab(page, 'battle', 'db-tab-states');
  const states = await unnamedControls(page);
  await openTab(page, 'battle', 'db-tab-enemies');
  const enemies = await unnamedControls(page);
  Object.assign(m, { actorControls: actors.controls, actorUnnamed: actors.unnamed, stateControls: states.controls, stateUnnamed: states.unnamed, enemyControls: enemies.controls, enemyUnnamed: enemies.unnamed,
    nameEqualsValue: actors.valueOnly + states.valueOnly + enemies.valueOnly, samples: [actors.samples, states.samples, enemies.samples].join(' | '), stripNamed: stripNames.length });
  const unnamed = m.actorUnnamed + m.stateUnnamed + m.enemyUnnamed;
  m.unnamedControls = unnamed;
  return { pass: m.actorControls > 3 && m.stateControls > 3 && unnamed === 0 && m.partyHitMinPx >= 24 && m.stripNamed >= 6 && m.stripNameMismatch === 0, measured: m };
}

// ---------------------------------------------------------------- C-117 ArrowDown from the record search
async function listArrow({ page }) {
  await openDb(page);
  const input = page.locator('.database-modal-window [data-testid="db-record-search"]').first();
  await input.focus();
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(500);
  const m = await pe(page, `
    const a = document.activeElement; const onRow = a && a.classList && a.classList.contains('db-list-row') ? 1 : 0;
    return { focusOnRow: onRow, focusOnSearch: a && a.dataset && a.dataset.testid === 'db-record-search' ? 1 : 0, rowSelected: onRow && (a.getAttribute('aria-selected') === 'true' || a.classList.contains('active')) ? 1 : 0 };`);
  return { pass: m.focusOnRow === 1, measured: m };
}

export const devices = [
  { id: 'C-85-en', surface: 'enemyEn', title: '적 상세: 영어 화면의 칩·진영 선택에 한국어 낱말·원시 enum·잘못된 복수형이 없다', run: enemyLanguage },
  { id: 'C-85-ja', surface: 'enemyJa', title: '적 상세: 일본어 화면의 칩·진영 선택에 한국어 낱말·원시 enum 이 없다', run: enemyLanguage },
  { id: 'C-84', surface: 'db1440', title: '자료집 목록·머리: 글자 12px 이상, 삭제는 위험 스타일로 떨어짐, 범주 낱말 반복 2회 이하, 같은 값 열 없음', run: listDensity },
  { id: 'C-76-1024', surface: 'db1024', title: '자료집 1024x640: 목록 6행 이상, 이름 칸·입력 80px 이상, 스크롤 주인 2개 이하, 가장자리 틈 없음', run: smallWindow },
  { id: 'C-76-900', surface: 'db900', title: '자료집 900x600: 목록 6행 이상, 이름 칸·입력 80px 이상, 스크롤 주인 2개 이하, 가장자리 틈 없음', run: smallWindow },
  { id: 'C-76-1440', surface: 'db1440b', title: '자료집 1440x900: 목록 8행 이상, 이름 칸·입력 80px 이상, 스크롤 주인 2개 이하', run: smallWindow },
  { id: 'C-76-world-en', surface: 'world1366en', title: '세계 개요 en 1366x768: 초안 막대가 바닥 막대에 잘리지 않는다', run: worldComposer },
  { id: 'C-81', surface: 'footer1440', title: '자료집 바닥 막대: 주 버튼 1개, 비활성 되돌리기는 흐림, 도움말은 왼쪽', run: footerWeight },
  { id: 'C-83', surface: 'escFocus', title: '자료집 Escape 뒤 포커스가 연 버튼으로, 창 안 Ctrl+K 가 명령 팔레트를 연다', run: escapeAndPalette },
  { id: 'C-109', surface: 'deleteRef', title: '참조 중인 주인공의 삭제는 막히고 이유가 보이며 말풍선이 버튼을 덮지 않는다', run: deleteReferenced },
  { id: 'C-115', surface: 'keepEdit', title: '「계속 편집」 뒤 포커스가 편집하던 칸으로 돌아간다', run: keepEditing },
  { id: 'C-82', surface: 'dirty', title: 'Escape 와 X 가 같은 닫기 결과, 띠가 뜨면 포커스가 띠 첫 버튼', run: closeFlow },
  { id: 'C-79', surface: 'rail', title: '레일 그룹을 바꾸면 크럼 첫 조각과 하위 목록 현재 위치가 따라간다; 맵 범주 이름이 편집기와 다르다', run: railGroups },
  { id: 'C-87', surface: 'world1440', title: '세계 개요: 라디오 이름·히트 영역·같은 모양, 20000자 한 번, 어시스턴트 0', run: worldOverview },
  { id: 'C-88', surface: 'stripes', title: '자료집 선택 행·카드에 왼쪽/inset 줄무늬가 없다', run: stripes },
  { id: 'C-78', surface: 'tabSearch', title: '탭 검색 아이콘이 자리표시자를 덮지 않는다 (ko)', run: tabSearchIcon },
  { id: 'C-78-en', surface: 'tabSearchEn', title: '탭 검색 아이콘이 자리표시자를 덮지 않는다 (en)', run: tabSearchIcon },
  { id: 'C-86', surface: 'sublistEn', title: 'en 하위 목록 잘림은 말줄임+title, 필드 라벨 대문자 변환 없음', run: sublistTruncation },
  { id: 'C-77', surface: 'formNames', title: '자료집 폼 컨트롤 접근 이름, 시작 파티 히트 24px, 범주 버튼 이름이 보이는 글자로 시작', run: formNames },
  { id: 'C-117', surface: 'listArrow', title: '목록 검색칸에서 ↓ 가 결과 행으로 포커스를 옮긴다', run: listArrow },
  { id: 'C-119', surface: 'deleteRef', title: '삭제 버튼 접근 이름이 선택한 레코드 이름을 말한다', run: deleteName },
  { id: 'C-80', surface: 'fold', title: '숨긴 탭은 가운뎃점 줄글이 아니라 버튼, 하위 목록 첫 제목이 레일 이름을 반복하지 않는다', run: hiddenTabs },
  { ...w0['IS-076'], surface: 'w0-IS-076' },
  { ...w0['IS-075'], surface: 'w0-IS-075' },
  { ...w0['IS-091'], surface: 'w0-IS-091' },
];
