import { describe, expect, it } from "vitest";
import {
  interpolateScreenDistortion,
  isNeutralScreenDistortion,
  NEUTRAL_SCREEN_DISTORTION,
  nextScreenDistortion,
  normalizeScreenDistortion,
  SCREEN_DISTORTION_DEFAULTS,
} from "@/project/eventCommands/screenDistortion";
import { planScreenEffect } from "@/player/interpreter/screenEffectPlan";
import { SCREEN_EFFECT_OPTIONS } from "@/project/eventCommands/m2ModernCatalog";
import { compileCutscene } from "@/editor/cutscene";

describe("화면 왜곡 모델", () => {
  it("빈 값은 기본 세기, 숫자는 그 세기, 0 은 그 축만 끈다", () => {
    expect(nextScreenDistortion(undefined, "wave", "")).toEqual({ ...NEUTRAL_SCREEN_DISTORTION, wave: SCREEN_DISTORTION_DEFAULTS.wave });
    const both = nextScreenDistortion(nextScreenDistortion(undefined, "wave", "6"), "mosaic", "8");
    expect(both).toEqual({ wave: 6, mosaic: 8, rotate: 0 });
    expect(nextScreenDistortion(both, "wave", "0")).toEqual({ wave: 0, mosaic: 8, rotate: 0 });
    expect(nextScreenDistortion(both, "clearDistortion", "")).toEqual(NEUTRAL_SCREEN_DISTORTION);
  });

  it("범위 밖 값은 클램프하고 숫자가 아니면 0", () => {
    expect(normalizeScreenDistortion({ wave: 99, mosaic: -3, rotate: "400" })).toEqual({ wave: 16, mosaic: 0, rotate: 180 });
    expect(normalizeScreenDistortion({ wave: "abc" })).toEqual(NEUTRAL_SCREEN_DISTORTION);
  });

  it("모자이크 1 이하는 꺼짐으로 본다", () => {
    expect(isNeutralScreenDistortion({ wave: 0, mosaic: 1, rotate: 0 })).toBe(true);
    expect(isNeutralScreenDistortion({ wave: 0, mosaic: 2, rotate: 0 })).toBe(false);
    expect(isNeutralScreenDistortion(undefined)).toBe(true);
  });

  it("전환은 끝점을 정확히 지나고 중간은 반쯤이다", () => {
    const from = NEUTRAL_SCREEN_DISTORTION;
    const to = { wave: 8, mosaic: 16, rotate: -10 };
    expect(interpolateScreenDistortion(from, to, 0)).toEqual(from);
    expect(interpolateScreenDistortion(from, to, 1)).toEqual(to);
    expect(interpolateScreenDistortion(from, to, 0.5).wave).toBeCloseTo(4, 10);
  });
});

describe("화면 효과 명령 → 왜곡", () => {
  it("새 옵션 넷은 전부 렌더 경로(distortion)가 있다 — 조용한 실패 없음", () => {
    for (const effect of ["wave", "mosaic", "rotate", "clearDistortion"]) {
      expect(SCREEN_EFFECT_OPTIONS.some((option) => option.value === effect)).toBe(true);
      expect(planScreenEffect(effect, "", 300).kind).toBe("distortion");
    }
  });
});

describe("컷신 distort 비트", () => {
  it("화면 효과 명령으로 컴파일되고, 정리 단계가 마지막 상태를 다시 건다", () => {
    const commands = compileCutscene([
      { kind: "distort", effect: "wave", amount: 5, durationMs: 400 },
      { kind: "say", speaker: "A", text: "물속이다" },
    ]);
    const effects = commands.filter((command) => command.kind === "m2Command" && command.fields.effect === "wave");
    expect(effects.length).toBeGreaterThanOrEqual(2);
    expect(effects[0]).toMatchObject({ fields: { effect: "wave", value: "5", durationMs: 400 } });
    expect(effects[effects.length - 1]).toMatchObject({ fields: { effect: "wave", value: "5", durationMs: 0 } });
  });
});
