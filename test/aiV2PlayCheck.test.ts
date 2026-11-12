import { describe, expect, it } from "vitest";
import { deserialize, serialize } from "@/project/io";
import { v2BaselineGameKeys } from "@/ai/v2/judge/finishGate";
import { AUTOPLAY_GATE_PREFIX, playProblems } from "@/ai/v2/judge/playCheck";
import { buildQaFixture } from "./fixtures/qaGame/qaGameFixtures";
import type { Project } from "@/project/types";

// 견본의 사람·물건은 그림 없이 지어져 있다 — 이 관문의 자동 플레이는 보이는 것만 쓰므로(정직한 플레이), 지은 게임이 그렇듯 페이지마다 칩을 입힌다.
const load = (name: Parameters<typeof buildQaFixture>[0]): Project => {
  const project = deserialize(serialize(buildQaFixture(name)));
  for (const map of Object.values(project.maps)) for (const event of map.events) for (const page of event.pages ?? []) {
    if (!page.graphic?.sprite && !page.graphic?.appearanceId) page.graphic = { ...page.graphic, transparent: false, sprite: { type: "bundled", id: "fixture-chip" } };
  }
  return project;
};
const WHOLE_GAME = "마을과 던전이 있는 모험 게임을 만들어 줘";

describe("v2 finish gate: the game must play through to an ending", () => {
  it("raises a play problem when the auto-play cannot reach the ending", () => {
    const problems = playProblems(load("endingSwitchUnset"));
    expect(problems.length).toBeGreaterThan(0);
    expect(problems[0]!.ko).toContain("[끝까지 플레이 불가]");
    expect(problems[0]!.target!.ref!.length).toBeGreaterThan(0);
    expect(new Set(problems.map((p) => p.target!.ref)).size).toBe(problems.length);
  });

  it("raises nothing for a game whose auto-play reaches the ending", () => {
    expect(playProblems(load("clean"))).toEqual([]);
  });

  it("an ending only the plan can find is not reached: the path's people have no graphic", () => {
    const unseen = playProblems(deserialize(serialize(buildQaFixture("clean"))));
    expect(unseen.length).toBeGreaterThan(0);
    expect(unseen.every((problem) => problem.variant === "unseen")).toBe(true);
  });

  it("the finish gate carries the problem for a whole-game request and not for a small edit", () => {
    const stuck = load("endingSwitchUnset");
    expect([...v2BaselineGameKeys(stuck, WHOLE_GAME)].some((key) => key.startsWith(AUTOPLAY_GATE_PREFIX))).toBe(true);
    expect([...v2BaselineGameKeys(stuck, "이 맵의 상점 주인 이름을 바꿔 줘")].some((key) => key.startsWith(AUTOPLAY_GATE_PREFIX))).toBe(false);
    expect([...v2BaselineGameKeys(load("clean"), WHOLE_GAME)].some((key) => key.startsWith(AUTOPLAY_GATE_PREFIX))).toBe(false);
  });
});
