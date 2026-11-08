import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { CUTSCENE_STUCK_CAP_MS, STUCK_MS, cutsceneOnScreen, isStuck, spendsStep } from "../scripts/qa/pipeline/lib/stuck.mjs";

// 왜: 폴른 스타 광범위 QA(큐 B8)에서 하네스가 컷신 대기(15초 무변화)를 멈춤으로 냈다. 컷신이 화면에 있으면 기다림을
// 고정 상한까지 늘리되, 컷신 안에서 정말 얼어붙은 것은 여전히 잡아야 한다(ultrabrain: bounded, not unlimited).

type Frame = { sig: string; cutscene: boolean };
/** driveUntilFree 의 판정 순서를 그대로 따라 도는 시뮬레이터: 매 폴링 pollMs, 단계 예산 maxSteps. */
function drive(frameAt: (ms: number) => Frame, { pollMs = 350, maxSteps = 40, hardMs = 240000 } = {}) {
  let same = 0; let last = ""; let sameSince = 0; let now = 0;
  for (let step = 0; step < maxSteps && now < hardMs; step += 1) {
    const f = frameAt(now);
    if (f.sig === last) same += 1; else { same = 0; sameSince = now; }
    last = f.sig;
    if (!spendsStep({ same, cutscene: f.cutscene })) step -= 1;
    if (isStuck({ same, unchangedMs: now - sameSince, cutscene: f.cutscene })) return { stuck: true, at: now };
    now += pollMs;
  }
  return { stuck: false, at: now };
}

describe("qa pipeline: 컷신 대기와 진짜 멈춤", () => {
  it("컷신 밖에서 얼어붙으면 15초에 멈춤이다(기존 판정 유지)", () => {
    const r = drive(() => ({ sig: "frozen", cutscene: false }), { pollMs: 1500 });
    expect(r).toEqual({ stuck: true, at: STUCK_MS });
  });

  it("컷신이 20초씩 멈췄다 넘어가는 것은 멈춤이 아니다", () => {
    const r = drive((ms) => ({ sig: `line-${Math.floor(ms / 20000)}`, cutscene: true }), { hardMs: 120000 });
    expect(r.stuck).toBe(false);
    expect(r.at).toBeGreaterThanOrEqual(120000);
  });

  it("컷신 안에서 정말 얼어붙으면 고정 상한(45초)에 멈춤으로 잡힌다 — 단계 예산이 먼저 끝나지 않는다", () => {
    expect(CUTSCENE_STUCK_CAP_MS).toBe(45000);
    for (const pollMs of [350, 600, 1500]) {
      const r = drive(() => ({ sig: "frozen", cutscene: true }), { pollMs });
      expect(r.stuck).toBe(true);
      expect(r.at).toBeGreaterThanOrEqual(CUTSCENE_STUCK_CAP_MS);
      expect(r.at).toBeLessThan(CUTSCENE_STUCK_CAP_MS + pollMs);
    }
  });

  it("건너뛰기 안내나 그려진 레터박스가 있을 때만 컷신이다(높이 0 인 남은 띠는 아니다)", () => {
    const doc = (hint: boolean, bars: number[]) => ({
      querySelector: (sel: string) => (hint && sel.includes("cutscene-skip-hint") ? {} : null),
      querySelectorAll: () => bars.map((height) => ({ getBoundingClientRect: () => ({ height }) })),
    });
    expect(cutsceneOnScreen(doc(true, []))).toBe(true);
    expect(cutsceneOnScreen(doc(false, [0, 54]))).toBe(true);
    expect(cutsceneOnScreen(doc(false, [0, 0]))).toBe(false);
    expect(cutsceneOnScreen(doc(false, []))).toBe(false);
  });

  it("플레이어 스크립트가 이 판정을 실제로 쓴다", () => {
    const source = readFileSync(new URL("../scripts/qa/pipeline/vm/player.mjs", import.meta.url), "utf8");
    expect(source).toMatch(/__qaCutsceneOnScreen = \$\{cutsceneOnScreen\.toString\(\)\}/);
    expect(source).toMatch(/cutscene: \(\(\) => \{ try \{ return window\.__qaCutsceneOnScreen\(document\)/);
    expect(source).toMatch(/if \(isStuck\(\{ same, unchangedMs: Date\.now\(\) - sameSince, cutscene: s\.cutscene === true \}\)\)/);
    expect(source).not.toMatch(/same >= 6 && Date\.now\(\) - sameSince >= 15000/);
  });
});
