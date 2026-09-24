import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";

describe("upsert_event pages + 최상위 commands", () => {
  it("명령이 빈 페이지가 하나면 최상위 commands 를 그 페이지로 옮긴다(문 열림 → 다음 기억 transfer)", () => {
    const ctx = { project: createBlankProject() };
    const mapId = ctx.project.startMapId;
    const sw = ctx.project.switches[0]!.id;
    const res = runTool(ctx, "upsert_event", {
      mapId,
      event: {
        id: "ev_gate", x: 4, y: 4,
        pages: [{ trigger: { kind: "action" }, conditions: [{ kind: "switch", switchId: sw, value: true }], graphic: { transparent: true } }],
        commands: [{ kind: "text", body: "문이 열렸다." }, { kind: "transfer", mapId, x: 2, y: 2 }],
      },
    });
    expect(res.ok, res.summary).toBe(true);
    const event = ctx.project.maps[mapId]!.events.find((entry) => entry.id === "ev_gate")!;
    expect(event.pages![0]!.commands.map((command) => command.kind)).toEqual(["text", "transfer"]);
    expect(event.commands).toEqual([]);
    expect(JSON.stringify(res.diff?.warnings)).toContain("pages[0] 로 옮김");
  });

  it("어느 페이지인지 모르면 거부한다", () => {
    const ctx = { project: createBlankProject() };
    const res = runTool(ctx, "upsert_event", {
      mapId: ctx.project.startMapId,
      event: { id: "ev_two", x: 4, y: 4, pages: [{ trigger: { kind: "action" } }, { trigger: { kind: "action" } }], commands: [{ kind: "text", body: "?" }] },
    });
    expect(res.ok).toBe(false);
    expect(res.summary).toContain("pages[].commands");
  });
});
