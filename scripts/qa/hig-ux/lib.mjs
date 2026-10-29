// Shared browser plumbing for the hig-ux visual QA devices.
// Ported from the HIG audit capture harness: fresh isolated context per surface,
// ?freshProject=1&aiBridge=0&lang=<l>, visible-element resolution by aria-label then
// text (exact, then startsWith), up to 25 s wait for a target, overflow-button fallback.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(HERE, '../../..');
export const DEFAULT_QUERY = 'freshProject=1&aiBridge=0';
export const TARGET_WAIT_MS = 25_000;
export const READY_SELECTOR = 'button[aria-label="자료집"],button[aria-label="Database"]';
const OVERFLOW_LABEL = '도구 더 보기';
const LOCALES = { ko: 'ko-KR', en: 'en-US', ja: 'ja-JP', zh: 'zh-CN' };

const catalogs = new Map();
const normalize = (s) => String(s).replace(/[\s\u00a0]+/g, ' ').trim();

/** Translate a Korean source string through the shipped catalog (keys are Korean source strings). */
export function tr(lang, ko) {
  if (lang === 'ko') return ko;
  if (!catalogs.has(lang)) {
    const file = path.join(REPO_ROOT, 'src/i18n/catalogs', `${lang}.json`);
    catalogs.set(lang, fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {});
  }
  const catalog = catalogs.get(lang);
  if (catalog[ko]) return catalog[ko];
  const key = Object.keys(catalog).find((k) => normalize(k) === normalize(ko));
  return key ? catalog[key] : ko;
}

export async function launchBrowser({ headed = false } = {}) {
  return chromium.launch({ headless: !headed, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
}

export function surfaceKey(s) {
  return `${s.id}__${s.width}x${s.height}${s.dsf && s.dsf !== 1 ? `@${s.dsf}x` : ''}__${s.lang}`;
}

export function editorUrl(baseUrl, { lang = 'ko', query = DEFAULT_QUERY } = {}) {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return `${base}?${query}&lang=${lang}`;
}

/**
 * Open the editor (or any page) in a fresh isolated browser context.
 * surface: {width, height, lang, dsf, query, readySelector, settleMs}
 * Returns {ctx, page, log} where log collects page errors and step errors.
 */
export async function openSurface(browser, baseUrl, surface = {}) {
  const { width = 1440, height = 900, lang = 'ko', dsf = 1, query = DEFAULT_QUERY } = surface;
  const ctx = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: dsf,
    locale: LOCALES[lang] ?? 'ko-KR',
  });
  const page = await ctx.newPage();
  const log = { pageErrors: [], consoleErrors: [], stepErrors: [], viaOverflow: [] };
  page.on('pageerror', (e) => log.pageErrors.push(String(e).slice(0, 200)));
  page.on('console', (m) => {
    if (m.type() === 'error') log.consoleErrors.push(m.text().slice(0, 200));
  });
  await page.goto(editorUrl(baseUrl, { lang, query }), { waitUntil: 'load', timeout: 120_000 });
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
  await page.waitForSelector(surface.readySelector ?? READY_SELECTOR, { timeout: 60_000 });
  await page.waitForTimeout(surface.settleMs ?? 2500);
  return { ctx, page, log };
}

/**
 * Center point of the smallest visible element matching value.
 * kind 'aria': exact aria-label, else aria-label startsWith; kind 'text': exact innerText, else startsWith.
 */
export async function findPoint(page, kind, value, tag = null) {
  return page.evaluate(
    ({ kind, value, tag }) => {
      const nv = (s) => String(s).replace(/[\s\u00a0]+/g, ' ').trim();
      const vis = (el) => {
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) return false;
        const s = getComputedStyle(el);
        return (
          s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.02 &&
          r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth
        );
      };
      const want = nv(value);
      const pool =
        kind === 'aria'
          ? [...document.querySelectorAll('[aria-label]')].map((e) => [e, nv(e.getAttribute('aria-label'))])
          : [...document.querySelectorAll('button,[role=button],[role=tab],[role=menuitem],[role=option],a,li,summary,label,div,span')].map(
              (e) => [e, nv(e.innerText || '')],
            );
      let els = pool.filter(([e, n]) => n === want && vis(e)).map(([e]) => e);
      if (!els.length && want) els = pool.filter(([e, n]) => n && n.startsWith(want) && vis(e)).map(([e]) => e);
      if (!els.length) return null;
      const area = (e) => {
        const r = e.getBoundingClientRect();
        return r.width * r.height;
      };
      els.sort((a, b) => area(a) - area(b));
      if (tag) {
        for (const old of document.querySelectorAll(`[data-hig-target="${tag}"]`)) old.removeAttribute('data-hig-target');
        els[0].setAttribute('data-hig-target', tag);
      }
      const r = els[0].getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    },
    { kind, value, tag },
  );
}

async function pollPoint(page, kinds, value, ms, tag) {
  const until = Date.now() + ms;
  for (;;) {
    for (const k of kinds) {
      const p = await findPoint(page, k, value, tag);
      if (p) return p;
    }
    if (Date.now() >= until) return null;
    await page.waitForTimeout(250);
  }
}

/**
 * Resolve a control by accessible name (aria-label first, then visible text) waiting up to 25 s;
 * if it is not visible, open the canvas overflow ("도구 더 보기") and look again.
 */
export async function locateTarget(page, value, { lang = 'ko', timeoutMs = TARGET_WAIT_MS, log, tag = null } = {}) {
  let p = await pollPoint(page, ['aria', 'text'], value, Math.min(7000, timeoutMs), tag);
  if (!p) {
    const ov = await findPoint(page, 'aria', tr(lang, OVERFLOW_LABEL));
    if (ov) {
      await page.mouse.click(ov.x, ov.y);
      log?.viaOverflow.push(value);
      await page.waitForTimeout(600);
    }
    p = await pollPoint(page, ['text', 'aria'], value, Math.max(0, timeoutMs - 7000), tag);
  }
  if (!p) throw new Error(`no visible element "${value}" after ${Math.round(timeoutMs / 1000)}s`);
  return p;
}

/** Resolve a control (see locateTarget), mark it data-hig-target=<tag> and return its selector. */
export async function tagTarget(page, value, tag, opts = {}) {
  await locateTarget(page, value, { ...opts, tag });
  return `[data-hig-target="${tag}"]`;
}

/** Run capture steps: aria:<label> | text:<label> | key:<Key> | hover:<label> | wait:<ms>. Labels are translated. */
export async function runSteps(page, steps = [], { lang = 'ko', log } = {}) {
  for (const st of steps) {
    const [k, ...rest] = st.split(':');
    const v = tr(lang, rest.join(':'));
    try {
      if (k === 'aria' || k === 'text') {
        const p = await locateTarget(page, v, { lang, log });
        await page.mouse.click(p.x, p.y);
      } else if (k === 'key') {
        await page.keyboard.press(v);
      } else if (k === 'hover') {
        const p = await locateTarget(page, v, { lang, log });
        await page.mouse.move(p.x, p.y);
        await page.waitForTimeout(1600);
      } else if (k === 'wait') {
        await page.waitForTimeout(Number(v));
      } else {
        throw new Error(`unknown step kind ${k}`);
      }
    } catch (e) {
      const msg = `${st} => ${String(e.message).split('\n')[0].slice(0, 160)}`;
      if (log) log.stepErrors.push(msg);
      else throw new Error(msg);
    }
    await page.waitForTimeout(500);
  }
}

export function parseArgs(argv, spec) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) throw new Error(`unexpected argument ${a}`);
    const [k, inline] = a.slice(2).split('=');
    if (!(k in spec)) throw new Error(`unknown option --${k}`);
    if (spec[k] === 'bool') out[k] = true;
    else out[k] = inline ?? argv[++i];
  }
  return out;
}

export function writeJson(file, data) {
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(data, null, 1)}\n`);
}
