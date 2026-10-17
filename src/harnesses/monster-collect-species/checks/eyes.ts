/**
 * 눈 규칙 자동 검사 (DESIGN_RULES_VERSION 4, 2026-10-16 — 사용자 지적 「몬스터에 문제가 많다, 눈이라던가」→「하이라이트 없이 어두운 눈은 징그럽다, 귀여운 걸로」).
 *
 * 64px 캔버스에서 눈이 읽히려면 최소한 이만큼은 있어야 한다:
 *  - 눈 영역(어두운 눈동자 덩어리)이 3×3 화소 이상, 9×9 이하, 덩어리가 꽉 차 있다(막대·선·번짐이 아니다)
 *  - 눈동자 안에 1화소 이상 **흰 하이라이트**(L≥0.85 이고 눈동자보다 0.5 이상 밝은 점, 판본 4 격상) — 없으면 앞모습 후보 탈락. 어두운 구슬눈은 징그럽다.
 *  - 1~2단계는 눈동자가 더 커야 귀엽다: 면적 ≥12 (3단계는 9)
 *  - 눈동자가 윤곽선(실루엣 가장자리 줄)과 한 덩어리로 합쳐지지 않았다 (합쳐지면 얼굴 윤곽에 뭉개진 점으로 보인다)
 *  - 두 눈이 보이면 크기가 크게 어긋나지 않는다(좌우 대칭 허용 오차)
 *  - 뒷모습에는 눈이 보이지 않는다 (눈 모양 + 하이라이트가 잡히면 경고)
 *
 * 이 검사는 「눈 후보 탐지」다. 눈이 자연스럽고 생기 있는지는 판정 모델이 그림을 보고 정한다 — 통과가 합격이 아니다.
 * 실패한 앞모습 후보는 시트에 「눈 규칙 탈락」으로 표시하고 판정 대상에서 뺀다(후보가 모자라면 더 뽑는다).
 */
import { isOpaque, pixelAt, type Box, type RgbaImage } from "../pixel/image";
import { oklabCached } from "../pixel/oklab";
import type { CheckIssue } from "./checks";

export const EYE_RULES = {
  /** 눈동자 덩어리 상자 하한/상한 (화소) */
  minSide: 3,
  maxSide: 9,
  /** 상자 안 어두운 화소 비율 하한 (하이라이트 구멍이 있어도 통과하도록 낮게) */
  minFill: 0.55,
  /** 어두운 화소 기준 OKLab L */
  darkL: 0.4,
  /** 하이라이트 = 눈동자 평균 L 보다 이만큼 밝은 화소 */
  highlightGain: 0.5,
  /** 하이라이트 최소 밝기(OKLab L) — 연갈색·노랑 같은 「살짝 밝은 점」은 흰 반짝임이 아니다 */
  highlightMinL: 0.85,
  /** 하이라이트는 흰색에 가까워야 한다(OKLab 채도 ≤ 이 값). 연갈색·크림 살갗(채도 0.06~0.09)은 반짝임이 아니다 */
  highlightMaxChroma: 0.055,
  /** 두 눈 면적비 하한 (3/4 시점은 먼 쪽 눈이 작으므로 느슨) */
  symmetryMinRatio: 0.4,
  /** 두 눈으로 보는 y 차 */
  pairDy: 3,
  /** 눈 둘레 고리에서 「눈동자보다 이만큼 밝은 살갗」 화소 비율 하한 */
  minSurround: 0.5,
  /** 앞모습 주 눈 면적 하한(3×3) · 둘째 눈 하한 · 뒷모습 경고 하한 */
  minPrimaryArea: 9,
  /** 1~2단계 앞모습 주 눈 면적 하한 (귀여움: 큰 눈) */
  minPrimaryAreaCute: 12,
  minSecondArea: 5,
  backEyeArea: 12,
  skinGain: 0.25,
} as const;

export type Eye = {
  box: Box;
  /** 어두운 화소 수 */
  area: number;
  /** 하이라이트 화소 수 */
  highlights: number;
  /** 눈동자 평균 OKLab L */
  pupilL: number;
  /** 윤곽선 줄과 8방향으로 붙어 있는가 */
  touchesOutline: boolean;
};

export type EyeReport = {
  /** 규칙을 모두 만족한 눈 */
  eyes: Eye[];
  /** 크기·밀도는 되지만 하이라이트가 없는 후보(생기 없음) */
  dull: Eye[];
  /** 윤곽에 붙어 뭉개진 후보 */
  merged: Eye[];
};

const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
const N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] as const;

function lightness(image: RgbaImage, x: number, y: number): number {
  const p = pixelAt(image, x, y);
  return oklabCached(p[0], p[1], p[2])[0];
}

export function detectEyes(image: RgbaImage): EyeReport {
  const { width, height } = image;
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height;
  // 윤곽 줄: 투명(또는 캔버스 밖)과 8방향으로 닿은 불투명 화소
  const ring = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!isOpaque(image, x, y)) continue;
      for (const [ox, oy] of N8) {
        if (!inside(x + ox, y + oy) || !isOpaque(image, x + ox, y + oy)) {
          ring[y * width + x] = 1;
          break;
        }
      }
    }
  }
  const dark = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (isOpaque(image, x, y) && !ring[y * width + x] && lightness(image, x, y) < EYE_RULES.darkL) dark[y * width + x] = 1;
    }
  }
  const seen = new Uint8Array(width * height);
  const report: EyeReport = { eyes: [], dull: [], merged: [] };
  for (let sy = 0; sy < height; sy += 1) {
    for (let sx = 0; sx < width; sx += 1) {
      const start = sy * width + sx;
      if (!dark[start] || seen[start]) continue;
      const cells: [number, number][] = [];
      const stack: [number, number][] = [[sx, sy]];
      seen[start] = 1;
      while (stack.length > 0) {
        const [x, y] = stack.pop()!;
        cells.push([x, y]);
        for (const [ox, oy] of N4) {
          const nx = x + ox;
          const ny = y + oy;
          if (!inside(nx, ny) || !dark[ny * width + nx] || seen[ny * width + nx]) continue;
          seen[ny * width + nx] = 1;
          stack.push([nx, ny]);
        }
      }
      let minX = width, minY = height, maxX = -1, maxY = -1, sumL = 0;
      for (const [x, y] of cells) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        sumL += lightness(image, x, y);
      }
      const box: Box = { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
      if (box.width < EYE_RULES.minSide || box.height < EYE_RULES.minSide) continue;
      if (box.width > EYE_RULES.maxSide || box.height > EYE_RULES.maxSide) continue;
      if (cells.length / (box.width * box.height) < EYE_RULES.minFill) continue;
      const pupilL = sumL / cells.length;
      const ratio = box.width / box.height;
      if (ratio < 0.5 || ratio > 2) continue;
      // 하이라이트: 상자 안(눈동자에 둘러싸인) 밝은 화소 — 어두운 4방향 이웃이 2개 이상
      let highlights = 0;
      for (let y = box.y; y < box.y + box.height; y += 1) {
        for (let x = box.x; x < box.x + box.width; x += 1) {
          if (!isOpaque(image, x, y) || dark[y * width + x]) continue;
          const p = pixelAt(image, x, y);
          const lab = oklabCached(p[0], p[1], p[2]);
          if (lab[0] < Math.max(EYE_RULES.highlightMinL, pupilL + EYE_RULES.highlightGain)) continue;
          if (Math.hypot(lab[1], lab[2]) > EYE_RULES.highlightMaxChroma) continue;
          let touching = 0;
          for (const [ox, oy] of N4) if (inside(x + ox, y + oy) && dark[(y + oy) * width + x + ox]) touching += 1;
          if (touching >= 2) highlights += 1;
        }
      }
      // 눈은 밝은 얼굴 살갗 위에 있다: 상자 둘레 한 칸 고리의 절반 이상이 눈동자보다 훨씬 밝은 불투명 화소여야 한다.
      // (몸 가장자리·어두운 바위·코일 줄무늬의 어두운 덩어리를 눈으로 오인하지 않게 한다.)
      let ringTotal = 0;
      let ringLight = 0;
      for (let y = box.y - 1; y <= box.y + box.height; y += 1) {
        for (let x = box.x - 1; x <= box.x + box.width; x += 1) {
          if (x >= box.x && x < box.x + box.width && y >= box.y && y < box.y + box.height) continue;
          ringTotal += 1;
          if (inside(x, y) && isOpaque(image, x, y) && !dark[y * width + x] && lightness(image, x, y) >= pupilL + EYE_RULES.skinGain) ringLight += 1;
        }
      }
      const surrounded = ringLight / ringTotal >= EYE_RULES.minSurround;
      if (!surrounded) {
        // 윤곽선에 붙은 덩어리만 「뭉개짐」으로 기록, 나머지는 눈이 아니다
        let nearRing = false;
        for (const [x, y] of cells) for (const [ox, oy] of N8) if (inside(x + ox, y + oy) && ring[(y + oy) * width + x + ox] && lightness(image, x + ox, y + oy) < EYE_RULES.darkL) nearRing = true;
        if (nearRing) report.merged.push({ box, area: cells.length, highlights, pupilL, touchesOutline: true });
        continue;
      }
      const touchesOutline = false;
      const eye: Eye = { box, area: cells.length, highlights, pupilL, touchesOutline };
      if (highlights < 1) report.dull.push(eye);
      else report.eyes.push(eye);
    }
  }
  return report;
}

export type EyeVerdict = {
  /** 앞모습: 주 눈(면적 ≥ 12(1~2단계)/9, 흰 하이라이트, 살갗에 둘러싸임)이 있다. 뒷모습: 눈 모양이 없다. */
  pass: boolean;
  /** 앞모습: 주 눈 곁 같은 높이에 두 번째 눈(면적 ≥ minSecondArea)이 보인다 */
  pair: boolean;
  primary?: Eye;
  report: EyeReport;
  issues: CheckIssue[];
};

/**
 * 규칙 판정. 앞모습은 주 눈이 있어야 통과(탈락 = 판정 대상에서 뺀다), 두 눈은 「확인」으로만 기록(3/4 시점에서 먼 눈이 정당하게 가려질 수 있다).
 * 뒷모습은 큰 눈 모양(면적 12 이상)이 잡히면 경고. 화소 규칙은 필요조건일 뿐이다 — 눈의 자연스러움은 판정 모델이 본다.
 */
export function checkEyes(image: RgbaImage, side: "front" | "back", stage: 1 | 2 | 3 = 1): EyeVerdict {
  const report = detectEyes(image);
  const issues: CheckIssue[] = [];
  if (side === "back") {
    const big = report.eyes.filter((e) => e.area >= EYE_RULES.backEyeArea);
    if (big.length > 0) issues.push({ level: "warn", message: `뒷모습에 눈처럼 보이는 점 ${big.length}개 — 뒷모습에는 눈이 보이면 안 된다` });
    return { pass: big.length === 0, pair: false, report, issues };
  }
  const sorted = [...report.eyes].sort((a, b) => b.area - a.area);
  const minArea = stage <= 2 ? EYE_RULES.minPrimaryAreaCute : EYE_RULES.minPrimaryArea;
  const primary = sorted.find((e) => e.area >= minArea);
  if (!primary) {
    const why = report.dull.length > 0
      ? "눈동자 덩어리는 있으나 흰 하이라이트가 없다 — 어두운 구슬눈(징그러움)"
      : report.merged.length > 0
        ? "눈동자가 윤곽선에 붙어 뭉개졌다"
        : `눈 후보를 찾지 못했다 (눈동자 ${EYE_RULES.minSide}×${EYE_RULES.minSide} 이상 + 하이라이트 1화소, 밝은 얼굴 위)`;
    issues.push({ level: "error", message: `눈 규칙 탈락: ${why}` });
    return { pass: false, pair: false, report, issues };
  }
  const withDull = [...sorted, ...report.dull].sort((a, b) => b.area - a.area);
  const second = withDull.find((e) => e !== primary && e.area >= EYE_RULES.minSecondArea && Math.abs(e.box.y - primary.box.y) <= EYE_RULES.pairDy && Math.abs(e.box.x - primary.box.x) <= 22);
  if (!second) issues.push({ level: "warn", message: "두 번째 눈이 확인되지 않는다 (한 눈만 보인다)" });
  else if (second.area / primary.area < EYE_RULES.symmetryMinRatio) issues.push({ level: "warn", message: `두 눈 크기가 크게 다르다 (${primary.area} vs ${second.area})` });
  return { pass: true, pair: Boolean(second), primary, report, issues };
}
