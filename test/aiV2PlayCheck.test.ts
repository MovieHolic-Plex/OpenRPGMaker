import { describe, expect, it } from "vitest";
import { deserialize, serialize } from "@/project/io";
import { v2BaselineGameKeys } from "@/ai/v2/verbs";
import { AUTOPLAY_GATE_PREFIX, playProblems } from "@/ai/v2/playCheck";
import { buildQaFixture } from "./fixtures/qaGame/qaGameFixtures";
import type { Project } from "@/project/types";

const load = (name: Parameters<typeof buildQaFixture>[0]): Project => deserialize(serialize(buildQaFixture(name)));
const WHOLE_GAME = "마을과 던전이 있는 모험 게임을 만들어 줘";

describe("v2 finish gate: the game must play through to an ending", () => {
  it("raises a play problem when the auto-play cannot reach the ending", () => {
    const problems = playProblems(load("endingSwitchUnset"));
    expect(problems.length).toBeGreaterThan(0);
    expect(problems[0]!.text).toContain("[끝까지 플레이 불가]");
    expect(problems[0]!.key.length).toBeGreaterThan(0);
    expect(problems[0]!.key).toContain("|");
  });

  it("raises nothing for a game whose auto-play reaches the ending", () => {
    expect(playProblems(load("clean"))).toEqual([]);
  });

  it("the finish gate carries the problem for a whole-game request and not for a small edit", () => {
    const stuck = load("endingSwitchUnset");
    expect([...v2BaselineGameKeys(stuck, WHOLE_GAME)].some((key) => key.startsWith(AUTOPLAY_GATE_PREFIX))).toBe(true);
    expect([...v2BaselineGameKeys(stuck, "이 맵의 상점 주인 이름을 바꿔 줘")].some((key) => key.startsWith(AUTOPLAY_GATE_PREFIX))).toBe(false);
    expect([...v2BaselineGameKeys(load("clean"), WHOLE_GAME)].some((key) => key.startsWith(AUTOPLAY_GATE_PREFIX))).toBe(false);
  });
});
