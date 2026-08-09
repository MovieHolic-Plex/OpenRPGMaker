import { describe, expect, it } from "vitest";
import { createInterpreter } from "@/player/interpreter";
import { resolveShowAnimationTargetTile } from "@/player/playSceneMapAnimations";
import type { PlaySessionLike } from "@/project/sessionRuntimeTypes"
import { createBlankProject } from "@/project/defaults";
import type { Command } from "@/project/types";

function mkSession(): PlaySessionLike {
  return {
    flags: {},
    switches: { sw_after_animation: false },
    variables: {},
    timers: {},
    gold: 0,
    inventory: {},
    partyActorIds: [],
    actorVitals: {},
    currentMapId: "m1",
    x: 1,
    y: 2,
    audio: {},
    pictures: {},
  };
}

describe("showAnimation 런타임", () => {
  it("player/eventId/좌표 target을 시작 시점 타일 좌표로 해석한다", () => {
    const resolver = {
      player: { x: 4, y: 5 },
      currentEventId: "ev_current",
      eventPosition: (eventId: string) =>
        ({
          ev_door: { x: 7, y: 2 },
          ev_current: { x: 3, y: 8 },
        })[eventId],
    };

    expect(resolveShowAnimationTargetTile("player", resolver)).toEqual({ x: 4, y: 5 });
    expect(resolveShowAnimationTargetTile({ eventId: "ev_door" }, resolver)).toEqual({ x: 7, y: 2 });
    expect(resolveShowAnimationTargetTile({ eventId: "" }, resolver)).toEqual({ x: 3, y: 8 });
    expect(resolveShowAnimationTargetTile({ x: 9, y: 1 }, resolver)).toEqual({ x: 9, y: 1 });
  });

  it("wait:true는 showAnimation step을 resume하기 전까지 다음 커맨드 진행을 멈춘다", () => {
    const project = createBlankProject();
    const session = mkSession();
    const commands: Command[] = [
      { kind: "showAnimation", target: "player", animationId: "anim_hit", wait: true },
      { kind: "setSwitch", switchId: "sw_after_animation", value: true },
    ];

    const interpreter = createInterpreter(commands, session, project);
    const step = interpreter.start();

    expect(step).toEqual({ kind: "showAnimation", target: "player", animationId: "anim_hit", wait: true });
    expect(session.switches.sw_after_animation).toBe(false);

    const done = interpreter.resume(undefined);

    expect(done.kind).toBe("done");
    expect(session.switches.sw_after_animation).toBe(true);
  });
});
