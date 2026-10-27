import { describe, expect, it } from "vitest";
import { slowChasers } from "../src/ai/v2/gameChecks";
import type { Project } from "../src/project/types";

const chaserProject = (movement: Record<string, unknown>): Project => ({
  maps: { m: { id: "m", name: "복도", width: 10, height: 10, events: [{ id: "ev_c", name: "그림자", x: 1, y: 1, pages: [{ movement, commands: [{ kind: "gameOver" }] }] }] },
} as unknown as Project);

describe("slow chasers (J77)", () => {
  it("flags a chaser that rests 240ms between steps", () => {
    expect(slowChasers(chaserProject({ type: "chase", speed: 6, frequency: 5 }))).toHaveLength(1);
  });
  it("passes the make_chase_scene default (speed 6, frequency 8)", () => {
    expect(slowChasers(chaserProject({ type: "chase", speed: 6, frequency: 8 }))).toHaveLength(0);
  });
  it("ignores field enemies that start a battle", () => {
    const p = chaserProject({ type: "chase", speed: 3, frequency: 3 });
    (p.maps.m!.events[0]!.pages[0] as unknown as { commands: unknown[] }).commands = [{ kind: "battleProcessing" }];
    expect(slowChasers(p)).toHaveLength(0);
  });
});

describe("slow chasers — exemptions", () => {
  it("skips a chaser with an explicit approach style", () => {
    expect(slowChasers(chaserProject({ type: "chase", speed: 3, frequency: 3, approachStyle: "lumber" }))).toHaveLength(0);
  });
});
