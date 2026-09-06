// Read-only UI instrumentation around the unchanged real P2 harness.
// No session facts, transport scripts, tools, DOM content or outcomes are injected.
import { firefox } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { resolve, basename } from 'node:path';

const out = resolve(process.env.EVIDENCE_DIR);
const sourcePaths = ['DESIGN.md', 'src/editor/panels/aiChatPanel.ts', 'src/editor/panels/aiChatRenderers.ts',
  'src/editor/panels/aiStickyChecklist.ts', 'src/styles/database/assistant-sticky-checklist.css',
  'src/styles/database/tabs-b-assistant-panel/19-assistant-cards.css', 'test/aiOutcomePresentation.test.ts',
  'test/aiAutonomousRunSurface.test.ts', 'test/aiContinueUserAction.test.ts', 'test/aiOutcomeBrowserEvidence.mjs'];
const sourceHashes = async () => Object.fromEntries(await Promise.all(sourcePaths.map(async path =>
  [path, createHash('sha256').update(await readFile(path)).digest('hex')])));
const identity = { head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  branch: execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim(),
  hashes: await sourceHashes() };
await mkdir(out, { recursive: true });
await writeFile(`${out}/ui-source-identity.json`, JSON.stringify(identity, null, 2));
const measurements = [];
const launch = firefox.launch.bind(firefox);
firefox.launch = async options => {
  const browser = await launch(options);
  const newContext = browser.newContext.bind(browser);
  browser.newContext = async options => {
    const context = await newContext(options);
    const newPage = context.newPage.bind(context);
    context.newPage = async () => {
      const page = await newPage();
      const screenshot = page.screenshot.bind(page);
      page.screenshot = async options => {
        const label = basename(options.path, '.png');
        const viewport = page.viewportSize();
        try {
          for (const size of [{ width: 1024, height: 768 }, { width: 1280, height: 800 }, { width: 1440, height: 900 }]) {
            await page.setViewportSize(size);
            const state = await page.evaluate(async () => {
              await new Promise((resolve, reject) => {
                const timer = setTimeout(() => reject(new Error('UI frame deadline')), 10000);
                requestAnimationFrame(() => requestAnimationFrame(() => { clearTimeout(timer); resolve(); }));
              });
              const selectors = ['ai-run-outcome', 'ai-sticky-checklist', 'ai-requirement-withdraw', 'ai-continue-run'];
              const nodes = selectors.flatMap(testid => [...document.querySelectorAll(`[data-testid="${testid}"]`)].map(node => {
                const rect = node.getBoundingClientRect();
                const style = getComputedStyle(node);
                let visibleWidth = rect.width, visibleHeight = rect.height;
                for (let ancestor = node.parentElement; ancestor; ancestor = ancestor.parentElement) {
                  const parentStyle = getComputedStyle(ancestor), parent = ancestor.getBoundingClientRect();
                  if (parentStyle.overflowX !== 'visible') visibleWidth = Math.min(visibleWidth, Math.max(0, Math.min(rect.right, parent.right) - Math.max(rect.left, parent.left)));
                  if (parentStyle.overflowY !== 'visible') visibleHeight = Math.min(visibleHeight, Math.max(0, Math.min(rect.bottom, parent.bottom) - Math.max(rect.top, parent.top)));
                }
                return { testid, attributes: { ...node.dataset }, text: node.textContent, hidden: node.hidden,
                  visible: rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && visibleWidth > 0 && visibleHeight > 0,
                  rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom },
                  visibleWidth, visibleHeight, clientWidth: node.clientWidth, scrollWidth: node.scrollWidth,
                  color: style.color, fontSize: style.fontSize, disabled: node.disabled ?? null };
              }));
              return { viewport: { width: innerWidth, height: innerHeight }, documentWidth: document.documentElement.scrollWidth, nodes };
            });
            measurements.push({ label, ...state });
            await screenshot({ ...options, path: `${out}/${label}-${size.width}.png` });
          }
        } finally {
          await page.setViewportSize(viewport);
          await writeFile(`${out}/ui-dom.json`, JSON.stringify(measurements, null, 2));
        }
        return screenshot(options);
      };
      return page;
    };
    return context;
  };
  return browser;
};
await import('../scripts/qa/ai-harness-contracts.mjs');
assert.deepEqual(await sourceHashes(), identity.hashes, 'UI source changed during capture');
await writeFile(`${out}/ui-source-stable.json`, JSON.stringify({ stable: true, ...identity }, null, 2));
