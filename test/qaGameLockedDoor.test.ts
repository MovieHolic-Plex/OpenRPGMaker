// qa:game 자동 플레이가 잠긴 문(transfer 페이지가 스위치를 기다림)의 선행 조건을 사슬에 넣는지.
// 2026-09-24 갤러리 호러: 화실 문이 「화실 개방」 스위치를 기다리는데 자동 플레이는 문을 못 찾아 막힘으로 오판했다.
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import { runGameCheck } from "@/qa/gameCheck";
import type { Project } from "@/project/types";

describe("autoplay locked door", () => {
  it("unlocks a switch-gated door before walking to the room behind it", () => {
    const ctx: { project: Project } = { project: createBlankProject() };
    const hall = ctx.project.startMapId;
    const { x, y } = ctx.project.startPos;
    expect(runTool(ctx, "create_map", { id: "map_room", name: "화실", width: 12, height: 10 }).ok).toBe(true);
    const ok = (name: string, args: Record<string, unknown>) => { const r = runTool(ctx, name, args); expect(r.ok, `${name} ${r.summary}`).toBe(true); };
    ok("upsert_event", { mapId: hall, event: { id: "ev_key", x: x + 1, y, pages: [{ trigger: { kind: "action" }, conditions: [], commands: [{ kind: "setSwitch", switchId: "sw_open", value: true }] }] } });
    ok("upsert_event", { mapId: hall, event: { id: "ev_door", x: x - 2, y, pages: [
      { trigger: { kind: "action" }, conditions: [], commands: [{ kind: "text", body: "잠겨 있다." }] },
      { trigger: { kind: "playerTouch" }, conditions: [{ kind: "switch", switchId: "sw_open", value: true }], commands: [{ kind: "transfer", mapId: "map_room", x: 5, y: 5 }] },
    ] } });
    ok("define_ending", { id: "ending_room", name: "끝", conditions: [] });
    ok("upsert_event", { mapId: "map_room", event: { id: "ev_end", x: 6, y: 5, pages: [{ trigger: { kind: "action" }, conditions: [], commands: [{ kind: "triggerEnding", endingId: "ending_room" }] }] } });
    const report = runGameCheck(ctx.project);
    const run = report.autoPlay!.runs[0]!;
    expect(run.ok, JSON.stringify(run.steps)).toBe(true);
    expect(report.autoPlay!.plan.join(" ")).toContain("sw_open");
  });
});
