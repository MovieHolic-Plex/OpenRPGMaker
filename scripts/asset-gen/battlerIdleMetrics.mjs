/**
 * 배틀러 idle 스트립 **선택 계약의 지표**. 단일 정본이다.
 *
 * 왜 별도 모듈인가 — 이 산식이 테스트 안에만 있으면, 프레임 창을 고르는 도구가 계약과
 * **다른 코드로** 점수를 내게 된다. 실측으로 그 대가를 치렀다: 후면 티어 작업에서 파이썬
 * 근사로 고른 창이 실제 패커 출력과 어긋나(hero-04 색 편차 0.087 대 0.125) 리뷰가 두 번
 * "집계가 다른 숫자"를 잡아냈다. 도구와 테스트가 이 파일을 함께 import 하면 그 어긋남이
 * 구조적으로 불가능해진다.
 *
 * 여기 있는 값을 바꾸면 **실린 자산의 판정이 바뀐다.** 임계값을 만지기 전에
 * `openwiki/battler-idle-playbook.md` 의 "상한은 불량 쪽에서 정한다" 절을 읽어라.
 */

/** 계약 상한. 넷 다 상대값이다 — 절대 상한은 이 티어에서 전부 틀린 계약이었다. */
export const CONTRACT = {
  /** 전신 색: 원본에서 2% 이상인 성분의 상대 편차. 불량 0.42(망토)·0.999(재색칠) 쪽에서 정했다. */
  colorRelativeCap: 0.15,
  /** 인접한 **모든** 칸의 최소 변화. `max` 로 재면 한 쌍만 움직여도 통과한다. */
  minAdjacentChange: 0.02,
  /** 루프 이음매 / 평소 최대 걸음. 절대 상한은 진폭 큰 모션을 부당하게 떨어뜨린다. */
  seamRatioCap: 1.5,
  /** 머리 영역 상대 편차. 불량 1.941(고개 돌림+이물) 쪽에서 정했다. */
  headRelativeCap: 1.0,
  /** 원본에서 이 지분 미만인 성분은 상대 편차 계산에서 제외한다(0 나눗셈·잡음 방지). */
  presenceFloor: 0.02,
  /** 머리 영역 = 피사체 상단 이 비율. 20~35% 에서만 정상·불량이 갈린다(15%·40% 는 못 가른다). */
  headBandFraction: 0.3,
  /** 두 칸이 "달라졌다"고 볼 채널합 차. */
  pixelDiffThreshold: 24,
  /** 알파가 이 값 이하면 배경으로 본다. */
  alphaFloor: 8,
};

/** 색 계열 버킷 이름 — 진단 출력에서 어느 성분이 튀었는지 말해 주기 위해 필요하다. */
export const BUCKETS = ["blue", "red", "green", "warm", "bright", "dark", "luma"];

/**
 * 한 칸의 픽셀을 색 계열별 비율로 요약한다.
 *
 * 조명·압축에는 둔감하고 **재색칠**에는 민감해야 한다. 색 집합 비교(팔레트 포함 여부)로는
 * 안 잡힌다 — 방패·검에 이미 파란 계열이 있어 튜닉이 갈색으로 바뀌어도 1% 차이로 묻힌다.
 * `green` 버킷이 없으면 녹색 튜닉과 그것을 덮은 갈색 망토가 **둘 다 `warm`** 으로 묻힌다.
 */
export function colorShares(png, cellIndex, cellWidth, cellHeight) {
  return accumulate(png, cellIndex, cellWidth, 0, cellHeight - 1, 0, cellWidth - 1);
}

/** 알파가 있는 픽셀의 경계 상자 — 머리 영역을 피사체 기준으로 잡기 위해 필요하다. */
export function subjectBox(png, cellIndex, cellWidth, cellHeight) {
  let top = cellHeight;
  let bottom = -1;
  let left = cellWidth;
  let right = -1;
  for (let y = 0; y < cellHeight; y += 1) {
    for (let x = 0; x < cellWidth; x += 1) {
      if (png.data[(y * png.width + cellIndex * cellWidth + x) * 4 + 3] > CONTRACT.alphaFloor) {
        if (y < top) top = y;
        if (y > bottom) bottom = y;
        if (x < left) left = x;
        if (x > right) right = x;
      }
    }
  }
  return { top, bottom, left, right };
}

/**
 * **머리 영역만** 같은 버킷으로 잰다(피사체 상단 `headBandFraction`).
 *
 * 전신 지표로는 부족하다 — 한때 실렸던 hero-04 스트립은 고개가 돌아 귀·볼이 보이고 머리띠에
 * 밝은 녹색 이물이 있었는데, 머리가 피사체의 일부라 전신 편차 0.125 로 통과했다. 지분 작은
 * 성분을 놓치던 결함과 **같은 종류가 한 단계 아래에** 또 있었던 것이다.
 *
 * 이것은 "얼굴 검출기"가 아니다. 고개를 돌리면 잡히는 이유는 머리카락 지분이 무너져서이고,
 * 머리색·살색 대비가 약한 배틀러에서는 덜 두드러질 수 있다.
 */
export function headShares(png, cellIndex, cellWidth, cellHeight) {
  const { top, bottom, left, right } = subjectBox(png, cellIndex, cellWidth, cellHeight);
  if (bottom < 0) return new Array(BUCKETS.length).fill(0);
  const headEnd = top + Math.round((bottom - top) * CONTRACT.headBandFraction);
  return accumulate(png, cellIndex, cellWidth, top, headEnd, left, right);
}

function accumulate(png, cellIndex, cellWidth, yStart, yEnd, xStart, xEnd) {
  let blue = 0;
  let red = 0;
  let green = 0;
  let warm = 0;
  let bright = 0;
  let dark = 0;
  let lumaSum = 0;
  let total = 0;
  for (let y = yStart; y <= yEnd; y += 1) {
    for (let x = xStart; x <= xEnd; x += 1) {
      const i = (y * png.width + cellIndex * cellWidth + x) * 4;
      if (png.data[i + 3] <= CONTRACT.alphaFloor) continue;
      const r = png.data[i];
      const g = png.data[i + 1];
      const b = png.data[i + 2];
      total += 1;
      const isBlue = b - r > 30 && b - g > 30;
      const isRed = r - b > 40 && r - g > 25;
      const isGreen = g - r > 12 && g - b > 12;
      if (isBlue) blue += 1;
      else if (isRed) red += 1;
      else if (isGreen) green += 1;
      else if (r - b > 15) warm += 1;
      const mean = (r + g + b) / 3;
      if (mean > 170 && !isBlue && !isRed && !isGreen) bright += 1;
      if (mean < 60) dark += 1;
      lumaSum += 0.299 * r + 0.587 * g + 0.114 * b;
    }
  }
  if (total === 0) return new Array(BUCKETS.length).fill(0);
  return [...[blue, red, green, warm, bright, dark].map((count) => count / total), lumaSum / total / 255];
}

/**
 * 원본에서 **존재감 있는** 성분의 **상대** 변화 최대값.
 *
 * 절대 편차로 재면 지분이 작은 성분이 사라지는 걸 놓친다 — hero-04 는 갈색 망토가 녹색 튜닉을
 * 덮었는데 녹색이 피사체의 8% 라 절반이 덮여도 절대 편차 0.035 로 조용히 통과했다(상대 0.42).
 */
export function relativeDeviation(frame, reference) {
  let worst = 0;
  for (let k = 0; k < reference.length; k += 1) {
    if (reference[k] < CONTRACT.presenceFloor) continue;
    worst = Math.max(worst, Math.abs(frame[k] - reference[k]) / reference[k]);
  }
  return worst;
}

/** 어느 버킷이 최악이었는지까지 돌려준다 — 진단 메시지용. */
export function relativeDeviationDetail(frame, reference) {
  let worst = 0;
  let bucket = null;
  for (let k = 0; k < reference.length; k += 1) {
    if (reference[k] < CONTRACT.presenceFloor) continue;
    const deviation = Math.abs(frame[k] - reference[k]) / reference[k];
    if (deviation > worst) {
      worst = deviation;
      bucket = BUCKETS[k];
    }
  }
  return { deviation: worst, bucket };
}

/** 두 칸의 픽셀 변화 비율. */
export function cellChange(png, a, b, cellWidth, cellHeight) {
  let changed = 0;
  let total = 0;
  for (let y = 0; y < cellHeight; y += 1) {
    for (let x = 0; x < cellWidth; x += 1) {
      const ia = (y * png.width + a * cellWidth + x) * 4;
      const ib = (y * png.width + b * cellWidth + x) * 4;
      total += 1;
      const diff =
        Math.abs(png.data[ia] - png.data[ib]) +
        Math.abs(png.data[ia + 1] - png.data[ib + 1]) +
        Math.abs(png.data[ia + 2] - png.data[ib + 2]) +
        Math.abs(png.data[ia + 3] - png.data[ib + 3]);
      if (diff > CONTRACT.pixelDiffThreshold) changed += 1;
    }
  }
  return total === 0 ? 0 : changed / total;
}

/**
 * **같은 크기 두 장**의 픽셀 변화 비율. `cellChange` 와 같은 임계값을 쓴다.
 *
 * 왜 정본에 두는가 — 창 선택기가 이걸 자체 구현했다가 버그를 냈다. 두 프레임을 폭 2배
 * 이미지에 붙이면서 행 스트라이드를 어긋나게 해, 사전 필터가 **모든 창을 모션 만점**으로
 * 봤다(1509개 중 모션 탈락 0개). 실제 패커에서 0.00% 가 나와서야 드러났다.
 * `test/battlerIdleMetrics.test.ts` 가 "같은 그림끼리는 0" 을 못 박아 재발을 막는다.
 */
export function frameChange(a, b) {
  if (a.width !== b.width || a.height !== b.height) {
    throw new Error(`프레임 크기가 다르다: ${a.width}×${a.height} 대 ${b.width}×${b.height}`);
  }
  let changed = 0;
  let total = 0;
  for (let i = 0; i < a.data.length; i += 4) {
    total += 1;
    const diff =
      Math.abs(a.data[i] - b.data[i]) +
      Math.abs(a.data[i + 1] - b.data[i + 1]) +
      Math.abs(a.data[i + 2] - b.data[i + 2]) +
      Math.abs(a.data[i + 3] - b.data[i + 3]);
    if (diff > CONTRACT.pixelDiffThreshold) changed += 1;
  }
  return total === 0 ? 0 : changed / total;
}

/**
 * 패킹된 스트립을 네 계약으로 채점한다. **전 칸 worst** 로 집계한다.
 *
 * 집계를 여기 한 곳에 둔 이유: 칸 0 만 보거나 vitest 가 처음 보고하는 첫 위반 칸을 쓰면
 * 실린 값이 실제보다 좋아 보인다. **지표마다 따로 봐야 한다** — 섞으면 안 된다:
 *   hero-04 색  칸 0 = 0.069 / 전 칸 worst = 0.092 (상한 0.15)
 *   hero-04 머리 칸 0 = 0.528 / 전 칸 worst = 0.665 (상한 1.0)
 *   옛 결함본 머리 첫 위반 칸 = 1.398(칸 1) / worst = 1.941(칸 4)
 */
export function scoreStrip(strip, reference, cellWidth, cellHeight, frameCount) {
  const referenceBody = colorShares(reference, 0, reference.width, reference.height);
  const referenceHead = headShares(reference, 0, reference.width, reference.height);

  let color = 0;
  let colorBucket = null;
  let colorCell = -1;
  let head = 0;
  let headBucket = null;
  let headCell = -1;
  for (let cell = 0; cell < frameCount; cell += 1) {
    const body = relativeDeviationDetail(colorShares(strip, cell, cellWidth, cellHeight), referenceBody);
    if (body.deviation > color) {
      color = body.deviation;
      colorBucket = body.bucket;
      colorCell = cell;
    }
    const headHit = relativeDeviationDetail(headShares(strip, cell, cellWidth, cellHeight), referenceHead);
    if (headHit.deviation > head) {
      head = headHit.deviation;
      headBucket = headHit.bucket;
      headCell = cell;
    }
  }

  const steps = [];
  for (let cell = 1; cell < frameCount; cell += 1) {
    steps.push(cellChange(strip, cell - 1, cell, cellWidth, cellHeight));
  }
  const seam = cellChange(strip, frameCount - 1, 0, cellWidth, cellHeight);
  const maxStep = Math.max(...steps);
  const minStep = Math.min(...steps);
  const seamRatio = maxStep === 0 ? Infinity : seam / maxStep;

  const failures = [];
  if (color >= CONTRACT.colorRelativeCap) failures.push(`색 ${color.toFixed(3)} (${colorBucket}, 칸${colorCell})`);
  if (minStep < CONTRACT.minAdjacentChange) failures.push(`모션 ${(minStep * 100).toFixed(2)}%`);
  if (seamRatio > CONTRACT.seamRatioCap) failures.push(`이음매비 ${seamRatio.toFixed(2)}`);
  if (head > CONTRACT.headRelativeCap) failures.push(`머리 ${head.toFixed(3)} (${headBucket}, 칸${headCell})`);

  return {
    color,
    colorBucket,
    colorCell,
    head,
    headBucket,
    headCell,
    minStep,
    maxStep,
    seam,
    seamRatio,
    passes: failures.length === 0,
    failures,
  };
}
