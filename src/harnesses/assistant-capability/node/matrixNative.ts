import { mkdirSync, mkdtempSync, writeFileSync, readFileSync, existsSync, linkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { backup, DatabaseSync } from 'node:sqlite';
import { isDeepStrictEqual } from 'node:util';
import { gunzipSync } from 'node:zlib';
import { firefox } from 'playwright';
import { initLocalProjectStore } from '../../../../electron/local-store/store';
import { sharedContentFile } from '../../../../scripts/lib/sharedContentSqlite';
import { createOpenAiCompatStore } from '../../../../scripts/lib/openAiCompatStore';
import { startHost, newEditor, stored, writeRuntimeProject } from './editorDriver.mjs';
import type { Project } from '../../../project/types';
import { judge, nativeProject, cachedNativeProject, setupFor, fixtureProblems, MAP, normalizeContent, type Rect, type ToolRecord } from './matrixNativeSpec';
import type { ThinkingEffort } from '../../../ai/modelRoles';
import { findFamily } from './families';

type MatrixCommand = {
  id: string; n: number; prompt: string; mode: string;
  runtime?: string; visual?: string; toolNames?: string[];
  family?: string; variant?: string; area?: string;
  args?: Record<string, unknown>;
  setup?: { select?: Rect; event?: string; prior?: { prompt: string; select?: Rect } };
};
type EventRecord = { type?: string; id?: string; name?: string; args?: unknown; ok?: boolean; text?: string; message?: string; summary?: string };

type ProviderPin = { provider: string; model: string; thinkingLevel: ThinkingEffort };

const specName = process.env.MATRIX_NATIVE_SPEC?.trim();
if (specName && specName !== '500') throw new Error(`MATRIX_NATIVE_SPEC 은 500 만 받습니다(받은 값: ${specName}). 비우면 50개 기본 행렬입니다.`);
const spec500 = specName === '500';
const matrix = JSON.parse(readFileSync(resolve(spec500
  ? 'harness-data/assistant-capability/command-matrix-500.json'
  : 'harness-data/assistant-capability/command-matrix.json'), 'utf8')) as { commands: MatrixCommand[] };
const commandStart = Number(process.env.MATRIX_NATIVE_START ?? 0);
const commandLimit = process.env.MATRIX_NATIVE_LIMIT ? Number(process.env.MATRIX_NATIVE_LIMIT) : matrix.commands.length;
const only = process.env.MATRIX_NATIVE_ONLY ? new Set(process.env.MATRIX_NATIVE_ONLY.split(',')) : null;

/** The canonical row keeps big tilesets as $blob refs; judges that run read tools need the expanded runtime shape. */
const expandProject = (projectDir: string, snapshot: Project, file: string): Project => {
  writeRuntimeProject(projectDir, file, snapshot);
  return JSON.parse(readFileSync(file, 'utf8')) as Project;
};

/** MATRIX_NATIVE_MODEL alone pins every role to one Antigravity model (product default when unset). */
const PIN_EFFORTS = ['off', 'low', 'medium', 'high', 'xhigh', 'max'] as const;

/**
 * Pins every role to one provider/model. An unreadable MATRIX_NATIVE_EFFORT is an error, not a silent
 * fallback: a run labelled 「max」 that actually sent 「low」 is worse than one that refused to start.
 */
function providerPin(): ProviderPin | null {
  const provider = process.env.MATRIX_NATIVE_PROVIDER?.trim();
  const model = process.env.MATRIX_NATIVE_MODEL?.trim();
  if (!provider) return null;
  if (!model) throw new Error('MATRIX_NATIVE_PROVIDER 를 지정하면 MATRIX_NATIVE_MODEL 도 지정해야 합니다 — 모델을 다른 것으로 대체하지 않습니다.');
  const raw = process.env.MATRIX_NATIVE_EFFORT?.trim();
  const level = raw ? PIN_EFFORTS.find(value => value === raw) : undefined;
  if (raw && !level) throw new Error(`MATRIX_NATIVE_EFFORT=${raw} 는 알 수 없는 값입니다 — ${PIN_EFFORTS.join('|')} 중 하나를 쓰세요.`);
  // InferHub accepts only low|high|max and kills the turn on 「off」 (2026-10-22 local proof), so a compat
  // pin never sends it: the default is the cheapest accepted effort and an explicit 「off」 is refused.
  if (provider.startsWith('openai-compat:') && level === 'off') {
    throw new Error('MATRIX_NATIVE_EFFORT=off 는 openai-compat 고정에서 쓸 수 없습니다 — InferHub 는 low|high|max 만 받습니다.');
  }
  return { provider, model, thinkingLevel: level ?? 'low' };
}

/**
 * Writes the InferHub endpoint into a throwaway store outside the run folder and points every
 * spawned host at it. The key lives only in that 0600 file, never in the run output, and the
 * directory is deleted when the pass ends.
 */
function prepareCompatEndpoint(pin: ProviderPin): { dir: string; reasoningMode: string } {
  if (pin.provider !== 'openai-compat:inferhub') {
    throw new Error(`MATRIX_NATIVE_PROVIDER: 지금은 openai-compat:inferhub 만 지원합니다(받은 값: ${pin.provider}).`);
  }
  if (pin.model !== 'deepseek-v4.1-flash') throw new Error(`inferhub 는 deepseek-v4.1-flash 만 허용합니다(받은 값: ${pin.model}).`);
  const apiKey = process.env.INFERHUB_API_KEY?.trim();
  if (!apiKey) throw new Error('INFERHUB_API_KEY 가 설정되지 않았습니다 — 셸 환경 변수로 넘기세요. 키는 실행 폴더·로그에 쓰지 않습니다.');
  const reasoningMode = process.env.MATRIX_NATIVE_REASONING?.trim() || 'field';
  if (!['field', 'none', 'suffix'].includes(reasoningMode)) throw new Error(`MATRIX_NATIVE_REASONING 은 field|none|suffix 입니다(받은 값: ${reasoningMode}).`);
  const dir = mkdtempSync(join(tmpdir(), 'oprn-ac500-'));
  const path = join(dir, 'openai-compat-endpoints.json');
  const store = createOpenAiCompatStore(path);
  const saved = store.upsert({
    name: 'inferhub',
    baseUrl: 'https://api.inferhub.dev/v1',
    apiKey,
    allowModels: ['deepseek-v4.1-flash'],
    blockModels: [],
    reasoningMode: reasoningMode as 'field' | 'none' | 'suffix',
    supportsImages: true,
    defaultModel: pin.model,
  });
  if (saved.id !== pin.provider) throw new Error(`엔드포인트 id 가 ${saved.id} 로 만들어졌습니다 — ${pin.provider} 여야 합니다.`);
  process.env.OPRN_OPENAI_COMPAT_PATH = path;
  return { dir, reasoningMode };
}

const aiConfig = () => {
  const base = { piApply: 'yolo', piApplyPolicyVersion: 1, piTeam: false, autonomyLevel: 'balanced' };
  const pin = providerPin();
  if (pin) {
    const role = { provider: pin.provider, model: pin.model, thinkingLevel: pin.thinkingLevel };
    return {
      ...base, authMode: 'chatgpt', apiKey: '', providerId: pin.provider, model: pin.model, liteModel: pin.model,
      reasoningEffort: pin.thinkingLevel, roleModels: { deep: role, build: role, writer: role, vision: role },
      // Plan and team turns read the Ultrabrain slot, not deep — pin it too or 「every role」 is false.
      ultrabrainProviderId: pin.provider, ultrabrainModel: pin.model, ultrabrainReasoningEffort: pin.thinkingLevel,
    };
  }
  const model = process.env.MATRIX_NATIVE_MODEL?.trim();
  if (!model) return base;
  const role = { provider: 'google-antigravity', model, thinkingLevel: process.env.MATRIX_NATIVE_EFFORT?.trim() || 'low' };
  return { ...base, providerId: 'google-antigravity', model, liteModel: model, roleModels: { deep: role, build: role, writer: role, vision: role } };
};

const toSelection = (rect: Rect) => ({ mapId: MAP, x: rect.x, y: rect.y, width: rect.w, height: rect.h });

/** The 500 spec saves a fresh document per command; rebuilding the 30k-tile fixture each time costs ~8s per row. */
const fixtureFor = (family?: { prepare?: (project: Project) => Project }): Project => {
  const base = spec500 ? cachedNativeProject() : nativeProject();
  return family?.prepare ? family.prepare(base) : base;
};

async function saveFresh(root: string, projectDir: string, project: Project = nativeProject()): Promise<void> {
  const local = await initLocalProjectStore({ projectDir });
  try { await local.saveProject(project); }
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

/** A save flush on a loaded box can exceed the generic 120s UI deadline; the caller's turn budget is the ceiling. */
async function saveThroughUi(page: any, waitMs = 120000): Promise<void> {
  await page.getByTestId('toolbar-save').click();
  await page.waitForFunction(() => ['idle', 'saved'].includes(document.querySelector('[data-testid="toolbar-save"]')?.getAttribute('data-autosave-kind') ?? ''), null, { timeout: waitMs });
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
  // Resolve the pin first: a bad effort must fail before a fixture is written or a host is spawned.
  const pin = providerPin();
  const compat = pin ? prepareCompatEndpoint(pin) : null;
  mkdirSync(root, { recursive: true });
  if (!spec500) {
    const problems = fixtureProblems(nativeProject());
    if (problems.length) throw new Error(`fixture 가 명령을 검증할 수 없다:\n - ${problems.join('\n - ')}`);
  }
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
      const family = command.family ? findFamily(command.family) : undefined;
      const variant = family?.variants.find(entry => entry.key === command.variant);
      if (spec500 && (!family || !variant)) throw new Error(`${command.id}: 가족 ${command.family ?? '?'} / 변형 ${command.variant ?? '?'} 를 찾을 수 없다 — matrix500-spec 로 명세를 다시 만드세요.`);
      await saveFresh(root, projectDir, fixtureFor(family));
      // One host per command. The relay keeps a map claim for up to RESUME_GRACE_MS after the browser
      // disconnects so a real user can reconnect; sharing a host would let one hung command turn every
      // following command into a 409 map-busy that is not the model's fault.
      let host: any;
      const requests: any[] = [];
      let editor: any;
      let events: EventRecord[] = [];
      let failure: string | undefined;
      const started = Date.now();
      const setup = variant?.setup ?? setupFor(command.id);
      try {
        host = await startHost(projectDir, root);
        editor = await newEditor(browser, host.url, projectDir, aiConfig());
        const page = editor.page;
        // Boot migrations and bundled asset folding can rewrite the canonical document. Establish the
        // comparison baseline only after the real UI has loaded and flushed that normalization.
        await saveThroughUi(page, Math.max(120000, timeoutMs));
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
          requests.push({ endpoint: new URL(request.url()).pathname, model: body.model, provider: request.headers()['x-oprn-provider'], thinkingLevel: body.request?.thinkingLevel ?? body.thinkingLevel, runId: body.runId, context });
        });
        page.on('response', (response: any) => {
          const endpoint = new URL(response.url()).pathname;
          if (!/\/v1\/(agent\/run|chat\/completions)/.test(endpoint)) return;
          const request = [...requests].reverse().find(entry => entry.endpoint === endpoint && entry.status === undefined);
          if (!request) return;
          request.status = response.status();
          void response.text().then((body: string) => {
            request.responseBytes = body.length;
            request.responsePreview = body.slice(0, 240);
            // The provider payload is built inside the worker; its prompt_inspection event carries the scalar
            // receipt (model·max_tokens·reasoning_effort). Take the effort from there, never from a guess.
            const efforts = [...new Set([...body.matchAll(/"reasoning_effort"\s*:\s*\\?"([a-z]+)\\?"/gu)].map(match => match[1]))];
            if (efforts.length) request.providerReasoningEffort = efforts;
          }).catch(() => {});
        });
        // A command about "what you just did" needs a real earlier turn, run through the same input.
        if (setup.prior) {
          if (setup.prior.select) await page.evaluate((value: any) => window.__oprnRegionTaskHarness?.setSelection(value), toSelection(setup.prior.select));
          const priorEvents = await sendTurn(page, setup.prior.prompt, timeoutMs);
          writeFileSync(resolve(dir, 'prior-trace.json'), JSON.stringify(priorEvents, null, 2));
          if (!priorEvents.some(event => event.type === 'tool_end' && event.ok === true)) throw new Error('선행 턴이 변경을 만들지 못했다');
          await saveThroughUi(page, Math.max(120000, timeoutMs));
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
        await saveThroughUi(page, Math.max(120000, timeoutMs));
        // A renderer stall (heavy machine load) must not erase a finished turn's verdict: the screenshot is
        // evidence, the saved document is the result. A missing capture is recorded, never silently claimed.
        const missingShots: string[] = [];
        const capture = async (name: string, shot: () => Promise<unknown>) => {
          try { await shot(); } catch (error) { missingShots.push(`${name}: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`); }
        };
        // Reviewers must see which command this screen answers: bring the user's bubble to the top of the chat, keep the end-of-chat view as well.
        await capture('after-chat-end.png', () => page.screenshot({ path: resolve(dir, 'after-chat-end.png') }));
        // The panel re-sticks to the bottom while card images load, so bring the bubble up repeatedly until it stays in view.
        for (let attempt = 0; attempt < 6; attempt++) {
          const placed = await page.evaluate((text: string) => {
            // Not an exact leaf match: the bubble may wrap the text with other nodes. Take the smallest element that contains it, outside the composer.
            const hits = [...document.querySelectorAll('body *')].filter(node => !(node as HTMLElement).closest('[data-testid=ai-input], textarea') && (node.textContent ?? '').includes(text));
            hits.sort((a, b) => (a.textContent ?? '').length - (b.textContent ?? '').length);
            const bubble = hits[0];
            if (!bubble) return false;
            bubble.scrollIntoView({ block: 'start' });
            const box = bubble.getBoundingClientRect();
            return box.top >= 0 && box.bottom <= window.innerHeight;
          }, command.prompt);
          await page.waitForTimeout(600);
          const still = await page.evaluate((text: string) => {
            const hits = [...document.querySelectorAll('body *')].filter(node => !(node as HTMLElement).closest('[data-testid=ai-input], textarea') && (node.textContent ?? '').includes(text));
            hits.sort((a, b) => (a.textContent ?? '').length - (b.textContent ?? '').length);
            const box = hits[0]?.getBoundingClientRect();
            return Boolean(box && box.top >= 0 && box.bottom <= window.innerHeight);
          }, command.prompt);
          if (placed && still) break;
        }
        await capture('after.png', () => page.screenshot({ path: resolve(dir, 'after.png') }));
        const applied = stored(projectDir);
        writeFileSync(resolve(dir, 'after.json'), JSON.stringify(applied.project));
        writeFileSync(resolve(dir, 'trace.json'), JSON.stringify(events, null, 2));
        const toolEnds = events.filter(event => event.type === 'tool_end');
        const records: ToolRecord[] = toolEnds.map(event => ({ name: event.name, ok: event.ok, args: event.args, summary: event.summary }));
        const answer = events.filter(event => event.type === 'assistant').map(event => event.text ?? '').join('\n');
        // A clarify turn is a finished turn: it may legitimately call no tool at all, so a successful tool is not the
        // gate here — the family judge decides whether the answer is enough (read families demand a lookup).
        const turnOk = events.some(event => event.type === 'done')
          && !events.some(event => ['error', 'cancelled', 'stream_error'].includes(event.type ?? ''));
        const scratch = resolve(dir, 'expanded.json');
        const input = {
          original: expandProject(projectDir, original.project as Project, scratch),
          before: expandProject(projectDir, baseline.project as Project, scratch),
          after: expandProject(projectDir, applied.project as Project, scratch),
          tools: records, answer,
        };
        const verdict = family && variant ? family.judge(input, variant.args ?? {}) : judge(command.id, input);
        rmSync(scratch, { force: true });
        await editor.context.close();
        editor = undefined;
        const reloadedEditor = await newEditor(browser, host.url, projectDir, aiConfig());
        const reloaded = stored(projectDir);
        await capture('reloaded.png', () => reloadedEditor.page.screenshot({ path: resolve(dir, 'reloaded.png') }));
        await reloadedEditor.context.close();
        const persistence = applied.sha256 === reloaded.sha256 && applied.projectId === reloaded.projectId;
        sqliteReloads++;
        const commandRequests = requests.slice(requestsBefore);
        for (const request of commandRequests) request.endpoint === '/v1/agent/run' ? nativeAgentCalls++ : chatCompletions++;
        nativeModelCalls += commandRequests.length;
        const changed = !isDeepStrictEqual(normalizeContent(baseline.project as Project), normalizeContent(applied.project as Project));
        // A pinned run must be able to show that the wire carried the pinned effort: without that receipt the
        // run is unverified, not passing. An unpinned run has no such contract.
        // A pinned run records whether the wire carried the pinned effort. That receipt is reported, never gated:
        // 28 of 216 turns lost the prompt_inspection snapshot while the pin was identical, and a missing receipt
        // is a capture gap, not a wrong result. `effort: 'unverified'` marks it for the report.
        const wireEfforts = commandRequests.flatMap(request => request.providerReasoningEffort ?? []);
        const effortVerified = !pin || wireEfforts.includes(pin.thinkingLevel);
        const effortNote = pin ? (effortVerified ? `wire effort ${wireEfforts.join(',')}` : `wire effort 확인 불가/불일치(${wireEfforts.join(',') || '없음'} ≠ ${pin.thinkingLevel})`) : undefined;
        // A command passes only when the real turn finished, the document judged correct, and the
        // persisted row reloads identically. Which tool the model chose is reported, never gated.
        const ok = turnOk && verdict.ok && persistence;
        const row = { n: command.n, id: command.id, ok, turnOk, commandCorrect: verdict.ok, verdict: `${verdict.note}${effortNote ? ` · ${effortNote}` : ''}`, ...(pin ? { effort: effortVerified ? String(pin.thinkingLevel) : 'unverified' } : {}), persistence, changed, mode: command.mode, referenceTools: command.toolNames, toolCalls: toolEnds.map(event => event.name), toolRecords: records, requests: commandRequests, providerReasoningEffort: wireEfforts, assistantText: answer, elapsedMs: Date.now() - started, failure, ...(missingShots.length ? { missingShots } : {}) };
        checks.push(row);
        writeFileSync(resolve(dir, 'native-result.json'), JSON.stringify(row, null, 2));
        console.error(`[matrix-native] #${command.n}/${matrix.commands.length} ${command.id} ${ok ? 'ok' : 'fail'} requests=${commandRequests.length} tools=${toolEnds.length} persisted=${persistence} :: ${verdict.note}`);
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
        console.error(`[matrix-native] #${command.n}/${matrix.commands.length} ${command.id} fail: ${failure}`);
      } finally {
        await host?.close();
      }
    }
  } finally {
    await browser?.close().catch(() => {});
    if (compat) rmSync(compat.dir, { recursive: true, force: true });
  }
  const complete = !only && commandStart === 0 && commandLimit >= matrix.commands.length && (!spec500 || matrix.commands.length >= 500);
  const outcome = {
    schemaVersion: 2,
    kind: spec500 ? 'assistant-command-matrix-500' : 'assistant-small-command-native',
    transport: 'real-editor-input',
    status: checks.length === selected.length && checks.every(row => row.ok) ? (complete ? 'pass' : 'partial-pass') : 'fail',
    total: checks.length,
    pass: checks.filter(row => row.ok).length,
    fail: checks.filter(row => !row.ok).length,
    execution: { inputPosts: checks.length, nativeModelCalls, nativeAgentCalls, chatCompletions, sqliteReloads, visualReviews: 0 },
    ...(spec500 ? { spec: '500' } : {}),
    ...(pin ? { modelPin: { provider: pin.provider, model: pin.model, thinkingLevel: pin.thinkingLevel, ...(compat ? { reasoningMode: compat.reasoningMode, endpoint: 'temp-store' } : {}) } } : {}),
    checks,
    limitations: ['시각 검수는 별도 review 영수증이 필요하다.', '읽기 명령도 성공한 tool_end 와 사실에 맞는 답변이 있어야 통과한다.', '도구 이름은 판정하지 않는다 — 명령이 말한 결과와 나머지 내용의 보존을 판정한다.'],
  };
  writeFileSync(resolve(root, 'matrix-native.json'), JSON.stringify(outcome, null, 2));
  const title = spec500 ? `# 명령 가족 ${matrix.commands.length}개 실제 모델 검증` : '# 50개 작은 명령 실제 모델 검증';
  writeFileSync(resolve(root, 'SUMMARY.md'), `${title}\n\n상태: **${outcome.status}**\n\n실제 입력 ${outcome.execution.inputPosts}건 · native 모델 호출 ${nativeModelCalls}건 · agent ${nativeAgentCalls}건 · chat ${chatCompletions}건 · SQLite 새 context 재로드 ${sqliteReloads}건 · 독립 시각 검수 0건\n\n통과 ${outcome.pass}/${outcome.total} · 실패 ${outcome.fail}/${outcome.total}\n\n${checks.map(row => `- ${row.ok ? '✅' : '❌'} #${row.n} ${row.id} — ${row.verdict ?? row.failure ?? ''}`).join('\n')}\n`);
  return outcome.status === 'fail' ? 1 : 0;
}
