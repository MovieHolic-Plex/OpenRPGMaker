import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { openAiJobsService } from '../scripts/lib/aiJobs/service.mjs';

const root = resolve(import.meta.dirname, '..');
const evidence = join(root, '.omo/evidence/ai-job-queue/task-5');
const temporary = await mkdtemp(join(tmpdir(), 'ai-job-task5-browser-'));
const origin = 'http://127.0.0.1:19841';
let server, service, browser;
const errors = [];
try {
  service = await openAiJobsService({ directory: join(temporary, 'jobs'), origins: [origin], onError: e => errors.push(e),
    executeJob: async (input, host) => {
      const base = await host.readJson(input.projectSnapshot);
      const result = { version: 1, family: input.family, jobId: host.jobId, attemptId: host.attemptId, project: input.project,
        baseSnapshot: input.projectSnapshot, generatedSnapshot: null, artifacts: [], payload: {} };
      if (input.family === 'database') {
        base.meta.title = 'Applied from immutable browser job';
        result.generatedSnapshot = await host.putJson(base);
      } else if (input.family === 'assistant') {
        result.generatedSnapshot = await host.putJson(base);
      } else if (input.family === 'event-commands') {
        const proposal = await host.putJson({ version: 1, project: input.project, target: input.target, baseCommands: input.payload.baseCommands,
          finalCommands: [{ kind: 'text', body: 'Reviewed delayed command' }] });
        result.artifacts = [proposal]; result.payload = { proposalRef: proposal };
      } else throw new Error('Unexpected QA family');
      return result;
    },
  });
  server = await createServer({ root, configFile: false, envFile: false, envDir: false, cacheDir: join(temporary, 'vite-cache'),
    resolve: { alias: { '@': join(root, 'src') } }, server: { host: '127.0.0.1', port: 19841, strictPort: true },
    plugins: [{ name: 'task5-actual-application-surface', configureServer(vite) {
      vite.middlewares.use(service.handler);
      vite.middlewares.use('/__oprn/edit-activity', (req, res) => { req.resume(); req.on('end', () => { res.statusCode = 204; res.end(); }); });
      vite.middlewares.use('/task5', (_req, res) => { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><html><head><title>Task 5 application proof</title><link rel="stylesheet" href="/src/styles/index.css"></head><body><main id="proof"></main></body></html>'); });
    } }],
  });
  await server.listen();
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 900 } });
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  const transportFailure = Promise.withResolvers();
  await context.route('**/*', route => (async () => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== origin) throw new Error(`Foreign QA request: ${url}`);
    if (url.pathname.startsWith('/api/ai-jobs') || url.pathname === '/__oprn/edit-activity') return route.continue();
    if (request.method() !== 'GET') throw new Error(`Non-GET static QA request: ${url}`);
    if (url.pathname === '/@vite/client') return route.fulfill({ contentType: 'text/javascript', body: '' });
    const response = await route.fetch({ maxRedirects: 0, maxRetries: 1 });
    await route.fulfill({ response });
  })().catch(e => transportFailure.resolve(e)));
  await context.routeWebSocket('**/*', socket => socket.close());
  const guarded = async promise => {
    const result = await Promise.race([promise.then(value => ({ value })), transportFailure.promise.then(error => ({ error }))]);
    if (result.error) throw result.error; return result.value;
  };
  const first = await context.newPage(), second = await context.newPage();
  for (const page of [first, second]) page.on('pageerror', e => errors.push(e));
  const boot = async page => {
    await guarded(page.goto(`${origin}/task5?devProject=1`, { waitUntil: 'domcontentloaded' }));
    await guarded(page.evaluate(async () => {
      const [{ store, setDevProjectFactory }, { createBlankProject }, application, history, drafts, dialog, toolbar] = await Promise.all([
        import('/src/project/store.ts'), import('/src/project/defaults.ts'), import('/src/editor/aiJobs/applyJobResult.ts'),
        import('/src/editor/mapEditHistory.ts'), import('/src/editor/aiJobs/draftOwners.ts'),
        import('/src/editor/panels/eventEditor/commandEditDialog.ts'), import('/src/editor/panels/eventEditor/commandToolbarHistory.ts'),
      ]);
      setDevProjectFactory(createBlankProject); await store.load();
      window.qa = { store, application, history, drafts, dialog, toolbar };
      document.querySelector('#proof').textContent = 'Actual editor application API loaded';
    }));
  };
  await boot(first); await boot(second);
  const identity = await first.evaluate(() => window.qa.store.getLoadedProjectIdentity());
  assert.deepEqual(await second.evaluate(() => window.qa.store.getLoadedProjectIdentity()), identity);
  const finished = new Map();
  const unsubscribe = service.scheduler.subscribe(event => {
    if (['succeeded', 'failed'].includes(event.states.generation)) finished.get(event.jobId)?.resolve(event);
  });
  const admit = async (page, family) => {
    // Subscribe before triggering admission, and retain terminal events that precede HTTP acknowledgement.
    const terminal = Promise.withResolvers();
    const off = service.scheduler.subscribe(event => {
      if (['succeeded', 'failed'].includes(event.states.generation)) terminal.resolve(event);
    });
    try {
      const jobId = await page.evaluate(async family => {
        const { store, capture } = window.qa;
        const session = await (await fetch('/api/ai-jobs/session')).json();
        const payload = family === 'event-commands' ? capture.payload : {};
        const target = family === 'event-commands' ? capture.target : {};
        const response = await fetch('/api/ai-jobs', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-AI-Jobs-CSRF': session.csrfToken, 'Idempotency-Key': crypto.randomUUID() },
          body: JSON.stringify({ input: { version: 1, family, project: store.getLoadedProjectIdentity(), target, mode: family === 'event-commands' ? 'review' : 'auto', payload, dependsOn: [] }, projectSnapshot: store.getCurrent(), artwork: [] }) });
        if (!response.ok) throw new Error(await response.text()); return (await response.json()).job.id;
      }, family);
      const event = await terminal.promise; assert.equal(event.jobId, jobId); assert.equal(event.states.generation, 'succeeded'); return jobId;
    } finally { off(); }
  };
  const jobId = await admit(first, 'database');
  const outcomes = await guarded(Promise.all([first, second].map(page => page.evaluate(jobId => window.qa.application.applyJobResult(jobId), jobId))));
  outcomes.forEach(outcome => assert.equal(outcome.application, 'applied', JSON.stringify(outcome)));
  assert.equal(outcomes[0].receiptId, outcomes[1].receiptId);
  const histories = await Promise.all([first, second].map(page => page.evaluate(() => window.qa.history.getMapEditHistoryEntries().length)));
  assert.equal(histories.reduce((a, b) => a + b, 0), 1);
  const winner = histories[0] === 1 ? first : second;
  await winner.evaluate(async () => { await window.qa.store.flush(); });
  const persisted = await winner.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('oprn:dev-project:')).map(key => ({ key, value: JSON.parse(localStorage.getItem(key)) })));
  assert.equal(persisted[0].value.localProjectId, identity.projectId);
  await boot(winner);
  assert.deepEqual(await winner.evaluate(() => window.qa.store.getLoadedProjectIdentity()), identity);
  assert.equal(await winner.evaluate(() => window.qa.store.getCurrent().meta.title), 'Applied from immutable browser job');
  assert.equal((await winner.evaluate(jobId => window.qa.application.applyJobResult(jobId), jobId)).application, 'applied');
  const unchangedJob = await admit(winner, 'assistant');
  const unchangedHistory = await winner.evaluate(() => window.qa.history.getMapEditHistoryEntries().length);
  const unchanged = await guarded(winner.evaluate(async id => {
    let mutations = 0;
    const unsubscribe = window.qa.store.subscribe(() => { mutations++; });
    try {
      const outcome = await window.qa.application.applyJobResult(id);
      return { outcome, mutations, history: window.qa.history.getMapEditHistoryEntries().length };
    } finally { unsubscribe(); }
  }, unchangedJob));
  assert.equal(unchanged.outcome.application, 'applied');
  assert.equal(unchanged.mutations, 0);
  assert.equal(unchanged.history, unchangedHistory);
  await winner.evaluate(async () => {
    const { store, dialog, toolbar, drafts } = window.qa;
    store.update(project => { project.commonEvents.push({ id: 'qa-common', name: 'QA command owner', trigger: 'none', commands: [{ kind: 'text', body: 'Original command' }] }); });
    const history = toolbar.createCommandToolbarHistory({ key: 'qa-common-review', readCommands: () => store.getCurrent().commonEvents.find(e => e.id === 'qa-common').commands,
      replaceCommands: commands => store.update(project => { project.commonEvents.find(e => e.id === 'qa-common').commands = commands; }) });
    const owner = dialog.openEventCommandEditDialog({ initial: { kind: 'text', body: 'Original command' }, owner: { kind: 'common-event', commonEventId: 'qa-common' }, onApply: command => history.replaceAll([command]) });
    const draftBinding = await drafts.captureDraftBinding(owner);
    window.qa.capture = { target: { kind: 'common-event', commonEventId: 'qa-common', mapId: store.getCurrent().startMapId }, payload: {
      prompt: 'reviewed fixture command', config: { authMode: 'chatgpt', model: 'fixture', maxTokens: 100, maxToolCalls: 1 },
      baseCommands: owner.readCommands(), selection: null, preferenceMemorySection: '', draftBinding,
    } };
    window.qa.commandHistory = history; window.qa.owner = owner;
  });
  const draftJob = await admit(winner, 'event-commands');
  const draftOutcome = await guarded(winner.evaluate(jobId => window.qa.application.applyJobResult(jobId, { review: { approved: true } }), draftJob));
  assert.equal(draftOutcome.application, 'applied', JSON.stringify(draftOutcome));
  assert.deepEqual(await winner.evaluate(() => window.qa.owner.readCommands()), [{ kind: 'text', body: 'Reviewed delayed command' }]);
  assert.equal(await winner.evaluate(() => window.qa.store.getCurrent().commonEvents.find(e => e.id === 'qa-common').commands[0].body), 'Original command');
  await winner.screenshot({ path: join(evidence, 'browser-reviewed-command.png'), fullPage: true });
  await winner.getByTestId('event-command-edit-ok').click();
  assert.equal(await winner.evaluate(() => window.qa.store.getCurrent().commonEvents.find(e => e.id === 'qa-common').commands[0].body), 'Reviewed delayed command');
  assert.equal(await winner.evaluate(() => window.qa.commandHistory.canUndo()), true);
  await winner.evaluate(() => window.qa.commandHistory.undo());
  assert.equal(await winner.evaluate(() => window.qa.commandHistory.canUndo()), false);
  const records = await winner.evaluate(async ids => {
    const records = await import('/src/editor/aiJobs/applicationRecords.ts'); const db = await records.openApplicationRecords();
    try { return await Promise.all(ids.map(async id => { const row = await db.get(`job:${id}`); return { jobId: row.jobId, phase: row.phase, receiptId: row.receiptId, hasRecoverySnapshots: !!row.before && !!row.applied }; })); } finally { db.close(); }
  }, [jobId, unchangedJob, draftJob]);
  const jobs = service.repository.snapshot().jobs;
  for (const job of jobs) {
    const receipt = job.applicationEvidence.receipt;
    const artifact = job.applicationEvidence.artifact;
    assert.equal(artifact.receiptId, receipt.receiptId);
    assert.equal(artifact.resultSha256, job.resultRef.sha256);
    assert.equal(artifact.ref.sha256, receipt.evidence.appliedSnapshotSha256);
    assert.equal((await service.repository.readBlob(artifact.ref)).byteLength, artifact.ref.byteLength);
    if (job.id === unchangedJob) assert.equal(receipt.evidence.noChanges, true);
  }
  unsubscribe();
  await context.tracing.stop({ path: join(evidence, 'browser-trace.zip') });
  assert.deepEqual(errors, []);
  const summary = { identity, jobId, unchangedJob, unchanged, draftJob, outcomes, draftOutcome, histories, durableEnvelopeId: persisted[0].value.localProjectId,
    receipts: jobs.map(job => ({ jobId: job.id, application: job.application, save: job.save, evidence: job.applicationEvidence.receipt.evidence, artifact: job.applicationEvidence.artifact })), records, paidCalls: 0, remoteProjectWrites: 0 };
  await writeFile(join(evidence, 'browser-evidence.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
} finally {
  await browser?.close();
  await service?.close();
  await server?.close();
  await rm(temporary, { recursive: true, force: true });
}
