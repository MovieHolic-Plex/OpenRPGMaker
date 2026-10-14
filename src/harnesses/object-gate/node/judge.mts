/**
 * object-gate 판정기(bun). review · calibrate · audit 단계.
 * 판정자 지시문·종류·규칙은 src/harnesses/_core/objectGate/rules.ts 하나에서 온다. 여기서 바꾸지 않는다.
 */
import { readFileSync, existsSync, readdirSync, writeFileSync, mkdirSync, mkdtempSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { resolve, basename, dirname } from 'node:path';
import { PNG } from 'pngjs';
import { completeProvider } from '../../../../scripts/lib/ohMyPiPiAiRuntime.ts';
import { resolveRequestApiKey } from '../../../../scripts/lib/aiAuthRuntime.ts';
import {
  OBJECT_GATE_KINDS, OBJECT_GATE_OUTPUT_FORMAT, OBJECT_GATE_PROFILE, OBJECT_GATE_RUBRIC, OBJECT_GATE_STYLE_KINDS, OBJECT_GATE_STYLE_RUBRIC,
  decideObjectGateBoth, decideObjectGateRun, defaultObjectGateStyleKind, objectGatePixelSha256,
  type ObjectGateKind, type ObjectGateReceipt, type ObjectGateRun, type ObjectGateStyleKind,
} from '../../_core/objectGate';
import { GATE_DATA, gatePromptHash, gateProfileHash, readPng, readReceipt, styleRefs, writeProfile, writeReceipt } from './store';
import { receiptCells } from './cells';
import { auxMetrics } from './metrics';
import { columnScan, factsLine, styleFacts } from './facts';
import { REREVIEW_THEMES, collectPieces, loadOverrides } from './rereview';
import { calibratedProfiles } from './store';

type Item = { png: string; kind: ObjectGateKind; name: string; label?: string; styleKind?: ObjectGateStyleKind };

const SYSTEM_PROMPT = `${OBJECT_GATE_RUBRIC}\n\nYou judge TWO independent things in one answer. PART A is the 3/4 view contract above (top-level fields). PART B is below (the "style" object). A weakness in one part must never change your answer about the other part.\n\n${OBJECT_GATE_STYLE_RUBRIC}\n\n${OBJECT_GATE_OUTPUT_FORMAT}`;

const BOARD_SCALE = 2;

// 실험 전용: 사고 강도를 바꿔 같은 표본을 다시 잰다(OBJECT_GATE_EFFORT=high). 프로필 해시가 바뀌므로 이 영수증·프로필은 효력이 없다.
if (process.env.OBJECT_GATE_EFFORT) for (const j of OBJECT_GATE_PROFILE.judges as Array<{ effort: string }>) j.effort = process.env.OBJECT_GATE_EFFORT;

/** 3/4 판정 안내 그림(합성 도형, build_view34_guide.py) — 모든 호출에 같은 그림을 붙인다. */
let guideBuffer: Buffer | null = null;
const guidePng = () => (guideBuffer ??= readFileSync(resolve(GATE_DATA, 'view34-guide.png')));

// 3×5 숫자 글꼴(행 번호 눈금용).
const DIGITS = ['111101101101111', '010110010010111', '111001111100111', '111001111001111', '101101111001001', '111100111001111', '111100111101111', '111001001001001', '111101111101111', '111101111001111'];

/** 확대 + 1화소 격자 + 왼쪽 행 번호 눈금(2행마다). 판정자가 윗면 행 수를 세게 한다. */
export function magnify(width: number, height: number, rgba: Uint8Array): { png: Buffer; scale: number } {
  const scale = Math.max(4, Math.min(OBJECT_GATE_PROFILE.magnify, Math.floor(1000 / Math.max(width, height))));
  const L = 40, W = width * scale + L, H = height * scale;
  const out = new PNG({ width: W, height: H });
  const put = (x: number, y: number, r: number, g: number, b: number, a = 255) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 4, ia = a / 255;
    out.data[i] = Math.round(out.data[i]! * (1 - ia) + r * ia); out.data[i + 1] = Math.round(out.data[i + 1]! * (1 - ia) + g * ia);
    out.data[i + 2] = Math.round(out.data[i + 2]! * (1 - ia) + b * ia); out.data[i + 3] = 255;
  };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) put(x, y, 88, 92, 104);
  for (let py = 0; py < height; py++) for (let px = 0; px < width; px++) {
    const checker = (px + py) % 2 ? 78 : 98;
    const s = (py * width + px) * 4;
    for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
      const x = L + px * scale + dx, y = py * scale + dy;
      put(x, y, checker, checker + 4, checker + 16);
      put(x, y, rgba[s]!, rgba[s + 1]!, rgba[s + 2]!, rgba[s + 3]!);
      if (dx === 0 || dy === 0) put(x, y, 0, 0, 0, 40);
    }
  }
  for (let py = 0; py < height; py += 2) {
    String(py).split('').forEach((ch, k) => {
      const bits = DIGITS[Number(ch)]!;
      for (let i = 0; i < 15; i++) if (bits[i] === '1') for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++)
        put(2 + k * 8 + (i % 3) * 2 + dx, py * scale + 1 + Math.floor(i / 3) * 2 + dy, 255, 255, 255);
    });
  }
  return { png: PNG.sync.write(out), scale };
}

/** 화풍 비교판: 왼쪽 같은 종류 버들항 기준 그림(2배), 자홍 띠, 오른쪽 후보(2배, 격자 없음). 같은 배율로 나란히 놓는다. */
export function styleBoard(candidate: { width: number; height: number; data: Uint8Array }, refPaths: string[]): { png: Buffer; scale: number } {
  const refs = refPaths.map(path => readPng(path));
  const S = BOARD_SCALE, gap = 8, bar = 10, pad = 8;
  const leftW = refs.reduce((sum, r) => sum + r.width * S + gap, 0), bodyH = Math.max(candidate.height, ...refs.map(r => r.height)) * S;
  const W = pad + leftW + bar + gap + candidate.width * S + pad, H = bodyH + pad * 2;
  const out = new PNG({ width: W, height: H });
  const fill = (x0: number, x1: number, r: number, g: number, b: number) => { for (let y = 0; y < H; y++) for (let x = x0; x < x1; x++) { const i = (y * W + x) * 4; out.data[i] = r; out.data[i + 1] = g; out.data[i + 2] = b; out.data[i + 3] = 255; } };
  fill(0, W, 70, 72, 82);
  const blit = (img: { width: number; height: number; data: Uint8Array }, ox: number) => {
    const oy = pad + bodyH - img.height * S; // 바닥 맞춤
    for (let py = 0; py < img.height; py++) for (let px = 0; px < img.width; px++) {
      const a = img.data[(py * img.width + px) * 4 + 3]! / 255; if (a === 0) continue;
      for (let dy = 0; dy < S; dy++) for (let dx = 0; dx < S; dx++) {
        const i = ((oy + py * S + dy) * W + ox + px * S + dx) * 4, s = (py * img.width + px) * 4;
        for (let c = 0; c < 3; c++) out.data[i + c] = Math.round(out.data[i + c]! * (1 - a) + img.data[s + c]! * a);
      }
    }
  };
  let x = pad; for (const r of refs) { blit(r, x); x += r.width * S + gap; }
  fill(x, x + bar, 255, 0, 255);
  blit(candidate, x + bar + gap);
  return { png: PNG.sync.write(out), scale: S };
}

function userText(item: Item, styleKind: ObjectGateStyleKind, refNames: string[], candidate: { width: number; height: number; data: Uint8Array }, refFacts: string[]) {
  return `Object name: ${item.name}\nKind (PART A): ${item.kind} — ${OBJECT_GATE_KINDS[item.kind]?.meaning ?? 'other'}\nStyle kind (PART B): ${styleKind} — ${OBJECT_GATE_STYLE_KINDS[styleKind]}\n`
    + `Image 1 = the candidate magnified 10x with row numbers (PART A).\nImage 2 = COMPARISON BOARD at ${BOARD_SCALE}x: left of the magenta bar = Beodeul reference(s) of the same kind (${refNames.join(', ')}), right of the bar = the candidate (used for PART B and as a clean view for PART A).\nImage 3 = the fixed 3/4 GUIDE (green frame = right, red frame = wrong).\n\n`
    + `${columnScan(candidate)}\n\nMEASURED STYLE FACTS (exact):\n${factsLine('candidate', styleFacts(candidate))}\n${refFacts.join('\n')}`;
}

/**
 * 판정자 할당량·과부하(429·rate limit·overloaded·usage limit)에 걸리면 모든 호출이 같이 기다렸다 다시 시도한다 — 할당량 오류를 불합격 표로 세지 않는다.
 * 끝내 안 되면 다른 모델로 넘어가지 않고 **멈춘다**(JudgeUnavailable → 프로세스 종료, 받아 둔 답은 캐시에 남아 이어 돌릴 수 있다).
 */
let quotaUntil = 0;
const sleep = (ms: number) => new Promise(done => setTimeout(done, ms));
class JudgeUnavailable extends Error {}
function quotaWaitSeconds(error: unknown): number | null {
  const text = String(error);
  if (!/\b429\b|RESOURCE_EXHAUSTED|quota|rate.?limit|overloaded|usage limit|\b529\b|too many requests/i.test(text)) return null;
  const m = text.match(/(?:Resets? in|try again in|retry after)\s+(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?\s*(?:(\d+)\s*s)?/i);
  const secs = m ? (Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0)) : 0;
  return secs > 0 ? Math.min(secs, 3600) : 90;
}

async function ask(judge: (typeof OBJECT_GATE_PROFILE.judges)[number], item: Item, styleKind: ObjectGateStyleKind, refNames: string[], png: Buffer, board: Buffer, text: string) {
  for (let quotaRetry = 0; ; quotaRetry++) {
    if (Date.now() < quotaUntil) await sleep(quotaUntil - Date.now());
    try { return await askOnce(judge, text, png, board); } catch (error) {
      const wait = quotaWaitSeconds(error);
      if (wait === null) throw error;
      if (quotaRetry >= 12) throw new JudgeUnavailable(`판정자 ${judge.model} 를 계속 쓸 수 없다(할당량·과부하 ${quotaRetry}회 대기 후에도): ${String(error).slice(0, 300)}`);
      const until = Date.now() + (wait + 8) * 1000;
      if (until > quotaUntil) { quotaUntil = until; console.error(`  ⏸ 판정자 할당량·과부하 — ${wait + 8}초 쉬고 이어 간다 (${new Date(until).toISOString().slice(11, 19)}Z): ${String(error).slice(0, 120)}`); }
    }
  }
}

/** Claude 판정자: `claude -p`(헤드리스, 도구 없음, 빈 임시 폴더·--setting-sources "" 로 CLAUDE.md·훅·메모리 차단 — 실측: 지침·메모리 0)에 그림 셋을 첨부해 JSON 한 개를 받는다. 모델은 응답의 modelUsage 로 확인한다. */
function askClaude(judge: { model: string; effort: string }, userContent: Array<Record<string, unknown>>): Promise<string> {
  const message = { type: 'user', message: { role: 'user', content: userContent } };
  const cwd = mkdtempSync(resolve(tmpdir(), 'oprn-gate-judge-'));
  return new Promise((done, fail) => {
    const child = spawn('claude', ['-p', '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose', '--model', judge.model, '--effort', judge.effort,
      '--system-prompt', SYSTEM_PROMPT, '--tools', '', '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}', '--setting-sources', '', '--disable-slash-commands', '--no-session-persistence'],
      { cwd, stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '', err = '';
    const timer = setTimeout(() => { child.kill('SIGKILL'); fail(new Error('claude -p 시간 초과(600s)')); }, 600_000);
    child.stdout.on('data', c => { out += c; }); child.stderr.on('data', c => { err += c; });
    child.on('error', e => { clearTimeout(timer); fail(e); });
    child.on('close', code => {
      clearTimeout(timer);
      const events = out.split('\n').filter(l => l.startsWith('{')).flatMap(l => { try { return [JSON.parse(l)]; } catch { return []; } });
      const result = events.find(e => e.type === 'result');
      if (!result || result.is_error) return fail(new Error(`claude -p 실패(code ${code}${result?.api_error_status ? `, ${result.api_error_status}` : ''}): ${String(result?.result ?? err ?? out).slice(0, 400)}`));
      const used = Object.keys(result.modelUsage ?? {});
      if (!used.length || used.some(m => m !== judge.model)) return fail(new JudgeUnavailable(`판정자가 ${judge.model} 가 아니다(modelUsage: ${used.join(',') || '없음'}) — 다른 모델로 판정하지 않는다`));
      done(String(result.result ?? ''));
    });
    child.stdin.end(`${JSON.stringify(message)}\n`);
  });
}

async function askOnce(judge: (typeof OBJECT_GATE_PROFILE.judges)[number], userMessage: string, png: Buffer, board: Buffer) {
  let text: string;
  if (judge.provider === 'claude-cli') {
    const b64 = (b: Buffer) => ({ type: 'image', source: { type: 'base64', media_type: 'image/png', data: b.toString('base64') } });
    text = await askClaude(judge, [{ type: 'text', text: userMessage }, b64(png), b64(board), b64(guidePng())]);
  } else {
    const apiKey = await resolveRequestApiKey(judge.provider);
    const { completion } = await completeProvider(judge.provider, {
      model: judge.model, reasoning: { effort: judge.effort },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: [
          { type: 'text', text: userMessage },
          { type: 'image_url', image_url: { url: `data:image/png;base64,${png.toString('base64')}` } },
          { type: 'image_url', image_url: { url: `data:image/png;base64,${board.toString('base64')}` } },
          { type: 'image_url', image_url: { url: `data:image/png;base64,${guidePng().toString('base64')}` } },
        ] },
      ],
    }, { apiKey: apiKey as string | undefined }) as { completion: { choices: Array<{ message: { content?: string } }> } };
    text = completion.choices[0]?.message.content ?? '';
  }
  const match = text.match(/\{[\s\S]*\}/);
  try { return match ? JSON.parse(match[0]) : null; } catch { return null; }
}

async function pool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length); let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i]!); }
  }));
  return out;
}

type Answer = ReturnType<typeof parseAnswer>;
function parseAnswer(text: string) {
  const match = text.match(/\{[\s\S]*\}/);
  try { return match ? JSON.parse(match[0]) : null; } catch { return null; }
}

const STYLE_FLAG_DEFAULT = defaultObjectGateStyleKind;

type JudgeOpts = { force: boolean; write: boolean; concurrency: number; runs?: number; cacheAnswers?: boolean; quiet?: boolean; offline?: boolean };

const answerCachePath = (promptHash: string, sha: string, run: number) => resolve(GATE_DATA, 'calibration', 'answers', promptHash, `${sha.slice(0, 20)}-${run}.json`);

async function judgeItems(items: Item[], opts: JudgeOpts): Promise<ObjectGateReceipt[]> {
  const profileHash = await gateProfileHash(), promptHash = await gatePromptHash();
  const runsPerJudge = opts.runs ?? OBJECT_GATE_PROFILE.runsPerJudge;
  type Job = { item: Item; styleKind: ObjectGateStyleKind; sha: string; image: Buffer; board: Buffer; text: string; refNames: string[]; judge: (typeof OBJECT_GATE_PROFILE.judges)[number]; run: number };
  const jobs: Job[] = [];
  const prepared: Array<{ item: Item; styleKind: ObjectGateStyleKind; sha: string; width: number; height: number; cells?: Record<string, string[]>; metrics: ReturnType<typeof auxMetrics>; refNames: string[]; scale: number; cached?: ObjectGateReceipt }> = [];
  for (const item of items) {
    if (!OBJECT_GATE_KINDS[item.kind]) throw Error(`모르는 종류 ${item.kind} (${item.png}). 종류: ${Object.keys(OBJECT_GATE_KINDS).join(', ')}`);
    const styleKind = item.styleKind ?? STYLE_FLAG_DEFAULT(item.kind);
    if (!OBJECT_GATE_STYLE_KINDS[styleKind]) throw Error(`모르는 화풍 종류 ${styleKind} (${item.png}). 종류: ${Object.keys(OBJECT_GATE_STYLE_KINDS).join(', ')}`);
    const { width, height, data } = readPng(item.png);
    const sha = await objectGatePixelSha256(width, height, data);
    const refs = styleRefs(styleKind);
    if (!refs.length) throw Error(`화풍 종류 ${styleKind} 의 버들항 기준 그림이 없다`);
    const refNames = refs.map(r => r.name);
    const metrics = auxMetrics(width, height, data);
    const cached = readReceipt(sha);
    if (!opts.force && cached && cached.profileHash === profileHash && cached.kind === item.kind) {
      // 같은 그림을 다른 여백으로 다시 받았으면 칸 해시만 보탠다(판정은 그대로).
      const more = receiptCells(width, height, data), cells = { ...(cached.cells ?? {}) };
      let grew = false;
      for (const [ts, list] of Object.entries(more)) { const merged = [...new Set([...(cells[ts] ?? []), ...list])].sort(); if (merged.length !== (cells[ts] ?? []).length) grew = true; cells[ts] = merged; }
      const receipt = grew ? { ...cached, cells } : cached;
      if (grew && opts.write) writeReceipt(receipt);
      prepared.push({ item, styleKind, sha, width, height, metrics, refNames, scale: BOARD_SCALE, cached: receipt }); continue;
    }
    const image = magnify(width, height, data).png;
    const board = styleBoard({ width, height, data }, refs.map(r => r.path));
    prepared.push({ item, styleKind, sha, width, height, cells: receiptCells(width, height, data), metrics, refNames, scale: board.scale });
    for (const judge of OBJECT_GATE_PROFILE.judges) for (let run = 1; run <= runsPerJudge; run++) jobs.push({ item, styleKind, sha, image, board: board.png, text: userText(item, styleKind, refNames, { width, height, data }, refs.map(r => factsLine(`reference ${r.name}`, styleFacts(readPng(r.path))))), refNames, judge, run });
  }
  let done = 0;
  const results = await pool(jobs, opts.concurrency, async job => {
    const t = Date.now();
    const cachePath = opts.cacheAnswers ? answerCachePath(promptHash, job.sha, job.run) : '';
    try {
      let answer: Answer | null = null;
      if (cachePath && existsSync(cachePath)) answer = JSON.parse(readFileSync(cachePath, 'utf8'));
      else if (opts.offline) throw Error('답 캐시 없음(--offline)');
      else {
        for (let attempt = 0; attempt < 2 && !answer; attempt++) {
          try { answer = await ask(job.judge, job.item, job.styleKind, job.refNames, job.image, job.board, job.text); } catch (error) { if (attempt === 1 || error instanceof JudgeUnavailable) throw error; }
        }
        if (cachePath && answer) { mkdirSync(dirname(cachePath), { recursive: true }); writeFileSync(cachePath, JSON.stringify(answer)); }
      }
      const both = decideObjectGateRun(job.item.kind, answer, job.styleKind);
      return { sha: job.sha, run: { judge: job.judge.id, run: job.run, answer, pass: both.pass, reasons: both.reasons, view34: both.view34, style: both.style, ms: Date.now() - t } as ObjectGateRun };
    } catch (error) {
      if (error instanceof JudgeUnavailable) { console.error(`\n판정자를 쓸 수 없어 멈춘다 — ${error.message}\n받아 둔 답은 캐시에 있어 같은 명령으로 이어 돌릴 수 있다. 영수증·프로필은 쓰지 않았다.`); process.exit(4); }
      return { sha: job.sha, run: { judge: job.judge.id, run: job.run, answer: null, pass: false, reasons: ['판정자 호출 실패'], ms: Date.now() - t, error: String(error).slice(0, 300) } as ObjectGateRun };
    } finally {
      done++; if (!opts.quiet && done % 25 === 0) console.error(`  … ${done}/${jobs.length} 호출`);
    }
  });
  const receipts: ObjectGateReceipt[] = [];
  for (const p of prepared) {
    if (p.cached) { receipts.push(p.cached); continue; }
    const runs = results.filter(r => r.sha === p.sha).map(r => r.run).sort((a, b) => a.judge.localeCompare(b.judge) || a.run - b.run);
    const decision = decideObjectGateBoth(p.item.kind, p.styleKind, runs.map(r => r.answer));
    const scores = runs.map(r => r.answer?.style?.score).filter((v): v is number => typeof v === 'number').sort((a, b) => a - b);
    const receipt: ObjectGateReceipt = {
      schema: 'oprn-object-gate-receipt/1', pixelSha256: p.sha, width: p.width, height: p.height, kind: p.item.kind, name: p.item.name,
      ...(p.item.label ? { label: p.item.label } : {}), profileHash, verdict: decision.pass ? 'pass' : 'fail',
      reasons: decision.reasons,
      view34: { verdict: decision.view34.pass ? 'pass' : 'fail', reasons: decision.view34.reasons },
      style: { verdict: decision.style.pass ? 'pass' : 'fail', reasons: decision.style.reasons, styleKind: p.styleKind, refs: p.refNames, scale: p.scale, ...(scores.length ? { score: scores[Math.floor(scores.length / 2)] } : {}) },
      metrics: p.metrics, runs, decidedAt: new Date().toISOString(), cells: p.cells,
    };
    if (opts.write) writeReceipt(receipt);
    receipts.push(receipt);
  }
  return receipts;
}

const argv = process.argv.slice(2);
const stage = argv[0];
const option = (name: string) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : undefined; };
const flag = (name: string) => argv.includes(`--${name}`);
const concurrency = Math.min(4, Number(option('concurrency') ?? 4)); // 판정자 병렬은 최대 4

const readBatch = (path: string): Item[] => readFileSync(path, 'utf8').split('\n').filter(l => l.trim()).map(l => {
  const raw = JSON.parse(l) as Item; return { ...raw, png: resolve(dirname(resolve(path)), raw.png) };
});

const half = (h?: { verdict: string }) => (h ? (h.verdict === 'pass' ? 'ok ' : 'NO ') : '-- ');
const line = (r: ObjectGateReceipt) => `${r.verdict === 'pass' ? 'PASS' : 'FAIL'}  3/4:${half(r.view34)}화풍:${half(r.style)}${r.kind.padEnd(14)} ${(r.label ?? r.name).padEnd(40)} ${r.pixelSha256.slice(0, 12)}  ${r.verdict === 'pass' ? '' : r.reasons.slice(0, 3).join(' · ')}`;

if (stage === 'review' || stage === 'audit') {
  const batch = option('batch');
  const items: Item[] = batch ? readBatch(batch) : [{ png: resolve(option('png') ?? ''), kind: option('kind') as ObjectGateKind, name: option('name') ?? basename(option('png') ?? ''), label: option('label'), styleKind: option('style-kind') as ObjectGateStyleKind | undefined }];
  if (!batch && (!option('png') || !option('kind'))) throw Error('review --png <그림> --kind <3/4 종류> [--style-kind building|roof|wall|tree|ground|water|prop] [--name 이름] [--label 표식] | --batch items.jsonl({png,kind,styleKind?,name,label})');
  const receipts = await judgeItems(items, { force: flag('force'), write: true, concurrency });
  for (const r of receipts) console.log(line(r));
  const passed = receipts.filter(r => r.verdict === 'pass').length;
  console.log(`\n${passed}/${receipts.length} 통과(3/4 통과 ${receipts.filter(r => r.view34?.verdict === 'pass').length}, 화풍 통과 ${receipts.filter(r => r.style?.verdict === 'pass').length}) · 영수증 ${resolve(GATE_DATA, 'receipts')}`);
  if (stage === 'audit') {
    const out = resolve(option('out') ?? resolve(GATE_DATA, 'audit', `${new Date().toISOString().slice(0, 10)}.json`));
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, `${JSON.stringify(receipts.map(r => ({ label: r.label ?? r.name, kind: r.kind, verdict: r.verdict, view34: r.view34?.verdict, style: r.style?.verdict, reasons: r.reasons, sha: r.pixelSha256 })), null, 1)}\n`);
    console.log(`감사 보고서 ${out} (막지 않는다)`);
    process.exit(0);
  }
  process.exit(passed === receipts.length ? 0 : 3);
}

if (stage === 'preview') {
  // 판정자가 받는 확대 그림(1번)과 화풍 비교판(2번)을 사람이 확인하는 용도.
  const png = resolve(option('png') ?? ''); const { width, height, data } = readPng(png);
  const out = resolve(option('out') ?? png.replace(/\.png$/, '.gate.png'));
  writeFileSync(out, magnify(width, height, data).png); console.log(out);
  const styleKind = (option('style-kind') as ObjectGateStyleKind | undefined) ?? (option('kind') ? STYLE_FLAG_DEFAULT(option('kind') as ObjectGateKind) : undefined);
  if (styleKind) { const board = out.replace(/\.png$/, '.board.png'); writeFileSync(board, styleBoard({ width, height, data }, styleRefs(styleKind).map(r => r.path)).png); console.log(board); }
  process.exit(0);
}

if (stage === 'calibrate') {
  const root = resolve(GATE_DATA, 'calibration');
  const onlySets = option('set')?.split(',');
  const runs = option('runs') ? Number(option('runs')) : undefined;
  const limit = option('limit') ? Number(option('limit')) : undefined;
  type Cal = Item & { view34: 'bad' | 'good' | null; style: 'bad' | 'good' | null; group: string; weak?: boolean; set: string };
  const items: Cal[] = [];
  for (const set of readdirSync(root).filter(d => d !== 'history' && d !== 'answers' && existsSync(resolve(root, d)) && (!onlySets || onlySets.includes(d)))) {
    const labelsPath = resolve(root, set, 'labels.json'), itemsPath = resolve(root, set, 'items.json');
    if (existsSync(labelsPath)) {
      // 3/4 만 아는 옛 형식(실내·무림 표본): bad/good + kinds. 화풍 라벨은 없다.
      const labels = JSON.parse(readFileSync(labelsPath, 'utf8')) as { bad: Record<string, string>; good: Record<string, string>; kinds: Record<string, ObjectGateKind> };
      for (const truth of ['bad', 'good'] as const) for (const name of Object.keys(labels[truth])) {
        const kind = labels.kinds[name];
        if (!kind) throw Error(`${set}/${name} 종류가 labels.kinds 에 없다`);
        items.push({ png: resolve(root, set, `${name}.png`), kind, name: name.replace(/^props?[._]/, '').replace(/__.*$/, '').replace(/_/g, ' '), label: `${set}/${name}`, view34: truth, style: null, group: set, set });
      }
    } else if (existsSync(itemsPath)) {
      for (const it of JSON.parse(readFileSync(itemsPath, 'utf8')) as Array<{ name: string; kind: ObjectGateKind; styleKind: ObjectGateStyleKind; view34: 'good' | 'bad' | null; style: 'good' | 'bad'; group: string; weak?: boolean }>) {
        items.push({ png: resolve(root, set, `${it.name}.png`), kind: it.kind, styleKind: it.styleKind, name: it.name.replace(/__.*$/, '').replace(/[_-]/g, ' '), label: `${set}/${it.name}`, view34: it.view34, style: it.style, group: it.group, weak: it.weak, set });
      }
    }
  }
  const only = option('only')?.split(',');
  const byOnly = only ? items.filter(c => only.some(o => c.label!.includes(o))) : items;
  const picked = limit ? byOnly.filter((_, i) => i % Math.ceil(byOnly.length / limit) === 0) : byOnly;
  const full = !onlySets && !limit && !only && (runs === undefined || runs === OBJECT_GATE_PROFILE.runsPerJudge);
  // 보정은 영수증을 덮어쓰지 않는다(표본 그림은 고치기 전 판이라 출구에 쓰이지 않는다). 답은 프로필 해시별 캐시에 남아 이어 돌릴 수 있다.
  const receipts = await judgeItems(picked, { force: true, write: false, concurrency, runs, cacheAnswers: true, offline: flag('offline') });
  const byLabel = new Map(receipts.map(r => [r.label!, r]));
  const tally = (pick: (c: Cal, r: ObjectGateReceipt) => { truth: 'bad' | 'good' | null; pass: boolean } | null) => {
    const badMissed: string[] = [], goodFail: string[] = []; let bad = 0, good = 0;
    for (const c of picked) { const r = byLabel.get(c.label!)!; const t = pick(c, r); if (!t || !t.truth) continue;
      if (t.truth === 'bad') { bad++; if (t.pass) badMissed.push(c.label!); } else { good++; if (!t.pass) goodFail.push(c.label!); } }
    return { badTotal: bad, caught: bad - badMissed.length, missed: badMissed, goodTotal: good, passed: good - goodFail.length, falseFail: goodFail };
  };
  for (const c of picked) {
    const r = byLabel.get(c.label!)!;
    console.log(`${(c.view34 ? '3/4' + (c.view34 === 'bad' ? '위반' : '정상') : '    ').padEnd(8)}${(c.style ? '화풍' + (c.style === 'bad' ? '얕음' : '버들') : '').padEnd(10)}${line(r)}`);
  }
  const v34 = tally((c, r) => ({ truth: c.view34, pass: r.view34?.verdict === 'pass' }));
  const sty = tally((c, r) => ({ truth: c.style, pass: r.style?.verdict === 'pass' }));
  const strong = tally((c, r) => ({ truth: c.weak ? null : c.style, pass: r.style?.verdict === 'pass' }));
  const groups: Record<string, { total: number; passed: number }> = {};
  for (const c of picked) if (c.style) { const g = (groups[c.group] ??= { total: 0, passed: 0 }); g.total++; if (byLabel.get(c.label!)!.style?.verdict === 'pass') g.passed++; }
  const profileHash = await gateProfileHash();
  const goodRate = (t: { goodTotal: number; passed: number }) => (t.goodTotal ? t.passed / t.goodTotal : 1);
  const GOOD_MIN = 0.8; // 정상 표본 통과율 하한(위반을 하나도 못 놓치는 것에 더해, 정상 표본을 대부분 통과시켜야 효력이 있다)
  const ok = v34.missed.length === 0 && sty.missed.length === 0 && goodRate(v34) >= GOOD_MIN && goodRate(sty) >= GOOD_MIN;
  const record = {
    schema: 'oprn-object-gate-profile/1' as const, profileHash, status: ok && full ? 'calibrated' as const : 'rejected' as const, calibratedAt: new Date().toISOString(),
    bad: { total: v34.badTotal, caught: v34.caught, missed: v34.missed }, good: { total: v34.goodTotal, passed: v34.passed, falseFail: v34.falseFail },
    style: { ...sty, groups }, judge: OBJECT_GATE_PROFILE.judges.map(j => `${j.model}(${j.effort})`).join('+'),
    note: full ? undefined : '부분 실행(--set/--limit/--runs) — 효력 없음',
  };
  const out = resolve(root, `run-${profileHash}${full ? '' : '-partial'}.json`);
  writeFileSync(out, `${JSON.stringify(receipts.map(r => ({ label: r.label, verdict: r.verdict, view34: r.view34, style: r.style, metrics: r.metrics, runs: r.runs.map(x => ({ run: x.run, pass: x.pass, a: x.answer ? { top: x.answer.top_rows, open: x.answer.opening_visible, openRows: x.answer.opening_rows, kindOk: x.answer.kind_matches, front: x.answer.pure_front_elevation, side: x.answer.side_face_visible, evidence: x.answer.evidence, style: x.answer.style } : null, error: x.error })) })), null, 1)}\n`);
  console.log(`\n프로필 ${profileHash} (${record.judge})`);
  console.log(`3/4  위반 ${v34.caught}/${v34.badTotal} 잡음, 정상 ${v34.passed}/${v34.goodTotal} 통과`);
  console.log(`화풍 얕음 ${sty.caught}/${sty.badTotal} 잡음(강한 라벨만 ${strong.caught}/${strong.badTotal}), 버들 수준 ${sty.passed}/${sty.goodTotal} 통과(강한 라벨만 ${strong.passed}/${strong.goodTotal})`);
  for (const [g, v] of Object.entries(groups)) console.log(`  화풍 그룹 ${g.padEnd(18)} 통과 ${v.passed}/${v.total}`);
  console.log(`→ ${record.status}${record.note ? ` (${record.note})` : ''}`);
  if (v34.missed.length) console.log(`놓친 3/4 위반: ${v34.missed.join(', ')}`);
  if (sty.missed.length) console.log(`놓친 화풍(얕음인데 통과): ${sty.missed.join(', ')}`);
  console.log(`상세 ${out}`);
  if (full || flag('record')) console.log(`프로필 ${writeProfile(record)}`);
  process.exit(record.status === 'calibrated' ? 0 : 3);
}

if (stage === 'rereview') {
  // rereview --themes steampunk,snow|all [--audit] [--limit N] [--runs N] [--map overrides.json]
  const names = (option('themes') ?? 'all') === 'all' ? Object.keys(REREVIEW_THEMES) : option('themes')!.split(',');
  const audit = flag('audit'), profileHash = await gateProfileHash();
  if (!audit && !flag('dry') && !calibratedProfiles().has(profileHash)) throw Error(`현재 프로필 ${profileHash} 는 보정되지 않았다 — 영수증을 쓰지 않는다. 보고서만 보려면 --audit`);
  const outDir = resolve(option('out') ?? '.tmp/object-gate-rereview');
  const overrides = loadOverrides(option('map'));
  const report: Record<string, { total: number; pass: number; view34Pass: number; stylePass: number; styleFail: string[]; view34Fail: string[] }> = {};
  for (const theme of names) {
    let pieces = collectPieces(theme, process.cwd(), outDir, overrides);
    if (option('limit')) pieces = pieces.slice(0, Number(option('limit')));
    console.log(`\n== ${theme}: 조각 ${pieces.length}`);
    if (flag('dry')) { const by = pieces.reduce<Record<string, number>>((m, p) => ((m[`${p.kind}/${p.styleKind}`] = (m[`${p.kind}/${p.styleKind}`] ?? 0) + 1), m), {}); console.log(`   분류 ${JSON.stringify(by)} (호출 ${pieces.length * OBJECT_GATE_PROFILE.runsPerJudge})`); continue; }
    const receipts = await judgeItems(pieces.map(p => ({ png: p.png, kind: p.kind, styleKind: p.styleKind, name: p.name, label: p.label })), { force: false, write: !audit, concurrency, runs: option('runs') ? Number(option('runs')) : undefined, cacheAnswers: audit });
    const r = (report[theme] = { total: receipts.length, pass: 0, view34Pass: 0, stylePass: 0, styleFail: [], view34Fail: [] });
    for (const x of receipts) {
      if (x.verdict === 'pass') r.pass++;
      if (x.view34?.verdict === 'pass') r.view34Pass++; else r.view34Fail.push(`${x.label} (${x.view34?.reasons.join(' · ')})`);
      if (x.style?.verdict === 'pass') r.stylePass++; else r.styleFail.push(`${x.label} (${x.style?.reasons.join(' · ')})`);
    }
    console.log(`   통과 ${r.pass}/${r.total} · 3/4 ${r.view34Pass}/${r.total} · 화풍 ${r.stylePass}/${r.total}`);
  }
  const out = resolve(GATE_DATA, 'audit', `rereview-${new Date().toISOString().slice(0, 10)}-${profileHash}.json`);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify({ profileHash, audit, report }, null, 1)}\n`);
  console.log(`\n보고서 ${out}`);
  process.exit(0);
}

throw Error('단계: review | calibrate | rereview | audit | preview');
