/**
 * object-gate 최종 판정 — Opus 5.5 medium 적대적 VQA (2026-10-21 사용자 결정, 옵션 A 「사람 허용이 최종」을 대체).
 *
 *   npm run harness -- object-gate final-calibrate [--limit N] [--set a,b] [--concurrency 4]
 *   npm run harness -- object-gate final-review --batch items.jsonl | --png a.png --kind K [--style-kind S] [--name ..] [--label ..]
 *   npm run harness -- object-gate final-queue [--batch <묶음 id>,..] [--index sha-index.json] [--fails out.json]
 *   npm run harness -- object-gate final-status
 *
 * 판정자는 검사관이다: 그림이 그 종류의 올바른 3/4 탑뷰(윗면이 보임·옆면/아이소 없음·정면 입면도 아님·버들항 화풍)가 「아닌」 이유를 찾고,
 * 못 찾을 때만 pass, 확신이 없으면 fail. 여러 그림을 한 호출에 본다(BATCH). 기록은 그림 화소 해시·종류·프로필 해시에 묶여 final/ 에 남는다.
 * 보정(final-calibrate)이 확실 위반(등급 A)을 하나도 놓치지 않을 때만 프로필이 calibrated 가 되고, 그때만 기록이 출구에서 효력을 갖는다.
 * 기준을 느슨하게 해서 보정을 통과시키지 않는다. 실패하면 지시문을 더 엄하게 하고 다시 잰다.
 *
 * 호출: `claude -p --model claude-opus-5-5 --effort medium`(헤드리스, 도구 없음, 빈 임시 폴더, --setting-sources ""). 경로는 셸 환경(ANTHROPIC_BASE_URL)
 * 그대로 — 이 박스는 로컬 teamclaude/8318 Claude 경로다. Argon 으로 넘어가지 않는다: 응답 modelUsage 가 Opus 가 아니면 멈춘다.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { homedir, tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { PNG } from 'pngjs';
import { OBJECT_GATE_KINDS, OBJECT_GATE_STYLE_KINDS, defaultObjectGateStyleKind, objectGatePixelSha256, type ObjectGateFinal, type ObjectGateFinalProfileRecord, type ObjectGateKind, type ObjectGateStyleKind } from '../../_core/objectGate';
import { GATE_DATA, calibratedFinalProfiles, listFinals, listQueueBatches, readFinal, readFinalProfiles, readPng, readReceipt, styleRefs, writeFinal, writeFinalProfile, writeHeldImage } from './store';
import { receiptCells } from './cells';

export const FINAL_RULES_VERSION = 3;
export const FINAL_JUDGE = { provider: 'claude-cli' as const, model: 'claude-opus-5-5', effort: 'medium' };
export const FINAL_BATCH = 6;
/** 표 수. 각 표는 다른 묶음 섞기로 따로 부른다. 모든 표가 pass 일 때만 pass — 앞 표가 fail 이면 뒤 표는 부르지 않는다(규칙 v3: 한 번만 보면 같은 그림이 판마다 뒤집혔다). */
export const FINAL_VOTES = 3;
const MAX_SIDE = 640; // 확대 그림의 긴 변 상한(8배가 넘치면 정수 배율을 낮춘다)
const MIN_GOOD_RATE = 0.5; // 모두 떨어뜨리는 판정자를 막는 하한(정상 통과율). 위반은 하나도 놓치면 안 된다.

const STANDING = Object.entries(OBJECT_GATE_KINDS).filter(([, v]) => !v.exempt).map(([k, v]) => `- ${k}: ${v.meaning}. Minimum top rows ${v.minTopRows ?? '-'}${v.minOpeningRows ? `, opening interior rows ${v.minOpeningRows}` : ''}${v.minFrontRows ? `, front face rows ${v.minFrontRows}` : ''}.`).join('\n');
const EXEMPT = Object.entries(OBJECT_GATE_KINDS).filter(([, v]) => v.exempt).map(([k, v]) => `- ${k}: ${v.meaning}.`).join('\n');

export const FINAL_SYSTEM = `You are the PROSECUTOR at the final art gate of a 16px top-down JRPG chipset. Several candidate sprites are put before you. For EACH candidate your job is to find every reason it is NOT an acceptable map object of its declared kind. A candidate passes only when you looked hard for a defect and found none. When you are unsure, or the evidence is ambiguous, the verdict is FAIL. A wrong pass is far worse than a wrong fail: failed art is simply redrawn.

THE VIEW CONTRACT ("3/4 top view"): the camera is south of the object looking down about 45 degrees. A standing object shows (1) its TOP surfaces — horizontal surfaces seen from above, foreshortened into a band of several rows that ends in a front-edge line, often with 1-2 rows of eave shadow — AND (2) its FRONT (south) face below. An object turned east or west shows its own side profile as its south face; that is normal, but its horizontal surfaces must still be seen from above.

CHARGES — fail the candidate if ANY one holds (cite it in "reasons"):
1. FRONT ELEVATION: the main body is drawn as a flat orthographic front view; its "top" is only the 1-row outline, a 1-2 row rim/lip, or a front-facing strip (cornice, beam, panel) with no foreshortened plane behind it. Count rows on the 8x view.
2. TOP TOO THIN: the top plane exists but is shallower than the minimum rows for the declared kind (listed below), or the opening of a container does not show its inside from above.
2b. SEAT vs BACKREST (kind seat): the sitting surface is the plane at sitting height that the legs or frame attach directly under. A large panel at the top of a chair drawn like a framed picture — outlined on all sides, a bevel highlight inside, flat face shading — is the BACKREST seen face-on, not the seat. If the only possibly-horizontal part between that panel and the legs is a 1-3 row strip, charge 1. If you cannot tell whether a panel is a seat top seen from above or a backrest seen face-on, charge 1 and set sure=false.
3. A MAJOR PART HAS NO TOP: some big structural part (a cabinet hood, a second crate, a staircase, a chimney, a canopy frame, a machine housing) is drawn only as a vertical face where a horizontal surface should be visible. Decor riding on the object (a plant in a pot, a statue figure on its plinth, goods on a counter, a water jet) is not charged; the body carrying it is. For kind seat ONLY, the backrest and armrests may be vertical faces, but the SITTING SURFACE must show its top.
4. SIDE FACE / ISOMETRIC: a receding diagonal side face, a two-point or isometric projection, a visible east or west side plane next to the south face of a box-like body, or a rhombus-shaped top. 3/4 view has no receding side faces.
5. TOP-DOWN SLAB: no front face (fewer than 3 rows) — a pure plan view of a standing object.
6. COLUMN CAP: a column-like object whose top end is a dome, hat or flat band instead of an elliptical cap plate that is narrower again above and below its widest rows.
7. WRONG KIND: the declared kind does not describe the object. Exempt kinds skip charges 1-6 ONLY when the object truly is that kind (a cabinet, rack, crate, display case or sign stand called organic, debris, flat, wall_mounted, terrain or front_prop is a WRONG KIND and fails). front_prop is only a single flat front panel (A-frame sign, post sign, laundry/net drying frame, banner stand) with no volume and holding no goods.
8. STYLE BELOW THE BEODEUL BAR: compare with the Beodeul reference pieces of the same style kind at the same scale. Each theme keeps its own palette — never judge hue, brightness or saturation. Charge shallow craft: about 2-3 lightness steps per material instead of Beodeul's 5-6; a uniform near-black or pure-black outline around every shape instead of the darker tone of the adjacent material; large flat fills (5x5 source pixels or more of one colour with no grain, dot or variation); clearly less visible information per 16x16 tile than the reference; muddy, noisy or broken pixel clusters; pillow shading. Small or thin pieces are not failed for being small, but they must look as crafted as the reference beside them.

STANDING KINDS (charges 1-6 apply; minimum top rows are SOURCE pixel rows of the main top plane, back edge to front-edge line inclusive):
${STANDING}
EXEMPT KINDS (charges 1-6 do not apply if the kind is right; charges 7-8 always apply):
${EXEMPT}

HOW TO WORK: Image 1 is a GUIDE of synthetic shapes (green = right, red = wrong). Image 2 shows REAL pairs of the same object drawn wrong (red) and right (green). Image 3 shows Beodeul REFERENCE pieces for the style kinds in this call, each at 1x and magnified. Then each candidate gets one image labelled with its number: the candidate at 1x (left; how it reads in the game) and magnified with a faint 1-pixel grid and a brighter line every 4 source rows (right; count rows there). The grey/checker background is not part of the sprite. Judge each candidate on its own; the others in the call are unrelated. Do not let a detailed or pretty drawing talk you out of a structural charge.

Reply ONLY a JSON array, one object per candidate in order:
[{"id": <number>, "kind_ok": bool, "facing": "south"|"east"|"west"|"north"|"round"|"unclear", "top_rows": int, "front_rows": int, "charges": [<numbers of charges that hold>], "view34": "pass"|"fail", "style": "pass"|"fail", "sure": bool, "reasons": [short strings, each naming the charge and pointing at rows/parts], "verdict": "pass"|"fail"}]
"verdict" is "pass" only if kind_ok is true, view34 and style are both "pass", charges is empty and sure is true. Otherwise "fail" with at least one reason.`;

// ---------- 그림 ----------
type Img = { width: number; height: number; data: Uint8Array };
const DIGITS = ['111101101101111', '010110010010111', '111001111100111', '111001111001111', '101101111001001', '111100111001111', '111100111101111', '111001001001001', '111101111101111', '111101111001111'];
const HASH = '010111010111010'; // '#' 대용 3×5

class Canvas {
  png: PNG;
  constructor(public W: number, public H: number, bg: [number, number, number]) {
    this.png = new PNG({ width: W, height: H });
    for (let i = 0; i < W * H; i++) { this.png.data[i * 4] = bg[0]; this.png.data[i * 4 + 1] = bg[1]; this.png.data[i * 4 + 2] = bg[2]; this.png.data[i * 4 + 3] = 255; }
  }
  put(x: number, y: number, r: number, g: number, b: number, a = 255) {
    if (x < 0 || y < 0 || x >= this.W || y >= this.H) return;
    const i = (y * this.W + x) * 4, k = a / 255, d = this.png.data;
    d[i] = Math.round(d[i]! * (1 - k) + r * k); d[i + 1] = Math.round(d[i + 1]! * (1 - k) + g * k); d[i + 2] = Math.round(d[i + 2]! * (1 - k) + b * k);
  }
  /** 투명 배경 칸은 체커, 그 위에 그림. grid = 1화소 격자(+4행마다 밝은 선). */
  blit(img: Img, ox: number, oy: number, s: number, grid: boolean) {
    for (let py = 0; py < img.height; py++) for (let px = 0; px < img.width; px++) {
      const c = (px + py) % 2 ? 84 : 100, si = (py * img.width + px) * 4;
      for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) {
        const x = ox + px * s + dx, y = oy + py * s + dy;
        this.put(x, y, c, c + 4, c + 14);
        this.put(x, y, img.data[si]!, img.data[si + 1]!, img.data[si + 2]!, img.data[si + 3]!);
        if (grid && (dx === 0 || dy === 0)) { if (dy === 0 && py % 4 === 0) this.put(x, y, 255, 255, 120, 110); else this.put(x, y, 0, 0, 0, 38); }
      }
    }
  }
  text(s: string, x: number, y: number, k = 3) {
    [...s].forEach((ch, n) => {
      const bits = ch === '#' ? HASH : DIGITS[Number(ch)]; if (!bits) return;
      for (let i = 0; i < 15; i++) if (bits[i] === '1') for (let dy = 0; dy < k; dy++) for (let dx = 0; dx < k; dx++) this.put(x + n * 4 * k + (i % 3) * k + dx, y + Math.floor(i / 3) * k + dy, 255, 255, 255);
    });
  }
  buf() { return PNG.sync.write(this.png); }
}
const scaleFor = (img: Img) => Math.max(2, Math.min(8, Math.floor(MAX_SIDE / Math.max(img.width, img.height))));

/** 후보 한 장: 번호 · 1배 · 확대(격자). */
export function candidateBoard(img: Img, n: number): Buffer {
  const s = scaleFor(img), pad = 10, head = 26;
  const W = pad + img.width + pad * 2 + img.width * s + pad, H = head + Math.max(img.height, img.height * s) + pad;
  const c = new Canvas(W, H, [64, 66, 76]);
  c.text(`#${n}`, pad, 4, 4);
  c.blit(img, pad, head + img.height * s - img.height, 1, false);
  c.blit(img, pad + img.width + pad * 2, head, s, true);
  return c.buf();
}

/** 화풍 기준판: 이 호출에 든 화풍 종류마다 버들항 기준 그림 최대 2장, 1배 + 확대. */
export function referenceBoard(kinds: ObjectGateStyleKind[]): Buffer {
  const rows = kinds.map(k => styleRefs(k).slice(0, 2).map(r => readPng(r.path) as Img));
  const pad = 10, gap = 16;
  const rowDims = rows.map(imgs => {
    let w = pad, h = 0;
    for (const img of imgs) { const s = Math.max(2, Math.min(8, Math.floor(320 / Math.max(img.width, img.height)))); w += img.width + pad + img.width * s + gap; h = Math.max(h, img.height * s); }
    return { w, h };
  });
  const W = Math.max(200, ...rowDims.map(d => d.w)), H = rowDims.reduce((a, d) => a + d.h + pad * 2, pad);
  const c = new Canvas(W, H, [64, 66, 76]);
  let y = pad;
  rows.forEach((imgs, r) => {
    let x = pad;
    for (const img of imgs) {
      const s = Math.max(2, Math.min(8, Math.floor(320 / Math.max(img.width, img.height))));
      c.blit(img, x, y + rowDims[r]!.h - img.height, 1, false); x += img.width + pad;
      c.blit(img, x, y + rowDims[r]!.h - img.height * s, s, false); x += img.width * s + gap;
    }
    y += rowDims[r]!.h + pad * 2;
  });
  return c.buf();
}

// ---------- 프로필 ----------
const fileHash = (p: string) => (existsSync(p) ? createHash('sha256').update(readFileSync(p)).digest('hex').slice(0, 16) : null);
export function finalProfile() {
  const manifest = resolve(GATE_DATA, 'style-refs', 'manifest.json');
  return { version: FINAL_RULES_VERSION, judge: FINAL_JUDGE, system: FINAL_SYSTEM, batch: FINAL_BATCH, votes: FINAL_VOTES, maxSide: MAX_SIDE, minGoodRate: MIN_GOOD_RATE,
    guide: fileHash(resolve(GATE_DATA, 'view34-guide.png')), pairs: fileHash(resolve(GATE_DATA, 'view34-pairs.png')), styleRefs: fileHash(manifest), board: 'v1-1x+grid' };
}
const stable = (v: unknown): string => Array.isArray(v) ? `[${v.map(stable).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`).join(',')}}` : JSON.stringify(v);
export const finalProfileHash = () => createHash('sha256').update(stable(finalProfile())).digest('hex').slice(0, 16);

// ---------- 호출 ----------
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
class JudgeUnavailable extends Error {}
function askOpus(system: string, content: Array<Record<string, unknown>>): Promise<{ text: string; usage: unknown }> {
  const cwd = mkdtempSync(resolve(tmpdir(), 'oprn-final-judge-'));
  return new Promise((done, fail) => {
    const child = spawn('claude', ['-p', '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose', '--model', FINAL_JUDGE.model, '--effort', FINAL_JUDGE.effort,
      '--system-prompt', system, '--tools', '', '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}', '--setting-sources', '', '--disable-slash-commands', '--no-session-persistence'],
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
      if (!used.length || used.some(m => m !== FINAL_JUDGE.model)) return fail(new JudgeUnavailable(`판정자가 ${FINAL_JUDGE.model} 가 아니다(modelUsage: ${used.join(',') || '없음'}) — 다른 모델로 판정하지 않는다`));
      done({ text: String(result.result ?? ''), usage: result.modelUsage });
    });
    child.stdin.end(`${JSON.stringify({ type: 'user', message: { role: 'user', content } })}\n`);
  });
}

export type FinalItem = { png: string; kind: ObjectGateKind; styleKind?: ObjectGateStyleKind; name: string; label?: string };
type Prepared = FinalItem & { img: Img; sha: string; styleKind: ObjectGateStyleKind };
type Answer = { votes?: string[]; id: number; kind_ok: boolean; view34: string; style: string; sure: boolean; charges: number[]; reasons: string[]; verdict: string; top_rows?: number; front_rows?: number; facing?: string };

const CACHE = resolve(process.env.OPUS_GATE_CACHE ?? resolve(homedir(), '.cache', 'opus-gate'), 'answers');
const cachePath = (profile: string, p: Prepared, vote: number) => resolve(CACHE, profile, `${p.sha.slice(0, 24)}-${p.kind}-${p.styleKind}-v${vote}.json`);

/** 한 호출 = 같은 화풍 종류 묶음 최대 FINAL_BATCH 장. 답이 모자라거나 틀리면 그 호출을 다시(3번까지). */
async function judgeCall(batch: Prepared[], profile: string, vote: number): Promise<Map<Prepared, Answer | { error: string }>> {
  const kinds = [...new Set(batch.map(p => p.styleKind))];
  const guide = readFileSync(resolve(GATE_DATA, 'view34-guide.png')), pairs = readFileSync(resolve(GATE_DATA, 'view34-pairs.png'));
  const images = [guide, pairs, referenceBoard(kinds), ...batch.map((p, i) => candidateBoard(p.img, i + 1))];
  const lines = batch.map((p, i) => `#${i + 1}: declared kind "${p.kind}" — ${OBJECT_GATE_KINDS[p.kind].meaning}. Style kind "${p.styleKind}" (${OBJECT_GATE_STYLE_KINDS[p.styleKind]}). Name: ${p.name}. Size ${p.img.width}x${p.img.height} source pixels (shown at 1x and ${scaleFor(p.img)}x).`);
  const text = `Image 3 rows (top to bottom): Beodeul references for style kinds ${kinds.join(', ')}.\nCandidates (images 4..${3 + batch.length}):\n${lines.join('\n')}\nProsecute each candidate. Reply only the JSON array with ${batch.length} objects.`;
  const content = [{ type: 'text', text }, ...images.map(b => ({ type: 'image', source: { type: 'base64', media_type: 'image/png', data: b.toString('base64') } }))];
  let last = '';
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const { text: reply } = await askOpus(FINAL_SYSTEM, content);
      const m = reply.match(/\[[\s\S]*\]/);
      const arr = m ? JSON.parse(m[0]) as Answer[] : null;
      if (!arr || arr.length !== batch.length || arr.some((a, i) => Number(a.id) !== i + 1)) { last = `답 형식이 맞지 않다: ${reply.slice(0, 200)}`; continue; }
      const out = new Map<Prepared, Answer>();
      batch.forEach((p, i) => { const a = arr[i]!; out.set(p, a); mkdirSync(dirname(cachePath(profile, p, vote)), { recursive: true }); writeFileSync(cachePath(profile, p, vote), JSON.stringify(a)); });
      return out;
    } catch (e) {
      if (e instanceof JudgeUnavailable) throw e;
      last = String(e);
      if (/\b429\b|\b529\b|overloaded|rate.?limit|quota/i.test(last)) { console.error(`  ⏸ 할당량·과부하 — 90초 쉰다: ${last.slice(0, 120)}`); await sleep(90_000); attempt--; continue; }
      await sleep(5_000);
    }
  }
  return new Map(batch.map(p => [p, { error: last }]));
}

/** 판정자 답 → 판정. 규칙이 다시 확인한다: kind_ok·두 반쪽 pass·혐의 없음·확신 — 하나라도 아니면 fail(애매하면 fail). */
export function decideFinal(a: Answer): { verdict: 'pass' | 'fail'; view34: 'pass' | 'fail'; style: 'pass' | 'fail'; kindOk: boolean; sure: boolean; reasons: string[] } {
  const view34 = a.view34 === 'pass' ? 'pass' : 'fail', style = a.style === 'pass' ? 'pass' : 'fail';
  const kindOk = a.kind_ok === true, sure = a.sure === true, charges = Array.isArray(a.charges) ? a.charges : [];
  const pass = a.verdict === 'pass' && view34 === 'pass' && style === 'pass' && kindOk && sure && charges.length === 0;
  const reasons = (Array.isArray(a.reasons) ? a.reasons.map(String) : []).filter(Boolean);
  if (!pass && !reasons.length) reasons.push(!kindOk ? '종류가 맞지 않음' : !sure ? '판정자가 확신하지 못함(애매하면 불합격)' : `3/4 ${view34} · 화풍 ${style}`);
  if (!pass && !sure && !reasons.some(r => /unsure|확신/.test(r))) reasons.push('판정자가 확신하지 못함(애매하면 불합격)');
  return { verdict: pass ? 'pass' : 'fail', view34, style, kindOk, sure, reasons: pass ? [] : reasons };
}

async function prepare(items: FinalItem[]): Promise<Prepared[]> {
  const out: Prepared[] = [];
  for (const it of items) {
    if (!OBJECT_GATE_KINDS[it.kind]) throw Error(`모르는 종류 ${it.kind} (${it.png})`);
    const styleKind = it.styleKind ?? defaultObjectGateStyleKind(it.kind);
    if (!OBJECT_GATE_STYLE_KINDS[styleKind]) throw Error(`모르는 화풍 종류 ${styleKind} (${it.png})`);
    const { width, height, data } = readPng(it.png);
    out.push({ ...it, styleKind, img: { width, height, data }, sha: await objectGatePixelSha256(width, height, data) });
  }
  return out;
}

async function pool<T>(items: T[], limit: number, fn: (x: T, i: number) => Promise<void>) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => { while (next < items.length) { const i = next++; await fn(items[i]!, i); } }));
}

/**
 * 판정. 표마다 캐시(프로필·그림·종류·표 번호)가 있으면 다시 부르지 않는다. 같은 화풍 종류끼리 묶고, 한 호출에 같은 해시를 두 번 넣지 않는다.
 * 표 r 은 r 로 씨앗을 준 섞기로 묶음을 다시 짠다(같은 이웃과 또 묶이지 않게). 앞 표가 fail 이면 그 그림은 거기서 멈춘다.
 * 돌려주는 답: 처음 fail 한 표의 답(없으면 마지막 표의 답) + votes(표마다 pass/fail).
 */
export async function judgeFinal(items: FinalItem[], opts: { concurrency: number; onCall?: (done: number, total: number) => void }): Promise<Map<Prepared, Answer | { error: string }>> {
  const profile = finalProfileHash();
  const prepared = await prepare(items);
  const votes = new Map<Prepared, Answer[]>(prepared.map(p => [p, []]));
  const errors = new Map<Prepared, string>();
  let alive = prepared;
  for (let vote = 1; vote <= FINAL_VOTES && alive.length; vote++) {
    const todo: Prepared[] = [];
    for (const p of alive) { const c = cachePath(profile, p, vote); if (existsSync(c)) votes.get(p)!.push(JSON.parse(readFileSync(c, 'utf8'))); else todo.push(p); }
    let seed = 7919 * vote; const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    const order = vote === 1 ? todo : todo.map(p => [rnd(), p] as const).sort((a, b) => a[0] - b[0]).map(x => x[1]);
    const groups = new Map<string, Prepared[]>();
    for (const p of order) (groups.get(p.styleKind) ?? groups.set(p.styleKind, []).get(p.styleKind)!).push(p);
    const calls: Prepared[][] = [];
    for (const list of groups.values()) {
      let cur: Prepared[] = [];
      const pending = [...list];
      while (pending.length) {
        const i = pending.findIndex(p => !cur.some(q => q.sha === p.sha));
        if (i < 0 || cur.length >= FINAL_BATCH) { calls.push(cur); cur = []; continue; }
        cur.push(pending.splice(i, 1)[0]!);
      }
      if (cur.length) calls.push(cur);
    }
    let done = 0;
    if (calls.length) console.error(`  표 ${vote}/${FINAL_VOTES}: ${todo.length}장 · 호출 ${calls.length} (캐시 ${alive.length - todo.length})`);
    await pool(calls, opts.concurrency, async call => {
      const got = await judgeCall(call, profile, vote);
      for (const [p, a] of got) { if ('error' in a) errors.set(p, a.error); else votes.get(p)!.push(a); }
      opts.onCall?.(++done, calls.length);
    });
    alive = alive.filter(p => !errors.has(p) && votes.get(p)!.length === vote && decideFinal(votes.get(p)!.at(-1)!).verdict === 'pass');
  }
  const results = new Map<Prepared, Answer | { error: string }>();
  for (const p of prepared) {
    const list = votes.get(p)!;
    const firstFail = list.find(a => decideFinal(a).verdict === 'fail');
    if (!firstFail && (errors.has(p) || list.length < FINAL_VOTES)) { results.set(p, { error: errors.get(p) ?? `표 ${list.length}/${FINAL_VOTES} 만 받음` }); continue; }
    results.set(p, { ...(firstFail ?? list.at(-1)!), votes: list.map(a => decideFinal(a).verdict) });
  }
  return results;
}

function finalRecord(p: Prepared, a: Answer, profileHash: string): ObjectGateFinal {
  const d = decideFinal(a);
  return { schema: 'oprn-object-gate-final/1', pixelSha256: p.sha, width: p.img.width, height: p.img.height, kind: p.kind, styleKind: p.styleKind, name: p.name, ...(p.label ? { label: p.label } : {}),
    profileHash, judge: FINAL_JUDGE, verdict: d.verdict, view34: d.view34, style: d.style, kindOk: d.kindOk, sure: d.sure, reasons: d.reasons, answer: a, decidedAt: new Date().toISOString(), cells: receiptCells(p.img.width, p.img.height, p.img.data) };
}

// ---------- 단계 ----------
const argv = process.argv.slice(2);
const stage = argv[0];
const option = (name: string) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : undefined; };
const concurrency = Math.max(1, Math.min(6, Number(option('concurrency') ?? 4)));
const isErr = (a: Answer | { error: string } | undefined): a is { error: string } | undefined => !a || 'error' in a;

if (stage === 'final-status') {
  const hash = finalProfileHash(), rec = readFinalProfiles().find(p => p.profileHash === hash);
  const finals = listFinals(), cur = finals.filter(f => f.profileHash === hash);
  console.log(`최종 판정자 ${FINAL_JUDGE.model} effort ${FINAL_JUDGE.effort} · 규칙 v${FINAL_RULES_VERSION} · 한 호출 ${FINAL_BATCH}장`);
  console.log(`현재 최종 프로필 ${hash}: ${rec ? rec.status : '보정 안 됨'}${rec ? ` (위반 잡음 ${rec.bad.caught}/${rec.bad.total} · 정상 통과 ${rec.good.passed}/${rec.good.total})` : ''}`);
  console.log(`최종 기록 ${finals.length}장 — 현재 프로필 ${cur.length} (pass ${cur.filter(f => f.verdict === 'pass').length} · fail ${cur.filter(f => f.verdict === 'fail').length}), 보정된 프로필 기록 ${finals.filter(f => calibratedFinalProfiles().has(f.profileHash)).length}`);
  process.exit(0);
}

if (stage === 'final-review') {
  const batchFile = option('batch');
  const items: FinalItem[] = batchFile
    ? readFileSync(batchFile, 'utf8').split('\n').filter(l => l.trim()).map(l => { const o = JSON.parse(l); return { ...o, png: resolve(dirname(batchFile), o.png) }; })
    : [{ png: resolve(option('png') ?? ''), kind: option('kind') as ObjectGateKind, styleKind: option('style-kind') as ObjectGateStyleKind | undefined, name: option('name') ?? 'object', label: option('label') }];
  const hash = finalProfileHash();
  if (!calibratedFinalProfiles().has(hash)) { console.error(`최종 프로필 ${hash} 가 보정되지 않았다 — final-calibrate 를 먼저 통과해야 기록을 쓴다`); process.exit(3); }
  const res = await judgeFinal(items, { concurrency, onCall: (d, t) => console.error(`  호출 ${d}/${t}`) });
  let fail = 0;
  for (const [p, a] of res) {
    if (isErr(a)) { console.log(`ERR  ${p.label ?? p.name}: ${(a?.error ?? "답 없음").slice(0, 160)}`); fail++; continue; }
    const r = finalRecord(p, a, hash); writeFinal(r); writeHeldImage(p.sha, p.img.width, p.img.height, p.img.data);
    if (r.verdict !== 'pass') fail++;
    console.log(`${r.verdict.toUpperCase()} ${p.kind.padEnd(14)} ${(p.label ?? p.name).padEnd(40)} ${r.reasons.join(' · ').slice(0, 200)}`);
  }
  process.exit(fail ? 3 : 0);
}

if (stage === 'final-calibrate') {
  const root = resolve(GATE_DATA, 'calibration');
  type Tier = 'A' | 'B' | 'C' | 'U' | 'D' | 'K';
  type Cal = FinalItem & { truth: 'bad' | 'good'; half: 'view34' | 'style'; set: string; tier: Tier; weak?: boolean };
  const tierMap = existsSync(resolve(root, 'tiers.json')) ? (JSON.parse(readFileSync(resolve(root, 'tiers.json'), 'utf8')) as { tiers: Record<string, { tier: Tier }> }).tiers : {};
  const onlySets = option('set')?.split(',');
  const cal: Cal[] = [];
  for (const set of readdirSync(root).filter(d => !['history', 'answers', 'murim-postfix-unlabeled'].includes(d) && (existsSync(resolve(root, d, 'labels.json')) || existsSync(resolve(root, d, 'items.json'))))) {
    if (onlySets && !onlySets.includes(set)) continue;
    const labelsPath = resolve(root, set, 'labels.json'), itemsPath = resolve(root, set, 'items.json');
    if (existsSync(labelsPath)) {
      const labels = JSON.parse(readFileSync(labelsPath, 'utf8')) as { bad: Record<string, string>; good: Record<string, string>; kinds: Record<string, ObjectGateKind> };
      for (const truth of ['bad', 'good'] as const) for (const name of Object.keys(labels[truth])) {
        const label = `${set}/${name}`;
        cal.push({ png: resolve(root, set, `${name}.png`), kind: labels.kinds[name]!, name: name.replace(/^props?[._]/, '').replace(/__.*$/, '').replace(/_/g, ' '), label, truth, half: 'view34', set, tier: tierMap[label]?.tier ?? 'A' });
      }
    } else {
      for (const it of JSON.parse(readFileSync(itemsPath, 'utf8')) as Array<{ name: string; kind: ObjectGateKind; styleKind: ObjectGateStyleKind; view34: 'good' | 'bad' | null; style: 'good' | 'bad' | null; weak?: boolean; tier?: Tier }>) {
        const label = `${set}/${it.name}`, base = { png: resolve(root, set, `${it.name}.png`), kind: it.kind, styleKind: it.styleKind, name: it.name.replace(/__.*$/, '').replace(/[_-]/g, ' '), label, set, tier: tierMap[label]?.tier ?? it.tier ?? 'A' as Tier, weak: it.weak };
        if (it.view34) cal.push({ ...base, truth: it.view34, half: 'view34' });
        else if (it.style) cal.push({ ...base, truth: it.style, half: 'style' });
      }
    }
  }
  const limit = option('limit') ? Number(option('limit')) : undefined;
  const picked = limit ? cal.filter((_, i) => i % Math.ceil(cal.length / limit) === 0) : cal;
  // 섞는다(고정 씨앗) — 한 호출에 위반·정상이 섞이게.
  let seed = 20261021; const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const shuffled = picked.map(c => [rnd(), c] as const).sort((a, b) => a[0] - b[0]).map(x => x[1]);
  const hash = finalProfileHash();
  console.error(`최종 보정 ${hash}: 표본 ${shuffled.length}장 (Opus 5.5 medium, 한 호출 ${FINAL_BATCH}장, 병렬 ${concurrency})`);
  const res = await judgeFinal(shuffled, { concurrency, onCall: (d, t) => { if (d % 5 === 0 || d === t) console.error(`  호출 ${d}/${t}`); } });
  const bySrc = new Map<string, Answer | { error: string }>();
  for (const [p, a] of res) bySrc.set(`${p.label}|${p.kind}`, a);
  // 위반 = 확실(A) 3/4 위반 + 적대 시험(adv-*) + 강한 라벨 화풍 얕음. 하나라도 pass 면 효력 없음.
  const strict = (c: Cal) => c.truth === 'bad' ? (c.tier === 'A' && !(c.half === 'style' && c.weak)) : (c.tier === 'A' && !(c.half === 'style' && c.weak));
  const missed: string[] = [], falseFail: string[] = [], errors: string[] = [];
  let bad = 0, good = 0, overallGood = 0, overallPass = 0;
  const sets: Record<string, { bad: { total: number; caught: number }; good: { total: number; passed: number } }> = {};
  const tiers: Record<string, { bad: { total: number; passed: number }; good: { total: number; passed: number } }> = {};
  const lines: string[] = [];
  for (const c of shuffled) {
    const a = bySrc.get(`${c.label}|${c.kind}`);
    if (isErr(a)) { errors.push(c.label!); continue; }
    const d = decideFinal(a);
    // 정상: 라벨이 보증하는 반쪽으로 센다(3/4 라벨은 화풍을, 화풍 라벨은 3/4 를 보증하지 않는다 — 옛 보정과 같다). 전체 통과는 따로 센다.
    // 위반: 출구는 전체 판정을 쓰므로 전체가 fail 이면 막은 것이다.
    const halfPass = c.half === 'view34' ? d.view34 === 'pass' && d.kindOk : d.style === 'pass';
    const pass = c.truth === 'bad' ? d.verdict === 'pass' : halfPass;
    if (strict(c) && c.truth === 'good') { overallGood++; if (d.verdict === 'pass') overallPass++; }
    const t = (tiers[`${c.tier}${c.half === 'style' ? '-style' : ''}`] ??= { bad: { total: 0, passed: 0 }, good: { total: 0, passed: 0 } });
    t[c.truth].total++; if (pass) t[c.truth].passed++;
    lines.push(`${c.truth === 'bad' ? '위반' : '정상'}${c.tier}${c.half === 'style' ? '화풍' : '3/4 '} ${pass ? 'PASS' : 'FAIL'} ${c.kind.padEnd(14)} ${c.label!.padEnd(46)} ${d.reasons.join(' · ').slice(0, 160)}`);
    if (!strict(c)) continue;
    const s = (sets[c.set] ??= { bad: { total: 0, caught: 0 }, good: { total: 0, passed: 0 } });
    if (c.truth === 'bad') { bad++; s.bad.total++; if (pass) missed.push(c.label!); else s.bad.caught++; }
    else { good++; s.good.total++; if (pass) s.good.passed++; else falseFail.push(c.label!); }
  }
  console.log(lines.sort().join('\n'));
  const goodRate = good ? (good - falseFail.length) / good : 0;
  const full = !limit && !onlySets;
  const ok = missed.length === 0 && errors.length === 0 && goodRate >= MIN_GOOD_RATE;
  const record: ObjectGateFinalProfileRecord = { schema: 'oprn-object-gate-final-profile/1', profileHash: hash, status: ok && full ? 'calibrated' : 'rejected', calibratedAt: new Date().toISOString(), judge: FINAL_JUDGE,
    bad: { total: bad, caught: bad - missed.length, missed }, good: { total: good, passed: good - falseFail.length, falseFail }, sets, tiers, errors,
    note: `위반 = 등급 A 3/4 위반(적대 시험 adv-* 포함) + 강한 라벨 화풍 얕음, 전체 판정으로 센다. 정상 = 라벨 반쪽(3/4 라벨은 3/4·종류, 화풍 라벨은 화풍)으로 센다, 하한 ${MIN_GOOD_RATE}. 전체 판정 정상 통과 ${overallPass}/${overallGood}. ${full ? '전체 표본' : '부분 표본 — 효력 없음'}` };
  if (full) writeFinalProfile(record);
  writeFileSync(resolve(root, `final-run-${hash}.json`), `${JSON.stringify({ ...record, lines: lines.sort() }, null, 1)}\n`);
  console.log(`\n== 최종 보정 ${hash}: ${record.status}`);
  console.log(`   위반 잡음 ${bad - missed.length}/${bad}${missed.length ? ` — 놓침: ${missed.join(', ')}` : ''}`);
  console.log(`   정상 통과(라벨 반쪽) ${good - falseFail.length}/${good} (${(goodRate * 100).toFixed(1)}%) · 전체 판정 통과 ${overallPass}/${overallGood} (${overallGood ? (overallPass / overallGood * 100).toFixed(1) : 0}%)`);
  for (const [k, v] of Object.entries(sets).sort()) console.log(`   ${k.padEnd(16)} 위반 ${v.bad.caught}/${v.bad.total} · 정상 ${v.good.passed}/${v.good.total}`);
  for (const [k, v] of Object.entries(tiers).sort()) console.log(`   등급 ${k.padEnd(8)} 위반 통과 ${v.bad.passed}/${v.bad.total} · 정상 통과 ${v.good.passed}/${v.good.total}`);
  if (errors.length) console.log(`   답 못 받음 ${errors.length}: ${errors.slice(0, 10).join(', ')}`);
  process.exit(record.status === 'calibrated' ? 0 : 3);
}

if (stage === 'final-queue') {
  // 18323 대기열(queue/*.json + 자동 묶음)의 그림을 Opus 로 판정한다. 그림은 held-images 또는 --index(해시 → PNG 경로) 에서 찾는다.
  const hash = finalProfileHash();
  if (!calibratedFinalProfiles().has(hash)) { console.error(`최종 프로필 ${hash} 가 보정되지 않았다 — final-calibrate 먼저`); process.exit(3); }
  const itemsFile = option('items'); // [{sha, kind, label, name?, styleKind?, _batch}] (18323 /api/queue 의 items 모음)
  if (!itemsFile) throw Error('final-queue --items queue-items.json [--index sha-index.json] [--only-batch a,b] [--fails fails.json] [--summary summary.json]');
  const index = option('index') && existsSync(option('index')!) ? JSON.parse(readFileSync(option('index')!, 'utf8')) as Record<string, string> : {};
  const onlyBatch = option('only-batch')?.split(',');
  const all = (JSON.parse(readFileSync(itemsFile, 'utf8')) as Array<{ sha: string; kind: ObjectGateKind; label: string; name?: string; styleKind?: ObjectGateStyleKind | null; _batch: string }>).filter(x => !onlyBatch || onlyBatch.includes(x._batch));
  const heldPath = (sha: string) => resolve(GATE_DATA, 'held-images', sha.slice(0, 2), `${sha}.png`);
  const items: Array<FinalItem & { batch: string; sha: string; source: string }> = [];
  const noImage: typeof all = [];
  const seen = new Set<string>();
  for (const x of all) {
    const src = existsSync(heldPath(x.sha)) ? heldPath(x.sha) : index[x.sha];
    if (!src || !existsSync(src)) { noImage.push(x); continue; }
    const key = `${x.sha}|${x.kind}`; if (seen.has(key)) continue; seen.add(key);
    const styleKind = x.styleKind ?? readReceipt(x.sha)?.style?.styleKind ?? undefined;
    items.push({ png: src, kind: x.kind, styleKind: styleKind ?? undefined, name: x.name ?? x.label.split('/').pop()!, label: x.label, batch: x._batch, sha: x.sha, source: src });
  }
  console.error(`대기열 ${all.length} · 판정할 그림 ${items.length} · 그림 없음 ${noImage.length}`);
  const write = () => {
    const recs = new Map(listFinals().filter(f => f.profileHash === hash).map(f => [`${f.pixelSha256}|${f.kind}`, f]));
    const per: Record<string, { total: number; judged: number; pass: number; fail: number; noImage: number }> = {};
    const fails: unknown[] = [];
    for (const x of all) {
      const b = (per[x._batch] ??= { total: 0, judged: 0, pass: 0, fail: 0, noImage: 0 }); b.total++;
      const f = recs.get(`${x.sha}|${x.kind}`);
      if (!f) { if (noImage.includes(x)) b.noImage++; continue; }
      b.judged++; if (f.verdict === 'pass') b.pass++; else { b.fail++; fails.push({ sha: x.sha, batch: x._batch, label: x.label, kind: x.kind, styleKind: f.styleKind, reasons: f.reasons, source: items.find(i => i.sha === x.sha)?.source ?? null }); }
    }
    if (option('fails')) { mkdirSync(dirname(option('fails')!), { recursive: true }); writeFileSync(option('fails')!, `${JSON.stringify(fails, null, 1)}\n`); }
    if (option('summary')) writeFileSync(option('summary')!, `${JSON.stringify({ profile: hash, at: new Date().toISOString(), totals: { queue: all.length, toJudge: items.length, noImage: noImage.length }, batches: per }, null, 1)}\n`);
  };
  // 묶음 순서대로(사람이 만든 묶음 먼저), 묶음마다 호출을 끝낸 뒤 기록·요약을 쓴다.
  const order = [...new Set(items.map(i => i.batch))].sort((a, b) => Number(a.startsWith('auto:')) - Number(b.startsWith('auto:')) || a.localeCompare(b));
  for (const b of order) {
    const list = items.filter(i => i.batch === b && !readFinal(i.sha)?.profileHash?.startsWith(hash));
    if (!list.length) { write(); continue; }
    console.error(`[${b}] ${list.length}장`);
    const res = await judgeFinal(list, { concurrency, onCall: (d, t) => { if (d % 10 === 0 || d === t) console.error(`  [${b}] 호출 ${d}/${t}`); } });
    for (const [p, a] of res) {
      if (isErr(a)) { console.error(`  ERR ${p.label}: ${(a?.error ?? "답 없음").slice(0, 160)}`); continue; }
      writeFinal(finalRecord(p, a, hash)); writeHeldImage(p.sha, p.img.width, p.img.height, p.img.data);
    }
    write();
  }
  write();
  console.error('끝');
  process.exit(0);
}

throw Error('단계: final-calibrate | final-review | final-queue | final-status');
