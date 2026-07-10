import { describe, expect, it, beforeEach } from "vitest";
import {
  SUGGESTED_REGION_COMMANDS,
  nextSuggestedRegionCommands,
  __resetSuggestedRegionRotationForTest,
} from "@/editor/regionTask/suggestedCommands";

describe("suggestedCommands", () => {
  beforeEach(() => __resetSuggestedRegionRotationForTest());

  it("12개 상수 — id 중복 없음, instruction 비어있지 않음", () => {
    expect(SUGGESTED_REGION_COMMANDS).toHaveLength(12);
    expect(new Set(SUGGESTED_REGION_COMMANDS.map((command) => command.id)).size).toBe(12);
    for (const command of SUGGESTED_REGION_COMMANDS) expect(command.instruction.length).toBeGreaterThan(5);
  });

  it("호출마다 로테이션 — 첫 호출 [0..3], 둘째 호출 [4..7], 랩어라운드", () => {
    const first = nextSuggestedRegionCommands(4);
    const second = nextSuggestedRegionCommands(4);
    const third = nextSuggestedRegionCommands(4);
    const fourth = nextSuggestedRegionCommands(4);
    expect(first.map((command) => command.id)).toEqual(SUGGESTED_REGION_COMMANDS.slice(0, 4).map((command) => command.id));
    expect(second.map((command) => command.id)).toEqual(SUGGESTED_REGION_COMMANDS.slice(4, 8).map((command) => command.id));
    expect(third.map((command) => command.id)).toEqual(SUGGESTED_REGION_COMMANDS.slice(8, 12).map((command) => command.id));
    expect(fourth[0].id).toBe(SUGGESTED_REGION_COMMANDS[0].id); // 랩어라운드
  });
});
