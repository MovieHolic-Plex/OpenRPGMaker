// src/harnesses/_core/workshop/objectGenFlow.ts
/**
 * object-gen 흐름(MovieHolic-Plex/object-gen `objectgen/flow.py`)을 공방 대화 호출로 옮긴 것(2026-10-21).
 * 지시문·판정 문장·견본(anchors)은 고치지 않고 gen-kits 생성물(`genKits/object-gen.json`, lock 고정 커밋)에서 읽는다 — 원본이 바뀌면 lock 을 올리고 `npm run gen-kits:sync`.
 *
 * 원본 단계와 여기:
 *   ref    참고 그림 2장(시점 검사)          → engine.makeReference(referenceCount 2, STYLE_NOTE 덧붙임)
 *   draw   그리는 에이전트가 draw.py 를 쓰고 preview.png 를 보며 고친다
 *          → 같은 지시문(draw_brief)으로 그리고, 미리보기(참고·견본·8배/1배/2배 + 기계 검사)를 돌려 보여 주며 최대 LOOKS 번 고친다
 *   review 블라인드 적대 판정(JUDGE, GOOD/BAD 견본, 숨긴 반려 표본), 유효 3번 다수결, 반려 표본을 통과시킨 판은 무효
 *          → reviewVerdict(같은 문장·같은 표본 규칙·같은 다수결)
 *   redraw 불통과는 판정 이유를 주고 한 번 다시 → 시도 2번(maxAttempts)
 *   pick   고르기 3번 다수결(PROMPT, 견본 그림) → picker.ts
 * 다른 점(대화 호출이라): 그림판 글자 대신 그림 앞에 글 꼬리표를 붙인다. 후보마다 따로 그린다(원본은 한 에이전트가 A·B 를 함께).
 * 판정은 후보 한 장 + 숨긴 반려 표본으로 한다(원본은 그 판 후보 전부를 한 판에).
 */
import type { ChatMessage, ContentPart } from "@/ai/llmClient";
import { footprintClass, isOrganicObject } from "./footprint";
import { kitConstant, kitFile, objectGenKit } from "./genKits";
import { gridToAnswer, onBackground, renderGrid, scaleImage } from "./grid";
import type { DrawContext, Grid, Palette, PaletteEntry, Rgba, RgbaImage, ReviewContext, Verdict, WorkshopEnv, WorkshopItem } from "./types";

type KitSection = "prompts" | "reference" | "picker" | "vqa" | "drawer" | "exemplars" | "footprint" | "checks";
type AnchorSet = { examples?: { file: string; label: string }[]; good: { file: string; label: string; why?: string }[]; bad: { file: string; label: string; why?: string }[]; rejects?: { file: string }[] };

/**
 * 원본 상수 하나 — gen-kits 생성물(genKits/object-gen.json, tiledata/gen-kits.lock.json 의 고정 커밋에서 npm run gen-kits:sync 가 뽑음)에서 읽는다.
 * 손으로 옮긴 사본(objectGenKit.json)은 2026-10-22 에 지웠다: lock 을 올리면 다음 빌드부터 공방 지시문·판정 기준이 그 커밋 것이 된다.
 * 없으면 던진다(원본이 이름을 바꿨는데 옛 글로 조용히 도는 일을 막는다).
 */
export function kitValue<T = string>(section: KitSection, name: string): T {
  return kitConstant<T>(objectGenKit, section, name);
}
/** 지금 공방이 따르는 object-gen 커밋(lock) */
export const OBJECTGEN_COMMIT = objectGenKit.commit;
const anchorSet = (set: string): AnchorSet | undefined => {
  try { return JSON.parse(kitFile(objectGenKit, `objectgen/anchors/${set}/set.json`)) as AnchorSet; } catch { return undefined; }
};
/** 원본 flow.DEFAULT_STYLE */
export const OG_STYLE = "oprn-interior-v5-large";
/**
 * 원본 flow.ORGANIC_STYLE — 자연물(나무·덤불·식물·꽃·더미·동물·바위)은 버들항 손 도트 나무(#3223·#3229)를 견본·GOOD 으로,
 * 도형으로 그린 사과나무를 BAD 로, 도형 반려 표본을 숨겨 판정한다. 왜(2026-10-22 사용자): 2×3 사과나무가 달걀 수관·네모 줄기·
 * 격자 네모 사과로 나왔다 — 가구 지시문(윗면 3줄·받침)과 가구 견본(침대·옷장)으로 그렸고, 판정도 가구와 비교했다.
 */
export const OG_STYLE_ORGANIC = "oprn-beodeul-organic";
/** 자연물인가 — 3/4 관문 종류 organic 이거나 이름(크기 사전 종류·머리 낱말)이 자연물(object-gen footprint.is_organic). */
export const ogIsOrganic = (item: Pick<WorkshopItem, "title"> & { readonly gateKind?: string | null }): boolean => isOrganicObject(item.title, item.gateKind ?? null);
/** 그 물건을 그리고 판정할 견본 묶음 */
export const ogStyleSetFor = (item: Pick<WorkshopItem, "title"> & { readonly gateKind?: string | null }): string => (ogIsOrganic(item) ? OG_STYLE_ORGANIC : OG_STYLE);
export const OG_JUDGE_RUNS = 3;
export const OG_JUDGE_RETRIES = 2;
export const OG_PICK_RUNS = kitValue<number>("picker", "RUNS");
/** 그린 뒤 미리보기를 보고 고치는 횟수 상한(원본은 에이전트가 스스로 멈출 때까지 — 실측 2~4번) */
export const OG_LOOKS = 3;
const SCALE = kitValue<number>("vqa", "SCALE");
const LARGE_CELLS = kitValue<number>("prompts", "LARGE_CELLS");
const DIRECTIONS = kitValue<Record<string, string>>("prompts", "DIRECTIONS");
const ANCHOR_TEXT = kitValue<Record<string, string>>("prompts", "ANCHOR_TEXT");

/** 원본 방향 A·B(칩셋 충실 · 지시 충실) — 원본 flow 의 후보 수도 둘이다. */
export const OG_DIRECTIONS = ["A", "B"].map((letter) => ({ letter, text: DIRECTIONS[letter]! }));

// --- 견본(anchors) --------------------------------------------------------------------------------------------------

export type OgAnchor = { readonly label: string; readonly why: string; readonly image: RgbaImage };
export type OgAnchors = { readonly good: readonly OgAnchor[]; readonly bad: readonly OgAnchor[]; readonly rejects: readonly OgAnchor[]; readonly examples: readonly OgAnchor[] };
const anchorCache = new Map<string, Promise<OgAnchors>>();

/** 견본 그림은 public/assets/gen-kits/object-gen/anchors/<set>/ 에 있다(원본 objectgen/anchors/<set>/ 사본). */
export function loadAnchors(env: WorkshopEnv, set = OG_STYLE): Promise<OgAnchors> {
  let pending = anchorCache.get(set);
  if (!pending) {
    const meta = anchorSet(set);
    if (!meta) throw new Error(`object-gen@${OBJECTGEN_COMMIT.slice(0, 9)} 에 견본 묶음 ${set} 이 없다`);
    const load = (file: string) => env.loadImage(env.assetUrl(`assets/gen-kits/object-gen/anchors/${set}/${file}`));
    const many = (list: readonly { file: string; label?: string; why?: string }[]) =>
      Promise.all(list.map(async (entry) => ({ label: entry.label ?? entry.file, why: entry.why ?? "", image: await load(entry.file) })));
    pending = Promise.all([many(meta.good), many(meta.bad), many(meta.rejects ?? []), many(meta.examples ?? meta.good)])
      .then(([good, bad, rejects, examples]) => ({ good, bad, rejects, examples }));
    pending.catch(() => anchorCache.delete(set));
    anchorCache.set(set, pending);
  }
  return pending;
}

// --- 그림 도우미 -----------------------------------------------------------------------------------------------------

/** 가로로 잇는다(아래 맞춤, 사이 gap, 배경 bg). */
export function hstack(images: readonly RgbaImage[], gap: number, bg: Rgba): RgbaImage {
  const width = images.reduce((sum, image) => sum + image.width, 0) + gap * Math.max(0, images.length - 1);
  const height = Math.max(1, ...images.map((image) => image.height));
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) data.set(bg, i);
  let x0 = 0;
  for (const image of images) {
    const y0 = height - image.height;
    for (let y = 0; y < image.height; y++) {
      for (let x = 0; x < image.width; x++) {
        const from = (y * image.width + x) * 4;
        if (image.data[from + 3] === 0) continue;
        data.set(image.data.subarray(from, from + 4), ((y0 + y) * width + x0 + x) * 4);
      }
    }
    x0 += image.width + gap;
  }
  return { width, height, data };
}
const BOARD_BG: Rgba = [58, 52, 48, 255];
/** 원본 vqa._card: k배 + 1배를 바닥색 위에 나란히(글자는 메시지 꼬리표로). */
export function card(image: RgbaImage, floor: Rgba, k = SCALE): RgbaImage {
  const on = onBackground(image, floor);
  return hstack([scaleImage(on, k), on], 6, BOARD_BG);
}
/** 원본 reference.exemplar_sheet: 견본을 k배로 한 줄, 그 아래 1배(여기서는 k배 줄만 — 1배는 card 로 따로). */
export function exemplarSheet(anchors: OgAnchors, floor: Rgba, k = 6): RgbaImage {
  return hstack(anchors.examples.map((anchor) => scaleImage(onBackground(anchor.image, floor), k)), 12, [200, 200, 200, 255]);
}

// --- 참고 그림 견본(원본 reference.aspect_sheet) ------------------------------------------------------------------------
const ASPECT_PX = kitValue<Readonly<Record<"wide" | "tall" | "square", readonly [number, number]>>>("reference", "ASPECT_PX");
const REF_BG = kitValue<readonly [number, number, number]>("reference", "BACKGROUND");
export type RefAspect = "wide" | "tall" | "square";
/** 원본 aspect_of: 폭:키 ≥1.3 wide, ≤0.77 tall, 나머지 square. */
export function aspectOf(w: number, h: number): RefAspect {
  const r = w / Math.max(h, 1e-9);
  return r >= 1.3 ? "wide" : r <= 0.77 ? "tall" : "square";
}
function sheetLayout(images: readonly RgbaImage[], width: number, height: number, k: number, pad: number): [number, number][] | null {
  let x = pad, y = pad, row = 0;
  const spots: [number, number][] = [];
  for (const image of images) {
    const w = image.width * k, h = image.height * k;
    if (x + w > width - pad && x > pad) { x = pad; y += row + pad; row = 0; }
    if (x + w > width - pad || y + h > height - pad) return null;
    spots.push([x, y]);
    x += w + pad;
    row = Math.max(row, h);
  }
  return spots;
}
/**
 * 원본 aspect_sheet: 견본 그림(1배)을 물체 비율(ASPECT_PX) 캔버스에 들어가는 만큼 크게(kMax→1), 각각 바닥색 위에.
 * 그림 경로는 붙인 그림의 비율로 답한다 — 옛 한 줄 띠(약 4.6:1)를 붙이면 짐마차가 평면도, 노점이 정면으로 나왔다(2026-10-22 A/B).
 * 안 들어가는 그림은 뒤에서부터 뺀다.
 */
export function aspectSheet(images: readonly RgbaImage[], aspect: RefAspect, floor: Rgba, kMax = 8): RgbaImage | null {
  const [width, height] = ASPECT_PX[aspect];
  const pad = 24;
  for (let use = images.length; use > 0; use--) {
    const list = images.slice(0, use);
    for (let k = kMax; k >= 1; k--) {
      const spots = sheetLayout(list, width, height, k, pad);
      if (!spots) continue;
      const data = new Uint8ClampedArray(width * height * 4);
      for (let i = 0; i < data.length; i += 4) data.set([REF_BG[0], REF_BG[1], REF_BG[2], 255], i);
      list.forEach((image, n) => {
        const big = scaleImage(onBackground(image, floor), k);
        const [ox, oy] = spots[n]!;
        for (let y = 0; y < big.height; y++) data.set(big.data.subarray(y * big.width * 4, (y + 1) * big.width * 4), ((oy + y) * width + ox) * 4);
      });
      return { width, height, data };
    }
  }
  return null;
}

const fit = (image: RgbaImage, width: number, height: number): RgbaImage => {
  // 원본 _fit: 더 크면 최근접으로 줄이고, 바닥에 맞춰 가운데.
  let source = image;
  if (image.width > width || image.height > height) {
    const scale = Math.min(width / image.width, height / image.height);
    const w = Math.max(1, Math.floor(image.width * scale)), h = Math.max(1, Math.floor(image.height * scale));
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const from = (Math.floor(y / scale) * image.width + Math.floor(x / scale)) * 4;
      data.set(image.data.subarray(from, from + 4), (y * w + x) * 4);
    }
    source = { width: w, height: h, data };
  }
  const data = new Uint8ClampedArray(width * height * 4);
  const ox = Math.floor((width - source.width) / 2), oy = height - source.height;
  for (let y = 0; y < source.height; y++) for (let x = 0; x < source.width; x++) {
    const from = (y * source.width + x) * 4;
    data.set(source.data.subarray(from, from + 4), ((oy + y) * width + ox + x) * 4);
  }
  return { width, height, data };
};

// --- 팔레트 단(원본 palette.ramps_of / summary_ramps) ---------------------------------------------------------------

const luma = (c: readonly number[]) => 0.299 * c[0]! + 0.587 * c[1]! + 0.114 * c[2]!;
const hex = (c: Rgba) => `#${[c[0], c[1], c[2]].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
function hls([r, g, b]: Rgba): [number, number, number] {
  const R = r / 255, G = g / 255, B = b / 255;
  const max = Math.max(R, G, B), min = Math.min(R, G, B), l = (max + min) / 2;
  if (max === min) return [0, l, 0];
  const d = max - min;
  const s = l <= 0.5 ? d / (max + min) : d / (2 - max - min);
  let h = max === R ? (G - B) / d : max === G ? 2 + (B - R) / d : 4 + (R - G) / d;
  h = ((h / 6) % 1 + 1) % 1;
  return [h, l, s];
}
export function rampSummary(palette: Palette): string {
  const groups = new Map<string, { key: string; rgba: Rgba }[]>();
  for (const entry of palette.entries) {
    const [h, l, s] = hls(entry.rgba);
    const name = s < 0.18 || l < 0.06 ? "grey" : `h${String(Math.floor(h * 12) * 30).padStart(3, "0")}`;
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name)!.push(entry);
  }
  return [...groups].map(([name, list]) => `${name}: ${[...list].sort((a, b) => luma(a.rgba) - luma(b.rgba)).map((e) => `${e.key} ${hex(e.rgba)}`).join(" . ")}`).join("\n");
}

// --- 기계 검사(원본 checks.check 중 대화 고치기에 필요한 것) -------------------------------------------------------

export type OgIssue = { readonly code: string; readonly msg: string };
export type OgCheck = { readonly ok: boolean; readonly hard: readonly OgIssue[]; readonly warn: readonly OgIssue[]; readonly topRows: number };
const STANDING = new Set(["floor", "wall", "outdoor", "tabletop"]);
const TOP_KINDS = new Set(["tall_furniture", "low_furniture", "box", "container", "seat"]);
export const ogAnchorOf = (item: WorkshopItem): string => (item.kind === "hang" || item.kind === "flat" ? item.kind : item.kind === "wall" ? "wall" : "floor");

/** 원본 checks.topplane: 25/50/75% 세로줄을 위에서 훑어 밝은 윗면 줄 수(중앙값). 판정이 아니라 측정. */
export function topPlaneRows(image: RgbaImage): number {
  const op = (x: number, y: number) => image.data[(y * image.width + x) * 4 + 3]! > 0;
  const lum = (x: number, y: number) => { const i = (y * image.width + x) * 4; return luma([image.data[i]!, image.data[i + 1]!, image.data[i + 2]!]); };
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) if (op(x, y)) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + 1); y1 = Math.max(y1, y + 1); }
  if (x1 < 0) return 0;
  const rows: number[] = [];
  for (const f of [0.25, 0.5, 0.75]) {
    const x = x0 + Math.floor((x1 - x0 - 1) * f);
    let y = y0;
    while (y < y1 && !op(x, y)) y++;
    if (y >= y1) continue;
    while (y < y1 && op(x, y) && lum(x, y) < 46) y++;
    if (y >= y1 || !op(x, y)) continue;
    let top = lum(x, y);
    const vals: number[] = [];
    while (y < y1 && op(x, y)) {
      const v = lum(x, y);
      if (v < top - 25) break;
      top = Math.max(top, v);
      vals.push(v);
      y++;
    }
    const front: number[] = [];
    for (let yy = y; yy < Math.min(y1, y + 8); yy++) if (op(x, yy)) front.push(lum(x, yy));
    const plane = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    const frontLum = front.length ? front.reduce((a, b) => a + b, 0) / front.length : null;
    rows.push(frontLum === null || plane < frontLum + 8 || (y - y0) > 0.6 * (y1 - y0) ? 0 : vals.length);
  }
  rows.sort((a, b) => a - b);
  return rows.length ? rows[Math.floor(rows.length / 2)]! : 0;
}

const GEOMETRIC_TURNS = kitValue<number>("checks", "GEOMETRIC_TURNS");
const GEOMETRIC_ELLIPSE = kitValue<number>("checks", "GEOMETRIC_ELLIPSE");
const GEOMETRIC_MIN_ROWS = kitValue<number>("checks", "GEOMETRIC_MIN_ROWS");
const GEOMETRIC_MIRROR = kitValue<number>("checks", "GEOMETRIC_MIRROR");
const GEOMETRIC_MIRROR_ROWS = kitValue<number>("checks", "GEOMETRIC_MIRROR_ROWS");
const LEAF_MIN_PIXELS = kitValue<number>("checks", "LEAF_MIN_PIXELS");
const LEAF_CAST_MAX = kitValue<number>("checks", "LEAF_CAST_MAX");
const LEAF_DARK_MIN = kitValue<number>("checks", "LEAF_DARK_MIN");
const LEAF_CONTRAST_MIN = kitValue<number>("checks", "LEAF_CONTRAST_MIN");
const LEAF_BAND_MAX = kitValue<number>("checks", "LEAF_BAND_MAX");
const LEAF_BASE_MAX = kitValue<number>("checks", "LEAF_BASE_MAX");
const LEAF_LONE_MAX = kitValue<number>("checks", "LEAF_LONE_MAX");
const ORGANIC_LEAF_RAMP = kitValue<readonly string[]>("prompts", "ORGANIC_LEAF_RAMP");
const ORGANIC_LEAF_SHARES = kitValue<readonly number[]>("prompts", "ORGANIC_LEAF_SHARES");

/**
 * 원본 prompts.leaf_ramp_line: 견본 나무 잎 단에 가장 가까운 팔레트 키를 이름으로 준다. 팔레트 단만 주면 네 판 내리 잔디·올리브 키로
 * 잎을 칠했다(2026-10-23 Opus VQA major 「다른 세트에서 붙여 넣은 것 같다」).
 */
export function leafRampLine(palette: Palette): string {
  const nearest = (hex: string) => {
    const v = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    let best = palette.entries[0]!, bd = Infinity;
    for (const e of palette.entries) { const d = Math.hypot(e.rgba[0] - v[0]!, e.rgba[1] - v[1]!, e.rgba[2] - v[2]!); if (d < bd) { bd = d; best = e; } }
    return best;
  };
  const hex = (e: PaletteEntry) => `#${[0, 1, 2].map((i) => e.rgba[i]!.toString(16).padStart(2, "0")).join("")}`;
  const pairs = ORGANIC_LEAF_RAMP.map((h, i) => { const e = nearest(h); return `${e.key} ${hex(e)} ~${ORGANIC_LEAF_SHARES[i]}%`; }).join(", ");
  return [
    "## Leaf greens (from the exemplar trees, darkest to lightest, with their share of the leaf pixels)",
    `- Paint leaves ONLY with these keys: ${pairs}. Other greens of the palette are grass, moss or olive keys -`,
    "  a crown in them looks lighter and yellower than the town's trees (failed review four times). Fruit, flowers and",
    "  bark use their own ramps.",
  ].join("\n");
}

/**
 * 원본 checks.leaves: 잎 초록(초록이 빨강보다 10+ 크고 파랑 이상) 화소 수, 평균(빨강-파랑), 명도 60 미만 몫,
 * 이웃 명도 차 평균(contrast — 덩이마다 밝은 획 옆에 어두운 구멍이면 크다), 명도와 높이의 상관(band — 위 밝고 아래 띠로 어두우면 더 음수).
 */
export function leafTone(image: RgbaImage): { leafPixels: number; leafLone: number; leafCast: number; leafDark: number; leafContrast: number; leafBand: number } {
  const lum = new Map<number, number>();
  let cast = 0, dark = 0;
  for (let i = 0; i < image.data.length; i += 4) {
    const r = image.data[i]!, g = image.data[i + 1]!, b = image.data[i + 2]!;
    if (image.data[i + 3]! > 0 && g >= r + 10 && g >= b) { const l = 0.299 * r + 0.587 * g + 0.114 * b; lum.set(i / 4, l); cast += r - b; if (l < 60) dark++; }
  }
  const n = lum.size;
  if (!n) return { leafPixels: 0, leafLone: 0, leafCast: 0, leafDark: 0, leafContrast: 0, leafBand: 0 };
  const w = image.width;
  let steps = 0, stepSum = 0, sumY = 0, sumL = 0;
  for (const [i, l] of lum) {
    sumY += Math.floor(i / w); sumL += l;
    for (const j of [(i % w) + 1 < w ? i + 1 : -1, i + w]) { const m = j >= 0 ? lum.get(j) : undefined; if (m !== undefined) { steps++; stepSum += Math.abs(m - l); } }
  }
  const my = sumY / n, ml = sumL / n;
  let sy = 0, sl = 0, cov = 0;
  for (const [i, l] of lum) { const dy = Math.floor(i / w) - my, dl = l - ml; sy += dy * dy; sl += dl * dl; cov += dy * dl; }
  const band = sy && sl ? cov / Math.sqrt(sy * sl) : 0;
  // 가장 밝은 잎 색(4화소 이상) 중 같은 색 이웃이 없는 몫 — 견본의 밝은 획은 2~4px 이어서 0~0.12, 뿌린 점은 0.24~0.72.
  const tones = new Map<number, number[]>();
  for (const i of lum.keys()) { const c = (image.data[i * 4]! << 16) | (image.data[i * 4 + 1]! << 8) | image.data[i * 4 + 2]!; const list = tones.get(c); if (list) list.push(i); else tones.set(c, [i]); }
  const toneLum = (c: number) => 0.299 * (c >> 16) + 0.587 * ((c >> 8) & 255) + 0.114 * (c & 255);
  let hi = -1;
  for (const [c, list] of tones) if (list.length >= 4 && (hi < 0 || toneLum(c) > toneLum(hi))) hi = c;
  let lone = 0;
  if (hi >= 0) {
    const pts = new Set(tones.get(hi)!);
    let alone = 0;
    for (const i of pts) if (!((i % w) + 1 < w && pts.has(i + 1)) && !(i % w > 0 && pts.has(i - 1)) && !pts.has(i + w) && !pts.has(i - w)) alone++;
    lone = alone / pts.size;
  }
  return { leafPixels: n, leafLone: Math.round(lone * 100) / 100, leafCast: Math.round((cast / n) * 10) / 10, leafDark: Math.round((dark / n) * 1000) / 1000,
    leafContrast: steps ? Math.round((stepSum / steps) * 10) / 10 : 0, leafBand: Math.round(band * 100) / 100 };
}
/**
 * 원본 checks.geometry: 윤곽이 도형인가. turns = 왼/오른 가장자리가 들어갔다 나왔다 꺾이는 횟수(줄당) — 손으로 뭉친 수관은 자주 꺾이고
 * 타원·돔은 한 번 꺾인다. ellipse = 가장 넓은 줄의 절반 이상인 띠와 거기 맞춘 타원의 IoU. 실측: 버들항 나무·덤불 0.25~0.45 / 0.82~0.87,
 * 반려된 달걀 사과나무 0.085 / 0.92.
 */
export function silhouetteGeometry(image: RgbaImage): { rows: number; turns: number; ellipse: number; mirror: number } {
  const rows: [number, number, number, number][] = [];
  for (let y = 0; y < image.height; y++) {
    let first = -1, last = -1, n = 0;
    for (let x = 0; x < image.width; x++) if (image.data[(y * image.width + x) * 4 + 3]! > 0) { if (first < 0) first = x; last = x; n++; }
    if (n) rows.push([y, first, last, n]);
  }
  if (rows.length < 4) return { rows: rows.length, turns: 1, ellipse: 0, mirror: 0 };
  const turns = (seq: number[]) => {
    const d: number[] = [];
    for (let i = 1; i < seq.length; i++) if (seq[i] !== seq[i - 1]) d.push(seq[i]! - seq[i - 1]!);
    let t = 0;
    for (let i = 1; i < d.length; i++) if ((d[i]! > 0) !== (d[i - 1]! > 0)) t++;
    return t;
  };
  const t = (turns(rows.map((r) => r[1])) + turns(rows.map((r) => r[2]))) / rows.length;
  const mw = Math.max(...rows.map((r) => r[3]));
  const band = rows.filter((r) => r[3] >= 0.5 * mw);
  const by0 = band[0]![0], by1 = band.at(-1)![0];
  const bx0 = Math.min(...band.map((r) => r[1])), bx1 = Math.max(...band.map((r) => r[2]));
  const ea = (bx1 - bx0 + 1) / 2, eb = (by1 - by0 + 1) / 2, cx = (bx0 + bx1 + 1) / 2, cy = (by0 + by1 + 1) / 2;
  let inter = 0, union = 0;
  for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) {
    const e = ((x + 0.5 - cx) / ea) ** 2 + ((y + 0.5 - cy) / eb) ** 2 <= 1;
    const f = image.data[(y * image.width + x) * 4 + 3]! > 0;
    if (e && f) inter++;
    if (e || f) union++;
  }
  // 좌우 거울 IoU(원본 geometry 의 mirror) — 버들항 나무 0.80~0.85, 대칭 클로버로 반려된 수관 0.91~0.93.
  let mi = 0, mu = 0;
  const s2 = bx0 + bx1;
  for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) {
    const p = image.data[(y * image.width + x) * 4 + 3]! > 0;
    const q = s2 - x >= 0 && s2 - x < image.width && image.data[(y * image.width + s2 - x) * 4 + 3]! > 0;
    if (p && q) mi++;
    if (p || q) mu++;
  }
  const round3 = (v: number) => Math.round(v * 1000) / 1000;
  return { rows: rows.length, turns: round3(t), ellipse: union ? round3(inter / union) : 0, mirror: mu ? round3(mi / mu) : 0 };
}

export function ogCheck(item: WorkshopItem, grid: Grid, palette: Palette): OgCheck {
  const hard: OgIssue[] = [], warn: OgIssue[] = [];
  const { width: w, height: h, cells } = grid;
  if (w !== item.width || h !== item.height) return { ok: false, hard: [{ code: "SIZE", msg: `grid is ${w}x${h}, canvas must be ${item.width}x${item.height}` }], warn: [], topRows: 0 };
  const at = (x: number, y: number) => (x >= 0 && x < w && y >= 0 && y < h ? cells[y * w + x] : null);
  const painted: [number, number][] = [];
  cells.forEach((c, i) => { if (c !== null) painted.push([i % w, Math.floor(i / w)]); });
  if (!painted.length) return { ok: false, hard: [{ code: "EMPTY", msg: "nothing is painted" }], warn: [], topRows: 0 };
  const anchor = ogAnchorOf(item);
  const bottom = Math.max(...painted.map(([, y]) => y));
  for (let y = 0; y < Math.min(item.padTop, h); y++) {
    const xs = [...Array(w).keys()].filter((x) => at(x, y) !== null);
    if (xs.length) { hard.push({ code: "TOPPAD", msg: `rows 0..${item.padTop - 1} must stay empty; row ${y} has paint at x=${xs[0]}` }); break; }
  }
  if (STANDING.has(anchor) && bottom !== h - 1) hard.push({ code: "GROUND", msg: `lowest painted row is y=${bottom}; a standing object must touch the bottom row y=${h - 1}` });
  const corners: [number, number][] = [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]];
  if (anchor !== "flat" && corners.every(([x, y]) => at(x, y) !== null)) {
    const cc = new Set(corners.map(([x, y]) => at(x, y)));
    const share = cells.filter((c) => cc.has(c)).length / cells.length;
    const light = [...cc].some((c) => { const e = c ? palette.byKey.get(c) : undefined; return e ? (e.rgba[0] + e.rgba[1] + e.rgba[2]) / 3 > 60 : false; });
    if (cc.size === 1 && (light || share > 0.3)) hard.push({ code: "BG", msg: "all four corners are painted with one fill colour - leave everything outside the object transparent" });
  }
  const stray = painted.filter(([x, y]) => [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([dx, dy]) => at(x + dx!, y + dy!) === null));
  if (stray.length) hard.push({ code: "STRAY", msg: `${stray.length} isolated pixel(s), e.g. x=${stray[0]![0]} y=${stray[0]![1]} - remove dust` });
  if (STANDING.has(anchor)) {
    const tile = 16, foot = item.footRows ?? 1;
    for (let cy = Math.max(0, Math.floor(h / tile) - foot); cy < Math.floor(h / tile); cy++) {
      for (let cx = 0; cx < Math.floor(w / tile); cx++) {
        let empty = true;
        for (let y = cy * tile; y < (cy + 1) * tile && empty; y++) for (let x = cx * tile; x < (cx + 1) * tile; x++) if (at(x, y) !== null) { empty = false; break; }
        if (empty) hard.push({ code: "FOOTPRINT", msg: `foot cell (${cx},${cy}) is empty - the object must stand on every foot cell (or change the size)` });
      }
    }
  }
  const colors = new Set(cells.filter((c) => c !== null));
  if (colors.size < 4) warn.push({ code: "TONES", msg: `only ${colors.size} colours - use about 5-6 shades per material like the reference` });
  let speckle = 0;
  for (const [x, y] of painted) {
    const c = at(x, y);
    let same = false;
    for (let dx = -1; dx <= 1 && !same; dx++) for (let dy = -1; dy <= 1; dy++) if ((dx || dy) && at(x + dx, y + dy) === c) { same = true; break; }
    if (!same) speckle++;
  }
  if (speckle > 0.12 * painted.length) warn.push({ code: "SPECKLE", msg: `${speckle}/${painted.length} pixels differ from all neighbours - noisy` });
  const edge = painted.filter(([x, y]) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => at(x + dx!, y + dy!) === null));
  const ink = edge.filter(([x, y]) => { const e = palette.byKey.get(at(x, y)!); return e ? (e.rgba[0] + e.rgba[1] + e.rgba[2]) / 3 <= 30 : false; });
  if (edge.length && ink.length > 0.6 * edge.length) warn.push({ code: "INK", msg: `${ink.length}/${edge.length} edge pixels are near-black - outline with the material's darkest shade` });
  const topRows = topPlaneRows(renderGrid(grid, palette));
  if (ogIsOrganic(item)) {
    const g = silhouetteGeometry(renderGrid(grid, palette));
    if (g.turns < GEOMETRIC_TURNS && g.ellipse > GEOMETRIC_ELLIPSE) {
      const issue = { code: "GEOMETRIC", msg: `the silhouette is a smooth primitive (edge turn-backs ${g.turns}/row, ellipse match ${g.ellipse}) - break it into irregular leaf clumps / lumps with notches, as in the exemplars` };
      (g.rows >= GEOMETRIC_MIN_ROWS ? hard : warn).push(issue);
    }
    if (footprintClass(item.title, item.description ?? "") === "tree" && g.rows >= GEOMETRIC_MIRROR_ROWS && g.mirror > GEOMETRIC_MIRROR) {
      hard.push({ code: "SYMMETRIC", msg: `the crown is nearly mirror-symmetric (left/right match ${g.mirror}, exemplars 0.80-0.85) - make one shoulder 3+ px higher, one side wider, lobes and notches at different heights` });
    }
    const lv = leafTone(renderGrid(grid, palette));
    if (lv.leafPixels >= LEAF_MIN_PIXELS) {
      if (lv.leafCast > LEAF_CAST_MAX) hard.push({ code: "LEAFHUE", msg: `the leaves are olive/yellow (red-blue ${lv.leafCast}, exemplars -9..-4, limit -1) - paint them with the listed leaf-green keys` });
      if (lv.leafLone > LEAF_LONE_MAX) hard.push({ code: "LEAFSPECK", msg: `the highlights are single sprinkled pixels (${Math.round(lv.leafLone * 100)}% of the lightest leaf tone stands alone, exemplars 0-12%) - group the lightest green into 2-4 px dashes on the upper-left lobes only` });
      if (lv.leafContrast < LEAF_CONTRAST_MIN) hard.push({ code: "LEAFFLAT", msg: `the leaves are a smooth gradient, not clumps (neighbour contrast ${lv.leafContrast}, exemplars 12-18) - build separate clumps: a 2-4 px light dash on each clump's upper left right next to dark pockets` });
      if (lv.leafBand < LEAF_BAND_MAX) hard.push({ code: "LEAFBAND", msg: `light and dark change by height (luma-height correlation ${lv.leafBand}, exemplars -0.44..-0.53) - light every clump on its own upper left, put dark pockets between clumps at every height` });
      const art = renderGrid(grid, palette);
      const widths: number[] = [];
      for (let y = 0; y < art.height; y++) { let n = 0; for (let x = 0; x < art.width; x++) if (art.data[(y * art.width + x) * 4 + 3]! > 0) n++; if (n) widths.push(n); }
      if (widths.length && widths.at(-1)! / Math.max(...widths) > LEAF_BASE_MAX) hard.push({ code: "FLATBASE", msg: `the base is cut flat along the ground (lowest row ${widths.at(-1)} of ${Math.max(...widths)} px wide) - let the lower edge come down unevenly: leaves hanging lower in places, gaps, a rounded tuck` });
      if (lv.leafDark < LEAF_DARK_MIN) hard.push({ code: "LEAFLIGHT", msg: `the crown is too light (${Math.round(lv.leafDark * 100)}% dark leaf pixels, exemplars 28-38%) - more dark interior, shadow under lobes, darker lower right` });
    }
  } else if (TOP_KINDS.has(item.gateKind ?? "") && STANDING.has(anchor) && topRows < 3) warn.push({ code: "TOP", msg: `measured top plane is ${topRows} row(s) (column scan) - a 3/4 top needs >= 3 lit rows above the front` });
  return { ok: hard.length === 0, hard, warn, topRows };
}
export const describeCheck = (check: OgCheck): string => [
  `${check.ok ? "PASS" : "FAIL"} (mechanical checks only - not an approval) · measured top plane ${check.topRows} row(s)`,
  ...check.hard.map((i) => `  FAIL ${i.code}: ${i.msg}`), ...check.warn.map((i) => `  warn ${i.code}: ${i.msg}`),
].join("\n");

// --- 그리기 지시문(원본 prompts.draw_brief) ---------------------------------------------------------------------------

/**
 * object-gen 의 job `rules`(「Drawing rules for this set」 — 그리기 지시문과 고르기가 읽는 입력)로 맵 배경을 넘긴다.
 * 시험 2(2026-10-21): 조수가 jp_city 공중전화 부스를 영국식 빨간 부스로 적어, 원본·공방 둘 다 영국식을 그렸다(VQA FAIL).
 */
export function ogRules(item: WorkshopItem): string {
  if (!item.setting) return "";
  return [
    `- Setting of the map this object goes into: ${item.setting}.`,
    "- Draw the form this object really has in that setting (its country, era and culture). If the brief describes a form from another",
    "  place (for example a Western roofed well with a crank in a Joseon-era Korean village), draw the setting's own form instead and keep the brief's colours only where they fit.",
    "- It must read as that object, in that setting, at 1x.",
  ].join("\n");
}

export type OgStyle = { readonly name: string; readonly floor: Rgba; readonly refs: readonly { readonly label: string; readonly url: string }[] };

export function ogDrawBrief(ctx: DrawContext, opts: { readonly hasReference: boolean; readonly chipset: string }): string {
  const item = ctx.item;
  const letter = ctx.direction.letter;
  const anchor = ogAnchorOf(item);
  const organic = ogIsOrganic(item);
  const cellsW = item.width / 16, cellsH = item.height / 16;
  const brief = `${item.title} — ${item.description}${item.setting ? ` Setting: ${item.setting}` : ""}`;
  const lines = [
    `# object-gen: ${item.title} - candidate ${letter}, attempt ${ctx.attempt}/${ctx.maxAttempts}`,
    "",
    "You are drawing ONE new map object for an existing 16px RPG chipset, in that chipset's style, as code pixels",
    "(rows of palette letters, or a PNG from your own script). A person or supervisor picks between candidates later.",
    "Do not copy pixels from third-party art.",
    "",
    `- Brief: ${brief}`,
    `- Placement: ${ANCHOR_TEXT[anchor] ?? anchor}${item.use.length ? `; use: ${item.use.join(", ")}` : ""}`,
    `- Canvas: ${item.width}x${item.height} px = ${cellsW}x${cellsH} cells of 16px. Foot rows (blocking): ${item.footRows ?? 1}.${item.padTop ? ` Keep the top ${item.padTop} rows empty.` : ""}`,
    // 원본 prompts.draw_brief 의 Footprint 줄(object-gen 8d894eb) — 큰 물건의 발밑/위 줄을 그리는 쪽이 알게.
    ...((item.footRows ?? 1) > 0 && (item.footRows ?? 1) < cellsH && anchor !== "flat" && anchor !== "hang"
      ? [`- Footprint: the bottom ${item.footRows ?? 1} cell row(s) are where it stands (they block walking); the ${cellsH - (item.footRows ?? 1)} row(s) above hold only its tall parts, drawn over a person walking behind it. A person is 1 cell wide and 2 cells tall.`]
      : []),
    `- 3/4 gate kind: ${item.gateKind ?? "other"}`,
    `- Your direction ${letter}: ${DIRECTIONS[letter] ?? ctx.direction.text}`,
    "",
  ];
  const note = [ctx.roundNote, ctx.redrawNote].filter(Boolean).join("\n");
  if (note) lines.push("## Note from the person (follow first)", note, "");
  const rules = ogRules(item);
  if (rules) lines.push("## Drawing rules for this set (follow them; the picker checks them as well as readability)", rules, "");
  const v = ctx.lastVerdict;
  if (v && v.verdict === "FAIL") {
    lines.push("## Your last attempt failed the blind review - the judges said (fix these, keep what passed)",
      `- votes: ${v.top}`, ...v.reasons.split("\n").filter(Boolean).slice(0, 6).map((r) => `- ${r}`), "");
  }
  lines.push(
    "## References (attached images)",
    `ref-*.png = objects of the target chipset (${opts.chipset}) (match their craft). palette = the keys below.`,
    ...(opts.hasReference ? [
      "reference/ref-*.png (large, generated) = what the object looks like from this view. Use it for FORM only: which",
      "parts exist, where, their proportions, what makes it recognisable. Never downscale, trace or sample it - place every",
      "pixel yourself with the palette keys (a REFCOPY warning means the drawing looks like a shrunken reference).",
      // 모양만 보라는 말에 색까지 버려 금빛 건초를 연한 베이지로 칠했다(2026-10-22 VQA major) — 색 몫만은 따르게 한다.
      ...(ctx.referenceColors?.length ? [`Its main colours, mapped to the nearest palette keys (share of the object): ${ctx.referenceColors.map((c) => `${c.key} ${c.hex} ${c.share}%`).join(", ")}.`,
        organic
          // 자연물: 생성 그림의 초록은 칩셋 나무보다 밝고 노래서 가장 가까운 키가 잔디색이 된다 — 잔디색 잎은 풀밭에 묻힌다(2026-10-22 Opus VQA major, 사과나무 잎 #618c3b = 잔디).
          ? "Use these only for the fruit, flower or accent hues. Leaves, bark and stone take the ramps of this chipset's own trees and rocks (ref-*.png, darker blue-greens) - the reference picture's greens map to the GRASS keys, and leaves in grass green vanish on the lawn."
          : "Keep these hues for the matching parts (shade them with darker/lighter keys of the same ramp) - do not wash a saturated part out to beige or grey."] : []),
      ""] : [""]),
    anchor === "flat" || anchor === "hang" ? `## View\n- This object ${ANCHOR_TEXT[anchor]}.\n` : `${kitValue("prompts", organic ? "VIEW_ORGANIC" : "VIEW")}\n`,
    kitValue("prompts", organic ? "RECIPE_ORGANIC" : "RECIPE"),
    ...(organic ? ["", leafRampLine(ctx.palette)] : []),
    // 큰 물건 지시(윗면 25~35%·받침)는 가구용이다 — 자연물에는 넣지 않는다(원본 draw_brief 와 같다).
    ...(cellsW * cellsH >= LARGE_CELLS && !organic ? ["", kitValue("prompts", "LARGE")] : []),
    "",
    "## Palette ramps (taken from the chipset; ramp:step, dark to light)",
    rampSummary(ctx.palette),
    "",
    kitValue("prompts", "ANSWER"),
    "",
    // 원본 ANSWER 의 B)(PNG 내기)는 대화에서 쓸 수 없다 — 원본 drawer.WORKFLOW 가 ANSWER 를 덮어쓰듯 여기서 덮는다.
    "## How to answer in this run (overrides \"Answer\" above)",
    "- Answer A) only: ONE JSON object with legend, rows (and optional parts), note, topRows. No PNG, no script, no prose.",
    "- Legend values are the palette keys exactly as listed above (for example c:17).",
    "- After your answer you will be shown your drawing at 8x/1x/2x on the floor next to the references and exemplars,",
    "  with the mechanical checks. Fix every FAIL code; look honestly - would it sit next to the exemplars in the same game, and read at 1x?",
  );
  if (ctx.previousGrid) lines.push("", "## Your previous grid (start from it)", JSON.stringify(gridToAnswer(ctx.previousGrid)));
  return lines.join("\n");
}

const img = (url: string): ContentPart => ({ type: "image_url", image_url: { url, detail: "high" } });
const txt = (text: string): ContentPart => ({ type: "text", text });

export function ogDrawMessages(ctx: DrawContext, env: WorkshopEnv, style: OgStyle, anchors: OgAnchors | null): ChatMessage[] {
  const forms = ctx.references?.length ? ctx.references : ctx.reference ? [ctx.reference] : [];
  const parts: ContentPart[] = [txt(ogDrawBrief(ctx, { hasReference: forms.length > 0, chipset: style.name }))];
  style.refs.forEach((ref, i) => parts.push(txt(`ref-${i}.png — ${ref.label}`), img(ref.url)));
  forms.forEach((url, i) => parts.push(txt(`reference/ref-${i + 1}.png — FORM only (참고용, 설치 안 됨)`), img(url)));
  if (anchors) parts.push(txt("exemplars.png — drawings the owner called very good (the bar for view, shading and craft) at 6x"), img(env.encodePng(exemplarSheet(anchors, style.floor))));
  if (ctx.previousGrid) parts.push(txt("your previous grid at 8x"), img(env.encodePng(scaleImage(onBackground(renderGrid(ctx.previousGrid, ctx.palette), style.floor), 8))));
  return [{ role: "user", content: parts }];
}

/** 원본 drawer.preview + j.dry: 그린 것을 8배·1배·2배로(견본 옆) + 기계 검사 → 고친 JSON 또는 {"keep": true}. */
export function ogLookMessage(ctx: DrawContext, grid: Grid, env: WorkshopEnv, style: OgStyle, look: number, max: number): ChatMessage {
  const art = onBackground(renderGrid(grid, ctx.palette), style.floor);
  const check = ogCheck(ctx.item, grid, ctx.palette);
  return {
    role: "user",
    content: [
      txt(`Look ${look}/${max}. preview: your drawing at 8x, then 1x (what the player sees), then 2x, on the floor colour.`),
      img(env.encodePng(scaleImage(art, 8))), img(env.encodePng(art)), img(env.encodePng(scaleImage(art, 2))),
      txt(`j.dry: ${describeCheck(check)}\n\nFix every FAIL code; look honestly - would it sit next to the exemplars in the same game, and read at 1x? `
        + "Compare with the reference pictures (FORM only) and the exemplars above. If anything should change, answer the whole improved JSON "
        + "(same format). If it is done, answer exactly {\"keep\": true, \"note\": \"<what you drew, and anything that still does not read>\"}."),
    ],
  };
}
export function isKeep(text: string): boolean {
  return /"keep"\s*:\s*true/u.test(text) && !/"rows"\s*:/u.test(text);
}

// --- 블라인드 판정(원본 vqa) ------------------------------------------------------------------------------------------

type Rand = () => number;
const pickOne = <T>(list: readonly T[], rand: Rand): T => list[Math.floor(rand() * list.length)]!;
function shuffle<T>(list: T[], rand: Rand): T[] {
  for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [list[i], list[j]] = [list[j]!, list[i]!]; }
  return list;
}
function mapPixels(image: RgbaImage, fn: (rgba: Rgba, x: number, y: number) => Rgba): RgbaImage {
  const data = new Uint8ClampedArray(image.data);
  for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) {
    const i = (y * image.width + x) * 4;
    if (!data[i + 3]) continue;
    data.set(fn([data[i]!, data[i + 1]!, data[i + 2]!, data[i + 3]!], x, y), i);
  }
  return { width: image.width, height: image.height, data };
}
export function probeFlat(image: RgbaImage, palette: Palette): RgbaImage {
  const keys = [...palette.entries].sort((a, b) => luma(a.rgba) - luma(b.rgba));
  const dark = keys[Math.floor(keys.length / 5)]!.rgba, mid = keys[Math.floor(keys.length / 2)]!.rgba;
  return mapPixels(image, (p) => (luma(p) < 90 ? [dark[0], dark[1], dark[2], 255] : [mid[0], mid[1], mid[2], 255]));
}
export function probeNoise(image: RgbaImage, palette: Palette, rand: Rand): RgbaImage {
  return mapPixels(image, (p) => { if (rand() >= 0.3) return p; const c = pickOne(palette.entries, rand).rgba; return [c[0], c[1], c[2], 255]; });
}
export function probeForeign(image: RgbaImage): RgbaImage {
  return mapPixels(image, ([r, g, b]) => {
    const max = Math.max(r, g, b) / 255, min = Math.min(r, g, b) / 255, d = max - min;
    let h = d === 0 ? 0 : max === r / 255 ? ((g - b) / 255 / d) % 6 : max === g / 255 ? (b - r) / 255 / d + 2 : (r - g) / 255 / d + 4;
    h = ((h / 6) + 1) % 1;
    const s = max === 0 ? 0 : d / max, v = max;
    const h2 = (h + 0.5) % 1, s2 = Math.min(1, s * 1.6 + 0.35);
    const i = Math.floor(h2 * 6), f = h2 * 6 - i, pp = v * (1 - s2), q = v * (1 - f * s2), t = v * (1 - (1 - f) * s2);
    const [R, G, B] = [[v, t, pp], [q, v, pp], [pp, v, t], [pp, q, v], [t, pp, v], [v, pp, q]][i % 6]!;
    return [Math.floor(R! * 255), Math.floor(G! * 255), Math.floor(B! * 255), 255];
  });
}
export function probeSlab(image: RgbaImage): RgbaImage {
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  const cols = new Map<string, Rgba>();
  for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) {
    const i = (y * image.width + x) * 4;
    if (!image.data[i + 3]) continue;
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + 1); y1 = Math.max(y1, y + 1);
    cols.set(`${image.data[i]},${image.data[i + 1]},${image.data[i + 2]}`, [image.data[i]!, image.data[i + 1]!, image.data[i + 2]!, 255]);
  }
  if (x1 < 0) return image;
  const sorted = [...cols.values()].sort((a, b) => luma(a) - luma(b));
  const mid = sorted[Math.floor(sorted.length / 2)]!, dark = sorted[Math.floor(sorted.length / 6)]!;
  return mapPixels(image, (_, x, y) => {
    const edge = x === x0 || x === x1 - 1 || y === y0 || y === y1 - 1;
    return edge ? [0, 0, 0, 255] : (y - y0) % 6 === 0 ? dark : mid;
  });
}
/** 원본 make_probes: flat/noise/foreign 중 하나 + slab(서는 물건) + 견본 반려 하나. */
export function makeProbes(item: WorkshopItem, base: RgbaImage, palette: Palette, rand: Rand, anchors: OgAnchors | null): { name: string; image: RgbaImage }[] {
  const pool = [{ name: "flat", image: probeFlat(base, palette) }, { name: "noise", image: probeNoise(base, palette, rand) }, { name: "foreign", image: probeForeign(base) }];
  const first = pickOne(pool, rand);
  const chosen = [first];
  const anchor = ogAnchorOf(item);
  if (anchor !== "flat" && anchor !== "hang") chosen.push({ name: "slab", image: probeSlab(base) });
  else chosen.push(pickOne(pool.filter((p) => p.name !== first.name), rand));
  if (anchors?.rejects.length) {
    const reject = pickOne(anchors.rejects, rand);
    chosen.push({ name: `bank:${reject.label}`, image: fit(reject.image, base.width, base.height) });
  }
  return chosen;
}

/** 원본 JUDGE 문장. 그림판(Read 도구로 여는 파일) 대신 메시지에 그림이 붙는다는 첫 문단만 바꾼다. */
function judgeText(item: WorkshopItem, ids: readonly string[], anchorLines: readonly string[]): string {
  const from = "Open each board image with your Read tool ({n_images} board(s)). Top row of every board = ANCHORS at 6x with a 1x thumbnail:";
  const to = "The pictures below come first as ANCHORS, each at 6x with a 1x thumbnail beside it:";
  const from2 = "Bottom row = samples S1..Sn at 6x with a 1x thumbnail";
  const to2 = "Then the samples S1..Sn, each at 6x with a 1x thumbnail beside it";
  const base = kitValue("prompts", "JUDGE");
  if (!base.includes(from) || !base.includes(from2)) throw new Error("object-gen JUDGE 문장이 바뀌었다 — objectGenFlow.judgeText 를 원본에 맞춰 고쳐라");
  const brief = `${item.title} — ${item.description}${item.setting ? ` Setting: ${item.setting}` : ""}`;
  return base.replace(from, to).replace(from2, to2)
    .replace("{anchors}", anchorLines.map((a) => `- ${a}`).join("\n") || "- (tileset references)")
    .replace("{name}", item.title).replace("{brief}", brief.slice(0, 300)).replace("{ids}", ids.join(", "))
    .replaceAll("{{", "{").replaceAll("}}", "}");
}

export type JudgeKey = Readonly<Record<string, { readonly kind: "candidate" | "probe"; readonly name: string }>>;
export function ogJudgeRun(ctx: ReviewContext, env: WorkshopEnv, style: OgStyle, anchors: OgAnchors | null, rand: Rand): { messages: ChatMessage[]; key: JudgeKey } {
  const base = renderGrid(ctx.candidate, ctx.palette);
  const samples = shuffle([{ kind: "candidate" as const, name: ctx.direction.letter, image: base },
    ...makeProbes(ctx.item, base, ctx.palette, rand, anchors).map((p) => ({ kind: "probe" as const, ...p }))], rand);
  const key: Record<string, { kind: "candidate" | "probe"; name: string }> = {};
  const parts: ContentPart[] = [];
  const lines: string[] = [];
  if (anchors) {
    for (const a of anchors.good) { lines.push(`GOOD ${a.label}: ${a.why}`); parts.push(txt(`GOOD ${a.label}`), img(env.encodePng(card(a.image, style.floor)))); }
    for (const a of anchors.bad) { lines.push(`BAD ${a.label}: ${a.why}`); parts.push(txt(`BAD ${a.label}`), img(env.encodePng(card(a.image, style.floor)))); }
  } else {
    style.refs.forEach((ref, i) => { lines.push(`GOOD tileset ref ${i}: an object of the target tileset (the quality and style bar)`); parts.push(txt(`GOOD tileset ref ${i}`), img(ref.url)); });
  }
  const ids: string[] = [];
  samples.forEach((sample, i) => {
    const id = `S${i + 1}`;
    ids.push(id);
    key[id] = { kind: sample.kind, name: sample.name };
    parts.push(txt(`${id} ${ctx.item.title}`), img(env.encodePng(card(sample.image, style.floor))));
  });
  return { messages: [{ role: "user", content: [txt(judgeText(ctx.item, ids, lines)), ...parts] }], key };
}

export type JudgeRunResult = { readonly void?: string; readonly view34?: boolean; readonly quality?: boolean; readonly reason?: string };
/** 원본 vqa.parse_answer + score: 표본을 빠뜨리면 무효, 숨긴 반려 표본을 둘 다 PASS 로 주면 무효. */
export function scoreJudge(text: string, key: JudgeKey): JudgeRunResult {
  const items = new Map<string, Record<string, unknown>>();
  for (const found of text.replace(/```(?:json)?/gu, "").match(/\{[^{}]*\}/gu) ?? []) {
    try { const it = JSON.parse(found) as Record<string, unknown>; if (typeof it.id === "string" && key[it.id]) items.set(it.id, it); } catch { /* 다음 */ }
  }
  const missing = Object.keys(key).filter((id) => !items.has(id));
  if (missing.length) return { void: `the judge skipped samples ${missing.join(", ")} - this run is not used` };
  const leaked: string[] = [];
  let mine: JudgeRunResult = {};
  for (const [id, k] of Object.entries(key)) {
    const it = items.get(id)!;
    const v34 = String(it.view34 ?? "").toUpperCase() === "PASS", q = String(it.quality ?? "").toUpperCase() === "PASS";
    if (k.kind === "probe" && v34 && q) leaked.push(k.name);
    if (k.kind === "candidate") mine = { view34: v34, quality: q, reason: String(it.reason ?? "").slice(0, 400) };
  }
  if (leaked.length) return { void: `the judge passed hidden reject sample(s) ${leaked.join(", ")} - this run is not used` };
  return mine;
}
/** 유효 판 다수결 → 공방 Verdict. 유효 판이 모자라면 불통과(원본: 완료 안 된 검수는 PASS 가 아니다). */
export function aggregateJudge(results: readonly JudgeRunResult[], need = OG_JUDGE_RUNS): Verdict {
  const valid = results.filter((r) => !r.void).slice(0, need);
  const voids = results.filter((r) => r.void).map((r) => r.void!);
  const both = valid.filter((r) => r.view34 && r.quality).length;
  const complete = valid.length >= need;
  const pass = complete && both * 2 > valid.length;
  const fails = valid.filter((r) => !(r.view34 && r.quality));
  const codes = [...new Set(fails.flatMap((r) => [...(r.view34 ? [] : ["VIEW"]), ...(r.quality ? [] : ["QUALITY"])]))];
  const reasons = [
    ...fails.map((r) => `${r.view34 ? "QUALITY" : "VIEW"}: ${r.reason}`),
    ...(pass ? valid.filter((r) => r.view34 && r.quality).map((r) => `PASS: ${r.reason}`) : []),
    ...(complete ? [] : [`검수 완료 안 됨 — 유효 판 ${valid.length}/${need}${voids.length ? ` (무효 ${voids.length}: ${voids[0]})` : ""}`]),
  ];
  return {
    verdict: pass ? "PASS" : "FAIL", codes: pass ? [] : codes.length ? codes : ["INCOMPLETE"],
    top: `both axes ${both}/${valid.length} . view34 ${valid.filter((r) => r.view34).length}/${valid.length} . quality ${valid.filter((r) => r.quality).length}/${valid.length}${voids.length ? ` . void ${voids.length}` : ""}`,
    topRows: null, reasons: reasons.join("\n"), fix: fails.map((r) => r.reason).join(" / "), worse: false,
  };
}

/** 원본 vqa.review: 유효 3판이 모일 때까지(무효는 2번까지 더) 새 판정 호출. */
export async function ogReview(ctx: ReviewContext, env: WorkshopEnv, style: OgStyle, anchors: OgAnchors | null, ask: (messages: ChatMessage[]) => Promise<string>, rand: Rand = Math.random): Promise<Verdict> {
  const results: JudgeRunResult[] = [];
  for (let i = 0; i < OG_JUDGE_RUNS + OG_JUDGE_RETRIES; i++) {
    const run = ogJudgeRun(ctx, env, style, anchors, rand);
    results.push(scoreJudge(await ask(run.messages), run.key));
    if (results.filter((r) => !r.void).length >= OG_JUDGE_RUNS) break;
  }
  return aggregateJudge(results);
}

// --- 고르기 지시문(원본 picker.PROMPT) --------------------------------------------------------------------------------

export function ogPickerPrompt(item: WorkshopItem): string {
  const brief = `${item.description}${item.setting ? ` Setting: ${item.setting}` : ""}`;
  const rules = ogRules(item);
  // 원본 picker.prepare 의 rules_part 문장(모듈 상수가 아니라 함수 안 글이라 여기 옮겨 적는다).
  const rulesPart = !rules ? "" : "This set has explicit DRAWING RULES. Weigh rule compliance as heavily as readability: check every candidate "
    + "against each rule on the 8x board (outline ink, roof/top proportions, joint and tick patterns, margins ...). "
    + "A candidate that breaks a rule the others keep loses, even if it reads well at 1x. Name the rules that decided "
    + `it in your reason.\nRULES:\n${rules.slice(0, 4000)}\n`;
  return kitValue("picker", "PROMPT").replace("{name}", item.title).replace("{brief}", brief).replace("{earlier_line}", "")
    .replace("{rules_part}", rulesPart).replace("{earlier_rule}", "Pick a number.\n").replaceAll("{{", "{").replaceAll("}}", "}");
}
