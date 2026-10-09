/**
 * object-gate 판정기(bun). review · calibrate · audit 단계.
 * 판정자 지시문·종류·규칙은 src/harnesses/_core/objectGate/rules.ts 하나에서 온다. 여기서 바꾸지 않는다.
 */
import { readFileSync, existsSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, basename, dirname } from 'node:path';
import { PNG } from 'pngjs';
import { completeProvider } from '../../../../scripts/lib/ohMyPiPiAiRuntime.ts';
import { resolveRequestApiKey } from '../../../../scripts/lib/aiAuthRuntime.ts';
import {
  OBJECT_GATE_KINDS, OBJECT_GATE_PROFILE, OBJECT_GATE_RUBRIC, decideObjectGate, decideObjectGateRun, objectGatePixelSha256, objectGateProfileHash,
  type ObjectGateKind, type ObjectGateReceipt, type ObjectGateRun,
} from '../../_core/objectGate';
import { GATE_DATA, readPng, readReceipt, writeProfile, writeReceipt } from './store';
import { receiptCells } from './cells';

type Item = { png: string; kind: ObjectGateKind; name: string; label?: string };

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

async function ask(judge: (typeof OBJECT_GATE_PROFILE.judges)[number], item: Item, png: Buffer) {
  const apiKey = await resolveRequestApiKey(judge.provider);
  const { completion } = await completeProvider(judge.provider, {
    model: judge.model, reasoning: { effort: judge.effort },
    messages: [
      { role: 'system', content: OBJECT_GATE_RUBRIC },
      { role: 'user', content: [
        { type: 'text', text: `Object name: ${item.name}\nKind: ${item.kind} — ${OBJECT_GATE_KINDS[item.kind]?.meaning ?? 'other'}` },
        { type: 'image_url', image_url: { url: `data:image/png;base64,${png.toString('base64')}` } },
      ] },
    ],
  }, { apiKey: apiKey as string | undefined }) as { completion: { choices: Array<{ message: { content?: string } }> } };
  const text = completion.choices[0]?.message.content ?? '';
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

async function judgeItems(items: Item[], opts: { force: boolean; write: boolean; concurrency: number }): Promise<ObjectGateReceipt[]> {
  const profileHash = await objectGateProfileHash();
  const jobs: Array<{ item: Item; sha: string; image: Buffer; width: number; height: number; judge: (typeof OBJECT_GATE_PROFILE.judges)[number]; run: number }> = [];
  const prepared: Array<{ item: Item; sha: string; width: number; height: number; cells?: Record<string, string[]>; cached?: ObjectGateReceipt }> = [];
  for (const item of items) {
    if (!OBJECT_GATE_KINDS[item.kind]) throw Error(`모르는 종류 ${item.kind} (${item.png}). 종류: ${Object.keys(OBJECT_GATE_KINDS).join(', ')}`);
    const { width, height, data } = readPng(item.png);
    const sha = await objectGatePixelSha256(width, height, data);
    const cached = readReceipt(sha);
    if (!opts.force && cached && cached.profileHash === profileHash && cached.kind === item.kind) {
      // 같은 그림을 다른 여백으로 다시 받았으면 칸 해시만 보탠다(판정은 그대로).
      const more = receiptCells(width, height, data), cells = { ...(cached.cells ?? {}) };
      let grew = false;
      for (const [ts, list] of Object.entries(more)) { const merged = [...new Set([...(cells[ts] ?? []), ...list])].sort(); if (merged.length !== (cells[ts] ?? []).length) grew = true; cells[ts] = merged; }
      const receipt = grew ? { ...cached, cells } : cached;
      if (grew && opts.write) writeReceipt(receipt);
      prepared.push({ item, sha, width, height, cached: receipt }); continue;
    }
    const image = magnify(width, height, data).png;
    prepared.push({ item, sha, width, height, cells: receiptCells(width, height, data) });
    for (const judge of OBJECT_GATE_PROFILE.judges) for (let run = 1; run <= OBJECT_GATE_PROFILE.runsPerJudge; run++) jobs.push({ item, sha, image, width, height, judge, run });
  }
  const results = await pool(jobs, opts.concurrency, async job => {
    const t = Date.now();
    try {
      const answer = await ask(job.judge, job.item, job.image);
      return { sha: job.sha, run: { judge: job.judge.id, run: job.run, answer, ...decideObjectGateRun(job.item.kind, answer), ms: Date.now() - t } as ObjectGateRun };
    } catch (error) {
      return { sha: job.sha, run: { judge: job.judge.id, run: job.run, answer: null, pass: false, reasons: ['판정자 호출 실패'], ms: Date.now() - t, error: String(error).slice(0, 300) } as ObjectGateRun };
    }
  });
  const receipts: ObjectGateReceipt[] = [];
  for (const p of prepared) {
    if (p.cached) { receipts.push(p.cached); continue; }
    const runs = results.filter(r => r.sha === p.sha).map(r => r.run).sort((a, b) => a.judge.localeCompare(b.judge) || a.run - b.run);
    const decision = decideObjectGate(p.item.kind, runs.map(r => r.answer));
    const reasons = decision.reasons;
    const receipt: ObjectGateReceipt = {
      schema: 'oprn-object-gate-receipt/1', pixelSha256: p.sha, width: p.width, height: p.height, kind: p.item.kind, name: p.item.name,
      ...(p.item.label ? { label: p.item.label } : {}), profileHash, verdict: decision.pass ? 'pass' : 'fail',
      reasons, runs, decidedAt: new Date().toISOString(), cells: p.cells,
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
const concurrency = Number(option('concurrency') ?? 8);

const readBatch = (path: string): Item[] => readFileSync(path, 'utf8').split('\n').filter(l => l.trim()).map(l => {
  const raw = JSON.parse(l) as Item; return { ...raw, png: resolve(dirname(resolve(path)), raw.png) };
});

const line = (r: ObjectGateReceipt) => `${r.verdict === 'pass' ? 'PASS' : 'FAIL'}  ${r.kind.padEnd(14)} ${(r.label ?? r.name).padEnd(40)} ${r.pixelSha256.slice(0, 12)}  ${r.verdict === 'pass' ? '' : r.reasons.slice(0, 3).join(' · ')}`;

if (stage === 'review' || stage === 'audit') {
  const batch = option('batch');
  const items: Item[] = batch ? readBatch(batch) : [{ png: resolve(option('png') ?? ''), kind: option('kind') as ObjectGateKind, name: option('name') ?? basename(option('png') ?? ''), label: option('label') }];
  if (!batch && (!option('png') || !option('kind'))) throw Error('review --png <그림> --kind <종류> [--name 이름] [--label 표식] | --batch items.jsonl({png,kind,name,label})');
  const receipts = await judgeItems(items, { force: flag('force'), write: true, concurrency });
  for (const r of receipts) console.log(line(r));
  const passed = receipts.filter(r => r.verdict === 'pass').length;
  console.log(`\n${passed}/${receipts.length} 통과 · 영수증 ${resolve(GATE_DATA, 'receipts')}`);
  if (stage === 'audit') {
    const out = resolve(option('out') ?? resolve(GATE_DATA, 'audit', `${new Date().toISOString().slice(0, 10)}.json`));
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, `${JSON.stringify(receipts.map(r => ({ label: r.label ?? r.name, kind: r.kind, verdict: r.verdict, reasons: r.reasons, sha: r.pixelSha256 })), null, 1)}\n`);
    console.log(`감사 보고서 ${out} (막지 않는다)`);
    process.exit(0);
  }
  process.exit(passed === receipts.length ? 0 : 3);
}

if (stage === 'preview') {
  // 판정자가 받는 확대 그림을 사람이 확인하는 용도.
  const png = resolve(option('png') ?? ''); const { width, height, data } = readPng(png);
  const out = resolve(option('out') ?? png.replace(/\.png$/, '.gate.png'));
  writeFileSync(out, magnify(width, height, data).png); console.log(out); process.exit(0);
}

if (stage === 'calibrate') {
  const root = resolve(GATE_DATA, 'calibration');
  const sets = readdirSync(root).filter(d => existsSync(resolve(root, d, 'labels.json')));
  const items: Array<Item & { truth: 'bad' | 'good' }> = [];
  for (const set of sets) {
    const labels = JSON.parse(readFileSync(resolve(root, set, 'labels.json'), 'utf8')) as { bad: Record<string, string>; good: Record<string, string>; kinds: Record<string, ObjectGateKind> };
    for (const truth of ['bad', 'good'] as const) for (const name of Object.keys(labels[truth])) {
      const kind = labels.kinds[name];
      if (!kind) throw Error(`${set}/${name} 종류가 labels.kinds 에 없다`);
      items.push({ png: resolve(root, set, `${name}.png`), kind, name: name.replace(/^props?[._]/, '').replace(/__.*$/, '').replace(/_/g, ' '), label: `${set}/${name}`, truth });
    }
  }
  // 보정은 영수증을 덮어쓰지 않는다(표본 그림은 고치기 전 판이라 출구에 쓰이지 않는다).
  const receipts = await judgeItems(items, { force: true, write: false, concurrency });
  const byLabel = new Map(receipts.map(r => [r.label!, r]));
  const missed: string[] = [], falseFail: string[] = [];
  for (const item of items) {
    const r = byLabel.get(item.label!)!;
    console.log(`${item.truth === 'bad' ? '위반' : '정상'}  ${line(r)}`);
    if (item.truth === 'bad' && r.verdict === 'pass') missed.push(item.label!);
    if (item.truth === 'good' && r.verdict === 'fail') falseFail.push(item.label!);
  }
  const bad = items.filter(i => i.truth === 'bad').length, good = items.length - bad;
  const profileHash = await objectGateProfileHash();
  const record = {
    schema: 'oprn-object-gate-profile/1' as const, profileHash, status: missed.length === 0 ? 'calibrated' as const : 'rejected' as const,
    calibratedAt: new Date().toISOString(),
    bad: { total: bad, caught: bad - missed.length, missed }, good: { total: good, passed: good - falseFail.length, falseFail },
  };
  const out = resolve(GATE_DATA, 'calibration', `run-${profileHash}.json`);
  writeFileSync(out, `${JSON.stringify(receipts.map(r => ({ label: r.label, verdict: r.verdict, reasons: r.reasons, runs: r.runs.map(x => ({ judge: x.judge, run: x.run, pass: x.pass, top: x.answer?.top_rows, open: x.answer?.opening_visible, openRows: x.answer?.opening_rows, kindOk: x.answer?.kind_matches, front: x.answer?.pure_front_elevation, evidence: x.answer?.evidence, error: x.error })) })), null, 1)}\n`);
  console.log(`\n프로필 ${profileHash}: 위반 ${record.bad.caught}/${bad} 잡음, 정상 ${record.good.passed}/${good} 통과 → ${record.status}`);
  if (missed.length) console.log(`놓친 위반: ${missed.join(', ')}`);
  console.log(`프로필 ${writeProfile(record)} · 상세 ${out}`);
  process.exit(record.status === 'calibrated' ? 0 : 3);
}

throw Error('단계: review | calibrate | audit');
