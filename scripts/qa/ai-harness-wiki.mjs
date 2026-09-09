import assert from 'node:assert/strict';
import { p2Observations } from './ai-harness-p2-observe.mjs';

/** Script only extraction and the failing project-save HTTP response, never owner outcomes. */
export function createWikiContracts(harness) {
  const { page, report, record, projectId } = harness;
  const observations = p2Observations(harness);
  let savingWiki = false;
  let extractions = 0;
  let saveFaults = 0;
  const wikiId = 'w_native_r3_contact';
  return {
    extract(body) {
      const payload = JSON.parse(body.messages.at(-1).content);
      assert.ok(payload.sources.length > 0);
      extractions++;
      savingWiki = true;
      record('wiki-extraction-transport', { sourceIds: payload.sources.map(source => source.id), wikiId });
      return { role: 'assistant', content: JSON.stringify({ upserts: [{
        id: wikiId, type: 'guideline', name: 'Contact combat', summary: 'Visible monsters start contact battles.',
        wiki: { kind: 'declaration', basis: 'explicit', combatMode: 'contact', sourceIds: payload.sources.map(source => source.id) },
      }] }) };
    },
    async intercept(route, entry) {
      if (!savingWiki || entry.table !== 'projects' || !['POST', 'PATCH'].includes(entry.method)) return false;
      saveFaults++;
      record('wiki-save-transport-fault', { ...entry, status: 503, remoteOutage: false });
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ code: 'QA_WIKI_SAVE', message: 'Run-owned wiki checkpoint transport fault' }) });
      return true;
    },
    async run() {
      const baseline = await page.evaluate(async () => {
        const saved = await qa.store.flush();
        if (saved.kind !== 'saved' || !saved.receipt) throw new Error('Native fixture lacks a real accepted baseline');
        return saved.receipt;
      });
      report.wikiBaseline = baseline;
      await harness.observeRemote('wiki-before');
      await page.getByTestId('ai-composer-mode-do').click();
      const instruction = `${projectId}: Use contact battles with visible monsters throughout this game.`;
      await observations.armActivity(instruction);
      await harness.send(instruction);
      await harness.settled();
      await page.evaluate(() => qa.activityDone);
      const observed = await observations.capture('wiki-checkpoint-failed');
      const expected = { execution: 'failed', goal: 'unassessed', delivery: 'applied' };
      observations.agreement({ id: 'wiki-checkpoint-failed', expected }, observed);
      const world = await page.evaluate(() => qa.store.getCurrent().world);
      report.wikiWorld = world;
      observations.check('actual default coordinator applied the extracted guideline', () => {
        assert.equal(world.entities.find(entity => entity.id === wikiId)?.wiki.combatMode, 'contact');
        assert.equal(world.entities.find(entity => entity.id === wikiId)?.wiki.sources[0].text, instruction);
      });
      observations.check('wiki failure retains dirty local state with no synthetic tools', () => {
        assert.equal(observed.live.dirty, true);
        assert.equal(observed.result.stoppedReason, 'error');
        assert.deepEqual(observed.result.proposedCalls, []);
        assert.deepEqual(observed.result.appliedCalls, []);
        assert.equal(observed.events.filter(event => event.type === 'tool_call').length, 0);
        assert.equal(extractions, 1);
        assert.ok(saveFaults > 0);
      });
      const remote = await harness.observeRemote('wiki-after-failed-checkpoint');
      observations.check('failed checkpoint did not persist the wiki', () => {
        assert.equal(remote.row.current_json.world?.entities?.some(entity => entity.id === wikiId) ?? false, false);
        assert.equal(remote.observedIdentity, baseline.contentIdentity);
      });
      assert.deepEqual(report.errors, []);
      assert.equal(report.contractChecks.filter(check => !check.pass).length, 0, 'Native wiki outcome contracts failed');
      report.assertionsPassed = true;
      record('PASS', { scenario: 'wiki-delivery', extractions, saveFaults });
    },
  };
}
