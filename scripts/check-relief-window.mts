// 높이 붓 부분 다시 굽기(src/project/relief/window.ts)가 전체 굽기와 화소 하나 다르지 않은지 무작위 붓질로 확인한다.
//
//   node_modules/.bin/esbuild scripts/check-relief-window.mts --bundle --platform=node --format=esm --alias:@=./src --outfile=/tmp/check-relief-window.mjs && node /tmp/check-relief-window.mjs [회수=40] [씨앗]
//
// (tsx 로도 돌지만 esbuild keepNames 가 화소마다 만드는 함수를 감싸 열 배쯤 느리다.)
// 맵 크기·양식·경사로·계단·다리·맵 가장자리 붓을 섞는다. 매 붓질마다: 이전 그림 버퍼를 창 굽기로 고친 것 == 다음 높이의 전체 굽기.
// 비교 대상은 편집기 띠가 쓰는 것 전부 — RGBA, 주인 줄, 띠(윗면/벽). 다르면 첫 불일치 화소와 장면을 찍고 종료 코드 1.
import { brushRelief, type ReliefBrushMode } from "@/project/relief/edit";
import { reliefPadPx, renderRelief } from "@/project/relief/render";
import { reliefRenderOptions } from "@/project/relief/screen";
import { RELIEF_STYLES } from "@/project/relief/styles";
import type { ReliefData } from "@/project/relief/types";
import { rampCode } from "@/project/relief/walk";
import { applyReliefPatch, emptyReliefImage, planReliefPatch, reliefGrids, reliefImageFromRender, type ReliefImage, type ReliefScene } from "@/project/relief/window";

let seed = Number(process.argv[3] ?? 1234567);
const rnd = () => { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; return seed / 2 ** 32; };
const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)]!;

const sceneOf = (r: ReliefData): ReliefScene => ({ grids: reliefGrids(r), opts: reliefRenderOptions(r) });
const full = (r: ReliefData): ReliefImage => reliefImageFromRender(renderRelief(reliefGrids(r).eff, reliefRenderOptions(r)), r.width, r.height);

function compare(a: ReliefImage, b: ReliefImage): string | null {
  if (a.PW !== b.PW || a.SH !== b.SH || a.pad !== b.pad) return `size ${a.PW}x${a.SH}/${a.pad} vs ${b.PW}x${b.SH}/${b.pad}`;
  for (let i = 0; i < a.owner.length; i++) {
    const same = a.owner[i] === b.owner[i] && a.part[i] === b.part[i]
      && a.rgba[i * 4] === b.rgba[i * 4] && a.rgba[i * 4 + 1] === b.rgba[i * 4 + 1] && a.rgba[i * 4 + 2] === b.rgba[i * 4 + 2] && a.rgba[i * 4 + 3] === b.rgba[i * 4 + 3];
    if (!same) return `pixel (${i % a.PW}, ${Math.floor(i / a.PW)}) owner ${a.owner[i]}/${b.owner[i]} part ${a.part[i]}/${b.part[i]} rgba ${Array.from(a.rgba.slice(i * 4, i * 4 + 4))} vs ${Array.from(b.rgba.slice(i * 4, i * 4 + 4))}`;
  }
  return null;
}

function scene(): ReliefData {
  const W = pick([18, 40, 57, 80]), H = pick([14, 33, 45, 60]);
  const levels = new Array(W * H).fill(0);
  const r: ReliefData = { width: W, height: H, levels };
  const style = pick([undefined, undefined, ...Object.keys(RELIEF_STYLES)]);
  if (style) r.style = style;
  for (let k = 0; k < 3; k++) brushRelief(r, Math.floor(rnd() * W), Math.floor(rnd() * H), "set", { radius: 2 + rnd() * 5, level: 1 + Math.floor(rnd() * 9) });
  if (rnd() < 0.5) {
    // 경사로·계단: 높은 칸 남쪽 끝에 오르막 n 경사로 띠
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

const runs = Number(process.argv[2] ?? 40);
let checked = 0, fullFallbacks = 0, same = 0, windowed = 0, padShifts = 0, fromFlat = 0, windowArea = 0, mapArea = 0;
for (let run = 0; run < runs; run++) {
  let relief = scene();
  // 셋 중 하나는 평지에서 시작한다(빈 맵에 처음 칠하는 길 — 빈 그림에서 창으로 굽는다)
  const flatStart = rnd() < 0.34;
  if (flatStart) { relief = { ...relief, levels: relief.levels.map(() => 0) }; delete relief.ramps; }
  let image = flatStart ? emptyReliefImage(relief.width, relief.height) : full(relief);
  let prev: ReliefScene | null = flatStart ? null : sceneOf(relief);
  for (let step = 0; step < 6; step++) {
    const next: ReliefData = { ...relief, levels: relief.levels.slice() };
    const mode = pick<ReliefBrushMode>(["raise", "lower", "set", "flatten", "mountain"]);
    // 가장자리 붓을 일부러 섞는다(창이 폭 전체로 넓어지는 길)
    const edge = rnd() < 0.25;
    const x = edge ? pick([0, 1, next.width - 1]) : Math.floor(rnd() * next.width), y = edge ? pick([0, next.height - 1]) : Math.floor(rnd() * next.height);
    // raise·lower 는 절반을 단 제한 없이(늘 ±1) — 변화 없는 붓질만 쌓이지 않게
    const level = (mode === "raise" || mode === "lower") && rnd() < 0.5 ? undefined : Math.floor(rnd() * 9);
    brushRelief(next, x, y, mode, { radius: 1 + Math.floor(rnd() * 3), ...(level === undefined ? {} : { level }) });
    const nextScene = sceneOf(next);
    const truth = full(next);
    if (reliefPadPx(nextScene.grids.pruned, nextScene.opts.slopes ?? []) !== truth.pad) {
      console.error(`pad 불일치: run ${run} step ${step} reliefPadPx=${reliefPadPx(nextScene.grids.pruned, nextScene.opts.slopes ?? [])} render=${truth.pad}`);
      process.exit(1);
    }
    const plan = planReliefPatch(prev, nextScene, image);
    if (plan === null) { fullFallbacks++; image = truth; }
    else if (plan === "same") { same++; }
    else {
      if (plan.pad !== image.pad) padShifts++;
      if (!prev) fromFlat++;
      applyReliefPatch(image, nextScene, plan);
      windowed++;
      windowArea += plan.windows.reduce((sum, w) => sum + w.w * w.h, 0); mapArea += next.width * next.height;
    }
    const diff = compare(image, truth);
    checked++;
    if (diff) {
      console.error(`불일치: run ${run} step ${step} ${next.width}x${next.height} style=${next.style ?? "-"} ramps=${next.ramps ? "y" : "n"} brush ${mode}@${x},${y} flatStart=${flatStart}`);
      console.error(`  plan ${JSON.stringify(plan)}`);
      console.error(`  ${diff}`);
      process.exit(1);
    }
    relief = next; prev = nextScene;
  }
}
console.log(`일치 ${checked}건 (창 굽기 ${windowed} — pad 바뀜 ${padShifts}·평지에서 ${fromFlat}, 변화 없음 ${same}, 전체 굽기 ${fullFallbacks}) · 창 평균 넓이 ${mapArea ? Math.round((100 * windowArea) / mapArea) : 0}%`);
