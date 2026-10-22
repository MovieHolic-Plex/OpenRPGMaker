/**
 * object-gate 판정기(bun). review · calibrate · audit 단계.
 * 판정자 지시문·종류·규칙은 src/harnesses/_core/objectGate/rules.ts 하나에서 온다. 여기서 바꾸지 않는다.
 */
import { readFileSync, existsSync, readdirSync, writeFileSync, mkdirSync, mkdtempSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { resolve, basename, dirname } from 'node:path';
import { PNG } from 'pngjs';
import {
  OBJECT_GATE_EYE_OUTPUT_FORMAT, OBJECT_GATE_EYE_RUBRIC, OBJECT_GATE_KINDS, OBJECT_GATE_OUTPUT_FORMAT, OBJECT_GATE_PROFILE, OBJECT_GATE_RUBRIC, OBJECT_GATE_STYLE_KINDS, OBJECT_GATE_STYLE_OUTPUT_FORMAT, OBJECT_GATE_STYLE_RUBRIC,
  decideObjectGate, decideObjectGateBoth, decideObjectGateStyle, defaultObjectGateStyleKind, objectGatePixelSha256,
  objectGateProfileHash, type ObjectGateKind, type ObjectGateReceipt, type ObjectGateRun, type ObjectGateStyleKind, type ObjectGateStyleRefSet,
} from '../../_core/objectGate';
import { BASE_STYLE_REF_SET, GATE_DATA, chipsetOfLabel, gatePromptHash, gateProfileHash, readPng, readReceipt, resolveStyleRefs, writeHeldImage, writeProfile, writeReceipt } from './store';
import { receiptCells } from './cells';
import { auxMetrics } from './metrics';
import { columnScan, factsLine, styleFacts, widthProfile } from './facts';
import { REREVIEW_THEMES, collectPieces, loadOverrides } from './rereview';
import { calibratedProfiles } from './store';

type Item = { png: string; kind: ObjectGateKind; name: string; label?: string; styleKind?: ObjectGateStyleKind; /** 후보의 칩셋(화풍 기준 묶음을 고른다). 없으면 라벨 앞머리. */ chipset?: string; /** 보정 전용: 라벨이 없는 반쪽은 부르지 않는다(영수증은 쓰지 않는다). */ skipHalves?: Half[] };

// 규칙 v6: 3/4 와 화풍은 따로 호출한다(서로의 약점이 번지지 않게).
const SYSTEM_VIEW34 = `${OBJECT_GATE_RUBRIC}\n\n${OBJECT_GATE_OUTPUT_FORMAT}`;
const SYSTEM_STYLE = `You are a pixel-art style reviewer for a themed RPG chipset. ${OBJECT_GATE_STYLE_RUBRIC}\n\n${OBJECT_GATE_STYLE_OUTPUT_FORMAT}`;
type Half = 'view34' | 'style' | 'eye';
const SYSTEM_EYE = `${OBJECT_GATE_EYE_RUBRIC}\n${OBJECT_GATE_EYE_OUTPUT_FORMAT}`;

const BOARD_SCALE = 2;

// 실험 전용: 사고 강도를 바꿔 같은 표본을 다시 잰다(OBJECT_GATE_EFFORT=high). 프로필 해시가 바뀌므로 이 영수증·프로필은 효력이 없다.
if (process.env.OBJECT_GATE_EFFORT) for (const j of OBJECT_GATE_PROFILE.judges as Array<{ effort: string }>) j.effort = process.env.OBJECT_GATE_EFFORT;

/** 3/4 판정 안내 그림(합성 도형, build_view34_guide.py) — 모든 호출에 같은 그림을 붙인다. */
let guideBuffer: Buffer | null = null;
const guidePng = () => (guideBuffer ??= readFileSync(resolve(GATE_DATA, 'view34-guide.png')));
/** 같은 물건의 옛 그림(위반, 빨강)·새 그림(합격, 초록) 실제 쌍(build_view34_pairs.py) — 3/4 호출의 2번 그림. */
let pairsBuffer: Buffer | null = null;
const pairsPng = () => (pairsBuffer ??= readFileSync(resolve(GATE_DATA, 'view34-pairs.png')));

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

/** 눈 호출용 확대: 행 번호 눈금·격자·측정값 없이 10배 + 4화소 테두리. 판정자가 숫자에 끌려가지 않고 전체 인상만 보게 한다. */
export function plainMagnify(width: number, height: number, rgba: Uint8Array): Buffer {
  const S = OBJECT_GATE_PROFILE.magnify, B = 4, W = width * S + B * 2, H = height * S + B * 2;
  const out = new PNG({ width: W, height: H });
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4; out.data[i] = 88; out.data[i + 1] = 92; out.data[i + 2] = 104; out.data[i + 3] = 255;
    const px = Math.floor((x - B) / S), py = Math.floor((y - B) / S);
    if (px < 0 || py < 0 || px >= width || py >= height) continue;
    const s0 = (py * width + px) * 4, a = rgba[s0 + 3]! / 255;
    for (let c = 0; c < 3; c++) out.data[i + c] = Math.round(out.data[i + c]! * (1 - a) + rgba[s0 + c]! * a);
  }
  return PNG.sync.write(out);
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

function userText(half: Half, item: Item, styleKind: ObjectGateStyleKind, refNames: string[], candidate: { width: number; height: number; data: Uint8Array }, refFacts: string[], refSet?: ObjectGateStyleRefSet) {
  if (half === 'view34') {
    return `Object name: ${item.name}\nKind: ${item.kind} — ${OBJECT_GATE_KINDS[item.kind]?.meaning ?? 'other'}\n`
      + `Image 1 = the candidate magnified 10x with source row numbers on the left.\nImage 2 = REAL reference pairs (red frame = WRONG drawing, green frame = RIGHT drawing, same objects).\nImage 3 = the fixed synthetic GUIDE (green = right, red = wrong).\n\n`
      + `${columnScan(candidate)}\n\n${widthProfile(candidate)}`;
  }
  // 버들항 묶음(기본·대체)은 2026-10-23 이전과 바이트까지 같은 문구다 — 버들항 그림의 판정이 바뀌지 않게.
  if (refSet && refSet.id !== BASE_STYLE_REF_SET) {
    return `Object name: ${item.name}\nStyle kind: ${styleKind} — ${OBJECT_GATE_STYLE_KINDS[styleKind]}\nCandidate's chipset: ${refSet.id}\n`
      + `Image 1 = COMPARISON BOARD at ${BOARD_SCALE}x: left of the magenta bar = reference(s) of the same kind taken from the art already shipped in the candidate's OWN chipset (${refSet.id}: ${refNames.join(', ')}), right of the bar = the candidate.\n`
      + `For this candidate these ${refSet.id} references ARE the standard: wherever the instructions say "Beodeul", read "these ${refSet.id} references" — compare shading steps, outline treatment, texture and tile density with them, at the same scale. They are accepted shipped art of this chipset.\n\n`
      + `MEASURED STYLE FACTS (exact):\n${factsLine('candidate', styleFacts(candidate))}\n${refFacts.join('\n')}`;
  }
  return `Object name: ${item.name}\nStyle kind: ${styleKind} — ${OBJECT_GATE_STYLE_KINDS[styleKind]}\n`
    + `Image 1 = COMPARISON BOARD at ${BOARD_SCALE}x: left of the magenta bar = Beodeul reference(s) of the same kind (${refNames.join(', ')}), right of the bar = the candidate.\n\n`
    + `MEASURED STYLE FACTS (exact):\n${factsLine('candidate', styleFacts(candidate))}\n${refFacts.join('\n')}`;
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

async function ask(judge: (typeof OBJECT_GATE_PROFILE.judges)[number], half: Half, images: Buffer[], text: string) {
  for (let quotaRetry = 0; ; quotaRetry++) {
    if (Date.now() < quotaUntil) await sleep(quotaUntil - Date.now());
    try { return await askOnce(judge, half, text, images); } catch (error) {
      const wait = quotaWaitSeconds(error);
      if (wait === null) throw error;
      if (quotaRetry >= 12) throw new JudgeUnavailable(`판정자 ${judge.model} 를 계속 쓸 수 없다(할당량·과부하 ${quotaRetry}회 대기 후에도): ${String(error).slice(0, 300)}`);
      const until = Date.now() + (wait + 8) * 1000;
      if (until > quotaUntil) { quotaUntil = until; console.error(`  ⏸ 판정자 할당량·과부하 — ${wait + 8}초 쉬고 이어 간다 (${new Date(until).toISOString().slice(11, 19)}Z): ${String(error).slice(0, 120)}`); }
    }
  }
}

/** Claude 판정자: `claude -p`(헤드리스, 도구 없음, 빈 임시 폴더·--setting-sources "" 로 CLAUDE.md·훅·메모리 차단 — 실측: 지침·메모리 0)에 그림 셋을 첨부해 JSON 한 개를 받는다. 모델은 응답의 modelUsage 로 확인한다. */
function askClaude(judge: { model: string; effort: string }, system: string, userContent: Array<Record<string, unknown>>): Promise<string> {
  const message = { type: 'user', message: { role: 'user', content: userContent } };
  const cwd = mkdtempSync(resolve(tmpdir(), 'oprn-gate-judge-'));
  return new Promise((done, fail) => {
    const child = spawn('claude', ['-p', '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose', '--model', judge.model, '--effort', judge.effort,
      '--system-prompt', system, '--tools', '', '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}', '--setting-sources', '', '--disable-slash-commands', '--no-session-persistence'],
      { cwd, stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '', err = '';
    const timer = setTimeout(() => { child.kill('SIGKILL'); fail(new Error('claude -p 시간 초과(240s)')); }, 240_000);
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

async function askOnce(judge: (typeof OBJECT_GATE_PROFILE.judges)[number], half: Half, userMessage: string, images: Buffer[]) {
  if (judge.provider !== 'claude-cli') throw Error(`판정자 provider ${judge.provider} 는 규칙 v6 에서 지원하지 않는다(Claude Sonnet 5.5 high 하나)`);
  const b64 = (b: Buffer) => ({ type: 'image', source: { type: 'base64', media_type: 'image/png', data: b.toString('base64') } });
  const text = await askClaude(judge, half === 'view34' ? SYSTEM_VIEW34 : half === 'eye' ? SYSTEM_EYE : SYSTEM_STYLE, [{ type: 'text', text: userMessage }, ...images.map(b64)]);
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

const STYLE_FLAG_DEFAULT = defaultObjectGateStyleKind;

/** anyProfile: 같은 그림·같은 종류의 영수증이 어느 프로필로든 이미 있으면 다시 판정하지 않는다(사람 검토 대기열에 올릴 AI 조언이 이미 있다 — 2026-10-20 결정). */
type JudgeOpts = { force: boolean; write: boolean; concurrency: number; runs?: number; cacheAnswers?: boolean; quiet?: boolean; offline?: boolean; anyProfile?: boolean };

// front_prop(규칙 v8)는 종류 뜻이 사용자 문구에 들어가므로 같은 그림이라도 옛 종류의 답을 쓰면 안 된다 — 이름에 -fp 를 붙인다. 다른 종류의 프롬프트는 v7 과 같아 캐시를 그대로 쓴다.
const answerCachePath = (half: Half, promptHash: string, sha: string, run: number, kind?: string) => // 칩셋 묶음의 화풍 답은 promptHash 에 묶음 해시가 섞여 들어온다(judgeItems 의 stylePrompt)
  resolve(GATE_DATA, 'calibration', 'answers', `${half}-${promptHash}`, `${sha.slice(0, 20)}${kind === 'front_prop' ? '-fp' : half === 'eye' && kind === 'seat' ? '-seat' : ''}-${run}.json`);

async function judgeItems(items: Item[], opts: JudgeOpts): Promise<ObjectGateReceipt[]> {
  const profileHash = await gateProfileHash();
  const prompts: Record<Half, string> = { view34: await gatePromptHash('view34'), style: await gatePromptHash('style'), eye: await gatePromptHash('eye') };
  const runsPerJudge = opts.runs ?? OBJECT_GATE_PROFILE.runsPerJudge;
  type Job = { half: Half; kind?: string; sha: string; images: Buffer[]; text: string; judge: (typeof OBJECT_GATE_PROFILE.judges)[number]; run: number; promptHash?: string };
  const jobs: Job[] = [];
  const prepared: Array<{ item: Item; styleKind: ObjectGateStyleKind; sha: string; width: number; height: number; cells?: Record<string, string[]>; metrics: ReturnType<typeof auxMetrics>; refNames: string[]; refSet: ObjectGateStyleRefSet; scale: number; cached?: ObjectGateReceipt }> = [];
  for (const item of items) {
    if (!OBJECT_GATE_KINDS[item.kind]) throw Error(`모르는 종류 ${item.kind} (${item.png}). 종류: ${Object.keys(OBJECT_GATE_KINDS).join(', ')}`);
    const styleKind = item.styleKind ?? STYLE_FLAG_DEFAULT(item.kind);
    if (!OBJECT_GATE_STYLE_KINDS[styleKind]) throw Error(`모르는 화풍 종류 ${styleKind} (${item.png}). 종류: ${Object.keys(OBJECT_GATE_STYLE_KINDS).join(', ')}`);
    const { width, height, data } = readPng(item.png);
    const sha = await objectGatePixelSha256(width, height, data);
    // 화풍 기준 그림은 후보 칩셋의 묶음에서 고른다(2026-10-23). 묶음이 없으면 버들항으로 떨어지고 영수증 style.refSet 에 적는다.
    const { refs, refSet } = resolveStyleRefs(styleKind, item.chipset ?? chipsetOfLabel(item.label));
    if (!refs.length) throw Error(`화풍 종류 ${styleKind} 의 버들항 기준 그림이 없다`);
    if (refSet.fallback && !opts.quiet) console.error(`  화풍 기준: ${item.label ?? item.name} → 버들항 대체(${refSet.reason})`);
    const stylePrompt = refSet.id === BASE_STYLE_REF_SET ? prompts.style : await objectGateProfileHash({ base: prompts.style, refSet: refSet.id, refSetHash: refSet.hash });
    const refNames = refs.map(r => r.name);
    const metrics = auxMetrics(width, height, data);
    const cached = readReceipt(sha);
    // 옛 영수증(style.refSet 없음)은 버들항 묶음으로 판정한 것이다 — 다른 묶음으로 판정해야 하는 그림이면 다시 판정한다.
    if (!opts.force && cached && (cached.profileHash === profileHash || opts.anyProfile) && cached.kind === item.kind && (cached.style?.refSet?.id ?? BASE_STYLE_REF_SET) === refSet.id) {
      // 같은 그림을 다른 여백으로 다시 받았으면 칸 해시만 보탠다(판정은 그대로).
      const more = receiptCells(width, height, data), cells = { ...(cached.cells ?? {}) };
      let grew = false;
      for (const [ts, list] of Object.entries(more)) { const merged = [...new Set([...(cells[ts] ?? []), ...list])].sort(); if (merged.length !== (cells[ts] ?? []).length) grew = true; cells[ts] = merged; }
      const receipt = grew ? { ...cached, cells } : cached;
      if (grew && opts.write) writeReceipt(receipt);
      // 판정받은 그림은 검토 화면(serve-holds)이 보여 주고 사람 결정 때 해시를 다시 잴 수 있게 따로 둔다(영수증에는 그림이 없다).
      // 2026-10-20 부터 사람 허용이 최종이므로 보류뿐 아니라 모든 판정의 그림을 둔다.
      if (opts.write) writeHeldImage(sha, width, height, data);
      prepared.push({ item, styleKind, sha, width, height, metrics, refNames, refSet, scale: BOARD_SCALE, cached: receipt }); continue;
    }
    const image = magnify(width, height, data).png;
    const board = styleBoard({ width, height, data }, refs.map(r => r.path));
    prepared.push({ item, styleKind, sha, width, height, cells: receiptCells(width, height, data), metrics, refNames, refSet, scale: board.scale });
    const cand = { width, height, data };
    const refFacts = refs.map(r => factsLine(`reference ${r.name}`, styleFacts(readPng(r.path))));
    for (const judge of OBJECT_GATE_PROFILE.judges) for (let run = 1; run <= runsPerJudge; run++) {
      if (!item.skipHalves?.includes('view34')) jobs.push({ half: 'view34', kind: item.kind, sha, images: [image, pairsPng(), guidePng()], text: userText('view34', item, styleKind, refNames, cand, refFacts), judge, run });
      // 주의(2026-10-20 실측): 눈 호출은 판정 회차 루프 안에 있어 같은 답 3개(캐시 run 1~3)가 회차마다 다시 들어가 12표로 센다 — 거부권 문턱 2 는 실제로 「고유 답 3개 중 wrong 1개」다.
      // 이것을 문서대로(3개 중 2개)로 고치면 개발 확실 위반 slot_machine__w46-A 가 통과해 버린다(규칙 v9 조정 실측). 그래서 지금 동작을 유지한다 — 바꾸려면 문턱·보정을 함께 다시.
      if (!item.skipHalves?.includes('view34') && !OBJECT_GATE_KINDS[item.kind]?.exempt) for (let e = 1; e <= OBJECT_GATE_PROFILE.eyeRuns; e++) jobs.push({ half: 'eye', sha, images: [plainMagnify(width, height, data), pairsPng()], text: item.kind === 'seat' ? 'The object is a seat (chair, sofa, bench, pew or stool). Candidate (image 1) and references (image 2). Verdict?' : 'Candidate (image 1) and references (image 2). Verdict?', judge, run: e, ...(item.kind === 'seat' ? { kind: 'seat' } : {}) });
      if (!item.skipHalves?.includes('style')) jobs.push({ half: 'style', sha, images: [board.png], text: userText('style', item, styleKind, refNames, cand, refFacts, refSet), judge, run, promptHash: stylePrompt });
    }
  }
  let done = 0;
  const results = await pool(jobs, opts.concurrency, async job => {
    const t = Date.now();
    const cachePath = opts.cacheAnswers ? answerCachePath(job.half, job.promptHash ?? prompts[job.half], job.sha, job.run, job.kind) : '';
    try {
      let answer: unknown = null;
      if (cachePath && existsSync(cachePath)) answer = JSON.parse(readFileSync(cachePath, 'utf8'));
      else if (opts.offline) throw Error('답 캐시 없음(--offline)');
      else {
        // 답을 못 읽거나(JSON 아님) 호출이 시간 초과하면 세 번까지 다시 묻는다 — 첫 보정에서 시간 초과 12건이 「판정자 답 없음」으로 세어졌다.
        for (let attempt = 0; attempt < 3 && !answer; attempt++) {
          try { answer = await ask(job.judge, job.half, job.images, job.text); } catch (error) { if (attempt === 2 || error instanceof JudgeUnavailable) throw error; }
        }
        if (cachePath && answer) { mkdirSync(dirname(cachePath), { recursive: true }); writeFileSync(cachePath, JSON.stringify(answer)); }
      }
      return { sha: job.sha, half: job.half, run: job.run, judge: job.judge.id, answer, ms: Date.now() - t, error: undefined as string | undefined };
    } catch (error) {
      if (error instanceof JudgeUnavailable) { console.error(`\n판정자를 쓸 수 없어 멈춘다 — ${error.message}\n받아 둔 답은 캐시에 있어 같은 명령으로 이어 돌릴 수 있다. 영수증·프로필은 쓰지 않았다.`); process.exit(4); }
      return { sha: job.sha, half: job.half, run: job.run, judge: job.judge.id, answer: null, ms: Date.now() - t, error: String(error).slice(0, 300) };
    } finally {
      done++; if (!opts.quiet && done % 25 === 0) console.error(`  … ${done}/${jobs.length} 호출`);
    }
  });
  const receipts: ObjectGateReceipt[] = [];
  for (const p of prepared) {
    if (p.cached) { receipts.push(p.cached); continue; }
    const mine = results.filter(r => r.sha === p.sha);
    const ey = mine.filter(r => r.half === 'eye').sort((a, b) => a.run - b.run);
    const v = mine.filter(r => r.half === 'view34').sort((a, b) => a.judge.localeCompare(b.judge) || a.run - b.run);
    const st = mine.filter(r => r.half === 'style').sort((a, b) => a.judge.localeCompare(b.judge) || a.run - b.run);
    const viewAnswers = v.map(r => r.answer as never), styleAnswers = st.map(r => r.answer as never);
    const eyeAnswers = ey.map(r => r.answer as never);
    const decision = decideObjectGateBoth(p.item.kind, viewAnswers, styleAnswers, eyeAnswers);
    const runs: ObjectGateRun[] = v.map((r, i) => {
      const one = decideObjectGate(p.item.kind, [r.answer as never]), sty = decideObjectGateStyle([st[i]?.answer as never ?? null]);
      return { judge: r.judge, run: r.run, answer: r.answer as never, styleAnswer: (st[i]?.answer ?? null) as never, pass: one.pass && sty.pass, reasons: [...one.reasons, ...sty.reasons], view34: { pass: one.pass, reasons: one.reasons }, style: { pass: sty.pass, reasons: sty.reasons }, ms: r.ms + (st[i]?.ms ?? 0), ...(r.error ? { error: r.error } : {}), ...(st[i]?.error ? { styleError: st[i]!.error } : {}) };
    });
    const scores = st.map(r => (r.answer as { score?: number } | null)?.score).filter((x): x is number => typeof x === 'number').sort((a, b) => a - b);
    const receipt: ObjectGateReceipt = {
      schema: 'oprn-object-gate-receipt/1', pixelSha256: p.sha, width: p.width, height: p.height, kind: p.item.kind, name: p.item.name,
      ...(p.item.label ? { label: p.item.label } : {}), profileHash, verdict: decision.state,
      reasons: decision.reasons,
      view34: { verdict: decision.view34.state, reasons: decision.view34.reasons },
      style: { verdict: decision.style.state, reasons: decision.style.reasons, styleKind: p.styleKind, refs: p.refNames, scale: p.scale, ...(scores.length ? { score: scores[Math.floor(scores.length / 2)] } : {}), refSet: p.refSet },
      metrics: p.metrics, ...(ey.length ? { eye: { verdicts: ey.map(r => String((r.answer as { verdict?: string } | null)?.verdict ?? 'unread')) } } : {}), runs, decidedAt: new Date().toISOString(), cells: p.cells,
    };
    if (opts.write) writeReceipt(receipt);
    if (opts.write) { const im = readPng(p.item.png); writeHeldImage(p.sha, im.width, im.height, im.data); }
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

const half = (h?: { verdict: string }) => (h ? (h.verdict === 'pass' ? 'ok ' : h.verdict === 'refer' ? '?? ' : 'NO ') : '-- ');
const line = (r: ObjectGateReceipt) => `${r.verdict === 'pass' ? 'PASS' : r.verdict === 'refer' ? 'REFER' : 'FAIL'}  3/4:${half(r.view34)}화풍:${half(r.style)}${r.kind.padEnd(14)} ${(r.label ?? r.name).padEnd(40)} ${r.pixelSha256.slice(0, 12)}  [기준 ${r.style?.refSet ? `${r.style.refSet.id}${r.style.refSet.fallback ? '(대체)' : ''}` : 'beodeul_city'}]  ${r.verdict === 'pass' ? '' : r.reasons.slice(0, 3).join(' · ')}`;

if (stage === 'review' || stage === 'audit') {
  const batch = option('batch');
  const items: Item[] = batch ? readBatch(batch) : [{ png: resolve(option('png') ?? ''), kind: option('kind') as ObjectGateKind, name: option('name') ?? basename(option('png') ?? ''), label: option('label'), styleKind: option('style-kind') as ObjectGateStyleKind | undefined, chipset: option('chipset') }];
  if (!batch && (!option('png') || !option('kind'))) throw Error('review --png <그림> --kind <3/4 종류> [--style-kind building|roof|wall|tree|ground|water|prop] [--chipset jp_city|wizarding_world|…] [--name 이름] [--label 표식] [--no-write] | --batch items.jsonl({png,kind,styleKind?,chipset?,name,label})');
  // --advisory: 사람 검토 대기열을 채우는 용도. 이미 어느 프로필로든 판정받은 그림은 다시 부르지 않고(그림만 검토 화면용으로 둔다),
  // 눈 호출은 보정과 같은 답 캐시를 쓴다. 판정 규칙·프로필은 그대로다 — 영수증의 효력은 출구 규칙(사람 허용 또는 보정 프로필 pass)이 정한다.
  const advisory = flag('advisory');
  // --no-write: 영수증·그림을 쓰지 않고 판정만 본다(기존 영수증과 대조할 때). --offline: 판정자를 부르지 않고 답 캐시만 쓴다(같은 프롬프트면 같은 답 → 같은 판정).
  const receipts = await judgeItems(items, { force: flag('force'), write: !flag('no-write'), concurrency, ...(advisory ? { anyProfile: true, cacheAnswers: true } : {}), ...(flag('offline') ? { cacheAnswers: true, offline: true } : {}) });
  for (const r of receipts) console.log(line(r));
  const passed = receipts.filter(r => r.verdict === 'pass').length;
  if (!calibratedProfiles().has(await gateProfileHash())) console.log(`\n현재 프로필은 보정되지 않았다 — 아래 숫자는 AI 조언이다. 최종 통과는 검토 화면(serve-holds, 18323)의 사람 허용이다.`);
  console.log(`\n${passed}/${receipts.length} 통과(보류 ${receipts.filter(r => r.verdict === 'refer').length} — 사람 확인 전에는 굽기·게시 불가; 3/4 통과 ${receipts.filter(r => r.view34?.verdict === 'pass').length}, 화풍 통과 ${receipts.filter(r => r.style?.verdict === 'pass').length}) · 영수증 ${resolve(GATE_DATA, 'receipts')}`);
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
  if (styleKind) { const board = out.replace(/\.png$/, '.board.png'); const { refs, refSet } = resolveStyleRefs(styleKind, option('chipset') ?? chipsetOfLabel(option('label'))); writeFileSync(board, styleBoard({ width, height, data }, refs.map(r => r.path)).png); console.log(board, `기준 묶음 ${refSet.id}${refSet.fallback ? ` (대체: ${refSet.reason})` : ''}`); }
  process.exit(0);
}

if (stage === 'calibrate') {
  const root = resolve(GATE_DATA, 'calibration');
  const onlySets = option('set')?.split(',');
  const runs = option('runs') ? Number(option('runs')) : undefined;
  const limit = option('limit') ? Number(option('limit')) : undefined;
  type Tier = 'A' | 'B' | 'C' | 'U' | 'D' | 'K';
  type Cal = Item & { view34: 'bad' | 'good' | null; style: 'bad' | 'good' | null; group: string; weak?: boolean; set: string; tier: Tier; holdout: boolean };
  // 등급 표(tiers.json): A=확실(기준에 센다) · C=다툼 · U=사용자 수락(엄격 계약과 어긋남). 판정 결과를 보기 전에 정했고 실험 뒤 바꾸지 않았다. 없으면 A.
  const tierMap = existsSync(resolve(root, 'tiers.json')) ? (JSON.parse(readFileSync(resolve(root, 'tiers.json'), 'utf8')) as { tiers: Record<string, { tier: Tier }> }).tiers : {};
  const items: Cal[] = [];
  for (const set of readdirSync(root).filter(d => d !== 'history' && d !== 'answers' && existsSync(resolve(root, d)) && (!onlySets || onlySets.includes(d)))) {
    const labelsPath = resolve(root, set, 'labels.json'), itemsPath = resolve(root, set, 'items.json');
    if (existsSync(labelsPath)) {
      // 3/4 만 아는 옛 형식(실내·무림 표본): bad/good + kinds. 화풍 라벨은 없다.
      const labels = JSON.parse(readFileSync(labelsPath, 'utf8')) as { bad: Record<string, string>; good: Record<string, string>; kinds: Record<string, ObjectGateKind> };
      for (const truth of ['bad', 'good'] as const) for (const name of Object.keys(labels[truth])) {
        const kind = labels.kinds[name];
        if (!kind) throw Error(`${set}/${name} 종류가 labels.kinds 에 없다`);
        const label = `${set}/${name}`;
        items.push({ png: resolve(root, set, `${name}.png`), kind, name: name.replace(/^props?[._]/, '').replace(/__.*$/, '').replace(/_/g, ' '), label, view34: truth, style: null, group: set, set, tier: tierMap[label]?.tier ?? 'A', holdout: false });
      }
    } else if (existsSync(itemsPath)) {
      for (const it of JSON.parse(readFileSync(itemsPath, 'utf8')) as Array<{ name: string; kind: ObjectGateKind; styleKind: ObjectGateStyleKind; view34: 'good' | 'bad' | null; style: 'good' | 'bad' | null; group: string; weak?: boolean; tier?: Tier }>) {
        const label = `${set}/${it.name}`;
        items.push({ png: resolve(root, set, `${it.name}.png`), kind: it.kind, styleKind: it.styleKind, name: it.name.replace(/__.*$/, '').replace(/[_-]/g, ' '), label, view34: it.view34, style: it.style, group: it.group, weak: it.weak, set, tier: tierMap[label]?.tier ?? it.tier ?? 'A', holdout: set === 'holdout' || set.startsWith('fresh') });
      }
    }
  }
  const only = option('only')?.split(',');
  const byOnly = only ? items.filter(c => only.some(o => c.label!.includes(o))) : items;
  const picked = limit ? byOnly.filter((_, i) => i % Math.ceil(byOnly.length / limit) === 0) : byOnly;
  const full = !onlySets && !limit && !only && (runs === undefined || runs === OBJECT_GATE_PROFILE.runsPerJudge);
  // 보정은 영수증을 덮어쓰지 않는다(표본 그림은 고치기 전 판이라 출구에 쓰이지 않는다). 답은 프로필 해시별 캐시에 남아 이어 돌릴 수 있다.
  // 적대 시험(adv-*)은 원본과 같은 그림(화소 해시)을 다른 종류로 선언한 것이라 같은 호출에 섞으면 해시로 합쳐져 서로의 판정이 섞인다 — 따로 부른다.
  const judgeOpts = { force: true, write: false, concurrency, runs, cacheAnswers: true, offline: flag('offline') };
  // 보정은 버들항 묶음으로만 돈다(칩셋 묶음은 보정 프로필 밖이다 — 보정 결과가 묶음 추가로 바뀌지 않게).
  const toItem = (c: Cal) => ({ ...c, chipset: BASE_STYLE_REF_SET, skipHalves: [...(c.view34 ? [] : ['view34' as const]), ...(c.style ? [] : ['style' as const])] });
  const receipts = [...await judgeItems(picked.filter(c => !c.set.startsWith('adv-')).map(toItem), judgeOpts), ...await judgeItems(picked.filter(c => c.set.startsWith('adv-')).map(toItem), judgeOpts)];
  const byLabel = new Map(receipts.map(r => [r.label!, r]));
  type Truth = 'bad' | 'good' | null;
  const tally = (list: Cal[], pick: (c: Cal, r: ObjectGateReceipt) => { truth: Truth; verdict: string } | null) => {
    const badMissed: string[] = [], goodFail: string[] = []; let bad = 0, good = 0, badRefer = 0, goodRefer = 0;
    for (const c of list) { const r = byLabel.get(c.label!)!; const t = pick(c, r); if (!t || !t.truth) continue;
      if (t.truth === 'bad') { bad++; if (t.verdict === 'pass') badMissed.push(c.label!); else if (t.verdict === 'refer') badRefer++; }
      else { good++; if (t.verdict !== 'pass') { goodFail.push(c.label!); if (t.verdict === 'refer') goodRefer++; } } }
    return { badTotal: bad, caught: bad - badMissed.length, missed: badMissed, badRefer, goodTotal: good, passed: good - goodFail.length, falseFail: goodFail, goodRefer };
  };
  const stateWord = (v?: string) => (v === 'pass' ? 'PASS' : v === 'refer' ? 'REFR' : 'FAIL');
  for (const c of picked) {
    const r = byLabel.get(c.label!)!;
    console.log(`${(c.view34 ? '3/4' + (c.view34 === 'bad' ? '위반' : '정상') + c.tier : '    ').padEnd(9)}${(c.style ? '화풍' + (c.style === 'bad' ? '얕음' : '버들') : '').padEnd(10)}${stateWord(r.verdict)} 3/4:${stateWord(r.view34?.verdict)} 화풍:${stateWord(r.style?.verdict)} ${r.kind.padEnd(14)} ${(r.label ?? r.name).padEnd(44)} ${r.verdict === 'pass' ? '' : r.reasons.slice(0, 2).join(' · ')}`);
  }
  // adv-* = 적대 시험(위반 표본을 면제 종류로 거짓 선언): 개발·숨김 집계에 섞지 않고 따로 센다. 한 장이라도 통과하면 효력 없음.
  const probe = picked.filter(c => c.set.startsWith('adv-'));
  const dev = picked.filter(c => !c.holdout && !c.set.startsWith('adv-')), hold = picked.filter(c => c.holdout);
  // 사람 승인 전용 종류(humanOnly: front_prop)는 3/4 반쪽이 구조상 자동 pass 를 낼 수 없다(항상 refer). 자동 통과율 분모에 넣으면 정상 통과율을 근거 없이 깎으므로
  // 따로 센다 — 자동 통과가 한 장이라도 나오면 효력 없음(사람 승인 없이 출구를 넘을 길이 생긴 것이다).
  const humanOnly = (c: Cal) => !!OBJECT_GATE_KINDS[c.kind]?.humanOnly;
  const v34 = (list: Cal[], tier: Tier) => tally(list.filter(c => c.tier === tier && !humanOnly(c)), (c, r) => ({ truth: c.view34, verdict: r.view34?.verdict ?? 'fail' }));
  const humanItems = picked.filter(c => !c.set.startsWith('adv-') && c.view34 && humanOnly(c));
  const humanAutoPass = humanItems.filter(c => byLabel.get(c.label!)!.view34?.verdict === 'pass').map(c => c.label!);
  // 숨김 표본은 둘이다: holdout(1차 숨김 — 규칙 v6 결과를 본 뒤 규칙 v7 을 조정하는 데 쓰였으므로 더 이상 숨김이 아님) · fresh(v7 규칙을 정한 뒤 처음 재는 표본).
  // 2026-10-20: fresh4 = 판정을 고치기 전에 블라인드 화소 라벨로 얼려 둔 새 숨김 표본(최종 측정 전용). fresh·fresh2·fresh3 은 그 전 결과를 본 표본이라 이제 조정용(보고만, 위반 통과 0 은 그대로 요구).
  const FROZEN = 'fresh4';
  // 규칙 v10 앞에 얼린 두 번째 숨김(좌석 위주, 3/4 만). fresh4 와 따로 세고 둘 다 기준을 넘어야 한다.
  const FROZEN2 = 'fresh5';
  const holdOld = hold.filter(c => c.set === 'holdout'), holdFresh = hold.filter(c => c.set.startsWith('fresh') && c.set !== FROZEN && c.set !== FROZEN2), frozen = hold.filter(c => c.set === FROZEN), frozen2 = hold.filter(c => c.set === FROZEN2);
  const devA = v34(dev, 'A'), holdA = v34(holdOld, 'A'), freshA = v34(holdFresh, 'A'), frozenA = v34(frozen, 'A'), frozen2A = v34(frozen2, 'A');
  const frozenStyle = tally(frozen, (c, r) => ({ truth: c.weak ? null : c.style, verdict: r.style?.verdict ?? 'fail' }));
  const sty = tally(dev, (c, r) => ({ truth: c.style, verdict: r.style?.verdict ?? 'fail' }));
  const strong = tally(dev, (c, r) => ({ truth: c.weak ? null : c.style, verdict: r.style?.verdict ?? 'fail' }));
  const tiers: Record<string, { bad: { total: number; passed: number }; good: { total: number; passed: number } }> = {};
  for (const t of ['A', 'B', 'C', 'U', 'D', 'K'] as const) { const x = v34(picked.filter(c => !c.set.startsWith('adv-')), t); if (x.badTotal || x.goodTotal) tiers[t] = { bad: { total: x.badTotal, passed: x.badTotal - x.caught }, good: { total: x.goodTotal, passed: x.passed } }; }
  const groups: Record<string, { total: number; passed: number }> = {};
  for (const c of dev) if (c.style) { const g = (groups[c.group] ??= { total: 0, passed: 0 }); g.total++; if (byLabel.get(c.label!)!.style?.verdict === 'pass') g.passed++; }
  const profileHash = await gateProfileHash();
  const goodRate = (t: { goodTotal: number; passed: number }) => (t.goodTotal ? t.passed / t.goodTotal : 1);
  const GOOD_MIN = 0.8; // 정상 표본 통과율 하한(위반을 하나도 못 놓치는 것에 더해, 정상 표본을 대부분 통과시켜야 효력이 있다)
  // 효력 조건: 개발 표본(확실 라벨)과 숨김 표본 양쪽에서 위반 자동 통과 0 · 정상 통과 ≥ 80%, 화풍은 강한 라벨만.
  const probeMissed = probe.filter(c => byLabel.get(c.label!)!.view34?.verdict === 'pass').map(c => c.label!);
  const ok = probeMissed.length === 0 && humanAutoPass.length === 0 && devA.missed.length === 0 && goodRate(devA) >= GOOD_MIN && holdA.missed.length === 0 && goodRate(holdA) >= GOOD_MIN
    && freshA.missed.length === 0
    && (frozen2.length ? frozen2A.missed.length === 0 && goodRate(frozen2A) >= GOOD_MIN : true)
    && (frozen.length ? frozenA.missed.length === 0 && goodRate(frozenA) >= GOOD_MIN && frozenStyle.missed.length === 0 && goodRate(frozenStyle) >= GOOD_MIN : false)
    && strong.missed.length === 0 && goodRate(strong) >= GOOD_MIN;
  const record = {
    schema: 'oprn-object-gate-profile/1' as const, profileHash, status: ok && full ? 'calibrated' as const : 'rejected' as const, calibratedAt: new Date().toISOString(),
    bad: { total: devA.badTotal, caught: devA.caught, missed: devA.missed, refer: devA.badRefer }, good: { total: devA.goodTotal, passed: devA.passed, falseFail: devA.falseFail, refer: devA.goodRefer },
    tiers, holdout: { bad: { total: holdA.badTotal, caught: holdA.caught, missed: holdA.missed }, good: { total: holdA.goodTotal, passed: holdA.passed, falseFail: holdA.falseFail } },
    fresh: { bad: { total: freshA.badTotal, caught: freshA.caught, missed: freshA.missed }, good: { total: freshA.goodTotal, passed: freshA.passed, falseFail: freshA.falseFail } },
    frozen2: { set: FROZEN2, bad: { total: frozen2A.badTotal, caught: frozen2A.caught, missed: frozen2A.missed }, good: { total: frozen2A.goodTotal, passed: frozen2A.passed, falseFail: frozen2A.falseFail } },
    frozen: { set: FROZEN, bad: { total: frozenA.badTotal, caught: frozenA.caught, missed: frozenA.missed }, good: { total: frozenA.goodTotal, passed: frozenA.passed, falseFail: frozenA.falseFail }, style: { shallow: { total: frozenStyle.badTotal, caught: frozenStyle.caught, missed: frozenStyle.missed }, beodeul: { total: frozenStyle.goodTotal, passed: frozenStyle.passed, falseFail: frozenStyle.falseFail } } },
    probe: { total: probe.length, passed: probeMissed.length, missed: probeMissed },
    humanOnly: { total: humanItems.length, refer: humanItems.filter(c => byLabel.get(c.label!)!.view34?.verdict === 'refer').length, autoPassed: humanAutoPass },
    style: { ...strong, groups }, judge: OBJECT_GATE_PROFILE.judges.map(j => `${j.model}(${j.effort})`).join('+'),
    note: full ? undefined : '부분 실행(--set/--limit/--runs) — 효력 없음',
  };
  const out = resolve(root, `run-${profileHash}${full ? '' : '-partial'}.json`);
  writeFileSync(out, `${JSON.stringify(receipts.map(r => ({ label: r.label, verdict: r.verdict, view34: r.view34, style: r.style, metrics: r.metrics, runs: r.runs.map(x => ({ run: x.run, pass: x.pass, a: x.answer ? { top: x.answer.top_rows, open: x.answer.opening_visible, kindOk: x.answer.kind_matches, evidence: x.answer.evidence } : null, error: x.error })) })), null, 1)}\n`);
  const t = (x: ReturnType<typeof tally>) => `위반 ${x.caught}/${x.badTotal} 막음(보류 ${x.badRefer}), 정상 ${x.passed}/${x.goodTotal} 통과(보류 ${x.goodRefer})`;
  console.log(`\n프로필 ${profileHash} (${record.judge})`);
  console.log(`3/4 개발·확실(A)  ${t(devA)}`);
  console.log(`3/4 숨김(1차, 조정에 쓰임)·확실(A)  ${t(holdA)}`);
  console.log(`3/4 조정용 옛 숨김(fresh·fresh2·fresh3, 결과를 본 표본)·확실(A)  ${t(freshA)}`);
  console.log(`3/4 얼린 새 숨김(${FROZEN}, 블라인드 화소 라벨)·확실(A)  ${t(frozenA)}`);
  if (frozen2.length) console.log(`3/4 얼린 새 숨김 2(${FROZEN2}, 좌석 위주, v10 계약 블라인드 라벨)·확실(A)  ${t(frozen2A)}`);
  console.log(`화풍 얼린 새 숨김(${FROZEN})  얕음 ${frozenStyle.caught}/${frozenStyle.badTotal} 막음 · 버들 ${frozenStyle.passed}/${frozenStyle.goodTotal} 통과`);
  if (probe.length) { console.log(`적대 시험(위반 ${probe.length}장을 면제 종류로 거짓 선언)  통과 ${probeMissed.length}/${probe.length}${probeMissed.length ? ' — ' + probeMissed.join(', ') : ''}`); }
  if (humanItems.length) console.log(`사람 승인 전용 종류(front_prop, 자동 통과율 분모에서 뺌)  ${humanItems.length}장: 보류 ${humanItems.filter(c => byLabel.get(c.label!)!.view34?.verdict === 'refer').length} · 자동 통과 ${humanAutoPass.length}${humanAutoPass.length ? ' — ' + humanAutoPass.join(', ') : ''}`);
  for (const [k, v] of Object.entries(tiers)) console.log(`   등급 ${k}: 위반 자동통과 ${v.bad.passed}/${v.bad.total} · 정상 통과 ${v.good.passed}/${v.good.total}`);
  console.log(`화풍 강한 라벨만  얕음 ${strong.caught}/${strong.badTotal} 막음 · 버들 ${strong.passed}/${strong.goodTotal} 통과 (약한 라벨 포함: 얕음 ${sty.caught}/${sty.badTotal} · 버들 ${sty.passed}/${sty.goodTotal})`);
  for (const [g, v] of Object.entries(groups)) console.log(`  화풍 그룹 ${g.padEnd(18)} 통과 ${v.passed}/${v.total}`);
  console.log(`→ ${record.status}${record.note ? ` (${record.note})` : ''}`);
  if (devA.missed.length) console.log(`놓친 3/4 위반(개발): ${devA.missed.join(', ')}`);
  if (holdA.missed.length) console.log(`놓친 3/4 위반(숨김): ${holdA.missed.join(', ')}`);
  if (freshA.missed.length) console.log(`놓친 3/4 위반(fresh): ${freshA.missed.join(', ')}`);
  if (frozenA.missed.length) console.log(`놓친 3/4 위반(얼린 새 숨김): ${frozenA.missed.join(", ")}`);
  if (frozen2A.missed.length) console.log(`놓친 3/4 위반(얼린 새 숨김 2): ${frozen2A.missed.join(", ")}`);
  if (frozenStyle.missed.length) console.log(`놓친 화풍(얼린 새 숨김, 얕음인데 통과): ${frozenStyle.missed.join(", ")}`);
  if (strong.missed.length) console.log(`놓친 화풍(강한 라벨, 얕음인데 통과): ${strong.missed.join(', ')}`);
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
