// J62: 맵 탭·QA 걷기로 걷는 중 닿기 이벤트(놀래킴 대사)가 돌면 주인공은 칸 경계에서 멈춘다. 이벤트가 시킨 강제 이동은 계속 걷는다.
import { describe, expect, it } from "vitest";
import { startPlayerRoute, yieldPlayerRouteToEvents } from "@/player/playerRouteState";
import type { PlaySceneContext } from "@/player/playSceneTypes";

type Scene = Pick<PlaySceneContext, "playerRoute" | "playerSlide" | "playerSlideKind" | "running">;
const scene = (): Scene => ({ playerRoute: null, playerSlide: null, playerSlideKind: null, running: false });
const moves = [{ kind: "move" as const, dir: "right" as const }, { kind: "move" as const, dir: "right" as const }];

describe("자유 걷기는 이벤트에 자리를 내준다", () => {
  it("이벤트가 돌면 탭 걷기를 그만둔다", () => {
    const s = scene();
    startPlayerRoute(s, moves, false);
    s.playerRoute!.yieldsToEvents = true;
    expect(yieldPlayerRouteToEvents(s, false)).toBe(false);
    s.running = true;
    expect(yieldPlayerRouteToEvents(s, false)).toBe(true);
    expect(s.playerRoute).toBeNull();
  });

  it("컷신 입력 잠금도 멈춘다", () => {
    const s = scene();
    startPlayerRoute(s, moves, false);
    s.playerRoute!.yieldsToEvents = true;
    expect(yieldPlayerRouteToEvents(s, true)).toBe(true);
  });

  it("이벤트가 시킨 강제 이동은 계속 걷는다", () => {
    const s = scene();
    startPlayerRoute(s, moves, false);
    s.running = true;
    expect(yieldPlayerRouteToEvents(s, true)).toBe(false);
    expect(s.playerRoute?.moves.length).toBe(2);
  });
});
