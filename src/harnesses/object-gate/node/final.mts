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
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { homedir, tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { PNG } from 'pngjs';
import { OBJECT_GATE_KINDS, OBJECT_GATE_STYLE_KINDS, defaultObjectGateStyleKind, objectGatePixelSha256, type ObjectGateFinal, type ObjectGateFinalProfileRecord, type ObjectGateKind, type ObjectGateStyleKind } from '../../_core/objectGate';
import { GATE_DATA, calibratedFinalProfiles, listFinals, listQueueBatches, readFinal, readFinalProfiles, readPng, readReceipt, styleRefs, writeFinal, writeFinalProfile, writeHeldImage } from './store';
import { receiptCells, sheetCells } from './cells';

export const FINAL_RULES_VERSION = 11;
export const FINAL_JUDGE = { provider: 'claude-cli' as const, model: 'claude-opus-5-5', effort: 'medium' };
export const FINAL_BATCH = 3; // v11: 한 호출 3장(v1~v10 은 6장) — 한 그림에 주의를 더 준다
/** 표 수. 각 표는 다른 묶음 섞기·다른 기준 그림으로 따로 부른다. 과반(3표 중 2표)이 판정이다 — 두 표가 같으면 세 번째는 부르지 않는다(규칙 v7, 감독 지시 2026-10-21; v3~v6 은 만장일치). */
export const FINAL_VOTES = 3;
const MAX_SIDE = 640; // 확대 그림의 긴 변 상한(8배가 넘치면 정수 배율을 낮춘다)

const STANDING = Object.entries(OBJECT_GATE_KINDS).filter(([, v]) => !v.exempt).map(([k, v]) => `- ${k}: ${v.meaning}. Minimum top rows ${v.minTopRows ?? '-'}${v.minOpeningRows ? `, opening interior rows ${v.minOpeningRows}` : ''}${v.minFrontRows ? `, front face rows ${v.minFrontRows}` : ''}.`).join('\n');
const EXEMPT = Object.entries(OBJECT_GATE_KINDS).filter(([, v]) => v.exempt).map(([k, v]) => `- ${k}: ${v.meaning}.`).join('\n');

export const FINAL_SYSTEM = `You are the PROSECUTOR at the final art gate of a 16px top-down JRPG chipset. Several candidate sprites are put before you. Each verdict has two halves.
(1) THE 3/4 VIEW — the hard criterion. Find every reason the candidate is NOT a correct 3/4 top-view object of its declared kind. When you are unsure about the view, it FAILS (sure=false).
(2) THE STYLE — fail only for a clear, nameable mismatch with the candidate's OWN chipset (listed under charge 8). When you cannot name one, the style passes. Never judge one chipset's style by another chipset's art.

THE VIEW CONTRACT ("3/4 top view"): the camera is south of the object looking down about 45 degrees. A standing object shows (1) its TOP surfaces — horizontal surfaces seen from above, foreshortened into a band of rows that ends in a front-edge line, often with 1-2 rows of eave shadow — AND (2) its FRONT (south) face below. An object turned east or west shows its own side profile as its south face; that is normal, but its horizontal surfaces must still be seen from above.

ANCHORS: image 3 shows ACCEPTED ORIGINAL pieces of the same declared kind, taken from the house chipsets (Beodeul city, Japanese city, the hand-drawn v5 interior). They are on-style and pass this gate by definition. Each anchor is marked SAME CHIPSET (from the candidate's own chipset) or OTHER CHIPSET. All anchors are a yardstick for the 3/4 view; ONLY the SAME CHIPSET anchors are a yardstick for style (shading steps, outline colour). When no SAME CHIPSET anchor is listed, the style half may fail only under 8c or 8d. They show how deep a top plane is drawn at this size. A candidate that draws its top plane as clearly as the anchors of its kind is not charged under 1-2; a candidate whose top is clearly thinner than the anchors, or absent where the anchors show one, is. Pieces framed in RED are KNOWN VIOLATIONS of that kind; a candidate that draws its top the way a red example does fails. CONTRAST PAIRS: a GREEN-framed piece followed by a RED-framed piece is the same pattern drawn right and wrong (the call text says what differs). Use them to tell the two cases apart; do not fail a candidate for resembling the GREEN piece.

VIEW CHARGES — fail the 3/4 half if ANY one holds (cite it in "reasons"):
1. FRONT ELEVATION: the main body is drawn as a flat orthographic front view; its "top" is only the 1-row outline, a 1-2 row rim/lip, or a front-facing strip (cornice, beam, panel) with no foreshortened plane behind it. Count rows on the magnified view.
2. TOP TOO THIN: the top plane exists but is shallower than the minimum rows for the declared kind (listed below) — for a piece one tile (16 px) tall or less, one row less is enough when the accepted anchors of that kind are drawn the same way — or the opening of a container does not show its inside from above. FILLED TOPS: when a container, barrel, crate, basket, pot or shelf is filled with goods, soil, a plant or liquid that is drawn heaped or spread as seen from above (you see the tops of the fruit/loaves/bottles/leaves and the far rim or back edge behind them), that fill IS the top seen from above — count it as the top and do not charge 2 for a hidden opening. Charge only when the fill and the rim are both a flat front-facing band.
2b. SEAT vs BACKREST (kind seat): the sitting surface is the plane at sitting height that the legs or frame attach directly under. A large panel at the top of a chair drawn like a framed picture — outlined on all sides, a bevel highlight inside, flat face shading — is the BACKREST seen face-on, not the seat. If the only possibly-horizontal part between that panel and the legs is a 1-3 row strip, charge 1. If you cannot tell whether a panel is a seat top seen from above or a backrest seen face-on, charge 1 and set sure=false.
2c. SIDE-FACING SEAT (kind seat turned east or west): the sitting surface must still be a horizontal band of at least 3 rows seen from above, running from the backrest side to the front edge. If what you see is the seat's END BOARD or SIDE PANEL — a tall flat panel, cushions drawn as upright rectangles stacked in a column, an L-shaped silhouette whose seat is a 1-2 row edge — charge 2c.
3. A MAJOR PART HAS NO TOP: some big structural part (a cabinet hood, a second crate, a staircase, a chimney, a canopy frame, a machine housing) is drawn only as a vertical face where a horizontal surface should be visible. Decor riding on the object (a plant in a pot, a statue figure on its plinth, goods on a counter or shelf, a water jet) is not charged; the body carrying it is. FABRIC COVERS (an awning, a parasol, a market-stall canopy, a bed canopy curtain) slope toward the viewer; their visible striped face IS their top seen at an angle and is not charged under 3, as long as the counter, table or bed under them shows its top. For kind seat ONLY, the backrest and armrests may be vertical faces, but the SITTING SURFACE must show its top.
4. SIDE FACE / ISOMETRIC: a receding diagonal side face, a two-point or isometric projection, a visible east or west side plane next to the south face of a box-like body, or a rhombus-shaped top. 3/4 view has no receding side faces.
5. TOP-DOWN SLAB: no front face (fewer than 3 rows) — a pure plan view of a standing object. A bed drawn as a long plan-view slab with rails along both sides and no footboard or front face at its south end is charged here.
6. COLUMN CAP (also the posts of stands, frames and racks: a post or upright whose top end is cut flat with no top face, or a crossbar with no lit top face, is charged here): a pillar, stele or column whose top end is a dome, hat or flat band instead of an elliptical cap plate that is narrower again above and below its widest rows.
7. WRONG KIND: the declared kind does not describe the object. KIND CORRECTION: when the declared kind is wrong, name the closest valid STANDING kind (never an exempt kind, never front_prop) in "closest_kind", judge charges 1-6 against THAT standing kind, and do NOT list charge 7 — a wrong label alone does not fail. A correction never moves an object INTO an exempt kind: if the declared kind is standing and you think the object is organic, flat, debris, terrain or wall_mounted, keep judging it under the declared standing kind (kind_ok true). Built-in wall pieces (a wall opening such as a serving hatch or window, a wall-hung shelf, a post or pillar engaged in a wall, wainscot, a beam) are kind wall_structure; a free-standing pillar is column. List charge 7 only when no standing kind fits. A standing object declared as the nearest-fitting standing kind (a cart or stall called low_furniture, a display stand called frame) is right as declared (kind_ok true). Exempt kinds skip charges 1-6 ONLY when the object truly is that kind: a cabinet, rack, crate, display case, sign stand or wall piece declared organic, debris, flat, wall_mounted, terrain or front_prop gets kind_ok false, its standing closest_kind (wall_structure for wall pieces), and charges 1-6 judged under that standing kind. front_prop is only a single flat front panel (A-frame sign, post sign, laundry/net drying frame, banner stand) with no volume and holding no goods.

STYLE CHARGE — fail the style half only when you can name one of these with the rows/parts where it occurs:
8a. STICKER OUTLINE: a uniform pure-black or near-neutral black line around every shape and part, where the SAME CHIPSET anchors outline with darker tinted tones of the adjacent material.
8b. FLAT FILL: a main material drawn in only 1-2 tones over large areas (5x5 source pixels or more) where the SAME CHIPSET anchors shade the same material in 4 or more tones.
8c. FOREIGN PIXEL SYSTEM: mixed pixel sizes, anti-aliasing or blur, smooth gradients, painterly or photographic texture — anything not drawn on the same crisp 1-pixel grid as the anchors.
8d. ILLEGIBLE: at 1x the object cannot be recognised as what it is.
Never charge palette, hue, brightness, saturation, texture density, dither or speckle, or "less detailed than the anchor" by itself. Each theme keeps its own palette.

STANDING KINDS (charges 1-6 apply; minimum top rows are SOURCE pixel rows of the main top plane, back edge to front-edge line inclusive):
${STANDING}
EXEMPT KINDS (charges 1-6 do not apply if the kind is right; charges 7-8 always apply):
${EXEMPT}

HOW TO WORK: Image 1 is a GUIDE of synthetic shapes (green = right, red = wrong). Image 2 shows REAL pairs of the same object drawn wrong (red) and right (green). Image 3 shows the ANCHORS for the kinds in this call, one row per kind, each at 1x and magnified. Then each candidate gets one image labelled with its number: the candidate at 1x (left; how it reads in the game) and magnified with a faint 1-pixel grid and a brighter line every 4 source rows (right; count rows there). The grey/checker background is not part of the sprite. Judge each candidate on its own; the others in the call are unrelated. Do not let a detailed or pretty drawing talk you out of a structural charge.

Reply ONLY a JSON array, one object per candidate in order:
[{"id": <number>, "kind_ok": bool, "closest_kind": <standing kind name or null — only when kind_ok is false>, "facing": "south"|"east"|"west"|"north"|"round"|"unclear", "top_rows": int, "front_rows": int, "charges": [<charges that hold, e.g. 1, 2, "8a">], "view34": "pass"|"fail", "style": "pass"|"fail", "sure": bool, "reasons": [short strings, each naming the charge and pointing at rows/parts], "verdict": "pass"|"fail"}]
"sure" is about the 3/4 half. "verdict" is "pass" only if (kind_ok is true, or closest_kind names a valid kind you judged against), view34 and style are both "pass", charges is empty and sure is true. Otherwise "fail" with at least one reason.`;

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

// ---------- 기준 원본(anchors) ----------
/** 원본 묶음(calibration/originals.json) — 칩셋의 받아들여진 원본. 판정자에게 같은 종류의 기준으로 보이고(자기 자신은 빼고), 보정 조건 (b) 의 표본이기도 하다. */
type Anchor = { label: string; png: string; kind: ObjectGateKind; family: string; sha: string; img: Img; same?: boolean; note?: string; pattern?: string };
/** 틀린 예(같은 종류의 확실한 3/4 위반) 묶음 이름. 보정에서 이 그림들은 (a)·(b) 에서 뺀다(누설 방지). */
const NEGATIVE = '__negative__', CONTRAST_GOOD = '__contrast_good__', CONTRAST_BAD = '__contrast_bad__';
const SPECIAL = new Set([NEGATIVE, CONTRAST_GOOD, CONTRAST_BAD]);
/** 판정자에게 보이는 표본(틀린 예·대조 쌍) — 보정 채점에서 뺀다. */
export async function shownLabels(): Promise<Set<string>> { return new Set((await anchors()).filter(a => a.family === NEGATIVE || a.family === CONTRAST_GOOD || a.family === CONTRAST_BAD).map(a => a.label)); }
/** 같은 물건의 변형(거울·눌림·얇게·색조·다른 묶음 사본)을 한 이름으로(빌더 base_name 과 같다). */
export function baseName(label: string): string {
  return (label.split('/')[1] ?? '').replace(/^(holdout|interior|murim|fresh2?|style)__/, '').replace(/^(mir|flat|thin|hue|real|realbad)_/, '').replace(/^(int|v5l|jp|beodeul|synthetic)__/, '');
}
export async function negativeLabels(): Promise<Set<string>> { return new Set((await anchors()).filter(a => a.family === NEGATIVE).map(a => a.label)); }
let anchorCache: Anchor[] | null = null;
export async function anchors(): Promise<Anchor[]> {
  if (anchorCache) return anchorCache;
  const root = resolve(GATE_DATA, 'calibration'), file = resolve(root, 'originals.json');
  const out: Anchor[] = [];
  if (existsSync(file)) {
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as { groups: Record<string, string[]>; negatives?: Record<string, string[]>; contrast?: Array<{ pattern: string; kind: ObjectGateKind; good: string; bad: string | null; note: string }> };
    const groups: Record<string, string[]> = { ...parsed.groups };
    for (const labels of Object.values(parsed.negatives ?? {})) for (const l of labels) (groups[NEGATIVE] ??= []).push(l);
    const kindOf = new Map<string, ObjectGateKind>();
    for (const set of readdirSync(root)) {
      const items = resolve(root, set, 'items.json');
      if (existsSync(items)) for (const it of JSON.parse(readFileSync(items, 'utf8')) as Array<{ name: string; kind: ObjectGateKind }>) kindOf.set(`${set}/${it.name}`, it.kind);
      const labelsFile = resolve(root, set, 'labels.json');
      if (existsSync(labelsFile)) for (const [name, kind] of Object.entries((JSON.parse(readFileSync(labelsFile, 'utf8')) as { kinds: Record<string, ObjectGateKind> }).kinds)) kindOf.set(`${set}/${name}`, kind);
    }
    for (const [family, labels] of Object.entries(groups)) for (const label of labels) {
      const png = resolve(root, `${label}.png`), kind = kindOf.get(label);
      if (!kind || !existsSync(png)) continue;
      const { width, height, data } = readPng(png);
      out.push({ label, png, kind, family, sha: await objectGatePixelSha256(width, height, data), img: { width, height, data } });
    }
    // 대조 쌍(v9): 종류는 쌍이 정한다.
    for (const c of parsed.contrast ?? []) for (const [side, label] of [[CONTRAST_GOOD, c.good], [CONTRAST_BAD, c.bad]] as const) {
      if (!label) continue;
      const png = resolve(root, `${label}.png`);
      if (!existsSync(png)) continue;
      const { width, height, data } = readPng(png);
      out.push({ label, png, kind: c.kind, family: side, sha: await objectGatePixelSha256(width, height, data), img: { width, height, data }, note: c.note, pattern: c.pattern });
    }
  }
  return (anchorCache = out.sort((a, b) => a.sha.localeCompare(b.sha)));
}
const KIND_NEAR: Partial<Record<ObjectGateKind, ObjectGateKind[]>> = { other: ['low_furniture', 'box', 'container'], frame: ['tall_furniture', 'low_furniture'], column: ['other', 'container'], figure: ['other', 'container'], front_prop: ['tall_furniture', 'other'], organic: ['container'], terrain: ['flat'], debris: ['flat'], wall_mounted: ['tall_furniture'], wall_structure: ['tall_furniture', 'frame'] };
/** 종류마다 기준 원본 3장 + 틀린 예 1장: 같은 종류(없으면 가까운 종류), 이 호출의 후보와 같은 그림은 뺀다, 칩셋을 섞어 고른다. 표마다 씨앗이 달라 다른 기준을 본다(규칙 v7). */
function pickAnchors(all: Anchor[], kind: ObjectGateKind, exclude: Set<string>, seed: number, family?: string): Anchor[] {
  let s = seed >>> 0 || 1; const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const shuffle = <T,>(xs: T[]) => xs.map(x => [rnd(), x] as const).sort((a, b) => a[0] - b[0]).map(x => x[1]);
  const picked: Anchor[] = [];
  const sameFam = (a: Anchor) => !!family && ANCHOR_FAMILY[a.family] === family;
  // 같은 칩셋 원본 먼저(같은 종류 → 가까운 종류), 모자라면 다른 칩셋(시점 기준으로만).
  for (const same of [true, false]) for (const k of [kind, ...(KIND_NEAR[kind] ?? [])]) {
    if (picked.length >= 3) break;
    const pool = shuffle(all.filter(a => !SPECIAL.has(a.family) && a.kind === k && !exclude.has(a.sha) && sameFam(a) === same && !picked.some(p => p.sha === a.sha)));
    const byFamily = new Map<string, Anchor[]>();
    for (const a of pool) (byFamily.get(a.family) ?? byFamily.set(a.family, []).get(a.family)!).push(a);
    const fams = shuffle([...byFamily.values()]);
    for (let i = 0; picked.length < 3 && i < 4; i++) for (const list of fams) if (list[i] && picked.length < 3) picked.push({ ...list[i]!, same });
    if (!same && picked.length) break;
  }
  const negs = all.filter(a => a.family === NEGATIVE && a.kind === kind && !exclude.has(a.sha));
  if (negs.length) picked.push(shuffle(negs)[0]!);
  // 대조 쌍(같은 종류, 순서 고정): 초록 = 맞음, 빨강 = 틀림.
  for (const a of all) if ((a.family === CONTRAST_GOOD || a.family === CONTRAST_BAD) && a.kind === kind && !exclude.has(a.sha)) picked.push(a);
  return picked;
}
export function anchorBoard(rows: Anchor[][]): Buffer {
  const pad = 10, gap = 16, cap = 260;
  const sc = (img: Img) => Math.max(2, Math.min(6, Math.floor(cap / Math.max(img.width, img.height))));
  const dims = rows.map(list => list.reduce((d, a) => ({ w: d.w + a.img.width + pad + a.img.width * sc(a.img) + gap, h: Math.max(d.h, a.img.height * sc(a.img)) }), { w: pad, h: 20 }));
  const W = Math.max(200, ...dims.map(d => d.w)), H = dims.reduce((s2, d) => s2 + d.h + pad * 2, pad);
  const c = new Canvas(W, H, [64, 66, 76]);
  let y = pad;
  rows.forEach((list, r) => {
    let x = pad;
    for (const a of list) {
      const k = sc(a.img), x0 = x;
      c.blit(a.img, x, y + dims[r]!.h - a.img.height, 1, false); x += a.img.width + pad; c.blit(a.img, x, y + dims[r]!.h - a.img.height * k, k, false); x += a.img.width * k;
      const frame = a.family === NEGATIVE || a.family === CONTRAST_BAD ? [230, 40, 40] : a.family === CONTRAST_GOOD ? [40, 210, 80] : null;
      if (frame) for (let t = 0; t < 3; t++) { // 빨강 = 틀린 예, 초록 = 대조 쌍의 맞는 예
        const x1 = x0 - 4 - t, x2 = x + 3 + t, y1 = y - 4 - t, y2 = y + dims[r]!.h + 3 + t;
        for (let xx = x1; xx <= x2; xx++) { c.put(xx, y1, frame[0]!, frame[1]!, frame[2]!); c.put(xx, y2, frame[0]!, frame[1]!, frame[2]!); }
        for (let yy = y1; yy <= y2; yy++) { c.put(x1, yy, frame[0]!, frame[1]!, frame[2]!); c.put(x2, yy, frame[0]!, frame[1]!, frame[2]!); }
      }
      x += gap;
    }
    y += dims[r]!.h + pad * 2;
  });
  return c.buf();
}

// ---------- 프로필 ----------
const fileHash = (p: string) => (existsSync(p) ? createHash('sha256').update(readFileSync(p)).digest('hex').slice(0, 16) : null);
export function finalProfile() {
  const manifest = resolve(GATE_DATA, 'style-refs', 'manifest.json');
  return { version: FINAL_RULES_VERSION, judge: FINAL_JUDGE, system: FINAL_SYSTEM, batch: FINAL_BATCH, votes: FINAL_VOTES, maxSide: MAX_SIDE,
    guide: fileHash(resolve(GATE_DATA, 'view34-guide.png')), pairs: fileHash(resolve(GATE_DATA, 'view34-pairs.png')), originals: fileHash(resolve(GATE_DATA, 'calibration', 'originals.json')), audit: fileHash(resolve(GATE_DATA, 'calibration', 'audit-2026-10-21.json')), board: 'v5-same-chipset-anchors-negative-contrast-pairs', aggregate: 'majority' };
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

export type FinalItem = { png: string; kind: ObjectGateKind; styleKind?: ObjectGateStyleKind; name: string; label?: string; family?: string };
/** 화풍 계열(칩셋). 라벨 앞머리·이름에서 정한다. 화풍 기준은 같은 계열의 원본만 쓴다(v8 — jp 실내를 버들항 기준으로 재지 않게). */
export function styleFamilyOf(label?: string): string | undefined {
  if (!label) return undefined;
  const [a = '', b = ''] = label.split('/'), low = label.toLowerCase();
  if (low.includes('jp_city_interior')) return 'jp_city_interior';
  if (low.includes('modern_city_interior')) return 'modern_city_interior';
  if (a === 'originals-jp' || a === 'jp' || a === 'jp_city') return 'jp_city';
  if (['originals-interior', 'uncertain-interior', 'interior', 'holdout', 'pairs', 'originals-v5large', 'atlas_biome_interior', 'v5-props34'].includes(a) || low.includes('atlas_biome_interior')) return 'hand_interior';
  if (a === 'fresh3' || a.startsWith('beodeul')) return 'beodeul_city';
  if (a === 'style') { const t = b.split('__')[0]!; return t === 'beodeul' ? 'beodeul_city' : t; }
  const m = b.match(/^[a-z]+\d+_(.+)$/);
  if (m) { const t = m[1]!; return t === 'interior' ? 'hand_interior' : t.startsWith('beodeul') || t.startsWith('g4_beodeul') ? 'beodeul_city' : t; }
  if (a === 'seats34') return b;
  return a.replace(/-/g, '_');
}
const ANCHOR_FAMILY: Record<string, string> = { beodeul_city: 'beodeul_city', jp_city: 'jp_city', atlas_biome_interior: 'hand_interior', 'oprn-interior-v5-large': 'hand_interior' };
type Prepared = FinalItem & { img: Img; sha: string; styleKind: ObjectGateStyleKind };
type Answer = { votes?: string[]; id: number; kind_ok: boolean; closest_kind?: string | null; view34: string; style: string; sure: boolean; charges: number[]; reasons: string[]; verdict: string; top_rows?: number; front_rows?: number; facing?: string };

const CACHE = resolve(process.env.OPUS_GATE_CACHE ?? resolve(homedir(), '.cache', 'opus-gate'), 'answers');
const cachePath = (profile: string, p: Prepared, vote: number) => resolve(CACHE, profile, `${p.sha.slice(0, 24)}-${p.kind}-${p.styleKind}-v${vote}.json`);

/** 한 호출 = 같은 화풍 종류 묶음 최대 FINAL_BATCH 장. 답이 모자라거나 틀리면 그 호출을 다시(3번까지). */
async function judgeCall(batch: Prepared[], profile: string, vote: number): Promise<Map<Prepared, Answer | { error: string }>> {
  const kinds = [...new Set(batch.map(p => p.kind))], family = batch[0]!.family;
  const all = await anchors(), exclude = new Set(batch.map(p => p.sha));
  const callSeed = [...batch.map(p => p.sha)].sort()[0]!.slice(0, 8);
  const rows = kinds.map((k, i) => pickAnchors(all, k, exclude, parseInt(callSeed, 16) ^ (vote * 2654435761) ^ (i * 40503), family));
  const guide = readFileSync(resolve(GATE_DATA, 'view34-guide.png')), pairs = readFileSync(resolve(GATE_DATA, 'view34-pairs.png'));
  const images = [guide, pairs, anchorBoard(rows), ...batch.map((p, i) => candidateBoard(p.img, i + 1))];
  if (process.env.FINAL_DUMP_DIR) { mkdirSync(process.env.FINAL_DUMP_DIR, { recursive: true }); writeFileSync(resolve(process.env.FINAL_DUMP_DIR, `anchors-v${vote}-${batch[0]!.sha.slice(0, 8)}.png`), images[2]!); }
  const lines = batch.map((p, i) => `#${i + 1}: declared kind "${p.kind}" — ${OBJECT_GATE_KINDS[p.kind].meaning}. Style kind "${p.styleKind}" (${OBJECT_GATE_STYLE_KINDS[p.styleKind]}). Name: ${p.name}. Size ${p.img.width}x${p.img.height} source pixels (shown at 1x and ${scaleFor(p.img)}x).`);
  const anchorText = kinds.map((k, i) => `row ${i + 1}: kind ${k} — ${rows[i]!.length ? rows[i]!.map(a => a.family === NEGATIVE ? `RED = known violation ${a.label.split('/').pop()}` : a.family === CONTRAST_GOOD ? `GREEN = contrast RIGHT (${a.pattern}): ${a.note}` : a.family === CONTRAST_BAD ? `RED = contrast WRONG (${a.pattern})` : `${a.same ? 'SAME CHIPSET' : 'OTHER CHIPSET (view only)'} ${a.family} ${a.label.split('/').pop()}${a.kind !== k ? ` (kind ${a.kind})` : ''}`).join('; ') : 'no anchor of this kind'}`).join('\n');
  const famText = `Candidates' chipset: ${family ?? 'unknown'}${rows.flat().some(a => a.same) ? '' : ' — no SAME CHIPSET anchor: style may fail only under 8c or 8d'}.\n`;
  const text = famText + `Image 3 anchors (accepted originals, one row per kind; red-framed = known violation, green-framed = the right half of a contrast pair, its red partner follows):\n${anchorText}\nCandidates (images 4..${3 + batch.length}):\n${lines.join('\n')}\nProsecute each candidate. Reply only the JSON array with ${batch.length} objects.`;
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
  // 종류 정정(v8): 판정자가 가장 가까운 올바른 종류를 대고 그 종류로 1~6 을 판정했으면 라벨만으로는 떨어뜨리지 않는다. front_prop 으로의 정정은 받지 않는다(사람만).
  // v9: 면제 종류로의 정정은 받지 않는다(면제로 옮겨 위반이 통과하던 v8 결함).
  const corrected = a.kind_ok !== true && typeof a.closest_kind === 'string' && a.closest_kind in OBJECT_GATE_KINDS && !OBJECT_GATE_KINDS[a.closest_kind as ObjectGateKind].exempt;
  const kindOk = a.kind_ok === true || corrected, sure = a.sure === true, charges = Array.isArray(a.charges) ? a.charges : [];
  const pass = a.verdict === 'pass' && view34 === 'pass' && style === 'pass' && kindOk && sure && charges.length === 0;
  const reasons = (Array.isArray(a.reasons) ? a.reasons.map(String) : []).filter(Boolean);
  if (corrected) reasons.unshift(`종류 정정: ${a.closest_kind} 로 판정`);
  if (!pass && !reasons.length) reasons.push(!kindOk ? '종류가 맞지 않음' : !sure ? '판정자가 확신하지 못함(애매하면 불합격)' : `3/4 ${view34} · 화풍 ${style}`);
  if (!pass && !sure && !reasons.some(r => /unsure|확신/.test(r))) reasons.push('판정자가 확신하지 못함(애매하면 불합격)');
  return { verdict: pass ? 'pass' : 'fail', view34, style, kindOk, sure, reasons: pass ? reasons.filter(r => r.startsWith('종류 정정')) : reasons };
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
    for (const p of order) { const g = `${p.kind}|${p.family ?? ''}`; (groups.get(g) ?? groups.set(g, []).get(g)!).push(p); }
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
    // 과반: 같은 판정이 2표 모이면 끝(3표 중 2표).
    alive = alive.filter(p => { if (errors.has(p) || votes.get(p)!.length !== vote) return false; const v = votes.get(p)!.map(a => decideFinal(a).verdict); return Math.max(v.filter(x => x === 'pass').length, v.filter(x => x === 'fail').length) < Math.ceil((FINAL_VOTES + 1) / 2); });
  }
  const results = new Map<Prepared, Answer | { error: string }>();
  for (const p of prepared) {
    const list = votes.get(p)!;
    const need = Math.ceil((FINAL_VOTES + 1) / 2), v = list.map(a => decideFinal(a).verdict);
    const win = v.filter(x => x === 'fail').length >= need ? 'fail' : v.filter(x => x === 'pass').length >= need ? 'pass' : null;
    if (!win) { results.set(p, { error: errors.get(p) ?? `표 ${list.length}/${FINAL_VOTES} — 과반 없음` }); continue; }
    // 과반 쪽의 답을 기록한다(통과면 통과 답, 불합격이면 처음 불합격 답의 이유).
    results.set(p, { ...list.find(a => decideFinal(a).verdict === win)!, votes: v });
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
  const items: FinalItem[] = (batchFile
    ? readFileSync(batchFile, 'utf8').split('\n').filter(l => l.trim()).map(l => { const o = JSON.parse(l); return { ...o, png: resolve(dirname(batchFile), o.png) }; })
    : [{ png: resolve(option('png') ?? ''), kind: option('kind') as ObjectGateKind, styleKind: option('style-kind') as ObjectGateStyleKind | undefined, name: option('name') ?? 'object', label: option('label'), family: option('family') }])
    .map(it => ({ ...it, family: it.family ?? styleFamilyOf(it.label) }));
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
  type Cal = FinalItem & { truth: 'bad' | 'good'; half: 'view34' | 'style'; set: string; tier: Tier; weak?: boolean; uncertain?: boolean };
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
        cal.push({ png: resolve(root, set, `${name}.png`), kind: labels.kinds[name]!, name: name.replace(/^props?[._]/, '').replace(/__.*$/, '').replace(/_/g, ' '), label, truth, half: 'view34', set, tier: tierMap[label]?.tier ?? 'A', family: styleFamilyOf(label) });
      }
    } else {
      for (const it of JSON.parse(readFileSync(itemsPath, 'utf8')) as Array<{ name: string; kind: ObjectGateKind; styleKind: ObjectGateStyleKind; view34: 'good' | 'bad' | null; style: 'good' | 'bad' | null; weak?: boolean; tier?: Tier; group?: string }>) {
        const label = `${set}/${it.name}`, base = { png: resolve(root, set, `${it.name}.png`), kind: it.kind, styleKind: it.styleKind, name: it.name.replace(/__.*$/, '').replace(/[_-]/g, ' '), label, set, tier: tierMap[label]?.tier ?? it.tier ?? 'A' as Tier, weak: it.weak, family: styleFamilyOf(label) };
        // 불확실(10-01 전수조사가 표시했거나 조사에 없던 실내 원본): 판정만 받고 (a)·(b) 어디에도 세지 않는다(보고만).
        if (it.group?.startsWith('uncertain')) cal.push({ ...base, truth: 'good', half: 'view34', uncertain: true });
        else if (it.view34) cal.push({ ...base, truth: it.view34, half: 'view34' });
        else if (it.style) cal.push({ ...base, truth: it.style, half: 'style' });
      }
    }
  }
  // 판정자에게 보이는 그림(틀린 예·대조 쌍)과 같은 물건(이름 변형·같은 화소)은 판정하지 않는다((a)·(b) 에서 뺀다 — 누설 방지).
  const shown = await shownLabels(), shownBases = new Set([...shown].map(baseName)), shownShas = new Set((await anchors()).filter(a => SPECIAL.has(a.family)).map(a => a.sha));
  const excludedNegatives: string[] = [];
  const keep: Cal[] = [];
  for (const c of cal) {
    const { width, height, data } = readPng(c.png);
    const sha = await objectGatePixelSha256(width, height, data);
    if (shown.has(c.label!) || shownBases.has(baseName(c.label!)) || shownShas.has(sha)) excludedNegatives.push(c.label!); else keep.push(c);
  }
  cal.splice(0, cal.length, ...keep);
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
  const uncertain: Array<{ label: string; verdict: string; reasons: string[] }> = [];
  // 칩셋 계열(보고용): 위반·원본을 계열별로 따로 센다 — 섞은 숫자는 판정자가 어디서 약한지 숨긴다(감독 지시 2026-10-21).
  const familyOf = (label: string) => { const set = label.split('/')[0]!; return ['murim', 'adv-front-prop', 'originals-v5large'].includes(set) ? set : styleFamilyOf(label) ?? set; };
  const fam: Record<string, { bad: number; caught: number; good: number; passed: number }> = {};
  for (const c of shuffled) {
    const a = bySrc.get(`${c.label}|${c.kind}`);
    if (c.uncertain) { uncertain.push({ label: c.label!, verdict: isErr(a) ? 'error' : decideFinal(a).verdict, reasons: isErr(a) ? [] : decideFinal(a).reasons }); continue; }
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
    const fm = (fam[familyOf(c.label!)] ??= { bad: 0, caught: 0, good: 0, passed: 0 });
    if (c.truth === 'bad') { fm.bad++; if (d.verdict !== 'pass') fm.caught++; } else { fm.good++; if (d.verdict === 'pass') fm.passed++; }
    const s = (sets[c.set] ??= { bad: { total: 0, caught: 0 }, good: { total: 0, passed: 0 } });
    if (c.truth === 'bad') { bad++; s.bad.total++; if (pass) missed.push(c.label!); else s.bad.caught++; }
    else { good++; s.good.total++; if (pass) s.good.passed++; else falseFail.push(c.label!); }
  }
  console.log(lines.sort().join('\n'));
  const goodRate = good ? (good - falseFail.length) / good : 0;
  const full = !limit && !onlySets;
  // 효력 조건 = 사용자 기준(2026-10-21): 확실 위반을 하나도 놓치지 않는다. 정상 통과율은 보고만 한다(v1~v4 에 두었던 자체 하한 50% 는 사용자 기준이 아니라 뺐다 —
  // v4 는 위반 217/217 을 잡았고 정상 통과는 라벨 반쪽 45.8%·전체 7.5% 였다. 같은 지시문의 답 캐시로 다시 셌다).
  // 조건 (b)(2026-10-21 감독 지시): 칩셋의 받아들여진 원본(originals.json)을 전체 판정으로 90% 이상 통과. 원본은 판정자에게 기준으로도 보이지만 자기 자신은 빠진다.
  const origGroups = existsSync(resolve(root, 'originals.json')) ? (JSON.parse(readFileSync(resolve(root, 'originals.json'), 'utf8')) as { groups: Record<string, string[]> }).groups : {};
  const originals: Record<string, { total: number; passed: number; failed: string[] }> = {};
  for (const [g, labels] of Object.entries(origGroups)) {
    const o = (originals[g] = { total: 0, passed: 0, failed: [] as string[] });
    for (const label of labels) {
      const c = shuffled.find(x => x.label === label); if (!c) continue;
      const a = bySrc.get(`${c.label}|${c.kind}`); o.total++;
      if (!isErr(a) && decideFinal(a).verdict === 'pass') o.passed++; else o.failed.push(label);
    }
  }
  const oT = Object.values(originals).reduce((s2, o) => s2 + o.total, 0), oP = Object.values(originals).reduce((s2, o) => s2 + o.passed, 0);
  const ORIGINALS_MIN = 0.9;
  const ok = missed.length === 0 && errors.length === 0 && oT > 0 && oP / oT >= ORIGINALS_MIN;
  const record: ObjectGateFinalProfileRecord = { schema: 'oprn-object-gate-final-profile/1', profileHash: hash, status: ok && full ? 'calibrated' : 'rejected', calibratedAt: new Date().toISOString(), judge: FINAL_JUDGE,
    bad: { total: bad, caught: bad - missed.length, missed }, good: { total: good, passed: good - falseFail.length, falseFail }, sets, tiers, errors, originals, families: fam, uncertain, excludedNegatives,
    note: `조건 (a) 위반 = 등급 A 3/4 위반(적대 시험 adv-*·object-gen 반려 포함) + 강한 라벨 화풍 얕음, 전체 판정으로 하나도 놓치면 안 된다. 조건 (b) 칩셋 원본 전체 판정 통과 ${oP}/${oT} ≥ ${ORIGINALS_MIN * 100}%. 정상 = 라벨 반쪽으로 센다(보고만). 전체 판정 정상 통과 ${overallPass}/${overallGood}. ${full ? '전체 표본' : '부분 표본 — 효력 없음'}` };
  if (full) writeFinalProfile(record);
  writeFileSync(resolve(root, `final-run-${hash}.json`), `${JSON.stringify({ ...record, lines: lines.sort() }, null, 1)}\n`);
  console.log(`\n== 최종 보정 ${hash}: ${record.status}`);
  console.log(`   위반 잡음 ${bad - missed.length}/${bad}${missed.length ? ` — 놓침: ${missed.join(', ')}` : ''}`);
  console.log(`   정상 통과(라벨 반쪽) ${good - falseFail.length}/${good} (${(goodRate * 100).toFixed(1)}%) · 전체 판정 통과 ${overallPass}/${overallGood} (${overallGood ? (overallPass / overallGood * 100).toFixed(1) : 0}%)`);
  console.log(`   (b) 칩셋 원본 전체 판정 통과 ${oP}/${oT} (${oT ? (oP / oT * 100).toFixed(1) : 0}%) — 기준 90%`);
  for (const [g, o] of Object.entries(originals)) console.log(`       ${g.padEnd(24)} ${o.passed}/${o.total}${o.failed.length ? ` — 떨어짐: ${o.failed.slice(0, 12).join(', ')}${o.failed.length > 12 ? ' …' : ''}` : ''}`);
  console.log(`   틀린 예·대조 쌍과 같은 물건 ${excludedNegatives.length}장은 판정·집계에서 뺐다: ${excludedNegatives.join(', ')}`);
  console.log('   계열별 — (a) 위반 잡음 · 정상 전체 판정 통과');
  for (const [k, v] of Object.entries(fam).sort()) console.log(`       ${k.padEnd(24)} (a) ${v.caught}/${v.bad} · 정상 ${v.passed}/${v.good}`);
  if (uncertain.length) console.log(`   불확실(보고만) ${uncertain.length}장: 통과 ${uncertain.filter(u => u.verdict === 'pass').length} · ${uncertain.map(u => `${u.label.split('/')[1]}=${u.verdict}`).join(', ')}`);
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
    items.push({ png: src, kind: x.kind, styleKind: styleKind ?? undefined, name: x.name ?? x.label.split('/').pop()!, label: x.label, batch: x._batch, sha: x.sha, source: src, family: styleFamilyOf(x.label) });
  }
  console.error(`대기열 ${all.length} · 판정할 그림 ${items.length} · 그림 없음 ${noImage.length}`);
  // 다시 그리기 목록이 그림을 찾아가게: 표식 앞머리 → 타일셋 id → 번들 시트·칸 크기, 시트 칸 해시 색인(처음 쓸 때 만든다).
  const PREFIX_TILESET: Record<string, string> = { jp: 'jp_city', 'modern-campus-int': 'modern_campus', modern_city_interior: 'modern_city', beodeul_farm: 'beodeul_city', beodeul_ground: 'beodeul_city' };
  const tilesets = new Map<string, { textureKey: string; tileSize: number }>();
  for (const f of readdirSync(resolve('src/assets')).filter(f => f.endsWith('Tileset.json'))) {
    try { const t = JSON.parse(readFileSync(resolve('src/assets', f), 'utf8')) as { id?: string; textureKey?: string; tileSize?: number }; if (t.id && t.textureKey) tilesets.set(t.id, { textureKey: t.textureKey, tileSize: t.tileSize ?? 16 }); } catch { /* 타일셋이 아닌 JSON */ }
  }
  const sheetOf = new Map<string, string>();
  if (existsSync(resolve('src/assets/bundled.ts'))) for (const m of readFileSync(resolve('src/assets/bundled.ts'), 'utf8').matchAll(/textureKey:"([^"]+)",path:"([^"]+)"/g)) sheetOf.set(m[1]!, resolve('public', m[2]!));
  const cellIndex = new Map<string, Map<string, number[]> | null>();
  const locate = (label: string, cells?: Record<string, string[]>) => {
    const prefix = label.split('/')[0] ?? '';
    const id = PREFIX_TILESET[prefix] ?? prefix.replace(/-/g, '_');
    const ts = tilesets.get(id);
    const sheet = ts ? sheetOf.get(ts.textureKey) : undefined;
    if (!ts || !sheet || !existsSync(sheet)) return { tileset: ts ? id : null, sheet: null, tileSize: ts?.tileSize ?? null, cells: [] as number[] };
    if (!cellIndex.has(id)) {
      const img = readPng(sheet), idx = new Map<string, number[]>();
      for (const c of sheetCells(img.width, img.height, img.data, ts.tileSize)) (idx.get(c.hash) ?? idx.set(c.hash, []).get(c.hash)!).push(c.index);
      cellIndex.set(id, idx);
    }
    const idx = cellIndex.get(id)!, hit = new Set<number>();
    for (const h of cells?.[String(ts.tileSize)] ?? []) for (const i of idx?.get(h) ?? []) hit.add(i);
    return { tileset: id, sheet: sheet.replace(`${process.cwd()}/`, ''), tileSize: ts.tileSize, cells: [...hit].sort((a, b) => a - b).slice(0, 400) };
  };
  const write = () => {
    const recs = new Map(listFinals().filter(f => f.profileHash === hash).map(f => [`${f.pixelSha256}|${f.kind}`, f]));
    const per: Record<string, { total: number; judged: number; pass: number; fail: number; noImage: number }> = {};
    const fails: unknown[] = [];
    for (const x of all) {
      const b = (per[x._batch] ??= { total: 0, judged: 0, pass: 0, fail: 0, noImage: 0 }); b.total++;
      const f = recs.get(`${x.sha}|${x.kind}`);
      if (!f) { if (noImage.includes(x)) b.noImage++; continue; }
      b.judged++; if (f.verdict === 'pass') b.pass++; else { b.fail++; const at = locate(x.label, f.cells); fails.push({ sha: x.sha, batch: x._batch, label: x.label, kind: x.kind, styleKind: f.styleKind, reasons: f.reasons, view34: f.view34, style: f.style, source: items.find(i => i.sha === x.sha)?.source ?? null, heldImage: heldPath(x.sha), tileset: at.tileset, sheet: at.sheet, tileSize: at.tileSize, sheetCells: at.cells, profile: f.profileHash }); }
    }
    if (option('fails')) { mkdirSync(dirname(option('fails')!), { recursive: true }); writeFileSync(`${option('fails')!}.tmp`, `${JSON.stringify(fails, null, 1)}\n`); renameSync(`${option('fails')!}.tmp`, option('fails')!); }
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
