// Production editor + scripted session events + native tools/checkpoint acceptance.
// UI fixture only: no live model, host SQLite writes or generated-game completion claim.
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:9911';
const feedbackOnly = false;
const out = 'verify-shots/assistant-human-work';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--disable-background-networking', '--js-flags=--max-old-space-size=4096'] });
const watchdog = setTimeout(() => { console.error('QA wall timeout'); void browser.close(); }, 240000);
console.log('browser ready');
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
const report = { transport: feedbackOnly ? 'scripted; native read only; no authoring claim' : 'scripted session events; native tools and checkpoint acceptance', errors: [], checks: [] };
page.on('console', msg => { if (msg.text().startsWith('QA') || msg.type() === 'error') console.log(msg.text()); });
page.on('crash', () => { report.errors.push('renderer crashed'); console.error('QA renderer crashed'); void browser.close(); });
page.on('pageerror', error => report.errors.push(error.message));
const check = (name, passed, detail) => {
  report.checks.push({ name, passed, detail });
  writeFileSync(out + '/report.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ name, passed, detail }));
  if (!passed) throw Error(name);
};

await page.addInitScript(fixture => {
  window.__OPRN_E2E_PROJECT__ = fixture;
  localStorage.setItem('oprn:editor-ui-mode', 'expert');
  for (const key of ['oprn:editor-welcome-dismissed', 'oprn:standard-welcome-seen', 'oprn:coachmarks-basic-v1']) localStorage.setItem(key, '1');
  localStorage.setItem('oprn:ai-config', JSON.stringify({ providerId: 'google-antigravity', model: 'gemini-3.8-flash', piApply: 'auto', piTeam: true }));
  const original = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const url = typeof input === 'string' ? input : input.url;
    if (url.includes('/__oprn/shared-tile-references')) return Promise.resolve(new Response(JSON.stringify({ revision: 'qa', entries: [] })));
    if (url.includes('/__oprn/shared-content')) return Promise.resolve(new Response(JSON.stringify({ revision: 'qa', libraries: {} })));
    if ((init?.method ?? 'GET').toUpperCase() === 'POST' && (url.includes('/chat/completions') || url.includes('/responses') || url.includes('/api/ai'))) throw Error('Live model requests are outside this scripted QA');
    return original(input, init);
  };
}, JSON.parse(readFileSync('test/fixtures/projects/event-pages-v3.json', 'utf8')));
const frame = async (topic, step) => {
  await page.waitForTimeout(850);
  await page.screenshot({ path: `${out}/${topic}-${step}.png`, timeout: 15000 });
};
try {
  await page.goto(base + '/?blankProject=1', { waitUntil: 'domcontentloaded' });
  await page.getByTestId('ai-input').waitFor({ timeout: 90000 });
  await page.waitForFunction(() => !!window.__oprnEditCamera?.(), null, { timeout: 45000, polling: 100 });
  await page.evaluate(async () => {
    const { store } = await import('/src/project/store.ts');
    const { editorState } = await import('/src/editor/editorState.ts');
    const { normalizeDatabaseRecords } = await import('/src/project/databaseRecordModel.ts');
    const { appendConversationBubble } = await import('/src/editor/panels/aiConversationLog.ts');
    const { conversationScroll } = await import('/src/editor/panels/aiConversationScroll.ts');
    const { createMapRunCard } = await import('/src/editor/panels/aiMapRunCard.ts');
    const { createPiPublication } = await import('/src/editor/panels/aiPiPublication.ts');
    const { createAssistantHumanEdits } = await import('/src/editor/assistantHumanEdits.ts');
    const { runTool } = await import('/src/editor/tools/toolRunner.ts');
    const { exportSpatialToolProof } = await import('/src/editor/tools/spatialToolState.ts');
    const current = store.getCurrent(), mapId = current.startMapId;
    const originalMap = current.maps[mapId];
    const map = { ...originalMap, width: 24, height: 18, lowerTiles: Array(24 * 18).fill(16), upperTiles: Array(24 * 18).fill(-1), events: [] };
    const tilesets = { [map.tilesetId]: { ...current.tilesets[map.tilesetId], referenceDocuments: [] } };
    store.replace({ ...current, maps: { [mapId]: map }, database: normalizeDatabaseRecords(current.database), tilesets, assets: window.__OPRN_E2E_PROJECT__.assets }, { change: { origin: 'system', label: 'UI QA fixture' } });
    editorState.set({ currentMapId: mapId, zoom: 2, selection: null, tool: 'paint', layer: 'lower', selectedTile: 23, autoConnectMode: false, clusterAssistMode: false });
    const log = document.querySelector('.ai-chat-log');
    log.replaceChildren();
    const append = (role, text) => appendConversationBubble({ log, role, text, removeStartScreen() {} });
    const card = label => {
      const abort = new AbortController();
      const card = createMapRunCard({ mapName: '증거용 편집 맵', label, onCancel: () => abort.abort() });
      log.append(card.root);
      return { card, abort, surface: { appendBubble: (role, text) => card.say(role, text), appendCard: element => card.attach(element),
        appendReviewPrompt: element => card.attachPrompt(element), appendProcess: text => card.note(text), setStatus: text => card.setStatus(text),
        signal: abort.signal, getCurrentMapId: () => editorState.get().currentMapId } };
    };
    window.qa = { store, editorState, mapId, log, append, card, scrolling: conversationScroll(log), createPiPublication, createAssistantHumanEdits, runTool, exportSpatialToolProof };
  });
  // 1: the production log renderer receives text while the reader is above the end.
  await page.evaluate(() => {
    for (let i = 1; i <= 28; i++) qa.append('assistant', `지난 대화 ${i} — 사용자는 맵의 길과 바닥을 확인하고 있습니다.\n\n조수의 작업은 계속 진행되지만 읽고 있던 내용은 그대로 유지합니다.`);
    qa.scrolling.latest();
  });
  await frame('scroll', '01-bottom');
  const logBox = await page.locator('.ai-chat-log').boundingBox();
  await page.mouse.move(logBox.x + logBox.width / 2, logBox.y + logBox.height / 2);
  await page.mouse.wheel(0, -1150);
  await page.waitForTimeout(500);
  const top = await page.evaluate(() => qa.log.scrollTop);
  await frame('scroll', '02-reading');
  await page.evaluate(() => { qa.append('assistant', '새 응답 — 작업 결과가 도착했습니다. 읽던 대화를 마친 뒤 새 응답 보기 버튼을 누르세요.'); });
  await frame('scroll', '03-new-response');
  check('reading position stays while a real conversation bubble arrives', await page.evaluate(t => Math.abs(qa.log.scrollTop - t) <= 2 && !qa.scrolling.notice.hidden, top), { scrollTop: top });
  await page.getByTestId('ai-new-replies').click();
  await frame('scroll', '04-latest');
  await page.evaluate(() => { qa.append('assistant', '다음 응답 — 맨 아래에서는 새 출력이 도착하면 계속 따라갑니다.'); });
  await frame('scroll', '05-following');
  check('explicit latest resumes output following', await page.evaluate(() => qa.log.scrollHeight - qa.log.clientHeight - qa.log.scrollTop < 25 && qa.scrolling.notice.hidden));
  // 2: exercise the old session runner's actual highlight + settlement cleanup.
  await page.evaluate(async () => {
    qa.log.replaceChildren(); qa.scrolling.latest();
    const { AssistantSession } = await import('/src/ai/assistantSession.ts');
    const { defaultAiConfig } = await import('/src/ai/llmClient.ts');
    const { createAiTurnRunner } = await import('/src/editor/panels/aiTurnRunner.ts');
    const session = new AssistantSession(qa.store.getCurrent(), { config: defaultAiConfig() });
    // Script only the request classification; no model or transport is contacted.
    session.allowsViewNavigation = () => true;
    const noop = () => {};
    const surface = { panel: document.querySelector('.ai-chat-panel'), log: qa.log, sendButton: document.createElement('button'), controller: { session, auditHistory: [] },
      turnBusy: false, disposed: false, collapsed: false, activeAbortController: null, conversationId: 'qa-selection', conversationScope: 'qa-selection',
      appendBubble: qa.append, setStatus: noop, expandForAiWork: noop, beginTurnProgress: noop, endTurnProgress: noop, refreshAbortButton: noop,
      persistConversation: noop, notifyIfObscuredByTestPlay: noop, drainPendingSends: noop, completeLiveActivity: noop };
    const deps = { surface, applyingProposal: false, projectIdentityId: '', workPlanSurfaceState: null, applyProposal: async () => 'rejected',
      beginWorkPlanTurn: noop, settleWorkPlanTurn: noop, refreshWorkPlanSurface: noop, showWorkPlan: noop, showAcceptance: noop, noteWorkPlanActivity: noop,
      appendMilestoneFeedLine: noop, noteNoChanges: noop, appendTileThumbs: noop, appendTileGrid: noop, appendAiDocument: noop,
      hasPendingQuestion: () => false, openAiSettings: noop, renderQuickReplies: noop, refreshContextMeter: noop };
    qa.selectionTurn = createAiTurnRunner(deps).executeTurn(session, '이곳을 찾아서 보여줘', async onEvent => {
      qa.append('assistant', '찾은 위치를 강조합니다. 사용자가 직접 선택한 영역은 별도로 유지됩니다.');
      onEvent({ type: 'tool_call', name: 'highlight_map_region', args: { mapId: qa.mapId, x: 8, y: 6, w: 4, h: 3 }, result: { ok: true, summary: '위치 강조', data: { mapId: qa.mapId, x: 8, y: 6, w: 4, h: 3 } } });
      await new Promise(resolve => { qa.finishSelection = resolve; });
      return { assistantText: '위치 확인을 끝냈습니다.', proposedCalls: [], stoppedReason: 'final' };
    }, { composerMode: 'ask' });
  });
  await page.waitForFunction(() => !!qa.finishSelection, null, { polling: 100 });
  await page.evaluate(() => qa.editorState.set({ tool: 'select' }));
  const drawSelection = async () => {
    const points = await page.evaluate(() => [window.__oprnEditWorldToClient(2 * 16 + 8, 2 * 16 + 8), window.__oprnEditWorldToClient(5 * 16 + 8, 4 * 16 + 8)]);
    await page.mouse.move(points[0].x, points[0].y); await page.mouse.down();
    await page.mouse.move(points[1].x, points[1].y, { steps: 12 }); await page.mouse.up();
  };
  await drawSelection();
  const selection = await page.evaluate(() => qa.editorState.get().selection);
  check('real pointer drag creates human selection during AI turn', !!selection && selection.width > 1 && selection.height > 1, selection);
  await frame('selection', '01-human-selection');
  await page.evaluate(() => { qa.finishSelection(); });
  await page.evaluate(async () => { await qa.selectionTurn; });
  await frame('selection', '02-settled');
  check('legacy highlight settlement preserves later human selection', await page.evaluate(s => JSON.stringify(qa.editorState.get().selection) === JSON.stringify(s), selection));
  // 4: an inline approval pauses its publication; manual input and another owner continue.
  await page.evaluate(() => {
    qa.log.replaceChildren(); qa.scrolling.latest(); qa.editorState.set({ selection: null, tool: 'paint', selectedTile: 23 });
    const owner = qa.card('승인 대기 중에도 맵을 편집할 수 있어요');
    const guard = qa.createAssistantHumanEdits();
    const publication = qa.createPiPublication(qa.store.getCurrent(), 'default', owner.surface, { humanEdits: guard, beforeApply: async () => {}, afterApply() {} });
    const ctx = { project: qa.store.getCurrent(), currentMapId: qa.mapId };
    const result = qa.runTool(ctx, 'clear_map', { mapId: qa.mapId, fill: 'empty', confirmDestroy: true });
    if (!result.ok) throw Error(result.summary);
    qa.pendingDecision = publication.publish({ checkpointId: 'decision', label: '증거용 맵 청소', toolName: 'clear_map', project: ctx.project, spatialProof: qa.exportSpatialToolProof(ctx.project) }).then(() => { guard.dispose(); owner.card.finish({ ok: true }); qa.decisionApplied = true; });
  });
  await page.getByTestId('ai-decision-confirm').waitFor();
  check('approval is inline and does not open a modal', await page.evaluate(() => !document.querySelector('.modal-backdrop, .modal-overlay') && !qa.decisionApplied));
  await frame('decision', '01-waiting');
  const paintPoint = await page.evaluate(() => window.__oprnEditWorldToClient(4 * 16 + 8, 4 * 16 + 8));
  await page.mouse.click(paintPoint.x, paintPoint.y);
  check('pointer painting works while publication awaits a decision', await page.evaluate(() => qa.store.getCurrent().maps[qa.mapId].lowerTiles[4 * 24 + 4] === 23 && !qa.decisionApplied));
  await frame('decision', '02-human-edit');
  await page.evaluate(async () => {
    const owner = qa.card('별도 작업은 대기하지 않고 계속 진행');
    const pub = qa.createPiPublication(qa.store.getCurrent(), 'auto', owner.surface);
    const ctx = { project: qa.store.getCurrent(), currentMapId: qa.mapId };
    const result = qa.runTool(ctx, 'paint_tiles', { mapId: qa.mapId, layer: 'lower', mode: 'cells', tile: 3, cells: [{ x: 12, y: 6 }] });
    if (!result.ok) throw Error(result.summary);
    await pub.publish({ checkpointId: 'independent', label: '별도 작업 적용', toolName: 'paint_tiles', project: ctx.project, spatialProof: qa.exportSpatialToolProof(ctx.project) });
    owner.card.finish({ ok: true });
  });
  await frame('decision', '03-other-task');
  check('independent publication progresses while inline destruction approval remains paused', await page.evaluate(() => qa.store.getCurrent().maps[qa.mapId].lowerTiles[6 * 24 + 12] === 3 && !qa.decisionApplied));
  await page.getByTestId('ai-decision-confirm').click();
  await page.evaluate(async () => { await qa.pendingDecision; });
  await frame('decision', '04-approved');
  check('approval resumes only its owner and merges concurrent manual work', await page.evaluate(() => qa.decisionApplied && qa.store.getCurrent().maps[qa.mapId].lowerTiles[4 * 24 + 4] === 23 && qa.store.getCurrent().maps[qa.mapId].lowerTiles[6 * 24 + 8] === -1));
  // 5: persistent intent survives the first rebase/ACK and blocks later checkpoints.
  await page.evaluate(() => {
    qa.log.replaceChildren(); qa.scrolling.latest();
    const owner = qa.card('직접 고친 칸을 다음 응답에서도 보존');
    const guard = qa.createAssistantHumanEdits();
    const pub = qa.createPiPublication(qa.store.getCurrent(), 'auto', owner.surface, { humanEdits: guard, beforeApply: async () => {}, afterApply() {} });
    qa.protect = { owner, guard, pub };
    qa.checkpoint = async (label, tile, cells) => {
      const ctx = { project: qa.protect.pub.project, currentMapId: qa.mapId };
      const result = qa.runTool(ctx, 'paint_tiles', { mapId: qa.mapId, layer: 'lower', mode: 'cells', tile, cells });
      if (!result.ok) throw Error(result.summary);
      const accepted = await qa.protect.pub.publish({ checkpointId: label, label, toolName: 'paint_tiles', project: ctx.project, spatialProof: qa.exportSpatialToolProof(ctx.project) });
      qa.protect.owner.card.say('system', label);
      return accepted.maps[qa.mapId].lowerTiles[9 * 24 + 6];
    };
  });
  await page.evaluate(async () => { await qa.checkpoint('1차 응답 · 바닥 적용', 22, [{ x: 6, y: 9 }, { x: 7, y: 9 }, { x: 8, y: 9 }]); });
  await frame('protected', '01-ai-floor');
  await page.evaluate(() => qa.editorState.set({ tool: 'paint', selectedTile: 23 }));
  const humanPoint = await page.evaluate(() => window.__oprnEditWorldToClient(6 * 16 + 8, 9 * 16 + 8));
  await page.mouse.click(humanPoint.x, humanPoint.y);
  check('real brush edits the intended checkpoint cell', await page.evaluate(() => qa.store.getCurrent().maps[qa.mapId].lowerTiles[9 * 24 + 6] === 23));
  await frame('protected', '02-human-tile');
  const second = await page.evaluate(async () => qa.checkpoint('2차 응답 · 사람 수정값을 기준으로 받아감', 31, [{ x: 6, y: 9 }, { x: 7, y: 9 }]));
  await frame('protected', '03-rebase');
  const third = await page.evaluate(async () => qa.checkpoint('3차 응답 · 같은 칸 덮기 시도, 옆 칸은 계속 적용', 22, [{ x: 6, y: 9 }, { x: 8, y: 9 }, { x: 9, y: 9 }]));
  await frame('protected', '04-later-checkpoint');
  const values = await page.evaluate(() => qa.store.getCurrent().maps[qa.mapId].lowerTiles.slice(9 * 24 + 6, 9 * 24 + 10));
  check('manual tile persists beyond ACK while neighboring AI cells apply', second === 23 && third === 23 && values[3] !== 16, { second, third, values });
  await page.evaluate(() => { qa.protect.guard.dispose(); qa.protect.owner.card.finish({ ok: true }); });
  await frame('protected', '05-finished');

  // Verify that the actual command wrapper keeps protection through host ACKs.
  await page.evaluate(async () => {
    const { runPiCommand, plainPiCommand } = await import('/src/editor/panels/aiPiAgentCommand.ts');
    qa.wrapper = { acks: [], blobs: {}, releases: {}, done: false };
    const original = window.fetch.bind(window);
    const decode = async init => {
      const body = new Response(init.body).body;
      return JSON.parse(await new Response(new Headers(init.headers).get('content-encoding') === 'gzip' ? body.pipeThrough(new DecompressionStream('gzip')) : body).text());
    };
    window.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/v1/agent/checkpoint')) {
        const ack = await decode(init); qa.wrapper.acks.push(ack);
        if (!ack.ok) throw Error(ack.issue);
        qa.wrapper.accepted = ack.project;
        qa.wrapper.resolveAck?.();
        return new Response('{}', { headers: { 'Content-Type': 'application/json' } });
      }
      if (!url.includes('/v1/agent/run')) return original(input, init);
      console.log("QA wrapper request");
      const request = await decode(init);
      Object.assign(qa.wrapper.blobs, request.heavyBlobs);
      for (const [key, hash] of Object.entries(request.heavy ?? {})) request.project[key] = JSON.parse(qa.wrapper.blobs[hash]);
      return new Response(new ReadableStream({ async start(controller) {
        const write = event => controller.enqueue(new TextEncoder().encode(JSON.stringify(event) + '\n'));
        const ctx = { project: request.project, currentMapId: qa.mapId };
        write({ type: 'start', provider: 'scripted', model: 'scripted', toolCount: 1 });
        for (let n = 1; n <= 3; n++) {
          await new Promise(resolve => { qa.wrapper.releases[n] = resolve; });
          const result = qa.runTool(ctx, 'paint_tiles', { mapId: qa.mapId, layer: 'lower', mode: 'cells', tile: 22, cells: [{ x: 10, y: 11 }, { x: 10 + n, y: 11 }] });
          if (!result.ok) throw Error(result.summary);
          const acked = new Promise(resolve => { qa.wrapper.resolveAck = resolve; });
          write({ type: 'checkpoint', checkpointId: `wrapper-${n}`, label: `실제 실행기 ${n}차`, toolName: 'paint_tiles', project: ctx.project, spatialProof: qa.exportSpatialToolProof(ctx.project) });
          await acked;
          ctx.project = qa.wrapper.accepted;
        }
        write({ type: 'review', agentId: 'qa-scripted-review', mapId: qa.mapId, ok: true, findings: [] });
        write({ type: 'done', project: ctx.project, stats: { ms: 1, turns: 1, toolCalls: 3, toolErrors: 0 }, changedKeys: ['maps'] });
        controller.close();
      } }), { headers: { 'Content-Type': 'application/x-ndjson', 'X-Oprn-Run-Id': request.runId } });
    };
    const owner = qa.card('실제 실행기와 ACK 왕복 · 칸 보존');
    const originalNote = owner.surface.appendProcess;
    owner.surface.appendProcess = text => { console.log("QA wrapper: " + text); originalNote(text); };
    qa.wrapperRun = runPiCommand(plainPiCommand('QA checkpoint preservation', 'team', qa.mapId), owner.surface, { background: true }).then(ok => {
      qa.wrapper.done = true; qa.wrapper.ok = ok; window.fetch = original; owner.card.finish({ ok });
    });
  });
  await page.waitForFunction(() => !!qa.wrapper.releases[1], null, { timeout: 45000, polling: 100 });
  await page.evaluate(() => { qa.wrapper.releases[1](); });
  await page.waitForFunction(() => !!qa.wrapper.releases[2], null, { timeout: 45000, polling: 100 });
  await page.evaluate(() => qa.editorState.set({ tool: 'paint', selectedTile: 23 }));
  const wrapperPoint = await page.evaluate(() => window.__oprnEditWorldToClient(10 * 16 + 8, 11 * 16 + 8));
  await page.mouse.click(wrapperPoint.x, wrapperPoint.y);
  await page.evaluate(() => { qa.wrapper.releases[2](); });
  await page.waitForFunction(() => !!qa.wrapper.releases[3], null, { timeout: 45000, polling: 100 });
  await page.evaluate(() => { qa.wrapper.releases[3](); });
  await page.waitForFunction(() => qa.wrapper.done, null, { timeout: 45000, polling: 100 });
  const wrapper = await page.evaluate(() => ({ ok: qa.wrapper.ok, acks: qa.wrapper.acks.map(ack => ({ ok: ack.ok, tile: ack.project.maps[qa.mapId].lowerTiles[11 * 24 + 10] })), live: qa.store.getCurrent().maps[qa.mapId].lowerTiles[11 * 24 + 10] }));
  check('real Pi command retains human cell through second and third host ACK', wrapper.ok && wrapper.acks.length === 3 && wrapper.acks[1].tile === 23 && wrapper.acks[2].tile === 23 && wrapper.live === 23, wrapper);
  // Cancellation removes the inline decision and rejects the waiting owner.
  const cancellation = await page.evaluate(async () => {
    const { requestAssistantDecision } = await import('/src/editor/panels/aiDecisionPrompt.ts');
    const owner = qa.card('중단 시 대기 카드 정리');
    const promise = requestAssistantDecision(owner.surface, { title: '확인', message: '이 작업을 계속할까요?' }).then(() => false, error => error.name === 'AbortError');
    owner.abort.abort();
    const aborted = await promise;
    owner.card.root.remove();
    return aborted && !document.querySelector('[data-testid="ai-decision-prompt"]');
  });
  check('abort removes inline decision and releases its owner', cancellation);
  check('no uncaught page errors', report.errors.length === 0, report.errors);
} catch (error) {
  report.failure = error.message;
  report.process = await page.evaluate(() => [...document.querySelectorAll(".ai-map-run-process")].map(node => node.textContent)).catch(() => []);
  console.error(report.process);
  report.body = (await page.locator('body').innerText().catch(() => 'unavailable')).slice(-3000);
  console.error(report.failure, report.body);
  await page.screenshot({ path: out + '/failure.png', timeout: 15000 }).catch(() => {});
  throw error;
} finally {
  writeFileSync(out + '/report.json', JSON.stringify(report, null, 2));
  clearTimeout(watchdog); await browser.close();
}
console.log(JSON.stringify(report));
