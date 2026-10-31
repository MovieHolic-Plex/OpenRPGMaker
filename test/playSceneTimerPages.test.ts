// 타이머가 0 이 되는 순간 타이머 조건 페이지를 다시 고르게 하는 두 조각(2026-10-31 sab-1031 A dungeon-2 「철창 닫힘」 20초 지연).
import { describe, expect, it } from "vitest";
import { timerConditionPages, updateRuntimeTimers } from "@/player/playSceneTimers";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import type { GameMap } from "@/project/types";

function scene(seconds: number): PlaySceneContext {
  return { session: { timers: { timer1: seconds }, timerActive: { timer1: true } }, runtimeTimers: new Map([["timer1", { remaining: seconds, active: true }]]) } as unknown as PlaySceneContext;
}

describe("timer condition pages", () => {
  it("reports a change only when the shown second changes, and when the timer hits 0", () => {
    const s = scene(2);
    expect(updateRuntimeTimers(s, 400)).toBe(false); // 1.6s → 2 shown
    expect(updateRuntimeTimers(s, 700)).toBe(true); // 0.9s → 1 shown
    expect(updateRuntimeTimers(s, 2000)).toBe(true); // 0 → stops
    expect(s.session.timers.timer1).toBe(0);
    expect(s.runtimeTimers.get("timer1")!.active).toBe(false);
    expect(updateRuntimeTimers(s, 1000)).toBe(false);
  });

  it("finds auto pages gated on a timer, inside condition groups too", () => {
    const map = { events: [
      { id: "ev_gate", pages: [
        { id: "p0", conditions: [], trigger: { kind: "parallel" } },
        { id: "p1", conditions: [{ kind: "switch", switchId: "sw", value: true }, { kind: "timer", timerId: "timer1", seconds: 0 }], trigger: { kind: "auto" } },
      ] },
      { id: "ev_sign", pages: [{ id: "q0", conditions: [{ kind: "any", conditions: [{ kind: "timer", timerId: "timer2", seconds: 5, op: ">=" }] }], trigger: { kind: "action" } }] },
      { id: "ev_npc", pages: [{ id: "r0", conditions: [{ kind: "switch", switchId: "sw", value: true }], trigger: { kind: "action" } }] },
    ] } as unknown as GameMap;
    expect(timerConditionPages(map)).toEqual([
      { eventId: "ev_gate", pageId: "p1", auto: true },
      { eventId: "ev_sign", pageId: "q0", auto: false },
    ]);
  });
});
