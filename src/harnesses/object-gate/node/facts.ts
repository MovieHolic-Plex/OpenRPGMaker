/**
 * 판정자에게 주는 「정확한 측정」 — 2026-10-14 Sonnet 5.5 판정자용.
 * 그림(확대본)을 눈으로 세는 것은 ±1행씩 흔들려 4행 기준(윗면·아가리)을 못 가른다. 같은 화소에서 결정적으로 뽑은 숫자를 글로 함께 준다.
 * 판정 규칙은 이 숫자를 직접 읽지 않는다 — 판정자가 읽고 답한다(통과 근거는 여전히 판정자의 답 + rules.ts 규칙).
 * FACTS_VERSION 은 프로필 해시에 들어간다(알고리즘을 바꾸면 올린다).
 */
export const FACTS_VERSION = 2;

type Img = { width: number; height: number; data: Uint8Array };
const lum = (r: number, g: number, b: number) => Math.round(0.299 * r + 0.587 * g + 0.114 * b);
const hex = (r: number, g: number, b: number) => `#${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')}`;

/** 가운데 세로줄(몸통 폭의 25·50·75%)을 위에서 아래로 훑어 같은 밝기대 덩어리(run)로 묶은 표. 행 번호는 그림 왼쪽 눈금과 같은 원본 행. */
export function columnScan({ width, height, data }: Img): string {
  let x0 = width, x1 = -1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (data[(y * width + x) * 4 + 3]! >= 128) { if (x < x0) x0 = x; if (x > x1) x1 = x; }
  if (x1 < 0) return 'EXACT COLUMN SCAN: (empty image)';
  const lines: string[] = ['EXACT COLUMN SCAN (computed from the pixels, not an estimate). Each line is one run of consecutive opaque rows with similar lightness L (0-255): "rows a-b (n rows) L=mean #hex-of-first-row". "gap" = transparent rows. Row numbers are the source-pixel rows printed on the left ruler of image 1.'];
  const cols = [...new Set([0.25, 0.5, 0.75].map(f => Math.round(x0 + (x1 - x0) * f)))];
  for (const x of cols) {
    const runs: string[] = [];
    let start = -1, sum = 0, n = 0, first = '';
    const flush = (end: number) => { if (n) runs.push(`rows ${start}-${end} (${n}) L=${Math.round(sum / n)} ${first}`); start = -1; sum = 0; n = 0; };
    for (let y = 0; y < height; y++) {
      const i = (y * width + x) * 4;
      if (data[i + 3]! < 128) { if (n) { flush(y - 1); runs.push('gap'); } else if (runs[runs.length - 1] !== 'gap' && runs.length) runs.push('gap'); continue; }
      const L = lum(data[i]!, data[i + 1]!, data[i + 2]!);
      if (n && Math.abs(L - sum / n) > 18) flush(y - 1);
      if (!n) { start = y; first = hex(data[i]!, data[i + 1]!, data[i + 2]!); }
      sum += L; n++;
    }
    flush(height - 1);
    const clean = runs.filter((r, k) => !(r === 'gap' && (k === 0 || runs[k - 1] === 'gap' || k === runs.length - 1)));
    lines.push(`column x=${x} (${Math.round(((x - x0) / Math.max(1, x1 - x0)) * 100)}% of body width): ${clean.slice(0, 22).join(' | ')}${clean.length > 22 ? ' | …' : ''}`);
  }
  return lines.join('\n');
}

export type StyleFacts = { tileColorsMedian: number; flatFill: number; neutralEdge: number; distinctColors: number; opaquePixels: number; visibleTonesMedian: number; nearFlatFill: number };

/** 화풍 측정: 16px 칸당 고유색 중앙값 · 같은 색 5×5 평면 채움이 덮는 비율 · 어두운 가장자리 화소 중 거의 무채색(채도 ≤12)인 비율 · 고유색 수. */
export function styleFacts({ width, height, data }: Img): StyleFacts {
  const a = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height && data[(y * width + x) * 4 + 3]! >= 128;
  const key = (x: number, y: number) => (data[(y * width + x) * 4]! << 16) | (data[(y * width + x) * 4 + 1]! << 8) | data[(y * width + x) * 4 + 2]!;
  const counts: number[] = [];
  for (let ty = 0; ty < height; ty += 16) for (let tx = 0; tx < width; tx += 16) {
    const set = new Set<number>(); let op = 0;
    for (let y = ty; y < Math.min(height, ty + 16); y++) for (let x = tx; x < Math.min(width, tx + 16); x++) if (a(x, y)) { op++; set.add(key(x, y)); }
    if (op >= 128) counts.push(set.size);
  }
  counts.sort((p, q) => p - q);
  // 규칙 v9(화풍 측정 v3): 보이는 색조 — 채널마다 16단(>>4)으로 묶은 색 수. 버들항 풀·나무는 눈에 같은 색인 거의 같은 초록 수십 개로 원색 수가 부풀어 있다(풀 칸 원색 26 → 보이는 색조 3).
  const bin = (x: number, y: number) => ((data[(y * width + x) * 4]! >> 4) << 8) | ((data[(y * width + x) * 4 + 1]! >> 4) << 4) | (data[(y * width + x) * 4 + 2]! >> 4);
  const tones: number[] = [];
  for (let ty = 0; ty < height; ty += 16) for (let tx = 0; tx < width; tx += 16) {
    const set = new Set<number>(); let op = 0;
    for (let y = ty; y < Math.min(height, ty + 16); y++) for (let x = tx; x < Math.min(width, tx + 16); x++) if (a(x, y)) { op++; set.add(bin(x, y)); }
    if (op >= 128) tones.push(set.size);
  }
  tones.sort((p, q) => p - q);
  const nearFlat = new Uint8Array(width * height);
  for (let y = 0; y + 4 < height; y++) for (let x = 0; x + 4 < width; x++) {
    if (!a(x, y)) continue; const k = bin(x, y); let same = true;
    for (let dy = 0; dy < 5 && same; dy++) for (let dx = 0; dx < 5; dx++) if (!a(x + dx, y + dy) || bin(x + dx, y + dy) !== k) { same = false; break; }
    if (same) for (let dy = 0; dy < 5; dy++) for (let dx = 0; dx < 5; dx++) nearFlat[(y + dy) * width + x + dx] = 1;
  }
  let nearFlatN = 0; for (const v of nearFlat) nearFlatN += v;
  const flat = new Uint8Array(width * height); let opaque = 0;
  const all = new Set<number>();
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (a(x, y)) { opaque++; all.add(key(x, y)); }
  for (let y = 0; y + 4 < height; y++) for (let x = 0; x + 4 < width; x++) {
    if (!a(x, y)) continue; const k = key(x, y); let same = true;
    for (let dy = 0; dy < 5 && same; dy++) for (let dx = 0; dx < 5; dx++) if (!a(x + dx, y + dy) || key(x + dx, y + dy) !== k) { same = false; break; }
    if (same) for (let dy = 0; dy < 5; dy++) for (let dx = 0; dx < 5; dx++) flat[(y + dy) * width + x + dx] = 1;
  }
  let flatN = 0; for (const v of flat) flatN += v;
  let edge = 0, neutral = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (!a(x, y) || (a(x - 1, y) && a(x + 1, y) && a(x, y - 1) && a(x, y + 1))) continue;
    if (a(x - 1, y) && a(x + 1, y) && a(x, y - 1) && !a(x, y + 1)) continue; // 맨 아래 가장자리 줄(보통 순흑 접지 그림자)은 윤곽 비율에서 뺀다
    const i = (y * width + x) * 4, r = data[i]!, g = data[i + 1]!, b = data[i + 2]!;
    if (Math.max(r, g, b) >= 110) continue;
    edge++; if (Math.max(r, g, b) - Math.min(r, g, b) <= 12) neutral++;
  }
  return { tileColorsMedian: counts.length ? counts[Math.floor(counts.length / 2)]! : 0, flatFill: opaque ? Math.round((flatN / opaque) * 100) / 100 : 0, neutralEdge: edge ? Math.round((neutral / edge) * 100) / 100 : 0, distinctColors: all.size, opaquePixels: opaque, visibleTonesMedian: tones.length ? tones[Math.floor(tones.length / 2)]! : 0, nearFlatFill: opaque ? Math.round((nearFlatN / opaque) * 100) / 100 : 0 };
}

export const factsLine = (name: string, f: StyleFacts) => `${name}: VISIBLE tones per full 16x16 tile (colours merged to 16 levels per channel)=${f.visibleTonesMedian}, near-flat coverage (5x5 blocks with no visible change)=${Math.round(f.nearFlatFill * 100)}%, near-neutral share of dark edge pixels=${Math.round(f.neutralEdge * 100)}% | raw: distinct colours per tile=${f.tileColorsMedian}, exact 5x5 flat-fill=${Math.round(f.flatFill * 100)}%, distinct colours=${f.distinctColors}`;

/** 행마다 불투명 화소 수(실루엣 폭)를 같은 폭끼리 묶은 표 — 타원 뚜껑·기둥 머리가 「넓어졌다 좁아지는지」를 판정자가 글자로 읽게 한다. */
export function widthProfile({ width, height, data }: Img): string {
  const ws: number[] = [];
  for (let y = 0; y < height; y++) { let n = 0; for (let x = 0; x < width; x++) if (data[(y * width + x) * 4 + 3]! >= 128) n++; ws.push(n); }
  const runs: string[] = []; let s = 0;
  for (let y = 1; y <= height; y++) if (y === height || ws[y] !== ws[s]) { runs.push(y - 1 === s ? `${s}:${ws[s]}` : `${s}-${y - 1}:${ws[s]}`); s = y; }
  return `SILHOUETTE WIDTH BY ROW (opaque pixels per source row, equal neighbours merged; "rows:width"): ${runs.join(' | ')}`;
}
