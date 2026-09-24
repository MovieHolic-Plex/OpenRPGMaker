// 2026-09-24 갤러리 호러 도그푸딩: upsert_event 8건이 두 가지 이유로 통째로 반려됐다 —
// 대사 본문을 `text` 로 보냄(「대사는 string body가 필요합니다」), 새 스위치·변수 id 를 선언 없이 씀(커밋 게이트
// 「switchId가 존재하지 않습니다」). 둘 다 뜻이 하나로 정해지므로 고쳐 받고 경고로 알린다.
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import type { Project } from "@/project/types";

function introEvent(): Record<string, unknown> {
  return {
    id: "ev_intro", x: 3, y: 3,
    pages: [
      {
        trigger: { kind: "auto" }, conditions: [],
        commands: [
          { kind: "text", text: "하린: ……엄마?" },
          { kind: "setSwitch", switchId: "sw_intro_done", value: true },
          { kind: "setVariable", variableId: "var_petals", op: "=", value: 5 },
        ],
      },
      { trigger: { kind: "action" }, conditions: [{ kind: "switch", switchId: "sw_intro_done", value: true }], commands: [] },
    ],
  };
}

describe("upsert_event text alias and new flags", () => {
  it("moves text→body and registers new switch/variable ids", () => {
    const ctx: { project: Project } = { project: createBlankProject() };
    const mapId = ctx.project.startMapId;
    const result = runTool(ctx, "upsert_event", { mapId, event: introEvent() });
    expect(result.ok, `${result.summary} ${JSON.stringify(result.issues)}`).toBe(true);
    const event = ctx.project.maps[mapId]!.events.find(e => e.id === "ev_intro")!;
    const text = event.pages![0]!.commands[0] as Record<string, unknown>;
    expect(text.body).toBe("하린: ……엄마?");
    expect(text).not.toHaveProperty("text");
    expect(ctx.project.switches.some(s => s.id === "sw_intro_done")).toBe(true);
    expect(ctx.project.variables.some(v => v.id === "var_petals")).toBe(true);
    const warnings = JSON.stringify(result);
    expect(warnings).toContain("body");
    expect(warnings).toContain("sw_intro_done");
  });

  it("keeps rejecting a text command with two competing body aliases", () => {
    const ctx: { project: Project } = { project: createBlankProject() };
    const event = introEvent();
    (event.pages as { commands: unknown[] }[])[0]!.commands[0] = { kind: "text", text: "a", message: "b" };
    const result = runTool(ctx, "upsert_event", { mapId: ctx.project.startMapId, event });
    expect(result.ok).toBe(false);
    expect(result.summary).toContain("body");
  });
});
