// 편집기 높이 페이지(src/project/relief/paged.ts)의 창 덮어쓰기가 전체 굽기와 화소 하나 다르지 않은지 무작위 붓질로 확인한다.
//
//   node_modules/.bin/esbuild scripts/check-relief-pages.mts --bundle --platform=node --format=esm --alias:@=./src --outfile=/tmp/check-relief-pages.mjs && node /tmp/check-relief-pages.mjs [회수=30] [씨앗]
//
// check-relief-window.mts 의 페이지판이다. 편집기(editor/reliefLiveStrips.ts)와 같은 순서로 계획을 세운다:
// 바닥 표면은 제자리에서 바뀌므로 지난 지문 사본을 이전 장면의 바닥으로 넣어 바뀐 칸을 찾는다.
// 매 붓질(또는 바닥 칸 바꾸기·화면 이동)마다 화면 범위의 RGBA·주인 줄·띠(윗면/벽)를 전체 굽기와 견준다. 다르면 종료 코드 1.
import { brushRelief, type ReliefBrushMode } from "@/project/relief/edit";
import { ReliefPagedImage, type ReliefPageView } from "@/project/relief/paged";
import { renderRelief, type ReliefGroundSurface } from "@/project/relief/render";
import { reliefRenderOptions } from "@/project/relief/screen";
import { RELIEF_STYLES } from "@/project/relief/styles";
import type { ReliefData } from "@/project/relief/types";
import { rampCode } from "@/project/relief/walk";
import { planReliefPatch, reliefGrids, reliefImageFromRender, type ReliefScene } from "@/project/relief/window";

let seed = Number(process.argv[3] ?? 7654321);
const rnd = () => { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; return seed / 2 ** 32; };
const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)]!;

/** 칸 지문에 따라 색이 바뀌는 바닥. 편집기 표면처럼 cells·signature 를 제자리에서 고친다. */
function mutableGround(W: number, H: number): ReliefGroundSurface & { signature: number } {
  const cells = new Int32Array(W * H);
  for (let i = 0; i < cells.length; i++) cells[i] = Math.floor(rnd() * 4);
  return { cells, signature: 1, sample(px, py, out, at) {
    const x = Math.floor(px / 16), y = Math.floor(py / 16);
    if (x < 0 || y < 0 || x >= W || y >= H) return false;
    const v = cells[y * W + x]!;
    out[at] = (v * 61 + px) & 255; out[at + 1] = (v * 97 + py) & 255; out[at + 2] = (v * 151) & 255; out[at + 3] = 255;
    return true;
  } };
}

function scene(): ReliefData {
  const W = pick([18, 34, 57, 80]), H = pick([14, 28, 45, 60]);
  const levels = new Array(W * H).fill(0);
  const r: ReliefData = { width: W, height: H, levels };
  const style = pick([undefined, undefined, ...Object.keys(RELIEF_STYLES)]);
  if (style) r.style = style;
  for (let k = 0; k < 3; k++) brushRelief(r, Math.floor(rnd() * W), Math.floor(rnd() * H), "set", { radius: 2 + rnd() * 5, level: 1 + Math.floor(rnd() * 9) });
  if (rnd() < 0.5) {
    const ramps = new Array(W * H).fill(0);
    for (let k = 0; k < 2; k++) {
      const x = 2 + Math.floor(rnd() * (W - 6)), y = 2 + Math.floor(rnd() * (H - 6)), stairs = rnd() < 0.5, w = 2 + Math.floor(rnd() * 3);
      for (let dx = 0; dx < w; dx++) { ramps[y * W + x + dx] = rampCode("n", stairs); levels[y * W + x + dx] = levels[(y - 1) * W + x + dx] ?? 0; }
    }
    if (rnd() < 0.5) { const x = 3 + Math.floor(rnd() * (W - 8)), y = 3 + Math.floor(rnd() * (H - 6)); for (let dx = 0; dx < 3; dx++) ramps[y * W + x + dx] = 9; }
    r.ramps = ramps;
  }
  return r;
}

function parity(image: ReliefPagedImage, s: ReliefScene, view: ReliefPageView): string | null {
  const full = reliefImageFromRender(renderRelief(s.grids.eff, s.opts), image.W, image.H);
  if (image.pad !== full.pad) return `pad ${image.pad} vs ${full.pad}`;
  const x0 = Math.max(0, Math.floor(view.x)), x1 = Math.min(image.PW, Math.ceil(view.x + view.width));
  const y0 = Math.max(0, Math.floor(view.y) + image.pad), y1 = Math.min(image.SH, Math.ceil(view.y + view.height) + image.pad);
  const w = x1 - x0, n = Math.max(0, w * (y1 - y0));
  const owner = new Int16Array(n).fill(-1), part = new Uint8Array(n), rgba = new Uint32Array(n);
  image.visit({ x0, x1, y0, y1 }, (x, y, row, p, color) => { const i = (y - y0) * w + x - x0; owner[i] = row; part[i] = p; rgba[i] = color; });
  const colors = new Uint32Array(full.rgba.buffer);
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const i = (y - y0) * w + x - x0, j = y * full.PW + x;
    if (owner[i] !== full.owner[j] || part[i] !== full.part[j] || rgba[i] !== (full.part[j] ? colors[j] : 0)) {
      return `pixel (${x}, ${y}) owner ${owner[i]}/${full.owner[j]} part ${part[i]}/${full.part[j]} rgba ${rgba[i]}/${full.part[j] ? colors[j] : 0}`;
    }
  }
  return null;
}

const runs = Number(process.argv[2] ?? 30);
let checked = 0, windows = 0, fulls = 0, same = 0, groundEdits = 0, pans = 0;
for (let run = 0; run < runs; run++) {
  let relief = scene();
  const W = relief.width, H = relief.height;
  const ground = rnd() < 0.6 ? mutableGround(W, H) : undefined;
  const sceneOf = (r: ReliefData): ReliefScene => ({ grids: reliefGrids(r), opts: reliefRenderOptions(r, ground) });
  const image = new ReliefPagedImage(W, H);
  const viewW = Math.min(W * 16, pick([200, 420, 700])), viewH = Math.min(H * 16, pick([180, 360, 600]));
  let view: ReliefPageView = { x: Math.floor(rnd() * Math.max(1, W * 16 - viewW)), y: Math.floor(rnd() * Math.max(1, H * 16 - viewH)), width: viewW, height: viewH };
  let prev = sceneOf(relief), cells = ground?.cells.slice(), revision = 0;
  image.sync(prev, `r${revision}`, view);
  for (let step = 0; step < 8; step++) {
    const roll = rnd();
    let what: string;
    if (ground && roll < 0.25) {
      // 하층 칸 몇 개를 제자리에서 바꾼다(높이는 그대로)
      const cx = Math.floor(rnd() * W), cy = Math.floor(rnd() * H);
      for (let k = 0; k < 3; k++) { const x = Math.min(W - 1, cx + k), y = cy; ground.cells[y * W + x] = (ground.cells[y * W + x]! + 1) % 5; }
      ground.signature++; groundEdits++; what = `ground@${cx},${cy}`;
    } else if (roll < 0.35) {
      view = { ...view, x: Math.floor(rnd() * Math.max(1, W * 16 - viewW)), y: Math.floor(rnd() * Math.max(1, H * 16 - viewH)) };
      image.sync(prev, `r${revision}`, view); pans++;
      const diff = parity(image, prev, view); checked++;
      if (diff) { console.error(`불일치(이동): run ${run} step ${step} ${W}x${H} ${diff}`); process.exit(1); }
      continue;
    } else {
      const next: ReliefData = { ...relief, levels: relief.levels.slice() };
      const mode = pick<ReliefBrushMode>(["raise", "lower", "set", "flatten", "mountain"]);
      const edge = rnd() < 0.2;
      const x = edge ? pick([0, 1, W - 1]) : Math.floor(view.x / 16 + rnd() * view.width / 16), y = edge ? pick([0, H - 1]) : Math.floor(view.y / 16 + rnd() * view.height / 16);
      const level = (mode === "raise" || mode === "lower") && rnd() < 0.5 ? undefined : Math.floor(rnd() * 9);
      brushRelief(next, x, y, mode, { radius: 1 + Math.floor(rnd() * 3), ...(level === undefined ? {} : { level }) });
      relief = next; what = `${mode}@${x},${y}`;
    }
    const nextScene = sceneOf(relief);
    // reliefLiveStrips.ts 와 같은 계획: 제자리에서 바뀐 바닥은 지난 지문 사본과 견준다.
    const previous: ReliefScene = ground && cells ? { ...prev, opts: { ...prev.opts, ground: { cells, signature: -1, sample: () => false } } } : prev;
    const plan = planReliefPatch(previous, nextScene, image);
    if (plan === null) fulls++; else if (plan === "same") same++; else windows++;
    image.sync(nextScene, `r${++revision}`, view, undefined, plan === null ? undefined : plan === "same" ? [] : plan.windows);
    const diff = parity(image, nextScene, view); checked++;
    if (diff) {
      console.error(`불일치: run ${run} step ${step} ${W}x${H} style=${relief.style ?? "-"} ramps=${relief.ramps ? "y" : "n"} ground=${!!ground} ${what} view=${JSON.stringify(view)}`);
      console.error(`  plan ${JSON.stringify(plan)}`);
      console.error(`  ${diff}`);
      process.exit(1);
    }
    prev = nextScene; cells = ground?.cells.slice();
  }
}
console.log(`일치 ${checked}건 (창 ${windows}·전체 ${fulls}·변화 없음 ${same}, 바닥 칸 바꾸기 ${groundEdits}, 화면 이동 ${pans})`);
