// Lane L8 devices: event editor (src/styles/event, src/editor/panels/eventEditor*).
// Each device opens a fresh editor, places a new event by double-clicking the map canvas
// on the event layer, and measures the event editor itself.
//   C-103  selected rows, callouts and the window frame carry no one-side accent/warning stripe
//   C-102  Ctrl+Enter confirms the event editor, the confirm button declares the shortcut, and the
//          internal event id / developer field name are not shown in the default view.
// C-104 (start-screen button bevel) has no device: all of its findings were rejected by the judge.

const MODAL = '[data-testid="event-editor-modal"]';

/** Switch to the event layer and double-click the canvas until the event editor opens. */
async function openEventEditor(page) {
  await page.keyboard.press('F7');
  await page.waitForTimeout(400);
  const canvas = page.locator('[data-testid="edit-canvas"] canvas').first();
  await canvas.waitFor({ state: 'visible', timeout: 25_000 });
  const box = await canvas.boundingBox();
  if (!box) throw new Error('no edit canvas');
  for (const c of [[0.3, 0.4], [0.25, 0.7], [0.5, 0.5], [0.4, 0.6], [0.6, 0.35]]) {
    await canvas.dblclick({ position: { x: Math.floor(box.width * c[0]), y: Math.floor(box.height * c[1]) } });
    try {
      await page.locator(MODAL).waitFor({ state: 'visible', timeout: 2500 });
      await page.waitForTimeout(800);
      return;
    } catch {
      /* try the next cell */
    }
  }
  throw new Error('event editor did not open');
}

/** Open the event editor, fill it from the talking-NPC starter and select its first command row. */
async function openEditorWithSelectedCommand(page, lib, surface, log) {
  await openEventEditor(page);
  // Fill the new event from a starter so the command list has rows to select.
  const p = await lib.locateTarget(page, '대사하는 NPC', { lang: surface.lang, log });
  await page.mouse.click(p.x, p.y);
  await page.waitForTimeout(900);
  // The starter opens the 문장 표시 dialog with a default line; confirm it.
  const ok = await lib.locateTarget(page, '확인', { lang: surface.lang, log });
  await page.mouse.click(ok.x, ok.y);
  await page.waitForTimeout(900);
  const head = page.locator(`${MODAL} .cmd-list .cmd-item > .cmd-head`).first();
  await head.waitFor({ state: 'visible', timeout: 10_000 });
  await head.click();
  await page.waitForTimeout(500);
}

/** Count rules in the live CSSOM (built bundle) that still draw a one-side stripe on lane selectors. */
function stripeRuleScan() {
  // Each comma part of a selector must END with one of these (the audited rules), so unrelated
  // descendants such as `.event-editor-modal-window .x > .y` are not in scope.
  const TARGETS = [
    /\.play-audio-channel-btn\.active$/,
    /\.shop-editor-goods-row\.is-selected$/,
    /\.shop-message-example$/,
    /\.storage-chest-treasure-note$/,
    /\.db-field-hint$/,
    /\.cmd-item\.(selected|editing)(\s*>\s*|\s+)\.cmd-head$/,
    /\.cmd-item\.(selected|editing)$/,
    /\.cmd-empty-line:focus$/,
    /\.event-storyboard-card(:hover|\.is-selected)?$/,
    /\.row\.(selected|is-selected)$/,
    /\.event-character-social-extras$/,
    /\.event-schedule-shadow-warning$/,
    /\.leaf\.(sel|is-selected)$/,
    /^\.event-editor-modal-window$/,
  ];
  const splitTop = (s, sep) => {
    const out = [];
    let depth = 0;
    let cur = '';
    for (const ch of s || '') {
      if (ch === '(') depth++;
      if (ch === ')') depth--;
      if ((sep === ',' ? ch === ',' : /\s/.test(ch)) && depth === 0) {
        if (cur.trim()) out.push(cur.trim());
        cur = '';
      } else cur += ch;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
  };
  const isLen = (t) => /^-?\d*\.?\d+(px|em|rem)?$/.test(t);
  const num = (t) => parseFloat(t) || 0;
  const insetStripe = (shadow) =>
    splitTop(shadow, ',').some((part) => {
      const toks = splitTop(part, ' ');
      if (!toks.includes('inset')) return false;
      const [x = 0, y = 0, blur = 0, spread = 0] = toks.filter((t) => t !== 'inset' && isLen(t)).map(num);
      return (x !== 0) !== (y !== 0) && blur === 0 && spread === 0;
    });
  const SIDES = ['top', 'right', 'bottom', 'left'];
  // CSSOM leaves longhands empty when a shorthand holds var(); read the per-side shorthand too.
  const sideValue = (st, s) =>
    st.getPropertyValue(`border-${s}`) ||
    [st.getPropertyValue(`border-${s}-width`), st.getPropertyValue(`border-${s}-style`), st.getPropertyValue(`border-${s}-color`)].filter(Boolean).join(' ');
  const edgeStripe = (st) => {
    const vals = SIDES.map((s) => sideValue(st, s));
    const set = vals.filter(Boolean);
    if (set.length > 0 && set.length < 4) {
      // A side declared alone: a stripe when it is thick or coloured (not a reset to 0/none).
      if (set.some((v) => !/^(0(px)?|none)(\s|$)/.test(v) && (splitTop(v, ' ').some((t) => isLen(t) && num(t) >= 2) || /var\(|#|rgb|hsl|color-mix/.test(v)))) return true;
    }
    if (set.length === 4 && new Set(vals).size > 1) return true;
    const colors = splitTop(st.getPropertyValue('border-color'), ' ');
    return colors.length > 1 && new Set(colors).size > 1;
  };
  const accentOutline = (sel, st) =>
    /\.cmd-head$/.test(sel) && /accent/.test(st.getPropertyValue('border-color') || st.getPropertyValue('border-top-color') || st.getPropertyValue('border') || '');
  const hits = [];
  let scanned = 0;
  const walk = (rules) => {
    for (const r of rules) {
      if (r.cssRules && !r.selectorText) {
        walk(r.cssRules);
        continue;
      }
      if (!r.selectorText || !r.style) continue;
      const parts = splitTop(r.selectorText, ',').filter((p) => TARGETS.some((t) => t.test(p)));
      if (!parts.length) continue;
      scanned++;
      const st = r.style;
      const kinds = [];
      if (insetStripe(st.getPropertyValue('box-shadow'))) kinds.push('inset-shadow-stripe');
      if (edgeStripe(st)) kinds.push('edge-stripe');
      if (parts.some((p) => accentOutline(p, st))) kinds.push('accent-outline');
      if (kinds.length) hits.push(`${kinds.join('+')} ${parts.join(', ').slice(0, 90)}`);
    }
  };
  for (const sheet of document.styleSheets) {
    try {
      walk(sheet.cssRules);
    } catch {
      /* cross-origin sheet */
    }
  }
  return { scanned, hits };
}

/** Visible text plus visible input values inside a root; counts internal-id and field-name leaks. */
function leakScan(selector) {
  const roots = [...document.querySelectorAll(selector)];
  let text = '';
  for (const root of roots) {
    text += `\n${root.innerText || ''}`;
    for (const input of root.querySelectorAll('input,textarea')) {
      if (input.getClientRects().length === 0) continue;
      // Content of a closed <details> keeps layout boxes (forced layout) but is not shown.
      if (typeof input.checkVisibility === 'function' && !input.checkVisibility()) continue;
      const r = input.getBoundingClientRect();
      if (r.width < 2 || r.height < 2 || getComputedStyle(input).visibility === 'hidden') continue;
      text += `\n${input.value}`;
    }
  }
  return {
    roots: roots.length,
    idHits: (text.match(/ev_[a-z0-9]{6,}/gi) || []).length,
    characterIdHits: (text.match(/characterId/g) || []).length,
    samples: [...text.matchAll(/.{0,40}(ev_[a-z0-9]{6,}|characterId).{0,20}/gi)].map((m) => m[0]).slice(0, 4),
  };
}

export const surfaces = {
  'event-editor': { width: 1440, height: 900, lang: 'ko' },
  'event-editor-keys': { width: 1440, height: 900, lang: 'ko' },
};

export const devices = [
  {
    id: 'C-103-event-stripes',
    surface: 'event-editor',
    title: 'Event editor selected rows and callouts carry no one-side accent/warning stripe',
    async run({ page, lib, surface, log }) {
      await openEditorWithSelectedCommand(page, lib, surface, log);
      const sel = await page.evaluate(() => {
        const h = document.querySelector('[data-testid="event-editor-modal"] .cmd-list .cmd-item.selected > .cmd-head');
        if (!h) return null;
        const cs = getComputedStyle(h);
        return {
          boxShadow: cs.boxShadow,
          leftW: parseFloat(cs.borderLeftWidth),
          rightW: parseFloat(cs.borderRightWidth),
          leftC: cs.borderLeftColor,
          topC: cs.borderTopColor,
          bg: cs.backgroundColor,
        };
      });
      const scan = await page.evaluate(stripeRuleScan);
      const selectedRows = sel ? 1 : 0;
      const selectedShadowNone = sel && sel.boxShadow === 'none' ? 1 : 0;
      const selectedEdgeUneven = sel && (sel.leftW !== sel.rightW || sel.leftC !== sel.topC) ? 1 : 0;
      const measured = {
        selectedRows,
        selectedShadowNone,
        selectedEdgeUneven,
        selectedBoxShadow: sel?.boxShadow ?? '',
        selectedBackground: sel?.bg ?? '',
        rulesScanned: scan.scanned,
        stripeRules: scan.hits.length,
        stripeRuleList: scan.hits,
      };
      return { pass: selectedRows === 1 && selectedShadowNone === 1 && selectedEdgeUneven === 0 && scan.scanned >= 14 && scan.hits.length === 0, measured };
    },
  },
  {
    id: 'C-102-confirm-shortcut-and-ids',
    surface: 'event-editor-keys',
    title: 'Ctrl+Enter saves and closes the event editor; no internal event id or characterId in the default view',
    async run({ page }) {
      await openEventEditor(page);
      const modalLeak = await page.evaluate(leakScan, MODAL);
      const shortcut = await page.evaluate(() => {
        const b = document.querySelector('[data-testid="event-editor-save"]');
        return { attr: b?.getAttribute('aria-keyshortcuts') ?? '', title: b?.getAttribute('title') ?? '' };
      });
      const shortcutDeclared = /Enter/.test(shortcut.attr) ? 1 : 0;
      const shortcutShown = /Ctrl\+Enter|⌘\+?Enter|Cmd\+Enter/.test(shortcut.title) ? 1 : 0;
      const name = page.locator('[data-testid="event-editor-name"]');
      await name.click();
      await page.keyboard.type('촌장');
      await page.keyboard.press('Control+Enter');
      await page.waitForTimeout(1200);
      const openAfterShortcut = await page.locator(`${MODAL}:visible`).count();
      if (openAfterShortcut > 0) {
        // Close through the button so the sidebar leak check below is measured either way.
        await page.locator('[data-testid="event-editor-save"]').click();
        await page.waitForTimeout(1200);
      }
      const named = await page.evaluate(
        () => [...document.querySelectorAll('[data-testid="event-list"] .event-list-row')].filter((r) => r.innerText.includes('촌장')).length,
      );
      const sideLeak = await page.evaluate(leakScan, '[data-testid="palette-event-pane"]');
      const measured = {
        shortcutDeclared,
        shortcutShown,
        openAfterShortcut,
        namedRowsAfterSave: named,
        modalIdHits: modalLeak.idHits,
        modalCharacterIdHits: modalLeak.characterIdHits,
        sidebarRoots: sideLeak.roots,
        sidebarIdHits: sideLeak.idHits,
        sidebarCharacterIdHits: sideLeak.characterIdHits,
        leakSamples: [...modalLeak.samples, ...sideLeak.samples],
        saveButtonShortcut: shortcut.attr,
        saveButtonTitle: shortcut.title,
      };
      const pass =
        shortcutDeclared === 1 && shortcutShown === 1 && openAfterShortcut === 0 && named >= 1 && sideLeak.roots >= 1 &&
        modalLeak.idHits === 0 && modalLeak.characterIdHits === 0 && sideLeak.idHits === 0 && sideLeak.characterIdHits === 0;
      return { pass, measured };
    },
  },
];

/** Before/after capture setups per cluster (used by the lane pair runner; same steps as the devices). */
export const pairs = {
  'C-103': { surface: 'event-editor', prepare: ({ page, lib, surface, log }) => openEditorWithSelectedCommand(page, lib, surface, log) },
  'C-102': {
    surface: 'event-editor-keys',
    prepare: async ({ page }) => {
      await openEventEditor(page);
      // Show the confirm button's shortcut tooltip next to the header.
      await page.locator('[data-testid="event-editor-save"]').hover();
      await page.waitForTimeout(1600);
    },
  },
};
