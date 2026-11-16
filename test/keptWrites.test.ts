import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { createBlankProject } from "@/project/defaults";

// 페이지를 통째로 다시 쓸 때 빠진 상태 쓰기를 지킨다 — 2026-11-16 pf4 명세 은행 r5a-river(한씨 첫 페이지를 다시 쓰자 경로 스위치가 빠져 곁 의뢰가 막혔다).
const page = (commands: unknown[], conditions: unknown[] = []) => ({ id: `p${Math.random().toString(36).slice(2, 7)}`, trigger: { kind: "action" }, priority: "same", graphic: {}, movement: { type: "fixed", speed: 3, frequency: 3 }, conditions, commands });

function setup(readSwitch = true): { ctx: ToolContext; mapId: string } {
  const project = createBlankProject();
  const map = project.maps[project.startMapId]!;
  (project.database as unknown as { switches: { id: string; name: string }[] }).switches.push({ id: "sw_path_taken", name: "길" }, { id: "sw_plain", name: "그냥" });
  map.events.push({ id: "ev_han", name: "한씨", x: 2, y: 2, trigger: { kind: "action" }, commands: [], pages: [page([{ kind: "text", body: "부탁하네" }, { kind: "setSwitch", switchId: "sw_path_taken", value: true }, { kind: "setSwitch", switchId: "sw_plain", value: true }])] } as never);
  map.events.push({ id: "ev_fisher", name: "어부", x: 6, y: 6, trigger: { kind: "action" }, commands: [], pages: [page([{ kind: "text", body: "안녕" }]), ...(readSwitch ? [page([{ kind: "text", body: "그래 들었네" }], [{ kind: "switch", switchId: "sw_path_taken", value: true }])] : [])] } as never);
  return { ctx: { project }, mapId: map.id };
}
const hanCommands = (ctx: ToolContext, mapId: string) => JSON.stringify(ctx.project.maps[mapId]!.events.find((e) => e.id === "ev_han")!.pages![0]!.commands);

describe("페이지를 다시 쓸 때 다른 이벤트가 기다리는 상태 쓰기를 지킨다", () => {
  it("patch_event_page — 다른 어디서도 켜지 않는데 어부가 기다리는 스위치는 새 페이지 끝에 되붙이고 알린다", () => {
    const { ctx, mapId } = setup();
    const result = runTool(ctx, "patch_event_page", { mapId, eventId: "ev_han", pageIndex: 0, set: { commands: [{ kind: "text", body: "새 대사" }] } });
    expect(result.ok).toBe(true);
    expect(hanCommands(ctx, mapId)).toContain('"switchId":"sw_path_taken"');
    // 아무도 읽지 않는 스위치는 되붙이지 않는다.
    expect(hanCommands(ctx, mapId)).not.toContain('"switchId":"sw_plain"');
    expect(result.summary).toContain("Carried over 1 state write");
    expect(result.summary).toContain("sw_path_taken");
  });

  it("dropWrites:true 면 정말 지우고, 이제 쓰는 곳이 없는 것을 결과에 적는다", () => {
    const { ctx, mapId } = setup();
    const result = runTool(ctx, "patch_event_page", { mapId, eventId: "ev_han", pageIndex: 0, set: { commands: [{ kind: "text", body: "새 대사" }] }, dropWrites: true });
    expect(result.ok).toBe(true);
    expect(hanCommands(ctx, mapId)).not.toContain("sw_path_taken");
    expect(result.summary).toContain("Removed as asked");
    expect(result.summary).toContain("sw_path_taken");
  });

  it("어디서도 읽지 않는 쓰기는 되붙이지 않는다", () => {
    const { ctx, mapId } = setup(false);
    const result = runTool(ctx, "patch_event_page", { mapId, eventId: "ev_han", pageIndex: 0, set: { commands: [{ kind: "text", body: "새 대사" }] } });
    expect(result.ok).toBe(true);
    expect(hanCommands(ctx, mapId)).not.toContain("setSwitch");
    expect(result.summary).not.toContain("Carried over");
  });

  it("upsert_event replacePages 도 같은 길을 쓴다", () => {
    const { ctx, mapId } = setup();
    const result = runTool(ctx, "upsert_event", { mapId, replacePages: true, event: { id: "ev_han", pages: [page([{ kind: "text", body: "갈아엎음" }])] } });
    expect(result.ok).toBe(true);
    expect(hanCommands(ctx, mapId)).toContain('"switchId":"sw_path_taken"');
    expect((result.data as { carriedWrites?: string[] }).carriedWrites).toEqual(["sw:sw_path_taken"]);
  });
});
