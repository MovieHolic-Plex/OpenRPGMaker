import { describe, expect, it, beforeEach } from "vitest";
import {
  SUGGESTED_REGION_COMMANDS,
  nextSuggestedRegionCommands,
  nextStartScreenSuggestedCommands,
  __resetSuggestedRegionRotationForTest,
  __resetStartScreenSuggestedRotationForTest,
} from "@/editor/regionTask/suggestedCommands";

describe("suggestedCommands", () => {
  beforeEach(() => {
    __resetSuggestedRegionRotationForTest();
    __resetStartScreenSuggestedRotationForTest();
  });

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

  it("시작 화면 카드와 모달은 독립된 로테이션 카운터를 쓴다", () => {
    // 시작 화면 카드를 여러 번 소모해도 모달 쪽 카운터(rotation)는 전혀 영향받지 않는다.
    nextStartScreenSuggestedCommands(3);
    nextStartScreenSuggestedCommands(3);
    nextStartScreenSuggestedCommands(3);
    const modalFirst = nextSuggestedRegionCommands(4);
    expect(modalFirst.map((command) => command.id)).toEqual(SUGGESTED_REGION_COMMANDS.slice(0, 4).map((command) => command.id));
  });

  it("시작 화면 로테이션 자체도 순서대로 돌고 랩어라운드한다", () => {
    const first = nextStartScreenSuggestedCommands(3);
    const second = nextStartScreenSuggestedCommands(3);
    const third = nextStartScreenSuggestedCommands(3);
    const fourth = nextStartScreenSuggestedCommands(3);
    const fifth = nextStartScreenSuggestedCommands(3);
    expect(first.map((command) => command.id)).toEqual(SUGGESTED_REGION_COMMANDS.slice(0, 3).map((command) => command.id));
    expect(second.map((command) => command.id)).toEqual(SUGGESTED_REGION_COMMANDS.slice(3, 6).map((command) => command.id));
    expect(third.map((command) => command.id)).toEqual(SUGGESTED_REGION_COMMANDS.slice(6, 9).map((command) => command.id));
    expect(fourth.map((command) => command.id)).toEqual(SUGGESTED_REGION_COMMANDS.slice(9, 12).map((command) => command.id));
    expect(fifth[0].id).toBe(SUGGESTED_REGION_COMMANDS[0].id); // 랩어라운드
  });
});
