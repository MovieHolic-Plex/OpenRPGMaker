import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { createServer } from '/home/main/z-project/rpg-zzu-ai-harness-p1-r1-commit-20260906/node_modules/vite/dist/node/index.js';

// Review-only executable probes. Actual session/apply/store/sync; only HTTP is fake.
const root = '/home/main/z-project/rpg-zzu-ai-harness-p1-r1-commit-20260906';
const projectId = 'p1-review-boundary-fixture';
const report = { sha: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  tree: execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { cwd: root, encoding: 'utf8' }).trim(),
  transport: 'deterministic HTTP only; no real remote or product edits', scenarios: [], requests: [], cleanup: {} };
const originalFetch = globalThis.fetch;
const originalWindow = globalThis.window;
let store, activity, vault, patchGate, row, unsubscribe;
const pending = new Set();
const committed = new Map();
const server = await createServer({ root, configFile: false, envDir: false,
  cacheDir: '/home/main/z-project/rpg-zzu-ai-harness-p1-r1-commit-20260906/output/evidence/ai-harness/p1/r1-002-cache',
  resolve: { alias: { '@': `${root}/src` } },
  define: Object.fromEntries(Object.entries({ VITE_SUPABASE_URL: 'http://p1-review.invalid', VITE_SUPABASE_ANON_KEY: 'test-anon-key',
    VITE_SUPABASE_PROJECT_ID: projectId, VITE_SUPABASE_USE_PROXY: '0', VITE_EDIT_ACTIVITY_DISK_MIRROR: '0' })
    .map(([k, v]) => [`import.meta.env.${k}`, JSON.stringify(v)])),
  server: { middlewareMode: true, hmr: false, watch: null },
});
async function bounded(promise, label) {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`Deadline: ${label}`)), 60000); })]); }
  finally { clearTimeout(timer); }
}
function track(promise) { pending.add(promise); promise.then(() => pending.delete(promise), () => pending.delete(promise)); return promise; }
const config = { authMode: 'apiKey', agentMode: 'chat', baseUrl: 'x', model: 'test', apiKey: 'test', maxTokens: 1024, maxToolCalls: 10 };
const savedAudits = s => s.getAuditEntries().filter(e => e.kind === 'status' && e.text.split(' ')[0] === 'agent_run_saved');
try {
  globalThis.window = { location: { hostname: '127.0.0.1', pathname: '/', search: '' },
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} } };
  globalThis.fetch = (input, init) => track((async () => {
    const url = new URL(String(input));
    assert.equal(url.hostname, 'p1-review.invalid');
    const method = init?.method ?? 'GET';
    report.requests.push({ path: url.pathname, query: url.search, method });
    if (url.pathname === '/rest/v1/projects') {
      if (method !== 'GET') {
        const submitted = JSON.parse(String(init.body));
        if (patchGate && method === 'PATCH') {
          const gate = patchGate; patchGate = undefined;
          gate.started.resolve(); await bounded(gate.release.promise, 'held save response');
        }
        // Preserve the real map-patch compare-and-swap contract, including after the gate.
        if (method === 'PATCH') {
          const expectedSha = url.searchParams.get('current_sha256');
          if (expectedSha && expectedSha !== `eq.${row?.current_sha256}`) return Response.json([]);
        }
        row = submitted;
        return Response.json(method === 'PATCH' ? [row] : []);
      }
      return Response.json(row ? [row] : []);
    }
    if (url.pathname === '/rest/v1/project_commits' && method === 'POST') {
      const body = JSON.parse(String(init.body)); committed.set(body[0].commit_id, body[0]);
    }
    if (['/rest/v1/maps', '/rest/v1/tilesets', '/rest/v1/project_commits', '/rest/v1/project_changes'].includes(url.pathname)) return Response.json([]);
    throw new Error(`Unexpected ${method} ${url.pathname}`);
  })());
  const modules = await Promise.all([server.ssrLoadModule('/src/project/store.ts'), server.ssrLoadModule('/src/ai/assistantSession.ts'),
    server.ssrLoadModule('/src/editor/tools/applyChangesetToStore.ts'), server.ssrLoadModule('/src/project/io.ts'),
    server.ssrLoadModule('/src/project/eventDrafts.ts'), server.ssrLoadModule('/src/editor/editActivityLog.ts'), server.ssrLoadModule('/src/project/eventDraftVault.ts')]);
  [{ store }, , , , , activity, vault] = modules;
  const [, { AssistantSession }, { applyProposedProject }, io, drafts] = modules;
  const identity = p => createHash('sha256').update(io.serializeForComparison(drafts.projectWithoutEventDrafts(p))).digest('hex');
  const session = () => new AssistantSession(store.getCurrent(), { config, chat: async () => { throw new Error('No LLM allowed in proof probe'); }, yieldToUi: async () => {} });

  // Normalize once through the actual loader, before introducing the save/reload race.
  store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: true, disabledReason: null });
  store.update(draft => { draft.meta.title = 'before-pending-save'; });
  assert.equal((await bounded(store.flush(), 'initial save')).kind, 'saved');
  assert.equal((await bounded(store.reloadFromRemote({ force: true }), 'initial normalization')).kind, 'reloaded');
  // A synchronous store subscriber edits after replace has applied but before it returns.
  const s2 = session();
  const proposed = structuredClone(store.getCurrent());
  proposed.meta.title = 'actual-ai-apply';
  let subscriberRan = false;
  unsubscribe = store.subscribe((_project, change) => {
    if (subscriberRan || change.origin !== 'ai') return;
    subscriberRan = true;
    store.update(draft => { draft.meta.title = 'subscriber-edit-not-in-ai-commit'; });
  });
  const applied = await bounded(applyProposedProject(proposed, { source: 'agent', summary: 'review callback boundary', toolNames: ['set_title_screen'] }), 'actual apply');
  unsubscribe(); unsubscribe = undefined;
  assert.equal(applied.ok, true);
  assert.equal(subscriberRan, true);
  assert.ok(committed.has(applied.commit.commitId));
  s2.recordAppliedProject(applied);
  const proof2 = await bounded(s2.proveAppliedRevision(), 'proof after subscriber');
  const commitObservation = { name: 'synchronous-store-subscriber-during-apply', result: proof2, actualCommitId: applied.commit.commitId,
    committedProjectTitle: proposed.meta.title, appliedCaptureTitle: applied.commitProject.meta.title, liveTitle: store.getCurrent().meta.title,
    proofReusesApplyCommit: proof2.commitId === applied.commit.commitId,
    recordedCommitWireHash: committed.get(applied.commit.commitId).current_sha256,
    actualApplyWireHash: createHash('sha256').update(io.serialize(drafts.projectWithoutEventDrafts(proposed))).digest('hex') };
  assert.equal(commitObservation.recordedCommitWireHash, commitObservation.actualApplyWireHash);
  report.scenarios.push(commitObservation);
  console.log(JSON.stringify(commitObservation));

  report.completed = true;
  const checks = [
    ['P1-R1-002', () => assert.equal(proof2.commitId, null, 'A synchronous later edit must not borrow the AI apply commit')],
  ];
  report.contractFailures = [];
  for (const [id, check] of checks) {
    try { check(); }
    catch (error) {
      report.contractFailures.push({ id, expected: error.expected, actual: error.actual, message: error.message });
      console.error(`${id}\n${error.stack}`);
    }
  }
  if (report.contractFailures.length) throw new AggregateError(report.contractFailures, 'P1 contract regression probes failed');
} catch (error) {
  report.failure = String(error.stack ?? error); process.exitCode = 1;
  console.error(report.failure);
} finally {
  patchGate?.release.resolve(); unsubscribe?.();
  if (store) { store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: false, disabledReason: null }); await store.flush(); }
  activity?._resetEditActivityForTest(); vault?._resetEventDraftVaultForTest();
  await bounded(Promise.allSettled([...pending]), 'transport cleanup');
  await server.close();
  globalThis.fetch = originalFetch;
  if (originalWindow === undefined) delete globalThis.window; else globalThis.window = originalWindow;
  report.cleanup = { serverClosed: true, listenerStarted: false, timersCleared: true, globalsRestored: true, pendingTransports: pending.size, realRemoteWrites: 0 };
  await writeFile(new URL('./r1-002-api-probe.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
}
