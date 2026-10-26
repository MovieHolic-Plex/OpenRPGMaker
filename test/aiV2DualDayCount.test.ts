import { describe, expect, it } from "vitest";
import { dayCounterVariables } from "@/ai/v2/gameChecks";
import type { Project } from "@/project/types";

// 판정 J18(서울 연애): HUD 달력 「봄 4일」과 대사의 「1일차」 변수가 따로 셌다.
function project(sleepCommands: unknown[], commonEvents: unknown[] = []): Project {
  return {
    variables: [{ id: "var_day_count", name: "서울에서 보낸 일수" }, { id: "var_love", name: "호감도" }],
    maps: { m: { id: "m", name: "방", width: 3, height: 3, events: [{ id: "ev_bed", name: "침대", x: 1, y: 1, pages: [{ conditions: [], trigger: { kind: "action" }, commands: sleepCommands }] }] } },
    commonEvents,
  } as unknown as Project;
}

describe("dayCounterVariables (J18 two day systems)", () => {
  it("finds a variable bumped next to sleepUntilMorning", () => {
    const found = dayCounterVariables(project([{ kind: "sleepUntilMorning" }, { kind: "setVariable", variableId: "var_day_count", op: "+=", value: 1 }]));
    expect(found.map((v) => v.id)).toEqual(["var_day_count"]);
  });
  it("ignores affection bumps and the onDayEnd counter", () => {
    expect(dayCounterVariables(project([{ kind: "setVariable", variableId: "var_love", op: "+=", value: 2 }]))).toEqual([]);
    const ce = [{ id: "ce_deadline_ending", name: "기한", commands: [{ kind: "setVariable", variableId: "var_day_count", op: "+=", value: 1 }] }];
    expect(dayCounterVariables(project([], ce), "ce_deadline_ending")).toEqual([]);
  });
});
