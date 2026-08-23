/**
 * 감독이 저작한 flash/screenShake 값이 CSS 까지 살아서 도달하는지 지킨다.
 *
 * 회귀 배경: 렌더러가 `Boolean(timing.flash)` 로 존재 여부만 보던 시절, 색·지속·세기가
 * 전부 버려졌다. 같은 시트·같은 패턴을 쓰는 「타격」·「마법 충격」·「회복 빛」은 유일한
 * 차이인 flash 색마저 흰색으로 뭉개져 화면에서 완전히 동일했다.
 */
import { describe, expect, it } from "vitest";
import {
  BATTLE_EFFECT_CSS_VARIABLES,
  flashCssVariables,
  framesToMs,
  screenShakeCssVariables,
} from "@/player/battleAnimationEffectStyle";
import { BATTLE_ANIMATION_FRAME_MS } from "@/player/battleAnimationPlayback";
import type { BattleAnimationFlash, BattleAnimationScreenShake } from "@/project/types";

function flash(red: number, green: number, blue: number, gray = 0, durationFrames = 4): BattleAnimationFlash {
  return { target: "target", color: { red, green, blue, gray }, durationFrames };
}

function shake(power: number, speed: number, durationFrames = 8): BattleAnimationScreenShake {
  return { power, speed, durationFrames };
}

describe("flashCssVariables", () => {
  it("스타터 3레코드의 flash 색이 서로 다른 CSS 값이 된다", () => {
    // anim_hit 흰색 / anim_magic 파랑 / anim_heal 초록 — 이 셋이 같으면 화면에서 구분이 안 된다.
    const colors = [
      flashCssVariables(flash(255, 255, 255)),
      flashCssVariables(flash(120, 180, 255)),
      flashCssVariables(flash(160, 255, 180)),
    ].map((vars) => vars["--battle-flash-color"]);

    expect(new Set(colors).size).toBe(3);
  });

  it("저작한 RGB 를 그대로 싣는다", () => {
    expect(flashCssVariables(flash(120, 180, 255))["--battle-flash-color"]).toBe("rgba(120, 180, 255, 0.45)");
  });

  it("durationFrames 를 재생 간격과 같은 상수로 ms 화한다", () => {
    expect(flashCssVariables(flash(255, 255, 255, 0, 5))["--battle-flash-duration"]).toBe(
      `${5 * BATTLE_ANIMATION_FRAME_MS}ms`
    );
  });

  it("gray 채널이 색을 회색 쪽으로 끌어당긴다", () => {
    const vivid = flashCssVariables(flash(255, 0, 0, 0))["--battle-flash-color"]!;
    const grayed = flashCssVariables(flash(255, 0, 0, 255))["--battle-flash-color"]!;
    expect(grayed).not.toBe(vivid);
    // gray 를 최대로 주면 세 채널이 같은 값(=무채색)으로 수렴한다.
    const channels = grayed.match(/\d+/g)!.slice(0, 3);
    expect(new Set(channels).size).toBe(1);
  });

  it("범위 밖 채널을 0~255 로 접는다", () => {
    expect(flashCssVariables(flash(-40, 999, 128))["--battle-flash-color"]).toBe("rgba(0, 255, 128, 0.45)");
  });
});

describe("screenShakeCssVariables", () => {
  it("power 가 커질수록 진폭이 커진다", () => {
    const amplitudes = [1, 3, 6, 9].map((power) =>
      Number.parseFloat(screenShakeCssVariables(shake(power, 5))["--battle-shake-x"]!)
    );
    for (let index = 1; index < amplitudes.length; index += 1) {
      expect(amplitudes[index]).toBeGreaterThan(amplitudes[index - 1]!);
    }
  });

  it("speed 가 커질수록 진동 주기가 짧아진다", () => {
    const periods = [1, 5, 9].map((speed) =>
      Number.parseInt(screenShakeCssVariables(shake(5, speed))["--battle-shake-period"]!, 10)
    );
    expect(periods[1]).toBeLessThan(periods[0]!);
    expect(periods[2]).toBeLessThan(periods[1]!);
  });

  it("주기 × 반복횟수가 durationFrames 총 길이에 맞는다", () => {
    const vars = screenShakeCssVariables(shake(5, 5, 8));
    const period = Number.parseInt(vars["--battle-shake-period"]!, 10);
    const iterations = Number.parseInt(vars["--battle-shake-iterations"]!, 10);
    const total = framesToMs(8);
    // 반올림 오차가 한 주기를 넘으면 안 된다.
    expect(Math.abs(period * iterations - total)).toBeLessThan(period);
  });

  it("세로 진폭은 가로보다 작다", () => {
    const vars = screenShakeCssVariables(shake(9, 5));
    expect(Number.parseFloat(vars["--battle-shake-y"]!)).toBeLessThan(Number.parseFloat(vars["--battle-shake-x"]!));
  });

  it("범위 밖 power/speed 를 1~9 로 접는다", () => {
    expect(screenShakeCssVariables(shake(99, 99))["--battle-shake-x"]).toBe(
      screenShakeCssVariables(shake(9, 9))["--battle-shake-x"]
    );
    expect(screenShakeCssVariables(shake(-3, 0))["--battle-shake-x"]).toBe(
      screenShakeCssVariables(shake(1, 1))["--battle-shake-x"]
    );
  });

  it("반복 횟수는 최소 1 이다", () => {
    expect(Number.parseInt(screenShakeCssVariables(shake(1, 1, 1))["--battle-shake-iterations"]!, 10)).toBeGreaterThanOrEqual(1);
  });
});

describe("BATTLE_EFFECT_CSS_VARIABLES", () => {
  it("두 생성기가 내는 모든 변수 이름을 빠짐없이 담는다", () => {
    // 목록에서 빠진 변수는 효과 없는 프레임에서 걷히지 않아 다음 효과로 새어 나간다.
    const produced = new Set([
      ...Object.keys(flashCssVariables(flash(255, 255, 255))),
      ...Object.keys(screenShakeCssVariables(shake(5, 5))),
    ]);
    for (const name of produced) expect(BATTLE_EFFECT_CSS_VARIABLES).toContain(name);
  });
});
