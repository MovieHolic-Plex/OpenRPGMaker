/**
 * 측면 전투 배경 — 「전투가 벌어지는 맵을 보고 생성형 그림 → 도트화」의 공용 핵심(DOM·노드 의존 없음).
 *
 * 같은 코드를 두 입구가 쓴다:
 *  - 하네스 `battle-backdrop`(src/harnesses/battle-backdrop/node/cli.ts) — 후보 여럿 → 기계 검사 → 사람이 고름 → 설치.
 *  - 편집기 조수 도구 `generate_battle_backdrop`(src/editor/battleBackdropGeneration.ts) — 한 장을 만들어 바로 연결.
 *
 * 규격(2026-10-29 실측): 번들 측면 배경(`public/assets/generated/battle-scenery/<biome>/preview.png`)은
 * 640×360 이고 2×2 블록이 100% 같다 — 즉 **원래 격자는 320×180, 2배 최근접 확대로 저장**, 색은 20~23개.
 * 전투 화면(retro2003)은 비-바이옴 id 를 한 장 그림으로 `cover` 로 깐다(640×480 무대 → 좌우가 잘린다).
 * 배틀러 발은 무대(640×480) 위 56px 아래 424px 영역의 저작 좌표 320×160 에 놓인다(retro2003) → 발이 무대 높이 약 57%~90%,
 * 몸(약 144px)은 그 위 30%. 그래서 아래 45% 는 비어 있어야 하고 벽·물체는 위쪽 절반 안에서 끝나야 한다.
 *
 * 생성형 그림은 원래 타일 저작에서 금지다. 사용자가 2026-10-29 **전투 배경에 한해** 「도트처럼 보이고 게임 그림과 맞으면」 허용했다.
 */

export const BACKDROP_NATIVE_WIDTH = 320;
export const BACKDROP_NATIVE_HEIGHT = 180;
/** 저장은 2배 최근접 확대(번들 측면 배경과 같은 640×360). 한 장 그림은 런타임에서 pixelated 표시가 없어서 미리 키운다. */
export const BACKDROP_STORE_SCALE = 2;
/** 맵 칩셋에서 뽑는 색 수 + 생성 그림에서 덧붙이는 색 수. 합이 최대 색 수. */
export const BACKDROP_MAP_COLORS = 24;
export const BACKDROP_EXTRA_COLORS = 8;
export const BACKDROP_MAX_COLORS = BACKDROP_MAP_COLORS + BACKDROP_EXTRA_COLORS;
/** 배틀러가 서는 띠의 시작(그림 높이 비율). 이 아래는 큰 물체·강한 무늬가 없어야 한다. */
export const BACKDROP_GROUND_TOP = 0.55;

export type Rgba = { readonly width: number; readonly height: number; readonly data: Uint8Array | Uint8ClampedArray };
export type Rgb = readonly [number, number, number];
export type TimeOfDay = "day" | "dusk" | "night";
export type LightLevel = "bright" | "dim" | "dark";

/** 캡처에서 뽑은 사실 — 프롬프트·검사·시트가 같이 쓴다. */
export type BackdropFacts = {
  readonly mapId: string;
  readonly mapName: string;
  readonly tilesetName: string;
  readonly indoor: boolean;
  readonly timeOfDay: TimeOfDay;
  /** 시간 근거(조명·낱말)가 있다. 창 없는 실내처럼 근거가 없으면 false — 프롬프트가 시간을 강요하지 않고 판정자도 시간을 묻지 않는다. */
  readonly timeCertain: boolean;
  readonly light: LightLevel;
  /** 시간·빛을 그렇게 정한 근거(사람이 시트에서 확인). */
  readonly evidence: readonly string[];
  /** 장소를 말해 주는 낱말(맵 이름·장소 이름·전투 직전 대사 몇 줄). */
  readonly placeWords: readonly string[];
  /** 캡처(조명 적용) 평균 밝기 0..1. */
  readonly captureLuma: number;
  /** 맵 칩셋(캡처)에서 뽑은 팔레트 '#rrggbb'. */
  readonly palette: readonly string[];
  /** 사람이 덧붙인 지시(선택). */
  readonly note?: string;
};

const NIGHT_WORDS = /밤|새벽|자정|심야|야간|한밤|보름달|달빛|night|midnight|moon/iu;
const DUSK_WORDS = /저녁|노을|해질|황혼|석양|dusk|sunset|evening/iu;
const DAY_WORDS = /아침|낮|정오|한낮|오후|morning|noon|daytime/iu;

/**
 * 시간·빛 추정. 맵 기본 조명(ambient·color)이 먼저고, 없으면 전투 직전 대사·맵 이름의 낱말을 본다.
 * 런타임 조명은 곱하기: rgb * (255*(1-a) + color*a)/255 (src/player/playSceneMapSkirt.ts).
 */
export function inferTimeAndLight(input: {
  readonly lighting?: { readonly ambient?: number; readonly color?: string } | null;
  readonly texts: readonly string[];
  readonly indoor: boolean;
}): { time: TimeOfDay; certain: boolean; light: LightLevel; evidence: string[] } {
  const evidence: string[] = [];
  const ambient = Math.max(0, Math.min(1, input.lighting?.ambient ?? 0));
  const color = hexToRgb(input.lighting?.color ?? "#000000") ?? [0, 0, 0];
  const lightMul = 1 - ambient + (luma(color) * ambient);
  let light: LightLevel = lightMul > 0.8 ? "bright" : lightMul > 0.5 ? "dim" : "dark";
  if (ambient > 0) evidence.push(`맵 기본 조명 ambient ${ambient} · ${input.lighting?.color ?? "#000000"} → 밝기 ×${lightMul.toFixed(2)}`);
  else evidence.push("맵 기본 조명 없음(ambient 0)");
  let time: TimeOfDay | null = null;
  let certain = true;
  for (const text of input.texts) {
    const hit = NIGHT_WORDS.exec(text) ?? DUSK_WORDS.exec(text) ?? DAY_WORDS.exec(text);
    if (!hit) continue;
    time = NIGHT_WORDS.test(text) ? "night" : DUSK_WORDS.test(text) ? "dusk" : "day";
    evidence.push(`낱말 「${hit[0]}」: ${text.slice(0, 60)}`);
    break;
  }
  if (!time) {
    if (!input.indoor && light !== "bright") { time = light === "dark" ? "night" : "dusk"; evidence.push("야외인데 조명이 어둡다"); }
    else if (input.indoor) { time = "day"; certain = false; evidence.push("시간 낱말 없음 · 실내 → 시간은 정하지 않고 조명만 맞춘다"); }
    else { time = "day"; evidence.push("시간 낱말 없음 → 낮으로 둔다"); }
  }
  // 실내는 낮밤과 무관하게 조명이 정한다. 야외 밤인데 조명이 없으면(대사로만 밤) 그림은 어둡게 그린다.
  if (!input.indoor && time === "night" && light === "bright") light = "dark";
  return { time, certain, light, evidence };
}

const TIME_BRIEF: Record<TimeOfDay, string> = {
  day: "daytime",
  dusk: "dusk, low warm sunlight",
  night: "NIGHT (deep blue-black sky or dark windows, artificial lights only)",
};
const LIGHT_BRIEF: Record<LightLevel, string> = {
  bright: "evenly lit",
  dim: "dim, moody lighting with strong local light sources",
  dark: "dark scene, only a few glowing light sources",
};

/** 후보마다 구도를 조금씩 바꾼다(같은 프롬프트 N장은 거의 같은 그림이 나온다). */
export const BACKDROP_FRAMINGS: readonly string[] = [
  "Wide view showing the whole place from the middle of the floor.",
  "Closer view of the most characteristic back wall, symmetrical and centered.",
  "Slightly diagonal view, the back wall receding toward one side.",
  "Low eye-level view, the back wall filling the upper half, a deep open floor in front.",
  "Wide view at a slight high angle, like a classic 16-bit JRPG battle background.",
];

/** 생성기에 주는 지시. 그림 1 = 그 장소의 위에서 본 맵(참고 그림). */
export function backdropPrompt(facts: BackdropFacts, variant: number): string {
  const framing = BACKDROP_FRAMINGS[variant % BACKDROP_FRAMINGS.length]!;
  const words = facts.placeWords.filter(Boolean).slice(0, 8).map((w) => JSON.stringify(w)).join(", ");
  return [
    "Use case: side-view JRPG battle background (battleback), one image, 16:9 landscape.",
    `Image 1 is a top-down 16px pixel-art game map of the EXACT place where this battle happens: ${JSON.stringify(facts.mapName)} (${facts.indoor ? "indoor" : "outdoor"}). It is a content reference only: read its walls, floor material, furniture, colors and light, then REDRAW THE SAME PLACE seen from the side at eye level, like SNES Final Fantasy VI or RPG Maker 2003 battle backgrounds. Do not draw a top-down view.`,
    `Place words: ${words || JSON.stringify(facts.mapName)}.`,
    facts.timeCertain
      ? `Time and light: ${TIME_BRIEF[facts.timeOfDay]}, ${LIGHT_BRIEF[facts.light]}. Keep the same time of day and lighting as Image 1.`
      : `Light: ${LIGHT_BRIEF[facts.light]}, same mood and brightness as Image 1. No windows to the outside are needed.`,
    `Composition: ${framing} The back wall or horizon and the place's distinctive objects stay in the UPPER HALF. The LOWER 45% is open, flat, uncluttered floor or ground where battle characters will stand: no furniture, props, holes or strong patterns there.`,
    "Floor and ground are matte: no glossy reflections, no mirror-like highlights, no soft gradients on the floor.",
    "Style: 16-bit pixel art with large clear pixels, limited palette of about 24 colors close to Image 1's colors, crisp hard pixel edges, no anti-aliasing, no soft gradients, no dithering noise, no photo texture.",
    "Forbidden: NO characters, people, silhouettes, animals or monsters. NO text, letters, numbers, readable signs, logos, UI, frame, border or watermark.",
    ...(facts.note ? [`Extra direction: ${facts.note}`] : []),
  ].join("\n\n");
}

// ---------- 색 ----------

export function hexToRgb(hex: string): Rgb | null {
  const m = /^#?([0-9a-f]{6})$/iu.exec(hex.trim());
  if (!m) return null;
  const v = parseInt(m[1]!, 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
export function rgbToHex(c: Rgb): string {
  return "#" + c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
}
/** 0..1 상대 밝기(sRGB 근사). */
export function luma(c: Rgb): number {
  return (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;
}

type Lab = [number, number, number];
const toLinear = (v: number) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
export function oklab(c: Rgb): Lab {
  const r = toLinear(c[0]), g = toLinear(c[1]), b = toLinear(c[2]);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
const dist2 = (a: Lab, b: Lab) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

/** 불투명 화소의 색 빈도(24비트 키). */
function histogram(img: Rgba, step = 1): Map<number, number> {
  const counts = new Map<number, number>();
  const d = img.data;
  for (let y = 0; y < img.height; y += step) for (let x = 0; x < img.width; x += step) {
    const i = (y * img.width + x) * 4;
    if (d[i + 3]! < 128) continue;
    const key = (d[i]! << 16) | (d[i + 1]! << 8) | d[i + 2]!;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/**
 * 가중 median-cut (OKLab). 빈도 가중 평균을 대표색으로 쓰되, 그 상자에서 가장 흔한 **실제 색**으로 맞춘다 —
 * 칩셋에 없는 중간색을 만들지 않으려고.
 */
export function medianCutPalette(img: Rgba, max: number, options: { step?: number; exclude?: (lab: Lab) => boolean } = {}): Rgb[] {
  type Entry = { rgb: Rgb; lab: Lab; n: number };
  const entries: Entry[] = [];
  for (const [key, n] of histogram(img, options.step ?? 1)) {
    const rgb: Rgb = [(key >> 16) & 255, (key >> 8) & 255, key & 255];
    const lab = oklab(rgb);
    if (options.exclude?.(lab)) continue;
    entries.push({ rgb, lab, n });
  }
  if (entries.length === 0) return [];
  let boxes: Entry[][] = [entries];
  while (boxes.length < max) {
    let best = -1, bestScore = 0, bestAxis = 0;
    boxes.forEach((box, index) => {
      if (box.length < 2) return;
      const total = box.reduce((s, e) => s + e.n, 0);
      for (let axis = 0; axis < 3; axis += 1) {
        let lo = Infinity, hi = -Infinity;
        for (const e of box) { lo = Math.min(lo, e.lab[axis]!); hi = Math.max(hi, e.lab[axis]!); }
        const score = (hi - lo) * Math.sqrt(total);
        if (score > bestScore) { bestScore = score; best = index; bestAxis = axis; }
      }
    });
    if (best < 0) break;
    const box = boxes[best]!.slice().sort((a, b) => a.lab[bestAxis]! - b.lab[bestAxis]!);
    const total = box.reduce((s, e) => s + e.n, 0);
    let acc = 0, cut = 1;
    for (let i = 0; i < box.length - 1; i += 1) { acc += box[i]!.n; if (acc >= total / 2) { cut = i + 1; break; } }
    boxes = [...boxes.slice(0, best), box.slice(0, cut), box.slice(cut), ...boxes.slice(best + 1)];
  }
  return boxes.map((box) => box.reduce((a, b) => (b.n > a.n ? b : a)).rgb);
}

export function nearestIndex(palette: readonly Lab[], lab: Lab): number {
  let best = 0, bestD = Infinity;
  for (let i = 0; i < palette.length; i += 1) {
    const d = dist2(palette[i]!, lab);
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

/** 맵 캡처의 팔레트(칩셋 색). 조명이 적용된 캡처에서 뽑는다 — 밤 장면이면 밤 색이 나온다. */
export function mapPalette(capture: Rgba, max = BACKDROP_MAP_COLORS): Rgb[] {
  return medianCutPalette(capture, max, { step: 1 });
}

// ---------- 도트화 ----------

/** 16:9 가운데 자르기 영역. */
export function centerCrop169(width: number, height: number): { x: number; y: number; w: number; h: number } {
  const target = BACKDROP_NATIVE_WIDTH / BACKDROP_NATIVE_HEIGHT;
  if (width / height > target) { const w = Math.round(height * target); return { x: Math.floor((width - w) / 2), y: 0, w, h: height }; }
  const h = Math.round(width / target);
  return { x: 0, y: Math.floor((height - h) / 2), w: width, h };
}

export type PixelizeResult = {
  readonly native: Rgba;
  readonly palette: readonly string[];
  /** 덧붙인 생성 그림 색(맵 팔레트 밖). */
  readonly extras: readonly string[];
  readonly colors: number;
  readonly cleanedPixels: number;
};

/**
 * 생성 원본 → 320×180 도트. 단계:
 *  1. 16:9 가운데 자르기.
 *  2. 팔레트 = 맵 팔레트(최대 24) + 원본에서 맵 팔레트로 표현이 안 되는 색만 median-cut 으로 최대 8.
 *  3. 원본 전체를 팔레트로 양자화(최근접 OKLab, 디더링 없음).
 *  4. 목표 화소 하나 = 원본 블록의 가운데 70% 에서 **가장 흔한 팔레트 색**(평균이 아니다 → 중간색·흐림 없음).
 *  5. 잔점 청소(2회): 같은 색 이웃이 1개 이하(점·두 점)이고 이웃 중 한 색이 5개 이상이면 그 색으로. 1px 선(이웃 2개)은 남는다.
 *  6. 거의 안 쓰인 색(0.05% 미만)을 지우고 최근접으로 다시 매핑.
 */
export function pixelizeBackdrop(raw: Rgba, mapColors: readonly Rgb[], options: { maxColors?: number; extraColors?: number } = {}): PixelizeResult {
  const W = BACKDROP_NATIVE_WIDTH, H = BACKDROP_NATIVE_HEIGHT;
  const crop = centerCrop169(raw.width, raw.height);
  const extraMax = options.extraColors ?? BACKDROP_EXTRA_COLORS;
  const maxColors = options.maxColors ?? BACKDROP_MAX_COLORS;
  const mapLab = mapColors.map(oklab);
  // 2. 맵 팔레트로 멀리 떨어진 원본 색만 덧붙인다.
  const cropped = cropRgba(raw, crop.x, crop.y, crop.w, crop.h);
  const far = (lab: Lab) => mapLab.length > 0 && Math.min(...mapLab.map((m) => dist2(m, lab))) < 0.06 ** 2;
  const extras = extraMax > 0 ? medianCutPalette(cropped, extraMax, { step: 2, exclude: far }) : [];
  let palette: Rgb[] = [...mapColors, ...extras].slice(0, maxColors);
  if (palette.length === 0) palette = medianCutPalette(cropped, maxColors, { step: 2 });
  let paletteLab = palette.map(oklab);
  // 3. 원본 양자화(색 캐시).
  const cache = new Map<number, number>();
  const quant = new Uint8Array(cropped.width * cropped.height);
  const cd = cropped.data;
  for (let i = 0; i < quant.length; i += 1) {
    const key = (cd[i * 4]! << 16) | (cd[i * 4 + 1]! << 8) | cd[i * 4 + 2]!;
    let idx = cache.get(key);
    if (idx === undefined) { idx = nearestIndex(paletteLab, oklab([cd[i * 4]!, cd[i * 4 + 1]!, cd[i * 4 + 2]!])); cache.set(key, idx); }
    quant[i] = idx;
  }
  // 4. 블록 최빈값.
  let grid = new Uint8Array(W * H);
  const bw = cropped.width / W, bh = cropped.height / H;
  const votes = new Uint32Array(palette.length);
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    votes.fill(0);
    const x0 = Math.floor((x + 0.15) * bw), x1 = Math.max(x0 + 1, Math.ceil((x + 0.85) * bw));
    const y0 = Math.floor((y + 0.15) * bh), y1 = Math.max(y0 + 1, Math.ceil((y + 0.85) * bh));
    for (let yy = y0; yy < Math.min(y1, cropped.height); yy += 1) for (let xx = x0; xx < Math.min(x1, cropped.width); xx += 1) votes[quant[yy * cropped.width + xx]!]! += 1;
    let best = 0;
    for (let i = 1; i < votes.length; i += 1) if (votes[i]! > votes[best]!) best = i;
    grid[y * W + x] = best;
  }
  // 5. 잔점(돌바닥 결이 양자화되면 바닥이 지글거린다 — 2026-10-30 옥좌의 방 시범 판).
  let cleaned = 0;
  for (let pass = 0; pass < 2; pass += 1) {
  const next = grid.slice();
  for (let y = 1; y < H - 1; y += 1) for (let x = 1; x < W - 1; x += 1) {
    const c = grid[y * W + x]!;
    const local = new Map<number, number>();
    let same = 0;
    for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
      if (!dx && !dy) continue;
      const n = grid[(y + dy) * W + x + dx]!;
      if (n === c) same += 1;
      local.set(n, (local.get(n) ?? 0) + 1);
    }
    if (same > 1) continue;
    let major = -1, majorN = 0;
    for (const [k, n] of local) if (n > majorN) { majorN = n; major = k; }
    if (majorN >= 5) { next[y * W + x] = major; cleaned += 1; }
  }
  grid = next;
  }
  // 6. 드문 색 지우기.
  const usage = new Uint32Array(palette.length);
  for (const v of grid) usage[v]! += 1;
  const keep = palette.map((_, i) => usage[i]! >= W * H * 0.0005);
  if (keep.some((k) => !k) && keep.some(Boolean)) {
    const keptIdx = palette.map((_, i) => i).filter((i) => keep[i]);
    const remap = palette.map((_, i) => keep[i] ? i : keptIdx[nearestIndex(keptIdx.map((k) => paletteLab[k]!), paletteLab[i]!)]!);
    grid = grid.map((v) => remap[v]!);
  }
  const used = [...new Set(grid)].sort((a, b) => a - b);
  const data = new Uint8Array(W * H * 4);
  for (let i = 0; i < grid.length; i += 1) {
    const c = palette[grid[i]!]!;
    data[i * 4] = c[0]; data[i * 4 + 1] = c[1]; data[i * 4 + 2] = c[2]; data[i * 4 + 3] = 255;
  }
  paletteLab = [];
  const extraHex = new Set(extras.map(rgbToHex));
  return {
    native: { width: W, height: H, data },
    palette: used.map((i) => rgbToHex(palette[i]!)),
    extras: used.map((i) => rgbToHex(palette[i]!)).filter((h) => extraHex.has(h)),
    colors: used.length,
    cleanedPixels: cleaned,
  };
}

export function cropRgba(img: Rgba, x: number, y: number, w: number, h: number): Rgba {
  const data = new Uint8Array(w * h * 4);
  for (let row = 0; row < h; row += 1) {
    const src = ((y + row) * img.width + x) * 4;
    data.set(img.data.subarray(src, src + w * 4), row * w * 4);
  }
  return { width: w, height: h, data };
}

export function scaleNearest(img: Rgba, k: number): Rgba {
  const w = img.width * k, h = img.height * k;
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
    const s = (Math.floor(y / k) * img.width + Math.floor(x / k)) * 4, d = (y * w + x) * 4;
    data[d] = img.data[s]!; data[d + 1] = img.data[s + 1]!; data[d + 2] = img.data[s + 2]!; data[d + 3] = img.data[s + 3]!;
  }
  return { width: w, height: h, data };
}

/** 영역 평균 밝기 0..1. */
export function meanLuma(img: Rgba, y0 = 0, y1 = img.height): number {
  let sum = 0, n = 0;
  for (let y = y0; y < y1; y += 1) for (let x = 0; x < img.width; x += 1) {
    const i = (y * img.width + x) * 4;
    if (img.data[i + 3]! < 128) continue;
    sum += luma([img.data[i]!, img.data[i + 1]!, img.data[i + 2]!]); n += 1;
  }
  return n ? sum / n : 0;
}

/** 이웃과 색이 다른 화소 비율(무늬·물체가 많을수록 높다). */
export function edgeDensity(img: Rgba, y0: number, y1: number): number {
  let edges = 0, n = 0;
  const same = (a: number, b: number) => img.data[a] === img.data[b] && img.data[a + 1] === img.data[b + 1] && img.data[a + 2] === img.data[b + 2];
  for (let y = y0; y < y1 - 1; y += 1) for (let x = 0; x < img.width - 1; x += 1) {
    const i = (y * img.width + x) * 4;
    if (!same(i, i + 4) || !same(i, i + img.width * 4)) edges += 1;
    n += 1;
  }
  return n ? edges / n : 0;
}

export type MachineCheck = { readonly ok: boolean; readonly value: string; readonly rule: string };

/**
 * 기계 검사 — 통과해도 합격이 아니다(사람이 고른다). 기준은 번들 배경 8장 실측(2026-10-30, 320×180 격자):
 * 아래 45% 무늬 밀도 battle-scenery 0.08~0.11 · scarloxy 0.02~0.18(모래만 위쪽 0.13 보다 높음), 위쪽 밝기 동굴 0.22 · 낮 0.50~0.91.
 */
export function backdropMachineChecks(native: Rgba, facts: Pick<BackdropFacts, "timeOfDay" | "light" | "captureLuma" | "indoor">): Record<string, MachineCheck> {
  const colors = new Set<number>();
  for (let i = 0; i < native.data.length; i += 4) colors.add((native.data[i]! << 16) | (native.data[i + 1]! << 8) | native.data[i + 2]!);
  const groundTop = Math.round(native.height * BACKDROP_GROUND_TOP);
  const upper = edgeDensity(native, 0, groundTop);
  const ground = edgeDensity(native, groundTop, native.height);
  const top = meanLuma(native, 0, groundTop);
  const all = meanLuma(native);
  // 밤이라도 불 켠 실내(새벽 편의점)는 밝다 — 어두움을 요구하는 건 야외의 밤이나 정말 어두운 조명뿐.
  const expectDark = facts.light === "dark" || (!facts.indoor && facts.timeOfDay === "night");
  return {
    size: { ok: native.width === BACKDROP_NATIVE_WIDTH && native.height === BACKDROP_NATIVE_HEIGHT, value: `${native.width}×${native.height}`, rule: `정확히 ${BACKDROP_NATIVE_WIDTH}×${BACKDROP_NATIVE_HEIGHT} (저장 ${BACKDROP_STORE_SCALE}배)` },
    colors: { ok: colors.size >= 8 && colors.size <= BACKDROP_MAX_COLORS, value: String(colors.size), rule: `색 8~${BACKDROP_MAX_COLORS}개` },
    groundClear: { ok: ground <= 0.22 && ground <= upper * 1.3 + 0.03, value: `아래 ${ground.toFixed(3)} / 위 ${upper.toFixed(3)}`, rule: `아래 ${Math.round((1 - BACKDROP_GROUND_TOP) * 100)}% 무늬 밀도 ≤0.22, 위쪽×1.3+0.03 이하(번들 배경 8장 모두 통과)` },
    lightMatch: expectDark
      ? { ok: top <= 0.42, value: `위쪽 밝기 ${top.toFixed(2)} (캡처 ${facts.captureLuma.toFixed(2)})`, rule: "밤·어두운 장면: 위쪽 평균 밝기 ≤0.42" }
      : { ok: Math.abs(all - facts.captureLuma) <= 0.25 && all >= 0.18, value: `전체 밝기 ${all.toFixed(2)} (캡처 ${facts.captureLuma.toFixed(2)})`, rule: "밝은 장면: 캡처와 밝기 차 ≤0.25, 0.18 이상" },
  };
}

/** 판정자 질문(그림 1 = 캡처, 그림 2 = 후보 2배). 답은 JSON 한 줄. */
export function backdropJudgePrompt(facts: BackdropFacts): string {
  return [
    "You are a strict QA judge for a JRPG side-view battle background.",
    `Image 1 = top-down map of the place ("${facts.mapName}", ${facts.indoor ? "indoor" : "outdoor"}). Image 2 = candidate battle background (pixel art, shown 2x).`,
    facts.timeCertain ? `Expected time of day: ${facts.timeOfDay}; expected light: ${facts.light}.` : `Expected light: ${facts.light} (time of day is not judged for this indoor place; answer "unclear" if not visible).`,
    "Answer ONLY one line of JSON with these keys:",
    '{"characters":bool (any person, silhouette, animal or monster visible in image 2),',
    ' "text":bool (any letters, numbers, readable sign or logo in image 2),',
    ' "time":"day"|"dusk"|"night"|"unclear" (time of day image 2 shows; for an indoor room judge windows and light),',
    ' "samePlace":bool (image 2 plausibly shows the same kind of place as image 1),',
    ' "sideView":bool (image 2 is a side/eye-level view, not top-down),',
    ' "groundClear":bool (lower ~45% of image 2 is open floor where characters can stand),',
    ' "pixelArt":bool (reads as crisp pixel art, not a smooth painting or photo),',
    ' "notes":"one short sentence"}',
  ].join("\n");
}

export type JudgeVerdict = {
  readonly characters: boolean; readonly text: boolean; readonly time: TimeOfDay | "unclear";
  readonly samePlace: boolean; readonly sideView: boolean; readonly groundClear: boolean; readonly pixelArt: boolean; readonly notes: string;
};

export function parseJudgeVerdict(raw: string): JudgeVerdict | null {
  const m = /\{[\s\S]*\}/u.exec(raw);
  if (!m) return null;
  try {
    const v = JSON.parse(m[0]) as Record<string, unknown>;
    const bool = (k: string) => typeof v[k] === "boolean" ? v[k] as boolean : null;
    const keys = ["characters", "text", "samePlace", "sideView", "groundClear", "pixelArt"] as const;
    if (keys.some((k) => bool(k) === null)) return null;
    const time = v.time === "day" || v.time === "dusk" || v.time === "night" ? v.time : "unclear";
    return { characters: v.characters as boolean, text: v.text as boolean, time, samePlace: v.samePlace as boolean, sideView: v.sideView as boolean, groundClear: v.groundClear as boolean, pixelArt: v.pixelArt as boolean, notes: String(v.notes ?? "") };
  } catch { return null; }
}

/** 판정자 결과의 합격 조건(기계 검사의 일부 — 사람 선택을 대신하지 않는다). */
export function judgeFindings(verdict: JudgeVerdict, facts: Pick<BackdropFacts, "timeOfDay" | "timeCertain">): string[] {
  const out: string[] = [];
  if (verdict.characters) out.push("인물·동물이 보인다");
  if (verdict.text) out.push("글자가 보인다");
  if (facts.timeCertain && verdict.time !== facts.timeOfDay) out.push(`시간이 다르다(기대 ${facts.timeOfDay}, 판정 ${verdict.time})`);
  if (!verdict.samePlace) out.push("같은 장소로 안 읽힌다");
  if (!verdict.sideView) out.push("측면 시점이 아니다");
  if (!verdict.groundClear) out.push("아래 띠가 비어 있지 않다");
  if (!verdict.pixelArt) out.push("도트로 안 읽힌다");
  return out;
}

type LooseRecord = { readonly [key: string]: unknown };
const isRecord = (v: unknown): v is LooseRecord => typeof v === "object" && v !== null;

/**
 * 트룹을 부르는 전투 명령(battleProcessing)이 있는 맵과, 그 페이지에서 전투 전까지 나온 대사.
 * 선택지 가지(options[].branch)·조건 가지 안까지 찾는다. 대사는 시간 낱말(「새벽 2시」) 근거로 쓴다.
 */
export function findBattleSites(project: { readonly maps?: unknown }, troopId: string): { mapId: string; eventName: string; texts: string[] }[] {
  const out: { mapId: string; eventName: string; texts: string[] }[] = [];
  const maps = isRecord(project.maps) ? Object.values(project.maps) : [];
  for (const map of maps) {
    if (!isRecord(map) || typeof map.id !== "string" || !Array.isArray(map.events)) continue;
    for (const event of map.events) {
      if (!isRecord(event) || !Array.isArray(event.pages)) continue;
      for (const page of event.pages) {
        if (!isRecord(page) || !Array.isArray(page.commands)) continue;
        const texts: string[] = [];
        let found = false;
        const walk = (commands: readonly unknown[]): void => {
          for (const command of commands) {
            if (found || !isRecord(command)) return;
            if (command.kind === "text" && typeof command.body === "string") texts.push(command.body);
            if (command.kind === "battleProcessing" && command.troopId === troopId) { found = true; return; }
            for (const value of Object.values(command)) {
              if (!Array.isArray(value)) continue;
              if (value.some((v) => isRecord(v) && "kind" in v)) walk(value);
              else for (const v of value) if (isRecord(v) && Array.isArray(v.branch)) walk(v.branch);
            }
          }
        };
        walk(page.commands);
        if (found) out.push({ mapId: map.id, eventName: typeof event.name === "string" ? event.name : "", texts });
      }
    }
  }
  return out;
}
