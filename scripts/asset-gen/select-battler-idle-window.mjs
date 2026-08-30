#!/usr/bin/env node
/**
 * 키드 프레임에서 **네 계약을 모두 통과하는 프레임 창**을 찾는다.
 *
 * 이 도구가 없으면 다음 사람이 눈으로 창을 고르고, 통과할 때까지 임계값을 만지게 된다.
 * 실측으로 그 함정을 다 밟았다 — 후면 티어 작업에서 초기 hero-01 패킹은 "루프 이음매만"
 * 보고 골라 최소 모션 0.01% 의 **사실상 정지 화면**이었고, `steps()` 는 같은 그림 위에서도
 * 배경 위치를 옮기므로 런타임 검사로도 안 잡혔다.
 *
 * 점수는 `battlerIdleMetrics.mjs` 의 정본을 쓴다. 최종 판정은 **실제 패커 출력**으로 한다 —
 * 키드 프레임 근사만 믿으면 리샘플링 차이로 값이 어긋난다(실측: 근사 0.087 대 실제 0.125).
 *
 * 사용:
 *   node scripts/asset-gen/select-battler-idle-window.mjs \
 *     --frames /tmp/back-anim/keyed/hero-04-v3 \
 *     --reference public/assets/generated/battle-skins/sprites/hero-04-back.png \
 *     --cell 290 --cell-height 280 --frame-count 8
 *
 * 옵션:
 *   --verify N        상위 N개를 실제 패커로 패킹해 재채점 (기본 5)
 *   --pingpong-only   연속 창을 건너뛴다. 루프가 안 닫히는 클립에서 쓴다.
 *   --json            결과를 JSON 으로 출력
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PNG } from "pngjs";

import {
  CONTRACT,
  colorShares,
  frameChange,
  headShares,
  relativeDeviationDetail,
  scoreStrip,
} from "./battlerIdleMetrics.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PACKER = path.join(HERE, "pack-battler-idle-strip.mjs");

function parseArgs(argv) {
  const args = {
    cell: 290,
    cellHeight: 280,
    frameCount: 8,
    verify: 5,
    pingpongOnly: false,
    json: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const next = () => argv[(i += 1)];
    if (key === "--frames") args.frames = next();
    else if (key === "--reference") args.reference = next();
    else if (key === "--cell") args.cell = Number(next());
    else if (key === "--cell-height") args.cellHeight = Number(next());
    else if (key === "--frame-count") args.frameCount = Number(next());
    else if (key === "--verify") args.verify = Number(next());
    else if (key === "--pingpong-only") args.pingpongOnly = true;
    else if (key === "--json") args.json = true;
  }
  if (!args.frames || !args.reference) {
    throw new Error("--frames 와 --reference 는 필수다");
  }
  return args;
}

/** 프레임 파일을 인덱스로 읽는다. 파일명의 **마지막** 숫자 묶음을 인덱스로 쓴다(`hero-04-f091.png` → 91). */
export function loadFrames(dir) {
  const frames = new Map();
  for (const file of readdirSync(dir).filter((name) => name.endsWith(".png")).sort()) {
    // **마지막** 숫자 묶음만 쓴다. 전부 이어 붙이면 `hero-04-f091.png` 가 4091 이 된다.
    const groups = file.replace(/\.png$/i, "").match(/\d+/g);
    if (!groups) continue;
    const digits = groups[groups.length - 1];
    frames.set(Number(digits), PNG.sync.read(readFileSync(path.join(dir, file))));
  }
  if (frames.size === 0) throw new Error(`${dir} 에 프레임 PNG 가 없다`);
  return frames;
}

/**
 * 창 후보를 만든다.
 *
 * 핑퐁(`[a,b,c,d,e,d,c,b]`)을 반드시 포함한다 — 충실한 구간이 짧아 그 안에 호흡 한 주기가
 * 안 들어가면 **어떤 연속 창도 이음매 계약을 통과하지 못한다**(실측: hero-04 최선 1.68).
 * 서로 다른 칸을 되짚으면 이음매가 정의상 한 걸음이 되고 충실한 구간에만 머문다.
 */
function* candidates(indices, frameCount, pingpongOnly) {
  const present = new Set(indices);
  const half = Math.ceil(frameCount / 2) + 1;
  for (const start of indices) {
    for (const stride of [1, 2, 3, 4, 5, 6]) {
      if (!pingpongOnly) {
        const cont = Array.from({ length: frameCount }, (_, k) => start + k * stride);
        if (cont.every((index) => present.has(index))) yield { mode: "cont", start, stride, picks: cont };
      }
      // 핑퐁: 서로 다른 half 칸을 골라 되짚는다. frameCount 8 → 5칸 [a,b,c,d,e,d,c,b].
      const out = Array.from({ length: half }, (_, k) => start + k * stride);
      if (!out.every((index) => present.has(index))) continue;
      const back = out.slice(1, -1).reverse();
      const ping = [...out, ...back].slice(0, frameCount);
      if (ping.length === frameCount) yield { mode: "ping", start, stride, picks: ping };
    }
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const reference = PNG.sync.read(readFileSync(args.reference));
  const referenceBody = colorShares(reference, 0, reference.width, reference.height);
  const referenceHead = headShares(reference, 0, reference.width, reference.height);
  const frames = loadFrames(args.frames);
  const indices = [...frames.keys()].sort((a, b) => a - b);

  // 1단: 프레임별 색·머리 편차를 한 번만 잰다.
  const perFrame = new Map();
  for (const [index, png] of frames) {
    perFrame.set(index, {
      color: relativeDeviationDetail(colorShares(png, 0, png.width, png.height), referenceBody),
      head: relativeDeviationDetail(headShares(png, 0, png.width, png.height), referenceHead),
    });
  }

  // 2단: 창을 훑어 네 계약으로 걸러낸다. 이 단계는 키드 프레임 근사다.
  const reasons = { total: 0, color: 0, head: 0, motion: 0, seam: 0 };
  const survivors = [];
  for (const candidate of candidates(indices, args.frameCount, args.pingpongOnly)) {
    reasons.total += 1;
    const color = Math.max(...candidate.picks.map((index) => perFrame.get(index).color.deviation));
    if (color >= CONTRACT.colorRelativeCap) {
      reasons.color += 1;
      continue;
    }
    const head = Math.max(...candidate.picks.map((index) => perFrame.get(index).head.deviation));
    if (head > CONTRACT.headRelativeCap) {
      reasons.head += 1;
      continue;
    }
    const steps = [];
    for (let k = 1; k < candidate.picks.length; k += 1) {
      steps.push(pairChange(frames, candidate.picks[k - 1], candidate.picks[k]));
    }
    const minStep = Math.min(...steps);
    if (minStep < CONTRACT.minAdjacentChange) {
      reasons.motion += 1;
      continue;
    }
    const maxStep = Math.max(...steps);
    const seam = pairChange(frames, candidate.picks[candidate.picks.length - 1], candidate.picks[0]);
    const seamRatio = maxStep === 0 ? Infinity : seam / maxStep;
    if (seamRatio > CONTRACT.seamRatioCap) {
      reasons.seam += 1;
      continue;
    }
    survivors.push({ ...candidate, color, head, minStep, seamRatio });
  }

  // 여유가 큰 순서로. 색·머리는 상한에서 멀수록, 모션은 하한에서 멀수록 좋다.
  survivors.sort((a, b) => margin(b) - margin(a));

  // 3단: 상위 N개를 **실제 패커**로 패킹해 재채점한다. 이것이 유일한 권위 있는 숫자다.
  const verified = [];
  const workdir = mkdtempSync(path.join(tmpdir(), "battler-window-"));
  try {
    for (const candidate of survivors.slice(0, Math.max(0, args.verify))) {
      const out = path.join(workdir, `cand-${candidate.mode}-${candidate.start}-${candidate.stride}.png`);
      try {
        execFileSync(
          process.execPath,
          [
            PACKER,
            "--frames", args.frames,
            "--reference", args.reference,
            "--out", out,
            "--cell", String(args.cell),
            "--cell-height", String(args.cellHeight),
            "--pick", candidate.picks.join(","),
          ],
          { stdio: "ignore" }
        );
      } catch (error) {
        verified.push({ ...candidate, packError: String(error.message ?? error) });
        continue;
      }
      const strip = PNG.sync.read(readFileSync(out));
      const score = scoreStrip(strip, reference, args.cell, args.cellHeight, args.frameCount);
      verified.push({ ...candidate, packed: score });
    }
  } finally {
    rmSync(workdir, { recursive: true, force: true });
  }

  if (args.json) {
    console.log(JSON.stringify({ reasons, survivors: survivors.length, verified }, null, 2));
    return;
  }

  console.log(`프레임 ${frames.size}장, 창 후보 ${reasons.total}개`);
  console.log(`탈락: 색 ${reasons.color} · 머리 ${reasons.head} · 모션 ${reasons.motion} · 이음매 ${reasons.seam}`);
  console.log(`근사 통과 ${survivors.length}개 → 상위 ${verified.length}개를 실제 패커로 재채점\n`);
  if (verified.length === 0) {
    // `--verify 0` 은 "재채점을 건너뛰라"는 뜻이다. 그걸 "통과 창이 없다"로 읽으면 오진이다.
    if (survivors.length > 0) {
      console.log(`근사 통과 후보 ${survivors.length}개가 있지만 재채점을 하지 않았다(--verify ${args.verify}).`);
      console.log("근사 값은 권위가 없다 — `--verify 5` 이상으로 실제 패커 출력을 확인하라.");
      for (const candidate of survivors.slice(0, 10)) {
        console.log(`  ${label(candidate)}  --pick "${candidate.picks.join(",")}"`);
      }
      return;
    }
    console.log("통과 창이 없다(근사 통과 0개). 클립 자체가 계약을 만족하지 못한다는 뜻이다.");
    console.log("임계값을 낮추지 마라 — 프롬프트를 고쳐 다시 생성하거나 --pingpong-only 를 시도하라.");
    console.log(`판단 근거는 openwiki/battler-idle-playbook.md 를 보라.`);
    return;
  }
  for (const entry of verified) {
    if (entry.packError) {
      console.log(`✗ ${label(entry)} — 패킹 실패: ${entry.packError.split("\n")[0]}`);
      continue;
    }
    const p = entry.packed;
    const mark = p.passes ? "✓" : "✗";
    console.log(`${mark} ${label(entry)}`);
    console.log(
      `    색 ${p.color.toFixed(3)} (${p.colorBucket}, 칸${p.colorCell}) / ${CONTRACT.colorRelativeCap}` +
        `   머리 ${p.head.toFixed(3)} (${p.headBucket}, 칸${p.headCell}) / ${CONTRACT.headRelativeCap}`
    );
    console.log(
      `    모션 최소 ${(p.minStep * 100).toFixed(2)}% (하한 ${(CONTRACT.minAdjacentChange * 100).toFixed(0)}%)` +
        `   이음매비 ${p.seamRatio.toFixed(2)} / ${CONTRACT.seamRatioCap}`
    );
    if (!p.passes) console.log(`    위반: ${p.failures.join(", ")}`);
    console.log(`    --pick "${entry.picks.join(",")}"`);
  }
  const best = verified.find((entry) => entry.packed?.passes);
  if (best) {
    console.log(`\n권장: --pick "${best.picks.join(",")}"`);
    console.log("프레임 간격은 이 창의 실측 간격으로 맞춘다: stride ÷ 24fps.");
    console.log(`  stride ${best.stride} → ${Math.round((best.stride / 24) * 1000)}ms`);
  } else {
    // 사전 필터는 키드 프레임 근사라 실제 패커 출력과 어긋날 수 있다. 상위 N개가 전부
    // 떨어졌다면 **남은 후보가 있는지**를 먼저 알려야 한다 — 없다고 오해하면 임계값을
    // 만지러 간다.
    const remaining = survivors.length - verified.length;
    console.log("\n근사는 통과했지만 재채점한 창이 전부 계약을 못 넘었다.");
    if (remaining > 0) {
      console.log(
        `근사 통과 후보가 ${remaining}개 더 남아 있다 — 먼저 --verify ${Math.min(survivors.length, args.verify + 10)} 로 넓혀 보라.`
      );
    } else {
      console.log("근사 통과 후보를 전부 재채점했다. 이 클립에는 통과 창이 없다.");
    }
    console.log("어느 쪽이든 상한을 만지지 마라 — 프롬프트를 고쳐 다시 생성하는 것이 맞다.");
    console.log("판단 근거는 openwiki/battler-idle-playbook.md 를 보라.");
  }
}

const pairCache = new Map();
/** 정본 `frameChange` 를 캐시해서 쓴다. 여기서 다시 구현하면 안 된다 — 그래서 버그를 냈다. */
function pairChange(frames, a, b) {
  const key = a < b ? `${a}:${b}` : `${b}:${a}`;
  if (pairCache.has(key)) return pairCache.get(key);
  const value = frameChange(frames.get(a), frames.get(b));
  pairCache.set(key, value);
  return value;
}

function margin(candidate) {
  // 네 계약 모두의 여유를 더한다. 이음매를 빼면 이음매 1.49 인 창이 색·모션 여유만으로
  // 위로 올라온다.
  return (
    (CONTRACT.colorRelativeCap - candidate.color) / CONTRACT.colorRelativeCap +
    (CONTRACT.headRelativeCap - candidate.head) / CONTRACT.headRelativeCap +
    (candidate.minStep - CONTRACT.minAdjacentChange) / CONTRACT.minAdjacentChange +
    (CONTRACT.seamRatioCap - candidate.seamRatio) / CONTRACT.seamRatioCap
  );
}

function label(entry) {
  return `${entry.mode === "ping" ? "핑퐁" : "연속"} start=${entry.start} stride=${entry.stride}`;
}

// 직접 실행일 때만 돈다 — 테스트가 `loadFrames` 를 import 할 수 있어야 한다.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
