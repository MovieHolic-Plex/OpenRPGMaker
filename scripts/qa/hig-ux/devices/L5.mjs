// Lane L5 devices: AI 표면 — 조수 패널·캔버스 명령줄·AI 스튜디오·AI 설정·연결 상태 (plan todos 10, 11)
// plus the wave-0 row classified as an L5 failure (C-74, reused unchanged from wave0.mjs).
// Provider states are reached in the static dist by Playwright interception of the same-origin companion:
// GET /auth/status answers "connected", and /v1/** answers 429 with the quota body the audit saw.
// Controls are resolved by data-testid (labels are translated in en and the capture box has no catalog).
import { devices as wave0Devices } from './wave0.mjs';

const VIS = `
  const vis = (el) => { if (!el || el.nodeType !== 1) return false; const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return false;
    const s = getComputedStyle(el); return s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.02 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth; };
  const textOf = (el) => (el.innerText || '').replace(/\\s+/g, ' ').trim();
  const rectOf = (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), b: Math.round(r.bottom), r: Math.round(r.right) }; };
  const inter = (a, b) => { if (!a || !b) return 0; const w = Math.min(a.right, b.right) - Math.max(a.left, b.left), h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top); return w > 0.5 && h > 0.5 ? Math.round(w * h) : 0; };
  const q = (sel) => [...document.querySelectorAll(sel)].filter(vis);
  const tid = (id) => q('[data-testid="' + id + '"]')[0] || null;
  const hangul = (s) => (String(s || '').match(/[\\uac00-\\ud7a3]/g) || []).length;
  /** Visible part of el: its rect clipped by every ancestor that clips overflow. */
  const clipped = (el) => { let r = el.getBoundingClientRect(); let box = { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { const s = getComputedStyle(p); if (/(auto|scroll|hidden|clip)/.test(s.overflowY + s.overflowX)) { const pr = p.getBoundingClientRect();
      box = { left: Math.max(box.left, pr.left), top: Math.max(box.top, pr.top), right: Math.min(box.right, pr.right), bottom: Math.min(box.bottom, pr.bottom) }; } }
    return box.right - box.left > 0.5 && box.bottom - box.top > 0.5 ? box : null; };
`;
const pe = (page, body, arg = null) => page.evaluate(new Function('arg', `${VIS}\n${body}`), arg);
const READY = '[data-testid="toolbar-database"]';
const QUOTA_BODY = JSON.stringify({
  error: 'Cloud Code Assist API error (429): {"error":{"code":429,"message":"Individual quota reached. Please upgrade your subscription. Resets in 67h25m0s","status":"RESOURCE_EXHAUSTED","details":[{"@type":"type.googleapis.com/google.rpc.ErrorInfo"}]}}',
});

async function wait(page, ms) {
  await page.waitForTimeout(ms);
}
async function clickTid(page, id, settle = 700) {
  await page.locator(`[data-testid="${id}"]`).first().click({ timeout: 15_000 });
  await wait(page, settle);
}
async function isVisible(page, sel) {
  return page.locator(sel).first().isVisible().catch(() => false);
}
/** Expand the collapsed assistant (rail button) and wait for the composer. */
async function expandPanel(page) {
  if (!(await isVisible(page, '[data-testid="ai-input"]'))) {
    // DOM click: a transient toast over the rail must not turn this precondition into a 30 s actionability wait
    await page.evaluate(() => document.querySelector('[data-testid="ai-collapsed-restore"]')?.click());
    await wait(page, 1200);
  }
  await page.locator('[data-testid="ai-input"]').first().waitFor({ state: 'visible', timeout: 15_000 });
}
/** Companion says "connected"; optionally every /v1 call answers 429 with the quota body. */
async function mockProvider(page, { quota = false } = {}) {
  await page.route('**/auth/status*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ connected: true, authKind: 'oauth' }) }));
  if (quota) await page.route('**/v1/**', (r) => r.fulfill({ status: 429, contentType: 'application/json', body: QUOTA_BODY }));
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('oprn:ai-config-changed')));
  await wait(page, 2500);
}
/** Type into the assistant composer, send, and wait (bounded) for the failure bubble. */
async function sendAndFail(page, text) {
  await page.locator('[data-testid="ai-input"]').first().click();
  await page.keyboard.type(text);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => [...document.querySelectorAll('.ai-chat-panel *')].some((e) => !e.children.length && /지시를 해석하지 못했습니다/.test(e.textContent || '')), null, { timeout: 25_000 }).catch(() => {});
  await wait(page, 1200);
}
/** Right-drag a region on the canvas (the selection composer opens where the drag ends). */
async function dragSelect(page, from, to) {
  await page.mouse.move(from[0], from[1]);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(to[0], to[1], { steps: 8 });
  await page.mouse.up({ button: 'right' });
  await wait(page, 900);
}
/** Canvas points inside the visible map area left of the assistant panel. */
const canvasDrag = (page) =>
  pe(page, `const c = q('.editor-canvas-scroll-shell')[0]; const cr = c.getBoundingClientRect(); const p = q('[data-testid="ai-panel"]')[0];
    const right = p ? Math.min(cr.right, p.getBoundingClientRect().left) : cr.right; const left = cr.left;
    // the 20x15 map is centred in the canvas at 2x, so the centre of the visible area is on the map
    const cx = Math.round((left + right) / 2), cy = Math.round(cr.top + cr.height / 2);
    const half = Math.round(Math.min(60, (right - left) * 0.2));
    return { from: [cx - half, cy - 40], to: [cx + half, cy + 40], visibleRight: Math.round(right), canvasLeft: Math.round(left) };`);

// ---------------------------------------------------------------- C-56 selection composer placement
async function commandBarPlacement(ctx) {
  const { page } = ctx;
  const sizes = [[1024, 640], [1440, 900]];
  const out = {};
  for (const [w, h] of sizes) {
    await page.setViewportSize({ width: w, height: h });
    await wait(page, 1200);
    await expandPanel(page);
    await page.keyboard.press('Escape');
    const d = await canvasDrag(page);
    await dragSelect(page, d.from, d.to);
    const m = await pe(page, `
      const bar = tid('selection-action-chips'); if (!bar) return { bar: 0 };
      const br = bar.getBoundingClientRect(); const panel = tid('ai-panel'); const pr = panel ? panel.getBoundingClientRect() : null;
      const lock = tid('ai-lock-action'); const card = q('.ai-lock-card')[0];
      const canvas = q('.editor-canvas-scroll-shell')[0].getBoundingClientRect();
      const end = arg;
      const gapBelow = Math.round(br.top - end[1]); const gapAbove = Math.round(end[1] - br.bottom);
      return { bar: 1, barX: Math.round(br.left), barR: Math.round(br.right), barY: Math.round(br.top),
        panelOverlapPx2: inter(br, pr), lockButtonOverlapPx2: inter(br, lock && lock.getBoundingClientRect()), lockCardOverlapPx2: inter(br, card && card.getBoundingClientRect()),
        outsideCanvasPx: Math.max(0, Math.round(canvas.left - br.left)) + Math.max(0, Math.round(br.right - (pr && pr.left < canvas.right && pr.left > canvas.left ? pr.left : canvas.right))),
        anchorGapPx: Math.min(Math.abs(gapBelow), Math.abs(gapAbove)) };`, d.to);
    for (const [k, v] of Object.entries(m)) out[`${k}_${w}`] = v;
    await page.keyboard.press('Escape');
    await wait(page, 500);
  }
  const bad = sizes.filter(([w]) => !out[`bar_${w}`] || out[`panelOverlapPx2_${w}`] || out[`lockButtonOverlapPx2_${w}`] || out[`outsideCanvasPx_${w}`] || out[`anchorGapPx_${w}`] > 40).length;
  return { pass: bad === 0, measured: { failingSizes: bad, ...out } };
}

// ---------------------------------------------------------------- C-57 narrow window panel
async function narrowPanel(ctx) {
  const { page } = ctx;
  await mockProvider(page);
  const out = {};
  for (const [w, h] of [[900, 600], [683, 427]]) {
    await page.setViewportSize({ width: w, height: h });
    await wait(page, 1200);
    await expandPanel(page);
    await wait(page, 600);
    const m = await pe(page, `
      const panel = tid('ai-panel'); const pr = panel.getBoundingClientRect();
      const tb = tid('editor-zoom-controls'); const tr = tb ? tb.getBoundingClientRect() : null;
      // tools that the panel paints over: visible toolbar buttons whose centre hit-tests to something inside the panel
      const tools = tb ? [...tb.querySelectorAll('button')].filter((b) => b.getClientRects().length) : [];
      let covered = 0; for (const b of tools) { const r = b.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height / 2; if (x < 0 || x >= innerWidth || y < 0 || y >= innerHeight) continue; const hit = document.elementFromPoint(x, y); if (hit && panel.contains(hit)) covered++; }
      // explicit overlay mode: a scrim between canvas and panel, and a visible close/fold control in the panel
      const canvas = q('.editor-canvas-scroll-shell')[0]; const cr = canvas.getBoundingClientRect();
      const cx = Math.max(cr.left + 4, Math.min(pr.left - 8, cr.left + 40)), cy = cr.top + cr.height / 2; const hitC = document.elementFromPoint(cx, cy);
      const scrim = hitC && !canvas.contains(hitC) && (hitC.closest('[data-testid="ai-panel-scrim"]') || hitC.matches('[data-testid="ai-panel-scrim"]')) ? 1 : 0;
      const close = tid('ai-collapse') ? 1 : 0;
      // starter examples vs the composer input (visible parts only)
      const input = tid('ai-input'); const ir = input.getBoundingClientRect();
      const starters = [...document.querySelectorAll('[data-testid="ai-workspace-starter"] button')].map(clipped).filter(Boolean);
      const starterOverlap = starters.reduce((s, r) => s + inter(r, ir), 0);
      return { panelX: Math.round(pr.left), toolbarOverlapPx2: inter(tr, pr), toolsCovered: covered, scrim, closeButton: close, startersVisible: starters.length, starterInputOverlapPx2: starterOverlap };`);
    for (const [k, v] of Object.entries(m)) out[`${k}_${w}`] = v;
  }
  const ok = (w) => (out[`toolsCovered_${w}`] === 0 || (out[`scrim_${w}`] === 1 && out[`closeButton_${w}`] === 1)) && out[`starterInputOverlapPx2_${w}`] === 0;
  return { pass: ok(900) && ok(683), measured: out };
}

// ---------------------------------------------------------------- C-58 command bar actions
async function commandBarActions(ctx) {
  const { page } = ctx;
  await page.evaluate(() => { localStorage.removeItem('oprn:hint-right-drag-region-v1'); localStorage.removeItem('oprn:hint-selection-chips-v1'); });
  const d = await canvasDrag(page);
  await dragSelect(page, d.from, d.to);
  const toast = await pe(page, `return q('[class*=toast]').map(textOf).join(' | ');`);
  const m = await pe(page, `
    const bar = tid('selection-action-chips'); if (!bar) return { bar: 0 };
    const btns = [...bar.querySelectorAll('button')].filter((b) => b.getClientRects().length);
    const unnamed = btns.filter((b) => !(b.getAttribute('title') || b.getAttribute('aria-label') || textOf(b))).length;
    const copy = bar.querySelector('[data-testid="selection-chip-copy"]'), clear = bar.querySelector('[data-testid="selection-chip-clear"]');
    const cr = copy.getBoundingClientRect(), dr = clear.getBoundingClientRect();
    const gap = Math.round(Math.max(dr.left - cr.right, cr.left - dr.right));
    // a separator between copy and delete in document order
    const all = [...bar.querySelectorAll('button, .selection-action-sep')]; const i = all.indexOf(copy), j = all.indexOf(clear);
    const sepBetween = all.slice(Math.min(i, j) + 1, Math.max(i, j)).some((e) => e.classList.contains('selection-action-sep')) ? 1 : 0;
    const send = bar.querySelector('[data-testid="selection-chip-ai"]');
    const prompt = bar.querySelector('[data-testid="selection-chip-prompt"]');
    const emptyDisabled = prompt.value.trim() === '' && (send.disabled || send.getAttribute('aria-disabled') === 'true') ? 1 : 0;
    return { bar: 1, buttons: btns.length, unnamedButtons: unnamed, copyDeleteGapPx: gap, separatorBetween: sepBetween, emptySendDisabled: emptyDisabled, sendTitle: send.getAttribute('title') || '' };`);
  const emoji = (toast.match(/[\u2600-\u27bf\u{1F300}-\u{1FAFF}]/gu) || []).length;
  Object.assign(m, { toastDrag: /드래그/.test(toast) ? 1 : 0, toastEmoji: emoji, toastText: toast.slice(0, 120) });
  return { pass: m.bar === 1 && m.unnamedButtons === 0 && (m.copyDeleteGapPx >= 12 || m.separatorBetween === 1) && m.emptySendDisabled === 1 && m.toastDrag === 0 && m.toastEmoji === 0, measured: m };
}

// ---------------------------------------------------------------- C-59 selection chip in the composer
async function selectionChip(ctx) {
  const { page } = ctx;
  await expandPanel(page);
  const d = await canvasDrag(page);
  await dragSelect(page, d.from, d.to);
  const m = await pe(page, `
    const chip = tid('ai-selection-chip'); if (!chip) return { chip: 0 };
    const clear = chip.querySelector('[data-testid="ai-selection-chip-clear"]'); const r = clear.getBoundingClientRect();
    return { chip: 1, clearW: Math.round(r.width), clearH: Math.round(r.height), rawCoords: /\\(\\d+,\\s*\\d+\\)/.test(textOf(chip)) ? 1 : 0, chipText: textOf(chip) };`);
  await clickTid(page, 'topbar-ai-studio', 2500);
  m.chipInStudio = await pe(page, `return q('[data-testid="ai-selection-chip"]').length;`);
  return { pass: m.chip === 1 && m.clearW >= 24 && m.clearH >= 24 && m.rawCoords === 0 && m.chipInStudio === 0, measured: m };
}

// ---------------------------------------------------------------- C-60 not-connected state is one state everywhere
async function notConnected(ctx) {
  const { page } = ctx;
  await expandPanel(page);
  const d = await canvasDrag(page);
  await dragSelect(page, d.from, d.to);
  const m = await pe(page, `
    const described = (el) => { if (!el) return 0; const disabled = el.disabled || el.getAttribute('aria-disabled') === 'true' || el.readOnly; const ids = (el.getAttribute('aria-describedby') || '').split(/\\s+/).filter(Boolean);
      const text = ids.map((id) => document.getElementById(id)?.textContent || '').join(' '); return disabled && /연결/.test(text) ? 1 : 0; };
    const panel = tid('ai-panel');
    const blurredEls = [panel, ...panel.querySelectorAll('*')].filter((e) => { if (!vis(e)) return false; const s = getComputedStyle(e); return /blur\\(/.test(s.filter + ' ' + s.backdropFilter + ' ' + (s.webkitBackdropFilter || '')); });
    const blurred = blurredEls.length; const blurredWhich = blurredEls.map((e) => (e.getAttribute('class') || e.tagName).split(' ')[0]).join(',');
    const dot = q('.ai-deck-rail-dot, .ai-deck-rail [class*=dot]')[0];
    const dotLabel = dot ? ((dot.getAttribute('title') || dot.getAttribute('aria-label') || '').trim() || (dot.parentElement?.getAttribute('title') || '').trim()) : '';
    const fakeStarter = q('[data-testid="ai-workspace-starter"]').length;
    return { panelInputDescribed: described(tid('ai-input')), commandBarDescribed: described(tid('selection-chip-prompt')), blurredElements: blurred, blurredWhich, dotLabelLen: dotLabel.length, fakeStarterVisible: fakeStarter };`);
  await page.keyboard.press('Escape');
  await clickTid(page, 'topbar-ai-studio', 2500);
  m.studioInputDescribed = await pe(page, `const el = q('.ai-studio [data-testid="ai-input"], [data-testid="ai-input"]')[0]; if (!el) return 0; const disabled = el.disabled || el.getAttribute('aria-disabled') === 'true' || el.readOnly;
    const text = (el.getAttribute('aria-describedby') || '').split(/\\s+/).filter(Boolean).map((id) => document.getElementById(id)?.textContent || '').join(' '); return disabled && /연결/.test(text) ? 1 : 0;`);
  m.studioCardsDisabled = await pe(page, `const cards = q('.ai-studio-director-chip'); return cards.length && cards.every((c) => c.disabled || c.getAttribute('aria-disabled') === 'true') ? 1 : 0;`);
  m.studioConnectButton = await pe(page, `return q('[data-testid="ai-studio-connect"], [data-testid="ai-lock-action"]').length ? 1 : 0;`);
  return {
    pass: m.panelInputDescribed === 1 && m.commandBarDescribed === 1 && m.blurredElements === 0 && m.dotLabelLen > 0 && m.fakeStarterVisible === 0
      && m.studioInputDescribed === 1 && m.studioCardsDisabled === 1 && m.studioConnectButton === 1,
    measured: m,
  };
}

// ---------------------------------------------------------------- C-61 duplicate entry points
async function entryPoints(ctx) {
  const { page } = ctx;
  await expandPanel(page);
  const m = await pe(page, `
    const fab = q('[data-testid="ai-suggestion-peek"]')[0];
    const pathOf = (el) => el ? [...el.querySelectorAll('svg path')].map((p) => p.getAttribute('d')).join('|') : '';
    const studio = tid('topbar-ai-studio'), ask = tid('canvas-ai-ask'), peekEntry = document.querySelector('[data-testid="ai-suggestion-peek"]');
    const shapes = [pathOf(studio) || textOf(studio), pathOf(ask), pathOf(peekEntry)];
    const badge = document.querySelector('[data-testid="ai-suggestion-peek-badge"]');
    const badgeOwner = badge?.closest('button');
    const badgeLabel = badgeOwner ? (badgeOwner.getAttribute('aria-label') || '') : '';
    return { fabVisibleWithPanelOpen: fab ? 1 : 0, distinctEntryIcons: new Set(shapes).size, entryIcons: shapes.length, badgeNamed: /살펴볼 것 \\d+개/.test(badgeLabel) ? 1 : 0 };`);
  // continuing a review card lands in the visible chat tab with the draft focused
  await clickTid(page, 'ai-workspace-team-tab', 600).catch(() => {});
  await page.evaluate(() => { const b = document.querySelector('[data-testid="ai-suggestion-peek"]'); b?.click(); });
  await wait(page, 1200);
  const acted = await pe(page, `const b = [...document.querySelectorAll('[data-testid="ai-project-suggestion"] button')].find((x) => /AI와 이어가기/.test(x.textContent || '')); if (!b) return 0; b.click(); return 1;`);
  await wait(page, 900);
  Object.assign(m, await pe(page, `const input = tid('ai-input'); return { continued: arg, chatTabShown: input && document.activeElement === input && input.value.trim().length > 0 ? 1 : 0 };`, acted));
  return { pass: m.fabVisibleWithPanelOpen === 0 && m.distinctEntryIcons === m.entryIcons && m.badgeNamed === 1 && m.continued === 1 && m.chatTabShown === 1, measured: m };
}

// ---------------------------------------------------------------- C-62 one name for the assistant
async function oneName(ctx) {
  const { page } = ctx;
  const collapsed = await pe(page, `const b = tid('ai-collapsed-restore'); return b ? [b.getAttribute('aria-label') || '', textOf(b)] : [];`);
  await expandPanel(page);
  const m = await pe(page, `
    const head = q('.ai-deck-rail-name')[0]; const tabs = q('[data-testid="ai-workspace-tabs"] [role=tab]').map(textOf);
    const collapse = tid('ai-collapse'); const wide = tid('ai-wide-open');
    const names = [textOf(head || document.body).slice(0, 20), collapse?.getAttribute('aria-label') || '', wide?.getAttribute('aria-label') || '', ...arg];
    const TERMS = ['조수', 'AI 패널', 'AI 팀원', 'AI 조수', 'AI'];
    const found = new Set(); for (const n of names) { const t = TERMS.find((term) => n.includes(term)); if (t) found.add(t); }
    return { featureNames: [...found].join(','), featureNameCount: found.size, tabs: tabs.join(','), tabsUsingFeatureName: tabs.filter((t) => /^조수/.test(t)).length };`, collapsed);
  return { pass: m.featureNameCount === 1 && m.featureNames === '조수' && m.tabsUsingFeatureName === 0, measured: m };
}

// ---------------------------------------------------------------- C-63 studio layout (1024 ko, 1366 en)
async function studioLayout(ctx) {
  const { page } = ctx;
  await clickTid(page, 'topbar-ai-studio', 2500);
  const m = await pe(page, `
    const subtabs = q('[data-testid^="ai-studio-director-tab-"]'); const tops = new Set(subtabs.map((t) => Math.round(t.getBoundingClientRect().top)));
    const wrapped = subtabs.filter((t) => t.getBoundingClientRect().height > 36).length;
    const lane = q('.ai-studio-deck-head, .ai-studio-lanes-head, [class*=ai-studio-deck] header')[0] || tid('ai-studio-tab-lanes')?.parentElement?.parentElement;
    const laneTexts = lane ? [...lane.querySelectorAll('button, span, strong')].filter((e) => vis(e) && textOf(e) && !e.querySelector('button')) : [];
    let laneOverlaps = 0; for (let i = 0; i < laneTexts.length; i++) for (let j = i + 1; j < laneTexts.length; j++) { if (laneTexts[i].contains(laneTexts[j]) || laneTexts[j].contains(laneTexts[i])) continue; if (inter(laneTexts[i].getBoundingClientRect(), laneTexts[j].getBoundingClientRect())) laneOverlaps++; }
    const tabs = q('[data-testid^="ai-studio-tab-"]'); const iconOnlyTabs = tabs.filter((t) => !textOf(t)).length;
    const clippedNoTitle = q('.ai-studio *').filter((e) => !e.children.length && textOf(e) && (e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1) && /ellipsis|clip/.test(getComputedStyle(e).textOverflow + getComputedStyle(e).webkitLineClamp) && !e.closest('[title]')).length;
    const zoom = tid('editor-zoom-controls'); const zoomInStudio = zoom && zoom.closest('.ai-studio, [class*=ai-studio]') ? 1 : 0;
    return { subtabRows: tops.size, wrappedSubtabs: wrapped, laneTextOverlaps: laneOverlaps, iconOnlyTabs, clippedWithoutTitle: clippedNoTitle, zoomShownOnBoard: zoomInStudio };`);
  return { pass: m.subtabRows === 1 && m.wrappedSubtabs === 0 && m.laneTextOverlaps === 0 && m.iconOnlyTabs === 0 && m.clippedWithoutTitle === 0 && m.zoomShownOnBoard === 0, measured: m };
}

// ---------------------------------------------------------------- C-64 studio names and hit areas
async function studioNames(ctx) {
  const { page } = ctx;
  await clickTid(page, 'topbar-ai-studio', 2500);
  const m = await pe(page, `
    // accessible name as the audit probe read it: aria-label, then title, then content
    const name = (e) => (e.getAttribute('aria-label') || e.getAttribute('title') || textOf(e) || '').trim();
    const pills = q('.ai-studio-director-genre-pill');
    const names = pills.map(name); const startsVisible = pills.filter((p) => name(p).startsWith(textOf(p))).length;
    const exit = tid('ai-studio-exit'), toggle = tid('ai-studio-canvas-toggle');
    const mism = [exit, toggle].filter((e) => e && !name(e).startsWith(textOf(e))).length;
    const search = tid('ai-studio-scene-search');
    return { pills: pills.length, distinctPillNames: new Set(names).size, pillsNamedByLabel: startsVisible, headerNameMismatch: mism,
      minPillH: pills.length ? Math.min(...pills.map((p) => Math.round(p.getBoundingClientRect().height))) : 0, searchH: search ? Math.round(search.getBoundingClientRect().height) : 0 };`);
  return { pass: m.pills >= 3 && m.distinctPillNames === m.pills && m.pillsNamedByLabel === m.pills && m.headerNameMismatch === 0 && m.minPillH >= 28 && m.searchH >= 28, measured: m };
}

// ---------------------------------------------------------------- C-65 internal ids and English caps in the studio
async function studioIds(ctx) {
  const { page } = ctx;
  await clickTid(page, 'topbar-ai-studio', 2500);
  const m = await pe(page, `
    const root = q('.ai-studio-director, .ai-studio-shell, [class*=ai-studio]')[0] || document.body;
    const texts = [textOf(document.body), ...q('input, textarea').map((e) => e.value || '')].join(' \\n ');
    return { internalIds: (texts.match(/map_[a-z_0-9]+/g) || []).length, beatCaps: (texts.match(/\\bBEAT\\b/g) || []).length, bgmCaps: q('.ai-studio-director-control span').filter((e) => textOf(e) === 'BGM').length };`);
  return { pass: m.internalIds === 0 && m.beatCaps === 0 && m.bgmCaps === 0, measured: m };
}

// ---------------------------------------------------------------- C-66 studio hierarchy
async function studioHierarchy(ctx) {
  const { page } = ctx;
  await clickTid(page, 'topbar-ai-studio', 2500);
  const m = await pe(page, `
    const scope = q('[data-testid="ai-studio-flow-layout"]')[0]?.closest('.ai-studio-director, [class*=ai-studio-director-content]') || q('[class*=ai-studio-director]')[0];
    const host = scope ? scope.closest('[class*=ai-studio]') : document.body;
    const all = [...host.querySelectorAll('*')].filter(vis);
    const tiny = all.filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && parseFloat(getComputedStyle(e).fontSize) < 12).length;
    const parseC = (c) => { const x = String(c).match(/rgba?\\(([^)]+)\\)/); if (!x) return null; const p = x[1].split(/[ ,/]+/).map(parseFloat); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
    const sat = (c) => { const mx = Math.max(c.r, c.g, c.b), mn = Math.min(c.r, c.g, c.b); return mx ? (mx - mn) / mx : 0; };
    const filled = all.filter((e) => e.matches('button') && (() => { const c = parseC(getComputedStyle(e).backgroundColor); return c && c.a > 0.9 && sat(c) > 0.45 && (c.r + c.g + c.b) / 3 < 170; })()).length;
    const stripes = all.filter((e) => { const s = getComputedStyle(e); return ['Left','Right','Top','Bottom'].filter((k) => parseFloat(s['border' + k + 'Width']) >= 2 && s['border' + k + 'Style'] !== 'none').length > 0 && ['Left','Right','Top','Bottom'].filter((k) => parseFloat(s['border' + k + 'Width']) >= 2).length < 4 && !/spin/.test(e.className); }).length;
    const sizeRepeats = all.filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && /20×15/.test(n.textContent))).length;
    const warn = q('.ai-studio-director-warn, [class*=ai-studio] .is-warn, .ai-studio-scene-warn');
    const warnUnlabeled = warn.filter((e) => !/⚠|확인 필요|경고/.test(textOf(e)) && !e.querySelector('svg')).length;
    const zeroOfZero = (textOf(host).match(/0개 중 0/g) || []).length;
    const empties = q('.ai-studio-director-empty'); const emptyNoAction = empties.filter((e) => !e.querySelector('button') && !(e.nextElementSibling && e.nextElementSibling.matches('button'))).length;
    return { tinyTexts: tiny, accentFilledButtons: filled, edgeStripes: stripes, sizeRepeats, warnUnlabeled, zeroOfZero, emptyWithoutAction: emptyNoAction, emDash: (textOf(host).match(/ — /g) || []).length };`);
  return { pass: m.tinyTexts === 0 && m.accentFilledButtons <= 1 && m.edgeStripes === 0 && m.sizeRepeats <= 1 && m.warnUnlabeled === 0 && m.zeroOfZero === 0 && m.emptyWithoutAction === 0, measured: m };
}

// ---------------------------------------------------------------- C-67 one connection/usable state
async function connectionState(ctx) {
  const { page } = ctx;
  await mockProvider(page, { quota: true });
  await expandPanel(page);
  await sendAndFail(page, '여기에 작은 연못을 만들어 줘');
  const chip = await pe(page, `const c = tid('ai-connection-chip'); return c ? textOf(c) : '';`);
  await page.locator('[data-testid="ai-connection-chip"]').first().click();
  await wait(page, 1500);
  const s = await pe(page, `
    const dlg = q('[data-testid="ai-settings-modal"], .ai-settings-window')[0]; if (!dlg) return { settingsOpen: 0 };
    const head = tid('ai-settings-connection-summary'); const body = dlg.querySelector('.ai-settings-content') || dlg;
    const failLeaves = [...body.querySelectorAll('*')].filter((e) => vis(e) && !e.children.length && /한도|사용할 수 없|실패/.test(textOf(e))).length;
    return { settingsOpen: 1, headText: head ? textOf(head) : '', bodyFailureSentences: failLeaves };`);
  const before = await pe(page, `return textOf(tid('ai-settings-connection-summary') || document.body).slice(0, 80);`);
  if (s.settingsOpen) await clickTid(page, 'ai-settings-connection-check', 2500);
  const after = await pe(page, `const h = tid('ai-settings-connection-summary'); return h ? { text: textOf(h), live: h.getAttribute('aria-live') || h.closest('[aria-live]')?.getAttribute('aria-live') || '' } : { text: '', live: '' };`);
  const m = { chipText: chip, chipLimited: /한도/.test(chip) ? 1 : 0, ...s, headLimited: /한도/.test(s.headText || '') ? 1 : 0, checkResultShown: after.live && after.text !== before && /확인/.test(after.text) ? 1 : 0, afterCheck: after.text };
  return { pass: m.chipLimited === 1 && m.settingsOpen === 1 && m.headLimited === 1 && m.bodyFailureSentences <= 1 && m.checkResultShown === 1, measured: m };
}

// ---------------------------------------------------------------- C-68 chip accessible name in English
async function chipEnglish({ page }) {
  await wait(page, 1500);
  const m = await pe(page, `const c = tid('ai-connection-chip'); if (!c) return { chip: 0 };
    const a = c.getAttribute('aria-label') || '', t = c.getAttribute('title') || '';
    return { chip: 1, ariaHangul: hangul(a), titleHangul: hangul(t), textHangul: hangul(textOf(c)), aria: a.slice(0, 90) };`);
  return { pass: m.chip === 1 && m.ariaHangul === 0 && m.titleHangul === 0, measured: m };
}

// ---------------------------------------------------------------- C-69 failed runs are counted
async function failedRunsCounted(ctx) {
  const { page } = ctx;
  await mockProvider(page, { quota: true });
  await expandPanel(page);
  await sendAndFail(page, '여기에 작은 연못을 만들어 줘');
  await sendAndFail(page, '이 영역을 주변과 어울리게 다듬어 줘');
  await clickTid(page, 'topbar-ai-settings', 1500);
  await clickTid(page, 'ai-settings-tab-usage', 2500);
  const m = await pe(page, `
    const stats = q('.ai-tool-usage-stats > *').map((s) => ({ label: textOf(s).replace(/^\\d+\\s*/, ''), value: Number((textOf(s).match(/^\\d+/) || [-1])[0]) }));
    const get = (re) => stats.find((s) => re.test(s.label))?.value ?? -1;
    return { requests: get(/^요청/), failedRequests: get(/실패한 요청|요청 실패/), toolCalls: get(/도구 호출|^호출/), stats: stats.map((s) => s.label + '=' + s.value).join(', ') };`);
  await page.keyboard.press('Escape');
  await wait(page, 800);
  await clickTid(page, 'topbar-ai-studio', 2500);
  m.studioRequestText = await pe(page, `const h = tid('ai-studio-status'); return h ? textOf(h).slice(0, 60) : '';`);
  m.studioCount = Number((m.studioRequestText.match(/(\d+)/) || [0, -1])[1]);
  return { pass: m.requests === 2 && m.failedRequests === 2 && m.studioCount === 2, measured: m };
}

// ---------------------------------------------------------------- C-70 settings footer
async function settingsFooter(ctx) {
  const { page } = ctx;
  await clickTid(page, 'topbar-ai-settings', 1500);
  const m = await pe(page, `
    const dlg = q('.ai-settings-window')[0]; const btn = tid('ai-settings-continue');
    const parseC = (c) => { const x = String(c).match(/rgba?\\(([^)]+)\\)/); if (!x) return null; const p = x[1].split(/[ ,/]+/).map(parseFloat); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
    const sat = (c) => { const mx = Math.max(c.r, c.g, c.b), mn = Math.min(c.r, c.g, c.b); return mx ? (mx - mn) / mx : 0; };
    const filled = [...dlg.querySelectorAll('button')].filter((b) => vis(b) && (() => { const c = parseC(getComputedStyle(b).backgroundColor); return c && c.a > 0.9 && sat(c) > 0.45 && (c.r + c.g + c.b) / 3 < 170; })()).length;
    const disabledNoReason = [...dlg.querySelectorAll('button')].filter((b) => vis(b) && (b.disabled || b.getAttribute('aria-disabled') === 'true') && !(b.getAttribute('aria-describedby') || '').trim()).length;
    return { footerText: btn ? textOf(btn) : '', footerIsDone: btn && /^(완료|닫기)$/.test(textOf(btn)) ? 1 : 0, accentFilledButtons: filled, disabledWithoutReason: disabledNoReason };`);
  return { pass: m.footerIsDone === 1 && m.accentFilledButtons <= 1 && m.disabledWithoutReason === 0, measured: m };
}

// ---------------------------------------------------------------- C-71 raw ids, duplicate copy, nested cards
async function settingsCopy(ctx) {
  const { page } = ctx;
  await expandPanel(page);
  await clickTid(page, 'ai-command-menu-toggle', 800);
  // open the 고급·진단 group too, so every item is rendered and measured (closed <details> content has no text)
  await page.evaluate(() => document.querySelectorAll('[data-testid="ai-command-menu"] details').forEach((d) => { d.open = true; }));
  await wait(page, 400);
  const menu = await pe(page, `const m = q('[role=menu], .ai-command-menu, [data-testid="ai-command-menu"]')[0]; if (!m) return { menu: 0 };
    const t = textOf(m); const rows = [...m.querySelectorAll('*')].filter((e) => vis(e) && !e.children.length).map(textOf);
    return { menu: 1, menuModelIds: (t.match(/\\b[a-z]+-\\d(\\.\\d)?-[a-z]+/g) || []).length, menuDashOnly: rows.filter((r) => r === '—' || /\\s—$/.test(r)).length, menuUnnamedItems: [...m.querySelectorAll('button,[role=menuitem]')].filter((b) => vis(b) && !(b.getAttribute('aria-label') || textOf(b))).length,
      unnamedWhich: [...m.querySelectorAll('button,[role=menuitem]')].filter((b) => vis(b) && !(b.getAttribute('aria-label') || textOf(b))).slice(0, 6).map((b) => (b.dataset.testid || b.getAttribute('class') || '').slice(0, 30)).join(','), menuClass: (m.getAttribute('class') || '').slice(0, 40) };`);
  await page.keyboard.press('Escape');
  await clickTid(page, 'topbar-ai-settings', 1500);
  const conn = await pe(page, `const dlg = q('.ai-settings-window')[0]; const t = textOf(dlg);
    const heads = [...dlg.querySelectorAll('h3, h4, strong, .ai-settings-section-title')].filter(vis).map(textOf).filter((x) => /사용자 지정/.test(x));
    return { customHeadings: heads.length, serverListRepeats: (t.match(/LiteLLM/g) || []).length, internalNames: (t.match(/CLIProxyAPI|Antigravity/g) || []).length };`);
  await clickTid(page, 'ai-settings-tab-models', 1200);
  const models = await pe(page, `const dlg = q('.ai-settings-window')[0]; const pane = dlg.querySelector('.ai-settings-content') || dlg;
    const leaves = [...pane.querySelectorAll('*')].filter((e) => vis(e) && !e.children.length && e.tagName !== 'OPTION').map(textOf);
    return { modelIdTexts: leaves.filter((x) => /\\b[a-z]+-\\d(\\.\\d)?-[a-z]+(-\\d)?\\b/.test(x)).length };`);
  await page.setViewportSize({ width: 1024, height: 640 });
  await clickTid(page, 'ai-settings-tab-connection', 1200);
  const fit = await pe(page, `const content = q('.ai-settings-content')[0]; const foot = q('.ai-settings-window .ai-config-actions')[0];
    if (!content || !foot) return { scrollBox: 0 }; const cr = content.getBoundingClientRect(), fr = foot.getBoundingClientRect();
    return { scrollBox: 1, contentScrolls: content.scrollHeight > content.clientHeight + 1 ? 1 : 0, contentFooterOverlapPx: Math.max(0, Math.round(cr.bottom - fr.top)) };`);
  const m = { ...menu, ...conn, ...models, ...fit };
  return { pass: m.menu === 1 && m.menuModelIds === 0 && m.menuDashOnly === 0 && m.menuUnnamedItems === 0 && m.customHeadings <= 1 && m.serverListRepeats <= 1 && m.internalNames === 0 && m.modelIdTexts === 0 && m.contentFooterOverlapPx === 0, measured: m };
}

// ---------------------------------------------------------------- C-72 settings close target
async function settingsClose({ page }) {
  await clickTid(page, 'topbar-ai-settings', 1500);
  const m = await pe(page, `const b = tid('ai-settings-close'); if (!b) return { close: 0 }; const r = b.getBoundingClientRect(); return { close: 1, closeW: Math.round(r.width), closeH: Math.round(r.height) };`);
  return { pass: m.close === 1 && m.closeW >= 32 && m.closeH >= 32, measured: m };
}

// ---------------------------------------------------------------- C-73 failure message
async function failureMessage(ctx) {
  const { page } = ctx;
  await mockProvider(page, { quota: true });
  await expandPanel(page);
  await sendAndFail(page, '여기에 작은 연못을 만들어 줘');
  const m = await pe(page, `
    const bubble = [...document.querySelectorAll('.ai-chat-panel *')].filter((e) => vis(e) && /지시를 해석하지 못했습니다/.test(textOf(e))).sort((a, b) => textOf(a).length - textOf(b).length)[0];
    if (!bubble) return { failureShown: 0 };
    // the bubble is the conversation row (appendBubble returns .ai-command-row-body)
    const box = bubble.closest('[data-testid="ai-command-row"], [class*=bubble], [class*=message], article') || bubble;
    const t = textOf(box);
    const buttons = [...box.querySelectorAll('button')].filter(vis).map(textOf);
    return { failureShown: 1, braces: (t.match(/[{}]/g) || []).length, englishWords: (t.match(/\\b(quota|error|Please|RESOURCE_EXHAUSTED)\\b/gi) || []).length, resetTimeShown: /\\d+\\s*(일|시간|분)/.test(t) ? 1 : 0,
      saysWaitBriefly: /잠시 후/.test(t) ? 1 : 0, retryButton: buttons.some((x) => /다시 시도/.test(x)) ? 1 : 0, settingsButton: buttons.some((x) => /설정 열기/.test(x)) ? 1 : 0, text: t.slice(0, 120) };`);
  return { pass: m.failureShown === 1 && m.braces === 0 && m.englishWords === 0 && m.resetTimeShown === 1 && m.saysWaitBriefly === 0 && m.retryButton === 1 && m.settingsButton === 1, measured: m };
}

// ---------------------------------------------------------------- C-75 stripe lint on the cited AI chrome rules
const STRIPE_SELECTORS = [
  '.ai-sticky-item[data-status', '.ai-action-zone', '.ai-proposal-card.ai-proposal-empty', '.ai-team-tx-review', '.ai-map-run-card',
  '.ai-feature-checklist', '.ai-inbox-card', '.harness-row.is-ui',
];
async function aiStripes({ page }) {
  const m = await page.evaluate((keys) => {
    const rules = [];
    const walk = (list) => { for (const r of list) { if (r.cssRules && !r.selectorText) walk(r.cssRules); else if (r.selectorText) rules.push(r); } };
    for (const sheet of document.styleSheets) { try { walk(sheet.cssRules); } catch { /* cross-origin */ } }
    const px = (v) => { const x = String(v || '').match(/(-?[\d.]+)px/); return x ? Math.abs(parseFloat(x[1])) : 0; };
    let edge = 0, inset = 0, outline = 0; const samples = [];
    const matched = rules.filter((r) => keys.some((k) => r.selectorText.includes(k)));
    for (const r of matched) {
      const sel = r.selectorText; const st = r.style;
      const sides = ['Left', 'Right', 'Top', 'Bottom'].map((side) => ({ side, w: px(st[`border${side}Width`]), style: st[`border${side}Style`] }));
      for (const x of sides) if (!x.w) { const mm = r.cssText.match(new RegExp(`border-${x.side.toLowerCase()}(?:-width)?:\\s*([2-4])px`)); if (mm) { x.w = Number(mm[1]); x.style = 'solid'; } }
      const set = sides.filter((x) => x.w >= 2 && x.style !== 'none');
      if (set.length > 0 && set.length < 4) { edge++; if (samples.length < 8) samples.push(`edge ${sel.slice(-50)}`); }
      else if (set.length === 4 || /border:\s*[2-4]px solid/.test(r.cssText)) { outline++; if (samples.length < 8) samples.push(`outline ${sel.slice(-50)}`); }
      const sh = (st.boxShadow || '').replace(/var\([^)]*\)\)?|rgba?\([^)]*\)|color-mix\([^)]*\)\)?/g, 'C');
      if (/inset\s+-?[2-4]px\s+0(px)?(\s+0(px)?)?\s+C?/.test(sh)) { inset++; if (samples.length < 8) samples.push(`inset ${sel.slice(-50)}`); }
    }
    return { matchedRules: matched.length, edgeRules: edge, insetRules: inset, accentOutlineRules: outline, samples: samples.join(' | ') };
  }, STRIPE_SELECTORS);
  m.stripes = m.edgeRules + m.insetRules + m.accentOutlineRules;
  return { pass: m.matchedRules >= 8 && m.stripes === 0, measured: m };
}

const w0 = Object.fromEntries(wave0Devices.filter((d) => ['C-74'].includes(d.id)).map((d) => [d.id, d]));

export const surfaces = {
  canvasBar: { width: 1024, height: 640, lang: 'ko' },
  narrow: { width: 900, height: 600, lang: 'ko' },
  barActions: { width: 1440, height: 900, lang: 'ko' },
  selChip: { width: 1440, height: 900, lang: 'ko' },
  notConnected: { width: 1440, height: 900, lang: 'ko' },
  entries: { width: 1440, height: 900, lang: 'ko' },
  names: { width: 1440, height: 900, lang: 'ko' },
  studio1024: { width: 1024, height: 640, lang: 'ko' },
  studioEn: { width: 1366, height: 768, lang: 'en', readySelector: READY },
  studioNames: { width: 1440, height: 900, lang: 'ko' },
  studioIds: { width: 1440, height: 900, lang: 'ko' },
  studioHier: { width: 1440, height: 900, lang: 'ko' },
  conn429: { width: 1440, height: 900, lang: 'ko' },
  chipEn: { width: 1366, height: 768, lang: 'en', readySelector: READY },
  usage429: { width: 1440, height: 900, lang: 'ko' },
  settingsFoot: { width: 1440, height: 900, lang: 'ko' },
  settingsCopy: { width: 1440, height: 900, lang: 'ko' },
  settingsClose: { width: 1440, height: 900, lang: 'ko' },
  fail429: { width: 1440, height: 900, lang: 'ko' },
  stripes: { width: 1440, height: 900, lang: 'ko' },
  'w0-C-74': { width: 1440, height: 900, lang: 'ko' },
};

export const devices = [
  { id: 'C-56', surface: 'canvasBar', title: '선택 영역 명령줄이 선택 옆에 붙고 조수 패널·연결 버튼을 가리지 않는다 (1024, 1440)', run: commandBarPlacement },
  { id: 'C-57', surface: 'narrow', title: '좁은 창(900, 683)에서 조수 패널이 캔버스 도구를 덮지 않거나 덮개 모드(scrim+닫기)이고 예시가 입력창과 겹치지 않는다', run: narrowPanel },
  { id: 'C-58', surface: 'barActions', title: '명령줄 행동에 이름이 있고 삭제가 복사와 떨어져 있으며 빈 입력 실행은 막히고 안내 토스트에 드래그·이모지가 없다', run: commandBarActions },
  { id: 'C-59', surface: 'selChip', title: '선택 칩 해제 버튼이 24px 이상이고 원시 좌표가 없으며 스튜디오로 따라가지 않는다', run: selectionChip },
  { id: 'C-60', surface: 'notConnected', title: 'AI 미연결이 패널·명령줄·스튜디오에서 같은 상태(비활성+이유)로 보이고 장식 블러가 없다', run: notConnected },
  { id: 'C-61', surface: 'entries', title: '패널이 열리면 떠 있는 ✦ 버튼이 숨고 진입점 아이콘이 서로 다르며 이어가기가 대화 탭에 보인다', run: entryPoints },
  { id: 'C-62', surface: 'names', title: '조수 기능 이름이 「조수」 하나이고 탭은 대화/작업으로 구분된다', run: oneName },
  { id: 'C-63', surface: 'studio1024', title: 'AI 스튜디오 1024: 하위 탭 한 줄·레인 막대 겹침 없음·아이콘만 탭 없음·보드에 확대 도구 없음', run: studioLayout },
  { id: 'C-63-en', surface: 'studioEn', title: 'AI 스튜디오 1366 en: 하위 탭 한 줄·레인 막대 겹침 없음·말줄임에 title', run: studioLayout },
  { id: 'C-64', surface: 'studioNames', title: '스튜디오 장르 알약·머리 버튼 접근 이름이 보이는 라벨로 시작하고 알약·검색 높이 28px 이상', run: studioNames },
  { id: 'C-65', surface: 'studioIds', title: '스튜디오에 내부 맵 ID·BEAT·BGM 영문 라벨이 없다', run: studioIds },
  { id: 'C-66', surface: 'studioHier', title: '스튜디오 글자 12px 이상·accent 채움 1개 이하·줄무늬 없음·크기 반복 1회·경고 글자·빈 상태 행동', run: studioHierarchy },
  { id: 'C-67', surface: 'conn429', title: '한도 초과(429) 뒤 칩·설정 머리가 같은 「한도」 상태이고 칩이 설정을 열며 연결 확인 결과가 aria-live 에 나온다', run: connectionState },
  { id: 'C-68', surface: 'chipEn', title: '영어 UI 에서 AI 연결 칩 aria-label·title 에 한글이 없다', run: chipEnglish },
  { id: 'C-69', surface: 'usage429', title: '실패한 요청 2건이 사용량 요청·실패 수와 스튜디오 내 요청 수에 들어간다', run: failedRunsCounted },
  { id: 'C-70', surface: 'settingsFoot', title: 'AI 설정 바닥 버튼이 「완료」이고 accent 채움 버튼 1개 이하, 이유 없는 비활성 없음', run: settingsFooter },
  { id: 'C-71', surface: 'settingsCopy', title: 'AI 설정·⋯ 메뉴에 원시 모델 id·줄표 자리표시·내부 제품명·중복 제목이 없고 1024 본문이 바닥 막대와 겹치지 않는다', run: settingsCopy },
  { id: 'C-72', surface: 'settingsClose', title: 'AI 설정 닫기 버튼 히트 영역 32×32 이상', run: settingsClose },
  { id: 'C-73', surface: 'fail429', title: '429 실패 말풍선에 JSON·영어 원문이 없고 초기화 시각과 다시 시도·설정 열기 버튼이 있다', run: failureMessage },
  { id: 'C-75', surface: 'stripes', title: 'AI 크롬의 인용 규칙에 왼쪽 줄무늬·inset 줄무늬·2px 테두리가 없다', run: aiStripes },
  {
    id: 'C-74',
    surface: 'w0-C-74',
    title: w0['C-74'].title,
    // wave-0 device unchanged. Preconditions: AI connected (a draft is typed into a usable composer; while AI is
    // not connected the composer is aria-disabled since C-60) and the rail opened by test id (C-62 renames its label).
    async run(ctx) {
      await mockProvider(ctx.page);
      await expandPanel(ctx.page);
      return w0['C-74'].run(ctx);
    },
  },
];

// ---------------------------------------------------------------- before/after setups (g004 L5-pairs runner)
// Each prepare puts the page in the state its cluster's device measures; the runner screenshots it on
// the baseline and on the head build and composes the pair with before-after.mjs composeSideBySide.
const studio = async ({ page }) => clickTid(page, 'topbar-ai-studio', 2500);
const selectOnCanvas = async ({ page }, expand = true) => {
  if (expand) await expandPanel(page);
  const d = await canvasDrag(page);
  await dragSelect(page, d.from, d.to);
};
export const pairs = {
  'C-56': { surface: 'canvasBar', prepare: (c) => selectOnCanvas(c) },
  'C-57': { surface: 'narrow', prepare: async ({ page }) => { await page.setViewportSize({ width: 683, height: 427 }); await wait(page, 800); await mockProvider(page); await expandPanel(page); } },
  'C-58': { surface: 'barActions', prepare: (c) => selectOnCanvas(c, false) },
  'C-59': { surface: 'selChip', prepare: (c) => selectOnCanvas(c) },
  'C-60': { surface: 'notConnected', prepare: (c) => selectOnCanvas(c) },
  'C-61': { surface: 'entries', prepare: async ({ page }) => { await expandPanel(page); } },
  'C-62': { surface: 'names', prepare: async ({ page }) => { await expandPanel(page); } },
  'C-63': { surface: 'studio1024', prepare: studio },
  'C-63-en': { surface: 'studioEn', prepare: studio },
  'C-64': { surface: 'studioNames', prepare: studio },
  'C-65': { surface: 'studioIds', prepare: studio },
  'C-66': { surface: 'studioHier', prepare: studio },
  'C-67': { surface: 'conn429', prepare: async ({ page }) => { await mockProvider(page, { quota: true }); await expandPanel(page); await sendAndFail(page, '여기에 작은 연못을 만들어 줘'); await page.locator('[data-testid="ai-connection-chip"]').first().click(); await wait(page, 1500); } },
  'C-68': { surface: 'chipEn', prepare: async ({ page }) => { await page.locator('[data-testid="ai-connection-chip"]').first().hover(); await wait(page, 1600); } },
  'C-69': { surface: 'usage429', prepare: async ({ page }) => { await mockProvider(page, { quota: true }); await expandPanel(page); await sendAndFail(page, '여기에 작은 연못을 만들어 줘'); await sendAndFail(page, '이 영역을 주변과 어울리게 다듬어 줘'); await clickTid(page, 'topbar-ai-settings', 1500); await clickTid(page, 'ai-settings-tab-usage', 2500); } },
  'C-70': { surface: 'settingsFoot', prepare: async ({ page }) => clickTid(page, 'topbar-ai-settings', 1500) },
  'C-71': { surface: 'settingsCopy', prepare: async ({ page }) => { await expandPanel(page); await clickTid(page, 'ai-command-menu-toggle', 800); } },
  'C-72': { surface: 'settingsClose', prepare: async ({ page }) => clickTid(page, 'topbar-ai-settings', 1500) },
  'C-73': { surface: 'fail429', prepare: async ({ page }) => { await mockProvider(page, { quota: true }); await expandPanel(page); await sendAndFail(page, '여기에 작은 연못을 만들어 줘'); } },
  'C-74': { surface: 'w0-C-74', prepare: async ({ page }) => { await mockProvider(page); await expandPanel(page); await page.locator('[data-testid="ai-input"]').first().click(); await page.keyboard.type('테스트 초안'); await page.evaluate(() => document.querySelector('[data-testid="ai-suggestion-peek-header"], [data-testid="ai-suggestion-peek"]')?.click()); await wait(page, 1200); await page.evaluate(() => [...document.querySelectorAll('[data-testid="ai-project-suggestion"] button')].find((b) => /AI와 이어가기/.test(b.textContent || ''))?.click()); await wait(page, 1000); } },
  'C-75': { surface: 'stripes', prepare: async ({ page }) => { await expandPanel(page); } },
};
