// Extra genuine Ask sends after the original resumed-run terminal capture.
// No model script, session option, outcome or DOM content is injected.
import assert from 'node:assert/strict';
import { firefox } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { basename, resolve } from 'node:path';
const out = resolve(process.env.EVIDENCE_DIR);
const instrumentPath = 'test/aiContinueNegativeSurface.mjs';
const instrumentHash = createHash('sha256').update(await readFile(instrumentPath)).digest('hex');
let exercised = false;
const observations = [];
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
      const observe = () => page.evaluate(async () => {
        await qa.nextRender();
        const live = qa.store.getCurrent();
        return { composerMode: document.querySelector('[data-testid="ai-composer-mode"]').dataset.mode,
          actualOptions: qa.turnOptions, outcome: qa.session.getRunOutcome(),
          work: qa.session.getWorkPlan().layers.flatMap(layer => layer.items).map(item => ({ id: item.id, status: item.status })),
          acceptance: qa.session.getAcceptanceSnapshot(), events: live.maps[live.startMapId].events,
          ui: [...document.querySelectorAll('[data-testid="ai-run-outcome"]')].map(node => ({ ...node.dataset })) };
      });
      page.screenshot = async options => {
        const result = await screenshot(options);
        if (exercised || basename(options.path) !== 'blocked-user-resume-settled.png') return result;
        exercised = true;
        await page.getByTestId('ai-composer-mode-ask').click();
        const before = await observe();
        assert.equal(before.composerMode, 'ask');
        // Subscribe before the genuine composer send; no sleeps or polling.
        await page.evaluate(() => {
          qa.negativeSettled = new Promise((resolve, reject) => {
            const send = document.querySelector('[data-testid="ai-send"]');
            let busy = false;
            const timer = setTimeout(() => { observer.disconnect(); reject(new Error('Negative Ask settle deadline')); }, 60000);
            const observer = new MutationObserver(() => {
              if (send.disabled) busy = true;
              if (busy && !send.disabled) { clearTimeout(timer); observer.disconnect(); resolve(); }
            });
            observer.observe(send, { attributes: true, attributeFilter: ['disabled'] });
            qa.disposers.push(() => { clearTimeout(timer); observer.disconnect(); resolve(); });
          });
          void qa.negativeSettled.catch(() => {});
        });
        await page.getByTestId('ai-input').fill('계속');
        await page.getByTestId('ai-send').click();
        await page.evaluate(() => qa.negativeSettled);
        const typed = await observe();
        observations.push({ entry: 'typed-composer', before, after: typed });
        await screenshot({ path: `${out}/negative-typed-ask.png` });
        await page.evaluate(() => window.__oprnAiBridge.send('계속'));
        const bridge = await observe();
        observations.push({ entry: 'registered-bridge', before: typed, after: bridge });
        await screenshot({ path: `${out}/negative-bridge-ask.png` });
        await writeFile(`${out}/negative-user-actions.json`, JSON.stringify({ instrumentPath, instrumentHash, observations }, null, 2));
        for (const item of observations) {
          assert.equal(item.after.composerMode, 'ask');
          assert.equal(item.after.actualOptions.composerMode, 'ask');
          assert.deepEqual(item.after.work, before.work);
          const authority = snapshot => ({ id: snapshot.id, status: snapshot.status,
            items: snapshot.items.map(item => ({ id: item.id, status: item.status, mapId: item.mapId,
              requestId: item.source?.requestId, passed: item.evidence.map(entry => entry.passed) })) });
          assert.deepEqual(authority(item.after.acceptance), authority(before.acceptance));
          assert.deepEqual(item.after.events, []);
          assert.deepEqual(item.after.outcome, { execution: 'response-final', goal: 'incomplete', delivery: 'no-change' });
        }
        return result;
      };
      return page;
    };
    return context;
  };
  return browser;
};
await import('./aiOutcomeBrowserEvidence.mjs');
assert.equal(exercised, true);
assert.equal(createHash('sha256').update(await readFile(instrumentPath)).digest('hex'), instrumentHash);
const report = JSON.parse(await readFile(`${out}/actions.json`, 'utf8'));
assert.equal(report.pass, true);
await writeFile(`${out}/negative-user-actions-pass.json`, JSON.stringify({ pass: true, count: observations.length,
  originalScenarioPass: report.pass, checks: report.contractChecks.length, cleanup: report.cleanup }, null, 2));
