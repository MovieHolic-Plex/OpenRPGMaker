// Lane L7: test-play / battle-test windows and the game runtime.
// Every device opens the real editor (?freshProject=1&aiBridge=0), drives the test-play or battle-test
// window through its public entry points (top-bar 테스트 실행, the editor's oprn:test-play-window event)
// and asserts measured numbers on this lane's surfaces only.
import fs from 'node:fs';
import path from 'node:path';

const VIS = `
  const vis = (el) => { if (!el || el.nodeType !== 1) return false; const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return false;
    const s = getComputedStyle(el); return s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.02 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth; };
  const rectOf = (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), b: Math.round(r.bottom), r: Math.round(r.right) }; };
  const inter = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  const nameOf = (el) => (el.getAttribute('aria-label') || (el.getAttribute('aria-labelledby') && document.getElementById(el.getAttribute('aria-labelledby'))?.innerText) || (el.labels && el.labels[0] && el.labels[0].innerText) || el.innerText || el.getAttribute('title') || el.value || '').replace(/\\s+/g, ' ').trim();
  const allNames = (el) => [el.getAttribute('aria-label'), el.getAttribute('title'), el.innerText].filter(Boolean).join(' ');
  const textOf = (el) => (el.innerText || '').replace(/\\s+/g, ' ').trim();
  const tpModal = () => document.querySelector('.test-play-modal-backdrop');
  const INTERACTIVE = 'button,a[href],input,select,textarea,summary,[role=button],[role=tab],[role=menuitem],[role=checkbox],[role=switch],[role=option]';
`;
const pe = (page, body, arg = null) => page.evaluate(new Function('arg', `${VIS}\n${body}`), arg);
const T = (ctx, ko) => ctx.lib.tr(ctx.surface.lang, ko);

async function shot(page, name, clip) {
  if (!process.env.HIG_UX_DEBUG_DIR) return;
  fs.writeFileSync(path.join(process.env.HIG_UX_DEBUG_DIR, `L7-${name}.png`), await page.screenshot(clip ? { clip } : {}));
}

async function poll(page, body, { ms = 20_000, every = 150 } = {}) {
  const until = Date.now() + ms;
  for (;;) {
    const v = await pe(page, body);
    if (v) return v;
    if (Date.now() >= until) return null;
    await page.waitForTimeout(every);
  }
}

async function clickByName(ctx, ko, settleMs = 600) {
  const p = await ctx.lib.locateTarget(ctx.page, T(ctx, ko), { lang: ctx.surface.lang, log: ctx.log, timeoutMs: 15_000 });
  await ctx.page.mouse.click(p.x, p.y);
  await ctx.page.waitForTimeout(settleMs);
}

/** Open the full test-play window from the top bar and wait for the window. */
async function openTestPlay(ctx) {
  try {
    await clickByName(ctx, '테스트 실행', 200);
  } catch {
    // The top-bar name differs per language; the editor's own request event opens the same window.
    await ctx.page.evaluate(() => window.dispatchEvent(new CustomEvent('oprn:test-play-window')));
  }
  const ok = await poll(ctx.page, `return tpModal() && vis(tpModal()) ? 1 : 0;`, { ms: 15_000 });
  if (!ok) throw new Error('test-play window did not open');
}

const CINEMATIC = `const c = [...document.querySelectorAll('.test-play-modal-backdrop .cinematic-sequence')].filter(vis)[0];`;
const FIELD = `const hud = [...document.querySelectorAll('.test-play-modal-backdrop .field-hud')].filter(vis)[0];`;

/** Reach the playable field: skip an opening with Escape when one plays. */
async function toField(ctx) {
  const until = Date.now() + 40_000;
  while (Date.now() < until) {
    const s = await pe(ctx.page, `${CINEMATIC} ${FIELD} return { cine: c ? 1 : 0, field: hud && !c ? 1 : 0 };`);
    if (s.field) {
      await ctx.page.waitForTimeout(600);
      return;
    }
    if (s.cine) {
      await ctx.page.keyboard.press('Escape');
      await ctx.page.waitForTimeout(1500);
    } else await ctx.page.waitForTimeout(300);
  }
  throw new Error('field never became playable');
}

/** Make sure the opening plays in this window (it may be skipped by preference). */
async function ensureOpening(ctx) {
  const checked = await pe(ctx.page, `const i = tpModal()?.querySelector('[data-testid="test-play-skip-opening"]'); return i ? (i.checked ? 1 : 0) : -1;`);
  if (checked === 1) {
    const box = await ctx.page.locator('[data-testid="test-play-skip-opening"]').boundingBox();
    await ctx.page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  }
  const seen = await poll(ctx.page, `${CINEMATIC} return c ? 1 : 0;`, { ms: 20_000 });
  if (!seen) throw new Error('opening did not start');
  await ctx.page.waitForTimeout(1500);
}

const MENU = `const menu = [...document.querySelectorAll('.test-play-modal-backdrop .oprn-status-menu')].filter(vis)[0];`;
async function openGameMenu(ctx) {
  for (let i = 0; i < 3; i++) {
    await ctx.page.keyboard.press('Escape');
    const open = await poll(ctx.page, `${MENU} return menu ? 1 : 0;`, { ms: 2500 });
    if (open) {
      await ctx.page.waitForTimeout(700);
      return;
    }
  }
  throw new Error('game menu did not open');
}

/** Open the battle test for one troop through the editor's own test-play request event. */
async function openBattle(ctx, troopId = 'troop_golem_guard') {
  await ctx.page.evaluate((id) => window.dispatchEvent(new CustomEvent('oprn:test-play-window', { detail: { kind: 'troop-battle', troopId: id } })), troopId);
  const ok = await poll(ctx.page, `return [...document.querySelectorAll('.test-play-modal-backdrop .battle-command')].filter(vis).length ? 1 : 0;`, { ms: 25_000 });
  if (!ok) throw new Error('battle test did not reach the command menu');
  await ctx.page.waitForTimeout(1500);
}

const TITLEBAR = `const bar = tpModal()?.querySelector('.test-play-titlebar');`;

/** Titlebar controls of the open window: sizes, line count, close-action count, checkbox names. */
async function titlebarMetrics(page) {
  return pe(page, `${TITLEBAR} if (!bar) return { titlebar: 0 };
    const ctrls = [...bar.querySelectorAll('button, label, input[type=checkbox]')].filter((e) => vis(e) && !(e.tagName === 'INPUT' && e.closest('label')));
    const heights = ctrls.map((e) => e.getBoundingClientRect().height);
    const lines = ctrls.map((e) => { const r = document.createRange(); r.selectNodeContents(e); const tops = new Set([...r.getClientRects()].filter((q) => q.width > 1).map((q) => Math.round(q.top / 4))); return tops.size; });
    const closeRe = /닫기|편집으로|편집기로|close|editor/i;
    const closers = [...bar.querySelectorAll('button')].filter(vis).filter((b) => closeRe.test(allNames(b)) && !/다시|restart/i.test(allNames(b)));
    const boxes = [...bar.querySelectorAll('input[type=checkbox]')].filter((e) => e.closest('label') ? vis(e.closest('label')) : vis(e));
    const boxNames = boxes.map((b) => nameOf(b));
    return { titlebar: 1, controls: ctrls.length, minHeightPx: Math.round(Math.min(...heights)), multiLine: lines.filter((n) => n > 1).length,
      closeActions: closers.length, closeNames: closers.map(nameOf), checkboxes: boxes.length, checkboxOnName: boxNames.filter((n) => !n || n === 'on').length, checkboxNames: boxNames,
      windowTitle: textOf(bar.querySelector('.test-play-title') || bar).slice(0, 60) };`);
}

export const surfaces = {
  play: { width: 1440, height: 900, lang: 'ko' },
  playField: { width: 1440, height: 900, lang: 'ko' },
  playMenu: { width: 1440, height: 900, lang: 'ko' },
  playSmall: { width: 900, height: 600, lang: 'ko' },
  playKeys: { width: 1440, height: 900, lang: 'ko' },
  playLoad: { width: 1440, height: 900, lang: 'ko' },
  playDebug: { width: 1440, height: 900, lang: 'ko' },
  opening1920: { width: 1920, height: 1080, lang: 'ko' },
  opening1440: { width: 1440, height: 900, lang: 'ko' },
  battle: { width: 1440, height: 900, lang: 'ko' },
  battleKeys: { width: 1440, height: 900, lang: 'ko' },
  battleFont1024: { width: 1024, height: 640, lang: 'ko' },
  battleFont1440: { width: 1440, height: 900, lang: 'ko' },
  battleFont1920: { width: 1920, height: 1080, lang: 'ko' },
  en: { width: 1366, height: 768, lang: 'en' },
  wave0Play: { width: 1440, height: 900, lang: 'ko' },
};

const ENEMY_BOXES = `const enemies = [...document.querySelectorAll('.test-play-modal-backdrop .battle-enemy')].filter(vis);`;

export const devices = [
  // ------------------------------------------------------------------ C-97 [P1]
  {
    id: 'C-97',
    surface: 'battle',
    title: 'Runtime windows do not overprint: status-menu name vs map name, and an upper enemy (with its baked ground shadow) never paints over a lower enemy',
    async run(ctx) {
      const { page } = ctx;
      await openBattle(ctx);
      // Every pair of intersecting enemy boxes: the one whose feet are lower (closer to the camera) must paint on top.
      const battle = await pe(page, `${ENEMY_BOXES}
        let pairs = 0, wrongOrder = 0; const samples = [];
        for (let i = 0; i < enemies.length; i++) for (let j = i + 1; j < enemies.length; j++) {
          const a = enemies[i].getBoundingClientRect(), b = enemies[j].getBoundingClientRect(); const area = inter(a, b); if (area < 4) continue; pairs++;
          const x = (Math.max(a.left, b.left) + Math.min(a.right, b.right)) / 2, y = (Math.max(a.top, b.top) + Math.min(a.bottom, b.bottom)) / 2;
          const top = document.elementFromPoint(x, y)?.closest('.battle-enemy');
          const lower = a.bottom >= b.bottom ? enemies[i] : enemies[j];
          if (top !== lower) wrongOrder++;
          samples.push({ area: Math.round(area), lowerBottom: Math.round(Math.max(a.bottom, b.bottom)), topIsLower: top === lower ? 1 : 0 });
        }
        return { enemies: enemies.length, intersectingPairs: pairs, upperPaintedOverLower: wrongOrder, samples };`);
      await shot(page, 'c97-battle');
      // Close the battle and open the game menu of a test run.
      await pe(page, `tpModal()?.querySelector('[data-testid="test-play-window-close"], [data-testid="mode-edit"]')?.click(); return 1;`);
      await page.waitForTimeout(1200);
      await openTestPlay(ctx);
      await toField(ctx);
      await openGameMenu(ctx);
      await shot(page, 'c97-menu');
      const menu = await pe(page, `${MENU} if (!menu) return { menuOpen: 0 };
        const lead = menu.querySelector('.status-menu-rel-lead .status-menu-overview-info, .status-menu-overview-row .status-menu-overview-info');
        if (!lead) return { menuOpen: 1, leadRow: 0 };
        const spans = [...lead.querySelectorAll('span')].filter((s) => vis(s) && textOf(s) && !s.querySelector('span'));
        const inkRect = (el) => { const r = document.createRange(); r.selectNodeContents(el); return r.getBoundingClientRect(); };
        let maxOverlap = 0;
        for (let i = 0; i < spans.length; i++) for (let j = i + 1; j < spans.length; j++) maxOverlap = Math.max(maxOverlap, inter(inkRect(spans[i]), inkRect(spans[j])));
        return { menuOpen: 1, leadRow: 1, lines: spans.length, texts: spans.map(textOf).slice(0, 4), nameMapOverlapPx2: Math.round(maxOverlap) };`);
      const m = { ...battle, ...menu, samples: battle.samples };
      return {
        pass: battle.enemies >= 2 && battle.upperPaintedOverLower === 0 && menu.menuOpen === 1 && menu.leadRow === 1 && menu.lines >= 2 && menu.nameMapOverlapPx2 === 0,
        measured: m,
      };
    },
  },

  // ------------------------------------------------------------------ C-89 [P2]
  {
    id: 'C-89',
    surface: 'playSmall',
    title: 'Test-play and battle-test title bars: one close action, >=28 px one-line controls, named checkboxes, one term for the window and the top-bar button',
    async run(ctx) {
      const { page } = ctx;
      const topName = await pe(page, `const b = [...document.querySelectorAll('[aria-label]')].filter(vis).find((e) => /^테스트 실행/.test(e.getAttribute('aria-label'))); return b ? b.getAttribute('aria-label') : '';`);
      await openTestPlay(ctx);
      await page.waitForTimeout(1500);
      const play = await titlebarMetrics(page);
      await shot(page, 'c89-play');
      await pe(page, `tpModal()?.querySelector('[data-testid="test-play-window-close"], [data-testid="mode-edit"]')?.click(); return 1;`);
      await page.waitForTimeout(1200);
      await openBattle(ctx);
      const battle = await titlebarMetrics(page);
      await shot(page, 'c89-battle');
      const term = (topName.match(/^(\S+ \S+)/) || [])[1] || topName;
      const m = {
        topBarName: topName,
        playMinHeightPx: play.minHeightPx, playMultiLine: play.multiLine, playCloseActions: play.closeActions, playCheckboxOnName: play.checkboxOnName,
        battleMinHeightPx: battle.minHeightPx, battleMultiLine: battle.multiLine, battleCloseActions: battle.closeActions,
        playTitleUsesTopBarTerm: play.windowTitle.startsWith(term) ? 1 : 0,
        battleCloseNamesSayPlay: battle.closeNames.filter((n) => /시연|demo|테스트 플레이/i.test(n)).length,
        play, battle,
      };
      return {
        pass: m.playMinHeightPx >= 28 && m.battleMinHeightPx >= 28 && m.playMultiLine === 0 && m.battleMultiLine === 0 &&
          m.playCloseActions === 1 && m.battleCloseActions === 1 && play.checkboxes >= 1 && m.playCheckboxOnName === 0 &&
          m.playTitleUsesTopBarTerm === 1 && m.battleCloseNamesSayPlay === 0,
        measured: m,
      };
    },
  },

  // ------------------------------------------------------------------ C-93 [P2]
  {
    id: 'C-93',
    surface: 'play',
    title: 'A new project without an authored opening starts test play on the map, not on the default opening',
    async run(ctx) {
      const { page } = ctx;
      await openTestPlay(ctx);
      const t0 = Date.now();
      let cinematicFrames = 0, fieldAt = -1;
      while (Date.now() - t0 < 12_000) {
        const s = await pe(page, `${CINEMATIC} ${FIELD} return { cine: c ? 1 : 0, field: hud ? 1 : 0, caption: c ? textOf(c).slice(0, 40) : '' };`);
        if (s.cine) cinematicFrames++;
        if (s.field && !s.cine) { fieldAt = Date.now() - t0; break; }
        await page.waitForTimeout(200);
      }
      await shot(page, 'c93-first');
      const pref = await pe(page, `const i = tpModal()?.querySelector('[data-testid="test-play-skip-opening"]'); return i ? (i.checked ? 1 : 0) : -1;`);
      const m = { openingSamplesSeen: cinematicFrames, fieldVisibleAfterMs: fieldAt, skipOpeningChecked: pref };
      return { pass: cinematicFrames === 0 && fieldAt >= 0 && pref === 1, measured: m };
    },
  },

  // ------------------------------------------------------------------ C-95 [P2]
  {
    id: 'C-95',
    surface: 'battle',
    title: 'Battle status: HP is labelled, damage numbers appear after an attack, no English stat abbreviations in ko, the disabled item command shows its reason',
    async run(ctx) {
      const { page } = ctx;
      await openBattle(ctx);
      const before = await pe(page, `const root = tpModal();
        const hp = [...root.querySelectorAll('.battle-party .battle-actor-hp .battle-vital-label')].filter(vis).filter((e) => /^HP$/.test(textOf(e))).length;
        const inert = [...root.querySelectorAll('.battle-command[aria-disabled=true], .battle-command[data-battle-command-inert=true]')].filter(vis);
        const reasons = inert.filter((b) => [...b.querySelectorAll('.battle-command-reason, small')].some((s) => vis(s) && textOf(s)) || (b.getAttribute('aria-describedby') && document.getElementById(b.getAttribute('aria-describedby'))));
        // The labelled HP value must still fit its cell (no clipped digits).
        const hpClipped = [...root.querySelectorAll('.battle-party .battle-actor-hp')].filter(vis).filter((e) => e.scrollWidth > e.clientWidth + 1).length;
        return { hpLabelsVisible: hp, hpValuesClipped: hpClipped, inertCommands: inert.length, inertWithVisibleReason: reasons.length };`);
      // Attack the first enemy with the keyboard (Enter on 공격, Enter on the first target) and watch for damage numbers.
      await page.evaluate(() => {
        window.__l7Damage = { seen: 0, text: '' };
        const obs = new MutationObserver(() => {
          for (const p of document.querySelectorAll('.battle-damage-popup')) {
            const r = p.getBoundingClientRect(); const s = getComputedStyle(p);
            if (r.width > 2 && r.height > 2 && s.display !== 'none' && s.visibility !== 'hidden' && /\d/.test(p.textContent || '')) { window.__l7Damage.seen++; window.__l7Damage.text = (p.textContent || '').trim().slice(0, 20); }
          }
        });
        obs.observe(document.body, { subtree: true, childList: true, attributes: true });
        window.__l7DamageObs = obs;
      });
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);
      await page.keyboard.press('Enter');
      const dmg = await poll(page, `return window.__l7Damage.seen ? window.__l7Damage : null;`, { ms: 8000, every: 100 });
      await page.waitForTimeout(4000);
      await shot(page, 'c95-after-attack');
      // Stat badges draw their glyphs in ::before (CSS content) as well as in text.
      const abbr = await pe(page, `const root = tpModal(); const re = /(ATK|DEF|SPA|SPD|SPE|ACC|EVA|AGI|MAG)[↑↓]/g; let n = (root.innerText.match(re) || []).length; const samples = [];
        for (const e of root.querySelectorAll('.battle-status-icon, .battle-stage-pill')) { if (!vis(e)) continue; const c = getComputedStyle(e, '::before').content || ''; const k = (c.match(re) || []).length; if (k) { n += k; samples.push(c); } }
        return { englishStatAbbrev: n, abbrevSamples: samples.slice(0, 4) };`);
      await page.evaluate(() => window.__l7DamageObs?.disconnect());
      const m = { ...before, damageNumbersSeen: dmg ? dmg.seen : 0, damageText: dmg ? dmg.text : '', ...abbr };
      return { pass: m.hpLabelsVisible >= 1 && m.hpValuesClipped === 0 && m.damageNumbersSeen >= 1 && m.englishStatAbbrev === 0 && m.inertCommands >= 1 && m.inertWithVisibleReason === m.inertCommands, measured: m };
    },
  },

  // ------------------------------------------------------------------ C-91 [P2]
  {
    id: 'C-91',
    surface: 'playKeys',
    title: 'One Escape skips the opening without opening the game menu; game-menu items take a mouse click; Escape leaves the battle test (or the window says how)',
    async run(ctx) {
      const { page } = ctx;
      await openTestPlay(ctx);
      await ensureOpening(ctx);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(2500);
      const skip = await pe(page, `${CINEMATIC} ${MENU} return { openingAfterEsc: c ? 1 : 0, menuAfterEsc: menu ? 1 : 0 };`);
      await toField(ctx);
      await openGameMenu(ctx);
      // Click the second command of the game menu with the mouse.
      const target = await pe(page, `${MENU} const cmds = [...menu.querySelectorAll('.status-menu-command')].filter(vis); const t = cmds[1]; if (!t) return null;
        const sel = menu.querySelector('.status-menu-command.selected'); const r = t.getBoundingClientRect();
        const x = r.left + r.width / 2, y = r.top + r.height / 2; const hit = document.elementFromPoint(x, y);
        return { x, y, name: nameOf(t), selectedBefore: sel ? nameOf(sel) : '', screenBefore: menu.dataset.statusMenuScreen || '', hitIsTarget: hit && t.contains(hit) ? 1 : 0, hitClass: hit ? String(hit.className).slice(0, 60) : '' };`);
      let click = { menuClickChanged: 0 };
      if (target) {
        await page.mouse.click(target.x, target.y);
        await page.waitForTimeout(900);
        click = await pe(page, `${MENU} if (!menu) return { menuClickChanged: 1, after: 'closed' }; const sel = menu.querySelector('.status-menu-command.selected');
          const changed = (sel ? nameOf(sel) : '') !== arg.selectedBefore || (menu.dataset.statusMenuScreen || '') !== arg.screenBefore; return { menuClickChanged: changed ? 1 : 0, after: sel ? nameOf(sel) : '' };`, target);
      }
      await shot(page, 'c91-menu-click');
      await pe(page, `tpModal()?.querySelector('[data-testid="test-play-window-close"], [data-testid="mode-edit"]')?.click(); return 1;`);
      await page.waitForTimeout(1200);
      await openBattle(ctx);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(1200);
      const esc = await pe(page, `const m = tpModal(); const open = m && vis(m) ? 1 : 0;
        const hint = open ? [...m.querySelectorAll('.test-play-titlebar *')].filter((e) => vis(e) && /Esc/.test(allNames(e))).length : 0;
        return { battleOpenAfterEsc: open, battleEscHint: hint };`);
      await shot(page, 'c91-battle-esc');
      const m = { ...skip, ...click, clickedItem: target?.name ?? '', clickHitTarget: target?.hitIsTarget ?? 0, clickHitClass: target?.hitClass ?? '', ...esc };
      return { pass: m.openingAfterEsc === 0 && m.menuAfterEsc === 0 && m.menuClickChanged === 1 && (m.battleOpenAfterEsc === 0 || m.battleEscHint >= 1), measured: m };
    },
  },

  // ------------------------------------------------------------------ C-100 [P2]
  {
    id: 'C-100',
    surface: 'en',
    title: 'In an English editor the runtime chrome (opening skip hint, battle prompt/window, system menu values) has no Korean apart from game data names',
    async run(ctx) {
      const { page } = ctx;
      await openTestPlay(ctx);
      await ensureOpening(ctx);
      const hint = await pe(page, `const h = [...document.querySelectorAll('.cinematic-skip-hint')].filter(vis)[0]; return { hint: h ? textOf(h) : '' };`);
      await toField(ctx);
      await openGameMenu(ctx);
      // Open the system screen (last command) to read its option rows.
      await pe(page, `${MENU} const cmds = [...menu.querySelectorAll('.status-menu-command')].filter(vis); cmds[cmds.length - 1]?.click(); return 1;`);
      await page.waitForTimeout(900);
      const sys = await pe(page, `${MENU} const t = menu ? menu.innerText : ''; return { systemText: t.replace(/\\s+/g, ' ').slice(0, 300), onMixed: (t.match(/[가-힣]+\\s*(ON|OFF)\\b/g) || []).length };`);
      await shot(page, 'c100-system');
      await pe(page, `tpModal()?.querySelector('[data-testid="test-play-window-close"], [data-testid="mode-edit"]')?.click(); return 1;`);
      await page.waitForTimeout(1200);
      await openBattle(ctx);
      // Game data (names authored in Korean) is not chrome: actor, enemy and troop names are removed before counting.
      const data = ['주인공', '석상 수호병', '석상 골렘', '동굴 박쥐', '박쥐', '골렘', '빈 맵', '새 프로젝트'];
      const battle = await pe(page, `const t = tpModal().innerText.replace(/\\s+/g, ' '); let rest = t; for (const n of arg) rest = rest.split(n).join(' ');
        const hangul = rest.match(/[가-힣]+/g) || []; return { battleKoreanWords: hangul.length, battleKoreanSamples: hangul.slice(0, 8) };`, data);
      await shot(page, 'c100-battle');
      const m = { skipHint: hint.hint, skipHintKorean: /[가-힣]/.test(hint.hint) ? 1 : 0, systemOnOffMixed: sys.onMixed, ...battle, systemText: sys.systemText };
      return { pass: hint.hint !== '' && m.skipHintKorean === 0 && m.systemOnOffMixed === 0 && m.battleKoreanWords === 0, measured: m };
    },
  },

  // ------------------------------------------------------------------ C-101 [P2]
  {
    id: 'C-101',
    surface: 'playField',
    title: 'Field HUD numbers sit on their own plate: contrast >= 4.5 even over the brightest map pixels',
    async run(ctx) {
      const { page } = ctx;
      await openTestPlay(ctx);
      await toField(ctx);
      await shot(page, 'c101-field');
      const m = await pe(page, `const v = [...document.querySelectorAll('.test-play-modal-backdrop .field-hud .hud-value')].filter(vis)[0]; if (!v) return { hudValue: 0 };
        const parse = (c) => { const m = String(c).match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(parseFloat); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
        const over = (f, b) => ({ r: f.r * f.a + b.r * (1 - f.a), g: f.g * f.a + b.g * (1 - f.a), b: f.b * f.a + b.b * (1 - f.a), a: 1 });
        const lum = (c) => { const f = (x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
        const ratio = (a, b) => { const A = lum(a), B = lum(b); return (Math.max(A, B) + 0.05) / (Math.min(A, B) + 0.05); };
        // Plates between the text and the map (up to the HUD layer), composited over the worst-case map pixel (white, then black).
        const stack = []; for (let e = v; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c.a > 0) stack.push(c); if (e.classList.contains('field-hud')) break; }
        const fg = parse(getComputedStyle(v).color);
        const worst = [{ r: 255, g: 255, b: 255, a: 1 }, { r: 0, g: 0, b: 0, a: 1 }].map((base) => { let bg = base; for (let i = stack.length - 1; i >= 0; i--) bg = over(stack[i], bg); return ratio(over(fg, bg), bg); });
        return { hudValue: 1, text: textOf(v), plates: stack.length, worstContrast: Math.round(Math.min(...worst) * 100) / 100 };`);
      return { pass: m.hudValue === 1 && m.worstContrast >= 4.5, measured: m };
    },
  },

  // ------------------------------------------------------------------ C-92 [P2]
  {
    id: 'C-92',
    surface: 'playLoad',
    title: 'From the click until the game draws (opening on), every animation frame of the window body shows either a loading label or game content: no blank stretch over 100 ms',
    async run(ctx) {
      const { page } = ctx;
      // Force the opening path (the longest boot): the stored preference says "play the opening".
      // Key = STORAGE_PREFIX (src/util/appStorage.ts, "oprn:") + test-play-skip-opening (src/editor/panels/testPlayModal.ts).
      await page.evaluate(() => localStorage.setItem('oprn:test-play-skip-opening', '0'));
      // Per-frame sampler inside the page: body present? label visible? content visible?
      await pe(page, `window.__l7Boot = { frames: [], done: 0 }; const t0 = performance.now();
        const tick = () => { const st = window.__l7Boot; const m = tpModal(); const body = m && m.querySelector('.test-play-modal-body');
          if (body && vis(body)) {
            const label = [...m.querySelectorAll('.play-loading-message, .cinematic-status, [role=status]')].some((e) => vis(e) && textOf(e).length > 0 && body.contains(e));
            const img = [...body.querySelectorAll('.cinematic-image')].some((e) => vis(e) && e.complete && e.naturalWidth > 0);
            const text = [...body.querySelectorAll('.cinematic-narration, .cinematic-title, .title-screen')].some((e) => vis(e) && textOf(e).length > 0);
            const field = [...body.querySelectorAll('.field-hud')].some(vis);
            st.frames.push({ t: Math.round(performance.now() - t0), label: label ? 1 : 0, content: img || text || field ? 1 : 0 });
            if (img || text || field) { st.done = 1; return; }
          }
          if (performance.now() - t0 < 20000) requestAnimationFrame(tick); else st.done = 2; };
        requestAnimationFrame(tick); return 1;`);
      await clickByName(ctx, '테스트 실행', 0);
      await poll(page, `return window.__l7Boot.done ? 1 : 0;`, { ms: 22_000, every: 100 });
      await shot(page, 'c92-first-content');
      const m = await pe(page, `const f = window.__l7Boot.frames; let maxBlankRunMs = 0, blankFrames = 0, runStart = -1;
        for (let i = 0; i < f.length; i++) { const blank = !f[i].label && !f[i].content; if (blank) { blankFrames++; if (runStart < 0) runStart = i > 0 ? f[i - 1].t : f[i].t; maxBlankRunMs = Math.max(maxBlankRunMs, f[i].t - runStart); } else runStart = -1; }
        const first = f[0]; const firstLabel = f.find((x) => x.label); const content = f.find((x) => x.content);
        return { frames: f.length, bodyAtMs: first ? first.t : -1, labelAfterBodyMs: firstLabel && first ? firstLabel.t - first.t : -1, contentAfterBodyMs: content && first ? content.t - first.t : -1, blankFrames, maxBlankRunMs: Math.round(maxBlankRunMs) };`);
      return { pass: m.contentAfterBodyMs >= 0 && m.labelAfterBodyMs >= 0 && m.labelAfterBodyMs <= 100 && m.maxBlankRunMs <= 100, measured: m };
    },
  },

  // ------------------------------------------------------------------ C-99 [P2]
  {
    id: 'C-99',
    surface: 'playDebug',
    title: 'Runtime debug: a labelled >=28 px toggle; the open panel does not cover the game stage; nothing of it spills out of the window',
    async run(ctx) {
      const { page } = ctx;
      await openTestPlay(ctx);
      await toField(ctx);
      const closed = await pe(page, `const p = tpModal().querySelector('.runtime-debug-panel'); if (!p) return { panel: 0 }; const s = p.querySelector('summary'); const r = s.getBoundingClientRect();
        const w = tpModal().querySelector('.test-play-window').getBoundingClientRect(); const pr = p.getBoundingClientRect();
        return { panel: 1, toggleW: Math.round(r.width), toggleH: Math.round(r.height), toggleName: nameOf(s), toggleVisibleText: textOf(s), closedScrollOverflowPx: Math.max(0, Math.round(p.scrollHeight - p.clientHeight)), closedOutsideWindowPx: Math.max(0, Math.round(pr.bottom - w.bottom)) };`);
      if (!closed.panel) return { pass: false, measured: { panel: 0 } };
      const box = await page.locator('.test-play-modal-backdrop .runtime-debug-panel > summary').boundingBox();
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(1200);
      await shot(page, 'c99-open');
      const open = await pe(page, `const p = tpModal().querySelector('.runtime-debug-panel'); const stage = [...tpModal().querySelectorAll('.play-stage')].filter(vis)[0];
        const w = tpModal().querySelector('.test-play-window').getBoundingClientRect(); const pr = p.getBoundingClientRect(); const sr = stage ? stage.getBoundingClientRect() : null;
        const hud = [...tpModal().querySelectorAll('.field-hud')].filter(vis)[0];
        return { panelOpen: p.open ? 1 : 0, panelStageOverlapPx2: sr ? Math.round(inter(pr, sr)) : -1, openOutsideWindowPx: Math.max(0, Math.round(pr.bottom - w.bottom), Math.round(pr.right - w.right)), stageW: sr ? Math.round(sr.width) : 0, panelW: Math.round(pr.width) };`);
      const m = { ...closed, ...open };
      return {
        pass: m.toggleW >= 28 && m.toggleH >= 28 && /디버그|debug/i.test(m.toggleVisibleText) && m.closedOutsideWindowPx === 0 && m.panelOpen === 1 && m.panelStageOverlapPx2 === 0 && m.openOutsideWindowPx === 0 && m.stageW > 200,
        measured: m,
      };
    },
  },

  // ------------------------------------------------------------------ C-98 [P2]
  ...[['battleFont1024', 1024], ['battleFont1440', 1440], ['battleFont1920', 1920]].map(([surface, w]) => ({
    id: `C-98@${w}`,
    surface,
    title: 'The battle command font is the same at every window size and its pixel scale is an integer',
    async run(ctx) {
      await openBattle(ctx);
      const m = await pe(ctx.page, `const c = [...tpModal().querySelectorAll('.battle-command .battle-command-text strong, .battle-command-text')].filter(vis)[0]; const scene = tpModal().querySelector('.battle-scene');
        const cs = getComputedStyle(c); const scale = Number(scene?.dataset.battleStageScale || 0); const r = c.getBoundingClientRect();
        const renderedFontPx = parseFloat(cs.fontSize) * scale;
        return { fontFamily: cs.fontFamily.slice(0, 60), fontSizePx: parseFloat(cs.fontSize), stageScale: scale, renderedFontPx: Math.round(renderedFontPx * 100) / 100, renderedFontIsInteger: Math.abs(renderedFontPx - Math.round(renderedFontPx)) < 0.02 ? 1 : 0 };`);
      return { pass: m.renderedFontIsInteger === 1, measured: m };
    },
  })),

  // ------------------------------------------------------------------ C-94 [P2]
  ...[['opening1920', 1920], ['opening1440', 1440]].map(([surface, w]) => ({
    id: `C-94@${w}`,
    surface,
    title: 'Opening chrome follows the picture: skip chip wholly inside or outside the picture, caption band ends at the picture bottom, one letterbox colour',
    async run(ctx) {
      const { page } = ctx;
      await openTestPlay(ctx);
      await ensureOpening(ctx);
      await page.waitForTimeout(2500);
      await shot(page, `c94-${w}`);
      const m = await pe(page, `const root = [...document.querySelectorAll('.test-play-modal-backdrop .cinematic-sequence')].filter(vis)[0]; if (!root) return { opening: 0 };
        const img = [...root.querySelectorAll('.cinematic-image')].filter(vis)[0]; const chip = [...document.querySelectorAll('.cinematic-skip-hint')].filter(vis)[0];
        const band = [...root.querySelectorAll('.cinematic-narration')].filter(vis)[0];
        const stage = root.getBoundingClientRect(); const ir = img ? img.getBoundingClientRect() : stage;
        // The visible picture is the image clipped to the stage, minus the top and bottom letterbox bars of the scene frame.
        const frame = root.querySelector('.cinematic-frame:not([data-previous-frame])') || root; const probe = document.createElement('div');
        probe.style.cssText = 'position:absolute;left:0;top:0;width:1px;height:var(--cinematic-letterbox,0px);pointer-events:none;'; frame.append(probe); const lb = probe.getBoundingClientRect().height; probe.remove();
        const pic = { left: Math.max(ir.left, stage.left), top: Math.max(ir.top, stage.top + lb), right: Math.min(ir.right, stage.right), bottom: Math.min(ir.bottom, stage.bottom - lb) };
        let chipStraddles = 0; if (chip) { const c = chip.getBoundingClientRect(); const a = inter(c, pic), full = c.width * c.height; chipStraddles = a > 1 && a < full - 1 ? 1 : 0; }
        const bandBottomGapPx = band ? Math.round(Math.abs(band.getBoundingClientRect().bottom - pic.bottom)) : -1;
        // Grey side gutters inside the window around the stage (a second letterbox colour).
        const vp = [...document.querySelectorAll('.test-play-modal-backdrop .play-viewport')].filter(vis)[0];
        const vpBg = vp ? getComputedStyle(vp).backgroundColor : ''; const body = tpModal().querySelector('.test-play-modal-body'); const bodyBg = body ? getComputedStyle(body).backgroundColor : '';
        const ps = [...document.querySelectorAll('.test-play-modal-backdrop .play-stage')].filter(vis)[0]; const psr = ps.getBoundingClientRect(); const vr = (vp || body).getBoundingClientRect();
        const gutterPx = Math.round(Math.max(0, psr.left - vr.left) + Math.max(0, vr.right - psr.right));
        // Painted colour of the side gutters is sampled from a screenshot below (computed backgrounds of intermediate layers can hide it).
        const gutters = [{ x: vr.left, w: psr.left - vr.left }, { x: psr.right, w: vr.right - psr.right }].filter((g) => g.w >= 4)
          .map((g) => ({ x: Math.round(g.x + 1), y: Math.round(psr.top + 4), width: Math.max(1, Math.round(g.w - 2)), height: Math.max(1, Math.round(psr.height - 8)) }));
        return { opening: 1, letterboxPx: Math.round(lb), chip: chip ? 1 : 0, chipStraddlesPictureEdge: chipStraddles, bandBottomGapPx, gutterPx, gutters, viewportBg: vpBg, bodyBg };`);
      // A gutter counts as a second (grey) letterbox colour when its painted mean channel value is above near-black.
      const { PNG } = await import('pngjs');
      let greyGutterPx = 0; const gutterMeans = [];
      for (const g of m.gutters ?? []) {
        const png = PNG.sync.read(await page.screenshot({ clip: g, animations: 'disabled' }));
        let sum = 0, n = 0; for (let i = 0; i < png.data.length; i += 4) { sum += (png.data[i] + png.data[i + 1] + png.data[i + 2]) / 3; n++; }
        const mean = Math.round(sum / Math.max(1, n)); gutterMeans.push(mean); if (mean > 24) greyGutterPx += g.width + 2;
      }
      delete m.gutters; m.gutterMeans = gutterMeans; m.greyGutterPx = greyGutterPx;
      return { pass: m.opening === 1 && m.chip === 1 && m.chipStraddlesPictureEdge === 0 && m.bandBottomGapPx >= 0 && m.bandBottomGapPx <= 2 && m.greyGutterPx === 0, measured: m };
    },
  })),

  // ------------------------------------------------------------------ C-96 [P3]
  {
    id: 'C-96',
    surface: 'battleKeys',
    title: 'Enemy target buttons are named after the enemy and their hit areas do not overlap',
    async run(ctx) {
      const { page } = ctx;
      await openBattle(ctx);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(800);
      await shot(page, 'c96-target');
      const m = await pe(page, `${ENEMY_BOXES}
        const names = enemies.map(nameOf); let maxOverlap = 0;
        for (let i = 0; i < enemies.length; i++) for (let j = i + 1; j < enemies.length; j++) maxOverlap = Math.max(maxOverlap, inter(enemies[i].getBoundingClientRect(), enemies[j].getBoundingClientRect()));
        return { enemies: enemies.length, unnamed: names.filter((n) => !n).length, names, maxHitOverlapPx2: Math.round(maxOverlap) };`);
      return { pass: m.enemies >= 2 && m.unnamed === 0 && m.maxHitOverlapPx2 === 0, measured: m };
    },
  },

  // ------------------------------------------------------------------ wave-0 rows owned by L7 (logic copied from devices/wave0.mjs)
  {
    id: 'IS-084',
    surface: 'wave0Play',
    title: 'During test play editor panels are hidden and one strip shows map name and an exit back to the editor',
    async run(ctx) {
      const { page } = ctx;
      await openTestPlay(ctx);
      await toField(ctx);
      const m = await pe(page, `
        const modal = document.querySelector('.test-play-modal-backdrop'); if (!modal) return { modalOpen: 0 };
        const probes = ['.ai-chat-sidebar', '.palette-work-shell', '.oprn-menu-bar', '.left-activity-item'].map((s) => document.querySelector(s)).filter(Boolean);
        let editorHit = 0; for (const p of probes) { const r = p.getBoundingClientRect(); if (r.width < 2) continue; const h = document.elementFromPoint(r.left + r.width / 2, r.top + Math.min(r.height / 2, 20)); if (h && !modal.contains(h)) editorHit++; }
        const strip = modal.querySelector('header, [class*=toolbar], [class*=titlebar], [class*=header]') || modal;
        const exit = [...modal.querySelectorAll('button')].filter(vis).find((b) => /편집/.test(allNames(b)));
        return { modalOpen: 1, editorPanelsHittable: editorHit, stripHasMapName: textOf(strip).includes('빈 맵') ? 1 : 0, stripText: textOf(strip).slice(0, 50), exitFound: exit ? 1 : 0, exitNameSaysReturn: exit && /돌아가기|편집기로/.test(nameOf(exit)) ? 1 : 0, exitName: exit ? nameOf(exit) : '' };`);
      return { pass: m.modalOpen === 1 && m.editorPanelsHittable === 0 && m.stripHasMapName === 1 && m.exitNameSaysReturn === 1, measured: m };
    },
  },
  {
    id: 'C-90',
    surface: 'wave0Play',
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
    surface: 'wave0Play',
    title: 'Escape in test play opens a pause surface (never quits); a second Escape resumes',
    async run({ page }) {
      await pe(page, `const c = document.querySelector('.test-play-modal-backdrop canvas'); c?.focus?.();`);
      const pauseCount = () => pe(page, `const m = document.querySelector('.test-play-modal-backdrop'); if (!m) return { open: 0, pause: 0 }; return { open: vis(m) ? 1 : 0, pause: [...m.querySelectorAll('*')].filter(vis).filter((e) => !e.children.length && /일시정지|일시 정지|paused|계속하기/i.test(textOf(e))).length };`);
      const before = await pauseCount();
      await page.keyboard.press('Escape');
      await page.waitForTimeout(900);
      const first = await pauseCount();
      await shot(page, 'is085-first');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(900);
      const second = await pauseCount();
      const m = { openBefore: before.open, openAfterFirstEscape: first.open, pauseLabelsAfterFirstEscape: first.pause, openAfterSecondEscape: second.open, pauseLabelsAfterSecondEscape: second.pause, blurPauseChecked: 0 };
      return { pass: m.openAfterFirstEscape === 1 && m.pauseLabelsAfterFirstEscape >= 1 && m.openAfterSecondEscape === 1 && m.pauseLabelsAfterSecondEscape === 0, measured: m };
    },
  },
];
