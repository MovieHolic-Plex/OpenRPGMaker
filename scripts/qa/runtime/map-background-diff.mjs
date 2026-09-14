// 맵 배경 QA 샷 비교 — 배경이 (1) 비어 있는 칸에 그려지고 (2) 타일 깔린 칸은 건드리지
// 않으며 (3) 스크롤로 실제로 움직이는지 픽셀로 잰다. 눈으로 보는 것과 별개로 수치를 남긴다.
//
// 사용:
//   node scripts/qa/runtime/map-background-diff.mjs <controlDir> <onDir>
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PNG } from "pngjs";
/** 하늘 위쪽 — 구름만 있고 NPC 가 지나가지 않는 띠. */
const CLOUD_BAND = { y0: 15, y1: 110 };

/** 플레이 무대 안쪽만 본다 — 바깥은 레터박스(검정)라 판정에 노이즈다. */
const SKY_BAND = { x0: 120, x1: 900, y0: 60, y1: 200 };

/**
 * 플레이 무대 좌우 가장자리(레터박스 안쪽). 배율 0.5 에서 화면 고정 배경이 덮지 못하면
 * 여기가 플레이 카메라의 검은 배경이 된다. 무대 사각은 뷰포트 1024×768 에서 고정이다.
 */
const EDGE_STRIPS = [
  { x0: 44, x1: 150, y0: 300, y1: 500 },
  { x0: 872, x1: 978, y0: 300, y1: 500 },
];

/** 띠들 안에서 「카메라 배경색(#000)」 픽셀의 비율. */
function blackRatio(png, strips) {
  let black = 0;
  let n = 0;
  for (const box of strips) {
    for (let y = box.y0; y < box.y1; y += 1) {
      for (let x = box.x0; x < box.x1; x += 1) {
        const i = (y * png.width + x) * 4;
        const max = Math.max(png.data[i], png.data[i + 1], png.data[i + 2]);
        if (max < 16) black += 1;
        n += 1;
      }
    }
  }
  return Number((black / n).toFixed(4));
}
const TILE_BAND = { x0: 120, x1: 900, y0: 420, y1: 620 };

function load(path) {
  return PNG.sync.read(readFileSync(path));
}

function meanRgb(png, box) {
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let y = box.y0; y < box.y1; y += 1) {
    for (let x = box.x0; x < box.x1; x += 1) {
      const i = (y * png.width + x) * 4;
      r += png.data[i];
      g += png.data[i + 1];
      b += png.data[i + 2];
      n += 1;
    }
  }
  return [r / n, g / n, b / n].map((value) => Math.round(value));
}

function diffRatio(a, b, box) {
  let differing = 0;
  let n = 0;
  for (let y = box.y0; y < box.y1; y += 1) {
    for (let x = box.x0; x < box.x1; x += 1) {
      const i = (y * a.width + x) * 4;
      n += 1;
      if (
        Math.abs(a.data[i] - b.data[i]) > 8
        || Math.abs(a.data[i + 1] - b.data[i + 1]) > 8
        || Math.abs(a.data[i + 2] - b.data[i + 2]) > 8
      ) {
        differing += 1;
      }
    }
  }
  return differing / n;
}

/**
 * 두 샷을 가장 잘 맞추는 수평 이동(px). **한 행이 아니라 띠의 세로 합 프로파일**로 잰다 —
 * 하늘은 대부분 단색이라 한 행만 보면 상관이 잡음에 끌려 아무 값이나 최소가 된다(실측:
 * 같은 샷에서 -246px 과 -900px 이 둘 다 나왔다). 구름이 만드는 열 방향 밝기 분포가 신호다.
 */
function bestShift(a, b, band, maxShift) {
  const profile = (png) => {
    const out = [];
    for (let x = 0; x < png.width; x += 1) {
      let sum = 0;
      for (let y = band.y0; y < band.y1; y += 1) {
        const i = (y * png.width + x) * 4;
        sum += png.data[i] + png.data[i + 1] + png.data[i + 2];
      }
      out.push(sum / (band.y1 - band.y0));
    }
    return out;
  };
  const pa = profile(a);
  const pb = profile(b);
  let best = { shift: 0, error: Number.POSITIVE_INFINITY, runnerUp: Number.POSITIVE_INFINITY };
  const errors = [];
  for (let shift = -maxShift; shift <= maxShift; shift += 1) {
    let error = 0;
    let n = 0;
    for (let x = 200; x < 824; x += 2) {
      const j = x + shift;
      if (j < 0 || j >= pb.length) continue;
      error += Math.abs(pa[x] - pb[j]);
      n += 1;
    }
    if (n === 0) continue;
    const normalized = error / n;
    errors.push({ shift, error: normalized });
    if (normalized < best.error) best = { shift, error: normalized, runnerUp: best.error };
  }
  // 중앙값 대비 얼마나 뾰족한가 — 평평하면 그 이동량은 우연이다.
  const sorted = errors.map((entry) => entry.error).sort((left, right) => left - right);
  const median = sorted[Math.floor(sorted.length / 2)] ?? Number.NaN;
  return { shift: best.shift, error: Number(best.error.toFixed(2)), medianError: Number(median.toFixed(2)) };
}

const [controlDir, onDir, zoomDir] = process.argv.slice(2);
if (!controlDir || !onDir) throw new Error("사용: map-background-diff.mjs <controlDir> <onDir> [zoomDir]");

/** 샷 파일명은 비트 id 에서 나온다 — 이름을 박아 두면 비트를 고칠 때마다 여기가 깨진다. */
function shot(dir, prefix) {
  const name = readdirSync(dir).filter((entry) => entry.startsWith(`${prefix}-`) && entry.endsWith(".png")).sort();
  if (name.length === 0) throw new Error(`${dir} 에 ${prefix}-*.png 샷이 없습니다`);
  return load(join(dir, name[0]));
}

const controlFirst = shot(controlDir, "02");
const onFirst = shot(onDir, "02");
const onScroll = shot(onDir, "03");

console.log(JSON.stringify({
  skyBand: {
    controlMeanRgb: meanRgb(controlFirst, SKY_BAND),
    backgroundMeanRgb: meanRgb(onFirst, SKY_BAND),
  },
  skyBandDiffControlVsBackground: Number(diffRatio(controlFirst, onFirst, SKY_BAND).toFixed(4)),
  // 타일이 깔린 띠는 배경 저작 여부와 무관해야 한다(= 배경이 타일을 덮지 않는다).
  tileBandDiffControlVsBackground: Number(diffRatio(controlFirst, onFirst, TILE_BAND).toFixed(4)),
  skyBandDiffBeforeAfterScroll: Number(diffRatio(onFirst, onScroll, SKY_BAND).toFixed(4)),
  // 구름만 있는 띠(y 15..110)에서 잰다 — NPC 가 지나가는 아래쪽을 넣으면 이동량이 사람에 끌린다.
  // 주기는 파노라마 폭 × 화면 배율(640 × 3 = 1920px)이라 ±900 안에서는 모호하지 않다.
  skyBandShift: bestShift(onFirst, onScroll, CLOUD_BAND, 900),
  // 카메라 배율을 1 이 아닌 값(0.5)으로 돌린 런. 보정이 없으면 화면 고정 배경이 화면보다
  // 작아져 가장자리에 플레이 카메라의 검은 배경이 드러난다 — 그 띠의 검은 비율이 판정이다.
  ...(zoomDir ? { zoomEdgeBlackRatio: blackRatio(shot(zoomDir, "02"), EDGE_STRIPS) } : {}),
}, null, 2));
