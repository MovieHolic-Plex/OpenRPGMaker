// 2026-09-24 연애 도그푸딩: 모델이 조건 분기를 페이지 조건처럼 `conditions:[…]` 로 쓰거나, then 없이 뒤따르는
// 형제 명령으로 썼다 — 「condition가 객체가 아닙니다」 뒤에 text 예시만 받아 침대 이벤트를 고치지 못하고 새로 만들었다.
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools/toolRunner";
import { createBlankProject } from "@/project/defaults";

const DAY_GE_6 = { kind: "variable", variableId: "var_day", op: ">=", value: 6 };

describe("fork 조건 표기", () => {
  it("conditions 배열을 condition 으로 옮긴다(여럿이면 all)", () => {
    const ctx = { project: createBlankProject() };
    const mapId = ctx.project.startMapId;
    const result = runTool(ctx, "upsert_event", {
      mapId,
      event: {
        id: "ev_bed", x: 2, y: 2, commands: [],
        pages: [{ trigger: { kind: "action" }, graphic: { transparent: true }, commands: [
          { kind: "fork", conditions: [DAY_GE_6], then: [{ kind: "text", body: "축제다" }] },
          { kind: "fork", conditions: [DAY_GE_6, { kind: "switch", switchId: "sw_x", value: true }], thenBranch: [{ kind: "text", body: "둘 다" }], elseBranch: [] },
        ] }],
      },
    });
    expect(result.ok, result.summary).toBe(true);
    const commands = ctx.project.maps[mapId]!.events.find((event) => event.id === "ev_bed")!.pages![0]!.commands;
    expect(commands[0]).toMatchObject({ kind: "fork", condition: DAY_GE_6 });
    expect(commands[1]).toMatchObject({ kind: "fork", condition: { kind: "all" }, then: [{ kind: "text" }], else: [] });
  });

  it("then 없는 fork 는 올바른 fork 예시와 함께 거부한다", () => {
    const ctx = { project: createBlankProject() };
    const result = runTool(ctx, "upsert_event", {
      mapId: ctx.project.startMapId,
      event: { id: "ev_bed2", x: 2, y: 2, commands: [], pages: [{ trigger: { kind: "action" }, graphic: { transparent: true }, commands: [
        { kind: "fork", conditions: [DAY_GE_6] }, { kind: "text", body: "축제다" },
      ] }] },
    });
    expect(result.ok).toBe(false);
    const message = (result.issues ?? []).map((issue) => issue.message).join("\n");
    expect(message).toContain("then 배열");
    expect(message).toContain('kind:"fork",condition:');
  });
});
