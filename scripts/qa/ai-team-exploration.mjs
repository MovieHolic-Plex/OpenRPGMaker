// Real team usage in one new SQLite project. No mocked model or persistence transport.
// Requires build:fast + build:electron; runs are bounded and failures are recorded.
import { withTsModule } from '../ontology-ts-loader.mjs';
import { chromium } from 'playwright';
import { resolve } from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';

const out = resolve(process.env.QA_OUTPUT_DIR ?? 'verify-shots/ai-team-exploration-20261005');
const projectDir = resolve(process.env.QA_PROJECT_DIR ?? 'output/qa/ai-team-exploration-20261005/project');
const resume = process.env.QA_RESUME === '1';
const parallelOnly = process.env.QA_PARALLEL_ONLY === '1';
await mkdir(out, { recursive: true });
const report = { provenance: 'Real browser, SQLite host and live companion/model. No synthetic run events.', projectDir, runs: [], errors: [], started: new Date().toISOString() };
const save = () => writeFile(out + '/report.json', JSON.stringify(report, null, 2) + '\n');
const specs = (review = false) => ({ version: 1, workBudget: 100, reviewAfterWork: review,
  orchestratorNotes: '검증용 작은 작업이다. 지시한 작업만 하고 불필요한 추가 제작, 타일 작업, 이미지 생성은 하지 않는다. 작업 완료 후 finish 한다.',
  members: [
    { id: 'builder', label: '등대 조수', kind: 'builder', summary: '등대 맵의 조회·이벤트 대사', enabled: true, maxTurns: 100, toolDomains: ['core', 'map', 'event', 'database'], prompt: '지정된 맵과 지시 범위만 작업한다. 쓰기 지시가 없으면 조회만 한다. 보고는 두 문장이다. 타일·그림·오디오는 변경하지 않는다.' },
    { id: 'events', label: '부두 조수', kind: 'builder', summary: '부두 맵의 조회·이벤트 대사', enabled: true, maxTurns: 100, toolDomains: ['core', 'map', 'event', 'database'], prompt: '지정된 맵과 지시 범위만 작업한다. 쓰기 지시가 없으면 조회만 한다. 보고는 두 문장이다. 타일·그림·오디오는 변경하지 않는다.' },
    { id: 'reviewer', label: '검수 조수', kind: 'reviewer', summary: '요청한 대사와 데이터 확인', enabled: true, maxTurns: 100, toolDomains: ['core', 'map', 'event', 'database'], prompt: '조회 도구로 요청한 이벤트·데이터가 실제 있는지 확인한다. 읽기만 하고 두 문장으로 결과와 미확인 사항을 보고한다.' },
  ] });
const sqlite = () => {
  const db = new DatabaseSync(projectDir + '/project.sqlite', { readOnly: true });
  try {
    const row = db.prepare('SELECT project_id,title,revision,current_json FROM project WHERE id=1').get();
    const p = JSON.parse(row.current_json);
    const maps = db.prepare('SELECT map_id,map_json FROM maps ORDER BY map_id').all().map(row => JSON.parse(row.map_json));
    const records = db.prepare('SELECT entries_json FROM ai_conversations').all();
    return { projectId: row.project_id, title: row.title, revision: row.revision, mapTree: p.mapTree, hero: p.database.actors.find(a => a.id === 'actor_hero')?.name,
      maps: maps.map(m => ({ id: m.id, name: m.name, events: m.events })), conversations: records.length };
  } finally { db.close(); }
};

// Seed through the same local store API, before this project's host is started.
let seed;
if (!resume) {
await withTsModule(resolve('src/project/defaults/blankProject.ts'), 'team-seed.mjs', ({ createBlankProject }) => {
  seed = createBlankProject();
  seed.meta.title = '팀 모드 다양한 사용 실측';
  const a = seed.maps[seed.startMapId];
  a.id = 'team_lighthouse'; a.name = '등대';
  const b = structuredClone(a); b.id = 'team_dock'; b.name = '부두';
  const event = (id, name, x, y, body) => ({ id, name, x, y, trigger: { kind: 'action' }, commands: [{ kind: 'text', body }] });
  a.events = [event('ev_lighthouse', '등대 안내판', 5, 5, '등대에 오신 것을 환영합니다.')];
  b.events = [event('ev_dock', '부두 안내판', 6, 5, '마지막 배는 저녁에 떠나요.')];
  a.events.push({ id: 'exit_to_dock', name: '부두로', x: 10, y: 8, trigger: { kind: 'action' }, commands: [{ kind: 'transfer', mapId: b.id, x: 10, y: 8 }] });
  b.events.push({ id: 'exit_to_lighthouse', name: '등대로', x: 10, y: 8, trigger: { kind: 'action' }, commands: [{ kind: 'transfer', mapId: a.id, x: 10, y: 8 }] });
  seed.maps = { [a.id]: a, [b.id]: b };
  seed.startMapId = a.id;
  seed.mapTree = { mapId: 'team_places', kind: 'folder', name: '팀 사용 실측', children: [{ mapId: a.id, children: [] }, { mapId: b.id, children: [] }] };
  seed.tilesets = { [a.tilesetId]: seed.tilesets[a.tilesetId] };
});
let serialized;
await withTsModule(resolve('src/project/io/serialize.ts'), 'team-seed-wire.mjs', ({ serialize }) => { serialized = serialize(seed); });
await withTsModule(resolve('electron/local-store/store.ts'), 'team-seed-store.mjs', async ({ initLocalProjectStore }) => {
  const store = await initLocalProjectStore({ projectDir });
  try {
    if (store.info().revision > 0) throw new Error('QA project already contains data; choose a new QA_PROJECT_DIR.');
    await store.saveSerialized(serialized, null);
  } finally { store.close(); }
});
}
if (resume && parallelOnly) {
  // A real map root avoids the currently broken canonical folder roundtrip.
  // This project's previous host must have closed before this store API is used.
  await withTsModule(resolve('electron/local-store/store.ts'), 'team-parallel-store.mjs', async ({ initLocalProjectStore }) => {
    const store = await initLocalProjectStore({ projectDir });
    try {
      const snapshot = store.loadSnapshot();
      const project = snapshot.project;
      const root = structuredClone(project.maps.team_lighthouse);
      root.id = 'team_base'; root.name = '항구 입구';
      root.events = ['team_lighthouse', 'team_dock'].map((id, index) => ({ id: 'exit_' + id, name: id, x: 8 + index * 3, y: 8, trigger: { kind: 'action' }, commands: [{ kind: 'transfer', mapId: id, x: 10, y: 8 }] }));
      project.maps[root.id] = root;
      project.mapTree = { mapId: root.id, children: [{ mapId: 'team_lighthouse', children: [] }, { mapId: 'team_dock', children: [] }] };
      project.startMapId = root.id;
      await store.saveSerialized(JSON.stringify(project), snapshot.sha256);
    } finally { store.close(); }
  });
}
report.seed = sqlite(); await save();

await withTsModule(resolve('electron/serve/runtime.ts'), 'team-exploration-host.mjs', async ({ startLocalProjectServer }) => {
  const host = await startLocalProjectServer({ projectDir, distDir: resolve('dist'), browserBridgeSource: await readFile('dist-electron/browser-bridge.js', 'utf8'), enableOwnerAi: true });
  report.base = host.url;
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, recordVideo: { dir: out + '/video', size: { width: 1600, height: 1000 } } });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  page.on('pageerror', e => report.errors.push(e.message));
  page.on('crash', () => { report.errors.push('Browser page crashed'); void save(); });
  await page.addInitScript(team => {
    localStorage.setItem('oprn:locale', 'ko');
    localStorage.setItem('oprn:standard-welcome-seen', '1');
    localStorage.setItem('oprn:editor-welcome-dismissed', '1');
    localStorage.setItem('oprn:ai-activity-level', 'brief');
    if (!localStorage.getItem('oprn:pi-team')) localStorage.setItem('oprn:pi-team', JSON.stringify(team));
    window.__teamExplore = { requests: [], events: [] };
    const real = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const url = new URL(typeof input === 'string' ? input : input.url, location.href);
      if (url.pathname !== '/v1/agent/run' || init?.method !== 'POST') return real(input, init);
      let body = init.body;
      if (new Headers(init.headers).get('Content-Encoding') === 'gzip') body = await new Response(new Blob([body]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
      const req = JSON.parse(typeof body === 'string' ? body : await new Response(body).text());
      const receipt = { at: Date.now(), mode: req.mode, runId: req.runId, provider: req.provider, model: req.model, task: req.task };
      window.__teamExplore.requests.push(receipt);
      const response = await real(input, init); receipt.status = response.status;
      if (!response.ok || !response.body) return response;
      const [observe, application] = response.body.tee();
      void (async () => {
        const reader = observe.pipeThrough(new TextDecoderStream()).getReader(); let pending = '';
        for (;;) {
          const { done, value } = await reader.read(); if (done) break; pending += value;
          let end;
          while ((end = pending.indexOf('\n')) >= 0) {
            const line = pending.slice(0, end); pending = pending.slice(end + 1); if (!line.trim()) continue;
            const e = JSON.parse(line), d = e.type === 'agent_event' ? e.event : e;
            if (['delta', 'heartbeat', 'prompt_inspection'].includes(d.type)) continue;
            const item = { receivedAt: Date.now(), type: e.type, actor: e.agentId, kind: d.type, name: d.name, id: d.id, ok: d.ok ?? e.ok, summary: d.summary, at: d.at ?? e.at };
            if (d.type === 'tool_start' && ['assign_map_agent', 'assign_task_agent'].includes(d.name)) item.assignment = d.args;
            if (e.type === 'agent_spawn') Object.assign(item, { role: e.role, memberId: e.memberId, mapId: e.mapId, task: e.task });
            if (d.type === 'assistant') item.text = d.text;
            if (e.type === 'error') item.error = e.error ?? e.message;
            window.__teamExplore.events.push(item);
          }
        }
      })().catch(e => window.__teamExplore.observerError = e.message);
      return new Response(application, { status: response.status, statusText: response.statusText, headers: response.headers });
    };
  }, specs());
  let runStart = 0;
  const videoStart = Date.now();
  try {
    await page.goto(host.url, { waitUntil: 'domcontentloaded' });
    if (await page.locator('input[name=token]').isVisible()) {
      await page.locator('input[name=token]').fill(host.ownerAccessCode);
      await page.getByRole('button', { name: '작업실 들어가기' }).click();
    }
    await page.waitForFunction(() => window.__oprnAiBridge?.status().ready, null, { timeout: 120000 });
    await page.locator('[data-testid="edit-canvas"] canvas').waitFor({ timeout: 120000 });
    console.log('READY', JSON.stringify({ projectId: report.seed.projectId, host: host.url }));

    const run = async (name, task, options = {}) => {
      const entry = { name, task, started: Date.now(), before: sqlite() }; report.runs.push(entry); await save();
      console.log('START', name);
      await page.evaluate(() => { window.__teamExplore = { requests: [], events: [] }; });
      await page.getByTestId('ai-input').fill(task); runStart ||= Date.now();
      await page.getByTestId('ai-send').click();
      let drafted = false, stopped = false;
      const until = Date.now() + 180000;
      while (Date.now() < until) {
        await page.waitForTimeout(1200);
        const status = await page.evaluate(() => ({ status: window.__oprnAiBridge.status(), events: window.__teamExplore.events.length, requests: window.__teamExplore.requests.length }));
        if (options.pendingDraft && !drafted) {
          const pending = page.locator('[data-testid="ai-team-member"][data-agent-id="pending:builder"]');
          if (await pending.isVisible()) {
            await pending.click(); await page.getByTestId('ai-member-input').fill('배정 전 작성한 지시를 유지해주세요.');
            drafted = true; entry.pendingDraftEntered = true;
            await page.screenshot({ path: out + '/' + name + '-pending.png' });
          }
        }
        if (options.stop && !stopped) {
          const child = await page.evaluate(() => window.__teamExplore.events.some(e => e.type === 'agent_spawn' && e.role === 'builder'));
          if (child) { await page.waitForTimeout(800); await page.evaluate(() => window.__oprnAiBridge.abort()); stopped = true; entry.stopAt = Date.now(); }
        }
        if (status.requests && !status.status.turnBusy) { entry.settled = true; break; }
      }
      if (!entry.settled) {
        entry.timedOut = true; await page.evaluate(() => window.__oprnAiBridge.abort());
        await page.waitForFunction(() => !window.__oprnAiBridge.status().turnBusy, null, { timeout: 45000 });
      }
      await page.waitForTimeout(1500);
      if (drafted) entry.pendingDraftPreserved = await page.getByTestId('ai-member-input').inputValue().catch(() => '') === '배정 전 작성한 지시를 유지해주세요.';
      entry.seconds = Math.round((Date.now() - entry.started) / 1000);
      entry.chat = (await page.getByTestId('ai-chat-log').innerText()).slice(-14000);
      entry.cards = await page.getByTestId('ai-team-avatar-list').innerText();
      entry.wire = await page.evaluate(() => window.__teamExplore);
      entry.audit = await page.evaluate(() => window.__oprnAiBridge.audit());
      await page.screenshot({ path: out + '/' + name + '.png' });
      entry.after = sqlite();
      await save(); console.log('END', JSON.stringify({ name, seconds: entry.seconds, modes: entry.wire.requests.map(r => r.mode), revision: entry.after.revision, timeout: entry.timedOut, draft: entry.pendingDraftPreserved, tail: entry.chat.slice(-450) }));
      // Reopen the same persisted project before each subsequent request.
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.__oprnAiBridge?.status().ready, null, { timeout: 120000 });
      const loaded = await page.evaluate(async () => {
        const result = await window.oprn.project.loadFolded({});
        const p = JSON.parse(result.folded ?? result.serialized);
        return { revision: result.revision, hero: p.database.actors.find(a => a.id === 'actor_hero')?.name,
          maps: Object.values(p.maps).map(m => ({ id: m.id, events: m.events })) };
      });
      entry.reloaded = loaded;
      entry.reloadMatches = JSON.stringify(entry.after.maps.map(m => ({ id: m.id, events: m.events })).sort((a,b) => a.id.localeCompare(b.id))) === JSON.stringify(loaded.maps.sort((a,b) => a.id.localeCompare(b.id))) && loaded.hero === entry.after.hero;
      await save();
    };

    if (!resume || parallelOnly) await run('01-parallel-read', 'team 읽기 작업이다. 프로젝트를 수정하지 마라. assign_map_agent로 team_lighthouse에 builder를 배정하고 team_dock에 events를 배정한다. 두 맵이 별개이므로 두 배정을 먼저 시작하고 wait_agents 한다. 각 조수는 get_map_region 1회로 안내판 이벤트를 확인하고 원문을 두 문장으로 보고한다. 다른 작업 없이 finish 한다.', { pendingDraft: true });
    if (!parallelOnly) {
    // Exercise the user-visible team toggle with an ordinary instruction.
    await page.getByTestId('ai-composer-settings').click();
    await page.getByTestId('ai-composer-team').click();
    await page.getByTestId('ai-team-menu').getByRole('button', { name: '팀으로', exact: true }).click();
    await run('02-toggle-parallel-write', '두 안내판의 대사를 바꿔줘. builder에게 team_lighthouse의 ev_lighthouse 대사를 "등대는 밤 여덟 시에 문을 닫습니다."로, events에게 team_dock의 ev_dock 대사를 "마지막 배는 밤 아홉 시에 출항합니다."로 각각 배정해. 두 맵은 별개이므로 두 배정을 먼저 시작하고 wait_agents 해. 기존 이벤트 ID와 위치는 유지하고 대사만 바꿔. 타일·그림·새 이벤트는 만들지 말고 finish 해.');
    await run('03-same-map-sequence', 'team 같은 맵의 후속 작업이다. 먼저 builder에게 team_lighthouse의 ev_lighthouse 대사를 "오늘 등대는 쉽니다."로 바꾸게 하고 wait_agents로 완료를 받아라. 그 뒤 같은 맵에 events를 배정해 최신 대사를 확인한 후 같은 이벤트 대사를 "내일 등대는 오전 열 시에 엽니다."로 바꾸게 해라. 두 작업을 동시에 실행하지 마라. 다른 내용은 바꾸지 말고 마지막 완료 후 finish 한다.');
    await run('04-plan-project-data', 'team assign_task_agent(member=builder,mode=read)에게 기존 actor_hero의 이름을 조회해 보고하게 해라. report_task 결과를 받은 뒤 assign_task_agent(member=events,mode=project)에게 기존 actor_hero의 이름만 "하린"으로 수정하게 해라. 읽기와 프로젝트 쓰기는 하나씩 순서대로 실행하고 기존 actor id, 그림, 능력치, 맵·이벤트는 유지한다. 완료 보고를 받은 후 finish 한다.');
    // Reload clears the team's cached specification; next request has review enabled.
    await page.evaluate(team => localStorage.setItem('oprn:pi-team', JSON.stringify(team)), specs(true));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__oprnAiBridge?.status().ready, null, { timeout: 120000 });
    await run('05-translation-reviewed', 'team 두 안내판의 대사를 영어로 번역해라. builder는 team_lighthouse의 ev_lighthouse, events는 team_dock의 ev_dock의 현재 한국어 대사만 영어로 바꾼다. 다른 텍스트·이벤트 id·위치·명령 종류와 순서·맵·캐릭터·DB는 변경하지 않는다. 맵별로 assign_map_agent로 배정하고 완료 후 검수 조수가 원문 의미와 구조 보존을 조회로 확인한다. finish 한다.');
    await run('06-stop', 'team 읽기 전용이다. builder에게 team_lighthouse를, events에게 team_dock을 assign_map_agent로 배정하라. 각 조수는 안내판과 맵 구조를 get_map_region으로 여러 구역 확인하고 10문장으로 상세히 보고한다. 프로젝트는 수정하지 마라. 두 조수가 완료되면 finish 한다.', { stop: true });
    await run('07-retry-after-stop', 'team 직전 읽기 작업 중단 이후 다시 조회한다. builder에게 team_lighthouse의 ev_lighthouse를 조회해 현재 영어 대사 한 문장을 보고하게 한다. 읽기만 하고 다른 작업을 배정하지 마라. 완료되면 finish 한다.');
    }
    report.finished = new Date().toISOString();
    report.final = sqlite();
    await page.screenshot({ path: out + '/08-reloaded-final.png' });
  } catch (e) {
    report.failure = e.message; await page.screenshot({ path: out + '/failure.png' }).catch(() => {}); console.error('FAILURE', e.message); process.exitCode = 1;
  } finally {
    const video = await page.video().path();
    await context.close(); await browser.close(); await host.close();
    const result = spawnSync('ffmpeg', ['-y', '-ss', String(runStart ? Math.max(0, (runStart - videoStart) / 1000) : 0), '-i', video, '-c:v', 'libx264', '-preset', 'fast', '-crf', '24', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out + '/team-exploration.mp4'], { encoding: 'utf8' });
    report.videoEncoded = result.status === 0;
    await save();
  }
});
