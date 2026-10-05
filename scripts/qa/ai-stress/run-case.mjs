// 조수 스트레스 과제 하나: 새 SQLite 프로젝트 → 호스트 → 실제 편집기 → 실제 모델 → 저장 → 재로드 → qa:game check.
// 모델·저장·전송을 흉내 내지 않는다. 사용: node scripts/qa/ai-stress/run-case.mjs <caseId> <outDir>
// 먼저 build:fast + build:electron. 결과는 <outDir>/<caseId>/result.json · chat.txt · *.png · project.json · check.txt
import { buildTsModule, withTsModule } from '../../ontology-ts-loader.mjs';
import { chromium } from 'playwright';
import { resolve } from 'node:path';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { spawn, spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { tmpdir } from 'node:os';
import { CASES } from './cases.mjs';

const [caseId, outRoot] = process.argv.slice(2);
const spec = CASES.find(c => c.id === caseId);
if (!spec || !outRoot) { console.error('usage: run-case.mjs <caseId> <outDir>'); process.exit(2); }
const TURN_LIMIT_MS = Number(process.env.STRESS_TURN_MS ?? 35 * 60_000);
const out = resolve(outRoot, caseId);
const projectDir = resolve(out, 'project');
await mkdir(out, { recursive: true });
const result = { caseId, kind: spec.kind, expect: spec.expect, prompt: spec.prompt ?? null, started: new Date().toISOString(),
  pageErrors: [], consoleErrors: [], modals: [], http400: [] };
const save = () => writeFile(out + '/result.json', JSON.stringify(result, null, 2) + '\n');
const log = (...a) => console.log(`[${caseId}]`, ...a);

const readSqlite = () => {
  const db = new DatabaseSync(projectDir + '/project.sqlite', { readOnly: true });
  try {
    const row = db.prepare('SELECT project_id,revision,current_json FROM project WHERE id=1').get();
    const project = JSON.parse(row.current_json);
    const maps = Object.fromEntries(db.prepare('SELECT map_id,map_json FROM maps').all().map(r => [r.map_id, JSON.parse(r.map_json)]));
    return { projectId: row.project_id, revision: row.revision, project, maps };
  } finally { db.close(); }
};
const digest = (snap) => ({
  revision: snap.revision, title: snap.project.meta?.title, startMapId: snap.project.startMapId,
  maps: Object.values(snap.maps).map(m => ({ id: m.id, name: m.name, w: m.width, h: m.height, events: (m.events ?? []).length })),
  actors: snap.project.database?.actors?.length, items: snap.project.database?.items?.length,
  enemies: snap.project.database?.enemies?.length, troops: snap.project.database?.troops?.length,
  switches: snap.project.switches?.length, variables: snap.project.variables?.length, endings: snap.project.endings?.length,
});

// ── 1. 시드 ──
const seedFile = resolve(tmpdir(), `oprn-stress-seed-${process.pid}.mjs`);
await buildTsModule(resolve('scripts/qa/ai-stress/seed-entry.ts'), seedFile);
const S = await import(seedFile);
let seed;
if (spec.kind === 'genre') {
  const input = JSON.parse(await readFile(resolve(spec.brief), 'utf8'));
  const choice = S.newProjectChoiceById(input.presetId);
  const brief = S.normalizeGameDesignBrief({ ...input.brief, version: 1, presetId: input.presetId });
  seed = S.createNewProjectSeed(choice.packId, input.title);
  // 마법사가 저장하는 모양 그대로 — 다시 열면 prepareProjectInterviewStartup 이 팀 첫 생성을 자동 전송한다.
  seed.gameDesignBrief = { ...brief, generationPending: true };
  result.title = input.title;
} else {
  const choice = S.newProjectChoiceById(spec.pack);
  seed = S.createNewProjectSeed(choice.packId, '스트레스 ' + caseId);
}
await withTsModule(resolve('electron/local-store/store.ts'), `stress-store-${process.pid}.mjs`, async ({ initLocalProjectStore }) => {
  const store = await initLocalProjectStore({ projectDir });
  try {
    if (store.info().revision > 0) throw new Error('project dir not empty: ' + projectDir);
    await store.saveSerialized(S.serialize(seed), null);
  } finally { store.close(); }
});
result.seed = digest(readSqlite()); await save();

const http400Dir = resolve(process.env.HOME, '.omp/logs/http-400-requests');
const list400 = async () => { try { return new Set(await readdir(http400Dir)); } catch { return new Set(); } };
const before400 = await list400();

// ── 2. 호스트 + 편집기 ──
// 호스트 모듈을 임시 폴더로 번들하므로 import.meta.url 기준 워커 경로가 /tmp 를 가리킨다 — 저장소 워커를 명시한다.
process.env.OPRN_OH_MY_PI_WORKER_SCRIPT ??= resolve('scripts/oh-my-pi-worker.ts');
await withTsModule(resolve('electron/serve/runtime.ts'), `stress-host-${process.pid}.mjs`, async ({ startLocalProjectServer }) => {
  const host = await startLocalProjectServer({ projectDir, distDir: resolve('dist'),
    browserBridgeSource: await readFile('dist-electron/browser-bridge.js', 'utf8'), enableOwnerAi: true });
  const hostUrl = new URL(host.url);
  const hostPort = hostUrl.port;
  hostUrl.hostname = '127.0.0.1';
  const sock = resolve(tmpdir(), `oprn-stress-${process.pid}.sock`);
  const outer = spawn('socat', [`UNIX-LISTEN:${sock},fork,unlink-early`, `TCP:127.0.0.1:${hostPort}`], { stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 300));
  const browser = await chromium.launch({ executablePath: resolve('scripts/qa/ai-stress/chrome-netns.sh'), headless: true,
    env: { ...process.env, STRESS_HOST_PORT: hostPort, STRESS_SOCK: sock },
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-background-networking', '--enable-precise-memory-info',
      // 이 박스는 다른 세션 때문에 전역 OOM 이 잦고, 크롬은 렌더러에 oom_score_adj 300 을 줘서 늘 먼저 죽는다.
      // 한 프로세스로 띄워 페이지를 adj 0 인 브라우저 프로세스 안에 둔다(STRESS_MULTI_PROCESS=1 이면 기본 구성).
      ...(process.env.STRESS_MULTI_PROCESS === '1' ? [] : ['--single-process', '--no-zygote'])] });
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  page.on('pageerror', e => result.pageErrors.push(String(e.message).slice(0, 600)));
  page.on('console', m => { if (m.type() === 'error') result.consoleErrors.push(m.text().slice(0, 400)); });
  let crashed = false;
  page.on('crash', () => { crashed = true; result.pageErrors.push('PAGE CRASHED'); });
  // 죽은 페이지에 evaluate 하면 끝없이 기다린다 — 모든 관측에 시한을 건다.
  const timed = (promise, ms = 20000) => Promise.race([promise, new Promise((_, rej) => setTimeout(() => rej(new Error('observe timeout')), ms))]);
  await page.addInitScript(() => {
    localStorage.setItem('oprn:locale', 'ko');
    localStorage.setItem('oprn:standard-welcome-seen', '1');
    localStorage.setItem('oprn:editor-welcome-dismissed', '1');
    localStorage.setItem('oprn:ai-activity-level', 'brief');
    window.__stress = { requests: [], events: [] };
    const real = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const url = new URL(typeof input === 'string' ? input : input.url, location.href);
      if (url.pathname !== '/v1/agent/run' || init?.method !== 'POST') return real(input, init);
      let body = init.body;
      if (new Headers(init.headers).get('Content-Encoding') === 'gzip') body = await new Response(new Blob([body]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
      const req = JSON.parse(typeof body === 'string' ? body : await new Response(body).text());
      const receipt = { at: Date.now(), mode: req.mode, runId: req.runId, provider: req.provider, model: req.model, task: String(req.task ?? '').slice(0, 300) };
      window.__stress.requests.push(receipt);
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
            let e; try { e = JSON.parse(line); } catch { continue; }
            const d = e.type === 'agent_event' ? e.event : e;
            if (['delta', 'heartbeat', 'prompt_inspection', 'thinking'].includes(d.type)) continue;
            const item = { t: Date.now(), type: e.type, actor: e.agentId, kind: d.type, name: d.name, ok: d.ok ?? e.ok,
              summary: typeof d.summary === 'string' ? d.summary.slice(0, 500) : undefined };
            const text = v => v == null ? '' : typeof v === 'string' ? v : JSON.stringify(v);
            if (d.type === 'tool_end' && d.ok === false) item.error = text(d.error ?? d.result ?? d.summary).slice(0, 1200);
            if (e.type === 'agent_spawn') Object.assign(item, { role: e.role, memberId: e.memberId, mapId: e.mapId });
            if (d.type === 'assistant') item.text = String(d.text ?? '').slice(0, 1500);
            if (e.type === 'error' || d.type === 'error') item.error = text(e.error ?? e.message ?? d.error ?? d.message).slice(0, 1500);
            if (e.type === 'agent_exit' || d.type === 'agent_end' || d.type === 'done') item.final = String(d.error ?? d.summary ?? '').slice(0, 800);
            window.__stress.events.push(item);
          }
        }
      })().catch(err => { window.__stress.observerError = String(err?.message ?? err); });
      return new Response(application, { status: response.status, statusText: response.statusText, headers: response.headers });
    };
  });

  const status = () => crashed ? Promise.reject(new Error('page crashed')) : timed(page.evaluate(() => ({ s: window.__oprnAiBridge?.status?.(), requests: window.__stress.requests.length,
    events: window.__stress.events.length })));
  const modalText = () => page.evaluate(() => {
    const el = [...document.querySelectorAll('[role="dialog"], [role="alertdialog"], .modal, .confirm-dialog')]
      .find(n => n instanceof HTMLElement && n.offsetParent !== null && n.innerText.trim());
    return el ? el.innerText.trim().slice(0, 800) : null;
  });
  const cdp = await context.newCDPSession(page);
  await cdp.send('Performance.enable').catch(() => {});
  result.memory = [];
  const sampleMemory = async (label) => {
    const m = await timed(cdp.send('Performance.getMetrics')).catch(() => null);
    if (!m) return null;
    const get = name => m.metrics.find(x => x.name === name)?.value ?? 0;
    const sample = { t: Math.round((Date.now() - t0) / 1000), label, heapMB: Math.round(get('JSHeapUsedSize') / 1048576),
      heapTotalMB: Math.round(get('JSHeapTotalSize') / 1048576), nodes: get('Nodes'), listeners: get('JSEventListeners') };
    result.memory.push(sample);
    return sample;
  };
  let wireSeen = 0;
  const dumpWire = async () => {
    // 렌더러가 죽어도 그때까지의 기록은 남게 매 폴링 새 사건만 덧붙인다.
    const fresh = await timed(page.evaluate(n => ({ events: window.__stress.events.slice(n), requests: window.__stress.requests }), wireSeen)).catch(() => null);
    if (!fresh) return;
    wireSeen += fresh.events.length;
    if (fresh.events.length) await writeFile(out + '/wire-live.ndjson', fresh.events.map(e => JSON.stringify(e)).join('\n') + '\n', { flag: 'a' });
    result.liveRequests = fresh.requests.map(r => ({ mode: r.mode, model: r.model, status: r.status }));
  };
  const t0 = Date.now();
  try {
    await page.goto(hostUrl.href, { waitUntil: 'domcontentloaded', timeout: 180000 });
    if (await page.locator('input[name=token]').isVisible().catch(() => false)) {
      await page.locator('input[name=token]').fill(host.ownerAccessCode);
      await page.getByRole('button', { name: '작업실 들어가기' }).click();
    }
    await page.waitForFunction(() => window.__oprnAiBridge?.status().ready, null, { timeout: 480000 });
    await page.locator('[data-testid="edit-canvas"] canvas').waitFor({ timeout: 480000 });
    result.bootSeconds = Math.round((Date.now() - t0) / 1000);
    await sampleMemory('ready');
    log('ready', result.bootSeconds + 's');

    await page.screenshot({ path: out + '/ready.png' });
    result.progress = { phase: 'ready' }; await save();
    if (spec.kind === 'prompt') {
      if (spec.team) {
        await page.getByTestId('ai-composer-settings').click();
        await page.getByTestId('ai-composer-team').click();
        await page.getByTestId('ai-team-menu').getByRole('button', { name: '팀으로', exact: true }).click();
        await page.keyboard.press('Escape').catch(() => {});
      }
      await page.getByTestId('ai-input').fill(spec.prompt);
      await page.getByTestId('ai-send').click();
    } else {
      // 부팅 자동 전송을 기다린다.
      const until = Date.now() + 6 * 60_000;
      // 첫 생성 준비(자산·저장)가 주 스레드를 오래 잡는다 — 관측 시한 초과는 기다림으로 본다.
      const requestsNow = () => status().then(st => st.requests, error => { if (crashed) throw error; return 0; });
      while (Date.now() < until && await requestsNow() === 0) await page.waitForTimeout(2000);
      if (await requestsNow() === 0) { result.autoSendStarted = false; throw new Error('장르 첫 생성이 6분 안에 자동 전송되지 않았다'); }
      result.autoSendStarted = true;
    }
    result.sentAt = Date.now();
    // 턴 시작 뒤 살아 있는 할당을 호출 스택별로 본다(heap-sampling.json). 렌더러 힙이 턴 시작에 1GB+ 뛰는 원인 추적용.
    const heapSampleSeconds = Number(process.env.STRESS_HEAP_SAMPLE_S ?? 90);
    if (heapSampleSeconds > 0) {
      await cdp.send('HeapProfiler.enable').catch(() => {});
      await cdp.send('HeapProfiler.startSampling', { samplingInterval: 256 * 1024 }).catch(() => {});
      setTimeout(async () => {
        try {
          const { profile } = await cdp.send('HeapProfiler.getSamplingProfile');
          await cdp.send('HeapProfiler.stopSampling').catch(() => {});
          await writeFile(out + '/heap-sampling.json', JSON.stringify(profile)); log('heap sampling saved');
        } catch (error) { log('heap sampling failed', error?.message); }
      }, heapSampleSeconds * 1000);
    }
    // STRESS_PROFILE_S=<초>: 보낸 뒤 그 시간 동안 렌더러 CPU 프로필을 떠서 멈춤 원인을 본다(cpu.cpuprofile).
    const profileSeconds = Number(process.env.STRESS_PROFILE_S ?? 0);
    if (profileSeconds > 0) {
      await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 2000 }); await cdp.send('Profiler.start');
      setTimeout(async () => {
        try { const { profile } = await cdp.send('Profiler.stop'); await writeFile(out + '/cpu.cpuprofile', JSON.stringify(profile)); log('profile saved'); }
        catch (error) { log('profile failed', error?.message); }
      }, profileSeconds * 1000);
    }

    // ── 3. 턴 종료 대기 ──
    let idle = 0, modalSince = 0;
    const until = Date.now() + TURN_LIMIT_MS;
    while (Date.now() < until) {
      await page.waitForTimeout(5000);
      if (crashed) throw new Error('page crashed during turn');
      let st;
      const pollAt = Date.now();
      try { st = await status(); }
      catch (error) {
        if (crashed) throw error;
        // 페이지 주 스레드가 20초 넘게 응답하지 않았다 — 편집기 멈춤으로 기록하고 계속 본다(10분 연속이면 포기).
        result.freezes ??= [];
        const last = result.freezes.at(-1);
        if (last && pollAt - last.until < 30000) { last.until = Date.now(); last.seconds = Math.round((last.until - last.from) / 1000); }
        else result.freezes.push({ at: Math.round((pollAt - result.sentAt) / 1000), from: pollAt, until: Date.now(), seconds: 20 });
        await save();
        if (result.freezes.at(-1).seconds > 600) throw new Error('editor unresponsive for 10 minutes');
        continue;
      }
      const modal = await timed(modalText()).catch(() => null);
      // 밖에서 진행을 볼 수 있게 매 폴링 상태를, 1분마다 화면을 남긴다.
      const mem = await sampleMemory('turn');
      await dumpWire();
      result.progress = { at: Math.round((Date.now() - result.sentAt) / 1000), requests: st.requests, events: st.events,
        turnBusy: st.s?.turnBusy, modal: !!modal, heapMB: mem?.heapMB };
      await save();
      if (result.progress.at % 60 < 5) await timed(page.screenshot({ path: out + '/progress.png' })).catch(() => {});
      if (modal) {
        if (!result.modals.some(m => m.text === modal)) {
          result.modals.push({ at: Math.round((Date.now() - result.sentAt) / 1000), text: modal });
          await page.screenshot({ path: `${out}/modal-${result.modals.length}.png` });
          log('modal', modal.slice(0, 120));
        }
        modalSince ||= Date.now();
        // 사람이 답해야 하는 창. 파괴 과제는 그대로 두고 기록만, 다른 과제는 3분 뒤 취소로 닫는다.
        if (spec.id !== 'p-destructive' && Date.now() - modalSince > 180_000) {
          await page.keyboard.press('Escape').catch(() => {}); result.modals.at(-1).dismissed = true; modalSince = 0;
        }
      } else modalSince = 0;
      if (st.requests > 0 && st.s && !st.s.turnBusy && !modal) { if (++idle >= 2) break; } else idle = 0;
      if (spec.id === 'p-destructive' && modal && Date.now() - result.sentAt > 60_000) break;
    }
    result.turnSeconds = Math.round((Date.now() - result.sentAt) / 1000);
    // 멈춤이 길면 마지막 상태도 못 읽는다 — 그때는 바쁜 것으로 보고 중단한다.
    const final = await status().catch(() => ({ s: { turnBusy: true } }));
    if (final.s?.turnBusy) {
      result.timedOut = true; log('timeout → abort');
      await page.evaluate(() => window.__oprnAiBridge.abort());
      await page.waitForFunction(() => !window.__oprnAiBridge.status().turnBusy, null, { timeout: 90000 }).catch(() => {});
    }
    await page.waitForTimeout(3000);
    result.chatTail = (await page.getByTestId('ai-chat-log').innerText().catch(() => '')).slice(-20000);
    await writeFile(out + '/chat.txt', result.chatTail);
    result.chatTail = result.chatTail.slice(-3000);
    const wire = await page.evaluate(() => window.__stress);
    await writeFile(out + '/wire.json', JSON.stringify(wire, null, 1));
    result.requests = wire.requests.map(r => ({ mode: r.mode, model: r.model, status: r.status }));
    result.toolCalls = wire.events.filter(e => e.kind === 'tool_end').length;
    result.toolFailures = wire.events.filter(e => e.kind === 'tool_end' && e.ok === false).map(e => ({ actor: e.actor, name: e.name, error: e.error }));
    result.errorEvents = wire.events.filter(e => e.error && e.kind !== 'tool_end').map(e => ({ actor: e.actor, kind: e.kind, error: e.error }));
    result.agents = wire.events.filter(e => e.type === 'agent_spawn').map(e => ({ role: e.role, memberId: e.memberId, mapId: e.mapId }));
    result.lastAssistant = wire.events.filter(e => e.kind === 'assistant' && e.text).map(e => e.text).slice(-2);
    result.audit = await page.evaluate(() => window.__oprnAiBridge.audit?.()).catch(() => null);
    await page.screenshot({ path: out + '/after.png' });

    // ── 4. 저장 확인 + 재로드 ──
    const after = readSqlite();
    result.after = digest(after);
    await writeFile(out + '/project.json', JSON.stringify({ ...after.project, maps: after.maps }));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__oprnAiBridge?.status().ready, null, { timeout: 480000 });
    const loaded = await page.evaluate(async () => {
      const r = await window.oprn.project.loadFolded({});
      const p = JSON.parse(r.folded ?? r.serialized);
      return { revision: r.revision, maps: Object.values(p.maps).map(m => ({ id: m.id, events: (m.events ?? []).map(e => e.id).sort() })) };
    });
    const sqliteMaps = Object.values(readSqlite().maps).map(m => ({ id: m.id, events: (m.events ?? []).map(e => e.id).sort() }));
    const norm = a => JSON.stringify([...a].sort((x, y) => x.id.localeCompare(y.id)));
    result.reloadMatches = norm(loaded.maps) === norm(sqliteMaps);
    await page.locator('[data-testid="edit-canvas"] canvas').waitFor({ timeout: 120000 }).catch(() => {});
    await page.waitForTimeout(4000);
    await page.screenshot({ path: out + '/reloaded.png' });
    await sampleMemory('reloaded');
  } catch (e) {
    result.failure = String(e?.stack ?? e).slice(0, 2000); log('FAILURE', e?.message);
    result.crashedAt = result.sentAt ? Math.round((Date.now() - result.sentAt) / 1000) : null;
    await page.screenshot({ path: out + '/failure.png' }).catch(() => {});
  } finally {
    await context.close().catch(() => {}); await browser.close().catch(() => {}); await host.close().catch(() => {});
    outer.kill();
    spawnSync('pkill', ['-f', `UNIX-CONNECT:${sock}`]);
  }
});

// 실행 중 새로 생긴 400 원 요청(같은 박스의 다른 세션 것일 수 있다 — 시각으로만 묶는다).
for (const name of await list400()) {
  if (before400.has(name)) continue;
  try {
    const d = JSON.parse(await readFile(resolve(http400Dir, name), 'utf8'));
    result.http400.push({ file: name, model: d.model, message: String(d.errorResponse?.message ?? '').slice(0, 600) });
  } catch { /* 쓰는 중 */ }
}

// 호스트를 닫은 뒤 저장소 API 로 정본 전체(타일셋·에셋 포함)를 다시 읽어 검사 입력으로 쓴다 — 표 행만 이어 붙이면 로더가 거부한다.
try {
  await withTsModule(resolve('electron/local-store/store.ts'), `stress-reload-${process.pid}.mjs`, async ({ initLocalProjectStore }) => {
    const store = await initLocalProjectStore({ projectDir });
    try {
      const snapshot = store.loadSnapshot();
      await writeFile(out + '/project.json', S.serialize(snapshot.project));
      result.canonicalReload = { sha256: snapshot.sha256, revision: store.info().revision };
    } finally { store.close(); }
  });
} catch (error) { result.canonicalReloadError = String(error?.message ?? error).slice(0, 500); }

// ── 5. 오프라인 검사 ──
try {
  await stat(out + '/project.json');
  const check = spawnSync('bun', ['scripts/qa-game/cli.mts', 'check', '--project', out + '/project.json'], { encoding: 'utf8', timeout: 600000 });
  await writeFile(out + '/check.txt', (check.stdout ?? '') + (check.stderr ?? ''));
  result.checkExit = check.status;
  result.checkHead = (check.stdout ?? '').split('\n').slice(0, 40).join('\n');
} catch { /* 프로젝트 없음 */ }
result.finished = new Date().toISOString();
await save();
log('done', JSON.stringify({ turn: result.turnSeconds, tools: result.toolCalls, fails: result.toolFailures?.length, errs: result.errorEvents?.length,
  timeout: !!result.timedOut, reload: result.reloadMatches, check: result.checkExit, failure: !!result.failure }));
process.exit(0);
