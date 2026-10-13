import { mkdirSync, writeFileSync, readFileSync, existsSync, linkSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { backup, DatabaseSync } from 'node:sqlite';
import { isDeepStrictEqual } from 'node:util';
import { gunzipSync } from 'node:zlib';
import { firefox } from 'playwright';
import { initLocalProjectStore } from '../../../../electron/local-store/store';
import { sharedContentFile } from '../../../../scripts/lib/sharedContentSqlite';
import { startHost, newEditor, stored, writeRuntimeProject } from './editorDriver.mjs';
import type { Project } from '../../../project/types';
import { judge, nativeProject, setupFor, fixtureProblems, MAP, normalizeContent, type Rect, type ToolRecord } from './matrixNativeSpec';

type MatrixCommand = { id: string; n: number; prompt: string; mode: string; runtime: string; visual: string; toolNames: string[] };
type EventRecord = { type?: string; id?: string; name?: string; args?: unknown; ok?: boolean; text?: string; message?: string; summary?: string };

const matrix = JSON.parse(readFileSync(resolve('harness-data/assistant-capability/command-matrix.json'), 'utf8')) as { commands: MatrixCommand[] };
const commandStart = Number(process.env.MATRIX_NATIVE_START ?? 0);
const commandLimit = process.env.MATRIX_NATIVE_LIMIT ? Number(process.env.MATRIX_NATIVE_LIMIT) : matrix.commands.length;
const only = process.env.MATRIX_NATIVE_ONLY ? new Set(process.env.MATRIX_NATIVE_ONLY.split(',')) : null;

/** The canonical row keeps big tilesets as $blob refs; judges that run read tools need the expanded runtime shape. */
const expandProject = (projectDir: string, snapshot: Project, file: string): Project => {
  writeRuntimeProject(projectDir, file, snapshot);
  return JSON.parse(readFileSync(file, 'utf8')) as Project;
};

const toSelection = (rect: Rect) => ({ mapId: MAP, x: rect.x, y: rect.y, width: rect.w, height: rect.h });

async function saveFresh(root: string, projectDir: string): Promise<void> {
  const local = await initLocalProjectStore({ projectDir });
  try { await local.saveProject(nativeProject()); }
  finally { local.close(); }
  const sharedSource = sharedContentFile();
  const pinned = resolve(root, 'shared-content.sqlite');
  if (existsSync(sharedSource) && !existsSync(pinned)) {
    const source = new DatabaseSync(sharedSource, { readOnly: true });
    try { await backup(source, pinned); }
    finally { source.close(); }
  }
  const target = resolve(projectDir, 'shared-content.sqlite');
  if (existsSync(pinned) && !existsSync(target)) linkSync(pinned, target);
}

async function saveThroughUi(page: any): Promise<void> {
  await page.getByTestId('toolbar-save').click();
  await page.waitForFunction(() => ['idle', 'saved'].includes(document.querySelector('[data-testid="toolbar-save"]')?.getAttribute('data-autosave-kind') ?? ''), null, { timeout: 120000 });
}

/** Type one prompt into the real input and wait until that turn is over. */
async function sendTurn(page: any, prompt: string, timeoutMs: number): Promise<EventRecord[]> {
  const start = await page.evaluate(() => window.__capEvents?.length ?? 0);
  await page.getByTestId('ai-input').fill(prompt);
  await page.getByTestId('ai-send').click();
  try {
    await page.waitForFunction((from: number) => {
      const events = (window.__capEvents ?? []).slice(from);
      return window.__oprnAiBridge?.status().turnBusy === false && events.some((event: any) => event.type === 'stream_closed');
    }, start, { timeout: timeoutMs, polling: 500 });
  } finally {
    // A turn that never settled must not keep its map claim; the host is torn down per command anyway.
    (page as any).__turnEvents = await page.evaluate((from: number) => (window.__capEvents ?? []).slice(from), start).catch(() => []);
  }
  return (page as any).__turnEvents as EventRecord[];
}

export async function runMatrixNative(root: string, timeoutMs = 240000): Promise<number> {
  if (existsSync(root)) throw new Error(`기존 실행 덮어쓰기 거부: ${root}`);
  mkdirSync(root, { recursive: true });
  const problems = fixtureProblems(nativeProject());
  if (problems.length) throw new Error(`fixture 가 명령을 검증할 수 없다:\n - ${problems.join('\n - ')}`);
  const projectDir = resolve(root, 'project');
  mkdirSync(projectDir, { recursive: true });
  await saveFresh(root, projectDir);
  let browser: any;
  const checks: any[] = [];
  let nativeModelCalls = 0, nativeAgentCalls = 0, chatCompletions = 0, sqliteReloads = 0;
  const selected = matrix.commands.slice(commandStart, commandStart + commandLimit).filter(command => !only || only.has(command.id) || only.has(String(command.n)));
  try {
    browser = await firefox.launch({ headless: true, firefoxUserPrefs: { 'network.notify.changed': false, 'network.notify.IPv6': false, 'network.captive-portal-service.enabled': false, 'network.connectivity-service.enabled': false } });
    for (const command of selected) {
      const dir = resolve(root, command.id);
      mkdirSync(dir, { recursive: true });
      await saveFresh(root, projectDir);
      // One host per command. The relay keeps a map claim for up to RESUME_GRACE_MS after the browser
      // disconnects so a real user can reconnect; sharing a host would let one hung command turn every
      // following command into a 409 map-busy that is not the model's fault.
      let host: any;
      const requests: any[] = [];
      let editor: any;
      let events: EventRecord[] = [];
      let failure: string | undefined;
      const started = Date.now();
      const setup = setupFor(command.id);
      try {
        host = await startHost(projectDir, root);
        editor = await newEditor(browser, host.url, projectDir, { piApply: 'yolo', piApplyPolicyVersion: 1, piTeam: false, autonomyLevel: 'balanced' });
        const page = editor.page;
        // Boot migrations and bundled asset folding can rewrite the canonical document. Establish the
        // comparison baseline only after the real UI has loaded and flushed that normalization.
        await saveThroughUi(page);
        const original = stored(projectDir);
        writeFileSync(resolve(dir, 'original.json'), JSON.stringify(original.project));
        page.on('request', (request: any) => {
          if (request.method() !== 'POST' || !/\/v1\/(agent\/run|chat\/completions)/.test(request.url())) return;
          let body: any = {}, raw = '';
          try {
            const buffer = request.postDataBuffer();
            raw = buffer ? (buffer[0] === 31 ? gunzipSync(buffer) : buffer).toString('utf8') : '';
            body = JSON.parse(raw || '{}');
          } catch { /* structural receipt only */ }
          // What the model was told about the editor: the receipt for "this event" / "this area" being a given referent.
          const context = [...raw.replace(/\\n/g, '\n').matchAll(/(\[선택한 이벤트\]|\[컨텍스트\])[^\n"]*/gu)].map(match => match[0].slice(0, 300)).join(' | ') || undefined;
          requests.push({ endpoint: new URL(request.url()).pathname, model: body.model, provider: request.headers()['x-oprn-provider'], runId: body.runId, context });
        });
        page.on('response', (response: any) => {
          const endpoint = new URL(response.url()).pathname;
          if (!/\/v1\/(agent\/run|chat\/completions)/.test(endpoint)) return;
          const request = [...requests].reverse().find(entry => entry.endpoint === endpoint && entry.status === undefined);
          if (!request) return;
          request.status = response.status();
          void response.text().then((body: string) => { request.responseBytes = body.length; request.responsePreview = body.slice(0, 240); }).catch(() => {});
        });
        // A command about "what you just did" needs a real earlier turn, run through the same input.
        if (setup.prior) {
          if (setup.prior.select) await page.evaluate((value: any) => window.__oprnRegionTaskHarness?.setSelection(value), toSelection(setup.prior.select));
          const priorEvents = await sendTurn(page, setup.prior.prompt, timeoutMs);
          writeFileSync(resolve(dir, 'prior-trace.json'), JSON.stringify(priorEvents, null, 2));
          if (!priorEvents.some(event => event.type === 'tool_end' && event.ok === true)) throw new Error('선행 턴이 변경을 만들지 못했다');
          await saveThroughUi(page);
        }
        const baseline = stored(projectDir);
        writeFileSync(resolve(dir, 'before.json'), JSON.stringify(baseline.project));
        const requestsBefore = requests.length;
        // Seed the editor state a person would have set before typing the prompt.
        await page.evaluate((value: any) => {
          const hook = window.__oprnRegionTaskHarness;
          hook?.setSelection(value.select);
          hook?.selectEvent?.(value.event, null);
        }, { select: setup.select ? toSelection(setup.select) : null, event: setup.event ?? null });
        events = await sendTurn(page, command.prompt, timeoutMs);
        await saveThroughUi(page);
        // Reviewers must see which command this screen answers: bring the user's bubble to the top of the chat, keep the end-of-chat view as well.
        await page.screenshot({ path: resolve(dir, 'after-chat-end.png') });
        await page.evaluate((text: string) => {
          const leaves = [...document.querySelectorAll('*')].filter(node => node.children.length === 0 && (node.textContent ?? '').trim() === text);
          leaves[leaves.length - 1]?.scrollIntoView({ block: 'start' });
        }, command.prompt);
        await page.waitForTimeout(400);
        await page.screenshot({ path: resolve(dir, 'after.png') });
        const applied = stored(projectDir);
        writeFileSync(resolve(dir, 'after.json'), JSON.stringify(applied.project));
        writeFileSync(resolve(dir, 'trace.json'), JSON.stringify(events, null, 2));
        const toolEnds = events.filter(event => event.type === 'tool_end');
        const records: ToolRecord[] = toolEnds.map(event => ({ name: event.name, ok: event.ok, args: event.args, summary: event.summary }));
        const answer = events.filter(event => event.type === 'assistant').map(event => event.text ?? '').join('\n');
        const turnOk = toolEnds.some(event => event.ok === true)
          && events.some(event => event.type === 'done')
          && !events.some(event => ['error', 'cancelled', 'stream_error'].includes(event.type ?? ''));
        const scratch = resolve(dir, 'expanded.json');
        const verdict = judge(command.id, {
          original: expandProject(projectDir, original.project as Project, scratch),
          before: expandProject(projectDir, baseline.project as Project, scratch),
          after: expandProject(projectDir, applied.project as Project, scratch),
          tools: records, answer,
        });
        rmSync(scratch, { force: true });
        await editor.context.close();
        editor = undefined;
        const reloadedEditor = await newEditor(browser, host.url, projectDir, { piApply: 'yolo', piApplyPolicyVersion: 1, piTeam: false, autonomyLevel: 'balanced' });
        const reloaded = stored(projectDir);
        await reloadedEditor.page.screenshot({ path: resolve(dir, 'reloaded.png') });
        await reloadedEditor.context.close();
        const persistence = applied.sha256 === reloaded.sha256 && applied.projectId === reloaded.projectId;
        sqliteReloads++;
        const commandRequests = requests.slice(requestsBefore);
        for (const request of commandRequests) request.endpoint === '/v1/agent/run' ? nativeAgentCalls++ : chatCompletions++;
        nativeModelCalls += commandRequests.length;
        const changed = !isDeepStrictEqual(normalizeContent(baseline.project as Project), normalizeContent(applied.project as Project));
        // A command passes only when the real turn finished, the document judged correct, and the
        // persisted row reloads identically. Which tool the model chose is reported, never gated.
        const ok = turnOk && verdict.ok && persistence;
        const row = { n: command.n, id: command.id, ok, turnOk, commandCorrect: verdict.ok, verdict: verdict.note, persistence, changed, mode: command.mode, referenceTools: command.toolNames, toolCalls: toolEnds.map(event => event.name), toolRecords: records, requests: commandRequests, assistantText: answer, elapsedMs: Date.now() - started, failure };
        checks.push(row);
        writeFileSync(resolve(dir, 'native-result.json'), JSON.stringify(row, null, 2));
        console.error(`[matrix-native] #${command.n}/50 ${command.id} ${ok ? 'ok' : 'fail'} requests=${commandRequests.length} tools=${toolEnds.length} persisted=${persistence} :: ${verdict.note}`);
      } catch (error) {
        failure = error instanceof Error ? error.message : String(error);
        const page = editor?.page;
        const late: EventRecord[] = page ? await page.evaluate(() => window.__capEvents ?? []).catch(() => []) : events;
        if (page) await page.screenshot({ path: resolve(dir, 'failure.png') }).catch(() => {});
        writeFileSync(resolve(dir, 'trace.json'), JSON.stringify(late, null, 2));
        await editor?.context?.close().catch(() => {});
        const row = { n: command.n, id: command.id, ok: false, turnOk: false, commandCorrect: false, persistence: false, mode: command.mode, referenceTools: command.toolNames, toolCalls: late.filter(event => event.type === 'tool_end').map(event => event.name), requests, assistantText: late.filter(event => event.type === 'assistant').map(event => event.text ?? '').join('\n'), elapsedMs: Date.now() - started, failure };
        checks.push(row);
        writeFileSync(resolve(dir, 'native-result.json'), JSON.stringify(row, null, 2));
        console.error(`[matrix-native] #${command.n}/50 ${command.id} fail: ${failure}`);
      } finally {
        await host?.close();
      }
    }
  } finally {
    await browser?.close().catch(() => {});
  }
  const complete = !only && commandStart === 0 && commandLimit >= matrix.commands.length;
  const outcome = {
    schemaVersion: 2,
    kind: 'assistant-small-command-native',
    transport: 'real-editor-input',
    status: checks.length === selected.length && checks.every(row => row.ok) ? (complete ? 'pass' : 'partial-pass') : 'fail',
    total: checks.length,
    pass: checks.filter(row => row.ok).length,
    fail: checks.filter(row => !row.ok).length,
    execution: { inputPosts: checks.length, nativeModelCalls, nativeAgentCalls, chatCompletions, sqliteReloads, visualReviews: 0 },
    checks,
    limitations: ['시각 검수는 별도 review 영수증이 필요하다.', '읽기 명령도 성공한 tool_end 와 사실에 맞는 답변이 있어야 통과한다.', '도구 이름은 판정하지 않는다 — 명령이 말한 결과와 나머지 내용의 보존을 판정한다.'],
  };
  writeFileSync(resolve(root, 'matrix-native.json'), JSON.stringify(outcome, null, 2));
  writeFileSync(resolve(root, 'SUMMARY.md'), `# 50개 작은 명령 실제 모델 검증\n\n상태: **${outcome.status}**\n\n실제 입력 ${outcome.execution.inputPosts}건 · native 모델 호출 ${nativeModelCalls}건 · agent ${nativeAgentCalls}건 · chat ${chatCompletions}건 · SQLite 새 context 재로드 ${sqliteReloads}건 · 독립 시각 검수 0건\n\n통과 ${outcome.pass}/${outcome.total} · 실패 ${outcome.fail}/${outcome.total}\n\n${checks.map(row => `- ${row.ok ? '✅' : '❌'} #${row.n} ${row.id} — ${row.verdict ?? row.failure ?? ''}`).join('\n')}\n`);
  return outcome.status === 'fail' ? 1 : 0;
}
