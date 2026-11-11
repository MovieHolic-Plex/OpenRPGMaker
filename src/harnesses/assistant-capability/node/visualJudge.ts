// 그림을 보는 독립 검수자(Claude Opus 5.5 medium, 로컬 CLI) — 작은 일 시각 칸과 게임 통판 시각 감사가 같이 쓴다.
// object-gate 최종 판정(final.mts)과 같은 호출 길: `claude -p --model claude-opus-5-5 --effort medium`, 도구·MCP·설정 없음, 빈 임시 폴더.
// 답은 그림 해시 + 지시문 판에 묶어 캐시한다. 그림이 한 화소라도 바뀌면 열쇠가 달라져 다시 묻는다.
// 검수자가 답하지 못하면(호출 실패·형식 어긋남·다른 모델) 답은 없다 — 부르는 쪽은 그것을 «미검증»으로 적고, 합격으로 채우지 않는다.
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { PNG } from 'pngjs';

export const VISUAL_JUDGE = { provider: 'claude-cli' as const, model: 'claude-opus-5-5', effort: 'medium' };

export type JudgeImage = { label: string; png: Buffer };
export type JudgeUsage = { calls: number; cached: number; inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number; failures: number };
export const newUsage = (): JudgeUsage => ({ calls: 0, cached: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, failures: 0 });

export const sha256 = (data: Buffer | string): string => createHash('sha256').update(data).digest('hex');
/** 그림 해시 = 화소(RGBA)와 크기의 해시. PNG 압축·메타데이터가 달라도 같은 그림이면 같다. */
export function pixelSha(png: Buffer): string {
  const image = PNG.sync.read(png);
  return sha256(Buffer.concat([Buffer.from(`${image.width}x${image.height}:`), image.data]));
}

/** 정수 배 최근접 확대. 검수자에게는 1배와 확대본을 같이 준다(16px 도트는 1배만으로는 작다). */
export function magnify(png: Buffer, factor: number): Buffer {
  if (factor <= 1) return png;
  const source = PNG.sync.read(png), target = new PNG({ width: source.width * factor, height: source.height * factor });
  for (let y = 0; y < target.height; y += 1) for (let x = 0; x < target.width; x += 1) {
    const s = (Math.floor(y / factor) * source.width + Math.floor(x / factor)) * 4, d = (y * target.width + x) * 4;
    target.data[d] = source.data[s]!; target.data[d + 1] = source.data[s + 1]!; target.data[d + 2] = source.data[s + 2]!; target.data[d + 3] = source.data[s + 3]!;
  }
  return PNG.sync.write(target);
}
/** 긴 변이 limit 을 넘지 않는 가장 큰 정수 배율(1~max). */
export function magnifyFactor(png: Buffer, limit = 1400, max = 4): number {
  const image = PNG.sync.read(png);
  return Math.max(1, Math.min(max, Math.floor(limit / Math.max(image.width, image.height))));
}

class JudgeUnavailable extends Error {}
const sleep = (ms: number) => new Promise(done => setTimeout(done, ms));

function callCli(system: string, content: Array<Record<string, unknown>>): Promise<{ text: string; usage: Record<string, any> }> {
  const cwd = mkdtempSync(resolve(tmpdir(), 'oprn-visual-judge-'));
  return new Promise((done, fail) => {
    const child = spawn('claude', ['-p', '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose', '--model', VISUAL_JUDGE.model, '--effort', VISUAL_JUDGE.effort,
      '--system-prompt', system, '--tools', '', '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}', '--setting-sources', '', '--disable-slash-commands', '--no-session-persistence'],
      { cwd, stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '', err = '';
    const timer = setTimeout(() => { child.kill('SIGKILL'); fail(new Error('claude -p 시간 초과(600s)')); }, 600_000);
    child.stdout.on('data', chunk => { out += chunk; }); child.stderr.on('data', chunk => { err += chunk; });
    child.on('error', error => { clearTimeout(timer); fail(error); });
    child.on('close', code => {
      clearTimeout(timer);
      const events = out.split('\n').filter(line => line.startsWith('{')).flatMap(line => { try { return [JSON.parse(line)]; } catch { return []; } });
      const result = events.find(event => event.type === 'result');
      if (!result || result.is_error) return fail(new Error(`claude -p 실패(code ${code}${result?.api_error_status ? `, ${result.api_error_status}` : ''}): ${String(result?.result ?? err ?? out).slice(0, 400)}`));
      const used = Object.keys(result.modelUsage ?? {});
      if (!used.length || used.some(model => model !== VISUAL_JUDGE.model)) return fail(new JudgeUnavailable(`검수자가 ${VISUAL_JUDGE.model} 가 아니다(modelUsage: ${used.join(',') || '없음'}) — 다른 모델의 답은 쓰지 않는다`));
      done({ text: String(result.result ?? ''), usage: result.modelUsage[VISUAL_JUDGE.model] ?? {} });
    });
    child.stdin.end(`${JSON.stringify({ type: 'user', message: { role: 'user', content } })}\n`);
  });
}

export type JudgeAsk<T> = {
  /** 캐시 폴더. 열쇠 = 지시문 판 + 글 + 그림 화소 해시 + 표 번호. */
  cacheDir: string;
  /** 지시문 판 이름(예: small-jobs-v3). 지시문 글이 바뀌면 판도 올린다 — 열쇠에는 글의 해시도 들어간다. */
  promptVersion: string;
  system: string;
  text: string;
  images: JudgeImage[];
  /** 같은 그림을 독립적으로 다시 묻는 표 번호(0부터). */
  vote?: number;
  /** 답 글에서 판정을 꺼낸다. 형식이 어긋나면 null — 그 호출을 다시 한다. */
  parse: (reply: string) => T | null;
  usage: JudgeUsage;
};
export type JudgeAnswer<T> = { answer: T; key: string; cached: boolean } | { error: string; key: string };

/** JSON 한 덩어리(객체나 배열)를 답 글에서 꺼낸다. */
export function extractJson(reply: string): unknown {
  const start = reply.search(/[[{]/u);
  if (start < 0) return null;
  for (let end = reply.length; end > start; end -= 1) {
    const tail = reply[end - 1];
    if (tail !== '}' && tail !== ']') continue;
    try { return JSON.parse(reply.slice(start, end)); } catch { /* 더 짧게 */ }
  }
  return null;
}

export async function askJudge<T>(ask: JudgeAsk<T>): Promise<JudgeAnswer<T>> {
  const key = sha256(JSON.stringify({ version: ask.promptVersion, system: sha256(ask.system), text: ask.text, images: ask.images.map(image => [image.label, pixelSha(image.png)]), vote: ask.vote ?? 0, judge: VISUAL_JUDGE })).slice(0, 32);
  const file = resolve(ask.cacheDir, `${key}.json`);
  if (existsSync(file)) {
    const saved = JSON.parse(readFileSync(file, 'utf8'));
    ask.usage.cached += 1;
    return { answer: saved.answer as T, key, cached: true };
  }
  if (process.env.OPRN_VISUAL_JUDGE_OFFLINE === '1') return { error: '검수자를 부르지 않았다(OPRN_VISUAL_JUDGE_OFFLINE)', key };
  const content = [{ type: 'text', text: ask.text }, ...ask.images.flatMap(image => [{ type: 'text', text: `${image.label}:` }, { type: 'image', source: { type: 'base64', media_type: 'image/png', data: image.png.toString('base64') } }])];
  let last = '';
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const { text, usage } = await callCli(ask.system, content);
      ask.usage.calls += 1;
      ask.usage.inputTokens += Number(usage.inputTokens ?? 0); ask.usage.outputTokens += Number(usage.outputTokens ?? 0);
      ask.usage.cacheReadTokens += Number(usage.cacheReadInputTokens ?? 0); ask.usage.cacheWriteTokens += Number(usage.cacheCreationInputTokens ?? 0);
      const answer = ask.parse(text);
      if (answer === null) { last = `답 형식이 맞지 않다: ${text.slice(0, 200)}`; continue; }
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, JSON.stringify({ key, promptVersion: ask.promptVersion, judge: VISUAL_JUDGE, vote: ask.vote ?? 0, images: ask.images.map(image => ({ label: image.label, pixelSha256: pixelSha(image.png) })), answer, raw: text, at: new Date().toISOString() }, null, 2));
      return { answer, key, cached: false };
    } catch (error) {
      last = error instanceof Error ? error.message : String(error);
      if (error instanceof JudgeUnavailable) break;
      if (/\b429\b|\b529\b|overloaded|rate.?limit|quota/iu.test(last)) { console.error(`  검수자 과부하 — 90초 쉰다: ${last.slice(0, 120)}`); await sleep(90_000); attempt -= 1; continue; }
      await sleep(5_000);
    }
  }
  ask.usage.failures += 1;
  return { error: last || '검수자가 답하지 않았다', key };
}

/** 동시 실행 상한을 둔 map — 검수 호출을 몇 개씩 나란히 돌린다. */
export async function mapLimit<A, B>(items: readonly A[], limit: number, task: (item: A, index: number) => Promise<B>): Promise<B[]> {
  const out = new Array<B>(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    for (;;) { const index = next; next += 1; if (index >= items.length) return; out[index] = await task(items[index]!, index); }
  }));
  return out;
}

export const usageLine = (usage: JudgeUsage): string => `검수자 호출 ${usage.calls}번(캐시에서 읽은 것 ${usage.cached} · 실패 ${usage.failures}) · 토큰 입력 ${usage.inputTokens + usage.cacheReadTokens + usage.cacheWriteTokens} / 출력 ${usage.outputTokens}`;
