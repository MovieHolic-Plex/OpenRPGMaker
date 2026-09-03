/** @vitest-environment happy-dom */
// 타이밍 효과(플래시·흔들림)는 시작 프레임 한 칸이 아니라 durationFrames 창 동안 산다.
// 예전 판은 시작 프레임과 같은 프레임에만 클래스를 걸어 4~7 프레임짜리 플래시가 한 프레임만 보였다.
import { describe, expect, it, beforeEach } from "vitest";

import { activeTimingEffects } from "@/battle/animationTiming";
import type { BattleAnimationTiming } from "@/project/types";
import { mountBattleScene } from "@/player/battleDom";
import { BATTLE_FLASH_FILTER_ID } from "@/player/battleFlashFilter";
import { createBattleRuntime } from "@/battle/runtime";
import { deserialize } from "@/project/io";
import { store } from "@/project/store";
import battleFixture from "./fixtures/projects/battle-v3.json";

const white = { red: 255, green: 255, blue: 255, gray: 0 };

function flashAt(frameIndex: number, durationFrames: number): BattleAnimationTiming {
  return { frameIndex, flash: { target: "target", color: white, durationFrames } };
}

describe("activeTimingEffects — durationFrames 창", () => {
  it("플래시는 시작 프레임부터 durationFrames 만큼 살고 그 뒤 꺼진다", () => {
    const timings = [flashAt(2, 3)];
    expect(activeTimingEffects(timings, 1).flash).toBeUndefined();
    expect(activeTimingEffects(timings, 2).flash).toBeDefined();
    expect(activeTimingEffects(timings, 4).flash).toBeDefined();
    expect(activeTimingEffects(timings, 5).flash).toBeUndefined();
  });

  it("durationFrames 가 0·음수·NaN 이면 시작 프레임 한 칸만 산다", () => {
    for (const bad of [0, -3, Number.NaN]) {
      const timings = [flashAt(1, bad)];
      expect(activeTimingEffects(timings, 1).flash).toBeDefined();
      expect(activeTimingEffects(timings, 2).flash).toBeUndefined();
    }
  });

  it("창이 겹치면 나중에 시작한 플래시가 이긴다", () => {
    const red = { red: 255, green: 0, blue: 0, gray: 0 };
    const timings: BattleAnimationTiming[] = [
      flashAt(0, 6),
      { frameIndex: 3, flash: { target: "screen", color: red, durationFrames: 2 } },
    ];
    expect(activeTimingEffects(timings, 2).flash?.target).toBe("target");
    expect(activeTimingEffects(timings, 3).flash?.target).toBe("screen");
    // 나중 것이 끝나도 먼저 것의 창이 남아 있으면 먼저 것으로 돌아간다.
    expect(activeTimingEffects(timings, 5).flash?.target).toBe("target");
  });

  it("흔들림도 같은 창을 쓰고, 플래시와 독립이다", () => {
    const timings: BattleAnimationTiming[] = [
      { frameIndex: 1, screenShake: { power: 3, speed: 4, durationFrames: 2 } },
      flashAt(4, 1),
    ];
    expect(activeTimingEffects(timings, 2).screenShake).toBeDefined();
    expect(activeTimingEffects(timings, 2).flash).toBeUndefined();
    expect(activeTimingEffects(timings, 3).screenShake).toBeUndefined();
    expect(activeTimingEffects(timings, 4).flash).toBeDefined();
  });

  it("타이밍이 없으면 빈 효과", () => {
    expect(activeTimingEffects(undefined, 0)).toEqual({ flash: undefined, screenShake: undefined });
  });
});

describe("대상 플래시 SVG 필터", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    store.replace(deserialize(JSON.stringify(battleFixture)));
  });

  it("씬 루트에 SourceAlpha 로 오려낸 색을 원본 위에 얹는 필터 정의가 한 번 심긴다", () => {
    const host = document.createElement("div");
    document.body.append(host);
    const runtime = createBattleRuntime({
      project: deserialize(JSON.stringify(battleFixture)),
      troopId: "troop_slime",
      canEscape: true,
      canLose: true,
      rng: () => 0.5,
    });
    const controller = mountBattleScene({ host, runtime, onResult: () => undefined, introHold: false });
    const filters = controller.root.querySelectorAll(`filter#${BATTLE_FLASH_FILTER_ID}`);
    expect(filters.length).toBe(1);
    const filter = filters[0]!;
    const flood = filter.querySelector("feFlood");
    expect(flood?.getAttribute("style")).toContain("--battle-flash-color");
    const composites = Array.from(filter.querySelectorAll("feComposite")).map((node) => [node.getAttribute("in2"), node.getAttribute("operator")]);
    expect(composites).toEqual([
      ["SourceAlpha", "in"],
      ["SourceGraphic", "over"],
    ]);
    controller.destroy();
  });
});
