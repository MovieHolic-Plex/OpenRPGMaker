import { describe, expect, it } from "vitest";
import { executeInstantCommand } from "@/player/playSceneAutonomousCommands";
import { keptEventOpacity, type EventOpacityOverrides } from "@/player/eventOpacityOverrides";

// 이동 경로 changeOpacity 는 경로가 끝난 뒤에도 남는다 — 흐려져 떠난 인물이 다음 표면 갱신에 255 로 되살아나
// 몸과 들고 있던 빛이 다시 보였다(폴른 스타 B4 숲지기, 2026-11-03).
describe("route changeOpacity persists", () => {
  it("records the faded opacity for the event and clears it at full opacity", () => {
    const eventOpacityOverrides: EventOpacityOverrides = new Map();
    const alphas: number[] = [];
    const sprite = { setAlpha: (a: number) => alphas.push(a) };
    const mover = { opacity: 255 } as never as { opacity: number };
    const ctx = { scene: { eventOpacityOverrides }, eventId: "ev_bram", mover } as never;
    const target = { mover, view: { pageId: "forest" }, sprite } as never;
    executeInstantCommand(ctx, target, { kind: "changeOpacity", delta: -255 } as never);
    expect(keptEventOpacity(eventOpacityOverrides, "ev_bram", "forest")).toBe(0);
    expect(alphas.at(-1)).toBe(0);
    executeInstantCommand(ctx, target, { kind: "changeOpacity", delta: 255 } as never);
    expect(eventOpacityOverrides.has("ev_bram")).toBe(false);
  });

  it("forgets the kept opacity once the event shows another page", () => {
    const overrides: EventOpacityOverrides = new Map([["ev_bram", { pageId: "leaving", opacity: 0 }]]);
    expect(keptEventOpacity(overrides, "ev_bram", "leaving")).toBe(0);
    expect(keptEventOpacity(overrides, "ev_bram", "back")).toBeUndefined();
    expect(overrides.has("ev_bram")).toBe(false);
  });
});
