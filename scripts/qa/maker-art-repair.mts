// Synthetic provider exercises production orchestration, not aesthetic quality.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { runPiTeam } from '../lib/piTeamRuntime';
import { defaultTeamSpec } from '../../src/ai/piAgent/teamSpec';
import { ROMANCE_ART_AXES } from '../../src/harnesses/romance-scene/artDirection';
import type { PiAgentDoneEvent } from '../../src/ai/piAgent/protocol';

const [fixture, output] = process.argv.slice(2);
const project = JSON.parse(fs.readFileSync(fixture!, 'utf8'));
const stats = { ms: 1, turns: 1, toolCalls: 0, toolErrors: 0 };
const cases = [];
for (const name of ['repair-pass', 'budget-exhausted', 'read-only', 'follow-up', 'yolo', 'cancel', 'invalid-repair', 'locked-review']) {
  let reviews = 0, writes = 0, finalAudits = 0, finished = false, rejected = false;
  const snapshots: number[] = [];
  let unblockReview: (() => void) | undefined;
  const controller = new AbortController();
  const events: any[] = [];
  try {
    await runPiTeam({ mode: 'team', provider: 'synthetic',
      task: name === 'follow-up' ? '읽기 전용 미술 검수' : '장르 프리셋: 관계·연애\n첫 제작',
      project, mapIds: [project.startMapId], team: defaultTeamSpec(),
      ...(name === 'read-only' ? { readOnly: true } : {}),
      ...(name === 'yolo' ? { applyMode: 'yolo' } : {}),
    }, { signal: controller.signal, onEvent: e => events.push(e), runAgent: async (r, options) => {
      const done: PiAgentDoneEvent = { type: 'done', project: r.project, stats, changedKeys: [] };
      const tool = (id: string) => options.extraTools!.find(t => t.name === id)!;
      if (options.extraTools?.some(t => t.name === 'report_review')) {
        reviews++;
        if (name === "locked-review" && reviews === 1) await new Promise<void>(resolve => { unblockReview = resolve; });
        snapshots.push(Number(r.project.maps[r.project.startMapId].defaultLighting?.ambient === 0.123));
        options.onEvent?.({ type: 'execution_status', name: 'map.image.delivered', ok: true, summary: 'Synthetic receipt only' });
        const passed = name === 'yolo' || (name !== 'budget-exhausted' && reviews > 1);
        await tool('report_review').execute('review', { ok: passed,
          findings: passed ? [] : ['(1,8)에서 길이 화면 바깥으로 연결되지 않습니다.'],
          artChecks: ROMANCE_ART_AXES.map(axis => ({ axis, passed, evidence: 'Synthetic observation at (1,8) and (12,8); does not certify live art.' })),
        });
        if (name === 'cancel') controller.abort();
        return done;
      }
      if (options.extraTools?.some(t => t.name === 'report_task')) { finalAudits++; await tool('report_task').execute('task', {report:'Synthetic final read-only report'}); return done; }
      if (!options.extraTools?.some(t => t.name === 'review_map')) {
        writes++;
        assert(r.task.includes('반려 근거:'));
        assert(r.task.includes('작성된 대화'));
        const map = r.project.maps[r.project.startMapId];
        // Deliberately invalid edit must be caught even when the next reviewer passes.
        const nextMap = name === 'invalid-repair' ? { ...map, events: [] } : { ...map, defaultLighting: { ...map.defaultLighting, ambient: 0.123 } };
        return { ...done, project: { ...r.project, maps: { ...r.project.maps, [map.id]: nextMap } }, changedKeys: ['maps'] };
      }
      if (name === 'read-only') {
        await assert.rejects(() => tool('assign_map_agent').execute('blocked', { mapId: project.startMapId, task: 'write' }), /읽기 전용/);
      }
      const pendingReview = tool('review_map').execute('review', { mapId: project.startMapId });
      if (name === 'locked-review') {
        try {
        await assert.rejects(() => tool('assign_map_agent').execute('locked-write', {mapId:project.startMapId,task:'write'}), /검수·자동 수정/);
        await assert.rejects(() => tool('review_map').execute('duplicate', {mapId:project.startMapId}), /이미 진행 중/);
        await assert.rejects(() => tool('finish').execute('too-early', {report:'done'}), /검수·자동 수정/);
        await assert.rejects(() => tool('assign_task_agent').execute('project-write', {task:'write',mode:'project'}), /검수·자동 수정/);
        } finally { unblockReview?.(); }
      }
      const result = await pendingReview;
      assert(result.content[0].text.includes('automaticRepairs'));
      try { await tool('finish').execute('finish', { report: 'Synthetic completion' }); finished = true; } catch { rejected = true; }
      return done;
    } });
  } catch (error) {
    if (!['budget-exhausted', 'read-only', 'follow-up', 'cancel', 'invalid-repair'].includes(name)) throw error;
    rejected = true;
  }
  if (name === 'repair-pass' || name === 'locked-review') { assert.equal(writes, 1); assert.equal(reviews, 2); assert(finished); assert.deepEqual(snapshots, [0, 1]); }
  if (name === 'budget-exhausted') { assert.equal(writes, 2); assert.equal(reviews, 3); assert(!finished && rejected); }
  if (['read-only', 'follow-up', 'cancel'].includes(name)) { assert.equal(writes, 0); assert(!finished && rejected); }
  if (name === 'yolo') { assert.equal(reviews, 1); assert.equal(writes, 0); assert(finished); }
  if (name === 'invalid-repair') { assert.equal(writes, 1); assert.equal(reviews, 1); assert(!finished && rejected); }
  if (['repair-pass','yolo','locked-review'].includes(name)) assert.equal(finalAudits, 0, 'Verified first build must emit done without another narrative audit');
  cases.push({ name, reviews, writes, finalAudits, finished, rejected,
    fixes: events.filter(e => e.type === 'agent_spawn' && e.fixOf).map(e => ({ agentId: e.agentId, fixOf: e.fixOf })) });
}
fs.writeFileSync(output!, JSON.stringify({ synthetic: true, cases }, null, 2));
console.log(JSON.stringify(cases));
