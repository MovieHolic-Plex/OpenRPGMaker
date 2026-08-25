/**
 * 모던 `Screen Effect` 커맨드가 **실제 렌더 경로에 닿는지** 지킨다.
 *
 * 회귀 배경: 이 커맨드는 `runtime.screenEffects` 배열에 push 만 하고 끝났고, 그 배열을
 * 읽는 렌더러가 저장소에 없었다. 피커에는 정상 노출되니 감독은 넣고 → 실행하고 →
 * 화면은 그대로고 → 경고도 못 받았다. 실측 픽셀 변화율 0.00%(같은 조건 구식 Tint Screen 75.28%).
 */
import { describe, expect, it } from "vitest";
import { createInterpreter } from "@/player/interpreter";
import { planScreenEffect } from "@/player/interpreter/screenEffectPlan";
import { M2_COMMAND_CATALOG } from "@/project/eventCommands/m2Catalog";
import { SCREEN_EFFECT_OPTIONS } from "@/project/eventCommands/m2ModernCatalog";
import type { Command, M2CommandFields } from "@/project/types";
import type { PlaySessionLike } from "@/project/sessionRuntimeTypes";

function mkSession(): PlaySessionLike {
  return {
    flags: {}, switches: {}, variables: {}, timers: {}, gold: 0, inventory: {},
    partyActorIds: [], actorExperience: {}, actorLevels: {}, actorEquipment: {}, actorVitals: {},
    currentMapId: "m1", x: 0, y: 0, audio: {}, pictures: {},
  } as unknown as PlaySessionLike;
}

function screenEffectCommand(fields: M2CommandFields): Command {
  const entry = M2_COMMAND_CATALOG.find((row) => row.title === "Screen Effect");
  if (!entry) throw new Error("카탈로그에 Screen Effect 가 없다");
  return { kind: "m2Command", commandId: entry.id, fields } as unknown as Command;
}

function runScreenEffect(fields: M2CommandFields) {
  const session = mkSession();
  const result = createInterpreter([screenEffectCommand(fields)], session).start();
  return { session, result, screen: session.m2Runtime?.screen };
}

describe("planScreenEffect", () => {
  it("fadeOut 은 불투명 검정으로 트윈한다", () => {
    expect(planScreenEffect("fadeOut", "", 600)).toEqual({
      kind: "tint", tint: "0,0,0,1", tintDurationMs: 600, unhide: false,
    });
  });

  it("fadeIn 은 투명으로 트윈하면서 화면 숨김을 푼다", () => {
    // hidden 이 tint 보다 우선이라(playSceneScreenEffects) 안 풀면 영원히 검은 화면이 된다.
    expect(planScreenEffect("fadeIn", "", 600)).toEqual({
      kind: "tint", tint: "none", tintDurationMs: 600, unhide: true,
    });
  });

  it("tint 는 값을 그대로 쓰고, 빈 값은 색조 해제로 읽는다", () => {
    expect(planScreenEffect("tint", "#ff0000", 400)).toMatchObject({ kind: "tint", tint: "#ff0000" });
    expect(planScreenEffect("tint", "  ", 400)).toMatchObject({ kind: "tint", tint: "neutral" });
  });

  it("flash 는 일회형이라 색과 지속만 넘긴다", () => {
    expect(planScreenEffect("flash", "#ffffff", 300)).toEqual({ kind: "flash", color: "#ffffff", durationMs: 300 });
    expect(planScreenEffect("flash", "", 300)).toMatchObject({ color: "white" });
  });

  it("weather 는 날씨 상태로 간다", () => {
    expect(planScreenEffect("weather", "rain,0.9", 0)).toEqual({ kind: "weather", weather: "rain,0.9" });
  });

  it("렌더러 없는 옵션은 조용히 삼키지 않고 unsupported 로 돌린다", () => {
    expect(planScreenEffect("blur", "4", 300)).toEqual({ kind: "unsupported", effect: "blur" });
    expect(planScreenEffect("존재하지않는효과", "", 300)).toMatchObject({ kind: "unsupported" });
  });

  it("음수/비정상 durationMs 를 0 이상으로 접는다", () => {
    expect(planScreenEffect("fadeOut", "", -100)).toMatchObject({ tintDurationMs: 0 });
    expect(planScreenEffect("fadeOut", "", Number.NaN)).toMatchObject({ tintDurationMs: 0 });
  });
});

describe("Screen Effect 런타임 배선", () => {
  it("fadeOut 이 렌더러가 읽는 screen.tint 를 채운다", () => {
    const { screen } = runScreenEffect({ effect: "fadeOut", value: "", durationMs: 600 });
    expect(screen?.tint).toBe("0,0,0,1");
    expect(screen?.tintDurationMs).toBe(600);
  });

  it("tint 가 저작한 색을 그대로 싣는다", () => {
    const { screen } = runScreenEffect({ effect: "tint", value: "#ff0000", durationMs: 400 });
    expect(screen?.tint).toBe("#ff0000");
  });

  it("weather 가 날씨 상태에 도달한다", () => {
    const { screen } = runScreenEffect({ effect: "weather", value: "rain,0.9", durationMs: 0 });
    expect(screen?.weather).toBe("rain,0.9");
  });

  it("flash 는 카메라 경로용 flashScreen StepResult 를 낸다", () => {
    const { result } = runScreenEffect({ effect: "flash", value: "white", durationMs: 600 });
    expect(result.kind).toBe("flashScreen");
    if (result.kind === "flashScreen") {
      expect(result.red).toBe(255);
      expect(result.green).toBe(255);
      expect(result.blue).toBe(255);
      expect(result.durationMs).toBe(600);
    }
  });

  it("지속형 효과는 화면을 막지 않고 다음 명령으로 넘어간다", () => {
    const session2 = mkSession();
    const interp = createInterpreter(
      [
        screenEffectCommand({ effect: "fadeOut", value: "", durationMs: 300 }),
        { kind: "setVariable", variableId: "v", op: "=", value: 7 } as unknown as Command,
      ],
      session2
    );
    interp.start();
    expect(session2.variables["v"]).toBe(7);
  });

  it("렌더러 없는 옵션은 fallbacks 에 기록으로 남는다", () => {
    const { session: used } = runScreenEffect({ effect: "blur", value: "4", durationMs: 300 });
    const fallbacks = used.m2Runtime?.fallbacks ?? [];
    expect(fallbacks.some((entry) => entry.label.includes("Screen Effect") || entry.commandId)).toBe(true);
  });

  it("기존 계약(큐·플래그)을 계속 채운다", () => {
    const { session: used } = runScreenEffect({ effect: "fadeOut", value: "", durationMs: 300 });
    expect(used.m2Runtime?.screenEffects).toHaveLength(1);
    expect(used.flags["screen-effect:fadeOut"]).toBe(true);
  });
});

describe("피커 옵션", () => {
  it("고를 수 있는 옵션은 전부 렌더 경로가 있다", () => {
    // 렌더러 없는 옵션이 목록에 남아 있으면 조용한 실패가 다시 생긴다.
    for (const option of SCREEN_EFFECT_OPTIONS) {
      expect(planScreenEffect(option.value, "", 300).kind, `${option.value} 에 렌더 경로가 없다`).not.toBe("unsupported");
    }
  });
});
